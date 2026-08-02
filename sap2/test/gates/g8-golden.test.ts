// G-8 — sentinel byte-goldens (blueprint §4.4: right-sized — ONE scenario's
// template renders as exact bytes; everything else asserts structure). A diff here
// means render bytes changed: intended → regenerate via
// `node --import tsx scripts/gen-goldens.ts`, review the visual diff, commit both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compute } from '../../src/engine/compute';
import { drawPlan } from '../../src/render/drawPlan';
import { drawSection } from '../../src/render/drawSection';
import { LIGHT } from '../../src/render/theme';
import { watermarkState } from '../../src/schema/watermark';
import { SCHEMA_HASH } from '../fixtures/testFill';
import { SENTINEL_INPUTS } from '../fixtures/sentinel';

const golden = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../goldens/${name}`, import.meta.url)), 'utf8');

const ctx = {
  theme: LIGHT,
  watermark: watermarkState({
    fill: null, appSchemaHash: SCHEMA_HASH, missingLeafIds: [], artifactConeLeafIds: [],
    positionId: 'one_man', commissioning: null, revokedFillHashes: new Set(),
  }),
} as const;

test('G-8: sentinel TEMPLATE renders match golden bytes exactly', () => {
  const r = compute(SENTINEL_INPUTS, null);
  assert.equal(drawSection(r, ctx), golden('section-template.svg'));
  assert.equal(drawPlan(r, ctx), golden('plan-template.svg'));
});
