// Where two sheets of plywood meet on a wall.
//
// A SHEET EDGE IS NAILED TO A STUD. It is the whole reason 4x8 goods stand on end on a 16-in
// layout — 48 is three studs — and `generateWallCovering` says so twice, in a comment (*"Sheets
// stand on end (4 ft wide, 8 ft tall) so joints land on studs"*) and in every panel's own
// `doctrineRef` (*"joints on studs, cut around openings"*). On the N and S walls of every card it
// is true. On the gable ends it was not:
//
//   b-hut E wall     joints at z = 4, 8, 12       studs at 4.229..4.354, 8.229..8.354, ...
//                    every one 2.75 in clear of the nearest wood
//
//   32 of 193 field joints across the seven clad cards, every one on an E or W wall, every one
//   2.75 in — one for one, the same figure on all of them.
//
// THE CAUSE IS A FIX THAT LANDED EARLIER IN THIS SWEEP. A rectangle is framed with one pair of
// walls running through and the other butting between them, so the butting pair's structural run
// stops a wall thickness short of the outside corner at each end — and tiling exactly that run
// *"left a 3½-in-wide strip of bare framing standing in every corner of every building"*. The skin
// was therefore extended to the through wall's outer face, which is right. What went with it was
// the DATUM: the sheet grid is struck from the surface's start, the studs are laid out from the
// frame's, and after the extension those are half a wall thickness apart. Half of 3½ less half a
// stud face is 2¾ in, on every card, at every joint.
//
// So the first sheet of each wall is RIPPED to the last stud that fits inside one sheet — 35½ in
// on a 2x4 wall at 16 in o.c. — and every joint after it lands on a stud. That is what a framer
// does at a corner and it costs one rip. Striking the grid at the frame's datum instead would land
// the joints equally well and leave a 3½-in ribbon of plywood down every corner of every building.
//
// The area is not touched: the same skin, cut in the right places. Every card comes out to the
// square foot it did before, with four more pieces on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { firstSheetFt, tileSurface } from '../src/timber/subsystems/coverings';
import { PANEL, IN_PER_FT } from '../src/timber/doctrine';
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

interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

function box(m: Member): Box {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: 0 | 1 | 2): [number, number] => [
    Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))];
  return { x: g(0), y: g(1), z: g(2) };
}

/** Vertical framing a sheet edge can be nailed to. */
const NAILERS = ['stud', 'kingStud', 'jackStud', 'cripple'];

/** Sheet goods laid on a WALL — `CV-` is the wall pass; `RK-` closes in above the plate. */
const skinOf = (members: Member[]): Member[] => members.filter((m) => m.id.startsWith('CV-')
  && /panel/.test(m.nominal) && !!m.wall && (m.role === 'siding' || m.role === 'sheathingPanel'));

/** Which plan axis a wall runs along. */
const runAxis = (wall: string): 'x' | 'z' => (wall === 'N' || wall === 'S' ? 'x' : 'z');

function clad(): { id: string; members: Member[]; skin: Member[] }[] {
  const out: { id: string; members: Member[]; skin: Member[] }[] = [];
  for (const f of shippedFamilies()) {
    const members = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const skin = skinOf(members);
    if (skin.length) out.push({ id: f.id, members, skin });
  }
  assert.ok(out.length >= 6, `${out.length} cards carry sheet goods on their walls`);
  return out;
}

/**
 * Every joint in the FIELD of a wall, with the sheets that make it.
 *
 * "Field" because a sliver above a header or under a sill is a different piece of carpentry: it is
 * part of the sheet that ran past the opening, and what backs it is the header. Only a joint that
 * both sheets run real height at is a joint a stud has to be behind.
 */
function fieldJoints(skin: Member[], wall: string): number[] {
  const a3 = runAxis(wall);
  const ms = skin.filter((m) => m.wall === wall);
  const out: number[] = [];
  for (const a of ms) {
    for (const b of ms) {
      const ba = box(a), bb = box(b);
      if (Math.abs(ba[a3][1] - bb[a3][0]) > 1e-6) continue;
      if (Math.min(ba.y[1], bb.y[1]) - Math.max(ba.y[0], bb.y[0]) < 2) continue;
      out.push(ba[a3][1]);
    }
  }
  return out;
}

test('EVERY SHEET JOINT IN THE FIELD OF A WALL LANDS ON A STUD', () => {
  let joints = 0;
  for (const { id, members, skin } of clad()) {
    for (const wall of [...new Set(skin.map((m) => m.wall!))]) {
      const a3 = runAxis(wall);
      const nailers = members.filter((m) => NAILERS.includes(m.role) && m.wall === wall);
      assert.ok(nailers.length > 2, `${id} ${wall}: ${nailers.length} nailers`);
      for (const j of fieldJoints(skin, wall)) {
        joints++;
        const d = Math.min(...nailers.map((s) => {
          const e = box(s)[a3];
          return Math.max(e[0] - j, j - e[1], 0);
        }));
        assert.ok(d < 1e-4,
          `${id} ${wall}: two sheets butt at ${a3}=${j.toFixed(4)}, which is `
          + `${(d * IN_PER_FT).toFixed(3)} in clear of the nearest stud — a sheet edge is nailed to one`);
      }
    }
  }
  assert.ok(joints > 150, `${joints} field joints across the catalog — the scan has gone blind`);
});

