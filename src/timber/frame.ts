// TIMBER-1 engine — FrameModel assembly (design doc §1), now the TIMBER-2 compatibility port.
//
// The API below is FROZEN: `BuildingInput` in, the same `Member[]` out, byte for byte. What
// changed underneath is that `generateFrame` no longer composes the generators itself — it
// maps its input onto a `BuildingSpec` and delegates to `generateStructure`, which is the one
// entry point every new family also goes through.
//
// `specFromBuildingInput` is the migration table from plan §2.4 written as code, and
// `test/timber2-compat.test.ts` runs the demo building through it and asserts the result
// deep-equals the goldens snapshotted before any of this existed.

import type { Member } from './types';
import { stairPlan, type FloorLevels, type FoundationType, type BridgingType } from './floor';
import type { Opening } from './walls';
import type { BuildingSpec, WallOpenings } from './spec';
import { WALL_ORDER } from './spec';
import { generateStructure } from './families/index';

export interface BuildingInput {
  lengthFt: number;
  widthFt: number;
  wallHeightFt: number;
  studSpacingIn: 16 | 24;
  joistSpacingIn: 16 | 24;
  rafterSpacingIn: 16 | 24;
  risePer12: number; // roof pitch, inches per foot of run
  overhangFt: number;
  crawlFt: number;
  openings: Opening[];
  // Teaching options (each swaps in the corresponding FM 5-426 lesson; all optional so the
  // defaults reproduce the plain pier-founded building).
  foundation?: FoundationType; // 'piers' (default) | 'wall' | 'basement'
  basementDepthFt?: number; // sill bottom to slab top, default 7.5
  bridging?: BridgingType; // 'cross' (default) | 'solid'
  stairs?: boolean; // basement stair + framed floor opening (default: foundation === 'basement')
  letInBracing?: boolean; // 1x4 let-in corner braces, stage 6
  atticAccess?: boolean; // framed scuttle in the ceiling joists, stage 7
}

export interface FrameModel {
  input: BuildingInput;
  members: Member[];
  levels: FloorLevels; // vertical datum info (grade line for the render layer's ground)
}

/**
 * The §2.4 migration table, in code. Two details carry the compat lock:
 *
 *   Order — openings are grouped per wall in the const wall order and kept in their supplied
 *   sequence inside each wall. The legacy generator walks walls in that same order and emits
 *   opening framing in array order, and per-role id counters bake both in (TD5).
 *
 *   Defaults — `stairs` defaults to TRUE under a basement, matching `floor.ts`. Reproducing a
 *   default wrong is how a "pure refactor" quietly changes what the tool builds.
 */
export function specFromBuildingInput(input: BuildingInput): BuildingSpec {
  const openings: WallOpenings = {};
  for (const wall of WALL_ORDER) {
    const forWall = input.openings.filter((o) => o.wall === wall);
    if (forWall.length === 0) continue;
    openings[wall] = forWall.map((o) => ({
      // A rough opening with a sill is a window; one that starts at the plate is a door.
      kind: o.sillHeightFt > 0 ? ('window' as const) : ('door' as const),
      offsetFt: o.offsetFt,
      widthFt: o.widthFt,
      heightFt: o.heightFt,
      sillHeightFt: o.sillHeightFt,
      ...(o.headerNominal ? { headerNominal: o.headerNominal } : {}),
      fill: 'rough' as const,
    }));
  }

  const foundation: BuildingSpec['foundation'] =
    input.foundation === 'basement'
      ? { kind: 'basement', depthFt: input.basementDepthFt ?? 7.5, stairs: input.stairs ?? true }
      : input.foundation === 'wall'
        ? { kind: 'wall', crawlFt: input.crawlFt }
        : { kind: 'piers', crawlFt: input.crawlFt };

  return {
    family: 'building',
    dims: { lengthFt: input.lengthFt, widthFt: input.widthFt },
    spacing: {
      studSpacingIn: input.studSpacingIn,
      joistSpacingIn: input.joistSpacingIn,
      rafterSpacingIn: input.rafterSpacingIn,
    },
    coverings: { wallSheathing: 'none', siding: 'none', roofDeck: 'plywood', roofing: 'none' },
    stories: [{ wallHeightFt: input.wallHeightFt, openings, letInBracing: input.letInBracing }],
    roof: { kind: 'gable', risePer12: input.risePer12, overhangFt: input.overhangFt },
    foundation,
    bridging: input.bridging,
    atticAccess: input.atticAccess,
  };
}

export function generateFrame(input: BuildingInput): FrameModel {
  const model = generateStructure(specFromBuildingInput(input));
  return { input, members: model.members, levels: model.levels };
}

export { stairPlan };
export type { FoundationType, BridgingType };
