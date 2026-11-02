import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';

test('scrypt hashes are salted, verifiable and reject wrong or malformed values', async () => {
  const password = randomBytes(24).toString('base64url');
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(randomBytes(24).toString('base64url'), first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
  await assert.rejects(hashPassword('short'), /at least 12/);
});
