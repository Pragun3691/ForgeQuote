import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {testDatabase} from '../../../tests/helpers/database.js';
import {multipartRfq} from '../../../tests/helpers/multipart-rfq.js';
import {createApp} from '../src/app.js';
import {migrate} from '../src/migrate.js';
import {seed} from '../src/seed.js';
import {seedUsers} from '../src/auth/seed-users.js';

const oldMigrations=['001_initial.sql','002_authentication.sql','003_quotation_snapshots.sql','004_draft_submissions.sql','005_rfq_intake.sql','006_quotation_events.sql','007_final_requirements.sql'];
const digest=value=>createHash('sha256').update(value).digest('hex');
async function fingerprints(pool){
 const tables=['users','sessions','rfqs','rfq_parts','routing_revisions','rate_keys','rate_versions','quotations','quotation_versions','quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals','quotation_events','rfq_outcomes','draft_submissions','rfq_submissions'];
 const result={};
 for(const name of tables){
  const rows=(await pool.query(`SELECT row_to_json(t) AS row FROM ${name} t`)).rows.map(r=>JSON.stringify(r.row)).sort();
  // Never put session tokens/password hashes/raw row contents into test output.
  result[name]={count:rows.length,digest:digest(rows.join('\n'))};
 }
 return result;
}

