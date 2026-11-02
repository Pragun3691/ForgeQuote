import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import net from 'node:net';
import {once} from 'node:events';

test('actual production server starts, serves React and liveness without maintenance credentials or DB access',async()=>{
  assert.ok(existsSync(new URL('../../web/dist/index.html',import.meta.url)),'Run npm run build before test:production');
  const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['DATABASE_URL','MIGRATION_DATABASE_URL','TEST_DATABASE_URL','DEMO_ESTIMATOR_PASSWORD','DEMO_SALES_HEAD_PASSWORD','DATABASE_TLS_MODE','DATABASE_CA_CERT','NODE_TLS_REJECT_UNAUTHORIZED','CLOUD_DATABASE_NAME','NODE_OPTIONS'].includes(key)));
  Object.assign(env,{NODE_ENV:'production',PORT:String(port),APP_ORIGIN:'https://forgequote.example',SESSION_SECRET:randomBytes(32).toString('hex'),DATABASE_URL:'postgres://runtime:test@127.0.0.1:1/forgequote_production_test',DATABASE_TLS_MODE:'verify-full',TRUST_PROXY_HOPS:'1'});
  const child=fork(fileURLToPath(new URL('../src/server.js',import.meta.url)),[],{env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk.toString();});
  try {
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Production server startup timed out')),12000);
      child.once('error',error=>{clearTimeout(timeout);reject(error);});
      child.once('exit',code=>{clearTimeout(timeout);reject(Error(`Production server exited (${code})`));});
      child.stdout.on('data',()=>{if(output.includes('ForgeQuote listening')) {clearTimeout(timeout);resolve();}});
    });
    const base=`http://127.0.0.1:${port}`;
    const live=await fetch(`${base}/api/health/live`);assert.equal(live.status,200);assert.deepEqual(await live.json(),{status:'alive'});
    const page=await fetch(base);assert.equal(page.status,200);const html=await page.text();assert.match(html,/<div id="root">/);
    const asset=html.match(/src="([^"]+\.js)"/)[1];
    const bundle=await fetch(base+asset);assert.equal(bundle.status,200);assert.ok((await bundle.text()).length>1000);
    const ready=await fetch(`${base}/api/health/ready`);assert.equal(ready.status,503); // no configured DB server, no false readiness
    assert.doesNotMatch(output,/postgres:\/\/|SESSION_SECRET|MIGRATION_DATABASE_URL/);
  } finally {
    if(child.exitCode===null) {const exit=once(child,'exit');child.kill('SIGTERM');await exit;}
  }
});
