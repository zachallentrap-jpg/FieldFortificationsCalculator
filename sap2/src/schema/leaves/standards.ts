// Build-standard multiplier leaves (hasty / deliberate / reinforced). Multipliers are
// modeling constructs (doctrine describes the standards; the scaling numbers are the
// owner's estimating model) — 'owner-estimate' citation kind, disclosed at
// commissioning (B16). Depth and cover multipliers touch protection outcomes →
// safety-critical → sign bounds only (B14); a 0..1-ish "hasty digs less" expectation
// is a relational TIER check at import (monotonicity across standards), never a bound.

import { STANDARD_IDS, type StandardId } from '../ids';
import { leaf, safetyFactor } from './build';
import type { SchemaLeaf } from '../leaf';

export const standardMulId = (s: StandardId, which: 'depth' | 'cover' | 'labor'): string =>
  `standard.${s}.${which}Mul`;

export const STANDARD_LEAVES: readonly SchemaLeaf[] = STANDARD_IDS.flatMap((s) => [
  safetyFactor(standardMulId(s, 'depth'), {
    name: `Depth multiplier — ${s}`, plain: `how much of full depth a ${s} position digs`,
    def: `Multiplier applied to the position's base hole depth for the ${s} standard.`,
    pub: 'No pub prints this cell — owner method note required', batch: 'standards', estimate: true,
  }),
  safetyFactor(standardMulId(s, 'cover'), {
    name: `Cover multiplier — ${s}`, plain: `how much of full overhead cover a ${s} position gets`,
    def: `Multiplier applied to doctrinal overhead-cover thickness for the ${s} standard. The cover resolver still fail-safes engineered threats regardless of this value (INV-1).`,
    pub: 'No pub prints this cell — owner method note required', batch: 'standards', estimate: true,
  }),
  leaf(standardMulId(s, 'labor'), {
    name: `Labor multiplier — ${s}`, plain: `how much of full build effort a ${s} position takes`,
    def: `Multiplier applied to base man-hours for the ${s} standard.`,
    pub: 'No pub prints this cell — owner method note required', batch: 'standards', estimate: true,
  }, { unit: 'ratio', kind: 'factor', sign: '>0', maxDecimals: 2 }),
]);
