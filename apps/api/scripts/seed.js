import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { seed } from '../src/seed.js';

const config = readConfig();
const pool = createPool(process.env.MIGRATION_DATABASE_URL || config.databaseUrl);
try { await seed(pool); console.log('Synthetic spindle RFQ and six rates seeded (no users or quotations yet).'); }
catch (error) { console.error('Seed failed:', error.code || error.message); process.exitCode = 1; }
finally { await pool.end(); }
