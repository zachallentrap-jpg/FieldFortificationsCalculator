// TIMBER-1 — wall generator model tests (docs/TIMBER1_3D_SYSTEM_DESIGN.md §9): determinism,
// stage integrity, no-NaN placement, and structural invariants (end studs on every wall, OC
// spacing never exceeded, complete opening framing) for a golden config.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateWalls, type WallsInput } from '../src/timber/walls';
import { STAGES } from '../src/timber/types';

const golden: WallsInput = {
  lengthFt: 20,
  widthFt: 16,
  wallHeightFt: 8,
  studSpacingIn: 16,
  openings: [
    { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }, // window
    { wall: 'E', offsetFt: 6, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 }, // door
  ],
};

test('deterministic: same inputs produce identical Member[]', () => {
  assert.deepEqual(generateWalls(golden), generateWalls(golden));
});

test('no NaN, no non-positive cut lengths, every member staged and attributed', () => {
  const stageIds = new Set<number>(STAGES.map((s) => s.id));
  for (const m of generateWalls(golden)) {
    for (const v of [...m.position, ...m.rotation, m.cutLength, m.actual.w, m.actual.d]) {
      assert.ok(Number.isFinite(v), `${m.id}: non-finite value`);
    }
    assert.ok(m.cutLength > 0, `${m.id}: cutLength ${m.cutLength}`);
    assert.ok(stageIds.has(m.stage), `${m.id}: bad stage`);
    assert.ok(m.wall, `${m.id}: wall member missing wall id`);
    assert.ok(m.doctrineRef.length > 0 && m.nailing.length > 0, `${m.id}: missing doctrine metadata`);
  }
});

test('every wall has 3 plates (sole/top/cap) and end studs at both ends', () => {
  const members = generateWalls(golden);
  for (const wall of ['N', 'S', 'E', 'W'] as const) {
    const ofWall = members.filter((m) => m.wall === wall);
    assert.equal(ofWall.filter((m) => m.role === 'solePlate').length, 1, `${wall}: sole plate`);
    assert.equal(ofWall.filter((m) => m.role === 'topPlate').length, 1, `${wall}: top plate`);
    assert.equal(ofWall.filter((m) => m.role === 'capPlate').length, 1, `${wall}: cap plate`);
    assert.ok(ofWall.filter((m) => m.role === 'stud').length >= 2, `${wall}: needs end studs`);
  }
});

test('stud OC spacing is never exceeded outside opening bays', () => {
  const members = generateWalls(golden);
  const ocFt = golden.studSpacingIn / 12;
  // N wall has no openings in the golden config — its stud run must honor the grid end to end.
  const xs = members
    .filter((m) => m.wall === 'N' && m.role === 'stud')
    .map((m) => m.position[0])
    .sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    assert.ok(xs[i]! - xs[i - 1]! <= ocFt + 0.01, `N wall gap ${xs[i]! - xs[i - 1]!} ft`);
  }
});

test('each opening is fully framed: 2 kings, 2 jacks, doubled header; windows add a sill', () => {
  const members = generateWalls(golden);
  const south = members.filter((m) => m.wall === 'S');
  assert.equal(south.filter((m) => m.role === 'kingStud').length, 2);
  assert.equal(south.filter((m) => m.role === 'jackStud').length, 2);
  assert.equal(south.filter((m) => m.role === 'header').length, 2); // doubled
  assert.equal(south.filter((m) => m.role === 'sill').length, 1);
  assert.ok(south.filter((m) => m.role === 'cripple').length >= 2, 'window bay needs cripples');
  const east = members.filter((m) => m.wall === 'E');
  assert.equal(east.filter((m) => m.role === 'sill').length, 0, 'doors have no rough sill');
  assert.equal(east.filter((m) => m.role === 'header').length, 2);
});

