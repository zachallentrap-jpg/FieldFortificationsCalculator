// Phase 4 priorities-of-work scheduler (docs/EXECUTION_PLAN.md). The decomposition PARTITIONS
// the position total (never adds to it) and the schedule arithmetic is deterministic with DTGs
// as inputs. "Who does what now, are we ready by stand-to."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { computeStages, scheduleStages } from '../src/engine/stages';
import { round1 } from '../src/engine/round';
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
  const four = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1 });
  const two = scheduleStages(plan, { teamSize: 2, availableHours: 24, securityPostureFrac: 1 });
  assert.ok(Math.abs(two.totalElapsedHours - 2 * four.totalElapsedHours) < 0.2, 'half the team ≈ double the time');
  // Deterministic: identical inputs → identical schedule.
  assert.deepEqual(scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1 }), four);
  // Cumulative times are monotonic non-decreasing and finite.
  let prev = 0;
  for (const s of four.steps) { assert.ok(Number.isFinite(s.cumulativeHours) && s.cumulativeHours >= prev - 1e-9); prev = s.cumulativeHours; }
});

test('shortfall math: unreachable stand-to reports hours past, feasible reports zero', () => {
  const plan = computeStages(compute(defaultInputs({ positionType: 'bunker_op_cp', standard: 'reinforced' })));
  const tight = scheduleStages(plan, { teamSize: 1, availableHours: 1, securityPostureFrac: 0.5 });
  assert.equal(tight.feasible, false);
  assert.ok(tight.shortfallHours > 0);
  const loose = scheduleStages(plan, { teamSize: 20, availableHours: 200, securityPostureFrac: 1 });
  assert.equal(loose.feasible, true);
  assert.equal(loose.shortfallHours, 0);
});

test('an unknown revetment string never invents phantom revet-stage labor (per-stage clock stays honest)', () => {
  // An unknown revetment resolves to the 'none' row (buildsFace=false) → no revet labor in the
  // total, so the stage plan must match the 'none' plan exactly, NOT bill a phantom revet stage.
  const bogus = computeStages(compute(defaultInputs({ revetment: 'bogus_revet', sump: true })));
  const none = computeStages(compute(defaultInputs({ revetment: 'none', sump: true })));
  const mh = (plan: ReturnType<typeof computeStages>, id: string) => plan.steps.find((s) => s.id === id)?.manHours ?? 0;
  for (const id of ['security', 'hasty', 'deliberate', 'revet_sump', 'parapet']) {
    assert.ok(Math.abs(mh(bogus, id) - mh(none, id)) < 1e-9, id + ' stage matches the none-revet plan');
  }
  // And a REAL revetment that builds a face DOES add the revet stage labor.
  const real = computeStages(compute(defaultInputs({ revetment: 'pickets_wire', sump: true })));
  assert.ok(mh(real, 'revet_sump') > mh(none, 'revet_sump'), 'a real revetment adds revet-stage labor');
});

test('machine assist is not re-applied by the schedule clock (compute.ts already reduced the total)', () => {
  // compute.ts scales excavation man-hours by machine.excavationFactor when machineAssist is on
  // (a real 0.4x reduction baked into manHoursPerPosition). scheduleStages must divide that
  // already-reduced total by team×posture only — team of 1, posture 1 — so elapsed hours comes
  // out to EXACTLY the position total, never further scaled by a second machine factor.
  const r = compute(defaultInputs({ positionType: 'vehicle_hull_defilade', machineAssist: true }));
  const schedule = scheduleStages(computeStages(r), { teamSize: 1, availableHours: 999, securityPostureFrac: 1 });
  assert.ok(
    Math.abs(schedule.totalElapsedHours - round1(r.labor.manHoursPerPosition)) < 0.05,
    'elapsed hours (' + schedule.totalElapsedHours + ') must match manHoursPerPosition (' + r.labor.manHoursPerPosition + '), not a further-sped-up figure',
  );
});

test('INVARIANT: the plan carries the whole job — jobManHours is compute()\'s own manHoursTotal', () => {
  // The per-stage figures stay per position (that is what a crew digging one hole reads off a job
  // sheet), so the count has to travel with the plan or the clock silently answers for one hole.
  for (const over of SPREAD) {
    for (const count of [1, 2, 37, 999]) {
      const r = compute(defaultInputs({ ...over, count }));
      const plan = computeStages(r);
      assert.equal(plan.positions, r.inputs.count, JSON.stringify(over) + ' count ' + count);
      assert.equal(plan.jobManHours, r.labor.manHoursTotal, JSON.stringify(over) + ' count ' + count + ': job man-hours');
      assert.equal(plan.totalManHours, r.labor.manHoursPerPosition, 'and the stage total stays per position');
    }
  }
});

