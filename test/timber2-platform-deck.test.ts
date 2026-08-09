// The loading platform's deck, and the tent floor's.
//
// THE DECK SITS ON THE JOISTS, AND `deckHeightFt` IS THE SURFACE YOU WALK ON. Everything under the
// platform's deck was hung off `deckY` with the JOISTS' TOPS at it, and then the decking was laid
// with ITS top at the same figure — so the boards were buried in the top 1½ in of every joist,
// over the whole 20 by 12 ft of the platform. A panel deck did the same in the top ¾ in:
//
//   plank  joists 3.3958..4.0000   deck 3.8750..4.0000   420 overlapping pairs
//   panel  joists 3.3958..4.0000   deck 3.9375..4.0000    58
//
// The tent frame in the same file has it right — it stacks skid + joist + deck and calls the TOP
// of that `deckY` — which is what settles which of the two has to move here. `deckHeightFt` is a
// fall height to the rail pass and a landing to the stair pass, so the surface stays where the
// operator asked for it and the frame drops by the deck's thickness.
//
// AND THE LAST BOARD IS RIPPED TO FIT. `Math.min(z, W - w / 2)` clamped the last board's centre
// back inside instead of narrowing it, which does not widen the board: twelve feet is 26.18 boards
// and an inch of the platform along its whole 20-ft edge was open deck. Same `Math.min`, same
// mistake, in the tent floor down its 29½-ft length — and bunker.ts already had it written up as
// the wrong answer to this exact question.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];
interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

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

