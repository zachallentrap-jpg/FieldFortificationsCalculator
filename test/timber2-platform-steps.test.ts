// The loading platform's entry steps, against the deck they climb to.
//
// A STAIR IS POSITIONED BY WHERE YOU STEP OFF IT. The platform stated the departure instead: the
// foot was planted a guessed foot beyond the deck (`base: [L + 1, W/2]`) and the flight aimed
// back at the platform. A 4-ft rise wants 4 ft 2 in of run, so the head finished three and a half
// feet INSIDE the footprint and the whole flight climbed UNDER the deck — each of the three
// stringers cutting 2⅜ in into the end joist and 1½ in into the decking, two of the stair's own
// rail posts spearing up through the planks, and on a skid base the middle stringer running
// 1¾ in through the middle runner as well. From outside it read as a stair that dead-ends into
// the underside of the platform.
//
// `arriveAt` is the same fix the tower's stair already carries, for the same reason.
//
// MEASURED ON THE CUT PIECE, NOT THE BLANK. A stair stringer's stock is square-cut at both ends
// and the sawtooth is taken out of it; the blank's head therefore overhangs the top nosing by a
// face width times the sine of the pitch — 7 in here — and a bounding box would report that as
// 7 in of stringer inside the deck whatever the generator does. `stairStringerProfile` is what
// the scene draws, so it is what these assertions read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import { stairStringerProfile } from '../src/timber/stringerCuts';
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

/**
 * The corners of the piece AS DRAWN: the cut profile where there is one, the blank otherwise.
 * The profile is a polygon in the member's own (length, face-width) plane; sweeping it the
 * member's thickness either way gives the solid the scene shows.
 */
function drawnCorners(m: Member): V3[] {
  const outline = (m.role === 'stringer' ? stairStringerProfile(m) : null) ?? ([
    [-m.cutLength / 24, -m.actual.d / 24], [m.cutLength / 24, -m.actual.d / 24],
    [m.cutLength / 24, m.actual.d / 24], [-m.cutLength / 24, m.actual.d / 24],
  ] as [number, number][]);
  const half = m.actual.w / 24;
  const out: V3[] = [];
  for (const [px, py] of outline) {
    for (const s of [-half, half]) {
      const r = rotate(m, [px, py, s]);
      out.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
    }
  }
  return out;
}

type Box = [[number, number], [number, number], [number, number]];

