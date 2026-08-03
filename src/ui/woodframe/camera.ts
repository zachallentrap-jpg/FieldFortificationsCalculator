// TIMBER-2 — camera rigs (plan §4.3).
//
// The fit is computed against the TRUE member AABB — including everything below grade, which
// is the part heuristics get wrong. A basement building's members run 8 feet under the floor;
// a rig that frames only the above-ground box puts the foundation off-screen exactly when the
// user switched to the foundation stage to look at it.
//
// So: real AABB, the ACTUAL shipping camera (fov 40, live aspect), and the 5% margin inside
// the formula rather than applied afterward by eye. Pure — no three.js — so the framing is
// node-testable over every catalog preset and the fuzz corpus.

import type { Member } from '../../timber/types';
import type { Aabb } from './cutaway';

export interface CameraRig {
  id: string;
  label: string;
  kind: 'perspective' | 'orthographic';
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  /** Orthographic half-width needed to frame the model. */
  orthoHalf?: number;
}

export const FOV_DEG = 40;
const MARGIN = 1.05; // 5%, inside the formula

/**
 * World-axis half-extents of one member's oriented box.
 *
 * The member frame is length along local X, face width along local Y, thickness along local Z,
 * with a YXZ euler — the same convention the scene uses to place the mesh. Each world axis gets
 * `Σ|R[i][j]| · h[j]`, the standard OBB→AABB projection.
 *
 * Doing this properly matters more than it looks: treating the half-LENGTH as an isotropic
 * reach (the obvious shortcut) inflates a 48-ft girder into a 48-ft-tall box, and the camera
 * then frames a phantom the size of the building's longest member cubed. That is exactly the
 * bug this replaced — the model rendered as a toy in the middle of an empty viewport.
 */
function memberHalfExtents(m: Member): [number, number, number] {
  const hx = m.cutLength / 12 / 2;
  const hy = m.actual.d / 12 / 2;
  const hz = m.actual.w / 12 / 2;
  const [rx, ry, rz] = m.rotation;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Ry · Rx · Rz, applied to a local vector (matches rotation.order = 'YXZ').
  const r00 = cy * cz + sy * sx * sz;
  const r01 = -cy * sz + sy * sx * cz;
  const r02 = sy * cx;
  const r10 = cx * sz;
  const r11 = cx * cz;
  const r12 = -sx;
  const r20 = -sy * cz + cy * sx * sz;
  const r21 = sy * sz + cy * sx * cz;
  const r22 = cy * cx;
  return [
    Math.abs(r00) * hx + Math.abs(r01) * hy + Math.abs(r02) * hz,
    Math.abs(r10) * hx + Math.abs(r11) * hy + Math.abs(r12) * hz,
    Math.abs(r20) * hx + Math.abs(r21) * hy + Math.abs(r22) * hz,
  ];
}

export function memberAabb(members: readonly Member[]): Aabb {
  if (members.length === 0) return { min: [0, 0, 0], max: [1, 1, 1] };
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const m of members) {
    const h = memberHalfExtents(m);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, m.position[i]! - h[i]!);
      max[i] = Math.max(max[i]!, m.position[i]! + h[i]!);
    }
  }
  return { min, max };
}

export function aabbCenter(b: Aabb): [number, number, number] {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

export function aabbSize(b: Aabb): [number, number, number] {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

/**
 * Distance at which a sphere of `radius` fits a perspective camera of `fovDeg` at `aspect`.
 * The horizontal FOV is the binding one on a wide model, which is why aspect is an input and
 * not an afterthought.
 *
 * This is the CONSERVATIVE fit — a sphere around a long building is far bigger than the
 * building, so it frames everything but leaves the model small. `fitDistanceForBox` below is
 * the one the rigs use; this stays because it is the safe fallback and the property the tests
 * pin (a sphere fit always contains a box fit).
 */
export function fitDistance(radius: number, fovDeg: number, aspect: number): number {
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.0001, aspect));
  const dV = radius / Math.sin(vFov / 2);
  const dH = radius / Math.sin(hFov / 2);
  return Math.max(dV, dH) * MARGIN;
}

