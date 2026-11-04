import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { testDatabase } from '../../../tests/helpers/database.js';
import { createApp } from '../src/app.js';
import { createQuotationService } from '../src/quotations.js';
import { createLifecycleService } from '../src/quotation-lifecycle.js';
import { fixtureId } from '../src/seed.js';

test('T04 lifecycle: exact thresholds, roles, concurrency, immutable history and HTTP security',async t=>{
  const db=await testDatabase();
  const users=(await db.owner.query('SELECT id,role FROM users')).rows;
  const estimator=users.find(u=>u.role==='estimator').id,sales=users.find(u=>u.role==='sales_head').id;
  const service=createLifecycleService(db.runtime),quotes=createQuotationService(db.runtime,{gstPercent:'18'});
  const act=(who,id,action,key=randomUUID(),body={})=>service.act(who,id,action,key,body);
  // Explicit independently specified immutable snapshots for exact threshold testing.
  // No triggers disabled, no UPDATE, and no costing engine used to generate expected values.
  async function snapshot(amount,quotationId=randomUUID()) {
    const client=await db.owner.connect(),id=randomUUID();
    try {
      await client.query('BEGIN');
      const exists=(await client.query('SELECT id FROM quotations WHERE id=$1',[quotationId])).rowCount;
      if(!exists) {
        const rfq=randomUUID();
        await client.query("INSERT INTO rfqs(id,reference,customer_name,due_date,owner_label) VALUES ($1,$2,'Synthetic threshold fixture','2026-11-06','Demo estimator')",[rfq,`SYN-${rfq}`]);
        await client.query('INSERT INTO quotations(id,rfq_id) VALUES ($1,$2)',[quotationId,rfq]);
      }
      const header=(await client.query('UPDATE quotations SET next_version=next_version+1 WHERE id=$1 RETURNING next_version-1 AS n',[quotationId])).rows[0];
      await client.query(`INSERT INTO quotation_versions(id,quotation_id,version_number,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst)
        VALUES ($1,$2,$3,'2026-11-02','forgequote-costing-v0.2','INR','18',$4,'{}',$5)`,[id,quotationId,header.n,estimator,amount]);
      await client.query("INSERT INTO quotation_totals(version_id,scenario,taxable_subtotal,gst_amount,total_with_gst) VALUES ($1,'100',$2,'0',$2)",[id,amount]);
      await client.query('COMMIT');return {id,quotationId};
    } catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  let app,server;
  try {
    for(const [value,required] of [['2499999.99',false],['2500000.00',false],['2500000.01',true]]) {
      await t.test(`stored threshold ${value}`,async()=>{
        const {id}=await snapshot(value);
        await assert.rejects(act(estimator,id,'issue'),{code:'LIFECYCLE_CONFLICT'});
        const key=randomUUID();await act(estimator,id,'submit',key);
        const state=await service.status(estimator,id);
        assert.equal(state.approvalRequired,required);assert.equal(state.status,required?'pending':'approved');
        assert.deepEqual(state.events.map(e=>e.eventType),required?['submitted']:['submitted','auto_approved']);
        assert.equal((await act(estimator,id,'submit',key)).replayed,true);
        await assert.rejects(act(estimator,id,'submit'),{code:'LIFECYCLE_CONFLICT'});
        await assert.rejects(act(estimator,id,'approve'),{code:'ROLE_FORBIDDEN'});
        if(required) {
          await assert.rejects(act(estimator,id,'issue'),{code:'LIFECYCLE_CONFLICT'});
          await act(sales,id,'approve');
          await assert.rejects(act(sales,id,'approve'),{code:'LIFECYCLE_CONFLICT'});
        }
        const issueKey=randomUUID();
        const issued=await Promise.all(Array.from({length:5},()=>act(estimator,id,'issue',issueKey)));
        assert.equal(issued.filter(r=>!r.replayed).length,1);
        assert.deepEqual(new Set(issued.map(r=>r.quotationNumber)),new Set([`FQ-${id}`]));
        await assert.rejects(act(estimator,id,'issue'),{code:'LIFECYCLE_CONFLICT'});
        await assert.rejects(act(estimator,id,'submit',issueKey),{code:'SUBMISSION_CONFLICT'});
        const final=await service.status(sales,id);assert.equal(final.status,'issued');assert.equal(final.events.length,3);
        assert.equal(final.approvalBasis,required?'sales_head':'below_threshold');
        for(const sql of ["UPDATE quotation_events SET reason='tamper' WHERE version_id=$1",'DELETE FROM quotation_events WHERE version_id=$1']) {
          await assert.rejects(db.owner.query(sql,[id]),{code:'55000'});
          await assert.rejects(db.runtime.query(sql,[id]),{code:'42501'});
        }
      });
    }
    await t.test('reject requires reason; conflicting decisions serialize to one terminal decision',async()=>{
      const {id}=await snapshot('2500000.01');await act(estimator,id,'submit');
      for(const body of [{},{reason:''},{reason:'  '},{reason:'x'.repeat(1001)}]) await assert.rejects(act(sales,id,'reject',randomUUID(),body),{code:'INVALID_QUOTATION_INPUT'});
      const key=randomUUID();await act(sales,id,'reject',key,{reason:'  Recheck quantities  '});
      assert.equal((await service.status(estimator,id)).events.at(-1).reason,'Recheck quantities');
      assert.equal((await act(sales,id,'reject',key,{reason:'Recheck quantities'})).replayed,true);
      await assert.rejects(act(sales,id,'reject',key,{reason:'different'}),{code:'SUBMISSION_CONFLICT'});
      await assert.rejects(act(estimator,id,'issue'),{code:'LIFECYCLE_CONFLICT'});
      const conflicting=await snapshot('2500000.01');await act(estimator,conflicting.id,'submit');
      const results=await Promise.allSettled([act(sales,conflicting.id,'approve'),act(sales,conflicting.id,'reject',randomUUID(),{reason:'Review failed'})]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      assert.equal(results.find(r=>r.status==='rejected').reason.code,'LIFECYCLE_CONFLICT');
      assert.equal((await service.status(sales,conflicting.id)).events.length,2);
    });
    await t.test('new versions inherit no approval; stale submit/approve/issue denied, prior receipts recover',async()=>{
      const old=await snapshot('2500000.01');const submitKey=randomUUID();await act(estimator,old.id,'submit',submitKey);await act(sales,old.id,'approve');
      const next=await snapshot('2500000.01',old.quotationId);
      assert.equal((await service.status(sales,next.id)).status,'draft');
      assert.deepEqual((await service.status(sales,next.id)).events,[]);
      assert.equal((await service.status(sales,old.id)).stale,true);
      for(const [who,action] of [[estimator,'issue'],[estimator,'submit'],[sales,'approve']]) await assert.rejects(act(who,old.id,action),{code:'STALE_QUOTATION'});
      assert.equal((await act(estimator,old.id,'submit',submitKey)).replayed,true);
      await assert.rejects(act(estimator,next.id,'issue'),{code:'LIFECYCLE_CONFLICT'});
      const pending=await snapshot('2500000.01');await act(estimator,pending.id,'submit');await snapshot('2500000.01',pending.quotationId);
      assert.ok(!(await service.pending(sales)).some(v=>v.versionId===pending.id));
    });
    await t.test('real synthetic below-threshold costing fixture automatically clears unchanged snapshot',async()=>{
      const {versionId}=await quotes.createDraftVersion(estimator,{rfqId:fixtureId(21),pricingDate:'2026-11-02',parts:[{partId:fixtureId(22),routingRevisionId:fixtureId(23),marginPercent:'20',requestedAnnualQty:'1000',tierQuantities:{'50':'500','100':'1000','150':'1500'}}]});
      const before=await quotes.getDraftVersion(estimator,versionId);assert.equal(before.annualValueExGst,'301850.00');
      await act(estimator,versionId,'submit');await act(estimator,versionId,'issue');
      assert.deepEqual(await quotes.getDraftVersion(estimator,versionId),before);
      await assert.rejects(quotes.createDraftVersion(sales,{}),{code:'INVALID_QUOTATION_INPUT'});
      await assert.rejects(db.owner.query('TRUNCATE quotation_events'),{code:'55000'});
      await assert.rejects(db.runtime.query('INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,submission_key) VALUES ($1,1,\'submitted\',$2,$3)',[versionId,estimator,randomUUID()]),{code:'55000'});
    });
    await t.test('version allocation lock prevents stale decisions and issuance while a new version commits',async()=>{
      for(const action of ['approve','issue']) {
        const old=await snapshot('2500000.01');await act(estimator,old.id,'submit');
        if(action==='issue') await act(sales,old.id,'approve');
        const lock=await db.owner.connect();
        try {
          await lock.query('BEGIN');
          await lock.query('SELECT id FROM quotations WHERE id=$1 FOR UPDATE',[old.quotationId]);
          // The real calculator must wait on exactly the same header, too.
          const result=act(action==='approve'?sales:estimator,old.id,action).then(value=>({value}),error=>({error}));
          await lock.query('UPDATE quotations SET next_version=next_version+1 WHERE id=$1',[old.quotationId]);
          const id=randomUUID();
          await lock.query(`INSERT INTO quotation_versions(id,quotation_id,version_number,pricing_date,formula_version,currency,gst_percent,created_by,rfq_snapshot,annual_value_ex_gst)
            SELECT $1,id,next_version-1,'2026-11-02','forgequote-costing-v0.2','INR','18',$2,'{}','2500000.01' FROM quotations WHERE id=$3`,[id,estimator,old.quotationId]);
          await lock.query('COMMIT');
          assert.equal((await result).error.code,'STALE_QUOTATION');
          assert.equal((await service.status(estimator,id)).status,'draft');
        } finally {await lock.query('ROLLBACK');lock.release();}
      }
    });
    await t.test('database constraints reject missing rejection reason and forged event timestamps',async()=>{
      const {id}=await snapshot('2500000.01');await act(estimator,id,'submit');
      await assert.rejects(db.runtime.query(`INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,submission_key)
        VALUES ($1,2,'rejected',$2,$3)`,[id,sales,randomUUID()]),{code:'23514'});
      await assert.rejects(db.runtime.query(`INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,submission_key,occurred_at)
        VALUES ($1,2,'approved',$2,$3,now())`,[id,sales,randomUUID()]),{code:'42501'});
      await assert.rejects(db.runtime.query(`INSERT INTO quotation_events(version_id,position,event_type,actor_user_id,submission_key)
        VALUES ($1,2,'approved',$2,$3)`,[id,estimator,randomUUID()]),{code:'42501'});
    });
    await t.test('automatic clearance and submission roll back together on a storage failure',async()=>{
      const {id}=await snapshot('2500000.00');
      await db.owner.query(`CREATE FUNCTION fail_auto_clearance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='auto_approved' THEN RAISE EXCEPTION 'Synthetic storage failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER test_fail_auto BEFORE INSERT ON quotation_events FOR EACH ROW EXECUTE FUNCTION fail_auto_clearance()`);
      const key=randomUUID();
      try {await assert.rejects(act(estimator,id,'submit',key),{code:'P0001'});}
      finally {await db.owner.query('DROP TRIGGER test_fail_auto ON quotation_events; DROP FUNCTION fail_auto_clearance()');}
      assert.deepEqual((await service.status(estimator,id)).events,[]);
      assert.equal((await act(estimator,id,'submit',key)).replayed,false);
      assert.equal((await service.status(estimator,id)).status,'approved');
    });
    await t.test('HTTP both roles, active role, CSRF, Origin, strict bodies and idempotency',async()=>{
      app=createApp(db.runtime,{nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:5173',trustProxyHops:0},{sessionSchema:db.schema,quoteLimit:200});
      server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
      function agent(){return {cookie:'',token:'',async request(path,method='GET',body,headers={}){
        const r=await fetch(base+path,{method,headers:{Cookie:this.cookie,Origin:'http://localhost:5173','X-CSRF-Token':this.token,'Content-Type':'application/json','Idempotency-Key':randomUUID(),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
        for(const c of r.headers.getSetCookie())this.cookie=c.split(';')[0];const data=await r.json();if(data.csrfToken)this.token=data.csrfToken;return {status:r.status,data};
      },async login(username,password){await this.request('/api/auth/session');assert.equal((await this.request('/api/auth/login','POST',{username,password})).status,200);}};}
      const e=agent(),s=agent(),a=agent();await e.login('estimator',db.passwords.DEMO_ESTIMATOR_PASSWORD);await s.login('sales_head',db.passwords.DEMO_SALES_HEAD_PASSWORD);
      const {id}=await snapshot('2500000.01'),path=`/api/quote-versions/${id}`;
      for(const action of ['submit','approve','reject','issue']) assert.equal((await a.request(`${path}/${action}`,'POST',{})).status,401);
      assert.equal((await a.request(`${path}/lifecycle`)).status,401);
      assert.equal((await e.request('/api/quote-versions/pending')).status,403);
      assert.equal((await e.request(`${path}/approve`,'POST',{})).status,403);
      assert.equal((await s.request(`${path}/submit`,'POST',{})).status,403);
      assert.equal((await s.request(`${path}/issue`,'POST',{})).status,403);
      assert.equal((await s.request(`/api/rfqs/${fixtureId(21)}/quote-versions`,'POST',{})).status,403);
      for(const headers of [{'X-CSRF-Token':'wrong'},{Origin:'http://evil.example'}]) assert.equal((await e.request(`${path}/submit`,'POST',{},headers)).status,403);
      for(const body of [{annualValueExGst:'0'},{approvalRequired:false},{reason:'no'}]) assert.equal((await e.request(`${path}/submit`,'POST',body)).status,400);
      assert.equal((await e.request(`${path}/submit`,'POST',{}, {'Idempotency-Key':''})).status,400);
      assert.equal((await e.request(`${path}/submit`,'POST',{})).status,201);
      assert.ok((await s.request('/api/quote-versions/pending')).data.versions.some(v=>v.versionId===id));
      assert.equal((await s.request(`${path}/reject`,'POST',{})).status,400);
      assert.equal((await s.request(`${path}/approve`,'POST',{})).status,201);
      const key=randomUUID(),issue=()=>e.request(`${path}/issue`,'POST',{}, {'Idempotency-Key':key});
      assert.equal((await issue()).status,201);const replay=await issue();assert.equal(replay.status,200);assert.equal(replay.data.quotationNumber,`FQ-${id}`);
      assert.equal((await e.request(`${path}/lifecycle`)).data.status,'issued');
      await db.owner.query('UPDATE users SET active=false WHERE id=$1',[sales]);
      assert.equal((await s.request('/api/quote-versions/pending')).status,401);
    });
  } finally {if(server) await new Promise(r=>server.close(r));app?.locals.sessionStore.close();await db.close();}
});
