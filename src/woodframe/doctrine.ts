// WOODFRAME-2 — the doctrine data module (plan §6.6). ONE home for every magnitude the new
// generators use, each carrying its citation and its (PH) status.
//
// Two disciplines meet here:
//
//   Cite discipline — every doctrinal magnitude carries a `cite`; anything not yet
//   page-verified carries `ph: true`, which the UI renders as "(PH)". Woodframe ships working
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
// values are mirrored here rather than moved. `test/woodframe2-doctrine.test.ts` asserts the two
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
  defaultGrade: doc('No. 2 common', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 2, lumber grades — "No. 2 common lumber is used for framing")', { ph: false }),
  studNominal: doc('2x4', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, walls and partitions — 2x4 vertical members)', { ph: false }),
  plateNominal: doc('2x4', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, top plate and sole plate — "the same size as the studs")', { ph: false }),
  joistNominal: doc('2x8', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 Table 6-2 — a listed row; the default pick among rows is the tool’s, and the span check governs)', { lifeSafety: true, ph: false }),
  girderPly: doc(3, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, built-up girders — "usually made of three pieces"; Table 6-1 note 1)', { unit: 'plies', lifeSafety: true, ph: false }),
  girderNominal: doc('2x10', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 Table 6-1 — 3-ply 2x10 is the 6x10 row; the default pick among rows is the tool’s)', { lifeSafety: true, ph: false }),
  sillNominal: doc('2x6', 'standard practice — FM 5-426 ch. 6 sizes sills by load and post spacing and names no 2x6'),
  postNominal: doc('4x4', 'standard practice — FM 5-426 ch. 4 leaves post sizes to the load carried'),
  rafterNominal: doc('2x6', 'standard practice (cf. IRC R802.4.1) — FM 5-426 has no rafter size or span table; "they vary in size, depending on length and spacing"', { lifeSafety: true }),
  ridgeNominal: doc('2x8', 'standard practice — ridge one size deeper than the rafters; FM 5-426 leaves the ridge unsized'),
  ceilingJoistNominal: doc('2x6', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, floor joists — 2x6 "frequently used for ceiling joists")', { ph: false }),
  collarTieNominal: doc('2x4', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, collar tie and beam — menu "1 x 4, 1 x 6, 1 x 8, or 2 x 4"; the pick is the tool’s)', { ph: false }),
  headerNominal: doc('2x6', 'standard practice (cf. IRC R602.7) — FM 5-426 has no header table; its whole guidance is "doubled and trussed" for a wide opening', { lifeSafety: true }),
  braceNominal: doc('1x4', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, let-in bracing — "usually 1 x 4s or 1 x 6s")', { ph: false }),
  crossBridgingNominal: doc('1x3', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, floor bridging — "usually diagonally cut 1 x 3 or 2 x 3")', { ph: false }),
  purlinNominal: doc('2x4', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, purlins — "2 x 4s are used for purlins, with the narrow side up")', { ph: false }),
  // The board across the rafter tails that closes an eave. Matched to the rafter's depth so it
  // covers the tails it is nailed to — a 1x6 over a 2x6.
  fasciaNominal: doc('1x6', 'standard practice — a 1x fascia matched to the rafter depth; FM 5-426 has no cornice construction section'),
  // What a BOARD roof deck is made of. `coverings.roofDeck: 'boards'` used to lay 4x8 plywood
  // sheets — the option was a label with the other option's material behind it.
  deckBoardNominal: doc('1x8', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, sheathing — boards 1 in thick by 6, 8, 10, or 12 in wide; ch. 7 decks the roof per the wall rule; the pick is the tool’s)', { ph: false }),
  deckPlankNominal: doc('2x6', 'TM 5-302 plank deck', {
    note: 'The loading platform’s deck and its ramp read this leaf; the tent floor’s planks are TENT.deckNominal (TM 10-8340) — two rules, two homes.',
  }),
  skidNominal: doc('4x6', 'TM 5-302 skid runners, PT, chamfered, drift-pinned'),
} as const;

export const PANEL = {
  widthFt: doc(4, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 2, plywood — "usually 4 x 8 feet")', { unit: 'ft', ph: false }),
  lengthFt: doc(8, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 2, plywood — "usually 4 x 8 feet")', { unit: 'ft', ph: false }),
  subfloorThickIn: doc(0.75, 'standard practice (cf. IRC Table R503.2.1.1(1)) — FM 5-426 states no plywood subfloor thickness', { unit: 'in' }),
  roofDeckThickIn: doc(0.5, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, plywood sheathing menu 1/4–5/8 in; ch. 7 roof decking) — 1/2 in exceeds the stated 16-in-OC minimum', { unit: 'in', ph: false }),
  sidingThickIn: doc(0.5, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, siding — wood siding "1/2 to 3/4 inch thick"; plywood siding itself is unsized)', { unit: 'in', ph: false }),
} as const;

// ── Layout & spacing ─────────────────────────────────────────────────────────
export const LAYOUT = {
  studSpacingIn: doc(16, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, studs — "normally spaced 12, 16, or 24 inches on center"; the pick is the tool’s)', { unit: 'in', ph: false }),
  joistSpacingIn: doc(16, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, floor joists — "spaced 16 or 24 inches apart, center to center"; Table 6-2 columns)', { unit: 'in', ph: false }),
  rafterSpacingIn: doc(16, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, rafters — "spaced from 16 to 48 inches apart"; 16 is the tightest listed)', { unit: 'in', ph: false }),
  postSpacingMaxFt: doc(8, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 4, column or post foundations — "the spacing is 6 to 10 feet apart"; 8 is the tool’s cap inside that band)', { unit: 'ft', ph: false }),
  bridgingRowMaxFt: doc(8, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, floor bridging — one line on joists over 8 ft, two lines over 16 ft; restated as a row interval)', {
    unit: 'ft', ph: false,
    note: 'The sibling floor (floorSystem.ts) spaces its rows to this interval — one row per started interval past the first, evenly spread. The frozen floor.ts keeps its own one-row literal (C-10).',
  }),
  // Both floor generators start bridging once a clear span reaches this.
  bridgingThresholdFt: doc(7.5, 'in-tool trigger derived from the FM 5-426 ch. 6 bridging rule — a floor generator starts a row once a clear span reaches this; the 7.5 itself is no pub’s number', { unit: 'ft' }),
  // A DISTANCE, not a rafter count. "Every 3rd rafter" is the 4-ft interval written for a 16-in
  // layout, and it becomes 6 ft the moment the rafters go to 24 in; keyed on the spacing, one
  // rule serves both layouts. `roof.ts` mirrors this value (C-10: the frozen branch keeps its
  // own literal) and `test/woodframe2-roofs.test.ts` holds the two in lockstep.
  //
  // WHY 4 AND NOT FM's 5: FM 5-426 ch. 7 states "5 feet apart or every third rafter, whichever
  // is less". At the 16-in default that evaluates to exactly 4 ft; at 24 in it allows 5 ft, but
  // ties land ON rafters, so the widest interval a 24-in grid realizes under 5 ft is two bays —
  // 4 ft again. A flat 4 is therefore the FM rule's realized value at both legal spacings, and
  // it is the literal the frozen card prints.
  //
  // PH BECAUSE THE FROZEN CARD SAYS PH. The member card `roof.ts` prints carries "(PH page)"
  // and the lockstep test holds this flag equal to that marker — the register may not report
  // the sourcing as settled while the card the crew reads says it is pending. Both clear
  // together or not at all, and clearing the card is a C-10 stop-the-line edit.
  collarTieMaxSpacingFt: doc(4, 'IRC R802.3.1 (2018 numbering; R802.4.6 in IRC 2021) — ties ≤4 ft o.c.; FM 5-426 ch. 7 states "5 feet apart or every third rafter, whichever is less", which realizes as 4 ft at both legal rafter spacings', { unit: 'ft' }),
  purlinSpacingMaxIn: doc(24, 'standard practice — 24 in for sheet-metal support; FM 5-426 sizes purlins but states no spacing', { unit: 'in' }),
  // Below this width the floor is girderless — joists clear-span (plan §3.2.2). Stated once
  // so custom, guard-shack and latrine cannot disagree about where the rule starts.
  smallPlanWidthFt: doc(8, 'in-tool rule — a plan this narrow clear-spans on the joist table; the span check, not this constant, is the safety guard', { unit: 'ft' }),
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
  /**
   * How far a course of roofing may overhang the hip it is cut against — the width of a hip
   * cap, which is what covers that joint on a real roof. Past this the course is cut into more
   * pieces up the slope, because a rectangle cannot be cut on a diagonal.
   */
  hipCapFt: 4 / IN_PER_FT,
  /** Ceiling on that subdivision, so a degenerate plane cannot emit a thousand offcuts. */
  maxTaperBands: 8,
  /**
   * How far a piece of wall covering may step away from a RAKE — the sloped top edge of a
   * gable end or a shed's rake wall — before it is ripped narrower. Siding is cut to the rake
   * on site; a rectangle cannot be, so a wide sheet against a shallow gable either overshoots
   * the roof or leaves a wedge of daylight. Stepping at 3 in is close enough that the rake
   * reads as a straight line, and the cut pieces are what a crew would actually rip.
   */
  rakeStepFt: 3 / IN_PER_FT,
  /** Ceiling on THAT subdivision — same reasoning as `maxTaperBands`, in the other axis. */
  maxRakeStrips: 64,
} as const;

// ── Notching a bending member ────────────────────────────────────────────────
export const NOTCH = {
  /**
   * The deepest a bird's mouth may cut into the rafter, as a fraction of the rafter's face depth.
   *
   * A seat is cut AT THE BEARING, which is where the shear is, and what is left of the board is
   * what carries the roof. On a 2x6 over a 2x4 plate the seat takes 35% of the depth at 8/12 and
   * 45% at 12/12 — both inside the pitch range the tool offers, both past this limit.
   *
   * A fraction rather than a distance because that is how the rule is stated and how it scales: a
   * plate-wide seat takes `plateWidth · tan θ` of plumb depth whatever the rafter is.
   */
  rafterSeatMaxDepthFrac: doc(
    1 / 3,
    'standard carpentry practice: a bearing notch leaves at least two thirds of the member depth (no published section to check)',
    {
      lifeSafety: true,
      note: 'FM 5-426 ch. 6 states a one-third limit for JOIST notches; its bird’s-mouth text sets no rafter depth limit. IRC R802.7.1/NDS govern rafters.',
    },
  ),
} as const;

