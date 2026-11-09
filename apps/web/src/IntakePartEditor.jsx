import React from 'react';
import {intakeLabels} from './intake-validation.js';

export default function IntakePartEditor({part,index,onChange,fieldProps}) {
  return <div className="input-grid">{['partNumber','description','requestedAnnualQty','grossWeightKg','cycleTimeMin','setupHoursPerBatch'].map(field=>{
    const {error,...props}=fieldProps(`parts.${index}.${field}`);
    return <label key={field}>{intakeLabels[field]}<input required aria-label={intakeLabels[field]} {...props} inputMode={field==='requestedAnnualQty'?'numeric':['grossWeightKg','cycleTimeMin','setupHoursPerBatch'].includes(field)?'decimal':undefined} value={part[field]} onChange={event=>onChange(index,field,event.target.value)}/>{error&&<span id={props['aria-describedby']} className="field-error">{error}</span>}</label>;
  })}</div>;
}
