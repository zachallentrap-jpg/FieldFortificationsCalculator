// The tall guard tower's way up — the one card configuration no shipped preset builds.
//
// The tower ships at 16 ft with a ladder. Everything above 20 is a switchback stair with three
// landings, its own railings, and a bridge back to the deck — 446 members on a 32-ft tower against
// 280 on the shipped one, and not one of them in any golden. Two things were wrong in there.
//
// **A THIRTY-FOOT FIXED LADDER.** `normalizeSpec` forces the stair with
// `platformHeightFt === 24 || platformHeightFt === 32` — the two tall options the picker's select
// offers, not the rule. The rule is a THRESHOLD, `LADDER.cageThresholdFt` is the figure (20 ft),
// and the card's own help text states it: *"Above 20 ft a fixed ladder is not an acceptable sole
// means of access (EM 385-1-1) — the tool switches to a stair and tells you."* A spec that reaches
// the generator any other way — a saved plan, a shared link, the custom card — could ask for 30 ft
// and get a ladder with thirty rungs on it:
//
//   asked 26, 28, 30      access=ladder      2 rails, 26/28/30 rungs, no stair anywhere
//
// **AND TWO POSTS IN ONE HOLE, TEN TIMES.** `RailingInput.standing` exists for exactly this and
// says so — *"two posts entirely inside each other over 3 ft 8 in of height"* was the cab's. A
// switchback stair is four railed surfaces meeting: each flight sets a post where its rail line
// runs out, and the landing it runs out ON set its own 4x4 in the same hole. Every landing twice,
// once for the flight arriving and once for the flight leaving, plus the platform's guardrail at
// the top:
//
//   32-ft tower     10 railPost x railPost pairs at 3.500 in — a 4x4's whole width
//   24-ft tower      8
//
// Invisible on screen precisely because they are EXACTLY coincident; what they are is 8 posts of
// 4x4 on the cut list that nobody would ever cut, and a model that says a joint is something it
// is not. The flight's post is the one that stays — it is bolted to the stringer and carries the
// raked rail — and the landing's railing is told it is there, so it lands its rails on that post's
// faces instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { LADDER, IN_PER_FT } from '../src/timber/doctrine';
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

const CAGE = LADDER.cageThresholdFt.value as number;
/** Every two feet from the shortest tower the card draws to well past the tallest it offers. */
const HEIGHTS = Array.from({ length: 16 }, (_, i) => 10 + 2 * i);

function tower(platformHeightFt: number) {
  return generateStructure({
    ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), platformHeightFt,
  });
}

test('A CLIMB PAST THE CAGE THRESHOLD IS NOT A LADDER, at any height a spec can ask for', () => {
  assert.equal(CAGE, 20, 'the doctrine figure this is measured against');
  for (const h of HEIGHTS) {
    const m = tower(h);
    const spec = m.spec as unknown as { access: string };
    const rails = m.members.filter((x) => x.role === 'ladderRail').length;
    const want: 'stair' | 'ladder' = h > CAGE ? 'stair' : 'ladder';
    assert.equal(spec.access, want,
      `a ${h}-ft tower comes back with access '${spec.access}' against a ${CAGE}-ft cage threshold`);
    assert.equal(rails > 0, want === 'ladder',
      `a ${h}-ft tower has ${rails} ladder rails and its access is '${spec.access}'`);
    if (want === 'stair') {
      assert.ok(m.members.some((x) => x.role === 'stringer'), `a ${h}-ft tower has no stair stringer`);
      // And the user is TOLD, because it is not what they asked for.
      assert.ok(m.issues.some((i) => i.path === 'access' && i.kind === 'forced'),
        `a ${h}-ft tower was switched to a stair silently`);
    }
  }
});

