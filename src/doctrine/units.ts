// Units (§8). Internal unit is FEET everywhere; math is done in feet as floats and only
// display is converted. One toggle (Inputs.unit) governs display. The conversion factors
// below are EXACT physical constants — not doctrinal placeholders — so they are plain
// consts and are neither wrapped in P() nor registered (they never need "confirming
// against a pub"). See DECISIONS.md D6.

export type UnitSystem = 'imperial' | 'metric';

export const M_PER_FT = 0.3048; // exact
export const M2_PER_FT2 = 0.09290304; // exact (0.3048^2)
export const M3_PER_FT3 = 0.028316846592; // exact (0.3048^3)
export const IN_PER_FT = 12;

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// Feet → feet-and-inches, e.g. 4.5 → 4'-6". Inches rounded to nearest whole inch,
// with 12" rollover handled so we never emit 4'-12".
function feetInches(ft: number): string {
  const sign = ft < 0 ? '-' : '';
  const abs = Math.abs(ft);
  let whole = Math.floor(abs);
  let inches = Math.round((abs - whole) * IN_PER_FT);
  if (inches === IN_PER_FT) {
    whole += 1;
    inches = 0;
  }
  return sign + whole + "'-" + inches + '"';
}

export function fmtLength(ft: number, unit: UnitSystem): string {
  if (!Number.isFinite(ft)) return '—';
  if (unit === 'metric') {
    const m = ft * M_PER_FT;
    return Math.abs(m) < 1 ? round(m * 100, 0) + ' cm' : round(m, 2) + ' m';
  }
  return feetInches(ft);
}

export function fmtArea(ft2: number, unit: UnitSystem): string {
  if (!Number.isFinite(ft2)) return '—';
  if (unit === 'metric') return round(ft2 * M2_PER_FT2, 2) + ' m²';
  return round(ft2, 1) + ' ft²';
}

export function fmtVolume(ft3: number, unit: UnitSystem): string {
  if (!Number.isFinite(ft3)) return '—';
  if (unit === 'metric') return round(ft3 * M3_PER_FT3, 2) + ' m³';
  return round(ft3, 1) + ' ft³';
}

// Plain number in the active unit (no unit suffix) — used where the caller adds context.
export function toDisplayLength(ft: number, unit: UnitSystem): number {
  return unit === 'metric' ? round(ft * M_PER_FT, 3) : round(ft, 2);
}

// BOM quantities carry their own raw unit string ('ft³', 'ft', or 'ea' — engine/materials.ts).
// Converts the volume/length ones for metric display; 'ea' counts are unit-system-independent.
// Returns the unrounded converted value — each caller applies its own display precision, same
// as it already does for every other number. Shared by the BOM panel, job sheet, and CSV export
// so all three agree.
export function fmtBomQty(raw: number, rawUnit: string, unit: UnitSystem): { qty: number; unit: string } {
  if (unit === 'metric' && rawUnit === 'ft³') return { qty: raw * M3_PER_FT3, unit: 'm³' };
  if (unit === 'metric' && rawUnit === 'ft') return { qty: raw * M_PER_FT, unit: 'm' };
  return { qty: raw, unit: rawUnit };
}
