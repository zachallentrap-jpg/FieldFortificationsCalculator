// The loading pipeline (blueprint §2.6): all-or-nothing, reasons on every refusal,
// corrupt vs rejected distinguished, STALE loads, unknown leaves reject, class gates
// hold, v1's zero-divisor/unit bug classes are dead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFill } from '../src/schema/io';
import { computeContentHash, exportFill } from '../src/schema/fill';
import { generateFill, SCHEMA_HASH } from './fixtures/testFill';
import { EXCAVATION_SPLIT_IDS, digRateHandId, holeId, oneManCheckId, bodyApproxId, standardMulId } from '../src/schema/leaves/index';

const OPTS = { expectedSchemaHash: SCHEMA_HASH, allowTestClass: true };

const rehash = (f: ReturnType<typeof generateFill>): ReturnType<typeof generateFill> => ({
  ...f,
  contentHash: computeContentHash(f),
});

test('a complete generated fill loads: no missing leaves, no coherence issues', () => {
  const res = loadFill(exportFill(generateFill()), OPTS);
  assert.ok(res.ok, JSON.stringify(!res.ok && res.reasons));
  assert.equal(res.stale, false);
  assert.deepEqual(res.missingLeafIds, []);
  assert.deepEqual(res.coherenceIssues, []);
  assert.equal(res.fill.cls, 'TEST');
  assert.equal(typeof res.fill.numeric(holeId('one_man', 'D')), 'number');
});

test('tampering with a value after hashing is CORRUPT, naming the divergence', () => {
  const fill = generateFill();
  const tampered = exportFill(fill).replace(/"value":0.5/, '"value":9.5');
  assert.notEqual(tampered, exportFill(fill));
  const res = loadFill(tampered, OPTS);
  assert.ok(!res.ok && res.kind === 'corrupt');
  assert.match(res.reasons.join(' '), /content hash mismatch/);
});

test('TEST class refuses to load when the build disallows it (G-11 behavior)', () => {
  const res = loadFill(exportFill(generateFill()), { ...OPTS, allowTestClass: false });
  assert.ok(!res.ok && res.kind === 'rejected');
  assert.match(res.reasons.join(' '), /TEST-class/);
});

test('TRAINING records must carry the baked-in fictitious mark; DOCTRINE must not', () => {
  const training = generateFill({ cls: 'TRAINING' });
  const stripped = rehash({
    ...training,
    records: training.records.map((r, i) => (i === 0 ? (({ fictitious, ...rest }) => rest)(r) as typeof r : r)),
  });
  const res = loadFill(exportFill(stripped), OPTS);
  assert.ok(!res.ok && res.kind === 'rejected');
  assert.match(res.reasons.join(' '), /fictitious/);

  const doctrine = generateFill({ cls: 'DOCTRINE' });
  const marked = rehash({
    ...doctrine,
    records: doctrine.records.map((r, i) => (i === 0 ? { ...r, fictitious: true as const } : r)),
  });
  const res2 = loadFill(exportFill(marked), OPTS);
  assert.ok(!res2.ok && res2.kind === 'rejected');
  assert.match(res2.reasons.join(' '), /fictitious mark on non-TRAINING/);
});

test('zero divisor is rejected with a reason (v1 importer accepted it — never again)', () => {
  const res = loadFill(
    exportFill(generateFill({ override: { [digRateHandId('sand')]: 0 } })),
    OPTS,
  );
  assert.ok(!res.ok && res.kind === 'rejected');
  assert.match(res.reasons.join(' '), /divisor leaf cannot be zero|greater than zero/);
});

test('excavation splits must sum to 1 within half-ULP of entered precision (B18)', () => {
  const bad = loadFill(
    exportFill(generateFill({ override: { [EXCAVATION_SPLIT_IDS.parapet]: 0.3 } })),
    OPTS,
  );
  assert.ok(!bad.ok && bad.kind === 'rejected');
  assert.match(bad.reasons.join(' '), /splits sum/);

  // 0.33 + 0.33 + 0.33 + 0.01 = 1.00 exactly; 2-decimal entries tolerate ±0.005.
  const ok = loadFill(
    exportFill(generateFill({
      override: {
        [EXCAVATION_SPLIT_IDS.security]: 0.01,
        [EXCAVATION_SPLIT_IDS.hasty]: 0.33,
        [EXCAVATION_SPLIT_IDS.deliberate]: 0.33,
        [EXCAVATION_SPLIT_IDS.parapet]: 0.33,
      },
    })),
    OPTS,
  );
  assert.ok(ok.ok, JSON.stringify(!ok.ok && ok.reasons));
});

