// Inverse "time-available" planning (§9, §15). Pure. Given a time budget and team, search
// the discrete standard × overhead × revetment space, keep configurations whose elapsed
// time fits the budget, and rank by protection then buildability. Deterministic ordering
// (protection desc, then man-hours asc, then a fixed tie-break key).

import { compute } from './compute';
import type { Inputs, RoofPath } from './types';

export interface PlanRequest {
  availableHours: number;
  teamSize: number;
  base: Inputs;
}

export interface PlanOption {
  inputs: Inputs;
  standard: Inputs['standard'];
  overheadCover: boolean;
  revetment: string;
  manHoursTotal: number;
  elapsedHours: number;
  roofPath: RoofPath;
  protectionScore: number;
  feasible: boolean;
}

export interface PlanResult {
  budgetHours: number;
  teamSize: number;
  feasible: PlanOption[]; // ranked, elapsed ≤ budget
  infeasibleBest: PlanOption | null; // best option that did NOT fit, for guidance
}

const STANDARDS: Inputs['standard'][] = ['reinforced', 'deliberate', 'hasty'];
const STANDARD_RANK: Record<Inputs['standard'], number> = { hasty: 1, deliberate: 2, reinforced: 3 };
const REVETS = ['none', 'sandbag_facing', 'pickets_wire'];

function protectionScore(std: Inputs['standard'], coverOn: boolean, roofPath: RoofPath, revet: string): number {
  let s = STANDARD_RANK[std] * 4;
  if (coverOn && roofPath === 'earth_on_stringers') s += 3;
  if (revet !== 'none') s += 1;
  return s;
}

// Fixed tie-break so ordering is fully deterministic regardless of iteration nuances.
function tieKey(o: PlanOption): string {
  return String(4 - STANDARD_RANK[o.standard]) + (o.overheadCover ? '0' : '1') + o.revetment;
}

export function planForTime(req: PlanRequest): PlanResult {
  const teamSize = Math.max(1, Math.round(req.teamSize));
  const options: PlanOption[] = [];

  for (const standard of STANDARDS) {
    for (const overheadCover of [true, false]) {
      for (const revetment of REVETS) {
        const inputs: Inputs = { ...req.base, standard, overheadCover, revetment, teamSize };
        const r = compute(inputs);
        options.push({
          inputs,
          standard,
          overheadCover,
          revetment,
          manHoursTotal: r.labor.manHoursTotal,
          elapsedHours: r.labor.elapsedHours,
          roofPath: r.cover.roofPath,
          protectionScore: protectionScore(standard, r.cover.roofPath === 'none' ? false : overheadCover, r.cover.roofPath, revetment),
          feasible: r.labor.elapsedHours <= req.availableHours,
        });
      }
    }
  }

  const rank = (a: PlanOption, b: PlanOption): number =>
    b.protectionScore - a.protectionScore ||
    a.manHoursTotal - b.manHoursTotal ||
    (tieKey(a) < tieKey(b) ? -1 : tieKey(a) > tieKey(b) ? 1 : 0);

  const feasible = options.filter((o) => o.feasible).sort(rank);
  const infeasible = options.filter((o) => !o.feasible).sort(rank);

  return {
    budgetHours: req.availableHours,
    teamSize,
    feasible,
    infeasibleBest: infeasible[0] ?? null,
  };
}
