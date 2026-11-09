import ScrollTable from './ScrollTable.jsx';
import React from 'react';

import {grouped, money, dateLabel, timestamp} from './format.js';
import Identifier from './Identifier.jsx';
export {grouped, money} from './format.js';
const lines = { material:'Material',machining:'Machining',scrap:'Scrap allowance',overhead:'Overhead',packaging:'Packaging',freight:'Freight',setup:'Allocated setup' };
const rateLabels = { materialInrPerKg:['Material','INR/kg'],machineInrPerHour:['Machine','INR/hour'],scrapPercent:['Scrap','%'],overheadPercent:['Overhead','%'],packagingInrPerPiece:['Packaging','INR/piece'],freightInrPerPiece:['Freight','INR/piece'] };

export default function QuoteResults({ snapshot, summaryOnly=false }) {
  if (summaryOnly) return <section className="baseline-summary" aria-label="Saved annual baseline"><p className="eyebrow">Saved combined annual baseline · Version {snapshot.versionNumber}</p><p className="headline-price" data-testid="annual-baseline-value">{money(snapshot.annualValueExGst)}</p><p className="muted">Excluding GST · 100% scenario · Immutable saved value</p></section>;
  const parts=[...snapshot.parts].sort((a,b)=>a.part.part_number.localeCompare(b.part.part_number,'en',{numeric:true}));
  return <section className="results" aria-label="Saved quotation">
    <div className="section-heading"><div><p className="eyebrow">Persisted quotation</p><h2 id="saved-results-heading" tabIndex={-1}>Saved quotation <span className="badge">Version {snapshot.versionNumber}</span></h2></div><span className="muted">Pricing date {dateLabel(snapshot.pricingDate)}</span></div>
    <p className="muted">{snapshot.rfq.reference} · {snapshot.rfq.customer_name} · Saved {timestamp(snapshot.createdAt)}</p>
    <p className="notice">Immutable saved results. Changing inputs creates a new version.</p>
    <h3>Annual quotation totals</h3>
    <p className="muted">All parts combined. Each scenario uses its saved annual quantities. Financial values below belong to Version {snapshot.versionNumber}.</p>
    <div className="scenario-strip" aria-label="Saved annual scenario summaries">{snapshot.totals.map(total=><section key={total.scenario} className={total.scenario==='100'?'scenario-baseline':''} aria-label={`Saved ${total.scenario}% annual scenario`}><h4>{total.scenario}% scenario {total.scenario==='100'&&<span className="muted">Baseline</span>}</h4><dl><div><dt>Annual subtotal, ex-GST</dt><dd>{money(total.taxableSubtotal)}</dd></div><div><dt>Annual illustrative GST ({snapshot.parts[0].input.gstPercent}%)</dt><dd>{money(total.gstAmount)}</dd></div><div><dt>Annual total, including GST</dt><dd>{money(total.totalWithGst)}</dd></div></dl></section>)}</div>
    <ScrollTable label="Annual quotation totals"><table aria-label="Annual quotation totals"><thead><tr><th>INR / year</th>{snapshot.totals.map(total => <th className="numeric" key={total.scenario}>{total.scenario}% scenario</th>)}</tr></thead><tbody>{[['taxableSubtotal','Taxable subtotal, ex-GST'],['gstAmount',`Illustrative GST (${snapshot.parts[0].input.gstPercent}%)`],['totalWithGst','Total including GST']].map(([key,label]) => <tr key={key} className={key === 'totalWithGst' ? 'total-row' : ''}><th scope="row">{label}</th>{snapshot.totals.map(total => <td className="numeric" key={total.scenario}>{money(total[key])}</td>)}</tr>)}</tbody></table></ScrollTable>
    {parts.map(part => <article key={part.quotationPartId}>
      <div className="result-summary"><div><p className="eyebrow">{part.part.part_number} · baseline unit price, ex-GST</p><p className="headline-price" data-testid="baseline-price">{money(part.result.tiers.find(t=>t.scenario==='100').sellingPricePerUnitExGst)}</p></div><div><p className="eyebrow">Manufacturing cost / unit, ex-GST</p><p className="summary-number" data-testid="baseline-cost">{money(part.result.tiers.find(t=>t.scenario==='100').costPerUnit)}</p></div><div><p className="eyebrow">Saved baseline quantity / year</p><p className="summary-number">{grouped(part.result.requestedAnnualQty)}</p></div></div>
      <h3>Cost breakdown & volume comparison</h3>
      <ScrollTable label={`Cost breakdown ${part.part.part_number}`}><table aria-label={`Cost breakdown ${part.part.part_number}`}><thead><tr><th scope="col">INR / unit, ex-GST</th>{part.result.tiers.map(tier => <th className="numeric" scope="col" key={tier.scenario}>{tier.scenario}% scenario<br/><span className="muted">{grouped(tier.annualQty)} units / year</span></th>)}</tr></thead><tbody>
        {Object.entries(lines).map(([key,label]) => <tr key={key}><th scope="row">{label}</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.lines[key])}</td>)}</tr>)}
        <tr className="total-row"><th scope="row">Manufacturing cost</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.costPerUnit)}</td>)}</tr>
        <tr className="price-row"><th scope="row">Selling price, ex-GST</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.sellingPricePerUnitExGst)}</td>)}</tr>
      </tbody></table></ScrollTable>
      <p className="muted">Saved margin {part.input.marginPercent}% · routing revision {part.routing.revision_number} · setup {part.input.setupHoursPerBatch} hours / batch. Scenario quantities are saved production volumes. The percentage labels do not apply material discounts.</p>
      <details><summary>Selected rates & provenance</summary><p className="muted">Saved rate values and versions used in this quotation. Units are shown per row; quotation GST is reported in the annual totals.</p><ScrollTable label="Rate provenance"><table aria-label="Rate provenance"><thead><tr><th>Rate</th><th className="numeric">Resolved value</th><th>Effective from</th><th>Rate version ID</th></tr></thead><tbody>{Object.entries(part.rates).map(([field,rate]) => <tr key={field}><th scope="row">{rateLabels[field][0]}</th><td className="numeric">{grouped(rate.value)} {rateLabels[field][1]}</td><td>{dateLabel(rate.effectiveFrom)}</td><td><Identifier value={rate.rateVersionId}/></td></tr>)}</tbody></table></ScrollTable></details>
    </article>)}
    <p className="muted">Illustrative GST only; no tax classification or invoice compliance. Formula: {snapshot.formulaVersion}. Version ID: <Identifier value={snapshot.versionId}/></p>
  </section>;
}
