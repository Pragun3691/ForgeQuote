import React from 'react';
import ScrollTable from './ScrollTable.jsx';
import {dateLabel} from './format.js';
import {filterRfqs} from './register-view.js';

export default function RfqRegister({rfqs,reading,error,onRefresh,view,onView,canCreate}) {
  const rows=filterRfqs(rfqs||[],view);
  const estimators=[...new Set((rfqs||[]).map(r=>r.assignedEstimator))].sort();
  if(view.estimator!=='all'&&!estimators.includes(view.estimator))estimators.push(view.estimator);
  const filtered=!!view.q || view.status!=='all' || view.estimator!=='all' || view.sort!=='due';
  return <section className="register-results" aria-label="RFQ list">
    <div className="list-controls">
      <label className="list-search">Search RFQs<input type="search" value={view.q} placeholder="Reference or customer" onChange={e=>onView({q:e.target.value},true)}/></label>
      <label>RFQ status<select aria-label="RFQ status" value={view.status} onChange={e=>onView({status:e.target.value})}><option value="all">All statuses</option>{['estimating','sent','won','lost'].map(status=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select></label>
      <label>Assigned estimator<select aria-label="Assigned estimator" value={view.estimator} onChange={e=>onView({estimator:e.target.value})}><option value="all">All estimators</option>{estimators.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Sort RFQs<select aria-label="Sort RFQs" value={view.sort} onChange={e=>onView({sort:e.target.value})}><option value="due">Due date · earliest</option><option value="due-desc">Due date · latest</option><option value="reference">Reference · A–Z</option><option value="customer">Customer · A–Z</option></select></label>
    </div>
    <div className="list-meta"><p className="muted" role="status">{rfqs?`${rows.length} of ${rfqs.length} RFQs`:'RFQ register'}{reading&&rfqs?' · Refreshing':''}</p><div className="list-actions">{filtered&&<button className="secondary" onClick={()=>onView({q:'',status:'all',estimator:'all',sort:'due'})}>Reset filters</button>}<button className="secondary" onClick={onRefresh}>Refresh RFQs</button></div></div>
    {error&&<div role="alert" className="error">{error}{rfqs&&' Showing previously loaded RFQs.'}<br/><button onClick={onRefresh}>Reload RFQs</button></div>}
    {reading&&!error&&<p role="status">{rfqs?'Refreshing RFQs...':'Loading RFQs...'}</p>}
    {rfqs?.length===0&&<section className="panel empty"><h2>No RFQs yet</h2><p>{canCreate?'Create an RFQ using New RFQ above.':'An estimator can create an RFQ for this register.'}</p></section>}
    {!!rfqs?.length&&!rows.length&&<section className="panel empty"><h2>No matching RFQs</h2><p>Try another reference, customer or filter.</p><button className="secondary" onClick={()=>onView({q:'',status:'all',estimator:'all',sort:'due'})}>Clear RFQ filters</button></section>}
    {!!rows.length&&<ScrollTable label="RFQ register" className="panel register-table"><table aria-label="RFQ register"><thead><tr><th scope="col" aria-sort={view.sort==='reference'?'ascending':undefined}>Reference / open</th><th scope="col" aria-sort={view.sort==='customer'?'ascending':undefined}>Customer</th><th scope="col" aria-sort={view.sort.startsWith('due')?(view.sort==='due'?'ascending':'descending'):undefined}>Due date</th><th scope="col">Assigned estimator</th><th scope="col">RFQ status</th><th scope="col">Parts</th></tr></thead><tbody>{rows.map(rfq=><tr key={rfq.id}><th scope="row"><a className="row-action" aria-label="Open RFQ" aria-describedby={`reference-${rfq.id}`} href={`#${new URLSearchParams({rfq:rfq.id})}`}><strong id={`reference-${rfq.id}`}>{rfq.reference}</strong><span aria-hidden="true">→</span></a></th><td>{rfq.customerName}</td><td>{dateLabel(rfq.dueDate)}</td><td>{rfq.assignedEstimator}</td><td><span className={`badge status-${rfq.status}`}>{rfq.status}</span></td><td>{rfq.partCount}</td></tr>)}</tbody></table></ScrollTable>}
  </section>;
}
