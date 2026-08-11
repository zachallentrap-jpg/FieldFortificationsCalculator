// COMMAND PACKET — labor, told honestly (TRAINING_AND_PACKETS_PLAN §4.4, FD71).
//
// Four things this fixes about "man-hours ÷ crew ÷ 8":
//
//   A CREW HAS A CEILING. Twelve carpenters cannot work one sill line. Max useful crew is
//   derived per stage from how many members that stage actually places, and crew sizes above
//   the model's ceiling are SUPPRESSED rather than printed with a smaller number beside them.
//   A table that says "24 Marines: 1 shift" is a table that gets a section sent out short.
//
//   A SHIFT IS NOT EIGHT HOURS OF BUILDING. `productiveHoursPerDay` defaults to 6, and the
//   label says why: security, details, travel and tool contention are the other two.
//
//   DAYS ARE WHOLE SHIFTS, ROUNDED UP. "3.4 days" is false precision on the exact number a
//   unit gets held to — and it is computed off three placeholder rates. Whole shifts, plus the
//   raw crew-hours so the reader can redo it.
//
//   THE RATE PRINTS ON THE BLOCK. A man-hour total without the rate that produced it asks to
//   be believed. `LABOR_RATES` renders inside the same block, every time.
//
// The crew model is LINEAR and the table says so in its own column label (FD72). Linear is
// wrong — it is just wrong in a direction anyone can see and correct, which a hidden
// non-linear fudge is not.

import type { BomSummary } from '../bom';

/** Clamps. Operator inputs, not doctrine — arithmetic divisors with sane envelopes (R-T6). */
export const CREW_MIN = 1;
export const CREW_MAX = 30;
export const HOURS_MIN = 1;
export const HOURS_MAX = 24;

export const DEFAULT_PRODUCTIVE_HOURS = 6;

/**
 * Members one worker can place before people start waiting on each other. A working figure,
 * not doctrine, and it is what sets the crew ceiling — so it is stated on the table rather
 * than hidden here.
 */
export const MEMBERS_PER_WORKER = 12;

export const MEMBERS_PER_WORKER_NOTE =
  `Crew ceiling is stage members ÷ ${MEMBERS_PER_WORKER} per worker — a working figure for how `
  + 'many people can reach the work, not a doctrinal crew size. (PH)';

export interface CrewRow {
  crew: number;
  /** Unrounded, so the reader can redo the arithmetic. */
  crewHours: number;
  /** Whole shifts, rounded up. Never tenths of a day. */
  shifts: number;
  /** Suppressed rows carry the reason instead of a number. */
  suppressed?: string;
}

export interface StageLabor {
  ordinal: number;
  name: string;
  members: number;
  manHours: number;
  /** Above this, the model has nothing to say — more people cannot reach the work. */
  maxUsefulCrew: number;
}

export interface LaborModel {
  stages: StageLabor[];
  totalManHours: number;
  /** The largest crew any stage can use. Rows past it are suppressed. */
  ceiling: number;
  productiveHoursPerDay: number;
  crewRows: CrewRow[];
  /** Printed as the days column's label, so two different physics can never look alike. */
  crewModel: 'linear';
}

export function maxUsefulCrew(members: number): number {
  return Math.max(1, Math.ceil(members / MEMBERS_PER_WORKER));
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(v)));

export function laborModel(
  bom: BomSummary,
  opts: { crewSizes?: readonly number[]; productiveHoursPerDay?: number } = {},
): LaborModel {
  const hours = clamp(opts.productiveHoursPerDay ?? DEFAULT_PRODUCTIVE_HOURS, HOURS_MIN, HOURS_MAX);
  const stages: StageLabor[] = bom.stages.map((s) => ({
    ordinal: s.stage,
    name: s.name,
    members: s.memberCount,
    manHours: s.manHours,
    maxUsefulCrew: maxUsefulCrew(s.memberCount),
  }));
  // The ceiling is the BIGGEST stage's, not the smallest: a crew that is too large for the
  // foundation is still the right crew for the wall framing, and the schedule is serial.
  const ceiling = stages.reduce((a, s) => Math.max(a, s.maxUsefulCrew), 1);

  const sizes = (opts.crewSizes ?? [2, 4, 6, 8, 12]).map((c) => clamp(c, CREW_MIN, CREW_MAX));
  const crewRows: CrewRow[] = sizes.map((crew) => {
    if (crew > ceiling) {
      return { crew, crewHours: 0, shifts: 0, suppressed: `above ${ceiling} is not modeled — more people cannot reach the work` };
    }
    const crewHours = bom.totalManHours / crew;
    return { crew, crewHours, shifts: Math.max(1, Math.ceil(crewHours / hours)) };
  });

  return { stages, totalManHours: bom.totalManHours, ceiling, productiveHoursPerDay: hours, crewRows, crewModel: 'linear' };
}

/**
 * The priorities-of-work bar chart, as pure SVG. Widths are proportional to stage man-hours
 * and the stages are SERIAL — that is a modeling choice, printed on the chart, not implied by
 * the picture.
 */
export function timelineSvg(model: LaborModel, width = 640): string {
  const rows = model.stages;
  if (rows.length === 0) return '';
  const rowH = 15;
  const labelW = 168;
  const pad = 4;
  const height = rows.length * rowH + pad * 2;
  const maxMh = rows.reduce((a, r) => Math.max(a, r.manHours), 0) || 1;
  const barMax = width - labelW - 54;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Man-hours by stage, stages run in order">`,
  ];
  rows.forEach((r, i) => {
    const y = pad + i * rowH;
    const w = Math.max(1, (r.manHours / maxMh) * barMax);
    const label = r.name.length > 30 ? `${r.name.slice(0, 29)}…` : r.name;
    parts.push(
      `<text x="0" y="${y + 10}" font-size="9.5" fill="#111">${r.ordinal}. ${esc(label)}</text>`,
      `<rect x="${labelW}" y="${y + 2.5}" width="${round(w)}" height="9" fill="#444" />`,
      `<text x="${round(labelW + w + 5)}" y="${y + 10}" font-size="9" fill="#444">${r.manHours.toFixed(0)} MH</text>`,
    );
  });
  parts.push('</svg>');
  return parts.join('');
}

const round = (n: number): number => Math.round(n * 10) / 10;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
