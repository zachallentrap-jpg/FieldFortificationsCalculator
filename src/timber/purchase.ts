// TIMBER-2 — turning a cut list into something a supply section can act on (§4.1.3, FD61).
//
// THE GAP THIS CLOSES. `2x4, 12 ft, 37 pieces` is not a requisition. Nobody stocks 12-ft cuts;
// they stock 8, 10, 12, 14 and 16-ft sticks, and a section that hands supply a cut list gets
// back a question, not lumber. This module answers the only question that matters — HOW MANY
// STICKS OF WHAT LENGTH DO I ORDER — and states its own error bars while doing it.
//
// FIRST-FIT DECREASING, and the choice is deliberate. Optimal bin packing is NP-hard; FFD is
// within 11/9 of optimal and, far more usefully, it is what a Marine with a chop saw actually
// does: take the longest cut still needed, put it on the longest stick that will hold it. A
// purchase table nobody can reproduce by hand is a purchase table nobody trusts.
//
// KERF IS IGNORED, AND SAID SO. A 1/8-inch blade over forty cuts is five inches — real, but
// smaller than the rounding already in the cut list, and pretending to model it would imply a
// precision this does not have. It is stated on the table rather than buried here.
//
// LUMBER ONLY (FD61). Run a panel or a concrete nominal through this and it prints a line
// telling supply to buy 12-ft lengths of concrete slab, and the cube goes NaN on the way (the
// DRESSED table has no concrete entry). Sheets and concrete have their own paths below.

import type { CutLine } from './bom';
import { classifyNominal } from './bom';
import { IN_PER_FT, PANEL, ROOFING } from './doctrine';

/** Stock lengths a supply point actually carries. Overridable per theater. */
export const DEFAULT_STOCK_FT: readonly number[] = [8, 10, 12, 14, 16];

export interface StockRow {
  nominal: string;
  grade: string;
  stockLengthFt: number;
  /** Sticks to buy at this length. */
  pieces: number;
  /** How many cuts these sticks yield, and at what lengths. */
  cutsServed: { lengthIn: number; count: number }[];
  /** Lineal feet left over after every cut is made. Exact, not a percentage. */
  wasteLF: number;
}

/**
 * A run longer than any stock length. NOT an error and usually not a special order: a 48-ft
 * top plate is drawn as one member because that is the run, and on site it is spliced — plates
 * lap over studs and at the corners, sills butt over bearing. What the tool will not do is
 * decide where those splices go, so it reports the run and the lineal feet and leaves the
 * decision with the person holding the saw.
 */
export interface LongRun {
  nominal: string;
  grade: string;
  lengthIn: number;
  count: number;
  linealFt: number;
  roles: string[];
}

export type SheetBasis =
  /** Butts edge to edge — the cut area IS the area consumed, so sheets-to-buy is exact. */
  | 'sheet'
  /** Laps as it is laid (roofing, felt, paper). Reported as coverage; laps are not added. */
  | 'square';

export interface SheetRow {
  nominal: string;
  basis: SheetBasis;
  /** Pieces cut — a ripped panel is one piece, not one sheet. */
  pieces: number;
  areaSqFt: number;
  /** `sheet` basis: whole sheets to buy. `square` basis: 100-sf squares of coverage. */
  quantity: number;
  unit: 'SHT' | 'SQ';
}

export interface ConcreteRow {
  nominal: string;
  linealFt: number;
  cubicYards: number;
}

export interface Purchase {
  stock: StockRow[];
  /** Runs longer than the longest stock: never silently spliced, always surfaced. */
  longRuns: LongRun[];
  sheets: SheetRow[];
  concrete: ConcreteRow[];
  hardware: { nominal: string; count: number }[];
  /** Nominals that could not be sized — printed as omitted rather than as zero. */
  unpriced: string[];
}

const CUBIC_FT_PER_YD = 27;
const SQ_IN_PER_SQ_FT = 144;

/**
 * How a sheet-classed nominal is bought. Panels butt, so their cut area is exactly the area
 * consumed and "sheets to buy" is a real number. Roll goods, felt and paper LAP as they are
 * laid, so the same arithmetic would under-order them — those are reported as coverage in
 * squares, which is how roofing is ordered anyway, with the lap stated rather than guessed.
 */
