// Phase 2 doctrine unlock (docs/EXECUTION_PLAN.md) — a qualified user can fill real values
// offline and drive the placeholder count to zero, through a hardened all-or-nothing importer.
// Tests mutate the global doctrine singletons, so each mutating case restores the original
// all-placeholder state afterward.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/doctrine/index';
import { exportDoctrine, importDoctrine, getFillState, resetFillState } from '../src/doctrine/io';
import { counts, all, getByPath } from '../src/doctrine/registry';
import { shielding, shieldMaterials, spanSizes, stringerSizeForSpan } from '../src/doctrine/protection';
import { positions } from '../src/doctrine/positions';
import { standards } from '../src/doctrine/standards';
import { fmtLength } from '../src/doctrine/units';
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
  // aperture-rest bag count. The placeholder flag has to follow THAT leaf: parapet.W/H do not
  // enter this formula, so flagging on them instead reports a confirmed line built on a guess.
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
  // must flow into the setback dim. OR-ing in only overhead.setbackMin (the threat==='none'
  // fallback, not the leaf actually used once a real threat is picked) and setbackDepthFrac
  // would leave the placeholder-ness of the term that actually binds out of the flag.
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

// ── Whole-table invariants: what a per-entry check cannot see ────────────────────

const fixture = (entries: { path: string; value: number }[]): unknown => ({
  ...exportDoctrine(),
  entries: entries.map((e) => ({ ...e, status: 'DOCTRINE', source: 'FM 5-103 (test fixture)' })),
});

test('a fill that scrambles the stringer span table is refused WHOLE', () => {
  // stringerSizeForSpan is first-fit: with the limits descending, the widest opening matches the
  // FIRST row and gets billed the SMALLEST timber. Every value here passes the per-entry checks
  // (right type, in range), so only a whole-table check catches it.
  const paths = spanSizes.map((_, i) => 'protection.spanSizes[' + i + '].maxSpan');
  const before = paths.map((p) => getByPath(p)!.value as number);
  const widest = before[before.length - 1]!;

  const rep = importDoctrine(fixture(paths.map((path, i) => ({ path, value: before[before.length - 1 - i]! }))));

  assert.ok(!rep.ok, 'descending span limits are refused');
  assert.equal(rep.applied, 0);
  assert.ok(rep.rejected.some((r) => /ascend/.test(r.reason)), 'says which invariant broke');
  assert.deepEqual(paths.map((p) => getByPath(p)!.value), before, 'registry unchanged — all or nothing');
  // The behaviour that was at stake: the widest tabulated span still resolves to the LARGEST
  // stringer, not the first row it happens to fit under.
  assert.equal(stringerSizeForSpan(widest), spanSizes[spanSizes.length - 1]!.sizeLabel);
});

test('a fill whose excavation stage shares do not sum to 1 is refused WHOLE, against the TABLE', () => {
  const paths = ['security', 'hasty', 'deliberate', 'parapet'].map((k) => 'stages.excavationSplit.' + k);
  const before = paths.map((p) => getByPath(p)!.value as number);
  const target = 'stages.excavationSplit.hasty';

  const rep = importDoctrine(fixture([{ path: target, value: (getByPath(target)!.value as number) + 0.2 }]));

  assert.ok(!rep.ok, 'a partition that does not sum to 1 is refused');
  assert.equal(rep.applied, 0);
  assert.deepEqual(paths.map((p) => getByPath(p)!.value), before, 'registry unchanged — all or nothing');
  const sum = paths.reduce((acc, p) => acc + (getByPath(p)!.value as number), 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'the stage partition still divides exactly one total');

  // No single share is the wrong one, so the finding belongs to the table, not to a row: it is
  // reported apart from the per-entry rejections and never counted as an entry, because the
  // reader would otherwise be sent hunting for a fill-table row that does not exist.
  const table = rep.rejectedTables.find((r) => /sum to 1/.test(r.reason));
  assert.ok(table, 'says which invariant broke, as a table finding');
  assert.equal(getByPath(table!.path), undefined, 'a table identifier, not a registry path');
  assert.deepEqual(rep.rejected, [], 'the one entry in the file is not itself invalid');
  assert.ok(!/entr\(y\/ies\) failed validation/.test(rep.message ?? ''), 'the summary does not call a table an entry: ' + rep.message);
  // …and the message tells the filler what to do about it: all four shares travel together.
  for (const p of paths) assert.ok(table!.reason.includes(p.split('.').pop()!), 'names ' + p + ': ' + table!.reason);
  assert.match(table!.reason, /same file/, 'and says they fill together');
});

