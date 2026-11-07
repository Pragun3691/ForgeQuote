import {money, timestamp} from './format.js';
import Identifier from './Identifier.jsx';
import ScrollTable from './ScrollTable.jsx';
import IssueConfirmation from './IssueConfirmation.jsx';
import React, { useEffect, useRef, useState } from 'react';
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
  return <section id="approvals" className="approval-section"><div className="section-heading"><div><p className="eyebrow">Sales Head review</p><h2>Pending approvals</h2></div>
    <button className="secondary" onClick={()=>setReload(n=>n+1)}>Refresh pending approvals</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {!versions && !error && <p role="status">Loading pending approvals...</p>}
    {versions?.length===0 && <p>No quotations pending review.</p>}
    {!!versions?.length && <ScrollTable label="Pending approvals" className="panel"><table aria-label="Pending approvals"><thead><tr><th>RFQ / customer</th><th>Version</th><th className="numeric">Saved annual value · ex-GST</th><th>Review</th></tr></thead><tbody>{versions.map(v=><tr key={v.versionId}><th scope="row">{v.rfq.reference}<span className="subtext">{v.rfq.customer_name}</span></th><td>Version {v.versionNumber}</td><td className="numeric">{money(v.annualValueExGst)}</td><td><a className="review-link" aria-label={`${v.rfq.reference} · Version ${v.versionNumber} · Review quotation`} href={`#${new URLSearchParams({rfq:v.rfqId,version:v.versionId})}`}>Review quotation</a></td></tr>)}</tbody></table></ScrollTable>}
  </section>;
}

export default function QuoteLifecycle({snapshot,session,onExpired}) {
  const [state,setState]=useState(null),[error,setError]=useState(''),[reason,setReason]=useState('');
  const [downloading,setDownloading]=useState(false);
  const [confirming,setConfirming]=useState(false);
  const issuanceInFlight=useRef(false);
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
  async function downloadPdf(internal=false) {
    setDownloading(true);setError('');
    try {
      const response=await fetch(`/api/quote-versions/${snapshot.versionId}/${internal?'internal-pdf':'pdf'}`,{credentials:'same-origin'});
      if(!response.ok) {
        const result=await response.json();
        if(response.status===401) onExpired();
        throw Error(result.error?.message || 'PDF download failed. Please retry.');
      }
      if(!response.headers.get('content-type')?.startsWith('application/pdf')) throw Error('The server did not return a PDF. Please retry.');
      const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=internal?`INTERNAL-${snapshot.versionId}.pdf`:`${state.quotationNumber}.pdf`;document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) {setError(e.message || 'PDF download failed. Please retry.');}
    finally {setDownloading(false);}
  }
  const estimator=session.user.role==='estimator';
  const canIssue=estimator && state?.status==='approved' && !state.stale && !busy && !blocked && !pending;
  useEffect(()=>{if(confirming && !canIssue)setConfirming(false);},[confirming,canIssue]);
  return <section className="panel lifecycle" aria-label="Quotation lifecycle"><h2>Approval and issuance · Version {snapshot.versionNumber}</h2>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="secondary" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh lifecycle</button>
    {!state && <p role="status">Loading lifecycle...</p>}
    {state && <><p role="status">Quotation status: <strong className={`badge status-${state.status}`}>{state.status}</strong>{state.stale?' · Superseded by a newer version':''}</p>
      <p>{state.approvalRequired?'Sales Head approval required: saved annual value is above INR 25,00,000 excluding GST.':'Automatic clearance: saved annual value is at or below INR 25,00,000 excluding GST.'}</p>
      {state.quotationNumber && <p>Quotation number: <Identifier value={state.quotationNumber}/></p>}
      <p><button className="secondary" disabled={downloading} onClick={()=>downloadPdf(true)}>Download INTERNAL costing PDF</button></p>
      {state.status==='issued' && !state.stale && <p><button disabled={downloading} onClick={()=>downloadPdf()}>{downloading?'Preparing PDF...':'Download customer PDF'}</button></p>}
      <fieldset disabled={busy || blocked}>
        {pending ? <><p>Previous {pending.action} outcome may be uncertain. Retry the same request before another action.</p><button onClick={()=>act(pending.action)}>Retry same lifecycle action</button></> : !state.stale && <>
          {estimator && state.status==='draft' && <button onClick={()=>act('submit')}>Submit for clearance</button>}
          {estimator && state.status==='approved' && <button onClick={()=>setConfirming(true)}>Issue quotation</button>}
          {!estimator && state.status==='pending' && <><button onClick={()=>act('approve')}>Approve version</button><label>Rejection reason<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="secondary danger" disabled={!reason.trim()} onClick={()=>act('reject')}>Reject version</button></>}
        </>}
      </fieldset>
      {state.status==='rejected' && <p>Create and submit a new quotation version to request another review.</p>}
      <ol className="event-ledger" aria-label="Lifecycle event history">{state.events.map(e=><li key={e.position}><strong>{e.eventType.replaceAll('_',' ')}</strong><time dateTime={e.occurredAt}>{timestamp(e.occurredAt)}</time><span>Actor <Identifier value={e.actorId}/></span>{e.reason && <p>{e.reason}</p>}</li>)}</ol>
    </>}
    {confirming && canIssue && <IssueConfirmation snapshot={snapshot} onCancel={()=>setConfirming(false)} onConfirm={()=>{if(canIssue && !issuanceInFlight.current){issuanceInFlight.current=true;setConfirming(false);act('issue').finally(()=>{issuanceInFlight.current=false;});}}}/>}
  </section>;
}
