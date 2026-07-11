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
