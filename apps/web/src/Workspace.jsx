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

function useRoute() {
  const [route,setRoute] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  useEffect(() => { const changed = () => setRoute(new URLSearchParams(window.location.hash.slice(1))); window.addEventListener('hashchange',changed); return () => window.removeEventListener('hashchange',changed); },[]);
  return route;
}
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

export default function Workspace({ session, onExpired, onEditingChange }) {
  const route = useRoute(), rfqId = route.get('rfq');
  const [rfqs,setRfqs] = useState(null), [error,setError] = useState(''), [refresh,setRefresh] = useState(0);
  const [creating,setCreating] = useState(false), [notice,setNotice] = useState('');
  useEffect(()=>{onEditingChange(creating && !rfqId && route.get('view')!=='rates');},[creating,rfqId,route,onEditingChange]);
  useEffect(()=>{if(route.has('approvals')) document.getElementById('approvals')?.scrollIntoView();},[route]);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    api('/rfqs',{signal:controller.signal}).then(result => setRfqs(result.rfqs)).catch(error => {
      if (error.name !== 'AbortError') { setError(error.message); if(error.status === 401) onExpired(); }
    });
    return () => controller.abort();
  },[refresh]);
  if (route.get('view')==='rates') return <RateCatalogue session={session} onExpired={onExpired}/>;
  if (rfqId) return <RfqWorkspace key={rfqId} rfqId={rfqId} versionId={route.get('version')} session={session} onExpired={onExpired}/>;
  return <main className="workspace register-workspace"><div className="section-heading page-heading"><div><p className="eyebrow">{session.user.role === 'sales_head' ? 'Sales Head workspace' : 'Estimator workspace'}</p><h1>RFQ register</h1><p className="muted">Manufacturing enquiries and quotation progress.</p></div>
    {session.user.role === 'estimator' && !creating && <button onClick={()=>{setNotice('');setCreating(true);}}>New RFQ</button>}</div>
    {creating && <RfqCreate session={session} onExpired={onExpired} onCancel={()=>setCreating(false)} onCreated={()=>{setCreating(false);setNotice('RFQ saved successfully. Open it from the register below.');setRefresh(value=>value+1);}}/>}
    {notice && <div role="status" className="success">{notice}</div>}
    {error && <div role="alert" className="error">{error}<br/><button onClick={() => setRefresh(value => value+1)}>Reload RFQs</button></div>}
    {!rfqs && !error && <p role="status">Loading RFQs...</p>}
    {rfqs?.length === 0 && <section className="panel empty"><h2>No RFQs yet</h2><p>{session.user.role === 'estimator' ? 'Create an RFQ using New RFQ above.' : 'An estimator can create an RFQ for this register.'}</p></section>}
    {!!rfqs?.length && <ScrollTable label="RFQ register" className="panel register-table"><table aria-label="RFQ register"><thead><tr><th>Reference</th><th>Customer</th><th>Due date</th><th>Assigned estimator</th><th>RFQ status</th><th>Action</th></tr></thead><tbody>{rfqs.map(rfq => <tr key={rfq.id}><th scope="row">{rfq.reference}</th><td>{rfq.customerName}</td><td>{dateLabel(rfq.dueDate)}</td><td>{rfq.assignedEstimator}</td><td><span className={`badge status-${rfq.status}`}>{rfq.status}</span></td><td><a href={link(rfq.id)}>Open RFQ</a></td></tr>)}</tbody></table></ScrollTable>}
    {session.user.role === 'sales_head' && <PendingApprovals onExpired={onExpired}/>}
  </main>;
}

