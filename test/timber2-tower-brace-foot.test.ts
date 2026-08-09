// The guard tower's X-braces, where they come down on the footing.
//
// A brace is bolted flat to a BATTERED face and struck corner to corner of each bay. A board has
// width, so the low end's low corner hangs 2.21 in below the corner the diagonal was struck from,
// and the bottom bay's corner is the top of the footing the legs stand on. Every bottom-bay brace
// had its foot buried in that footing, on all four faces, on both footings the card offers:
//
//   timber mudsill   6 pairs, 1.93 in        concrete pad   8 pairs, 1.92 in
//
// AND NOTHING CUTS A `towerBrace`. That is what makes this different from the bird's mouth, the
// plumb ridge cut and the stringer's ends, which are all mesh cuts the member's box deliberately
// does not follow: here the viewer drew a plain box, so the penetration was not an approximation
// anyone had accepted — it was on screen, a brace point through the top of the mudsill, at every
// leg of every tower.
//
// `levelFootProfile` cuts it level through the CENTRELINE'S END — the bay corner, where the saw
// goes. Cutting level through the end's TOP corner instead, which is what `stringerEndProfile`
// does at a stringer's foot, is right for a board standing on the ground and wrong here: it eats
// the whole end face and leaves the foot 2½ in in the air.
//
//   lowest point of a brace, against the footing top     BOX -1.935 in  ->  CUT +0.276 in

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById, shippedFamilies } from '../src/timber/catalog';
import { levelFootProfile, stringerEndProfile } from '../src/timber/stringerCuts';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];

/** Rotate a local vector by a member's YXZ euler (R = Ry·Rx·Rz), the scene's convention. */
function rotate(m: Pick<Member, 'rotation'>, v: V3): V3 {
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
  return [a, y, b];
}

const world = (m: Member, l: V3): V3 => {
  const r = rotate(m, l);
  return [m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]];
};

/** The corners of the raw stick a piece is sawn from. */
function boxCorners(m: Member): V3[] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const out: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(world(m, [sx * h[0], sy * h[1], sz * h[2]]));
  }
  return out;
}

/** The corners of the piece AS CUT — which is what the viewer extrudes and a person sees. */
function cutCorners(m: Member): V3[] {
  const prof = levelFootProfile(m);
  if (!prof) return boxCorners(m);
  const hz = m.actual.w / 24;
  return prof.flatMap(([px, py]) => [-hz, hz].map((pz) => world(m, [px, py, pz])));
}

function tower(footing: string) {
  const spec = { ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), footing };
  const members = generateStructure(spec).members;
  const braces = members.filter((m) => m.role === 'towerBrace');
  const pads = members.filter((m) => ['sill', 'footing'].includes(m.role));
  assert.ok(braces.length >= 8, `${footing}: ${braces.length} braces`);
  assert.ok(pads.length > 0, `${footing}: nothing under the legs`);
  return { members, braces, padTop: Math.max(...pads.flatMap((m) => boxCorners(m).map((c) => c[1]))) };
}

const FOOTINGS = ['timber-mudsill', 'concrete-pad'];

test('A BRACE FOOT IS CUT LEVEL — every one used to drive into the footing under it', () => {
  for (const footing of FOOTINGS) {
    const { braces, padTop } = tower(footing);
    for (const b of braces) {
      const low = Math.min(...cutCorners(b).map((c) => c[1]));
      assert.ok(low >= padTop - 1e-9,
        `${footing}: ${b.id} reaches ${((padTop - low) * IN_PER_FT).toFixed(3)} in below the top of the footing`);
    }
    // And the box it is sawn from DOES — the whole reason the piece has to be cut at all. A brace
    // that merely stopped higher up would pass the line above and be a shorter brace, not a cut one.
    const worstBox = Math.min(...braces.flatMap((b) => boxCorners(b).map((c) => c[1])));
    assert.ok(worstBox < padTop - 1e-9,
      `${footing}: the uncut sticks already clear the footing — this test is measuring nothing`);
  }
});

