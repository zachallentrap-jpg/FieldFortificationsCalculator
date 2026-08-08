// How low a loading platform's deck may be set, and why.
//
// `deckHeightFt` is the surface you stand on — the pass that settled that also moved the frame down
// by the decking's thickness, because "the rail asks `railRequired(deckY)` about a fall from it and
// the stair lands on it". Everything else hangs UNDER that surface, and the registry let the
// operator ask for half a foot of it. Below the depth of the frame, every setting the picker
// offered was broken, each in its own way:
//
//   on skids   0.5, 1.0    no posts, and the sill 8¼ / 2¼ in UNDERGROUND
//              1.25, 1.5   no posts, and the sill 4¾ / 1¾ in INSIDE the runner
//   on piers   0.5, 1.0    no posts, and the sill 8¼ / 2¼ in UNDERGROUND
//              1.25        no posts, and the sill floating ¾ in over grade on nothing
//
// Rendered, a 0.5-ft platform is a slab of decking sunk into the ground with no legs at all.
//
// The repair is the one `foundation.crawlFt` already took — *"Floored at 1 ft, not 0.5: the
// built-up girder hangs a full 9 1/4 in BELOW the sill, so a shallower crawl puts the girder posts
// underground … The bound is geometry, not preference, and it is stated once here."* — so the
// registry's min for `deckHeightFt` is the depth of what hangs under the deck, and this file
// re-derives that depth from the lumber so the two cannot drift apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { specPath } from '../src/timber/spec';
import { IN_PER_FT, LUMBER, PLATFORM, PANEL, TENT } from '../src/timber/doctrine';
import { DRESSED } from '../src/timber/types';
import type { SpecIssue } from '../src/timber/normalize';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];

/** Rotate a local vector by a member's YXZ euler (R = Ry·Rx·Rz), the scene's convention. */
function rotate(m: Pick<Member, 'rotation'>, v: V3): V3 {
  const [rx, ry, rz] = m.rotation;
  let [x, y, z] = v;
  let a = x * Math.cos(rz) - y * Math.sin(rz);
  let b = x * Math.sin(rz) + y * Math.cos(rz);
  x = a; y = b;
  a = y * Math.cos(rx) - z * Math.sin(rx);
  b = y * Math.sin(rx) + z * Math.cos(rx);
  y = a; z = b;
  a = x * Math.cos(ry) + z * Math.sin(ry);
  b = -x * Math.sin(ry) + z * Math.cos(ry);
  return [a, y, b];
}

function axisExtent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

const DEF = specPath('deckHeightFt')!;
const FRAME = ['sill', 'joist', 'rimJoist', 'deckPlank', 'subfloor'];

/** Every height the picker's own number input offers. */
const OFFERED: number[] = [];
for (let h = DEF.min!; h <= DEF.max! + 1e-9; h += DEF.step!) OFFERED.push(Math.round(h * 1e6) / 1e6);

function platform(base: 'piers' | 'skids', deck: 'plank' | 'panel', deckHeightFt: number) {
  const spec = JSON.parse(JSON.stringify(familyById('platform')!.preset)) as Record<string, unknown>;
  spec.base = base;
  spec.deck = deck;
  spec.deckHeightFt = deckHeightFt;
  const r = generateStructure(spec as never);
  return {
    ...r,
    posts: r.members.filter((m) => m.role === 'post' && m.id.startsWith('PF-')),
    skids: r.members.filter((m) => m.role === 'skid'),
    frame: r.members.filter((m) => FRAME.includes(m.role)),
    label: `${base}/${deck} at ${deckHeightFt} ft`,
  };
}

test('NO PLATFORM THE PICKER OFFERS PUTS ITS FRAME UNDERGROUND', () => {
  assert.ok(OFFERED.length > 10, `${OFFERED.length} deck heights on the input`);
  for (const base of ['piers', 'skids'] as const) {
    for (const deck of ['plank', 'panel'] as const) {
      for (const h of OFFERED) {
        const p = platform(base, deck, h);
        for (const m of p.frame) {
          assert.ok(axisExtent(m, 1)[0] >= -1e-9,
            `${p.label}: ${m.id} (${m.role}) reaches ${(-axisExtent(m, 1)[0] * IN_PER_FT).toFixed(2)} in `
            + 'below grade');
        }
        assert.ok(p.posts.length > 0,
          `${p.label}: ${p.members.length} members and NOT ONE POST — the deck rests on nothing`);
      }
    }
  }
});

