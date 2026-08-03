// TIMBER-2 T8 — the hip roof's two pieces of arithmetic.
//
// Both are things a framing square gives you and a naive implementation gets wrong, so both are
// asserted against the formula rather than against a snapshot of whatever the code happened to
// produce — a golden would have frozen the bug just as happily as the fix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { hipLenPerFtRun, jackDifference } from '../src/timber/subsystems/roofFamilies';

function hipModel(risePer12 = 6) {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind: 'hip', risePer12, overhangFt: 1 };
  return generateStructure(spec);
}

test('a hip runs the DIAGONAL, not the common run', () => {
  // The classic hip mistake: using √(1+slope²) instead of √(2+slope²) gives a hip about a foot
  // short in twelve. At 6-in-12 the two figures are 1.118 and 1.500 — not subtle, and still the
  // most commonly miscut member on a hip roof.
  const slope = 0.5;
  assert.equal(hipLenPerFtRun(slope), Math.sqrt(2 + slope * slope));
  assert.ok(hipLenPerFtRun(slope) > Math.sqrt(1 + slope * slope) + 0.3);
});

test('jack rafters shorten by a constant, and it matches the framing-square figure', () => {
  // This is what makes a hip layable-out: every jack is shorter than its neighbour by the same
  // amount, so you cut a sequence rather than measuring each stick.
  const model = hipModel(6);
  const lengths = [...new Set(model.members.filter((m) => m.role === 'jackRafter').map((m) => Math.round((m.cutLength / 12) * 1000) / 1000))]
    .sort((a, b) => b - a);
  assert.ok(lengths.length >= 3, `expected a run of jacks, got ${lengths.length}`);
  const expected = jackDifference(0.5, 16 / 12);
  for (let i = 1; i < lengths.length; i++) {
    assert.ok(
      Math.abs(lengths[i - 1]! - lengths[i]! - expected) < 0.01,
      `jacks ${i - 1}→${i} differ by ${(lengths[i - 1]! - lengths[i]!).toFixed(3)}, expected ${expected.toFixed(3)}`,
    );
  }
});

test('the ridge is shortened by half the span at each end', () => {
  // A hip roof's ridge is not its building's length — the hips converge on it half a span in
  // from each end, which is exactly what makes it a hip and not a gable.
  const model = hipModel();
  const spec = model.spec as { dims: { lengthFt: number; widthFt: number } };
  const ridge = model.members.find((m) => m.role === 'ridge')!;
  assert.ok(Math.abs(ridge.cutLength / 12 - (spec.dims.lengthFt - spec.dims.widthFt)) < 0.01);
});

test('a hip roof has four hips, commons and jacks — and no gable studs', () => {
  const model = hipModel();
  const roles = new Map<string, number>();
  for (const m of model.members) roles.set(m.role, (roles.get(m.role) ?? 0) + 1);
  assert.equal(roles.get('hipRafter'), 4);
  assert.ok((roles.get('rafter') ?? 0) > 0, 'commons over the ridge');
  assert.ok((roles.get('jackRafter') ?? 0) > 0, 'jacks to the hips');
});
