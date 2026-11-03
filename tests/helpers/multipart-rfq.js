import { randomUUID } from 'node:crypto';
import { goldenCases } from '../../apps/api/test/fixtures/golden-v02.js';

// Synthetic input transcription of the existing independent golden fixtures.
// This helper seeds documents/masters only; expected values never call the engine.
export async function multipartRfq(owner, count=3) {
  const rfqId=randomUUID(), parts=[];
  await owner.query("INSERT INTO rfqs(id,reference,customer_name,due_date,owner_label) VALUES ($1,$2,'Synthetic T03 customer','2026-11-06','estimator')",[rfqId,`SYNTH-T03-${count}-${rfqId.slice(0,8)}`]);
  const names=['materialInrPerKg','machineInrPerHour','scrapPercent','overheadPercent','packagingInrPerPiece','freightInrPerPiece'];
  const categories=['material','machine','scrap','overhead','packaging','freight'];
  const units=['INR/kg','INR/hour','percent','percent','INR/piece','INR/piece'];
  for(let index=0;index<count;index++) {
    const golden=goldenCases[index%3],partId=randomUUID(),routingRevisionId=randomUUID(),keys=names.map(()=>randomUUID());
    for(const [i,name] of names.entries()) {
      await owner.query('INSERT INTO rate_keys(id,code,category,unit) VALUES ($1,$2,$3,$4)',[keys[i],`T03-${keys[i]}`,categories[i],units[i]]);
      await owner.query("INSERT INTO rate_versions(id,rate_key_id,effective_from,value) VALUES ($1,$2,'2026-11-02',$3)",[randomUUID(),keys[i],golden.input.rates[name]]);
    }
    const partNumber=`T03-${index+1}-${golden.name}`;
    await owner.query(`INSERT INTO rfq_parts(id,rfq_id,part_number,description,gross_weight_kg,requested_annual_qty,material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id)
      VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10)`,[partId,rfqId,partNumber,golden.input.grossWeightKg,golden.input.requestedAnnualQty,keys[0],...keys.slice(2)]);
    await owner.query('INSERT INTO routing_revisions(id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) VALUES ($1,$2,1,$3,$4,$5)',[routingRevisionId,partId,keys[1],golden.input.cycleTimeMin,golden.input.setupHoursPerBatch]);
    parts.push({partId,routingRevisionId,marginPercent:golden.input.marginPercent,tierQuantities:Object.fromEntries(['50','100','150'].map((scenario,i)=>[scenario,golden.expected[i].annualQty]))});
  }
  return {rfqId,body:{pricingDate:'2026-11-02',parts}};
}

// Independently summed rounded golden unit prices × their explicit annual quantities;
// GST applies once to the combined taxable subtotal, following the accepted policy.
export const multipartTotals={
  2:[['28037460.00','5046742.80','33084202.80'],['55412640.00','9974275.20','65386915.20'],['82786140.00','14901505.20','97687645.20']],
  3:[['41787960.00','7521832.80','49309792.80'],['82650240.00','14877043.20','97527283.20'],['123511140.00','22232005.20','145743145.20']]
};
