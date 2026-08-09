// How a roofing texture tiles across one piece of roofing.
//
// This is one line of arithmetic and it lives in its own module for one reason: the viewer that
// used it cannot be imported outside a browser build, so for as long as the arithmetic sat inside
// `studio.ts` it could not be checked by anything but the eye — and the eye passed it.
//
// THE TILE IS A REAL DIMENSION. The corrugated texture is drawn 26 in wide because that is a
// sheet's coverage width, and it holds exactly twelve corrugations at the 2 1/6-in pitch the
// doctrine figure names. The roll texture is drawn 36 in square because that is a roll's width.
// So the number of tiles across a piece is the piece's own size divided by that dimension — a
// ratio, not a count, and rounding it to a whole tile is the same as saying the corrugations
// stretch to fit whatever got cut.
//
// They do not. `Math.round(span / tile)` clamped to at least one tile put twelve corrugations
// into every piece narrower than 39 in, so a 3 1/4-in sliver at a hip rendered its ribs at a
// 0.27-in pitch — eight times too fine — and a roof's clipped pieces each came out at their own
// wrong scale. On a gable that is four pieces; on a hip or a pyramid it is nearly half of them,
// which is why those roofs read as a patchwork of mismatched metal. The texture wraps, so a
// fractional repeat is not a compromise: it is a cut sheet, ending mid-rib exactly where the
// snips went through.

import type { Member } from '../../timber/types';

/** The real width one tile of each roofing texture is drawn at, in inches. */
export const ROOFING_TILE_IN = { corrugated: 26, roll: 36 } as const;

export interface RoofingTiling {
  kind: 'corrugated' | 'roll';
  /** Tiles along the piece's length (local X — along the eave for both goods). */
  along: number;
  /** Tiles across the piece's face width (local Y — up the slope). */
  across: number;
}

/**
 * Roll goods vs. corrugated metal are told apart by the nominal the engine already wrote, which
 * is also what carries the sheet size, so nothing here has to guess.
 */
export function roofingTiling(m: Pick<Member, 'nominal' | 'cutLength' | 'actual'>): RoofingTiling {
  const kind = m.nominal.startsWith('corrugated') ? 'corrugated' : 'roll';
  const tile = ROOFING_TILE_IN[kind];
  return {
    kind,
    along: m.cutLength / tile,
    // The corrugated texture is CONSTANT up the slope — the ribs are lines, not a pattern — so
    // one tile covers any run and repeating it would only add seams to sample across. Roll goods
    // are granules in both directions and do have to keep their scale across the course.
    across: kind === 'corrugated' ? 1 : m.actual.d / tile,
  };
}
