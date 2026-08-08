// A ladder's rungs and the rails they are let into.
//
// A LADDER IS ONE PIECE OF GEOMETRY: the rungs climb a line and the two rails ARE that line, moved
// half the ladder's width to either side. Rake the rungs and the rails have to rake with them.
//
// `generateLadder` learned the rake for the guard tower, whose legs are battered, and it leaned the
// rungs one way and the rails the other. `atan2(facing[0], -facing[1]) - PI/2` reduces to
// `atan2(facing[1], facing[0])`, which puts the rake ALONG `facing` in X and AGAINST it in Z — and
// the tower's ladder faces -Z, so the whole rake was mirrored. The two crossed once near
// mid-height and opened symmetrically from there:
//
//   rungs whose ends reached neither rail        14 of 16   (only 9 and 10 touched anything)
//   bottom rung, clear of both rails             17.90 in
//   top rung, clear of both rails                13.08 in
//   members in the whole catalog touching NOTHING    14     — every one of them a tower rung
//
// It is the kind of defect a still render hides: the rails are behind the rungs from the front and
// behind the frame from the side, and a ladder of floating sticks reads as a ladder.
//
// The second half is where the ladder STANDS. Its base was struck off `legBaseZ` — the leg's own
// line — but the X-bracing is bolted to the OUTSIDE of the legs, 4¼ in of it, and the cab's siding
// hangs past that. Once the rails leaned the right way they leaned into both: 0.34 in of brace and
// 1.23 in of siding. The ladder now reads the frame's outermost line off the members ACTUALLY
// EMITTED, the same datum the stair already used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById, shippedFamilies } from '../src/timber/catalog';
import { LADDER, IN_PER_FT } from '../src/timber/doctrine';
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
 * Least separation over the 15 separating axes. Positive is a TRUE clearance — every piece of a
 * raked ladder is raked, and an axis-aligned box round one spans its whole lean and answers
 * nothing about where the wood is.
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

/** Where a rail's own axis is, in plan, at a given height. */
function railAt(rail: Member, y: number): [number, number] {
  const ax = rotate(rail, [1, 0, 0]);
  assert.ok(Math.abs(ax[1]) > 1e-6, `${rail.id} does not climb — its length axis is horizontal`);
  const t = (y - rail.position[1]) / ax[1];
  return [rail.position[0] + t * ax[0], rail.position[2] + t * ax[2]];
}

/** Every shipped card that carries a ladder, with its rungs and rails. */
function laddered(): { id: string; rungs: Member[]; rails: Member[]; members: Member[] }[] {
  const out: { id: string; rungs: Member[]; rails: Member[]; members: Member[] }[] = [];
  for (const f of shippedFamilies()) {
    const members = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const rungs = members.filter((m) => m.role === 'ladderRung');
    if (!rungs.length) continue;
    out.push({ id: f.id, rungs, rails: members.filter((m) => m.role === 'ladderRail'), members });
  }
  assert.ok(out.length >= 1, 'no shipped card climbs a ladder');
  return out;
}

test('EVERY RUNG IS LET INTO BOTH RAILS — 14 of 16 used to reach neither', () => {
  // `nailing` on a rung says "let in and 2-16d ea rail", which is a claim about where the wood is.
  const railT = DRESSED[LADDER.railNominal.value as string]!.w / IN_PER_FT;
  const railD = DRESSED[LADDER.railNominal.value as string]!.d / IN_PER_FT;
  for (const { id, rungs, rails } of laddered()) {
    assert.equal(rails.length, 2, `${id}: a ladder has two rails`);
    for (const r of rungs) {
      for (const l of rails) {
        const g = gap(r, l);
        assert.ok(g <= 1e-9,
          `${id}: ${r.id} stands ${(g * IN_PER_FT).toFixed(2)} in clear of ${l.id} — it is nailed to nothing`);
        // And LET IN, not driven through: a rung's end stops inside the rail's section, so the
        // overlap can never be more than the rail is thick either way.
        assert.ok(-g <= Math.max(railT, railD) + 1e-9,
          `${id}: ${r.id} is ${(-g * IN_PER_FT).toFixed(2)} in into ${l.id}, past the far face of a `
          + `${LADDER.railNominal.value}`);
      }
    }
  }
});

