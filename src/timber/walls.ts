// TIMBER-1 engine — wall framing generator (docs/TIMBER1_3D_SYSTEM_DESIGN.md §1.2 walls.ts).
// Consumes only inputs + doctrine constants, returns Member[] — unit-testable with zero
// graphics. Plates, studs on the true OC layout grid, corner studs, openings (king/jack
// studs, doubled header on edge, rough sill, cripples above and below), double top plate
// with lapped corners, and optional 1x4 let-in bracing (stage 6).
//
// Wall placement: walls stand INSIDE the floor edge — the sole plate's outside face is
// flush with the subfloor/rim plane (a 2x4 wall is 3.5" thick; the old code centered walls
// ON the building line, overhanging half a plate). N/S walls run through; E/W walls butt
// between them.
//
// ponytail: the true FM 5-426 3-stud corner-post pattern is not yet generated (corner is
// end stud + one extra); upgrade path is another emit() block here.

import type { Member, MemberRole, StageId, WallId } from './types';
import { DRESSED } from './types';

const T = 1.5; // dressed 2x4 thickness, inches
const D = 3.5; // dressed 2x4 face width (wall thickness), inches
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
  letInBracing?: boolean; // 1x4 let-in corner braces at stage 6 (default false)
}

// Wall placement: N/S walls run the full building length, inset half a wall thickness;
// E/W walls fit between them. Each wall is described by its start corner (left end viewed
// from OUTSIDE), unit direction along its run, and the yaw that turns a +X-aligned member
// onto that direction.
interface WallFrame {
  wall: WallId;
  start: [number, number]; // x, z (feet)
  dir: [number, number]; // unit x, z
  runFt: number;
  yaw: number;
}

function wallFrames(lengthFt: number, widthFt: number): WallFrame[] {
  const dFt = D / FT;
  return [
    { wall: 'S', start: [0, dFt / 2], dir: [1, 0], runFt: lengthFt, yaw: 0 },
    { wall: 'N', start: [lengthFt, widthFt - dFt / 2], dir: [-1, 0], runFt: lengthFt, yaw: Math.PI },
    { wall: 'E', start: [lengthFt - dFt / 2, dFt], dir: [0, 1], runFt: widthFt - 2 * dFt, yaw: -Math.PI / 2 },
    { wall: 'W', start: [dFt / 2, widthFt - dFt], dir: [0, -1], runFt: widthFt - 2 * dFt, yaw: Math.PI / 2 },
  ];
}

export function generateWalls(input: WallsInput): Member[] {
  const members: Member[] = [];
  const t = T / FT; // 2x4 thickness, feet
  const dFt = D / FT; // 2x4 face width (wall thickness), feet
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
      orient: 'flat' | 'vertical' | 'onEdge' | 'diag',
      opts?: { lateralFt?: number; stage?: StageId; nailing?: string; doctrineRef?: string; diagRz?: number },
    ): void => {
      const n = (counters[role] = (counters[role] ?? 0) + 1);
      const lat = opts?.lateralFt ?? 0;
      const normal: [number, number] = [-f.dir[1], f.dir[0]];
      const x = f.start[0] + f.dir[0] * along + normal[0] * lat;
      const z = f.start[1] + f.dir[1] * along + normal[1] * lat;
      const rotation: [number, number, number] =
        orient === 'flat' ? [-Math.PI / 2, f.yaw, 0]
        : orient === 'vertical' ? [0, f.yaw + Math.PI / 2, Math.PI / 2]
        : orient === 'diag' ? [0, f.yaw, opts?.diagRz ?? 0]
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

    const walls = input.openings.filter((o) => o.wall === f.wall);
    const hasDoor = walls.some((o) => o.sillHeightFt === 0);

    // Plates. The cap plate belongs to stage 6 (plates tied & braced) and laps the corner:
    // through-wall caps stop short, butt-wall caps run long, tying the walls together.
    emit('solePlate', '2x4', f.runFt, f.runFt / 2, t / 2, 'flat', {
      nailing: '16d @ 16" to joists (PH)',
      doctrineRef: hasDoor
        ? 'FM 5-426 ch. 6 (PH page) — run full, then cut out of door ROs after the wall is raised'
        : undefined,
    });
    emit('topPlate', '2x4', f.runFt, f.runFt / 2, H - 1.5 * t, 'flat');
    const capLap = f.wall === 'S' || f.wall === 'N' ? -2 * dFt : 2 * dFt;
    emit('capPlate', '2x4', f.runFt + capLap, f.runFt / 2, H - t / 2, 'flat', {
      stage: 6,
      nailing: '16d @ 16" + 2-16d at laps (PH)',
      doctrineRef: 'FM 5-426: cap plate laps at corners tie the walls (PH page)',
    });

    // Common studs: end studs edge-flush, interior studs on exact OC multiples so panel
    // edges land on stud centers — the FM 5-426 plate layout (15 1/4" to the first mark
    // for 16" OC, then every 16"). The grid pauses for opening bays (kings/jacks/cripples
    // take over there).
    const gridXs: number[] = [t / 2];
    for (let s = oc; s < f.runFt - 1.5 * t; s += oc) gridXs.push(s);
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

    // Let-in bracing (stage 6): a 1x4 let into the stud faces at each end of the wall,
    // as close to 45° as the openings allow (steeper when crowded, skipped when there is
    // no room). The brace face sits a hair proud of the stud faces so the let-in reads.
    if (input.letInBracing) {
      const braceT = DRESSED['1x4']!.w / FT;
      const clearL = walls.length ? Math.min(...walls.map((o) => o.offsetFt)) - 0.5 : f.runFt - 1;
      const clearR = walls.length ? f.runFt - Math.max(...walls.map((o) => o.offsetFt + o.widthFt)) - 0.5 : f.runFt - 1;
      const lat = -((dFt - braceT) / 2 + 0.05 / FT); // outside face, slightly proud
      for (const [end, clear] of [['L', clearL], ['R', clearR]] as const) {
        const run = Math.min(clear, studLen);
        if (run < 3) continue;
        const ang = Math.atan2(studLen, run);
        const len = Math.hypot(run, studLen);
        const along = end === 'L' ? run / 2 : f.runFt - run / 2;
        emit('brace', '1x4', len, along, t + studLen / 2, 'diag', {
          stage: 6,
          lateralFt: lat,
          diagRz: end === 'L' ? ang : -ang,
          nailing: '2-8d at each stud crossing (PH)',
          doctrineRef:
            run >= studLen - 0.01
              ? 'FM 5-426 let-in corner brace, 45 deg (PH page)'
              : 'FM 5-426 let-in corner brace — steepened where the openings crowd it (PH page)',
        });
      }
    }
  }

  return members;
}
