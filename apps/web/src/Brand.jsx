import React from 'react';

export function Brand(){
  return <a className="brand" href="#"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 25V7h20v5H12v4h11v5H12v4Z" fill="currentColor"/><path d="m22 22 5 5" fill="none" stroke="currentColor" strokeWidth="3"/></svg></span><span>ForgeQuote<small>Manufacturing quotations</small></span></a>;
}

export function NavIcon({type}) {
  const paths={rfq:'M5 3h9l5 5v13H5V3Zm9 0v6h5M9 13h6m-6 4h6',approval:'m5 12 4 4 10-10M4 4h7M4 20h16v-8',rates:'M4 6h16M4 12h16M4 18h16M9 3v6m6 0v6m-6 0v6'};
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[type]}/></svg>;
}

export function ManufacturingDrawing() {
  return <div className="manufacturing-drawing" aria-hidden="true"><svg viewBox="0 0 640 300" fill="none">
    <g className="drawing-guides" stroke="currentColor" strokeWidth="1"><path d="M38 150h564M320 20v260" strokeDasharray="5 8"/><path d="M78 224v38m480-94v94M78 250h480M70 242l16 16m464-16 16 16M193 58V30m242 28V30M193 40h242m-249-7 14 14m228-14 14 14"/></g>
    <g className="drawing-part" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="m78 142 115-66h100l42-24h62l38 22v28l123 71v40l-115 66h-38l-70-40h-62l-42-24H131l-53-31v-42Z"/>
      <path d="m78 142 53 31h100l42 24h62l70 40h38l115-64M193 76l53 31h100l42 24v66l-53 42m100-137-47 29M293 76l53 31m-11-55 53 31h47M131 173v42m100-42v42m42-18v42m132-2v42m38-42v42"/>
      <ellipse cx="479" cy="205" rx="24" ry="14" transform="rotate(-30 479 205)"/><ellipse cx="479" cy="205" rx="12" ry="7" transform="rotate(-30 479 205)"/>
      <path d="m102 128 53 31h66m55-46 47-27m-41 39 47-27m-41 39 47-27m-41 39 47-27m-41 39 47-27M443 127l-26 15m39-8-26 15m39-8-26 15"/>
    </g>
    <g fill="currentColor" className="drawing-nodes"><circle cx="78" cy="142" r="3"/><circle cx="335" cy="52" r="3"/><circle cx="558" cy="173" r="3"/></g>
  </svg><span className="drawing-caption">FORM / PROCESS / PRECISION</span></div>;
}
