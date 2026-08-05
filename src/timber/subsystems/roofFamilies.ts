// TIMBER-2 — roof families beyond the frozen gable (plan §2.5, TD6, TD7).
//
// TWO exports, and the split matters:
//
//   roofPlanes()   pure geometry — where the roof's SURFACES are, for any roof kind. Coverings
//                  (sheathing, felt, roofing courses) tile against these and never re-derive a
//                  slope. One plane definition, every consumer.
//
//   generateShed() / generateFlat()   the framing.
//
// TD6 is the load-bearing decision here. A shed roof needs a taller wall on its high side —
// and `generateWalls` is the frozen branch, which only makes rectangular walls. Rather than
// unfreeze it, the ROOF module emits the height difference itself: a pony wall of studs above
// the high wall's cap plate, and rake infill studs stepping up the two side walls. That is
// exactly how gable-end studs already work in the legacy roof generator, so the pattern is
// the repo's own, not an invention.
//
// TD7: "flat" is a shed floored at 1:12 — the minimum slope double-coverage roll roofing is
// rated for. A true dead-flat TO roof is built-up roofing, which this tool does not model, so
// offering 1/4:12 would be drawing a roof that leaks.

import type { Member, WallId } from '../types';
import { DRESSED } from '../types';
import type { BuildingSpec, RoofSpec } from '../spec';
import { makeEmitter } from '../emit';
import { LUMBER, LAYOUT, TOLERANCE, IN_PER_FT, citeOf } from '../doctrine';
import type { WallsContract } from './wallSystem';
import { rafterSeatLiftFt } from '../birdsMouth';

/** A roof surface in its own (u along the eave, v up the slope) coordinates. */
export interface RoofPlane {
  id: string;
  origin: [number, number, number]; // world position of (u=0, v=0) — the eave's left end
  alongEave: [number, number, number]; // unit
  upSlope: [number, number, number]; // unit, in the plane
  normal: [number, number, number]; // unit, outward (up)
  eaveLengthFt: number;
  slopeLengthFt: number;
  /**
   * How wide the plane is at its TOP edge, when that differs from the eave.
   *
   * A gable slope and a shed are rectangles and leave this undefined. A hip is not: its long
   * slopes are trapezoids narrowing to the ridge, and its two ends are triangles narrowing to
   * a point. The taper is centred on the eave, which is what an equal-pitch hip produces.
   *
   * Carrying it on the PLANE rather than special-casing the tiler is what lets one covering
   * path serve every roof — the tiler clips each course to the plane's width at that height
   * and a rectangle simply never gets clipped.
   */
  topLengthFt?: number;
}

/** Half-open [lo, hi) of the plane's own u at height v — the outline, evaluated. */
export function planeSpanAt(p: RoofPlane, v: number): { lo: number; hi: number } {
  const top = p.topLengthFt;
  if (top === undefined || p.slopeLengthFt <= 0) return { lo: 0, hi: p.eaveLengthFt };
  const t = Math.min(1, Math.max(0, v / p.slopeLengthFt));
  const width = p.eaveLengthFt + (top - p.eaveLengthFt) * t;
  const lo = (p.eaveLengthFt - width) / 2;
  return { lo, hi: lo + width };
}

const cross = (a: number[], b: number[]): [number, number, number] => [
  a[1]! * b[2]! - a[2]! * b[1]!,
  a[2]! * b[0]! - a[0]! * b[2]!,
  a[0]! * b[1]! - a[1]! * b[0]!,
];

/**
 * The four faces of a square pyramid roof — a hip whose ridge has shrunk to a point.
 *
 * A guard tower's cab roof used to be drawn as four RECTANGLES, one per slope, each as wide at
 * the peak as it was at the eave. Four 10-ft rectangles cannot meet at a point: they cross each
 * other above the hip rafters and their upper corners hang out past the hips and below the eave
 * line, which is the creased, folded roof the owner asked about. A pyramid face is a TRIANGLE,
 * and the tiler already knows how to cut one — `topLengthFt: 0` is the whole answer, the same
 * value the hip ends of a building roof carry. Once it goes through the shared covering path
 * the cab also gets the roofing it was specified with, which the hand-rolled version dropped.
 *
 * `halfSideFt` is measured to the EAVE (overhang included), and `riseFt` is peak above eave.
 */
