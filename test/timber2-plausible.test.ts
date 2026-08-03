// TIMBER-2 — THE PLAUSIBILITY SWEEP.
//
// Every other test in this suite asks whether the engine produced the RIGHT answer. This one
// asks a stupider question that turns out to catch more: is what came out a physical object?
//
// It exists because a run of defects reached the owner's screen that no test could have caught,
// and none of them were subtle once you looked: a plywood sheet standing on edge under a guard
// tower cab, a stair whose treads were 9 1/4-in fins, a ramp climbing away from the platform it
// served, a bench lid floating four inches above its own dividers, a "baffle wall" that was one
// post standing alone in the dirt. Every one of them was a correct-looking line of code. What
// they had in common was not a rule they broke — it was that nobody had ever asked the output
// whether it made sense as a thing you could build.
//
// So the rules here are the ones a person applies by eye in half a second:
//
//   NOTHING IS ZERO-SIZED         a member with no length is not a member.
//   NOTHING IS ABSURDLY BIG       four hundred cubic feet of lumber in one piece is a bug.
//   NOTHING IS BURIED             below the ground datum, only what belongs below it.
//   NOTHING FLOATS FREE           a piece that touches no other piece anywhere is not attached
//                                 to the building, whatever the code that placed it believed.
//   DECKS LIE FLAT                (test/timber2-lieflat.test.ts — the same family of defect,
//                                 kept separate because it needs a rotation, not a bounding box)
//
// And they run over the OPTION MATRIX, not just the presets, because every one of those defects
// lived in a branch: the ramp only planked wrong with a panel deck, the posts only vanished with
// skids, the header only hung in mid-air with crib walls.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import type { Member } from '../src/timber/types';
import type { StructureSpec } from '../src/timber/spec';

type V3 = [number, number, number];

function rotate(m: Member, v: V3): V3 {
  const [rx, ry, rz] = m.rotation;
  let [x, y, z] = v;
  let a = x * Math.cos(rz) - y * Math.sin(rz);
  let b = x * Math.sin(rz) + y * Math.cos(rz);
  x = a; y = b;
  a = y * Math.cos(rx) - z * Math.sin(rx);
  b = y * Math.sin(rx) + z * Math.cos(rx);
  y = a; z = b;
  a = x * Math.cos(ry) + z * Math.sin(ry);
  b = -x * Math.sin(ry) + z * Math.cos(ry);
  x = a; z = b;
  return [x, y, z];
}

interface Box { m: Member; lo: V3; hi: V3 }

function boxOf(m: Member): Box {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    for (let i = 0; i < 3; i++) {
      const v = m.position[i]! + r[i]!;
      lo[i] = Math.min(lo[i]!, v);
      hi[i] = Math.max(hi[i]!, v);
    }
  }
  return { m, lo, hi };
}

/** Do two members come within `t` feet of each other on every axis? */
const touches = (a: Box, b: Box, t: number): boolean => {
  for (let i = 0; i < 3; i++) {
    if (a.lo[i]! > b.hi[i]! + t || b.lo[i]! > a.hi[i]! + t) return false;
  }
  return true;
};

const cubicFeet = (m: Member): number => (m.cutLength / 12) * (m.actual.d / 12) * (m.actual.w / 12);

/**
 * Roles that may legitimately sit at or well below the ground datum: what a foundation IS, plus
 * the pieces of a floor frame, which in the building families are hung below a datum of y = 0 at
 * the subfloor rather than at grade.
 */
const MAY_BE_UNDERGROUND: ReadonlySet<string> = new Set([
  'footing', 'slab', 'foundationWall', 'skid', 'soilGhost', 'stringer', 'tread', 'deckPlank',
  'post', 'sill', 'girder', 'joist', 'rimJoist', 'bridging', 'subfloor',
]);

/** `soilGhost` is MASSING — a block of earth, not a piece of wood. It is exempt throughout. */
const isMassing = (m: Member): boolean => m.role === 'soilGhost';

