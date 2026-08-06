// The two cuts at the ends of a stair stringer.
//
// A stringer is not a stick laid on a slope. Its TOP EDGE is the line of the tread nosings, its
// body hangs below that line, and its ends are cut square to the WORLD rather than to the board:
// level at the foot, so it sits flat on the ground or the pad, and plumb at the head, so it bears
// flat against the header it is bolted to.
//
// Drawn as a plain raked box it does neither, and both errors are visible on every stair in the
// toolkit. Measured before the fix: the foot's lower corner stabbed 4.04 in below the ground the
// flight starts on (4.39 in on the tower's), and the head's upper corner stood the same distance
// above the landing — so each flight ended in two sharp wedges, one buried in the earth and one
// waving in the air past the doorway. Half the board also stood ABOVE the treads, because the
// piece was centred on the nosing line instead of hanging under it; that half is fixed where the
// stringer is placed, in `generateStair`. This module is only the ends.
//
// The profile is 2D in the member's own frame — local X along the length, local Y across the face
// — which is what `cutLumberPiece` takes, the same route the rafter's bird's-mouth notch already
// travels. Nothing here touches the member's `cutLength`: you cut the ends OFF a board of that
// length, and the cut list is right to ask for the whole board.

import type { Member } from './types';
import { IN_PER_FT } from './doctrine';

/** How much of the piece's own length a single end cut may eat, before it is a different piece. */
const MAX_BITE = 0.45;

/**
 * The stringer's outline: a rectangle with the foot cut level and the head cut plumb.
 *
 * Returns the plain rectangle for a member with no usable pitch — a level "stair" is not a stair,
 * and neither cut is defined there, so the honest answer is to change nothing.
 */
export function stringerEndProfile(m: Pick<Member, 'cutLength' | 'actual' | 'rotation'>): [number, number][] {
  const hx = m.cutLength / IN_PER_FT / 2;
  const hy = m.actual.d / IN_PER_FT / 2;
  const rect: [number, number][] = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
  const signed = m.rotation[2] ?? 0;
  const pitch = Math.abs(signed);
  if (pitch < 1e-6 || pitch > Math.PI / 2 - 1e-6) return rect;
  const tan = Math.tan(pitch);
  // The level cut at the foot runs from the top corner down to the underside, reaching forward by
  // the face width over the tangent; the plumb cut at the head runs back by the face width times
  // it. They are reciprocals because one is measured against the horizontal and one the vertical.
  const foot = Math.min((2 * hy) / tan, 2 * hx * MAX_BITE);
  const head = Math.min(2 * hy * tan, 2 * hx * MAX_BITE);
  // WHICH END IS THE FOOT DEPENDS ON THE SIGN, and the toolkit contains both handednesses. A
  // stair climbs out of its +X end (`+pitch`), so its foot is at -hx; the platform's RAMP is
  // written the other way round — "walking out the +X end of the stringer goes DOWNHILL" — so
  // its foot is at +hx. Cutting the level face onto the wrong end would put the long wedge in
  // the air at the top and leave the buried end square, which is worse than not cutting at all.
  const downhillIsPlusX = signed < 0;
  return downhillIsPlusX
    ? [[-hx + head, -hy], [hx - foot, -hy], [hx, hy], [-hx, hy]]
    : [[-hx + foot, -hy], [hx - head, -hy], [hx, hy], [-hx, hy]];
}

/**
 * Where the stringer's centre goes, given the point its TOP EDGE has to pass through.
 *
 * Half the board belongs below the nosings and none of it above, so the centre sits half a face
 * width down the board's own local -Y — which is not straight down in the world, because the
 * board is pitched. Returned as a world offset so the caller adds it and nothing has to know the
 * rotation convention twice.
 */
export function stringerDropFt(faceWidthIn: number, yawRad: number, pitchRad: number): [number, number, number] {
  const hy = faceWidthIn / IN_PER_FT / 2;
  // Rotate the local vector (0, -hy, 0) by the member's own YXZ euler, with rx = 0.
  const x = hy * Math.sin(pitchRad);
  const y = -hy * Math.cos(pitchRad);
  return [x * Math.cos(yawRad), y, -x * Math.sin(yawRad)];
}
