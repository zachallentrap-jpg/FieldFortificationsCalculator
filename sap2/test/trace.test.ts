// The Unfilled algebra + opaque Traced (blueprint §4.3, INV-3): arithmetic on
// Unfilled yields Unfilled carrying the union of blocking leaf ids; every filled node
// re-evaluates from its deps to the stored value; div-by-zero and NaN are program
// errors, not data states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  add, div, inputQ, isFilled, isUnfilled, leafQ, mul, qmax, roundQ, structuralQ, sum,
  reevaluate, unfilled, unsafeValue, EngineInvariantError, type Q,
} from '../src/engine/trace';
import { resolve, EMPTY_FILL, type FillView } from '../src/engine/read';
import type { NumericLeaf } from '../src/schema/leaf';
import type { Mul, Div } from '../src/schema/units';

const depthLeaf: NumericLeaf = {
  id: 'one_man.hole.D', name: 'Hole depth', plainName: 'how deep you dig',
  definition: 'Vertical distance from grade to the fighting-bay floor, measured on the enemy-side wall.',
  meaningVersion: 1, pubPointer: 'unit SOP / battle drill card', citationKind: 'pub-cited',
  batch: 'positions.one_man', unit: 'ft', kind: 'dimension', integer: false, divisor: false,
  roundingDirection: 'exact', maxDecimals: 2, safetyCritical: true, bounds: { kind: 'sign', sign: '>0' },
};

const fillWith = (vals: Record<string, number>): FillView => ({
  numeric: (id) => vals[id],
  text: () => undefined,
});

test('empty fill resolves to Unfilled naming the leaf', () => {
  const q = resolve(EMPTY_FILL, depthLeaf);
  assert.ok(isUnfilled(q));
  assert.deepEqual(q.blockedBy, ['one_man.hole.D']);
});

test('unfilled propagates through arithmetic with union of blockers, sorted unique', () => {
  const a = unfilled(['leaf.b', 'leaf.a']);
  const b = unfilled(['leaf.c', 'leaf.a']);
  const out = add('t.sum', a, b as Q<'ft'>);
  assert.ok(isUnfilled(out));
  assert.deepEqual(out.blockedBy, ['leaf.a', 'leaf.b', 'leaf.c']);

  const filled = leafQ('leaf.d', 'leaf.d', 'ft', 3);
  const out2 = mul('t.area', filled, unfilled(['leaf.e']) as Q<'ft'>, 'ft2');
  assert.ok(isUnfilled(out2));
  assert.deepEqual(out2.blockedBy, ['leaf.e']);
});

test('typed arithmetic carries units and values', () => {
  const L = resolve(fillWith({ 'one_man.hole.D': 4 }), depthLeaf);
  assert.ok(isFilled(L));
  const W = inputQ('W', 'input.W', 'ft', 2);
  const area = mul('t.area', L, W, 'ft2');
  assert.ok(isFilled(area));
  assert.equal(area.unit, 'ft2');
  assert.equal(unsafeValue(area), 8);

  const vol = mul('t.vol', area, inputQ('D', 'input.D', 'ft', 3), 'ft3');
  const rate = leafQ('labor.rate', 'leaf.labor.rate', 'ft3_per_man_hour', 6);
  const mh = div('t.mh', vol, rate, 'man_hours');
  assert.ok(isFilled(mh));
  assert.equal(unsafeValue(mh), 4);

  // Compile-time unit algebra: these lines are the test.
  const _mulCheck: Mul<'ft', 'ft'> = 'ft2';
  const _divCheck: Div<'ft3', 'ft3_per_man_hour'> = 'man_hours';
  void _mulCheck; void _divCheck;
});

test('every node re-evaluates from its deps to the stored value', () => {
  const a = leafQ('x', 'leaf.x', 'ft', 2.5);
  const b = inputQ('y', 'input.y', 'ft', 4);
  const c = mul('t.c', a, b, 'ft2');
  const d = add('t.d', c, structuralQ('AL-test', 't.base', 'ft2', 1));
  const e = roundQ('t.e', d, 'up');
  assert.ok(isFilled(e));
  assert.equal(unsafeValue(e), 11);
  const walk = (n: typeof e.node): void => {
    assert.equal(reevaluate(n), unsafeValue({ kind: 'filled', unit: n.unit, node: n }));
    n.deps.forEach(walk);
  };
  walk(e.node);
});

test('sum of empty list is a zero node; sum with any unfilled is unfilled', () => {
  const z = sum('t.z', [], 'man_hours');
  assert.ok(isFilled(z));
  assert.equal(unsafeValue(z), 0);
  const s = sum('t.s', [leafQ('a', 'leaf.a', 'ft', 1), unfilled(['b'])], 'ft');
  assert.ok(isUnfilled(s));
  assert.deepEqual(s.blockedBy, ['b']);
});

test('division by zero and non-finite construction throw EngineInvariantError', () => {
  const num = leafQ('n', 'leaf.n', 'ft3', 8);
  const zero = inputQ('z', 'input.z', 'ft3_per_man_hour', 0);
  assert.throws(() => div('t.bad', num, zero, 'man_hours'), EngineInvariantError);
  assert.throws(() => leafQ('nan', 'leaf.nan', 'ft', Number.NaN), EngineInvariantError);
  assert.throws(() => leafQ('inf', 'leaf.inf', 'ft', Infinity), EngineInvariantError);
});

test('max keeps fail-safe semantics under partial data (unfilled wins, not silently dropped)', () => {
  const known = leafQ('a', 'leaf.a', 'ft', 5);
  const missing = unfilled(['b']);
  const out = qmax('t.max', known, missing as Q<'ft'>);
  // A cover requirement with an unknown contributor is UNKNOWN, not "the known one".
  assert.ok(isUnfilled(out));
});