test('a non-monotone shielding fill is APPLIED but reported', () => {
  // Plausibility, not correctness: the engine stays correct either way and a real table may
  // legitimately step sideways, so this is surfaced for the filler to judge — never a refusal.
  assert.deepEqual(importDoctrine(fullFill(), { dryRun: true }).warnings, [], 'the shipped table is not flagged');

  const path = 'protection.shielding.ind-mtr-120.soil';
  const smaller = 'protection.shielding.ind-mtr-81.soil';
  const thin = (getByPath(smaller)!.value as number) / 2;

  const rep = importDoctrine(fixture([{ path, value: thin }]));

  assert.ok(rep.ok, 'an odd fill still applies — the importer refuses what breaks the engine, not what surprises it');
  assert.equal(rep.applied, 1);
  assert.equal(getByPath(path)!.value, thin, 'the value really landed');
  assert.ok(rep.warnings.some((w) => w.path === path), 'the bigger round needing less cover is reported');
  assert.ok((getByPath(smaller)!.value as number) > (getByPath(path)!.value as number), '…and it genuinely is backwards');
  restore();
});

test('a shielding table zeroed WHOLESALE is reported — the failure a ladder walk cannot see', () => {
  // The import bound accepts 0, and zeroing a whole class leaves every step of the severity
  // ladder equal rather than descending, so a monotonicity walk sees nothing wrong with it —
  // while the engine now reads every one of those leaves as a missing value and refuses to
  // size a roof from any of them. This is the fill that must not pass quietly.
  const smallArms = ['sa-556', 'sa-762', 'sa-127', 'sa-145'];
  const paths = smallArms.flatMap((id) => shieldMaterials.map((m) => 'protection.shielding.' + id + '.' + m));

  const rep = importDoctrine(fixture(paths.map((path) => ({ path, value: 0 }))), { dryRun: true });

  assert.ok(rep.ok, 'plausibility never blocks — it reports');
  const warned = new Set(rep.warnings.map((w) => w.path));
  for (const p of paths) assert.ok(warned.has(p), 'no warning for ' + p);
  assert.ok(rep.warnings.every((w) => /MISSING/.test(w.reason)), 'each says a zero reads as an absent value');
});

test('zeroing the SMALLEST threat of a class is reported — it decreases against nothing', () => {
  // 5.56mm is the first rung of the small-arms ladder, so no predecessor exists to fall below.
  const path = 'protection.shielding.sa-556.soil';
  const rep = importDoctrine(fixture([{ path, value: 0 }]), { dryRun: true });
  assert.ok(rep.ok);
  assert.ok(rep.warnings.some((w) => w.path === path), 'the first rung is checked on its own merits');
});

test('a reversed standoff ladder is reported — a bigger round given less standoff than a smaller one', () => {
  // The biggest round given the smallest standoff, across the whole indirect class. Every value
  // is in range and rightly typed, so only a table-shaped check sees it — and standoff drives
  // the setback geometry, so it is exactly as safety-critical as the shielding half.
  const ids = ['ind-mtr-60', 'ind-mtr-81', 'ind-mtr-120', 'ind-art-105', 'ind-art-122', 'ind-art-152', 'ind-art-155'];
  const paths = ids.map((id) => 'protection.threats.' + id + '.standoffMin');
  const before = paths.map((p) => getByPath(p)!.value as number);
  const reversed = [...before].reverse();

  const rep = importDoctrine(fixture(paths.map((path, i) => ({ path, value: reversed[i]! }))), { dryRun: true });

  assert.ok(rep.ok, 'plausibility never blocks');
  assert.ok(rep.warnings.length > 0, 'a reversed standoff ladder is not silent');
  assert.ok(rep.warnings.every((w) => paths.includes(w.path)), 'warns on the standoff leaves themselves');
  assert.ok(rep.warnings.some((w) => /less standoff/.test(w.reason)), 'says a bigger round wants less standoff');
  // The biggest round in the class is the one that ends up worst off, so it must be named.
  assert.ok(rep.warnings.some((w) => w.path === 'protection.threats.ind-art-155.standoffMin'), '155mm is reported');
  assert.deepEqual(paths.map((p) => getByPath(p)!.value), before, 'dry run mutated nothing');
});

