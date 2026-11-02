import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { calculateCosting, calculateQuotationTotals, CostingInputError } from '../src/costing/calculate.js';
import { goldenCases } from './fixtures/golden-v02.js';

const spindle = () => structuredClone(goldenCases[0].input);
const baseline = input => calculateCosting(input).tiers[1];
const invalid = fn => assert.throws(fn, error => error instanceof CostingInputError && error.code === 'INVALID_COSTING_INPUT' && typeof error.field === 'string');
const zero = () => ({ grossWeightKg: '0', cycleTimeMin: '0', setupHoursPerBatch: '0', requestedAnnualQty: '24', marginPercent: '0', gstPercent: '18', rates: { materialInrPerKg: '0', machineInrPerHour: '0', scrapPercent: '0', overheadPercent: '0', packagingInrPerPiece: '0', freightInrPerPiece: '0' } });

for (const fixture of goldenCases) {
  for (const [index, expected] of fixture.expected.entries()) {
    test(`golden v0.2: ${fixture.name} ${['50', '100', '150'][index]}%`, () => {
      const tier = calculateCosting(fixture.input).tiers[index];
      assert.equal(tier.annualQty, expected.annualQty);
      assert.equal(tier.batchPlan.batchCount, '12');
      assert.equal(tier.lines.setup, expected.setup);
      assert.equal(tier.costPerUnit, expected.cost);
      assert.equal(tier.sellingPricePerUnitExGst, expected.price);
    });
  }
  test(`full approved baseline breakdown and annual value: ${fixture.name}`, () => {
    const result = calculateCosting(fixture.input);
    assert.deepEqual(result.tiers[1].lines, fixture.baseline);
    assert.equal(result.annualValueExGst, fixture.annualValue);
    assert.equal(result.formulaVersion, 'forgequote-costing-v0.2');
    assert.equal(result.currency, 'INR');
  });
}

test('round half-up ties and percentage bases use already rounded lines', () => {
  const input = zero();
  Object.assign(input, { grossWeightKg: '1', cycleTimeMin: '0.3' });
  Object.assign(input.rates, { materialInrPerKg: '1.005', machineInrPerHour: '1', scrapPercent: '50', overheadPercent: '50', packagingInrPerPiece: '1.005', freightInrPerPiece: '1.004' });
  const result = baseline(input);
  assert.deepEqual(result.lines, { material: '1.01', machining: '0.01', scrap: '0.51', overhead: '0.01', packaging: '1.01', freight: '1.00', setup: '0.00' });
  assert.equal(result.costPerUnit, '3.55');
  assert.equal(result.sellingPricePerUnitExGst, '3.55');
});

test('sum rounded lines, rather than rounding the sum of raw lines', () => {
  const input = zero(); Object.assign(input, { grossWeightKg: '1', cycleTimeMin: '0.24' });
  Object.assign(input.rates, { materialInrPerKg: '0.004', machineInrPerHour: '1' });
  assert.equal(baseline(input).costPerUnit, '0.00');
});

test('selling price rounds a half-paisa tie after dividing by gross-margin complement', () => {
  const input = zero(); input.grossWeightKg = '1'; input.rates.materialInrPerKg = '1.01'; input.marginPercent = '60';
  assert.equal(baseline(input).sellingPricePerUnitExGst, '2.53');
});

test('setup per batch is not rounded before annual allocation', () => {
  const input = zero(); input.setupHoursPerBatch = '0.005'; input.rates.machineInrPerHour = '1';
  assert.deepEqual(calculateCosting(input).tiers.map(tier => tier.lines.setup), ['0.01', '0.00', '0.00']);
});

test('zero margin, explicit zero rates and supported six-place margin', () => {
  const input = spindle(); input.marginPercent = '0';
  assert.equal(baseline(input).sellingPricePerUnitExGst, '119.76');
  assert.equal(calculateCosting(zero()).annualValueExGst, '0.00');
  input.marginPercent = '99.999999';
  assert.equal(baseline(input).sellingPricePerUnitExGst, '11976000000.00');
});

test('negative, 100%-plus, malformed and unsupported margin precision rejected', () => {
  for (const marginPercent of ['-1', '-0.000001', '100', '100.000000', '120', 'NaN', 'Infinity', '1e1', '0.0000001', 20, null]) {
    const input = spindle(); input.marginPercent = marginPercent;
    invalid(() => calculateCosting(input));
  }
});