export function pyramidPlanes(
  center: [number, number],
  halfSideFt: number,
  eaveY: number,
  riseFt: number,
): RoofPlane[] {
  const side = halfSideFt * 2;
  const slopeLengthFt = Math.hypot(halfSideFt, riseFt);
  const cs = halfSideFt / Math.max(1e-9, slopeLengthFt);
  const sn = riseFt / Math.max(1e-9, slopeLengthFt);
  // Eave corners in plan order; each face spans one edge and rises to the peak over the middle.
  const corner: [number, number][] = [
    [center[0] - halfSideFt, center[1] - halfSideFt], [center[0] + halfSideFt, center[1] - halfSideFt],
    [center[0] + halfSideFt, center[1] + halfSideFt], [center[0] - halfSideFt, center[1] + halfSideFt],
  ];
  const face = ['roof-S', 'roof-E', 'roof-N', 'roof-W'];
  return corner.map((p, f) => {
    const q = corner[(f + 1) % 4]!;
    const len = Math.max(1e-9, Math.hypot(q[0] - p[0], q[1] - p[1]));
    const alongEave: [number, number, number] = [(q[0] - p[0]) / len, 0, (q[1] - p[1]) / len];
    // Uphill is square to the eave, toward the middle of the plan.
    const mid: [number, number] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const inLen = Math.max(1e-9, Math.hypot(center[0] - mid[0], center[1] - mid[1]));
    const inward: [number, number] = [(center[0] - mid[0]) / inLen, (center[1] - mid[1]) / inLen];
    const upSlope: [number, number, number] = [inward[0] * cs, sn, inward[1] * cs];
    const n = cross(upSlope, alongEave);
    return {
      id: face[f]!,
      origin: [p[0], eaveY, p[1]] as [number, number, number],
      alongEave,
      upSlope,
      // Outward means UP on a roof; the cross product's sign depends on the corner winding, so
      // it is checked rather than assumed.
      normal: (n[1] < 0 ? [-n[0], -n[1], -n[2]] : n) as [number, number, number],
      eaveLengthFt: side,
      slopeLengthFt,
      topLengthFt: 0,
    };
  });
}

/** Slope (rise per foot of run) and the framing-square length per foot of run. */
export function slopeOf(roof: RoofSpec): { slope: number; lenPerFtRun: number; pitchRad: number } {
  const risePer12 =
    roof.kind === 'flat' ? (roof.drainPer12 ?? 1)
    : roof.kind === 'none' ? 0
    : roof.risePer12;
  const slope = risePer12 / IN_PER_FT;
  return {
    slope,
    lenPerFtRun: Math.sqrt(IN_PER_FT * IN_PER_FT + risePer12 * risePer12) / IN_PER_FT,
    pitchRad: Math.atan2(risePer12, IN_PER_FT),
  };
}

/** True when the shed's slope runs along Z (high wall is N or S). */
const slopeAlongZ = (highSide: WallId): boolean => highSide === 'N' || highSide === 'S';

/**
 * Where the rafter CENTRE plane sits at the building line — the datum every roof surface and
 * every rafter in this file is measured from.
 *
 * It is not the plate top. Putting the rafter's centre line on the plate's outer top corner is
 * how the roof used to be laid out here, and it drops the rafter half its own depth into the
 * wall: the bird's mouth that would close that gap has to eat more than half the rafter, which
 * is not a joint. `rafterSeatLiftFt` states the correction once — the height at which a
 * plate-wide seat lands on the plate top — and gable, shed, flat and hip all read it from here
 * so they cannot drift apart.
 */
export function rafterPlaneDatum(spec: BuildingSpec, plateTopY: number): number {
  const { slope } = slopeOf(spec.roof);
  const rafter = DRESSED[LUMBER.rafterNominal.value as keyof typeof DRESSED] ?? DRESSED['2x6']!;
  const plate = DRESSED[LUMBER.plateNominal.value as keyof typeof DRESSED] ?? DRESSED['2x4']!;
  return plateTopY + rafterSeatLiftFt(rafter.d, plate.d, slope);
}

/**
 * The roof's surfaces, for any roof kind. Gable returns two planes, shed/flat one, pyramid
 * four. Every plane's `origin` is at the EAVE, so tiling from v=0 upward lays courses the way
 * a roofer works: from the bottom up, each course lapping the one below.
 */
