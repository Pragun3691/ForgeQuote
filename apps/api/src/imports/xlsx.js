import yauzl from 'yauzl';
import { SaxesParser } from 'saxes';
import { crc32 } from 'node:zlib';
import path from 'node:path';

export const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_UPLOAD=2*1024*1024;
const MAX_EXPANDED=20*1024*1024;
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/package/2006/relationships';
const DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT='http://schemas.openxmlformats.org/package/2006/content-types';
const messages={XLSX_INVALID:'Unsupported or invalid XLSX. Use the documented plain part-list template; formulas, hidden data and ambiguous values are not supported.',XLSX_LIMIT:'Workbook exceeds import limits. Use at most 20 parts, 100 rows, 32 columns and a 2 MiB file.',XLSX_TIMEOUT:'Workbook parsing timed out. Continue manually or use a smaller template.',XLSX_CANCELLED:'Workbook import was interrupted. No RFQ was saved.'};
export const importError=(code='XLSX_INVALID')=>Object.assign(Error(messages[code]||messages.XLSX_INVALID),{code});
const check=(ok,code)=>{if(!ok)throw importError(code);};

async function unzip(buffer) {
  check(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=MAX_UPLOAD,buffer?.length>MAX_UPLOAD?'XLSX_LIMIT':'XLSX_INVALID');
  check(buffer.readUInt16LE(0)===0x4b50);
  return new Promise((resolve,reject)=>{
    yauzl.fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
      if(error)return reject(importError());
      const files=new Map();let total=0,entries=0,settled=false;
      const fail=e=>{if(settled)return;settled=true;zip.close();reject(e?.code?.startsWith('XLSX_')?e:importError());};
      zip.on('error',fail);zip.on('end',()=>{if(!settled){settled=true;resolve(files);}});
      zip.on('entry',entry=>{
        try {
          check(++entries<=100,'XLSX_LIMIT');
          const name=entry.fileName;
          check(!files.has(name)&&!/\\|[\u0000-\u001f]|(^|\/)\.\.?($|\/)|^\//.test(name));
          check(!(entry.generalPurposeBitFlag&1)&&[0,8].includes(entry.compressionMethod));
          check(!/\.bin$|vba|externalLinks\/|embeddings\//i.test(name));
          check(entry.uncompressedSize<=MAX_EXPANDED-total,'XLSX_LIMIT');
          if(name.endsWith('/')){zip.readEntry();return;}
          zip.openReadStream(entry,(err,stream)=>{
            if(err)return fail(err);
            const chunks=[];let size=0;
            stream.on('error',fail);
            stream.on('data',chunk=>{
              size+=chunk.length;total+=chunk.length;
              if(total>MAX_EXPANDED){stream.destroy();fail(importError('XLSX_LIMIT'));return;}
              chunks.push(chunk);
            });
            stream.on('end',()=>{
              if(settled)return;
              const bytes=Buffer.concat(chunks);
              if(size!==entry.uncompressedSize||crc32(bytes)!==entry.crc32)return fail(importError());
              files.set(name,bytes);zip.readEntry();
            });
          });
        } catch(e){fail(e);}
      });zip.readEntry();
    });
  });
}