test('and the rails rake the way the rungs climb — they used to lean opposite ways', () => {
  // The direct statement of the defect, and the one a clearance check cannot make: sample both
  // rails' own axes at a rung's height and they must straddle that rung — its centre halfway
  // between them, its length exactly the span. True at every height only if all three rake alike.
  for (const { id, rungs, rails } of laddered()) {
    for (const r of rungs) {
      const [p, q] = rails.map((l) => railAt(l, r.position[1]!)) as [[number, number], [number, number]];
      const midOff = Math.hypot((p[0] + q[0]) / 2 - r.position[0]!, (p[1] + q[1]) / 2 - r.position[2]!);
      assert.ok(midOff < 1e-9,
        `${id}: at y=${r.position[1]!.toFixed(2)} the rails' centreline is ${(midOff * IN_PER_FT).toFixed(2)} in `
        + `off ${r.id} — the rails rake one way and the rungs the other`);
      const span = Math.hypot(p[0] - q[0], p[1] - q[1]);
      assert.ok(Math.abs(span - r.cutLength / IN_PER_FT) < 1e-9,
        `${id}: the rails are ${(span * IN_PER_FT).toFixed(2)} in apart at y=${r.position[1]!.toFixed(2)} and `
        + `${r.id} is ${r.cutLength.toFixed(2)} in long`);
    }
  }
});

test('and the ladder stands clear of the frame AS BUILT — bracing and siding, not the leg line', () => {
  // The other half, and the half only the first half exposes. `tower.ts` struck the ladder's base
  // off `legBaseZ`, the leg's own line — but the X-bracing is bolted to the OUTSIDE of the legs,
  // 4¼ in of it, and the cab's siding hangs past that again. While the rails leaned backwards
  // they leaned AWAY from all of it and nothing touched; rake them the way the rungs climb and
  // they cut 0.34 in into the bottom bay's diagonals and 1.23 in into the cab's siding on the
  // mudsill footing. So this is a guard on the datum, and it only bites once the rake is right.
  //
  // Both footings: they stand the legs at different heights and the bracing with them.
  for (const footing of ['timber-mudsill', 'concrete-pad']) {
    const spec = { ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), footing };
    const members = generateStructure(spec).members;
    const ladder = members.filter((m) => ['ladderRail', 'ladderRung'].includes(m.role));
    assert.ok(ladder.length > 4, `${footing}: the preset climbs on a ladder`);
    // Everything that is not the ladder — the frame it passes and the cab it arrives at alike.
    for (const b of members.filter((m) => !ladder.includes(m))) {
      for (const a of ladder) {
        const g = gap(a, b);
        assert.ok(g >= -1e-9,
          `${footing}: ${a.id} is ${(-g * IN_PER_FT).toFixed(2)} in inside ${b.id} (${b.role})`);
      }
    }
  }
});

test('and a plumb ladder is untouched — the rake is the tower\'s, not every ladder\'s', () => {
  // `generateLadder` serves walls that do not lean, and the fix must not reach them: zero lean
  // takes its own branch and keeps the rotation it always had.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.stories = [spec.stories[0], JSON.parse(JSON.stringify(spec.stories[0]))];
  spec.interiorStairs = false;
  const ms = generateStructure(spec).members;
  const rails = ms.filter((m) => m.role === 'ladderRail');
  const rungs = ms.filter((m) => m.role === 'ladderRung');
  if (!rails.length) return; // that family may not carry one; the tower assertions stand
  for (const l of rails) {
    assert.deepEqual(l.rotation.map((v) => Math.round(v * 1e9) / 1e9), [0, 0, Math.round(Math.PI / 2 * 1e9) / 1e9],
      `${l.id} on a wall is not plumb`);
  }
  // A plumb ladder's rails and rungs share one plan line, which is the degenerate case of the
  // straddle above and the reason it has to hold for lean = 0 too.
  for (const r of rungs) {
    const [p, q] = rails.map((l) => railAt(l, r.position[1]!)) as [[number, number], [number, number]];
    assert.ok(Math.hypot((p[0] + q[0]) / 2 - r.position[0]!, (p[1] + q[1]) / 2 - r.position[2]!) < 1e-9,
      `${r.id} does not sit between its rails`);
  }
});
