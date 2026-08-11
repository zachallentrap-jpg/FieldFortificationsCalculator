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
import { positions } from '../src/doctrine/positions';
import { soils } from '../src/doctrine/soils';
import { defaultInputs } from './helpers';
import type { Inputs } from '../src/engine/types';

// Raw team sizes a caller can hand in: unreadable, out of range at both ends, fractional.
const RAW_TEAMS: number[] = [NaN, Infinity, -Infinity, -5, 0, 0.4, 1, 2.6, 49.5, 50, 51, 500, 1e9];
const STANDARDS: Inputs['standard'][] = ['hasty', 'deliberate', 'reinforced'];

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

test('the stage clock and compute() report the same elapsed hours for the same JOB — every position, soil, standard and count in the catalog, exactly', () => {
  // The whole team is on the tools (posture 1), which is the only condition under which compute()
  // and the scheduler are answering the same question — then the two must not merely be close,
  // they must be the SAME number, because the app prints both. The corpus is the catalog, not one
  // fixture: the old single-fixture form (defaultInputs(), count 1, tolerance 0.05 h) passed while
  // bunker_op_cp on silt diverged by 0.1 h at count 1, and while EVERY count above 1 diverged by
  // exactly that factor — count 10 scheduled as 3.0 hr against compute()'s own 30.3 hr.
  let checked = 0;
  for (const positionType of Object.keys(positions)) {
    for (const soil of Object.keys(soils)) {
      for (const standard of STANDARDS) {
        for (const overheadCover of [true, false]) {
          for (const count of [1, 7, 999]) {
            for (const teamSize of [1, 4, 50]) {
              const r = compute(defaultInputs({ positionType, soil, standard, overheadCover, count, teamSize }));
              const sched = scheduleStages(computeStages(r), { teamSize, availableHours: 1e9, securityPostureFrac: 1 });
              assert.equal(
                sched.totalElapsedHours,
                r.labor.elapsedHours,
                [positionType, soil, standard, 'cover=' + overheadCover, 'count=' + count, 'team=' + teamSize].join(' ') +
                  ': schedule says ' + sched.totalElapsedHours + ' hr, compute() says ' + r.labor.elapsedHours + ' hr',
              );
              assert.equal(sched.positions, r.inputs.count, 'the schedule covers the job compute() billed');
              checked++;
            }
          }
        }
      }
    }
  }
  assert.ok(checked >= 4000, 'the corpus is the catalog, not one fixture (' + checked + ' combinations)');

  // And the same exact agreement for every raw team size a caller can hand in — a team of 500 was
  // once floored with no ceiling here, scheduling 12.1 mh ÷ 500 = "0 hr" while compute(), clamping
  // to 50, published 0.2 hr for the very same position.
  for (const raw of RAW_TEAMS) {
    const r = compute(defaultInputs({ teamSize: raw, count: 3 }));
    const sched = scheduleStages(computeStages(r), { teamSize: raw, availableHours: 1e9, securityPostureFrac: 1 });
    assert.equal(
      sched.totalElapsedHours,
      r.labor.elapsedHours,
      'team ' + raw + ': schedule says ' + sched.totalElapsedHours + ' hr, compute() says ' + r.labor.elapsedHours + ' hr',
    );
  }
});

test('an unreadable scheduling input only ever lengthens the clock — never zero hours, and never a certification the readable numbers would not give', () => {
  // What the fallbacks buy, stated exactly: each one is the pessimistic end of its own range, so
  // an unreadable input can only push the clock OUT. It can still come back feasible — a fallback
  // team of one finishing inside the budget means any real team does — but it may never certify a
  // job that the operator's own readable numbers could not finish, and it may never report zero.
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
      // The certification test: across budgets from impossible to generous, an unreadable input
      // may only ever REMOVE a "ready by stand-to", never add one.
      for (const budget of [0, 1, 3, 24, 999]) {
        const fallback = scheduleStages(plan, { ...opts, [field]: bad, availableHours: field === 'availableHours' ? bad : budget });
        const readable = scheduleStages(plan, { teamSize: 4, availableHours: budget, securityPostureFrac: 1 });
        if (fallback.feasible) {
          assert.ok(
            readable.feasible,
            field + '=' + bad + ' at a ' + budget + ' hr budget certified stand-to that the readable inputs do not',
          );
        }
      }
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
  // The whole build is the shortfall. Not an equality: a shortfall is rounded UP to the displayed
  // tenth (short 0.0 hr is not an answer) while the elapsed figure is rounded to nearest so it
  // matches compute()'s published hours, so the shortfall may lead by up to one display step.
  assert.ok(s.shortfallHours >= s.totalElapsedHours, 'the whole build is the shortfall');
  assert.ok(s.shortfallHours <= s.totalElapsedHours + 0.1, 'and no more than the whole build');
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

test('a stage plan with unreadable or NEGATIVE work content is never scheduled as a finished job', () => {
  // scheduleStages takes a StagePlan as a parameter, so the work content is not always
  // compute()'s. Rounding a non-finite total to 0 is right for a material count and fatal for a
  // clock: it turns "this could not be worked out" into "it is already done". Negative work is the
  // same door on its other hinge, and it opened onto worse: -1000 man-hours scheduled as -250 hr,
  // "ready with 274 hr to spare" against a 24 hr budget, with every input reported as usable.
  const plan = (mh: number): StagePlan => ({
    steps: [{ id: 'hasty', label: 'Hasty dig', detail: '', manHours: mh, bom: [] }],
    totalManHours: mh,
    positions: 1,
    jobManHours: mh,
  });
  for (const mh of [NaN, Infinity, -Infinity, -1, -1000, -1e-9]) {
    const s = scheduleStages(plan(mh), { teamSize: 4, availableHours: 24, securityPostureFrac: 1 });
    assert.equal(s.feasible, false, mh + ' man-hours cannot be certified complete by stand-to');
    assert.equal(s.workUsable, false, mh + ' man-hours is not readable work content');
    assert.equal(s.inputsUsable, false, mh + ' man-hours must not be reported as usable inputs');
    assert.ok(!(s.totalElapsedHours >= 0), mh + ' man-hours read as a real clock: ' + s.totalElapsedHours);
    assert.ok(!(s.steps[0]!.cumulativeHours >= 0), mh + ' man-hours read as a stage completed on the clock');
  }

  // A plan may also not declare its own stages away: the schedule bills the larger of the declared
  // total and the stages it prints, so an understated total cannot buy a shorter clock.
  const understated: StagePlan = {
    steps: [{ id: 'hasty', label: 'Hasty dig', detail: '', manHours: 100, bom: [] }],
    totalManHours: 0,
    positions: 1,
    jobManHours: 0,
  };
  const s = scheduleStages(understated, { teamSize: 4, availableHours: 24, securityPostureFrac: 1 });
  assert.equal(s.feasible, false, '100 man-hours of stages cannot finish in 24 hr with 4 diggers');
  assert.equal(s.totalElapsedHours, 25, 'the stages it prints are the work it bills');
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
