import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {browserTestDatabase} from './helpers/database.js';
import {multipartRfq} from './helpers/multipart-rfq.js';
import {createSubmissionService} from '../apps/api/src/draft-submissions.js';
import {createLifecycleService} from '../apps/api/src/quotation-lifecycle.js';
import {inspectPdf} from './helpers/pdf.js';

const db=await browserTestDatabase(),directory='.tmp/maintenance';await mkdir(directory,{recursive:true});
let browser,current,maintenance,oldPool,newPool;const apps=[];
const server=createServer((req,res)=>current(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
try{
 const settings={nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0};
 const pool=()=>new pg.Pool({connectionString:db.connectionString,options:db.runtimeOptions});
 oldPool=pool();const normal=createApp(oldPool,settings,{sessionSchema:db.schema,loginLimit:100,quoteLimit:1000});apps.push(normal);current=normal;
 let maintenanceQueries=0;maintenance=createApp({query(){maintenanceQueries++;throw Error('Maintenance DB use');},connect(){maintenanceQueries++;throw Error('Maintenance DB use');}},{...settings,maintenanceMode:true});
 const users=(await db.owner.query('SELECT id,role FROM users')).rows,e=users.find(u=>u.role==='estimator').id,s=users.find(u=>u.role==='sales_head').id;
 const save=createSubmissionService(db.runtime,{gstPercent:'18'}),life=createLifecycleService(db.runtime),est=await multipartRfq(db.owner,1),review=await multipartRfq(db.owner,1);
 const estVersion=await save(e,est.rfqId,randomUUID(),est.body),reviewVersion=await save(e,review.rfqId,randomUUID(),review.body);await life.act(e,reviewVersion.versionId,'submit',randomUUID(),{});
 const original=JSON.stringify((await db.owner.query('SELECT * FROM quotation_versions ORDER BY id')).rows);
 browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
 async function login(role){const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.getByLabel('Account').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(db.passwords[role==='estimator'?'DEMO_ESTIMATOR_PASSWORD':'DEMO_SALES_HEAD_PASSWORD']);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Refresh RFQs',exact:true}).waitFor();return page;}
 const estimator=await login('estimator'),sales=await login('sales_head');
 await estimator.goto(`${origin}/#rfq=${est.rfqId}&version=${estVersion.versionId}`);await estimator.getByLabel('Gross margin (%)',{exact:true}).fill('21');
 await sales.goto(`${origin}/#rfq=${review.rfqId}&version=${reviewVersion.versionId}`);await sales.getByRole('button',{name:'Approve version',exact:true}).click();
 const cookieDigest=async page=>createHash('sha256').update(JSON.stringify(await page.context().cookies())).digest('hex');
 const estimatorCookies=await cookieDigest(estimator),salesCookies=await cookieDigest(sales);
 const sessionsBefore=(await db.owner.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n;
 // Local routing model: no claim of independently exercising Render. Finish
 // old work and close its pool/store before declaring this test barrier active.
 current=maintenance;await normal.locals.sessionStore.close();await oldPool.end();oldPool=null;
 const recorded={save:[],approve:[]};
 estimator.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/quote-versions'))recorded.save.push({key:r.headers()['idempotency-key'],body:r.postData()});});
 sales.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/approve'))recorded.approve.push({key:r.headers()['idempotency-key'],body:r.postData()});});
 await estimator.getByRole('button',{name:'Calculate & save draft',exact:true}).click();await estimator.getByRole('alert').filter({hasText:'in maintenance'}).waitFor();
 assert.equal(await estimator.getByLabel('Gross margin (%)',{exact:true}).inputValue(),'21');await estimator.getByRole('button',{name:'Retry same submission',exact:true}).waitFor();
 await sales.getByRole('button',{name:'Confirm approval',exact:true}).click();await sales.getByRole('alert').filter({hasText:'in maintenance'}).waitFor();await sales.getByRole('button',{name:'Retry same lifecycle action',exact:true}).waitFor();
 assert.equal((await db.owner.query('SELECT count(*)::int AS n FROM quotation_versions')).rows[0].n,2);assert.equal((await db.owner.query('SELECT count(*)::int AS n FROM quotation_events')).rows[0].n,1);
 const visitor=await browser.newPage();const response=await visitor.goto(origin);assert.equal(response.status(),503);assert.equal(response.headers()['retry-after'],'60');assert.equal(response.headers()['cache-control'],'no-store');
 await visitor.getByRole('heading',{name:'Temporarily in maintenance'}).waitFor();assert.equal(await visitor.title(),'Maintenance | ForgeQuote');
 for(const width of [1440,768,390,320]){
  await visitor.setViewportSize({width,height:width===768?1024:width<400?844:1000});await visitor.keyboard.press('Tab');
  assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await visitor.screenshot({path:`${directory}/maintenance-${width}.png`});
 }
 await visitor.setViewportSize({width:390,height:844});await visitor.emulateMedia({reducedMotion:'reduce'});await visitor.getByRole('link',{name:'Check again'}).focus();assert.equal(await visitor.getByRole('link',{name:'Check again'}).evaluate(el=>el===document.activeElement),true);
 const again=visitor.waitForResponse(r=>r.url()===origin+'/');await visitor.keyboard.press('Enter');assert.equal((await again).status(),503);
 assert.equal(await visitor.getByRole('button',{name:'Sign in',exact:true}).count(),0);
 assert.equal((await db.owner.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,sessionsBefore);assert.equal(maintenanceQueries,0);
 assert.equal(await cookieDigest(estimator),estimatorCookies);assert.equal(await cookieDigest(sales),salesCookies);
 assert.equal(JSON.stringify((await db.owner.query('SELECT * FROM quotation_versions ORDER BY id')).rows),original);
 // Verified schema 008 reopening. No automatic mutation retry is introduced.
 newPool=pool();const restored=createApp(newPool,settings,{sessionSchema:db.schema,loginLimit:100,quoteLimit:1000});apps.push(restored);
 const readyApp=createServer(restored);readyApp.listen(0,'127.0.0.1');await once(readyApp,'listening');
 const health=await fetch(`http://127.0.0.1:${readyApp.address().port}/api/health/deploy`);assert.equal(health.status,200);await new Promise(r=>readyApp.close(r));current=restored;
 assert.equal(recorded.save.length,1);assert.equal(recorded.approve.length,1);
 await estimator.getByRole('button',{name:'Retry same submission',exact:true}).click();await estimator.getByRole('status').filter({hasText:'Draft saved successfully.'}).waitFor();
 await sales.getByRole('button',{name:'Retry same lifecycle action',exact:true}).click();await sales.getByRole('status').filter({hasText:'Quotation status: approved'}).waitFor();
 assert.deepEqual(recorded.save[0],recorded.save[1]);assert.deepEqual(recorded.approve[0],recorded.approve[1]);assert.equal(recorded.save.length,2);assert.equal(recorded.approve.length,2);
 assert.equal((await db.owner.query('SELECT count(*)::int AS n FROM quotation_versions')).rows[0].n,3);assert.equal((await db.owner.query('SELECT count(*)::int AS n FROM quotation_events')).rows[0].n,2);
 await sales.getByRole('button',{name:'Refresh RFQ status',exact:true}).click();
 const downloading=sales.waitForEvent('download');await sales.getByRole('button',{name:'Download INTERNAL costing PDF',exact:true}).click();const download=await downloading;assert.equal(await download.failure(),null);await download.saveAs(`${directory}/after-maintenance-internal.pdf`);assert.ok((await inspectPdf(await readFile(`${directory}/after-maintenance-internal.pdf`))).text.includes('149.70'));
 assert.deepEqual(errors,[]);await writeFile(`${directory}/browser-results.json`,JSON.stringify({passed:true,roles:['estimator','sales_head'],viewports:[1440,768,390,320],maintenanceQueries,submissionPosts:recorded.save.length,decisionPosts:recorded.approve.length},null,2));
 console.log('PASS maintenance browser: real both-role sessions, stale save/approval 503, retained inputs and exact-request retries, no maintenance sessions/writes, accessible four-width notice, recovery and historical PDF.');
}finally{await browser?.close();for(const app of apps)await app.locals.sessionStore.close();await new Promise(r=>server.close(r));await oldPool?.end();await newPool?.end();await db.close();}
