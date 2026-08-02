// The wood-frame value catalog — every doctrinal magnitude and fastening spec the
// timber engine uses, in ONE place, each with its source and an honest statement of how
// far that source has been checked.
//
// Why this file exists (owner direction, 2026-08-02): "for wood frame and for sap you can
// have loaded values i just have to be able to get to the backend somehow and type those
// in when i want to." Values were previously inline string literals scattered across
// floor.ts / walls.ts / roof.ts, which made them unreachable from any UI — the only way to
// change one was to edit TypeScript. Centralizing is what makes an editor possible.
//
// ── On the citations ────────────────────────────────────────────────────────────────
// `confidence` describes the CITATION, not the value:
//
//   'published'  The value and its source are both ordinary published construction
//                practice — the IRC fastening schedule and its equivalents. I am
//                confident in these and they are checkable against a public document.
//   'verify'     The value is standard practice and very likely right, but I am NOT
//                confident enough in the exact table/section to present the citation as
//                settled. These are the ones to check first.
//
// What this file deliberately does NOT do is invent page numbers. The previous code
// carried "(PH)" on all 39 specs — pending page verification — which flattened
// "definitely right, well documented" and "needs a look" into one undifferentiated
// shrug. That is the actual defect being fixed here: not missing values, missing
// discrimination between them.
//
// IRC R602.3(1) is the "Fastening Schedule" table; R403.1.6 covers foundation anchorage;
// R802.3.1 covers ceiling joist and rafter connections. FM 5-426 (Carpentry) is the
// military lineage these were originally attributed to; where a spec is tagged 'verify'
// against an FM, the page cite is what needs confirming, not the practice.

/** How far the CITATION has been checked — not a claim about the value. */
export type CiteConfidence = 'published' | 'verify';

export interface Spec {
  /** Stable id. Overrides key off this, so it must not change once shipped. */
  readonly id: string;
  /** What the editor shows as the row label. */
  readonly label: string;
  /** The shipped default. */
  readonly value: string;
  /** Where it comes from. */
  readonly cite: string;
  readonly confidence: CiteConfidence;
  /** Shown under the field in the editor when present. */
  readonly note?: string;
}

const spec = (
  id: string,
  label: string,
  value: string,
  cite: string,
  confidence: CiteConfidence,
  note?: string,
): Spec => ({ id, label, value, cite, confidence, note });

const IRC_FASTEN = 'IRC Table R602.3(1) — Fastening Schedule';

/**
 * Fastening specs, keyed by id. Ordered as a Marine walks the build: foundation up.
 *
 * Corrections made when these moved out of the engine files (each was previously "(PH)"):
 *  - plate.capLap        was "2-16d at laps" — the lapped area of a double top plate
 *                        carries the splice; the schedule calls for 8-16d there.
 *  - sill.anchorBolt     was silent on end distance and minimum count, which is the part
 *                        that actually gets missed in the field.
 *  - ceilingJoist.toPlate was "3-16d toenail" — a 16d toenail into a plate splits it;
 *                        the schedule specifies 8d for this connection.
 *  - collarTie.toRafter  was "4-8d" — collar ties are a 10d connection.
 */
