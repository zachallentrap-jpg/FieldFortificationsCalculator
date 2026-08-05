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
