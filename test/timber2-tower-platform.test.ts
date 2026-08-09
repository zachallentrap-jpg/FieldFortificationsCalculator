// The guard tower's platform frame — where a leg stops, and what a joist lands on.
//
// A LEG STOPS UNDER THE PLATFORM IT CARRIES. Every leg was run to `platformHeightFt`, which is the
// DECK's own line, so the top 7¼ in of each one stood in the joists' band. The two outermost joists
// sit on the leg lines by construction, so each of them ran through two corner legs — 4 pairs,
// 2.74 in a piece — and the platform was inside the frame instead of on it.
//
// A JOIST IS AS LONG AS THE THING IT BEARS ON. Cut to the cab plan, which is the leg square at the
// DECK, every joist stopped 0.05 in inside the girt beneath it: the girts are struck a joist's
// depth lower, where the batter has already carried the frame 0.7 in further out, so a joist's end
// kissed the girt's inner arris instead of sitting on it.
//
//   joist x towerLeg                      4 / 2.74 in   ->   0
//   a joist's bearing on the girt under it     0.05 in  ->   1.50 (the girt's full thickness)
//
// AND THE BATTER IS STRUCK OVER THE LEG'S OWN CLIMB. `halfAt` measured it from the foot to
// `platformHeightFt`; a leg that stops short of that only realises part of it — 1.4417 ft per side
// against the 1.5 the card locks, which the life-safety register's own test caught. `topY` moves
// the top of that span the way `baseY` already moved the bottom for a mudsill.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { TOWER, IN_PER_FT } from '../src/timber/doctrine';
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

const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

function tower(opts: Record<string, unknown> = {}) {
  const spec = { ...JSON.parse(JSON.stringify(familyById('tower')!.preset)), ...opts };
  const model = generateStructure(spec);
  const joists = model.members.filter((m) => m.role === 'joist');
  assert.ok(joists.length >= 2, `${joists.length} platform joists`);
  return { model, joists, spec: model.spec as unknown as { platformHeightFt: number; cabPlanFt: number } };
}

const OPTIONS: Record<string, unknown>[] = [
  {}, { footing: 'concrete-pad' }, { platformHeightFt: 24 }, { cabPlanFt: 10 },
];

test('A LEG STOPS UNDER THE PLATFORM — the outer joists used to run through two of them each', () => {
  for (const opts of OPTIONS) {
    const { model, joists } = tower(opts);
    const label = JSON.stringify(opts);
    const legs = model.members.filter((m) => m.role === 'towerLeg');
    assert.equal(legs.length, 4, `${label}: ${legs.length} legs`);
    // ALL THAT IS LEFT IS THE SQUARE END CUT, which is the same bound `timber2-tower-footing`
    // puts on the leg's other end: a box end is square to its own AXIS, so on a raked leg the
    // arris stands proud of the point the axis stops by half the section across the lean. The
    // axis has to run corner to corner — the batter the card locks is measured between those two
    // points — so the protrusion is owned rather than trimmed away. It is 0.149 in of a joist
    // here; it was 2.74 in of leg through a joist before.
    const legW = DRESSED[TOWER.legNominal.value as string]!.d / IN_PER_FT;
    for (const l of legs) {
      // How far the square end's high arris stands above the point the axis stops: half the
      // section, projected on the vertical through the leg's own two section axes.
      const rise = (legW / 2) * (Math.abs(rotate(l, [0, 1, 0])[1]) + Math.abs(rotate(l, [0, 0, 1])[1]));
      for (const j of joists) {
        const s = gap(j, l);
        assert.ok(s >= -rise - 1e-9,
          `${label}: ${j.id} and ${l.id} share ${(-s * IN_PER_FT).toFixed(3)} in of wood — more than the `
          + `${(rise * IN_PER_FT).toFixed(3)} in a square cut on a leg at this pitch accounts for`);
      }
    }
    // The head of a leg is at the joists' undersides — measured on the AXIS, because a raked
    // member cut square carries its arris above the point its centre line ends at.
    const joistLo = Math.min(...joists.map((m) => box(m).y[0]));
    for (const l of legs) {
      const t = rotate(l, [1, 0, 0]);
      const head = l.position[1] + Math.abs(t[1]) * (l.cutLength / 24);
      assert.ok(Math.abs(head - joistLo) < 1e-9,
        `${label}: ${l.id}'s head is at ${head.toFixed(4)} and the joists start at ${joistLo.toFixed(4)}`);
    }
  }
});

