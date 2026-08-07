// The ends of a tent frame, where the rank runs out.
//
// A RANK LAID OUT AS `L * i / (n - 1)` PUTS ITS FIRST AND LAST CENTRELINE ON THE DECK'S OWN ENDS,
// and half of each end member then stands over air. The tent frame does that twice — once for its
// bents and once for its floor joists — and the end door, which is framed "in the end bent's own
// plane", inherits it:
//
//   TEMPER 32 x 20, deck x 0.000 .. 32.000
//     end bent posts     x -0.146 .. 0.146     1¾ in of a 3½-in post past what carries it
//     end door jambs     x -0.146 .. 0.146     the same, both ends
//     end joists         x -0.063 .. 0.063     ¾ in of joist with no decking over it
//
// The generator already knew the rule and had applied it in the other two directions: the bents
// are held in from the deck's SIDES by `PLATFORM.bentInsetFt` — *"so the plate is not the last
// board"* — and the collar's lap is deliberately turned inward *"so the end bent's tie does not
// hang off the deck"*. `floor.ts` states it for the whole toolkit: *sills, rims, and posts are
// inset so nothing overhangs the building line*. The LENGTH was the one direction nobody swept.
//
// Stepping the two end stations in by half the member's own face puts the outermost wood on the
// deck, makes the frame's outside equal the length the card states, and leaves every interior
// station exactly where the doctrine spacing put it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { TENT, IN_PER_FT } from '../src/timber/doctrine';
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

function extent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

const TENTS = ['tent-floor', 'strongback'] as const;

function tent(id: (typeof TENTS)[number]) {
  const members = generateStructure(JSON.parse(JSON.stringify(familyById(id)!.preset))).members;
  const deck = members.filter((m) => m.role === 'deckPlank');
  assert.ok(deck.length > 10, `${id}: ${deck.length} deck planks`);
  const span = (i: 0 | 2): [number, number] => [
    Math.min(...deck.map((m) => extent(m, i)[0])), Math.max(...deck.map((m) => extent(m, i)[1]))];
  return { id, members, deckX: span(0), deckZ: span(2) };
}

test('NOTHING ON A TENT FRAME STANDS PAST THE DECK IT IS BUILT ON', () => {
  for (const id of TENTS) {
    const { members, deckX, deckZ } = tent(id);
    for (const m of members) {
      const x = extent(m, 0);
      const z = extent(m, 2);
      assert.ok(x[0] >= deckX[0] - 1e-9 && x[1] <= deckX[1] + 1e-9,
        `${id}: ${m.id} (${m.role}) runs x ${x[0].toFixed(3)}..${x[1].toFixed(3)} against a deck of `
        + `${deckX[0].toFixed(3)}..${deckX[1].toFixed(3)} — `
        + `${(Math.max(deckX[0] - x[0], x[1] - deckX[1]) * IN_PER_FT).toFixed(3)} in over air`);
      assert.ok(z[0] >= deckZ[0] - 1e-9 && z[1] <= deckZ[1] + 1e-9,
        `${id}: ${m.id} (${m.role}) runs z ${z[0].toFixed(3)}..${z[1].toFixed(3)} against a deck of `
        + `${deckZ[0].toFixed(3)}..${deckZ[1].toFixed(3)}`);
    }
  }
});

test('and the end bent is FLUSH with it — stepped in by its own face, no more', () => {
  // The guard on the other direction. Moving the end stations in by any old amount would pass the
  // test above and leave the frame short of the deck at both ends, with the canvas lacing to
  // nothing. The step is exactly half the face the member presents along the length.
  for (const id of TENTS) {
    const { members, deckX } = tent(id);
    for (const role of ['bentPost', 'post'] as const) {
      const ms = members.filter((m) => m.role === role);
      assert.ok(ms.length >= 4, `${id}: ${ms.length} ${role}`);
      const lo = Math.min(...ms.map((m) => extent(m, 0)[0]));
      const hi = Math.max(...ms.map((m) => extent(m, 0)[1]));
      assert.ok(Math.abs(lo - deckX[0]) < 1e-9,
        `${id}: the first ${role} stops ${((lo - deckX[0]) * IN_PER_FT).toFixed(3)} in from the deck's end`);
      assert.ok(Math.abs(hi - deckX[1]) < 1e-9,
        `${id}: the last ${role} stops ${((deckX[1] - hi) * IN_PER_FT).toFixed(3)} in from the deck's end`);
    }
    // And the floor's own rank the same way: the outermost joist is under the outermost decking.
    const joists = members.filter((m) => m.role === 'joist');
    assert.ok(Math.abs(Math.min(...joists.map((m) => extent(m, 0)[0])) - deckX[0]) < 1e-9,
      `${id}: the end joist is not flush with the deck it carries`);
  }
});

