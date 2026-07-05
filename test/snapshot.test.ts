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
    // Two-man is an EARTH parapet — bags only at the ONE front firing-rest course, spanning the
    // full 7-ft frontage, 2 bags deep, at doctrine height (ceil(7×1.5×0.83 ÷ bagVol × 1.15) =
    // 33), NOT the full ring (was 168). The parapet's protective mass is spoil, charged via
    // fillDemand.
    sandbags_parapet: 33,
    sandbags_cover: 157,
    // Phase 1 (DECISIONS D29): stringers now count along the LONG axis (7 ft frontage → 8),
    // spanning the 2 ft short axis — the pre-Phase-1 count keyed on the short axis (3) and
    // implied stringers spanning the frontage, teaching wrong assembly.
    stringers: 8,
    gravel_sump: 2,
  });
  // Growth by phase: 275 (baseline) → 279 (P1: berm W/H, blade-hour rate, ramp slope; +1 SC)
  // → 283 (P4: 4 excavation-split fractions) → 293 (P6: connecting-trench + ATGM hole/platform
  // leaves + backblast clearance; +1 SC) → 295 (earth-parapet pass: sandbag.frontWallHeight +
  // sandbag.basicLoad, both non-SC). 295 total, 189 safety-critical.
  assert.equal(r.placeholderReport.total, 295);
  assert.equal(r.placeholderReport.remaining, 295);
  assert.equal(r.placeholderReport.safetyCriticalRemaining, 189);
});

test('earth-parapet rifle position bills firing-rest bags only; bunker keeps the full sandbag ring', () => {
  const bags = (over: Parameters<typeof defaultInputs>[0]): number => {
    const l = compute(defaultInputs({ overheadCover: false, ...over })).bom.find((b) => b.id === 'sandbags_parapet');
    return l ? l.qtyPerPosition : 0;
  };
  // Two-man rifle hole with NO overhead cover: the parapet is spoil — only the front firing-rest
  // course's bags (a modest few dozen, not the ~168 a full ring would bill).
  const twoMan = bags({ positionType: 'two_man' });
  assert.ok(twoMan > 0 && twoMan < 50, 'two-man earth parapet is a front course, not a full ring, got ' + twoMan);
  // One-man's frontage is narrower (2.5 ft vs 7 ft) ⇒ a shorter front course ⇒ fewer bags.
  assert.ok(bags({ positionType: 'one_man' }) < twoMan, 'one-man (narrower frontage) < two-man');
  // Bunker/OP is the one class still built of sandbag walls — full ring, dozens+ of bags.
  assert.ok(bags({ positionType: 'bunker_op_cp' }) > 40, 'bunker keeps the full sandbag ring');
  // Vehicle defilade is a dozed berm — zero parapet bags.
  assert.equal(bags({ positionType: 'vehicle_hull_defilade', machineAssist: true }), 0, 'vehicle berm bills no bags');
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
