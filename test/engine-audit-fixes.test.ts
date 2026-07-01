// Regression locks for the three engine-vs-§9 audit findings (adversarial audit, confirmed).
// Each test would FAIL against the pre-fix behavior, so a re-introduction is caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';
import type { BomLine } from '../src/engine/types';

const qtyPer = (bom: BomLine[], id: string): number => bom.find((l) => l.id === id)?.qtyPerPosition ?? 0;
const hasLine = (bom: BomLine[], id: string): boolean => bom.some((l) => l.id === id);
const hasCode = (codes: { code: string }[], code: string): boolean => codes.some((c) => c.code === code);

// ── Fix 2: no fabricated sump labor for a zero-sump position ───────────────────
test('zero-sump position (mortar_pit) fabricates no sump labor or BOM when sump toggled on', () => {
  const on = compute(defaultInputs({ positionType: 'mortar_pit', sump: true }));
  const off = compute(defaultInputs({ positionType: 'mortar_pit', sump: false }));
  // mortar_pit has grenadeSumps:0 → sumpCount 0 either way → the labor must be identical
  // (no 0.5 mh "grenade-sump adder" for a sump that is never dug).
  assert.equal(on.labor.manHoursPerPosition, off.labor.manHoursPerPosition);
  // …and no sump BOM lines appear.
  for (const r of [on, off]) {
    assert.equal(hasLine(r.bom, 'grenade_sumps'), false);
    assert.equal(hasLine(r.bom, 'gravel_sump'), false);
  }
});

test('positive control: a real-sump position DOES gain sump labor + BOM when toggled on', () => {
  const on = compute(defaultInputs({ positionType: 'two_man', sump: true }));
  const off = compute(defaultInputs({ positionType: 'two_man', sump: false }));
  assert.ok(on.labor.manHoursPerPosition > off.labor.manHoursPerPosition, 'sump adder should apply where sumps are dug');
  assert.equal(hasLine(on.bom, 'grenade_sumps'), true);
  assert.equal(qtyPer(on.bom, 'grenade_sumps'), 2);
});

// ── Fix 1: clamp advisory fires only on genuine out-of-range, not fractional rounding ──
test('fractional-but-in-range count/team rounds silently (no *_CLAMPED advisory)', () => {
  const r = compute(defaultInputs({ count: 3.4, teamSize: 2.5 }));
  assert.equal(r.inputs.count, 3, 'count rounds to 3');
  assert.equal(r.inputs.teamSize, 3, 'teamSize rounds to 3 (round-half-up)');
  assert.equal(hasCode(r.validation, 'COUNT_CLAMPED'), false);
  assert.equal(hasCode(r.validation, 'TEAM_CLAMPED'), false);
});

test('genuinely out-of-range count/team clamps AND raises the advisory', () => {
  const hi = compute(defaultInputs({ count: 1500, teamSize: 200 }));
  assert.equal(hi.inputs.count, 999);
  assert.equal(hi.inputs.teamSize, 50);
  assert.equal(hasCode(hi.validation, 'COUNT_CLAMPED'), true);
  assert.equal(hasCode(hi.validation, 'TEAM_CLAMPED'), true);

  const lo = compute(defaultInputs({ count: 0, teamSize: 0 }));
  assert.equal(lo.inputs.count, 1);
  assert.equal(lo.inputs.teamSize, 1);
  assert.equal(hasCode(lo.validation, 'COUNT_CLAMPED'), true);
  assert.equal(hasCode(lo.validation, 'TEAM_CLAMPED'), true);
});

// ── Fix 3: platformVol keys on the position's structural platform, not the firingStep toggle ──
test('firingStep toggle does not change excavation/labor (platform is structural, §9-literal)', () => {
  // mg_crew HAS a firing platform → its volume is always included regardless of firingStep.
  const mgOn = compute(defaultInputs({ positionType: 'mg_crew', firingStep: true }));
  const mgOff = compute(defaultInputs({ positionType: 'mg_crew', firingStep: false }));
  assert.equal(qtyPer(mgOn.bom, 'excavation_loose'), qtyPer(mgOff.bom, 'excavation_loose'));
  assert.equal(mgOn.labor.manHoursPerPosition, mgOff.labor.manHoursPerPosition);

  // one_man has NO platform → firingStep never adds platform volume either.
  const omOn = compute(defaultInputs({ positionType: 'one_man', firingStep: true }));
  const omOff = compute(defaultInputs({ positionType: 'one_man', firingStep: false }));
  assert.equal(qtyPer(omOn.bom, 'excavation_loose'), qtyPer(omOff.bom, 'excavation_loose'));
});
