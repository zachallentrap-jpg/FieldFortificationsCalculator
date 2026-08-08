// The guard tower's girts — the horizontals that tie the legs, and the top one the platform
// stands on.
//
// A GIRT IS FRAMED BETWEEN THE LEGS. Every one was cut to the distance between the two leg
// CENTRES and centred on that line, so both ends were buried in a leg, and the girts of two
// adjacent faces — both running to the same corner — were inside each other there as well.
//
// AND THE TOP ONE CARRIES THE PLATFORM. It sat at the leg tops, which is the DECK SURFACE, so on
// every tower it ran through all sixteen platform joists, the decking over them, the four cab
// posts, and the railing's posts and toe boards standing on the deck. Its top edge belongs at the
// joists' undersides: it was ten inches too high, which is the joist's depth plus the girt's own.
//
//   girt overlaps, shipped preset                     before   after
//     towerLeg  16 / 3.019 in                            16      8 / 0.007 in
//     girt       8 / 0.750                                8      0
//     joist     16 / 1.500   subfloor 6 / 0.750          37      0
//     post       8 / 1.750   railPost 2 / 2.000
//     toeBoard   5 / 1.500
//                                                        61      8
//
//   top girt's top edge vs the joists' undersides      -10.0000 in   ->   0.0000
//
// TWO CORRECTIONS ON THE WAY, both about a battered frame. The stop is not half a leg's width: a
// horizontal girt runs into a RAKED leg, so its direction has a component along the leg's own
// length and it leaves through a side face tilted to it — `(w/2) / max(|u·e_y|, |u·e_z|)`, not the
// box's support. And a board is CUT SQUARE while the gap it fits narrows going up, so the girt has
// to be struck at its TOP arris; struck at its centre it still bit 0.27 in into both legs along
// its bottom edge. What is left is 0.007 in, which is the girt's own arris against a raked prism —
// a hundredth of an inch on stock quoted to sixteenths.

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

/** Least separation over the 15 separating axes. Positive is a TRUE clearance. */
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

interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

function box(m: Member): Box {
  const h = halfExtents(m);
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

/**
 * A sixteenth of an inch is the finest figure anything in this toolkit is cut to; a sixty-fourth
 * is the bound used here, so the assertion is tighter than the stock and still clear of the
 * hundredth left by a square-cut arris meeting a raked prism.
 */
const ARRIS = 1 / 64 / IN_PER_FT;

function tower(opts: Record<string, unknown> = {}) {
  const spec = { ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), ...opts };
  const model = generateStructure(spec);
  const girts = model.members.filter((m) => m.role === 'girt');
  assert.ok(girts.length >= 4, `${girts.length} girts on a tower`);
  return { model, girts };
}

const OPTIONS: Record<string, unknown>[] = [
  {}, { footing: 'concrete-pad' }, { access: 'stair' }, { platformHeightFt: 24 },
];

