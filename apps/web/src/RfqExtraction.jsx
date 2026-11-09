import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from './api.js';
import EvidenceSource from './EvidenceSource.jsx';
import {evidenceSlice} from './evidence-display.js';
import {useDraftMarker} from './WorkspaceDrafts.jsx';
import {manualPartFields,verifiedIntakeValue} from './intake-review.js';

const names={reference:'RFQ reference',customerName:'Customer name',dueDate:'Due date',partNumber:'Part number',description:'Description',material:'Customer material (select internal key manually)',grossWeightKg:'Gross weight (kg)',requestedAnnualQty:'Annual quantity',cycleTimeMin:'Cycle time (minutes)',setupHoursPerBatch:'Setup hours per batch'};
function EvidenceFields(props) {
  return <div className="extraction-fields">{Object.entries(props.fields).map(([name,field])=><EvidenceField key={name} {...props} name={name} field={field}/>)}</div>;
}
function EvidenceField({name,field,source,onSelect,disabled,onApplyField,targets,part}) {
  const [target,setTarget]=useState('');
  const applicable=verifiedIntakeValue(field,source)!==null&&(!part||manualPartFields.includes(name));
  const validTarget=!part||targets.some(item=>item.id===target);
  return <article className="extraction-field">
    <div className="section-heading"><h4>{names[name]}</h4><span className={`verification ${field.status}`}>{field.status}</span></div>
    <p>Suggested raw: <strong>{field.rawValue ?? 'Missing'}</strong><br/>Normalized: <strong>{field.normalizedValue ?? 'Not accepted'}</strong></p>
    {field.issues.map((issue,index)=><p className="muted" key={index}>{issue}</p>)}
    {field.evidence.map((item,index)=><blockquote key={index}><pre>{item.quote}</pre><p className="muted">{item.start===null ? 'No unique evidence location in this section' : `Source lines ${item.lineStart}–${item.lineEnd}; characters ${item.start}–${item.end} (end exclusive)`}</p>{evidenceSlice(source,item)?<button type="button" className="secondary" disabled={disabled} onClick={e=>onSelect({item,label:names[name],trigger:e.currentTarget})}>View source for {names[name]}, evidence {index+1}</button>:<p className="muted">Source highlight unavailable; review this quote manually.</p>}</blockquote>)}
    {applicable?<div className="field-apply">{part&&<label>Apply to manual part<select aria-label={`Apply ${names[name]} to manual part`} value={target} onChange={event=>setTarget(event.target.value)} disabled={disabled}><option value="">Choose a manual part</option>{targets.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}<button type="button" className="secondary" disabled={disabled||!validTarget} onClick={()=>onApplyField({name,field,source,targetId:part?target:null})}>Apply verified {names[name]}</button></div>:<p className="muted">{name==='material'?'Customer material is informational. Select internal rate keys manually.':'Resolve this value manually; only verified values with exact source evidence can be applied.'}</p>}
  </article>;
}

export default function RfqExtraction({session,onExpired,disabled,onApply,onApplyField,targets=[],onBusyChange,onManualContinue,protectDraft=true}) {
  const [availability,setAvailability]=useState(null),[source,setSource]=useState(''),[consent,setConsent]=useState(false),[synthetic,setSynthetic]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
  const [reviewSource,setReviewSource]=useState(''),[selectedEvidence,setSelectedEvidence]=useState(null);
  const controller=useRef(null);
  const panel=useRef(null);
  const sourceId=useId();
  const markDirty=useDraftMarker('intake:source');
  useEffect(()=>{markDirty(protectDraft && !!source);return()=>markDirty(false);},[source,protectDraft,markDirty]);
  useEffect(()=>{
    const request=new AbortController();
    api('/rfq-extraction',{signal:request.signal}).then(data=>{if(!request.signal.aborted){setAvailability(data);setError('');}}).catch(error=>{
      if(!request.signal.aborted&&error.name!=='AbortError') {setError(error.message);if(error.status===401) onExpired();}
    });
    return ()=>request.abort();
  },[reload]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function editSource(value) {setSource(value);setConsent(false);setSynthetic(false);setResult(null);setReviewSource('');setSelectedEvidence(null);setNotice('');setError('');}
  async function extract() {
    setBusy(true);onBusyChange(true);setError('');setResult(null);setSelectedEvidence(null);setReviewSource('');setNotice('');
    const submittedSource=source;
    const request=new AbortController();controller.current=request;
    try {
      const data=await api('/rfq-extraction',{method:'POST',body:{sourceText:submittedSource,consent,syntheticOnly:synthetic},csrfToken:session.csrfToken,signal:request.signal});
      if(controller.current===request&&!request.signal.aborted) {setReviewSource(submittedSource);setResult(data);}
    } catch(error) {
      if(controller.current===request&&!request.signal.aborted&&error.name!=='AbortError') {setError(error.code==='NETWORK_FAILURE' ? 'Extraction connection was interrupted. No RFQ was saved. Continue manually or explicitly extract again.' : error.message);if(error.status===401) onExpired();}
    } finally {if(controller.current===request){setBusy(false);onBusyChange(false);controller.current=null;}}
  }
  function continueManually() {controller.current?.abort();controller.current=null;setBusy(false);onBusyChange(false);panel.current.open=false;onManualContinue('Continue with the editable manual fields below. Extraction does not save an RFQ.');}
  function apply() {
    onApply(result,reviewSource);
  }
  const hasVerified=result && [...Object.values(result.rfq),...result.parts.flatMap(part=>Object.entries(part.fields).filter(([name])=>manualPartFields.includes(name)).map(([,field])=>field))].some(field=>verifiedIntakeValue(field,reviewSource)!==null);
  return <details ref={panel} className="ai-intake"><summary>Extract from text with AI (optional)</summary><div className="ai-content">
    <h3>Gemini RFQ extraction</h3>
    <p className="notice">Google Gemini unpaid API: synthetic, nonconfidential demonstration documents only. Do not paste personal, customer-confidential or NDA-covered information. Google may use inputs/outputs to improve products, and human reviewers may process them. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Provider terms</a>. AI suggestions require your review; AI never calculates prices.</p>
    {!availability && !error && <p role="status">Checking AI configuration...</p>}
    {availability && <p className="muted">Provider: {availability.provider} · Model: {availability.model}</p>}
    {availability && !availability.available && <p role="status" className="notice">AI extraction is not configured or its configuration is invalid. Manual RFQ creation below remains available.</p>}
    {error && <div role="alert" className="error">{error}{!availability && <button type="button" onClick={()=>{setError('');setReload(value=>value+1);}}>Check AI configuration again</button>}</div>}
    <fieldset disabled={disabled || busy}>
      <legend className="sr-only">AI source and consent</legend>
      <label htmlFor={sourceId}>Synthetic RFQ email or plain text</label><textarea id={sourceId} maxLength={12000} rows={9} value={source} onChange={event=>editSource(event.target.value)} placeholder="Paste a synthetic RFQ. Explicit labels and Part: headers help the server verify evidence."/>
      <p className="muted">{source.length}/12000 characters. Source text and evidence are not persisted.</p><details><summary>Source structure and storage</summary><p className="muted">Reviewed fields use RFQ save and recovery storage. Automatic mapping requires labeled fields within Part 1:, Part 2:, Part:, Part number: or Item: sections. Unmatched proposals remain warnings and never create extra parts.</p></details>
      <label className="review-confirm"><input type="checkbox" checked={synthetic} onChange={event=>setSynthetic(event.target.checked)}/>I confirm this text is entirely synthetic, nonconfidential and contains no real personal data.</label>
      <label className="review-confirm"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>I consent to sending this text to Google Gemini under the disclosed unpaid-service terms.</label>
    </fieldset>
    <div className="actions"><button type="button" onClick={extract} disabled={disabled || busy || !availability?.available || !source.trim() || !consent || !synthetic}>Extract with AI</button><button type="button" className="secondary" disabled={disabled} onClick={continueManually}>{busy?'Cancel and continue manually':'Continue manually'}</button></div>
    {busy && <p role="status">Extracting with Gemini and verifying source evidence…</p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {result && <section aria-label="Extraction review">
      <h3>Review suggestions and source evidence</h3><p className="muted">Verified means the server validated the value and its exact evidence, not that you have approved it. Compare each value with the source. Apply individual values to an explicitly chosen manual part, or replace the form below. Ambiguous, unsupported and missing values require manual correction. Applying values never saves an RFQ.</p>
      {result.warnings.map((warning,index)=><p className="notice" key={index}>{warning}</p>)}
      <section className="component-summary" aria-label="Extracted component summary"><h3>Extracted components ({result.parts.length})</h3>
        <ul>{result.parts.map((part,index)=><li key={index}><strong>Part {index+1}: {part.fields.partNumber?.status==='verified'?part.fields.partNumber.normalizedValue:'Identifier needs review'}</strong> - {part.fields.requestedAnnualQty?.status==='verified'?`${part.fields.requestedAnnualQty.normalizedValue} units/year`:'Quantity needs review'} - {Object.values(part.fields).filter(f=>f.status!=='verified').length} fields need review</li>)}</ul>
      </section>
      <div className="evidence-layout"><EvidenceSource source={reviewSource} selected={selectedEvidence}/><div className="evidence-review-fields">
      <details className="evidence-section"><summary>RFQ field evidence</summary><EvidenceFields fields={result.rfq} source={reviewSource} onSelect={setSelectedEvidence} onApplyField={onApplyField} targets={targets} disabled={disabled || busy}/></details>
      {result.parts.map((part,index)=><section key={index} aria-label={`Suggested part ${index+1}`}><h3>Suggested part {index+1}: {part.anchor}</h3><p className="muted">{part.sourcePartIndex===null?'Part association unsupported':`Source part ${part.sourcePartIndex+1}`}</p><details className="evidence-section"><summary>Evidence for suggested part {index+1}</summary><EvidenceFields part fields={part.fields} source={reviewSource} onSelect={setSelectedEvidence} onApplyField={onApplyField} targets={targets} disabled={disabled || busy}/></details></section>)}
      </div></div>
      <p className="notice">Use verified suggestions replaces the current form's RFQ fields and parts. Internal rate keys remain unselected. Resolve all other fields manually and confirm review before saving.</p>
      <button type="button" onClick={apply} disabled={disabled || busy || !hasVerified}>Use verified suggestions</button>
    </section>}
  </div></details>;
}
