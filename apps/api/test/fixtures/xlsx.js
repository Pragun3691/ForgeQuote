import { deflateRawSync } from 'node:zlib';

// Independent minimal OOXML/ZIP fixture writer, not the production parser.
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function crc32(bytes) {let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function zip(entries) {
  const local=[],central=[];let offset=0;
  for(const [name,value] of Object.entries(entries)) {
    const filename=Buffer.from(name),data=Buffer.from(value),compressed=deflateRawSync(data),crc=crc32(data);
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);
    local.push(h,filename,compressed);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);central.push(c,filename);offset+=h.length+filename.length+compressed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
export const headers=['Part number','Description','Gross weight (kg)','Annual quantity','Material','Cycle time (min)','Setup hours per batch'];
export const inline=(ref,value)=>`<c r="${ref}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`;
export const numeric=(ref,value,extra='')=>`<c r="${ref}"${extra}><v>${esc(value)}</v></c>`;
export function workbookEntries({rows,header=headers,sheetPath='xl/worksheets/customer.xml',sharedStrings=null}={}) {
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rels='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return {
    '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/${sheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${sharedStrings===null?'':'<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'}</Types>`,
    '_rels/.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="${rels}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${rels}"><sheets><sheet name="Synthetic Parts" sheetId="1" r:id="partsRel"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="partsRel" Type="${rels}/worksheet" Target="${sheetPath.slice(3)}"/>${sharedStrings===null?'':`<Relationship Id="strings" Type="${rels}/sharedStrings" Target="sharedStrings.xml"/>`}</Relationships>`,
    [sheetPath]:`<worksheet xmlns="${ns}"><sheetData><row r="1">${header.map((h,i)=>inline(`${String.fromCharCode(65+i)}1`,h)).join('')}</row>${rows??`<row r="2">${inline('A2','SYNTH-XLSX-A')}${inline('B2','Synthetic spindle')}${numeric('C2','0.610000')}${numeric('D2','180000')}${inline('E2','EN8')}${numeric('F2','3.2')}${numeric('G2','12')}</row>`}</sheetData></worksheet>`,
    ...(sharedStrings===null?{}:{'xl/sharedStrings.xml':`<sst xmlns="${ns}">${sharedStrings.map(s=>`<si><t>${esc(s)}</t></si>`).join('')}</sst>`})
  };
}
export const syntheticWorkbook=options=>zip(workbookEntries(options));
