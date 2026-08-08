// The shed cab's walls, which stopped where the pyramid's roof used to be.
//
// The guard tower cab is four panels tall to `TOWER.cabWallHeightFt` — the corner posts' height.
// That is also the eave line of a PYRAMID, so the shipped cab is closed and nobody looked. A shed
// leaves that line behind on three sides. Raycast straight up from each face of the shipped 8-ft
// cab, sampled across the run, and the band of open sky above the screen came out:
//
//   low face (−Z)    7.0 in the whole way        the eave band, which the pyramid has too
//   rake (±X)        7.0 rising to 40.4 in       open sky in a triangle, both sides
//   high face (+Z)   40.4 in the whole way       open sky, eight feet of it
//
// Rendered from outside the cab's rear corner it is exactly that: the screen stops in a straight
// horizontal line and the roof goes on up without it.
//
// `half-wall-screen` is the only cab that claims to close to the top — `open-rail` has no wall at
// all and `half-wall` stops at the half-wall on purpose — so it is the only one that gets infill,
// and `tileRakedInfill` cuts the rake the same way the building's gable and shed ends are cut.
//
// WHERE IT STOPS is the building's rule, which distinguishes the two kinds of wall a sloped roof
// makes. A RAKE runs up beside the end rafter and goes to the rafter CENTRE plane — stopping at
// the underside there would leave a wedge of daylight next to the rafter, which is what the lift
// in `rafterPlaneDatum` is for. The two faces the rafters CROSS stop at their underside instead.
//
// What is left is the band between the rafters, from the top of the wall up to the deck. The
// toolkit models no blocking anywhere, so that band is open in the building too — measured
// between two rafters over the high wall, 5.88 in on the gp-frame shed against 5.80 in on the cab.
// Same figure, same reason; it is not what this test is about.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT, TOLERANCE } from '../src/timber/doctrine';
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

function axisExtent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h = halfExtents(m);
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

/** The rafters' CENTRE plane at (x, z) — the datum every roof surface in the toolkit is stated at. */
function planeAt(r: Member, x: number, z: number): number {
  const n = rotate(r, [0, 1, 0]);
  return r.position[1]! - (n[0] * (x - r.position[0]!) + n[2] * (z - r.position[2]!)) / n[1];
}

/** How far below the centre plane a rafter's underside runs, measured plumb. */
function seatDrop(r: Member): number {
  const n = rotate(r, [0, 1, 0]);
  return halfExtents(r)[1] / Math.abs(n[1]);
}

const CABS = [6, 8, 10] as const;
const OCS = [16, 24] as const;

function cab(roof: 'pyramid' | 'shed', walls = 'half-wall-screen', cabPlanFt = 8, rafterSpacingIn = 16) {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset)) as {
    cab: { roof: string; walls: string }; cabPlanFt: number; spacing: { rafterSpacingIn: number };
  };
  spec.cab.roof = roof;
  spec.cab.walls = walls;
  spec.cabPlanFt = cabPlanFt;
  spec.spacing.rafterSpacingIn = rafterSpacingIn;
  const members = generateStructure(spec as never).members;
  const screens = members.filter((m) => m.role === 'screenPanel');
  // The FOUR original wall panels start at the half-wall; the infill starts on their tops. So the
  // originals are the ones whose bottom is at the lowest bottom any screen has.
  const base = screens.length ? Math.min(...screens.map((m) => axisExtent(m, 1)[0])) : 0;
  const original = screens.filter((m) => axisExtent(m, 1)[0] < base + 0.01);
  const top = original.length ? Math.max(...original.map((m) => axisExtent(m, 1)[1])) : 0;
  return {
    members,
    screens,
    original,
    infill: screens.filter((m) => axisExtent(m, 1)[0] > top - 1e-6),
    wallTop: top,
    rafters: members.filter((m) => m.role === 'rafter' && m.id.startsWith('TW-')),
    label: `cab ${cabPlanFt} ft, ${walls}, ${roof}, rafters ${rafterSpacingIn}" oc`,
  };
}

