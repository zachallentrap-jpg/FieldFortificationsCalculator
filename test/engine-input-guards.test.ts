// Input guards on the planning clocks. Two obligations:
//
//   1. Every module that divides man-hours by a team size must normalize that team size the way
//      compute() does. compute() is the authority (it publishes labor.elapsedHours); if a
//      scheduler normalizes differently, two screens of the same app give two different answers
//      for one position.
//   2. A non-finite input must never produce a shorter clock, a smaller shortfall, or a
//      feasibility claim. Refusing or reporting the pessimistic end is acceptable; reporting
//      "0 hours, ready" is not — that is the one output that would send a crew above ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { computeStages, scheduleStages, normalizeTeamSize, type StagePlan } from '../src/engine/stages';
import { aggregateMission } from '../src/engine/mission';
import { planForTime } from '../src/engine/plan';
import { defaultInputs } from './helpers';

// Raw team sizes a caller can hand in: unreadable, out of range at both ends, fractional.
const RAW_TEAMS: number[] = [NaN, Infinity, -Infinity, -5, 0, 0.4, 1, 2.6, 49.5, 50, 51, 500, 1e9];

test('every planning clock normalizes team size exactly as compute() does', () => {
  for (const raw of RAW_TEAMS) {
    // compute()'s echo is the authority.
    const expected = compute(defaultInputs({ teamSize: raw })).inputs.teamSize;
    assert.ok(Number.isFinite(expected) && expected >= 1 && expected <= 50, 'compute clamps to [1,50]: ' + raw);
    assert.equal(normalizeTeamSize(raw), expected, 'shared helper agrees with compute() for ' + raw);

    // planForTime echoes the team it actually computed every option for.
    const plan = planForTime({ availableHours: 200, teamSize: raw, base: defaultInputs() });
    assert.equal(plan.teamSize, expected, 'planForTime team for ' + raw);

    // aggregateMission divides the rollup by its own team size.
    const mission = aggregateMission([{ inputs: defaultInputs() }], { teamSize: raw });
    assert.equal(mission.teamSize, expected, 'aggregateMission team for ' + raw);
  }
});

test('the stage clock and compute() report the same elapsed hours for the same team size', () => {
  // One position, count 1: the schedule's total elapsed IS compute()'s elapsedHours, so any
  // divergence in team-size normalization shows up directly. A team of 500 used to be floored
  // with no ceiling here, scheduling 12.1 mh ÷ 500 = "0 hr" while compute() — clamping to 50 —
  // published 0.2 hr for the very same position.
  for (const raw of RAW_TEAMS) {
    const r = compute(defaultInputs({ teamSize: raw }));
    const sched = scheduleStages(computeStages(r), { teamSize: raw, availableHours: 999, securityPostureFrac: 1 });
    assert.ok(
      Math.abs(sched.totalElapsedHours - r.labor.elapsedHours) < 0.05,
      'team ' + raw + ': schedule says ' + sched.totalElapsedHours + ' hr, compute() says ' + r.labor.elapsedHours + ' hr',
    );
  }
});

test('no unreadable scheduling input can produce a zero-hour or feasible-looking schedule', () => {
  const r = compute(defaultInputs());
  const plan = computeStages(r);
  const honest = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1 });
  assert.equal(honest.inputsUsable, true, 'readable inputs are not flagged');

  const BAD = [NaN, Infinity, -Infinity];
  for (const bad of BAD) {
    for (const field of ['teamSize', 'availableHours', 'securityPostureFrac'] as const) {
      const opts = { teamSize: 4, availableHours: 24, securityPostureFrac: 1, [field]: bad };
      const s = scheduleStages(plan, opts);
      assert.equal(s.inputsUsable, false, field + '=' + bad + ' must be flagged as unusable');
      // The work does not shrink because an input was unreadable.
      assert.ok(
        s.totalElapsedHours >= honest.totalElapsedHours - 1e-9,
        field + '=' + bad + ' shortened the clock: ' + s.totalElapsedHours + ' vs ' + honest.totalElapsedHours,
      );
      assert.ok(s.totalElapsedHours > 0, field + '=' + bad + ' reported the position as already dug');
      // Every number handed back is printable.
      assert.ok(Number.isFinite(s.availableHours), field + '=' + bad + ' echoed a non-finite budget');
      assert.ok(Number.isFinite(s.shortfallHours), field + '=' + bad + ' produced a non-finite shortfall');
      for (const st of s.steps) assert.ok(Number.isFinite(st.cumulativeHours), field + '=' + bad + ' non-finite stage clock');
      // "Not ready, short by 0 hours" is a contradiction, never an answer.
      if (!s.feasible) assert.ok(s.shortfallHours > 0, field + '=' + bad + ' reported infeasible with a shortfall of 0');
    }
  }
});

test('an unreadable stand-to budget is judged against zero hours, so nothing is certified', () => {
  const plan = computeStages(compute(defaultInputs()));
  const s = scheduleStages(plan, { teamSize: 4, availableHours: NaN, securityPostureFrac: 1 });
  assert.equal(s.feasible, false);
  assert.equal(s.availableHours, 0, 'a budget that cannot be read is worth no hours');
  assert.equal(s.shortfallHours, s.totalElapsedHours, 'the whole build is the shortfall');
});

test('an unreadable posture schedules the fewest hands on the tools, not the most', () => {
  const plan = computeStages(compute(defaultInputs()));
  const allDigging = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: 1 });
  const unreadable = scheduleStages(plan, { teamSize: 4, availableHours: 24, securityPostureFrac: NaN });
  assert.ok(
    unreadable.totalElapsedHours > allDigging.totalElapsedHours,
    'an unreadable posture must cost time, not save it (' + unreadable.totalElapsedHours + ' vs ' + allDigging.totalElapsedHours + ')',
  );
  assert.equal(unreadable.feasible, false);
});

test('a stage plan with unreadable work content is never scheduled as a finished job', () => {
  // scheduleStages takes a StagePlan as a parameter, so the work content is not always
  // compute()'s. Rounding a non-finite total to 0 is right for a material count and fatal for a
  // clock: it turns "this could not be worked out" into "it is already done".
  const broken: StagePlan = {
    steps: [{ id: 'hasty', label: 'Hasty dig', detail: '', manHours: NaN, bom: [] }],
    totalManHours: NaN,
  };
  const s = scheduleStages(broken, { teamSize: 4, availableHours: 24, securityPostureFrac: 1 });
  assert.equal(s.feasible, false, 'unknown work content cannot be certified complete by stand-to');
  assert.notEqual(s.totalElapsedHours, 0, 'unknown work content must not read as zero hours of work');
  assert.notEqual(s.steps[0]!.cumulativeHours, 0, 'nor as a stage completed at H+0');
});

test('an unreadable planning budget fits nothing and is never echoed back as NaN', () => {
  const p = planForTime({ availableHours: NaN, teamSize: 4, base: defaultInputs() });
  assert.equal(p.budgetHours, 0, 'unreadable budget is worth no hours');
  assert.equal(p.feasible.length, 0, 'nothing fits a budget that could not be read');
  assert.ok(p.infeasibleBest !== null, 'the closest over-budget option is still offered as guidance');
});

test('an unreadable mission team size is a team of one, never a NaN rollup', () => {
  const m = aggregateMission([{ inputs: defaultInputs({ count: 2 }) }], { teamSize: NaN });
  assert.equal(m.teamSize, 1);
  assert.ok(Number.isFinite(m.elapsedHours) && m.elapsedHours > 0, 'elapsed hours stays a real number');
  assert.equal(m.elapsedHours, m.totalManHours, 'a team of one takes the whole man-hour total');
});
