// TIMBER-2 — the hardware take-off (plan §7 T8, brought forward for the planning app).
//
// A cut list tells a crew what to saw. It does not tell them how many pounds of 16d to draw
// from supply, and "1371s should be able to choose everything, all the way down to the hardware
// and the quantity" is the whole point of the planning side. This module answers that.
//
// WHERE THE NUMBERS COME FROM, and why this is not a second source of truth: every member the
// engine emits already carries a `nailing` string — a real nailing schedule, written next to
// the geometry that needs it ("2-16d ea end", `8d @ 6" edges / 12" field`). Those strings are
// part of the frozen engine's output and are byte-pinned by the compat goldens, so they cannot
// drift under this module without a stop-the-line failure. Reading them is therefore an
// AGGREGATION over the same members the 3D scene draws, exactly like `bom.ts` (invariant I-3),
// not a parallel model of how the building is fastened.
//
// HONESTY RULE: a schedule this file cannot parse is REPORTED, never dropped and never guessed
// at. A hardware list that quietly omits the fasteners it did not understand is worse than no
// list, because it looks complete. `fastenerTakeoff` returns the unrecognised schedules
// alongside the counted ones and the UI is required to show them.

import type { Member } from './types';
import { classifyNominal } from './bom';

/** One line of the hardware bill. */
export interface FastenerLine {
  /** What to ask for: "16d common", "8d common", "1 1/4 in roofing nail". */
  spec: string;
  /** Pieces, rounded up — you cannot draw a third of a nail. */
  count: number;
  /**
   * Approximate weight, because nails are issued by the pound. Marked (PH): the pieces-per-pound
   * figures below are the common published values and have not been page-checked.
   */
  poundsApprox: number;
  /** Which members drove this line, in plain language. */
  usedFor: string[];
}

export interface FastenerTakeoff {
  lines: FastenerLine[];
  /** Nailing schedules no rule matched, with how many members carry each. Must be shown. */
  unparsed: { schedule: string; members: number }[];
  /**
   * Sheathing field-nail counts assume supports at this spacing, because a panel member does not
   * carry its own framing layout. Stated so the assumption is visible in the paperwork.
   */
  fieldSupportSpacingIn: number;
}

// Pieces per pound, common-nail tables (PH — not page-checked against a supply publication).
const PER_POUND: Record<string, number> = {
  '6d': 180,
  '8d': 106,
  '10d': 69,
  '12d': 63,
  '16d': 49,
  '20d': 31,
  roofing: 250, // 1 1/4 in galvanised large-head
};

const SPEC_LABEL: Record<string, string> = {
  '6d': '6d common',
  '8d': '8d common',
  '10d': '10d common',
  '12d': '12d common',
  '16d': '16d common',
  '20d': '20d common',
  roofing: '1 1/4 in roofing nail (galv, large head)',
  drift: 'drift pin / post-cap anchor',
  lead: 'lead-head nail (corrugated roofing)',
};

/** Supports under sheathing are on the framing grid; 16 in is this engine's standard. */
const FIELD_SUPPORT_SPACING_IN = 16;

interface Tally {
  add(kind: string, count: number, usedFor: string): void;
}

/**
 * Fasteners for ONE member, from its own nailing schedule and its own dimensions.
 *
 * Returns false when nothing matched, so the caller can report the schedule instead of
 * pretending the member is unfastened. Exported for the test suite: each rule below is a claim
 * about a specific string the engine actually emits, and a claim like that deserves a test.
 */
