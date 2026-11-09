import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserTestDatabase } from './helpers/database.js';
import { seed, fixtureId } from '../apps/api/src/seed.js';
import { multipartRfq, multipartTotals } from './helpers/multipart-rfq.js';
import { goldenCases } from '../apps/api/test/fixtures/golden-v02.js';

const db=await browserTestDatabase({seedBusiness:false});
const secret=randomBytes(32).toString('hex');
let child,browser,port;
async function start() {
  const processChild=fork(fileURLToPath(new URL('./helpers/browser-server.js',import.meta.url)),[],{
    windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,
      FQ_TEST_CONNECTION:db.connectionString,FQ_TEST_OPTIONS:db.runtimeOptions,FQ_TEST_SCHEMA:db.schema,FQ_TEST_SECRET:secret,FQ_TEST_PORT:String(port || 0)}
  });
  child=processChild;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Test API startup timed out')),15000);
    processChild.once('error',error=>{clearTimeout(timer);reject(error);});
    processChild.once('exit',code=>{clearTimeout(timer);reject(Error(`Test API exited during startup (${code})`));});
    processChild.once('message',message=>{clearTimeout(timer);assert.equal(message.type,'ready');port=message.port;resolve();});
  });
}
async function stop() {
  if(!child || child.exitCode !== null) return;
  const stopping=child;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{stopping.kill();reject(Error('Test API shutdown timed out'));},12000);
    stopping.once('exit',()=>{clearTimeout(timer);resolve();});
    stopping.send('stop');
  });
  child=null;
}
const counts=async()=> (await db.owner.query('SELECT (SELECT count(*) FROM quotation_versions) AS versions,(SELECT count(*) FROM draft_submissions) AS submissions')).rows[0];
try {
  await start();
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=`http://127.0.0.1:${port}`;
  async function login(username,password) {
    await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
    await page.getByLabel('Account').selectOption(username);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:`Signed in as ${username}`,exact:true}).waitFor();
  }
  async function saved() {
    await page.getByRole('heading',{name:/Saved quotation/}).waitFor();
    assert.equal(await page.getByRole('table',{name:/^Cost breakdown/}).first().getByRole('columnheader').first().innerText(),'INR / UNIT, EX-GST');
    assert.equal(await page.getByTestId('baseline-cost').innerText(),'₹119.76');
    assert.equal(await page.getByTestId('baseline-price').innerText(),'₹149.70');
  }
  async function record() {
    return page.evaluate(()=>JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(key=>key.startsWith('forgequote:submission:')))));
  }
  await page.goto(origin);
  await login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
  await page.getByRole('heading',{name:'No RFQs yet'}).waitFor();
  await seed(db.owner);await page.reload();
  await page.getByRole('link',{name:'Open RFQ'}).click();
  await page.getByRole('heading',{name:'RFQ-2611-014',exact:true}).waitFor();
  await page.getByLabel('Gross margin (%)').fill('100');
  await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  assert.equal(await page.getByLabel('Gross margin (%)').evaluate(input=>input.checkValidity()),false);
  assert.deepEqual(await counts(),{versions:'0',submissions:'0'});
  await page.getByLabel('Gross margin (%)').fill('20');
  await page.getByLabel('50% annual quantity',{exact:true}).fill('1000000001');
  await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Annual quantities must be integer strings'}).waitFor();
  assert.deepEqual(await counts(),{versions:'0',submissions:'0'});
  await page.getByLabel('50% annual quantity',{exact:true}).fill('90000');
  await page.getByLabel('Pricing date').fill('2026-11-01');
  await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'No effective rate'}).waitFor();
  assert.deepEqual(await counts(),{versions:'0',submissions:'0'});
  await page.getByLabel('Pricing date').fill('2026-11-02');
  const initialGet=page.waitForResponse(response=>/\/api\/quote-versions\//.test(response.url()) && response.request().method()==='GET');
  await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  const savedResponse=await (await initialGet).json();await saved();
  assert.equal(savedResponse.parts[0].result.tiers[1].sellingPricePerUnitExGst,'149.70');
  const breakdown=page.getByRole('table',{name:'Cost breakdown SPINDLE-DEMO'});
  assert.ok((await breakdown.innerText()).includes('₹150.55'));assert.ok((await breakdown.innerText()).includes('₹149.41'));
  assert.ok((await breakdown.innerText()).includes('90,000'));assert.ok((await breakdown.innerText()).includes('2,70,000'));
  await page.getByText('Selected rates & provenance',{exact:true}).click();
  await page.getByRole('table',{name:'Rate provenance'}).waitFor();
  await page.getByRole('table',{name:'Rate provenance'}).getByTitle(fixtureId(11),{exact:true}).click();
  assert.ok((await page.getByRole('table',{name:'Rate provenance'}).innerText()).includes(fixtureId(11)));
  assert.ok((await page.getByRole('table',{name:'Annual quotation totals'}).innerText()).includes('₹3,17,96,280.00'));
  await mkdir(new URL('../.tmp/',import.meta.url),{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('../.tmp/milestone7-desktop.png',import.meta.url)),fullPage:true});
  assert.deepEqual(await counts(),{versions:'1',submissions:'1'});
  // Pre-T03 pending records keep their original flat body, key and recovery path.
  await page.evaluate(()=>{
    const key=Object.keys(sessionStorage).find(key=>key.startsWith('forgequote:submission:'));
    const record=JSON.parse(sessionStorage.getItem(key));
    const {pricingDate,parts}=record.body;record.body={pricingDate,...parts[0]};sessionStorage.setItem(key,JSON.stringify(record));
  });
  await page.reload();await saved();assert.equal(Object.hasOwn((await record()).body,'parts'),false);
  const replayResponse=page.waitForResponse(response=>response.request().method()==='POST' && response.url().endsWith('/quote-versions'));
  await page.getByRole('button',{name:'Retrieve same submission',exact:true}).click();
  assert.equal((await replayResponse).status(),200);await saved();
  assert.deepEqual(await counts(),{versions:'1',submissions:'1'});
  // A changed live RFQ input must not cause browser-side repricing of saved data.
  await db.owner.query("UPDATE rfq_parts SET gross_weight_kg='2' WHERE id=$1",[fixtureId(22)]);
  await page.reload();await saved();
  assert.ok((await page.locator('.part-facts').innerText()).includes('2.000000 kg'));
  await db.owner.query("UPDATE rfq_parts SET gross_weight_kg='0.61' WHERE id=$1",[fixtureId(22)]);
  const pidBefore=child.pid;await stop();await start();assert.notEqual(child.pid,pidBefore);
  await page.reload();await saved();
  assert.deepEqual(await counts(),{versions:'1',submissions:'1'});
  console.log('PASS: real Chrome estimator workflow, empty register, invalid input, missing rate, all three saved golden scenarios, replay, refresh, changed-master isolation and OS-process API restart.');

  const originalKey=(await record()).submissionKey;
  await page.getByRole('button',{name:'Start new calculation',exact:true}).click();
  assert.notEqual((await record()).submissionKey,originalKey);
  // Commit the real request, then lose its response before the browser receives it.
  await page.route('**/api/rfqs/*/quote-versions',async route=>{await route.fetch();await route.abort('failed');},{times:1});
  await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Network failure'}).waitFor();
  const uncertain=await record();
  assert.equal(uncertain.phase,'uncertain');assert.deepEqual(await counts(),{versions:'2',submissions:'2'});
  await page.reload();
  await page.getByRole('button',{name:'Retry same submission',exact:true}).waitFor();
  assert.deepEqual(await record(),uncertain);
  const recovered=page.waitForResponse(response=>response.request().method()==='POST' && response.url().endsWith('/quote-versions'));
  await page.getByRole('button',{name:'Retry same submission',exact:true}).click();
  assert.equal((await recovered).status(),200);await saved();
  assert.deepEqual(await counts(),{versions:'2',submissions:'2'});
  assert.equal((await record()).submissionKey,uncertain.submissionKey);
  assert.equal(await page.locator('.results .badge').innerText(),'Version 2');
  console.log('PASS: a deliberate new calculation used a fresh key; lost successful POST response retained the exact pending key/body across refresh; same-key recovery returned HTTP 200 and no duplicate version.');

  await db.owner.query("UPDATE sessions SET expire=now()-interval '1 minute'");
  await page.getByRole('button',{name:'Retrieve same submission',exact:true}).click();
  await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
  await page.getByRole('alert').filter({hasText:'session expired'}).waitFor();
  assert.equal((await record()).submissionKey,uncertain.submissionKey);
  await login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
  await page.getByRole('button',{name:'Retry same submission',exact:true}).waitFor();
  await page.getByRole('button',{name:'Retry same submission',exact:true}).click();await saved();
  assert.deepEqual(await counts(),{versions:'2',submissions:'2'});
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);await saved();
  await page.getByText('Sales head cannot create quotations.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Calculate & save draft',exact:true}).count(),0);
  const denied=await page.evaluate(async ({rfqId,body})=>{
    const session=await (await fetch('/api/auth/session')).json();
    return (await fetch(`/api/rfqs/${rfqId}/quote-versions`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)})).status;
  },{rfqId:fixtureId(21),body:uncertain.body});
  assert.equal(denied,403);assert.deepEqual(await counts(),{versions:'2',submissions:'2'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:fileURLToPath(new URL('../.tmp/milestone7-mobile.png',import.meta.url)),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
  assert.equal((await page.request.get(`${origin}/api/quote-versions/${savedResponse.versionId}`)).status(),401);
  await login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);await saved();
  await page.evaluate(()=>{const key=Object.keys(sessionStorage).find(key=>key.startsWith('forgequote:submission:'));sessionStorage.setItem(key,JSON.stringify({submissionKey:'invalid',body:{}}));});
  await page.reload();
  await page.getByRole('alert').filter({hasText:'Saved submission is unreadable'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Calculate & save draft',exact:true}).isDisabled(),true);
  assert.deepEqual(await counts(),{versions:'2',submissions:'2'});
  assert.deepEqual(errors,[]);
  console.log('PASS: expired-session recovery retained pending key; sales head saw saved results but POST returned 403; anonymous GET returned 401; 390px layout had no page overflow; malformed pending storage blocked saving; no browser page errors.');

  // Complete two- and three-part quotations use the same workspace/transaction.
  for(const n of [2,3]) {
    const fixture=await multipartRfq(db.owner,n),before=await counts();
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`${origin}/#rfq=${fixture.rfqId}`);
    await page.getByRole('group',{name:'Costing T03-1-spindle',exact:true}).waitFor();
    await page.getByLabel('Pricing date').fill('2026-11-02');
    for(let i=0;i<n;i++) {
      const group=page.getByRole('group',{name:`Costing T03-${i+1}-${goldenCases[i].name}`,exact:true});
      await group.getByLabel('Gross margin (%)').fill(goldenCases[i].input.marginPercent);
      for(const [scenario,quantity] of Object.entries(fixture.body.parts[i].tierQuantities))assert.equal(await group.getByLabel(`${scenario}% annual quantity`,{exact:true}).inputValue(),quantity);
    }
    const multiRecord=()=>page.evaluate(rfqId=>JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(key=>key.startsWith('forgequote:submission:')&&key.endsWith(':'+rfqId)))),fixture.rfqId);
    if(n===3)await page.getByRole('group',{name:'Costing T03-1-spindle',exact:true}).screenshot({path:'.tmp/t03-part-controls.png'});
    if(n===2) await page.route('**/api/rfqs/*/quote-versions',async route=>{await route.fetch();await route.abort('failed');},{times:1});
    const submission=n===3?page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/quote-versions')):null;
    await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
    if(n===2){
      await page.getByRole('alert').filter({hasText:'Network failure'}).waitFor();
      const pending=await multiRecord();assert.equal(pending.phase,'uncertain');assert.equal(pending.body.parts.length,2);
      await page.reload();await page.getByRole('button',{name:'Retry same submission',exact:true}).waitFor();assert.deepEqual(await multiRecord(),pending);
      const retry=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/quote-versions'));
      await page.getByRole('button',{name:'Retry same submission',exact:true}).click();assert.equal((await retry).status(),200);
    }else assert.equal((await submission).status(),201);
    await page.getByRole('heading',{name:/Saved quotation/}).waitFor();
    assert.equal(await page.getByTestId('baseline-price').count(),n);
    assert.equal(await page.getByTestId('annual-baseline-value').innerText(),n===2?'₹5,54,12,640.00':'₹8,26,50,240.00');
    const pending=await multiRecord(),snapshot=await (await page.request.get(`${origin}/api/quote-versions/${pending.versionId}`)).json();
    assert.equal(snapshot.parts.length,n);assert.deepEqual(snapshot.totals.map(total=>[total.taxableSubtotal,total.gstAmount,total.totalWithGst]),multipartTotals[n]);
    for(let i=0;i<n;i++) {
      const breakdown=page.getByRole('table',{name:`Cost breakdown T03-${i+1}-${goldenCases[i].name}`,exact:true});
      for(const expected of goldenCases[i].expected)assert.ok((await breakdown.innerText()).replaceAll(',','').includes(expected.price));
    }
    assert.deepEqual(await counts(),{versions:String(BigInt(before.versions)+1n),submissions:String(BigInt(before.submissions)+1n)});
    // Reordered saved bodies must map every editable field by stable ID and replay.
    await page.evaluate(rfqId=>{
      const key=Object.keys(sessionStorage).find(key=>key.startsWith('forgequote:submission:')&&key.endsWith(':'+rfqId));
      const record=JSON.parse(sessionStorage.getItem(key));record.body.parts.reverse();sessionStorage.setItem(key,JSON.stringify(record));
    },fixture.rfqId);
    await page.reload();await page.getByRole('heading',{name:/Saved quotation/}).waitFor();
    for(let i=0;i<n;i++)assert.equal(await page.getByRole('group',{name:`Costing T03-${i+1}-${goldenCases[i].name}`,exact:true}).getByLabel('Gross margin (%)').inputValue(),goldenCases[i].input.marginPercent);
    const replay=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/quote-versions'));
    await page.getByRole('button',{name:'Retrieve same submission',exact:true}).click();assert.equal((await replay).status(),200);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:`.tmp/t03-${n}-part-mobile.png`,fullPage:true});
    assert.deepEqual(await counts(),{versions:String(BigInt(before.versions)+1n),submissions:String(BigInt(before.submissions)+1n)});
  }
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
  await page.getByRole('heading',{name:/Saved quotation/}).waitFor();assert.equal(await page.getByTestId('baseline-price').count(),3);
  assert.equal(await page.getByRole('button',{name:'Calculate & save draft',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: real Chrome two/three-part golden quotations, all scenario/combined totals, legacy flat recovery, multipart lost-response refresh/replay, stable-ID reordered controls, mobile layout and sales-head read-only saved results.');
} finally {
  if(browser) await browser.close();
  await stop();await db.close();
}
