# TIMBER-2 — SCOPE & SEQUENCING BLUEPRINT

> **Status:** Handoff-ready phased plan. TIMBER-2 grows the one-building TIMBER-1 teaching
> viewer into the full USMC/Army theater-of-operations (TO) rough-construction catalog:
> a structure picker of doctrinal building types, every one configurable to minute detail,
> every one with a cutaway, all projected from one deterministic engine.
>
> **This document is the deliverable.** It will be implemented by OTHER sessions,
> phase-by-phase, without the planner present. Every phase names its files, signatures,
> tests, acceptance criteria, and demo. Judgment calls are logged in §9 (D1–D18).
> Quality bar: `docs/SAP2_BLUEPRINT.md`.
>
> **Baseline (verified 2026-08-02):** 219 tests green repo-wide (`npm test`);
> `npm run build:suite` assembles the deployed toolkit (hub + `/woodframe.html` +
> `/survivability/`); the deploy pipeline just stabilized — **nothing in this plan may
> break it, in any phase.**

---

## 0. How to use this document (implementing sessions start here)

1. Read §1 (mandate), §2 (architecture spine), and §8 (handoff kit — invariants + ritual).
2. Find your phase in §4. Read its START HERE block in §8.4.
3. Before writing code: run `npm run verify && npm run build:suite` and confirm green.
   If not green, stop — fix or report; never build on a red baseline.
4. Work the phase. Never edit an existing test file (§5.3 stop-the-line rule).
5. Exit through the phase's Definition of Done (§8.5). Update the progress table in §4.0
   and append your decisions to `DECISIONS.md` under a `TIMBER-2 Tn` heading.

Ground-truth files (read before coding, in this order):
- `/home/user/FieldFortificationsCalculator/src/timber/types.ts` — Member, roles, STAGES, DRESSED
- `/home/user/FieldFortificationsCalculator/src/timber/frame.ts` — BuildingInput, generateFrame
- `/home/user/FieldFortificationsCalculator/src/timber/floor.ts`, `walls.ts`, `roof.ts`, `elevation.ts`, `bom.ts`
- `/home/user/FieldFortificationsCalculator/src/ui/woodframe-scene.ts` + `woodframe.html`
- `/home/user/FieldFortificationsCalculator/test/timber-frame.test.ts`, `timber-walls.test.ts`, `timber-features.test.ts`
- `/home/user/FieldFortificationsCalculator/vite.suite.config.ts` + `scripts/build-suite.mjs` + `scripts/check-offline.ts`
- `/home/user/FieldFortificationsCalculator/docs/TIMBER1_3D_SYSTEM_DESIGN.md` (the TIMBER-1 design the engine implements)

---

## 1. Mandate → testable requirements

| # | Owner's mandate (verbatim intent) | Requirement | Where enforced |
|---|---|---|---|
| M1 | "Different types of structures, roofs, stories, all the variables — ALL in the rough construction the USMC would ever use" | A **structure registry** (§2.2) enumerating the TO canon (§3): buildings, sheds, huts (SEA/SWA/B-hut/guard shack), towers, tent frames, bunker carpentry, site structures — each a `StructureDef` with its own parameter schema and generator, all emitting the same `Member[]` model | §2, §3; generic invariant suite (§5.4) auto-covers every registered structure |
| M2 | "Go beyond the framing seriously in every way" | Coverings (roofing, sheathing, siding, trim), concrete/foundations (exists), BUILT doors/screens (ledger-and-brace door, framed screen panels), stairs/ladders/railings, hardware + nail quantities — all as first-class Members in the same BOM | T2 (§4.2), T3 (§4.3); material-class BOM extension (§2.7) |
| M3 | "Opens on a STRUCTURE PICKER — cards with images; click to configure; None/Custom for full composition" | Picker shell with **self-generated SVG line-art thumbnails** (D2 — zero downloaded images, zero build-time render pipeline, zero new assets); hash routing; declarative configurator rendered from each structure's `ParamDesc[]` schema; `custom` structure = superset schema | T1 (§4.1), T5 (§4.5) |
| M4 | Named types: guard towers, small/modular houses, hasty structures, bunkers, "and so on ect ect" | Exhaustive roster in §3 with doctrine lineage per structure | §3; phase mapping in §4 |
| M5 | "EVERY structure has a cutaway view option" | Cutaway is a **scene-level feature** (three.js clipping plane + position slider, D5) — every structure inherits it with zero per-structure work | T1 (§4.1) |
| M6 | "Minute control … type of everything" | Every knob is a schema-declared param with bounds; the same schema drives the UI **and** the property-test sampler (D6) — what you can click is exactly what is fuzzed | §2.4; §5.4 |
| M7 | The plan is the deliverable; other sessions implement | This document: exact module layout (§2.6), type signatures (§2.2–§2.5), per-phase tests + acceptance + demo (§4), invariants (§8.2), start-here notes (§8.4) | this file |
| M8 | Doctrine grounding with the existing cite discipline | FM 5-426 spine + wider TO canon (§3.1); every member keeps `doctrineRef` with the `(PH) pending page verification` pattern; life-safety numbers routed through the named review posture (§6) | §6; cite-integrity tests |

**Non-negotiable constraints (inherited, all phases):** fully offline (build gate scans dist
for external URLs — `scripts/check-offline.ts`); zero runtime deps beyond `three`;
deterministic outputs; ships inside the one toolkit deploy; assets ship as **files**, never
base64 megabundles (`vite.suite.config.ts` keeps `assetsInlineLimit: 4096` — the inline-OOM
lesson); the 219-test suite stays green through every phase.

---

## 2. Architecture spine — the family system

### 2.1 What stays true (the TIMBER-1 contract, now generalized)

The `Member[]` a generator emits is the SINGLE source of truth. The 3D scene, 2D
projections, thumbnails, cut list/BOM, and labor plan are all projections of that array.
Engine modules (`src/timber/**`) stay pure: no DOM, no three.js, no Date/random. Stages
partition the BOM exactly. Every member carries role/size/cutLength/position/rotation/
stage/nailing/doctrineRef. Nothing downstream invents geometry.

### 2.2 The structure registry — `src/timber/catalog.ts` (NEW, T1)

```ts
import type { Member, StageDef, WallId } from './types';
import type { FloorLevels } from './floor';
import type { ParamDesc } from './params';

export type FamilyId =
  | 'building'   // TO frame buildings (the house), 1–2 stories
  | 'shed'       // sheds & lean-tos
  | 'hut'        // SEA hut / SWA (plywood/B-) hut / guard shack
  | 'tower'      // guard & observation towers            (life-safety)
  | 'hasty'      // strongback tent frames, tent decks
  | 'bunker'     // timber bunker CARPENTRY only (§6.3 boundary)
  | 'site'       // stairs, ramps, duckboard, latrine box
  | 'custom';    // the full composer

export type StructureId =
  | 'house' | 'shed' | 'equipShed'
  | 'seaHut' | 'swaHut' | 'guardShack'
  | 'guardTower'
  | 'strongback' | 'tentDeck'
  | 'cribBunker' | 'postBunker'
  | 'siteStairs' | 'ramp' | 'duckboard' | 'latrineBox'
  | 'custom';

// The generalized model every generator returns (frame.ts's FrameModel, widened — §2.3).
export interface StructureModel<P = unknown> {
  input: P;
  members: Member[];
  levels: FloorLevels;                       // vertical datum (gradeY drives the ground plane)
  stages: readonly StageDef[];               // THIS structure's build order, ids 1..n
  footprint: { lengthFt: number; widthFt: number }; // scene centering, ground sizing, thumb framing
}

export interface StructureDef<P = unknown> {
  id: StructureId;
  family: FamilyId;
  name: string;                              // card title, e.g. "SEA hut"
  blurb: string;                             // one-liner under the title
  doctrine: string;                          // family-level lineage cite, (PH) discipline (§3.1)
  reviewClass: 'standard' | 'life-safety';   // life-safety ⇒ amber review-pending badge (§6)
  stages: readonly StageDef[];               // declared once; generator must only emit these ids
  defaults: P;
  schema: readonly ParamDesc[];              // renders the configurator AND drives test sampling
  generate: (p: P) => StructureModel<P>;     // pure, deterministic, clamped-input tolerant
  capabilities: {
    strips: boolean;                         // plate layout strips apply (stud-walled structures)
    cutawayAxis: 'x' | 'z';                  // default section plane orientation
  };
  presets?: readonly { id: string; name: string; params: Partial<P> }[];
}

// Registry API (pure data + lookups; the array literally grows one phase at a time):
export const STRUCTURES: readonly StructureDef[];
export function getStructure(id: StructureId): StructureDef;
export function listFamilies(): { family: FamilyId; label: string; structures: StructureDef[] }[];
```

