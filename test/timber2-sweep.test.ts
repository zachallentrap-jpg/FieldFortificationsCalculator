// TIMBER-2 — the seeded sweep (plan §8.4).
//
// Two corpora, and the second is the one that finds things:
//   1. mulberry32 over a fixed seed — broad random coverage, printing the failing spec so a
//      red run is reproducible from the output alone (the house pattern, test/fuzz.test.ts);
//   2. the BOUNDARY corpus — the values that actually break generators: clamp edges, pitch 0
//      and 12, zero overhang, openings at offset 0 and flush right, fractional dimensions,
//      near-degenerate widths. Random sampling almost never lands on exactly 60.0 ft.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { bomSummary } from '../src/timber/bom';
import { thumbnailFor } from '../src/timber/thumbnails';
import { specToJson } from '../src/timber/normalize';
import type { BuildingSpec, FoundationSpec, RoofSpec, WallOpenings } from '../src/timber/spec';
import type { WallId } from '../src/timber/types';
import type { Member } from '../src/timber/types';
import { FAMILY_TABLE } from '../src/timber/catalog';

/** mulberry32 — small, fast, and deterministic across runs and platforms. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

function randomSpec(rng: () => number): BuildingSpec {
  const lengthFt = Math.round((4 + rng() * 56) * 4) / 4;
  const widthFt = Math.round((4 + rng() * 20) * 4) / 4;
  const roof: RoofSpec = pick(rng, [
    { kind: 'gable', risePer12: Math.floor(rng() * 13), overhangFt: Math.round(rng() * 6) / 2 },
    { kind: 'shed', risePer12: Math.floor(rng() * 13), overhangFt: Math.round(rng() * 4) / 2, highSide: pick(rng, ['N', 'S', 'E', 'W'] as WallId[]) },
    { kind: 'flat', overhangFt: Math.round(rng() * 4) / 2, drainPer12: Math.round(rng() * 3) / 2 },
    { kind: 'none' },
  ] as RoofSpec[]);
  const foundation: FoundationSpec = pick(rng, [
    { kind: 'piers', crawlFt: Math.round(rng() * 8) / 2 },
    { kind: 'wall', crawlFt: Math.round(rng() * 8) / 2 },
    { kind: 'basement', depthFt: 6 + Math.round(rng() * 6) / 2, stairs: rng() > 0.5 },
    { kind: 'slab' },
    { kind: 'skids' },
  ] as FoundationSpec[]);
  const openings: WallOpenings = {};
  for (const wall of ['S', 'N', 'E', 'W'] as WallId[]) {
    const n = Math.floor(rng() * 3);
    if (n === 0) continue;
    const run = wall === 'S' || wall === 'N' ? lengthFt : widthFt;
    openings[wall] = Array.from({ length: n }, () => {
      const w = Math.round((0.5 + rng() * 5) * 4) / 4;
      return {
        kind: rng() > 0.5 ? ('window' as const) : ('door' as const),
        offsetFt: Math.round(rng() * Math.max(0, run - w) * 4) / 4,
        widthFt: w,
        heightFt: Math.round((1 + rng() * 6) * 4) / 4,
        sillHeightFt: rng() > 0.4 ? Math.round(rng() * 5 * 4) / 4 : 0,
      };
    });
  }
  return {
    family: 'building',
    dims: { lengthFt, widthFt },
    spacing: {
      studSpacingIn: pick(rng, [12, 16, 24] as const),
      joistSpacingIn: pick(rng, [12, 16, 24] as const),
      rafterSpacingIn: pick(rng, [12, 16, 24] as const),
    },
    coverings: {
      wallSheathing: pick(rng, ['none', 'plywood'] as const),
      siding: pick(rng, ['none', 'plywood', 'boards', 'boardAndBatten'] as const),
      roofDeck: pick(rng, ['none', 'plywood', 'purlins'] as const),
      roofing: pick(rng, ['none', 'roll', 'rollDouble', 'corrugated'] as const),
    },
    stories: [{ wallHeightFt: 6 + Math.round(rng() * 12) / 2, openings, letInBracing: rng() > 0.5 }],
    roof,
    foundation,
    bridging: pick(rng, ['cross', 'solid'] as const),
    atticAccess: rng() > 0.7,
  };
}

/** The values that actually break generators (plan §8.4 boundary corpus). */
function boundarySpecs(): BuildingSpec[] {
  const base = randomSpec(mulberry32(1));
  const clean = (over: Partial<BuildingSpec>): BuildingSpec => ({
    ...base,
    coverings: { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'roll' },
    stories: [{ wallHeightFt: 8, openings: {} }],
    roof: { kind: 'gable', risePer12: 4, overhangFt: 1 },
    foundation: { kind: 'piers', crawlFt: 1.5 },
    spacing: { studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16 },
    dims: { lengthFt: 20, widthFt: 16 },
    ...over,
  });
  return [
    clean({ dims: { lengthFt: 4, widthFt: 4 }, foundation: { kind: 'skids' } }), // envelope minimum
    clean({ dims: { lengthFt: 60, widthFt: 24 } }), // envelope maximum
    clean({ dims: { lengthFt: 13.7, widthFt: 10.33 } }), // fractional
    clean({ roof: { kind: 'gable', risePer12: 0, overhangFt: 0 } }), // dead flat gable, no eave
    clean({ roof: { kind: 'gable', risePer12: 12, overhangFt: 3 } }), // steepest, deepest eave
    clean({ roof: { kind: 'shed', risePer12: 0, overhangFt: 0, highSide: 'W' } }),
    clean({ roof: { kind: 'flat', overhangFt: 0, drainPer12: 1 } }),
    clean({ roof: { kind: 'none' } }),
    // Openings at the edges of their wall, and stacked adjacent.
    clean({ stories: [{ wallHeightFt: 8, openings: { S: [{ kind: 'door', offsetFt: 0, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 }] } }] }),
    clean({ stories: [{ wallHeightFt: 8, openings: { S: [{ kind: 'window', offsetFt: 17, widthFt: 3, heightFt: 3, sillHeightFt: 3 }] } }] }),
    clean({ stories: [{ wallHeightFt: 8, openings: { N: [
      { kind: 'window', offsetFt: 4, widthFt: 2, heightFt: 3, sillHeightFt: 0.01 }, // sill just off the plate
      { kind: 'window', offsetFt: 6.5, widthFt: 2, heightFt: 3, sillHeightFt: 3 },
    ] } }] }),
    clean({ stories: [{ wallHeightFt: 8, openings: { E: [{ kind: 'vent', offsetFt: 2, widthFt: 0.5, heightFt: 0.5, sillHeightFt: 6 }] } }] }), // near-zero
    clean({ foundation: { kind: 'basement', depthFt: 6, stairs: true }, dims: { lengthFt: 12, widthFt: 8 } }), // stair may not fit
    clean({ spacing: { studSpacingIn: 24, joistSpacingIn: 24, rafterSpacingIn: 24 } }),
    clean({ spacing: { studSpacingIn: 12, joistSpacingIn: 12, rafterSpacingIn: 12 } }),
  ];
}

