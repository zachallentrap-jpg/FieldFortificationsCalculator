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
import { generatePurlins, pyramidPlanes, planeSpanAt, roofPlanes } from '../src/timber/subsystems/roofFamilies';
import { familyById } from '../src/timber/catalog';
import { wallContract } from '../src/timber/subsystems/wallSystem';
import { specFromBuildingInput, type BuildingInput } from '../src/timber/frame';
import type { BuildingSpec, CoveringSpec } from '../src/timber/spec';
import { DRESSED } from '../src/timber/types';
import { LUMBER, ROOFING } from '../src/timber/doctrine';
import { rafterSeatLiftFt } from '../src/timber/birdsMouth';

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

// C-5 ON REAL WALLS. Stated per wall against `runFt` this passed for months with a 3½-in strip
// of bare framing standing in every corner of every building, sole plate to cap plate. `runFt`
// is a butting wall's CLEAR STRUCTURAL SPAN — a rectangle is framed with one pair of walls
// running through and the other pair between them, so the butting pair's run stops at the
// through walls' INNER faces. The tiler covered exactly what it was told to and the corners were
// nobody's job.
//
// THE PERIMETER IS THE CLAIM THAT CANNOT BE SATISFIED WITH THE CORNERS OPEN. A skin covers the
// face a building presents to the weather, and that face is 2(L + W) round the outside — a
// figure no per-wall run adds up to unless every corner is closed.
const skinArea = (model: ReturnType<typeof generateStructure>, roles: readonly string[]): number =>
  model.members
    .filter((m) => roles.includes(m.role) && m.wall !== undefined && m.id.startsWith('CV-'))
    .reduce((a, m) => a + (m.cutLength / 12) * (m.actual.d / 12), 0);

const openingArea = (walls: ReturnType<typeof wallContract>): number =>
  walls.surfaces.reduce((a, s) => a + s.cutouts.reduce((b, c) => b + (c.u1 - c.u0) * (c.v1 - c.v0), 0), 0);

test('C-5 on real walls: the skin covers the whole outside face — perimeter, not four clear runs', () => {
  const spec = withCoverings({ siding: 'plywood' });
  const model = generateStructure(spec);
  const walls = wallContract(spec.dims.lengthFt, spec.dims.widthFt, spec.stories[0]!.wallHeightFt, spec.stories[0]!.openings);
  // The wall PROPER — pieces from the wall pass ('CV'), not the raked infill above the plate
  // ('RK'), which closes in a different region and is conserved by its own test.
  const covered = skinArea(model, ['siding']);
  const face = 2 * (spec.dims.lengthFt + spec.dims.widthFt) * spec.stories[0]!.wallHeightFt;
  assert.ok(Math.abs(covered + openingArea(walls) - face) < 1e-6,
    `covered ${covered.toFixed(6)} + openings ${openingArea(walls).toFixed(6)} != the building's `
    + `${face.toFixed(6)} sf of outside face`);
  // And nothing is doubled up: two skins meeting at a corner arris touch, they do not overlap.
  // Area alone cannot tell an overlap from a gap of the same size.
  for (const wall of ['E', 'W'] as const) {
    const s = walls.surfaces.find((q) => q.wall === wall)!;
    const mine = model.members.filter((m) => m.role === 'siding' && m.wall === wall && m.id.startsWith('CV-'));
    const ends = mine.flatMap((m) => {
      const halfU = (m.cutLength / 12) / 2;
      const along = (m.position[0] - s.origin[0]) * s.along[0] + (m.position[2] - s.origin[1]) * s.along[1];
      return [along - halfU, along + halfU];
    });
    const thick = walls.thicknessFt;
    assert.ok(Math.abs(Math.min(...ends) - -thick) < 1e-9 && Math.abs(Math.max(...ends) - (s.runFt + thick)) < 1e-9,
      `${wall}: the skin runs ${Math.min(...ends).toFixed(4)}..${Math.max(...ends).toFixed(4)} where the `
      + `wall's FACE runs ${(-thick).toFixed(4)}..${(s.runFt + thick).toFixed(4)}`);
  }
});

test('board-and-batten covers the same face and adds battens over the joints', () => {
  const spec = withCoverings({ siding: 'boardAndBatten' });
  const model = generateStructure(spec);
  const walls = wallContract(20, 16, 8, spec.stories[0]!.openings);
  const covered = skinArea(model, ['sidingBoard']);
  const face = 2 * (20 + 16) * 8;
  assert.ok(Math.abs(covered + openingArea(walls) - face) < 1e-6,
    `boards cover ${covered.toFixed(6)} + openings ${openingArea(walls).toFixed(6)} != ${face} sf`);
  const battens = model.members.filter((m) => m.role === 'batten');
  assert.ok(battens.length > 10, 'battens cover the board joints');
  assert.equal(battens[0]!.nominal, '1x2');
});

