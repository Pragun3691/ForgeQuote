import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {browserTestDatabase} from './helpers/database.js';
import {multipartRfq} from './helpers/multipart-rfq.js';
import {createSubmissionService} from '../apps/api/src/draft-submissions.js';
import {createLifecycleService} from '../apps/api/src/quotation-lifecycle.js';
import {recordOutcome} from '../apps/api/src/final-workflows.js';
import {inspectPdf} from './helpers/pdf.js';

const db=await browserTestDatabase(),directory='.tmp/terminal-rfq';
let app,browser;const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;await mkdir(directory,{recursive:true});
try{
 const users=(await db.owner.query('SELECT id,role FROM users')).rows,e=users.find(u=>u.role==='estimator').id,s=users.find(u=>u.role==='sales_head').id;
 const save=createSubmissionService(db.runtime,{gstPercent:'18'}),life=createLifecycleService(db.runtime);
 app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,loginLimit:100,quoteLimit:1000});
 browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],results=[];
 async function login(role){
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.getByLabel('Account').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(db.passwords[role==='estimator'?'DEMO_ESTIMATOR_PASSWORD':'DEMO_SALES_HEAD_PASSWORD']);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Refresh RFQs',exact:true}).waitFor();return page;
 }
 const estimator=await login('estimator'),sales=await login('sales_head');
 async function open(page,f,version=f.current.versionId){await page.goto(`${origin}/#rfq=${f.rfqId}&version=${version}`);await page.getByRole('region',{name:'Quotation lifecycle'}).getByRole('status').filter({hasText:'Quotation status:'}).waitFor();}
 async function capture(page,name,selector){
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:width===768?1024:width<400?844:1000});
   await page.locator(selector).first().evaluate(el=>{
    if(el.closest('[role="dialog"]'))return;
    const shell=el.closest('.authenticated-shell'),offset=parseFloat(shell?getComputedStyle(shell).getPropertyValue('--shell-offset'):'0')||0;
    window.scrollTo({top:scrollY+el.getBoundingClientRect().top-offset-16,behavior:'instant'});
   });
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: overflow at ${width}`);await page.screenshot({path:`${directory}/${name}-${width}.png`});
  }await page.setViewportSize({width:1440,height:1000});
 }
 async function fixture(stage){
  const f=await multipartRfq(db.owner,1),first=await save(e,f.rfqId,randomUUID(),f.body);
  for(const [who,action]of [[e,'submit'],[s,'approve'],[e,'issue']])await life.act(who,first.versionId,action,randomUUID(),{});
  const key=randomUUID(),current=await save(e,f.rfqId,key,f.body);
  if(stage!=='draft')await life.act(e,current.versionId,'submit',randomUUID(),{});
  if(stage==='approved')await life.act(s,current.versionId,'approve',randomUUID(),{});
  return {...f,first,current,key};
 }
 for(const outcome of ['won','lost'])for(const stage of ['draft','pending','approved']){
  const f=await fixture(stage);await open(estimator,f);await open(sales,f);
  let staleReview,staleIssue;
  if(stage==='pending'){staleReview=await login('sales_head');await open(staleReview,f);await staleReview.getByLabel('Rejection reason',{exact:true}).fill('Retained stale-session rejection');}
  if(stage==='approved'){staleIssue=await login('estimator');await open(staleIssue,f);}
  await estimator.getByLabel('Gross margin (%)',{exact:true}).fill('21');
  if(stage==='pending'){
   await sales.getByLabel('Rejection reason',{exact:true}).fill('Retained synthetic review');
   assert.equal(await sales.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true);
  }
  if(outcome==='lost')await sales.getByLabel('Lost reason',{exact:true}).fill('Synthetic outcome review');
  await sales.getByRole('button',{name:`Mark RFQ ${outcome}`,exact:true}).click();
  const dialog=sales.getByRole('dialog',{name:`Mark RFQ ${outcome}?`});await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes(`Version 2 (${stage})`));assert.ok((await dialog.innerText()).includes('no new versions, submission, approval, rejection or issuance'));
  if(outcome==='won'&&stage==='pending')await capture(sales,'closure-review','.decision-dialog');
  await sales.keyboard.press('Escape');assert.equal(await sales.getByRole('button',{name:`Mark RFQ ${outcome}`,exact:true}).evaluate(el=>el===document.activeElement),true);
  await sales.getByRole('button',{name:`Mark RFQ ${outcome}`,exact:true}).click();await sales.getByRole('button',{name:`Confirm ${outcome}`,exact:true}).click();
  await sales.getByRole('status').filter({hasText:`RFQ closed: ${outcome}.`}).waitFor();
  assert.equal(await sales.getByRole('button',{name:/^(Approve version|Reject version)$/}).count(),0);
  assert.equal(await sales.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),false,'Confirmed closure makes retained rejection/outcome drafts inapplicable');
  if(staleReview){
   const action=outcome==='won'?'approve':'reject',label=action==='approve'?'Approve version':'Reject version';
   await staleReview.getByRole('button',{name:label,exact:true}).click();
   const reply=staleReview.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/'+action));await staleReview.getByRole('button',{name:action==='approve'?'Confirm approval':'Confirm rejection',exact:true}).click();
   assert.equal((await reply).status(),409);await staleReview.getByRole('status').filter({hasText:`RFQ closed: ${outcome}.`}).waitFor();
   assert.equal(await staleReview.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),false);await staleReview.close();
  }
  if(staleIssue){
   await staleIssue.getByRole('button',{name:'Issue quotation',exact:true}).click();const reply=staleIssue.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/issue'));
   await staleIssue.getByRole('button',{name:'Confirm issuance',exact:true}).click();assert.equal((await reply).status(),409);await staleIssue.getByRole('status').filter({hasText:`RFQ closed: ${outcome}.`}).waitFor();await staleIssue.close();
  }
  // An already-open Estimator tab still attempts its actual old action. The
  // server must reject it, and the UI must preserve its inputs without uncertainty.
  const response=estimator.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith(`/rfqs/${f.rfqId}/quote-versions`));
  await estimator.getByRole('button',{name:'Calculate & save draft',exact:true}).click();const r=await response;assert.equal(r.status(),409);assert.equal((await r.json()).error.code,'RFQ_TERMINAL');
  await estimator.getByRole('status').filter({hasText:`RFQ closed: ${outcome}.`}).waitFor();
  assert.equal(await estimator.getByLabel('Gross margin (%)',{exact:true}).inputValue(),'21');assert.equal(await estimator.getByLabel('Gross margin (%)',{exact:true}).isDisabled(),true);
  assert.equal(await estimator.getByRole('button',{name:'Calculate & save draft',exact:true}).isDisabled(),true);assert.equal(await estimator.getByRole('button',{name:'Start new calculation',exact:true}).isDisabled(),true);
  assert.equal(await estimator.getByRole('button',{name:'Issue quotation',exact:true}).count(),0);
  assert.equal(await estimator.getByRole('button',{name:'Submit for clearance',exact:true}).count(),0);
  assert.equal((await db.owner.query('SELECT next_version FROM quotations WHERE rfq_id=$1',[f.rfqId])).rows[0].next_version,'3');
  if(outcome==='won'&&stage==='approved'){
   const issued=(await db.owner.query("SELECT submission_key FROM quotation_events WHERE version_id=$1 AND event_type='issued'",[f.first.versionId])).rows[0];
   await estimator.evaluate(({e,f,key})=>sessionStorage.setItem(`forgequote:lifecycle:${e}:${f.first.versionId}`,JSON.stringify({action:'issue',key,body:{}})),{e,f,key:issued.submission_key});
   await open(estimator,f,f.first.versionId);await estimator.getByRole('button',{name:'Retry same lifecycle action',exact:true}).click();await estimator.getByRole('status').filter({hasText:'Saved lifecycle result recovered.'}).waitFor();
  }
  if(outcome==='won'&&stage==='pending'){
   await capture(estimator,'closed-overview','.costing-workspace');
   await capture(estimator,'closed-estimator','.costing-form');
  }
  if(outcome==='lost'&&stage==='approved')await capture(sales,'closed-sales','.lifecycle');
  // Reopen with an exact committed request whose response was lost. Recovery
  // stays available after closure and never creates a new version.
  await estimator.evaluate(({e,f})=>sessionStorage.setItem(`forgequote:submission:${e}:${f.rfqId}`,JSON.stringify({submissionKey:f.key,body:f.body,phase:'uncertain'})),{e,f});
  await estimator.reload();await open(estimator,f);await estimator.getByRole('button',{name:'Retry same submission',exact:true}).click();await estimator.getByRole('status').filter({hasText:'Saved draft recovered.'}).waitFor();
  assert.equal((await db.owner.query('SELECT next_version FROM quotations WHERE rfq_id=$1',[f.rfqId])).rows[0].next_version,'3');
  await sales.goto(origin+'/#');await sales.getByRole('button',{name:'Refresh pending approvals',exact:true}).click();await sales.getByRole('status').filter({hasText:/of \d+ pending approvals/}).waitFor();
  assert.ok(!(await sales.getByRole('table',{name:'Pending approvals'}).count())||!(await sales.getByRole('table',{name:'Pending approvals'}).innerText()).includes((await db.owner.query('SELECT reference FROM rfqs WHERE id=$1',[f.rfqId])).rows[0].reference));
  results.push({outcome,stage,staleSaveStatus:409,replayed:true});
 }
 // Current issued history retains both PDF download actions after closure.
 const f=await multipartRfq(db.owner,1),version=await save(e,f.rfqId,randomUUID(),f.body);
 for(const [who,action]of [[e,'submit'],[s,'approve'],[e,'issue']])await life.act(who,version.versionId,action,randomUUID(),{});
 await recordOutcome(db.runtime,s,f.rfqId,randomUUID(),{outcome:'won'});
 for(const [role,page]of [['estimator',estimator],['sales',sales]]){
  await open(page,{...f,current:version});
  for(const kind of ['customer','internal']){
   const waiting=page.waitForEvent('download');await page.getByRole('button',{name:kind==='customer'?'Download customer PDF':'Download INTERNAL costing PDF',exact:true}).click();const download=await waiting;assert.equal(await download.failure(),null);const path=`${directory}/${role}-${kind}.pdf`;await download.saveAs(path);const pdf=await inspectPdf(await readFile(path));assert.ok(pdf.text.includes('149.70'));assert.ok(pdf.text.includes('ForgeQuote'));
  }
  await capture(page,`closed-${role}-documents`,'.pdf-downloads');
 }
 assert.deepEqual(errors,[]);await writeFile(`${directory}/results.json`,JSON.stringify({passed:true,cases:results,viewports:[1440,768,390,320],pdfs:4},null,2));
 console.log('PASS terminal RFQ: Won/Lost x draft/pending/approved, closure warning/cancel/focus, stale-tab 409, read-only retained inputs, closed approval queue, exact committed replay, both-role historical PDFs and four responsive widths.');
}finally{await browser?.close();await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