export function roofPlanes(spec: BuildingSpec, plateTopYRaw: number): RoofPlane[] {
  const { lengthFt: L, widthFt: W } = spec.dims;
  const roof = spec.roof;
  if (roof.kind === 'none') return [];
  const { slope, lenPerFtRun } = slopeOf(roof);
  const oh = roof.overhangFt; // 'none' returned above, so every remaining kind has one
  // Not the plate top — the seated rafter plane. See `rafterPlaneDatum`.
  const plateTopY = rafterPlaneDatum(spec, plateTopYRaw);

  // A HIP HAS FOUR SURFACES, and for a long time this returned two — a hip was treated as a
  // gable, so its long slopes got deck and roofing and its two triangular ends showed bare
  // framing. The framing was always complete (`generateHip` emits commons, hips and jacks, and
  // the jack sequence is asserted in `timber2-hip`); it was the skin that stopped at the hips.
  //
  // Geometry, for an equal-pitch hip on an L × W plan with L > W: the ridge runs along X at
  // z = W/2, from x = W/2 to x = L - W/2, so it is (L - W) long. Both long slopes are
  // trapezoids from a full-length eave up to that ridge. Both ends are triangles from a
  // W-wide eave up to a single point at the ridge end. Every one of the four rises
  // (W/2 + overhang) of run, so all four share the pitch — which is what makes it a hip
  // rather than four unrelated planes.
  if (roof.kind === 'hip') {
    const run = W / 2 + oh;
    const yEave = plateTopY - oh * slope;
    const slopeLengthFt = run * lenPerFtRun;
    const planes: RoofPlane[] = [];
    // Long slopes: same convention as the gable — u runs +X on the south side, -X on the
    // north, so both normals point up and outward.
    for (const side of [-1, 1] as const) {
      const zEave = side === -1 ? -oh : W + oh;
      planes.push({
        id: side === -1 ? 'roof-S' : 'roof-N',
        origin: [side === -1 ? 0 : L, yEave, zEave],
        alongEave: side === -1 ? [1, 0, 0] : [-1, 0, 0],
        upSlope: [0, slope / lenPerFtRun, (side === -1 ? 1 : -1) / lenPerFtRun],
        normal: cross([0, slope / lenPerFtRun, (side === -1 ? 1 : -1) / lenPerFtRun],
          side === -1 ? [1, 0, 0] : [-1, 0, 0]),
        eaveLengthFt: L,
        slopeLengthFt,
        topLengthFt: Math.max(0, L - W),
      });
    }
    // Hip ends. At x = 0 uphill is +X and u runs -Z; at x = L it is mirrored. Both taper to a
    // point, so `topLengthFt` is 0 and the tiler cuts every course to the triangle.
    for (const end of [-1, 1] as const) {
      const upSlope: [number, number, number] = [end === -1 ? 1 / lenPerFtRun : -1 / lenPerFtRun, slope / lenPerFtRun, 0];
      const alongEave: [number, number, number] = end === -1 ? [0, 0, -1] : [0, 0, 1];
      planes.push({
        id: end === -1 ? 'roof-W' : 'roof-E',
        origin: [end === -1 ? -oh : L + oh, yEave, end === -1 ? W : 0],
        alongEave,
        upSlope,
        normal: cross(upSlope, alongEave),
        eaveLengthFt: W,
        slopeLengthFt,
        topLengthFt: 0,
      });
    }
    return planes;
  }

  if (roof.kind === 'gable') {
    const halfSpan = W / 2;
    const run = halfSpan + oh;
    const yEave = plateTopY - oh * slope;
    const planes: RoofPlane[] = [];
    for (const side of [-1, 1] as const) {
      const zEave = side === -1 ? -oh : W + oh;
      // u runs +X on the south slope, -X on the north, so both planes' normals point up/out.
      const alongEave: [number, number, number] = side === -1 ? [1, 0, 0] : [-1, 0, 0];
      const upSlope: [number, number, number] = [0, slope / lenPerFtRun, (side === -1 ? 1 : -1) / lenPerFtRun];
      planes.push({
        id: side === -1 ? 'roof-S' : 'roof-N',
        origin: [side === -1 ? 0 : L, yEave, zEave],
        alongEave,
        upSlope,
        normal: cross(upSlope, alongEave),
        eaveLengthFt: L,
        slopeLengthFt: run * lenPerFtRun,
      });
    }
    return planes;
  }

  // Shed and flat: one plane, low eave to high eave.
  const highSide: WallId = roof.kind === 'shed' ? roof.highSide : 'N';
  const alongZ = slopeAlongZ(highSide);
  const span = alongZ ? W : L;
  const run = span + 2 * oh;
  const yLowEave = plateTopY - oh * slope;

  if (alongZ) {
    const up = highSide === 'N' ? 1 : -1; // +Z is uphill when N is high
    const zEave = up === 1 ? -oh : W + oh;
    const alongEave: [number, number, number] = up === 1 ? [1, 0, 0] : [-1, 0, 0];
    const upSlope: [number, number, number] = [0, slope / lenPerFtRun, up / lenPerFtRun];
    return [{
      id: 'roof-shed',
      origin: [up === 1 ? 0 : L, yLowEave, zEave],
      alongEave,
      upSlope,
      normal: cross(upSlope, alongEave),
      eaveLengthFt: L,
      slopeLengthFt: run * lenPerFtRun,
    }];
  }
  const up = highSide === 'E' ? 1 : -1; // +X is uphill when E is high
  const xEave = up === 1 ? -oh : L + oh;
  const alongEave: [number, number, number] = up === 1 ? [0, 0, -1] : [0, 0, 1];
  const upSlope: [number, number, number] = [up / lenPerFtRun, slope / lenPerFtRun, 0];
  return [{
    id: 'roof-shed',
    origin: [xEave, yLowEave, up === 1 ? W : 0],
    alongEave,
    upSlope,
    normal: cross(upSlope, alongEave),
    eaveLengthFt: W,
    slopeLengthFt: run * lenPerFtRun,
  }];
}

