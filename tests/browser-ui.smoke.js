import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {browserTestDatabase} from './helpers/database.js';

const db=await browserTestDatabase();
let app,browser;
const server=createServer((req,res)=>app(req,res));
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema});
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(15000);
  await mkdir('.tmp/visual-v2/ui',{recursive:true});
  async function capture(screen) {
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:width===390?844:1000});
      await page.evaluate(()=>window.scrollTo(0,0));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${screen} overflow at ${width}`);
      await page.screenshot({path:`.tmp/visual-v2/ui/${screen}-${width}.png`,fullPage:true});
      await page.screenshot({path:`.tmp/visual-v2/ui/${screen}-${width}-viewport.png`});
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  async function login(role,password) {
    await page.getByLabel('Demo identity').selectOption(role);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:`Signed in as ${role}`,exact:true}).waitFor();
  }
  await page.goto(origin);await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();await capture('login');
  await login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
  const nav=page.getByRole('navigation',{name:'Workspace navigation'});
  assert.equal(await nav.getByRole('link',{name:'Approvals',exact:true}).count(),0);
  await page.getByRole('table',{name:'RFQ register',exact:true}).waitFor();await capture('register');
  assert.equal(await page.getByRole('link',{name:'View rate catalogue',exact:true}).count(),0);
  assert.equal(await page.locator('.sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width)),224);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.getByRole('link',{name:'Open RFQ',exact:true}).first().evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=44;}),'Leading mobile RFQ action is visible');
  const registerScroll=page.getByRole('region',{name:'RFQ register scroll area',exact:true});
  await registerScroll.focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('.register-table .table-scroll').scrollLeft>0);
  await page.screenshot({path:'.tmp/visual-v2/ui/register-scrolled-390.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await nav.getByRole('link',{name:'RFQs',exact:true}).focus();await page.keyboard.press('Tab');
  assert.equal(await nav.getByRole('link',{name:'Rate catalogue',exact:true}).evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  await page.getByLabel('RFQ reference',{exact:true}).fill('SYNTH-UI-UNSAVED');
  assert.equal(await nav.getByRole('link',{name:'Rate catalogue',exact:true}).getAttribute('target'),'_blank');
  const popupPromise=page.waitForEvent('popup');await nav.getByRole('link',{name:'Rate catalogue',exact:true}).click();
  const popup=await popupPromise;await popup.getByRole('heading',{name:'Rate catalogue',exact:true}).waitFor();await popup.close();
  assert.equal(await page.getByLabel('RFQ reference',{exact:true}).inputValue(),'SYNTH-UI-UNSAVED');
  await capture('intake');
  await page.getByRole('button',{name:'Add part',exact:true}).click();
  for(const n of [1,2]){
    const part=page.getByRole('group',{name:`Part ${n}`,exact:true});
    for(const [label,value] of [['Part number',`SYNTH-UI-${n}`],['Description','Synthetic UI component'],['Gross weight (kg)','0.61'],['Annual quantity','1000'],['Cycle time (minutes)','3.2'],['Setup hours per batch','12']])await part.getByLabel(label,{exact:true}).fill(value);
    await part.getByRole('button',{name:`Use suggested keys for part ${n}`,exact:true}).click();
  }
  assert.equal(await page.getByRole('table',{name:'Rate-key assignment',exact:true}).getByRole('combobox').count(),12);
  await capture('matrix');
  for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await page.locator('.rate-assignment').screenshot({path:`.tmp/visual-v2/ui/matrix-detail-${width}.png`});}
  await page.getByRole('button',{name:'Back to register',exact:true}).click();
  await page.getByRole('link',{name:'Open RFQ',exact:true}).click();
  await page.getByLabel('Pricing date').fill('2026-11-02');await page.getByRole('button',{name:'Calculate & save draft',exact:true}).click();
  const lifecycle=page.getByRole('region',{name:'Quotation lifecycle',exact:true});
  await lifecycle.getByRole('status').filter({hasText:'Quotation status: draft'}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Saved annual baseline',exact:true}).locator('.headline-price').innerText(),'₹2,69,46,000.00');
  assert.equal(await page.locator('.title-block').getByText('Assigned estimator',{exact:true}).count(),1);
  assert.equal(await page.getByRole('status').filter({hasText:'RFQ status: estimating'}).count(),1);
  await capture('detail');
  await lifecycle.getByRole('button',{name:'Submit for clearance',exact:true}).click();await lifecycle.getByRole('status').filter({hasText:'Quotation status: pending'}).waitFor();
  assert.equal(await page.getByRole('list',{name:'Lifecycle event history',exact:true}).locator('time').count(),1);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
  await nav.getByRole('link',{name:'Approvals',exact:true}).click();
  await page.getByRole('link',{name:/RFQ-2611-014.*Version 1/}).waitFor();
  assert.equal(await page.getByRole('table',{name:'Pending approvals',exact:true}).getByRole('row').count(),2);
  assert.equal(await page.getByText('Estimator workspace',{exact:true}).count(),0);await capture('approvals');
  await page.getByRole('link',{name:/RFQ-2611-014.*Version 1/}).click();
  await page.getByRole('button',{name:'Approve version',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Saved costing inputs',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Calculate & save draft',exact:true}).count(),0);await capture('sales-review');
  await nav.getByRole('link',{name:'Rate catalogue',exact:true}).click();
  await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();await capture('rates');
  await page.getByRole('table',{name:'Rate catalogue',exact:true}).getByText('100',{exact:true}).waitFor();
  await page.getByText('History for EN8 (1 versions)',{exact:true}).click();
  await page.getByText('Exact: 100.000000',{exact:true}).waitFor();
  await capture('rate-history');
  const colors=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    return Object.fromEntries(['canvas','panel','raised','text','secondary','tertiary','action','settled','error'].map(key=>[key,css.getPropertyValue(`--${key}`).trim()]));
  });
  const luminance=hex=>{const channels=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const checks={};
  for(const fg of ['text','secondary','tertiary','settled','error'])for(const bg of ['canvas','panel','raised']) {
    const ratio=contrast(colors[fg],colors[bg]);assert.ok(ratio>=4.5,`${fg}/${bg}: ${ratio}`);checks[`${fg}/${bg}`]=ratio.toFixed(2);
  }
  checks['action button']=contrast(colors.canvas,colors.action).toFixed(2);assert.ok(Number(checks['action button'])>=4.5);
  await writeFile('.tmp/visual-v2/ui/contrast.json',JSON.stringify(checks,null,2));
  assert.deepEqual(errors,[]);
  console.log('PASS: UI role navigation, keyboard focus, unsaved intake preservation, saved golden baseline, ledger, Sales Head read-only costing, full-page/viewport screenshots at 1440x1000 and 390x844, text/action contrast.');
} finally {
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));app?.locals.sessionStore.close();await db.close();
}
