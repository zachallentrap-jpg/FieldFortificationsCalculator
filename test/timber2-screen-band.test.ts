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

test('and it has a HEAD as well as a sill — the band carries its own cutout', () => {
  // `cutouts` lists the band itself with a negative `openingIndex`, so the siding is cut away over
  // it. Treated as an opening, it told the band not to frame its own head: every wall of every
  // screened hut lost the whole top row and the screen had nothing along its upper edge.
  for (const id of SCREENED) {
    const { frame, heights, walls } = screened(id);
    for (const s of walls.surfaces) {
      for (const v of heights) {
        const row = frame.filter((f) => f.wall === s.wall && Math.abs(f.position[1] - v) < 1e-6);
        assert.ok(row.length > 0,
          `${id}: the ${s.wall} wall has no band framing at v=${v} — the row is missing entirely`);
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
    const { model, frame, heights, walls } = screened(id);
    const wallPieces = model.members.filter((m) => m.wall !== undefined && m.role !== 'siding'
      && m.role !== 'screenPanel' && m.role !== 'brace');
    for (const s of walls.surfaces) {
      const here = [...wallPieces, ...frame].filter((m) => m.wall === s.wall);
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
