import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceSlice} from '../apps/web/src/evidence-display.js';
import {verifyExtraction} from '../apps/api/src/ai/evidence.js';
import {syntheticSource,syntheticSuggestion} from '../apps/api/test/fixtures/synthetic-rfq.js';

test('actual server offsets match JavaScript UTF-16 slice with emoji, CRLF and Unicode',()=>{
  const source='🛠️ Café\r\n'+syntheticSource.replaceAll('\n','\r\n');
  const result=verifyExtraction(source,syntheticSuggestion());
  const fields=[...Object.values(result.rfq),...result.parts.flatMap(part=>Object.values(part.fields))];
  let count=0;
  for(const field of fields)for(const item of field.evidence)if(item.inScope){
    assert.equal(source.slice(item.start,item.end),item.quote);
    const slice=evidenceSlice(source,item);assert.equal(slice.quote,item.quote);assert.equal(slice.before+slice.quote+slice.after,source);count++;
  }
  assert.ok(count>10);
  const item=result.rfq.reference.evidence[0];
  assert.equal(item.start,10); // emoji=2 UTF-16 units, variation selector=1, then space/Café/CRLF.
  assert.equal(evidenceSlice(source,{...item,start:9}),null);
});
test('null, mismatched, out-of-range and unscoped spans never highlight or search elsewhere',()=>{
  const source='quote / quote',valid={quote:'quote',start:0,end:5,found:true,inScope:true};
  assert.equal(evidenceSlice(source,valid).quote,'quote');
  for(const item of [null,{...valid,start:null},{...valid,end:null},{...valid,start:-1},{...valid,end:100},{...valid,start:1.5},{...valid,end:0},{...valid,quote:'QUOTE'},{...valid,inScope:false},{...valid,found:false},{...valid,start:1,end:6}])assert.equal(evidenceSlice(source,item),null);
});
