// The top of a bunker's end walls.
//
// "Caps along the two long walls, carrying the stringers." As a statement about what CARRIES the
// overhead that is right — the stringers span the width and land on those two. But a cap is not
// only a bearing: it is the course that closes the top of a wall, and with none on the ends the
// end walls stopped 7¼ in below the overhead they hold up:
//
//   wall lagging tops out 6.5000    stringer soffit 7.1042    two feet of earth above that
//
// leaving a slot the width of the bunker at each end, above the wall and under the stringers. A
// straight sight line right through the building, 5 ft 4 in of the 10-ft width, at both ends, on
// both wall types and with either entrance.
//
// THE HEADER ALREADY SAID SO. It is emitted as `capNominal` and documented in as many words as
// "the cap continued across the doorway" — which presupposes a cap on that wall for it to
// continue. There was none either side of it: the entrance end was a header hanging between two
// lengths of nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];
interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

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

function box(m: Member): Box {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const CASES = [
  { wallType: 'post-plank', entrance: 'baffle' },
  { wallType: 'post-plank', entrance: 'open' },
  { wallType: 'crib', entrance: 'baffle' },
  { wallType: 'crib', entrance: 'open' },
];

function bunker(wallType: string, entrance: string) {
  const spec = JSON.parse(JSON.stringify(familyById('crib-bunker')!.preset));
  spec.wallType = wallType;
  spec.entrance = entrance;
  const model = generateStructure(spec);
  const bs = model.members.filter((m) => m.role !== 'soilGhost').map((m) => ({ m, b: box(m) }));
  const caps = bs.filter((k) => k.m.role === 'capBeam');
  // The wall, whatever it is made of: planks and posts, or a stack of logs.
  const wall = bs.filter((k) => ['post', 'cribLog'].includes(k.m.role)
    || (k.m.role === 'lagging' && k.b.y[0] < 1));
  const mid = Math.max(...wall.map((k) => k.b.z[1])) / 2;
  return {
    model,
    bs,
    /** The course the caps occupy — the top of the wall, under the overhead. */
    band: [Math.min(...caps.map((k) => k.b.y[0])), Math.max(...caps.map((k) => k.b.y[1]))] as [number, number],
    /** Between the two long walls' inner faces: where a person stands. */
    interior: [
      Math.max(...wall.filter((k) => (k.b.z[0] + k.b.z[1]) / 2 < mid).map((k) => k.b.z[1])),
      Math.min(...wall.filter((k) => (k.b.z[0] + k.b.z[1]) / 2 > mid).map((k) => k.b.z[0])),
    ] as [number, number],
    wall,
  };
}

test('THE END WALLS REACH THEIR OVERHEAD — they used to stop 7 1/4 in short of it', () => {
  for (const { wallType, entrance } of CASES) {
    const { bs, band, interior } = bunker(wallType, entrance);
    const label = `${wallType}/${entrance}`;
    assert.ok(band[1] - band[0] > 0.4, `${label}: the cap course is ${(band[1] - band[0]).toFixed(4)} ft`);
    // Sample straight through the building along its LENGTH, at every height in that course.
    // Anywhere the ray passes clean through is a slot from one end of the bunker to the other.
    const mid = (band[0] + band[1]) / 2;
    const open: number[] = [];
    for (let i = 0; i < 400; i++) {
      const z = interior[0] + (interior[1] - interior[0]) * (i + 0.5) / 400;
      // Inside the doorway the wall is meant to be open below the header, but not up here.
      const clear = !bs.some((k) => k.b.z[0] <= z && z <= k.b.z[1] && k.b.y[0] <= mid && mid <= k.b.y[1]);
      if (clear) open.push(z);
    }
    assert.equal(open.length, 0, open.length
      ? `${label}: ${open.length} of 400 stations see clean through the building at y=${mid.toFixed(4)}, `
        + `z ${Math.min(...open).toFixed(3)}..${Math.max(...open).toFixed(3)} — that is the top of the `
        + 'end walls, open under two feet of earth'
      : '');
  }
});

test('and the cap course is continuous round all four walls, broken only by the doorway', () => {
  // Walked as a closed loop rather than counted: at every station round the perimeter, at the
  // middle of the cap course, there is a cap — or, on the entrance end only, the header that IS
  // the cap continued across the opening.
  for (const { wallType, entrance } of CASES) {
    const { bs, band } = bunker(wallType, entrance);
    const label = `${wallType}/${entrance}`;
    const caps = bs.filter((k) => k.m.role === 'capBeam' || k.m.role === 'header');
    assert.ok(caps.length >= 5, `${label}: ${caps.length} pieces in the cap course — two long walls `
      + 'and two ends, and the ends are interrupted by the doorway');
    const y = (band[0] + band[1]) / 2;
    // The rectangle a cap course runs on is the wall's own centreline, and the caps declare it:
    // the pieces lying along X give the two long walls' z, the pieces lying along Z give the two
    // ends' x. Reading it off the outer extents instead walks the loop along the OUTSIDE face,
    // where the long caps end and the end caps never were.
    const line = (along: 'x' | 'z'): number[] => [...new Set(caps
      .filter((k) => (k.b.x[1] - k.b.x[0] > k.b.z[1] - k.b.z[0]) === (along === 'x'))
      .map((k) => Math.round(((k.b[along === 'x' ? 'z' : 'x'][0] + k.b[along === 'x' ? 'z' : 'x'][1]) / 2) * 1e6) / 1e6))];
    const zs = line('x');
    const xs = line('z');
    assert.equal(zs.length, 2, `${label}: caps run along X on ${zs.length} lines`);
    assert.equal(xs.length, 2, `${label}: caps run along Z on ${xs.length} lines`);
    const gaps: string[] = [];
    for (let i = 0; i < 400; i++) {
      const t = (i + 0.5) / 400;
      const loop: [number, number][] = [
        [xs[0]! + (xs[1]! - xs[0]!) * t, zs[0]!],
        [xs[0]! + (xs[1]! - xs[0]!) * t, zs[1]!],
        [xs[0]!, zs[0]! + (zs[1]! - zs[0]!) * t],
        [xs[1]!, zs[0]! + (zs[1]! - zs[0]!) * t],
      ];
      for (const [x, z] of loop) {
        const held = caps.some((k) => k.b.x[0] - 1e-6 <= x && x <= k.b.x[1] + 1e-6
          && k.b.z[0] - 1e-6 <= z && z <= k.b.z[1] + 1e-6 && k.b.y[0] - 1e-6 <= y && y <= k.b.y[1] + 1e-6);
        if (!held) gaps.push(`(${x.toFixed(3)}, ${z.toFixed(3)})`);
      }
    }
    assert.equal(gaps.length, 0, gaps.length
      ? `${label}: ${gaps.length} stations on the wall line with no cap over them at y=${y.toFixed(4)} — `
        + `first ${gaps.slice(0, 4).join(' ')}`
      : '');
  }
});

test('and no cap runs into anything — they butt at the corners and bear on the wall', () => {
  // Closing a hole by overlapping is not closing it. The end caps butt between the long ones and
  // bear on the wall below, and the stringers land on top of them: three surfaces that touch and
  // must not share wood.
  const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  for (const { wallType, entrance } of CASES) {
    const { bs } = bunker(wallType, entrance);
    const caps = bs.filter((k) => k.m.role === 'capBeam');
    assert.ok(caps.length === 5, `${wallType}/${entrance}: ${caps.length} cap pieces`);
    for (const c of caps) {
      for (const o of bs) {
        if (o.m.id === c.m.id) continue;
        const d: V3 = [ov(c.b.x, o.b.x), ov(c.b.y, o.b.y), ov(c.b.z, o.b.z)];
        assert.ok(!d.every((v) => v > 1e-9),
          `${wallType}/${entrance}: ${c.m.id} and ${o.m.id} (${o.m.role}) share `
          + `${d.map((v) => (v * IN_PER_FT).toFixed(3)).join(' x ')} in of wood`);
      }
    }
    // And the course is one line: every piece of it starts and ends at the same two heights.
    const ys = [...caps, ...bs.filter((k) => k.m.role === 'header')].map((k) => k.b.y);
    for (const y of ys) {
      assert.ok(Math.abs(y[0] - ys[0]![0]) < 1e-9 && Math.abs(y[1] - ys[0]![1]) < 1e-9,
        `${wallType}/${entrance}: the cap course runs ${ys[0]![0].toFixed(4)}..${ys[0]![1].toFixed(4)} `
        + `and a piece of it is at ${y[0].toFixed(4)}..${y[1].toFixed(4)}`);
    }
  }
});

// ── One course higher: the bays between the stringers ────────────────────────
//
// THE BAY BETWEEN TWO STRINGERS IS A HOLE IN THE WALL. The stringers cross the side caps and the
// roof lagging goes over them, so between one stringer and the next there was a course as deep as
// a stringer, open at the wall face and leading straight down into the bunker:
//
//   stringer soffit 7.1042   roof lagging 7.7083   7020 sight lines clean through, every bay
//
// Exactly the same defect as the missing end cap, one course up, and found in the same walk. The
// two ENDS were already closed and by a rule worth stating: the outermost stringers sit flush
// with the end walls, so there is no bay there to fill.

test('NO BAY IS OPEN — the stringer course used to be a hole in each long wall', () => {
  for (const { wallType, entrance } of CASES) {
    const { bs } = bunker(wallType, entrance);
    const label = `${wallType}/${entrance}`;
    const stringers = bs.filter((k) => k.m.role === 'ohcStringer');
    const roof = bs.filter((k) => k.m.role === 'lagging' && k.b.y[0] > Math.max(...stringers.map((s) => s.b.y[0])));
    assert.ok(roof.length > 0, `${label}: no roof lagging over the stringers`);
    // The course between the stringers' soffit and the lagging over them.
    const band: [number, number] = [
      Math.min(...stringers.map((k) => k.b.y[0])),
      Math.min(...roof.map((k) => k.b.y[0])),
    ];
    assert.ok(band[1] - band[0] > 0.4, `${label}: the stringer course is ${(band[1] - band[0]).toFixed(4)} ft`);
    const y = (band[0] + band[1]) / 2;
    // Straight through the building along its WIDTH, at every station down its length: anywhere a
    // ray gets through is a bay open at both long walls.
    const xs = [Math.min(...stringers.map((k) => k.b.x[0])), Math.max(...stringers.map((k) => k.b.x[1]))];
    const open: number[] = [];
    for (let i = 0; i < 400; i++) {
      const x = xs[0]! + (xs[1]! - xs[0]!) * (i + 0.5) / 400;
      if (!bs.some((k) => k.b.x[0] <= x && x <= k.b.x[1] && k.b.y[0] <= y && y <= k.b.y[1])) open.push(x);
    }
    assert.equal(open.length, 0, open.length
      ? `${label}: ${open.length} of 400 stations see clean through the overhead at y=${y.toFixed(4)}, `
        + `x ${Math.min(...open).toFixed(3)}..${Math.max(...open).toFixed(3)} — those are the bays `
        + 'between the stringers, open at the wall and leading straight down inside'
      : '');
  }
});

test('and the blocking fills that course exactly, on the two long walls only', () => {
  for (const { wallType, entrance } of CASES) {
    const { bs } = bunker(wallType, entrance);
    const label = `${wallType}/${entrance}`;
    const stringers = bs.filter((k) => k.m.role === 'ohcStringer');
    const blocks = bs.filter((k) => k.m.role === 'ohcBlocking');
    assert.ok(blocks.length > 0, `${label}: no blocking at all`);
    // Two per bay, one over each side cap — and the bays are the gaps BETWEEN the stringers, so
    // there is one fewer bay than there are stringers.
    assert.equal(blocks.length, 2 * (stringers.length - 1),
      `${label}: ${blocks.length} blocks for ${stringers.length - 1} bays on two walls`);
    const sy: [number, number] = [Math.min(...stringers.map((k) => k.b.y[0])), Math.max(...stringers.map((k) => k.b.y[1]))];
    for (const b of blocks) {
      assert.ok(Math.abs(b.b.y[0] - sy[0]) < 1e-9 && Math.abs(b.b.y[1] - sy[1]) < 1e-9,
        `${label}: ${b.m.id} runs y ${b.b.y[0].toFixed(4)}..${b.b.y[1].toFixed(4)} where the stringers `
        + `run ${sy[0].toFixed(4)}..${sy[1].toFixed(4)} — it does not fill the course it is in`);
    }
    // THE ENDS NEED NONE: the outermost stringers are flush with the end walls, so there is no
    // bay there. Stated as a measurement, because it is the reason blocking is a two-wall job.
    // From the SIDE CAPS, which run the building's length. Taken off every member instead, the
    // baffle walls stand outside the entrance and move the answer several feet.
    const side = bs.filter((k) => k.m.role === 'capBeam' && k.b.x[1] - k.b.x[0] > k.b.z[1] - k.b.z[0]);
    const ends = [Math.min(...side.map((k) => k.b.x[0])), Math.max(...side.map((k) => k.b.x[1]))];
    assert.ok(Math.abs(Math.min(...stringers.map((k) => k.b.x[0])) - ends[0]!) < 1e-9
      && Math.abs(Math.max(...stringers.map((k) => k.b.x[1])) - ends[1]!) < 1e-9,
    `${label}: the end stringers are not flush with the ends, so the end walls have bays too`);
  }
});

test('and no block runs into the stringers it sits between, or the cap under it', () => {
  const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  for (const { wallType, entrance } of CASES) {
    const { bs } = bunker(wallType, entrance);
    const blocks = bs.filter((k) => k.m.role === 'ohcBlocking');
    assert.ok(blocks.length > 0, `${wallType}/${entrance}: no blocking to check`);
    for (const b of blocks) {
      for (const o of bs) {
        if (o.m.id === b.m.id) continue;
        const d: V3 = [ov(b.b.x, o.b.x), ov(b.b.y, o.b.y), ov(b.b.z, o.b.z)];
        assert.ok(!d.every((v) => v > 1e-9),
          `${wallType}/${entrance}: ${b.m.id} and ${o.m.id} (${o.m.role}) share `
          + `${d.map((v) => (v * IN_PER_FT).toFixed(3)).join(' x ')} in of wood`);
      }
    }
  }
});
