// Build ORDER, across the whole catalog: not WHERE a member is, but WHEN.
//
// `Member.stage` is a 1-based ordinal into the family's own plan and the scrubber plays it in
// order, so a piece whose stage comes before the thing holding it up hangs in the air on screen
// for as many stages as the gap is wide. The crib bunker had exactly that — its doorway's jambs
// and header were stamped into the ENTRANCE stage while the overhead cover that bears on them
// went on two stages earlier — and that one is pinned in `timber2-bunker-stages.test.ts`.
//
// This is the general guard, and the relation is the whole of it. "Their boxes touch" is not
// "one stands on the other": a ceiling joist bearing on the CAP PLATE is level with the wall
// siding's top and touching it sideways, and a first pass duly reported 70 such pairs per hut as
// out of order. What is asserted here is narrower and true:
//
//   A member whose UNDERSIDE meets another member's TOP, with their plan footprints genuinely
//   overlapping, must have at least one such support built by its own stage.
//
// Not "every support" — the platform's ramp stringer tucks its head under the deck's edge two
// stages after the deck went on, and the deck is carried by the joists under it the whole time.
// A piece is only in the air when NOTHING under it exists yet.
//
// WHAT THIS DOES NOT SEE, stated so the next pass does not read more into a green run than is
// there: a dependency through an END BUTT. The bunker's short cap beams butt between a corner
// post and the doorway's jamb and bear on neither in plan, so this relation skips them entirely
// — which is why the bunker's own defect was caught by a looser scan and needs its own test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies } from '../src/timber/catalog';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];
type P2 = [number, number];

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

function corners(m: Member): V3[] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const out: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    out.push([m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]]);
  }
  return out;
}

/** Convex hull of a member's PLAN projection — monotone chain, counter-clockwise. */
function planHull(pts: P2[]): P2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P2, a: P2, b: P2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P2[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  const hi: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (hi.length >= 2 && cross(hi[hi.length - 2]!, hi[hi.length - 1]!, q) <= 0) hi.pop();
    hi.push(q);
  }
  lo.pop(); hi.pop();
  return [...lo, ...hi];
}

/** How deep two convex plan polygons overlap; <= 0 means they do not. 2D SAT over edge normals. */
function planOverlap(A: P2[], B: P2[]): number {
  let best = Infinity;
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 1e-12) continue;
      const u: P2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
      const pa = A.map((q) => q[0] * u[0] + q[1] * u[1]);
      const pb = B.map((q) => q[0] * u[0] + q[1] * u[1]);
      best = Math.min(best, Math.min(Math.max(...pa) - Math.min(...pb), Math.max(...pb) - Math.min(...pa)));
      if (best <= 0) return best;
    }
  }
  return best;
}

/** The underside meets the top within this; a saw kerf, not a storey. */
const LEVEL_TOL = 0.02;
/** And the two share this much plan, so an arris touching an arris is not a bearing. */
const PLAN_TOL = 0.05;

test('NOTHING IS BUILT BEFORE WHAT HOLDS IT UP, on every card in the catalog', () => {
  let checked = 0;
  let cards = 0;
  for (const f of shippedFamilies()) {
    const members = generateStructure(JSON.parse(JSON.stringify(f.preset))).members;
    const hulls = members.map((m) => planHull(corners(m).map((c) => [c[0], c[2]] as P2)));
    const ys = members.map((m) => {
      const v = corners(m).map((c) => c[1]);
      return [Math.min(...v), Math.max(...v)] as [number, number];
    });
    // Bucket by the level a member's TOP is at, so the scan is a lookup rather than a sweep over
    // every pair on a nine-hundred-member card.
    const byTop = new Map<number, number[]>();
    const key = (y: number): number => Math.round(y / LEVEL_TOL);
    for (const [i, r] of ys.entries()) {
      const k = key(r[1]);
      for (const d of [-1, 0, 1]) {
        const list = byTop.get(k + d) ?? [];
        if (d === 0) list.push(i);
        byTop.set(k + d, list);
      }
    }
    let borne = 0;
    for (const [i, m] of members.entries()) {
      const near = byTop.get(key(ys[i]![0])) ?? [];
      const supports = near.filter((j) => j !== i
        && Math.abs(ys[i]![0] - ys[j]![1]) <= LEVEL_TOL
        && planOverlap(hulls[i]!, hulls[j]!) > PLAN_TOL);
      if (!supports.length) continue; // on the ground, or held some way this relation cannot see
      borne++;
      checked += supports.length;
      const earliest = supports.reduce((a, b) => (members[a]!.stage <= members[b]!.stage ? a : b));
      assert.ok(members[earliest]!.stage <= m.stage,
        `${f.id}: ${m.id} (${m.role}) goes up at stage ${m.stage}, and the first thing under it — `
        + `${members[earliest]!.id} (${members[earliest]!.role}) — not until stage ${members[earliest]!.stage}. `
        + `${members[earliest]!.stage - m.stage} stage(s) of standing on nothing.`);
    }
    assert.ok(borne > 15, `${f.id}: only ${borne} members bear on anything — the scan found nothing to check`);
    cards++;
  }
  assert.ok(cards >= 14, `${cards} shipped cards`);
  assert.ok(checked > 5000, `${checked} bearing pairs across the catalog — the relation has gone blind`);
});
