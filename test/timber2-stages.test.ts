// TIMBER-2 — the stage model (plan §8.2, §3.3, TD10/TD18).
//
// The load-bearing property: a one-story gable building's stage plan is the legacy `STAGES`
// array, ordinal for ordinal. That is precisely why the legacy suites — which assert
// `stage === 5` means wall framing — never had to be touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFrame, specFromBuildingInput, type BuildingInput } from '../src/timber/frame';
import { generateStructure } from '../src/timber/families/index';
import { bomSummary, boardFeet } from '../src/timber/bom';
import { STAGES } from '../src/timber/types';
import { stagePlanForLegacyBuilding, STAGE_KEYS, ordinalOf } from '../src/timber/stagePlan';

const demo: BuildingInput = {
  lengthFt: 20, widthFt: 16, wallHeightFt: 8,
  studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
  risePer12: 4, overhangFt: 1, crawlFt: 1.5,
  openings: [{ wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }],
};

test('the legacy building plan IS the legacy STAGES array, ordinal for ordinal', () => {
  const plan = stagePlanForLegacyBuilding();
  assert.equal(plan.length, STAGES.length);
  for (let i = 0; i < plan.length; i++) {
    assert.equal(plan[i]!.ordinal, STAGES[i]!.id, `ordinal ${i}`);
    assert.equal(plan[i]!.label, STAGES[i]!.name, `label ${i}`);
  }
});

test('every plan entry has a key from the closed vocabulary and a real sequence note', () => {
  for (const e of stagePlanForLegacyBuilding()) {
    assert.ok(STAGE_KEYS.includes(e.key), `${e.key} is not in the StageKey vocabulary`);
    assert.ok(e.detail.length > 20, `stage ${e.ordinal}: the detail line is what teaches the sequence`);
  }
});

test('ordinalOf finds the first entry with a key (how families stamp their emits)', () => {
  const plan = stagePlanForLegacyBuilding();
  assert.equal(ordinalOf(plan, 'layout'), 1);
  assert.equal(ordinalOf(plan, 'floor'), 3, 'first floor stage, not the deck');
  assert.equal(ordinalOf(plan, 'walls'), 5);
  assert.equal(ordinalOf(plan, 'roofing'), 10);
  assert.equal(ordinalOf(plan, 'cribwork'), undefined, 'a building has no cribwork stage');
});

test('every member sits inside its own model plan, and the partition is exact', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  for (const m of model.members) {
    assert.ok(m.stage >= 1 && m.stage <= model.stagePlan.length, `${m.id}: stage ${m.stage} outside the plan`);
  }
  const bom = bomSummary(model.members, model.stagePlan);
  assert.equal(bom.totalMembers, model.members.length, 'stage BOMs partition the model exactly');
  const totalBf = model.members.reduce((a, m) => a + boardFeet(m), 0);
  assert.ok(Math.abs(bom.totalBoardFeet - totalBf) < 1e-6);
});

test('TD18: bomSummary THROWS past the plan instead of silently dropping members', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  // Rig a member past the legacy plan, the way a tower's stages would land.
  const rigged = [...model.members, { ...model.members[0]!, id: 'RIGGED-01', stage: 14 as never }];
  assert.throws(
    () => bomSummary(rigged),
    /RIGGED-01 is at stage 14, past the 11-stage plan/,
    'a bill that is quietly short is worse than no bill',
  );
  // With a plan long enough, it rolls up fine.
  const longPlan = [...model.stagePlan];
  while (longPlan.length < 14) {
    longPlan.push({ ordinal: longPlan.length + 1, key: 'finish', label: `Stage ${longPlan.length + 1}`, detail: 'test' });
  }
  assert.equal(bomSummary(rigged, longPlan).totalMembers, rigged.length);
});

test('the defaulted (no-plan) call still matches the plan-passed call for legacy models', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  assert.deepEqual(bomSummary(model.members), bomSummary(model.members, model.stagePlan));
  // And that is what the TIMBER-1 caller has always gotten.
  assert.deepEqual(bomSummary(generateFrame(demo).members), bomSummary(model.members));
});
