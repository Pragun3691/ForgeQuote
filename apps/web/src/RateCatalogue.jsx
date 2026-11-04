import React,{useEffect,useState} from 'react';
import {api} from './api.js';

const categories=['material','machine','scrap','overhead','packaging','freight'];
export default function RateCatalogue({onExpired}) {
  const [data,setData]=useState(null),[date,setDate]=useState(''),[category,setCategory]=useState('all'),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setError('');setData(null);
    api(`/rates${date?`?asOf=${encodeURIComponent(date)}`:''}`,{signal:controller.signal}).then(setData).catch(e=>{
      if(e.name!=='AbortError'){setError(e.message);if(e.status===401)onExpired();}
    });return ()=>controller.abort();
  },[date,reload]);
  return <main className="workspace"><a href="#">RFQ register</a><h1>Rate catalogue</h1>
    <p className="notice">Read-only for Estimator and Sales Head. Rate changes require a separately approved maintenance workflow. Existing rate history cannot be overwritten or deleted.</p>
    <div className="rate-filters"><label>Rates as of<input type="date" value={date || data?.asOf || ''} onChange={e=>setDate(e.target.value)}/></label>
      <label>Rate category<select aria-label="Rate category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <button className="secondary" onClick={()=>setReload(n=>n+1)}>Refresh rates</button></div>
    {error && <p role="alert" className="error">{error}</p>}{!data && !error && <p role="status">Loading rate history...</p>}
    {data && <><p>Applicable on {data.asOf} (Asia/Kolkata). Period starts are inclusive; ends are exclusive. Ends derive from the next version's start.</p>
      <p className="muted">Values remain exact decimal strings, with up to six fractional places in the existing rate contract. Version UUID and record creation time identify the database source; supplier/source author is not recorded by the existing schema.</p>
      {!data.rateKeys.length && <p>No internal rate keys are available. Contact maintenance.</p>}
      {categories.filter(c=>category==='all'||category===c).map(c=><section key={c} aria-label={`${c} rates`}><h2>{c[0].toUpperCase()+c.slice(1)}</h2>
        {!data.rateKeys.some(k=>k.category===c) && <p className="error">No internal {c} keys available. Contact maintenance.</p>}
        {data.rateKeys.filter(k=>k.category===c).map(k=><article className="panel lifecycle" key={k.id}><h3>{k.code} <span className="badge">{k.unit}</span></h3>
          <p>{k.currentVersion?`Applicable value: ${k.currentVersion.value} ${k.unit}`:`No effective rate for ${data.asOf}. Costing at this date will fail.`}</p>
          <p className="identifier">Key ID: {k.id}</p>
          <details><summary>History for {k.code} ({k.versions.length} versions)</summary>
            {!k.versions.length?<p>No versions recorded.</p>:<div className="table-scroll"><table aria-label={`${k.code} rate history`}><thead><tr><th>Value / unit</th><th>Effective from</th><th>Effective to (exclusive)</th><th>Version / recorded at</th></tr></thead>
              <tbody>{k.versions.map(v=><tr key={v.id}><td>{v.value} {k.unit}{k.currentVersion?.id===v.id && <span className="subtext">Applicable</span>}</td><td>{v.effectiveFrom}</td><td>{v.effectiveTo || 'Open-ended'}</td><td><span className="identifier">{v.id}</span><span className="subtext">{v.createdAt}</span></td></tr>)}</tbody></table></div>}
          </details></article>)}
      </section>)}
    </>}
  </main>;
}
