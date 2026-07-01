import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { planForTime } from '../src/engine/plan';
import { aggregateMission } from '../src/engine/mission';
import { FIXTURES, defaultInputs } from './helpers';

test('compute is deterministic — identical inputs give deep-equal, byte-identical Results (§2.2)', () => {
  for (const inputs of FIXTURES) {
    const a = compute(inputs);
    const b = compute(inputs);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});

test('compute does not mutate its input object', () => {
  const inputs = defaultInputs({ count: 3 });
  const snapshot = JSON.stringify(inputs);
  compute(inputs);
  assert.equal(JSON.stringify(inputs), snapshot);
});

test('plan and mission are deterministic too', () => {
  const p1 = planForTime({ availableHours: 20, teamSize: 3, base: defaultInputs() });
  const p2 = planForTime({ availableHours: 20, teamSize: 3, base: defaultInputs() });
  assert.equal(JSON.stringify(p1), JSON.stringify(p2));

  const items = [{ inputs: defaultInputs() }, { inputs: defaultInputs({ positionType: 'one_man' }) }];
  const m1 = aggregateMission(items, { onHand: { sandbags_parapet: 10 } });
  const m2 = aggregateMission(items, { onHand: { sandbags_parapet: 10 } });
  assert.equal(JSON.stringify(m1), JSON.stringify(m2));
});
