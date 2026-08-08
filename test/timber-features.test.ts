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
    // This read `> 0.3` rad, which was calibrated against a pitch that no longer exists: the
    // boards were drawn with their CENTRELINE spanning the whole joist depth, which stood the
    // board's own corners 0.78 in outside the joists at both ends. Fitting the BOARD between them
    // makes the piece shallower — 24.24° became 15.2° — so the threshold started failing a
    // correct model. What the line means is "diagonal, not flat blocking", which is the
    // difference between this branch and the `solid` one below, so it says that instead of
    // pinning a number. The pitch itself is asserted in `timber2-bridging.test.ts`.
    assert.notEqual(b.rotation[2], 0, `${b.id}: diagonal, not flat blocking`);
  }
  // And a pair opposes: two boards crossing in one bay, equal and opposite.
  for (let i = 0; i < cross.length; i += 2) {
    assert.ok(Math.abs(cross[i]!.rotation[2] + cross[i + 1]!.rotation[2]) < 1e-12,
      `${cross[i]!.id}/${cross[i + 1]!.id}: a crossed pair pitches both ways`);
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

// Bridging is derived from the runs that were ACTUALLY framed, not from the layout grid.
// The stair opening edits that layout — it suppresses grid positions, adds doubled trimmers
// just outside each face, and cuts joists down to tails that stop at a header — and the
// bridging has to follow without a matching edit in the bridging code. Grid-derived bridging
// could not see the trimmers at all and drove a single 2'-6" block straight through both
// trimmer plies at each end of the stairwell, out into the tail-joist field beyond.
test('bridging derives from the framed bays: nothing passes through a trimmer or over the stairwell', () => {
  for (const lengthFt of [14, 20, 28, 40]) {
    for (const widthFt of [15, 16, 20, 24, 32]) {
      for (const foundation of ['piers', 'wall', 'basement'] as const) {
        for (const bridging of ['cross', 'solid'] as const) {
          for (const joistSpacingIn of [16, 24] as const) {
            const input: BuildingInput = { ...golden, lengthFt, widthFt, foundation, bridging, joistSpacingIn, openings: [] };
            const tag = `${lengthFt}x${widthFt}/${foundation}/${bridging}/${joistSpacingIn}"`;
            const { members } = generateFrame(input);
            // The stairwell to check against is the one this model actually FRAMED, read back
            // off its own doubled trimmers (x) and headers (z). Asking `stairPlan` for it from
            // the raw input describes an opening the engine never built: `dims.widthFt` is
            // bounded 4-24 ft (spec.ts — a wider span needs a second girder line), so the 32 ft
            // row is clamped to 24 and its stair sits 4 ft from where the unclamped math puts
            // it. The check would then look for bridging in an empty band and pass over the
            // bays that matter.
            const ply = 1.5 / 12; // dressed 2x thickness — the doubled plies straddle each face
            const trimX = members.filter((m) => m.role === 'trimmerJoist').map((m) => m.position[0]).sort((a, b) => a - b);
            const hdrZ = members.filter((m) => m.role === 'headerJoist').map((m) => m.position[2]).sort((a, b) => a - b);
            const plan =
              trimX.length === 4 && hdrZ.length === 4
                ? { x0: trimX[1]! + ply / 2, x1: trimX[2]! - ply / 2, z1: hdrZ[1]! + ply / 2, z2: hdrZ[2]! - ply / 2 }
                : null;
            const spans = members.filter(
              (m) => m.stage === 3 && (m.role === 'joist' || m.role === 'tailJoist' || m.role === 'trimmerJoist'),
            );
            const brs = members.filter((m) => m.role === 'bridging');
            // At 15 ft the clear run from rim to girder is 7 3/8 ft — under the threshold, so
            // that width legitimately gets no rows at all. Everything wider must have some.
            if (widthFt >= 16) assert.ok(brs.length > 0, `${tag}: expected bridging rows`);
            for (const b of brs) {
              // A bridging member's x-extent is its cut length projected flat (cross bridging
              // is a diagonal, so its horizontal run is shorter than the stick).
              const half = (b.cutLength / 12 / 2) * Math.cos(b.rotation[2]);
              const [bx0, bx1, bz] = [b.position[0] - half, b.position[0] + half, b.position[2]];
              assert.ok(b.cutLength > 0.5, `${tag}: ${b.id} degenerate`);
              // It fits inside one bay — never a doubled span reaching across a skipped joist.
              assert.ok(bx1 - bx0 <= joistSpacingIn / 12 + 0.5, `${tag}: ${b.id} spans ${(bx1 - bx0).toFixed(2)} ft, wider than one bay`);
              for (const s of spans) {
                const [sx0, sx1] = [s.position[0] - 1.5 / 24, s.position[0] + 1.5 / 24];
                const [sz0, sz1] = [s.position[2] - s.cutLength / 24, s.position[2] + s.cutLength / 24];
                const throughInX = bx1 > sx0 + 1e-6 && bx0 < sx1 - 1e-6;
                const atSameZ = bz > sz0 - 0.3 && bz < sz1 + 0.3;
                assert.ok(!(throughInX && atSameZ), `${tag}: ${b.id} passes through ${s.id} (${s.role})`);
              }
              if (plan) {
                const overOpening = bx1 > plan.x0 + 1e-6 && bx0 < plan.x1 - 1e-6 && bz > plan.z1 && bz < plan.z2;
                assert.ok(!overOpening, `${tag}: ${b.id} bridges across the stairwell void`);
              }
            }
          }
        }
      }
    }
  }
});

// The short tail joists hung between a header and the near wall span well under the 8 ft that
// calls for a row; a global row line that happens to clip them would land inches off their
// header, doing nothing. Rows are placed per span segment, so those runs are left alone.
test('bridging rows only land in span segments long enough to want one', () => {
  const { members } = generateFrame({ ...golden, foundation: 'basement' });
  const brs = members.filter((m) => m.role === 'bridging');
  const tails = members.filter((m) => m.stage === 3 && m.role === 'tailJoist');
  assert.ok(tails.length > 0, 'the golden basement has tail joists to check');
  for (const b of brs) {
    const half = (b.cutLength / 12 / 2) * Math.cos(b.rotation[2]);
    for (const s of tails) {
      // Only the two runs this piece is nailed BETWEEN count — a tail joist elsewhere on the
      // same row line is in a different bay and says nothing about this piece.
      const bounds = Math.abs(s.position[0] - (b.position[0] - half)) < 0.1 || Math.abs(s.position[0] - (b.position[0] + half)) < 0.1;
      const [sz0, sz1] = [s.position[2] - s.cutLength / 24, s.position[2] + s.cutLength / 24];
      // ...and nailed to it, not merely sharing its x on the other row line.
      if (!bounds || b.position[2] < sz0 || b.position[2] > sz1) continue;
      assert.ok(sz1 - sz0 >= 7.5, `${b.id} bridges ${s.id}, a ${(sz1 - sz0).toFixed(2)} ft run that needs no row`);
      assert.ok(
        b.position[2] - sz0 > 1 && sz1 - b.position[2] > 1,
        `${b.id} sits ${Math.min(b.position[2] - sz0, sz1 - b.position[2]).toFixed(2)} ft from a bearing of ${s.id}`,
      );
    }
  }
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
