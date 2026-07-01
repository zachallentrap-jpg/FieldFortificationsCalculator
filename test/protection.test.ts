import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCover } from '../src/engine/protection';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';

test('resolveCover: earth roof for a covered munition produces a positive thickness', () => {
  const c = resolveCover('ind-mtr-81', true, 1.0);
  assert.equal(c.roofPath, 'earth_on_stringers');
  assert.ok(c.thickness > 0);
  assert.ok(c.material.length > 0);
});

test('resolveCover: contact-burst and shaped-charge NEVER fabricate a thickness (§2.7)', () => {
  for (const threat of ['at-rpg', 'at-tank', 'at-he-contact']) {
    const c = resolveCover(threat, true, 1.0);
    assert.equal(c.roofPath, 'engineered_required');
    assert.equal(c.thickness, 0);
    assert.equal(c.material, '');
    assert.equal(c.thicknessLeaf, undefined);
  }
});

test('resolveCover: no cover requested ⇒ none / zero', () => {
  const c = resolveCover('ind-mtr-81', false, 1.0);
  assert.equal(c.roofPath, 'none');
  assert.equal(c.thickness, 0);
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
  const hasty = resolveCover('ind-mtr-81', true, 0.5);
  const deliberate = resolveCover('ind-mtr-81', true, 1.0);
  assert.ok(hasty.thickness < deliberate.thickness);
  // A coverMul can never turn an engineered roof into a numeric thickness.
  assert.equal(resolveCover('at-rpg', true, 99).thickness, 0);
});

test('caliber SIZE drives the numbers: bigger round ⇒ more cover thickness and standoff', () => {
  const cover = (t: string): number => resolveCover(t, true, 1.0).thickness;
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
