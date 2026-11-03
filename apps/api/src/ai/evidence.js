import Decimal from 'decimal.js';
import { validateDate } from '../quotation-request.js';
import { extractionSchema, headerFields, partFields, missingField } from './schema.js';

const Exact = Decimal.clone({precision:80});
const labels = {
  reference:'(?:rfq(?: reference| number)?|reference)', customerName:'(?:customer(?: name)?|company)', dueDate:'(?:due(?: date)?|quotation due)',
  partNumber:'(?:part(?: number| no\\.?)?|item(?: number)?)', description:'(?:description|part description)', material:'material(?: grade)?',
  grossWeightKg:'gross (?:weight|mass)', requestedAnnualQty:'(?:requested annual quantity|annual quantity|annual qty|annual volume)',
  cycleTimeMin:'(?:cycle time|machining cycle time)', setupHoursPerBatch:'(?:setup hours(?: per batch)?|setup time(?: per batch)?)'
};
const linePattern = name => new RegExp(`^\\s*${labels[name]}(?:\\s*\\(([^)]+)\\))?\\s*:\\s*(.+?)\\s*$`,'i');
function parseLine(name,line) {
  const match = linePattern(name).exec(line.text);
  return match ? {raw:match[2],unit:match[1] || (name==='setupHoursPerBatch' && /^\s*setup hours/i.test(line.text) ? 'hours' : ''),line} : null;
}
export function sourceSections(source) {
  let offset=0;
  const lines=source.split('\n').map((text,index)=>{
    const line={text:text.replace(/\r$/,''),start:offset,end:offset+text.replace(/\r$/,'').length,number:index+1};
    offset+=text.length+1;return line;
  });
  const starts=[];
  for(const line of lines) {
    const numbered=/^\s*Part\s+([1-9]\d{0,2})\s*:\s*$/i.exec(line.text);
    const legacy=/^\s*(?:Part|Item)\s*:\s*\S/i.test(line.text);
    // Within an explicit heading, Part Number is metadata, never another component.
    if(numbered || legacy || (parseLine('partNumber',line) && (!starts.length || starts.at(-1).kind==='identifier'))) {
      starts.push({...line,kind:numbered?'numbered':legacy?'legacy':'identifier',ordinal:numbered?.[1]});
    }
  }
  const sections=starts.map((line,index)=>{
    const scopeLines=lines.filter(candidate=>candidate.start>=line.start && candidate.start<(starts[index+1]?.start ?? source.length));
    const identifiers=scopeLines.map(candidate=>parseLine('partNumber',candidate)).filter(Boolean);
    const values=[...new Set(identifiers.map(candidate=>candidate.raw))];
    const metadata=line.kind==='legacy'?identifiers.slice(1):identifiers;
    return {anchor:line.text.trim(),index,start:line.start,end:starts[index+1]?.start ?? source.length,lines:scopeLines,
      aliases:[line.text.trim(),...identifiers.map(candidate=>candidate.line.text.trim())],
      identifier:values.length===1?values[0]:null,ordinal:line.ordinal,
      ambiguous:values.length>1 || metadata.length>1};
  });
  for(const section of sections) {
    if((section.identifier && sections.filter(s=>s.identifier===section.identifier).length>1) ||
      (section.ordinal && sections.filter(s=>s.ordinal===section.ordinal).length>1))section.ambiguous=true;
  }
  return {header:{start:0,end:starts[0]?.start ?? source.length,lines:lines.filter(line=>line.start<(starts[0]?.start ?? source.length))},sections,lines};
}
const issue = (reason,status='unsupported') => ({value:null,reason,status});
function normalize(name,raw,unit='') {
  if (['reference','customerName','partNumber','description','material'].includes(name)) {
    const max={reference:80,customerName:160,partNumber:80,description:500,material:160}[name];
    if (!raw.trim() || raw.length>max || /[\u0000-\u001f\u007f]/.test(raw)) return issue('Text does not meet the manual field limits.');
    return {value:raw.trim()};
  }
  if (name==='dueDate') {
    let value=raw;
    const named=/^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})$/i.exec(raw);
    if (named) value=`${named[3]}-${String(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[2].slice(0,3).toLowerCase())+1).padStart(2,'0')}-${named[1].padStart(2,'0')}`;
    try {return {value:validateDate(value)};} catch {return issue('Date needs an unambiguous YYYY-MM-DD or day named-month year.','ambiguous');}
  }
  // The whole raw value must be one complete numeric token plus an explicit unit.
  // No substring matching: 61 is not accepted as evidence for 610 or 0.610.
  const match=/^((?:0|[1-9]\d{0,11}|[1-9]\d{0,2}(?:,\d{3}){1,3})(?:\.\d{1,6})?)\s*([a-zA-Z/ ]*)$/.exec(raw);
  if (!match) return issue('Expected one complete numeric value; ranges, alternatives and malformed numbers need manual resolution.','ambiguous');
  const inlineUnit=match[2].trim().toLowerCase(), labelUnit=unit.trim().toLowerCase();
  const units={
    grossWeightKg:{kg:'1',kilogram:'1',kilograms:'1',g:'0.001',gram:'0.001',grams:'0.001'},
    cycleTimeMin:{min:'1',minute:'1',minutes:'1',s:'1/60',sec:'1/60',second:'1/60',seconds:'1/60',h:'60',hour:'60',hours:'60'},
    setupHoursPerBatch:{h:'1',hr:'1',hour:'1',hours:'1',min:'1/60',minute:'1/60',minutes:'1/60',s:'1/3600',sec:'1/3600',second:'1/3600',seconds:'1/3600'}
  };
  const n=new Exact(match[1].replaceAll(',',''));
  if (name==='requestedAnnualQty') {
    const allowed=['','pcs','pieces','units','pcs/year','pieces/year','units/year','per year'];
    if (![inlineUnit,labelUnit].every(value=>allowed.includes(value))) return issue('Quantity unit is unsupported; use explicitly annual pieces/units.','ambiguous');
    if (!n.isInteger() || n.lt(1) || n.gt('1000000000')) return issue('Annual quantity must be an integer from 1 to 1000000000.');
    return {value:n.toFixed(0)};
  }
  const table=units[name], factor=table[inlineUnit || labelUnit];
  if (!factor) return issue('Missing or unsupported unit; confirm it manually.','ambiguous');
  if (inlineUnit && labelUnit && table[inlineUnit]!==table[labelUnit]) return issue('Unit in label contradicts the value unit.','ambiguous');
  const divisor=factor.startsWith('1/') ? factor.slice(2) : null;
  const value=divisor ? n.div(divisor) : n.mul(factor);
  if (value.decimalPlaces()>6 || (divisor && !value.mul(divisor).eq(n))) return issue('Conversion is not exact within six decimal places; resolve manually.');
  if (value.gt('999999999999.999999') || value.lt(0) || (name!=='setupHoursPerBatch' && value.isZero())) return issue('Normalized value is outside the manual field bounds.');
  return {value:value.toFixed()};
}
function locations(source,quote,scope,lines) {
  const all=[];let index=source.indexOf(quote);
  while(index!==-1) {
    if(index>=scope.start && index+quote.length<=scope.end) all.push(index);
    index=source.indexOf(quote,index+1);
  }
  if (all.length!==1) return {quote,start:null,end:null,lineStart:null,lineEnd:null,found:source.includes(quote),inScope:false};
  const start=all[0],end=start+quote.length;
  return {quote,start,end,lineStart:lines.findLast(line=>line.start<=start)?.number,lineEnd:lines.findLast(line=>line.start<end)?.number,found:true,inScope:true};
}
function verifyField(source,name,field,scope,lines,association=true) {
  const evidence=field.evidence.map(quote=>locations(source,quote,scope,lines));
  const result={rawValue:field.rawValue,normalizedValue:null,status:'unsupported',evidence,issues:[]};
  const reject=(message,status='unsupported')=>({...result,status,issues:[message]});
  if (!association) return reject('Part association is not a unique explicit part header in the source.');
  if(scope.lines.some(line=>/\b(?:correction|revised|amended|instead|alternatively|actually|supersedes|not final|tbd|to be confirmed)\b/i.test(line.text))) return reject('This section contains revision or uncertainty language; resolve its fields manually.','ambiguous');
  const candidates=scope.lines.map(line=>parseLine(name,line)).filter(Boolean);
  const normalized=candidates.map(candidate=>normalize(name,candidate.raw,candidate.unit));
  if (candidates.length>1 && (normalized.some(value=>value.value===null) || new Set(normalized.map(value=>value.value)).size>1)) return reject('Contradictory or unresolved labeled values in this source section.','ambiguous');
  if(field.status==='missing' && field.rawValue===null && evidence.length===0) return reject(candidates.length?'Model omitted a field present in the source; fill it manually.':'No supported value supplied.','missing');
  if(field.status==='ambiguous') return reject('Model marked this field ambiguous; resolve it manually.','ambiguous');
  if(field.status!=='present' || !field.rawValue || !evidence.length) return reject('Present fields require a raw value and exact source evidence.');
  if(evidence.some(item=>!item.found || !item.inScope)) return reject('Evidence is absent, repeated, or outside the correct RFQ/part section.');
  const supported=candidates.find(candidate=>candidate.raw===field.rawValue && evidence.some(item=>
    item.start>=candidate.line.start && item.end<=candidate.line.end && item.quote.includes(field.rawValue)));
  if(!supported) return reject('Raw value is not the complete value of a matching labeled source line in this section.');
  if(name==='setupHoursPerBatch' && !/\bper batch\b/i.test(supported.line.text)) return reject('Setup time must be explicitly per batch; confirm the basis manually.','ambiguous');
  const value=normalize(name,supported.raw,supported.unit);
  if(value.value===null) return reject(value.reason,value.status);
  return {...result,status:'verified',normalizedValue:value.value};
}