test('a standoff filled to zero is reported even where no ladder step descends', () => {
  // The 60mm mortar is the smallest round of the indirect class, so zeroing its standoff falls
  // below no other rung — the ladder sees nothing, and only a value-in-its-own-right check does.
  const path = 'protection.threats.ind-mtr-60.standoffMin';
  const rep = importDoctrine(fixture([{ path, value: 0 }]), { dryRun: true });
  assert.ok(rep.ok);
  const w = rep.warnings.find((x) => x.path === path);
  assert.ok(w, 'no munition is safe at no standoff');
  assert.match(w!.reason, /MISSING value/, 'reported as an absent value, not as a ladder step: ' + w!.reason);
});

// A magnitude a hair above zero passes every per-entry check (it is in range, rightly typed and
// strictly positive, so the engine's own fail-safe lets it through) while the app cannot print
// it as anything but zero. Both tables are checked: standoff sets the roof setback, so it is as
// safety-critical as the thickness half.
test('a shielding thickness the panel can only show as zero is reported', () => {
  const path = 'protection.shielding.sa-556.soil';
  const tiny = 1e-9;
  const rep = importDoctrine(fixture([{ path, value: tiny }]), { dryRun: true });

  assert.ok(rep.ok, 'plausibility reports, never blocks');
  const w = rep.warnings.find((x) => x.path === path);
  assert.ok(w, 'a thickness of ' + tiny + ' ft is not doctrine anybody could build to');
  assert.match(w!.reason, /rounds to zero as displayed/, 'the message says WHY it is unusable: ' + w!.reason);
  // …and it really is invisible, through the same formatter the specs panel prints with.
  assert.ok(!/[1-9]/.test(fmtLength(tiny, 'imperial')), 'the panel shows ' + fmtLength(tiny, 'imperial'));
});

test('a standoff the panel can only show as zero is reported', () => {
  const path = 'protection.threats.ind-art-155.standoffMin';
  const tiny = 1e-9;
  const rep = importDoctrine(fixture([{ path, value: tiny }]), { dryRun: true });

  assert.ok(rep.ok, 'plausibility reports, never blocks');
  const w = rep.warnings.find((x) => x.path === path);
  assert.ok(w, 'a setback of ' + tiny + ' ft is not a setback');
  assert.match(w!.reason, /rounds to zero as displayed/, 'the message says WHY it is unusable: ' + w!.reason);
  assert.ok(!/[1-9]/.test(fmtLength(tiny, 'imperial')), 'the panel shows ' + fmtLength(tiny, 'imperial'));
});

// The magnitude the operator actually READS is not the leaf: an earth roof is built to the
// shielding leaf × the chosen standard's coverMul, and coverMul is a fillable doctrine leaf
// too. So the unbuildable state is reachable through the PRODUCT with both factors legible.
test('a thickness that disappears only once the build standard multiplies it is reported, against the multiplier', () => {
  const path = 'protection.shielding.sa-556.soil';
  const thin = 0.05;
  // This one really applies the fill (the engine assertions below need it live), so the restore
  // is unconditional — a failure here must not leave a thinned table behind for later cases.
  const rep = importDoctrine(fixture([{ path, value: thin }]));
  try {
    assert.ok(rep.ok, 'plausibility reports, never blocks');

    // The premise: the thickness is perfectly readable on its own, so the shielding row is not
    // the thing to send the filler back to.
    assert.ok(/[1-9]/.test(fmtLength(thin, 'imperial')), thin + ' ft alone shows as ' + fmtLength(thin, 'imperial'));
    assert.ok(!rep.warnings.some((w) => w.path === path), 'a legible thickness is not blamed');

    const mulPath = 'standards.hasty.coverMul';
    const w = rep.warnings.find((x) => x.path === mulPath);
    assert.ok(w, 'the multiplier that scales the cover out of sight is named instead');
    assert.match(w!.reason, /can only show as/, 'and says why it is unusable: ' + w!.reason);

    // …and this is the roof the engine really builds: an earth roof, stringers billed under it,
    // and a thickness the panel prints as nothing.
    const result = compute(defaultInputs({ positionType: 'bunker_op_cp', standard: 'hasty', threat: 'sa-556' }));
    assert.equal(result.cover.roofPath, 'earth_on_stringers', 'a roof is still drawn and billed');
    assert.ok(result.cover.thickness > 0, 'strictly positive, so the engine fail-safe passes it');
    assert.ok(!/[1-9]/.test(fmtLength(result.cover.thickness, 'imperial')), 'the panel would show ' + fmtLength(result.cover.thickness, 'imperial'));
  } finally {
    restore();
  }
});

