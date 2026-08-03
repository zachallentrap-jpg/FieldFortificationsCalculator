// TIMBER-2 T5 — the hut family (plan §2.2, §7 T5).
//
// The owner asked for the hut family "exhaustively": SEA hut, SWA hut, B-hut, squad hut, guard
// shack — and the latrine alongside them. TD2 is the reason that is a data change and not five
// new engines: a hut IS a framed building, so this module translates a `HutSpec` into the
// `BuildingSpec` the one engine already builds correctly, then adds the three things that make
// a hut a hut and a building not one:
//
//   GIRTS — horizontal members between the studs. A hut is sided without being sheathed, so the
//   wall has no diaphragm; girts are what stiffen it and what the siding, the screen band and
//   the shutters are actually nailed to.
//
//   THE SCREEN BAND — the band of insect screen under the eaves that makes a SEA hut a SEA hut:
//   the walls close, the top foot and a half of them breathes. It is framed (a sill and a head)
//   and filled between the studs, and the siding is CUT AROUND it — which is why it enters as a
//   surface cutout rather than as decoration.
//
//   THE RISER BOX — for the latrine, the boxed bench over the pit, with its seat openings.
//
// LINEAGE HONESTY (plan §2.2). These sizes are the ones the type is commonly built to, carried
// in `doctrine.HUT` as (PH) with the sheet pending. That is thinner lineage than the GP
// building has, so every hut card states it in `rationale` and every dimension stays an
// operator-adjustable number. A card exists because a preset can express it — not because a
// page has been read — and the tool says which.

import type { Member, MemberRole } from '../types';
import { DRESSED } from '../types';
import type { HutSpec, BuildingSpec, WallOpenings } from '../spec';
import type { WallId } from '../types';
import { WALL_ORDER } from '../spec';
import { makeEmitter } from '../emit';
import { HUT, LATRINE, LUMBER, OPENING, IN_PER_FT, citeOf } from '../doctrine';
import { generateBuilding, type BuildingResult } from './building';
import { defaultOpenings } from '../openings';
import { surfaceYaw, type WallSurface, type WallsContract } from '../subsystems/wallSystem';
import { requireOrdinal, type StagePlanEntry } from '../stagePlan';

/** Plan size and wall height for a variant, straight out of the doctrine table. */
export function hutDims(variant: HutSpec['variant']): { lengthFt: number; widthFt: number; wallHeightFt: number } {
  const table = {
    seaHut: HUT.seaHut, swaHut: HUT.swaHut, bHut: HUT.bHut,
    squadHut: HUT.squadHut, guardShack: HUT.guardShack, latrine: HUT.latrine,
  } as const;
  return { ...table[variant].value };
}

/** Bays across the length, for the B-hut's partitions. */
function bHutPartitions(lengthFt: number): BuildingSpec['partitions'] {
  const bays = HUT.bHutBays.value as number;
  const out: NonNullable<BuildingSpec['partitions']> = [];
  for (let i = 1; i < bays; i++) {
    const stationFt = (lengthFt * i) / bays;
    out.push({ axis: 'Z', stationFt, door: { offsetFt: 1, widthFt: 3 } });
  }
  return out;
}

/** The `BuildingSpec` a hut is, before the hut-specific members are added. */
export function buildingSpecForHut(spec: HutSpec): BuildingSpec {
  // `dims` is required on every spec and the catalog preset fills it from `hutDims`, so this
  // reads what the operator actually has rather than silently re-imposing the standard size on
  // a hut they resized. Only the wall height falls back, because HutSpec leaves it optional.
  const { lengthFt, widthFt } = spec.dims;
  const wallHeightFt = spec.wallHeightFt ?? hutDims(spec.variant).wallHeightFt;
  return {
    family: 'building',
    dims: { lengthFt, widthFt },
    spacing: spec.spacing,
    coverings: spec.coverings,
    stories: [{
      wallHeightFt,
      openings: spec.openings ?? defaultOpenings(spec.variant, lengthFt, widthFt),
      letInBracing: true,
    }],
    roof: spec.roof ?? { kind: 'gable', risePer12: 4, overhangFt: 1 },
    foundation: spec.foundation ?? { kind: 'piers', crawlFt: 1.5 },
    ...(spec.partitions ? { partitions: spec.partitions }
      : spec.variant === 'bHut' ? { partitions: bHutPartitions(lengthFt) } : {}),
    entrySteps: true,
    // The band is a hole in the siding, not a decal over it. Resolved here rather than in
    // `generateHut` so the covering pass — which runs inside `generateBuilding` — can see it.
    ...(bandFor(spec) ? { wallBands: [bandRect(bandFor(spec)!)] } : {}),
  };
}

