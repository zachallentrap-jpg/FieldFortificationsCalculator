// TIMBER-1 engine — FrameModel assembly (design doc §1). One call composes every generator
// into the single Member[] all consumers project from. Pure and deterministic.

import type { Member } from './types';
import { generateFloor, floorLevels, type FloorLevels } from './floor';
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
}

export interface FrameModel {
  input: BuildingInput;
  members: Member[];
  levels: FloorLevels; // vertical datum info (grade line for the render layer's ground)
}

export function generateFrame(input: BuildingInput): FrameModel {
  const members: Member[] = [
    ...generateFloor({
      lengthFt: input.lengthFt,
      widthFt: input.widthFt,
      joistSpacingIn: input.joistSpacingIn,
      crawlFt: input.crawlFt,
    }),
    ...generateWalls({
      lengthFt: input.lengthFt,
      widthFt: input.widthFt,
      wallHeightFt: input.wallHeightFt,
      studSpacingIn: input.studSpacingIn,
      openings: input.openings,
    }),
    ...generateRoof({
      lengthFt: input.lengthFt,
      widthFt: input.widthFt,
      wallHeightFt: input.wallHeightFt,
      risePer12: input.risePer12,
      rafterSpacingIn: input.rafterSpacingIn,
      overhangFt: input.overhangFt,
    }),
  ];
  return {
    input,
    members,
    levels: floorLevels({ lengthFt: input.lengthFt, widthFt: input.widthFt, joistSpacingIn: input.joistSpacingIn, crawlFt: input.crawlFt }),
  };
}
