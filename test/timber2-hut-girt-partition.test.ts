// The B-hut's girts, where the partitions land in them.
//
// A GIRT IS DELIBERATELY LEFT RUNNING PAST AN OPENING — `generateGirts` says so and this suite
// pins it, because a runner cuts the piece on site and the take-off bills the stock it comes from.
// A PARTITION IS NOT AN OPENING. It is a stud wall standing in the girt's own plane, and the girt
// ran clean through all six of them:
//
//   b-hut 36 x 16, partitions at x = 9, 18, 27      6 pairs at 1.500 in — the girt's whole thickness
//
// It is the one card in the catalog with interior walls, so the defect had exactly one home, which
// is why it survived two earlier girt passes: *"a girt is nailed to the studs; it is not in the
// same plane as them"* moved the plane and *"a girt is cut at the corner"* trimmed the ends, and
// neither had anything to look at but the four exterior walls.
//
// The sweep had carried it as measured-and-not-fixed for the reason that both directions of the
// fix needed something the modules do not have: `generateGirts` is handed only the wall contract,
// and `partitions.ts` is a building subsystem that knows nothing about a hut's girts. The way
// through is the repo's own idiom — READ THE OBSTRUCTIONS OFF THE MEMBERS ALREADY EMITTED, the
// same `planReach`/`FRAME_ROLES` move `tower.ts` uses to find the ground under its ladder. The
// partitions are in `base.members` by the time the girts go on; the girt is cut at whatever of
// them stands in its plane at its height.
//
//   S wall before   x  0.292 .. 35.708                            one piece through three walls
//   S wall after    x  0.292..8.854  9.146..17.854  ...           four, butting the stud faces
//
// The run is unchanged; only the three 3½-in bites the partitions take out of it are gone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
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

/** Which plan axis a girt runs along, read off its own frame rather than off its wall letter. */
const runAxis = (m: Member): 'x' | 'z' => (Math.abs(rotate(m, [1, 0, 0])[0]) > 0.5 ? 'x' : 'z');

/** Every shipped hut, its girts, and the partition members standing inside it. */
function hutted(): { id: string; girts: Member[]; parts: Member[]; members: Member[] }[] {
  const out: { id: string; girts: Member[]; parts: Member[]; members: Member[] }[] = [];
  for (const f of shippedFamilies()) {
    const members = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const girts = members.filter((m) => m.role === 'girt' && m.id.startsWith('HT-'));
    if (girts.length) out.push({ id: f.id, girts, parts: members.filter((m) => m.id.startsWith('PT-')), members });
  }
  assert.ok(out.length >= 5, `${out.length} hut cards carry girts`);
  assert.ok(out.some((h) => h.parts.length > 0), 'no hut card in the catalog has partitions to be cut around');
  return out;
}

/** A wall's girts, in order along the wall's own run. */
function byWall(girts: Member[]): Map<string, Member[]> {
  const out = new Map<string, Member[]>();
  for (const g of girts) out.set(g.wall ?? '?', [...(out.get(g.wall ?? '?') ?? []), g]);
  for (const [k, ms] of out) {
    const a = runAxis(ms[0]!);
    out.set(k, [...ms].sort((p, q) => box(p)[a][0] - box(q)[a][0]));
  }
  return out;
}

test('A GIRT IS CUT WHERE A PARTITION STANDS IN IT — it used to run clean through the wall', () => {
  let pairs = 0;
  for (const { id, girts, parts } of hutted()) {
    for (const g of girts) {
      for (const p of parts) {
        pairs++;
        const v = gap(g, p);
        assert.ok(v >= -1e-9,
          `${id}: ${g.id} shares ${(-v * IN_PER_FT).toFixed(3)} in of wood with ${p.id} (${p.role}) — `
          + 'a partition is a stud wall, not an opening to be run past');
      }
    }
  }
  assert.ok(pairs > 100, `${pairs} girt/partition pairs measured — the scan found nothing to check`);
});

