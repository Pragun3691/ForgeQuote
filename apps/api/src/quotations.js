import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';
import { MissingRateError } from './rates.js';
import { calculateCosting, calculateQuotationTotals, FORMULA_VERSION } from './costing/calculate.js';

const scenarios = ['50', '100', '150'];
const rateKeys = {
  materialInrPerKg: 'material_rate_key_id', machineInrPerHour: 'machine_rate_key_id',
  scrapPercent: 'scrap_rate_key_id', overheadPercent: 'overhead_rate_key_id',
  packagingInrPerPiece: 'packaging_rate_key_id', freightInrPerPiece: 'freight_rate_key_id'
};
const moneyColumns = ['material', 'machining', 'scrap', 'overhead', 'packaging', 'freight', 'setup',
  'cost_per_unit', 'selling_price_per_unit_ex_gst', 'taxable_subtotal', 'gst_amount', 'total_with_gst'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function fields(value, required, optional = []) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      required.some(key => !Object.hasOwn(value, key)) ||
      Object.keys(value).some(key => ![...required, ...optional].includes(key))) fail('INVALID_QUOTATION_INPUT', 'Invalid quotation fields');
}
function id(value) { if (typeof value !== 'string' || !uuid.test(value)) fail('INVALID_QUOTATION_INPUT', 'Expected UUID'); }
function businessDate() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('INVALID_QUOTATION_INPUT', 'Expected valid YYYY-MM-DD pricing date');
}
async function authorize(client, actorId, write) {
  if (!actorId) fail('AUTH_REQUIRED', 'Authenticated actor required');
  id(actorId);
  const actor = (await client.query('SELECT id,role,active FROM users WHERE id=$1', [actorId])).rows[0];
  if (!actor?.active) fail('AUTH_REQUIRED', 'Active actor required');
  if (write && actor.role !== 'estimator') fail('ROLE_FORBIDDEN', 'Only estimators may create drafts');
}
// All identifiers below are module-owned constants; values are parameterized.
async function insert(client, table, row) {
  const columns = Object.keys(row);
  await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
}
const encode = value => JSON.stringify(value);
const totalsFromRow = row => ({ taxableSubtotal: row.taxable_subtotal, gstAmount: row.gst_amount, totalWithGst: row.total_with_gst });

/** Internal service. actorId MUST come from the authenticated server session.
 * Configuration is trusted server configuration, never the submitted request.
 * No automatic retry, including when COMMIT's outcome is unknown.
 */