/** World box of a piece as drawn. */
function aabb(m: Member): Box {
  const pts = drawnCorners(m);
  const g = (i: number): [number, number] =>
    [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return [g(0), g(1), g(2)];
}

/** The widest gap between two world boxes: positive means apart, and by how much. */
const boxGap = (a: Box, b: Box): number =>
  Math.max(...[0, 1, 2].map((i) => Math.max(a[i]![0] - b[i]![1], b[i]![0] - a[i]![1])));

/**
 * The gap between a stair piece and a frame piece, by whichever measure is honest for it.
 *
 * A CUT stringer's stock is square at both ends and the sawtooth is taken out of it, so its
 * oriented box is not the piece — it holds 7 in of head that was cut off. For those the world
 * box of the DRAWN corners is the tightest sound bound. Everything else is a box already, and an
 * oriented box beats an axis-aligned one for anything raked: a world box round a raked rail spans
 * its whole climb and would report an inch of the deck's rim joist that the rail passes two feet
 * above. Both measures are supersets, so a positive gap from either is a proof.
 */
function stairGap(a: Member, b: Member): number {
  return a.role === 'stringer' && stairStringerProfile(a)
    ? boxGap(aabb(a), aabb(b))
    : clearance(obbOf(a), obbOf(b));
}

// ── Oriented-box separation, for the pieces that are not raked ──────────────────────────────
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
type Obb = { c: V3; ax: V3[]; h: number[] };
const obbOf = (m: Member): Obb => ({
  c: [m.position[0], m.position[1], m.position[2]],
  ax: [rotate(m, [1, 0, 0]), rotate(m, [0, 1, 0]), rotate(m, [0, 0, 1])],
  h: [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24],
});

/**
 * The widest separating gap between two oriented boxes, feet. Positive means DISJOINT and the
 * number is the true clearance. Negative does NOT prove a collision for a raked member whose
 * blank is later cut — which is why only the "they are apart" direction is asserted below.
 */
function clearance(a: Obb, b: Obb): number {
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

function platform(over: Record<string, unknown> = {}) {
  const spec = JSON.parse(JSON.stringify(familyById('platform')!.preset)) as Record<string, unknown>;
  Object.assign(spec, over);
  const model = generateStructure(spec as never);
  const dims = spec.dims as { lengthFt: number; widthFt: number };
  const members = model.members;
  // THE EDGE THE STAIR ARRIVES AT, taken off the frame rather than named: the outside face of
  // the rim joist, which is the piece a stringer's plumb head is hung on. The end joists are
  // centred on the grid line like every framing member here, so that face is half a joist proud
  // of the line — and asking the model for it is what keeps this test true if the joist changes.
  const rim = members.filter((m) => m.role === 'joist')
    .reduce((a, b) => (b.position[0] > a.position[0] ? b : a));
  return {
    spec,
    L: dims.lengthFt,
    W: dims.widthFt,
    deckY: spec.deckHeightFt as number,
    rimFace: rim.position[0] + rim.actual.w / 24,
    model,
    stair: members.filter((m) => m.id.startsWith('AC-')),
    deckRail: members.filter((m) => m.id.startsWith('RL-')),
  };
}

const TOL = 1e-9;

test('THE STEPS CLIMB TO THE DECK EDGE — the flight used to finish under the deck', () => {
  const { rimFace, L, stair } = platform();
  assert.ok(rimFace > L, 'the rim joist stands proud of the decking, which is what makes it the face');
  const stringers = stair.filter((m) => m.role === 'stringer');
  assert.equal(stringers.length, 3, 'the flight has its three stringers');
  for (const s of stringers) {
    assert.ok(stairStringerProfile(s), `${s.id} is not being read as a cut stair stringer`);
    const xs = drawnCorners(s).map((p) => p[0]);
    const head = Math.min(...xs);
    // Not one splinter of the cut piece is inside the platform…
    assert.ok(head >= rimFace - TOL,
      `${s.id} reaches ${((rimFace - head) * IN_PER_FT).toFixed(2)} in past the rim joist's face, into the deck`);
    // …and it does not stand off it either: the plumb head cut LANDS on the rim it hangs from.
    assert.ok(head <= rimFace + TOL,
      `${s.id} stops ${((head - rimFace) * IN_PER_FT).toFixed(2)} in short of the rim joist, hanging on nothing`);
  }
  // Every tread is outside too. The top surface of the flight is the deck itself, so the highest
  // tread is one riser down and one run out — nothing of it belongs over the platform.
  for (const t of stair.filter((m) => m.role === 'tread')) {
    const xs = drawnCorners(t).map((p) => p[0]);
    assert.ok(Math.min(...xs) >= rimFace - TOL,
      `${t.id} lies ${((rimFace - Math.min(...xs)) * IN_PER_FT).toFixed(2)} in inside the deck footprint`);
  }
});

test('and the flight clears the frame it arrives at — joists, decking, sills, posts', () => {
  // Measured on the world box of the DRAWN corners, which for a cut stringer is the sawtooth and
  // for everything else is the piece itself. A box is a superset of what it holds, so a positive
  // gap between two boxes is a proof the solids are apart; that is the only direction claimed.
  //
  // Rail posts are excluded and say why: `railings.ts` sets every post — the deck's own included
  // — centred on the edge line and dipping one post depth below the walking surface, so it is
  // bolted to the rim rather than balanced on the planks. The stair's newel does the same thing
  // at the same edge; the test for that is below, and it compares the newel to the deck's own
  // posts rather than asserting against the module's convention.
  const { model, stair } = platform();
  const frame = model.members.filter((m) => !m.id.startsWith('AC-')
    && ['joist', 'sill', 'deckPlank', 'subfloor', 'post', 'footing', 'skid'].includes(m.role));
  assert.ok(frame.length > 20, 'the platform has a frame to clear');
  for (const s of stair.filter((m) => m.role !== 'railPost')) {
    for (const f of frame) {
      const gap = stairGap(s, f);
      assert.ok(gap > -TOL,
        `${s.id} (${s.role}) runs ${(-gap * IN_PER_FT).toFixed(2)} in into ${f.id} (${f.role})`);
    }
  }
});

test('ON SKIDS THE FLIGHT CLEARS THE RUNNERS, which stand 5½ in proud of grade', () => {
  // The runners lie ON grade — that is what putting a platform on skids means — and the middle
  // one runs the full length dead under the centre line the stair descends. With the flight
  // aimed from a guessed foot one foot off the deck, its middle stringer met the runner's end
  // corner 1¾ in below the top of it and carried straight through. A pier base hides the same
  // aiming error, because a pier base leaves nothing at grade to hit.
  const { model, stair, L } = platform({ base: 'skids' });
  const skids = model.members.filter((m) => m.role === 'skid');
  assert.equal(skids.length, 3, 'three runners under a platform on skids');
  assert.ok(skids.some((s) => Math.abs(s.position[2] - platform().W / 2) < TOL),
    'one runner is on the centre line the stair descends');
  for (const s of stair) {
    for (const k of skids) {
      const gap = stairGap(s, k);
      assert.ok(gap > -TOL, `${s.id} (${s.role}) runs ${(-gap * IN_PER_FT).toFixed(2)} in into ${k.id}`);
    }
  }
  // And the runners still end where the deck does — the flight cleared them by moving, not by
  // the runners being cut short.
  for (const k of skids) {
    assert.ok(Math.abs(k.cutLength / IN_PER_FT - L) < TOL, `${k.id} is not a full-length runner`);
  }
});

test('THE RAIL OPENS WHERE THE STAIR LANDS, and the two rails meet at one newel', () => {
  const { L, W, rimFace, stair, deckRail } = platform();
  const newels = stair.filter((m) => m.role === 'railPost' && Math.abs(m.position[0] - rimFace) < TOL);
  assert.equal(newels.length, 2, 'the flight arrives between two head posts');
  const deckPosts = deckRail.filter((m) => m.role === 'railPost' && Math.abs(m.position[0] - L) < TOL);
  // A closed rail on the arrival edge is the tower's old fault: a stair delivering people into
  // a guardrail. The gap shows up as posts at its ends, so the edge carries four, not two.
  assert.equal(deckPosts.length, 4, `the E-edge rail has ${deckPosts.length} posts — it is not opened for the stair`);
  const zs = deckPosts.map((m) => m.position[2]).sort((a, b) => a - b);
  assert.ok(Math.abs(zs[0]! - 0) < TOL && Math.abs(zs[3]! - W) < TOL, 'the rail still runs corner to corner');

  // No rail member of either pass may occupy another's wood — the failure this gap width exists
  // to avoid is two 4x4 posts in one hole, which is what a gap cut to the bare stair width gives.
  for (const a of stair.filter((m) => m.role.startsWith('rail'))) {
    for (const b of deckRail.filter((m) => m.role.startsWith('rail'))) {
      const gap = clearance(obbOf(a), obbOf(b));
      assert.ok(gap > -TOL, `${a.id} runs ${(-gap * IN_PER_FT).toFixed(2)} in into ${b.id}`);
    }
  }
  // And they are not standing apart either: each newel butts face to face on the deck rail's
  // terminal post, which is the joint a newel actually makes.
  for (const n of newels) {
    const nearest = Math.min(...deckPosts.map((p) => clearance(obbOf(n), obbOf(p))));
    assert.ok(nearest < TOL + 1e-9,
      `the newel at z=${n.position[2].toFixed(3)} stands ${(nearest * IN_PER_FT).toFixed(2)} in clear of the deck rail`);
  }
});

test('the newel is set exactly as the deck sets its own rail posts', () => {
  // Not a constant: the stair's head post and the platform's perimeter posts are the same
  // detail, so they are compared to each other. If `railings.ts` ever changes how a post meets
  // a deck edge, this moves with it instead of pinning a number that used to be true.
  const { rimFace, stair, deckRail } = platform();
  const newel = stair.find((m) => m.role === 'railPost' && Math.abs(m.position[0] - rimFace) < TOL)!;
  assert.ok(newel, 'the flight has a head post');
  const deckPost = deckRail.find((m) => m.role === 'railPost')!;
  assert.equal(newel.nominal, deckPost.nominal, 'a newel is the same stick as a deck post');
  assert.ok(Math.abs(newel.cutLength - deckPost.cutLength) < 1e-9,
    `the newel is ${(newel.cutLength / IN_PER_FT).toFixed(3)} ft and a deck post is `
    + `${(deckPost.cutLength / IN_PER_FT).toFixed(3)} ft`);
  assert.ok(Math.abs(newel.position[1] - deckPost.position[1]) < 1e-9,
    'the newel does not stand at the same height as the deck rail it continues');
});

test('no steps means no opening — the rail closes the edge it is asked to close', () => {
  // The gap is not a property of the E edge, it is a property of a stair landing on it. Turn the
  // steps off and the guardrail must run that edge unbroken, which is what a rail is for.
  const covers = (p: ReturnType<typeof platform>, z: number): boolean =>
    p.deckRail.some((m) => m.role === 'railTop' && Math.abs(m.position[0] - p.L) < 0.5
      && aabb(m)[2]![0] - TOL <= z && z <= aabb(m)[2]![1] + TOL);
  const off = platform({ steps: false });
  assert.equal(off.model.members.filter((m) => m.id.startsWith('AC-')).length, 0, 'steps off means no flight');
  assert.ok(covers(off, off.W / 2), 'with no stair the E edge is left open anyway');
  const on = platform();
  assert.ok(!covers(on, on.W / 2), 'the stair lands into a closed guardrail');
});
