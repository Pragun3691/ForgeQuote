import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';
import { validateId, validateDate, inputError } from './quotation-request.js';

export const businessDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fail=(message,code='INVALID_QUOTATION_INPUT')=>{throw inputError(message,code);};
export async function requireSalesHead(client,actorId) {
  const user=(await client.query('SELECT active,role FROM users WHERE id=$1',[validateId(actorId)])).rows[0];
  if(!user?.active) fail('Sign in to continue.','AUTH_REQUIRED');
  if(user.role!=='sales_head') fail('Sales Head authorization is required.','ROLE_FORBIDDEN');
}
function fields(body,expected) {
  if(!body || Object.getPrototypeOf(body)!==Object.prototype || Object.keys(body).sort().join(',')!==expected.sort().join(',')) fail(`Expected fields: ${expected.join(', ')}.`);
}
function reason(value) {
  if(typeof value!=='string' || !value.trim() || value.trim().length>1000 || /[\x00-\x1f\x7f]/.test(value)) fail('A reason of 1-1000 characters is required.');
  return value.trim();
}
export async function addRateVersion(pool,actorId,keyId,key,body) {
  actorId=validateId(actorId);keyId=validateId(keyId);key=validateId(key);
  fields(body,['value','effectiveFrom','reason']);
  if(typeof body.value!=='string' || !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(body.value)) fail('Rate must be a nonnegative decimal string with at most 12 integer and six fractional digits.');
  const value=body.value.includes('.')?body.value.replace(/0+$/,'').replace(/\.$/,''):body.value;
  const effectiveFrom=validateDate(body.effectiveFrom),note=reason(body.reason);
  return transaction(pool,async client=>{
    await requireSalesHead(client,actorId);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`rate-request:${actorId}:${key}`]);
    const prior=(await client.query('SELECT *,effective_from::text AS start_date FROM rate_versions WHERE actor_user_id=$1 AND submission_key=$2',[actorId,key])).rows[0];
    if(prior) {
      if(prior.rate_key_id!==keyId || prior.raw_value!==value || prior.start_date!==effectiveFrom || prior.reason!==note) fail('This request key was used for different rate inputs.','SUBMISSION_CONFLICT');
      return {rateVersionId:prior.id,replayed:true};
    }
    if(!(await client.query('SELECT id FROM rate_keys WHERE id=$1',[keyId])).rowCount) fail('Rate key not found.','RATE_KEY_NOT_FOUND');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`rate-key:${keyId}`]);
    const latest=(await client.query('SELECT max(effective_from)::text AS date FROM rate_versions WHERE rate_key_id=$1',[keyId])).rows[0].date;
    const today=(await client.query("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date::text AS date")).rows[0].date;
    if(effectiveFrom<today || (latest && effectiveFrom<=latest)) fail('Effective date must be today or later in Asia/Kolkata and later than the latest version.','RATE_DATE_CONFLICT');
    const id=randomUUID();
    await client.query(`INSERT INTO rate_versions(id,rate_key_id,effective_from,raw_value,actor_user_id,reason,submission_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,[id,keyId,effectiveFrom,value,actorId,note,key]);
    return {rateVersionId:id,replayed:false};
  });
}

export async function recordOutcome(pool,actorId,rfqId,key,body) {
  actorId=validateId(actorId);rfqId=validateId(rfqId);key=validateId(key);
  fields(body,body?.outcome==='lost'?['outcome','reason']:['outcome']);
  if(!['won','lost'].includes(body.outcome)) fail('Outcome must be won or lost.');
  const note=body.outcome==='lost'?reason(body.reason):null;
  return transaction(pool,async client=>{
    await requireSalesHead(client,actorId);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`outcome-request:${actorId}:${key}`]);
    const prior=(await client.query('SELECT * FROM rfq_outcomes WHERE actor_user_id=$1 AND submission_key=$2',[actorId,key])).rows[0];
    if(prior) {
      if(prior.rfq_id!==rfqId || prior.outcome!==body.outcome || prior.reason!==note) fail('This request key was used for a different outcome.','SUBMISSION_CONFLICT');
      return {rfqId,outcome:prior.outcome,replayed:true};
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`rfq-outcome:${rfqId}`]);
    if(!(await client.query('SELECT id FROM rfqs WHERE id=$1',[rfqId])).rowCount) fail('RFQ not found.','RFQ_NOT_FOUND');
    if((await client.query('SELECT 1 FROM rfq_outcomes WHERE rfq_id=$1',[rfqId])).rowCount) fail('This RFQ already has a terminal outcome.','RFQ_OUTCOME_CONFLICT');
    if(!(await client.query(`SELECT 1 FROM quotations q JOIN quotation_versions v ON v.quotation_id=q.id
      JOIN quotation_events e ON e.version_id=v.id WHERE q.rfq_id=$1 AND e.event_type='issued'`,[rfqId])).rowCount) fail('Only a sent RFQ can be marked won or lost.','RFQ_OUTCOME_CONFLICT');
    await client.query('INSERT INTO rfq_outcomes(rfq_id,outcome,actor_user_id,reason,submission_key) VALUES ($1,$2,$3,$4,$5)',[rfqId,body.outcome,actorId,note,key]);
    return {rfqId,outcome:body.outcome,replayed:false};
  });
}
