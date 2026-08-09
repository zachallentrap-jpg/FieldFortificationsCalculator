// TIMBER-2 — the bird's mouth (the notch that seats a rafter on its plate).
//
// Every rafter in the model carried `angles: { plumbCut, seatCut }` and nothing ever cut them, so
// a rafter was a straight stick laid at pitch ACROSS the cap plate — several inches of it buried
// inside the plate at every bearing, on every roof in the catalog. This file holds the notch to
// the only definition that means anything on a job site:
//
//   the SEAT is level and bears on the plate's TOP
//   the HEEL is plumb and lands on the plate's OUTER FACE
//   after the cut, no part of the rafter is inside the plate
//
// checked by mapping the cut profile back into world coordinates through the member's own frame —
// so if the frame convention ever changes underneath, this fails rather than quietly lying.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { FAMILY_TABLE } from '../src/timber/catalog';
import { seatCutsFor, seatCutFor, seatProfile, runAxisOf } from '../src/timber/birdsMouth';
import { roofPlanes } from '../src/timber/subsystems/roofFamilies';
import type { Member } from '../src/timber/types';

/** The member frame, spelled out: YXZ with a rafter at [0, ry, rz] gives world = Ry(Rz(local)). */
function toWorld(m: Member, lx: number, ly: number): { y: number; run: number } {
  const rz = m.rotation[2];
  const r = runAxisOf(m)!;
  return {
    y: m.position[1] + lx * Math.sin(rz) + ly * Math.cos(rz),
    run: m.position[r.axis] + r.k * (lx * Math.cos(rz) - ly * Math.sin(rz)),
  };
}

const rafters = (ms: readonly Member[]): Member[] => ms.filter((m) => m.role === 'rafter');
const plates = (ms: readonly Member[]): Member[] => ms.filter((m) => m.role === 'capPlate');

test("every rafter in every shipped family gets a bird's mouth", () => {
  let sawOne = false;
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(fam.preset);
    const rs = rafters(model.members);
    if (rs.length === 0 || plates(model.members).length === 0) continue;
    // Only rafters that run on a cardinal axis bear on a wall plate; a hip's jacks run diagonally
    // and land on a hip rafter instead, which is a different joint and not claimed here.
    const cardinal = rs.filter((m) => runAxisOf(m) !== null && Math.abs(Math.sin(m.rotation[2])) > 1e-9);
    if (cardinal.length === 0) continue;
    sawOne = true;
    const seats = seatCutsFor(model.members);
    const missing = cardinal.filter((m) => !seats.has(m.id));
    assert.equal(
      missing.length,
      0,
      `${fam.id}: ${missing.length}/${cardinal.length} rafters left unnotched (e.g. ${missing[0]?.id})`,
    );
  }
  assert.ok(sawOne, 'no family produced a rafter bearing on a plate — the sweep proved nothing');
});

test('both slopes of a gable are notched, not just the one that climbs with +x', () => {
  // THE MIRRORED SLOPE. A gable's two slopes carry +rz and −rz, so on one of them the heel is the
  // LOW-x end of the notch and on the other it is the HIGH-x end. Measuring the depth at
  // whichever end has the lower x reads zero on the mirrored slope, and half the roof came out
  // uncut. Both signs of pitch must appear, and both must be notched.
  const model = generateStructure(FAMILY_TABLE.find((f) => f.id === 'gp-frame')!.preset);
  const seats = seatCutsFor(model.members);
  const up = rafters(model.members).filter((m) => m.rotation[2] > 1e-9);
  const down = rafters(model.members).filter((m) => m.rotation[2] < -1e-9);
  assert.ok(up.length > 0 && down.length > 0, 'gp-frame should have rafters on both slopes');
  assert.ok(up.every((m) => seats.has(m.id)), 'rafters pitched +rz are unnotched');
  assert.ok(down.every((m) => seats.has(m.id)), 'rafters pitched −rz are unnotched');
  // And the notch is the same cut on both slopes — a roof is symmetric.
  const d = (m: Member): number => Math.round(seats.get(m.id)![0]!.depthFt * 12 * 100) / 100;
  assert.equal(d(up[0]!), d(down[0]!), 'the two slopes were notched to different depths');
});

