import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { readAuthConfig } from '../apps/api/src/config.js';
import { createPool } from '../apps/api/src/db.js';
import { createApp } from '../apps/api/src/app.js';

// Local smoke only: reads existing seeded identities and writes sessions, never RFQ/rate facts.
const config = readAuthConfig();
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(config.databaseUrl).hostname), 'Browser smoke requires local PostgreSQL');
assert.ok(existsSync(new URL('../apps/web/dist/index.html', import.meta.url)), 'Run npm run build first');
assert.ok(process.env.DEMO_ESTIMATOR_PASSWORD && process.env.DEMO_SALES_HEAD_PASSWORD, 'Configure demo seed passwords in .env');
const pool = createPool(config.databaseUrl);
let app, browser;
const server = createServer((req, res) => app(req, res));
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  app = createApp(pool, { ...config, nodeEnv: 'test', appOrigin: origin, trustProxyHops: 0 });
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.name));
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill(randomBytes(24).toString('base64url'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Username or password is incorrect.' }).waitFor();
  for (const [username, password] of [['estimator', process.env.DEMO_ESTIMATOR_PASSWORD], ['sales_head', process.env.DEMO_SALES_HEAD_PASSWORD]]) {
    if (username === 'sales_head') await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Demo identity').selectOption(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: `Signed in as ${username}`, exact: true }).waitFor();
    assert.equal((await page.context().cookies()).find(cookie => cookie.name === 'forgequote.sid').httpOnly, true);
    await page.reload();
    await page.getByRole('heading', { name: `Signed in as ${username}`, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real browser wrong-password error, both roles login/reload/logout, HTTP-only cookie and mobile viewport against PostgreSQL.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  app?.locals.sessionStore.close();
  await pool.end();
}
