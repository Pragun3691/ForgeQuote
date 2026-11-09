import {readRateView,rateHash,filterRates} from './rate-view.js';
import {useRoute,navigate} from './route.js';
import ScrollTable from './ScrollTable.jsx';
import {rateLabel, dateLabel, timestamp} from './format.js';
import Identifier from './Identifier.jsx';
import {RateAuthor} from './FinalWorkflows.jsx';
import React,{useEffect,useState} from 'react';
import {api} from './api.js';
import {readError} from './read-error.js';

const categories=['material','machine','scrap','overhead','packaging','freight'];
export default function RateCatalogue({onExpired,session,active=true}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useRoute(session.user.role);
  const view=readRateView(window.location.hash),{date,category}=view;
  const update=(patch,replace=false)=>navigate(rateHash(window.location.hash,patch),{replace});
  const [expanded,setExpanded]=useState({});
  const filtered=filterRates(data?.rateKeys||[],view);
  const [reading,setReading]=useState(false);
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();setError('');setReading(true);
    api(`/rates${date?`?asOf=${encodeURIComponent(date)}`:''}`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted){setData(result);setError('');}}).catch(e=>{
      if(!controller.signal.aborted){setError(readError(e,'rate history'));if(e.status===401)onExpired();}
    }).finally(()=>{if(!controller.signal.aborted)setReading(false);});return ()=>controller.abort();
  },[date,reload,active]);
  return <main className="workspace rates-workspace">
    <div className="page-heading"><p className="eyebrow">Effective-dated masters</p><h1>Rate catalogue</h1><p className="muted">Estimator: read-only. Sales Head: append new versions. Existing history is immutable.</p></div>
    <div className="rate-filters"><label>Search rate keys<input type="search" aria-label="Search rate keys" value={view.q} placeholder="Code, category or unit" onChange={e=>update({rateq:e.target.value},true)}/></label><label>Rates as of<input type="date" value={date || data?.asOf || ''} onChange={e=>update({asOf:e.target.value})}/></label>
      <label>Rate category<select aria-label="Rate category" value={category} onChange={e=>update({category:e.target.value})}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <button className="secondary" onClick={()=>setReload(n=>n+1)}>Refresh rates</button>{(view.q||category!=='all'||date)&&<button className="secondary" onClick={()=>update({rateq:'',category:'all',asOf:''})}>Reset rate filters</button>}{data?.canWrite&&<button className="secondary" onClick={()=>{const heading=document.getElementById('rate-author-title');heading?.focus();heading?.scrollIntoView({block:'start'});}}>Go to rate authoring</button>}</div>
    {error && <p role="alert" className="error">{error}{data && ' Showing previously loaded rates.'}</p>}{reading && !error && <p role="status">{data?'Refreshing rate history. Previously loaded rates remain below.':'Loading rate history...'}</p>}
    {data && <>
      <p className="muted catalogue-date">Applicable on {dateLabel(data.asOf)} (Asia/Kolkata). Starts inclusive; ends exclusive.</p>
      <p role="status" className="muted">{filtered.length} of {data.rateKeys.length} internal rate keys</p>
      {!!data.rateKeys.length&&!filtered.length&&<p className="notice">No matching rate keys. Clear the search or reset filters.</p>}
      {!data.rateKeys.length && <p>No internal rate keys are available. Contact maintenance.</p>}
      <ScrollTable label="Rate catalogue" className="panel catalogue-table"><table aria-label="Rate catalogue"><thead><tr><th>Internal key / unit</th><th className="numeric">Applicable rate</th><th>Category</th><th>Effective from</th></tr></thead>
        {categories.filter(c=>category==='all'||category===c).map(c=><tbody key={c} aria-label={`${c} rates`}>
          {!data.rateKeys.some(k=>k.category===c) && <tr><td colSpan={4} className="field-warning">No internal {c} keys available. Contact maintenance.</td></tr>}
          {filtered.filter(k=>k.category===c).map(k=><React.Fragment key={k.id}>
            <tr className="rate-key-row"><th scope="row">{k.code}<span className="subtext">{k.unit} <Identifier value={k.id}/></span></th>
              <td className="numeric">{k.currentVersion?<span title={`Exact stored decimal: ${k.currentVersion.value}`}>{rateLabel(k.currentVersion.value)}</span>:<span className="field-warning">No effective rate</span>}</td><td className="category-cell">{c}</td>
              <td>{k.currentVersion?dateLabel(k.currentVersion.effectiveFrom):'Unavailable'}</td></tr>
            <tr className="rate-history-row"><td colSpan={4}>
              {!k.currentVersion && <p className="field-warning">No effective rate for {data.asOf}. Costing at this date will fail.</p>}
              <details className="rate-history" open={!!expanded[k.id]} onToggle={e=>{const open=e.currentTarget.open;setExpanded(current=>current[k.id]===open?current:{...current,[k.id]:open});}}><summary>History for {k.code} ({k.versions.length} versions)</summary>
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
