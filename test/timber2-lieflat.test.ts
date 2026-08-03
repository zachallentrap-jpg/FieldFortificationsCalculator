// TIMBER-2 — THE FLAT-PIECE INVARIANT.
//
// This file exists because the same mistake shipped six times in five different modules, and it
// shipped LOOKING like working code. The canonical member frame runs length along local X, face
// width along local Y and thickness along local Z (types.ts). So a piece emitted at rotation
// [0,0,0] stands ON EDGE — its face width is vertical. That is right for a joist, a rim joist,
// a ridge, a stud. It is wrong for everything you walk on or lay down flat, and the tell is
// always the same: the surrounding POSITION math is written for a flat piece (spacing steps by
// face width, height sinks by thickness) while the rotation draws it on edge. The two disagree,
// nothing throws, and the render comes out as a comb of fins.
//
// What shipped to the owner before this test existed:
//   • platform deck planks and deck panels — a 4-ft plywood wall standing on the joists;
//   • the tent floor's decking, same;
//   • the guard tower's platform deck — one 8-ft sheet on edge, hanging under the cab, which is
//     the "random piece of plywood" that started this;
//   • every stair tread and every switchback landing — nothing to put a boot on;
//   • the crib bunker's lagging — a roof with daylight between the boards;
//   • the tower mudsill and both concrete pads — a spread footing bearing on its narrow edge.
//
// The invariant that catches all of them at once is not "rotation must equal [-PI/2, 0, 0]" —
// that would be a spelling test, and it would fail correctly-sloped ramp decking. It is the
// physical statement: A DECK PIECE'S THIN DIMENSION POINTS UP. Flat or sloped, the thickness is
// what you stand on top of. Everything else about the piece is free.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies, familyById } from '../src/timber/catalog';
import type { Member, MemberRole } from '../src/timber/types';
import type { StructureSpec } from '../src/timber/spec';

type V3 = [number, number, number];

/** Rotate a local vector by a member's YXZ euler (R = Ry·Rx·Rz), the scene's convention. */
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

/** World-space corners of a member's box, in feet. */
function corners(m: Member): V3[] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const out: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    out.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  return out;
}

const yRange = (m: Member): [number, number] => {
  const ys = corners(m).map((c) => c[1]);
  return [Math.min(...ys), Math.max(...ys)];
};

/** How vertical the member's THICKNESS axis is: 1 = dead flat, 0 = standing on edge. */
const thicknessUp = (m: Member): number => Math.abs(rotate(m, [0, 0, 1])[1]);

/**
 * Pieces you walk on. Every one of these must present its thickness upward, everywhere.
 *
 * Two roles are deliberately NOT here, and the reason is the same for both: the role names a
 * piece's JOB, and the same job is done in two planes.
 *   `sill`    — a platform sill is legitimately a beam on edge; only the tower's MUDSILL has to
 *               lie flat, and that one is asserted by name below.
 *   `lagging` — over the stringers it is a roof deck and must lie flat; behind the posts it is
 *               the wall face, laid broad-side against the earth and stacked UP the wall, where
 *               thickness-vertical would be the bug. The roof case is asserted by stage below.
 * Loosening the general rule to accommodate either would have let the real defect back in.
 */
const FLAT_ROLES: ReadonlySet<MemberRole> = new Set<MemberRole>([
  'deckPlank', 'subfloor', 'tread',
]);

/**
 * The steepest a deck piece may lean and still count as flat. The doctrine ramp slopes are
 * 1:4, 1:6 and 1:8 — 14.0°, 9.5° and 7.1° — so 20° passes every legal ramp and still fails a
 * piece that is standing on edge (90°, thicknessUp = 0) or leaning like a rafter.
 */
const MAX_LEAN_DEG = 20;
const MIN_THICKNESS_UP = Math.cos((MAX_LEAN_DEG * Math.PI) / 180);

const shipped = shippedFamilies();

