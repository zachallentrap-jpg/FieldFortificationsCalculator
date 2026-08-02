// TIMBER-2 — the doctrine data module (plan §6.6). ONE home for every magnitude the new
// generators use, each carrying its citation and its (PH) status.
//
// Two disciplines meet here:
//
//   Cite discipline — every doctrinal magnitude carries a `cite`; anything not yet
//   page-verified carries `ph: true`, which the UI renders as "(PH)". TIMBER ships working
//   defaults (plan §6.1) — the opposite of SAP-2's ship-empty regime — because a carpentry
//   number that is wrong is visibly wrong and claims no protection.
//
//   LS-GATE (plan §6.2) — any number whose failure mode is a fall, a collapse, or an
//   overload is tagged `lifeSafety: true`. `lifeSafetyRegister()` enumerates that set as the
//   single source for the UI badge, the printable register, and the CI ack gate. Changing an
//   LS value is never a quiet edit.
//
// Relationship to the frozen legacy modules: `floor.ts`/`walls.ts`/`roof.ts` are the C-10
// frozen branch and keep their own literals — editing them is a stop-the-line event, so the
// values are mirrored here rather than moved. `test/timber2-doctrine.test.ts` asserts the two
// agree, so they cannot drift apart silently.

export interface Doc<T> {
  value: T;
  unit?: string;
  cite: string;
  ph: boolean; // true until someone reads the page and says so
  lifeSafety?: boolean; // failure mode is fall / collapse / overload → LS-GATE
  note?: string;
}

const doc = <T>(value: T, cite: string, extra?: Partial<Doc<T>>): Doc<T> => ({ value, cite, ph: true, ...extra });

// ── Conversions (not doctrine — arithmetic) ──────────────────────────────────
export const IN_PER_FT = 12;

// ── Lumber & fasteners ───────────────────────────────────────────────────────
export const LUMBER = {
  defaultGrade: doc('No. 2 common', 'FM 5-426 lumber grades'),
  studNominal: doc('2x4', 'FM 5-426 ch. 6 wall framing'),
  plateNominal: doc('2x4', 'FM 5-426 ch. 6 wall framing'),
  joistNominal: doc('2x8', 'FM 5-426 Table 6-2 joist span', { lifeSafety: true }),
  girderPly: doc(3, 'FM 5-426 Table 6-1 built-up girder', { unit: 'plies', lifeSafety: true }),
  girderNominal: doc('2x10', 'FM 5-426 Table 6-1 built-up girder', { lifeSafety: true }),
  sillNominal: doc('2x6', 'FM 5-426 ch. 6 sills'),
  postNominal: doc('4x4', 'FM 5-426 post & footer spacing'),
  rafterNominal: doc('2x6', 'FM 5-426 ch. 6 roof framing', { lifeSafety: true }),
  ridgeNominal: doc('2x8', 'FM 5-426: ridge one size deeper than the rafters'),
  ceilingJoistNominal: doc('2x6', 'FM 5-426 ceiling joists tie the walls'),
  collarTieNominal: doc('2x4', 'FM 5-426 collar ties'),
  headerNominal: doc('2x6', 'FM 5-426 header table by span', { lifeSafety: true }),
  braceNominal: doc('1x4', 'FM 5-426 let-in corner brace'),
  crossBridgingNominal: doc('1x3', 'FM 5-426 cross bridging'),
  purlinNominal: doc('2x4', 'FM 5-426 purlin roof deck'),
  girtNominal: doc('2x6', 'TM 5-302 girts at panel lines'),
  deckPlankNominal: doc('2x6', 'TM 5-302 plank deck'),
  skidNominal: doc('4x6', 'TM 5-302 skid runners, PT, chamfered, drift-pinned'),
} as const;

export const PANEL = {
  widthFt: doc(4, 'FM 5-426 sheathing: 4x8 panels', { unit: 'ft' }),
  lengthFt: doc(8, 'FM 5-426 sheathing: 4x8 panels', { unit: 'ft' }),
  subfloorThickIn: doc(0.75, 'FM 5-426 subfloor', { unit: 'in' }),
  roofDeckThickIn: doc(0.5, 'FM 5-426 roof sheathing', { unit: 'in' }),
  sidingThickIn: doc(0.5, 'FM 5-426 plywood siding', { unit: 'in' }),
} as const;

