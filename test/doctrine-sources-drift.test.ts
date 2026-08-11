// DOCTRINE_SOURCES.md against the live doctrine registry.
//
// The fill checklist is the document a qualified user works to completion, so its coverage IS
// its correctness: a leaf without a row is work the filler is never told about, a stale value
// points the filler at the wrong leaf-in-source, and a wrong [SC] mark hides a life-safety leaf
// in the must-verify set. The tables are therefore generated (scripts/gen-doctrine-sources.ts),
// and this suite holds the committed file to a fresh regeneration on every run.
//
// Two of the checks below deliberately do NOT trust the generator: the row/leaf bijection and
// the [SC] agreement are re-derived from the committed file against the registry directly, so a
// generator bug that drops a family (and would regenerate the same wrong file both times) still
// fails here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/doctrine/index';
import { all } from '../src/doctrine/registry';
import { buildFile, extractRows, DOC_PATH } from '../scripts/gen-doctrine-sources';

const committed = readFileSync(DOC_PATH, 'utf8');

test('DOCTRINE_SOURCES.md matches a fresh regeneration from the live registry', () => {
  const fresh = buildFile(committed);
  if (fresh !== committed) {
    const a = committed.split('\n');
    const b = fresh.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    assert.fail(
      'DOCTRINE_SOURCES.md has drifted from the live registry, first at line ' + (i + 1) + ':\n'
      + '  committed:   ' + (a[i] ?? '<end of file>') + '\n'
      + '  regenerated: ' + (b[i] ?? '<end of file>') + '\n'
      + '  fix: node --import tsx scripts/gen-doctrine-sources.ts',
    );
  }
});

test('every live leaf has exactly one checklist row, and every row is a live leaf', () => {
  const live = new Set(all().map((e) => e.path));
  const seen = new Map<string, number>();
  for (const r of extractRows(committed)) seen.set(r.path, (seen.get(r.path) ?? 0) + 1);

  const missing = [...live].filter((p) => !seen.has(p));
  const orphaned = [...seen.keys()].filter((p) => !live.has(p));
  const duplicated = [...seen].filter(([, n]) => n > 1).map(([p]) => p);

  assert.deepEqual(missing, [], 'registered leaves with no fill row:\n  ' + missing.join('\n  '));
  assert.deepEqual(orphaned, [], 'fill rows pointing at no registered leaf:\n  ' + orphaned.join('\n  '));
  assert.deepEqual(duplicated, [], 'leaves with more than one fill row:\n  ' + duplicated.join('\n  '));
  assert.equal(seen.size, live.size);
});

test('every [SC] mark agrees with the registry tag, in both directions', () => {
  const sc = new Map(all().map((e) => [e.path, e.safetyCritical]));
  const wrong: string[] = [];
  for (const r of extractRows(committed)) {
    if (r.sc !== (sc.get(r.path) === true)) {
      wrong.push(r.path + (r.sc ? ' is marked [SC] but the registry does not tag it' : ' is tagged safetyCritical but its row has no [SC] mark'));
    }
  }
  assert.deepEqual(wrong, [], 'checklist [SC] marks that disagree with the registry:\n  ' + wrong.join('\n  '));
});

test('the checklist parser is reading a real table, not silence', () => {
  // extractRows returning [] would satisfy every check above vacuously — an emptied or
  // reformatted table region must fail loudly instead.
  const rows = extractRows(committed);
  assert.ok(rows.length >= 300, 'only ' + rows.length + ' rows parsed out of DOCTRINE_SOURCES.md');
  assert.ok(rows.some((r) => r.sc), 'no [SC] rows parsed at all');
});
