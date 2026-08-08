// TIMBER-2 — the doors and windows a hut variant ships with.
//
// This lived inside `families/hut.ts` and was reached through `spec.openings ?? defaults`, which
// is a correct-looking line that never once fired: `normalizeSpec` runs first and turns an
// absent `openings` into `{}`, and `{}` is not nullish. So EVERY hut in the toolkit — squad hut,
// SWA hut, B-hut, guard shack, latrine — generated with no door and no window at all, while its
// own card promised "windows down both sides" and "a post you can see out of on three sides".
// The owner found it on the squad hut.
//
// It is a module of its own now because the fix is to resolve the defaults during NORMALIZE, so
// the spec is explicit from the first moment: the openings editor can then show them, the
// operator can move or delete them, and deleting them all means none — which is a thing somebody
// might genuinely want and which `??` could never express, since it cannot tell "not stated yet"
// from "stated as empty". Nothing here touches the DOM or any generator, so both sides can
// import it without a cycle.

import type { HutSpec, OpeningSpec, WallOpenings } from './spec';
import { OPENING } from './doctrine';
import { maxOpeningTopFt } from './normalize';

/**
 * Doors and windows a variant ships with, when the operator has not named their own.
 *
 * Sizes are doctrine, not taste — a rough opening is a rough opening. What varies by variant is
 * WHERE the holes go, and that follows from what the building is for: something you watch out
 * of is glazed on the sides you watch, something you sleep in is lit down its length, and
 * anything split into rooms needs a way into each half.
 */
export function defaultOpenings(
  variant: HutSpec['variant'],
  lengthFt: number,
  widthFt: number,
  wallHeightFt = 8,
): WallOpenings {
  const dw = OPENING.doorWidthFt.value as number;
  const ww = OPENING.windowWidthFt.value as number;
  const setback = OPENING.cornerSetbackFt.value as number;
  const pitch = OPENING.windowPitchFt.value as number;
  // A DEFAULT HAS TO FIT THE WALL IT IS PUT IN. The window's SIZE is doctrine and does not
  // move; where its sill sits is this function's choice, and on a short wall the standard
  // 3½-ft sill puts the head above what a 2x6 header can clear — the guard shack's 7.5-ft
  // walls carried three windows whose headers ran through the top plate. Dropping the sill is
  // a default choosing a buildable position, not an override of anything the operator asked
  // for; a sill THEY type that does not fit is clamped by `normalizeSpec`, loudly.
  const winTop = maxOpeningTopFt(wallHeightFt, ww);
  const winSill = Math.max(0, Math.min(OPENING.windowSillFt.value as number, winTop - (OPENING.windowHeightFt.value as number)));
  const door = (offsetFt: number): OpeningSpec => ({
    kind: 'door', offsetFt, widthFt: dw,
    heightFt: Math.min(OPENING.doorHeightFt.value as number, maxOpeningTopFt(wallHeightFt, dw)),
    sillHeightFt: 0, fill: 'door-ledged',
  });
  const win = (offsetFt: number): OpeningSpec => ({
    kind: 'window', offsetFt, widthFt: ww,
    heightFt: OPENING.windowHeightFt.value as number,
    sillHeightFt: winSill, fill: 'window-shutter',
  });
  /** A door centred on a wall of this run. */
  const centred = (runFt: number): OpeningSpec => door(runFt / 2 - dw / 2);
  /** Windows evenly down a long wall, and never so close to a corner that the post is lost. */
  const alongLength = (): OpeningSpec[] => {
    const out: OpeningSpec[] = [];
    for (let x = pitch / 2; x <= lengthFt - pitch / 2 - ww; x += pitch) {
      if (x >= setback && x + ww <= lengthFt - setback) out.push(win(x));
    }
    return out;
  };

  switch (variant) {
    case 'guardShack':
      // One door, and something to see through on the three sides you have to watch.
      return { S: [centred(lengthFt)], E: [win(setback)], W: [win(setback)], N: [win(setback)] };
    case 'latrine':
      // "Door on the long side" — the screened band above does the rest of the work.
      return { S: [centred(lengthFt)] };
    case 'bHut':
      // A door at each end, so neither half of the hut is a dead end.
      return {
        E: [centred(widthFt)], W: [centred(widthFt)],
        S: [win(setback * 2), win(lengthFt - setback * 2 - ww)],
        N: [win(setback * 2), win(lengthFt - setback * 2 - ww)],
      };
    default: {
      // SEA hut, SWA hut, squad hut: a door at each gable end, windows down both long walls.
      const wins = alongLength();
      return { E: [centred(widthFt)], W: [centred(widthFt)], S: wins, N: wins };
    }
  }
}