test('and the cut is LEVEL, not merely short — the foot is a horizontal face', () => {
  for (const footing of FOOTINGS) {
    const { braces } = tower(footing);
    for (const b of braces) {
      const prof = levelFootProfile(b);
      assert.ok(prof, `${b.id}: a raked brace has a low end to cut`);
      assert.equal(prof!.length, 5, `${b.id}: cutting one corner off a rectangle leaves five`);
      // The two vertices the cut left are the only pair at the same world height that are not an
      // edge of the original rectangle, and they are what has to be level.
      const pts = prof!.map(([px, py]) => world(b, [px, py, 0]));
      const lows = pts.map((p) => p[1]).sort((x, y) => x - y);
      assert.ok(Math.abs(lows[0]! - lows[1]!) < 1e-9,
        `${footing}: ${b.id}'s foot falls ${((lows[1]! - lows[0]!) * IN_PER_FT).toFixed(4)} in across itself`);
    }
  }
});

test('and it stops exactly AT the corner it was struck from — no shorter', () => {
  // The guard on the other direction, and the whole reason the level line goes through the
  // centreline's end rather than the end's top corner. A brace is held by the bolts through the
  // leg; cut level through the top corner instead and the foot rises 2.49 in, taking the end face
  // and the wood those bolts go through with it. Stated as an equality so it pins both ways: the
  // piece's lowest point IS the height of its own centreline end, not above it and not below.
  for (const footing of FOOTINGS) {
    const { braces } = tower(footing);
    for (const b of braces) {
      const half = b.cutLength / IN_PER_FT / 2;
      const ax = rotate(b, [1, 0, 0]);
      const corner = b.position[1]! - Math.abs(ax[1]) * half; // the low end of the centreline
      // On the board's MID-PLANE, which is what the profile is drawn on. The two faces sit a
      // thickness apart across a battered plane, so each is its own 0.075 in above or below this;
      // that is the board lying on the lean, not the cut, and test one already holds both faces
      // over the footing.
      const prof = levelFootProfile(b)!;
      const low = Math.min(...prof.map(([px, py]) => world(b, [px, py, 0])[1]));
      assert.ok(Math.abs(low - corner) < 1e-9,
        `${footing}: ${b.id} bottoms out ${((low - corner) * IN_PER_FT).toFixed(3)} in off the bay corner`);
      // And the board is not shortened: both ends of the centreline are still on the outline.
      for (const s of [-half, half]) {
        assert.ok(prof.some(([px, py]) => Math.abs(px - s) < 1e-9 && Math.abs(py) <= b.actual.d / 24 + 1e-9),
          `${footing}: ${b.id} lost the ${s < 0 ? 'low' : 'high'} end of its own centreline`);
      }
      // The high end keeps both corners — only the low one is cut.
      for (const sy of [-1, 1]) {
        const hi = ax[1] > 0 ? half : -half;
        assert.ok(prof.some(([px, py]) => Math.abs(px - hi) < 1e-9 && Math.abs(py - (sy * b.actual.d) / 24) < 1e-9),
          `${footing}: ${b.id}'s high end lost a corner`);
      }
    }
  }
});

test('and nothing else in the catalog is cut by it', () => {
  // `levelFootProfile` is reached from one branch, on one role. The degenerate answers are what
  // keep it there: a level board has no low end and a plumb one has no level cut, and every other
  // raked member in the toolkit either carries its own profile already or is meant to be a box.
  const stick = { cutLength: 60, actual: { w: 1.5, d: 5.5 } };
  assert.equal(levelFootProfile({ ...stick, rotation: [0, 0, 0] }), null, 'a level board');
  assert.equal(levelFootProfile({ ...stick, rotation: [0, 0, Math.PI / 2] }), null, 'a plumb board');
  assert.equal(levelFootProfile({ ...stick, rotation: [Math.PI / 2, 0, Math.PI / 4] }), null,
    'a board rolled until its face width is horizontal');
  for (const f of shippedFamilies()) {
    const ms = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    for (const m of ms.filter((x) => x.role === 'towerBrace')) {
      assert.ok(levelFootProfile(m), `${f.id}: ${m.id} is a raked brace and got no cut`);
    }
  }
  // And the stringer's own cut is untouched — the two live in one module and answer different
  // questions, and a stringer's foot is cut through the end's TOP corner, not its centreline.
  const stringer = { cutLength: 60, actual: { w: 1.5, d: 11.25 }, rotation: [0, 0, Math.PI / 6] as V3 };
  const sp = stringerEndProfile(stringer);
  assert.equal(sp.length, 4, 'a stringer keeps four corners');
  assert.deepEqual(sp[3], [-2.5, 11.25 / 24], 'the stringer foot still keeps its top corner at the very end');
});
