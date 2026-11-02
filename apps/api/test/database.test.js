import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import '../src/config.js';
import { migrate } from '../src/migrate.js';
import { seed, fixtureId } from '../src/seed.js';
import { resolveRate } from '../src/rates.js';
import { transaction } from '../src/db.js';

test('real PostgreSQL migration, seed and history contract', async t => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'Set TEST_DATABASE_URL to a dedicated database ending in _test; no skipped database tests');
  assert.match(new URL(url).pathname, /_test$/, 'Refusing database tests outside a dedicated _test database');
  const admin = new pg.Pool({ connectionString: url });
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 3 });
    await t.test('fresh migration and repeat migration', async () => {
      assert.deepEqual(await migrate(pool), ['001_initial.sql']);
      assert.deepEqual(await migrate(pool), []);
    });
    await t.test('synthetic seed repeats without duplicates or money numbers', async () => {
      await seed(pool); await seed(pool);
      assert.equal((await pool.query('SELECT count(*) FROM rate_versions')).rows[0].count, '6');
      const part = (await pool.query('SELECT gross_weight_kg, requested_annual_qty FROM rfq_parts')).rows[0];
      assert.deepEqual(part, { gross_weight_kg: '0.610000', requested_annual_qty: '180000' });
      const route = (await pool.query('SELECT cycle_time_min,setup_hours_per_batch FROM routing_revisions')).rows[0];
      assert.deepEqual(route, { cycle_time_min: '3.200000', setup_hours_per_batch: '12.000000' });
    });
    await t.test('latest start wins, next start is exclusive, no applicable rate fails', async () => {
      await assert.rejects(resolveRate(pool, fixtureId(1), '2026-11-01'), { code: 'RATE_NOT_FOUND' });
      assert.equal((await resolveRate(pool, fixtureId(1), '2026-11-02')).value, '100.000000');
      await pool.query("INSERT INTO rate_versions VALUES ($1,$2,'2026-12-01','110')", [randomUUID(), fixtureId(1)]);
      assert.equal((await resolveRate(pool, fixtureId(1), '2026-11-30')).value, '100.000000');
      assert.equal((await resolveRate(pool, fixtureId(1), '2026-12-01')).value, '110.000000');
      assert.equal((await resolveRate(pool, fixtureId(1), '2030-01-01')).value, '110.000000');
      const period = (await pool.query('SELECT effective_to::text FROM rate_periods WHERE id=$1', [fixtureId(11)])).rows[0];
      assert.equal(period.effective_to, '2026-12-01');
      assert.equal((await pool.query('SELECT value FROM rate_versions WHERE id=$1', [fixtureId(11)])).rows[0].value, '100.000000');
      await assert.rejects(resolveRate(pool, randomUUID(), '2026-11-02'), { code: 'RATE_NOT_FOUND' });
    });
    await t.test('duplicate effective starts and concurrent duplicates are rejected', async () => {
      const insert = () => pool.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2027-01-01','120')", [randomUUID(), fixtureId(1)]);
      const results = await Promise.allSettled([insert(), insert()]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.find(result => result.status === 'rejected').reason.code, '23505');
    });
    await t.test('history UPDATE DELETE and TRUNCATE fail', async () => {
      for (const table of ['rate_versions', 'routing_revisions']) {
        for (const sql of [`UPDATE ${table} SET id=id`, `DELETE FROM ${table}`, `TRUNCATE ${table}`]) {
          await assert.rejects(pool.query(sql), { code: '55000' });
        }
      }
    });
    await t.test('new routing revision appends without changing original', async () => {
      await pool.query("INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) VALUES ($1,$2,2,$3,'3.1','11')", [randomUUID(), fixtureId(22), fixtureId(2)]);
      const original = (await pool.query('SELECT cycle_time_min,setup_hours_per_batch FROM routing_revisions WHERE id=$1', [fixtureId(23)])).rows[0];
      assert.deepEqual(original, { cycle_time_min: '3.200000', setup_hours_per_batch: '12.000000' });
    });
    await t.test('negative and non-finite rates, wrong units, bad quantities and foreign keys fail', async () => {
      for (const value of ['-1', 'NaN', 'Infinity']) {
        await assert.rejects(pool.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2028-01-01',$3)", [randomUUID(), fixtureId(1), value]));
      }
      await assert.rejects(pool.query("INSERT INTO rate_keys VALUES ($1,'BAD','machine','INR/kg')", [randomUUID()]), { code: '23514' });
      await assert.rejects(pool.query("UPDATE rfq_parts SET material_rate_key_id=$1", [fixtureId(2)]), { code: '23503' });
      for (const qty of ['0', '1000000001']) await assert.rejects(pool.query('UPDATE rfq_parts SET requested_annual_qty=$1', [qty]), { code: '23514' });
    });
    await t.test('failed transaction rolls back all inserts', async () => {
      const id = randomUUID();
      await assert.rejects(transaction(pool, async client => {
        await client.query("INSERT INTO rate_keys VALUES ($1,'ROLLBACK','material','INR/kg')", [id]);
        throw Error('deliberate failure');
      }), /deliberate failure/);
      assert.equal((await pool.query('SELECT id FROM rate_keys WHERE id=$1', [id])).rowCount, 0);
    });
    await t.test('seed detects drift without overwriting existing facts', async () => {
      await pool.query("UPDATE rfq_parts SET gross_weight_kg='0.62'");
      await assert.rejects(seed(pool), /fixture mismatch/);
      assert.equal((await pool.query('SELECT gross_weight_kg FROM rfq_parts')).rows[0].gross_weight_kg, '0.620000');
    });
  } finally {
    if (pool) await pool.end();
    // schema is generated above, never user supplied; no other schema is removed.
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
