// TIMBER-2 — THE COMPAT LOCK (plan §8.2, I-7, TD12/TD13).
//
// Every assertion here is against BYTES COMMITTED AT T0, before any extraction touched
// src/timber. It is never a live-vs-live comparison: once frame.ts delegates to the new
// engine, comparing it to itself would prove nothing.
//
// Red here past 1e-12 is a stop-the-line event (§9 R1) — re-plan the extraction seam. Never
// "update the golden" to make it pass; the goldens ARE the contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateFrame } from '../src/timber/frame';
import { FULL_FIXTURES, MATRIX_FIXTURES } from './fixtures/frameFixtures';
import { canonicalJson, frameSnapshot, GOLDEN_FORMAT, type FrameSnapshot } from './fixtures/goldenFormat';
import { compareSnapshots, compatMessage } from './fixtures/compare';

const DIR = fileURLToPath(new URL('./goldens/frame-compat/', import.meta.url));
const readJson = (f: string): unknown => JSON.parse(readFileSync(DIR + f, 'utf8'));
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

interface GoldenIndex {
  format: number;
  full: { name: string; note: string; members: number; sha256: string }[];
  matrix: { name: string; members: number; sha256: string }[];
}
const INDEX = readJson('index.json') as GoldenIndex;

test('golden index is intact: format, coverage, and no fixture drifted out of the corpus', () => {
  assert.equal(INDEX.format, GOLDEN_FORMAT, 'golden format version');
  assert.equal(INDEX.full.length, FULL_FIXTURES.length, 'every full fixture has a golden');
  assert.equal(INDEX.matrix.length, MATRIX_FIXTURES.length, 'every matrix row is hashed');
  for (const fx of FULL_FIXTURES) {
    assert.ok(INDEX.full.some((r) => r.name === fx.name), `${fx.name}: missing from the index`);
  }
  for (const fx of MATRIX_FIXTURES) {
    assert.ok(INDEX.matrix.some((r) => r.name === fx.name), `${fx.name}: missing from the matrix index`);
  }
});

test('curated goldens: generateFrame still produces the exact pre-refactor members', () => {
  for (const fx of FULL_FIXTURES) {
    const golden = readJson(`${fx.name}.json`) as FrameSnapshot;
    const actual = frameSnapshot(generateFrame(fx.input));
    const r = compareSnapshots(golden, actual);
    assert.ok(r.exact, compatMessage(fx.name, r));
  }
});

test('curated goldens: the committed files match their index hashes (no hand-edited golden)', () => {
  for (const row of INDEX.full) {
    const golden = readJson(`${row.name}.json`) as FrameSnapshot;
    assert.equal(sha256(canonicalJson(golden)), row.sha256, `${row.name}: file/hash mismatch`);
    assert.equal(golden.members.length, row.members, `${row.name}: member count`);
  }
});

test('full option matrix: all 72 rows hash-match their frozen snapshot', () => {
  const byName = new Map(INDEX.matrix.map((r) => [r.name, r]));
  for (const fx of MATRIX_FIXTURES) {
    const row = byName.get(fx.name)!;
    const snap = frameSnapshot(generateFrame(fx.input));
    assert.equal(snap.members.length, row.members, `${fx.name}: member count ${snap.members.length} vs ${row.members}`);
    assert.equal(
      sha256(canonicalJson(snap)),
      row.sha256,
      `${fx.name}: model changed vs the T0 snapshot — run the curated-golden test for a per-field diff`,
    );
  }
});

test('TD5: emission order follows the input array — goldens prove openings are never sorted', () => {
  // The unsorted fixture's S-wall openings descend then jump; if anything sorted them, the
  // per-role id counters would attach to different geometry and the golden would break.
  const fx = FULL_FIXTURES.find((f) => f.name === 'openings-unsorted')!;
  const golden = readJson('openings-unsorted.json') as FrameSnapshot;
  const kings = golden.members.filter((m) => m.wall === 'S' && m.role === 'kingStud');
  assert.ok(kings.length >= 6, 'three openings → six king studs');
  // King studs are emitted opening-by-opening in input order: the first pair straddles the
  // 14-ft opening, not the 4-ft one a sort would have hoisted to the front.
  const firstPairX = [kings[0]!.position[0], kings[1]!.position[0]].sort((a, b) => a - b);
  assert.ok(firstPairX[0]! > 13 && firstPairX[1]! < 18, `first-emitted kings at ${firstPairX} — input order lost`);
  // And the golden is what the engine still does.
  const actual = frameSnapshot(generateFrame(fx.input));
  assert.ok(compareSnapshots(golden, actual).exact, 'unsorted-openings fixture drifted');
});
