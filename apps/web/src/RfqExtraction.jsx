import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const names={reference:'RFQ reference',customerName:'Customer name',dueDate:'Due date',partNumber:'Part number',description:'Description',material:'Customer material (select internal key manually)',grossWeightKg:'Gross weight (kg)',requestedAnnualQty:'Annual quantity',cycleTimeMin:'Cycle time (minutes)',setupHoursPerBatch:'Setup hours per batch'};
function EvidenceFields({fields}) {
  return <div className="extraction-fields">{Object.entries(fields).map(([name,field])=><article className="extraction-field" key={name}>
    <div className="section-heading"><h4>{names[name]}</h4><span className={`verification ${field.status}`}>{field.status}</span></div>
    <p>Suggested raw: <strong>{field.rawValue ?? 'Missing'}</strong><br/>Normalized: <strong>{field.normalizedValue ?? 'Not accepted'}</strong></p>
    {field.issues.map((issue,index)=><p className="muted" key={index}>{issue}</p>)}
    {field.evidence.map((item,index)=><blockquote key={index}><pre>{item.quote}</pre><p className="muted">{item.start===null ? 'No unique evidence location in this section' : `Source lines ${item.lineStart}–${item.lineEnd}; characters ${item.start}–${item.end} (end exclusive)`}</p></blockquote>)}
  </article>)}</div>;
}

export default function RfqExtraction({session,onExpired,disabled,onApply,onBusyChange}) {
  const [availability,setAvailability]=useState(null),[source,setSource]=useState(''),[consent,setConsent]=useState(false),[synthetic,setSynthetic]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
  const controller=useRef(null);
  const panel=useRef(null);
  useEffect(()=>{
    const request=new AbortController();
    api('/rfq-extraction',{signal:request.signal}).then(setAvailability).catch(error=>{
      if(error.name!=='AbortError') {setError(error.message);if(error.status===401) onExpired();}
    });
    return ()=>request.abort();
  },[reload]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function editSource(value) {setSource(value);setConsent(false);setSynthetic(false);setResult(null);setNotice('');setError('');}
  async function extract() {
    setBusy(true);onBusyChange(true);setError('');setResult(null);setNotice('');
    const request=new AbortController();controller.current=request;
    try {
      const data=await api('/rfq-extraction',{method:'POST',body:{sourceText:source,consent,syntheticOnly:synthetic},csrfToken:session.csrfToken,signal:request.signal});
      if(!request.signal.aborted) setResult(data);
    } catch(error) {
      if(error.name!=='AbortError') {setError(error.code==='NETWORK_FAILURE' ? 'Extraction connection was interrupted. No RFQ was saved. Continue manually or explicitly extract again.' : error.message);if(error.status===401) onExpired();}
    } finally {setBusy(false);onBusyChange(false);controller.current=null;}
  }
  function continueManually() {controller.current?.abort();panel.current.open=false;setNotice('Continue with the editable manual fields below. Extraction does not save an RFQ.');}
  function apply() {
    onApply(result);setNotice('Verified suggestions copied to the manual form. Correct or fill every field, select internal rate keys and confirm review before saving.');
  }
  const hasVerified=result && [...Object.values(result.rfq),...result.parts.flatMap(part=>Object.values(part.fields))].some(field=>field.status==='verified');
  return <details ref={panel} className="ai-intake"><summary>Extract from text with AI (optional)</summary><div className="ai-content">
    <h3>Gemini RFQ extraction</h3>
    <p className="notice">Google Gemini unpaid API: synthetic, nonconfidential demonstration documents only. Do not paste personal, customer-confidential or NDA-covered information. Google may use inputs/outputs to improve products, and human reviewers may process them. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Provider terms</a>. AI suggestions require your review; AI never calculates prices.</p>
    {!availability && !error && <p role="status">Checking AI configuration...</p>}
    {availability && <p className="muted">Provider: {availability.provider} · Model: {availability.model}</p>}
    {availability && !availability.available && <p role="status" className="notice">AI extraction is not configured or its configuration is invalid. Manual RFQ creation below remains available.</p>}
    {error && <div role="alert" className="error">{error}{!availability && <button type="button" onClick={()=>{setError('');setReload(value=>value+1);}}>Check AI configuration again</button>}</div>}
    <fieldset disabled={disabled || busy}>
      <legend className="sr-only">AI source and consent</legend>
      <label>Synthetic RFQ email or plain text<textarea maxLength={12000} rows={9} value={source} onChange={event=>editSource(event.target.value)} placeholder="Paste a synthetic RFQ. Explicit labels and Part: headers help the server verify evidence."/></label>
      <p className="muted">{source.length}/12000 characters. The full pasted source and extraction evidence are not persisted. Reviewed business fields use the existing RFQ save and recovery storage. Verified automatic mapping requires labeled fields within explicit numbered headings (Part 1:, Part 2:) or Part: / Part number: / Item: sections. Unmatched model proposals appear as warnings and never create extra parts.</p>
      <label className="review-confirm"><input type="checkbox" checked={synthetic} onChange={event=>setSynthetic(event.target.checked)}/>I confirm this text is entirely synthetic, nonconfidential and contains no real personal data.</label>
      <label className="review-confirm"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>I consent to sending this text to Google Gemini under the disclosed unpaid-service terms.</label>
    </fieldset>
    <div className="actions"><button type="button" onClick={extract} disabled={disabled || busy || !availability?.available || !source.trim() || !consent || !synthetic}>Extract with AI</button><button type="button" className="secondary" disabled={disabled} onClick={continueManually}>{busy?'Cancel and continue manually':'Continue manually'}</button></div>
    {busy && <p role="status">Extracting with Gemini and verifying source evidence…</p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {result && <section aria-label="Extraction review">
      <h3>Review suggestions and source evidence</h3><p className="muted">Compare every suggestion with its source quote. Only verified normalized fields are copied; ambiguous, unsupported and missing fields remain empty.</p>
      {result.warnings.map((warning,index)=><p className="notice" key={index}>{warning}</p>)}
      <h3>RFQ fields</h3><EvidenceFields fields={result.rfq}/>
      {result.parts.map((part,index)=><section key={index} aria-label={`Suggested part ${index+1}`}><h3>Suggested part {index+1}: {part.anchor}</h3><p className="muted">{part.sourcePartIndex===null?'Part association unsupported':`Source part ${part.sourcePartIndex+1}`}</p><EvidenceFields fields={part.fields}/></section>)}
      <p className="notice">Use verified suggestions replaces the current form's RFQ fields and parts. Internal rate keys remain unselected. Resolve all other fields manually and confirm review before saving.</p>
      <button type="button" onClick={apply} disabled={disabled || busy || !hasVerified}>Use verified suggestions</button>
    </section>}
  </div></details>;
}