export function fastenersForMember(m: Member, tally: Tally): boolean {
  const s = m.nailing;
  const use = `${m.role} (${m.nominal})`;
  const lenIn = Math.max(1, m.cutLength);
  let matched = false;

  // Concrete and earth are not nailed to anything.
  if (/poured|undisturbed soil|backfill|tamped/i.test(s)) return true;

  // A schedule that names SOMEONE ELSE as the thing being fastened describes a joint from its
  // other side — the ridge's "rafters 3-16d ea" is the same nails the rafter's own "3-16d at
  // ridge" already bought. Counting both would double the ridge line.
  if (/^(rafters|joists|studs|purlins)\b/i.test(s)) return true;

  // Sheathing and roof deck: edges around the perimeter, field on intermediate supports.
  const panel = /(\d+d)\s*@\s*(\d+)"\s*edges\s*\/\s*(\d+)"\s*field/i.exec(s);
  if (panel) {
    const size = panel[1]!.toLowerCase();
    const edgeIn = Number(panel[2]);
    const fieldIn = Number(panel[3]);
    const w = lenIn;
    const h = Math.max(1, m.actual.d);
    const perimeter = 2 * (w + h);
    // Intermediate supports = those the panel crosses, less the two its edges land on.
    const supports = Math.max(0, Math.floor(w / FIELD_SUPPORT_SPACING_IN) - 1);
    const edgeNails = Math.ceil(perimeter / edgeIn);
    const fieldNails = supports * Math.ceil(h / fieldIn);
    tally.add(size, edgeNails + fieldNails, use);
    return true;
  }

  // Roll roofing: nails along every lap, both edges of the course.
  const roofing = /roofing nails\s*@\s*(\d+)"/i.exec(s);
  if (roofing) {
    tally.add('roofing', 2 * Math.ceil(lenIn / Number(roofing[1])), use);
    return true;
  }
  if (/lead-head nails at every (\w+) corrugation/i.test(s)) {
    // Corrugated sheet: one nail per third corrugation, at 2 1/6 in pitch, on each end lap.
    tally.add('lead', 2 * Math.ceil(lenIn / (3 * (26 / 12))), use);
    return true;
  }

  // "16d @ 16" staggered, both faces" — built-up girders and posts.
  const staggered = /(\d+d)\s*@\s*(\d+)"\s*staggered,\s*both faces/i.exec(s);
  if (staggered) {
    tally.add(staggered[1]!.toLowerCase(), 2 * Math.ceil(lenIn / Number(staggered[2])), use);
    return true;
  }

  // "16d @ 12" to king stud", "16d @ 16" to joists", "16d @ 16" + 2-16d at laps".
  const runSpacing = /(\d+d)\s*@\s*(\d+)"/i.exec(s);
  if (runSpacing) {
    tally.add(runSpacing[1]!.toLowerCase(), Math.ceil(lenIn / Number(runSpacing[2])), use);
    matched = true;
  }

  // Every "N-Xd" group in the schedule. A member can carry more than one — a rafter is
  // "3-16d at ridge, bird's-mouth toenail 3-8d" and owes both. An "or" offers an ALTERNATIVE
  // ("2-16d ea end or 4-8d toenail"), not a second obligation, so only the first is billed.
  //
  // "ea end" / "ea bearing" / "ea plate" mean the count repeats per connection, and two is the
  // honest multiplier for a member with two ends. "each stud crossing" is per crossing and is
  // counted from the member's length.
  const primary = s.split(/\bor\b/i)[0]!;
  // The tail stops before the next count group, or a greedy scan swallows the following one.
  const groups = [...primary.matchAll(/(\d+)\s*-\s*(\d+d)((?:(?!\d+\s*-\s*\d+d)[^.,;])*)/gi)];
  for (const g of groups) {
    const per = Number(g[1]);
    const size = g[2]!.toLowerCase();
    const tail = (g[3] ?? '').toLowerCase();
    let connections = 1;
    if (/ea stud crossing|at each stud crossing/.test(tail)) {
      connections = Math.max(2, Math.round(lenIn / FIELD_SUPPORT_SPACING_IN) + 1);
    } else if (/ea\b|each|at laps|toenail/.test(tail)) {
      connections = 2;
    }
    tally.add(size, per * connections, use);
    matched = true;
  }

  if (/anchor|drift/i.test(s)) {
    tally.add('drift', 1, use);
    matched = true;
  }

  // The engine's generic default. Posts, pads and anything without a written schedule land
  // here; a post is toenailed top and bottom, so two nails each end is the modest reading.
  const bare = /^(\d+d) common/i.exec(s);
  if (!matched && bare) {
    tally.add(bare[1]!.toLowerCase(), 4, use);
    matched = true;
  }

  return matched;
}

/**
 * Hardware for a whole structure. Pure: same members in, same bill out.
 *
 * Panels count their own sheathing nails, so passing a members array that has already been
 * filtered (one stage, one wall) gives that subset's hardware and nothing else.
 */
export function fastenerTakeoff(members: Member[]): FastenerTakeoff {
  const counts = new Map<string, number>();
  const uses = new Map<string, Set<string>>();
  const unparsed = new Map<string, number>();

  const tally: Tally = {
    add(kind, count, usedFor) {
      if (count <= 0) return;
      counts.set(kind, (counts.get(kind) ?? 0) + count);
      const set = uses.get(kind) ?? new Set<string>();
      set.add(usedFor);
      uses.set(kind, set);
    },
  };

  for (const m of members) {
    if (!fastenersForMember(m, tally)) {
      unparsed.set(m.nailing, (unparsed.get(m.nailing) ?? 0) + 1);
    }
  }

  // Heaviest fastener first: that is the order a supply request is written in, and it puts the
  // line somebody has to carry at the top.
  const order = ['20d', '16d', '12d', '10d', '8d', '6d', 'roofing', 'lead', 'drift'];
  const lines: FastenerLine[] = [...counts.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([kind, count]) => ({
      spec: SPEC_LABEL[kind] ?? kind,
      count: Math.ceil(count),
      poundsApprox: PER_POUND[kind] ? Math.round((count / PER_POUND[kind]) * 10) / 10 : 0,
      usedFor: [...(uses.get(kind) ?? [])].sort(),
    }));

  return {
    lines,
    unparsed: [...unparsed.entries()]
      .map(([schedule, n]) => ({ schedule, members: n }))
      .sort((a, b) => b.members - a.members),
    fieldSupportSpacingIn: FIELD_SUPPORT_SPACING_IN,
  };
}

/** Sheet goods, by the sheet, for the ordering section of a command packet. */
export interface SheetLine {
  nominal: string;
  count: number;
  usedFor: string[];
}

export function sheetTakeoff(members: Member[]): SheetLine[] {
  const by = new Map<string, { count: number; uses: Set<string> }>();
  for (const m of members) {
    if (classifyNominal(m.nominal) !== 'sheet') continue;
    const row = by.get(m.nominal) ?? { count: 0, uses: new Set<string>() };
    row.count += 1;
    row.uses.add(m.role);
    by.set(m.nominal, row);
  }
  return [...by.entries()]
    .map(([nominal, r]) => ({ nominal, count: r.count, usedFor: [...r.uses].sort() }))
    .sort((a, b) => b.count - a.count);
}
