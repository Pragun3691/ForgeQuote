import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../../apps/api/src/app.js';

// Test-only child process. Connection data is passed privately via environment;
// the IPC readiness message contains only the listening port.
const pool = new pg.Pool({connectionString:process.env.FQ_TEST_CONNECTION,options:process.env.FQ_TEST_OPTIONS,max:5});
let app;
const server=createServer((req,res)=>app(req,res));
server.listen(Number(process.env.FQ_TEST_PORT || '0'),'127.0.0.1');
await once(server,'listening');
const port=server.address().port;
app=createApp(pool,{nodeEnv:'test',gstPercent:'18',sessionSecret:process.env.FQ_TEST_SECRET,appOrigin:`http://127.0.0.1:${port}`,trustProxyHops:0},{sessionSchema:process.env.FQ_TEST_SCHEMA,loginLimit:100});
process.send({type:'ready',port});
process.on('message',async message=>{
  if(message !== 'stop') return;
  app.locals.sessionStore.close();
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
  process.exit(0);
});
