import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readAuthConfig } from './config.js';
import { installAuth } from './auth/index.js';
import { apiErrorHandler } from './errors.js';
import { installQuotationRoutes } from './quotation-routes.js';
import { requestLogging } from './request-logging.js';
import { installRfqIntakeRoutes } from './rfq-routes.js';
import { installAiRoutes } from './ai/routes.js';
import { installImportRoutes } from './imports/routes.js';
import { installRateRoutes } from './rate-catalogue.js';
import { maintenanceHeaders, maintenanceResponse } from './maintenance-mode.js';

export function createApp(pool, config = readAuthConfig(), authOptions = {}) {
  if(config.maintenanceMode !== undefined && typeof config.maintenanceMode !== 'boolean')throw Error('Invalid maintenance mode');
  const maintenance=config.maintenanceMode===true;
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogging({enabled: config.nodeEnv === 'production',write:authOptions.logWriter}));
  // Health routes precede sessions/auth. Liveness is DB-free; normal readiness
  // and deployment health deliberately query the required schema.
  app.get('/api/health/live', (_req,res) => res.set('Cache-Control','no-store').json({status:'alive'}));
  const readiness=async (_req, res) => {
    res.set('Cache-Control','no-store');
    try {
      const schema = await pool.query("SELECT name FROM schema_migrations WHERE name='008_terminal_rfq_quotation_guards.sql'");
      if (schema.rowCount !== 1) throw Error('Schema migration missing');
      res.json({ status: 'ready', database: 'reachable', schema: 'current' });
    } catch { res.status(503).json({ status: 'not_ready' }); }
  };
  // Maintenance is deployable on 007 without claiming application readiness.
  // Normal candidates must pass the SAME 008 check as normal readiness.
  app.get('/api/health/deploy', maintenance ? (_req,res)=>res.set('Cache-Control','no-store').json({status:'maintenance',applicationReady:false}) : readiness);
  app.get('/api/health/ready', maintenance ? (_req,res)=>maintenanceHeaders(res).status(503).json({status:'not_ready',reason:'maintenance'}) : readiness);
  if(maintenance){
    app.use(maintenanceResponse);
    return app; // No session store, prune timer, provider or application routes.
  }
  installAuth(app, pool, config, authOptions);
  installRateRoutes(app,pool,config);
  installAiRoutes(app, config, authOptions);
  installImportRoutes(app, config, authOptions);
  installRfqIntakeRoutes(app, pool, config, authOptions);
  installQuotationRoutes(app, pool, config, authOptions);
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not available' } }));
  app.use(apiErrorHandler);
  const dist = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: dist }));
  }
  return app;
}
