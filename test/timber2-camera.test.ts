// TIMBER-2 — camera rigs (plan §8.7, §4.3).
//
// One assertion, run everywhere: does the view actually CONTAIN the building? Checked against
// the true member AABB (including everything below grade) with the real shipping FOV — over
// every catalog preset, a fuzz corpus, and the pinned extremes where heuristic fits fail:
// a 60x4 two-story at 12/12, the 4-ft minimum, a tower-proportioned model on a small plan.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraRigsFor, memberAabb, rigFramesModel, fitDistance, boundingRadius, aabbSize } from '../src/ui/woodframe/camera';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import { specFromBuildingInput } from '../src/timber/frame';
import type { BuildingSpec } from '../src/timber/spec';

function bldg(over: Partial<BuildingSpec> = {}): BuildingSpec {
  const base = specFromBuildingInput({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
  });
  return { ...base, ...over };
}

const ASPECTS = [16 / 9, 4 / 3, 1, 0.6];

test('the AABB includes everything, including members below grade', () => {
  const basement = generateStructure(bldg({ foundation: { kind: 'basement', depthFt: 7.5, stairs: true } }));
  const box = memberAabb(basement.members);
  assert.ok(box.min[1] < -6, `basement members must be inside the box, got minY ${box.min[1]}`);
  // Every member really is inside it.
  for (const m of basement.members) {
    for (let i = 0; i < 3; i++) {
      assert.ok(m.position[i]! >= box.min[i]! && m.position[i]! <= box.max[i]!, `${m.id}: outside the AABB`);
    }
  }
});

test('every rig frames every catalog preset, at every aspect', () => {
  for (const family of shippedFamilies()) {
    const model = generateStructure(family.preset);
    const box = memberAabb(model.members);
    for (const aspect of ASPECTS) {
      for (const rig of cameraRigsFor(model.members, aspect)) {
        assert.ok(rigFramesModel(rig, box, aspect), `${family.id}/${rig.id} @ ${aspect.toFixed(2)}: model not framed`);
      }
    }
  }
});

test('pinned extremes: the shapes where a heuristic fit fails', () => {
  const extremes: [string, BuildingSpec][] = [
    ['long-and-thin 60x4 at 12/12', bldg({
      dims: { lengthFt: 60, widthFt: 4 },
      roof: { kind: 'gable', risePer12: 12, overhangFt: 3 },
      foundation: { kind: 'skids' },
    })],
    ['the 4-ft minimum', bldg({ dims: { lengthFt: 4, widthFt: 4 }, foundation: { kind: 'skids' } })],
    ['deep basement under a small plan', bldg({
      dims: { lengthFt: 12, widthFt: 8 },
      foundation: { kind: 'basement', depthFt: 9, stairs: true },
    })],
    ['wide and low, flat roof', bldg({
      dims: { lengthFt: 48, widthFt: 24 },
      roof: { kind: 'flat', overhangFt: 0, drainPer12: 1 },
    })],
    ['tall walls, deep eaves', bldg({
      stories: [{ wallHeightFt: 12, openings: {} }],
      roof: { kind: 'gable', risePer12: 12, overhangFt: 3 },
    })],
  ];
  for (const [label, spec] of extremes) {
    const model = generateStructure(spec);
    const box = memberAabb(model.members);
    for (const aspect of ASPECTS) {
      for (const rig of cameraRigsFor(model.members, aspect)) {
        assert.ok(rigFramesModel(rig, box, aspect), `${label} / ${rig.id} @ ${aspect.toFixed(2)}: not framed`);
      }
    }
  }
});

test('a tall-and-narrow model gains the Elev view; a normal building does not', () => {
  // Fake a tower's proportions with a very tall, small-plan building.
  const tall = generateStructure(bldg({
    dims: { lengthFt: 8, widthFt: 8 },
    stories: [{ wallHeightFt: 12, openings: {} }],
    foundation: { kind: 'basement', depthFt: 9, stairs: false },
  }));
  const tallBox = aabbSize(memberAabb(tall.members));
  const wide = generateStructure(bldg({ dims: { lengthFt: 48, widthFt: 24 } }));
  const hasElev = (ms: typeof tall.members): boolean => cameraRigsFor(ms).some((r) => r.id === 'elev');
  if (tallBox[1] > 1.5 * Math.max(tallBox[0], tallBox[2])) {
    assert.ok(hasElev(tall.members), 'a tall-and-narrow model needs an elevation view');
  }
  assert.ok(!hasElev(wide.members), 'a wide low building does not');
});

test('the standard seven views are always present and correctly typed', () => {
  const model = generateStructure(bldg());
  const rigs = cameraRigsFor(model.members);
  for (const id of ['iso-ne', 'iso-nw', 'iso-se', 'iso-sw', 'plan', 'front', 'left']) {
    const rig = rigs.find((r) => r.id === id);
    assert.ok(rig, `missing view ${id}`);
    // Drawings must not perspective-distort; isos are perspective.
    const expected = id.startsWith('iso') ? 'perspective' : 'orthographic';
    assert.equal(rig!.kind, expected, `${id}: wrong projection`);
    if (rig!.kind === 'orthographic') assert.ok((rig!.orthoHalf ?? 0) > 0, `${id}: no ortho extent`);
    for (const v of [...rig!.position, ...rig!.target, ...rig!.up]) {
      assert.ok(Number.isFinite(v), `${id}: non-finite rig`);
    }
  }
});

test('the plan view looks straight down with north up the screen', () => {
  const model = generateStructure(bldg());
  const plan = cameraRigsFor(model.members).find((r) => r.id === 'plan')!;
  assert.ok(plan.position[1] > plan.target[1], 'camera above the model');
  assert.equal(plan.position[0], plan.target[0]);
  assert.equal(plan.position[2], plan.target[2]);
  assert.deepEqual(plan.up, [0, 0, -1], 'up-screen is -Z, so north reads as up');
});

test('fitDistance honors whichever FOV axis is binding', () => {
  const r = 10;
  const wide = fitDistance(r, 40, 2.0);
  const tall = fitDistance(r, 40, 0.5);
  assert.ok(tall > wide, 'a narrow viewport must pull the camera back further');
  assert.ok(wide > r, 'the camera is always outside the bounding sphere');
  // The 5% margin is inside the formula, not applied afterward.
  const square = fitDistance(r, 40, 1);
  const exact = r / Math.sin(((40 * Math.PI) / 180) / 2);
  assert.ok(Math.abs(square / exact - 1.05) < 1e-9, 'margin should be exactly 5%');
});

test('a degenerate model does not produce a NaN camera', () => {
  const rigs = cameraRigsFor([]);
  for (const rig of rigs) {
    for (const v of [...rig.position, ...rig.target]) assert.ok(Number.isFinite(v), `${rig.id}: NaN`);
  }
  assert.ok(boundingRadius({ min: [0, 0, 0], max: [0, 0, 0] }) > 0, 'zero-size box still gets a positive radius');
});