// This models Render routing/health decisions with real HTTP applications and
// real PostgreSQL transactions. It does not claim independent Render testing.
test('maintenance release protocol: real 007, in-flight drain, 008 rollback/retry, failed candidates and recovery',async t=>{
 const db=await testDatabase({seedBusiness:false}),schema=`maintenance_${randomUUID().replaceAll('-','')}`;
 let owner,oldPool,newPool,proxy;let releaseHeld=()=>{};const instances=[];
 try{
  await db.owner.query(`CREATE SCHEMA ${schema}`);
  owner=new pg.Pool({connectionString:db.connectionString,options:`-c search_path=${schema}`});
  await owner.query('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for(const name of oldMigrations){const sql=await readFile(new URL(`../db/migrations/${name}`,import.meta.url),'utf8');await owner.query(sql);await owner.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,digest(sql.replaceAll('\r\n','\n'))]);}
  await seed(owner);await seedUsers(owner,db.passwords);
  await db.owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${db.role}`);
  const grants=(await readFile(new URL('../db/runtime-grants.sql',import.meta.url),'utf8')).replaceAll('public.',`${schema}.`).replaceAll('forgequote_app',db.role);await owner.query(grants);
  const options=`-c search_path=${schema} -c role=${db.role}`;
  oldPool=new pg.Pool({connectionString:db.connectionString,options,application_name:'fq_old_writable_instance'});
  newPool=new pg.Pool({connectionString:db.connectionString,options,application_name:'fq_new_candidate'});
  const sessionSecret=randomBytes(32).toString('hex');
  let active,barrierEstablished=false,migrationAttempts=0;
  proxy=createServer(async(req,res)=>{
   try{
    const body=[];for await(const chunk of req)body.push(chunk);
    const upstream=await fetch(active+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(body)}),redirect:'manual'});
    res.writeHead(upstream.status,Object.fromEntries(upstream.headers));res.end(Buffer.from(await upstream.arrayBuffer()));
   }catch{res.writeHead(503);res.end('Unavailable');}
  });proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  const origin=`http://127.0.0.1:${proxy.address().port}`;
  const settings=maintenanceMode=>({nodeEnv:'test',gstPercent:'18',appOrigin:origin,sessionSecret,trustProxyHops:0,maintenanceMode});
  async function instance(pool,mode,{legacyHealth=false}={}){
   const app=createApp(pool,settings(mode),{sessionSchema:schema,quoteLimit:1000,loginLimit:100});
   const server=createServer((req,res)=>{if(legacyHealth&&req.url==='/api/health/deploy'){res.writeHead(404);res.end();}else app(req,res);});server.listen(0,'127.0.0.1');await once(server,'listening');
   const result={app,server,url:`http://127.0.0.1:${server.address().port}`,closed:false,async close(){if(this.closed)return;await new Promise(r=>server.close(r));await app.locals.sessionStore?.close();this.closed=true;}};instances.push(result);return result;
  }
  async function promote(candidate){try{const r=await fetch(candidate.url+'/api/health/deploy');if(r.status!==200)return false;active=candidate.url;return true;}catch{return false;}}
  async function login(){
   const initial=await fetch(origin+'/api/auth/session'),anonymous=await initial.json(),cookie=initial.headers.get('set-cookie').split(';')[0];
   const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':anonymous.csrfToken,'Content-Type':'application/json'},body:JSON.stringify({username:'estimator',password:db.passwords.DEMO_ESTIMATOR_PASSWORD})});assert.equal(r.status,200);
   return {cookie:r.headers.get('set-cookie').split(';')[0],...(await r.json())};
  }
  let commitReached,releaseCommit,holdCommit=false;
  const reached=new Promise(r=>{commitReached=r;}),gate=new Promise(r=>{releaseCommit=r;releaseHeld=r;});
  const oldRuntime={query:(...args)=>oldPool.query(...args),async connect(){const c=await oldPool.connect();return {release:()=>c.release(),async query(sql,args){if(sql==='COMMIT'&&holdCommit){holdCommit=false;commitReached();await gate;}return c.query(sql,args);}};}};
  const old=await instance(oldRuntime,false,{legacyHealth:true});active=old.url;
  const user=await login(),f=await multipartRfq(owner,1),key=randomUUID();
  const save=()=>fetch(origin+`/api/rfqs/${f.rfqId}/quote-versions`,{method:'POST',headers:{Cookie:user.cookie,Origin:origin,'X-CSRF-Token':user.csrfToken,'Idempotency-Key':key,'Content-Type':'application/json'},body:JSON.stringify(f.body)});
  const ledgerCount=async()=>(await owner.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n;
  const candidate007=await instance(newPool,false);
  await t.test('failed activation cannot establish a barrier or permit migration',async()=>{
   assert.equal(await promote(candidate007),false);assert.equal(active,old.url);assert.equal(await ledgerCount(),7);assert.equal(barrierEstablished,false);
   assert.equal((await fetch(origin+'/api/auth/session',{headers:{Cookie:user.cookie}})).status,200);
  });
  let maintenanceQueries=0;
  const maintenance=await instance({query(){maintenanceQueries++;throw Error('Maintenance DB access');},connect(){maintenanceQueries++;throw Error('Maintenance DB access');}},true);
  let pendingSave,receipt;
  await t.test('new maintenance health is not proof that an old in-flight writer has stopped',async()=>{
   holdCommit=true;pendingSave=save();await reached;
   assert.equal(await promote(maintenance),true);
   assert.equal((await fetch(origin+'/api/health/deploy')).status,200);
   assert.equal((await fetch(origin+'/api/auth/session',{headers:{Cookie:user.cookie}})).status,503);
   assert.ok((await owner.query("SELECT 1 FROM pg_stat_activity WHERE application_name='fq_old_writable_instance' AND xact_start IS NOT NULL")).rowCount>0);
   assert.equal(barrierEstablished,false);assert.equal(migrationAttempts,0);assert.equal(await ledgerCount(),7);
   releaseCommit();const response=await pendingSave;assert.equal(response.status,201);receipt=await response.json();
   await old.close();await oldPool.end();oldPool=null;
   assert.equal((await owner.query("SELECT 1 FROM pg_stat_activity WHERE application_name='fq_old_writable_instance'")).rowCount,0);
   barrierEstablished=true;
  });
  const expiredSid='synthetic-expired-'+randomUUID();await owner.query("INSERT INTO sessions(sid,sess,expire) VALUES($1,'{}',now()-interval '1 hour')",[expiredSid]);
  const preserved=await fingerprints(owner);
  await t.test('007 maintenance and premature deactivation leave all data and sessions unchanged',async()=>{
   assert.equal(maintenance.app.locals.sessionStore,undefined);
   for(let n=0;n<5;n++){
    assert.equal((await fetch(origin+'/api/auth/session',{headers:{Cookie:user.cookie}})).status,503);
    assert.equal((await save()).status,503);
    assert.equal(await promote(candidate007),false);
   }
   assert.equal(active,maintenance.url);assert.equal(maintenanceQueries,0);assert.equal((await fetch(origin+'/api/health/ready')).status,503);
   assert.deepEqual(await fingerprints(owner),preserved);await candidate007.close();
  });
  await t.test('DDL failure rolls back 008 and never reopens traffic; retry preserves history',async()=>{
   assert.equal(barrierEstablished,true);
   const original=(await owner.query("SELECT pg_get_functiondef('guard_quote_header()'::regprocedure) AS def")).rows[0].def;
   await owner.query('CREATE FUNCTION guard_quotation_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$');
   migrationAttempts++;await assert.rejects(migrate(owner),{code:'42723'});
   assert.equal(await ledgerCount(),7);assert.equal((await owner.query("SELECT pg_get_functiondef('guard_quote_header()'::regprocedure) AS def")).rows[0].def,original);
   assert.equal((await fetch(origin+'/api/rfqs')).status,503);assert.deepEqual(await fingerprints(owner),preserved);
   await owner.query('DROP FUNCTION guard_quotation_version()'); // Own disposable fault fixture only.
   migrationAttempts++;assert.deepEqual(await migrate(owner),['008_terminal_rfq_quotation_guards.sql']);
   assert.equal(await ledgerCount(),8);assert.deepEqual(await fingerprints(owner),preserved);
   assert.deepEqual(await migrate(owner),[]);
  });
  await t.test('failed or pre-maintenance legacy deployments cannot replace the maintenance instance',async()=>{
   const failed=await instance(newPool,false);await failed.close();assert.equal(await promote(failed),false);
   const legacy=await instance(newPool,false,{legacyHealth:true});assert.equal((await fetch(legacy.url+'/api/health/live')).status,200);assert.equal(await promote(legacy),false);await legacy.close();
   assert.equal(active,maintenance.url);assert.equal((await fetch(origin+'/api/health/ready')).status,503);assert.equal(maintenanceQueries,0);assert.deepEqual(await fingerprints(owner),preserved);
  });
  await t.test('verified 008 deactivation preserves sessions, exact receipt recovery and golden values',async()=>{
   const normal=await instance(newPool,false);assert.equal(await promote(normal),true);
   const recoveredSession=await fetch(origin+'/api/auth/session',{headers:{Cookie:user.cookie}});assert.equal(recoveredSession.status,200);
   const auth=await recoveredSession.json();assert.equal(auth.csrfToken,user.csrfToken);assert.equal(auth.user.id,user.user.id);
   const replay=await save();assert.equal(replay.status,200);const body=await replay.json();assert.equal(body.replayed,true);assert.equal(body.versionId,receipt.versionId);
   const saved=await fetch(origin+'/api/quote-versions/'+receipt.versionId,{headers:{Cookie:user.cookie}});assert.equal(saved.status,200);const snapshot=await saved.json();
   assert.deepEqual(snapshot.parts[0].result.tiers.map(tier=>[tier.costPerUnit,tier.sellingPricePerUnitExGst]),[['120.44','150.55'],['119.76','149.70'],['119.53','149.41']]);
   assert.equal((await owner.query('SELECT count(*)::int AS n FROM quotation_versions')).rows[0].n,1);
   assert.equal((await owner.query('SELECT count(*)::int AS n FROM sessions WHERE sid=$1',[expiredSid])).rows[0].n,1);
   await new Promise((resolve,reject)=>normal.app.locals.sessionStore.pruneSessions(error=>error?reject(error):resolve()));
   assert.equal((await owner.query('SELECT count(*)::int AS n FROM sessions WHERE sid=$1',[expiredSid])).rows[0].n,0);
  });
 }finally{
  releaseHeld();
  for(const item of instances)await item.close();if(proxy)await new Promise(r=>proxy.close(r));
  await oldPool?.end();await newPool?.end();await owner?.end();await db.owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await db.close();
 }
});
