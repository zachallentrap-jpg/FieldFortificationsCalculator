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
import { DRESSED } from '../types';
import type { BuildingSpec, RoofSpec } from '../spec';
import { WALL_ORDER, toLegacySpacing } from '../spec';
import type { StagePlanEntry } from '../stagePlan';
import { stagePlanForBuilding, requireOrdinal } from '../stagePlan';
import { generateFloor, floorLevels, type FloorInput, type FloorLevels } from '../floor';
import { generateWalls, type Opening } from '../walls';
import { generateRoof } from '../roof';
import { wallContract, type WallsContract } from '../subsystems/wallSystem';
import { roofPlanes, generateShed, generatePurlins, generateHip, wallInfillProfiles } from '../subsystems/roofFamilies';
import { generateRoofCovering, generateWallCovering, generateInfillCovering, generateSkids, generateSlabOnGrade, wallLayerThicknessFt, type InfillSurface } from '../subsystems/coverings';
import { generateFloorOnBearings, joistNominalFor } from '../subsystems/floorSystem';
import { generatePartitions } from '../subsystems/partitions';
import { LUMBER, PANEL, FOUNDATION, IN_PER_FT } from '../doctrine';
import { headerForSpan } from '../normalize';

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
      // HEADER SIZING (T8). Every opening used to get `LUMBER.headerNominal` no matter how wide
      // it was, so an 8-ft door carried the same 2x6 as a 3-ft window — which the span checker
      // found on our own storage-shed preset the day it was written. Sized HERE, at the
      // translation into the generator's input, rather than in normalization: normalizeSpec must
      // stay idempotent and must not write a value into the user's spec that then reads as a
      // decision they made. An explicit `headerNominal` on the opening always wins.
      //
      // This changes what `generateFrame` emits for any opening past the 2x6 row, which is a
      // compat-lock event: both golden sets move with this commit and DECISIONS records why.
      out.push({
        wall,
        offsetFt: o.offsetFt,
        widthFt: o.widthFt,
        heightFt: o.heightFt,
        sillHeightFt: o.sillHeightFt,
        headerNominal: o.headerNominal ?? headerForSpan(o.widthFt),
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
 * Generate a one-story building. The frozen legacy branch does the framing whenever the spec
 * describes what it already built — floor → walls → roof, in that emission order, every byte
 * pinned by `test/goldens/frame/`. Anything the frozen branch cannot express (a shed or flat
 * roof, skids, a slab) is framed by the sibling subsystems instead, and the coverings are
 * appended either way.
 */
export function generateBuilding(spec: BuildingSpec): BuildingResult {
  const story = spec.stories[0]!;
  const { lengthFt: L, widthFt: W } = spec.dims;
  const stagePlan = stagePlanForBuilding(spec.roof.kind, spec.foundation.kind);
  const walls = wallContract(L, W, story.wallHeightFt, story.openings, 0, spec.wallBands ?? []);
  const members: Member[] = [];
  let levels: FloorLevels;

  const grounded = spec.foundation.kind === 'skids' || spec.foundation.kind === 'slab';

  // ── Substructure + floor
  if (spec.foundation.kind === 'slab') {
    // The slab IS the floor: one pour, its top at y = 0 where the sole plates land. No joists
    // and no deck — this branch used to fall through to the framed floor below and emit a
    // suspended wood floor with nothing under it, and no concrete anywhere in the model.
    members.push(...generateSlabOnGrade(
      L, W, requireOrdinal(stagePlan, 'foundation'), requireOrdinal(stagePlan, 'floor'),
    ));
    const slabT = (FOUNDATION.slabThickIn.value as number) / IN_PER_FT;
    levels = { subfloorTop: 0, joistTop: 0, sillTop: 0, gradeY: -slabT };
  } else if (grounded) {
    const deckThick = PANEL.subfloorThickIn.value as number;
    const skidD = DRESSED[LUMBER.skidNominal.value as string]!.d / IN_PER_FT;
    const deckTopY = 0;
    members.push(...generateSkids(L, W, requireOrdinal(stagePlan, 'foundation')));
    members.push(
      ...generateFloorOnBearings({
        lengthFt: L,
        widthFt: W,
        joistSpacingIn: spec.spacing.joistSpacingIn,
        deckTopY,
        bearings: walls.bearings,
        deck: 'panel',
        stageFloor: requireOrdinal(stagePlan, 'floor'),
        stageDeck: requireOrdinal(stagePlan, 'subfloor'),
        prefix: 'FL',
      }),
    );
    const joistD = DRESSED[joistNominalFor(W)]!.d / IN_PER_FT;
    const joistTop = deckTopY - deckThick / IN_PER_FT;
    levels = {
      subfloorTop: 0,
      joistTop,
      sillTop: joistTop - joistD,
      gradeY: joistTop - joistD - skidD, // the runners are what this floor stands on
    };
  } else {
    const floorInput = legacyFloorInput(spec);
    members.push(...generateFloor(floorInput));
    levels = floorLevels(floorInput);
  }

  // ── Walls (always the frozen generator: rectangular walls, every roof kind)
  members.push(
    ...generateWalls({
      lengthFt: L,
      widthFt: W,
      wallHeightFt: story.wallHeightFt,
      studSpacingIn: toLegacySpacing(spec.spacing.studSpacingIn),
      openings: legacyOpenings(spec),
      letInBracing: story.letInBracing,
    }),
  );

  // ── Interior partitions. They go up with the walls and carry nothing, so they are framed
  // AFTER the exterior walls (which the frozen generator emits) and before the roof.
  members.push(...generatePartitions({
    spec, wallHeightFt: story.wallHeightFt, stage: requireOrdinal(stagePlan, 'walls'),
  }));

  // ── Roof frame
  if (spec.roof.kind === 'gable') {
    const { risePer12, overhangFt } = gableOf(spec.roof);
    members.push(
      ...generateRoof({
        lengthFt: L,
        widthFt: W,
        wallHeightFt: story.wallHeightFt,
        risePer12,
        rafterSpacingIn: toLegacySpacing(spec.spacing.rafterSpacingIn),
        overhangFt,
        atticAccess: spec.atticAccess,
      }),
    );
  } else if (spec.roof.kind === 'hip') {
    members.push(...generateHip({
      spec,
      walls,
      stageCeiling: requireOrdinal(stagePlan, 'ceiling'),
      stageRoofFrame: requireOrdinal(stagePlan, 'roof-frame'),
    }));
  } else if (spec.roof.kind === 'shed' || spec.roof.kind === 'flat') {
    members.push(...generateShed({ spec, walls, stageRoofFrame: requireOrdinal(stagePlan, 'roof-frame') }));
  }

  // ── Coverings. The gable's own stage-9 deck is emitted by the frozen roof generator
  // (C-9), so the covering pass only decks the NEW roof kinds — otherwise the roof would be
  // sheathed twice and the bill would double.
  const planes = roofPlanes(spec, walls.plateTopY);
  const rafterHalf = DRESSED[LUMBER.rafterNominal.value as string]!.d / IN_PER_FT / 2;
  const deckedByFrozenPath = spec.roof.kind === 'gable';
  // What the covering pass should PLACE, which is not the same question as what is there:
  // `deckLaidElsewhere` below tells it the gable's stage-9 deck already exists so its
  // thickness still lifts the roofing off the rafters.
  const deck = deckedByFrozenPath ? 'none' : spec.coverings.roofDeck;

  // A FROZEN-DECKED GABLE CANNOT TAKE PURLINS. Its stage-9 solid deck is part of the frozen
  // branch's output (C-9), not an option — so emitting purlins too would double the deck
  // system on the roof and on the bill. Under a gable the purlin choice resolves to the deck
  // that is actually there, and the config panel does not offer it in the first place.
  if (spec.coverings.roofDeck === 'purlins' && !deckedByFrozenPath && planes.length > 0) {
    // Purlins sit ON the rafters — the lift is the same half-depth the sheet deck gets.
    members.push(...generatePurlins(planes, requireOrdinal(stagePlan, 'roof-deck'), rafterHalf));
  }
  if (planes.length > 0 && (deck !== 'none' || spec.coverings.roofing !== 'none')) {
    members.push(
      ...generateRoofCovering({
        planes,
        // 'purlins' passes through UN-mapped: the covering module emits nothing for it (the
        // rows above are the deck) but counts its thickness, so the roofing lands on the
        // purlins instead of floating at rafter height with the hips poking through.
        deck: deckedByFrozenPath && spec.coverings.roofDeck === 'purlins' ? 'plywood' : spec.coverings.roofDeck,
        deckLaidElsewhere: deckedByFrozenPath,
        roofing: spec.coverings.roofing,
        buildingPaper: spec.coverings.buildingPaper,
        stageDeck: requireOrdinal(stagePlan, 'roof-deck'),
        stageRoofing: requireOrdinal(stagePlan, 'roofing'),
        rafterHalfFt: rafterHalf,
      }),
    );
  }
  // What each wall must close in above its cap plate — a gable end's triangle, a shed's pony
  // wall and rakes. Resolved once here and skinned by whichever coverings are on, so the
  // sheathing and the siding agree about where the building stops.
  const infill: InfillSurface[] = wallInfillProfiles(spec, walls).flatMap((p) => {
    const s = walls.surfaces.find((q) => q.wall === p.wall);
    return s ? [{
      wall: s.wall,
      runFt: s.runFt,
      baseYFt: walls.plateTopY,
      topAt: p.topAt,
      normal: s.normal,
      origin: s.origin,
      along: s.along,
      faceOffsetFt: s.faceOffsetFt,
    }] : [];
  });

  if (spec.coverings.wallSheathing !== 'none') {
    const kind = spec.coverings.wallSheathing === 'boards' ? 'boards' : 'plywood';
    members.push(
      ...generateWallCovering({
        surfaces: walls.surfaces,
        kind,
        role: 'sheathingPanel',
        stage: requireOrdinal(stagePlan, 'siding'),
        standoffFt: 0,
      }),
      ...generateInfillCovering({
        surfaces: infill, kind, role: 'sheathingPanel',
        stage: requireOrdinal(stagePlan, 'siding'), standoffFt: 0,
      }),
    );
  }
  if (spec.coverings.siding !== 'none') {
    // The standoff is the SHEATHING's own thickness, not the siding's. Board sheathing is ¾ in
    // where plywood is ½, and holding the siding out by the wrong one buried it a quarter inch
    // inside the layer it is nailed to.
    const sheathingThick = spec.coverings.wallSheathing !== 'none'
      ? wallLayerThicknessFt(spec.coverings.wallSheathing === 'boards' ? 'boards' : 'plywood')
      : 0;
    const kind = spec.coverings.siding === 'boardAndBatten' ? 'boardAndBatten'
      : spec.coverings.siding === 'boards' ? 'boards' : 'plywood';
    members.push(
      ...generateWallCovering({
        surfaces: walls.surfaces,
        kind,
        role: 'siding',
        stage: requireOrdinal(stagePlan, 'siding'),
        standoffFt: sheathingThick,
      }),
      ...generateInfillCovering({
        surfaces: infill, kind, role: 'siding',
        stage: requireOrdinal(stagePlan, 'siding'), standoffFt: sheathingThick,
      }),
    );
  }

  return { members, levels, stagePlan, walls };
}
