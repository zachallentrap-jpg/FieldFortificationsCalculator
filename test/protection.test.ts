import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCover } from '../src/engine/protection';
import { compute } from '../src/engine/compute';
import { coverMaterialDefault, spanSizes } from '../src/doctrine/protection';
import type { ShieldMaterial } from '../src/doctrine/protection';
import { defaultInputs } from './helpers';

// A clear span comfortably inside the stringer table, so these cases exercise the threat and
// data axes rather than the span one. resolveCover takes the span as a REQUIRED argument —
// there is no call shape that skips the span fail-safe.
const SHORT_SPAN = spanSizes[0]!.maxSpan.value;

test('resolveCover: earth roof for a covered munition produces a positive thickness', () => {
  const c = resolveCover('ind-mtr-81', true, 1.0, SHORT_SPAN);
  assert.equal(c.roofPath, 'earth_on_stringers');
  assert.ok(c.thickness > 0);
  assert.ok(c.material.length > 0);
});

test('resolveCover: contact-burst and shaped-charge NEVER fabricate a thickness (§2.7)', () => {
  for (const threat of ['at-rpg', 'at-tank', 'at-he-contact']) {
    const c = resolveCover(threat, true, 1.0, SHORT_SPAN);
    assert.equal(c.roofPath, 'engineered_required');
    assert.equal(c.thickness, 0);
    assert.equal(c.material, '');
    assert.equal(c.thicknessLeaf, undefined);
  }
});

test('resolveCover: no cover requested ⇒ none / zero', () => {
  const c = resolveCover('ind-mtr-81', false, 1.0, SHORT_SPAN);
  assert.equal(c.roofPath, 'none');
  assert.equal(c.thickness, 0);
});

test('resolveCover cannot be called without a clear span — the fail-safe is not opt-in', () => {
  // A fail-safe a caller can skip by leaving an argument off is not a fail-safe, so the span is
  // a required parameter and the type system is the lock. This directive IS the assertion: make
  // `clearSpanFt` optional again and it becomes an unused @ts-expect-error, which `tsc --noEmit`
  // reports as an error. Never executed — only compiled.
  const spanless = (): unknown => {
    // @ts-expect-error — the clear span is required
    return resolveCover('ind-mtr-81', true, 1.0);
  };
  assert.equal(typeof spanless, 'function');
});

test('resolveCover: a threat with no shielding data fails SAFE, not open', () => {
  // Simulate the gap the fail-safe exists for: the cover material named for this threat is not
  // one the shielding table covers, so there is no thickness to size a roof from. The pre-audit
  // branch treated that as zero and still returned an earth roof — a drawn roof, billed
  // stringers, zero protection, and no warning anywhere downstream.
  const threat = 'ind-mtr-81';
  const original = coverMaterialDefault[threat]!;
  coverMaterialDefault[threat] = 'no_such_material' as ShieldMaterial;
  try {
    const c = resolveCover(threat, true, 1.0, SHORT_SPAN);
    assert.equal(c.roofPath, 'engineered_required', 'a missing shielding leaf must route to the engineer');
    assert.equal(c.thickness, 0, 'never a fabricated thickness over a data gap');
    assert.equal(c.material, '');
    assert.equal(c.thicknessLeaf, undefined);
  } finally {
    coverMaterialDefault[threat] = original;
  }
});

test('compute: a shielding data gap bills no roof and says why', () => {
  const threat = 'ind-mtr-81';
  const original = coverMaterialDefault[threat]!;
  coverMaterialDefault[threat] = 'no_such_material' as ShieldMaterial;
  try {
    const res = compute(defaultInputs({ threat, overheadCover: true }));
    assert.equal(res.cover.roofPath, 'engineered_required');
    assert.equal(res.cover.thickness, 0);
    const ids = res.bom.map((l) => l.id);
    assert.ok(!ids.includes('stringers'), 'no stringers billed for a roof the engine refuses to size');
    assert.ok(!ids.includes('cover_soil_fill') && !ids.includes('sandbags_cover'), 'no cover material billed');
    const codes = res.validation.map((v) => v.code);
    assert.ok(codes.includes('ROOF_ENGINEERED'), 'the operator is told the roof must be engineered');
    assert.ok(codes.includes('ROOF_NO_SHIELDING_DATA'), 'and told the reason is a missing doctrine value');
  } finally {
    coverMaterialDefault[threat] = original;
  }
});

test('compute: engineered threat yields zero cover, no cover BOM, and a ROOF_ENGINEERED warning', () => {
  const res = compute(defaultInputs({ threat: 'at-he-contact', overheadCover: true }));
  assert.equal(res.cover.roofPath, 'engineered_required');
  assert.equal(res.cover.thickness, 0);
  const ids = res.bom.map((l) => l.id);
  assert.ok(!ids.includes('sandbags_cover'), 'no fabricated cover sandbags');
  assert.ok(!ids.includes('stringers'), 'no fabricated stringers');
  assert.ok(res.validation.some((v) => v.code === 'ROOF_ENGINEERED'));
});

test('coverMul scales an earth roof but never an engineered one', () => {
  const hasty = resolveCover('ind-mtr-81', true, 0.5, SHORT_SPAN);
  const deliberate = resolveCover('ind-mtr-81', true, 1.0, SHORT_SPAN);
  assert.ok(hasty.thickness < deliberate.thickness);
  // A coverMul can never turn an engineered roof into a numeric thickness.
  assert.equal(resolveCover('at-rpg', true, 99, SHORT_SPAN).thickness, 0);
});

test('caliber SIZE drives the numbers: bigger round ⇒ more cover thickness and standoff', () => {
  const cover = (t: string): number => resolveCover(t, true, 1.0, SHORT_SPAN).thickness;
  // Small-arms ladder 5.56 → 7.62 → 12.7 → 14.5 is non-decreasing.
  assert.ok(cover('sa-556') <= cover('sa-762'));
  assert.ok(cover('sa-762') <= cover('sa-127'));
  assert.ok(cover('sa-127') <= cover('sa-145'));
  // A 155mm shell demands far more cover than an 81mm mortar.
  assert.ok(cover('ind-mtr-81') < cover('ind-art-155'));
  // Standoff (setback) scales with the round too, at equal depth.
  const setback = (t: string): number => compute(defaultInputs({ threat: t, overheadCover: false })).resolved.setback;
  assert.ok(setback('ind-art-155') >= setback('sa-556'));
});
