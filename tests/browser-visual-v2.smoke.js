import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {browserTestDatabase} from './helpers/database.js';
import {numberedBrowserSource,numberedSuggestion} from '../apps/api/test/fixtures/numbered-rfq.js';
import {fakeGeminiResponse} from '../apps/api/test/fixtures/synthetic-rfq.js';

// Real auth/API/PostgreSQL. Only the external Gemini provider is substituted.
const db=await browserTestDatabase();
let app,browser;
const server=createServer((req,res)=>app(req,res));
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
const directory='.tmp/visual-v2/review';
try {
  app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,
    aiConfig:{apiKey:'test-only',model:'gemini-3.5-flash-lite',timeoutMs:1000,unavailableCode:null},
    aiGenerateContent:async()=>fakeGeminiResponse(numberedSuggestion({headers:true}))});
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],captures=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await mkdir(directory,{recursive:true});
  async function capture(name) {
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:width===390?844:1000});await page.evaluate(()=>window.scrollTo(0,0));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: page overflow at ${width}`);
      const path=`${directory}/${name}-${width}.png`;
      await page.screenshot({path,fullPage:false});captures.push(path);
      await page.screenshot({path:`${directory}/${name}-${width}-full.png`,fullPage:true});
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  // Hold session reads explicitly; deterministic loading and failure states.
  let releaseSession;
  const heldSession=new Promise(resolve=>{releaseSession=resolve;});
  await page.route('**/api/auth/session',async route=>{await heldSession;await route.continue();});
  await page.goto(origin);await page.getByRole('status').filter({hasText:'Loading your session...'}).waitFor();
  await capture('login-loading');releaseSession();
  await page.getByLabel('Account').waitFor();await page.unroute('**/api/auth/session');
  await capture('login');
  // Native validation blocks an empty password before any login POST.
  let loginPosts=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/login')&&r.method()==='POST')loginPosts++;});
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  assert.equal(await page.locator('#password').evaluate(el=>el.validity.valueMissing),true);assert.equal(loginPosts,0);
  await page.getByLabel('Account').focus();await page.keyboard.press('Tab');
  assert.equal(await page.locator('#password').evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('#password').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByLabel('Password',{exact:true}).fill(randomBytes(24).toString('hex'));
  let releaseLogin;const heldLogin=new Promise(resolve=>{releaseLogin=resolve;});
  await page.route('**/api/auth/login',async route=>{await heldLogin;await route.continue();});
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'Signing in...',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Account').isDisabled(),true);
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');
  await capture('login-submitting');releaseLogin();
  await page.getByRole('alert').filter({hasText:'Username or password is incorrect.'}).waitFor();await page.unroute('**/api/auth/login');
  await capture('login-error');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#password').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor();
  await capture('estimator-register');
  await page.getByRole('button',{name:'New RFQ',exact:true}).click();
  await page.getByText('Import Excel part list (optional)',{exact:true}).click();
  await page.getByLabel('Synthetic Excel RFQ',{exact:true}).setInputFiles('apps/web/public/synthetic-rfq.xlsx');
  await page.getByRole('checkbox',{name:/I confirm this workbook/}).check();await page.getByRole('button',{name:'Review Excel import',exact:true}).click();
  await page.getByRole('region',{name:'Excel import review',exact:true}).waitFor();
  await page.getByText('Cell evidence for imported part 1',{exact:true}).click();await capture('excel-review');
  await page.getByRole('region',{name:'Excel import review',exact:true}).screenshot({path:`${directory}/excel-review-detail.png`});
  await page.getByText('Import Excel part list (optional)',{exact:true}).click();
  await page.getByText('Extract from text with AI (optional)',{exact:true}).click();
  await page.getByLabel('Synthetic RFQ email or plain text',{exact:true}).fill(numberedBrowserSource);
  await page.getByRole('checkbox',{name:/I confirm this text/}).check();await page.getByRole('checkbox',{name:/I consent to sending/}).check();
  await page.getByRole('button',{name:'Extract with AI',exact:true}).click();
  await page.getByRole('region',{name:'Extraction review',exact:true}).waitFor();
  await page.getByText('Evidence for suggested part 1',{exact:true}).click();
  await page.getByRole('button',{name:'View source for Gross weight (kg), evidence 1',exact:true}).first().click();
  assert.equal(await page.locator('.evidence-source mark').innerText(),'Gross Weight: 610 g');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    const sourceButton=page.getByRole('button',{name:'View source for Gross weight (kg), evidence 1',exact:true}).first();
    await sourceButton.click();
    await page.screenshot({path:`${directory}/gemini-evidence-${width}.png`});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'Return to field',exact:true}).click();
    assert.equal(await sourceButton.evaluate(el=>el===document.activeElement),true);
  }
  await capture('gemini-review');
  await page.getByRole('button',{name:'Use verified suggestions',exact:true}).click();if(await page.getByRole('dialog',{name:'Review replacement'}).count())await page.getByRole('button',{name:'Replace working inputs',exact:true}).click();
  assert.equal(await page.getByRole('table',{name:'Rate-key assignment',exact:true}).getByRole('combobox').count(),12);
  await page.getByText('Extract from text with AI (optional)',{exact:true}).click();
  await capture('manual-multipart');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.locator('.rate-assignment').scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/matrix-${width}.png`});
  }
  // Test all palette combinations actually used for text and control edges.
  const colors=await page.evaluate(()=>{const css=getComputedStyle(document.documentElement);return Object.fromEntries(['canvas','panel','raised','forest','text','secondary','tertiary','action','settled','error','divider','focus','crimson'].map(key=>[key,css.getPropertyValue(`--${key}`).trim()]));});
  function luminance(hex) {const [r,g,b]=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return r*.2126+g*.7152+b*.0722;}
  function ratio(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  const checks={};
  for(const foreground of ['text','secondary','tertiary','settled','error'])for(const background of ['canvas','panel','raised','forest']) {
    const value=ratio(colors[foreground],colors[background]);checks[`${foreground}/${background}`]=value;assert.ok(value>=4.5,`${foreground}/${background}: ${value}`);
  }
  for(const background of ['canvas','panel','raised','forest'])for(const foreground of ['divider','focus']) {
    const value=ratio(colors[foreground],colors[background]);checks[`${foreground}/${background}`]=value;assert.ok(value>=3,`${foreground}/${background}: ${value}`);
  }
  for(const [fg,bg] of [['text','crimson'],['canvas','action']]){checks[`${fg}/${bg}`]=ratio(colors[fg],colors[bg]);assert.ok(checks[`${fg}/${bg}`]>=4.5);}
  for(const [fg,bg] of [['#FAF8F3','#24372A'],['#FFB4A9','#302120'],['#E7DAB5','#29271F'],['#D46B61','#06110C'],['#DE6961','#06110C']]){checks[`${fg}/${bg}`]=ratio(fg,bg);assert.ok(checks[`${fg}/${bg}`]>=4.5);}
  await writeFile(`${directory}/contrast.json`,JSON.stringify(checks,null,2));
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByLabel('Account').selectOption('sales_head');await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_SALES_HEAD_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Signed in as sales_head',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Pending approvals',exact:true}).waitFor();await capture('sales-register-empty-approvals');
  await page.getByRole('link',{name:'Rate catalogue',exact:true}).click();
  await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();await capture('sales-rates');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`${directory}/rate-author-${width}.png`});
  }
  // Session bootstrap failure has a visible, working reload action.
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.route('**/api/auth/session',route=>route.abort());await page.reload();
  await page.getByRole('button',{name:'Reload session',exact:true}).waitFor();await capture('session-error');
  await page.unroute('**/api/auth/session');await page.getByRole('button',{name:'Reload session',exact:true}).click();await page.getByLabel('Account').waitFor();
  assert.deepEqual(errors,[]);await writeFile(`${directory}/captures.json`,JSON.stringify(captures,null,2));
  console.log('PASS: visual-v2 real auth, empty-password validation, loading/submitting/error/reload, keyboard/focus/reduced motion, both roles, Excel and mocked-provider Gemini review, exact source return focus, matrix, rates/authoring; viewport/full-page 1440x1000 and 390x844 captures; 35 contrast pairs.');
} finally {
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));app?.locals.sessionStore.close();await db.close();
}
