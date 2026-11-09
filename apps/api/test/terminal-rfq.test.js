import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {testDatabase} from '../../../tests/helpers/database.js';
import {multipartRfq} from '../../../tests/helpers/multipart-rfq.js';
import {createQuotationService} from '../src/quotations.js';
import {createLifecycleService} from '../src/quotation-lifecycle.js';
import {createSubmissionService} from '../src/draft-submissions.js';
import {recordOutcome} from '../src/final-workflows.js';
import {getRfq} from '../src/rfqs.js';
import {createApp} from '../src/app.js';
import {createCustomerQuotationService} from '../src/customer-quotation.js';
import {createInternalCostingService} from '../src/internal-costing-pdf.js';
import {seed} from '../src/seed.js';
import {seedUsers} from '../src/auth/seed-users.js';
import {once} from 'node:events';

async function actors(db){
 const users=(await db.owner.query('SELECT id,role FROM users')).rows;
 return {e:users.find(u=>u.role==='estimator').id,s:users.find(u=>u.role==='sales_head').id};
}
async function openFixture(db,stage='draft'){
 const {e,s}=await actors(db),life=createLifecycleService(db.runtime),save=createSubmissionService(db.runtime,{gstPercent:'18'}),f=await multipartRfq(db.owner,1);
 const first=await save(e,f.rfqId,randomUUID(),f.body);
 for(const [who,action]of [[e,'submit'],[s,'approve'],[e,'issue']])await life.act(who,first.versionId,action,randomUUID(),{});
 const current=await save(e,f.rfqId,randomUUID(),f.body);
 if(stage!=='draft')await life.act(e,current.versionId,'submit',randomUUID(),{});
 if(stage==='approved')await life.act(s,current.versionId,'approve',randomUUID(),{});
 return {...f,e,s,first,current};
}
function observedPool(pool,{holdCommit=false}={}){
 let resolveReady,release;const ready=new Promise(r=>{resolveReady=r;}),gate=new Promise(r=>{release=r;});
 const state={pid:null,ready,release,pool:{async connect(){
  const c=await pool.connect();state.pid=c.processID;
  return {release:()=>c.release(),async query(sql,args){
   if(sql==='BEGIN'){await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='8s'");return;}
   if(sql==='COMMIT'&&holdCommit){resolveReady();await gate;}
   return c.query(sql,args);
  }};
 }}};return state;
}
async function waitForBlocked(db,state){
 const end=Date.now()+5000;
 while(Date.now()<end){
  if(state.pid&&(await db.owner.query('SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted',[state.pid])).rowCount)return;
  await delay(10);
 }
 assert.fail('The competing operation did not wait on the common database lock');
}

test('terminal closure serializes quotation writes in both orders without deadlocks',async t=>{
 const db=await testDatabase();
 try{
  for(const outcome of ['won','lost'])for(const action of ['create','submit','approve','reject','issue','sql-allocation','sql-version','sql-event'])for(const first of ['closure','quotation'])await t.test(`${outcome}: ${action}, ${first} commits first`,async()=>{
   const stage=['approve','reject','sql-event'].includes(action)?'pending':action==='issue'?'approved':'draft',f=await openFixture(db,stage);
   const close=pool=>recordOutcome(pool,f.s,f.rfqId,randomUUID(),outcome==='lost'?{outcome,reason:'Synthetic concurrency'}:{outcome});
   const write=async pool=>{
    if(action==='create')return createSubmissionService(pool,{gstPercent:'18'})(f.e,f.rfqId,randomUUID(),f.body);
    if(!action.startsWith('sql-'))return createLifecycleService(pool).act(['approve','reject'].includes(action)?f.s:f.e,f.current.versionId,action,randomUUID(),action==='reject'?{reason:'Synthetic concurrency'}:{});
    const c=await pool.connect();try{
     await c.query('BEGIN');
     const header=(await c.query('SELECT id,next_version FROM quotations WHERE rfq_id=$1',[f.rfqId])).rows[0];
     if(action==='sql-allocation')await c.query('UPDATE quotations SET next_version=next_version+1 WHERE id=$1',[header.id]);
     if(action==='sql-version')await c.query(`INSERT INTO quotation_versions(id,quotation_id,version_number,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst)
      SELECT $1,quotation_id,$2,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst FROM quotation_versions WHERE id=$3`,[randomUUID(),header.next_version,f.current.versionId]);
     if(action==='sql-event')await c.query("INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,submission_key) VALUES($1,2,'approved',$2,$3)",[f.current.versionId,f.s,randomUUID()]);
     await c.query('COMMIT');
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
   };
   const held=observedPool(db.runtime,{holdCommit:true}),other=observedPool(db.runtime);
   const a=(first==='closure'?close:write)(held.pool);const guardedA=a.then(value=>({value}),error=>({error}));
   let b,guardedB;
   try{
    await Promise.race([held.ready,guardedA.then(result=>{if(result.error)throw result.error;})]);
    b=(first==='closure'?write:close)(other.pool);guardedB=b.then(value=>({value}),error=>({error}));
    await waitForBlocked(db,other);
   }finally{held.release();}
   const ar=await guardedA,br=await guardedB;assert.ifError(ar.error);
   if(first==='closure')assert.equal(br.error?.code,action.startsWith('sql-')?'55000':'RFQ_TERMINAL');else assert.ifError(br.error);
   assert.equal((await getRfq(db.runtime,f.rfqId)).status,outcome);
  });
 }finally{await db.close();}
});

test('terminal SQL guards fail closed for stale repeatable-read and serializable snapshots',async t=>{
 const db=await testDatabase();
 try{
  for(const isolation of ['REPEATABLE READ','SERIALIZABLE'])for(const action of ['allocation','version','event','outcome'])await t.test(`${isolation}: ${action}`,async()=>{
   const f=await openFixture(db,'pending'),c=await db.runtime.connect();
   try{
    await c.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    assert.equal((await c.query('SELECT 1 FROM rfq_outcomes WHERE rfq_id=$1',[f.rfqId])).rowCount,0);
    const h=(await c.query('SELECT * FROM quotations WHERE rfq_id=$1',[f.rfqId])).rows[0];
    await recordOutcome(db.runtime,f.s,f.rfqId,randomUUID(),{outcome:'won'});
    const attempt=()=>action==='allocation'?c.query('UPDATE quotations SET next_version=next_version+1 WHERE id=$1',[h.id]):
     action==='version'?c.query(`INSERT INTO quotation_versions(id,quotation_id,version_number,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst)
       SELECT $1,quotation_id,$2,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst FROM quotation_versions WHERE id=$3`,[randomUUID(),h.next_version,f.current.versionId]):
     action==='event'?c.query("INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,submission_key) VALUES($1,2,'approved',$2,$3)",[f.current.versionId,f.s,randomUUID()]):
     c.query("INSERT INTO rfq_outcomes(rfq_id,outcome,actor_user_id,reason,submission_key) VALUES($1,'lost',$2,'Synthetic stale snapshot',$3)",[f.rfqId,f.s,randomUUID()]);
    await assert.rejects(attempt,{code:'25000'});
   }finally{await c.query('ROLLBACK');c.release();}
   assert.equal((await createLifecycleService(db.runtime).status(f.e,f.current.versionId)).status,'pending');
  });
 }finally{await db.close();}
});

test('committed rejection receipts recover after either terminal outcome',async t=>{
 const db=await testDatabase();
 try{
  for(const outcome of ['won','lost'])await t.test(outcome,async()=>{
   const f=await openFixture(db,'pending'),life=createLifecycleService(db.runtime),key=randomUUID(),body={reason:'Synthetic committed rejection'};
   await life.act(f.s,f.current.versionId,'reject',key,body);
   await recordOutcome(db.runtime,f.s,f.rfqId,randomUUID(),outcome==='won'?{outcome}:{outcome,reason:'Synthetic closure'});
   assert.equal((await life.act(f.s,f.current.versionId,'reject',key,body)).replayed,true);
   await assert.rejects(life.act(f.s,f.current.versionId,'reject',key,{reason:'Different request'}),{code:'SUBMISSION_CONFLICT'});
   await assert.rejects(life.act(f.s,f.current.versionId,'reject',randomUUID(),body),{code:'RFQ_TERMINAL'});
  });
 }finally{await db.close();}
});

test('terminal RFQ closure blocks new quotation work while preserving receipts and history',async t=>{
 const db=await testDatabase();
 try{
  const users=(await db.owner.query('SELECT id,role FROM users')).rows,e=users.find(u=>u.role==='estimator').id,s=users.find(u=>u.role==='sales_head').id;
  const quotes=createQuotationService(db.runtime,{gstPercent:'18'}),life=createLifecycleService(db.runtime),save=createSubmissionService(db.runtime,{gstPercent:'18'});
  async function fixture(stage){
   const f=await multipartRfq(db.owner,1),keys={},first=await save(e,f.rfqId,randomUUID(),f.body);
   for(const [who,action]of [[e,'submit'],[s,'approve'],[e,'issue']])await life.act(who,first.versionId,action,randomUUID(),{});
   const saveKey=randomUUID(),current=await save(e,f.rfqId,saveKey,f.body);
   if(stage!=='draft'){keys.submit=randomUUID();await life.act(e,current.versionId,'submit',keys.submit,{});}
   if(stage==='approved'){keys.approve=randomUUID();await life.act(s,current.versionId,'approve',keys.approve,{});}
   return {...f,current,saveKey,keys};
  }
  for(const outcome of ['won','lost'])for(const stage of ['draft','pending','approved'])await t.test(`${outcome}: ${stage} quotation cannot advance; exact committed requests still recover`,async()=>{
   const f=await fixture(stage),before=await quotes.getDraftVersion(e,f.current.versionId),outcomeKey=randomUUID(),outcomeBody=outcome==='lost'?{outcome,reason:'Synthetic closure'}:{outcome};
   await recordOutcome(db.runtime,s,f.rfqId,outcomeKey,outcomeBody);
   const header=(await db.owner.query('SELECT next_version FROM quotations WHERE rfq_id=$1',[f.rfqId])).rows[0],newKey=randomUUID();
   await assert.rejects(save(e,f.rfqId,newKey,f.body),{code:'RFQ_TERMINAL'});
   assert.deepEqual((await db.owner.query('SELECT next_version FROM quotations WHERE rfq_id=$1',[f.rfqId])).rows[0],header);
   assert.equal((await db.owner.query('SELECT 1 FROM draft_submissions WHERE submission_key=$1',[newKey])).rowCount,0);
   const actions=stage==='draft'?['submit']:stage==='pending'?['approve','reject']:['issue'];
   for(const action of actions)await assert.rejects(life.act(['approve','reject'].includes(action)?s:e,f.current.versionId,action,randomUUID(),action==='reject'?{reason:'Synthetic rejection'}:{}),{code:'RFQ_TERMINAL'});
   assert.equal((await save(e,f.rfqId,f.saveKey,f.body)).versionId,f.current.versionId);
   for(const [action,key]of Object.entries(f.keys))assert.equal((await life.act(action==='approve'?s:e,f.current.versionId,action,key,{})).replayed,true);
   await assert.rejects(save(e,f.rfqId,f.saveKey,{...f.body,parts:f.body.parts.map(p=>({...p,marginPercent:'21'}))}),{code:'SUBMISSION_CONFLICT'});
   assert.equal((await recordOutcome(db.runtime,s,f.rfqId,outcomeKey,outcomeBody)).replayed,true);
   assert.equal((await getRfq(db.runtime,f.rfqId)).status,outcome);assert.deepEqual(await quotes.getDraftVersion(e,f.current.versionId),before);
   assert.ok(!(await life.pending(s)).some(v=>v.rfqId===f.rfqId));
   assert.equal((await life.status(e,f.current.versionId)).rfqOutcome,outcome);
   const parent=(await db.owner.query('SELECT * FROM quotations WHERE rfq_id=$1',[f.rfqId])).rows[0];
   await assert.rejects(db.runtime.query('UPDATE quotations SET next_version=next_version+1 WHERE id=$1',[parent.id]),{code:'55000'});
   await assert.rejects(db.runtime.query(`INSERT INTO quotation_versions(id,quotation_id,version_number,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst)
     SELECT $1,quotation_id,$2,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst FROM quotation_versions WHERE id=$3`,[randomUUID(),parent.next_version,f.current.versionId]),{code:'55000'});
   for(const action of actions){
    const type={submit:'submitted',approve:'approved',reject:'rejected',issue:'issued'}[action];
    await assert.rejects(db.runtime.query(`INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,reason,submission_key,quotation_number) VALUES($1,$2,$3,$4,$5,$6,$7)`,
     [f.current.versionId,stage==='draft'?1:stage==='pending'?2:3,type,['approve','reject'].includes(action)?s:e,action==='reject'?'Synthetic rejection':null,randomUUID(),action==='issue'?`FQ-${f.current.versionId}`:null]),{code:'55000'});
   }
  });
 }finally{await db.close();}
});

test('terminal API responses preserve auth, CSRF, receipts, historical reads and PDF bytes',async t=>{
 const db=await testDatabase();let app,server;
 try{
  const config={nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:3000',trustProxyHops:0};
  app=createApp(db.runtime,config,{sessionSchema:db.schema,loginLimit:100,quoteLimit:1000});server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`,sessions={};
  const ready=await fetch(base+'/api/health/ready');assert.equal(ready.status,200);assert.equal((await ready.json()).schema,'current');
  for(const role of ['estimator','sales_head']){
   const sessionResponse=await fetch(base+'/api/auth/session'),initial=await sessionResponse.json(),cookie=sessionResponse.headers.get('set-cookie').split(';')[0];
   const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{Cookie:cookie,Origin:config.appOrigin,'Content-Type':'application/json','X-CSRF-Token':initial.csrfToken},body:JSON.stringify({username:role,password:db.passwords[role==='estimator'?'DEMO_ESTIMATOR_PASSWORD':'DEMO_SALES_HEAD_PASSWORD']})});
   assert.equal(r.status,200);sessions[role]={cookie:r.headers.get('set-cookie').split(';')[0],...(await r.json())};
  }
  const post=(role,path,body,key=randomUUID(),csrf=true)=>fetch(base+'/api'+path,{method:'POST',headers:{Cookie:sessions[role].cookie,Origin:config.appOrigin,'Content-Type':'application/json','Idempotency-Key':key,'X-CSRF-Token':csrf?sessions[role].csrfToken:'invalid'},body:JSON.stringify(body)});
  for(const outcome of ['won','lost'])for(const stage of ['draft','pending','approved'])await t.test(`${outcome}/${stage}: HTTP 409 for new work; identical receipts and historical PDFs recover`,async()=>{
   const f=await openFixture(db,stage),path=`/rfqs/${f.rfqId}/quote-versions`;
   const pdfBefore=(await createInternalCostingService(db.runtime,{gstPercent:'18'})(f.e,f.first.versionId)).buffer;
   await recordOutcome(db.runtime,f.s,f.rfqId,randomUUID(),outcome==='won'?{outcome}:{outcome,reason:'Synthetic HTTP closure'});
   const blocked=await post('estimator',path,f.body);assert.equal(blocked.status,409);assert.equal((await blocked.json()).error.code,'RFQ_TERMINAL');
   assert.equal((await post('sales_head',path,f.body)).status,403);assert.equal((await post('estimator',path,f.body,randomUUID(),false)).status,403);
   const actions=stage==='draft'?['submit']:stage==='pending'?['approve','reject']:['issue'];
   for(const action of actions){const r=await post(['approve','reject'].includes(action)?'sales_head':'estimator',`/quote-versions/${f.current.versionId}/${action}`,action==='reject'?{reason:'Synthetic rejection'}:{});assert.equal(r.status,409);assert.equal((await r.json()).error.code,'RFQ_TERMINAL');}
   const receipt=(await db.owner.query('SELECT submission_key FROM draft_submissions WHERE version_id=$1',[f.current.versionId])).rows[0];
   const replay=await post('estimator',path,f.body,receipt.submission_key);assert.equal(replay.status,200);assert.equal((await replay.json()).versionId,f.current.versionId);
   const issued=(await db.owner.query("SELECT submission_key FROM quotation_events WHERE version_id=$1 AND event_type='issued'",[f.first.versionId])).rows[0];
   const issueReplay=await post('estimator',`/quote-versions/${f.first.versionId}/issue`,{},issued.submission_key);assert.equal(issueReplay.status,200);assert.equal((await issueReplay.json()).replayed,true);
   const conflicting=await post('estimator',`/quote-versions/${f.first.versionId}/submit`,{},issued.submission_key);assert.equal(conflicting.status,409);assert.equal((await conflicting.json()).error.code,'SUBMISSION_CONFLICT');
   for(const role of ['estimator','sales_head']){
    for(const read of [`/rfqs/${f.rfqId}`,`/quote-versions/${f.current.versionId}`,`/quote-versions/${f.current.versionId}/lifecycle`])assert.equal((await fetch(base+'/api'+read,{headers:{Cookie:sessions[role].cookie}})).status,200);
    const pdf=await fetch(`${base}/api/quote-versions/${f.first.versionId}/internal-pdf`,{headers:{Cookie:sessions[role].cookie}});assert.equal(pdf.status,200);assert.deepEqual(Buffer.from(await pdf.arrayBuffer()),pdfBefore);
    // Existing customer-PDF eligibility still rejects superseded versions.
    assert.equal((await fetch(`${base}/api/quote-versions/${f.first.versionId}/pdf`,{headers:{Cookie:sessions[role].cookie}})).status,409);
   }
   const unauthorized=await fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f.body)});assert.equal(unauthorized.status,401);
  });
 }finally{if(server)await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
});

test('migration 008 preserves a legacy Won-before-Version-3 history and its PDFs unchanged',async()=>{
 const db=await testDatabase(),schema=`legacy_${randomUUID().replaceAll('-','')}`;let legacy;
 try{
  await db.owner.query(`CREATE SCHEMA ${schema}`);legacy=new pg.Pool({connectionString:db.connectionString,options:`-c search_path=${schema}`});
  for(const name of ['001_initial.sql','002_authentication.sql','003_quotation_snapshots.sql','004_draft_submissions.sql','005_rfq_intake.sql','006_quotation_events.sql','007_final_requirements.sql'])await legacy.query(await readFile(new URL(`../db/migrations/${name}`,import.meta.url),'utf8'));
  await seed(legacy);await seedUsers(legacy,db.passwords);
  const {e,s}=await actors({owner:legacy}),f=await multipartRfq(legacy,1),quotes=createQuotationService(legacy,{gstPercent:'18'}),life=createLifecycleService(legacy),save=createSubmissionService(legacy,{gstPercent:'18'});
  const v1=await save(e,f.rfqId,randomUUID(),f.body);for(const [actor,action]of [[e,'submit'],[s,'approve'],[e,'issue']])await life.act(actor,v1.versionId,action,randomUUID(),{});
  await save(e,f.rfqId,randomUUID(),f.body);
  await legacy.query("INSERT INTO rfq_outcomes(rfq_id,outcome,actor_user_id,submission_key,occurred_at) VALUES($1,'won',$2,$3,'2026-11-05T10:00:00Z')",[f.rfqId,s,randomUUID()]);
  // Model a valid pre-008 historical insert using the original 001-007 SQL
  // contract. The corrected application deliberately cannot create this today.
  const v3=randomUUID(),c=await legacy.connect();
  try{
   await c.query('BEGIN');const h=(await c.query('UPDATE quotations SET next_version=next_version+1 WHERE rfq_id=$1 RETURNING id,next_version-1 AS number',[f.rfqId])).rows[0];
   await c.query(`INSERT INTO quotation_versions(id,quotation_id,version_number,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst,created_at)
    SELECT $1,quotation_id,$2,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst,'2026-11-09T10:00:00Z' FROM quotation_versions WHERE id=$3`,[v3,h.number,v1.versionId]);
   const oldPart=(await c.query('SELECT id FROM quotation_parts WHERE version_id=$1',[v1.versionId])).rows[0].id,newPart=randomUUID();
   await c.query(`INSERT INTO quotation_parts SELECT $1,$2,part_id,routing_revision_id,part_snapshot,routing_snapshot,input_snapshot,annual_value_ex_gst FROM quotation_parts WHERE id=$3`,[newPart,v3,oldPart]);
   for(const table of ['quotation_rates','quotation_part_tiers','quotation_totals']){
    const rows=(await c.query(`SELECT * FROM ${table} WHERE version_id=$1`,[v1.versionId])).rows;
    for(const row of rows){row.version_id=v3;if(Object.hasOwn(row,'quotation_part_id'))row.quotation_part_id=newPart;
     const columns=Object.keys(row);await c.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(row));
    }
   }
   for(const [i,type,actor]of [[1,'submitted',e],[2,'approved',s],[3,'issued',e]])await c.query(`INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,submission_key,quotation_number,occurred_at) VALUES($1,$2,$3,$4,$5,$6,'2026-11-09T11:00:00Z')`,[v3,i,type,actor,randomUUID(),type==='issued'?`FQ-${v3}`:null]);
   await c.query('COMMIT');
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
  const snapshot=await quotes.getDraftVersion(e,v3),status=await life.status(e,v3),history=await getRfq(legacy,f.rfqId);
  const customer=createCustomerQuotationService(legacy,{gstPercent:'18'}),internal=createInternalCostingService(legacy,{gstPercent:'18'}),customerBefore=await customer(e,v3),internalBefore=await internal(e,v3);
  await legacy.query(await readFile(new URL('../db/migrations/008_terminal_rfq_quotation_guards.sql',import.meta.url),'utf8'));
  assert.deepEqual(await quotes.getDraftVersion(e,v3),snapshot);assert.deepEqual(await life.status(e,v3),status);assert.deepEqual(await getRfq(legacy,f.rfqId),history);
  assert.equal(snapshot.versionNumber,'3');assert.equal(status.status,'issued');assert.equal(history.outcomes[0].occurredAt.toISOString(),'2026-11-05T10:00:00.000Z');
  assert.deepEqual((await customer(e,v3)).buffer,customerBefore.buffer);assert.deepEqual((await internal(e,v3)).buffer,internalBefore.buffer);
  await assert.rejects(save(e,f.rfqId,randomUUID(),f.body),{code:'RFQ_TERMINAL'});
 }finally{await legacy?.end();await db.owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await db.close();}
});
