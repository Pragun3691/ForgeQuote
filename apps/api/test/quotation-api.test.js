import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { testDatabase } from '../../../tests/helpers/database.js';
import { createApp } from '../src/app.js';
import { fixtureId } from '../src/seed.js';
import { createSubmissionService } from '../src/draft-submissions.js';
import { multipartRfq, multipartTotals } from '../../../tests/helpers/multipart-rfq.js';
import { goldenCases } from './fixtures/golden-v02.js';

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
      // Frozen pre-T03 fingerprint of this legacy request, not derived from new code.
      assert.equal((await db.owner.query('SELECT request_fingerprint FROM draft_submissions WHERE version_id=$1',[versionId])).rows[0].request_fingerprint,'a847dc282987d7fb019d3a26f44c8ae4590a58e43a3624fd07b384bcc2fbd936');
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
      const {pricingDate,...part}=body();
      assert.deepEqual((await estimator.request(path,{method:'POST',key,body:{pricingDate,parts:[part]}})).data,{versionId,replayed:true});
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
    await t.test('incomplete RFQ coverage is rejected without silently dropping parts', async () => {
      const extraPart=randomUUID(),before=await count();
      await db.owner.query(`INSERT INTO rfq_parts(id,rfq_id,part_number,description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id)
        SELECT $1,rfq_id,'UNSUPPORTED-EXTRA',description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id FROM rfq_parts WHERE id=$2`,[extraPart,fixtureId(22)]);
      try {
        const response=await estimator.request(path,{method:'POST',key:randomUUID(),body:body()});
        assert.equal(response.status,400);assert.equal(response.data.error.code,'INVALID_QUOTATION_INPUT');
        assert.deepEqual(await count(),before);
      } finally {await db.owner.query('DELETE FROM rfq_parts WHERE id=$1',[extraPart]);}
    });
    await t.test('per-estimator write limiter blocks retries without creating records or replacing the key',async()=>{
      const limitedApp=createApp(db.runtime,config,{sessionSchema:db.schema,quoteLimit:1,quoteWindowMs:60000});
      const limitedServer=limitedApp.listen(0,'127.0.0.1');await once(limitedServer,'listening');
      const limitedBase=`http://127.0.0.1:${limitedServer.address().port}`,retryKey=randomUUID();
      const send=async csrf=>fetch(limitedBase+path,{method:'POST',headers:{Cookie:estimator.cookie,Origin:config.appOrigin,
        'X-CSRF-Token':csrf,'Content-Type':'application/json','Idempotency-Key':retryKey},body:JSON.stringify(body())});
      try {
        assert.equal((await send('wrong')).status,403); // CSRF denial does not consume allowance.
        assert.equal((await send(estimator.token)).status,201);
        const before=await count(),blocked=await send(estimator.token);
        assert.equal(blocked.status,429);assert.ok(blocked.headers.get('retry-after'));
        assert.equal((await blocked.json()).error.code,'QUOTE_RATE_LIMIT');
        assert.deepEqual(await count(),before);
        // Another process-local limiter accepts the same key as replay, not a
        // new version: no idempotency state is discarded when throttled.
        const recovered=await estimator.request(path,{method:'POST',key:retryKey,body:body()});
        assert.equal(recovered.status,200);assert.equal(recovered.data.replayed,true);
        assert.deepEqual(await count(),before);
      } finally {limitedApp.locals.sessionStore.close();await new Promise(resolve=>limitedServer.close(resolve));}
    });
  } finally {
    app.locals.sessionStore.close(); await new Promise(resolve => server.close(resolve)); await db.close();
  }
});

