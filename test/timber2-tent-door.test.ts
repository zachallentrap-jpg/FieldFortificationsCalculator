// The tent frame's framed end door.
//
// `endDoor` has been on `TentFrameSpec` since the family was written, BOTH shipped tent presets
// set it `true`, and the planning card offers it as a live toggle labelled "Framed end door".
// NOTHING READ IT. Turning it off produced a model byte-identical to leaving it on — the same
// 105 members on the GP Small, the same bill — so the knob moved and the drawing did not. Same
// class as `fill`, `entrySteps`, `openFront`, `partitions` and `shutters` before it, and the
// fifth time this sweep has found a field the spec carries and no generator consumes.
//
// What it is now: a doorway framed in the END BENT'S OWN PLANE — two jambs on the deck and a head
// across them. There is no wall here to cut a hole in, which is exactly why it has to be FRAMED:
// a tent frame is a deck and a rank of bents, and the end is closed by canvas that laces to this.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { OPENING, IN_PER_FT } from '../src/timber/doctrine';
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

/**
 * Least separation over the 15 separating axes. Positive is a TRUE clearance; negative means the
 * two oriented boxes overlap. An AABB round a bent rafter spans its whole lean and reports a
 * clash with anything under it — which is what it did here, four times, before this was SAT.
 */
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