test('the schedule bills every position the operator asked for, not just the first one', () => {
  // count is an operator control (1–999). N positions built by one team is N times the work, and
  // the clock said otherwise: a 10-position job came back "3.0 hr, ready, 21 hr to spare" against
  // a 24 hr stand-to while compute() published 30.3 hr for the very same job.
  const budget = 24;
  const one = compute(defaultInputs({ count: 1, teamSize: 4 }));
  const ten = compute(defaultInputs({ count: 10, teamSize: 4 }));
  const sOne = scheduleStages(computeStages(one), { teamSize: 4, availableHours: budget, securityPostureFrac: 1 });
  const sTen = scheduleStages(computeStages(ten), { teamSize: 4, availableHours: budget, securityPostureFrac: 1 });

  assert.equal(sOne.totalElapsedHours, one.labor.elapsedHours, 'one position agrees with compute()');
  assert.equal(sTen.totalElapsedHours, ten.labor.elapsedHours, 'ten positions agree with compute()');
  assert.ok(
    sTen.totalElapsedHours > sOne.totalElapsedHours * 9,
    'ten positions is ten times the work (' + sTen.totalElapsedHours + ' vs ' + sOne.totalElapsedHours + ')',
  );
  assert.equal(sOne.feasible, true, 'one position does make stand-to');
  assert.equal(sTen.feasible, false, 'ten do not, and must not be certified as if they did');
  assert.ok(sTen.shortfallHours > 0, 'the crew is told how far short they are');
  assert.equal(sTen.positions, 10, 'the schedule says how many positions it covers');

  // Every stage of the job is worked once per position too, not once for the whole job.
  const lastOne = sOne.steps[sOne.steps.length - 1]!.cumulativeHours;
  const lastTen = sTen.steps[sTen.steps.length - 1]!.cumulativeHours;
  assert.ok(lastTen > lastOne * 9, 'the stage clock scales with the job (' + lastTen + ' vs ' + lastOne + ')');
});

test('the stage clock lands on the same figure the schedule is judged on', () => {
  // The judged total comes from compute()'s published job man-hours; the per-stage clock comes
  // from the stages. They may differ only by the display rounding step, never by a stage.
  for (const over of SPREAD) {
    for (const count of [1, 5, 999]) {
      for (const posture of [1, 0.5]) {
        const plan = computeStages(compute(defaultInputs({ ...over, count })));
        const s = scheduleStages(plan, { teamSize: 4, availableHours: 1e9, securityPostureFrac: posture });
        const last = s.steps[s.steps.length - 1]!.cumulativeHours;
        assert.ok(
          Math.abs(last - s.totalElapsedHours) <= 0.1 + 1e-9,
          JSON.stringify(over) + ' count ' + count + ': last stage H+' + last + ' against a total of ' + s.totalElapsedHours,
        );
      }
    }
  }
});

test('feasibility is judged on the true clock, not on the rounded one', () => {
  // Rounding before the comparison certified a job that was over budget by up to half a display
  // step: 12.1 mh with 22 diggers is a true 0.55 hr, which came back "0.5 hr, ready, short 0"
  // against a 0.5 hr stand-to. The same rounding-in-the-unsafe-direction the cover check had.
  const plan = computeStages(compute(defaultInputs()));
  const budget = 0.5;
  const s = scheduleStages(plan, { teamSize: 22, availableHours: budget, securityPostureFrac: 1 });
  const trueClock = plan.jobManHours / 22;
  assert.ok(trueClock > budget, 'fixture check: the true clock (' + trueClock + ') is over the budget');
  assert.equal(s.feasible, false, 'a job that does not fit is not certified because it rounds down');
  assert.ok(s.shortfallHours > 0, 'and the shortfall is never rounded away to zero');

  // A job that genuinely fits still fits, exactly at the boundary.
  const exact = scheduleStages(plan, { teamSize: 22, availableHours: trueClock, securityPostureFrac: 1 });
  assert.equal(exact.feasible, true, 'a job that fits its budget exactly is feasible');
  assert.equal(exact.shortfallHours, 0);
});

test('a scheduling value that was CHANGED to schedule it is reported as changed', () => {
  // Out of range is not the same as unreadable: nothing failed, the operator\'s own number was
  // altered. For the posture the alteration runs the fast way — 1.5, 2 and 500 all become 1, the
  // most hands the range allows — so a caller echoing the box the operator typed in would be
  // showing a number this clock did not use.
  const plan = computeStages(compute(defaultInputs()));
  const opts = { teamSize: 4, availableHours: 24, securityPostureFrac: 1 };
  const clean = scheduleStages(plan, opts);
  assert.deepEqual(clean.clampedInputs, { teamSize: false, securityPostureFrac: false, positions: false });
  assert.equal(clean.teamSize, 4, 'the schedule says which team it was built on');
  assert.equal(clean.securityPostureFrac, 1, 'and which posture');

  for (const posture of [1.5, 2, 500]) {
    const s = scheduleStages(plan, { ...opts, securityPostureFrac: posture });
    assert.equal(s.clampedInputs.securityPostureFrac, true, 'posture ' + posture + ' was changed to schedule it');
    assert.equal(s.securityPostureFrac, 1, 'and the clock was built on the changed value');
    assert.equal(s.inputsUsable, true, 'a readable value is still readable');
  }
  for (const team of [51, 500, 1e9]) {
    const s = scheduleStages(plan, { ...opts, teamSize: team });
    assert.equal(s.clampedInputs.teamSize, true, 'team ' + team + ' was changed to schedule it');
    assert.equal(s.teamSize, 50);
  }
  // Fractions are rounded, not clamped — compute()'s own convention, so a 4.4-man team is not
  // reported as an out-of-range number.
  assert.equal(scheduleStages(plan, { ...opts, teamSize: 4.4 }).clampedInputs.teamSize, false);
  // And a job size out of range is reported the same way.
  const huge = scheduleStages({ ...plan, positions: 5000 }, opts);
  assert.equal(huge.clampedInputs.positions, true, 'a job of 5000 positions was cut to the range');
  assert.equal(huge.positions, 999);
});

test('security posture: fewer diggers on the tools (more on watch) lengthens the build', () => {
  const plan = computeStages(compute(defaultInputs()));
  const allDigging = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1 });
  const halfWatch = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 0.5 });
  assert.ok(halfWatch.totalElapsedHours > allDigging.totalElapsedHours, 'watch posture costs time');
});
