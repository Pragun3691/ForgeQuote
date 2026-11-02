import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, readAuthConfig } from '../src/config.js';
import { randomBytes } from 'node:crypto';

test('configuration fails explicitly without valid PostgreSQL URL', () => {
  for (const env of [{}, { DATABASE_URL: 'invalid' }, { DATABASE_URL: 'https://localhost' }]) assert.throws(() => readConfig(env), /DATABASE_URL/);
});

test('authentication requires secret, exact origin and explicit safe proxy configuration', () => {
  const env = { DATABASE_URL: 'postgres://localhost/test', APP_ORIGIN: 'http://127.0.0.1:5173', SESSION_SECRET: randomBytes(32).toString('hex') };
  assert.equal(readAuthConfig(env).trustProxyHops, 0);
  assert.throws(() => readAuthConfig({ ...env, SESSION_SECRET: '' }), /SESSION_SECRET/);
  for (const APP_ORIGIN of ['null', 'https://example.com/path', 'https://example.com/', 'ftp://example.com']) assert.throws(() => readAuthConfig({ ...env, APP_ORIGIN }), /APP_ORIGIN/);
  assert.throws(() => readAuthConfig({ ...env, NODE_ENV: 'production' }), /HTTPS/);
  assert.throws(() => readAuthConfig({ ...env, TRUST_PROXY_HOPS: 'true' }), /TRUST_PROXY_HOPS/);
});
test('configuration validates port, environment and approved illustrative GST', () => {
  const base = { DATABASE_URL: 'postgres://localhost/forgequote' };
  assert.equal(readConfig(base).gstPercent, '18');
  for (const PORT of ['0', '65536', 'NaN', '1.2']) assert.throws(() => readConfig({ ...base, PORT }), /PORT/);
  assert.throws(() => readConfig({ ...base, NODE_ENV: 'invalid' }), /NODE_ENV/);
  assert.throws(() => readConfig({ ...base, DEMO_GST_PERCENT: '5' }), /GST/);
});
