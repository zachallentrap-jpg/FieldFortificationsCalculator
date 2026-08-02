// The fill loading pipeline (blueprint §2.6): safe parse → format gate → class gate →
// integrity → schema binding (mismatch = STALE path, never refusal) → all-or-nothing
// validation → commit as immutable value. Nothing partial ever loads; every refusal
// names its reasons. v1's importer accepted 0-divisors and unknown units — the
// relational tiers here kill that class.

import { LEAF_INDEX, LEAVES } from './leaves/index';
import { EXCAVATION_SPLIT_IDS, standardMulId } from './leaves/index';
import { THREAT_STRUCTURE, shieldLeafId } from './leaves/protection';
import { SHIELD_MATERIAL_IDS } from './ids';
import { isNumericLeaf, type CheckLeaf, type NumericLeaf, type SchemaLeaf } from './leaf';
import {
  AUDIT_EVENT_TYPES, FILL_FORMAT_VERSION, computeContentHash, toFillValue,
  type AuditEvent, type FillClass, type FillFile, type FillRecord, type FillValue,
} from './fill';

export interface LoadOptions {
  /** The running app's schema hash — mismatch loads STALE, never refuses. */
  readonly expectedSchemaHash: string;
  /** TEST-class fills load only in test harnesses; shipped builds pass false and the
   *  G-11 emptiness proof exercises the refusal. */
  readonly allowTestClass: boolean;
  readonly maxBytes?: number;
}

export interface CoherenceIssue {
  readonly checkLeafId: string;
  readonly governingDimKey: string;
  readonly bodyUnitId: string;
  readonly deltaFt: number;
  readonly toleranceFt: number;
}

