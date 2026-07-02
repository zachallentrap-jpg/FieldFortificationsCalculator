// Phase 2 doctrine unlock (docs/EXECUTION_PLAN.md) — the product's central promise made real:
// a qualified user can fill real values offline and drive the NOT-FOR-FIELD-USE banner to zero,
// through a hardened all-or-nothing importer. Tests mutate the global doctrine singletons, so
// each mutating case restores the original all-placeholder state afterward.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/doctrine/index';
import { exportDoctrine, importDoctrine, getFillState, resetFillState } from '../src/doctrine/io';
import { counts, all } from '../src/doctrine/registry';
import { compute } from '../src/engine/compute';
import { topbarHasFieldUseBadge } from '../src/layout/shell';
import { doctrineOverlay } from '../src/layout/tools';
import { MemoryAdapter } from '../src/state/persistence';
import { saveFill, restoreFill } from '../src/state/doctrineFill';
import { defaultInputs } from './helpers';

// The pristine, all-placeholder doctrine — captured before any test mutates it.
const ORIGINAL = exportDoctrine();
function restore(): void {
  resetFillState();
  const r = importDoctrine(ORIGINAL);
  assert.ok(r.ok, 'restore succeeded');
}
// A full fill: every entry marked DOCTRINE with a real (non-TODO) source.
function fullFill(): unknown {
  return { ...exportDoctrine(), entries: all().map((e) => ({ path: e.path, value: e.value, status: 'DOCTRINE', source: 'FM 5-103 (test fixture)' })) };
}

test('export carries a manifest hash and every registered leaf', () => {
  const ex = exportDoctrine({ author: 'S-3', date: '2026-07-02' });
  assert.equal(ex.entries.length, all().length);
  assert.ok(ex.manifest && /^[0-9a-f]{8}$/.test(ex.manifest.contentHash), 'content hash present');
  assert.equal(ex.manifest.author, 'S-3');
});

test('dry run validates WITHOUT mutating', () => {
  const before = counts().placeholder;
  const rep = importDoctrine(fullFill(), { dryRun: true });
  assert.ok(rep.ok && rep.dryRun);
  assert.equal(rep.applied, all().length, 'reports what would apply');
  assert.equal(counts().placeholder, before, 'nothing actually changed');
  assert.equal(getFillState(), null, 'no fill recorded on a dry run');
});

test('all-or-nothing: one bad value rejects the WHOLE file, nothing mutates', () => {
  const before = counts().placeholder;
  const withBad = fullFill() as { entries: { path: string; value: unknown; status: string; source: string }[] };
  withBad.entries[0]!.value = NaN; // one poisoned entry
  const rep = importDoctrine(withBad);
  assert.ok(!rep.ok);
  assert.equal(rep.applied, 0);
  assert.equal(counts().placeholder, before, 'no partial application');
});

test('rejects the specific hazards: out-of-range, DOCTRINE-with-TODO, unknown path, newer version', () => {
  const mk = (over: object) => ({ ...exportDoctrine(), entries: [{ path: all()[0]!.path, value: 1, status: 'DOCTRINE', source: 'FM', ...over }] });
  assert.ok(!importDoctrine(mk({ value: 100000 })).ok, 'out of range');
  assert.ok(!importDoctrine(mk({ value: -1 })).ok, 'negative');
  assert.ok(!importDoctrine(mk({ status: 'DOCTRINE', source: 'TODO: confirm' })).ok, 'DOCTRINE with TODO source');
  assert.ok(!importDoctrine(mk({ path: 'no.such.path' })).ok, 'unknown path');
  assert.ok(!importDoctrine({ doctrineVersion: 9999, entries: [] }).ok, 'newer version');
  assert.ok(!importDoctrine({ doctrineVersion: 1, entries: [{ path: 'a', value: {}, __proto__: { x: 1 } }] }).ok, 'prototype pollution');
});

test('partial fill: counts drop by exactly N and the fill manifest is recorded', () => {
  const targets = all().slice(0, 5).map((e) => e.path);
  const before = counts().placeholder;
  const rep = importDoctrine({
    ...exportDoctrine(),
    manifest: { author: 'MAJ Doe', date: '2026-07-02', contentHash: 'x' },
    entries: targets.map((p) => ({ path: p, value: 1, status: 'DOCTRINE', source: 'FM 5-103' })),
  });
  assert.ok(rep.ok);
  assert.equal(rep.applied, 5);
  assert.equal(counts().placeholder, before - 5, 'exactly N flipped');
  assert.equal(getFillState()?.author, 'MAJ Doe', 'manifest recorded for attribution');
  restore();
});

test('THE promise: a full fill drives the banner to zero end to end', () => {
  const rep = importDoctrine(fullFill());
  assert.ok(rep.ok);
  assert.equal(counts().placeholder, 0, 'no placeholders remain');
  assert.equal(counts().safetyCriticalRemaining, 0, 'no safety-critical placeholders remain');
  // The engine's report and the topbar both clear.
  assert.equal(compute(defaultInputs()).placeholderReport.remaining, 0);
  assert.equal(topbarHasFieldUseBadge(compute(defaultInputs())), false, 'NOT FOR FIELD USE badge gone');
  // The doctrine overlay shows the cleared badge, not the warning.
  assert.match(doctrineOverlay(all(), counts(), getFillState(), false, null), /banner cleared/);
  restore();
  // …and after restore the banner is back — proving the clear was real, not a one-way latch.
  assert.ok(compute(defaultInputs()).placeholderReport.remaining > 0);
  assert.equal(topbarHasFieldUseBadge(compute(defaultInputs())), true);
});

test('a persisted fill survives a reload (save → fresh boot → re-apply)', async () => {
  const adapter = new MemoryAdapter();
  importDoctrine(fullFill());
  await saveFill(adapter, { author: 'S-3', date: '2026-07-02' });
  restore(); // simulate a fresh boot: doctrine back to all-placeholder
  assert.ok(counts().placeholder > 0);
  const applied = await restoreFill(adapter);
  assert.ok(applied > 0, 'fill re-applied on boot');
  assert.equal(counts().placeholder, 0, 'banner clear restored from storage');
  restore();
});

test('a stored fill that no longer matches the registry is refused, not trusted', async () => {
  const adapter = new MemoryAdapter();
  await adapter.set('doctrine-fill', JSON.stringify({ doctrineVersion: 1, entries: [{ path: 'gone.path', value: 1, status: 'DOCTRINE', source: 'FM' }] }));
  const applied = await restoreFill(adapter);
  assert.equal(applied, 0, 'invalid stored fill applies nothing');
  restore();
});