test('and every INTERIOR bent is exactly where it always was', () => {
  // What must NOT move. The rank is an even division of the length — `bentSpacingFt` sizes the
  // COUNT and the bays come out near it rather than on it, which is the same nearest-division rule
  // the rest of the toolkit lays members out by — and the end step is a detail at the two ends,
  // not a re-layout. So the interior stations are asserted against that division, and the two ends
  // against it less half a face.
  const spacing = TENT.bentSpacingFt.value as number;
  for (const id of TENTS) {
    const { members, deckX } = tent(id);
    const xs = [...new Set(members.filter((m) => m.role === 'bentPost')
      .map((m) => Math.round(m.position[0]! * 1e9) / 1e9))].sort((a, b) => a - b);
    assert.ok(xs.length >= 4, `${id}: ${xs.length} bent stations`);
    const L = deckX[1] - deckX[0];
    const n = xs.length;
    assert.equal(n, Math.max(2, Math.round(L / spacing) + 1), `${id}: ${n} bents over ${L} ft`);
    const face = Math.max(...members.filter((m) => m.role === 'bentPost')
      .map((m) => { const e = extent(m, 0); return e[1] - e[0]; }));
    for (let i = 1; i < n - 1; i++) {
      assert.ok(Math.abs(xs[i]! - (L * i) / (n - 1)) < 1e-9,
        `${id}: bent ${i} is at ${xs[i]!.toFixed(4)} and the even division puts it at ${((L * i) / (n - 1)).toFixed(4)}`);
    }
    assert.ok(Math.abs(xs[0]! - face / 2) < 1e-9,
      `${id}: the first bent is at ${xs[0]!.toFixed(4)}, not the ${(face / 2).toFixed(4)} half its own face comes to`);
    assert.ok(Math.abs(xs[n - 1]! - (L - face / 2)) < 1e-9,
      `${id}: the last bent is at ${xs[n - 1]!.toFixed(4)}, not ${(L - face / 2).toFixed(4)}`);
  }
});

test("and the end door still stands in the end bent's own plane", () => {
  // The door is framed rather than opened — there is no wall here — so its jambs live in the end
  // bent's plane and have to travel with it. Left behind, they would be the thing hanging off the
  // deck instead.
  for (const id of TENTS) {
    const { members } = tent(id);
    const bentX = [...new Set(members.filter((m) => m.role === 'bentPost').map((m) => m.position[0]!))]
      .sort((a, b) => a - b);
    const jambs = members.filter((m) => m.role === 'post');
    assert.equal(jambs.length, 4, `${id}: two jambs at each end`);
    for (const j of jambs) {
      const near = Math.min(...bentX.map((x) => Math.abs(x - j.position[0]!)));
      assert.ok(near < 1e-9, `${id}: ${j.id} stands ${(near * IN_PER_FT).toFixed(3)} in off any bent's plane`);
      assert.ok(Math.abs(j.position[0]! - bentX[0]!) < 1e-9 || Math.abs(j.position[0]! - bentX[bentX.length - 1]!) < 1e-9,
        `${id}: ${j.id} is not in an END bent's plane`);
    }
    // And the head with them.
    for (const h of members.filter((m) => m.role === 'header')) {
      assert.ok(Math.abs(h.position[0]! - bentX[0]!) < 1e-9
        || Math.abs(h.position[0]! - bentX[bentX.length - 1]!) < 1e-9,
        `${id}: ${h.id} is not in an END bent's plane`);
    }
  }
});
