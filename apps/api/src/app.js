import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ready', database: 'reachable' });
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
