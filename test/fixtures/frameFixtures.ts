// TIMBER-2 T0 — the compat corpus (plan §8.2, TD12). ONE definition of the golden inputs,
// shared by `scripts/gen-frame-goldens.ts` (which snapshots them) and
// `test/timber2-compat.test.ts` (which diffs against the committed snapshot forever).
//
// Two tiers, both frozen at the pre-refactor commit:
//   FULL_FIXTURES   — curated, one per distinct code path; committed as complete JSON so a
//                     regression shows up as a reviewable per-member diff (TD13's comparator
//                     prints per-field diffs against these).
//   MATRIX_FIXTURES — the whole timber-features option matrix (foundation × bridging × bracing
//                     × attic × size = 72); committed as canonical-hash rows only, so full
//                     matrix coverage costs kilobytes instead of ten megabytes.
//
// Not a *.test.ts file, so the runner never executes it (npm test globs test/*.test.ts).

import type { BuildingInput } from '../../src/timber/frame';

export interface Fixture {
  name: string;
  note: string;
  input: BuildingInput;
}

const BASE: BuildingInput = {
  lengthFt: 20,
  widthFt: 16,
  wallHeightFt: 8,
  studSpacingIn: 16,
  joistSpacingIn: 16,
  rafterSpacingIn: 16,
  risePer12: 4,
  overhangFt: 1,
  crawlFt: 1.5,
  openings: [],
};

// The TIMBER-1 demo building exactly as woodframe-scene.ts ships it.
const DEMO_OPENINGS: BuildingInput['openings'] = [
  { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
  { wall: 'S', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
  { wall: 'N', offsetFt: 8.5, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
];

export const FULL_FIXTURES: readonly Fixture[] = [
  {
    name: 'demo',
    note: 'The TIMBER-1 demo building — the spec woodframe-scene.ts boots with.',
    input: { ...BASE, openings: DEMO_OPENINGS },
  },
  {
    name: 'demo-basement',
    note: 'Basement foundation: slab, columns, framed stairwell, stair.',
    input: { ...BASE, openings: DEMO_OPENINGS, foundation: 'basement' },
  },
  {
    name: 'demo-wall-foundation',
    note: 'Continuous wall foundation: stem walls, strip footings, sills all four sides.',
    input: { ...BASE, openings: DEMO_OPENINGS, foundation: 'wall' },
  },
  {
    name: 'demo-solid-bridging',
    note: 'Solid full-depth blocking instead of the cross-bridging default.',
    input: { ...BASE, openings: DEMO_OPENINGS, bridging: 'solid' },
  },
  {
    name: 'demo-braced-attic',
    note: 'Let-in corner bracing (stage 6) + the framed attic scuttle (stage 7).',
    input: { ...BASE, openings: DEMO_OPENINGS, letInBracing: true, atticAccess: true },
  },
  {
    name: 'small-12x8',
    note: 'Small plan: half-span under the bridging threshold, short wall runs.',
    input: { ...BASE, lengthFt: 12, widthFt: 8 },
  },
  {
    name: 'large-40x24',
    note: 'Large plan: multiple post bays, many subfloor courses and rafter pairs.',
    input: { ...BASE, lengthFt: 40, widthFt: 24 },
  },
  {
    name: 'openings-unsorted',
    note: 'TD5: same-wall openings supplied OUT of offset order — emission order must follow '
      + 'the input array, never a normalized sort (per-role id counters bake the order in).',
    input: {
      ...BASE,
      openings: [
        { wall: 'S', offsetFt: 14, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
        { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
        { wall: 'S', offsetFt: 9, widthFt: 2.5, heightFt: 3.5, sillHeightFt: 3 },
      ],
    },
  },
  {
    name: 'openings-equal-offset',
    note: 'TD5: two openings at the SAME offset on one wall — a total sort with no tie-break '
      + 'would be unstable here; the compat path must not sort at all.',
    input: {
      ...BASE,
      openings: [
        { wall: 'N', offsetFt: 6, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
        { wall: 'N', offsetFt: 6, widthFt: 2, heightFt: 3, sillHeightFt: 3.5 },
      ],
    },
  },
  {
    name: 'spacing-24',
    note: '24 in OC studs/joists/rafters — the other legal spacing on every grid.',
    input: {
      ...BASE,
      openings: DEMO_OPENINGS,
      studSpacingIn: 24,
      joistSpacingIn: 24,
      rafterSpacingIn: 24,
    },
  },
  {
    name: 'steep-12-12',
    note: '12:12 pitch — the top of the pitch envelope; gable studs and course tiling stress.',
    input: { ...BASE, openings: DEMO_OPENINGS, risePer12: 12 },
  },
  {
    name: 'shallow-2-12-no-overhang',
    note: '2:12 pitch with zero overhang — the eave collapses onto the plate line.',
    input: { ...BASE, openings: DEMO_OPENINGS, risePer12: 2, overhangFt: 0 },
  },
];

// The full timber-features matrix (test/timber-features.test.ts's option sweep), hashed.
export const MATRIX_FIXTURES: readonly Fixture[] = (() => {
  const out: Fixture[] = [];
  for (const foundation of ['piers', 'wall', 'basement'] as const) {
    for (const bridging of ['cross', 'solid'] as const) {
      for (const letInBracing of [false, true]) {
        for (const atticAccess of [false, true]) {
          for (const [lengthFt, widthFt] of [[20, 16], [12, 8], [40, 24]] as const) {
            out.push({
              name: `matrix-${foundation}-${bridging}-b${letInBracing ? 1 : 0}-a${atticAccess ? 1 : 0}-${lengthFt}x${widthFt}`,
              note: 'timber-features option matrix row',
              input: { ...BASE, lengthFt, widthFt, foundation, bridging, letInBracing, atticAccess },
            });
          }
        }
      }
    }
  }
  return out;
})();
