// TIMBER-1 — whole-FrameModel tests (design doc §9): determinism, stage integrity across all
// generators, no-NaN over input fuzz, BOM partition (stage BOMs sum exactly to the total),
// 2D/3D count parity, geometric sanity for floor and roof, and the regen-time budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFrame, type BuildingInput } from '../src/timber/frame';
import { bomSummary, cutList, boardFeet } from '../src/timber/bom';
import { wallElevation, layoutStrip } from '../src/timber/elevation';
import { STAGES } from '../src/timber/types';

const golden: BuildingInput = {
  lengthFt: 20,
  widthFt: 16,
  wallHeightFt: 8,
  studSpacingIn: 16,
  joistSpacingIn: 16,
  rafterSpacingIn: 16,
  risePer12: 4,
  overhangFt: 1,
  crawlFt: 1.5,
  openings: [
    { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    { wall: 'S', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
    { wall: 'N', offsetFt: 8, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
  ],
};

test('frame is deterministic and every member is finite, staged, and unique', () => {
  const a = generateFrame(golden);
  assert.deepEqual(a, generateFrame(golden));
  const stageIds = new Set<number>(STAGES.map((s) => s.id));
  const ids = new Set<string>();
  for (const m of a.members) {
    for (const v of [...m.position, ...m.rotation, m.cutLength]) {
      assert.ok(Number.isFinite(v), `${m.id}: non-finite`);
    }
    assert.ok(m.cutLength > 0, `${m.id}: cutLength`);
    assert.ok(stageIds.has(m.stage), `${m.id}: stage`);
    assert.ok(!ids.has(m.id), `${m.id}: duplicate id`);
    ids.add(m.id);
  }
});

test('no-NaN across input fuzz', () => {
  for (const lengthFt of [8, 13.5, 20, 40]) {
    for (const widthFt of [8, 12.25, 16, 24]) {
      for (const risePer12 of [2, 4, 6, 12]) {
        const model = generateFrame({ ...golden, lengthFt, widthFt, risePer12, openings: [] });
        for (const m of model.members) {
          for (const v of [...m.position, ...m.rotation, m.cutLength]) {
            assert.ok(Number.isFinite(v), `${lengthFt}x${widthFt} rise ${risePer12}: ${m.id}`);
          }
        }
      }
    }
  }
});

test('floor structure stacks: posts reach grade, joists bear on sill/girder tops', () => {
  const { members, levels } = generateFrame(golden);
  const posts = members.filter((m) => m.role === 'post');
  assert.ok(posts.length >= 6, 'needs perimeter + girder posts');
  for (const p of posts) {
    const base = p.position[1] - p.cutLength / 12 / 2;
    assert.ok(Math.abs(base - levels.gradeY) < 1e-9, `${p.id} base ${base} != grade ${levels.gradeY}`);
  }
  for (const j of members.filter((m) => m.role === 'joist' && m.stage === 3)) {
    const bottom = j.position[1] - j.actual.d / 12 / 2;
    assert.ok(Math.abs(bottom - levels.sillTop) < 1e-9, `${j.id} must bear at sill top`);
  }
});

test('roof geometry: rafter length follows the framing-square method, ridge is centered', () => {
  const { members, input } = generateFrame(golden);
  const run = input.widthFt / 2 + input.overhangFt;
  const expected = run * (Math.sqrt(144 + input.risePer12 ** 2) / 12) * 12; // inches
  for (const r of members.filter((m) => m.role === 'rafter')) {
    assert.ok(Math.abs(r.cutLength - expected) < 0.01, `${r.id}: ${r.cutLength} vs ${expected}`);
    assert.ok(r.angles?.plumbCut !== undefined && r.angles.seatCut !== undefined, `${r.id}: cut angles`);
  }
  const ridge = members.find((m) => m.role === 'ridge')!;
  assert.equal(ridge.position[2], input.widthFt / 2);
  assert.ok(ridge.position[1] > input.wallHeightFt, 'ridge above the walls');
  // Rafters come in pairs per grid line.
  const rafters = members.filter((m) => m.role === 'rafter');
  assert.equal(rafters.length % 2, 0);
});

test('roof sheathing courses tile the slope with no overlap or gap, for any pitch', () => {
  // Each course's along-slope width (actual.d) must sum to exactly the slope length, per side —
  // an overlap (the old bug: a fixed-width last course whose CENTER was clamped inward instead
  // of shrinking) would sum to MORE than the slope length; a gap would sum to less.
  for (const risePer12 of [2, 3, 4, 5, 6, 7, 12]) {
    const { members, input } = generateFrame({ ...golden, risePer12, openings: [] });
    const run = input.widthFt / 2 + (input.overhangFt ?? 1);
    const slopeLenIn = run * (Math.sqrt(144 + risePer12 ** 2) / 12) * 12;
    const panels = members.filter((m) => m.role === 'roofPanel');
    // Courses on the two slope sides (±Z) share the same |z - W/2| distance from the ridge but
    // differ in sign — group by (y, |z - ridgeZ|) so front and rear courses are counted
    // separately, then each side's course widths must sum to slopeLenIn on their own.
    const ridgeZ = input.widthFt / 2;
    const perSide = new Map<0 | 1, Map<string, number>>([[0, new Map()], [1, new Map()]]);
    for (const p of panels) {
      const side = p.position[2] < ridgeZ ? 0 : 1;
      const key = p.position[1].toFixed(6) + ',' + p.position[2].toFixed(6);
      perSide.get(side)!.set(key, p.actual.d);
    }
    for (const side of [0, 1] as const) {
      const total = [...perSide.get(side)!.values()].reduce((a, d) => a + d, 0);
      assert.ok(Math.abs(total - slopeLenIn) < 0.02, `rise ${risePer12} side ${side}: course widths sum to ${total}, expected ${slopeLenIn}`);
    }
  }
});

test('subfloor panels tile both axes with no overlap or gap, including staggered rows', () => {
  // lengthFt=13.5 (not a multiple of 8) and widthFt=14 (not a multiple of 4) are exactly the
  // dimensions the audit found overlapping under the old center-computed-from-both-edges
  // algorithm — assert coverage sums to the true row/run length instead of re-deriving 3D
  // overlap directly.
  for (const [lengthFt, widthFt] of [[20, 16], [13.5, 14], [13.5, 8], [40, 24]] as const) {
    const { members } = generateFrame({ ...golden, lengthFt, widthFt, openings: [] });
    const panels = members.filter((m) => m.role === 'subfloor');
    // Z-direction: one row = one distinct Z value; its width (actual.d) summed across rows
    // must equal the building width exactly.
    const rowWidths = new Map<number, number>();
    for (const p of panels) rowWidths.set(p.position[2], p.actual.d);
    const zTotal = [...rowWidths.values()].reduce((a, d) => a + d, 0);
    assert.ok(Math.abs(zTotal - widthFt * 12) < 0.02, `${lengthFt}x${widthFt}: row widths sum to ${zTotal}, expected ${widthFt * 12}`);
    // X-direction: within ANY single row, panel cutLengths (already trimmed to fit) must sum
    // to exactly the building length.
    for (const z of new Set(panels.map((p) => p.position[2]))) {
      const rowPanels = panels.filter((p) => p.position[2] === z);
      const xTotal = rowPanels.reduce((a, p) => a + p.cutLength, 0);
      assert.ok(Math.abs(xTotal - lengthFt * 12) < 0.02, `${lengthFt}x${widthFt} row z=${z}: panel widths sum to ${xTotal}, expected ${lengthFt * 12}`);
    }
  }
});

test('collar tie stays finite at a flat (risePer12=0) roof', () => {
  const { members } = generateFrame({ ...golden, risePer12: 0, openings: [] });
  const ties = members.filter((m) => m.role === 'collarTie');
  assert.ok(ties.length > 0, 'flat roof still emits collar ties');
  for (const t of ties) assert.ok(Number.isFinite(t.cutLength) && t.cutLength > 0, `${t.id}: cutLength ${t.cutLength}`);
});

test('a very low window sill never emits a negative/zero-length cripple below it', () => {
  for (const sillHeightFt of [0, 0.02, 0.1, 0.125, 0.5, 3]) {
    const { members } = generateFrame({
      ...golden,
      openings: [{ wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt }],
    });
    for (const m of members) assert.ok(m.cutLength > 0, `sillHeightFt=${sillHeightFt}: ${m.id} cutLength ${m.cutLength}`);
  }
});

test('a slab-on-grade building (crawlFt ≤ 0) never emits a negative/zero-length post', () => {
  for (const crawlFt of [0, -0.5, -2]) {
    const { members } = generateFrame({ ...golden, crawlFt, openings: [] });
    for (const m of members) assert.ok(m.cutLength > 0, `crawlFt=${crawlFt}: ${m.id} cutLength ${m.cutLength}`);
  }
});

test('stage BOMs partition the total exactly (design doc §9 stage integrity)', () => {
  const { members } = generateFrame(golden);
  const bom = bomSummary(members);
  assert.equal(bom.totalMembers, members.length);
  const totalBf = members.reduce((a, m) => a + boardFeet(m), 0);
  assert.ok(Math.abs(bom.totalBoardFeet - totalBf) < 1e-6);
  const stageSum = bom.stages.reduce((a, s) => a + s.boardFeet, 0);
  assert.ok(Math.abs(stageSum - totalBf) < 1e-6, 'stage BF must sum to total BF');
  assert.ok(bom.totalManHours > 0);
});

test('cut list groups identical members and keeps the id linkage', () => {
  const { members } = generateFrame(golden);
  const lines = cutList(members);
  const studs = lines.find((l) => l.roles.includes('stud') && l.nominal === '2x4');
  assert.ok(studs && studs.count > 10, 'common studs should group into one line');
  assert.equal(studs!.memberIds.length, studs!.count);
  const totalCount = lines.reduce((a, l) => a + l.count, 0);
  assert.equal(totalCount, members.length);
});

test('2D/3D parity: every wall member appears in its elevation exactly once', () => {
  const { members, input } = generateFrame(golden);
  for (const wall of ['N', 'S', 'E', 'W'] as const) {
    const elev = wallElevation(members, wall, input.lengthFt, input.widthFt, input.wallHeightFt);
    const wallMembers = members.filter((m) => m.wall === wall);
    assert.equal(elev.rects.length, wallMembers.length, `${wall}: rect/member parity`);
    for (const r of elev.rects) {
      assert.ok(r.u1 > r.u0 && r.v1 > r.v0, `${r.memberId}: degenerate rect`);
      assert.ok(r.u0 > -0.5 && r.u1 < elev.runFt + 0.5, `${r.memberId}: outside wall run`);
    }
  }
});

test('layout strip marks match engine stud positions (design doc §11.7)', () => {
  const { members, input } = generateFrame(golden);
  const marks = layoutStrip(members, 'S', input.lengthFt, input.widthFt);
  assert.ok(marks.length > 10);
  // Marks are sorted, on the wall, and every kind maps to a real member id.
  const ids = new Set(members.map((m) => m.id));
  for (let i = 0; i < marks.length; i++) {
    const mk = marks[i]!;
    assert.ok(ids.has(mk.memberId), `${mk.kind}@${mk.atIn}: unknown member`);
    assert.ok(mk.atIn >= 0 && mk.atIn <= input.lengthFt * 12);
    if (i > 0) assert.ok(mk.atIn >= marks[i - 1]!.atIn, 'sorted');
  }
  // The golden S wall has two openings → 2 kings + 2 jacks each.
  assert.equal(marks.filter((m) => m.kind === 'K').length, 4);
  assert.equal(marks.filter((m) => m.kind === 'J').length, 4);
});

test('performance budget: full model regen well under 50 ms', () => {
  generateFrame(golden); // warm
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) generateFrame(golden);
  const per = (performance.now() - t0) / 10;
  assert.ok(per < 50, `regen ${per.toFixed(1)} ms`);
});
