// Cross bridging, and the fact that a board has width.
//
// A row of cross bridging is two boards per bay, each running from the top of one joist to the
// bottom of the next. Both floor generators pitched the CENTRELINE across the whole joist depth —
// `const rise = joistD - inset` — and a board of face width `d` pitched at `a` stands `d / cos a`
// taller than its own centreline. So every piece stood 0.78 in outside the joists at BOTH ends:
//
//   698 pieces, eight of the fourteen shipped cards, 1x3 at 24.24° between 2x8 joists
//     1396 corners  0.780 in below the joist soffit — a sawtooth along the whole underside
//      698 pairs    through the SUBFLOOR, the corner passing out the top of the finished floor
//      698 pairs    0.536 in into the joist beside them (0.938 on the squad hut's short bay)
//
// It renders exactly like that: a cutaway elevation of the floor band shows tips above the joist
// line and a serrated edge below it, in every bay of every row.
//
// The fix is the pitch that fits the BOARD in the band rather than its centreline, which is a
// quadratic — `bridgingRise.ts` derives it. The pieces stay where they were and stay the same
// count; they get shallower (15.2°) and shorter. Both generators take it, because both had it.
//
// This was recorded in the sweep as **"It cannot be fixed"** — `floor.ts` is the frozen legacy and
// `timber2-compat.test.ts` opens by forbidding golden updates. It is a compat-lock event, and the
// blast radius is exactly what a compat-lock event has to be able to state:
//
//   34 of 84 frame fixtures touched; 2728 members changed, 0 added, 0 removed
//   every one of them role `bridging`; the only fields that moved are cutLength and rotation

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { IN_PER_FT, TOLERANCE } from '../src/timber/doctrine';
import { crossBridgingRise } from '../src/timber/bridgingRise';
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

/** The member's vertical span, corners included — the whole point of the fix. */
function yRange(m: Member): [number, number] {
  const h = halfExtents(m);
  const ys: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    ys.push(m.position[1] + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[1]);
  }
  return [Math.min(...ys), Math.max(...ys)];
}

/** Every shipped card that gets bridging, with the joists and decking around it. */
function bridged(): { id: string; pieces: Member[]; joists: Member[]; deck: Member[] }[] {
  const out: { id: string; pieces: Member[]; joists: Member[]; deck: Member[] }[] = [];
  for (const f of shippedFamilies()) {
    const ms = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const pieces = ms.filter((m) => m.role === 'bridging');
    if (!pieces.length) continue;
    out.push({
      id: f.id,
      pieces,
      joists: ms.filter((m) => ['joist', 'rimJoist'].includes(m.role)),
      deck: ms.filter((m) => ['subfloor', 'deckPlank'].includes(m.role)),
    });
  }
  assert.ok(out.length >= 6, `${out.length} shipped cards carry bridging`);
  return out;
}

/** The joists a piece runs between: the ones whose own vertical span it sits inside. */
function joistsAround(piece: Member, joists: Member[]): Member[] {
  const [lo, hi] = yRange(piece);
  const mid = (lo + hi) / 2;
  return joists.filter((j) => { const [a, b] = yRange(j); return mid > a && mid < b; });
}

test('A BRIDGING BOARD FITS BETWEEN THE JOISTS — every one used to stand 0.78 in outside them', () => {
  for (const { id, pieces, joists } of bridged()) {
    for (const p of pieces) {
      const near = joistsAround(p, joists);
      assert.ok(near.length > 0, `${id}: ${p.id} is at no joist's level at all`);
      const top = Math.max(...near.map((j) => yRange(j)[1]));
      const soffit = Math.min(...near.map((j) => yRange(j)[0]));
      const [lo, hi] = yRange(p);
      assert.ok(hi <= top + 1e-9,
        `${id}: ${p.id} stands ${((hi - top) * IN_PER_FT).toFixed(3)} in above the joist tops`);
      assert.ok(lo >= soffit - 1e-9,
        `${id}: ${p.id} hangs ${((soffit - lo) * IN_PER_FT).toFixed(3)} in below the joist soffit`);
    }
  }
});

test('and so it is not through the floor you walk on', () => {
  // The visible half. A corner 0.78 in above the joist top is a corner out the TOP of a ¾-in
  // subfloor, which is why the deck is asserted separately from the joists it is nailed to.
  for (const { id, pieces, deck } of bridged()) {
    assert.ok(deck.length > 0, `${id}: no decking over the joists`);
    for (const p of pieces) {
      for (const d of deck) {
        const g = gap(p, d);
        assert.ok(g >= -1e-9,
          `${id}: ${p.id} is ${(-g * IN_PER_FT).toFixed(3)} in into ${d.id} — through the finished floor`);
      }
    }
  }
});

test('and it still REACHES both joists — the pitch gave, the bearing did not', () => {
  // The guard on the other direction. Shortening the boards until they cleared everything would
  // pass the two tests above and leave a row of loose sticks braced against nothing.
  for (const { id, pieces, joists } of bridged()) {
    for (const p of pieces) {
      const near = joistsAround(p, joists).filter((j) => gap(p, j) <= 1e-6);
      assert.ok(near.length >= 2,
        `${id}: ${p.id} touches ${near.length} of the joists at its level — bridging bears on two`);
    }
    // And the piece is still a diagonal: a crossed pair pitches equally, both ways.
    const pitches = new Set(pieces.map((p) => Math.round(Math.abs(p.rotation[2]) * 1e9)));
    for (const q of pitches) assert.ok(q > 0, `${id}: a bridging board came out flat`);
    assert.equal(pieces.filter((p) => p.rotation[2] > 0).length, pieces.length / 2,
      `${id}: the boards do not come in opposed pairs`);
  }
});

test('and the rise is the one that solves the fit, not a pitch that happens to clear', () => {
  // The derivation itself, at the sizes the catalog actually uses. `R + d·hypot(G,R)/G` is the
  // finished piece's vertical span; it must land ON the band, not merely inside it, or the boards
  // are shallower than they need to be and stop bracing anything.
  const band = 7.25 / IN_PER_FT - TOLERANCE.bridgingInsetFt; // a 2x8 joist, less the clearance
  for (const gapFt of [14.5 / IN_PER_FT, 22.5 / IN_PER_FT, 6 / IN_PER_FT]) {
    for (const boardW of [2.5 / IN_PER_FT, 3.5 / IN_PER_FT]) {
      const r = crossBridgingRise(gapFt, boardW, band);
      assert.ok(r > 0, `${(gapFt * IN_PER_FT).toFixed(1)} in bay: no rise solved`);
      const span = r + (boardW * Math.hypot(gapFt, r)) / gapFt;
      assert.ok(Math.abs(span - band) < 1e-12,
        `${(gapFt * IN_PER_FT).toFixed(1)} in bay, ${(boardW * IN_PER_FT).toFixed(1)} in board: the piece spans `
        + `${(span * IN_PER_FT).toFixed(4)} in of a ${(band * IN_PER_FT).toFixed(4)} in band`);
    }
  }
  // A band no deeper than the board is wide has no diagonal in it, and the caller emits nothing
  // rather than a piece that cannot be cut.
  assert.equal(crossBridgingRise(1, 0.5, 0.5), 0);
  assert.equal(crossBridgingRise(1, 0.5, 0.4), 0);
  assert.equal(crossBridgingRise(0, 0.2, 0.5), 0);
});
