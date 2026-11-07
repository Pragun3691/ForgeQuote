import React, {useEffect,useId,useRef} from 'react';
import {money,dateLabel} from './format.js';

export default function IssueConfirmation({snapshot,onCancel,onConfirm}) {
  const dialog=useRef(null),cancel=useRef(null),confirm=useRef(null),title=useId(),description=useId();
  useEffect(()=>{
    const el=dialog.current,previous=document.activeElement;
    el.showModal();cancel.current.focus();
    return ()=>{if(el.open)el.close();if(previous?.isConnected)previous.focus();};
  },[]);
  function cycleFocus(e) {
    if(e.key!=='Tab')return;
    if(e.shiftKey && document.activeElement===cancel.current){e.preventDefault();confirm.current.focus();}
    else if(!e.shiftKey && document.activeElement===confirm.current){e.preventDefault();cancel.current.focus();}
  }
  return <dialog ref={dialog} className="issue-dialog" aria-labelledby={title} aria-describedby={description} onKeyDown={cycleFocus} onCancel={e=>{e.preventDefault();onCancel();}}>
    <p className="eyebrow">Final issuance</p><h2 id={title}>Issue saved quotation?</h2>
    <p id={description}>Issuance records this saved version as issued. Any changes require a new version.</p>
    <dl><div><dt>RFQ</dt><dd>{snapshot.rfq.reference}</dd></div><div><dt>Customer</dt><dd>{snapshot.rfq.customer_name}</dd></div><div><dt>Saved version</dt><dd>Version {snapshot.versionNumber}</dd></div><div><dt>Pricing date</dt><dd>{dateLabel(snapshot.pricingDate)}</dd></div><div className="issue-amount"><dt>Saved annual value · excluding GST</dt><dd>{money(snapshot.annualValueExGst)}</dd></div></dl>
    <p className="muted">The server will recheck approval and version eligibility before recording issuance.</p>
    <div className="actions"><button ref={cancel} type="button" className="secondary" onClick={onCancel}>Cancel</button><button ref={confirm} type="button" onClick={onConfirm}>Confirm issuance</button></div>
  </dialog>;
}
