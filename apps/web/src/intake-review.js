import {evidenceSlice} from './evidence-display.js';
export const manualPartFields=['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch'];
export const manualHeaderFields=['reference','customerName','dueDate'];
// Status comes from server validation. Client evidence checks can only reject,
// never promote, a suggestion. Preserve the exact server decimal string.
export function verifiedIntakeValue(field,source){
  return field?.status==='verified'&&typeof field.normalizedValue==='string'&&field.normalizedValue!==''&&Array.isArray(field.evidence)&&field.evidence.length>0&&field.evidence.every(item=>evidenceSlice(source,item))?field.normalizedValue:null;
}
