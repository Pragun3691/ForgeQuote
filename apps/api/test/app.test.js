import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { randomBytes } from 'node:crypto';

test('readiness reports database availability; anonymous draft requests are blocked', async () => {
  let unavailable = false;
  let migrated = true;
  const app = createApp({ query: async () => { if (unavailable) throw Error('offline'); return { rowCount: migrated ? 1 : 0 }; } }, { nodeEnv: 'test', appOrigin: 'http://localhost:3000', sessionSecret: randomBytes(32).toString('hex'), trustProxyHops: 0 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/health/ready`)).status, 200);
    migrated = false;
    assert.equal((await fetch(`${base}/api/health/ready`)).status, 503);
    migrated = true;
    unavailable = true;
    assert.equal((await fetch(`${base}/api/health/ready`)).status, 503);
    assert.equal((await fetch(`${base}/api/rfqs/x/quote-versions`, { method: 'POST' })).status, 401);
  } finally { app.locals.sessionStore.close(); await new Promise(resolve => server.close(resolve)); }
});
