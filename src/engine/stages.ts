// Priorities-of-work scheduler (§9, Phase 4) — PURE and deterministic. Two functions:
//
//   computeStages(result) → StagePlan   decompose a position into ordered build stages, each
//                                       with its man-hours and BOM lines. The per-stage
//                                       man-hours PARTITION the position total (never add to
//                                       it); per-stage BOM lines partition the position BOM.
//   scheduleStages(plan, opts) → Schedule   given team size, available time, and security
//                                       posture, turn the stages into a clock for the WHOLE job
//                                       (plan.positions of them): cumulative H+X per stage and a
//                                       shortfall if stand-to is unreachable.
//
// No clock, no randomness: DTGs are INPUTS (availableHours), never read from the environment.

import { excavationSplit, STAGE_ORDER, STAGE_BOM } from '../doctrine/stages';
import { labor as laborDoctrine } from '../doctrine/labor';
import { revetments } from '../doctrine/materials';
import { round1, clamp, finite } from './round';
import type { StageId } from '../doctrine/stages';
import type { BomLine, Result } from './types';

// ── Input normalization shared with the other planners ─────────────────────────
// compute() normalizes a team size as clamp(round(finite(x, 1)), 1, 50) before it divides
// man-hours by it. Every clock downstream of compute() must use THAT normalization or the two
// disagree about the same input: a local floor-with-no-ceiling scheduled a team of 500 at
// 12.1 mh / 500 = 0.02 h → "0 hr" while compute()'s own elapsed figure for the identical
// position (team clamped to 50) was 0.2 hr. plan.ts had already fixed its own copy; this
// module and mission.ts had not, so the definition now lives in one place and they import it.
// compute.ts still holds its own copy of the expression — the cross-module agreement is locked
// by test/engine-input-guards.test.ts, which compares this against compute()'s echoed inputs.
const TEAM_MIN = 1;
const TEAM_MAX = 50;

export function normalizeTeamSize(raw: unknown): number {
  // Character-for-character compute()'s expression. The fallback is also the pessimistic end:
  // an unreadable team size becomes a team of ONE — the smallest crew, hence the longest
  // build. An unreadable input may never shorten a clock.
  return clamp(Math.round(finite(raw, TEAM_MIN)), TEAM_MIN, TEAM_MAX);
}

// ── How big the job is ─────────────────────────────────────────────────────────
// `count` is an operator control: N positions built by one team is N times the work, and
// compute() bills it that way (labor.manHoursTotal = manHoursPerPosition × count). A stage plan
// decomposes ONE position, so a clock that schedules the stage plan alone answers "are we dug in
// by stand-to" for one hole while the operator asked for N — at count 10 it certified a job in
// 3.0 hr that compute() itself published as 30.3 hr. The count therefore travels WITH the plan
// (StagePlan.positions) and the job total is derived from it in one place, jobManHoursFor(), so
// the schedule and result.labor cannot drift apart.
const COUNT_MIN = 1;
const COUNT_MAX = 999;

export function normalizePositions(raw: unknown): number {
  // compute()'s own count expression, same shape as the team-size one above.
  return clamp(Math.round(finite(raw, COUNT_MIN)), COUNT_MIN, COUNT_MAX);
}

// The whole job's man-hours from one position's, rounded exactly the way compute() rounds
// labor.manHoursTotal — the same arithmetic on the same numbers, so the scheduler's clock and the
// figure the rest of the app publishes are one value, not two that happen to be close.
export function jobManHoursFor(perPositionManHours: number, positions: number): number {
  // round1 maps a non-finite input to 0 ("no work at all"), so unreadable work content is kept
  // non-finite here rather than collapsing into a job that takes no time.
  return Number.isFinite(perPositionManHours) ? round1(perPositionManHours * positions) : NaN;
}

// round1() maps a non-finite value to 0 (round.ts) — right for a material count, catastrophic
// for a clock, because it turns "this could not be worked out" into "it takes no time at all".
// Times therefore keep a non-finite value rather than collapsing to zero: a schedule may look
// broken, but it may never look finished.
export function roundHours(n: number): number {
  return Number.isFinite(n) ? round1(n) : n;
}