// ── Foundations ──────────────────────────────────────────────────────────────
export const FOUNDATION = {
  crawlFt: doc(1.5, 'standard practice (cf. IRC R408.4, 18-in clearance under joists) — FM 5-426’s crawl-space text covers ventilation only', { unit: 'ft' }),
  basementDepthFt: doc(7.5, 'standard practice — a working basement wall height; not stated in FM 5-426', { unit: 'ft' }),
  concreteWallThickIn: doc(8, 'standard practice (cf. IRC R404.1.2) — FM 5-426 ch. 4 describes wall foundations without a thickness', { unit: 'in' }),
  stripFootingWidthIn: doc(16, 'standard practice — footing width about twice the wall (cf. IRC R403.1); the proportion is not stated in FM 5-426', { unit: 'in' }),
  stripFootingDepthIn: doc(8, 'standard practice — footing depth about the wall thickness (cf. IRC R403.1); not stated in FM 5-426', { unit: 'in' }),
  padSideIn: doc(16, 'standard practice — FM 5-426 ch. 4 shows post-footing types without dimensions', {
    unit: 'in',
    note: 'Frozen-path mirror: the legacy floor.ts keeps its own PAD_SIDE literal (C-10) and the doctrine test pins the two together. The sibling generators read PLATFORM/TOWER pad leaves.',
  }),
  padDepthIn: doc(8, 'standard practice — FM 5-426 ch. 4 shows post-footing types without dimensions', {
    unit: 'in',
    note: 'Frozen-path mirror: the legacy floor.ts keeps its own PAD_H literal (C-10) and the doctrine test pins the two together.',
  }),
  slabThickIn: doc(4, 'standard practice (IRC R506.1 minimum is 3.5 in) — not stated in FM 5-426', { unit: 'in' }),
  // Exposed concrete above grade on a basement wall.
  basementRevealFt: doc(1, 'standard practice — a common working reveal; code minimums run 4–8 in, and FM 5-426 states none', {
    unit: 'ft',
    note: 'Frozen-path mirror: the legacy floor.ts sets the basement grade line from its own 1.0 literal (C-10) and the doctrine test pins the two together.',
  }),
  /** How many runners a skid-founded deck is dragged on. Read live by generateSkids' default. */
  skidRunners: doc(3, 'TM 5-302 skid lineage (PH — sheet pending); standard practice: three runners so the deck spans thirds', { unit: 'runners' }),
} as const;

// ── Stairs, ladders, ramps, rails — the life-safety block (EM 385-1-1) ───────
// TM 5-302 remains the geometry lineage; EM 385-1-1 is the named safety authority
// (plan TD27). Every entry here is LS-tagged: these are the fall-and-collapse numbers.
export const STAIR = {
  // 7.5 with unitRun 10 passes both FM proportion checks exactly: r+t = 17.5 ∈ [17, 19] and
  // r×t = 75 ∈ [70, 75].
  targetRiserIn: doc(7.5, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 1 p 1-11, riser range 6 1/2–7 1/2 in; ch. 6, risers and treads; Fig 6-51 riser is 7 1/2 in)', { unit: 'in', lifeSafety: true, ph: false }),
  maxRiserIn: doc(8, 'tool ceiling — standard practice; EM 385-1-1 (2024) sets no riser cap (uniformity and 30°–50° pitch only), and FM 5-426’s design range tops at 7 1/2 in', { unit: 'in', lifeSafety: true }),
  minTreadIn: doc(9, 'tool floor — standard practice; EM 385-1-1 (2024) sets no tread minimum, and FM 5-426’s standard tread run is 10–11 in', {
    unit: 'in', lifeSafety: true,
    note: 'Defense in depth: the stair generators floor the tread at this figure (access.ts, stringerCuts.ts), but io’s own table invariant already refuses a unitRunIn below it, so the floor binds only if that validation is bypassed. The packet LS row is the live print.',
  }),
  unitRunIn: doc(10, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, risers and treads — "about 7 and 10 inches"; Fig 6-51 tread is 10 in)', { unit: 'in', lifeSafety: true, ph: false }),
  headroomIn: doc(80, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6 Fig 6-51, step construction — headroom drawn 6 ft 8 in); EM 385-1-1 (2024) states no headroom figure; IRC R311.7.2 concurs', {
    unit: 'in', lifeSafety: true, ph: false,
    note: 'Frozen-path mirror + packet print: the legacy basement stairwell (floor.ts) sizes its floor opening to clear its own 80-in literal (C-10, drift-pinned by the doctrine test), and the packet LS row states the figure. The sibling stair generator builds exterior flights with no overhead structure, so no live headroom check exists there.',
  }),
  stringerNominal: doc('2x12', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, stairways — stringers "2 to 3 inches thick and 8 or more inches wide")', { lifeSafety: true, ph: false }),
  treadNominal: doc('2x10', 'standard practice — a 2-in plank tread; FM 5-426 Figs 6-50/6-51 size the layout, not the tread stock', { lifeSafety: true }),
  stringerCount: doc(3, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, stairways — "usually three stringers … if stairs are more than 36 inches wide"; applied to every stair, conservative for narrower ones)', { lifeSafety: true, ph: false }),
} as const;

export const LADDER = {
  railNominal: doc('2x4', 'TM 5-302 ladder detail; job-made wooden ladders per ANSI/ASC A14.4 via EM 385-1-1 (2024) para. 24-8.c(7)', { lifeSafety: true }),
  rungNominal: doc('2x2', 'TM 5-302 ladder detail (1x4 cleats recorded as rejected — TD24); ANSI/ASC A14.4 job-made lineage', { lifeSafety: true }),
  rungSpacingIn: doc(12, 'ANSI/ASC A14.4 uniform rung spacing (via EM 385-1-1 (2024) para. 24-8.c(7)) — the EM itself states no rung dimension', { unit: 'in', lifeSafety: true }),
  topExtensionIn: doc(36, 'EM 385-1-1 (2024) para. 24-8.d(2) — "at least 3 feet above the upper landing surface"; stated for portable access ladders, applied to job-made ones as the conservative reading', { unit: 'in', lifeSafety: true, ph: false }),
  // Above this climb the answer is a stair, not a longer ladder: EM 385-1-1 (2024) para
  // 24-8.h(1) requires stairways on structures 20 ft or more during construction. (The 2024 EM
  // has no ladder-cage rule at any height; fixed-ladder fall protection begins over 24 ft,
  // para 21-8.a(3)(b).)
  cageThresholdFt: doc(20, 'EM 385-1-1 (2024) para. 24-8.h(1) — stairways required on structures 20 ft or more; the EM (2024) has no ladder-cage rule (fixed-ladder fall protection begins over 24 ft, para. 21-8.a(3)(b))', { unit: 'ft', lifeSafety: true, ph: false }),
} as const;

export const RAIL = {
  topHeightIn: doc(42, 'EM 385-1-1 (2024) para. 21-8.d(1) — toprail "42 +/- 3 inches" above the walking surface', { unit: 'in', lifeSafety: true, ph: false }),
  midHeightIn: doc(21, 'EM 385-1-1 (2024) para. 21-8.d(2) — midrails "halfway between the toprails and the floor"; 21 in under a 42-in toprail', { unit: 'in', lifeSafety: true, ph: false }),
  toeBoardHeightIn: doc(4, 'EM 385-1-1 (2024) para. 21-8.d(4)(a) — "at minimum, 3.5 inches", from 1x4 lumber or equivalent; the 4-in figure meets it', { unit: 'in', lifeSafety: true, ph: false }),
  postSpacingMaxFt: doc(8, 'EM 385-1-1 (2024) para. 21-8.d(5) — "Space posts no more than 8 feet (2.4 m) apart"', { unit: 'ft', lifeSafety: true, ph: false }),
  postNominal: doc('4x4', 'EM 385-1-1 (2024) para. 21-8.d(10) — wood posts minimum 2x4; the 4x4 follows the TM 5-302 lineage (PH)', { lifeSafety: true }),
  memberNominal: doc('2x4', 'EM 385-1-1 (2024) para. 21-8.d(10) — toprail minimum 2x4; the EM’s listed midrail stock is 1x6', {
    lifeSafety: true,
    note: 'One stock for toprail and midrail. The EM’s midrail minimum stock is 1x6 (21-8.d(10)); a 2x4 midrail on posts ≤8 ft apart is held instead to the 150-lb midrail load of 21-8.d(9) — flagged for review, not passed silently.',
  }),
  // Open edges at or above this height must be railed.
  requiredAboveFt: doc(4, 'EM 385-1-1 (2024) para. 21-8.a(2) — 4-ft threshold at open-sided floors and platforms on USACE-owned or operated permanent facilities; the conservative of the EM’s two (21-8.a(1) sets 6 ft construction-wide)', { unit: 'ft', lifeSafety: true, ph: false }),
} as const;

export const PLATFORM = {
  pierSpacingFt: doc(8, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 4, column or post foundations — "the spacing is 6 to 10 feet apart"; 8 is the tool’s cap inside that band)', { unit: 'ft', ph: false }),
  padSideIn: doc(16, 'standard practice — FM 5-426 ch. 4 shows post-footing types without dimensions', { unit: 'in' }),
  padDepthIn: doc(8, 'standard practice — FM 5-426 ch. 4 shows post-footing types without dimensions', { unit: 'in' }),
  /** Bent posts stand this far in from the deck edge, so the plate is not the last board. */
  bentInsetFt: doc(0.25, 'TM 10-8340 tent frame (PH)', { unit: 'ft' }),
  /** Shorter than this and a 'post' is a shim, not a member. Mirrors the frozen floor.ts guard. */
  minPostFt: doc(0.1, 'engine floor: below this a post is a shim, not a member', { unit: 'ft', ph: false }),
} as const;

