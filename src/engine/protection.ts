// Cover resolution (§9, §2.7). THE single place that decides roof path + cover thickness.
// Safety invariant, enforced here and re-asserted by engine.protection + fuzz tests:
// when the roof path is not 'earth_on_stringers' (i.e. 'none' or 'engineered_required'),
// thickness is ALWAYS 0 — the engine never fabricates a cover number for contact-burst or
// shaped-charge, ever.
//
// Phase 1 (EXECUTION_PLAN) extends the same fail-safe to SPAN: an earth-on-stringers roof
// whose clear span exceeds the doctrine stringer table resolves to 'engineered_required'
// through this same single authority — never a fabricated stringer size, never a warning
// bolted on around a still-fabricated thickness. `engineeredReason` tells validation which
// message to show; it never weakens the thickness-zero rule.
//
// The same fail-safe covers the DATA axis: a threat whose cover material has no USABLE
// shielding thickness in the loaded doctrine has nothing to build a roof from, so it resolves
// to 'engineered_required' too. "Usable" means a positive, finite depth of feet, on the
// resolved thickness the roof would actually be built to: a required thickness of zero or less
// for a real munition is not "no cover needed" — nothing stops a round — so it means the value
// is absent, and a multiplier that scales a real requirement away to nothing means the same.
// Every unknown in this module — threat, span, or unusable data — leaves by the same door.

import { roofPathFor, coverMaterialDefault, shielding, shieldMaterials, stringerSizeForSpan } from '../doctrine/protection';
import type { ShieldMaterial } from '../doctrine/protection';
import type { Provenance } from '../doctrine/types';
import type { RoofPath } from './types';

export interface CoverResolution {
  roofPath: RoofPath;
  thickness: number; // feet; 0 unless roofPath === 'earth_on_stringers'
  material: string; // '' unless an earth roof is actually built
  thicknessLeaf?: Provenance<number>; // the shielding placeholder that produced thickness
  engineeredReason?: 'threat' | 'span'; // why engineered_required, when it is
}

function isShieldMaterial(m: string): m is ShieldMaterial {
  return (shieldMaterials as readonly string[]).includes(m);
}

function coverLeafFor(threat: string): Provenance<number> | undefined {
  const material = coverMaterialDefault[threat] ?? 'soil';
  return isShieldMaterial(material) ? shielding[threat]?.[material] : undefined;
}

// Which unknown, if any, leaves this threat's earth roof with no thickness to build to.
export type CoverGap =
  | 'shielding_data' // no shielding row, or one that resolves to no buildable depth of feet
  | 'cover_multiplier'; // a real requirement scaled away to nothing by the standard

// The single answer to "can a thickness be built here, and if not, which value is the reason".
// resolveCover and validation both ask THROUGH this helper — asking the same question the same
// way is the only way the roof the engine builds and the reason the operator reads can never
// disagree.
//
// A thickness must be a positive REAL number of feet. Infinity ft of soil is no more diggable
// than zero, and NaN would flow silently into the volume and the BOM; both are unknowns and
// leave by the fail-safe door like every other unknown here. resolveCover is exported, so its
// guarantee has to hold for any caller — not only for the one that reads from doctrine leaves
// the importer has already bounded.
function usableCover(threat: string, coverMul: number): { leaf: Provenance<number> } | { gap: CoverGap } {
  const leaf = coverLeafFor(threat);
  if (!leaf || !(leaf.value > 0) || !Number.isFinite(leaf.value)) return { gap: 'shielding_data' };
  const thickness = leaf.value * coverMul;
  if (!(thickness > 0) || !Number.isFinite(thickness)) return { gap: 'cover_multiplier' };
  return { leaf };
}

// Exported so validation can say WHY the roof came back engineered.
export function coverThicknessGap(threat: string, coverMul: number): CoverGap | undefined {
  const r = usableCover(threat, coverMul);
  return 'gap' in r ? r.gap : undefined;
}

export function resolveCover(threat: string, coverOn: boolean, coverMul: number, clearSpanFt: number): CoverResolution {
  if (!coverOn) return { roofPath: 'none', thickness: 0, material: '' };

  const roofPath = roofPathFor(threat);
  if (roofPath !== 'earth_on_stringers') {
    // engineered_required — no fabricated thickness (§2.7).
    return { roofPath, thickness: 0, material: '', engineeredReason: 'threat' };
  }

  // Span fail-safe: beyond the tabulated stringer spans, the designer decides — same path,
  // same zero thickness as the threat-driven engineered case. The span is a REQUIRED argument:
  // a fail-safe a caller can skip by leaving an argument off is not a fail-safe.
  if (stringerSizeForSpan(clearSpanFt) === 'engineered') {
    return { roofPath: 'engineered_required', thickness: 0, material: '', engineeredReason: 'span' };
  }

  // Data fail-safe: with no usable thickness there is nothing to size the roof from. Building
  // it anyway draws a roof, bills the stringers and delivers zero protection — an earth roof
  // of zero feet is not a roof. It resolves like every other unknown here: engineered, zero
  // thickness. No `engineeredReason` is recorded — 'threat' and 'span' each name a doctrine
  // rule that fired, and this is the absence of usable doctrine rather than a rule; validation
  // asks coverThicknessGap() directly for which value is missing.
  const cover = usableCover(threat, coverMul);
  if ('gap' in cover) return { roofPath: 'engineered_required', thickness: 0, material: '' };

  const material = coverMaterialDefault[threat] ?? 'soil';
  return { roofPath, thickness: cover.leaf.value * coverMul, material, thicknessLeaf: cover.leaf };
}
