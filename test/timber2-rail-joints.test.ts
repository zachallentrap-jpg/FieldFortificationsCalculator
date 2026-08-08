// Where a guardrail's pieces meet each other.
//
// A RAIL IS NAILED TO A POST'S FACE, SO THE TWO CANNOT BE ON ONE LINE. `railings.ts` already knew
// it — `standingHalf` stops a rail on the face of any post the FRAME stands at a span's end, and
// says why in so many words: "run to the centreline instead and the rail is half a post deep
// inside it". Its OWN posts, at every interval along every run, were passed straight through, and
// `access.ts` had the same line copied for a stair's raked rails:
//
//   loading platform  53 pairs, worst 2.50 in     guard tower  6, worst 1.75
//   the platform's ramp stair    8 pairs, 2.50 in
//
// AND TWO RUNS MEETING AT A CORNER both ran to the corner POINT, so each was half its own
// thickness inside the other — 12 more pairs on the platform, top rail, mid rail and toe board
// alike, at every corner where the frame does not already stand a post.
//
// The RAIL line is the one that cannot move: it is the deck edge, the toe board's line, the gap
// the access opens, and on a tower the line the stair's bridge landing meets. So the POST steps
// back off it — which is also where a post belongs, since standing on the deck edge it had half
// its own foot over the drop — and a corner post steps back off BOTH runs, diagonally.
//
//   post inside a rail, whole catalog   59 -> 0        rail inside a rail   12 -> 0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { RAIL, IN_PER_FT } from '../src/timber/doctrine';
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
 * Least separation over the 15 separating axes. Positive is a TRUE clearance — a stair's rails are
 * raked, and the box round one spans its whole climb.
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

const RAILS = ['railTop', 'railMid', 'toeBoard'];

/** Every shipped card that carries a guardrail, and its rail members. */
function railed(): { id: string; posts: Member[]; rails: Member[] }[] {
  const out: { id: string; posts: Member[]; rails: Member[] }[] = [];
  for (const f of shippedFamilies()) {
    const ms = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const posts = ms.filter((m) => m.role === 'railPost');
    if (!posts.length) continue;
    out.push({ id: f.id, posts, rails: ms.filter((m) => RAILS.includes(m.role)) });
  }
  assert.ok(out.length >= 2, `${out.length} railed cards in the catalog`);
  return out;
}

test('A RAIL LANDS ON A POST\'S FACE — every one used to run straight through', () => {
  for (const { id, posts, rails } of railed()) {
    assert.ok(rails.length >= 3, `${id}: ${rails.length} rail members`);
    for (const p of posts) {
      for (const r of rails) {
        const g = gap(p, r);
        assert.ok(g >= -1e-6, `${id}: ${p.id} and ${r.id} (${r.role}) share ${(-g * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and two runs meeting at a corner butt on the arris, not through each other', () => {
  for (const { id, rails } of railed()) {
    for (let i = 0; i < rails.length; i++) {
      for (let j = i + 1; j < rails.length; j++) {
        const g = gap(rails[i]!, rails[j]!);
        assert.ok(g >= -1e-6,
          `${id}: ${rails[i]!.id} and ${rails[j]!.id} share ${(-g * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and the post steps back by half of each — no further, and never off its deck', () => {
  // The guard on the setback: it is a joint, not a repositioning. A post that stepped back by
  // more would leave a gap behind the rail; one that stepped back by less would still be in it.
  const inset = (DRESSED[RAIL.postNominal.value as string]!.w / IN_PER_FT
    + DRESSED[RAIL.memberNominal.value as string]!.w / IN_PER_FT) / 2;
  for (const { id, posts, rails } of railed()) {
    for (const p of posts) {
      // The nearest rail is the one it carries; a nailed lap has them touching, not apart.
      const near = Math.min(...rails.map((r) => gap(p, r)));
      assert.ok(near <= 1e-6,
        `${id}: ${p.id} stands ${(near * IN_PER_FT).toFixed(3)} in clear of every rail — it carries none of them`);
    }
    // And a level run's posts are exactly one setback off their rail's line, measured across it.
    for (const r of rails.filter((m) => Math.abs(m.rotation[2]) < 1e-9)) {
      const across = rotate(r, [0, 0, 1]);
      const mine = posts.filter((p) => gap(p, r) <= 1e-6 && gap(p, r) > -1e-6);
      for (const p of mine) {
        const d: V3 = [p.position[0] - r.position[0], 0, p.position[2] - r.position[2]];
        const off = Math.abs(dot(d, across));
        assert.ok(Math.abs(off - inset) < 1e-9,
          `${id}: ${p.id} sits ${(off * IN_PER_FT).toFixed(3)} in off ${r.id}'s line, not the `
          + `${(inset * IN_PER_FT).toFixed(2)} in half a post and half a rail come to`);
      }
    }
  }
});

test('and the rails are still at the heights EM 385-1-1 puts them', () => {
  // The guard that moving the posts did not move what they carry. The rail line is the piece of
  // this that a person's life depends on, and it is the piece that did not change.
  const topH = (RAIL.topHeightIn.value as number) / IN_PER_FT;
  const midH = (RAIL.midHeightIn.value as number) / IN_PER_FT;
  for (const { id, posts, rails } of railed()) {
    for (const [role, want] of [['railTop', topH], ['railMid', midH]] as const) {
      // Level runs only: a stair's rails are raked and measured plumb off the nosing line, which
      // climbs. Each run's datum is the foot of the posts that carry IT — a platform with a ramp
      // has several walking surfaces and one minimum over all of them is none of their decks.
      const level = rails.filter((m) => m.role === role && Math.abs(m.rotation[2]) < 1e-9);
      assert.ok(level.length > 0, `${id}: no level ${role} at all`);
      for (const r of level) {
        const mine = posts.filter((p) => gap(p, r) <= 1e-6 && gap(p, r) > -1e-6);
        if (!mine.length) continue;
        const deck = Math.min(...mine.map((p) => p.position[1] - p.cutLength / 24));
        assert.ok(Math.abs(r.position[1] - (deck + want)) < 1e-9,
          `${id}: ${r.id} is ${((r.position[1] - deck) * IN_PER_FT).toFixed(3)} in over the surface its posts `
          + `stand on, not the ${(want * IN_PER_FT).toFixed(0)} EM 385-1-1 puts it at`);
      }
    }
  }
});
