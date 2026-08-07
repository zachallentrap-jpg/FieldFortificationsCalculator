// TIMBER-1 — teaching-option tests: foundation types (piers / continuous wall / basement),
// the framed stair opening + stair math, the attic scuttle, bridging styles, and the
// determinism/no-NaN matrix across every option combination (design doc §9 applied to the
// FM 5-426 lesson set).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFrame, stairPlan, type BuildingInput } from '../src/timber/frame';
import { bomSummary } from '../src/timber/bom';

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

test('piers foundation: every post stands on a concrete pad footer', () => {
  const { members, levels } = generateFrame({ ...golden, foundation: 'piers' });
  const posts = members.filter((m) => m.role === 'post');
  const pads = members.filter((m) => m.role === 'footing');
  assert.equal(pads.length, posts.length, 'one pad per post');
  for (const p of pads) {
    assert.equal(p.stage, 1);
    assert.ok(p.nominal.includes('conc'));
    const top = p.position[1] + p.actual.d / 12 / 2;
    assert.ok(Math.abs(top - levels.gradeY) < 1e-9, `${p.id}: pad top at grade`);
  }
});

test('continuous-wall foundation: four walls on strip footings, sills all around, girder on interior posts', () => {
  const { members } = generateFrame({ ...golden, foundation: 'wall' });
  const walls = members.filter((m) => m.role === 'foundationWall');
  assert.equal(walls.length, 4);
  const strips = members.filter((m) => m.role === 'footing' && m.nominal.includes('footing'));
  assert.equal(strips.length, 4, 'one strip footing per wall');
  const sills = members.filter((m) => m.role === 'sill' && m.stage === 2);
  assert.equal(sills.length, 4, 'sills on all four sides');
  for (const w of walls) {
    assert.equal(w.stage, 1);
    assert.ok(w.nailing.includes('anchor'), `${w.id}: anchor-bolt note`);
  }
  // No perimeter posts against a continuous wall; girder posts remain (interior only).
  const posts = members.filter((m) => m.role === 'post');
  assert.ok(posts.length > 0);
  for (const p of posts) {
    assert.ok(Math.abs(p.position[2] - golden.widthFt / 2) < 1e-9, `${p.id}: girder line only`);
  }
});

test('basement: walls reach the slab, columns bear on it, grade sits above the slab', () => {
  const model = generateFrame({ ...golden, foundation: 'basement' });
  const { members, levels } = model;
  assert.ok(levels.slabTop !== undefined && levels.slabTop < levels.gradeY, 'slab below grade');
  const slab = members.find((m) => m.role === 'slab')!;
  assert.ok(slab, 'slab member exists');
  const slabTopY = slab.position[1] + slab.actual.d / 12 / 2;
  assert.ok(Math.abs(slabTopY - levels.slabTop!) < 1e-9, 'slab top matches the level datum');
  for (const p of members.filter((m) => m.role === 'post')) {
    const base = p.position[1] - p.cutLength / 12 / 2;
    assert.ok(Math.abs(base - levels.slabTop!) < 1e-9, `${p.id}: column bears on the slab`);
  }
  const wallH = members.find((m) => m.role === 'foundationWall')!.actual.d / 12;
  assert.ok(wallH > 7, 'basement walls are full height');
});

