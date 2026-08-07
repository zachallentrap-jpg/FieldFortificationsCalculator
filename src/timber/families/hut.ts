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
import { HUT, LATRINE, LUMBER, OPENING, TOLERANCE, IN_PER_FT, citeOf } from '../doctrine';
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
    // Carried across, not dropped: the shutter mode is a hut field and the thing that hangs
    // shutters runs inside `generateBuilding`.
    ...(spec.shutters ? { shutters: spec.shutters } : {}),
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
 * Horizontal girts ACROSS the studs, one level every `girtSpacingFt` up the wall, stopping short
 * of the plate. They run the full clear run of the wall — a girt is CUT at an opening on site, and
 * the take-off bills the stock it is cut from, which is what a runner needs.
 *
 * A GIRT IS NAILED TO THE STUDS; IT IS NOT IN THE SAME PLANE AS THEM. `s.origin` is the wall's
 * CENTRELINE, so a girt placed on it with no offset sat dead in the middle of a 3½-in wall and
 * passed clean through every stud it crossed — the whole 1½ × 3½ × 1½-in block at each one, 23 of
 * them on one wall of a sea hut and 102 on a squad hut, on all six variants. That the run is
 * continuous is the point of the piece and is not the fault; the fault is the plane.
 *
 * INBOARD, because that is the side that is clear. The siding is outboard of the studs and the
 * let-in braces are notched into their outer face, so a girt on the outside would run into both.
 * (A girt is also a siding NAILER, and that reading puts it outboard with the siding standing off
 * by its thickness — a covering-system change, written up in the sweep rather than guessed at
 * here.)
 */
function generateGirts(walls: WallsContract, stage: number, wallHeightFt: number): Member[] {
  const emit = makeEmitter('HT');
  const nominal = HUT.girtNominal.value as string;
  const spacing = HUT.girtSpacingFt.value as number;
  const d = DRESSED[nominal]!.d / IN_PER_FT;
  // Centreline to "outer face of the girt against the studs' inner face", measured inward.
  const inset = walls.thicknessFt / 2 + DRESSED[nominal]!.w / IN_PER_FT / 2;
  const half = walls.thicknessFt / 2;
  for (const s of walls.surfaces) {
    // THE CLEAR RUN IS CLEAR OF THE OTHER WALLS. `runFt` is the wall's own run, and a rectangle
    // is framed with one pair running through and the other pair butting between them — so a
    // through wall's run is the whole outside length and its ends are INSIDE the butting walls.
    // In the stud plane that never showed; moved inboard, where the butting walls are, each end
    // landed in a corner stud (3½ × 3½ × 1½ in, one per corner). A girt is cut at the corner.
    let u0 = 0;
    let u1 = s.runFt;
    for (const t of walls.surfaces) {
      if (Math.abs(s.along[0] * t.along[0] + s.along[1] * t.along[1]) > 1e-6) continue; // parallel
      // Where t's slab crosses this wall's run. The comparisons are ON a knife edge — a butting
      // wall's face lands exactly on the through wall's end — so they carry a tolerance. Without
      // one, the N wall's rounding fell the other way from the S wall's and one hut in three kept
      // a corner-stud collision that its mirror image did not have.
      const u = (t.origin[0] - s.origin[0]) * s.along[0] + (t.origin[1] - s.origin[1]) * s.along[1];
      const e = TOLERANCE.epsFt;
      if (u - half <= u0 + e && u + half > u0 + e) u0 = u + half;
      if (u + half >= u1 - e && u - half < u1 - e) u1 = u - half;
    }
    const runFt = u1 - u0;
    if (runFt <= 0) continue;
    for (let v = spacing; v < wallHeightFt - d; v += spacing) {
      const uMid = (u0 + u1) / 2;
      emit('girt', nominal, {
        cutLengthFt: runFt,
        position: [
          s.origin[0] + s.along[0] * uMid - s.normal[0] * inset,
          v,
          s.origin[1] + s.along[1] * uMid - s.normal[1] * inset,
        ],
        rotation: [0, surfaceYaw(s), 0],
        stage,
        wall: s.wall,
        nailing: '2-16d ea stud (PH)',
        doctrineRef: citeOf(HUT.girtSpacingFt),
      });
    }
  }
  return emit.members;
}

