import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import RfqExtraction from './RfqExtraction.jsx';
import RfqDocumentImport from './RfqDocumentImport.jsx';

const categories = ['material','machine','scrap','overhead','packaging','freight'];
const newPart = () => ({partNumber:'',description:'',grossWeightKg:'',requestedAnnualQty:'',cycleTimeMin:'',setupHoursPerBatch:'',rateKeys:Object.fromEntries(categories.map(category=>[category,'']))});
const partFields={partNumber:'part number',description:'description',grossWeightKg:'gross weight',requestedAnnualQty:'annual quantity',cycleTimeMin:'cycle time',setupHoursPerBatch:'setup hours'};
const emptyForm = () => ({reference:'',customerName:'',dueDate:'',parts:[newPart()]});
function readPending(key) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  const record = JSON.parse(raw);
  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  if (!record || !uuid(record.submissionKey) || !['saving','uncertain','rejected','saved'].includes(record.phase) ||
      !record.body || ['reference','customerName','dueDate'].some(field=>typeof record.body[field] !== 'string') ||
      !Array.isArray(record.body.parts) || record.body.parts.length < 1 || record.body.parts.length > 20 ||
      record.body.parts.some(part=>!part || ['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch'].some(field=>typeof part[field] !== 'string') || !part.rateKeys || categories.some(category=>typeof part.rateKeys[category] !== 'string')) ||
      (record.phase === 'saved' && !uuid(record.rfqId))) throw Error('Stored RFQ submission is unreadable. Check the previous save outcome before clearing browser storage.');
  return record;
}

