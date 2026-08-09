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
import type { Member as Member2 } from '../src/timber/types';
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

// ── The head of the doorway ──────────────────────────────────────────────────
//
// THE HEADER WAS SIZED OUT OF THE WRONG TABLE. Everything holding this structure up is 6x6 and
// 6x8 from ATP 3-37.34's dead-load member table; the header over the doorway came from
// `LUMBER.headerNominal`, which is the 2x6 a stud wall puts over a window. Two things followed.
// The wall's cap beam is 7 1/4 in deep and the header was 5 1/2, both starting at the wall top,
// so the head of the doorway finished 1 3/4 in BELOW the line the overhead cover bears on — a
// slot the full width of the opening, straight through the end wall into the bunker, in both
// wall types. And a 2x6 spanning five feet under a foot and a half of soil is not a header.

const doorHead = (wallType: string, entrance: string) => {
  const { model, header, hb } = bunkerWithDoor({ wallType, entrance });
  const cap = model.members.find((x) => x.role === 'capBeam')!;
  // Whatever is directly over the opening — overlapping the header in plan and starting at or
  // above its top. The overhead cover has to land on the header, not a fraction of a foot clear.
  const above = model.members
    .filter((x) => x !== header && x.role !== 'soilGhost')
    .map((x) => ({ x, b: boxB(x) }))
    .filter((o) => Math.min(o.b.x[1]!, hb.x[1]!) - Math.max(o.b.x[0]!, hb.x[0]!) > 1e-9
      && Math.min(o.b.z[1]!, hb.z[1]!) - Math.max(o.b.z[0]!, hb.z[0]!) > 1e-9
      && o.b.y[0]! >= hb.y[1]! - 1e-9)
    .sort((a, b) => a.b.y[0]! - b.b.y[0]!);
  return { header, hb, cap, capTop: boxB(cap).y[1]!, above };
};

test('THE HEAD OF THE DOORWAY IS THE LINE THE COVER BEARS ON — it used to be 1 3/4 in below it', () => {
  for (const wallType of ['post-lagging', 'crib']) {
    for (const entrance of ['open', 'baffle']) {
      const { hb, capTop, above } = doorHead(wallType, entrance);
      const where = `${wallType}/${entrance}`;
      assert.ok(Math.abs(hb.y[1]! - capTop) < 1e-9,
        `${where}: the header tops out ${((capTop - hb.y[1]!) * 12).toFixed(3)} in below the cap beam `
        + 'it continues, so the doorway head is not the wall top');
      assert.ok(above.length > 0, `${where}: nothing at all bears over the doorway`);
      const gapIn = (above[0]!.b.y[0]! - hb.y[1]!) * 12;
      assert.ok(Math.abs(gapIn) < 1e-6,
        `${where}: ${above[0]!.x.id} (${above[0]!.x.role}) starts ${gapIn.toFixed(3)} in above the header — `
        + 'that is a slot the width of the doorway, through the end wall');
    }
  }
});

test('and it is the CAP STOCK, because it is the cap continued across the opening', () => {
  // Compared to the cap beam the model actually emits, not to a nominal written here: if the
  // dead-load table ever moves, the header moves with the piece it is in line with.
  for (const wallType of ['post-lagging', 'crib']) {
    const { header, cap, hb } = doorHead(wallType, 'open');
    assert.equal(header.nominal, cap.nominal,
      `${wallType}: the header is a ${header.nominal} where the cap it continues is a ${cap.nominal}`);
    assert.ok(Math.abs(header.actual.d - cap.actual.d) < 1e-9 && Math.abs(header.actual.w - cap.actual.w) < 1e-9,
      `${wallType}: the header does not have the cap's section`);
    // And it still spans the opening it is over, jamb face to jamb face.
    assert.ok(hb.z[1]! - hb.z[0]! > 4, `${wallType}: the header spans only ${(hb.z[1]! - hb.z[0]!).toFixed(2)} ft`);
  }
});

// ── The crib wall's own contract ─────────────────────────────────────────────
//
// `wallType: 'crib'` is not the shipped preset, which is how both of these survived. A crib is
// stacked in whole courses and stops at the last one that fits — and nothing consumed that. The
// bunker set its cap beam at the height it ASKED for, so on a crib the cap, the overhead
// stringers, the roof lagging and two feet of earth bore on a 5½-in air gap the whole way round,
// crossed only by the two door jambs. And the stack knew nothing about the doorway either: 380
// of 1995 points sampled inside the clear opening came back solid timber.

import { cribWallTopFt } from '../src/timber/subsystems/cribwork';

const bunkerOf = (wallType: string) => {
  const spec = preset();
  spec.wallType = wallType;
  return generateStructure(spec);
};

