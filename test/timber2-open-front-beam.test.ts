// The beam over an open front, where two bays meet.
//
// `openFront` names one wall as the whole opening — a storage shed you back a vehicle into — and
// the pass that built it laid one beam per bay, `bayFt + postD` long, centred on the bay. That
// reaches half a post past BOTH ends, which is wrong at both:
//
//   gp-frame, front open on S, 48 ft, six 8-ft bays
//     OF-header-01  x −0.146 .. 8.146      OF-header-02  x 7.854 .. 16.146     …
//     5 header x header pairs at 1.500 in — a 3½ x 9¼ x 1½-in block of wood shared
//     2 header x siding pairs at 1.750 in — both end beams past the corner, into the side wall
//
// At an interior post the two beams meeting there each covered the WHOLE post, so each was a post
// deep inside the other. At the corners the beam stood 1¾ in past the building line and into the
// adjacent wall's skin.
//
// A SPLICE OVER A POST LANDS ON ITS CENTRELINE — half the post under each beam, which is the joint
// two beams butting over a post actually make. The two ends go the other way and run to the plan
// line: the corner posts are already held half a post inside the corner so they stand ON it, so
// the beam that reaches them bears on the whole post and stops where the building does.
//
// No shipped card sets `openFront` — the storage-shed card offers it in words and ships with a
// doorway instead — so this is reachable from the picker's own control and from a link, and every
// preset is untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { LAYOUT, LUMBER, IN_PER_FT } from '../src/timber/doctrine';
import { headerForSpan } from '../src/timber/normalize';
import { DRESSED } from '../src/timber/types';
import type { Member, WallId } from '../src/timber/types';

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

const CARDS = ['gp-frame', 'storage-shed', 'custom'] as const;
const WALLS: WallId[] = ['S', 'N', 'E', 'W'];
const SKIN = ['siding', 'sidingBoard', 'batten', 'sheathingPanel'];

function open(id: (typeof CARDS)[number], wall: WallId) {
  const spec = JSON.parse(JSON.stringify(familyById(id)!.preset)) as Record<string, unknown>;
  spec.openFront = wall;
  const members = generateStructure(spec as never).members;
  const dims = (spec.dims as { lengthFt: number; widthFt: number });
  return {
    members,
    beams: members.filter((m) => m.id.startsWith('OF-') && m.role === 'header'),
    posts: members.filter((m) => m.id.startsWith('OF-') && m.role === 'post'),
    /** The plan axis this wall runs along, and how far. */
    axis: (wall === 'N' || wall === 'S' ? 0 : 2) as 0 | 2,
    dims,
  };
}

test('NO TWO BEAMS OVER AN OPEN FRONT SHARE WOOD', () => {
  let checked = 0;
  for (const id of CARDS) {
    for (const wall of WALLS) {
      const { beams } = open(id, wall);
      assert.ok(beams.length >= 2, `${id}/${wall}: ${beams.length} beams over the opening`);
      for (let i = 0; i < beams.length; i++) {
        for (let j = i + 1; j < beams.length; j++) {
          checked++;
          const g = gap(beams[i]!, beams[j]!);
          assert.ok(g >= -1e-9,
            `${id}, front open on ${wall}: ${beams[i]!.id} and ${beams[j]!.id} share `
            + `${(-g * IN_PER_FT).toFixed(3)} in — two beams butt over the post they share`);
        }
      }
    }
  }
  assert.ok(checked > 40, `${checked} beam pairs across the cards and walls`);
});

test('and nothing over an open front stands past the building line', () => {
  for (const id of CARDS) {
    for (const wall of WALLS) {
      const { members, beams, posts, axis } = open(id, wall);
      // The opening's own extent, from the posts that define it.
      const lo = Math.min(...posts.map((m) => axisExtent(m, axis)[0]));
      const hi = Math.max(...posts.map((m) => axisExtent(m, axis)[1]));
      for (const b of beams) {
        const e = axisExtent(b, axis);
        assert.ok(e[0] >= lo - 1e-9 && e[1] <= hi + 1e-9,
          `${id}/${wall}: ${b.id} runs ${e[0].toFixed(4)}..${e[1].toFixed(4)} against posts standing `
          + `${lo.toFixed(4)}..${hi.toFixed(4)} — ${(Math.max(lo - e[0], e[1] - hi) * IN_PER_FT).toFixed(3)} in over`);
      }
      // And out of the neighbouring walls' skin, which is what it ran into.
      const skin = members.filter((m) => SKIN.includes(m.role) && m.wall !== wall);
      for (const b of beams) {
        for (const s of skin) {
          assert.ok(gap(b, s) >= -1e-9,
            `${id}/${wall}: ${b.id} is ${(-gap(b, s) * IN_PER_FT).toFixed(3)} in inside ${s.id} on `
            + `wall ${s.wall}`);
        }
      }
    }
  }
});