export type LoadResult =
  | {
      readonly ok: true;
      readonly fill: FillValue;
      /** schemaHash differs from the running app's — carried leaves compute, the
       *  watermark machine renders STALE, commissioning is not honored (§2.7). */
      readonly stale: boolean;
      /** Schema leaves absent from the fill (delta report → FILLED-UNCOMMISSIONED). */
      readonly missingLeafIds: readonly string[];
      /** Check phrases out of tolerance with their governing dimension (B35):
       *  surfaced per-leaf (cards render PENDING/MISMATCH), never a refusal. */
      readonly coherenceIssues: readonly CoherenceIssue[];
    }
  | {
      readonly ok: false;
      /** corrupt = integrity/malformation (file cannot be trusted at all);
       *  rejected = well-formed but fails validation (nothing applied). */
      readonly kind: 'corrupt' | 'rejected';
      readonly reasons: readonly string[];
    };

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Deep null-prototype copy that refuses pollution-shaped keys. */
const sanitize = (v: unknown, path: string, reasons: string[]): unknown => {
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map((x, i) => sanitize(x, `${path}[${i}]`, reasons));
  if (typeof v === 'object') {
    const out = Object.create(null) as Record<string, unknown>;
    for (const k of Object.keys(v as object)) {
      if (DANGEROUS_KEYS.has(k)) {
        reasons.push(`dangerous key "${k}" at ${path}`);
        continue;
      }
      out[k] = sanitize((v as Record<string, unknown>)[k], `${path}.${k}`, reasons);
    }
    return out;
  }
  reasons.push(`unsupported value type ${typeof v} at ${path}`);
  return null;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Owner-authored card text may carry NO magnitude in any spelling (B35): literal
// digits and number-words alike are rejected — magnitudes reach cards only through
// engine-filled slots from the governing leaf.
const NUMBER_WORDS =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|quarter|third)\b/i;
const TEXT_CHARSET = /^[a-zA-Z ,.'’!?():;/-]+$/;
const TEXT_MAX_LEN = 140;

const decimalsOf = (n: number): number => {
  const s = String(n);
  const dot = s.indexOf('.');
  if (dot === -1) return 0;
  const eIdx = s.indexOf('e');
  return (eIdx === -1 ? s.length : eIdx) - dot - 1;
};

const validateRecordAgainstLeaf = (r: FillRecord, leaf: SchemaLeaf, cls: FillClass, reasons: string[]): void => {
  const where = `record ${r.leafId}`;
  if (cls === 'TRAINING' && r.fictitious !== true) reasons.push(`${where}: TRAINING record missing baked-in fictitious mark`);
  if (cls !== 'TRAINING' && r.fictitious === true) reasons.push(`${where}: fictitious mark on non-TRAINING record`);
  if (leaf.citationKind === 'pub-cited') {
    if (!r.citation || r.citation.pub.trim() === '' || r.citation.locator.trim() === '') {
      reasons.push(`${where}: pub-cited leaf requires citation pub + locator`);
    }
  } else if (r.methodNote === undefined || r.methodNote.trim() === '') {
    reasons.push(`${where}: owner-estimate leaf requires a method note (B16)`);
  }

  if (isNumericLeaf(leaf)) {
    if (typeof r.value !== 'number' || !Number.isFinite(r.value)) {
      reasons.push(`${where}: numeric leaf requires a finite number`);
      return;
    }
    const v = r.value;
    const b = leaf.bounds;
    if (b.kind === 'sign') {
      if (b.sign === '>0' && !(v > 0)) reasons.push(`${where}: must be greater than zero`);
      if (b.sign === '>=0' && !(v >= 0)) reasons.push(`${where}: must be zero or greater`);
      if (b.sign === '0..1' && !(v >= 0 && v <= 1)) reasons.push(`${where}: must be between zero and one`);
    } else if (v < b.min || v > b.max) {
      reasons.push(`${where}: outside structural bounds (${b.decisionRef})`);
    }
    if (leaf.divisor && v === 0) reasons.push(`${where}: divisor leaf cannot be zero`);
    if (leaf.integer && !Number.isInteger(v)) reasons.push(`${where}: must be a whole number`);
    if (decimalsOf(v) > leaf.maxDecimals) reasons.push(`${where}: more decimals than the leaf's declared precision (${leaf.maxDecimals})`);
    return;
  }
  if (leaf.unit === 'flag') {
    if (typeof r.value !== 'boolean') reasons.push(`${where}: flag leaf requires true/false`);
    return;
  }
  // text leaf (check / body_unit)
  if (typeof r.value !== 'string') {
    reasons.push(`${where}: text leaf requires a string`);
    return;
  }
  const s = r.value;
  if (s.trim().length === 0) reasons.push(`${where}: empty phrase`);
  if (s.length > TEXT_MAX_LEN) reasons.push(`${where}: phrase longer than ${TEXT_MAX_LEN} characters`);
  if (/[0-9]/.test(s)) reasons.push(`${where}: digits are banned in card phrases (B35)`);
  if (NUMBER_WORDS.test(s)) reasons.push(`${where}: number-words are banned in card phrases (B35)`);
  if (!TEXT_CHARSET.test(s)) reasons.push(`${where}: phrase contains characters outside the allowed set`);
};

// Tier-2 relational checks. Tolerance rule (B18): half-ULP of the ENTERED precision —
// truthfully transcribing a rounded pub is always enterable; no relational check may
// require an app release to accept a true source value.
const relationalChecks = (byId: ReadonlyMap<string, FillRecord>, reasons: string[]): void => {
  // Excavation splits sum to 1.
  const splitIds = Object.values(EXCAVATION_SPLIT_IDS);
  const splits = splitIds.map((id) => byId.get(id)?.value).filter((v): v is number => typeof v === 'number');
  if (splits.length === splitIds.length) {
    const maxDec = Math.max(...splits.map(decimalsOf), 1);
    const tol = 0.5 * Math.pow(10, -maxDec);
    const sum = splits.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > tol + 1e-12) {
      reasons.push(`excavation splits sum to ${sum}, not 1 (tolerance ±${tol} from entered precision)`);
    }
  }
  // Standards monotonicity: hasty <= deliberate <= reinforced per multiplier family.
  for (const which of ['depth', 'cover', 'labor'] as const) {
    const h = byId.get(standardMulId('hasty', which))?.value;
    const d = byId.get(standardMulId('deliberate', which))?.value;
    const rf = byId.get(standardMulId('reinforced', which))?.value;
    if (typeof h === 'number' && typeof d === 'number' && h > d)
      reasons.push(`standard ${which} multipliers: hasty (${h}) exceeds deliberate (${d})`);
    if (typeof d === 'number' && typeof rf === 'number' && d > rf)
      reasons.push(`standard ${which} multipliers: deliberate (${d}) exceeds reinforced (${rf})`);
  }
  // Shielding caliber monotonicity within (threat class, material): bigger caliber
  // never needs LESS of the same material. Compared only along present chains.
  for (const mat of SHIELD_MATERIAL_IDS) {
    for (const cls of ['small_arms', 'indirect'] as const) {
      const chain = THREAT_STRUCTURE
        .filter((t) => t.cls === cls && t.caliberMm !== undefined)
        .sort((a, b) => (a.caliberMm ?? 0) - (b.caliberMm ?? 0));
      let prev: { label: string; v: number } | undefined;
      for (const t of chain) {
        const v = byId.get(shieldLeafId(t.id, mat))?.value;
        if (typeof v !== 'number') continue;
        if (prev && v < prev.v) {
          reasons.push(`shielding ${mat}: ${t.label} (${v}) requires less than smaller-caliber ${prev.label} (${prev.v})`);
        }
        prev = { label: t.label, v };
      }
    }
  }
};

