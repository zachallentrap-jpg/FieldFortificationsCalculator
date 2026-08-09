// TIMBER-2 — the seat openings in a latrine's riser box.
//
// THE GENERATOR PROMISED THEM AND CUT NONE. `generateRiserBox` opens with "a boxed bench down one
// side over the pit, WITH A SEAT OPENING PER SEAT", and `seats` sized the divider count and
// nothing else. A four-seat latrine came out of the model as a solid ten-foot bench — the one
// feature that makes the building a latrine, missing, in the one family that has it.
//
// Same shape as `birdsMouth`: this module is PURE and adds nothing to the model. The openings are
// DERIVED from members the engine already emitted — the lid, and the dividers under it — so no
// generator changes, no golden moves, and the cut list is untouched. What comes out is a set of
// holes the viewer punches through the lid it extrudes.
//
// ── The lid's frame, because this is where the axes live ─────────────────────
//
// The lid is emitted flat: rotation [−π/2, 0, 0]. Rotating −90° about X sends local +Y to world
// −Z and local +Z to world +Y, so on the lid:
//
//     local X   runs the length of the bench   (world X)
//     local Y   runs its DEPTH, front to back  (world −Z)
//     local Z   is its thickness, standing up  (world +Y)
//
// which means a seat opening is a rectangle in local (x, y) and the holes extrude straight
// through — the same profile-plus-thickness the notch uses.

import type { Member } from './types';
import { LATRINE } from './doctrine';

const IN_PER_FT = 12;

/** One seat opening, as a rectangle in the lid's own local (x, y), in feet. */
export interface SeatOpening {
  /** Local x of the opening's centre — the middle of its bay, between two dividers. */
  xFt: number;
  /** Local y of the opening's centre. */
  yFt: number;
  widthFt: number;
  lengthFt: number;
}

/** The lid of a riser box: the one flat member in the group, laid on top of the rest. */
export function riserLidOf(members: readonly Member[]): Member | null {
  const box = members.filter((m) => m.role === 'riserBox');
  if (box.length < 2) return null;
  // Flat means rx = −90°: the only piece of the box lying down rather than standing on edge.
  const flat = box.filter((m) => Math.abs(m.rotation[0] + Math.PI / 2) < 1e-6);
  if (flat.length !== 1) return null;
  return flat[0]!;
}

/**
 * The seat openings in a riser box's lid, in the lid's local frame.
 *
 * The bays come from the DIVIDERS rather than from the seat count, so the openings land between
 * the boards that are actually there. A divider crosses the box front to back — its length runs
 * along the lid's depth — so its position along the bench is its world x, and the gaps between
 * consecutive dividers are the bays. Returns [] when there is nothing to cut: no box, no
 * dividers, or a bay too narrow to take an opening with board left around it.
 */
export function seatOpeningsFor(members: readonly Member[]): SeatOpening[] {
  const lid = riserLidOf(members);
  if (!lid) return [];
  const dividers = members
    .filter((m) => m.role === 'riserBox' && m.id !== lid.id && Math.abs(Math.abs(m.rotation[1]) - Math.PI / 2) < 1e-6)
    .map((m) => m.position[0]!)
    .sort((a, b) => a - b);
  if (dividers.length < 2) return [];

  const w = (LATRINE.seatOpeningWidthIn.value as number) / IN_PER_FT;
  const l = (LATRINE.seatOpeningLengthIn.value as number) / IN_PER_FT;
  const margin = (LATRINE.seatFrontMarginIn.value as number) / IN_PER_FT;
  const halfDepth = lid.actual.d / IN_PER_FT / 2;
  const halfRun = lid.cutLength / IN_PER_FT / 2;

  // Local +Y is world −Z, and the box's front board is at the LOW world z of the two faces, so
  // the front edge of the lid is local y = +halfDepth. Set the opening back from it by the
  // margin: you sit over the hole, and the board in front of it is what you sit on.
  const y = halfDepth - margin - l / 2;
  if (y - l / 2 < -halfDepth || y + l / 2 > halfDepth) return [];

  const out: SeatOpening[] = [];
  for (let i = 0; i + 1 < dividers.length; i++) {
    const bayCentre = (dividers[i]! + dividers[i + 1]!) / 2 - lid.position[0]!;
    const bayWidth = dividers[i + 1]! - dividers[i]!;
    // Board has to survive on both sides of the hole, or it is not a seat, it is a gap.
    if (bayWidth <= w + 2 / IN_PER_FT) continue;
    if (Math.abs(bayCentre) + w / 2 > halfRun) continue;
    out.push({ xFt: bayCentre, yFt: y, widthFt: w, lengthFt: l });
  }
  return out;
}

/** The opening as a closed rectangle in the lid's local (x, y) — what the viewer punches out. */
export function seatOpeningPath(o: SeatOpening): [number, number][] {
  const hx = o.widthFt / 2;
  const hy = o.lengthFt / 2;
  return [
    [o.xFt - hx, o.yFt - hy],
    [o.xFt + hx, o.yFt - hy],
    [o.xFt + hx, o.yFt + hy],
    [o.xFt - hx, o.yFt + hy],
  ];
}