/** Half-extent of a member along a unit world direction — exact for any rotation. */
function halfExtentAlong(m: Member, n: [number, number, number]): number {
  const [rx, ry, rz] = m.rotation;
  const axis = (v: [number, number, number]): [number, number, number] => {
    let [x, y, z] = v;
    let a = x * Math.cos(rz) - y * Math.sin(rz);
    const b = x * Math.sin(rz) + y * Math.cos(rz);
    x = a; y = b;
    a = y * Math.cos(rx) - z * Math.sin(rx);
    z = y * Math.sin(rx) + z * Math.cos(rx);
    y = a;
    return [x * Math.cos(ry) + z * Math.sin(ry), y, -x * Math.sin(ry) + z * Math.cos(ry)];
  };
  const h = [m.cutLength / IN_PER_FT / 2, m.actual.d / IN_PER_FT / 2, m.actual.w / IN_PER_FT / 2];
  return ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as [number, number, number][])
    .reduce((sum, v, i) => {
      const p = axis(v);
      return sum + h[i]! * Math.abs(p[0] * n[0] + p[1] * n[1] + p[2] * n[2]);
    }, 0);
}

/**
 * The screened band: a framed sill and head BETWEEN the studs, with screen across them. The panel
 * is emitted as one member per wall rather than one per stud bay — screen comes off a roll and is
 * cut to the opening, so a bay-by-bay count would bill a seam that nobody cuts.
 *
 * THE SILL AND THE HEAD ARE FRAMING, AND FRAMING GOES BETWEEN. They were emitted as one piece the
 * full run of the wall, on the wall's CENTRELINE — so each ran clean through every stud it crossed,
 * sharing the whole 1½ × 3½ × 1½-in block at each one: 190 pairs on a sea hut, 88 on a latrine,
 * plus a door header (39 × 2¾ × ¾ in) and the rafters over the plate. The comment above has said
 * "between the studs" since the band was written and the nailing note has said `2-16d ea end`,
 * which is a piece with two ends — neither describes a ribbon run past them.
 *
 * The girt next door is the opposite case and got the opposite fix: a girt IS continuous, so it
 * moved onto a face. A sill is not.
 */
