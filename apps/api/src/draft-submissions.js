import { createHash } from 'node:crypto';
import { transaction } from './db.js';
import { createQuotationService } from './quotations.js';
import { canonicalRequest, inputError, validateId } from './quotation-request.js';

export function createSubmissionService(pool, config) {
  const quotations = createQuotationService(pool, config);
  return async (actorId, rfqId, submissionKey, body) => {
    const actor = validateId(actorId), key = validateId(submissionKey);
    const request = canonicalRequest(rfqId, body);
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    return transaction(pool, async client => {
      const user = (await client.query('SELECT active,role FROM users WHERE id=$1', [actor])).rows[0];
      if (!user?.active) throw inputError('Sign in to continue.', 'AUTH_REQUIRED');
      if (user.role !== 'estimator') throw inputError('Only estimators may create drafts.', 'ROLE_FORBIDDEN');
      // Same actor/key serializes even across different RFQs. Hash collisions can
      // only add waiting; the UNIQUE constraint is the final duplicate guard.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`draft:${actor}:${key}`]);
      const previous = (await client.query('SELECT version_id,request_fingerprint FROM draft_submissions WHERE actor_user_id=$1 AND submission_key=$2', [actor, key])).rows[0];
      if (previous) {
        if (previous.request_fingerprint !== fingerprint) throw inputError('This submission key was already used for different inputs. Start a new calculation.', 'SUBMISSION_CONFLICT');
        return { versionId: previous.version_id, replayed: true };
      }
      const count = (await client.query('SELECT count(*) FROM rfq_parts WHERE rfq_id=$1', [request.rfqId])).rows[0].count;
      if (count === '0') {
        if (!(await client.query('SELECT id FROM rfqs WHERE id=$1', [request.rfqId])).rowCount) throw inputError('RFQ not found.', 'RFQ_NOT_FOUND');
      }
      if (count !== '1') throw inputError('T01 supports exactly one part per RFQ. No draft was created.', 'UNSUPPORTED_RFQ');
      const receipt = await quotations.createDraftVersion(actor, request, { client });
      await client.query('INSERT INTO draft_submissions(actor_user_id,submission_key,request_fingerprint,rfq_id,version_id) VALUES ($1,$2,$3,$4,$5)', [actor, key, fingerprint, request.rfqId, receipt.versionId]);
      return { ...receipt, replayed: false };
    });
  };
}