function assertModelSound(spec: BuildingSpec, label: string): void {
  const model = generateStructure(spec);
  const ids = new Set<string>();
  for (const m of model.members) {
    for (const v of [...m.position, ...m.rotation, m.cutLength]) {
      assert.ok(Number.isFinite(v), `${label}: ${m.id} non-finite\n  spec: ${specToJson(spec)}`);
    }
    assert.ok(m.cutLength > 0, `${label}: ${m.id} cutLength ${m.cutLength}\n  spec: ${specToJson(spec)}`);
    assert.ok(m.stage >= 1 && m.stage <= model.stagePlan.length, `${label}: ${m.id} stage ${m.stage}`);
    assert.ok(!ids.has(m.id), `${label}: duplicate id ${m.id}\n  spec: ${specToJson(spec)}`);
    ids.add(m.id);
    assert.ok(m.doctrineRef.length > 0 && m.nailing.length > 0, `${label}: ${m.id} missing provenance`);
  }
  // The BOM partitions the model exactly — every member is billed once.
  const bom = bomSummary(model.members, model.stagePlan);
  assert.equal(bom.totalMembers, model.members.length, `${label}: BOM partition\n  spec: ${specToJson(spec)}`);
  // Determinism.
  assert.deepEqual(generateStructure(spec).members, model.members, `${label}: not deterministic`);
}

