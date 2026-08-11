// Woodframe doctrine export/import — the offline rule database over the mutable-leaf register.
//
// Every assertion here reads through a PUBLIC path — the doctrine tables themselves, the
// register views (allDoctrineEntries / lifeSafetyRegister), or a fresh export — never a value
// the io module handed back about its own work. The tests mutate a module-global register, so
// every mutating case restores the shipped state (resetDoctrine) and then proves the restore
// with the deterministic content hash of a full export against the pristine one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPAN, NAILING, RAIL, STAIR, HUT, LUMBER, RAMP,
  allDoctrineEntries, lifeSafetyRegister, citeOf, getByPath, doctrinePaths,
} from '../src/woodframe/doctrine';
import {
  exportDoctrine, importDoctrine, resetDoctrine, getAppliedManifest, counts,
  WOODFRAME_DOCTRINE_VERSION, type WoodframeEntryDTO,
} from '../src/woodframe/io';

// The shipped register, captured before any test can have mutated it.
const PRISTINE = exportDoctrine();

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** An entry as the live register would export it, with overrides — the way a user edits a file. */
function entryFor(path: string, over?: Partial<WoodframeEntryDTO>): WoodframeEntryDTO {
  const d = getByPath(path)!;
  return { path, value: clone(d.value), cite: d.cite, ph: d.ph, ...over };
}

const fileWith = (entries: unknown[]): unknown => ({ woodframeDoctrineVersion: WOODFRAME_DOCTRINE_VERSION, entries });

const pristineValueOf = (path: string): unknown => PRISTINE.entries.find((e) => e.path === path)!.value;

/** The whole register, byte-identical to shipped — the hash covers every leaf's value/cite/ph. */
function assertPristine(label: string): void {
  assert.equal(exportDoctrine().manifest!.contentHash, PRISTINE.manifest!.contentHash, label);
}

test('the register indexes exactly the leaves the doctrine views walk, structure frozen, leaves writable', () => {
  const entries = allDoctrineEntries();
  const paths = doctrinePaths();
  assert.ok(entries.length > 250, `a real register, got ${entries.length}`);
  assert.equal(paths.length, entries.length, 'the dotted-path index and the register views agree on the corpus');
  for (const e of entries) {
    const d = getByPath(e.id);
    assert.ok(d, `${e.id} is indexed`);
    assert.deepEqual(d!.value, e.value, `${e.id} indexes the live leaf`);
    assert.equal(d!.cite, e.cite);
  }
  // counts() is a third, independent walk — it must tell the same story as the views.
  const c = counts();
  assert.equal(c.total, entries.length);
  assert.equal(c.pending, entries.filter((e) => e.ph).length);
  assert.equal(c.lifeSafety, lifeSafetyRegister().length);
  // Structure frozen (no rule can appear or vanish at runtime), leaves writable (io.ts's door).
  assert.ok(Object.isFrozen(SPAN) && Object.isFrozen(NAILING) && Object.isFrozen(LUMBER) && Object.isFrozen(STAIR));
  assert.ok(!Object.isFrozen(SPAN.joist), 'the leaf object itself stays writable');
  assert.throws(() => {
    (NAILING as unknown as Record<string, unknown>).invented = 0;
  }, TypeError, 'adding a rule at runtime is refused by the frozen structure');
});

test('export round-trips 100% of registered leaves, as copies, and re-imports whole', () => {
  const ex = exportDoctrine({ author: 'S-3', date: '2026-08-11' });
  assert.equal(ex.woodframeDoctrineVersion, WOODFRAME_DOCTRINE_VERSION);
  assert.equal(ex.entries.length, allDoctrineEntries().length, 'every registered leaf is in the file');
  const paths = new Set(ex.entries.map((e) => e.path));
  assert.equal(paths.size, ex.entries.length, 'no duplicate paths');
  for (const e of allDoctrineEntries()) assert.ok(paths.has(e.id), `${e.id} exported`);
  assert.ok(/^[0-9a-f]{8}$/.test(ex.manifest!.contentHash), 'deterministic 32-bit content hash');
  assert.equal(ex.manifest!.author, 'S-3');
  // The LS tags travel in the file so an editor can see what they are touching — and the tagged
  // set is exactly the life-safety register, no more and no less.
  const tagged = ex.entries.filter((e) => e.lifeSafety === true).map((e) => e.path).sort();
  assert.deepEqual(tagged, lifeSafetyRegister().map((e) => e.id).sort());

  // The file is a COPY: editing its object graph must not write through into the register.
  const spanEntry = ex.entries.find((e) => e.path === 'SPAN.joist')!;
  (spanEntry.value as Record<string, Record<string, number>>)['2x8']!['16'] = 1;
  assert.notEqual(SPAN.joist.value['2x8']![16], 1, 'the export shares no object graph with the register');

  // …and a pristine export re-imports whole: every entry is importable (nothing read-only,
  // nothing silently missing), nothing warns, nothing changes.
  const rep = importDoctrine(exportDoctrine());
  try {
    assert.ok(rep.ok, rep.message);
    assert.equal(rep.applied, allDoctrineEntries().length, 'every exported entry applied');
    assert.deepEqual(rep.warnings, [], 'the shipped register is not flagged against itself');
  } finally {
    resetDoctrine();
  }
  assertPristine('round-trip left the register as shipped');
});