Rules:
- A `StructureDef.generate` may compose any engine generators (floor/walls/roof/covering/
  access/…) but must return members whose `stage` ids all appear in `def.stages` and whose
  ids are unique (the generic suite asserts this for every registered def — §5.4).
- `defaults` must generate warning-free at every phase; presets are `Partial<P>` merged
  over defaults and are covered by the invariant sampler too.

### 2.3 Stage-model generalization (T1) — without breaking the partition invariant

Today `types.ts` exports a fixed 11-stage `STAGES` list and `StageId` as a literal union;
`bom.ts` and the scene import it. Generalization (D1, D3):

- `types.ts`: add `export interface StageDef { id: number; name: string }`;
  change `export type StageId = number;` (loosening); **keep `STAGES` exported unchanged**
  — it becomes the HOUSE's stage list (ids 1..11, same names).
- `frame.ts`: `FrameModel` gains `stages: readonly StageDef[]` (filled with `STAGES`) and
  `footprint` — **additive fields only**; `generateFrame`'s members are byte-identical
  for identical inputs (the parity test in §5.2 locks this).
- `bom.ts`: `bomSummary(members: Member[], stages: readonly StageDef[] = STAGES)` —
  default arg keeps every legacy call site and test working verbatim.
- The scene and stage scrubber read `model.stages`, never the global.
- Each new structure declares its own doctrinally-ordered stage list, ids 1..n, e.g. the
  tower: `1 Footings · 2 Posts & girts · 3 X-bracing · 4 Platform frame · 5 Decking ·
  6 Railings · 7 Ladder · 8 Roof cap`.

The exact-partition invariant becomes structure-generic: for every registered structure,
per-stage board-feet/panels/members sum EXACTLY to the totals, and every member's stage id
exists in `def.stages` (§5.4). The house keeps passing its existing 219-suite assertions
against the global `STAGES` unchanged.

### 2.4 Declarative parameters — `src/timber/params.ts` (NEW, T1)

One schema drives the configurator UI, input clamping, and the property-test sampler.

```ts
export type ParamDesc =
  | { kind: 'number'; key: string; label: string; min: number; max: number; step: number;
      unit: 'ft' | 'in' | 'in/12'; help?: string }
  | { kind: 'int';    key: string; label: string; min: number; max: number; help?: string }
  | { kind: 'enum';   key: string; label: string;
      choices: readonly { value: string; label: string }[]; help?: string }
  | { kind: 'bool';   key: string; label: string; help?: string }
  | { kind: 'openings'; key: string; label: string; walls: readonly WallId[];
      maxPerWall: number }                    // structured add/remove editor (doors/windows/vents)
  | { kind: 'group';  label: string; children: readonly ParamDesc[] };

export function flattenSchema(schema: readonly ParamDesc[]): ParamDesc[];      // groups unwrapped
export function clampParams<P>(schema: readonly ParamDesc[], p: P): P;          // out-of-range → clamped; bad enum → default
export function sampleParams<P>(schema: readonly ParamDesc[], defaults: P, seed: number): P;
// sampleParams: mulberry32-seeded PRNG; numbers uniform in [min,max] snapped to step; ints
// uniform; enums/bools uniform; openings: 0..maxPerWall random valid openings per allowed
// wall (offset+width clamped inside the run). Deterministic per seed — CI never flakes.
```

Rule: generators receive **clamped** params (the configurator and the sampler both call
`clampParams` first), so generators may assume in-bounds values but must STILL never emit
zero/negative members (the existing guard culture — low-sill cripples, slab-on-grade posts
— continues; the sampler will find the holes).

### 2.5 New engine modules (phase-tagged)

```ts
// src/timber/thumbnail.ts (T1) — pure axonometric line-art SVG of a StructureModel. No DOM.
export interface ThumbSpec { yawDeg?: number; widthPx?: number; heightPx?: number; stage?: number }
export function thumbnailSvg(model: StructureModel, spec?: ThumbSpec): string;
// Projection: plan-rotate by yawDeg (default 30), then iso u=(x'-z')·cos30, v=y+(x'+z')·sin30.
// Each member draws as a stroked line along its axis (endpoints from position/rotation/
// cutLength), stroke width ∝ its section; panels as translucent quads; painter-sorted by
// depth key; all coords fmt'd to 2 decimals ⇒ byte-deterministic, snapshot-testable in node.

// src/timber/roles.ts (T1) — PLAIN + WHAT dictionaries MOVED out of the scene into pure data
export const PLAIN: Record<MemberRole, string>;
export const WHAT: Record<MemberRole, string>;
// so a node test can assert every role any registered structure emits has both entries.

// src/timber/roofs/shed.ts (T1) — single-slope roof: rafters seat on high/low plates,
// sheathing courses tile the slope (same course-sum invariant as gable).
export interface ShedRoofInput { lengthFt: number; widthFt: number; highWallFt: number;
  lowWallFt: number; rafterSpacingIn: 16 | 24; overhangFt: number }
export function generateShedRoof(i: ShedRoofInput, opts?: GenOpts): Member[];

// src/timber/gen.ts (T1) — the shared emit context every NEW generator uses:
export interface GenOpts { idPrefix?: string; yBase?: number; stageOffset?: number }
// idPrefix keeps member ids unique across stories/sub-assemblies ("S2-" + "S-stud-01");
// yBase lifts a whole sub-assembly; defaults ('' / 0 / 0) reproduce legacy output exactly.

// src/timber/covering.ts (T2) — skins, all course-tiled exactly (no overlap/gap, ripped last course):
export type RoofCovering = 'none' | 'rollRoofing' | 'corrugated' | 'woodShingle';
export type WallCovering = 'none' | 'boardSiding' | 'plywoodSiding' | 'boardAndBatten';
export function generateRoofCovering(kind: RoofCovering, roof: RoofPlanes, opts?: GenOpts): Member[];
export function generateWallSheathing(walls: WallPlanes, opts?: GenOpts): Member[];
export function generateSiding(kind: WallCovering, walls: WallPlanes, openings: Opening[], opts?: GenOpts): Member[];
// RoofPlanes / WallPlanes are small pure descriptors computed by the composing structure
// from its own inputs (slope length, eave lines, wall runs + opening ROs) — coverings
// never reach into other generators' members.

// src/timber/built-items.ts (T2) — doors/windows as BUILT items:
export function generateLedgerBraceDoor(o: OpeningRef, opts?: GenOpts): Member[];
//   vertical boards + 3 ledgers + diagonal brace + T-hinge/hasp hardware members
export function generateScreenPanel(o: OpeningRef, opts?: GenOpts): Member[];
//   1x4 frame + screen note member — the SEA-hut screen band and window screens

// src/timber/access.ts (T3) — vertical circulation, all life-safety-flagged (§6):
export function generateLadder(heightFt: number, at: Placement, opts?: GenOpts): Member[];
export function generateRailing(run: RailRun[], opts?: GenOpts): Member[];   // posts, top/mid rail, toeboard
export function generateStraightStair(riseFt: number, widthFt: number, at: Placement, opts?: GenOpts): Member[];
//   EXTRACTED from floor.ts's basement stair emission; floor.ts calls it; the existing
//   basement tests (untouched) are the parity harness for the extraction.

// src/timber/ls-constants.ts (T3) — the ONLY home for life-safety numbers (§6.2):
export interface LSEntry { id: string; value: number; unit: 'in' | 'ft'; cite: string; note: string }
export const LS_TABLE: Record<LSId, LSEntry>;   // railHeightIn, midRailIn, toeboardIn,
// ladderRungSpacingIn, ladderSideRailNominal, towerMaxPlatformHtFt, towerMaxUnbracedFt,
// stairMaxRiseIn, stairMinTreadIn, stairMaxStringerSpanFt, platformJoistTable…
export function ls(id: LSId): number;           // generators MUST source these dims via ls()

// src/timber/review.ts (T3) — the review-pending surface (§6.2):
export interface ReviewSummary { pendingCount: number; roles: string[]; statement: string }
export function reviewSummary(members: Member[]): ReviewSummary | null;  // null when no flagged member
```

