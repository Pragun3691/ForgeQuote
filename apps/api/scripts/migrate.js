import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { migrate } from '../src/migrate.js';

const config = readConfig();
const pool = createPool(process.env.MIGRATION_DATABASE_URL || config.databaseUrl);
try { console.log({ applied: await migrate(pool) }); }
catch (error) { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; }
finally { await pool.end(); }