test('a cover multiplier filled small enough to scale every earth roof out of sight is reported', () => {
  // Nothing in the shielding table is wrong here — the standards table alone deletes the cover.
  const path = 'standards.deliberate.coverMul';
  const tiny = 1e-6;
  const rep = importDoctrine(fixture([{ path, value: tiny }]), { dryRun: true });

  assert.ok(rep.ok, 'plausibility reports, never blocks');
  const w = rep.warnings.find((x) => x.path === path);
  assert.ok(w, 'a multiplier is a leaf a file can fill, and this one leaves no cover to read');
  assert.match(w!.reason, /can only show as/, 'says why it is unusable: ' + w!.reason);
  assert.ok(!rep.warnings.some((x) => x.path.startsWith('protection.shielding.')), 'no shielding row is blamed for it');
});

test('an unusable shielding value is blamed on its own row, not on every multiplier as well', () => {
  // A zeroed thickness makes the product zero under all three standards. Reporting it against
  // each of them would send the filler to the standards table to correct a shielding number —
  // the wrong-table blame the separate ROOF_NO_COVER_MULTIPLIER code exists to avoid.
  const path = 'protection.shielding.sa-556.soil';
  const rep = importDoctrine(fixture([{ path, value: 0 }]), { dryRun: true });
  assert.ok(rep.ok);
  assert.deepEqual(rep.warnings.map((w) => w.path), [path], 'one finding, on the one table that needs correcting');
});

test('the smallest thickness the shipped shielding table carries is NOT called unbuildable, even through the leanest build standard', () => {
  // The threshold is display precision, so it has to sit below everything the app itself ships —
  // and below what it ships once the leanest standard has scaled it, since that PRODUCT is what
  // the panel prints. A check that fires on the pristine table would train the filler to ignore it.
  const smallest = Object.values(shielding)
    .flatMap((row) => shieldMaterials.map((m) => row[m].value))
    .reduce((a, b) => Math.min(a, b), Infinity);
  const leanest = Object.values(standards).reduce((a, s) => Math.min(a, s.coverMul.value), Infinity);
  assert.ok(/[1-9]/.test(fmtLength(smallest, 'imperial')), smallest + ' ft shows as ' + fmtLength(smallest, 'imperial'));
  for (const u of ['imperial', 'metric'] as const) {
    assert.ok(/[1-9]/.test(fmtLength(smallest * leanest, u)), smallest + ' ft × ' + leanest + ' shows as ' + fmtLength(smallest * leanest, u));
  }
  assert.deepEqual(importDoctrine(fullFill(), { dryRun: true }).warnings, [], 'the shipped table is quiet');
});

// The roof is not the only protection the app prints. A parapet's frontal cover, a hull-down's
// spoil berm and an ATGM's rear backblast area are each safety-critical, each drawn to scale and
// dimensioned through the same length formatter, and none has an engineered fail-safe behind it.
test('the protective magnitudes outside the two ladders are checked too, not only the roof', () => {
  const tiny = 1e-9;
  const paths = ['protection.parapet.W', 'protection.berm.W', 'weapons.backblast.clearanceFt'];
  const rep = importDoctrine(fixture(paths.map((path) => ({ path, value: tiny }))), { dryRun: true });

  assert.ok(rep.ok, 'plausibility reports, never blocks');
  for (const path of paths) {
    const w = rep.warnings.find((x) => x.path === path);
    assert.ok(w, 'no finding for ' + path + ' — a protective magnitude nobody can read is not doctrine');
    assert.match(w!.reason, /rounds to zero as displayed/, path + ': ' + w!.reason);
  }
  // …and exactly zero reads as ABSENT, the same as it does on the shielding table.
  const zeroed = importDoctrine(fixture(paths.map((path) => ({ path, value: 0 }))), { dryRun: true });
  for (const path of paths) {
    assert.match(zeroed.warnings.find((x) => x.path === path)?.reason ?? '', /MISSING value/, path);
  }
});

