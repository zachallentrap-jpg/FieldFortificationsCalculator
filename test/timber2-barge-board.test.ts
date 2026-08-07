// The board that trims a gable RAKE, which did not exist.
//
// `generateRidgeCaps` names it in its own comment — a rectangle plane's side edges "are the rake
// of a gable, WHICH IS TRIMMED WITH A BARGE BOARD and not capped" — and nothing emitted one. So a
// gable ended where the DECK ended, at the framing line, while the finished wall stands a skin
// thickness outside that:
//
//   gp-frame 48x20      eave: the roof reaches 12.64 in past the skin
//                       rake: the roof stops 0.50 in SHORT of it
//   storage-shed 20x12  rake: 1.50 in short — board-and-batten is three times as thick
//
// Half an inch of siding along both rakes of every gable, shed and flat roof in the toolkit with
// nothing over it, and the stepped tops of the raked infill standing in the open beside a raw deck
// edge. It is the eave's own defect, one edge round: *"every roof in the toolkit ended in a row of
// raw square-cut rafter ends"* was the fascia's entry in this sweep, and the rake never got the
// same treatment.
//
// A plane that TAPERS has hips on its sides, not rakes — the same test the caps use — so a hip
// roof and the tower's pyramid cab correctly get none.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById, shippedFamilies } from '../src/timber/catalog';
import { finishedWallThicknessFt } from '../src/timber/subsystems/coverings';
import { LUMBER, IN_PER_FT } from '../src/timber/doctrine';
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

function extent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h = halfExtents(m);
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

const SKIN = ['siding', 'sidingBoard', 'batten'];
const ROOF = ['roofPanel', 'roofingCourse'];

/** Every shipped card whose roof is skinned — the ones a rake can be trimmed on. */
function roofed(): { id: string; members: Member[]; barge: Member[]; skin: Member[]; roof: Member[]; hipped: boolean }[] {
  const out: { id: string; members: Member[]; barge: Member[]; skin: Member[]; roof: Member[]; hipped: boolean }[] = [];
  for (const f of shippedFamilies()) {
    const members = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const skin = members.filter((m) => SKIN.includes(m.role));
    if (!skin.length) continue;
    out.push({
      id: f.id, members, skin,
      barge: members.filter((m) => m.role === 'bargeBoard'),
      roof: members.filter((m) => ROOF.includes(m.role)),
      hipped: members.some((m) => m.role === 'hipRafter'),
    });
  }
  assert.ok(out.length >= 7, `${out.length} skinned cards in the catalog`);
  return out;
}

test('EVERY GABLE RAKE IS TRIMMED — there was no such board in the toolkit', () => {
  for (const { id, barge, hipped } of roofed()) {
    if (hipped) {
      assert.equal(barge.length, 0, `${id}: a hip has no rake, and got ${barge.length} barge boards`);
      continue;
    }
    // Two slopes on a gable, one on a shed or a flat — and two rakes on each of them.
    assert.ok(barge.length === 4 || barge.length === 2,
      `${id}: ${barge.length} barge boards, and a rake comes in pairs`);
    for (const b of barge) assert.equal(b.nominal, LUMBER.fasciaNominal.value, `${id}: ${b.id} is not fascia stock`);
  }
});

test('and it is nailed OVER the finished wall, not behind it', () => {
  // The measurement that started this. The roof's own edge stops at the framing line, and the
  // wall's outer face is a skin thickness outside it: half an inch of plywood, an inch and a half
  // of board-and-batten. A board on the deck's edge alone would leave the batten proud of it.
  const bargeT = DRESSED[LUMBER.fasciaNominal.value as string]!.w / IN_PER_FT;
  for (const { id, barge, skin, roof, hipped } of roofed()) {
    assert.ok(hipped || barge.length > 0, `${id}: no barge board to measure`);
    for (const b of barge) {
      // A barge board's THICKNESS runs horizontally, normal to the gable end it is nailed over —
      // so the board itself says which plan axis to measure across. Measuring both blindly reads
      // the eave overhang the board shares with the roof and calls it a standoff.
      const n = rotate(b, [0, 0, 1]);
      const axis: 0 | 2 = Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
      // Both rakes of one slope carry the same rotation, so the normal says WHICH axis and the
      // board's own position says which end of it.
      const mid = (Math.min(...skin.map((m) => extent(m, axis)[0]))
        + Math.max(...skin.map((m) => extent(m, axis)[1]))) / 2;
      const outward = b.position[axis]! > mid ? 1 : 0;
      const pick = (ms: Member[]): number => outward
        ? Math.max(...ms.map((m) => extent(m, axis)[1])) : Math.min(...ms.map((m) => extent(m, axis)[0]));
      const away = (a: number, bb: number): number => (outward ? a - bb : bb - a);
      assert.ok(Math.abs(away(pick([b]), pick(skin)) - bargeT) < 1e-9,
        `${id}: ${b.id} stands ${(away(pick([b]), pick(skin)) * IN_PER_FT).toFixed(3)} in past the skin, not the `
        + `${(bargeT * IN_PER_FT).toFixed(2)} in it is thick — its inner face has to land ON the wall`);
      // And it now reaches past the roof, which is the whole point: the roof stopped short of it.
      assert.ok(away(pick([b]), pick(roof)) > 1e-9,
        `${id}: ${b.id} is ${(-away(pick([b]), pick(roof)) * IN_PER_FT).toFixed(3)} in inside the roof's own edge`);
    }
  }
});

