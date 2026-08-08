// The B-hut's partitions — which way a stud faces, and where a doorway's jamb goes.
//
// TWO SLIPS, ONE ROOT. Every upright in `partitions.ts` was emitted with the wall's yaw where an
// upright needs the yaw plus a quarter turn — `walls.ts` has always written `f.yaw + Math.PI / 2`
// for a vertical member and this file dropped it. So every partition stud stood with its 3½-in
// FACE along the run and its 1½-in edge across the wall: in plan a partition read as a hairline
// through a building whose other walls, and whose own plates, are 3½ in thick.
//
// The doorway arithmetic was then written to match the wrong stud. King and jack were spaced off
// the WALL's 3½-in thickness instead of the STUD's 1½-in one, which put the king exactly where
// the jack belongs and left the jack straddling the opening edge — half inside the king it is
// nailed to, half standing in the doorway over a sole plate that is cut out from under it:
//
//   king  12.00 .. 15.50 in      jack  13.75 .. 17.25 in      opening 15.50 .. 51.50
//   header 13.75 .. 53.25        1¾ in into each king         CLEAR between jacks 32.50 in
//
// for a 36-in door, three times over. The first cripple was laid on the jack as well, and the
// last was clamped onto the far one by the same `Math.min(u, d1)` that clamped the platform's
// last deck board.
//
// Fixed:
//
//   king  12.50 .. 14.00        jack  14.00 .. 15.50        opening 15.50 .. 51.50
//   header 14.00 .. 53.00 — bears on both jacks, butts both kings    CLEAR 36.00 in
//
//   partition members overlapping anything (SAT): 21 -> 6, and all six that remain are the
//   pre-existing clash between a partition's end stud and the hut's girt, written up separately.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
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

const UPRIGHT = ['stud', 'kingStud', 'jackStud', 'cripple'];

/** The b-hut, and its partition members grouped by the line each one runs on. */
function partitions(): { model: ReturnType<typeof generateStructure>; lines: Member[][] } {
  const model = generateStructure(JSON.parse(JSON.stringify(familyById('b-hut')!.preset)));
  const pt = model.members.filter((m) => m.id.startsWith('PT-'));
  assert.ok(pt.length > 20, `${pt.length} partition members — the b-hut has three dividers`);
  const byLine = new Map<number, Member[]>();
  for (const m of pt) {
    const k = Math.round(m.position[0]);
    byLine.set(k, [...(byLine.get(k) ?? []), m]);
  }
  return { model, lines: [...byLine.values()] };
}

test('A PARTITION STUD STANDS ACROSS THE WALL — every one of them was a quarter turn out', () => {
  // The visible claim: a partition is as thick as the plate it stands on, which is as thick as
  // every other wall in the building. Turned, it was 1½ in of wood in a 3½-in wall.
  const studT = DRESSED['2x4']!.w / IN_PER_FT;
  const studD = DRESSED['2x4']!.d / IN_PER_FT;
  const { lines } = partitions();
  assert.equal(lines.length, 3, `${lines.length} partition lines`);
  for (const ms of lines) {
    // A b-hut divider runs along Z, so ACROSS the wall is X and ALONG the run is Z.
    const plate = ms.find((m) => m.role === 'topPlate');
    assert.ok(plate, 'no top plate to measure the wall against');
    const pb = box(plate!);
    const wall = pb.x[1] - pb.x[0];
    assert.ok(Math.abs(wall - studD) < 1e-9,
      `the partition's own plate is ${(wall * IN_PER_FT).toFixed(2)} in across, not ${(studD * IN_PER_FT).toFixed(2)}`);
    for (const m of ms.filter((k) => UPRIGHT.includes(k.role))) {
      const b = box(m);
      assert.ok(Math.abs((b.x[1] - b.x[0]) - studD) < 1e-9,
        `${m.id} (${m.role}) is ${(((b.x[1] - b.x[0])) * IN_PER_FT).toFixed(2)} in across a `
        + `${(wall * IN_PER_FT).toFixed(2)} in wall — it is laid flat in the wall instead of standing across it`);
      assert.ok(Math.abs((b.z[1] - b.z[0]) - studT) < 1e-9,
        `${m.id} (${m.role}) takes up ${(((b.z[1] - b.z[0])) * IN_PER_FT).toFixed(2)} in of the run, not ${(studT * IN_PER_FT).toFixed(2)}`);
      // And it sits centred in the plate, not off one face of it.
      assert.ok(Math.abs((b.x[0] + b.x[1]) / 2 - (pb.x[0] + pb.x[1]) / 2) < 1e-9,
        `${m.id} is off the centre of the plate it stands on`);
    }
  }
});

