// The guard tower's legs, against the footings they stand on.
//
// A LEG STANDS ON ITS FOOTING; IT IS NOT DRIVEN THROUGH IT. The family offers two footings and
// they put their bearing surface in different places. A concrete pad is poured BELOW grade, so its
// top IS grade and a leg starting at y = 0 lands on it. A timber mudsill is bedded ON the ground —
// that is what a mudsill is for, spreading load over tamped fill rather than a hole — so its top
// is a 6x8's thickness up. The legs started at grade either way, which put 5.86 in of every leg
// inside the sill it was meant to bear on, with the tower standing on the earth between four
// timbers it passed straight through. It is the shipped preset, so it is the tower everyone sees.
//
// The correction moves the LEGS, not the sills: the sills still lie on the ground. Everything the
// legs carry between them — girts, braces, the bays they divide — is then measured over the legs'
// own climb, or the bottom bay's girt and both its diagonals end below the feet they bolt to.

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

/** Every corner of a member in world space. */
function corners(m: Member): V3[] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const out: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    out.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  return out;
}

/** The two ends of a member's CENTRELINE — the honest handle on a raked piece. */
function ends(m: Member): { foot: V3; head: V3 } {
  const d = rotate(m, [m.cutLength / 24, 0, 0]);
  const lo: V3 = [m.position[0] - d[0], m.position[1] - d[1], m.position[2] - d[2]];
  const hi: V3 = [m.position[0] + d[0], m.position[1] + d[1], m.position[2] + d[2]];
  return lo[1] <= hi[1] ? { foot: lo, head: hi } : { foot: hi, head: lo };
}

function tower(over: Record<string, unknown> = {}) {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset)) as Record<string, unknown>;
  Object.assign(spec, over);
  const model = generateStructure(spec as never);
  const legs = model.members.filter((m) => m.role === 'towerLeg');
  return {
    spec,
    model,
    legs,
    deckY: spec.platformHeightFt as number,
    /** The pieces holding the legs up, whichever kind this spec asked for. */
    footings: model.members.filter((m) => m.role === 'footing'
      || (m.role === 'sill' && m.nominal === (TOWER.mudsillNominal.value as string))),
  };
}

const FOOTINGS = ['timber-mudsill', 'concrete-pad'];
const TOL = 1e-9;

test('A LEG STANDS ON ITS FOOTING — on a mudsill it used to be driven through it', () => {
  for (const footing of FOOTINGS) {
    const { legs, footings } = tower({ footing });
    assert.equal(legs.length, 4, `${footing}: four legs`);
    assert.equal(footings.length, 4, `${footing}: one footing under each`);
    for (const leg of legs) {
      const { foot } = ends(leg);
      // The footing this leg stands on is the nearest one in plan — no leg may be orphaned.
      const under = footings
        .map((f) => ({ f, d: Math.hypot(f.position[0] - foot[0], f.position[2] - foot[2]) }))
        .sort((a, b) => a.d - b.d)[0]!;
      assert.ok(under.d < 1, `${footing}: ${leg.id}'s foot is ${under.d.toFixed(2)} ft from any footing`);
      const bearing = Math.max(...corners(under.f).map((p) => p[1]));
      assert.ok(Math.abs(foot[1] - bearing) < TOL,
        `${footing}: ${leg.id} starts at y=${foot[1].toFixed(4)} and ${under.f.id} bears at `
        + `y=${bearing.toFixed(4)} — ${((bearing - foot[1]) * IN_PER_FT).toFixed(2)} in of leg inside its footing`);
    }
  }
});

test('and ALL that is left below the bearing plane is the square end cut', () => {
  // A leg is raked and its foot is cut SQUARE to the rake, so the low corner of that face sits
  // below the centreline by half the face width times the cosine of the pitch — geometry, not
  // slack. Asserting exactly that leaves no room for a leg to be a quarter of an inch low for
  // some other reason, and it holds on both footings even though their legs are at slightly
  // different pitches. (A battered leg's foot wants a LEVEL cut. It does not have one, so the
  // 0.37 in is written down in the sweep rather than asserted here as though it were right.)
  for (const footing of FOOTINGS) {
    const { legs, footings } = tower({ footing });
    const bearing = Math.max(...footings.flatMap((f) => corners(f).map((p) => p[1])));
    for (const leg of legs) {
      // BOTH tilts contribute. This was `½·faceWidth·cos(rz)` while the whole lean lived in rz;
      // a leg whose section is square to the frame carries the across-lean in rx as well, and the
      // deepest corner of its square foot is then the sum of what each axis drops. Same claim —
      // "what is below the bearing plane is the cut and nothing else" — restated for the frame
      // the legs are actually in, and it grew from 0.361 in to 0.526 in when they moved.
      const [rx, , rz] = leg.rotation;
      const want = (leg.actual.d / 24) * Math.abs(Math.cos(rz) * Math.cos(rx))
        + (leg.actual.w / 24) * Math.abs(Math.sin(rx));
      const dip = bearing - Math.min(...corners(leg).map((p) => p[1]));
      assert.ok(Math.abs(dip - want) < 1e-9,
        `${footing}: ${leg.id} reaches ${(dip * IN_PER_FT).toFixed(3)} in below its bearing; a square `
        + `cut at this pitch accounts for ${(want * IN_PER_FT).toFixed(3)} in`);
    }
  }
});