test('invalid requested or editable tier quantities rejected', () => {
  for (const value of ['0', '-1', '1.5', '1.0', '01', '1e3', ' 1', '1000000001', 1, null, undefined]) {
    const input = spindle(); input.requestedAnnualQty = value; invalid(() => calculateCosting(input));
    const tierInput = spindle(); tierInput.tierQuantities = { '50': value, '100': '180000', '150': '270000' }; invalid(() => calculateCosting(tierInput));
  }
});

test('default odd quantities use whole-unit HALF_UP and minimum one', () => {
  const input = spindle(); input.requestedAnnualQty = '5';
  assert.deepEqual(calculateCosting(input).tiers.map(tier => tier.annualQty), ['3', '5', '8']);
  input.requestedAnnualQty = '1';
  const result = calculateCosting(input);
  assert.deepEqual(result.tiers.map(tier => tier.annualQty), ['1', '1', '2']);
  for (const tier of result.tiers) {
    assert.equal(tier.batchPlan.batchCount, tier.annualQty);
    assert.equal(tier.batchPlan.baseBatchQty, '1');
    assert.equal(tier.batchPlan.extraUnitBatchCount, '0');
    assert.equal(tier.lines.setup, '10200.00');
    assert.equal(tier.costPerUnit, '10319.08');
    assert.equal(tier.sellingPricePerUnitExGst, '12898.85');
  }
});

test('12-batch transition and uneven integer lot distribution', () => {
  const input = spindle();
  for (const qty of ['11', '12']) { input.requestedAnnualQty = qty; assert.equal(baseline(input).lines.setup, '10200.00'); }
  input.requestedAnnualQty = '13';
  assert.deepEqual(baseline(input).batchPlan, { batchCount: '12', baseBatchQty: '1', extraUnitBatchCount: '1' });
  assert.equal(baseline(input).lines.setup, '9415.38');
});

test('editable scenarios allow duplicates and no invented ordering rule; baseline must match', () => {
  const input = spindle(); input.tierQuantities = { '50': '200000', '100': '180000', '150': '1' };
  assert.deepEqual(calculateCosting(input).tiers.map(tier => tier.annualQty), ['200000', '180000', '1']);
  input.tierQuantities = { '50': '180000', '100': '180000', '150': '180000' };
  assert.equal(calculateCosting(input).annualValueExGst, '26946000.00');
  input.tierQuantities['100'] = '180001'; invalid(() => calculateCosting(input));
});

test('quantity maximum accepted with explicit scenarios; generated overflow fails, never clamps', () => {
  const input = spindle(); input.requestedAnnualQty = '1000000000';
  invalid(() => calculateCosting(input));
  input.tierQuantities = { '50': '1000000000', '100': '1000000000', '150': '1000000000' };
  assert.equal(baseline(input).costPerUnit, '119.08');
  assert.equal(baseline(input).sellingPricePerUnitExGst, '148.85');
  assert.equal(calculateCosting(input).annualValueExGst, '148850000000.00');
});

test('all required scalar fields and all six resolved rates are required, never defaulted', () => {
  for (const key of Object.keys(spindle())) { const input = spindle(); delete input[key]; invalid(() => calculateCosting(input)); }
  for (const key of Object.keys(spindle().rates)) { const input = spindle(); delete input.rates[key]; invalid(() => calculateCosting(input)); }
  for (const input of [null, undefined, [], 'input']) invalid(() => calculateCosting(input));
  const input = spindle(); input.tierQuantities = { '100': '180000' }; invalid(() => calculateCosting(input));
});

test('malformed, signed, exponent, over-precision and out-of-NUMERIC-range decimal inputs rejected', () => {
  for (const value of ['', ' ', ' 1', '1 ', '+1', '-0', 'NaN', 'Infinity', '1e2', '.5', '1.', '01', '0.0000001', '1000000000000', 0.61, null, {}, undefined]) {
    const input = spindle(); input.grossWeightKg = value; invalid(() => calculateCosting(input));
    const rateInput = spindle(); rateInput.rates.machineInrPerHour = value; invalid(() => calculateCosting(rateInput));
  }
  for (const field of ['cycleTimeMin', 'setupHoursPerBatch', 'gstPercent']) { const input = spindle(); input[field] = '-1'; invalid(() => calculateCosting(input)); }
  const input = spindle(); input.grossWeightLb = '1'; invalid(() => calculateCosting(input));
  const rateInput = spindle(); rateInput.rates.materialInrPerLb = '1'; invalid(() => calculateCosting(rateInput));
});

test('explicit six-place maximum raw rate is supported without implicit NUMERIC rounding', () => {
  const input = zero(); input.rates.packagingInrPerPiece = '999999999999.999999';
  assert.equal(baseline(input).lines.packaging, '1000000000000.00');
});

