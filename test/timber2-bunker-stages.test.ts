// The crib bunker's build ORDER, which is the one thing a stage scrubber is for.
//
// NOTHING MAY APPEAR BEFORE THE THING IT STANDS ON. The doorway's two jamb posts and its header
// were stamped into the ENTRANCE stage — the last one before the soil — while the caps they line
// up with go on at stage 3 and the overhead cover that bears on them at stage 4:
//
//   stage 2  posts & lagging          the wall, with a gap where the doorway is
//   stage 3  caps                     five cap beams, two of them stopping dead at the jambs
//   stage 4  overhead stringers       ten of them, running across the doorway on nothing
//   stage 5  lagging over
//   stage 6  entrance                 the jambs and the header finally arrive
//
// Scrub to stage 4 and the cover spans the opening with a five-foot hole under it. The generator
// already knew better and said so twice — *"Jambs first: the header has to land on something"* and
// *"THE HEADER IS THE CAP CONTINUED ACROSS THE DOORWAY"* — but the stage key said otherwise.
//
// A jamb is one of the wall's posts (its own comment: "A post that would stand in the doorway is
// not built; the jamb is its replacement") and the header is that course of the cap. They belong
// to the stages named for those pieces. What is left in the entrance stage is the baffle, and an
// OPEN entrance has none — so that row declares `noMembers`, which is the difference between a
// real stop on the scrubber and a stage nothing happens to generate for.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { bunkerStagePlan } from '../src/timber/families/bunker';
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

function yRange(m: Member): [number, number] {
  const h = halfExtents(m);
  const v: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push(m.position[1]! + rotate(m, [sx * h[0], sy * h[1], sz * h[2]])[1]);
  }
  return [Math.min(...v), Math.max(...v)];
}

/** A bearing, not a graze: half an inch of slop on the level, and the two have to touch. */
const BEARING_TOL = 0.02;

const CASES: { entrance: 'open' | 'baffle'; wallType: 'post-plank' | 'crib' }[] = [
  { entrance: 'baffle', wallType: 'post-plank' },
  { entrance: 'open', wallType: 'post-plank' },
  { entrance: 'baffle', wallType: 'crib' },
  { entrance: 'open', wallType: 'crib' },
];

function bunker(over: { entrance: 'open' | 'baffle'; wallType: 'post-plank' | 'crib' }) {
  const spec = { ...JSON.parse(JSON.stringify(familyById('crib-bunker')!.preset)), ...over };
  const model = generateStructure(spec);
  const norm = model.spec as unknown as { entrance: string; wallType: string };
  assert.equal(norm.entrance, over.entrance, `${JSON.stringify(over)}: the card did not take that entrance`);
  assert.equal(norm.wallType, over.wallType, `${JSON.stringify(over)}: the card did not take that wall`);
  return model;
}

test('NOTHING IN A BUNKER STANDS ON SOMETHING BUILT LATER', () => {
  for (const over of CASES) {
    const { members } = bunker(over);
    const label = `${over.entrance}/${over.wallType}`;
    let bearings = 0;
    for (const a of members) {
      const aLow = yRange(a)[0];
      for (const b of members) {
        if (a === b) continue;
        // `a` sits ON `b`: its underside is at b's top, and the two are in contact.
        if (Math.abs(aLow - yRange(b)[1]) > BEARING_TOL) continue;
        if (gap(a, b) > BEARING_TOL) continue;
        bearings++;
        assert.ok(a.stage >= b.stage,
          `${label}: ${a.id} (${a.role}) goes up at stage ${a.stage} on ${b.id} (${b.role}) at stage ${b.stage} — `
          + `${b.stage - a.stage} stage(s) of standing on nothing`);
      }
    }
    assert.ok(bearings > 100, `${label}: only ${bearings} bearing pairs — the scan found nothing to check`);
  }
});

