import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {browserTestDatabase} from './helpers/database.js';
import {fixtureId} from '../apps/api/src/seed.js';
import {createQuotationService} from '../apps/api/src/quotations.js';

const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
const directory=`.tmp/m1/${process.env.M1_STAGE||'after'}`;await mkdir(directory,{recursive:true});
const results=[];
try {
 app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,loginLimit:100});
 const estimator=(await db.owner.query("SELECT id FROM users WHERE role='estimator'")).rows[0].id;
 const secondRoute=randomUUID();await db.owner.query('INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) VALUES($1,$2,2,$3,3.2,12)',[secondRoute,fixtureId(22),fixtureId(2)]);
 const quote=await createQuotationService(db.runtime,{gstPercent:'18'}).createDraftVersion(estimator,{rfqId:fixtureId(21),pricingDate:'2026-11-02',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20'}]});
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 async function capture(page,name){for(const width of [1440,768,390]){await page.setViewportSize({width,height:width===1440?1000:width===768?1024:844});if(name==='authoring-preserved')await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).scrollIntoViewIfNeeded();if(name==='lifecycle-recovered')await page.getByRole('region',{name:'Quotation lifecycle',exact:true}).scrollIntoViewIfNeeded();if(name==='costing-return')await page.locator('.costing-form').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: overflow ${width}`);await page.screenshot({path:`${directory}/${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});}
 async function run(name,role,work){if(process.env.M1_CASE&&process.env.M1_CASE!==name)return;const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.name));try{await page.goto(origin);await page.getByLabel('Account').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(db.passwords[role==='estimator'?'DEMO_ESTIMATOR_PASSWORD':'DEMO_SALES_HEAD_PASSWORD']);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:`Signed in as ${role}`,exact:true}).waitFor();await work(page);assert.deepEqual(errors,[]);results.push({name,passed:true});console.log(`PASS M1: ${name}`);}catch(e){await page.screenshot({path:`${directory}/${name}-failure.png`,fullPage:true});results.push({name,passed:false,error:e.message});console.log(`FAIL M1: ${name}: ${e.message.slice(0,350)}`);}finally{await context.close();}}
 const nav=page=>page.getByRole('navigation',{name:'Workspace navigation'});
 const open=async page=>{await page.goto(`${origin}/#rfq=${fixtureId(21)}&version=${quote.versionId}`);await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();};
 await run('costing-draft','estimator',async page=>{
  await open(page);const input=label=>page.getByLabel(label,{exact:true});
  for(const [label,value]of [['Pricing date','2026-11-03'],['Gross margin (%)','17.25'],['50% annual quantity','123'],['100% annual quantity','246'],['150% annual quantity','369']])await input(label).fill(value);
  await page.getByRole('combobox',{name:/^Routing revision/}).selectOption(fixtureId(23));const stored=await page.evaluate(()=>JSON.stringify(sessionStorage));let writes=0;page.on('request',r=>{if(r.method()==='POST')writes++;});
  await nav(page).getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();await page.goBack();await input('Gross margin (%)').waitFor();
  await capture(page,'costing-return');assert.equal(await input('Gross margin (%)').inputValue(),'17.25');assert.equal(await input('Pricing date').inputValue(),'2026-11-03');assert.equal(await input('100% annual quantity').inputValue(),'246');assert.equal(await page.getByRole('combobox',{name:/^Routing revision/}).inputValue(),fixtureId(23));assert.equal(await page.evaluate(()=>JSON.stringify(sessionStorage)),stored);assert.equal(writes,0);
  assert.equal(await input('50% annual quantity').inputValue(),'123');assert.equal(await input('150% annual quantity').inputValue(),'369');
  assert.equal(await page.getByTestId('baseline-price').innerText(),'₹149.70');
 });
 await run('intake-draft','estimator',async page=>{
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();await page.getByLabel('RFQ reference',{exact:true}).fill('SYNTH-M1-UNSAVED');await page.getByLabel('Customer name',{exact:true}).fill('Synthetic M1 Customer');await page.getByRole('button',{name:'Add part',exact:true}).click();await page.getByRole('group',{name:'Part 2',exact:true}).getByLabel('Part number',{exact:true}).fill('M1-PART-2');
  await page.getByText('Extract from text with AI (optional)',{exact:true}).click();await page.getByLabel('Synthetic RFQ email or plain text',{exact:true}).fill('Synthetic unsaved source; do not send.');
  await page.getByRole('link',{name:'Open RFQ',exact:true}).click();await page.getByLabel('Pricing date').waitFor();await nav(page).getByRole('link',{name:'RFQs',exact:true}).click();await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  await capture(page,'intake-return');assert.equal(await page.getByLabel('RFQ reference',{exact:true}).inputValue(),'SYNTH-M1-UNSAVED');assert.equal(await page.getByRole('group',{name:'Part 2',exact:true}).getByLabel('Part number',{exact:true}).inputValue(),'M1-PART-2');
  assert.equal(await page.getByLabel('Synthetic RFQ email or plain text',{exact:true}).inputValue(),'Synthetic unsaved source; do not send.');
  assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true);
  await page.goBack();await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor();await page.goForward();await page.getByRole('heading',{name:'Create manual RFQ',exact:true}).waitFor();assert.equal(await page.getByLabel('Customer name',{exact:true}).inputValue(),'Synthetic M1 Customer');
 });
 await run('navigation','estimator',async page=>{
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();await nav(page).getByRole('link',{name:'RFQs',exact:true}).focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Create manual RFQ',exact:true}).count(),0);
  await page.goBack();await page.getByRole('heading',{name:'Create manual RFQ',exact:true}).waitFor();await page.goForward();await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor();
  assert.equal(await nav(page).getByRole('link',{name:'RFQs',exact:true}).getAttribute('aria-current'),'page');
 });
 await run('lifecycle-read','estimator',async page=>{
  await open(page);const life=page.getByRole('region',{name:'Quotation lifecycle',exact:true});await life.getByRole('status').filter({hasText:'Quotation status:'}).waitFor();await page.route('**/api/quote-versions/*/lifecycle',route=>route.abort());await life.getByRole('button',{name:'Refresh lifecycle',exact:true}).click();await life.getByRole('alert').waitFor();await page.unroute('**/api/quote-versions/*/lifecycle');
  const response=page.waitForResponse(r=>r.url().endsWith('/lifecycle'));await life.getByRole('button',{name:'Refresh lifecycle',exact:true}).click();assert.equal((await response).status(),200);await page.waitForTimeout(100);await capture(page,'lifecycle-recovered');assert.equal(await life.getByRole('alert').count(),0);
 });
 await run('manual-fallback','estimator',async page=>{
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  for(const [summary,message]of [['Extract from text with AI (optional)','Continue with the editable manual fields below. Extraction does not save an RFQ.'],['Import Excel part list (optional)','Continue with the manual form. No RFQ was saved by import.'],['Import Excel part list (optional)','Continue with the manual form. No RFQ was saved by import.']]){await page.getByText(summary,{exact:true}).click();await page.getByRole('button',{name:'Continue manually',exact:true}).click();assert.equal(await page.getByText(message,{exact:true}).isVisible(),true);assert.equal(await page.getByLabel('RFQ reference',{exact:true}).evaluate(el=>el===document.activeElement),true);}
  await capture(page,'manual-fallback');
 });
 await run('authoring-refresh','sales_head',async page=>{
  await nav(page).getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();await page.getByLabel('Rate key',{exact:true}).selectOption(fixtureId(1));await page.getByLabel('New decimal value',{exact:true}).fill('123.456789');await page.getByLabel('Rate change reason',{exact:true}).fill('Synthetic unsaved authoring');
  let release,reached,finished;const held=new Promise(resolve=>release=resolve),arrived=new Promise(resolve=>reached=resolve),done=new Promise(resolve=>finished=resolve);await page.route('**/api/rates',async route=>{const response=await route.fetch();reached();await held;await route.fulfill({response}).catch(()=>{});finished();});await page.getByRole('button',{name:'Refresh rates',exact:true}).click();await arrived;assert.equal(await page.getByLabel('New decimal value',{exact:true}).inputValue(),'123.456789');release();await done;await page.unroute('**/api/rates');
  await nav(page).getByRole('link',{name:'RFQs',exact:true}).click();await nav(page).getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();await capture(page,'authoring-preserved');assert.equal(await page.getByLabel('Rate change reason',{exact:true}).inputValue(),'Synthetic unsaved authoring');
 });
 await run('dependent-register','sales_head',async page=>{
  await nav(page).getByRole('link',{name:'Approvals',exact:true}).click();assert.equal(await nav(page).getByRole('link',{name:'Approvals',exact:true}).getAttribute('aria-current'),'page');await page.getByRole('link',{name:'Open RFQ',exact:true}).click();await page.getByRole('heading',{name:'RFQ-2611-014',exact:true}).waitFor();
  // Another actor changes only the disposable fixture; return navigation must reread.
  await db.owner.query("UPDATE rfqs SET owner_label='Synthetic refreshed assignment' WHERE id=$1",[fixtureId(21)]);
  await nav(page).getByRole('link',{name:'RFQs',exact:true}).click();await page.getByRole('table',{name:'RFQ register',exact:true}).getByText('Synthetic refreshed assignment',{exact:true}).waitFor();
 });
 await run('stale-rate-read','sales_head',async page=>{
  await nav(page).getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();await page.getByLabel('New decimal value',{exact:true}).fill('77.000001');
  let release,reached;const held=new Promise(resolve=>release=resolve),arrived=new Promise(resolve=>reached=resolve);const pattern='**/api/rates?asOf=2026-11-01';
  await page.route(pattern,async route=>{const response=await route.fetch();reached();await held;await route.fulfill({response}).catch(()=>{});});
  await page.getByLabel('Rates as of',{exact:true}).fill('2026-11-01');await arrived;await page.getByLabel('Rates as of',{exact:true}).fill('2026-11-03');await page.getByText('Applicable on 03 Nov 2026 (Asia/Kolkata). Starts inclusive; ends exclusive.',{exact:true}).waitFor();release();await page.waitForTimeout(100);
  assert.equal(await page.getByLabel('New decimal value',{exact:true}).inputValue(),'77.000001');assert.equal(await page.getByText('Applicable on 01 Nov 2026 (Asia/Kolkata). Starts inclusive; ends exclusive.',{exact:true}).count(),0);
 });
 await run('identity-scope','estimator',async page=>{
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();await page.getByLabel('RFQ reference',{exact:true}).fill('SYNTH-PRIVATE-UNSENT');await page.getByRole('button',{name:'Sign out',exact:true}).click();
  async function signIn(role){await page.getByLabel('Account').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(db.passwords[role==='estimator'?'DEMO_ESTIMATOR_PASSWORD':'DEMO_SALES_HEAD_PASSWORD']);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:`Signed in as ${role}`,exact:true}).waitFor();}
  await signIn('sales_head');assert.equal(await page.getByRole('heading',{name:'Create manual RFQ',exact:true}).count(),0);assert.equal(await nav(page).getByRole('link',{name:'Rate catalogue',exact:true}).getAttribute('target'),null);
  await nav(page).getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();await nav(page).getByRole('link',{name:'Approvals',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await signIn('estimator');assert.equal(await nav(page).getByRole('link',{name:'RFQs',exact:true}).getAttribute('aria-current'),'page');await page.getByRole('button',{name:'New RFQ',exact:true}).click();assert.equal(await page.getByLabel('RFQ reference',{exact:true}).inputValue(),'');
 });
 await run('read-error-scope','estimator',async page=>{
  const pattern=`**/api/quote-versions/${quote.versionId}`;await page.route(pattern,route=>route.abort());await page.goto(`${origin}/#rfq=${fixtureId(21)}&version=${quote.versionId}`);
  const failure=page.getByRole('alert').filter({hasText:'Unable to load the saved quotation.'});await failure.waitFor();
  const metadata=page.waitForResponse(r=>r.url().endsWith(`/api/rfqs/${fixtureId(21)}`));await page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();const response=await metadata;assert.equal(response.status(),200);await response.finished();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await failure.isVisible(),true);
  await page.unroute(pattern);await page.getByRole('button',{name:'Reload saved quotation',exact:true}).click();await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();assert.equal(await failure.count(),0);
 });
 // F2: real saves and immutable snapshots, with only read completion order/failures controlled.
 const rfqPattern=`**/api/rfqs/${fixtureId(21)}`;
 const obsoleteRefresh='Draft saved, but the RFQ version list could not be refreshed. Reload to view it.';
 const metadataFailure='Unable to load this RFQ. Please retry.';
 const settled=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const failRead=(route,status=503)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{code:status===401?'AUTH_REQUIRED':'DATABASE_UNAVAILABLE',message:'Synthetic read failure'}})});
 async function holdMetadata(page,status=200){
  let release,reached,finished,request,captured=false;
  const gate=new Promise(resolve=>release=resolve),arrived=new Promise(resolve=>reached=resolve),done=new Promise(resolve=>finished=resolve);
  const handler=async route=>{
   if(captured)return route.continue();captured=true;request=route.request();
   const response=status===200?await route.fetch():null;reached();await gate;
   try{if(response)await route.fulfill({response});else await failRead(route,status);}catch(error){if(!page.isClosed()&&!request.failure())throw error;}finally{finished();}
  };
  await page.route(rfqPattern,handler);
  return {arrived,release:async()=>{const response=page.waitForResponse(r=>r.request()===request);release();await done;await (await response).finished();await page.unroute(rfqPattern,handler);await settled(page);},cancel:release};
 }
 async function refreshMetadata(page){
  await Promise.all([page.waitForResponse(r=>r.url().endsWith(`/api/rfqs/${fixtureId(21)}`)&&r.status()===200),page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click()]);await settled(page);
 }
 const submission=page=>page.evaluate(()=>Object.entries(sessionStorage).find(([key])=>key.startsWith('forgequote:submission:'))?.[1]);
 await run('f2-stale-refresh','estimator',async page=>{
  const watchRejections=()=>{window.f2Unhandled=[];window.addEventListener('unhandledrejection',event=>window.f2Unhandled.push(event.reason?.name||'rejection'));};
  await page.addInitScript(watchRejections);await page.evaluate(watchRejections);
  await page.goto(`${origin}/#rfq=${fixtureId(21)}`);await page.getByLabel('Gross margin (%)',{exact:true}).waitFor();await page.getByLabel('Pricing date',{exact:true}).fill('2026-11-02');
  let posts=0,metadataReads=0;page.on('request',r=>{if(r.url().endsWith(`/api/rfqs/${fixtureId(21)}`))metadataReads++;if(r.method()==='POST'&&r.url().endsWith('/quote-versions'))posts++;});
  const older=await holdMetadata(page,503);
  try{
   await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();await older.arrived;
   await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();assert.equal(metadataReads,2,'Keep both existing post-save metadata requests');
   const versionId=new URLSearchParams(new URL(page.url()).hash.slice(1)).get('version');
   const quotes=createQuotationService(db.runtime,{gstPercent:'18'}),before=await quotes.getDraftVersion(estimator,versionId),record=await submission(page);
   await older.release();
   assert.equal(await page.getByRole('alert').filter({hasText:obsoleteRefresh}).count(),0,'F2: an older save-triggered failure must not overwrite a newer successful refresh');
   assert.equal(await page.getByRole('alert').filter({hasText:metadataFailure}).count(),0);
   await refreshMetadata(page);assert.equal(await submission(page),record);
   assert.equal(await page.getByTestId('baseline-price').innerText(),'\u20b9149.70');assert.equal(await page.getByTestId('baseline-cost').innerText(),'\u20b9119.76');assert.equal(await page.getByTestId('annual-baseline-value').innerText(),'\u20b92,69,46,000.00');
   // The latest failed read remains visible even when an older success arrives later.
   const oldSuccess=await holdMetadata(page);
   try{
    await page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();await oldSuccess.arrived;
    await page.route(rfqPattern,route=>failRead(route));await page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();await page.getByRole('alert').filter({hasText:metadataFailure}).waitFor();
    await oldSuccess.release();assert.equal(await page.getByRole('alert').filter({hasText:metadataFailure}).isVisible(),true,'Older success must not erase the latest failure');
   }finally{oldSuccess.cancel();await page.unroute(rfqPattern);}
   await refreshMetadata(page);assert.equal(await page.getByRole('alert').filter({hasText:metadataFailure}).count(),0,'Latest successful retry clears its read error');
   const oldData=await holdMetadata(page);
   try{
    await page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();await oldData.arrived;
    await db.owner.query('UPDATE rfqs SET owner_label=$1 WHERE id=$2',['Synthetic F2 newer assignment',fixtureId(21)]);
    await refreshMetadata(page);await page.locator('.title-block').getByText('Synthetic F2 newer assignment',{exact:true}).waitFor();await oldData.release();
    assert.equal(await page.locator('.title-block').getByText('Synthetic F2 newer assignment',{exact:true}).count(),1,'Older metadata cannot replace newer data');
   }finally{oldData.cancel();}
   assert.deepEqual(await quotes.getDraftVersion(estimator,versionId),before);assert.equal(await submission(page),record);assert.equal(posts,1,'Reads must not replay the save');assert.deepEqual(await page.evaluate(()=>window.f2Unhandled),[]);
   await page.locator('.costing-workspace').screenshot({path:`${directory}/f2-recovered.png`});
   // Expire only disposable fixture sessions: latest 401 still invokes real recovery.
   await db.owner.query("UPDATE sessions SET expire=now()-interval '1 minute'");await page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await submission(page),record);
   await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();
   assert.equal(await submission(page),record);assert.equal(await page.getByRole('button',{name:'Retrieve same submission',exact:true}).isVisible(),true);assert.equal(posts,1);assert.deepEqual(await quotes.getDraftVersion(estimator,versionId),before);assert.deepEqual(await page.evaluate(()=>window.f2Unhandled),[]);
  }finally{older.cancel();}
 });
 await run('f2-unmount-save','estimator',async page=>{
  await page.goto(`${origin}/#rfq=${fixtureId(21)}`);await page.getByLabel('Gross margin (%)',{exact:true}).waitFor();await page.getByLabel('Pricing date',{exact:true}).fill('2026-11-02');let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/quote-versions'))posts++;});
  const older=await holdMetadata(page,401);
  try{
   await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();await older.arrived;await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();const record=await submission(page);
   let sessionReads=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/session'))sessionReads++;});
   await nav(page).getByRole('link',{name:'RFQs',exact:true}).click();await page.getByRole('button',{name:'Refresh RFQs',exact:true}).waitFor();await older.release();
   assert.equal(sessionReads,0,'Abandoned save refresh must not trigger stale session recovery');assert.equal(await page.getByRole('alert').filter({hasText:'session expired'}).count(),0);assert.equal(await page.getByRole('alert').filter({hasText:obsoleteRefresh}).count(),0);
   await page.goBack();await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();assert.equal(await submission(page),record);assert.equal(posts,1);
   await page.getByRole('button',{name:'Start new calculation',exact:true}).click();await page.getByLabel('Gross margin (%)',{exact:true}).fill('17.25');
   const delayed=await holdMetadata(page,503);
   try{
    await page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();await delayed.arrived;await nav(page).getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();await delayed.release();
    await page.goBack();await page.getByLabel('Gross margin (%)',{exact:true}).waitFor();assert.equal(await page.getByLabel('Gross margin (%)',{exact:true}).inputValue(),'17.25');assert.equal(await page.getByRole('alert').filter({hasText:metadataFailure}).count(),0);
    assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true);assert.equal(posts,1);
   }finally{delayed.cancel();}
  }finally{older.cancel();}
 });
 await run('f2-action-error','estimator',async page=>{
  await page.goto(`${origin}/#rfq=${fixtureId(21)}`);await page.getByLabel('Gross margin (%)',{exact:true}).waitFor();
  const pattern=`**/api/rfqs/${fixtureId(21)}/quote-versions`,message='Synthetic quotation save failure';let posts=0;
  await page.route(pattern,route=>{posts++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message}})});});
  await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();await page.getByRole('alert').filter({hasText:message}).waitFor();const record=await submission(page);assert.equal(JSON.parse(record).phase,'uncertain');
  await refreshMetadata(page);assert.equal(await page.getByRole('alert').filter({hasText:message}).isVisible(),true,'Metadata success must not hide a failed save');assert.equal(await submission(page),record);assert.equal(posts,1);assert.equal(await page.getByRole('button',{name:'Retry same submission',exact:true}).isVisible(),true);assert.equal(await page.getByRole('status').filter({hasText:'Draft saved successfully.'}).count(),0);
 });
 await writeFile(`${directory}/results.json`,JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));app?.locals.sessionStore.close();await db.close();}