function xml(bytes) {
  check(bytes);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  check(!/<!DOCTYPE|<!ENTITY/i.test(text));
  const parser=new SaxesParser({xmlns:true}),stack=[];let root,nodes=0;
  parser.on('opentag',tag=>{
    check(++nodes<=20000&&stack.length<24,'XLSX_LIMIT');
    const node={name:tag.local,ns:tag.uri,attrs:tag.attributes,children:[],text:''};
    if(stack.length)stack.at(-1).children.push(node);else {check(!root);root=node;}stack.push(node);
  });
  parser.on('text',value=>{if(stack.length){stack.at(-1).text+=value;check(stack.at(-1).text.length<=32768,'XLSX_LIMIT');}});
  parser.on('cdata',()=>{throw importError();});
  parser.on('closetag',()=>stack.pop());
  parser.write(text).close();check(root);return root;
}
const attr=(node,name)=>node?.attrs[name]?.value;
const children=(node,name)=>node.children.filter(c=>c.name===name&&c.ns===node.ns);
function single(node,name,required=true){const found=children(node,name);check(found.length<2&&(!required||found.length===1));return found[0];}
function rootXml(files,name,local,namespace){const root=xml(files.get(name));check(root.name===local&&root.ns===namespace);return root;}
function resolveTarget(base,target) {
  check(typeof target==='string'&&target.length<256&&!/[\\:%?#\u0000-\u001f]/.test(target));
  const name=path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join(path.posix.dirname(base),target));
  check(!name.startsWith('../')&&!name.startsWith('/')&&name!=='.');return name;
}
function relationships(files,name,base) {
  const result=new Map();
  const root=rootXml(files,name,'Relationships',REL);
  for(const node of root.children){check(node.ns===REL&&node.name==='Relationship');
    const id=attr(node,'Id'),type=attr(node,'Type');check(id&&!result.has(id)&&type&&attr(node,'TargetMode')!=='External');
    result.set(id,{type,target:resolveTarget(base,attr(node,'Target'))});
  }return result;
}
function stringText(node) {
  check(!children(node,'rPh').length);
  const direct=children(node,'t'),runs=children(node,'r');check(!(direct.length&&runs.length)&&direct.length<=1);
  const value=direct.length?direct[0].text:runs.map(r=>{const t=single(r,'t');return t.text;}).join('');
  check(value.length<=500);return value;
}
const columns=new Map([
  ['part number',['partNumber',80]],['description',['description',500]],['gross weight (kg)',['grossWeightKg']],
  ['annual quantity',['requestedAnnualQty']],['material',['material',160]],['cycle time (min)',['cycleTimeMin']],['setup hours per batch',['setupHoursPerBatch']]
]);
const required=['partNumber','description','grossWeightKg','requestedAnnualQty'];
function valueOf(cell,strings) {
  check(!children(cell,'f').length);const type=attr(cell,'t')||'n';
  const v=single(cell,'v',false),is=single(cell,'is',false);check(!(v&&is));
  if(type==='inlineStr'){check(is&&!v);return {value:stringText(is),type:'text'};}
  if(!v){check(!is);return {value:'',type:'blank'};}
  if(type==='s'){check(/^\d{1,6}$/.test(v.text));const value=strings[Number(v.text)];check(value!==undefined);return {value,type:'text'};}
  check(type==='n'&&!is);return {value:v.text,type:'number'};
}
function readSheet(root,strings,styles) {
  check(!children(root,'mergeCells').length&&!children(root,'autoFilter').length&&!children(root,'sheetProtection').length);
  check(!['1','true'].includes(attr(single(root,'sheetFormatPr',false),'zeroHeight')));
  for(const col of children(root,'cols').flatMap(c=>children(c,'col'))){check(!['1','true'].includes(attr(col,'hidden')));check(!attr(col,'style')||attr(col,'style')==='0');}
  const data=single(root,'sheetData'),rows=new Map();let previous=0;
  for(const row of data.children){check(row.ns===NS&&row.name==='row');const rn=attr(row,'r');check(/^[1-9]\d{0,2}$/.test(rn));const number=Number(rn);
    check(number>previous&&number<=100,'XLSX_LIMIT');previous=number;check(!['1','true'].includes(attr(row,'hidden')));check(!attr(row,'s')||attr(row,'s')==='0');
    const cells=new Map();let lastCol=0;
    for(const c of row.children){check(c.ns===NS&&c.name==='c');const ref=attr(c,'r'),match=/^([A-Z]{1,2})([1-9]\d{0,2})$/.exec(ref||'');check(match&&match[2]===rn);
      const index=[...match[1]].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);check(index>lastCol&&index<=32,'XLSX_LIMIT');lastCol=index;
      const value=valueOf(c,strings);
      // Typography is harmless; reject numeric styles that change displayed meaning.
      const style=attr(c,'s')||'0';check(/^\d{1,4}$/.test(style));
      check(Number(style)<styles.length);
      if(value.type==='number')check(styles[Number(style)]==='0');
      cells.set(index,{...value,ref});
    }rows.set(number,cells);
  }return rows;
}
function normalize(value,name,max) {
  check(!/[\u0000-\u001f\u007f]/.test(value));
  if(max){check(value.trim().length>0&&value.length<=max);return value.trim();}
  check(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value));
  const normalized=value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;
  if(name==='requestedAnnualQty')check(/^[1-9]\d{0,9}$/.test(normalized)&&BigInt(normalized)<=1000000000n);
  else if(name!=='setupHoursPerBatch')check(/[1-9]/.test(normalized));
  return normalized;
}

