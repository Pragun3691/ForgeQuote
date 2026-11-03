import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {databasePoolConfig} from '../src/database-config.js';
import {readConfig,readAuthConfig} from '../src/config.js';
import {validateCloudTarget,validateCloudConnection} from '../src/cloud-database.js';
import {createApp} from '../src/app.js';

test('TLS policy verifies certificates, normalizes URL flags and rejects downgrade/global bypass',()=>{
  const options=databasePoolConfig('postgres://app:secret@host/db?sslmode=require&channel_binding=require',{nodeEnv:'production'});
  assert.equal(options.ssl.rejectUnauthorized,true);
  assert.equal(options.ssl.minVersion,'TLSv1.2');
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'),false);
  assert.equal(new URL(options.connectionString).searchParams.get('channel_binding'),'require');
  assert.equal(databasePoolConfig('postgres://localhost/db',{nodeEnv:'development'}).ssl,false);
  assert.equal(databasePoolConfig('postgres://localhost/db?sslmode=require',{nodeEnv:'development'}).ssl.rejectUnauthorized,true);
  assert.equal(databasePoolConfig('postgres://localhost/db',{nodeEnv:'production',databaseCaCert:'TEST CA'}).ssl.ca,'TEST CA');
  for(const suffix of ['sslmode=disable','sslmode=no-verify','sslmode=prefer','ssl=true','sslcert=a','sslkey=a','sslrootcert=a','uselibpqcompat=true']) {
    assert.throws(()=>databasePoolConfig(`postgres://localhost/db?${suffix}`,{nodeEnv:'production'}),/TLS|sslmode/);
  }
  assert.throws(()=>databasePoolConfig('postgres://localhost/db',{nodeEnv:'production',databaseTlsMode:'disable'}),/insecure/);
  assert.throws(()=>databasePoolConfig('postgres://localhost/db',{nodeEnv:'production',globalTlsVerification:'0'}),/Global TLS/);
  assert.throws(()=>readConfig({DATABASE_URL:'postgres://localhost/db',NODE_ENV:'production',DATABASE_TLS_MODE:'disable'}),/insecure/);
});

test('cloud target guard cannot select preserved local or unrelated databases',()=>{
  for(const name of [undefined,'','forgequote_dev','forgequote_test','MedReach','medreach','postgres','forgequote_demo;DROP DATABASE x']) assert.throws(()=>validateCloudTarget(name),/CLOUD_DATABASE_NAME/);
  assert.equal(validateCloudTarget('forgequote_demo'),'forgequote_demo');
  const config={databaseUrl:'postgres://runtime@ep-approved.ap-southeast-1.aws.neon.tech/neondb'};
  const env={CLOUD_DATABASE_NAME:'neondb',CLOUD_DATABASE_HOST:'ep-approved.ap-southeast-1.aws.neon.tech'};
  assert.equal(validateCloudConnection(config,env),'neondb');
  for(const change of [{CLOUD_DATABASE_HOST:undefined},{CLOUD_DATABASE_HOST:'ep-other.neon.tech'}])assert.throws(()=>validateCloudConnection(config,{...env,...change}),/confirmed direct Neon/);
  for(const databaseUrl of ['postgres://runtime@localhost/neondb','postgres://runtime@ep-approved-pooler.neon.tech/neondb','postgres://runtime@ep-approved.ap-southeast-1.aws.neon.tech/forgequote_dev'])assert.throws(()=>validateCloudConnection({databaseUrl},env));
});

test('production configuration excludes maintenance/test/seed secrets from application environment',()=>{
  const base={NODE_ENV:'production',DATABASE_URL:'postgres://runtime@host/forgequote_demo',APP_ORIGIN:'https://forgequote.example',SESSION_SECRET:randomBytes(32).toString('hex')};
  assert.equal(readAuthConfig(base).nodeEnv,'production');
  for(const key of ['MIGRATION_DATABASE_URL','TEST_DATABASE_URL','DEMO_ESTIMATOR_PASSWORD','DEMO_SALES_HEAD_PASSWORD']) assert.throws(()=>readAuthConfig({...base,[key]:'PRIVATE'}),/must not be present/);
});

test('Render preparation is free, single-service, manually deployed and pinned to tested Node',async()=>{
  const node=(await readFile(new URL('../../../.node-version',import.meta.url),'utf8')).trim();
  const yaml=await readFile(new URL('../../../render.yaml',import.meta.url),'utf8');
  assert.equal(node,'24.20.0');
  assert.ok(yaml.includes(`value: ${node}`));
  assert.match(yaml,/plan: free/);assert.match(yaml,/autoDeployTrigger: "off"/);
  assert.match(yaml,/branch: main/);assert.doesNotMatch(yaml,/branch: feature\//);
  assert.match(yaml,/key: AI_MODEL/);assert.match(yaml,/value: gemini-3.5-flash-lite/);
  assert.match(yaml,/healthCheckPath: \/api\/health\/live/);
  assert.match(yaml,/buildCommand: npm ci --include=dev && npm run build/);
  assert.match(yaml,/startCommand: npm start/);
  assert.doesNotMatch(yaml,/fromDatabase|MIGRATION_DATABASE_URL|databases:/);
});

test('production liveness is DB/session-free and logging excludes request secrets and raw errors',async()=>{
  let queries=0;
  const logs=[];
  const pool={query:async()=>{queries++;throw Error('PRIVATE database password or query');}};
  const app=createApp(pool,{nodeEnv:'production',gstPercent:'18',appOrigin:'https://forgequote.example',sessionSecret:randomBytes(32).toString('hex'),trustProxyHops:1},{logWriter:line=>logs.push(JSON.parse(line))});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    for(let i=0;i<3;i++) {
      const response=await fetch(`${base}/api/health/live`,{headers:{Cookie:'secret=PRIVATE_COOKIE'}});
      assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'alive'});
      assert.equal(response.headers.get('set-cookie'),null);
    }
    assert.equal(queries,0);assert.deepEqual(logs,[]);
    const ready=await fetch(`${base}/api/health/ready?secret=PRIVATE_QUERY`,{headers:{Authorization:'PRIVATE_AUTH','X-Request-Id':'PRIVATE_ID'}});
    assert.equal(ready.status,503);assert.equal(queries,1);
    assert.match(ready.headers.get('x-request-id'),/^[a-f0-9-]{36}$/);
    await fetch(`${base}/api/auth/login?token=PRIVATE_QUERY`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:'secret=PRIVATE_COOKIE'},body:JSON.stringify({username:'PRIVATE_USER',password:'PRIVATE_PASSWORD',document:'PRIVATE_DOCUMENT'})});
    await fetch(`${base}/api/rfqs/PRIVATE_PATH/quote-versions`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"PRIVATE_MALFORMED"'});
    await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'PRIVATE_OVERSIZE'.repeat(600)})});
    assert.ok(logs.length>=4);
    assert.ok(logs.every(log=>Object.keys(log).every(key=>['event','requestId','method','route','status','durationMs','errorCode'].includes(key))));
    assert.ok(logs.some(log=>log.errorCode==='INVALID_JSON'));
    assert.ok(logs.some(log=>log.errorCode==='REQUEST_TOO_LARGE'));
    assert.doesNotMatch(JSON.stringify(logs),/PRIVATE|password|cookie|document|token/i);
  } finally {app.locals.sessionStore.close();await new Promise(resolve=>server.close(resolve));}
});
