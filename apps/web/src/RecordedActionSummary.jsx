import React from 'react';
import Identifier from './Identifier.jsx';
export default function RecordedActionSummary({request,label='Recorded request'}){
 return <section className="recorded-action" aria-label={label}><h3>{label}</h3><p className="muted">Read-only original intent. Retry sends these inputs with the same key; it does not create a new action.</p><dl><div><dt>Request key</dt><dd><Identifier value={request.key}/></dd></div><div><dt>Target / action</dt><dd>{request.path||request.action}</dd></div>{Object.entries(request.body).map(([name,value])=><div key={name}><dt>{({value:'Exact rate value',effectiveFrom:'Effective from',reason:'Reason',outcome:'Outcome'})[name]||name}</dt><dd>{String(value)}</dd></div>)}</dl></section>;
}
