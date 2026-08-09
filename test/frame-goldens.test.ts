// TIMBER-2 T0 / TD12 — the compat lock's guard.
//
// Today this asserts `generateFrame` still reproduces its committed snapshots byte for
// byte. At T1, when `generateFrame` delegates to the new engine, `timber2-compat.test.ts`
// diffs `generateStructure(specFromBuildingInput(i))` against these SAME files — which is
// why they are committed rather than computed live (a live-vs-live comparison proves
// nothing once both sides are the new engine).
//
// A failure here means engine output changed. That is either a bug, or a deliberate
// change that needs `node --import tsx scripts/gen-frame-goldens.ts` re-run IN THE SAME PR
// with a DECISIONS.md entry saying why. Never regenerate to turn a red test green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateFrame, type BuildingInput } from '../src/timber/frame';

const DIR = fileURLToPath(new URL('./goldens/frame', import.meta.url));

interface ManifestRow { case: string; sha256: string; members: number }
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as ManifestRow[];

test('T0/TD12: every committed frame golden is present and unmodified', () => {
  const onDisk = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'manifest.json').sort();
  assert.deepEqual(onDisk, manifest.map((m) => `${m.case}.json`).sort(),
    'goldens directory and manifest disagree — regenerate both together');

  for (const row of manifest) {
    const text = readFileSync(`${DIR}/${row.case}.json`, 'utf8');
    const sha = createHash('sha256').update(text).digest('hex');
    assert.equal(sha, row.sha256, `${row.case}.json was edited without updating the manifest`);
  }
});

test('T0/TD12: generateFrame still reproduces every golden exactly', () => {
  for (const row of manifest) {
    const stored = JSON.parse(readFileSync(`${DIR}/${row.case}.json`, 'utf8')) as {
      input: BuildingInput;
    } & Record<string, unknown>;
    // FrameModel carries the input it was generated from, so the goldens are
    // self-describing: no second copy of the case table can drift from this one.
    const regenerated = generateFrame(stored.input);
    assert.deepEqual(
      JSON.parse(JSON.stringify(regenerated)),
      stored,
      `${row.case}: engine output changed. If intended, re-run scripts/gen-frame-goldens.ts ` +
      `in THIS PR and record the reason in DECISIONS.md.`,
    );
    assert.equal(regenerated.members.length, row.members, `${row.case}: member count changed`);
  }
});

test('T0/TD12: the TD5 unsorted-openings cases are actually order-sensitive', () => {
  // The lock is only meaningful if these fixtures would CATCH a sort. Prove the
  // engine's output depends on input-array order: sorting the openings must change
  // the emitted model. If this test ever goes quiet, TD5's protection has evaporated.
  const stored = JSON.parse(readFileSync(`${DIR}/td5-unsorted-openings.json`, 'utf8')) as {
    input: BuildingInput;
  };
  const sortedInput: BuildingInput = {
    ...stored.input,
    openings: [...stored.input.openings].sort((a, b) => a.offsetFt - b.offsetFt),
  };
  assert.notDeepEqual(
    JSON.parse(JSON.stringify(generateFrame(sortedInput))),
    JSON.parse(JSON.stringify(generateFrame(stored.input))),
    'sorting same-wall openings no longer changes output — TD5 fixtures no longer guard anything',
  );
});
