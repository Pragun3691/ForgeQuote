import React,{useState} from 'react';
import {api} from './api.js';

// Keep exact intent/key through refresh and uncertain responses, separately for
// each actor and workflow. Never silently turn a retry into a new operation.
function useRecordedAction(storageKey,session,onExpired,onSaved) {
  const [initial]=useState(()=>{try {
    const pending=JSON.parse(sessionStorage.getItem(storageKey)||'null');
    if(pending && (typeof pending.path!=='string' || typeof pending.key!=='string' || !pending.body))throw Error();
    return {pending};
  }catch{return {blocked:true};}});
  const [pending,setPending]=useState(initial.pending),[busy,setBusy]=useState(false),[error,setError]=useState(initial.blocked?'Recovery storage is unavailable. Restore session storage before saving.':''),[notice,setNotice]=useState('');
  const [blocked,setBlocked]=useState(!!initial.blocked);
  async function save(path,body) {
    setBusy(true);setError('');setNotice('');let request;
    try {
      request=pending || {path,body,key:crypto.randomUUID()};
      sessionStorage.setItem(storageKey,JSON.stringify(request));setPending(request);
    }catch{setBlocked(true);setError('Recovery storage is unavailable. No request was sent.');setBusy(false);return;}
    try {
      const result=await api(request.path,{method:'POST',body:request.body,submissionKey:request.key,csrfToken:session.csrfToken});
      sessionStorage.removeItem(storageKey);setPending(null);setNotice(result.replayed?'Saved result recovered. No duplicate was created.':'Saved successfully.');onSaved();
    }catch(e){setError(e.message);if(e.status===401)onExpired();
      if([400,403,404,409,422].includes(e.status))try{sessionStorage.removeItem(storageKey);setPending(null);}catch{setBlocked(true);}
    }finally{setBusy(false);}
  }
  return {pending,busy,blocked,error,notice,save};
}
function Feedback({state}) {return <>{state.error && <p role="alert" className="error">{state.error}</p>}{state.notice && <p role="status" className="success">{state.notice}</p>}</>;}

export function RateAuthor({data,session,onExpired,onSaved}) {
  const [keyId,setKeyId]=useState(''),[value,setValue]=useState(''),[date,setDate]=useState(data.businessDate),[reason,setReason]=useState('');
  const state=useRecordedAction(`forgequote:rate-author:${session.user.id}`,session,onExpired,onSaved);
  return <section className="panel lifecycle"><h2>Add effective-dated rate version</h2>
    <p>Sales Head only. Existing versions are immutable. The new start must be later than this key's latest start and today or later in Asia/Kolkata.</p>
    <Feedback state={state}/>
    {state.pending?<><p>A previous rate request may have committed. Retry its exact saved inputs before another rate change.</p><button disabled={state.busy || state.blocked} onClick={()=>state.save()}>Retry same rate request</button></>:
      <form onSubmit={e=>{e.preventDefault();state.save(`/rates/${keyId}/versions`,{value,effectiveFrom:date,reason});}}><fieldset disabled={state.busy || state.blocked}>
        <label>Rate key<select aria-label="Rate key" required value={keyId} onChange={e=>setKeyId(e.target.value)}><option value="">Select existing key</option>{data.rateKeys.map(k=><option key={k.id} value={k.id}>{k.code} ({k.unit}) - latest {k.versions[0]?.effectiveFrom || 'none'}</option>)}</select></label>
        <label>New decimal value<input required inputMode="decimal" pattern="(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?" value={value} onChange={e=>setValue(e.target.value)}/></label>
        <label>Effective-from date<input required type="date" min={data.businessDate} value={date} onChange={e=>setDate(e.target.value)}/></label>
        <label>Rate change reason<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <button disabled={!reason.trim() || !keyId}>Save rate version</button>
      </fieldset></form>}
  </section>;
}

export function RfqOutcome({rfq,session,onExpired,onSaved}) {
  const [reason,setReason]=useState('');
  const state=useRecordedAction(`forgequote:rfq-outcome:${session.user.id}:${rfq.id}`,session,onExpired,onSaved);
  return <section className="panel lifecycle"><h2>RFQ outcome</h2><p role="status">RFQ status: <strong>{rfq.status}</strong></p>
    <p>Assigned estimator: {rfq.assignedEstimator}</p><Feedback state={state}/>
    {session.user.role==='sales_head' && (state.pending?<><p>Retry the saved outcome before another action.</p><button disabled={state.busy || state.blocked} onClick={()=>state.save()}>Retry same outcome request</button></>:rfq.status==='sent'?<fieldset disabled={state.busy || state.blocked}>
      <p>Won and lost are terminal outcomes.</p><button onClick={()=>state.save(`/rfqs/${rfq.id}/outcomes`,{outcome:'won'})}>Mark RFQ won</button>
      <label>Lost reason<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <button disabled={!reason.trim()} onClick={()=>state.save(`/rfqs/${rfq.id}/outcomes`,{outcome:'lost',reason})}>Mark RFQ lost</button>
    </fieldset>:null)}
    {rfq.status==='estimating' && <p>Sent is recorded automatically when a quotation is actually issued.</p>}
    <ol aria-label="RFQ outcome history">{rfq.outcomes.map(o=><li key={o.outcome}>{o.outcome} - {o.actor} - {o.occurredAt}{o.reason?` - ${o.reason}`:''}</li>)}</ol>
    <button className="secondary" onClick={onSaved}>Refresh RFQ status</button>
  </section>;
}
