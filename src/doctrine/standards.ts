// Standards (§8). ILLUSTRATIVE PLACEHOLDER multipliers describing how much a hasty,
// deliberate, or reinforced build scales depth of cut, overhead cover thickness, and
// labor relative to the position's base geometry. Not authoritative.

import { P } from './types';
import type { Provenance } from './types';

export interface StandardRow {
  label: string;
  depthMul: Provenance<number>; // × base hole depth
  coverMul: Provenance<number>; // × doctrinal cover thickness
  laborMul: Provenance<number>; // × base man-hours
  note: string;
}

const std = (
  label: string,
  depthMul: number,
  coverMul: number,
  laborMul: number,
  note: string,
): StandardRow => ({
  label,
  depthMul: P(depthMul, { note: 'depth multiplier (illustrative)' }),
  coverMul: P(coverMul, { note: 'cover multiplier (illustrative)' }),
  laborMul: P(laborMul, { note: 'labor multiplier (illustrative)' }),
  note,
});

export const standards: Record<string, StandardRow> = {
  hasty: std('Hasty', 0.6, 0.75, 0.6, 'Immediate protection; minimum dig.'),
  deliberate: std('Deliberate', 1.0, 1.0, 1.0, 'Full doctrinal position.'),
  reinforced: std('Reinforced', 1.25, 1.4, 1.6, 'Hardened; added depth and cover.'),
};