// The drawing's dimension list is exactly what an operator reads off the page, so it — not a
// hand-picked trio — is the corpus this check answers to. Every dim key the app renders is
// classified here: PROTECTIVE ones name the fillable leaves behind them and every one of those
// leaves must draw a finding, and the rest carry a stated reason for not being protection. A new
// dimension cannot be added without a decision, because the walk below asserts the two sets match.
const DIMENSIONED: Record<string, { protectedBy: string[] } | { notProtection: string }> = {
  depth: {
    // depthOfCut = the position's catalog depth × the standard's depthMul — both fillable.
    protectedBy: ['positions.two_man.hole.D', 'standards.deliberate.depthMul'],
  },
  parapet_w: { protectedBy: ['protection.parapet.W', 'protection.berm.W'] },
  parapet_h: { protectedBy: ['protection.parapet.H', 'protection.berm.H'] },
  setback: {
    // max(munition standoff, setbackDepthFrac × depthOfCut). The ratio has no length display of
    // its own and cannot empty the max alone — the standoff term does, so both standoffs are here:
    // the munition's, and the fallback used when no threat is named.
    protectedBy: ['protection.threats.ind-mtr-81.standoffMin', 'protection.overhead.setbackMin'],
  },
  cover_t: { protectedBy: ['protection.shielding.ind-mtr-81.sandbagged_soil', 'standards.deliberate.coverMul'] },
  frontage: { notProtection: 'the position\'s SIZE — how much room the crew has, not what stops a round' },
  front_back: { notProtection: 'the position\'s SIZE — how much room the crew has, not what stops a round' },
  outer_l: { notProtection: 'frontage plus twice the parapet thickness — its protective factor is parapet.W/berm.W, checked above' },
  outer_w: { notProtection: 'front-to-back plus twice the parapet thickness — same protective factor as outer_l' },
  ramp_run: { notProtection: 'how much level ground the access ramp consumes behind the cut — access, not protection' },
};

test('every protective magnitude the app dimensions is checked, not only the roof', () => {
  // The corpus: every dim key the app actually renders, over the whole position catalog, with and
  // without a threat (cover_t and ramp_run only appear on some of them).
  const rendered = new Set<string>();
  for (const positionType of Object.keys(positions)) {
    for (const threat of ['none', 'ind-mtr-81']) {
      const geo = compute(defaultInputs({ positionType, threat, overheadCover: threat !== 'none' })).geometry as GeometryModel;
      for (const d of geo.dims) rendered.add(d.key);
    }
  }
  for (const key of rendered) {
    assert.ok(DIMENSIONED[key], 'the drawing dimensions ' + key + ' and nothing here says whether it is protection');
  }
  for (const key of Object.keys(DIMENSIONED)) {
    assert.ok(rendered.has(key), key + ' is classified here but the app no longer dimensions it');
  }

  // Every leaf behind a protective dimension draws a finding, at a hair above zero and at zero.
  const protectivePaths = Object.values(DIMENSIONED).flatMap((v) => ('protectedBy' in v ? v.protectedBy : []));
  assert.ok(protectivePaths.length > 0);
  for (const path of protectivePaths) {
    assert.ok(getByPath(path), path + ' is a registered leaf');
    const tiny = importDoctrine(fixture([{ path, value: 1e-9 }]), { dryRun: true });
    assert.ok(tiny.ok, 'plausibility reports, never blocks');
    const onTiny = tiny.warnings.find((w) => w.path === path);
    assert.ok(onTiny, 'no finding for ' + path + ' — a protective magnitude nobody can read is not doctrine');
    assert.match(onTiny!.reason, /can only (show|dimension) (it )?as/, path + ': ' + onTiny!.reason);

    const zero = importDoctrine(fixture([{ path, value: 0 }]), { dryRun: true });
    const onZero = zero.warnings.find((w) => w.path === path);
    assert.ok(onZero, 'no finding for ' + path + ' at exactly zero');
    assert.match(onZero!.reason, /MISSING value/, path + ': ' + onZero!.reason);
  }
});