export const loadFill = (json: string, opts: LoadOptions): LoadResult => {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  if (new TextEncoder().encode(json).length > maxBytes) {
    return { ok: false, kind: 'corrupt', reasons: [`file exceeds ${maxBytes} bytes`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, kind: 'corrupt', reasons: [`not valid JSON: ${(e as Error).message}`] };
  }
  const sanitizeReasons: string[] = [];
  const root = sanitize(parsed, '$', sanitizeReasons);
  if (sanitizeReasons.length > 0) return { ok: false, kind: 'corrupt', reasons: sanitizeReasons };
  if (!isRecord(root)) return { ok: false, kind: 'corrupt', reasons: ['top level is not an object'] };

  // Format gate.
  const reasons: string[] = [];
  if (root['fillFormatVersion'] !== FILL_FORMAT_VERSION) {
    return { ok: false, kind: 'rejected', reasons: [`unsupported fillFormatVersion ${String(root['fillFormatVersion'])}`] };
  }
  const cls = root['class'];
  if (cls !== 'DOCTRINE' && cls !== 'TRAINING' && cls !== 'TEST') {
    return { ok: false, kind: 'rejected', reasons: [`unknown fill class ${String(cls)}`] };
  }
  if (cls === 'TEST' && !opts.allowTestClass) {
    return { ok: false, kind: 'rejected', reasons: ['TEST-class fills do not load in this build'] };
  }
  if (typeof root['schemaHash'] !== 'string' || !/^[0-9a-f]{64}$/.test(root['schemaHash'])) {
    return { ok: false, kind: 'corrupt', reasons: ['schemaHash missing or malformed'] };
  }
  if (!Array.isArray(root['records']) || !Array.isArray(root['audit'])) {
    return { ok: false, kind: 'corrupt', reasons: ['records/audit missing or not arrays'] };
  }
  if (typeof root['contentHash'] !== 'string') {
    return { ok: false, kind: 'corrupt', reasons: ['contentHash missing'] };
  }

  // Shape-narrow records and audit (best-effort typing before validation).
  const records = (root['records'] as unknown[]).map((r, i) => {
    if (!isRecord(r) || typeof r['leafId'] !== 'string') {
      reasons.push(`records[${i}]: malformed record`);
      return undefined;
    }
    return r as unknown as FillRecord;
  }).filter((r): r is FillRecord => r !== undefined);
  const audit = (root['audit'] as unknown[]).map((e, i) => {
    if (!isRecord(e) || typeof e['seq'] !== 'number' || typeof e['at'] !== 'string' ||
        !AUDIT_EVENT_TYPES.includes(e['type'] as AuditEvent['type'])) {
      reasons.push(`audit[${i}]: malformed event`);
      return undefined;
    }
    return e as unknown as AuditEvent;
  }).filter((e): e is AuditEvent => e !== undefined);
  if (reasons.length > 0) return { ok: false, kind: 'corrupt', reasons };

  const candidate: Omit<FillFile, 'contentHash'> = {
    fillFormatVersion: FILL_FORMAT_VERSION, class: cls, schemaHash: root['schemaHash'],
    records, audit,
  };

  // Integrity BEFORE semantics: a file whose hash doesn't match is untrusted entirely.
  const expectedHash = computeContentHash(candidate);
  if (expectedHash !== root['contentHash']) {
    return {
      ok: false, kind: 'corrupt',
      reasons: [`content hash mismatch: file says ${String(root['contentHash']).slice(0, 12)}…, canonical content hashes to ${expectedHash.slice(0, 12)}…`],
    };
  }

  // Schema binding: unknown leaf ⇒ reject (append-only ids make this a wrong-schema
  // signal, not a migration case); hash mismatch alone ⇒ STALE, still loads.
  for (const r of records) {
    if (!LEAF_INDEX.has(r.leafId)) reasons.push(`unknown leaf id ${r.leafId} (schema is append-only — this file is from a different lineage)`);
  }
  const seen = new Set<string>();
  for (const r of records) {
    if (seen.has(r.leafId)) reasons.push(`duplicate record for ${r.leafId}`);
    seen.add(r.leafId);
  }
  if (reasons.length > 0) return { ok: false, kind: 'rejected', reasons };

  // Audit list sanity: strictly monotonic seq.
  let lastSeq = 0;
  for (const e of audit) {
    if (e.seq <= lastSeq) reasons.push(`audit seq not strictly increasing at seq ${e.seq}`);
    lastSeq = e.seq;
  }

  // All-or-nothing validation.
  const byId = new Map<string, FillRecord>();
  for (const r of records) byId.set(r.leafId, r);
  for (const r of records) {
    const leaf = LEAF_INDEX.get(r.leafId);
    if (leaf) validateRecordAgainstLeaf(r, leaf, cls, reasons);
  }
  relationalChecks(byId, reasons);
  if (reasons.length > 0) return { ok: false, kind: 'rejected', reasons };

  // Coherence (per-leaf status, never refusal — B35).
  const coherenceIssues: CoherenceIssue[] = [];
  for (const leaf of LEAVES) {
    if (leaf.unit !== 'text' || leaf.kind !== 'check') continue;
    const c = (leaf as CheckLeaf).coherence;
    if (!c) continue;
    const dim = byId.get(c.governingDimKey)?.value;
    const approx = byId.get(`body.${c.bodyUnitId}.approxFt`)?.value;
    if (typeof dim !== 'number' || typeof approx !== 'number') continue;
    const delta = Math.abs(dim - approx);
    if (delta > c.toleranceFt) {
      coherenceIssues.push({
        checkLeafId: leaf.id, governingDimKey: c.governingDimKey,
        bodyUnitId: c.bodyUnitId, deltaFt: delta, toleranceFt: c.toleranceFt,
      });
    }
  }

  const file: FillFile = { ...candidate, contentHash: expectedHash };
  const missingLeafIds = LEAVES.filter((l) => !byId.has(l.id)).map((l) => l.id);
  return {
    ok: true,
    fill: toFillValue(file),
    stale: root['schemaHash'] !== opts.expectedSchemaHash,
    missingLeafIds,
    coherenceIssues,
  };
};

export type { NumericLeaf };
