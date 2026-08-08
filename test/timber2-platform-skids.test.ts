// The loading platform on skids: what the runners are actually under.
//
// The base block in `platform.ts` states the rule itself — *"The two bases differ in what is UNDER
// the post — a concrete pad you pour, or a timber runner you can drag the whole thing on"* — and an
// earlier pass had already had to fix the runners being buried while the platform sat on the earth
// between them. What nobody checked is whether a runner ends up under a post at all.
//
// `generateSkids` spreads its runners evenly across the width, which is right under a FLOOR DECK:
// the joists cross every one of them, so every one carries. A platform's load does not spread — it
// comes down two lines of posts under the two sills. Measured on the 20 x 12 card:
//
//   FL-skid-01  z 0.000..0.292    carries 4 posts, each 2.50 in of its 3.50 ON — 1.00 in OFF
//   FL-skid-02  z 5.854..6.146    carries NOTHING — 22.41 in to the nearest member in the model
//   FL-skid-03  z 11.708..12.000  the same 1.00 in off at the other side
//
// and the same at every width, because the two numbers come from different places: the runner from
// `widthFt/(count−1)·i` clamped to half its own thickness, the post from `sillDepth/2`.
//
// Rendered at the base stage it is three timbers lying on the ground with posts standing on two of
// them and the middle one bare. `generateSkids` now takes either a count — a building on skids and
// a tent floor still pass 3, and both were already clean — or the LIST of lines the load comes down.
//
// This was found by a different lens from the overlap audits: which members touch NOTHING. Across
// all fourteen shipped cards every one of 6309 members touches something within an eighth of an
// inch, and across every value the picker's own controls offer there were exactly two hits — a
// basement stair tread, fixed in the pass before this one, and this runner.

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

function axisExtent(m: Member, i: 0 | 1 | 2): [number, number] {
  const h = halfExtents(m);
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[i]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[i]);
  }
  return [Math.min(...v), Math.max(...v)];
}

const SIZES: [number, number][] = [[20, 12], [24, 16], [16, 10], [20, 20]];
const HEIGHTS = [2, 3, 4, 5] as const;

function platform(base: 'skids' | 'piers', lengthFt = 20, widthFt = 12, deckHeightFt = 4) {
  const spec = JSON.parse(JSON.stringify(familyById('platform')!.preset)) as {
    base: string; deckHeightFt: number; dims: { lengthFt: number; widthFt: number };
  };
  spec.base = base;
  spec.deckHeightFt = deckHeightFt;
  spec.dims = { lengthFt, widthFt };
  const members = generateStructure(spec as never).members;
  return {
    members,
    skids: members.filter((m) => m.role === 'skid'),
    posts: members.filter((m) => m.role === 'post' && m.id.startsWith('PF-')),
    label: `platform ${lengthFt} x ${widthFt}, deck ${deckHeightFt} ft, on ${base}`,
  };
}

test('EVERY RUNNER UNDER A PLATFORM CARRIES A POST — none of them lies there for nothing', () => {
  for (const [L, W] of SIZES) {
    for (const h of HEIGHTS) {
      const p = platform('skids', L, W, h);
      assert.ok(p.skids.length > 0, `${p.label}: no runners at all`);
      assert.ok(p.posts.length > 0, `${p.label}: no posts, so nothing to check`);
      for (const s of p.skids) {
        const sz = axisExtent(s, 2);
        const riders = p.posts.filter((m) => {
          const mz = axisExtent(m, 2);
          return Math.min(mz[1], sz[1]) - Math.max(mz[0], sz[0]) > 1e-9;
        });
        assert.ok(riders.length > 0,
          `${p.label}: ${s.id} runs z ${sz[0].toFixed(3)}..${sz[1].toFixed(3)} with no post anywhere `
          + `over it — a runner under nothing`);
      }
    }
  }
});

