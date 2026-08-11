// TIMBER-2 T8 — span checks (plan mandate #2: WARN, never silently resize).
//
// The rule this module exists to enforce is a design decision, not an implementation detail: a
// member whose span is past its table row produces a WARNING against that member, and the
// engine changes nothing. A tool that quietly upsizes a joist to make its own check pass has
// taught the operator nothing, and has handed the crew a different building from the one on the
// drawing they are holding.
//
// It is a lookup against `doctrine.SPAN`, not an engineering model, and the table is (PH). Both
// facts print with the warning: a warning that overstates its own authority is worse than none,
// because the next person treats it as a clearance.

import type { Member } from './types';
import { DRESSED } from './types';
import { SPAN, LUMBER, IN_PER_FT, citeOf } from './doctrine';

/**
 * How much of THIS member's cut length is bearing rather than span, both ends together.
 *
 * The table row is a CLEAR span between bearings and a cut length is not, so the two differ by
 * whatever the emitter left to sit on — and that is not one number for every member wearing the
 * `header` role. A doorway header is cut to the rough opening plus a jack stud at each side; a
 * beam over an open bay is cut post centreline to post centreline and has half a post at each
 * splice and a whole one at the ends of the run; a bunker's entrance header lands on jamb
 * timbers. Only the emitter knows which, so it says so on the member (`Member.bearingTotalIn`).
 *
 * The fallback is the doorway shape, because that is what the FROZEN wall generator cuts
 * (`walls.ts`: `widthFt + 2t`) and a frozen module cannot be given a new field to carry.
 */
const bearingTotalIn = (m: Member): number =>
  m.bearingTotalIn ?? 2 * DRESSED[LUMBER.studNominal.value as string]!.w;

export interface SpanWarning {
  memberId: string;
  role: Member['role'];
  nominal: string;
  spanFt: number;
  allowedFt: number;
  spacingIn: number;
  message: string;
  cite: string;
}

/** Nearest table column at or above this spacing — a 12-in layout is checked at the 16-in row. */
function columnFor(table: Record<number, number>, spacingIn: number): { spacing: number; allowed: number } | null {
  const cols = Object.keys(table).map(Number).sort((a, b) => a - b);
  const pick = cols.find((c) => c >= spacingIn) ?? cols[cols.length - 1];
  if (pick === undefined) return null;
  return { spacing: pick, allowed: table[pick]! };
}

/**
 * Every member that is past its span table. Pure, and scoped to the three roles the tables
 * actually cover — a role with no table produces no warning rather than a guess.
 */