function generateScreenBand(
  walls: WallsContract,
  band: { sillFt: number; heightFt: number },
  stage: number,
  framing: readonly Member[],
): Member[] {
  const emit = makeEmitter('HT');
  const nominal = HUT.girtNominal.value as string;
  // THE BAND AND ITS HOLE ARE MEASURED FROM THE SAME PLACE. `wallContract` owns the convention and
  // says so — "measured from the sole-plate TOP, like an opening's sill, so callers use one
  // convention" — and adds the plate thickness itself when it turns the band into the cutout the
  // siding is laid around. The band's own members were placed at the raw figure, which is the
  // sole-plate BOTTOM, so the frame and the screen sat 1½ in BELOW their own hole: the siding
  // lapped the screen by 1½ in along the bottom, and along the top there was a 1½-in strip with
  // no siding and no screen on it — an open slot right round the hut under the eave, 96 ft of it
  // on a sea hut.
  const sill = walls.plateThicknessFt + band.sillFt;
  // AND THE FRAME IS INSIDE THE BAND, not centred on its edges. Centred, the head's top reached
  // 7.771 on an 8-ft wall where the top plate starts at 7.750 — an 8th of an inch of interference
  // that made the plate an obstruction running the whole 32 ft, and the entire head row went
  // missing. There is only 1½ in of wall between the band's top and the plate, which is no room
  // for a 3½-in member above it. Sill bottom on the band's bottom, head top on its top: both fit,
  // both are what the screen is stapled to, and the clear light is between them.
  const halfFace = DRESSED[nominal]!.d / IN_PER_FT / 2;
  const heads = [sill + halfFace, sill + band.heightFt - halfFace];
  for (const s of walls.surfaces) {
    const uMid = s.runFt / 2;
    const along3: [number, number, number] = [s.along[0], 0, s.along[1]];
    const norm3: [number, number, number] = [s.normal[0], 0, s.normal[1]];
    const halfThick = DRESSED[nominal]!.w / IN_PER_FT / 2;
    for (const v of heads) {
      // WHAT IS ALREADY IN THE WAY AT THIS HEIGHT, on this wall, in this plane. Not "the studs":
      // the head row runs at the top of the band, where the CRIPPLES over an opening's header
      // stand and where the header itself is, and a bay list built from studs alone put the band
      // through both — 14 pairs and a 36 × 2¾ × ¾-in bite out of a door header on a sea hut.
      // Anything of this wall that shares both the band member's height and its plane is an
      // obstruction, and the piece is cut to the clear space between them. A let-in brace shares
      // neither plane nor height, which is why it is not in the way and does not appear here.
      const obstacles = framing
        .filter((m) => {
          if (m.wall !== s.wall || m.role === 'screenFrame' || m.role === 'screenPanel') return false;
          const dy = halfExtentAlong(m, [0, 1, 0]);
          if (Math.abs(m.position[1] - v) >= dy + halfFace - TOLERANCE.epsFt) return false;
          const w = (m.position[0] - s.origin[0]) * s.normal[0] + (m.position[2] - s.origin[1]) * s.normal[1];
          return Math.abs(w) < halfExtentAlong(m, norm3) + halfThick - TOLERANCE.epsFt;
        })
        .map((m) => {
          const u = (m.position[0] - s.origin[0]) * s.along[0] + (m.position[2] - s.origin[1]) * s.along[1];
          const h = halfExtentAlong(m, along3);
          return [u - h, u + h] as [number, number];
        })
        .sort((a, b) => a[0] - b[0]);
      // MERGED, because obstructions overlap each other. A header spans several bays and contains
      // the king studs, the jacks and the cripples over it; walking a sorted list in pairs finds a
      // "gap" between one of them and the next INSIDE that header, and the band was framed across
      // it — 14½ in of blocking buried in a door header on the sea hut, after the header itself
      // was already being counted as in the way.
      const clear: [number, number][] = [];
      for (const iv of obstacles) {
        const last = clear[clear.length - 1];
        if (last && iv[0] <= last[1] + TOLERANCE.epsFt) last[1] = Math.max(last[1], iv[1]);
        else clear.push([iv[0], iv[1]]);
      }
      // A bay that falls inside an OPENING is not framed here — nothing is in the way there
      // because nothing is THERE, and a piece run across it would bar the doorway.
      //
      // An opening, and not the band itself. `cutouts` also carries the band with a NEGATIVE
      // `openingIndex`, so that the siding is cut away over it — and matching that one told the
      // band not to frame its own head: the whole 7½-ft row went missing on every wall of every
      // screened hut, leaving the screen with nothing along its top.
      const blocked = (a: number, b: number): boolean => s.cutouts.some(
        (c) => c.openingIndex >= 0 && c.v0 - 1e-9 <= v && v <= c.v1 + 1e-9
          && Math.min(c.u1, b) - Math.max(c.u0, a) > 1e-9);
      for (let i = 0; i + 1 < clear.length; i++) {
        const a = clear[i]![1];
        const b = clear[i + 1]![0];
        // A quarter-inch offcut is not a member. Two obstructions that all but touch — a cripple
        // beside a jack stud — leave a hair of clear space, and eight of those came out of a sea
        // hut as 0.25-in pieces before this guard.
        if (b - a <= TOLERANCE.minSliverFt || blocked(a, b)) continue;
        emit('screenFrame', nominal, {
          cutLengthFt: b - a,
          position: [
            s.origin[0] + s.along[0] * ((a + b) / 2),
            v,
            s.origin[1] + s.along[1] * ((a + b) / 2),
          ],
          rotation: [0, surfaceYaw(s), 0],
          stage,
          wall: s.wall,
          nailing: '2-16d ea end (PH)',
          doctrineRef: citeOf(HUT.screenBandSillFt),
        });
      }
    }
    emit('screenPanel', 'screen cloth', {
      cutLengthFt: s.runFt,
      position: [
        s.origin[0] + s.along[0] * uMid + s.normal[0] * s.faceOffsetFt,
        sill + band.heightFt / 2,
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
function generateRiserBox(
  lengthFt: number, widthFt: number, seats: 2 | 4, stage: number, wallThickFt: number,
): Member[] {
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
  // AND IT HAS TO CLOSE AGAINST THE WALL. `widthFt - 0.5` is a guessed half-foot, and the wall's
  // inner face is not there: on the shipped latrine the framing stops at 7.7083 and the bench's
  // back stood at 7.5000, so a 2½-in slot ran the whole 10-ft length of the bench, straight down
  // into the pit — under a comment that has said "spanning the full depth from the front board to
  // the wall" since the box was written. The wall contract knows where its face is.
  const zBack = widthFt - wallThickFt;
  const zFront = zBack - depth;
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
  // Ends and seat dividers, crossing front to back, full height under the lid — and landing on the
  // BACK of the front board, not inside it. Run to the front FACE and every divider shares its
  // whole thickness with the board it is nailed to: 1½ × 15¼ × 1½ in, five times over on the
  // shipped four-seat bench. A divider butts the board; the board is the face of the box.
  const zDivider = zFront + thick;
  for (let i = 0; i <= seats; i++) {
    const x = lengthFt / 2 - runFt / 2 + (runFt * i) / seats;
    emit('riserBox', nominal, {
      cutLengthFt: zBack - zDivider,
      position: [x, (h - thick) / 2, (zDivider + zBack) / 2],
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
  // ONLY IF THERE IS FINISH WORK. The row went on unconditionally, and only the sea hut and the
  // latrine have any: a screen band, and the latrine's riser box. The SWA hut, the B-hut, the
  // squad hut and the guard shack each carried a "Screens, doors and fittings" stop on the
  // scrubber that could never contain anything. It is the LAST row, so leaving it off moves no
  // ordinal — which is the only reason this is safe to do at all.
  const band = bandFor(spec);
  // Against the same datum the band is set out on — the plate thickness is part of the height it
  // has to fit under, not a rounding.
  const screened = band !== null
    && base.walls.plateThicknessFt + band.sillFt + band.heightFt <= wallHeightFt;
  const hasRiser = spec.variant === 'latrine';
  const stagePlan: StagePlanEntry[] = screened || hasRiser
    ? [
      ...base.stagePlan,
      {
        ordinal: base.stagePlan.length + 1,
        key: 'finish',
        label: 'Screens, doors and fittings',
        detail: 'The band is screened, the doors are hung, and anything built in goes in last.',
      },
    ]
    : base.stagePlan;
  const wallStage = requireOrdinal(stagePlan, 'walls');
  members.push(...generateGirts(base.walls, wallStage, wallHeightFt));

  if (screened || hasRiser) {
    const finishStage = requireOrdinal(stagePlan, 'finish');
    if (screened) members.push(...generateScreenBand(base.walls, band!, finishStage, base.members));
    if (hasRiser) {
      const seats = spec.latrine?.seats ?? 4;
      members.push(...generateRiserBox(
        buildingSpec.dims.lengthFt, buildingSpec.dims.widthFt, seats, finishStage, base.walls.thicknessFt,
      ));
    }
  }

  return { ...base, members, stagePlan, screenBand: screened ? band : null };
}

/** Walls a variant screens, for the catalog's lock rows. Exported for the catalog test. */
export function hutHasScreenBand(variant: HutSpec['variant']): boolean {
  return variant === 'seaHut' || variant === 'latrine';
}

export const HUT_WALLS: readonly WallId[] = WALL_ORDER;
export type { WallSurface };