test('basement stair: doctrinal riser math, opening framed with double trimmers/headers and tails', () => {
  const input: BuildingInput = { ...golden, foundation: 'basement' };
  const plan = stairPlan({
    lengthFt: input.lengthFt,
    widthFt: input.widthFt,
    joistSpacingIn: input.joistSpacingIn,
    crawlFt: input.crawlFt,
    foundation: 'basement',
  })!;
  assert.ok(plan, 'stair plan exists for the golden basement');
  // Riser height lands in the FM range (~7-8") and treads = risers - 1.
  assert.ok(plan.unitRiseIn > 6.5 && plan.unitRiseIn < 8.5, `unit rise ${plan.unitRiseIn}`);
  assert.equal(plan.treads, plan.risers - 1);
  assert.ok(Math.abs(plan.risers * plan.unitRiseIn - plan.totalRiseFt * 12) < 1e-6, 'risers × unit rise = total rise');

  const { members } = generateFrame(input);
  const headers = members.filter((m) => m.role === 'headerJoist' && m.stage === 3);
  const trimmers = members.filter((m) => m.role === 'trimmerJoist' && m.stage === 3);
  const tails = members.filter((m) => m.role === 'tailJoist' && m.stage === 3);
  assert.equal(headers.length, 4, 'double header at each end of the opening');
  assert.equal(trimmers.length, 4, 'double trimmer at each side of the opening');
  assert.ok(tails.length >= 4, `tail joists both sides: got ${tails.length}`);
  // No full-length joist crosses the opening.
  for (const j of members.filter((m) => m.role === 'joist' && m.stage === 3)) {
    assert.ok(j.position[0] < plan.x0 - 0.01 || j.position[0] > plan.x1 + 0.01, `${j.id} crosses the stairwell`);
  }
  // Tails stop clear of the opening (south tails end at the girder-side header, north tails
  // start past the far header).
  for (const tj of tails) {
    const z0 = tj.position[2] - tj.cutLength / 12 / 2;
    const z1 = tj.position[2] + tj.cutLength / 12 / 2;
    assert.ok(z1 <= plan.z1 + 1e-6 || z0 >= plan.z2 - 1e-6, `${tj.id} spans into the opening`);
  }

  // Stairs: stringers + treads descend monotonically from floor to slab.
  const stringers = members.filter((m) => m.role === 'stringer');
  const treads = members.filter((m) => m.role === 'tread');
  assert.equal(stringers.length, 3);
  assert.equal(treads.length, plan.treads);
  // A STRINGER RUNS FLOOR TO FLOOR. This used to assert the length was
  // `hypot(runFt, totalRiseFt)` — a formula, and the wrong one: a flight has one more riser
  // than treads, so that mixes the opening's run with the full rise and describes a line at a
  // different pitch than the board is rotated to. It pinned the bug rather than the claim, and
  // the stringers ran nine inches through the basement slab into the earth underneath.
  //
  // The claim, stated where it can be seen: the board's LOWEST corner sits on the slab and its
  // HIGHEST corner reaches the floor above. That is true of any correct stringer at any pitch.
  const slabTop = -plan.totalRiseFt;
  for (const s of stringers) {
    const half = { x: s.cutLength / 12 / 2, y: s.actual.d / 12 / 2 };
    const [, , rz] = s.rotation;
    // rz is the only rotation on a stringer, so the corner extremes in y are exact.
    const reach = Math.abs(half.x * Math.sin(rz)) + Math.abs(half.y * Math.cos(rz));
    const lowest = s.position[1] - reach;
    const highest = s.position[1] + reach;
    assert.ok(Math.abs(lowest - slabTop) < 1e-6, `${s.id}: bottom at ${lowest.toFixed(4)}, slab at ${slabTop.toFixed(4)}`);
    assert.ok(Math.abs(highest - 0) < 1e-6, `${s.id}: top at ${highest.toFixed(4)}, floor at 0`);
  }
  const ys = treads.map((m) => m.position[1]).sort((a, b) => b - a);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i - 1]! - ys[i]! > 0.4 && ys[i - 1]! - ys[i]! < 0.8, `tread step ${i} = ${ys[i - 1]! - ys[i]!}`);
  }
  // Subfloor never decks over the opening.
  for (const p of members.filter((m) => m.role === 'subfloor')) {
    const x0 = p.position[0] - p.cutLength / 12 / 2;
    const x1 = p.position[0] + p.cutLength / 12 / 2;
    const zc = p.position[2];
    const halfW = p.actual.d / 12 / 2;
    const overlapX = x1 > plan.x0 + 0.01 && x0 < plan.x1 - 0.01;
    const overlapZ = zc + halfW > plan.z1 + 0.01 && zc - halfW < plan.z2 - 0.01;
    assert.ok(!(overlapX && overlapZ), `${p.id} decks over the stairwell`);
  }
});