/**
 * What each wall has to close in ABOVE its cap plate, as a height at every station along the
 * run. This is the outline the framing already follows — gable studs, a shed's pony wall and
 * its rake studs — stated once so the covering pass can skin it instead of leaving it open.
 *
 * Which walls get one is the roof's own geometry, and a hip is the proof that "always" would
 * be wrong: all four of its slopes come down to the plate, so a hip has no infill anywhere,
 * which is exactly why its walls looked right while every gable end did not.
 */
export function wallInfillProfiles(
  spec: BuildingSpec,
  walls: WallsContract,
): { wall: WallId; topAt: (u: number) => number }[] {
  const roof = spec.roof;
  if (roof.kind === 'none' || roof.kind === 'hip' || roof.kind === 'pyramid') return [];
  const { lengthFt: L, widthFt: W } = spec.dims;
  const { slope } = slopeOf(roof);
  const out: { wall: WallId; topAt: (u: number) => number }[] = [];
  // The whole roof plane sits one seat above the plate (see `rafterPlaneDatum`), so the wall
  // that closes in under it rises by the same amount — otherwise the siding stops short of the
  // rake by an inch and three quarters and daylight shows through the gable.
  const lift = rafterPlaneDatum(spec, 0);

  if (roof.kind === 'gable') {
    // The ridge runs along X over z = W/2, so the two walls that run along Z — E and W — carry
    // a triangle rising to the ridge over the middle of the span. N and S bear the rafters and
    // stop at the plate.
    for (const wall of ['E', 'W'] as const) {
      const s = walls.surfaces.find((q) => q.wall === wall);
      if (!s) continue;
      out.push({
        wall,
        topAt: (u) => {
          const z = s.origin[1] + s.along[1] * u;
          return Math.max(0, lift + (W / 2 - Math.abs(z - W / 2)) * slope);
        },
      });
    }
    return out;
  }

  // Shed and flat: one slope. The high wall carries a full-height pony wall, the two walls
  // parallel to the slope carry a rake rising from the low side, and the low wall stops at
  // the plate.
  const highSide: WallId = roof.kind === 'shed' ? roof.highSide : 'N';
  const alongZ = slopeAlongZ(highSide);
  const span = alongZ ? W : L;
  const up = highSide === 'N' || highSide === 'E' ? 1 : -1;
  const high = walls.surfaces.find((q) => q.wall === highSide);
  if (high) out.push({ wall: highSide, topAt: () => lift + span * slope });
  for (const wall of (alongZ ? ['E', 'W'] : ['S', 'N']) as WallId[]) {
    const s = walls.surfaces.find((q) => q.wall === wall);
    if (!s) continue;
    out.push({
      wall,
      topAt: (u) => {
        const across = alongZ ? s.origin[1] + s.along[1] * u : s.origin[0] + s.along[0] * u;
        const fromLow = up === 1 ? across : span - across;
        return Math.max(0, lift + fromLow * slope);
      },
    });
  }
  return out;
}

export interface ShedInput {
  spec: BuildingSpec;
  walls: WallsContract;
  stageRoofFrame: number;
}

/**
 * Shed/flat framing: rafters low plate → high plate, the TD6 pony wall on the high side, and
 * rake infill up the two side walls. Emitted with the `RF` prefix, matching the gable path.
 */
