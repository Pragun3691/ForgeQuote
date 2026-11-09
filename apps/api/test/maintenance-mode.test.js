import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createApp} from '../src/app.js';
import {readConfig,readAuthConfig} from '../src/config.js';
import {fork} from 'node:child_process';
import net from 'node:net';

const config=()=>({nodeEnv:'test',gstPercent:'18',sessionSecret:randomBytes(32).toString('hex'),appOrigin:'http://localhost:3000',trustProxyHops:0});
async function running(pool,settings,work){
 const app=createApp(pool,settings),server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{await work(app,`http://127.0.0.1:${server.address().port}`);}finally{await app.locals.sessionStore?.close();await new Promise(r=>server.close(r));}
}

test('maintenance requires explicit strict configuration; no authentication relaxation',()=>{
 const base={DATABASE_URL:'postgres://localhost/test'};
 assert.equal(readConfig(base).maintenanceMode,false);
 assert.equal(readConfig({...base,MAINTENANCE_MODE:'false'}).maintenanceMode,false);
 assert.equal(readConfig({...base,MAINTENANCE_MODE:'true'}).maintenanceMode,true);
 for(const value of ['', 'TRUE','False','1','0','yes',' true ',true,false])assert.throws(()=>readConfig({...base,MAINTENANCE_MODE:value}),/MAINTENANCE_MODE/);
 assert.throws(()=>readAuthConfig({...base,MAINTENANCE_MODE:'true'}),/SESSION_SECRET/);
 const production={...base,NODE_ENV:'production',MAINTENANCE_MODE:'true',APP_ORIGIN:'https://forgequote.example',SESSION_SECRET:randomBytes(32).toString('hex')};
 assert.throws(()=>readAuthConfig({...production,MIGRATION_DATABASE_URL:'postgres://localhost/test'}),/Maintenance, test and seed credentials/);
 assert.throws(()=>createApp({}, {...config(),maintenanceMode:'true'}),/maintenance/i);
});

test('maintenance blocks every normal request before any database, session or provider writer',async()=>{
 let queries=0;
 const poison={query(){queries++;throw Error('Database must not be used');},connect(){queries++;throw Error('Database must not be used');}};
 const settings={...config(),maintenanceMode:true};
 await running(poison,settings,async(app,base)=>{
  assert.equal(app.locals.sessionStore,undefined,'No session store or prune timer is constructed');
  // The switch is a process-start setting, never a mutable per-request bypass.
  settings.maintenanceMode=false;
  const paths=['/','/#rfq=anything','/assets/old.js','/favicon.ico','/api/auth/session','/api/auth/login','/api/auth/logout','/api/rfqs','/api/rfqs/id/quote-versions','/api/quote-versions/id/submit','/api/quote-versions/id/approve','/api/quote-versions/id/reject','/api/quote-versions/id/issue','/api/rfqs/id/outcomes','/api/rates/id/versions','/api/rfq-extraction','/api/rfq-import/xlsx','/api/quote-versions/id/pdf','/api/quote-versions/id/internal-pdf','/API/RFQS','//api/rfqs','/%61pi/rfqs','/api/health/live/extra','/api/health/live?maintenance=false'];
  for(const path of paths)for(const method of ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']){
   if(path==='/api/health/live?maintenance=false'&&['GET','HEAD'].includes(method))continue;
   const r=await fetch(base+path,{method,headers:{Cookie:'forgequote.sid=stale',Origin:settings.appOrigin,'X-Maintenance-Mode':'false','X-HTTP-Method-Override':'GET',...(method==='GET'||method==='HEAD'?{}:{'Content-Type':'application/json'})},...(method==='GET'||method==='HEAD'?{}:{body:'{}'}),redirect:'manual'});
   assert.equal(r.status,503,`${method} ${path}`);assert.equal(r.headers.get('retry-after'),'60');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('set-cookie'),null);
   if(method!=='HEAD')assert.ok((await r.text()).includes('maintenance'));
  }
  assert.equal(queries,0);
 });
});

