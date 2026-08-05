// TIMBER-2 — the bird's mouth: the notch that seats a rafter on its plate.
//
// THE MEMBER ALREADY DECLARES IT AND NOTHING DREW IT. Every rafter carries
// `angles: { plumbCut, seatCut }`, and the design doc says so in as many words: "bird's-mouth
// seat geometry is carried as angles on the member but not notched in scene geometry". Carried,
// and then not cut — so a rafter was a plain stick laid across the wall, passing 2.9 in THROUGH
// the cap plate it is supposed to bear on. Scrub to any framing stage and the rafters cross the
// plates as though the plates were not there.
//
// This module is PURE and adds nothing to the model. The notch is DERIVED from members the
// engine already emitted — the rafter, and the plate it crosses — so no generator changes, no
// golden moves, and the frozen branch is untouched. What comes out is a cut profile the viewer
// extrudes in place of a box.
//
// ── The frame, because this is where the signs live ──────────────────────────
//
// A member's rotation is YXZ, and a rafter's is [0, ry, rz]: yaw onto its run, then pitch. So
// world = Ry(Rz(local)), which expands to
//
//     y     = pos.y + lx·sin rz + ly·cos rz          (the pitch alone decides height)
//     run   = pos[axis] + K·(lx·cos rz − ly·sin rz)  (K = ±1, from the yaw)
//
// with `axis` x when the yaw is 0 or π and z when it is ±π/2. Everything below is those two
// lines solved for the two cuts a framing square gives you:
//
//     the SEAT, horizontal, bearing on the plate's top   → solve y(lx, −halfFace) = plateTop
//     the HEEL, plumb, against the plate's outer face    → solve run(lx, −halfFace) = outerRun
//
// and the waste between them is the notch.

import type { Member } from './types';

const IN_PER_FT = 12;

/**
 * How high a rafter's TOP edge sits above the plate at the building line — HAP, the number a
 * framer sets before cutting anything.
 *
 * THE ONE THAT SETS THE ROOF PLANE. A bird's mouth is not free geometry: the seat is as long as
 * the plate is wide, and the heel is however deep the pitch makes it over that length. Fix the
 * seat on the plate top and the rafter's elevation follows —
 *
 *     plumb depth of the rafter    = face / cos θ
 *     plumb depth the notch eats   = plateWidth · tan θ      (over a seat one plate wide)
 *     HAP                          = the difference
 *
 * The engine used to place the rafter's CENTRE LINE on the plate's top outer corner, which is
 * HAP = face / 2cos θ: about 1¾ in low for a 2x6 at 4/12 on a 2x4 plate. It reads as a roof that
 * is nearly right, and it means the only notch that would close the gap eats 56% of the rafter —
 * past the third of the depth a bending member can lose at its bearing. Raising the plane to a
 * real HAP is what makes the bird's mouth a bird's mouth instead of a bite.
 */
export function heightAbovePlateFt(rafterFaceIn: number, plateWidthIn: number, slope: number): number {
  const cos = 1 / Math.sqrt(1 + slope * slope);
  return rafterFaceIn / IN_PER_FT / cos - (plateWidthIn / IN_PER_FT) * slope;
}

/**
 * The vertical lift from the old datum (rafter centre on the plate's outer top corner) to a real
 * seated rafter — i.e. what to add to `plateTopY` to get the rafter CENTRE LINE at the building
 * line. Zero-pitch roofs get zero: a flat rafter has no seat to cut and bears on its own face.
 */
export function rafterSeatLiftFt(rafterFaceIn: number, plateWidthIn: number, slope: number): number {
  if (slope <= 0) return 0;
  const cos = 1 / Math.sqrt(1 + slope * slope);
  return rafterFaceIn / IN_PER_FT / (2 * cos) - (plateWidthIn / IN_PER_FT) * slope;
}

/**
 * The notch, in the rafter's own local frame: x along its length, y across its face width.
 *
 * `heelXFt` may be either side of `toeXFt`. A gable has two slopes and they mirror: the pitch is
 * +rz on one and −rz on the other, so on one slope the heel is the low-x end of the notch and on
 * the other it is the high-x end. Sorting these two into lo/hi and calling the lower one the heel
 * is the bug that left half a roof unnotched.
 */
export interface SeatCut {
  /** Local x where the heel cut meets the underside — on the plate's outer face. */
  heelXFt: number;
  /** Local x where the seat runs back out through the underside — the inboard edge. */
  toeXFt: number;
  /**
   * Local x of the notch apex: the corner where the plumb heel meets the level seat.
   *
   * NOT the same as `heelXFt`. The heel is PLUMB — vertical in the world — and the rafter is
   * pitched, so a plumb line is not a line of constant local x. Cutting the heel square across
   * the board (apex directly above the heel in the LOCAL frame) leans the cut face out of the
   * plate and eats 1/cos²θ more of the rafter than the joint needs: 22% of the face instead of
   * 20% at 4/12, and visibly the wrong shape at anything steeper.
   */
  apexXFt: number;
  /** How far up the face the notch cuts at the apex, from the underside, in local y. */
  depthFt: number;
}

/** Which world axis a member runs along, and the sign that maps its local +x onto that axis. */
export function runAxisOf(m: Member): { axis: 0 | 2; k: number } | null {
  const ry = m.rotation[1];
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  if (Math.abs(cy) > 0.9) return { axis: 0, k: Math.sign(cy) };
  if (Math.abs(sy) > 0.9) return { axis: 2, k: -Math.sign(sy) };
  return null;
}

