import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {testDatabase} from '../../../tests/helpers/database.js';
import {inspectPdf} from '../../../tests/helpers/pdf.js';
import {addRateVersion,recordOutcome,businessDate} from '../src/final-workflows.js';
import {createQuotationService} from '../src/quotations.js';
import {createLifecycleService} from '../src/quotation-lifecycle.js';
import {createInternalCostingService,renderInternalCosting} from '../src/internal-costing-pdf.js';
import {getRfq,listRfqs} from '../src/rfqs.js';
import {fixtureId} from '../src/seed.js';
import {multipartRfq} from '../../../tests/helpers/multipart-rfq.js';
import {createApp} from '../src/app.js';

test('final requirements: restricted PostgreSQL, HTTP, immutable rates, outcomes and internal PDFs',async t=>{
 const db=await testDatabase();let app,server;
 try {
  const users=(await db.owner.query('SELECT id,role FROM users')).rows;
  const e=users.find(u=>u.role==='estimator').id,s=users.find(u=>u.role==='sales_head').id;
  const quotes=createQuotationService(db.runtime,{gstPercent:'18'}),life=createLifecycleService(db.runtime);
  const request={rfqId:fixtureId(21),pricingDate:businessDate(),parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20'}]};
  const first=await quotes.createDraftVersion(e,request),saved=await quotes.getDraftVersion(e,first.versionId);
  const body={value:'200.123456',effectiveFrom:businessDate(),reason:'Synthetic supplier revision'};
  await t.test('authoring rejects role, malformed decimals, excess precision, missing reasons, dates and unknown keys',async()=>{
   await assert.rejects(addRateVersion(db.runtime,e,fixtureId(1),randomUUID(),body),{code:'ROLE_FORBIDDEN'});
   for(const value of [1,'1.1234567','-1','NaN','Infinity','1e2','01','1000000000000'])await assert.rejects(addRateVersion(db.runtime,s,fixtureId(1),randomUUID(),{...body,value}),{code:'INVALID_QUOTATION_INPUT'});
   for(const reason of ['', '  ', 'x\n', 'x'.repeat(1001)])await assert.rejects(addRateVersion(db.runtime,s,fixtureId(1),randomUUID(),{...body,reason}),{code:'INVALID_QUOTATION_INPUT'});
   await assert.rejects(addRateVersion(db.runtime,s,fixtureId(1),randomUUID(),{...body,effectiveFrom:'2026-02-30'}),{code:'INVALID_QUOTATION_INPUT'});
   await assert.rejects(addRateVersion(db.runtime,s,fixtureId(1),randomUUID(),{...body,effectiveFrom:'2000-01-01'}),{code:'RATE_DATE_CONFLICT'});
   await assert.rejects(addRateVersion(db.runtime,s,randomUUID(),randomUUID(),body),{code:'RATE_KEY_NOT_FOUND'});
  });
  await t.test('concurrent same-key retries create one exact authored version and reject changed intent/duplicate starts',async()=>{
   const key=randomUUID(),results=await Promise.all(Array.from({length:6},()=>addRateVersion(db.runtime,s,fixtureId(1),key,body)));
   assert.equal(results.filter(r=>!r.replayed).length,1);assert.equal(new Set(results.map(r=>r.rateVersionId)).size,1);
   await assert.rejects(addRateVersion(db.runtime,s,fixtureId(1),key,{...body,value:'201'}),{code:'SUBMISSION_CONFLICT'});
   await assert.rejects(addRateVersion(db.runtime,s,fixtureId(1),randomUUID(),body),{code:'RATE_DATE_CONFLICT'});
   const row=(await db.owner.query('SELECT value,reason,actor_user_id FROM rate_versions WHERE id=$1',[results[0].rateVersionId])).rows[0];
   assert.deepEqual(row,{value:'200.123456',reason:body.reason,actor_user_id:s});
   const races=await Promise.allSettled([1,2].map(()=>addRateVersion(db.runtime,s,fixtureId(2),randomUUID(),{...body,effectiveFrom:'2099-01-01'})));
   assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(races.find(r=>r.status==='rejected').reason.code,'RATE_DATE_CONFLICT');
   await assert.rejects(addRateVersion(db.runtime,s,fixtureId(2),randomUUID(),{...body,effectiveFrom:'2098-12-31'}),{code:'RATE_DATE_CONFLICT'});
  });
  await t.test('narrow INSERT grants prevent value/timestamp injection; SQL guard validates raw precision and active author',async()=>{
   for(const sql of ['UPDATE rate_versions SET value=0','DELETE FROM rate_versions','TRUNCATE rate_versions'])await assert.rejects(db.runtime.query(sql),{code:'42501'});
   await assert.rejects(db.runtime.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2099-02-01',1)",[randomUUID(),fixtureId(1)]),{code:'42501'});
   for(const [actor,value,code] of [[e,'1','42501'],[s,'1.1234567','23514']])await assert.rejects(db.runtime.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,raw_value,actor_user_id,reason,submission_key) VALUES ($1,$2,'2099-02-01',$3,$4,'SQL guard test',$5)",[randomUUID(),fixtureId(1),value,actor,randomUUID()]),{code});
   await assert.rejects(db.runtime.query("INSERT INTO rate_versions(id,rate_key_id,effective_from) VALUES ($1,$2,'2099-02-01')",[randomUUID(),fixtureId(1)]),{code:'42501'});
   for(const sql of ['UPDATE rate_versions SET value=0','DELETE FROM rate_versions','TRUNCATE rate_versions CASCADE'])await assert.rejects(db.owner.query(sql),{code:'55000'});
  });
  await t.test('new calculation selects authored rate; saved snapshot and financial golden remain unchanged',async()=>{
   const next=await quotes.createDraftVersion(e,request),current=await quotes.getDraftVersion(e,next.versionId);
   assert.equal(current.parts[0].rates.materialInrPerKg.value,'200.123456');
   assert.deepEqual(await quotes.getDraftVersion(e,first.versionId),saved);
   assert.equal(saved.parts[0].result.tiers[1].costPerUnit,'119.76');
   assert.equal(saved.parts[0].result.tiers[1].sellingPricePerUnitExGst,'149.70');
   request.currentId=next.versionId;
  });
  await t.test('sent derives from issuance; only Sales Head records a single attributed terminal outcome',async()=>{
   assert.equal((await getRfq(db.runtime,fixtureId(21))).status,'estimating');
   await assert.rejects(recordOutcome(db.runtime,s,fixtureId(21),randomUUID(),{outcome:'won'}),{code:'RFQ_OUTCOME_CONFLICT'});
   await assert.rejects(recordOutcome(db.runtime,e,fixtureId(21),randomUUID(),{outcome:'won'}),{code:'ROLE_FORBIDDEN'});
   await assert.rejects(recordOutcome(db.runtime,s,fixtureId(21),randomUUID(),{outcome:'lost',reason:' '}),{code:'INVALID_QUOTATION_INPUT'});
   await life.act(e,request.currentId,'submit',randomUUID(),{});await life.act(s,request.currentId,'approve',randomUUID(),{});
   assert.equal((await getRfq(db.runtime,fixtureId(21))).status,'estimating');
   await life.act(e,request.currentId,'issue',randomUUID(),{});
   assert.equal((await listRfqs(db.runtime))[0].status,'sent');
   const key=randomUUID(),body={outcome:'lost',reason:'Synthetic competitor selected'};
   const results=await Promise.all([1,2,3].map(()=>recordOutcome(db.runtime,s,fixtureId(21),key,body)));
   assert.equal(results.filter(r=>!r.replayed).length,1);
   await assert.rejects(recordOutcome(db.runtime,s,fixtureId(21),key,{outcome:'won'}),{code:'SUBMISSION_CONFLICT'});
   await assert.rejects(recordOutcome(db.runtime,s,fixtureId(21),randomUUID(),{outcome:'won'}),{code:'RFQ_OUTCOME_CONFLICT'});
   const rfq=await getRfq(db.runtime,fixtureId(21));assert.equal(rfq.status,'lost');assert.equal(rfq.outcomes[0].actorId,s);assert.equal(rfq.outcomes[0].reason,body.reason);assert.ok(rfq.assignedEstimator);
   for(const sql of ['UPDATE rfq_outcomes SET outcome=\'won\'','DELETE FROM rfq_outcomes','TRUNCATE rfq_outcomes'])await assert.rejects(db.owner.query(sql),{code:'55000'});
  });
  await t.test('historical internal PDF uses saved costs, rate IDs, dates, margins, quantities and totals; all pages render within bounds',async()=>{
   const pdf=createInternalCostingService(db.runtime,{gstPercent:'5'});
   const original=await renderInternalCosting(saved);
   for(const actor of [e,s]) {
    const result=await pdf(actor,first.versionId),content=await inspectPdf(result.buffer);
    assert.deepEqual(result.buffer,original);
    for(const value of ['INTERNAL / CONFIDENTIAL','Material / unit','Margin (%)','20','2026-11-02','₹119.76','₹149.70','₹2,69,46,000.00','₹48,50,280.00','₹3,17,96,280.00',saved.formulaVersion,saved.parts[0].rates.materialInrPerKg.rateVersionId])assert.ok(content.text.includes(value),value);
    assert.ok(content.pages.length>=3);assert.equal(content.attachments,null);
    for(const [i,page] of content.pages.entries()) {
     assert.ok(page.text.includes(`Page ${i+1} of ${content.pages.length}`));assert.ok(page.text.includes('INTERNAL / CONFIDENTIAL'));
     for(const item of page.items) {assert.ok(item.transform[4]>=40 && item.transform[4]+item.width<555,item.str);assert.ok(item.transform[5]>25 && item.transform[5]<815,item.str);}
    }
    await mkdir('.tmp/final-pdf',{recursive:true});await writeFile('.tmp/final-pdf/internal.pdf',result.buffer);
   }
   const invalid=structuredClone(saved);delete invalid.parts[0].rates.materialInrPerKg;await assert.rejects(renderInternalCosting(invalid),{code:'PDF_INVALID_SNAPSHOT'});
   const long=structuredClone(saved);long.parts=Array.from({length:20},(_,i)=>({...structuredClone(saved.parts[0]),part:{...saved.parts[0].part,part_number:`LONG-${i}-`+'X'.repeat(70),description:'Synthetic component '.repeat(25)}}));
   const content=await inspectPdf(await renderInternalCosting(long));assert.ok(content.pages.length>20);assert.ok(content.pages.length<=100);assert.ok(content.text.includes('LONG-19-'));
  });
  await t.test('won is terminal; concurrent distinct won/lost requests permit exactly one outcome',async()=>{
   const fixture=await multipartRfq(db.owner,1),v=await quotes.createDraftVersion(e,{rfqId:fixture.rfqId,...fixture.body});
   await life.act(e,v.versionId,'submit',randomUUID(),{});await life.act(s,v.versionId,'approve',randomUUID(),{});await life.act(e,v.versionId,'issue',randomUUID(),{});
   await recordOutcome(db.runtime,s,fixture.rfqId,randomUUID(),{outcome:'won'});
   assert.equal((await getRfq(db.runtime,fixture.rfqId)).status,'won');
   await assert.rejects(recordOutcome(db.runtime,s,fixture.rfqId,randomUUID(),{outcome:'lost',reason:'Late change'}),{code:'RFQ_OUTCOME_CONFLICT'});
   const other=await multipartRfq(db.owner,1),w=await quotes.createDraftVersion(e,{rfqId:other.rfqId,...other.body});
   await life.act(e,w.versionId,'submit',randomUUID(),{});await life.act(s,w.versionId,'approve',randomUUID(),{});await life.act(e,w.versionId,'issue',randomUUID(),{});
   const result=await Promise.allSettled([{outcome:'won'},{outcome:'lost',reason:'Concurrent alternative'}].map(body=>recordOutcome(db.runtime,s,other.rfqId,randomUUID(),body)));
   assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.find(r=>r.status==='rejected').reason.code,'RFQ_OUTCOME_CONFLICT');
  });
  await t.test('HTTP enforces sessions, CSRF, roles and exact attachment endpoint for both roles',async()=>{
   const config={nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:5173',trustProxyHops:0};
   app=createApp(db.runtime,config,{sessionSchema:db.schema});server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
   const path=`/api/quote-versions/${first.versionId}/internal-pdf`;
   assert.equal((await fetch(base+path)).status,401);
   for(const [role,password] of [['estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD],['sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD]]) {
    const init=await fetch(base+'/api/auth/session'),session=await init.json();let cookie=init.headers.getSetCookie()[0].split(';')[0];
    const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Cookie:cookie,Origin:config.appOrigin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'},body:JSON.stringify({username:role,password})});
    cookie=login.headers.getSetCookie()[0].split(';')[0];const auth=await login.json();assert.equal(login.status,200);
    const r=await fetch(base+path,{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(r.headers.get('content-disposition'),/INTERNAL-/);await r.arrayBuffer();
    const headers={Cookie:cookie,Origin:config.appOrigin,'X-CSRF-Token':auth.csrfToken,'Content-Type':'application/json','Idempotency-Key':randomUUID()};
    const ratePath=`/api/rates/${fixtureId(3)}/versions`;
    assert.equal((await fetch(base+ratePath,{method:'POST',headers:{...headers,'X-CSRF-Token':'bad'},body:JSON.stringify(body)})).status,403);
    assert.equal((await fetch(base+ratePath,{method:'POST',headers,body:JSON.stringify(body)})).status,role==='sales_head'?201:403);
    assert.equal((await fetch(base+`/api/rfqs/${fixtureId(21)}/outcomes`,{method:'POST',headers,body:JSON.stringify({outcome:'won'})})).status,role==='sales_head'?409:403);
   }
   await db.owner.query('UPDATE users SET active=false WHERE id=$1',[s]);await assert.rejects(addRateVersion(db.runtime,s,fixtureId(4),randomUUID(),body),{code:'AUTH_REQUIRED'});
  });
 }finally{if(server)await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
});
