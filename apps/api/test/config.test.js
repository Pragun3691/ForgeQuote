import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

test('configuration fails explicitly without valid PostgreSQL URL', () => {
  for (const env of [{}, { DATABASE_URL: 'invalid' }, { DATABASE_URL: 'https://localhost' }]) assert.throws(() => readConfig(env), /DATABASE_URL/);
});
test('configuration validates port, environment and approved illustrative GST', () => {
  const base = { DATABASE_URL: 'postgres://localhost/forgequote' };
  assert.equal(readConfig(base).gstPercent, '18');
  for (const PORT of ['0', '65536', 'NaN', '1.2']) assert.throws(() => readConfig({ ...base, PORT }), /PORT/);
  assert.throws(() => readConfig({ ...base, NODE_ENV: 'invalid' }), /NODE_ENV/);
  assert.throws(() => readConfig({ ...base, DEMO_GST_PERCENT: '5' }), /GST/);
});
