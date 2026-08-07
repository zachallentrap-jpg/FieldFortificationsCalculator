// The screened band's sill and head, against the wall they are framed into.
//
// THE SILL AND THE HEAD ARE FRAMING, AND FRAMING GOES BETWEEN. They were emitted as one piece the
// full run of the wall, on the wall's CENTRELINE — so each ran clean through every stud it crossed,
// sharing the whole 1½ × 3½ × 1½-in block at each one:
//
//   sea hut 190 pairs      latrine 88 pairs
//
// and, at the head, 39 × 2¾ × ¾ in out of a door header as well. The comment on the band has said
// "between the studs" since it was written and the nailing note has said `2-16d ea end`, which is a
// piece with two ends — neither describes a ribbon run past them. The girt next door is the
// opposite case and got the opposite fix: a girt IS continuous, so it moved onto a face.
//
// Three things had to be true at once, and each was wrong on the first attempt:
//   · the band must not frame its own head out of existence — `cutouts` carries the BAND as a
//     cutout with a negative `openingIndex`, and matching it dropped the whole head row;
//   · what is in the way at the head is not "the studs" — it is the cripples over each opening
//     and the header itself;
//   · and those obstructions OVERLAP, so a sorted list walked in pairs finds a gap inside a
//     header and frames across it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { generateBuilding } from '../src/timber/families/building';
import { buildingSpecForHut, bandFor } from '../src/timber/families/hut';
import { FAMILY_TABLE } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
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

/** The two shipped huts with a screened band. */
const SCREENED = ['sea-hut', 'latrine'];

function screened(id: string) {
  const spec = JSON.parse(JSON.stringify(FAMILY_TABLE.find((f) => f.id === id)!.preset));
  const model = generateStructure(spec);
  const walls = generateBuilding(buildingSpecForHut(spec)).walls;
  const band = bandFor(spec)!;
  return {
    model,
    walls,
    band,
    heights: [band.sillFt, band.sillFt + band.heightFt],
    frame: model.members.filter((m) => m.role === 'screenFrame'),
    // Everything the wall pass put in this wall — the frame has to fit around all of it, not just
    // the studs.
    framing: model.members.filter((m) => m.wall !== undefined
      && ['stud', 'kingStud', 'jackStud', 'cripple', 'header', 'sill', 'solePlate', 'topPlate', 'capPlate']
        .includes(m.role)),
  };
}

test('THE BAND IS FRAMED BETWEEN THE WALL, not through it', () => {
  for (const id of SCREENED) {
    const { frame, framing } = screened(id);
    assert.ok(frame.length > 8, `${id}: ${frame.length} band pieces — it is not being framed per bay`);
    assert.ok(framing.length > 30, `${id}: ${framing.length} wall pieces to fit around`);
    for (const f of frame) {
      for (const w of framing) {
        const d = shared(f, w);
        assert.equal(d, null, d
          ? `${id}: ${f.id} and ${w.id} (${w.role}) share `
            + `${d.map((v) => (v * IN_PER_FT).toFixed(2)).join(' x ')} in of wood`
          : '');
      }
    }
  }
});

test('THE BAND FILLS ITS OWN HOLE — the screen used to sit 1 1/2 in below it', () => {
  // `wallContract` OWNS the datum and says so: a band is "measured from the sole-plate TOP, like
  // an opening's sill", and it adds the plate thickness itself when it turns the band into the
  // cutout the siding is laid around. The band's own members were placed at the raw figure, which
  // is the sole-plate BOTTOM — so the siding lapped the screen by 1½ in along the bottom, and
  // along the top there was a 1½-in strip with neither siding nor screen on it. An open slot right
  // round the hut under the eave: 96 ft of it on a sea hut.
  //
  // The hole is the authority here, read off the contract, and the screen has to fill it exactly.
  for (const id of SCREENED) {
    const { model, walls } = screened(id);
    for (const s of walls.surfaces) {
      const hole = s.cutouts.find((c) => c.openingIndex < 0);
      assert.ok(hole, `${id}: the ${s.wall} wall has no band cutout`);
      const screen = model.members.find((m) => m.role === 'screenPanel' && m.wall === s.wall);
      assert.ok(screen, `${id}: the ${s.wall} wall has no screen`);
      const y = box(screen!).y;
      assert.ok(Math.abs(y[0] - hole!.v0) < 1e-9 && Math.abs(y[1] - hole!.v1) < 1e-9,
        `${id}: the ${s.wall} screen spans ${y[0].toFixed(4)}..${y[1].toFixed(4)} and the hole cut `
        + `for it is ${hole!.v0.toFixed(4)}..${hole!.v1.toFixed(4)} — `
        + `${((hole!.v0 - y[0]) * IN_PER_FT).toFixed(2)} in out at the bottom, `
        + `${((hole!.v1 - y[1]) * IN_PER_FT).toFixed(2)} in at the top`);
      // And no siding strictly inside the hole, so there is nothing lapping over the screen.
      for (const sid of model.members.filter((m) => m.role === 'siding' && m.wall === s.wall)) {
        const b = box(sid).y;
        const bite = Math.min(b[1], hole!.v1) - Math.max(b[0], hole!.v0);
        assert.ok(bite <= 1e-9,
          `${id}: ${sid.id} laps ${(bite * IN_PER_FT).toFixed(2)} in over the ${s.wall} band`);
      }
    }
  }
});

