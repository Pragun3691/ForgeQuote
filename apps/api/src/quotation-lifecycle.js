import Decimal from 'decimal.js';
import { transaction } from './db.js';
import { validateId, inputError } from './quotation-request.js';

const fail = (message, code='LIFECYCLE_CONFLICT') => { throw inputError(message, code); };
const events = async (client, versionId) => (await client.query(`SELECT version_id AS "versionId",position,event_type AS "eventType",
  actor_user_id AS "actorId",occurred_at AS "occurredAt",reason,quotation_number AS "quotationNumber"
  FROM quotation_events WHERE version_id=$1 ORDER BY position`,[versionId])).rows;
async function actor(client, actorId, role) {
  const user=(await client.query('SELECT active,role FROM users WHERE id=$1',[actorId])).rows[0];
  if(!user?.active) fail('Sign in to continue.','AUTH_REQUIRED');
  if(role && user.role!==role) fail('This action is not permitted for your role.','ROLE_FORBIDDEN');
}
function describe(version, history, latest) {
  const last=history.at(-1);
  return {versionId:version.id,status:({submitted:'pending',auto_approved:'approved'})[last?.eventType] || last?.eventType || 'draft',
    approvalRequired:new Decimal(version.annual_value_ex_gst).gt('2500000.00'),
    approvalBasis:history.some(e=>e.eventType==='auto_approved')?'below_threshold':history.some(e=>e.eventType==='approved')?'sales_head':null,
    stale:version.version_number!==latest,quotationNumber:history.find(e=>e.eventType==='issued')?.quotationNumber || null,events:history};
}
export function createLifecycleService(pool) {
  return {
    async status(actorId, versionId, { client: sharedClient } = {}) {
      validateId(versionId);
      const read=async client=>{
        await actor(client,actorId);
        // One statement snapshot keeps status/history and latest-version detection consistent.
        const row=(await client.query(`SELECT v.*,q.next_version-1 AS latest,
          (SELECT outcome FROM rfq_outcomes WHERE rfq_id=q.rfq_id) AS rfq_outcome,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('versionId',e.version_id,'position',e.position,'eventType',e.event_type,
          'actorId',e.actor_user_id,'occurredAt',e.occurred_at,'reason',e.reason,'quotationNumber',e.quotation_number) ORDER BY position)
          FROM quotation_events e WHERE e.version_id=v.id),'[]') AS history
          FROM quotation_versions v JOIN quotations q ON q.id=v.quotation_id WHERE v.id=$1`,[versionId])).rows[0];
        if(!row) fail('Quotation version not found.','QUOTATION_NOT_FOUND');
        return {...describe(row,row.history,row.latest),rfqOutcome:row.rfq_outcome};
      };
      return sharedClient ? read(sharedClient) : transaction(pool,read);
    },
    async pending(actorId) {
      return transaction(pool,async client=>{
        await actor(client,actorId,'sales_head');
        return (await client.query(`SELECT v.id AS "versionId",v.version_number AS "versionNumber",q.rfq_id AS "rfqId",
          v.rfq_snapshot AS rfq,v.annual_value_ex_gst AS "annualValueExGst"
          FROM quotation_versions v JOIN quotations q ON q.id=v.quotation_id
          WHERE v.version_number=q.next_version-1 AND EXISTS (SELECT 1 FROM quotation_events e WHERE e.version_id=v.id AND event_type='submitted')
          AND NOT EXISTS (SELECT 1 FROM rfq_outcomes o WHERE o.rfq_id=q.rfq_id)
          AND NOT EXISTS (SELECT 1 FROM quotation_events e WHERE e.version_id=v.id AND event_type IN ('auto_approved','approved','rejected'))
          ORDER BY v.created_at,v.id`)).rows;
      });
    },
    async act(actorId, versionId, action, key, body) {
      actorId=validateId(actorId); versionId=validateId(versionId); key=validateId(key);
      if(!['submit','approve','reject','issue'].includes(action)) fail('Invalid lifecycle action.','INVALID_QUOTATION_INPUT');
      if(!body || Object.getPrototypeOf(body)!==Object.prototype || Object.keys(body).some(k=>k!=='reason') ||
        (action!=='reject' && Object.keys(body).length) || (action==='reject' && (typeof body.reason!=='string' || !body.reason.trim() || body.reason.trim().length>1000 || /[\x00-\x1f\x7f]/.test(body.reason))))
        fail('Rejection requires a reason of 1–1000 characters; other actions require an empty body.','INVALID_QUOTATION_INPUT');
      const reason=action==='reject'?body.reason.trim():null;
      const eventType={submit:'submitted',approve:'approved',reject:'rejected',issue:'issued'}[action];
      return transaction(pool,async client=>{
        await actor(client,actorId,['approve','reject'].includes(action)?'sales_head':'estimator');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`lifecycle:${actorId}:${key}`]);
        const prior=(await client.query('SELECT * FROM quotation_events WHERE actor_user_id=$1 AND submission_key=$2',[actorId,key])).rows[0];
        if(prior) {
          if(prior.version_id!==versionId || prior.event_type!==eventType || prior.reason!==reason) fail('This request key was used for a different action.','SUBMISSION_CONFLICT');
          return {versionId,replayed:true,quotationNumber:prior.quotation_number};
        }
        const version=(await client.query('SELECT * FROM quotation_versions WHERE id=$1',[versionId])).rows[0];
        if(!version) fail('Quotation version not found.','QUOTATION_NOT_FOUND');
        const header=(await client.query('SELECT rfq_id,next_version-1 AS latest FROM quotations WHERE id=$1 FOR UPDATE',[version.quotation_id])).rows[0];
        if((await client.query('SELECT 1 FROM rfq_outcomes WHERE rfq_id=$1',[header.rfq_id])).rowCount) fail('This RFQ is Won or Lost. New quotation actions are closed; historical versions remain available.','RFQ_TERMINAL');
        if(version.version_number!==header.latest) fail('A newer version exists. Open and submit the latest version.','STALE_QUOTATION');
        const baseline=(await client.query("SELECT taxable_subtotal FROM quotation_totals WHERE version_id=$1 AND scenario='100'",[versionId])).rows[0];
        if(!baseline || !new Decimal(baseline.taxable_subtotal).eq(version.annual_value_ex_gst)) fail('Saved baseline totals do not match.');
        const history=await events(client,versionId), state=describe(version,history,header.latest);
        if((action==='submit' && state.status!=='draft') || (['approve','reject'].includes(action) && state.status!=='pending') ||
          (action==='issue' && state.status!=='approved')) fail('This version is not eligible for that action. Refresh its lifecycle status.');
        const append=async(type,position,submissionKey,eventReason=null,number=null)=>client.query(`INSERT INTO quotation_events
          (version_id,position,event_type,actor_user_id,reason,submission_key,quotation_number) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [versionId,position,type,actorId,eventReason,submissionKey,number]);
        const number=action==='issue'?`FQ-${versionId}`:null;
        await append(eventType,history.length+1,key,reason,number);
        if(action==='submit' && !state.approvalRequired) await append('auto_approved',2,null);
        return {versionId,replayed:false,quotationNumber:number};
      });
    }
  };
}
