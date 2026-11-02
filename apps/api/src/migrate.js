import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transaction } from './db.js';

const directory = new URL('../db/migrations/', import.meta.url);
export async function migrate(pool) {
  return transaction(pool, async client => {
    // Serialize migration runners; a failed migration leaves neither DDL nor its ledger row.
    await client.query('SELECT pg_advisory_xact_lock(261101)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const applied = [];
    for (const name of (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)', [name, checksum]);
      applied.push(name);
    }
    return applied;
  });
}
