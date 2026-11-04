import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { inputError } from './quotation-request.js';
import { openSync } from 'fontkit';

const regular = fileURLToPath(new URL('../assets/fonts/NotoSans-Regular.ttf', import.meta.url));
const bold = fileURLToPath(new URL('../assets/fonts/NotoSans-Bold.ttf', import.meta.url));
const teal = '#17665e', ink = '#213331', muted = '#5b706a';
const left = 42, width = 511.28, bottom = 766;
const columns = [22,181,62,115,131.28];
let glyphFonts;
const invalid = () => { throw inputError('Saved quotation cannot be rendered safely. Contact the estimator.', 'PDF_INVALID_SNAPSHOT'); };

// Formatting only: retain saved paise exactly; no Number conversion or pricing.
export function pdfMoney(value) {
  if (typeof value !== 'string' || !/^\d+\.\d{2}$/.test(value)) invalid();
  const [whole, fraction] = value.split('.');
  const grouped = whole.length > 3 ? `${whole.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${whole.slice(-3)}` : whole;
  return `₹${grouped}.${fraction}`;
}
const text = value => {
  if (typeof value !== 'string' || !value.length || value.length > 2000) invalid();
  const cleaned=value.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ');
  glyphFonts ||= [openSync(regular),openSync(bold)];
  for(const character of cleaned) {
    if(character!=='\n' && !glyphFonts.every(font=>font.hasGlyphForCodePoint(character.codePointAt(0))))
      throw inputError('This quotation contains characters not supported by the PDF fonts. Contact the estimator.', 'PDF_UNSUPPORTED_TEXT');
  }
  return cleaned;
};
function issuedDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) invalid();
  return new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'}).format(date);
}