function box(m: Member): { x: [number, number]; y: [number, number]; z: [number, number] } {
  const h = halfExtents(m);
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const TENTS = ['tent-floor', 'strongback'] as const;
const frame = (id: (typeof TENTS)[number], endDoor: boolean) => {
  const spec = JSON.parse(JSON.stringify(familyById(id)!.preset));
  spec.endDoor = endDoor;
  return generateStructure(spec);
};
const doorPieces = (m: ReturnType<typeof generateStructure>): Member[] =>
  m.members.filter((k) => k.role === 'post' || k.role === 'header');

test('THE TOGGLE DOES SOMETHING — "Framed end door" used to move and change nothing', () => {
  for (const id of TENTS) {
    const on = frame(id, true);
    const off = frame(id, false);
    assert.ok(on.members.length > off.members.length,
      `${id}: ${on.members.length} members with the end door and ${off.members.length} without — `
      + 'the toggle is still not read');
    assert.equal(doorPieces(off).length, 0, `${id}: a door frame with the toggle OFF`);
    // Two jambs and a head, at each of the two ends.
    const on2 = doorPieces(on);
    assert.equal(on2.filter((m) => m.role === 'post').length, 4, `${id}: jambs`);
    assert.equal(on2.filter((m) => m.role === 'header').length, 2, `${id}: heads`);
    // And nothing else moved: the door is added, it does not re-lay the frame under it.
    const others = (mm: ReturnType<typeof generateStructure>): string =>
      mm.members.filter((k) => k.role !== 'post' && k.role !== 'header')
        .map((k) => `${k.id}|${k.position.map((v) => v.toFixed(6)).join(',')}`).join(';');
    assert.equal(others(on), others(off), `${id}: turning the end door on moved something else`);
  }
});

test('and it is the toolkit’s own rough opening, standing on the deck', () => {
  // 3 ft by 6 ft 8 in of CLEAR opening, measured between the jambs and from the deck to the
  // head's underside — the same hole `OPENING` gives a hut door, so a tent door is not a second
  // opinion about what a doorway is.
  const wantW = OPENING.doorWidthFt.value as number;
  const wantH = OPENING.doorHeightFt.value as number;
  for (const id of TENTS) {
    const model = frame(id, true);
    const deckTop = Math.max(...model.members.filter((m) => m.role === 'deckPlank').map((m) => box(m).y[1]));
    const jambs = model.members.filter((m) => m.role === 'post').map((m) => ({ m, b: box(m) }));
    const heads = model.members.filter((m) => m.role === 'header').map((m) => ({ m, b: box(m) }));
    assert.equal(heads.length, 2, `${id}: ${heads.length} end-door heads — a tent frame has two ends`);
    for (const h of heads) {
      const mine = jambs.filter((j) => Math.abs(j.m.position[0] - h.m.position[0]) < 1e-9)
        .sort((a, b) => a.b.z[0] - b.b.z[0]);
      assert.equal(mine.length, 2, `${id}: ${h.m.id} has ${mine.length} jambs under it`);
      const clear = mine[1]!.b.z[0] - mine[0]!.b.z[1];
      assert.ok(Math.abs(clear - wantW) < 1e-9,
        `${id}: the clear opening is ${clear.toFixed(4)} ft, not the ${wantW} ft doctrine gives a door`);
      for (const j of mine) {
        assert.ok(Math.abs(j.b.y[0] - deckTop) < 1e-9,
          `${id}: ${j.m.id} starts at ${j.b.y[0].toFixed(4)} and the deck tops out at ${deckTop.toFixed(4)} — `
          + `${((j.b.y[0] - deckTop) * IN_PER_FT).toFixed(3)} in of air under a jamb`);
        assert.ok(Math.abs(j.b.y[1] - h.b.y[0]) < 1e-9,
          `${id}: ${j.m.id} tops out at ${j.b.y[1].toFixed(4)} and its head starts at ${h.b.y[0].toFixed(4)}`);
      }
      assert.ok(Math.abs((h.b.y[0] - deckTop) - wantH) < 1e-9,
        `${id}: the head is ${(h.b.y[0] - deckTop).toFixed(4)} ft over the deck, not ${wantH.toFixed(4)}`);
      // The head bears on both jambs rather than sitting between them.
      assert.ok(h.b.z[0] <= mine[0]!.b.z[0] + 1e-9 && h.b.z[1] >= mine[1]!.b.z[1] - 1e-9,
        `${id}: ${h.m.id} spans ${h.b.z[0].toFixed(4)}..${h.b.z[1].toFixed(4)} and its jambs stand `
        + `${mine[0]!.b.z[0].toFixed(4)}..${mine[1]!.b.z[1].toFixed(4)} — it does not reach them`);
    }
  }
});

test('and it shares no wood with the bent it stands in', () => {
  // Measured with SAT on oriented boxes. The collar tie crosses the doorway at eave height and
  // is lapped BESIDE the bent, so it passes the jambs face to face at exactly 0.000 in — which a
  // box test round the raked rafters could not have told apart from four real collisions, and
  // duly reported four.
  for (const id of TENTS) {
    const model = frame(id, true);
    const door = doorPieces(model);
    assert.equal(door.length, 6, `${id}: ${door.length} door pieces — two jambs and a head at each end`);
    for (const d of door) {
      for (const o of model.members) {
        if (o.id === d.id) continue;
        // A jamb and its own head meet by design; so do the two ends' frames with nothing.
        if ((o.role === 'post' || o.role === 'header') && Math.abs(o.position[0] - d.position[0]) < 1e-9) continue;
        const g = gap(d, o);
        assert.ok(g >= -1e-9,
          `${id}: ${d.id} and ${o.id} (${o.role}) share ${(-g * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and you can walk through it — the bent’s own rafters clear the opening', () => {
  // The reason a tent door is not simply "a hole in the end": the end bent's rafters come down
  // across that end, and a doorway put anywhere without checking them would have a rafter through
  // it. Sampled up the opening's two sides and across its head.
  for (const id of TENTS) {
    const model = frame(id, true);
    const rafters = model.members.filter((m) => m.role === 'bentRafter' || m.role === 'bentCollar');
    const heads = model.members.filter((m) => m.role === 'header');
    const jambs = model.members.filter((m) => m.role === 'post');
    assert.equal(heads.length, 2, `${id}: no doorway to walk through`);
    const deckTop = Math.max(...model.members.filter((m) => m.role === 'deckPlank').map((m) => box(m).y[1]));
    for (const h of heads) {
      const mine = jambs.filter((j) => Math.abs(j.position[0] - h.position[0]) < 1e-9)
        .map((j) => box(j)).sort((a, b) => a.z[0] - b.z[0]);
      const z0 = mine[0]!.z[1], z1 = mine[1]!.z[0];
      const yTop = box(h).y[0];
      // Every point of the clear opening, on the end plane: is any bent member standing in it?
      for (let i = 0; i <= 12; i++) {
        for (let j = 0; j <= 12; j++) {
          const p: V3 = [h.position[0], deckTop + (yTop - deckTop) * j / 12, z0 + (z1 - z0) * i / 12];
          for (const r of rafters) {
            const d: V3 = [p[0] - r.position[0], p[1] - r.position[1], p[2] - r.position[2]];
            const hr = halfExtents(r);
            const inIt = axesOf(r).every((a, k) => Math.abs(dot(d, a)) <= hr[k]! - 1e-9);
            assert.ok(!inIt, `${id}: ${r.id} (${r.role}) stands in the doorway at `
              + `${p.map((v) => v.toFixed(3)).join(', ')}`);
          }
        }
      }
    }
  }
});