/** The screened band this hut has, or null. `screenBand: null` means "explicitly none". */
export function bandFor(spec: HutSpec): { sillFt: number; heightFt: number } | null {
  if (spec.screenBand === null) return null;
  if (spec.screenBand) return spec.screenBand;
  return hutHasScreenBand(spec.variant)
    ? { sillFt: HUT.screenBandSillFt.value as number, heightFt: HUT.screenBandHeightFt.value as number }
    : null;
}

const bandRect = (b: { sillFt: number; heightFt: number }) => ({ v0: b.sillFt, v1: b.sillFt + b.heightFt });

/**
 * Horizontal girts between the studs, one level every `girtSpacingFt` up the wall, stopping
 * short of the plate. They run the full clear run of the wall — a girt is CUT at an opening on
 * site, and the take-off bills the stock it is cut from, which is what a runner needs.
 */
function generateGirts(walls: WallsContract, stage: number, wallHeightFt: number): Member[] {
  const emit = makeEmitter('HT');
  const nominal = HUT.girtNominal.value as string;
  const spacing = HUT.girtSpacingFt.value as number;
  const d = DRESSED[nominal]!.d / IN_PER_FT;
  for (const s of walls.surfaces) {
    for (let v = spacing; v < wallHeightFt - d; v += spacing) {
      const uMid = s.runFt / 2;
      emit('girt', nominal, {
        cutLengthFt: s.runFt,
        position: [
          s.origin[0] + s.along[0] * uMid,
          v,
          s.origin[1] + s.along[1] * uMid,
        ],
        rotation: [0, surfaceYaw(s), 0],
        stage,
        wall: s.wall,
        nailing: '2-16d ea end (PH)',
        doctrineRef: citeOf(HUT.girtSpacingFt),
      });
    }
  }
  return emit.members;
}

/**
 * The screened band: a framed sill and head across every wall, with screen between the studs.
 * The panel is emitted as one member per wall rather than one per stud bay — screen comes off a
 * roll and is cut to the opening, so a bay-by-bay count would bill a seam that nobody cuts.
 */
function generateScreenBand(
  walls: WallsContract,
  band: { sillFt: number; heightFt: number },
  stage: number,
): Member[] {
  const emit = makeEmitter('HT');
  const nominal = HUT.girtNominal.value as string;
  for (const s of walls.surfaces) {
    const uMid = s.runFt / 2;
    const at = (v: number, role: MemberRole, extra: Record<string, unknown>) => emit(role, nominal, {
      cutLengthFt: s.runFt,
      position: [s.origin[0] + s.along[0] * uMid, v, s.origin[1] + s.along[1] * uMid],
      rotation: [0, surfaceYaw(s), 0],
      stage,
      wall: s.wall,
      nailing: '2-16d ea end (PH)',
      doctrineRef: citeOf(HUT.screenBandSillFt),
      ...extra,
    });
    at(band.sillFt, 'screenFrame', {});
    at(band.sillFt + band.heightFt, 'screenFrame', {});
    emit('screenPanel', 'screen cloth', {
      cutLengthFt: s.runFt,
      position: [
        s.origin[0] + s.along[0] * uMid + s.normal[0] * s.faceOffsetFt,
        band.sillFt + band.heightFt / 2,
        s.origin[1] + s.along[1] * uMid + s.normal[1] * s.faceOffsetFt,
      ],
      rotation: [0, surfaceYaw(s), 0],
      stage,
      wall: s.wall,
      actual: { w: HUT.screenClothThickIn.value as number, d: band.heightFt * IN_PER_FT },
      nailing: 'staples @ 4" + batten (PH)',
      doctrineRef: citeOf(HUT.screenBandHeightFt),
    });
  }
  return emit.members;
}

/**
 * The latrine's riser box: a boxed bench down one side over the pit, with a seat opening per
 * seat. The PIT itself is not a member — nothing is built out of it — so it is not emitted; the
 * depth travels on the spec and prints on the sheet, which is where a digging task belongs.
 */
