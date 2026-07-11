// TIMBER-1 engine — wall framing generator (docs/TIMBER1_3D_SYSTEM_DESIGN.md §1.2 walls.ts).
// Consumes only inputs + doctrine constants, returns Member[] — unit-testable with zero
// graphics. Plates, studs @16"/24" OC, corner studs, openings (king/jack studs, doubled
// header on edge, rough sill, cripples above and below), double top plate.
//
// ponytail: let-in bracing and the true FM 5-426 3-stud corner-post pattern are not yet
// generated (corner is end stud + one extra); upgrade path is another emit() block here.

import type { Member, MemberRole, StageId, WallId } from './types';
import { DRESSED } from './types';

const T = 1.5; // dressed 2x4 thickness, inches
const FT = 12; // inches per foot

export interface Opening {
  wall: WallId;
  offsetFt: number; // from the wall's left end (viewed from outside) to the RO's left edge
  widthFt: number; // rough opening width
  heightFt: number; // rough opening height
  sillHeightFt: number; // RO bottom above the sole plate top; 0 = door (no sill/cripples below)
  headerNominal?: string; // default '2x6' doubled
}

export interface WallsInput {
  lengthFt: number; // building X extent (N and S walls run along X)
  widthFt: number; // building Z extent (E and W walls run along Z)
  wallHeightFt: number; // finished frame height, sole plate bottom to cap plate top
  studSpacingIn: 16 | 24;
  openings: Opening[];
}

// Wall placement: N/S walls run the full building length; E/W walls fit between them.
// Each wall is described by its start corner (left end viewed from OUTSIDE), unit direction
// along its run, and the yaw that turns a +X-aligned member onto that direction.
interface WallFrame {
  wall: WallId;
  start: [number, number]; // x, z (feet)
  dir: [number, number]; // unit x, z
  runFt: number;
  yaw: number;
}

function wallFrames(lengthFt: number, widthFt: number): WallFrame[] {
  const tFt = T / FT;
  return [
    { wall: 'S', start: [0, 0], dir: [1, 0], runFt: lengthFt, yaw: 0 },
    { wall: 'N', start: [lengthFt, widthFt], dir: [-1, 0], runFt: lengthFt, yaw: Math.PI },
    { wall: 'E', start: [lengthFt, tFt / 2], dir: [0, 1], runFt: widthFt - tFt, yaw: -Math.PI / 2 },
    { wall: 'W', start: [0, widthFt - tFt / 2], dir: [0, -1], runFt: widthFt - tFt, yaw: Math.PI / 2 },
  ];
}

