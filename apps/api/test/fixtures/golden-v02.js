// Literal transcription of docs/golden-cases.md v0.2. Never derive these expected
// values from the calculator. Inputs beyond the original brief are demo assumptions.
export const goldenCases = [
  {
    name: 'spindle',
    input: { grossWeightKg: '0.61', cycleTimeMin: '3.2', setupHoursPerBatch: '12', requestedAnnualQty: '180000', marginPercent: '20', gstPercent: '18', rates: { materialInrPerKg: '100', machineInrPerHour: '850', scrapPercent: '2', overheadPercent: '10', packagingInrPerPiece: '3', freightInrPerPiece: '4' } },
    expected: [
      { annualQty: '90000', setup: '1.36', cost: '120.44', price: '150.55' },
      { annualQty: '180000', setup: '0.68', cost: '119.76', price: '149.70' },
      { annualQty: '270000', setup: '0.45', cost: '119.53', price: '149.41' }
    ],
    baseline: { material: '61.00', machining: '45.33', scrap: '1.22', overhead: '4.53', packaging: '3.00', freight: '4.00', setup: '0.68' },
    annualValue: '26946000.00'
  },
  {
    name: 'lift arm',
    input: { grossWeightKg: '4.60', cycleTimeMin: '11.5', setupHoursPerBatch: '24', requestedAnnualQty: '24000', marginPercent: '18', gstPercent: '18', rates: { materialInrPerKg: '130', machineInrPerHour: '1450', scrapPercent: '3', overheadPercent: '12', packagingInrPerPiece: '12', freightInrPerPiece: '16' } },
    expected: [
      { annualQty: '12000', setup: '34.80', cost: '990.01', price: '1207.33' },
      { annualQty: '24000', setup: '17.40', cost: '972.61', price: '1186.11' },
      { annualQty: '36000', setup: '11.60', cost: '966.81', price: '1179.04' }
    ],
    baseline: { material: '598.00', machining: '277.92', scrap: '17.94', overhead: '33.35', packaging: '12.00', freight: '16.00', setup: '17.40' },
    annualValue: '28466640.00'
  },
  {
    name: 'gear blank',
    input: { grossWeightKg: '1.48', cycleTimeMin: '4.8', setupHoursPerBatch: '18', requestedAnnualQty: '60000', marginPercent: '22', gstPercent: '18', rates: { materialInrPerKg: '165', machineInrPerHour: '950', scrapPercent: '2.5', overheadPercent: '11', packagingInrPerPiece: '7', freightInrPerPiece: '9' } },
    expected: [
      { annualQty: '30000', setup: '6.84', cost: '357.51', price: '458.35' },
      { annualQty: '60000', setup: '3.42', cost: '354.09', price: '453.96' },
      { annualQty: '90000', setup: '2.28', cost: '352.95', price: '452.50' }
    ],
    baseline: { material: '244.20', machining: '76.00', scrap: '6.11', overhead: '8.36', packaging: '7.00', freight: '9.00', setup: '3.42' },
    annualValue: '27237600.00'
  }
];
