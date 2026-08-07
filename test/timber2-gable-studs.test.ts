// The gable end studs — the wall above the cap plate, on every gable roof in the catalog.
//
// A GABLE STUD IS A STUD, and not one of them was standing like one. `walls.ts` builds a vertical
// member with the wall's yaw PLUS a quarter turn, which is what stands a stud ACROSS a wall: 3½ in
// of face filling the plate, 1½ in of edge along the run. `roof.ts` wrote the quarter turn alone,
// and then everything else in that eight-line loop was chosen to suit the turned stud:
//
//                              across the wall   along the run   off the plate's centre
//   E wall stud (walls.ts)          3.50 in          1.50 in            0.00
//   gable stud (roof.ts)            1.50             3.50               0.50
//
// It was set at 1½ stud thicknesses in from the building line — a ROOF coordinate, picked so a
// 1½-in stud tucked beside the end rafter rather than under it — and marched in z from the
// building's OUTSIDE face, while the end wall's studs are laid out along the wall's own run, which
// starts one wall thickness in. So every gable stud in the toolkit stood 3.50 in off the stud
// below it: 186 of them across the nine gable cards, and not one with any wall framing underneath.
//
// The two end walls are laid out from opposite corners (each is described from its start corner
// "viewed from outside"), and the clear run is 185 in on a 16-ft hut, which is not a whole number
// of 16-in bays — so a single shared layout lands on one end and misses the other by 7 in. Struck
// per end, a gable stud lands on the stud below it at both.
//
// And under the ridge there is a 2x8, not a 2x6: a stud carried up to the RAFTER line at the peak
// ran 1.4525 in into the ridge board, on every building whose half-width falls on the layout.
//
//   gable studs with wall framing under them   0 of 186  ->  186 of 186
//   gable studs sharing wood with anything     10        ->  0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { generateRoof } from '../src/timber/roof';
import { IN_PER_FT } from '../src/timber/doctrine';
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

const mid = (r: [number, number]): number => (r[0] + r[1]) / 2;
const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
/** A gable stud belongs to `roof.ts`'s stage-8 pass, which is the only thing emitting `RF-…stud`. */
const gableStuds = (ms: Member[]): Member[] => ms.filter((m) => m.role === 'stud' && m.id.startsWith('RF-'));

/** Every shipped card with a gable roof, and its members. */
function gableCards(): { id: string; members: Member[] }[] {
  const out: { id: string; members: Member[] }[] = [];
  for (const f of shippedFamilies()) {
    const members = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    if (gableStuds(members).length) out.push({ id: f.id, members });
  }
  assert.ok(out.length >= 8, `${out.length} gable cards in the catalog`);
  return out;
}

test('A GABLE STUD STANDS ACROSS THE WALL — every one of them was a quarter turn out', () => {
  // A gable end runs along Z, so ACROSS the wall is X and ALONG the run is Z, and the piece that
  // settles what "across" means is the cap plate the stud stands on.
  const studT = DRESSED['2x4']!.w / IN_PER_FT;
  const studD = DRESSED['2x4']!.d / IN_PER_FT;
  for (const { id, members } of gableCards()) {
    const caps = members.filter((m) => m.role === 'capPlate' && (m.wall === 'E' || m.wall === 'W'))
      .map((m) => ({ m, b: box(m) }));
    assert.equal(caps.length, 2, `${id}: ${caps.length} end-wall cap plates`);
    for (const g of gableStuds(members)) {
      const b = box(g);
      const cap = caps.find((k) => ov(k.b.x, b.x) > 0);
      assert.ok(cap, `${id}: ${g.id} at x=${(mid(b.x) * IN_PER_FT).toFixed(2)} in is over no end wall at all`);
      assert.ok(Math.abs((b.x[1] - b.x[0]) - studD) < 1e-9,
        `${id}: ${g.id} is ${((b.x[1] - b.x[0]) * IN_PER_FT).toFixed(2)} in across a `
        + `${((cap!.b.x[1] - cap!.b.x[0]) * IN_PER_FT).toFixed(2)} in wall — it is laid flat in the wall, not standing across it`);
      assert.ok(Math.abs((b.z[1] - b.z[0]) - studT) < 1e-9,
        `${id}: ${g.id} takes up ${((b.z[1] - b.z[0]) * IN_PER_FT).toFixed(2)} in of the run, not ${(studT * IN_PER_FT).toFixed(2)}`);
      assert.ok(Math.abs(mid(b.x) - mid(cap!.b.x)) < 1e-9,
        `${id}: ${g.id} is ${((mid(b.x) - mid(cap!.b.x)) * IN_PER_FT).toFixed(2)} in off the centre of the plate it stands on`);
      // And it stands ON that plate, not floating over it or buried in it.
      assert.ok(Math.abs(b.y[0] - cap!.b.y[1]) < 1e-9,
        `${id}: ${g.id} starts at ${b.y[0].toFixed(4)} and the cap plate tops out at ${cap!.b.y[1].toFixed(4)}`);
    }
  }
});

