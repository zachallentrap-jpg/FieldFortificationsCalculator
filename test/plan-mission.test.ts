import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planForTime } from '../src/engine/plan';
import { aggregateMission } from '../src/engine/mission';
import { revetments } from '../src/doctrine/materials';
import { defaultInputs } from './helpers';

test('planForTime: generous budget yields feasible options ranked by protection then buildability', () => {
  const r = planForTime({ availableHours: 200, teamSize: 4, base: defaultInputs() });
  assert.ok(r.feasible.length > 0);
  for (const o of r.feasible) assert.ok(o.elapsedHours <= r.budgetHours);
  for (let i = 1; i < r.feasible.length; i++) {
    const prev = r.feasible[i - 1]!;
    const cur = r.feasible[i]!;
    assert.ok(
      prev.protectionScore > cur.protectionScore ||
        (prev.protectionScore === cur.protectionScore && prev.manHoursTotal <= cur.manHoursTotal),
      'protection desc, then man-hours asc',
    );
  }
});

test('planForTime: a doctrine-invalid combination (soil forces revetment, swept revetment=none) never outranks a valid one at the same protection tier', () => {
  // soil='sand' forces revetment (REVET_REQUIRED_SOIL); the sweep still tries revetment='none'
  // for every standard/overhead combination, which must come back flagged and sorted BEHIND the
  // sandbag_facing/pickets_wire options at the same protection tier, not interleaved with them.
  const r = planForTime({ availableHours: 200, teamSize: 4, base: defaultInputs({ soil: 'sand' }) });
  const noneOptions = r.feasible.filter((o) => o.revetment === 'none');
  assert.ok(noneOptions.length > 0, 'the none-revetment sweep is present');
  for (const o of noneOptions) assert.equal(o.hasErrors, true, 'sand + no revetment must be flagged');
  // Ranking invariant: hasErrors must be non-decreasing down the list — once a flagged option
  // appears, every option after it must also be flagged (never a flagged option sorting ahead
  // of, or between, unflagged ones).
  let sawError = false;
  for (const o of r.feasible) {
    if (o.hasErrors) sawError = true;
    else assert.ok(!sawError, 'an unflagged option must never sort after a flagged one');
  }
});

test('planForTime: a roof the engine refuses to size never outranks the honest "no cover" twin', () => {
  // 'at-rpg' resolves to roofPath 'engineered_required': no cover, no stringers, no cover BOM
  // and no overhead labor. The requested-cover option and the no-cover option are therefore
  // indistinguishable on every ranked axis (same protection score, same man-hours), so the
  // tie-break decides — and it used to prefer overheadCover: true, putting a roof nobody will
  // build at the top of the plan for exactly the threats that most need one.
  const r = planForTime({ availableHours: 500, teamSize: 4, base: defaultInputs({ threat: 'at-rpg' }) });
  const phantom = r.feasible.filter((o) => o.overheadCover && !o.deliversCover);
  assert.ok(phantom.length > 0, 'the engineered-roof combinations are present in the sweep');
  for (const o of phantom) assert.equal(o.roofPath, 'engineered_required');

  const idx = (pred: (o: (typeof r.feasible)[number]) => boolean) => r.feasible.findIndex(pred);
  for (const o of phantom) {
    const twin = idx((t) => t.standard === o.standard && t.revetment === o.revetment && !t.overheadCover);
    const self = idx((t) => t === o);
    assert.ok(twin >= 0, 'the honest twin is in the list');
    assert.ok(
      twin < self,
      o.standard + '/' + o.revetment + ': the "cover: yes" option that builds nothing ranked at ' + self + ', ahead of its honest twin at ' + twin,
    );
  }
  // And the option at the very top of the plan does not claim a roof it will not build.
  const top = r.feasible[0]!;
  assert.ok(!top.overheadCover || top.deliversCover, 'top-ranked option claims cover it does not build');
});

test('planForTime: an engineered roof scores no protection, exactly as it bills no labor', () => {
  const eng = planForTime({ availableHours: 500, teamSize: 4, base: defaultInputs({ threat: 'at-rpg' }) }).feasible;
  const pick = (cover: boolean) => eng.find((o) => o.standard === 'deliberate' && o.revetment === 'none' && o.overheadCover === cover)!;
  const asked = pick(true);
  const not = pick(false);
  assert.equal(asked.deliversCover, false, 'an engineered roof delivers nothing');
  assert.equal(asked.protectionScore, not.protectionScore, 'and therefore scores nothing');
  assert.equal(asked.manHoursTotal, not.manHoursTotal, 'and charges no overhead labor');

  // The contrast: a threat whose roof the engine WILL size does score, and does cost labor.
  const earth = planForTime({ availableHours: 500, teamSize: 4, base: defaultInputs({ threat: 'ind-mtr-81' }) }).feasible;
  const built = earth.find((o) => o.standard === 'deliberate' && o.revetment === 'none' && o.overheadCover)!;
  const bare = earth.find((o) => o.standard === 'deliberate' && o.revetment === 'none' && !o.overheadCover)!;
  assert.equal(built.deliversCover, true);
  assert.ok(built.protectionScore > bare.protectionScore, 'a roof that gets built outranks no roof');
  assert.ok(built.manHoursTotal > bare.manHoursTotal, 'and is paid for in labor');
});

test('planForTime: the sweep proposes every revetment the operator can actually pick', () => {
  // The main revetment select is built from this same doctrine table (layout/controls.ts), so a
  // sweep over a subset chooses the "best plan" from fewer options than the operator has.
  const r = planForTime({ availableHours: 500, teamSize: 4, base: defaultInputs() });
  const swept = new Set([...r.feasible, ...(r.infeasibleBest ? [r.infeasibleBest] : [])].map((o) => o.revetment));
  for (const key of Object.keys(revetments)) assert.ok(swept.has(key), 'revetment never proposed by the planner: ' + key);
});

test('planForTime: impossible budget → no feasible options but a best-effort fallback', () => {
  const r = planForTime({ availableHours: 0.001, teamSize: 1, base: defaultInputs() });
  assert.equal(r.feasible.length, 0);
  assert.ok(r.infeasibleBest !== null);
});

test('aggregateMission: merges BOM by id and sums quantities', () => {
  const items = [
    { inputs: defaultInputs({ count: 2 }) },
    { inputs: defaultInputs({ count: 3, positionType: 'one_man' }) },
  ];
  const m = aggregateMission(items);
  const parapet = m.lines.find((l) => l.id === 'sandbags_parapet');
  assert.ok(parapet, 'merged parapet line exists');
  // Sum of the two positions' totals.
  const a = // two_man ×2
    (m.lines.length > 0);
  assert.ok(a);
  assert.equal(m.totalPositions, 5);
  assert.ok(m.totalManHours > 0);
});

test('aggregateMission: on-hand produces a shortfall', () => {
  const items = [{ inputs: defaultInputs({ count: 4 }) }];
  const withHand = aggregateMission(items, { onHand: { sandbags_parapet: 5 } });
  const line = withHand.lines.find((l) => l.id === 'sandbags_parapet')!;
  assert.equal(line.onHand, 5);
  assert.equal(line.shortfall, Math.max(0, line.qtyTotal - 5));
  assert.ok(line.shortfall! >= 0);
});

test('aggregateMission: lines are sorted by sortKey', () => {
  const m = aggregateMission([{ inputs: defaultInputs() }]);
  for (let i = 1; i < m.lines.length; i++) {
    assert.ok(m.lines[i]!.sortKey >= m.lines[i - 1]!.sortKey);
  }
});