export const RAMP = {
  // Typed `readonly number[]`, not the literal tuple the initializer spells: leaves are runtime-
  // mutable through the validated offline import (io.ts), so a leaf's TYPE is the shape a value
  // must keep — never a promise about which numbers are currently in it.
  slopes: doc<readonly number[]>([4, 6, 8], 'TM 5-302 ramp-slope lineage (1:N, PH); EM 385-1-1 (2024) para. 24-8.i states no required ratio — only "as flat as conditions will permit"', {
    lifeSafety: true,
    note: 'EM 24-8.i(1) does state one ratio-shaped figure: cleats are required where the slope exceeds 1 ft in 5 ft, which the 1-in-4 option here exceeds. Cleats are not modeled — flagged, not passed silently.',
  }),
  stringerNominal: doc('2x12', 'TM 5-302 ramp stringers', { lifeSafety: true }),
} as const;

// ── Standard rough openings ──────────────────────────────────────────────────
// The sizes a door and a window are framed to when nobody has said otherwise. They live here
// rather than in the generators because they are used in three places that must agree: the hut
// family's default openings, the planning app's "+ Door / + Window / + Vent" buttons, and the
// catalog presets. Three copies of "a door is 3 by 6 foot 8" is three chances to disagree.
export const OPENING = {
  doorWidthFt: doc(3, 'standard practice preset — FM 5-426 ch. 8 gives a formula, not a preset: RO = leaf + 2 1/2 in each way', { unit: 'ft' }),
  // 6 ft 8 in is 6.667 ft, not 6.7 — the value disagreed with its own citation by four tenths
  // of an inch, and that was the difference between the guard shack's door fitting under its
  // 7.5-ft wall and its header running through the top plate.
  doorHeightFt: doc(6 + 8 / 12, 'standard practice preset — 6 ft 8 in is FM 5-426 ch. 8’s example door-LEAF height; the tool uses it as the rough opening (the FM formula would add 2 1/2 in)', { unit: 'ft' }),
  windowWidthFt: doc(3, 'standard practice preset — FM 5-426 has no window preset sizes', { unit: 'ft' }),
  windowHeightFt: doc(3.5, 'standard practice preset — FM 5-426 has no window preset sizes', { unit: 'ft' }),
  windowSillFt: doc(3.5, 'standard practice preset — FM 5-426 has no window sill heights', { unit: 'ft' }),
  ventWidthFt: doc(1.5, 'standard practice preset — FM 5-426 sizes vents by AREA (1 sq ft per 150 sq ft of floor), not by preset', { unit: 'ft' }),
  ventHeightFt: doc(1, 'standard practice preset — FM 5-426 sizes vents by AREA (1 sq ft per 150 sq ft of floor), not by preset', { unit: 'ft' }),
  ventSillFt: doc(6.5, 'standard practice preset — FM 5-426’s concept only: upper louvers "as near to the top of the gable as possible"', { unit: 'ft' }),
  /** Clear wall a window is set back from a corner, so the king stud is not the corner post. */
  cornerSetbackFt: doc(2, 'in-tool layout rule — geometry of the default elevation; no publication states one', { unit: 'ft' }),
  /** Spacing between the windows a long wall gets by default. */
  windowPitchFt: doc(12, 'in-tool layout rule — geometry of the default elevation; no publication states one', { unit: 'ft' }),
  // ── What fills the opening (plan §2.6 TO-built sub-assemblies) ─────────────
  doorBoardNominal: doc('1x6', 'standard light ledged-and-braced practice — FM 5-426 ch. 8’s hasty batten door uses 2x6 boards; the lighter 1x6 is the tool’s pick'),
  doorLedgeNominal: doc('1x6', 'standard practice — FM 5-426 leaves ledgers unsized'),
  doorLedges: doc(3, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 8, job-built doors — "two to four cross pieces, called ledgers"; three is the tool’s pick)', { ph: false }),
  doorBraces: doc(2, 'standard practice — two braces on a three-ledge door; FM 5-426 ch. 8’s hasty door shows one diagonal'),
  /** Gap all round a leaf inside its rough opening, so it swings. */
  leafClearanceIn: doc(0.25, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 8, job-built doors — "1/4 inch of clearance should be left around the door")', { unit: 'in', ph: false }),
  /** How far a shutter laps past the opening, so a closed one shows no light gap. */
  shutterLapIn: doc(1, 'standard practice — FM 5-426 has no batten-shutter section', { unit: 'in' }),
  shutterBattens: doc(2, 'standard practice — FM 5-426 has no batten-shutter section'),
  /** The stock a propped shutter's prop stick is cut from. */
  shutterPropNominal: doc('2x2', 'standard practice — a light prop stick, hooked over a nail at each end; no publication sizes it'),
  /**
   * How far a threshold has to stand above grade before the door needs steps. Below it the step
   * up is one long stride, which is what a doorsill on a skid building is; above it the door is
   * unusable without something to stand on.
   */
  entryStepMinRiseFt: doc(1.5, 'in-tool threshold — the rise past which a door is unusable without steps; no publication states one', { unit: 'ft', lifeSafety: true }),
  /**
   * The storage shed's wide door bay, as ONE rule: an 8-ft rough opening under the 2x10 its
   * span demands, at the height that fits under that header in an 8-ft wall (see the catalog
   * note on the shed card — 6'-9" is what 91½ in of wall carries under a 9¼-in header). One
   * structured leaf because the three numbers only make sense together: change the width and
   * the header and height move with it, which is exactly what an importer should be forced to
   * state in one entry.
   */
  wideDoor: doc(
    { widthFt: 8, heightFt: 6.75, headerNominal: '2x10' },
    'preset operating point — the storage shed’s wide door bay; height is what fits under its own 2x10 header in an 8-ft wall',
    { unit: 'ft' },
  ),
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
  girtNominal: doc('2x4', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, girts — "always the same width as the studs"; 2x4 in a 2x4 wall)', { ph: false }),
  screenClothThickIn: doc(0.06, 'insect screen as modeled — cloth over a frame (PH)', { unit: 'in' }),
  girtSpacingFt: doc(4, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, girts — "girts spaced about 4 feet apart")', { unit: 'ft', ph: false }),
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
  /** Clear floor a user needs in front of the bench. The hut generator checks the plan against it. */
  aisleWidthFt: doc(3, 'TM 5-302 latrine aisle (PH)', { unit: 'ft' }),
  // THE SEAT ITSELF. The riser box generator's own docstring promised "a seat opening per seat"
  // and cut none — `seats` sized the divider count and nothing else, so a four-seat latrine came
  // out as an unbroken bench. These are the hole, and they are what makes it a latrine.
  seatOpeningWidthIn: doc(11, 'TM 5-302 latrine seat opening (PH)', { unit: 'in' }),
  seatOpeningLengthIn: doc(14, 'TM 5-302 latrine seat opening (PH)', { unit: 'in' }),
  /** Clear board left in front of the opening, measured from the riser box's front face. */
  seatFrontMarginIn: doc(4, 'TM 5-302 latrine seat set back from the front board (PH)', { unit: 'in' }),
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
  accessWidthFt: doc(2.5, 'EM 385-1-1 (2024) para. 24-8.a(8) — means of access at least 18 in wide; the 30-in design width is the tool’s choice above it', { unit: 'ft', lifeSafety: true, ph: false }),
  // Named CLEARANCE, not the other word: that word has a survivability meaning this tool must
  // not be able to imply, and the boundary gate rejects it on sight. The concept here is simply
  // how far a ladder's foot stands out from what it is climbing.
  ladderClearanceFt: doc(0.6, 'EM 385-1-1 (2024) para. 24-8.e(5) — "at least 7 inches" toe space from the inside of the rungs; 0.6 ft is 7.2 in', { unit: 'ft', lifeSafety: true, ph: false }),
  /** The four platform heights this family's drawing covers. Shape-typed — see RAMP.slopes. */
  platformHeightsFt: doc<readonly number[]>([10, 16, 24, 32], 'TM 5-302 guard tower heights (PH)', { unit: 'ft' }),
  /** The cab plans the drawing covers — the picker's options, live like the heights above. */
  cabPlanSizesFt: doc<readonly number[]>([6, 8], 'TM 5-302 tower cab plan sizes (PH)', { unit: 'ft' }),
  cabWallHeightFt: doc(7, 'TM 5-302 tower cab (PH)', { unit: 'ft' }),
  cabHalfWallFt: doc(3.5, 'TM 5-302 tower cab half-wall (PH)', { unit: 'ft' }),
  cabRisePer12: doc(4, 'TM 5-302 tower cab roof (PH)', { unit: 'in/ft' }),
  cabOverhangFt: doc(1, 'TM 5-302 tower cab roof overhang (PH)', { unit: 'ft' }),
  /** The cab's corner posts. Read live by families/tower.ts — the railing and cab passes both. */
  cabPostNominal: doc('4x4', 'TM 5-302 tower cab posts (PH — sheet pending)'),
  // EM 385-1-1 (2024) para. 24-8.h(1): structures 20 ft or more get a STAIR, not a longer
  // ladder. normalizeSpec FORCES stair above this height and says so.
  ladderMaxHeightFt: doc(20, 'EM 385-1-1 (2024) para. 24-8.h(1) — "On all structures 20 feet (6.1 m) or more in height, provide stairways"; normalizeSpec forces the stair above this height', { unit: 'ft', lifeSafety: true, ph: false }),
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

// ── Roof geometry defaults ───────────────────────────────────────────────────
// The pitch and eave every standard drawing here ships at. These are the numbers the catalog
// presets, the spec-repair fallback and the panel's roof-kind switch all used to retype — one
// each — so a corrected default reaches every card and every repaired share link from here.
// PRESET OPERATING POINTS, not limits: the legal range stays in LIMITS below.
export const ROOF = {
  risePer12: doc(4, 'preset operating point — the standard drawings ship a 4-in-12 (1/6 pitch) roof; any pitch lays out per the FM 5-426 framing-square method (PH)', { unit: 'in/ft' }),
  overhangFt: doc(1, 'preset operating point — the standard drawings ship a 1-ft eave; standard practice, since FM 5-426 has no cornice construction section', { unit: 'ft' }),
} as const;

// ── Roofing & coverings ──────────────────────────────────────────────────────
export const ROOFING = {
  rollWidthIn: doc(36, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, roof coverings — "rolls (usually 3 feet wide)")', { unit: 'in', ph: false }),
  // Roll is applied HORIZONTALLY (FM's word), so the roll's long SIDES are the course-to-course
  // joints up the slope — the side lap is the lap the course loop spends. The END laps are where
  // 18- to 20-ft cut lengths butt within a course, and those joints are not modeled: a course
  // lays as one piece per band, and the purchase note says laps are not added to the area.
  rollSideLapIn: doc(4, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, smooth-surfaced roll roofing — "apply single-ply roll roofing horizontally with at least 4-inch side laps"; the course-to-course lap coverings.ts lays)', { unit: 'in', ph: false }),
  rollEndLapIn: doc(6, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, smooth-surfaced roll roofing — "6-inch end laps")', {
    unit: 'in', ph: false,
    note: 'End joints within a course are unmodeled — the model lays each course as one piece along the eave, and the purchase basis orders to coverage area. Retained as the FM end-lap figure and the stated lineage of corrugatedEndLapIn; nothing computes from it today.',
  }),
  // The 2-in/ft figure is page-verified as FM's BUILT-UP breakpoint; reading it as the roll
  // minimum is an inference, so the flag stays pending — an inference is not a page value.
  rollMinSlopePer12: doc(2, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, built-up roofs — built-up is prescribed under 2 in/ft; that breakpoint read as the roll minimum is an inference, and the direct exposed-nail ≥2:12 rule is industry practice)', { unit: 'in/ft', lifeSafety: false }),
  rollDoubleMinSlopePer12: doc(1, 'standard practice (cf. IRC R905.5) — double-coverage roll down to 1:12; not stated in FM 5-426', { unit: 'in/ft' }),
  corrugatedWidthIn: doc(26, 'standard practice — a 26-in sheet (24-in coverage); FM 5-426 has no corrugated-roofing dimensions', { unit: 'in' }),
  corrugatedLengthFt: doc(8, 'standard practice — a stock sheet length; FM 5-426 has no corrugated-roofing dimensions', { unit: 'ft' }),
  corrugatedSideLapCorrugations: doc(1.5, 'standard practice — the classic 1 1/2-corrugation side lap; not stated in FM 5-426'),
  corrugatedSideLapIn: doc(3.25, 'derived: 1.5 corrugations at the 2 1/6-in pitch — standard-practice inputs; no publication states 3.25', { unit: 'in' }),
  // A sheet runs its 8-ft LENGTH up the slope; the side lap above is between neighbouring sheets
  // ACROSS it. Where a slope is longer than one sheet the next one laps its lower end, and that
  // is a different figure — carried at the roll-roofing end lap value as declared practice.
  corrugatedEndLapIn: doc(6, 'standard practice — 6–8 in end laps, 6 at 3:12 or steeper; carried from the roll end lap', { unit: 'in' }),
  coveringThickIn: doc(0.25, 'roofing course thickness as modeled (roll goods lie flat)', { unit: 'in' }),
  // A cap straddles the joint, so half its width lands on each slope. Roll goods are cut from
  // the same stock; corrugated comes as a formed ridge/hip piece in about the same girth.
  capWidthIn: doc(12, 'standard practice — a 12-in cap bent 6 in to each slope; FM 5-426’s nearest analog is a 9-in mineral-surfaced strip over hips and ridges', { unit: 'in' }),
  feltWidthIn: doc(36, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, laying asphalt roofing — "felt usually comes in 3-foot-wide rolls")', { unit: 'in', ph: false }),
  feltLapIn: doc(2, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, laying asphalt roofing — "a 2-inch top lap and a 4-inch side lap"; 2 is the course lap, and the 4-in end/side lap is unmodeled)', { unit: 'in', ph: false }),
  feltThickIn: doc(0.05, 'felt underlayment thickness as modeled (15-lb felt lies flat)', { unit: 'in' }),
  squareSf: doc(100, 'roofing square = 100 sf (FM 5-426 ch. 7 concurs: "Weight per square (100 square feet)")', { unit: 'sf', ph: false }),
} as const;

