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
import { DRESSED } from './types';
import { IN_PER_FT, STAIR } from './doctrine';

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
 * A raked rafter's HEAD ONLY, cut plumb against the board it lands on.
 *
 * The tent bent's rafters run up to a ridge, and a rafter meeting a ridge is cut plumb — the
 * whole of its face bears on the board's side. Left square to the rake, the head is a wedge: its
 * low corner reaches half a face width times the sine of the pitch further along the run than its
 * centreline, its top corner falls the same distance short, and there is NO position for it that
 * both bears on the board and stays out of it. Measured on the shipped GP Small, the two rafters
 * of a bent were 1.45 in inside each other and 0.75 in inside the ridge.
 *
 * The foot is deliberately left square. `stringerEndProfile` cuts a level one, which is right for
 * a stringer standing on the ground and wrong here: it lifts the piece's underside half a face
 * width times the cosine of the pitch, and this rafter's foot is bearing on a post top.
 */
export function ridgeHeadProfile(m: Pick<Member, 'cutLength' | 'actual' | 'rotation'>): [number, number][] | null {
  const hx = m.cutLength / IN_PER_FT / 2;
  const hy = m.actual.d / IN_PER_FT / 2;
  const pitch = Math.abs(m.rotation[2] ?? 0);
  if (pitch < 1e-6 || pitch > Math.PI / 2 - 1e-6) return null;
  // The head is at +X — the end the member climbs toward, since world y = pos.y + lx·sin(pitch).
  const head = Math.min(2 * hy * Math.tan(pitch), 2 * hx * MAX_BITE);
  return [[-hx, -hy], [hx - head, -hy], [hx, hy], [-hx, hy]];
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

// ── The sawtooth ─────────────────────────────────────────────────────────────
//
// A STAIR STRINGER IS CUT, and the cuts are the stair. Its top edge is not a rake, it is a
// staircase: a level SEAT under every tread and a plumb RISER face between each pair. Drawn as a
// board with a straight top edge, flat treads laid on it can only ever meet it along a line — so
// each tread was part buried in the stringer and part hanging in the air, and no arrangement of
// the treads could fix it because the fault was the shape of the board underneath them.
//
// Three lines are involved and only one of them is the stringer:
//
//   THE NOSING LINE runs through the nose of every tread: slope R/T, from (0, R) at the base to
//   ((N−1)T, N·R) at the landing. This is the line a framing square walks, and it is the line the
//   stringer's stock is laid out from — the board hangs its full face width BELOW it.
//
//   THE LINE AS BUILT ran from (0, 0) to ((N−1)T, N·R) — from the GROUND at the base to the
//   landing at the head. A third steeper than the nosing line, a full riser low at the foot, and
//   level with the nosing line only at the very top. Every tread crossed it.
//
//   THE SAWTOOTH is what actually carries treads: seat i level at h = i·R − t (the tread's
//   underside) from d = (i−1)T to d = iT, with a plumb face between each seat and the next.
//
// The foot is cut level where the board's underside reaches the ground, which on a 2x12 at a
// 7¼/10 pitch is a 9-in flat; the head is cut plumb at the landing edge. Both come out of the
// same polygon, so there is one profile per stringer and not an end treatment bolted onto a rake.

/** What flight a stair stringer was cut for, recovered from the piece itself. */
export interface StairStringerGeometry {
  /** Rise per riser, feet. */
  riserFt: number;
  /** Unit run, feet — the doctrine figure every flight in the toolkit is laid out on. */
  runFt: number;
  /** How many SEATS the board carries: one per tread, which is one fewer than the risers. */
  seats: number;
  pitch: number;
  faceWidthFt: number;
  treadThickFt: number;
  /** Where the underside meets the ground, measured from the base along the flight. */
  footFt: number;
}

/**
 * Read a stair stringer's flight off the member.
 *
 * Nothing has to be threaded through the model for this: the unit run is doctrine and the same
 * for every flight, the pitch gives the riser, and the length gives the count. Returns null for
 * anything that is not a stair stringer — which includes the loading platform's RAMP, whose
 * stringers carry the same role and a NEGATIVE pitch (the toolkit contains both handednesses,
 * and a ramp has no steps to cut).
 */
export function stairGeometryOf(m: Pick<Member, 'cutLength' | 'actual' | 'rotation'>): StairStringerGeometry | null {
  const pitch = m.rotation[2] ?? 0;
  if (pitch <= 1e-6 || pitch >= Math.PI / 2 - 1e-6) return null;
  const runFt = Math.max(STAIR.unitRunIn.value as number, STAIR.minTreadIn.value as number) / IN_PER_FT;
  const riserFt = runFt * Math.tan(pitch);
  const hyp = Math.hypot(runFt, riserFt);
  const lenFt = m.cutLength / IN_PER_FT;
  // The stock runs from the foot corner — one riser BELOW the nosing line's start, measured along
  // the rake — to the head corner, which is `seats` full steps up it.
  const raw = (lenFt - riserFt * Math.sin(pitch)) / hyp;
  const seats = Math.round(raw);
  if (seats < 1 || Math.abs(raw - seats) > 1e-6) return null;
  const faceWidthFt = m.actual.d / IN_PER_FT;
  const treadThickFt = DRESSED[STAIR.treadNominal.value as string]!.w / IN_PER_FT;
  // A board deeper than the flight is long cannot be cut this way: its level foot would run out
  // past the head. That is a degenerate stair, not a cutting problem, and it keeps its rake.
  const footFt = (faceWidthFt / Math.cos(pitch) - riserFt) * (runFt / riserFt);
  if (!(footFt > 0) || footFt > seats * runFt) return null;
  return { riserFt, runFt, seats, pitch, faceWidthFt, treadThickFt, footFt };
}

/**
 * The stringer's outline as a cut piece: level foot, sawtooth, plumb head.
 *
 * Null when the member is not a stair stringer — the caller falls back to `stringerEndProfile`,
 * which is still the right answer for a ramp.
 */
export function stairStringerProfile(m: Pick<Member, 'cutLength' | 'actual' | 'rotation'>): [number, number][] | null {
  const g = stairGeometryOf(m);
  if (!g) return null;
  const { riserFt: R, runFt: T, seats, pitch, faceWidthFt: Fw, treadThickFt: t, footFt } = g;
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  const hyp = Math.hypot(T, R);
  // The board's own extent along the rake, measured from the nosing line's start at (d = 0, h = R).
  const sMin = -R * sin;
  const sMax = seats * hyp;
  const sMid = (sMin + sMax) / 2;
  /** A point of the flight — horizontal from the base, height above it — in the board's frame. */
  const at = (d: number, h: number): [number, number] => [
    d * cos + (h - R) * sin - sMid,
    -d * sin + (h - R) * cos + Fw / 2,
  ];
  const top: [number, number][] = [at(0, 0), at(0, R - t)];
  for (let i = 1; i <= seats; i++) {
    top.push(at(i * T, i * R - t));
    if (i < seats) top.push(at(i * T, (i + 1) * R - t));
  }
  // Plumb up the last riser to the landing the flight arrives on.
  top.push(at(seats * T, (seats + 1) * R));
  // And back along the underside, which is the nosing line a full face width below it.
  const under = (d: number): number => R + (R / T) * d - Fw / cos;
  return [...top, at(seats * T, under(seats * T)), at(footFt, 0)];
}

/**
 * A raked member's LOW END, cut LEVEL at the corner the member was struck from.
 *
 * The guard tower's X-braces are bolted flat to a BATTERED face and struck corner to corner of
 * each bay. A board has width, so the low end's low corner hangs 2.21 in below the corner the
 * diagonal was struck from — and the bottom bay's corner is the top of the footing the legs stand
 * on. Every bottom-bay brace therefore had its foot buried in that footing, on all four faces, on
 * both footings the card offers:
 *
 *   timber mudsill   6 pairs, 1.93 in       concrete pad   8 pairs, 1.92 in
 *
 * Nothing cuts a `towerBrace`, so unlike a bird's mouth or a plumb ridge cut this was never a
 * box-versus-mesh approximation. It is what the viewer actually drew.
 *
 * The cut is level through the CENTRELINE'S END — the bay corner itself — which is where a
 * carpenter's saw goes and is the one datum the piece carries on its own. Cutting level through
 * the end's TOP corner instead, which is what `stringerEndProfile` does at a stringer's foot, is
 * right for a board standing on the ground and wrong here: it eats the whole end face and leaves
 * the foot 2½ in in the air.
 *
 * Unlike the stringer's, this cut cannot be read off `rotation[2]`. A stringer stands in a
 * VERTICAL plane, so its pitch is its z-euler; a brace laid on a battered face is tilted out of
 * that plane, and the direction that is level in the WORLD is a direction in the member's own
 * frame that depends on more than one angle. Both axes' world-Y parts settle it — the yaw cannot
 * enter, since turning a member in plan cannot change a height.
 *
 * Returns null when there is nothing to cut: a level board has no low end, and a board whose face
 * width runs horizontally has no corner hanging below its centreline.
 */
export function levelFootProfile(m: Pick<Member, 'cutLength' | 'actual' | 'rotation'>): [number, number][] | null {
  const hx = m.cutLength / IN_PER_FT / 2;
  const hy = m.actual.d / IN_PER_FT / 2;
  const [rx, , rz] = m.rotation;
  // World Y of the member's own length and face-width axes, for R = Ry·Rx·Rz.
  const climb = Math.sin(rz) * Math.cos(rx);
  const across = Math.cos(rz) * Math.cos(rx);
  if (Math.abs(climb) < 1e-6 || Math.abs(across) < 1e-6) return null;
  /** Which end hangs low, and which edge of the face hangs below the centreline. */
  const lowEnd = climb > 0 ? -1 : 1;
  const lowEdge = across > 0 ? -1 : 1;
  // How far back along the board the level line reaches in falling one half face width: the run
  // whose rise exactly cancels it. Clamped, because past that it is a different piece.
  const bite = Math.min((hy * Math.abs(across)) / Math.abs(climb), 2 * hx * MAX_BITE);
  if (bite < 1e-6) return null;
  const rect: [-1 | 1, -1 | 1][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const out: [number, number][] = [];
  for (let i = 0; i < rect.length; i++) {
    const [sx, sy] = rect[i]!;
    if (sx !== lowEnd || sy !== lowEdge) { out.push([sx * hx, sy * hy]); continue; }
    // The corner is gone; the two points the level line leaves in its place go on in the order
    // the walk arrives at them, so the outline keeps its winding.
    const onEdge: [number, number] = [lowEnd * (hx - bite), lowEdge * hy];
    const onEnd: [number, number] = [lowEnd * hx, 0];
    out.push(...(rect[(i + 3) % 4]![1] === sy ? [onEdge, onEnd] : [onEnd, onEdge]));
  }
  return out;
}
