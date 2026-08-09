// Watermark machine (§2.7): pure-function state, INV-4 trust asymmetry (completeness
// NEVER clears a watermark — only a commissioning record honoring this exact fill,
// schema, and position does), per-position coverage (B6), revocation, TRAINING floor,
// STALE precedence, conditions-gate re-arming on class escalation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watermarkState, artifactPolicy, type CommissioningRecord, type WatermarkInputs } from '../src/schema/watermark';
import { needsAcceptance, recordAcceptance } from '../src/state/conditions';
import { loadFill } from '../src/schema/io';
import { computeContentHash, exportFill } from '../src/schema/fill';
import { generateFill, SCHEMA_HASH } from './fixtures/testFill';
import { CONSUMERS } from '../src/schema/consumers';
import type { FillValue } from '../src/schema/fill';

const load = (opts: Parameters<typeof generateFill>[0] = {}): { fill: FillValue; missing: readonly string[] } => {
  const res = loadFill(exportFill(generateFill({ cls: 'DOCTRINE', ...opts })), {
    expectedSchemaHash: SCHEMA_HASH, allowTestClass: true,
  });
  assert.ok(res.ok, JSON.stringify(!res.ok && res.reasons));
  return { fill: res.fill, missing: res.missingLeafIds };
};

// A small honest cone for one_man artifacts (full cone assembly is engine work).
const CONE = [
  'pos.one_man.hole.L', 'pos.one_man.hole.W', 'pos.one_man.hole.D',
  'pos.one_man.crewSize', 'soil.loam.digRateHand', 'shield.ind-mtr-81.soil',
];

const record = (fill: FillValue, over: Partial<CommissioningRecord> = {}): CommissioningRecord => ({
  covers: ['one_man'],
  fillContentHash: fill.contentHash,
  schemaHash: fill.schemaHash,
  commissionerName: 'J. Q. Sapper',
  dateISO: '2026-09-14',
  singleOperator: true,
  waiverCount: 0,
  externalAnchorAcknowledged: true,
  ...over,
});

const base = (fill: FillValue | null, over: Partial<WatermarkInputs> = {}): WatermarkInputs => ({
  fill,
  appSchemaHash: SCHEMA_HASH,
  missingLeafIds: [],
  artifactConeLeafIds: CONE,
  positionId: 'one_man',
  commissioning: null,
  revokedFillHashes: new Set(),
  ...over,
});

test('no fill → TEMPLATE; TRAINING class floors at TRAINING with FICT + no bare exports', () => {
  assert.equal(watermarkState(base(null)).state, 'TEMPLATE');
  const trainingRes = loadFill(exportFill(generateFill({ cls: 'TRAINING' })), {
    expectedSchemaHash: SCHEMA_HASH, allowTestClass: true,
  });
  assert.ok(trainingRes.ok);
  const s = watermarkState(base(trainingRes.fill));
  assert.equal(s.state, 'TRAINING');
  const policy = artifactPolicy(s);
  assert.equal(policy.fictSuffixOnNumerals, true);
  assert.equal(policy.bareExports, false);
  assert.equal(policy.signatureBlocks, false);
});

test('complete verified cone WITHOUT commissioning stays watermarked (INV-4)', () => {
  // Generator records carry no verifiedBy → unverified; even a fully verified fill
  // without a ceremony record must never render COMMISSIONED.
  const { fill } = load();
  const s = watermarkState(base(fill));
  assert.equal(s.state, 'FILLED_UNCOMMISSIONED');
  assert.ok(s.state === 'FILLED_UNCOMMISSIONED' && (s.reason === 'unverified' || s.reason === 'awaiting-commissioning'));
});

test('commissioning honors only: exact hash + schema + covered position + complete verified cone', () => {
  const verified = generateFill({ cls: 'DOCTRINE' });
  const verifiedAll = {
    ...verified,
    records: verified.records.map((r) => ({ ...r, verifiedBy: 'B. Checker', verifyMethod: 'independent-file' as const })),
  };
  const res = loadFill(
    exportFill({ ...verifiedAll, contentHash: computeContentHash(verifiedAll) }),
    { expectedSchemaHash: SCHEMA_HASH, allowTestClass: true },
  );
  assert.ok(res.ok);
  const fill = res.fill;

  const good = watermarkState(base(fill, { commissioning: record(fill) }));
  assert.equal(good.state, 'COMMISSIONED');
  assert.equal(artifactPolicy(good).signatureBlocks, true);

  // Wrong position → not covered → watermarked.
  const wrongPos = watermarkState(base(fill, { commissioning: record(fill), positionId: 'two_man' }));
  assert.equal(wrongPos.state, 'FILLED_UNCOMMISSIONED');

  // Wrong hash → not honored.
  const wrongHash = watermarkState(base(fill, { commissioning: record(fill, { fillContentHash: 'f'.repeat(64) }) }));
  assert.equal(wrongHash.state, 'FILLED_UNCOMMISSIONED');

  // Revoked hash → not honored AND loudly flagged.
  const revoked = watermarkState(base(fill, {
    commissioning: record(fill),
    revokedFillHashes: new Set([fill.contentHash]),
  }));
  assert.ok(revoked.state === 'FILLED_UNCOMMISSIONED' && revoked.revoked);
});

test('unfilled cone leaf → FILLED_UNCOMMISSIONED with reason unfilled, counted', () => {
  const { fill } = load({ only: (id) => id !== 'pos.one_man.hole.D' });
  const s = watermarkState(base(fill));
  assert.ok(s.state === 'FILLED_UNCOMMISSIONED' && s.reason === 'unfilled' && s.unfilledCount === 1);
});

test('schema mismatch → STALE even with a commissioning record (not honored)', () => {
  const { fill } = load();
  const s = watermarkState(base(fill, { appSchemaHash: 'e'.repeat(64), commissioning: record(fill) }));
  assert.equal(s.state, 'STALE');
});

test('cone ids exist in the consumer universe (test hygiene)', () => {
  const all = new Set(Object.values(CONSUMERS).flat());
  for (const id of CONE) assert.ok(all.has(id), `test cone id not in consumers: ${id}`);
});

test('conditions gate: first run, text bump, and class escalation re-gate; de-escalation does not', () => {
  assert.equal(needsAcceptance(null, 'TEMPLATE'), true);
  const a = recordAcceptance('Z. Allen', '2026-08-02', 'TEMPLATE');
  assert.equal(needsAcceptance(a, 'TEMPLATE'), false);
  assert.equal(needsAcceptance(a, 'TRAINING'), true);
  const b = recordAcceptance('Z. Allen', '2026-08-02', 'DOCTRINE');
  assert.equal(needsAcceptance(b, 'TRAINING'), false);
  assert.equal(needsAcceptance(b, 'TEMPLATE'), false);
  assert.throws(() => recordAcceptance('', '2026-08-02', 'TEMPLATE'));
});