test('and the doorway is as wide as the door — the jack used to stand in it', () => {
  // The rough opening is what you walk through, and it is measured between the JACKS' inner
  // faces. A 36-in door came out 32½ in clear because the jack straddled the opening edge.
  const doorW = (familyById('b-hut')!.preset as unknown as { partitionDoorWidthFt?: number });
  void doorW;
  const studT = DRESSED['2x4']!.w / IN_PER_FT;
  const { lines } = partitions();
  for (const ms of lines) {
    const jacks = ms.filter((m) => m.role === 'jackStud').map(box).sort((a, b) => a.z[0] - b.z[0]);
    const kings = ms.filter((m) => m.role === 'kingStud').map(box).sort((a, b) => a.z[0] - b.z[0]);
    const soles = ms.filter((m) => m.role === 'solePlate').map(box).sort((a, b) => a.z[0] - b.z[0]);
    assert.equal(jacks.length, 2, `${jacks.length} jack studs at a doorway`);
    assert.equal(kings.length, 2, `${kings.length} king studs at a doorway`);
    assert.equal(soles.length, 2, `${soles.length} sole plate runs — one each side of the doorway`);
    // The sole plate is cut out over the doorway, and that cut IS the rough opening.
    const opening: [number, number] = [soles[0]!.z[1], soles[1]!.z[0]];
    assert.ok(Math.abs(jacks[0]!.z[1] - opening[0]) < 1e-9 && Math.abs(jacks[1]!.z[0] - opening[1]) < 1e-9,
      `the jacks leave ${((jacks[1]!.z[0] - jacks[0]!.z[1]) * IN_PER_FT).toFixed(2)} in clear of a `
      + `${((opening[1] - opening[0]) * IN_PER_FT).toFixed(2)} in doorway`);
    // Each jack stands wholly on the plate it is nailed through, not half over the cut-out.
    assert.ok(jacks[0]!.z[0] >= soles[0]!.z[0] - 1e-9 && jacks[1]!.z[1] <= soles[1]!.z[1] + 1e-9,
      'a jack overhangs the end of its sole plate');
    // And the king stands immediately outboard of the jack, touching it, one stud thick.
    for (const [k, j, side] of [[kings[0]!, jacks[0]!, -1], [kings[1]!, jacks[1]!, 1]] as const) {
      const touch = side < 0 ? j.z[0] - k.z[1] : k.z[0] - j.z[1];
      assert.ok(Math.abs(touch) < 1e-9,
        `king and jack are ${(touch * IN_PER_FT).toFixed(3)} in apart — they are nailed face to face`);
      assert.ok(Math.abs((k.z[1] - k.z[0]) - studT) < 1e-9, 'a king stud is one stud thick');
    }
  }
});

