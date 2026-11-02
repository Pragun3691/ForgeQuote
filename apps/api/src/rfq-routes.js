import { rateLimit } from 'express-rate-limit';
import { requireUser, requireRole, csrfProtection, failure } from './auth/middleware.js';
import { createRfqService, listIntakeRateKeys } from './rfq-intake.js';

export function installRfqIntakeRoutes(app, pool, config, { rfqLimit = 30 } = {}) {
  const create = createRfqService(pool);
  const limiter = rateLimit({ windowMs:15*60*1000, limit:rfqLimit, keyGenerator:req=>req.user.id,
    standardHeaders:'draft-8', legacyHeaders:false,
    handler:(_req,res)=>failure(res,429,'RFQ_RATE_LIMIT','Too many RFQ save attempts. Wait, then retry the same submission key and inputs.') });
  app.get('/api/rfq-rate-keys', requireUser, async (_req,res) => res.json({ rateKeys: await listIntakeRateKeys(pool) }));
  app.post('/api/rfqs', requireUser, requireRole('estimator'), csrfProtection(config.appOrigin), limiter, async (req,res) => {
    const receipt = await create(req.user.id, req.get('Idempotency-Key'), req.body);
    res.status(receipt.replayed ? 200 : 201).location(`/api/rfqs/${receipt.rfqId}`).json(receipt);
  });
}