// Whether the position total actually CHARGED revetment labor — the truth is the resolved
// row's buildsFace (exactly what compute.ts keys on), NOT a raw `revetment !== 'none'` string
// compare. An unknown revetment string falls back to the 'none' row (buildsFace=false), so no
// revetAdd is in the total; keying on the raw string would subtract/add a phantom 2.0 mh and
// throw the per-stage stand-to clock off (the grand total still balances, hiding it from the
// partition test).
function chargedRevetLabor(result: Result): boolean {
  return (revetments[result.inputs.revetment] ?? revetments['none']!).buildsFace === true;
}

export interface StageStep {
  id: StageId;
  label: string;
  detail: string;
  manHours: number; // labor for this stage (per position)
  bom: BomLine[]; // materials emplaced during this stage
}

export interface StagePlan {
  steps: StageStep[]; // per-position labor and materials, in doctrinal order
  totalManHours: number; // ONE position — equals result.labor.manHoursPerPosition (asserted by test)
  positions: number; // how many positions the job is — result.inputs.count
  jobManHours: number; // the whole job — equals result.labor.manHoursTotal (asserted by test)
}

// Re-derive the two excavation labor components the same way compute.ts does, so the partition
// lines up exactly with the published total. (These are the only labor terms that split by
// stage; the four adders each belong to a single stage.)
function excavationLabor(result: Result): number {
  // manHoursPerPosition = excavation + sum(active adders). Recover excavation by subtracting the
  // adders that actually fired, so the partition is exact regardless of which features are on.
  const l = result.labor;
  let adders = 0;
  const a = laborDoctrine;
  const roofEarth = result.cover.roofPath === 'earth_on_stringers';
  if (roofEarth) adders += a.overheadAdd.value;
  if (chargedRevetLabor(result)) adders += a.revetAdd.value;
  const hasSump = result.bom.some((b) => b.id === 'grenade_sumps');
  if (hasSump) adders += a.sumpAdd.value;
  if (result.inputs.camouflage) adders += a.camoAdd.value;
  return l.manHoursPerPosition - adders;
}

function bomFor(result: Result, ids: string[]): BomLine[] {
  return result.bom.filter((b) => ids.includes(b.id));
}

export function computeStages(result: Result): StagePlan {
  const excav = excavationLabor(result);
  const a = laborDoctrine;
  const roofEarth = result.cover.roofPath === 'earth_on_stringers';
  const hasRevet = chargedRevetLabor(result);
  const hasSump = result.bom.some((b) => b.id === 'grenade_sumps');
  const hasCamo = result.inputs.camouflage;

  // Per-stage man-hours. Excavation stages take their doctrine fraction of `excav`; adder stages
  // take exactly the adder that fired (0 if the feature is off).
  const mh: Record<StageId, number> = {
    security: excav * excavationSplit.security.value,
    hasty: excav * excavationSplit.hasty.value,
    deliberate: excav * excavationSplit.deliberate.value,
    revet_sump: (hasRevet ? a.revetAdd.value : 0) + (hasSump ? a.sumpAdd.value : 0),
    parapet: excav * excavationSplit.parapet.value,
    overhead: roofEarth ? a.overheadAdd.value : 0,
    camo: hasCamo ? a.camoAdd.value : 0,
  };

  const steps: StageStep[] = [];
  for (const def of STAGE_ORDER) {
    const bom = bomFor(result, STAGE_BOM[def.id]);
    const manHours = mh[def.id];
    // Drop a stage only when it has neither labor nor materials (e.g. no overhead requested).
    if (manHours <= 1e-9 && bom.length === 0) continue;
    // manHours kept EXACT here (not rounded) so the per-stage sum equals the position total to
    // float precision; callers round for display via round1().
    steps.push({ id: def.id, label: def.label, detail: def.detail, manHours, bom });
  }
  // Per-stage man-hours and BOM stay PER POSITION (that is what a job sheet lists for the crew
  // digging one hole); how many of them the job wants rides along so the clock can bill them all.
  const positions = result.inputs.count;
  return {
    steps,
    totalManHours: result.labor.manHoursPerPosition,
    positions,
    jobManHours: jobManHoursFor(result.labor.manHoursPerPosition, positions),
  };
}

