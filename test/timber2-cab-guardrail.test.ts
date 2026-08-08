// The guard tower's platform railing, against the cab frame standing on the same corners.
//
// ONE POST PER HOLE — ACROSS PASSES, NOT JUST WITHIN ONE. `railings.ts` has de-duplicated its own
// posts by position since the day two edges meeting at a corner were found each setting one there.
// That set only sees inside the railing pass. The cab's four 4x4 corner posts stand on the deck's
// own corners and are emitted by `tower.ts` AFTER the railing has run, so the railing put its own
// 4x4 in every one of those holes. Measured on the shipped preset, and on all three cab options:
//
//   RL-railPost-01 into TW-post-01     3.50 in     two 4x4s entirely inside each other,
//                                                  over 3 ft 8 in of height, four times
//   railTop / railMid / toeBoard       1.75 in     into the post at each end of each edge
//                                                  — 28 pairs in all
//
// The fix is not to move the railing off the corner: the corner is where a guardrail post belongs.
// It is to tell the railing what the frame has already stood there, so it emits no post of its own
// and lands its rails on the faces of what is — the joint a rail nailed to a corner post makes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { generateRailing, type RailEdge } from '../src/timber/subsystems/railings';
import { IN_PER_FT } from '../src/timber/doctrine';
import { DRESSED } from '../src/timber/types';
import type { Member } from '../src/timber/types';

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
  return [a, y, b];
}

type Obb = { c: V3; ax: V3[]; h: number[] };
const obbOf = (m: Member): Obb => ({
  c: [m.position[0], m.position[1], m.position[2]],
  ax: [rotate(m, [1, 0, 0]), rotate(m, [0, 1, 0]), rotate(m, [0, 0, 1])],
  h: [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24],
});
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2]);

/**
 * The widest separating gap between two oriented boxes, feet. Positive is clear, zero is face to
 * face, negative is shared wood. Every piece here is an uncut box yawed by a multiple of a right
 * angle, so this is exact for all of them.
 */
function gap(a: Obb, b: Obb): number {
  const axes: V3[] = [...a.ax, ...b.ax];
  for (const u of a.ax) for (const v of b.ax) { const c = cross(u, v); if (norm(c) > 1e-9) axes.push(c); }
  let best = -Infinity;
  const d: V3 = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]];
  for (const raw of axes) {
    const L = norm(raw);
    if (L < 1e-9) continue;
    const n: V3 = [raw[0] / L, raw[1] / L, raw[2] / L];
    const ra = a.h.reduce((s, h, i) => s + h * Math.abs(dot(a.ax[i]!, n)), 0);
    const rb = b.h.reduce((s, h, i) => s + h * Math.abs(dot(b.ax[i]!, n)), 0);
    best = Math.max(best, Math.abs(dot(d, n)) - ra - rb);
  }
  return best;
}

const CAB_WALLS = ['open-rail', 'half-wall', 'half-wall-screen'];
const TOL = 1e-9;

function tower(walls: string) {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset)) as Record<string, unknown>;
  spec.cab = { ...(spec.cab as object), walls };
  const model = generateStructure(spec as never);
  const deckY = spec.platformHeightFt as number;
  return {
    model,
    deckY,
    rail: model.members.filter((m) => m.id.startsWith('RL-')),
    // The cab's corner posts: the 4x4 posts standing above the deck. The cab always has them —
    // they carry the roof whether or not the cab has walls, which is why open-rail is in here.
    cabPosts: model.members.filter((m) => m.role === 'post' && m.nominal === '4x4'
      && m.position[1] > deckY + 1),
  };
}

test('NO GUARDRAIL MEMBER SHARES WOOD WITH A CAB POST — there were four posts in four holes', () => {
  for (const walls of CAB_WALLS) {
    const { rail, cabPosts } = tower(walls);
    assert.equal(cabPosts.length, 4, `${walls}: the cab has four corner posts`);
    assert.ok(rail.length > 8, `${walls}: the deck is railed at all (${rail.length} pieces)`);
    for (const r of rail) {
      for (const p of cabPosts) {
        const d = gap(obbOf(r), obbOf(p));
        assert.ok(d > -TOL,
          `${walls}: ${r.id} (${r.role}) and ${p.id} share ${(-d * IN_PER_FT).toFixed(2)} in of wood`);
      }
    }
  }
});

test('and every rail LANDS on one — the guard is not shortened off the corner', () => {
  // Clearing the posts by pulling the rails back would pass the test above and leave a gap at
  // every corner of a 16-ft platform. Each run must touch the post it is nailed to: on this deck
  // every span ends on a corner except at the access gap, so every rail meets at least one.
  for (const walls of CAB_WALLS) {
    const { rail, cabPosts } = tower(walls);
    const runs = rail.filter((m) => m.role === 'railTop' || m.role === 'railMid' || m.role === 'toeBoard');
    assert.ok(runs.length >= 12, `${walls}: ${runs.length} rail runs`);
    for (const r of runs) {
      const nearest = Math.min(...cabPosts.map((p) => gap(obbOf(r), obbOf(p))));
      assert.ok(Math.abs(nearest) < TOL,
        `${walls}: ${r.id} stops ${(nearest * IN_PER_FT).toFixed(3)} in clear of every cab post`);
    }
  }
});