export const SIDING = {
  boardNominal: doc('1x10', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, siding — wood siding runs to 12 in wide; the 1x10 pick is the tool’s)', { ph: false }),
  battenNominal: doc('1x2', 'standard practice — FM 5-426 leaves battens unsized ("the cracks are covered with wood strips called battens")'),
  boardLapIn: doc(0, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, vertical wood siding — boards butt, battens cover the cracks)', {
    unit: 'in', ph: false,
    note: 'Read by the board-siding course step in coverings.ts: each board starts its dressed width less this lap after the last. The FM rule for vertical siding is a butt joint, which is the shipped 0.',
  }),
} as const;

// ── Crib bunker (T7) ─────────────────────────────────────────────────────────
//
// READ §2.7 OF THE PLAN BEFORE TOUCHING THIS TABLE. The boundary it draws is normative and it
// is the reason this block reads the way it does:
//
//   NOT HERE, EVER: how much earth defeats what. Any number or sentence a reader could take as
//   "you are protected" belongs to the survivability tool (SAP-2) and its commissioning
//   ceremony, and a carpentry tool that produces one has end-run that ceremony.
//
//   HERE: the wood. Posts, caps, stringers, lagging and the entrance, sized to carry a
//   USER-STATED depth of soil as DEAD LOAD — the same kind of input as a snow-load assumption.
//   The depth is an input this module consumes. It is never an output this module computes.
//
// Every entry is LS-tagged and SME-pending. `stringerSpanFt` is capped at its last reviewed
// row on purpose: past that the honest answer is that nobody has checked it, and the family
// reports rather than extrapolating.
export const BUNKER = {
  cribLogNominal: doc('6x8', 'ATP 3-37.34 timber dead-load member table (configuration + dead load only, PH, SME)', { lifeSafety: true }),
  postNominal: doc('6x6', 'ATP 3-37.34 timber dead-load member table (PH, SME)', { lifeSafety: true }),
  capNominal: doc('6x8', 'ATP 3-37.34 timber dead-load member table (PH, SME)', { lifeSafety: true }),
  laggingNominal: doc('2x8', 'ATP 3-37.34 timber dead-load member table (PH, SME)', { lifeSafety: true }),
  postSpacingFt: doc(4, 'ATP 3-37.34 timber dead-load member table (PH, SME)', { unit: 'ft', lifeSafety: true }),
  /**
   * Overhead stringer size by CLEAR SPAN, carrying the stated depth of soil as dead load.
   * Rows are span (ft) → nominal. The deepest reviewed row is the cap; see `maxReviewedSpanFt`.
   */
  stringerBySpan: doc(
    { 6: '6x8', 8: '6x8', 10: '8x8', 12: '8x8' } as Record<number, string>,
    'ATP 3-37.34 timber dead-load stringer table (PH, SME — rows not page-checked)',
    { unit: 'ft', lifeSafety: true },
  ),
  maxReviewedSpanFt: doc(12, 'last stringer row anyone has reviewed — past this the family reports', {
    unit: 'ft', lifeSafety: true,
    note: 'stringerFor (bunker.ts) reads this as the reviewed cap on the table itself. Inside the shipped envelope the width clamp ends at the table’s last row, so the gate binds only when the register moves — which is exactly when it must.',
  }),
  stringerSpacingFt: doc(2, 'ATP 3-37.34 timber dead-load stringer table (PH, SME)', { unit: 'ft', lifeSafety: true }),
  /** Soil unit weight. Stated in the open on the packet's LS table, beside the stated depth. */
  soilPcf: doc(100, 'assumed soil unit weight for the dead-load statement (PH, SME)', {
    unit: 'lb/cf', lifeSafety: true,
    note: 'Consumed by the packet LS row (the density the signer reviews); the depth is the operator’s own input on the card and the soil ghost. The depth × density product is deliberately not printed — §2.7 keeps protection-shaped statements out of this tool.',
  }),
  baffleOffsetFt: doc(4, 'ATP 3-37.34 entrance configuration (configuration reference only, PH)', { unit: 'ft' }),
} as const;

/**
 * The §2.7 boundary sentence, verbatim and in ONE place.
 *
 * It renders on the bunker card, on the soil ghost's label, and on the bunker BOM header, and
 * the boundary gate allowlists this exact string — so the wordlist can be strengthened without
 * anyone having to re-approve the copy. Do not paraphrase it at a call site.
 */
export const COVER_DEPTH_NOTE =
  'COVER DEPTH: user-stated — protective sizing is a survivability (SAP) decision, not computed here.';

