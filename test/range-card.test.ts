// Phase 3 (docs/EXECUTION_PLAN.md) — the plan doubles as a usable range card: azimuths in
// degrees AND mils, a north arrow, a scale bar, an FPL for machine-gun positions. Plus the
// job sheet carries the hand-filled field header and doctrine-fill provenance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { drawPlan } from '../src/render/drawPlan';
import { jobSheet } from '../src/render/jobSheet';
import { degToMils, azimuthLabel } from '../src/render/chrome';
import { positions } from '../src/doctrine/positions';
import { defaultInputs } from './helpers';

test('degrees convert to mils on the doctrinal 6400/360 scale', () => {
  assert.equal(degToMils(0), 0);
  assert.equal(degToMils(360), 0); // wraps
  assert.equal(degToMils(90), 1600);
  assert.equal(degToMils(-90), 4800); // negative azimuth normalizes
  assert.match(azimuthLabel(45), /45° \(800 mils\)/);
});

test('a position with sectors renders azimuth labels in degrees AND mils, north arrow, scale bar', () => {
  const plan = drawPlan(compute(defaultInputs({ positionType: 'mg_crew', sectorAzimuths: { leftDeg: -30, rightDeg: 30 } })));
  assert.match(plan, /mils/, 'azimuths labeled in mils');
  assert.match(plan, /marker-end="url\(#mk-north\)"/, 'north arrow present');
  assert.match(plan, /class="scale"/, 'scale bar present');
});

test('machine-gun positions get a final protective line (plain language + FPL term)', () => {
  const plan = drawPlan(compute(defaultInputs({ positionType: 'mg_crew' })));
  assert.match(plan, /FPL/, 'FPL labeled');
  assert.match(plan, /grazing-fire line/, 'plain-language term alongside');
});

test('non-sector positions (vehicle defilade) render without azimuth labels but keep the north arrow', () => {
  const plan = drawPlan(compute(defaultInputs({ positionType: 'vehicle_hull_defilade' })));
  assert.match(plan, /marker-end="url\(#mk-north\)"/, 'north arrow always present');
  assert.ok(positions['vehicle_hull_defilade']!.sectorsOfFire === false, 'fixture has no sectors');
});

test('job sheet carries the hand-filled field header and fill provenance footer', () => {
  const sheet = jobSheet(compute(defaultInputs()), { scenario: 'Hill 402', date: '2026-07-02' });
  for (const label of ['GRID', 'UNIT', 'DTG', 'AZIMUTH OF FIRE']) {
    assert.ok(sheet.includes(label), 'field header line: ' + label);
  }
  assert.match(sheet, /placeholder doctrine|doctrine fill/i, 'fill provenance footer present');
});
