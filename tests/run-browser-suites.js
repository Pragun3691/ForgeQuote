import {spawn} from 'node:child_process';

// The existing fixtures require an explicitly configured local *_test parent
// and create dedicated disposable databases. No development/production writes.
const suites=['auth','quotation','rfq','ai','xlsx','ai-association','lifecycle','pdf','rates-ux','final-workflows','ui','version-consistency','visual-v2','m1','m2','m3','m4','m5','m6','m7','m8'];
for(const suite of suites) {
  const child=spawn(process.execPath,[`tests/browser-${suite}.smoke.js`],{env:process.env,stdio:'inherit',windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  console.log(`Browser suite ${suite}: ${code===0?'PASS':'FAIL'}`);
  if(code!==0){process.exitCode=code||1;break;}
}
