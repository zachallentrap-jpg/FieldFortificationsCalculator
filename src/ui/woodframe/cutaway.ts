// TIMBER-2 — the cutaway (plan §4.2, mandate #5: EVERY structure has one).
//
// A renderer CLIP PLANE, not member filtering. The difference matters: filtering can only
// remove whole members, so a 20-ft sill either vanishes or blocks the view. A clip plane cuts
// through the middle of the lumber, which is what a section drawing does and what makes the
// cut teach something — you see the actual thickness of the wall and how the floor meets it.
//
// The plane equation lives HERE, once, and is consumed by BOTH the renderer (as a
// THREE.Plane) and the raycaster's hit filter (`passesCut`). That single definition is why
// clicking through a cut selects what you SEE rather than the hidden member behind it — the
// two would drift apart instantly if each computed its own plane.
//
// Pure: no three.js import, so all of it is node-testable.

import type { CutawaySpec } from '../../timber/catalog';

export interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}

/** Plane in the standard form: normal·p + constant = 0. Positive side is KEPT. */
export interface PlaneEq {
  normal: [number, number, number];
  constant: number;
}

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

/**
 * The cut plane for a spec against a model's bounds. `frac` walks the cut along the axis from
 * min (0) to max (1); `keep` says which half survives.
 */
export function cutPlaneEq(spec: CutawaySpec, bounds: Aabb): PlaneEq {
  const i = AXIS_INDEX[spec.axis];
  const lo = bounds.min[i]!;
  const hi = bounds.max[i]!;
  const frac = Math.min(1, Math.max(0, spec.frac));
  const station = lo + (hi - lo) * frac;
  const normal: [number, number, number] = [0, 0, 0];
  normal[i] = spec.keep;
  // normal·p + constant = keep * (p[i] - station) — positive on the kept side.
  return { normal, constant: -spec.keep * station };
}

/** Is this point on the kept side? Points exactly on the plane count as kept. */
export function passesCut(point: readonly [number, number, number], eq: PlaneEq | null): boolean {
  if (!eq) return true; // no cut active — everything passes
  const d = eq.normal[0] * point[0] + eq.normal[1] * point[1] + eq.normal[2] * point[2] + eq.constant;
  return d >= 0;
}

/** Signed distance from the plane; negative means clipped away. */
export function signedDistance(point: readonly [number, number, number], eq: PlaneEq): number {
  return eq.normal[0] * point[0] + eq.normal[1] * point[1] + eq.normal[2] * point[2] + eq.constant;
}

/** The station (world coordinate along the cut axis) a spec resolves to. */
export function cutStation(spec: CutawaySpec, bounds: Aabb): number {
  const i = AXIS_INDEX[spec.axis];
  const lo = bounds.min[i]!;
  const hi = bounds.max[i]!;
  return lo + (hi - lo) * Math.min(1, Math.max(0, spec.frac));
}

// ── Axis vocabulary (plan §5.3: plain-first, compass in parentheses) ─────────

export type CutAxisId = 'front-rear' | 'left-right' | 'flat';

export interface CutAxisOption {
  id: CutAxisId;
  label: string; // what the chip says
  anchor: string; // what the depth slider measures FROM — the field ambiguity this kills
  axis: CutawaySpec['axis'];
  keep: 1 | -1;
}

export const CUT_AXES: readonly CutAxisOption[] = [
  { id: 'front-rear', label: 'Front–Rear (N–S)', anchor: 'from the front', axis: 'z', keep: -1 },
  { id: 'left-right', label: 'Left–Right (E–W)', anchor: 'from the left end', axis: 'x', keep: -1 },
  { id: 'flat', label: 'Flat (top-down)', anchor: 'above the sill', axis: 'y', keep: -1 },
] as const;

export function axisById(id: CutAxisId): CutAxisOption {
  return CUT_AXES.find((a) => a.id === id) ?? CUT_AXES[0]!;
}

/**
 * Cutaway view state. First activation of an axis starts at 50% depth (plan §5.3) and each
 * axis REMEMBERS its own depth, so flipping between axes does not reset the cut you set up.
 */
export interface CutawayState {
  active: CutAxisId | null;
  depth: Record<CutAxisId, number>;
}

export function initialCutawayState(): CutawayState {
  return { active: null, depth: { 'front-rear': 0.5, 'left-right': 0.5, flat: 0.5 } };
}

export function toggleAxis(state: CutawayState, id: CutAxisId): CutawayState {
  if (state.active === id) return { ...state, active: null };
  return { ...state, active: id };
}

export function setDepth(state: CutawayState, depth: number): CutawayState {
  if (!state.active) return state;
  const clamped = Math.min(1, Math.max(0, depth));
  return { ...state, depth: { ...state.depth, [state.active]: clamped } };
}

/** The live plane for a cutaway state, or null when no cut is active. */
export function planeForState(state: CutawayState, bounds: Aabb): PlaneEq | null {
  if (!state.active) return null;
  const axis = axisById(state.active);
  return cutPlaneEq({ axis: axis.axis, frac: state.depth[state.active], keep: axis.keep, reason: '' }, bounds);
}
