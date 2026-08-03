// TIMBER-1 engine — cut list / BOM / labor projections of Member[] (design doc §5).
// Nothing here re-measures geometry: every number is an aggregation over the same members the
// 3D scene draws, so the scene and the paperwork can never disagree.

import type { Member } from './types';
import { STAGES } from './types';
import { fracIn } from './units';
import type { StagePlanEntry } from './stagePlan';

// Nominal section board-feet per lineal foot (nominal w×d ÷ 12). EXPORTED (plan §3.6) so the
// dictionary test can assert it stays in lockstep with DRESSED — a nominal that resolves in
// one map and not the other is how a member silently contributes 0 board-feet to a bill.
export const BF_PER_LF: Record<string, number> = {
  '1x2': (1 * 2) / 12,
  '1x3': (1 * 3) / 12,
  '1x4': (1 * 4) / 12,
  '1x6': (1 * 6) / 12,
  '1x8': (1 * 8) / 12,
  '1x10': (1 * 10) / 12,
  '2x2': (2 * 2) / 12,
  '2x4': (2 * 4) / 12,
  '2x6': (2 * 6) / 12,
  '2x8': (2 * 8) / 12,
  '2x10': (2 * 10) / 12,
  '2x12': (2 * 12) / 12,
  '4x4': (4 * 4) / 12,
  '4x6': (4 * 6) / 12,
  '6x6': (6 * 6) / 12,
  '6x8': (6 * 8) / 12,
  '8x8': (8 * 8) / 12,
};

/**
 * Which bill section a nominal belongs in (plan §3.7). Lumber is bought by board-foot, sheet
 * goods by the sheet or the square, hardware by the piece or the pound — one bill that mixes
 * the units is a bill nobody can order from.
 */
export function classifyNominal(nominal: string): 'lumber' | 'sheet' | 'hardware' | 'other' {
  if (/^\d+x\d+$/.test(nominal)) return 'lumber';
  if (/panel|plywood|sheet|roll|corrugated|felt|screen|paper/i.test(nominal)) return 'sheet';
  if (/nail|bolt|hinge|hasp|staple|washer|strap|anchor|screw/i.test(nominal)) return 'hardware';
  return 'other'; // concrete, earth fill, and anything else measured its own way
}

export type NominalClass = ReturnType<typeof classifyNominal>;

/**
 * How a quantity is ordered. A number with no unit of issue is not a requisition — "37" could
 * be pieces, board-feet or sheets, and a supply section that guesses wrong gets the wrong pile
 * of wood delivered.
 */
export type UnitOfIssue = 'EA' | 'LF' | 'BF' | 'SHT' | 'CY' | 'LB';

const UNIT_BY_CLASS: Record<NominalClass, UnitOfIssue> = {
  lumber: 'BF',
  sheet: 'SHT',
  hardware: 'EA',
  other: 'LF', // concrete runs; the cubic-yard rollup is computed separately
};

/**
 * Ground contact rots untreated wood, and the members that touch the ground are exactly the
 * ones holding the building up. Derived by ROLE with a citation — a role with no cited rule
 * gets `undefined` and the column prints blank, because a guessed treatment on a requisition
 * is worse than an admitted gap.
 */
export type Treatment = 'ground-contact' | 'above-ground';

const TREATMENT_BY_ROLE: Readonly<Record<string, Treatment>> = {
  sill: 'ground-contact',
  post: 'ground-contact',
  skid: 'ground-contact',
  cribLog: 'ground-contact',
  lagging: 'ground-contact',
  ladderRail: 'above-ground',
  towerLeg: 'ground-contact',
  bentPost: 'ground-contact',
  deckPlank: 'above-ground',
  tread: 'above-ground',
};

export function treatmentFor(role: string): Treatment | undefined {
  return TREATMENT_BY_ROLE[role];
}

/** The one sentence that has to travel with the treatment column wherever it prints. */
export const TREATMENT_NOTE =
  'Treatment is derived from where the member sits, not from a supply catalogue: '
  + 'ground-contact for anything bearing on soil or a footing, above-ground for walking '
  + 'surfaces. Roles with no cited rule print blank rather than a guess. (PH)';

export interface CutLine {
  /** As ordered — sheet goods carry their thickness (see `orderNominal`). */
  nominal: string;
  /** As the member calls itself. The 3D scene and the cut list stay linked through this. */
  memberNominal: string;
  cutLengthIn: number; // rounded to 1/8"
  count: number;
  roles: string[]; // e.g. ["stud", "cripple"]
  memberIds: string[]; // BOM ↔ 3D linkage (design doc §4.1)
  boardFeet: number; // 0 for panels
  klass: NominalClass;
  unitOfIssue: UnitOfIssue;
  /** Grade as the generator stated it — `Member.grade`, which `cutList` used to throw away. */
  grade: string;
  treatment?: Treatment;
  /** Sheet goods only: face area in ft², from which sheets-to-buy is computed. */
  areaSqFt?: number;
  /**
   * Cross-section in in², off `Member.actual`. Concrete is billed by volume and the DRESSED
   * table has no concrete entry, so the only place the section can come from is the member.
   */
  sectionSqIn?: number;
}

export interface StageBom {
  stage: number; // ordinal into the model's stage plan
  name: string;
  lines: CutLine[];
  boardFeet: number;
  panels: number;
  memberCount: number;
  manHours: number;
}

export interface BomSummary {
  stages: StageBom[]; // only stages that have members, in build order
  totalBoardFeet: number;
  totalPanels: number;
  totalMembers: number;
  totalManHours: number;
}