`types.ts` grows (T-tagged): `Member.review?: 'life-safety'` (T3); new roles —
T1: *(none)*; T2: `roofingCourse`, `ridgeCap`, `sidingBoard`, `batten`, `fascia`, `trim`,
`girt`, `doorBoard`, `doorLedger`, `doorBrace`, `screenPanel`, `hardware`;
T3: `railPost`, `railTop`, `railMid`, `toeboard`, `ladderRail`, `ladderRung`, `kneeBrace`,
`xBrace`, `deckPlank`; T4: `cribTimber`, `roofBeam`, `purlin`, `ridgepole`, `stake`,
`runner`, `slat`, `seatPanel`, `coverGhost`. `DRESSED` grows (`1x6`, `1x8`, `2x2`, `4x6`,
`6x6`) **in lockstep with `BF_PER_LF` in bom.ts** — a T1 sync test makes drift impossible.

### 2.6 Module layout after T5 (the target tree)

```
src/timber/
├── types.ts            EXTENDED   Member(+review), roles, StageDef, STAGES (house), DRESSED
├── frame.ts            EXTENDED   legacy house assembly — generateFrame/BuildingInput FROZEN
├── floor.ts            EXTENDED   +generatePlatform (T3), stair emission delegated to access.ts
├── walls.ts            UNTOUCHED
├── roof.ts             UNTOUCHED  (gable)
├── elevation.ts        UNTOUCHED
├── bom.ts              EXTENDED   optional stages arg (T1); material classes + nailEstimate (T2)
├── gen.ts              NEW T1     GenOpts (idPrefix/yBase) shared emit conventions
├── params.ts           NEW T1     ParamDesc, clampParams, sampleParams
├── catalog.ts          NEW T1     StructureDef registry, StructureModel
├── thumbnail.ts        NEW T1     pure SVG line-art projection
├── roles.ts            NEW T1     PLAIN/WHAT dictionaries (moved from scene)
├── covering.ts         NEW T2     roofing / sheathing / siding / trim
├── built-items.ts      NEW T2     ledger-and-brace door, screen panels, hardware
├── access.ts           NEW T3     ladders, railings, extracted straight stair
├── ls-constants.ts     NEW T3     ALL life-safety numbers, cited, ledger-mirrored
├── review.ts           NEW T3     reviewSummary → UI badges/BOM footer
├── roofs/
│   ├── shed.ts         NEW T1
│   └── hip.ts          NEW T5     (parkable — D14)
└── structures/
    ├── house.ts        NEW T1     wraps generateFrame (stories=1 ≡ legacy, parity-tested);
    │                              T3 adds stories=2 composition (its own path, D10)
    ├── shed.ts         NEW T1     shed + lean-to (3-wall) + open-front equipment shed preset
    ├── hut.ts          NEW T2     one generator; presets: SEA hut, SWA/B-hut
    ├── guard-shack.ts  NEW T2
    ├── tower.ts        NEW T3     guard/observation tower (life-safety)
    ├── strongback.ts   NEW T4     strongback tent frame + tent deck preset
    ├── bunker.ts       NEW T4     crib + post-and-beam CARPENTRY (§6.3 boundary)
    ├── site.ts         NEW T4     siteStairs, ramp, duckboard, latrineBox
    └── custom.ts       NEW T5     the full composer (superset schema)

src/ui/
├── woodframe.html      EXTENDED   +#picker and #config containers, hash routing hooks
├── woodframe-scene.ts  REFACTORED viewer takes {def, params}; PLAIN/WHAT imported from roles.ts;
│                                  cutaway (clipping plane) T1; InstancedMesh threshold T3
├── picker.ts           NEW T1     cards grid from catalog + thumbnailSvg; routing
├── configurator.ts     NEW T1     renders ParamDesc[] → controls; openings editor T2-full
└── (hub.html)          EXTENDED   card copy updated to TIMBER-2 at T1 ship

test/                   (all NEW files; existing 219 tests NEVER edited — §5.3)
├── timber2-catalog.test.ts        T1   registry sanity, stage declarations, schema validity
├── timber2-house-parity.test.ts   T1   catalog 'house' defaults ≡ generateFrame(golden) member-for-member
├── timber2-invariants.test.ts     T1   THE generic suite over every registered def (§5.4)
├── timber2-thumbnail.test.ts      T1   deterministic, non-empty, stable snapshot per def
├── timber2-shed.test.ts           T1   bespoke shed-roof geometry
├── timber2-covering.test.ts       T2   course-sum exactness, siding-vs-opening no-overlap
├── timber2-hut.test.ts            T2   SEA/SWA presets, screen band, built door presence
├── timber2-bom2.test.ts           T2   material classes, nailEstimate, DRESSED↔BF_PER_LF sync (moved from T1 file if preferred)
├── timber2-access.test.ts         T3   ladder/railing/stair invariants; basement-stair extraction parity
├── timber2-tower.test.ts          T3   tower geometry + LS flags + ls() sourcing
├── timber2-stories.test.ts        T3   2-story platform framing invariants
├── timber2-review.test.ts         T3   ledger↔LS_TABLE 1:1, reviewSummary, badge text
├── timber2-hasty-site.test.ts     T4   strongback/deck/site structures bespoke
├── timber2-bunker.test.ts         T4   crib interlock + BOUNDARY test (§6.3)
└── timber2-composer.test.ts       T5   wide seeded sweep, hip courses, URL param roundtrip

docs/
├── TIMBER2_BLUEPRINT.md           this file, copied into the repo at T1 (D18)
└── TIMBER2_REVIEW_LEDGER.md       NEW T3   the named life-safety ledger (§6.2)
```

### 2.7 BOM growth (T2) — additive only

```ts
export type MaterialClass = 'lumber' | 'panel' | 'concrete' | 'roofing' | 'hardware' | 'annotation';
export function classifyNominal(nominal: string): MaterialClass;
// 'panel' substring → panel; 'conc' → concrete; 'roll'/'felt'/'corr'/'shingle' → roofing;
// hardware role nominals ('T-hinge 6"', 'hasp') → hardware; 'cover (see SAP-2)' → annotation.
export interface StageBom { /* existing fields UNCHANGED */; roofingSquares: number; hardwareCount: number }
export function nailEstimate(members: Member[]): { size: string; lbs: number }[];
// (PH) rates per member-count by role class, from FM 5-426 ch. 4 nail tables (PH page) —
// visibly footnoted like man-hours. Hardware items are Members (cutLength = physical length,
// e.g. 6" hinge), so the partition invariant covers them too (D11).
```

Existing fields (`boardFeet`, `panels`, `memberCount`, `manHours`, totals) keep their
exact semantics — legacy tests compare them and must not move.

### 2.8 UI shell (T1) — picker, configurator, viewer, cutaway

- **Routing:** `location.hash` — `#/` = picker, `#/s/<structureId>` = configurator+viewer.
  Default route `#/`. Back link on the viewer → picker; hub link stays in the header.
  (Param serialization into the hash is deferred to T5 — D13.)
- **Picker:** one card per registered structure, grouped by family: inline
  `thumbnailSvg(def.generate(def.defaults))` (computed at picker load, cached per
  StructureId in a Map — D17), name, blurb, family tag, amber `LIFE-SAFETY — review
  pending` badge when `reviewClass === 'life-safety'`, and the `custom` card last
  ("Custom — compose exactly the building you want").
- **Configurator:** renders `def.schema` (number → slider+input, int → stepper, enum →
  chips like today's Model chips, bool → toggle, openings → add/remove rows, group →
  fieldset). Every change: `clampParams` → `def.generate` → all panes re-project (the
  existing `regenerate()` discipline).
- **Viewer:** current woodframe-scene behaviors survive intact — views, stage scrubber
  (now from `model.stages`), member card, per-stage cut list, GLB lumber props, layout
  strips **when `def.capabilities.strips`**. The `BUILDING`/`MODEL` globals become a
  `current: { def, params, model, bom }` object; `buildGround` reads
  `model.footprint`/`model.levels`.
- **Cutaway (M5):** a toolbar toggle + position slider. Implementation: one
  `THREE.Plane`, `renderer.localClippingEnabled = true`, plane assigned to every member
  material at mesh build when active; axis from `def.capabilities.cutawayAxis`; slider
  sweeps the plane across the footprint. Works for every structure and stage
  automatically; the ortho Front/Left views + cutaway give true sections. No engine
  change — the scene clips, the model is untouched.
