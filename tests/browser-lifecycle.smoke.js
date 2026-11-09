import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createApp } from '../apps/api/src/app.js';
import { createQuotationService } from '../apps/api/src/quotations.js';
import { fixtureId } from '../apps/api/src/seed.js';
import { browserTestDatabase } from './helpers/database.js';

const db=await browserTestDatabase();
let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,quoteLimit:100});
  const actor=(await db.owner.query("SELECT id FROM users WHERE role='estimator'")).rows[0].id;
  const quotes=createQuotationService(db.runtime,{gstPercent:'18'});
  const create=async(low=false)=>quotes.createDraftVersion(actor,{rfqId:fixtureId(21),pricingDate:'2026-11-02',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20',...(low?{requestedAnnualQty:'1000',tierQuantities:{'50':'500','100':'1000','150':'1500'}}:{})}]});
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const e=await browser.newPage({viewport:{width:1280,height:1000}}),s=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];for(const page of [e,s]){page.setDefaultTimeout(12000);page.on('pageerror',err=>errors.push(err.name));}
  async function login(page,name,password){
    await page.goto(origin);await page.getByLabel('Demo identity').selectOption(name);await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:`Signed in as ${name}`,exact:true}).waitFor();
  }
  const lifecycle=page=>page.getByRole('region',{name:'Quotation lifecycle'});
  const status=async(page,value)=>{await lifecycle(page).getByRole('status').filter({hasText:`Quotation status: ${value}`}).waitFor();};
  const open=async(page,id)=>{await page.goto(`${origin}/#rfq=${fixtureId(21)}&version=${id}`);await page.getByRole('heading',{name:/Saved quotation/}).waitFor();};
  await login(e,'estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
  await e.getByRole('link',{name:'Open RFQ'}).click();await e.getByLabel('Pricing date').fill('2026-11-02');
  await e.getByRole('button',{name:'Calculate & save draft',exact:true}).click();await status(e,'draft');
  const versionId=new URLSearchParams(new URL(e.url()).hash.slice(1)).get('version');assert.ok(versionId);
  await lifecycle(e).getByRole('button',{name:'Submit for clearance'}).click();await status(e,'pending');
  assert.equal(await e.getByRole('button',{name:'Approve version'}).count(),0);
  await login(s,'sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
  await s.getByRole('link',{name:/RFQ-2611-014.*Version 1/}).click();await status(s,'pending');
  assert.equal(new URLSearchParams(new URL(s.url()).hash.slice(1)).get('version'),versionId);
  assert.equal(await s.getByTestId('annual-baseline-value').innerText(),'₹2,69,46,000.00');
  assert.equal(await s.getByRole('button',{name:'Calculate & save draft',exact:true}).count(),0);
  assert.equal(await s.getByRole('button',{name:'Reject version',exact:true}).isDisabled(),true);
  await s.getByRole('button',{name:'Approve version',exact:true}).click();await s.getByRole('button',{name:'Confirm approval',exact:true}).click();await status(s,'approved');
  await e.getByRole('button',{name:'Refresh lifecycle'}).click();await status(e,'approved');
  // Opening, Escape and Cancel leave both request storage and the server unchanged.
  let issueRequests=0;e.on('request',req=>{if(req.method()==='POST' && req.url().endsWith('/issue'))issueRequests++;});
  const beforeStorage=await e.evaluate(()=>JSON.stringify(sessionStorage));
  await e.getByRole('button',{name:'Issue quotation',exact:true}).click();
  let dialog=e.getByRole('dialog',{name:'Issue saved quotation?',exact:true});
  await dialog.waitFor();assert.equal(await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>el===document.activeElement),true);
  await e.keyboard.press('Tab');assert.equal(await dialog.getByRole('button',{name:'Confirm issuance',exact:true}).evaluate(el=>el===document.activeElement),true);
  await e.keyboard.press('Tab');assert.equal(await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>el===document.activeElement),true);
  await e.keyboard.press('Shift+Tab');assert.equal(await dialog.getByRole('button',{name:'Confirm issuance',exact:true}).evaluate(el=>el===document.activeElement),true);
  await e.keyboard.press('Shift+Tab');assert.equal(await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>el===document.activeElement),true);
  assert.ok((await dialog.innerText()).includes('₹2,69,46,000.00'));
  await e.keyboard.press('Escape');assert.equal(await dialog.count(),0);
  assert.equal(await e.getByRole('button',{name:'Issue quotation',exact:true}).evaluate(el=>el===document.activeElement),true);
  await e.getByRole('button',{name:'Issue quotation',exact:true}).click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(issueRequests,0);assert.equal(await e.evaluate(()=>JSON.stringify(sessionStorage)),beforeStorage);
  await e.getByRole('button',{name:'Issue quotation',exact:true}).click();await e.goto(origin);assert.equal(await dialog.count(),0);await open(e,versionId);await status(e,'approved');
  assert.equal(issueRequests,0);
  // Commit issuance but deliberately lose the response; reload must retain its key.
  let lost=false;
  await e.route(`**/api/quote-versions/${versionId}/issue`,async route=>{
    if(!lost){lost=true;await route.fetch();await route.abort('failed');}else await route.continue();
  });
  await e.getByRole('button',{name:'Issue quotation',exact:true}).click();
  await mkdir('.tmp/visual-v2/lifecycle',{recursive:true});
  for(const width of [1440,390]){await e.setViewportSize({width,height:width===390?844:1000});assert.equal(await e.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await e.screenshot({path:`.tmp/visual-v2/lifecycle/issuance-${width}.png`});}
  await dialog.getByRole('button',{name:'Confirm issuance',exact:true}).click();
  await e.getByRole('button',{name:'Retry same lifecycle action'}).waitFor();
  await e.reload();await status(e,'issued');
  await e.getByRole('button',{name:'Retry same lifecycle action'}).click();
  await e.getByRole('button',{name:'Retry same lifecycle action'}).waitFor({state:'detached'});
  await status(e,'issued');await lifecycle(e).getByTitle(`FQ-${versionId}`,{exact:true}).click();await lifecycle(e).getByText(`FQ-${versionId}`,{exact:true}).waitFor();
  assert.equal((await db.owner.query("SELECT count(*) FROM quotation_events WHERE version_id=$1 AND event_type='issued'",[versionId])).rows[0].count,'1');
  // Real independently specified below-threshold fixture (spindle 500/1000/1500).
  const low=await create(true);await open(e,low.versionId);await status(e,'draft');
  assert.equal(await e.getByTestId('annual-baseline-value').innerText(),'₹3,01,850.00');
  await s.goto(`${origin}/#rfq=${fixtureId(21)}&version=${low.versionId}`);
  const savedInputs=s.getByRole('region',{name:'Saved costing inputs',exact:true});
  await savedInputs.getByRole('table',{name:'Saved costing inputs',exact:true}).getByText('1,000',{exact:true}).waitFor();
  assert.equal(await savedInputs.getByRole('textbox').count(),0);
  assert.equal(await s.getByLabel('Pricing date',{exact:true}).count(),0);
  assert.ok((await savedInputs.innerText()).includes('02 Nov 2026'));
  await mkdir('.tmp/visual-v2/lifecycle',{recursive:true});
  for(const width of [1440,390]){await s.setViewportSize({width,height:width===390?844:1000});assert.equal(await s.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await s.screenshot({path:`.tmp/visual-v2/lifecycle/saved-inputs-${width}.png`,fullPage:true});await s.screenshot({path:`.tmp/visual-v2/lifecycle/saved-inputs-${width}-viewport.png`});}
  await e.getByRole('button',{name:'Submit for clearance'}).click();await status(e,'approved');
  await e.getByRole('button',{name:'Issue quotation',exact:true}).click();
  const beforeConfirm=issueRequests;
  await dialog.getByRole('button',{name:'Confirm issuance',exact:true}).evaluate(el=>{el.click();el.click();});await status(e,'issued');
  assert.equal(issueRequests,beforeConfirm+1);
  assert.deepEqual((await db.owner.query('SELECT event_type FROM quotation_events WHERE version_id=$1 ORDER BY position',[low.versionId])).rows.map(r=>r.event_type),['submitted','auto_approved','issued']);
  const rejected=await create();await open(e,rejected.versionId);await e.getByRole('button',{name:'Submit for clearance'}).click();await status(e,'pending');
  await s.goto(origin);await s.getByRole('link',{name:/RFQ-2611-014.*Version 3/}).click();await status(s,'pending');
  await s.getByLabel('Rejection reason').fill('Verify the requested annual quantity.');await s.getByRole('button',{name:'Reject version',exact:true}).click();await s.getByRole('button',{name:'Confirm rejection',exact:true}).click();await status(s,'rejected');
  await e.getByRole('button',{name:'Refresh lifecycle'}).click();await status(e,'rejected');
  await lifecycle(e).getByText(/Verify the requested annual quantity/).waitFor();assert.equal(await e.getByRole('button',{name:'Issue quotation',exact:true}).count(),0);
  const fresh=await create();await open(e,fresh.versionId);await status(e,'draft');
  await open(s,rejected.versionId);await s.getByRole('button',{name:'Refresh lifecycle'}).click();await lifecycle(s).getByText(/Superseded by a newer version/).waitFor();
  assert.equal(await s.getByRole('button',{name:'Approve version',exact:true}).count(),0);
  await mkdir('.tmp/t04-browser',{recursive:true});await e.screenshot({path:'.tmp/t04-browser/estimator.png',fullPage:true});await s.screenshot({path:'.tmp/t04-browser/sales-head-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: T04 Chrome both-role submit/review/approve/reject/issue, automatic clearance, exact version/totals, stale UI and refresh/lost-response issuance recovery.');
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
