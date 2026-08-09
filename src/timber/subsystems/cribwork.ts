// TIMBER-2 T7 — cribwork (plan §7 T7).
//
// A crib is a stack of timbers laid in alternating courses so each one bears across the two
// below it and the wall holds itself together without a fastener doing the work. Two properties
// make it a crib rather than a pile, and both are asserted in `timber2-bunker`:
//
//   ALTERNATION — consecutive courses run at right angles. A stack that runs the same way twice
//   in a row has a continuous vertical joint through it, which is the failure it exists to avoid.
//
//   INTERLOCK — the ends of one course sit ON the course below and are crossed by the one above.
//   The corner is the whole structural idea; everything else is stacking.
//
// This module builds a WALL of cribwork. What the wall is retaining, and whether that is
// enough of anything, is not a question it answers or is capable of answering (plan §2.7).

import type { Member } from '../types';
import { DRESSED } from '../types';
import { makeEmitter } from '../emit';
import { BUNKER, IN_PER_FT, citeOf } from '../doctrine';

export interface CribWallInput {
  /** Wall centre line in plan, from → to. */
  from: [x: number, z: number];
  to: [x: number, z: number];
  /** Course tops from `baseY` up to this height. */
  baseY: number;
  heightFt: number;
  /** How deep the crib is, across its run — two stacks of logs plus the gap between them. */
  depthFt: number;
  stage: number;
  /** Prefix for member ids, so a bunker's four walls do not renumber each other. */
  prefix: string;
  /**
   * A stretch of the run to leave clear, in the wall's own coordinates (0 at `from`).
   *
   * A crib wall is built by stacking, and a stack does not know about a doorway unless it is
   * told. The bunker's entrance was framed with jambs and a header and then had crib logs laid
   * straight through it: 380 of 1995 points sampled inside the clear opening came back solid
   * timber. Courses stop at the jambs now, and the header logs that would land in the opening
   * are not laid.
   */
  gap?: [number, number];
}

/**
 * One crib wall. Courses alternate: a STRETCHER course runs along the wall, a HEADER course
 * runs across it and ties the two stretcher stacks together.
 */
export function generateCribWall(input: CribWallInput): Member[] {
  const emit = makeEmitter(input.prefix);
  const nominal = BUNKER.cribLogNominal.value as string;
  const logH = DRESSED[nominal]!.d / IN_PER_FT; // course height
  const logW = DRESSED[nominal]!.w / IN_PER_FT;
  const runFt = Math.hypot(input.to[0] - input.from[0], input.to[1] - input.from[1]);
  if (runFt < logW || input.heightFt < logH) return emit.members;

  const ux = (input.to[0] - input.from[0]) / runFt;
  const uz = (input.to[1] - input.from[1]) / runFt;
  const yaw = Math.atan2(-uz, ux);
  const midX = (input.from[0] + input.to[0]) / 2;
  const midZ = (input.from[1] + input.to[1]) / 2;
  // Across the wall, in plan.
  const ax = -uz;
  const az = ux;
  const halfDepth = Math.max(logW, input.depthFt) / 2 - logW / 2;

  // One course is one log unless the doorway interrupts it, in which case it is the two logs
  // either side of the opening — which is what you would cut, and what leaves a hole.
  const spans: [number, number][] = input.gap
    ? ([[0, input.gap[0]], [input.gap[1], runFt]] as [number, number][]).filter((sp) => sp[1] - sp[0] > logW)
    : [[0, runFt]];

  const courses = cribCourseCount(input.heightFt);
  for (let c = 0; c < courses; c++) {
    const y = input.baseY + logH * (c + 0.5);
    if (c % 2 === 0) {
      // Stretchers: two runs, one at each face of the crib.
      for (const side of [-1, 1] as const) {
        for (const [u0, u1] of spans) {
          const mid = (u0 + u1) / 2;
          emit('cribLog', nominal, {
            cutLengthFt: u1 - u0,
            position: [
              input.from[0] + ux * mid + ax * side * halfDepth,
              y,
              input.from[1] + uz * mid + az * side * halfDepth,
            ],
            rotation: [0, yaw, 0],
            stage: input.stage,
            nailing: 'drift-pinned to the course below at every crossing (PH)',
            doctrineRef: citeOf(BUNKER.cribLogNominal),
          });
        }
      }
    } else {
      // Headers: laid across, spaced along the run, tying the two stretcher stacks. One at each
      // end without fail — the corner is where a crib is a crib.
      const spacing = BUNKER.postSpacingFt.value as number;
      const n = Math.max(2, Math.round(runFt / spacing) + 1);
      for (let i = 0; i < n; i++) {
        const d = (runFt * i) / (n - 1);
        // A tie laid across the doorway is a tie laid across the doorway — and a tie CENTRED on
        // the opening's edge still reaches half its own thickness into it, which is 2¾ in of
        // timber across the way in. The test caught that; the first cut compared centres.
        if (input.gap && d + logW / 2 > input.gap[0] + 1e-9 && d - logW / 2 < input.gap[1] - 1e-9) continue;
        emit('cribLog', nominal, {
          cutLengthFt: Math.max(logW, input.depthFt),
          position: [input.from[0] + ux * d, y, input.from[1] + uz * d],
          rotation: [0, Math.atan2(-az, ax), 0],
          stage: input.stage,
          nailing: 'drift-pinned to the course below at every crossing (PH)',
          doctrineRef: citeOf(BUNKER.cribLogNominal),
        });
      }
    }
  }
  return emit.members;
}

/** Courses in a wall of this height — exported so the test can assert alternation by index. */
export function cribCourseCount(heightFt: number): number {
  const logH = DRESSED[BUNKER.cribLogNominal.value as string]!.d / IN_PER_FT;
  return Math.max(1, Math.floor(heightFt / logH));
}

/**
 * How high the crib ACTUALLY comes, which is not the height it was asked for.
 *
 * A crib is built in whole courses and there is no half a log, so a 6 ft 6 in wall of 7¼-in
 * timbers tops out at 6 ft 0½ in. Nothing consumed that: the bunker set its cap beam at the
 * height it asked for, and the cap — with the overhead stringers, the roof lagging and two feet
 * of earth on top of it — bore on a 5½-in air gap all the way round. Whatever lands on a crib
 * lands HERE.
 */
export function cribWallTopFt(heightFt: number): number {
  const logH = DRESSED[BUNKER.cribLogNominal.value as string]!.d / IN_PER_FT;
  return cribCourseCount(heightFt) * logH;
}
