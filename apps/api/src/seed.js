import { transaction } from './db.js';

export const fixtureId = number => `26110100-0000-4000-8000-${String(number).padStart(12, '0')}`;
const rates = [
  ['EN8', 'material', 'INR/kg', '100.000000'],
  ['SPINDLE_MACHINE', 'machine', 'INR/hour', '850.000000'],
  ['SPINDLE_SCRAP', 'scrap', 'percent', '2.000000'],
  ['SPINDLE_OVERHEAD', 'overhead', 'percent', '10.000000'],
  ['SPINDLE_PACKAGING', 'packaging', 'INR/piece', '3.000000'],
  ['SPINDLE_FREIGHT', 'freight', 'INR/piece', '4.000000']
];

// Insert missing fixture rows; never overwrite user data or silently accept fixture drift.
async function insertFixture(client, table, row) {
  const columns = Object.keys(row);
  await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`, Object.values(row));
  const result = await client.query(`SELECT ${columns.join(',')} FROM ${table} WHERE id=$1`, [row.id]);
  if (result.rowCount !== 1 || columns.some(column => String(result.rows[0][column]) !== String(row[column]))) {
    throw new Error(`Synthetic fixture mismatch in ${table}; refusing to overwrite`);
  }
}

export async function seed(pool) {
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(261102)');
    for (const [index, [code, category, unit, value]] of rates.entries()) {
      await insertFixture(client, 'rate_keys', { id: fixtureId(index + 1), code, category, unit });
      // Date cast in verification keeps transport independent of local timezone.
      await client.query('INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [fixtureId(index + 11), fixtureId(index + 1), '2026-11-02', value]);
      const existing = await client.query("SELECT rate_key_id, effective_from::text, value FROM rate_versions WHERE id=$1", [fixtureId(index + 11)]);
      const row = existing.rows[0];
      if (!row || row.rate_key_id !== fixtureId(index + 1) || row.effective_from !== '2026-11-02' || row.value !== value) throw Error('Synthetic rate fixture mismatch; refusing to overwrite');
    }
    await client.query("INSERT INTO rfqs(id,reference,customer_name,due_date,owner_label) VALUES ($1,'RFQ-2611-014','Synthetic Demo Customer','2026-11-06','Demo estimator') ON CONFLICT DO NOTHING", [fixtureId(21)]);
    const rfq = await client.query("SELECT reference, customer_name, due_date::text, owner_label FROM rfqs WHERE id=$1", [fixtureId(21)]);
    if (JSON.stringify(rfq.rows[0]) !== JSON.stringify({ reference: 'RFQ-2611-014', customer_name: 'Synthetic Demo Customer', due_date: '2026-11-06', owner_label: 'Demo estimator' })) throw Error('Synthetic RFQ fixture mismatch; refusing to overwrite');
    await insertFixture(client, 'rfq_parts', {
      id: fixtureId(22), rfq_id: fixtureId(21), part_number: 'SPINDLE-DEMO', description: 'Rear-wheel spindle',
      gross_weight_kg: '0.610000', requested_annual_qty: '180000', material_rate_key_id: fixtureId(1),
      scrap_rate_key_id: fixtureId(3), overhead_rate_key_id: fixtureId(4), packaging_rate_key_id: fixtureId(5), freight_rate_key_id: fixtureId(6)
    });
    await insertFixture(client, 'routing_revisions', {
      id: fixtureId(23), part_id: fixtureId(22), revision_number: 1, machine_rate_key_id: fixtureId(2),
      cycle_time_min: '3.200000', setup_hours_per_batch: '12.000000'
    });
  });
}
