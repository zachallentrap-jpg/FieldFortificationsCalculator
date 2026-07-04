// D28 — the pure sandbag-wall tiling grid behind the 3D props. Invariants: cells are always
// finite and positive (degenerate walls included), cell proportions track the doctrine bag's
// laid proportions once the wall is at least one bag in that axis, the grid fills the wall
// exactly, and the layout is a function of wall + bag dimensions ONLY — the async GLB load
// (present or not) can never change the model's envelope because fallback and prop tile the
// same cells.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bagWallLayout, bagWallBond, doctrineBagDims } from '../src/render3d/propLayout';
import type { BagCell } from '../src/render3d/propLayout';

const bag = doctrineBagDims();

test('cells stay near the doctrine bag proportions on real wall sizes', () => {
  // Representative walls: parapet front (6 ft long, 0.5 ft high, 3 ft thick), cover slab,
  // revetment face. Cell size may deviate from the bag by at most 50% in any axis (rounding
  // to a whole count of bags), never by the unbounded stretch of the pre-D28 code.
  const walls: [number, number, number][] = [
    [6, 0.5, 3],
    [6.8, 1.17, 5.3],
    [4, 3, 0.75],
    [12, 2, 3],
  ];
  for (const [w, h, d] of walls) {
    const g = bagWallLayout(w, h, d);
    if (w >= bag.L) assert.ok(Math.abs(g.cellW - bag.L) / bag.L <= 0.5, `cellW ${g.cellW} tracks bag L for ${w}x${h}x${d}`);
    if (h >= bag.H) assert.ok(Math.abs(g.cellH - bag.H) / bag.H <= 0.5, `cellH ${g.cellH} tracks bag H for ${w}x${h}x${d}`);
    if (d >= bag.W) assert.ok(Math.abs(g.cellD - bag.W) / bag.W <= 0.5, `cellD ${g.cellD} tracks bag W for ${w}x${h}x${d}`);
  }
});

test('a thick wall tiles multiple layers deep — the pre-D28 stretch bug', () => {
  // 3-ft-thick parapet vs a 0.75-ft bag width: must be several bags deep, not one.
  const g = bagWallLayout(6, 0.5, 3);
  assert.ok(g.layers >= 3, 'parapet depth tiles into layers, got ' + g.layers);
});

test('grid exactly fills the wall (no gap, no overhang)', () => {
  const g = bagWallLayout(7.3, 1.9, 2.4);
  assert.ok(Math.abs(g.cols * g.cellW - 7.3) < 1e-9);
  assert.ok(Math.abs(g.rows * g.cellH - 1.9) < 1e-9);
  assert.ok(Math.abs(g.layers * g.cellD - 2.4) < 1e-9);
});

test('degenerate and hostile inputs never produce a broken grid', () => {
  for (const [w, h, d] of [[0, 0, 0], [-1, 2, 3], [NaN, 1, 1], [Infinity, 1, 1], [1e-9, 1e-9, 1e-9]] as [number, number, number][]) {
    const g = bagWallLayout(w, h, d);
    for (const v of [g.cols, g.rows, g.layers, g.cellW, g.cellH, g.cellD]) {
      assert.ok(Number.isFinite(v) && v > 0, `finite positive for ${w}x${h}x${d}`);
    }
  }
  // Hostile bag dims too (a corrupt doctrine import must not break the renderer).
  const g = bagWallLayout(6, 0.5, 3, { L: 0, H: NaN, W: -2 });
  for (const v of [g.cols, g.rows, g.layers, g.cellW, g.cellH, g.cellD]) assert.ok(Number.isFinite(v) && v > 0);
});

test('deterministic: identical inputs, identical layout', () => {
  assert.deepEqual(bagWallLayout(6, 0.5, 3), bagWallLayout(6, 0.5, 3));
});

// ── masonry bond (bagWallBond) ────────────────────────────────────────────────────────────────

function courseOf(c: BagCell): number {
  return Math.round(c.dy / Math.max(0.01, c.h));
}

test('bond: every cell stays inside the wall envelope', () => {
  for (const [w, h, d] of [[6, 0.5, 3], [4, 1.0, 0.75], [12, 2, 3], [2.2, 0.66, 1.05]] as [number, number, number][]) {
    for (const c of bagWallBond(w, h, d)) {
      assert.ok(c.dx - c.w / 2 >= -w / 2 - 1e-9 && c.dx + c.w / 2 <= w / 2 + 1e-9, `run extent for ${w}x${h}x${d}`);
      assert.ok(c.dz - c.d / 2 >= -d / 2 - 1e-9 && c.dz + c.d / 2 <= d / 2 + 1e-9, `thickness extent for ${w}x${h}x${d}`);
      assert.ok(c.dy >= -1e-9 && c.dy + c.h <= h + 1e-9, `height extent for ${w}x${h}x${d}`);
      for (const v of [c.dx, c.dy, c.dz, c.w, c.h, c.d]) assert.ok(Number.isFinite(v));
      assert.ok(c.w > 0 && c.h > 0 && c.d > 0);
    }
  }
});

test('bond: stretcher courses break joints — no vertical joint continues into the next course', () => {
  // A thin (all-stretcher) wall: consecutive courses must not share interior joint positions.
  const cells = bagWallBond(6, 1.0, 0.75);
  const jointsByCourse = new Map<number, Set<string>>();
  for (const c of cells) {
    const r = courseOf(c);
    let set = jointsByCourse.get(r);
    if (!set) jointsByCourse.set(r, (set = new Set()));
    for (const edge of [c.dx - c.w / 2, c.dx + c.w / 2]) {
      if (Math.abs(Math.abs(edge) - 3) > 1e-6) set.add(edge.toFixed(3)); // interior joints only
    }
  }
  const courses = [...jointsByCourse.keys()].sort((a, b) => a - b);
  assert.ok(courses.length >= 2, 'wall has multiple courses');
  for (let i = 1; i < courses.length; i++) {
    const prev = jointsByCourse.get(courses[i - 1]!)!;
    const cur = jointsByCourse.get(courses[i]!)!;
    for (const j of cur) assert.ok(!prev.has(j), `joint ${j} continues from course ${courses[i - 1]} into ${courses[i]}`);
  }
});

test('bond: thick walls alternate header courses; thin walls never turn a bag', () => {
  const parapet = bagWallBond(6, 1.0, 3); // 3 ft thick — headers fit
  assert.ok(parapet.some((c) => c.header), 'thick wall lays header courses');
  for (const c of parapet) {
    assert.equal(c.header, courseOf(c) % 2 === 1, 'headers exactly on odd courses');
  }
  const facing = bagWallBond(6, 1.0, 0.75); // one bag thick — a turned bag would overhang
  assert.ok(facing.every((c) => !c.header), 'thin wall stays all-stretcher');
});

test('bond: staggered courses fill the run exactly with half-bags at the ends', () => {
  const cells = bagWallBond(6, 1.0, 0.75).filter((c) => courseOf(c) === 1);
  const total = cells.reduce((s, c) => s + c.w, 0);
  const perLayer = new Map<string, number>();
  for (const c of cells) perLayer.set(c.dz.toFixed(3), (perLayer.get(c.dz.toFixed(3)) ?? 0) + c.w);
  for (const [, span] of perLayer) assert.ok(Math.abs(span - 6) < 1e-9, 'staggered course spans the full run');
  assert.ok(total > 0);
});

test('bond: deterministic', () => {
  assert.deepEqual(bagWallBond(6, 0.5, 3), bagWallBond(6, 0.5, 3));
});