test('maintenance health gates do not require schema 007, schema 008 or database access',async()=>{
 await running({query(){assert.fail('Maintenance health must be DB-free');}}, {...config(),maintenanceMode:true},async(_app,base)=>{
  const live=await fetch(base+'/api/health/live');assert.equal(live.status,200);assert.deepEqual(await live.json(),{status:'alive'});
  const deploy=await fetch(base+'/api/health/deploy');assert.equal(deploy.status,200);assert.deepEqual(await deploy.json(),{status:'maintenance',applicationReady:false});
  const ready=await fetch(base+'/api/health/ready');assert.equal(ready.status,503);assert.deepEqual(await ready.json(),{status:'not_ready',reason:'maintenance'});assert.equal(ready.headers.get('retry-after'),'60');
  assert.equal((await fetch(base+'/api/auth/session?bypass=true')).status,503);
 });
});

test('maintenance constructs no scheduled database writer, including across prune intervals',t=>{
 let queries=0;
 t.mock.timers.enable({apis:['setTimeout']});
 const app=createApp({query(){queries++;throw Error('Unexpected writer');},connect(){queries++;throw Error('Unexpected writer');}},{...config(),maintenanceMode:true});
 t.mock.timers.tick(60*60*1000);
 assert.equal(app.locals.sessionStore,undefined);
 assert.equal(queries,0);
});

test('normal deployment and readiness gates require 008 without changing normal auth behavior',async()=>{
 let migrated=false,offline=false;const queries=[];
 await running({async query(sql){queries.push(sql);if(offline)throw Error('offline');return {rowCount:migrated?1:0};}},config(),async(_app,base)=>{
  assert.equal((await fetch(base+'/api/health/live')).status,200);assert.equal(queries.length,0);
  for(const state of ['007','008','offline']){
   migrated=state==='008';offline=state==='offline';
   for(const endpoint of ['ready','deploy'])assert.equal((await fetch(base+'/api/health/'+endpoint)).status,state==='008'?200:503);
  }
  assert.ok(queries.every(sql=>sql.includes('008_terminal_rfq_quotation_guards.sql')));
  assert.equal((await fetch(base+'/api/rfqs/id/quote-versions',{method:'POST'})).status,401);
 });
});

test('actual production maintenance starts and shuts down without a reachable database',async()=>{
 const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['DATABASE_URL','MIGRATION_DATABASE_URL','TEST_DATABASE_URL','DEMO_ESTIMATOR_PASSWORD','DEMO_SALES_HEAD_PASSWORD','DATABASE_TLS_MODE','DATABASE_CA_CERT','NODE_TLS_REJECT_UNAUTHORIZED','CLOUD_DATABASE_NAME','NODE_OPTIONS'].includes(key)));
 Object.assign(env,{NODE_ENV:'production',MAINTENANCE_MODE:'true',PORT:String(port),APP_ORIGIN:'https://forgequote.example',SESSION_SECRET:randomBytes(32).toString('hex'),DATABASE_URL:'postgres://127.0.0.1:1/forgequote_unreachable_test',DATABASE_TLS_MODE:'verify-full',TRUST_PROXY_HOPS:'1'});
 // Windows does not deliver POSIX SIGTERM to JavaScript. Emit it inside the
 // child via test-only IPC, exercising the actual server shutdown handler.
 const entry=`await import(${JSON.stringify(new URL('../src/server.js',import.meta.url).href)});process.on('message',message=>{if(message==='shutdown'){process.disconnect();process.emit('SIGTERM');process.emit('SIGINT');}});`;
 const child=fork('-e',[entry],{env,execArgv:['--input-type=module'],windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});let output='';child.stdout.on('data',chunk=>{output+=chunk.toString();});child.stderr.on('data',chunk=>{output+=chunk.toString();});
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Maintenance startup timed out')),12000);child.once('error',error=>{clearTimeout(timeout);reject(error);});child.once('exit',()=>{clearTimeout(timeout);reject(Error('Maintenance process exited before startup'));});child.stdout.on('data',()=>{if(output.includes('ForgeQuote listening')){clearTimeout(timeout);resolve();}});});
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(base+'/api/health/live')).status,200);assert.equal((await fetch(base+'/api/health/deploy')).status,200);
  assert.equal((await fetch(base+'/api/health/ready')).status,503);assert.equal((await fetch(base+'/api/auth/session')).status,503);assert.equal((await fetch(base)).status,503);
  const exited=once(child,'exit');child.send('shutdown');const [code]=await exited;assert.equal(code,0);assert.ok(output.includes('maintenance=true'));assert.ok(output.includes('ForgeQuote shutdown complete'));assert.doesNotMatch(output,/postgres:\/\/|SESSION_SECRET|Session store operation failed/);
 }finally{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}}
});
