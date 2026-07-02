// Phase 0 trust sprint (docs/EXECUTION_PLAN.md) — the screen agrees with its own trace, the
// app can re-open every file it writes, and a working session survives a reload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { specsPanel } from '../src/layout/panels';
import { describe as describeDrawing } from '../src/render/a11y';
import { fmtLength } from '../src/doctrine/units';
import { ScenarioStore, makeScenario } from '../src/state/scenarios';
import { MemoryAdapter } from '../src/state/persistence';
import { saveSession, restoreSession, SESSION_KEY, type KVSync } from '../src/state/session';
import { positions } from '../src/doctrine/positions';
import { defaultInputs } from './helpers';
import type { Inputs, Result } from '../src/engine/types';

// ── The depth-of-cut contradiction (panels.ts vs section/trace) ──────────────

test('specs panel shows the SAME depth the derivation trace computes, across position × standard', () => {
  for (const positionType of Object.keys(positions)) {
    for (const standard of ['hasty', 'deliberate', 'reinforced'] as const) {
      const r = compute(defaultInputs({ positionType, standard }));
      const html = specsPanel(r);
      const derived = r.derivations.find((d) => d.key === 'depthOfCut')!;
      assert.equal(r.resolved.depthOfCut, derived.result, positionType + '/' + standard + ': resolved matches trace');
      const shown = fmtLength(derived.result, 'imperial');
      assert.ok(html.includes(shown), positionType + '/' + standard + ': panel shows ' + shown);
      // The pre-fix bug: hasty (depthMul 0.6) displayed the raw doctrine depth instead.
      if (r.resolved.depthOfCut !== r.resolved.holeD) {
        const wrong = 'data-trace="depthOfCut">' + fmtLength(r.resolved.holeD, 'imperial');
        assert.ok(!html.includes(wrong), positionType + '/' + standard + ': raw holeD no longer shown as depth');
      }
    }
  }
});

test('specs panel flags placeholder-derived rows with (PH), from the same dims the drawings use', () => {
  const r = compute(defaultInputs());
  const html = specsPanel(r);
  // Everything is a placeholder before a doctrine fill, so every dim row must carry the flag.
  assert.ok(html.includes('(PH)'), 'placeholder flags present pre-fill');
});

// ── Scenario round-trips: the app re-opens every file it writes ──────────────

test('export-all → import round-trip (array form)', async () => {
  const store = new ScenarioStore(new MemoryAdapter());
  await store.save(makeScenario('a', 'Alpha', defaultInputs()));
  await store.save(makeScenario('b', 'Bravo', defaultInputs({ positionType: 'mg_crew' })));
  const exported = JSON.stringify(await store.list(), null, 2); // exactly what scenario-export writes
  const r = store.parseImportMany(exported);
  assert.ok(r.ok, 'array import accepted');
  assert.equal(r.ok && r.value.length, 2);
  assert.deepEqual(r.ok && r.value.map((s) => s.name).sort(), ['Alpha', 'Bravo']);
});

test('single-scenario settings file round-trips (toolbar export form)', () => {
  const store = new ScenarioStore(new MemoryAdapter());
  const s = makeScenario('x', 'Hill 402 west', defaultInputs({ soil: 'sand' }));
  const r = store.parseImportMany(store.exportJson(s)); // exactly what doExportJson writes
  assert.ok(r.ok);
  assert.equal(r.ok && r.value[0]!.name, 'Hill 402 west');
  assert.equal(r.ok && r.value[0]!.inputs.soil, 'sand');
});

test('import is all-or-nothing and names the bad entry', () => {
  const store = new ScenarioStore(new MemoryAdapter());
  const good = makeScenario('a', 'Alpha', defaultInputs());
  const bad = { id: 'b', name: 'Bravo', inputs: { nope: true } };
  const r = store.parseImportMany(JSON.stringify([good, bad]));
  assert.ok(!r.ok, 'rejected');
  assert.ok(!r.ok && r.error.includes('Entry 2'), 'names the failing entry: ' + (!r.ok ? r.error : ''));
  const empty = store.parseImportMany('[]');
  assert.ok(!empty.ok, 'empty array rejected');
});

// ── Session persistence: a reload never wipes the plan ───────────────────────

function fakeStorage(): KVSync & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

test('session round-trips inputs, mission set, compare set, and on-hand', () => {
  const storage = fakeStorage();
  const inputs = defaultInputs({ positionType: 'fifty_cal', teamSize: 4 });
  const mission = [{ inputs: defaultInputs({ count: 3 }) }];
  const compare = [defaultInputs(), defaultInputs({ standard: 'reinforced' })];
  saveSession(storage, { inputs, missionSet: mission, comparisonSet: compare, onHand: { sandbags_parapet: 200 } });
  const back = restoreSession(storage)!;
  assert.ok(back, 'restored');
  assert.equal(back.inputs.positionType, 'fifty_cal');
  assert.equal(back.missionSet.length, 1);
  assert.equal(back.comparisonSet.length, 2);
  assert.equal(back.onHand['sandbags_parapet'], 200);
});

test('corrupt or hostile session data degrades to null / partial, never throws', () => {
  const storage = fakeStorage();
  storage.map.set(SESSION_KEY, 'not json {');
  assert.equal(restoreSession(storage), null);
  storage.map.set(SESSION_KEY, JSON.stringify({ inputs: { schemaVersion: 999 } }));
  assert.equal(restoreSession(storage), null, 'newer-schema inputs rejected');
  // Valid inputs but garbage sets: inputs restore, garbage entries drop.
  storage.map.set(
    SESSION_KEY,
    JSON.stringify({ inputs: defaultInputs(), missionSet: [{ inputs: { bad: 1 } }], comparisonSet: 'nope', onHand: { a: 'NaN', b: 5 } }),
  );
  const back = restoreSession(storage)!;
  assert.ok(back);
  assert.equal(back.missionSet.length, 0);
  assert.equal(back.comparisonSet.length, 0);
  assert.deepEqual(back.onHand, { b: 5 });
});

// ── Data-driven drawing disclaimer (a11y parity with the topbar badge) ────────

test('drawing desc carries NOT FOR FIELD USE only while placeholders remain', () => {
  const r = compute(defaultInputs());
  assert.ok(describeDrawing(r, 'plan').desc.includes('NOT FOR FIELD USE'), 'flagged while placeholders remain');
  const cleared: Result = { ...r, placeholderReport: { ...r.placeholderReport, remaining: 0 } };
  assert.ok(!describeDrawing(cleared, 'plan').desc.includes('NOT FOR FIELD USE'), 'clears at zero like the badge');
  assert.ok(describeDrawing(cleared, 'plan').desc.includes('deep'), 'depth still described');
});

test('drawing desc describes the dug depth, not the raw doctrine depth', () => {
  const r = compute(defaultInputs({ standard: 'hasty' })); // depthMul 0.6 → dug ≠ raw
  const desc = describeDrawing(r, 'section').desc;
  assert.ok(desc.includes(fmtLength(r.resolved.depthOfCut, 'imperial')), 'describes depthOfCut');
});
