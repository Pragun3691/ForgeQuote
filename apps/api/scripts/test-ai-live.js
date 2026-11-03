import '../src/config.js';
import { createGeminiExtractor, readAiConfig } from '../src/ai/gemini.js';
import { syntheticSource } from '../test/fixtures/synthetic-rfq.js';
import { numberedSource } from '../test/fixtures/numbered-rfq.js';

const config=readAiConfig();
if(!config.apiKey && config.unavailableCode==='AI_NOT_CONFIGURED') {
  console.log('LIVE PROVIDER TEST NOT RUN: AI_API_KEY is not configured.');
} else {
  try {
    const result=await createGeminiExtractor(config)({sourceText:syntheticSource,consent:true,syntheticOnly:true});
    if(result.rfq.reference.normalizedValue!=='SYNTH-AI-001' || result.parts.length!==2 || result.parts[0].fields.grossWeightKg.normalizedValue!=='0.61') {
      console.log('LIVE PROVIDER CALL SUCCEEDED; extraction expectation checks FAILED.');process.exitCode=1;
    } else {
      console.log(`LIVE PROVIDER TEST PASSED: Google Gemini, ${config.model}, structured multi-part response and verified evidence. Synthetic input only.`);
      const numbered=await createGeminiExtractor(config)({sourceText:numberedSource,consent:true,syntheticOnly:true});
      const expected=[['SP-101','Rear Wheel Spindle','EN8 Steel','0.61','180000'],['BR-202','Mounting Bracket','Mild Steel','1.25','24000']];
      const ok=numbered.parts.length===2&&numbered.parts.every((part,index)=>part.sourcePartIndex===index&&['partNumber','description','material','grossWeightKg','requestedAnnualQty'].every((name,i)=>part.fields[name].status==='verified'&&part.fields[name].normalizedValue===expected[index][i])&&['cycleTimeMin','setupHoursPerBatch'].every(name=>part.fields[name].status==='missing'));
      if(!ok){console.log('LIVE NUMBERED RFQ CALL SUCCEEDED; two-part association/normalization checks FAILED.');process.exitCode=1;}
      else console.log('LIVE NUMBERED RFQ TEST PASSED: exact SP-101/BR-202 source, two ordered verified parts, 0.61/1.25 kg; cycle/setup remain missing.');
    }
  } catch(error) {
    const codes=['AI_CONFIGURATION_INVALID','AI_TIMEOUT','AI_QUOTA_EXCEEDED','AI_MODEL_UNAVAILABLE','AI_PROVIDER_REQUEST','AI_PROVIDER_BILLING','AI_PROVIDER_PRECONDITION','AI_PROVIDER_ACCESS','AI_PROVIDER_UNAVAILABLE','AI_INVALID_RESPONSE'];
    console.log(`LIVE PROVIDER TEST FAILED: ${codes.includes(error.code)?error.code:'AI_ERROR'}. No source or credentials logged.`);process.exitCode=1;
  }
}
