import { randomUUID } from 'node:crypto';
import { hashPassword, validPassword, verifyPassword } from './passwords.js';
import { transaction } from '../db.js';

export async function seedUsers(pool, env = process.env) {
  const identities = [
    ['estimator', env.DEMO_ESTIMATOR_PASSWORD],
    ['sales_head', env.DEMO_SALES_HEAD_PASSWORD]
  ];
  if (identities.some(([, password]) => !validPassword(password))) throw Error('Set both DEMO_ESTIMATOR_PASSWORD and DEMO_SALES_HEAD_PASSWORD (12+ characters) before seeding users');
  if (identities[0][1] === identities[1][1]) throw Error('Demo passwords must differ');
  // Expensive hashing happens before opening a transaction.
  const hashes = await Promise.all(identities.map(([, password]) => hashPassword(password)));
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(261103)');
    for (const [index, [username, password]] of identities.entries()) {
      const existing = await client.query('SELECT password_hash,role,active FROM users WHERE username=$1', [username]);
      if (existing.rowCount) {
        const user = existing.rows[0];
        if (user.role !== username || !user.active || !(await verifyPassword(password, user.password_hash))) throw Error('Existing demo user differs from seed configuration; refusing to reset credentials or activation');
      } else {
        await client.query('INSERT INTO users(id,username,password_hash,role) VALUES($1,$2,$3,$2)', [randomUUID(), username, hashes[index]]);
      }
    }
  });
}
