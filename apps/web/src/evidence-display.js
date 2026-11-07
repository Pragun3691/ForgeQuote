// The server verifier uses String#indexOf/length: zero-based UTF-16 offsets,
// end exclusive, matching JavaScript slice. Never search for a replacement span.
export function evidenceSlice(source,item) {
  if(typeof source!=='string' || !item || item.found!==true || item.inScope!==true ||
    typeof item.quote!=='string' || !item.quote || !Number.isInteger(item.start) || !Number.isInteger(item.end) ||
    item.start<0 || item.end<=item.start || item.end>source.length || source.slice(item.start,item.end)!==item.quote) return null;
  return {before:source.slice(0,item.start),quote:source.slice(item.start,item.end),after:source.slice(item.end)};
}
