// What `platformHeightFt` means on a guard tower.
//
// IT IS THE SURFACE YOU STAND ON. It was the platform FRAME's top, with the decking then laid on
// that — so a tower asked for 16 ft came out walking at 16 ft 0¾ in, on every height the card
// offers and on both footings. The loading platform had exactly this and an earlier pass fixed it
// the other way round ("`deckHeightFt` IS the surface you walk on"), so the two families disagreed
// about what the one figure an operator types actually means:
//
//   tower, asked 16 / 24 / 32 ft      walking surface 16.0625 / 24.0625 / 32.0625   ->  16 / 24 / 32
//   loading platform, asked 4 ft      walking surface 4.0000 all along
//
// The frame drops by the decking's thickness and the surface lands where it was asked for.
// Everything that stands ON the platform — the cab, the guardrail, the ladder's landing, the
// stair's top — takes the surface, and the access used to land on the joists' top with the
// decking ¾ in above it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { PANEL, IN_PER_FT } from '../src/timber/doctrine';
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

function yRange(m: Member): [number, number] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const ys: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    ys.push(m.position[1] + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[1]);
  }
  return [Math.min(...ys), Math.max(...ys)];
}

function tower(over: Record<string, unknown> = {}) {
  const spec = { ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), ...over };
  const model = generateStructure(spec);
  const deck = model.members.filter((m) => m.role === 'subfloor');
  assert.ok(deck.length > 0, 'no platform decking');
  return {
    model,
    asked: (model.spec as unknown as { platformHeightFt: number }).platformHeightFt,
    walk: Math.max(...deck.map((m) => yRange(m)[1])),
    deckUnder: Math.min(...deck.map((m) => yRange(m)[0])),
  };
}

const CASES: Record<string, unknown>[] = [
  {}, { platformHeightFt: 24 }, { platformHeightFt: 32 },
  { footing: 'concrete-pad' }, { access: 'stair' },
];

test('`platformHeightFt` IS THE SURFACE YOU STAND ON — it used to be the frame under it', () => {
  for (const over of CASES) {
    const { asked, walk } = tower(over);
    assert.ok(Math.abs(walk - asked) < 1e-9,
      `${JSON.stringify(over)}: asked for ${asked} ft and the platform walks at ${walk.toFixed(4)} — `
      + `${((walk - asked) * IN_PER_FT).toFixed(3)} in out`);
  }
});

test('and the decking is that thick, laid ON the joists — the frame moved, not the deck', () => {
  // The guard on which piece gave. Dropping the DECK instead of the frame would put the surface
  // right and leave it hanging under the joists it is nailed to.
  const thick = (PANEL.subfloorThickIn.value as number) / IN_PER_FT;
  for (const over of CASES) {
    const { model, walk, deckUnder } = tower(over);
    const label = JSON.stringify(over);
    assert.ok(Math.abs((walk - deckUnder) - thick) < 1e-9,
      `${label}: the decking measures ${((walk - deckUnder) * IN_PER_FT).toFixed(3)} in, not ${PANEL.subfloorThickIn.value}`);
    const joists = model.members.filter((m) => m.role === 'joist');
    const frameTop = Math.max(...joists.map((m) => yRange(m)[1]));
    assert.ok(Math.abs(frameTop - deckUnder) < 1e-9,
      `${label}: the joists top out at ${frameTop.toFixed(4)} and the decking starts at ${deckUnder.toFixed(4)}`);
  }
});

test('and everything standing on the platform starts at the surface, not at the frame', () => {
  for (const over of CASES) {
    const { model, walk } = tower(over);
    const label = JSON.stringify(over);
    // The cab's corner posts and the guardrail's posts both stand on the deck.
    for (const role of ['post', 'railPost'] as const) {
      const ms = model.members.filter((m) => m.role === role && m.id.startsWith(role === 'post' ? 'TW-' : 'RL-'));
      assert.ok(ms.length > 0, `${label}: no ${role} on the platform`);
      for (const m of ms) {
        assert.ok(Math.abs(yRange(m)[0] - walk) < 1e-9,
          `${label}: ${m.id} starts at ${yRange(m)[0].toFixed(4)} and the platform walks at ${walk.toFixed(4)}`);
      }
    }
    // And the way up arrives ON it: a ladder's rails run past the landing, a stair's top tread is
    // one riser below the surface it delivers you to, so both are measured against `walk`.
    const treads = model.members.filter((m) => m.role === 'tread' && /^AC/.test(m.id));
    const rungs = model.members.filter((m) => m.role === 'ladderRung');
    const top = Math.max(...[...treads, ...rungs].map((m) => yRange(m)[1]), -Infinity);
    // Within a riser of the surface it delivers you to — a rung sits AT the landing and has its
    // own thickness, a top tread is one riser below it, so this is the band both live in.
    assert.ok(Math.abs(top - walk) < 1,
      `${label}: the last step of the way up is at ${top.toFixed(4)} and the deck at ${walk.toFixed(4)}`);
  }
});

test('and the loading platform still means the same thing by it', () => {
  // The reason this is a defect at all: two families, one figure, two answers. The platform's was
  // settled first and is the one the tower now matches.
  for (const deckKind of ['plank', 'panel'] as const) {
    const spec = JSON.parse(JSON.stringify(familyById('platform')!.preset));
    spec.deck = deckKind;
    const model = generateStructure(spec);
    // Read the height back off the NORMALIZED spec: the card clamps what it is handed, and the
    // claim is about what the model was actually asked for, not about what was typed.
    const h = (model.spec as unknown as { deckHeightFt: number }).deckHeightFt;
    const deck = model.members.filter((m) => ['deckPlank', 'subfloor'].includes(m.role));
    const walk = Math.max(...deck.map((m) => yRange(m)[1]));
    assert.ok(Math.abs(walk - h) < 1e-9,
      `loading platform (${deckKind}) asked for ${h} ft and walks at ${walk.toFixed(4)}`);
  }
});