export const FASTENERS: Readonly<Record<string, Spec>> = {
  // ── Foundation & sill ────────────────────────────────────────────────────────────
  'footing.pour': spec(
    'footing.pour', 'Footing — placement',
    'poured on undisturbed soil, below frost line',
    'IRC R403.1', 'verify',
    'Frost depth is local. This is the one value on this screen that is a site condition, not a spec.',
  ),
  'slab.pour': spec(
    'slab.pour', 'Slab — placement',
    'poured against walls over vapor barrier',
    'IRC R506.2', 'verify',
  ),
  'sill.anchorBolt': spec(
    'sill.anchorBolt', 'Sill plate — anchor bolts',
    '1/2" anchor bolts @ 6 ft max o.c., min 2 per plate, within 12" of each end',
    'IRC R403.1.6', 'published',
    'The end-distance and two-per-piece minimums are the parts most often missed.',
  ),
  'sill.postCap': spec(
    'sill.postCap', 'Sill on piers — anchorage',
    'anchor or drift pin per post cap',
    'FM 5-426 (Carpentry)', 'verify',
    'Pier anchorage varies by cap hardware; confirm against the cap actually issued.',
  ),
  'girder.column': spec(
    'girder.column', 'Girder column bearing',
    'column on slab footing; girder ends bear in wall pockets',
    'FM 5-426 (Carpentry)', 'verify',
  ),

  // ── Floor ────────────────────────────────────────────────────────────────────────
  'girder.builtUp': spec(
    'girder.builtUp', 'Built-up girder — laminating',
    '16d @ 16" staggered, both faces',
    IRC_FASTEN, 'verify',
    'Built-up member nailing varies with ply count and depth; confirm for the section used.',
  ),
  'joist.toBearing': spec(
    'joist.toBearing', 'Floor joist to sill/girder',
    '3-8d toenail each bearing',
    IRC_FASTEN, 'published',
  ),
  'rimJoist.toJoist': spec(
    'rimJoist.toJoist', 'Rim joist to joist end',
    '3-16d end nail each joist',
    IRC_FASTEN, 'published',
  ),
  'header.double': spec(
    'header.double', 'Doubled header/trimmer — laminating',
    '16d @ 12" staggered to mate',
    IRC_FASTEN, 'verify',
  ),
  'header.toTailJoist': spec(
    'header.toTailJoist', 'Header to tail joist',
    '3-16d each tail joist; 16d @ 12" to mate',
    IRC_FASTEN, 'verify',
  ),
  'bridging.toJoist': spec(
    'bridging.toJoist', 'Cross bridging',
    '2-8d each end; bottom ends nailed after subfloor is laid',
    IRC_FASTEN, 'published',
    'Leaving the bottom ends until after the subfloor is down is the sequencing point — nail them early and the joists cannot settle into line.',
  ),
  'blocking.solid': spec(
    'blocking.solid', 'Solid blocking between joists',
    '3-16d each end, staggered line',
    IRC_FASTEN, 'published',
  ),
  'subfloor.sheathing': spec(
    'subfloor.sheathing', 'Subfloor sheathing',
    '8d @ 6" edges / 12" field',
    IRC_FASTEN, 'published',
    'The 6/12 pattern is the same for floor, wall, and roof panels up to 1/2".',
  ),

  // ── Walls ────────────────────────────────────────────────────────────────────────
  'plate.soleToJoist': spec(
    'plate.soleToJoist', 'Sole plate to joist or blocking',
    '16d @ 16" o.c.',
    IRC_FASTEN, 'published',
  ),
  'plate.capToTop': spec(
    'plate.capToTop', 'Cap plate to top plate',
    '16d @ 16" o.c.',
    IRC_FASTEN, 'published',
  ),
  'plate.capLap': spec(
    'plate.capLap', 'Cap plate — lapped area at splices',
    '8-16d face nail in the lapped area, joints offset 24" min',
    IRC_FASTEN, 'published',
    'The lap IS the splice — it carries the plate in tension. Two nails is not enough, which is what this previously said.',
  ),
  'stud.toPlate': spec(
    'stud.toPlate', 'Stud to plate',
    '2-16d end nail, or 4-8d toenail',
    IRC_FASTEN, 'published',
  ),
  'stud.toEndStud': spec(
    'stud.toEndStud', 'Built-up corner post / partition post',
    '16d @ 12" o.c. to the mating stud',
    IRC_FASTEN, 'verify',
  ),
  'stud.jackToKing': spec(
    'stud.jackToKing', 'Jack (trimmer) stud to king stud',
    '16d @ 12" o.c.',
    IRC_FASTEN, 'verify',
  ),
  'header.wall': spec(
    'header.wall', 'Wall header — laminating',
    '16d @ 16" staggered, both faces',
    IRC_FASTEN, 'verify',
  ),
  'sill.rough': spec(
    'sill.rough', 'Rough sill at window',
    '2-16d each end',
    IRC_FASTEN, 'published',
  ),
  'brace.letIn': spec(
    'brace.letIn', 'Let-in corner brace (1x4)',
    '2-8d at each stud and plate crossing',
    IRC_FASTEN, 'published',
  ),
  // NOTE — there is deliberately no 'wall.sheathing' row. The engine emits subfloor and
  // roof sheathing but NOTHING for walls: no wall panel, no siding, despite `siding` and
  // `sheathingPanel` existing as member roles. That is a real gap in the model, found by
  // the "every catalog row is actually used" test when a wall-sheathing row sat unread.
  // Do not re-add the row to make the catalog look complete — add the members first, then
  // the row. A value the owner can edit that changes nothing is worse than an absent one,
  // because the editor implies it matters.

  // ── Roof ─────────────────────────────────────────────────────────────────────────
  'ceilingJoist.toPlate': spec(
    'ceilingJoist.toPlate', 'Ceiling joist to top plate',
    '3-8d toenail each plate; face nail to rafter where they lap',
    'IRC R802.3.1 / Table R602.3(1)', 'published',
    'Previously specified a 16d toenail here, which splits the plate. The schedule calls for 8d.',
  ),
  'rafter.toPlate': spec(
    'rafter.toPlate', 'Rafter to plate (bird’s-mouth)',
    '3-16d toenail',
    IRC_FASTEN, 'verify',
    'Toenail count at the bird’s-mouth is the connection uplift keys on — worth confirming against the pub you are issued.',
  ),
  'rafter.toRidge': spec(
    'rafter.toRidge', 'Rafter to ridge board',
    '3-16d end nail',
    IRC_FASTEN, 'published',
  ),
  'ridge.toRafters': spec(
    'ridge.toRafters', 'Ridge board to rafters',
    '3-16d each rafter',
    IRC_FASTEN, 'published',
  ),
  'collarTie.toRafter': spec(
    'collarTie.toRafter', 'Collar tie to rafter',
    '3-10d face nail each end',
    'IRC R802.3.1', 'published',
    'Previously 4-8d. Collar ties resist ridge separation and are specified as a 10d connection.',
  ),
  'gableStud.toRafter': spec(
    'gableStud.toRafter', 'Gable end stud',
    '2-8d toenail each end',
    IRC_FASTEN, 'verify',
  ),
  'roof.sheathing': spec(
    'roof.sheathing', 'Roof sheathing',
    '8d @ 6" edges / 12" field',
    IRC_FASTEN, 'published',
  ),

  // ── Stairs ───────────────────────────────────────────────────────────────────────
  'stair.stringer': spec(
    'stair.stringer', 'Stair stringer',
    'top plumb cut nailed to trimmer; kicker at slab',
    'FM 5-426 (Carpentry)', 'verify',
  ),
  'stair.tread': spec(
    'stair.tread', 'Stair tread',
    '3-16d per stringer',
    IRC_FASTEN, 'verify',
  ),

  // ── Generic fallback ─────────────────────────────────────────────────────────────
  'generic.faceNail': spec(
    'generic.faceNail', 'Generic face nail (fallback)',
    '16d common',
    IRC_FASTEN, 'verify',
    'Used where a member has no more specific schedule. If you see this on a real member, that member needs its own row.',
  ),
};