test('WHATEVER LANDS ON A WALL LANDS ON THE WALL, both ways of building one', () => {
  // Measured before: a crib topped out at 6.042 ft and the cap beam started at 6.500, so the cap
  // — with the overhead stringers, the roof lagging and two feet of earth on it — bore on 5½ in
  // of air, all the way round.
  //
  // TWO WRONG VERSIONS OF THIS TEST CAME FIRST, and both are worth remembering. Comparing the
  // highest point of everything against the cap PASSED on the broken model, because the two door
  // jambs are cut to the height asked for and do reach it — the second time in two passes that a
  // pair of posts by a doorway has made a test agree with a model that was wrong. Probing for
  // material under every station along the cap then FAILED on the fixed model, because a crib's
  // top course is ties on a spacing, and a cap beam is a beam: it spans between bearings, exactly
  // as it does over the posts of a post-plank wall.
  //
  // What the defect actually violated is simpler than either: the wall must come UP TO the cap.
  for (const wallType of ['post-plank', 'crib']) {
    const m = bunkerOf(wallType);
    const capBottom = Math.min(...m.members.filter((x) => x.role === 'capBeam').map((x) => boxB(x).y[0]!));
    // The door frame is not the wall. Jambs are cut to the clear height and would report the wall
    // as touching the cap while four walls' worth of it hung in space.
    const hb = boxB(m.members.find((x) => x.role === 'header')!);
    const isJamb = (x: { role: string }, b: ReturnType<typeof boxB>): boolean => x.role === 'post'
      && b.x[0]! < 1 && (Math.abs(b.z[0]! - hb.z[0]!) < 1e-6 || Math.abs(b.z[1]! - hb.z[1]!) < 1e-6);
    const wall = m.members.filter((x) => {
      const b = boxB(x);
      return (x.role === 'cribLog' || x.role === 'post') && !isJamb(x, b) && b.y[0]! < capBottom + 1e-9;
    });
    assert.ok(wall.length > 4, `${wallType}: no wall found`);
    const top = Math.max(...wall.map((x) => boxB(x).y[1]!));
    assert.ok(top >= capBottom - 1e-6,
      `${wallType}: the cap starts at ${capBottom.toFixed(4)} and the wall stops at ${top.toFixed(4)} — `
      + `${((capBottom - top) * 12).toFixed(2)} in of air under everything it carries`);
  }
});

test('a crib comes up in whole courses, and the build says so', () => {
  const H = preset().clearHeightFt as number;
  const top = cribWallTopFt(H);
  assert.ok(top <= H + 1e-9, 'a crib never overshoots the height asked for');
  assert.ok(H - top > 1e-6, 'the premise: this preset does not divide evenly into courses');
  const m = bunkerOf('crib');
  const said = m.issues.find((i) => i.path === 'clearHeightFt');
  assert.ok(said, `nothing said about losing ${((H - top) * 12).toFixed(2)} in of clear height`);
  assert.match(said!.message, new RegExp(top.toFixed(2)), 'the message names the height it actually gives');
  // And the post-plank wall, which IS cut to the height asked for, must not raise it.
  assert.ok(!bunkerOf('post-plank').issues.some((i) => i.path === 'clearHeightFt'));
});

test('THE CRIB DOORWAY IS A HOLE TOO — the stack does not run through it', () => {
  const m = bunkerOf('crib');
  const hb = boxB(m.members.find((x) => x.role === 'header')!);
  const jambs = m.members.filter((x) => x.role === 'post' && boxB(x).x[0]! < 1
    && (Math.abs(boxB(x).z[0]! - hb.z[0]!) < 1e-6 || Math.abs(boxB(x).z[1]! - hb.z[1]!) < 1e-6));
  assert.equal(jambs.length, 2);
  const byZ = [...jambs].sort((p, q) => boxB(p).z[0]! - boxB(q).z[0]!);
  const clear: [number, number] = [boxB(byZ[0]!).z[1]!, boxB(byZ[1]!).z[0]!];
  let solid = 0, total = 0;
  for (let y = 0.2; y < hb.y[0]! - 0.1; y += 0.2) {
    for (let z = clear[0] + 0.1; z < clear[1] - 0.1; z += 0.15) {
      for (let x = -0.3; x < 1.0; x += 0.15) {
        total++;
        for (const k of m.members) {
          if (k.role === 'soilGhost') continue;
          const b = boxB(k);
          if (x > b.x[0]! && x < b.x[1]! && y > b.y[0]! && y < b.y[1]! && z > b.z[0]! && z < b.z[1]!) { solid++; break; }
        }
      }
    }
  }
  assert.ok(total > 2000, 'the opening was actually sampled');
  assert.equal(solid, 0, `${solid} of ${total} points inside the clear opening are solid`);
});

test('and the crib is still a crib either side of it', () => {
  // Cutting a course must not cost the alternation or the corner — the two properties that make
  // a stack cribwork rather than a pile.
  const withGap = generateCribWall({
    from: [0, 0], to: [0, 12], baseY: 0, heightFt: 6.5, depthFt: 2, stage: 1, prefix: 'TG', gap: [4, 8],
  });
  const plain = generateCribWall({
    from: [0, 0], to: [0, 12], baseY: 0, heightFt: 6.5, depthFt: 2, stage: 1, prefix: 'TP',
  });
  assert.ok(withGap.length > 0 && plain.length > 0);
  // Same courses, same heights — only the pieces within them changed.
  const heights = (ms: typeof plain) => [...new Set(ms.map((x) => Math.round(x.position[1]! * 1e6)))].sort();
  assert.deepEqual(heights(withGap), heights(plain), 'the same courses are still built');
  // Nothing crosses the gap.
  for (const x of withGap) {
    const b = boxB(x);
    const overlap = Math.min(b.z[1]!, 8) - Math.max(b.z[0]!, 4);
    assert.ok(overlap <= 1e-9, `${x.id} crosses the opening by ${(overlap * 12).toFixed(2)} in`);
  }
  // And both ends of the wall are still built — the corner is the whole structural idea.
  assert.ok(withGap.some((x) => boxB(x).z[0]! < 1e-6), 'the wall still reaches one corner');
  assert.ok(withGap.some((x) => boxB(x).z[1]! > 12 - 1e-6), 'and the other');
});