test('an imported value is READ LIVE through the doctrine table itself, not through io', () => {
  const table = clone(SPAN.joist.value) as Record<string, Record<string, number>>;
  const before = table['2x8']!['16']!;
  const corrected = before - 1; // stays monotone against both neighbouring rows and the 24-in column
  table['2x8']!['16'] = corrected;
  const rep = importDoctrine(fileWith([
    entryFor('SPAN.joist', { value: table, cite: 'FM 5-426 Table 6-2 (test fixture)', ph: false }),
    entryFor('NAILING.rimJoist', { value: '4-16d ea joist end (PH)' }),
  ]));
  try {
    assert.ok(rep.ok, rep.message);
    // The reads below go through the module-level doctrine exports — the path every generator
    // uses — so they prove the next generate sees the correction with no re-wiring.
    assert.equal(SPAN.joist.value['2x8']![16], corrected, 'the live span table carries the corrected cell');
    assert.equal(NAILING.rimJoist.value, '4-16d ea joist end (PH)', 'the live schedule carries the new string');
    assert.equal(SPAN.joist.ph, false, 'the page check landed');
    assert.equal(SPAN.joist.cite, 'FM 5-426 Table 6-2 (test fixture)', 'the cite landed');
    assert.ok(!citeOf(SPAN.joist).includes('(PH)'), 'the rendered cite reflects the page check');
    // The register views walk the same leaves — no second copy exists anywhere.
    assert.equal(allDoctrineEntries().find((e) => e.id === 'NAILING.rimJoist')!.value, '4-16d ea joist end (PH)');
    assert.equal(lifeSafetyRegister().find((e) => e.id === 'SPAN.joist')!.ph, false);
  } finally {
    resetDoctrine();
  }
  assert.equal(SPAN.joist.value['2x8']![16], before, 'reset restored the shipped span');
  assertPristine('live-read test cleaned up');
});

test('all-or-nothing: one poisoned entry refuses the whole file and nothing mutates', () => {
  const good = entryFor('RAIL.midHeightIn', { value: (RAIL.midHeightIn.value as number) + 1 });
  const poisoned = entryFor('STAIR.headroomIn', { value: Number.NaN });
  const rep = importDoctrine(fileWith([good, poisoned]));
  assert.ok(!rep.ok);
  assert.equal(rep.applied, 0);
  assert.ok(rep.rejected.some((r) => r.path === 'STAIR.headroomIn' && /finite/.test(r.reason)), 'the poison is named');
  assert.equal(RAIL.midHeightIn.value, pristineValueOf('RAIL.midHeightIn'), 'the VALID entry did not land either');
  assertPristine('a refused file mutated nothing');
});

test('a file can never untag — or tag — a life-safety rule', () => {
  const untag = importDoctrine(fileWith([entryFor('RAIL.topHeightIn', { lifeSafety: false })]));
  assert.ok(!untag.ok);
  assert.equal(untag.applied, 0);
  assert.ok(untag.rejected.some((r) => r.path === 'RAIL.topHeightIn' && /untag/.test(r.reason)), 'the untag attempt is named');
  assert.ok(lifeSafetyRegister().some((e) => e.id === 'RAIL.topHeightIn'), 'the LS register still holds the rule');

  const tag = importDoctrine(fileWith([entryFor('LAYOUT.studSpacingIn', { lifeSafety: true })]));
  assert.ok(!tag.ok);
  assert.ok(!lifeSafetyRegister().some((e) => e.id === 'LAYOUT.studSpacingIn'), 'a file cannot grow the LS register either');
  assertPristine('LS attempts mutated nothing');
});