// ── Scheduling ─────────────────────────────────────────────────────────────────
export interface ScheduleOpts {
  teamSize: number;
  availableHours: number; // start → stand-to, in hours (a DTG delta the caller computes)
  securityPostureFrac: number; // fraction of the team DIGGING (rest on watch); 0<f≤1
}

export interface ScheduledStep extends StageStep {
  cumulativeHours: number; // clock time this stage is COMPLETE, from H+0
}

export interface Schedule {
  steps: ScheduledStep[];
  totalElapsedHours: number; // the WHOLE job (all `positions`), rounded for display
  availableHours: number; // the NORMALIZED budget this schedule was judged against
  positions: number; // how many positions this clock covers
  teamSize: number; // the team the clock was actually built on (normalized)
  securityPostureFrac: number; // the posture the clock was actually built on (normalized)
  feasible: boolean; // completes by stand-to? judged on the UNROUNDED clock
  shortfallHours: number; // hours past stand-to (0 if feasible), rounded UP
  effectiveDiggers: number; // team × posture
  inputsUsable: boolean; // false when ANY input was unreadable (options or work content)
  workUsable: boolean; // false when the plan's work content is not real work
  // An option that WAS readable but out of range was changed to schedule it. The clock is built
  // on the changed value, so a caller that echoes the operator's own box is showing a number this
  // schedule did not use — for the posture that difference runs the fast way (1.5 → 1, the most
  // hands the range allows), which is exactly the direction that must never pass unremarked.
  clampedInputs: { teamSize: boolean; securityPostureFrac: boolean; positions: boolean };
}

// The digging fraction's range. Both ends are arithmetic, not doctrinal: a posture of zero is a
// division by zero (an infinite clock) and a posture above one is more diggers than the team has.
const POSTURE_MIN = 0.01;
const POSTURE_MAX = 1;

// Float slack for comparing hours; also keeps a shortfall that is already an exact tenth from
// being ceiled up a whole step by binary representation error.
const EPS = 1e-9;
// round1's precision — one decimal place. A display convention, not a doctrinal quantity.
const TENTHS = 10;

// A shortfall is rounded UP to the displayed precision, never down: "NOT ready — short 0.0 hr" is
// a contradiction, and under-reporting a shortage is the defect ceilInt exists to prevent on the
// material side. Non-finite stays non-finite (see roundHours).
function ceilHours(n: number): number {
  return Number.isFinite(n) ? Math.ceil(n * TENTHS - EPS) / TENTHS : n;
}

// The work the schedule bills, per position. Two sources have to agree: the plan's declared total
// (compute()'s published per-position figure) and the stages the schedule is about to print. The
// LARGER is billed, so a caller-supplied plan can never declare away work its own stages contain.
// Negative or non-finite work is not work — it comes back NaN, which keeps the clock non-finite
// and uncertifiable. A caller-supplied plan is the surface this matters on: manHours -1000 used to
// schedule as -250 h, "ready with 274 hr to spare" against a 24 hr budget.
function workPerPosition(plan: StagePlan): number {
  let staged = 0;
  for (const s of plan.steps) {
    if (!Number.isFinite(s.manHours) || s.manHours < 0) return NaN;
    staged += s.manHours;
  }
  const declared = plan.totalManHours;
  if (!Number.isFinite(declared) || declared < 0) return NaN;
  return Math.max(declared, staged);
}

