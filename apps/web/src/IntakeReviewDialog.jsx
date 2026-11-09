import React,{useEffect,useRef} from 'react';

// A native modal owns focus only after an explicit user action.
export default function IntakeReviewDialog({review,onCancel,onConfirm}){
  const dialog=useRef(null);
  useEffect(()=>{if(review){const element=dialog.current,trigger=review.trigger;element.showModal();return()=>{element.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};}},[review]);
  if(!review)return null;
  return <dialog ref={dialog} className="intake-review-dialog" aria-labelledby="intake-review-title" onCancel={event=>{event.preventDefault();onCancel();}}>
    <h2 id="intake-review-title">Review replacement</h2><p>{review.message}</p><p>These are working inputs. Nothing is saved until you review and save the RFQ.</p>
    <div className="actions"><button type="button" className="secondary" autoFocus onClick={onCancel}>Keep current inputs</button><button type="button" onClick={onConfirm}>Replace working inputs</button></div>
  </dialog>;
}
