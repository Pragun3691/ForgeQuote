import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXlsx } from '../src/imports/xlsx.js';
import { importXlsx } from '../src/imports/worker.js';
import { zip,workbookEntries,syntheticWorkbook,inline,numeric,headers } from './fixtures/xlsx.js';

test('XLSX stored decimals, worksheet relationship and cell evidence are exact',async()=>{
  const result=await parseXlsx(syntheticWorkbook());
  assert.equal(result.worksheet,'Synthetic Parts');assert.equal(result.parts.length,1);
  const weight=result.parts[0].fields.grossWeightKg;
  assert.deepEqual(weight,{rawValue:'0.610000',normalizedValue:'0.61',cell:'C2',headerCell:'C1',header:'Gross weight (kg)',status:'verified'});
  assert.equal(result.parts[0].fields.requestedAnnualQty.normalizedValue,'180000');
});
test('shared strings, sparse rows/cells and reordered columns retain references',async()=>{
  const result=await parseXlsx(syntheticWorkbook({sharedStrings:['SYNTH-B','Synthetic sparse'],header:[headers[3],headers[2],headers[1],headers[0]],rows:`<row r="7">${numeric('A7','1000000000')}${numeric('B7','999999999999.123456')}${numeric('C7','1',' t="s"')}${numeric('D7','0',' t="s"')}</row>`}));
  assert.equal(result.parts[0].row,7);assert.equal(result.parts[0].fields.partNumber.normalizedValue,'SYNTH-B');
  assert.equal(result.parts[0].fields.grossWeightKg.normalizedValue,'999999999999.123456');
  assert.equal(result.parts[0].fields.cycleTimeMin.status,'missing');
});
test('unsupported/ambiguous records fail whole import rather than disappearing',async()=>{
  const cases=[
    {header:[...headers,'Price']},{header:[...headers,headers[0]]},{header:headers.slice(1)},
    {rows:`<row r="2">${inline('A2','ONLY-A')}</row>`},
    {rows:`<row r="2">${inline('A2','A')}${inline('B2','Synthetic')}${numeric('C2','0.1234567')}${numeric('D2','1')}</row>`},
    {rows:`<row r="2">${inline('A2','A')}${inline('B2','Synthetic')}${numeric('C2','1e-3')}${numeric('D2','1')}</row>`},
    {rows:`<row r="2">${inline('A2','A')}${inline('B2','Synthetic')}<c r="C2"><f>1/2</f><v>0.5</v></c>${numeric('D2','1')}</row>`}
  ];
  for(const options of cases)await assert.rejects(parseXlsx(syntheticWorkbook(options)),{code:'XLSX_INVALID'});
});
test('unsafe structures, hidden data, bad references and encrypted/non-XLSX input reject',async()=>{
  for(const mutate of [
    e=>{e['xl/worksheets/customer.xml']=e['xl/worksheets/customer.xml'].replace('<row r="2">','<row r="2" hidden="1">');},
    e=>{e['xl/worksheets/customer.xml']=e['xl/worksheets/customer.xml'].replace('</worksheet>','<mergeCells><mergeCell ref="A1:B1"/></mergeCells></worksheet>');},
    e=>{e['xl/worksheets/customer.xml']=e['xl/worksheets/customer.xml'].replace('r="C2"','r="C3"');},
    e=>{e['xl/workbook.xml']='<!DOCTYPE x [<!ENTITY bad SYSTEM "file:///secret">]>'+e['xl/workbook.xml'];},
    e=>{e['xl/_rels/workbook.xml.rels']=e['xl/_rels/workbook.xml.rels'].replace('Target="worksheets/customer.xml"','Target="https://example.invalid/data" TargetMode="External"');},
    e=>{e['xl/vbaProject.bin']='macro';},
    e=>{e['xl/worksheets/customer.xml']=e['xl/worksheets/customer.xml'].replace('<v>180000</v>','<v>not-a-count</v>');}
  ]){const entries=workbookEntries();mutate(entries);await assert.rejects(parseXlsx(zip(entries)),{code:'XLSX_INVALID'});}
  await assert.rejects(parseXlsx(Buffer.from('not a workbook')),{code:'XLSX_INVALID'});
});
test('part count, duplicate parts and archive/worker bounds are enforced',async()=>{
  const row=i=>`<row r="${i+2}">${inline(`A${i+2}`,`PART-${i}`)}${inline(`B${i+2}`,'Synthetic')}${numeric(`C${i+2}`,'0.61')}${numeric(`D${i+2}`,'1')}</row>`;
  assert.equal((await parseXlsx(syntheticWorkbook({rows:Array.from({length:20},(_,i)=>row(i)).join('')}))).parts.length,20);
  await assert.rejects(parseXlsx(syntheticWorkbook({rows:Array.from({length:21},(_,i)=>row(i)).join('')})),{code:'XLSX_INVALID'});
  await assert.rejects(parseXlsx(syntheticWorkbook({rows:row(0)+row(1).replace('PART-1','PART-0')})),{code:'XLSX_INVALID'});
  const entries=workbookEntries();entries['padding.xml']='x'.repeat(21*1024*1024);
  await assert.rejects(parseXlsx(zip(entries)),{code:'XLSX_LIMIT'});
  await assert.rejects(importXlsx(syntheticWorkbook(),{timeoutMs:1}),{code:'XLSX_TIMEOUT'});
  const controller=new AbortController();controller.abort();await assert.rejects(importXlsx(syntheticWorkbook(),{signal:controller.signal}),{code:'XLSX_CANCELLED'});
  assert.equal((await importXlsx(syntheticWorkbook())).parts.length,1);
});
test('sparse columns, rich strings and General typography are supported; numeric formats are rejected',async()=>{
  const e=workbookEntries();
  e['xl/worksheets/customer.xml']=e['xl/worksheets/customer.xml'].replace(/r="([A-G])(\d+)"/g,(_,col,row)=>`r="${{A:'A',B:'C',C:'G',D:'J',E:'L',F:'P',G:'Q'}[col]}${row}"`);
  const sparse=await parseXlsx(zip(e));assert.equal(sparse.parts[0].fields.grossWeightKg.cell,'G2');assert.equal(sparse.parts[0].fields.requestedAnnualQty.cell,'J2');
  const rich=workbookEntries();rich['xl/worksheets/customer.xml']=rich['xl/worksheets/customer.xml'].replace('<t>Synthetic spindle</t>','<r><t>Synthetic </t></r><r><t>spindle</t></r>');assert.equal((await parseXlsx(zip(rich))).parts[0].fields.description.normalizedValue,'Synthetic spindle');
  const styled=workbookEntries();styled['xl/_rels/workbook.xml.rels']=styled['xl/_rels/workbook.xml.rels'].replace('</Relationships>','<Relationship Id="style" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  styled['xl/styles.xml']='<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
  assert.equal((await parseXlsx(zip(styled))).parts.length,1);
  styled['xl/worksheets/customer.xml']=styled['xl/worksheets/customer.xml'].replace('r="C2"','r="C2" s="1"');await assert.rejects(parseXlsx(zip(styled)),{code:'XLSX_INVALID'});
});
test('multiple populated/hidden sheets, ZIP entry count, checksum and wrong shared string indexes reject',async()=>{
  for(const mutate of [
    e=>{e['xl/workbook.xml']=e['xl/workbook.xml'].replace('name="Synthetic Parts"','state="hidden" name="Synthetic Parts"');},
    e=>{for(let i=0;i<101;i++)e[`extra${i}.xml`]='x';},
    e=>{e['xl/worksheets/customer.xml']=e['xl/worksheets/customer.xml'].replace('<c r="A2" t="inlineStr"><is><t>SYNTH-XLSX-A</t></is></c>','<c r="A2" t="s"><v>999</v></c>');},
    e=>{e['xl/workbook.xml']=e['xl/workbook.xml'].replace('</sheets>','<sheet name="Other" sheetId="2" r:id="other"/></sheets>');e['xl/_rels/workbook.xml.rels']=e['xl/_rels/workbook.xml.rels'].replace('</Relationships>','<Relationship Id="other" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/other.xml"/></Relationships>');e['xl/worksheets/other.xml']=e['xl/worksheets/customer.xml'];e['[Content_Types].xml']=e['[Content_Types].xml'].replace('</Types>','<Override PartName="/xl/worksheets/other.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');}
  ]){const e=workbookEntries();mutate(e);await assert.rejects(parseXlsx(zip(e)),error=>['XLSX_INVALID','XLSX_LIMIT'].includes(error.code));}
  const corrupt=syntheticWorkbook();const central=corrupt.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));corrupt.writeUInt32LE(0,central+16);await assert.rejects(parseXlsx(corrupt),{code:'XLSX_INVALID'});
  const encrypted=syntheticWorkbook(),directory=encrypted.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));encrypted.writeUInt16LE(1,6);encrypted.writeUInt16LE(1,directory+8);await assert.rejects(parseXlsx(encrypted),{code:'XLSX_INVALID'});
});
