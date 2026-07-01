import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';
import type { Derivation } from '../src/engine/types';

const byKey = (ds: Derivation[]): Record<string, Derivation> =>
  Object.fromEntries(ds.map((d) => [d.key, d]));

test('every derivation has a finite result and named operands', () => {
  const ds = compute(defaultInputs()).derivations;
  assert.ok(ds.length > 0);
  for (const d of ds) {
    assert.ok(Number.isFinite(d.result), 'finite result: ' + d.key);
    assert.equal(typeof d.formula, 'string');
    for (const o of d.operands) {
      assert.equal(typeof o.name, 'string');
      assert.ok(Number.isFinite(o.value), 'finite operand: ' + d.key + '/' + o.name);
    }
  }
});

test('derivation results are consistent with their own operands (real operands, not decoration)', () => {
  const d = byKey(compute(defaultInputs()).derivations);
  const depth = d['depthOfCut']!;
  assert.ok(Math.abs(depth.result - depth.operands[0]!.value * depth.operands[1]!.value) < 1e-9);

  const setback = d['setback']!;
  const [min, frac, dc] = setback.operands.map((o) => o.value);
  assert.ok(Math.abs(setback.result - Math.max(min!, frac! * dc!)) < 1e-9);

  const total = d['manHoursTotal']!;
  assert.ok(Math.abs(total.result - total.operands[0]!.value * total.operands[1]!.value) < 1e-9);
});

test('doctrine-backed operands expose placeholder status + source (§12 trace)', () => {
  const d = byKey(compute(defaultInputs()).derivations);
  const mult = d['depthOfCut']!.operands.find((o) => o.name === 'depthMultiplier')!;
  assert.equal(mult.placeholder, true, 'fresh build ⇒ placeholder');
  assert.ok((mult.source ?? '').length > 0, 'has a source');
});

test('engineered roof derivation reports 0 with an explicit note, never a fabricated number (§2.7)', () => {
  const d = byKey(compute(defaultInputs({ threat: 'at-he-contact', overheadCover: true })).derivations);
  const cover = d['coverThickness'];
  assert.ok(cover, 'a coverThickness derivation exists when cover is requested');
  assert.equal(cover.result, 0);
  assert.match(cover.formula, /engineered/i);
  assert.equal(cover.operands.length, 0);
});
