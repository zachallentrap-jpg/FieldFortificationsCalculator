// The corners of every building, where two skins meet.
//
// A WALL'S SKIN COVERS THE FACE IT PRESENTS TO THE WEATHER, AND ON A BUTTING WALL THAT FACE RUNS
// CORNER TO CORNER. `WallSurface.runFt` is the wall's CLEAR STRUCTURAL SPAN: a rectangle is framed
// with one pair of walls running through and the other pair butting between them, so the butting
// pair's run starts and ends at the through walls' INNER faces — one full wall thickness short of
// the outside corner at each end. The covering pass tiled exactly `runFt`, so on every shipped
// building a 3½-in-wide strip of bare framing stood in each of the four corners, sole plate to cap
// plate, with the two sidings looking past each other and neither one covering it:
//
//   gp-frame  4 x 3.5 in x 8 ft      storage shed  the same      every hut  the same
//
// It never showed as DAYLIGHT, which is why it survived: the through wall's own corner stud fills
// the wall's thickness right behind the strip, so nothing could be seen through it — only the
// stud, half an inch back, in a channel between two sheets of siding. That is what a plan-view
// screenshot of a shed roof showed as a white line down the corner.
//
// The extension is to the through wall's OUTER face, which is where that face genuinely ends. The
// two skins then meet along the corner arris — perpendicular planes intersecting exactly there,
// so they touch and neither runs into the other. Both halves of that are asserted here, because
// area alone cannot tell an overlap from a gap of the same size.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { generateBuilding } from '../src/timber/families/building';
import { buildingSpecForHut } from '../src/timber/families/hut';
import { shippedFamilies } from '../src/timber/catalog';
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