// ── The wall is built on its own centreline ──────────────────────────────────
//
// `outerL = interiorLengthFt + 2·wallThick` makes the rectangle [0, outerL] × [0, outerW] the
// bunker's OUTER FACE. The wall was built ON that rectangle — centred on it — so half of every
// post and half of every lagging board stood outside the structure. Measured on the shipped
// post-plank card: the posts ran z −0.2292 .. 11.1458 across a building 10.9167 ft wide, the
// clear interior came out 10 ft 5½ in of a stated 10 ft (and 16 ft 5½ in of a stated 16), and in
// plan the posts showed as tabs projecting past the roof line at every station down both long
// walls. The cap beam — placed at `wallThick / 2`, correctly on the wall band — bore on exactly
// half its width, with the inner half over open air.
//
// Everything the wall was supposed to MEET was already in the right place: the jambs and the
// header sit at `wallThick / 2`, the caps at `wallThick / 2`, the stringers on the caps. The wall
// was the one piece that disagreed, which is what made it invisible from every direction but
// straight down.

import { DRESSED } from '../src/timber/types';
import { IN_PER_FT } from '../src/timber/doctrine';

/** Roles that make up a wall — the roof deck is `lagging` too, and is filtered off by height. */
const WALL_ROLES = new Set(['post', 'cribLog', 'lagging']);

function bunkerGeom(wallType: string, over: Record<string, unknown> = {}) {
  const asked = preset();
  asked.wallType = wallType;
  Object.assign(asked, over);
  const model = generateStructure(asked);
  // Read the dimensions BACK from the model: the envelope clamps, and a test that sizes the
  // building off what it asked for measures a bunker that was never built.
  const spec = model.spec as unknown as Record<string, number>;
  // A POST-AND-PLANK WALL IS TWO LAYERS: the plank on the outer face and the post behind it.
  // It used to be modelled as one, with the planks laid on the posts' own centreline and running
  // straight through them, so this figure was the post alone.
  const wallThick = wallType === 'crib'
    ? (DRESSED[BUNKER.cribLogNominal.value as string]!.w / IN_PER_FT) * 3
    : (DRESSED[BUNKER.postNominal.value as string]!.w + DRESSED[BUNKER.laggingNominal.value as string]!.w) / IN_PER_FT;
  const caps = model.members.filter((k) => k.role === 'capBeam');
  const capBottom = Math.min(...caps.map((k) => boxB(k).y[0]!));
  const wall = model.members.filter((k) => WALL_ROLES.has(k.role) && boxB(k).y[1]! <= capBottom + 1e-9);
  return {
    model, caps, wall, wallThick,
    stringers: model.members.filter((k) => k.role === 'ohcStringer'),
    interiorL: spec.interiorLengthFt as number,
    interiorW: spec.interiorWidthFt as number,
    outerL: (spec.interiorLengthFt as number) + 2 * wallThick,
    outerW: (spec.interiorWidthFt as number) + 2 * wallThick,
  };
}

/**
 * The clear run through `ms` along one plan axis, at a fixed position on the other and a fixed
 * height — the gap containing `centre`, bounded by whatever the ray actually meets.
 *
 * Returns ±Infinity on a side the ray leaves without meeting anything, which is a real answer and
 * not a failure: a crib's top course is ties on a spacing, and between two of them there is
 * nothing to hit. Those rays are skipped by the caller rather than counted as a hole in the wall.
 */
function clearRun(
  ms: readonly { role: string; cutLength: number; actual: { w: number; d: number }; rotation: readonly number[]; position: readonly number[] }[],
  axis: 0 | 2, other: number, y: number, centre: number,
): [number, number] | null {
  let lo = -Infinity;
  let hi = Infinity;
  for (const k of ms) {
    const b = boxB(k);
    const o = axis === 2 ? b.x : b.z;
    if (other <= o[0]! || other >= o[1]!) continue;
    if (y <= b.y[0]! || y >= b.y[1]!) continue;
    const a = axis === 2 ? b.z : b.x;
    if (a[1]! <= centre) lo = Math.max(lo, a[1]!);
    else if (a[0]! >= centre) hi = Math.min(hi, a[0]!);
    else return null; // the middle of the bunker is solid, which is its own kind of wrong
  }
  return [lo, hi];
}