function generateRiserBox(lengthFt: number, widthFt: number, seats: 2 | 4, stage: number): Member[] {
  const emit = makeEmitter('HT');
  const nominal = LATRINE.boxNominal.value as string;
  const h = LATRINE.riserBoxHeightFt.value as number;
  const depth = LATRINE.riserBoxDepthFt.value as number;
  const spacing = LATRINE.seatSpacingFt.value as number;
  const runFt = Math.min(lengthFt - 1, seats * spacing);
  const thick = DRESSED[nominal]!.w / IN_PER_FT;
  // THE BOX HAS TO CLOSE. Three parts were each placed against a different datum — the front
  // board hung off `h` minus half its FACE WIDTH, the top sat exactly ON `h`, and the dividers
  // were centred at `h/2` and so came up short of both. The result was a bench whose lid
  // floated four inches above its own dividers and eight inches behind its own front board.
  // One datum fixes it: `h` is the SEAT HEIGHT — the top of the lid — and everything hangs off
  // that, which is also the only number on this bench a person interacts with.
  const zFront = widthFt - depth - 0.5;
  const zBack = widthFt - 0.5;
  const lidY = h - thick / 2;
  // The lid, flat, spanning the full depth from the front board to the wall.
  emit('riserBox', nominal, {
    cutLengthFt: runFt,
    position: [lengthFt / 2, lidY, (zFront + zBack) / 2],
    rotation: [-Math.PI / 2, 0, 0],
    stage,
    actual: { w: DRESSED[nominal]!.w, d: depth * IN_PER_FT },
    nailing: '3-8d ea stud (PH)',
    doctrineRef: citeOf(LATRINE.riserBoxDepthFt),
  });
  // The front board, standing on edge under the lid's front edge and reaching the ground.
  emit('riserBox', nominal, {
    cutLengthFt: runFt,
    position: [lengthFt / 2, (h - thick) / 2, zFront + thick / 2],
    rotation: [0, 0, 0],
    stage,
    actual: { w: DRESSED[nominal]!.w, d: (h - thick) * IN_PER_FT },
    nailing: '3-8d ea stud (PH)',
    doctrineRef: citeOf(LATRINE.riserBoxHeightFt),
  });
  // Ends and seat dividers, crossing front to back, full height under the lid.
  for (let i = 0; i <= seats; i++) {
    const x = lengthFt / 2 - runFt / 2 + (runFt * i) / seats;
    emit('riserBox', nominal, {
      cutLengthFt: depth,
      position: [x, (h - thick) / 2, (zFront + zBack) / 2],
      rotation: [0, Math.PI / 2, 0],
      stage,
      actual: { w: DRESSED[nominal]!.w, d: (h - thick) * IN_PER_FT },
      nailing: '3-8d ea end (PH)',
      doctrineRef: citeOf(LATRINE.seatSpacingFt),
    });
  }
  return emit.members;
}

export interface HutResult extends BuildingResult {
  /** The band actually applied, so the UI and the sheet describe what was built. */
  screenBand: { sillFt: number; heightFt: number } | null;
}

export function generateHut(spec: HutSpec): HutResult {
  const buildingSpec = buildingSpecForHut(spec);
  const base = generateBuilding(buildingSpec);
  const members = [...base.members];
  const wallHeightFt = buildingSpec.stories[0]!.wallHeightFt;

  // A hut's girts go up with its walls; the screen band and the riser box are finish work, and
  // the building plan has no finish stage — so the hut plan is the building's plus one. APPEND,
  // never renumber: `Member.stage` is an ordinal into this array, so inserting a stage would
  // silently move every member emitted before it into the wrong row of the cut list.
  const stagePlan: StagePlanEntry[] = [
    ...base.stagePlan,
    {
      ordinal: base.stagePlan.length + 1,
      key: 'finish',
      label: 'Screens, doors and fittings',
      detail: 'The band is screened, the doors are hung, and anything built in goes in last.',
    },
  ];
  const wallStage = requireOrdinal(stagePlan, 'walls');
  const finishStage = requireOrdinal(stagePlan, 'finish');
  members.push(...generateGirts(base.walls, wallStage, wallHeightFt));

  const band = bandFor(spec);
  if (band && band.sillFt + band.heightFt <= wallHeightFt) {
    members.push(...generateScreenBand(base.walls, band, finishStage));
  }

  if (spec.variant === 'latrine') {
    const seats = spec.latrine?.seats ?? 4;
    members.push(...generateRiserBox(buildingSpec.dims.lengthFt, buildingSpec.dims.widthFt, seats, finishStage));
  }

  return { ...base, members, stagePlan, screenBand: band && band.sillFt + band.heightFt <= wallHeightFt ? band : null };
}

/** Walls a variant screens, for the catalog's lock rows. Exported for the catalog test. */
export function hutHasScreenBand(variant: HutSpec['variant']): boolean {
  return variant === 'seaHut' || variant === 'latrine';
}

export const HUT_WALLS: readonly WallId[] = WALL_ORDER;
export type { WallSurface };
