// The guard tower's X-braces — the members that actually carry the wind.
//
// A BRACE IS BOLTED TO THE FACE OF THE FRAME, SO IT CANNOT BE IN IT. Both diagonals of every X
// were drawn on the legs' own centre plane, corner centre to corner centre, which put every one of
// them inside the two legs it braces and, since the pair shared that plane, inside EACH OTHER at
// the crossing. On the shipped preset, by what a brace shares wood with (SAT on the oriented
// boxes, not axis-aligned — a raked diagonal's AABB spans its whole climb):
//
//   towerBrace 40 / 2.67 in   towerLeg 32 / 3.85 in   girt 48 / 1.50 in   sill 8 / 2.19 in
//   joist 8 / 1.50    subfloor 8 / 0.75    toeBoard 8 / 0.88    post 8 / 0.86    ladderRail 2 / 1.05
//
// 162 pairs in all, and the render shows it plainly: the X in every bay is two sticks fighting for
// the same pixels down the middle, on all four faces of every bay.
//
// TWO THINGS HAD TO BE RIGHT. The brace has to stand OFF the leg by the leg's own reach along the
// face normal — a battered leg's section is tilted, so that is the support of a raked box, not
// half its width. And it has to LIE FLAT ON THE FACE: the rotation was built from the plan run and
// the rise alone, which leaves the board on edge in a VERTICAL plane, while the face leans with
// the legs and the two diagonals of one X lean opposite ways in plan — so their two vertical
// planes cross at about 10° and no offset can separate them. Built from the face's own frame, the
// second diagonal stacks on the first at exactly one thickness.
//
//   shipped preset   162 -> 6      concrete pad   162 -> 8
//   stair access     162 -> 10     24-ft platform 241 -> 12
//
// What is left is the square-cut LOWER END of a raked board dipping into the footing beside it,
// and — with a stair — the stair well, which the frame already swept into before this change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import { DRESSED } from '../src/timber/types';
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

const halfExtents = (m: Member): V3 => [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
const axesOf = (m: Member): V3[] => [rotate(m, [1, 0, 0]), rotate(m, [0, 1, 0]), rotate(m, [0, 0, 1])];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Least separation over the 15 separating axes. Positive is a TRUE clearance. Every member in this
 * file is raked, and an AABB round a diagonal that climbs a whole bay spans the bay — a box test
 * calls the entire frame a collision and cannot tell a real one from a lean.
 */
function gap(a: Member, b: Member): number {
  const A = axesOf(a), B = axesOf(b), ha = halfExtents(a), hb = halfExtents(b);
  const d: V3 = [b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]];
  const cand: V3[] = [...A, ...B];
  for (const u of A) {
    for (const v of B) {
      const c: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(c[0], c[1], c[2]);
      if (l > 1e-9) cand.push([c[0] / l, c[1] / l, c[2] / l]);
    }
  }
  let best = -Infinity;
  for (const n of cand) {
    const ra = A.reduce((s, u, i) => s + ha[i]! * Math.abs(dot(u, n)), 0);
    const rb = B.reduce((s, u, i) => s + hb[i]! * Math.abs(dot(u, n)), 0);
    best = Math.max(best, Math.abs(dot(d, n)) - ra - rb);
  }
  return best;
}

/** The tower, with the card's own options overlaid. */
function tower(opts: Record<string, unknown> = {}) {
  const spec = { ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), ...opts };
  const model = generateStructure(spec);
  const braces = model.members.filter((m) => m.role === 'towerBrace');
  assert.ok(braces.length >= 8, `${braces.length} braces on a tower`);
  return { model, braces };
}

const OPTIONS: Record<string, unknown>[] = [
  {}, { footing: 'concrete-pad' }, { access: 'stair' }, { platformHeightFt: 24 },
];

