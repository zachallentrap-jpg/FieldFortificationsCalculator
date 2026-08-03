// TIMBER-2 T4 — how a person gets up there (plan §7 T4; EM 385-1-1 via `doctrine.LADDER`,
// `doctrine.STAIR`).
//
// The whole module is life-safety. Two shapes:
//
//   LADDER — two rails and rungs at the doctrine spacing, with the rails run PAST the landing by
//   the required extension. That extension is not trim: it is the thing you hold while your feet
//   leave the top rung, and it is the most commonly omitted part of a field-built ladder, so it
//   is generated rather than left to the drawing.
//
//   STAIR — stringers, treads, and a landing at each turn. Rise and run are solved to hit the
//   target riser without exceeding the maximum; a stair that cannot be laid out inside the
//   limits is reported, never silently steepened.
//
// The tower uses both; the platform (T6) uses the stair. Neither family re-derives the geometry.

import type { Member } from '../types';
import { DRESSED } from '../types';
import { makeEmitter } from '../emit';
import { LADDER, STAIR, IN_PER_FT, citeOf } from '../doctrine';

/** Divide-by-zero guard on a degenerate run. Arithmetic, not doctrine. */
const EPS_FT = 1e-6;

export interface LadderInput {
  /** Foot of the ladder, in plan. */
  base: [x: number, z: number];
  /** Which way the climber faces, unit vector in plan — the rungs run across this. */
  facing: [x: number, z: number];
  baseY: number;
  landingY: number;
  widthFt: number;
  stage: number;
}

/**
 * A fixed ladder. Returns its members and, when the climb is past the cage threshold, the reason
 * it should not be one — the caller decides (the tower FORCES a stair; `normalizeSpec` says so).
 */
export function generateLadder(input: LadderInput): { members: Member[]; overCageThreshold: boolean } {
  const emit = makeEmitter('AC');
  const { base, facing, baseY, landingY, widthFt, stage } = input;
  const climb = landingY - baseY;
  const extension = (LADDER.topExtensionIn.value as number) / IN_PER_FT;
  const spacing = (LADDER.rungSpacingIn.value as number) / IN_PER_FT;
  const railNominal = LADDER.railNominal.value as string;
  const rungNominal = LADDER.rungNominal.value as string;

  // Across the climber: perpendicular to `facing`, in plan.
  const ax = -facing[1];
  const az = facing[0];
  const railLen = climb + extension;
  const midY = baseY + railLen / 2;
  for (const side of [-1, 1] as const) {
    emit('ladderRail', railNominal, {
      cutLengthFt: railLen,
      position: [base[0] + ax * side * (widthFt / 2), midY, base[1] + az * side * (widthFt / 2)],
      rotation: [0, 0, Math.PI / 2],
      stage,
      nailing: 'bolted to the frame at every bay (PH)',
      doctrineRef: citeOf(LADDER.topExtensionIn),
    });
  }
  const yaw = Math.atan2(-az, ax);
  const rungs = Math.max(1, Math.round(climb / spacing));
  for (let i = 1; i <= rungs; i++) {
    const y = baseY + (climb * i) / rungs;
    emit('ladderRung', rungNominal, {
      cutLengthFt: widthFt,
      position: [base[0], y, base[1]],
      rotation: [0, yaw, 0],
      stage,
      nailing: 'let in and 2-16d ea rail (PH)',
      doctrineRef: citeOf(LADDER.rungSpacingIn),
    });
  }
  return { members: emit.members, overCageThreshold: climb > (LADDER.cageThresholdFt.value as number) };
}

export interface StairSolution {
  risers: number;
  riserIn: number;
  treadIn: number;
  runFt: number;
  /** Set when the solution had to leave the doctrine window — the UI must show it. */
  problem?: string;
}

/**
 * Solve a flight for a given rise. Riser count is chosen to land as near the target riser as
 * possible without passing the maximum; the tread follows from the unit run.
 */
export function solveFlight(riseFt: number): StairSolution {
  const target = STAIR.targetRiserIn.value as number;
  const maxRiser = STAIR.maxRiserIn.value as number;
  const unitRun = STAIR.unitRunIn.value as number;
  const minTread = STAIR.minTreadIn.value as number;
  const riseIn = riseFt * IN_PER_FT;
  let risers = Math.max(1, Math.round(riseIn / target));
  // Round-to-nearest can still overshoot the maximum on a short rise; add risers until it fits.
  while (riseIn / risers > maxRiser) risers += 1;
  const riserIn = riseIn / risers;
  const treadIn = Math.max(unitRun, minTread);
  return {
    risers,
    riserIn: Math.round(riserIn * 100) / 100,
    treadIn,
    runFt: ((risers - 1) * treadIn) / IN_PER_FT,
    ...(riserIn > maxRiser ? { problem: `riser ${riserIn.toFixed(2)} in exceeds the ${maxRiser} in maximum` } : {}),
  };
}

