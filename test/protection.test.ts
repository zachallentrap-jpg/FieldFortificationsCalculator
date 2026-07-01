import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCover } from '../src/engine/protection';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';

test('resolveCover: earth roof for fragmentation produces a positive thickness', () => {
  const c = resolveCover('fragmentation', true, 1.0);
  assert.equal(c.roofPath, 'earth_on_stringers');
  assert.ok(c.thickness > 0);
  assert.ok(c.material.length > 0);
});

test('resolveCover: contact-burst and shaped-charge NEVER fabricate a thickness (§2.7)', () => {
  for (const threat of ['direct_fire_he', 'shaped_charge']) {
    const c = resolveCover(threat, true, 1.0);
    assert.equal(c.roofPath, 'engineered_required');
    assert.equal(c.thickness, 0);
    assert.equal(c.material, '');
    assert.equal(c.thicknessLeaf, undefined);
  }
});

test('resolveCover: no cover requested ⇒ none / zero', () => {
  const c = resolveCover('fragmentation', false, 1.0);
  assert.equal(c.roofPath, 'none');
  assert.equal(c.thickness, 0);
});

test('compute: engineered threat yields zero cover, no cover BOM, and a ROOF_ENGINEERED warning', () => {
  const res = compute(defaultInputs({ threat: 'direct_fire_he', overheadCover: true }));
  assert.equal(res.cover.roofPath, 'engineered_required');
  assert.equal(res.cover.thickness, 0);
  const ids = res.bom.map((l) => l.id);
  assert.ok(!ids.includes('sandbags_cover'), 'no fabricated cover sandbags');
  assert.ok(!ids.includes('stringers'), 'no fabricated stringers');
  assert.ok(res.validation.some((v) => v.code === 'ROOF_ENGINEERED'));
});

test('coverMul scales an earth roof but never an engineered one', () => {
  const hasty = resolveCover('fragmentation', true, 0.5);
  const deliberate = resolveCover('fragmentation', true, 1.0);
  assert.ok(hasty.thickness < deliberate.thickness);
  // A coverMul can never turn an engineered roof into a numeric thickness.
  assert.equal(resolveCover('shaped_charge', true, 99).thickness, 0);
});
