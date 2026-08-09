// TIMBER-2 — the wall system's PUBLISHED CONTRACT (plan C-4).
//
// The problem this solves: where a wall actually sits — inset half its thickness inside the
// floor edge, N/S running through, E/W butting between — was knowledge that lived in
// `walls.ts`, was hand-copied into `elevation.ts`, and would have been hand-copied a third
// time by coverings and a fourth by the second-story floor. Every copy is a chance to drift,
// and the drift shows up as siding that misses the wall by 1.75 inches.
//
// So the wall system OWNS the convention and EXPORTS it:
//
//   bearings   the lines a floor above can bear on (cap-plate top, with its run) — a second
//              story or a ceiling never re-derives where the walls were.
//   surfaces   each wall as a plane with its extent and its OPENING CUTOUTS — sheathing and
//              siding tile against this and subtract these, and a test asserts the cutouts
//              equal the spec's openings (so "the hole in the siding is where the window is"
//              is checked, not assumed).
//
// Pure geometry, no members: the frozen `walls.ts` still emits the framing. This module says
// where that framing IS.

import type { WallId } from '../types';
import { DRESSED } from '../types';
import type { OpeningSpec, WallOpenings } from '../spec';
import { WALL_ORDER } from '../spec';

const FT = 12;
const WALL_THICK_FT = DRESSED['2x4']!.d / FT; // 3.5 in — a 2x4 wall's real thickness
const PLATE_THICK_FT = DRESSED['2x4']!.w / FT; // 1.5 in

/** A line something above can bear on. */
export interface BearingLine {
  id: string;
  wall?: WallId;
  /** Both endpoints in plan, feet. */
  from: [x: number, z: number];
  to: [x: number, z: number];
  topY: number; // bearing elevation, feet
  kind: 'plate' | 'girder' | 'sill' | 'capBeam' | 'skid';
}

/** A wall plane, in the wall's own (u along the run, v up) coordinates. */
export interface WallSurface {
  wall: WallId;
  runFt: number; // clear run of this wall
  heightFt: number; // sole-plate bottom to cap-plate top
  /** Outward normal in plan (unit). */
  normal: [x: number, z: number];
  /** Plan position of u=0 (the wall's left end viewed from OUTSIDE). */
  origin: [x: number, z: number];
  /** Unit direction of increasing u, in plan. */
  along: [x: number, z: number];
  /** Outside-face offset from the wall centerline, feet. */
  faceOffsetFt: number;
  cutouts: SurfaceCutout[];
}

export interface SurfaceCutout {
  openingIndex: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export interface WallsContract {
  thicknessFt: number;
  plateThicknessFt: number;
  plateTopY: number;
  bearings: BearingLine[];
  surfaces: WallSurface[];
}

/**
 * The wall frames, matching `walls.ts` placement EXACTLY. This is the one definition; the
 * legacy generator's own copy is the frozen branch and `test/timber2-walls-contract.test.ts`
 * asserts the two agree by checking real emitted members against these surfaces.
 */
export function wallFrames(lengthFt: number, widthFt: number): {
  wall: WallId; origin: [number, number]; along: [number, number]; normal: [number, number]; runFt: number;
}[] {
  const d = WALL_THICK_FT;
  return [
    { wall: 'S', origin: [0, d / 2], along: [1, 0], normal: [0, -1], runFt: lengthFt },
    { wall: 'N', origin: [lengthFt, widthFt - d / 2], along: [-1, 0], normal: [0, 1], runFt: lengthFt },
    { wall: 'E', origin: [lengthFt - d / 2, d], along: [0, 1], normal: [1, 0], runFt: widthFt - 2 * d },
    { wall: 'W', origin: [d / 2, widthFt - d], along: [0, -1], normal: [-1, 0], runFt: widthFt - 2 * d },
  ];
}

/**
 * Compute the contract for one story. `wallHeightFt` is the frame height (sole-plate bottom
 * to cap-plate top), matching the legacy generator's definition exactly.
 */
export function wallContract(
  lengthFt: number,
  widthFt: number,
  wallHeightFt: number,
  openings: WallOpenings | undefined,
  baseY = 0,
  /**
   * Full-run bands that are NOT openings but still interrupt the wall covering — the SEA hut's
   * screened band is the first one. They enter as cutouts because that is what they are to
   * anything laid on the wall: the siding is cut around a screened band exactly the way it is
   * cut around a window, and a band the siding covers over is a band that does not exist.
   * Measured from the sole-plate TOP, like an opening's sill, so callers use one convention.
   */
  bands: { v0: number; v1: number }[] = [],
): WallsContract {
  const surfaces: WallSurface[] = [];
  const bearings: BearingLine[] = [];
  const plateTopY = baseY + wallHeightFt;

  for (const f of wallFrames(lengthFt, widthFt)) {
    const list: OpeningSpec[] = openings?.[f.wall] ?? [];
    const cutouts: SurfaceCutout[] = list.map((o, i) => ({
      openingIndex: i,
      u0: o.offsetFt,
      u1: o.offsetFt + o.widthFt,
      // v is measured from the sole-plate BOTTOM; the legacy generator measures rough
      // openings from the sole-plate TOP, so add the plate thickness once, here, where the
      // convention is owned.
      v0: PLATE_THICK_FT + o.sillHeightFt,
      v1: PLATE_THICK_FT + o.sillHeightFt + o.heightFt,
    }));
    for (const band of bands) {
      cutouts.push({
        // Negative indices: a band is not an entry in the openings array, and giving it a real
        // index would make `openingIndex` ambiguous for anything that resolves it back.
        openingIndex: -1 - cutouts.length,
        u0: 0,
        u1: f.runFt,
        v0: PLATE_THICK_FT + band.v0,
        v1: PLATE_THICK_FT + band.v1,
      });
    }
    surfaces.push({
      wall: f.wall,
      runFt: f.runFt,
      heightFt: wallHeightFt,
      normal: f.normal as [number, number],
      origin: f.origin as [number, number],
      along: f.along as [number, number],
      faceOffsetFt: WALL_THICK_FT / 2,
      cutouts,
    });
    bearings.push({
      id: `plate-${f.wall}`,
      wall: f.wall,
      from: [f.origin[0]!, f.origin[1]!],
      to: [f.origin[0]! + f.along[0]! * f.runFt, f.origin[1]! + f.along[1]! * f.runFt],
      topY: plateTopY,
      kind: 'plate',
    });
  }

  return {
    thicknessFt: WALL_THICK_FT,
    plateThicknessFt: PLATE_THICK_FT,
    plateTopY,
    bearings,
    surfaces: WALL_ORDER.map((w) => surfaces.find((s) => s.wall === w)!),
  };
}

/** Plan-space point for a (u, v) on a wall surface, at its outside face. */
export function surfacePoint(s: WallSurface, u: number, v: number): [number, number, number] {
  const x = s.origin[0] + s.along[0] * u + s.normal[0] * s.faceOffsetFt;
  const z = s.origin[1] + s.along[1] * u + s.normal[1] * s.faceOffsetFt;
  return [x, v, z];
}

/** Yaw that turns a +X-aligned member onto this wall's run (matches the legacy convention). */
export function surfaceYaw(s: WallSurface): number {
  return Math.atan2(-s.along[1], s.along[0]);
}
