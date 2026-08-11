// The persisted rule fill — the piece that makes an applied import survive a reload without
// ever being trusted from storage. Three rules carry the safety story, and each is tested
// against the path that would break it: the stored bytes re-run through the SAME validated
// importer on boot (never applied raw); the fill lands BEFORE the session loads, because
// loadSession normalizes stored specs against the live LIMITS leaves; and a fill the register
// has outgrown is refused whole, dropped from storage, and announced — never half-applied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAIL } from '../src/woodframe/doctrine';
import { exportDoctrine, resetDoctrine, getAppliedManifest } from '../src/woodframe/io';
import { FILL_KEY, bootSession } from '../src/ui/woodframe/fill';
import { dryRunRuleFile, applyRuleFile, resetRuleValues } from '../src/ui/woodframe/rules';
import {
  loadSession, buildFromFamily, findBuild, STORAGE_KEY, SESSION_VERSION, type StorageLike,
} from '../src/ui/woodframe/store';
import type { BuildingSpec } from '../src/woodframe/spec';

const PRISTINE_HASH = exportDoctrine().manifest!.contentHash;

/** The whole register, byte-identical to shipped — the hash covers every leaf's value/cite/ph. */
function assertPristine(label: string): void {
  assert.equal(exportDoctrine().manifest!.contentHash, PRISTINE_HASH, label);
}

function memStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

test('the loop closes: Apply persists the fill, boot re-applies it through the importer, reset clears both sides', () => {
  const storage = memStorage();
  const shippedRail = RAIL.topHeightIn.value as number;
  const file = exportDoctrine({ author: 'S-3', date: '2026-08-11' });
  file.entries.find((e) => e.path === 'RAIL.topHeightIn')!.value = shippedRail + 3;

  let regens = 0;
  const applied = applyRuleFile(dryRunRuleFile(JSON.stringify(file)), storage, () => { regens++; });
  try {
    assert.ok(applied.report?.ok && !applied.report.dryRun, applied.report?.message);
    assert.equal(applied.savedToDevice, true);
    assert.equal(regens, 1, 'the open build is rebuilt on apply');
    assert.ok(storage.data.has(FILL_KEY), 'the fill landed under its own key, beside the session');

    // "Reload": a fresh boot starts from the shipped register and re-applies from storage.
    resetDoctrine();
    assert.equal(RAIL.topHeightIn.value, shippedRail, 'fixture check: the reload starts shipped');
    const boot = bootSession(storage);
    assert.deepEqual(boot.notices, [], 'a valid fill restores silently');
    assert.equal(RAIL.topHeightIn.value, shippedRail + 3, 'the leaf carries the fill after boot');
    assert.equal(getAppliedManifest()?.author, 'S-3', 'attribution survives the reload');
    assert.equal(getAppliedManifest()?.date, '2026-08-11');

    // Reset clears the live register AND the stored fill, together — a reset that left the
    // stored copy behind would resurrect the fill on the next load.
    const cleared = resetRuleValues(storage, () => { regens++; });
    assert.equal(cleared.report, null);
    assert.equal(regens, 2, 'reset rebuilds too');
    assert.ok(!storage.data.has(FILL_KEY), 'the stored fill is gone');
    assert.equal(RAIL.topHeightIn.value, shippedRail);
    bootSession(storage);
    assert.equal(RAIL.topHeightIn.value, shippedRail, 'nothing comes back on the next boot');
  } finally {
    resetDoctrine();
  }
  assertPristine('the round trip cleaned up');
});

test('boot order: the fill is in the register before stored specs are normalized', () => {
  const storage = memStorage();
  // A build that is legal only under the corrected bound: 70 ft against the shipped 4–60.
  const build = buildFromFamily('gp-frame')!;
  (build.spec as BuildingSpec).dims.lengthFt = 70;
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: SESSION_VERSION, customSeq: 0, builds: [build] }));
  const file = exportDoctrine();
  const lim = file.entries.find((e) => e.path === 'LIMITS.dims.lengthFt')!;
  assert.deepEqual(lim.value, { min: 4, max: 60, step: 0.5 }, 'fixture check: the shipped bound');
  lim.value = { min: 4, max: 80, step: 0.5 };
  storage.setItem(FILL_KEY, JSON.stringify(file));

  try {
    const boot = bootSession(storage);
    assert.deepEqual(boot.notices, []);
    assert.equal(
      (findBuild(boot.state, build.id)!.spec as BuildingSpec).dims.lengthFt, 70,
      'normalized AFTER the fill: the 70-ft build keeps its length under the corrected 80-ft bound',
    );

    // The dependency is real, not vacuous: the same storage read in the other order clamps.
    resetDoctrine();
    const wrongOrder = loadSession(storage);
    assert.equal(
      (findBuild(wrongOrder.state, build.id)!.spec as BuildingSpec).dims.lengthFt, 60,
      'without the fill in the register first, the same stored spec is clamped to the shipped bound',
    );
  } finally {
    resetDoctrine();
  }
  assertPristine('boot-order test cleaned up');
});

test('a stale fill is refused whole, dropped from storage, and announced — the register comes up shipped', () => {
  const storage = memStorage();
  const file = exportDoctrine();
  file.entries.push({ path: 'RAIL.retiredRule', value: 4, cite: 'a rule this register no longer has', ph: true });
  storage.setItem(FILL_KEY, JSON.stringify(file));

  const boot = bootSession(storage);
  assert.equal(boot.notices.length, 1, boot.notices.join(' | '));
  assert.match(boot.notices[0]!, /rule-value fill/, 'the notice names what was dropped');
  assert.match(boot.notices[0]!, /removed/, 'and says it is gone, not merely skipped');
  assert.ok(!storage.data.has(FILL_KEY), 'the stale fill is dropped, not refused again on every boot forever');
  assert.equal(getAppliedManifest(), null, 'no fill is recorded as applied');
  // Every OTHER entry in the stale file was valid — all-or-nothing means they were refused too.
  assertPristine('nothing half-applied from the stale file');

  // Unreadable bytes get the same treatment: dropped, said out loud, register untouched.
  storage.setItem(FILL_KEY, '{"woodframeDoctrineVersion":1,"entr');
  const boot2 = bootSession(storage);
  assert.equal(boot2.notices.length, 1);
  assert.match(boot2.notices[0]!, /unreadable/);
  assert.ok(!storage.data.has(FILL_KEY));
  assertPristine('unreadable fill mutated nothing');
});

test('with no stored fill, boot is loadSession plus nothing: the register stays byte-identical to shipped', () => {
  const storage = memStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: SESSION_VERSION, customSeq: 0, builds: [buildFromFamily('gp-frame')!] }));
  const boot = bootSession(storage);
  assert.deepEqual(boot.notices, []);
  assert.deepEqual(boot.state, loadSession(storage).state, 'the session loads exactly as it did without the fill step');
  assertPristine('an empty fill slot left the register as shipped');
});

test('a storage that will not take the write does not lie about it', () => {
  const bad: StorageLike = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
    removeItem: () => undefined,
  };
  const state = applyRuleFile(dryRunRuleFile(JSON.stringify(exportDoctrine())), bad, () => undefined);
  try {
    assert.ok(state.report?.ok, state.report?.message);
    assert.equal(state.savedToDevice, false, 'the caller can say the fill will not survive a reload');
  } finally {
    resetDoctrine();
  }
  assertPristine('the failed save left no residue');
});
