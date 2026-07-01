// Cover resolution (§9, §2.7). THE single place that decides roof path + cover thickness.
// Safety invariant, enforced here and re-asserted by engine.protection + fuzz tests:
// when the roof path is not 'earth_on_stringers' (i.e. 'none' or 'engineered_required'),
// thickness is ALWAYS 0 — the engine never fabricates a cover number for contact-burst or
// shaped-charge, ever.

import { roofPathFor, coverMaterialDefault, shielding, shieldMaterials } from '../doctrine/protection';
import type { ShieldMaterial } from '../doctrine/protection';
import type { Provenance } from '../doctrine/types';
import type { RoofPath } from './types';

export interface CoverResolution {
  roofPath: RoofPath;
  thickness: number; // feet; 0 unless roofPath === 'earth_on_stringers'
  material: string; // '' unless an earth roof is actually built
  thicknessLeaf?: Provenance<number>; // the shielding placeholder that produced thickness
}

function isShieldMaterial(m: string): m is ShieldMaterial {
  return (shieldMaterials as readonly string[]).includes(m);
}

export function resolveCover(threat: string, coverOn: boolean, coverMul: number): CoverResolution {
  if (!coverOn) return { roofPath: 'none', thickness: 0, material: '' };

  const roofPath = roofPathFor(threat);
  if (roofPath !== 'earth_on_stringers') {
    // engineered_required — no fabricated thickness (§2.7).
    return { roofPath, thickness: 0, material: '' };
  }

  const material = coverMaterialDefault[threat] ?? 'soil';
  const leaf = isShieldMaterial(material) ? shielding[threat]?.[material] : undefined;
  const base = leaf ? leaf.value : 0;
  const out: CoverResolution = { roofPath, thickness: base * coverMul, material };
  if (leaf) out.thicknessLeaf = leaf;
  return out;
}
