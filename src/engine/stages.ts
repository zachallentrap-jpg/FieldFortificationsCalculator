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
import { machine } from '../doctrine/materials';
import { round1 } from './round';
import type { StageId } from '../doctrine/stages';
import type { BomLine, Result } from './types';

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
  if (result.inputs.revetment !== 'none') adders += a.revetAdd.value;
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
  const hasRevet = result.inputs.revetment !== 'none';
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
  machineAssist: boolean;
}

export interface ScheduledStep extends StageStep {
  cumulativeHours: number; // clock time this stage is COMPLETE, from H+0
}

export interface Schedule {
  steps: ScheduledStep[];
  totalElapsedHours: number;
  availableHours: number;
  feasible: boolean; // completes by stand-to?
  shortfallHours: number; // hours past stand-to (0 if feasible)
  effectiveDiggers: number; // team × posture (× machine speed-up)
}

export function scheduleStages(plan: StagePlan, opts: ScheduleOpts): Schedule {
  const team = Math.max(1, Math.floor(opts.teamSize));
  const posture = Math.min(1, Math.max(0.01, opts.securityPostureFrac));
  const machineSpeed = opts.machineAssist ? 1 / machine.excavationFactor.value : 1; // dozer digs faster
  const effectiveDiggers = team * posture * machineSpeed;

  let cumulative = 0;
  const steps: ScheduledStep[] = plan.steps.map((s) => {
    cumulative += s.manHours / effectiveDiggers;
    return { ...s, cumulativeHours: round1(cumulative) };
  });
  const totalElapsedHours = round1(cumulative);
  const feasible = totalElapsedHours <= opts.availableHours + 1e-9;
  return {
    steps,
    totalElapsedHours,
    availableHours: opts.availableHours,
    feasible,
    shortfallHours: feasible ? 0 : round1(totalElapsedHours - opts.availableHours),
    effectiveDiggers: round1(effectiveDiggers),
  };
}