test('A GIRT IS FRAMED BETWEEN THE LEGS — both ends used to be buried in one', () => {
  for (const opts of OPTIONS) {
    const { model, girts } = tower(opts);
    const label = JSON.stringify(opts);
    const legs = model.members.filter((m) => m.role === 'towerLeg');
    assert.equal(legs.length, 4, `${label}: ${legs.length} legs`);
    for (const g of girts) {
      for (const l of legs) {
        const s = gap(g, l);
        assert.ok(s >= -ARRIS,
          `${label}: ${g.id} and ${l.id} share ${(-s * IN_PER_FT).toFixed(3)} in of wood`);
      }
      // And the girts of two adjacent faces no longer meet inside the corner leg.
      for (const h of girts) {
        if (h.id <= g.id) continue;
        const s = gap(g, h);
        assert.ok(s >= -1e-9, `${label}: ${g.id} and ${h.id} share ${(-s * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and it still REACHES both legs — a girt that stops short ties nothing', () => {
  // The guard on the cut. Shortening a girt is only right if each end still lands on the leg it
  // is bolted to; measured as the distance from the end to the nearest leg AXIS, which cannot
  // exceed what a bolt through the leg can reach.
  const legW = DRESSED['6x6']!.d / IN_PER_FT;
  for (const opts of OPTIONS) {
    const { model, girts } = tower(opts);
    const label = JSON.stringify(opts);
    const legs = model.members.filter((m) => m.role === 'towerLeg');
    for (const g of girts) {
      const t = rotate(g, [1, 0, 0]);
      for (const s of [-1, 1]) {
        const end: V3 = [0, 1, 2].map((i) => g.position[i]! + s * t[i]! * (g.cutLength / 24)) as V3;
        const best = Math.min(...legs.map((l) => {
          const u = rotate(l, [1, 0, 0]);
          const d: V3 = [end[0] - l.position[0], end[1] - l.position[1], end[2] - l.position[2]];
          const along = dot(d, u);
          const perp: V3 = [d[0] - along * u[0], d[1] - along * u[1], d[2] - along * u[2]];
          return Math.hypot(perp[0], perp[1], perp[2]);
        }));
        // A point ON the surface of a square prism is between half its width and half its
        // diagonal from the axis, whichever face and arris it lands between. Short of that band
        // and the girt is buried; past it and the girt does not reach.
        assert.ok(best >= legW / 2 - ARRIS && best <= (legW / 2) * Math.SQRT2 + ARRIS,
          `${label}: ${g.id}'s end is ${(best * IN_PER_FT).toFixed(3)} in off the nearest leg's axis — `
          + `a 6x6's surface is ${(legW / 2 * IN_PER_FT).toFixed(2)} to ${((legW / 2) * Math.SQRT2 * IN_PER_FT).toFixed(2)} in out`);
      }
    }
  }
});

test('and the TOP girt carries the platform instead of running through it', () => {
  // It was at the leg tops, which is the deck SURFACE — ten inches above where a bearing girt
  // goes, and therefore through every joist, the deck, the cab posts and the railing's feet.
  for (const opts of OPTIONS) {
    const { model, girts } = tower(opts);
    const label = JSON.stringify(opts);
    const joists = model.members.filter((m) => m.role === 'joist');
    assert.ok(joists.length >= 4, `${label}: ${joists.length} platform joists`);
    const topGirt = Math.max(...girts.map((m) => box(m).y[1]));
    const joistLo = Math.min(...joists.map((m) => box(m).y[0]));
    assert.ok(Math.abs(topGirt - joistLo) < 1e-9,
      `${label}: the top girt tops out at ${topGirt.toFixed(4)} and the joists start at ${joistLo.toFixed(4)} — `
      + `${((topGirt - joistLo) * IN_PER_FT).toFixed(4)} in of one inside the other`);
    // Nothing the platform or the railing puts on the deck shares wood with a girt.
    const above = model.members.filter((m) =>
      ['joist', 'subfloor', 'post', 'railPost', 'railTop', 'railMid', 'toeBoard'].includes(m.role));
    for (const g of girts) {
      for (const a of above) {
        const s = gap(g, a);
        assert.ok(s >= -1e-9,
          `${label}: ${g.id} and ${a.id} (${a.role}) share ${(-s * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and every bay on every face still has its girt', () => {
  // The guard on the whole change: a girt cut to nothing, or a bay left untied, would pass every
  // clearance test above by not being there.
  for (const opts of OPTIONS) {
    const { model, girts } = tower(opts);
    const label = JSON.stringify(opts);
    const braces = model.members.filter((m) => m.role === 'towerBrace');
    // Two diagonals per face per bay, one girt per face per bay.
    assert.equal(girts.length * 2, braces.length,
      `${label}: ${girts.length} girts and ${braces.length} braces — a face-bay carries one girt and two diagonals`);
    assert.equal(girts.length % 4, 0, `${label}: ${girts.length} girts is not four faces' worth`);
    const heights = [...new Set(girts.map((m) => Math.round(m.position[1] * 1e6) / 1e6))];
    assert.equal(heights.length, girts.length / 4, `${label}: girts are not level round the tower`);
    for (const g of girts) {
      assert.ok(g.cutLength > 12, `${label}: ${g.id} is ${g.cutLength.toFixed(2)} in long — that is not a girt`);
    }
  }
});