// ── Span tables ──────────────────────────────────────────────────────────────
// Maximum clear span, in feet, for a member of this nominal at this spacing. LS-tagged
// without exception: a joist past its span is a floor that deflects under the load it was
// built for, and the failure mode is the floor.
//
// The joist table is FM 5-426 Table 6-2 (page-verified); the rafter, ceiling-joist and header
// tables are conservative defaults — FM has no tables for those three, so they are cited to
// the practice they come from, not to a page nobody can turn to.
//
// WHAT THIS IS NOT: an engineering model. It is a lookup, and the tool's rule (mandate #2) is
// that it WARNS and never silently resizes. A tool that quietly upsizes a joist to make its own
// check pass has taught the operator nothing and handed a crew a different building than the
// one on the drawing. `src/woodframe/spans.ts` reads the table; nothing else does.
export const SPAN = {
  // Table 6-2's Group I (Douglas Fir/Larch, Construction grade — groups per Table 6-3),
  // without-plastered-ceiling column: the TO case. The 12-in column is the table's own; the
  // spacing knobs offer 16/24, and `spans.ts` reads the nearest column at or above a spacing,
  // so the extra column changes no current check.
  joist: doc(
    {
      '2x6': { 12: 11.5, 16: 10, 24: 8 },
      '2x8': { 12: 15, 16: 13.5, 24: 11 },
      '2x10': { 12: 19, 16: 16.5, 24: 14 },
      '2x12': { 12: 23, 16: 20, 24: 16.5 },
    } as Record<string, Record<number, number>>,
    'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 Table 6-2, Group I without plastered ceiling — nonstress-graded; species groups per Table 6-3)',
    { unit: 'ft', lifeSafety: true, ph: false },
  ),
  rafter: doc(
    {
      '2x4': { 16: 7.5, 24: 6.5 },
      '2x6': { 16: 12, 24: 10.5 },
      '2x8': { 16: 16, 24: 14 },
      '2x10': { 16: 20, 24: 17.5 },
    } as Record<string, Record<number, number>>,
    'standard practice conservative defaults (cf. IRC R802.4.1 lineage) — FM 5-426 has no rafter span table; its Table 6-3 is the species-group table',
    { unit: 'ft', lifeSafety: true },
  ),
  // Ceiling joists carry a ceiling, not a floor, so they get their own (longer) rows. Without
  // this they were left UNCHECKED rather than checked against the floor table, which condemned
  // the standard GP building by four tenths of a foot — see the T8 entry in DECISIONS.
  ceilingJoist: doc(
    {
      '2x4': { 16: 8.5, 24: 7.5 },
      '2x6': { 16: 13.5, 24: 11.75 },
      '2x8': { 16: 17.75, 24: 15.5 },
      '2x10': { 16: 22, 24: 19 },
    } as Record<string, Record<number, number>>,
    'standard practice conservative defaults (cf. IRC R802.5.1 lineage) — FM 5-426 has no ceiling-joist span table, only the 2x6 aside',
    { unit: 'ft', lifeSafety: true },
  ),
  header: doc(
    { '2x4': 3, '2x6': 5, '2x8': 7, '2x10': 8.5, '2x12': 10 } as Record<string, number>,
    'standard practice conservative defaults (cf. IRC R602.7 header tables) — FM 5-426 has no header table; "doubled and trussed" is its whole guidance',
    { unit: 'ft', lifeSafety: true },
  ),
} as const;

// ── Labor (single-factor planning rates; TM 5-303 / NAVFAC P-405 pending, plan §2.1) ───
// Values equal the legacy bom.ts constants exactly; the doctrine test pins that.
export const LABOR = {
  // Above every element rate in FM's Table C-1 (joists/sills 25, beams 30, wall frames/plates
  // 45, rafters 45 MH per 1,000 board feet) — one factor for every stick, declared conservative
  // rather than pretending to be a table row.
  mhPerBoardFoot: doc(0.055, 'conservative composite planning factor — cf. TM 3-34.47/MCRP 3-40D.3 (FM 5-426 appendix C, Table C-1 — rough framing: 25–45 MH per 1,000 board feet by element); TM 5-303 remains unretrieved', { unit: 'MH/BF' }),
  mhPerPanel: doc(0.5, 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 appendix C, Table C-2 — sheathing and siding — wall plywood 16 MH per 1,000 sq ft = 0.512 MH per 4x8 panel, rounded DOWN to 0.5, 2.3% under the table’s derivation; roof decking runs 20)', { unit: 'MH/panel', ph: false }),
  mhPerConcreteLf: doc(0.15, 'TM 5-303 concrete form/pour factors', { unit: 'MH/LF' }),
  /**
   * Members one worker can place before people start waiting on each other — what sets the
   * packet's crew ceiling. A working figure, not doctrine, and the labor table says so on its
   * face; here so a unit that knows its own tempo can correct it offline.
   */
  membersPerWorker: doc(12, 'working figure — members one worker can place before people start waiting on each other; not a doctrinal crew size', { unit: 'members/worker' }),
  /**
   * Building hours in a shift. Six, not eight: security, details, travel and tool contention
   * are the other two, and the packet's shift arithmetic reads this figure live.
   */
  productiveHoursPerDay: doc(6, 'working figure — a shift is not eight hours of building; security, details, travel and tool contention take the rest', { unit: 'h/shift' }),
} as const;