test('A BRACE IS OUTSIDE THE LEGS IT BRACES — every one used to be inside two of them', () => {
  for (const opts of OPTIONS) {
    const { model, braces } = tower(opts);
    const label = JSON.stringify(opts);
    const legs = model.members.filter((m) => m.role === 'towerLeg');
    assert.equal(legs.length, 4, `${label}: ${legs.length} legs`);
    for (const b of braces) {
      for (const l of legs) {
        const s = gap(b, l);
        assert.ok(s >= -1e-6, `${label}: ${b.id} and ${l.id} share ${(-s * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and the two diagonals of one X are stacked, not in the same plane', () => {
  // The pair used to share the leg plane, so the crossing was 2.67 in of one board inside the
  // other. Checked as geometry — parallel faces, one thickness apart — and not just as "they do
  // not touch", because a pair that misses only because the bay is shallow is still wrong.
  const braceT = DRESSED['2x6']!.w / IN_PER_FT;
  for (const opts of OPTIONS) {
    const { braces } = tower(opts);
    const label = JSON.stringify(opts);
    // Emission order is face by face, two diagonals at a time, so consecutive pairs are one X.
    for (let i = 0; i + 1 < braces.length; i += 2) {
      const a = braces[i]!, b = braces[i + 1]!;
      const na = rotate(a, [0, 0, 1]), nb = rotate(b, [0, 0, 1]);
      assert.ok(Math.abs(Math.abs(dot(na, nb)) - 1) < 1e-9,
        `${label}: ${a.id} and ${b.id} are one X but their faces are ${(Math.acos(Math.min(1, Math.abs(dot(na, nb)))) * 180 / Math.PI).toFixed(2)}° apart`);
      const d: V3 = [b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]];
      assert.ok(Math.abs(Math.abs(dot(d, na)) - braceT) < 1e-9,
        `${label}: ${a.id} and ${b.id} are ${(Math.abs(dot(d, na)) * IN_PER_FT).toFixed(3)} in apart across the face, `
        + `not the ${(braceT * IN_PER_FT).toFixed(2)} in one board is thick`);
      assert.ok(gap(a, b) >= -1e-6, `${label}: ${a.id} and ${b.id} share ${(-gap(a, b) * IN_PER_FT).toFixed(3)} in`);
    }
  }
});

test('and a brace lies FLAT on the face, its broad side to the frame', () => {
  // The half of the fix that made the stacking possible. A board on edge in a vertical plane, on
  // a battered face, is neither bolted to anything nor clear of its twin.
  for (const opts of OPTIONS) {
    const { model, braces } = tower(opts);
    const label = JSON.stringify(opts);
    const legs = model.members.filter((m) => m.role === 'towerLeg');
    for (const b of braces) {
      const n = rotate(b, [0, 0, 1]);      // the brace's own thickness direction
      const t = rotate(b, [1, 0, 0]);      // and its length
      // The face it lies on is spanned by its own run and by the legs it lands on, so its
      // thickness must be square to both. The nearest leg is the one it is bolted to.
      const near = legs
        .map((l) => ({ l, d: Math.hypot(...([0, 1, 2].map((i) => l.position[i]! - b.position[i]!) as V3)) }))
        .sort((p, q) => p.d - q.d)[0]!.l;
      const legAxis = rotate(near, [1, 0, 0]);
      assert.ok(Math.abs(dot(n, t)) < 1e-9, `${label}: ${b.id} thickness is not square to its own length`);
      assert.ok(Math.abs(dot(n, legAxis)) < 1e-6,
        `${label}: ${b.id} lies ${(Math.asin(Math.min(1, Math.abs(dot(n, legAxis)))) * 180 / Math.PI).toFixed(2)}° out of the `
        + `face of ${near.id} — it is on edge in a vertical plane, not flat on the battered face`);
    }
  }
});

test('and it still spans its bay corner to corner, and still lands on the legs', () => {
  // The guard on the fix: standing a brace off the frame is only right if it still reaches the
  // two corners it triangulates. Measured as the distance from each end to the nearest leg axis,
  // which cannot grow without the brace having been shortened or slid along its own run.
  const braceT = DRESSED['2x6']!.w / IN_PER_FT;
  const legW = DRESSED['6x6']!.d / IN_PER_FT;
  for (const opts of OPTIONS) {
    const { model, braces } = tower(opts);
    const label = JSON.stringify(opts);
    const legs = model.members.filter((m) => m.role === 'towerLeg');
    for (const b of braces) {
      const t = rotate(b, [1, 0, 0]);
      const halfLen = b.cutLength / 24;
      for (const s of [-1, 1]) {
        const end: V3 = [0, 1, 2].map((i) => b.position[i]! + s * t[i]! * halfLen) as V3;
        // Distance from that end to the nearest leg AXIS (a line), across the whole leg.
        const best = Math.min(...legs.map((l) => {
          const u = rotate(l, [1, 0, 0]);
          const d: V3 = [end[0] - l.position[0], end[1] - l.position[1], end[2] - l.position[2]];
          const along = dot(d, u);
          const perp: V3 = [d[0] - along * u[0], d[1] - along * u[1], d[2] - along * u[2]];
          return Math.hypot(perp[0], perp[1], perp[2]);
        }));
        // The end sits on the face, so it is off the leg's axis by the leg's half width plus the
        // board's stack — never by a whole bay, which is what a brace that missed its corner
        // would give.
        assert.ok(best <= legW / 2 + 2 * braceT + 1e-9,
          `${label}: ${b.id}'s ${s < 0 ? 'lower' : 'upper'} end is ${(best * IN_PER_FT).toFixed(2)} in from any leg — `
          + `it does not land on the corner it braces`);
      }
    }
  }
});