export function generateShed(input: ShedInput): Member[] {
  const { spec, walls, stageRoofFrame } = input;
  const roof = spec.roof;
  if (roof.kind !== 'shed' && roof.kind !== 'flat') return [];
  const emit = makeEmitter('RF');

  const { lengthFt: L, widthFt: W } = spec.dims;
  const H = walls.plateTopY;
  const { slope, lenPerFtRun, pitchRad } = slopeOf(roof);
  const oh = roof.overhangFt;
  const highSide: WallId = roof.kind === 'shed' ? roof.highSide : 'N';
  const alongZ = slopeAlongZ(highSide);
  const span = alongZ ? W : L;
  const ridgeRun = alongZ ? L : W; // the horizontal extent perpendicular to the slope
  const t = DRESSED['2x4']!.w / IN_PER_FT;
  const rafterD = DRESSED[LUMBER.rafterNominal.value as string]!.d / IN_PER_FT;
  const oc = spec.spacing.rafterSpacingIn / IN_PER_FT;
  const up = highSide === 'N' || highSide === 'E' ? 1 : -1;

  const rafterCite = `${citeOf(LUMBER.rafterNominal)} · framing-square method: ${lenPerFtRun.toFixed(3)} ft per ft of run`;
  const rafterLen = (span + 2 * oh) * lenPerFtRun;

  // Layout grid along the ridge direction — same rule as every other run: ends flush, the
  // interior on exact OC multiples so panel edges land on member centers.
  const centers: number[] = [t / 2];
  for (let s = oc; s < ridgeRun - 1.5 * t; s += oc) centers.push(s);
  centers.push(ridgeRun - t / 2);

  // H is the cap plate top — where the pony wall and the rake infill start. The RAFTERS start
  // one seat higher, so they bear on the plate instead of running through it.
  const yLowEave = rafterPlaneDatum(spec, H) - oh * slope;
  const yMid = yLowEave + ((span + 2 * oh) / 2) * slope;

  for (const c of centers) {
    // ON the plane, full stop. `roofPlanes` returns the rafter CENTRE plane — the deck is placed
    // off it by rafterHalf + panelHalf along the normal — so a rafter's centre line IS yMid.
    // This used to subtract a PERPENDICULAR half-depth and add back a VERTICAL one, which is not
    // a correction of anything: it left every shed rafter 0.085 in below its own roof plane, so
    // the deck floated a sixteenth of an inch off the rafters carrying it.
    const midAcross = (up === 1 ? -oh : span + oh) + up * ((span + 2 * oh) / 2);
    const pos: [number, number, number] = alongZ
      ? [c, yMid, midAcross]
      : [midAcross, yMid, c];
    emit('rafter', LUMBER.rafterNominal.value as string, {
      cutLengthFt: rafterLen,
      position: pos,
      // Rotation order is YXZ, so rz tilts the member in its LOCAL frame first and ry then
      // swings it onto the run. For a Z-running rafter, ry = -90° maps local +X to world +Z
      // and local +Y stays up, so a positive rz climbs toward +Z — which is uphill exactly
      // when `up` is +1. (Getting this sign backwards puts the rafters below the deck they
      // are supposed to carry; the deck is placed off the PLANE, so only the framing moves.)
      rotation: alongZ ? [0, -Math.PI / 2, up * pitchRad] : [0, 0, up * pitchRad],
      stage: stageRoofFrame,
      angles: { plumbCut: 90 - (pitchRad * 180) / Math.PI, seatCut: (pitchRad * 180) / Math.PI },
      nailing: 'bird’s-mouth toenail 3-8d each plate (PH)',
      doctrineRef: rafterCite,
    });
  }

  // ── TD6: the pony wall. The high wall is a normal rectangular wall; the height difference
  // is framed HERE as studs above its cap plate, so `generateWalls` is never asked for an
  // unequal wall.
  //
  // IT HAD NO PLATE, and its studs were the wrong length. Thirty-seven studs stood free at the
  // top with the rafters running straight over their bare ends and 1.4 in INTO them — the same
  // defect the bird's mouth fixed at the low wall, except here there was no plate for the notch
  // to find, so nothing could even detect it. A pony wall is a wall: it gets a plate, the
  // rafters bear on that plate, and the studs are cut to leave room for it.
  //
  // The height is (span − plateWidth)·slope, NOT span·slope. The seat at the LOW wall lands at
  // the plate's inner face and the seat at the HIGH wall at its outer face, so the rise between
  // the two plate tops is one plate short of the full span. Using span·slope stands the pony
  // wall 7/8 in proud of where the rafters actually want to sit.
  const ponyPlateNominal = LUMBER.plateNominal.value as string;
  const ponyPlateThick = DRESSED[ponyPlateNominal]!.w / IN_PER_FT;
  const plateWidthFt = DRESSED[ponyPlateNominal]!.d / IN_PER_FT;
  const ponyHeight = (span - plateWidthFt) * slope;
  if (ponyHeight > TOLERANCE.minSliverFt + ponyPlateThick) {
    const studLen = ponyHeight - ponyPlateThick;
    const studNominal = LUMBER.studNominal.value as string;
    const highSurface = walls.surfaces.find((s) => s.wall === highSide)!;
    const ocStud = spec.spacing.studSpacingIn / IN_PER_FT;
    const runFt = highSurface.runFt;
    const studCenters: number[] = [t / 2];
    for (let s = ocStud; s < runFt - 1.5 * t; s += ocStud) studCenters.push(s);
    studCenters.push(runFt - t / 2);
    for (const u of studCenters) {
      const x = highSurface.origin[0] + highSurface.along[0] * u;
      const z = highSurface.origin[1] + highSurface.along[1] * u;
      emit('ponyStud', studNominal, {
        cutLengthFt: studLen,
        position: [x, H + studLen / 2, z],
        rotation: [0, 0, Math.PI / 2],
        stage: stageRoofFrame,
        wall: highSide,
        nailing: 'toenail 2-8d each end (PH)',
        doctrineRef: `${citeOf(LUMBER.studNominal)} — shed pony wall carrying the high plate`,
      });
    }
    // The plate itself: flat on the stud tops, running the wall, and the surface the rafters'
    // upper bird's mouth is cut against.
    emit('capPlate', ponyPlateNominal, {
      cutLengthFt: highSurface.runFt,
      position: [
        highSurface.origin[0] + (highSurface.along[0] * highSurface.runFt) / 2,
        H + studLen + ponyPlateThick / 2,
        highSurface.origin[1] + (highSurface.along[1] * highSurface.runFt) / 2,
      ],
      rotation: alongZ ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2, Math.PI / 2, 0],
      stage: stageRoofFrame,
      wall: highSide,
      nailing: '16d @ 16" to the studs; rafters bird’s-mouth toenail 3-8d (PH)',
      doctrineRef: `${citeOf(LUMBER.plateNominal)} — the pony wall's bearing plate for the rafters`,
    });
  }

  // ── Rake infill: the two walls parallel to the slope get studs stepping up to the rafter
  // underside, exactly like gable studs.
  const rakeWalls: WallId[] = alongZ ? ['E', 'W'] : ['S', 'N'];
  for (const wall of rakeWalls) {
    const surface = walls.surfaces.find((s) => s.wall === wall)!;
    const ocStud = spec.spacing.studSpacingIn / IN_PER_FT;
    for (let u = ocStud; u < surface.runFt - TOLERANCE.epsFt; u += ocStud) {
      const x = surface.origin[0] + surface.along[0] * u;
      const z = surface.origin[1] + surface.along[1] * u;
      // Distance uphill from the low plate at this station.
      const across = alongZ ? z : x;
      const fromLow = up === 1 ? across : span - across;
      // Measured from the cap plate up to the rafter underside, off the rafter plane's own
      // datum — the same correction the gable studs take.
      const riseHere = rafterPlaneDatum(spec, H) - H + fromLow * slope - (rafterD / 2) / Math.cos(pitchRad);
      if (riseHere < TOLERANCE.minInfillStudFt) continue;
      emit('rakeStud', LUMBER.studNominal.value as string, {
        cutLengthFt: riseHere,
        position: [x, H + riseHere / 2, z],
        rotation: [0, 0, Math.PI / 2],
        stage: stageRoofFrame,
        wall,
        nailing: 'toenail 2-8d each end (PH)',
        doctrineRef: `${citeOf(LUMBER.studNominal)} — rake infill under the shed slope`,
      });
    }
  }

  return emit.members;
}

