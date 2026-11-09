import PdfDownloads from './PdfDownloads.jsx';
import DecisionConfirmation from './DecisionConfirmation.jsx';
import RecordedActionSummary from './RecordedActionSummary.jsx';
import {useMemoryDraft,useDraftMarker} from './WorkspaceDrafts.jsx';
import {reasonError} from './rate-authoring.js';
import {filterApprovals,readListView,listHash} from './register-view.js';
import {navigate,useRoute} from './route.js';
import {money, timestamp} from './format.js';
import Identifier from './Identifier.jsx';
import ScrollTable from './ScrollTable.jsx';
import IssueConfirmation from './IssueConfirmation.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import {readError as readErrorMessage} from './read-error.js';

export function PendingApprovals({onExpired,active=true,refreshSignal=0}) {
  useRoute('sales_head');
  const view=readListView(window.location.hash,true);
  const onView=(patch,replace=false)=>navigate(listHash(window.location.hash,patch),{replace});
  const [versions,setVersions]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const [reading,setReading]=useState(false);
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();setReading(true);setError('');
    api('/quote-versions/pending',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setVersions(data.versions);setError('');}}).catch(e=>{
      if(!controller.signal.aborted){setError(readErrorMessage(e,'pending approvals'));if(e.status===401) onExpired();}
    }).finally(()=>{if(!controller.signal.aborted)setReading(false);});
    return ()=>controller.abort();
  },[reload,active,refreshSignal]);
  const rows=filterApprovals(versions||[],view);
  return <section id="approvals" className="approval-section"><div className="section-heading"><div><p className="eyebrow">Sales Head review</p><h2>Pending approvals</h2></div>
    <button className="secondary" onClick={()=>setReload(n=>n+1)}>Refresh pending approvals</button></div>
    <div className="list-controls approval-controls"><label className="list-search">Search pending approvals<input type="search" value={view.q} placeholder="Reference or customer" onChange={e=>onView({aq:e.target.value},true)}/></label><label>Sort pending approvals<select aria-label="Sort pending approvals" value={view.sort} onChange={e=>onView({asort:e.target.value})}><option value="server">Oldest saved first</option><option value="reference">Reference · A–Z</option><option value="version">Version · highest first</option></select></label>{(view.q||view.sort!=='server')&&<button className="secondary" onClick={()=>onView({aq:'',asort:'server'})}>Reset approval filters</button>}</div>
    {versions&&<p className="muted" role="status">{rows.length} of {versions.length} pending approvals</p>}
    {error && <p role="alert" className="error">{error}{versions&&' Showing previously loaded pending approvals.'}</p>}
    {reading && !error && <p role="status">{versions?'Refreshing pending approvals...':'Loading pending approvals...'}</p>}
    {versions?.length===0 && <p>No quotations pending review.</p>}
    {!!versions?.length&&!rows.length&&<p className="notice">No matching pending approvals. Clear the search to see the queue.</p>}
    {!!rows.length && <ScrollTable label="Pending approvals" className="panel approval-table"><table aria-label="Pending approvals"><thead><tr><th>RFQ / customer / review</th><th>Version</th><th className="numeric">Saved annual value · ex-GST</th></tr></thead><tbody>{rows.map(v=><tr key={v.versionId}><th scope="row">{v.rfq.reference}<span className="subtext">{v.rfq.customer_name}</span><a className="review-link row-action" aria-label={`${v.rfq.reference} · Version ${v.versionNumber} · Review quotation`} href={`#${new URLSearchParams({rfq:v.rfqId,version:v.versionId})}`}>Review quotation</a></th><td>Version {v.versionNumber}</td><td className="numeric">{money(v.annualValueExGst)}</td></tr>)}</tbody></table></ScrollTable>}
  </section>;
}

