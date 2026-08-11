// Cross bridging, and how tall a piece of it is allowed to be.
//
// A row of cross bridging is two boards per bay, each running from the top of one joist to the
// bottom of the next. The pitch is not free: THE BOARD HAS WIDTH. A board of face width `d`
// pitched at `a` stands `d / cos a` taller than the centreline it is drawn on, so a centreline
// pitched across the full joist depth puts the piece's corners outside the joists at both ends.
//
// Both floor generators did exactly that — `const rise = joistD - inset` — and the result was
// 698 pieces on eight of the fourteen shipped cards, every one of them hanging 0.78 in below the
// joist soffit and driving the same distance up through the subfloor above.
//
// Pure geometry, kept in one place because both generators need the same answer and one of them
// is frozen legacy that must not grow a second copy of it.

/**
 * The centreline rise for one cross-bridging board: the clear bay `gap` across, the board's face
 * width `boardW`, and the vertical band `depth` the FINISHED piece has to fit inside — feet.
 *
 * Solves
 *
 *   R + boardW · hypot(gap, R) / gap = depth
 *
 * — the centreline rise plus the two half-widths the board's corners add above and below it,
 * `boardW / 2 / cos a` each way. Squaring gives a quadratic in R; the root inside the band is the
 * pitch that lands those corners exactly on it. (The other root is the artefact of squaring: it
 * puts `depth - R` negative.)
 *
 * Returns 0 when no diagonal fits — a band no deeper than the board is wide has no answer — and
 * the caller emits nothing rather than a piece that cannot be cut.
 */
export function crossBridgingRise(gap: number, boardW: number, depth: number): number {
  if (!(gap > 0) || !(boardW > 0) || !(depth > boardW)) return 0;
  const g2 = gap * gap;
  const w2 = boardW * boardW;
  const a = w2 - g2;
  const b = 2 * g2 * depth;
  const c = g2 * (w2 - depth * depth);
  // A bay exactly as wide as the board is the linear case — no quadratic term to divide by.
  if (a === 0) return b === 0 ? 0 : Math.max(0, -c / b);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  return Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
}
