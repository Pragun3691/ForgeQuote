import {rateControls} from './helpers/rate-key-controls.js';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createApp } from '../apps/api/src/app.js';
import { readAiConfig } from '../apps/api/src/ai/gemini.js';
import { fixtureId } from '../apps/api/src/seed.js';
import { browserTestDatabase } from './helpers/database.js';
import { numberedBrowserSource,numberedSuggestion } from '../apps/api/test/fixtures/numbered-rfq.js';
import { fakeGeminiResponse } from '../apps/api/test/fixtures/synthetic-rfq.js';

const live=process.argv.includes('--live');
const aiConfig=live?readAiConfig():{apiKey:'test-only',model:'gemini-3.5-flash-lite',timeoutMs:1000,unavailableCode:null};
if(live)assert.ok(aiConfig.apiKey&&!aiConfig.unavailableCode,'Live numbered browser test requires configured Gemini');
const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,aiConfig,
  ...(!live?{aiGenerateContent:async()=>{const data=numberedSuggestion({headers:true});data.parts.reverse();const extra=structuredClone(data.parts[0]);extra.anchor='Unmatched synthetic proposal';extra.fields.partNumber={status:'present',rawValue:'UNKNOWN',evidence:['Part Number: UNKNOWN']};data.parts.push(extra);return fakeGeminiResponse(data);}}:{})});
try {
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  await page.getByText('Extract from text with AI (optional)',{exact:true}).click();await page.getByLabel('Synthetic RFQ email or plain text',{exact:true}).fill(numberedBrowserSource);
  await page.getByRole('checkbox',{name:/I confirm this text is entirely synthetic/}).check();await page.getByRole('checkbox',{name:/I consent to sending this text/}).check();
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/rfq-extraction')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Extract with AI',exact:true}).click();const response=await responsePromise;assert.equal(response.status(),200);const data=await response.json();
  assert.deepEqual(data.parts.map(p=>[p.sourcePartIndex,p.fields.partNumber.normalizedValue,p.fields.grossWeightKg.normalizedValue]),[[0,'SP-101','0.61'],[1,'BR-202','1.25']]);
  await page.getByRole('region',{name:'Extraction review',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:/^Suggested part \d+$/}).count(),2);
  if(!live)await page.getByText(/Unmatched model proposal 3.*Unmatched synthetic proposal/).waitFor();
  assert.equal((await db.owner.query('SELECT count(*) FROM rfq_submissions')).rows[0].count,'0');
  await mkdir('.tmp',{recursive:true});const suffix=live?'live':'mock';await page.screenshot({path:`.tmp/ai-numbered-${suffix}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`.tmp/ai-numbered-${suffix}-mobile.png`,fullPage:true});
  await page.getByRole('button',{name:'Use verified suggestions',exact:true}).click();if(await page.getByRole('dialog',{name:'Review replacement'}).count())await page.getByRole('button',{name:'Replace working inputs',exact:true}).click();assert.equal(await page.getByRole('group',{name:/^Part \d+$/}).count(),2);
  const expected=[['SP-101','Rear Wheel Spindle','0.61','180000'],['BR-202','Mounting Bracket','1.25','24000']];
  for(const [i,values] of expected.entries()) {
    const part=page.getByRole('group',{name:`Part ${i+1}`,exact:true});
    for(const [j,label] of ['Part number','Description','Gross weight (kg)','Annual quantity'].entries())assert.equal(await part.getByLabel(label,{exact:true}).inputValue(),values[j]);
    for(const label of ['Cycle time (minutes)','Setup hours per batch'])assert.equal(await part.getByLabel(label,{exact:true}).inputValue(),'');
    for(const category of ['Material','Machine','Scrap','Overhead','Packaging','Freight'])assert.equal(await rateControls(page,i+1).getByLabel(`${category} rate key`,{exact:true}).inputValue(),'');
  }
  const reviewed=page.getByRole('checkbox',{name:/I reviewed the RFQ and all/});assert.equal(await reviewed.isChecked(),false);assert.equal(await page.getByRole('button',{name:'Save RFQ',exact:true}).isDisabled(),true);
  for(let i=0;i<2;i++){const part=page.getByRole('group',{name:`Part ${i+1}`,exact:true});await part.getByLabel('Cycle time (minutes)',{exact:true}).fill(i?'11.5':'3.2');await part.getByLabel('Setup hours per batch',{exact:true}).fill(i?'24':'12');for(const [j,category] of ['Material','Machine','Scrap','Overhead','Packaging','Freight'].entries())await rateControls(page,i+1).getByLabel(`${category} rate key`,{exact:true}).selectOption(fixtureId(j+1));}
  await reviewed.check();await page.getByRole('button',{name:'Save RFQ',exact:true}).click();await page.getByRole('row').filter({hasText:'SYNTH-NUMBERED-001'}).waitFor();
  const facts=(await db.owner.query("SELECT p.part_number,p.gross_weight_kg,p.requested_annual_qty FROM rfq_parts p JOIN rfqs r ON r.id=p.rfq_id WHERE r.reference='SYNTH-NUMBERED-001' ORDER BY p.part_number")).rows;
  assert.deepEqual(facts,[{part_number:'BR-202',gross_weight_kg:'1.250000',requested_annual_qty:'24000'},{part_number:'SP-101',gross_weight_kg:'0.610000',requested_annual_qty:'180000'}]);assert.deepEqual(errors,[]);
  console.log(`PASS: ${live?'REAL GEMINI':'MOCKED Gemini'} + real Chrome/disposable PostgreSQL: two numbered source parts -> two ordered review parts -> two populated form parts; exact weights/quantities, missing cycle/setup and keys manual, explicit confirmation and saved two parts.${live?'':' Unmatched proposal remains visible as warning only.'}`);
} finally {await browser?.close();app.locals.sessionStore.close();await new Promise(resolve=>server.close(resolve));await db.close();}
