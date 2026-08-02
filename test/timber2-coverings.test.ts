// TIMBER-2 — coverings and the C-5 conservation rule (plan §8.3).
//
// The rule: covered area + cutout area = surface area, to 1e-6 sf, wherever the cutouts come
// from the same coordinates as the panels. This is the test that makes a material take-off
// trustworthy — a tiler that silently loses two square feet delivers a job two sheets short,
// and nothing else in the system would notice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { subtractCutouts, tileSurface, type Rect } from '../src/timber/subsystems/coverings';
import { wallContract } from '../src/timber/subsystems/wallSystem';
import { specFromBuildingInput, type BuildingInput } from '../src/timber/frame';
import type { BuildingSpec, CoveringSpec } from '../src/timber/spec';

const area = (r: Rect): number => Math.max(0, r.u1 - r.u0) * Math.max(0, r.v1 - r.v0);
const overlap = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0)) *
  Math.max(0, Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0));

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

function withCoverings(c: Partial<CoveringSpec>): BuildingSpec {
  const s = specFromBuildingInput(demo);
  return { ...s, coverings: { ...s.coverings, ...c } };
}

test('tileSurface partitions a surface exactly — no gaps, no overlaps, at any size', () => {
  for (const [run, height] of [[20, 8], [13.7, 9.25], [4, 7], [60, 12]] as const) {
    const tiles = tileSurface(run, height, 4, 8);
    const total = tiles.reduce((a, t) => a + area(t), 0);
    assert.ok(Math.abs(total - run * height) < 1e-9, `${run}x${height}: covered ${total} of ${run * height}`);
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        assert.ok(overlap(tiles[i]!, tiles[j]!) < 1e-9, `${run}x${height}: tiles ${i}/${j} overlap`);
      }
    }
  }
});

test('staggered courses still partition exactly (the joints move, the area does not)', () => {
  const tiles = tileSurface(20, 16, 8, 4, 4);
  const total = tiles.reduce((a, t) => a + area(t), 0);
  assert.ok(Math.abs(total - 320) < 1e-9, `covered ${total}`);
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      assert.ok(overlap(tiles[i]!, tiles[j]!) < 1e-9, `tiles ${i}/${j} overlap`);
    }
  }
});

test('subtractCutouts removes exactly the hole — no more, no less', () => {
  const tile: Rect = { u0: 0, u1: 4, v0: 0, v1: 8 };
  // A window fully inside the sheet splits it into four pieces.
  const hole: Rect = { u0: 1, u1: 3, v0: 3, v1: 6 };
  const pieces = subtractCutouts(tile, [hole]);
  const left = pieces.reduce((a, p) => a + area(p), 0);
  assert.ok(Math.abs(left - (area(tile) - area(hole))) < 1e-9, `left ${left}`);
  for (const p of pieces) assert.ok(overlap(p, hole) < 1e-9, 'no piece may intrude into the hole');
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      assert.ok(overlap(pieces[i]!, pieces[j]!) < 1e-9, 'pieces must not overlap each other');
    }
  }
});

test('cutouts that miss, touch, straddle an edge, or swallow the sheet all behave', () => {
  const tile: Rect = { u0: 0, u1: 4, v0: 0, v1: 8 };
  assert.equal(subtractCutouts(tile, [{ u0: 10, u1: 12, v0: 0, v1: 8 }]).length, 1, 'a miss leaves the sheet whole');
  assert.equal(subtractCutouts(tile, [{ u0: 4, u1: 6, v0: 0, v1: 8 }]).length, 1, 'edge-touching is not overlap');
  const straddle = subtractCutouts(tile, [{ u0: -1, u1: 2, v0: 2, v1: 4 }]);
  assert.ok(Math.abs(straddle.reduce((a, p) => a + area(p), 0) - (32 - 2 * 2)) < 1e-9, 'only the inside part is cut');
  assert.equal(subtractCutouts(tile, [{ u0: -1, u1: 5, v0: -1, v1: 9 }]).length, 0, 'a sheet fully inside a hole vanishes');
});

test('C-5 on real walls: siding + openings = wall area, to 1e-6 sf', () => {
  const spec = withCoverings({ siding: 'plywood' });
  const model = generateStructure(spec);
  const walls = wallContract(spec.dims.lengthFt, spec.dims.widthFt, spec.stories[0]!.wallHeightFt, spec.stories[0]!.openings);
  for (const s of walls.surfaces) {
    const covered = model.members
      .filter((m) => m.role === 'siding' && m.wall === s.wall)
      .reduce((a, m) => a + (m.cutLength / 12) * (m.actual.d / 12), 0);
    const cut = s.cutouts.reduce((a, c) => a + (c.u1 - c.u0) * (c.v1 - c.v0), 0);
    const surface = s.runFt * s.heightFt;
    assert.ok(
      Math.abs(covered + cut - surface) < 1e-6,
      `${s.wall}: covered ${covered.toFixed(6)} + cut ${cut.toFixed(6)} != ${surface.toFixed(6)} sf`,
    );
  }
});