test('a parapet filled to a thickness the panel shows as nothing still gets drawn and billed', () => {
  // The state at stake: the operator reads a parapet of no thickness off the plan while the BOM
  // bills exactly the same work to build it, so the warning above is the only thing standing
  // between the fill and a position with no frontal cover.
  const path = 'protection.parapet.W';
  const inputs = defaultInputs({ positionType: 'two_man' });
  const bagsBefore = compute(inputs).bom.find((b) => b.id === 'sandbags_parapet')?.qtyTotal;
  const rep = importDoctrine(fixture([{ path, value: 1e-9 }]));
  try {
    assert.ok(rep.ok, 'plausibility never blocks');
    assert.ok(rep.warnings.some((w) => w.path === path), 'the fill is reported');

    const result = compute(inputs);
    const geo = result.geometry as GeometryModel;
    const dim = geo.dims.find((d) => d.key === 'parapet_w');
    assert.ok(dim, 'the parapet thickness is a dimension the drawing carries');
    assert.ok(dim!.valueFt > 0, 'strictly positive, so nothing downstream refuses it');
    assert.ok(!/[1-9]/.test(fmtLength(dim!.valueFt, 'imperial')), 'the plan would dimension it ' + fmtLength(dim!.valueFt, 'imperial'));
    assert.equal(
      result.bom.find((b) => b.id === 'sandbags_parapet')?.qtyTotal, bagsBefore,
      'the BOM bills the parapet work unchanged while the cover it protects with has gone',
    );
  } finally {
    restore();
  }
});

test('the display check stays off the safety-critical values that are not protective lengths', () => {
  // The threshold is DISPLAY precision of a length, so it has no meaning for a unitless ratio, a
  // first-fit span limit or a warning threshold — extending it to them would fire on fills that
  // are merely small and train the filler to ignore the check. The span limits answer to the
  // stricter whole-table rule that refuses the file; the shoring threshold driven down makes its
  // warning fire on every cut, the loud direction; retainingWall.thickness feeds no formula in
  // src/ at all; and the setback ratio has no length display of its own and cannot empty the
  // setback by itself, because that max() falls back to a standoff and every standoff IS checked.
  // (setbackMin and radiationHalving.* were on this list and are no longer: they are checked now,
  // under the two tests below, which assert the opposite of what this one used to say about them.)
  const quiet = [
    { path: 'protection.overhead.setbackDepthFrac', value: 1e-9 },
    { path: 'protection.retainingWall.thickness', value: 1e-9 },
    { path: 'protection.retainingWall.maxHeight', value: 1e-9 },
    // ascending, so the whole-table first-fit invariant is satisfied and only display is at issue
    ...spanSizes.map((_, i) => ({ path: 'protection.spanSizes[' + i + '].maxSpan', value: (i + 1) * 1e-9 })),
  ];
  const rep = importDoctrine(fixture(quiet), { dryRun: true });
  assert.ok(rep.ok);
  assert.deepEqual(rep.warnings, [], 'none of these is a protective length the panel prints');
});

test('a fallout halving thickness too small to read is reported — the fill that INFLATES the protection', () => {
  // The exclusion this replaces said radiationHalving is "consumed as a divisor and never printed
  // as a length", and that a non-positive one already reads as no attenuation. The second half is
  // true and covers the one value that was never the problem; the first half is false, and the
  // band it waved through is the dangerous one — the leaf is a DIVISOR, so a thickness too small
  // to read does not delete the protective claim, it multiplies it.
  const path = 'protection.radiationHalving.sandbagged_soil';
  const inputs = defaultInputs({ positionType: 'two_man', standard: 'deliberate', threat: 'ind-mtr-81' });
  const layersBefore = compute(inputs).derivations.find((d) => d.key === 'radiationLayers')!.result;

  const rep = importDoctrine(fixture([{ path, value: 1e-9 }]));
  try {
    assert.ok(rep.ok, 'plausibility reports, never blocks');
    const w = rep.warnings.find((x) => x.path === path);
    assert.ok(w, 'a halving thickness of 1e-9 ft is not doctrine anybody could confirm');
    assert.match(w!.reason, /rounds to zero as displayed/, w?.reason);

    // The state at stake, measured: the leaf IS printed to the operator — as an operand of the
    // fallout trace, in feet, through the panel's own formatter — and it reads as nothing, while
    // the attenuation it divides into is printed as a protective claim the roof cannot deliver.
    const rad = compute(inputs).derivations.find((d) => d.key === 'radiationLayers');
    assert.ok(rad, 'the panel still carries the fallout-attenuation row');
    const operand = rad!.operands.find((o) => o.name === 'halvingThickness');
    assert.ok(operand && operand.unit === 'ft', 'the trace prints the leaf as a length in feet');
    assert.equal(Math.round(operand!.value * 100) / 100, 0, 'and the panel rounds it to nothing');
    assert.ok(rad!.result > layersBefore * 1e6, 'the claim is inflated, not deleted: ' + layersBefore + ' → ' + rad!.result);
  } finally {
    restore();
  }
});