test('board siding and battens run VERTICALLY — board-and-batten is not lap siding', () => {
  const model = generateStructure(withCoverings({ siding: 'boardAndBatten' }));
  const lengthDir = (r: readonly [number, number, number]): [number, number, number] => {
    const [rx, ry, rz] = r;
    const cz = Math.cos(rz), sz = Math.sin(rz), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
    let [a, b, c] = [cz, sz, 0];
    [b, c] = [b * cx - c * sx, b * sx + c * cx];
    [a, c] = [a * cy + c * sy, -a * sy + c * cy];
    return [a, b, c];
  };
  for (const role of ['sidingBoard', 'batten'] as const) {
    const pieces = model.members.filter((m) => m.role === role);
    assert.ok(pieces.length > 0, `${role}: none emitted`);
    for (const p of pieces) {
      const d = lengthDir(p.rotation);
      assert.ok(Math.abs(Math.abs(d[1]) - 1) < 1e-9, `${p.id}: length axis is not vertical (${d.map((n) => n.toFixed(2))})`);
    }
  }
  // And a board is taller than it is wide — the give-away if the axes ever swap.
  const board = model.members.find((m) => m.role === 'sidingBoard')!;
  assert.ok(board.cutLength > board.actual.d, 'a siding board runs the height of the wall');
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

test('purlins are clipped to their plane and ride ON the rafters — every course, every plane', () => {
  // The owner's hip roof: purlin sticks ran full eave length on the tapered planes, lancing
  // out past the hips, and sat half-buried in the rafters. The contract, checked in plane
  // coordinates: normal offset is exactly rafterHalf + thick/2, both ends inside
  // `planeSpanAt` at the course's UP-slope edge, and no course crosses the ridge or peak.
  const rafterHalf = 0.229;
  const planes = pyramidPlanes([8, 8], 5, 10, 3); // four triangular planes — worst-case taper
  const purlins = generatePurlins(planes, 4, rafterHalf);
  assert.ok(purlins.length >= 8, `expected rows on four planes, got ${purlins.length}`);
  const nominal = LUMBER.purlinNominal.value as string;
  const thick = DRESSED[nominal]!.w / 12;
  const face = DRESSED[nominal]!.d / 12;
  const lift = rafterHalf + thick / 2;
  const dot = (a: readonly number[], b: readonly number[]): number =>
    a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  for (const m of purlins) {
    const homes = planes.filter((p) => {
      const d = [m.position[0] - p.origin[0], m.position[1] - p.origin[1], m.position[2] - p.origin[2]];
      return Math.abs(dot(d, p.normal) - lift) < 1e-6 && dot(d, p.upSlope) > -1e-6;
    });
    assert.equal(homes.length, 1, `${m.id}: expected exactly one home plane, got ${homes.length}`);
    const p = homes[0]!;
    const d = [m.position[0] - p.origin[0], m.position[1] - p.origin[1], m.position[2] - p.origin[2]];
    const u = dot(d, p.alongEave);
    const v = dot(d, p.upSlope);
    assert.ok(v <= p.slopeLengthFt - face / 2 + 1e-6, `${m.id}: crosses the peak (v=${v.toFixed(2)})`);
    const span = planeSpanAt(p, v + face / 2);
    const halfLen = m.cutLength / 12 / 2; // Member.cutLength is inches
    assert.ok(u - halfLen >= span.lo - 1e-6, `${m.id}: left end past the hip`);
    assert.ok(u + halfLen <= span.hi + 1e-6, `${m.id}: right end past the hip`);
  }
  const lens = purlins.map((m) => m.cutLength / 12);
  assert.ok(Math.min(...lens) < Math.max(...lens) - 1, 'tapered planes must produce tapered courses');
});

test('the owner’s roof: hip + purlins + corrugated stacks and stages correctly end to end', () => {
  const spec = withCoverings({ roofDeck: 'purlins', roofing: 'corrugated' });
  const hip: BuildingSpec = { ...spec, roof: { kind: 'hip', risePer12: 4, overhangFt: 1 } };
  const model = generateStructure(hip);
  const purlins = model.members.filter((m) => m.role === 'purlin');
  assert.ok(purlins.length >= 12, `four planes of rows, got ${purlins.length}`);
  const eaveMax = 20 + 2 * 1; // longest plane width, overhang included
  for (const m of purlins) {
    const lenFt = m.cutLength / 12;
    assert.ok(lenFt <= eaveMax + 1e-6, `${m.id} is ${lenFt.toFixed(1)} ft — wider than the roof`);
  }
  const deckStage = model.stagePlan.find((e) => e.key === 'roof-deck')!;
  for (const m of purlins) assert.equal(m.stage, deckStage.ordinal, `${m.id} outside the deck stage`);
  assert.ok(model.members.some((m) => m.role === 'roofingCourse'), 'the metal goes on');
  assert.ok(model.members.some((m) => m.role === 'ridgeCap'), 'ridge and hips get caps');
});

test('a frozen-decked gable resolves purlins to its own solid deck — one deck system, one bill', () => {
  // The gable's stage-9 deck is part of the frozen branch's output (C-9), not an option.
  // Emitting purlins too would put two deck systems on the roof and both on the bill.
  const spec = withCoverings({ roofDeck: 'purlins', roofing: 'corrugated' }); // demo roof is gable
  const model = generateStructure(spec);
  assert.equal(model.members.filter((m) => m.role === 'purlin').length, 0, 'no purlins over a frozen deck');
  assert.ok(model.members.filter((m) => m.role === 'roofPanel').length > 0, 'the frozen stage-9 deck IS the deck');
  assert.ok(model.members.some((m) => m.role === 'roofingCourse'), 'and the metal still goes on');
});

// ── Raked infill: closing in above the plates ────────────────────────────────

/** Total area of every infill piece ('RK') on one wall, in square feet. */
const infillArea = (model: { members: readonly { id: string; wall?: string; cutLength: number; actual: { d: number } }[] }, wall: string): number =>
  model.members
    .filter((m) => m.id.startsWith('RK-') && m.wall === wall)
    .reduce((a, m) => a + (m.cutLength / 12) * (m.actual.d / 12), 0);

test('a gable end is CLOSED IN — the triangle above the plate is not left open framing', () => {
  // What the screenshot showed: siding stopped dead at the cap plate and the whole gable
  // triangle was bare studs you could see straight through.
  const model = generateStructure(withCoverings({ siding: 'plywood' }));
  const W = 16, slope = 4 / 12;
  // The gable ends are the walls that BUTT BETWEEN the through walls, so the triangle is cut
  // off a wall thickness at each end: ∫ slope·z dz over the clear run, doubled about the ridge.
  const t = DRESSED['2x4']!.d / 12;
  // Plus the strip the seated rafter plane adds: the whole roof sits one bird's-mouth above the
  // plate (`rafterSeatLiftFt`), so the wall that closes in under it is that much taller across
  // its entire clear run. Leave this out and the siding stops short of the rake.
  const lift = rafterSeatLiftFt(DRESSED['2x6']!.d, DRESSED['2x4']!.d, slope);
  const trueTriangle = slope * ((W / 2) ** 2 - t ** 2) + lift * (W - 2 * t);
  for (const wall of ['E', 'W'] as const) {
    const got = infillArea(model, wall);
    assert.ok(
      Math.abs(got - trueTriangle) / trueTriangle < 0.01,
      `${wall}: gable infill ${got.toFixed(3)} sf vs triangle ${trueTriangle.toFixed(3)} sf`,
    );
  }
  // The walls the rafters BEAR on have nothing above the plate.
  for (const wall of ['N', 'S'] as const) {
    assert.ok(infillArea(model, wall) < 1e-9, `${wall}: a bearing wall has no gable to close in`);
  }
});

test('a shed closes in its pony wall and both rakes; a hip has nothing to close in', () => {
  const base = withCoverings({ siding: 'plywood' });
  const L = 20, W = 16, slope = 4 / 12;

  const shed = generateStructure({ ...base, roof: { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' } });
  // High wall: a pony wall of constant height over a wall that runs the full length.
  //
  // TO THE PONY PLATE, NOT TO THE ROOF PLANE. `W · slope + lift` is where the rafters' CENTRE line
  // crosses this wall, and the rafters CROSS it — they land on its plate and run on to the eave —
  // so siding taken up to that line buried every one of them to half its depth (48 pairs at
  // 2.750 in). The pony wall's own height is `(W − plateWidth)·slope`, which `generateShed`
  // computes and states, and its plate top IS the rafters' underside. The `lift` still belongs on
  // the two RAKES below, where the siding runs up beside the end rafter rather than under it.
  const lift = rafterSeatLiftFt(DRESSED['2x6']!.d, DRESSED['2x4']!.d, slope);
  const plateWidth = DRESSED['2x4']!.d / 12;
  assert.ok(Math.abs(infillArea(shed, 'N') - L * (W - plateWidth) * slope) < 1e-6,
    `pony wall over the high plate: ${infillArea(shed, 'N')} vs ${L * (W - plateWidth) * slope}`);
  // The two walls parallel to the slope: a right triangle rising to the high side over the FULL
  // WIDTH, corner to corner — not over the clear run between the through walls, which is where
  // this used to stop and is how a 3½-in strip of open rake stood in each corner. The profile is
  // linear and the strips are cut to the middle of what each spans, so the area is EXACT.
  const rake = (slope * W * W) / 2 + lift * W;
  for (const wall of ['E', 'W'] as const) {
    assert.ok(Math.abs(infillArea(shed, wall) - rake) < 1e-6, `${wall}: rake infill ${infillArea(shed, wall)} vs ${rake}`);
  }
  assert.ok(infillArea(shed, 'S') < 1e-9, 'the low wall stops at its plate');

  // A hip brings all four slopes down to the plate — nothing above it anywhere. This is the
  // case that proves the profiles are the roof's geometry and not a blanket rule.
  const hip = generateStructure({ ...base, roof: { kind: 'hip', risePer12: 4, overhangFt: 1 } });
  assert.equal(hip.members.filter((m) => m.id.startsWith('RK-')).length, 0, 'a hip has no infill');
});

test('infill is cut to the rake, never above it, and carries the wall’s own material', () => {
  for (const [siding, role] of [['plywood', 'siding'], ['boardAndBatten', 'sidingBoard'], ['boards', 'siding']] as const) {
    const model = generateStructure(withCoverings({ siding }));
    const pieces = model.members.filter((m) => m.id.startsWith('RK-'));
    assert.ok(pieces.length > 0, `${siding}: nothing closed in`);
    for (const m of pieces) {
      // A batten IS the wall's own material when the wall is board-and-batten — it is the other
      // half of the pair, and it belongs above the plate for the same reason the boards do.
      const allowed = siding === 'boardAndBatten' ? [role, 'batten'] : [role];
      assert.ok(allowed.includes(m.role), `${siding}: ${m.id} is ${m.role}, not the wall's own material`);
      // Nothing pokes above the ridge: plate top (8 ft), the seat lift, and the gable rise.
      const top = m.position[1] + (role === 'siding' && siding === 'plywood' ? m.actual.d / 12 : m.cutLength / 12) / 2;
      const ridge = 8 + rafterSeatLiftFt(DRESSED['2x6']!.d, DRESSED['2x4']!.d, 4 / 12) + (16 / 2) * (4 / 12);
      assert.ok(top <= ridge + 1e-6, `${m.id} stands ${top.toFixed(2)} ft — above the ridge at ${ridge.toFixed(2)}`);
    }
  }
});

test('siding stands off sheathing by the SHEATHING’s thickness, in every combination', () => {
  // The standoff came from `PANEL.sidingThickIn` whatever the sheathing was. That is right for
  // plywood (½ in) and wrong for boards (¾), so board sheathing held the siding out by half an
  // inch and the siding sat a QUARTER INCH INSIDE it — two skins in the same quarter inch, on
  // every wall, from a constant that happened to be correct for one of the two choices.
  for (const wallSheathing of ['plywood', 'boards'] as const) {
    for (const siding of ['plywood', 'boards', 'boardAndBatten'] as const) {
      const model = generateStructure(withCoverings({ wallSheathing, siding }));
      for (const wall of ['S', 'N', 'E', 'W'] as const) {
        const sheath = model.members.find((m) => m.role === 'sheathingPanel' && m.wall === wall);
        const skin = model.members.find((m) => (m.role === 'siding' || m.role === 'sidingBoard') && m.wall === wall);
        assert.ok(sheath && skin, `${wallSheathing}/${siding} on ${wall}: both layers must exist`);
        // Along the wall's outward normal: how far each layer's faces are from the wall plane.
        // Both layers carry their thickness in `actual.w`, so the inner face of the outer layer
        // must land exactly on the outer face of the inner one.
        const axis = wall === 'S' || wall === 'N' ? 2 : 0;
        const dir = Math.sign(skin!.position[axis]! - sheath!.position[axis]!) || 1;
        const sheathOuter = sheath!.position[axis]! + dir * (sheath!.actual.w / 12 / 2);
        const skinInner = skin!.position[axis]! - dir * (skin!.actual.w / 12 / 2);
        assert.ok(
          Math.abs(skinInner - sheathOuter) < 1e-9,
          `${wallSheathing} + ${siding} on ${wall}: layers overlap/gap by `
          + `${((skinInner - sheathOuter) * dir * 12).toFixed(3)} in`,
        );
      }
    }
  }
});

test('building paper lays felt between the deck and the roofing, and lifts the roofing onto it', () => {
  // `buildingPaper` was accepted by generateRoofCovering's input type, never destructured, and
  // never emitted. ROOFING.feltWidthIn and feltLapIn sat unused in doctrine, the `felt` role sat
  // unused in the union with the label "Underlayment between deck and roofing", and this
  // module's header claimed felt was among the things it generates. Every part existed except
  // the part that makes it exist.
  const off = generateStructure(withCoverings({ roofDeck: 'plywood', roofing: 'roll' }));
  assert.equal(off.members.filter((m) => m.role === 'felt').length, 0, 'felt is opt-in');

  const on = generateStructure(withCoverings({ roofDeck: 'plywood', roofing: 'roll', buildingPaper: true }));
  const felt = on.members.filter((m) => m.role === 'felt');
  assert.ok(felt.length > 0, 'asking for building paper must put felt on the roof');

  // The roofing rides ON the felt: every course moves up by the felt's thickness measured
  // SQUARE TO THE ROOF, so the vertical rise is that times cos(pitch). Asserting the plain
  // thickness would pass only on a flat roof, and would not distinguish a layer stacked along
  // the slope normal from one nudged straight up.
  const feltThick = 0.05 / 12; // ROOFING.feltThickIn, in feet
  const rise = feltThick * Math.cos(Math.atan(4 / 12)); // the demo roof's pitch
  const courseOff = off.members.filter((m) => m.role === 'roofingCourse');
  const courseOn = on.members.filter((m) => m.role === 'roofingCourse');
  assert.equal(courseOn.length, courseOff.length, 'felt must not change how the roofing is cut');
  for (let i = 0; i < courseOff.length; i++) {
    const got = courseOn[i]!.position[1] - courseOff[i]!.position[1];
    assert.ok(Math.abs(got - rise) < 1e-9, `course ${i} rose ${got}, not the felt's ${rise} square to the slope`);
  }

  // Laps are real material: felt covers MORE than the roof's area, by roughly the lap fraction
  // (36-in courses lapping 2 in ⇒ about 6% more), and nowhere near double.
  const roofArea = on.members
    .filter((m) => m.role === 'roofPanel')
    .reduce((a, m) => a + (m.cutLength / 12) * (m.actual.d / 12), 0);
  const feltArea = felt.reduce((a, m) => a + (m.cutLength / 12) * (m.actual.d / 12), 0);
  assert.ok(feltArea > roofArea * 0.98, `felt ${feltArea.toFixed(1)} sf does not cover the roof's ${roofArea.toFixed(1)} sf`);
  assert.ok(feltArea < roofArea * 1.2, `felt ${feltArea.toFixed(1)} sf is far past the roof's ${roofArea.toFixed(1)} sf`);
  for (const f of felt) assert.ok(Math.abs(f.actual.w - 0.05) < 1e-9, `${f.id}: felt is a sheet, not a board`);
});

test('coverings default to none, so the compat path never sees them', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  for (const role of ['siding', 'sheathingPanel', 'roofingCourse', 'batten', 'sidingBoard', 'purlin'] as const) {
    assert.equal(model.members.filter((m) => m.role === role).length, 0, `${role} must be opt-in`);
  }
});

test('board-and-batten carries its BATTENS above the plate, on the wall’s own joint grid', () => {
  // WHAT THE SCREENSHOT SHOWED. The wall pass lays a batten over every board joint and the
  // infill pass laid none, so on a gable end every batten stopped in one straight horizontal
  // line at the cap plate: a ribbed wall under a flat triangle, with the joint reading as a seam
  // across the whole end of the building.
  //
  // A batten above the plate is only right if it continues the one below it — same joint, same
  // plane, no gap at the plate — so all three are asserted rather than just the count.
  const model = generateStructure(withCoverings({ siding: 'boardAndBatten' }));
  const battens = model.members.filter((m) => m.role === 'batten');
  const wall = battens.filter((m) => m.id.startsWith('CV-'));
  const rake = battens.filter((m) => m.id.startsWith('RK-'));
  assert.ok(wall.length > 0, 'no battens on the walls at all');
  assert.ok(rake.length > 0, 'the gable triangle has boards but no battens');

  for (const w of ['E', 'W'] as const) {
    const wb = wall.filter((m) => m.wall === w);
    const rb = rake.filter((m) => m.wall === w);
    assert.ok(rb.length > 0, `${w}: no battens above the plate on a gable end`);
    // Same joint: every rake batten sits on a wall batten's line, to the micron.
    const lines = new Set(wb.map((m) => m.position[2].toFixed(9)));
    for (const m of rb) {
      assert.ok(lines.has(m.position[2].toFixed(9)), `${m.id} is not on a board joint below it`);
    }
    // Same plane: over the boards, not floating off them or sunk into them.
    const planes = new Set([...wb, ...rb].map((m) => m.position[0].toFixed(9)));
    assert.equal(planes.size, 1, `${w}: the rake battens are not in the wall's batten plane`);
    // No gap at the plate: the rake batten starts exactly where the wall batten stops.
    const wallTop = Math.max(...wb.map((m) => m.position[1] + m.cutLength / 24));
    const rakeBase = Math.min(...rb.map((m) => m.position[1] - m.cutLength / 24));
    assert.ok(Math.abs(wallTop - rakeBase) < 1e-9, `${w}: ${(rakeBase - wallTop) * 12} in of gap at the plate`);
  }
  // The walls the rafters BEAR on have no triangle, so no battens above them either.
  for (const w of ['N', 'S'] as const) {
    assert.equal(rake.filter((m) => m.wall === w).length, 0, `${w}: a bearing wall has no rake to batten`);
  }
  // And plain board siding gets none — a batten is half of a PAIR, not a decoration.
  const plain = generateStructure(withCoverings({ siding: 'boards' }));
  assert.equal(plain.members.filter((m) => m.role === 'batten').length, 0, 'plain boards grew battens');
});

// ── The ridge cap: the outermost piece at the joint ──────────────────────────

function roofModel(kind: 'gable' | 'hip', risePer12: number) {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.dims = { lengthFt: 16, widthFt: 12 };
  spec.roof = { kind, risePer12, overhangFt: 1 };
  spec.coverings = { ...spec.coverings, roofDeck: 'plywood', roofing: 'corrugated' };
  return generateStructure(spec);
}

test('THE CAP IS THE OUTERMOST PIECE AT ITS JOINT — the ridge board cannot show through it', () => {
  // Two mistakes stacked, both pushing the cap down into the roof it is supposed to finish.
  //
  // 1. The cap was given the DECK's offset, so every course of roofing was laid on top of the one
  //    piece whose whole job is to be outermost.
  // 2. That offset is measured PERPENDICULAR to the roof, like every other covering offset here,
  //    and it was added straight to Y — which only clears the roof by lift * cos(pitch).
  //
  // Measured on a 16x12 4-in-12 hip before the fix: the cap's top sat 0.13 in BELOW the top of the
  // 2x8 ridge board, so the ridge board showed through the cap as a tan line along the peak,
  // plainly visible from overhead on a fully finished roof.
  // 12-in-12 is deliberately absent, and not because it is inconvenient: at that pitch the
  // ROOFING ITSELF stops 1.9 in short of the ridge (each course is offset perpendicular from the
  // plane and still cut at `slopeLengthFt`, so its top edge pulls back), and the 2x8 ridge board
  // out-reaches it whatever the cap does. That is a separate defect, measured and recorded in
  // docs/VISUAL_FIDELITY_SWEEP.md, not something this assertion can paper over.
  for (const kind of ['gable', 'hip'] as const) {
    for (const risePer12 of [2, 4, 6]) {
      const model = roofModel(kind, risePer12);
      const ridge = model.members.find((m) => m.role === 'ridge');
      const caps = model.members.filter((m) => m.role === 'ridgeCap');
      assert.ok(ridge, `${kind} ${risePer12}: no ridge board`);
      assert.ok(caps.length > 0, `${kind} ${risePer12}: no cap`);
      // The cap over the RIDGE is the one that runs along it.
      const cap = caps.reduce((best, c) =>
        Math.abs(c.position[2]! - ridge!.position[2]!) < Math.abs(best.position[2]! - ridge!.position[2]!) ? c : best);
      const ridgeTop = ridge!.position[1]! + ridge!.actual!.d / 12 / 2;
      const capTop = cap.position[1]! + cap.actual!.w / 12 / 2;
      assert.ok(capTop > ridgeTop,
        `${kind} at ${risePer12}-in-12: cap top ${capTop.toFixed(4)} is ${((capTop - ridgeTop) * 12).toFixed(2)} in `
        + `relative to the ridge board's ${ridgeTop.toFixed(4)} — the ridge board pierces its own cap`);
    }
  }
});

test('a cap LANDS ON the roofing, at every pitch — not under it and not floating over it', () => {
  // Two ways to get this wrong, and the fix has to miss both. Under: the cap took the deck's
  // offset, so the courses stacked on top of it. Over: lifting to the apex where the two roofing
  // PLANES would meet if extended puts the cap 3.8 in above the sheets at 12-in-12, because the
  // sheets pull back from the ridge and never reach that apex.
  //
  // The sheets are the thing the cap is nailed to, so they are what it is measured against here.
  for (const risePer12 of [2, 4, 6, 12]) {
    const model = roofModel('hip', risePer12);
    const rafter = model.members.find((m) => m.role === 'rafter')!;
    const deck = model.members.find((m) => m.role === 'roofPanel')!;
    const ridge = model.members.find((m) => m.role === 'ridge')!;
    const caps = model.members.filter((m) => m.role === 'ridgeCap');
    const cap = caps.reduce((best, c) =>
      Math.abs(c.position[2]! - ridge.position[2]!) < Math.abs(best.position[2]! - ridge.position[2]!) ? c : best);
    // The ridge board's centre lies on the rafter plane at the ridge, so it is the datum here.
    // `roofPlanes(spec, 0)` puts the plane at plate height ZERO — usable for its normal and its
    // pitch, useless as a position, and using it as one makes any assertion pass.
    const p = roofPlanes(model.spec as BuildingSpec, 0).find((x) => x.id === 'roof-S')!;
    const cos = Math.sqrt(1 - p.upSlope[1]! * p.upSlope[1]!);
    // How high the roofing surface stands over the plane at the ridge, and where the cap's
    // underside is. Both measured from the same datum.
    const deckOnly = (rafter.actual!.d / 2 + deck.actual!.w) / 12;
    const capUnder = cap.position[1]! - cap.actual!.w / 24 - ridge.position[1]!;
    const sheetTop = Math.max(...model.members.filter((m) => m.role === 'roofingCourse')
      .map((m) => m.position[1]! + (m.actual!.d / 12 / 2) * p.upSlope[1]!)) - ridge.position[1]!;
    assert.ok(capUnder > deckOnly * cos,
      `${risePer12}-in-12: the cap's underside is ${(capUnder * 12).toFixed(2)} in over the plane, `
      + `inside a deck that alone reaches ${(deckOnly * cos * 12).toFixed(2)} in — the roofing is on top of the cap`);
    // LANDS ON, so bounded both ways: half an inch of slack either side of the sheet it rests on.
    // Buried reads negative here (-0.79 in before the fix, the courses lying over the cap) and
    // floating reads positive (+3.8 in if the cap is lifted to the planes' unreachable apex).
    assert.ok(Math.abs(capUnder - sheetTop) < 0.5 / 12,
      `${risePer12}-in-12: the cap's underside sits ${((capUnder - sheetTop) * 12).toFixed(2)} in from the `
      + `highest sheet — a cap is nailed to the roofing, not buried in it or hovering over it`);
  }
});

// ── The deck that is there vs. the deck this pass places ─────────────────────

test('ROOFING CLEARS THE DECK THAT IS THERE, whoever laid it', () => {
  // A frozen gable emits its own stage-9 deck whatever the covering spec says. `deckThick` — the
  // lift that holds the roofing off the rafters — was derived from the spec's `roofDeck` instead,
  // so picking "no roof deck" on the one roof kind that always has one dropped half an inch of
  // lift and sank every course into the plywood under it. On screen the deck won the depth test
  // over the bottom third of the slope: a smooth tan panel where ribbed corrugated should be.
  //
  // Straight from the config panel — gable, roof deck "none", corrugated — and the same for roll.
  // The caller states the rule in its own comment ("its thickness still lifts the roofing off the
  // rafters"); this asserts it.
  for (const roofing of ['corrugated', 'roll'] as const) {
    for (const roofDeck of ['none', 'plywood', 'skip'] as const) {
      const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
      spec.dims = { lengthFt: 16, widthFt: 12 };
      spec.roof = { kind: 'gable', risePer12: 4, overhangFt: 1 };
      spec.coverings = { ...spec.coverings, roofDeck, roofing };
      const model = generateStructure(spec);
      const panels = model.members.filter((m) => m.role === 'roofPanel');
      const courses = model.members.filter((m) => m.role === 'roofingCourse');
      assert.ok(panels.length > 0, `${roofDeck}/${roofing}: the frozen gable always decks itself`);
      assert.ok(courses.length > 0, `${roofDeck}/${roofing}: no roofing`);
      // Both layers lie in the same plane, so comparing them along that plane's NORMAL is the
      // question: is every course outside every panel it covers? ONE SLOPE AT A TIME — projecting
      // a north-slope piece onto the south normal reads as 45 in of clearance and asserts nothing.
      const p = roofPlanes(model.spec as BuildingSpec, 0).find((x) => x.id === 'roof-S')!;
      const south = (m: (typeof panels)[number]) => m.position[2]! < spec.dims.widthFt / 2 - 0.5;
      const perp = (m: (typeof panels)[number]) =>
        [0, 1, 2].reduce((a, i) => a + m.position[i]! * p.normal[i]!, 0);
      const deckOuter = Math.max(...panels.filter(south).map((m) => perp(m) + m.actual!.w / 24));
      const courseInner = Math.min(...courses.filter(south).map((m) => perp(m) - m.actual!.w / 24));
      assert.ok(courseInner >= deckOuter - 1e-9,
        `${roofDeck}/${roofing}: the roofing's underside is ${((deckOuter - courseInner) * 12).toFixed(3)} in `
        + `INSIDE the deck — the deck stripes through the roof`);
    }
  }
});

// ── Corrugated runs UP the slope, and its sheets lap ─────────────────────────

function roofingPieces(roofing: 'corrugated' | 'roll', kind: 'gable' | 'hip' = 'gable') {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind, risePer12: 4, overhangFt: 1 };
  spec.coverings = { ...spec.coverings, roofDeck: 'plywood', roofing };
  const model = generateStructure(spec);
  return { spec, model, pieces: model.members.filter((m) => m.role === 'roofingCourse') };
}

test('A CORRUGATED SHEET RUNS ITS LENGTH UP THE SLOPE — roll runs along the eave', () => {
  // The two materials are laid at right angles and this laid both as roll. A 36-in roll unrolls
  // ALONG the eave and you work up in courses. A 26 x 96 in corrugated sheet does not: its
  // corrugations run along its 8-ft length and that length runs UP the slope, so the water runs
  // down the channels. Measured before the fix on a 48 x 20 gable, every full piece was 8.000 ft
  // along the eave by 26.00 in up the slope — the sheet on its side.
  const sheetW = ROOFING.corrugatedWidthIn.value as number;
  const sheetL = ROOFING.corrugatedLengthFt.value as number;
  const { pieces } = roofingPieces('corrugated');
  assert.ok(pieces.length > 0, 'no corrugated emitted');
  for (const m of pieces) {
    assert.ok(m.cutLength <= sheetW + 1e-6,
      `${m.id}: ${(m.cutLength / 12).toFixed(3)} ft along the eave — wider than a ${sheetW}-in sheet`);
    assert.ok(m.actual.d <= sheetL * 12 + 1e-6,
      `${m.id}: ${(m.actual.d / 12).toFixed(3)} ft up the slope — longer than an ${sheetL}-ft sheet`);
  }
  // The give-away, stated the way the bug read: a full sheet is TALLER than it is wide.
  const full = pieces.filter((m) => Math.abs(m.actual.d - sheetL * 12) < 1e-6);
  assert.ok(full.length > 0, 'no full-length sheet reaches up the slope');
  for (const m of full) assert.ok(m.actual.d > m.cutLength, `${m.id}: a sheet on its side`);

  // Roll is untouched: one piece per course, running the whole eave.
  const roll = roofingPieces('roll');
  const eave = roll.spec.dims.lengthFt as number;
  for (const m of roll.pieces) {
    assert.ok(Math.abs(m.cutLength / 12 - eave) < 1e-6,
      `${m.id}: roll should run the whole ${eave}-ft eave, got ${(m.cutLength / 12).toFixed(3)}`);
  }
});

test('CORRUGATED SHEETS LAP — a butted joint is a hole you can see the joists through', () => {
  // Consecutive sheets in a course sat at an edge-to-edge offset of exactly 0. A ray at that
  // shared edge passes BETWEEN the two pieces, which is why a raycast into one of the specks on a
  // deckless hip came back holding a ceiling joist. Every neighbour must now overlap by the side
  // lap the doctrine names — 3.25 in, one and a half corrugations.
  const lap = (ROOFING.corrugatedSideLapIn.value as number) / 12;
  for (const kind of ['gable', 'hip'] as const) {
    const { model, pieces } = roofingPieces('corrugated', kind);
    // One slope, one band: every strip in a band shares its up-slope extent exactly, so that is
    // the key. A hip's taper splits its runs into bands, which is why this cannot just look for
    // full 8-ft pieces — on a hip there are none.
    const W = (model.spec as BuildingSpec).dims.widthFt;
    const bands = new Map<string, typeof pieces>();
    for (const m of pieces.filter((x) => x.position[2]! < W / 2)) {
      // Extent AND position up the slope: two bands in different runs can share a height, and
      // keying on height alone put them in one row where they read as a 26-in "lap". The 0.2-ft
      // bucket is far coarser than the quarter-inch the alternating lift nudges z by, and far
      // finer than the feet between runs.
      const k = `${m.actual.d.toFixed(6)}|${Math.round(m.position[2]! * 5) / 5}`;
      if (!bands.has(k)) bands.set(k, []);
      bands.get(k)!.push(m);
    }
    const row = [...bands.values()].sort((a, b) => b.length - a.length)[0]!
      .slice().sort((a, b) => a.position[0]! - b.position[0]!);
    assert.ok(row.length > 2, `${kind}: expected a run of sheets across the slope, got ${row.length}`);
    for (let i = 1; i < row.length; i++) {
      const prevHi = row[i - 1]!.position[0]! + row[i - 1]!.cutLength / 24;
      const thisLo = row[i]!.position[0]! - row[i]!.cutLength / 24;
      assert.ok(thisLo < prevHi - 1e-9,
        `${kind}: sheets ${i - 1}/${i} sit ${((thisLo - prevHi) * 12).toFixed(3)} in apart — 0 is a butt, and a butt is a hole`);
      assert.ok(Math.abs(prevHi - thisLo - lap) < 1e-6,
        `${kind}: lapped ${((prevHi - thisLo) * 12).toFixed(3)} in, doctrine says ${(lap * 12).toFixed(2)}`);
    }
    // Lapped plates at one height z-fight, so the strips alternate by exactly one thickness.
    const lifts = [...new Set(row.map((m) => Math.round(m.position[1]! * 1e6)))];
    assert.equal(lifts.length, 2, `${kind}: lapping sheets need two heights, found ${lifts.length}`);
  }
});

test('A STRIP CLEAR OF THE TAPER IS ONE SHEET — banding follows the strip, not the plane', () => {
  // The band count was the PLANE's taper: how much the whole roof narrows over a run. Right for a
  // roll course, which spans the entire eave and really must step down the rake. Nonsense for a
  // 26-in strip. On a 16 x 12 hip the plane narrows 14 ft over its slope, so EVERY strip took the
  // maximum 8 bands and the roof came out as 176 pieces of 26 by 11 in — including the strips
  // sitting squarely in the middle of a slope with nothing to clip them. The gable, whose taper is
  // zero, gave one 7.4-ft sheet per strip: the right answer, and the tell.
  //
  // Eight butted seams up every strip is also eight more places for a ray to pass between two
  // coplanar rectangles, which is what the specks scattered across a hip were.
  // A slope longer than one sheet legitimately takes more than one piece up it — that is the END
  // LAP, not banding. The property is that BANDING adds nothing on top of that: on a gable, the
  // number of pieces stacked at one place along the eave is exactly the number of runs.
  const runsUp = (kind: 'gable' | 'hip') => {
    const { model } = roofingPieces('corrugated', kind);
    const slopeLen = roofPlanes(model.spec as BuildingSpec, 0)[0]!.slopeLengthFt;
    const sheet = ROOFING.corrugatedLengthFt.value as number;
    const exposure = sheet - (ROOFING.corrugatedEndLapIn.value as number) / 12;
    return Math.max(1, Math.ceil(slopeLen / exposure));
  };
  const stackedAtOneX = (pieces: { position: readonly number[] }[], southOf: number) => {
    const byX = new Map<string, number>();
    for (const m of pieces.filter((x) => x.position[2]! < southOf)) {
      const k = m.position[0]!.toFixed(3);
      byX.set(k, (byX.get(k) ?? 0) + 1);
    }
    return Math.max(...byX.values());
  };

  const gable = roofingPieces('corrugated', 'gable');
  const gW = (gable.model.spec as BuildingSpec).dims.widthFt;
  assert.equal(stackedAtOneX(gable.pieces, gW / 2), runsUp('gable'),
    'a rectangle tapers by nothing, so every strip is one piece per run — banding must add none');

  // A hip DOES have strips that must step down its rakes, but it must also still have WHOLE
  // ones — the strips sitting squarely in the middle of a slope with nothing to clip them. Before
  // the fix not one piece on a hip reached a full sheet: every strip was cut into the maximum 8
  // bands, so the tallest piece anywhere was an eighth of a run.
  const hip = roofingPieces('corrugated', 'hip').pieces;
  const sheetLenFt = ROOFING.corrugatedLengthFt.value as number;
  const whole = hip.filter((m) => Math.abs(m.actual.d / 12 - sheetLenFt) < 1e-9);
  assert.ok(whole.length > 0,
    `a hip must still lay whole ${sheetLenFt}-ft sheets where nothing clips them; the tallest piece `
    + `is ${(Math.max(...hip.map((m) => m.actual.d / 12))).toFixed(3)} ft`);
});

test('no piece of corrugated is narrower than one corrugation', () => {
  // Near the apex of a triangular face a strip clips to almost nothing. The plausibility check
  // found quarter-inch "sheets" on the tower's cab — you cannot cut and fasten a piece of
  // corrugated narrower than a single rib.
  const corrugation = (ROOFING.corrugatedSideLapIn.value as number)
    / (ROOFING.corrugatedSideLapCorrugations.value as number);
  for (const kind of ['gable', 'hip'] as const) {
    for (const m of roofingPieces('corrugated', kind).pieces) {
      assert.ok(m.cutLength >= corrugation - 1e-9,
        `${kind}: ${m.id} is ${m.cutLength.toFixed(3)} in wide, less than one ${corrugation.toFixed(3)}-in corrugation`);
    }
  }
});
