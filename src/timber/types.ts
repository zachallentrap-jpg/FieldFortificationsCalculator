// TIMBER-1 engine — the FrameModel data model (docs/TIMBER1_3D_SYSTEM_DESIGN.md §1.1).
// The Member[] the generators emit is the SINGLE source of truth: the 3D scene, 2D drawings,
// cut list/BOM, and labor plan are all projections of this array — nothing downstream invents
// geometry. Pure types, no DOM, no three.js (SAP-1 engine discipline).

export type MemberRole =
  | 'sill' | 'girder' | 'post' | 'joist' | 'rimJoist' | 'bridging' | 'subfloor'
  | 'solePlate' | 'stud' | 'cripple' | 'jackStud' | 'kingStud' | 'header'
  | 'topPlate' | 'capPlate' | 'brace' | 'rafter' | 'ridge' | 'collarTie'
  | 'sheathingPanel' | 'roofPanel' | 'siding';

export type WallId = 'N' | 'S' | 'E' | 'W';

// FM 5-426 construction order (design doc §2.1) — the stage scrubber's spine.
export const STAGES = [
  { id: 1, name: 'Layout & foundation' },
  { id: 2, name: 'Sills & girders' },
  { id: 3, name: 'Floor joists & bridging' },
  { id: 4, name: 'Subfloor' },
  { id: 5, name: 'Wall framing' },
  { id: 6, name: 'Plates tied & braced' },
  { id: 7, name: 'Ceiling joists' },
  { id: 8, name: 'Rafters & ridge' },
  { id: 9, name: 'Roof sheathing' },
  { id: 10, name: 'Roofing' },
  { id: 11, name: 'Siding & exterior finish' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];

export interface Member {
  id: string; // stable: "S-stud-014"
  role: MemberRole;
  nominal: string; // "2x4", "2x10", "6x8 built-up(3)", "4x8 panel"
  actual: { w: number; d: number }; // dressed inches (FM 5-426 Table 2-1): w = thickness, d = face width
  cutLength: number; // inches, exact (incl. angle allowances)
  angles?: { plumbCut?: number; seatCut?: number; miter?: number };
  // Member CENTER in feet; building origin at the front-left sill corner (front = south wall).
  position: [x: number, y: number, z: number];
  // Euler radians, order 'YXZ' (yaw about world Y first). Canonical member frame matches the
  // lumber prop: length along local X, face width along local Y, thickness along local Z.
  rotation: [rx: number, ry: number, rz: number];
  stage: StageId;
  wall?: WallId;
  grade: string; // "No. 2 common" default per FM 5-426
  nailing: string; // e.g. "2-16d toenail ea end"
  doctrineRef: string; // page cite, e.g. "FM 5-426 Table 6-2, p.6-17"
  count?: number; // for instanced identical members
}

// Dressed sizes, inches (FM 5-426 Table 2-1 values for common dimension lumber).
export const DRESSED: Record<string, { w: number; d: number }> = {
  '2x4': { w: 1.5, d: 3.5 },
  '2x6': { w: 1.5, d: 5.5 },
  '2x8': { w: 1.5, d: 7.25 },
  '2x10': { w: 1.5, d: 9.25 },
  '2x12': { w: 1.5, d: 11.25 },
  '4x4': { w: 3.5, d: 3.5 },
};
