// Inverse "time-available" planning (§9, §15). Pure. Given a time budget and team, search
// the discrete standard × overhead × revetment space, keep configurations whose elapsed
// time fits the budget, and rank by protection then buildability. Deterministic ordering
// (protection desc, then man-hours asc, then a fixed tie-break key).

import { compute } from './compute';
import { revetments } from '../doctrine/materials';
import { normalizeTeamSize } from './stages';
import { finite } from './round';
import type { Inputs, RoofPath } from './types';

export interface PlanRequest {
  availableHours: number;
  teamSize: number;
  base: Inputs;
}

export interface PlanOption {
  inputs: Inputs;
  standard: Inputs['standard'];
  overheadCover: boolean; // what this option ASKED for
  deliversCover: boolean; // what it actually BUILDS — an engineered roof delivers nothing
  revetment: string;
  manHoursTotal: number;
  elapsedHours: number;
  roofPath: RoofPath;
  protectionScore: number;
  feasible: boolean; // time budget only — see hasErrors for doctrine validity
  hasErrors: boolean; // this exact combination fails one of compute()'s own validation errors
                       // (e.g. a soil that requires revetment, with revetment='none' in the sweep)
}

export interface PlanResult {
  budgetHours: number;
  teamSize: number;
  feasible: PlanOption[]; // ranked, elapsed ≤ budget
  infeasibleBest: PlanOption | null; // best option that did NOT fit, for guidance
}

const STANDARDS: Inputs['standard'][] = ['reinforced', 'deliberate', 'hasty'];
const STANDARD_RANK: Record<Inputs['standard'], number> = { hasty: 1, deliberate: 2, reinforced: 3 };
// Swept from the same doctrine table the main revetment select is built from
// (layout/controls.ts renders optionsFrom(revetments)), so the "best plan" is chosen from every
// facing the operator can actually build. The hand-written list here held three of the five —
// corrugated_metal and timber_plywood were offered in the UI but could never be proposed.
const REVETS = Object.keys(revetments);

// Scored on what the option BUILDS, not on what it asked for: an engineered roof contributes no
// cover, no stringers, no cover BOM and no overhead labor anywhere else in the engine, so it
// contributes no protection here either.
function protectionScore(std: Inputs['standard'], deliversCover: boolean, revet: string): number {
  let s = STANDARD_RANK[std] * 4;
  if (deliversCover) s += 3;
  if (revet !== 'none') s += 1;
  return s;
}

// Fixed tie-break so ordering is fully deterministic regardless of iteration nuances.
function tieKey(o: PlanOption): string {
  // Cover rank, best first: a roof that gets built; then no roof asked for; LAST the option that
  // asked for cover the engine refuses to size. That last pair is otherwise indistinguishable —
  // identical protection score (nothing is built) and identical man-hours (no overhead labor is
  // charged) — and ranking the request ahead of its honest twin put "overhead cover: yes" at the
  // top of the plan for every threat that forces an engineered roof.
  const cover = o.deliversCover ? '0' : o.overheadCover ? '2' : '1';
  return String(4 - STANDARD_RANK[o.standard]) + cover + o.revetment;
}

export function planForTime(req: PlanRequest): PlanResult {
  // compute()'s own [1,50] normalization, shared from stages.ts — a local reimplementation that
  // only floored, not ceilinged, let an option's "Use" button push an out-of-range team size
  // (e.g. 500) into the live store even though every number shown was computed for a team of 50.
  const teamSize = normalizeTeamSize(req.teamSize);
  // An unreadable budget certifies nothing, so it becomes zero hours: no option is reported as
  // fitting, and the echoed budget is a number the caller can print ("nothing fits 0 hr")
  // instead of the NaN that used to be handed straight back out.
  const budgetHours = finite(req.availableHours, 0);
  const options: PlanOption[] = [];

  for (const standard of STANDARDS) {
    for (const overheadCover of [true, false]) {
      for (const revetment of REVETS) {
        const inputs: Inputs = { ...req.base, standard, overheadCover, revetment, teamSize };
        const r = compute(inputs);
        // The only roof path that puts material overhead. 'engineered_required' means the engine
        // refuses to size a roof for this threat, and 'none' means none was asked for; in both
        // cases nothing is built, so the option delivers no cover however it was requested.
        const deliversCover = r.cover.roofPath === 'earth_on_stringers';
        options.push({
          // compute()'s own clamped echo, not the locally-built `inputs` — keeps this in sync
          // if compute() ever normalizes anything else about the inputs beyond count/team.
          inputs: r.inputs,
          standard,
          overheadCover,
          deliversCover,
          revetment,
          manHoursTotal: r.labor.manHoursTotal,
          elapsedHours: r.labor.elapsedHours,
          roofPath: r.cover.roofPath,
          protectionScore: protectionScore(standard, deliversCover, revetment),
          feasible: r.labor.elapsedHours <= budgetHours,
          hasErrors: r.validation.some((v) => v.severity === 'error'),
        });
      }
    }
  }

  // A combination compute() itself flags as a doctrine ERROR (e.g. a soil that requires
  // revetment, swept with revetment='none') must never outrank a combination with none — this
  // used to sort purely on protectionScore/manHoursTotal, which doesn't know about validation
  // at all, so an error-carrying option could land ahead of (or between) valid ones at the same
  // protection tier with nothing in the ranking to say so.
  const rank = (a: PlanOption, b: PlanOption): number =>
    Number(a.hasErrors) - Number(b.hasErrors) ||
    b.protectionScore - a.protectionScore ||
    a.manHoursTotal - b.manHoursTotal ||
    (tieKey(a) < tieKey(b) ? -1 : tieKey(a) > tieKey(b) ? 1 : 0);

  const feasible = options.filter((o) => o.feasible).sort(rank);
  const infeasible = options.filter((o) => !o.feasible).sort(rank);

  return {
    budgetHours,
    teamSize,
    feasible,
    infeasibleBest: infeasible[0] ?? null,
  };
}
