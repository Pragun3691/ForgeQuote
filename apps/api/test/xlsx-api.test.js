import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { browserTestDatabase } from '../../../tests/helpers/database.js';
import { syntheticWorkbook } from './fixtures/xlsx.js';
import { importXlsx } from '../src/imports/worker.js';
import { XLSX_MIME,MAX_UPLOAD,importError } from '../src/imports/xlsx.js';

test('Excel import security, real parser and no-write boundary in disposable database',async t=>{
  const db=await browserTestDatabase(),logs=[];let calls=0;
  const config={nodeEnv:'production',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'https://fixture.example',trustProxyHops:1};
  const app=createApp(db.runtime,config,{sessionSchema:db.schema,importLimit:100,logWriter:line=>logs.push(line),xlsxImport:(bytes,options)=>{calls++;return importXlsx(bytes,options);}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  async function client(username,baseUrl=base) {
    let cookie='',token='';
    async function request(path,{method='GET',headers={},body,signal}={}){
      const response=await fetch(baseUrl+path,{method,signal,headers:{Cookie:cookie,'X-Forwarded-Proto':'https',Origin:config.appOrigin,'X-CSRF-Token':token,...headers},body});
      for(const c of response.headers.getSetCookie())cookie=c.split(';')[0];
      const data=await response.json();if(data.csrfToken)token=data.csrfToken;return {status:response.status,data};
    }
    if(username){await request('/api/auth/session');assert.equal((await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:db.passwords[username==='estimator'?'DEMO_ESTIMATOR_PASSWORD':'DEMO_SALES_HEAD_PASSWORD']})})).status,200);}
    return request;
  }
  try {
    const estimator=await client('estimator'),sales=await client('sales_head'),anon=await client();
    const send=(who=estimator,headers={},bytes=syntheticWorkbook())=>who('/api/rfq-import/xlsx',{method:'POST',headers:{'Content-Type':XLSX_MIME,'X-File-Name':'synthetic.xlsx','X-Synthetic-Only':'true',...headers},body:bytes});
    const counts=async()=> (await db.owner.query('SELECT (SELECT count(*) FROM rfqs) rfqs,(SELECT count(*) FROM rfq_submissions) receipts')).rows[0];
    await t.test('auth/role/CSRF/origin/type/attestation rejected before parser',async()=>{
      assert.equal((await send(anon)).status,401);assert.equal((await send(sales)).status,403);
      assert.equal((await send(estimator,{'X-CSRF-Token':'bad'})).status,403);assert.equal((await send(estimator,{Origin:'https://untrusted.example'})).status,403);
      assert.equal((await send(estimator,{'Content-Type':'application/json'})).status,415);
      assert.equal((await send(estimator,{'X-File-Name':'synthetic.xlsm'})).status,415);
      assert.equal((await send(estimator,{'X-Synthetic-Only':'false'})).status,400);
      assert.equal((await send(estimator,{'Content-Encoding':'gzip'})).status,415);assert.equal(calls,0);
    });
    await t.test('real worker returns exact evidence; valid and invalid imports write nothing',async()=>{
      const before=await counts(),result=await send();assert.equal(result.status,200);assert.equal(result.data.parts[0].fields.grossWeightKg.normalizedValue,'0.61');
      assert.equal(result.data.parts[0].fields.grossWeightKg.cell,'C2');assert.equal((await send(estimator,{},Buffer.from('secret document invalid bytes'))).status,422);
      assert.equal((await send(estimator,{},Buffer.alloc(MAX_UPLOAD+1))).status,413);assert.deepEqual(await counts(),before);
      assert.equal((await estimator('/api/rfq-rate-keys')).status,200);
    });
    await t.test('only controlled codes logged; bytes and document fields never logged',()=>{
      assert.ok(logs.some(l=>l.includes('XLSX_INVALID')));
      for(const secret of ['secret document','SYNTH-XLSX-A','Synthetic Parts','0.610000'])assert.ok(!logs.join('\n').includes(secret));
    });
    await t.test('limiter and two-in-flight bound precede parser; disconnect cancels and manual path survives',async()=>{
      let attempts=0;const signals=[];
      const limited=createApp(db.runtime,config,{sessionSchema:db.schema,importLimit:3,logWriter:line=>logs.push(line),xlsxImport:(_bytes,{signal})=>{
        attempts++;signals.push(signal);return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(importError('XLSX_CANCELLED')),{once:true}));
      }});
      const running=limited.listen(0,'127.0.0.1');await once(running,'listening');
      const controllers=[new AbortController(),new AbortController()],pending=[];
      try {
        const who=await client('estimator',`http://127.0.0.1:${running.address().port}`);
        const upload=(headers={},signal)=>who('/api/rfq-import/xlsx',{method:'POST',headers:{'Content-Type':XLSX_MIME,'X-File-Name':'synthetic.xlsx','X-Synthetic-Only':'true',...headers},body:syntheticWorkbook(),signal});
        assert.equal((await upload({'X-CSRF-Token':'wrong'})).status,403);
        for(const controller of controllers)pending.push(upload({},controller.signal).catch(()=>null));
        for(let i=0;i<100&&attempts<2;i++)await delay(10);assert.equal(attempts,2);
        const busy=await upload();assert.equal(busy.data.error.code,'XLSX_BUSY');assert.equal(attempts,2);
        const rate=await upload();assert.equal(rate.data.error.code,'XLSX_RATE_LIMIT');assert.equal(attempts,2);
        controllers.forEach(c=>c.abort());await Promise.all(pending);
        for(let i=0;i<100&&signals.some(s=>!s.aborted);i++)await delay(10);assert.ok(signals.every(s=>s.aborted));
        assert.equal((await who('/api/rfq-rate-keys')).status,200);
      } finally {controllers.forEach(c=>c.abort());await Promise.all(pending);limited.locals.sessionStore.close();await new Promise(resolve=>running.close(resolve));}
    });
  } finally {app.locals.sessionStore.close();await new Promise(resolve=>server.close(resolve));await db.close();}
});
