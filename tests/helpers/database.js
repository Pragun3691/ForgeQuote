import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import '../../apps/api/src/config.js';
import { migrate } from '../../apps/api/src/migrate.js';
import { seed } from '../../apps/api/src/seed.js';
import { seedUsers } from '../../apps/api/src/auth/seed-users.js';

// Isolated real database fixture shared by HTTP/browser tests. Never reset dev data.
export async function testDatabase({ seedBusiness = true, dedicatedDatabase = false } = {}) {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.match(target.pathname, /_test$/);
  const maintenance = new URL(process.env.MIGRATION_DATABASE_URL);
  assert.equal(maintenance.hostname, target.hostname);
  assert.equal(maintenance.port, target.port);
  maintenance.pathname = target.pathname;
  if (dedicatedDatabase) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(maintenance.hostname), 'Browser fixtures require local PostgreSQL');
  const suffix = randomUUID().replaceAll('-', '');
  const schema = `workflow_${suffix}`, role = `workflow_runtime_${suffix}`;
  const control = new pg.Pool({ connectionString: maintenance.href });
  const databaseName = dedicatedDatabase ? `forgequote_browser_${suffix}_test` : decodeURIComponent(target.pathname.slice(1));
  let admin = control;
  let owner, runtime;
  let databaseCreated = false, schemaCreated = false, roleCreated = false;
  const passwords = { DEMO_ESTIMATOR_PASSWORD: randomBytes(24).toString('hex'), DEMO_SALES_HEAD_PASSWORD: randomBytes(24).toString('hex') };
  const close = async () => {
    if (runtime) await runtime.end();
    if (owner) await owner.end();
    if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    if (roleCreated) await admin.query(`DROP ROLE ${role}`);
    await admin.end();
    if (admin !== control) {
      try { if (databaseCreated) await control.query(`DROP DATABASE ${pg.escapeIdentifier(databaseName)}`); }
      finally { await control.end(); }
    }
  };
  try {
    if (dedicatedDatabase) {
      await control.query(`CREATE DATABASE ${pg.escapeIdentifier(databaseName)}`);
      databaseCreated = true;
      maintenance.pathname = `/${databaseName}`;
      admin = new pg.Pool({ connectionString: maintenance.href });
      assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name, databaseName);
    }
    await admin.query(`CREATE SCHEMA ${schema}`);
    schemaCreated = true;
    await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    roleCreated = true;
    owner = new pg.Pool({ connectionString: maintenance.href, options: `-c search_path=${schema}`, max: 4 });
    await migrate(owner); assert.deepEqual(await migrate(owner), []);
    if (seedBusiness) await seed(owner);
    await seedUsers(owner, passwords);
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    const grants = (await readFile(new URL('../../apps/api/db/runtime-grants.sql', import.meta.url), 'utf8')).replaceAll('public.', `${schema}.`).replaceAll('forgequote_app', role);
    await owner.query(grants);
    const runtimeOptions = `-c search_path=${schema} -c role=${role}`;
    runtime = new pg.Pool({ connectionString: maintenance.href, options: runtimeOptions, max: 6 });
    return { owner, runtime, schema, role, passwords, databaseName, connectionString: maintenance.href, runtimeOptions, close };
  } catch (error) { await close(); throw error; }
}

// Browser callers cannot opt back into an existing database or development users.
export async function browserTestDatabase(options = {}) {
  return testDatabase({ ...options, dedicatedDatabase: true });
}
