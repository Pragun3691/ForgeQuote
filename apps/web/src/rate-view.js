export const rateCategories=['material','machine','scrap','overhead','packaging','freight'];
export function readRateView(hash=''){
 const params=new URLSearchParams(hash.replace(/^#/,''));
 return {q:params.get('rateq')||'',category:rateCategories.includes(params.get('category'))?params.get('category'):'all',date:params.get('asOf')||''};
}
export function rateHash(hash,patch){const params=new URLSearchParams(hash.replace(/^#/,''));params.set('view','rates');for(const [key,value]of Object.entries(patch)){if(value&&value!=='all')params.set(key,value);else params.delete(key);}return '#'+params;}
export function filterRates(keys,view){const q=view.q.trim().toLocaleLowerCase();return keys.filter(key=>(view.category==='all'||key.category===view.category)&&(!q||[key.code,key.id,key.unit,key.category].some(value=>value.toLocaleLowerCase().includes(q))));}
