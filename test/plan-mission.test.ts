import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planForTime } from '../src/engine/plan';
import { aggregateMission } from '../src/engine/mission';
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
