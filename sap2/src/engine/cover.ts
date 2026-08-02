// resolveCover — the single protection authority (v1's best liability feature,
// structural in v2: blueprint §6.1). INV-1: a threat whose roof path is
// engineered_required NEVER yields a roof thickness, at any fill state, no matter
// what the fill contains — the refusal is typed, not a validation afterthought.
// Unknown/unfilled resolves Unfilled (fail-safe), never a default.

import { SHIELD_MATERIAL_IDS, type ShieldMaterial, type StandardId, type ThreatId } from '../schema/ids';
import { THREAT_STRUCTURE, shieldLeafId } from '../schema/leaves/protection';
import { standardMulId } from '../schema/leaves/standards';
import { leafById } from '../schema/leaves/index';
import type { NumericLeaf } from '../schema/leaf';
import type { FillView } from './read';
import { resolve } from './read';
import { mul, type Q } from './trace';

export interface EngineeredRoof {
  readonly kind: 'engineeredRoof';
  readonly threat: ThreatId;
  /** Recruit-register consequence: the STOP card renders from this, with the threat's
   *  plain label filled by the engine slot (§3.1). */
  readonly reason: 'roof-requires-engineer-design';
}

export type CoverResolution =
  | { readonly kind: 'earthCover'; readonly thickness: Q<'ft'>; readonly material: ShieldMaterial }
  | EngineeredRoof
  | { readonly kind: 'noRoof' };

const numericLeaf = (id: string): NumericLeaf => {
  const l = leafById(id);
  if (l.unit === 'text' || l.unit === 'flag') throw new Error(`${id} is not numeric`);
  return l;
};

export const threatStructure = (t: ThreatId) => {
  const row = THREAT_STRUCTURE.find((r) => r.id === t);
  if (!row) throw new Error(`unknown threat ${t}`);
  return row;
};

/** Required protective thickness of `material` against `threat` for the WALL/mass
 *  facing the threat (independent of roof path). Unfilled-safe. */
export const shieldingThickness = (
  fill: FillView, threat: ThreatId, material: ShieldMaterial,
): Q<'ft'> => resolve(fill, numericLeaf(shieldLeafId(threat, material)) as NumericLeaf & { unit: 'ft' });

/** Overhead cover resolution for a position build standard. */
export const resolveCover = (
  fill: FillView, threat: ThreatId, material: ShieldMaterial, standard: StandardId,
): CoverResolution => {
  const t = threatStructure(threat);
  if (t.roof === 'engineered_required') {
    return { kind: 'engineeredRoof', threat, reason: 'roof-requires-engineer-design' };
  }
  if (t.roof === 'none') return { kind: 'noRoof' };
  const base = shieldingThickness(fill, threat, material);
  const covMul = resolve(fill, numericLeaf(standardMulId(standard, 'cover')) as NumericLeaf & { unit: 'ratio' });
  return { kind: 'earthCover', thickness: mul('cover.thickness', covMul, base, 'ft'), material };
};

export const isShieldMaterial = (s: string): s is ShieldMaterial =>
  (SHIELD_MATERIAL_IDS as readonly string[]).includes(s);
