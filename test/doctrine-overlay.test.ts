// The doctrine-fill overlay is where an import report reaches the person who made the fill.
// A finding that only ever lands in the report object has not been delivered to anyone, so the
// panel is checked for each kind: values refused, whole tables refused, and values that applied
// but look doctrinally odd — which must never read as a refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../src/doctrine/index';
import { all, getByPath } from '../src/doctrine/registry';
import { exportDoctrine, importDoctrine } from '../src/doctrine/io';
import { doctrineOverlay } from '../src/layout/tools';

const fixture = (entries: { path: string; value: number }[]): unknown => ({
  ...exportDoctrine(),
  entries: entries.map((e) => ({ ...e, status: 'DOCTRINE', source: 'FM 5-103 (test fixture)' })),
});
const render = (report: ReturnType<typeof importDoctrine>): string => doctrineOverlay(all(), null, false, report);

// A report that warns, and a report that refuses — between them every branch of the report
// block renders.
const warnedReport = (): ReturnType<typeof importDoctrine> =>
  importDoctrine(fixture([{ path: 'protection.shielding.sa-556.soil', value: 0 }]), { dryRun: true });
const refusedReport = (): ReturnType<typeof importDoctrine> => {
  const path = 'stages.excavationSplit.hasty';
  return importDoctrine(fixture([{ path, value: (getByPath(path)!.value as number) + 0.2 }]));
};

test('a plausibility warning reaches the panel, and reads as applied rather than refused', () => {
  const path = 'protection.shielding.sa-556.soil';
  const report = warnedReport();
  assert.ok(report.ok && report.warnings.length > 0, 'the fixture produces warnings');

  const html = render(report);
  assert.ok(html.includes(path), 'the warned leaf is named in the panel: ' + report.warnings[0]!.path);
  assert.ok(html.includes(report.warnings[0]!.reason), 'the reason is shown, not just a count');
  // The distinction the operator has to make: this value IS in the doctrine now.
  assert.match(html, /Applied, but check/, 'a warning is presented as applied, not as a rejection');
  assert.ok(!/Import rejected/.test(html), 'a file that applied is never captioned as rejected');
});

test('a whole-table rejection is shown apart from the row-level ones, under the table it belongs to', () => {
  const report = refusedReport();
  assert.ok(!report.ok && report.rejectedTables.length === 1, 'the fixture produces a table finding');

  const html = render(report);
  assert.ok(html.includes(report.rejectedTables[0]!.reason), 'the table finding is rendered at all');
  assert.match(html, /filled together/, 'and framed as a group of values, not one bad row');
});

// Each half of this is worthless without the other: an absence proves nothing unless the same
// caption provably appears when the finding IS there, and a caption that always appears would
// tell the reader a clean file had problems.
test('the warning block and the table-rejection block each appear only when the report carries that kind of finding', () => {
  const clean = importDoctrine(fixture([{ path: 'materials.sandbag.wasteFactor', value: 1 }]), { dryRun: true });
  assert.ok(clean.ok && clean.warnings.length === 0 && clean.rejectedTables.length === 0, 'a quiet fixture');
  const quiet = render(clean);

  const warned = warnedReport();
  assert.ok(warned.warnings.length > 0 && warned.rejectedTables.length === 0, 'warnings only');
  const warnedHtml = render(warned);
  assert.match(warnedHtml, /Applied, but check/, 'the warning block renders when there are warnings');
  assert.ok(!/Applied, but check/.test(quiet), 'and not when there are none');

  const refused = refusedReport();
  assert.ok(refused.rejectedTables.length > 0, 'table findings only');
  const refusedHtml = render(refused);
  assert.match(refusedHtml, /Whole tables refused/, 'the table block renders when there are table findings');
  assert.ok(!/Whole tables refused/.test(quiet), 'and not when there are none');
  assert.ok(!/Whole tables refused/.test(warnedHtml), 'a warning is not a table rejection');
});

// Class names are the only channel by which the warning block's "applied, not refused" meaning
// reaches the eye. A block styled by nothing is a block that reads exactly like its neighbours.
const STYLES = readFileSync(fileURLToPath(new URL('../src/ui/styles.css', import.meta.url)), 'utf8');
const classesIn = (html: string): Set<string> => {
  const out = new Set<string>();
  for (const m of html.matchAll(/class="([^"]*)"/g)) for (const c of m[1]!.trim().split(/\s+/)) if (c) out.add(c);
  return out;
};

test('every class the import-report block introduces — warned and refused alike — has a rule in the stylesheet', () => {
  const baseline = classesIn(doctrineOverlay(all(), null, false, null));
  const introduced = new Set<string>();
  for (const report of [warnedReport(), refusedReport()]) {
    for (const c of classesIn(render(report))) if (!baseline.has(c)) introduced.add(c);
  }
  assert.ok(introduced.has('import-warn'), 'the warning block is among the classes checked');

  for (const cls of introduced) {
    const rule = new RegExp('\\.' + cls + '(?![\\w-])');
    assert.match(STYLES, rule, 'no rule in styles.css for .' + cls);
  }
});
