// Two let-in braces on one wall, where they meet.
//
// A LET-IN BRACE IS LET INTO THE STUD FACES, so every brace on a wall lives in the same ¾-in slot.
// `walls.ts` puts one at each end and runs each out to `min(clear, studLen)` — which on any wall
// shorter than twice the stud height means the two CROSS, and both boards are then in that one
// slot along the whole crossing:
//
//   latrine 12 x 8      N/S walls   3.46 ft of shared board      E/W walls   5.64 ft
//   storage shed 20x12  E/W walls   4.04 ft
//
// Rendered at the bracing stage it is an X on each end wall with the two diagonals fighting for
// the same pixels down their whole length. It is the guard tower's X-brace defect — *"both
// diagonals were drawn on the legs' own centre plane… inside EACH OTHER at the crossing"* — in the
// frozen wall generator, and it cannot be fixed the same way: the tower laid one diagonal on the
// other, and a LET-IN brace has nowhere to go. It has to stop.
//
// So the run is held to half the wall, less the overshoot a square end puts past its own
// centreline: a raked board's box reaches `d·sin(ang)/2` further along the wall than the line it
// is drawn on, and two braces run exactly to the middle would still share that twice over — 2.7 in
// on the latrine. The pair now butts at the top plate's centre, which is a brace pair somebody can
// cut, and the wall is braced both ways instead of once.
//
// COMPAT-LOCK EVENT. `walls.ts` is the frozen C-10 branch. The blast radius:
//
//   25 of 84 frame fixtures touched; 148 members changed, 0 added, 0 removed
//   every one of them role `brace`; cutLength, position and rotation, and nothing else

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { generateWalls } from '../src/timber/walls';
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

/** Every shipped card that carries let-in bracing, with its braces grouped by wall. */
function braced(): { id: string; walls: Map<string, Member[]> }[] {
  const out: { id: string; walls: Map<string, Member[]> }[] = [];
  for (const f of shippedFamilies()) {
    const braces = generateStructure(JSON.parse(JSON.stringify(f.preset))).members
      .filter((m) => m.role === 'brace');
    if (!braces.length) continue;
    const walls = new Map<string, Member[]>();
    for (const b of braces) {
      const k = b.wall ?? '?';
      walls.set(k, [...(walls.get(k) ?? []), b]);
    }
    out.push({ id: f.id, walls });
  }
  assert.ok(out.length >= 6, `${out.length} braced cards in the catalog`);
  return out;
}

test('TWO BRACES ON ONE WALL DO NOT SHARE ONE SLOT — they used to cross for feet at a time', () => {
  for (const { id, walls } of braced()) {
    for (const [wall, ms] of walls) {
      for (let i = 0; i < ms.length; i++) {
        for (let j = i + 1; j < ms.length; j++) {
          const g = gap(ms[i]!, ms[j]!);
          assert.ok(g >= -1e-9,
            `${id} ${wall}: ${ms[i]!.id} and ${ms[j]!.id} share ${(-g * IN_PER_FT).toFixed(3)} in of one `
            + 'let-in slot — a brace is let into the stud faces and cannot pass through another');
        }
      }
    }
  }
});

test('and where the wall is too short for two, they BUTT — not stop short of each other', () => {
  // The guard on the other direction, and the reason the overshoot is subtracted rather than a
  // round figure: shortening the braces until they merely cleared would leave the middle of every
  // short wall unbraced and the pair reading as two stubs.
  let butted = 0;
  for (const { id, walls } of braced()) {
    for (const [wall, ms] of walls) {
      if (ms.length !== 2) continue;
      const g = gap(ms[0]!, ms[1]!);
      if (g > 0.02) continue; // a long wall: the two never come near each other
      assert.ok(Math.abs(g) < 1e-9,
        `${id} ${wall}: the pair stands ${(g * IN_PER_FT).toFixed(4)} in apart at the apex — a butt joint touches`);
      butted++;
    }
  }
  assert.ok(butted >= 5, `${butted} walls short enough for the pair to meet — the scan found nothing to check`);
});

test('and a clear, long wall still braces at 45°, which is the doctrine', () => {
  // What must NOT change. The cap is a detail of short walls; anywhere there is room for a
  // 45° brace the generator still cuts one, and `walls.ts` still says so in its own test.
  const braces = generateWalls({
    lengthFt: 40, widthFt: 24, wallHeightFt: 8, studSpacingIn: 16, openings: [], letInBracing: true,
  }).filter((m) => m.role === 'brace');
  assert.ok(braces.length >= 6, `${braces.length} braces on a 40 x 24`);
  const north = braces.filter((b) => b.wall === 'N');
  assert.equal(north.length, 2, 'two braces on a clear wall');
  for (const b of north) {
    assert.ok(Math.abs(Math.abs(b.rotation[2]) - Math.PI / 4) < 1e-6,
      `${b.id}: ${((Math.abs(b.rotation[2]) * 180) / Math.PI).toFixed(2)}°, not the 45 a clear wall gets`);
  }
});

test('and a wall with no room for a brace still gets none', () => {
  // The existing floor, unchanged: below a 3-ft run the piece is a stud, not a brace, and the
  // sheathing braces the wall instead. Halving the run brings more walls to that line, so the
  // rule has to keep holding at it.
  const tiny = generateWalls({
    lengthFt: 6, widthFt: 5, wallHeightFt: 8, studSpacingIn: 16, openings: [], letInBracing: true,
  }).filter((m) => m.role === 'brace');
  for (const b of tiny) {
    const run = (b.cutLength / IN_PER_FT) * Math.cos(Math.abs(b.rotation[2]));
    assert.ok(run >= 3 - 1e-9, `${b.id}: a ${run.toFixed(2)} ft run is a stud, not a brace`);
  }
  // And bracing is still opt-in.
  assert.equal(generateWalls({
    lengthFt: 40, widthFt: 24, wallHeightFt: 8, studSpacingIn: 16, openings: [],
  }).filter((m) => m.role === 'brace').length, 0, 'braces are off unless asked for');
});
