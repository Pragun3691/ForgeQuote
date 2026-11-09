import {rateControls} from './helpers/rate-key-controls.js';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createApp } from '../apps/api/src/app.js';
import { fixtureId } from '../apps/api/src/seed.js';
import { browserTestDatabase } from './helpers/database.js';
import { syntheticSource, syntheticSuggestion, fakeGeminiResponse } from '../apps/api/test/fixtures/synthetic-rfq.js';

// Real Chrome + PostgreSQL, explicitly mocked provider. Never claims live connectivity.
const db=await browserTestDatabase();let app,browser,mode='success',calls=0;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,
    aiConfig:{apiKey:'test-only-not-a-real-key',model:'gemini-3.5-flash-lite',timeoutMs:1000,unavailableCode:null},aiGenerateContent:async()=>{
      calls++;await delay(150);if(mode==='quota') throw {status:429};
      const suggestion=syntheticSuggestion();suggestion.parts[1].fields.requestedAnnualQty.status='ambiguous';
      suggestion.parts[1].fields.cycleTimeMin=structuredClone(suggestion.parts[0].fields.cycleTimeMin);
      return fakeGeminiResponse(suggestion);
    }});
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  const aiToggle=()=>page.getByText('Extract from text with AI (optional)',{exact:true});
  const source=()=>page.getByLabel('Synthetic RFQ email or plain text',{exact:true});
  const extract=()=>page.getByRole('button',{name:'Extract with AI',exact:true});
  const review=()=>page.getByRole('checkbox',{name:/I reviewed the RFQ and all/});
  async function consent() {
    await page.getByRole('checkbox',{name:/I confirm this text is entirely synthetic/}).check();
    await page.getByRole('checkbox',{name:/I consent to sending this text/}).check();
  }
  async function rateKeys(index) {
    const part=page.getByRole('group',{name:`Part ${index}`,exact:true});
    for(const [i,category] of ['Material','Machine','Scrap','Overhead','Packaging','Freight'].entries()) await rateControls(page,index).getByLabel(`${category} rate key`,{exact:true}).selectOption(fixtureId(i+1));
  }
  await aiToggle().click();await source().fill(syntheticSource);
  assert.equal(await extract().isDisabled(),true);assert.equal(calls,0);
  await consent();await extract().click();await page.getByRole('status').filter({hasText:'Extracting with Gemini'}).waitFor();
  await page.getByRole('region',{name:'Extraction review'}).waitFor();assert.equal(calls,1);
  // Editing an already-reviewed source clears stale evidence and both consents.
  const reviewedSource=syntheticSource+'\n';await source().fill(reviewedSource);
  assert.equal(await page.getByRole('region',{name:'Extraction review'}).count(),0);
  assert.equal(await page.getByRole('checkbox',{name:/I confirm this text is entirely synthetic/}).isChecked(),false);
  assert.equal(await page.getByRole('checkbox',{name:/I consent to sending this text/}).isChecked(),false);
  assert.equal(await extract().isDisabled(),true);
  await consent();await extract().click();await page.getByRole('region',{name:'Extraction review'}).waitFor();assert.equal(calls,2);
  assert.equal((await db.owner.query('SELECT count(*) FROM rfq_submissions')).rows[0].count,'0');
  await page.getByRole('region',{name:'Extracted component summary',exact:true}).waitFor();
  assert.equal(await page.locator('.evidence-section[open]').count(),0);
  for(const summary of await page.locator('.evidence-section > summary').all())await summary.click();
  const original=page.getByRole('region',{name:'Original submitted source',exact:true});
  assert.equal(await original.getByLabel('Original source text',{exact:true}).textContent(),reviewedSource);
  const sourceButton=page.getByRole('button',{name:'View source for Gross weight (kg), evidence 1',exact:true}).first();
  await sourceButton.click();assert.equal(await original.locator('mark').textContent(),'Gross weight: 610 g');
  assert.equal(await original.getByLabel('Original source text',{exact:true}).evaluate(el=>el===document.activeElement),true);
  await original.getByRole('button',{name:'Return to field',exact:true}).click();assert.equal(await sourceButton.evaluate(el=>el===document.activeElement),true);
  await page.getByText('Source highlight unavailable; review this quote manually.',{exact:true}).first().waitFor();
  await mkdir('.tmp/tier2',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`.tmp/tier2/evidence-${width}.png`,fullPage:true});await sourceButton.click();await page.waitForFunction(()=>{
    const region=document.querySelector('.evidence-source'),head=region.querySelector('h4').getBoundingClientRect(),mark=region.querySelector('mark').getBoundingClientRect();
    const top=innerWidth<=900?document.querySelector('.sidebar').getBoundingClientRect().bottom:0;
    return head.top>=top && mark.top>=top && mark.bottom<=innerHeight;
  });await page.screenshot({path:`.tmp/tier2/evidence-source-${width}.png`});}
  const second=page.getByRole('region',{name:'Suggested part 2',exact:true});await second.getByText('missing',{exact:true}).waitFor();
  await second.getByText('ambiguous',{exact:true}).waitFor();await second.getByText('unsupported',{exact:true}).waitFor();
  await page.getByRole('region',{name:'Suggested part 1',exact:true}).getByText('Gross weight: 610 g',{exact:true}).waitFor();
  await mkdir(new URL('../.tmp/',import.meta.url),{recursive:true});
  await page.getByRole('region',{name:'Extraction review'}).evaluate(element=>element.scrollIntoView({block:'start'}));
  await page.screenshot({path:'.tmp/t02-ai-review-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.getByRole('region',{name:'Extraction review'}).evaluate(element=>element.scrollIntoView({block:'start'}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'.tmp/t02-ai-review-mobile.png'});
  await page.getByRole('button',{name:'Use verified suggestions',exact:true}).click();if(await page.getByRole('dialog',{name:'Review replacement'}).count())await page.getByRole('button',{name:'Replace working inputs',exact:true}).click();
  assert.equal(await page.getByLabel('RFQ reference',{exact:true}).inputValue(),'SYNTH-AI-001');
  const part1=page.getByRole('group',{name:'Part 1',exact:true}),part2=page.getByRole('group',{name:'Part 2',exact:true});
  assert.equal(await part1.getByLabel('Gross weight (kg)',{exact:true}).inputValue(),'0.61');
  assert.equal(await part1.getByLabel('Cycle time (minutes)',{exact:true}).inputValue(),'3.2');
  assert.equal(await part2.getByLabel('Setup hours per batch',{exact:true}).inputValue(),'');
  assert.equal(await part2.getByLabel('Cycle time (minutes)',{exact:true}).inputValue(),'');assert.equal(await part2.getByLabel('Annual quantity',{exact:true}).inputValue(),'');
  assert.equal(await rateControls(page,1).getByLabel('Material rate key',{exact:true}).inputValue(),'');assert.equal(await review().isChecked(),false);
  await page.getByLabel('Customer name',{exact:true}).fill('Synthetic AI Human Correction');
  await part2.getByLabel('Setup hours per batch',{exact:true}).fill('24');await part2.getByLabel('Cycle time (minutes)',{exact:true}).fill('11.5');await rateKeys(1);await rateKeys(2);
  await review().check();await part2.getByLabel('Annual quantity',{exact:true}).fill('30000');assert.equal(await review().isChecked(),false);await review().check();
  await page.getByRole('button',{name:'Save RFQ',exact:true}).click();
  const row=page.getByRole('row').filter({hasText:'SYNTH-AI-001'});await row.waitFor();await row.getByRole('link',{name:'Open RFQ',exact:true}).click();
  await page.getByRole('heading',{name:'SPINDLE-A',exact:true}).waitFor();await page.getByRole('heading',{name:'ARM-B',exact:true}).waitFor();
  const facts=(await db.owner.query("SELECT r.customer_name,p.part_number,p.requested_annual_qty FROM rfqs r JOIN rfq_parts p ON p.rfq_id=r.id WHERE r.reference='SYNTH-AI-001' ORDER BY p.part_number")).rows;
  assert.deepEqual(facts,[{customer_name:'Synthetic AI Human Correction',part_number:'ARM-B',requested_annual_qty:'30000'},{customer_name:'Synthetic AI Human Correction',part_number:'SPINDLE-A',requested_annual_qty:'180000'}]);
  await page.getByRole('link',{name:/RFQ register/}).click();await page.getByRole('button',{name:'New RFQ',exact:true}).click();await page.getByRole('button',{name:'Create another RFQ',exact:true}).click();
  mode='quota';await aiToggle().click();await source().fill(syntheticSource);
  assert.equal(await original.count(),0);
  assert.equal(await page.getByRole('checkbox',{name:/I confirm this text is entirely synthetic/}).isChecked(),false);
  assert.equal(await page.getByRole('checkbox',{name:/I consent to sending this text/}).isChecked(),false);
  await consent();await extract().click();
  await page.getByRole('alert').filter({hasText:'Gemini quota or rate limit reached'}).waitFor();
  assert.equal((await db.owner.query('SELECT count(*) FROM rfq_submissions')).rows[0].count,'1');
  await page.getByRole('button',{name:'Continue manually',exact:true}).click();
  await page.getByLabel('RFQ reference',{exact:true}).fill('RFQ-AI-MANUAL-FALLBACK');await page.getByLabel('Customer name',{exact:true}).fill('Synthetic Fallback Customer');await page.getByLabel('Due date',{exact:true}).fill('2026-11-07');
  for(const [label,value] of [['Part number','FALLBACK-A'],['Description','Synthetic manual fallback'],['Gross weight (kg)','0.61'],['Annual quantity','180000'],['Cycle time (minutes)','3.2'],['Setup hours per batch','12']]) await page.getByRole('group',{name:'Part 1',exact:true}).getByLabel(label,{exact:true}).fill(value);
  await rateKeys(1);await review().check();await page.getByRole('button',{name:'Save RFQ',exact:true}).click();
  await page.getByRole('row').filter({hasText:'RFQ-AI-MANUAL-FALLBACK'}).waitFor();assert.equal(calls,3);
  assert.equal((await db.owner.query('SELECT count(*) FROM rfq_submissions')).rows[0].count,'2');assert.deepEqual(errors,[]);
  console.log('PASS: real Chrome + PostgreSQL with MOCKED Gemini: explicit consent, multi-part evidence review, exact normalization, missing-field completion, human correction, manual key selection, confirmed register save, provider quota failure/manual fallback and mobile layout. LIVE CONNECTIVITY NOT TESTED.');
} finally {if(browser) await browser.close();app?.locals.sessionStore.close();await new Promise(resolve=>server.close(resolve));await db.close();}
