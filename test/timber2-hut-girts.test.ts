// The huts' girts, against the studs they are nailed to.
//
// A GIRT IS NAILED TO THE STUDS; IT IS NOT IN THE SAME PLANE AS THEM. `WallSurface.origin` is the
// wall's CENTRELINE, and the girt was placed on it with no offset — so a 2x4 girt sat dead in the
// middle of a 3½-in wall and passed clean through every stud it crossed, sharing the whole
// 1½ × 3½ × 1½-in block at each one. On the shipped presets:
//
//   sea hut 70   swa hut 78   b-hut 72   squad hut 102   guard shack 27   latrine 40
//
// plus every king stud and jack stud at every opening, and the door braces. That the run is
// continuous is the POINT of the piece — "a girt is CUT at an opening on site, and the take-off
// bills the stock it is cut from" — and is not the fault. The fault is the plane.
//
// INBOARD, because that is the side that is clear: the siding is outboard of the studs and the
// let-in braces are notched into their outer face, so a girt on the outside runs into both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { FAMILY_TABLE } from '../src/timber/catalog';
import { HUT, IN_PER_FT } from '../src/timber/doctrine';
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

/** World box. Every piece in a hut wall is yawed by a multiple of a right angle, so a box IS it. */
function box(m: Member): { x: [number, number]; y: [number, number]; z: [number, number] } {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const overlap = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
const shared = (a: Member, b: Member): [number, number, number] | null => {
  const p = box(a), q = box(b);
  const d: [number, number, number] = [overlap(p.x, q.x), overlap(p.y, q.y), overlap(p.z, q.z)];
  return d.every((v) => v > 1e-9) ? d : null;
};

/** Every variant that carries girts, which is every hut. */
const HUTS = ['sea-hut', 'swa-hut', 'b-hut', 'squad-hut', 'guard-shack', 'latrine'];

const hut = (id: string) => {
  const model = generateStructure(JSON.parse(JSON.stringify(FAMILY_TABLE.find((f) => f.id === id)!.preset)));
  return {
    model,
    girts: model.members.filter((m) => m.role === 'girt'),
    /**
     * Studs of the four WALLS. A partition's pieces carry no `wall` id, and the through-wall
     * girts still cross a partition's end studs where one lands on an exterior wall — six pairs
     * on the b-hut, the only shipped hut with partitions. That is the same case as an opening,
     * where the girt is cut on site, except that there IS wood there; it is written up in the
     * sweep rather than smuggled into this assertion.
     */
    studs: model.members.filter((m) => ['stud', 'kingStud', 'jackStud', 'cripple'].includes(m.role)
      && m.wall !== undefined),
    braces: model.members.filter((m) => m.role === 'brace' || m.role === 'doorBrace'),
    siding: model.members.filter((m) => m.role === 'siding'),
  };
};

test('A GIRT IS NAILED TO THE STUDS — it used to run clean through every one it crossed', () => {
  for (const id of HUTS) {
    const { girts, studs } = hut(id);
    assert.ok(girts.length >= 4, `${id}: ${girts.length} girts`);
    assert.ok(studs.length > 20, `${id}: ${studs.length} wall studs`);
    for (const g of girts) {
      for (const s of studs) {
        const d = shared(g, s);
        assert.equal(d, null, d
          ? `${id}: ${g.id} and ${s.id} (${s.role}) share `
            + `${d.map((v) => (v * IN_PER_FT).toFixed(2)).join(' x ')} in of wood`
          : '');
      }
    }
  }
});

test('and it is clear of the outside too — the siding and the let-in braces are untouched', () => {
  // The other face was not available: siding is applied outboard of the studs and a let-in brace
  // is notched into their OUTER face, so a girt put there would trade one collision for two.
  for (const id of HUTS) {
    const { girts, braces, siding } = hut(id);
    for (const g of girts) {
      for (const o of [...braces, ...siding]) {
        const d = shared(g, o);
        assert.equal(d, null, d
          ? `${id}: ${g.id} and ${o.id} (${o.role}) share `
            + `${d.map((v) => (v * IN_PER_FT).toFixed(2)).join(' x ')} in of wood`
          : '');
      }
    }
  }
});

test('THE CLEAR RUN IS CLEAR OF THE OTHER WALLS, on all four sides alike', () => {
  // A rectangle is framed with one pair of walls running through and the other pair butting
  // between them, so a through wall's own run is the whole outside length and its ends are INSIDE
  // the butting walls. In the stud plane that never showed. Moved inboard, where the butting walls
  // are, each end landed in a corner stud — and the comparison that trims it sits on a knife edge,
  // a butting wall's face landing exactly on the through wall's end. Without a tolerance the N
  // wall's rounding fell the other way from the S wall's: on the b-hut the S girt came out at
  // 35.417 ft and the N girt at 35.708, one of them still in a corner stud and the other not.
  for (const id of HUTS) {
    const { girts } = hut(id);
    const byWall = new Map<string, Member[]>();
    for (const g of girts) {
      const k = String(g.wall);
      byWall.set(k, [...(byWall.get(k) ?? []), g]);
    }
    assert.equal(byWall.size, 4, `${id}: girts on ${byWall.size} walls`);
    // OPPOSITE WALLS MATCH. A square hut has one girt length and an oblong two, so counting
    // distinct lengths says nothing; what a one-ended trim breaks is the pair. S must equal N and
    // E must equal W, and it is exactly that which came apart — 35.417 against 35.708 on the
    // b-hut, a difference of one wall thickness.
    const len = (w: string): number => byWall.get(w)![0]!.cutLength;
    for (const [a, b] of [['S', 'N'], ['E', 'W']] as const) {
      assert.ok(Math.abs(len(a) - len(b)) < 1e-9,
        `${id}: the ${a} girt is ${(len(a) / IN_PER_FT).toFixed(4)} ft and the ${b} girt is `
        + `${(len(b) / IN_PER_FT).toFixed(4)} — one of the pair was trimmed at one end only`);
    }
  }
});

test('and every wall still gets its girts, at the spacing doctrine sets', () => {
  // The guard on the move: a girt that has been shifted out of the wall is no use if one of them
  // went missing on the way.
  const spacing = HUT.girtSpacingFt.value as number;
  for (const id of HUTS) {
    const { girts, model } = hut(id);
    const walls = new Set(girts.map((g) => String(g.wall)));
    assert.equal(walls.size, 4, `${id}: girts on ${[...walls].join(',')}`);
    const heights = [...new Set(girts.map((g) => Math.round(g.position[1] * 1e6) / 1e6))].sort((a, b) => a - b);
    for (let i = 0; i < heights.length; i++) {
      assert.ok(Math.abs(heights[i]! - spacing * (i + 1)) < 1e-9,
        `${id}: girt level ${i + 1} is at ${heights[i]!.toFixed(4)} ft, not ${(spacing * (i + 1)).toFixed(4)}`);
    }
    // And they are inboard of the wall, which is where they were put.
    const plates = model.members.filter((m) => m.role === 'solePlate' && m.wall !== undefined);
    assert.ok(plates.length >= 4, `${id}: the walls have plates`);
    for (const g of girts) {
      const plate = plates.find((p) => p.wall === g.wall)!;
      const pb = box(plate), gb = box(g);
      const thin = pb.x[1] - pb.x[0] < pb.z[1] - pb.z[0] ? 'x' : 'z';
      const inside = thin === 'x'
        ? (gb.x[0] >= pb.x[1] - 1e-9 || gb.x[1] <= pb.x[0] + 1e-9)
        : (gb.z[0] >= pb.z[1] - 1e-9 || gb.z[1] <= pb.z[0] + 1e-9);
      assert.ok(inside, `${id}: ${g.id} is still inside the wall's own thickness`);
    }
  }
});
