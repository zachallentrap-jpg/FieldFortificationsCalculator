// TIMBER-2 — the cutaway plane (plan §8.7, §4.2).
//
// The one property that makes the feature trustworthy: the renderer and the click-picker use
// the SAME plane. If they drift, you click a stud you can see and select the one hidden behind
// the cut — which reads as the app being broken, not as a subtle geometry bug.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cutPlaneEq, passesCut, signedDistance, cutStation, planeForState,
  initialCutawayState, toggleAxis, setDepth, CUT_AXES, axisById, type Aabb,
} from '../src/ui/woodframe/cutaway';
import { FAMILY_TABLE } from '../src/timber/catalog';

const box: Aabb = { min: [0, -2, 0], max: [20, 10, 16] };

test('the cut lands where frac says, on every axis', () => {
  assert.equal(cutStation({ axis: 'x', frac: 0, keep: 1, reason: '' }, box), 0);
  assert.equal(cutStation({ axis: 'x', frac: 1, keep: 1, reason: '' }, box), 20);
  assert.equal(cutStation({ axis: 'x', frac: 0.5, keep: 1, reason: '' }, box), 10);
  assert.equal(cutStation({ axis: 'y', frac: 0.5, keep: 1, reason: '' }, box), 4);
  assert.equal(cutStation({ axis: 'z', frac: 0.25, keep: 1, reason: '' }, box), 4);
});

test('keep +1 and keep -1 select opposite halves, and the boundary is kept', () => {
  const plus = cutPlaneEq({ axis: 'z', frac: 0.5, keep: 1, reason: '' }, box);
  const minus = cutPlaneEq({ axis: 'z', frac: 0.5, keep: -1, reason: '' }, box);
  assert.ok(passesCut([10, 0, 12], plus), '+1 keeps the far side');
  assert.ok(!passesCut([10, 0, 4], plus), '+1 clips the near side');
  assert.ok(!passesCut([10, 0, 12], minus), '-1 keeps the near side');
  assert.ok(passesCut([10, 0, 4], minus));
  // Exactly on the plane: kept by both, so a member centered on the cut never flickers.
  assert.ok(passesCut([10, 0, 8], plus));
  assert.ok(passesCut([10, 0, 8], minus));
  assert.equal(signedDistance([10, 0, 8], plus), 0);
});

test('frac clamps: 0 and 1 are the ends, out-of-range values do not escape the model', () => {
  const low = cutPlaneEq({ axis: 'x', frac: -5, keep: 1, reason: '' }, box);
  const high = cutPlaneEq({ axis: 'x', frac: 99, keep: 1, reason: '' }, box);
  assert.equal(-low.constant, 0, 'frac below 0 pins to the min face');
  assert.equal(-high.constant, 20, 'frac above 1 pins to the max face');
});

test('a null plane passes everything — no cut means no filtering', () => {
  assert.ok(passesCut([0, 0, 0], null));
  assert.ok(passesCut([1e6, -1e6, 0], null));
});

test('the y-axis cut works on a tall model (the tower case)', () => {
  const tall: Aabb = { min: [0, 0, 0], max: [8, 32, 8] };
  const eq = cutPlaneEq({ axis: 'y', frac: 0.5, keep: -1, reason: '' }, tall);
  assert.ok(passesCut([4, 4, 4], eq), 'below the cut is kept');
  assert.ok(!passesCut([4, 30, 4], eq), 'the cab is clipped away');
});

test('the plane normal is a unit axis vector — nothing else', () => {
  for (const axis of ['x', 'y', 'z'] as const) {
    for (const keep of [1, -1] as const) {
      const eq = cutPlaneEq({ axis, frac: 0.5, keep, reason: '' }, box);
      const len = Math.hypot(eq.normal[0], eq.normal[1], eq.normal[2]);
      assert.ok(Math.abs(len - 1) < 1e-12, `${axis}/${keep}: normal must be unit`);
      const nonZero = eq.normal.filter((n) => n !== 0);
      assert.equal(nonZero.length, 1, 'axis-aligned only');
    }
  }
});

test('axis chips are plain-first with the compass in parentheses, and name their anchor', () => {
  assert.equal(CUT_AXES.length, 3);
  for (const a of CUT_AXES) {
    assert.ok(/\(.+\)/.test(a.label) || a.id === 'flat', `${a.id}: compass belongs in parentheses`);
    // The anchor kills the #1 field ambiguity: what the depth is measured FROM.
    assert.ok(a.anchor.startsWith('from') || a.anchor.startsWith('above'), `${a.id}: anchor "${a.anchor}"`);
  }
  assert.equal(axisById('front-rear').axis, 'z');
  assert.equal(axisById('left-right').axis, 'x');
  assert.equal(axisById('flat').axis, 'y');
});

test('depth defaults to 50% and each axis remembers its own', () => {
  let s = initialCutawayState();
  assert.equal(s.active, null, 'no cut until asked for');
  for (const axis of CUT_AXES) assert.equal(s.depth[axis.id], 0.5, `${axis.id}: 50% default`);

  s = toggleAxis(s, 'front-rear');
  assert.equal(s.active, 'front-rear');
  s = setDepth(s, 0.8);
  assert.equal(s.depth['front-rear'], 0.8);

  s = toggleAxis(s, 'left-right');
  assert.equal(s.depth['left-right'], 0.5, 'a fresh axis starts at 50%');
  assert.equal(s.depth['front-rear'], 0.8, 'and the other axis kept the depth you set');

  s = toggleAxis(s, 'left-right');
  assert.equal(s.active, null, 'tapping the active axis turns the cut off');
});

test('depth clamps, and setting depth with no active axis is a no-op', () => {
  let s = toggleAxis(initialCutawayState(), 'flat');
  s = setDepth(s, 5);
  assert.equal(s.depth.flat, 1);
  s = setDepth(s, -3);
  assert.equal(s.depth.flat, 0);
  const off = setDepth(initialCutawayState(), 0.9);
  assert.deepEqual(off, initialCutawayState());
});

test('planeForState returns null when off and a live plane when on', () => {
  const s = initialCutawayState();
  assert.equal(planeForState(s, box), null);
  const on = setDepth(toggleAxis(s, 'front-rear'), 0.25);
  const eq = planeForState(on, box)!;
  assert.ok(eq, 'a plane exists once an axis is active');
  assert.equal(-eq.constant / eq.normal[2], 4, 'z cut at 25% of a 16-ft width');
});

test('mandate #5: every catalog family has a cut spec that resolves to a real plane', () => {
  for (const f of FAMILY_TABLE) {
    const eq = cutPlaneEq(f.cutaway, box);
    assert.ok(Number.isFinite(eq.constant), `${f.id}: non-finite plane`);
    const len = Math.hypot(eq.normal[0], eq.normal[1], eq.normal[2]);
    assert.ok(Math.abs(len - 1) < 1e-12, `${f.id}: bad normal`);
    // The cut must actually divide the model — not sit outside it.
    const station = cutStation(f.cutaway, box);
    const i = f.cutaway.axis === 'x' ? 0 : f.cutaway.axis === 'y' ? 1 : 2;
    assert.ok(station >= box.min[i]! && station <= box.max[i]!, `${f.id}: cut outside the model`);
  }
});
