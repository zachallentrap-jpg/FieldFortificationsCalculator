// The GP framed building — the workhorse card, and the last shipped family never rendered.
//
// NOTHING WAS WRONG WITH IT. That is the finding, and these are the measurements that make it a
// finding rather than an opinion: the piers, the four walls, the roof covering and the two gable
// ends, each checked by a property a person could watch fail, not by restating what the generator
// computed.
//
// Each test carries its own NEGATIVE CONTROL — a deliberately broken copy of the same model that
// the same sampler must reject. A pass-only test on a clean structure proves nothing about the
// test: a walk too coarse to see a doorway reports a building with no doors as sound, and that is
// the shape every "checked, clean" verdict in this sweep is at risk of.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { generateBuilding } from '../src/timber/families/building';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];
interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

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

/** Is world point `p` inside the member's ORIENTED box? A raked piece's AABB is not the piece. */
function inside(m: Member, p: V3): boolean {
  const d: V3 = [p[0] - m.position[0], p[1] - m.position[1], p[2] - m.position[2]];
  const h = halfExtents(m);
  const axes: V3[] = [rotate(m, [1, 0, 0]), rotate(m, [0, 1, 0]), rotate(m, [0, 0, 1])];
  return axes.every((a, i) => Math.abs(d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) <= h[i]! + 1e-9);
}

function gp() {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  return { model: generateStructure(spec), built: generateBuilding(spec) };
}

test('EVERY PIER BEARS — footing to post to the timber it carries, with nothing floating', () => {
  const { model } = gp();
  const posts = model.members.filter((m) => m.role === 'post').map((m) => ({ m, b: box(m) }));
  const foots = model.members.filter((m) => m.role === 'footing').map((m) => ({ m, b: box(m) }));
  const carried = model.members.filter((m) => m.role === 'girder' || (m.role === 'sill' && m.id.startsWith('FL')))
    .map((m) => ({ m, b: box(m) }));
  assert.ok(posts.length >= 12, `${posts.length} pier posts`);
  const plan = (a: Box, b: Box): boolean =>
    Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]) > 1e-9
    && Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]) > 1e-9;
  for (const p of posts) {
    const f = foots.filter((k) => plan(p.b, k.b));
    assert.equal(f.length, 1, `${p.m.id} stands over ${f.length} footings`);
    assert.ok(Math.abs(f[0]!.b.y[1] - p.b.y[0]) < 1e-9,
      `${p.m.id} starts at ${p.b.y[0].toFixed(4)} and its footing tops out at ${f[0]!.b.y[1].toFixed(4)} — `
      + `${((p.b.y[0] - f[0]!.b.y[1]) * IN_PER_FT).toFixed(3)} in adrift`);
    const on = carried.filter((k) => plan(p.b, k.b));
    assert.ok(on.length > 0, `${p.m.id} carries nothing — a pier under no timber`);
    for (const k of on) {
      assert.ok(Math.abs(k.b.y[0] - p.b.y[1]) < 1e-9,
        `${p.m.id} tops out at ${p.b.y[1].toFixed(4)} and ${k.m.id} (${k.m.role}) starts at `
        + `${k.b.y[0].toFixed(4)} — ${((k.b.y[0] - p.b.y[1]) * IN_PER_FT).toFixed(3)} in `
        + (k.b.y[0] > p.b.y[1] ? 'of air between them' : 'of one inside the other'));
    }
  }
});

/** Stations on each wall where nothing at all lies at any depth through it. */
function daylight(members: readonly Member[], built: ReturnType<typeof generateBuilding>): Map<string, number> {
  const boxes = members.map((m) => ({ m, b: box(m) }));
  const out = new Map<string, number>();
  const top = built.walls.plateTopY;
  for (const s of built.walls.surfaces) {
    // Only what is anywhere near this wall's slab — everything else cannot block a sight line
    // through it, and carrying 700 members through the sampler is what makes it too slow to be
    // fine enough to see anything.
    const slab = boxes.filter((k) => {
      const c: [number, number] = [(k.b.x[0] + k.b.x[1]) / 2, (k.b.z[0] + k.b.z[1]) / 2];
      const w = (c[0] - s.origin[0]) * s.normal[0] + (c[1] - s.origin[1]) * s.normal[1];
      const reach = (k.b.x[1] - k.b.x[0] + k.b.z[1] - k.b.z[0]) / 2;
      return Math.abs(w) < 0.5 + reach && k.b.y[1] > -1e-9 && k.b.y[0] < top + 1e-9;
    });
    let holes = 0;
    for (let i = 0; i < 72; i++) {
      const u = s.runFt * (i + 0.5) / 72;
      for (let j = 0; j < 32; j++) {
        const v = top * (j + 0.5) / 32;
        let covered = false;
        for (let t = -0.27; t <= 0.29 && !covered; t += 0.02) {
          const x = s.origin[0] + s.along[0] * u + s.normal[0] * t;
          const z = s.origin[1] + s.along[1] * u + s.normal[1] * t;
          covered = slab.some((k) => k.b.x[0] - 1e-9 <= x && x <= k.b.x[1] + 1e-9
            && k.b.z[0] - 1e-9 <= z && z <= k.b.z[1] + 1e-9
            && k.b.y[0] - 1e-9 <= v && v <= k.b.y[1] + 1e-9);
        }
        if (!covered) holes++;
      }
    }
    out.set(s.wall, holes);
  }
  return out;
}

