import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {createQuotationService} from '../apps/api/src/quotations.js';
import {createLifecycleService} from '../apps/api/src/quotation-lifecycle.js';
import {fixtureId} from '../apps/api/src/seed.js';
import {browserTestDatabase} from './helpers/database.js';

const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`,rfqId=fixtureId(21);
try {
  app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema});
  const users=(await db.owner.query('SELECT id,role FROM users')).rows;
  const estimator=users.find(u=>u.role==='estimator').id,head=users.find(u=>u.role==='sales_head').id;
  const quotes=createQuotationService(db.runtime,{gstPercent:'18'}),life=createLifecycleService(db.runtime);
  const make=low=>quotes.createDraftVersion(estimator,{rfqId,pricingDate:'2026-11-02',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20',...(low?{requestedAnnualQty:'1000',tierQuantities:{'50':'500','100':'1000','150':'1500'}}:{})}]});
  const first=await make(false);
  await life.act(estimator,first.versionId,'submit',randomUUID(),{});await life.act(head,first.versionId,'approve',randomUUID(),{});await life.act(estimator,first.versionId,'issue',randomUUID(),{});
  const beforeFirst=await quotes.getDraftVersion(head,first.versionId);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],writes=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST' && /\/api\/(rfqs|quote-versions)\//.test(r.url()))writes.push(r.url());});
  async function login(role,password){await page.goto(origin);await page.getByLabel('Demo identity').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:`Signed in as ${role}`,exact:true}).waitFor();}
  const url=id=>`${origin}/#rfq=${rfqId}&version=${id}`;
  const nav=()=>page.getByRole('navigation',{name:'Saved versions',exact:true});
  const lifecycle=()=>page.getByRole('region',{name:'Quotation lifecycle',exact:true});
  const baseline=()=>page.getByRole('region',{name:'Saved annual baseline',exact:true});
  async function consistent(id,number,role){
    await lifecycle().getByRole('status').filter({hasText:`Quotation status: ${number===1?'issued':'draft'}`}).waitFor();
    const selected=nav().locator('a[aria-current="page"]');
    assert.equal(await selected.count(),1,'Selected saved version must exist in the refreshed selector');
    assert.equal(new URLSearchParams((await selected.getAttribute('href')).slice(1)).get('version'),id);
    assert.ok((await selected.innerText()).startsWith(`Version ${number} `));
    assert.ok((await baseline().textContent()).includes(`Version ${number}`));
    assert.ok((await lifecycle().getByRole('heading').innerText()).includes(`Version ${number}`));
    assert.equal(await page.getByTestId('annual-baseline-value').innerText(),number===1?'₹2,69,46,000.00':'₹3,01,850.00');
    assert.equal(await page.getByTestId('baseline-price').innerText(),number===1?'₹149.70':'₹301.85');
    assert.equal(await page.getByTestId('baseline-cost').innerText(),number===1?'₹119.76':'₹241.48');
    const totals=page.getByRole('table',{name:'Annual quotation totals',exact:true});
    assert.equal(await totals.getByRole('row').filter({hasText:'Taxable subtotal, ex-GST'}).getByRole('cell').nth(1).innerText(),number===1?'₹2,69,46,000.00':'₹3,01,850.00');
    assert.equal(await totals.getByRole('row').filter({hasText:'Total including GST'}).getByRole('cell').nth(1).innerText(),number===1?'₹3,17,96,280.00':'₹3,56,183.00');
    assert.ok((await page.getByRole('region',{name:'Saved quotation',exact:true}).getByRole('heading',{name:/Saved quotation/}).innerText()).includes(`Version ${number}`));
    if(role==='sales_head'){
      const inputs=page.getByRole('region',{name:'Saved costing inputs',exact:true});assert.ok((await inputs.innerText()).includes(`Version ${number}`));
      await inputs.getByRole('table').getByText(number===1?'1,80,000':'1,000',{exact:true}).waitFor();
    }
  }
  async function hold(pattern){
    let release,reached;const gate=new Promise(r=>release=r),arrived=new Promise(r=>reached=r);
    const handler=async route=>{const response=await route.fetch();reached();await gate;await route.fulfill({response}).catch(()=>{});}; // Response may intentionally belong to an aborted navigation.
    await page.route(pattern,handler);return {arrived,allowNext:()=>page.unroute(pattern,handler),release:async()=>{release();await page.unroute(pattern,handler);}};
  }
  await login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);await page.goto(url(first.versionId));await consistent(first.versionId,1,'sales_head');
  assert.equal(await nav().getByRole('link').count(),1);
  const oldMetadata=await hold(`**/api/rfqs/${rfqId}`);
  await page.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();await oldMetadata.arrived;await oldMetadata.allowNext();
  // Another actor creates version 2 while this RFQ is already open. Hash-only
  // navigation must refresh metadata instead of keeping the old one-item list.
  const second=await make(true),beforeSecond=await quotes.getDraftVersion(head,second.versionId);
  await page.goto(url(second.versionId));await consistent(second.versionId,2,'sales_head');
  await oldMetadata.release();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await consistent(second.versionId,2,'sales_head');
  assert.equal(await nav().getByRole('link').count(),2);
  await mkdir('.tmp/version-consistency',{recursive:true});
  for(const role of ['sales_head','estimator']){
    if(role==='estimator'){await page.getByRole('button',{name:'Sign out',exact:true}).click();await login(role,db.passwords.DEMO_ESTIMATOR_PASSWORD);}
    await page.goto(url(first.versionId));await consistent(first.versionId,1,role);
    const initialStorage=await page.evaluate(()=>JSON.stringify(sessionStorage));
    if(role==='estimator'){await page.getByLabel('Gross margin (%)',{exact:true}).fill('23');await page.getByLabel('100% annual quantity',{exact:true}).fill('1234');}
    await page.evaluate(()=>{
      window.versionMixes=[];
      window.versionObserver=new MutationObserver(()=>{
        const panels=[document.querySelector('.baseline-summary .eyebrow'),document.querySelector('[aria-label="Quotation lifecycle"] h2'),document.querySelector('.saved-input-context'),document.querySelector('[aria-label="Saved quotation"] h2')].filter(Boolean);
        if(!panels.length)return;
        const active=document.querySelector('.version-nav a[aria-current="page"]');
        const number=active?.textContent.match(/Version (\d+)/)?.[1];
        // The browser changes location.hash before delivering hashchange. Compare
        // rendered panels to the rendered selector; ready checks separately assert URL identity.
        if(!active || panels.some(p=>p.textContent.match(/Version (\d+)/i)?.[1]!==number))window.versionMixes.push(panels.map(p=>p.textContent));
      });window.versionObserver.observe(document.getElementById('root'),{subtree:true,childList:true,attributes:true,characterData:true});
    });
    // A delayed RFQ metadata response must not expose the next snapshot early.
    const metadata=await hold(`**/api/rfqs/${rfqId}`);
    await nav().getByRole('link',{name:/Version 2/}).click();await metadata.arrived;
    assert.equal(await baseline().count(),0);assert.equal(await lifecycle().count(),0);
    assert.equal(await page.getByRole('table',{name:'Saved costing inputs',exact:true}).count(),0);
    await metadata.release();await consistent(second.versionId,2,role);
    // A late response for the abandoned version must not replace current data.
    const snapshot=await hold(`**/api/quote-versions/${first.versionId}`);
    await nav().getByRole('link',{name:/Version 1/}).click();await snapshot.arrived;assert.equal(await baseline().count(),0);
    await nav().getByRole('link',{name:/Version 2/}).click();await consistent(second.versionId,2,role);await snapshot.release();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await consistent(second.versionId,2,role);
    // Lifecycle reads are separate, keyed by snapshot version; exercise a late one.
    await nav().getByRole('link',{name:/Version 1/}).click();await consistent(first.versionId,1,role);
    const eventRead=await hold(`**/api/quote-versions/${second.versionId}/lifecycle`);
    await nav().getByRole('link',{name:/Version 2/}).click();await eventRead.arrived;
    assert.ok((await lifecycle().getByRole('heading').innerText()).includes('Version 2'));
    assert.equal(await lifecycle().getByText('issued',{exact:true}).count(),0);
    await nav().getByRole('link',{name:/Version 1/}).click();await consistent(first.versionId,1,role);await eventRead.release();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await consistent(first.versionId,1,role);
    if(role==='estimator'){assert.equal(await page.getByLabel('Gross margin (%)',{exact:true}).inputValue(),'23');assert.equal(await page.getByLabel('100% annual quantity',{exact:true}).inputValue(),'1234');}
    assert.equal(await page.evaluate(()=>JSON.stringify(sessionStorage)),initialStorage);
    assert.deepEqual(await page.evaluate(()=>{window.versionObserver.disconnect();return window.versionMixes;}),[],'No render may mix a selector with another saved snapshot');
    await page.goto(`${origin}/#rfq=${rfqId}`);await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor({state:'detached'});
    assert.equal(await page.getByText('Loading saved quotation...',{exact:true}).count(),0);
    await nav().getByRole('link',{name:/Version 2/}).click();await consistent(second.versionId,2,role);
    if(role==='sales_head')for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.tmp/version-consistency/selected-version-2-${width}.png`,fullPage:true});}
  }
  assert.deepEqual(await quotes.getDraftVersion(head,first.versionId),beforeFirst);assert.deepEqual(await quotes.getDraftVersion(head,second.versionId),beforeSecond);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('PASS: both-role historical version selection, external new-version metadata, delayed snapshot/metadata/lifecycle reads, no mixed renders, saved golden totals/inputs, unsaved estimator controls, immutable snapshots and zero navigation writes.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