test('the seat is level on the plate top and the heel is plumb on its outer face', () => {
  const model = generateStructure(FAMILY_TABLE.find((f) => f.id === 'gp-frame')!.preset);
  const seats = seatCutsFor(model.members);
  const caps = plates(model.members);
  let checked = 0;
  for (const m of rafters(model.members)) {
    for (const seat of seats.get(m.id) ?? []) {
    const r = runAxisOf(m)!;
    const hy = m.actual.d / 24;
    const apex = toWorld(m, seat.apexXFt, -hy + seat.depthFt);
    const heelBottom = toWorld(m, seat.heelXFt, -hy);
    const toe = toWorld(m, seat.toeXFt, -hy);
    // The plate this rafter bears on: the one whose outer face the heel lands on.
    const plate = caps.find((p) => Math.abs(Math.abs(heelBottom.run - p.position[r.axis]) - p.actual.d / 24) < 1e-6);
    assert.ok(plate, `${m.id}: the heel cut is not on any cap plate's face (run ${heelBottom.run})`);
    const top = plate.position[1] + plate.actual.w / 24;
    assert.ok(Math.abs(apex.y - top) < 1e-9, `${m.id}: the notch apex ${apex.y} is not on the plate top ${top}`);
    assert.ok(Math.abs(toe.y - top) < 1e-9, `${m.id}: the seat is not level — it exits at ${toe.y}, not ${top}`);
    // And the heel is PLUMB: its two ends are at the same world run, on the plate's outer face.
    assert.ok(Math.abs(apex.run - heelBottom.run) < 1e-9, `${m.id}: the heel cut is not plumb`);
    checked++;
    }
  }
  assert.ok(checked > 20, `only ${checked} rafters checked`);
});

test('no part of a notched rafter is left inside any cap plate', () => {
  // The whole point. Before the notch this failed on every rafter in the catalog.
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(fam.preset);
    const seats = seatCutsFor(model.members);
    if (seats.size === 0) continue;
    const caps = plates(model.members);
    for (const m of rafters(model.members)) {
      const seat = seats.get(m.id);
      if (!seat) continue;
      const r = runAxisOf(m)!;
      for (const p of caps) {
        const half = p.actual.d / 24;
        const top = p.position[1] + p.actual.w / 24;
        for (const [lx, ly] of seatProfile(m, seat)) {
          const w = toWorld(m, lx, ly);
          const insideRun = w.run > p.position[r.axis] - half + 1e-6 && w.run < p.position[r.axis] + half - 1e-6;
          assert.ok(
            !(insideRun && w.y < top - 1e-6),
            `${fam.id} ${m.id}: corner (${w.run.toFixed(3)}, ${w.y.toFixed(3)}) is inside ${p.id}`,
          );
        }
      }
    }
  }
});

test('the seat is exactly one plate wide — which is what fixes the roof plane', () => {
  // THE TEST THAT HOLDS THE ROOF DOWN. The notch is not free: choose the seat length and the
  // rafter's height above the plate follows, and vice versa. The engine used to put the rafter's
  // CENTRE LINE on the plate's outer top corner, which makes the underside cross the plate top
  // 8.7 in inboard on a 4/12 roof — a seat two and a half plates long and a notch past half the
  // rafter. `rafterSeatLiftFt` sets the plane so the seat is one plate, and this is what says so.
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(fam.preset);
    const seats = seatCutsFor(model.members);
    if (seats.size === 0) continue;
    const caps = plates(model.members);
    for (const m of rafters(model.members)) {
      for (const seat of seats.get(m.id) ?? []) {
      const r = runAxisOf(m)!;
      const hy = m.actual.d / 24;
      const heel = toWorld(m, seat.heelXFt, -hy);
      const toe = toWorld(m, seat.toeXFt, -hy);
      const plate = caps.find((p) => Math.abs(Math.abs(heel.run - p.position[r.axis]) - p.actual.d / 24) < 1e-6);
      if (!plate) continue;
      const seatRunFt = Math.abs(toe.run - heel.run);
      assert.ok(
        Math.abs(seatRunFt - plate.actual.d / 12) < 1e-9,
        `${fam.id} ${m.id}: seat runs ${(seatRunFt * 12).toFixed(2)} in over a ${plate.actual.d} in plate`,
      );
      }
    }
  }
});

test('the notch never eats more than a third of the rafter, per the doctrine limit', () => {
  // A seat cut deeper than a third of the depth is a broken rafter, not a joint — the reason the
  // heel height is what sizes a rafter in the first place. If a generator ever pitches a roof so
  // steeply that the notch would exceed it, this is where it is caught.
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(fam.preset);
    const seats = seatCutsFor(model.members);
    for (const m of rafters(model.members)) {
      for (const seat of seats.get(m.id) ?? []) {
      const frac = seat.depthFt / (m.actual.d / 12);
      assert.ok(frac > 0 && frac <= 1 / 3 + 1e-9, `${fam.id} ${m.id}: notch is ${(frac * 100).toFixed(0)}% of the face`);
      }
    }
  }
});

