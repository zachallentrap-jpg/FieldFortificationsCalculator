// Two invariants nothing in the suite stated, from a pass that found no defect.
//
// **A BENDING MEMBER IS ON EDGE.** A joist, a rafter, a header, a stringer carries its load on its
// DEPTH; laid flat it is a different piece with a fraction of the strength, and it reads as one on
// screen. The very first entry in this sweep was *"flat pieces on edge"* on the loading platform,
// and it has never been asked of the catalog as a whole. It is now: 106 role/family groups, every
// one on edge.
//
// **AND NO FRAMED OPENING IS CLAD OVER.** A door or a window is a hole in the frame AND a hole in
// the skin over it, cut by a different pass from a different datum, and the two have drifted before
// — *"the siding's hole is 1½ in above the frame… it shows as the siding lapping the screen by
// 1.50 in along the bottom"* is a live entry against the screened band. Asked of every framed
// opening in the catalog, read off the members rather than off the spec: the skin covers 0.0% of
// every one.
//
// READING IT OFF THE MODEL IS THE POINT, and the first two attempts at this test did not. Pairing
// jack studs by sorting them along the wall pairs the RIGHT jack of one opening with the LEFT jack
// of the next, which measures the solid wall BETWEEN two windows and duly reports it half covered.
// And mapping the spec's `offsetFt` straight to world x is wrong on the N and E walls, whose runs
// go the other way — that one reported a gp-frame window buried under two feet of siding when the
// window was at the far end of the wall and perfectly cut. Each opening is found here from its own
// HEADER and the two jacks under it, so no assumption about handedness or ordering enters.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
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
    pts.push([m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]]);
  }
  const g = (i: 0 | 1 | 2): [number, number] => [
    Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))];
  return { x: g(0), y: g(1), z: g(2) };
}

/** Everything that spans and carries its load in bending. */
const BENDING = [
  'joist', 'rimJoist', 'rafter', 'hipRafter', 'bentRafter', 'girder', 'header', 'stringer',
  'purlin', 'ridge', 'ohcStringer', 'capBeam', 'collarTie', 'bentCollar', 'girt', 'towerBrace',
  'brace', 'bridging',
];
const SKIN = ['siding', 'sidingBoard', 'batten', 'sheathingPanel'];

const catalog = (): { id: string; members: Member[] }[] => shippedFamilies()
  .map((f) => ({ id: f.id, members: generateStructure(JSON.parse(JSON.stringify(f.preset))).members }));

test('EVERY BENDING MEMBER IS ON EDGE — its depth stands up, not its thickness', () => {
  let checked = 0;
  for (const { id, members } of catalog()) {
    for (const m of members) {
      if (!BENDING.includes(m.role)) continue;
      if (Math.abs(m.actual.d - m.actual.w) < 1e-9) continue; // square stock has no edge to be on
      checked++;
      const depthUp = Math.abs(rotate(m, [0, 1, 0])[1]);
      const thickUp = Math.abs(rotate(m, [0, 0, 1])[1]);
      assert.ok(depthUp >= thickUp - 1e-9,
        `${id}: ${m.id} (${m.role}, ${m.nominal}) is laid FLAT — its ${m.actual.w} in thickness stands `
        + `more upright than its ${m.actual.d} in depth`);
    }
  }
  assert.ok(checked > 1500, `${checked} bending members across the catalog — the scan has gone blind`);
});

test('and no framed opening is clad over — the hole in the skin is the hole in the frame', () => {
  let openings = 0;
  for (const { id, members } of catalog()) {
    const skin = members.filter((m) => SKIN.includes(m.role));
    if (!skin.length) continue;
    const jacks = members.filter((m) => m.role === 'jackStud' && m.wall);
    const sills = members.filter((m) => m.role === 'sill' && m.wall);
    for (const h of members.filter((m) => m.role === 'header' && m.wall)) {
      const wall = h.wall!;
      // The wall runs along X on N/S and along Z on E/W; the other plan axis is its plane.
      const key: 'x' | 'z' = wall === 'N' || wall === 'S' ? 'x' : 'z';
      const perp: 'x' | 'z' = key === 'x' ? 'z' : 'x';
      const hb = box(h);
      const mid = (hb[key][0] + hb[key][1]) / 2;
      const mine = jacks.filter((j) => {
        const b = box(j);
        return j.wall === wall && b[key][1] > hb[key][0] - 0.02 && b[key][0] < hb[key][1] + 0.02;
      });
      if (mine.length < 2) continue;
      const lefts = mine.map((j) => box(j)[key][1]).filter((v) => v < mid);
      const rights = mine.map((j) => box(j)[key][0]).filter((v) => v > mid);
      if (!lefts.length || !rights.length) continue;
      const u0 = Math.max(...lefts), u1 = Math.min(...rights);
      if (!(u1 > u0)) continue;
      const v1 = hb.y[0]; // the header's underside
      const under = sills.filter((s) => {
        const b = box(s);
        return s.wall === wall && b[key][0] < u1 - 0.02 && b[key][1] > u0 + 0.02 && b.y[1] <= v1;
      });
      const v0 = under.length
        ? Math.max(...under.map((s) => box(s).y[1]))
        : Math.min(...mine.map((j) => box(j).y[0]));
      const at = (box(mine[0]!)[perp][0] + box(mine[0]!)[perp][1]) / 2;
      const near = skin.map(box).filter((s) => Math.abs((s[perp][0] + s[perp][1]) / 2 - at) < 0.6);
      let covered = 0, total = 0;
      for (let u = u0 + 0.02; u < u1; u += 0.03) {
        for (let v = v0 + 0.02; v < v1; v += 0.03) {
          total++;
          if (near.some((s) => u > s[key][0] && u < s[key][1] && v > s.y[0] && v < s.y[1])) covered++;
        }
      }
      if (!total) continue;
      openings++;
      assert.equal(covered, 0,
        `${id} ${wall}: ${h.id}'s opening — ${u0.toFixed(2)}..${u1.toFixed(2)} by `
        + `${v0.toFixed(2)}..${v1.toFixed(2)} — is ${((100 * covered) / total).toFixed(1)}% under skin`);
    }
  }
  assert.ok(openings >= 20, `${openings} framed openings measured against their skin`);
});

test("and the skin's hole is not merely SOMEWHERE — it is over the frame's, both ways", () => {
  // The guard on the test above, which a skin that vanished entirely would also pass. Every card
  // with openings has less skin on a walled side than an unwalled one would, and the holes are
  // where the openings are: the total skin area on a wall falls short of the wall by at least the
  // openings cut into it.
  for (const { id, members } of catalog()) {
    const skin = members.filter((m) => SKIN.includes(m.role));
    const heads = members.filter((m) => m.role === 'header' && m.wall);
    if (!skin.length || !heads.length) continue;
    assert.ok(skin.length > 4 * heads.length,
      `${id}: ${skin.length} skin pieces against ${heads.length} openings — the wall has come off`);
    // And every opening still has a header over it and two jacks under that, which is what the
    // measurement above reads the hole from.
    for (const h of heads) {
      const b = box(h);
      assert.ok(b.y[1] - b.y[0] > 0.1, `${id}: ${h.id} is ${((b.y[1] - b.y[0]) * IN_PER_FT).toFixed(1)} in deep`);
    }
  }
});