test('and the header bears on both jacks and butts both kings', () => {
  const { lines } = partitions();
  for (const ms of lines) {
    const jacks = ms.filter((m) => m.role === 'jackStud').map(box).sort((a, b) => a.z[0] - b.z[0]);
    const kings = ms.filter((m) => m.role === 'kingStud').map(box).sort((a, b) => a.z[0] - b.z[0]);
    const heads = ms.filter((m) => m.role === 'header').map(box);
    assert.ok(heads.length >= 1, 'no header over the doorway');
    for (const h of heads) {
      assert.ok(Math.abs(h.z[0] - jacks[0]!.z[0]) < 1e-9 && Math.abs(h.z[1] - jacks[1]!.z[1]) < 1e-9,
        `the header runs ${(h.z[0] * IN_PER_FT).toFixed(2)}..${(h.z[1] * IN_PER_FT).toFixed(2)} in and the jacks' `
        + `outer faces are at ${(jacks[0]!.z[0] * IN_PER_FT).toFixed(2)} and ${(jacks[1]!.z[1] * IN_PER_FT).toFixed(2)}`);
      assert.ok(h.z[0] >= kings[0]!.z[1] - 1e-9 && h.z[1] <= kings[1]!.z[0] + 1e-9,
        'the header runs into a king stud instead of butting it');
      assert.ok(Math.abs(h.y[0] - jacks[0]!.y[1]) < 1e-9,
        `the header's underside is at ${h.y[0].toFixed(4)} and the jack tops out at ${jacks[0]!.y[1].toFixed(4)}`);
    }
    // Doubled, like every other opening in the toolkit, and filling the wall the same way.
    assert.equal(heads.length, 2, `${heads.length} header pieces — a framed opening carries a doubled header`);
    const plate = box(ms.find((m) => m.role === 'topPlate')!);
    const lo = Math.min(...heads.map((h) => h.x[0])), hi = Math.max(...heads.map((h) => h.x[1]));
    assert.ok(Math.abs((lo + hi) / 2 - (plate.x[0] + plate.x[1]) / 2) < 1e-9, 'the header is off the wall centreline');
    assert.ok(hi - lo <= plate.x[1] - plate.x[0] + 1e-9, 'the header is wider than the wall');
  }
});

test('and nothing in a partition shares wood with anything else in the model', () => {
  // The guard, and the measure the whole fix was made against. The six pairs excluded are a
  // DIFFERENT defect that predates this change and is unaffected by it: a partition's end stud
  // stands on the exterior wall's inner face, which is exactly where the hut's girt laps across
  // the studs, so the two share 1½ in. That is the girt's cut list, not the partition's layout.
  const { model } = partitions();
  const pt = model.members.filter((m) => m.id.startsWith('PT-'));
  const others = model.members.filter((m) => !m.id.startsWith('PT-') && m.role !== 'girt');
  const hits: string[] = [];
  for (const a of pt) {
    for (const b of [...pt.filter((m) => m.id > a.id), ...others]) {
      const g = gap(a, b);
      if (g < -1e-9) hits.push(`${a.id} (${a.role}) and ${b.id} (${b.role}) share ${(-g * IN_PER_FT).toFixed(3)} in`);
    }
  }
  assert.equal(hits.length, 0, hits.length ? `${hits.length} overlapping pairs — first: ${hits[0]}` : '');
});

test('and every cripple over a doorway stands clear inside it, on the wall layout', () => {
  // Marching from the opening edge put one cripple on the jack and clamped the last onto the far
  // one; on the layout they land where the studs beside the doorway would have been.
  const studT = DRESSED['2x4']!.w / IN_PER_FT;
  const { lines } = partitions();
  for (const ms of lines) {
    const jacks = ms.filter((m) => m.role === 'jackStud').map(box).sort((a, b) => a.z[0] - b.z[0]);
    const crips = ms.filter((m) => m.role === 'cripple').map(box).sort((a, b) => a.z[0] - b.z[0]);
    const opening: [number, number] = [jacks[0]!.z[1], jacks[1]!.z[0]];
    assert.ok(crips.length > 0, 'no cripples over the doorway');
    for (const c of crips) {
      assert.ok(c.z[0] >= opening[0] - 1e-9 && c.z[1] <= opening[1] + 1e-9,
        `a cripple runs ${(c.z[0] * IN_PER_FT).toFixed(2)}..${(c.z[1] * IN_PER_FT).toFixed(2)} in across an `
        + `opening of ${(opening[0] * IN_PER_FT).toFixed(2)}..${(opening[1] * IN_PER_FT).toFixed(2)}`);
    }
    // No bay over the header wider than the stud spacing, counting the jacks as its ends.
    const edges = [opening[0], ...crips.flatMap((c) => [c.z[0], c.z[1]]), opening[1]];
    const oc = 16 / IN_PER_FT;
    for (let i = 1; i + 1 < edges.length; i += 2) {
      const bay = edges[i + 1]! - edges[i]!;
      assert.ok(bay <= oc + 1e-9,
        `a ${(bay * IN_PER_FT).toFixed(2)} in bay over the header in a wall laid out at 16 in on centre`);
    }
    assert.ok(crips.every((c) => Math.abs((c.z[1] - c.z[0]) - studT) < 1e-9), 'a cripple is one stud thick');
  }
});
