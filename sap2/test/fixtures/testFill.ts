// Synthetic TEST-class fill generator (blueprint §2.2): structurally valid,
// doctrinally absurd pattern series with sentinel citations. Deterministic by
// construction (index patterns, fixed timestamps — no clock, no randomness). Also
// the source of TRAINING/DOCTRINE-shaped fixtures for pipeline tests; G-11 proves
// none of these can be embedded in a dist.

import { LEAVES } from '../../src/schema/leaves/index';
import { EXCAVATION_SPLIT_IDS, standardMulId, bodyApproxId, holeId } from '../../src/schema/leaves/index';
import { THREAT_STRUCTURE, shieldLeafId } from '../../src/schema/leaves/protection';
import { SHIELD_MATERIAL_IDS, STANDARD_IDS } from '../../src/schema/ids';
import { isNumericLeaf, type NumericLeaf } from '../../src/schema/leaf';
import { computeSchemaHash } from '../../src/schema/schemaHash';
import {
  FILL_FORMAT_VERSION, computeContentHash,
  type FillClass, type FillFile, type FillRecord,
} from '../../src/schema/fill';

export const SCHEMA_HASH = computeSchemaHash(LEAVES);
const SENTINEL_CITATION = { pub: 'TEST-000 (fictitious)', locator: 'synthetic pattern series' };
const FIXED_AT = '2000-01-01T00:00:00Z';

// Constrained families get explicit values; everything else follows index patterns.
const constrained = (): Map<string, number> => {
  const m = new Map<string, number>();
  m.set(EXCAVATION_SPLIT_IDS.security, 0.05);
  m.set(EXCAVATION_SPLIT_IDS.hasty, 0.3);
  m.set(EXCAVATION_SPLIT_IDS.deliberate, 0.45);
  m.set(EXCAVATION_SPLIT_IDS.parapet, 0.2);
  STANDARD_IDS.forEach((s, i) => {
    for (const which of ['depth', 'cover', 'labor'] as const) {
      m.set(standardMulId(s, which), 0.5 + i * 0.5); // hasty 0.5 ≤ deliberate 1.0 ≤ reinforced 1.5
    }
  });
  // Shielding: strictly non-decreasing along each (class, material) caliber chain.
  for (const mat of SHIELD_MATERIAL_IDS) {
    const matIdx = SHIELD_MATERIAL_IDS.indexOf(mat);
    for (const cls of ['small_arms', 'indirect'] as const) {
      const chain = THREAT_STRUCTURE
        .filter((t) => t.cls === cls && t.caliberMm !== undefined)
        .sort((a, b) => (a.caliberMm ?? 0) - (b.caliberMm ?? 0));
      chain.forEach((t, i) => m.set(shieldLeafId(t.id, mat), Math.round((0.5 + i * 0.25 + matIdx * 0.01) * 100) / 100));
    }
  }
  return m;
};

// Quantize to the leaf's declared precision — float pattern arithmetic must not leak
// artifact decimals (the importer enforces entered precision).
const toDecimals = (v: number, d: number): number => {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
};

const patternNumeric = (leaf: NumericLeaf, i: number): number => {
  if (leaf.integer) {
    const v = (i % 4) + (leaf.bounds.kind === 'sign' && leaf.bounds.sign === '>=0' ? 0 : 1);
    return leaf.divisor && v === 0 ? 1 : v;
  }
  const raw =
    leaf.bounds.kind === 'sign' && leaf.bounds.sign === '0..1' ? 0.1 + (i % 8) * 0.1
    : leaf.bounds.kind === 'sign' && leaf.bounds.sign === '>=0' ? (i % 6) * 0.75
    : 0.5 + (i % 9) * 0.65; // >0
  const q = toDecimals(raw, leaf.maxDecimals);
  return leaf.bounds.kind === 'sign' && leaf.bounds.sign === '>0' && q === 0 ? toDecimals(0.1, leaf.maxDecimals) : q;
};

const phraseFor = (kind: 'check' | 'body_unit'): string =>
  kind === 'check'
    ? 'Stand on the floor. Lift your arm. The top edge of the hole hits your armpit.'
    : 'Up to your armpit.';

export interface GenOptions {
  readonly cls?: FillClass;
  /** Restrict to a subset of leaf ids (partial fills for fuzz/delta tests). */
  readonly only?: (leafId: string) => boolean;
  /** Post-generation value overrides (tamper/violation tests). */
  readonly override?: Readonly<Record<string, number | boolean | string>>;
}

export const generateFill = (opts: GenOptions = {}): FillFile => {
  const cls = opts.cls ?? 'TEST';
  const fixed = constrained();
  const records: FillRecord[] = [];
  LEAVES.forEach((leaf, i) => {
    if (opts.only && !opts.only(leaf.id)) return;
    let value: number | boolean | string;
    if (isNumericLeaf(leaf)) value = fixed.get(leaf.id) ?? patternNumeric(leaf, i);
    else if (leaf.unit === 'flag') value = i % 2 === 0;
    else value = phraseFor(leaf.kind as 'check' | 'body_unit');
    const o = opts.override?.[leaf.id];
    if (o !== undefined) value = o;
    records.push({
      leafId: leaf.id,
      value,
      ...(leaf.citationKind === 'pub-cited'
        ? { citation: SENTINEL_CITATION }
        : { methodNote: 'synthetic pattern (fictitious)' }),
      enteredBy: 'TEST HARNESS',
      entryMethod: 'file-import',
      ...(cls === 'TRAINING' ? { fictitious: true as const } : {}),
    });
  });

  // Coherence: body approximations track their governing dims (B35) unless a test
  // overrides them to provoke a mismatch.
  const dimOf = (id: string): number | undefined => {
    const r = records.find((x) => x.leafId === id);
    return typeof r?.value === 'number' ? r.value : undefined;
  };
  const setBody = (bodyId: string, v: number | undefined): void => {
    if (v === undefined) return;
    const idx = records.findIndex((x) => x.leafId === bodyId);
    if (idx >= 0 && opts.override?.[bodyId] === undefined) {
      const prev = records[idx]!;
      records[idx] = { ...prev, value: v };
    }
  };
  setBody(bodyApproxId('armpit'), dimOf(holeId('one_man', 'D')));
  const d = dimOf(holeId('one_man', 'D'));
  setBody(bodyApproxId('knee'), d !== undefined ? Math.round(Math.max(0.25, d - 1.5) * 100) / 100 : undefined);

  const body = {
    fillFormatVersion: FILL_FORMAT_VERSION,
    class: cls,
    schemaHash: SCHEMA_HASH,
    records,
    audit: [{ seq: 1, at: FIXED_AT, type: 'entry' as const, note: 'synthetic generation' }],
  };
  return { ...body, contentHash: computeContentHash(body) };
};
