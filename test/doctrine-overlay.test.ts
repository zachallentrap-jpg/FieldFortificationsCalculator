// The doctrine-fill overlay is where an import report reaches the person who made the fill.
// A finding that only ever lands in the report object has not been delivered to anyone, so the
// panel is checked for each kind: values refused, whole tables refused, and values that applied
// but look doctrinally odd — which must never read as a refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/doctrine/index';
import { all, getByPath } from '../src/doctrine/registry';
import { exportDoctrine, importDoctrine } from '../src/doctrine/io';
import { doctrineOverlay } from '../src/layout/tools';

const fixture = (entries: { path: string; value: number }[]): unknown => ({
  ...exportDoctrine(),
  entries: entries.map((e) => ({ ...e, status: 'DOCTRINE', source: 'FM 5-103 (test fixture)' })),
});
const render = (report: ReturnType<typeof importDoctrine>): string => doctrineOverlay(all(), null, false, report);

test('a plausibility warning reaches the panel, and reads as applied rather than refused', () => {
  const path = 'protection.shielding.sa-556.soil';
  const report = importDoctrine(fixture([{ path, value: 0 }]), { dryRun: true });
  assert.ok(report.ok && report.warnings.length > 0, 'the fixture produces warnings');

  const html = render(report);
  assert.ok(html.includes(path), 'the warned leaf is named in the panel: ' + report.warnings[0]!.path);
  assert.ok(html.includes(report.warnings[0]!.reason), 'the reason is shown, not just a count');
  // The distinction the operator has to make: this value IS in the doctrine now.
  assert.match(html, /Applied, but check/, 'a warning is presented as applied, not as a rejection');
  assert.ok(!/Import rejected/.test(html), 'a file that applied is never captioned as rejected');
});

test('a whole-table rejection is shown apart from the row-level ones, under the table it belongs to', () => {
  const path = 'stages.excavationSplit.hasty';
  const report = importDoctrine(fixture([{ path, value: (getByPath(path)!.value as number) + 0.2 }]));
  assert.ok(!report.ok && report.rejectedTables.length === 1, 'the fixture produces a table finding');

  const html = render(report);
  assert.ok(html.includes(report.rejectedTables[0]!.reason), 'the table finding is rendered at all');
  assert.match(html, /filled together/, 'and framed as a group of values, not one bad row');
});

test('nothing is rendered for the kinds of finding a report does not carry', () => {
  const clean = importDoctrine(fixture([{ path: 'materials.sandbag.wasteFactor', value: 1 }]), { dryRun: true });
  assert.ok(clean.ok && clean.warnings.length === 0 && clean.rejectedTables.length === 0, 'a quiet fixture');
  const html = render(clean);
  assert.ok(!/Applied, but check/.test(html), 'no empty warning block');
  assert.ok(!/Whole tables refused/.test(html), 'no empty table-rejection block');
});
