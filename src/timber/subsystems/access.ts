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
import { stringerDropFt } from '../stringerCuts';

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
  /**
   * Horizontal run per foot of rise, leaning the ladder BACKWARD along `facing`. Zero — a plumb
   * ladder — is the default and the only thing a wall needs.
   *
   * A BATTERED TOWER NEEDS THE LEAN, and a plumb ladder on one is not a near-miss, it is a
   * collision. The guard tower's legs rake 1.5 ft per side over a 16-ft climb, so the leg plane
   * sweeps from z = 0.0 at the ground to z = 1.5 at the deck. A plumb ladder anywhere between
   * those two figures crosses that plane — measured on the shipped preset, the ladder stood at
   * z = 0.90 and ran straight through the brace diagonals, overlapping them by 8.9 in and
   * crossing at about 9.6 ft up. Standing it outside the widest point instead would clear the
   * frame and land it 2.1 ft short of the deck at the top, which is not an improvement.
   *
   * Leaning it at the frame's own rake holds the clearance CONSTANT the whole way up: clear at
   * the base, clear at the deck, and clear at every rung between.
   */
  leanPerFt?: number;
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
  const lean = input.leanPerFt ?? 0;
  // A leaning rail is longer than the climb by its own hypotenuse, and the 36 in the rule asks
  // for is 36 in of HEIGHT above the landing — so the extension is raked by the same factor.
  const rake = Math.sqrt(1 + lean * lean);
  const railLen = (climb + extension) * rake;
  // The lean carries the ladder backward along `facing` as it rises.
  const topOffset = lean * (climb + extension);
  const midX = base[0] + (facing[0] * topOffset) / 2;
  const midZ = base[1] + (facing[1] * topOffset) / 2;
  const midY = baseY + (climb + extension) / 2;
  const yaw = Math.atan2(-az, ax);
  for (const side of [-1, 1] as const) {
    emit('ladderRail', railNominal, {
      cutLengthFt: railLen,
      position: [midX + ax * side * (widthFt / 2), midY, midZ + az * side * (widthFt / 2)],
      // Plumb keeps the rotation it always had, so a wall ladder comes out byte-for-byte. A
      // leaning one swings its length onto the rake: `atan2(1, lean)` is the pitch off
      // horizontal, and the yaw puts that lean along `facing`.
      rotation: lean === 0
        ? [0, 0, Math.PI / 2]
        : [0, Math.atan2(facing[0], -facing[1]) - Math.PI / 2, Math.atan2(1, lean)],
      stage,
      nailing: 'bolted to the frame at every bay (PH)',
      doctrineRef: citeOf(LADDER.topExtensionIn),
    });
  }
  const rungs = Math.max(1, Math.round(climb / spacing));
  for (let i = 1; i <= rungs; i++) {
    const t = i / rungs;
    const y = baseY + climb * t;
    emit('ladderRung', rungNominal, {
      cutLengthFt: widthFt,
      position: [base[0] + facing[0] * lean * climb * t, y, base[1] + facing[1] * lean * climb * t],
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
   * Switchback: split the climb into flights of at most this rise, each turning at a landing.
   * A single 24-ft straight flight would need 32 ft of run and does not belong on a tower
   * footprint.
   */
  maxFlightRiseFt?: number;
  /**
   * How each landing turns.
   *   'quarter'    90° left — the flights wrap a footprint, one face at a time.
   *   'switchback' 180° — the flights stack side by side in one well, which is what a stair
   *                alongside a tower actually is, and it keeps the plan two widths across
   *                instead of marching around the building.
   */
  turn?: 'quarter' | 'switchback';
  /**
   * WHERE THE STAIR HAS TO ARRIVE, which is the constraint that actually matters and the one
   * that was missing. Given the top landing point and the direction of the final flight, the
   * whole run is translated so it ENDS there — because a stair is positioned by where you step
   * off it, not by where its bottom tread happens to fall.
   *
   * Without this, the tower's stair was aimed by picking a plausible-looking base corner and
   * hoping: two flights later it finished four feet past the platform's back corner, at deck
   * height, over open ground. `base`/`up` are ignored when this is given.
   */
  arriveAt?: { at: [x: number, z: number]; dir: [x: number, z: number] };
  /**
   * Member-id prefix. Defaults to 'AC', which is right while a structure has ONE stair — the
   * tower's, the basement's. A building with two doors has two, and both came out numbering
   * their own pieces from one: `AC-stringer-01` twice in the same model. Ids are what the
   * picker, the highlight and the packet's anchors key on, so a duplicate is not cosmetic.
   */
  idPrefix?: string;
}

/** One flight's start, in plan — the geometry the emitter walks. */
interface FlightStep {
  at: [number, number];
  dir: [number, number];
}

const turnOnce = (d: [number, number], mode: 'quarter' | 'switchback'): [number, number] =>
  mode === 'switchback' ? [-d[0], -d[1]] : [-d[1], d[0]];
const turnBack = (d: [number, number], mode: 'quarter' | 'switchback'): [number, number] =>
  mode === 'switchback' ? [-d[0], -d[1]] : [d[1], -d[0]];

/**
 * Walk the plan path of a switchback run: where each flight starts and which way it climbs.
 *
 * Every flight has the same rise, so every flight has the same run, so the path is a rigid
 * shape — which is what makes `arriveAt` a translation and nothing more. The walk is written
 * once and used for both the dry run that finds the offset and the real emit, so the two can
 * never drift apart.
 */
function walkPath(start: FlightStep, runFt: number, stepFt: number, flights: number,
  mode: 'quarter' | 'switchback'): { steps: FlightStep[]; end: [number, number] } {
  const steps: FlightStep[] = [];
  let at: [number, number] = [start.at[0], start.at[1]];
  let dir: [number, number] = [start.dir[0], start.dir[1]];
  for (let f = 0; f < flights; f++) {
    steps.push({ at: [at[0], at[1]], dir: [dir[0], dir[1]] });
    at = [at[0] + dir[0] * runFt, at[1] + dir[1] * runFt];
    if (f === flights - 1) break;
    if (mode === 'switchback') {
      // Turn in place and step SIDEWAYS one stair width; the next flight climbs back alongside.
      const across: [number, number] = [-dir[1], dir[0]];
      at = [at[0] + across[0] * stepFt, at[1] + across[1] * stepFt];
      dir = turnOnce(dir, mode);
    } else {
      dir = turnOnce(dir, mode);
      at = [at[0] + dir[0] * stepFt, at[1] + dir[1] * stepFt];
    }
  }
  return { steps, end: at };
}

export interface StairResult {
  members: Member[];
  flights: StairSolution[];
  /** Landing centres, for the railing pass. */
  landings: { at: [number, number]; y: number }[];
}

export function generateStair(input: StairInput): StairResult {
  const emit = makeEmitter(input.idPrefix ?? 'AC');
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
  const mode = input.turn ?? 'quarter';
  const stepFt = widthFt;
  // Every flight carries the same rise, so every flight has the same run.
  const runFt = solveFlight(risePerFlight).runFt;

  // Lay the path out, then move it to where it has to land. When `arriveAt` is given the first
  // flight's heading is whatever, turned backwards, ends up pointing the way the caller wants
  // to step off; the dry run then supplies the translation.
  let start: FlightStep = { at: [base[0], base[1]], dir: [up[0], up[1]] };
  if (input.arriveAt) {
    let d0: [number, number] = [input.arriveAt.dir[0], input.arriveAt.dir[1]];
    for (let f = 0; f < flightCount - 1; f++) d0 = turnBack(d0, mode);
    const dry = walkPath({ at: [0, 0], dir: d0 }, runFt, stepFt, flightCount, mode);
    start = { at: [input.arriveAt.at[0] - dry.end[0], input.arriveAt.at[1] - dry.end[1]], dir: d0 };
  }
  const path = walkPath(start, runFt, stepFt, flightCount, mode);
  let y = baseY;

  for (let f = 0; f < flightCount; f++) {
    const sol = solveFlight(risePerFlight);
    flights.push(sol);
    const at = path.steps[f]!.at;
    const dir = path.steps[f]!.dir;
    const yaw = Math.atan2(-dir[1], dir[0]);
    const across: [number, number] = [-dir[1], dir[0]];
    // THE STOCK IS LAID OUT FROM THE NOSING LINE, which is the line a framing square walks: it
    // runs through the nose of every tread, at the UNIT RUN's own pitch, and the board hangs its
    // full face width below it. The sawtooth is then cut out of what is left — seats and riser
    // faces, in `stairStringerProfile`, which reads the flight straight back off the piece.
    //
    // The board used to be laid on the line from the GROUND at the base to the LANDING at the
    // head. That line is a third steeper than the nosing line, a full riser low at the foot and
    // level with it only at the very top, so every tread crossed it — part buried in the board,
    // part hanging in the air. No arrangement of the treads could fix that: the fault was the
    // shape of the board under them.
    const R = risePerFlight / sol.risers;
    const T = sol.treadIn / IN_PER_FT;
    const cut = sol.risers > 1;
    const pitch = cut
      ? Math.atan2(R, T)
      : Math.atan2(risePerFlight, Math.max(EPS_FT, sol.runFt));
    const faceW = DRESSED[stringerNominal]!.d / IN_PER_FT;
    // Along the rake, measured from the nosing line's start at (d = 0, h = R): the foot corner
    // sits one riser below it, and the head corner is `risers − 1` whole steps up it.
    const sMin = cut ? -R * Math.sin(pitch) : -Math.hypot(risePerFlight, sol.runFt) / 2;
    const sMax = cut ? (sol.risers - 1) * Math.hypot(T, R) : Math.hypot(risePerFlight, sol.runFt) / 2;
    const slopeLen = sMax - sMin;
    const sMid = (sMin + sMax) / 2;
    // The member's CENTRE is half a face width below the nosing line, which is not straight down.
    const dMid = sMid * Math.cos(pitch) + (faceW / 2) * Math.sin(pitch);
    const hMid = R + sMid * Math.sin(pitch) - (faceW / 2) * Math.cos(pitch);
    const drop = cut ? null : stringerDropFt(DRESSED[stringerNominal]!.d, yaw, pitch);
    for (let i = 0; i < stringerCount; i++) {
      const off = stringerCount === 1 ? 0 : (i / (stringerCount - 1) - 0.5) * widthFt;
      emit('stringer', stringerNominal, {
        cutLengthFt: slopeLen,
        position: drop
          ? [
            at[0] + dir[0] * (sol.runFt / 2) + across[0] * off + drop[0],
            y + risePerFlight / 2 + drop[1],
            at[1] + dir[1] * (sol.runFt / 2) + across[1] * off + drop[2],
          ]
          : [
            at[0] + dir[0] * dMid + across[0] * off,
            y + hMid,
            at[1] + dir[1] * dMid + across[1] * off,
          ],
        rotation: [0, yaw, pitch],
        stage,
        nailing: 'bolted at head and foot (PH)',
        doctrineRef: citeOf(STAIR.stringerNominal),
      });
    }
    // A TREAD IS THE PIECE YOU PUT YOUR BOOT ON, so it lies FLAT: length across the stair, face
    // width running the direction of travel (that face width IS the tread depth the doctrine
    // minimum governs), thickness up. The canonical member frame puts face width along local Y,
    // which is vertical until something rotates it — so with no rx these came out standing on
    // edge, and a stair rendered as a comb of 9 1/4-in fins with nothing to walk on.
    const treadYaw = Math.atan2(-across[1], across[0]);
    const treadT = DRESSED[treadNominal]!.w / IN_PER_FT;
    // A FLIGHT OF N RISERS HAS N−1 TREADS. The N-th surface is the landing — the deck, the
    // platform between flights, the threshold — and it is built by whoever built that. Every
    // flight in the toolkit put a tread there too: on the loading platform the top tread sat
    // inside the deck planks it arrived at, 14 in³ of one solid inside another. An `omitTopTread`
    // flag was added for the entry steps when the same tread turned up buried in a sole plate;
    // it was the general rule wearing a local name, and it is gone.
    //
    // AND EACH TREAD GOES ON ITS OWN STEP. `base` is documented as "the nose of the lowest
    // riser", and tread i was CENTRED on the nose line (i−1) runs along from it — so every tread
    // sat half its own depth downhill of the step it belongs to, and the bottom one hung clear
    // off the end of the stringers with nothing under any part of it. A tread starts at its
    // nose and runs UPHILL from there.
    const treadDepth = DRESSED[treadNominal]!.d / IN_PER_FT;
    for (let i = 1; i < sol.risers; i++) {
      const d = ((i - 1) * sol.treadIn) / IN_PER_FT + treadDepth / 2;
      emit('tread', treadNominal, {
        cutLengthFt: widthFt,
        position: [at[0] + dir[0] * d, y + (risePerFlight * i) / sol.risers - treadT / 2, at[1] + dir[1] * d],
        rotation: [-Math.PI / 2, treadYaw, 0],
        stage,
        nailing: '2-16d ea stringer (PH)',
        doctrineRef: citeOf(STAIR.minTreadIn),
      });
    }
    y += risePerFlight;
    if (f < flightCount - 1) {
      // The landing spans from the top of this flight to the foot of the next, whichever way
      // the run turns — so it is drawn from the two path points rather than from a rule that
      // only happened to be right for a quarter turn.
      const top: [number, number] = [at[0] + dir[0] * sol.runFt, at[1] + dir[1] * sol.runFt];
      const next = path.steps[f + 1]!.at;
      const cx = (top[0] + next[0]) / 2;
      const cz = (top[1] + next[1]) / 2;
      landings.push({ at: [cx, cz], y });
      const platformNominal = treadNominal;
      const span = Math.max(widthFt, Math.hypot(next[0] - top[0], next[1] - top[1]));
      const yawL = Math.abs(next[0] - top[0]) >= Math.abs(next[1] - top[1])
        ? 0 : Math.PI / 2;
      emit('deckPlank', platformNominal, {
        cutLengthFt: span,
        position: [cx, y - DRESSED[platformNominal]!.w / IN_PER_FT / 2, cz],
        rotation: [-Math.PI / 2, yawL, 0], // flat, like the treads
        stage,
        actual: { w: DRESSED[platformNominal]!.w, d: widthFt * IN_PER_FT },
        nailing: '2-16d ea bearer (PH)',
        doctrineRef: citeOf(STAIR.headroomIn),
      });
    }
  }
  return { members: emit.members, flights, landings };
}
