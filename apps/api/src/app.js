import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health/ready', async (_req, res) => {
    try {
      const schema = await pool.query("SELECT name FROM schema_migrations WHERE name='001_initial.sql'");
      if (schema.rowCount !== 1) throw Error('Schema migration missing');
      res.json({ status: 'ready', database: 'reachable', schema: 'current' });
    } catch { res.status(503).json({ status: 'not_ready' }); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not available' } }));
  const dist = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: dist }));
  }
  return app;
}
