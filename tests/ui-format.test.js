import test from 'node:test';
import assert from 'node:assert/strict';
import {grouped, money, rateLabel, dateLabel, timestamp} from '../apps/web/src/format.js';

test('display preserves exact decimal digits and Indian grouping without Number coercion',()=>{
  assert.equal(money('2500000.00'),'₹25,00,000.00');
  assert.equal(money('9007199254740993.01'),'₹9,00,71,99,25,47,40,993.01');
  assert.equal(grouped('123456.123456'),'1,23,456.123456');
  assert.equal(grouped('-1234.50'),'-1,234.50');
  assert.equal(money('0.00'),'₹0.00');
});
test('compact rate display trims zeros only, retaining significant digits and exact source',()=>{
  const source='9007199254740993.010000';
  assert.equal(rateLabel('100.000000'),'100');
  assert.equal(rateLabel('123456.123400'),'1,23,456.1234');
  assert.equal(rateLabel('0.000001'),'0.000001');
  assert.equal(rateLabel('1.000010'),'1.00001');
  assert.equal(rateLabel('0.000000'),'0');
  assert.equal(rateLabel(source),'9,00,71,99,25,47,40,993.01');
  assert.equal(source,'9007199254740993.010000');
  assert.equal(money('149.70'),'₹149.70');
});
test('date-only values retain their day and UTC timestamps use Kolkata time',()=>{
  assert.equal(dateLabel('2026-11-09'),'09 Nov 2026');
  assert.equal(dateLabel('2026-11-08T20:00:00Z'),'09 Nov 2026');
  assert.equal(timestamp('2026-11-08T20:00:00Z'),'09 Nov 2026, 01:30 IST');
});