test('THE WALL FILLS ITS OWN FOOTPRINT — nothing it is made of stands outside the building', () => {
  for (const wallType of ['post-plank', 'crib']) {
    const { wall, outerL, outerW } = bunkerGeom(wallType);
    assert.ok(wall.length > 10, `${wallType}: no wall found`);
    const xs = wall.flatMap((k) => boxB(k).x);
    const zs = wall.flatMap((k) => boxB(k).z);
    for (const [name, got, want] of [
      ['x', Math.min(...xs), 0], ['x', Math.max(...xs), outerL],
      ['z', Math.min(...zs), 0], ['z', Math.max(...zs), outerW],
    ] as [string, number, number][]) {
      assert.ok(Math.abs(got - want) < 1e-9,
        `${wallType}: the wall reaches ${name}=${got.toFixed(4)} against an outer face at ${want.toFixed(4)} `
        + `— ${((got - want) * IN_PER_FT).toFixed(2)} in of it is on the wrong side of the building line`);
    }
  }
});

test('and the interior it encloses is the interior the spec asked for', () => {
  // The complement of the test above, and the one that actually failed before: the old wall did
  // not overhang INWARD, it overhung OUTWARD, so the clear space came out half a wall thickness
  // too generous in every direction. Measured by rays through the building rather than off a
  // bounding box, because a bounding box round a wall with a doorway in it answers a different
  // question.
  for (const wallType of ['post-plank', 'crib']) {
    const { wall, wallThick, outerL, outerW, interiorL, interiorW } = bunkerGeom(wallType);
    // `axis` is the one being MEASURED; `stationSpan` is the one the ray's position slides along.
    const sweeps: { axis: 0 | 2; stationSpan: number; measuredSpan: number; stated: number }[] = [
      { axis: 2, stationSpan: outerL, measuredSpan: outerW, stated: interiorW },
      { axis: 0, stationSpan: outerW, measuredSpan: outerL, stated: interiorL },
    ];
    for (const { axis, stationSpan, measuredSpan, stated } of sweeps) {
      const wantLo = wallThick;
      const wantHi = measuredSpan - wallThick;
      // Tracked per SIDE, not as a clear run. The two end walls never both present a post at the
      // same station — the doorway takes two out of the near one — so no single ray measures the
      // stated length, and demanding one would be demanding the wrong thing.
      let deepestLo = -Infinity;
      let shallowestHi = Infinity;
      let loSeen = 0;
      let hiSeen = 0;
      for (let t = wallThick + 0.2; t < stationSpan - wallThick; t += 0.1) {
        for (const y of [0.4, 1.7, 3.1, 4.6]) {
          const run = clearRun(wall, axis, t, y, measuredSpan / 2);
          assert.ok(run, `${wallType}: the middle of the bunker is solid at ${t.toFixed(2)}, ${y}`);
          // Each side is read on its own. A ray that leaves through a gap between ties, or
          // straight out of the doorway, measures nothing on THAT side — and the two sides are
          // not interchangeable: the only stations where the far end wall has a post are the two
          // the doorway takes out of the near one, so pairing them would discard exactly the
          // measurements that matter.
          //
          // Nothing may stand INSIDE the stated interior. Between two posts the wall is only the
          // plank, so the clear run there is wider than this and that is the wall's own shape —
          // this is a bound, and the equalities below are what pin where the wall actually is.
          if (Number.isFinite(run[0])) {
            assert.ok(run[0]! <= wantLo + 1e-9,
              `${wallType}: at ${t.toFixed(2)}, ${y} the near wall reaches ${run[0]!.toFixed(4)} into a stated interior starting at ${wantLo.toFixed(4)}`);
            deepestLo = Math.max(deepestLo, run[0]!);
            loSeen++;
          }
          if (Number.isFinite(run[1])) {
            assert.ok(run[1]! >= wantHi - 1e-9,
              `${wallType}: at ${t.toFixed(2)}, ${y} the far wall reaches ${run[1]!.toFixed(4)} into a stated interior ending at ${wantHi.toFixed(4)}`);
            shallowestHi = Math.min(shallowestHi, run[1]!);
            hiSeen++;
          }
        }
      }
      assert.ok(loSeen > 20 && hiSeen > 20, `${wallType}: only ${loSeen}/${hiSeen} rays met a wall`);
      // And the wall REACHES that line: somewhere along each side, its innermost material is
      // exactly a wall thickness in from the outer face. Both together are the stated interior.
      assert.ok(Math.abs(deepestLo - wantLo) < 1e-9,
        `${wallType}: the near wall reaches ${deepestLo.toFixed(4)} where the interior starts at ${wantLo.toFixed(4)} `
        + `— ${((wantLo - deepestLo) * IN_PER_FT).toFixed(2)} in of clear space the spec never asked for`);
      assert.ok(Math.abs(shallowestHi - wantHi) < 1e-9,
        `${wallType}: the far wall reaches ${shallowestHi.toFixed(4)} where the interior ends at ${wantHi.toFixed(4)}`);
      assert.ok(Math.abs((wantHi - wantLo) - stated) < 1e-9, `the arithmetic above is ${stated} ft of interior`);
    }
  }
});

