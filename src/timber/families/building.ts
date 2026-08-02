// TIMBER-2 — the building family generator (plan §3.2, C-10).
//
// C-10 in practice: `floor.ts`, `walls.ts` and `roof.ts` ARE the frozen legacy branch. They
// are not rewritten here and not edited — the compat goldens pin their output byte for byte,
// and editing them is a stop-the-line event. What this module does is:
//
//   1. translate a `BuildingSpec` into the legacy generators' inputs,
//   2. call them in the legacy order (C-6: emission order is part of the contract),
//   3. publish the C-4 wall contract (`bearings`, `surfaces`) that everything downstream —
//      coverings, second stories, the platform family — consumes instead of re-deriving the
//      placement convention a third time by hand.
//
// New capability (shed/flat roofs, coverings, slab/skids) arrives as SIBLING code that reads
// the same contract. The frozen path is never in its way.

import type { Member } from '../types';
import type { BuildingSpec, RoofSpec } from '../spec';
import { WALL_ORDER, toLegacySpacing } from '../spec';
import type { StagePlanEntry } from '../stagePlan';
import { stagePlanForLegacyBuilding } from '../stagePlan';
import { generateFloor, floorLevels, type FloorInput, type FloorLevels } from '../floor';
import { generateWalls, type Opening } from '../walls';
import { generateRoof } from '../roof';
import { wallContract, type WallsContract } from '../subsystems/wallSystem';

export interface BuildingResult {
  members: Member[];
  levels: FloorLevels;
  stagePlan: StagePlanEntry[];
  walls: WallsContract;
}

/** True when this spec is exactly what the frozen legacy branch generates. */
export function isLegacyBuilding(spec: BuildingSpec): boolean {
  return (
    spec.stories.length === 1 &&
    spec.roof.kind === 'gable' &&
    (spec.foundation.kind === 'piers' || spec.foundation.kind === 'wall' || spec.foundation.kind === 'basement') &&
    !spec.openFront &&
    (!spec.partitions || spec.partitions.length === 0) &&
    spec.coverings.wallSheathing === 'none' &&
    spec.coverings.siding === 'none' &&
    spec.coverings.roofing === 'none' &&
    (spec.coverings.roofDeck === 'none' || spec.coverings.roofDeck === 'plywood')
  );
}

/** Spec openings → the legacy `Opening[]`, flattened in the const wall order (I-15). */
export function legacyOpenings(spec: BuildingSpec, storyIndex = 0): Opening[] {
  const story = spec.stories[storyIndex];
  if (!story) return [];
  const out: Opening[] = [];
  for (const wall of WALL_ORDER) {
    for (const o of story.openings[wall] ?? []) {
      out.push({
        wall,
        offsetFt: o.offsetFt,
        widthFt: o.widthFt,
        heightFt: o.heightFt,
        sillHeightFt: o.sillHeightFt,
        ...(o.headerNominal ? { headerNominal: o.headerNominal } : {}),
      });
    }
  }
  return out;
}

/** The legacy floor input a spec maps onto (the §2.4 migration table, in code). */
export function legacyFloorInput(spec: BuildingSpec): FloorInput {
  const f = spec.foundation;
  return {
    lengthFt: spec.dims.lengthFt,
    widthFt: spec.dims.widthFt,
    joistSpacingIn: toLegacySpacing(spec.spacing.joistSpacingIn),
    crawlFt: f.kind === 'piers' || f.kind === 'wall' ? f.crawlFt : undefined,
    foundation: f.kind === 'basement' ? 'basement' : f.kind === 'wall' ? 'wall' : 'piers',
    basementDepthFt: f.kind === 'basement' ? f.depthFt : undefined,
    bridging: spec.bridging,
    stairs: f.kind === 'basement' ? f.stairs : undefined,
  };
}

function gableOf(roof: RoofSpec): { risePer12: number; overhangFt: number } {
  // Only the legacy path calls this, and `isLegacyBuilding` has already established gable.
  if (roof.kind === 'gable' || roof.kind === 'shed' || roof.kind === 'hip' || roof.kind === 'pyramid') {
    return { risePer12: roof.risePer12, overhangFt: roof.overhangFt };
  }
  return { risePer12: 0, overhangFt: roof.kind === 'flat' ? roof.overhangFt : 0 };
}

/**
 * Generate a one-story building through the frozen legacy branch, in the legacy emission
 * order: floor → walls → roof. Every byte of this path is pinned by `test/goldens/frame/`.
 */
export function generateBuilding(spec: BuildingSpec): BuildingResult {
  const floorInput = legacyFloorInput(spec);
  const story = spec.stories[0]!;
  const { risePer12, overhangFt } = gableOf(spec.roof);

  const members: Member[] = [
    ...generateFloor(floorInput),
    ...generateWalls({
      lengthFt: spec.dims.lengthFt,
      widthFt: spec.dims.widthFt,
      wallHeightFt: story.wallHeightFt,
      studSpacingIn: toLegacySpacing(spec.spacing.studSpacingIn),
      openings: legacyOpenings(spec),
      letInBracing: story.letInBracing,
    }),
    ...generateRoof({
      lengthFt: spec.dims.lengthFt,
      widthFt: spec.dims.widthFt,
      wallHeightFt: story.wallHeightFt,
      risePer12,
      rafterSpacingIn: toLegacySpacing(spec.spacing.rafterSpacingIn),
      overhangFt,
      atticAccess: spec.atticAccess,
    }),
  ];

  return {
    members,
    levels: floorLevels(floorInput),
    stagePlan: stagePlanForLegacyBuilding(),
    walls: wallContract(spec.dims.lengthFt, spec.dims.widthFt, story.wallHeightFt, story.openings),
  };
}