test('a span table edited out of order is refused WHOLE — deeper never spans less, wider never spans more', () => {
  // Deeper member allowed less than a shallower one — every cell is in range and rightly typed,
  // so only the whole-table reading catches it.
  const rows = clone(SPAN.joist.value) as Record<string, Record<string, number>>;
  rows['2x10']!['16'] = rows['2x8']!['16']! - 1;
  const rep = importDoctrine(fileWith([entryFor('SPAN.joist', { value: rows })]));
  assert.ok(!rep.ok);
  assert.equal(rep.applied, 0);
  assert.ok(rep.rejected.some((r) => r.path === 'SPAN.joist' && /deeper member/.test(r.reason)), 'says which ordering broke');
  assert.deepEqual(SPAN.joist.value, pristineValueOf('SPAN.joist'), 'the live table is untouched — all or nothing');

  // The other axis: the 24-in column allowed more than the 16-in column.
  const cols = clone(SPAN.rafter.value) as Record<string, Record<string, number>>;
  cols['2x6']!['24'] = cols['2x6']!['16']! + 1;
  const rep2 = importDoctrine(fileWith([entryFor('SPAN.rafter', { value: cols })]));
  assert.ok(!rep2.ok);
  assert.ok(rep2.rejected.some((r) => r.path === 'SPAN.rafter' && /wider spacing/.test(r.reason)));

  // And the flat header table obeys the same depth ordering.
  const header = clone(SPAN.header.value) as Record<string, number>;
  header['2x12'] = header['2x10']! - 1;
  assert.ok(!importDoctrine(fileWith([entryFor('SPAN.header', { value: header })])).ok);
  assertPristine('span rejections mutated nothing');
});

test('a stair whose layout target breaks its own limit is refused, against the TABLE', () => {
  // Lower the limit under the untouched target: the file's one entry is valid on its own, and
  // the pair is incoherent — so the finding names STAIR, not a row a reader could edit alone.
  const rep = importDoctrine(fileWith([
    entryFor('STAIR.maxRiserIn', { value: (STAIR.targetRiserIn.value as number) - 0.5 }),
  ]));
  assert.ok(!rep.ok);
  assert.equal(rep.applied, 0);
  assert.deepEqual(rep.rejected, [], 'the one entry is not itself invalid');
  const t = rep.rejectedTables.find((r) => /targetRiserIn/.test(r.reason));
  assert.ok(t, 'the riser pair is the finding');
  assert.equal(t!.path, 'STAIR');
  assert.equal(getByPath(t!.path), undefined, 'a table identifier, not a register path');
  assert.ok(!/entr\(y\/ies\)/.test(rep.message ?? ''), `the summary does not call a table an entry: ${rep.message}`);

  // The tread pair, from the other side: a layout run below the tread minimum.
  const rep2 = importDoctrine(fileWith([
    entryFor('STAIR.unitRunIn', { value: (STAIR.minTreadIn.value as number) - 1 }),
  ]));
  assert.ok(!rep2.ok && rep2.rejectedTables.some((r) => /minTreadIn/.test(r.reason)));
  assertPristine('stair rejections mutated nothing');
});

test('the bird\'s-mouth seat fraction must stay in (0, 1]', () => {
  assert.ok(!importDoctrine(fileWith([entryFor('NOTCH.rafterSeatMaxDepthFrac', { value: 0 })])).ok, 'zero forbids the joint it bounds');
  const over = importDoctrine(fileWith([entryFor('NOTCH.rafterSeatMaxDepthFrac', { value: 1.5 })]));
  assert.ok(!over.ok, 'above 1 would permit notching past the whole member');
  assert.ok(over.rejected.some((r) => r.path === 'NOTCH.rafterSeatMaxDepthFrac' && /\(0, 1\]/.test(r.reason)));
  const one = importDoctrine(fileWith([entryFor('NOTCH.rafterSeatMaxDepthFrac', { value: 1 })]), { dryRun: true });
  assert.ok(one.ok, 'the bound is inclusive at 1');
  assertPristine('notch checks mutated nothing');
});

test('a dry run validates and previews without mutating anything', () => {
  const dims = clone(HUT.seaHut.value) as { lengthFt: number; widthFt: number; wallHeightFt: number };
  dims.lengthFt += 4;
  const pendingBefore = counts().pending;
  const rep = importDoctrine(
    fileWith([entryFor('HUT.seaHut', { value: dims, ph: false, cite: 'TM 5-302 (test fixture)' })]),
    { dryRun: true },
  );
  assert.ok(rep.ok && rep.dryRun, rep.message);
  assert.equal(rep.applied, 1, 'reports what WOULD apply');
  assert.equal(rep.counts.pending, pendingBefore - 1, 'the preview shows the post-apply count');
  assert.equal(counts().pending, pendingBefore, 'the live counts are unchanged');
  assert.deepEqual(HUT.seaHut.value, pristineValueOf('HUT.seaHut'), 'the dims did not move');
  assert.equal(HUT.seaHut.ph, true, 'the page check did not land');
  assert.equal(getAppliedManifest(), null, 'no fill recorded on a dry run');
  assertPristine('dry run mutated nothing');
});