export interface StairInput {
  /** Bottom of the flight, at the nose of the lowest riser. */
  base: [x: number, z: number];
  /** Direction of travel going UP, unit vector in plan. */
  up: [x: number, z: number];
  baseY: number;
  topY: number;
  widthFt: number;
  stage: number;
  /**
   * Switchback: split the climb into flights of at most this rise, each turning 90° at a
   * landing. A single 24-ft straight flight would need 32 ft of run and does not belong on a
   * tower footprint.
   */
  maxFlightRiseFt?: number;
}

export interface StairResult {
  members: Member[];
  flights: StairSolution[];
  /** Landing centres, for the railing pass. */
  landings: { at: [number, number]; y: number }[];
}

export function generateStair(input: StairInput): StairResult {
  const emit = makeEmitter('AC');
  const { base, up, baseY, topY, widthFt, stage } = input;
  const stringerNominal = STAIR.stringerNominal.value as string;
  const treadNominal = STAIR.treadNominal.value as string;
  const stringerCount = STAIR.stringerCount.value as number;
  const totalRise = topY - baseY;
  const maxFlight = input.maxFlightRiseFt ?? totalRise;
  const flightCount = Math.max(1, Math.ceil(totalRise / maxFlight));
  const risePerFlight = totalRise / flightCount;

  const flights: StairSolution[] = [];
  const landings: { at: [number, number]; y: number }[] = [];
  let dir: [number, number] = [up[0], up[1]];
  let at: [number, number] = [base[0], base[1]];
  let y = baseY;

  for (let f = 0; f < flightCount; f++) {
    const sol = solveFlight(risePerFlight);
    flights.push(sol);
    const yaw = Math.atan2(-dir[1], dir[0]);
    // Stringers run the slope; length is the hypotenuse of rise and run.
    const slopeLen = Math.hypot(risePerFlight, sol.runFt);
    const pitch = Math.atan2(risePerFlight, Math.max(EPS_FT, sol.runFt));
    const midX = at[0] + dir[0] * (sol.runFt / 2);
    const midZ = at[1] + dir[1] * (sol.runFt / 2);
    const across: [number, number] = [-dir[1], dir[0]];
    for (let i = 0; i < stringerCount; i++) {
      const off = stringerCount === 1 ? 0 : (i / (stringerCount - 1) - 0.5) * widthFt;
      emit('stringer', stringerNominal, {
        cutLengthFt: slopeLen,
        position: [midX + across[0] * off, y + risePerFlight / 2, midZ + across[1] * off],
        rotation: [0, yaw, pitch],
        stage,
        nailing: 'bolted at head and foot (PH)',
        doctrineRef: citeOf(STAIR.stringerNominal),
      });
    }
    for (let i = 1; i <= sol.risers; i++) {
      const d = ((i - 1) * sol.treadIn) / IN_PER_FT;
      emit('tread', treadNominal, {
        cutLengthFt: widthFt,
        position: [at[0] + dir[0] * d, y + (risePerFlight * i) / sol.risers, at[1] + dir[1] * d],
        rotation: [0, Math.atan2(-across[1], across[0]), 0],
        stage,
        nailing: '2-16d ea stringer (PH)',
        doctrineRef: citeOf(STAIR.minTreadIn),
      });
    }
    y += risePerFlight;
    at = [at[0] + dir[0] * sol.runFt, at[1] + dir[1] * sol.runFt];
    if (f < flightCount - 1) {
      landings.push({ at: [at[0], at[1]], y });
      // Turn 90°: the switchback that keeps a tall climb inside the tower's footprint.
      dir = [-dir[1], dir[0]];
      // Step off the landing before the next flight starts, or the two flights share a tread.
      const step = widthFt;
      const platformNominal = treadNominal;
      emit('deckPlank', platformNominal, {
        cutLengthFt: widthFt,
        position: [at[0] + dir[0] * (step / 2), y, at[1] + dir[1] * (step / 2)],
        rotation: [0, Math.atan2(-dir[1], dir[0]), 0],
        stage,
        actual: { w: DRESSED[platformNominal]!.w, d: step * IN_PER_FT },
        nailing: '2-16d ea bearer (PH)',
        doctrineRef: citeOf(STAIR.headroomIn),
      });
      at = [at[0] + dir[0] * step, at[1] + dir[1] * step];
    }
  }
  return { members: emit.members, flights, landings };
}
