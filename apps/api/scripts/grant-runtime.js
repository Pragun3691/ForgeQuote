import { readFile } from 'node:fs/promises';
import { readMaintenanceUrl } from '../src/maintenance.js';
import { createPool } from '../src/db.js';

// Explicit maintenance command, separate from automatic migrations.
const pool = createPool(readMaintenanceUrl());
try {
  await pool.query(await readFile(new URL('../db/runtime-grants.sql', import.meta.url), 'utf8'));
  console.log('Applied explicit runtime grants; no ownership changed.');
} catch (error) { console.error('Runtime grant operation failed:', error.code || 'DATABASE_ERROR'); process.exitCode = 1; }
finally { await pool.end(); }