test('THE MUDSILL STILL LIES ON THE GROUND — the legs moved, not the footing', () => {
  // The other way to stop a leg being inside a sill is to bury the sill, and a mudsill bedded
  // 5½ in under the earth is not a mudsill. Its underside is grade.
  const { footings } = tower({ footing: 'timber-mudsill' });
  for (const f of footings) {
    const ys = corners(f).map((p) => p[1]);
    assert.ok(Math.abs(Math.min(...ys)) < TOL, `${f.id} does not sit on grade: its underside is at ${Math.min(...ys).toFixed(4)}`);
    assert.ok(Math.max(...ys) > 0, `${f.id} has no thickness above grade`);
  }
  // And a pad is still poured below it, which is the reason the two datums differ at all.
  const pads = tower({ footing: 'concrete-pad' }).footings;
  for (const p of pads) {
    assert.ok(Math.abs(Math.max(...corners(p).map((c) => c[1]))) < TOL,
      `${p.id} is not poured to grade`);
  }
});

test('nothing the legs carry starts below their feet', () => {
  // The bays are divided over the legs' CLIMB. This one passes on the OLD code as well, because
  // there the feet were at grade and so were the bays; it is the guard on the HALF-DONE fix, and
  // it was run against exactly that — legs lifted onto the sill with the bays still measured over
  // the height above grade — where it reports the bottom brace starting 5.50 in below the foot it
  // is bolted to.
  //
  // Measured on the CENTRELINE ends, because a brace's ends are square-cut on a rake too and its
  // low corner therefore overhangs its own end point. That overhang is a real defect of its own
  // (2.19 in of brace inside a mudsill on this preset) and it is in the sweep; it is not this
  // assertion, which is about where the bay boundaries are.
  for (const footing of FOOTINGS) {
    const { legs, model } = tower({ footing });
    const footY = Math.min(...legs.map((l) => ends(l).foot[1]));
    for (const m of model.members.filter((k) => k.role === 'girt' || k.role === 'towerBrace')) {
      const low = ends(m).foot[1];
      assert.ok(low >= footY - TOL,
        `${footing}: ${m.id} (${m.role}) starts at y=${low.toFixed(4)}, `
        + `${((footY - low) * IN_PER_FT).toFixed(2)} in below the leg feet at y=${footY.toFixed(4)}`);
    }
  }
});

test('THE BATTER THE CARD LOCKS IS THE BATTER THE LEGS HAVE, on either footing', () => {
  // `TOWER.batterPerSideFt` is on the tower card's lock list, and it is stated as a property of the
  // LEGS: "the base is wider than the cab by this much per side". Standing them on a sill without
  // moving the datum the batter is measured over would have quietly made it 1 ft 5½ in.
  const want = TOWER.batterPerSideFt.value as number;
  for (const footing of FOOTINGS) {
    const { legs, deckY } = tower({ footing });
    const feet = legs.map((l) => ends(l).foot);
    const heads = legs.map((l) => ends(l).head);
    const spread = (pts: V3[], i: 0 | 2): number =>
      (Math.max(...pts.map((p) => p[i])) - Math.min(...pts.map((p) => p[i]))) / 2;
    for (const axis of [0, 2] as const) {
      const got = spread(feet, axis) - spread(heads, axis);
      assert.ok(Math.abs(got - want) < 1e-9,
        `${footing}: the legs batter ${got.toFixed(4)} ft per side on axis ${axis}; the card locks ${want}`);
    }
    // And the platform is still where the operator asked for it — the legs got shorter, the
    // tower did not get taller.
    assert.ok(Math.abs(Math.max(...heads.map((h) => h[1])) - deckY) < TOL,
      `${footing}: the legs top out at ${Math.max(...heads.map((h) => h[1])).toFixed(4)}, not the stated ${deckY}`);
  }
});

test('the tower footprint in plan is the same whichever footing carries it', () => {
  // The batter is re-datumed, not re-scaled: a leg's foot is `batterPerSideFt` outside the cab
  // wherever that foot sits, so the ground the tower occupies does not move when the footing
  // changes. Anything sited to the base square — the ladder, the access gap — depends on this.
  const plan = (footing: string): string => {
    const { legs } = tower({ footing });
    // Rounded first, then `+ 0`: a corner at exactly zero comes back as -1.4e-16 through a -45°
    // rotation, which `toFixed` renders as "-0.000000" and a string compare then calls a moved
    // tower. The rounding is the comparison tolerance; the `+ 0` kills the sign on the zero.
    const q = (v: number): string => (Math.round(v * 1e6) / 1e6 + 0).toFixed(6);
    return legs.map((l) => ends(l).foot).map((p) => `${q(p[0])},${q(p[2])}`).sort().join(' ');
  };
  assert.equal(plan('timber-mudsill'), plan('concrete-pad'));
});
