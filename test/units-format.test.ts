// §17 units.format — imperial/metric formatting, the 12" rollover, and the CSV '.'-decimal rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtLength, fmtArea, fmtVolume, toDisplayLength } from '../src/doctrine/units';
import { toCsv } from '../src/render/csv';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';

test('imperial feet-inches formatting', () => {
  assert.equal(fmtLength(4, 'imperial'), '4\'-0"');
  assert.equal(fmtLength(4.5, 'imperial'), '4\'-6"');
  assert.equal(fmtLength(0.5, 'imperial'), '0\'-6"');
});

test('inches never overflow to 12 (rollover to the next foot)', () => {
  assert.equal(fmtLength(3.999, 'imperial'), '4\'-0"');
});

test('metric length switches cm/m at 1 m', () => {
  assert.equal(fmtLength(1, 'metric'), '30 cm'); // 0.3048 m → 30 cm
  assert.equal(fmtLength(10, 'metric'), '3.05 m');
});

test('area and volume convert', () => {
  assert.equal(fmtArea(100, 'imperial'), '100 ft²');
  assert.match(fmtArea(100, 'metric'), /m²$/);
  assert.equal(fmtVolume(10, 'imperial'), '10 ft³');
  assert.match(fmtVolume(10, 'metric'), /m³$/);
});

test('toDisplayLength rounds per system', () => {
  assert.equal(toDisplayLength(4, 'imperial'), 4);
  assert.equal(toDisplayLength(4, 'metric'), 1.219);
});

test('CSV uses . decimals and no thousands separators regardless of locale', () => {
  const csv = toCsv(compute(defaultInputs({ count: 1 })), { scenario: 'S', date: '2026-06-30' });
  assert.ok(csv.includes('72.5'), 'spoil volume formatted with a dot decimal');
  assert.ok(csv.endsWith('\r\n'), 'RFC-4180 CRLF line endings');

  // A genuinely large total (168 parapet sandbags × 999) must appear bare, never grouped.
  const big = toCsv(compute(defaultInputs({ count: 999 })), { scenario: 'S', date: '2026-06-30' });
  assert.ok(big.includes('167832'), 'large totals are ungrouped');
  assert.ok(!big.includes('167,832'), 'no thousands separator inside a number');
});
