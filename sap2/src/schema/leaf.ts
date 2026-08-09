// The schema leaf (blueprint §2.3): identity, meaning, bounds, consumers — and NO
// value field. There is no `value` in this type at all; that absence is the ship-empty
// architecture (N2). Values exist only inside a Fill (schema/fill.ts), which is a
// separate runtime argument to compute().

import type { CanonicalUnit, NumericUnit } from './units';

export type LeafKind =
  | 'dimension'   // lengths/depths/thicknesses (ft)
  | 'area' | 'volume'
  | 'count'       // integer quantities
  | 'rate'        // divisors (ft3_per_man_hour)
  | 'factor'      // dimensionless ratios/shares
  | 'labor'       // man-hour contents/adders
  | 'duration'    // elapsed hours
  | 'weight'
  | 'flag'        // doctrinal boolean (e.g. soil forces revetment)
  | 'check'       // owner-authored recruit check phrase (B35)
  | 'body_unit';  // owner-authored body-referenced measure phrase (B35)

// Bounds policy (B14):
// - safety-critical leaves: sign/type constraints ONLY. A finite magnitude bound on a
//   safety-critical leaf is a value-shaped hint and a reseeding vector — the type below
//   makes it unrepresentable.
// - non-safety leaves: finite structural bounds allowed only with a DECISIONS entry;
//   G-9 asserts max/min >= 5 (or a reviewed exemption).
export type SignBounds = { readonly kind: 'sign'; readonly sign: '>0' | '>=0' | '0..1' };
export type RangeBounds = {
  readonly kind: 'range';
  readonly min: number;
  readonly max: number;
  readonly decisionRef: string; // e.g. 'B14/D-xx' — G-9 fails a range without one
};
export type StructuralBounds = SignBounds | RangeBounds;

export type CitationKind = 'pub-cited' | 'owner-estimate';

// Consumers are STATIC data (§4.2): declared once in schema/consumers.ts, and
// doctrineReader(consumerId) is constructed from that declaration, so an undeclared
// reader cannot exist and the orphan test is pure data set-equality.
export interface LeafBase<Id extends string = string> {
  readonly id: Id;               // stable slug, append-only forever
  readonly name: string;         // technical label
  readonly plainName: string;    // recruit-register label (D23 carried)
  readonly definition: string;   // 2–3 sentences incl. measurement convention
  readonly meaningVersion: number; // bumped on ANY semantic edit — enters schemaHash (B8)
  readonly pubPointer: string;   // value-free where-to-look (publication + table/para name)
  readonly citationKind: CitationKind; // audited at schema freeze (§2.5, B16)
  readonly batch: string;        // pub-table batch id — fill pacing + queue order (§2.5)
}

export interface NumericLeafCommon<Id extends string = string> extends LeafBase<Id> {
  readonly unit: NumericUnit;
  readonly kind: Exclude<LeafKind, 'check' | 'body_unit' | 'flag'>;
  readonly integer: boolean;
  readonly divisor: boolean;     // participates as a divisor somewhere → 0 must refuse
  readonly roundingDirection: 'up' | 'down' | 'nearest' | 'exact';
  readonly maxDecimals: number;  // entry precision; also the conversion rounding target (B19)
}

// The discriminated pair enforces the bounds policy at the type level.
export interface SafetyCriticalLeaf<Id extends string = string> extends NumericLeafCommon<Id> {
  readonly safetyCritical: true;
  readonly bounds: SignBounds;   // range bounds unrepresentable here (B14)
}
export interface NonSafetyLeaf<Id extends string = string> extends NumericLeafCommon<Id> {
  readonly safetyCritical: false;
  readonly bounds: StructuralBounds;
}
export type NumericLeaf<Id extends string = string> = SafetyCriticalLeaf<Id> | NonSafetyLeaf<Id>;

// Owner-authored check / body-unit string leaves (B35): the phrase is data under the
// same fill regime as numbers. Coherence with the governing dimension is schema'd so
// a card can never carry two truths (§3.2 zone E).
export interface CheckLeaf<Id extends string = string, Dim extends string = string>
  extends LeafBase<Id> {
  readonly unit: 'text';
  readonly kind: 'check' | 'body_unit';
  readonly safetyCritical: boolean;
  readonly coherence?: {
    readonly governingDimKey: Dim;     // the numeric leaf this phrase must agree with
    readonly bodyUnitId: string;       // which body-unit table row backs the phrase
    readonly toleranceFt: number;      // |bodyUnit.approxFt − governingDim| gate bound
  };
}

// Doctrinal booleans (v1's soils.revetForced class). True/false in the fill, cited and
// verified like any other leaf; never defaulted — an unfilled flag is Unfilled.
export interface FlagLeaf<Id extends string = string> extends LeafBase<Id> {
  readonly unit: 'flag';
  readonly kind: 'flag';
  readonly safetyCritical: boolean;
}

export type SchemaLeaf<Id extends string = string> = NumericLeaf<Id> | CheckLeaf<Id> | FlagLeaf<Id>;

export const isNumericLeaf = <Id extends string>(l: SchemaLeaf<Id>): l is NumericLeaf<Id> =>
  l.unit !== 'text' && l.unit !== 'flag';

export type { CanonicalUnit };