/** Customer-only DTO. No attachments, snapshot serialization or live lookups. */
export async function renderCustomerQuotation(data) {
  if (data.scenarios.length !== 3 || !data.scenarios.every(s => s.lines.length >= 1 && s.lines.length <= 20)) invalid();
  const date = new Date(data.issuedAt);
  const doc = new PDFDocument({size:'A4',margin:42,bufferPages:true,autoFirstPage:false,
    info:{Title:`Customer quotation ${text(data.quotationNumber)}`,Author:'ForgeQuote',
      Subject:`Issued quotation - version ${text(data.versionId)}`,CreationDate:date,ModDate:date}});
  const chunks=[];
  let bytes=0;
  const completed = new Promise((resolve,reject) => {
    doc.on('data',chunk=>{ bytes+=chunk.length; if(bytes>4*1024*1024) doc.destroy(new Error('PDF size limit')); else chunks.push(chunk); });
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.on('error',reject);
  });
  // Attach rejection handling immediately, including synchronous layout errors.
  completed.catch(()=>{});
  try {
    doc.registerFont('Body',regular); doc.registerFont('Bold',bold);
    let y;
    function write(value,x,top,w,{size=9,font='Body',color=ink,align='left'}={}) {
      doc.font(font).fontSize(size).fillColor(color).text(text(value),x,top,{width:w,align,lineGap:2});
    }
    function height(value,w,{size=9,font='Body'}={}) {
      return doc.font(font).fontSize(size).heightOfString(text(value),{width:w,lineGap:2});
    }
    function page(first=false) {
      if(doc.bufferedPageRange().count>=40) invalid();
      doc.addPage();
      write('ForgeQuote',left,34,200,{size:20,font:'Bold',color:teal});
      write('ISSUED CUSTOMER QUOTATION',300,40,253,{size:9,font:'Bold',color:teal,align:'right'});
      doc.moveTo(left,70).lineTo(left+width,70).lineWidth(1).strokeColor('#dce5e2').stroke();
      write(data.quotationNumber,left,79,width,{size:9,font:'Bold'});
      y=104;
      if(first) {
        write('PREPARED FOR',left,y,width,{size:8,font:'Bold',color:muted});y+=16;
        write(data.customerName,left,y,width,{size:14,font:'Bold'});y+=height(data.customerName,width,{size:14,font:'Bold'})+13;
        const fields=[`RFQ reference: ${text(data.rfqReference)}`,`Issue date: ${issuedDate(data.issuedAt)} (IST)    |    Pricing date: ${text(data.pricingDate)}`,
          `Quotation version: ${text(data.versionNumber)}`];
        for(const value of fields) {write(value,left,y,width);y+=height(value,width)+5;}
        y+=12;
        write('Annual volume alternatives',left,y,width,{size:12,font:'Bold'});y+=22;
        write('Each scenario is a separate annual quantity option. All prices are in INR.',left,y,width,{size:8,color:muted});y+=26;
      }
    }
    function tableHeader(scenario,continued=false) {
      write(`${scenario}% quantity scenario${scenario==='100'?' - baseline':''}${continued?' (continued)':''}`,left,y,width,{size:11,font:'Bold',color:teal});y+=24;
      doc.rect(left,y,width,34).fill('#e8f3ef');
      const labels=['#','Component / description','Annual qty','Unit price\nexcluding GST','Line total\nexcluding GST'];
      let x=left;
      labels.forEach((label,i)=>{write(label,x+7,y+6,columns[i]-14,{size:8,font:'Bold',align:i>1?'right':'left'});x+=columns[i];});
      y+=34;
    }
    function lineCells(line,index) {
      if(!/^[1-9]\d*$/.test(line.quantity)) invalid();
      return [String(index+1),`${text(line.partNumber)}\n${text(line.description)}`,line.quantity,pdfMoney(line.unitPrice),pdfMoney(line.lineTotal)];
    }
    const rowHeightFor = cells => Math.max(36,...cells.map((cell,i)=>height(cell,columns[i]-14)+16));
    page(true);
    for(const [scenarioIndex,scenario] of data.scenarios.entries()) {
      if(scenario.scenario!==['50','100','150'][scenarioIndex]) invalid();
      // Keep each scenario heading with at least its first row.
      if(y+58+rowHeightFor(lineCells(scenario.lines[0],0))>bottom) page();
      tableHeader(scenario.scenario);
      for(const [index,line] of scenario.lines.entries()) {
        const cells=lineCells(line,index);
        const rowHeight=rowHeightFor(cells);
        if(rowHeight>580) invalid();
        if(y+rowHeight>bottom) {page();tableHeader(scenario.scenario,true);}
        if(index%2===0) doc.rect(left,y,width,rowHeight).fill('#f6f8f7');
        let x=left;
        cells.forEach((cell,i)=>{write(cell,x+7,y+8,columns[i]-14,{align:i>1?'right':'left'});x+=columns[i];});
        y+=rowHeight;
        doc.moveTo(left,y).lineTo(left+width,y).lineWidth(.4).strokeColor('#dce5e2').stroke();
      }
      const rows=[['Subtotal excluding GST',pdfMoney(scenario.subtotal)],
        [`Illustrative GST (${text(data.gstPercent).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1')}%)`,pdfMoney(scenario.gstAmount)],
        ['Total including GST',pdfMoney(scenario.total)]];
      const totalsHeight=rows.reduce((sum,row)=>sum+Math.max(29,height(row[1],217,{size:10,font:'Bold'})+14),0);
      if(y+totalsHeight+14>bottom) {page();write(`${scenario.scenario}% scenario - totals`,left,y,width,{size:11,font:'Bold',color:teal});y+=26;}
      y+=10;
      for(const [index,[label,value]] of rows.entries()) {
        const h=Math.max(29,height(value,217,{size:10,font:'Bold'})+14);
        if(index===2) doc.rect(left,y,width,h).fill('#e8f3ef');
        write(label,left+8,y+7,270,{size:9,font:index===2?'Bold':'Body'});
        write(value,left+286,y+7,217,{size:10,font:'Bold',align:'right'});y+=h;
      }
      y+=26;
    }
    if(y+35>bottom) page();
    write('GST is illustrative; tax classification is not provided. The three scenarios are alternatives, not cumulative quantities.',left,y,width,{size:8,color:muted});
    const range=doc.bufferedPageRange();
    for(let i=0;i<range.count;i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom=0; // Footer is outside the body flow; never create a page while numbering.
      doc.moveTo(left,785).lineTo(left+width,785).lineWidth(.4).strokeColor('#dce5e2').stroke();
      write(`Version ID: ${data.versionId}`,left,793,410,{size:7,color:muted});
      write(`Page ${i+1} of ${range.count}`,462,793,91,{size:7,color:muted,align:'right'});
    }
    doc.end();
    return await completed;
  } catch(error) {doc.destroy();throw error;}
}
