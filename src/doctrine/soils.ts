// Soils (§8). ILLUSTRATIVE PLACEHOLDER values — every quantitative field is P()-wrapped
// and defaults to PLACEHOLDER. digFactor scales dig labor; wallSlopeRatio is the required
// cut-wall slope (H per 1 V) for stability; revetForced flags soils that doctrinally
// require revetment regardless of the operator's toggle. None of these are authoritative.
//
// wallSlopeRatio magnitudes were corrected against researched angle-of-repose / OSHA max-cut
// data (FM 5-103 Survivability; OSHA 1926 Subpart P; standard geotech repose tables — all
// primary-source verified). The ratio is 1/tan(stable face angle from horizontal): a
// cohesionless soil (sand ~34°) flares WIDE (1.48), a cohesive one (clay ~53°) stands steep
// (0.75), and intact rock / frozen ground are vertical (0.0). This is what makes the 3D
// excavation SHAPE differ by soil instead of only its color — sand funnels, rock is a shaft.

import { P } from './types';
import type { Provenance } from './types';

// Face character for the 3D excavation surface — an art-direction tag, not a doctrine number,
// so it isn't Provenance-wrapped. Only five looks are visually distinct (research §1): sand and
// gravel slump into loose cones (smooth vs stony), clay cuts blocky, rock reads stratified/
// faceted, frozen is blocky with ice veins. loam/sandy_loam/silt share one 'planar' brown cut
// that differs only by wallSlopeRatio — no separate art earns its keep for those three.
export type FaceLook = 'cone' | 'stony' | 'blocky' | 'stratified' | 'iceblocky' | 'planar';

export interface SoilRow {
  label: string;
  digFactor: Provenance<number>; // ×labor multiplier for excavation difficulty
  wallSlopeRatio: Provenance<number>; // horizontal run per 1 vertical (0 = vertical wall)
  revetForced: Provenance<boolean>; // soil doctrinally demands revetment
  faceLook: FaceLook;
  note: string;
}

const soil = (
  label: string,
  digFactor: number,
  wallSlopeRatio: number,
  revetForced: boolean,
  faceLook: FaceLook,
  note: string,
): SoilRow => ({
  label,
  digFactor: P(digFactor, { note: 'dig-labor multiplier (illustrative)' }),
  wallSlopeRatio: P(wallSlopeRatio, { unit: 'ratio', note: 'H:V wall slope (illustrative)' }),
  revetForced: P(revetForced, { note: 'revetment forced by soil (illustrative)' }),
  faceLook,
  note,
});

export const soils: Record<string, SoilRow> = {
  // ratio, revetForced, faceLook — face angles from OSHA/repose research (see header)
  sand: soil('Sand', 1.3, 1.48, true, 'cone', 'Cohesionless (~34°); walls slough — revetment forced.'),
  sandy_loam: soil('Sandy loam', 1.15, 1.0, false, 'planar', 'Moderate cohesion (~45°); sloughs as it dries.'),
  loam: soil('Loam', 1.0, 0.65, false, 'planar', 'Baseline workable soil (~57°); holds tool marks.'),
  silt: soil('Silt', 1.1, 1.0, false, 'planar', 'Holds a face when damp (~45°) then fails suddenly when wet.'),
  clay: soil('Clay', 1.5, 0.75, false, 'blocky', 'Hard dig; near-vertical stable walls (~53°) when dry.'),
  gravel: soil('Gravel', 1.4, 1.48, true, 'stony', 'Ravels as stones roll free (~34°) — revetment forced.'),
  rock: soil('Rock', 3.0, 0.0, false, 'stratified', 'Vertical faces; requires mechanical/explosive effort.'),
  frozen: soil('Frozen ground', 3.5, 0.0, false, 'iceblocky', 'Vertical while frozen; extreme effort until thawed.'),
};
