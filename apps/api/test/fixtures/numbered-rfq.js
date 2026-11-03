// Exact part block from manual QA. Header is a separate synthetic browser fixture.
export const numberedSource=`Part 1:
Part Number: SP-101
Description: Rear Wheel Spindle
Material: EN8 Steel
Gross Weight: 610 g
Annual Quantity: 180000 units

Part 2:
Part Number: BR-202
Description: Mounting Bracket
Material: Mild Steel
Gross Weight: 1.25 kg
Annual Quantity: 24000 units`;
export const numberedBrowserSource=`RFQ: SYNTH-NUMBERED-001
Customer: Synthetic Numbered Demo
Due date: 7 Nov 2026

${numberedSource}`;
const missing=()=>({status:'missing',rawValue:null,evidence:[]});
const present=(rawValue,label)=>({status:'present',rawValue,evidence:[`${label}: ${rawValue}`]});
export function numberedSuggestion({headers=false}={}) {
  return {rfq:headers?{reference:present('SYNTH-NUMBERED-001','RFQ'),customerName:present('Synthetic Numbered Demo','Customer'),dueDate:present('7 Nov 2026','Due date')}:{reference:missing(),customerName:missing(),dueDate:missing()},
    parts:[['SP-101','Rear Wheel Spindle','EN8 Steel','610 g','180000 units'],['BR-202','Mounting Bracket','Mild Steel','1.25 kg','24000 units']].map((values,index)=>({anchor:`Part ${index+1}:`,fields:{
      ...Object.fromEntries(['partNumber','description','material','grossWeightKg','requestedAnnualQty'].map((name,i)=>[name,present(values[i],['Part Number','Description','Material','Gross Weight','Annual Quantity'][i])])),
      cycleTimeMin:missing(),setupHoursPerBatch:missing()
    }}))};
}
