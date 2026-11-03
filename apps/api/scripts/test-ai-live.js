import '../src/config.js';
import { createGeminiExtractor, readAiConfig } from '../src/ai/gemini.js';
import { syntheticSource } from '../test/fixtures/synthetic-rfq.js';

const config=readAiConfig();
if(!config.apiKey && config.unavailableCode==='AI_NOT_CONFIGURED') {
  console.log('LIVE PROVIDER TEST NOT RUN: AI_API_KEY is not configured.');
} else {
  try {
    const result=await createGeminiExtractor(config)({sourceText:syntheticSource,consent:true,syntheticOnly:true});
    if(result.rfq.reference.normalizedValue!=='SYNTH-AI-001' || result.parts.length!==2 || result.parts[0].fields.grossWeightKg.normalizedValue!=='0.61') {
      console.log('LIVE PROVIDER CALL SUCCEEDED; extraction expectation checks FAILED.');process.exitCode=1;
    } else console.log(`LIVE PROVIDER TEST PASSED: Google Gemini, ${config.model}, structured multi-part response and verified evidence. Synthetic input only.`);
  } catch(error) {
    const codes=['AI_CONFIGURATION_INVALID','AI_TIMEOUT','AI_QUOTA_EXCEEDED','AI_MODEL_UNAVAILABLE','AI_PROVIDER_REQUEST','AI_PROVIDER_BILLING','AI_PROVIDER_PRECONDITION','AI_PROVIDER_ACCESS','AI_PROVIDER_UNAVAILABLE','AI_INVALID_RESPONSE'];
    console.log(`LIVE PROVIDER TEST FAILED: ${codes.includes(error.code)?error.code:'AI_ERROR'}. No source or credentials logged.`);process.exitCode=1;
  }
}