function complaints(members: readonly Member[], gradeY: number): string[] {
  const out: string[] = [];
  for (const m of members) {
    if (!(m.cutLength > 0.5)) out.push(`${m.id} (${m.role}): cut length ${m.cutLength.toFixed(2)} in`);
    if (!(m.actual.w > 0.05) || !(m.actual.d > 0.05)) out.push(`${m.id} (${m.role}): section ${m.actual.w}x${m.actual.d}`);
    if (![...m.position, ...m.rotation].every(Number.isFinite)) out.push(`${m.id} (${m.role}): non-finite transform`);
    if (!isMassing(m) && cubicFeet(m) > 400) out.push(`${m.id} (${m.role}, ${m.nominal}): ${cubicFeet(m).toFixed(0)} cu ft in one piece`);
  }
  const boxes = members.filter((m) => !isMassing(m)).map(boxOf);
  for (const b of boxes) {
    if (b.lo[1]! < gradeY - 4 && !MAY_BE_UNDERGROUND.has(b.m.role)) {
      out.push(`${b.m.id} (${b.m.role}): ${(gradeY - b.lo[1]!).toFixed(1)} ft below the ground datum`);
    }
    // A tolerance, not zero: members are placed to their own faces and a nailed joint is a
    // touch, not an overlap. An inch and a half of slack finds a piece that is genuinely
    // stranded without flagging every butt joint in the building.
    if (!boxes.some((o) => o !== b && touches(b, o, 0.12))) {
      out.push(`${b.m.id} (${b.m.role}, ${b.m.nominal}): touches nothing at all`);
    }
  }
  return out;
}

// ── The option matrix ────────────────────────────────────────────────────────

const ROOFS: Record<string, unknown>[] = [
  { roof: { kind: 'gable', risePer12: 4, overhangFt: 1 } },
  { roof: { kind: 'gable', risePer12: 12, overhangFt: 0 } },
  { roof: { kind: 'hip', risePer12: 6, overhangFt: 1.5 } },
  { roof: { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'N' } },
  { roof: { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'E' } },
  { roof: { kind: 'flat', overhangFt: 1, drainPer12: 1 } },
  { roof: { kind: 'none' } },
];
const COVER: Record<string, unknown>[] = [
  { coverings: { wallSheathing: 'plywood', siding: 'boardAndBatten', roofDeck: 'plywood', roofing: 'corrugated' } },
  { coverings: { wallSheathing: 'none', siding: 'boards', roofDeck: 'purlins', roofing: 'roll' } },
  { coverings: { wallSheathing: 'none', siding: 'none', roofDeck: 'none', roofing: 'none' } },
];
const FOUND: Record<string, unknown>[] = [
  { foundation: { kind: 'piers', crawlFt: 1.5 } },
  { foundation: { kind: 'skids' } },
  { foundation: { kind: 'wall', crawlFt: 3 } },
  { foundation: { kind: 'slab' } },
];

const VARIANTS: Record<string, Record<string, unknown>[]> = {
  platform: [
    { base: 'piers', deck: 'plank' }, { base: 'skids', deck: 'panel' },
    { base: 'skids', deck: 'plank' }, { deckHeightFt: 2 }, { deckHeightFt: 8 },
  ],
  tower: [
    { access: 'ladder' }, { access: 'stair' }, { platformHeightFt: 32 }, { platformHeightFt: 10 },
    { cab: { walls: 'open-rail', roof: 'shed', roofing: 'roll' } },
    { cab: { walls: 'half-wall', roof: 'pyramid', roofing: 'roll' } },
    { footing: 'concrete-pad' },
  ],
  'crib-bunker': [
    { wallType: 'crib' }, { wallType: 'post-plank' }, { entrance: 'baffle' },
    { entrance: 'open' }, { showSoilCover: false },
  ],
  'tent-floor': [{ tent: 'temper', temperBays: 6 }],
  strongback: [{}],
  'gp-frame': [...ROOFS, ...COVER, ...FOUND, { dims: { lengthFt: 60, widthFt: 24 } }, { dims: { lengthFt: 8, widthFt: 8 } }],
  'storage-shed': [...ROOFS, ...COVER],
  'sea-hut': [...ROOFS, ...FOUND],
  'swa-hut': [...COVER, ...FOUND],
  'b-hut': [...ROOFS],
  'squad-hut': [...COVER, ...FOUND],
  'guard-shack': [...ROOFS, ...FOUND],
  latrine: [...FOUND, { latrine: { seats: 2, depthFt: 4 } }],
};