// ── Fastening schedules ──────────────────────────────────────────────────────
// Every distinct `nailing` string the toolkit puts on a member card, given one cited home.
//
// THE GUARANTEE IS ONLY AS WIDE AS THE CORPUS THAT PROVES IT. What ships is
// `generateStructure` over the catalog, driven by a panel of controls, so `test/woodframe2-doctrine.
// test.ts` walks the shipped cards AND every build reachable by moving one panel control on one
// of them — a foundation set to slab, a front left open, a tower cab roofed as a shed, a bunker
// walled as a crib. Those are one click away, and a schedule reachable in one click with no
// cited home is exactly the value this table exists to stop. The frozen fixtures stay in the
// walk: the compat branch is shipped code too.
//
// ONE JOINT, ONE ENTRY. Two members that make different joints do not share a line here even
// when they would type the same words, because the entry's citation names the member — sharing
// it hands a load-carrying stick the citation written for an infill one. The mechanical version
// of the same fault (the same joint written "ea bearing" here and "each bearing" there) is
// collapsed at the SOURCE: the sibling generators read the value from this table rather than
// retyping it, so the drift cannot come back by retyping.
//
// The mirror discipline still holds for the three FROZEN modules: they keep their literals
// (editing them is C-10 stop-the-line) and this table mirrors them. The sibling generators are
// not frozen, so they reference the entry instead, which is strictly stronger.
//
// `test/woodframe2-doctrine.test.ts` asserts both directions over the union of both paths —
// nothing emitted is unmirrored, and nothing mirrored is dead.
//
// `ph` tracks the "(PH)" the crew reads on the member card, and the test pins them together so
// the register can never report a value as verified that still prints as pending. The four
// IRC-cited schedules are the ones corrected on 2026-08-07 (see the compat-lock entry below).
//
// CITATION QUALITY IS PART OF THE ENTRY. Where a joint's real source is standard carpentry
// practice, the cite says standard practice — it does not borrow a manual's name to look
// better sourced than it is.
//
// NOT life-safety tagged, deliberately. A fastening schedule's failure mode is an overload, so
// the LS-GATE arguably reaches it — but `lifeSafetyRegister()` obligates a consumer for every
// id it carries (`test/woodframe2-packet.test.ts` enforces that), and deciding how a nailing spec
// surfaces in the command packet is a design call, not a mirroring one. Tagging them without
// building that consumer would only break the gate. Recorded as open in DECISIONS.md.
export const NAILING = {
  // Foundation & floor — floor.ts (FROZEN) and subsystems/floorSystem.ts (the sibling branch,
  // which reads the entries below rather than retyping them).
  footing: doc('poured on undisturbed soil (PH)', 'standard practice — a descriptive line; "undisturbed soil" is not an FM 5-426 sentence (its ch. 5 covers footing forms)'),
  slabOverVaporBarrier: doc('poured against walls over vapor barrier (PH)', 'standard practice — the vapor-barrier detail is not in FM 5-426’s slab text'),
  // Concrete on the member card. A pour has no fastening schedule, and the line still has to say
  // something — a blank reads as "not decided yet" where the honest answer is "nothing is nailed
  // here". The slab-on-grade line carries the one fastening that IS made against it: the sole
  // plate of the wall standing on it.
  concreteNoFasteners: doc('no fasteners — concrete (PH)', 'FM 5-426 ch. 5 footings: poured, not fastened'),
  slabOnGradeAnchor: doc(
    'no fasteners — concrete; sole plates anchored to the slab (PH)',
    'standard practice — nothing is nailed to a pour; the sole plate is anchored to the slab it stands on',
  ),
  foundationWallAnchor: doc(
    '1/2" anchor bolts @ 6 ft max o.c. into sill, min 2 per plate, within 12" of each end (IRC R403.1.6)',
    'IRC R403.1.6',
    { ph: false, note: 'ph:false rests on the 2026-08-07 correction record (DECISIONS.md), which checked this schedule against the IRC section named; no IRC text is on file in this repository to re-open.' },
  ),
  sillAnchor: doc(
    '1/2" anchor bolts @ 6 ft max o.c., min 2 per plate, within 12" of each end (IRC R403.1.6)',
    'IRC R403.1.6',
    { ph: false, note: 'ph:false rests on the 2026-08-07 correction record (DECISIONS.md), which checked this schedule against the IRC section named; no IRC text is on file in this repository to re-open.' },
  ),
  sillAtPostCap: doc('anchor/drift per post cap (PH)', 'standard practice — anchor or drift pin at each post cap; FM 5-426 ch. 5 states no such schedule'),
  postGeneric: doc('16d common (PH)', 'standard practice — engine default for an unscheduled post joint (FM 5-426 Table 2-2 lists 16d for framing, topically)'),
  girderBuiltUp: doc('16d @ 16" staggered, both faces (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, built-up girders — 16d both sides, square at the ends then diagonal every 16 in)'),
  joistToBearing: doc('3-16d toenail ea bearing (PH)', 'standard practice, conservative — FM 5-426 gives no joist toenail count; the IRC toenail is 3-8d/3-10d'),
  trimmerJoistToMate: doc('16d @ 12" staggered to mate (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, floor openings — trimmers "nailed … with 16d nails spaced 12 inches apart")'),
  headerJoist: doc('3-16d ea tail joist + 16d @ 12" to mate (PH)', 'standard practice — the frozen branch’s schedule, mirrored; FM 5-426 ch. 6 floor openings differs: three 20d to each tail joist and 16d @ 6 in between plies'),
  rimJoist: doc('3-16d ea joist end (PH)', 'IRC Table R602.3(1) — the band/rim end-nail rule; not in FM 5-426'),
  crossBridging: doc('2-8d ea end; bottom ends nailed after subfloor (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, floor bridging — 8d/10d at the tops, bottoms left free until the subfloor is laid; the count of two is practice)'),
  solidBlocking: doc('3-16d ea end, staggered line (PH)', 'standard practice — FM 5-426 names solid bridging, no schedule'),
  panelEdgeField: doc('8d @ 6" edges / 12" field (PH)', 'IRC Table R602.3(1) — 8d @ 6/12 covers panels through 3/4 in; FM 5-426’s own panel schedule is 6d @ 6/12 for panels to 1/2 in'),
  stairStringer: doc('top plumb cut to trimmer + kicker at slab (PH)', 'standard practice — descriptive; FM 5-426 Fig 6-52 labels the kick plate'),
  stairTread: doc('3-16d per stringer (PH)', 'standard practice — FM 5-426 has no stair-nailing schedule'),

  // Walls — walls.ts
  plateGeneric: doc('2-16d ea end (PH)', 'standard practice, FM-adjacent — FM 5-426 ch. 6: studs take "two 16d or 20d nails through the plates"'),
  solePlateToJoists: doc('16d @ 16" to joists (PH)', 'IRC Table R602.3(1) — the sole-plate rule this schedule states; FM 5-426 ch. 6 differs: "two 16d or 20d nails at each joist it crosses"'),
  capPlateLap: doc(
    '16d @ 16" + 8-16d in the lap, joints offset 24" min (IRC Table R602.3(1))',
    'IRC Table R602.3(1)',
    { ph: false, note: 'ph:false rests on the 2026-08-07 correction record (DECISIONS.md), which checked this schedule against the IRC table named; no IRC text is on file in this repository to re-open.' },
  ),
  studToPlate: doc('2-16d ea end or 4-8d toenail (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, studs — end-nailed "with two 16d or 20d nails through the plates"); the 4-8d toenail alternative is IRC Table R602.3(1)'),
  studToEndStud: doc('16d @ 12" to end stud (PH)', 'IRC Table R602.3(1) — the abutting-studs rule; not in FM 5-426'),
  jackToKingStud: doc('16d @ 12" to king stud (PH)', 'IRC Table R602.3(1) / standard practice — FM 5-426 places the trimmer, no schedule'),
  letInBracing: doc('2-8d at each stud crossing (PH)', 'IRC Table R602.3(1) — the 1x4-brace rule; FM 5-426 describes let-in bracing without a schedule'),

  // Roof — roof.ts
  ceilingJoistAtPlate: doc('3-16d toenail ea plate + 16d to rafter (PH)', 'standard practice, conservative vs IRC — FM 5-426: "nailed to both the plates and the rafters, if possible", no counts'),
  rafterAtRidge: doc('3-16d at ridge, bird’s-mouth toenail 3-8d (PH)', 'standard practice (cf. IRC Table R602.3(1)) — FM 5-426: rafters "are nailed to the plate, not framed into it", no counts'),
  ridgeToRafters: doc('rafters 3-16d ea (PH)', 'standard practice — the same joint seen from the ridge; FM 5-426 gives no counts'),
  collarTie: doc('3-10d face nail ea end (IRC R802.3.1)', 'IRC R802.3.1 (2018 numbering; R802.4.6 in IRC 2021) — FM 5-426 ch. 7’s alternative for a 2-in tie is three 16d each end', {
    ph: false,
    note: 'ph:false rests on the 2026-08-07 correction record (DECISIONS.md), which checked this schedule against the IRC section named; the FM alternative in the cite IS verified in the on-file FM text, but the IRC value itself has no local text to re-open.',
  }),
  // Named for what carries it: the gable stud in the frozen branch and the rake stud in the
  // sibling generator, which are the same joint — a short INFILL stud, carrying nothing but
  // itself, toenailed top and bottom into the plate and the rafter over it.
  //
  // WHAT CARRIES LOAD DOES NOT SHARE THIS CITATION. A register keyed on the schedule string
  // gives every member that types the same words one entry, and then the entry names the wrong
  // member — which is the defect this table exists to prevent, not one it may commit. The shed
  // pony-wall stud (`ponyWallStud` below) stands under the high plate of a roof; it is a bearing
  // stud and it carries its own line.
  rakeInfillStud: doc('toenail 2-8d ea end (PH)', 'standard practice — no FM 5-426 schedule for gable studs or raked infill'),

  // ── Roof kinds the frozen branch cannot frame — subsystems/roofFamilies.ts
  shedRafterAtPlates: doc('bird’s-mouth toenail 3-8d each plate (PH)', 'standard-practice counts; the seat-at-both-walls configuration is FM 5-426 ch. 7’s'),
  shedPonyPlate: doc('16d @ 16" to the studs; rafters bird’s-mouth toenail 3-8d (PH)', 'standard practice — the pony wall the high side of a shed carries; FM 5-426 schedules neither joint'),
  // The stud UNDER that plate. Same fastening as an infill stud and a different job: this one is
  // in the load path from the rafter seat down to the wall below, so it is cited as wall framing
  // and its schedule says which plates it is toenailed between.
  ponyWallStud: doc(
    'toenail 2-8d ea end, between the plate below and the pony plate (PH)',
    'standard practice — a bearing stud toenailed between its plates; FM 5-426 gives no count',
  ),
  jackRafterAtHip: doc('bevel-cut to the hip, 3-16d; bird’s-mouth toenail 3-8d (PH)', 'standard practice — FM 5-426 ch. 7 names hip jacks, no schedule'),
  hipRafterAtRidge: doc('3-16d at the ridge; jacks bear on it both sides (PH)', 'standard practice — FM 5-426 ch. 7 names hip framing, no schedule'),
  ridgeAtHip: doc('commons and hips 3-16d ea (PH)', 'standard practice — the ridge shortened for the hips; FM 5-426 gives no counts'),
  // A purlin roof has no sheathing: the purlins ARE what the roofing is fastened through, so each
  // one is nailed at every rafter it crosses rather than on a spacing of its own. It takes TWO of
  // the card's controls together to reach one: `coverings.roofDeck=purlins` asks for them, and
  // `roof.kind` has to be off the frozen gable, whose branch lays a solid deck whatever the
  // covering says (C-9). Either alone is inert: a gp-frame moved only to a hip roof emits no
  // purlin, and moved only to a purlin deck emits no purlin either — both still get a decked
  // roof. Moved to both, it emits 26 purlins and no roof panel at all.
  purlinAtRafters: doc('2-16d ea rafter (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, purlins — "inserted between the rafters and nailed through the rafters"; the count of two is practice)'),

  // ── Interior partitions — subsystems/partitions.ts
  // A partition carries nothing, so it is TIED to the framing rather than bearing on it, and its
  // studs are toenailed rather than end-nailed through a plate that is already up.
  partitionPlate: doc('16d @ 16" to the framing (PH)', 'standard practice / IRC Table R602.3(1) — a non-bearing partition tied to the framing'),
  toenailedAtPlate: doc('toenail 3-8d ea plate (PH)', 'standard practice — a stud or rafter toenailed to the plate it stands on; FM 5-426 gives no count'),
  crippleToenail: doc('toenail 3-8d each end (PH)', 'standard practice — cripples over the header; FM 5-426 gives no count'),
  kingToJackStud: doc('16d @ 12" to the jack (PH)', 'IRC Table R602.3(1) / standard practice — the jack-to-king joint seen from the king'),
  builtUpHeaderEachSide: doc('16d @ 16" each side (PH)', 'IRC Table R602.3(1) — built-up header 16d @ 16 in along each edge; FM 5-426 is silent'),

  // ── The open front: a wall replaced by posts and a beam — subsystems/openFront.ts
  // Both of these carry a roof. The post is the wall's whole load path over that bay, and the
  // beam is a built-up member spliced over the posts it bears on, so each says what holds it at
  // each end rather than borrowing a jamb's schedule.
  openFrontPost: doc(
    'framing anchor at the foot and under the beam (PH)',
    'standard practice — a post carrying the beam over an open bay; no publication schedules it',
  ),
  openFrontBeam: doc(
    '16d @ 16" both plies; framing anchor to each post (PH)',
    'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, built-up girders — ply nailing 16d @ 16 in both sides); the anchors to the posts are practice',
  ),

  // ── Coverings — subsystems/coverings.ts
  sidingFieldNail: doc('8d @ 12" (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 6, vertical wood siding — "nailed securely to girts with 8d or 10d nails"; the 12-in spacing is practice)'),
  battenAtJoint: doc('8d @ 12" into the joint (PH)', 'standard practice — the batten nailed in the joint so the boards can move; FM 5-426 says only that battens cover the cracks'),
  rollRoofingCourse: doc('roofing nails @ 6" laps (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, smooth-surfaced roll roofing — laps nailed "on 6-inch centers" through tin or fiber disks)'),
  rollRoofingCap: doc('roofing nails @ 6" each side of the joint, lapped downhill (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7, smooth-surfaced roll roofing — doubled over the ridge, nailed on 6-in centers)'),
  corrugatedCourse: doc('lead-head nails at every 3rd corrugation (PH)', 'standard practice — lead-heads every third corrugation; the crown-nailing concept is FM 5-426 ch. 6’s corrugated SIDING ("nails are placed in the ridges")'),
  corrugatedCap: doc('lead-head nails at every 3rd corrugation, each side of the joint (PH)', 'standard practice — as the corrugated course, each side of the joint; not in FM 5-426'),
  // Underlayment is held down only until the roofing goes over it, which is why it is stapled
  // rather than nailed and why the schedule is not the roofing's.
  feltCourse: doc('staples or 1-in roofing nails @ 12" (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 7 — built-up felts nailed 1 in from the back edge on 12-in centers; the staples are practice)'),
  fasciaAtRafterTails: doc('2-8d into each rafter tail (PH)', 'standard practice — FM 5-426 has no cornice construction section'),
  bargeBoardAtRake: doc('2-8d into the rake at every rafter; mitred at the ridge (PH)', 'standard practice — the rake’s barge board; FM 5-426 has no cornice construction section'),

  // ── What fills an opening — subsystems/builtOpenings.ts
  // A ledged-and-braced door and a batten shutter are made the same way: the boards are nailed
  // THROUGH the pieces behind them and the points turned over. The joint is therefore bought once,
  // on the boards, which is what the ledge's and the batten's own schedule says out loud.
  doorBoardsClenched: doc('6-6d clenched through the ledges (PH)', 'standard practice — clenching is classic ledged-door work; FM 5-426’s hasty-door nailing is unspecified'),
  clenchedFromTheBoards: doc('boards are nailed through it and clenched over — counted on the boards (PH)', 'accounting line — the ledged door and batten shutter buy their joint once, on the boards'),
  doorBraceAtLedges: doc('2-6d ea end into the ledges (PH)', 'standard practice — braces in compression between the ledges; FM 5-426 gives no count'),
  shutterBattens: doc('2-6d ea batten, clenched (PH)', 'standard practice — FM 5-426 has no batten-shutter section'),
  screenPanel: doc('staples @ 4" + batten (PH)', 'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 ch. 8, window screens — stapled and held by molding; the 4-in spacing is practice)'),

  // ── Hut and latrine joinery — families/hut.ts
  girtToStud: doc('2-16d ea stud (PH)', 'standard practice — the count; the girt configuration is FM 5-426 ch. 6’s'),
  riserBoxToStud: doc('3-8d ea stud (PH)', 'TM 5-302 latrine riser box framing'),
  riserBoxBoard: doc('3-8d ea end (PH)', 'TM 5-302 latrine riser box framing'),

  // ── Access: stairs, ramps, ladders, rails — subsystems/access.ts, subsystems/railings.ts
  // EM 385-1-1 is the authority for the GEOMETRY of these (see STAIR/LADDER/RAIL above); it does
  // not publish nailing schedules, so these cite the carpentry lineage instead and say so.
  treadToStringer: doc('2-16d ea stringer (PH)', 'standard practice — two per bearing (FM 5-426 ch. 10’s deck-plank analog); FM has no stair-nailing schedule'),
  // A landing is a little deck, so its planks are nailed to the bearers under them the way a
  // tread is nailed to its stringers — a different member from a tread, and the same rule.
  landingPlankToBearer: doc('2-16d ea bearer (PH)', 'standard practice — the same two-per-bearing pattern as a tread, on a landing’s bearers'),
  stairStringerBolted: doc('bolted at head and foot (PH)', 'TM 5-302 lineage — the stringer is carried at head and foot'),
  rampStringerBolted: doc('bolted at the deck; bedded at grade (PH)', 'TM 5-302 ramp stringers'),
  ladderRungLetIn: doc('let in and 2-16d ea rail (PH)', 'TM 5-302 ladder detail: rungs let into the rails'),
  ladderRailBolted: doc('bolted to the frame at every bay (PH)', 'TM 5-302 ladder detail'),
  railMemberToPost: doc('2-16d ea post (PH)', 'standard practice — top rail, midrail and toe board to every post; EM 385-1-1 publishes no nailing'),
  railPostToFrame: doc('bolted or 4-16d to the deck frame (PH)', 'standard practice — the post bolted or nailed to the frame that carries it'),
  railPostToStringer: doc('bolted to the stringer (PH)', 'standard practice — rail posts on a stair or ramp stringer'),

  // ── Platform, skids and tent frames — families/platform.ts
  deckPlankToJoist: doc('2-16d ea joist (PH)', 'standard practice — two per bearing (FM 5-426 ch. 10’s bridge-deck analog); TM 5-302/TM 10-8340 sheets pending'),
  skidDriftPinned: doc('drift-pinned; chamfer both ends for dragging (PH)', 'TM 5-302 skid runners: PT, chamfered, drift-pinned'),
  platformPostAtPad: doc('drift-pinned to the pad; capped by the sill (PH)', 'standard practice — the post pinned to its pad; no publication schedules it'),
  // The same post standing on a SKID instead of a pad. A pad is bedded and takes a drift pin; a
  // skid is a stick of wood that gets dragged, so the post is toenailed and cleated to it and the
  // cleats are what stop the frame racking off the runner.
  platformPostAtSkid: doc('toenailed and cleated to the skid (PH)', 'standard practice — the frame cleated to the runner it is dragged on'),
  // Near-identical to `sillAtPostCap` above, which is the FROZEN branch's wording for the same
  // joint. Not collapsed: that would rewrite a frozen string, and the two are not a mechanical
  // substitution of one word. Both have a cited home; a later pass may settle on one wording.
  platformSillAtPostCap: doc('anchored to each post cap (PH)', 'standard practice — anchored at each post cap; FM 5-426 ch. 5 states no such schedule'),
  // The TENT-FRAME DOOR JAMB, and nothing else. A jamb stands in the bent's plane, carries the
  // door head, and is anchored at both ends because the frame it stands in is light and racks.
  // An open-front post carries a roof beam and is filed under `openFrontPost`, not here.
  framingAnchorBothEnds: doc('framing anchor top and bottom (PH)', 'TM 10-8340 tent frame: end-door jamb standing in the bent’s plane'),
  bentPostAtDeck: doc('toenail 4-8d to the deck; braced to the sill (PH)', 'TM 10-8340 tent frame'),
  bentRafter: doc('3-8d at the ridge, 3-8d at the post (PH)', 'TM 10-8340 tent frame'),
  bentCollarAndHead: doc('4-8d ea end (PH)', 'TM 10-8340 tent frame'),
  bentRidge: doc('3-8d ea bent (PH)', 'TM 10-8340 tent-frame bent spacing'),

  // ── Guard tower — families/tower.ts
  // A tower is BOLTED, not nailed, and that is the point of listing every one of these: the
  // hardware bill for a tower is bolts, and a bolt that no schedule names never gets drawn.
  towerMudsill: doc('bedded on tamped fill; leg drift-pinned (PH)', 'TM 5-302 timber mudsill'),
  towerLeg: doc('drift-pinned at the sill; bolted at every girt (PH)', 'TM 5-302 tower legs'),
  towerGirt: doc('bolted to each leg (PH)', 'TM 5-302 tower girts'),
  towerBrace: doc('bolted at both ends and where the diagonals cross (PH)', 'TM 5-302 tower X-bracing'),
  cabPostAtPlatform: doc('bolted to the platform frame (PH)', 'TM 5-302 tower cab'),
  cabHipRafter: doc('3-16d at the peak, toenail 3-8d at the plate (PH)', 'TM 5-302 tower cab roof'),
  // A SHED cab roof, which the pyramid does not have: two short posts stand on the cab posts to
  // lift the high side, and a plate across them is what the rafters are seated on.
  cabShedPost: doc('bolted to the cab post below (PH)', 'TM 5-302 tower cab roof: the high side carried on the cab posts'),
  cabShedPlate: doc('2-16d ea post; rafters bird’s-mouth toenail 3-8d (PH)', 'TM 5-302 tower cab roof: the plate the shed rafters bear on'),

  // ── Crib bunker — families/bunker.ts
  // §2.7 applies to this block as much as to `BUNKER` above: these say how the wood is joined and
  // nothing about what the structure defeats. The joinery is heavy-timber standard practice —
  // spikes and drift pins, not nails — and is cited as such rather than to a page of ATP 3-37.34
  // that carries a member table, not a fastening schedule. §6.4.2 also admits the survivability
  // publications for the BUNKER block alone, and how a piece of wood is held up is carpentry.
  cribPostAtCutFace: doc('set against the cut face; capped and drift-pinned (PH)', 'standard heavy-timber practice: a post set against the cut and pinned under its cap'),
  cribEndPost: doc('set against the end of the wall run; capped (PH)', 'standard heavy-timber practice: the post that closes a wall run'),
  cribCapBeam: doc('drift-pinned to every post or crib course (PH)', 'standard heavy-timber practice: caps drift-pinned to what they bear on'),
  cribCapBeamAtSides: doc('drift-pinned to every post or crib course; butted to the side caps (PH)', 'standard heavy-timber practice: caps drift-pinned to what they bear on'),
  // The other wall type the bunker card offers: courses laid at right angles to each other, with
  // nothing spiked to a post because there is no post — the wall is the stack.
  cribLogCourse: doc('drift-pinned to the course below at every crossing (PH)', 'standard heavy-timber practice: crib courses pinned where they cross'),
  laggingToPost: doc('spiked to each post (PH)', 'standard heavy-timber practice: lagging spiked to every post it crosses'),
  laggingToStringer: doc('spiked to every stringer (PH)', 'standard heavy-timber practice: lagging spiked to every stringer it crosses'),
  ohcStringerAtCaps: doc('bearing on the caps both ends; drift-pinned (PH)', 'standard heavy-timber practice: the stringer bears, the pin only locates it'),
  ohcBlocking: doc('toenailed to the stringer each side; spiked to the cap (PH)', 'standard heavy-timber practice: blocking between overhead stringers'),
  baffleWallFreeStanding: doc('free-standing: set in the ground and braced back to the entrance (PH)', 'standard field practice: a screen wall set in the ground and braced back to what it screens'),
  entranceHeaderAtJambs: doc('drift-pinned to each jamb; carries the cover over the opening (PH)', 'standard heavy-timber practice: the cap course continued across a doorway'),
  // NOT A JOINT, and it says so where a crew reads it. The soil ghost is the depth the OPERATOR
  // stated, drawn so it can be seen; there is no wood in it to fasten.
  soilGhostNotBuilt: doc('not built — massing only (PH)', 'not a fastened member — the soil ghost is the user-stated depth drawn as massing, not wood'),
} as const;

