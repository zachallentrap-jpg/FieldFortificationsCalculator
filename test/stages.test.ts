// Phase 4 priorities-of-work scheduler (docs/EXECUTION_PLAN.md). The decomposition PARTITIONS
// the position total (never adds to it) and the schedule arithmetic is deterministic with DTGs
// as inputs. "Who does what now, are we ready by stand-to."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { computeStages, scheduleStages } from '../src/engine/stages';
import { defaultInputs } from './helpers';
import type { Inputs } from '../src/engine/types';

const SPREAD: Partial<Inputs>[] = [
  {},
  { positionType: 'one_man', overheadCover: false, sump: false, camouflage: false, revetment: 'none' },
  { positionType: 'mg_crew', revetment: 'pickets_wire', camouflage: true },
  { positionType: 'vehicle_hull_defilade', machineAssist: true },
  { positionType: 'bunker_op_cp', standard: 'reinforced', revetment: 'timber_plywood' },
  { threat: 'at-rpg', overheadCover: true }, // engineered roof → no overhead stage
];

test('INVARIANT: per-stage man-hours sum EXACTLY to the position total', () => {
  for (const over of SPREAD) {
    const r = compute(defaultInputs(over));
    const plan = computeStages(r);
    const sum = plan.steps.reduce((s, st) => s + st.manHours, 0);
    assert.ok(Math.abs(sum - r.labor.manHoursPerPosition) < 1e-9, JSON.stringify(over) + ': ' + sum + ' vs ' + r.labor.manHoursPerPosition);
    assert.equal(plan.totalManHours, r.labor.manHoursPerPosition);
  }
});

test('INVARIANT: the per-stage BOM lines partition the position BOM (each line exactly once)', () => {
  for (const over of SPREAD) {
    const r = compute(defaultInputs(over));
    const plan = computeStages(r);
    const staged = plan.steps.flatMap((s) => s.bom.map((b) => b.id));
    assert.equal(new Set(staged).size, staged.length, JSON.stringify(over) + ': no line staged twice');
    assert.deepEqual([...staged].sort(), r.bom.map((b) => b.id).sort(), JSON.stringify(over) + ': every BOM line staged once');
  }
});

test('stages with no work are dropped; security is first and camo (when present) is last', () => {
  const bare = computeStages(compute(defaultInputs({ positionType: 'one_man', overheadCover: false, sump: false, camouflage: false, revetment: 'none' })));
  assert.ok(!bare.steps.some((s) => s.id === 'overhead'), 'no overhead stage when no cover');
  assert.ok(!bare.steps.some((s) => s.id === 'camo'), 'no camo stage when off');
  assert.equal(bare.steps[0]!.id, 'security', 'security posted first');

  const full = computeStages(compute(defaultInputs({ camouflage: true })));
  assert.equal(full.steps[full.steps.length - 1]!.id, 'camo', 'camo continuous — last in the list');
});

test('engineered-roof position emits no overhead stage and no fabricated cover labor', () => {
  const plan = computeStages(compute(defaultInputs({ threat: 'at-rpg', overheadCover: true })));
  assert.ok(!plan.steps.some((s) => s.id === 'overhead'));
  assert.ok(!plan.steps.some((s) => s.bom.some((b) => b.id === 'sandbags_cover' || b.id === 'stringers')));
});

test('schedule: halving effective diggers doubles elapsed; DTGs are inputs, output deterministic', () => {
  const plan = computeStages(compute(defaultInputs()));
  const four = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1, machineAssist: false });
  const two = scheduleStages(plan, { teamSize: 2, availableHours: 24, securityPostureFrac: 1, machineAssist: false });
  assert.ok(Math.abs(two.totalElapsedHours - 2 * four.totalElapsedHours) < 0.2, 'half the team ≈ double the time');
  // Deterministic: identical inputs → identical schedule.
  assert.deepEqual(scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1, machineAssist: false }), four);
  // Cumulative times are monotonic non-decreasing and finite.
  let prev = 0;
  for (const s of four.steps) { assert.ok(Number.isFinite(s.cumulativeHours) && s.cumulativeHours >= prev - 1e-9); prev = s.cumulativeHours; }
});

test('shortfall math: unreachable stand-to reports hours past, feasible reports zero', () => {
  const plan = computeStages(compute(defaultInputs({ positionType: 'bunker_op_cp', standard: 'reinforced' })));
  const tight = scheduleStages(plan, { teamSize: 1, availableHours: 1, securityPostureFrac: 0.5, machineAssist: false });
  assert.equal(tight.feasible, false);
  assert.ok(tight.shortfallHours > 0);
  const loose = scheduleStages(plan, { teamSize: 20, availableHours: 200, securityPostureFrac: 1, machineAssist: false });
  assert.equal(loose.feasible, true);
  assert.equal(loose.shortfallHours, 0);
});

test('security posture: fewer diggers on the tools (more on watch) lengthens the build', () => {
  const plan = computeStages(compute(defaultInputs()));
  const allDigging = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1, machineAssist: false });
  const halfWatch = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 0.5, machineAssist: false });
  assert.ok(halfWatch.totalElapsedHours > allDigging.totalElapsedHours, 'watch posture costs time');
});
