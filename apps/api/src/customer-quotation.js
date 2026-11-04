import { transaction } from './db.js';
import { validateId, inputError } from './quotation-request.js';
import { createQuotationService } from './quotations.js';
import { createLifecycleService } from './quotation-lifecycle.js';
import { renderCustomerQuotation } from './quotation-pdf.js';

// An explicit allowlist is the confidentiality boundary. Never spread a snapshot
// or pass the internal costing DTO to the PDF library/metadata/attachments.
export function customerQuotation(snapshot, lifecycle) {
  const issued = lifecycle.events.find(event => event.eventType === 'issued');
  if (lifecycle.stale) throw inputError('A newer version exists. This version cannot produce a final customer PDF.', 'STALE_QUOTATION');
  if (lifecycle.status !== 'issued' || !issued?.quotationNumber || issued.versionId !== snapshot.versionId)
    throw inputError('Only an issued quotation can produce a final customer PDF.', 'PDF_NOT_ISSUED');
  return {
    versionId: snapshot.versionId, versionNumber: snapshot.versionNumber,
    quotationNumber: issued.quotationNumber, issuedAt: issued.occurredAt,
    pricingDate: snapshot.pricingDate, customerName: snapshot.rfq.customer_name,
    rfqReference: snapshot.rfq.reference, gstPercent: snapshot.gstPercent,
    scenarios: ['50','100','150'].map(scenario => ({
      scenario,
      lines: snapshot.parts.map(part => {
        const tier = part.result.tiers.find(value => value.scenario === scenario);
        if (!tier) throw inputError('Saved quotation is incomplete.', 'PDF_INVALID_SNAPSHOT');
        return { partNumber: part.part.part_number, description: part.part.description,
          quantity: tier.annualQty, unitPrice: tier.sellingPricePerUnitExGst, lineTotal: tier.taxableSubtotal };
      }),
      subtotal: snapshot.totals.find(total => total.scenario === scenario)?.taxableSubtotal,
      gstAmount: snapshot.totals.find(total => total.scenario === scenario)?.gstAmount,
      total: snapshot.totals.find(total => total.scenario === scenario)?.totalWithGst
    }))
  };
}

export function createCustomerQuotationService(pool, config) {
  const quotes = createQuotationService(pool, config), lifecycle = createLifecycleService(pool);
  return async (actorId, versionId) => {
    validateId(actorId); versionId = validateId(versionId);
    return transaction(pool, async client => {
      const user = (await client.query('SELECT active,role FROM users WHERE id=$1', [actorId])).rows[0];
      if (!user?.active) throw inputError('Sign in to continue.', 'AUTH_REQUIRED');
      if (!['estimator','sales_head'].includes(user.role)) throw inputError('Your role cannot download quotations.', 'ROLE_FORBIDDEN');
      // Same header as T04/creation: concurrent downloads share the lock, while
      // new versions wait. Eligibility is evaluated and the PDF assembled under
      // this lock. No lifecycle event or snapshot is written by a download.
      const locked = await client.query(`SELECT q.id FROM quotations q JOIN quotation_versions v ON v.quotation_id=q.id
        WHERE v.id=$1 FOR SHARE OF q`, [versionId]);
      if (!locked.rowCount) throw inputError('Quotation version not found.', 'QUOTATION_NOT_FOUND');
      const snapshot = await quotes.getDraftVersion(actorId, versionId, {client});
      const state = await lifecycle.status(actorId, versionId, {client});
      const data = customerQuotation(snapshot, state);
      return {buffer: await renderCustomerQuotation(data), filename: `${data.quotationNumber}.pdf`};
    });
  };
}
