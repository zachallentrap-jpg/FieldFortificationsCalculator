// TIMBER-2 — the latrine's seat openings.
//
// `generateRiserBox` opens with "a boxed bench down one side over the pit, WITH A SEAT OPENING
// PER SEAT". It cut none. `seats` sized the divider count and nothing else, so a four-seat
// latrine came out of the model as a solid ten-foot bench — the one feature that makes the
// building a latrine, missing, in the one family that has it.
//
// The same shape as the bird's mouth, and held to the same standard: the openings are DERIVED
// from members the engine already emitted, so what these tests check is that the derivation
// agrees with the bench that is actually there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { FAMILY_TABLE } from '../src/timber/catalog';
import { riserLidOf, seatOpeningsFor, seatOpeningPath } from '../src/timber/riserSeats';
import { LATRINE } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

const latrinePreset = FAMILY_TABLE.find((f) => f.id === 'latrine')!.preset;
const withSeats = (seats: 2 | 4): Parameters<typeof generateStructure>[0] =>
  ({ ...(latrinePreset as object), latrine: { ...(latrinePreset as { latrine: object }).latrine, seats } }) as Parameters<typeof generateStructure>[0];

test('a latrine gets one seat opening per bay, and a bay per seat', () => {
  for (const seats of [2, 4] as const) {
    const model = generateStructure(withSeats(seats));
    const openings = seatOpeningsFor(model.members);
    assert.equal(openings.length, seats, `${seats}-seat latrine cut ${openings.length} openings`);
  }
});

test('each opening lands between two dividers, with board left on both sides', () => {
  const model = generateStructure(withSeats(4));
  const lid = riserLidOf(model.members);
  assert.ok(lid, 'no riser lid found');
  const dividers = model.members
    .filter((m) => m.role === 'riserBox' && m.id !== lid.id && Math.abs(Math.abs(m.rotation[1]) - Math.PI / 2) < 1e-6)
    .map((m) => m.position[0] - lid.position[0])
    .sort((a, b) => a - b);
  assert.equal(dividers.length, 5, 'four seats want five dividers');
  const openings = seatOpeningsFor(model.members);
  for (const [i, o] of openings.entries()) {
    const left = dividers[i]!;
    const right = dividers[i + 1]!;
    assert.ok(o.xFt - o.widthFt / 2 > left, `opening ${i} runs into the divider at ${left}`);
    assert.ok(o.xFt + o.widthFt / 2 < right, `opening ${i} runs into the divider at ${right}`);
    // And it is centred in its bay — a seat off to one side of its own compartment is wrong.
    assert.ok(Math.abs(o.xFt - (left + right) / 2) < 1e-9, `opening ${i} is not centred in its bay`);
  }
});

test('the hole is a hole, not a gap — board survives all round it', () => {
  const model = generateStructure(withSeats(4));
  const lid = riserLidOf(model.members)!;
  const hx = lid.cutLength / 24;
  const hy = lid.actual.d / 24;
  for (const o of seatOpeningsFor(model.members)) {
    for (const [x, y] of seatOpeningPath(o)) {
      assert.ok(Math.abs(x) < hx - 1e-9, `opening corner x=${x} is off the end of a ${hx * 2} ft lid`);
      assert.ok(Math.abs(y) < hy - 1e-9, `opening corner y=${y} is off the ${hy * 2} ft depth`);
    }
    // Set back from the FRONT board by the doctrine margin, because that is what you sit on.
    const front = hy - (o.yFt + o.lengthFt / 2);
    assert.ok(
      Math.abs(front - (LATRINE.seatFrontMarginIn.value as number) / 12) < 1e-9,
      `opening is ${(front * 12).toFixed(2)} in back from the front board, not ${LATRINE.seatFrontMarginIn.value}`,
    );
  }
});

test('the openings are square to the bench and the size doctrine says', () => {
  const model = generateStructure(withSeats(4));
  for (const o of seatOpeningsFor(model.members)) {
    assert.equal(Math.round(o.widthFt * 12), LATRINE.seatOpeningWidthIn.value);
    assert.equal(Math.round(o.lengthFt * 12), LATRINE.seatOpeningLengthIn.value);
    const path = seatOpeningPath(o);
    assert.equal(path.length, 4);
    // Axis-aligned: two distinct x values and two distinct y values, nothing else.
    assert.equal(new Set(path.map(([x]) => x.toFixed(9))).size, 2);
    assert.equal(new Set(path.map(([, y]) => y.toFixed(9))).size, 2);
  }
});

test('nothing else in the catalog grows seat openings', () => {
  // A riser box is the latrine's alone. Every other family — including the other huts, which
  // share the same generator — must come back with none rather than with a bench full of holes.
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(fam.preset);
    const hasBox = model.members.some((m: Member) => m.role === 'riserBox');
    const openings = seatOpeningsFor(model.members);
    if (fam.id === 'latrine') {
      assert.ok(hasBox && openings.length > 0, 'the latrine lost its riser box');
    } else {
      assert.equal(openings.length, 0, `${fam.id} grew ${openings.length} seat openings`);
    }
  }
});