function box(m: Member): Box {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const SURFACE = ['deckPlank', 'subfloor'];

/** The platform, and the piece of it a person stands on: the deck over the footprint. */
function platform(deck: 'plank' | 'panel', base: 'piers' | 'skids') {
  const spec = JSON.parse(JSON.stringify(familyById('platform')!.preset));
  spec.deck = deck;
  spec.base = base;
  const model = generateStructure(spec);
  const bs = model.members.map((m) => ({ m, b: box(m) }));
  const d = (model.spec as unknown as { dims: { lengthFt: number; widthFt: number }; deckHeightFt: number });
  return {
    bs,
    dims: d.dims,
    deckHeightFt: d.deckHeightFt,
    // Over the footprint only — the ramp's surface is the same roles, running away downhill.
    over: bs.filter((k) => SURFACE.includes(k.m.role)
      && k.b.z[0] >= -1e-6 && k.b.z[1] <= d.dims.widthFt + 1e-6
      && k.b.x[0] >= -1e-6 && k.b.x[1] <= d.dims.lengthFt + 1e-6),
    joists: bs.filter((k) => k.m.role === 'joist'),
  };
}

test('THE DECK SITS ON ITS JOISTS — it used to be buried in the top of every one', () => {
  for (const deck of ['plank', 'panel'] as const) {
    for (const base of ['piers', 'skids'] as const) {
      const { over, joists, deckHeightFt } = platform(deck, base);
      const label = `${deck}/${base}`;
      assert.ok(over.length > 0 && joists.length > 0, `${label}: nothing to measure`);
      const under = Math.min(...over.map((k) => k.b.y[0]));
      const top = Math.max(...over.map((k) => k.b.y[1]));
      const joistTop = Math.max(...joists.map((k) => k.b.y[1]));
      assert.ok(Math.abs(under - joistTop) < 1e-9,
        `${label}: the deck's underside is ${under.toFixed(4)} and the joists top out at `
        + `${joistTop.toFixed(4)} — ${((joistTop - under) * IN_PER_FT).toFixed(3)} in of one inside the other`);
      // AND THE SURFACE IS STILL WHERE IT WAS ASKED FOR. Dropping the frame is only right if the
      // thing the operator specified — the height they load onto — did not move with it.
      assert.ok(Math.abs(top - deckHeightFt) < 1e-9,
        `${label}: the deck surface is at ${top.toFixed(4)} ft and the card asked for ${deckHeightFt}`);
    }
  }
});

test('and no deck piece shares wood with a joist, a sill or a post', () => {
  const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  for (const deck of ['plank', 'panel'] as const) {
    for (const base of ['piers', 'skids'] as const) {
      const { bs, over } = platform(deck, base);
      const frame = bs.filter((k) => ['joist', 'sill', 'post', 'footing', 'skid'].includes(k.m.role));
      assert.ok(frame.length > 4, `${deck}/${base}: ${frame.length} frame members`);
      for (const d of over) {
        for (const f of frame) {
          const s: V3 = [ov(d.b.x, f.b.x), ov(d.b.y, f.b.y), ov(d.b.z, f.b.z)];
          assert.ok(!s.every((v) => v > 1e-9),
            `${deck}/${base}: ${d.m.id} and ${f.m.id} (${f.m.role}) share `
            + `${s.map((v) => (v * IN_PER_FT).toFixed(3)).join(' x ')} in of wood`);
        }
      }
    }
  }
});

test('THE LAST BOARD IS RIPPED TO FIT — an inch of the deck used to be open along its whole edge', () => {
  // Walked as a surface, not counted as boards: every square foot of the footprint has something
  // under a boot. A clamped last board leaves a strip at one edge that no count of pieces notices.
  for (const deck of ['plank', 'panel'] as const) {
    const { over, dims } = platform(deck, 'piers');
    const bare: string[] = [];
    for (let i = 0; i < 160; i++) {
      for (let j = 0; j < 100; j++) {
        const x = dims.lengthFt * (i + 0.5) / 160;
        const z = dims.widthFt * (j + 0.5) / 100;
        if (!over.some((k) => k.b.x[0] - 1e-9 <= x && x <= k.b.x[1] + 1e-9
          && k.b.z[0] - 1e-9 <= z && z <= k.b.z[1] + 1e-9)) bare.push(`${x.toFixed(2)},${z.toFixed(2)}`);
      }
    }
    assert.equal(bare.length, 0, bare.length
      ? `${deck}: ${bare.length} stations of 16000 with no deck under them — first ${bare.slice(0, 4).join(' ')}`
      : '');
    // And the boards do not solve it by lapping each other instead.
    const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
    for (let i = 0; i < over.length; i++) {
      for (let j = i + 1; j < over.length; j++) {
        const s: V3 = [ov(over[i]!.b.x, over[j]!.b.x), ov(over[i]!.b.y, over[j]!.b.y), ov(over[i]!.b.z, over[j]!.b.z)];
        assert.ok(!s.every((v) => v > 1e-9),
          `${deck}: ${over[i]!.m.id} and ${over[j]!.m.id} lap by `
          + `${s.map((v) => (v * IN_PER_FT).toFixed(3)).join(' x ')} in`);
      }
    }
  }
});

test('and the tent floor is decked to its edge too — the same clamp, the same inch', () => {
  for (const id of ['tent-floor', 'strongback'] as const) {
    const model = generateStructure(JSON.parse(JSON.stringify(familyById(id)!.preset)));
    const d = (model.spec as unknown as { dims: { lengthFt: number; widthFt: number } }).dims;
    const planks = model.members.filter((m) => m.role === 'deckPlank').map((m) => box(m));
    assert.ok(planks.length > 4, `${id}: ${planks.length} deck planks`);
    const bare: string[] = [];
    for (let i = 0; i < 80; i++) {
      for (let j = 0; j < 120; j++) {
        const x = d.lengthFt * (i + 0.5) / 80;
        const z = d.widthFt * (j + 0.5) / 120;
        if (!planks.some((b) => b.x[0] - 1e-9 <= x && x <= b.x[1] + 1e-9 && b.z[0] - 1e-9 <= z && z <= b.z[1] + 1e-9)) {
          bare.push(`${x.toFixed(2)},${z.toFixed(2)}`);
        }
      }
    }
    assert.equal(bare.length, 0, bare.length
      ? `${id}: ${bare.length} stations of 9600 with no floor under them — first ${bare.slice(0, 4).join(' ')}`
      : '');
  }
});
