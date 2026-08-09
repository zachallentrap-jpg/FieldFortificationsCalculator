// Regenerates the G-8 sentinel byte-goldens and the G-9 definition digest.
// Run after an INTENDED render/schema change; review diffs before committing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compute } from '../src/engine/compute';
import { drawPlan } from '../src/render/drawPlan';
import { drawSection } from '../src/render/drawSection';
import { LIGHT } from '../src/render/theme';
import { watermarkState } from '../src/schema/watermark';
import { LEAVES } from '../src/schema/leaves/index';
import { sha256Hex } from '../src/schema/sha256';
import { SCHEMA_HASH } from '../test/fixtures/testFill';
import { SENTINEL_INPUTS } from '../test/fixtures/sentinel';

const OUT = fileURLToPath(new URL('../goldens', import.meta.url));
mkdirSync(OUT, { recursive: true });

const ctx = {
  theme: LIGHT,
  watermark: watermarkState({
    fill: null, appSchemaHash: SCHEMA_HASH, missingLeafIds: [], artifactConeLeafIds: [],
    positionId: 'one_man', commissioning: null, revokedFillHashes: new Set(),
  }),
} as const;

const r = compute(SENTINEL_INPUTS, null);
writeFileSync(`${OUT}/section-template.svg`, drawSection(r, ctx));
writeFileSync(`${OUT}/plan-template.svg`, drawPlan(r, ctx));

// Definition digest: leafId → { meaningVersion, defHash }. The G-9 gate requires a
// meaningVersion bump whenever definition text changes (B8).
const digest = Object.fromEntries(
  [...LEAVES].sort((a, b) => (a.id < b.id ? -1 : 1)).map((l) => [
    l.id, { meaningVersion: l.meaningVersion, defHash: sha256Hex(l.definition).slice(0, 16) },
  ]),
);
writeFileSync(`${OUT}/leaf-definitions.json`, JSON.stringify(digest, null, 1) + '\n');
console.log(`goldens regenerated: 2 SVGs + definition digest (${LEAVES.length} leaves)`);
