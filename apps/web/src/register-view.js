const statuses=['estimating','sent','won','lost'];
const sorts=['due','due-desc','reference','customer'];
export function readListView(hash='',approvals=false) {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  if(approvals)return {q:params.get('aq')||'',sort:['server','reference','version'].includes(params.get('asort'))?params.get('asort'):'server'};
  return {q:params.get('q')||'',status:statuses.includes(params.get('status'))?params.get('status'):'all',estimator:params.get('estimator')||'all',sort:sorts.includes(params.get('sort'))?params.get('sort'):'due'};
}
export function listHash(hash,patch) {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  for(const [key,value] of Object.entries(patch)) {
    if(!['q','status','estimator','sort','aq','asort'].includes(key))continue;
    if(!value || value==='all' || (key==='sort'&&value==='due') || (key==='asort'&&value==='server'))params.delete(key);
    else params.set(key,value);
  }
  return `#${params}`;
}
const compare=(a,b)=>String(a??'').localeCompare(String(b??''),'en',{numeric:true});
const matches=(q,...values)=>!q.trim() || values.some(v=>String(v??'').toLowerCase().includes(q.trim().toLowerCase()));
export function filterRfqs(rows,{q='',status='all',estimator='all',sort='due'}={}) {
  return rows.filter(r=>matches(q,r.reference,r.customerName)&&(status==='all'||r.status===status)&&(estimator==='all'||r.assignedEstimator===estimator)).sort((a,b)=>{
    const first=sort==='reference'?compare(a.reference,b.reference):sort==='customer'?compare(a.customerName,b.customerName):compare(a.dueDate,b.dueDate)*(sort==='due-desc'?-1:1);
    return first||compare(a.reference,b.reference)||compare(a.id,b.id);
  });
}
export function filterApprovals(rows,{q='',sort='server'}={}) {
  const result=rows.filter(v=>matches(q,v.rfq.reference,v.rfq.customer_name));
  if(sort==='server')return result;
  return result.sort((a,b)=>(sort==='version'?compare(b.versionNumber,a.versionNumber):compare(a.rfq.reference,b.rfq.reference))||compare(a.versionId,b.versionId));
}
