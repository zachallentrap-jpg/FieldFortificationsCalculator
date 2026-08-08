// Where a guardrail post's foot is.
//
// A POST STANDS ON THE SURFACE IT GUARDS AND FINISHES FLUSH WITH THE TOP RAIL. Both ends were set
// by one arithmetic slip, written once in `railings.ts` and copied into `access.ts` for the stair
// rails: the length was `topH + the POST's own face` and the centre was `deckY + topH / 2`. That is
// right at the TOP by coincidence — a 4x4 and a 2x4 are both 3½ in, so half the post's face happens
// to equal half the RAIL's depth — and wrong at the BOTTOM, where the other half of that extra put
// the foot 1¾ in below the walking surface. There it ran through the edge board of every deck and
// stopped in mid-air, landing on neither the deck nor the frame the nailing note says it is bolted
// to:
//
//   platform  42 real overlaps (SAT) on 15 posts, worst 2.46 in     guard tower  6 on 2, worst 2.50
//   after       2                                        1.09                    2         2.00
//
// The two that survive are a DIFFERENT question — where the post sits in plan, coincident with the
// stringer or the girt it is bolted to — and they are smaller than they were.
//
// What the post has to clear above the rail is half the RAIL's depth, so that is what both places
// now measure it from. The coincidence is not a reason to keep asking the wrong piece.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
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
 * Least separation over the 15 separating axes. Positive is a TRUE clearance. A stair stringer is
 * raked and an AABB round one spans its whole climb, so a box test calls every post on the flight
 * a collision — this is the only measure that can tell those apart.
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

function box(m: Member): { x: [number, number]; y: [number, number]; z: [number, number] } {
  const h = halfExtents(m);
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const RAILED = ['platform', 'tower'] as const;
const SURFACE = ['deckPlank', 'subfloor', 'joist', 'sill', 'tread', 'rimJoist'];

const railed = (id: (typeof RAILED)[number]) =>
  generateStructure(JSON.parse(JSON.stringify(familyById(id)!.preset)));

test('A RAIL POST STANDS ON THE DECK — its foot used to be 1 3/4 in under it', () => {
  for (const id of RAILED) {
    const model = railed(id);
    // The DECK's own railing, not the stair's: a stair post stands on the nosing line, which
    // climbs, and is measured by the collision test below rather than against one height.
    const posts = model.members.filter((m) => m.role === 'railPost' && m.id.startsWith('RL-')).map((m) => box(m));
    assert.ok(posts.length >= 2, `${id}: ${posts.length} deck rail posts`);
    const surf = model.members.filter((m) => ['deckPlank', 'subfloor'].includes(m.role)).map((m) => box(m));
    assert.ok(surf.length > 0, `${id}: no deck to stand on`);
    const deckTop = Math.max(...surf.map((b) => b.y[1]));
    for (const p of posts) {
      assert.ok(Math.abs(p.y[0] - deckTop) < 1e-9,
        `${id}: a rail post's foot is at ${p.y[0].toFixed(4)} and the deck surface is ${deckTop.toFixed(4)} — `
        + `${((deckTop - p.y[0]) * IN_PER_FT).toFixed(3)} in of post below the thing it stands on`);
    }
  }
});

test('and it finishes flush with the top rail, not a post-width past it', () => {
  // The other end of the same slip, and the reason it went unnoticed: the top came out right by
  // coincidence. Measured against the RAIL, so it stays right if either nominal ever changes.
  const proud = DRESSED[RAIL.memberNominal.value as string]!.d / IN_PER_FT / 2;
  for (const id of RAILED) {
    const model = railed(id);
    const posts = model.members.filter((m) => m.role === 'railPost' && m.id.startsWith('RL-')).map((m) => box(m));
    const tops = model.members.filter((m) => m.role === 'railTop' && m.id.startsWith('RL-')).map((m) => box(m));
    assert.ok(tops.length > 0, `${id}: no top rail`);
    const railTop = Math.max(...tops.map((b) => b.y[1]));
    for (const p of posts) {
      assert.ok(Math.abs(p.y[1] - railTop) < 1e-9,
        `${id}: a post tops out at ${p.y[1].toFixed(4)} and the top rail at ${railTop.toFixed(4)} — `
        + `${((p.y[1] - railTop) * IN_PER_FT).toFixed(3)} in of post standing past it`);
      assert.ok(Math.abs((p.y[1] - p.y[0]) - ((RAIL.topHeightIn.value as number) / IN_PER_FT + proud)) < 1e-9,
        `${id}: the post is ${((p.y[1] - p.y[0]) * IN_PER_FT).toFixed(2)} in long — the rail height plus `
        + `half the rail's own depth is ${(((RAIL.topHeightIn.value as number) / IN_PER_FT + proud) * IN_PER_FT).toFixed(2)}`);
    }
  }
});

test('and no rail post is inside the floor it stands on — deck, joist, sill or tread', () => {
  // Measured with SAT, and the stringers are deliberately in it: a stair post IS bolted to its
  // stringer and they are coincident in plan, which is a question about where the post sits ACROSS
  // the flight, not about how far its foot drops. That one is written up rather than smuggled in.
  for (const id of RAILED) {
    const model = railed(id);
    const posts = model.members.filter((m) => m.role === 'railPost');
    const floor = model.members.filter((m) => SURFACE.includes(m.role));
    assert.ok(posts.length >= 2 && floor.length > 4, `${id}: ${posts.length} posts, ${floor.length} floor pieces`);
    for (const p of posts) {
      for (const f of floor) {
        const g = gap(p, f);
        assert.ok(g >= -1e-9,
          `${id}: ${p.id} and ${f.id} (${f.role}) share ${(-g * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and the rails themselves did not move — 42, 21 and a toe board clear of the deck', () => {
  // The guard on the fix. Raising a post's foot is only right if the thing bolted to it stayed
  // where EM 385-1-1 puts it; a post is easy to move by changing the wrong end.
  for (const id of RAILED) {
    const model = railed(id);
    const surf = model.members.filter((m) => ['deckPlank', 'subfloor'].includes(m.role)).map((m) => box(m));
    const deckTop = Math.max(...surf.map((b) => b.y[1]));
    const centre = (role: string): number[] => model.members
      .filter((m) => m.role === role && m.id.startsWith('RL-'))
      .map((m) => { const b = box(m); return ((b.y[0] + b.y[1]) / 2 - deckTop) * IN_PER_FT; });
    for (const [role, want] of [['railTop', RAIL.topHeightIn.value as number],
      ['railMid', RAIL.midHeightIn.value as number]] as const) {
      const hs = centre(role);
      assert.ok(hs.length > 0, `${id}: no ${role}`);
      for (const h of hs) {
        assert.ok(Math.abs(h - want) < 1e-6,
          `${id}: a ${role} sits ${h.toFixed(3)} in over the deck, not the ${want} doctrine gives it`);
      }
    }
    const toes = model.members.filter((m) => m.role === 'toeBoard' && m.id.startsWith('RL-')).map((m) => box(m));
    for (const t of toes) {
      assert.ok(t.y[0] >= deckTop - 1e-9,
        `${id}: a toe board starts at ${t.y[0].toFixed(4)}, below the deck at ${deckTop.toFixed(4)}`);
    }
  }
});
