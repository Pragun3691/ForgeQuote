import React from 'react';
import ScrollTable from './ScrollTable.jsx';
import Identifier from './Identifier.jsx';
import {grouped,dateLabel} from './format.js';

export default function SavedCostingInputs({snapshot,loading}) {
  const parts=snapshot?[...snapshot.parts].sort((a,b)=>a.part.part_number.localeCompare(b.part.part_number,'en',{numeric:true})):[];
  function jumpSaved(id) {
    const summary=document.getElementById(`saved-summary-${id}`);
    const target=summary?.getClientRects().length?summary:document.getElementById(`saved-input-${id}`);
    target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});
  }
  return <section className="panel saved-inputs" aria-label="Saved costing inputs"><p className="eyebrow">Selected saved version · Read-only</p><h2 id="saved-inputs-heading" tabIndex={-1}>Saved costing inputs</h2>
    <p className="muted">Sales head cannot create quotations. {snapshot?'These read-only inputs belong to the selected immutable version.':loading?'Loading the selected saved version.':'Select a saved version to review its inputs.'}</p>
    {snapshot && <><nav className="part-jumps" aria-label="Saved input part navigation">{parts.length>1&&parts.map(part=><button type="button" className="secondary" key={part.quotationPartId} onClick={()=>jumpSaved(part.quotationPartId)}>Go to saved {part.part.part_number}</button>)}</nav><p className="saved-input-context">Version {snapshot.versionNumber} · Pricing date {dateLabel(snapshot.pricingDate)}</p>
      {parts.map(part=><section className="saved-input-mobile" id={`saved-summary-${part.quotationPartId}`} tabIndex={-1} key={part.quotationPartId} aria-label={`Saved inputs for ${part.part.part_number}`}><h3>{part.part.part_number}</h3><p className="muted">Saved routing revision {part.routing.revision_number}</p><dl><div><dt>Margin (%)</dt><dd>{grouped(part.input.marginPercent)}</dd></div><div><dt>Cycle time (min)</dt><dd>{grouped(part.input.cycleTimeMin)}</dd></div><div><dt>Setup (hours / batch)</dt><dd>{grouped(part.input.setupHoursPerBatch)}</dd></div>{part.result.tiers.map(tier=><div key={tier.scenario}><dt>{tier.scenario}% quantity / year</dt><dd>{grouped(tier.annualQty)}</dd></div>)}</dl></section>)}
      <ScrollTable label="Saved costing inputs"><table aria-label="Saved costing inputs"><thead><tr><th>Part / routing</th><th className="numeric">Margin (%)</th><th className="numeric">Cycle (min)</th><th className="numeric">Setup (h/batch)</th>{['50','100','150'].map(s=><th className="numeric" aria-label={`${s}% annual quantity`} key={s}>{s}% qty/year</th>)}</tr></thead><tbody>
        {parts.map(part=><tr id={`saved-input-${part.quotationPartId}`} tabIndex={-1} key={part.quotationPartId}><th scope="row">{part.part.part_number}<span className="subtext">Routing revision {part.routing.revision_number} <Identifier value={part.routingRevisionId}/></span></th><td className="numeric">{grouped(part.input.marginPercent)}</td><td className="numeric">{grouped(part.input.cycleTimeMin)}</td><td className="numeric">{grouped(part.input.setupHoursPerBatch)}</td>{['50','100','150'].map(s=><td className="numeric" key={s}>{grouped(part.result.tiers.find(t=>t.scenario===s).annualQty)}</td>)}</tr>)}
      </tbody></table></ScrollTable>
      <p className="muted">Saved costs, selected rates and provenance are in the results below and the INTERNAL costing PDF.</p>
    </>}
  </section>;
}
