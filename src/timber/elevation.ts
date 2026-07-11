// TIMBER-1 engine — 2D projections of Member[] (design doc §3.3, §11.4). Pure geometry, no
// SVG/DOM: the render layer draws whatever this returns, so 2D and 3D come from the same
// members by construction (the §9 count-parity test locks that in).

import type { Member, WallId } from './types';

const FT = 12;
const T = 1.5 / FT; // dressed 2x4 thickness, feet

// Wall frames must match walls.ts placement exactly (start = left end viewed from OUTSIDE).
function wallFrame(wall: WallId, lengthFt: number, widthFt: number): { start: [number, number]; dir: [number, number]; runFt: number } {
  switch (wall) {
    case 'S': return { start: [0, 0], dir: [1, 0], runFt: lengthFt };
    case 'N': return { start: [lengthFt, widthFt], dir: [-1, 0], runFt: lengthFt };
    case 'E': return { start: [lengthFt, T / 2], dir: [0, 1], runFt: widthFt - T };
    case 'W': return { start: [0, widthFt - T / 2], dir: [0, -1], runFt: widthFt - T };
  }
}

export interface ElevationRect {
  memberId: string;
  role: string;
  // Wall-local coordinates, feet: u along the wall (0 = left end viewed from outside),
  // v vertical (0 = sole plate bottom). Rect spans [u0,u1] × [v0,v1].
  u0: number; u1: number; v0: number; v1: number;
}

export interface WallElevation {
  wall: WallId;
  runFt: number;
  heightFt: number;
  rects: ElevationRect[];
}

// Project a wall's members onto its plane. Vertical members become (thickness × cutLength)
// rects, horizontal ones (cutLength × depth-or-thickness) — derived from role orientation,
// which is fixed by the generator (plates/sills flat, studs vertical, headers on edge).
export function wallElevation(members: Member[], wall: WallId, lengthFt: number, widthFt: number, wallHeightFt: number): WallElevation {
  const f = wallFrame(wall, lengthFt, widthFt);
  const rects: ElevationRect[] = [];
  for (const m of members) {
    if (m.wall !== wall) continue;
    const rel: [number, number] = [m.position[0] - f.start[0], m.position[2] - f.start[1]];
    const u = rel[0] * f.dir[0] + rel[1] * f.dir[1]; // distance along the wall to member center
    const y = m.position[1];
    const lenFt = m.cutLength / FT;
    const wFt = m.actual.w / FT; // thickness
    const dFt = m.actual.d / FT; // face width
    const vertical = m.role === 'stud' || m.role === 'kingStud' || m.role === 'jackStud' || m.role === 'cripple';
    const flat = m.role === 'solePlate' || m.role === 'topPlate' || m.role === 'capPlate' || m.role === 'sill';
    if (vertical) {
      rects.push({ memberId: m.id, role: m.role, u0: u - wFt / 2, u1: u + wFt / 2, v0: y - lenFt / 2, v1: y + lenFt / 2 });
    } else if (flat) {
      rects.push({ memberId: m.id, role: m.role, u0: u - lenFt / 2, u1: u + lenFt / 2, v0: y - wFt / 2, v1: y + wFt / 2 });
    } else {
      // headers (on edge): face width is vertical
      rects.push({ memberId: m.id, role: m.role, u0: u - lenFt / 2, u1: u + lenFt / 2, v0: y - dFt / 2, v1: y + dFt / 2 });
    }
  }
  return { wall, runFt: f.runFt, heightFt: wallHeightFt, rects };
}

// Layout Strip (design doc §11.4): the plate as a tape measure — the marks a carpenter would
// pencil on the plate. X at common stud centers, K/J at kings/jacks, C at cripple lines.
export interface LayoutMark {
  atIn: number; // inches from the wall's left end to the member CENTER
  kind: 'X' | 'K' | 'J' | 'C';
  memberId: string;
}

export function layoutStrip(members: Member[], wall: WallId, lengthFt: number, widthFt: number): LayoutMark[] {
  const elev = wallElevation(members, wall, lengthFt, widthFt, 0);
  const kindFor: Record<string, LayoutMark['kind'] | undefined> = {
    stud: 'X',
    kingStud: 'K',
    jackStud: 'J',
    cripple: 'C',
  };
  const marks: LayoutMark[] = [];
  const seen = new Set<string>();
  for (const r of elev.rects) {
    const kind = kindFor[r.role];
    if (!kind) continue;
    const at = Math.round(((r.u0 + r.u1) / 2) * FT * 8) / 8;
    const key = `${kind}@${at}`; // cripples above/below share one plate mark
    if (seen.has(key)) continue;
    seen.add(key);
    marks.push({ atIn: at, kind, memberId: r.memberId });
  }
  return marks.sort((a, b) => a.atIn - b.atIn);
}
