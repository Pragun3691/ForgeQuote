import ScrollTable from './ScrollTable.jsx';
import React from 'react';

import {grouped, money, dateLabel, timestamp} from './format.js';
import Identifier from './Identifier.jsx';
export {grouped, money} from './format.js';
const lines = { material:'Material',machining:'Machining',scrap:'Scrap allowance',overhead:'Overhead',packaging:'Packaging',freight:'Freight',setup:'Allocated setup' };
const rateLabels = { materialInrPerKg:['Material','INR/kg'],machineInrPerHour:['Machine','INR/hour'],scrapPercent:['Scrap','%'],overheadPercent:['Overhead','%'],packagingInrPerPiece:['Packaging','INR/piece'],freightInrPerPiece:['Freight','INR/piece'] };

export default function QuoteResults({ snapshot, summaryOnly=false }) {
  if (summaryOnly) return <section className="baseline-summary" aria-label="Saved annual baseline"><p className="eyebrow">Saved combined annual baseline · Version {snapshot.versionNumber}</p><p className="headline-price" data-testid="annual-baseline-value">{money(snapshot.annualValueExGst)}</p><p className="muted">Excluding GST · 100% scenario · Immutable saved value</p></section>;
  return <section className="results" aria-label="Saved quotation">
    <div className="section-heading"><div><p className="eyebrow">Persisted quotation</p><h2>Saved quotation <span className="badge">Version {snapshot.versionNumber}</span></h2></div><span className="muted">Pricing date {dateLabel(snapshot.pricingDate)}</span></div>
    <p className="muted">{snapshot.rfq.reference} · {snapshot.rfq.customer_name} · Saved {timestamp(snapshot.createdAt)}</p>
    <p className="notice">Immutable saved results. Changing inputs creates a new version.</p>
    {snapshot.parts.map(part => <article key={part.quotationPartId}>
      <div className="result-summary"><div><p className="eyebrow">{part.part.part_number} · baseline unit price, ex-GST</p><p className="headline-price" data-testid="baseline-price">{money(part.result.tiers[1].sellingPricePerUnitExGst)}</p></div><div><p className="eyebrow">Manufacturing cost / unit</p><p className="summary-number" data-testid="baseline-cost">{money(part.result.tiers[1].costPerUnit)}</p></div><div><p className="eyebrow">Annual baseline quantity</p><p className="summary-number">{grouped(part.result.requestedAnnualQty)}</p></div></div>
      <h3>Cost breakdown & volume comparison</h3>
      <ScrollTable label={`Cost breakdown ${part.part.part_number}`}><table aria-label={`Cost breakdown ${part.part.part_number}`}><thead><tr><th scope="col">INR / unit</th>{part.result.tiers.map(tier => <th className="numeric" scope="col" key={tier.scenario}>{tier.scenario}% scenario<br/><span className="muted">{grouped(tier.annualQty)} units / year</span></th>)}</tr></thead><tbody>
        {Object.entries(lines).map(([key,label]) => <tr key={key}><th scope="row">{label}</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.lines[key])}</td>)}</tr>)}
        <tr className="total-row"><th scope="row">Manufacturing cost</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.costPerUnit)}</td>)}</tr>
        <tr className="price-row"><th scope="row">Selling price, ex-GST</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.sellingPricePerUnitExGst)}</td>)}</tr>
      </tbody></table></ScrollTable>
      <p className="muted">Saved margin {part.input.marginPercent}% · routing revision {part.routing.revision_number} · setup {part.input.setupHoursPerBatch} hours / batch. Scenario labels are editable production quantities, not material discounts.</p>
      <details><summary>Selected rates & provenance</summary><ScrollTable label="Rate provenance"><table aria-label="Rate provenance"><thead><tr><th>Rate</th><th className="numeric">Resolved value</th><th>Effective from</th><th>Rate version ID</th></tr></thead><tbody>{Object.entries(part.rates).map(([field,rate]) => <tr key={field}><th scope="row">{rateLabels[field][0]}</th><td className="numeric">{grouped(rate.value)} {rateLabels[field][1]}</td><td>{dateLabel(rate.effectiveFrom)}</td><td><Identifier value={rate.rateVersionId}/></td></tr>)}</tbody></table></ScrollTable></details>
    </article>)}
    <h3>Annual quotation totals</h3>
    <ScrollTable label="Annual quotation totals"><table aria-label="Annual quotation totals"><thead><tr><th>INR / year</th>{snapshot.totals.map(total => <th className="numeric" key={total.scenario}>{total.scenario}% scenario</th>)}</tr></thead><tbody>{[['taxableSubtotal','Taxable subtotal, ex-GST'],['gstAmount',`Illustrative GST (${snapshot.parts[0].input.gstPercent}%)`],['totalWithGst','Total including GST']].map(([key,label]) => <tr key={key} className={key === 'totalWithGst' ? 'total-row' : ''}><th scope="row">{label}</th>{snapshot.totals.map(total => <td className="numeric" key={total.scenario}>{money(total[key])}</td>)}</tr>)}</tbody></table></ScrollTable>
    <p className="muted">Illustrative GST only; no tax classification or invoice compliance. Formula: {snapshot.formulaVersion}. Version ID: <Identifier value={snapshot.versionId}/></p>
  </section>;
}
