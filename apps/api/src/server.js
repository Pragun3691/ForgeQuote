import { readAuthConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';
import { existsSync } from 'node:fs';

const config = readAuthConfig();
if (config.nodeEnv === 'production' && !existsSync(new URL('../../web/dist/index.html',import.meta.url))) throw Error('Production frontend build missing');
// Maintenance never opens an application database pool. Privileged migration
// tooling remains a separate operator process, not part of this server.
const pool = config.maintenanceMode ? null : createPool(config.databaseUrl,config);
const app = createApp(pool, config);
const server = app.listen(config.port, '0.0.0.0', () => console.log(`ForgeQuote listening on port ${config.port}; maintenance=${config.maintenanceMode}`));
let stopping=false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if(stopping)return;stopping=true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => { await app.locals.sessionStore?.close(); await pool?.end(); console.log('ForgeQuote shutdown complete');clearTimeout(timeout); });
});
