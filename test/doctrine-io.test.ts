// Phase 2 doctrine unlock (docs/EXECUTION_PLAN.md) — a qualified user can fill real values
// offline and drive the placeholder count to zero, through a hardened all-or-nothing importer.
// Tests mutate the global doctrine singletons, so each mutating case restores the original
// all-placeholder state afterward.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/doctrine/index';
import { exportDoctrine, importDoctrine, getFillState, resetFillState } from '../src/doctrine/io';
import { counts, all } from '../src/doctrine/registry';
import { compute } from '../src/engine/compute';
import type { GeometryModel } from '../src/engine/geometry';
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
  // rep.counts must PREVIEW what applying would produce (zero placeholders, since fullFill
  // marks everything DOCTRINE) — not silently echo the untouched live state under the same
  // field name. The two are deliberately different here: that's the whole point of a preview.
  assert.equal(rep.counts.placeholder, 0, 'preview shows the post-apply state, not the pre-apply one');
  assert.equal(counts().placeholder, before, 'meanwhile the live registry is still untouched');
});

test('a partial dry run previews only the staged paths changing, everything else as-is', () => {
  const targets = all().slice(0, 3).map((e) => e.path);
  const rep = importDoctrine(
    { ...exportDoctrine(), entries: targets.map((p) => ({ path: p, value: 1, status: 'DOCTRINE', source: 'FM 5-103' })) },
    { dryRun: true },
  );
  assert.ok(rep.ok && rep.dryRun);
  assert.equal(rep.counts.placeholder, counts().placeholder - 3, 'preview reflects exactly the 3 staged flips, nothing more');
  assert.equal(counts().placeholder, all().length, 'live registry still fully untouched');
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

test('THE promise: a full fill drives placeholder counts to zero end to end', () => {
  const rep = importDoctrine(fullFill());
  assert.ok(rep.ok);
  assert.equal(counts().placeholder, 0, 'no placeholders remain');
  assert.equal(counts().safetyCriticalRemaining, 0, 'no safety-critical placeholders remain');
  assert.equal(compute(defaultInputs()).placeholderReport.remaining, 0);
  restore();
  // …and after restore the counts are back — proving the clear was real, not a one-way latch.
  assert.ok(compute(defaultInputs()).placeholderReport.remaining > 0);
});

test('a persisted fill survives a reload (save → fresh boot → re-apply)', async () => {
  const adapter = new MemoryAdapter();
  importDoctrine(fullFill());
  const saved = await saveFill(adapter, { author: 'S-3', date: '2026-07-02' });
  assert.equal(saved, true, 'saveFill reports success on a working adapter');
  restore(); // simulate a fresh boot: doctrine back to all-placeholder
  assert.ok(counts().placeholder > 0);
  const applied = await restoreFill(adapter);
  assert.ok(applied > 0, 'fill re-applied on boot');
  assert.equal(counts().placeholder, 0, 'banner clear restored from storage');
  restore();
});

test('saveFill reports failure when storage actually fails — the caller must not claim it saved', async () => {
  const failingAdapter = {
    get: async () => null,
    set: async () => { throw new Error('quota exceeded'); },
    remove: async () => undefined,
    keys: async () => [],
  };
  importDoctrine(fullFill());
  const saved = await saveFill(failingAdapter);
  assert.equal(saved, false, 'saveFill must report the failure, not swallow it into an unconditional success');
  restore();
});

test('sandbags_parapet BOM line stays flagged when the leaf it ACTUALLY depends on is still a placeholder', () => {
  // A doctrine fill can be done leaf-by-leaf (io.ts explicitly allows partial entries[]) — fill
  // everything EXCEPT sandbag.frontWallHeight, which is what actually feeds the earth-mode
  // aperture-rest bag count (materials.ts used to check parapet.W/H instead, which don't feed
  // this formula at all, and never checked frontWallHeight — a false "fully confirmed" negative).
  const entries = all().map((e) => ({ path: e.path, value: e.value, status: 'DOCTRINE', source: 'FM 5-103 (test fixture)' }));
  const target = entries.find((e) => e.path.endsWith('frontWallHeight'));
  assert.ok(target, 'sandbag.frontWallHeight is a registered leaf');
  target!.status = 'PLACEHOLDER';
  const r = importDoctrine({ ...exportDoctrine(), entries });
  assert.ok(r.ok, 'partial fill imports');
  // one_man: earth-mode parapet, sectorsOfFire true → bagsParapet is the aperture-rest formula.
  const line = compute(defaultInputs()).bom.find((b) => b.id === 'sandbags_parapet');
  assert.ok(line, 'sandbags_parapet line present');
  assert.equal(line!.fromPlaceholder, true, 'must still be flagged — frontWallHeight is the leaf that actually feeds this line');
  restore();
});

test('the "setback" dimension stays flagged when depthOfCut — not standoff — is still a placeholder', () => {
  // bunker_op_cp/deliberate/ind-mtr-81: depthOfCut-derived term (setbackDepthFrac × depth =
  // 1.625 ft) binds over the threat's own standoff (1.25 ft), so depthOfCut's placeholder-ness
  // must flow into the setback dim — geometry.ts used to OR in only overhead.setbackMin (the
  // threat==='none' fallback, not the leaf actually used once a real threat is picked) and
  // setbackDepthFrac, never depthOfCut's own placeholder flag.
  const entries = all().map((e) => ({ path: e.path, value: e.value, status: 'DOCTRINE', source: 'FM 5-103 (test fixture)' }));
  const depthEntry = entries.find((e) => e.path.endsWith('bunker_op_cp.hole.D'));
  const depthMulEntry = entries.find((e) => e.path.endsWith('deliberate.depthMul'));
  assert.ok(depthEntry && depthMulEntry, 'both depth-feeding leaves are registered');
  depthEntry!.status = 'PLACEHOLDER';
  depthMulEntry!.status = 'PLACEHOLDER';
  const r = importDoctrine({ ...exportDoctrine(), entries });
  assert.ok(r.ok, 'partial fill imports');
  const result = compute(defaultInputs({ positionType: 'bunker_op_cp', standard: 'deliberate', threat: 'ind-mtr-81' }));
  const geo = result.geometry as GeometryModel;
  const setback = geo.dims.find((d) => d.key === 'setback');
  assert.ok(setback, 'setback dim present');
  assert.equal(setback!.placeholder, true, 'must still be flagged — depthOfCut (the binding term here) is still a placeholder');
  restore();
});

test('a stored fill that no longer matches the registry is refused, not trusted', async () => {
  const adapter = new MemoryAdapter();
  await adapter.set('doctrine-fill', JSON.stringify({ doctrineVersion: 1, entries: [{ path: 'gone.path', value: 1, status: 'DOCTRINE', source: 'FM' }] }));
  const applied = await restoreFill(adapter);
  assert.equal(applied, 0, 'invalid stored fill applies nothing');
  restore();
});