test('and the doorway is framed with the wall and capped with the caps', () => {
  // The specific claim, read off the model rather than off the stage numbers: a jamb is one of the
  // wall's posts, so every post shares one stage; the header is the cap continued, so it shares
  // the cap beams'.
  for (const over of CASES) {
    const { members } = bunker(over);
    const label = `${over.entrance}/${over.wallType}`;
    const header = members.filter((m) => m.role === 'header');
    assert.equal(header.length, 1, `${label}: one header over one doorway`);
    // The jambs are the posts that catch the header. A post-plank bunker has a dozen more posts
    // and a crib bunker has none but these two, so they are found by what they carry rather than
    // by counting.
    const jambs = members.filter((m) => m.role === 'post' && gap(header[0]!, m) <= 1e-6);
    assert.equal(jambs.length, 2, `${label}: the header lands on ${jambs.length} posts`);
    // The wall they are part of: whatever this wall type is made of, laid in one stage.
    const wall = members.filter((m) => ['lagging', 'cribLog'].includes(m.role) && m.stage === Math.min(
      ...members.filter((x) => ['lagging', 'cribLog'].includes(x.role)).map((x) => x.stage)));
    assert.ok(wall.length > 4, `${label}: ${wall.length} wall members`);
    for (const j of jambs) {
      assert.equal(j.stage, wall[0]!.stage,
        `${label}: ${j.id} goes up at stage ${j.stage} and the wall it replaces a post in at ${wall[0]!.stage}`);
    }
    const caps = members.filter((m) => m.role === 'capBeam');
    assert.equal(new Set(caps.map((m) => m.stage)).size, 1, `${label}: the caps do not go on together`);
    assert.equal(header[0]!.stage, caps[0]!.stage,
      `${label}: the header is at stage ${header[0]!.stage} and the cap it continues at ${caps[0]!.stage}`);
  }
});

test('and it is still the SAME piece in the same place — only its turn moved', () => {
  // The guard on the fix. A stage key is a number on a member and nothing stops it from being
  // changed alongside the geometry by accident; this pins the geometry the earlier passes settled.
  for (const over of CASES) {
    const { members } = bunker(over);
    const label = `${over.entrance}/${over.wallType}`;
    const caps = members.filter((m) => m.role === 'capBeam');
    const header = members.find((m) => m.role === 'header')!;
    const capTop = Math.max(...caps.map((m) => yRange(m)[1]));
    assert.ok(Math.abs(yRange(header)[1] - capTop) < 1e-9,
      `${label}: the header tops out ${((yRange(header)[1] - capTop) * IN_PER_FT).toFixed(3)} in off the cap line `
      + 'the overhead cover bears on');
    // And it bears on the two jambs — the pieces whose whole job is to catch it.
    const jambs = members.filter((m) => m.role === 'post' && gap(header, m) <= 1e-6);
    assert.equal(jambs.length, 2, `${label}: the header lands on ${jambs.length} posts`);
    for (const j of jambs) {
      assert.ok(Math.abs(yRange(j)[1] - yRange(header)[0]) < 1e-9, `${label}: ${j.id} does not reach the header`);
    }
  }
});

test('and the entrance stage says whether anything is built in it', () => {
  // What is LEFT there once the framing moved out. A baffle is real material; an open entrance is
  // a doorway already framed and already capped, which is a stop on the scrubber and no member —
  // and the plan has to say which, or an empty row is indistinguishable from a forgotten one.
  for (const over of CASES) {
    const { members } = bunker(over);
    const plan = bunkerStagePlan(over.wallType, true, over.entrance);
    const row = plan.find((e) => e.key === 'openings-built')!;
    const built = members.filter((m) => m.stage === row.ordinal);
    if (over.entrance === 'baffle') {
      assert.ok(!row.noMembers, `${over.wallType}: a baffle is material, and the row claims none`);
      assert.ok(built.length > 0, `${over.wallType}: the baffle stage is empty`);
      assert.ok(built.every((m) => m.role === 'baffleWall'),
        `${over.wallType}: ${[...new Set(built.map((m) => m.role))].join(', ')} in the entrance stage`);
    } else {
      assert.ok(row.noMembers, `${over.wallType}: an open entrance builds nothing and the row does not say so`);
      assert.equal(built.length, 0, `${over.wallType}: ${built.length} members in a stage that declares none`);
    }
  }
});
