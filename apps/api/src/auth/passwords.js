import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const keyLength = 64;

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 256;
}

export async function hashPassword(password) {
  if (!validPassword(password)) throw Error('Demo seed passwords must be at least 12 characters and at most 256 UTF-8 bytes');
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, keyLength, options);
  return `scrypt$${options.N}$${options.r}$${options.p}$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 256) return false;
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt' || parts[1] !== String(options.N) || parts[2] !== String(options.r) || parts[3] !== String(options.p) || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const actual = await derive(password, parts[4], keyLength, options);
  return timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
}
