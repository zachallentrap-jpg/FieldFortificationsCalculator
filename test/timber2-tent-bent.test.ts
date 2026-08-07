// The tent frame's bents, at the joints.
//
// A BENT IS FRAMED, NOT DRAWN AS A STICK DIAGRAM. Every member's centreline ran corner to corner,
// so at each node all of them occupied the same wood. Measured on the shipped GP Small:
//
//   rafter into the opposite rafter    1.45 in      at the peak
//   rafter into the ridge board        0.75 in      the board it is nailed to
//   collar into the rafter             1.50 in      its whole thickness
//   collar into the post               0.75 in
//   rafter into the post               0.66 in      the square foot's corner
//
// The house's own roof shows what these joints are when they are framed — `roof.ts` lands its
// studs and its collar ties face to face on the pieces they meet, to the last thousandth, and its
// collar ties are set one board thickness off the rafter grid line, "nailed beside their rafters".
// The tent bent was the outlier.
//
// What is fixed here is the ridge bearing and the collar lap. What is not is the rafter's FOOT,
// which is cut square to its rake and therefore drops a corner into the post top; that wants a
// level seat cut, which is a derived profile and not a placement, and it is in the sweep with the
// tower's square-cut legs and braces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import { ridgeHeadProfile } from '../src/timber/stringerCuts';
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
 * The widest separating gap between two oriented boxes, feet. Positive means DISJOINT and the
 * number is the clearance; zero means they meet on a face; negative is shared wood. Every piece
 * in a bent is an uncut box, so this is exact for all of them.
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

/**
 * The corners of the piece AS DRAWN — the plumb head cut where there is one, the blank otherwise.
 */
function drawnCorners(m: Member): V3[] {
  const outline = (m.role === 'bentRafter' ? ridgeHeadProfile(m) : null) ?? ([
    [-m.cutLength / 24, -m.actual.d / 24], [m.cutLength / 24, -m.actual.d / 24],
    [m.cutLength / 24, m.actual.d / 24], [-m.cutLength / 24, m.actual.d / 24],
  ] as [number, number][]);
  const half = m.actual.w / 24;
  const out: V3[] = [];
  for (const [px, py] of outline) for (const s of [-half, half]) {
    const r = rotate(m, [px, py, s]);
    out.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  return out;
}

type Box = [[number, number], [number, number], [number, number]];
const aabb = (m: Member): Box => {
  const p = drawnCorners(m);
  const g = (i: number): [number, number] => [Math.min(...p.map((q) => q[i]!)), Math.max(...p.map((q) => q[i]!))];
  return [g(0), g(1), g(2)];
};
const boxGap = (a: Box, b: Box): number =>
  Math.max(...[0, 1, 2].map((i) => Math.max(a[i]![0] - b[i]![1], b[i]![0] - a[i]![1])));

/**
 * The gap between two pieces of a bent, by whichever measure is honest for the pair.
 *
 * A rafter's HEAD is cut, so its blank is not the piece — the oriented box holds a wedge the
 * plumb cut removes, and that wedge is exactly what used to be inside the ridge. Against the
 * ridge and against its opposite number, the world box of the DRAWN corners is the tight answer
 * and comes out at zero. Against the POST the cut is irrelevant — it is at the other end — so the
 * oriented box is exact there, and an axis-aligned one would over-report a raked piece by half an
 * inch. Both measures are supersets of the real solid, so a positive gap from either is a proof.
 */
function pieceGap(a: Member, b: Member): number {
  const raked = a.role === 'bentRafter' || b.role === 'bentRafter';
  const other = [a.role, b.role].filter((r) => r !== 'bentRafter');
  return raked && !other.includes('bentPost')
    ? boxGap(aabb(a), aabb(b))
    : gap(obbOf(a), obbOf(b));
}

/** The two ends of a member's centreline. */
function ends(m: Member): { lo: V3; hi: V3 } {
  const d = rotate(m, [m.cutLength / 24, 0, 0]);
  const a: V3 = [m.position[0] - d[0], m.position[1] - d[1], m.position[2] - d[2]];
  const b: V3 = [m.position[0] + d[0], m.position[1] + d[1], m.position[2] + d[2]];
  return a[1] <= b[1] ? { lo: a, hi: b } : { lo: b, hi: a };
}

const FAMILIES = ['tent-floor', 'strongback'];
const TOL = 1e-9;

function tent(id: string) {
  const spec = JSON.parse(JSON.stringify(familyById(id as never)!.preset)) as Record<string, unknown>;
  const model = generateStructure(spec as never);
  const ridge = model.members.find((m) => m.role === 'ridge')!;
  const posts = model.members.filter((m) => m.role === 'bentPost');
  const xs = [...new Set(posts.map((m) => Math.round(m.position[0] * 1e6) / 1e6))].sort((a, b) => a - b);
  return {
    model,
    ridge,
    /** Bent lines, in order — the last one is the end where a lap would hang off the deck. */
    xs,
    at: (x: number): Member[] => model.members.filter((m) =>
      ['bentPost', 'bentRafter', 'bentCollar'].includes(m.role) && Math.abs(m.position[0] - x) < 1),
  };
}

test('NO TWO PIECES OF A BENT SHARE WOOD — except the square foot, which is a cut', () => {
  for (const id of FAMILIES) {
    const t = tent(id);
    assert.ok(t.xs.length >= 8, `${id}: ${t.xs.length} bents`);
    for (const x of t.xs) {
      const bent = t.at(x);
      assert.equal(bent.filter((m) => m.role === 'bentPost').length, 2, `${id}: two posts at x=${x}`);
      assert.equal(bent.filter((m) => m.role === 'bentRafter').length, 2, `${id}: two rafters at x=${x}`);
      assert.equal(bent.filter((m) => m.role === 'bentCollar').length, 1, `${id}: one collar at x=${x}`);
      const pieces = [...bent, t.ridge];
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const a = pieces[i]!, b = pieces[j]!;
          const roles = [a.role, b.role].sort().join('+');
          const d = pieceGap(a, b);
          if (roles === 'bentPost+bentRafter') {
            // The one that is left, and it is bounded by its own geometry: a rafter cut square
            // to its rake drops the low corner of that face half a face width times the cosine of
            // the pitch below its centreline, and its centreline foot is on the post's top. This
            // is 0.66 in on the GP Small. A LEVEL seat cut is what closes it.
            const rafter = a.role === 'bentRafter' ? a : b;
            const bound = (rafter.actual.d / 24) * Math.cos(rafter.rotation[2]);
            assert.ok(-d <= bound + 1e-9,
              `${id}: ${a.id} and ${b.id} share ${(-d * IN_PER_FT).toFixed(2)} in, more than the `
              + `${(bound * IN_PER_FT).toFixed(2)} in a square foot cut accounts for`);
            continue;
          }
          assert.ok(d > -TOL,
            `${id}: ${a.id} (${a.role}) and ${b.id} (${b.role}) share `
            + `${(-d * IN_PER_FT).toFixed(2)} in of wood`);
        }
      }
    }
  }
});