test('an opening flush with a wall corner never places a king/jack stud outside the wall run', () => {
  // offsetFt:0 (flush with the wall's own start) used to push the king stud 2.25" past x=0,
  // outside the wall entirely — a member with no wall left to nail it to.
  const flush: WallsInput = {
    lengthFt: 20, widthFt: 16, wallHeightFt: 8, studSpacingIn: 16,
    openings: [{ wall: 'S', offsetFt: 0, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 }],
  };
  const members = generateWalls(flush);
  const runFt = flush.lengthFt;
  for (const role of ['kingStud', 'jackStud'] as const) {
    for (const m of members.filter((mm) => mm.wall === 'S' && mm.role === role)) {
      assert.ok(m.position[0] >= 0 && m.position[0] <= runFt, `${m.id}: x=${m.position[0]} outside [0,${runFt}]`);
    }
  }
});

test('stage integrity: wall framing is stage 5, cap plates stage 6, union covers the model', () => {
  const members = generateWalls(golden);
  for (const m of members) {
    if (m.role === 'capPlate') assert.equal(m.stage, 6, m.id);
    else assert.equal(m.stage, 5, m.id);
  }
  const byStage = new Map<number, number>();
  for (const m of members) byStage.set(m.stage, (byStage.get(m.stage) ?? 0) + 1);
  const total = [...byStage.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, members.length, 'stage partition must cover every member exactly once');
});

test('walls sit INSIDE the floor edge: no member overhangs the building line', () => {
  const d = 3.5 / 12;
  for (const m of generateWalls(golden)) {
    assert.ok(m.position[0] > -1e-9 && m.position[0] < golden.lengthFt + 1e-9, `${m.id}: x ${m.position[0]}`);
    assert.ok(m.position[2] > -1e-9 && m.position[2] < golden.widthFt + 1e-9, `${m.id}: z ${m.position[2]}`);
    // S-wall members stay within the wall's 3.5" band just inside the edge.
    if (m.wall === 'S') assert.ok(m.position[2] < d + 1e-9, `${m.id}: outside S wall band`);
  }
});

test('studs land on the true OC layout grid (panel edges hit stud centers)', () => {
  // N wall has no openings in the golden config: interior stud centers must be exact
  // multiples of the OC spacing measured from the wall end (15 1/4" to the first mark).
  const members = generateWalls(golden);
  const t = 1.5 / 12;
  const oc = golden.studSpacingIn / 12;
  const xs = members
    .filter((m) => m.wall === 'N' && m.role === 'stud')
    .map((m) => golden.lengthFt - m.position[0]) // N wall runs right-to-left
    .sort((a, b) => a - b);
  for (const s of xs) {
    if (s < 2.5 * t || s > golden.lengthFt - 2.5 * t) continue; // end + corner studs are edge-flush
    const k = Math.round(s / oc);
    assert.ok(Math.abs(s - k * oc) < 1e-6, `stud at ${s} ft is off the ${golden.studSpacingIn}" grid`);
  }
  assert.ok(xs.some((s) => Math.abs(s - oc) < 1e-6), 'first interior stud at one OC from the end');
});

test('let-in bracing: 45° braces at the ends of clear walls, steeper where openings crowd', () => {
  const members = generateWalls({ ...golden, letInBracing: true });
  const braces = members.filter((m) => m.role === 'brace');
  assert.ok(braces.length >= 6, `bracing across walls: got ${braces.length}`);
  for (const b of braces) {
    assert.equal(b.stage, 6, `${b.id}: braces belong to stage 6 (plates tied & braced)`);
    assert.equal(b.nominal, '1x4');
    const ang = Math.abs(b.rotation[2]);
    assert.ok(ang > Math.PI / 5 && ang < Math.PI / 2, `${b.id}: angle ${ang}`);
  }
  // N wall is clear: both braces run at 45° (rise = run = stud zone height).
  const north = braces.filter((b) => b.wall === 'N');
  assert.equal(north.length, 2);
  for (const b of north) {
    assert.ok(Math.abs(Math.abs(b.rotation[2]) - Math.PI / 4) < 1e-6, `${b.id}: expected 45°`);
  }
  // Braces are off by default (golden reproduces the plain wall set).
  assert.equal(generateWalls(golden).filter((m) => m.role === 'brace').length, 0);
});
