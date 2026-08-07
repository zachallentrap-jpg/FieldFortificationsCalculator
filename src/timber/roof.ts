// TIMBER-1 engine — gable roof generator (design doc §1.2 roof.ts), stages 7–9.
// Rafter length by the framing-square method: length per foot of run = √(144 + rise²) / 12,
// where `rise` is inches of rise per 12" of run, then SHORTENED half the ridge thickness —
// the FM 5-426 layout sequence (line length, minus half ridge, plus tail). Ridge runs along
// the building length (X); the two slopes face ±Z. Pure: inputs + doctrine constants in,
// Member[] out.
//
// Placement honesty: the ridge board's top edge is flush with the rafter top planes,
// ceiling joists and collar ties sit BESIDE their rafters (offset one thickness, the way
// they are nailed), gable studs stop at the rafter underside, and sheathing lies ON the
// rafter top planes (offset along the slope normal).
//
// The bird's-mouth seat is carried as angles on the member (plumb/seat cuts) and CUT by the
// viewer, which derives the notch from the rafter and the plate it crosses. What lives here is
// the other half of that joint: the rafter plane sits at a real height above the plate, so the
// notch the viewer derives is a plate-wide seat rather than a bite out of the rafter. See
// `heightAbovePlateFt`.

import type { Member, MemberRole, StageId } from './types';
import { DRESSED } from './types';
import { layoutCenters } from './floor';
import { rafterSeatLiftFt } from './birdsMouth';

const FT = 12;

export interface RoofInput {
  lengthFt: number; // building X (ridge direction)
  widthFt: number; // building Z (span)
  wallHeightFt: number; // top of cap plate
  risePer12: number; // inches of rise per foot of run (e.g. 4 = 4:12 pitch)
  rafterSpacingIn: 16 | 24;
  overhangFt?: number; // horizontal eave overhang, default 1
  atticAccess?: boolean; // framed scuttle opening in the ceiling joists (default false)
}