test('reset restores every leaf to its shipped state — a test mutation cannot leak', () => {
  const slopes = clone(RAMP.slopes.value) as number[];
  slopes[slopes.length - 1] = slopes[slopes.length - 1]! + 2;
  const rep = importDoctrine(fileWith([
    entryFor('RAIL.topHeightIn', { value: (RAIL.topHeightIn.value as number) + 3 }),
    entryFor('LUMBER.joistNominal', { value: '2x10' }),
    entryFor('RAMP.slopes', { value: slopes }),
    entryFor('STAIR.maxRiserIn', { ph: false, cite: 'EM 385-1-1 (test fixture)' }),
  ]));
  assert.ok(rep.ok, rep.message);
  assert.notEqual(exportDoctrine().manifest!.contentHash, PRISTINE.manifest!.contentHash, 'the register really moved');
  assert.ok(getAppliedManifest(), 'the fill manifest was recorded');

  resetDoctrine();

  assert.equal(getAppliedManifest(), null, 'reset clears the fill attribution too');
  assertPristine('every leaf back to shipped — the full-export hash matches the pristine one');
  // And the views read the shipped values again through their own walks.
  assert.equal(lifeSafetyRegister().find((e) => e.id === 'RAIL.topHeightIn')!.value, pristineValueOf('RAIL.topHeightIn'));
  assert.equal(LUMBER.joistNominal.value, pristineValueOf('LUMBER.joistNominal'));
  assert.deepEqual([...RAMP.slopes.value], pristineValueOf('RAMP.slopes'));
  assert.equal(STAIR.maxRiserIn.ph, true);
});

test('the hazard battery: payload shape, version, bounds, pollution, unknown paths, duplicates', () => {
  const mk = (over: Partial<WoodframeEntryDTO>): unknown => fileWith([{ ...entryFor('RAIL.toeBoardHeightIn'), ...over }]);
  assert.ok(!importDoctrine(null).ok, 'null payload');
  assert.ok(!importDoctrine('x').ok, 'non-object payload');
  assert.ok(!importDoctrine({ entries: [] }).ok, 'missing version');
  assert.ok(!importDoctrine({ woodframeDoctrineVersion: WOODFRAME_DOCTRINE_VERSION + 1, entries: [] }).ok, 'newer version');
  assert.ok(!importDoctrine({ woodframeDoctrineVersion: WOODFRAME_DOCTRINE_VERSION }).ok, 'missing entries[]');
  assert.ok(!importDoctrine(fileWith([entryFor('RAIL.toeBoardHeightIn'), entryFor('RAIL.toeBoardHeightIn')])).ok, 'duplicate path');
  assert.ok(!importDoctrine(fileWith([entryFor('RAIL.toeBoardHeightIn')]), { maxEntries: 0 }).ok, 'oversized file');
  assert.ok(!importDoctrine(mk({ path: 'NO.suchRule' })).ok, 'unknown path');
  assert.ok(!importDoctrine(mk({ value: -1 })).ok, 'negative magnitude');
  assert.ok(!importDoctrine(mk({ value: 1000 })).ok, 'absurd bound');
  assert.ok(!importDoctrine(mk({ value: Infinity })).ok, 'non-finite');
  assert.ok(!importDoctrine(mk({ value: '4' })).ok, 'type mismatch: string for number');
  assert.ok(!importDoctrine(mk({ ph: 'no' as unknown as boolean })).ok, 'ph not boolean');
  assert.ok(!importDoctrine(mk({ cite: '' })).ok, 'empty cite');
  assert.ok(!importDoctrine(mk({ cite: 'x'.repeat(301) })).ok, 'cite past the bound');
  assert.ok(!importDoctrine(mk({ ph: false, cite: 'TODO find the page' })).ok, 'a page-check claim on a TODO cite');
  assert.ok(!importDoctrine(fileWith([entryFor('NAILING.rimJoist', { value: 'x'.repeat(201) })])).ok, 'string past the bound');
  assert.ok(!importDoctrine(fileWith([entryFor('NAILING.rimJoist', { value: '   ' })])).ok, 'blank schedule');

  // Structured leaves: the shipped shape is the contract — no key may come or go, no array may
  // change length. Only the values inside may move.
  const dims = clone(HUT.bHut.value) as Record<string, number>;
  delete dims['wallHeightFt'];
  assert.ok(!importDoctrine(fileWith([entryFor('HUT.bHut', { value: dims })])).ok, 'missing key');
  const extra = { ...(clone(HUT.bHut.value) as Record<string, number>), porchFt: 4 };
  assert.ok(!importDoctrine(fileWith([entryFor('HUT.bHut', { value: extra })])).ok, 'invented key');
  assert.ok(!importDoctrine(fileWith([entryFor('RAMP.slopes', { value: [4, 6] })])).ok, 'array length change');
  const nested = clone(SPAN.joist.value) as Record<string, Record<string, number>>;
  nested['2x8']!['16'] = -1;
  assert.ok(!importDoctrine(fileWith([entryFor('SPAN.joist', { value: nested })])).ok, 'bounds reach inside structured values');

  // Prototype pollution, as a parsed JSON file would actually deliver it.
  const polluted = JSON.parse(
    '{"woodframeDoctrineVersion":1,"entries":[{"path":"RAIL.topHeightIn","value":42,"cite":"x","ph":true,"__proto__":{"polluted":1}}]}',
  ) as unknown;
  assert.ok(!importDoctrine(polluted).ok, 'prototype-pollution keys refuse the file');

  assertPristine('the battery mutated nothing');
});

