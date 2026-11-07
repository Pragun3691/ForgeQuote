import ScrollTable from './ScrollTable.jsx';
import {rateLabel, dateLabel, timestamp} from './format.js';
import Identifier from './Identifier.jsx';
import {RateAuthor} from './FinalWorkflows.jsx';
import React,{useEffect,useState} from 'react';
import {api} from './api.js';

const categories=['material','machine','scrap','overhead','packaging','freight'];
export default function RateCatalogue({onExpired,session}) {
  const [data,setData]=useState(null),[date,setDate]=useState(''),[category,setCategory]=useState('all'),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setError('');setData(null);
    api(`/rates${date?`?asOf=${encodeURIComponent(date)}`:''}`,{signal:controller.signal}).then(setData).catch(e=>{
      if(e.name!=='AbortError'){setError(e.message);if(e.status===401)onExpired();}
    });return ()=>controller.abort();
  },[date,reload]);
  return <main className="workspace rates-workspace">
    <div className="page-heading"><p className="eyebrow">Effective-dated masters</p><h1>Rate catalogue</h1><p className="muted">Estimator: read-only. Sales Head: append new versions. Existing history is immutable.</p></div>
    <div className="rate-filters"><label>Rates as of<input type="date" value={date || data?.asOf || ''} onChange={e=>setDate(e.target.value)}/></label>
      <label>Rate category<select aria-label="Rate category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <button className="secondary" onClick={()=>setReload(n=>n+1)}>Refresh rates</button></div>
    {error && <p role="alert" className="error">{error}</p>}{!data && !error && <p role="status">Loading rate history...</p>}
    {data && <>
      <p className="muted catalogue-date">Applicable on {dateLabel(data.asOf)} (Asia/Kolkata). Starts inclusive; ends exclusive.</p>
      {!data.rateKeys.length && <p>No internal rate keys are available. Contact maintenance.</p>}
      <ScrollTable label="Rate catalogue" className="panel catalogue-table"><table aria-label="Rate catalogue"><thead><tr><th>Internal key / unit</th><th className="numeric">Applicable rate</th><th>Category</th><th>Effective from</th></tr></thead>
        {categories.filter(c=>category==='all'||category===c).map(c=><tbody key={c} aria-label={`${c} rates`}>
          {!data.rateKeys.some(k=>k.category===c) && <tr><td colSpan={4} className="field-warning">No internal {c} keys available. Contact maintenance.</td></tr>}
          {data.rateKeys.filter(k=>k.category===c).map(k=><React.Fragment key={k.id}>
            <tr className="rate-key-row"><th scope="row">{k.code}<span className="subtext">{k.unit} <Identifier value={k.id}/></span></th>
              <td className="numeric">{k.currentVersion?<span title={`Exact stored decimal: ${k.currentVersion.value}`}>{rateLabel(k.currentVersion.value)}</span>:<span className="field-warning">No effective rate</span>}</td><td className="category-cell">{c}</td>
              <td>{k.currentVersion?dateLabel(k.currentVersion.effectiveFrom):'Unavailable'}</td></tr>
            <tr className="rate-history-row"><td colSpan={4}>
              {!k.currentVersion && <p className="field-warning">No effective rate for {data.asOf}. Costing at this date will fail.</p>}
              <details className="rate-history"><summary>History for {k.code} ({k.versions.length} versions)</summary>
                {!k.versions.length?<p>No versions recorded.</p>:<ScrollTable label={`${k.code} history`}><table aria-label={`${k.code} rate history`}><thead><tr><th className="numeric">Value / unit</th><th>Effective from</th><th>Effective to (exclusive)</th><th>Version / recorded at</th><th>Author / reason</th></tr></thead>
                  <tbody>{k.versions.map(v=><tr key={v.id}><td className="numeric">{rateLabel(v.value)} {k.unit}<span className="subtext">Exact: {v.value}</span>{k.currentVersion?.id===v.id && <span className="subtext">Applicable</span>}</td><td>{dateLabel(v.effectiveFrom)}</td><td>{v.effectiveTo ? dateLabel(v.effectiveTo) : 'Open-ended'}</td><td><Identifier value={v.id}/><span className="subtext">{timestamp(v.createdAt)}</span></td><td className="history-reason">{v.actorId?<><Identifier value={v.actorId}/><span className="subtext">{v.reason}</span></>:'Legacy version - no author recorded'}</td></tr>)}</tbody></table></ScrollTable>}
              </details>
            </td></tr>
          </React.Fragment>)}
        </tbody>)}
      </table></ScrollTable>
      <details className="catalogue-notes"><summary>Precision and rate history</summary><p className="muted">Display omits trailing fractional zeros without rounding. Exact stored decimal strings remain available in history. Ends derive from the next version's start. Legacy versions have no recorded author/reason; supplier information is not recorded.</p></details>
      {data.canWrite && <RateAuthor data={data} session={session} onExpired={onExpired} onSaved={()=>setReload(n=>n+1)}/>}
    </>}
  </main>;
}