test('boundary corpus: the values that actually break generators', () => {
  boundarySpecs().forEach((spec, i) => assertModelSound(spec, `boundary[${i}]`));
});

test('seeded sweep: 200 random buildings stay sound', () => {
  const rng = mulberry32(1234567);
  for (let i = 0; i < 200; i++) assertModelSound(randomSpec(rng), `sweep[${i}]`);
});

test('AABB stays inside the footprint plus its spec-derived allowances (C-7)', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 40; i++) {
    const spec = randomSpec(rng);
    const model = generateStructure(spec);
    const s = model.spec as BuildingSpec;
    const oh = s.roof.kind === 'none' ? 0 : s.roof.overhangFt;
    // Allowances: the eave overhang, the cap-plate corner lap, and a skid's own width.
    const slack = oh + 1.5;
    for (const m of model.members) {
      const half = m.cutLength / 12 / 2;
      assert.ok(
        m.position[0] > -slack - half && m.position[0] < s.dims.lengthFt + slack + half,
        `sweep[${i}]: ${m.id} x=${m.position[0]} outside footprint+${slack}\n  spec: ${specToJson(spec)}`,
      );
      assert.ok(
        m.position[2] > -slack - half && m.position[2] < s.dims.widthFt + slack + half,
        `sweep[${i}]: ${m.id} z=${m.position[2]} outside footprint+${slack}`,
      );
    }
  }
});

test('thumbnails stay deterministic across the sweep corpus', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 15; i++) {
    const spec = randomSpec(rng);
    assert.equal(thumbnailFor(spec), thumbnailFor(spec), `sweep[${i}]: thumbnail not deterministic`);
  }
});

test('the whole sweep runs inside its wall-clock budget', () => {
  const t0 = performance.now();
  const rng = mulberry32(4242);
  for (let i = 0; i < 60; i++) generateStructure(randomSpec(rng));
  const ms = performance.now() - t0;
  assert.ok(ms < 10_000, `60 models took ${ms.toFixed(0)} ms`);
});

test('no member is emitted twice in the same place — one post per hole', () => {
  // FOUND BY SWEEP, NOT BY EYE. Coincident duplicates are invisible in a render: two identical
  // meshes at the same coordinates look exactly like one. They are not invisible on the CUT
  // LIST, which is what a crew orders and builds from — 96.5 board feet of stock that does not
  // exist, 65.5 of it 6x6 timber on the crib bunker.
  //
  // The cause was the same in all three families: a perimeter run places its posts inclusive of
  // both ends, which is right for one edge and wrong for a closed loop, so every corner got one
  // post from the side arriving and another from the side leaving.
  //
  // Two members of the same stock, the same length, at the same place and the same angle are one
  // member counted twice. No tolerance, no bounding boxes — this test cannot report a false
  // positive, which is why it can be this blunt.
  const signature = (m: Member): string =>
    [m.role, m.nominal, m.cutLength.toFixed(6),
     ...m.position.map((v) => v.toFixed(6)), ...m.rotation.map((v) => v.toFixed(6))].join('|');

  const offenders: string[] = [];
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(fam.preset);
    const seen = new Map<string, Member[]>();
    for (const m of model.members) {
      const k = signature(m);
      seen.set(k, [...(seen.get(k) ?? []), m]);
    }
    for (const group of seen.values()) {
      if (group.length < 2) continue;
      const m = group[0]!;
      offenders.push(
        `${fam.id}: ${group.length}x ${m.role} ${m.nominal} at (${m.position.map((v) => v.toFixed(2)).join(', ')}) — ${group.map((g) => g.id).join(', ')}`,
      );
    }
  }
  assert.deepEqual(offenders, [], `members emitted more than once in the same place:\n  ${offenders.join('\n  ')}`);
});
