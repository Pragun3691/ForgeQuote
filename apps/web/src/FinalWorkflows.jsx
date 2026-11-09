import RateAuthorForm from './RateAuthorForm.jsx';
import DecisionConfirmation from './DecisionConfirmation.jsx';
import RecordedActionSummary from './RecordedActionSummary.jsx';
import {reasonError} from './rate-authoring.js';
import {timestamp} from './format.js';
import React,{useEffect,useState} from 'react';
import {api} from './api.js';
import {useDraftMarker,useMemoryDraft} from './WorkspaceDrafts.jsx';

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
  const inFlight=React.useRef(false);
  async function save(path,body) {
    if(inFlight.current)return;inFlight.current=true;
    setBusy(true);setError('');setNotice('');let request;
    try {
      request=pending || {path,body,key:crypto.randomUUID()};
      sessionStorage.setItem(storageKey,JSON.stringify(request));setPending(request);
    }catch{setBlocked(true);setError('Recovery storage is unavailable. No request was sent.');setBusy(false);inFlight.current=false;return;}
    try {
      const result=await api(request.path,{method:'POST',body:request.body,submissionKey:request.key,csrfToken:session.csrfToken});
      sessionStorage.removeItem(storageKey);setPending(null);setNotice(result.replayed?'Saved result recovered. No duplicate was created.':'Saved successfully.');onSaved();
    }catch(e){setError(e.message);if(e.status===401)onExpired();
      if([400,403,404,409,422].includes(e.status))try{sessionStorage.removeItem(storageKey);setPending(null);}catch{setBlocked(true);}
    }finally{setBusy(false);inFlight.current=false;}
  }
  return {pending,busy,blocked,error,notice,save};
}
function Feedback({state}) {return <>{state.error && <p role="alert" className="error">{state.error}</p>}{state.notice && <p role="status" className="success">{state.notice}</p>}</>;}

export function RateAuthor({data,session,onExpired,onSaved}) {
  const [discard,setDiscard]=useState(null),[draftCycle,setDraftCycle]=useState(0);
  const [keyId,setKeyId]=useState(''),[value,setValue]=useState(''),[date,setDate]=useState(data.businessDate),[reason,setReason]=useState('');
  const markDirty=useDraftMarker('rate-author');
  const state=useRecordedAction(`forgequote:rate-author:${session.user.id}`,session,onExpired,()=>{setKeyId('');setValue('');setDate(data.businessDate);setReason('');markDirty(false);onSaved();});
  useEffect(()=>{markDirty(!state.pending && !!(keyId || value || reason || date!==data.businessDate));},[keyId,value,reason,date,data.businessDate,state.pending,markDirty]);
  useEffect(()=>()=>markDirty(false),[markDirty]);
  return <section className="panel rate-author" aria-labelledby="rate-author-title"><h2 id="rate-author-title" tabIndex={-1}>Add effective-dated rate version</h2>
    <p>Sales Head only. Existing versions are immutable. The new start must be later than this key's latest start and today or later in Asia/Kolkata.</p>
    <Feedback state={state}/>
    {state.pending?<><p>A previous rate request may have committed. Retry its exact saved inputs before another rate change.</p><RecordedActionSummary request={state.pending} label="Recorded rate request"/><button disabled={state.busy || state.blocked} onClick={()=>state.save()}>Retry same rate request</button></>:
    <RateAuthorForm resetCycle={draftCycle} data={data} draft={{keyId,value,date,reason}} busy={state.busy} blocked={state.blocked} onChange={(field,value)=>({keyId:setKeyId,value:setValue,date:setDate,reason:setReason})[field](value)} onSave={()=>state.save(`/rates/${keyId}/versions`,{value,effectiveFrom:date,reason})} onDiscard={()=>setDiscard({trigger:document.activeElement,title:'Discard unsaved rate draft?',description:'This clears only your working rate inputs. Recorded history is unchanged.',facts:[['Draft','Not saved']],confirmLabel:'Discard draft'})}/>}
    {discard&&<DecisionConfirmation review={discard} onCancel={()=>setDiscard(null)} onConfirm={()=>{setDiscard(null);setDraftCycle(n=>n+1);setKeyId('');setValue('');setDate(data.businessDate);setReason('');markDirty(false);}}/>}
  </section>;
}

