import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {testDatabase} from '../../../tests/helpers/database.js';
import {multipartRfq,multipartTotals} from '../../../tests/helpers/multipart-rfq.js';
import {inspectPdf} from '../../../tests/helpers/pdf.js';
import {createApp} from '../src/app.js';
import {createQuotationService} from '../src/quotations.js';
import {createLifecycleService} from '../src/quotation-lifecycle.js';
import {createCustomerQuotationService} from '../src/customer-quotation.js';
import {fixtureId} from '../src/seed.js';

test('T05 issued customer PDF endpoint with real restricted PostgreSQL and sessions',async t=>{
 const db=await testDatabase(),config={nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:5173',trustProxyHops:0};
 const app=createApp(db.runtime,config,{sessionSchema:db.schema,loginLimit:100}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const users=(await db.owner.query('SELECT id,role FROM users')).rows,estimator=users.find(u=>u.role==='estimator').id,sales=users.find(u=>u.role==='sales_head').id;
 const quotes=createQuotationService(db.runtime,config),lifecycle=createLifecycleService(db.runtime);
 const pdf=createCustomerQuotationService(db.runtime,config);
 const create=async(count=1)=>{const fixture=await multipartRfq(db.owner,count);return {fixture,...await quotes.createDraftVersion(estimator,{rfqId:fixture.rfqId,...fixture.body})};};
 const act=(id,action,who=estimator,body={})=>lifecycle.act(who,id,action,randomUUID(),body);
 const issue=async id=>{await act(id,'submit');await act(id,'approve',sales);await act(id,'issue');};
 function agent(){return {cookie:'',token:'',async request(path,method='GET',body){const response=await fetch(base+path,{method,headers:{Cookie:this.cookie,Origin:config.appOrigin,'X-CSRF-Token':this.token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const c of response.headers.getSetCookie())this.cookie=c.split(';')[0];return response;},async login(username,password){this.token=(await (await this.request('/api/auth/session')).json()).csrfToken;const r=await this.request('/api/auth/login','POST',{username,password});assert.equal(r.status,200);this.token=(await r.json()).csrfToken;}};}
 const e=agent(),s=agent(),a=agent();
 let issued;
 try {
  await e.login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);await s.login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
  await t.test('anonymous, invalid/missing versions and all unissued states cannot download',async()=>{
   assert.equal((await a.request(`/api/quote-versions/${randomUUID()}/pdf`)).status,401);
   assert.equal((await e.request('/api/quote-versions/invalid/pdf')).status,400);
   assert.equal((await e.request(`/api/quote-versions/${randomUUID()}/pdf`)).status,404);
   const draft=await create();
   for(const status of ['draft','pending','approved']) {
    assert.equal((await lifecycle.status(estimator,draft.versionId)).status,status);
    const r=await e.request(`/api/quote-versions/${draft.versionId}/pdf`);assert.equal(r.status,409);assert.equal((await r.json()).error.code,'PDF_NOT_ISSUED');
    if(status==='draft')await act(draft.versionId,'submit');else if(status==='pending')await act(draft.versionId,'approve',sales);
   }
   const rejected=await create();await act(rejected.versionId,'submit');await act(rejected.versionId,'reject',sales,{reason:'Review rejected'});
   assert.equal((await e.request(`/api/quote-versions/${rejected.versionId}/pdf`)).status,409);
  });
  await t.test('both active roles download a correctly bound issued single-part PDF; GET writes no history',async()=>{
   issued=await create();await issue(issued.versionId);
   const before=await quotes.getDraftVersion(estimator,issued.versionId),history=await lifecycle.status(estimator,issued.versionId);
   for(const client of [e,s]) {
    const response=await client.request(`/api/quote-versions/${issued.versionId}/pdf?unitPrice=0&gstPercent=0`);assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('content-disposition'),`attachment; filename="FQ-${issued.versionId}.pdf"`);
    const result=await inspectPdf(Buffer.from(await response.arrayBuffer()));
    for(const value of [issued.versionId,`FQ-${issued.versionId}`,'₹149.70','₹2,69,46,000.00','₹48,50,280.00','₹3,17,96,280.00']) assert.ok(result.text.includes(value),value);
    for(const value of ['Manufacturing','marginPercent','materialInrPerKg','costPerUnit','rateVersionId','₹119.76','₹61.00',before.parts[0].rates.materialInrPerKg.rateVersionId]) assert.ok(!result.text.includes(value),value);
    assert.equal(result.attachments,null);
   }
   assert.deepEqual(await quotes.getDraftVersion(estimator,issued.versionId),before);
   assert.deepEqual(await lifecycle.status(estimator,issued.versionId),history);
  });
  await t.test('three-part PDF preserves every saved scenario, price, quantity and independently specified combined totals',async()=>{
   const multi=await create(3);await issue(multi.versionId);
   const result=await inspectPdf((await pdf(sales,multi.versionId)).buffer);
   for(const row of multipartTotals[3]) for(const value of row) {
    const [whole,fraction]=value.split('.');const money=`₹${whole.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g,',')},${whole.slice(-3)}.${fraction}`;
    assert.ok(result.text.includes(money),money);
   }
   for(const value of ['T03-1-spindle','T03-2-lift arm','T03-3-gear blank','₹150.55','₹149.70','₹149.41','₹1,207.33','₹1,186.11','₹1,179.04','₹458.35','₹453.96','₹452.50']) assert.ok(result.text.includes(value),value);
   assert.ok(result.pages.length>1);
  });
  await t.test('live rates/customer edits/configuration do not alter an issued historical snapshot or its PDF',async()=>{
   const before=await pdf(estimator,issued.versionId),saved=await quotes.getDraftVersion(estimator,issued.versionId);
   const key=saved.parts[0].rates.materialInrPerKg.rateKeyId;
   await db.owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-01','999999')",[randomUUID(),key]);
   await db.owner.query("UPDATE rfqs SET customer_name='Changed live customer' WHERE id=$1",[issued.fixture.rfqId]);
   await db.owner.query("UPDATE rfq_parts SET description='Changed live description' WHERE rfq_id=$1",[issued.fixture.rfqId]);
   const after=await createCustomerQuotationService(db.runtime,{gstPercent:'5'})(estimator,issued.versionId);
   assert.deepEqual(after.buffer,before.buffer);
   assert.deepEqual(await quotes.getDraftVersion(estimator,issued.versionId),saved);
  });
  await t.test('a new version blocks final PDF for the old issued version without mutating its history',async()=>{
   const history=await lifecycle.status(estimator,issued.versionId);
   await quotes.createDraftVersion(estimator,{rfqId:issued.fixture.rfqId,...issued.fixture.body});
   const response=await e.request(`/api/quote-versions/${issued.versionId}/pdf`);assert.equal(response.status,409);assert.equal((await response.json()).error.code,'STALE_QUOTATION');
   const after=await lifecycle.status(estimator,issued.versionId);assert.equal(after.status,'issued');assert.equal(after.stale,true);assert.deepEqual(after.events,history.events);
  });
  await t.test('disabled user cannot use an already authenticated download session',async()=>{
   await db.owner.query('UPDATE users SET active=false WHERE id=$1',[sales]);
   assert.equal((await s.request(`/api/quote-versions/${issued.versionId}/pdf`)).status,401);
  });
 } finally {await new Promise(r=>server.close(r));app.locals.sessionStore.close();await db.close();}
});
