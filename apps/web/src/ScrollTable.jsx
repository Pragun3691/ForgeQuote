import React, {useEffect, useRef, useState} from 'react';

// Keep wide financial tables intact, with a keyboard target and honest edge cues.
export default function ScrollTable({label, className='', children}) {
  const ref=useRef(null);
  const [edges,setEdges]=useState({left:false,right:false});
  function measure() {
    const el=ref.current;
    if(el) setEdges({left:el.scrollLeft>1,right:el.scrollLeft+el.clientWidth<el.scrollWidth-1});
  }
  useEffect(()=>{
    const observer=new ResizeObserver(measure),el=ref.current;
    observer.observe(el);if(el.firstElementChild)observer.observe(el.firstElementChild);
    measure();return ()=>observer.disconnect();
  },[]);
  return <div className={`table-frame ${className}`}>
    {(edges.left || edges.right) && <p className="scroll-hint">{edges.left?'← ':''}Scroll horizontally for more columns{edges.right?' →':''}</p>}
    <div ref={ref} className={`table-scroll${edges.left?' more-left':''}${edges.right?' more-right':''}`} role="region" aria-label={`${label} scroll area`} tabIndex={0} onScroll={measure}>{children}</div>
  </div>;
}