test('and on the end wall\'s own layout — every one used to be 3 1/2 in off the stud below it', () => {
  // The claim a person sees: the wall carries on above the plate. It is checked against what is
  // actually under each gable stud rather than by recomputing the layout, so it stays true if the
  // layout rule ever changes.
  const VERT = ['stud', 'kingStud', 'jackStud', 'cripple'];
  for (const { id, members } of gableCards()) {
    for (const g of gableStuds(members)) {
      const b = box(g);
      const wall = members.filter((m) => VERT.includes(m.role) && (m.wall === 'E' || m.wall === 'W'))
        .map((m) => ({ m, b: box(m) }))
        .filter((k) => ov(k.b.x, b.x) > 0 && ov(k.b.z, b.z) > 1e-9);
      assert.ok(wall.length > 0,
        `${id}: ${g.id} at z=${(mid(b.z) * IN_PER_FT).toFixed(2)} in has no wall framing under it at all`);
      // Where what is under it is on the wall's LAYOUT — a plain stud or a cripple — the two are
      // the same piece continued, so they are concentric. A jamb (king or jack) is set by its
      // opening and not by the layout, which is the one case that is allowed to be off.
      const onLayout = wall.filter((k) => k.m.role === 'stud' || k.m.role === 'cripple');
      if (onLayout.length === 0) continue;
      assert.ok(onLayout.some((k) => Math.abs(mid(k.b.z) - mid(b.z)) < 1e-9),
        `${id}: ${g.id} sits ${(Math.min(...onLayout.map((k) => Math.abs(mid(k.b.z) - mid(b.z)))) * IN_PER_FT).toFixed(2)} in `
        + `off the ${onLayout[0]!.m.role} below it`);
    }
  }
});

test('and it dies INTO the rafter over it rather than through it', () => {
  for (const { id, members } of gableCards()) {
    const studs = gableStuds(members);
    const rest = members.filter((m) => !studs.includes(m));
    const over = members.filter((m) => m.role === 'rafter' || m.role === 'ridge');
    for (const g of studs) {
      for (const o of rest) {
        const s = gap(g, o);
        assert.ok(s >= -1e-6, `${id}: ${g.id} and ${o.id} (${o.role}) share ${(-s * IN_PER_FT).toFixed(3)} in of wood`);
      }
      // And it is not left hanging short of the roof either: its head touches what is above it.
      const head = Math.min(...over.map((o) => gap(g, o)));
      assert.ok(head < 1e-6, `${id}: ${g.id} stops ${(head * IN_PER_FT).toFixed(3)} in short of the roof over it`);
    }
  }
});

test('and a stud under the RIDGE stops at the ridge board, not at the rafter line', () => {
  // Called directly, because the cap only bites when a layout station lands on the peak, and no
  // shipped card's width does that any more. On a 16-ft hut the OLD marching layout put one there
  // and it ran 1.4525 in into the 2x8; 199 in of width puts one there on the wall's layout.
  for (const widthFt of [199 / IN_PER_FT, 16, 20]) {
    const members = generateRoof({ lengthFt: 24, widthFt, wallHeightFt: 8, risePer12: 4, rafterSpacingIn: 16 });
    const ridge = members.find((m) => m.role === 'ridge');
    assert.ok(ridge, `no ridge at ${widthFt} ft`);
    const rb = box(ridge!);
    const under = members.filter((m) => m.role === 'stud').map((m) => ({ m, b: box(m) }))
      .filter((k) => ov(k.b.z, rb.z) > 1e-9);
    for (const u of under) {
      assert.ok(Math.abs(u.b.y[1] - rb.y[0]) < 1e-9,
        `${widthFt.toFixed(4)} ft: ${u.m.id} tops out at ${u.b.y[1].toFixed(6)} and the ridge board's underside `
        + `is ${rb.y[0].toFixed(6)} — ${((u.b.y[1] - rb.y[0]) * IN_PER_FT).toFixed(4)} in into it`);
    }
    if (Math.abs(widthFt - 199 / IN_PER_FT) < 1e-9) {
      assert.equal(under.length, 2, `${under.length} studs under the ridge at a width that puts one there`);
    }
  }
});
