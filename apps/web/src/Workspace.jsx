import CostingInputs from './CostingInputs.jsx';
import SavedVersionNav from './SavedVersionNav.jsx';
import RfqRegister from './RfqRegister.jsx';
import {readListView,listHash} from './register-view.js';
import SavedCostingInputs from './SavedCostingInputs.jsx';
import {dateLabel} from './format.js';
import Identifier from './Identifier.jsx';
import ScrollTable from './ScrollTable.jsx';
import {RfqOutcome} from './FinalWorkflows.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import QuoteResults, { grouped } from './QuoteResults.jsx';
import RfqCreate from './RfqCreate.jsx';
import QuoteLifecycle, { PendingApprovals } from './QuoteLifecycle.jsx';
import RateCatalogue from './RateCatalogue.jsx';
import {useRoute,navigate} from './route.js';
import {WorkspaceDrafts,useMemoryDraft,useDraftMarker} from './WorkspaceDrafts.jsx';
import {readError as readErrorMessage} from './read-error.js';

const link = (rfq,version) => `#${new URLSearchParams({rfq,...(version ? {version} : {})})}`;
const storageKey = (userId,rfqId) => `forgequote:submission:${userId}:${rfqId}`;
const requestParts = body => Object.hasOwn(body,'parts') ? body.parts : [body];
const sameId=(a,b)=>typeof a==='string' && typeof b==='string' && a.toLowerCase()===b.toLowerCase();
function validPendingBody(body) {
  if (!body || typeof body.pricingDate !== 'string') return false;
  const parts=requestParts(body);
  return Array.isArray(parts) && parts.length>=1 && parts.length<=20 && parts.every(part=>part &&
    ['partId','routingRevisionId','marginPercent'].every(field=>typeof part[field]==='string') &&
    part.tierQuantities && ['50','100','150'].every(scenario=>typeof part.tierQuantities[scenario]==='string')) &&
    new Set(parts.map(part=>part.partId)).size===parts.length;
}
function loadPending(key) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  const stored = JSON.parse(raw);
  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
  if (!stored || !uuid(stored.submissionKey) || !['saving','saved','rejected','uncertain'].includes(stored.phase) ||
      !validPendingBody(stored.body) ||
      (stored.phase === 'saved' && !uuid(stored.versionId))) throw Error('Saved submission is unreadable. Do not submit again until the previous outcome is checked.');
  return stored;
}

export default function Workspace(props) {
  return <WorkspaceDrafts><WorkspaceView {...props}/></WorkspaceDrafts>;
}
function WorkspaceView({session,onExpired,destinations={back:"#"}}) {
  const route=useRoute(session.user.role),rfqId=route.rfqId;
  const [rfqs,setRfqs] = useState(null), [error,setError] = useState(''), [refresh,setRefresh] = useState(0);
  const creating=route.view==='intake' && session.user.role==='estimator';
  const registerVisible=['register','approvals','intake'].includes(route.view);
  const [intakeVisited,setIntakeVisited]=useState(creating),[ratesVisited,setRatesVisited]=useState(route.view==='rates'),[notice,setNotice]=useState('');
  const [createdId,setCreatedId]=useState(null);
  const [reading,setReading]=useState(false);
  useEffect(()=>{if(creating)setIntakeVisited(true);if(route.view==='rates')setRatesVisited(true);if(route.view==='approvals')document.getElementById('approvals')?.scrollIntoView();},[route.view,creating]);
  useEffect(() => {
    if(!registerVisible)return;
    const controller = new AbortController(); setError('');setReading(true);
    api('/rfqs',{signal:controller.signal}).then(result => {if(!controller.signal.aborted){setRfqs(result.rfqs);setError('');}}).catch(error => {
      if (!controller.signal.aborted) { setError(readErrorMessage(error,'RFQs')); if(error.status === 401) onExpired(); }
    }).finally(()=>{if(!controller.signal.aborted)setReading(false);});
    return () => controller.abort();
  },[refresh,route.view,registerVisible]);
  return <><main hidden={!registerVisible} className="workspace register-workspace"><div className="section-heading page-heading"><div><p className="eyebrow">{session.user.role === 'sales_head' ? 'Sales Head workspace' : 'Estimator workspace'}</p><h1>RFQ register</h1><p className="muted">Manufacturing enquiries and quotation progress.</p></div>
    {session.user.role === 'estimator' && !creating && <button onClick={()=>{setNotice('');setCreatedId(null);navigate('#view=intake');}}>New RFQ</button>}</div>
    {(intakeVisited||creating) && <div hidden={!creating}><RfqCreate session={session} onExpired={onExpired} onCancel={()=>navigate('#')} onCreated={id=>{setCreatedId(id);navigate('#');setNotice('RFQ saved successfully. Open it from the register below.');setRefresh(value=>value+1);}}/></div>}
    {notice && <div role="status" className="success">{notice} {createdId&&<a href={link(createdId)}>Open saved RFQ</a>}</div>}
    <RfqRegister rfqs={rfqs} reading={reading} error={error} onRefresh={()=>setRefresh(value=>value+1)} canCreate={session.user.role==='estimator'} view={readListView(window.location.hash)} onView={(patch,replace=false)=>navigate(listHash(window.location.hash,patch),{replace})}/>
    {session.user.role === 'sales_head' && <PendingApprovals active={registerVisible} refreshSignal={`${refresh}:${route.view}`} onExpired={onExpired}/>}
  </main>
  {(ratesVisited||route.view==='rates') && <div hidden={route.view!=='rates'}><RateCatalogue active={route.view==='rates'} session={session} onExpired={onExpired}/></div>}
  {rfqId && <RfqWorkspace returnHref={destinations.back} key={rfqId} rfqId={rfqId} versionId={route.versionId} session={session} onExpired={onExpired} onChanged={()=>setRefresh(value=>value+1)}/>}
  </>;
}

