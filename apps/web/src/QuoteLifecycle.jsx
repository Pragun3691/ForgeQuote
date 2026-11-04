import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export function PendingApprovals({onExpired}) {
  const [versions,setVersions]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    api('/quote-versions/pending',{signal:controller.signal}).then(data=>{setVersions(data.versions);setError('');}).catch(e=>{
      if(e.name!=='AbortError'){setError(e.message);if(e.status===401) onExpired();}
    });
    return ()=>controller.abort();
  },[reload]);
  return <section className="panel lifecycle"><h2>Pending approvals</h2>
    <button className="secondary" onClick={()=>setReload(n=>n+1)}>Refresh pending approvals</button>
    {error && <p role="alert" className="error">{error}</p>}
    {!versions && !error && <p role="status">Loading pending approvals...</p>}
    {versions?.length===0 && <p>No quotations pending review.</p>}
    {versions?.map(v=><p key={v.versionId}><a href={`#${new URLSearchParams({rfq:v.rfqId,version:v.versionId})}`}>{v.rfq.reference} · Version {v.versionNumber} · INR {v.annualValueExGst} excluding GST</a></p>)}
  </section>;
}

export default function QuoteLifecycle({snapshot,session,onExpired}) {
  const [state,setState]=useState(null),[error,setError]=useState(''),[reason,setReason]=useState('');
  const [busy,setBusy]=useState(false),[reload,setReload]=useState(0),[pending,setPending]=useState(null),[blocked,setBlocked]=useState(false);
  const storageKey=`forgequote:lifecycle:${session.user.id}:${snapshot.versionId}`;
  useEffect(()=>{
    try {
      const stored=JSON.parse(sessionStorage.getItem(storageKey)||'null');
      if(stored && (!['submit','approve','reject','issue'].includes(stored.action) || typeof stored.key!=='string' || !stored.body)) throw Error();
      setPending(stored);
    } catch {setBlocked(true);setError('Lifecycle recovery storage is unavailable or unreadable. Restore session storage before taking action.');}
  },[storageKey]);
  useEffect(()=>{
    const controller=new AbortController();
    api(`/quote-versions/${snapshot.versionId}/lifecycle`,{signal:controller.signal}).then(setState).catch(e=>{
      if(e.name!=='AbortError'){setError(e.message);if(e.status===401) onExpired();}
    });
    return ()=>controller.abort();
  },[snapshot.versionId,reload]);
  async function act(action) {
    setBusy(true);setError('');
    try {
      const request=pending || {action,key:crypto.randomUUID(),body:action==='reject'?{reason}: {}};
      sessionStorage.setItem(storageKey,JSON.stringify(request));setPending(request);
      await api(`/quote-versions/${snapshot.versionId}/${request.action}`,{method:'POST',body:request.body,submissionKey:request.key,csrfToken:session.csrfToken});
      sessionStorage.removeItem(storageKey);setPending(null);setReason('');setReload(n=>n+1);
    } catch(e) {
      setError(e.message || 'Action failed. Retry the same action to check its outcome.');
      if(e.status===401) onExpired();
      if([400,403,404,409,422].includes(e.status)) {
        try {sessionStorage.removeItem(storageKey);setPending(null);} catch {setBlocked(true);}
      }
    } finally {setBusy(false);}
  }
  const estimator=session.user.role==='estimator';
  return <section className="panel lifecycle" aria-label="Quotation lifecycle"><h2>Approval and issuance · Version {snapshot.versionNumber}</h2>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="secondary" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh lifecycle</button>
    {!state && <p role="status">Loading lifecycle...</p>}
    {state && <><p role="status">Quotation status: <strong>{state.status}</strong>{state.stale?' · Superseded by a newer version':''}</p>
      <p>{state.approvalRequired?'Sales Head approval required: saved annual value is above INR 25,00,000 excluding GST.':'Automatic clearance: saved annual value is at or below INR 25,00,000 excluding GST.'}</p>
      {state.quotationNumber && <p>Quotation number: <strong>{state.quotationNumber}</strong></p>}
      <fieldset disabled={busy || blocked}>
        {pending ? <><p>Previous {pending.action} outcome may be uncertain. Retry the same request before another action.</p><button onClick={()=>act(pending.action)}>Retry same lifecycle action</button></> : !state.stale && <>
          {estimator && state.status==='draft' && <button onClick={()=>act('submit')}>Submit for clearance</button>}
          {estimator && state.status==='approved' && <button onClick={()=>act('issue')}>Issue quotation</button>}
          {!estimator && state.status==='pending' && <><button onClick={()=>act('approve')}>Approve version</button><label>Rejection reason<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!reason.trim()} onClick={()=>act('reject')}>Reject version</button></>}
        </>}
      </fieldset>
      {state.status==='rejected' && <p>Create and submit a new quotation version to request another review.</p>}
      <ol aria-label="Lifecycle event history">{state.events.map(e=><li key={e.position}>{e.eventType} · {e.occurredAt} · Actor {e.actorId}{e.reason?` · ${e.reason}`:''}</li>)}</ol>
    </>}
  </section>;
}