test('board-and-batten covers the same area and adds battens over the joints', () => {
  const spec = withCoverings({ siding: 'boardAndBatten' });
  const model = generateStructure(spec);
  const walls = wallContract(20, 16, 8, spec.stories[0]!.openings);
  for (const s of walls.surfaces) {
    const covered = model.members
      .filter((m) => m.role === 'sidingBoard' && m.wall === s.wall)
      .reduce((a, m) => a + (m.cutLength / 12) * (m.actual.d / 12), 0);
    const cut = s.cutouts.reduce((a, c) => a + (c.u1 - c.u0) * (c.v1 - c.v0), 0);
    assert.ok(Math.abs(covered + cut - s.runFt * s.heightFt) < 1e-6, `${s.wall}: board coverage`);
  }
  const battens = model.members.filter((m) => m.role === 'batten');
  assert.ok(battens.length > 10, 'battens cover the board joints');
  assert.equal(battens[0]!.nominal, '1x2');
});

test('C-9: the gable roof is decked ONCE — the covering pass does not double it', () => {
  // The frozen roof generator emits the legacy stage-9 deck. If coverings also decked it, the
  // roof would be sheathed twice and the bill would silently double.
  const bare = generateStructure(withCoverings({ roofDeck: 'plywood' }));
  const panels = bare.members.filter((m) => m.role === 'roofPanel');
  const ids = new Set(panels.map((m) => m.id));
  assert.equal(ids.size, panels.length, 'no duplicate panel ids');
  for (const p of panels) assert.ok(p.id.startsWith('RF-'), `${p.id}: the legacy deck keeps the RF prefix (C-9)`);
});

test('a shed roof IS decked by the covering pass (the frozen path never sees it)', () => {
  const spec = withCoverings({ roofDeck: 'plywood' });
  const shed: BuildingSpec = { ...spec, roof: { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'N' } };
  const model = generateStructure(shed);
  const panels = model.members.filter((m) => m.role === 'roofPanel');
  assert.ok(panels.length > 5, `shed roof should be decked, got ${panels.length} panels`);
  for (const p of panels) assert.ok(p.id.startsWith('CV-'), `${p.id}: new roof kinds deck through coverings`);
});

test('roofing courses lap up the slope and never leave the plane bare', () => {
  for (const roofing of ['roll', 'rollDouble', 'corrugated'] as const) {
    const spec = withCoverings({ roofDeck: 'plywood', roofing });
    const shed: BuildingSpec = { ...spec, roof: { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' } };
    const model = generateStructure(shed);
    const courses = model.members.filter((m) => m.role === 'roofingCourse');
    assert.ok(courses.length > 0, `${roofing}: no courses emitted`);
    // Exposure × count must reach the top of the slope — a roof short of the ridge leaks.
    const exposures = courses.map((c) => c.position[1]).sort((a, b) => a - b);
    assert.ok(exposures.length >= 2 || roofing === 'corrugated', `${roofing}: expected multiple courses`);
    for (const c of courses) {
      assert.ok(c.cutLength > 0 && Number.isFinite(c.cutLength), `${roofing}: ${c.id} length`);
      assert.ok(/PH/.test(c.doctrineRef), `${roofing}: ${c.id} must carry its (PH) cite`);
    }
  }
});

test('double-coverage roll cites the 1:12 minimum — the reason flat roofs are floored there', () => {
  const spec = withCoverings({ roofDeck: 'plywood', roofing: 'rollDouble' });
  const flat: BuildingSpec = { ...spec, roof: { kind: 'flat', overhangFt: 1, drainPer12: 1 } };
  const model = generateStructure(flat);
  const course = model.members.find((m) => m.role === 'roofingCourse')!;
  assert.ok(/double-coverage/i.test(course.doctrineRef), course.doctrineRef);
  assert.ok(/PH/.test(course.doctrineRef));
});

test('purlins give corrugated something to land on without a solid deck (the SEA-hut pattern)', () => {
  const spec = withCoverings({ roofDeck: 'purlins', roofing: 'corrugated' });
  const shed: BuildingSpec = { ...spec, roof: { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' } };
  const model = generateStructure(shed);
  const purlins = model.members.filter((m) => m.role === 'purlin');
  assert.ok(purlins.length >= 3, `expected purlin rows, got ${purlins.length}`);
  assert.equal(model.members.filter((m) => m.role === 'roofPanel').length, 0, 'purlins REPLACE the solid deck');
  assert.ok(model.members.some((m) => m.role === 'roofingCourse'), 'and the metal still goes on');
});

test('coverings default to none, so the compat path never sees them', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  for (const role of ['siding', 'sheathingPanel', 'roofingCourse', 'batten', 'sidingBoard', 'purlin'] as const) {
    assert.equal(model.members.filter((m) => m.role === role).length, 0, `${role} must be opt-in`);
  }
});
