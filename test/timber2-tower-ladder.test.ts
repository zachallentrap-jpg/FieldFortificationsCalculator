// The guard tower's ladder, against the frame it climbs.
//
// A tower's legs are BATTERED — wider at the base than at the cab — and that is the whole reason
// a tall timber tower stands up. It is also the reason a plumb ladder cannot be set by measuring
// off the deck: the deck edge is the frame's NARROWEST point, and a ladder that clears it by the
// doctrine figure is inside the frame everywhere below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { TOWER, LADDER, IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

function towerModel(over: Record<string, unknown> = {}) {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset));
  Object.assign(spec, over);
  return { spec, model: generateStructure(spec) };
}

/**
 * The front leg's own line, READ OFF THE MODEL rather than re-derived.
 *
 * This used to restate the batter formula — `cx - (half + batter·(1 − y/h))` — which is a copy of
 * the generator kept in a second place, and it went stale the moment the legs stopped starting at
 * grade. (They stand on a timber mudsill now, so a leg's foot is a 6x8's thickness up and the
 * batter runs over the leg's own climb.) Interpolating the emitted leg means the test measures the
 * frame the generator actually built, which is the only thing a clearance can be measured against.
 */
function frontLeg(model: { members: Member[] }) {
  const legs = model.members.filter((m) => m.role === 'towerLeg');
  assert.ok(legs.length === 4, 'a tower has four legs');
  // Front-left: smallest x, then smallest z. Its length axis is local X under YXZ.
  const leg = legs.slice().sort((a, b) => (a.position[0] - b.position[0]) || (a.position[2] - b.position[2]))[0]!;
  const [, ry, rz] = leg.rotation;
  const half = leg.cutLength / IN_PER_FT / 2;
  const ax: [number, number, number] = [Math.cos(rz) * Math.cos(ry), Math.sin(rz), -Math.cos(rz) * Math.sin(ry)];
  const foot: [number, number, number] = [
    leg.position[0] - ax[0] * half, leg.position[1] - ax[1] * half, leg.position[2] - ax[2] * half];
  const head: [number, number, number] = [
    leg.position[0] + ax[0] * half, leg.position[1] + ax[1] * half, leg.position[2] + ax[2] * half];
  const lean = (head[2] - foot[2]) / (head[1] - foot[1]);
  return { foot, head, lean, zAt: (y: number): number => foot[2] + (y - foot[1]) * lean };
}

test('THE LADDER CLEARS THE BATTERED FRAME AT EVERY RUNG, not just at the deck', () => {
  // Measured on the shipped preset before the fix: the ladder stood plumb at z = 0.90 while the
  // legs ran from z = 0.0 at the ground to z = 1.5 at the deck, so it crossed the leg plane about
  // 9.6 ft up and ran straight through two brace diagonals with 8.9 in of overlap. The clearance
  // arithmetic was right and the datum was wrong.
  //
  // Every rung sits ON the ladder's centreline, so the rungs are the sample points and no
  // bounding box is needed — a box round a RAKED member spans the whole lean and answers nothing.
  const want = TOWER.ladderClearanceFt.value as number;
  // Both footings: they stand the legs at different heights, and a clearance that only holds on
  // one of them is a clearance that depends on which footing was picked, which it must not.
  for (const footing of ['timber-mudsill', 'concrete-pad']) {
    const { model } = towerModel({ footing });
    const leg = frontLeg(model);
    const rungs = model.members.filter((m) => m.role === 'ladderRung');
    assert.ok(rungs.length > 4, `${footing}: the preset climbs on a ladder`);
    const gaps = rungs.map((r) => leg.zAt(r.position[1]!) - r.position[2]!);
    for (let i = 0; i < rungs.length; i++) {
      assert.ok(gaps[i]! >= want - 1e-9,
        `${footing}: ${rungs[i]!.id} at y=${rungs[i]!.position[1]!.toFixed(1)} stands ${(gaps[i]! * 12).toFixed(2)} in `
        + `from the leg face; doctrine asks for ${(want * 12).toFixed(1)} in`);
    }
    // Constant, not merely sufficient: a ladder raked at the frame's own batter holds one gap.
    const spread = Math.max(...gaps) - Math.min(...gaps);
    assert.ok(spread < 1e-9,
      `${footing}: the gap wanders by ${(spread * 12).toFixed(3)} in — the ladder is not parallel to the frame`);
  }
});

test('the ladder still reaches the landing, and its rails still run past it', () => {
  // The rake must not be bought by breaking what was already right. EM 385-1-1 wants the rails
  // 36 in above the landing, measured as HEIGHT — so a raked rail is longer than a plumb one by
  // its own hypotenuse, not the same length leaned over.
  const { spec, model } = towerModel();
  const rungs = model.members.filter((m) => m.role === 'ladderRung');
  const rails = model.members.filter((m) => m.role === 'ladderRail');
  assert.equal(rails.length, 2);
  const deckY = spec.platformHeightFt as number;
  assert.ok(Math.abs(Math.max(...rungs.map((r) => r.position[1]!)) - deckY) < 1e-9,
    'the top rung is the landing');
  const spacing = (LADDER.rungSpacingIn.value as number) / IN_PER_FT;
  const ys = rungs.map((r) => r.position[1]!).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(Math.abs(ys[i]! - ys[i - 1]! - spacing) < 1e-9, 'rungs stay at the doctrine spacing');
  }
  // Rail length is the raked climb PLUS the raked extension, at the rake the LEGS actually have.
  // Restating it as `batter / platformHeightFt` was a copy of the generator that stopped being
  // true when the legs started on a mudsill instead of on grade.
  const { lean } = frontLeg(model);
  const rake = Math.sqrt(1 + lean * lean);
  const ext = (LADDER.topExtensionIn.value as number) / IN_PER_FT;
  assert.ok(Math.abs(rails[0]!.cutLength / IN_PER_FT - (deckY + ext) * rake) < 1e-9,
    `rail is ${(rails[0]!.cutLength / IN_PER_FT).toFixed(4)} ft, want ${((deckY + ext) * rake).toFixed(4)}`);
});

test('a wall ladder is still plumb — the rake is the tower\'s, not the ladder\'s', () => {
  // `generateLadder` serves the two-story building's exterior ladder too, and that one climbs a
  // wall that does not lean. Zero is the default and keeps that case exactly as it was.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.stories = [spec.stories[0], JSON.parse(JSON.stringify(spec.stories[0]))];
  spec.interiorStairs = false;
  const rungs = generateStructure(spec).members.filter((m) => m.role === 'ladderRung');
  if (rungs.length === 0) return; // that family may not carry one; the tower assertions stand
  const zs = new Set(rungs.map((r) => Math.round(r.position[2]! * 1e6)));
  assert.equal(zs.size, 1, 'a wall ladder leans nowhere: every rung sits at one plan position');
});