test('and below it a ladder is still a ladder — the force is a threshold, not a ban', () => {
  // The guard on the other direction. Widening the rule until every tower gets a stair would pass
  // the test above and delete the ladder from the toolkit.
  for (const h of HEIGHTS.filter((v) => v <= CAGE)) {
    const m = tower(h);
    assert.equal(m.members.filter((x) => x.role === 'ladderRail').length, 2, `a ${h}-ft tower has two rails`);
    assert.equal(m.members.filter((x) => x.role === 'stringer').length, 0, `a ${h}-ft tower has stair stringers`);
    assert.ok(!m.issues.some((i) => i.path === 'access' && i.kind === 'forced'),
      `a ${h}-ft tower is inside the threshold and was switched anyway`);
  }
  // And the shipped card is untouched: 16 ft, a ladder, exactly as before.
  const preset = generateStructure(JSON.parse(JSON.stringify(familyById('tower')!.preset)));
  assert.equal(preset.members.filter((x) => x.role === 'ladderRail').length, 2);
});

test('ONE POST PER HOLE, where one railed surface meets another', () => {
  let checked = 0;
  for (const h of HEIGHTS) {
    const posts = tower(h).members.filter((x) => x.role === 'railPost');
    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        checked++;
        const g = gap(posts[i]!, posts[j]!);
        assert.ok(g >= -1e-9,
          `${h} ft: ${posts[i]!.id} and ${posts[j]!.id} share ${(-g * IN_PER_FT).toFixed(3)} in — `
          + 'a flight sets a post where its rail runs out and the surface it runs out on set another');
      }
    }
  }
  assert.ok(checked > 2000, `${checked} post pairs across the heights`);
});

test('and every corner is still posted — the flight keeps its post, the landing drops that one', () => {
  // What must NOT happen: suppressing the landing's whole railing would pass the test above and
  // leave a switchback with two open corners at every turn. At each landing there are FOUR posts
  // at four distinct spots — two set by the flights whose rails run out there, two by the landing
  // itself — and at the platform the last flight's two stand among the guardrail's.
  for (const h of [24, 32]) {
    const posts = tower(h).members.filter((x) => x.role === 'railPost');
    const byFoot = new Map<string, Member[]>();
    for (const p of posts) {
      const k = (p.position[1] - p.cutLength / 24).toFixed(3);
      byFoot.set(k, [...(byFoot.get(k) ?? []), p]);
    }
    const landings = [...byFoot.entries()].filter(([, v]) => v.some((p) => /^ACL\d/.test(p.id)));
    assert.ok(landings.length >= 2, `${h} ft: ${landings.length} landings carry a railing`);
    for (const [foot, v] of landings) {
      const flight = v.filter((p) => p.id.startsWith('AC-')).length;
      const own = v.filter((p) => /^ACL\d/.test(p.id)).length;
      assert.equal(flight, 2, `${h} ft, landing at ${foot}: ${flight} flight posts, not the two its rails run out at`);
      assert.equal(own, 2, `${h} ft, landing at ${foot}: ${own} posts of its own — a landing turns four corners`);
      const spots = new Set(v.map((p) => `${p.position[0].toFixed(4)}|${p.position[2].toFixed(4)}`));
      assert.equal(spots.size, 4, `${h} ft, landing at ${foot}: ${v.length} posts on ${spots.size} spots`);
    }
    // The platform at the top: the guardrail's own posts, plus the arriving flight's two.
    const deck = [...byFoot.entries()].find(([, v]) => v.some((p) => p.id.startsWith('RL-')));
    assert.ok(deck, `${h} ft: no railed platform`);
    assert.equal(deck![1].filter((p) => p.id.startsWith('AC-')).length, 2,
      `${h} ft: the last flight does not stand its two posts on the deck`);
    assert.ok(deck![1].filter((p) => p.id.startsWith('RL-')).length >= 2,
      `${h} ft: the platform guardrail has no posts of its own`);
    // And it still RAILS every edge: told about a post is not the same as told to stop. Four deck
    // edges — one of them split by the access gap — plus the bridge's two.
    const rl = tower(h).members.filter((x) => x.id.startsWith('RL-'));
    for (const role of ['railTop', 'railMid', 'toeBoard']) {
      assert.ok(rl.filter((x) => x.role === role).length >= 6,
        `${h} ft: ${rl.filter((x) => x.role === role).length} ${role} on the platform — the guardrail `
        + 'has been suppressed rather than told');
    }
  }
});
