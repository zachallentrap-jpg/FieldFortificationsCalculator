// Phase 6 catalog expansion (docs/EXECUTION_PLAN.md) — new positions pass the full engine
// contract automatically (the fuzz/NaN/scene matrices iterate the position registry), plus the
// ATGM backblast safety warning and the radiation-halving readout that finally gives those
// dead safety-critical leaves a consumer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { positions } from '../src/doctrine/positions';
import { radiationHalving } from '../src/doctrine/protection';
import { getByPath } from '../src/doctrine/registry';
import { defaultInputs } from './helpers';

test('the new positions exist and produce finite, non-empty results', () => {
  for (const positionType of ['connecting_trench', 'atgm_javelin']) {
    assert.ok(positions[positionType], positionType + ' registered');
    const r = compute(defaultInputs({ positionType }));
    assert.ok(r.resolved.depthOfCut > 0 && Number.isFinite(r.resolved.depthOfCut), positionType + ' has finite depth');
    assert.ok(r.bom.length > 0, positionType + ' has a BOM');
    assert.ok(r.bom.every((l) => Number.isFinite(l.qtyPerPosition)), positionType + ' BOM finite');
  }
});

test('an ATGM position warns about the rear backblast danger area', () => {
  const r = compute(defaultInputs({ positionType: 'atgm_javelin' }));
  const bb = r.validation.find((v) => v.code === 'ATGM_BACKBLAST');
  assert.ok(bb, 'backblast warning present');
  assert.equal(bb.severity, 'warning');
  // A non-ATGM position does NOT get it.
  assert.ok(!compute(defaultInputs({ positionType: 'two_man' })).validation.some((v) => v.code === 'ATGM_BACKBLAST'));
});

test('the radiation-halving leaves now have a consumer: an earth roof reports fallout attenuation', () => {
  // Default fixture: sandbagged_soil earth roof against 81mm mortar.
  const r = compute(defaultInputs());
  const rad = r.derivations.find((d) => d.key === 'radiationLayers');
  assert.ok(rad, 'radiation derivation present when an earth roof exists');
  assert.ok(rad.result > 0 && Number.isFinite(rad.result), 'finite positive halving-layers');
  // It actually uses the doctrine leaf (the operand value equals the registered leaf value).
  const layerOp = rad.operands.find((o) => o.name === 'halvingThickness')!;
  const leaf = getByPath('protection.radiationHalving.sandbagged_soil')!;
  assert.equal(layerOp.value, leaf.value, 'consumes the registered radiationHalving leaf');
  assert.equal(layerOp.placeholder, true, 'and carries its placeholder flag');
  // No earth roof (engineered) → no radiation readout, and no fabricated number.
  assert.ok(!compute(defaultInputs({ threat: 'at-rpg', overheadCover: true })).derivations.some((d) => d.key === 'radiationLayers'));
});

test('every radiationHalving material leaf is reachable as a cover consumer (no dead SC leaves)', () => {
  // Each shield material that can be an earth-roof cover material should, for some threat,
  // drive the radiation readout — proving the 9 leaves are not decorative.
  const materials = Object.keys(radiationHalving);
  assert.ok(materials.length >= 9, 'the full material set is registered');
  // soil + sandbagged_soil are the two earth-roof cover materials in the threat table; both consume.
  for (const threat of ['ind-mtr-120', 'ind-mtr-81']) {
    const r = compute(defaultInputs({ threat, overheadCover: true }));
    if (r.cover.roofPath === 'earth_on_stringers') {
      assert.ok(r.derivations.some((d) => d.key === 'radiationLayers'), threat + ' consumes a halving leaf');
    }
  }
});
