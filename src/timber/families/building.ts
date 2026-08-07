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
import { stagePlanForBuilding, requireOrdinal, ordinalOf } from '../stagePlan';
import { generateFloor, floorLevels, type FloorInput, type FloorLevels } from '../floor';
import { generateWalls, type Opening } from '../walls';
import { generateRoof } from '../roof';
import { wallContract, type WallsContract, type WallSurface } from '../subsystems/wallSystem';
import { roofPlanes, generateShed, generatePurlins, generateHip, wallInfillProfiles } from '../subsystems/roofFamilies';
import { generateRoofCovering, generateWallCovering, generateInfillCovering, generateSkids, generateSlabOnGrade, wallLayerThicknessFt, type InfillSurface } from '../subsystems/coverings';
import { generateFloorOnBearings, joistNominalFor } from '../subsystems/floorSystem';
import { generatePartitions } from '../subsystems/partitions';
import { generateOpenFront, removeClosedWall } from '../subsystems/openFront';
import { generateBuiltOpenings, generateEntrySteps } from '../subsystems/builtOpenings';
import { LUMBER, PANEL, FOUNDATION, TOLERANCE, IN_PER_FT } from '../doctrine';
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
 * How far past each end of its own run a wall's SKIN has to reach to close the corner.
 *
 * A WALL'S SKIN COVERS THE FACE IT PRESENTS TO THE WEATHER, AND ON A BUTTING WALL THAT FACE RUNS
 * CORNER TO CORNER. `WallSurface.runFt` is the wall's clear STRUCTURAL span: a rectangle is framed
 * with one pair of walls running through and the other pair butting between them, so the butting
 * pair's run stops at the through walls' INNER faces — one full wall thickness short of the
 * outside corner at each end. Tiling exactly that run left a 3½-in-wide strip of bare framing
 * standing in every corner of every building, sole plate to cap plate, with the two sidings
 * looking past each other and neither one covering it.
 *
 * The extension is to the through wall's OUTER face, which is where that face genuinely ends. The
 * two skins then meet along the corner arris — they touch and neither runs into the other, because
 * they lie in perpendicular planes that intersect exactly there.
 */