test('and cut ON the partition, not around it — the ends butt the stud faces', () => {
  // The guard on the other direction, and the reason the obstruction is measured rather than
  // padded: a girt shortened by any old clearance would pass the test above and leave a gap at
  // every partition with nothing bearing across it. Each break is exactly the width of what
  // stands in it, and both new ends touch that piece.
  let breaks = 0;
  for (const { id, girts, parts } of hutted()) {
    if (!parts.length) continue;
    for (const [wall, ms] of byWall(girts)) {
      const a = runAxis(ms[0]!);
      for (let i = 1; i < ms.length; i++) {
        const lo = box(ms[i - 1]!)[a][1], hi = box(ms[i]!)[a][0];
        assert.ok(hi > lo, `${id} ${wall}: consecutive girt pieces run backwards`);
        // Something of the partition fills the break, and fills it exactly.
        const fills = parts.filter((p) => {
          const b = box(p)[a];
          return b[0] <= lo + 1e-9 && b[1] >= hi - 1e-9 && box(p).y[0] <= ms[i]!.position[1]
            && box(p).y[1] >= ms[i]!.position[1];
        });
        assert.ok(fills.length > 0,
          `${id} ${wall}: a ${((hi - lo) * IN_PER_FT).toFixed(3)} in break at ${lo.toFixed(3)} with no `
          + 'partition member standing in it — the girt was cut around thin air');
        const w = Math.min(...fills.map((p) => { const b = box(p)[a]; return b[1] - b[0]; }));
        assert.ok(Math.abs((hi - lo) - w) < 1e-9,
          `${id} ${wall}: the break is ${((hi - lo) * IN_PER_FT).toFixed(3)} in and the piece in it is `
          + `${(w * IN_PER_FT).toFixed(3)} in — the girt does not butt what it was cut for`);
        breaks++;
      }
    }
  }
  assert.ok(breaks >= 6, `${breaks} girt breaks across the catalog`);
});

test('and a girt still runs PAST AN OPENING — a hole in the wall is not a partition', () => {
  // What must NOT change, and the thing a fix aimed at holes rather than at studs would break.
  // Every framed opening on every hut wall still has a girt across it, and any wall with nothing
  // standing in it still gets its run in ONE piece.
  let crossed = 0;
  for (const { id, girts, parts, members } of hutted()) {
    for (const [wall, ms] of byWall(girts)) {
      const a = runAxis(ms[0]!);
      for (const h of members.filter((m) => m.role === 'header' && m.wall === wall)) {
        const hb = box(h)[a];
        assert.ok(ms.some((g) => { const gb = box(g)[a]; return gb[0] < hb[1] - 0.02 && gb[1] > hb[0] + 0.02; }),
          `${id} ${wall}: no girt crosses ${h.id}'s opening — the cut-at-a-partition pass has started `
          + 'cutting at holes as well');
        crossed++;
      }
      // And where nothing stands in the wall, the run is still the single piece it always was.
      const inWall = parts.filter((p) => {
        const b = box(p)[a];
        const run: [number, number] = [box(ms[0]!)[a][0], box(ms[ms.length - 1]!)[a][1]];
        return b[1] > run[0] + 1e-9 && b[0] < run[1] - 1e-9
          && box(p).y[0] <= ms[0]!.position[1] && box(p).y[1] >= ms[0]!.position[1];
      });
      if (!inWall.length) {
        assert.equal(ms.length, 1,
          `${id} ${wall}: ${ms.length} girt pieces on a wall with nothing standing in it`);
      }
    }
  }
  assert.ok(crossed >= 20, `${crossed} framed openings measured against the girts crossing them`);
});

test('and the RUN is unchanged — only the partitions came out of it', () => {
  // The last guard: the cut takes the three bites and nothing else. A wall's girt still starts and
  // ends where it did, and the wood on it is the clear run less exactly the breaks.
  for (const { id, girts, parts } of hutted()) {
    for (const [wall, ms] of byWall(girts)) {
      const a = runAxis(ms[0]!);
      const run = box(ms[ms.length - 1]!)[a][1] - box(ms[0]!)[a][0];
      const wood = ms.reduce((s, g) => s + (box(g)[a][1] - box(g)[a][0]), 0);
      let breaks = 0;
      for (let i = 1; i < ms.length; i++) breaks += box(ms[i]!)[a][0] - box(ms[i - 1]!)[a][1];
      assert.ok(Math.abs(run - wood - breaks) < 1e-9,
        `${id} ${wall}: ${run.toFixed(4)} ft of run, ${wood.toFixed(4)} ft of girt and `
        + `${breaks.toFixed(4)} ft of break do not add up`);
      // Every piece is a piece somebody can carry, not a sliver left by an off-by-a-hair cut.
      for (const g of ms) {
        assert.ok(g.cutLength / IN_PER_FT > 1,
          `${id} ${wall}: ${g.id} is a ${g.cutLength.toFixed(2)} in offcut`);
      }
    }
    // And the card that has partitions is the one that got shorter pieces.
    if (parts.length) {
      assert.ok(girts.length > 4, `${id} has partitions and still only ${girts.length} girts`);
    }
  }
});