// ── Layout & spacing ─────────────────────────────────────────────────────────
export const LAYOUT = {
  studSpacingIn: doc(16, 'FM 5-426 ch. 6: studs 16 in OC', { unit: 'in' }),
  joistSpacingIn: doc(16, 'FM 5-426 Table 6-2', { unit: 'in' }),
  rafterSpacingIn: doc(16, 'FM 5-426 ch. 6 roof framing', { unit: 'in' }),
  postSpacingMaxFt: doc(8, 'FM 5-426 post & footer spacing 6-10 ft', { unit: 'ft' }),
  bridgingRowMaxFt: doc(8, 'FM 5-426: bridging rows not more than 8 ft apart', { unit: 'ft' }),
  // The legacy floor generator starts a bridging row once a half-span reaches this.
  bridgingThresholdFt: doc(7.5, 'FM 5-426 bridging rows', { unit: 'ft' }),
  collarTieEveryNthRafter: doc(3, 'FM 5-426: collar tie every 3rd rafter / <= 5 ft'),
  purlinSpacingMaxIn: doc(24, 'FM 5-426 purlin spacing along the slope', { unit: 'in' }),
} as const;

// ── Foundations ──────────────────────────────────────────────────────────────
export const FOUNDATION = {
  crawlFt: doc(1.5, 'FM 5-426 crawl space', { unit: 'ft' }),
  basementDepthFt: doc(7.5, 'FM 5-426 basement wall height', { unit: 'ft' }),
  concreteWallThickIn: doc(8, 'FM 5-426 continuous-wall foundation', { unit: 'in' }),
  stripFootingWidthIn: doc(16, 'FM 5-426 wall footing: width ~2x wall', { unit: 'in' }),
  stripFootingDepthIn: doc(8, 'FM 5-426 wall footing depth ~ wall thickness', { unit: 'in' }),
  padSideIn: doc(16, 'FM 5-426 post footers', { unit: 'in' }),
  padDepthIn: doc(8, 'FM 5-426 post footers', { unit: 'in' }),
  slabThickIn: doc(4, 'FM 5-426 basement slab', { unit: 'in' }),
  // Exposed concrete above grade on a basement wall.
  basementRevealFt: doc(1, 'FM 5-426 foundation wall reveal', { unit: 'ft' }),
} as const;

// ── Stairs, ladders, ramps, rails — the life-safety block (EM 385-1-1) ───────
// TM 5-302 remains the geometry lineage; EM 385-1-1 is the named safety authority
// (plan TD27). Every entry here is LS-tagged: these are the fall-and-collapse numbers.
export const STAIR = {
  targetRiserIn: doc(7.5, 'FM 5-426 stairway layout; EM 385-1-1 riser limits', { unit: 'in', lifeSafety: true }),
  maxRiserIn: doc(8, 'EM 385-1-1 stair riser maximum', { unit: 'in', lifeSafety: true }),
  minTreadIn: doc(9, 'EM 385-1-1 stair tread minimum', { unit: 'in', lifeSafety: true }),
  unitRunIn: doc(10, 'FM 5-426 stair layout tread run', { unit: 'in', lifeSafety: true }),
  headroomIn: doc(80, 'EM 385-1-1 stair headroom', { unit: 'in', lifeSafety: true }),
  stringerNominal: doc('2x12', 'FM 5-426 stair stringers', { lifeSafety: true }),
  treadNominal: doc('2x10', 'FM 5-426 stair treads', { lifeSafety: true }),
  stringerCount: doc(3, 'FM 5-426 stair stringers', { lifeSafety: true }),
} as const;

export const LADDER = {
  railNominal: doc('2x4', 'TM 5-302 ladder detail; EM 385-1-1', { lifeSafety: true }),
  rungNominal: doc('2x2', 'TM 5-302 ladder detail (1x4 cleats recorded as rejected — TD24)', { lifeSafety: true }),
  rungSpacingIn: doc(12, 'EM 385-1-1 ladder rung spacing', { unit: 'in', lifeSafety: true }),
  topExtensionIn: doc(36, 'EM 385-1-1: rails extend 36 in above the landing', { unit: 'in', lifeSafety: true }),
  // Above this climb, a fixed ladder needs a cage — the core answer is a stair instead
  // (the cage itself is IN-later, plan §2.3).
  cageThresholdFt: doc(20, 'EM 385-1-1 fixed-ladder cage threshold', { unit: 'ft', lifeSafety: true }),
} as const;

export const RAIL = {
  topHeightIn: doc(42, 'EM 385-1-1 guardrail height', { unit: 'in', lifeSafety: true }),
  midHeightIn: doc(21, 'EM 385-1-1 midrail', { unit: 'in', lifeSafety: true }),
  toeBoardHeightIn: doc(4, 'EM 385-1-1 toe board', { unit: 'in', lifeSafety: true }),
  postSpacingMaxFt: doc(8, 'EM 385-1-1 guardrail post spacing', { unit: 'ft', lifeSafety: true }),
  postNominal: doc('4x4', 'TM 5-302 rail posts', { lifeSafety: true }),
  memberNominal: doc('2x4', 'TM 5-302 rails', { lifeSafety: true }),
  // Open edges at or above this height must be railed.
  requiredAboveFt: doc(2.5, 'EM 385-1-1 fall-protection threshold', { unit: 'ft', lifeSafety: true }),
} as const;