/**
 * Labor rates. These are the numbers a command packet's man-hour total is built on, and
 * they are the LEAST transferable values in this file — they move with crew experience,
 * tool availability, weather, and whether the crew is under load. They ship as a
 * starting point, not an answer.
 */
export const RATES: Readonly<Record<string, Spec>> = {
  'labor.perBoardFoot': spec(
    'labor.perBoardFoot', 'Man-hours per board foot',
    '0.055',
    'FM 5-426 Table C-1', 'verify',
    'Rough carpentry, trained crew, good conditions. Expect this to be optimistic for a green crew or a hasty build.',
  ),
  'labor.perPanel': spec(
    'labor.perPanel', 'Man-hours per sheathing panel',
    '0.5',
    'FM 5-426 Table C-1', 'verify',
    'Per 4x8 panel, placed and nailed.',
  ),
  'labor.perConcreteLf': spec(
    'labor.perConcreteLf', 'Man-hours per lineal foot of concrete',
    '0.15',
    'FM 5-426 Table C-1', 'verify',
    'Form, place, and strip per lineal foot of wall, footing, or slab run.',
  ),
};

/** Default lumber grade carried on every member. */
export const GRADE = spec(
  'lumber.grade', 'Default lumber grade',
  'No. 2 common',
  'FM 5-426 (Carpentry)', 'verify',
);

/** Every editable value in the timber app, in one list — this is what the editor renders. */
export const ALL_SPECS: readonly Spec[] = [
  ...Object.values(FASTENERS),
  ...Object.values(RATES),
  GRADE,
];

/** Count of specs whose citation still needs the owner's eye. Surfaced in the UI. */
export const NEEDS_VERIFICATION = ALL_SPECS.filter((s) => s.confidence === 'verify').length;

// ── Overrides ──────────────────────────────────────────────────────────────────────
// The editor writes here. Kept as an explicit, replaceable map rather than mutating the
// catalog so that (a) the shipped defaults are always recoverable, and (b) a build with
// no overrides is byte-identical to one where the user cleared them — which is what the
// determinism goldens depend on.

let overrides: Readonly<Record<string, string>> = {};

/** Replace the override set wholesale. Pass {} to return to shipped defaults. */
export function setOverrides(next: Readonly<Record<string, string>>): void {
  overrides = { ...next };
}

/** The current override set (for serializing to storage). */
export function getOverrides(): Readonly<Record<string, string>> {
  return { ...overrides };
}

/**
 * Resolve a spec id to its effective value: the owner's override if present, otherwise
 * the shipped default. Unknown ids throw rather than returning a silent empty string —
 * a typo'd id must not become a blank nailing note on a member.
 */
export function value(id: string): string {
  const o = overrides[id];
  if (o !== undefined && o !== '') return o;
  const s = FASTENERS[id] ?? RATES[id] ?? (id === GRADE.id ? GRADE : undefined);
  if (!s) throw new Error(`timber/data: unknown spec id "${id}"`);
  return s.value;
}

/** Numeric resolve for the labor rates. Throws on a non-numeric override. */
export function num(id: string): number {
  const raw = value(id);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`timber/data: spec "${id}" is not numeric: "${raw}"`);
  return n;
}

/**
 * The citation for a spec, suffixed when the owner has typed over the shipped value —
 * an overridden value is no longer attributable to the published source, and a member
 * card must not keep flying the old flag over a number the owner replaced.
 */
export function cite(id: string): string {
  const s = FASTENERS[id] ?? RATES[id] ?? (id === GRADE.id ? GRADE : undefined);
  if (!s) throw new Error(`timber/data: unknown spec id "${id}"`);
  if (isOverridden(id)) return `${s.cite} — value replaced by unit`;
  return s.confidence === 'verify' ? `${s.cite} (confirm page)` : s.cite;
}

/** True when the owner has typed over the shipped default. Editor shows this. */
export function isOverridden(id: string): boolean {
  const o = overrides[id];
  return o !== undefined && o !== '';
}
