import { readMaintenanceUrl } from '../src/maintenance.js';
import { createPool } from '../src/db.js';
import { seedUsers } from '../src/auth/seed-users.js';

const pool = createPool(readMaintenanceUrl());
try { await seedUsers(pool); console.log('Demo estimator and sales_head seeded; existing credentials never reset.'); }
catch (error) { console.error('User seed failed:', error.code || error.message); process.exitCode = 1; }
finally { await pool.end(); }