test('and it has a HEAD as well as a sill, both inside the hole', () => {
  // `cutouts` lists the band itself with a negative `openingIndex`. Treated as an opening, it told
  // the band not to frame its own head and every wall lost its top row. Then, with the band raised
  // onto the right datum, a head CENTRED on the band's top reached 7.771 where the top plate starts
  // at 7.750 — 1/8 in of interference, which made a 32-ft plate an obstruction and took the row out
  // again. There is only 1½ in of wall above the band, which is no room for a 3½-in member: the
  // sill sits on the band's bottom and the head under its top, inside the light they frame.
  for (const id of SCREENED) {
    const { frame, walls } = screened(id);
    for (const s of walls.surfaces) {
      const hole = s.cutouts.find((c) => c.openingIndex < 0)!;
      const rows = [...new Set(frame.filter((f) => f.wall === s.wall)
        .map((f) => Math.round(f.position[1] * 1e6) / 1e6))].sort((a, b) => a - b);
      assert.equal(rows.length, 2,
        `${id}: the ${s.wall} wall has ${rows.length} rows of band framing, not a sill and a head`
        + ` (${rows.map((r) => r.toFixed(4)).join(', ')})`);
      for (const f of frame.filter((x) => x.wall === s.wall)) {
        const b = box(f).y;
        assert.ok(b[0] >= hole.v0 - 1e-9 && b[1] <= hole.v1 + 1e-9,
          `${id}: ${f.id} spans ${b[0].toFixed(4)}..${b[1].toFixed(4)}, outside the band's own `
          + `${hole.v0.toFixed(4)}..${hole.v1.toFixed(4)}`);
      }
    }
  }
});

test('nothing is framed across a doorway, and nothing is left unframed where the wall is solid', () => {
  // Sampled along each wall at each band height: every point is either inside an opening — where
  // there is nothing, and a piece run across it would bar the door — or covered by SOME piece of
  // wall, which after the fix means the framing that was already there or the band cut between it.
  //
  // This one passes on the old code too, and says so: a ribbon run the whole wall covers
  // everything. It is the guard on the fix — that cutting the band into bays did not drop one.
  for (const id of SCREENED) {
    const { model, frame, walls } = screened(id);
    const wallPieces = model.members.filter((m) => m.wall !== undefined && m.role !== 'siding'
      && m.role !== 'screenPanel' && m.role !== 'brace');
    for (const s of walls.surfaces) {
      const here = [...wallPieces, ...frame].filter((m) => m.wall === s.wall);
      // The rows the model actually has, not a pair of numbers restated here.
      const heights = [...new Set(frame.filter((f) => f.wall === s.wall)
        .map((f) => Math.round(f.position[1] * 1e6) / 1e6))];
      for (const v of heights) {
        const open = s.cutouts.filter((c) => c.openingIndex >= 0 && c.v0 - 1e-9 <= v && v <= c.v1 + 1e-9);
        for (let u = 0.05; u < s.runFt; u += 0.05) {
          const p: [number, number] = [
            s.origin[0] + s.along[0] * u,
            s.origin[1] + s.along[1] * u,
          ];
          if (open.some((c) => c.u0 - 1e-9 <= u && u <= c.u1 + 1e-9)) {
            // In an opening: no band piece may cross it.
            for (const f of frame.filter((m) => m.wall === s.wall && Math.abs(m.position[1] - v) < 1e-6)) {
              const b = box(f);
              assert.ok(!(b.x[0] - 1e-9 <= p[0] && p[0] <= b.x[1] + 1e-9
                && b.z[0] - 1e-9 <= p[1] && p[1] <= b.z[1] + 1e-9),
              `${id}: ${f.id} runs across the opening on the ${s.wall} wall at u=${u.toFixed(2)}`);
            }
            continue;
          }
          const covered = here.some((m) => {
            const b = box(m);
            return b.x[0] - 1e-9 <= p[0] && p[0] <= b.x[1] + 1e-9
              && b.z[0] - 1e-9 <= p[1] && p[1] <= b.z[1] + 1e-9
              && b.y[0] - 1e-9 <= v && v <= b.y[1] + 1e-9;
          });
          assert.ok(covered,
            `${id}: nothing at all on the ${s.wall} wall at u=${u.toFixed(2)}, v=${v} — `
            + 'the band was cut into bays and one of them went missing');
        }
      }
    }
  }
});
