import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {browserTestDatabase} from './helpers/database.js';
import {fixtureId} from '../apps/api/src/seed.js';
import {rateControls} from './helpers/rate-key-controls.js';
const db=await browserTestDatabase();let app,browser;
const server=createServer((req,res)=>app(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
await mkdir('.tmp/m5',{recursive:true});
try {
 app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],posts=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/rfqs'))posts.push(r.postDataJSON());});
 await page.goto(origin);await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const part=n=>page.getByRole('group',{name:`Part ${n}`,exact:true}),review=page.getByRole('checkbox',{name:/I reviewed the RFQ/});
 async function fill(n){for(const [label,value] of [['Part number',`SYNTH-${n}`],['Description','Synthetic spindle'],['Annual quantity','1000000000'],['Gross weight (kg)','0.610000'],['Cycle time (minutes)','3.200000'],['Setup hours per batch','0.000000']])await part(n).getByLabel(label,{exact:true}).fill(value);for(const [i,label]of ['Material','Machine','Scrap','Overhead','Packaging','Freight'].entries())await rateControls(page,n).getByLabel(`${label} rate key`,{exact:true}).selectOption(fixtureId(i+1));}
 async function capture(name,target){for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:width===768?1024:width<400?844:1000});await page.locator(target).first().evaluate(el=>el.scrollIntoView({block:'start'}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflow ${width}`);await page.screenshot({path:`.tmp/m5/${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});}
 for(const count of [1,2,20]){
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();if(count!==1)await page.getByRole('button',{name:'Create another RFQ',exact:true}).click();
  await page.getByLabel('RFQ reference',{exact:true}).fill(`SYNTH-M5-${count}`);await page.getByLabel('Customer name',{exact:true}).fill('Synthetic M5 customer');await page.getByLabel('Due date',{exact:true}).fill('2026-11-20');
  for(let n=1;n<=count;n++){if(n>1)await page.getByRole('button',{name:'Add part',exact:true}).click();await fill(n);}
  if(count===1){await part(1).getByLabel('Annual quantity',{exact:true}).fill('1000000001');await review.check();await page.getByRole('button',{name:'Save RFQ',exact:true}).click();const summary=page.getByRole('region',{name:'RFQ validation errors'});await summary.waitFor();assert.equal(await summary.evaluate(el=>el===document.activeElement),true);assert.equal(posts.length,0);await capture('validation','.validation-summary');await summary.getByRole('button',{name:/Annual quantity/}).click();assert.equal(await part(1).getByLabel('Annual quantity',{exact:true}).evaluate(el=>el===document.activeElement),true);await part(1).getByLabel('Annual quantity',{exact:true}).fill('1000000000');await capture('single-part','.intake-part');
   await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:'RFQs',exact:true}).click();await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor();await page.getByRole('link',{name:'Rate catalogue',exact:true}).click();await page.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();await page.goBack();await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor();await page.getByRole('button',{name:'New RFQ',exact:true}).click();assert.equal(await part(1).getByLabel('Gross weight (kg)',{exact:true}).inputValue(),'0.610000');
  }
  if(count===2){await part(2).getByLabel('Part number',{exact:true}).fill(' SYNTH-1 ');await review.check();await page.getByRole('button',{name:'Save RFQ',exact:true}).click();await page.getByRole('region',{name:'RFQ validation errors'}).waitFor();assert.equal(posts.length,1);await part(2).getByLabel('Part number',{exact:true}).fill('SYNTH-2');
   await part(2).getByLabel('Description',{exact:true}).evaluate(el=>el.dataset.identity='survivor');await page.getByRole('button',{name:'Remove part 1',exact:true}).click();assert.equal(await part(1).getByLabel('Description',{exact:true}).getAttribute('data-identity'),'survivor');assert.equal(await part(1).getByLabel('Part number',{exact:true}).inputValue(),'SYNTH-2');await page.getByRole('button',{name:'Undo removal',exact:true}).click();assert.equal(await part(2).getByLabel('Description',{exact:true}).getAttribute('data-identity'),'survivor');
   await review.check();await page.getByRole('button',{name:'Apply common rate keys to all parts',exact:true}).click();await page.getByRole('button',{name:'Keep current inputs',exact:true}).click();assert.equal(await review.isChecked(),true);await page.getByRole('button',{name:'Apply common rate keys to all parts',exact:true}).click();await page.getByRole('button',{name:'Replace working inputs',exact:true}).click();assert.equal(await review.isChecked(),false);await capture('matrix','.rate-assignment');
  }
  if(count===20){assert.equal(await page.getByRole('button',{name:'Add part',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('table',{name:'Rate-key assignment',exact:true}).getByRole('combobox').count(),120);await capture('twenty-matrix','.rate-assignment');}
  await review.check();await page.getByRole('button',{name:'Save RFQ',exact:true}).click();await page.getByRole('row').filter({hasText:`SYNTH-M5-${count}`}).waitFor();const last=posts.at(-1);assert.equal(last.parts.length,count);assert.equal(last.parts[0].grossWeightKg,'0.610000');assert.equal(last.parts[0].requestedAnnualQty,'1000000000');assert.deepEqual(Object.keys(last.parts[0]).sort(),['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch','rateKeys'].sort());
 }
 assert.deepEqual(errors,[]);await writeFile('.tmp/m5/results.json',JSON.stringify({passed:true,parts:[1,2,20],widths:[1440,768,390,320],posts:posts.length}));console.log('PASS M5: exact frontend bounds, 1/2/20 real RFQ saves, no writes on validation, stable surviving DOM, undo, replacement cancel/confirm, draft navigation and four viewport checks.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
