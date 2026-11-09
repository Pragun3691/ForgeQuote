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
import {createLifecycleService} from '../apps/api/src/quotation-lifecycle.js';

const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`,baseline=!!process.env.M3_BASELINE;
const directory=`.tmp/m3/${baseline?'before':'after'}`;await mkdir(directory,{recursive:true});
try {
 await db.owner.query("INSERT INTO rfqs(id,reference,customer_name,due_date,owner_label) VALUES ($1,'SYNTH-BRASS','Synthetic Brass','2026-11-20','Demo B'),($2,'SYNTH-ALLOY','Synthetic Alloy','2026-11-05','Demo B')",[randomUUID(),randomUUID()]);
 const actor=(await db.owner.query("SELECT id FROM users WHERE role='estimator'")).rows[0].id;
 const quote=await createQuotationService(db.runtime,{gstPercent:'18'}).createDraftVersion(actor,{rfqId:fixtureId(21),pricingDate:'2026-11-02',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20'}]});
 await createLifecycleService(db.runtime).act(actor,quote.versionId,'submit',randomUUID(),{});
 app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,loginLimit:100});
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const errors=[];const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 async function capture(name){for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:width===768?1024:width<400?844:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow '+width);if(name.includes('approvals'))await page.locator('#approvals').scrollIntoViewIfNeeded();else await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${directory}/${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});}
 async function login(role){await page.goto(origin);await page.getByLabel('Account').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(db.passwords[role==='estimator'?'DEMO_ESTIMATOR_PASSWORD':'DEMO_SALES_HEAD_PASSWORD']);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('table',{name:'RFQ register',exact:true}).waitFor();}
 const nav=()=>page.getByRole('navigation',{name:'Workspace navigation'});
 await login('estimator');await capture('register');
 if(!baseline){
  assert.ok(await page.getByRole('table',{name:'RFQ register',exact:true}).locator('tbody tr').first().evaluate(el=>el.getBoundingClientRect().height<=64),'Compact desktop row');
  let writes=0;page.on('request',r=>{if(r.method()==='POST')writes++;});
  const search=page.getByLabel('Search RFQs',{exact:true});await search.fill('synthetic');await page.getByLabel('Sort RFQs',{exact:true}).selectOption('reference');
  assert.deepEqual(await page.getByRole('table',{name:'RFQ register',exact:true}).locator('tbody th strong').allTextContents(),['RFQ-2611-014','SYNTH-ALLOY','SYNTH-BRASS']);
  await page.getByLabel('Assigned estimator',{exact:true}).selectOption('Demo B');assert.equal(await page.getByRole('link',{name:'Open RFQ',exact:true}).count(),2);
  await page.getByLabel('RFQ status',{exact:true}).selectOption('sent');await page.getByRole('heading',{name:'No matching RFQs',exact:true}).waitFor();await capture('no-matches');
  await page.goBack();await page.getByRole('table',{name:'RFQ register',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Open RFQ',exact:true}).count(),2);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();await search.fill('RFQ-2611-014');const hash=await page.evaluate(()=>location.hash);
  await page.getByRole('link',{name:'Open RFQ',exact:true}).click();await page.getByLabel('Pricing date',{exact:true}).waitFor();await page.getByLabel('Gross margin (%)',{exact:true}).fill('17.25');
  await nav().getByRole('link',{name:'RFQs',exact:true}).click();assert.equal(await search.inputValue(),'RFQ-2611-014');assert.equal(await page.evaluate(()=>location.hash),hash);
  await page.getByRole('link',{name:'Open RFQ',exact:true}).click();assert.equal(await page.getByLabel('Gross margin (%)',{exact:true}).inputValue(),'17.25');await page.goBack();
  await page.route('**/api/rfqs',route=>route.abort());await page.getByRole('button',{name:'Refresh RFQs',exact:true}).click();await page.getByRole('alert').filter({hasText:'Unable to load RFQs'}).waitFor();assert.equal(await search.inputValue(),'RFQ-2611-014');await capture('refresh-error');
  await page.unroute('**/api/rfqs');await page.getByRole('button',{name:'Reload RFQs',exact:true}).click();await page.getByRole('alert').filter({hasText:'Unable to load RFQs'}).waitFor({state:'hidden'});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});const link=page.getByRole('link',{name:'Open RFQ',exact:true});assert.ok(await link.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=44;}));}
  assert.equal(writes,0);await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 }
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('sales_head');await nav().getByRole('link',{name:'Approvals',exact:true}).click();await page.getByRole('table',{name:'Pending approvals',exact:true}).waitFor();await capture('approvals');
 if(!baseline){
  const search=page.getByLabel('Search pending approvals',{exact:true});await search.fill('no match');await page.getByText('No matching pending approvals. Clear the search to see the queue.',{exact:true}).waitFor();await search.fill('RFQ-2611-014');
  await page.setViewportSize({width:320,height:844});const review=page.getByRole('link',{name:/RFQ-2611-014.*Version 1.*Review quotation/});await review.scrollIntoViewIfNeeded();assert.ok(await review.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  const hash=await page.evaluate(()=>location.hash);await review.click();await page.getByRole('heading',{name:'Saved costing inputs',exact:true}).waitFor();await page.getByRole('link',{name:'← RFQ register',exact:true}).click();assert.equal(await page.evaluate(()=>location.hash),hash);assert.equal(await search.inputValue(),'RFQ-2611-014');
  await search.fill('');await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor({state:'hidden'});
 }
 assert.deepEqual(errors,[]);await writeFile(`${directory}/results.json`,JSON.stringify({passed:true,roles:['estimator','sales_head'],widths:[1440,768,390,320]},null,2));console.log('PASS M3: filters/sorting/history, role-specific queue, read recovery, retained draft, visible mobile actions, zero navigation writes and four viewport captures.');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));app?.locals.sessionStore.close();await db.close();}