test('and the wall is still covered CORNER TO CORNER, with nothing doubled', () => {
  // The guard on the other direction, and the one a fix that merely moved the grid later would
  // fail: the skin reaches past the frame's run to the through wall's outer face at each end, and
  // shortening the tiling instead of ripping the first sheet would put the bare 3½-in corner strip
  // back — which is the defect an earlier pass in this sweep fixed.
  for (const { id, skin } of clad()) {
    for (const wall of [...new Set(skin.map((m) => m.wall!))]) {
      const a3 = runAxis(wall);
      const iv = skin.filter((m) => m.wall === wall).map((m) => box(m)[a3])
        .sort((p, q) => p[0] - q[0]);
      let hi = iv[0]![1];
      for (const [lo, up] of iv.slice(1)) {
        assert.ok(lo <= hi + 1e-6,
          `${id} ${wall}: a ${((lo - hi) * IN_PER_FT).toFixed(2)} in strip of bare wall at `
          + `${a3}=${hi.toFixed(3)} — the skin has a hole in it`);
        hi = Math.max(hi, up);
      }
      // And whole feet at both ends: the corner is the crossing wall's OUTER face, which on every
      // card in the catalog is a round figure.
      const lo0 = iv[0]![0];
      for (const [label, v] of [['start', lo0], ['end', hi]] as const) {
        assert.ok(Math.abs(v - Math.round(v)) < 1e-6,
          `${id} ${wall}: the skin's ${label} is at ${a3}=${v.toFixed(4)}, not on the building line`);
      }
    }
    // Nothing laid twice: two sheets on one wall never share (u, v).
    const byWall = new Map<string, Member[]>();
    for (const m of skin) byWall.set(m.wall!, [...(byWall.get(m.wall!) ?? []), m]);
    for (const [wall, ms] of byWall) {
      const a3 = runAxis(wall);
      for (let i = 0; i < ms.length; i++) {
        for (let j = i + 1; j < ms.length; j++) {
          const a = box(ms[i]!), b = box(ms[j]!);
          const du = Math.min(a[a3][1], b[a3][1]) - Math.max(a[a3][0], b[a3][0]);
          const dv = Math.min(a.y[1], b.y[1]) - Math.max(a.y[0], b.y[0]);
          assert.ok(du <= 1e-6 || dv <= 1e-6,
            `${id} ${wall}: ${ms[i]!.id} and ${ms[j]!.id} overlap by `
            + `${(du * IN_PER_FT).toFixed(2)} x ${(dv * IN_PER_FT).toFixed(2)} in — the take-off `
            + 'is billing that twice');
        }
      }
    }
  }
});

test('and no piece is wider than the sheet it is cut from', () => {
  // What the rip must not do. `firstSheetFt` returns a width, and a width bigger than the stock is
  // a piece nobody can cut; the previous grid could not produce one and this one must not either.
  const sheetW = PANEL.widthFt.value as number;
  const sheetH = PANEL.lengthFt.value as number;
  for (const { id, skin } of clad()) {
    for (const m of skin) {
      const w = m.cutLength / IN_PER_FT;
      const h = m.actual.d / IN_PER_FT;
      assert.ok(w <= sheetW + 1e-6 && h <= sheetH + 1e-6,
        `${id}: ${m.id} is ${w.toFixed(3)} x ${h.toFixed(3)} ft, off a ${sheetW} x ${sheetH} sheet`);
    }
  }
});

test('THE RIP IS THE RULE, stated on its own: the last nailer that fits in one sheet', () => {
  // `firstSheetFt` in isolation, including the two cases the walls never reach.
  const sheet = 4;
  assert.equal(firstSheetFt(0, sheet, 16 / 12), sheet, 'no lead: the first sheet is a full sheet');
  assert.equal(firstSheetFt(3.5 / 12, sheet, 0), sheet, 'no nailer spacing: nothing to aim at');
  for (const [spacingIn, wantIn] of [[16, 35.5], [24, 27.5], [12, 39.5]] as const) {
    assert.ok(Math.abs(firstSheetFt(3.5 / 12, sheet, spacingIn / 12) * IN_PER_FT - wantIn) < 1e-9,
      `a 3½-in lead at ${spacingIn} in o.c. rips to `
      + `${(firstSheetFt(3.5 / 12, sheet, spacingIn / 12) * IN_PER_FT).toFixed(2)} in, not ${wantIn}`);
  }
  // A lead wider than any nailer step leaves the lead itself — a corner ribbon, but on a stud.
  assert.ok(Math.abs(firstSheetFt(5, sheet, 16 / 12) - 5) < 1e-9, 'a lead past one sheet stands alone');

  // And what it buys: struck from the rip, every joint is a whole number of nailers from the
  // frame's own datum, which is where the studs are.
  const lead = 3.5 / 12, nailer = 16 / 12;
  const first = firstSheetFt(lead, sheet, nailer);
  const tiles = tileSurface(16, 8, sheet, 8, 0, undefined, 'cover', first);
  const joints = tiles.map((t) => t.u1).filter((u) => u < 16 - 1e-9);
  assert.ok(joints.length >= 3, `${joints.length} joints on a 16 ft wall`);
  for (const j of joints) {
    const k = (j - lead) / nailer;
    assert.ok(Math.abs(k - Math.round(k)) < 1e-9,
      `a joint at ${j.toFixed(4)} ft is ${((k - Math.round(k)) * nailer * IN_PER_FT).toFixed(3)} in `
      + 'off the stud layout it is measured from');
  }
  // And with no lead the tiling is exactly what it always was.
  assert.deepEqual(tileSurface(36, 8, sheet, 8, 0, undefined, 'cover', firstSheetFt(0, sheet, nailer)),
    tileSurface(36, 8, sheet, 8), 'a through wall tiles as it always did');
});
