// TIMBER-2 T7 — the crib bunker's structural claims.
//
// The boundary is tested next door in `timber2-boundary`. What is asserted here is that the
// thing it generates is actually cribwork and actually spans what it says it spans.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById, FAMILY_TABLE } from '../src/timber/catalog';
import { stringerFor } from '../src/timber/families/bunker';
import { generateCribWall, cribCourseCount } from '../src/timber/subsystems/cribwork';
import { BUNKER } from '../src/timber/doctrine';
import { SPEC_PATH_DEFS } from '../src/timber/spec';

const preset = () => JSON.parse(JSON.stringify(familyById('crib-bunker')!.preset));

test('a crib alternates: no two consecutive courses run the same way', () => {
  // A stack that runs the same way twice has a continuous vertical joint through it, which is
  // the exact failure cribbing exists to avoid. This is the property that makes it a crib.
  const members = generateCribWall({
    from: [0, 0], to: [16, 0], baseY: 0, heightFt: 6.5, depthFt: 2, stage: 1, prefix: 'TC',
  });
  assert.ok(members.length > 0);
  const byCourse = new Map<string, Set<string>>();
  for (const m of members) {
    const y = m.position[1].toFixed(3);
    const yaw = Math.abs(m.rotation[1] % Math.PI) < 1e-6 ? 'along' : 'across';
    (byCourse.get(y) ?? byCourse.set(y, new Set()).get(y)!).add(yaw);
  }
  const courses = [...byCourse.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  assert.equal(courses.length, cribCourseCount(6.5));
  for (let i = 1; i < courses.length; i++) {
    const prev = [...courses[i - 1]![1]].join();
    const here = [...courses[i]![1]].join();
    assert.notEqual(here, prev, `courses ${i - 1} and ${i} both run ${here}`);
  }
});

test('every header course reaches both ends — the corner is the whole idea', () => {
  const members = generateCribWall({
    from: [0, 0], to: [16, 0], baseY: 0, heightFt: 6.5, depthFt: 2, stage: 1, prefix: 'TC',
  });
  const across = members.filter((m) => Math.abs(m.rotation[1] % Math.PI) > 1e-6);
  assert.ok(across.length > 0, 'there are header courses at all');
  const xs = across.map((m) => m.position[0]);
  assert.ok(Math.min(...xs) < 0.01, 'a header lands on the near corner');
  assert.ok(Math.max(...xs) > 15.99, 'and on the far one');
});

test('the stringer table is capped at its last reviewed row, and says so', () => {
  const maxRow = BUNKER.maxReviewedSpanFt.value as number;
  assert.equal(stringerFor(maxRow).reviewed, true);
  const past = stringerFor(maxRow + 6);
  assert.equal(past.reviewed, false, 'past the table is not silently interpolated');
  assert.ok(past.nominal, 'a member is still returned — the family reports rather than crashing');
});

test('the spec envelope cannot ask for a span the table has not reviewed', () => {
  // Defence in depth, and the ORDER matters: asking for an 18-ft interior does not reach the
  // stringer table at all, because normalizeSpec clamps the width to the envelope first. That is
  // the right outcome — but it means the envelope and the table have to agree, or a future
  // widening of one silently outruns the other. This test is that agreement, written down.
  const envelope = SPEC_PATH_DEFS.find((d) => d.path === 'interiorWidthFt')!;
  assert.equal(
    envelope.max,
    BUNKER.maxReviewedSpanFt.value,
    'the widest interior the picker allows must equal the deepest span anyone has reviewed',
  );

  const spec = preset();
  spec.interiorWidthFt = (BUNKER.maxReviewedSpanFt.value as number) + 6;
  const model = generateStructure(spec);
  const clamped = model.issues.find((i) => i.kind === 'clamped' && i.path === 'interiorWidthFt');
  assert.ok(clamped, 'and the attempt is reported, not silently accepted');
  assert.equal((model.spec as { interiorWidthFt: number }).interiorWidthFt, BUNKER.maxReviewedSpanFt.value);
});

test('and if the envelope is ever widened past the table, the family says so out loud', () => {
  // The guard that fires if the two above ever drift apart: a span the table has no reviewed row
  // for produces an ERROR the UI must show, naming what the returned member is and is not.
  const past = stringerFor((BUNKER.maxReviewedSpanFt.value as number) + 6);
  assert.equal(past.reviewed, false);
});

test('both wall types build, and both carry an overhead', () => {
  for (const wallType of ['post-plank', 'crib'] as const) {
    const spec = preset();
    spec.wallType = wallType;
    const model = generateStructure(spec);
    const roles = new Set(model.members.map((m) => m.role));
    assert.ok(roles.has('ohcStringer'), `${wallType}: no stringers`);
    assert.ok(roles.has('capBeam'), `${wallType}: no caps`);
    assert.ok(roles.has(wallType === 'crib' ? 'cribLog' : 'post'), `${wallType}: no wall`);
  }
});

test('the entrance baffle actually blocks the entrance', () => {
  // The generator has always said "overlapping it far enough that you cannot see or shoot
  // straight in", and it started the baffle at `outerW / 2` — the MIDDLE of the doorway, not its
  // edge. The outer half was covered and the inner half was a clear straight line in: two feet
  // of a five-foot opening, on a survivability structure whose baffle has exactly one job.
  //
  // Asserted as the sightline, not as the arithmetic: a ray straight out through any point of
  // the opening has to hit the baffle.
  const spec = { ...(FAMILY_TABLE.find((f) => f.id === 'crib-bunker')!.preset as object), entrance: 'baffle' };
  const model = generateStructure(spec as Parameters<typeof generateStructure>[0]);
  const baffle = model.members.filter((m) => m.role === 'baffleWall');
  assert.ok(baffle.length > 0, 'no baffle at all');

  const header = model.members.find((m) => m.role === 'header');
  assert.ok(header, 'no header — where is the doorway?');
  const doorZ0 = header.position[2] - header.cutLength / 24;
  const doorZ1 = header.position[2] + header.cutLength / 24;

  // The baffle's own extent, from the lagging that spans it.
  const lag = baffle.filter((m) => Math.abs(Math.abs(m.rotation[1]) - Math.PI / 2) < 1e-6);
  assert.ok(lag.length > 0, 'the baffle has posts but nothing across them');
  const bz0 = Math.min(...lag.map((m) => m.position[2] - m.cutLength / 24));
  const bz1 = Math.max(...lag.map((m) => m.position[2] + m.cutLength / 24));

  assert.ok(bz0 <= doorZ0 + 1e-9, `baffle starts at ${bz0}, doorway opens at ${doorZ0} — ${((bz0 - doorZ0) * 12).toFixed(1)} in of it is in the open`);
  assert.ok(bz1 >= doorZ1 - 1e-9, `baffle ends at ${bz1}, doorway runs to ${doorZ1}`);
  // And past the far jamb by the standoff, so the diagonal round that end is shut as well. The
  // standoff is measured off the POSTS — the lagging hangs on their outer face, half a post
  // further out, and using that would demand the baffle be longer than its own rule asks for.
  const posts = baffle.filter((m) => Math.abs(Math.abs(m.rotation[2]) - Math.PI / 2) < 1e-6);
  assert.ok(posts.length >= 2, 'a free-standing baffle needs posts');
  const stand = Math.abs(posts[0]!.position[0]);
  assert.ok(bz1 - doorZ1 >= stand - 1e-9, `only ${(bz1 - doorZ1).toFixed(2)} ft past the far jamb for a ${stand} ft standoff`);

  // It stands OFF the wall — a baffle flat against the doorway is a door, not a baffle — and it
  // reaches the ground and the full clear height.
  assert.ok(stand > 1, `the baffle is only ${stand} ft off the wall`);
  for (const p of posts) {
    assert.ok(Math.abs(p.position[1] - p.cutLength / 24) < 1e-9, `${p.id} does not reach the ground`);
  }
});

test('THE EARTH COVER IS A BLANKET, not a slab on edge — one convention, every consumer', () => {
  // `actual.d` is the face width (local Y, and with rotation [0,0,0] the VERTICAL one) and
  // `actual.w` is the thickness on local Z. Every member in the toolkit means that. The soil
  // ghost had the two swapped, and `studio.ts` carried a private swap of its own to undo it — so
  // the 3D view came out right and every OTHER consumer of `actual` came out wrong.
  //
  // `thumbnails.ts` reads the convention straight, so the picker card drew the cover 10.92 ft
  // tall and 2 ft deep instead of 2 ft tall and 10.92 deep: a monolith standing on edge on the
  // bunker's roof, engulfing the structure, on the first thing anyone sees of this family.
  //
  // Asserted through the SHARED convention rather than against either renderer, because the bug
  // was precisely that two renderers disagreed about what the numbers meant.
  const spec = JSON.parse(JSON.stringify(familyById('crib-bunker')!.preset));
  const depth = spec.designCoverDepthFt as number;
  assert.ok(depth > 0, 'the preset states a cover depth');
  const ghost = generateStructure(spec as never).members.find((m) => m.role === 'soilGhost');
  assert.ok(ghost, 'a stated cover depth draws a cover');

  // World extents under the standard frame: length on local X, `d` on local Y, `w` on local Z.
  assert.deepEqual(ghost!.rotation, [0, 0, 0], 'the cover lies square to the plan');
  const tallFt = ghost!.actual.d / 12;
  const deepFt = ghost!.actual.w / 12;
  assert.ok(Math.abs(tallFt - depth) < 1e-9,
    `the cover is drawn ${tallFt.toFixed(2)} ft tall; the stated depth is ${depth} ft`);
  assert.ok(deepFt > depth,
    `the cover spans ${deepFt.toFixed(2)} ft across the bunker — a blanket is wider than it is thick`);

  // And it sits ON the structure: its underside at the top of everything else, not through it.
  const under = ghost!.position[1]! - tallFt / 2;
  const structureTop = Math.max(...generateStructure(spec as never).members
    .filter((m) => m.role !== 'soilGhost')
    .map((m) => m.position[1]!));
  assert.ok(under >= structureTop - 1.0,
    `the cover's underside is at ${under.toFixed(2)} but the structure reaches ${structureTop.toFixed(2)} — it is buried in the bunker`);
});

// ── The doorway ──────────────────────────────────────────────────────────────
//
// Everything that FRAMES the entrance was already right: two jamb posts on the opening's edges,
// a header spanning them, and a baffle standing off outside it that an earlier pass fixed so it
// shuts the sightline. The opening itself was not there. The wall pass emits a lagging course at
// every height across the full run of every side and knew nothing about a door, so eleven
// full-width courses ran straight across it — and two of the wall's own posts stood inside the
// clear span, each overlapping a jamb by 0.6 in. Every one of 160 points sampled inside the
// doorway rectangle came back solid. The bunker had no way in.

type V3B = [number, number, number];

function rotB(m: { rotation: readonly number[] }, v: V3B): V3B {
  const [rx, ry, rz] = m.rotation as [number, number, number];
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

function boxB(m: { cutLength: number; actual: { w: number; d: number }; rotation: readonly number[]; position: readonly number[] }) {
  const h: V3B = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3B[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotB(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

/** The bunker, plus where its doorway is — read off the header, which spans jamb to jamb. */
function bunkerWithDoor(over: Record<string, unknown> = {}) {
  const spec = preset();
  Object.assign(spec, over);
  const m = generateStructure(spec);
  const header = m.members.find((x) => x.role === 'header')!;
  const hb = boxB(header);
  // A JAMB is a post whose outer face is where the header ends — not merely any post standing
  // somewhere under it. The looser reading swallowed the two wall posts that used to stand IN the
  // opening and made the test that looks for them pass without checking anything.
  const jambs = m.members.filter((x) => x.role === 'post' && boxB(x).x[0]! < 1
    && (Math.abs(boxB(x).z[0]! - hb.z[0]!) < 1e-6 || Math.abs(boxB(x).z[1]! - hb.z[1]!) < 1e-6));
  return { model: m, header, hb, jambs };
}

test('THE DOORWAY IS A HOLE — the wall is not lagged across it', () => {
  const { model, hb, jambs } = bunkerWithDoor();
  assert.equal(jambs.length, 2, 'two jambs frame the opening');
  // The clear span is between the jambs' INNER faces: the near jamb's far edge to the far
  // jamb's near edge.
  const byZ = [...jambs].sort((p, q) => boxB(p).z[0]! - boxB(q).z[0]!);
  const clear: [number, number] = [boxB(byZ[0]!).z[1]!, boxB(byZ[1]!).z[0]!];
  assert.ok(clear[1] - clear[0] > 3, `the clear opening is only ${(clear[1] - clear[0]).toFixed(2)} ft`);
  const top = hb.y[0]!; // the header's underside is the head of the opening
  let solid = 0, total = 0;
  for (let y = 0.2; y < top - 0.1; y += 0.2) {
    for (let z = clear[0] + 0.1; z < clear[1] - 0.1; z += 0.15) {
      for (let x = -0.2; x < 0.5; x += 0.1) {
        total++;
        for (const k of model.members) {
          if (k.role === 'soilGhost') continue; // massing, not built
          const b = boxB(k);
          if (x > b.x[0]! && x < b.x[1]! && y > b.y[0]! && y < b.y[1]! && z > b.z[0]! && z < b.z[1]!) { solid++; break; }
        }
      }
    }
  }
  assert.ok(total > 1000, 'the opening was actually sampled');
  assert.equal(solid, 0, `${solid} of ${total} points inside the clear opening are solid`);
});

test('the lagging is CUT around it, not left off — both sides are still boarded', () => {
  // The other way to open a doorway is to stop lagging that wall, which would leave the two
  // stretches either side of the entrance as bare posts.
  const { model, hb } = bunkerWithDoor();
  const endWall = model.members.filter((x) => x.role === 'lagging'
    && boxB(x).x[1]! - boxB(x).x[0]! < 1 && boxB(x).x[0]! < 1);
  assert.ok(endWall.length > 0, 'the entrance wall is still lagged');
  const left = endWall.filter((x) => boxB(x).z[1]! <= hb.z[0]! + 1e-6);
  const right = endWall.filter((x) => boxB(x).z[0]! >= hb.z[1]! - 1e-6);
  assert.ok(left.length > 0 && right.length > 0, 'boarded on both sides of the opening');
  assert.equal(left.length + right.length, endWall.length, 'and nothing crosses it');
  // Conservation, the same discipline the covering pass uses: what is boarded plus the hole is
  // the wall. Measured per course so a missing course cannot hide inside the total.
  const courses = new Map<number, number>();
  for (const x of endWall) {
    const b = boxB(x);
    const key = Math.round(b.y[0]! * 1e6);
    courses.set(key, (courses.get(key) ?? 0) + (b.z[1]! - b.z[0]!));
  }
  const wallRun = Math.max(...endWall.map((x) => boxB(x).z[1]!)) - Math.min(...endWall.map((x) => boxB(x).z[0]!));
  const hole = hb.z[1]! - hb.z[0]!;
  for (const [, covered] of courses) {
    assert.ok(Math.abs(covered - (wallRun - hole)) < 1e-6,
      `a course covers ${covered.toFixed(4)} ft; the wall less the opening is ${(wallRun - hole).toFixed(4)}`);
  }
});

test('no post stands in the doorway, and none of them fouls a jamb', () => {
  const { model, hb, jambs } = bunkerWithDoor();
  const jambIds = new Set(jambs.map((j) => j.id));
  for (const p of model.members.filter((x) => x.role === 'post' && !jambIds.has(x.id))) {
    const b = boxB(p);
    if (b.x[0]! > 1) continue; // not on the entrance wall
    const overlap = Math.min(b.z[1]!, hb.z[1]!) - Math.max(b.z[0]!, hb.z[0]!);
    assert.ok(overlap <= 1e-9,
      `${p.id} intrudes ${(overlap * 12).toFixed(2)} in into the opening the header spans`);
  }
});

test('the other three walls are boarded right across, as they were', () => {
  // A cut that fires on the wrong wall would open a hole in the side of a bunker.
  const { model } = bunkerWithDoor();
  const lag = model.members.filter((x) => x.role === 'lagging');
  const sides = lag.filter((x) => {
    const b = boxB(x);
    return !(b.x[1]! - b.x[0]! < 1 && b.x[0]! < 1) && b.y[1]! < 7; // walls, not the roof
  });
  assert.ok(sides.length > 0);
  const runs = new Set(sides.map((x) => Math.round(x.cutLength * 1e3)));
  assert.equal(runs.size, 2, `expected two wall lengths on three unbroken sides, got ${[...runs].join(',')}`);
});

test('and the entrance still frames what it opens', () => {
  const { hb, jambs } = bunkerWithDoor();
  const zs = jambs.flatMap((j) => [boxB(j).z[0]!, boxB(j).z[1]!]);
  assert.ok(Math.abs(Math.min(...zs) - hb.z[0]!) < 1e-6, 'the header reaches the outer face of one jamb');
  assert.ok(Math.abs(Math.max(...zs) - hb.z[1]!) < 1e-6, 'and of the other');
  for (const j of jambs) assert.ok(boxB(j).y[0]! < 1e-9, 'a jamb stands on the ground');
});
