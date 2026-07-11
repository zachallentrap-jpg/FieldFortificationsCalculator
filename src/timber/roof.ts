// TIMBER-1 engine — gable roof generator (design doc §1.2 roof.ts), stages 7–9.
// Rafter length by the framing-square method: length per foot of run = √(144 + rise²) / 12,
// where `rise` is inches of rise per 12" of run. Ridge runs along the building length (X);
// the two slopes face ±Z. Pure: inputs + doctrine constants in, Member[] out.
//
// ponytail: bird's-mouth seat geometry is carried as angles on the member (plumb/seat cuts)
// but not notched in scene geometry, exactly as the design doc §6 prescribes.

import type { Member, MemberRole, StageId } from './types';
import { DRESSED } from './types';

const FT = 12;

export interface RoofInput {
  lengthFt: number; // building X (ridge direction)
  widthFt: number; // building Z (span)
  wallHeightFt: number; // top of cap plate
  risePer12: number; // inches of rise per foot of run (e.g. 4 = 4:12 pitch)
  rafterSpacingIn: 16 | 24;
  overhangFt?: number; // horizontal eave overhang, default 1
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
  const lenPerFtRun = Math.sqrt(144 + input.risePer12 ** 2) / 12; // framing-square method
  const halfSpan = W / 2;
  const ridgeY = H + halfSpan * (input.risePer12 / 12);
  const oc = input.rafterSpacingIn / FT;

  // ── Stage 7: ceiling joists — 2x6 on edge across the width, bearing on the cap plates.
  const joistXs: number[] = [];
  for (let x = t / 2; x < L - t / 2 - 0.01; x += oc) joistXs.push(x);
  joistXs.push(L - t / 2);
  const cjD = DRESSED['2x6']!.d / FT;
  for (const x of joistXs) {
    emit('joist', '2x6', W, [x, H + cjD / 2, W / 2], [0, -Math.PI / 2, 0], 7, {
      nailing: '3-16d toenail ea plate + 16d to rafter (PH)',
      doctrineRef: 'FM 5-426 ceiling joists tie walls (PH page)',
    });
  }

  // ── Stage 8: rafters (paired at each grid line), ridge, collar ties, gable studs.
  const run = halfSpan + overhang;
  const rafterLen = run * lenPerFtRun;
  // Rafter center: midpoint of the line from the eave tail to the ridge, per slope.
  for (const x of joistXs) {
    for (const side of [-1, 1] as const) {
      // Slope faces -Z (side -1, front/south) or +Z (side +1, rear/north).
      const zEave = side === -1 ? -overhang : W + overhang;
      const zRidge = W / 2;
      const yEave = H - overhang * (input.risePer12 / 12);
      const zC = (zEave + zRidge) / 2;
      const yC = (yEave + ridgeY) / 2;
      emit('rafter', '2x6', rafterLen, [x, yC, zC], [0, -Math.PI / 2, -side * pitch], 8, {
        angles: { plumbCut: 90 - (pitch * 180) / Math.PI, seatCut: (pitch * 180) / Math.PI },
        nailing: '3-16d at ridge, bird’s-mouth toenail 3-8d (PH)',
        doctrineRef: `FM 5-426 framing-square method: ${lenPerFtRun.toFixed(3)} ft/ft run (PH page)`,
      });
    }
  }
  const ridgeD = DRESSED['2x8']!.d / FT;
  emit('ridge', '2x8', L, [L / 2, ridgeY + ridgeD / 2, W / 2], [0, 0, 0], 8, {
    nailing: 'rafters 3-16d ea (PH)',
  });
  // Collar ties on every third rafter pair (≤5 ft apart per manual), at 1/3 down from ridge.
  const tieY = ridgeY - (ridgeY - H) / 3;
  const tieHalf = ((ridgeY - tieY) * 12) / input.risePer12;
  for (let i = 0; i < joistXs.length; i += 3) {
    emit('collarTie', '2x4', 2 * tieHalf, [joistXs[i]!, tieY, W / 2], [0, -Math.PI / 2, 0], 8, {
      nailing: '4-8d ea end (PH)',
      doctrineRef: 'FM 5-426: collar tie every 3rd rafter / ≤5 ft (PH page)',
    });
  }
  // Gable-end studs: verticals from the cap plate up to the rake, on the same OC grid.
  for (const xEnd of [t / 2, L - t / 2]) {
    for (let z = oc; z < W - 0.01; z += oc) {
      const riseHere = (halfSpan - Math.abs(z - halfSpan)) * (input.risePer12 / 12);
      if (riseHere < 0.2) continue;
      emit('stud', '2x4', riseHere, [xEnd, H + riseHere / 2, z], [0, Math.PI / 2, Math.PI / 2], 8, {
        nailing: 'toenail 2-8d ea end (PH)',
        doctrineRef: 'FM 5-426 gable studs (PH page)',
      });
    }
  }

  // ── Stage 9: roof sheathing — 4x8 panels laid long-side along the slope run, per side.
  const slopeLen = run * lenPerFtRun;
  const courses = Math.ceil(slopeLen / 4);
  for (const side of [-1, 1] as const) {
    for (let c = 0; c < courses; c++) {
      const sMid = Math.min(c * 4 + 2, slopeLen - 2); // along-slope center of this course
      const frac = sMid / slopeLen; // 0 at eave, 1 at ridge
      const zEave = side === -1 ? -overhang : W + overhang;
      const yEave = H - overhang * (input.risePer12 / 12);
      const zC = zEave + (W / 2 - zEave) * frac;
      const yC = yEave + (ridgeY - yEave) * frac + 0.06; // sit just above rafter tops
      for (let x0 = 0; x0 < L - 0.01; x0 += 8) {
        const wPanel = Math.min(8, L - x0);
        // Panel width (local Y) leans from vertical down onto the slope: tilt about X so the
        // face lies in the slope plane, mirrored per side.
        emit('roofPanel', '4x8 panel', wPanel, [x0 + wPanel / 2, yC, zC], [-side * (Math.PI / 2 - pitch), 0, 0], 9, {
          actual: { w: 0.5, d: 48 },
          nailing: '8d @ 6" edges / 12" field (PH)',
        });
      }
    }
  }

  return members;
}