function skinReach(s: WallSurface, walls: WallsContract): { lead: number; tail: number } {
  const half = walls.thicknessFt / 2;
  let lead = 0;
  let tail = 0;
  for (const t of walls.surfaces) {
    // Perpendicular walls only: a parallel one is the far side of the building.
    if (Math.abs(s.along[0] * t.along[0] + s.along[1] * t.along[1]) > TOLERANCE.epsFt) continue;
    const u = (t.origin[0] - s.origin[0]) * s.along[0] + (t.origin[1] - s.origin[1]) * s.along[1];
    // Its INNER face landing on this wall's run end is what says this wall butts into it.
    if (Math.abs(u + half) < TOLERANCE.epsFt) lead = Math.max(lead, walls.thicknessFt);
    if (Math.abs(u - half - s.runFt) < TOLERANCE.epsFt) tail = Math.max(tail, walls.thicknessFt);
  }
  return { lead, tail };
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
  // The plan is told which skins are ON, so it does not advertise a Roofing or a Siding stop
  // for work the spec says is not being done — a scrubber stop that can never contain anything.
  const stagePlan = stagePlanForBuilding(spec.roof.kind, spec.foundation.kind, {
    roofing: spec.coverings.roofing !== 'none',
    walls: spec.coverings.siding !== 'none' || spec.coverings.wallSheathing !== 'none',
  });
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
    // The runners bear on the ground, and the ground is where this branch says it is — see
    // `levels.gradeY` below, which is the same expression. Passing it is what stops the skids
    // floating clear of the earth while the floor they carry is buried in it.
    const joistDepth = DRESSED[joistNominalFor(W)]!.d / IN_PER_FT;
    const gradeY = deckTopY - deckThick / IN_PER_FT - joistDepth - skidD;
    members.push(...generateSkids(L, W, requireOrdinal(stagePlan, 'foundation'), gradeY));
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
    const joistTop = deckTopY - deckThick / IN_PER_FT;
    levels = {
      subfloorTop: 0,
      joistTop,
      sillTop: joistTop - joistDepth,
      gradeY, // the runners are what this floor stands on — and they are placed on it, above
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

  // ── The open front, if this building has one: drop what the frozen generator framed into
  // that wall and stand posts and a beam in its place. The plates stay — they are what the
  // rafters bear on, and the beam under them is what now carries them.
  if (spec.openFront) {
    const kept = removeClosedWall(members, spec.openFront);
    members.length = 0;
    members.push(...kept, ...generateOpenFront({
      spec, walls, stageWalls: requireOrdinal(stagePlan, 'walls'),
    }));
  }

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
        // No roofing means no roofing row — and nothing reads this, because the covering module
        // emits no course for `roofing: 'none'`. The deck's ordinal keeps it a real number.
        stageRoofing: ordinalOf(stagePlan, 'roofing') ?? requireOrdinal(stagePlan, 'roof-deck'),
        rafterHalfFt: rafterHalf,
      }),
    );
  }
  // The open front is not a wall to be skinned. Dropping its STUDS is only half the job —
  // sheathing and siding tile `walls.surfaces`, so the wall came back clad from the outside and
  // the opening was invisible from every angle that mattered. The raked infill ABOVE the plates
  // is not affected: a gable end over an open bay is still closed in.
  const openSkin = spec.openFront
    ? walls.surfaces.filter((s) => s.wall !== spec.openFront)
    : walls.surfaces;

  const skinSurfaces = openSkin.map((s) => {
    const { lead, tail } = skinReach(s, walls);
    if (lead === 0 && tail === 0) return s;
    return {
      ...s,
      runFt: s.runFt + lead + tail,
      origin: [s.origin[0] - s.along[0] * lead, s.origin[1] - s.along[1] * lead] as [number, number],
      // Shifted with the origin, so an opening stays where it was cut.
      cutouts: s.cutouts.map((c) => ({ ...c, u0: c.u0 + lead, u1: c.u1 + lead })),
    };
  });

  // What each wall must close in above its cap plate — a gable end's triangle, a shed's pony
  // wall and rakes. Resolved once here and skinned by whichever coverings are on, so the
  // sheathing and the siding agree about where the building stops.
  const infill: InfillSurface[] = wallInfillProfiles(spec, walls).flatMap((p) => {
    const s = walls.surfaces.find((q) => q.wall === p.wall);
    if (!s) return [];
    const { lead, tail } = skinReach(s, walls);
    return [{
      wall: s.wall,
      runFt: s.runFt + lead + tail,
      baseYFt: walls.plateTopY,
      // Straight through, NOT clamped at the run's ends: `topAt` reads the roof plane at the
      // world station u lands on, so it answers for the corner strip too — which is right,
      // because the roof really does continue over the corner. Clamping it flat there put a
      // kink in a profile that has none, and a strip straddling the kink came out cut to a
      // height that is the average of two different things.
      topAt: (u: number) => p.topAt(u - lead),
      normal: s.normal,
      origin: [s.origin[0] - s.along[0] * lead, s.origin[1] - s.along[1] * lead] as [number, number],
      along: s.along,
      faceOffsetFt: s.faceOffsetFt,
    }];
  });

  if (spec.coverings.wallSheathing !== 'none') {
    const kind = spec.coverings.wallSheathing === 'boards' ? 'boards' : 'plywood';
    members.push(
      ...generateWallCovering({
        surfaces: skinSurfaces,
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
        surfaces: skinSurfaces,
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

  // WHAT FILLS THE OPENINGS. Hung with the exterior finish, because that is when a door goes on
  // and because the `siding` stage is the only one that exists here — a bare-frame card (custom
  // ships with no sheathing and no siding) has no closing-in stage and gets no door, which is
  // right: it is a framing drawing, and its openings are meant to read as holes.
  const closingIn = ordinalOf(stagePlan, 'siding');
  if (closingIn !== undefined) {
    const sheathingThick = spec.coverings.wallSheathing !== 'none'
      ? wallLayerThicknessFt(spec.coverings.wallSheathing === 'boards' ? 'boards' : 'plywood')
      : 0;
    const sidingThick = spec.coverings.siding !== 'none'
      ? wallLayerThicknessFt(spec.coverings.siding === 'boardAndBatten' ? 'boardAndBatten'
        : spec.coverings.siding === 'boards' ? 'boards' : 'plywood')
      : 0;
    members.push(...generateBuiltOpenings({
      surfaces: skinSurfaces,
      openings: story.openings,
      stage: closingIn,
      skinThickFt: sheathingThick + sidingThick,
      ...(spec.shutters ? { shutters: spec.shutters } : {}),
    }));
    // And something to stand on. `entrySteps` defaults ON: a door the floor has lifted out of
    // reach is not a design choice, and the flag exists so a card that genuinely wants none —
    // a drawing of the frame, a building against a loading dock — can say so.
    if (spec.entrySteps !== false) {
      members.push(...generateEntrySteps({
        surfaces: skinSurfaces,
        openings: story.openings,
        stage: closingIn,
        thresholdY: levels.subfloorTop,
        gradeY: levels.gradeY,
        skinThickFt: sheathingThick + sidingThick,
      }));
    }
  }

  return { members, levels, stagePlan, walls };
}