test('THE SHED CAB IS CLOSED IN — the screen follows the roof, it does not stop at the posts', () => {
  for (const plan of CABS) {
    for (const oc of OCS) {
      const c = cab('shed', 'half-wall-screen', plan, oc);
      assert.ok(c.rafters.length > 2, `${c.label}: ${c.rafters.length} rafters`);
      const r = c.rafters[0]!;
      const drop = seatDrop(r);
      assert.ok(c.infill.length > 0, `${c.label}: NOTHING closes the cab in above the wall`);

      for (const face of c.original) {
        const ex = axisExtent(face, 0), ez = axisExtent(face, 2);
        // A face whose run is along Z is a RAKE; the slope runs along it.
        const rake = ez[1] - ez[0] > ex[1] - ex[0];
        const strips = c.infill.filter((m) => {
          const mx = axisExtent(m, 0), mz = axisExtent(m, 2);
          return rake
            ? Math.abs((mx[0] + mx[1]) / 2 - (ex[0] + ex[1]) / 2) < 0.05
            : Math.abs((mz[0] + mz[1]) / 2 - (ez[0] + ez[1]) / 2) < 0.05;
        });
        // Walk the face and check every station the roof has left above the wall.
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const x = ex[0] + (ex[1] - ex[0]) * t;
          const z = ez[0] + (ez[1] - ez[0]) * t;
          const want = planeAt(r, x, z) - (rake ? 0 : drop);
          if (want <= c.wallTop + TOLERANCE.minSliverFt) continue;
          const over = strips.filter((m) => {
            const a = rake ? axisExtent(m, 2) : axisExtent(m, 0);
            const q = rake ? z : x;
            return a[0] - 1e-6 <= q && q <= a[1] + 1e-6;
          });
          assert.ok(over.length > 0,
            `${c.label}: at (${x.toFixed(2)}, ${z.toFixed(2)}) the roof is at ${want.toFixed(3)} and the `
            + `wall tops out at ${c.wallTop.toFixed(3)} — ${((want - c.wallTop) * IN_PER_FT).toFixed(1)} in `
            + 'of open sky and nothing closing it');
          // A strip is cut to the MIDDLE of the range it spans — half a step proud at one edge and
          // half shy at the other, which is what a ripped piece against a sloped line looks like —
          // so one rake step is the whole budget. The defect was 40.4 in.
          const got = Math.max(...over.map((m) => axisExtent(m, 1)[1]));
          assert.ok(want - got <= TOLERANCE.rakeStepFt + 1e-9,
            `${c.label}: at (${x.toFixed(2)}, ${z.toFixed(2)}) the screen tops out at ${got.toFixed(4)} `
            + `and the roof line is ${want.toFixed(4)} — ${((want - got) * IN_PER_FT).toFixed(2)} in short, `
            + `where a rake step is ${(TOLERANCE.rakeStepFt * IN_PER_FT).toFixed(1)} in`);
        }
      }
    }
  }
});

test('and it does not stand INTO the roof — nothing the infill touches shares wood with it', () => {
  // The guard on the other direction, and the one a fix by making the screen tall would fail: it
  // would pass the test above and bury every rafter in cloth. The building's own rake infill
  // shares wood with nothing, and this now matches it.
  for (const plan of CABS) {
    for (const oc of OCS) {
      const c = cab('shed', 'half-wall-screen', plan, oc);
      for (const s of c.infill) {
        for (const o of c.members) {
          if (o === s) continue;
          assert.ok(gap(s, o) >= -1e-9,
            `${c.label}: ${s.id} shares ${(-gap(s, o) * IN_PER_FT).toFixed(3)} in with ${o.id} (${o.role})`);
        }
      }
    }
  }
});

