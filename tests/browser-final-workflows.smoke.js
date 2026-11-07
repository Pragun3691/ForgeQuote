import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {browserTestDatabase} from './helpers/database.js';
import {createApp} from '../apps/api/src/app.js';
import {createQuotationService} from '../apps/api/src/quotations.js';
import {createLifecycleService} from '../apps/api/src/quotation-lifecycle.js';
import {fixtureId} from '../apps/api/src/seed.js';
import {businessDate} from '../apps/api/src/final-workflows.js';

const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
try {
 app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema});
 const e=(await db.owner.query("SELECT id FROM users WHERE role='estimator'")).rows[0].id;
 const quotes=createQuotationService(db.runtime,{gstPercent:'18'}),life=createLifecycleService(db.runtime);
 const input={rfqId:fixtureId(21),pricingDate:'2026-11-02',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20',requestedAnnualQty:'1000',tierQuantities:{'50':'500','100':'1000','150':'1500'}}]};
 const old=await quotes.createDraftVersion(e,input),latest=await quotes.createDraftVersion(e,input);
 await life.act(e,latest.versionId,'submit',crypto.randomUUID(),{});await life.act(e,latest.versionId,'issue',crypto.randomUUID(),{});
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',err=>errors.push(err.message));
 async function login(role,password){await page.goto(origin);await page.getByLabel('Demo identity').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:`Signed in as ${role}`,exact:true}).waitFor();}
 await login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
 await page.getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();
 await page.getByLabel('Rate key',{exact:true}).selectOption(fixtureId(1));await page.getByLabel('New decimal value',{exact:true}).fill('123.123456');await page.getByLabel('Effective-from date',{exact:true}).fill(businessDate());await page.getByLabel('Rate change reason',{exact:true}).fill('Synthetic browser rate revision');
 let lost=false;await page.route('**/api/rates/*/versions',async route=>{if(!lost){lost=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByRole('button',{name:'Save rate version',exact:true}).click();await page.getByRole('button',{name:'Retry same rate request',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Retry same rate request',exact:true}).click();await page.getByRole('button',{name:'Save rate version',exact:true}).waitFor();
 assert.equal((await db.owner.query('SELECT count(*) FROM rate_versions WHERE actor_user_id IS NOT NULL')).rows[0].count,'1');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.goto(`${origin}/#rfq=${fixtureId(21)}&version=${old.versionId}`);await page.getByRole('button',{name:'Download INTERNAL costing PDF',exact:true}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download INTERNAL costing PDF',exact:true}).click();assert.equal((await download).suggestedFilename(),`INTERNAL-${old.versionId}.pdf`);
 assert.equal(await page.getByRole('button',{name:'Download customer PDF',exact:true}).count(),0);
 await page.getByLabel('Lost reason',{exact:true}).fill('Synthetic customer declined');
 let outcomeLost=false;await page.route('**/api/rfqs/*/outcomes',async route=>{if(!outcomeLost){outcomeLost=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByRole('button',{name:'Mark RFQ lost',exact:true}).click();await page.getByRole('button',{name:'Retry same outcome request',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Retry same outcome request',exact:true}).click();
 await page.getByRole('status').filter({hasText:'RFQ status: lost'}).waitFor();await page.getByRole('list',{name:'RFQ outcome history'}).getByText(/Synthetic customer declined/).waitFor();
 assert.equal((await db.owner.query('SELECT count(*) FROM rfq_outcomes')).rows[0].count,'1');assert.equal(await page.getByRole('button',{name:'Mark RFQ won',exact:true}).count(),0);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
 await page.getByRole('row').filter({hasText:'RFQ-2611-014'}).getByText('lost',{exact:true}).waitFor();await page.getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save rate version',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: final workflow Chrome: Sales Head rate authoring, committed-response-loss recovery, historical internal PDF, terminal lost/recovery, register status and estimator denial at 390px.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
