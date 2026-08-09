// G-6/G-7 — fuzz + NaN matrix (blueprint §4.6): every prism position × threat class
// representative × soil × standard × revetment × {empty, partial, complete} fill:
// compute never throws (trace construction throws on ANY non-finite, so surviving IS
// the NaN gate), Unfilled never leaks into SVG text as 'NaN'/'undefined'/'Infinity',
// engineered threats never produce a thickness, and non-prism positions fail with
// the typed R0-scope error, never garbage. Plus the per-leaf sensitivity probe on a
// sample (functional-orphan defense, §4.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, type ComputeInputs } from '../../src/engine/compute';
import { drawPlan } from '../../src/render/drawPlan';
import { drawSection } from '../../src/render/drawSection';
import { LIGHT } from '../../src/render/theme';
import { watermarkState } from '../../src/schema/watermark';
import { loadFill } from '../../src/schema/io';
import { exportFill, type FillValue } from '../../src/schema/fill';
import { generateFill, SCHEMA_HASH } from '../fixtures/testFill';
import { POSITION_STRUCTURE } from '../../src/schema/leaves/index';
import { REVETMENT_IDS, SOIL_IDS, STANDARD_IDS, type ThreatId } from '../../src/schema/ids';

const THREATS: readonly ThreatId[] = ['sa-556', 'ind-mtr-81', 'ind-art-155', 'at-rpg', 'blast-vbied'];

const loadVariant = (opts: Parameters<typeof generateFill>[0]): FillValue => {
  const res = loadFill(exportFill(generateFill(opts)), { expectedSchemaHash: SCHEMA_HASH, allowTestClass: true });
  assert.ok(res.ok, JSON.stringify(!res.ok && res.reasons));
  return res.fill;
};

test('G-6: input matrix × fill states — no throw, no NaN leak, fail-safe holds', () => {
  const complete = loadVariant({});
  const partial = loadVariant({ only: (_id) => _id.length % 3 !== 0 }); // deterministic ragged subset
  const fills: (FillValue | null)[] = [null, partial, complete];
  const prisms = POSITION_STRUCTURE.filter((p) => p.volumeModel === 'prism');
  const others = POSITION_STRUCTURE.filter((p) => p.volumeModel !== 'prism');
  let cases = 0;

  for (const pos of prisms) {
    for (const threat of THREATS) {
      for (const soil of SOIL_IDS) {
        for (const standard of STANDARD_IDS) {
          for (const revetment of [REVETMENT_IDS[0], REVETMENT_IDS[1], REVETMENT_IDS[2]] as const) {
            for (const fill of fills) {
              const inputs: ComputeInputs = {
                position: pos.id, threat, soil, standard, revetment,
                coverMaterial: 'soil', machineAssist: cases % 2 === 0,
              };
              const r = compute(inputs, fill);
              cases += 1;
              if (r.cover.kind === 'earthCover') {
                assert.notEqual(threat, 'at-rpg');
                assert.notEqual(threat, 'blast-vbied');
              }
              const ctx = {
                theme: LIGHT,
                watermark: watermarkState({
                  fill, appSchemaHash: SCHEMA_HASH, missingLeafIds: [],
                  artifactConeLeafIds: [...r.coneLeafIds], positionId: pos.id,
                  commissioning: null, revokedFillHashes: new Set(),
                }),
              };
              for (const svg of [drawSection(r, ctx), drawPlan(r, ctx)]) {
                assert.doesNotMatch(svg, /NaN|Infinity|undefined/, `${pos.id}/${threat}/${soil}: leak into SVG`);
              }
            }
          }
        }
      }
    }
  }
  assert.ok(cases >= 1000, `matrix too small: ${cases}`);
  console.log(`# G-6 matrix: ${cases} cases`);

  for (const pos of others) {
    assert.throws(
      () => compute({ position: pos.id, threat: 'sa-556', soil: 'loam', standard: 'deliberate', revetment: 'none', coverMaterial: 'soil', machineAssist: false }, complete),
      /not yet built \(R0 scope: prism\)/,
      `${pos.id} must fail with the typed R0-scope error`,
    );
  }
});

test('G-6 sensitivity probe: perturbing a consumed numeric leaf changes some output (sample)', () => {
  const SAMPLE = ['pos.one_man.hole.D', 'soil.loam.digRateHand', 'excavation.swellFactor', 'sandbag.wasteFactor', 'labor.base.one_man'];
  const INPUTS: ComputeInputs = {
    position: 'one_man', threat: 'ind-mtr-81', soil: 'loam', standard: 'deliberate',
    revetment: 'sandbag_facing', coverMaterial: 'soil', machineAssist: false,
  };
  const baseFill = loadVariant({});
  const baseline = JSON.stringify(probe(compute(INPUTS, baseFill)));
  for (const leafId of SAMPLE) {
    const bumped = loadVariant({ override: { [leafId]: (baseFill.numeric(leafId) ?? 1) * 2 } });
    const out = JSON.stringify(probe(compute(INPUTS, bumped)));
    assert.notEqual(out, baseline, `perturbing ${leafId} changed nothing — functional orphan?`);
  }
});

const probe = (r: ReturnType<typeof compute>): unknown => ({
  svg: drawSection(r, {
    theme: LIGHT,
    watermark: watermarkState({
      fill: null, appSchemaHash: SCHEMA_HASH, missingLeafIds: [], artifactConeLeafIds: [],
      positionId: 'one_man', commissioning: null, revokedFillHashes: new Set(),
    }),
  }),
  bom: r.work.bom.map((b) => [b.id, JSON.stringify(b.quantity)]),
  stages: r.work.byStage.map((s) => JSON.stringify(s.manHours)),
});