test('the standoff nobody chose a threat for is checked like the seventeen that were', () => {
  // The exclusion this replaces said setbackMin "never reaches the formatter alone", since the
  // setback DIMENSION is max(setbackMin, setbackDepthFrac × depthOfCut) and the other term
  // usually binds. True of the dimension, false of the leaf: with no threat named, the roof-setback
  // trace prints THIS leaf as its own operand, in feet.
  const path = 'protection.overhead.setbackMin';
  const rep = importDoctrine(fixture([{ path, value: 0 }]));
  try {
    assert.ok(rep.ok, 'plausibility reports, never blocks');
    const w = rep.warnings.find((x) => x.path === path);
    assert.ok(w, 'the fallback standoff is a standoff — no munition is safe at none of it');
    assert.match(w!.reason, /MISSING value/, w?.reason);

    const setback = compute(defaultInputs({ positionType: 'two_man', threat: 'none', overheadCover: false }))
      .derivations.find((d) => d.key === 'setback');
    assert.ok(setback, 'the setback derivation is built whether or not a threat is named');
    const operand = setback!.operands.find((o) => o.name === 'munitionStandoff');
    assert.ok(operand && operand.unit === 'ft', 'the standoff is printed as a length in feet');
    assert.equal(operand!.value, 0, 'and with no threat named it is this leaf that is read out');
  } finally {
    restore();
  }
});

test('a depth multiplier that scales the cut to nothing is reported, against the multiplier', () => {
  // coverMul is checked because it scales a rendered protective magnitude to display-zero.
  // depthMul is its sibling in the same standards row and does the same to the depth of cut —
  // which the drawing dimensions and the excavation bills — with no engineered fail-safe behind
  // it and no validation code about the depth.
  const path = 'standards.deliberate.depthMul';
  const inputs = defaultInputs({ positionType: 'two_man', standard: 'deliberate', threat: 'ind-mtr-81' });
  const before = compute(inputs);
  const rep = importDoctrine(fixture([{ path, value: 1e-9 }]));
  try {
    assert.ok(rep.ok, 'plausibility reports, never blocks');
    const w = rep.warnings.find((x) => x.path === path);
    assert.ok(w, 'the multiplier that takes the defilade away is named');
    assert.match(w!.reason, /can only dimension as/, w?.reason);
    assert.ok(!rep.warnings.some((x) => x.path.startsWith('positions.')), 'the catalog depth reads fine — no wrong-table blame');

    // The state at stake: the position is drawn, roofed and billed with no hole in the ground.
    const after = compute(inputs);
    const dim = (after.geometry as GeometryModel).dims.find((d) => d.key === 'depth');
    assert.ok(dim && dim.valueFt > 0, 'strictly positive, so nothing downstream refuses it');
    assert.ok(!/[1-9]/.test(fmtLength(dim!.valueFt, 'imperial')), 'the plan would dimension it ' + fmtLength(dim!.valueFt, 'imperial'));
    assert.equal(after.cover.roofPath, 'earth_on_stringers', 'a roof is still drawn');
    assert.equal(after.cover.thickness, before.cover.thickness, 'sized exactly as before');
    for (const id of ['stringers', 'sandbags_cover']) {
      assert.equal(
        after.bom.find((b) => b.id === id)?.qtyTotal, before.bom.find((b) => b.id === id)?.qtyTotal,
        id + ' is billed unchanged over a position with no depth',
      );
    }
    assert.ok(!after.validation.some((v) => /depth/i.test(v.message)), 'and nothing downstream says a word about the depth');
  } finally {
    restore();
  }
});

