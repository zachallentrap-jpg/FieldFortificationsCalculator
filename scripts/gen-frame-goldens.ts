// TIMBER-2 T0 item (2) / TD12 — the compat lock's ANCHOR.
//
// Serializes today's `generateFrame` output at the PRE-refactor commit into committed
// JSON goldens. `test/timber2-compat.test.ts` (T1) diffs the refactored
// `generateStructure(specFromBuildingInput(i))` against THESE FILES forever — never
// against a live `generateFrame` call, which becomes self-referential the moment the
// legacy path is delegated to the new engine (TD12, blocker fix).
//
// Regenerating is a deliberate act: it means the engine's output legitimately changed,
// and the PR must say why (a DECISIONS.md entry). Never regenerate to make a red test
// green — that is the kill criterion (K-F1), not a maintenance step.
//
//   node --import tsx scripts/gen-frame-goldens.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateFrame, type BuildingInput } from '../src/timber/frame';

const OUT = fileURLToPath(new URL('../test/goldens/frame', import.meta.url));
mkdirSync(OUT, { recursive: true });

/** The suite's canonical building — matches `golden` in test/timber-frame.test.ts. */
const golden: BuildingInput = {
  lengthFt: 20, widthFt: 16, wallHeightFt: 8,
  studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
  risePer12: 4, overhangFt: 1, crawlFt: 1.5,
  openings: [
    { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    { wall: 'S', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
    { wall: 'N', offsetFt: 8, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
  ],
};

/** name → input. Covers the golden, the feature/option matrix, and the TD5 cases. */
const CASES: Readonly<Record<string, BuildingInput>> = {
  golden,

  // ── Option matrix (foundations, pitches, spacings, geometry edges) ──────────
  'piers-nopenings': { ...golden, foundation: 'piers', openings: [] },
  'wall-foundation': { ...golden, foundation: 'wall', openings: [] },
  'basement-stairs': { ...golden, foundation: 'basement', stairs: true, openings: [] },
  'flat-roof-rise0': { ...golden, risePer12: 0, openings: [] },
  'steep-roof-rise12': { ...golden, risePer12: 12, openings: [] },
  'spacing-24': { ...golden, studSpacingIn: 24, joistSpacingIn: 24, rafterSpacingIn: 24, openings: [] },
  'no-overhang': { ...golden, overhangFt: 0, openings: [] },

  // Off-multiple dimensions — the audit's actual killers (panels tiling a length
  // that is not a multiple of 8, a width that is not a multiple of 4).
  'offmultiple-13.5x14': { ...golden, lengthFt: 13.5, widthFt: 14, openings: [] },
  'offmultiple-13.5x8': { ...golden, lengthFt: 13.5, widthFt: 8, openings: [] },
  'large-40x24': { ...golden, lengthFt: 40, widthFt: 24, openings: [] },

  // Near-zero / degenerate inputs that produced zero-length members before the fixes.
  'slab-on-grade-crawl0': { ...golden, crawlFt: 0, openings: [] },
  'negative-crawl': { ...golden, crawlFt: -0.5, openings: [] },
  'low-sill-window': {
    ...golden,
    openings: [{ wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 0.02 }],
  },

  // ── TD5 — same-wall openings OUT OF OFFSET ORDER, and two at EQUAL offset ────
  // walls.ts emits in input-array order and per-role id counters bake that order in,
  // so `normalizeSpec` must NOT sort these on the generateFrame path. These goldens
  // are what proves it.
  'td5-unsorted-openings': {
    ...golden,
    openings: [
      { wall: 'S', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
      { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
      { wall: 'N', offsetFt: 8, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    ],
  },
  'td5-equal-offset': {
    ...golden,
    openings: [
      { wall: 'S', offsetFt: 6, widthFt: 2, heightFt: 3, sillHeightFt: 3 },
      { wall: 'S', offsetFt: 6, widthFt: 3, heightFt: 4, sillHeightFt: 2 },
    ],
  },
  'td5-all-walls': {
    ...golden,
    openings: [
      { wall: 'W', offsetFt: 5, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
      { wall: 'E', offsetFt: 5, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
      { wall: 'N', offsetFt: 12, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
      { wall: 'S', offsetFt: 2, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    ],
  },
};

const manifest: { case: string; sha256: string; members: number }[] = [];

for (const [name, input] of Object.entries(CASES)) {
  const model = generateFrame(input);
  // Stable key order; the model is plain data by contract.
  const json = JSON.stringify(model, null, 1) + '\n';
  writeFileSync(`${OUT}/${name}.json`, json);
  manifest.push({
    case: name,
    sha256: createHash('sha256').update(json).digest('hex'),
    members: model.members.length,
  });
}

manifest.sort((a, b) => (a.case < b.case ? -1 : 1));
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1) + '\n');
console.log(`frame goldens: ${manifest.length} cases, ${manifest.reduce((a, m) => a + m.members, 0)} members total`);