export const RAMP = {
  slopes: doc([4, 6, 8] as const, 'EM 385-1-1 / TM 5-302 ramp slopes (1:N)', { lifeSafety: true }),
  stringerNominal: doc('2x12', 'TM 5-302 ramp stringers', { lifeSafety: true }),
} as const;

// ── Roofing & coverings ──────────────────────────────────────────────────────
export const ROOFING = {
  rollWidthIn: doc(36, 'FM 5-426 roll roofing: 36-in rolls', { unit: 'in' }),
  rollSideLapIn: doc(2, 'FM 5-426 roll roofing side lap', { unit: 'in' }),
  rollEndLapIn: doc(6, 'FM 5-426 roll roofing end lap', { unit: 'in' }),
  rollMinSlopePer12: doc(2, 'FM 5-426 exposed-nail roll roofing minimum slope', { unit: 'in/ft', lifeSafety: false }),
  rollDoubleMinSlopePer12: doc(1, 'FM 5-426 double-coverage roll roofing minimum slope', { unit: 'in/ft' }),
  corrugatedWidthIn: doc(26, 'FM 5-426 corrugated metal sheet width', { unit: 'in' }),
  corrugatedLengthFt: doc(8, 'FM 5-426 corrugated metal sheet length', { unit: 'ft' }),
  corrugatedSideLapCorrugations: doc(1.5, 'FM 5-426 corrugated side lap'),
  feltWidthIn: doc(36, 'FM 5-426 felt underlayment', { unit: 'in' }),
  feltLapIn: doc(2, 'FM 5-426 felt lap', { unit: 'in' }),
  squareSf: doc(100, 'roofing square = 100 sf', { unit: 'sf', ph: false }),
} as const;

export const SIDING = {
  boardNominal: doc('1x10', 'FM 5-426 board-and-batten siding'),
  battenNominal: doc('1x2', 'FM 5-426 board-and-batten siding'),
  boardLapIn: doc(0, 'FM 5-426 board-and-batten: boards butt, battens cover', { unit: 'in' }),
} as const;

// ── Labor (placeholder rates — TM 5-303 / NAVFAC P-405 pending, plan §2.1) ───
// Values equal the legacy bom.ts constants exactly; the doctrine test pins that.
export const LABOR = {
  mhPerBoardFoot: doc(0.055, 'FM 5-426 Table C-1 / TM 5-303 labor factors', { unit: 'MH/BF' }),
  mhPerPanel: doc(0.5, 'FM 5-426 Table C-1 / TM 5-303 labor factors', { unit: 'MH/panel' }),
  mhPerConcreteLf: doc(0.15, 'TM 5-303 concrete form/pour factors', { unit: 'MH/LF' }),
} as const;

// ── The register ─────────────────────────────────────────────────────────────

export interface LsEntry {
  id: string; // dotted path, e.g. 'RAIL.topHeightIn'
  value: unknown;
  unit?: string;
  cite: string;
  ph: boolean;
  note?: string;
}

const GROUPS: Record<string, Record<string, Doc<unknown>>> = {
  LUMBER, PANEL, LAYOUT, FOUNDATION, STAIR, LADDER, RAIL, RAMP, ROOFING, SIDING, LABOR,
} as unknown as Record<string, Record<string, Doc<unknown>>>;

/** Every doctrine constant, flattened — the source for the doc-integrity tests. */
export function allDoctrineEntries(): LsEntry[] {
  const out: LsEntry[] = [];
  for (const group of Object.keys(GROUPS).sort()) {
    const table = GROUPS[group]!;
    for (const key of Object.keys(table).sort()) {
      const d = table[key]!;
      out.push({ id: `${group}.${key}`, value: d.value, unit: d.unit, cite: d.cite, ph: d.ph, note: d.note });
    }
  }
  return out;
}

/**
 * The LS-GATE register (plan §6.2): every constant whose failure mode is a fall, a collapse,
 * or an overload. Single source for the member-card badge, the studio banner, the printable
 * register, and the CI ack gate — so the UI can never show a different set than CI enforces.
 */
export function lifeSafetyRegister(): LsEntry[] {
  const out: LsEntry[] = [];
  for (const group of Object.keys(GROUPS).sort()) {
    const table = GROUPS[group]!;
    for (const key of Object.keys(table).sort()) {
      const d = table[key]!;
      if (!d.lifeSafety) continue;
      out.push({ id: `${group}.${key}`, value: d.value, unit: d.unit, cite: d.cite, ph: d.ph, note: d.note });
    }
  }
  return out;
}

/** Render a cite for a member's `doctrineRef`, carrying (PH) and the LS review suffix. */
export function citeOf(d: Doc<unknown>): string {
  const ph = d.ph ? ' (PH)' : '';
  const ls = d.lifeSafety && d.ph ? ' — LIFE-SAFETY, review required' : d.lifeSafety ? ' — LIFE-SAFETY' : '';
  return `${d.cite}${ph}${ls}`;
}
