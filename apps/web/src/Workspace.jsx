import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import QuoteResults, { grouped } from './QuoteResults.jsx';
import RfqCreate from './RfqCreate.jsx';
import QuoteLifecycle, { PendingApprovals } from './QuoteLifecycle.jsx';

function useRoute() {
  const [route,setRoute] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  useEffect(() => { const changed = () => setRoute(new URLSearchParams(window.location.hash.slice(1))); window.addEventListener('hashchange',changed); return () => window.removeEventListener('hashchange',changed); },[]);
  return route;
}
const link = (rfq,version) => `#${new URLSearchParams({rfq,...(version ? {version} : {})})}`;
const storageKey = (userId,rfqId) => `forgequote:submission:${userId}:${rfqId}`;
const requestParts = body => Object.hasOwn(body,'parts') ? body.parts : [body];
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

export default function Workspace({ session, onExpired }) {
  const route = useRoute(), rfqId = route.get('rfq');
  const [rfqs,setRfqs] = useState(null), [error,setError] = useState(''), [refresh,setRefresh] = useState(0);
  const [creating,setCreating] = useState(false), [notice,setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setError('');
    api('/rfqs',{signal:controller.signal}).then(result => setRfqs(result.rfqs)).catch(error => {
      if (error.name !== 'AbortError') { setError(error.message); if(error.status === 401) onExpired(); }
    });
    return () => controller.abort();
  },[refresh]);
  if (rfqId) return <RfqWorkspace key={rfqId} rfqId={rfqId} versionId={route.get('version')} session={session} onExpired={onExpired}/>;
  return <main className="workspace"><div className="section-heading"><div><p className="eyebrow">Estimator workspace</p><h1>RFQ register</h1></div><span className="badge">Synthetic demo</span></div><p className="muted">Open an RFQ to prepare a costed, versioned quotation.</p>
    {session.user.role === 'sales_head' && <PendingApprovals onExpired={onExpired}/>}
    {session.user.role === 'estimator' && !creating && <button onClick={()=>{setNotice('');setCreating(true);}}>New RFQ</button>}
    {creating && <RfqCreate session={session} onExpired={onExpired} onCancel={()=>setCreating(false)} onCreated={()=>{setCreating(false);setNotice('RFQ saved successfully. Open it from the register below.');setRefresh(value=>value+1);}}/>}
    {notice && <div role="status" className="success">{notice}</div>}
    {error && <div role="alert" className="error">{error}<br/><button onClick={() => setRefresh(value => value+1)}>Reload RFQs</button></div>}
    {!rfqs && !error && <p role="status">Loading RFQs...</p>}
    {rfqs?.length === 0 && <section className="panel empty"><h2>No RFQs yet</h2><p>{session.user.role === 'estimator' ? 'Create an RFQ using New RFQ above.' : 'An estimator can create an RFQ for this register.'}</p></section>}
    {!!rfqs?.length && <div className="table-scroll panel"><table aria-label="RFQ register"><thead><tr><th>RFQ / customer</th><th>Due date</th><th>Owner</th><th>Status</th><th>Action</th></tr></thead><tbody>{rfqs.map(rfq => <tr key={rfq.id}><th scope="row">{rfq.reference}<span className="subtext">{rfq.customerName}</span></th><td>{rfq.dueDate}</td><td>{rfq.ownerLabel}</td><td><span className="badge">{rfq.status}</span></td><td><a href={link(rfq.id)}>Open RFQ</a></td></tr>)}</tbody></table></div>}
  </main>;
}