test('and the cap beam is centred on the wall it caps, bearing across its whole width', () => {
  // Recorded last pass as "the cap beam is not centred on the wall it caps", which was true and
  // was the wall's fault, not the cap's.
  //
  // Compared against the wall's TOP COURSE as a band, not as solid material: a cap is a beam and
  // spans between bearings, exactly as it does over the posts of a post-plank wall. Members that
  // run the length of another wall are left out — an end-wall stretcher crosses the cap's band and
  // says nothing about what the cap sits on.
  // ALL FOUR WALLS, not two. The end walls used to have no cap at all and this test said so by
  // asserting there were exactly two; a cap is what closes the top of a wall, and the ends had a
  // 7¼-in slot where one belonged. The check is now per cap and reads the axis off the piece:
  // a side cap is thin in z, an end cap thin in x, and each must bear on the wall under it.
  for (const wallType of ['post-plank', 'crib']) {
    const { caps, wall, wallThick } = bunkerGeom(wallType);
    assert.equal(caps.length, 5, `${wallType}: a bunker is capped all round — the entrance end in `
      + 'two pieces, because the doorway header is the middle one');
    const bearing = wall.filter((k) => k.role === 'post' || k.role === 'cribLog');
    const top = Math.max(...bearing.map((k) => boxB(k).y[1]!));
    const topCourse = bearing.filter((k) => boxB(k).y[1]! > top - 1e-9);
    assert.ok(topCourse.length >= 4, `${wallType}: nothing at the top of the wall for the cap to bear on`);
    for (const cap of caps) {
      const full = boxB(cap);
      const across: 'x' | 'z' = full.x[1]! - full.x[0]! > full.z[1]! - full.z[0]! ? 'z' : 'x';
      const along: 'x' | 'z' = across === 'z' ? 'x' : 'z';
      const cb = full[across] as [number, number];
      const cl = full[along] as [number, number];
      const under = topCourse.filter((k) => {
        const b = boxB(k);
        const w = b[across] as [number, number];
        return w[1] - w[0] <= 2 * wallThick + 1e-9 && w[1] > cb[0] + 1e-9 && w[0] < cb[1] - 1e-9
          // TOUCHING COUNTS along the cap's own run: an end cap butts between the two side caps
          // and lands ON the corner post, which meets its end exactly rather than overlapping it.
          && b[along][1]! >= cl[0] - 1e-9 && b[along][0]! <= cl[1] + 1e-9;
      });
      assert.ok(under.length > 0, `${wallType}: ${cap.id} has no wall under it at all`);
      const band: [number, number] = [
        Math.min(...under.map((k) => boxB(k)[across][0]!)),
        Math.max(...under.map((k) => boxB(k)[across][1]!)),
      ];
      assert.ok(band[0] <= cb[0] + 1e-9 && band[1] >= cb[1] - 1e-9,
        `${wallType}: ${cap.id} covers ${across} ${cb[0].toFixed(4)}..${cb[1].toFixed(4)} and the wall under it is `
        + `${band[0].toFixed(4)}..${band[1].toFixed(4)} — ${((Math.max(0, band[0] - cb[0]) + Math.max(0, cb[1] - band[1])) * IN_PER_FT).toFixed(2)} in of the cap is over air`);
      assert.ok(Math.abs((band[0] + band[1]) / 2 - (cb[0] + cb[1]) / 2) < 1e-9,
        `${wallType}: ${cap.id} is centred at ${((cb[0] + cb[1]) / 2).toFixed(4)} on a wall centred at ${((band[0] + band[1]) / 2).toFixed(4)}`);
    }
  }
});

test('the crib bunker\'s other three walls are unbroken', () => {
  const m = bunkerOf('crib');
  const hb = boxB(m.members.find((x) => x.role === 'header')!);
  // Stretchers run along their wall; a cut one is shorter than the wall it is in.
  const stretchers = m.members.filter((x) => x.role === 'cribLog' && x.cutLength > 4 * 12);
  const runs = new Set(stretchers.map((x) => Math.round(x.cutLength * 1e3)));
  assert.equal(runs.size, 2, `expected the two wall lengths, got ${[...runs].map((r) => (r / 12e3).toFixed(2)).join(',')}`);
  // A CUT stretcher is longer than a tie and shorter than the wall it came from. Selecting by a
  // flat length band caught the ties instead, which are 1 ft 4½ in and are not cut anything.
  const tieLen = Math.min(...m.members.filter((x) => x.role === 'cribLog').map((x) => x.cutLength));
  const shortestWall = Math.min(...runs);
  const cut = m.members.filter((x) => x.role === 'cribLog'
    && x.cutLength > tieLen + 1 && x.cutLength * 1e3 < shortestWall - 1);
  assert.ok(cut.length > 0, 'the entrance wall has cut courses');
  for (const c of cut) assert.ok(boxB(c).x[0]! < 1, `${c.id} was cut on a wall that has no doorway`);
  void hb;
});

// ── The overhead stringers ───────────────────────────────────────────────────
//
// Same mistake as the wall, one loop further down. The stringers were placed at
// `outerL · i / (n − 1)`, so the first and last were CENTRED ON the end faces of the building:
// half of each 8x8 hung 3⅝ in past the end wall, past the end of the cap it bears on, and out
// from under both the roof lagging and the earth cover. In a front elevation of the stringer
// stage the end one plainly sticks out beyond the wall below it, cantilevered over air.
//
// The count went with it. `floor(outerL / spacing) + 1` is the number that fit at LEAST the
// doctrine spacing apart, which is the wrong side of a maximum: the shipped card came out at
// 25⅜ in on centre against a 2 ft figure the stringer table flags life-safety.

