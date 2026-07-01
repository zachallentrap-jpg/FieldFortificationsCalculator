// Soils (§8). ILLUSTRATIVE PLACEHOLDER values — every quantitative field is P()-wrapped
// and defaults to PLACEHOLDER. digFactor scales dig labor; wallSlopeRatio is the required
// cut-wall slope (H per 1 V) for stability; revetForced flags soils that doctrinally
// require revetment regardless of the operator's toggle. None of these are authoritative.

import { P } from './types';
import type { Provenance } from './types';

export interface SoilRow {
  label: string;
  digFactor: Provenance<number>; // ×labor multiplier for excavation difficulty
  wallSlopeRatio: Provenance<number>; // horizontal run per 1 vertical (0 = vertical wall)
  revetForced: Provenance<boolean>; // soil doctrinally demands revetment
  note: string;
}

const soil = (
  label: string,
  digFactor: number,
  wallSlopeRatio: number,
  revetForced: boolean,
  note: string,
): SoilRow => ({
  label,
  digFactor: P(digFactor, { note: 'dig-labor multiplier (illustrative)' }),
  wallSlopeRatio: P(wallSlopeRatio, { unit: 'ratio', note: 'H:V wall slope (illustrative)' }),
  revetForced: P(revetForced, { note: 'revetment forced by soil (illustrative)' }),
  note,
});

export const soils: Record<string, SoilRow> = {
  sand: soil('Sand', 1.3, 1.0, true, 'Cohesionless; walls slough — revetment forced.'),
  sandy_loam: soil('Sandy loam', 1.15, 0.75, false, 'Moderate cohesion.'),
  loam: soil('Loam', 1.0, 0.5, false, 'Baseline workable soil.'),
  silt: soil('Silt', 1.1, 0.75, false, 'Holds moisture; can flow when wet.'),
  clay: soil('Clay', 1.5, 0.25, false, 'Hard dig; stable walls when dry.'),
  gravel: soil('Gravel', 1.4, 1.0, true, 'Ravels easily — revetment forced.'),
  rock: soil('Rock', 3.0, 0.1, false, 'Requires mechanical/explosive effort.'),
  frozen: soil('Frozen ground', 3.5, 0.1, false, 'Extreme effort until thawed.'),
};
