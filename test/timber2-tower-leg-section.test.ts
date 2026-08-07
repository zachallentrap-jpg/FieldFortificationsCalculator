// The guard tower's legs: which way round the timber is.
//
// A LEG'S SECTION IS SQUARE TO THE FRAME. The legs were yawed onto their lean direction and then
// pitched up — which puts the AXIS exactly where it belongs and takes the SECTION with it. A corner
// leg leans diagonally, so `yaw` came out at 45° and the 6x6 was set diamond-wise: its foot corners
// measured (±0.323, ∓0.001) ft, presenting its 7¾-in diagonal along the tower's own axes with an
// arris facing every girt. The girts and braces are square to the frame and are bolted to the legs,
// and you cannot bolt a flat 2x6 to an edge. On screen it is a post with a line down its middle and
// a step where every girt lands.
//
// Under YXZ the yaw is the term that spins the section, so the lean has to be done with the other
// two. What is asserted here is the consequence, not the arithmetic: the section may be tilted by
// the leg's OWN LEAN and by nothing else — 5½° on this tower, where a yaw gave 45°.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { TOWER, IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];

/** Rotate a local vector by a member's YXZ euler (R = Ry·Rx·Rz), the scene's convention. */
function rotate(m: Member, v: V3): V3 {
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

const FOOTINGS = ['timber-mudsill', 'concrete-pad'];

function tower(footing: string) {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset)) as Record<string, unknown>;
  spec.footing = footing;
  const model = generateStructure(spec as never);
  const legs = model.members.filter((m) => m.role === 'towerLeg');
  return { model, legs, girts: model.members.filter((m) => m.role === 'girt') };
}

/** A leg's three axes and the two ends of its centreline. */
function legFrame(m: Member) {
  const ax = rotate(m, [1, 0, 0]);
  const half = m.cutLength / 24;
  const at = (s: number): V3 =>
    [m.position[0] + ax[0] * s * half, m.position[1] + ax[1] * s * half, m.position[2] + ax[2] * s * half];
  const foot = at(-1), head = at(1);
  return {
    ax,
    ay: rotate(m, [0, 1, 0]),
    az: rotate(m, [0, 0, 1]),
    foot: foot[1] <= head[1] ? foot : head,
    head: foot[1] <= head[1] ? head : foot,
    /** The lean: how far the axis is off plumb. Nothing about the section may exceed it. */
    lean: Math.acos(Math.min(1, Math.abs(ax[1]))),
  };
}

/** How far a unit vector's PLAN direction is from the nearer of the two world plan axes. */
function offAxisPlan(v: V3): number {
  const r = Math.hypot(v[0], v[2]);
  if (r < 1e-9) return 0;
  const a = Math.abs(Math.atan2(v[2], v[0])) % (Math.PI / 2);
  return Math.min(a, Math.PI / 2 - a);
}

test("A LEG'S SECTION IS SQUARE TO THE FRAME — it used to be set diamond-wise", () => {
  for (const footing of FOOTINGS) {
    const { legs } = tower(footing);
    assert.equal(legs.length, 4, `${footing}: four legs`);
    for (const leg of legs) {
      const f = legFrame(leg);
      assert.ok(f.lean > 1e-3, `${footing}: ${leg.id} is not battered at all — nothing to get wrong`);
      for (const [name, v] of [['face', f.ay], ['edge', f.az]] as const) {
        const off = offAxisPlan(v);
        assert.ok(off <= f.lean + 1e-9,
          `${footing}: ${leg.id}'s ${name} lies ${(off * 180 / Math.PI).toFixed(2)}° off the frame's axes; `
          + `the leg's own lean accounts for ${(f.lean * 180 / Math.PI).toFixed(2)}° `
          + '(45° is the yaw putting the section on its diagonal)');
      }
    }
  }
});

