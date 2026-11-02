import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import '../src/config.js';
import {createPool} from '../src/db.js';
import {prepareCloudDatabase,checkCloudPermissions} from '../src/cloud-database.js';
import {seed,fixtureId} from '../src/seed.js';
import {seedUsers} from '../src/auth/seed-users.js';
import {createApp} from '../src/app.js';

test('fresh dedicated database provisions and operates with real restricted LOGIN credentials',async t=>{
  const testUrl=new URL(process.env.TEST_DATABASE_URL);assert.match(testUrl.pathname,/_test$/);
  const adminUrl=new URL(process.env.MIGRATION_DATABASE_URL);
  assert.equal(adminUrl.hostname,testUrl.hostname);assert.equal(adminUrl.port,testUrl.port);
  adminUrl.pathname=testUrl.pathname;
  const admin=new pg.Pool({connectionString:adminUrl.href});
  const suffix=randomUUID().replaceAll('-','').slice(0,16);
  const databaseName=`forgequote_m8_${suffix}_test`,ownerRole=`m8_owner_${suffix}`,runtimeRole=`m8_runtime_${suffix}`;
  const ownerPassword=randomBytes(32).toString('hex'),runtimePassword=randomBytes(32).toString('hex');
  const passwords={DEMO_ESTIMATOR_PASSWORD:randomBytes(24).toString('hex'),DEMO_SALES_HEAD_PASSWORD:randomBytes(24).toString('hex')};
  let owner,runtime,app,server,base,cookie='',token='',versionId;
  let ownerCreated=false,runtimeCreated=false,databaseCreated=false;
  async function ownership(url) {
    const pool=new pg.Pool({connectionString:url});
    try {return (await pool.query(`SELECT current_database() AS database,pg_get_userbyid(datdba) AS owner,datacl::text AS acl,
      (SELECT nspacl::text FROM pg_namespace WHERE nspname='public') AS schema_acl,
      (SELECT jsonb_object_agg(c.relname,pg_get_userbyid(c.relowner)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS objects
      FROM pg_database WHERE datname=current_database()`)).rows[0];} finally {await pool.end();}
  }
  // Observe the preserved local databases without changing their owners/ACLs.
  const beforeDev=await ownership(process.env.DATABASE_URL),beforeTest=await ownership(process.env.TEST_DATABASE_URL);
  const requestBody={pricingDate:'2026-11-10',partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20',tierQuantities:{'50':'90000','100':'180000','150':'270000'}};
  async function request(path,{method='GET',body,key,headers={}}={}) {
    const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:base,'X-CSRF-Token':token}:{}),
      ...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    for(const value of response.headers.getSetCookie()) cookie=value.split(';')[0];
    const data=response.status===204?null:await response.json();if(data?.csrfToken) token=data.csrfToken;
    return {response,data};
  }
  try {
    // New roles/database only; never ALTER DATABASE/ROLE on existing identities.
    await admin.query(`CREATE ROLE ${pg.escapeIdentifier(ownerRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${pg.escapeLiteral(ownerPassword)}`);
    ownerCreated=true;
    await admin.query(`CREATE ROLE ${pg.escapeIdentifier(runtimeRole)} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${pg.escapeLiteral(runtimePassword)}`);
    runtimeCreated=true;
    await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(databaseName)} OWNER ${pg.escapeIdentifier(ownerRole)}`);
    databaseCreated=true;
    function url(role,password) {const result=new URL(adminUrl);result.pathname=`/${databaseName}`;result.username=role;result.password=password;return result.href;}
    owner=createPool(url(ownerRole,ownerPassword),{nodeEnv:'test',databaseTlsMode:'disable'});
    runtime=createPool(url(runtimeRole,runtimePassword),{nodeEnv:'test',databaseTlsMode:'disable'});
    await t.test('clean 001-004 migrations, repeat preparation and repeated seeds preserve data',async()=>{
      assert.equal((await owner.query('SELECT current_user')).rows[0].current_user,ownerRole);
      assert.deepEqual((await prepareCloudDatabase(owner,{databaseName,runtimeRoleName:runtimeRole})).applied,['001_initial.sql','002_authentication.sql','003_quotation_snapshots.sql','004_draft_submissions.sql']);
      await seed(owner);await seedUsers(owner,passwords);
      const hashes=(await owner.query('SELECT id,password_hash FROM users ORDER BY username')).rows;
      assert.deepEqual((await prepareCloudDatabase(owner,{databaseName,runtimeRoleName:runtimeRole})).applied,[]);
      await owner.query('DROP TRIGGER immutable ON public.quotation_versions');
      try {await assert.rejects(checkCloudPermissions(runtime,databaseName),/trigger inventory/);}
      finally {await owner.query('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON public.quotation_versions FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation()');}
      await checkCloudPermissions(runtime,databaseName);
      const env={...process.env,NODE_ENV:'test',DATABASE_TLS_MODE:'disable',DATABASE_URL:url(runtimeRole,runtimePassword),MIGRATION_DATABASE_URL:url(ownerRole,ownerPassword),CLOUD_DATABASE_NAME:databaseName};
      const prepared=execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-cloud.js',import.meta.url))],{env,encoding:'utf8',windowsHide:true});
      assert.match(prepared,/applied: \[\]/);
      const checked=execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/check-cloud-permissions.js',import.meta.url))],{env,encoding:'utf8',windowsHide:true});
      assert.match(checked,/restricted/);
      await seed(owner);await seedUsers(owner,passwords);
      assert.deepEqual((await owner.query('SELECT id,password_hash FROM users ORDER BY username')).rows,hashes);
      assert.deepEqual(await checkCloudPermissions(runtime,databaseName),{status:'restricted',tables:15,functions:4});
      const adminTarget=new URL(adminUrl);adminTarget.pathname=`/${databaseName}`;
      const impersonated=new pg.Pool({connectionString:adminTarget.href,options:`-c role=${runtimeRole}`});
      try {await assert.rejects(checkCloudPermissions(impersonated,databaseName),/authenticate directly/);}
      finally {await impersonated.end();}
      assert.equal((await runtime.query('SELECT current_user')).rows[0].current_user,runtimeRole);
      assert.equal((await runtime.query('SELECT count(*) FROM rate_periods')).rows[0].count,'6');
      await assert.rejects(runtime.query("SELECT '0.001'::public.quote_amount"),{code:'23514'});
    });
    server=createServer((req,res)=>app(req,res));
    server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
    app=createApp(runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:base,trustProxyHops:0});
    await t.test('runtime authenticates, persists sessions, reads RFQs and saves/replays complete snapshots',async()=>{
      assert.equal((await request('/api/health/live')).response.status,200);
      assert.equal((await request('/api/health/ready')).response.status,200);
      await request('/api/auth/session');
      const login=await request('/api/auth/login',{method:'POST',body:{username:'estimator',password:passwords.DEMO_ESTIMATOR_PASSWORD}});
      assert.equal(login.response.status,200);
      assert.ok((await owner.query('SELECT sid FROM sessions')).rowCount>0);
      assert.equal((await request('/api/rfqs')).data.rfqs[0].reference,'RFQ-2611-014');
      const key=randomUUID(),path=`/api/rfqs/${fixtureId(21)}/quote-versions`;
      const responses=await Promise.all(Array.from({length:3},()=>request(path,{method:'POST',body:requestBody,key})));
      assert.deepEqual(responses.map(result=>result.response.status).sort(),[200,200,201]);
      assert.equal(new Set(responses.map(result=>result.data.versionId)).size,1);
      versionId=responses[0].data.versionId;
      const snapshot=(await request(`/api/quote-versions/${versionId}`)).data;
      assert.equal(snapshot.parts[0].result.tiers[1].costPerUnit,'119.76');
      assert.equal(snapshot.parts[0].result.tiers[1].sellingPricePerUnitExGst,'149.70');
      assert.equal(snapshot.parts[0].rates.materialInrPerKg.value,'100.000000');
      assert.equal(snapshot.parts[0].routingRevisionId,fixtureId(23));
      await owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-03','200')",[randomUUID(),fixtureId(1)]);
      assert.deepEqual((await request(`/api/quote-versions/${versionId}`)).data,snapshot);
      assert.equal((await owner.query('SELECT count(*) FROM draft_submissions')).rows[0].count,'1');
      assert.equal((await owner.query('SELECT count(*) FROM quotation_rates')).rows[0].count,'6');
      assert.equal((await owner.query('SELECT count(*) FROM quotation_part_tiers')).rows[0].count,'3');
      assert.equal((await request('/api/auth/logout',{method:'POST'})).response.status,204);
      assert.equal((await request(`/api/quote-versions/${versionId}`)).response.status,401);
    });
    await t.test('runtime cannot create/drop objects, tamper with guards or gain owner privileges',async()=>{
      for(const sql of [
        'CREATE SCHEMA forbidden','CREATE TABLE public.forbidden(id int)','CREATE TEMP TABLE forbidden(id int)',
        'DROP TABLE public.quotation_versions CASCADE','DROP VIEW public.rate_periods',
        'ALTER TABLE public.quotation_versions DISABLE TRIGGER ALL',
        'DROP TRIGGER immutable ON public.quotation_versions',
        'ALTER FUNCTION public.guard_quote_assembly() SECURITY DEFINER',
        'DROP FUNCTION public.guard_quote_assembly() CASCADE',
        'ALTER DOMAIN public.quote_amount DROP CONSTRAINT quote_amount_check',
        'SET session_replication_role=replica',`SET ROLE ${pg.escapeIdentifier(ownerRole)}`,
        `GRANT ${pg.escapeIdentifier(ownerRole)} TO ${pg.escapeIdentifier(runtimeRole)}`,
        "INSERT INTO public.rate_versions(id,rate_key_id,effective_from,value) VALUES (gen_random_uuid(),'26110100-0000-4000-8000-000000000001','2028-01-01','0')",
        'UPDATE public.users SET active=false','DELETE FROM public.users'
      ]) await assert.rejects(runtime.query(sql),{code:'42501'},sql);
      for(const table of ['rate_keys','rate_versions','routing_revisions','quotation_versions','quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals','draft_submissions']) {
        for(const sql of [`DELETE FROM public.${table}`,`TRUNCATE public.${table} CASCADE`]) await assert.rejects(runtime.query(sql),{code:'42501'},sql);
      }
      await assert.rejects(runtime.query('UPDATE public.quotation_parts SET annual_value_ex_gst=0'),{code:'42501'});
      // PostgreSQL can warn/no-op for an ineffective self-grant; check the result,
      // rather than treating a non-error command as successful escalation.
      await runtime.query(`GRANT UPDATE ON public.users TO ${pg.escapeIdentifier(runtimeRole)}`);
      assert.equal((await runtime.query("SELECT has_table_privilege(current_user,'public.users','UPDATE') AS allowed")).rows[0].allowed,false);
      assert.deepEqual(await checkCloudPermissions(runtime,databaseName),{status:'restricted',tables:15,functions:4});
    });
    await t.test('fresh-cloud procedure refuses mismatched targets or unrelated objects without repairing ownership',async()=>{
      await assert.rejects(prepareCloudDatabase(owner,{databaseName:'forgequote_dev',runtimeRoleName:runtimeRole}),/forbidden/);
      await assert.rejects(prepareCloudDatabase(owner,{databaseName:'forgequote_other',runtimeRoleName:runtimeRole}),/differs/);
      await owner.query('CREATE TABLE public.unrelated_fixture(id int)');
      try {await assert.rejects(prepareCloudDatabase(owner,{databaseName,runtimeRoleName:runtimeRole}),/unexpected/);}
      finally {await owner.query('DROP TABLE public.unrelated_fixture');}
      assert.deepEqual((await prepareCloudDatabase(owner,{databaseName,runtimeRoleName:runtimeRole})).applied,[]);
    });
  } finally {
    if(app) app.locals.sessionStore.close();if(server) await new Promise(resolve=>server.close(resolve));
    if(runtime) await runtime.end();if(owner) await owner.end();
    assert.match(databaseName,/^forgequote_m8_[a-f0-9]{16}_test$/);
    if(databaseCreated) await admin.query(`DROP DATABASE ${pg.escapeIdentifier(databaseName)} WITH (FORCE)`);
    if(runtimeCreated) await admin.query(`DROP ROLE ${pg.escapeIdentifier(runtimeRole)}`);
    if(ownerCreated) await admin.query(`DROP ROLE ${pg.escapeIdentifier(ownerRole)}`);
    await admin.end();
    assert.deepEqual(await ownership(process.env.DATABASE_URL),beforeDev,'Local development ownership/ACLs unchanged');
    assert.deepEqual(await ownership(process.env.TEST_DATABASE_URL),beforeTest,'Local test ownership/ACLs unchanged');
  }
});
