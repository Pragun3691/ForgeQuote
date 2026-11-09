import React from 'react';
import Identifier from './Identifier.jsx';

// A controlled view of the existing owner. Never rebuild a recorded request here.
export default function CostingInputs({form,rfq,pending,frozen,saving,storageError,onSubmit,onChangePart,onPricingDateChange,onStartNew}) {
  const inputs=Object.hasOwn(form,'parts')?form.parts:[form];
  const uncertain=pending&&['saving','uncertain'].includes(pending.phase);
  const submitted=pending?.versionId&&rfq.versions.find(v=>v.id.toLowerCase()===pending.versionId.toLowerCase());
  function jump(partId){const el=document.getElementById(`costing-part-${partId}`);el?.focus({preventScroll:true});el?.scrollIntoView({block:'start'});}
  return <form className="panel costing-form" onSubmit={onSubmit}>
    <div className="section-heading"><div><p className="eyebrow">{uncertain?'Recorded submission · outcome unconfirmed':pending?.phase==='saved'?'Server-confirmed submitted inputs':'Working estimate · editable inputs'}</p><h2 id="working-heading" tabIndex={-1}>Costing inputs</h2><p className="muted">Choose annual production quantities. The 100% scenario is the headline price.</p></div></div>
    <p className={uncertain?'notice':'working-explanation'}>{uncertain?'The outcome has not been recovered in this tab. These inputs are locked for the same-request retry.':pending?.phase==='saved'?'The server confirmed this submission. Its locked inputs remain separate from the saved version currently selected for review.':'These working inputs are held in this tab. A new saved quotation exists only after the server confirms Calculate & save draft.'}</p>
    {pending?.phase==='saved'&&pending.versionId&&<p className="muted">Confirmed submission: <a href={`#${new URLSearchParams({rfq:rfq.id,version:pending.versionId})}`}>{submitted?`Version ${submitted.versionNumber}`:'Review submitted version'}</a></p>}
    {inputs.length>1&&<nav className="part-jumps" aria-label="Costing part navigation">{inputs.map(input=>{const part=rfq.parts.find(p=>p.id.toLowerCase()===input.partId.toLowerCase());return <button key={input.partId} type="button" className="secondary" onClick={()=>jump(input.partId)} aria-label={`Go to costing ${part?.partNumber||input.partId}`}>{part?.partNumber||input.partId}</button>;})}</nav>}
    <fieldset disabled={!!frozen||!!storageError}><label>Pricing date<input required type="date" value={form.pricingDate} onChange={e=>onPricingDateChange(e.target.value)}/></label>
      {inputs.map(input=>{
        const part=rfq.parts.find(p=>p.id.toLowerCase()===input.partId.toLowerCase());
        return <fieldset className="intake-part" data-part-input id={`costing-part-${input.partId}`} tabIndex={-1} key={input.partId} aria-label={`Costing ${part?.partNumber||input.partId}`}><legend>{part?.partNumber||input.partId}</legend>
          <div className="input-grid costing-part-inputs"><label>Gross margin (%)<input required inputMode="decimal" pattern="(?:0|[1-9][0-9]?)(?:\.[0-9]{1,6})?" title="Enter 0 to below 100, with up to six decimal places." value={input.marginPercent} onChange={e=>onChangePart(input.partId,{marginPercent:e.target.value})}/></label><label>Routing revision<select required value={input.routingRevisionId} onChange={e=>onChangePart(input.partId,{routingRevisionId:e.target.value})}>{!part?.routes.some(route=>route.id===input.routingRevisionId)&&<option value={input.routingRevisionId}>{input.routingRevisionId||'No routing available'}</option>}{part?.routes.map(route=><option key={route.id} value={route.id}>Rev {route.revisionNumber} · {route.machineCode} · {route.cycleTimeMin} min · {route.setupHoursPerBatch} setup hours/batch</option>)}</select></label></div>
          <div className="input-grid quantities">{['50','100','150'].map(scenario=><label key={scenario}>{scenario}% annual quantity<input required inputMode="numeric" pattern="[1-9][0-9]{0,9}" title="Enter a whole number from 1 to 1000000000." value={input.tierQuantities[scenario]} onChange={e=>onChangePart(input.partId,{tierQuantities:{...input.tierQuantities,[scenario]:e.target.value}})}/></label>)}</div>
        </fieldset>;
      })}
    </fieldset>
    <div className="actions"><button type="submit" className={pending?.phase==='saved'?'secondary':undefined} disabled={saving||!!storageError}>{saving?'Saving draft...':pending?.phase==='saved'?'Retrieve same submission':frozen?'Retry same submission':'Calculate & save draft'}</button>{pending&&<button type="button" className="secondary" disabled={saving||!!storageError} onClick={onStartNew}>Start new calculation</button>}</div>
    {pending&&<p className="muted submission-note">Submission key: <Identifier value={pending.submissionKey}/>{uncertain&&' · Outcome may be uncertain. Retry this submission before starting a new calculation.'}</p>}
  </form>;
}
