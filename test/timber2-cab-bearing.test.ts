// What carries the guard tower's cab.
//
// A sweep for members that STAND ON a deck and reach past its edge found these and they look
// alarming: all four cab corner posts hang 1¾ in over the platform's decking, in both plan
// directions, and the cladding on them reaches 2¼ in past it all round.
//
//   deck        x 1.5000 .. 9.5000        the platform, struck at `cabPlanFt`
//   cab post    x 1.3542 .. 1.6458        centred on the deck's own corner
//
// It is NOT the tent frame's defect wearing a different hat, and the difference is worth pinning
// because nothing in the suite said so. **The post lands on the leg.** A battered leg's head is
// nearly two feet across at the platform, and the post's whole footprint sits inside it with an
// inch to spare on every side, on every cab size the card offers, both footings and all three
// heights. What stops at the deck's edge under the post is ¾ in of plywood; what carries it is
// the strongest bearing point in the structure.
//
// And the position is load-bearing in a second sense: `tower.ts` hands those same four corners to
// `generateRailing` as `standing` posts — *"the cab's four corner posts stand on these same
// corners… told about them, it leaves those holes alone and butts its rails on their faces"* —
// so stepping the cab in would leave the deck's corners unposted and put the railing's own corner
// post through the cab post. The overhang is the shape of a deliberate joint, not an oversight.
//
// This file exists so that if the batter, the cab plan or the leg's section ever moves, the thing
// that makes the overhang acceptable fails loudly instead of silently ceasing to be true.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
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

function extent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

const CASES: Record<string, unknown>[] = [
  {}, { cabPlanFt: 6 }, { cabPlanFt: 10 },
  { footing: 'concrete-pad' }, { platformHeightFt: 24 }, { platformHeightFt: 32 },
];

function tower(over: Record<string, unknown>) {
  const members = generateStructure({ ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), ...over }).members;
  const posts = members.filter((m) => m.role === 'post' && m.id.startsWith('TW-'));
  assert.equal(posts.length, 4, `${JSON.stringify(over)}: a cab has four corner posts`);
  return {
    label: JSON.stringify(over),
    posts,
    legs: members.filter((m) => m.role === 'towerLeg'),
    deck: members.filter((m) => m.role === 'subfloor'),
  };
}

test('A CAB CORNER POST LANDS ON A LEG — that is what makes it a corner post', () => {
  for (const over of CASES) {
    const { label, posts, legs } = tower(over);
    assert.equal(legs.length, 4, `${label}: four legs`);
    for (const p of posts) {
      const px = extent(p, 0), pz = extent(p, 2);
      // The leg whose head covers the post's footprint best; a battered leg's box spans its whole
      // lean, which is exactly the plan area the head presents at the platform.
      const cover = Math.max(...legs.map((l) => {
        const lx = extent(l, 0), lz = extent(l, 2);
        return Math.min(px[0] - lx[0], lx[1] - px[1], pz[0] - lz[0], lz[1] - pz[1]);
      }));
      assert.ok(cover > 0,
        `${label}: ${p.id} overhangs every leg by ${(-cover * IN_PER_FT).toFixed(2)} in — it is on the decking alone`);
    }
  }
});

test('and it may therefore overhang the DECKING, which is three-quarters of an inch of plywood', () => {
  // The honest half. The sweep's reading was right about the geometry and wrong about what it
  // meant, and a test that only asserted the good news would hide the thing that has to be
  // re-checked if the cab plan and the leg square ever stop being struck from one figure.
  for (const over of CASES) {
    const { label, posts, deck } = tower(over);
    const dx: [number, number] = [
      Math.min(...deck.map((m) => extent(m, 0)[0])), Math.max(...deck.map((m) => extent(m, 0)[1]))];
    const dz: [number, number] = [
      Math.min(...deck.map((m) => extent(m, 2)[0])), Math.max(...deck.map((m) => extent(m, 2)[1]))];
    for (const p of posts) {
      const px = extent(p, 0), pz = extent(p, 2);
      const out = Math.max(dx[0] - px[0], px[1] - dx[1], dz[0] - pz[0], pz[1] - dz[1]);
      assert.ok(out > 0, `${label}: ${p.id} is inside the decking — the joint this file describes has changed`);
      // Half a post and no more: it is centred on the deck's corner, which is where the railing
      // is told to expect it.
      const half = (extent(p, 0)[1] - extent(p, 0)[0]) / 2;
      assert.ok(Math.abs(out - half) < 1e-9,
        `${label}: ${p.id} reaches ${(out * IN_PER_FT).toFixed(3)} in past the deck, not the `
        + `${(half * IN_PER_FT).toFixed(3)} half its own width comes to`);
    }
  }
});
