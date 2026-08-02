// TIMBER-2 — the C-4 wall contract (plan §3.2).
//
// The contract's whole purpose is that NOBODY re-derives where a wall sits. So the test is
// not "does the contract agree with itself" — it is "does the contract agree with the framing
// the frozen generator actually emitted." If those two ever part company, siding lands 1.75
// inches off the wall and every downstream surface inherits the error.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { specFromBuildingInput, type BuildingInput } from '../src/timber/frame';
import { wallContract, surfacePoint, surfaceYaw } from '../src/timber/subsystems/wallSystem';
import { WALL_ORDER, type BuildingSpec } from '../src/timber/spec';
import { DRESSED } from '../src/timber/types';

const demo: BuildingInput = {
  lengthFt: 20, widthFt: 16, wallHeightFt: 8,
  studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
  risePer12: 4, overhangFt: 1, crawlFt: 1.5,
  openings: [
    { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    { wall: 'S', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
    { wall: 'N', offsetFt: 8.5, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
  ],
};
const spec = (): BuildingSpec => specFromBuildingInput(demo);

test('the contract covers all four walls, in the const order', () => {
  const c = wallContract(20, 16, 8, spec().stories[0]!.openings);
  assert.deepEqual(c.surfaces.map((s) => s.wall), [...WALL_ORDER]);
  assert.equal(c.thicknessFt, DRESSED['2x4']!.d / 12, 'a 2x4 wall is 3.5 in thick, not 1.5');
  assert.equal(c.plateTopY, 8);
});

test('surfaces sit where the FROZEN generator actually put the framing', () => {
  const model = generateStructure(spec());
  const c = wallContract(20, 16, 8, spec().stories[0]!.openings);
  for (const s of c.surfaces) {
    const studs = model.members.filter((m) => m.wall === s.wall && m.role === 'stud');
    assert.ok(studs.length > 0, `${s.wall}: no studs to check against`);
    for (const stud of studs) {
      // Distance from the stud's center to the wall's centerline plane must be ~0: the stud
      // is IN the wall the contract describes.
      const [ox, oz] = s.origin;
      const dx = stud.position[0] - ox;
      const dz = stud.position[2] - oz;
      const offNormal = dx * s.normal[0] + dz * s.normal[1];
      assert.ok(Math.abs(offNormal) < 1e-9, `${stud.id}: ${offNormal} ft off the ${s.wall} wall plane`);
      // And it lies within the wall's run.
      const along = dx * s.along[0] + dz * s.along[1];
      assert.ok(along > -0.01 && along < s.runFt + 0.01, `${stud.id}: u=${along} outside run ${s.runFt}`);
    }
  }
});

test('cutouts equal the spec openings — the hole in the sheathing is where the window is', () => {
  const openings = spec().stories[0]!.openings;
  const c = wallContract(20, 16, 8, openings);
  for (const s of c.surfaces) {
    const specList = openings[s.wall] ?? [];
    assert.equal(s.cutouts.length, specList.length, `${s.wall}: cutout count`);
    s.cutouts.forEach((cut, i) => {
      const o = specList[i]!;
      assert.equal(cut.u0, o.offsetFt, `${s.wall}[${i}]: left edge`);
      assert.equal(cut.u1, o.offsetFt + o.widthFt, `${s.wall}[${i}]: right edge`);
      assert.equal(cut.v1 - cut.v0, o.heightFt, `${s.wall}[${i}]: height`);
      // Rough openings are measured from the sole-plate TOP; the contract converts once.
      assert.ok(Math.abs(cut.v0 - (c.plateThicknessFt + o.sillHeightFt)) < 1e-12, `${s.wall}[${i}]: sill datum`);
    });
  }
});

test('cutouts land inside their wall and against real framing', () => {
  const model = generateStructure(spec());
  const c = wallContract(20, 16, 8, spec().stories[0]!.openings);
  for (const s of c.surfaces) {
    for (const cut of s.cutouts) {
      assert.ok(cut.u0 >= 0 && cut.u1 <= s.runFt + 1e-9, `${s.wall}: cutout ${cut.u0}–${cut.u1} outside run ${s.runFt}`);
      assert.ok(cut.v0 >= 0 && cut.v1 <= s.heightFt + 1e-9, `${s.wall}: cutout height outside the wall`);
      // A header exists above every cutout, near its horizontal center.
      const midU = (cut.u0 + cut.u1) / 2;
      const [hx, , hz] = surfacePoint(s, midU, 0);
      const headers = model.members.filter((m) => m.wall === s.wall && m.role === 'header');
      const near = headers.some((h) => Math.hypot(h.position[0] - hx, h.position[2] - hz) < 1.0);
      assert.ok(near, `${s.wall}: no header found above the cutout at u=${midU}`);
    }
  }
});

test('bearings publish the plate lines a floor above would sit on', () => {
  const c = wallContract(20, 16, 8, {});
  assert.equal(c.bearings.length, 4);
  for (const b of c.bearings) {
    assert.equal(b.kind, 'plate');
    assert.equal(b.topY, 8, 'bearing elevation is the cap-plate top');
    const len = Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]);
    assert.ok(len > 10, `${b.id}: degenerate bearing line (${len} ft)`);
  }
  // The two long bearings are the N/S walls; the short ones butt between them.
  const lens = c.bearings.map((b) => Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1])).sort((a, b) => a - b);
  assert.ok(Math.abs(lens[3]! - 20) < 1e-9 && Math.abs(lens[2]! - 20) < 1e-9, 'N/S run the full length');
  assert.ok(lens[0]! < 16, 'E/W fit between them');
});

test('surfaceYaw matches the legacy wall yaw convention', () => {
  const c = wallContract(20, 16, 8, {});
  const yawOf = (w: string): number => surfaceYaw(c.surfaces.find((s) => s.wall === w)!);
  assert.ok(Math.abs(yawOf('S') - 0) < 1e-12);
  assert.ok(Math.abs(Math.abs(yawOf('N')) - Math.PI) < 1e-12);
  assert.ok(Math.abs(yawOf('E') - -Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(yawOf('W') - Math.PI / 2) < 1e-12);
});

test('baseY lifts the whole contract — how a second story will bear on the first', () => {
  const c = wallContract(20, 16, 8, {}, 9.5);
  assert.equal(c.plateTopY, 17.5);
  for (const b of c.bearings) assert.equal(b.topY, 17.5);
});