export function verifyExtraction(source,untrusted) {
  const parsed=extractionSchema.safeParse(untrusted);
  if(!parsed.success) throw Object.assign(Error('Gemini returned an invalid structured response. Continue manually or try extraction again.'),{code:'AI_INVALID_RESPONSE'});
  const data=parsed.data,{header,sections,lines}=sourceSections(source);
  const warnings=[],proposals=sections.map(()=>[]);
  data.parts.forEach((part,index)=>{
    const anchors=sections.filter(section=>section.aliases.includes(part.anchor));
    // A fallback requires complete part-number value + unique verbatim evidence in its section.
    const identifiers=sections.filter(section=>section.identifier && verifyField(source,'partNumber',part.fields.partNumber,section,lines).status==='verified');
    const section=anchors.length===1?anchors[0]:anchors.length===0&&identifiers.length===1?identifiers[0]:null;
    if(!section){warnings.push(`Unmatched model proposal ${index+1} (anchor: ${part.anchor}; part number: ${part.fields.partNumber.rawValue ?? 'missing'}) was not applied. Review the source manually.`);return;}
    const conflict=identifiers.some(s=>s.index!==section.index) || (section.identifier && part.fields.partNumber.status==='present' && part.fields.partNumber.rawValue!==section.identifier);
    proposals[section.index].push({part,conflict});
    if(conflict)warnings.push(`Model proposal ${index+1} conflicts with the identifier of source part ${section.index+1}. Its fields require manual review.`);
  });
  // Source sections own cardinality/order. Model proposals cannot manufacture form rows.
  const parts=sections.map(section=>{
    const candidates=proposals[section.index],duplicate=candidates.length>1;
    const association=!section.ambiguous&&!duplicate&&!candidates[0]?.conflict;
    const reason=section.ambiguous?'Source section has ambiguous or duplicate part identifiers/headings; resolve manually.':duplicate?'Multiple model proposals target this source part; no values were merged or selected. Review manually.':candidates[0]?.conflict?'Model part identifier conflicts with its source section; resolve manually.':null;
    if(reason)warnings.push(`Source part ${section.index+1}: ${reason}`);
    return {anchor:section.anchor,sourcePartIndex:section.index,fields:Object.fromEntries(partFields.map(name=>{
      const field=candidates.length===1?candidates[0].part.fields[name]:missingField();
      const verified=verifyField(source,name,field,section,lines,association);
      return [name,reason?{...verified,status:'ambiguous',normalizedValue:null,issues:[reason]}:!candidates.length?{...verified,issues:['Model omitted this source part; fill its fields manually.']}:verified];
    }))};
  });
  if(parts.length>20) throw Object.assign(Error('Part associations could not be reconciled within the 20-part limit. Continue manually.'),{code:'AI_INVALID_RESPONSE'});
  return {rfq:Object.fromEntries(headerFields.map(name=>[name,verifyField(source,name,data.rfq[name],header,lines)])),parts,
    warnings:[...warnings,...(!sections.length?['No supported numbered Part, Part:, Part number: or Item: sections found. Enter parts manually.']:[]),
      'Verified means literal support under the documented label/unit rules, not approval or proof the customer facts are correct.',
      'Internal rate keys, missing manufacturing inputs and prices are never inferred. Review every field before saving.']};
}