/**
 * Tight fit: project the box's eight corners onto the camera's own right/up/forward axes and
 * pull back exactly far enough. A 48-ft building viewed from a corner needs a fraction of the
 * distance its bounding SPHERE implies — using the sphere left the model as a toy in the
 * middle of the viewport, which is not what "fit to model" means to anyone looking at it.
 */
export function fitDistanceForBox(
  bounds: Aabb,
  dir: readonly [number, number, number],
  up: readonly [number, number, number],
  fovDeg: number,
  aspect: number,
): number {
  const dlen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const f: [number, number, number] = [-dir[0] / dlen, -dir[1] / dlen, -dir[2] / dlen]; // view forward
  let r: [number, number, number] = [
    f[1] * up[2] - f[2] * up[1],
    f[2] * up[0] - f[0] * up[2],
    f[0] * up[1] - f[1] * up[0],
  ];
  const rlen = Math.hypot(r[0], r[1], r[2]);
  if (rlen < 1e-9) r = [1, 0, 0];
  else r = [r[0] / rlen, r[1] / rlen, r[2] / rlen];
  const u: [number, number, number] = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];

  const c = aabbCenter(bounds);
  let halfR = 0;
  let halfU = 0;
  let halfF = 0;
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const d: [number, number, number] = [x - c[0], y - c[1], z - c[2]];
        halfR = Math.max(halfR, Math.abs(d[0] * r[0] + d[1] * r[1] + d[2] * r[2]));
        halfU = Math.max(halfU, Math.abs(d[0] * u[0] + d[1] * u[1] + d[2] * u[2]));
        halfF = Math.max(halfF, Math.abs(d[0] * f[0] + d[1] * f[1] + d[2] * f[2]));
      }
    }
  }
  const vFov = (fovDeg * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * Math.max(0.0001, aspect);
  // Pull back far enough for both axes, then clear the near half of the model itself.
  return Math.max(halfU / tanV, halfR / tanH) * MARGIN + halfF;
}

/** Bounding-sphere radius of an AABB. */
export function boundingRadius(b: Aabb): number {
  const [sx, sy, sz] = aabbSize(b);
  return Math.max(1e-6, Math.hypot(sx, sy, sz) / 2);
}

const ISO_DIRS: [string, string, [number, number, number]][] = [
  ['iso-ne', 'Iso NE', [1, 0.62, -1]],
  ['iso-nw', 'Iso NW', [-1, 0.62, -1]],
  ['iso-se', 'Iso SE', [1, 0.62, 1]],
  ['iso-sw', 'Iso SW', [-1, 0.62, 1]],
];

/**
 * Every standard view for a model. `Elev` is added for tall-and-narrow structures (a tower is
 * unreadable from an iso that frames its footprint), per plan §4.3.
 */
