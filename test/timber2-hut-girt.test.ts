// The hut's girts, where two of them meet at a corner.
//
// A RECTANGLE IS FRAMED WITH ONE PAIR RUNNING THROUGH AND THE OTHER BUTTING BETWEEN THEM, and
// `generateGirts` says so — it clips each girt's ends against the perpendicular WALLS' inner faces
// and the comment ends "A girt is cut at the corner." The clip is against the wall slab, and the
// girt is not in the wall slab: it lies INBOARD of the studs by its own thickness, which is
// further along the crossing wall's run than that wall's face is. So both girts of every corner
// reached the same 1½ in square and sat inside each other there — four corners on each of the six
// hut cards, 24 pairs at the full 1.50 in:
//
//   before   S girt x 3.50..596.50   W girt z 3.50..236.50     both own (3.50..5.00, 3.50..5.00)
//   after    S girt x 3.50..596.50   W girt z 5.00..235.00     the butting pair stops on the face
//
// The end that a wall's slab already clipped is a THROUGH wall's end and stays where it is; the
// end that needed no clip — a butting wall, whose run starts on the through wall's face — is the
// one that takes the extra thickness. Read off the geometry, so it does not depend on which walls
// happen to be called N and S.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { HUT, IN_PER_FT } from '../src/timber/doctrine';
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

/** Every shipped hut, and the girts on it. `HT-` is `generateGirts`; the tower has its own. */
function hutted(): { id: string; girts: Member[]; members: Member[] }[] {
  const out: { id: string; girts: Member[]; members: Member[] }[] = [];
  for (const f of shippedFamilies()) {
    const members = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const girts = members.filter((m) => m.role === 'girt' && m.id.startsWith('HT-'));
    if (girts.length) out.push({ id: f.id, girts, members });
  }
  assert.ok(out.length >= 5, `${out.length} hut cards carry girts`);
  return out;
}

/** Which plan axis a wall's girts run along. */
const runAxis = (m: Member): 'x' | 'z' => (Math.abs(rotate(m, [1, 0, 0])[0]) > 0.5 ? 'x' : 'z');

/** Each wall's girt run, end to end, however many pieces it arrives in. */
function wallRuns(girts: Member[]): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  for (const g of girts) {
    const k = g.wall ?? '?';
    const e = box(g)[runAxis(g)];
    const cur = out.get(k);
    out.set(k, cur ? [Math.min(cur[0], e[0]), Math.max(cur[1], e[1])] : [e[0], e[1]]);
  }
  return out;
}

/** The one piece at each end of each wall — the two that arrive at that wall's corners. */
function wallEnds(girts: Member[]): Map<string, Member[]> {
  const byWall = new Map<string, Member[]>();
  for (const g of girts) byWall.set(g.wall ?? '?', [...(byWall.get(g.wall ?? '?') ?? []), g]);
  const out = new Map<string, Member[]>();
  for (const [k, ms] of byWall) {
    const a = runAxis(ms[0]!);
    const sorted = [...ms].sort((p, q) => box(p)[a][0] - box(q)[a][0]);
    out.set(k, [...new Set([sorted[0]!, sorted[sorted.length - 1]!])]);
  }
  return out;
}

test('TWO GIRTS AT A CORNER — one runs through, the other butts its face', () => {
  for (const { id, girts } of hutted()) {
    for (let i = 0; i < girts.length; i++) {
      for (let j = i + 1; j < girts.length; j++) {
        const g = gap(girts[i]!, girts[j]!);
        assert.ok(g >= -1e-9,
          `${id}: ${girts[i]!.id} and ${girts[j]!.id} share ${(-g * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and the corner is CLOSED — the butting girt touches the through one, it does not stop short', () => {
  // The other half of a butt joint, and the one a blunt "no overlap" fix would break: trimming
  // BOTH girts leaves a 1½ in hole at every corner with nothing bracing it.
  //
  // Asked of the piece that REACHES the corner, not of every piece on the wall: a later pass cuts
  // a girt where a partition stands in it, so a wall's run can arrive at its corner as the last of
  // several segments. The one at each end of each wall is the one this is about.
  for (const { id, girts } of hutted()) {
    for (const [wall, ends] of wallEnds(girts)) {
      for (const a of ends) {
        const perpendicular = girts.filter((b) => {
          const ua = rotate(a, [1, 0, 0]);
          const ub = rotate(b, [1, 0, 0]);
          return Math.abs(dot(ua, ub)) < 1e-6;
        });
        assert.ok(perpendicular.length >= 2, `${id}: ${a.id} meets ${perpendicular.length} girts at right angles`);
        const g = Math.min(...perpendicular.map((b) => gap(a, b)));
        assert.ok(g < 1e-9,
          `${id} ${wall}: ${a.id} stands ${(g * IN_PER_FT).toFixed(3)} in from the nearest girt it `
          + 'crosses at right angles — a butt joint touches');
      }
    }
  }
});

test('and only the BUTTING pair got shorter — the through girts still run the wall', () => {
  // The guard on the trim. Both pairs were reaching the corner; exactly one pair had to give.
  //
  // Measured on each wall's RUN — the envelope from its first segment's end to its last one's —
  // because the cut-at-a-partition pass means a wall's run and one girt's cutLength stopped being
  // the same number.
  const girtT = DRESSED[HUT.girtNominal.value as string]!.w / IN_PER_FT;
  for (const { id, girts } of hutted()) {
    const runs = [...wallRuns(girts).values()].map((r) => Math.round((r[1] - r[0]) * 1e6) / 1e6);
    assert.equal(runs.length, 4, `${id}: ${runs.length} walled runs of girt — a rectangle has four`);
    const lengths = [...new Set(runs)].sort((a, b) => a - b);
    assert.equal(lengths.length, 2, `${id}: ${lengths.length} girt runs — a rectangle has two`);
    // The four are two matched pairs, and the pair that butts is short by a thickness at each end
    // of the run it would otherwise share with the other.
    for (const l of lengths) {
      assert.equal(runs.filter((r) => Math.abs(r - l) < 1e-6).length, 2,
        `${id}: the ${l.toFixed(2)} ft runs do not come in a pair`);
    }
    assert.ok(Math.max(...runs) > Math.min(...runs), `${id}: all four runs are the same length`);
    void girtT;
  }
});

test('and a girt is still nailed to the studs, inboard, at the doctrine spacing', () => {
  // The guard that trimming the ends did not move the plane or the level — the two things an
  // earlier pass fixed here, and the two a length change could quietly undo.
  const spacing = HUT.girtSpacingFt.value as number;
  for (const { id, girts, members } of hutted()) {
    const studs = members.filter((m) => m.role === 'stud' && m.wall);
    assert.ok(studs.length > 4, `${id}: ${studs.length} wall studs`);
    for (const g of girts) {
      assert.ok(Math.abs(g.position[1] - spacing) < 1e-9,
        `${id}: ${g.id} is at ${g.position[1].toFixed(3)} ft, not the ${spacing} the doctrine spaces girts at`);
      const mine = studs.filter((s) => s.wall === g.wall);
      assert.ok(mine.length > 0, `${id}: no studs on ${g.wall} for ${g.id} to be nailed to`);
      // Inboard AGAINST them: touching, never inside.
      const near = Math.min(...mine.map((s) => gap(g, s)));
      assert.ok(near >= -1e-9 && near < 1e-6,
        `${id}: ${g.id} is ${(near * IN_PER_FT).toFixed(3)} in from the nearest stud on its own wall`);
    }
  }
});
