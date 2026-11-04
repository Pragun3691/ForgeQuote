import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {browserTestDatabase} from './helpers/database.js';
import {multipartRfq} from './helpers/multipart-rfq.js';
import {inspectPdf} from './helpers/pdf.js';
import {createApp} from '../apps/api/src/app.js';
import {createQuotationService} from '../apps/api/src/quotations.js';
import {createLifecycleService} from '../apps/api/src/quotation-lifecycle.js';

const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
try {
 app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema});
 const users=(await db.owner.query('SELECT id,role FROM users')).rows,estimator=users.find(u=>u.role==='estimator').id,sales=users.find(u=>u.role==='sales_head').id;
 const quotes=createQuotationService(db.runtime,{gstPercent:'18'}),lifecycle=createLifecycleService(db.runtime);
 const fixture=await multipartRfq(db.owner,3),request={rfqId:fixture.rfqId,...fixture.body};
 const {versionId}=await quotes.createDraftVersion(estimator,request);
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.name));
 async function login(role,password){await page.goto(origin);await page.getByLabel('Demo identity').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:`Signed in as ${role}`,exact:true}).waitFor();}
 const status=value=>page.getByRole('status').filter({hasText:`Quotation status: ${value}`}).waitFor();
 await login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
 await page.goto(`${origin}/#rfq=${fixture.rfqId}&version=${versionId}`);await status('draft');
 assert.equal(await page.getByRole('button',{name:'Download customer PDF'}).count(),0);
 for(const [actor,action] of [[estimator,'submit'],[sales,'approve'],[estimator,'issue']])await lifecycle.act(actor,versionId,action,randomUUID(),{});
 await page.getByRole('button',{name:'Refresh lifecycle'}).click();await status('issued');
 const url=`**/api/quote-versions/${versionId}/pdf`;
 await page.route(url,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'PDF temporarily unavailable. Please retry.'}})}));
 await page.getByRole('button',{name:'Download customer PDF'}).click();await page.getByRole('alert').filter({hasText:'PDF temporarily unavailable'}).waitFor();
 await page.unroute(url);
 await mkdir('.tmp/t05-pdf',{recursive:true});
 for(const role of ['estimator','sales_head']) {
  if(role==='sales_head') {
   await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
   await login(role,db.passwords.DEMO_SALES_HEAD_PASSWORD);await page.setViewportSize({width:390,height:844});
   await page.goto(`${origin}/#rfq=${fixture.rfqId}&version=${versionId}`);await status('issued');
  }
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Download customer PDF'}).click();const download=await waiting;
  assert.equal(download.suggestedFilename(),`FQ-${versionId}.pdf`);assert.equal(await download.failure(),null);
  await download.saveAs(`.tmp/t05-pdf/browser-${role}.pdf`);
  const result=await inspectPdf(await readFile(`.tmp/t05-pdf/browser-${role}.pdf`));
  for(const text of [versionId,'₹8,26,50,240.00','₹1,48,77,043.20','₹9,75,27,283.20','T03-3-gear blank'])assert.ok(result.text.includes(text),text);
  assert.ok(!result.text.includes('marginPercent'));assert.ok(!result.text.includes('Manufacturing'));
 }
 await page.screenshot({path:'.tmp/t05-pdf/download-mobile.png',fullPage:true});
 await quotes.createDraftVersion(estimator,request);await page.getByRole('button',{name:'Refresh lifecycle'}).click();
 await page.getByRole('status').filter({hasText:'Superseded by a newer version'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Download customer PDF'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: T05 Chrome issued-only download for both roles, attachment filename, saved multipart totals/rupee, visible failure/retry, mobile and superseded-version controls.');
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
