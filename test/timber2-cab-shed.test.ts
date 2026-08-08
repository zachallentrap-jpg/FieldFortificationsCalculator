// The guard tower cab's SHED roof, which had nothing holding its high side up.
//
// A shed is one slope, so its high edge is a WALL. The pyramid gets away without one because its
// four hips lean on each other at a peak, and this branch was written as if the same were true.
// Measured on the shipped cab: the rafters ran from 22.845 up to 26.613 while every post and
// screen panel in the cab topped out at 23.063 — three and a half feet of roof carried on nothing
// at all, over the heads of the two observers the card is sized for.
//
// The building's own shed roof has framed a pony wall for this since T2, and an earlier pass
// through this sweep had to give that pony wall the plate it was missing.
//
// And there were THREE rafters, at the two edges and the middle: 48 in on centre across an 8-ft
// cab, on a card whose own `spacing.rafterSpacingIn` says 16.
//
// The plate that pass added was the right member in the wrong place, and this test said so in the
// wrong words — see the note on the bearing line below, and `timber2-cab-shed-roof` for the joint
// it makes now.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';
import type { StructureSpec } from '../src/timber/spec';

type V3 = [number, number, number];
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
function box(m: Member) {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const cab = (roof: 'pyramid' | 'shed', over: Record<string, unknown> = {}) => {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset)) as Record<string, unknown>;
  (spec.cab as Record<string, unknown>).roof = roof;
  Object.assign(spec, over);
  return generateStructure(spec as unknown as StructureSpec);
};

/** The two ends of a member's centreline. */
const ends = (m: Member): [V3, V3] => {
  const a = rotate(m, [m.cutLength / 24, 0, 0]);
  return [
    [m.position[0] + a[0], m.position[1] + a[1], m.position[2] + a[2]],
    [m.position[0] - a[0], m.position[1] - a[1], m.position[2] - a[2]],
  ];
};

test('THE HIGH SIDE OF A SHED CAB STANDS ON SOMETHING', () => {
  const m = cab('shed');
  const rafters = m.members.filter((x) => x.role === 'rafter');
  assert.ok(rafters.length >= 3, `${rafters.length} rafters`);
  const high = Math.max(...rafters.flatMap((r) => ends(r).map((e) => e[1])));
  const plates = m.members.filter((x) => x.role === 'capPlate' && box(x).y[1]! > high - 1);
  assert.equal(plates.length, 1, `${plates.length} plates at the high edge`);
  const plate = plates[0]!;
  const pb = box(plate);
  // Every rafter BEARS on the plate — checked at the plate's own station, not at the rafter's
  // end. A shed's rafters run past their high wall by the cab's overhang, exactly as they run
  // past the low one, so "the high end sits on the plate" is the wrong claim and was the first
  // version of this test: it failed at 1.00 ft, which is `TOWER.cabOverhangFt`.
  //
  // AND THE BEARING LINE IS THE RAFTER'S UNDERSIDE, NOT ITS CENTRE. `rafterPlaneDatum` states the
  // rule for the whole toolkit: every roof surface is given at the rafter's CENTRE plane and the
  // covering is lifted off it by `rafterHalfFt`. Reading the centreline here and asking the plate
  // to reach it is asking for the plate to be buried half a rafter deep, and it was — 2.987 in of
  // shared wood on every rafter, where the building's identical pony plate shares 1.107 and that
  // 1.107 is the bird's mouth. The seat lands on the plate's UP-SLOPE face, the far one going up
  // the roof, which is where a rafter running on past the wall last touches it.
  for (const r of rafters) {
    const [a, b] = ends(r);
    const t = (plate.position[2] - a[2]) / (b[2] - a[2]);
    assert.ok(t > 0 && t < 1, `${r.id} does not cross the plate at all`);
    const dn = rotate(r, [0, -r.actual.d / 24, 0]); // centreline → underside, square to the slope
    const s = (pb.z[1]! - (a[2] + dn[2])) / (b[2] - a[2]);
    const yAt = a[1] + dn[1] + (b[1] - a[1]) * s;
    assert.ok(Math.abs(yAt - pb.y[1]!) < 1e-9,
      `${r.id}: over the plate its bearing line is at ${yAt.toFixed(4)} and the plate tops out at `
      + `${pb.y[1]!.toFixed(4)} — ${((yAt - pb.y[1]!) * IN_PER_FT).toFixed(2)} in of daylight`);
    const xAt = a[0] + (b[0] - a[0]) * t;
    assert.ok(xAt >= pb.x[0]! - 1e-6 && xAt <= pb.x[1]! + 1e-6, `${r.id} crosses off the end of the plate`);
  }
  // And the plate stands on posts, which stand on the cab.
  const under = m.members.filter((x) => x.role === 'post'
    && Math.abs(box(x).y[1]! - pb.y[0]!) < 1e-9);
  assert.equal(under.length, 2, `${under.length} posts under the high plate`);
  const cabTop = Math.max(...m.members.filter((x) => x.role === 'screenPanel').map((x) => box(x).y[1]!));
  for (const p of under) {
    assert.ok(Math.abs(box(p).y[0]! - cabTop) < 1e-9,
      `${p.id} starts at ${box(p).y[0]!.toFixed(4)} and the cab wall tops out at ${cabTop.toFixed(4)}`);
  }
});

test('and its rafters are on the spacing the card states, not a hardcoded three', () => {
  for (const oc of [16, 24] as const) {
    const m = cab('shed', { spacing: { studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: oc } });
    const xs = m.members.filter((x) => x.role === 'rafter').map((x) => x.position[0]).sort((a, b) => a - b);
    assert.ok(xs.length >= 3, `${oc} in: ${xs.length} rafters`);
    for (let i = 1; i < xs.length; i++) {
      const gap = (xs[i]! - xs[i - 1]!) * IN_PER_FT;
      assert.ok(gap <= oc + 1e-6, `${oc} in o.c.: a bay is ${gap.toFixed(1)} in`);
    }
    // Bounded from above too: a spacing satisfied by burying the roof in rafters is not a spacing.
    const run = xs[xs.length - 1]! - xs[0]!;
    assert.ok(run / Math.max(1, xs.length - 2) > oc / IN_PER_FT + 1e-9,
      `${oc} in: ${xs.length} rafters where ${xs.length - 1} would still make the spacing`);
  }
});

test('and the PYRAMID cab is untouched — its four hips lean on each other', () => {
  const m = cab('pyramid');
  assert.equal(m.members.filter((x) => x.role === 'rafter').length, 0, 'a pyramid cab has no common rafters');
  assert.equal(m.members.filter((x) => x.role === 'hipRafter').length, 4);
  const deck = m.levels.subfloorTop ?? 0;
  assert.equal(m.members.filter((x) => x.role === 'capPlate' && x.position[1] > deck).length, 0,
    'a pyramid cab needs no high plate and should not have grown one');
});