test('so the plan footprint is the SECTION, not its diagonal', () => {
  // The consequence a person sees. A 6x6 set square covers 5½ in of the tower's own axes; set
  // diamond-wise it covers 7¾, which is what made the corner read as a diamond.
  for (const footing of FOOTINGS) {
    for (const leg of tower(footing).legs) {
      const f = legFrame(leg);
      const hy = leg.actual.d / 24, hz = leg.actual.w / 24;
      const spanX = 2 * (hy * Math.abs(f.ay[0]) + hz * Math.abs(f.az[0]));
      const spanZ = 2 * (hy * Math.abs(f.ay[2]) + hz * Math.abs(f.az[2]));
      const diagonal = Math.hypot(leg.actual.d, leg.actual.w) / IN_PER_FT;
      for (const [axis, span] of [['x', spanX], ['z', spanZ]] as const) {
        assert.ok(span < diagonal - 1 / IN_PER_FT,
          `${footing}: ${leg.id} covers ${(span * IN_PER_FT).toFixed(3)} in of ${axis}; a ${leg.nominal}'s `
          + `diagonal is ${(diagonal * IN_PER_FT).toFixed(2)} in and its face is ${leg.actual.d}`);
      }
      // And it is not narrower than the stock either — the section is not being skewed away.
      assert.ok(Math.max(spanX, spanZ) >= Math.max(leg.actual.d, leg.actual.w) / IN_PER_FT - 1e-9,
        `${footing}: ${leg.id} covers less than its own face width`);
    }
  }
});

test('A GIRT RUNS STRAIGHT AT A LEG FACE, not at an arris', () => {
  // What the whole thing is for: `nailing` on every leg reads "bolted at every girt". A girt is
  // square to the frame; a leg set on its diagonal turns both its faces 45° away from it, so the
  // girt's end met an edge. The girt's run must be square to the face it lands on, to within the
  // leg's own lean.
  for (const footing of FOOTINGS) {
    const { legs, girts } = tower(footing);
    assert.ok(girts.length >= 4, `${footing}: the tower is girted`);
    for (const g of girts) {
      const run = rotate(g, [1, 0, 0]);
      // The leg this girt ends at, and the face it approaches: whichever of the leg's two section
      // axes the girt runs most nearly straight at.
      for (const leg of legs) {
        const f = legFrame(leg);
        const best = Math.max(
          Math.abs(run[0] * f.ay[0] + run[2] * f.ay[2]),
          Math.abs(run[0] * f.az[0] + run[2] * f.az[2]),
        );
        assert.ok(best >= Math.cos(f.lean) - 1e-9,
          `${footing}: ${g.id} meets ${leg.id} at ${(Math.acos(Math.min(1, best)) * 180 / Math.PI).toFixed(2)}° `
          + 'off square — a diamond-set post gives 45°');
      }
    }
  }
});

test('and the leg still runs corner to corner — the fix moved the timber, not the tower', () => {
  // The rotation changed; the LINE must not have. Each leg's centreline still starts on the base
  // square and finishes on the cab square, `batterPerSideFt` apart per side.
  const want = TOWER.batterPerSideFt.value as number;
  for (const footing of FOOTINGS) {
    const { legs } = tower(footing);
    const feet = legs.map((l) => legFrame(l).foot);
    const heads = legs.map((l) => legFrame(l).head);
    const spread = (pts: V3[], i: 0 | 2): number =>
      (Math.max(...pts.map((p) => p[i])) - Math.min(...pts.map((p) => p[i]))) / 2;
    for (const axis of [0, 2] as const) {
      assert.ok(Math.abs((spread(feet, axis) - spread(heads, axis)) - want) < 1e-9,
        `${footing}: the legs batter ${(spread(feet, axis) - spread(heads, axis)).toFixed(5)} ft per side on `
        + `axis ${axis}; the card locks ${want}`);
    }
    // Each foot is square under its own head — a leg leans toward the centre, not sideways.
    for (const l of legs) {
      const f = legFrame(l);
      assert.ok(Math.abs(Math.abs(f.head[0] - f.foot[0]) - Math.abs(f.head[2] - f.foot[2])) < 1e-9,
        `${footing}: ${l.id} leans ${(f.head[0] - f.foot[0]).toFixed(4)} in x and `
        + `${(f.head[2] - f.foot[2]).toFixed(4)} in z — a corner leg leans equally in both`);
    }
  }
});