/** The worst step between consecutive strips along a run, and whether they abut. */
function rakeProfile(strips: Member[], along: 0 | 2): { step: number; slot: number; n: number } {
  const s = [...strips].sort((a, b) => axisExtent(a, along)[0] - axisExtent(b, along)[0]);
  let step = 0, slot = 0;
  for (let i = 1; i < s.length; i++) {
    step = Math.max(step, Math.abs(axisExtent(s[i]!, 1)[1] - axisExtent(s[i - 1]!, 1)[1]));
    slot = Math.max(slot, Math.abs(axisExtent(s[i]!, along)[0] - axisExtent(s[i - 1]!, along)[1]));
  }
  return { step, slot, n: s.length };
}

test('and the rake reads as a rake — the same step the building’s own rake takes', () => {
  // Not a number picked here. `tileRakedInfill` merges fine cells while the top edge stays inside
  // one `rakeStepFt`, and the strip then runs to the cell boundary past the one that broke the
  // range — so the real bound is a step plus a cell, and it is the same wherever it is used. The
  // gp-frame's own gable and shed rakes come out at 3.250 in, and so does the cab's.
  const ref = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as { roof: unknown };
  ref.roof = { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' };
  const rk = generateStructure(ref as never).members.filter((m) => m.id.startsWith('RK-') && m.wall === 'E');
  const bound = rakeProfile(rk, 2).step;
  assert.ok(bound > TOLERANCE.rakeStepFt && bound < TOLERANCE.rakeStepFt * 1.2,
    `the building's rake steps ${(bound * IN_PER_FT).toFixed(3)} in — the reference moved`);

  for (const plan of CABS) {
    const c = cab('shed', 'half-wall-screen', plan);
    for (const face of c.original) {
      const ex = axisExtent(face, 0), ez = axisExtent(face, 2);
      if (!(ez[1] - ez[0] > ex[1] - ex[0])) continue; // rakes only
      const strips = c.infill.filter((m) => Math.abs(axisExtent(m, 0)[0] - ex[0]) < 0.05
        && Math.abs(axisExtent(m, 0)[1] - ex[1]) < 0.05);
      const p = rakeProfile(strips, 2);
      assert.ok(p.n >= 4, `${c.label}: a rake closed in with ${p.n} strips is a staircase, not a rake`);
      assert.ok(p.step <= bound + 1e-9,
        `${c.label}: the cab's rake steps ${(p.step * IN_PER_FT).toFixed(3)} in where the building's `
        + `steps ${(bound * IN_PER_FT).toFixed(3)}`);
      assert.ok(p.slot < 1e-9,
        `${c.label}: a ${(p.slot * IN_PER_FT).toFixed(3)} in slot of daylight between two strips`);
    }
  }
});

test('and what must NOT change: the pyramid cab, and the two cabs that are open on purpose', () => {
  // The shipped card is `pyramid` and none of this may reach it.
  const pyr = cab('pyramid');
  assert.equal(pyr.infill.length, 0,
    `the pyramid cab grew ${pyr.infill.length} pieces of infill — its eave is the cab wall's own top`);
  assert.equal(pyr.original.length, 4, `${pyr.original.length} screen panels on a pyramid cab`);

  // `open-rail` has no cab wall at all and `half-wall` stops at the half-wall on purpose. Closing
  // either of them in would be a different building, not a repair.
  for (const walls of ['open-rail', 'half-wall'] as const) {
    const c = cab('shed', walls);
    assert.equal(c.screens.length, 0,
      `${walls}: ${c.screens.length} screen panels on a cab that has none`);
  }

  // And the four original panels are the four original panels — same count, same tops.
  for (const plan of CABS) {
    const shed = cab('shed', 'half-wall-screen', plan);
    const pyramid = cab('pyramid', 'half-wall-screen', plan);
    assert.equal(shed.original.length, 4, `cab ${plan}: ${shed.original.length} wall screens under a shed`);
    assert.equal(shed.wallTop, pyramid.wallTop,
      `cab ${plan}: the wall screen tops out at ${shed.wallTop} under a shed and ${pyramid.wallTop} under a pyramid`);
  }
});
