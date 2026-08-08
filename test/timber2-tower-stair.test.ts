// The guard tower's stair, against the tower.
//
// CLEAR OF THE FRAME, WHICH IS NOT THE DECK EDGE. The well was struck off the platform's front
// edge, and a battered tower's base is two feet wider than its deck on every side — so the stair
// stood inside its own tower. On the shipped preset the lowest flight's foot sat on the deck-edge
// line at ground level, where the frame reaches 23.94 in further out, and the run crossed the
// front face's bracing on the way down:
//
//   stringer x brace 3.46 in   stringer x mudsill 1.19   tread x brace 0.80   railMid x brace 2.66
//   the top flight through the platform's own edge girt 6.28 and its rim joist 4.91
//
// This is the LADDER's lesson applied to the other way up: that fix reads the frame's own batter
// curve rather than the deck edge, and holds the clearance at every rung. The datum here is read
// off the frame AS BUILT — the members already emitted — so the batter, the legs' section and the
// bracing's standoff cannot drift away from it.
//
// TWO PASSES, because a switchback is deeper than its arrival: every landing runs forward from
// where its two flights meet by at least the stair's own width, so on a three-flight run the first
// turn reaches back under the tower even when the arrival is clear (3.75 in of its toe board
// inside the bay-1 girt). Laid out once, measured, and moved back by whatever still reaches past.
//
// AND A LANDING BRIDGES BACK TO THE DECK, because a stair that stops short of what it serves is
// not one — 3 ft 2 in of it on a 16-ft tower, 5 ft 3 in on a 24-ft one, decked in the stair's own
// planks and railed on both open sides by the platform's pass.
//
//   stair members sharing wood with the frame   16 ft: 14 -> 0    24 ft: 18 -> 0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { TOWER, RAIL, IN_PER_FT } from '../src/timber/doctrine';
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

/**
 * Least separation over the 15 separating axes. Positive is a TRUE clearance — and nothing else
 * would do here: a stringer climbs a whole flight, so the box round one spans the well.
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

interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

function box(m: Member): Box {
  const h = halfExtents(m);
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const FRAME = ['towerLeg', 'girt', 'towerBrace', 'sill', 'footing', 'joist', 'subfloor'];
/** The stair's own pieces — `generateStair` prefixes its rails per landing (AC, ACL1, ACL2…). */
const isStair = (m: Member): boolean => /^AC/.test(m.id);

function stairTower(platformHeightFt: number) {
  const spec = {
    ...JSON.parse(JSON.stringify(familyById('tower')!.preset)),
    access: 'stair',
    platformHeightFt,
  };
  const model = generateStructure(spec);
  const stair = model.members.filter(isStair);
  assert.ok(stair.length > 20, `${platformHeightFt} ft: ${stair.length} stair members`);
  return { model, stair, spec: model.spec as unknown as { cabPlanFt: number; platformHeightFt: number } };
}

const HEIGHTS = [16, 24];

test('THE STAIR STANDS OUTSIDE THE FRAME — its foot used to be under the tower', () => {
  for (const h of HEIGHTS) {
    const { model, stair } = stairTower(h);
    const frame = model.members.filter((m) => FRAME.includes(m.role));
    assert.ok(frame.length > 20, `${h} ft: ${frame.length} frame members`);
    for (const s of stair) {
      for (const f of frame) {
        const g = gap(s, f);
        assert.ok(g >= -1e-6,
          `${h} ft: ${s.id} (${s.role}) and ${f.id} (${f.role}) share ${(-g * IN_PER_FT).toFixed(3)} in of wood`);
      }
    }
  }
});

test('and clear of it by the doctrine figure, at every height — not just where it lands', () => {
  // The claim the ladder's fix made and this one inherits. Measured against the frame's WIDEST
  // line, which is at the feet: a stair inside that line is inside the tower somewhere.
  const clear = TOWER.ladderClearanceFt.value as number;
  for (const h of HEIGHTS) {
    const { model, stair } = stairTower(h);
    const frameFace = Math.min(...model.members.filter((m) => FRAME.includes(m.role)).map((m) => box(m).z[0]));
    const nearest = Math.max(...stair.map((m) => box(m).z[1]));
    assert.ok(nearest <= frameFace - clear + 1e-9,
      `${h} ft: the stair reaches z=${(nearest * IN_PER_FT).toFixed(2)} in and the frame's widest line is `
      + `${(frameFace * IN_PER_FT).toFixed(2)} — ${((frameFace - nearest) * IN_PER_FT).toFixed(2)} in of gap, `
      + `not the ${(clear * IN_PER_FT).toFixed(1)} in doctrine asks for`);
  }
});