test('and every post bears on ITS WHOLE FOOT, not two and a half inches of it', () => {
  for (const [L, W] of SIZES) {
    for (const h of HEIGHTS) {
      const p = platform('skids', L, W, h);
      const tops = p.skids.map((s) => axisExtent(s, 1)[1]);
      const skidTop = Math.max(...tops);
      for (const post of p.posts) {
        const pz = axisExtent(post, 2);
        const on = p.skids.find((s) => {
          const sz = axisExtent(s, 2);
          return sz[0] - 1e-9 <= pz[0] && pz[1] <= sz[1] + 1e-9;
        });
        assert.ok(on,
          `${p.label}: ${post.id} sits z ${pz[0].toFixed(3)}..${pz[1].toFixed(3)} and no runner covers `
          + `it — ${p.skids.map((s) => `${axisExtent(s, 2)[0].toFixed(3)}..${axisExtent(s, 2)[1].toFixed(3)}`).join(', ')}`);
        // And it stands ON the runner, not beside it or in it.
        assert.ok(Math.abs(axisExtent(post, 1)[0] - skidTop) < 1e-9,
          `${p.label}: ${post.id}'s foot is at ${axisExtent(post, 1)[0].toFixed(4)} and the runners top `
          + `out at ${skidTop.toFixed(4)}`);
        assert.ok(gap(post, on!) >= -1e-9,
          `${p.label}: ${post.id} is ${(-gap(post, on!) * IN_PER_FT).toFixed(3)} in inside ${on!.id}`);
      }
    }
  }
});

test('and NOTHING in a platform on skids touches nothing — the lens that found it', () => {
  // The audit itself, kept as a contract on this one card. A member with clearance to every other
  // member in the model is either floating or missing the thing it should be fixed to.
  for (const [L, W] of SIZES) {
    const p = platform('skids', L, W, 4);
    for (const m of p.members) {
      let best = Infinity, near = '';
      for (const o of p.members) {
        if (o === m) continue;
        const g = gap(m, o);
        if (g < best) { best = g; near = o.id; }
        if (best <= 1 / IN_PER_FT / 8) break;
      }
      assert.ok(best <= 1 / IN_PER_FT / 8,
        `${p.label}: ${m.id} (${m.role}) is ${(best * IN_PER_FT).toFixed(2)} in clear of everything — `
        + `nearest is ${near}`);
    }
  }
});

test('and what must NOT change: the pier base, a building on skids, and a tent floor', () => {
  // The runner count follows the load, and under a FLOOR DECK the load is spread — the joists cross
  // every runner, so three evenly spaced is right and both of those callers still pass a count.
  for (const id of ['storage-shed', 'tent-floor'] as const) {
    const members = generateStructure(JSON.parse(JSON.stringify(familyById(id)!.preset))).members;
    const skids = members.filter((m) => m.role === 'skid');
    assert.equal(skids.length, 3, `${id}: ${skids.length} runners — a floor deck spreads over three`);
    const joists = members.filter((m) => m.role === 'joist' || m.role === 'rimJoist');
    for (const s of skids) {
      const sz = axisExtent(s, 2);
      const over = joists.filter((j) => {
        const jz = axisExtent(j, 2);
        return Math.min(jz[1], sz[1]) - Math.max(jz[0], sz[0]) > 1e-9;
      });
      assert.ok(over.length > 0, `${id}: ${s.id} carries no joist`);
    }
    // Evenly spread, which is what a count means.
    const mid = skids.map((s) => (axisExtent(s, 2)[0] + axisExtent(s, 2)[1]) / 2).sort((a, b) => a - b);
    assert.ok(Math.abs((mid[1]! - mid[0]!) - (mid[2]! - mid[1]!)) < 1e-9,
      `${id}: runners at ${mid.map((v) => v.toFixed(3)).join(', ')} are not evenly spread`);
  }

  // A pier platform has no runners and its posts are unmoved.
  for (const [L, W] of SIZES) {
    const piers = platform('piers', L, W, 4);
    assert.equal(piers.skids.length, 0, `${piers.label}: grew ${piers.skids.length} runners`);
    const skids = platform('skids', L, W, 4);
    assert.equal(piers.posts.length, skids.posts.length,
      `${piers.label}: ${piers.posts.length} posts against ${skids.posts.length} on skids`);
    for (let i = 0; i < piers.posts.length; i++) {
      assert.equal(axisExtent(piers.posts[i]!, 2)[0], axisExtent(skids.posts[i]!, 2)[0],
        `${piers.label}: the post lines moved between the two bases`);
    }
  }

  // And the shipped card, which is on piers.
  const shipped = generateStructure(JSON.parse(JSON.stringify(familyById('platform')!.preset))).members;
  assert.equal(shipped.filter((m) => m.role === 'skid').length, 0, 'the shipped platform grew runners');
});
