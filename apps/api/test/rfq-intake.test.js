import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createRfqService, canonicalRfq } from '../src/rfq-intake.js';
import { fixtureId } from '../src/seed.js';
import { testDatabase } from '../../../tests/helpers/database.js';

const body = (reference = 'RFQ-MANUAL-001', count = 2) => ({ reference, customerName:'Synthetic Manufacturing', dueDate:'2026-11-06',
  parts:Array.from({length:count},(_,i)=>({ partNumber:`MANUAL-${i+1}`,description:'Synthetic spindle',grossWeightKg:'0.610000',requestedAnnualQty:'180000',cycleTimeMin:'3.200000',setupHoursPerBatch:'12',
    rateKeys:{material:fixtureId(1),machine:fixtureId(2),scrap:fixtureId(3),overhead:fixtureId(4),packaging:fixtureId(5),freight:fixtureId(6)} })) });

test('manual RFQ HTTP vertical slice with real PostgreSQL and restricted runtime', async t => {
  const db=await testDatabase();
  const config={nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:3000',trustProxyHops:0};
  const app=createApp(db.runtime,config,{sessionSchema:db.schema,rfqLimit:100});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  function client() {
    return {cookie:'',token:'',async request(path,{method='GET',body,key,headers={}}={}) {
      const response=await fetch(base+path,{method,headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(method==='POST'?{Origin:config.appOrigin,'X-CSRF-Token':this.token}:{}),
        ...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
      for(const value of response.headers.getSetCookie()) this.cookie=value.split(';')[0];
      const data=await response.json();if(data.csrfToken) this.token=data.csrfToken;
      return {status:response.status,data,response};
    },async login(username,password) {
      await this.request('/api/auth/session');
      assert.equal((await this.request('/api/auth/login',{method:'POST',body:{username,password}})).status,200);
    }};
  }
  const estimator=client(),sales=client(),anonymous=client();
  const save=(request=body(),key=randomUUID(),headers={})=>estimator.request('/api/rfqs',{method:'POST',body:request,key,headers});
  const counts=async()=> (await db.owner.query(`SELECT (SELECT count(*) FROM rfqs) AS rfqs,(SELECT count(*) FROM rfq_parts) AS parts,
    (SELECT count(*) FROM routing_revisions) AS routes,(SELECT count(*) FROM rfq_submissions) AS receipts`)).rows[0];
  let saved,key;
  try {
    await estimator.login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);
    await sales.login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
    await t.test('authentication, estimator role, CSRF and Origin checked before writes',async()=>{
      const before=await counts();
      assert.equal((await anonymous.request('/api/rfq-rate-keys')).status,401);
      assert.equal((await anonymous.request('/api/rfqs',{method:'POST',body:body(),key:randomUUID()})).status,401);
      assert.equal((await sales.request('/api/rfqs',{method:'POST',body:body(),key:randomUUID()})).status,403);
      assert.equal((await save(body(),randomUUID(),{'X-CSRF-Token':'invalid'})).status,403);
      assert.equal((await save(body(),randomUUID(),{Origin:'http://untrusted.example'})).status,403);
      assert.deepEqual(await counts(),before);
    });
    await t.test('lookup returns real categorized keys with units and no invented defaults',async()=>{
      const result=await estimator.request('/api/rfq-rate-keys');assert.equal(result.status,200);
      assert.equal(result.response.headers.get('cache-control'),'no-store');
      assert.equal(result.data.rateKeys.length,6);
      assert.deepEqual(result.data.rateKeys.find(rate=>rate.id===fixtureId(1)),{id:fixtureId(1),code:'EN8',category:'material',unit:'INR/kg'});
    });
    await t.test('required fields, bounds, decimal strings, unique parts and correct key categories',async()=>{
      const before=await counts(), invalid=[];
      for(const change of [{reference:' '},{customerName:''},{dueDate:'2026-02-30'},{parts:[]},{parts:body('x',21).parts},{ownerLabel:'forged'},{status:'closed'}]) invalid.push({...body(),...change});
      for(const change of [{partNumber:''},{description:''},{grossWeightKg:0.61},{grossWeightKg:'0'},{grossWeightKg:'1.0000001'},{grossWeightKg:'1000000000000'},
        {requestedAnnualQty:'1000000001'},{requestedAnnualQty:'0'},{cycleTimeMin:'0'},{setupHoursPerBatch:'-1'},
        {rateKeys:{...body().parts[0].rateKeys,material:fixtureId(2)}},{rateKeys:{...body().parts[0].rateKeys,freight:randomUUID()}}]) {
        const request=body();request.parts[1]={...request.parts[1],...change};invalid.push(request);
      }
      const duplicate=body();duplicate.parts[1].partNumber=duplicate.parts[0].partNumber;invalid.push(duplicate);
      for(const request of invalid) assert.equal((await save(request)).status,400,JSON.stringify(request));
      assert.equal((await estimator.request('/api/rfqs',{method:'POST',body:body()})).status,400);
      assert.deepEqual(await counts(),before);
    });
    await t.test('multi-part RFQ, initial routes and receipt save atomically and appear in register/detail',async()=>{
      key=randomUUID();const result=await save(body(),key);assert.equal(result.status,201);saved=result.data.rfqId;
      assert.equal(result.response.headers.get('location'),`/api/rfqs/${saved}`);
      const entry=(await estimator.request('/api/rfqs')).data.rfqs.find(row=>row.id===saved);
      assert.deepEqual(entry,{id:saved,reference:'RFQ-MANUAL-001',customerName:'Synthetic Manufacturing',dueDate:'2026-11-06',ownerLabel:'estimator',status:'open',partCount:'2'});
      const detail=(await estimator.request(`/api/rfqs/${saved}`)).data;
      assert.equal(detail.parts.length,2);assert.equal(detail.versions.length,0);
      for(const part of detail.parts) {
        assert.equal(part.grossWeightKg,'0.610000');assert.equal(part.requestedAnnualQty,'180000');assert.equal(part.routes.length,1);
        assert.equal(part.routes[0].cycleTimeMin,'3.200000');assert.equal(part.routes[0].setupHoursPerBatch,'12.000000');
      }
      assert.deepEqual(await counts(),{rfqs:'2',parts:'3',routes:'3',receipts:'1'});
    });
    await t.test('normalized retry replays; changed payload and duplicate reference conflict without writes',async()=>{
      const before=await counts(),equivalent=body();equivalent.reference=' RFQ-MANUAL-001 ';equivalent.parts[0].grossWeightKg='0.61';equivalent.parts[0].rateKeys.material=fixtureId(1).toUpperCase();
      const replay=await save(equivalent,key);assert.equal(replay.status,200);assert.deepEqual(replay.data,{rfqId:saved,replayed:true});
      assert.equal((await save({...body(),customerName:'Changed'},key)).status,409);
      const duplicate=await save();assert.equal(duplicate.status,409);assert.equal(duplicate.data.error.code,'RFQ_REFERENCE_CONFLICT');
      assert.deepEqual(await counts(),before);
    });
    await t.test('six concurrent same-key requests create one RFQ and one complete set of parts',async()=>{
      const request=body('RFQ-CONCURRENT'),retryKey=randomUUID(),before=await counts();
      const responses=await Promise.all(Array.from({length:6},()=>save(request,retryKey)));
      assert.deepEqual(responses.map(result=>result.status).sort(),[200,200,200,200,200,201]);
      assert.equal(new Set(responses.map(result=>result.data.rfqId)).size,1);
      const after=await counts();assert.equal(BigInt(after.rfqs)-BigInt(before.rfqs),1n);assert.equal(BigInt(after.parts)-BigInt(before.parts),2n);
      assert.equal(BigInt(after.receipts)-BigInt(before.receipts),1n);
    });
    await t.test('failure on second route and on receipt insert rolls back header, every part, route and key',async()=>{
      for(const [table,condition] of [['routing_revisions',"(SELECT part_number FROM rfq_parts WHERE id=NEW.part_id)='MANUAL-2'"],['rfq_submissions','true']]) {
        const before=await counts(),request=body(`RFQ-ROLLBACK-${table}`),retryKey=randomUUID();
        await db.owner.query(`CREATE FUNCTION fail_intake() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'private storage failure'; END IF; RETURN NEW; END; $$;
          CREATE TRIGGER fail_intake BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_intake()`);
        try {
          const result=await save(request,retryKey);assert.equal(result.status,503);assert.equal(result.data.error.code,'RFQ_SERVICE_UNAVAILABLE');
          assert.ok(!JSON.stringify(result.data).includes('private storage failure'));assert.deepEqual(await counts(),before);
        } finally {await db.owner.query(`DROP TRIGGER fail_intake ON ${table}; DROP FUNCTION fail_intake()`);}
        assert.equal((await save(request,retryKey)).status,201);assert.equal((await save(request,retryKey)).status,200);
      }
    });
    await t.test('lost COMMIT acknowledgement recovers original receipt through HTTP',async()=>{
      const actor=(await db.owner.query("SELECT id FROM users WHERE username='estimator'")).rows[0].id;
      let commits=0;
      const uncertain={async connect(){const client=await db.runtime.connect();return {async query(sql,values){const result=await client.query(sql,values);if(sql==='COMMIT'){commits++;throw Error('lost acknowledgement');}return result;},release(){client.release();}};}};
      const request=body('RFQ-LOST-COMMIT'),retryKey=randomUUID();
      await assert.rejects(createRfqService(uncertain)(actor,retryKey,request),/lost acknowledgement/);assert.equal(commits,1);
      const before=await counts(),replay=await save(request,retryKey);assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);assert.deepEqual(await counts(),before);
    });
    await t.test('20-part request fits route-specific body limit; oversized input is rejected',async()=>{
      const request=body('RFQ-MAX-PARTS',20);for(const part of request.parts) part.description='x'.repeat(500);
      assert.ok(JSON.stringify(request).length>4096);assert.equal((await save(request)).status,201);
      const before=await counts();assert.equal((await save({...body(),customerName:'x'.repeat(65536)})).status,413);assert.deepEqual(await counts(),before);
    });
    await t.test('single-part manual RFQ remains usable by existing quotation workflow',async()=>{
      const receipt=await save(body('RFQ-SINGLE',1));assert.equal(receipt.status,201);
      const detail=(await estimator.request(`/api/rfqs/${receipt.data.rfqId}`)).data,part=detail.parts[0];
      const result=await estimator.request(`/api/rfqs/${detail.id}/quote-versions`,{method:'POST',key:randomUUID(),body:{pricingDate:'2026-11-02',partId:part.id,routingRevisionId:part.routes[0].id,marginPercent:'20',tierQuantities:{'50':'90000','100':'180000','150':'270000'}}});
      assert.equal(result.status,201);
      const snapshot=(await estimator.request(`/api/quote-versions/${result.data.versionId}`)).data;
      assert.equal(snapshot.parts[0].result.tiers[1].costPerUnit,'119.76');assert.equal(snapshot.parts[0].result.tiers[1].sellingPricePerUnitExGst,'149.70');
    });
    await t.test('receipt immutable; runtime cannot edit inputs, rates or create receipt timestamps',async()=>{
      for(const sql of ['UPDATE rfq_submissions SET rfq_id=rfq_id','DELETE FROM rfq_submissions','TRUNCATE rfq_submissions']) {
        await assert.rejects(db.runtime.query(sql),{code:'42501'});await assert.rejects(db.owner.query(sql),{code:'55000'});
      }
      for(const table of ['rfqs','rfq_parts','routing_revisions','rate_keys','rate_versions']) assert.equal((await db.runtime.query("SELECT has_table_privilege(current_user,$1,'UPDATE') AS allowed",[table])).rows[0].allowed,false);
      for(const [table,column] of [['rfqs','status'],['rfqs','created_at'],['routing_revisions','created_at'],['rfq_submissions','created_at']]) assert.equal((await db.runtime.query("SELECT has_column_privilege(current_user,$1,$2,'INSERT') AS allowed",[table,column])).rows[0].allowed,false);
    });
    await t.test('service rechecks current role and activation independently of HTTP',async()=>{
      const salesId=(await db.owner.query("SELECT id FROM users WHERE username='sales_head'")).rows[0].id;
      const actor=(await db.owner.query("SELECT id FROM users WHERE username='estimator'")).rows[0].id,before=await counts();
      await assert.rejects(createRfqService(db.runtime)(salesId,randomUUID(),body('DENIED')),{code:'ROLE_FORBIDDEN'});
      await db.owner.query('UPDATE users SET active=false WHERE id=$1',[actor]);
      await assert.rejects(createRfqService(db.runtime)(actor,key,body()),{code:'AUTH_REQUIRED'});
      assert.equal((await save(body('DISABLED'))).status,401);assert.deepEqual(await counts(),before);
    });
    assert.deepEqual(canonicalRfq(body()).parts[0].grossWeightKg,'0.61');
  } finally {app.locals.sessionStore.close();await new Promise(resolve=>server.close(resolve));await db.close();}
});
