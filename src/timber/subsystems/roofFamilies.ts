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

/** A roof surface in its own (u along the eave, v up the slope) coordinates. */
export interface RoofPlane {
  id: string;
  origin: [number, number, number]; // world position of (u=0, v=0) — the eave's left end
  alongEave: [number, number, number]; // unit
  upSlope: [number, number, number]; // unit, in the plane
  normal: [number, number, number]; // unit, outward (up)
  eaveLengthFt: number;
  slopeLengthFt: number;
}

const cross = (a: number[], b: number[]): [number, number, number] => [
  a[1]! * b[2]! - a[2]! * b[1]!,
  a[2]! * b[0]! - a[0]! * b[2]!,
  a[0]! * b[1]! - a[1]! * b[0]!,
];

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
 * The roof's surfaces, for any roof kind. Gable returns two planes, shed/flat one, pyramid
 * four. Every plane's `origin` is at the EAVE, so tiling from v=0 upward lays courses the way
 * a roofer works: from the bottom up, each course lapping the one below.
 */
export function roofPlanes(spec: BuildingSpec, plateTopY: number): RoofPlane[] {
  const { lengthFt: L, widthFt: W } = spec.dims;
  const roof = spec.roof;
  if (roof.kind === 'none') return [];
  const { slope, lenPerFtRun } = slopeOf(roof);
  const oh = roof.overhangFt; // 'none' returned above, so every remaining kind has one

  if (roof.kind === 'gable' || roof.kind === 'hip') {
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

  const yLowEave = H - oh * slope;
  const yMid = yLowEave + ((span + 2 * oh) / 2) * slope;

  for (const c of centers) {
    // Rafter centerline midpoint, lifted half its depth so its TOP is the roof plane.
    const midAcross = (up === 1 ? -oh : span + oh) + up * ((span + 2 * oh) / 2);
    const lift = (rafterD / 2) / Math.cos(pitchRad);
    const pos: [number, number, number] = alongZ
      ? [c, yMid - lift + rafterD / 2, midAcross]
      : [midAcross, yMid - lift + rafterD / 2, c];
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
  const ponyHeight = span * slope;
  if (ponyHeight > TOLERANCE.minSliverFt) {
    const studLen = ponyHeight;
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
      const riseHere = fromLow * slope - (rafterD / 2) / Math.cos(pitchRad);
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

/** Purlin deck (SEA-hut pattern): 2x4 flat, spaced up the slope, for corrugated roofing. */
export function generatePurlins(planes: RoofPlane[], stage: number): Member[] {
  const emit = makeEmitter('RF');
  const nominal = LUMBER.purlinNominal.value as string;
  const spacing = (LAYOUT.purlinSpacingMaxIn.value as number) / IN_PER_FT;
  const thick = DRESSED[nominal]!.w / IN_PER_FT;
  for (const p of planes) {
    const rows = Math.max(2, Math.ceil(p.slopeLengthFt / spacing) + 1);
    for (let i = 0; i < rows; i++) {
      const v = Math.min(p.slopeLengthFt, i * (p.slopeLengthFt / (rows - 1)));
      const cx = p.origin[0] + p.upSlope[0] * v + p.alongEave[0] * (p.eaveLengthFt / 2) + p.normal[0] * thick / 2;
      const cy = p.origin[1] + p.upSlope[1] * v + p.alongEave[1] * (p.eaveLengthFt / 2) + p.normal[1] * thick / 2;
      const cz = p.origin[2] + p.upSlope[2] * v + p.alongEave[2] * (p.eaveLengthFt / 2) + p.normal[2] * thick / 2;
      const yaw = Math.atan2(-p.alongEave[2]!, p.alongEave[0]!);
      emit('purlin', nominal, {
        cutLengthFt: p.eaveLengthFt,
        position: [cx, cy, cz],
        rotation: [-Math.PI / 2, yaw, 0],
        stage,
        nailing: '2-16d each rafter (PH)',
        doctrineRef: citeOf(LAYOUT.purlinSpacingMaxIn),
      });
    }
  }
  return emit.members;
}