/**
 * Purlin deck (SEA-hut pattern): 2x4 flat, spaced up the slope, for corrugated roofing.
 *
 * Three placement rules, each earned by a screenshot of the roof doing without it:
 *
 *   CLIPPED TO THE PLANE. A course is only as long as the plane is wide at its UP-SLOPE edge
 *   (`planeSpanAt`) — on a hip that edge is the narrow one, so the stick is mitered back to
 *   the hip lines instead of running full eave length and lancing out over the neighbouring
 *   slope, which is exactly what the first cut of this drew.
 *
 *   ON the rafters. `rafterHalfFt` lifts the underside to the rafter tops, the same lift the
 *   sheet deck gets; without it the purlins sat embedded in the upper half of the rafters.
 *
 *   PITCHED with the slope, the `roofTilePlacement` rotation convention — flat but lying IN
 *   the plane, not floating horizontal with one edge dug in.
 */
export function generatePurlins(planes: RoofPlane[], stage: number, rafterHalfFt: number): Member[] {
  const emit = makeEmitter('RF');
  const nominal = LUMBER.purlinNominal.value as string;
  const spacing = (LAYOUT.purlinSpacingMaxIn.value as number) / IN_PER_FT;
  const thick = DRESSED[nominal]!.w / IN_PER_FT; // laid flat: the 1½-in way is the thickness
  const face = DRESSED[nominal]!.d / IN_PER_FT; // the 3½-in face lies along the slope
  const lift = rafterHalfFt + thick / 2;
  for (const p of planes) {
    // The top course stops half a face short of the ridge or peak, so nothing crosses it —
    // the two long slopes of a hip otherwise both put a stick exactly ON the ridge line.
    const vTop = p.slopeLengthFt - face / 2;
    if (vTop <= 0) continue;
    const rows = Math.max(2, Math.ceil(vTop / spacing) + 1);
    for (let i = 0; i < rows; i++) {
      const v = Math.min(vTop, i * (vTop / (rows - 1)));
      const span = planeSpanAt(p, v + face / 2);
      const len = span.hi - span.lo;
      // A stub shorter than its own face is layout noise, not a purlin.
      if (len < face) continue;
      const uMid = (span.lo + span.hi) / 2;
      const cx = p.origin[0] + p.upSlope[0] * v + p.alongEave[0] * uMid + p.normal[0] * lift;
      const cy = p.origin[1] + p.upSlope[1] * v + p.alongEave[1] * uMid + p.normal[1] * lift;
      const cz = p.origin[2] + p.upSlope[2] * v + p.alongEave[2] * uMid + p.normal[2] * lift;
      const yaw = Math.atan2(-p.alongEave[2]!, p.alongEave[0]!);
      const pitch = Math.asin(Math.max(-1, Math.min(1, p.upSlope[1]!)));
      emit('purlin', nominal, {
        cutLengthFt: len,
        position: [cx, cy, cz],
        rotation: [Math.PI / 2 - pitch, yaw, 0],
        stage,
        nailing: '2-16d each rafter (PH)',
        doctrineRef: citeOf(LAYOUT.purlinSpacingMaxIn),
      });
    }
  }
  return emit.members;
}