test('NO DAYLIGHT THROUGH A WALL — every station has material at some depth', () => {
  const { model, built } = gp();
  for (const [wall, holes] of daylight(model.members, built)) {
    assert.equal(holes, 0, `${wall}: ${holes} stations with nothing at any depth through the wall`);
  }
  // NEGATIVE CONTROL. Eight windows and two doors are holes in the framing and what closes them is
  // the leaf hung in each. Take the leaves away and the sampler must see straight through.
  const FILL = new Set(['shutter', 'doorBoard', 'doorLedge', 'doorBrace']);
  const open = daylight(model.members.filter((m) => !FILL.has(m.role)), built);
  const seen = [...open.values()].reduce((a, b) => a + b, 0);
  assert.ok(seen > 100, `the sampler found only ${seen} open stations with every door and shutter `
    + 'removed — it is too coarse to see a hole, so its silence on the real model means nothing');
});

/** Deck samples with no covering over them, measured PERPENDICULAR to the slope. */
function bareDeck(members: readonly Member[]): { x: number; z: number }[] {
  const deck = members.filter((m) => m.role === 'roofPanel');
  const cover = members.filter((m) => m.role === 'roofingCourse' || m.role === 'ridgeCap');
  const bare: { x: number; z: number }[] = [];
  const NU = 6, NV = 33;
  for (const d of deck) {
    const h = halfExtents(d);
    const up = rotate(d, [0, 0, 1]);
    const sgn = up[1] >= 0 ? 1 : -1;
    for (let i = 0; i < NU; i++) {
      // Endpoints INCLUDED up the slope: the strip a missing ridge cap leaves bare is the last
      // half-inch of the topmost panel, and cell centres step straight over it.
      for (let j = 0; j < NV; j++) {
        const r = rotate(d, [-h[0] + 2 * h[0] * (i + 0.5) / NU, -h[1] + 2 * h[1] * j / (NV - 1), sgn * h[2]]);
        const base: V3 = [d.position[0] + r[0], d.position[1] + r[1], d.position[2] + r[2]];
        let hit = false;
        // Courses STACK — each laps the one below, so the topmost sits several thicknesses off the
        // deck. The ray has to be long enough to reach it and short enough to stay in the roof.
        for (let t = 0.001; t <= 0.30 && !hit; t += 0.003) {
          hit = cover.some((c) => inside(c, [base[0] + up[0] * sgn * t, base[1] + up[1] * sgn * t, base[2] + up[2] * sgn * t]));
        }
        if (!hit) bare.push({ x: base[0], z: base[2] });
      }
    }
  }
  return bare;
}

test('THE ROOFING LEAVES NO BARE DECK — courses lap, and the cap closes the ridge', () => {
  const { model } = gp();
  const bare = bareDeck(model.members);
  assert.equal(bare.length, 0, bare.length
    ? `${bare.length} deck samples with no covering over them, x ${Math.min(...bare.map((b) => b.x)).toFixed(2)}`
      + `..${Math.max(...bare.map((b) => b.x)).toFixed(2)} z ${Math.min(...bare.map((b) => b.z)).toFixed(2)}`
      + `..${Math.max(...bare.map((b) => b.z)).toFixed(2)}`
    : '');
  // NEGATIVE CONTROL: take away one course and the band it lay on must come back bare — and come
  // back WHERE THAT COURSE WAS, which is the part that proves the sampler is reading the roof and
  // not just counting. Its neighbours lap it top and bottom, so what shows is the strip between
  // their laps, narrower than the course itself and inside its footprint.
  const dropped = model.members.find((m) => m.id === 'CV-roofingCourse-03')!;
  const gone = bareDeck(model.members.filter((m) => m !== dropped));
  assert.ok(gone.length > 0, `with ${dropped.id} removed the sampler still found no bare deck — `
    + 'it cannot see a missing course, so its silence on the whole roof means nothing');
  const b = box(dropped);
  const zs = gone.map((k) => k.z);
  assert.ok(Math.min(...zs) > b.z[0] - 1e-9 && Math.max(...zs) < b.z[1] + 1e-9,
    `without ${dropped.id} the bare band runs z ${Math.min(...zs).toFixed(3)}..${Math.max(...zs).toFixed(3)}, `
    + `outside the course's own ${b.z[0].toFixed(3)}..${b.z[1].toFixed(3)}`);
});

