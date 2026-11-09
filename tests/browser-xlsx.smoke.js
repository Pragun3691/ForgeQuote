import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createApp } from '../apps/api/src/app.js';
import { fixtureId } from '../apps/api/src/seed.js';
import { browserTestDatabase } from './helpers/database.js';
import { syntheticWorkbook,inline,numeric } from '../apps/api/test/fixtures/xlsx.js';

const db=await browserTestDatabase();let browser,providerCalls=0;
// Pick an ephemeral port first, then configure the exact Origin.
import { createServer } from 'node:http';
let app;const http=createServer((req,res)=>app(req,res));http.listen(0,'127.0.0.1');await once(http,'listening');const origin=`http://127.0.0.1:${http.address().port}`;
app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,aiConfig:{apiKey:'test-only',model:'gemini-3.5-flash-lite',timeoutMs:1000,unavailableCode:null},aiGenerateContent:async()=>{providerCalls++;throw Error('Excel must not call Gemini');}});
try {
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  const reference=page.getByLabel('RFQ reference',{exact:true});await reference.fill('SYNTH-XLSX-BROWSER');await page.getByLabel('Customer name',{exact:true}).fill('Synthetic Excel Customer');await page.getByLabel('Due date',{exact:true}).fill('2026-11-07');
  await page.getByText('Import Excel part list (optional)',{exact:true}).click();
  const example=await page.request.get(`${origin}/synthetic-rfq.xlsx`);assert.equal(example.status(),200);assert.deepEqual(await example.body(),syntheticWorkbook());
  const file=page.getByLabel('Synthetic Excel RFQ',{exact:true}),attest=page.getByRole('checkbox',{name:/I confirm this workbook/}),reviewImport=page.getByRole('button',{name:'Review Excel import',exact:true});
  await file.setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:syntheticWorkbook()});assert.equal(await reviewImport.isDisabled(),true);
  await attest.check();await reviewImport.click();await page.getByRole('region',{name:'Excel import review'}).waitFor();
  await page.getByRole('region',{name:'Imported component summary',exact:true}).waitFor();
  assert.equal(await page.locator('.evidence-section[open]').count(),0);
  await page.getByText('Cell evidence for imported part 1',{exact:true}).click();
  await page.getByText('Synthetic Parts!C2 · header C1: Gross weight (kg)',{exact:true}).waitFor();
  assert.equal((await db.owner.query('SELECT count(*) FROM rfq_submissions')).rows[0].count,'0');assert.equal(providerCalls,0);
  await mkdir('.tmp',{recursive:true});await page.screenshot({path:'.tmp/t02-xlsx-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.tmp/t02-xlsx-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Use imported parts',exact:true}).click();if(await page.getByRole('dialog',{name:'Review replacement'}).count())await page.getByRole('button',{name:'Replace working inputs',exact:true}).click();assert.equal(await reference.inputValue(),'SYNTH-XLSX-BROWSER');
  const part=page.getByRole('group',{name:'Part 1',exact:true}),confirm=page.getByRole('checkbox',{name:/I reviewed the RFQ and all/});
  assert.equal(await part.getByLabel('Gross weight (kg)',{exact:true}).inputValue(),'0.61');assert.equal(await part.getByLabel('Material rate key',{exact:true}).inputValue(),'');assert.equal(await confirm.isChecked(),false);
  for(const [i,category] of ['Material','Machine','Scrap','Overhead','Packaging','Freight'].entries())await part.getByLabel(`${category} rate key`,{exact:true}).selectOption(fixtureId(i+1));
  await confirm.check();await part.getByLabel('Annual quantity',{exact:true}).fill('24000');assert.equal(await confirm.isChecked(),false);await confirm.check();
  // Lose the committed response, refresh, and explicitly recover the same key.
  await page.route('**/api/rfqs',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort('failed');}else await route.continue();});
  await page.getByRole('button',{name:'Save RFQ',exact:true}).click();await page.getByRole('button',{name:'Retry same RFQ submission',exact:true}).waitFor();
  const pendingBefore=await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage).filter(([k])=>k.startsWith('forgequote:rfq-intake:'))));
  await page.unroute('**/api/rfqs');await page.reload(); // The intake route restores recovery directly.
  await page.getByRole('button',{name:'Retry same RFQ submission',exact:true}).click();await page.getByRole('row').filter({hasText:'SYNTH-XLSX-BROWSER'}).waitFor();
  assert.equal((await db.owner.query('SELECT count(*) FROM rfq_submissions')).rows[0].count,'1');assert.ok(Object.keys(pendingBefore).length===1);
  const facts=(await db.owner.query("SELECT p.gross_weight_kg,p.requested_annual_qty FROM rfq_parts p JOIN rfqs r ON r.id=p.rfq_id WHERE r.reference='SYNTH-XLSX-BROWSER'")).rows[0];assert.deepEqual(facts,{gross_weight_kg:'0.610000',requested_annual_qty:'24000'});
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();await page.getByRole('button',{name:'Create another RFQ',exact:true}).click();await page.getByText('Import Excel part list (optional)',{exact:true}).click();
  // Legal maximum-length unbroken values must remain readable, not merely avoid page overflow.
  await file.setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:syntheticWorkbook({rows:`<row r="2">${inline('A2','S'.repeat(80))}${inline('B2','D'.repeat(500))}${numeric('C2','0.61')}${numeric('D2','1')}</row>`})});
  await attest.check();await reviewImport.click();await page.getByRole('region',{name:'Excel import review'}).waitFor();
  await page.getByText('Cell evidence for imported part 1',{exact:true}).click();
  const overflowing=()=>page.locator('.evidence-field').evaluateAll(cards=>cards.some(card=>card.scrollWidth>card.clientWidth+1 || [...card.querySelectorAll('p')].some(p=>p.scrollWidth>p.clientWidth+1)));
  for(const width of [390,320,1280]) {await page.setViewportSize({width,height:844});assert.equal(await overflowing(),false,`Excel evidence clips at ${width}px`);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.tmp/t02-xlsx-long-mobile.png',fullPage:true});
  assert.equal((await db.owner.query('SELECT count(*) FROM rfq_submissions')).rows[0].count,'1');
  await file.setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:syntheticWorkbook({rows:`<row r="2">${inline('A2','A')}${inline('B2','Synthetic')}<c r="C2"><f>1/2</f><v>0.5</v></c>${numeric('D2','1')}</row>`})});
  await attest.check();await reviewImport.click();await page.getByRole('alert').filter({hasText:'Unsupported or invalid XLSX'}).waitFor();
  await page.getByRole('button',{name:'Continue manually',exact:true}).first().click();await reference.fill('SYNTH-MANUAL-AFTER-FAILURE');
  assert.equal(providerCalls,0);assert.deepEqual(errors,[]);
  console.log('PASS: real Chrome + disposable PostgreSQL Excel import: attestation, exact cell evidence, review/correction/keys/confirmation, unchanged atomic save and lost-response same-key recovery, formula rejection/manual fallback, zero Gemini calls and mobile layout.');
} finally {await browser?.close();app.locals.sessionStore.close();await new Promise(resolve=>http.close(resolve));await db.close();}
