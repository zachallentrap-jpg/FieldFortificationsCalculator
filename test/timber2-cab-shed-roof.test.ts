// The guard tower cab's shed roof, where the rafters land.
//
// `cab.roof` is a two-way control on the tower card — `roofs: ['pyramid', 'shed']` — and the card
// ships `pyramid`, so the shed branch is one click away and nothing had ever measured it. It is
// hand-rolled inside `tower.ts` rather than going through `roofFamilies.ts`, and the plate it grew
// in an earlier pass of this sweep is the building's pony plate copied by eye:
//
//                              vertical extent   in plan across the wall   rafter underside
//   gp-frame + shed (reference)     1.50 in              3.50 in           on the plate top
//   tower cab + shed                3.50 in              1.50 in           2.649 in BELOW it
//
// Three things, one member.
//
// **THE PLATE WAS ON EDGE.** `[0, 0, 0]` stands a 2x4 up: 3½ in tall, 1½ in across the wall — a
// plate narrower in plan than the rafters crossing it are deep. The building's pony plate has been
// `[-π/2, 0, 0]` since T2. A plate on edge is not a plate.
//
// **AND THE RAFTERS DID NOT BEAR ON IT.** Its top was set to `highY` — the roof plane at the wall
// — but `rafterPlaneDatum` says every plane in the toolkit is stated at the rafter's CENTRE, with
// the covering lifted off it by `rafterHalfFt`. So the plate's top face landed on the rafters'
// centre line and the plate stood half a rafter inside them: 2.987 in of shared wood on all six or
// seven, against the 1.107 in the building's identical joint gives — and that 1.107 is the bird's
// mouth, the notch the plate is supposed to make. Both cab plans, exactly the same figure.
//
// **AND IT STOPPED ON THE POST CENTRES.** `deckHalf * 2` runs centre to centre: 1¾ in of each post
// top left bare, and half of each end rafter — 0.750 in of its 1.500 — hanging off the end of the
// wood it bears on.
//
// The fix reads the plane at the plate's far face (it straddles the cab posts, where the building's
// is flush to a wall) and drops it by the plumb half-depth `rafterSeatLiftFt` already states. The
// cab's joint is now the building's joint to the thousandth, which is what the last test here
// asserts across the two families.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT, LUMBER } from '../src/timber/doctrine';
import { DRESSED } from '../src/timber/types';
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

/** The rafter's UN-NOTCHED underside plane, read at (x, z). The bird's mouth is cut from it. */
function undersideAt(r: Member, x: number, z: number): number {
  const n = rotate(r, [0, 1, 0]);
  const h = halfExtents(r)[1];
  const p: V3 = [r.position[0] - n[0] * h, r.position[1] - n[1] * h, r.position[2] - n[2] * h];
  return p[1] - (n[0] * (x - p[0]) + n[2] * (z - p[2])) / n[1];
}

/** Every combination of the tower card's own controls that reaches the shed cab. */
// The cab plans the registry allows: `cabPlanFt` is stated as 6–8 there, and a later pass
// routed the tower's knobs through that entry — so a 10 asked for here now arrives as an 8
// and the third case was a second run of the second. Two plans is the whole range.
const CABS = [6, 8] as const;
const HEIGHTS = [16, 24] as const;
const OCS = [16, 24] as const;
const FOOTINGS = ['timber-mudsill', 'concrete-pier'] as const;

interface Shed { members: Member[]; plate: Member; rafters: Member[]; posts: Member[]; label: string }