export function createQuotationService(pool, { gstPercent }) {
  // Reuse the engine's validation, including the complete accepted GST range.
  const normalizedGst = calculateQuotationTotals({ lines: [{ unitPriceExGst: '0.00', annualQty: '1' }], gstPercent }).gstPercent;
  return {
    async createDraftVersion(actorId, request, { client: sharedClient } = {}) {
      fields(request, ['rfqId', 'parts'], ['pricingDate']);
      id(request.rfqId);
      const pricingDate = Object.hasOwn(request, 'pricingDate') ? request.pricingDate : businessDate(); date(pricingDate);
      if (!Array.isArray(request.parts) || request.parts.length === 0) fail('INVALID_QUOTATION_INPUT', 'At least one part required');
      const requestedParts = new Map();
      for (const part of request.parts) {
        fields(part, ['partId', 'routingRevisionId', 'marginPercent'], ['requestedAnnualQty', 'tierQuantities']);
        id(part.partId); id(part.routingRevisionId);
        if (requestedParts.has(part.partId.toLowerCase())) fail('INVALID_QUOTATION_INPUT', 'Duplicate part');
        requestedParts.set(part.partId.toLowerCase(), part);
      }
      const versionId = randomUUID();
      // Internal composition only: the caller owns BEGIN/COMMIT/ROLLBACK when
      // supplying a client. This keeps submission receipts and snapshots atomic.
      const create = async client => {
        await authorize(client, actorId, true);
        const rfq = (await client.query('SELECT id,reference,customer_name,due_date::text,owner_label,status FROM rfqs WHERE id=$1', [request.rfqId])).rows[0];
        if (!rfq) fail('RFQ_NOT_FOUND', 'RFQ not found');
        await client.query('INSERT INTO quotations(id,rfq_id) VALUES ($1,$2) ON CONFLICT (rfq_id) DO NOTHING', [randomUUID(), rfq.id]);
        // UPDATE locks the RFQ's single header until commit. A second creator waits
        // and increments the committed counter; a rollback restores the counter.
        const header = (await client.query('UPDATE quotations SET next_version=next_version+1 WHERE rfq_id=$1 RETURNING id,next_version-1 AS version_number', [rfq.id])).rows[0];
        // One statement gives RFQ/parts/routes/all six rates one MVCC snapshot,
        // even if maintenance appends a backdated rate during calculation.
        const masters = (await client.query(`SELECT p.*,
          jsonb_build_object('id',f.id,'reference',f.reference,'customer_name',f.customer_name,
            'due_date',f.due_date::text,'owner_label',f.owner_label,'status',f.status) AS rfq_snapshot,
          CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'part_id',r.part_id,
            'revision_number',r.revision_number,'machine_rate_key_id',r.machine_rate_key_id,
            'cycle_time_min',r.cycle_time_min::text,'setup_hours_per_batch',r.setup_hours_per_batch::text) END AS route,
          (SELECT jsonb_object_agg(keys.field, CASE WHEN rv.id IS NULL THEN 'null'::jsonb ELSE
            jsonb_build_object('id',rv.id,'rate_key_id',rv.rate_key_id,'effective_from',rv.effective_from::text,'value',rv.value::text) END)
           FROM (VALUES ${Object.entries(rateKeys).map(([field, key]) => `('${field}',${field === 'machineInrPerHour' ? 'r' : 'p'}.${key})`).join(',')}) AS keys(field,key_id)
           LEFT JOIN LATERAL (SELECT id,rate_key_id,effective_from,value FROM rate_versions
             WHERE rate_key_id=keys.key_id AND effective_from <= $3::date ORDER BY effective_from DESC LIMIT 1) rv ON true) AS resolved
          FROM rfq_parts p JOIN rfqs f ON f.id=p.rfq_id
          LEFT JOIN routing_revisions r ON r.part_id=p.id AND r.id=($2::jsonb -> p.id::text ->> 'routingRevisionId')::uuid
          WHERE p.rfq_id=$1 ORDER BY p.id`, [rfq.id, encode(Object.fromEntries(requestedParts)), pricingDate])).rows;
        if (masters.length !== requestedParts.size || masters.some(part => !requestedParts.has(part.id))) fail('INVALID_QUOTATION_INPUT', 'Supply every RFQ part exactly once');
        const parts = [];
        for (const { route, resolved, rfq_snapshot, ...master } of masters) {
          const supplied = requestedParts.get(master.id);
          if (!route) fail('ROUTING_NOT_FOUND', 'Routing revision does not belong to this part');
          if (Object.values(resolved).some(rate => rate === null)) throw new MissingRateError();
          const input = {
            grossWeightKg: master.gross_weight_kg, cycleTimeMin: route.cycle_time_min,
            setupHoursPerBatch: route.setup_hours_per_batch,
            requestedAnnualQty: Object.hasOwn(supplied, 'requestedAnnualQty') ? supplied.requestedAnnualQty : master.requested_annual_qty,
            marginPercent: supplied.marginPercent, gstPercent: normalizedGst,
            rates: Object.fromEntries(Object.entries(resolved).map(([field, rate]) => [field, rate.value])),
            ...(supplied.tierQuantities === undefined ? {} : { tierQuantities: supplied.tierQuantities })
          };
          parts.push({ id: randomUUID(), master, route, resolved, input, result: calculateCosting(input) });
        }
        const totals = scenarios.map((scenario, index) => ({ scenario, ...calculateQuotationTotals({ gstPercent, lines: parts.map(part => ({ unitPriceExGst: part.result.tiers[index].sellingPricePerUnitExGst, annualQty: part.result.tiers[index].annualQty })) }) }));
        await insert(client, 'quotation_versions', {
          id: versionId, quotation_id: header.id, version_number: header.version_number,
          pricing_date: pricingDate, formula_version: FORMULA_VERSION, currency: 'INR',
          gst_percent: gstPercent, created_by: actorId, rfq_snapshot: encode(masters[0].rfq_snapshot), annual_value_ex_gst: totals[1].taxableSubtotal
        });
        for (const part of parts) {
          await insert(client, 'quotation_parts', {
            id: part.id, version_id: versionId, part_id: part.master.id, routing_revision_id: part.route.id,
            part_snapshot: encode(part.master), routing_snapshot: encode(part.route), input_snapshot: encode(part.input),
            annual_value_ex_gst: part.result.annualValueExGst
          });
          for (const [field, rate] of Object.entries(part.resolved)) await insert(client, 'quotation_rates', {
            version_id: versionId, quotation_part_id: part.id, field, rate_version_id: rate.id,
            rate_key_id: rate.rate_key_id, effective_from: rate.effective_from, value: rate.value
          });
          for (const tier of part.result.tiers) await insert(client, 'quotation_part_tiers', {
            version_id: versionId, quotation_part_id: part.id, scenario: tier.scenario, annual_qty: tier.annualQty,
            batch_count: tier.batchPlan.batchCount, base_batch_qty: tier.batchPlan.baseBatchQty, extra_unit_batch_count: tier.batchPlan.extraUnitBatchCount,
            ...tier.lines, cost_per_unit: tier.costPerUnit, selling_price_per_unit_ex_gst: tier.sellingPricePerUnitExGst,
            taxable_subtotal: tier.taxableSubtotal, gst_amount: tier.gstAmount, total_with_gst: tier.totalWithGst
          });
        }
        for (const total of totals) await insert(client, 'quotation_totals', {
          version_id: versionId, scenario: total.scenario, taxable_subtotal: total.taxableSubtotal,
          gst_amount: total.gstAmount, total_with_gst: total.totalWithGst
        });
      };
      if (sharedClient) await create(sharedClient);
      else await transaction(pool, create);
      // Standalone calls have committed here; composed calls leave commit to
      // their caller. No extra post-COMMIT lookup can obscure a successful write.
      return { versionId };
    },
    async getDraftVersion(actorId, versionId) {
      id(versionId);
      return transaction(pool, async client => {
        await authorize(client, actorId, false);
        const version = (await client.query('SELECT *,pricing_date::text FROM quotation_versions WHERE id=$1', [versionId])).rows[0];
        if (!version) fail('QUOTATION_NOT_FOUND', 'Quotation version not found');
        const parts = (await client.query('SELECT * FROM quotation_parts WHERE version_id=$1 ORDER BY part_id', [versionId])).rows;
        const rates = (await client.query('SELECT *,effective_from::text FROM quotation_rates WHERE version_id=$1 ORDER BY field', [versionId])).rows;
        const tiers = (await client.query('SELECT * FROM quotation_part_tiers WHERE version_id=$1 ORDER BY scenario::integer', [versionId])).rows;
        const totals = (await client.query('SELECT * FROM quotation_totals WHERE version_id=$1 ORDER BY scenario::integer', [versionId])).rows;
        return {
          versionId: version.id, quotationId: version.quotation_id, versionNumber: version.version_number,
          status: version.status, pricingDate: version.pricing_date, formulaVersion: version.formula_version,
          currency: version.currency, gstPercent: version.gst_percent, createdBy: version.created_by,
          createdAt: version.created_at.toISOString(), rfq: version.rfq_snapshot,
          annualValueExGst: version.annual_value_ex_gst,
          parts: parts.map(part => ({
            quotationPartId: part.id, partId: part.part_id, routingRevisionId: part.routing_revision_id,
            part: part.part_snapshot, routing: part.routing_snapshot, input: part.input_snapshot,
            rates: Object.fromEntries(rates.filter(rate => rate.quotation_part_id === part.id).map(rate => [rate.field, {
              rateVersionId: rate.rate_version_id, rateKeyId: rate.rate_key_id, effectiveFrom: rate.effective_from, value: rate.value
            }])),
            result: {
              formulaVersion: version.formula_version, currency: version.currency, gstPercent: part.input_snapshot.gstPercent,
              requestedAnnualQty: part.input_snapshot.requestedAnnualQty, annualValueExGst: part.annual_value_ex_gst,
              tiers: tiers.filter(tier => tier.quotation_part_id === part.id).map(tier => ({
                scenario: tier.scenario, annualQty: tier.annual_qty,
                batchPlan: { batchCount: tier.batch_count, baseBatchQty: tier.base_batch_qty, extraUnitBatchCount: tier.extra_unit_batch_count },
                lines: Object.fromEntries(moneyColumns.slice(0, 7).map(column => [column, tier[column]])),
                costPerUnit: tier.cost_per_unit, sellingPricePerUnitExGst: tier.selling_price_per_unit_ex_gst, ...totalsFromRow(tier)
              }))
            }
          })),
          totals: totals.map(total => ({ scenario: total.scenario, ...totalsFromRow(total) }))
        };
      });
    }
  };
}

/** Diagnostic only: saved inputs + explicit formula dispatch, no master lookups.
 * Keep old implementations when introducing a new formula version.
 */
export function reproduceDraftVersion(snapshot) {
  if (snapshot.formulaVersion !== FORMULA_VERSION) fail('UNSUPPORTED_FORMULA_VERSION', 'Saved formula version is unavailable');
  const parts = snapshot.parts.map(part => calculateCosting(part.input));
  return {
    parts,
    totals: scenarios.map((scenario, index) => ({ scenario, ...calculateQuotationTotals({
      gstPercent: snapshot.gstPercent, lines: parts.map(part => ({ unitPriceExGst: part.tiers[index].sellingPricePerUnitExGst, annualQty: part.tiers[index].annualQty }))
    }) }))
  };
}
