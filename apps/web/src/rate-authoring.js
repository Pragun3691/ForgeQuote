export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!value.startsWith('0000')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function reasonError(value){return typeof value!=='string'||!value.trim()||value.trim().length>1000||/[\x00-\x1f\x7f]/.test(value)?'Enter 1–1000 characters without control characters (including line breaks).':'';}
export function rateErrors({keyId,value,date,reason},data){
 const errors={},key=data.rateKeys.find(item=>item.id===keyId),latest=key?.versions.map(v=>v.effectiveFrom).sort().at(-1);
 if(!key)errors.keyId='Select an existing internal rate key.';
 if(typeof value!=='string'||!/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value))errors.value='Enter a nonnegative decimal with up to 12 integer and six fractional digits. Zero is allowed.';
 if(!validDate(data.businessDate))errors.date='Server business date unavailable. Refresh rates before saving.';
 else if(!validDate(date))errors.date='Enter a valid YYYY-MM-DD date.';
 else if(date<data.businessDate||(latest&&date<=latest))errors.date=`Use ${data.businessDate} or later (server date, Asia/Kolkata), strictly after ${latest||'the latest recorded start'}.`;
 const note=reasonError(reason);if(note)errors.reason=note;return errors;
}
