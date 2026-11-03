import React from 'react';

export function grouped(value) {
  const text = String(value);
  return text.length > 3 ? `${text.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${text.slice(-3)}` : text;
}
// Format saved decimal strings without any floating-point conversion/arithmetic.
export function money(value) {
  const [whole, fraction] = value.split('.');
  return `₹${grouped(whole)}.${fraction}`;
}
const lines = { material:'Material',machining:'Machining',scrap:'Scrap allowance',overhead:'Overhead',packaging:'Packaging',freight:'Freight',setup:'Allocated setup' };
const rateLabels = { materialInrPerKg:['Material','INR/kg'],machineInrPerHour:['Machine','INR/hour'],scrapPercent:['Scrap','%'],overheadPercent:['Overhead','%'],packagingInrPerPiece:['Packaging','INR/piece'],freightInrPerPiece:['Freight','INR/piece'] };

export default function QuoteResults({ snapshot }) {
  return <section className="results" aria-label="Saved quotation">
    <div className="section-heading"><div><p className="eyebrow">Persisted quotation</p><h2>Saved quotation <span className="badge">Draft v{snapshot.versionNumber}</span></h2></div><span className="muted">Pricing date {snapshot.pricingDate}</span></div>
    <p className="muted">{snapshot.rfq.reference} · {snapshot.rfq.customer_name} · Saved {new Date(snapshot.createdAt).toLocaleString('en-IN', { timeZone:'Asia/Kolkata' })} IST</p>
    <p className="notice">Draft only. These are saved backend results. Changing the form creates a new version.</p>
    <p>Combined baseline annual value, excluding GST: <strong data-testid="annual-baseline-value">{money(snapshot.annualValueExGst)}</strong></p>
    {snapshot.parts.map(part => <article key={part.quotationPartId}>
      <div className="result-summary"><div><p className="eyebrow">{part.part.part_number} · baseline unit price, ex-GST</p><p className="headline-price" data-testid="baseline-price">{money(part.result.tiers[1].sellingPricePerUnitExGst)}</p></div><div><p className="eyebrow">Manufacturing cost / unit</p><p className="summary-number" data-testid="baseline-cost">{money(part.result.tiers[1].costPerUnit)}</p></div><div><p className="eyebrow">Annual baseline quantity</p><p className="summary-number">{grouped(part.result.requestedAnnualQty)}</p></div></div>
      <h3>Cost breakdown & volume comparison</h3>
      <div className="table-scroll"><table aria-label={`Cost breakdown ${part.part.part_number}`}><thead><tr><th scope="col">INR / unit</th>{part.result.tiers.map(tier => <th className="numeric" scope="col" key={tier.scenario}>{tier.scenario}% scenario<br/><span className="muted">{grouped(tier.annualQty)} units / year</span></th>)}</tr></thead><tbody>
        {Object.entries(lines).map(([key,label]) => <tr key={key}><th scope="row">{label}</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.lines[key])}</td>)}</tr>)}
        <tr className="total-row"><th scope="row">Manufacturing cost</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.costPerUnit)}</td>)}</tr>
        <tr className="price-row"><th scope="row">Selling price, ex-GST</th>{part.result.tiers.map(tier => <td className="numeric" key={tier.scenario}>{money(tier.sellingPricePerUnitExGst)}</td>)}</tr>
      </tbody></table></div>
      <p className="muted">Saved margin {part.input.marginPercent}% · routing revision {part.routing.revision_number} · setup {part.input.setupHoursPerBatch} hours / batch. Scenario labels are editable production quantities, not material discounts.</p>
      <details><summary>Selected rates & provenance</summary><div className="table-scroll"><table aria-label="Rate provenance"><thead><tr><th>Rate</th><th className="numeric">Resolved value</th><th>Effective from</th><th>Rate version ID</th></tr></thead><tbody>{Object.entries(part.rates).map(([field,rate]) => <tr key={field}><th scope="row">{rateLabels[field][0]}</th><td className="numeric">{rate.value} {rateLabels[field][1]}</td><td>{rate.effectiveFrom}</td><td className="identifier">{rate.rateVersionId}</td></tr>)}</tbody></table></div></details>
    </article>)}
    <h3>Annual quotation totals</h3>
    <div className="table-scroll"><table aria-label="Annual quotation totals"><thead><tr><th>INR / year</th>{snapshot.totals.map(total => <th className="numeric" key={total.scenario}>{total.scenario}% scenario</th>)}</tr></thead><tbody>{[['taxableSubtotal','Taxable subtotal, ex-GST'],['gstAmount',`Illustrative GST (${snapshot.parts[0].input.gstPercent}%)`],['totalWithGst','Total including GST']].map(([key,label]) => <tr key={key} className={key === 'totalWithGst' ? 'total-row' : ''}><th scope="row">{label}</th>{snapshot.totals.map(total => <td className="numeric" key={total.scenario}>{money(total[key])}</td>)}</tr>)}</tbody></table></div>
    <p className="muted">Illustrative GST only; no tax classification or invoice compliance. Formula: {snapshot.formulaVersion}. Version ID: <span className="identifier">{snapshot.versionId}</span></p>
  </section>;
}