// ── Hip (T8) ─────────────────────────────────────────────────────────────────
//
// An equal-pitch hip: four slopes, a ridge over the middle of a rectangular plan, and hip
// rafters running out to the four corners. Two pieces of arithmetic define it, and both are
// asserted in `timber2-hip`:
//
//   THE HIP RUN IS DIAGONAL. A common rafter rises over a run of half the span; a hip rises
//   over the DIAGONAL of that run, so its length per foot of run is √(2 + slope²) rather than
//   √(1 + slope²). Using the common-rafter figure is the classic hip mistake and it produces a
//   hip that is short by about a foot in twelve.
//
//   JACK RAFTERS SHORTEN IN AN ARITHMETIC SEQUENCE. Each jack is one common-rafter spacing
//   further along the plate, so it is shorter than its neighbour by exactly the same amount
//   every time. That constant difference is the number a framing square gives you, and it is
//   what makes a hip layable-out without measuring each stick.

export interface HipInput {
  spec: BuildingSpec;
  walls: WallsContract;
  stageCeiling: number;
  stageRoofFrame: number;
}

/** Length per foot of COMMON run, for a hip rafter running the diagonal. */
export function hipLenPerFtRun(slope: number): number {
  return Math.sqrt(2 + slope * slope);
}

/** The constant by which each successive jack rafter shortens, in feet. */
export function jackDifference(slope: number, spacingFt: number): number {
  return spacingFt * Math.sqrt(1 + slope * slope);
}

