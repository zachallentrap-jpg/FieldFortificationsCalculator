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
  // Below this width the floor is girderless — joists clear-span (plan §3.2.2). Stated once
  // so custom, guard-shack and latrine cannot disagree about where the rule starts.
  smallPlanWidthFt: doc(8, 'FM 5-426 Table 6-2: a short span needs no intermediate bearing', { unit: 'ft' }),
} as const;

/**
 * Modeling tolerances — geometry bookkeeping, not doctrine. They exist so coincident surfaces
 * do not z-fight and so a degenerate sliver is not emitted as a member; no manual has an
 * opinion about them, which is exactly why they are named here rather than typed inline.
 */
export const TOLERANCE = {
  /** Lift a covering off the surface below it so the two do not z-fight. */
  surfaceLiftFt: 0.01,
  /** Bridging is skipped in a bay narrower than this — there is nothing to brace. */
  minBayFt: 0.15,
  /** Bridging stops short of the joist edges by this much, so it fits between them. */
  bridgingInsetFt: 0.06,
  /** Half the lateral offset between a crossed bridging pair. */
  bridgingSplayFt: 0.04,
  /** A piece thinner than this is a sliver, not a member — skip it. */
  minSliverFt: 0.05,
  /** Loop guard so a run that lands exactly on its end does not emit a zero-width piece. */
  epsFt: 0.01,
  /** Infill studs shorter than this are not worth cutting; the plate covers the gap. */
  minInfillStudFt: 0.2,
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

export const PLATFORM = {
  pierSpacingFt: doc(8, 'FM 5-426 post & footer spacing on a deck (PH)', { unit: 'ft' }),
  padSideIn: doc(16, 'FM 5-426 post footers', { unit: 'in' }),
  padDepthIn: doc(8, 'FM 5-426 post footers', { unit: 'in' }),
  /** Bent posts stand this far in from the deck edge, so the plate is not the last board. */
  bentInsetFt: doc(0.25, 'TM 10-8340 tent frame (PH)', { unit: 'ft' }),
  /** Shorter than this and a 'post' is a shim, not a member. Mirrors the frozen floor.ts guard. */
  minPostFt: doc(0.1, 'engine floor: below this a post is a shim, not a member', { unit: 'ft', ph: false }),
} as const;

export const RAMP = {
  slopes: doc([4, 6, 8] as const, 'EM 385-1-1 / TM 5-302 ramp slopes (1:N)', { lifeSafety: true }),
  stringerNominal: doc('2x12', 'TM 5-302 ramp stringers', { lifeSafety: true }),
} as const;

// ── Standard rough openings ──────────────────────────────────────────────────
// The sizes a door and a window are framed to when nobody has said otherwise. They live here
// rather than in the generators because they are used in three places that must agree: the hut
// family's default openings, the planning app's "+ Door / + Window / + Vent" buttons, and the
// catalog presets. Three copies of "a door is 3 by 6 foot 8" is three chances to disagree.
export const OPENING = {
  doorWidthFt: doc(3, 'FM 5-426 door rough opening (PH)', { unit: 'ft' }),
  doorHeightFt: doc(6.7, 'FM 5-426 door rough opening — 6 ft 8 in (PH)', { unit: 'ft' }),
  windowWidthFt: doc(3, 'FM 5-426 window rough opening (PH)', { unit: 'ft' }),
  windowHeightFt: doc(3.5, 'FM 5-426 window rough opening (PH)', { unit: 'ft' }),
  windowSillFt: doc(3.5, 'FM 5-426 window sill height (PH)', { unit: 'ft' }),
  ventWidthFt: doc(1.5, 'FM 5-426 gable/wall vent (PH)', { unit: 'ft' }),
  ventHeightFt: doc(1, 'FM 5-426 gable/wall vent (PH)', { unit: 'ft' }),
  ventSillFt: doc(6.5, 'FM 5-426 vent set high in the wall (PH)', { unit: 'ft' }),
  /** Clear wall a window is set back from a corner, so the king stud is not the corner post. */
  cornerSetbackFt: doc(2, 'FM 5-426 opening layout (PH)', { unit: 'ft' }),
  /** Spacing between the windows a long wall gets by default. */
  windowPitchFt: doc(12, 'FM 5-426 opening layout (PH)', { unit: 'ft' }),
} as const;

// ── Named structure dimensions (plan §2.2 — the "exhaustive hut family") ─────
// These are the plan sizes the TO hut family is commonly built to. They are (PH) like every
// other magnitude here, and for a sharper reason than usual: the hut family's lineage is thin
// (plan §2.2), so a card exists BECAUSE a preset can express it, not because a sheet has been
// read. Each family's `rationale` in catalog.ts says so on the card, and every one of these is
// an operator-adjustable number, never a locked value pretending to be doctrine.
export const HUT = {
  seaHut: doc({ lengthFt: 32, widthFt: 16, wallHeightFt: 8 }, 'TM 5-302 SEA hut (PH — sheet pending)'),
  swaHut: doc({ lengthFt: 32, widthFt: 20, wallHeightFt: 8 }, 'TM 5-302 SWA hut (PH — sheet pending)'),
  bHut: doc({ lengthFt: 36, widthFt: 16, wallHeightFt: 8 }, 'TM 5-302 B-hut (PH — sheet pending)'),
  squadHut: doc({ lengthFt: 50, widthFt: 20, wallHeightFt: 8 }, 'TM 5-302 squad hut (PH — sheet pending)'),
  guardShack: doc({ lengthFt: 8, widthFt: 8, wallHeightFt: 7.5 }, 'TM 5-302 guard shack (PH — sheet pending)'),
  latrine: doc({ lengthFt: 12, widthFt: 8, wallHeightFt: 8 }, 'TM 5-302 field latrine (PH — sheet pending)'),
  // The screened band under the eaves is what makes a SEA hut a SEA hut: ventilation with the
  // walls otherwise closed. Sill height and band height, in feet above the deck.
  screenBandSillFt: doc(6, 'TM 5-302 SEA hut screened band (PH)', { unit: 'ft' }),
  screenBandHeightFt: doc(1.5, 'TM 5-302 SEA hut screened band (PH)', { unit: 'ft' }),
  // Girts stiffen a stud wall that carries siding but no sheathing, and they are what the
  // screen band and shutters hang on.
  girtNominal: doc('2x4', 'TM 5-302 hut wall girts (PH)'),
  screenClothThickIn: doc(0.06, 'insect screen as modeled — cloth over a frame (PH)', { unit: 'in' }),
  girtSpacingFt: doc(4, 'TM 5-302 hut wall girts (PH)', { unit: 'ft' }),
  // A B-hut is a hut divided into bays; this is the count along its length.
  bHutBays: doc(4, 'TM 5-302 B-hut partitioning (PH)'),
} as const;

export const LATRINE = {
  seatSpacingFt: doc(2.5, 'TM 5-302 latrine seat spacing (PH)', { unit: 'ft' }),
  riserBoxHeightFt: doc(1.4, 'TM 5-302 latrine riser box (PH)', { unit: 'ft' }),
  riserBoxDepthFt: doc(2, 'TM 5-302 latrine riser box (PH)', { unit: 'ft' }),
  boxNominal: doc('2x8', 'TM 5-302 latrine riser box framing (PH)'),
  // Pit depth is a HEALTH number, not a fall number — LS-tagged anyway: an unshored pit a
  // person can fall into is exactly the failure mode the gate exists for.
  pitDepthFt: doc(6, 'TM 5-302 latrine pit depth (PH)', { unit: 'ft', lifeSafety: true }),
  aisleWidthFt: doc(3, 'TM 5-302 latrine aisle (PH)', { unit: 'ft' }),
} as const;

// ── Guard tower (TM 5-302 (PH); EM 385-1-1 for everything that can drop you) ──
export const TOWER = {
  legNominal: doc('6x6', 'TM 5-302 tower legs (PH)', { lifeSafety: true }),
  girtNominal: doc('2x6', 'TM 5-302 tower girts (PH)', { lifeSafety: true }),
  braceNominal: doc('2x6', 'TM 5-302 tower X-bracing (PH)', { lifeSafety: true }),
  platformJoistNominal: doc('2x8', 'TM 5-302 tower platform framing (PH)', { lifeSafety: true }),
  // Bay height between girt/brace levels up the legs. The tower is framed in bays, and the
  // brace pattern repeats per bay — this is the number that sets how many.
  bayHeightFt: doc(8, 'TM 5-302 tower bracing bays (PH)', { unit: 'ft', lifeSafety: true }),
  // Legs batter inward going up: the base is wider than the cab by this much per side.
  batterPerSideFt: doc(1.5, 'TM 5-302 tower batter (PH)', { unit: 'ft', lifeSafety: true }),
  mudsillNominal: doc('6x8', 'TM 5-302 timber mudsill (PH)', { lifeSafety: true }),
  mudsillLengthFt: doc(4, 'TM 5-302 timber mudsill (PH)', { unit: 'ft' }),
  padSideIn: doc(24, 'TM 5-302 tower concrete footing (PH)', { unit: 'in', lifeSafety: true }),
  padDepthIn: doc(12, 'TM 5-302 tower concrete footing (PH)', { unit: 'in', lifeSafety: true }),
  // The ladder or stair well through the deck edge, and how far the ladder foot stands out.
  accessWidthFt: doc(2.5, 'EM 385-1-1 minimum clear width of a means of access', { unit: 'ft', lifeSafety: true }),
  ladderStandoffFt: doc(0.6, 'EM 385-1-1 ladder standoff from the structure', { unit: 'ft', lifeSafety: true }),
  /** The four platform heights this family's drawing covers. */
  platformHeightsFt: doc([10, 16, 24, 32] as const, 'TM 5-302 guard tower heights (PH)', { unit: 'ft' }),
  cabWallHeightFt: doc(7, 'TM 5-302 tower cab (PH)', { unit: 'ft' }),
  cabHalfWallFt: doc(3.5, 'TM 5-302 tower cab half-wall (PH)', { unit: 'ft' }),
  cabRisePer12: doc(4, 'TM 5-302 tower cab roof (PH)', { unit: 'in/ft' }),
  cabOverhangFt: doc(1, 'TM 5-302 tower cab roof overhang (PH)', { unit: 'ft' }),
  // EM 385-1-1: a fixed ladder past the cage threshold is not the answer here; the answer is
  // a stair. normalizeSpec FORCES stair above this height and says so.
  ladderMaxHeightFt: doc(20, 'EM 385-1-1 fixed-ladder cage threshold — stair required above', { unit: 'ft', lifeSafety: true }),
} as const;

// ── Tent frames (TM 10-8340 (PH)) ────────────────────────────────────────────
export const TENT = {
  gpSmall: doc({ widthFt: 17.5, lengthFt: 29.5, eaveFt: 5.5, ridgeFt: 10 }, 'TM 10-8340 GP Small (PH)'),
  gpMedium: doc({ widthFt: 16, lengthFt: 32, eaveFt: 5.5, ridgeFt: 11 }, 'TM 10-8340 GP Medium (PH)'),
  temper: doc({ widthFt: 20, bayFt: 8, eaveFt: 6.5, ridgeFt: 10.5 }, 'TM 10-8340 TEMPER (PH)'),
  bentSpacingFt: doc(4, 'TM 10-8340 tent-frame bent spacing (PH)', { unit: 'ft' }),
  bentNominal: doc('2x4', 'TM 10-8340 tent frame (PH)'),
  deckNominal: doc('2x6', 'TM 10-8340 tent floor decking (PH)'),
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
  corrugatedSideLapIn: doc(3.25, 'FM 5-426 corrugated side lap (1.5 corrugations at 2 1/6 in pitch)', { unit: 'in' }),
  coveringThickIn: doc(0.25, 'roofing course thickness as modeled (roll goods lie flat)', { unit: 'in' }),
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
  HUT, LATRINE, TOWER, TENT, OPENING, PLATFORM,
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
