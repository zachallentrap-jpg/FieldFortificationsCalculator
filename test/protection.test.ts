import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCover } from '../src/engine/protection';
import { compute } from '../src/engine/compute';
import '../src/doctrine/index';
import { coverMaterialDefault, spanSizes } from '../src/doctrine/protection';
import type { ShieldMaterial } from '../src/doctrine/protection';
import { importDoctrine } from '../src/doctrine/io';
import { getByPath } from '../src/doctrine/registry';
import { DOCTRINE_VERSION } from '../src/version';
import { defaultInputs } from './helpers';

// Run `body` against a doctrine table holding the given leaf values, then put the originals
// back — through the sanctioned importer both ways, so every fixture here is a fill a qualified
// user could actually have made offline.
function withDoctrine(values: Record<string, number>, body: () => void): void {
  const fileOf = (v: Record<string, number>): unknown => ({
    doctrineVersion: DOCTRINE_VERSION,
    entries: Object.entries(v).map(([path, value]) => ({ path, value, status: 'PLACEHOLDER', source: getByPath(path)!.source })),
  });
  const before = Object.fromEntries(Object.keys(values).map((p) => [p, getByPath(p)!.value as number]));
  assert.ok(importDoctrine(fileOf(values)).ok, 'fixture fill applies');
  try {
    body();
  } finally {
    assert.ok(importDoctrine(fileOf(before)).ok, 'doctrine restored');
  }
}

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

// The clear span is a REQUIRED parameter — a fail-safe a caller can skip by leaving an argument
// off is not a fail-safe. That lock is a COMPILE-time one: the directive below is the assertion,
// and making `clearSpanFt` optional again turns it into an unused @ts-expect-error, which
// `npm run typecheck` (and so `npm run verify`, which runs typecheck before the tests) reports
// as an error. The test runner cannot see it, which is why this is not written as a test.
const _spanIsRequired = (): unknown => {
  // @ts-expect-error — the clear span is required
  return resolveCover('ind-mtr-81', true, 1.0);
};
void _spanIsRequired;

test('resolveCover: a span past the stringer table fails safe, whatever else is fine', () => {
  const beyond = spanSizes[spanSizes.length - 1]!.maxSpan.value + 1;
  const c = resolveCover('ind-mtr-81', true, 1.0, beyond);
  assert.equal(c.roofPath, 'engineered_required');
  assert.equal(c.thickness, 0, 'never a fabricated thickness beyond the tabulated spans');
  assert.equal(c.engineeredReason, 'span');
});

test('resolveCover: a threat with no shielding data fails SAFE, not open', () => {
  // The cover material named for this threat is not one the shielding table covers, so there is
  // no thickness to size a roof from. Reading that gap as zero drew a roof, billed the stringers,
  // delivered no protection, and said nothing downstream.
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

// A required thickness of zero for a real munition is not "no cover needed" — nothing stops a
// round. It means the value is absent, and the import bound (0 ≤ v < 1000) accepts it, so a
// perfectly valid fill can put one there. Both routes below end in the same state if the engine
// takes it literally: a roof drawn at zero feet, eight stringers billed, and no roof issue at
// all (ROOF_ENGINEERED cannot fire on an earth roof, and the too-thin check needs a thickness).
test('compute: a shielding thickness FILLED to zero fails safe — no roof, no stringers, and it says why', () => {
  withDoctrine({ 'protection.shielding.sa-556.soil': 0 }, () => {
    const res = compute(defaultInputs({ threat: 'sa-556', overheadCover: true, standard: 'deliberate' }));
    assert.equal(res.cover.roofPath, 'engineered_required', 'zero thickness is a data gap, not a buildable roof');
    assert.equal(res.cover.thickness, 0);
    const ids = res.bom.map((l) => l.id);
    assert.ok(!ids.includes('stringers'), 'no stringers billed for a roof of no thickness');
    assert.ok(!ids.includes('cover_soil_fill') && !ids.includes('sandbags_cover'), 'no cover material billed');
    const codes = res.validation.map((v) => v.code);
    assert.ok(codes.includes('ROOF_ENGINEERED'), 'the operator is told the roof must be engineered');
    assert.ok(codes.includes('ROOF_NO_SHIELDING_DATA'), 'and told which doctrine value is missing');
  });
});

test('compute: a cover multiplier FILLED to zero fails safe the same way', () => {
  withDoctrine({ 'standards.hasty.coverMul': 0 }, () => {
    const res = compute(defaultInputs({ threat: 'sa-556', overheadCover: true, standard: 'hasty' }));
    assert.equal(res.cover.roofPath, 'engineered_required', 'a requirement scaled to nothing is not a roof either');
    assert.equal(res.cover.thickness, 0);
    assert.ok(!res.bom.map((l) => l.id).includes('stringers'), 'no stringers billed');
    const codes = res.validation.map((v) => v.code);
    assert.ok(codes.includes('ROOF_ENGINEERED'));
    assert.ok(codes.includes('ROOF_NO_COVER_MULTIPLIER'), 'and told it was the standard, not the shielding table');
  });
});

test('resolveCover: no non-positive multiplier ever yields an earth roof', () => {
  for (const mul of [0, -1]) {
    const c = resolveCover('ind-mtr-81', true, mul, SHORT_SPAN);
    assert.equal(c.roofPath, 'engineered_required', 'coverMul ' + mul);
    assert.equal(c.thickness, 0);
    assert.equal(c.material, '');
    assert.equal(c.thicknessLeaf, undefined, 'no shielding leaf is claimed for a roof that was not sized');
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