test('the profile is a closed, non-self-intersecting outline with the notch cut out of it', () => {
  const model = generateStructure(FAMILY_TABLE.find((f) => f.id === 'gp-frame')!.preset);
  const seats = seatCutsFor(model.members);
  const m = rafters(model.members).find((x) => seats.has(x.id))!;
  const seat = seats.get(m.id)![0]!;
  const poly = seatProfile(m, seat);
  const hx = m.cutLength / 24;
  const hy = m.actual.d / 24;
  assert.equal(poly.length, 7, 'a seat-cut board is seven corners: four for the board, three for the notch');
  // Walking the underside from −x to +x, the x coordinates must be monotonic — a profile that
  // doubles back is a self-intersecting shape and THREE.Shape triangulates it into a mess.
  const along = poly.slice(0, 5).map(([x]) => x);
  for (let i = 1; i < along.length; i++) assert.ok(along[i]! >= along[i - 1]! - 1e-12, 'profile doubles back on itself');
  // Uncut area minus the notch triangle equals the polygon's own shoelace area.
  const shoelace =
    Math.abs(poly.reduce((s, [x, y], i) => {
      const [nx, ny] = poly[(i + 1) % poly.length]!;
      return s + x * ny - nx * y;
    }, 0)) / 2;
  const notch = (Math.abs(seat.toeXFt - seat.heelXFt) * seat.depthFt) / 2;
  assert.ok(Math.abs(shoelace - (4 * hx * hy - notch)) < 1e-9, 'the notch does not remove the area it claims to');
});

test('nothing is notched where nothing bears — a flat or plumb member is left whole', () => {
  const flat = {
    id: 'X', role: 'rafter', nominal: '2x6', actual: { w: 1.5, d: 5.5 }, cutLength: 120,
    position: [0, 8, 0], rotation: [0, 0, 0], stage: 1,
  } as unknown as Member;
  assert.equal(seatCutFor(flat, 8, 0), null, 'a level member has no seat to cut');
  const plumb = { ...flat, rotation: [0, 0, Math.PI / 2] } as unknown as Member;
  assert.equal(seatCutFor(plumb, 8, 0), null, 'a plumb member has no seat to cut');
  // And a rafter that clears the plate entirely — well above it — is not notched either.
  const clear = { ...flat, position: [0, 40, 0], rotation: [0, 0, 0.3218] } as unknown as Member;
  assert.equal(seatCutFor(clear, 8, 0), null, 'a rafter nowhere near the plate was given a notch');
});

// ── The shed, whose high wall had nothing to bear on ─────────────────────────

/** gp-frame's preset with the roof swapped — the same path the Planning UI's roof picker takes. */
const withRoof = (roof: unknown): Parameters<typeof generateStructure>[0] =>
  ({ ...(FAMILY_TABLE.find((f) => f.id === 'gp-frame')!.preset as object), roof }) as Parameters<typeof generateStructure>[0];

const SHEDS = [
  ['N', 3], ['S', 3], ['E', 6], ['W', 2],
] as const;

test('a shed pony wall carries a PLATE, and its top is where the rafters seat', () => {
  // IT HAD NONE. Thirty-seven studs stood free at the top with the rafters running over their
  // bare ends — and 1.4 in INTO them, because a stud end is not a bearing. There was no plate
  // for the notch machinery to find, so the interpenetration was invisible to every check.
  for (const [highSide, risePer12] of SHEDS) {
    const model = generateStructure(withRoof({ kind: 'shed', risePer12, overhangFt: 1, highSide }));
    const pony = model.members.filter((m) => m.role === 'ponyStud');
    assert.ok(pony.length > 0, `${highSide}: no pony wall at all`);
    const studTop = pony[0]!.position[1] + pony[0]!.cutLength / 24;
    const plate = plates(model.members).find((p) => Math.abs(p.position[1] - p.actual.w / 24 - studTop) < 1e-9);
    assert.ok(plate, `${highSide}: the pony studs stop at ${studTop} with no plate on them`);
    assert.equal(plate.wall, highSide, 'the pony plate belongs to the high wall');
    // Every stud is the same length and every one reaches the plate.
    for (const s of pony) {
      assert.ok(Math.abs(s.position[1] + s.cutLength / 24 - studTop) < 1e-9, `${s.id} does not reach the plate`);
    }
  }
});