test('and a JOIST RUNS TO THE GIRT IT BEARS ON, not to 0.05 in of its arris', () => {
  const girtT = DRESSED[TOWER.girtNominal.value as string]!.w / IN_PER_FT;
  for (const opts of OPTIONS) {
    const { model, joists } = tower(opts);
    const label = JSON.stringify(opts);
    const girts = model.members.filter((m) => m.role === 'girt').map((m) => ({ m, b: box(m) }));
    const topY = Math.max(...girts.map((k) => k.b.y[1]));
    const tops = girts.filter((k) => Math.abs(k.b.y[1] - topY) < 1e-9);
    assert.equal(tops.length, 4, `${label}: ${tops.length} girts at the platform line`);
    // The two that run across the joists are the ones that carry them.
    const bearers = tops.filter((k) => k.b.z[1] - k.b.z[0] > k.b.x[1] - k.b.x[0]);
    assert.equal(bearers.length, 2, `${label}: ${bearers.length} girts run across the joists`);
    const lo = Math.min(...bearers.map((k) => k.b.x[0]));
    const hi = Math.max(...bearers.map((k) => k.b.x[1]));
    for (const j of joists) {
      const b = box(j);
      assert.ok(Math.abs(b.x[0] - lo) < 1e-9 && Math.abs(b.x[1] - hi) < 1e-9,
        `${label}: ${j.id} runs ${(b.x[0] * IN_PER_FT).toFixed(2)}..${(b.x[1] * IN_PER_FT).toFixed(2)} in and the `
        + `girts it bears on face ${(lo * IN_PER_FT).toFixed(2)} and ${(hi * IN_PER_FT).toFixed(2)}`);
      // And the joists that cross a bearer sit on its FULL thickness, not on its arris.
      for (const g of bearers) {
        if (ov(b.z, g.b.z) <= 1e-9) continue;
        assert.ok(Math.abs(ov(b.x, g.b.x) - girtT) < 1e-9,
          `${label}: ${j.id} laps ${g.m.id} by ${(ov(b.x, g.b.x) * IN_PER_FT).toFixed(3)} in, not the `
          + `${(girtT * IN_PER_FT).toFixed(2)} in the girt is thick`);
        assert.ok(Math.abs(b.y[0] - g.b.y[1]) < 1e-9, `${label}: ${j.id} does not sit on ${g.m.id}`);
      }
    }
  }
});

test('and the batter is still exactly what the card locks, struck over the leg\'s own climb', () => {
  // The guard on shortening the legs. `halfAt` measured the batter from the foot to the stated
  // platform height; a leg that now stops a joist below it only realises part of that unless the
  // datum moves with it — 1.4417 ft per side against 1.5, on a locked life-safety figure.
  const want = TOWER.batterPerSideFt.value as number;
  for (const opts of OPTIONS) {
    const { model } = tower(opts);
    const label = JSON.stringify(opts);
    const legs = model.members.filter((m) => m.role === 'towerLeg');
    const ends = legs.map((l) => {
      const t = rotate(l, [1, 0, 0]);
      const h = l.cutLength / 24;
      const a: V3 = [l.position[0] - t[0] * h, l.position[1] - t[1] * h, l.position[2] - t[2] * h];
      const b: V3 = [l.position[0] + t[0] * h, l.position[1] + t[1] * h, l.position[2] + t[2] * h];
      return a[1] < b[1] ? { foot: a, head: b } : { foot: b, head: a };
    });
    for (const axis of [0, 2] as const) {
      const spread = (pts: V3[]): number =>
        (Math.max(...pts.map((p) => p[axis])) - Math.min(...pts.map((p) => p[axis]))) / 2;
      const got = spread(ends.map((e) => e.foot)) - spread(ends.map((e) => e.head));
      assert.ok(Math.abs(got - want) < 1e-9,
        `${label}: the legs batter ${got.toFixed(4)} ft per side on axis ${axis}; the card locks ${want}`);
    }
  }
});

test('and the platform is still the size and height the card asked for', () => {
  // The guard on the whole change: a frame that sits on the legs instead of in them is only right
  // if the deck it carries did not move.
  for (const opts of OPTIONS) {
    const { model, joists, spec } = tower(opts);
    const label = JSON.stringify(opts);
    const deck = model.members.filter((m) => m.role === 'subfloor').map((m) => box(m));
    assert.ok(deck.length > 0, `${label}: no platform deck`);
    // MEASURED AT THE SURFACE YOU STAND ON. `platformHeightFt` used to be the FRAME's top with
    // the decking laid on it, so a tower asked for 16 ft walked at 16 ft 0¾ in; the frame now
    // drops by the decking and the surface lands where it was asked for.
    const walk = Math.max(...deck.map((b) => b.y[1]));
    assert.ok(Math.abs(walk - spec.platformHeightFt) < 1e-9,
      `${label}: the platform walks at ${walk.toFixed(4)}, not the stated ${spec.platformHeightFt}`);
    const frameTop = Math.max(...joists.map((m) => box(m).y[1]));
    const w = Math.max(...deck.map((b) => b.x[1])) - Math.min(...deck.map((b) => b.x[0]));
    const d = Math.max(...deck.map((b) => b.z[1])) - Math.min(...deck.map((b) => b.z[0]));
    assert.ok(Math.abs(w - spec.cabPlanFt) < 1e-9 && Math.abs(d - spec.cabPlanFt) < 1e-9,
      `${label}: the deck is ${w.toFixed(3)} x ${d.toFixed(3)} ft, not the ${spec.cabPlanFt} ft square asked for`);
    assert.ok(Math.abs(Math.min(...deck.map((b) => b.y[0])) - frameTop) < 1e-9,
      `${label}: the deck does not lie on the joists`);
  }
});