test('every deck piece in every shipped family lies flat side up', () => {
  const bad: string[] = [];
  for (const fam of shipped) {
    const model = generateStructure(structuredClone(fam.preset));
    for (const m of model.members) {
      if (!FLAT_ROLES.has(m.role)) continue;
      const up = thicknessUp(m);
      if (up < MIN_THICKNESS_UP) {
        const lean = ((Math.acos(Math.min(1, up)) * 180) / Math.PI).toFixed(1);
        bad.push(`${fam.id}/${m.id} (${m.role}, ${m.nominal}) leans ${lean}° — thickness is not up`);
      }
    }
  }
  assert.deepEqual(bad, [], `deck pieces standing on edge:\n  ${bad.join('\n  ')}`);
});

test('the same holds when the operator switches the platform base and decking', () => {
  const platform = familyById('platform')!;
  for (const base of ['piers', 'skids'] as const) {
    for (const deck of ['plank', 'panel'] as const) {
      const spec = structuredClone(platform.preset) as StructureSpec & { base: string; deck: string };
      spec.base = base;
      spec.deck = deck;
      const model = generateStructure(spec as StructureSpec);
      for (const m of model.members) {
        if (!FLAT_ROLES.has(m.role)) continue;
        assert.ok(
          thicknessUp(m) >= MIN_THICKNESS_UP,
          `${base}/${deck}: ${m.id} (${m.role}) is on edge`,
        );
      }
      // A panel deck is a decking CHOICE, not a decking choice for the flat part only — the
      // ramp used to plank itself regardless, so a panel platform grew a plank ramp.
      const rampStage = model.stagePlan.findIndex((s) => s.key === 'stairs-access') + 1;
      const onRamp = model.members.filter((m) => m.stage === rampStage && FLAT_ROLES.has(m.role));
      assert.ok(onRamp.length > 0, `${base}/${deck}: the ramp is decked with something`);
      const wanted = deck === 'panel' ? 'subfloor' : 'deckPlank';
      assert.ok(
        onRamp.some((m) => m.role === wanted),
        `${base}/${deck}: the ramp follows the decking choice (wanted ${wanted})`,
      );
    }
  }
});

test('the ramp climbs from grade to the deck, not away from it', () => {
  const platform = familyById('platform')!;
  const spec = structuredClone(platform.preset) as StructureSpec & { deckHeightFt: number };
  const deckY = spec.deckHeightFt;
  const model = generateStructure(spec as StructureSpec);
  const rampStage = model.stagePlan.findIndex((s) => s.key === 'stairs-access') + 1;

  // The ramp occupies -Z (in front of the platform's S edge). Its pieces are the ones out there.
  const onRamp = model.members.filter((m) => m.stage === rampStage && corners(m).some((c) => c[2] < -1));
  assert.ok(onRamp.length > 4, 'the ramp generated pieces');

  // THE DEFECT THIS PINS: stringers used to run [0, PI/2, +pitch], which sends the length axis
  // to (0, -sin p, -cos p) reversed — the piece started at GRADE hard against the platform and
  // rose to deck height 24 ft out in the field, so the ramp climbed away into mid-air.
  for (const m of onRamp.filter((x) => x.role === 'stringer')) {
    const cs = corners(m);
    const atPlatform = cs.filter((c) => c[2] > -1).map((c) => c[1]);
    const outField = cs.filter((c) => c[2] < -1).map((c) => c[1]);
    assert.ok(atPlatform.length > 0 && outField.length > 0, `${m.id} spans platform to field`);
    assert.ok(
      Math.max(...atPlatform) > Math.max(...outField),
      `${m.id} is HIGH at the platform and LOW out at grade`,
    );
    assert.ok(Math.max(...atPlatform) > deckY * 0.6, `${m.id} reaches up toward the deck`);
  }

  // Every piece of ramp decking sits inside the wedge between grade and the deck, and the run
  // as a whole actually touches both ends.
  const decking = onRamp.filter((m) => FLAT_ROLES.has(m.role));
  const tops = decking.map((m) => yRange(m)[1]);
  assert.ok(Math.min(...tops) < 0.5, 'the foot of the ramp reaches grade');
  assert.ok(Math.max(...tops) > deckY - 0.5, 'the head of the ramp reaches the deck');
  for (const m of decking) {
    const [lo, hi] = yRange(m);
    assert.ok(hi <= deckY + 0.25, `${m.id} does not overshoot the deck`);
    assert.ok(lo >= -1.5, `${m.id} does not plunge below the ramp`);
  }
});

