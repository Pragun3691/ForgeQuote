import { requireUser, requireRole, csrfProtection } from './auth/middleware.js';
import { listRfqs, getRfq } from './rfqs.js';
import { createQuotationService } from './quotations.js';
import { createSubmissionService } from './draft-submissions.js';

export function installQuotationRoutes(app, pool, config) {
  const quotes = createQuotationService(pool, config);
  const submit = createSubmissionService(pool, config);
  app.use(['/api/rfqs','/api/quote-versions'], requireUser);
  app.get('/api/rfqs', async (_req, res) => res.json({ rfqs: await listRfqs(pool) }));
  app.get('/api/rfqs/:id', async (req, res) => res.json(await getRfq(pool, req.params.id)));
  app.post('/api/rfqs/:id/quote-versions', requireRole('estimator'), csrfProtection(config.appOrigin), async (req, res) => {
    const receipt = await submit(req.user.id, req.params.id, req.get('Idempotency-Key'), req.body);
    res.status(receipt.replayed ? 200 : 201).location(`/api/quote-versions/${receipt.versionId}`).json(receipt);
  });
  app.get('/api/quote-versions/:id', async (req, res) => res.json(await quotes.getDraftVersion(req.user.id, req.params.id)));
}
