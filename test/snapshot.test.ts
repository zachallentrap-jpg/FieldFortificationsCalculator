// §17 compute.snapshot — pins the key outputs of representative fixtures so an unintended
// change to the formula chain or the doctrine constants is caught. Regenerate these baselines
// deliberately when a constant legitimately changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';

test('default fixture (two-man / deliberate / loam / 81mm mortar) snapshot', () => {
  const r = compute(defaultInputs());
  assert.equal(r.resolved.holeD, 4);
  assert.equal(r.resolved.setback, 1.25);
  assert.equal(r.cover.roofPath, 'earth_on_stringers');
  assert.equal(r.cover.thickness, 1.17);
  assert.equal(r.labor.manHoursPerPosition, 12.1);
  assert.equal(r.labor.manHoursTotal, 12.1);
  assert.equal(r.labor.elapsedHours, 6.1);
  const bom = Object.fromEntries(r.bom.map((l) => [l.id, l.qtyPerPosition]));
  assert.deepEqual(bom, {
    excavation_loose: 72.5,
    grenade_sumps: 2,
    sandbags_parapet: 168,
    sandbags_cover: 157,
    // Phase 1 (DECISIONS D29): stringers now count along the LONG axis (7 ft frontage → 8),
    // spanning the 2 ft short axis — the pre-Phase-1 count keyed on the short axis (3) and
    // implied stringers spanning the frontage, teaching wrong assembly.
    stringers: 8,
    gravel_sump: 2,
  });
  // Phase 1 added 4 doctrine leaves (berm W+H, machine blade-hour rate, vehicle ramp slope;
  // 275→279, one safety-critical). Phase 4 added 4 stage-fraction leaves (excavation split;
  // 279→283, none safety-critical). 283 total, 188 safety-critical.
  assert.equal(r.placeholderReport.total, 283);
  assert.equal(r.placeholderReport.remaining, 283);
  assert.equal(r.placeholderReport.safetyCriticalRemaining, 188);
});

test('engineered fixture never carries a fabricated cover thickness', () => {
  const r = compute(defaultInputs({ threat: 'at-rpg', overheadCover: true }));
  assert.equal(r.cover.roofPath, 'engineered_required');
  assert.equal(r.cover.thickness, 0);
  assert.ok(!r.bom.some((l) => l.id === 'sandbags_cover' || l.id === 'stringers'));
});

test('count scales totals but not per-position', () => {
  const one = compute(defaultInputs({ count: 1 }));
  const ten = compute(defaultInputs({ count: 10 }));
  assert.equal(ten.labor.manHoursPerPosition, one.labor.manHoursPerPosition);
  assert.equal(ten.labor.manHoursTotal, Math.round(one.labor.manHoursPerPosition * 10 * 10) / 10);
});
