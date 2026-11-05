import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {testDatabase} from '../../../tests/helpers/database.js';
import {rateCatalogue} from '../src/rate-catalogue.js';
import {createApp} from '../src/app.js';
import {createQuotationService} from '../src/quotations.js';
import {resolveRate} from '../src/rates.js';
import {fixtureId} from '../src/seed.js';

test('rate catalogue with history, role capabilities, strict ACL and immutable quote facts',async t=>{
 const db=await testDatabase();
 const users=(await db.owner.query('SELECT id,role FROM users')).rows,e=users.find(u=>u.role==='estimator').id,s=users.find(u=>u.role==='sales_head').id;
 const quotes=createQuotationService(db.runtime,{gstPercent:'18'});
 const quote=await quotes.createDraftVersion(e,{rfqId:fixtureId(21),pricingDate:'2026-11-04',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20'}]});
 const saved=await quotes.getDraftVersion(e,quote.versionId);
 let app,server;
 try {
  await t.test('both roles see all six categories, exact values, units, recorded time and version IDs',async()=>{
   for(const actor of [e,s]) {
    const result=await rateCatalogue(db.runtime,actor,'2026-11-04');assert.equal(result.canWrite,actor===s);assert.equal(result.asOf,'2026-11-04');assert.equal(result.rateKeys.length,6);
    assert.deepEqual(result.rateKeys.map(k=>k.category).sort(),['freight','machine','material','overhead','packaging','scrap']);
    const material=result.rateKeys.find(k=>k.id===fixtureId(1));assert.equal(material.currentVersion.value,'100.000000');assert.equal(material.unit,'INR/kg');assert.equal(material.currentVersion.id,fixtureId(11));
    assert.equal(material.currentVersion.effectiveFrom,'2026-11-02');assert.equal(material.currentVersion.effectiveTo,null);assert.ok(material.currentVersion.createdAt);
   }
  });
  await t.test('derived periods and missing history reflect start-inclusive/end-exclusive dates and future starts',async()=>{
   await db.owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-03','140.123456'),($3,$2,'2026-12-01','150.000001')",[randomUUID(),fixtureId(1),randomUUID()]);
   for(const [date,value] of [['2026-11-01',null],['2026-11-02','100.000000'],['2026-11-03','140.123456'],['2026-11-30','140.123456'],['2026-12-01','150.000001']]) {
    const result=await rateCatalogue(db.runtime,e,date),key=result.rateKeys.find(k=>k.id===fixtureId(1));assert.equal(key.currentVersion?.value||null,value);
    if(value)assert.equal((await resolveRate(db.runtime,fixtureId(1),date)).value,value);else await assert.rejects(resolveRate(db.runtime,fixtureId(1),date),{code:'RATE_NOT_FOUND'});
    assert.deepEqual(key.versions.map(v=>[v.effectiveFrom,v.effectiveTo]),[['2026-12-01',null],['2026-11-03','2026-12-01'],['2026-11-02','2026-11-03']]);
   }
   const noHistory=randomUUID();await db.owner.query("INSERT INTO rate_keys(id,code,category,unit) VALUES ($1,'NO-HISTORY','material','INR/kg')",[noHistory]);
   const key=(await rateCatalogue(db.runtime,e)).rateKeys.find(k=>k.id===noHistory);assert.equal(key.currentVersion,null);assert.deepEqual(key.versions,[]);
  });
  await t.test('database rejects duplicate starts and mutations; runtime cannot insert values directly or own masters',async()=>{
   await assert.rejects(db.owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-03','0')",[randomUUID(),fixtureId(1)]),{code:'23505'});
   for(const statement of ['UPDATE rate_versions SET value=0','DELETE FROM rate_versions','TRUNCATE rate_versions CASCADE'])await assert.rejects(db.owner.query(statement),{code:'55000'});
   await assert.rejects(db.runtime.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2027-01-01','100.1234567')",[randomUUID(),fixtureId(1)]),{code:'42501'});
   const row=(await db.runtime.query("SELECT has_table_privilege(current_user,'rate_versions','INSERT') AS ins,has_table_privilege(current_user,'rate_versions','UPDATE') AS upd,has_table_privilege(current_user,'rate_versions','DELETE') AS del,pg_get_userbyid(relowner)=current_user AS owns FROM pg_class WHERE oid='rate_versions'::regclass")).rows[0];
   assert.deepEqual(row,{ins:false,upd:false,del:false,owns:false});
  });
  await t.test('new applicable master version does not change old quotation snapshot, resolved values or goldens',async()=>{
   const after=await quotes.getDraftVersion(e,quote.versionId);assert.deepEqual(after,saved);assert.equal(after.parts[0].result.tiers[1].sellingPricePerUnitExGst,'149.70');
   assert.equal(after.parts[0].rates.materialInrPerKg.value,'100.000000');assert.equal((await resolveRate(db.runtime,fixtureId(1),'2026-11-04')).value,'140.123456');
  });
  await t.test('HTTP authentication, date validation and unsupported or malformed rate writes preserve every row',async()=>{
   const config={nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:5173',trustProxyHops:0};
   app=createApp(db.runtime,config,{sessionSchema:db.schema});server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
   function agent(){return {cookie:'',token:'',async request(path,method='GET',body,headers={}){const r=await fetch(base+path,{method,headers:{Cookie:this.cookie,Origin:config.appOrigin,'X-CSRF-Token':this.token,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});for(const c of r.headers.getSetCookie())this.cookie=c.split(';')[0];const data=await r.json();if(data.csrfToken)this.token=data.csrfToken;return {status:r.status,data};},async login(username,password){await this.request('/api/auth/session');assert.equal((await this.request('/api/auth/login','POST',{username,password})).status,200);}};}
   const anonymous=agent();assert.equal((await anonymous.request('/api/rates')).status,401);assert.equal((await anonymous.request('/api/rates','POST',{})).status,401);
   const before=(await db.owner.query('SELECT * FROM rate_versions ORDER BY id')).rows;
   for(const [role,password] of [['estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD],['sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD]]) {
    const client=agent();await client.login(role,password);assert.equal((await client.request('/api/rates?asOf=2026-11-02')).status,200);
    for(const query of ['asOf=2026-02-30','asOf=2026-11-02&asOf=2026-11-03','role=maintenance'])assert.equal((await client.request(`/api/rates?${query}`)).status,400);
    for(const method of ['POST','PUT','PATCH','DELETE'])for(const path of ['/api/rates',`/api/rates/${fixtureId(1)}/versions`]) {
     const r=await client.request(path,method,{value:'100.1234567',effectiveFrom:'2027-01-01'});assert.equal(r.status,role==='sales_head' && method==='POST' && path.endsWith('/versions')?400:403);
    }
    assert.equal((await client.request('/api/rates','POST',{}, {'X-CSRF-Token':'bad'})).data.error.code,'CSRF_INVALID');
   }
   assert.deepEqual((await db.owner.query('SELECT * FROM rate_versions ORDER BY id')).rows,before);
   await db.owner.query('UPDATE users SET active=false WHERE id=$1',[s]);await assert.rejects(rateCatalogue(db.runtime,s),{code:'AUTH_REQUIRED'});
  });
 }finally{if(server)await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
});
