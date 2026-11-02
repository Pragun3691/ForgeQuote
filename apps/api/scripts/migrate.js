import { readMaintenanceUrl } from '../src/maintenance.js';
import { createPool } from '../src/db.js';
import { migrate } from '../src/migrate.js';

const pool = createPool(readMaintenanceUrl());
try { console.log({ applied: await migrate(pool) }); }
catch (error) { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; }
finally { await pool.end(); }
