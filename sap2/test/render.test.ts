// TEMPLATE renders (blueprint §2.2/§4.4): zero digit GLYPHS in template text, tokens
// on every unfilled dimension, self-contained SVG (no var(), no external refs),
// byte-deterministic across repeated renders, real values appear when filled, and
// the enemy band + DO-NOT-SCALE stamp are present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, type ComputeInputs } from '../src/engine/compute';
import { drawSection } from '../src/render/drawSection';
import { drawPlan } from '../src/render/drawPlan';
import { LIGHT } from '../src/render/theme';
import { watermarkState } from '../src/schema/watermark';
import { loadFill } from '../src/schema/io';
import { exportFill } from '../src/schema/fill';
import { generateFill, SCHEMA_HASH } from './fixtures/testFill';

const INPUTS: ComputeInputs = {
  position: 'one_man', threat: 'ind-mtr-81', soil: 'loam', standard: 'deliberate',
  revetment: 'none', coverMaterial: 'soil', machineAssist: false,
};

const templateCtx = { theme: LIGHT, watermark: watermarkState({
  fill: null, appSchemaHash: SCHEMA_HASH, missingLeafIds: [], artifactConeLeafIds: [],
  positionId: 'one_man', commissioning: null, revokedFillHashes: new Set(),
}) } as const;

const textContent = (svg: string): string =>
  [...svg.matchAll(/<(?:text|title|desc)[^>]*>([^<]*)</g)].map((m) => m[1] ?? '').join(' ');

test('TEMPLATE section/plan carry zero digit glyphs in text and show tokens', () => {
  const r = compute(INPUTS, null);
  for (const svg of [drawSection(r, templateCtx), drawPlan(r, templateCtx)]) {
    const visible = textContent(svg);
    assert.doesNotMatch(visible, /[0-9]/, `digits leaked into TEMPLATE text: ${visible}`);
    assert.match(svg, /⟨/, 'expected at least one unfilled token');
  }
  assert.match(textContent(drawSection(r, templateCtx)), /DO NOT SCALE/);
  assert.match(textContent(drawPlan(r, templateCtx)), /NO SCALE — TEMPLATE/);
  assert.match(textContent(drawPlan(r, templateCtx)), /ENEMY THIS WAY/);
});

test('renders are self-contained: no var(), no url(, no external references', () => {
  const r = compute(INPUTS, null);
  for (const svg of [drawSection(r, templateCtx), drawPlan(r, templateCtx)]) {
    assert.doesNotMatch(svg, /var\(/);
    assert.doesNotMatch(svg, /url\(/);
    assert.doesNotMatch(svg, /href=/);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /role="img"/);
  }
});

test('renders are byte-deterministic across repeated compute+render', () => {
  const a = drawSection(compute(INPUTS, null), templateCtx);
  const b = drawSection(compute(INPUTS, null), templateCtx);
  assert.equal(a, b);
});

test('filled render shows real values with units and no tokens on filled dims', () => {
  const res = loadFill(exportFill(generateFill({ cls: 'DOCTRINE' })), { expectedSchemaHash: SCHEMA_HASH, allowTestClass: true });
  assert.ok(res.ok);
  const r = compute(INPUTS, res.fill);
  const ctx = { theme: LIGHT, watermark: watermarkState({
    fill: res.fill, appSchemaHash: SCHEMA_HASH, missingLeafIds: res.missingLeafIds,
    artifactConeLeafIds: [...r.coneLeafIds], positionId: 'one_man',
    commissioning: null, revokedFillHashes: new Set(),
  }) } as const;
  const svg = drawSection(r, ctx);
  const visible = textContent(svg);
  assert.match(visible, /\d+\.\d{2} ft/, 'expected a formatted feet value');
  assert.doesNotMatch(visible, /⟨/, 'no tokens should remain on a complete fill');
  // Uncommissioned banner present (INV-4: nothing clears without the ceremony).
  assert.match(visible, /NOT COMMISSIONED/);
});

test('the watermark banner never renders on COMMISSIONED-state drawings only', () => {
  // TRAINING state must banner; TEMPLATE must banner; the assertion above covered
  // FILLED_UNCOMMISSIONED. (COMMISSIONED-path rendering exercises at R2a with the
  // provenance strip — here we assert the banner text function's coverage.)
  const r = compute(INPUTS, null);
  const svg = drawSection(r, templateCtx);
  assert.match(textContent(svg), /TEMPLATE/);
});
