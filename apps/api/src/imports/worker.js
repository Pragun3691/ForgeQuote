import { Worker,isMainThread,parentPort,workerData } from 'node:worker_threads';
import { importError } from './xlsx.js';

if(!isMainThread) {
  const {parseXlsx}=await import('./xlsx.js');
  try {parentPort.postMessage({result:await parseXlsx(Buffer.from(workerData))});}
  catch(error){parentPort.postMessage({code:error.code});}
}

export function importXlsx(bytes,{signal,timeoutMs=3000}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(importError('XLSX_CANCELLED'));
    const worker=new Worker(new URL('./worker.js',import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16},stdout:true,stderr:true});
    let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(result);};
    const abort=()=>finish(importError('XLSX_CANCELLED'));
    const timer=setTimeout(()=>finish(importError('XLSX_TIMEOUT')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    worker.on('message',message=>finish(message.code?importError(message.code):null,message.result));
    worker.on('error',()=>finish(importError()));worker.on('exit',()=>{if(!settled)finish(importError());});
    // Parser diagnostics must never enter application logs.
    worker.stdout.resume();worker.stderr.resume();
  });
}