// Placeholder labor rates, man-hours per board-foot equivalent (FM 5-426 Table C-1 pending
// verification — design doc §8 keeps these DOCTRINE-UNVERIFIED and visibly footnoted).
const MH_PER_BF = 0.055; // (PH)
const MH_PER_PANEL = 0.5; // (PH)
const MH_PER_CONC_LF = 0.15; // (PH) concrete form/pour per lineal foot of wall/footing/slab run

const eighth = (inches: number): number => Math.round(inches * 8) / 8;

export function boardFeet(m: Member): number {
  const perLf = BF_PER_LF[m.nominal];
  return perLf ? (m.cutLength / 12) * perLf : 0;
}

/**
 * The nominal AS ORDERED, which for a sheet good is not the nominal the member carries.
 *
 * Subfloor, roof sheathing and plywood siding all call themselves `4x8 panel`; their real
 * thicknesses are 3/4, 1/2 and 1/2 inch, and the generators do set them on `actual.w`. Keyed on
 * the bare nominal, three products collapse into one order line — a supply section reads it,
 * requisitions one pile of plywood, and either the floor goes down in half-inch or the roof in
 * three-quarter. Thickness is what keeps them apart.
 *
 * Done HERE rather than in the generators on purpose: the BOM is a projection (I-3), the two
 * legacy floor/roof generators are frozen under C-10, and correcting a bill needs no change to
 * the model it bills. The member is untouched; only the order line is qualified.
 */
export function orderNominal(m: Member): string {
  if (classifyNominal(m.nominal) !== 'sheet') return m.nominal;
  const thick = m.actual?.w;
  return thick && thick > 0 ? `${m.nominal} ${fracIn(thick)}"` : m.nominal;
}

export function cutList(members: Member[]): CutLine[] {
  const byKey = new Map<string, CutLine>();
  for (const m of members) {
    const len = eighth(m.cutLength);
    const nominal = orderNominal(m);
    // Grade is part of the key: a No. 2 and a select-structural 2x6 of the same length are two
    // different order lines, and merging them under-orders the better one.
    const key = `${nominal}|${len}|${m.grade}`;
    let line = byKey.get(key);
    if (!line) {
      const klass = classifyNominal(m.nominal);
      line = {
        nominal,
        memberNominal: m.nominal,
        cutLengthIn: len,
        count: 0,
        roles: [],
        memberIds: [],
        boardFeet: 0,
        klass,
        unitOfIssue: UNIT_BY_CLASS[klass],
        grade: m.grade,
        ...(klass === 'sheet' ? { areaSqFt: 0 } : {}),
        ...(m.actual ? { sectionSqIn: m.actual.w * m.actual.d } : {}),
      };
      byKey.set(key, line);
    }
    line.count += 1;
    line.memberIds.push(m.id);
    if (!line.roles.includes(m.role)) line.roles.push(m.role);
    line.boardFeet += boardFeet(m);
    // The first cited treatment wins; a line whose roles disagree keeps the stricter one,
    // because under-treating a member that touches soil is the failure that matters.
    const t = treatmentFor(m.role);
    if (t && (line.treatment === undefined || t === 'ground-contact')) line.treatment = t;
    if (line.areaSqFt !== undefined && m.actual) {
      line.areaSqFt += (m.cutLength / 12) * (m.actual.d / 12);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => a.nominal.localeCompare(b.nominal) || b.cutLengthIn - a.cutLengthIn,
  );
}

/**
 * Roll members up per stage. `plan` defaults to the legacy building stages, which is what
 * every TIMBER-1 caller gets and why they never had to change.
 *
 * TD18 — it THROWS when a member's stage exceeds the plan instead of quietly filtering it
 * out. The old behavior under-reported: hand a tower's members to the legacy plan and the
 * stages past 11 simply vanished from the bill, silently, with no error and a total that
 * looked plausible. A bill that is quietly short is worse than no bill.
 */
export function bomSummary(members: Member[], plan?: StagePlanEntry[]): BomSummary {
  const rows: { id: number; name: string }[] = plan
    ? plan.map((e) => ({ id: e.ordinal, name: e.label }))
    : STAGES.map((s) => ({ id: s.id, name: s.name }));

  const maxStage = members.reduce((a, m) => Math.max(a, m.stage), 0);
  if (maxStage > rows.length) {
    const offender = members.find((m) => m.stage === maxStage);
    throw new Error(
      `bomSummary: member ${offender?.id ?? '?'} is at stage ${maxStage}, past the ${rows.length}-stage plan. ` +
        'Pass the model\'s own stagePlan — silently dropping those members would under-report the bill (TIMBER2_PLAN TD18).',
    );
  }

  const stages: StageBom[] = [];
  for (const s of rows) {
    const ofStage = members.filter((m) => m.stage === s.id);
    if (ofStage.length === 0) continue;
    const lines = cutList(ofStage);
    const bf = lines.reduce((a, l) => a + l.boardFeet, 0);
    const panels = ofStage.filter((m) => m.nominal.includes('panel')).length;
    const concLf = ofStage.filter((m) => m.nominal.includes('conc')).reduce((a, m) => a + m.cutLength / 12, 0);
    stages.push({
      stage: s.id,
      name: s.name,
      lines,
      boardFeet: bf,
      panels,
      memberCount: ofStage.length,
      manHours: bf * MH_PER_BF + panels * MH_PER_PANEL + concLf * MH_PER_CONC_LF,
    });
  }
  return {
    stages,
    totalBoardFeet: stages.reduce((a, s) => a + s.boardFeet, 0),
    totalPanels: stages.reduce((a, s) => a + s.panels, 0),
    totalMembers: stages.reduce((a, s) => a + s.memberCount, 0),
    totalManHours: stages.reduce((a, s) => a + s.manHours, 0),
  };
}