test('and the beam line is CONTINUOUS — spliced on the posts, not gapped between them', () => {
  // The guard on the other direction, and the one a fix by shortening would fail: beams pulled
  // back to clear each other would pass the test above and leave the plates unsupported between
  // bays. Every splice lands on a post's centreline, with half that post under each beam.
  const postD = DRESSED[LUMBER.postNominal.value as string]!.d / IN_PER_FT;
  for (const id of CARDS) {
    for (const wall of WALLS) {
      const { beams, posts, axis } = open(id, wall);
      const sorted = [...beams].sort((a, b) => axisExtent(a, axis)[0] - axisExtent(b, axis)[0]);
      for (let i = 1; i < sorted.length; i++) {
        const joint = axisExtent(sorted[i - 1]!, axis)[1];
        assert.ok(Math.abs(joint - axisExtent(sorted[i]!, axis)[0]) < 1e-9,
          `${id}/${wall}: a ${((axisExtent(sorted[i]!, axis)[0] - joint) * IN_PER_FT).toFixed(3)} in gap `
          + `between ${sorted[i - 1]!.id} and ${sorted[i]!.id}`);
        // On a post, and on its middle: half the post bears each beam.
        const under = posts.map((p) => axisExtent(p, axis))
          .find((e) => e[0] <= joint + 1e-9 && e[1] >= joint - 1e-9);
        assert.ok(under, `${id}/${wall}: the splice at ${joint.toFixed(4)} lands on no post`);
        assert.ok(Math.abs((under![0] + under![1]) / 2 - joint) < 1e-9,
          `${id}/${wall}: the splice at ${joint.toFixed(4)} is `
          + `${(Math.abs((under![0] + under![1]) / 2 - joint) * IN_PER_FT).toFixed(3)} in off the post's centre`);
      }
      // And the two end beams bear on the WHOLE corner post, which is held inside the line.
      for (const [end, e] of [[0, axisExtent(sorted[0]!, axis)[0]],
        [1, axisExtent(sorted[sorted.length - 1]!, axis)[1]]] as [number, number][]) {
        const corner = posts.map((p) => axisExtent(p, axis))
          .find((q) => q[0] <= e + 1e-9 && q[1] >= e - 1e-9);
        assert.ok(corner, `${id}/${wall}: end ${end} of the beam line lands on no post`);
        assert.ok(Math.abs(corner![end === 0 ? 0 : 1] - e) < 1e-9,
          `${id}/${wall}: the beam stops ${(Math.abs(corner![end === 0 ? 0 : 1] - e) * IN_PER_FT).toFixed(3)} in `
          + `from the corner post's outer face, and ${(postD * IN_PER_FT).toFixed(1)} in is the whole post`);
      }
    }
  }
});

test('and the bay schedule is what it always was — one beam per bay, sized for that bay', () => {
  // What must NOT change. The beams got shorter; the bays, the posts and the beam table did not.
  for (const id of CARDS) {
    for (const wall of WALLS) {
      const { beams, posts, axis, dims } = open(id, wall);
      const runFt = (wall === 'N' || wall === 'S' ? dims.lengthFt : dims.widthFt)
        - (wall === 'N' || wall === 'S' ? 0 : 2 * (DRESSED['2x4']!.d / IN_PER_FT));
      const bays = Math.max(1, Math.ceil(runFt / (LAYOUT.postSpacingMaxFt.value as number)));
      assert.equal(beams.length, bays, `${id}/${wall}: ${beams.length} beams over ${bays} bays`);
      assert.equal(posts.length, bays + 1, `${id}/${wall}: ${posts.length} posts for ${bays} bays`);
      const want = headerForSpan(runFt / bays);
      for (const b of beams) {
        assert.equal(b.nominal, want,
          `${id}/${wall}: ${b.id} is a ${b.nominal} where the table says ${want} for a `
          + `${(runFt / bays).toFixed(2)} ft bay`);
      }
      // The line spans the whole opening, end to end.
      const span = Math.max(...beams.map((m) => axisExtent(m, axis)[1]))
        - Math.min(...beams.map((m) => axisExtent(m, axis)[0]));
      assert.ok(Math.abs(span - runFt) < 1e-9,
        `${id}/${wall}: the beam line spans ${span.toFixed(4)} ft of a ${runFt.toFixed(4)} ft opening`);
    }
  }
});
