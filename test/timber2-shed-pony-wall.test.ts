// The shed roof's high wall — the pony wall, and what closes it in.
//
// No shipped card has a shed or a flat roof. Both are one click away on the gp-frame and custom
// cards, `generateShed` builds them, and this is the first pass to measure either. Two things.
//
// **THE SIDING RAN UP TO THE RAFTERS' CENTRE LINE.** `wallInfillProfiles` takes every raked area
// to `lift + span·slope`, where `lift` is the rafter CENTRE plane's datum above the plate. That is
// the right line for a RAKE — there the siding runs up BESIDE the end rafter and stopping at its
// underside would leave a wedge of daylight, which is what the `lift` was added for. The high wall
// is the one the rafters CROSS: every one of them lands on its pony plate and runs on out to the
// eave, so siding taken to their centre buries each one to half its depth.
//
//   gp-frame + shed     48 rafter x infill pairs at 2.750 in — half a 2x6, on every rafter
//   gp-frame + flat     the same 48 at the same 2.750
//   gp-frame + gable    0 — a gable has no wall the rafters cross
//
// The figure it should be is one `generateShed` already computes and states in its own comment:
// *"The height is (span − plateWidth)·slope, NOT span·slope. The seat at the LOW wall lands at the
// plate's inner face and the seat at the HIGH wall at its outer face."* The pony plate's top IS the
// rafters' underside there, to the thousandth — 14.5694 against 14.5936 with the seat, on a 48 x 20
// at 4 in 12 — so the siding now stops exactly where the rafters start.
//
// **AND THE PONY STUDS WERE A QUARTER TURN OUT.** `rotation: [0, 0, π/2]` says "a stud" only when
// the wall runs along Z. On a high side of N or S:
//
//   wall stud below     1.50 in along the run, 3.50 across      z 19.708..20.000, the whole wall
//   pony stud above     3.50 in along the run, 1.50 across      z 19.792..19.917, floating in it
//
// Thirty-seven of them, filling neither face of the wall they stand in, not stacked on the studs
// below, and pushing 1 in past the building line at each corner. It is the gable rake studs'
// defect — *"186 gable studs across nine cards stood 1½ in across a 3½-in wall"*, fixed in
// `roof.ts` as a compat-lock event — in the sibling generator, where nothing had looked. E and W
// come out at the yaw they already had, so a high side that was right stays right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member, WallId } from '../src/timber/types';

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

/** A member's full extent along each world axis, in inches. */
function extentIn(m: Member): V3 {
  const h = halfExtents(m), A = axesOf(m);
  const r: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) r[i] = r[i]! + h[k]! * Math.abs(A[k]![i]!);
  return [r[0]! * 2 * IN_PER_FT, r[1]! * 2 * IN_PER_FT, r[2]! * 2 * IN_PER_FT];
}

function axisExtent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h = halfExtents(m);
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

/** The raked infill — `RK-` is the pass that closes in above the cap plate. */
const isInfill = (m: Member): boolean => m.id.startsWith('RK-')
  && ['siding', 'sidingBoard', 'batten', 'sheathingPanel'].includes(m.role);

const HIGH_SIDES: WallId[] = ['N', 'S', 'E', 'W'];

function shed(kind: 'shed' | 'flat' | 'gable', highSide: WallId = 'N'): Member[] {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as { roof: Record<string, unknown> };
  spec.roof = kind === 'gable'
    ? { kind, risePer12: 4, overhangFt: 1 }
    : { kind, risePer12: 4, overhangFt: 1, ...(kind === 'shed' ? { highSide } : {}) };
  return generateStructure(spec as never).members;
}

test('THE HIGH WALL CLOSES IN UNDER THE RAFTERS, not up to their centre line', () => {
  let cases = 0, pairs = 0;
  for (const kind of ['shed', 'flat'] as const) {
    for (const high of kind === 'shed' ? HIGH_SIDES : (['N'] as WallId[])) {
      const members = shed(kind, high);
      const rafters = members.filter((m) => m.role === 'rafter');
      const infill = members.filter(isInfill);
      assert.ok(rafters.length > 10 && infill.length > 10,
        `${kind}/${high}: ${rafters.length} rafters against ${infill.length} pieces of infill`);
      cases++;
      for (const r of rafters) {
        for (const s of infill) {
          pairs++;
          const g = gap(r, s);
          assert.ok(g >= -1e-9,
            `${kind}, high side ${high}: ${r.id} is ${(-g * IN_PER_FT).toFixed(3)} in inside ${s.id} — `
            + 'the siding under a roof stops where the rafters start');
        }
      }
    }
  }
  assert.ok(cases === 5, `${cases} shed and flat configurations`);
  assert.ok(pairs > 4000, `${pairs} rafter/infill pairs measured`);
  // The control: a gable has no wall the rafters cross, and never had this.
  const g = shed('gable');
  for (const r of g.filter((m) => m.role === 'rafter')) {
    for (const s of g.filter(isInfill)) {
      assert.ok(gap(r, s) >= -1e-9, `gable: ${r.id} inside ${s.id}`);
    }
  }
});

