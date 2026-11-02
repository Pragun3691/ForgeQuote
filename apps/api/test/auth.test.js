import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import '../src/config.js';
import { migrate } from '../src/migrate.js';
import { seedUsers } from '../src/auth/seed-users.js';
import { verifyPassword } from '../src/auth/passwords.js';
import { createApp } from '../src/app.js';

const randomSecret = () => randomBytes(32).toString('hex');

async function start(pool, config, options) {
  const app = createApp(pool, config, options);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { app, server, base: `http://127.0.0.1:${server.address().port}`, close: async () => { app.locals.sessionStore.close(); await new Promise(resolve => server.close(resolve)); } };
}

function agent(base, origin, extraHeaders = {}) {
  return {
    cookie: '', token: '',
    async request(path, { method = 'GET', body, headers = {} } = {}) {
      const response = await fetch(base + path, { method, headers: { ...extraHeaders, ...(this.cookie ? { Cookie: this.cookie } : {}), ...(method !== 'GET' ? { Origin: origin, 'X-CSRF-Token': this.token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      for (const cookie of response.headers.getSetCookie()) this.cookie = cookie.split(';')[0];
      const data = response.status === 204 ? null : await response.json();
      if (data?.csrfToken) this.token = data.csrfToken;
      return { response, data };
    },
    async bootstrap() { return this.request('/api/auth/session'); },
    async login(username, password) { await this.bootstrap(); return this.request('/api/auth/login', { method: 'POST', body: { username, password } }); }
  };
}

test('real PostgreSQL authentication lifecycle and security boundaries', async t => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  assert.match(new URL(url).pathname, /_test$/);
  const admin = new pg.Pool({ connectionString: url });
  const schema = `auth_${randomUUID().replaceAll('-', '')}`;
  let pool, running;
  const passwords = { DEMO_ESTIMATOR_PASSWORD: randomSecret(), DEMO_SALES_HEAD_PASSWORD: randomSecret() };
  const config = { nodeEnv: 'test', appOrigin: 'http://127.0.0.1:5173', sessionSecret: randomSecret(), trustProxyHops: 0 };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 4 });
    await migrate(pool);
    await seedUsers(pool, passwords);
    running = await start(pool, config, { sessionSchema: schema, loginLimit: 100 });

    await t.test('two identities store salted hashes; repeated seeding preserves hashes', async () => {
      const before = (await pool.query('SELECT username,password_hash,role FROM users ORDER BY username')).rows;
      assert.equal(before.length, 2);
      assert.equal(before[0].role, 'estimator'); assert.equal(before[1].role, 'sales_head');
      assert.equal(await verifyPassword(passwords.DEMO_ESTIMATOR_PASSWORD, before[0].password_hash), true);
      assert.notEqual(before[0].password_hash, passwords.DEMO_ESTIMATOR_PASSWORD);
      await seedUsers(pool, passwords);
      assert.deepEqual((await pool.query('SELECT username,password_hash,role FROM users ORDER BY username')).rows, before);
      await assert.rejects(seedUsers(pool, { ...passwords, DEMO_ESTIMATOR_PASSWORD: randomSecret() }), /refusing to reset/);
    });
    await t.test('correct login regenerates session; cookie flags and persisted identity', async () => {
      const client = agent(running.base, config.appOrigin);
      await client.bootstrap(); const anonymousCookie = client.cookie;
      const login = await client.request('/api/auth/login', { method: 'POST', body: { username: 'estimator', password: passwords.DEMO_ESTIMATOR_PASSWORD } });
      assert.equal(login.response.status, 200);
      assert.equal(login.data.user.role, 'estimator');
      assert.notEqual(client.cookie, anonymousCookie);
      const setCookie = login.response.headers.get('set-cookie');
      assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Lax/);
      assert.ok(!setCookie.includes('Secure'));
      assert.equal(login.response.headers.get('cache-control'), 'no-store');
      assert.equal((await client.bootstrap()).data.user.username, 'estimator');
      const old = agent(running.base, config.appOrigin); old.cookie = anonymousCookie;
      assert.equal((await old.bootstrap()).data.user, null);
      const persisted = (await pool.query("SELECT sess FROM sessions WHERE sess->>'userId'=$1", [login.data.user.id])).rows;
      assert.ok(persisted.some(row => row.sess.csrfToken === client.token));
      assert.ok(persisted.every(row => !JSON.stringify(row.sess).includes(passwords.DEMO_ESTIMATOR_PASSWORD)));
      // A fresh application/store reads the same database-backed session.
      const other = await start(pool, config, { sessionSchema: schema });
      try { const second = agent(other.base, config.appOrigin); second.cookie = client.cookie; assert.equal((await second.bootstrap()).data.user.id, login.data.user.id); }
      finally { await other.close(); }
    });
    await t.test('wrong, unknown and disabled credentials share generic rejection', async () => {
      const client = agent(running.base, config.appOrigin);
      const wrong = await client.login('estimator', randomSecret());
      const unknown = await client.login('nobody', randomSecret());
      assert.equal(wrong.response.status, 401); assert.equal(unknown.response.status, 401);
      assert.deepEqual(wrong.data, unknown.data);
      await pool.query("UPDATE users SET active=false WHERE username='sales_head'");
      try { const disabled = await client.login('sales_head', passwords.DEMO_SALES_HEAD_PASSWORD); assert.equal(disabled.response.status, 401); assert.deepEqual(disabled.data, wrong.data); }
      finally { await pool.query("UPDATE users SET active=true WHERE username='sales_head'"); }
    });
    await t.test('draft guard rejects anonymous and sales-head; estimator creates no fake draft', async () => {
      const path = '/api/rfqs/demo/quote-versions';
      const anonymous = agent(running.base, config.appOrigin);
      assert.equal((await anonymous.request(path, { method: 'POST' })).response.status, 401);
      const sales = agent(running.base, config.appOrigin); assert.equal((await sales.login('sales_head', passwords.DEMO_SALES_HEAD_PASSWORD)).response.status, 200);
      assert.equal((await sales.request(path, { method: 'POST' })).response.status, 403);
      const estimator = agent(running.base, config.appOrigin); await estimator.login('estimator', passwords.DEMO_ESTIMATOR_PASSWORD);
      const permitted = await estimator.request(path, { method: 'POST' });
      assert.equal(permitted.response.status, 501); assert.equal(permitted.data.error.code, 'DRAFT_CREATION_UNAVAILABLE');
    });
    await t.test('missing or mismatched CSRF and wrong origin rejected, including login/logout', async () => {
      const client = agent(running.base, config.appOrigin); await client.bootstrap();
      const body = { username: 'estimator', password: passwords.DEMO_ESTIMATOR_PASSWORD };
      for (const headers of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': randomSecret() }, { Origin: 'https://other.example' }, { Origin: '' }]) assert.equal((await client.request('/api/auth/login', { method: 'POST', body, headers })).response.status, 403);
      const beforeLogin = client.token; await client.login('estimator', passwords.DEMO_ESTIMATOR_PASSWORD);
      assert.equal((await client.request('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': beforeLogin } })).response.status, 403);
      assert.equal((await client.request('/api/rfqs/demo/quote-versions', { method: 'POST', headers: { 'X-CSRF-Token': '' } })).response.status, 403);
    });
    await t.test('logout destroys stored session and invalidates replayed cookie', async () => {
      const client = agent(running.base, config.appOrigin); await client.login('estimator', passwords.DEMO_ESTIMATOR_PASSWORD);
      const oldCookie = client.cookie;
      assert.equal((await client.request('/api/auth/logout', { method: 'POST' })).response.status, 204);
      const replay = agent(running.base, config.appOrigin); replay.cookie = oldCookie;
      assert.equal((await replay.request('/api/rfqs/demo/quote-versions', { method: 'POST' })).response.status, 401);
      assert.equal((await replay.bootstrap()).data.user, null);
    });
    await t.test('database expiry, absolute expiry and disabled active users invalidate sessions', async () => {
      for (const mode of ['database', 'absolute', 'disabled']) {
        const client = agent(running.base, config.appOrigin); const login = await client.login('estimator', passwords.DEMO_ESTIMATOR_PASSWORD);
        const sid = decodeURIComponent(client.cookie.split('=')[1]).slice(2).split('.')[0];
        if (mode === 'database') await pool.query("UPDATE sessions SET expire=now()-interval '1 minute' WHERE sid=$1", [sid]);
        if (mode === 'absolute') await pool.query("UPDATE sessions SET sess=jsonb_set(sess::jsonb,'{expiresAt}','0'::jsonb)::json WHERE sid=$1", [sid]);
        if (mode === 'disabled') await pool.query('UPDATE users SET active=false WHERE id=$1', [login.data.user.id]);
        try { assert.equal((await client.request('/api/rfqs/demo/quote-versions', { method: 'POST' })).response.status, 401); assert.equal((await client.bootstrap()).data.user, null); }
        finally { await pool.query('UPDATE users SET active=true WHERE id=$1', [login.data.user.id]); }
      }
    });
    await t.test('login rate limiter blocks attempts before password work', async () => {
      const limited = await start(pool, config, { sessionSchema: schema, loginLimit: 2 });
      try {
        const client = agent(limited.base, config.appOrigin); await client.bootstrap();
        for (let i = 0; i < 2; i++) assert.equal((await client.request('/api/auth/login', { method: 'POST', body: { username: 'nobody', password: randomSecret() } })).response.status, 401);
        const rejected = await client.request('/api/auth/login', { method: 'POST', body: { username: 'estimator', password: passwords.DEMO_ESTIMATOR_PASSWORD } });
        assert.equal(rejected.response.status, 429); assert.ok(rejected.response.headers.get('retry-after'));
      } finally { await limited.close(); }
    });
    await t.test('malformed input and unavailable session storage fail explicitly without internal details', async () => {
      const client = agent(running.base, config.appOrigin); await client.bootstrap();
      const invalid = await client.request('/api/auth/login', { method: 'POST', body: { username: 'estimator', password: passwords.DEMO_ESTIMATOR_PASSWORD, role: 'sales_head' } });
      assert.equal(invalid.response.status, 400);
      const large = await client.request('/api/auth/login', { method: 'POST', body: { username: 'estimator', password: 'x'.repeat(5000) } });
      assert.equal(large.response.status, 413);
      await pool.query('ALTER TABLE sessions RENAME TO sessions_unavailable');
      try {
        const fresh = agent(running.base, config.appOrigin);
        const unavailable = await fresh.bootstrap();
        assert.equal(unavailable.response.status, 503); assert.equal(unavailable.data.error.code, 'AUTH_SERVICE_UNAVAILABLE');
        assert.ok(!JSON.stringify(unavailable.data).includes(schema));
      } finally { await pool.query('ALTER TABLE sessions_unavailable RENAME TO sessions'); }
    });
    await t.test('production cookie requires HTTPS and has Secure HttpOnly host-only attributes', async () => {
      const production = await start(pool, { ...config, nodeEnv: 'production', appOrigin: 'https://forgequote.example', trustProxyHops: 1 }, { sessionSchema: schema });
      try {
        const http = agent(production.base, 'https://forgequote.example');
        const insecure = await http.bootstrap(); assert.equal(insecure.response.headers.get('set-cookie'), null);
        const https = agent(production.base, 'https://forgequote.example', { 'X-Forwarded-Proto': 'https' });
        const result = await https.bootstrap();
        const cookie = result.response.headers.get('set-cookie');
        assert.match(cookie, /^__Host-forgequote.sid=/); assert.match(cookie, /Secure/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Path=\//); assert.ok(!cookie.includes('Domain='));
      } finally { await production.close(); }
      const direct = await start(pool, { ...config, nodeEnv: 'production', appOrigin: 'https://forgequote.example', trustProxyHops: 0 }, { sessionSchema: schema });
      try {
        const spoofed = agent(direct.base, 'https://forgequote.example', { 'X-Forwarded-Proto': 'https' });
        assert.equal((await spoofed.bootstrap()).response.headers.get('set-cookie'), null);
      } finally { await direct.close(); }
    });
  } finally {
    if (running) await running.close();
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
