import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import '../src/config.js';
import { migrate } from '../src/migrate.js';
import { seed, fixtureId } from '../src/seed.js';
import { createQuotationService, reproduceDraftVersion } from '../src/quotations.js';
import { goldenCases } from './fixtures/golden-v02.js';

test('real PostgreSQL quotation snapshot contract with restricted runtime role', async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /_test$/);
  // Maintenance credentials, same explicitly configured test target; never dev data.
  const maintenance = new URL(process.env.MIGRATION_DATABASE_URL);
  assert.equal(maintenance.hostname, url.hostname);
  assert.equal(maintenance.port, url.port);
  maintenance.pathname = url.pathname;
  const admin = new pg.Pool({ connectionString: maintenance.href });
  const suffix = randomUUID().replaceAll('-', '');
  const schema = `quote_${suffix}`, role = `quote_runtime_${suffix}`;
  let owner, runtime;
  const estimator = randomUUID(), sales = randomUUID();
  let saved;
  const request = () => ({ rfqId: fixtureId(21), pricingDate: '2026-11-10', parts: [{ partId: fixtureId(22), routingRevisionId: fixtureId(23), marginPercent: '20' }] });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    owner = new pg.Pool({ connectionString: maintenance.href, options: `-c search_path=${schema}` });
    runtime = new pg.Pool({ connectionString: maintenance.href, options: `-c search_path=${schema} -c role=${role}`, max: 4 });
    await t.test('migration 003 and repeat migration; apply exact maintenance grants', async () => {
      assert.deepEqual(await migrate(owner), ['001_initial.sql', '002_authentication.sql', '003_quotation_snapshots.sql', '004_draft_submissions.sql', '005_rfq_intake.sql','006_quotation_events.sql']);
      assert.deepEqual(await migrate(owner), []);
      await seed(owner);
      await owner.query("INSERT INTO users(id,username,password_hash,role) VALUES ($1,'estimator','scrypt$test-only','estimator'),($2,'sales_head','scrypt$test-only','sales_head')", [estimator, sales]);
      await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
      const grants = (await readFile(new URL('../db/runtime-grants.sql', import.meta.url), 'utf8')).replaceAll('public.', `${schema}.`).replaceAll('forgequote_app', role);
      await owner.query(grants); await owner.query(grants);
      assert.equal((await runtime.query('SELECT current_user')).rows[0].current_user, role);
    });
    const service = createQuotationService(runtime, { gstPercent: '18' });
    const load = async receipt => service.getDraftVersion(estimator, receipt.versionId);
    const counts = async () => (await owner.query(`SELECT
      (SELECT count(*) FROM quotations) AS headers,
      (SELECT count(*) FROM quotation_versions) AS versions,
      (SELECT count(*) FROM quotation_parts) AS parts,
      (SELECT count(*) FROM quotation_rates) AS rates,
      (SELECT count(*) FROM quotation_part_tiers) AS tiers,
      (SELECT count(*) FROM quotation_totals) AS totals,
      (SELECT max(next_version) FROM quotations) AS counter`)).rows[0];
    await t.test('complete snapshot round-trips externally specified spindle golden values', async () => {
      saved = await load(await service.createDraftVersion(estimator, request()));
      assert.equal(saved.versionNumber, '1');
      assert.equal(saved.formulaVersion, 'forgequote-costing-v0.2');
      assert.equal(saved.createdBy, estimator);
      assert.equal(saved.rfq.reference, 'RFQ-2611-014');
      assert.equal(saved.gstPercent, '18.000000');
      assert.equal(saved.annualValueExGst, '26946000.00');
      assert.equal(saved.parts[0].routingRevisionId, fixtureId(23));
      assert.equal(saved.parts[0].input.setupHoursPerBatch, '12.000000');
      assert.equal(saved.parts[0].rates.materialInrPerKg.rateVersionId, fixtureId(11));
      assert.equal(saved.parts[0].rates.materialInrPerKg.value, '100.000000');
      for (const [i, expected] of goldenCases[0].expected.entries()) {
        const tier = saved.parts[0].result.tiers[i];
        assert.equal(tier.annualQty, expected.annualQty);
        assert.equal(tier.lines.setup, expected.setup);
        assert.equal(tier.costPerUnit, expected.cost);
        assert.equal(tier.sellingPricePerUnitExGst, expected.price);
      }
      assert.deepEqual(saved.parts[0].result.tiers[1].lines, goldenCases[0].baseline);
      assert.deepEqual(saved.totals[1], { scenario: '100', taxableSubtotal: '26946000.00', gstAmount: '4850280.00', totalWithGst: '31796280.00' });
      assert.deepEqual(await counts(), { headers: '1', versions: '1', parts: '1', rates: '6', tiers: '3', totals: '3', counter: '2' });
      assert.deepEqual(reproduceDraftVersion(saved).parts, saved.parts.map(part => part.result));
      assert.deepEqual(reproduceDraftVersion(saved).totals.map(({ formulaVersion, currency, gstPercent, ...total }) => total), saved.totals);
      assert.throws(() => reproduceDraftVersion({ ...saved, formulaVersion: 'unknown' }), { code: 'UNSUPPORTED_FORMULA_VERSION' });
    });
    await t.test('anonymous, unknown, inactive and sales-head actors cannot create; browser GST rejected', async () => {
      const before = await counts();
      for (const actor of [null, randomUUID(), sales]) await assert.rejects(service.createDraftVersion(actor, request()), error => ['AUTH_REQUIRED', 'ROLE_FORBIDDEN'].includes(error.code));
      await owner.query('UPDATE users SET active=false WHERE id=$1', [estimator]);
      try { await assert.rejects(service.createDraftVersion(estimator, request()), { code: 'AUTH_REQUIRED' }); }
      finally { await owner.query('UPDATE users SET active=true WHERE id=$1', [estimator]); }
      await assert.rejects(service.createDraftVersion(estimator, { ...request(), gstPercent: '0' }), { code: 'INVALID_QUOTATION_INPUT' });
      await assert.rejects(service.createDraftVersion(estimator, { ...request(), pricingDate: null }), { code: 'INVALID_QUOTATION_INPUT' });
      const invalidQty = request(); invalidQty.parts[0].requestedAnnualQty = null;
      await assert.rejects(service.createDraftVersion(estimator, invalidQty), { code: 'INVALID_COSTING_INPUT' });
      const invalidRoute = request(); invalidRoute.parts[0].routingRevisionId = randomUUID();
      await assert.rejects(service.createDraftVersion(estimator, invalidRoute), { code: 'ROUTING_NOT_FOUND' });
      await assert.rejects(service.getDraftVersion(null, saved.versionId), { code: 'AUTH_REQUIRED' });
      assert.equal((await service.getDraftVersion(sales, saved.versionId)).versionId, saved.versionId);
      assert.deepEqual(await counts(), before);
    });
    await t.test('invalid calculation and missing rate roll back header allocation and every child', async () => {
      const before = await counts();
      const invalid = request(); invalid.parts[0].marginPercent = '100';
      await assert.rejects(service.createDraftVersion(estimator, invalid), { code: 'INVALID_COSTING_INPUT' });
      await assert.rejects(service.createDraftVersion(estimator, { ...request(), pricingDate: '2026-11-01' }), { code: 'RATE_NOT_FOUND' });
      assert.deepEqual(await counts(), before);
      // Force a failure after version/parts/rates/tiers have actually been written.
      await owner.query("CREATE FUNCTION fail_totals() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected storage failure'; END; $$; CREATE TRIGGER fail_totals BEFORE INSERT ON quotation_totals FOR EACH ROW EXECUTE FUNCTION fail_totals()");
      try { await assert.rejects(service.createDraftVersion(estimator, request()), /injected storage failure/); }
      finally { await owner.query('DROP TRIGGER fail_totals ON quotation_totals; DROP FUNCTION fail_totals()'); }
      assert.deepEqual(await counts(), before);
    });
    await t.test('two concurrent creates allocate distinct consecutive versions with no lost writes', async () => {
      const receipts = await Promise.all([service.createDraftVersion(estimator, request()), service.createDraftVersion(estimator, request())]);
      const snapshots = await Promise.all(receipts.map(load));
      assert.deepEqual(snapshots.map(snapshot => snapshot.versionNumber).sort(), ['2', '3']);
      assert.notEqual(receipts[0].versionId, receipts[1].versionId);
      assert.equal(snapshots[0].quotationId, snapshots[1].quotationId);
      assert.deepEqual(await counts(), { headers: '1', versions: '3', parts: '3', rates: '18', tiers: '9', totals: '9', counter: '4' });
      t.diagnostic('Concurrent requests persisted versions 2 and 3; next_version=4; all child counts intact.');
    });
    await t.test('first-draft failure leaves no header; concurrent first drafts create one header', async () => {
      const rfqId = randomUUID(), partId = randomUUID(), routingRevisionId = randomUUID();
      await owner.query("INSERT INTO rfqs(id,reference,customer_name,due_date,owner_label) VALUES ($1,'CONCURRENT-FIRST','Synthetic concurrency customer','2026-11-06','Demo')", [rfqId]);
      await owner.query(`INSERT INTO rfq_parts(id,rfq_id,part_number,description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id)
        SELECT $1,$2,part_number,description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id FROM rfq_parts WHERE id=$3`, [partId, rfqId, fixtureId(22)]);
      await owner.query('INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) SELECT $1,$2,1,machine_rate_key_id,cycle_time_min,setup_hours_per_batch FROM routing_revisions WHERE id=$3', [routingRevisionId, partId, fixtureId(23)]);
      const first = { ...request(), rfqId, parts: [{ partId, routingRevisionId, marginPercent: '100' }] };
      await assert.rejects(service.createDraftVersion(estimator, first), { code: 'INVALID_COSTING_INPUT' });
      assert.equal((await owner.query('SELECT id FROM quotations WHERE rfq_id=$1', [rfqId])).rowCount, 0);
      first.parts[0].marginPercent = '20';
      const receipts = await Promise.all([service.createDraftVersion(estimator, first), service.createDraftVersion(estimator, first)]);
      const versions = await Promise.all(receipts.map(load));
      assert.deepEqual(versions.map(version => version.versionNumber).sort(), ['1','2']);
      assert.equal(versions[0].quotationId, versions[1].quotationId);
      assert.equal((await owner.query('SELECT next_version FROM quotations WHERE rfq_id=$1', [rfqId])).rows[0].next_version, '3');
      t.diagnostic('Concurrent first drafts persisted versions 1 and 2 under one header; next_version=3.');
    });
    await t.test('multi-part quotation persists all nine unchanged goldens and aggregates baseline totals', async () => {
      const rfqId = randomUUID(), parts = [];
      await owner.query("INSERT INTO rfqs(id,reference,customer_name,due_date,owner_label) VALUES ($1,'NINE-GOLDENS','Synthetic multi-part customer','2026-11-06','Demo')", [rfqId]);
      const names = ['materialInrPerKg','machineInrPerHour','scrapPercent','overheadPercent','packagingInrPerPiece','freightInrPerPiece'];
      const categories = ['material','machine','scrap','overhead','packaging','freight'];
      const units = ['INR/kg','INR/hour','percent','percent','INR/piece','INR/piece'];
      for (const [index, golden] of goldenCases.entries()) {
        const keys = names.map(() => randomUUID()), partId = randomUUID(), routingRevisionId = randomUUID();
        for (const [i, field] of names.entries()) {
          await owner.query('INSERT INTO rate_keys(id,code,category,unit) VALUES ($1,$2,$3,$4)', [keys[i], `GOLDEN-${index}-${field}`, categories[i], units[i]]);
          await owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-02',$3)", [randomUUID(), keys[i], golden.input.rates[field]]);
        }
        await owner.query(`INSERT INTO rfq_parts(id,rfq_id,part_number,description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id)
          VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10)`, [partId, rfqId, golden.name, golden.input.grossWeightKg, golden.input.requestedAnnualQty, keys[0], ...keys.slice(2)]);
        await owner.query('INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) VALUES ($1,$2,1,$3,$4,$5)', [routingRevisionId, partId, keys[1], golden.input.cycleTimeMin, golden.input.setupHoursPerBatch]);
        parts.push({ partId, routingRevisionId, marginPercent: golden.input.marginPercent });
      }
      const snapshot = await load(await service.createDraftVersion(estimator, { rfqId, pricingDate: '2026-11-02', parts }));
      for (const golden of goldenCases) {
        const part = snapshot.parts.find(part => part.part.part_number === golden.name);
        for (const [i, expected] of golden.expected.entries()) {
          const tier = part.result.tiers[i];
          assert.equal(tier.annualQty, expected.annualQty);
          assert.equal(tier.lines.setup, expected.setup);
          assert.equal(tier.costPerUnit, expected.cost);
          assert.equal(tier.sellingPricePerUnitExGst, expected.price);
        }
        assert.deepEqual(part.result.tiers[1].lines, golden.baseline);
        assert.equal(part.result.annualValueExGst, golden.annualValue);
      }
      assert.deepEqual(snapshot.totals[1], { scenario: '100', taxableSubtotal: '82650240.00', gstAmount: '14877043.20', totalWithGst: '97527283.20' });
      assert.deepEqual(reproduceDraftVersion(snapshot).parts, snapshot.parts.map(part => part.result));
    });
    await t.test('snapshot survives backdated rates, new routing, changed RFQ/part and configured GST', async () => {
      await owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-03','200')", [randomUUID(), fixtureId(1)]);
      await owner.query("INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) VALUES ($1,$2,2,$3,'100','100')", [randomUUID(), fixtureId(22), fixtureId(2)]);
      await owner.query("UPDATE rfqs SET customer_name='Changed synthetic customer' WHERE id=$1", [fixtureId(21)]);
      await owner.query("UPDATE rfq_parts SET gross_weight_kg='2',description='Changed synthetic description',requested_annual_qty=100 WHERE id=$1", [fixtureId(22)]);
      const differentConfig = createQuotationService(runtime, { gstPercent: '5.5' });
      assert.deepEqual(await differentConfig.getDraftVersion(estimator, saved.versionId), saved);
      assert.deepEqual(reproduceDraftVersion(saved).parts, saved.parts.map(part => part.result));
      const changed = await load(await differentConfig.createDraftVersion(estimator, { ...request(), pricingDate: '2026-11-03' }));
      assert.equal(changed.parts[0].rates.materialInrPerKg.value, '200.000000');
      assert.equal(changed.gstPercent, '5.500000');
      assert.notEqual(changed.annualValueExGst, saved.annualValueExGst);
      assert.deepEqual(await load({ versionId: saved.versionId }), saved);
    });
    await t.test('large valid engine inputs retain exact paise and decimal strings', async () => {
      // Hand-computed: 999999999999^2 = 999999999998000000000001;
      // at 99.999999% margin divide by 0.00000001 (multiply by 100000000).
      await owner.query("UPDATE rfq_parts SET gross_weight_kg='999999999999' WHERE id=$1", [fixtureId(22)]);
      for (const key of [1, 2, 3, 4, 5, 6]) await owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-04',$3)", [randomUUID(), fixtureId(key), key === 1 ? '999999999999' : '0']);
      const large = request(); large.pricingDate = '2026-11-04'; large.parts[0] = { ...large.parts[0], marginPercent: '99.999999', requestedAnnualQty: '1000000000', tierQuantities: { '50': '1', '100': '1000000000', '150': '1000000000' } };
      const result = await load(await service.createDraftVersion(estimator, large));
      assert.equal(result.parts[0].result.tiers[1].sellingPricePerUnitExGst, '99999999999800000000000100000000.00');
      assert.equal(result.annualValueExGst, '99999999999800000000000100000000000000000.00');
      assert.deepEqual(reproduceDraftVersion(result).parts, result.parts.map(part => part.result));
      await assert.rejects(owner.query("INSERT INTO quotation_totals VALUES ($1,'100','0.001','0','0.001')", [saved.versionId]));
    });
    await t.test('runtime ACLs and database guards prohibit history mutation and late append', async () => {
      const tables = ['quotation_versions','quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals'];
      for (const table of tables) {
        for (const sql of [`UPDATE ${table} SET version_id=version_id`, `DELETE FROM ${table}`, `TRUNCATE ${table}`]) {
          // UPDATE column differs on versions; permission checks below cover all columns.
          if (sql.startsWith('UPDATE quotation_versions ')) continue;
          await assert.rejects(runtime.query(sql));
        }
        const acl = (await runtime.query("SELECT has_table_privilege(current_user,$1,'UPDATE') AS upd,has_table_privilege(current_user,$1,'DELETE') AS del,has_table_privilege(current_user,$1,'TRUNCATE') AS trunc", [table])).rows[0];
        assert.deepEqual(acl, { upd: false, del: false, trunc: false });
        for (const sql of [`UPDATE ${table} SET ${table === 'quotation_versions' ? 'id=id' : 'version_id=version_id'}`, `DELETE FROM ${table}`, `TRUNCATE ${table} CASCADE`]) await assert.rejects(owner.query(sql), { code: '55000' });
      }
      await assert.rejects(runtime.query("UPDATE quotations SET rfq_id=rfq_id"), { code: '42501' });
      await assert.rejects(runtime.query('DELETE FROM quotations'), { code: '42501' });
      await assert.rejects(owner.query('UPDATE quotations SET next_version=1'), { code: '55000' });
      await assert.rejects(runtime.query("INSERT INTO quotation_totals VALUES ($1,'50','0.00','0.00','0.00')", [saved.versionId]), { code: '55000' });
      await assert.rejects(runtime.query("INSERT INTO quotation_versions(id,creation_xid) VALUES ($1,pg_current_xact_id())", [randomUUID()]), { code: '42501' });
      for (const table of ['rate_versions','routing_revisions','rfqs','rfq_parts','users']) {
        const acl = (await runtime.query("SELECT has_table_privilege(current_user,$1,'INSERT') AS ins,has_table_privilege(current_user,$1,'UPDATE') AS upd,has_table_privilege(current_user,$1,'DELETE') AS del", [table])).rows[0];
        assert.deepEqual(acl, { ins: false, upd: false, del: false });
      }
    });
    await t.test('uncertain COMMIT is surfaced once without automatic retry', async () => {
      const before = (await owner.query('SELECT count(*) FROM quotation_versions')).rows[0].count;
      let commits = 0;
      const uncertainPool = {
        async connect() {
          const client = await runtime.connect();
          return {
            async query(sql, values) {
              const result = await client.query(sql, values);
              if (sql === 'COMMIT') { commits++; throw Error('simulated lost COMMIT acknowledgement'); }
              return result;
            },
            release() { client.release(); }
          };
        }
      };
      const uncertain = createQuotationService(uncertainPool, { gstPercent: '18' });
      await assert.rejects(uncertain.createDraftVersion(estimator, request()), /lost COMMIT acknowledgement/);
      assert.equal(commits, 1);
      assert.equal(Number((await owner.query('SELECT count(*) FROM quotation_versions')).rows[0].count), Number(before) + 1);
    });
  } finally {
    if (runtime) await runtime.end();
    if (owner) await owner.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`DROP ROLE IF EXISTS ${role}`);
    await admin.end();
  }
});
