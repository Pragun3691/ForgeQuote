import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../apps/api/src/app.js';
import {browserTestDatabase} from './helpers/database.js';
import {numberedBrowserSource,numberedSuggestion} from '../apps/api/test/fixtures/numbered-rfq.js';
import {fixtureId} from '../apps/api/src/seed.js';
import {createQuotationService} from '../apps/api/src/quotations.js';
import {fakeGeminiResponse} from '../apps/api/test/fixtures/synthetic-rfq.js';

// Real auth/API/PostgreSQL. Only the external Gemini provider is substituted.
const db=await browserTestDatabase();
let app,browser;
const server=createServer((req,res)=>app(req,res));
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
const directory=`.tmp/m2/${process.env.M2_BASELINE?'before':'after'}`;
const baseline=!!process.env.M2_BASELINE;
try {
  app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:origin,trustProxyHops:0},{sessionSchema:db.schema,
    aiConfig:{apiKey:'test-only',model:'gemini-3.5-flash-lite',timeoutMs:1000,unavailableCode:null},
    aiGenerateContent:async()=>fakeGeminiResponse(numberedSuggestion({headers:true}))});
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  async function nativeCapture(context,page,name){const client=await context.newCDPSession(page);const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});await writeFile(directory+'/'+name+'.png',Buffer.from(shot.data,'base64'));await client.detach();}
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],captures=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await mkdir(directory,{recursive:true});
  const renderedChecks=[];
  async function checkRendered(name){
    const samples=await page.evaluate(()=>{
      const hex=value=>{const parts=value.match(/[\d.]+/g).map(Number);return '#'+parts.slice(0,3).map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');};
      return [...document.querySelectorAll('.app-nav a,.identity h2,label,thead th,.field-hint,.notice,.error,.success,button')].filter(el=>el.getClientRects().length && !el.disabled).map(el=>{
        const css=getComputedStyle(el);let parent=el,bg;
        while(parent){bg=getComputedStyle(parent).backgroundColor;if(!bg.includes('rgba')&&bg!=='transparent')break;parent=parent.parentElement;}
        return {kind:el.tagName,foreground:hex(css.color),background:hex(bg||'rgb(23,23,23)'),font:parseFloat(css.fontSize)};
      });
    });
    const luminance=hex=>hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    for(const sample of samples){const a=luminance(sample.foreground),b=luminance(sample.background);sample.ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(sample.ratio>=4.5,name+': rendered contrast '+JSON.stringify(sample));assert.ok(sample.font>=12,name+': essential text too small');}
    renderedChecks.push({name,width:await page.evaluate(()=>innerWidth),samples});
  }
  async function capture(name) {
    for(const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:width===768?1024:width<=390?844:1000});await page.evaluate(()=>window.scrollTo(0,0));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: page overflow at ${width}`);
      if(!baseline)await checkRendered(name);const path=`${directory}/${name}-${width}.png`;
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
  await page.getByLabel('Demo identity').waitFor();await page.unroute('**/api/auth/session');
  await capture('login');
  // Native validation blocks an empty password before any login POST.
  let loginPosts=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/login')&&r.method()==='POST')loginPosts++;});
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  assert.equal(await page.locator('#password').evaluate(el=>el.validity.valueMissing),true);assert.equal(loginPosts,0);
  await page.getByLabel('Demo identity').focus();await page.keyboard.press('Tab');
  assert.equal(await page.locator('#password').evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('#password').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByLabel('Password',{exact:true}).fill(randomBytes(24).toString('hex'));
  await page.evaluate(()=>{
    window.__m2ButtonFrames=[];window.__m2Probe=true;
    const frame=()=>{const el=document.querySelector('button[type=submit]');if(el){const css=getComputedStyle(el);window.__m2ButtonFrames.push({foreground:css.color,background:css.backgroundColor});}if(window.__m2Probe)requestAnimationFrame(frame);};requestAnimationFrame(frame);
  });
  let releaseLogin;const heldLogin=new Promise(resolve=>{releaseLogin=resolve;});
  await page.route('**/api/auth/login',async route=>{await heldLogin;await route.continue();});
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'Signing in...',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Demo identity').isDisabled(),true);
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');
  await capture('login-submitting');releaseLogin();
  await page.getByRole('alert').filter({hasText:'Username or password is incorrect.'}).waitFor();await page.unroute('**/api/auth/login');
  await capture('login-error');
  await page.evaluate(()=>new Promise(resolve=>{let count=12;const frame=()=>{if(--count)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);}));
  const buttonFrames=await page.evaluate(()=>{window.__m2Probe=false;return window.__m2ButtonFrames;});
  const rgbLuminance=color=>color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  for(const sample of buttonFrames){const a=rgbLuminance(sample.foreground),b=rgbLuminance(sample.background);sample.ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(sample.ratio>=4.5,'Login button transition contrast '+JSON.stringify(sample));}
  await writeFile(directory+'/button-transition-contrast.json',JSON.stringify(buttonFrames,null,2));
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#password').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'New RFQ',exact:true}).waitFor();
  await capture('estimator-register');
  if(!baseline){
    await page.keyboard.press('Tab');assert.equal(await page.getByRole('link',{name:'Skip to main content',exact:true}).evaluate(el=>el===document.activeElement),true);
    const hash=await page.evaluate(()=>location.hash);await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main-content').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.evaluate(()=>location.hash),hash);assert.match(await page.title(),/RFQs/);
  }
  const actor=(await db.owner.query("SELECT id FROM users WHERE role='estimator'")).rows[0].id;
  const saved=await createQuotationService(db.runtime,{gstPercent:'18'}).createDraftVersion(actor,{rfqId:fixtureId(21),pricingDate:'2026-11-02',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20',requestedAnnualQty:'1000',tierQuantities:{'50':'500','100':'1000','150':'1500'}}]});
  for(const width of [1051,1050,1049,1024,901,900,899,601,600,360,359]){
    await page.setViewportSize({width,height:768});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Shell breakpoint '+width);
    assert.equal(await page.getByRole('navigation',{name:'Workspace navigation'}).locator('[aria-current=page]').count(),1);
    if(!baseline)assert.equal(await page.locator('.sidebar').evaluate(el=>getComputedStyle(el).position),width<=1050?'sticky':'fixed');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+'/#rfq='+fixtureId(21)+'&version='+saved.versionId);await page.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();
  await capture('costing');
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:width===768?1024:width<=390?844:1000});await page.locator('.costing-form').scrollIntoViewIfNeeded();await page.screenshot({path:directory+'/costing-inputs-'+width+'.png'});}
  await page.setViewportSize({width:1440,height:1000});
  for(const zoom of [2,4]){
    // Real Chrome host zoom in a fresh task-owned profile, not CSS zoom/pinch emulation.
    const profile=await mkdtemp(directory+'/chrome-zoom-'+zoom+'-');await mkdir(profile+'/Default',{recursive:true});
    await writeFile(profile+'/Default/Preferences',JSON.stringify({partition:{per_host_zoom_levels:{x:{'127.0.0.1':Math.log(zoom)/Math.log(1.2)}}}}));
    const context=await chromium.launchPersistentContext(profile,{channel:process.env.BROWSER_CHANNEL||'chrome',headless:true,viewport:null,args:['--window-size=1440,1000']});
    try {
    const zoomPage=await context.newPage();zoomPage.on('pageerror',error=>errors.push(error.message));await zoomPage.goto(origin);await zoomPage.getByLabel('Demo identity').waitFor();assert.equal(await zoomPage.evaluate(()=>devicePixelRatio),zoom);await nativeCapture(context,zoomPage,'login-zoom-'+zoom*100);
    assert.ok(await zoomPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await zoomPage.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_ESTIMATOR_PASSWORD);
    await nativeCapture(context,zoomPage,'login-form-zoom-'+zoom*100);await zoomPage.getByRole('button',{name:'Sign in',exact:true}).click();await zoomPage.getByRole('button',{name:'New RFQ',exact:true}).waitFor();
    assert.ok(await zoomPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await zoomPage.evaluate(()=>window.scrollTo(0,0));await zoomPage.keyboard.press('Tab');assert.equal(await zoomPage.getByRole('link',{name:'Skip to main content',exact:true}).evaluate(el=>el===document.activeElement),true);await zoomPage.keyboard.press('Enter');assert.equal(await zoomPage.locator('#main-content').evaluate(el=>el===document.activeElement),true);await zoomPage.getByRole('button',{name:'New RFQ',exact:true}).focus();assert.ok(await zoomPage.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));await zoomPage.evaluate(()=>window.scrollTo(0,0));await nativeCapture(context,zoomPage,'zoom-'+zoom*100);
    await zoomPage.goto(origin+'/#rfq='+fixtureId(21)+'&version='+saved.versionId);await zoomPage.getByRole('region',{name:'Saved quotation',exact:true}).waitFor();
    const margin=zoomPage.getByLabel('Gross margin (%)',{exact:true});await margin.fill('17.25');await margin.press('Tab');await zoomPage.keyboard.press('Shift+Tab');await nativeCapture(context,zoomPage,'costing-zoom-'+zoom*100);
    assert.ok(await margin.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),JSON.stringify(await margin.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),height:innerHeight,scrollY}))));
    assert.ok(await zoomPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await nativeCapture(context,zoomPage,'costing-zoom-'+zoom*100);
    await zoomPage.getByRole('region',{name:'Quotation lifecycle',exact:true}).getByRole('status').filter({hasText:/Quotation status:/}).waitFor();
    const submit=zoomPage.getByRole('button',{name:'Submit for clearance',exact:true});if(await submit.count())await submit.click();
    await zoomPage.getByRole('button',{name:'Issue quotation',exact:true}).click();const dialog=zoomPage.getByRole('dialog');await dialog.waitFor();
    await zoomPage.keyboard.press('Tab');assert.equal(await zoomPage.getByRole('button',{name:'Confirm issuance',exact:true}).evaluate(el=>el===document.activeElement),true);assert.ok(await zoomPage.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
    await nativeCapture(context,zoomPage,'issuance-zoom-'+zoom*100);await zoomPage.getByRole('button',{name:'Cancel',exact:true}).click();
    await zoomPage.getByRole('button',{name:'Sign out',exact:true}).click();await zoomPage.getByLabel('Demo identity').selectOption('sales_head');await zoomPage.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_SALES_HEAD_PASSWORD);
    await zoomPage.getByRole('button',{name:'Sign in',exact:true}).click();await zoomPage.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:'Rate catalogue',exact:true}).click();
    const reason=zoomPage.getByLabel('Rate change reason',{exact:true});await reason.fill('Synthetic M2 zoom review');await reason.press('Tab');await zoomPage.keyboard.press('Shift+Tab');assert.ok(await reason.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
    assert.ok(await zoomPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await nativeCapture(context,zoomPage,'authoring-zoom-'+zoom*100);
    } finally {await context.close();}
  }
  await page.getByRole('button',{name:'Refresh lifecycle',exact:true}).click();await page.getByRole('button',{name:'Issue quotation',exact:true}).click();await page.getByRole('dialog').waitFor();await capture('issuance');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:'RFQs',exact:true}).click();
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
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:width===768?1024:width<=390?844:1000});
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
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:width===768?1024:width<=390?844:1000});
    await page.locator('.rate-assignment').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${directory}/matrix-${width}.png`});
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
  // Resize queued during auth unmount must not read cleared React refs.
  await page.evaluate(()=>{const observer=new MutationObserver(()=>{if(!document.querySelector('.sidebar')){window.dispatchEvent(new Event('resize'));observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});});
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByLabel('Demo identity').selectOption('sales_head');await page.getByLabel('Password',{exact:true}).fill(db.passwords.DEMO_SALES_HEAD_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Signed in as sales_head',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Pending approvals',exact:true}).waitFor();await capture('sales-register-empty-approvals');
  await page.getByRole('link',{name:'Rate catalogue',exact:true}).click();
  await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();if(!baseline){assert.equal(await page.getByRole('heading',{name:'Rate catalogue',exact:true}).evaluate(el=>el===document.activeElement),true);assert.match(await page.title(),/Rate catalogue/);}await capture('sales-rates');
  if(!baseline){
    const reason=page.getByLabel('Rate change reason',{exact:true});await reason.fill('M2 retained authoring draft');
    const refreshed=page.waitForResponse(r=>r.url().includes('/api/rates')&&r.request().method()==='GET');const refreshButton=page.getByRole('button',{name:'Refresh rates',exact:true});await refreshButton.click();await reason.focus();await refreshed;await page.getByRole('status').filter({hasText:'Refreshing rate history.'}).waitFor({state:'hidden'});
    await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).waitFor();
    assert.equal(await reason.inputValue(),'M2 retained authoring draft');assert.equal(await reason.evaluate(el=>el===document.activeElement),true);
  }
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:width===768?1024:width<=390?844:1000});await page.getByRole('heading',{name:'Add effective-dated rate version',exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${directory}/rate-author-${width}.png`});
  }
  // Session bootstrap failure has a visible, working reload action.
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.route('**/api/auth/session',route=>route.abort());await page.reload();
  await page.getByRole('button',{name:'Reload session',exact:true}).waitFor();await capture('session-error');
  await page.unroute('**/api/auth/session');await page.getByRole('button',{name:'Reload session',exact:true}).click();await page.getByLabel('Demo identity').waitFor();
  await writeFile(directory+'/rendered-contrast.json',JSON.stringify(renderedChecks,null,2));assert.deepEqual(errors,[]);await writeFile(`${directory}/captures.json`,JSON.stringify(captures,null,2));
  console.log('PASS: M2 real auth, empty-password validation, loading/submitting/error/reload, keyboard/focus/reduced motion, both roles, Excel and mocked-provider Gemini review, exact source return focus, matrix, rates/authoring; 1440/768/390/320 viewport/full-page captures; real Chrome 200%/400% zoom; skip/route/background focus; 35 contrast pairs.');
} finally {
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));app?.locals.sessionStore.close();await db.close();
}