test('attic scuttle: framed opening in the ceiling joists (stage 7)', () => {
  const { members } = generateFrame({ ...golden, atticAccess: true });
  const headers = members.filter((m) => m.role === 'headerJoist' && m.stage === 7);
  const trimmers = members.filter((m) => m.role === 'trimmerJoist' && m.stage === 7);
  const tails = members.filter((m) => m.role === 'tailJoist' && m.stage === 7);
  assert.equal(headers.length, 4);
  assert.equal(trimmers.length, 4);
  // TAILS COME IN PAIRS — one each side of the opening for every joist line that crosses it.
  // `>= 2` passed a scuttle that had lost half of them, which is exactly what it had done; the
  // layout claim lives in `timber2-attic-scuttle`, and this is the shape of the answer.
  assert.ok(tails.length >= 2 && tails.length % 2 === 0, `scuttle tails: got ${tails.length}`);
  // Off by default.
  const plain = generateFrame(golden);
  assert.equal(plain.members.filter((m) => m.role === 'headerJoist' && m.stage === 7).length, 0);
});

test('bridging: cross pairs by default once a half-span reaches ~8 ft; solid blocking as the option', () => {
  const cross = generateFrame({ ...golden, bridging: 'cross' }).members.filter((m) => m.role === 'bridging');
  assert.ok(cross.length > 0, 'the 16-ft demo has 8-ft half-spans → bridging rows');
  assert.equal(cross.length % 2, 0, 'cross bridging comes in pairs');
  for (const b of cross) {
    assert.equal(b.nominal, '1x3');
    assert.ok(Math.abs(b.rotation[2]) > 0.3, `${b.id}: diagonal`);
  }
  const solid = generateFrame({ ...golden, bridging: 'solid' }).members.filter((m) => m.role === 'bridging');
  assert.ok(solid.length > 0);
  for (const b of solid) {
    assert.equal(b.nominal, '2x8', `${b.id}: solid bridging is full-depth blocking`);
    assert.equal(b.rotation[2], 0);
  }
  // Narrow buildings (half-span < 7.5 ft) need no bridging.
  const narrow = generateFrame({ ...golden, widthFt: 12, openings: [] }).members.filter((m) => m.role === 'bridging');
  assert.equal(narrow.length, 0);
});

test('BOM: concrete stages carry man-hours and the stage partition still covers everything', () => {
  for (const foundation of ['piers', 'wall', 'basement'] as const) {
    const { members } = generateFrame({ ...golden, foundation });
    const bom = bomSummary(members);
    assert.equal(bom.totalMembers, members.length, `${foundation}: member parity`);
    const stage1 = bom.stages.find((s) => s.stage === 1)!;
    assert.ok(stage1.manHours > 0, `${foundation}: stage 1 has labor`);
  }
});

test('determinism and no-NaN across the full option matrix (small sizes skip the stair gracefully)', () => {
  for (const foundation of ['piers', 'wall', 'basement'] as const) {
    for (const bridging of ['cross', 'solid'] as const) {
      for (const letInBracing of [false, true]) {
        for (const atticAccess of [false, true]) {
          for (const [lengthFt, widthFt] of [[20, 16], [12, 8], [40, 24]] as const) {
            const input: BuildingInput = { ...golden, lengthFt, widthFt, foundation, bridging, letInBracing, atticAccess, openings: [] };
            const a = generateFrame(input);
            assert.deepEqual(a, generateFrame(input), 'deterministic');
            const ids = new Set<string>();
            for (const m of a.members) {
              for (const v of [...m.position, ...m.rotation, m.cutLength]) {
                assert.ok(Number.isFinite(v), `${foundation}/${bridging}/${lengthFt}x${widthFt}: ${m.id} non-finite`);
              }
              assert.ok(m.cutLength > 0, `${m.id}: cutLength`);
              assert.ok(!ids.has(m.id), `${m.id}: duplicate id`);
              ids.add(m.id);
            }
          }
        }
      }
    }
  }
});