/**
 * The notch for one rafter bearing on one plate.
 *
 * Returns null when there is nothing to cut: a rafter whose underside already clears the plate
 * needs no notch, and one whose crossing falls off the end of the board is not bearing here at
 * all. Both are answers, not failures — a tower's cab rafters bear on a beam, not a wall plate.
 */
export function seatCutFor(m: Member, plateTopY: number, outerRun: number): SeatCut | null {
  const run = runAxisOf(m);
  if (!run) return null;
  const rz = m.rotation[2];
  const sz = Math.sin(rz);
  const cz = Math.cos(rz);
  if (Math.abs(sz) < 1e-9 || Math.abs(cz) < 1e-9) return null; // flat or plumb: no seat to cut
  const halfLen = m.cutLength / IN_PER_FT / 2;
  const halfFace = m.actual.d / IN_PER_FT / 2;
  const y0 = m.position[1]!;
  const r0 = m.position[run.axis]!;

  // Two of the three corners lie on the underside, ly = −halfFace: the heel, where the plate's
  // outer face crosses it, and the toe, where the plate's top does.
  const toeX = (plateTopY - y0 + halfFace * cz) / sz;
  const heelX = ((outerRun - r0) / run.k - halfFace * sz) / cz;
  if (!Number.isFinite(toeX) || !Number.isFinite(heelX)) return null;

  // Both cuts have to land on the board, or this plate is not what carries it.
  if (Math.max(heelX, toeX) <= -halfLen || Math.min(heelX, toeX) >= halfLen) return null;

  // The apex is the one point that is on BOTH world planes at once — the plate's top AND its
  // outer face. Inverting the member frame for the two of them together is a rotation, so it
  // solves in closed form and needs no case analysis for the slope's sign:
  //     lx·sz + ly·cz = A   (world height  = plate top)
  //     lx·cz − ly·sz = B   (world run     = plate outer face)
  const a = plateTopY - y0;
  const b = (outerRun - r0) / run.k;
  const apexX = a * sz + b * cz;
  const apexY = a * cz - b * sz;
  const depth = apexY + halfFace;
  // A notch deeper than the board is not a notch, and one thinner than a saw kerf is noise.
  if (depth <= 1 / IN_PER_FT || depth >= 2 * halfFace) return null;
  return { heelXFt: heelX, toeXFt: toeX, apexXFt: apexX, depthFt: depth };
}

/**
 * The notch profile as a closed polygon in the member's local (x, y), ready to extrude across
 * its thickness. Corners run anticlockwise from the low-x end of the underside.
 *
 * Walking the underside from −x to +x, the notch is three vertices: the first cut reached, the
 * apex, and the second cut. Which of those is the heel depends on the slope's sign, and the apex
 * always sits over the heel — that is the plumb cut.
 */
export function seatProfile(m: Member, seat: SeatCut): [number, number][] {
  const hx = m.cutLength / IN_PER_FT / 2;
  const hy = m.actual.d / IN_PER_FT / 2;
  const apex: [number, number] = [seat.apexXFt, -hy + seat.depthFt];
  const notch: [number, number][] =
    seat.heelXFt < seat.toeXFt
      ? [[seat.heelXFt, -hy], apex, [seat.toeXFt, -hy]] //  heel first: plumb up, then down the seat
      : [[seat.toeXFt, -hy], apex, [seat.heelXFt, -hy]]; // seat first: up the slope, then plumb down
  return [[-hx, -hy], ...notch, [hx, -hy], [hx, hy], [-hx, hy]];
}

/**
 * Every rafter's notch in a model, keyed by member id.
 *
 * A rafter is matched to the cap plate it actually crosses — the one whose run its footprint
 * passes over — and rafters that cross none simply get no entry, which is the honest answer
 * rather than a guessed notch.
 */
export function seatCutsFor(members: readonly Member[]): Map<string, SeatCut> {
  const out = new Map<string, SeatCut>();
  const plates = members.filter((m) => m.role === 'capPlate');
  if (plates.length === 0) return out;
  for (const m of members) {
    if (m.role !== 'rafter') continue;
    const run = runAxisOf(m);
    if (!run) continue;
    const halfLen = m.cutLength / IN_PER_FT / 2;
    const lowRun = m.position[run.axis]! - Math.abs(halfLen * Math.cos(m.rotation[2]!)) * 1.05;
    const highRun = m.position[run.axis]! + Math.abs(halfLen * Math.cos(m.rotation[2]!)) * 1.05;
    let best: SeatCut | null = null;
    for (const p of plates) {
      const half = p.actual.d / IN_PER_FT / 2;
      const at = p.position[run.axis]!;
      if (at < lowRun || at > highRun) continue;
      const top = p.position[1]! + p.actual.w / IN_PER_FT / 2;
      // The heel is cut against the face the TAIL passes — the downhill side. Local +x climbs
      // (the pitch is +rz), so downhill is whichever face the rafter reaches first going down.
      const outer = run.k * Math.sign(Math.sin(m.rotation[2]!)) > 0 ? at - half : at + half;
      const cut = seatCutFor(m, top, outer);
      if (cut && (!best || cut.depthFt > best.depthFt)) best = cut;
    }
    if (best) out.set(m.id, best);
  }
  return out;
}
