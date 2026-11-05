import { inputError, validateId } from './quotation-request.js';

const statusSql=`COALESCE((SELECT o.outcome FROM rfq_outcomes o WHERE o.rfq_id=r.id),
  CASE WHEN EXISTS (SELECT 1 FROM quotations q JOIN quotation_versions v ON v.quotation_id=q.id
    JOIN quotation_events e ON e.version_id=v.id WHERE q.rfq_id=r.id AND e.event_type='issued') THEN 'sent' ELSE 'estimating' END)`;
const assignedSql=`COALESCE((SELECT u.username FROM rfq_submissions s JOIN users u ON u.id=s.actor_user_id WHERE s.rfq_id=r.id),r.owner_label)`;
export async function listRfqs(pool) {
  return (await pool.query(`SELECT r.id,r.reference,r.customer_name AS "customerName",r.due_date::text AS "dueDate",
    r.owner_label AS "ownerLabel",${assignedSql} AS "assignedEstimator",${statusSql} AS status,(SELECT count(*) FROM rfq_parts p WHERE p.rfq_id=r.id) AS "partCount"
    FROM rfqs r ORDER BY r.due_date,r.reference`)).rows;
}
export async function getRfq(pool, value) {
  const id = validateId(value);
  const rfq = (await pool.query(`SELECT r.id,r.reference,r.customer_name AS "customerName",r.due_date::text AS "dueDate",
    r.owner_label AS "ownerLabel",${assignedSql} AS "assignedEstimator",${statusSql} AS status FROM rfqs r WHERE r.id=$1`, [id])).rows[0];
  if (!rfq) throw inputError('RFQ not found.', 'RFQ_NOT_FOUND');
  const parts = (await pool.query(`SELECT id,part_number AS "partNumber",description,gross_weight_kg AS "grossWeightKg",
    requested_annual_qty AS "requestedAnnualQty" FROM rfq_parts WHERE rfq_id=$1 ORDER BY part_number`, [id])).rows;
  const routes = (await pool.query(`SELECT r.id,r.part_id AS "partId",r.revision_number AS "revisionNumber",
    r.cycle_time_min AS "cycleTimeMin",r.setup_hours_per_batch AS "setupHoursPerBatch",k.code AS "machineCode"
    FROM routing_revisions r JOIN rfq_parts p ON p.id=r.part_id JOIN rate_keys k ON k.id=r.machine_rate_key_id
    WHERE p.rfq_id=$1 ORDER BY r.revision_number DESC`, [id])).rows;
  const versions = (await pool.query(`SELECT v.id,v.version_number AS "versionNumber",v.pricing_date::text AS "pricingDate",v.created_at AS "createdAt"
    FROM quotation_versions v JOIN quotations q ON q.id=v.quotation_id WHERE q.rfq_id=$1 ORDER BY v.version_number DESC`, [id])).rows;
  const outcomes=(await pool.query(`SELECT o.outcome,o.reason,o.occurred_at AS "occurredAt",o.actor_user_id AS "actorId",u.username AS actor
    FROM rfq_outcomes o JOIN users u ON u.id=o.actor_user_id WHERE o.rfq_id=$1`,[id])).rows;
  return { ...rfq,outcomes, businessDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    parts: parts.map(part => ({ ...part, routes: routes.filter(route => route.partId === part.id),
      defaultTierQuantities: Object.fromEntries(['50','100','150'].map(scenario => {
        const tier = (BigInt(part.requestedAnnualQty) * BigInt(scenario) + 50n) / 100n;
        return [scenario, (tier < 1n ? 1n : tier).toString()];
      })) })), versions };
}