export async function parseXlsx(buffer) {
  try {
    const files=await unzip(buffer);
    // Reject external relations anywhere, even outside the selected worksheet.
    for(const name of files.keys())if(name.endsWith('.rels'))relationships(files,name,name.replace(/_rels\/([^/]+)\.rels$/,'$1'));
    const types=rootXml(files,'[Content_Types].xml','Types',CT);
    const overrides=new Map();for(const n of children(types,'Override')){const name=attr(n,'PartName');check(!overrides.has(name));overrides.set(name,attr(n,'ContentType'));}
    check([...overrides.values()].every(t=>typeof t==='string'&&!/macroEnabled|vbaProject|oleObject/i.test(t)));
    const office=[...relationships(files,'_rels/.rels','').values()].filter(r=>r.type===`${DOCREL}/officeDocument`);check(office.length===1);
    const workbookPath=office[0].target;check(overrides.get('/'+workbookPath)===`${XLSX_MIME}.main+xml`);
    const wb=rootXml(files,workbookPath,'workbook',NS),sheetNodes=children(single(wb,'sheets'),'sheet');check(sheetNodes.length>0&&sheetNodes.length<=5);
    const relPath=path.posix.join(path.posix.dirname(workbookPath),'_rels',path.posix.basename(workbookPath)+'.rels');
    const rels=relationships(files,relPath,workbookPath);
    const stringRel=[...rels.values()].filter(r=>r.type===`${DOCREL}/sharedStrings`);check(stringRel.length<=1);
    const strings=stringRel.length?children(rootXml(files,stringRel[0].target,'sst',NS),'si').map(stringText):[];
    const styleRel=[...rels.values()].filter(r=>r.type===`${DOCREL}/styles`);check(styleRel.length<=1);
    const styles=styleRel.length?children(single(rootXml(files,styleRel[0].target,'styleSheet',NS),'cellXfs'),'xf').map(n=>attr(n,'numFmtId')||'0'):['0'];
    const seen=new Set(),names=new Set(),populated=[];
    for(const s of sheetNodes){const name=attr(s,'name'),id=Object.values(s.attrs).find(a=>a.local==='id'&&a.uri===DOCREL)?.value;
      check(name&&name.length<=31&&!names.has(name)&&(!attr(s,'state')||attr(s,'state')==='visible'));names.add(name);
      const relationship=rels.get(id);check(relationship?.type===`${DOCREL}/worksheet`&&!seen.has(relationship.target));seen.add(relationship.target);
      check(overrides.get('/'+relationship.target)==='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
      const rows=readSheet(rootXml(files,relationship.target,'worksheet',NS),strings,styles);
      if([...rows.values()].some(cells=>[...cells.values()].some(c=>c.value!=='')))populated.push({name,rows});
    }
    check(populated.length===1);const {name,rows}=populated[0],header=rows.get(1);check(header);
    const mapping=new Map(),used=new Set();
    for(const [index,c] of header){if(!c.value)continue;check(c.type==='text');const spec=columns.get(c.value.trim().toLowerCase());check(spec&&!used.has(spec[0]));used.add(spec[0]);mapping.set(index,{spec,header:c.value,ref:c.ref});}
    check(required.every(f=>used.has(f)));const parts=[],partNumbers=new Set();
    for(const [row,cells] of rows){if(row===1)continue;if(![...cells.values()].some(c=>c.value!==''))continue;
      check(parts.length<20);for(const [index,c] of cells)check(!c.value||mapping.has(index));
      const fields=Object.fromEntries([...columns.values()].map(([field])=>[field,{status:'missing',rawValue:null,normalizedValue:null,cell:null,headerCell:null,header:null}]));
      for(const [index,{spec:[field,max],header,ref}] of mapping){const cell=cells.get(index);if(!cell?.value){check(!required.includes(field));continue;}
        if(max)check(cell.type==='text');
        fields[field]={status:'verified',rawValue:cell.value,normalizedValue:normalize(cell.value,field,max),cell:cell.ref,headerCell:ref,header};
      }
      check(!partNumbers.has(fields.partNumber.normalizedValue));partNumbers.add(fields.partNumber.normalizedValue);parts.push({row,fields});
    }check(parts.length>0);return {format:'xlsx',worksheet:name,parts};
  } catch(error){if(error?.code?.startsWith('XLSX_'))throw error;throw importError();}
}
