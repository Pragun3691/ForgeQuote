import { readAuthConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';
import { existsSync } from 'node:fs';

const config = readAuthConfig();
if (config.nodeEnv === 'production' && !existsSync(new URL('../../web/dist/index.html',import.meta.url))) throw Error('Production frontend build missing');
const pool = createPool(config.databaseUrl,config);
const app = createApp(pool, config);
const server = app.listen(config.port, () => console.log(`ForgeQuote listening on port ${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => { app.locals.sessionStore.close(); await pool.end(); clearTimeout(timeout); });
});