function RfqWorkspace({ rfqId, versionId, session, onExpired }) {
  const key = storageKey(session.user.id,rfqId);
  const [rfq,setRfq] = useState(null), [form,setForm] = useState(null), [pending,setPending] = useState(null);
  const [snapshot,setSnapshot] = useState(null), [error,setError] = useState(''), [storageError,setStorageError] = useState('');
  const [saving,setSaving] = useState(false), [loadingQuote,setLoadingQuote] = useState(false), [notice,setNotice] = useState(''), [reload,setReload] = useState(0);
  const rfqRead=useRef(0);
  async function readRfq(signal) {
    const request=++rfqRead.current;
    const data=await api(`/rfqs/${rfqId}`,{signal});
    if(!signal?.aborted && request===rfqRead.current)setRfq(data);
    return data;
  }
  const refreshRfq=()=>readRfq().catch(handleError);
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
      setForm(record?.body || {pricingDate:data.businessDate,parts:data.parts.map(part=>({partId:part.id,routingRevisionId:part.routes[0]?.id || '',marginPercent:'20',tierQuantities:part.defaultTierQuantities}))});
    }).catch(error => { if(!controller.signal.aborted) handleError(error); });
    return () => controller.abort();
  },[rfqId]);
  useEffect(() => {
    if(!targetVersion || !rfqReady) {setSnapshot(null);setLoadingQuote(false);return;}
    const controller = new AbortController(); setLoadingQuote(true);setSnapshot(null);
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
    })().catch(error => {if(!controller.signal.aborted) handleError(error);}).finally(() => {if(!controller.signal.aborted) setLoadingQuote(false);});
    return () => controller.abort();
  },[rfqId,targetVersion,reload,rfqReady]);
  async function submit(event) {
    event.preventDefault();setError('');setNotice('');
    let record;
    try {
      record = pending && pending.phase !== 'rejected' ? pending : {submissionKey:pending?.submissionKey || crypto.randomUUID(),body:structuredClone(form),phase:'saving'};
      persist({...record,phase:'saving'});
    } catch {setStorageError('Browser storage is unavailable. Saving is blocked to protect the submission key. Enable session storage and reload.');return;}
    setSaving(true);
    try {
      const receipt=await api(`/rfqs/${rfqId}/quote-versions`,{method:'POST',body:record.body,submissionKey:record.submissionKey,csrfToken:session.csrfToken});
      persist({...record,phase:'saved',versionId:receipt.versionId});
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
    setForm(current=>Object.hasOwn(current,'parts') ? {...current,parts:current.parts.map(part=>part.partId===partId?{...part,...change}:part)} : {...current,...change});
  }
  return <main className="workspace"><a className="back-link" href="#">← RFQ register</a>
    {error && <p role="alert" className="error">{error}</p>}{storageError && <p role="alert" className="error">{storageError}</p>}
    {!rfq && !error && <p role="status">Loading RFQ...</p>}
    {rfq && <><div className="section-heading"><div><p className="eyebrow">RFQ / {canWrite?'Estimation':'Review'}</p><h1>{rfq.reference}</h1></div><span className="badge">{canWrite?'Estimator':'Sales head'}</span></div>
      <dl className="title-block"><div><dt>Customer</dt><dd>{rfq.customerName}</dd></div><div><dt>Due date</dt><dd>{dateLabel(rfq.dueDate)}</dd></div><div><dt>Assigned estimator</dt><dd>{rfq.assignedEstimator}</dd></div><div><dt>RFQ status</dt><dd role="status"><span className="sr-only">RFQ status: </span><span className={`badge status-${rfq.status}`}>{rfq.status}</span></dd></div></dl>
      <div className="title-footer"><RfqOutcome rfq={rfq} session={session} onExpired={onExpired} onSaved={refreshRfq}/><button className="secondary" onClick={refreshRfq}>Refresh RFQ status</button></div>
      {rfq.versions.length>0 && <nav className="version-nav" aria-label="Saved versions"><strong>Saved versions</strong>{rfq.versions.map(version=><a key={version.id} aria-current={sameId(targetVersion,version.id)?'page':undefined} href={link(rfqId,version.id)}>Version {version.versionNumber} · {dateLabel(version.pricingDate)}</a>)}</nav>}
      {selectedSnapshot && <div className="saved-overview"><QuoteResults snapshot={selectedSnapshot} summaryOnly/><QuoteLifecycle key={selectedSnapshot.versionId} snapshot={selectedSnapshot} session={session} onExpired={onExpired}/></div>}
      {!supported && <p role="alert" className="error">Costing requires 1–20 RFQ parts, each with a supported routing revision. No partial quotation can be saved.</p>}
      <div className="detail-workbench"><div className="part-list">{rfq.parts.map(part => <section className="part-facts" key={part.id}><div><p className="eyebrow">RFQ part</p><h2>{part.partNumber}</h2><p>{part.description}</p></div><div><p className="eyebrow">Gross weight</p><strong>{part.grossWeightKg} kg</strong></div><div><p className="eyebrow">Annual quantity</p><strong>{grouped(part.requestedAnnualQty)}</strong></div></section>)}</div>
      {!canWrite && <SavedCostingInputs snapshot={selectedSnapshot} loading={loadingQuote}/>}
      {canWrite && supported && form && <form className="panel costing-form" onSubmit={submit}><div className="section-heading"><div><h2>{canWrite?'Costing inputs':'RFQ defaults · Read-only'}</h2><p className="muted">{canWrite?'Choose annual production quantities. The 100% scenario is the headline price.':'These RFQ defaults are not the selected saved quotation inputs. Review the saved results and INTERNAL costing PDF for that version.'}</p></div></div>
        <fieldset disabled={!canWrite || !!frozen || !!storageError}><label>Pricing date<input required type="date" value={form.pricingDate} onChange={e=>setForm({...form,pricingDate:e.target.value})}/></label>
          {requestParts(form).map(input=>{
            const part=rfq.parts.find(part=>part.id.toLowerCase()===input.partId.toLowerCase());
            return <fieldset className="intake-part" key={input.partId} aria-label={`Costing ${part?.partNumber || input.partId}`}><legend>{part?.partNumber || input.partId}</legend>
              <div className="input-grid costing-part-inputs"><label>Gross margin (%)<input required inputMode="decimal" pattern="(?:0|[1-9][0-9]?)(?:\.[0-9]{1,6})?" title="Enter 0 to below 100, with up to six decimal places." value={input.marginPercent} onChange={e=>changePart(input.partId,{marginPercent:e.target.value})}/></label><label>Routing revision<select required value={input.routingRevisionId} onChange={e=>changePart(input.partId,{routingRevisionId:e.target.value})}>{!part?.routes.some(route=>route.id===input.routingRevisionId) && <option value={input.routingRevisionId}>{input.routingRevisionId || 'No routing available'}</option>}{part?.routes.map(route=><option key={route.id} value={route.id}>Rev {route.revisionNumber} · {route.machineCode} · {route.cycleTimeMin} min · {route.setupHoursPerBatch} setup hours/batch</option>)}</select></label></div>
              <div className="input-grid quantities">{['50','100','150'].map(scenario=><label key={scenario}>{scenario}% annual quantity<input required inputMode="numeric" pattern="[1-9][0-9]{0,9}" title="Enter a whole number from 1 to 1000000000." value={input.tierQuantities[scenario]} onChange={e=>changePart(input.partId,{tierQuantities:{...input.tierQuantities,[scenario]:e.target.value}})}/></label>)}</div>
            </fieldset>;
          })}</fieldset>
        {!canWrite ? <p className="notice">Sales head cannot create quotations. Select a saved version below to review.</p> : <div className="actions"><button type="submit" className={pending?.phase==='saved' ? 'secondary' : undefined} disabled={saving || !!storageError}>{saving?'Saving draft...':pending?.phase === 'saved'?'Retrieve same submission':frozen?'Retry same submission':'Calculate & save draft'}</button>{pending && <button type="button" className="secondary" disabled={saving || !!storageError} onClick={startNew}>Start new calculation</button>}</div>}
        {pending && <p className="muted submission-note">Submission key: <Identifier value={pending.submissionKey}/>{['saving','uncertain'].includes(pending.phase) && ' · Outcome may be uncertain. Retry this submission before starting a new calculation.'}</p>}
      </form>}</div>
      {notice && <p role="status" className="success">{notice}</p>}
    </>}
    {loadingQuote && <p role="status">Loading saved quotation...</p>}
    {targetVersion && !loadingQuote && !snapshot && <button onClick={()=>{setError('');setReload(value=>value+1);}}>Reload saved quotation</button>}
    {selectedSnapshot && <><QuoteResults snapshot={selectedSnapshot}/></>}
  </main>;
}