test('a skid base holds the deck up, exactly like a pier base does', () => {
  const platform = familyById('platform')!;
  for (const base of ['piers', 'skids'] as const) {
    const spec = structuredClone(platform.preset) as StructureSpec & { base: string; deckHeightFt: number };
    spec.base = base;
    const model = generateStructure(spec as StructureSpec);
    // Choosing skids used to emit three runners lying on the ground and NO posts, so a 4-ft
    // platform floated with four feet of nothing under it.
    const posts = model.members.filter((m) => m.role === 'post');
    assert.ok(posts.length > 0, `${base}: the deck stands on posts`);
    const top = Math.max(...posts.map((m) => yRange(m)[1]));
    const bottom = Math.min(...posts.map((m) => yRange(m)[0]));
    assert.ok(bottom < 0.3, `${base}: the posts come down to the base`);
    assert.ok(top > spec.deckHeightFt * 0.6, `${base}: the posts come up to the framing`);
  }
});

test('a spread footing spreads: pads and mudsills bear on their broad face', () => {
  for (const fam of shipped) {
    const model = generateStructure(structuredClone(fam.preset));
    for (const m of model.members) {
      if (m.role === 'footing' && m.nominal.includes('conc pad')) {
        const [lo, hi] = yRange(m);
        // A pad is poured in a hole. On edge it was 16 in tall on an 8-in position and stuck
        // a third of itself up out of the ground.
        assert.ok(hi <= 0.02, `${fam.id}/${m.id}: the pad is below grade, not standing in it`);
        const depth = hi - lo;
        const plan = Math.max(m.cutLength, m.actual.d, m.actual.w) / 12;
        assert.ok(depth < plan, `${fam.id}/${m.id}: a pad is wider in plan than it is deep`);
      }
    }
  }
});

test('the bunker lags its roof flat, and the wall lagging stays on the wall', () => {
  const bunker = familyById('crib-bunker')!;
  const model = generateStructure(structuredClone(bunker.preset));
  const roofStage = model.stagePlan.findIndex((s) => s.key === 'roof-deck') + 1;
  const roof = model.members.filter((m) => m.role === 'lagging' && m.stage === roofStage);
  assert.ok(roof.length > 0, 'the roof is lagged');
  for (const m of roof) {
    // "Lagging over the stringers, so nothing above falls between them" — the stage detail is
    // the requirement. On edge, the boards were spaced a face width apart and touched nothing.
    assert.ok(thicknessUp(m) >= MIN_THICKNESS_UP, `${m.id}: roof lagging lies flat`);
  }
  const wall = model.members.filter((m) => m.role === 'lagging' && m.stage !== roofStage);
  for (const m of wall) {
    assert.ok(thicknessUp(m) < 0.2, `${m.id}: wall lagging stands against the face, not flat`);
  }
});

test('the guard tower decks its platform in real sheets, and none of them stand up', () => {
  const tower = familyById('tower')!;
  const spec = structuredClone(tower.preset) as StructureSpec & { cabPlanFt: number };
  const model = generateStructure(spec as StructureSpec);
  const deck = model.members.filter((m) => m.role === 'subfloor');
  assert.ok(deck.length >= 2, 'an 8-ft platform takes more than one 4x8 sheet');
  for (const m of deck) {
    assert.ok(thicknessUp(m) >= MIN_THICKNESS_UP, `${m.id} lies flat`);
    // No sheet may be bigger than a sheet — the bill orders what supply issues.
    assert.ok(m.cutLength <= 8 * 12 + 0.01 && m.actual.d <= 8 * 12 + 0.01, `${m.id} is a real sheet`);
  }
  // The mudsill under each leg is the one `sill` in the toolkit that must lie flat.
  for (const m of model.members.filter((x) => x.role === 'sill')) {
    assert.ok(thicknessUp(m) >= MIN_THICKNESS_UP, `${m.id}: a mudsill bears on its broad face`);
    assert.ok(yRange(m)[0] >= -0.02, `${m.id}: the mudsill sits on the ground, not in it`);
  }
});
