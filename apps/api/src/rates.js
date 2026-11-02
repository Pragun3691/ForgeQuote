export class MissingRateError extends Error {
  constructor() { super('No effective rate exists for the selected pricing date'); this.code = 'RATE_NOT_FOUND'; }
}

export async function resolveRate(client, rateKeyId, pricingDate) {
  const result = await client.query(`
    SELECT id, rate_key_id, value, effective_from::text
    FROM rate_versions WHERE rate_key_id=$1 AND effective_from <= $2::date
    ORDER BY effective_from DESC LIMIT 1`, [rateKeyId, pricingDate]);
  if (!result.rowCount) throw new MissingRateError();
  return result.rows[0];
}