test('a catalog depth that is unusable on its own is blamed on the catalog, not on every standard', () => {
  // The same wrong-table rule the cover check follows: a depth nobody can read is the position
  // catalog's problem, and reporting it against all three depthMuls would send the filler to the
  // standards table to correct a position. With no legible depth left, a POSITIVE multiplier has
  // nothing to convict it and is left to the rows that already carry their own finding.
  const depthPaths = Object.keys(positions).map((id) => 'positions.' + id + '.hole.D');
  const rep = importDoctrine(
    fixture([...depthPaths.map((path) => ({ path, value: 1e-9 })), { path: 'standards.hasty.depthMul', value: 1e-9 }]),
    { dryRun: true },
  );
  assert.ok(rep.ok);
  const warned = new Set(rep.warnings.map((w) => w.path));
  for (const p of depthPaths) assert.ok(warned.has(p), 'no finding for ' + p + ' — the fill is not silent');
  assert.ok(!rep.warnings.some((w) => w.path.startsWith('standards.')), 'no wrong-table blame');

  // …but a multiplier of zero takes every depth in the catalog away in its own right, so it is
  // named even then — the same reading the cover multiplier gets.
  const zeroed = importDoctrine(
    fixture([...depthPaths.map((path) => ({ path, value: 1e-9 })), { path: 'standards.hasty.depthMul', value: 0 }]),
    { dryRun: true },
  );
  const on = zeroed.warnings.filter((w) => w.path === 'standards.hasty.depthMul');
  assert.equal(on.length, 1, 'exactly one finding of its own');
  assert.match(on[0]!.reason, /MISSING value/, on[0]?.reason);
});

test('a cover multiplier of zero is named even when every thickness it scales is unusable too', () => {
  // The one import where the product walk has nothing to work with: every shielding leaf is
  // flagged on its own row and excluded, so no legible thickness survives to quote. A multiplier
  // of zero needs none — it is absent in its own right, and would otherwise be the only bad value
  // in the file nobody was told about.
  const shieldingPaths = Object.keys(shielding).flatMap((id) => shieldMaterials.map((m) => 'protection.shielding.' + id + '.' + m));
  const mulPath = 'standards.hasty.coverMul';
  const rep = importDoctrine(
    fixture([...shieldingPaths.map((path) => ({ path, value: 0 })), { path: mulPath, value: 0 }]),
    { dryRun: true },
  );

  assert.ok(rep.ok, 'plausibility reports, never blocks');
  const on = rep.warnings.filter((w) => w.path === mulPath);
  assert.equal(on.length, 1, 'the multiplier draws exactly one finding of its own');
  assert.match(on[0]!.reason, /MISSING value/, 'reported as an absent value: ' + on[0]!.reason);
  // The shielding rows still own their own problem — the multiplier finding does not replace them.
  const warned = new Set(rep.warnings.map((w) => w.path));
  for (const p of shieldingPaths) assert.ok(warned.has(p), 'no finding for ' + p);
});

test('with no legible thickness left, a POSITIVE multiplier is left to the rows that own the problem', () => {
  // Deliberate, not an oversight: a positive multiplier can only be convicted by a thickness that
  // reads fine on its own, and every thickness here is already reported on its own row. Naming the
  // standards table too would send the filler there to correct the shielding table. Nothing is
  // silent, and the moment one legible thickness lands the product is re-derived against this same
  // multiplier and it is named then — which the next case proves.
  const shieldingPaths = Object.keys(shielding).flatMap((id) => shieldMaterials.map((m) => 'protection.shielding.' + id + '.' + m));
  const mulPath = 'standards.hasty.coverMul';
  const rep = importDoctrine(
    fixture([...shieldingPaths.map((path) => ({ path, value: 1e-9 })), { path: mulPath, value: 1e-9 }]),
    { dryRun: true },
  );

  assert.ok(rep.ok);
  assert.ok(!rep.warnings.some((w) => w.path.startsWith('standards.')), 'no wrong-table blame');
  const warned = new Set(rep.warnings.map((w) => w.path));
  for (const p of shieldingPaths) assert.ok(warned.has(p), 'no finding for ' + p + ' — the fill is not silent');

  // …and it really does self-heal: land one legible thickness against that same live multiplier
  // and the multiplier is named on its own.
  const applied = importDoctrine(fixture([...shieldingPaths.map((path) => ({ path, value: 1e-9 })), { path: mulPath, value: 1e-9 }]));
  try {
    assert.ok(applied.ok);
    const later = importDoctrine(fixture([{ path: 'protection.shielding.sa-556.soil', value: 2 }]), { dryRun: true });
    assert.ok(later.warnings.some((w) => w.path === mulPath), 'the live multiplier is judged against the newly legible thickness');
  } finally {
    restore();
  }
});

test('a stored fill that no longer matches the registry is refused, not trusted', async () => {
  const adapter = new MemoryAdapter();
  await adapter.set('doctrine-fill', JSON.stringify({ doctrineVersion: 1, entries: [{ path: 'gone.path', value: 1, status: 'DOCTRINE', source: 'FM' }] }));
  const applied = await restoreFill(adapter);
  assert.equal(applied, 0, 'invalid stored fill applies nothing');
  restore();
});
