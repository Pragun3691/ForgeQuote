import { readMaintenanceUrl } from '../src/maintenance.js';
import { createPool } from '../src/db.js';
import { seed } from '../src/seed.js';

const pool = createPool(readMaintenanceUrl());
try { await seed(pool); console.log('Synthetic spindle RFQ and six rates verified; this command does not create users or quotations.'); }
catch (error) { console.error('Seed failed:', error.code || error.message); process.exitCode = 1; }
finally { await pool.end(); }