export function RfqOutcome({rfq,session,onExpired,onSaved}) {
  const [reason,setReason]=useMemoryDraft(`outcome:${rfq.id}`,'');
  const [review,setReview]=useState(null),inFlight=React.useRef(false),markDirty=useDraftMarker(`outcome:${rfq.id}`);
  const state=useRecordedAction(`forgequote:rfq-outcome:${session.user.id}:${rfq.id}`,session,onExpired,()=>{setReason('');markDirty(false);onSaved();});
  useEffect(()=>{markDirty(session.user.role==='sales_head'&&rfq.status==='sent'&&!state.pending&&!!reason);},[reason,state.pending,rfq.status,session.user.role,markDirty]);
  function request(outcome){
    const lastIssued=rfq.versions.filter(v=>v.lifecycleStatus==='issued').reduce((latest,v)=>BigInt(v.versionNumber)>latest?BigInt(v.versionNumber):latest,0n);
    const unfinished=rfq.versions.filter(v=>BigInt(v.versionNumber)>lastIssued&&['draft','pending','approved','rejected'].includes(v.lifecycleStatus));
    setReview({trigger:document.activeElement,outcome,title:`Mark RFQ ${outcome}?`,description:'This permanently closes quotation work: no new versions, submission, approval, rejection or issuance. Historical reads, eligible PDFs and recovery of already committed identical requests remain available. Reopening or correcting an outcome is not supported. Any unfinished versions, including changes made in another tab, will be blocked.',facts:[['RFQ',rfq.reference],['Customer',rfq.customerName],['Outcome',outcome],['Newer unfinished versions',unfinished.length?unfinished.map(v=>`Version ${v.versionNumber} (${v.lifecycleStatus})`).join(', '):'None in the last loaded history. Other tabs may have newer changes.']],reason:outcome==='lost'?reason:undefined,confirmLabel:`Confirm ${outcome}`});
  }
  const hasAction=session.user.role==='sales_head' && (state.pending || rfq.status==='sent');
  if(!hasAction && !rfq.outcomes.length && !state.error && !state.notice) return null;
  return <section className="outcome-strip" aria-label="RFQ outcome"><h2 id="rfq-outcome-heading" tabIndex={-1}>RFQ outcome</h2><Feedback state={state}/>
    {session.user.role==='sales_head' && (state.pending?<><p>Retry the saved outcome before another action.</p><RecordedActionSummary request={state.pending} label="Recorded outcome request"/><button disabled={state.busy || state.blocked} onClick={()=>state.save()}>Retry same outcome request</button></>:rfq.status==='sent'?<fieldset disabled={state.busy || state.blocked}>
      <p>Sent means a quotation was issued; it does not record an email delivery. Won and lost are terminal outcomes.</p><button onClick={()=>request('won')}>Mark RFQ won</button>
      <label>Lost reason<textarea aria-label="Lost reason" maxLength={1000} value={reason} aria-invalid={reason&&reasonError(reason)?true:undefined} aria-describedby={reason&&reasonError(reason)?'outcome-reason-error':undefined} onChange={e=>setReason(e.target.value)}/>{reason&&reasonError(reason)&&<span id="outcome-reason-error" className="field-error">{reasonError(reason)}</span>}</label>
      <button className="secondary danger" disabled={!!reasonError(reason)} onClick={()=>request('lost')}>Mark RFQ lost</button>
    </fieldset>:null)}
    {review&&<DecisionConfirmation review={review} onCancel={()=>setReview(null)} onConfirm={()=>{if(inFlight.current)return;inFlight.current=true;setReview(null);state.save(`/rfqs/${rfq.id}/outcomes`,review.outcome==='lost'?{outcome:'lost',reason:review.reason}:{outcome:'won'}).finally(()=>{inFlight.current=false;});}}/>}
    {!!rfq.outcomes.length && <ol className="event-ledger" aria-label="RFQ outcome history">{rfq.outcomes.map(o=><li key={o.outcome}>{o.outcome} - {o.actor} - {timestamp(o.occurredAt)}{o.reason?` - ${o.reason}`:''}</li>)}</ol>}
  </section>;
}
