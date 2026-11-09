import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute} from '../apps/web/src/route.js';
import {createDraftStore} from '../apps/web/src/draft-store.js';
import {readError} from '../apps/web/src/read-error.js';

test('one parser resolves existing links, intake and active sections consistently',()=>{
  assert.deepEqual(parseRoute('#'),{view:'register',section:'rfqs'});
  assert.deepEqual(parseRoute('#view=intake'),{view:'intake',section:'rfqs'});
  assert.deepEqual(parseRoute('#approvals'),{view:'approvals',section:'approvals'});
  assert.deepEqual(parseRoute('#view=rates'),{view:'rates',section:'rates'});
  assert.deepEqual(parseRoute('#rfq=rfq-a&version=version-b'),{view:'rfq',section:'rfqs',rfqId:'rfq-a',versionId:'version-b'});
  assert.deepEqual(parseRoute('#view=rates&rfq=rfq-a'),{view:'rates',section:'rates'});
  assert.deepEqual(parseRoute('#approvals','estimator'),{view:'register',section:'rfqs'});
  assert.deepEqual(parseRoute('#view=intake','sales_head'),{view:'register',section:'rfqs'});
  assert.deepEqual(parseRoute('#approvals','sales_head'),{view:'approvals',section:'approvals'});
});
test('ordinary working inputs retain exact strings and are isolated by RFQ/auth scope',()=>{
  const session=createDraftStore(),nextSession=createDraftStore();
  session.read('costing:a',null);session.write('costing:a',{marginPercent:'17.250000',quantity:'1000000000',routingRevisionId:'route-a'});
  assert.deepEqual(session.read('costing:a',()=>({marginPercent:'20'})),{marginPercent:'17.250000',quantity:'1000000000',routingRevisionId:'route-a'});
  assert.equal(session.read('costing:b',null),null);assert.equal(nextSession.read('costing:a',null),null);
});
test('unload warning tracks independent unsent drafts and clears after durable submission',()=>{
  const store=createDraftStore();assert.equal(store.hasUnsaved(),false);
  store.mark('intake',true);store.mark('costing:a',true);store.mark('intake',false);assert.equal(store.hasUnsaved(),true);
  store.mark('costing:a',false);assert.equal(store.hasUnsaved(),false);
});
test('read errors explain retry without implying a write and retain actionable domain errors',()=>{
  assert.equal(readError({code:'NETWORK_FAILURE',message:'If saving, retry the same submission'},'RFQs'),'Unable to load RFQs. Please retry.');
  assert.equal(readError({status:503,message:'If saving, retry'},'lifecycle status'),'Unable to load lifecycle status. Please retry.');
  assert.equal(readError({status:404,message:'RFQ not found.'},'this RFQ'),'RFQ not found.');
});