// ── Fastener supply arithmetic ───────────────────────────────────────────────
// What turns a member's nailing schedule into a supply request: pieces-per-pound, the modest
// readings the parser bills where a schedule states a joint but not a count, and the corrugation
// pitch the lead-head rule counts crowns by. These sat as literals in `fasteners.ts`; the module
// reads them live now, so a corrected table reaches the very next take-off.
export const FASTENER = {
  /** Pieces per pound by nail size, plus the 1¼-in galvanised large-head roofing nail. */
  perPound: doc(
    { '6d': 200, '8d': 106, '10d': 74, '12d': 57, '16d': 46, '20d': 29, roofing: 250 } as Record<string, number>,
    'TM 3-34.47/MCRP 3-40D.3 (FM 5-426 Figure 2-5, p 2-6 — number per pound by nail size); the roofing-nail 250 is standard practice, not in the figure',
    { unit: 'pieces/lb' , ph: false },
  ),
  /** A member whose schedule says only "spiked": two spikes at each end is the modest reading. */
  spikesPerBareMember: doc(4, 'standard heavy-timber practice — two spikes at each end is the modest reading for a schedule that says only that it is spiked', { unit: 'spikes/member' }),
  /** A bolted joint with no count stated: two bolts per connection is the modest reading. */
  boltsPerConnection: doc(2, 'standard practice — two bolts per connection is the modest reading for a bolted joint that states no count', { unit: 'bolts/connection' }),
  /** The corrugation pitch the "every 3rd corrugation" rule counts crowns by: 2 1/6 in. */
  corrugationPitchIn: doc(26 / 12, 'derived: 2 1/6-in pitch from a 26-in sheet with 12 corrugations — standard-practice sheet data; FM 5-426 has no corrugated-roofing dimensions', { unit: 'in' }),
} as const;