test('and the two gable ends are tiled edge to edge, in one rake with no staircase in it', () => {
  // The gable triangles are the only part of this building above the plates, and they are closed
  // in by vertical strips each cut to the middle of the rake it spans. What can go wrong is
  // visible from the end of the building: a strip missing (a hole through to the framing), a strip
  // overlapping its neighbour, or a step between neighbours big enough to read as a staircase
  // rather than a cut line. The step doctrine allows is `TOLERANCE.rakeStepFt`, and the claim is
  // restated here as a figure rather than imported, so that changing the tolerance has to be a
  // decision and not a silent re-baseline.
  const stepFt = 3 / IN_PER_FT;
  const { model, built } = gp();
  const infill = model.members.filter((m) => m.id.startsWith('RK-'));
  assert.ok(infill.length > 20, `${infill.length} pieces closing in the gables — they are not being tiled`);
  assert.deepEqual([...new Set(infill.map((m) => String(m.wall)))].sort(), ['E', 'W'],
    'a gable has two ends and they are the two that need closing in');
  const ridge = box(model.members.find((m) => m.role === 'ridge')!);
  for (const s of built.walls.surfaces) {
    const here = infill.filter((m) => m.wall === s.wall).map((m) => ({ m, b: box(m) }));
    if (!here.length) continue;
    const along = (b: Box): [number, number] => {
      const p = [b.x[0], b.z[0]], q = [b.x[1], b.z[1]];
      const a = (p[0]! - s.origin[0]) * s.along[0] + (p[1]! - s.origin[1]) * s.along[1];
      const c = (q[0]! - s.origin[0]) * s.along[0] + (q[1]! - s.origin[1]) * s.along[1];
      return [Math.min(a, c), Math.max(a, c)];
    };
    const strips = here.map((k) => ({ ...k, u: along(k.b) })).sort((a, b) => a.u[0] - b.u[0]);
    for (const k of strips) {
      assert.ok(Math.abs(k.b.y[0] - built.walls.plateTopY) < 1e-9,
        `${k.m.id} starts at ${k.b.y[0].toFixed(4)}, not on the cap plate at ${built.walls.plateTopY.toFixed(4)}`);
    }
    // Edge to edge: each strip starts where the last one ended.
    for (let i = 0; i + 1 < strips.length; i++) {
      const gap = strips[i + 1]!.u[0] - strips[i]!.u[1];
      assert.ok(Math.abs(gap) < 1e-6,
        `${s.wall}: ${(gap * IN_PER_FT).toFixed(3)} in ${gap > 0 ? 'of gap' : 'of overlap'} between `
        + `${strips[i]!.m.id} and ${strips[i + 1]!.m.id}`);
    }
    // ONE PEAK, and it reaches the ridge board the triangle is cut around.
    const tops = strips.map((k) => k.b.y[1]);
    const peak = tops.indexOf(Math.max(...tops));
    for (let i = 1; i <= peak; i++) assert.ok(tops[i]! >= tops[i - 1]! - 1e-9, `${s.wall}: the rake falls before the peak`);
    for (let i = peak + 1; i < tops.length; i++) assert.ok(tops[i]! <= tops[i - 1]! + 1e-9, `${s.wall}: the rake rises after the peak`);
    assert.ok(tops[peak]! >= ridge.y[0] - 1e-9 && tops[peak]! <= ridge.y[1] + 1e-9,
      `${s.wall}: the gable peaks at ${tops[peak]!.toFixed(4)} and the ridge board runs `
      + `${ridge.y[0].toFixed(4)}..${ridge.y[1].toFixed(4)} — the triangle stops short of its own ridge`);
    // ONE STRAIGHT RAKE, at the roof's own pitch. The tops are FITTED — least squares over the
    // strip midpoints on each side of the peak — rather than compared against a profile this test
    // recomputes. What a person sees from the end of the building is whether the cut line is
    // straight and whether it runs at the same slope as the roof over it; a staircase, a kink, or
    // a rake at the wrong pitch all fail this, and nothing else here would catch them.
    for (const [lo, hi, want] of [[0, peak, +1], [peak + 1, strips.length, -1]] as const) {
      const side = strips.slice(lo, hi);
      if (side.length < 3) continue;
      const pts = side.map((k) => [(k.u[0] + k.u[1]) / 2, k.b.y[1]] as const);
      const n = pts.length;
      const su = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
      const suu = pts.reduce((a, p) => a + p[0] * p[0], 0), suy = pts.reduce((a, p) => a + p[0] * p[1], 0);
      const slope = (n * suy - su * sy) / (n * suu - su * su);
      const icept = (sy - slope * su) / n;
      assert.ok(Math.abs(slope - want * 4 / 12) < 0.01,
        `${s.wall}: the rake ${want > 0 ? 'up to' : 'down from'} the peak runs at `
        + `${(slope * 12).toFixed(3)} in 12, and the roof over it is 4 in 12`);
      for (const [u, y] of pts) {
        const off = y - (slope * u + icept);
        assert.ok(Math.abs(off) <= stepFt + 1e-9,
          `${s.wall}: a strip at u=${u.toFixed(3)} tops out ${(off * IN_PER_FT).toFixed(2)} in off the `
          + 'straight rake its neighbours make — the cut line has a kink in it');
      }
    }
  }
});