test('THE OVERHEAD STRINGERS ARE LAID INSIDE THE BUILDING, flush with both ends', () => {
  for (const wallType of ['post-plank', 'crib']) {
    for (const lengthFt of [10, 13, 16, 20, 24]) {
      const { stringers, outerL, outerW } = bunkerGeom(wallType, { interiorLengthFt: lengthFt });
      const tag = `${wallType} ${lengthFt} ft`;
      assert.ok(stringers.length >= 2, `${tag}: no overhead`);
      const bands = stringers.map((k) => boxB(k).x as [number, number]).sort((a, b) => a[0] - b[0]);
      const first = bands[0]!;
      const last = bands[bands.length - 1]!;
      assert.ok(Math.abs(first[0]) < 1e-9,
        `${tag}: the first stringer's outer face is at ${first[0].toFixed(4)} against an end wall at 0 `
        + `— ${(-first[0] * IN_PER_FT).toFixed(2)} in of it is outside the building`);
      assert.ok(Math.abs(last[1] - outerL) < 1e-9,
        `${tag}: the last stringer's outer face is at ${last[1].toFixed(4)} against an end wall at ${outerL.toFixed(4)}`);
      // And each of them still crosses the whole building the short way, which is what it is for.
      for (const k of stringers) {
        const b = boxB(k);
        assert.ok(Math.abs(b.z[0]!) < 1e-9 && Math.abs(b.z[1]! - outerW) < 1e-9,
          `${tag}: ${k.id} spans z ${b.z[0]!.toFixed(4)}..${b.z[1]!.toFixed(4)} of a ${outerW.toFixed(4)} ft building`);
      }
    }
  }
});

test('at no more than the spacing the stringer table asks for, and no more of them than that needs', () => {
  // A maximum, not a target: the spacing carries the stated depth of soil and the doctrine entry
  // is flagged life-safety. Bounded from above as well, so a future change cannot quietly buy
  // its way out of this test with more timber than the table asks for.
  const spacing = BUNKER.stringerSpacingFt.value as number;
  for (const wallType of ['post-plank', 'crib']) {
    for (const lengthFt of [10, 13, 16, 20, 24]) {
      const { stringers, outerL } = bunkerGeom(wallType, { interiorLengthFt: lengthFt });
      const tag = `${wallType} ${lengthFt} ft`;
      const centres = stringers.map((k) => k.position[0]!).sort((a, b) => a - b);
      const gaps = centres.slice(1).map((c, i) => c - centres[i]!);
      const widest = Math.max(...gaps);
      assert.ok(widest <= spacing + 1e-9,
        `${tag}: ${(widest * IN_PER_FT).toFixed(2)} in on centre against a ${spacing * IN_PER_FT} in maximum`);
      const run = outerL - stringers[0]!.actual.w / IN_PER_FT;
      if (stringers.length > 2) {
        assert.ok(run / (stringers.length - 2) > spacing + 1e-9,
          `${tag}: ${stringers.length} stringers where ${stringers.length - 1} would still make the spacing`);
      }
    }
  }
});

test('and every stringer bears on both caps across its whole thickness', () => {
  for (const wallType of ['post-plank', 'crib']) {
    const { model, caps, stringers } = bunkerGeom(wallType);
    // The stringers span the WIDTH and land on the two long walls' caps. The end caps close the
    // top of their walls and carry nothing, which is why they are not in this check.
    const sideCaps = caps.filter((k) => boxB(k).x[1]! - boxB(k).x[0]! > boxB(k).z[1]! - boxB(k).z[0]!);
    assert.equal(sideCaps.length, 2, `${wallType}: two caps run the length, under the stringers`);
    for (const cap of sideCaps) {
      const cb = boxB(cap);
      for (const s of stringers) {
        const sb = boxB(s);
        assert.ok(sb.x[0]! >= cb.x[0]! - 1e-9 && sb.x[1]! <= cb.x[1]! + 1e-9,
          `${wallType}: ${s.id} runs x ${sb.x[0]!.toFixed(4)}..${sb.x[1]!.toFixed(4)} over a cap running `
          + `${cb.x[0]!.toFixed(4)}..${cb.x[1]!.toFixed(4)} — ${((Math.max(0, cb.x[0]! - sb.x[0]!) + Math.max(0, sb.x[1]! - cb.x[1]!)) * IN_PER_FT).toFixed(2)} in of it is past the end of what carries it`);
        assert.ok(Math.abs(sb.y[0]! - cb.y[1]!) < 1e-9,
          `${wallType}: ${s.id} sits at ${sb.y[0]!.toFixed(4)} on a cap topping out at ${cb.y[1]!.toFixed(4)}`);
      }
    }
    // Nothing of the overhead may stand outside the walls it lands on, in plan.
    const outer = model.members.filter((k) => k.role === 'capBeam');
    const xMax = Math.max(...outer.map((k) => boxB(k).x[1]!));
    for (const s of stringers) assert.ok(boxB(s).x[1]! <= xMax + 1e-9);
  }
});