test('a shed rafter has TWO bird’s mouths — one at each wall it bears on', () => {
  // Keeping only the deepest notch left the rafter running through the other plate. A shed
  // rafter spans low plate to pony plate and is cut at both, which is why `seatCutsFor` returns
  // every notch rather than one.
  for (const [highSide, risePer12] of SHEDS) {
    const model = generateStructure(withRoof({ kind: 'shed', risePer12, overhangFt: 1, highSide }));
    const seats = seatCutsFor(model.members);
    const rs = rafters(model.members);
    assert.ok(rs.length > 0, `${highSide}: no rafters`);
    for (const m of rs) {
      const cuts = seats.get(m.id);
      assert.ok(cuts && cuts.length === 2, `${highSide} ${m.id}: ${cuts?.length ?? 0} notches, expected 2`);
      // Both are the same cut: a seat one plate wide is one plate wide at either end.
      assert.ok(Math.abs(cuts[0]!.depthFt - cuts[1]!.depthFt) < 1e-9, `${highSide} ${m.id}: the two notches differ`);
    }
  }
});

test('a profile with two notches stays a simple polygon', () => {
  // Two notches laid into one underside must be inserted in x order and must not overlap, or
  // THREE.Shape triangulates a folded outline into a mess of stray triangles.
  for (const [highSide, risePer12] of SHEDS) {
    const model = generateStructure(withRoof({ kind: 'shed', risePer12, overhangFt: 1, highSide }));
    const seats = seatCutsFor(model.members);
    for (const m of rafters(model.members)) {
      const cuts = seats.get(m.id);
      if (!cuts) continue;
      const poly = seatProfile(m, cuts);
      assert.equal(poly.length, 4 + 3 * cuts.length, `${m.id}: ${poly.length} corners for ${cuts.length} notches`);
      // Walking the underside — every corner but the two on the top edge — x never goes backwards.
      const along = poly.slice(0, poly.length - 2).map(([x]) => x);
      for (let i = 1; i < along.length; i++) {
        assert.ok(along[i]! >= along[i - 1]! - 1e-12, `${m.id}: the profile doubles back at corner ${i}`);
      }
    }
  }
});

test('a shallow pitch still gets its notch — the guard is a saw kerf, not an inch', () => {
  // The minimum-depth guard was a full INCH, which is deeper than the notch a shallow roof has:
  // a plate-wide seat at 3/12 is 7/8 in and at 2/12 is 9/16 in. Every shed and every shallow
  // gable had its bird's mouth discarded as noise and went back to running through its plate.
  for (const risePer12 of [2, 3, 4]) {
    for (const kind of ['gable', 'shed'] as const) {
      const roof = kind === 'gable'
        ? { kind, risePer12, overhangFt: 1 }
        : { kind, risePer12, overhangFt: 1, highSide: 'N' as const };
      const model = generateStructure(withRoof(roof));
      const seats = seatCutsFor(model.members);
      const rs = rafters(model.members).filter((m) => runAxisOf(m) !== null);
      assert.ok(rs.length > 0);
      const missing = rs.filter((m) => !seats.has(m.id));
      assert.equal(missing.length, 0, `${kind} ${risePer12}/12: ${missing.length}/${rs.length} rafters unnotched`);
    }
  }
});

test('a shed rafter sits ON its roof plane, so the deck lands on the rafters', () => {
  // The shed generator subtracted a PERPENDICULAR half-depth and added back a VERTICAL one,
  // which corrects nothing: it left every rafter 0.085 in below the plane the deck is placed
  // off, so the sheathing floated a sixteenth of an inch clear of the rafters carrying it.
  for (const [highSide, risePer12] of SHEDS) {
    const spec = withRoof({ kind: 'shed', risePer12, overhangFt: 1, highSide });
    const model = generateStructure(spec);
    const walls = plates(model.members).filter((p) => p.wall !== highSide || p.position[1] < 8.5);
    const plateTopY = Math.max(...walls.map((p) => p.position[1] + p.actual.w / 24));
    const planes = roofPlanes(spec as never, plateTopY);
    assert.equal(planes.length, 1, 'a shed is one plane');
    const plane = planes[0]!;
    for (const m of rafters(model.members)) {
      // Distance from the rafter's centre to the plane, along the plane's own normal.
      const d =
        (m.position[0] - plane.origin[0]) * plane.normal[0] +
        (m.position[1] - plane.origin[1]) * plane.normal[1] +
        (m.position[2] - plane.origin[2]) * plane.normal[2];
      assert.ok(Math.abs(d) < 1e-9, `${highSide} ${m.id}: centre is ${(d * 12).toFixed(4)} in off its own roof plane`);
    }
  }
});
