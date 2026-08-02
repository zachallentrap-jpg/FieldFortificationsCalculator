// TIMBER-2 — roof families beyond the gable (plan §8.3, TD6/TD7).
//
// The invariants that matter for a roof: the planes are actually planes, the slope is the
// slope that was asked for, courses tile without overlapping (an overlap is material billed
// twice), and TD6's pony wall really closes the triangle a shed leaves above its high wall —
// because if it does not, the building has a gap to the sky and the model does not show it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { roofPlanes, slopeOf, generateShed } from '../src/timber/subsystems/roofFamilies';
import { wallContract } from '../src/timber/subsystems/wallSystem';
import type { BuildingSpec, RoofSpec } from '../src/timber/spec';
import type { WallId } from '../src/timber/types';

function bldg(roof: RoofSpec, over: Partial<BuildingSpec> = {}): BuildingSpec {
  return {
    family: 'building',
    dims: { lengthFt: 20, widthFt: 16 },
    spacing: { studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16 },
    coverings: { wallSheathing: 'none', siding: 'none', roofDeck: 'none', roofing: 'none' },
    stories: [{ wallHeightFt: 8, openings: {} }],
    roof,
    foundation: { kind: 'piers', crawlFt: 1.5 },
    ...over,
  };
}

const dot = (a: number[], b: number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const norm = (a: number[]): number => Math.hypot(a[0]!, a[1]!, a[2]!);

test('every roof plane is orthonormal: eave ⟂ slope ⟂ normal, all unit length', () => {
  const roofs: RoofSpec[] = [
    { kind: 'gable', risePer12: 4, overhangFt: 1 },
    { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'N' },
    { kind: 'shed', risePer12: 6, overhangFt: 0, highSide: 'E' },
    { kind: 'flat', overhangFt: 1, drainPer12: 1 },
  ];
  for (const roof of roofs) {
    for (const p of roofPlanes(bldg(roof), 8)) {
      assert.ok(Math.abs(norm(p.alongEave) - 1) < 1e-12, `${roof.kind}/${p.id}: eave not unit`);
      assert.ok(Math.abs(norm(p.upSlope) - 1) < 1e-12, `${roof.kind}/${p.id}: slope not unit`);
      assert.ok(Math.abs(norm(p.normal) - 1) < 1e-12, `${roof.kind}/${p.id}: normal not unit`);
      assert.ok(Math.abs(dot(p.alongEave, p.upSlope)) < 1e-12, `${roof.kind}/${p.id}: not perpendicular`);
      assert.ok(p.normal[1]! > 0, `${roof.kind}/${p.id}: normal must point UP (it is the weather side)`);
      assert.ok(p.slopeLengthFt > 0 && p.eaveLengthFt > 0, `${roof.kind}/${p.id}: degenerate extent`);
    }
  }
});

test('plane geometry matches the framing-square math for every pitch', () => {
  for (const risePer12 of [0, 2, 3, 4, 6, 9, 12]) {
    const spec = bldg({ kind: 'gable', risePer12, overhangFt: 1 });
    const { lenPerFtRun } = slopeOf(spec.roof);
    const planes = roofPlanes(spec, 8);
    assert.equal(planes.length, 2, 'a gable has two slopes');
    const run = spec.dims.widthFt / 2 + 1;
    for (const p of planes) {
      assert.ok(Math.abs(p.slopeLengthFt - run * lenPerFtRun) < 1e-9, `rise ${risePer12}: slope length`);
      // Rise over run along the plane equals the pitch.
      const rise = p.upSlope[1]!;
      const horiz = Math.hypot(p.upSlope[0]!, p.upSlope[2]!);
      assert.ok(Math.abs(rise / horiz - risePer12 / 12) < 1e-9, `rise ${risePer12}: plane slope`);
    }
  }
});

test('a shed has ONE plane and it climbs toward the high side', () => {
  for (const highSide of ['N', 'S', 'E', 'W'] as WallId[]) {
    const spec = bldg({ kind: 'shed', risePer12: 3, overhangFt: 1, highSide });
    const planes = roofPlanes(spec, 8);
    assert.equal(planes.length, 1, `${highSide}: a shed is a single slope`);
    const p = planes[0]!;
    // Walk to the top of the slope and check we ended up on the high wall's side.
    const topZ = p.origin[2] + p.upSlope[2]! * p.slopeLengthFt;
    const topX = p.origin[0] + p.upSlope[0]! * p.slopeLengthFt;
    const topY = p.origin[1] + p.upSlope[1]! * p.slopeLengthFt;
    assert.ok(topY > p.origin[1], `${highSide}: the far end must be higher`);
    if (highSide === 'N') assert.ok(topZ > spec.dims.widthFt / 2, 'N high → uphill toward +Z');
    if (highSide === 'S') assert.ok(topZ < spec.dims.widthFt / 2, 'S high → uphill toward -Z');
    if (highSide === 'E') assert.ok(topX > spec.dims.lengthFt / 2, 'E high → uphill toward +X');
    if (highSide === 'W') assert.ok(topX < spec.dims.lengthFt / 2, 'W high → uphill toward -X');
  }
});

test('TD7: a flat roof still drains — the slope is floored at 1:12 and reported', () => {
  const model = generateStructure(bldg({ kind: 'flat', overhangFt: 1, drainPer12: 0.25 }));
  const roof = (model.spec as BuildingSpec).roof;
  assert.equal(roof.kind, 'flat');
  assert.equal(roof.kind === 'flat' ? roof.drainPer12 : undefined, 1, 'clamped up to the roll-roofing minimum');
  assert.ok(model.issues.some((i) => /drain/i.test(i.message)), 'and the user is told');
  // A flat roof is a shed under the hood: one plane, gently sloped.
  const planes = roofPlanes(model.spec as BuildingSpec, 8);
  assert.equal(planes.length, 1);
  assert.ok(planes[0]!.upSlope[1]! > 0, 'not dead flat');
});

test('TD6: the shed pony wall closes the triangle above the high wall', () => {
  const spec = bldg({ kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' });
  const model = generateStructure(spec);
  const pony = model.members.filter((m) => m.role === 'ponyStud');
  assert.ok(pony.length >= 10, `expected a pony wall of studs, got ${pony.length}`);
  const expectedHeight = spec.dims.widthFt * (4 / 12);
  for (const p of pony) {
    assert.equal(p.wall, 'N', 'the pony wall stands on the HIGH wall');
    assert.ok(Math.abs(p.cutLength / 12 - expectedHeight) < 1e-9, `${p.id}: pony stud height`);
    // It stands ON the wall below, not through it.
    assert.ok(Math.abs(p.position[1] - (8 + expectedHeight / 2)) < 1e-9, `${p.id}: sits on the cap plate`);
  }
  // And the frozen wall generator was never asked for an unequal wall.
  const capPlates = model.members.filter((m) => m.role === 'capPlate');
  const heights = new Set(capPlates.map((m) => m.position[1].toFixed(9)));
  assert.equal(heights.size, 1, 'all four walls are still the same rectangular height');
});

test('rake infill steps up the two side walls under the slope', () => {
  const model = generateStructure(bldg({ kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' }));
  const rake = model.members.filter((m) => m.role === 'rakeStud');
  assert.ok(rake.length >= 6, `expected rake infill, got ${rake.length}`);
  for (const r of rake) {
    assert.ok(r.wall === 'E' || r.wall === 'W', `${r.id}: rake studs go on the walls parallel to the slope`);
    assert.ok(r.cutLength > 0, `${r.id}: positive length`);
  }
  // Taller toward the high side: sort by z and the lengths increase.
  const east = rake.filter((m) => m.wall === 'E').sort((a, b) => a.position[2] - b.position[2]);
  for (let i = 1; i < east.length; i++) {
    assert.ok(east[i]!.cutLength > east[i - 1]!.cutLength, 'infill grows toward the high wall');
  }
});

test('shed rafters use the framing-square length and carry their cut angles', () => {
  const spec = bldg({ kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' });
  const walls = wallContract(20, 16, 8, {});
  const members = generateShed({ spec, walls, stageRoofFrame: 8 });
  const rafters = members.filter((m) => m.role === 'rafter');
  assert.ok(rafters.length >= 12, `expected a rafter run, got ${rafters.length}`);
  const { lenPerFtRun } = slopeOf(spec.roof);
  const expected = (16 + 2 * 1) * lenPerFtRun * 12;
  for (const r of rafters) {
    assert.ok(Math.abs(r.cutLength - expected) < 1e-6, `${r.id}: ${r.cutLength} vs ${expected}`);
    assert.ok(r.angles?.plumbCut !== undefined && r.angles.seatCut !== undefined, `${r.id}: cut angles`);
  }
});

test('shed rafters actually CLIMB toward the high side (rotation sign, not just length)', () => {
  // A length-and-angle check passes even when the rafter is tilted the wrong way — the piece
  // is the right size, it just runs downhill into the ground. Only the direction vector
  // catches it, and a browser look caught it before this test existed.
  for (const highSide of ['N', 'S', 'E', 'W'] as WallId[]) {
    const spec = bldg({ kind: 'shed', risePer12: 4, overhangFt: 1, highSide });
    const model = generateStructure(spec);
    const rafters = model.members.filter((m) => m.role === 'rafter');
    assert.ok(rafters.length > 0, `${highSide}: no rafters`);
    for (const r of rafters) {
      // Rotate local +X (the member's length axis) into world space with the YXZ euler.
      const [rx, ry, rz] = r.rotation;
      const cz = Math.cos(rz), sz = Math.sin(rz);
      const cx = Math.cos(rx), sx = Math.sin(rx);
      const cy = Math.cos(ry), sy = Math.sin(ry);
      let [a, b, c] = [cz, sz, 0];
      [b, c] = [b * cx - c * sx, b * sx + c * cx];
      [a, c] = [a * cy + c * sy, -a * sy + c * cy];
      // Which way is uphill in plan?
      const uphill: [number, number] = highSide === 'N' ? [0, 1] : highSide === 'S' ? [0, -1]
        : highSide === 'E' ? [1, 0] : [-1, 0];
      const alongUphill = a * uphill[0] + c * uphill[1];
      // Take the direction that heads uphill in plan; its vertical component must be POSITIVE.
      const rise = alongUphill >= 0 ? b : -b;
      assert.ok(rise > 0.05, `${highSide}/${r.id}: rafter falls toward the high wall (rise ${rise.toFixed(3)})`);
    }
  }
});

test('shed rafters sit UNDER the roof deck, never above it', () => {
  const spec = bldg(
    { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' },
    { coverings: { wallSheathing: 'none', siding: 'none', roofDeck: 'plywood', roofing: 'none' } },
  );
  const model = generateStructure(spec);
  const rafters = model.members.filter((m) => m.role === 'rafter');
  const panels = model.members.filter((m) => m.role === 'roofPanel');
  assert.ok(rafters.length > 0 && panels.length > 0);
  // At matched z stations, the deck must be higher than the rafter centerline.
  for (const p of panels) {
    const near = rafters.filter((r) => Math.abs(r.position[2] - p.position[2]) < 1.5);
    for (const r of near) {
      assert.ok(p.position[1] > r.position[1], `${p.id} (y=${p.position[1].toFixed(2)}) must sit above ${r.id} (y=${r.position[1].toFixed(2)})`);
    }
  }
});

test('no roof kind produces a NaN, at any pitch, on any high side', () => {
  const roofs: RoofSpec[] = [];
  for (const risePer12 of [0, 1, 4, 12]) {
    roofs.push({ kind: 'gable', risePer12, overhangFt: 1 });
    for (const highSide of ['N', 'S', 'E', 'W'] as WallId[]) {
      roofs.push({ kind: 'shed', risePer12, overhangFt: 0.5, highSide });
    }
  }
  roofs.push({ kind: 'flat', overhangFt: 1 }, { kind: 'none' });
  for (const roof of roofs) {
    const model = generateStructure(bldg(roof));
    for (const m of model.members) {
      for (const v of [...m.position, ...m.rotation, m.cutLength]) {
        assert.ok(Number.isFinite(v), `${roof.kind}: ${m.id} non-finite`);
      }
      assert.ok(m.cutLength > 0, `${roof.kind}: ${m.id} cutLength ${m.cutLength}`);
    }
  }
});

test('roof: "none" frames no roof at all, and nothing downstream trips over it', () => {
  const model = generateStructure(bldg({ kind: 'none' }));
  assert.equal(roofPlanes(model.spec as BuildingSpec, 8).length, 0);
  assert.equal(model.members.filter((m) => m.role === 'rafter').length, 0);
  assert.ok(model.members.length > 100, 'the floor and walls still built');
});