test('and it REACHES that plate — the siding stops on it, not short of it', () => {
  // The guard on the other direction, and the one a fix by an arbitrary drop would fail: taking
  // the infill down by any round figure would pass the test above and open a strip of daylight
  // between the top of the siding and the rafters it is supposed to meet.
  for (const kind of ['shed', 'flat'] as const) {
    for (const high of kind === 'shed' ? HIGH_SIDES : (['N'] as WallId[])) {
      const members = shed(kind, high);
      const plate = members.filter((m) => m.role === 'capPlate' && m.id.startsWith('RF-'));
      assert.equal(plate.length, 1, `${kind}/${high}: the pony wall has one plate`);
      const plateTop = axisExtent(plate[0]!, 1)[1];
      const onHigh = members.filter((m) => isInfill(m) && m.wall === high);
      assert.ok(onHigh.length > 0, `${kind}/${high}: nothing closes in the pony wall`);
      const top = Math.max(...onHigh.map((m) => axisExtent(m, 1)[1]));
      assert.ok(Math.abs(top - plateTop) < 1e-9,
        `${kind}, high side ${high}: the pony wall's siding stops at y=${top.toFixed(4)} and its `
        + `plate tops out at ${plateTop.toFixed(4)} — ${((top - plateTop) * IN_PER_FT).toFixed(3)} in out`);
    }
  }
});

test("A PONY STUD'S FACE GOES ACROSS ITS WALL, like the stud it stands on", () => {
  for (const high of HIGH_SIDES) {
    const members = shed('shed', high);
    const pony = members.filter((m) => m.role === 'ponyStud');
    const below = members.filter((m) => m.role === 'stud' && m.wall === high);
    assert.ok(pony.length > 10 && below.length > 10,
      `high side ${high}: ${pony.length} pony studs over ${below.length} wall studs`);
    const want = extentIn(below[0]!);
    for (const p of pony) {
      const got = extentIn(p);
      for (const i of [0, 2] as const) {
        assert.ok(Math.abs(got[i] - want[i]) < 1e-6,
          `high side ${high}: ${p.id} measures ${got[0].toFixed(2)} x ${got[2].toFixed(2)} in in plan `
          + `and the stud under it measures ${want[0].toFixed(2)} x ${want[2].toFixed(2)} — it is a quarter turn out`);
      }
    }
  }
});

test('and it fills the same slab of wall, and stands over the framing below it', () => {
  // The other half of "a stud is in its wall": the same plan section is necessary and not
  // sufficient — a stud turned right but set off the wall's centreline is still not in it.
  for (const high of HIGH_SIDES) {
    const members = shed('shed', high);
    const across: 0 | 2 = high === 'N' || high === 'S' ? 2 : 0;
    const along: 0 | 2 = across === 2 ? 0 : 2;
    const below = members.filter((m) => m.role === 'stud' && m.wall === high);
    const slab = axisExtent(below[0]!, across);
    const holds = members.filter((m) => ['stud', 'kingStud', 'jackStud', 'cripple', 'post'].includes(m.role)
      && m.wall === high).map((m) => {
      const e = axisExtent(m, along);
      return (e[0] + e[1]) / 2;
    });
    for (const p of members.filter((m) => m.role === 'ponyStud')) {
      const e = axisExtent(p, across);
      assert.ok(Math.abs(e[0] - slab[0]) < 1e-9 && Math.abs(e[1] - slab[1]) < 1e-9,
        `high side ${high}: ${p.id} sits ${e[0].toFixed(4)}..${e[1].toFixed(4)} across a wall whose `
        + `studs run ${slab[0].toFixed(4)}..${slab[1].toFixed(4)}`);
      const c = (axisExtent(p, along)[0] + axisExtent(p, along)[1]) / 2;
      const d = Math.min(...holds.map((v) => Math.abs(v - c)));
      assert.ok(d < 0.1,
        `high side ${high}: ${p.id} stands ${(d * IN_PER_FT).toFixed(2)} in off the nearest piece of `
        + 'framing below it — a stud carries down');
    }
  }
});
