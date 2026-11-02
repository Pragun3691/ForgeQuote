import { createHash, randomUUID } from 'node:crypto';
import { transaction } from './db.js';
import { inputError, validateDate, validateId } from './quotation-request.js';

export const rateCategories = ['material','machine','scrap','overhead','packaging','freight'];
function invalid(message, field) {
  throw Object.assign(inputError(message, 'INVALID_RFQ_INPUT'), { field });
}
function fields(value, names, path) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join(',') !== [...names].sort().join(',')) invalid(`Expected fields: ${names.join(', ')}.`, path);
}
function text(value, max, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(`${field} must contain 1–${max} characters without control characters.`, field);
  return value.trim();
}
function decimal(value, positive, field) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value) || (positive && !/[1-9]/.test(value))) invalid(`${field} must be a ${positive ? 'positive' : 'nonnegative'} decimal string (up to 12 integer and 6 fractional digits).`, field);
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}
export function canonicalRfq(body) {
  fields(body, ['reference','customerName','dueDate','parts'], 'rfq');
  let dueDate;
  try { dueDate = validateDate(body.dueDate); } catch { invalid('Due date must be a valid YYYY-MM-DD date.', 'dueDate'); }
  if (!Array.isArray(body.parts) || body.parts.length < 1 || body.parts.length > 20) invalid('Provide between 1 and 20 parts.', 'parts');
  const parts = body.parts.map((part, index) => {
    const path = `parts[${index}]`;
    fields(part, ['partNumber','description','grossWeightKg','requestedAnnualQty','cycleTimeMin','setupHoursPerBatch','rateKeys'], path);
    fields(part.rateKeys, rateCategories, `${path}.rateKeys`);
    if (typeof part.requestedAnnualQty !== 'string' || !/^[1-9]\d{0,9}$/.test(part.requestedAnnualQty) || BigInt(part.requestedAnnualQty) > 1000000000n) invalid('Annual quantity must be an integer string from 1 to 1000000000.', `${path}.requestedAnnualQty`);
    return {
      partNumber: text(part.partNumber, 80, `${path}.partNumber`), description: text(part.description, 500, `${path}.description`),
      grossWeightKg: decimal(part.grossWeightKg, true, `${path}.grossWeightKg`), requestedAnnualQty: part.requestedAnnualQty,
      cycleTimeMin: decimal(part.cycleTimeMin, true, `${path}.cycleTimeMin`), setupHoursPerBatch: decimal(part.setupHoursPerBatch, false, `${path}.setupHoursPerBatch`),
      rateKeys: Object.fromEntries(rateCategories.map(category => {
        try { return [category, validateId(part.rateKeys[category])]; } catch { invalid(`Select an internal ${category} rate key.`, `${path}.rateKeys.${category}`); }
      }))
    };
  });
  if (new Set(parts.map(part => part.partNumber)).size !== parts.length) invalid('Part numbers must be unique within the RFQ.', 'parts');
  return { reference: text(body.reference, 80, 'reference'), customerName: text(body.customerName, 160, 'customerName'), dueDate, parts };
}

export async function listIntakeRateKeys(pool) {
  return (await pool.query('SELECT id,code,category,unit FROM rate_keys ORDER BY category,code')).rows;
}

export function createRfqService(pool) {
  return async (actorId, submissionKey, body) => {
    const actor = validateId(actorId), key = validateId(submissionKey), request = canonicalRfq(body);
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    try {
      return await transaction(pool, async client => {
        const user = (await client.query('SELECT username,role,active FROM users WHERE id=$1', [actor])).rows[0];
        if (!user?.active) throw inputError('Sign in to continue.', 'AUTH_REQUIRED');
        if (user.role !== 'estimator') throw inputError('Only estimators may create RFQs.', 'ROLE_FORBIDDEN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`rfq:${actor}:${key}`]);
        const previous = (await client.query('SELECT rfq_id,request_fingerprint FROM rfq_submissions WHERE actor_user_id=$1 AND submission_key=$2', [actor,key])).rows[0];
        if (previous) {
          if (previous.request_fingerprint !== fingerprint) throw inputError('This RFQ submission key was used for different inputs. Recover the original request.', 'SUBMISSION_CONFLICT');
          return { rfqId: previous.rfq_id, replayed: true };
        }
        const keys = await listIntakeRateKeys(client);
        for (const [index,part] of request.parts.entries()) for (const category of rateCategories) {
          if (!keys.some(rate => rate.id === part.rateKeys[category] && rate.category === category)) invalid(`Select an existing ${category} rate key.`, `parts[${index}].rateKeys.${category}`);
        }
        const id = randomUUID();
        await client.query('INSERT INTO rfqs(id,reference,customer_name,due_date,owner_label) VALUES ($1,$2,$3,$4,$5)', [id,request.reference,request.customerName,request.dueDate,user.username]);
        for (const part of request.parts) {
          const partId = randomUUID(), rate = part.rateKeys;
          await client.query(`INSERT INTO rfq_parts(id,rfq_id,part_number,description,gross_weight_kg,requested_annual_qty,
            material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [partId,id,part.partNumber,part.description,part.grossWeightKg,part.requestedAnnualQty,rate.material,rate.scrap,rate.overhead,rate.packaging,rate.freight]);
          await client.query(`INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch)
            VALUES ($1,$2,1,$3,$4,$5)`, [randomUUID(),partId,rate.machine,part.cycleTimeMin,part.setupHoursPerBatch]);
        }
        await client.query('INSERT INTO rfq_submissions(actor_user_id,submission_key,request_fingerprint,rfq_id) VALUES ($1,$2,$3,$4)', [actor,key,fingerprint,id]);
        return { rfqId: id, replayed: false };
      });
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'rfqs_reference_key') throw inputError('An RFQ with this reference already exists. Use a unique reference.', 'RFQ_REFERENCE_CONFLICT');
      throw error;
    }
  };
}