test('and the sill bears on what is under it — a runner, or a post off the pad', () => {
  for (const deck of ['plank', 'panel'] as const) {
    for (const h of OFFERED) {
      const onSkids = platform('skids', deck, h);
      const skidTop = Math.max(...onSkids.skids.map((s) => axisExtent(s, 1)[1]));
      for (const s of onSkids.members.filter((m) => m.role === 'sill')) {
        assert.ok(axisExtent(s, 1)[0] >= skidTop - 1e-9,
          `${onSkids.label}: the sill is ${((skidTop - axisExtent(s, 1)[0]) * IN_PER_FT).toFixed(2)} in `
          + 'inside the runner it is supposed to be held over');
      }
      // And a post stands between them, which is the whole difference between the two bases.
      for (const post of onSkids.posts) {
        assert.ok(Math.abs(axisExtent(post, 1)[0] - skidTop) < 1e-9,
          `${onSkids.label}: ${post.id} does not start on the runner top`);
        assert.ok(post.cutLength > 0, `${onSkids.label}: ${post.id} is ${post.cutLength} in long`);
      }
      const onPiers = platform('piers', deck, h);
      for (const post of onPiers.posts) {
        assert.ok(Math.abs(axisExtent(post, 1)[0]) < 1e-9,
          `${onPiers.label}: ${post.id} starts at ${axisExtent(post, 1)[0].toFixed(4)}, not on grade`);
      }
    }
  }
});

test('THE FLOOR IS THE LUMBER, re-derived here so the two cannot drift apart', () => {
  // What actually hangs under the walking surface, worst case: a runner lying on grade, the
  // shortest post the generator will still emit, then the sill, the joist and the decking.
  const skid = DRESSED[LUMBER.skidNominal.value as string]!.d / IN_PER_FT;
  const sill = DRESSED[LUMBER.sillNominal.value as string]!.d / IN_PER_FT;
  const joist = DRESSED[LUMBER.joistNominal.value as string]!.d / IN_PER_FT;
  const deck = Math.max(
    DRESSED[TENT.deckNominal.value as string]!.w / IN_PER_FT,
    (PANEL.subfloorThickIn.value as number) / IN_PER_FT,
  );
  const floor = skid + (PLATFORM.minPostFt.value as number) + sill + joist + deck;
  assert.ok(DEF.min! >= floor,
    `the registry offers ${DEF.min} ft where the frame under the deck is ${floor.toFixed(4)} ft deep `
    + `(runner ${(skid * IN_PER_FT).toFixed(2)} + post ${PLATFORM.minPostFt.value} ft + sill `
    + `${(sill * IN_PER_FT).toFixed(2)} + joist ${(joist * IN_PER_FT).toFixed(2)} + deck `
    + `${(deck * IN_PER_FT).toFixed(2)} in)`);
  // And TIGHT: one step lower would not clear it, so this is the geometry and not a round number
  // somebody liked. If the stock ever gets shallower this fires and the registry can come down.
  assert.ok(DEF.min! - DEF.step! < floor,
    `the registry offers ${DEF.min} ft where ${(DEF.min! - DEF.step!)} would still clear a `
    + `${floor.toFixed(4)} ft frame — the floor is higher than the geometry asks`);
});

test('and what must NOT change: a good height, a bad one, and the card as shipped', () => {
  // In range: untouched and silent.
  for (const h of [2, 3, 4, 5]) {
    const r = platform('piers', 'plank', h);
    assert.equal((r.spec as unknown as { deckHeightFt: number }).deckHeightFt, h, `deck ${h} moved`);
    assert.equal(r.issues.filter((i: SpecIssue) => i.path === 'deckHeightFt').length, 0,
      `deck ${h} is in range and was complained about`);
  }
  // Out of range: clamped, and SAID SO — which is what a saved plan or a link from before this
  // floor existed now gets, rather than a platform lying in a hole.
  for (const [h, want] of [[0.5, DEF.min!], [1, DEF.min!], [1.5, DEF.min!], [9, 5]] as [number, number][]) {
    const r = platform('piers', 'plank', h);
    assert.equal((r.spec as unknown as { deckHeightFt: number }).deckHeightFt, want,
      `deck ${h} resolved somewhere else`);
    const said = r.issues.filter((i: SpecIssue) => i.path === 'deckHeightFt');
    assert.equal(said.length, 1, `deck ${h}: ${said.length} issues`);
    assert.equal(said[0]!.severity, 'warn', `deck ${h}: a clamp is a warning`);
  }
  // The shipped card sits at 4 ft, well clear of the floor, and says nothing.
  const shipped = generateStructure(JSON.parse(JSON.stringify(familyById('platform')!.preset)));
  assert.equal(shipped.issues.filter((i: SpecIssue) => i.path === 'deckHeightFt').length, 0,
    'the shipped platform now raises an issue about its own deck height');
  assert.ok(shipped.members.filter((m) => m.role === 'post' && m.id.startsWith('PF-')).length > 0,
    'the shipped platform lost its posts');
});