function RfqWorkspace({ returnHref="#",rfqId, versionId, session, onExpired,onChanged }) {
  const key = storageKey(session.user.id,rfqId);
  const [rfq,setRfq] = useState(null),[form,setForm]=useMemoryDraft(`costing:${rfqId}`,null), [pending,setPending] = useState(null);
  const markDirty=useDraftMarker(`costing:${rfqId}`);
  const [snapshot,setSnapshot] = useState(null), [error,setError] = useState(''), [storageError,setStorageError] = useState('');
  const [saving,setSaving] = useState(false), [loadingQuote,setLoadingQuote] = useState(false), [notice,setNotice] = useState(''), [reload,setReload] = useState(0);
  const [readError,setReadError]=useState(''),[snapshotError,setSnapshotError]=useState(''),[inputsReady,setInputsReady]=useState(false),[inputReload,setInputReload]=useState(0);
  const rfqRead=useRef(0);
  useEffect(()=>()=>{rfqRead.current+=1;},[]);
  async function readRfq(signal) {
    const request=++rfqRead.current;
    try {
      const data=await api(`/rfqs/${rfqId}`,{signal});
      if(!signal?.aborted && request===rfqRead.current){setRfq(data);setReadError('');}
      return data;
    } catch(error) {
      if(!signal?.aborted && request===rfqRead.current){setReadError(readErrorMessage(error,'this RFQ'));if(error.status===401)onExpired();}
      throw error;
    }
  }
  const refreshRfq=()=>{setReadError('');return readRfq().catch(()=>{});};
  const canWrite = session.user.role === 'estimator';
  const targetVersion = versionId || pending?.versionId;
  const rfqReady=!!rfq;
  // A new route renders before its fetching effect runs. Never expose the
  // previous version's financial panels under the newly selected URL/link.
  const selectedSnapshot=snapshot && sameId(snapshot.versionId,targetVersion)?snapshot:null;
  const frozen = saving || (pending && pending.phase !== 'rejected');
  function handleError(error) { setError(error.message || 'Network failure. Retry with the same submission.'); if(error.status === 401) onExpired(); }
  function persist(value) {
    // Persist before sending. If storage is unavailable, block creation rather
    // than risk losing the key during refresh after an uncertain outcome.
    sessionStorage.setItem(key,JSON.stringify(value)); setPending(value);
  }
  useEffect(() => {
    const controller = new AbortController();
    readRfq(controller.signal).then(data => {
      if(controller.signal.aborted)return;
      let record;
      try { record=loadPending(key); setPending(record); } catch(error) { setStorageError(error.message); }
      // Keep recovered legacy bodies byte-for-byte; never reshape an uncertain request.
      setForm(current=>(record && record.phase!=='rejected'?record.body:current || record?.body) || {pricingDate:data.businessDate,parts:data.parts.map(part=>({partId:part.id,routingRevisionId:part.routes[0]?.id || '',marginPercent:'20',tierQuantities:part.defaultTierQuantities}))});
      setInputsReady(true);
    }).catch(()=>{});
    return () => controller.abort();
  },[rfqId,inputReload]);
  useEffect(() => {
    if(!targetVersion || !rfqReady) {setSnapshot(null);setLoadingQuote(false);setSnapshotError('');return;}
    const controller = new AbortController(); setLoadingQuote(true);setSnapshot(null);setSnapshotError('');
    (async()=>{
      const data=await api(`/quote-versions/${targetVersion}`,{signal:controller.signal});
      if(controller.signal.aborted)return;
      if(!sameId(data.rfq.id,rfqId) || !sameId(data.versionId,targetVersion)) throw Error('This quotation does not belong to the selected RFQ or version.');
      // Read navigation metadata after the immutable version exists. Refreshing
      // this list must not reinitialize estimator inputs or recovered requests.
      const metadata=await readRfq(controller.signal);
      if(controller.signal.aborted)return;
      if(!metadata.versions.some(version=>sameId(version.id,data.versionId)))throw Error('The selected version is missing from the RFQ version list. Reload the saved quotation.');
      setSnapshot(data);
    })().catch(error => {if(!controller.signal.aborted){setSnapshotError(readErrorMessage(error,'the saved quotation'));if(error.status===401)onExpired();}}).finally(() => {if(!controller.signal.aborted) setLoadingQuote(false);});
    return () => controller.abort();
  },[rfqId,targetVersion,reload,rfqReady]);
  async function submit(event) {
    event.preventDefault();setError('');setNotice('');
    let record;
    try {
      record = pending && pending.phase !== 'rejected' ? pending : {submissionKey:pending?.submissionKey || crypto.randomUUID(),body:structuredClone(form),phase:'saving'};
      persist({...record,phase:'saving'});
      markDirty(false);
    } catch {setStorageError('Browser storage is unavailable. Saving is blocked to protect the submission key. Enable session storage and reload.');return;}
    setSaving(true);
    try {
      const receipt=await api(`/rfqs/${rfqId}/quote-versions`,{method:'POST',body:record.body,submissionKey:record.submissionKey,csrfToken:session.csrfToken});
      persist({...record,phase:'saved',versionId:receipt.versionId});
      onChanged();
      window.location.hash=link(rfqId,receipt.versionId);
      setReload(value => value+1);setNotice(receipt.replayed ? 'Saved draft recovered. This submission created no duplicate version.' : 'Draft saved successfully.');
      readRfq().catch(error => {setError('Draft saved, but the RFQ version list could not be refreshed. Reload to view it.');if(error.status === 401) onExpired();});
    } catch(error) {
      const rejected=[400,404,422].includes(error.status);
      try {persist({...record,phase:rejected?'rejected':'uncertain'});} catch {setStorageError('Could not update browser storage. Keep this tab open and retain the submission key shown below.');}
      handleError(error);
      if(error.code === 'CSRF_INVALID') setError('Session security token changed. Refresh this page, then retry the same submission.');
    } finally {setSaving(false);}
  }
  function startNew() {
    setError('');setNotice('New calculation started. Saving will create a new quotation version.');
    try {
      const next={submissionKey:crypto.randomUUID(),body:structuredClone(form),phase:'rejected'};
      persist(next);
    } catch {setStorageError('Browser storage is unavailable. Reload before starting a new calculation.');}
  }
  const supported=rfq?.parts.length>=1 && rfq.parts.length<=20 && rfq.parts.every(part=>part.routes.length>0);
  function changePart(partId, change) {
    markDirty(true);
    setForm(current=>Object.hasOwn(current,'parts') ? {...current,parts:current.parts.map(part=>part.partId===partId?{...part,...change}:part)} : {...current,...change});
  }
  function jumpTo(id){const target=document.getElementById(id);target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});}
  return <main className="workspace costing-workspace"><a className="back-link" href={returnHref}>← RFQ register</a>
    {error && <p role="alert" className="error">{error}</p>}{storageError && <p role="alert" className="error">{storageError}</p>}
    {readError && <p role="alert" className="error">{readError}</p>}
    {snapshotError && <p role="alert" className="error">{snapshotError}</p>}
    {!rfq && !readError && <p role="status">Loading RFQ...</p>}
    {!rfq && readError && <button onClick={()=>{setReadError('');setInputReload(value=>value+1);}}>Reload RFQ</button>}
    {rfq && <><div className="section-heading"><div><p className="eyebrow">RFQ / {canWrite?'Estimation':'Review'}</p><h1>{rfq.reference}</h1></div><span className="badge">{canWrite?'Estimator':'Sales head'}</span></div>
      <dl className="title-block"><div><dt>Customer</dt><dd>{rfq.customerName}</dd></div><div><dt>Due date</dt><dd>{dateLabel(rfq.dueDate)}</dd></div><div><dt>Assigned estimator</dt><dd>{rfq.assignedEstimator}</dd></div><div><dt>RFQ status</dt><dd role="status"><span className="sr-only">RFQ status: </span><span className={`badge status-${rfq.status}`}>{rfq.status}</span></dd></div></dl>
      <div className="rfq-outcome-area"><RfqOutcome rfq={rfq} session={session} onExpired={onExpired} onSaved={()=>{refreshRfq();onChanged();}}/><button className="secondary" onClick={refreshRfq}>Refresh RFQ status</button></div>
      <SavedVersionNav versions={rfq.versions} versionId={targetVersion} rfqId={rfqId} snapshot={selectedSnapshot} canWrite={canWrite} loading={loadingQuote} error={snapshotError}/>
      <nav className="workspace-sections" aria-label="RFQ sections">{(!canWrite || (supported && form && inputsReady))&&<button type="button" className="secondary" onClick={()=>jumpTo(canWrite?'working-heading':'saved-inputs-heading')}>{canWrite?'Go to costing inputs':'Go to saved inputs'}</button>}{selectedSnapshot&&<button type="button" className="secondary" onClick={()=>jumpTo('saved-results-heading')}>Go to saved results</button>}<button type="button" className="secondary" onClick={()=>jumpTo('rfq-parts-heading')}>Go to RFQ part facts</button>{selectedSnapshot&&<><button type="button" className="secondary" onClick={()=>jumpTo('lifecycle-heading')}>Go to approval and issuance</button><button type="button" className="secondary" onClick={()=>jumpTo('documents-heading')}>Go to documents</button></>}{(['sent','won','lost'].includes(rfq.status)||rfq.outcomes.length>0)&&<button type="button" className="secondary" onClick={()=>jumpTo('rfq-outcome-heading')}>Go to RFQ outcome</button>}</nav>
      {selectedSnapshot && <div className="saved-overview"><QuoteResults snapshot={selectedSnapshot} summaryOnly/><QuoteLifecycle key={selectedSnapshot.versionId} snapshot={selectedSnapshot} session={session} onExpired={onExpired} onChanged={()=>{refreshRfq();onChanged();}}/></div>}
      {!supported && <p role="alert" className="error">Costing requires 1–20 RFQ parts, each with a supported routing revision. No partial quotation can be saved.</p>}
      <div className="detail-workbench"><div className="part-list"><h2 id="rfq-parts-heading" tabIndex={-1}>RFQ part facts</h2><p className="muted">Current RFQ quantities and specifications.</p>{rfq.parts.map(part => <section className="part-facts" key={part.id}><div><p className="eyebrow">RFQ part</p><h2>{part.partNumber}</h2><p>{part.description}</p></div><div><p className="eyebrow">Gross weight</p><strong>{part.grossWeightKg} kg</strong></div><div><p className="eyebrow">Annual quantity</p><strong>{grouped(part.requestedAnnualQty)}</strong></div></section>)}</div>
      {!canWrite && <SavedCostingInputs snapshot={selectedSnapshot} loading={loadingQuote}/>}
      {canWrite && supported && form && inputsReady && <CostingInputs form={form} rfq={rfq} pending={pending} frozen={frozen} saving={saving} storageError={storageError} onSubmit={submit} onChangePart={changePart} onStartNew={startNew} onPricingDateChange={value=>{markDirty(true);setForm({...form,pricingDate:value});}}/>}</div>
      {notice && <p role="status" className="success">{notice}</p>}
    </>}
    {loadingQuote && <p role="status">Loading saved quotation...</p>}
    {targetVersion && !loadingQuote && !snapshot && <button onClick={()=>{setSnapshotError('');setReload(value=>value+1);}}>Reload saved quotation</button>}
    {selectedSnapshot && <><QuoteResults snapshot={selectedSnapshot}/></>}
  </main>;
}
