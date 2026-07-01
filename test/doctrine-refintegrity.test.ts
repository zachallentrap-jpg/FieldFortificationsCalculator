import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positions } from '../src/doctrine/positions';
import { soils } from '../src/doctrine/soils';
import { standards } from '../src/doctrine/standards';
import { revetments } from '../src/doctrine/materials';
import {
  threats,
  shielding,
  radiationHalving,
  coverMaterialDefault,
  roofSelector,
  shieldMaterials,
  roofPathFor,
} from '../src/doctrine/protection';

const SHAPES = new Set(['rect', 'inverted_t', 'l_shape', 'circular', 'vehicle_ramp', 'rect_roofed']);
const REVET_KINDS = new Set(['none', 'bag', 'picket', 'panel']);

test('every threat has a shielding row, cover-material default, and roof-selector entry', () => {
  for (const threat of Object.keys(threats)) {
    assert.ok(shielding[threat], 'shielding row for ' + threat);
    assert.ok(coverMaterialDefault[threat], 'coverMaterialDefault for ' + threat);
    assert.ok(roofSelector[threat], 'roofSelector for ' + threat);
  }
});

test('every shielding row covers every material; radiationHalving covers every material', () => {
  for (const threat of Object.keys(shielding)) {
    for (const mat of shieldMaterials) {
      assert.ok(shielding[threat]?.[mat], 'shielding[' + threat + '][' + mat + ']');
    }
  }
  for (const mat of shieldMaterials) {
    assert.ok(radiationHalving[mat], 'radiationHalving[' + mat + ']');
  }
});

test('every cover-material default resolves to a real shield material', () => {
  const mats = new Set<string>(shieldMaterials);
  for (const [threat, mat] of Object.entries(coverMaterialDefault)) {
    assert.ok(mats.has(mat), threat + ' → unknown material ' + mat);
  }
});

test('contact-burst and shaped-charge always resolve to engineered_required (§2.7)', () => {
  for (const id of ['at-rpg', 'at-recoilless', 'at-tank', 'at-he-contact', 'blast-vbied']) {
    assert.equal(roofPathFor(id), 'engineered_required', id + ' must be engineered');
  }
  // Unknown threats fail safe, never fabricate a covered roof.
  assert.equal(roofPathFor('___nonsense___'), 'engineered_required');
});

test('every position has a known shape and complete hole geometry', () => {
  assert.ok(Object.keys(positions).length >= 8, 'at least the 8 doctrinal positions');
  for (const [id, pos] of Object.entries(positions)) {
    assert.ok(SHAPES.has(pos.shape), id + ' has known shape');
    for (const dim of ['L', 'W', 'D'] as const) {
      assert.ok(pos.hole[dim], id + ' hole.' + dim);
      assert.equal(typeof pos.hole[dim].value, 'number');
    }
    if (pos.firingPlatform) {
      assert.equal(typeof pos.firingPlatform.depthBelowHole.value, 'number');
    }
  }
});

test('every revetment kind is valid; buildsFace consistent with kind', () => {
  for (const [id, r] of Object.entries(revetments)) {
    assert.ok(REVET_KINDS.has(r.kind), id + ' kind');
    assert.equal(r.buildsFace, r.kind !== 'none', id + ' buildsFace matches kind');
    if (r.kind === 'picket') assert.ok(r.spacing, id + ' picket needs spacing');
  }
});

test('soils and standards expose their engine-required fields', () => {
  for (const [id, s] of Object.entries(soils)) {
    for (const f of ['digFactor', 'wallSlopeRatio', 'revetForced'] as const) {
      assert.ok(s[f], id + '.' + f);
    }
  }
  for (const [id, s] of Object.entries(standards)) {
    for (const f of ['depthMul', 'coverMul', 'laborMul'] as const) {
      assert.ok(s[f], id + '.' + f);
    }
  }
});