test('spindle illustrative 18% GST is separate from unit price and annual ex-GST value', () => {
  const result = calculateCosting(spindle()); const tier = result.tiers[1];
  assert.equal(result.gstPercent, '18');
  assert.equal(tier.taxableSubtotal, '26946000.00');
  assert.equal(tier.gstAmount, '4850280.00');
  assert.equal(tier.totalWithGst, '31796280.00');
  assert.equal(tier.sellingPricePerUnitExGst, '149.70');
  assert.equal(result.annualValueExGst, '26946000.00');
});

test('quotation tax sums rounded unit prices times quantities across parts before GST', () => {
  const totals = calculateQuotationTotals({ gstPercent: '18', lines: [
    { unitPriceExGst: '149.70', annualQty: '180000' },
    { unitPriceExGst: '1186.11', annualQty: '24000' },
    { unitPriceExGst: '453.96', annualQty: '60000' }
  ] });
  assert.deepEqual(totals, { formulaVersion: 'forgequote-costing-v0.2', currency: 'INR', gstPercent: '18', taxableSubtotal: '82650240.00', gstAmount: '14877043.20', totalWithGst: '97527283.20' });
  const small = calculateQuotationTotals({ gstPercent: '18', lines: [{ unitPriceExGst: '0.03', annualQty: '1' }, { unitPriceExGst: '0.03', annualQty: '1' }] });
  assert.equal(small.taxableSubtotal, '0.06'); assert.equal(small.gstAmount, '0.01'); assert.equal(small.totalWithGst, '0.07');
});

test('configurable illustrative GST includes zero and HALF_UP tax ties', () => {
  const input = spindle(); input.gstPercent = '0';
  assert.equal(baseline(input).gstAmount, '0.00'); assert.equal(baseline(input).totalWithGst, '26946000.00');
  assert.equal(calculateQuotationTotals({ gstPercent: '50', lines: [{ unitPriceExGst: '1.01', annualQty: '1' }] }).gstAmount, '0.51');
});

test('quotation tax rejects missing fields, unrounded prices, malformed lines and quantities', () => {
  for (const input of [null, {}, { gstPercent: '18', lines: [] }, { gstPercent: '18', lines: [null] }, { gstPercent: '-1', lines: [{ unitPriceExGst: '1.00', annualQty: '1' }] }]) invalid(() => calculateQuotationTotals(input));
  for (const price of ['1', '1.005', 'NaN', '1e2', '-1.00', 1]) invalid(() => calculateQuotationTotals({ gstPercent: '18', lines: [{ unitPriceExGst: price, annualQty: '1' }] }));
  invalid(() => calculateQuotationTotals({ gstPercent: '18', lines: [{ unitPriceExGst: '1.00', annualQty: '0' }] }));
});

test('all result leaves are strings, with fixed two-decimal monetary outputs', () => {
  function stringsOnly(value) {
    if (value && typeof value === 'object') for (const child of Object.values(value)) stringsOnly(child);
    else assert.equal(typeof value, 'string');
  }
  const result = calculateCosting(spindle()); stringsOnly(result);
  for (const tier of result.tiers) for (const money of [...Object.values(tier.lines), tier.costPerUnit, tier.sellingPricePerUnitExGst, tier.taxableSubtotal, tier.gstAmount, tier.totalWithGst]) assert.match(money, /^\d+\.\d{2}$/);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test('repeated calculations are deterministic, inputs immutable, returned objects independent', () => {
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  const editable = spindle(); editable.tierQuantities = { '50': '90000', '100': '180000', '150': '270000' };
  const input = freeze(editable); const before = JSON.stringify(input);
  const first = calculateCosting(input); const second = calculateCosting(input);
  assert.deepEqual(first, second); assert.equal(JSON.stringify(input), before);
  first.tiers[0].lines.material = 'changed';
  assert.deepEqual(calculateCosting(input), second);
  const quotation = freeze({ gstPercent: '18', lines: [{ unitPriceExGst: '149.70', annualQty: '180000' }] });
  const quoteBefore = JSON.stringify(quotation);
  assert.deepEqual(calculateQuotationTotals(quotation), calculateQuotationTotals(quotation));
  assert.equal(JSON.stringify(quotation), quoteBefore);
});

test('external changes to global decimal.js precision/rounding cannot change costing', () => {
  const original = { precision: Decimal.precision, rounding: Decimal.rounding };
  try { Decimal.set({ precision: 3, rounding: Decimal.ROUND_DOWN }); assert.equal(baseline(spindle()).sellingPricePerUnitExGst, '149.70'); }
  finally { Decimal.set(original); }
});
