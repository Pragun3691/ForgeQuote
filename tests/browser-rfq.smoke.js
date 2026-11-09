import {rateControls} from './helpers/rate-key-controls.js';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { createApp } from '../apps/api/src/app.js';
import { fixtureId } from '../apps/api/src/seed.js';
import { browserTestDatabase } from './helpers/database.js';

const db=await browserTestDatabase();
let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,aiConfig:{apiKey:'',model:'gemini-3.5-flash-lite',timeoutMs:1000,unavailableCode:'AI_NOT_CONFIGURED'}});
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  await page.getByText('Extract from text with AI (optional)',{exact:true}).click();
  await page.getByRole('status').filter({hasText:'AI extraction is not configured'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Extract with AI',exact:true}).isDisabled(),true);
  // AI availability and rate keys load independently; wait for the actual form gate.
  await page.waitForFunction(()=>{
    const input=[...document.querySelectorAll('label')].find(label=>label.textContent.trim()==='RFQ reference')?.querySelector('input');
    return input && !input.matches(':disabled');
  });
  assert.equal(await page.getByLabel('RFQ reference',{exact:true}).isEnabled(),true);
  await page.getByText('Extract from text with AI (optional)',{exact:true}).click();
  async function fillPart(index,number) {
    const part=page.getByRole('group',{name:`Part ${index}`,exact:true});
    for(const [label,value] of [['Part number',number],['Description','Synthetic demo spindle'],['Annual quantity','180000'],['Gross weight (kg)','0.61'],['Cycle time (minutes)','3.2'],['Setup hours per batch','12']]) await part.getByLabel(label,{exact:true}).fill(value);
    for(const [i,category] of ['Material','Machine','Scrap','Overhead','Packaging','Freight'].entries()) await rateControls(page,index).getByLabel(`${category} rate key`,{exact:true}).selectOption(fixtureId(i+1));
  }
  async function fillHeader(reference) {
    await page.getByLabel('RFQ reference',{exact:true}).fill(reference);
    await page.getByLabel('Customer name',{exact:true}).fill('Synthetic Browser Customer');
    await page.getByLabel('Due date',{exact:true}).fill('2026-11-06');
  }
  await fillHeader('RFQ-BROWSER-MULTI');await fillPart(1,'BROWSER-A');
  await page.getByRole('button',{name:'Add part',exact:true}).click();await fillPart(2,'BROWSER-A');
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Save RFQ',exact:true}).click();
  await page.getByRole('region',{name:'RFQ validation errors'}).waitFor();
  assert.equal(await page.getByLabel('RFQ reference',{exact:true}).isEnabled(),true);
  assert.equal((await db.owner.query("SELECT count(*) FROM rfqs WHERE reference='RFQ-BROWSER-MULTI'")).rows[0].count,'0');
  await page.getByRole('group',{name:'Part 2',exact:true}).getByLabel('Part number',{exact:true}).fill('BROWSER-B');
  assert.equal(await page.getByRole('checkbox').isChecked(),false);
  await page.getByRole('checkbox').check();
  let original;
  await page.route('**/api/rfqs',async route=>{
    if(route.request().method()!=='POST') return route.continue();
    original={key:route.request().headers()['idempotency-key'],body:route.request().postData()};
    const response=await route.fetch();assert.equal(response.status(),201);await route.abort('failed');
  });
  await page.getByRole('button',{name:'Save RFQ',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Network failure'}).waitFor();
  assert.equal(await page.getByLabel('RFQ reference',{exact:true}).isDisabled(),true);
  await page.unroute('**/api/rfqs');await page.reload();
  // Intake is now a real history entry; reload restores its recovery screen.
  await page.getByRole('button',{name:'Retry same RFQ submission',exact:true}).waitFor();
  assert.equal(await page.getByLabel('RFQ reference',{exact:true}).isDisabled(),true);
  const replayRequest=page.waitForRequest(request=>request.url()===origin+'/api/rfqs' && request.method()==='POST');
  await page.getByRole('button',{name:'Retry same RFQ submission',exact:true}).click();
  const replay=await replayRequest;assert.equal(replay.headers()['idempotency-key'],original.key);assert.equal(replay.postData(),original.body);
  const row=page.getByRole('row').filter({hasText:'RFQ-BROWSER-MULTI'});await row.waitFor();
  assert.equal((await db.owner.query("SELECT count(*) FROM rfqs WHERE reference='RFQ-BROWSER-MULTI'")).rows[0].count,'1');
  await row.getByRole('link',{name:'Open RFQ',exact:true}).click();
  await page.getByRole('heading',{name:'BROWSER-A',exact:true}).waitFor();await page.getByRole('heading',{name:'BROWSER-B',exact:true}).waitFor();
  await page.getByRole('group',{name:'Costing BROWSER-A',exact:true}).waitFor();
  await page.getByRole('group',{name:'Costing BROWSER-B',exact:true}).waitFor();
  await page.getByLabel('Pricing date',{exact:true}).fill('2026-11-02');
  await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  await page.getByRole('heading',{name:/Saved quotation/}).waitFor();
  assert.equal(await page.getByTestId('baseline-price').count(),2);
  await page.getByRole('link',{name:/RFQ register/}).click();
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();await page.getByRole('button',{name:'Create another RFQ',exact:true}).click();
  await fillHeader('RFQ-BROWSER-SINGLE');await fillPart(1,'BROWSER-SINGLE');await page.getByRole('checkbox').check();
  await mkdir(new URL('../.tmp/',import.meta.url),{recursive:true});
  await page.screenshot({path:'.tmp/t02-manual-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'.tmp/t02-manual-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Save RFQ',exact:true}).click();
  await page.getByRole('row').filter({hasText:'RFQ-BROWSER-SINGLE'}).getByRole('link',{name:'Open RFQ',exact:true}).click();
  await page.getByLabel('Pricing date',{exact:true}).fill('2026-11-02');await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  await page.getByTestId('baseline-price').waitFor();
  assert.equal(await page.getByTestId('baseline-price').innerText(),'₹149.70');
  assert.equal(await page.getByTestId('baseline-cost').innerText(),'₹119.76');
  await page.getByRole('link',{name:/RFQ register/}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByLabel('Account').selectOption('sales_head');await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_SALES_HEAD_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'RFQ register',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'New RFQ',exact:true}).count(),0);assert.deepEqual(errors,[]);
  console.log('PASS: real Chrome manual multi-part validation/correction, atomic save, lost-response refresh/same-key recovery, single-part golden costing, mobile layout and sales-head read-only UI.');
} finally {
  if(browser) await browser.close();app?.locals.sessionStore.close();await new Promise(resolve=>server.close(resolve));await db.close();
}
