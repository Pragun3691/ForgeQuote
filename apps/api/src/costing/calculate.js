import Decimal from 'decimal.js';

// Isolated from other code changing decimal.js's global settings. Input bounds below
// keep every finite intermediate well within this precision before explicit rounding.
const D = Decimal.clone({ precision: 100, rounding: Decimal.ROUND_HALF_UP });
export const FORMULA_VERSION = 'forgequote-costing-v0.2';
const scenarios = ['50', '100', '150'];
const rateFields = ['materialInrPerKg', 'machineInrPerHour', 'scrapPercent', 'overheadPercent', 'packagingInrPerPiece', 'freightInrPerPiece'];
const inputFields = ['grossWeightKg', 'cycleTimeMin', 'setupHoursPerBatch', 'requestedAnnualQty', 'marginPercent', 'rates', 'gstPercent'];

export class CostingInputError extends Error {
  constructor(field, message) {
    super(`${field}: ${message}`);
    this.name = 'CostingInputError';
    this.code = 'INVALID_COSTING_INPUT';
    this.field = field;
  }
}

function record(value, field, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new CostingInputError(field, 'expected a plain object');
  for (const key of required) if (!Object.hasOwn(value, key)) throw new CostingInputError(`${field}.${key}`, 'required');
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) throw new CostingInputError(`${field}.${key}`, 'unsupported field');
}

function decimal(value, field) {
  // Compatible with existing NUMERIC(18,6): 12 integer digits, 6 fractional digits.
  const pattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
  if (typeof value !== 'string' || !pattern.test(value)) throw new CostingInputError(field, 'expected nonnegative plain decimal string, at most 12 integer and 6 fractional digits');
  return new D(value);
}

function quantity(value, field) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value) || new D(value).gt('1000000000')) throw new CostingInputError(field, 'expected integer string from 1 to 1000000000');
  return new D(value);
}

const round = value => value.toDecimalPlaces(2, D.ROUND_HALF_UP);
const money = value => value.toFixed(2, D.ROUND_HALF_UP);

function taxTotals(taxableSubtotal, gst) {
  const gstAmount = round(taxableSubtotal.times(gst).div('100'));
  return { taxableSubtotal: money(taxableSubtotal), gstAmount: money(gstAmount), totalWithGst: money(taxableSubtotal.plus(gstAmount)) };
}

/** GST on the quotation subtotal, never the sum of individually rounded part GST.
 * unitPriceExGst values must already be rounded to paise by the costing engine.
 */
export function calculateQuotationTotals(input) {
  record(input, 'quotation', ['lines', 'gstPercent']);
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new CostingInputError('quotation.lines', 'at least one line required');
  const gst = decimal(input.gstPercent, 'quotation.gstPercent');
  let subtotal = new D('0');
  for (const [index, line] of input.lines.entries()) {
    const field = `quotation.lines[${index}]`;
    record(line, field, ['unitPriceExGst', 'annualQty']);
    // Calculated unit prices may exceed raw-rate NUMERIC(18,6) input bounds.
    if (typeof line.unitPriceExGst !== 'string' || !/^(?:0|[1-9]\d{0,49})\.\d{2}$/.test(line.unitPriceExGst)) throw new CostingInputError(`${field}.unitPriceExGst`, 'expected fixed two-decimal nonnegative price, at most 50 integer digits');
    subtotal = subtotal.plus(new D(line.unitPriceExGst).times(quantity(line.annualQty, `${field}.annualQty`)));
  }
  return { formulaVersion: FORMULA_VERSION, currency: 'INR', gstPercent: gst.toFixed(), ...taxTotals(subtotal, gst) };
}

/** Pure one-part, one-operation costing. All input quantities/rates are strings.
 * Optional tierQuantities must supply all three scenarios; baseline equals requested.
 * No database, clock, environment or global decimal configuration is consulted.
 */
export function calculateCosting(input) {
  record(input, 'input', inputFields, ['tierQuantities']);
  record(input.rates, 'input.rates', rateFields);
  const weight = decimal(input.grossWeightKg, 'input.grossWeightKg');
  const cycle = decimal(input.cycleTimeMin, 'input.cycleTimeMin');
  const setupHours = decimal(input.setupHoursPerBatch, 'input.setupHoursPerBatch');
  const requested = quantity(input.requestedAnnualQty, 'input.requestedAnnualQty');
  const margin = decimal(input.marginPercent, 'input.marginPercent');
  if (margin.gte('100')) throw new CostingInputError('input.marginPercent', 'must be at least 0 and below 100');
  const gst = decimal(input.gstPercent, 'input.gstPercent');
  const rates = Object.fromEntries(rateFields.map(field => [field, decimal(input.rates[field], `input.rates.${field}`)]));

  let quantities;
  if (Object.hasOwn(input, 'tierQuantities')) {
    record(input.tierQuantities, 'input.tierQuantities', scenarios);
    quantities = scenarios.map(scenario => quantity(input.tierQuantities[scenario], `input.tierQuantities.${scenario}`));
  } else {
    quantities = scenarios.map(scenario => {
      const generated = D.max('1', requested.times(scenario).div('100').toDecimalPlaces(0, D.ROUND_HALF_UP));
      return quantity(generated.toFixed(0), `input.tierQuantities.${scenario}`);
    });
  }
  if (!quantities[1].eq(requested)) throw new CostingInputError('input.tierQuantities.100', 'baseline must equal requestedAnnualQty in this calculation input');

  const material = round(weight.times(rates.materialInrPerKg));
  // Multiply the exact numerator first: algebraically cycle/60*rate, without
  // introducing a recurring decimal before a potentially exact paise tie.
  const machining = round(cycle.times(rates.machineInrPerHour).div('60'));
  const shared = {
    material, machining,
    scrap: round(material.times(rates.scrapPercent).div('100')),
    overhead: round(machining.times(rates.overheadPercent).div('100')),
    packaging: round(rates.packagingInrPerPiece), freight: round(rates.freightInrPerPiece)
  };
  const setupPerBatch = setupHours.times(rates.machineInrPerHour);
  const tiers = quantities.map((annualQty, index) => {
    const batchCount = D.min('12', annualQty);
    const lines = { ...shared, setup: round(setupPerBatch.times(batchCount).div(annualQty)) };
    const cost = Object.values(lines).reduce((sum, line) => sum.plus(line), new D('0'));
    const price = round(cost.div(new D('1').minus(margin.div('100'))));
    return {
      scenario: scenarios[index], annualQty: annualQty.toFixed(0),
      batchPlan: { batchCount: batchCount.toFixed(0), baseBatchQty: annualQty.divToInt(batchCount).toFixed(0), extraUnitBatchCount: annualQty.mod(batchCount).toFixed(0) },
      lines: Object.fromEntries(Object.entries(lines).map(([name, value]) => [name, money(value)])),
      costPerUnit: money(cost), sellingPricePerUnitExGst: money(price),
      ...taxTotals(price.times(annualQty), gst)
    };
  });
  return {
    formulaVersion: FORMULA_VERSION, currency: 'INR', gstPercent: gst.toFixed(),
    requestedAnnualQty: requested.toFixed(0),
    annualValueExGst: money(new D(tiers[1].sellingPricePerUnitExGst).times(requested)),
    tiers
  };
}
