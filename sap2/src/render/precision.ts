// Display precision (blueprint §4.1: display precision lives in render, not schema).
// THE one sanctioned unsafeValue import site outside tests (G-9 lint allowlist):
// a Q becomes human-readable text here and nowhere else.

import { isFilled, unsafeValue, type Q } from '../engine/trace';
import type { NumericUnit } from '../schema/units';

const UNIT_TEXT: Record<NumericUnit, string> = {
  ft: 'ft', ft2: 'sq ft', ft3: 'cu ft', ea: '', man_hours: 'man-hours',
  machine_hours: 'machine-hours', hours: 'hr', ratio: '',
  ft3_per_man_hour: 'cu ft per man-hour', ft3_per_machine_hour: 'cu ft per machine-hour',
  lb: 'lb',
};

const DISPLAY_DECIMALS: Partial<Record<NumericUnit, number>> = {
  ft: 2, ft2: 0, ft3: 0, ea: 0, man_hours: 1, machine_hours: 1, hours: 1, ratio: 2,
};

export interface DisplayValue {
  readonly kind: 'value';
  readonly text: string; // e.g. "4.00 ft"
}
export interface DisplayToken {
  readonly kind: 'token';
  readonly text: string; // e.g. "⟨how deep you dig⟩" — zero digits by construction
}
export type Displayed = DisplayValue | DisplayToken;

/** Render a quantity for humans: a formatted value, or the ⟨token⟩ when unfilled.
 *  Token text is the recruit-register name supplied by the DimSpec — never a digit. */
export const display = (q: Q<NumericUnit>, tokenLabel: string): Displayed => {
  if (!isFilled(q)) return { kind: 'token', text: `⟨${tokenLabel}⟩` };
  const d = DISPLAY_DECIMALS[q.unit] ?? 2;
  const v = unsafeValue(q).toFixed(d);
  const unit = UNIT_TEXT[q.unit];
  return { kind: 'value', text: unit ? `${v} ${unit}` : v };
};

/** Screen-scale factor for a length Q with a TEMPLATE fallback: filled values scale
 *  truly; unfilled lengths take the fixed canonical proportion for their role so the
 *  topology stays true while every case draws identically (§2.2). */
export const scaleOrCanonical = (q: Q<'ft'>, canonicalFt: number): number =>
  isFilled(q) ? unsafeValue(q) : canonicalFt;
