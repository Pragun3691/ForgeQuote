import React from 'react';
import ScrollTable from './ScrollTable.jsx';
import Identifier from './Identifier.jsx';
import {grouped,dateLabel} from './format.js';

export default function SavedCostingInputs({snapshot,loading}) {
  return <section className="panel saved-inputs" aria-label="Saved costing inputs"><h2>Saved costing inputs</h2>
    <p className="muted">Sales head cannot create quotations. {snapshot?'These read-only inputs belong to the selected immutable version.':loading?'Loading the selected saved version.':'Select a saved version to review its inputs.'}</p>
    {snapshot && <><p className="saved-input-context">Version {snapshot.versionNumber} · Pricing date {dateLabel(snapshot.pricingDate)}</p>
      <ScrollTable label="Saved costing inputs"><table aria-label="Saved costing inputs"><thead><tr><th>Part / routing</th><th className="numeric">Margin (%)</th><th className="numeric">Cycle (min)</th><th className="numeric">Setup (h/batch)</th>{['50','100','150'].map(s=><th className="numeric" aria-label={`${s}% annual quantity`} key={s}>{s}% qty/year</th>)}</tr></thead><tbody>
        {snapshot.parts.map(part=><tr key={part.quotationPartId}><th scope="row">{part.part.part_number}<span className="subtext">Routing revision {part.routing.revision_number} <Identifier value={part.routingRevisionId}/></span></th><td className="numeric">{grouped(part.input.marginPercent)}</td><td className="numeric">{grouped(part.input.cycleTimeMin)}</td><td className="numeric">{grouped(part.input.setupHoursPerBatch)}</td>{['50','100','150'].map(s=><td className="numeric" key={s}>{grouped(part.result.tiers.find(t=>t.scenario===s).annualQty)}</td>)}</tr>)}
      </tbody></table></ScrollTable>
      <p className="muted">Saved costs, selected rates and provenance are in the results below and the INTERNAL costing PDF.</p>
    </>}
  </section>;
}
