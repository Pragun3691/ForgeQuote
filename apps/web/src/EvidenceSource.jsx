import React, {useEffect,useRef} from 'react';
import {evidenceSlice} from './evidence-display.js';

export default function EvidenceSource({source,selected}) {
  const region=useRef(null),pane=useRef(null),mark=useRef(null),slice=evidenceSlice(source,selected?.item);
  useEffect(()=>{if(selected && slice){pane.current?.focus({preventScroll:true});mark.current?.scrollIntoView({block:'nearest'});region.current?.scrollIntoView({block:'nearest'});}},[selected]);
  return <section ref={region} className="evidence-source" aria-label="Original submitted source"><div className="section-heading"><h4>Original submitted source</h4>{selected?.trigger?.isConnected && <button type="button" className="secondary" onClick={()=>selected.trigger.focus()}>Return to field</button>}</div>
    <p className="muted">{slice?`Located quote: ${selected.label}`:'Choose a field’s source reference to locate its exact quote.'} Highlighting locates evidence; it does not approve a value.</p>
    <pre ref={pane} tabIndex={0} aria-label="Original source text">{slice?<>{slice.before}<mark ref={mark}>{slice.quote}</mark>{slice.after}</>:source}</pre>
  </section>;
}