function box(m: Member): Box {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const WALL_SKIN = ['siding', 'sidingBoard', 'sheathingPanel'];
const ALL_SKIN = [...WALL_SKIN, 'batten'];

interface Skinned {
  id: string;
  model: ReturnType<typeof generateStructure>;
  walls: ReturnType<typeof generateBuilding>['walls'];
  dims: { lengthFt: number; widthFt: number };
}

/**
 * Every shipped structure whose walls come from the building wall system and carry a skin.
 *
 * FROM `model.spec`, NOT THE PRESET. `generateStructure` normalizes before it generates, and the
 * contract rebuilt from a raw preset is not the one the model was built against — on the guard
 * shack the two disagree about the window sill by 4 in, which reads as siding lapping into an
 * opening that is not where the test thinks it is.
 */
function skinned(): Skinned[] {
  const out: Skinned[] = [];
  for (const f of shippedFamilies()) {
    const model = generateStructure(JSON.parse(JSON.stringify(f.preset)));
    const spec = model.spec as unknown as { family: string } & Record<string, unknown>;
    if (spec.family !== 'building' && spec.family !== 'hut') continue;
    if (!model.members.some((m) => WALL_SKIN.includes(m.role))) continue;
    const bs = (spec.family === 'hut' ? buildingSpecForHut(spec as never) : spec) as never as
      { dims: { lengthFt: number; widthFt: number } };
    out.push({ id: f.id, model, walls: generateBuilding(bs as never).walls, dims: bs.dims });
  }
  return out;
}

/** A member's extent along a wall surface's own run, in that surface's u. */
function alongRun(b: Box, s: { origin: [number, number]; along: [number, number] }): [number, number] {
  const us = [b.x[0], b.x[1]].flatMap((x) => [b.z[0], b.z[1]]
    .map((z) => (x - s.origin[0]) * s.along[0] + (z - s.origin[1]) * s.along[1]));
  return [Math.min(...us), Math.max(...us)];
}

test('THE SKIN REACHES THE CORNER — it used to stop one wall thickness short at each end', () => {
  // Stated in WORLD coordinates against the building's own outside rectangle, so it says nothing
  // about how the run is computed: a wall's skin covers its whole side of the building, end to
  // end. A butting wall's `runFt` cannot satisfy this and a through wall's already does.
  const all = skinned();
  assert.ok(all.length >= 6, `${all.length} shipped structures with a skin`);
  for (const { id, model, walls, dims } of all) {
    for (const s of walls.surfaces) {
      const mine = model.members.filter((m) => m.wall === s.wall && WALL_SKIN.includes(m.role)
        && !m.id.startsWith('RK-')).map((m) => box(m));
      if (!mine.length) continue;   // an open front has no skin at all, which is its own test
      const axis = Math.abs(s.along[0]) > 0.5 ? 'x' : 'z';
      const side = axis === 'x' ? dims.lengthFt : dims.widthFt;
      const lo = Math.min(...mine.map((b) => b[axis][0]));
      const hi = Math.max(...mine.map((b) => b[axis][1]));
      assert.ok(Math.abs(lo) < 1e-9 && Math.abs(hi - side) < 1e-9,
        `${id} ${s.wall}: the skin runs ${axis} ${lo.toFixed(4)}..${hi.toFixed(4)} and that side of `
        + `the building runs 0..${side.toFixed(4)} — short ${(lo * IN_PER_FT).toFixed(2)} in at one `
        + `end, ${((side - hi) * IN_PER_FT).toFixed(2)} in at the other`);
    }
  }
});

test('and the two skins MEET at the arris — neither runs into the other', () => {
  // The guard on the fix, and it passes on the old generator too: closing a gap by overlapping
  // is not closing it. Two perpendicular planes intersect in a line, so a piece on one and a
  // piece on the other may touch and must not share volume.
  const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  for (const { id, model } of skinned()) {
    const skin = model.members.filter((m) => ALL_SKIN.includes(m.role) && m.wall !== undefined)
      .map((m) => ({ m, b: box(m) }));
    for (let i = 0; i < skin.length; i++) {
      for (let j = i + 1; j < skin.length; j++) {
        const a = skin[i]!, b = skin[j]!;
        if (a.m.wall === b.m.wall) continue;   // one wall's own laps are its own business
        const d: V3 = [ov(a.b.x, b.b.x), ov(a.b.y, b.b.y), ov(a.b.z, b.b.z)];
        assert.ok(!d.every((v) => v > 1e-9),
          `${id}: ${a.m.id} (${a.m.wall}) and ${b.m.id} (${b.m.wall}) share `
          + `${d.map((v) => (v * IN_PER_FT).toFixed(3)).join(' x ')} in of wood at the corner`);
      }
    }
  }
});

test('and every opening is still where it was cut — the origin moved, the holes did not', () => {
  // Reaching past the run means the tiler's u = 0 is no longer the surface's origin, so every
  // cutout is shifted with it. Get that wrong by the wall thickness and every door and window on
  // the butting walls slides 3½ in along the wall, which no area check would notice.
  for (const { id, model, walls } of skinned()) {
    for (const s of walls.surfaces) {
      const mine = model.members.filter((m) => m.wall === s.wall && WALL_SKIN.includes(m.role)
        && !m.id.startsWith('RK-')).map((m) => ({ m, b: box(m) }));
      if (!mine.length) continue;
      for (const c of s.cutouts) {
        if (c.openingIndex < 0) continue;   // a band is not an opening in the wall
        for (const k of mine) {
          const [u0, u1] = alongRun(k.b, s);
          const du = Math.min(c.u1, u1) - Math.max(c.u0, u0);
          const dv = Math.min(c.v1, k.b.y[1]) - Math.max(c.v0, k.b.y[0]);
          assert.ok(!(du > 1e-9 && dv > 1e-9),
            `${id} ${s.wall}: ${k.m.id} covers ${(du * IN_PER_FT).toFixed(2)} x `
            + `${(dv * IN_PER_FT).toFixed(2)} in of the opening at u ${c.u0.toFixed(3)}..${c.u1.toFixed(3)}`);
        }
      }
    }
  }
});

test('the corner is closed ABOVE the plate too, where a gable end or a shed rake stands', () => {
  // The infill tiles the same run and stopped in the same place. On a gable end the triangle is
  // under two inches tall at the outside corner and it hardly showed; on a SHED's rake wall the
  // corner strip at the high end is the pony wall's full height, and that is a hole you could put
  // an arm through. Same claim as the skin below the plate, in the same world coordinates.
  for (const { id, model, walls, dims } of skinned()) {
    for (const s of walls.surfaces) {
      const inf = model.members.filter((m) => m.wall === s.wall && m.id.startsWith('RK-')
        && ALL_SKIN.includes(m.role)).map((m) => box(m));
      if (!inf.length) continue;
      const axis = Math.abs(s.along[0]) > 0.5 ? 'x' : 'z';
      const side = axis === 'x' ? dims.lengthFt : dims.widthFt;
      const lo = Math.min(...inf.map((b) => b[axis][0]));
      const hi = Math.max(...inf.map((b) => b[axis][1]));
      assert.ok(Math.abs(lo) < 1e-9 && Math.abs(hi - side) < 1e-9,
        `${id} ${s.wall}: the infill runs ${axis} ${lo.toFixed(4)}..${hi.toFixed(4)} and that side of `
        + `the building runs 0..${side.toFixed(4)} — the rake stops `
        + `${(lo * IN_PER_FT).toFixed(2)} in / ${((side - hi) * IN_PER_FT).toFixed(2)} in short of the corner`);
    }
  }
});