test('the corners are still posted — by the cab, which was always going to post them', () => {
  for (const walls of CAB_WALLS) {
    const { model, deckY, cabPosts } = tower(walls);
    const deckPanels = model.members.filter((m) => m.role === 'subfloor' && Math.abs(m.position[1] - deckY) < 0.2);
    assert.ok(deckPanels.length > 0, `${walls}: the platform is decked`);
    const xs = deckPanels.flatMap((m) => [m.position[0] - m.cutLength / 24, m.position[0] + m.cutLength / 24]);
    const zs = deckPanels.flatMap((m) => [m.position[2] - m.actual.d / 24, m.position[2] + m.actual.d / 24]);
    for (const x of [Math.min(...xs), Math.max(...xs)]) {
      for (const z of [Math.min(...zs), Math.max(...zs)]) {
        const posted = cabPosts.some((p) => Math.hypot(p.position[0] - x, p.position[2] - z) < 1e-6);
        assert.ok(posted, `${walls}: no post stands at the deck corner (${x.toFixed(3)}, ${z.toFixed(3)})`);
      }
    }
  }
});

test('`standing` IS OPT-IN — a railing told nothing posts its corners exactly as it always did', () => {
  // `railings.ts` serves the loading platform too, which has no cab and passes no `standing`. The
  // new field must be inert when it is absent, or this fix travels to a family it was never about.
  const square: RailEdge[] = [
    { id: 'a', from: [0, 0], to: [8, 0] },
    { id: 'b', from: [8, 0], to: [8, 8] },
    { id: 'c', from: [8, 8], to: [0, 8] },
    { id: 'd', from: [0, 8], to: [0, 0] },
  ];
  const plain = generateRailing({ edges: square, deckY: 10, stage: 3 });
  // AT THE CORNER, WHICH IS NOT THE CORNER POINT. A rail is nailed to a post's face, so the post
  // steps back off the rail line by half of each — and a corner post steps back off BOTH runs,
  // diagonally. The claim here is that the railing posts its own corner when nothing else does;
  // the coordinate it used to look at was the rail's line, not the post's.
  const inset = (DRESSED['4x4']!.w + DRESSED['2x4']!.w) / 2 / IN_PER_FT;
  const corners = plain.filter((m) => m.role === 'railPost'
    && Math.abs(m.position[0] - inset) < 1e-9 && Math.abs(m.position[2] - inset) < 1e-9);
  assert.equal(corners.length, 1, 'with nothing standing, the railing posts the corner itself');
  const topsPlain = plain.filter((m) => m.role === 'railTop');
  assert.equal(topsPlain.length, 4);
  // Corner to corner LESS the arris: two runs meeting at a corner used to run to the same point,
  // so each was half its own thickness inside the other. Trimmed by half a thickness apiece they
  // butt on the arris, which is the joint two boards round a corner actually make.
  const railT = DRESSED['2x4']!.w / IN_PER_FT;
  for (const t of topsPlain) {
    assert.ok(Math.abs(t.cutLength / IN_PER_FT - (8 - railT)) < 1e-9,
      `its rails run ${(t.cutLength / IN_PER_FT).toFixed(4)} ft, not the 8 ft edge less a thickness at each corner`);
  }

  // Told about a post at one corner, it skips that hole and lands the two rails meeting there on
  // the post's faces — half its width off each, and nothing else changes.
  const wide = DRESSED['4x4']!.w / IN_PER_FT;
  const told = generateRailing({
    edges: square, deckY: 10, stage: 3,
    standing: [{ at: [0, 0], widthFt: wide }],
  });
  assert.equal(told.filter((m) => m.role === 'railPost'
    && Math.abs(m.position[0]) < 1e-9 && Math.abs(m.position[2]) < 1e-9).length, 0,
  'told a post is standing there, the railing does not add a second one');
  // Half the POST's width at that corner and half a RAIL's at the other — whichever end stops on
  // what: a standing 4x4 takes 1¾ in, the arris of the run round the far corner takes ¾.
  const shortened = told.filter((m) => m.role === 'railTop')
    .filter((m) => Math.abs(m.cutLength / IN_PER_FT - (8 - wide / 2 - railT / 2)) < 1e-9);
  assert.equal(shortened.length, 2, 'the two rails meeting that corner stop on its faces');
  assert.equal(told.filter((m) => m.role === 'railTop').length, 4, 'and the other two are untouched');
});
