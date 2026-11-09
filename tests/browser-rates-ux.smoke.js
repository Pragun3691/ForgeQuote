import {rateControls} from './helpers/rate-key-controls.js';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {browserTestDatabase} from './helpers/database.js';
import {createApp} from '../apps/api/src/app.js';
import {fixtureId} from '../apps/api/src/seed.js';

const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
try {
 const alternate=randomUUID(),missing=randomUUID();
 await db.owner.query("INSERT INTO rate_keys(id,code,category,unit) VALUES ($1,'ALT-MATERIAL','material','INR/kg'),($2,'NO-FREIGHT-HISTORY','freight','INR/piece')",[alternate,missing]);
 await db.owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-02','110.123456'),($3,$4,'2026-11-04','200.000001')",[randomUUID(),alternate,randomUUID(),fixtureId(1)]);
 app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,aiConfig:{apiKey:'',model:'gemini-3.5-flash-lite',timeoutMs:1000,unavailableCode:'AI_NOT_CONFIGURED'}});
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.name));
 async function login(role,password){await page.goto(origin);await page.getByLabel('Demo identity').selectOption(role);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:`Signed in as ${role}`,exact:true}).waitFor();}
 await login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
 await page.getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();
 await page.getByLabel('Rate category',{exact:true}).selectOption('material');await page.getByLabel('Rates as of',{exact:true}).fill('2026-11-03');
 await page.getByRole('table',{name:'Rate catalogue',exact:true}).getByRole('row').filter({hasText:'EN8'}).getByText('100',{exact:true}).waitFor();
 const history=page.getByText('History for EN8 (2 versions)',{exact:true});await history.focus();await page.keyboard.press('Enter');
 assert.equal(await history.evaluate(e=>e.parentElement.open),true);await page.getByRole('table',{name:'EN8 rate history',exact:true}).getByText('04 Nov 2026',{exact:true}).first().waitFor();
 await page.getByLabel('Rates as of',{exact:true}).fill('2026-11-01');await page.getByText('No effective rate for 2026-11-01. Costing at this date will fail.',{exact:true}).first().waitFor();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mkdir('.tmp/t06-browser',{recursive:true});await page.screenshot({path:'.tmp/t06-browser/rates-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'RFQs',exact:true}).click();await page.getByRole('button',{name:'New RFQ',exact:true}).click();
 await page.getByLabel('RFQ reference',{exact:true}).fill('SYNTH-T06-BROWSER');await page.getByLabel('Customer name',{exact:true}).fill('Synthetic T06 Customer');await page.getByLabel('Due date',{exact:true}).fill('2026-11-07');
 const part=n=>page.getByRole('group',{name:`Part ${n}`,exact:true});
 await part(1).getByLabel('Part number',{exact:true}).waitFor({state:'visible'});
 assert.equal(await rateControls(page,1).getByLabel('Machine rate key',{exact:true}).inputValue(),'');assert.equal(await rateControls(page,1).getByLabel('Material rate key',{exact:true}).inputValue(),'');
 const suggestions=part(1).locator('.key-suggestions');await suggestions.waitFor();assert.ok(!(await suggestions.innerText()).includes('material:'));
 await page.getByRole('button',{name:'Add part',exact:true}).click();
 for(const n of [1,2])for(const [label,value] of [['Part number',`T06-P${n}`],['Description',`Synthetic part ${n}`],['Annual quantity','1000'],['Gross weight (kg)','0.61'],['Cycle time (minutes)','3.2'],['Setup hours per batch','12']])await part(n).getByLabel(label,{exact:true}).fill(value);
 const opened=page.context().waitForEvent('page');await page.getByRole('link',{name:'Inspect rate history (new tab)',exact:true}).click();const catalogueTab=await opened;await catalogueTab.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();await catalogueTab.close();assert.equal(await part(1).getByLabel('Part number',{exact:true}).inputValue(),'T06-P1');
 const review=page.getByRole('checkbox',{name:/I reviewed the RFQ and all/});await review.check();
 await part(1).getByRole('button',{name:'Use suggested keys for part 1',exact:true}).click();assert.equal(await review.isChecked(),false);assert.equal(await rateControls(page,1).getByLabel('Material rate key',{exact:true}).inputValue(),'');
 await rateControls(page,1).getByLabel('Material rate key',{exact:true}).selectOption(fixtureId(1));
 await part(2).getByRole('button',{name:'Use suggested keys for part 2',exact:true}).click();await rateControls(page,2).getByLabel('Material rate key',{exact:true}).selectOption(alternate);
 await rateControls(page,2).getByLabel('Freight rate key',{exact:true}).selectOption(missing);await rateControls(page,2).getByText(/No effective freight rate on/).waitFor();
 await review.check();await page.getByRole('button',{name:'Apply common rate keys to all parts',exact:true}).click();await page.getByRole('button',{name:'Replace working inputs',exact:true}).click();assert.equal(await review.isChecked(),false);
 for(const n of [1,2])for(const [i,label] of ['Material','Machine','Scrap','Overhead','Packaging','Freight'].entries())assert.equal(await rateControls(page,n).getByLabel(`${label} rate key`,{exact:true}).inputValue(),fixtureId(i+1));
 assert.equal(await page.getByRole('button',{name:'Save RFQ',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:/Go to part 2:/}).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'rfq-intake-part-1');
 await page.keyboard.press('Tab');assert.equal(await part(2).getByLabel('Part number',{exact:true}).evaluate(e=>e===document.activeElement),true);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No horizontal overflow at ${width}`);if(width===390)await page.screenshot({path:'.tmp/t06-browser/components-mobile.png',fullPage:true});}
 await page.screenshot({path:'.tmp/t06-browser/components-desktop.png',fullPage:true});
 await review.check();await part(2).getByLabel('Annual quantity',{exact:true}).fill('1200');assert.equal(await review.isChecked(),false);await review.check();
 await page.getByRole('button',{name:'Save RFQ',exact:true}).click();await page.getByRole('row').filter({hasText:'SYNTH-T06-BROWSER'}).waitFor();
 assert.equal((await db.owner.query("SELECT count(*) FROM rfq_parts p JOIN rfqs r ON r.id=p.rfq_id WHERE r.reference='SYNTH-T06-BROWSER'")).rows[0].count,'2');
 const persisted=(await db.owner.query("SELECT p.part_number,p.requested_annual_qty,p.material_rate_key_id,p.freight_rate_key_id FROM rfq_parts p JOIN rfqs r ON r.id=p.rfq_id WHERE r.reference='SYNTH-T06-BROWSER' ORDER BY p.part_number")).rows;assert.deepEqual(persisted,[{part_number:'T06-P1',requested_annual_qty:'1000',material_rate_key_id:fixtureId(1),freight_rate_key_id:fixtureId(6)},{part_number:'T06-P2',requested_annual_qty:'1200',material_rate_key_id:fixtureId(1),freight_rate_key_id:fixtureId(6)}]);
 // Matrix boundary and deletion preserve the assignments of surviving parts.
 await page.getByRole('button',{name:'New RFQ',exact:true}).click();await page.getByRole('button',{name:'Create another RFQ',exact:true}).click();
 for(let n=1;n<20;n++)await page.getByRole('button',{name:'Add part',exact:true}).click();
 const matrix=page.getByRole('table',{name:'Rate-key assignment',exact:true});assert.equal(await matrix.getByRole('combobox').count(),120);
 assert.equal(await page.getByRole('button',{name:'Add part',exact:true}).isDisabled(),true);
 await rateControls(page,1).getByLabel('Material rate key',{exact:true}).selectOption(fixtureId(1));
 await rateControls(page,2).getByLabel('Material rate key',{exact:true}).selectOption(alternate);
 await rateControls(page,3).getByLabel('Material rate key',{exact:true}).selectOption(fixtureId(1));
 await page.getByRole('button',{name:'Remove part 2',exact:true}).click();assert.equal(await rateControls(page,2).getByLabel('Material rate key',{exact:true}).inputValue(),fixtureId(1));
 await review.check();await rateControls(page,2).getByLabel('Freight rate key',{exact:true}).selectOption(missing);assert.equal(await review.isChecked(),false);
 await mkdir('.tmp/tier2',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`.tmp/tier2/matrix-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();await login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
 await page.getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Save rate version',exact:true}).count(),1);assert.deepEqual(errors,[]);
 console.log('PASS: T06 both-role rate catalogue/history/date boundaries, role-based authoring capability, explicit key suggestions/common copying, missing-rate warning, human confirmation/reset, keyboard part navigation, multipart save and 320/390px layouts.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