test('and the rafters BEAR on the ridge board — they neither enter it nor float off it', () => {
  // Clearing the ridge by moving the rafters away from it would pass the test above and leave a
  // roof frame hanging on nothing. Each rafter's head must LAND on the board.
  for (const id of FAMILIES) {
    const t = tent(id);
    const rafters = t.model.members.filter((m) => m.role === 'bentRafter');
    assert.ok(rafters.length >= 16, `${id}: ${rafters.length} rafters`);
    for (const r of rafters) {
      const d = boxGap(aabb(r), aabb(t.ridge));
      assert.ok(Math.abs(d) < 1e-9,
        `${id}: ${r.id} stands ${(d * IN_PER_FT).toFixed(3)} in off the ridge it is nailed to`);
    }
  }
});

test('THE EAVE AND RIDGE LINES ARE THE DOCTRINE LINES, and the fix did not move them', () => {
  // `TENT.gpSmall` and `TENT.temper` carry the tent's own eave and ridge heights. The rafters got
  // shorter; the frame they describe must not have changed shape. Each rafter's centreline still
  // starts on its post's top and still passes through the ridge line when produced to it.
  for (const id of FAMILIES) {
    const t = tent(id);
    const ridgeZ = t.ridge.position[2];
    const ridgeY = t.ridge.position[1];
    for (const x of t.xs) {
      const bent = t.at(x);
      for (const r of bent.filter((m) => m.role === 'bentRafter')) {
        const { lo, hi } = ends(r);
        // The foot is on a post top.
        const post = bent.filter((m) => m.role === 'bentPost')
          .map((p) => ({ p, top: p.position[1] + p.cutLength / 24 }))
          .find((p) => Math.abs(p.p.position[2] - lo[2]) < TOL && Math.abs(p.top - lo[1]) < TOL);
        assert.ok(post, `${id}: ${r.id}'s foot at (${lo[1].toFixed(4)}, ${lo[2].toFixed(4)}) is on no post top`);
        // Produced to the ridge line, the same centreline arrives at the ridge height.
        const s = (ridgeZ - lo[2]) / (hi[2] - lo[2]);
        const y = lo[1] + s * (hi[1] - lo[1]);
        assert.ok(Math.abs(y - ridgeY) < 1e-9,
          `${id}: ${r.id} produced to the ridge line reaches ${y.toFixed(5)}, not ${ridgeY.toFixed(5)}`);
      }
    }
  }
});

test('THE COLLAR IS LAPPED ONE BOARD THICKNESS, on the face inside the tent', () => {
  for (const id of FAMILIES) {
    const t = tent(id);
    const lastX = t.xs[t.xs.length - 1]!;
    for (const x of t.xs) {
      const bent = t.at(x);
      const collar = bent.find((m) => m.role === 'bentCollar')!;
      // Measured off a POST of the same bent, not off the rounded bent line the lookup uses —
      // the rounding is a hundred-thousandth of an inch and this assertion is exact.
      const lap = collar.position[0] - bent.find((m) => m.role === 'bentPost')!.position[0];
      // Face to face across what each piece actually presents: the post shows its 3½-in face in
      // the bent's plane, the collar its 1½-in edge. Half of each.
      const stock = DRESSED[collar.nominal]!;
      const want = (stock.d + stock.w) / 2 / IN_PER_FT;
      assert.ok(Math.abs(Math.abs(lap) - want) < 1e-9,
        `${id}: the collar at x=${x} is lapped ${(lap * IN_PER_FT).toFixed(3)} in; face to face on a `
        + `${collar.nominal} post is ${(want * IN_PER_FT).toFixed(3)} in`);
      // Inboard: away from the end at the last bent, and over the deck at every bent.
      const inward = x === lastX ? -1 : 1;
      assert.equal(Math.sign(lap), inward, `${id}: the collar at x=${x} laps off the end of the tent`);
      assert.ok(collar.position[0] >= 0 - TOL && collar.position[0] <= lastX + TOL,
        `${id}: the collar at x=${x} sits at ${collar.position[0].toFixed(3)}, off the deck`);
    }
  }
});
