// The rule-values view is where an import report reaches the person who made the fill. A
// finding that only ever lands in the report object has not been delivered to anyone, so the
// panel is checked for each kind: values refused, whole tables refused, and values that applied
// (or would) but look odd — which must never read as a refusal. The controllers are checked for
// the two behaviors the buttons promise: a dry run that mutates nothing, and an Apply that
// rebuilds the model the workbench holds from the corrected register.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RAIL, SPAN, STAIR, allDoctrineEntries } from '../src/woodframe/doctrine';
import {
  exportDoctrine, importDoctrine, resetDoctrine, getAppliedManifest, counts,
  type WoodframeDoctrineExport,
} from '../src/woodframe/io';
import {
  rulesOverlay, dryRunRuleFile, applyRuleFile, emptyRulesState, type RulesState,
} from '../src/ui/woodframe/rules';
import { buildFromFamily, type StorageLike } from '../src/ui/woodframe/store';
import { regenerateFrom } from '../src/ui/woodframe/regen';
import type { Member } from '../src/woodframe/types';

const PRISTINE_HASH = exportDoctrine().manifest!.contentHash;
const assertPristine = (label: string): void => {
  assert.equal(exportDoctrine().manifest!.contentHash, PRISTINE_HASH, label);
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A full export with the edits a user would make offline, serialized the way a file arrives. */
function fileWith(edit: (file: WoodframeDoctrineExport) => void): string {
  const file = exportDoctrine();
  edit(file);
  return JSON.stringify(file);
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

// A preview that warns, a preview refused by a table pair, and one refused row by row —
// between them every branch of the report block renders.
const warnedState = (): RulesState =>
  dryRunRuleFile(fileWith((f) => {
    const header = f.entries.find((e) => e.path === 'SPAN.header')!;
    const table = header.value as Record<string, number>;
    for (const k of Object.keys(table)) table[k] = table[k]! * 3; // monotone, legal, and the shape of a slip
  }));
const tableRefusedState = (): RulesState =>
  dryRunRuleFile(fileWith((f) => {
    f.entries.find((e) => e.path === 'STAIR.maxRiserIn')!.value = (STAIR.targetRiserIn.value as number) - 0.5;
  }));
const entryRefusedState = (): RulesState =>
  dryRunRuleFile(fileWith((f) => {
    f.entries.push({ path: 'NO.suchRule', value: 1, cite: 'x', ph: true });
  }));
const quietState = (): RulesState =>
  dryRunRuleFile(fileWith((f) => {
    const rail = f.entries.find((e) => e.path === 'RAIL.topHeightIn')!;
    rail.value = (rail.value as number) + 1;
  }));

test('the register renders whole: every rule row, the counts, the burn-down, and the shipped-values line', () => {
  const html = rulesOverlay(emptyRulesState());
  const entries = allDoctrineEntries();
  assert.equal(html.match(/class="rule-path"/g)?.length, entries.length, 'one read-only row per registered rule');
  assert.ok(html.includes('Shipped values — no rule fill applied.'), 'no fill, and the panel says so');
  const c = counts();
  assert.ok(html.includes(`${c.total} rules`) && html.includes(`${c.pending} pending (PH)`), 'the counts strip');
  assert.ok(html.includes(`${c.lifeSafety} life-safety, ${c.lifeSafetyPending} pending`));
  assert.ok(html.includes('RAIL.topHeightIn <span class="ls">LS</span>'), 'an LS rule wears its tag');
  assert.ok(html.includes('<span class="ph">(PH)</span>'), 'a pending citation wears its marker');
  assert.ok(html.includes('<span class="u">in</span>'), 'units render beside the values that have one');
  // The burn-down is per table, from the full register: SPAN appears with its pending count.
  const span = entries.filter((e) => e.id.startsWith('SPAN.'));
  assert.ok(html.includes(`<tr><td>SPAN</td><td class="num">${span.filter((e) => e.ph).length}</td><td class="num">${span.length}</td></tr>`));
  assertPristine('rendering reads the register and never writes it');
});

test("an applied fill's manifest replaces the shipped-values line", () => {
  const rep = importDoctrine({ ...exportDoctrine(), manifest: { author: 'MAJ Doe', date: '2026-08-11', contentHash: 'not-trusted' } });
  try {
    assert.ok(rep.ok, rep.message);
    const html = rulesOverlay(emptyRulesState());
    assert.match(html, /Applied rule fill <code>[0-9a-f]{8}<\/code> by MAJ Doe on 2026-08-11\./);
    assert.ok(!html.includes('Shipped values'), 'the two states are never shown together');
  } finally {
    resetDoctrine();
  }
  assertPristine('manifest render cleaned up');
});

test('a plausibility warning reads as would-apply on the preview and applied on the apply — never as a refusal', () => {
  const state = warnedState();
  assert.ok(state.report?.ok && state.report.warnings.length > 0, 'the fixture produces warnings');
  const html = rulesOverlay(state);
  assert.ok(html.includes(state.report!.warnings[0]!.reason), 'the reason is shown, not just a count');
  assert.match(html, /Would apply, but check/, 'a preview warning is framed as would-apply');
  assert.ok(!/Import rejected/.test(html), 'a file that would apply is never captioned as rejected');
  assert.ok(html.includes('data-action="rules-apply"'), 'the preview offers the explicit Apply');

  const applied = applyRuleFile(state, memStorage(), () => undefined);
  try {
    const html2 = rulesOverlay(applied);
    assert.match(html2, /Applied: \d+ value\(s\)\./);
    assert.match(html2, /Applied, but check/, 'after the apply the same warning reads as applied');
    assert.ok(!html2.includes('data-action="rules-apply"'), 'nothing left to apply');
  } finally {
    resetDoctrine();
  }
  assertPristine('warning fixtures cleaned up');
});

test('a rejection is captioned nothing-applied, with table findings apart from the row-level ones', () => {
  const tables = tableRefusedState();
  assert.ok(!tables.report?.ok && tables.report!.rejectedTables.length === 1, 'the fixture produces a table finding');
  assert.equal(tables.pending, null, 'a refused file never becomes applicable');
  const html = rulesOverlay(tables);
  assert.match(html, /Import rejected — nothing was applied\./);
  assert.ok(html.includes(tables.report!.rejectedTables[0]!.reason), 'the table finding is rendered at all');
  assert.match(html, /filled together, not one at a time/, 'and framed as a group of values, not one bad row');
  assert.ok(!html.includes('data-action="rules-apply"'), 'a refusal offers no Apply');

  const rows = entryRefusedState();
  assert.ok(!rows.report?.ok && rows.report!.rejected.some((r) => r.path === 'NO.suchRule'));
  const html2 = rulesOverlay(rows);
  assert.ok(html2.includes('Values refused:'), 'row-level findings get their own list');
  assert.ok(html2.includes('NO.suchRule — unknown path'));
  assertPristine('rejection fixtures mutated nothing');
});

// Each half is worthless without the other: an absence proves nothing unless the same caption
// provably appears when the finding IS there, and a caption that always appears would tell the
// reader a clean file had problems.
test('the warning and rejection blocks each appear only when the report carries that kind of finding', () => {
  const quiet = quietState();
  assert.ok(quiet.report?.ok && quiet.report.warnings.length === 0, 'a quiet fixture');
  const quietHtml = rulesOverlay(quiet);
  assert.ok(!/but check/.test(quietHtml), 'no warning block on a clean preview');
  assert.ok(!/Whole tables refused/.test(quietHtml) && !quietHtml.includes('Values refused:'));

  const warnedHtml = rulesOverlay(warnedState());
  assert.ok(!/Whole tables refused/.test(warnedHtml), 'a warning is not a table rejection');
  const tableHtml = rulesOverlay(tableRefusedState());
  assert.ok(!/but check/.test(tableHtml), 'a refusal renders no warning block');
  assertPristine('the block matrix mutated nothing');
});

test('the dry run previews and mutates nothing — the preview is the point', () => {
  const shipped = RAIL.topHeightIn.value as number;
  const pendingBefore = counts().pending;
  const state = quietState();
  rulesOverlay(state);
  assert.ok(state.report?.ok && state.report.dryRun);
  assert.equal(RAIL.topHeightIn.value, shipped, 'the leaf did not move');
  assert.equal(counts().pending, pendingBefore, 'the live counts did not move');
  assert.equal(getAppliedManifest(), null, 'no fill recorded');
  assertPristine('dry run plus render left the register as shipped');

  // A file that is not JSON is said so, without reaching the importer at all.
  const bad = dryRunRuleFile('{"woodframeDoctrineVersion":1,');
  assert.ok(!bad.report?.ok && bad.pending === null);
  assert.match(rulesOverlay(bad), /Not valid JSON/);
});

test('Apply rebuilds the model the workbench holds from the corrected register', () => {
  const spec = clone(buildFromFamily('tower')!.spec);
  const cabPosts = (m: Member[]): Member[] => m.filter((x) => x.role === 'post');
  let model = regenerateFrom(clone(spec)).model;
  assert.ok(cabPosts(model.members).length === 4 && cabPosts(model.members).every((p) => p.nominal === '4x4'),
    'fixture check: the shipped tower cuts 4x4 cab posts');

  let regens = 0;
  const state = dryRunRuleFile(fileWith((f) => {
    f.entries.find((e) => e.path === 'TOWER.cabPostNominal')!.value = '6x6';
  }));
  assert.equal(regens, 0, 'a dry run rebuilds nothing');
  assert.ok(cabPosts(regenerateFrom(clone(spec)).model.members).every((p) => p.nominal === '4x4'),
    'a fresh generate after the preview still cuts shipped stock');

  const applied = applyRuleFile(state, memStorage(), () => {
    regens++;
    model = regenerateFrom(clone(spec)).model;
  });
  try {
    assert.ok(applied.report?.ok, applied.report?.message);
    assert.equal(regens, 1, 'the apply regenerates, once');
    assert.ok(cabPosts(model.members).length === 4 && cabPosts(model.members).every((p) => p.nominal === '6x6'),
      'the held model carries the corrected stock');
  } finally {
    resetDoctrine();
  }
  assertPristine('apply-regenerates cleaned up');

  // And an Apply with nothing pending — after a refusal — is a no-op that rebuilds nothing.
  let idle = 0;
  const refused = tableRefusedState();
  const after = applyRuleFile(refused, memStorage(), () => { idle++; });
  assert.equal(after, refused, 'nothing to apply, nothing changed');
  assert.equal(idle, 0, 'and nothing regenerated');
  assertPristine('the refused file stayed refused');
});

// Class names are the only channel by which the report block's "applied, not refused" meaning
// reaches the eye. A block styled by nothing is a block that reads exactly like its neighbours.
const STYLES = readFileSync(fileURLToPath(new URL('../src/ui/woodframe.css', import.meta.url)), 'utf8');
const classesIn = (html: string): Set<string> => {
  const out = new Set<string>();
  for (const m of html.matchAll(/class="([^"]*)"/g)) for (const c of m[1]!.trim().split(/\s+/)) if (c) out.add(c);
  return out;
};

test('every class the report block introduces — warned and refused alike — has a rule in the stylesheet', () => {
  const baseline = classesIn(rulesOverlay(emptyRulesState()));
  const introduced = new Set<string>();
  for (const state of [warnedState(), tableRefusedState()]) {
    for (const c of classesIn(rulesOverlay(state))) if (!baseline.has(c)) introduced.add(c);
  }
  assert.ok(introduced.has('import-warn'), 'the warning block is among the classes checked');
  for (const cls of [...introduced, ...baseline]) {
    const rule = new RegExp('\\.' + cls + '(?![\\w-])');
    assert.match(STYLES, rule, 'no rule in woodframe.css for .' + cls);
  }
});