export function scheduleStages(plan: StagePlan, opts: ScheduleOpts): Schedule {
  // A non-finite scheduling option may never shorten the clock or certify stand-to. Each is
  // normalized to the pessimistic end of its own range instead of being passed into the math:
  //   teamSize          → 1 (compute()'s fallback; the smallest crew, so the longest build)
  //   securityPosture   → POSTURE_MIN (the fewest hands on the tools)
  //   availableHours    → 0 (a budget that cannot be read certifies nothing)
  // and inputsUsable records that a fallback was used, so a caller never presents the fallback
  // clock as the operator's own numbers. Before this guard, securityPostureFrac: NaN reached
  // Math.max(0.01, NaN) = NaN, flowed through effectiveDiggers into the cumulative sum, and
  // round1(NaN) returned 0 — the schedule came back totalElapsedHours: 0, feasible: true, i.e.
  // "the position is already dug". That is the one answer this function must never give.
  // A NaN availableHours was the mirror image: feasible false with a shortfall of 0 hours.
  // The plan itself is an input too (it is a parameter, not always computeStages' output), so its
  // work content is checked the same way — see workPerPosition — and inputsUsable covers both.
  const optionsReadable =
    Number.isFinite(opts.teamSize) &&
    Number.isFinite(opts.securityPostureFrac) &&
    Number.isFinite(opts.availableHours);
  const team = normalizeTeamSize(opts.teamSize);
  // clamp() returns its minimum for a non-finite input, which is the pessimistic end here.
  const posture = clamp(opts.securityPostureFrac, POSTURE_MIN, POSTURE_MAX);
  const availableHours = finite(opts.availableHours, 0);
  const positions = normalizePositions(plan.positions);
  // The plan's job size is an input with the same failure mode as the options above — and its
  // fallback runs the FLATTERING way: normalizePositions maps an unreadable count to 1, the
  // smallest job, so the clock that comes back covers fewer holes than the operator asked for.
  // A fallback the caller is never told about is exactly what inputsUsable exists to report,
  // and an unreadable team size already reports it; the job size must too.
  const positionsReadable = Number.isFinite(plan.positions);
  // Readable but out of range is NOT the same as unreadable: nothing failed, a number the operator
  // typed was changed. compute()'s own convention — compare against the ROUNDED value, so mere
  // fractional rounding is not reported as clamping.
  const clampedInputs = {
    teamSize: Number.isFinite(opts.teamSize) && Math.round(opts.teamSize) !== team,
    securityPostureFrac: Number.isFinite(opts.securityPostureFrac) && opts.securityPostureFrac !== posture,
    positions: Number.isFinite(plan.positions) && Math.round(plan.positions) !== positions,
  };
  // Machine assist is NOT re-applied here: compute.ts already scales the excavation man-hours
  // by machine.excavationFactor when inputs.machineAssist is on (the total this plan partitions,
  // result.labor.manHoursPerPosition, is already the machine-adjusted figure). Dividing by an
  // extra 1/excavationFactor here compounded the same doctrine constant twice — a 0.4× reduction
  // in compute.ts became 0.4×0.4=0.16× once this clock also sped up the digging rate on top of
  // the already-reduced total. effectiveDiggers is purely "how many bodies are on the tools."
  const effectiveDiggers = team * posture;

  // The job, not one hole: every stage is worked `positions` times over.
  const perPosition = workPerPosition(plan);
  const workUsable = Number.isFinite(perPosition);
  const jobManHours = jobManHoursFor(perPosition, positions);

  let cumulative = 0;
  const steps: ScheduledStep[] = plan.steps.map((s) => {
    cumulative += (workUsable ? s.manHours * positions : NaN) / effectiveDiggers;
    return { ...s, cumulativeHours: roundHours(cumulative) };
  });
  // Judged on the UNROUNDED clock and rounded only to display it. Comparing the rounded total
  // against the budget let a job over budget by up to half a display step come back feasible with
  // a shortfall of zero (measured worst case: a true 0.55 hr clock reported as "0.5 hr, ready"
  // against a 0.5 hr budget). A non-finite clock (only reachable from a hand-built StagePlan)
  // fails the comparison, so it can never come back feasible, and roundHours keeps it visible
  // rather than reporting it as zero hours of work.
  const elapsedHours = jobManHours / effectiveDiggers;
  const feasible = elapsedHours <= availableHours + EPS;
  return {
    steps,
    totalElapsedHours: roundHours(elapsedHours),
    availableHours,
    positions,
    teamSize: team,
    securityPostureFrac: posture,
    feasible,
    shortfallHours: feasible ? 0 : ceilHours(elapsedHours - availableHours),
    effectiveDiggers: round1(effectiveDiggers),
    inputsUsable: optionsReadable && positionsReadable && workUsable,
    workUsable,
    clampedInputs,
  };
}