// ── The box itself ───────────────────────────────────────────────────────────
//
// A BOXED BENCH OVER A PIT HAS TO CLOSE, and two joints did not.
//
//   THE DIVIDERS RAN INTO THE FRONT BOARD. Each one spanned the full depth from the front FACE to
//   the back, so its leading 1½ in was inside the board it is nailed to — 1½ × 15¼ × 1½ in of one
//   solid in another, five times over on the shipped four-seat bench.
//
//   AND THE BACK STOPPED SHORT OF THE WALL. `widthFt - 0.5` is a guessed half-foot; the framing's
//   inner face is at `widthFt - wallThickness`. On the shipped latrine that left a 2½-in slot the
//   whole 10-ft length of the bench, straight down into the pit — under a comment that has read
//   "spanning the full depth from the front board to the wall" since the box was written.

/** Every corner of a member in world space. The bench is all axis-aligned, so a box IS the piece. */
function cornersOf(m: Member): [number, number, number][] {
  const [rx, ry, rz] = m.rotation;
  const h: [number, number, number] = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const out: [number, number, number][] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    let [x, y, z] = [sx * h[0], sy * h[1], sz * h[2]];
    let a = x * Math.cos(rz) - y * Math.sin(rz); let b = x * Math.sin(rz) + y * Math.cos(rz);
    x = a; y = b;
    a = y * Math.cos(rx) - z * Math.sin(rx); b = y * Math.sin(rx) + z * Math.cos(rx);
    y = a; z = b;
    a = x * Math.cos(ry) + z * Math.sin(ry); b = -x * Math.sin(ry) + z * Math.cos(ry);
    out.push([m.position[0] + a, m.position[1] + y, m.position[2] + b]);
  }
  return out;
}
const extent = (m: Member, i: 0 | 1 | 2): [number, number] => {
  const c = cornersOf(m).map((p) => p[i]);
  return [Math.min(...c), Math.max(...c)];
};
const overlap = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

function bench(seats: 2 | 4) {
  const model = generateStructure(withSeats(seats));
  const parts = model.members.filter((m) => m.role === 'riserBox');
  // The back wall's inner face, off the model: the sole plate is one piece running the whole wall,
  // so it says where the framing stops without anything here restating a wall thickness.
  const plates = model.members.filter((m) => m.role === 'solePlate');
  const back = plates.reduce((a, b) => (extent(b, 2)[1] > extent(a, 2)[1] ? b : a));
  return { model, parts, wallFaceZ: extent(back, 2)[0], backPlate: back };
}

test('THE BENCH CLOSES AGAINST THE WALL — it used to stop 2 1/2 in short of it', () => {
  for (const seats of [2, 4] as const) {
    const { parts, wallFaceZ, backPlate } = bench(seats);
    assert.ok(parts.length >= 4, `${seats}-seat bench has ${parts.length} parts`);
    const backOfBench = Math.max(...parts.map((m) => extent(m, 2)[1]));
    assert.ok(Math.abs(backOfBench - wallFaceZ) < 1e-9,
      `${seats} seats: the bench's back is at z=${backOfBench.toFixed(4)} and the wall's face `
      + `(${backPlate.id}) is at ${wallFaceZ.toFixed(4)} — a ${((wallFaceZ - backOfBench) * 12).toFixed(2)} in slot `
      + 'down the length of the bench, into the pit');
    // …and it is not buried in the wall either.
    for (const p of parts) {
      assert.ok(extent(p, 2)[1] <= wallFaceZ + 1e-9, `${seats} seats: ${p.id} runs into the wall framing`);
    }
  }
});

test('and no two parts of it share wood — the dividers butt the front board', () => {
  for (const seats of [2, 4] as const) {
    const { parts } = bench(seats);
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i]!, b = parts[j]!;
        const d = [0, 1, 2].map((k) => overlap(extent(a, k as 0 | 1 | 2), extent(b, k as 0 | 1 | 2)));
        assert.ok(d.some((v) => v <= 1e-9),
          `${seats} seats: ${a.id} and ${b.id} share `
          + `${d.map((v) => (v * 12).toFixed(2)).join(' x ')} in of wood`);
      }
    }
  }
});

test('and it is still a box: lid over the whole depth, dividers up to it, board to the floor', () => {
  for (const seats of [2, 4] as const) {
    const { parts } = bench(seats);
    const lid = riserLidOf(parts)!;
    assert.ok(lid, `${seats} seats: no lid`);
    const lidZ = extent(lid, 2);
    const others = parts.filter((m) => m.id !== lid.id);
    // The lid reaches the front face of the frontmost part and the back of the backmost.
    assert.ok(Math.abs(lidZ[0] - Math.min(...others.map((m) => extent(m, 2)[0]))) < 1e-9,
      `${seats} seats: the lid does not reach the front of the bench`);
    assert.ok(Math.abs(lidZ[1] - Math.max(...others.map((m) => extent(m, 2)[1]))) < 1e-9,
      `${seats} seats: the lid does not reach the back of the bench`);
    // Everything under it comes up to it, and everything reaches the floor.
    const lidBottom = extent(lid, 1)[0];
    for (const m of others) {
      const y = extent(m, 1);
      assert.ok(Math.abs(y[1] - lidBottom) < 1e-9,
        `${seats} seats: ${m.id} tops out at ${y[1].toFixed(4)}, the lid's underside is ${lidBottom.toFixed(4)}`);
      assert.ok(Math.abs(y[0]) < 1e-9, `${seats} seats: ${m.id} does not reach the floor`);
    }
  }
});
