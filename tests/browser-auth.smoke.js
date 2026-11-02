import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { createApp } from '../apps/api/src/app.js';
import { browserTestDatabase } from './helpers/database.js';

assert.ok(existsSync(new URL('../apps/web/dist/index.html', import.meta.url)), 'Run npm run build first');
const db = await browserTestDatabase();
let app, browser;
const server = createServer((req, res) => app(req, res));
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  app = createApp(db.runtime, { nodeEnv: 'test', gstPercent: '18', sessionSecret: randomBytes(32).toString('hex'), appOrigin: origin, trustProxyHops: 0 }, { sessionSchema: db.schema });
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.name));
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill(randomBytes(24).toString('base64url'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Username or password is incorrect.' }).waitFor();
  for (const [username, password] of [['estimator', db.passwords.DEMO_ESTIMATOR_PASSWORD], ['sales_head', db.passwords.DEMO_SALES_HEAD_PASSWORD]]) {
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
  await db.close();
}
