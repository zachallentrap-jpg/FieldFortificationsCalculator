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
    // The roof deck reaches setback + bearing OUTWARD past the front and rear walls (2.25 ft
    // each on this fixture) and endLap past each flank: 9.00 × 6.50 ft, 58.50 ft², 68.445 ft³
    // of cover, 255 bags. Billed short at 157 while the two drawings put the same slab in two
    // other places entirely — see the roof-footprint entry in DECISIONS.md.
    sandbags_cover: 255,
    // Counted over the DECK the block bills (9.0 ft of frontage), not over the bare 7 ft hole:
    // the old count left 2 ft of billed slab with no stringer under it on every position.
    stringers: 10,
    gravel_sump: 2,
  });
  // Growth by phase: 275 (baseline) → 279 (P1: berm W/H, blade-hour rate, ramp slope; +1 SC)
  // → 283 (P4: 4 excavation-split fractions) → 293 (P6: connecting-trench + ATGM hole/platform
  // leaves + backblast clearance; +1 SC) → 295 (earth-parapet pass: sandbag.frontWallHeight +
  // sandbag.basicLoad, both non-SC) → 317 (rule↔rendering pass: every physical magnitude the
  // renderers used to hold — overhead.endLap, the three stringer sections (+3 SC, the member
  // that holds the roof up), camo.drapeHeightFt, the firing-step ledge, the mortar-pit batter,
  // the entrance/stair access group, the three compound positions' sub-bay trenches, and the
  // vehicle ramp/pan split). 317 total, 192 safety-critical.
  assert.equal(r.placeholderReport.total, 317);
  assert.equal(r.placeholderReport.remaining, 317);
  assert.equal(r.placeholderReport.safetyCriticalRemaining, 192);
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