test('standards monotonicity: hasty cannot exceed deliberate', () => {
  const res = loadFill(
    exportFill(generateFill({ override: { [standardMulId('hasty', 'depth')]: 2.0 } })),
    OPTS,
  );
  assert.ok(!res.ok && res.kind === 'rejected');
  assert.match(res.reasons.join(' '), /hasty .* exceeds deliberate/);
});

test('shielding caliber monotonicity within a material chain', () => {
  const res = loadFill(
    exportFill(generateFill({ override: { 'shield.sa-145.soil': 0.01 } })),
    OPTS,
  );
  assert.ok(!res.ok && res.kind === 'rejected');
  assert.match(res.reasons.join(' '), /requires less than smaller-caliber/);
});

test('card phrases reject digits AND number-words (B35)', () => {
  const digits = loadFill(
    exportFill(generateFill({ override: { [oneManCheckId('deliberate')]: 'Dig 4 feet down.' } })),
    OPTS,
  );
  assert.ok(!digits.ok && digits.kind === 'rejected');
  assert.match(digits.reasons.join(' '), /digits are banned/);

  const words = loadFill(
    exportFill(generateFill({ override: { [oneManCheckId('deliberate')]: 'Dig four feet down.' } })),
    OPTS,
  );
  assert.ok(!words.ok && words.kind === 'rejected');
  assert.match(words.reasons.join(' '), /number-words are banned/);
});

test('unknown leaf id rejects (append-only schema, wrong lineage)', () => {
  const fill = generateFill();
  const withAlien = rehash({
    ...fill,
    records: [...fill.records, {
      leafId: 'alien.leaf', value: 1, citation: { pub: 'X', locator: 'Y' },
      enteredBy: 'T', entryMethod: 'file-import' as const,
    }],
  });
  const res = loadFill(exportFill(withAlien), OPTS);
  assert.ok(!res.ok && res.kind === 'rejected');
  assert.match(res.reasons.join(' '), /unknown leaf id alien.leaf/);
});

test('partial fill loads with a delta report (missing leaves named)', () => {
  const res = loadFill(
    exportFill(generateFill({ only: (id) => !id.startsWith('sump.') })),
    OPTS,
  );
  assert.ok(res.ok);
  assert.ok(res.missingLeafIds.length >= 5);
  assert.ok(res.missingLeafIds.every((id) => id.startsWith('sump.')));
});

test('schemaHash mismatch loads STALE, never refuses (§2.7)', () => {
  const res = loadFill(exportFill(generateFill()), {
    ...OPTS, expectedSchemaHash: 'f'.repeat(64),
  });
  assert.ok(res.ok);
  assert.equal(res.stale, true);
});

test('coherence violation surfaces per-leaf, never refuses (B35)', () => {
  const res = loadFill(
    exportFill(generateFill({ override: { [bodyApproxId('armpit')]: 0.1 } })),
    OPTS,
  );
  assert.ok(res.ok);
  assert.equal(res.coherenceIssues.length, 1);
  assert.equal(res.coherenceIssues[0]?.checkLeafId, oneManCheckId('deliberate'));
});

test('prototype-pollution keys are CORRUPT; oversized files are CORRUPT', () => {
  const res = loadFill('{"__proto__":{"x":1}}', OPTS);
  assert.ok(!res.ok && res.kind === 'corrupt');
  const big = loadFill('x'.repeat(64), { ...OPTS, maxBytes: 16 });
  assert.ok(!big.ok && big.kind === 'corrupt');
});

test('non-monotonic audit seq rejects', () => {
  const fill = generateFill();
  const badAudit = rehash({
    ...fill,
    audit: [
      { seq: 1, at: '2000-01-01T00:00:00Z', type: 'entry' as const },
      { seq: 1, at: '2000-01-01T00:00:01Z', type: 'export' as const },
    ],
  });
  const res = loadFill(exportFill(badAudit), OPTS);
  assert.ok(!res.ok && res.kind === 'rejected');
  assert.match(res.reasons.join(' '), /audit seq/);
});