test('and a LANDING BRIDGES back to the deck — unbroken, at the deck line, the stair\'s width', () => {
  for (const h of HEIGHTS) {
    const { model, stair, spec } = stairTower(h);
    const label = `${h} ft`;
    // The tower's own piece, not one of the stair's turns.
    const bridge = model.members.filter((m) => m.role === 'deckPlank' && m.id.startsWith('TW-')).map(box);
    assert.ok(bridge.length > 0, `${label}: the stair stands off the frame and nothing bridges the gap`);
    const deckEdge = (spec.cabPlanFt / 2 + (TOWER.batterPerSideFt.value as number)) - spec.cabPlanFt / 2;
    const near = Math.min(...bridge.map((b) => b.z[0]));
    const far = Math.max(...bridge.map((b) => b.z[1]));
    assert.ok(Math.abs(far - deckEdge) < 1e-9,
      `${label}: the bridge ends at z=${(far * IN_PER_FT).toFixed(2)} in, not at the deck edge ${(deckEdge * IN_PER_FT).toFixed(2)}`);
    const arrival = Math.max(...stair.filter((m) => m.role === 'tread').map((m) => box(m).z[1]));
    assert.ok(near <= arrival + 1e-9,
      `${label}: the bridge starts at z=${(near * IN_PER_FT).toFixed(2)} in and the top tread reaches `
      + `${(arrival * IN_PER_FT).toFixed(2)} — there is air between them`);
    // Decked without a gap, at one level, and as wide as the stair.
    const ys = [...new Set(bridge.map((b) => Math.round(b.y[1] * 1e6) / 1e6))];
    assert.equal(ys.length, 1, `${label}: the bridge is decked at ${ys.length} different levels`);
    // LEVEL WITH WHAT YOU STEP ONTO, which is the platform's DECKING and not its frame — the
    // tower's `platformHeightFt` is the joists' top and the subfloor lies on it, so a bridge
    // planked to that figure leaves a ¾-in step at the threshold.
    const walk = Math.max(...model.members.filter((m) => m.role === 'subfloor').map((m) => box(m).y[1]));
    assert.ok(Math.abs(ys[0]! - walk) < 1e-9,
      `${label}: the bridge decks to ${ys[0]!.toFixed(4)} and the platform walks at ${walk.toFixed(4)} — `
      + `a ${((walk - ys[0]!) * IN_PER_FT).toFixed(3)} in step at the threshold`);
    const width = Math.max(...bridge.map((b) => b.x[1])) - Math.min(...bridge.map((b) => b.x[0]));
    assert.ok(Math.abs(width - (TOWER.accessWidthFt.value as number)) < 1e-9,
      `${label}: the bridge is ${width.toFixed(3)} ft wide and the stair is ${TOWER.accessWidthFt.value}`);
    const edges = bridge.map((b) => b.z).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < edges.length; i++) {
      assert.ok(edges[i]![0] <= edges[i - 1]![1] + 1e-9,
        `${label}: a ${((edges[i]![0] - edges[i - 1]![1]) * IN_PER_FT).toFixed(3)} in gap in the bridge decking`);
    }
  }
});

test('and that landing is railed on both open sides, like any walking surface at height', () => {
  const topH = (RAIL.topHeightIn.value as number) / IN_PER_FT;
  for (const h of HEIGHTS) {
    const { model } = stairTower(h);
    const label = `${h} ft`;
    const bridge = model.members.filter((m) => m.role === 'deckPlank' && m.id.startsWith('TW-')).map(box);
    const near = Math.min(...bridge.map((b) => b.z[0]));
    const deckTop = Math.max(...bridge.map((b) => b.y[1]));
    // A rail run alongside the bridge: level, at the doctrine height over it, reaching back out
    // to where the stair arrives.
    //
    // TO WITHIN HALF A POST, not to the last inch of decking. The last flight sets a rail post at
    // each side of its head, on this bridge, and the bridge's rail now BUTTS that post's face
    // rather than running through it — `RailingInput.standing`, the same joint the cab's corner
    // posts make. `< near` was written when nothing stood there and the rail ran to the end.
    const postW = DRESSED[RAIL.postNominal.value as string]!.w / IN_PER_FT;
    const along = model.members.filter((m) => m.role === 'railTop' && m.id.startsWith('RL-')
      && Math.abs(m.rotation[2]) < 1e-9
      && Math.abs(m.position[1] - (deckTop + topH)) < 1e-6
      && box(m).z[0] < near + postW / 2 + 1e-6);
    assert.equal(along.length, 2,
      `${label}: ${along.length} rails run the bridge's open sides, not the two it has`);
    // And it does stop ON that post, not short of it and not through it.
    for (const m of along) {
      const short = box(m).z[0] - near;
      assert.ok(short >= -1e-9 && short <= postW / 2 + 1e-9,
        `${label}: ${m.id} stops ${(short * IN_PER_FT).toFixed(3)} in inside the bridge's far end, `
        + `and the flight's post there is ${(postW * IN_PER_FT).toFixed(1)} in across`);
    }
  }
});