function sheetBasis(nominal: string): SheetBasis {
  return /panel/i.test(nominal) ? 'sheet' : 'square';
}

/**
 * FIRST-FIT DECREASING over one nominal+grade's cuts.
 *
 * Bins are opened at the SHORTEST stock length that can hold the cut being placed, not the
 * longest: opening a 16-footer for a 3-ft cut when a 8-footer would do buys wood to throw away.
 */
export function stockFit(lines: readonly CutLine[], stockLengthsFt: readonly number[] = DEFAULT_STOCK_FT): {
  stock: StockRow[];
  longRuns: LongRun[];
} {
  const stocks = [...stockLengthsFt].sort((a, b) => a - b);
  const longestIn = (stocks[stocks.length - 1] ?? 0) * IN_PER_FT;
  const byProduct = new Map<string, { nominal: string; grade: string; cuts: number[] }>();
  const longRuns: LongRun[] = [];

  for (const line of lines) {
    if (classifyNominal(line.memberNominal) !== 'lumber') continue;
    const key = `${line.nominal}|${line.grade}`;
    let p = byProduct.get(key);
    if (!p) { p = { nominal: line.nominal, grade: line.grade, cuts: [] }; byProduct.set(key, p); }
    if (line.cutLengthIn > longestIn) {
      // A run nobody stocks — a 48-ft plate. Packing it into bins would print "buy four 16-ft
      // sticks", which happens to be right for a plate and badly wrong for a girder, and the
      // tool cannot tell which without a splice rule it does not have.
      longRuns.push({
        nominal: line.nominal,
        grade: line.grade,
        lengthIn: line.cutLengthIn,
        count: line.count,
        linealFt: Math.round((line.cutLengthIn / IN_PER_FT) * line.count * 100) / 100,
        roles: [...line.roles],
      });
      continue;
    }
    for (let i = 0; i < line.count; i++) p.cuts.push(line.cutLengthIn);
  }

  const stock: StockRow[] = [];
  for (const p of [...byProduct.values()].sort((a, b) => a.nominal.localeCompare(b.nominal) || a.grade.localeCompare(b.grade))) {
    if (p.cuts.length === 0) continue;
    const cuts = [...p.cuts].sort((a, b) => b - a); // decreasing
    const bins: { lengthIn: number; remainIn: number; cuts: number[] }[] = [];
    for (const cut of cuts) {
      const bin = bins.find((b) => b.remainIn >= cut - 1e-9);
      if (bin) { bin.remainIn -= cut; bin.cuts.push(cut); continue; }
      const stockFt = stocks.find((s) => s * IN_PER_FT >= cut - 1e-9)!;
      bins.push({ lengthIn: stockFt * IN_PER_FT, remainIn: stockFt * IN_PER_FT - cut, cuts: [cut] });
    }
    // Roll the bins up by stock length — supply orders "14 of the 12-footers", not 14 bins.
    const byLength = new Map<number, { pieces: number; waste: number; cuts: Map<number, number> }>();
    for (const b of bins) {
      const ft = b.lengthIn / IN_PER_FT;
      let g = byLength.get(ft);
      if (!g) { g = { pieces: 0, waste: 0, cuts: new Map() }; byLength.set(ft, g); }
      g.pieces += 1;
      g.waste += b.remainIn / IN_PER_FT;
      for (const c of b.cuts) g.cuts.set(c, (g.cuts.get(c) ?? 0) + 1);
    }
    for (const [ft, g] of [...byLength.entries()].sort((a, b) => b[0] - a[0])) {
      stock.push({
        nominal: p.nominal,
        grade: p.grade,
        stockLengthFt: ft,
        pieces: g.pieces,
        cutsServed: [...g.cuts.entries()].sort((a, b) => b[0] - a[0]).map(([lengthIn, count]) => ({ lengthIn, count })),
        wasteLF: Math.round(g.waste * 100) / 100,
      });
    }
  }
  return { stock, longRuns };
}

