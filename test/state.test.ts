// §17 state — store/history behave, and layout/theme/unit operations never change input
// semantics (§2.8). Unit is a DISPLAY toggle: the computed feet-space result must be identical
// whether the operator views imperial or metric.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, DEFAULT_INPUTS } from '../src/state/store';
import { createHistory } from '../src/state/history';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';
import type { Result } from '../src/engine/types';

function stripInputs(r: Result): Omit<Result, 'inputs'> {
  const { inputs, ...rest } = r;
  return rest;
}

test('store: subscribe fires on change and unsubscribe stops it', () => {
  const s = createStore();
  let hits = 0;
  const off = s.subscribe(() => hits++);
  s.setInputs({ count: 5 });
  s.setState({ theme: 'night' });
  assert.equal(hits, 2);
  off();
  s.setInputs({ count: 6 });
  assert.equal(hits, 2, 'no notify after unsubscribe');
});

test('store: theme/layout changes never mutate inputs', () => {
  const s = createStore();
  const before = { ...s.getState().inputs };
  s.setState({ theme: 'night', layoutOverride: 'mobile', layoutMode: 'mobile' });
  assert.deepEqual(s.getState().inputs, before);
});

test('store: setInputs merges without dropping other fields', () => {
  const s = createStore();
  s.setInputs({ positionType: 'mg_crew' });
  s.setInputs({ count: 4 });
  assert.equal(s.getState().inputs.positionType, 'mg_crew');
  assert.equal(s.getState().inputs.count, 4);
  assert.equal(s.getState().inputs.standard, DEFAULT_INPUTS.standard);
});

test('unit is display-only: imperial vs metric yield an identical feet-space result (§2.8)', () => {
  const imp = compute(defaultInputs({ unit: 'imperial' }));
  const met = compute(defaultInputs({ unit: 'metric' }));
  assert.deepEqual(stripInputs(imp), stripInputs(met));
});

test('history: undo/redo swap inputs and track availability', () => {
  const h = createHistory(defaultInputs({ count: 1 }));
  assert.equal(h.canUndo(), false);
  assert.equal(h.canRedo(), false);

  h.push(defaultInputs({ count: 2 }));
  h.push(defaultInputs({ count: 3 }));
  assert.equal(h.current().count, 3);

  assert.equal(h.undo()?.count, 2);
  assert.equal(h.undo()?.count, 1);
  assert.equal(h.undo(), null);
  assert.equal(h.canUndo(), false);

  assert.equal(h.redo()?.count, 2);
  assert.equal(h.canRedo(), true);

  // A new push clears the redo branch.
  h.push(defaultInputs({ count: 9 }));
  assert.equal(h.canRedo(), false);
  assert.equal(h.current().count, 9);

  h.reset(defaultInputs({ count: 1 }));
  assert.equal(h.canUndo(), false);
  assert.equal(h.current().count, 1);
});
