// Rounding discipline (§9). ceilInt for discrete counts (sandbags, pickets, stringers),
// round1 for labor (1 dp). All guard non-finite inputs to 0 so a bad intermediate can
// never propagate NaN/Infinity into geometry or the BOM (§2.6). Display rounding lives
// only in units.ts formatters — never here, never before math.

const EPS = 1e-9;

export function ceilInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // Subtract a tiny epsilon so floating-point drift on an exact integer (e.g. 2.0000000001)
  // rounds to 2, not 3, while a genuine 2.4 still ceils to 3.
  return Math.max(0, Math.ceil(n - EPS));
}

export function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// Coerce any value to a finite number (fallback 0 by default) — a last-line guard used at
// render boundaries and anywhere a doctrine value could be absent.
export function finite(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}
