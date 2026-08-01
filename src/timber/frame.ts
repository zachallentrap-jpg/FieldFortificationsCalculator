// TIMBER-1 engine — FrameModel assembly (design doc §1). One call composes every generator
// into the single Member[] all consumers project from. Pure and deterministic.

import type { Member } from './types';
import { generateFloor, floorLevels, stairPlan, type FloorLevels, type FoundationType, type BridgingType } from './floor';
import { generateWalls, type Opening } from './walls';
import { generateRoof } from './roof';

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

export function generateFrame(input: BuildingInput): FrameModel {
  const floorInput = {
    lengthFt: input.lengthFt,
    widthFt: input.widthFt,
    joistSpacingIn: input.joistSpacingIn,
    crawlFt: input.crawlFt,
    foundation: input.foundation,
    basementDepthFt: input.basementDepthFt,
    bridging: input.bridging,
    stairs: input.stairs,
  };
  const members: Member[] = [
    ...generateFloor(floorInput),
    ...generateWalls({
      lengthFt: input.lengthFt,
      widthFt: input.widthFt,
      wallHeightFt: input.wallHeightFt,
      studSpacingIn: input.studSpacingIn,
      openings: input.openings,
      letInBracing: input.letInBracing,
    }),
    ...generateRoof({
      lengthFt: input.lengthFt,
      widthFt: input.widthFt,
      wallHeightFt: input.wallHeightFt,
      risePer12: input.risePer12,
      rafterSpacingIn: input.rafterSpacingIn,
      overhangFt: input.overhangFt,
      atticAccess: input.atticAccess,
    }),
  ];
  return {
    input,
    members,
    levels: floorLevels(floorInput),
  };
}

export { stairPlan };
export type { FoundationType, BridgingType };
