import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { openSync } from 'fontkit';
import { createQuotationService } from './quotations.js';
import { pdfMoney } from './quotation-pdf.js';
import { inputError } from './quotation-request.js';

const regular=fileURLToPath(new URL('../assets/fonts/NotoSans-Regular.ttf',import.meta.url));
const bold=fileURLToPath(new URL('../assets/fonts/NotoSans-Bold.ttf',import.meta.url));
let fonts;
const safe=value=>{
  if(typeof value!=='string' || !value.length || value.length>2000) throw inputError('Saved internal report is incomplete.','PDF_INVALID_SNAPSHOT');
  fonts ||= [openSync(regular),openSync(bold)];
  const text=value.replace(/[\x00-\x09\x0b-\x1f\x7f]/g,' ');
  for(const c of text) if(c!=='\n' && !fonts.every(f=>f.hasGlyphForCodePoint(c.codePointAt(0)))) throw inputError('Saved text is unsupported by the PDF font.','PDF_UNSUPPORTED_TEXT');
  return text;
};

// Only saved facts. No rate/master lookup and no costing or tax recalculation.
export async function renderInternalCosting(snapshot) {
  if(!Array.isArray(snapshot.parts) || snapshot.parts.length<1 || snapshot.parts.length>20) throw inputError('Saved internal report is incomplete.','PDF_INVALID_SNAPSHOT');
  const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,autoFirstPage:false,
    info:{Title:'INTERNAL CONFIDENTIAL costing',Author:'ForgeQuote',Subject:`Version ${safe(snapshot.versionId)}`,
      CreationDate:new Date(safe(snapshot.createdAt)),ModDate:new Date(snapshot.createdAt)}});
  const chunks=[];let bytes=0;
  const finished=new Promise((resolve,reject)=>{
    doc.on('data',c=>{bytes+=c.length;if(bytes>8*1024*1024)doc.destroy(new Error('PDF size limit'));else chunks.push(c);});
    doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  });finished.catch(()=>{});
  try {
    doc.registerFont('Body',regular);doc.registerFont('Bold',bold);
    let y;
    const write=(text,x,top,width,font='Body',size=9)=>doc.font(font).fontSize(size).fillColor('#213331').text(safe(text),x,top,{width,lineGap:2, ...(top>=779?{lineBreak:false}: {})});
    function page() {
      if(doc.bufferedPageRange().count>=100)throw inputError('Internal report exceeds the page limit.','PDF_INVALID_SNAPSHOT');
      doc.addPage();write('ForgeQuote | INTERNAL / CONFIDENTIAL',42,30,511,'Bold',14);
      write(`Saved costing - version ${snapshot.versionNumber}`,42,56,511,'Bold',10);
      y=82;
    }
    function rowHeight(label,value,heading=false) {
      const size=heading?11:9,font=heading?'Bold':'Body';
      return Math.max(doc.font('Bold').fontSize(size).heightOfString(safe(label),{width:164,lineGap:2}),doc.font(font).fontSize(size).heightOfString(safe(value),{width:325,lineGap:2}))+12;
    }
    function row(label,value,{heading=false}={}) {
      label=safe(label);value=safe(value);
      const size=heading?11:9,font=heading?'Bold':'Body',h=rowHeight(label,value,heading);
      if(h>672)throw inputError('Saved text exceeds the internal report row limit.','PDF_INVALID_SNAPSHOT');
      if(y+h>754)page();
      if(heading)doc.rect(42,y,511,h).fill('#e8f3f0');
      write(label,48,y+4,164,'Bold',size);write(value,222,y+4,325,font,size);
      y+=h;
    }
    page();
    row('RFQ',snapshot.rfq.reference);row('Customer',snapshot.rfq.customer_name);
    row('Version ID',snapshot.versionId);row('Pricing date',snapshot.pricingDate);row('Formula version',snapshot.formulaVersion);
    row('Snapshot saved at',snapshot.createdAt);row('Saved annual baseline, ex-GST',pdfMoney(snapshot.annualValueExGst));
    row('Document purpose','Internal saved costing; not an issued customer quotation. Historical and unissued versions are permitted.');
    for(const part of snapshot.parts) {
      row('Component',part.part.part_number,{heading:true});row('Description',part.part.description);row('Margin (%)',part.input.marginPercent);
      row('Saved manufacturing inputs',`Gross weight (kg): ${safe(part.input.grossWeightKg)}\nCycle time (minutes): ${safe(part.input.cycleTimeMin)}\nSetup hours / batch: ${safe(part.input.setupHoursPerBatch)}\nRouting revision: ${safe(part.routingRevisionId)}`);
      for(const scenario of ['50','100','150']) {
        const tier=part.result.tiers.find(t=>t.scenario===scenario);
        if(!tier)throw inputError('Saved scenario missing.','PDF_INVALID_SNAPSHOT');
        row(`${scenario}% scenario`,`${tier.annualQty} units/year`,{heading:true});
        row('Saved batch plan',`${tier.batchPlan.batchCount} batches; base quantity ${tier.batchPlan.baseBatchQty}; ${tier.batchPlan.extraUnitBatchCount} batches with one extra unit`);
        for(const [key,label] of Object.entries({material:'Material',machining:'Machining',scrap:'Scrap',overhead:'Overhead',packaging:'Packaging',freight:'Freight',setup:'Allocated setup'}))row(`${label} / unit`,pdfMoney(tier.lines[key]));
        row('Manufacturing / unit',pdfMoney(tier.costPerUnit));row('Selling / unit, ex-GST',pdfMoney(tier.sellingPricePerUnitExGst));
        row('Part line, ex-GST',pdfMoney(tier.taxableSubtotal));
        row('Part GST',pdfMoney(tier.gstAmount));row('Part total including GST',pdfMoney(tier.totalWithGst));
      }
      row('Selected rate provenance','Saved at calculation time',{heading:true});
      for(const field of ['materialInrPerKg','machineInrPerHour','scrapPercent','overheadPercent','packagingInrPerPiece','freightInrPerPiece']) {
        const rate=part.rates[field];
        if(!rate)throw inputError('Saved rate missing.','PDF_INVALID_SNAPSHOT');
        row(field,`Key: ${safe(rate.rateKeyId)}\nVersion: ${safe(rate.rateVersionId)}\nEffective from: ${safe(rate.effectiveFrom)}\nValue: ${safe(rate.value)}`);
      }
    }
    for(const scenario of ['50','100','150']) {
      const total=snapshot.totals.find(t=>t.scenario===scenario);
      if(!total)throw inputError('Saved totals missing.','PDF_INVALID_SNAPSHOT');
      const rows=[['Subtotal excluding GST',pdfMoney(total.taxableSubtotal)],['Illustrative GST (%)',snapshot.gstPercent],
        ['GST amount',pdfMoney(total.gstAmount)],['Total including GST',pdfMoney(total.totalWithGst)]];
      const heading=`${scenario}% quotation totals`;
      const height=rowHeight(heading,'INR / year',true)+rows.reduce((sum,[label,value])=>sum+rowHeight(label,value),0);
      if(y+height>754)page();
      row(heading,'INR / year',{heading:true});
      for(const [label,value] of rows)row(label,value);
    }
    const count=doc.bufferedPageRange().count;
    for(let i=0;i<count;i++) {
      doc.switchToPage(i);doc.page.margins.bottom=0;
      write(`INTERNAL / CONFIDENTIAL | Version ID: ${snapshot.versionId}`,42,779,511,'Body',7);
      write(`Page ${i+1} of ${count}`,42,796,511,'Body',7);
    }
    doc.end();return await finished;
  } catch(error) {doc.destroy();throw error;}
}

export function createInternalCostingService(pool,config) {
  const quotes=createQuotationService(pool,config);
  return async(actorId,versionId)=>{
    // Existing reader checks current activation. Explicit role check keeps the
    // internal endpoint bounded even if additional application roles are added.
    const user=(await pool.query('SELECT active,role FROM users WHERE id=$1',[actorId])).rows[0];
    if(!user?.active)throw inputError('Sign in to continue.','AUTH_REQUIRED');
    if(!['estimator','sales_head'].includes(user.role))throw inputError('Internal costing access is forbidden.','ROLE_FORBIDDEN');
    const snapshot=await quotes.getDraftVersion(actorId,versionId);
    return {buffer:await renderInternalCosting(snapshot),filename:`INTERNAL-${snapshot.versionId}.pdf`};
  };
}
