// A shutter hangs on the wall. Which wall face, though?
//
// `timber2-built-openings` states the rule and has since T5: *"a door leaf sits in the rough
// opening… a shutter is fastened to the finished wall and stands proud of the siding."* What it
// checks is that the shutter is outboard of the FRAMING line. On board-and-batten it was not
// outboard of the siding:
//
//   b-hut + board-and-batten        32 shutter x batten pairs at 0.750 in
//   sea hut                         18            guard shack        32
//
// 0.750 in is the batten's whole thickness. The leaves stood at the BOARD face and occupied
// exactly the shell the battens are in, so every batten a window crossed passed clean through both
// leaves — three or four per window, and on screen the shutter all but disappears into the wall
// with a batten's face coplanar with its own.
//
// THE FIGURE HANDED IN WAS THE WRONG ONE, and the right one already existed. `wallLayerThicknessFt`
// answers *how thick is ONE layer*, which is the standoff the layer over it needs, and it leaves
// the batten out on purpose — a batten has nothing over it. `finishedWallThicknessFt` answers
// *where does the wall stop*, batten included; it was written for the rake's barge board, which is
// the same kind of piece. `building.ts` was summing the first and handing it to everything hung on
// the wall. Anything nailed to the finished stack needs the second, and now gets it.
//
// Nothing on any shipped card moves: none of the fourteen presets pairs board-and-batten with a
// shutter or a door. The combination is one click away in the planning card, which is where it was
// found.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { wallLayerThicknessFt, finishedWallThicknessFt } from '../src/timber/subsystems/coverings';
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

const halfExtents = (m: Member): V3 => [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
const axesOf = (m: Member): V3[] => [rotate(m, [1, 0, 0]), rotate(m, [0, 1, 0]), rotate(m, [0, 0, 1])];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Least separation over the 15 separating axes. Positive is a TRUE clearance. */
function gap(a: Member, b: Member): number {
  const A = axesOf(a), B = axesOf(b), ha = halfExtents(a), hb = halfExtents(b);
  const d: V3 = [b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]];
  const cand: V3[] = [...A, ...B];
  for (const u of A) {
    for (const v of B) {
      const c: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(c[0], c[1], c[2]);
      if (l > 1e-9) cand.push([c[0] / l, c[1] / l, c[2] / l]);
    }
  }
  let best = -Infinity;
  for (const n of cand) {
    const ra = A.reduce((s, u, i) => s + ha[i]! * Math.abs(dot(u, n)), 0);
    const rb = B.reduce((s, u, i) => s + hb[i]! * Math.abs(dot(u, n)), 0);
    best = Math.max(best, Math.abs(dot(d, n)) - ra - rb);
  }
  return best;
}

function extent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h = halfExtents(m);
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

/** Nailed to the finished wall. A door leaf is NOT — it is hung in the rough opening. */
const HUNG = ['shutter'];
/** Every layer of the wall's skin, batten included. */
const SKIN = ['siding', 'sidingBoard', 'batten', 'sheathingPanel'];

const CARDS = ['b-hut', 'sea-hut', 'guard-shack', 'squad-hut'] as const;
const SIDINGS = ['plywood', 'boards', 'boardAndBatten'] as const;
const SHEATHINGS = ['none', 'plywood'] as const;

function build(id: (typeof CARDS)[number], siding: string, sheathing: string): Member[] {
  const spec = JSON.parse(JSON.stringify(familyById(id)!.preset)) as
    { coverings: { siding: string; wallSheathing: string } };
  spec.coverings.siding = siding;
  spec.coverings.wallSheathing = sheathing;
  return generateStructure(spec as never).members;
}

test('NOTHING HUNG ON A WALL IS INSIDE ITS SKIN — on every siding the card offers', () => {
  let cases = 0, hung = 0;
  for (const id of CARDS) {
    for (const siding of SIDINGS) {
      for (const sheathing of SHEATHINGS) {
        const members = build(id, siding, sheathing);
        const on = members.filter((m) => HUNG.includes(m.role));
        const skin = members.filter((m) => SKIN.includes(m.role));
        assert.ok(on.length > 0 && skin.length > 0,
          `${id} ${siding}/${sheathing}: ${on.length} hung pieces against ${skin.length} of skin`);
        cases++; hung += on.length;
        for (const a of on) {
          for (const b of skin) {
            const g = gap(a, b);
            assert.ok(g >= -1e-9,
              `${id} ${siding} over ${sheathing}: ${a.id} is ${(-g * IN_PER_FT).toFixed(3)} in inside `
              + `${b.id} (${b.role}) — it is hung on the wall, not let into it`);
          }
        }
      }
    }
  }
  assert.ok(cases === CARDS.length * SIDINGS.length * SHEATHINGS.length, `${cases} covering combinations`);
  assert.ok(hung > 400, `${hung} hung pieces measured across them`);
});

