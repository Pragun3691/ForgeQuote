import {useMemo,useRef,useSyncExternalStore} from 'react';

export function parseRoute(hash='',role) {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const view=params.get('view');
  if(view==='rates')return {view:'rates',section:'rates'};
  if(params.get('rfq'))return {view:'rfq',section:'rfqs',rfqId:params.get('rfq'),versionId:params.get('version')};
  if(view==='intake' && (!role || role==='estimator'))return {view:'intake',section:'rfqs'};
  if(params.has('approvals') && (!role || role==='sales_head'))return {view:'approvals',section:'approvals'};
  return {view:'register',section:'rfqs'};
}
const subscribe=notify=>{window.addEventListener('hashchange',notify);return()=>window.removeEventListener('hashchange',notify);};
export function useRoute(role) {
  const hash=useSyncExternalStore(subscribe,()=>window.location.hash);
  return useMemo(()=>parseRoute(hash,role),[hash,role]);
}
export function navigate(hash,{replace=false}={}) {
  if(replace){window.history.replaceState(null,'',window.location.pathname+window.location.search+hash);window.dispatchEvent(new HashChangeEvent('hashchange'));}
  else window.location.hash=hash;
}
export function useListDestinations(user,route) {
  const ref=useRef(null),identity=user?user.id+':'+user.role:null;
  if(!ref.current||ref.current.identity!==identity)ref.current={identity,rfqs:'#',approvals:'#approvals',back:'#'};
  if(identity&&route.view==='register'){ref.current.rfqs=window.location.hash||'#';ref.current.back=ref.current.rfqs;}
  if(identity&&route.view==='approvals'){ref.current.approvals=window.location.hash||'#approvals';ref.current.back=ref.current.approvals;}
  return {...ref.current};
}