export function generateHip(input: HipInput): Member[] {
  const emit = makeEmitter('HP');
  const { spec, walls, stageCeiling, stageRoofFrame: stage } = input;
  const roof = spec.roof;
  if (roof.kind !== 'hip') return emit.members;
  const { slope, lenPerFtRun } = slopeOf(roof);
  const L = spec.dims.lengthFt;
  const W = spec.dims.widthFt;
  const oh = roof.overhangFt;
  const halfSpan = W / 2;
  const plateTopY = walls.plateTopY;
  // Ceiling joists bear ON the plate top; the roof frame starts one seat above it, so the
  // commons and jacks have a bird's mouth to cut instead of running through the plate.
  const roofY = rafterPlaneDatum(spec, plateTopY);
  const ridgeY = roofY + halfSpan * slope;
  const rafterNominal = LUMBER.rafterNominal.value as string;
  const ridgeNominal = LUMBER.ridgeNominal.value as string;
  const spacingFt = spec.spacing.rafterSpacingIn / IN_PER_FT;

  // Ceiling joists first — a hip thrusts on its plates no less than a gable, and the tie is
  // the same one the frozen gable path lays: joists on edge across the width, bearing on both
  // cap plates, interior stations only. Emitted before the roof frame because they are BUILT
  // before it, and they are why the plan's ceiling stage is never an empty stop on a hip.
  const cjNominal = LUMBER.ceilingJoistNominal.value as string;
  const cjD = DRESSED[cjNominal]!.d / IN_PER_FT;
  for (let x = spacingFt; x < L - spacingFt / 2 - TOLERANCE.epsFt; x += spacingFt) {
    emit('joist', cjNominal, {
      cutLengthFt: W,
      position: [x, plateTopY + cjD / 2, W / 2],
      rotation: [0, -Math.PI / 2, 0],
      stage: stageCeiling,
      nailing: '3-16d toenail ea plate + 16d to rafter (PH)',
      doctrineRef: citeOf(LUMBER.ceilingJoistNominal),
    });
  }

  // The ridge runs the length, stopping halfSpan short of each end — that is where the hips
  // converge on it, and it is why a hip roof's ridge is shorter than its building.
  const ridgeLen = Math.max(0.5, L - 2 * halfSpan);
  emit('ridge', ridgeNominal, {
    cutLengthFt: ridgeLen,
    position: [L / 2, ridgeY, W / 2],
    rotation: [0, 0, 0],
    stage,
    nailing: 'commons and hips 3-16d ea (PH)',
    doctrineRef: `${citeOf(LUMBER.ridgeNominal)} — hip ridge is shortened by half the span at each end`,
  });

  // Common rafters along the ridge's length, both slopes.
  const commonLen = (halfSpan + oh) * lenPerFtRun;
  for (let x = L / 2 - ridgeLen / 2; x <= L / 2 + ridgeLen / 2 + 1e-6; x += spacingFt) {
    for (const side of [-1, 1] as const) {
      const zEave = side === -1 ? -oh : W + oh;
      emit('rafter', rafterNominal, {
        cutLengthFt: commonLen,
        position: [x, (roofY - oh * slope + ridgeY) / 2, (zEave + W / 2) / 2],
        rotation: [0, side === -1 ? -Math.PI / 2 : Math.PI / 2, Math.atan2(halfSpan * slope, halfSpan + oh)],
        stage,
        angles: { plumbCut: 90 - (Math.atan(slope) * 180) / Math.PI, seatCut: (Math.atan(slope) * 180) / Math.PI },
        nailing: '3-16d at ridge, bird’s-mouth toenail 3-8d (PH)',
        doctrineRef: citeOf(LUMBER.rafterNominal),
      });
    }
  }

  // Four hips, corner to ridge end. The run is the DIAGONAL, which is the whole difference.
  const hipLen = (halfSpan + oh) * hipLenPerFtRun(slope);
  for (const [cx, cz] of [[-oh, -oh], [L + oh, -oh], [L + oh, W + oh], [-oh, W + oh]] as [number, number][]) {
    const rx = cx < L / 2 ? L / 2 - ridgeLen / 2 : L / 2 + ridgeLen / 2;
    const run = Math.hypot(rx - cx, W / 2 - cz);
    emit('hipRafter', rafterNominal, {
      cutLengthFt: hipLen,
      position: [(cx + rx) / 2, (roofY - oh * slope + ridgeY) / 2, (cz + W / 2) / 2],
      rotation: [0, Math.atan2(-(W / 2 - cz), rx - cx), Math.atan2(ridgeY - (roofY - oh * slope), run)],
      stage,
      nailing: '3-16d at the ridge; jacks bear on it both sides (PH)',
      doctrineRef: `${citeOf(LUMBER.rafterNominal)} — hip run is the diagonal: ${hipLenPerFtRun(slope).toFixed(3)} ft per ft of common run`,
    });
  }

  // Jacks. A hip on an equal-pitch roof runs at 45 degrees in plan, so a jack landing `back`
  // feet from the corner meets the hip after exactly `back` feet of run — which is why the
  // sequence is arithmetic and why the framing square can give you one number for the whole
  // set. Length is (back + overhang) x the common length per foot of run; adding the same tail
  // to every jack leaves the difference between them untouched.
  //
  // Each jack is placed from its EAVE end to its HIP end, so the position and the length come
  // from the same two points. The first cut of this built the length from one formula and the
  // position from another, and the jacks came out fanned across the corners in mid-air.
  const diff = jackDifference(slope, spacingFt);
  void diff; // the sequence is implied by the geometry below; exported for the test and the card
  for (const [cx, cz, dirX, dirZ] of [
    [0, 0, 1, 1], [L, 0, -1, 1], [L, W, -1, -1], [0, W, 1, -1],
  ] as [number, number, number, number][]) {
    for (let back = spacingFt; back < halfSpan - 1e-6; back += spacingFt) {
      const lenFt = (back + oh) * lenPerFtRun;
      const yEave = roofY - oh * slope;
      const yHip = roofY + back * slope;
      const pitch = Math.atan(slope);
      // Jack on the LONG wall: fixed x, running in z from the eave up to the hip.
      emit('jackRafter', rafterNominal, {
        cutLengthFt: lenFt,
        position: [cx + dirX * back, (yEave + yHip) / 2, cz + (dirZ * (back - oh)) / 2],
        rotation: [0, dirZ > 0 ? -Math.PI / 2 : Math.PI / 2, pitch],
        stage,
        nailing: 'bevel-cut to the hip, 3-16d; bird’s-mouth toenail 3-8d (PH)',
        doctrineRef: `${citeOf(LUMBER.rafterNominal)} — jacks shorten ${jackDifference(slope, spacingFt).toFixed(3)} ft each at ${spec.spacing.rafterSpacingIn} in o.c.`,
      });
      // Jack on the SHORT wall: fixed z, running in x.
      emit('jackRafter', rafterNominal, {
        cutLengthFt: lenFt,
        position: [cx + (dirX * (back - oh)) / 2, (yEave + yHip) / 2, cz + dirZ * back],
        rotation: [0, dirX > 0 ? 0 : Math.PI, pitch],
        stage,
        nailing: 'bevel-cut to the hip, 3-16d; bird’s-mouth toenail 3-8d (PH)',
        doctrineRef: `${citeOf(LUMBER.rafterNominal)} — jacks shorten ${jackDifference(slope, spacingFt).toFixed(3)} ft each at ${spec.spacing.rafterSpacingIn} in o.c.`,
      });
    }
  }
  return emit.members;
}
