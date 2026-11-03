import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceSections,verifyExtraction } from '../src/ai/evidence.js';
import { numberedSource,numberedSuggestion } from './fixtures/numbered-rfq.js';

test('exact numbered manual-QA source produces two bounded, verified parts in source order',()=>{
  const sections=sourceSections(numberedSource).sections;
  assert.equal(sections.length,2);assert.equal(sections[0].anchor,'Part 1:');assert.equal(sections[1].anchor,'Part 2:');
  assert.equal(sections[0].end,numberedSource.indexOf('Part 2:'));assert.equal(sections[1].start,sections[0].end);
  const data=numberedSuggestion();data.parts.reverse();const result=verifyExtraction(numberedSource,data);
  assert.deepEqual(result.parts.map(p=>[p.sourcePartIndex,p.fields.partNumber.normalizedValue,p.fields.description.normalizedValue,p.fields.grossWeightKg.normalizedValue,p.fields.requestedAnnualQty.normalizedValue]),[
    [0,'SP-101','Rear Wheel Spindle','0.61','180000'],[1,'BR-202','Mounting Bracket','1.25','24000']
  ]);
  for(const p of result.parts){assert.equal(p.fields.cycleTimeMin.status,'missing');assert.equal(p.fields.setupHoursPerBatch.status,'missing');for(const f of Object.values(p.fields))for(const e of f.evidence){assert.equal(numberedSource.slice(e.start,e.end),e.quote);}}
});
test('exact identifier-line anchors and unique literal part-number evidence can associate proposals',()=>{
  for(const anchors of [['Part Number: SP-101','Part Number: BR-202'],['Part Number SP-101','Part Number BR-202']]){
    const data=numberedSuggestion();data.parts.forEach((p,i)=>p.anchor=anchors[i]);
    assert.deepEqual(verifyExtraction(numberedSource,data).parts.map(p=>p.fields.partNumber.normalizedValue),['SP-101','BR-202']);
  }
});
test('unmatched model proposals warn visibly without creating extra review components',()=>{
  const data=numberedSuggestion(),extra=structuredClone(data.parts[0]);extra.anchor='Invented component';extra.fields.partNumber={status:'present',rawValue:'FAKE',evidence:['Part Number: FAKE']};data.parts.push(extra);
  const result=verifyExtraction(numberedSource,data);assert.equal(result.parts.length,2);
  assert.ok(result.warnings.some(w=>w.includes('Unmatched model proposal 3')&&w.includes('Invented component')&&/manual/i.test(w)));
});
test('duplicate model proposals and conflicting model identifiers never select or merge a winner',()=>{
  const data=numberedSuggestion();data.parts.push(structuredClone(data.parts[0]));
  const result=verifyExtraction(numberedSource,data);assert.equal(result.parts.length,2);assert.ok(Object.values(result.parts[0].fields).every(f=>f.status==='ambiguous'&&f.normalizedValue===null));
  assert.equal(result.parts[1].fields.partNumber.normalizedValue,'BR-202');assert.ok(result.warnings.some(w=>/Multiple model proposals/.test(w)));
  const conflict=numberedSuggestion();conflict.parts[0].fields.partNumber=structuredClone(conflict.parts[1].fields.partNumber);
  assert.ok(Object.values(verifyExtraction(numberedSource,conflict).parts[0].fields).every(f=>f.status!=='verified'));
});
test('duplicate source identifiers, repeated numbered headings and conflicting identifier lines block verification',()=>{
  for(const source of [numberedSource.replace('BR-202','SP-101'),numberedSource.replace('Part 2:','Part 1:'),numberedSource.replace('Part Number: SP-101','Part Number: SP-101\nPart Number: OTHER')]){
    const result=verifyExtraction(source,numberedSuggestion());assert.equal(result.parts.length,2);assert.ok(Object.values(result.parts[0].fields).every(f=>f.status!=='verified'));assert.ok(result.warnings.some(w=>/ambiguous/i.test(w)));
  }
});
test('missing identifiers remain missing, and evidence cannot cross numbered section boundaries',()=>{
  const source=numberedSource.replace('Part Number: SP-101\n',''),data=numberedSuggestion();data.parts[0].fields.partNumber={status:'missing',rawValue:null,evidence:[]};
  const result=verifyExtraction(source,data);assert.equal(result.parts.length,2);assert.equal(result.parts[0].fields.partNumber.status,'missing');assert.equal(result.parts[0].fields.grossWeightKg.normalizedValue,'0.61');
  const wrong=numberedSuggestion();wrong.parts[0].fields.grossWeightKg=structuredClone(wrong.parts[1].fields.grossWeightKg);
  const field=verifyExtraction(numberedSource,wrong).parts[0].fields.grossWeightKg;assert.equal(field.status,'unsupported');assert.equal(field.normalizedValue,null);
});
test('values repeated across parts remain independently verifiable only inside their bounded section',()=>{
  const source=numberedSource.replace('1.25 kg','610 g'),data=numberedSuggestion();data.parts[1].fields.grossWeightKg={status:'present',rawValue:'610 g',evidence:['Gross Weight: 610 g']};
  const parts=verifyExtraction(source,data).parts;assert.deepEqual(parts.map(p=>p.fields.grossWeightKg.normalizedValue),['0.61','0.61']);assert.notEqual(parts[0].fields.grossWeightKg.evidence[0].start,parts[1].fields.grossWeightKg.evidence[0].start);
});
test('legacy Part, Item and standalone Part Number sections remain supported',()=>{
  for(const label of ['Part','Item','Part Number']){
    const source=numberedSource.replace('Part 1:\n','').replace('Part 2:\n','').replaceAll('Part Number:',`${label}:`),data=numberedSuggestion();data.parts.forEach((p,i)=>{p.anchor=`${label}: ${i?'BR-202':'SP-101'}`;p.fields.partNumber.evidence=[p.anchor];});
    assert.deepEqual(verifyExtraction(source,data).parts.map(p=>p.fields.partNumber.normalizedValue),['SP-101','BR-202']);
  }
});