test('and it is ON the assembly — touching it, not standing off in the air', () => {
  // The guard on the other direction, and the one a fix by arbitrary clearance would fail. A
  // shutter hangs against the wall; pushed out by any round figure it would pass the test above
  // and float, which on board-and-batten is the same defect mirrored.
  //
  // Against the assembly rather than against the wall, because a leaf is two layers: its boards
  // lie on the finished wall and its own battens lie on the boards, *"on the OUTSIDE of a closed
  // shutter, where a hinge can reach them"*. Asking the battens to touch the wall would be asking
  // them to be somewhere they must not be.
  for (const id of CARDS) {
    for (const siding of SIDINGS) {
      const members = build(id, siding, 'none');
      const skin = members.filter((m) => SKIN.includes(m.role));
      const on = members.filter((m) => HUNG.includes(m.role));
      for (const a of on) {
        const near = Math.min(...[...skin, ...on].filter((b) => b !== a).map((b) => gap(a, b)));
        assert.ok(near < 1e-6,
          `${id} ${siding}: ${a.id} stands ${(near * IN_PER_FT).toFixed(3)} in clear of everything — `
          + 'there is nothing behind it to screw a hinge to');
      }
      // And the leaf's own boards touch the WALL, which is the half that matters here. Read on the
      // S wall alone: "innermost" is a direction, and each wall faces a different way.
      const south = on.filter((m) => m.wall === 'S');
      if (!south.length) continue;
      const at = Math.max(...south.map((m) => extent(m, 2)[1]));
      const inner = south.filter((m) => Math.abs(extent(m, 2)[1] - at) < 1e-9);
      assert.ok(inner.length > 0, `${id} ${siding}: no shutter piece lies against the wall`);
      // SOME of them, not all: on a battened wall the skin's outer face is the BATTENS, which come
      // every board width, so a leaf board landing between two is correctly clear of both. What
      // must not happen is a whole wall's worth of shutter bearing on nothing.
      assert.ok(inner.some((a) => Math.min(...skin.map((b) => gap(a, b))) < 1e-6),
        `${id} ${siding}: not one of the ${inner.length} innermost shutter pieces on the S wall `
        + 'touches the skin — the leaves are hung on air');
    }
  }
});

test('and the standoff IS the finished wall, measured off the model', () => {
  // Stated as a number rather than as a collision, because the collision test alone would pass on
  // a wall with no batten where the window happens to fall between two. Read off the S wall, whose
  // outer framing face is z = 0 and whose skin runs outboard (negative z).
  for (const id of CARDS) {
    for (const siding of SIDINGS) {
      for (const sheathing of SHEATHINGS) {
        const members = build(id, siding, sheathing);
        const on = members.filter((m) => HUNG.includes(m.role) && m.wall === 'S');
        if (!on.length) continue;
        const inner = Math.max(...on.map((m) => extent(m, 2)[1]));
        const want = -finishedWallThicknessFt(sheathing, siding);
        assert.ok(Math.abs(inner - want) < 1e-9,
          `${id} ${siding} over ${sheathing}: the shutters' inner face is at z=${inner.toFixed(5)}, `
          + `and the finished wall stops at ${want.toFixed(5)} — `
          + `${(Math.abs(inner - want) * IN_PER_FT).toFixed(3)} in out`);
        // And the skin really does stop there, so the figure is not just self-consistent.
        const face = Math.min(...members.filter((m) => SKIN.includes(m.role) && m.wall === 'S')
          .map((m) => extent(m, 2)[0]));
        assert.ok(Math.abs(face - want) < 1e-9,
          `${id} ${siding} over ${sheathing}: the skin reaches z=${face.toFixed(5)}, not ${want.toFixed(5)}`);
      }
    }
  }
});

test('THE TWO THICKNESSES ARE DIFFERENT QUESTIONS, and only one of them is the wall', () => {
  // Why the bug existed, stated so the next caller picks the right one. `wallLayerThicknessFt` is
  // how thick ONE layer is — the standoff the layer over it needs — and correctly omits the
  // batten, which has nothing over it. Summing the layers therefore does NOT give the wall.
  const layered = (sh: 'none' | 'plywood', sd: 'none' | 'plywood' | 'boards' | 'boardAndBatten'): number =>
    (sh === 'none' ? 0 : wallLayerThicknessFt(sh))
    + (sd === 'none' ? 0 : wallLayerThicknessFt(sd === 'boardAndBatten' ? 'boardAndBatten'
      : sd === 'boards' ? 'boards' : 'plywood'));

  for (const sh of ['none', 'plywood'] as const) {
    for (const sd of ['none', 'plywood', 'boards'] as const) {
      assert.equal(finishedWallThicknessFt(sh, sd), layered(sh, sd),
        `${sd} over ${sh}: no batten, so the two answers agree`);
    }
    // And board-and-batten is the one place they differ — by exactly one batten.
    const d = finishedWallThicknessFt(sh, 'boardAndBatten') - layered(sh, 'boardAndBatten');
    assert.ok(d > 0.05, `board-and-batten over ${sh}: the two agree, which means the batten went missing`);
    assert.ok(Math.abs(d * IN_PER_FT - 0.75) < 1e-9,
      `the difference is ${(d * IN_PER_FT).toFixed(4)} in, and a 1x2 batten is 0.75`);
  }
});
