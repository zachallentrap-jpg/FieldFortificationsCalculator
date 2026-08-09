// Row builders for the leaf catalog. Each helper fixes the invariants of one leaf
// shape so a catalog row is a single readable call and the compiler rejects malformed
// rows (e.g. a safety-critical leaf with range bounds — B14 — simply cannot be
// expressed). NO builder takes a value: the catalog defines identity only (§2.3).

import type {
  CheckLeaf, FlagLeaf, NonSafetyLeaf, RangeBounds, SafetyCriticalLeaf, SignBounds,
} from '../leaf';
import type { NumericUnit } from '../units';

export interface RowMeta {
  readonly name: string;
  readonly plain: string;
  readonly def: string;
  readonly pub: string;
  readonly batch: string;
  readonly estimate?: true; // citationKind 'owner-estimate' (§2.5 audit outcome, B16)
}

const base = (id: string, m: RowMeta) => ({
  id,
  name: m.name,
  plainName: m.plain,
  definition: m.def,
  meaningVersion: 1,
  pubPointer: m.pub,
  citationKind: m.estimate ? ('owner-estimate' as const) : ('pub-cited' as const),
  batch: m.batch,
});

/** Safety-critical dimension/thickness in feet — sign bounds only (B14). */
export const safetyFt = (id: string, m: RowMeta): SafetyCriticalLeaf => ({
  ...base(id, m),
  unit: 'ft', kind: 'dimension', integer: false, divisor: false,
  roundingDirection: 'exact', maxDecimals: 2,
  safetyCritical: true, bounds: { kind: 'sign', sign: '>0' },
});

const signBounds = (sign: SignBounds['sign']): SignBounds => ({ kind: 'sign', sign });

/** Safety-critical dimensionless factor (protection-touching multipliers) — sign
 *  bounds only, like every safety-critical leaf (B14). */
export const safetyFactor = (id: string, m: RowMeta): SafetyCriticalLeaf => ({
  ...base(id, m),
  unit: 'ratio', kind: 'factor', integer: false, divisor: false,
  roundingDirection: 'exact', maxDecimals: 2,
  safetyCritical: true, bounds: { kind: 'sign', sign: '>0' },
});

export interface NonSafetyOpts {
  readonly unit: NumericUnit;
  readonly kind: NonSafetyLeaf['kind'];
  readonly integer?: boolean;
  readonly divisor?: boolean;
  readonly rounding?: NonSafetyLeaf['roundingDirection'];
  readonly maxDecimals?: number;
  readonly sign?: SignBounds['sign'];
  /** Finite structural bounds require a decision ref (B14); G-9 asserts max/min >= 5. */
  readonly range?: { min: number; max: number; decisionRef: string };
}

export const leaf = (id: string, m: RowMeta, o: NonSafetyOpts): NonSafetyLeaf => ({
  ...base(id, m),
  unit: o.unit, kind: o.kind,
  integer: o.integer ?? false,
  divisor: o.divisor ?? false,
  roundingDirection: o.rounding ?? 'exact',
  maxDecimals: o.maxDecimals ?? (o.integer ? 0 : 2),
  safetyCritical: false,
  bounds: o.range
    ? ({ kind: 'range', min: o.range.min, max: o.range.max, decisionRef: o.range.decisionRef } satisfies RangeBounds)
    : signBounds(o.sign ?? '>0'),
});

/** Dimensionless 0..1 share/factor. */
export const share = (id: string, m: RowMeta): NonSafetyLeaf =>
  leaf(id, m, { unit: 'ratio', kind: 'factor', sign: '0..1', maxDecimals: 3 });

/** Doctrinal boolean. */
export const flag = (id: string, m: RowMeta, safetyCritical = false): FlagLeaf => ({
  ...base(id, m), unit: 'flag', kind: 'flag', safetyCritical,
});

/** Owner-authored recruit check phrase, with schema'd value coherence (B35). */
export const check = (
  id: string, m: RowMeta,
  coherence?: { governingDimKey: string; bodyUnitId: string; toleranceFt: number },
  safetyCritical = true,
): CheckLeaf => ({
  ...base(id, m), unit: 'text', kind: 'check', safetyCritical,
  ...(coherence !== undefined ? { coherence } : {}),
});

/** Owner-authored body-unit phrase leaf (the numeric approxFt is a separate leaf). */
export const bodyPhrase = (id: string, m: RowMeta): CheckLeaf => ({
  ...base(id, m), unit: 'text', kind: 'body_unit', safetyCritical: false,
});
