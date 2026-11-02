import assert from 'node:assert/strict';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { migrate } from './migrate.js';
import { transaction } from './db.js';

const tables=['rate_keys','rate_versions','rfqs','rfq_parts','routing_revisions','schema_migrations','users','sessions',
  'quotations','quotation_versions','quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals','draft_submissions'];
const functions=['reject_history_mutation','guard_quote_assembly','guard_quote_header','guard_draft_submission'];
const columnInserts={quotations:['id','rfq_id'],quotation_versions:['id','quotation_id','version_number','pricing_date','formula_version','currency','gst_percent','created_by','rfq_snapshot','annual_value_ex_gst'],
  draft_submissions:['actor_user_id','submission_key','request_fingerprint','rfq_id','version_id']};
const appendTables=['quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals'];
const triggers={rate_keys:['rate_keys_immutable'],rate_versions:['rate_versions_immutable','rate_versions_no_truncate'],
  routing_revisions:['routing_revisions_immutable','routing_revisions_no_truncate'],
  quotations:['quotations_allocate','quotations_no_delete','quotations_no_truncate'],quotation_versions:['immutable','no_truncate'],
  ...Object.fromEntries(appendTables.map(table=>[table,['immutable','no_truncate','assembly_only']])),
  draft_submissions:['draft_submission_assembly','draft_submissions_immutable','draft_submissions_no_truncate']};

