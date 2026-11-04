import { requireUser, requireRole, csrfProtection, failure } from './auth/middleware.js';
import { rateLimit } from 'express-rate-limit';
import { listRfqs, getRfq } from './rfqs.js';
import { createQuotationService } from './quotations.js';
import { createSubmissionService } from './draft-submissions.js';
import { createLifecycleService } from './quotation-lifecycle.js';

export function installQuotationRoutes(app, pool, config, {quoteLimit=30,quoteWindowMs=15*60*1000} = {}) {
  const quotes = createQuotationService(pool, config);
  const submit = createSubmissionService(pool, config);
  const lifecycle = createLifecycleService(pool);
  const limiter=rateLimit({windowMs:quoteWindowMs,limit:quoteLimit,keyGenerator:req=>req.user.id,
    standardHeaders:'draft-8',legacyHeaders:false,
    handler:(_req,res)=>failure(res,429,'QUOTE_RATE_LIMIT','Too many quotation save attempts. Wait, then retry the same submission key and inputs.')});
  app.use(['/api/rfqs','/api/quote-versions'], requireUser);
  app.get('/api/quote-versions/pending', requireRole('sales_head'), async (req,res)=>res.json({versions:await lifecycle.pending(req.user.id)}));
  app.get('/api/quote-versions/:id/lifecycle', async (req,res)=>res.json(await lifecycle.status(req.user.id,req.params.id)));
  for(const action of ['submit','approve','reject','issue']) {
    app.post(`/api/quote-versions/:id/${action}`, requireRole(['approve','reject'].includes(action)?'sales_head':'estimator'),
      csrfProtection(config.appOrigin),limiter,async(req,res)=>{
        const receipt=await lifecycle.act(req.user.id,req.params.id,action,req.get('Idempotency-Key'),req.body);
        res.status(receipt.replayed?200:201).json(receipt);
      });
  }
  app.get('/api/rfqs', async (_req, res) => res.json({ rfqs: await listRfqs(pool) }));
  app.get('/api/rfqs/:id', async (req, res) => res.json(await getRfq(pool, req.params.id)));
  app.post('/api/rfqs/:id/quote-versions', requireRole('estimator'), csrfProtection(config.appOrigin), limiter, async (req, res) => {
    const receipt = await submit(req.user.id, req.params.id, req.get('Idempotency-Key'), req.body);
    res.status(receipt.replayed ? 200 : 201).location(`/api/quote-versions/${receipt.versionId}`).json(receipt);
  });
  app.get('/api/quote-versions/:id', async (req, res) => res.json(await quotes.getDraftVersion(req.user.id, req.params.id)));
}