test('every shipped structure, in every configuration, is a physical object', () => {
  const bad: string[] = [];
  let cases = 0;
  for (const family of shippedFamilies()) {
    for (const patch of [{}, ...(VARIANTS[family.id] ?? [])]) {
      cases += 1;
      const spec = { ...structuredClone(family.preset), ...patch } as StructureSpec;
      const label = Object.keys(patch).length > 0 ? `${family.id} ${JSON.stringify(patch)}` : family.id;
      const model = generateStructure(spec);
      assert.ok(model.members.length > 0, `${label}: generated nothing`);
      for (const line of complaints(model.members, model.levels?.gradeY ?? 0)) bad.push(`${label}: ${line}`);
    }
  }
  // A matrix that has quietly shrunk to the presets would pass this file while testing none of
  // the branches every one of the original defects lived in.
  assert.ok(cases > 70, `the option matrix collapsed to ${cases} cases`);
  assert.deepEqual(bad, [], `structures that could not be built:\n  ${bad.join('\n  ')}`);
});

test('the entrance of a bunker is framed, and its baffle is a wall you walk around', () => {
  const bunker = shippedFamilies().find((f) => f.id === 'crib-bunker')!;
  for (const wallType of ['crib', 'post-plank'] as const) {
    const spec = { ...structuredClone(bunker.preset), wallType, entrance: 'baffle' } as StructureSpec;
    const model = generateStructure(spec);
    const header = model.members.find((m) => m.role === 'header');
    assert.ok(header, `${wallType}: the doorway has a header`);
    const hb = boxOf(header!);
    // A crib bunker has no end wall — its ends are open by construction — so the header has to
    // land on jambs this family emits, or it hangs over the doorway attached to nothing.
    const bearing = model.members.filter((m) => m.role === 'post').map(boxOf)
      .filter((p) => touches(hb, p, 0.12));
    assert.ok(bearing.length >= 2, `${wallType}: the header bears on jambs at both ends`);

    const baffle = model.members.filter((m) => m.role === 'baffleWall');
    assert.ok(baffle.length >= 3, `${wallType}: a baffle is a wall, not a single post`);
    for (const m of baffle) {
      const b = boxOf(m);
      assert.ok(b.lo[1]! >= -0.05, `${m.id}: the baffle stands on the ground, not in it`);
      assert.ok(b.hi[1]! <= (spec as { clearHeightFt: number }).clearHeightFt + 0.5,
        `${m.id}: the baffle is no taller than what it shields`);
    }
    // And it stands OFF the entrance — a baffle flush with the wall blocks nothing and shields
    // nothing; the whole point is that the way in turns.
    assert.ok(Math.min(...baffle.map((m) => boxOf(m).lo[0]!)) < -1, 'the baffle stands clear of the doorway');
  }
});

test("the latrine's riser box closes: lid on the dividers, front board under the lid", () => {
  const latrine = shippedFamilies().find((f) => f.id === 'latrine')!;
  const model = generateStructure(structuredClone(latrine.preset));
  const box = model.members.filter((m) => m.role === 'riserBox').map(boxOf);
  assert.ok(box.length >= 4, 'the bench has a lid, a front and dividers');
  const seatY = Math.max(...box.map((b) => b.hi[1]!));
  const lid = box.filter((b) => Math.abs(b.hi[1]! - seatY) < 0.02);
  assert.equal(lid.length, 1, 'exactly one lid');
  for (const b of box) {
    if (b === lid[0]) continue;
    // Everything else is UNDER the lid and reaches it. The lid used to sit at `h` while the
    // dividers were centred at `h/2` and stopped four inches short of it.
    assert.ok(touches(b, lid[0]!, 0.05), `${b.m.id}: does not reach the lid`);
    assert.ok(b.lo[1]! <= 0.05, `${b.m.id}: does not reach the ground`);
  }
});
