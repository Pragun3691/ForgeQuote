import React from 'react';

export function ActionButton({variant='primary',className='',type='button',...props}) {
  return <button type={type} className={`${variant==='primary'?'':variant==='danger'?'secondary danger':'secondary'} ${className}`.trim()} {...props}/>;
}

// Presentation only: the owning form controls values, validation and IDs.
export function Field({id,label,hint,hintId,children}) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <p id={hintId} className="field-hint">{hint}</p>}</div>;
}

export function Notice({tone='notice',...props}) {
  return <p className={tone} {...props}/>;
}