- **No new props:** corrugated/roll roofing render as thin box meshes with material color;
  lumber keeps the existing GLB props (`three-viewer.ts` untouched — D15).

---

## 3. The structure roster (exhaustive, with doctrine lineage)

### 3.1 Doctrine base (cite discipline)

- **FM 5-426 Carpentry** — the spine: dimension lumber (Table 2-1), nails/fasteners
  (ch. 4), foundations/floors/walls/roofs (ch. 6), stairs, roofing & siding chapters.
  All existing `(PH) pending page verification` cites continue.
- **TM 5-302 (Army Facilities Components System standard designs) / FM 5-35 lineage** —
  theater-standard buildings, towers, bunker structures (PH volume/page).
- **SEA-hut & SWA-hut standard designs** (Vietnam-era SEA hut; CENTCOM/USACE SWA plywood
  "B-hut" standard drawings) (PH drawing numbers).
- **GP-medium strongback standard design** (theater standard drawing lineage, PH).
- **Guard tower standard designs** (AFCS/TM 5-302 lineage; unit SOP tower drawings, PH).
- **FM 21-10 / MCRP field-sanitation lineage** — burnout latrine box (PH).
Every structure's `doctrine` field names its lineage; every member's `doctrineRef` cites
at member level with `(PH)` until the owner verifies pages (§6.1).

### 3.2 Roster (16 cards; phase in parentheses)

| StructureId | Family | What it is (defaults) | Key params | Review |
|---|---|---|---|---|
| `house` | building | The existing 20×16 TO frame building; T3 adds 2-story platform framing | dims, stories 1–2, wall ht, pitch, overhang, spacings, foundation piers/wall/basement, openings, bridging, bracing, attic hatch, coverings (T2) | standard (stair/railing members flagged when stories=2) |
| `shed` | shed | 12×8 single-slope shed; `walls: 4 | 3` (3 = lean-to/open-front) | dims, high/low wall ht, spacings, openings, coverings | standard |
| `equipShed` | shed | preset of `shed`: open-front equipment shelter, deeper posts | (preset) | standard |
| `seaHut` | hut | preset of `hut`: 16×32 SEA hut — pier posts, plywood lower walls, continuous screen band under wide eaves, corrugated gable roof, screen doors | length (16–48), width, screen band ht, door count, roof covering | standard |
| `swaHut` | hut | preset of `hut`: 16×32 SWA/B-hut — full plywood skin, felt/roll roof, framed screen vents, interior partition option | length, partition count, vent count | standard |
| `guardShack` | hut | 4×6 sentry box: single door, windows 3 sides, shed or gable cap | dims, window sills, roof type | standard |
| `guardTower` | tower | 4-post 10×10 platform at 16 ft: pads, 6×6 posts, girts, X-bracing, joisted platform, decking, railings + toeboard, ladder, optional roof cap | platform size, height (ls-capped), post size, brace scheme, roof none/shed/gable/hip-cap(T5), ladder side | **life-safety** |
| `strongback` | hasty | GP-medium strongback tent frame 16×32: deck, knee walls + girts, ridge posts/ridgepole, rafters, purlins, screen band, end doors | length, deck ht, knee wall ht, screen on/off | standard |
| `tentDeck` | hasty | preset of `strongback`: floor deck only | (preset) | standard |
| `cribBunker` | bunker | Interlocking 6×6 crib-wall structure, post-and-beam roof deck, framed door opening; **cover shown as ghost annotation only** (§6.3) | interior dims, wall ht, timber size, door width | **life-safety** |
| `postBunker` | bunker | preset of `cribBunker`: post-and-beam walls (posts + walers) instead of full crib | (preset) | **life-safety** |
| `siteStairs` | site | freestanding exterior stair, grade→deck, with railing | rise, width, rail on/off | **life-safety** |
| `ramp` | site | pedestrian ramp: stringers, deck planks, curbs | rise, run, width | standard |
| `duckboard` | site | duckboard walkway sections: 2 runners + slats | section len, count | standard |
| `latrineBox` | site | 4-seat burnout latrine box + optional shelter frame | seats 2–6, shelter on/off | standard |
| `custom` | custom | full composer: dims, stories, roof gable/shed/hip, foundation, spacings, all coverings, full openings editor, access options | superset of everything | standard (flags follow members) |

Presets keep the generator count honest: `hut.ts` serves seaHut/swaHut; `shed.ts` serves
equipShed; `strongback.ts` serves tentDeck; `bunker.ts` serves postBunker (D9). 16 cards,
10 generators.

---

## 4. PHASE PLAN T1–T5

Effort scale: **S** ≤ half a session · **M** ≈ 1 session · **L** 2–3 sessions ·
**XL** 4–6 sessions (a "session" = one focused implementation session by a capable agent
holding this document). Every phase ends deployed-green: `npm run verify` AND
`npm run build:suite` both pass at merge; the toolkit never regresses.

### 4.0 Progress table (implementing sessions update this)

| Phase | Status | Shipped on | Notes |
|---|---|---|---|
| T1 | not started | — | — |
| T2 | not started | — | — |
| T3 | not started | — | — |
| T4 | not started | — | — |
| T5 | not started | — | — |

### 4.1 T1 — Family spine + picker shell + cutaway (**L**)

**Thesis:** prove the whole family system on the smallest honest pair — the existing house
(ported, byte-identical) plus the shed/lean-to (the first NEW structure, exercising a new
roof type) — behind the picker with self-generated thumbnails and the universal cutaway.

**Contents (build in this order):**
1. `types.ts` generalization (§2.3): `StageDef`, `StageId = number`, keep `STAGES`.
2. `bom.ts`: optional `stages` arg (default `STAGES`); `DRESSED ↔ BF_PER_LF` sync test.
3. `gen.ts` (GenOpts), `params.ts` (clamp + seeded sampler), `catalog.ts`, `roles.ts`
   (move PLAIN/WHAT out of the scene; scene imports them).
4. `frame.ts`: `FrameModel` gains `stages` + `footprint` (additive).
5. `structures/house.ts`: `houseDef` — schema mirrors `BuildingInput` (dims, wall ht,
   spacings, pitch, overhang, crawl, foundation, basement depth, bridging, stairs,
   let-in bracing, attic hatch, openings editor); `generate` calls `generateFrame`.
6. `roofs/shed.ts` + `structures/shed.ts`: shed def — stages `1 Layout & posts/piers ·
   2 Floor frame · 3 Deck · 4 Walls · 5 Plates & bracing · 6 Rafters · 7 Sheathing`;
   `walls: 4|3` (3-wall lean-to keeps the open face railed off in schema? no — open);
   reuses `generateFloor`/`generateWalls` with GenOpts.
7. `thumbnail.ts` + snapshot tests.
8. UI: `picker.ts`, `configurator.ts`, routing, scene refactor to `{def, params}`,
   strips conditional on capability, **cutaway toggle + slider**, hub card copy update,
   `woodframe.html` title → "TIMBER-2 — TO construction".
9. Copy this blueprint to `docs/TIMBER2_BLUEPRINT.md` (D18).

**New tests:** `timber2-catalog`, `timber2-house-parity`, `timber2-invariants`
(runs every def × defaults + 8 seeded samples), `timber2-thumbnail`, `timber2-shed`
(shed-roof course-sum across pitches, 3-wall variant has exactly 3 stud walls,
posts reach grade). ≈ +35 tests.

**Acceptance criteria:**
- All 219 legacy tests pass UNEDITED; `npm run verify` and `npm run build:suite` green.
- `timber2-house-parity`: `getStructure('house').generate(defaults).members` deep-equals
  `generateFrame(legacyGolden).members` — the port is provably lossless.
- Picker is the default route; house reached through it has ALL TIMBER-1 behaviors
  (views, scrubber, member card, cut list, strips, model options — now schema-driven).
- Shed: dims/pitch/openings configurable; invariant suite covers it at 8 seeds.
- Cutaway works on both structures at every stage in both ortho and perspective views.
- Thumbnails: pure-function SVG, snapshot-stable, no asset files added to the build
  (grep dist: no new images).