export function cameraRigsFor(members: readonly Member[], aspect = 16 / 9): CameraRig[] {
  const bounds = memberAabb(members);
  const center = aabbCenter(bounds);
  const [sx, sy, sz] = aabbSize(bounds);
  const radius = boundingRadius(bounds);
  const dist = fitDistance(radius, FOV_DEG, aspect);
  const orthoHalf = (Math.max(sx, sy, sz) / 2) * MARGIN;

  const rigs: CameraRig[] = [];
  for (const [id, label, dir] of ISO_DIRS) {
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    const unit: [number, number, number] = [dir[0] / len, dir[1] / len, dir[2] / len];
    const d = fitDistanceForBox(bounds, unit, [0, 1, 0], FOV_DEG, aspect);
    rigs.push({
      id,
      label,
      kind: 'perspective',
      position: [center[0] + unit[0] * d, center[1] + unit[1] * d, center[2] + unit[2] * d],
      target: center,
      up: [0, 1, 0],
    });
  }
  const orthoDist = radius * 3 + dist;
  rigs.push({
    id: 'plan',
    label: 'Plan',
    kind: 'orthographic',
    position: [center[0], center[1] + orthoDist, center[2]],
    target: center,
    up: [0, 0, -1], // looking straight down: north is up the screen
    orthoHalf: (Math.max(sx, sz) / 2) * MARGIN,
  });
  rigs.push({
    id: 'front',
    label: 'Front',
    kind: 'orthographic',
    position: [center[0], center[1], center[2] + orthoDist],
    target: center,
    up: [0, 1, 0],
    orthoHalf: (Math.max(sx, sy) / 2) * MARGIN,
  });
  rigs.push({
    id: 'left',
    label: 'Left',
    kind: 'orthographic',
    position: [center[0] - orthoDist, center[1], center[2]],
    target: center,
    up: [0, 1, 0],
    orthoHalf: (Math.max(sz, sy) / 2) * MARGIN,
  });

  // Tall-and-narrow: an elevation that frames the HEIGHT, for towers.
  const plan = Math.max(sx, sz);
  if (sy > 1.5 * plan) {
    rigs.push({
      id: 'elev',
      label: 'Elev',
      kind: 'orthographic',
      position: [center[0], center[1], center[2] + orthoDist],
      target: center,
      up: [0, 1, 0],
      orthoHalf: (sy / 2) * MARGIN,
    });
  }
  return rigs;
}

/**
 * Does this rig actually frame the model? The acceptance test for §4.3 — run over every
 * preset, the fuzz corpus, and the pinned extremes.
 */
export function rigFramesModel(rig: CameraRig, bounds: Aabb, aspect = 16 / 9): boolean {
  const corners: [number, number, number][] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push([x, y, z]);
    }
  }
  const fwd: [number, number, number] = [
    rig.target[0] - rig.position[0],
    rig.target[1] - rig.position[1],
    rig.target[2] - rig.position[2],
  ];
  const flen = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
  const f: [number, number, number] = [fwd[0] / flen, fwd[1] / flen, fwd[2] / flen];
  // Right = forward × up, then a true up = right × forward.
  const up = rig.up;
  const r: [number, number, number] = [
    f[1] * up[2] - f[2] * up[1],
    f[2] * up[0] - f[0] * up[2],
    f[0] * up[1] - f[1] * up[0],
  ];
  const rlen = Math.hypot(r[0], r[1], r[2]) || 1;
  const rn: [number, number, number] = [r[0] / rlen, r[1] / rlen, r[2] / rlen];
  const un: [number, number, number] = [
    rn[1] * f[2] - rn[2] * f[1],
    rn[2] * f[0] - rn[0] * f[2],
    rn[0] * f[1] - rn[1] * f[0],
  ];

  const vFov = (FOV_DEG * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * aspect;

  for (const c of corners) {
    const d: [number, number, number] = [c[0] - rig.position[0], c[1] - rig.position[1], c[2] - rig.position[2]];
    const depth = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    const right = d[0] * rn[0] + d[1] * rn[1] + d[2] * rn[2];
    const upv = d[0] * un[0] + d[1] * un[1] + d[2] * un[2];
    if (rig.kind === 'perspective') {
      if (depth <= 0) return false; // behind the camera
      if (Math.abs(right) > tanH * depth + 1e-9) return false;
      if (Math.abs(upv) > tanV * depth + 1e-9) return false;
    } else {
      const half = rig.orthoHalf ?? 1;
      // Orthographic: the wider screen axis gets `half`, the other is scaled by aspect.
      if (Math.abs(right) > half * Math.max(1, aspect) + 1e-9) return false;
      if (Math.abs(upv) > half + 1e-9) return false;
    }
  }
  return true;
}