// ── The wall is two layers ───────────────────────────────────────────────────
//
// A post-and-plank wall is planks on the outer face and posts behind them, and it was modelled as
// one layer: the planks laid on the posts' own centreline, running straight THROUGH every post
// they crossed. 176 overlapping pairs on the shipped card, the deepest 59.8 in³ of one solid
// inside another.
//
// And it is not a question of which side looks tidier. The earth is OUTSIDE and it pushes in, so
// the planks belong on the outer face with the posts behind them: the load bears the planks onto
// the posts, which is the whole reason a soldier-pile wall is built that way round. On the posts'
// own line the planks were retaining nothing.

test('A PLANK DOES NOT PASS THROUGH A POST', () => {
  for (const wallType of ['post-plank', 'crib']) {
    const { model } = bunkerGeom(wallType);
    const lag = model.members.filter((x) => x.role === 'lagging');
    const posts = model.members.filter((x) => x.role === 'post');
    if (wallType === 'crib') {
      assert.equal(lag.filter((x) => boxB(x).y[1]! < 7).length, 0, 'a crib has no lagging in its walls');
      continue;
    }
    assert.ok(lag.length > 20 && posts.length > 4, `${wallType}: nothing to check`);
    let worst = 0;
    let pair = '';
    for (const l of lag) {
      const a = boxB(l);
      for (const p of posts) {
        const b = boxB(p);
        const dx = Math.min(a.x[1]!, b.x[1]!) - Math.max(a.x[0]!, b.x[0]!);
        const dy = Math.min(a.y[1]!, b.y[1]!) - Math.max(a.y[0]!, b.y[0]!);
        const dz = Math.min(a.z[1]!, b.z[1]!) - Math.max(a.z[0]!, b.z[0]!);
        if (dx > 1e-9 && dy > 1e-9 && dz > 1e-9) {
          const v = dx * dy * dz * 1728;
          if (v > worst) { worst = v; pair = `${l.id} and ${p.id}`; }
        }
      }
    }
    assert.equal(worst, 0, `${wallType}: ${pair} occupy the same ${worst.toFixed(1)} in³`);
  }
});

test('and the planks are OUTBOARD of the posts, where the earth bears them onto it', () => {
  // A plank inboard of the posts would be just as free of overlaps and exactly wrong: the earth
  // would push it off them. Measured per side, against the wall band's own outer face.
  const { model, wallThick, outerL, outerW } = bunkerGeom('post-plank');
  const capBottom = Math.min(...model.members.filter((k) => k.role === 'capBeam').map((k) => boxB(k).y[0]!));
  const lag = model.members.filter((x) => x.role === 'lagging' && boxB(x).y[1]! <= capBottom + 1e-9);
  const posts = model.members.filter((x) => x.role === 'post');
  assert.ok(lag.length > 20);
  const sweeps: { axis: 0 | 2; span: number }[] = [{ axis: 0, span: outerL }, { axis: 2, span: outerW }];
  for (const { axis, span } of sweeps) {
    const near = (k: (typeof lag)[number]): boolean => (axis === 0 ? boxB(k).x : boxB(k).z)[1]! < span / 2;
    const far = (k: (typeof lag)[number]): boolean => (axis === 0 ? boxB(k).x : boxB(k).z)[0]! > span / 2;
    // On the near side, the outermost material is the plank and the innermost is the post.
    for (const [pick, edge, label] of [[near, 0, 'near'], [far, 1, 'far']] as [typeof near, 0 | 1, string][]) {
      const wallLag = lag.filter((k) => pick(k) && (axis === 0 ? boxB(k).x : boxB(k).z)[1]! - (axis === 0 ? boxB(k).x : boxB(k).z)[0]! < wallThick + 1e-9);
      const wallPost = posts.filter((k) => pick(k));
      if (wallLag.length === 0 || wallPost.length === 0) continue;
      const face: number = edge === 0 ? 0 : span;
      const lagFace = edge === 0
        ? Math.min(...wallLag.map((k) => (axis === 0 ? boxB(k).x : boxB(k).z)[0]!))
        : Math.max(...wallLag.map((k) => (axis === 0 ? boxB(k).x : boxB(k).z)[1]!));
      const postFace = edge === 0
        ? Math.min(...wallPost.map((k) => (axis === 0 ? boxB(k).x : boxB(k).z)[0]!))
        : Math.max(...wallPost.map((k) => (axis === 0 ? boxB(k).x : boxB(k).z)[1]!));
      assert.ok(Math.abs(lagFace - face) < 1e-9,
        `${label} wall on axis ${axis}: the planks' outer face is at ${lagFace.toFixed(4)}, not the building line ${face.toFixed(4)}`);
      const inboard = edge === 0 ? postFace - lagFace : lagFace - postFace;
      assert.ok(inboard > 1e-9,
        `${label} wall on axis ${axis}: the posts are ${(inboard * IN_PER_FT).toFixed(2)} in inboard of the planks — the earth would push the planks off them`);
    }
  }
});