test('complete multipart quotation HTTP, persistence and recovery',async t=>{
  const db=await testDatabase();
  const config={nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:5173',trustProxyHops:0};
  const app=createApp(db.runtime,config,{sessionSchema:db.schema,quoteLimit:200});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  function client(){return {cookie:'',token:'',async request(path,{method='GET',body,key,headers={}}={}){
    const response=await fetch(base+path,{method,headers:{Cookie:this.cookie,...(method==='POST'?{Origin:config.appOrigin,'X-CSRF-Token':this.token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    for(const cookie of response.headers.getSetCookie())this.cookie=cookie.split(';')[0];const data=await response.json();if(data.csrfToken)this.token=data.csrfToken;return {status:response.status,data};
  },async login(username,password){await this.request('/api/auth/session');assert.equal((await this.request('/api/auth/login',{method:'POST',body:{username,password}})).status,200);}};}
  const estimator=client(),sales=client(),anonymous=client();
  const counts=async()=> (await db.owner.query(`SELECT (SELECT count(*) FROM quotations) headers,(SELECT count(*) FROM quotation_versions) versions,
    (SELECT count(*) FROM quotation_parts) parts,(SELECT count(*) FROM quotation_rates) rates,(SELECT count(*) FROM quotation_part_tiers) tiers,
    (SELECT count(*) FROM quotation_totals) totals,(SELECT count(*) FROM draft_submissions) receipts,(SELECT coalesce(sum(next_version),0)::text FROM quotations) counter`)).rows[0];
  try{
    await estimator.login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);await sales.login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
    const two=await multipartRfq(db.owner,2),three=await multipartRfq(db.owner,3);
    const post=(fixture,body=fixture.body,key=randomUUID(),headers={})=>estimator.request(`/api/rfqs/${fixture.rfqId}/quote-versions`,{method:'POST',body,key,headers});
    await t.test('exact coverage, bounds, cross-part routing, rates and financial failures leave no partial version',async()=>{
      const before=await counts();
      const invalid=[{...two.body,parts:[]},{...two.body,parts:two.body.parts.slice(1)},
        {...two.body,parts:[two.body.parts[0],two.body.parts[0]]},
        {...two.body,parts:[two.body.parts[0],three.body.parts[1]]},
        {...two.body,parts:[two.body.parts[0],{...two.body.parts[1],partId:randomUUID()}]},
        {...two.body,parts:Array(21).fill(two.body.parts[0])},
        {...two.body,parts:two.body.parts.map((part,i)=>i?{...part,marginPercent:'100'}:part)},
        {...two.body,parts:two.body.parts.map((part,i)=>i?{...part,tierQuantities:{...part.tierQuantities,'50':'0'}}:part)}];
      for(const request of invalid) assert.equal((await post(two,request)).status,400);
      assert.equal((await post(two,{...two.body,parts:two.body.parts.map((part,i)=>i?{...part,routingRevisionId:two.body.parts[0].routingRevisionId}:part)})).status,404);
      assert.equal((await post(two,{...two.body,pricingDate:'2026-11-01'})).status,422);
      // A rate missing on just one part must roll back the whole quote/counter.
      const late=await multipartRfq(db.owner,2),latePart=late.body.parts[1];
      await db.owner.query("INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) SELECT $1,part_id,2,machine_rate_key_id,'1','1' FROM routing_revisions WHERE id=$2",[randomUUID(),latePart.routingRevisionId]);
      const missing=await db.owner.query("INSERT INTO rate_keys(id,code,category,unit) VALUES($1,$2,'machine','INR/hour') RETURNING id",[randomUUID(),'T03-MISSING-'+randomUUID()]);
      const route=randomUUID();await db.owner.query("INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) VALUES($1,$2,3,$3,'1','1')",[route,latePart.partId,missing.rows[0].id]);
      assert.equal((await post(late,{...late.body,parts:late.body.parts.map(part=>part.partId===latePart.partId?{...part,routingRevisionId:route}:part)})).status,422);
      assert.deepEqual(await counts(),before);
    });
    const saved=[];
    for(const fixture of [two,three])await t.test(`${fixture.body.parts.length} parts persist all scenarios, exact golden prices and combined totals`,async()=>{
      const n=fixture.body.parts.length,key=randomUUID();
      const created=await post(fixture,{...fixture.body,parts:[...fixture.body.parts].reverse()},key);assert.equal(created.status,201);
      const snapshot=(await estimator.request('/api/quote-versions/'+created.data.versionId)).data;
      assert.equal(snapshot.parts.length,n);assert.equal(snapshot.annualValueExGst,multipartTotals[n][1][0]);
      assert.deepEqual(snapshot.totals.map(total=>[total.taxableSubtotal,total.gstAmount,total.totalWithGst]),multipartTotals[n]);
      for(const [i,input] of fixture.body.parts.entries()){
        const part=snapshot.parts.find(part=>part.partId===input.partId);assert.ok(part);assert.equal(part.routingRevisionId,input.routingRevisionId);
        assert.deepEqual(part.result.tiers.map(tier=>[tier.costPerUnit,tier.sellingPricePerUnitExGst]),goldenCases[i].expected.map(tier=>[tier.cost,tier.price]));
        assert.equal(Object.keys(part.rates).length,6);
      }
      const rows=(await db.owner.query('SELECT (SELECT count(*) FROM quotation_parts WHERE version_id=$1) parts,(SELECT count(*) FROM quotation_part_tiers WHERE version_id=$1) tiers,(SELECT count(*) FROM quotation_rates WHERE version_id=$1) rates',[snapshot.versionId])).rows[0];
      assert.deepEqual(rows,{parts:String(n),tiers:String(n*3),rates:String(n*6)});
      const before=await counts(),replay=await post(fixture,fixture.body,key);assert.equal(replay.status,200);assert.equal(replay.data.versionId,snapshot.versionId);
      const changed=structuredClone(fixture.body);changed.parts[1].marginPercent='19';assert.equal((await post(fixture,changed,key)).status,409);assert.deepEqual(await counts(),before);
      assert.equal((await sales.request('/api/quote-versions/'+snapshot.versionId)).status,200);saved.push({fixture,snapshot,key});
    });
    await t.test('multipart authorization and CSRF/Origin remain server-side',async()=>{
      const path=`/api/rfqs/${two.rfqId}/quote-versions`,before=await counts();
      assert.equal((await anonymous.request(path,{method:'POST',body:two.body,key:randomUUID()})).status,401);
      assert.equal((await sales.request(path,{method:'POST',body:two.body,key:randomUUID()})).status,403);
      assert.equal((await post(two,two.body,randomUUID(),{'X-CSRF-Token':'wrong'})).status,403);
      assert.equal((await post(two,two.body,randomUUID(),{Origin:'http://untrusted.invalid'})).status,403);assert.deepEqual(await counts(),before);
    });
    await t.test('concurrent reordered retries save exactly one complete three-part version',async()=>{
      const key=randomUUID(),before=await counts();const results=await Promise.all(Array.from({length:6},(_,i)=>post(three,{...three.body,parts:i%2?[...three.body.parts].reverse():three.body.parts},key)));
      assert.deepEqual(results.map(result=>result.status).sort(),[200,200,200,200,200,201]);assert.equal(new Set(results.map(result=>result.data.versionId)).size,1);
      const after=await counts();assert.equal(BigInt(after.versions)-BigInt(before.versions),1n);assert.equal(BigInt(after.parts)-BigInt(before.parts),3n);assert.equal(BigInt(after.receipts)-BigInt(before.receipts),1n);
    });
    await t.test('later-part storage failure and receipt failure roll back all parts and counter',async()=>{
      for(const [table,condition] of [['quotation_parts',"NEW.part_snapshot->>'part_number'='T03-2-lift arm'"],['draft_submissions','true']]){
        const before=await counts(),key=randomUUID();
        await db.owner.query(`CREATE FUNCTION fail_multipart() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'private multipart failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fail_multipart BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_multipart()`);
        try{const failed=await post(three,three.body,key);assert.equal(failed.status,503);assert.ok(!JSON.stringify(failed.data).includes('private multipart failure'));assert.deepEqual(await counts(),before);}
        finally{await db.owner.query(`DROP TRIGGER fail_multipart ON ${table}; DROP FUNCTION fail_multipart()`);}
        assert.equal((await post(three,three.body,key)).status,201);assert.equal((await post(three,three.body,key)).status,200);
      }
    });
    await t.test('lost COMMIT acknowledgement replays one complete version',async()=>{
      const actor=(await db.owner.query("SELECT id FROM users WHERE username='estimator'")).rows[0].id,key=randomUUID();
      const uncertain={async connect(){const c=await db.runtime.connect();return {async query(sql,values){const result=await c.query(sql,values);if(sql==='COMMIT')throw Error('lost multipart acknowledgement');return result;},release(){c.release();}};}};
      await assert.rejects(createSubmissionService(uncertain,config)(actor,three.rfqId,key,three.body),/lost multipart acknowledgement/);
      const before=await counts();assert.equal((await post(three,three.body,key)).status,200);assert.deepEqual(await counts(),before);
    });
    await t.test('saved multipart versions survive changed masters and remain immutable',async()=>{
      const {fixture,snapshot,key}=saved[1];await db.owner.query("UPDATE rfq_parts SET description='Changed current fact' WHERE id=$1",[fixture.body.parts[1].partId]);
      assert.deepEqual((await estimator.request('/api/quote-versions/'+snapshot.versionId)).data,snapshot);
      assert.equal((await post(fixture,fixture.body,key)).data.versionId,snapshot.versionId);
      for(const table of ['quotation_versions','quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals'])await assert.rejects(db.owner.query(`DELETE FROM ${table} WHERE version_id=$1`.replace('quotation_versions WHERE version_id','quotation_versions WHERE id'),[snapshot.versionId]),{code:'55000'});
    });
    await t.test('20-part body above 4 KiB works; 64 KiB and unrelated 4 KiB limits remain bounded',async()=>{
      const max=await multipartRfq(db.owner,20);
      for(const part of max.body.parts){part.marginPercent='20.000000';part.tierQuantities={'50':'1000000000','100':'1000000000','150':'1000000000'};}
      assert.ok(JSON.stringify(max.body).length>4096);assert.equal((await post(max)).status,201);
      assert.equal((await post(two,{...two.body,padding:'x'.repeat(65536)})).status,413);
      assert.equal((await estimator.request('/api/auth/logout',{method:'POST',body:{padding:'x'.repeat(5000)}})).status,413);
    });
  }finally{app.locals.sessionStore.close();await new Promise(resolve=>server.close(resolve));await db.close();}
});
