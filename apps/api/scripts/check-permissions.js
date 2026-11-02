import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';

const pool = createPool(readConfig().databaseUrl);
try {
  const checks = await pool.query(`
    SELECT tablename, tableowner,
      has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT') AS sel,
      has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename),'INSERT') AS ins,
      has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename),'UPDATE') AS upd,
      has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename),'DELETE') AS del,
      has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename),'TRUNCATE') AS trunc
    FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  const appendTables = ['quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals'];
  const names = ['rate_keys','rate_versions','rfq_parts','rfqs','routing_revisions','schema_migrations','sessions','users', 'quotations','quotation_versions','draft_submissions', ...appendTables];
  for (const name of names) {
    const row = checks.rows.find(row => row.tablename === name);
    assert.ok(row, `Required table missing: ${name}`);
    assert.equal(row.sel, true, `${name}: SELECT required`);
    for (const privilege of ['ins','upd','del']) assert.equal(row[privilege], name === 'sessions' || (privilege === 'ins' && appendTables.includes(name)), `${name}: unexpected ${privilege} permission`);
    assert.equal(row.trunc, false, `${name}: runtime TRUNCATE forbidden`);
  }
  const columns = (await pool.query(`SELECT table_name,column_name,privilege_type FROM information_schema.column_privileges
    WHERE grantee=current_user AND table_schema='public' AND table_name IN ('quotations','quotation_versions','draft_submissions')
      AND privilege_type IN ('INSERT','UPDATE')`)).rows;
  const versionInsert = ['id','quotation_id','version_number','pricing_date','formula_version','currency','gst_percent','created_by','rfq_snapshot','annual_value_ex_gst'];
  const expected = [
    ...['id','rfq_id'].map(column => `quotations.${column}.INSERT`), 'quotations.next_version.UPDATE',
    ...versionInsert.map(column => `quotation_versions.${column}.INSERT`)
    ,...['actor_user_id','submission_key','request_fingerprint','rfq_id','version_id'].map(column => `draft_submissions.${column}.INSERT`)
  ].sort();
  assert.deepEqual(columns.map(row => `${row.table_name}.${row.column_name}.${row.privilege_type}`).sort(), expected);
  for (const name of ['quotations','quotation_versions','draft_submissions', ...appendTables]) {
    assert.notEqual(checks.rows.find(row => row.tablename === name).tableowner, new URL(readConfig().databaseUrl).username, `${name}: runtime must not own snapshot tables`);
  }
  console.log('PASS: existing read/session permissions preserved; snapshot SELECT/INSERT and header counter UPDATE only; no history UPDATE/DELETE or TRUNCATE; snapshot tables maintenance-owned.');
  const owned = checks.rows.filter(row => row.tableowner === new URL(readConfig().databaseUrl).username).map(row => row.tablename);
  if (owned.length) console.log(`Limitation: runtime still owns ${owned.join(', ')}; ordinary grants cannot remove owner DDL powers. No ownership changed.`);
} finally { await pool.end(); }