export default function QuoteLifecycle({snapshot,session,onExpired,onChanged=()=>{}}) {
  const [state,setState]=useState(null),[error,setError]=useState('');
  const [readError,setReadError]=useState(''),[reading,setReading]=useState(false);
  const [reason,setReason]=useMemoryDraft(`rejection:${snapshot.versionId}`,'');
  const markDirty=useDraftMarker(`rejection:${snapshot.versionId}`),decisionInFlight=useRef(false);
  const [decision,setDecision]=useState(null),[notice,setNotice]=useState('');
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
    const controller=new AbortController();setReadError('');setReading(true);
    api(`/quote-versions/${snapshot.versionId}/lifecycle`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted){setState(result);setReadError('');}}).catch(e=>{
      if(!controller.signal.aborted){setReadError(readErrorMessage(e,'lifecycle status'));if(e.status===401) onExpired();}
    }).finally(()=>{if(!controller.signal.aborted)setReading(false);});
    return ()=>controller.abort();
  },[snapshot.versionId,reload]);
  // An unknown lifecycle read cannot make a retained rejection draft inapplicable.
  // A recorded request already has durable same-key recovery; confirmed terminal or
  // superseded states no longer accept a rejection for this immutable version.
  useEffect(()=>{markDirty(session.user.role==='sales_head'&&(!state||(state.status==='pending'&&!state.stale))&&!pending&&!!reason);},[reason,pending,state,session.user.role,markDirty]);
  function reviewDecision(action){setDecision({action,trigger:document.activeElement,title:action==='approve'?'Approve saved version?':'Reject saved version?',description:action==='approve'?'Approval applies only to this saved version. Issuance remains a separate Estimator action.':'Rejection is final for this version. A correction requires a new quotation version.',facts:[['RFQ',snapshot.rfq.reference],['Customer',snapshot.rfq.customer_name],['Saved version',String(snapshot.versionNumber)],['Saved annual value, excluding GST',money(snapshot.annualValueExGst)]],reason:action==='reject'?reason:undefined,confirmLabel:action==='approve'?'Confirm approval':'Confirm rejection'});}
  const actionInFlight=useRef(false);
  async function act(action) {
    if(actionInFlight.current)return;actionInFlight.current=true;
    setBusy(true);setError('');setNotice('');
    try {
      const request=pending || {action,key:crypto.randomUUID(),body:action==='reject'?{reason}: {}};
      sessionStorage.setItem(storageKey,JSON.stringify(request));setPending(request);
      const result=await api(`/quote-versions/${snapshot.versionId}/${request.action}`,{method:'POST',body:request.body,submissionKey:request.key,csrfToken:session.csrfToken});
      sessionStorage.removeItem(storageKey);setPending(null);setReason('');markDirty(false);setNotice(result.replayed?'Saved lifecycle result recovered. No duplicate was created.':'Lifecycle action saved successfully.');setReload(n=>n+1);onChanged();
    } catch(e) {
      setError(e.message || 'Action failed. Retry the same action to check its outcome.');
      if(e.status===401) onExpired();
      if([400,403,404,409,422].includes(e.status)) {
        try {sessionStorage.removeItem(storageKey);setPending(null);} catch {setBlocked(true);}
      }
    } finally {setBusy(false);actionInFlight.current=false;}
  }
  const estimator=session.user.role==='estimator';
  const canIssue=estimator && state?.status==='approved' && !state.stale && !busy && !blocked && !pending && !reading && !readError;
  useEffect(()=>{if(decision&&(busy||blocked||pending||state?.status!=='pending'||state?.stale||reading||readError))setDecision(null);},[decision,busy,blocked,pending,state,reading,readError]);
  useEffect(()=>{if(confirming && !canIssue)setConfirming(false);},[confirming,canIssue]);
  return <section className="panel lifecycle" aria-label="Quotation lifecycle"><h2 id="lifecycle-heading" tabIndex={-1}>Approval and issuance · Version {snapshot.versionNumber}</h2>
    {error && <p role="alert" className="error">{error}</p>}
    {notice&&<p role="status" className="success">{notice}</p>}
    {readError && <p role="alert" className="error">{readError}{state && ' Showing previously loaded lifecycle status.'}</p>}
    <button className="secondary" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh lifecycle</button>
    {reading && !readError && <p role="status">{state?'Refreshing lifecycle...':'Loading lifecycle...'}</p>}
    {state && <><p role="status">Quotation status: <strong className={`badge status-${state.status}`}>{state.status}</strong>{state.stale?' · Superseded by a newer version':''}</p>
      <p>{state.approvalRequired?'Sales Head approval required: saved annual value is above INR 25,00,000 excluding GST.':'Automatic clearance: saved annual value is at or below INR 25,00,000 excluding GST.'}</p>
      {state.quotationNumber && <p>Quotation number: <Identifier value={state.quotationNumber}/></p>}
      <PdfDownloads snapshot={snapshot} state={state} onExpired={onExpired}/>
      <fieldset disabled={busy || blocked || (!pending && (reading || !!readError))}>
        {pending ? <><p>Previous {pending.action} outcome may be uncertain. Retry the same request before another action.</p><RecordedActionSummary request={{...pending,path:`/quote-versions/${snapshot.versionId}/${pending.action}`}} label="Recorded lifecycle request"/><button onClick={()=>act(pending.action)}>Retry same lifecycle action</button></> : !state.stale && <>
          {estimator && state.status==='draft' && <button onClick={()=>act('submit')}>Submit for clearance</button>}
          {estimator && state.status==='approved' && <button onClick={()=>setConfirming(true)}>Issue quotation</button>}
          {!estimator && state.status==='pending' && <><button onClick={()=>reviewDecision('approve')}>Approve version</button><label>Rejection reason<textarea aria-label="Rejection reason" maxLength={1000} value={reason} aria-invalid={reason&&reasonError(reason)?true:undefined} aria-describedby={reason&&reasonError(reason)?'rejection-reason-error':undefined} onChange={e=>setReason(e.target.value)}/>{reason&&reasonError(reason)&&<span id="rejection-reason-error" className="field-error">{reasonError(reason)}</span>}</label><button className="secondary danger" disabled={!!reasonError(reason)} onClick={()=>reviewDecision('reject')}>Reject version</button></>}
        </>}
      </fieldset>
      {state.status==='rejected' && <p>Create and submit a new quotation version to request another review.</p>}
      <ol className="event-ledger" aria-label="Lifecycle event history">{state.events.map(e=><li key={e.position}><strong>{e.eventType.replaceAll('_',' ')}</strong><time dateTime={e.occurredAt}>{timestamp(e.occurredAt)}</time><span>Actor <Identifier value={e.actorId}/></span>{e.reason && <p>{e.reason}</p>}</li>)}</ol>
    </>}
    {decision&&<DecisionConfirmation review={decision} onCancel={()=>setDecision(null)} onConfirm={()=>{if(decisionInFlight.current)return;decisionInFlight.current=true;const action=decision.action;setDecision(null);act(action).finally(()=>{decisionInFlight.current=false;});}}/>}
    {confirming && canIssue && <IssueConfirmation snapshot={snapshot} onCancel={()=>setConfirming(false)} onConfirm={()=>{if(canIssue && !issuanceInFlight.current){issuanceInFlight.current=true;setConfirming(false);act('issue').finally(()=>{issuanceInFlight.current=false;});}}}/>}
  </section>;
}