test('and it runs the whole rake, pitched with it — eave to ridge', () => {
  for (const { id, barge, roof, members, hipped } of roofed()) {
    assert.ok(hipped || barge.length > 0, `${id}: no barge board to measure`);
    if (!barge.length) continue;
    const rafters = members.filter((m) => m.role === 'rafter');
    const roofTop = Math.max(...roof.map((m) => extent(m, 1)[1]));
    const eaveLow = Math.min(...rafters.map((m) => extent(m, 1)[0]));
    for (const b of barge) {
      const [lo, hi] = extent(b, 1);
      // Its top reaches the ridge and its foot the eave — a board that stopped short would leave
      // the rake open at whichever end it gave up on.
      assert.ok(hi > roofTop - 1, `${id}: ${b.id} tops out ${((roofTop - hi) * IN_PER_FT).toFixed(1)} in below the ridge`);
      assert.ok(lo < eaveLow + 1, `${id}: ${b.id} stops ${((lo - eaveLow) * IN_PER_FT).toFixed(1)} in above the eave`);
      // Pitched: its length axis climbs, and its face stands vertical the way a fascia's does.
      const ax = rotate(b, [1, 0, 0]);
      assert.ok(Math.abs(ax[1]) > 1e-9 || Math.abs(b.rotation[2]) < 1e-9,
        `${id}: ${b.id} is level but claims a pitch`);
      assert.equal(b.rotation[0], 0, `${id}: ${b.id} is rolled off the vertical`);
      const across = rotate(b, [0, 0, 1]);
      assert.ok(Math.abs(across[1]) < 1e-9, `${id}: ${b.id}'s thickness is not horizontal`);
    }
  }
});

test('and it buries itself in nothing — it bears, it does not bite', () => {
  for (const { id, barge, members, hipped } of roofed()) {
    assert.ok(hipped || barge.length > 0, `${id}: no barge board to measure`);
    for (const b of barge) {
      let near = Infinity;
      for (const o of members) {
        if (o === b) continue;
        const g = gap(b, o);
        near = Math.min(near, g);
        assert.ok(g >= -1e-9, `${id}: ${b.id} is ${(-g * IN_PER_FT).toFixed(3)} in inside ${o.id} (${o.role})`);
      }
      assert.ok(near <= 1e-9, `${id}: ${b.id} touches nothing at all`);
    }
  }
});

test('and a bare frame still gets one on the deck edge — the skin is what moves it', () => {
  // `finishedWallThicknessFt` is the only thing that decides how far out the board stands, and a
  // batten is in that answer where it is deliberately absent from `wallLayerThicknessFt`: the
  // batten has nothing over it, and the barge does.
  assert.equal(finishedWallThicknessFt('none', 'none'), 0);
  const plywood = finishedWallThicknessFt('none', 'plywood');
  const bAndB = finishedWallThicknessFt('none', 'boardAndBatten');
  assert.ok(bAndB > plywood, `board-and-batten (${bAndB}) is thicker than plywood (${plywood})`);
  assert.ok(finishedWallThicknessFt('plywood', 'plywood') > plywood, 'sheathing adds to it');
  // And the storage shed is the card that proves it: its skin is boards PLUS battens.
  const shed = generateStructure(JSON.parse(JSON.stringify(familyById('storage-shed')!.preset))).members;
  const batten = shed.filter((m) => m.role === 'batten');
  assert.ok(batten.length > 0, 'the storage shed is board-and-batten');
  const bargeFar = Math.max(...shed.filter((m) => m.role === 'bargeBoard').map((m) => extent(m, 0)[1]));
  const battenFar = Math.max(...batten.map((m) => extent(m, 0)[1]));
  assert.ok(bargeFar > battenFar,
    `the barge stops ${((battenFar - bargeFar) * IN_PER_FT).toFixed(3)} in inside the battens it is nailed over`);
});