**DEMO the owner sees:** open the deployed `/woodframe.html` → a card grid (house + shed
with crisp line-art thumbnails) → click Shed → drag width and pitch, add a door → scrub
stages → toggle Cutaway and sweep the slider through the building → tap a rafter →
member card with cite. Then back → house card → everything TIMBER-1 did, still there.

### 4.2 T2 — Coverings + built items + the hut family (**L**)

**Thesis:** "go beyond the framing" — skins, built doors/screens, hardware/nails — proven
on the family that needs them most: SEA hut / SWA hut / guard shack.

**Contents:**
1. `covering.ts`: roll roofing (36" courses, 2" laps modeled as exact course tiling with
   lap noted in doctrineRef), corrugated sheets (26" cover width courses), wood shingle
   courses (coarse: per-course members, not per-shingle); wall sheathing; board siding /
   plywood / board-and-batten; fascia + corner trim. All course-tiled exactly (the roof
   sheathing invariant, reused).
2. `built-items.ts`: ledger-and-brace door (fills a door RO: boards, 3 ledgers, diagonal
   brace lower-hinge→upper-latch, T-hinges + hasp hardware members), framed screen panel.
   `Opening` gains optional `fill?: 'ledgerDoor' | 'screen' | 'none'` (additive).
3. `bom.ts`: `classifyNominal`, `roofingSquares`, `hardwareCount`, `nailEstimate` (PH
   rates, footnoted in the stage panel like man-hours).
4. `structures/hut.ts` (+ presets seaHut/swaHut), `structures/guard-shack.ts`.
5. `structures/house.ts` + `structures/shed.ts` gain covering params (roofing + siding
   enums; default 'none' keeps T1 outputs identical — parity test still green).
6. Stage lists gain covering stages (house already has 10 Roofing / 11 Siding — now they
   emit members); roles/dictionaries/DRESSED/BF_PER_LF grow in lockstep (sync tests).
7. UI: openings editor grows the `fill` column; stage panel shows roofing squares +
   nails lbs; picker gains the hut family group.

**New tests:** `timber2-covering` (course sums per slope/wall; siding rects never
intersect opening ROs — the elevation projection makes this a 2D rect test; ripped last
courses; determinism), `timber2-hut` (SEA: screen-band girts present + continuous, pier
posts reach grade, corrugated course count; SWA: full plywood skin, partition wall count;
guard shack: 3 windows + door framing complete), `timber2-bom2` (classes partition member
count; nailEstimate > 0 and (PH)-marked; hardware members carried in cut list). ≈ +40.

**Acceptance criteria:** legacy suite + T1 suites green unedited; house/shed defaults
byte-identical to T1 (coverings default off/none); every covering course-tiles exactly;
hut presets produce the doctrinal outlines (16×32, screen band, built screen doors);
invariant suite auto-covers 3 new defs; deploy green.
**DEMO:** SEA hut card → cutaway sweep shows screen-band girts, built ledger-and-brace
door, corrugated roof over purlins-free sheathing → stage panel shows "Roofing: 9.6
squares · nails ≈ 14 lb (PH rates)" → switch to SWA hut preset → skin changes, BOM follows.

### 4.3 T3 — Vertical: guard tower, ladders/railings/stairs, 2-story house, review posture (**XL**)

**Thesis:** the life-safety tranche. Everything that holds a person off the ground ships
in the same phase as the named review-pending mechanism, so no life-safety member ever
exists without its stamp.

**Contents:**
1. `ls-constants.ts` (§2.5) — every rail/ladder/stair/tower number lives HERE, cited (PH).
2. `types.ts`: `Member.review?: 'life-safety'`; `review.ts`: `reviewSummary`.
3. `docs/TIMBER2_REVIEW_LEDGER.md` — one row per LS_TABLE entry (§6.2); ledger↔table
   1:1 test.
4. `access.ts`: railing, ladder, straight-stair extraction (floor.ts basement stair now
   delegates; existing basement tests are the parity harness — they must not change).
5. `structures/tower.ts`: pads → 6×6 posts (bays sized by `ls('towerMaxUnbracedFt')`) →
   girts + X-braces per bay per face → platform joists + rim → decking → railing all
   sides with ladder gap → ladder → optional shed/gable cap. All railing/ladder/deck
   members `review: 'life-safety'`.
6. `structures/house.ts` stories=2: `generatePlatform` in floor.ts (second-floor joists
   bearing on story-1 plates, rim, subfloor, framed stair opening), story-2 walls via
   GenOpts (idPrefix 'S2-', yBase), interior stair + railing from access.ts, gable moves
   up. Legacy `generateFrame` path untouched (D10).
7. UI: amber badges (picker card, configurator header), member-card chip for flagged
   members, BOM footer review block (§6.2), InstancedMesh for member groups with ≥20
   identical pieces (decking, rungs) behind a mesh-count budget test.

**New tests:** `timber2-access` (rail heights == ls() values; posts ≤ spacing; ladder rung
count/spacing exact; stair extraction parity via basement suite staying green + direct
riser-math equality), `timber2-tower` (posts reach pads; brace endpoints within bays;
railing closes the perimeter minus ladder gap — perimeter-sum test; every flagged role
flagged; height clamp at ls cap), `timber2-stories` (story-2 partition exact; stair
opening framed with doubled trimmers/headers; story-2 wall members carry 'S2-' ids;
2-story ridge above story-2 plates), `timber2-review` (ledger 1:1; reviewSummary text;
no life-safety number literal outside ls-constants in access/tower — source-scan test).
≈ +45.

**Acceptance criteria:** all prior suites green unedited; tower + siteStairs-class
members all flagged and ls()-sourced; review badge/ledger/statement render (pure-fn
tested); regen stays < 50 ms per structure at defaults; scene mesh count within budget
at tower max height; deploy green.
**DEMO:** Guard Tower card wearing the amber LIFE-SAFETY badge → set height to 24 ft →
bays and bracing re-stack → cutaway → click the top rail → member card shows "42 in top
rail (PH cite) · LIFE-SAFETY — review pending: see TIMBER2_REVIEW_LEDGER" → then the
2-story house: scrub stages and watch the second platform, stair, and railing appear.

### 4.4 T4 — Hasty/tent frames + bunker carpentry + site structures (**XL**)

**Thesis:** finish the doctrinal breadth: the expedient/hasty end of the canon and the
carpentry-only bunker family with the SAP-2 boundary made structural.

**Contents:**
1. `structures/strongback.ts` (+ tentDeck preset): deck, knee walls, girts, ridge posts,
   ridgepole, rafters, purlins, screen band, framed end doors.
2. `structures/bunker.ts` (+ postBunker preset): crib walls (alternating interlocked
   courses, corner laps), post-and-beam variant (posts + walers), roof beams + decking,
   framed door; **`coverGhost` annotation member** (§6.3): renders translucent, one
   BOM line "cover — quantity per survivability plan (SAP-2)", ZERO material quantities;
   card carries a "Protective design → SAP-2" link to `../survivability/` (relative,
   offline-safe).
3. `structures/site.ts`: siteStairs (access.ts reuse + railing → life-safety), ramp,
   duckboard, latrineBox.
4. Picker: family grouping headers; roster complete except `custom`.

**New tests:** `timber2-hasty-site` (strongback: ridge continuous, purlin spacing, deck
partition; duckboard slat tiling; ramp slope from rise/run; latrine seat count drives
box length), `timber2-bunker` (crib courses alternate and interlock at corners —
alternating-direction test per course; roof beams bear on walls; **boundary test:**
whole-model scan asserts no member nominal/doctrineRef/nailing in any bunker output
contains a protection quantity pattern (`/thick|standoff|threat|shielding|soil.*(in|ft)/i`
except the ghost's fixed SAP-2 pointer text) and the ghost contributes 0 board-feet,
0 panels, 0 nails). ≈ +35.

**Acceptance criteria:** prior suites green unedited; every roster structure except
`custom` live on the picker with thumbnail + cutaway + stages + BOM; bunker boundary
test green; invariant sampler covers all defs (now ~15 × 8 seeds under the runtime
budget — see risk R1); deploy green.
**DEMO:** bunker card → cutaway shows crib interlock and the ghosted cover slab labeled
"per survivability plan (SAP-2)" with a working link into the toolkit's SAP-2 →
strongback card → stages from bare deck to screened frame → duckboard cut list ready
to hand a fire team.

### 4.5 T5 — Custom composer + roof breadth + polish (**L**)

**Thesis:** "None/Custom — compose exactly the building you want," plus the last roof
type and share/print polish.

**Contents:**
1. `structures/custom.ts`: superset schema — dims, stories 1–2, roof `gable|shed|hip`,
   pitch, overhang, foundation piers/wall/basement, spacings, all coverings, full
   openings editor on all walls with fills, bracing, bridging, attic access, stairs,
   railing options. Composes floor/walls/roofs/covering/access/built-items directly.
2. `roofs/hip.ts`: common + hip + jack rafters (framing-square math per FM 5-426 hip
   chapter (PH)), course-tiled sheathing on four planes. **Parkable** (D14): if it
   overruns its timebox, `custom` ships gable|shed and hip moves to a logged backlog row.
3. Params-in-hash: `#/s/custom?p=<url-safe canonical JSON>` — pure
   `encodeParams/decodeParams` in params.ts, roundtrip-tested; share/reload restores.
4. Polish: print stylesheet for the per-stage cut list (paper-ready), picker search-less
   family nav, USER_GUIDE.md section "TIMBER-2", final (PH) census in the review ledger.

**New tests:** `timber2-composer` (seeded sweep N=40 over the superset schema through the
generic invariants; hip: four-plane course sums + jack rafter lengths shorten
arithmetically; encode/decode roundtrip identity; hash-param clamping — hostile hash
never crashes, always clamps). ≈ +25.

**Acceptance criteria:** full suite green (~219 legacy + ~180 TIMBER-2); every roster
card live; composer survives the 40-seed sweep; URL roundtrip stable; print CSS produces
a legible one-page-per-stage cut list; deploy green; hub copy final.
**DEMO:** Custom card → 24×30, 2 stories, hip 6/12, basement, corrugated roof, board
siding, 3 ledger doors, 6 screened windows → cutaway sweep → print the stage-6 cut
list → copy the URL, open in a fresh tab: same building.

---

## 5. Ports untouched vs refactors, and the test-migration strategy

### 5.1 File dispositions (every touched file named)

| File | Disposition | What changes | Guard |
|---|---|---|---|
| `src/timber/walls.ts` | **UNTOUCHED** | nothing (T-phases compose it via GenOpts wrappers only if needed — wrapper lives in gen.ts, not here) | timber-walls.test.ts |
| `src/timber/roof.ts` | **UNTOUCHED** | nothing (gable stays as-is; new roofs are new files) | timber-frame.test.ts roof cases |
| `src/timber/elevation.ts` | **UNTOUCHED** | nothing (strips capability-gated in UI) | timber-frame.test.ts parity cases |
| `src/ui/three-viewer.ts` (props) | **UNTOUCHED** | nothing (no new GLBs — D15) | build:suite |
| `sap2/**`, `src/engine/**`, all SAP surfaces | **UNTOUCHED** | nothing | their suites |
| `src/timber/types.ts` | EXTENDED | StageDef; StageId→number; Member.review?; roles+DRESSED grow | sync tests; legacy suite |
| `src/timber/frame.ts` | EXTENDED | FrameModel +stages/+footprint (additive); exports preserved | house-parity + legacy suite |
| `src/timber/floor.ts` | EXTENDED | T3: +generatePlatform; stair emission delegates to access.ts (same output) | basement tests stay green unedited |
| `src/timber/bom.ts` | EXTENDED | T1 optional stages arg; T2 classes/squares/hardware/nails (additive fields) | timber-frame BOM tests unedited |
| `src/ui/woodframe.html` | EXTENDED | picker/config containers; title | manual demo + build |
| `src/ui/woodframe-scene.ts` | **REFACTORED** | model injection, roles.ts import, dynamic stages, cutaway, instancing | behaviors re-verified per-phase demo; pure parts (roles, review, thumbnails) node-tested |
| `src/ui/hub.html` | EXTENDED | card copy at T1 | build |
| everything else in §2.6 | **NEW** | — | new suites |

### 5.2 The porting keystone: house parity

`test/timber2-house-parity.test.ts` (T1) asserts
`getStructure('house').generate(houseDefaults).members` **deep-equals**
`generateFrame(legacyGoldenInput).members` — same ids, positions, rotations, stages,
cites. This single test makes the family-system port provably lossless, and it must stay
green through T5 (covering params default to 'none'; stories default to 1). Any
intentional change to house output is a stop-the-line decision-log event.

### 5.3 Test-migration strategy (the 219 stay green)

- **Rule 1 — legacy tests are immutable.** No existing test file is edited in any phase.
  If an implementing session believes one must change, STOP: that means an invariant is
  about to break; write a DECISIONS.md entry proposing it and halt the phase. (Mirrors
  SAP-2's gate discipline.)
- **Rule 2 — additive engine changes only** on files legacy tests import: new exports,
  optional params with legacy-identical defaults, additive result fields. `deepEqual`
  determinism tests compare two fresh calls, so additive fields pass by construction.
- **Rule 3 — every phase adds its suites** under `test/timber2-*.test.ts`; the npm `test`
  glob (`test/*.test.ts`) picks them up with zero config change.
- **Rule 4 — the generic suite is the growth axis** (§5.4): registering a structure
  auto-enrolls it; bespoke files cover only that structure's own doctrine geometry.
- Expected totals: T1 ≈ 254 · T2 ≈ 294 · T3 ≈ 339 · T4 ≈ 374 · T5 ≈ 399, all green.

### 5.4 The generic invariant suite (`timber2-invariants.test.ts`, T1 — grows free forever)

For EVERY def in `STRUCTURES`, at `defaults`, every declared preset, and 8
`sampleParams(schema, defaults, seed)` draws (seeds 1..8, fixed):
1. determinism: `deepEqual(generate(p), generate(p))`;
2. every member: finite position/rotation/cutLength; `cutLength > 0`; unique id;
3. `stage ∈ def.stages` ids; **exact partition**: per-stage BF/panels/members sum to
   totals (via `bomSummary(members, def.stages)`);
4. every emitted role has PLAIN + WHAT entries; every lumber nominal has DRESSED and
   BF_PER_LF entries (panel/conc/roofing/hardware classes exempt by classifyNominal);
5. every member within `footprint` inflated by 1.5× + 60 ft vertical (gross-blowup catch);
6. `doctrineRef` and `nailing` non-empty;
7. `thumbnailSvg` returns identical non-empty strings across two calls;
8. per-def regen time < 50 ms at defaults (budget carried from TIMBER-1).
Runtime budget for the whole suite: < 30 s (see risk R1 for the lever if it grows).

---

## 6. Safety & liability posture (distinct from SAP-2's ship-empty)

### 6.1 The stated boundary

TIMBER-2 **ships working doctrinal defaults WITH cites**. Rationale, stated in-app and in
docs: TIMBER teaches carpentry — cut lengths, layouts, nailing — where the failure mode
of a wrong default is a miscut board, and the cite discipline (`(PH) pending page
verification`) makes every number's provenance visible. This is deliberately NOT SAP-2's
regime: SAP-2's numbers are protection-vs-threat (safety-of-life by nature), so it ships
empty. TIMBER-2 holds that line by (a) stamping its life-safety subset (§6.2) and
(b) refusing to compute protection at all (§6.3).

The existing footer sentence stays on every page: "TO construction per FM 5-426 (public
release). Occupied or permanent structures follow local building code and qualified
review." — extended at T3 with the review-pending statement below.

### 6.2 The named mechanism: the LIFE-SAFETY REVIEW-PENDING stamp

Life-safety numbers = anything whose failure drops or collapses a person: tower platform
heights and bracing limits, guardrail/mid-rail/toeboard dimensions, ladder rung spacing
and rail sizes, stair riser/tread/stringer limits, platform joist selections, and the
span-table defaults when they arrive. Mechanism, in five enforced parts:

1. **Single source:** every such number lives ONLY in `src/timber/ls-constants.ts`, as an
   `LSEntry {id, value, unit, cite, note}`; generators consume via `ls(id)`. A T3
   source-scan test fails if access.ts/tower.ts/site.ts contain a numeric literal for a
   flagged dimension outside `ls()` calls (scan for the governing keys' values).
2. **Member flag:** every member whose geometry a LS number governs carries
   `review: 'life-safety'`; bespoke tests assert the flags per structure.
3. **The ledger:** `docs/TIMBER2_REVIEW_LEDGER.md` — one row per LSEntry: id, value,
   unit, cite (PH), status (`REVIEW PENDING` | `REVIEWED`), reviewer name, date, note.
   Ships all-PENDING. A test parses the table and asserts 1:1 with LS_TABLE ids. Flipping
   a row to REVIEWED requires a named human + date — the same commissioning spirit as
   SAP-2, scaled to TIMBER's regime.
4. **UI surfaces (all fed by `reviewSummary(members)`):** amber badge on picker cards and
   the configurator header for `reviewClass:'life-safety'` structures; an amber chip +
   statement on the member card of any flagged member ("LIFE-SAFETY — review pending ·
   working doctrinal default, see TIMBER2_REVIEW_LEDGER"); a review block in the BOM/cut
   list footer listing flagged stages whenever `pendingCount > 0` (so it prints with the
   paperwork); the page footer statement.
5. **Docs:** this section is copied into `docs/TIMBER2_BLUEPRINT.md`; the ledger is the
   living artifact; DECISIONS.md logs any LS value change.

The stamp NEVER blocks rendering or BOMs (TIMBER is a teaching tool, and the numbers are
cited defaults) — it makes the review debt loud, named, attached to the exact members,
and impossible to ship silently.

### 6.3 The bunker boundary (SAP-2's territory, fenced)

TIMBER-2 models bunker **carpentry**: cribwork, posts, walers, beams, decking, door
framing — members, joints, cut lists. It computes **zero protection values**: no
shielding thickness, no soil-cover depth recommendation, no standoff, no threat rating,
no sandbag counts. The cover layer renders as a single `coverGhost` annotation member
(translucent in-scene, one BOM line reading "cover — quantity per survivability plan
(SAP-2)", zero board-feet/panels/nails), and bunker cards link to `../survivability/`.
Enforced by the T4 boundary test (§4.4) scanning every bunker output for protection-
quantity patterns. Any future request to "just add the cover depth" is answered by the
link, not a number — that is SAP-2's ship-empty regime and it stays there.

---

## 7. Top-10 risks — detection + mitigation

| # | Risk | Detection | Mitigation |
|---|---|---|---|
| R1 | **Combinatorial parameter explosion in testing** (16 structures × dozens of params) | invariant-suite wall-clock in CI (> 30 s = flag); any structure shipping without sampler coverage | The schema IS the fuzz domain (D6): seeded `sampleParams` × fixed seed set per def — coverage grows automatically and boundedly; bespoke tests only for per-structure doctrine; if runtime grows, drop seeds 8→5 per def before ever dropping assertions (logged) |
| R2 | **three.js perf on multi-story/tower scenes** (2–4× member counts, weak laptops) | T3 mesh-count budget test (defaults + max-height tower under a fixed cap); regen < 50 ms test per def; manual FPS check in each phase demo | Per-stage build already culls; T3 adds InstancedMesh for ≥20 identical members (decking, rungs, slats); panels stay merged-scale boxes; never add per-shingle members (courses only, D12); worst case: cap tower height param, log it |
| R3 | **Thumbnail pipeline determinism / asset bloat** | thumbnail snapshot tests; dist scan for image assets in build gate | Killed by construction (D2): thumbnails are runtime SVG from a pure engine projection — no build-time renders, no headless GL, no image files, no base64, nothing for the deploy to OOM on |
| R4 | **Stage-model generalization breaks the exact-partition invariant** | house-parity test; generic partition assertion per def per sample; legacy BOM tests unedited | Per-structure stage lists with the house frozen at ids 1..11 (D1/D3); `bomSummary` default arg preserves legacy semantics; partition asserted structure-generically forever |
| R5 | **Doctrine-cite debt** — (PH) pages never verified, debt now multiplies across the canon | (PH) census printed in the review ledger at T5; cite-integrity assertions (non-empty doctrineRef on every member) | Debt is explicit and bounded: every cite names its pub + the (PH) marker; life-safety subset additionally ledgered with named-reviewer rows (§6.2); verification is an owner task with a single checklist artifact, exactly like SAP-2's fill — never silently "done" |
| R6 | **Scope creep into SAP-2's survivability territory** (bunker cover, revetments, OHC) | T4 boundary test scanning bunker outputs; PR review against §6.3 | The boundary is structural: coverGhost + SAP-2 link + zero protection quantities; revetments/OHC are OUT of TIMBER's roster by decision D8 — requests route to SAP-2 |
| R7 | **Deploy memory regression** (the base64-inline OOM, once bitten) | `build:suite` run at every phase merge; dist scan shows no new asset files; watch vite transform step in deploy logs | No new assets at all (D2, D15): thumbnails are code, roofing is box meshes, props are the existing GLBs; `assetsInlineLimit: 4096` in vite.suite.config.ts is load-bearing and never raised; sourcemaps stay off |
| R8 | **Single-maintainer fatigue** (five phases, one owner, other sessions building) | progress table (§4.0) stalls > 4 weeks on a phase; a phase exceeds 2× its effort class | Every phase is independently shippable and the product is coherent from T1 (park anytime, zero debt); after T3 the mandate's core is standing; overrun rule: descope to presets-only for the remaining structures of that phase, log it, ship; hip roof pre-marked parkable (D14) |
| R9 | **UI-shell rewrite regresses the working viewer** (picker refactor touches the one file with no unit tests) | per-phase demo checklist (§8.5) exercises every TIMBER-1 behavior; house-parity guarantees the model side | Scene refactor is confined to injection points (globals → `current`); all NEW logic that can be pure (roles, review text, thumbnails, param clamp/encode) lives in the engine and is node-tested; picker/configurator are additive files |
| R10 | **Geometry-honesty debt multiplies across generators** (approximation shortcuts — hip jacks, crib laps, screen bands — quietly wrong) | invariant #5 (bounding box), bespoke bearing/tiling tests per structure; member-card cites read during demos | The TIMBER-1 "placement honesty + ponytail note" convention is mandatory per generator (§8.2 I-13): every known approximation is written at the top of the file and surfaced in doctrineRef where it matters; course-sum/bearing tests are required per new roof/deck; gross errors cannot pass the sampler |

---

## 8. IMPLEMENTATION HANDOFF KIT

### 8.1 Commands (verbatim)

```bash
npm run typecheck                                  # tsc --noEmit
npm test                                           # full suite (node --test, test/*.test.ts)
node --import tsx --test test/timber2-*.test.ts    # focused TIMBER-2 suites
node --import tsx --test test/timber-*.test.ts     # legacy TIMBER-1 suites (must stay green)
npm run verify                                     # typecheck + test + check:offline
npm run build:suite                                # THE deploy build (hub + woodframe + sap2) — must pass at every merge
npm run dev                                        # vite dev server; open /woodframe.html
```

### 8.2 Invariants that must NEVER break (all phases; treat as gates)

- **I-1 Engine purity:** `src/timber/**` imports no DOM, no three.js, no Date/random.
- **I-2 Determinism:** every generator deep-equals itself on repeated identical calls.
- **I-3 Single source of truth:** scene/BOM/2D/thumbnails only PROJECT `Member[]`; no
  downstream geometry invention (the coverGhost is a Member for exactly this reason).
- **I-4 Exact BOM partition:** per-stage sums equal totals, for every structure, always.
- **I-5 Unique, stable member ids** (GenOpts idPrefix across stories/sub-assemblies).
- **I-6 Member completeness:** finite numbers; cutLength > 0; stage ∈ model.stages;
  doctrineRef and nailing non-empty on every member.
- **I-7 House parity:** catalog 'house' at defaults ≡ legacy `generateFrame(golden)`.
- **I-8 Legacy tests immutable:** the 219 files are never edited, only added to (§5.3).
- **I-9 Offline:** zero external URLs in src or dist (`check:offline` gate); zero runtime
  deps beyond `three`; no fetch/XHR/WebSocket anywhere in the timber surface.
- **I-10 Deploy:** `npm run build:suite` green at every merge; assets ship as files;
  `assetsInlineLimit` in `vite.suite.config.ts` is never raised; no new asset files
  without a decision-log entry.
- **I-11 Life-safety numbers only in `ls-constants.ts`**, each with a ledger row, each
  governing member flagged `review: 'life-safety'` (from T3).
- **I-12 Bunker boundary:** no protection quantity ever computed or printed by TIMBER (§6.3).
- **I-13 Placement honesty:** every generator documents its approximations in a header
  note ("ponytail" convention) and never fakes joinery it doesn't model.
- **I-14 Dictionaries in lockstep:** every emitted role has PLAIN/WHAT; every lumber
  nominal has DRESSED + BF_PER_LF (sync tests enforce).

### 8.3 The phase ritual (identical every phase)

1. `npm run verify && npm run build:suite` — confirm the green baseline. Red ⇒ stop.
2. Read §4.[n] + your START HERE below. Write the phase's FIRST test (listed there) red.
3. Implement engine-first (pure modules + tests), UI last.
4. Run the focused suites, then `npm run verify`, then `npm run build:suite`.
5. Walk the DEMO script yourself in `npm run dev`; check §8.5's checklist.
6. Update §4.0 progress table (in `docs/TIMBER2_BLUEPRINT.md`), append `DECISIONS.md`
   entries for every judgment call, commit.

### 8.4 Per-phase START HERE

**T1:** Read `types.ts`, `frame.ts`, `bom.ts`, `woodframe-scene.ts` fully. FIRST TEST:
`timber2-house-parity.test.ts` — write it against a not-yet-existing
`getStructure('house')` (red), then build catalog/params/gen + house def until green
with ZERO legacy edits beyond §5.1's additive list. Then shed (engine, tests), then
thumbnail.ts (snapshot test), then the UI shell + cutaway, hub copy last. Trap to avoid:
do NOT rename or move `STAGES`; do NOT touch walls/roof/elevation.

**T2:** Read `roof.ts` stage-9 course tiling and the subfloor stagger sweep in
`floor.ts` — coverings reuse both patterns. FIRST TEST: covering course-sum for roll
roofing over the house gable at 3 pitches. Keep house/shed covering defaults 'none' so
the T1 parity test never notices. Hardware members: cutLength = physical length, class
'hardware', BF 0. Then hut.ts (SEA preset first — it exercises piers + screen band +
corrugated at once), guard shack last.

**T3:** Read `floor.ts` stair emission (lines ~427–452) before extracting it. FIRST
TEST: run the legacy basement suites, then write `timber2-access` stair-parity asserting
the extracted `generateStraightStair` reproduces the basement stair members — then
delegate floor.ts to it. Then ls-constants + ledger + review (small, high-leverage),
then railing/ladder, then tower, then stories=2 (the largest chunk — platform first,
walls-with-GenOpts second, stair third), UI badges last. Trap: story-2 member ids MUST
carry the 'S2-' prefix or uniqueness breaks.

**T4:** FIRST TEST: the bunker boundary test (red until bunker.ts exists — it defines
the fence before the structure). Crib generator: emit per-course timbers with alternating
orientation and corner laps; keep the interlock a placement convention (honesty note),
not fake notch geometry. Strongback reuses shed-roof math for the fly-less frame. Site
structures are small — do them last as finishers.

**T5:** FIRST TEST: composer sweep (seeds 1..40) through the generic invariants — write
it against the custom def skeleton, then grow the schema until the sweep is green. Hip
roof second (timeboxed; park per D14 if it fights back). URL params last (pure
encode/decode + clamp, then the two lines of hash wiring).

### 8.5 Definition of Done (every phase) + demo checklist

A phase is DONE when ALL of:
1. `npm run verify` green (legacy 219 + all prior TIMBER-2 suites + this phase's, unedited priors).
2. `npm run build:suite` green; `dist/` gains no image/binary assets (grep).
3. The phase's §4 acceptance criteria each individually checked off.
4. The DEMO script runs clean in a browser, PLUS this standing checklist on ONE
   structure of the phase: picker card renders with thumbnail → configure two params →
   all stages scrub → cutaway sweeps → member card shows cite (+ review chip if
   flagged) → cut list shows the stage's lines → back link returns to picker → hub
   link returns to the toolkit.
5. `docs/TIMBER2_BLUEPRINT.md` progress table updated; `DECISIONS.md` appended
   (`TIMBER-2 Tn:` entries); review ledger updated if LS_TABLE changed.
6. No TODO left in code without a matching backlog line in the progress table notes.

---

## 9. Decisions log (D1–D18)

- **D1 Registry + per-structure stage lists.** One `StructureDef` registry; each
  structure declares its own doctrinal build order; the house keeps the global `STAGES`
  (ids 1..11) verbatim so the legacy suite never moves. Partition invariant asserted
  generically against `def.stages`.
- **D2 Thumbnails are runtime SVG line-art from the engine's own projection.** No
  build-time renders, no headless GL, no image assets, no base64 — the deploy-memory and
  determinism risk classes die by construction; thumbnails are pure functions,
  snapshot-tested in node.
- **D3 `StageId` loosens to `number`.** Bounded by per-model `StageDef[]` sets and the
  generic membership assertion; the literal-union safety it loses is re-provided by tests.
- **D4 Legacy house path frozen.** `generateFrame`/`BuildingInput` keep exact behavior;
  the catalog wraps them; `timber2-house-parity` locks it member-for-member.
- **D5 Cutaway = scene-level clipping plane.** One implementation, every structure and
  stage inherits it free; 2D sections fall out of ortho views + the plane. No engine change.
- **D6 One schema drives UI and fuzz.** `ParamDesc[]` renders the configurator AND feeds
  the seeded sampler — the clickable surface and the tested surface are the same set by
  construction.
- **D7 Life-safety mechanism** = `ls-constants.ts` single source + `Member.review` flag +
  named ledger doc + amber UI badges + BOM footer block + 1:1 and source-scan tests (§6.2).
- **D8 Bunker boundary.** TIMBER models bunker carpentry only; cover is a zero-quantity
  ghost annotation linking to SAP-2; revetments/OHC excluded from the roster entirely;
  enforced by a scanning test, not convention.
- **D9 Presets over generators.** SEA/SWA huts share `hut.ts`; equipment shed, tent deck,
  post bunker are presets — 16 cards from 10 generators keeps the maintenance surface honest.
- **D10 Stories composition lives in `structures/house.ts`.** `generateFrame` stays the
  frozen 1-story assembly; stories=2 composes floor/platform/walls/roof directly with
  GenOpts prefixes. Slight duplication bought provable legacy safety.
- **D11 Hardware are Members.** cutLength = physical length, material class 'hardware',
  0 BF — so hinges/hasps ride the same partition invariant and cut-list linkage as lumber.
- **D12 Coverings are exact-tiled courses, never per-piece.** Roll/corrugated/shingle
  emit per-course members with the ripped-last-course rule — the roof-sheathing invariant
  reused; per-shingle members are banned for perf (R2).
- **D13 Param URLs deferred to T5.** T1 routing carries structure id only; share links
  are polish, not spine.
- **D14 Hip roof is IN but parkable.** Scheduled T5 with a timebox; parking it leaves
  `custom` on gable|shed with a logged backlog row — the plan is complete without it.
- **D15 Zero new runtime deps, zero new GLB props.** three.js only; new materials render
  as toon boxes; the existing lumber/plywood props cover all stock.
- **D16 Legacy tests immutable + stop-the-line.** Any needed edit to a legacy test is
  an invariant break: halt, write the DECISIONS entry, get the change acknowledged in
  the blueprint before proceeding.
- **D17 Thumbnails computed at picker load, cached in-memory per StructureId.** No
  persistence, no staleness class; ~16 generations of default models is well inside the
  50 ms/def budget.
- **D18 This blueprint is copied into the repo at T1** as `docs/TIMBER2_BLUEPRINT.md`
  and becomes the living artifact (progress table, ledger pointers) — implementing
  sessions update the repo copy, not the scratchpad original.

---

## 10. Kill / park criteria

- **P1 (park-anytime):** the product is coherent at the end of EVERY phase; parking after
  T1/T2/T3 leaves a shipped, documented, green toolkit with no dangling debt (the
  progress table records the stop).
- **P2 (phase overrun):** a phase exceeding 2× its effort class descopes to
  presets-only for its remaining structures, logs the cut, and ships.
- **K1 (perf):** if tower/2-story scenes cannot hold interactive FPS on the owner's
  hardware after instancing (R2), cap the offending params (height/stories) at the
  largest smooth value and log it — TIMBER never ships a janky viewer to protect a
  parameter range.
- **K2 (review posture):** if the owner ever wants TIMBER outputs treated as build-to
  field documents (not teaching aids), STOP — that is a regime change requiring the
  SAP-2-style commissioning conversation, not a TIMBER phase.

*End of blueprint.*
