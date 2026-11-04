import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {renderCustomerQuotation,pdfMoney} from '../src/quotation-pdf.js';
import {customerQuotation} from '../src/customer-quotation.js';
import {customerPdfFixture} from '../../../tests/helpers/pdf-fixture.js';
import {inspectPdf} from '../../../tests/helpers/pdf.js';

const prohibited=['INTERNAL_SECRET','materialInrPerKg','machineInrPerHour','rateVersionId','costPerUnit','marginPercent','Machining','Manufacturing cost'];
function checkPages(result) {
 for(const [index,page] of result.pages.entries()) {
  assert.ok(Math.abs(page.width-595.28)<.1 && Math.abs(page.height-841.89)<.1,'A4 portrait');
  assert.ok(page.text.includes(`Page ${index+1} of ${result.pages.length}`));
  assert.ok(page.text.includes('Version ID:'));
  assert.ok(page.text.includes('ForgeQuote'));
  if(page.text.includes('quantity scenario')) {
   const afterHeading=page.text.slice(page.text.lastIndexOf('quantity scenario'));
   assert.ok(afterHeading.includes('SPINDLE-DEMO') || afterHeading.includes('PART-'),'No orphan scenario/table heading');
  }
  for(const item of page.items) {
   assert.ok(item.transform[4]>=40 && item.transform[4]+item.width<555,`Text outside horizontal margins: ${item.str}`);
   assert.ok(item.transform[5]>25 && item.transform[5]<815,`Text outside vertical margins: ${item.str}`);
  }
 }
}
test('customer PDF contains exact saved selling prices/totals, rupee glyph, issue date and embedded fonts',async()=>{
 const data=customerPdfFixture(),buffer=await renderCustomerQuotation(data),result=await inspectPdf(buffer);
 assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
 for(const value of ['ISSUED CUSTOMER QUOTATION',data.quotationNumber,data.versionId,'Synthetic Demo Customer','RFQ-2611-014','05 Nov 2026','2026-11-02','50% quantity scenario','100% quantity scenario - baseline','150% quantity scenario','₹150.55','₹149.70','₹149.41','₹2,69,46,000.00','₹48,50,280.00','₹3,17,96,280.00','Illustrative GST (18%)']) assert.ok(result.text.includes(value),value);
 assert.equal(result.attachments,null);assert.ok(buffer.toString('latin1').includes('/FontFile2'));assert.ok(buffer.toString('latin1').includes('/ToUnicode'));
 for(const value of prohibited) assert.ok(!result.text.includes(value));
 checkPages(result);
 await mkdir('.tmp/t05-pdf',{recursive:true});await writeFile('.tmp/t05-pdf/single.pdf',buffer);
});
test('20 components with long descriptions paginate with repeated headers, full content and exact large decimal strings',async()=>{
 const data=customerPdfFixture();
 data.customerName='Synthetic long customer '+ 'Customer '.repeat(15);
 for(const scenario of data.scenarios) {
  scenario.lines=Array.from({length:20},(_,i)=>({...scenario.lines[0],partNumber:`PART-${i+1}-`+'X'.repeat(70),description:'Synthetic component description. '.repeat(15)+` END-${i+1}`,
   unitPrice:'12345678901234567890.12',lineTotal:'123456789012345678901234567890.12'}));
  scenario.subtotal='123456789012345678901234567890.12';scenario.gstAmount='22222222022222222202222222220.22';scenario.total='145679011034567901103456790110.34';
 }
 const buffer=await renderCustomerQuotation(data),result=await inspectPdf(buffer);
 assert.ok(result.pages.length>3);assert.ok(result.pages.length<=40);
 for(let i=1;i<=20;i++) assert.equal(result.text.split(`END-${i}`).length-1,3*(i===1?11:i===2?2:1));
 assert.ok(result.text.includes('(continued)'));assert.ok(result.text.includes('150% quantity scenario'));
 assert.ok(result.text.replace(/\s/g,'').includes(pdfMoney(data.scenarios[0].subtotal)));
 checkPages(result);await writeFile('.tmp/t05-pdf/multipart-long.pdf',buffer);
});
test('explicit customer projection excludes internal fields including metadata; unissued/stale/mismatched states reject',async()=>{
 const fixture=customerPdfFixture();
 const snapshot={...fixture,rfq:{customer_name:fixture.customerName,reference:fixture.rfqReference,owner_label:'INTERNAL_SECRET'},
  parts:[{part:{part_number:'P1',description:'Customer component',gross_weight_kg:'INTERNAL_SECRET'},input:{marginPercent:'INTERNAL_SECRET'},rates:{materialInrPerKg:'INTERNAL_SECRET'},
   result:{costPerUnit:'INTERNAL_SECRET',tiers:fixture.scenarios.map(s=>({scenario:s.scenario,annualQty:s.lines[0].quantity,sellingPricePerUnitExGst:s.lines[0].unitPrice,taxableSubtotal:s.lines[0].lineTotal,lines:{material:'INTERNAL_SECRET'}}))}}],
  totals:fixture.scenarios.map(s=>({scenario:s.scenario,taxableSubtotal:s.subtotal,gstAmount:s.gstAmount,totalWithGst:s.total}))};
 const state={status:'issued',stale:false,events:[{eventType:'issued',versionId:fixture.versionId,quotationNumber:fixture.quotationNumber,occurredAt:fixture.issuedAt,actorId:'INTERNAL_SECRET'}]};
 const projected=customerQuotation(snapshot,state);
 const rendered=await inspectPdf(await renderCustomerQuotation(projected));
 for(const value of prohibited) assert.ok(!JSON.stringify(rendered).includes(value),value);
 for(const value of prohibited) assert.ok(!JSON.stringify(projected).includes(value),value);
 for(const status of ['draft','pending','approved','rejected']) assert.throws(()=>customerQuotation(snapshot,{...state,status}),{code:'PDF_NOT_ISSUED'});
 assert.throws(()=>customerQuotation(snapshot,{...state,stale:true}),{code:'STALE_QUOTATION'});
 assert.throws(()=>customerQuotation(snapshot,{...state,events:[]}),{code:'PDF_NOT_ISSUED'});
 assert.throws(()=>customerQuotation(snapshot,{...state,events:[{...state.events[0],versionId:'different'}]}),{code:'PDF_NOT_ISSUED'});
});
test('formatting preserves paise for large values; malformed snapshot does not silently round or substitute zero',async()=>{
 assert.equal(pdfMoney('12345678901234567890.12'),'₹1,23,45,67,89,01,23,45,67,890.12');
 for(const value of [1,'1.001','1','NaN',null]) assert.throws(()=>pdfMoney(value),{code:'PDF_INVALID_SNAPSHOT'});
 const data=customerPdfFixture();data.scenarios[0].subtotal=undefined;
 await assert.rejects(renderCustomerQuotation(data),{code:'PDF_INVALID_SNAPSHOT'});
 const unicode=customerPdfFixture();unicode.customerName='Synthetic unsupported \u{1F600}';
 await assert.rejects(renderCustomerQuotation(unicode),{code:'PDF_UNSUPPORTED_TEXT'});
});