export function spanWarnings(
  members: Member[],
  spacing: { joistSpacingIn: number; rafterSpacingIn: number },
  /**
   * Top of the floor deck. Members above it that carry the `joist` role are CEILING joists, and
   * the floor table does not apply to them — a ceiling joist carries a ceiling, not a floor, and
   * gets its own longer rows. Checking one against the floor table condemned the standard GP
   * building by four tenths of a foot, which is exactly the kind of false alarm that teaches
   * people to ignore the real ones. They now have their own table (`SPAN.ceilingJoist`); this
   * parameter is what tells the two apart.
   */
  floorTopY = Infinity,
): SpanWarning[] {
  const out: SpanWarning[] = [];
  // A joist's CLEAR span is not its length, and this is the part a naive checker gets wrong in
  // both directions. FM 5-426 puts a built-up girder down the middle of a building precisely so
  // a 20-ft joist spans 10 ft twice; a shed on three skids spans a third of its width. Checking
  // either at full length condemns the standard design the tool itself ships, and a checker that
  // fires on its own presets is one people learn to scroll past.
  //
  // So: gather every line the floor can bear on — girders, skids and sills — and take the
  // LARGEST gap between consecutive ones. Largest, not average, because the span that governs is
  // the worst one, and this makes no assumption that the lines are evenly spaced.
  const bearingZ = [...new Set(
    members
      .filter((m) => m.role === 'girder' || m.role === 'skid' || m.role === 'sill')
      .map((m) => Math.round(m.position[2] * 1000) / 1000),
  )].sort((a, b) => a - b);
  const worstBay = (halfSpanFt: number, centreZ: number): number => {
    const lo = centreZ - halfSpanFt;
    const hi = centreZ + halfSpanFt;
    const inside = bearingZ.filter((z) => z > lo + 1e-6 && z < hi - 1e-6);
    const stops = [lo, ...inside, hi];
    let worst = 0;
    for (let i = 1; i < stops.length; i++) worst = Math.max(worst, stops[i]! - stops[i - 1]!);
    return worst;
  };
  const joistTable = SPAN.joist.value as Record<string, Record<number, number>>;
  const rafterTable = SPAN.rafter.value as Record<string, Record<number, number>>;
  const ceilingTable = SPAN.ceilingJoist.value as Record<string, Record<number, number>>;
  const headerTable = SPAN.header.value as Record<string, number>;

  for (const m of members) {
    if ((m.role === 'joist' || m.role === 'tailJoist') && m.position[1] <= floorTopY + 1e-6) {
      const spanFt = worstBay(m.cutLength / IN_PER_FT / 2, m.position[2]);
      const row = joistTable[m.nominal];
      const col = row && columnFor(row, spacing.joistSpacingIn);
      if (col && spanFt > col.allowed + 1e-6) {
        out.push({
          memberId: m.id, role: m.role, nominal: m.nominal, spanFt, allowedFt: col.allowed, spacingIn: col.spacing,
          message: `${m.nominal} joist spans ${spanFt.toFixed(1)} ft; the table allows ${col.allowed} ft at ${col.spacing} in o.c. Deepen the joist, close the spacing, or add a bearing line — the tool has NOT changed it.`,
          cite: citeOf(SPAN.joist),
        });
      }
    } else if (m.role === 'joist' && m.position[1] > floorTopY + 1e-6) {
      // Above the deck: a CEILING joist, on its own table.
      const row = ceilingTable[m.nominal];
      const col = row && columnFor(row, spacing.joistSpacingIn);
      const spanFt = worstBay(m.cutLength / IN_PER_FT / 2, m.position[2]);
      if (col && spanFt > col.allowed + 1e-6) {
        out.push({
          memberId: m.id, role: m.role, nominal: m.nominal, spanFt, allowedFt: col.allowed, spacingIn: col.spacing,
          message: `${m.nominal} ceiling joist spans ${spanFt.toFixed(1)} ft; the ceiling table allows ${col.allowed} ft at ${col.spacing} in o.c. Deepen it, close the spacing, or add a bearing partition — the tool has NOT changed it.`,
          cite: citeOf(SPAN.ceilingJoist),
        });
      }
    } else if (m.role === 'rafter') {
      // A rafter's span is its horizontal RUN, not its sloped length — the table is read on the
      // plan projection. Without this a steep roof condemns itself for being steep.
      const spanFt = (m.cutLength / IN_PER_FT) * Math.cos(m.angles?.seatCut ? (m.angles.seatCut * Math.PI) / 180 : 0);
      const row = rafterTable[m.nominal];
      const col = row && columnFor(row, spacing.rafterSpacingIn);
      if (col && spanFt > col.allowed + 1e-6) {
        out.push({
          memberId: m.id, role: m.role, nominal: m.nominal, spanFt, allowedFt: col.allowed, spacingIn: col.spacing,
          message: `${m.nominal} rafter runs ${spanFt.toFixed(1)} ft; the table allows ${col.allowed} ft at ${col.spacing} in o.c. Deepen it, close the spacing, or add a purlin — the tool has NOT changed it.`,
          cite: citeOf(SPAN.rafter),
        });
      }
    } else if (m.role === 'header') {
      // THE SIZER AND THE CHECKER HAVE TO MEAN THE SAME WORD. A header over an opening is CHOSEN
      // by `headerForSpan(openingWidth)` — a clear span — and then CUT to that width plus a jack
      // at each end. Read against the same table, the cut length condemns the member the tool
      // itself just picked on every opening landing on a table row: a 5-ft opening gets the 2x6
      // the 5-ft row allows and is reported as a 5.3-ft span past a 5-ft limit, tagged
      // LIFE-SAFETY. That is the cry-wolf failure the header of this file says the module exists
      // to prevent, fired by the module against itself. The bearing subtracted is the one THIS
      // member was cut with, not one shape assumed for every emitter of the role.
      const spanFt = Math.max(0, (m.cutLength - bearingTotalIn(m)) / IN_PER_FT);
      const allowed = headerTable[m.nominal];
      if (allowed !== undefined && spanFt > allowed + 1e-6) {
        out.push({
          memberId: m.id, role: m.role, nominal: m.nominal, spanFt, allowedFt: allowed, spacingIn: 0,
          message: `${m.nominal} header spans ${spanFt.toFixed(1)} ft; the table allows ${allowed} ft. Deepen the header or post the opening — the tool has NOT changed it.`,
          cite: citeOf(SPAN.header),
        });
      }
    }
  }
  return out;
}

/**
 * One line per distinct problem rather than one per member: forty identical joists produce one
 * sentence with a count, because forty copies of the same warning is a wall of text people learn
 * to scroll past, and the fortieth is the one they stop reading before.
 */
export function summarizeSpanWarnings(warnings: SpanWarning[]): string[] {
  const by = new Map<string, { w: SpanWarning; n: number }>();
  for (const w of warnings) {
    const key = `${w.role}|${w.nominal}|${w.spanFt.toFixed(2)}`;
    const row = by.get(key);
    if (row) row.n += 1;
    else by.set(key, { w, n: 1 });
  }
  return [...by.values()].map(({ w, n }) => `${n > 1 ? `${n}× ` : ''}${w.message} (${w.cite})`);
}