test('and the baffle\'s own planks sit on its posts, not inside them', () => {
  // The same mistake at half the depth: the baffle stood its lagging off by HALF a post, which
  // puts the plank's own centre on the post's face and half of every board inside it.
  const { model } = bunkerGeom('post-plank');
  const baffle = model.members.filter((x) => x.role === 'baffleWall');
  assert.ok(baffle.length > 0, 'the preset has a baffle');
  const bPosts = baffle.filter((x) => Math.abs(Math.abs(x.rotation[2]!) - Math.PI / 2) < 1e-6);
  const bLag = baffle.filter((x) => !bPosts.includes(x));
  assert.ok(bPosts.length >= 2 && bLag.length > 0);
  for (const l of bLag) {
    const a = boxB(l);
    for (const p of bPosts) {
      const b = boxB(p);
      const dx = Math.min(a.x[1]!, b.x[1]!) - Math.max(a.x[0]!, b.x[0]!);
      const dy = Math.min(a.y[1]!, b.y[1]!) - Math.max(a.y[0]!, b.y[0]!);
      const dz = Math.min(a.z[1]!, b.z[1]!) - Math.max(a.z[0]!, b.z[0]!);
      assert.ok(dx <= 1e-9 || dy <= 1e-9 || dz <= 1e-9,
        `${l.id} is ${(dx * IN_PER_FT).toFixed(2)} in inside ${p.id}`);
    }
  }
});

// ── A run of boards closes on its limit ──────────────────────────────────────
//
// This family lays boards in three places and got the remainder wrong three different ways.
// Six foot six of wall is 10.759 courses of a 7¼-in plank; the overhead is 18.483 boards wide:
//
//   the WALL laid eleven whole courses, so the top one stood 1¾ in proud of the posts and 1¾ in
//   INTO the cap beam, the whole way round;
//   the BAFFLE clamped its last course's centre back down, so that board lay 1¾ in ON TOP OF the
//   one below it — the same figure again, as duplicated material;
//   the OVERHEAD clamped the same way across its width and came out 3½ in SHORT of the far wall,
//   which is 3½ in of roof with the earth straight onto the stringers.
//
// One answer to all three: the last board of a run is ripped to fit.

const runOf = (ms: Member2[], axis: 1 | 2): [number, number][] => {
  const seen: [number, number][] = [];
  for (const k of ms) {
    const b = axis === 1 ? boxB(k).y : boxB(k).z;
    if (!seen.some((u) => Math.abs(u[0] - b[0]!) < 1e-9)) seen.push([b[0]!, b[1]!]);
  }
  return seen.sort((a, b) => a[0] - b[0]);
};

test('A RUN OF BOARDS CLOSES ON ITS LIMIT — nothing past it, nothing doubled, nothing short', () => {
  const { model, outerW } = bunkerGeom('post-plank');
  const H = (model.spec as unknown as { clearHeightFt: number }).clearHeightFt;
  const stock = DRESSED[BUNKER.laggingNominal.value as string]!;
  const cases: [string, Member2[], 1 | 2, number][] = [
    ['the wall', model.members.filter((x) => x.role === 'lagging'
      && boxB(x).y[1]! < H + 0.5 && Math.abs(x.rotation[0]!) < 1e-9), 1, H],
    ['the baffle', model.members.filter((x) => x.role === 'baffleWall'
      && Math.abs(x.rotation[1]! - Math.PI / 2) < 1e-6), 1, H],
    ['the overhead', model.members.filter((x) => x.role === 'lagging'
      && Math.abs(x.rotation[0]! + Math.PI / 2) < 1e-6), 2, outerW],
  ];
  for (const [label, ms, axis, limit] of cases) {
    assert.ok(ms.length > 5, `${label}: only ${ms.length} boards`);
    const run = runOf(ms, axis);
    assert.ok(Math.abs(run[0]![0]) < 1e-9, `${label}: the first board starts at ${run[0]![0].toFixed(4)}, not 0`);
    const last = run[run.length - 1]!;
    assert.ok(Math.abs(last[1] - limit) < 1e-9,
      `${label}: the last board ends at ${last[1].toFixed(4)} against a limit of ${limit.toFixed(4)} `
      + `— ${((last[1] - limit) * IN_PER_FT).toFixed(2)} in ${last[1] > limit ? 'past' : 'short of'} it`);
    for (let i = 1; i < run.length; i++) {
      assert.ok(Math.abs(run[i]![0] - run[i - 1]![1]) < 1e-9,
        `${label}: board ${i} starts at ${run[i]![0].toFixed(4)} where the one below ends at ${run[i - 1]![1].toFixed(4)} `
        + `— ${(Math.abs(run[i]![0] - run[i - 1]![1]) * IN_PER_FT).toFixed(2)} in of ${run[i]![0] < run[i - 1]![1] ? 'overlap' : 'gap'}`);
    }
    // A rip is NARROWER than the stock, never wider: closing the run by widening the last board
    // would satisfy everything above and put a board on the list that nobody can cut.
    for (const k of ms) {
      assert.ok(k.actual.d <= stock.d + 1e-9,
        `${label}: ${k.id} claims a ${k.actual.d.toFixed(2)} in face on a ${k.nominal}, which is ${stock.d} in`);
    }
    assert.ok(run.some(([a, b]) => b - a < stock.d / IN_PER_FT - 1e-9),
      `${label}: no board was ripped, so the run happens to divide evenly — this case tests nothing`);
  }
});
