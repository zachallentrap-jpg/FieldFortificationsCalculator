// Priorities-of-work scheduler (§9, Phase 4) — PURE and deterministic. Two functions:
//
//   computeStages(result) → StagePlan   decompose a position into ordered build stages, each
//                                       with its man-hours and BOM lines. The per-stage
//                                       man-hours PARTITION the position total (never add to
//                                       it); per-stage BOM lines partition the position BOM.
//   scheduleStages(plan, opts) → Schedule   given team size, available time, and security
//                                       posture, turn the stages into a clock: cumulative H+X
//                                       per stage and a shortfall if stand-to is unreachable.
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
  steps: StageStep[];
  totalManHours: number; // equals result.labor.manHoursPerPosition (asserted by test)
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
  return { steps, totalManHours: result.labor.manHoursPerPosition };
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
  totalElapsedHours: number;
  availableHours: number; // the NORMALIZED budget this schedule was judged against
  feasible: boolean; // completes by stand-to?
  shortfallHours: number; // hours past stand-to (0 if feasible)
  effectiveDiggers: number; // team × posture
  inputsUsable: boolean; // false when an option was unreadable and a fallback was scheduled
}

// The digging fraction's range. Both ends are arithmetic, not doctrinal: a posture of zero is a
// division by zero (an infinite clock) and a posture above one is more diggers than the team has.
const POSTURE_MIN = 0.01;
const POSTURE_MAX = 1;

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
  const inputsUsable =
    Number.isFinite(opts.teamSize) &&
    Number.isFinite(opts.securityPostureFrac) &&
    Number.isFinite(opts.availableHours);
  const team = normalizeTeamSize(opts.teamSize);
  // clamp() returns its minimum for a non-finite input, which is the pessimistic end here.
  const posture = clamp(opts.securityPostureFrac, POSTURE_MIN, POSTURE_MAX);
  const availableHours = finite(opts.availableHours, 0);
  // Machine assist is NOT re-applied here: compute.ts already scales the excavation man-hours
  // by machine.excavationFactor when inputs.machineAssist is on (the total this plan partitions,
  // result.labor.manHoursPerPosition, is already the machine-adjusted figure). Dividing by an
  // extra 1/excavationFactor here compounded the same doctrine constant twice — a 0.4× reduction
  // in compute.ts became 0.4×0.4=0.16× once this clock also sped up the digging rate on top of
  // the already-reduced total. effectiveDiggers is purely "how many bodies are on the tools."
  const effectiveDiggers = team * posture;

  let cumulative = 0;
  const steps: ScheduledStep[] = plan.steps.map((s) => {
    cumulative += s.manHours / effectiveDiggers;
    return { ...s, cumulativeHours: roundHours(cumulative) };
  });
  const totalElapsedHours = roundHours(cumulative);
  // A non-finite total (only reachable from a hand-built StagePlan — computeStages derives every
  // stage from compute()'s finite total) fails this comparison, so it can never come back
  // feasible; roundHours keeps it visible rather than reporting it as zero hours of work.
  const feasible = totalElapsedHours <= availableHours + 1e-9;
  return {
    steps,
    totalElapsedHours,
    availableHours,
    feasible,
    shortfallHours: feasible ? 0 : roundHours(totalElapsedHours - availableHours),
    effectiveDiggers: round1(effectiveDiggers),
    inputsUsable,
  };
}
