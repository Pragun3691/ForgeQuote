import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname,resolve} from 'node:path';
import {createPool} from '../src/db.js';

test('pg performs real TLS verification and rejects untrusted, wrong-host and plaintext peers',async()=>{
  const root=resolve(fileURLToPath(new URL('../../../.tmp/',import.meta.url)));
  await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'m8-tls-'));
  const config=join(directory,'openssl.cnf');
  await writeFile(config,'[req]\ndistinguished_name=dn\n[dn]\n');
  async function cert(name,hostname) {
    const key=join(directory,`${name}.key`),crt=join(directory,`${name}.crt`);
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',config,'-keyout',key,'-out',crt,'-subj',`/CN=${hostname}`,'-addext',`subjectAltName=DNS:${hostname}`],{stdio:'pipe',windowsHide:true});
    return {key:await readFile(key),cert:await readFile(crt)};
  }
  // Minimal PostgreSQL startup peer, solely to exercise pg's actual TLS path.
  // No costing/database behavior is mocked by this transport test.
  async function peer(credentials) {
    const sockets=new Set();
    const server=net.createServer(socket=>{
      sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
      socket.once('data',()=>{
        if(!credentials) {socket.end('N');return;}
        socket.write('S');
        const secure=new tls.TLSSocket(socket,{isServer:true,secureContext:tls.createSecureContext(credentials)});
        sockets.add(secure);secure.on('close',()=>sockets.delete(secure));secure.on('error',()=>{});
        secure.once('data',()=>secure.write(Buffer.from([82,0,0,0,8,0,0,0,0,90,0,0,0,5,73])));
        secure.on('data',chunk=>{if(chunk[0]===88) secure.end();});
      });
    });
    server.listen(0,'localhost');await once(server,'listening');
    return {url:`postgres://app:test@localhost:${server.address().port}/tls_test?sslmode=require`,
      close:async()=>{for(const socket of sockets) socket.destroy();await new Promise(resolve=>server.close(resolve));}};
  }
  let valid,wrong,plain;
  try {
    const trusted=await cert('trusted','localhost');valid=await peer(trusted);
    let pool=createPool(valid.url,{nodeEnv:'production',databaseCaCert:trusted.cert.toString()});
    try {const client=await pool.connect();assert.equal(client.connection.stream.authorized,true);client.release();} finally {await pool.end();}
    pool=createPool(valid.url,{nodeEnv:'production'});
    try {await assert.rejects(pool.connect(),/self.signed|certificate|verify/i);} finally {await pool.end();}
    const differentHost=await cert('wrong','wrong.invalid');wrong=await peer(differentHost);
    pool=createPool(wrong.url,{nodeEnv:'production',databaseCaCert:differentHost.cert.toString()});
    try {await assert.rejects(pool.connect(),/hostname|altnames|certificate/i);} finally {await pool.end();}
    plain=await peer(null);pool=createPool(plain.url,{nodeEnv:'production'});
    try {await assert.rejects(pool.connect(),/does not support SSL/);} finally {await pool.end();}
  } finally {
    for(const server of [valid,wrong,plain]) if(server) await server.close();
    // Verify the exact generated target stays in the task's ignored workspace.
    assert.equal(dirname(resolve(directory)),root);
    assert.ok(directory.startsWith(join(root,'m8-tls-')));
    await rm(directory,{recursive:true,force:true});
  }
});