function shedCab(cabPlanFt: number, platformHeightFt = 16, rafterSpacingIn = 16,
  footing: string = 'timber-mudsill'): Shed {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset)) as {
    cab: { roof: string }; cabPlanFt: number; platformHeightFt: number;
    spacing: { rafterSpacingIn: number }; footing: string;
  };
  spec.cab.roof = 'shed';
  spec.cabPlanFt = cabPlanFt;
  spec.platformHeightFt = platformHeightFt;
  spec.spacing.rafterSpacingIn = rafterSpacingIn;
  spec.footing = footing;
  const members = generateStructure(spec as never).members;
  const plates = members.filter((m) => m.role === 'capPlate' && m.id.startsWith('TW-'));
  assert.equal(plates.length, 1,
    `cab ${cabPlanFt} ft: ${plates.length} cap plates over the shed — the high side has one`);
  return {
    members,
    plate: plates[0]!,
    rafters: members.filter((m) => m.role === 'rafter' && m.id.startsWith('TW-')),
    posts: members.filter((m) => m.role === 'post' && m.id.startsWith('TW-')
      && Math.abs(m.position[2]! - plates[0]!.position[2]!) < 0.01
      && axisExtent(m, 1)[1] > axisExtent(plates[0]!, 1)[0] - 1e-6),
    label: `cab ${cabPlanFt} ft, platform ${platformHeightFt} ft, rafters ${rafterSpacingIn}" oc, ${footing}`,
  };
}

