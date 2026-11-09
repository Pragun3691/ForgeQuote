import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intakeCategories,intakeErrors} from '../apps/web/src/intake-validation.js';
import {canonicalRfq} from '../apps/api/src/rfq-intake.js';
const keys=intakeCategories.map((category,i)=>({category,id:`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`,currentVersion:null}));
const part=()=>({partNumber:'P1',description:'Synthetic spindle',requestedAnnualQty:'1000000000',grossWeightKg:'999999999999.999999',cycleTimeMin:'0.000001',setupHoursPerBatch:'0.000000',rateKeys:Object.fromEntries(keys.map(k=>[k.category,k.id]))});
const form=()=>({reference:' SYNTH ',customerName:'Synthetic',dueDate:'2026-11-09',parts:[part()]});
test('documented boundaries accepted without changing strings or requiring current rates',()=>{const value=form(),before=JSON.stringify(value);assert.deepEqual(intakeErrors(value,keys),{});canonicalRfq(value);assert.equal(JSON.stringify(value),before);});
test('frontend bounds agree with actual backend for text, dates, quantities and decimals',()=>{
 const cases=[['reference',['',' ', 'A'.repeat(81),'x\ny']],['customerName',['x'.repeat(161)]],['dueDate',['0000-01-01','2026-02-29','2026-13-01','2026-1-1','2024-02-29']],['requestedAnnualQty',['0','01','1.0','1000000001','1000000000','1','-1']],['grossWeightKg',['0','0.000000','0.000001','01','1.0000001','1000000000000','1e2',' 1','999999999999.999999']],['cycleTimeMin',['0','2.123456','2.1234567']],['setupHoursPerBatch',['0','0.000000','-0','2.123456']],['partNumber',[' ','x'.repeat(81),'x\ty']],['description',['x'.repeat(501),'x\u007fy']]];
 for(const [field,values] of cases)for(const value of values){const body=form();if(field in body)body[field]=value;else body.parts[0][field]=value;let accepted=true;try{canonicalRfq(body);}catch{accepted=false;}assert.equal(Object.keys(intakeErrors(body,keys)).length===0,accepted,`${field}: ${JSON.stringify(value)}`);}
});
test('duplicates match backend trimmed, case-sensitive identity; 1/2/20 boundaries',()=>{for(const count of [1,2,20,21,0]){const value=form();value.parts=Array.from({length:count},(_,i)=>({...part(),partNumber:`P${i}`}));assert.equal(!Object.keys(intakeErrors(value,keys)).length,count>=1&&count<=20);}const value=form();value.parts.push({...part(),partNumber:' P1 '});assert.ok(intakeErrors(value,keys)['parts.1.partNumber']);assert.throws(()=>canonicalRfq(value));value.parts[1].partNumber='p1';assert.deepEqual(intakeErrors(value,keys),{});});
test('keys must exist in the correct category; missing current history is not a blocker',()=>{const value=form();value.parts[0].rateKeys.machine=keys[0].id;assert.ok(intakeErrors(value,keys)['parts.0.rateKeys.machine']);value.parts[0].rateKeys.machine=keys[1].id;assert.deepEqual(intakeErrors(value,keys),{});});
