import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { testDatabase } from '../../../tests/helpers/database.js';
import { createApp } from '../src/app.js';
import { fixtureId } from '../src/seed.js';
import { createSubmissionService } from '../src/draft-submissions.js';

test('quotation HTTP API with real sessions and restricted PostgreSQL runtime', async t => {
  const db = await testDatabase();
  const config = { nodeEnv: 'test', gstPercent: '18', sessionSecret: randomBytes(32).toString('hex'), appOrigin: 'http://localhost:5173', trustProxyHops: 0 };
  const app = createApp(db.runtime, config, { sessionSchema: db.schema, loginLimit: 100 });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const path = `/api/rfqs/${fixtureId(21)}/quote-versions`;
  const body = () => ({ pricingDate: '2026-11-02', partId: fixtureId(22), routingRevisionId: fixtureId(23), marginPercent: '20', tierQuantities: { '50':'90000','100':'180000','150':'270000' } });
  function client() {
    return { cookie: '', token: '',
      async request(path, { method = 'GET', body, key, headers = {} } = {}) {
        const response = await fetch(base + path, { method, headers: {
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(method !== 'GET' ? { Origin: config.appOrigin, 'X-CSRF-Token': this.token } : {}),
          ...(body === undefined ? {} : { 'Content-Type':'application/json' }), ...(key ? { 'Idempotency-Key':key } : {}), ...headers
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        for (const cookie of response.headers.getSetCookie()) this.cookie = cookie.split(';')[0];
        const data = await response.json(); if (data.csrfToken) this.token = data.csrfToken;
        return { status: response.status, data, response };
      },
      async login(username, password) {
        await this.request('/api/auth/session');
        assert.equal((await this.request('/api/auth/login', { method:'POST', body:{ username,password } })).status, 200);
      }
    };
  }
  const estimator = client(), sales = client();
  const count = async () => (await db.owner.query(`SELECT
    (SELECT count(*) FROM quotation_versions) AS versions,
    (SELECT count(*) FROM quotation_parts) AS parts,
    (SELECT count(*) FROM quotation_rates) AS rates,
    (SELECT count(*) FROM quotation_part_tiers) AS tiers,
    (SELECT count(*) FROM quotation_totals) AS totals,
    (SELECT count(*) FROM draft_submissions) AS submissions,
    (SELECT max(next_version) FROM quotations) AS counter`)).rows[0];
  let versionId, key;
  try {
    await t.test('anonymous cannot read RFQ/quotes or submit', async () => {
      const anonymous = client();
      for (const route of ['/api/rfqs', `/api/rfqs/${fixtureId(21)}`, `/api/quote-versions/${randomUUID()}`]) assert.equal((await anonymous.request(route)).status, 401);
      assert.equal((await anonymous.request(path, { method:'POST',key:randomUUID(),body:body() })).status, 401);
    });
    await estimator.login('estimator', db.passwords.DEMO_ESTIMATOR_PASSWORD);
    await sales.login('sales_head', db.passwords.DEMO_SALES_HEAD_PASSWORD);
    await t.test('RFQ list/detail exposes stored inputs, routes and decimal strings', async () => {
      assert.equal((await estimator.request('/api/health/ready')).status, 200);
      const list = await estimator.request('/api/rfqs'); assert.equal(list.status, 200);
      assert.equal(list.data.rfqs[0].reference, 'RFQ-2611-014');
      const detail = (await estimator.request(`/api/rfqs/${fixtureId(21)}`)).data;
      assert.equal(detail.parts[0].grossWeightKg, '0.610000');
      assert.equal(detail.parts[0].routes[0].cycleTimeMin, '3.200000');
      assert.deepEqual(detail.parts[0].defaultTierQuantities, body().tierQuantities);
      assert.equal((await sales.request('/api/rfqs')).status, 200);
      assert.equal((await estimator.request('/api/rfqs/invalid')).status, 400);
      assert.equal((await estimator.request(`/api/rfqs/${randomUUID()}`)).status, 404);
    });
    await t.test('sales-head, invalid CSRF and invalid business inputs write nothing', async () => {
      const before = await count();
      assert.equal((await sales.request(path, { method:'POST', key:randomUUID(),body:body() })).status, 403);
      assert.equal((await estimator.request(path, { method:'POST', key:randomUUID(),body:body(),headers:{ 'X-CSRF-Token':'wrong' } })).status, 403);
      for (const change of [{ marginPercent:'100' },{ marginPercent:20 },{ pricingDate:'2026-02-30' },{ gstPercent:'0' },{ partId:randomUUID() },{ tierQuantities:{'50':'0','100':'180000','150':'270000'} }]) {
        assert.equal((await estimator.request(path, { method:'POST', key:randomUUID(),body:{ ...body(),...change } })).status, 400);
      }
      assert.equal((await estimator.request(path, { method:'POST',body:body() })).status, 400);
      assert.equal((await estimator.request(path, { method:'POST',key:randomUUID(),body:{...body(),routingRevisionId:randomUUID()} })).status, 404);
      const missing = await estimator.request(path, { method:'POST',key:randomUUID(),body:{...body(),pricingDate:'2026-11-01'} });
      assert.equal(missing.status, 422); assert.equal(missing.data.error.code, 'RATE_NOT_FOUND');
      assert.deepEqual(await count(), before);
    });
    await t.test('estimator creates and retrieves independent spindle golden results', async () => {
      key = randomUUID();
      const response = await estimator.request(path, { method:'POST',key,body:body() });
      assert.equal(response.status, 201); assert.equal(response.data.replayed, false);
      versionId = response.data.versionId;
      assert.equal(response.response.headers.get('location'), `/api/quote-versions/${versionId}`);
      const saved = await estimator.request(`/api/quote-versions/${versionId}`);
      assert.equal(saved.status, 200); assert.equal(saved.response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(saved.data.parts[0].result.tiers.map(tier => [tier.annualQty,tier.costPerUnit,tier.sellingPricePerUnitExGst]), [
        ['90000','120.44','150.55'],['180000','119.76','149.70'],['270000','119.53','149.41']
      ]);
      assert.deepEqual(saved.data.totals[1], { scenario:'100',taxableSubtotal:'26946000.00',gstAmount:'4850280.00',totalWithGst:'31796280.00' });
      assert.equal((await sales.request(`/api/quote-versions/${versionId}`)).status, 200);
    });
    await t.test('canonical replay returns original receipt; different content conflicts', async () => {
      const before = await count();
      const equivalent = { tierQuantities:{'150':'270000','100':'180000','50':'90000'},marginPercent:'20.000000',routingRevisionId:fixtureId(23).toUpperCase(),partId:fixtureId(22),pricingDate:'2026-11-02' };
      const replay = await estimator.request(path, { method:'POST',key,body:equivalent });
      assert.equal(replay.status, 200); assert.deepEqual(replay.data, { versionId,replayed:true });
      assert.equal((await estimator.request(path, { method:'POST',key,body:{...body(),marginPercent:'21'} })).status, 409);
      assert.equal((await estimator.request(`/api/rfqs/${randomUUID()}/quote-versions`, { method:'POST',key,body:body() })).status, 409);
      assert.deepEqual(await count(), before);
    });
    await t.test('six concurrent retries create exactly one version; new key creates another', async () => {
      const concurrentKey = randomUUID();
      const responses = await Promise.all(Array.from({length:6}, () => estimator.request(path,{method:'POST',key:concurrentKey,body:body()})));
      assert.equal(responses.filter(response => response.status === 201).length, 1);
      assert.equal(responses.filter(response => response.status === 200).length, 5);
      assert.equal(new Set(responses.map(response => response.data.versionId)).size, 1);
      assert.deepEqual(await count(), { versions:'2',parts:'2',rates:'12',tiers:'6',totals:'6',submissions:'2',counter:'3' });
      const intentional = await estimator.request(path,{method:'POST',key:randomUUID(),body:body()});
      assert.equal(intentional.status,201); assert.notEqual(intentional.data.versionId,versionId);
    });
    await t.test('receipt insertion failure rolls back quote and counter; same key can succeed later', async () => {
      const before = await count(), retryKey = randomUUID();
      await db.owner.query("CREATE FUNCTION fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt storage failure'; END; $$; CREATE TRIGGER fail_receipt BEFORE INSERT ON draft_submissions FOR EACH ROW EXECUTE FUNCTION fail_receipt()");
      try {
        const failed = await estimator.request(path,{method:'POST',key:retryKey,body:body()});
        assert.equal(failed.status,503); assert.equal(failed.data.error.code,'QUOTATION_SERVICE_UNAVAILABLE');
        assert.ok(!JSON.stringify(failed.data).includes('receipt storage failure'));
        assert.deepEqual(await count(),before);
      } finally { await db.owner.query('DROP TRIGGER fail_receipt ON draft_submissions; DROP FUNCTION fail_receipt()'); }
      assert.equal((await estimator.request(path,{method:'POST',key:retryKey,body:body()})).status,201);
      assert.equal((await estimator.request(path,{method:'POST',key:retryKey,body:body()})).status,200);
    });
    await t.test('lost COMMIT acknowledgement reconciles through same key without duplicate', async () => {
      const actorId = (await db.owner.query("SELECT id FROM users WHERE username='estimator'")).rows[0].id;
      let commits = 0;
      const uncertainPool = { async connect() { const client = await db.runtime.connect(); return {
        async query(sql, values) { const result = await client.query(sql,values); if(sql === 'COMMIT') { commits++; throw Error('lost acknowledgement'); } return result; },
        release() { client.release(); }
      }; } };
      const retryKey = randomUUID();
      await assert.rejects(createSubmissionService(uncertainPool,config)(actorId,fixtureId(21),retryKey,body()), /lost acknowledgement/);
      assert.equal(commits,1);
      const before = await count();
      const replay = await estimator.request(path,{method:'POST',key:retryKey,body:body()});
      assert.equal(replay.status,200); assert.equal(replay.data.replayed,true);
      assert.deepEqual(await count(),before);
    });
    await t.test('submission uniqueness, immutability and runtime privileges remain enforced', async () => {
      const constraints = (await db.owner.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='draft_submissions'::regclass")).rows;
      assert.ok(constraints.some(row => row.definition === 'UNIQUE (actor_user_id, submission_key)'));
      for (const sql of ['UPDATE draft_submissions SET request_fingerprint=request_fingerprint','DELETE FROM draft_submissions','TRUNCATE draft_submissions']) {
        await assert.rejects(db.runtime.query(sql),{code:'42501'});
        await assert.rejects(db.owner.query(sql),{code:'55000'});
      }
      assert.equal((await db.runtime.query("SELECT has_table_privilege(current_user,'rate_versions','UPDATE') AS allowed")).rows[0].allowed,false);
    });
    await t.test('unsupported multi-part RFQ is rejected without silently dropping parts', async () => {
      const extraPart=randomUUID(),before=await count();
      await db.owner.query(`INSERT INTO rfq_parts(id,rfq_id,part_number,description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id)
        SELECT $1,rfq_id,'UNSUPPORTED-EXTRA',description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id FROM rfq_parts WHERE id=$2`,[extraPart,fixtureId(22)]);
      try {
        const response=await estimator.request(path,{method:'POST',key:randomUUID(),body:body()});
        assert.equal(response.status,422);assert.equal(response.data.error.code,'UNSUPPORTED_RFQ');
        assert.deepEqual(await count(),before);
      } finally {await db.owner.query('DELETE FROM rfq_parts WHERE id=$1',[extraPart]);}
    });
  } finally {
    app.locals.sessionStore.close(); await new Promise(resolve => server.close(resolve)); await db.close();
  }
});
