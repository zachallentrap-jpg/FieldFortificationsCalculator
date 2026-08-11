// Mission BOM (§9, §15). Pure. Aggregate several positions (a job) into one rollup: merge
// BOM lines by id (NOT label — same material from different positions combines), optionally
// subtract an on-hand map to a shortfall, and sum labor. Deterministic (lines sorted by
// sortKey then id).

import { compute } from './compute';
import { normalizeTeamSize, roundHours } from './stages';
import type { MissionItem, MissionBomLine } from './types';

export interface MissionResult {
  lines: MissionBomLine[];
  totalPositions: number;
  totalManHours: number;
  elapsedHours: number; // totalManHours ÷ teamSize
  teamSize: number; // the crew the rollup clock assumes — see MissionOptions.teamSize
  manning: 'mission-team' | 'smallest-item-team'; // which crew the elapsed figure assumes
  placeholderLines: number; // lines with any placeholder-derived quantity
}

export interface MissionOptions {
  onHand?: Record<string, number>;
  // The crew that works the whole job. With none given the rollup falls back to the SMALLEST team
  // any item was planned for, never the largest: a mixed job is not worked by whichever item
  // happened to name the biggest crew. Dividing by the largest read better than the app's own
  // per-position screens — items planned for teams of 4 and 10 rolled up to 6.1 hr against the
  // 9.1 + 2.4 = 11.5 hr those two positions publish individually. The smallest team can never do
  // that: totalManHours ÷ min(team) ≥ Σ (item man-hours ÷ that item's own team).
  teamSize?: number;
}

export function aggregateMission(items: MissionItem[], opts: MissionOptions = {}): MissionResult {
  const merged = new Map<string, MissionBomLine>();
  let totalPositions = 0;
  let totalManHours = 0;
  // An empty mission leaves this at Infinity, which normalizeTeamSize resolves to a team of one.
  let smallestTeam = Infinity;

  for (const item of items) {
    const r = compute(item.inputs);
    totalPositions += r.inputs.count;
    // compute() bills manHoursTotal as manHoursPerPosition × count, so the rollup is already
    // count-aware; only the crew the elapsed figure assumes is decided here.
    totalManHours += r.labor.manHoursTotal;
    smallestTeam = Math.min(smallestTeam, r.inputs.teamSize);

    for (const line of r.bom) {
      const existing = merged.get(line.id);
      if (existing) {
        existing.qtyTotal += line.qtyTotal;
        existing.qtyPerPosition += line.qtyPerPosition; // informational; merged across items
        existing.fromPlaceholder = existing.fromPlaceholder || line.fromPlaceholder;
      } else {
        merged.set(line.id, { ...line });
      }
    }
  }

  const onHand = opts.onHand ?? {};
  const lines = [...merged.values()].map((line): MissionBomLine => {
    // No entry means nothing on hand yet — short by the full need. (Rendering an undefined
    // shortfall as 0 read as "not short" in the UI, the opposite of the truth.)
    const raw = onHand[line.id];
    const oh = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    return { ...line, onHand: oh, shortfall: Math.max(0, line.qtyTotal - oh) };
  });

  lines.sort((a, b) => (a.sortKey - b.sortKey) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Same normalization compute() applies to a team size, shared from stages.ts so the mission
  // clock and the per-position clock can never disagree about the same number: the local
  // max(1, round(x)) had no upper bound, so a team of 500 divided the mission man-hours by 500
  // while every position inside the rollup had already been computed for a team of 50, and a
  // non-finite team size produced teamSize: NaN and elapsedHours: NaN in the rollup itself.
  // The unreadable case falls back to a team of one — the longest elapsed, never the shortest.
  const teamSize = normalizeTeamSize(opts.teamSize ?? smallestTeam);
  const elapsedHours = roundHours(totalManHours / teamSize);

  return {
    lines,
    totalPositions,
    totalManHours: roundHours(totalManHours),
    elapsedHours,
    teamSize,
    manning: opts.teamSize === undefined ? 'smallest-item-team' : 'mission-team',
    placeholderLines: lines.filter((l) => l.fromPlaceholder).length,
  };
}