/** Everything a bill needs, split by how each thing is bought. */
export function purchaseFor(lines: readonly CutLine[], stockLengthsFt: readonly number[] = DEFAULT_STOCK_FT): Purchase {
  const { stock, longRuns } = stockFit(lines, stockLengthsFt);

  const sheetSqFt = (PANEL.widthFt.value as number) * (PANEL.lengthFt.value as number);
  const squareSqFt = ROOFING.squareSf.value as number;

  const sheetsBy = new Map<string, SheetRow>();
  const concBy = new Map<string, ConcreteRow>();
  const hardBy = new Map<string, number>();
  const unpriced = new Set<string>();

  for (const line of lines) {
    const klass = classifyNominal(line.memberNominal);
    if (klass === 'sheet') {
      let row = sheetsBy.get(line.nominal);
      if (!row) {
        const basis = sheetBasis(line.nominal);
        row = { nominal: line.nominal, basis, pieces: 0, areaSqFt: 0, quantity: 0, unit: basis === 'sheet' ? 'SHT' : 'SQ' };
        sheetsBy.set(line.nominal, row);
      }
      row.pieces += line.count;
      row.areaSqFt += line.areaSqFt ?? 0;
      continue;
    }
    if (klass === 'hardware') {
      hardBy.set(line.nominal, (hardBy.get(line.nominal) ?? 0) + line.count);
      continue;
    }
    if (klass === 'other') {
      const lf = (line.cutLengthIn / IN_PER_FT) * line.count;
      let row = concBy.get(line.nominal);
      if (!row) { row = { nominal: line.nominal, linealFt: 0, cubicYards: 0 }; concBy.set(line.nominal, row); }
      row.linealFt += lf;
      // Volume comes off the MEMBER's own section, not from DRESSED — DRESSED has no concrete
      // entry at all, and indexing it here is how the cube goes NaN (FD61). A nominal with no
      // section on its members keeps its lineal feet, leaves the yards at zero, and is named in
      // `unpriced`: an admitted gap, never a fabricated 0.4 cubic yards.
      if (line.sectionSqIn && line.sectionSqIn > 0) {
        row.cubicYards += (lf * (line.sectionSqIn / SQ_IN_PER_SQ_FT)) / CUBIC_FT_PER_YD;
      } else {
        unpriced.add(line.nominal);
      }
    }
  }

  for (const row of sheetsBy.values()) {
    const per = row.basis === 'sheet' ? sheetSqFt : squareSqFt;
    row.quantity = Math.ceil(row.areaSqFt / per - 1e-9);
  }

  const round2 = (n: number): number => Math.round(n * 100) / 100;
  return {
    stock,
    longRuns,
    sheets: [...sheetsBy.values()].map((r) => ({ ...r, areaSqFt: round2(r.areaSqFt) })).sort((a, b) => a.nominal.localeCompare(b.nominal)),
    concrete: [...concBy.values()]
      .map((r) => ({ ...r, linealFt: round2(r.linealFt), cubicYards: round2(r.cubicYards) }))
      .sort((a, b) => a.nominal.localeCompare(b.nominal)),
    hardware: [...hardBy.entries()].map(([nominal, count]) => ({ nominal, count })).sort((a, b) => a.nominal.localeCompare(b.nominal)),
    unpriced: [...unpriced].sort(),
  };
}

/** Fixed sentences that print WITH the tables. Not chrome — they are the error bars. */
export const PURCHASE_NOTES = {
  stockFit: 'First-fit estimate over the stock lengths named above. Saw kerf is ignored; over forty cuts that is roughly five inches of stick, smaller than the rounding already in the cut list.',
  waste: 'Cut-fit waste is the exact stock remainder. No contingency allowance is applied — a percentage allowance is a doctrinal number and none is cited yet.',
  sheets: 'Panels butt edge to edge, so sheets to buy is cut area divided by a whole sheet, rounded up. A ripped panel counts as one piece cut, not one sheet bought.',
  squares: 'Roll goods, felt and paper are reported as AREA COVERED, in 100-sf squares. Side and end laps are NOT added — order to the manufacturer\'s coverage, not to this number. (PH)',
  longRuns: 'These runs are longer than the longest stock length. A continuous member is drawn as one run because that is the run; on site plates lap over studs and at corners, and sills butt over bearing. This tool does not choose splice locations — order to the lineal feet and splice per FM 5-426.',
} as const;
