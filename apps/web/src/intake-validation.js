// Mirror rfq-intake.js without normalizing the owner's decimal strings.
export const intakeCategories=['material','machine','scrap','overhead','packaging','freight'];
export const intakeLabels={reference:'RFQ reference',customerName:'Customer name',dueDate:'Due date',partNumber:'Part number',description:'Description',requestedAnnualQty:'Annual quantity',grossWeightKg:'Gross weight (kg)',cycleTimeMin:'Cycle time (minutes)',setupHoursPerBatch:'Setup hours per batch'};
export function intakeErrors(form,keys) {
  const errors={};
  const text=(value,max,path)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))errors[path]=`Enter 1–${max} characters without control characters.`;};
  text(form.reference,80,'reference');text(form.customerName,160,'customerName');
  const date=form.dueDate;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.startsWith('0000')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)errors.dueDate='Enter a valid YYYY-MM-DD date.';
  if(!Array.isArray(form.parts)||form.parts.length<1||form.parts.length>20){errors.parts='Provide between 1 and 20 parts.';return errors;}
  const numbers=new Map();
  form.parts.forEach((part,index)=>{
    const prefix=`parts.${index}.`;
    text(part.partNumber,80,prefix+'partNumber');text(part.description,500,prefix+'description');
    const number=part.partNumber?.trim();
    if(number){if(numbers.has(number)){errors[prefix+'partNumber']='Part numbers must be unique within this RFQ.';errors[`parts.${numbers.get(number)}.partNumber`]=errors[prefix+'partNumber'];}else numbers.set(number,index);}
    if(typeof part.requestedAnnualQty!=='string'||!/^[1-9]\d{0,9}$/.test(part.requestedAnnualQty)||BigInt(part.requestedAnnualQty)>1000000000n)errors[prefix+'requestedAnnualQty']='Enter a whole quantity from 1 to 1,000,000,000.';
    for(const field of ['grossWeightKg','cycleTimeMin','setupHoursPerBatch']){
      const value=part[field],positive=field!=='setupHoursPerBatch';
      if(typeof value!=='string'||!/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value)||(positive&&!/[1-9]/.test(value)))errors[prefix+field]=`Enter a ${positive?'positive':'nonnegative'} decimal: up to 12 integer and 6 fractional digits.`;
    }
    for(const category of intakeCategories){const value=part.rateKeys?.[category];if(typeof value!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)||!keys?.some(k=>k.id===value.toLowerCase()&&k.category===category))errors[prefix+'rateKeys.'+category]=`Select an existing ${category} rate key in the correct category.`;}
  });
  return errors;
}
export function intakeErrorLabel(path){const pieces=path.split('.');return pieces[0]==='parts'&&pieces.length>2?`Part ${Number(pieces[1])+1}: ${intakeLabels[pieces[2]]||pieces[3]+' rate key'}`:intakeLabels[path]||'Parts';}