export default function RfqCreate({ session, onExpired, onCreated, onCancel }) {
  const key = `forgequote:rfq-intake:${session.user.id}`;
  const [form,setForm] = useState(emptyForm), [pending,setPending] = useState(null), [keys,setKeys] = useState(null);
  const [error,setError] = useState(''), [storageError,setStorageError] = useState(''), [saving,setSaving] = useState(false), [reviewed,setReviewed] = useState(false), [reload,setReload] = useState(0);
  const [extracting,setExtracting] = useState(false), [aiCycle,setAiCycle] = useState(0);
  const [importing,setImporting] = useState(false), [keysAsOf,setKeysAsOf]=useState(''), [keyNotice,setKeyNotice]=useState('');
  const frozen = saving || !!(pending && pending.phase !== 'rejected');
  useEffect(()=>{
    try { const record=readPending(key); if(record) {setPending(record);setForm(record.body);setReviewed(true);} }
    catch(error) {setStorageError(error.message);}
  },[key]);
  useEffect(()=>{
    const controller=new AbortController();
    api('/rates',{signal:controller.signal}).then(data=>{setKeys(data.rateKeys);setKeysAsOf(data.asOf);}).catch(error=>{
      if(error.name !== 'AbortError') {setError(error.message);if(error.status===401) onExpired();}
    });
    return ()=>controller.abort();
  },[reload]);
  function persist(record) { sessionStorage.setItem(key,JSON.stringify(record));setPending(record); }
  function change(field,value) {setForm(current=>({...current,[field]:value}));setReviewed(false);setKeyNotice('');}
  function partChange(index,field,value) {change('parts',form.parts.map((part,i)=>i===index?{...part,[field]:value}:part));}
  function missingFields(part) {
    return [...Object.entries(partFields).filter(([field])=>!part[field].trim()).map(([,label])=>label),
      ...categories.filter(category=>!keys?.some(k=>k.category===category && k.id===part.rateKeys[category])).map(c=>`${c} key`)];
  }
  function suggestionsFor(part) {
    return categories.flatMap(category=>{
      const valid=keys?.filter(k=>k.category===category && k.currentVersion) || [];
      return !part.rateKeys[category] && valid.length===1 ? [valid[0]] : [];
    });
  }
  function useSuggested(index) {
    const suggestions=suggestionsFor(form.parts[index]);
    partChange(index,'rateKeys',{...form.parts[index].rateKeys,...Object.fromEntries(suggestions.map(k=>[k.category,k.id]))});
    setKeyNotice(`Suggested keys applied to part ${index+1} by your action. Review every selection and confirm before saving.`);
  }
  const commonReady=keys && categories.every(c=>keys.some(k=>k.category===c && k.id===form.parts[0].rateKeys[c]));
  function applyCommon() {
    if(!commonReady)return;
    change('parts',form.parts.map(part=>({...part,rateKeys:{...form.parts[0].rateKeys}})));
    setKeyNotice('Common rate keys copied from part 1 to all parts. Previous selections were replaced. Verify each part before confirming.');
  }
  function goToPart(index) {
    const element=document.getElementById(`rfq-intake-part-${index}`);
    element?.focus();element?.scrollIntoView({block:'start',behavior:'auto'});
  }
  function applyExtraction(result) {
    const verified=field=>field?.status==='verified' ? field.normalizedValue : '';
    setForm({reference:verified(result.rfq.reference),customerName:verified(result.rfq.customerName),dueDate:verified(result.rfq.dueDate),
      parts:result.parts.length ? result.parts.map(part=>({...newPart(),...Object.fromEntries(['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch'].map(name=>[name,verified(part.fields[name])]))})) : [newPart()]});
    setReviewed(false);setError('');
  }
  async function save(event) {
    event.preventDefault();setError('');
    const record=pending && pending.phase !== 'rejected' ? pending : {submissionKey:pending?.submissionKey || crypto.randomUUID(),body:structuredClone(form)};
    try {persist({...record,phase:'saving'});} catch {setStorageError('Browser storage is unavailable. Enable session storage and reload before saving.');return;}
    setSaving(true);
    try {
      const receipt=await api('/rfqs',{method:'POST',body:record.body,submissionKey:record.submissionKey,csrfToken:session.csrfToken});
      persist({...record,phase:'saved',rfqId:receipt.rfqId});
      onCreated(receipt.rfqId);
    } catch(error) {
      const rejected=[400,413,422].includes(error.status) || error.code==='RFQ_REFERENCE_CONFLICT';
      try {persist({...record,phase:rejected?'rejected':'uncertain'});} catch {setStorageError('Could not update browser storage. Retain the submission key below and keep this tab open.');}
      setError(error.code==='CSRF_INVALID' ? 'Session security token changed. Reload and sign in, then retry this same RFQ submission.' : error.message);
      if(error.status===401) onExpired();
    } finally {setSaving(false);}
  }
  function applyImport(result) {
    setForm(current=>({...current,parts:result.parts.map(part=>({...newPart(),...Object.fromEntries(['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch'].map(name=>[name,part.fields[name]?.normalizedValue||'']))}))}));
    setReviewed(false);setError('');
  }
  function startAnother() {
    try {sessionStorage.removeItem(key);setPending(null);setForm(emptyForm());setReviewed(false);setError('');setAiCycle(value=>value+1);} catch {setStorageError('Browser storage is unavailable. Reload to recover the saved RFQ.');}
  }
  return <section className="panel costing-form" aria-labelledby="create-rfq-title">
    <h2 id="create-rfq-title">Create manual RFQ</h2>
    <p className="muted">Synthetic, nonconfidential demonstration data only. Owner: {session.user.username}. Status: open. Enter and review every part before saving.</p>
    {pending?.phase!=='saved' && <><RfqDocumentImport key={`excel-${aiCycle}`} session={session} onExpired={onExpired} disabled={!!frozen || !!storageError || extracting} onApply={applyImport} onBusyChange={setImporting}/><RfqExtraction key={aiCycle} session={session} onExpired={onExpired} disabled={!!frozen || !!storageError || importing} onApply={applyExtraction} onBusyChange={setExtracting}/></>}
    {error && <div role="alert" className="error">{error}{!keys && <button type="button" onClick={()=>{setError('');setReload(value=>value+1);}}>Reload rate keys</button>}</div>}
    {storageError && <div role="alert" className="error">{storageError}</div>}
    {!keys && !error && <p role="status">Loading internal rate keys...</p>}
    {pending && <p className="submission-note">RFQ submission key: <span className="identifier">{pending.submissionKey}</span></p>}
    {pending && ['saving','uncertain'].includes(pending.phase) && <div role="status" className="notice">The previous save outcome may be unknown. Inputs are locked. Retry the same submission to recover it without creating a duplicate.</div>}
    {pending?.phase==='saved' ? <><div role="status" className="success">RFQ saved. <a href={`#rfq=${pending.rfqId}`}>Open saved RFQ</a></div><div className="actions"><button onClick={startAnother} disabled={!!storageError}>Create another RFQ</button><button className="secondary" onClick={onCancel}>Back to register</button></div></> :
    <form onSubmit={save}>
      <fieldset disabled={frozen || extracting || importing || !!storageError || !keys}>
        <legend className="sr-only">RFQ details</legend>
        <div className="input-grid">
          <label>RFQ reference<input required maxLength={80} value={form.reference} onChange={event=>change('reference',event.target.value)}/></label>
          <label>Customer name<input required maxLength={160} value={form.customerName} onChange={event=>change('customerName',event.target.value)}/></label>
          <label>Due date<input required type="date" value={form.dueDate} onChange={event=>change('dueDate',event.target.value)}/></label>
        </div>
        <section className="component-summary" aria-label="Component summary">
          <h3>Components ({form.parts.length})</h3><p className="muted">Every field and internal key is required. Missing fields are listed below; final review remains required.</p>
          <nav aria-label="Component navigation">{form.parts.map((part,index)=><button type="button" className="secondary component-jump" key={index} onClick={()=>goToPart(index)}>
            <strong>Go to part {index+1}: {part.partNumber || 'Unnamed'}</strong><span>{part.requestedAnnualQty || 'Missing'} units/year - {missingFields(part).length} missing</span>
          </button>)}</nav>
          <p className="muted">Available internal keys checked as of {keysAsOf}. Actual rates are resolved at the quotation pricing date. <a href="#view=rates" target="_blank" rel="noreferrer">Inspect rate history (new tab)</a></p>
          <button type="button" className="secondary" disabled={form.parts.length<2 || !commonReady} onClick={applyCommon}>Apply common rate keys to all parts</button>
          <p className="muted">This copies all six selected keys from part 1 and replaces every part's current key selections.</p>
          {keyNotice && <p role="status" className="notice">{keyNotice}</p>}
        </section>
        {form.parts.map((part,index)=><fieldset className="intake-part" key={index} id={`rfq-intake-part-${index}`} tabIndex={-1}>

          <legend>Part {index+1}</legend>
          <p className={missingFields(part).length?'missing-fields':'muted'} aria-live="polite">{missingFields(part).length?`Required: ${missingFields(part).join(', ')}`:'All required fields selected. Verify values and rate keys before saving.'}</p>
          <div className="input-grid">
            {[['partNumber','Part number',80],['description','Description',500]].map(([field,label,max])=><label key={field}>{label}<input required maxLength={max} value={part[field]} onChange={event=>partChange(index,field,event.target.value)}/></label>)}
            <label>Annual quantity<input required inputMode="numeric" pattern="[1-9][0-9]{0,9}" value={part.requestedAnnualQty} onChange={event=>partChange(index,'requestedAnnualQty',event.target.value)}/></label>
            {[['grossWeightKg','Gross weight (kg)'],['cycleTimeMin','Cycle time (minutes)'],['setupHoursPerBatch','Setup hours per batch']].map(([field,label])=><label key={field}>{label}<input required inputMode="decimal" pattern="(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?" value={part[field]} onChange={event=>partChange(index,field,event.target.value)}/></label>)}
            {categories.map(category=><label key={category}>{category[0].toUpperCase()+category.slice(1)} rate key<select aria-label={`${category[0].toUpperCase()+category.slice(1)} rate key`} required value={part.rateKeys[category]} onChange={event=>partChange(index,'rateKeys',{...part.rateKeys,[category]:event.target.value})}>
              <option value="">Select {category}</option>{keys?.filter(rate=>rate.category===category).map(rate=><option key={rate.id} value={rate.id}>{rate.code} ({rate.unit})</option>)}
            </select>{keys && !keys.some(rate=>rate.category===category) && <span className="error">No internal {category} keys available. Contact maintenance.</span>}
              {part.rateKeys[category] && keys?.find(k=>k.id===part.rateKeys[category] && k.category===category)?.currentVersion===null && <span className="field-warning">No effective {category} rate on {keysAsOf}. Inspect history and select a supported pricing date before costing.</span>}
            </label>)}
          </div>
          {suggestionsFor(part).length>0 && <div className="key-suggestions"><p>Suggested defaults (one available key per category on {keysAsOf}): {suggestionsFor(part).map(k=>`${k.category}: ${k.code}`).join('; ')}. No selection is made automatically.</p>
            <button type="button" className="secondary" onClick={()=>useSuggested(index)}>Use suggested keys for part {index+1}</button></div>}
          {form.parts.length>1 && <button type="button" className="secondary" onClick={()=>change('parts',form.parts.filter((_,i)=>i!==index))}>Remove part {index+1}</button>}
        </fieldset>)}
        <div className="actions"><button type="button" className="secondary" disabled={form.parts.length>=20} onClick={()=>change('parts',[...form.parts,newPart()])}>Add part</button></div>
        <p className="muted">Maximum 20 parts. Gross weight and cycle time must be positive; setup hours may be zero. Quantities: 1–1,000,000,000. Decimals: up to six places. Rate values are resolved later at the quotation pricing date; a missing historical rate will be an error.</p>
        <label className="review-confirm"><input type="checkbox" required checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>I reviewed the RFQ and all {form.parts.length} part(s), including quantities and internal rate keys.</label>
      </fieldset>
      <div className="actions"><button type="submit" disabled={saving || extracting || importing || !!storageError || !keys || (!frozen && !reviewed)}>{saving?'Saving RFQ...':frozen?'Retry same RFQ submission':'Save RFQ'}</button><button type="button" className="secondary" onClick={onCancel} disabled={saving || extracting || importing}>Back to register</button></div>
    </form>}
  </section>;
}
