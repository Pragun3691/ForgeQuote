import RateKeyMatrix from './RateKeyMatrix.jsx';
import IntakePartEditor from './IntakePartEditor.jsx';
import IntakeReviewDialog from './IntakeReviewDialog.jsx';
import {intakeErrors,intakeErrorLabel} from './intake-validation.js';
import {manualHeaderFields,manualPartFields,verifiedIntakeValue} from './intake-review.js';
import Identifier from './Identifier.jsx';
import React, { useEffect, useRef, useState } from 'react';
import {useDraftMarker} from './WorkspaceDrafts.jsx';
import { api } from './api.js';
import RfqExtraction from './RfqExtraction.jsx';
import RfqDocumentImport from './RfqDocumentImport.jsx';

const categories = ['material','machine','scrap','overhead','packaging','freight'];
const newPart = () => ({partNumber:'',description:'',grossWeightKg:'',requestedAnnualQty:'',cycleTimeMin:'',setupHoursPerBatch:'',rateKeys:Object.fromEntries(categories.map(category=>[category,'']))});
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
  const [manualNotice,setManualNotice]=useState(null);
  const partIds=useRef([crypto.randomUUID()]),summary=useRef(null);
  const [touched,setTouched]=useState({}),[attempted,setAttempted]=useState(false),[removed,setRemoved]=useState(null),[replacement,setReplacement]=useState(null);
  const validation=intakeErrors(form,keys);
  function fieldProps(path){const error=(attempted||touched[path])&&validation[path];return {id:`intake-${path}`,onBlur:()=>setTouched(current=>({...current,[path]:true})),'aria-invalid':error?true:undefined,'aria-describedby':error?`intake-error-${path}`:undefined,error};}
  function replaceInputs(message,apply){if(form.reference||form.customerName||form.dueDate||form.parts.some(part=>Object.values(part).some(value=>typeof value==='string'?!!value:Object.values(value).some(Boolean))))setReplacement({message,apply,trigger:document.activeElement});else apply();}
  function resetPartIdentity(parts){partIds.current=parts.map(()=>crypto.randomUUID());setTouched({});setAttempted(false);setRemoved(null);}
  function removePart(index){const id=partIds.current[index];setRemoved({part:form.parts[index],id,index});partIds.current.splice(index,1);setTouched({});change('parts',form.parts.filter((_,i)=>i!==index));requestAnimationFrame(()=>goToPart(Math.min(index,form.parts.length-2)));}
  function undoRemoval(){if(!removed||form.parts.length>=20)return;const parts=[...form.parts],index=Math.min(removed.index,parts.length);parts.splice(index,0,removed.part);partIds.current.splice(index,0,removed.id);setRemoved(null);setTouched({});change('parts',parts);requestAnimationFrame(()=>goToPart(index));}
  const manualStart=useRef(null),markDirty=useDraftMarker('intake');
  function continueManually(message) {setManualNotice({message,focus:true});}
  useEffect(()=>{if(manualNotice?.focus && !extracting && !importing)manualStart.current?.focus();},[manualNotice,extracting,importing]);
  const frozen = saving || !!(pending && pending.phase !== 'rejected');
  useEffect(()=>{
    try { const record=readPending(key); if(record) {setPending(record);resetPartIdentity(record.body.parts);setForm(record.body);setReviewed(true);} }
    catch(error) {setStorageError(error.message);}
  },[key]);
  useEffect(()=>{
    const controller=new AbortController();
    api('/rates',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setKeys(data.rateKeys);setKeysAsOf(data.asOf);setError('');}}).catch(error=>{
      if(error.name !== 'AbortError') {setError(error.message);if(error.status===401) onExpired();}
    });
    return ()=>controller.abort();
  },[reload]);
  function persist(record) { sessionStorage.setItem(key,JSON.stringify(record));setPending(record); }
  function change(field,value) {markDirty(true);setForm(current=>({...current,[field]:value}));setReviewed(false);setKeyNotice('');}
  function partChange(index,field,value) {change('parts',form.parts.map((part,i)=>i===index?{...part,[field]:value}:part));}
  function missingFields(part) {
    const prefix=`parts.${form.parts.indexOf(part)}.`;
    return Object.keys(validation).filter(path=>path.startsWith(prefix)).map(path=>intakeErrorLabel(path).replace(/^Part \d+: /,''));
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
    replaceInputs('Copying common keys replaces all six rate selections on every part.',()=>{change('parts',form.parts.map(part=>({...part,rateKeys:{...form.parts[0].rateKeys}})));setKeyNotice('Common rate keys copied from part 1 to all parts. Previous selections were replaced. Verify each part before confirming.');});
  }
  function goToPart(index) {
    const element=document.getElementById(`rfq-intake-part-${index}`);
    element?.focus();element?.scrollIntoView({block:'start',behavior:'auto'});
  }
  function appliedNotice(message){setManualNotice({message:`${message} Working inputs only; no RFQ has been saved. Complete any errors, select rate keys and confirm your review.`});}
  function applyField({name,field,source,targetId}){
    if(frozen||extracting||importing||storageError)return;
    const value=verifiedIntakeValue(field,source),index=partIds.current.indexOf(targetId);
    if(value===null||!(targetId?manualPartFields:manualHeaderFields).includes(name)||(targetId&&index<0))return;
    const current=targetId?form.parts[index][name]:form[name];
    const apply=()=>{if(targetId)partChange(index,name,value);else change(name,value);appliedNotice(`${intakeErrorLabel(name)} applied${targetId?` to part ${index+1}`:''}.`);};
    if(current&&current!==value)setReplacement({message:`Replace ${intakeErrorLabel(name)}${targetId?` on part ${index+1}`:''}: “${current}” with “${value}”? All other inputs and rate keys stay unchanged.`,apply,trigger:document.activeElement});else apply();
  }
  function applyExtraction(result,source) {
    const verified=field=>verifiedIntakeValue(field,source)??'';
    const next={reference:verified(result.rfq.reference),customerName:verified(result.rfq.customerName),dueDate:verified(result.rfq.dueDate),
      parts:result.parts.length ? result.parts.map(part=>({...newPart(),...Object.fromEntries(['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch'].map(name=>[name,verified(part.fields[name])]))})) : [newPart()]};
    replaceInputs('This replaces RFQ details and all parts, and clears internal rate keys.',()=>{resetPartIdentity(next.parts);setForm(next);markDirty(true);setReviewed(false);setError('');setAttempted(true);appliedNotice('Verified suggestions copied.');requestAnimationFrame(()=>summary.current?.focus());});
  }
  async function save(event) {
    event.preventDefault();setError('');
    if(!frozen&&Object.keys(validation).length){setAttempted(true);requestAnimationFrame(()=>summary.current?.focus());return;}
    const record=pending && pending.phase !== 'rejected' ? pending : {submissionKey:pending?.submissionKey || crypto.randomUUID(),body:structuredClone(form)};
    try {persist({...record,phase:'saving'});markDirty(false);} catch {setStorageError('Browser storage is unavailable. Enable session storage and reload before saving.');return;}
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
    replaceInputs('This replaces all current parts and clears their internal rate keys. RFQ header fields stay unchanged.',()=>{
      const parts=result.parts.map(part=>({...newPart(),...Object.fromEntries(['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch'].map(name=>[name,part.fields[name]?.normalizedValue||'']))}));
      resetPartIdentity(parts);markDirty(true);setForm(current=>({...current,parts}));setReviewed(false);setError('');setAttempted(true);appliedNotice('Imported parts copied. RFQ header fields preserved.');requestAnimationFrame(()=>summary.current?.focus());
    });
  }
  function startAnother() {
    try {sessionStorage.removeItem(key);setPending(null);resetPartIdentity([newPart()]);setForm(emptyForm());setReviewed(false);setError('');setManualNotice('');markDirty(false);setAiCycle(value=>value+1);} catch {setStorageError('Browser storage is unavailable. Reload to recover the saved RFQ.');}
  }
  return <section className="panel costing-form rfq-intake" aria-labelledby="create-rfq-title">
    <h2 id="create-rfq-title">Create manual RFQ</h2>
    <p className="muted">Synthetic, nonconfidential data only. Prepared by {session.user.username}. Review every part before saving.</p>
    {pending?.phase!=='saved' && <><RfqDocumentImport key={`excel-${aiCycle}`} session={session} onExpired={onExpired} disabled={!!frozen || !!storageError || extracting} onApply={applyImport} onBusyChange={setImporting} onManualContinue={continueManually} protectDraft={!frozen}/><RfqExtraction key={aiCycle} session={session} onExpired={onExpired} disabled={!!frozen || !!storageError || importing} onApply={applyExtraction} onApplyField={applyField} targets={form.parts.map((part,index)=>({id:partIds.current[index],label:`Part ${index+1}: ${part.partNumber||'Unnamed'}`}))} onBusyChange={setExtracting} onManualContinue={continueManually} protectDraft={!frozen}/></>}
    {manualNotice && <p role="status" className="notice">{manualNotice.message}</p>}
    {error && <div role="alert" className="error">{error}{!keys && <button type="button" onClick={()=>{setError('');setReload(value=>value+1);}}>Reload rate keys</button>}</div>}
    {storageError && <div role="alert" className="error">{storageError}</div>}
    {!keys && !error && <p role="status">Loading internal rate keys...</p>}
    {pending && <p className="submission-note">RFQ submission key: <Identifier value={pending.submissionKey}/></p>}
    {pending && ['saving','uncertain'].includes(pending.phase) && <div role="status" className="notice">The previous save outcome may be unknown. Inputs are locked. Retry the same submission to recover it without creating a duplicate.</div>}
    {pending?.phase==='saved' ? <><div role="status" className="success">RFQ saved. <a href={`#rfq=${pending.rfqId}`}>Open saved RFQ</a></div><div className="actions"><button onClick={startAnother} disabled={!!storageError}>Create another RFQ</button><button className="secondary" onClick={onCancel}>Back to register</button></div></> :
    <form onSubmit={save} noValidate>
      {attempted&&Object.keys(validation).length>0&&!frozen&&<section ref={summary} tabIndex={-1} className="validation-summary" aria-label="RFQ validation errors"><h3>Check these inputs before saving</h3><ul>{Object.entries(validation).map(([path,message])=><li key={path}><button type="button" className="text-action" onClick={()=>document.getElementById(`intake-${path}`)?.focus()}>{intakeErrorLabel(path)}: {message}</button></li>)}</ul></section>}
      <fieldset disabled={frozen || extracting || importing || !!storageError || !keys}>
        <legend className="sr-only">RFQ details</legend>
        <div className="input-grid">
          {['reference','customerName','dueDate'].map(field=>{const {error,...props}=fieldProps(field);return <label key={field}>{intakeErrorLabel(field)}<input aria-label={intakeErrorLabel(field)} ref={field==='reference'?manualStart:undefined} required {...props} type={field==='dueDate'?'date':'text'} value={form[field]} onChange={event=>change(field,event.target.value)}/>{error&&<span id={props['aria-describedby']} className="field-error">{error}</span>}</label>;})}
        </div>
        <section className="component-summary" aria-label="Component summary">
          <h3>Components ({form.parts.length})</h3><p className="muted">Complete the required fields and rate keys, then confirm your review.</p>
          <nav aria-label="Component navigation">{form.parts.map((part,index)=><button type="button" className="secondary component-jump" key={partIds.current[index]} onClick={()=>goToPart(index)}>
            <strong>Go to part {index+1}: {part.partNumber || 'Unnamed'}</strong><span>{part.requestedAnnualQty || 'Missing'} units/year - {missingFields(part).length} need attention</span>
          </button>)}</nav>
          <p className="muted">Available internal keys checked as of {keysAsOf}. Actual rates are resolved at the quotation pricing date. <a href="#view=rates" target="_blank" rel="noreferrer">Inspect rate history (new tab)</a></p>
          <button type="button" className="secondary" disabled={form.parts.length<2 || !commonReady} onClick={applyCommon}>Apply common rate keys to all parts</button>
          <p className="muted">This copies all six selected keys from part 1 and replaces every part's current key selections.</p>
          {form.parts.length>1&&<button type="button" className="secondary" onClick={()=>{const heading=document.getElementById('rate-assignment-title');heading?.focus();heading?.scrollIntoView({block:'start'});}}>Go to rate-key assignment</button>}
          {keyNotice && <p role="status" className="notice">{keyNotice}</p>}
        </section>
        {form.parts.map((part,index)=><fieldset className="intake-part" key={partIds.current[index]} id={`rfq-intake-part-${index}`} tabIndex={-1}>

          <legend>Part {index+1}</legend>
          <p className="muted" aria-live="polite">{missingFields(part).length?`Check: ${missingFields(part).join(', ')}`:'All required fields selected. Verify values and rate keys before saving.'}</p>
          <IntakePartEditor part={part} index={index} onChange={partChange} fieldProps={fieldProps}/>
          <div className="input-grid">
            {form.parts.length===1 && categories.map(category=><label key={category}>{category[0].toUpperCase()+category.slice(1)} rate key<select {...(()=>{const {error,...props}=fieldProps(`parts.${index}.rateKeys.${category}`);return props;})()} aria-label={`${category[0].toUpperCase()+category.slice(1)} rate key`} required value={part.rateKeys[category]} onChange={event=>partChange(index,'rateKeys',{...part.rateKeys,[category]:event.target.value})}>
              <option value="">Select {category}</option>{keys?.filter(rate=>rate.category===category).map(rate=><option key={rate.id} value={rate.id}>{rate.code} ({rate.unit})</option>)}
            </select>{(attempted||touched[`parts.${index}.rateKeys.${category}`])&&validation[`parts.${index}.rateKeys.${category}`]&&<span id={`intake-error-parts.${index}.rateKeys.${category}`} className="field-error">{validation[`parts.${index}.rateKeys.${category}`]}</span>}{keys && !keys.some(rate=>rate.category===category) && <span className="error">No internal {category} keys available. Contact maintenance.</span>}
              {part.rateKeys[category] && keys?.find(k=>k.id===part.rateKeys[category] && k.category===category)?.currentVersion===null && <span className="field-warning">No effective {category} rate on {keysAsOf}. Inspect history and select a supported pricing date before costing.</span>}
            </label>)}
          </div>
          {suggestionsFor(part).length>0 && <div className="key-suggestions"><p>Suggested defaults (one available key per category on {keysAsOf}): {suggestionsFor(part).map(k=>`${k.category}: ${k.code}`).join('; ')}. No selection is made automatically.</p>
            <button type="button" className="secondary" onClick={()=>useSuggested(index)}>Use suggested keys for part {index+1}</button></div>}
          {form.parts.length>1 && <button type="button" className="secondary" onClick={()=>removePart(index)}>Remove part {index+1}</button>}
        </fieldset>)}
        {form.parts.length>1 && keys && <RateKeyMatrix parts={form.parts} rateKeys={keys} asOf={keysAsOf} onChange={partChange} partIds={partIds.current} fieldProps={fieldProps}/>}
        <div className="actions"><button type="button" className="secondary" disabled={form.parts.length>=20} onClick={()=>{partIds.current.push(crypto.randomUUID());change('parts',[...form.parts,newPart()]);requestAnimationFrame(()=>goToPart(form.parts.length));}}>Add part</button></div>
        {removed&&<p role="status" className="notice">Removed {removed.part.partNumber||'unnamed part'}. <button type="button" className="secondary" disabled={form.parts.length>=20} onClick={undoRemoval}>Undo removal</button></p>}
        <details><summary>Input limits and rate resolution</summary><p className="muted">Maximum 20 parts. Gross weight and cycle time must be positive; setup hours may be zero. Quantities: 1–1,000,000,000. Decimals: up to six places. Rate values are resolved later at the quotation pricing date; a missing historical rate will be an error.</p></details>
        <label className="review-confirm"><input type="checkbox" required checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>I reviewed the RFQ and all {form.parts.length} part(s), including quantities and internal rate keys.</label>
      </fieldset>
      <div className="actions"><button type="submit" disabled={saving || extracting || importing || !!storageError || !keys || (!frozen && !reviewed)}>{saving?'Saving RFQ...':frozen?'Retry same RFQ submission':'Save RFQ'}</button><button type="button" className="secondary" onClick={onCancel} disabled={saving || extracting || importing}>Back to register</button></div>
    </form>}
    <IntakeReviewDialog review={replacement} onCancel={()=>setReplacement(null)} onConfirm={()=>{const apply=replacement.apply;setReplacement(null);apply();}}/>
  </section>;
}
