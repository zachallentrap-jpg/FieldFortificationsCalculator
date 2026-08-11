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
// The same fail-safe covers the DATA axis: a threat whose cover material has no shielding row
// in the loaded doctrine has no thickness to build from, so it resolves to
// 'engineered_required' too. Every unknown in this module — threat, span, or missing data —
// leaves by the same door.

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

// Is the loaded doctrine missing the shielding thickness this threat's cover would be sized
// from? Exported because validation must say WHY the roof came back engineered, and asking the
// same question through the same helper is the only way the two can never disagree.
export function coverDataMissing(threat: string): boolean {
  return coverLeafFor(threat) === undefined;
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

  // Data fail-safe: no shielding row for this threat's cover material means there is no
  // thickness to size the roof from. Treating the gap as zero built a roof, billed the
  // stringers and delivered nothing — the one unknown in this module that failed OPEN. It
  // resolves like every other unknown here: engineered, zero thickness. No `engineeredReason`
  // is recorded — 'threat' and 'span' each name a doctrine rule that fired, and this is the
  // absence of doctrine rather than a rule; validation asks coverDataMissing() directly.
  const leaf = coverLeafFor(threat);
  if (!leaf) return { roofPath: 'engineered_required', thickness: 0, material: '' };

  const material = coverMaterialDefault[threat] ?? 'soil';
  return { roofPath, thickness: leaf.value * coverMul, material, thicknessLeaf: leaf };
}