// ── The clamp table (spec.ts SPEC_PATH_DEFS) ─────────────────────────────────
// Every numeric knob's min/max/step, one structured leaf per spec path, keyed by the path the
// registry clamps. `spec.ts` reads these LIVE (labels and the clamp-message cites stay with the
// row registry there); a corrected bound reaches the very next normalize. Three numbers are one
// leaf because a bound is only coherent as a set — an importer states the row whole.
export const LIMITS = {
  'dims.lengthFt': doc({ min: 4, max: 60, step: 0.5 }, '4–60 ft — what this generator will lay out', { unit: 'ft' }),
  'dims.widthFt': doc({ min: 4, max: 24, step: 0.5 }, '4–24 ft — a wider span needs a second girder line, which is not built yet', { unit: 'ft' }),
  'stories.0.wallHeightFt': doc({ min: 6, max: 12, step: 0.5 }, 'editor band, the tool’s own — FM 5-426 ch. 6 frames walls without stating a height range', { unit: 'ft' }),
  'roof.risePer12': doc({ min: 0, max: 12, step: 1 }, 'editor band, the tool’s own — any pitch lays out per the FM 5-426 framing-square method, which states no range', { unit: 'in/ft' }),
  'roof.overhangFt': doc({ min: 0, max: 3, step: 0.5 }, 'editor band, the tool’s own — FM 5-426 has no cornice construction section', { unit: 'ft' }),
  'roof.drainPer12': doc({ min: 1, max: 2, step: 0.25 }, 'editor band — floored at the tool’s roll-roofing minimum-slope reading of FM 5-426’s built-up breakpoint (an inference; see ROOFING.rollMinSlopePer12), capped by the tool', { unit: 'in/ft' }),
  'foundation.crawlFt': doc({ min: 1, max: 4, step: 0.25 }, 'editor band, the tool’s own — FM 5-426’s crawl-space text covers ventilation only; floored by the girder depth below the sill', { unit: 'ft' }),
  'foundation.depthFt': doc({ min: 6, max: 9, step: 0.5 }, 'editor band, the tool’s own — FM 5-426 describes basements without stating a wall height', { unit: 'ft' }),
  'platformHeightFt': doc({ min: 10, max: 32, step: 1 }, 'TM 5-302 tower (PH, LS)', { unit: 'ft' }),
  'cabPlanFt': doc({ min: 6, max: 8, step: 2 }, 'TM 5-302 tower (PH)', { unit: 'ft' }),
  'interiorLengthFt': doc({ min: 6, max: 16, step: 1 }, 'bunker envelope — the interior plan this tool frames (PH)', { unit: 'ft' }),
  'interiorWidthFt': doc({ min: 6, max: 12, step: 1 }, 'bunker envelope — the interior plan this tool frames (PH)', { unit: 'ft' }),
  'clearHeightFt': doc({ min: 4.5, max: 7, step: 0.5 }, 'bunker envelope — the interior plan this tool frames (PH)', { unit: 'ft' }),
  'designCoverDepthFt': doc({ min: 0, max: 4, step: 0.5 }, 'load-table row range (PH, LS, SME)', { unit: 'ft' }),
  'deckHeightFt': doc({ min: 1.75, max: 5, step: 0.25 }, 'TM 5-302 loading platform (PH); floored by the frame depth under the deck', { unit: 'ft' }),
  'ramp.widthFt': doc({ min: 4, max: 12, step: 0.5 }, 'TM 5-302 ramp detail (PH)', { unit: 'ft' }),
  'temperBays': doc({ min: 2, max: 8, step: 1 }, 'TM 10-8340 TEMPER bays (PH)', { unit: 'bays' }),
  'latrine.depthFt': doc({ min: 4, max: 8, step: 0.5 }, 'TM 5-302 latrine (PH — sheet pending)', { unit: 'ft' }),
  'openings[].offsetFt': doc({ min: 0, max: 60, step: 0.25 }, 'editor bounds for a rough opening — geometry and sanity, not doctrine', { unit: 'ft' }),
  'openings[].widthFt': doc({ min: 0.5, max: 16, step: 0.25 }, 'editor bounds for a rough opening — geometry and sanity, not doctrine', { unit: 'ft' }),
  'openings[].heightFt': doc({ min: 0.5, max: 10, step: 0.25 }, 'editor bounds for a rough opening — geometry and sanity, not doctrine', { unit: 'ft' }),
  'openings[].sillHeightFt': doc({ min: 0, max: 9, step: 0.25 }, 'editor bounds for a rough opening — geometry and sanity, not doctrine', { unit: 'ft' }),
} as const;

/** A LIMITS row's value shape — what `spec.ts` reads live for every numeric knob. */
export interface LimitRow {
  min: number;
  max: number;
  step: number;
}

/** The live LIMITS row for a spec path ('dims.lengthFt'), or undefined for unclamped paths. */
export function limitRow(path: string): LimitRow | undefined {
  const d = (LIMITS as Record<string, Doc<LimitRow> | undefined>)[path];
  return d ? d.value : undefined;
}

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
  LUMBER, PANEL, LAYOUT, NOTCH, FOUNDATION, STAIR, LADDER, RAIL, RAMP, ROOF, ROOFING, SIDING, LABOR,
  HUT, LATRINE, TOWER, TENT, OPENING, PLATFORM, SPAN, BUNKER, NAILING, FASTENER, LIMITS,
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

// ── The mutable-leaf register (the plug-and-play rule database's spine) ──────
//
// GROUPS is walked once at module load into a dotted-path index, and then the STRUCTURE is
// frozen while the LEAVES stay writable — SAP-1's D8 discipline, ported. The split carries the
// safety argument: the rule SET is the reviewed artifact, so no code path may add or remove a
// rule at runtime (a rule that appears un-reviewed has no citation anyone vetted, and a rule
// that vanishes takes its check with it), while a rule's VALUE is exactly what a user with the
// cited pub in hand must be able to correct offline. Every consumer reads `.value` at use time,
// so a validated import lands in the very next generate with no re-wiring.
//
// MUTATION GOES THROUGH io.ts AND NOWHERE ELSE. `getByPath` hands back the live leaf because
// the io module needs the live leaf to write; that is a capability, not an invitation — a write
// outside io.ts skips the validation (bounds, table invariants, life-safety immutability) that
// makes a mutable safety table defensible at all.

/** A doctrine leaf: the object that carries a value with its citation and (PH) status. */
export function isDoc(v: unknown): v is Doc<unknown> {
  return typeof v === 'object' && v !== null && 'value' in v && 'cite' in v && 'ph' in v;
}

const INDEX = new Map<string, Doc<unknown>>();

/** The three importable fields as shipped — captured at first registration, before anything can have written a leaf. */
interface ShippedLeaf {
  value: unknown;
  cite: string;
  ph: boolean;
}
const SHIPPED = new Map<string, ShippedLeaf>();

/** Leaf values are JSON-shaped by construction (numbers, strings, plain objects, arrays). */
const cloneValue = <T>(v: T): T => (typeof v === 'object' && v !== null ? (JSON.parse(JSON.stringify(v)) as T) : v);

// Walk the way SAP-1's registerTree walks: descend containers, stop at leaf objects that carry
// value/cite — a leaf whose value is structured (a span table, a hut's dims) is ONE rule with
// one citation, so it registers as one unit and the walk never descends into it.
function indexTree(prefix: string, node: unknown): void {
  if (isDoc(node)) {
    INDEX.set(prefix, node);
    SHIPPED.set(prefix, { value: cloneValue(node.value), cite: node.cite, ph: node.ph });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => indexTree(`${prefix}[${i}]`, v));
    return;
  }
  if (typeof node === 'object' && node !== null) {
    for (const k of Object.keys(node)) {
      indexTree(prefix === '' ? k : `${prefix}.${k}`, (node as Record<string, unknown>)[k]);
    }
  }
}
indexTree('', GROUPS);

// Freeze containers, stop at leaves: keys can neither come nor go, values still can (io.ts only).
function freezeStructure(node: unknown): void {
  if (isDoc(node)) return; // the leaf stays writable — that is the whole point
  if (Array.isArray(node)) {
    for (const v of node) freezeStructure(v);
    Object.freeze(node);
    return;
  }
  if (typeof node === 'object' && node !== null) {
    for (const v of Object.values(node)) freezeStructure(v);
    Object.freeze(node);
  }
}
freezeStructure(GROUPS);

/** The live leaf at a dotted path ('SPAN.joist'), or undefined. Writing it is io.ts's job alone. */
export function getByPath(path: string): Doc<unknown> | undefined {
  return INDEX.get(path);
}

/** Every registered dotted path, sorted — the corpus the export must cover 100% of. */
export function doctrinePaths(): string[] {
  return [...INDEX.keys()].sort();
}

/**
 * A fresh clone of a leaf's shipped {value, cite, ph} — the reset baseline io.ts restores so a
 * test's import can never leak into the next test's doctrine. A clone each call, so nothing a
 * caller does to the returned object can corrupt the baseline itself.
 */
export function shippedLeaf(path: string): ShippedLeaf | undefined {
  const s = SHIPPED.get(path);
  return s ? { value: cloneValue(s.value), cite: s.cite, ph: s.ph } : undefined;
}
