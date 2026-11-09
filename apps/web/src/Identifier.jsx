import React, {useState} from 'react';

export default function Identifier({value}) {
  const [expanded,setExpanded]=useState(false);
  return <span className="short-id" data-expanded={expanded}><button type="button" className="id-toggle secondary" title={value} aria-expanded={expanded} aria-label={`${expanded?'Hide':'Show'} full identifier ${value.slice(0,8)}`} onClick={()=>setExpanded(!expanded)}>{value.slice(0,8)}…</button>{expanded && <span className="identifier">{value}</span>}</span>;
}
