import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifiedIntakeValue,manualPartFields} from '../apps/web/src/intake-review.js';
const source='🛠 Gross weight: 610 g';
const evidence={quote:'Gross weight: 610 g',start:3,end:22,found:true,inScope:true};
const field=()=>({status:'verified',normalizedValue:'0.610000',evidence:[{...evidence}]});
test('exact UTF-16 evidence accepts server-verified values without decimal normalization',()=>assert.equal(verifiedIntakeValue(field(),source),'0.610000'));
test('missing, ambiguous, unsupported, invalid or absent evidence cannot be applied',()=>{for(const status of ['missing','ambiguous','unsupported'])assert.equal(verifiedIntakeValue({...field(),status},source),null);for(const patch of [{quote:'610'}, {start:2},{end:21},{inScope:false},{found:false}])assert.equal(verifiedIntakeValue({...field(),evidence:[{...evidence,...patch}]},source),null);assert.equal(verifiedIntakeValue({...field(),evidence:[]},source),null);assert.equal(verifiedIntakeValue({...field(),evidence:[evidence,{...evidence,start:null}]},source),null);assert.equal(verifiedIntakeValue(field(),source+' '), '0.610000');assert.equal(verifiedIntakeValue(field(),'changed source'),null);});
test('material remains informational and cannot become an internal rate key',()=>assert.equal(manualPartFields.includes('material'),false));
