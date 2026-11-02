import pg from 'pg';
import { databasePoolConfig } from './database-config.js';

// pg returns NUMERIC and BIGINT as strings. Do not replace those parsers.
export function createPool(connectionString, options) {
  const pool = new pg.Pool(databasePoolConfig(connectionString, options));
  pool.on('error', () => console.error('Unexpected idle PostgreSQL connection error'));
  return pool;
}

export async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  } finally { client.release(); }
}