test('legal-but-odd fills apply WITH a warning — the pub outranks the heuristic, the report says where to look', () => {
  // A span that grew past 2× — monotone, in range, and still the shape of a transcription slip.
  const header = clone(SPAN.header.value) as Record<string, number>;
  for (const k of Object.keys(header)) header[k] = header[k]! * 3;
  const grow = importDoctrine(fileWith([entryFor('SPAN.header', { value: header })]), { dryRun: true });
  assert.ok(grow.ok, grow.message);
  assert.ok(grow.warnings.some((w) => w.path === 'SPAN.header' && /grew more than 2×/.test(w.reason)), 'the growth is reported');

  // A nailing count no crew drives.
  const nails = importDoctrine(fileWith([entryFor('NAILING.rimJoist', { value: '50-16d ea joist end (PH)' })]), { dryRun: true });
  assert.ok(nails.ok);
  assert.ok(nails.warnings.some((w) => w.path === 'NAILING.rimJoist' && /50 nails/.test(w.reason)));

  // A life-safety magnitude zeroed — inside the bounds, absent in effect.
  const zero = importDoctrine(fileWith([entryFor('RAIL.toeBoardHeightIn', { value: 0 })]), { dryRun: true });
  assert.ok(zero.ok);
  assert.ok(zero.warnings.some((w) => w.path === 'RAIL.toeBoardHeightIn' && /absent/.test(w.reason)));

  // And warnings never block: the grown table really lands, visible through the live table.
  const applied = importDoctrine(fileWith([entryFor('SPAN.header', { value: header })]));
  try {
    assert.ok(applied.ok);
    assert.ok(applied.warnings.length > 0, 'still reported on the real apply');
    assert.equal(SPAN.header.value['2x8'], header['2x8'], 'the odd value landed anyway');
  } finally {
    resetDoctrine();
  }
  assertPristine('warnings battery cleaned up');
});

test('the manifest is deterministic and clock-free; author and date come from the caller alone', () => {
  const a = exportDoctrine();
  const b = exportDoctrine();
  assert.equal(a.manifest!.contentHash, b.manifest!.contentHash, 'same register, same hash — no clock in it');
  assert.ok(!('date' in a.manifest!), 'no date unless the caller states one');
  assert.ok(!('author' in a.manifest!), 'no author unless the caller states one');

  const rep = importDoctrine({ ...exportDoctrine(), manifest: { author: 'MAJ Doe', date: '2026-08-11', contentHash: 'not-trusted' } });
  try {
    assert.ok(rep.ok, rep.message);
    assert.equal(getAppliedManifest()?.author, 'MAJ Doe', 'attribution recorded');
    assert.equal(getAppliedManifest()?.date, '2026-08-11');
    assert.ok(/^[0-9a-f]{8}$/.test(getAppliedManifest()!.contentHash));
    assert.equal(rep.manifest!.contentHash, a.manifest!.contentHash, 'the hash is recomputed from the entries, never trusted from the file');
  } finally {
    resetDoctrine();
  }
  assert.equal(getAppliedManifest(), null, 'reset clears the applied manifest');
  assertPristine('manifest test cleaned up');
});