export function validateCloudTarget(name) {
  if(typeof name !== 'string' || !/^forgequote_[a-z0-9_]{1,48}$/.test(name) || ['forgequote_dev','forgequote_test'].includes(name)) throw Error('CLOUD_DATABASE_NAME must name a dedicated forgequote_ database; local dev/test targets are forbidden');
  return name;
}
async function target(client,name) {
  validateCloudTarget(name);
  const row=(await client.query('SELECT current_database() AS name,current_user AS actor,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()')).rows[0];
  assert.equal(row.name,name,'Connected database differs from CLOUD_DATABASE_NAME');
  return row;
}
async function runtimeRole(client,role) {
  if(!/^[a-z][a-z0-9_]{0,62}$/.test(role)) throw Error('Invalid runtime role name');
  const row=(await client.query('SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
  assert.ok(row,'Create the restricted runtime LOGIN using SQL before preparation');
  assert.equal(row.rolcanlogin,true,'Runtime must be a LOGIN');
  for(const field of ['rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls']) assert.equal(row[field],false,`Runtime ${field} must be false`);
  assert.equal((await client.query('SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1',[role])).rowCount,0,'Runtime must have no role memberships (including neon_superuser/owner roles)');
}

/** Explicit maintenance operation for a fresh dedicated database only.
 * No role/password creation/reset, ownership transfer, data reset or cloud API.
 * Re-running validates existing ownership and checksummed migrations.
 */
export async function prepareCloudDatabase(pool,{databaseName,runtimeRoleName}) {
  validateCloudTarget(databaseName);
  await transaction(pool,async client=>{
    const db=await target(client,databaseName);
    assert.equal(db.owner,db.actor,'Maintenance must already own this fresh database');
    assert.notEqual(db.actor,runtimeRoleName,'Maintenance and runtime must differ');
    await runtimeRole(client,runtimeRoleName);
    const objects=(await client.query(`SELECT c.relname,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','v','S','m','f','p')`)).rows;
    for(const object of objects) {
      assert.ok([...tables,'rate_periods'].includes(object.relname),'Dedicated database contains unexpected public objects; refusing preparation');
      assert.equal(object.owner,db.actor,'Existing application objects must already be maintenance-owned; no ownership repair is performed');
    }
    const database=pg.escapeIdentifier(databaseName), role=pg.escapeIdentifier(runtimeRoleName);
    await client.query(`REVOKE CREATE,TEMPORARY,CONNECT ON DATABASE ${database} FROM PUBLIC`);
    await client.query(`REVOKE CREATE,TEMPORARY ON DATABASE ${database} FROM ${role}`);
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
    await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC,${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    // Future migrations must grant access explicitly; no blanket future writes.
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE ON TYPES FROM PUBLIC');
  });
  const applied=await migrate(pool); // existing transaction/checksum runner, unchanged
  await transaction(pool,async client=>{
    await target(client,databaseName);
    const role=pg.escapeIdentifier(runtimeRoleName);
    const sql=(await readFile(new URL('../db/runtime-grants.sql',import.meta.url),'utf8')).replaceAll('forgequote_app',role);
    // File has its own BEGIN/COMMIT. Strip only those known wrapper statements
    // so grants plus function/domain ACLs share this transaction.
    await client.query(sql.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,''));
    for(const name of functions) {
      await client.query(`REVOKE EXECUTE ON FUNCTION public.${name}() FROM PUBLIC`);
      await client.query(`GRANT EXECUTE ON FUNCTION public.${name}() TO ${role}`);
    }
    await client.query('REVOKE USAGE ON DOMAIN public.quote_amount FROM PUBLIC');
    await client.query(`GRANT USAGE ON DOMAIN public.quote_amount TO ${role}`);
  });
  return {applied};
}

export async function checkCloudPermissions(pool,databaseName) {
  validateCloudTarget(databaseName);
  const client=await pool.connect();
  try {
    const db=await target(client,databaseName);
    assert.notEqual(db.actor,db.owner,'Runtime must not own database');
    await runtimeRole(client,db.actor);
    const privilege=(await client.query(`SELECT
      has_database_privilege(current_user,current_database(),'CONNECT') AS connect,
      has_database_privilege(current_user,current_database(),'CREATE') AS create_db_objects,
      has_database_privilege(current_user,current_database(),'TEMP') AS temp,
      has_schema_privilege(current_user,'public','CREATE') AS schema_create,
      has_schema_privilege(current_user,'public','USAGE') AS schema_usage`)).rows[0];
    assert.deepEqual(privilege,{connect:true,create_db_objects:false,temp:false,schema_create:false,schema_usage:true});
    const owned=(await client.query(`SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
      UNION ALL SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
      UNION ALL SELECT 1 FROM pg_proc WHERE proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
      UNION ALL SELECT 1 FROM pg_type WHERE typowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)`)).rowCount;
    assert.equal(owned,0,'Runtime must not own any database objects');
    for(const table of [...tables,'rate_periods']) {
      const acl=(await client.query(`SELECT has_table_privilege(current_user,$1,'SELECT') AS sel,has_table_privilege(current_user,$1,'INSERT') AS ins,
        has_table_privilege(current_user,$1,'UPDATE') AS upd,has_table_privilege(current_user,$1,'DELETE') AS del,
        has_table_privilege(current_user,$1,'TRUNCATE') AS trunc,has_table_privilege(current_user,$1,'TRIGGER') AS trig`,[`public.${table}`])).rows[0];
      assert.deepEqual(acl,{sel:true,ins:table==='sessions'||appendTables.includes(table),upd:table==='sessions',del:table==='sessions',trunc:false,trig:false},`${table} ACL`);
      for(const action of ['INSERT','UPDATE','REFERENCES']) {
        const actual=(await client.query(`SELECT a.attname FROM pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped
          AND has_column_privilege(current_user,a.attrelid,a.attname,$2) ORDER BY a.attname`,[`public.${table}`,action])).rows.map(row=>row.attname);
        if(action==='REFERENCES') assert.deepEqual(actual,[],`${table}: no reference grant`);
        else if(action==='INSERT' && columnInserts[table]) assert.deepEqual(actual,[...columnInserts[table]].sort());
        else if(action==='UPDATE' && table==='quotations') assert.deepEqual(actual,['next_version']);
        else if(!(table==='sessions'||(action==='INSERT'&&appendTables.includes(table)))) assert.deepEqual(actual,[],`${table}: no unexpected column ${action}`);
      }
    }
    for(const name of functions) assert.equal((await client.query('SELECT has_function_privilege(current_user,$1,\'EXECUTE\') AS allowed',[`public.${name}()`])).rows[0].allowed,true);
    assert.equal((await client.query("SELECT has_type_privilege(current_user,'public.quote_amount','USAGE') AS allowed")).rows[0].allowed,true);
    const actualTriggers=(await client.query(`SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal`)).rows;
    assert.deepEqual(actualTriggers.map(row=>`${row.relname}.${row.tgname}`).sort(),Object.entries(triggers).flatMap(([table,names])=>names.map(name=>`${table}.${name}`)).sort(),'Application trigger inventory must match migrations 001-004');
    assert.ok(actualTriggers.every(row=>row.tgenabled==='O'),'Application triggers must remain enabled');
    return {status:'restricted',tables:tables.length,functions:functions.length};
  } finally {client.release();}
}