function RfqWorkspace({ rfqId, versionId, session, onExpired }) {
  const key = storageKey(session.user.id,rfqId);
  const [rfq,setRfq] = useState(null), [form,setForm] = useState(null), [pending,setPending] = useState(null);
  const [snapshot,setSnapshot] = useState(null), [error,setError] = useState(''), [storageError,setStorageError] = useState('');
  const [saving,setSaving] = useState(false), [loadingQuote,setLoadingQuote] = useState(false), [notice,setNotice] = useState(''), [reload,setReload] = useState(0);
  const canWrite = session.user.role === 'estimator';
  const targetVersion = versionId || pending?.versionId;
  const frozen = saving || (pending && pending.phase !== 'rejected');
  function handleError(error) { setError(error.message || 'Network failure. Retry with the same submission.'); if(error.status === 401) onExpired(); }
  function persist(value) {
    // Persist before sending. If storage is unavailable, block creation rather
    // than risk losing the key during refresh after an uncertain outcome.
    sessionStorage.setItem(key,JSON.stringify(value)); setPending(value);
  }
  useEffect(() => {
    const controller = new AbortController();
    api(`/rfqs/${rfqId}`,{signal:controller.signal}).then(data => {
      setRfq(data);
      let record;
      try { record=loadPending(key); setPending(record); } catch(error) { setStorageError(error.message); }
      // Keep recovered legacy bodies byte-for-byte; never reshape an uncertain request.
      setForm(record?.body || {pricingDate:data.businessDate,parts:data.parts.map(part=>({partId:part.id,routingRevisionId:part.routes[0]?.id || '',marginPercent:'20',tierQuantities:part.defaultTierQuantities}))});
    }).catch(error => { if(error.name !== 'AbortError') handleError(error); });
    return () => controller.abort();
  },[rfqId]);
  useEffect(() => {
    if(!targetVersion) {setSnapshot(null);return;}
    const controller = new AbortController(); setLoadingQuote(true);setSnapshot(null);
    api(`/quote-versions/${targetVersion}`,{signal:controller.signal}).then(data => {
      if(data.rfq.id !== rfqId) throw Error('This quotation does not belong to the selected RFQ.');
      setSnapshot(data);
    }).catch(error => {if(error.name !== 'AbortError') handleError(error);}).finally(() => {if(!controller.signal.aborted) setLoadingQuote(false);});
    return () => controller.abort();
  },[targetVersion,reload]);
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
      api(`/rfqs/${rfqId}`).then(setRfq).catch(error => {setError('Draft saved, but the RFQ version list could not be refreshed. Reload to view it.');if(error.status === 401) onExpired();});
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
    {rfq && <><div className="section-heading"><div><p className="eyebrow">{rfq.customerName}</p><h1>{rfq.reference}</h1></div><span className="badge">{canWrite?'Estimator':'Sales head'}</span></div><p className="muted">Due {rfq.dueDate} · {rfq.ownerLabel} · {rfq.status}</p>
      {!supported && <p role="alert" className="error">Costing requires 1–20 RFQ parts, each with a supported routing revision. No partial quotation can be saved.</p>}
      {rfq.parts.map(part => <section className="panel part-facts" key={part.id}><div><p className="eyebrow">Part</p><h2>{part.partNumber}</h2><p>{part.description}</p></div><div><p className="eyebrow">Gross weight</p><strong>{part.grossWeightKg} kg</strong></div><div><p className="eyebrow">RFQ annual quantity</p><strong>{grouped(part.requestedAnnualQty)}</strong></div></section>)}
      {supported && form && <form className="panel costing-form" onSubmit={submit}><div className="section-heading"><div><h2>Costing inputs</h2><p className="muted">Choose annual production quantities. The 100% scenario is the headline price.</p></div></div>
        <fieldset disabled={!canWrite || !!frozen || !!storageError}><label>Pricing date<input required type="date" value={form.pricingDate} onChange={e=>setForm({...form,pricingDate:e.target.value})}/></label>
          {requestParts(form).map(input=>{
            const part=rfq.parts.find(part=>part.id.toLowerCase()===input.partId.toLowerCase());
            return <fieldset className="intake-part" key={input.partId} aria-label={`Costing ${part?.partNumber || input.partId}`}><legend>{part?.partNumber || input.partId}</legend>
              <div className="input-grid costing-part-inputs"><label>Gross margin (%)<input required inputMode="decimal" pattern="(?:0|[1-9][0-9]?)(?:\.[0-9]{1,6})?" title="Enter 0 to below 100, with up to six decimal places." value={input.marginPercent} onChange={e=>changePart(input.partId,{marginPercent:e.target.value})}/></label><label>Routing revision<select required value={input.routingRevisionId} onChange={e=>changePart(input.partId,{routingRevisionId:e.target.value})}>{!part?.routes.some(route=>route.id===input.routingRevisionId) && <option value={input.routingRevisionId}>{input.routingRevisionId || 'No routing available'}</option>}{part?.routes.map(route=><option key={route.id} value={route.id}>Rev {route.revisionNumber} · {route.machineCode} · {route.cycleTimeMin} min · {route.setupHoursPerBatch} setup hours/batch</option>)}</select></label></div>
              <div className="input-grid quantities">{['50','100','150'].map(scenario=><label key={scenario}>{scenario}% annual quantity<input required inputMode="numeric" pattern="[1-9][0-9]{0,9}" title="Enter a whole number from 1 to 1000000000." value={input.tierQuantities[scenario]} onChange={e=>changePart(input.partId,{tierQuantities:{...input.tierQuantities,[scenario]:e.target.value}})}/></label>)}</div>
            </fieldset>;
          })}</fieldset>
        {!canWrite ? <p className="notice">Sales head cannot create quotations. Select a saved version below to review.</p> : <div className="actions"><button type="submit" disabled={saving || !!storageError}>{saving?'Saving draft...':pending?.phase === 'saved'?'Retrieve same submission':frozen?'Retry same submission':'Calculate & save draft'}</button>{pending && <button type="button" className="secondary" disabled={saving || !!storageError} onClick={startNew}>Start new calculation</button>}</div>}
        {pending && <p className="muted submission-note">Submission key: <span className="identifier">{pending.submissionKey}</span>{['saving','uncertain'].includes(pending.phase) && ' · Outcome may be uncertain. Retry this submission before starting a new calculation.'}</p>}
      </form>}
      {notice && <p role="status" className="success">{notice}</p>}
      {rfq.versions.length>0 && <nav className="version-nav" aria-label="Saved versions"><strong>Saved versions</strong>{rfq.versions.map(version=><a key={version.id} aria-current={targetVersion===version.id?'page':undefined} href={link(rfqId,version.id)}>Version {version.versionNumber} · {version.pricingDate}</a>)}</nav>}
    </>}
    {loadingQuote && <p role="status">Loading saved quotation...</p>}
    {targetVersion && !loadingQuote && !snapshot && <button onClick={()=>{setError('');setReload(value=>value+1);}}>Reload saved quotation</button>}
    {snapshot && <><QuoteResults snapshot={snapshot}/><QuoteLifecycle key={snapshot.versionId} snapshot={snapshot} session={session} onExpired={onExpired}/></>}
  </main>;
}
