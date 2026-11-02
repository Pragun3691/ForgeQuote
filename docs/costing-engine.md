# Pure costing engine — Milestone 5

Implementation: `apps/api/src/costing/calculate.js`. Formula contract: approved v0.2 in `costing-spec.md` and ADR-0002. No accepted formulas or golden expectations changed.

## Public interface

```js
import { calculateCosting, calculateQuotationTotals, CostingInputError }
  from './apps/api/src/costing/calculate.js';

const result = calculateCosting({
  grossWeightKg: '0.61',
  cycleTimeMin: '3.2',
  setupHoursPerBatch: '12',
  requestedAnnualQty: '180000',
  marginPercent: '20',
  gstPercent: '18', // explicitly illustrative; passed by caller, not read from env
  rates: {
    materialInrPerKg: '100',
    machineInrPerHour: '850',
    scrapPercent: '2',
    overheadPercent: '10',
    packagingInrPerPiece: '3',
    freightInrPerPiece: '4'
  }
  // Optional tierQuantities: { '50': '90000', '100': '180000', '150': '270000' }
});
```

All scalar inputs are strings. Raw decimals are nonnegative plain notation, at most 12 integer digits and six fractional places, matching existing NUMERIC(18,6). No signs, leading-zero integers, whitespace, exponents, NaN, Infinity or numeric JS values. Margin must be below 100. All six rates and GST are required: missing values never default to zero. Field names specify units; unknown fields are rejected. Quantities are positive integer strings through 1,000,000,000.

Defaults are annual quantity times 50/100/150 percent, rounded HALF_UP to integers, minimum one. Explicit tiers require all three scenarios and baseline equal to requestedAnnualQty. No ordering/distinctness rule is invented. To edit baseline, change requestedAnnualQty in the new calculation input; any explicit baseline must match. Default tier overflow is rejected rather than clamped; valid explicit scenarios can be supplied at the supported quantity limit.

Result shape:

```text
{
  formulaVersion: 'forgequote-costing-v0.2', currency: 'INR', gstPercent,
  requestedAnnualQty, annualValueExGst,
  tiers: [{
    scenario, annualQty,
    batchPlan: { batchCount, baseBatchQty, extraUnitBatchCount },
    lines: { material, machining, scrap, overhead, packaging, freight, setup },
    costPerUnit, sellingPricePerUnitExGst,
    taxableSubtotal, gstAmount, totalWithGst
  }]
}
```

Every result leaf is a string, every money amount fixed to two decimals. annualValueExGst is baseline rounded unit price times requestedAnnualQty. No approval decision is made. Pure results contain no timestamps, database IDs or live rate lookups; the separate Milestone 6 service adds provenance and persistence (quotation-persistence.md). Inputs are never mutated. CostingInputError exposes code INVALID_COSTING_INPUT, field and message.

## Arithmetic

An isolated decimal.js clone uses 100 significant digits and HALF_UP, independent of global settings. No JS money arithmetic. Exact finite products are formed before division; machining's cycle*rate/60 is algebraically the specified cycle/60*rate, avoiding an avoidable recurring-decimal intermediate at exact rounding ties. Monetary rounding is explicit at the contract boundaries:

1. Material = round(weight * material rate).
2. Machining = round(cycle * machine rate / 60).
3. Scrap = round(rounded material * scrap percent / 100).
4. Overhead = round(rounded machining * overhead percent / 100).
5. Packaging and freight each round from their per-piece rate.
6. Setup = round(setup hours * machine rate * batch count / annual tier quantity). No intermediate rounding of setup expense per batch.
7. Sum the seven rounded lines. Price = round(cost / (1 - margin / 100)).

Batch count is min(12, annual tier quantity). Each batch gets baseBatchQty=floor(quantity/batches); the first extraUnitBatchCount=quantity mod batches batches get one more unit. For fewer than 12 units each batch contains one unit. Setup allocation uses total annual expense, not a rounded lot size. No quantity-dependent discounts.

Spindle baseline lines: 61.00 + 45.33 + 1.22 + 4.53 + 3.00 + 4.00 + 0.68 = 119.76. Divide by 0.80 = 149.70. Annual ex-GST 26,946,000.00; illustrative 18% GST 4,850,280.00; total 31,796,280.00.

## Quotation GST

calculateCosting represents a one-part quotation and computes per-scenario totals. For a future multi-part quotation use the separate pure helper, once for each combined scenario:

```js
calculateQuotationTotals({
  gstPercent: '18',
  lines: [
    { unitPriceExGst: '149.70', annualQty: '180000' },
    { unitPriceExGst: '1186.11', annualQty: '24000' }
  ]
});
```

This returns formulaVersion, currency, gstPercent, taxableSubtotal, gstAmount and totalWithGst. It sums rounded unit prices times quantities, then rounds GST once on the quotation subtotal. Never sum independently rounded part GST. Unit prices must already be fixed to two decimals; no hidden price rounding. Helper accepts at most 50 integer price digits, keeping supported arithmetic within the isolated precision. At least one line is required. GST is a required nonnegative decimal; configured demo callers use 18, while zero/other illustrative percentages are supported for arithmetic tests. No tax classification or invoice compliance is implied.

## Verification and limits

`npm.cmd run test:costing` runs independent literal fixture expectations from golden-cases.md and boundary tests. `npm.cmd test` includes them alongside existing unit/auth-configuration checks; `npm.cmd run test:db` runs the PostgreSQL/auth regressions separately.

T01 supports one machining operation per part. There is no database access in either pure function. Milestone 6 adds a separate internal transaction/rate-resolution/persistence service without changing this engine or any golden expectation. Output storage uses unconstrained NUMERIC with finite/nonnegative/exact-paise checks; large accepted results round-trip without truncation or JS-number conversion. No HTTP/frontend costing integration, approval, AI or PDF is implemented. See quotation-persistence.md and ADR-0005 for service contracts, test evidence and operational limits.
