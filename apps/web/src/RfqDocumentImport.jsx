import React,{useEffect,useRef,useState} from 'react';

const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const labels={partNumber:'Part number',description:'Description',grossWeightKg:'Gross weight (kg)',requestedAnnualQty:'Annual quantity',material:'Customer material',cycleTimeMin:'Cycle time (min)',setupHoursPerBatch:'Setup hours per batch'};
export default function RfqDocumentImport({session,onExpired,disabled,onBusyChange,onApply}) {
  const [file,setFile]=useState(null),[synthetic,setSynthetic]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const controller=useRef(null),panel=useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function parse() {
    setBusy(true);onBusyChange(true);setError('');setNotice('');setResult(null);
    const request=new AbortController();controller.current=request;
    try {
      if(!file||file.size>2*1024*1024||!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Choose a .xlsx file no larger than 2 MiB.');
      // A safe transport name validates the extension; the customer filename is never sent/logged.
      const response=await fetch('/api/rfq-import/xlsx',{method:'POST',credentials:'same-origin',signal:request.signal,
        headers:{'Content-Type':mime,'X-File-Name':'synthetic-rfq.xlsx','X-Synthetic-Only':String(synthetic),'X-CSRF-Token':session.csrfToken},body:file});
      const data=await response.json();
      if(response.status===401)onExpired();
      if(!response.ok)throw Error(data.error?.message||'Workbook import failed. Continue manually.');
      if(!request.signal.aborted)setResult(data);
    } catch(e){if(e.name!=='AbortError')setError(e.message||'Workbook import failed. No RFQ was saved. Continue manually.');}
    finally {setBusy(false);onBusyChange(false);controller.current=null;}
  }
  function cancel(){controller.current?.abort();panel.current.open=false;setNotice('Continue with the manual form. No RFQ was saved by import.');}
  return <details className="ai-intake" ref={panel}><summary>Import Excel part list (optional)</summary><div className="ai-content">
    <h3>Review an Excel part list</h3>
    <p>Only synthetic, nonconfidential .xlsx documents, up to 2 MiB and 20 parts. Excel import is deterministic and does not send data to Gemini. File contents and cell evidence are not persisted.</p>
    <details><summary>Excel template requirements</summary><p>Use one populated visible worksheet. Row 1 headers: <strong>Part number, Description, Gross weight (kg), Annual quantity</strong>. Optional: Material, Cycle time (min), Setup hours per batch. No formulas, merged/hidden data or formatted numbers. RFQ reference, customer and due date stay manual.</p></details>
    <p><a href="/synthetic-rfq.xlsx" download>Download synthetic Excel example</a></p>
    <fieldset disabled={disabled||busy}><legend className="sr-only">Excel source</legend>
      <label>Synthetic Excel RFQ<input type="file" accept=".xlsx" onChange={e=>{setFile(e.target.files?.[0]||null);setSynthetic(false);setResult(null);setError('');setNotice('');}}/></label>
      <label className="review-confirm"><input type="checkbox" checked={synthetic} onChange={e=>setSynthetic(e.target.checked)}/>I confirm this workbook is entirely synthetic, nonconfidential and contains no real personal data.</label>
    </fieldset>
    <div className="actions"><button type="button" disabled={disabled||busy||!file||!synthetic} onClick={parse}>Review Excel import</button><button type="button" className="secondary" disabled={disabled} onClick={cancel}>{busy?'Cancel and continue manually':'Continue manually'}</button></div>
    {busy&&<p role="status">Reading workbook and validating cells...</p>}
    {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
    {result&&<section aria-label="Excel import review"><h3>Worksheet: {result.worksheet}</h3><p>Verified means the stored cell passed template validation. Check every value against the document before confirming.</p>
      <section className="component-summary" aria-label="Imported component summary"><h3>Imported components ({result.parts.length})</h3><ul>{result.parts.map((part,index)=><li key={part.row}><strong>Part {index+1}: {part.fields.partNumber?.normalizedValue || 'Identifier missing'}</strong> - {part.fields.requestedAnnualQty?.normalizedValue || 'Quantity missing'} units/year - {Object.values(part.fields).filter(f=>f.status==='missing').length} fields missing</li>)}</ul></section>
      {result.parts.map((part,index)=><section key={part.row} aria-label={`Imported part ${index+1}`}><h4>Part {index+1} · worksheet row {part.row}</h4><details className="evidence-section"><summary>Cell evidence for imported part {index+1}</summary><div className="evidence-grid">
        {Object.entries(part.fields).map(([name,field])=><article className="evidence-field" key={name}><strong>{labels[name]}</strong><p>{field.status==='missing'?'Missing — complete manually':`${field.rawValue} → ${field.normalizedValue}`}</p>{field.cell&&<p className="muted">{result.worksheet}!{field.cell} · header {field.headerCell}: {field.header}</p>}</article>)}
      </div></details></section>)}
      <p className="notice">Use imported parts replaces current parts and clears internal rate selections. Header fields stay unchanged. Fill missing fields, choose internal rate keys and confirm review before saving.</p>
      <button type="button" disabled={disabled||busy} onClick={()=>{onApply(result);setNotice('Imported parts copied. Review and complete the manual form, select rate keys and confirm before saving.');}}>Use imported parts</button>
    </section>}
  </div></details>;
}
