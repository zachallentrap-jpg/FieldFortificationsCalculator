// TIMBER-2 — interior partitions.
//
// THE B-HUT IS DEFINED BY ITS BAYS, and it did not have any. `bHutPartitions()` computed three
// dividing walls, `buildingSpecForHut` put them on the spec, `isLegacyBuilding` checked for them
// — and `generateBuilding` never read the field. Nothing was ever framed. The card's own cutaway
// even said "cut across the bays — see how the partitions land between the studs", which is a
// promise about members that did not exist, aimed by a cut plane at empty air.
//
// A partition is a NON-BEARING wall: sole plate, studs, ONE top plate under the ceiling framing
// (an exterior wall's doubled cap is what carries a roof, and a partition carries nothing), and
// a framed doorway where the spec asks for one. It butts between the exterior walls rather than
// running through them, the same convention `wallSystem` uses for the E/W walls.

import type { Member } from '../types';
import { DRESSED } from '../types';
import type { BuildingSpec, PartitionSpec } from '../spec';
import { makeEmitter } from '../emit';
import { LUMBER, OPENING, TOLERANCE, IN_PER_FT, citeOf } from '../doctrine';
import { headerForSpan } from '../normalize';
import { layoutCenters } from '../floor';

export interface PartitionInput {
  spec: BuildingSpec;
  /** Top of the cap plate — a partition stops under whatever the exterior walls carry. */
  wallHeightFt: number;
  stage: number;
}

/** Where one partition runs, in plan. */
function runOf(p: PartitionSpec, L: number, W: number, thickFt: number): {
  origin: [number, number]; along: [number, number]; runFt: number;
} {
  // `axis` names the direction the wall RUNS, and `stationFt` is measured across it.
  return p.axis === 'Z'
    ? { origin: [p.stationFt, thickFt], along: [0, 1], runFt: Math.max(0.5, W - 2 * thickFt) }
    : { origin: [thickFt, p.stationFt], along: [1, 0], runFt: Math.max(0.5, L - 2 * thickFt) };
}

export function generatePartitions(input: PartitionInput): Member[] {
  const emit = makeEmitter('PT');
  const { spec, wallHeightFt: H, stage } = input;
  const list = spec.partitions ?? [];
  if (list.length === 0) return emit.members;

  const { lengthFt: L, widthFt: W } = spec.dims;
  const studNominal = LUMBER.studNominal.value as string;
  const plateNominal = LUMBER.plateNominal.value as string;
  const plateT = DRESSED[plateNominal]!.w / IN_PER_FT; // laid flat: 1½ in of height
  const thick = DRESSED[plateNominal]!.d / IN_PER_FT; // 3½ in — the wall's own thickness
  const oc = spec.spacing.studSpacingIn / IN_PER_FT;

  for (const part of list) {
    const { origin, along, runFt } = runOf(part, L, W, thick);
    // Plan position at distance u along the run, and the yaw that points a member down it.
    const at = (u: number): [number, number] => [origin[0] + along[0] * u, origin[1] + along[1] * u];
    const yaw = Math.atan2(-along[1], along[0]);
    const studBottom = plateT;
    const studTop = H - plateT;
    const studLen = Math.max(TOLERANCE.minSliverFt, studTop - studBottom);

    // The doorway, if this partition has one, as a half-open span of u.
    const door = part.door;
    const doorH = Math.min(OPENING.doorHeightFt.value as number, studTop - studBottom);
    const d0 = door ? Math.max(0, Math.min(door.offsetFt, runFt - door.widthFt)) : 0;
    const d1 = door ? d0 + door.widthFt : 0;
    const inDoor = (u: number): boolean => !!door && u > d0 - thick / 2 && u < d1 + thick / 2;

    const plateAt = (role: 'solePlate' | 'topPlate', u0: number, u1: number, y: number): void => {
      if (u1 - u0 <= TOLERANCE.minSliverFt) return;
      const mid = at((u0 + u1) / 2);
      emit(role, plateNominal, {
        cutLengthFt: u1 - u0,
        position: [mid[0], y, mid[1]],
        rotation: [-Math.PI / 2, yaw, 0], // FLAT — a plate lies on its face
        stage,
        nailing: '16d @ 16" to the framing (PH)',
        doctrineRef: `${citeOf(LUMBER.plateNominal)} — non-bearing partition, single top plate`,
      });
    };

    // Sole plate, cut out at the doorway; one top plate over the whole run.
    if (door) {
      plateAt('solePlate', 0, d0, plateT / 2);
      plateAt('solePlate', d1, runFt, plateT / 2);
    } else {
      plateAt('solePlate', 0, runFt, plateT / 2);
    }
    plateAt('topPlate', 0, runFt, H - plateT / 2);

    // Studs on the layout, skipping the doorway — the jacks and kings frame that.
    for (const u of layoutCenters(runFt, oc, thick)) {
      if (inDoor(u)) continue;
      const c = at(u);
      emit('stud', studNominal, {
        cutLengthFt: studLen,
        position: [c[0], studBottom + studLen / 2, c[1]],
        rotation: [0, yaw, Math.PI / 2],
        stage,
        nailing: 'toenail 3-8d each plate (PH)',
        doctrineRef: citeOf(LUMBER.studNominal),
      });
    }

    if (!door) continue;

    // Doorway: a king each side full height, a jack inside it carrying the header, and cripples
    // filling from the header up to the top plate.
    const headerNominal = headerForSpan(door.widthFt);
    const headerD = DRESSED[headerNominal]!.d / IN_PER_FT;
    for (const [u, side] of [[d0 - thick / 2, -1], [d1 + thick / 2, 1]] as [number, number][]) {
      const c = at(u);
      emit('kingStud', studNominal, {
        cutLengthFt: studLen,
        position: [c[0], studBottom + studLen / 2, c[1]],
        rotation: [0, yaw, Math.PI / 2],
        stage,
        nailing: '16d @ 12" to the jack (PH)',
        doctrineRef: citeOf(LUMBER.studNominal),
      });
      const j = at(u - side * thick / 2);
      emit('jackStud', studNominal, {
        cutLengthFt: doorH,
        position: [j[0], studBottom + doorH / 2, j[1]],
        rotation: [0, yaw, Math.PI / 2],
        stage,
        nailing: '16d @ 12" to the king (PH)',
        doctrineRef: `${citeOf(LUMBER.studNominal)} — carries the doorway header`,
      });
    }
    const hMid = at((d0 + d1) / 2);
    emit('header', headerNominal, {
      cutLengthFt: door.widthFt + thick,
      position: [hMid[0], studBottom + doorH + headerD / 2, hMid[1]],
      rotation: [0, yaw, 0],
      stage,
      nailing: '16d @ 16" each side (PH)',
      doctrineRef: `${citeOf(LUMBER.headerNominal)} — partition doorway`,
    });
    const crippleLen = studTop - (studBottom + doorH + headerD);
    if (crippleLen > TOLERANCE.minInfillStudFt) {
      for (let u = d0; u <= d1 + 1e-6; u += oc) {
        const c = at(Math.min(u, d1));
        emit('cripple', studNominal, {
          cutLengthFt: crippleLen,
          position: [c[0], studBottom + doorH + headerD + crippleLen / 2, c[1]],
          rotation: [0, yaw, Math.PI / 2],
          stage,
          nailing: 'toenail 3-8d each end (PH)',
          doctrineRef: `${citeOf(LUMBER.studNominal)} — cripple over the doorway header`,
        });
      }
    }
  }
  return emit.members;
}
