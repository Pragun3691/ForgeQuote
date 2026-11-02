// Entirely synthetic facts; hand-written expectations, never calculator output.
export const syntheticSource = `RFQ: SYNTH-AI-001
Customer: Synthetic Components Demo
Due date: 6 Nov 2026

Part: SPINDLE-A
Description: Synthetic rear-wheel spindle
Material: EN8
Gross weight: 610 g
Annual quantity: 180,000 pieces/year
Cycle time: 192 seconds
Setup time per batch: 12 hours

Part: ARM-B
Description: Synthetic lift arm
Material: 40Cr4
Gross weight: 4.60 kg
Annual quantity: 24,000 units/year
Cycle time: 11.5 minutes`;
const present=(rawValue,line)=>({status:'present',rawValue,evidence:[line]});
export function syntheticSuggestion() {
  return {
    rfq:{reference:present('SYNTH-AI-001','RFQ: SYNTH-AI-001'),customerName:present('Synthetic Components Demo','Customer: Synthetic Components Demo'),dueDate:present('6 Nov 2026','Due date: 6 Nov 2026')},
    parts:[{anchor:'Part: SPINDLE-A',fields:{partNumber:present('SPINDLE-A','Part: SPINDLE-A'),description:present('Synthetic rear-wheel spindle','Description: Synthetic rear-wheel spindle'),
      material:present('EN8','Material: EN8'),grossWeightKg:present('610 g','Gross weight: 610 g'),requestedAnnualQty:present('180,000 pieces/year','Annual quantity: 180,000 pieces/year'),
      cycleTimeMin:present('192 seconds','Cycle time: 192 seconds'),setupHoursPerBatch:present('12 hours','Setup time per batch: 12 hours')}},
    {anchor:'Part: ARM-B',fields:{partNumber:present('ARM-B','Part: ARM-B'),description:present('Synthetic lift arm','Description: Synthetic lift arm'),
      material:present('40Cr4','Material: 40Cr4'),grossWeightKg:present('4.60 kg','Gross weight: 4.60 kg'),requestedAnnualQty:present('24,000 units/year','Annual quantity: 24,000 units/year'),
      cycleTimeMin:present('11.5 minutes','Cycle time: 11.5 minutes'),setupHoursPerBatch:{status:'missing',rawValue:null,evidence:[]}}}]
  };
}
export const fakeGeminiResponse = data => ({text:JSON.stringify(data),candidates:[{finishReason:'STOP'}]});
