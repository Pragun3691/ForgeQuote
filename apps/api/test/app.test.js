import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

test('readiness reports database availability; write endpoints are absent', async () => {
  let unavailable = false;
  const server = createApp({ query: async () => { if (unavailable) throw Error('offline'); } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/health/ready`)).status, 200);
    unavailable = true;
    assert.equal((await fetch(`${base}/api/health/ready`)).status, 503);
    assert.equal((await fetch(`${base}/api/rfqs/x/quote-versions`, { method: 'POST' })).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
