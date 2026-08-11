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
      assert.equal(typeof pos.firingPlatform.riseAboveFloor.value, 'number');
    }
  }
});

test('every firing platform fits inside the hole it stands in, at the shallowest standard', () => {
  // The table used to describe a geometrically impossible position: fifty_cal's platform was
  // 3.0 ft wide inside its own 2.0 ft trench. The DRAWINGS clamped it and the BOM did not, so
  // the picture was right and the spoil figure was wrong — a clamp is a fail-safe, never the
  // thing that makes a table true. These are the invariants that make the impossible state
  // unrepresentable in source, checked against the live table so a source edit trips them.
  const shallowest = Math.min(...Object.values(standards).map((st) => st.depthMul.value));
  for (const [id, pos] of Object.entries(positions)) {
    const plat = pos.firingPlatform;
    if (!plat) continue;
    assert.ok(plat.L.value <= pos.hole.L.value, id + ': platform.L ' + plat.L.value + ' exceeds hole.L ' + pos.hole.L.value);
    assert.ok(plat.W.value <= pos.hole.W.value, id + ': platform.W ' + plat.W.value + ' exceeds hole.W ' + pos.hole.W.value);
    // Evaluated at the SHALLOWEST cut the app can produce, not at deliberate: a bench taller
    // than the floor is deep is an inverted position, and hasty is where that bites first.
    assert.ok(
      plat.riseAboveFloor.value <= pos.hole.D.value * shallowest,
      id + ': platform rise ' + plat.riseAboveFloor.value + ' exceeds the hasty cut ' + (pos.hole.D.value * shallowest),
    );
    // A bench covering the entire floor is not a bench — the crew bays have to exist.
    assert.ok(
      plat.L.value * plat.W.value < pos.hole.L.value * pos.hole.W.value,
      id + ': the platform covers the whole bay floor, leaving no crew bay beside it',
    );
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