export function generateWalls(input: WallsInput): Member[] {
  const members: Member[] = [];
  const t = T / FT; // 2x4 thickness, feet
  const H = input.wallHeightFt;
  const studLen = H - 3 * t; // between sole plate and the doubled top plate
  const oc = input.studSpacingIn / FT;

  for (const f of wallFrames(input.lengthFt, input.widthFt)) {
    const counters: Partial<Record<MemberRole, number>> = {};
    const emit = (
      role: MemberRole,
      nominal: string,
      cutLenFt: number,
      along: number, // feet along the wall to the member CENTER
      yCenter: number, // feet
      orient: 'flat' | 'vertical' | 'onEdge',
      opts?: { lateralFt?: number; stage?: StageId; nailing?: string; doctrineRef?: string },
    ): void => {
      const n = (counters[role] = (counters[role] ?? 0) + 1);
      const lat = opts?.lateralFt ?? 0;
      const normal: [number, number] = [-f.dir[1], f.dir[0]];
      const x = f.start[0] + f.dir[0] * along + normal[0] * lat;
      const z = f.start[1] + f.dir[1] * along + normal[1] * lat;
      const rotation: [number, number, number] =
        orient === 'flat' ? [-Math.PI / 2, f.yaw, 0]
        : orient === 'vertical' ? [0, f.yaw + Math.PI / 2, Math.PI / 2]
        : [0, f.yaw, 0];
      members.push({
        id: `${f.wall}-${role}-${String(n).padStart(2, '0')}`,
        role,
        nominal,
        actual: DRESSED[nominal] ?? DRESSED['2x4']!,
        cutLength: cutLenFt * FT,
        position: [x, yCenter, z],
        rotation,
        stage: opts?.stage ?? 5,
        wall: f.wall,
        grade: 'No. 2 common',
        nailing: opts?.nailing ?? '2-16d ea end (PH)',
        doctrineRef: opts?.doctrineRef ?? 'FM 5-426 ch. 6 (PH page)',
      });
    };

    // Plates. The cap plate belongs to stage 6 (plates tied & braced).
    emit('solePlate', '2x4', f.runFt, f.runFt / 2, t / 2, 'flat', { nailing: '16d @ 16" to joists (PH)' });
    emit('topPlate', '2x4', f.runFt, f.runFt / 2, H - 1.5 * t, 'flat');
    emit('capPlate', '2x4', f.runFt, f.runFt / 2, H - t / 2, 'flat', { stage: 6, nailing: '16d @ 16", lap corners (PH)' });

    // Common studs on the OC grid measured from the wall's left end, plus forced end studs.
    // The grid pauses for opening bays (kings/jacks/cripples take over there).
    const walls = input.openings.filter((o) => o.wall === f.wall);
    const gridXs: number[] = [];
    for (let s = t / 2; s < f.runFt - t / 2 - 0.01; s += oc) gridXs.push(s);
    gridXs.push(f.runFt - t / 2);
    const inBay = (s: number): Opening | undefined =>
      walls.find((o) => s > o.offsetFt - 2 * t && s < o.offsetFt + o.widthFt + 2 * t);

    for (const s of gridXs) {
      if (inBay(s)) continue;
      emit('stud', '2x4', studLen, s, t + studLen / 2, 'vertical', { nailing: '2-16d ea end or 4-8d toenail (PH)' });
    }
    // One extra corner stud at each end (partial TO corner; see header note).
    for (const s of [1.5 * t, f.runFt - 1.5 * t]) {
      emit('stud', '2x4', studLen, s, t + studLen / 2, 'vertical', { nailing: '16d @ 12" to end stud (PH)' });
    }

    // Openings: kings full height, jacks carry the header, doubled header on edge,
    // rough sill (windows), cripples continuing the stud grid above and below.
    for (const o of walls) {
      const left = o.offsetFt;
      const right = o.offsetFt + o.widthFt;
      const headBottom = o.sillHeightFt + o.heightFt + t; // above sole plate top... RO measured from plate top
      const headerNominal = o.headerNominal ?? '2x6';
      const headerDepthFt = (DRESSED[headerNominal] ?? DRESSED['2x6']!).d / FT;

      for (const side of [-1, 1] as const) {
        const edge = side === -1 ? left : right;
        emit('kingStud', '2x4', studLen, edge + (side * 3 * t) / 2, t + studLen / 2, 'vertical');
        emit('jackStud', '2x4', headBottom - t, edge + (side * t) / 2, t + (headBottom - t) / 2, 'vertical', {
          nailing: '16d @ 12" to king stud (PH)',
        });
      }
      const hdrLen = o.widthFt + 2 * t; // bears on both jacks
      for (const lat of [-t / 2, t / 2]) {
        emit('header', headerNominal, hdrLen, (left + right) / 2, headBottom + headerDepthFt / 2, 'onEdge', {
          lateralFt: lat,
          nailing: '16d @ 16" staggered, both faces (PH)',
        });
      }
      if (o.sillHeightFt > 0) {
        const sillTop = t + o.sillHeightFt;
        emit('sill', '2x4', o.widthFt, (left + right) / 2, sillTop - t / 2, 'flat', { nailing: '2-16d ea end (PH)' });
        for (const s of gridXs) {
          if (!(s > left + t && s < right - t)) continue;
          emit('cripple', '2x4', sillTop - 2 * t, s, t + (sillTop - 2 * t) / 2, 'vertical');
        }
      }
      const cripBase = headBottom + headerDepthFt;
      const cripLen = H - 2 * t - cripBase;
      if (cripLen > 0.05) {
        for (const s of gridXs) {
          if (!(s > left + t && s < right - t)) continue;
          emit('cripple', '2x4', cripLen, s, cripBase + cripLen / 2, 'vertical');
        }
      }
    }
  }

  return members;
}