/** The building's shed, which is the joint this one is copied from. */
function reference(): Shed {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as { roof: unknown };
  spec.roof = { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' };
  const members = generateStructure(spec as never).members;
  const plate = members.find((m) => m.role === 'capPlate' && m.id.startsWith('RF-'))!;
  return {
    members,
    plate,
    rafters: members.filter((m) => m.role === 'rafter' && m.id.startsWith('RF-')),
    posts: [],
    label: 'gp-frame + shed (the reference)',
  };
}

test('THE CAB’S HIGH PLATE IS LAID FLAT — it is a plate, not a stud on edge', () => {
  const plateNom = LUMBER.plateNominal.value as string;
  const thick = DRESSED[plateNom]!.w / IN_PER_FT;  // 1½ in — up
  const face = DRESSED[plateNom]!.d / IN_PER_FT;   // 3½ in — across the wall
  for (const cab of CABS) {
    for (const footing of FOOTINGS) {
      const { plate, label } = shedCab(cab, 16, 16, footing);
      const y = axisExtent(plate, 1), across = axisExtent(plate, 2);
      assert.ok(Math.abs(y[1] - y[0] - thick) < 1e-9,
        `${label}: the plate stands ${((y[1] - y[0]) * IN_PER_FT).toFixed(2)} in tall where a `
        + `${plateNom} laid flat is ${(thick * IN_PER_FT).toFixed(2)} — it is on edge`);
      assert.ok(Math.abs(across[1] - across[0] - face) < 1e-9,
        `${label}: the plate measures ${((across[1] - across[0]) * IN_PER_FT).toFixed(2)} in across `
        + `the wall where the stock is ${(face * IN_PER_FT).toFixed(2)} wide`);
    }
  }
});

test('and THE RAFTERS BEAR ON IT — its top is their underside, not their centre line', () => {
  // Both directions at once. The defect put the plate top ABOVE the rafters' underside (they ran
  // through it); an arbitrary drop would put it BELOW (they would float over it). It is neither:
  // the un-notched underside meets the plate's top at its up-slope face, and what is left over on
  // the down-slope side is the bird's mouth.
  for (const cab of CABS) {
    for (const ph of HEIGHTS) {
      for (const oc of OCS) {
        const { plate, rafters, label } = shedCab(cab, ph, oc);
        const top = axisExtent(plate, 1)[1];
        const z = axisExtent(plate, 2);
        for (const r of rafters) {
          const x = r.position[0]!;
          const far = undersideAt(r, x, z[1]);
          assert.ok(Math.abs(far - top) < 1e-9,
            `${label}: ${r.id} passes ${((far - top) * IN_PER_FT).toFixed(3)} in `
            + `${far > top ? 'ABOVE' : 'BELOW'} the plate top at the seat — it does not land on it`);
          // And on the near side it dips into the plate, which is the notch and nothing more.
          const near = undersideAt(r, x, z[0]);
          assert.ok(near < top - 1e-9,
            `${label}: ${r.id} clears the plate's near face by ${((near - top) * IN_PER_FT).toFixed(3)} in `
            + '— the seat is not cut into anything');
        }
      }
    }
  }
});

test('and NOTHING HANGS OFF ITS ENDS — every rafter and every post top is on the plate', () => {
  for (const cab of CABS) {
    for (const oc of OCS) {
      const { plate, rafters, posts, label } = shedCab(cab, 16, oc);
      const run = axisExtent(plate, 0);
      assert.ok(posts.length === 2, `${label}: ${posts.length} posts under the high plate`);
      for (const p of posts) {
        const e = axisExtent(p, 0);
        const bare = Math.max(0, run[0] - e[0]) + Math.max(0, e[1] - run[1]);
        assert.ok(bare < 1e-9,
          `${label}: ${(bare * IN_PER_FT).toFixed(3)} in of ${p.id}'s top is bare beyond the plate's end`);
      }
      for (const r of rafters) {
        const e = axisExtent(r, 0);
        const off = Math.max(0, run[0] - e[0]) + Math.max(0, e[1] - run[1]);
        assert.ok(off < 1e-9,
          `${label}: ${(off * IN_PER_FT).toFixed(3)} in of ${r.id}'s ${r.actual.w.toFixed(2)} in width `
          + 'hangs off the end of the plate it bears on');
      }
      // And the plate does not run out past the cab either — it stops on the posts' outer faces.
      const outer = Math.max(...posts.map((p) => axisExtent(p, 0)[1]));
      const inner = Math.min(...posts.map((p) => axisExtent(p, 0)[0]));
      assert.ok(Math.abs(run[0] - inner) < 1e-9 && Math.abs(run[1] - outer) < 1e-9,
        `${label}: the plate runs ${run[0].toFixed(4)}..${run[1].toFixed(4)} over posts standing `
        + `${inner.toFixed(4)}..${outer.toFixed(4)}`);
    }
  }
});

test('and it is THE SAME JOINT the building makes — one bird’s mouth, two families', () => {
  // What makes this one contract rather than two that happen to agree today. The cab's roof is
  // hand-rolled in `tower.ts` and the building's goes through `roofFamilies.ts`; both are at 4 in
  // 12 with the same stock, so the wood they share at the seat has to be the same figure.
  const ref = reference();
  const refWorst = Math.min(...ref.rafters.map((r) => gap(ref.plate, r)));
  assert.ok(refWorst < 0, `${ref.label}: the reference seat cuts nothing — ${refWorst}`);
  for (const cab of CABS) {
    for (const oc of OCS) {
      const { members, plate, rafters, label } = shedCab(cab, 16, oc);
      const worst = Math.min(...rafters.map((r) => gap(plate, r)));
      assert.ok(Math.abs(worst - refWorst) < 1e-9,
        `${label}: the cab's seat takes ${(-worst * IN_PER_FT).toFixed(3)} in out of the rafter and `
        + `the building's identical joint takes ${(-refWorst * IN_PER_FT).toFixed(3)}`);
      // And the rafters are the ONLY thing it shares wood with — a plate dropped onto its seat
      // must not have been dropped into the posts holding it up.
      for (const o of members.filter((m) => m !== plate && m.role !== 'rafter')) {
        assert.ok(gap(plate, o) >= -1e-9,
          `${label}: the plate shares ${(-gap(plate, o) * IN_PER_FT).toFixed(3)} in with `
          + `${o.id} (${o.role})`);
      }
    }
  }
});

test('and what must NOT change: the pyramid cab, and the rafter schedule', () => {
  // The shipped card is `pyramid` and none of this may reach it.
  const shipped = generateStructure(JSON.parse(JSON.stringify(familyById('tower')!.preset))).members;
  assert.equal(shipped.filter((m) => m.role === 'capPlate' && m.id.startsWith('TW-')).length, 0,
    'the pyramid cab grew a high plate — it has four hips meeting at a peak and needs none');
  assert.ok(shipped.filter((m) => m.role === 'hipRafter').length === 4,
    'the pyramid cab lost its hips');

  // And the shed's rafters still come from `spacing.rafterSpacingIn`, not from a hardcoded count.
  for (const cab of CABS) {
    for (const oc of OCS) {
      const { rafters, label } = shedCab(cab, 16, oc);
      const bays = Math.max(1, Math.ceil(cab / (oc / IN_PER_FT)));
      assert.equal(rafters.length, bays + 1,
        `${label}: ${rafters.length} rafters where ${oc}" oc over ${cab} ft gives ${bays + 1}`);
    }
  }
});