export function generateRoof(input: RoofInput): Member[] {
  const members: Member[] = [];
  const counters: Partial<Record<MemberRole, number>> = {};
  const emit = (
    role: MemberRole,
    nominal: string,
    cutLenFt: number,
    position: [number, number, number],
    rotation: [number, number, number],
    stage: StageId,
    extras?: Partial<Member>,
  ): void => {
    const n = (counters[role] = (counters[role] ?? 0) + 1);
    members.push({
      id: `RF-${role}-${String(n).padStart(2, '0')}`,
      role,
      nominal,
      actual: DRESSED[nominal] ?? { w: 1.5, d: 3.5 },
      cutLength: cutLenFt * FT,
      position,
      rotation,
      stage,
      grade: 'No. 2 common',
      nailing: extras?.nailing ?? '16d common (PH)',
      doctrineRef: extras?.doctrineRef ?? 'FM 5-426 ch. 6 roof framing (PH page)',
      ...extras,
    });
  };

  const L = input.lengthFt;
  const W = input.widthFt;
  const H = input.wallHeightFt;
  const overhang = input.overhangFt ?? 1;
  const t = 1.5 / FT;
  const pitch = Math.atan2(input.risePer12, 12); // slope angle
  const cosP = Math.cos(pitch);
  const slope = input.risePer12 / 12; // rise per foot of run
  const lenPerFtRun = Math.sqrt(144 + input.risePer12 ** 2) / 12; // framing-square method
  const halfSpan = W / 2;
  // The rafter plane's datum at the building line. This USED to be the plate top itself, which
  // put the rafter's centre line on the plate's outer top corner and buried half the rafter in
  // the wall. `rafterSeatLiftFt` raises it to where a plate-wide bird's-mouth seat lands.
  const eaveDatum = H + rafterSeatLiftFt(DRESSED['2x6']!.d, DRESSED['2x4']!.d, slope);
  const ridgeY = eaveDatum + halfSpan * slope;
  const oc = input.rafterSpacingIn / FT;
  const rafterHalf = DRESSED['2x6']!.d / FT / 2; // half rafter depth, feet

  // Rafter/joist layout grid — same OC rule as the floor (panel edges land on centers).
  const gridXs = layoutCenters(L, oc, t);

  // ── Stage 7: ceiling joists — 2x6 on edge across the width, bearing on the cap plates,
  // each nailed BESIDE its rafter (offset one thickness); the gable ends need none (the
  // gable wall closes them). Optional attic scuttle: the framed-opening pattern again —
  // doubled trimmers and headers, tail joists.
  const cjD = DRESSED['2x6']!.d / FT;
  const cjY = H + cjD / 2;
  const cjXs = gridXs.slice(1, -1).map((x) => x + t);
  const cjAt = (x: number, z0: number, z1: number, role: MemberRole, extras?: Partial<Member>): void =>
    emit(role, '2x6', z1 - z0, [x, cjY, (z0 + z1) / 2], [0, -Math.PI / 2, 0], 7, {
      nailing: '3-16d toenail ea plate + 16d to rafter (PH)',
      doctrineRef: 'FM 5-426 ceiling joists tie walls (PH page)',
      ...extras,
    });

  const scuttle = input.atticAccess && L >= 8 && W >= 8
    ? { x0: L / 2 - 1.25, x1: L / 2 + 1.25, z1: W / 2 - 1.5, z2: W / 2 + 1.5 }
    : null;

  for (const x of cjXs) {
    if (scuttle) {
      // ABSORBED MEANS THE JOIST WOULD LAND IN THE DOUBLED TRIMMER, not merely near the opening.
      // The test was `oc / 2` — half the joist SPACING, eight inches on a 16-in layout — so it
      // deleted any ceiling joist within eight inches of an edge and put nothing in its place:
      // the trimmers stay on the opening line, they do not move out to the joist line. On the
      // shipped custom card that was two joists of fourteen, leaving 21¼ and 22¼-in bays in a
      // 16-in ceiling, and one of the two was INSIDE the opening, where it should have been cut
      // into tails and instead vanished.
      //
      // The width of the wood is the test. Each trimmer pair runs 2t OUTWARD from its edge and a
      // joist is t wide, so they share wood only over (edge − 2½t, edge + ½t) at the low side and
      // (edge − ½t, edge + 2½t) at the high one.
      if (x > scuttle.x0 - 2.5 * t && x < scuttle.x0 + 0.5 * t) continue;
      if (x > scuttle.x1 - 0.5 * t && x < scuttle.x1 + 2.5 * t) continue;
      if (x > scuttle.x0 && x < scuttle.x1) {
        if (scuttle.z1 - 2 * t > 0.2) {
          cjAt(x, 0, scuttle.z1 - 2 * t, 'tailJoist', {
            doctrineRef: 'tail joist at attic scuttle — same framing-at-openings pattern as the floor (FM 5-426, PH page)',
          });
        }
        if (W - (scuttle.z2 + 2 * t) > 0.2) {
          cjAt(x, scuttle.z2 + 2 * t, W, 'tailJoist', {
            doctrineRef: 'tail joist at attic scuttle — same framing-at-openings pattern as the floor (FM 5-426, PH page)',
          });
        }
        continue;
      }
    }
    cjAt(x, 0, W, 'joist');
  }
  if (scuttle) {
    for (const edge of [scuttle.x0, scuttle.x1]) {
      const dir = edge === scuttle.x0 ? -1 : 1;
      for (const k of [0.5, 1.5]) {
        cjAt(edge + dir * k * t, 0, W, 'trimmerJoist', {
          nailing: '16d @ 12" staggered to mate (PH)',
          doctrineRef: 'double trimmer at attic scuttle (FM 5-426 framing at openings, PH page)',
        });
      }
    }
    for (const [face, dir] of [[scuttle.z1, -1], [scuttle.z2, 1]] as const) {
      for (const k of [0.5, 1.5]) {
        emit('headerJoist', '2x6', scuttle.x1 - scuttle.x0, [(scuttle.x0 + scuttle.x1) / 2, cjY, face + dir * k * t], [0, 0, 0], 7, {
          nailing: '3-16d ea tail joist + 16d @ 12" to mate (PH)',
          doctrineRef: 'double header at attic scuttle (FM 5-426 framing at openings, PH page)',
        });
      }
    }
  }

  // ── Stage 8: rafters (paired at each grid line), ridge, collar ties, gable studs.
  // Rafter line runs from the eave tail to the ridge FACE (half the ridge thickness back
  // from center) — the doctrinal shortening allowance.
  const run = halfSpan + overhang - t / 2;
  const rafterLen = run * lenPerFtRun;
  for (const x of gridXs) {
    for (const side of [-1, 1] as const) {
      // Slope faces -Z (side -1, front/south) or +Z (side +1, rear/north).
      const zEave = side === -1 ? -overhang : W + overhang;
      const zRidge = W / 2 + side * (t / 2); // stop at the ridge board face
      const yEave = eaveDatum - overhang * slope;
      const yRidge = ridgeY - (t / 2) * slope;
      const zC = (zEave + zRidge) / 2;
      const yC = (yEave + yRidge) / 2;
      emit('rafter', '2x6', rafterLen, [x, yC, zC], [0, -Math.PI / 2, -side * pitch], 8, {
        angles: { plumbCut: 90 - (pitch * 180) / Math.PI, seatCut: (pitch * 180) / Math.PI },
        nailing: '3-16d at ridge, bird’s-mouth toenail 3-8d (PH)',
        doctrineRef: `FM 5-426 framing-square method: ${lenPerFtRun.toFixed(3)} ft/ft run, less half the ridge (PH page)`,
      });
    }
  }
  // Ridge board: top edge flush with the rafter top planes (rafter tops rise rafterHalf/cos
  // above their center line at the ridge).
  const ridgeD = DRESSED['2x8']!.d / FT;
  const ridgeTop = ridgeY + rafterHalf / cosP;
  emit('ridge', '2x8', L, [L / 2, ridgeTop - ridgeD / 2, W / 2], [0, 0, 0], 8, {
    nailing: 'rafters 3-16d ea (PH)',
    doctrineRef: 'FM 5-426: ridge one size deeper than rafters, tops flush (PH page)',
  });
  // Collar ties on every third interior rafter pair (≤5 ft apart per manual), at 1/3 down
  // from the ridge, nailed beside their rafters (the gable ends need none).
  // Measured down from the ridge against the RAFTER LINE — which starts at `eaveDatum`, not at
  // the plate. `tieHalf` below is derived from that same line, so using the plate top here
  // would put the tie two thirds of the way to where its own ends are.
  const tieY = ridgeY - (ridgeY - eaveDatum) / 3;
  // The horizontal half-length at 1/3 of the vertical rise-to-ridge distance is exactly
  // halfSpan/3 for ANY pitch — (ridgeY-H) and the horizontal-per-vertical ratio both scale
  // with risePer12, so it cancels out of ((ridgeY-tieY)*12)/risePer12 algebraically. Writing
  // it directly avoids a 0/0 at a flat (risePer12=0) roof, which the cancelled-out form
  // divided by literally. Audit fix, kept through the FM 5-426 merge.
  const tieHalf = halfSpan / 3;
  for (let i = 3; i < gridXs.length - 1; i += 3) {
    emit('collarTie', '2x4', 2 * tieHalf, [gridXs[i]! + t, tieY, W / 2], [0, -Math.PI / 2, 0], 8, {
      nailing: '4-8d ea end (PH)',
      doctrineRef: 'FM 5-426: collar tie every 3rd rafter / ≤5 ft (PH page)',
    });
  }
  // Gable-end studs: verticals from the cap plate up to the RAFTER UNDERSIDE, set just
  // inside the end rafters, on the same OC grid.
  const underside = rafterHalf / cosP;
  for (const xEnd of [1.5 * t, L - 1.5 * t]) {
    for (let z = oc; z < W - 0.01; z += oc) {
      // From the cap plate up to the rafter underside — measured off the rafter plane's own
      // datum, so a gable stud still dies into the rafter when the plane is seated properly.
      const riseHere = eaveDatum - H + (halfSpan - Math.abs(z - halfSpan)) * slope - underside;
      if (riseHere < 0.2) continue;
      emit('stud', '2x4', riseHere, [xEnd, H + riseHere / 2, z], [0, Math.PI / 2, Math.PI / 2], 8, {
        nailing: 'toenail 2-8d ea end (PH)',
        doctrineRef: 'FM 5-426 gable studs (PH page)',
      });
    }
  }

  // ── Stage 9: roof sheathing — 4x8 panels laid long-side along the eave, courses climbing
  // the slope, ON the rafter top planes (offset along the slope normal), last course ripped
  // to fit (never overlapped).
  const slopeLen = (halfSpan + overhang) * lenPerFtRun;
  const panelHalf = 0.25 / FT; // half of 1/2" sheathing
  const lift = rafterHalf + panelHalf; // center offset from the rafter center plane, along the normal
  const courses = Math.ceil(slopeLen / 4);
  for (const side of [-1, 1] as const) {
    const zEave = side === -1 ? -overhang : W + overhang;
    const yEave = eaveDatum - overhang * slope;
    const nY = cosP;
    const nZ = side * Math.sin(pitch);
    for (let c = 0; c < courses; c++) {
      const courseW = Math.min(4, slopeLen - c * 4);
      if (courseW < 0.05) continue;
      const sMid = c * 4 + courseW / 2; // along-slope center of this course
      const frac = sMid / slopeLen; // 0 at eave, 1 at ridge
      const zC = zEave + (W / 2 - zEave) * frac + nZ * lift;
      const yC = yEave + (ridgeY - yEave) * frac + nY * lift;
      for (let x0 = 0; x0 < L - 0.01; x0 += 8) {
        const wPanel = Math.min(8, L - x0);
        // Panel width (local Y) leans from vertical down onto the slope: tilt about X so the
        // face lies in the slope plane, mirrored per side.
        emit('roofPanel', '4x8 panel', wPanel, [x0 + wPanel / 2, yC, zC], [-side * (Math.PI / 2 - pitch), 0, 0], 9, {
          actual: { w: 0.5, d: courseW * FT },
          nailing: '8d @ 6" edges / 12" field (PH)',
          doctrineRef:
            courseW < 4 - 0.01
              ? 'FM 5-426 roof sheathing; top course ripped to the ridge (PH page)'
              : 'FM 5-426 roof sheathing (PH page)',
        });
      }
    }
  }

  return members;
}
