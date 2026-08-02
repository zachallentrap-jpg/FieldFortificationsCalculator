# TIMBER-2 — PARAMETRIC ENGINE: STRUCTURE-FAMILY SYSTEM DESIGN

> **Status:** Handoff-quality implementation blueprint for growing `src/timber` from one
> `generateFrame(BuildingInput)` into a structure-family system (buildings, huts, towers,
> bunkers, tent frames) with a picker UI, per-family stages, universal cutaway, and
> self-generated thumbnails. Written to the SAP2_BLUEPRINT quality bar: every decision
> logged (§12), phases with acceptance criteria and kill criteria (§11), per-file layout
> and exact signatures throughout. Implementing sessions execute phases P0–P6 in order;
> the planner is not present — where this document and the code disagree after P0 lands,
> the invariants in §9 govern, then this document, then taste.
>
> **Non-negotiables carried from the deploy regime:** fully offline (build gate scans
> dist for external URLs), zero runtime deps beyond three.js, deterministic outputs,
> everything ships in the one toolkit deploy (hub + /woodframe.html + /survivability/),
> picker images self-generated, and no build-time memory balloons (a base64-inline OOM
> already bit this repo once — new assets ship as files or, per this design, as
> runtime-generated inline SVG that never touches the bundler's asset path).
>
> **Doctrine posture (stated up front, §8):** TIMBER-2 ships **working doctrinal
> defaults with `(PH) pending page verification` cites** — the existing TIMBER-1
> discipline — explicitly UNLIKE SAP-2's ship-empty regime. The boundary: TIMBER is a
> teaching/planning visualizer of public-release TO construction methods (FM 5-426
> spine), not a certified design tool; life-safety numbers (tower rails, platform loads,
> stringer spans, stair/ladder limits) additionally route through a named
> **LIFE-SAFETY REVIEW REGISTER** (§8.3) with a standing UI banner — never silent
> defaults.

---

## 0. How to use this document

- **§1** maps the owner's mandate to testable requirements.
- **§2** inventories today's code and states, file by file, what ports untouched vs
  what refactors (the compat contract).
- **§3–§9** are the seven commissioned deliverables: types, generators, stages,
  viewer/cutaway, thumbnails, doctrine, tests.
- **§10** is the directory tree and call graph. **§11** is the phase plan. **§12** the
  decisions log. **§13** risks and kill criteria.
- Code fences are **normative signatures**: implementers keep names, field names, and
  shapes exactly unless a logged decision in the repo's DECISIONS.md supersedes them.
- "Compat-locked" means: guarded by `test/timber2-compat.test.ts` (§9.2) plus the three
  existing suites (`timber-frame`, `timber-walls`, `timber-features`), which are **never
  edited** — 219 tests stay green through every phase.

---

## 1. Mandate → requirements

| # | Owner's mandate (verbatim intent) | Requirement | Where |
|---|---|---|---|
| M1 | "Different types of structures, different types of roofs, different numbers of stories, all the variables… ALL in the rough construction that the USMC would ever use." | `StructureSpec` discriminated union over five families (building/hut/tower/bunker/tentFrame); `RoofSpec` union (gable/shed/hip/flat/none); `stories: StorySpec[]` with a platform-framing loop; a doctrinal preset catalog. | §3, §4.5, catalog §3.6 |
| M2 | "Go beyond the framing seriously in every way" — foundations/concrete, sheathing, roofing, siding, built doors/windows, stairs/ladders/railings, hardware/nails. | Subsystems: `foundation` (6 kinds incl. slab/skids/embedded), `coverings` (wall sheathing, siding, roof deck, roofing, screens), `builtOpenings` (ledger-and-brace doors, framed screens, shutters), `stairsLadders`, `railings`; structured fastener metadata + nail roll-up (P6). | §4.3, §4.4, §9 |
| M3 | Sub-app opens on a STRUCTURE PICKER — cards with images; "None/Custom" opens the fully customizable option set. | Picker screen with runtime-generated SVG thumbnails per catalog entry; "Custom" card opens the `building` family with every knob exposed (D5). | §6.5, §7 |
| M4 | Named types: guard towers, hut family exhaustively (SEA hut, SWA/plywood hut, B-hut, guard shacks…), hasty structures (strongback tent frames), bunkers, "etc". | Family generators + catalog entries for each named type with standard-design cites; hut variants typed. | §3.4, §3.6, §8.4 |
| M5 | EVERY structure has a cutaway view option. | Clip-plane cutaway in the scene layer (D2), family-agnostic, with raycast side-filtering so member cards still work through a cut. | §6.2 |
| M6 | Minute control: dimensions, counts of doors/windows/openings, roof type, "type of everything." | Per-wall `OpeningSpec[]` lists; every spec field surfaced by the schema-driven config panel; `normalizeSpec` clamps to doctrinally sane ranges with visible issues, never silent NaN. | §3.2, §3.7, §6.5 |
| M7 | The deliverable is the plan; other sessions implement phase-by-phase. | This document: exact modules, signatures, per-phase contents + acceptance + kill criteria + named test files. | whole doc |

---

## 2. Ground truth inventory and disposition

Current engine (all pure, no DOM/three.js): `src/timber/{types,frame,floor,walls,roof,elevation,bom}.ts`.
Current render layer: `src/ui/woodframe-scene.ts` + `woodframe.html` (standalone vite entry,
`vite.woodframe.config.ts`; ships in the suite via `vite.suite.config.ts`).
Current tests: `test/timber-frame.test.ts`, `test/timber-walls.test.ts`, `test/timber-features.test.ts`.

### 2.1 Ports UNTOUCHED (byte-identical or additive-only)

| File | Status |
|---|---|
| `src/timber/types.ts` — `Member` interface | **Shape unchanged.** `MemberRole` union grows (additive, §4.7); `DRESSED` gains sizes (additive, §14.2); `STAGES` const stays exported verbatim (§5.2); `StageId` widens from the literal union to `number` (value-level assertions in tests unaffected). Optional additive field `fasteners?` (P6, D10). |
| `src/timber/frame.ts` — `BuildingInput`, `FrameModel`, `generateFrame`, re-exports | **Public API frozen.** Body becomes a delegation to `generateStructure(specFromBuildingInput(input))` once the compat test proves member-for-member equality (P0); until then it keeps calling the extracted subsystems directly. Either way its exports and behavior are compat-locked. |
| `src/timber/bom.ts` — `cutList`, `boardFeet`, `bomSummary` | Aggregation logic untouched. `bomSummary` gains an **optional** second param `plan?: StagePlanEntry[]` (default = legacy building plan ⇒ existing call sites and tests unchanged); `BF_PER_LF` gains sizes; labor constants move to `doctrine.ts` with identical values (light-touch, compat-locked). |
| `src/timber/elevation.ts` — `wallElevation`, `layoutStrip` | Math untouched. Gains optional trailing params (`story?: number`, `vBaseFt?: number`) defaulting to today's behavior (additive). New wall roles fall into the existing else-branch projection. |
| `test/timber-*.test.ts` (all three) | **Never edited.** They are the compat oracle. |
| `src/ui/three-viewer.ts` props (`lumberPiece`, `plywoodSheet`, `toonGradient`, `onPropAssetsReady`, `disposeObject`) | Untouched; consumed as-is. Its cutaway pattern (lines ~1030–1260) is the reference implementation ported into `src/ui/woodframe/cutaway.ts`, not modified in place. |
| Build/deploy: `vite.woodframe.config.ts`, `vite.suite.config.ts`, `scripts/check-offline.ts`, `scripts/build-suite.mjs` | Unchanged. TIMBER-2 adds **no build steps and no assets** (thumbnails are runtime SVG, D3). |

### 2.2 REFACTORS (behavior-locked by the compat suite)

| File | Refactor |
|---|---|
| `src/timber/floor.ts` | Body splits into `foundation.ts` (stages 1–2: footings/pads/walls/slab/posts + sills/girder) and `floorSystem.ts` (stages 3–4: joists/bridging/rims/deck + framed openings), with the basement stair emission moving to `stairsLadders.ts`. `floor.ts` remains as a thin wrapper exporting `generateFloor`, `floorLevels`, `stairPlan`, `layoutCenters` with identical signatures and identical output (member values AND array order). |
| `src/timber/walls.ts` | Body moves to `wallSystem.ts` (generalized: per-wall heights, girt rows, band-aware openings). `walls.ts` keeps `generateWalls`, `Opening`, `WallsInput` exactly (timber-walls.test.ts imports them directly). |
| `src/timber/roof.ts` | Body moves to `roofFamilies/gable.ts` + `roofFamilies/ceiling.ts` (ceiling joists + scuttle) + roof-deck course math into `coverings.ts`. `roof.ts` keeps `generateRoof` with identical output/order. |
| `src/ui/woodframe-scene.ts` | Splits into `src/ui/woodframe/{picker,config,studio,camera,cutaway,labels}.ts` with `woodframe-scene.ts` as the boot/wiring entry (same script tag in `woodframe.html`). Member card markup, PLAIN/WHAT dictionaries, strips, and stage-panel behavior are ported verbatim then extended additively. |

**Extraction rule (P0):** moved code is cut-and-paste plus parameterization only — no
"improvements" ride along. Every extraction lands with the compat suite green in the
same commit.

---

## 3. TYPE SYSTEM (deliverable 1)

All types live in `src/timber/spec.ts` unless noted. Everything is plain data —
JSON-serializable, no functions, no classes — so specs can be stored in the catalog,
hashed for thumbnail goldens, and diffed in tests.

### 3.1 Shared primitives

```ts
// src/timber/spec.ts
import type { WallId } from './types';           // 'N' | 'S' | 'E' | 'W' (unchanged)
import type { BridgingType } from './floor';     // 'cross' | 'solid' (unchanged)

export interface Dims { lengthFt: number; widthFt: number }   // plan footprint; X = length, Z = width

export interface SpacingSpec {
  studSpacingIn: 12 | 16 | 24;
  joistSpacingIn: 12 | 16 | 24;
  rafterSpacingIn: 12 | 16 | 24;
}
// NOTE: widened from 16|24 to 12|16|24 (additive on the input side; layoutCenters already
// handles any positive OC). BuildingInput keeps its 16|24 — the adapter upcasts.

export type OpeningKind = 'door' | 'window' | 'vent' | 'screen' | 'hatch' | 'embrasure';
export type BuiltKind   = 'none' | 'ledgerDoor' | 'framedScreen' | 'shutter';

export interface OpeningSpec {
  kind: OpeningKind;
  offsetFt: number;        // wall-left (viewed from outside) to RO left edge — same convention as today
  widthFt: number;         // rough opening width
  heightFt: number;        // rough opening height
  sillHeightFt: number;    // RO bottom above sole-plate top; 0 ⇒ door-style (no sill/cripples below)
  headerNominal?: string;  // default '2x6' doubled (unchanged)
  built?: BuiltKind;       // TO-built leaf/screen/shutter emitted at the exterior-finish stage (P3)
}

/** Per-wall placement lists — the mandate's "number of doors and windows" control. */
export type WallOpenings = Partial<Record<WallId, OpeningSpec[]>>;

export type RoofSpec =
  | { kind: 'gable'; risePer12: number; overhangFt: number }
  | { kind: 'shed';  risePer12: number; overhangFt: number; highSide: WallId }
  | { kind: 'hip';   risePer12: number; overhangFt: number }
  | { kind: 'flat';  overhangFt: number; drainPer12?: number }  // default 0.25; implemented as shed (D7)
  | { kind: 'none' };                                            // open-top (tower deck without cap)

export type FoundationSpec =
  | { kind: 'piers';    crawlFt: number }
  | { kind: 'wall';     crawlFt: number }
  | { kind: 'basement'; depthFt: number; stairs: boolean }
  | { kind: 'slab' }                                   // slab-on-grade; sole plates anchor to slab
  | { kind: 'skids';    skidNominal?: string }         // hasty: 4x6 skids on grade (tent frame, shack)
  | { kind: 'embedded'; embedFt: number };             // posts set in augered holes (tower/bunker)

export interface StorySpec {
  wallHeightFt: number;
  openings: WallOpenings;
  letInBracing?: boolean;
}

export interface CoveringSpec {
  wallSheathing: 'none' | 'plywood' | 'boards';
  siding:        'none' | 'plywood' | 'boards' | 'boardAndBatten';
  roofDeck:      'none' | 'plywood' | 'boards' | 'skip';        // skip = spaced 1x sheathing
  roofing:       'none' | 'roll' | 'corrugated' | 'shingles';
}

export type AccessSpec =
  | { kind: 'none' }
  | { kind: 'ladder'; railNominal?: string }           // vertical/steep ladder, cleat rungs
  | { kind: 'stairs'; railings: boolean }              // straight run, doctrinal riser math
  | { kind: 'shipLadder' };                            // 60–75 deg, treads not rungs

export interface RailingSpec {
  topRailHeightIn?: number;  // default doctrine.RAIL.topHeightIn (LIFE-SAFETY, §8.3)
  midRail?: boolean;         // default true
  toeboard?: boolean;        // default true
}
```

### 3.2 The discriminated union

```ts
interface SpecCommon {
  dims: Dims;
  spacing?: Partial<SpacingSpec>;      // per-family doctrine defaults fill the gaps (§8)
  coverings?: Partial<CoveringSpec>;   // per-family defaults fill the gaps
}

export interface BuildingSpec extends SpecCommon {
  family: 'building';
  stories: StorySpec[];                // length 1..2 in v1 (D14; normalizeSpec clamps)
  roof: RoofSpec;
  foundation: FoundationSpec;
  bridging?: BridgingType;
  atticAccess?: boolean;
  interiorStairs?: boolean;            // default: stories.length > 1
}

export interface HutSpec extends SpecCommon {
  family: 'hut';
  variant: 'seaHut' | 'swaHut' | 'bHut' | 'guardShack';
  wallHeightFt?: number;               // default per variant from doctrine.HUT
  screenBand?: { sillFt: number; heightFt: number } | null;  // SEA-hut screen sidewall; null = solid
  shutters?: boolean;                  // hinged plywood flaps over window ROs
  openings?: WallOpenings;             // default per variant (end doors etc.)
  roof?: RoofSpec;                     // default per variant (gable low-pitch; SWA often shed)
  foundation?: FoundationSpec;         // default piers (guardShack: skids)
}

export interface TowerSpec extends SpecCommon {
  family: 'tower';
  platformHeightFt: number;            // grade to platform deck top; v1 cap 25 ft (D14/§8.3)
  postCount?: 4 | 6;                   // default 4; 6 when lengthFt >= 10
  postNominal?: string;                // default '6x6'
  bracing?: 'x' | 'k';                 // default 'x'
  access?: AccessSpec;                 // default { kind: 'ladder' }
  railing?: RailingSpec;               // always emitted unless enclosureKneewallFt >= rail height
  roof?: RoofSpec;                     // default shed cap over the deck; 'none' allowed
  enclosureKneewallFt?: number;        // framed parapet wall around the deck; 0 = rails only
  foundation?: Extract<FoundationSpec, { kind: 'embedded' | 'piers' }>; // default embedded 4 ft
}

export interface BunkerSpec extends SpecCommon {
  family: 'bunker';
  clearHeightFt: number;               // interior clear under stringers
  soilCoverFt: number;                 // drives stringer size/spacing via doctrine table — LIFE-SAFETY
  postNominal?: string;                // default '6x6'
  wallPlanking?: 'horizontal' | 'none';// retaining planking between posts
  embrasures?: WallOpenings;           // kind 'embrasure' only (normalizeSpec enforces)
  entry?: 'open' | 'baffle';
  retaining?: 'none' | 'crib';         // crib retaining walls at the entry / rear (cribwork.ts)
  showSoilCover?: boolean;             // massing member for the earth layer (0 BF, §4.4.8)
}

export interface TentFrameSpec extends SpecCommon {
  family: 'tentFrame';
  sidewallFt?: number;                 // strongback kneewall height, default doctrine.TENT
  ridgeFt?: number;                    // ridge height, default per GP-medium proportions
  deck?: boolean;                      // floor deck on skids (default true)
  endDoors?: boolean;                  // framed end-wall door(s) (default true)
}

export type StructureSpec  = BuildingSpec | HutSpec | TowerSpec | BunkerSpec | TentFrameSpec;
export type StructureFamily = StructureSpec['family'];   // 'building'|'hut'|'tower'|'bunker'|'tentFrame'
```

**Family rationale (D4, D5, D15):** `hut` is a real family (not just building presets)
because its spec carries typed hut-only options (screen band, shutters, variant defaults)
and its generator emits hut-only members (girts, screen panels, shutter/leaf assemblies) —
but it composes the SAME subsystems as `building`. "Custom" in the picker is the
`building` family with every knob exposed — there is no sixth generator. Cribwork is a
subsystem (used by bunker `retaining:'crib'`, available to future revetments), not a family.

### 3.3 The model

```ts
export interface LevelInfo {
  gradeY: number;                 // ground plane (render layer's lawn)
  sillTop?: number;               // present for framed-floor foundations
  slabTop?: number;               // basement/slab
  storyFloorTopY: number[];       // y of each story's finished deck top (index 0 = first floor; [0] === 0 for framed floors)
  platformTopY?: number;          // towers: deck top
  maxY: number;                   // highest member top (ridge/rail/cap) — cameras and thumbs key off this
}

export interface StagePlanEntry { id: number; key: StageKey; name: string; story?: number } // §5

export interface StructureModel {
  spec: StructureSpec;            // the normalized spec that generated it
  members: Member[];              // THE single source of truth, unchanged discipline
  levels: LevelInfo;
  stagePlan: StagePlanEntry[];    // ordered; Member.stage is a 1-based ordinal into this
  issues: SpecIssue[];            // normalization clamps/notes (never throws for in-range UI values)
}

export function generateStructure(spec: StructureSpec): StructureModel;  // families/index.ts
```

`FrameModel` (legacy) is untouched; `FrameModel.levels: FloorLevels` remains. `LevelInfo`
is a superset shape; `families/building.ts` fills both views from the same numbers.

### 3.4 Migration: how `BuildingInput` maps in

```ts
// src/timber/spec.ts
export function specFromBuildingInput(i: BuildingInput): BuildingSpec {
  const perWall: WallOpenings = {};
  for (const o of i.openings) {
    (perWall[o.wall] ??= []).push({
      kind: o.sillHeightFt === 0 ? 'door' : 'window',
      offsetFt: o.offsetFt, widthFt: o.widthFt, heightFt: o.heightFt,
      sillHeightFt: o.sillHeightFt, headerNominal: o.headerNominal,
    });
  }
  return {
    family: 'building',
    dims: { lengthFt: i.lengthFt, widthFt: i.widthFt },
    spacing: { studSpacingIn: i.studSpacingIn, joistSpacingIn: i.joistSpacingIn, rafterSpacingIn: i.rafterSpacingIn },
    stories: [{ wallHeightFt: i.wallHeightFt, openings: perWall, letInBracing: i.letInBracing }],
    roof: { kind: 'gable', risePer12: i.risePer12, overhangFt: i.overhangFt },
    foundation:
      i.foundation === 'basement' ? { kind: 'basement', depthFt: i.basementDepthFt ?? 7.5, stairs: i.stairs ?? true }
      : i.foundation === 'wall'   ? { kind: 'wall', crawlFt: i.crawlFt }
      :                             { kind: 'piers', crawlFt: i.crawlFt },
    bridging: i.bridging,
    atticAccess: i.atticAccess,
    coverings: { wallSheathing: 'none', siding: 'none', roofDeck: 'plywood', roofing: 'none' },
  };
}
```

**No-breakage mechanics (P0 acceptance):**
1. `generateFrame(input)` keeps its exact signature and keeps returning `FrameModel`.
2. After extraction, `generateStructure(specFromBuildingInput(g))` must produce a
   `members` array **deep-equal member-for-member AND in the same array order** as
   `generateFrame(g)` for the golden inputs and the full option matrix in
   `timber-features.test.ts` (compat test §9.2). Order is preserved by contract C-6
   (§4.2). If literal order equality proves impossible without contortions, the logged
   fallback (D12) is set-equality plus per-member field equality — invariants never relax.
3. Only then does `frame.ts`'s body switch to delegation. The three legacy test files
   pass untouched before and after.
4. `stairPlan`, `FoundationType`, `BridgingType` re-exports from `frame.ts` persist
   (`stairPlan` now lives in `stairsLadders.ts`; `floor.ts` and `frame.ts` both re-export).

### 3.5 Spec normalization (the "minute control" safety net)

```ts
export interface SpecIssue { path: string; msg: string; severity: 'error' | 'clamped' }

/** Deterministic. Fills family defaults (doctrine module), clamps to sane ranges
 *  (dims 4..60 ft, stories<=2, tower platform<=25 ft, pitch 0..12, openings within wall
 *  runs, opening kinds legal for the family), sorts each wall's openings by offsetFt,
 *  and reports everything it did. Generators require normalized specs;
 *  generateStructure() normalizes internally so callers can't skip it. */
export function normalizeSpec(spec: StructureSpec): { spec: StructureSpec; issues: SpecIssue[] };
```

Clamping (not throwing) keeps the config UI honest: any slider position yields a valid
deterministic model plus a visible issue chip. `severity:'error'` is reserved for
impossible topology (e.g. opening wider than its wall) — the generator then drops that
opening and says so; it never emits NaN (locked by the sweep suite §9.4).

### 3.6 The catalog (presets = data, cites required)

```ts
// src/timber/catalog.ts
export interface CatalogEntry {
  id: string;                    // stable slug: 'sea-hut-16x32'
  name: string;                  // 'SEA hut, 16 × 32'
  blurb: string;                 // one picker-card sentence
  cite: string;                  // standard-design lineage cite, (PH) discipline (§8.4)
  spec: StructureSpec;           // complete, normalized-in-test
  custom?: boolean;              // true only for the 'custom' card (opens configurator first)
}
export const CATALOG: CatalogEntry[];
```

v1 catalog (order = picker order): `house-20x16` (today's demo building, gable, piers),
`house-2story-24x20`, `sea-hut-16x32`, `swa-hut-16x32` (plywood, shed roof),
`b-hut-16x36`, `guard-shack-8x8` (skids), `tower-obsn-10ft`, `tower-obsn-20ft` (6-post),
`bunker-mg-12x8`, `tentframe-gp-medium-16x32`, `custom` (building family, `custom:true`).
Additional doctrinal types (latrine/shower shells, storage sheds) enter as catalog
entries over the `building`/`hut` families — new presets are data-only PRs.

### 3.7 Config schema (drives the "Custom"/per-family forms)

```ts
// src/timber/configSchema.ts  (pure data+functions; UI renders it, engine owns it)
export type FieldSpec =
  | { kind: 'number';  path: string; label: string; min: number; max: number; step: number; unit: 'ft' | 'in' }
  | { kind: 'choice';  path: string; label: string; options: [value: string, label: string][] }
  | { kind: 'toggle';  path: string; label: string }
  | { kind: 'openings'; path: string; label: string }   // per-wall OpeningSpec list editor
  | { kind: 'stories'; path: string; label: string };   // story add/remove + per-story fields
export function configSchemaFor(family: StructureFamily): FieldSpec[];
```

`path` is a dot-path into the spec (`'roof.risePer12'`, `'stories.0.wallHeightFt'`).
Min/max mirror `normalizeSpec` clamps exactly (one table, exported, used by both — no
drift; asserted in `timber2-spec.test.ts`).

---

## 4. GENERATOR ARCHITECTURE (deliverable 2)

### 4.1 Shape: subsystems composed by family generators

```
src/timber/
  types.ts          Member, MemberRole(+), STAGES (legacy const), DRESSED(+)
  doctrine.ts       NEW  — all doctrinal numbers + cites + life-safety register (§8)
  emit.ts           NEW  — shared member emitter factory
  openings.ts       NEW  — frameRectOpening(): the double-trimmer/header/tail pattern
  spec.ts           NEW  — §3 types + specFromBuildingInput + normalizeSpec
  stagePlan.ts      NEW  — StageKey vocabulary + plan builders (§5)
  catalog.ts        NEW  — presets (§3.6)
  configSchema.ts   NEW  — §3.7
  thumbnails.ts     NEW  — pure SVG projection (§7)
  frame.ts          KEPT — BuildingInput/generateFrame (delegates post-P0)
  floor.ts          KEPT (wrapper) — generateFloor/floorLevels/stairPlan/layoutCenters
  walls.ts          KEPT (wrapper) — generateWalls/Opening/WallsInput
  roof.ts           KEPT (wrapper) — generateRoof
  elevation.ts      KEPT — + optional story params
  bom.ts            KEPT — + optional plan param
  foundation.ts     NEW (extracted) — stages layout/sills for all foundation kinds
  floorSystem.ts    NEW (extracted) — joists/bridging/rim/deck + cutouts; reused per story AND for tower platforms
  wallSystem.ts     NEW (extracted) — plates/studs/openings/bracing + per-wall heights + girts
  stairsLadders.ts  NEW (extracted+new) — stairPlan/generateStraightStair/generateLadder/generateShipLadder
  railings.ts       NEW — posts/top/mid/toeboard along edge runs
  coverings.ts      NEW — wall sheathing, siding, roof deck courses, roofing, screen panels, cutouts
  towerFrame.ts     NEW — posts, girts, X/K bracing, platform bearings
  cribwork.ts       NEW — interlocked crib courses
  builtOpenings.ts  NEW — ledger-and-brace door leaves, framed screens, shutters (P3)
  roofFamilies/
    index.ts        dispatch by RoofSpec.kind → RoofResult
    ceiling.ts      NEW (extracted) — ceiling joists + attic scuttle
    gable.ts        NEW (extracted) — today's roof.ts math
    shed.ts         NEW — also implements 'flat' (D7)
    hip.ts          NEW — hip/jack rafter math
  families/
    index.ts        generateStructure() registry/dispatch
    building.ts     compose: foundation → per-story(floorSystem, wallSystem) → ceiling → roof → coverings → stairs
    hut.ts          compose: foundation → floorSystem → wallSystem(+girts) → roof → coverings(+screens) → builtOpenings
    tower.ts        compose: foundation(embedded/piers) → towerFrame → floorSystem(platform) → wallSystem(kneewall)? → railings → stairsLadders → roof → coverings
    bunker.ts       compose: foundation(embedded) → postFrame walls(towerFrame reuse) → planking(coverings) → heavy roof (family-specific stringers) → cribwork → builtOpenings(embrasure lintels)
    tentFrame.ts    compose: foundation(skids) → floorSystem(deck) → strongback frame (family-specific) → end walls (wallSystem)
```

### 4.2 Composition contracts (C-1 … C-8)

- **C-1 Purity/determinism.** Every subsystem and family generator: plain inputs +
  `doctrine.ts` constants in, `Member[]` (plus typed context) out. No Date, no random,
  no module state, Map/Set iteration only over insertion-ordered content.
- **C-2 Emitter and IDs.** All members are created through `emit.ts`:

  ```ts
  // src/timber/emit.ts
  export interface EmitDefaults { grade?: string; nailing?: string; doctrineRef?: string }
  export function makeEmitter(prefix: string, out: Member[], defaults?: EmitDefaults):
    (role: MemberRole, nominal: string, cutLenFt: number,
     position: [number, number, number], rotation: [number, number, number],
     stage: number, extras?: Partial<Member>) => Member;
  ```

  ID pattern `${prefix}-${role}-${NN}` (NN zero-padded per-role counter) — identical to
  today's closures. Prefixes: legacy `FL`/`S`/`N`/`E`/`W`/`RF` are reserved for story-0
  of the building family so existing IDs never change; additional assemblies prefix with
  scope: `L2-FL` (story-2 floor), `L2-S` (story-2 south wall), `TW` (tower frame), `PL`
  (platform), `RL` (railings), `AC` (access), `CV` (coverings), `CB` (crib), `BK`
  (bunker frame), `TF` (tent frame), `BO` (built openings). Uniqueness is a sweep
  invariant (§9.4).
- **C-3 Stage-agnostic subsystems.** Subsystems never hardcode stage numbers; the
  **family generator** passes the ordinals to stamp (e.g. `stageIds: { frame: 3, deck: 4 }`),
  taken from its computed stage plan (§5.3). Legacy wrappers pass the legacy numbers.
- **C-4 Levels flow down, bearings flow up.** A subsystem consumes the y-datums it
  builds on and returns the datums/bearings it creates:

  ```ts
  export interface BearingLine {           // where the next system's members bear
    axis: 'x' | 'z';                       // run direction
    atFt: number;                          // fixed cross-axis coordinate (e.g. z of a sill line)
    y: number;                             // bearing surface top
    fromFt: number; toFt: number;          // run extent
    kind: 'sill' | 'girder' | 'plate' | 'beam' | 'ledger';
  }
  export interface RectCut { x0: number; x1: number; z0: number; z1: number;
                             reason: 'stair' | 'ladder' | 'hatch' | 'scuttle' }
  ```

- **C-5 Openings are cutouts with conservation.** Whoever frames a surface receives the
  `RectCut[]`/`OpeningSpec[]` that pierce it and must (a) frame them (via
  `openings.frameRectOpening`) and (b) never emit deck/covering area inside them.
  Conservation is tested: covered area + cutout area = surface area (§9.3, §9.5).
- **C-6 Emission order.** Within a family, subsystems are invoked and concatenated in
  build order: foundation → per-story (floor, walls) → ceiling → roof frame → roof deck →
  roofing → coverings/finish → access → railings. For the 1-story gable building this
  reproduces today's array order exactly (floor stages 1–4, walls 5–6, ceiling 7,
  rafters 8, sheathing 9) — the deep-equal compat lock depends on it.
- **C-7 Geometry honesty.** The TIMBER-1 placement rules carry over verbatim: members
  sit where nailed (offsets beside mates, tops flush where doctrine says flush), panels
  tile without overlap and clamp at edges, nothing hangs past the building line unless
  doctrinal (overhangs, cap-plate laps), zero/negative lengths are guarded and skipped.
- **C-8 Doctrine metadata.** Every emit provides `nailing` and `doctrineRef` (or accepts
  the module default), carrying the `(PH)` discipline; life-safety-derived members carry
  the register suffix (§8.3).

### 4.3 Subsystem specifications (consumes → returns)

**4.3.1 `foundation.ts`**

```ts
export interface FoundationInput {
  dims: Dims; foundation: FoundationSpec; joistSpacingIn: number; prefix?: string; // default 'FL'
  stageIds: { layout: number; sills: number };
}
export interface FoundationResult { members: Member[]; levels: FloorLevels; bearings: BearingLine[] }
export function generateFoundation(input: FoundationInput): FoundationResult;
```

Extracted stages 1–2 of `floor.ts` (pads/posts, continuous wall + strip footings,
basement wall/slab/columns, sills, built-up girder). New kinds: `slab` (slab + perimeter
anchor note; returns bearings at slab top, `storyFloorTopY[0] = slabTop`; NO framed floor
— the family skips `floorSystem` for story 0 and walls anchor to the slab), `skids`
(4x6 skids on grade at ≤4 ft centers, bearings on skid tops), `embedded` (no members —
returns grade level; the post family owns embedded posts).

**4.3.2 `floorSystem.ts`**

```ts
export interface FloorSystemInput {
  dims: Dims; joistSpacingIn: number; bearings: BearingLine[];   // perimeter + interior lines to land on
  deckTopY: number;                    // top-of-deck datum this platform must produce
  joistNominal?: string;               // default '2x8' (story platforms may size up, §8.2)
  bridging?: BridgingType;
  cuts?: RectCut[];                    // stairwells/hatches to frame around
  deck?: boolean;                      // default true; tower platforms use '2x6' plank option
  deckKind?: 'panel' | 'plank';        // plank = 2x6 laid tight (towers/tent decks)
  prefix: string; stageIds: { frame: number; deck: number };
}
export interface FloorResult { members: Member[]; deckTopY: number; framed: RectCut[] }
export function generateFloorSystem(input: FloorSystemInput): FloorResult;
```

Extracted stages 3–4 (joists between rims over girder, bridging rows, staggered deck
sweep, framed openings via `openings.frameRectOpening`). Reused for: story-N platforms
(platform-framing loop) and the tower platform (plank deck).

**4.3.3 `wallSystem.ts`**

```ts
export interface WallSystemInput {
  dims: Dims; wallHeightFt: number;
  heights?: Partial<Record<WallId, number>>;   // per-wall override (unused v1; shed uses roof-side closure, D8)
  studSpacingIn: number; openings: WallOpenings;
  letInBracing?: boolean;
  girtsAtFt?: number[];                        // horizontal girt rows (hut screen-band edges) — [] default
  baseY: number;                               // sole-plate bottom (story deck top)
  prefix?: string;                             // wall id becomes `${prefix}${wallId}`; '' for story 0
  stageIds: { frame: number; brace: number };
}
export interface WallsResult { members: Member[]; plateTopY: number }
export function generateWallsSystem(input: WallSystemInput): WallsResult;
```

Extracted walls.ts body + three additions: `baseY` (today implicitly 0 — story loop
passes the upper deck top), `girtsAtFt` (emits `girt` members let between studs at the
given heights), and per-wall `Member.wall` retention (unchanged — elevation/strips key
off it; story prefix goes in the id, `wall` field stays `'S'` etc. with story recorded
via id prefix and an additive optional `Member.story?: number`).

**4.3.4 `roofFamilies/*` — dispatch and results**

```ts
export interface RoofInputCommon {
  dims: Dims; plateTopY: number; rafterSpacingIn: number; prefix?: string;  // default 'RF'
  stageIds: { ceiling?: number; frame: number };
  atticAccess?: boolean;             // gable/hip only (scuttle)
}
export interface RoofPlane {         // consumed by coverings for deck/roofing courses
  origin: [number, number, number];  // eave-left corner on the rafter TOP plane
  uDir: [number, number, number];    // along the eave (unit)
  vDir: [number, number, number];    // up the slope (unit)
  uLenFt: number; vLenFt: number;    // plane extents
  normal: [number, number, number];
}
export interface RoofResult { members: Member[]; planes: RoofPlane[]; ridgeY: number }
export function generateRoofFrame(spec: RoofSpec, input: RoofInputCommon): RoofResult;  // roofFamilies/index.ts
```

- `gable.ts`: today's math verbatim (framing-square length less half ridge, ridge one
  size deeper flush-topped, collar ties every 3rd pair, gable studs). Returns 2 planes.
- `ceiling.ts`: ceiling joists + scuttle (extracted from roof.ts stage 7); called by
  gable and hip; shed/flat omit it (rafters are the ceiling) unless
  `forceCeiling: true` future option.
- `shed.ts`: single slope from `highSide` plate line to the opposite wall; rafters bear
  on the low plate and on a `ponyWall` strip (plates + short studs, role `stud`) the
  module emits along the high side; triangular side closures emitted as rake studs on
  the E/W (or N/S) ends (role `stud`, same pattern as gable studs, D8). Returns 1 plane.
  `flat` = shed with `risePer12 = drainPer12 ?? 0.25` and overhang all around (D7).
- `hip.ts`: common rafters on the long walls; hip rafters at plan-diagonal corners with
  unit length `sqrt(288 + rise^2)/12` per foot of common run; jack rafters shortening by
  the common difference `spacing × lenPerFtRun`; ridge shortened `widthFt/2` each end
  (degenerating to a pyramid when `lengthFt === widthFt`). Returns 4 planes. Invariants
  §9.3: jack cut lengths form an arithmetic sequence; hip top edges coplanar with both
  adjacent planes within 1/8".

**4.3.5 `coverings.ts`**

```ts
export interface CoveringsInput {
  spec: Required<CoveringSpec>;
  wallSurfaces: WallSurface[];        // from wallSystem via family: per wall+story rect + opening cutouts
  roofPlanes: RoofPlane[];
  screenBands?: ScreenBand[];         // hut: per-wall band rect between girts
  prefix?: string;                    // default 'CV'
  stageIds: { wallSheathing?: number; roofDeck?: number; roofing?: number; siding?: number; screens?: number };
}
export interface WallSurface { wall: WallId; story: number; runFt: number; heightFt: number;
                               originAlongFt: number; baseY: number; cutouts: UVRect[] }
export interface UVRect { u0: number; u1: number; v0: number; v1: number }
export function generateCoverings(input: CoveringsInput): Member[];
```

Rules: 4x8 panels vertical on walls, staggered courses on roofs (roof-deck math is the
extracted stage-9 course sweep, called by families right after the roof frame so legacy
order holds, C-6); board siding/roofing as 1x8 courses; `skip` deck as spaced 1x4;
`corrugated`/`roll` roofing as thin sheet members (`roofingPanel`, actual.w 0.05") laid
on the deck planes; **every panel/course is clipped against `cutouts` and never covers an
RO** — panels split into up to 4 sub-panels around a cutout (conservation test §9.5).

**4.3.6 `stairsLadders.ts`**

```ts
export interface StairPlanInput { totalRiseFt: number; availableRunFt: number; widthFt: number }
export function planStraightStair(i: StairPlanInput): StairPlan | null;   // doctrinal riser math (extracted)
export function generateStraightStair(plan: StairPlan, ctx: { topX: number; z1: number; z2: number;
  topY: number; prefix: string; stageId: number; railings?: boolean }): Member[];
export function generateLadder(ctx: { x: number; z: number; fromY: number; toY: number;
  prefix: string; stageId: number }): Member[];        // 2x4 rails, 2x4 cleat rungs @ doctrine.LADDER spacing
export function generateShipLadder(/* same shape, treads not cleats */): Member[];
```

The existing basement stair emission (stringer geometry + treads) extracts into
`generateStraightStair` (compat-locked). Interior story stairs: building family computes
the stairwell `RectCut` from the plan, feeds it to the upper story's `floorSystem`, and
emits the stair at the upper deck stage — the exact pattern the basement already uses.
Ladders: rails plumb, cleats at uniform spacing `<= doctrine.LADDER.rungSpacingIn`
(LIFE-SAFETY), top rails extend `doctrine.LADDER.railExtensionIn` above the landing.

**4.3.7 `railings.ts`**

```ts
export interface EdgeRun { from: [number, number, number]; to: [number, number, number] } // along deck edge, y = deck top
export function generateRailings(input: { edges: EdgeRun[]; spec: Required<RailingSpec>;
  prefix?: string; stageId: number; postSpacingFt?: number }): Member[];   // default post spacing 6 ft
```

Emits `railPost` (2x4), `topRail` (2x4 flat at `topRailHeightIn` — LIFE-SAFETY),
`midRail`, `toeboard` (1x6 on edge). Continuity invariant: rails cover every edge run
except declared gaps (ladder/stair entry gap passed as an excluded interval).

**4.3.8 `towerFrame.ts`, `cribwork.ts`, bunker specifics**

```ts
export function generateTowerFrame(input: { dims: Dims; platformHeightFt: number;
  postCount: 4 | 6; postNominal: string; bracing: 'x' | 'k'; embedFt: number;
  prefix?: string; stageIds: { posts: number; bracing: number } }):
  { members: Member[]; bearings: BearingLine[]; postTopY: number };
```

Posts from `-embedFt` (or pier tops) to platform bearing height; horizontal girts at
vertical intervals `<= doctrine.TOWER.braceBayMaxFt` (LIFE-SAFETY); X-braces (role
`xBrace`, 2x6) or K-braces per bay per face, endpoints ON the post centerlines
(invariant §9.3); doubled beam caps (`capBeam`) as platform bearings. Tower platform =
`floorSystem` with plank deck; railing edges = deck perimeter minus the access gap;
optional kneewall enclosure = `wallSystem` on the platform with `baseY = platformTopY`.

```ts
export function generateCrib(input: { runFt: number; heightFt: number; depthFt: number;
  origin: [number, number, number]; yaw: number; timberNominal?: string;  // default '6x6'
  prefix?: string; stageId: number }): Member[];
```

Alternating perpendicular courses (headers/stretchers), corners interlocked (offset by
one timber thickness per course), invariant: no two members of the same course intersect,
successive courses alternate direction.

Bunker (family-specific, in `families/bunker.ts`): perimeter posts (6x6) at
`<= doctrine.BUNKER.postSpacingFt`, doubled cap beams, wall planking between posts
(coverings, horizontal 2x lumber), roof stringers (role `roofStringer`) across the short
span with size/spacing looked up from `doctrine.BUNKER.stringerBySoilFt(soilCoverFt)` —
LIFE-SAFETY, banner-visible; plank decking over stringers; optional `soilCover` massing
member (nominal `'earth fill'`, 0 BF by BF_PER_LF miss — same pattern concrete already
uses); embrasure openings framed with plank lintels/sills; crib retaining at the entry
when `retaining:'crib'`.

### 4.4 Family generators — composition sketches

`families/building.ts` (the platform-framing loop, M1):

```ts
export function generateBuilding(spec: BuildingSpec /* normalized */): StructureModel {
  const plan = stagePlanForBuilding(spec);                 // §5.3
  const S = ordinals(plan);                                // key(+story) -> ordinal lookup
  const members: Member[] = [];
  const fnd = generateFoundation({ ...spec-derived, stageIds: { layout: S.layout, sills: S.sills } });
  members.push(...fnd.members);
  let bearings = fnd.bearings; let deckTop = 0; const storyTops: number[] = [];
  for (let s = 0; s < spec.stories.length; s++) {
    const stairCut = s > 0 && spec.interiorStairs ? stairwellCutFor(spec, s, deckTop) : undefined;
    if (!(s === 0 && spec.foundation.kind === 'slab')) {
      const fl = generateFloorSystem({ ..., bearings, deckTopY: deckTop, cuts: cutsFor(s),
        prefix: s === 0 ? 'FL' : `L${s + 1}-FL`, stageIds: { frame: S.floorFrame[s], deck: S.deck[s] } });
      members.push(...fl.members);
      if (stairCut) members.push(...generateStraightStair(/* between deckTop-1 story and this one */));
    }
    storyTops.push(deckTop);
    const walls = generateWallsSystem({ ..., baseY: deckTop, openings: spec.stories[s].openings,
      prefix: s === 0 ? '' : `L${s + 1}-`, stageIds: { frame: S.wallFrame[s], brace: S.tieBrace[s] } });
    members.push(...walls.members);
    bearings = plateBearings(walls);                       // next platform lands on the cap plates
    deckTop = walls.plateTopY + floorDepthFt(spec);        // platform framing: next deck atop this story's plates
  }
  const ceil = needsCeiling(spec.roof) ? generateCeiling({ ... }) : { members: [] };
  const roof = generateRoofFrame(spec.roof, { plateTopY: lastPlateTop, ... });
  const cover = generateCoverings({ ...wallSurfaces, roofPlanes: roof.planes, stageIds: { ... } });
  members.push(...ceil.members, ...roof.members, ...cover.members);
  return { spec, members, levels, stagePlan: plan, issues };
}
```

For `stories.length === 1`, gable roof, `coverings` limited to `roofDeck:'plywood'`, this
is EXACTLY the legacy pipeline and array order (C-6) — the compat lock.

`families/hut.ts`: building pipeline with variant defaults from `doctrine.HUT`,
`girtsAtFt` at the screen-band edges, `coverings` screen panels in the band,
`builtOpenings` (ledger doors on end walls, shutters over window ROs) at the
exterior-finish stage. `families/tower.ts`, `families/bunker.ts`,
`families/tentFrame.ts` per §4.3.8; tent frame's family-specific piece is the
strongback: post pairs + ridge beam (`strongback` role) + light rafters at 24" OC +
end-wall framing via `wallSystem` on the deck, no coverings by default.

### 4.5 New member roles (additive to `MemberRole`)

Exactly 24 additions to the union (pony-wall and rake members reuse the existing
`stud`/`solePlate`/`topPlate`; wall sheathing reuses `sheathingPanel`; siding reuses
`siding`):

```ts
| 'girt' | 'kneeBrace' | 'xBrace' | 'capBeam' | 'roofStringer' | 'plank'
| 'hipRafter' | 'jackRafter' | 'purlin' | 'strongback' | 'skid'
| 'railPost' | 'topRail' | 'midRail' | 'toeboard'
| 'ladderRail' | 'ladderRung'
| 'roofingPanel' | 'screenPanel'
| 'doorBoard' | 'doorLedger' | 'doorBrace' | 'shutterPanel'
| 'soilCover'
```

Each gets a `PLAIN` and `WHAT` dictionary line in `src/ui/woodframe/labels.ts`
(additive; member card code unchanged — deliverable 4's "member cards unchanged").

### 4.6 DRESSED / BF additions (additive)

`types.ts DRESSED` += `1x6 {0.75,5.5}`, `1x8 {0.75,7.25}`, `2x2 {1.5,1.5}`,
`4x6 {3.5,5.5}`, `6x6 {5.5,5.5}`, `6x8 {5.5,7.25}`, `8x8 {7.25,7.25}`.
`bom.ts BF_PER_LF` += matching nominal-section values (`1x6`:0.5, `1x8`:0.667,
`2x2`:0.333, `4x6`:2, `6x6`:3, `6x8`:4, `8x8`:5.333). Non-lumber nominals (`conc *`,
`earth fill`, `screen`, `roofing *`) intentionally miss the map → 0 BF, counted as
members/panels — the existing concrete pattern.

---

## 5. STAGE MODEL (deliverable 3)

### 5.1 The problem and the shape

Today `Member.stage` is a number 1..11 into the house-shaped `STAGES` const, and three
test files assert those numbers by value. Heterogeneous structures need different stage
lists — but changing `Member.stage` to a string key breaks the compat oracle.

**Design (D1): `Member.stage` stays a number — the 1-based ordinal into the model's
per-family stage plan.** The vocabulary lives in the plan entries, typed as a closed
union; the scrubber, cut lists, and member cards read names through the plan.

```ts
// src/timber/stagePlan.ts
export type StageKey =
  | 'layoutFoundation'   // 'Layout & foundation'
  | 'sillsGirders'       // 'Sills & girders'
  | 'floorFrame'         // 'Floor joists & bridging'
  | 'deck'               // 'Subfloor'
  | 'wallFrame'          // 'Wall framing'
  | 'tieBrace'           // 'Plates tied & braced'
  | 'ceilingFrame'       // 'Ceiling joists'
  | 'roofFrame'          // 'Rafters & ridge'
  | 'roofDeck'           // 'Roof sheathing'
  | 'roofing'            // 'Roofing'
  | 'exteriorFinish'     // 'Siding & exterior finish'
  | 'postFrame'          // 'Posts & caps'          (tower/bunker)
  | 'frameBracing'       // 'Girts & X-bracing'     (tower)
  | 'platformFrame'      // 'Platform joists'       (tower)
  | 'platformDeck'       // 'Platform decking'      (tower)
  | 'railings'           // 'Railings & toeboards'
  | 'access'             // 'Stairs / ladder'
  | 'cribwork'           // 'Crib courses'
  | 'heavyRoof'          // 'Roof stringers & decking' (bunker)
  | 'protection';        // 'Overhead cover'        (bunker soil massing)

export const STAGE_VOCAB: Record<StageKey, { name: string; blurb: string }>;

export interface StagePlanEntry { id: number; key: StageKey; name: string; story?: number }
// name defaults to STAGE_VOCAB[key].name, family may override (e.g. bunker wallFrame →
// 'Wall posts & planking'); story appears in the name ('Wall framing — story 2').

export function stagePlanForBuilding(spec: BuildingSpec): StagePlanEntry[];
export function stagePlanFor(spec: StructureSpec): StagePlanEntry[];   // dispatch
```

### 5.2 Back-compat lock

`stagePlanForBuilding(oneStoryGableSpec)` MUST produce ids 1..11 with names **exactly**
equal to the legacy `STAGES` const (asserted in `timber2-stages.test.ts` by deep
comparison against `STAGES`). `STAGES` stays exported from `types.ts` verbatim —
existing tests and the current scene keep working; new code treats it as the derived
alias for the 1-story building plan. `StageId` widens to `number`; `StageBom` gains
optional `key?: StageKey` (additive).

### 5.3 Canonical family plans

Plans are **computed per spec** (multi-story repeats story stages), from these canonical
sequences:

| Family | Plan (keys, in order) |
|---|---|
| building (1 story) | layoutFoundation, sillsGirders, floorFrame, deck, wallFrame, tieBrace, ceilingFrame, roofFrame, roofDeck, roofing, exteriorFinish — **the legacy 11** |
| building (2 story) | layoutFoundation, sillsGirders, floorFrame(1), deck(1), wallFrame(1), tieBrace(1), floorFrame(2 'Second-floor joists'), deck(2), access('Interior stairs'), wallFrame(2), tieBrace(2), ceilingFrame, roofFrame, roofDeck, roofing, exteriorFinish |
| hut | layoutFoundation, sillsGirders, floorFrame, deck, wallFrame(+girts), tieBrace, roofFrame, roofDeck, roofing, exteriorFinish('Siding, screens, shutters & doors') |
| tower | layoutFoundation('Layout & post setting' when embedded), postFrame, frameBracing, platformFrame, platformDeck, wallFrame('Deck kneewalls', only if enclosure), railings, access, roofFrame, roofDeck, roofing |
| bunker | layoutFoundation, postFrame('Posts & cap beams'), wallFrame('Wall planking'), heavyRoof, protection(only if showSoilCover), cribwork(only if retaining), exteriorFinish('Embrasures & entry') |
| tentFrame | layoutFoundation('Skids'), floorFrame('Deck joists'), deck, wallFrame('End walls & kneewalls'), roofFrame('Strongback & rafters') |

Stages with zero members are still legal plan entries; the scrubber already skips
memberless stages (current behavior, kept).

### 5.4 The partition invariant (preserved exactly)

For every generated model: every member's `stage` ∈ `[1 .. stagePlan.length]`;
`bomSummary(members, plan)` stage BFs/panels/member counts sum EXACTLY to the totals
(existing test logic, generalized across families in `timber2-stages.test.ts`); the
scrubber shows members with `stage <= current` — semantics unchanged. `bomSummary`'s
plan param defaults to the legacy building plan so every existing call site is
untouched.

---

## 6. VIEWER & CUTAWAY (deliverable 4)

### 6.1 Scene layer reshape

`woodframe-scene.ts` becomes the boot file wiring four modules (all under
`src/ui/woodframe/`):

- `picker.ts` — the structure picker screen (§6.5).
- `config.ts` — schema-driven form renderer over `configSchemaFor(family)`; edits a
  working spec, debounced regenerate.
- `studio.ts` — the current viewer, generalized: takes a `StructureModel`, builds
  meshes exactly as today (`buildMember` keyed off nominal → lumberPiece / plywoodSheet
  / concrete box; recenter by `dims`), ground from `levels` (basement excavation logic
  ported as-is), member card + PLAIN/WHAT (ported verbatim + additive role lines),
  per-stage cut list from `bomSummary(members, model.stagePlan)`, layout strips per
  story (elevation.ts story param).
- `camera.ts` — family-aware rigs (§6.3).
- `cutaway.ts` — §6.2.

State machine: `#/pick` (default) ⇄ `#/s/<catalogId>` (studio, config drawer available).
Hash-only routing, no libs. `woodframe.html` gains two sibling sections
(`#picker`, `#studio`) toggled by class — one HTML entry, vite configs untouched.

### 6.2 Cutaway: clip-plane, DECIDED (D2)

**Decision: renderer clip-plane cutaway (the SAP-1 pattern at
`src/ui/three-viewer.ts` ~1060–1260), not member-filtering by a cut plane.**

Why not member filtering: long members (plates, ridge, sills, rails, stringers) span the
whole structure — filtering by member center/extent either deletes them entirely
(structure falls apart visually) or keeps them entirely (no section read); there is no
per-member answer that yields a true section. The clip plane cuts THROUGH members —
the honest section — and SAP-1 already debugged the three gotchas, which port verbatim:

1. `renderer.localClippingEnabled = true`; one `THREE.Plane` in
   `material.clippingPlanes` of every mesh material in the structure group (assigned on
   every rebuild — no restore bookkeeping, same as SAP-1).
2. Clipped lit materials switch to `THREE.DoubleSide` so cut boxes show shaded interior
   back-faces, not voids.
3. Outline back-side shells (`userData.isOutline` in the lumber props) are HIDDEN under
   cutaway — their black back-faces would ink the section. Plus the section fill light:
   a shadowless warm directional aimed into the opened half, intensity 0 unless cutaway
   (port `applyLightRig`'s `cutawayOn` coupling).

```ts
// src/ui/woodframe/cutaway.ts
export interface CutawaySpec { axis: 'x' | 'z' | 'y'; frac: number; keep: '+' | '-' }
export function defaultCutaway(model: StructureModel): CutawaySpec;
//   building/hut/bunker/tentFrame: { axis:'z', frac:0.5, keep:'-' } (cut the near half at midspan)
//   tower: { axis:'z', frac:0.5, keep:'-' } — vertical section through the ladder line
export function applyCutaway(group: THREE.Object3D, spec: CutawaySpec | null, dims: Dims): void;
export function passesCut(point: THREE.Vector3, spec: CutawaySpec | null, dims: Dims): boolean;
```

UI: a `Cutaway` chip in the View group (toggles default spec) plus a slider (0..1 →
`frac`) and an axis chip X/Z (Y offered on towers — horizontal cut under the deck).
**Raycast correction (new, testable):** three.js raycasting ignores clipping planes, so
member picking filters hits with `passesCut(hit.point, …)` before walking up to
`userData.memberId` — clicking through a cut selects the member you SEE. Member card
itself: unchanged (reads Member fields only).

### 6.3 Camera presets per family (elevation-aware framing)

```ts
// src/ui/woodframe/camera.ts
export interface CameraRig {
  center: [number, number, number];   // scene coords (model recentered at plan origin)
  radius: number;                     // perspective orbit distance
  orthoHalf: number;                  // ortho half-width
  views: { name: string; kind: 'persp' | 'ortho'; dir: [number, number, number]; up?: [number, number, number] }[];
}
export function cameraRigFor(model: StructureModel): CameraRig;
```

Formulas (pure, testable in node — no three.js import in the math path):
`H = levels.maxY - min(0, levels.gradeY)`; `P = max(lengthFt, widthFt)`;
`center.y = 0.45 * levels.maxY` for squat structures (`H <= 1.1 * P`) else
`0.55 * levels.maxY` (towers); `radius = 1.35 * max(P, 0.8 * H)`;
`orthoHalf = 0.62 * max(P, 1.05 * H)`. Views: the current seven (Iso NE/NW/SE/SW, Plan,
Front, Left) for every family — the rig scaling is what makes towers frame correctly —
plus `Elev` (ortho front fitted to full height) added for models with `H > 1.5 * P`.
Test (§9.8): for every catalog preset, every member's AABB projects inside the ortho
frustum and inside a 46-degree cone at `radius` for perspective views (margin ≥ 5%).

### 6.4 Stage scrubber generalization

Chips are built from `model.stagePlan` (ordinal label, `name` tooltip — today's
behavior, list now model-driven); memberless stages skipped (unchanged); stage panel
title/notes read the plan entry; per-stage cut list = `bomSummary(members, plan)`.
Behavior for the legacy building is pixel-identical (same 11 chips, same names).

### 6.5 Picker screen

Cards grid from `CATALOG`: inline SVG thumbnail (§7), name, blurb, cite line (with its
`(PH)` visible — honesty in the picker), plus the final `Custom` card (wrench glyph
drawn in the same SVG style). Click → `#/s/<id>` (custom opens with the config drawer
expanded). Keyboard/tap accessible (`<button>` cards). No images are fetched — ever;
the offline gate keeps proving it.

---

## 7. THUMBNAILS (deliverable 5)

### 7.1 Decision (D3): runtime deterministic inline SVG line-art from the engine's own members

Rejected: build-time headless GL renders (adds a browser/GPU to the build → network
fetch of a browser, nondeterministic rasters, OOM surface) and pre-rendered GLB→PNG
(same renderer problem, plus binary assets to keep in sync). Chosen: a **pure function
of the model** that projects the same `Member[]` the 3D scene draws into a small
axonometric SVG — zero deps, zero assets, zero build steps, byte-deterministic,
testable in node, always in sync with the engine because it IS the engine's output.
The picker calls it at runtime (`< 1 ms` of SVG string-building per card after a
`generateStructure` that is already budgeted `< 50 ms`; cards render lazily via
`requestIdleCallback` with a synchronous first paint of the first six). Nothing enters
the vite asset pipeline → the base64-OOM class is structurally unreachable.

### 7.2 The projection spec

```ts
// src/timber/thumbnails.ts  (engine-side: NO three.js — hand-rolled 3x3 math, D13)
export interface ThumbSpec { widthPx: number; heightPx: number; yawDeg: number; pitchDeg: number }
export const THUMB_DEFAULT: ThumbSpec = { widthPx: 320, heightPx: 240, yawDeg: 34, pitchDeg: 24 };
export function structureThumbSvg(model: StructureModel, spec?: Partial<ThumbSpec>): string;
```

Algorithm (normative):
1. Rotation: for each member, compose its Euler `YXZ` rotation into a 3x3 matrix
   (12-line helper, mirrors three.js order so thumb and scene agree), producing the 8
   oriented-box corners from `position`, `cutLength/12`, `actual.d/12`, `actual.w/12`.
2. View: orthographic direction from yaw/pitch; project corners to 2D
   (`u = x·cosYaw − z·sinYaw`, `v = y·cosPitch − (x·sinYaw + z·cosYaw)·sinPitch`),
   fit-to-viewBox with 6% margin, y-flip.
3. Paint order: sort members by camera-depth key (`dot(center, viewDir)`), back to
   front; per member draw its up-to-3 visible faces as `<polygon>` with three fixed
   lightness steps of the role-class fill; stroke `#2b2419`, width 0.75.
4. Role-class palette (fixed hex, no theme): lumber `#e6c07c`, panel `#efe3c0`,
   concrete `#b9b6ae`, roofing `#8f8a7c`, screen `#d8e4dd` at 0.5 opacity, earth
   `#8a6b46`.
5. Numeric hygiene: every coordinate rounded to 2 decimals (`toFixed(2)`) — FP-stable
   strings across platforms.
6. Output: single `<svg viewBox="0 0 320 240">` string; no external refs, no ids, no
   scripts; injected via `innerHTML` into the card (sanitization unnecessary — the
   string is engine-generated, but a test asserts it contains no `<script`/`http`).

Thumbnail member-count control: catalog thumbs render the preset's real spec; the sweep
test caps thumb generation time (< 25 ms per preset in node) and SVG size (< 140 KB).
If a future preset explodes (member count), the sanctioned lever is a per-entry
`thumbLod` that drops covering members (roles in a skip-set) — geometry never gets
faked.

### 7.3 Stability discipline

`test/timber2-thumbs.test.ts` (§9.7): SHA-256 of each catalog thumb string equals the
committed golden in `test/goldens/thumb-hashes.json`. Intentional visual changes update
goldens via `npm run update:thumb-goldens` (tiny tsx script) in the same PR — the SAP
deliberate-change discipline. Plus structural asserts (starts `<svg`, no external URL
substrings, polygon count > 0, determinism across two module loads).

**Escape hatch (documented, not default):** if a family ever needs raster art, the
sanctioned path is a build-time node script writing `.svg` FILES into `public/`
generated from this same function — files, never base64-inlined — and the offline gate
still passes because SVGs reference nothing. No PNG path exists.

---

## 8. DOCTRINE DATA (deliverable 6)

### 8.1 The module

```ts
// src/timber/doctrine.ts
export interface Doc<T> { value: T; unit?: string; cite: string; ph: boolean; lifeSafety?: true; note?: string }
// ph:true ⇒ cite carries '(PH)' and the value is a working default pending page verification.

export const SPAN: {
  joist:  Record<'2x6' | '2x8' | '2x10' | '2x12', Record<12 | 16 | 24, Doc<number>>>;  // allowable span ft — FM 5-426 Table 6-2 shape (PH values)
  rafter: Record<'2x4' | '2x6' | '2x8',            Record<12 | 16 | 24, Doc<number>>>; // FM 5-426 roof tables (PH)
  girderNote: Doc<string>;    // Table 6-1 load-area method — narrative until verified
};
export const NAILS: Record<string, Doc<string>>;   // named schedule lines ('studToPlate', 'joistToSill', ...) — FM 5-426 nailing schedule (PH)
export const RAIL:   { topHeightIn: Doc<number>; midRail: Doc<boolean>; toeboardHeightIn: Doc<number>; postSpacingFt: Doc<number> };   // 42/mid/4/6 — standard-design dwgs (PH) — ALL lifeSafety
export const LADDER: { rungSpacingIn: Doc<number>; railExtensionIn: Doc<number>; railNominal: Doc<string>; rungNominal: Doc<string> }; // 12/36/'2x4'/'2x4' (PH) — spacing+extension lifeSafety
export const STAIR:  { unitRiseTargetIn: Doc<number>; unitRiseMaxIn: Doc<number>; unitRunIn: Doc<number>; headroomIn: Doc<number> };   // 7.5/8/10/80 — FM 5-426 stair layout (PH) — max rise lifeSafety
export const TOWER:  { postEmbedFt: Doc<number>; braceBayMaxFt: Doc<number>; platformHeightMaxFt: Doc<number>; platformLoadNote: Doc<string> }; // 4/8/25 (PH) — ALL lifeSafety
export const BUNKER: { postSpacingFt: Doc<number>; stringerBySoilFt: { maxSoilFt: number; nominal: string; spacingIn: number; cite: string; ph: boolean; lifeSafety: true }[] };
export const HUT: Record<'seaHut' | 'swaHut' | 'bHut' | 'guardShack',
  { dims: Doc<Dims>; wallFt: Doc<number>; screenBand?: Doc<{ sillFt: number; heightFt: number }>; roof: Doc<RoofSpec>; cite: string }>;
export const TENT: { sidewallFt: Doc<number>; ridgeFt: Doc<number>; dims: Doc<Dims> };  // GP-medium strongback (PH)
export const LABOR: { mhPerBf: Doc<number>; mhPerPanel: Doc<number>; mhPerConcLf: Doc<number> };  // moved from bom.ts, same values

export function lifeSafetyRegister(): { path: string; cite: string; ph: boolean }[];  // walks every lifeSafety-tagged Doc
```

Source map (stated per family, all `(PH)` until page-verified): FM 5-426 is the spine
(framing, spans, nails, stairs); hut standard designs cite the SEA-hut/SWA-hut/B-hut
standard-drawing lineage (TM 5-302-series standard designs / theater standard drawings);
tower and bunker dimensions cite the field-fortification standard-design lineage
(FM 5-35/TM 5-302 heritage, GTA construction cards); railing/toeboard defaults cite the
standard-design drawings they appear on. The cite string names the document family and
carries `(PH) pending page verification` exactly like today's member `doctrineRef`s.

### 8.2 Ship-with-defaults boundary (explicit)

TIMBER-2 **ships working doctrinal defaults with (PH) cites**. This is the deliberate
opposite of SAP-2's ship-empty regime, and the boundary is: TIMBER teaches and plans
**TO rough construction methods from public-release manuals**; it does not compute
protective performance, and it shares no doctrine store with SAP-2. The existing footer
disclaimer stays and gains one sentence: "Dimensions marked (PH) are working defaults
pending page verification; life-safety items carry a review flag." Span-table lookups
(joist/rafter sizing upgrades in P6) follow TIMBER-1's §8 rule: exceeding a table row
is an on-card warning naming the row — never silent extrapolation.

### 8.3 LIFE-SAFETY REVIEW REGISTER (the named posture)

Every `Doc` with `lifeSafety: true` (tower rails/heights/bracing/embed, platform load
note, bunker stringer table, stair max riser, ladder spacing/extension) is:
1. Enumerated by `lifeSafetyRegister()` — the single source the UI and tests read.
2. Stamped into consuming members' `doctrineRef` with the suffix
   `"(PH — LIFE-SAFETY, review required)"` while `ph:true` (emit helper enforces it:
   the family passes `lifeSafety:true` in extras and the emitter appends the suffix).
3. Surfaced in the UI: member cards show a "LIFE-SAFETY (PH)" badge line when the
   suffix is present (string check, card code otherwise unchanged), and the studio
   shows a standing banner on any model whose members carry the suffix: "Life-safety
   dimensions are working defaults pending doctrine verification — training
   visualization only."
4. Retired only by editing `doctrine.ts`: set `ph:false` and replace the cite with a
   page-bearing cite. `timber2-doctrine.test.ts` asserts the flip discipline (§9.9);
   the banner disappears structure-by-structure as entries verify. There is no silent
   default and no count-based unlock — the flag is per-entry and visible end-to-end.

### 8.4 Where numbers live

ALL magic numbers currently inline in generators (stair 7.5"/10"/80", concrete section
constants, bridging 8-ft rule, collar-tie interval) migrate to `doctrine.ts` in P0/P1
**with values unchanged** (compat-locked); generators import them. New-family numbers
enter only through `doctrine.ts`. Grep-gate test: no numeric literal with a doctrine
smell (the migrated names) remains in family/subsystem files — enforced by review
checklist, not regex (logged as non-automatable).

---

## 9. TEST STRATEGY (deliverable 7)

Runner: `node --test` + tsx, same as today; all tests pure-node (no DOM/GL). New files
listed; existing three files untouched (§2.1).

### 9.1 `test/timber2-spec.test.ts`
`specFromBuildingInput` round-trip properties (openings regrouped per wall, counts
conserved); `normalizeSpec`: determinism, idempotence (`normalize(normalize(s)) ==
normalize(s)`), clamps reported not silent, config-schema min/max equal normalize
clamps, catalog specs all normalize clean (zero issues).

### 9.2 `test/timber2-compat.test.ts` — THE migration lock
For the golden `BuildingInput` plus the full `timber-features` option matrix
(foundations × bridging × bracing × attic × sizes):
`generateStructure(specFromBuildingInput(i)).members` deep-equals
`generateFrame(i).members` (same order, same every field);
levels agree; `stagePlanForBuilding(spec)` `{id,name}` deep-equals legacy `STAGES`;
`bomSummary(members)` (defaulted plan) equals `bomSummary(members, plan)`.

### 9.3 Per-family invariant suites
- `test/timber2-building.test.ts` — multi-story: story-2 sole plates sit on story-2
  deck top; platform joists bear on story-1 cap plates (bearing y match to 1e-9);
  interior stairwell framed (double trimmers/headers/tails, the §4.3.2 pattern) and
  stairs land within the well; slab foundation: no floor frame, walls at slab top;
  skids: deck joists bear on skids.
- `test/timber2-roofs.test.ts` — shed: single plane, high-side pony wall closes to the
  plane, rake studs monotone; hip: jack lengths arithmetic sequence, hip tops coplanar
  with both planes (≤ 1/8"), ridge shortening, pyramid degenerate case; flat: plane
  slope == drainPer12; ALL kinds × pitches {0,2,4,6,9,12}: deck courses tile each plane
  exactly (sum of course widths == plane vLen — the existing gable test generalized).
- `test/timber2-coverings.test.ts` — conservation per wall/story/plane: covered area +
  cutout area == surface area (±0.02 sf); no covering member's rect intersects an RO
  rect; siding/sheathing never overlaps panel-vs-panel (§9.5 helper); roofing courses
  lap direction consistent.
- `test/timber2-hut.test.ts` — per variant: preset dims equal `doctrine.HUT` values;
  screen panels exist only inside the band, girts at band edges; shutters hinged over
  every window RO; ledger door assembly (boards+ledgers+diagonal) fits its RO;
  guardShack on skids.
- `test/timber2-tower.test.ts` — posts run grade(-embed) to platform bearing; every
  brace endpoint within 1e-6 of a post centerline; girt bays ≤ doctrine.TOWER.braceBayMaxFt;
  platform deck partitions (plank sum == platform area minus access gap); railing
  continuity: union of rail runs covers deck perimeter minus the declared gap; top rail
  height == doctrine.RAIL.topHeightIn; ladder rung spacing uniform and ≤ doctrine;
  every life-safety member carries the register suffix.
- `test/timber2-bunker.test.ts` — stringer size/spacing matches the table row for
  soilCoverFt (boundary cases at row edges); post spacing ≤ doctrine; planking spans
  between posts only; embrasure framing complete; crib courses alternate direction,
  interlock at corners, no same-course overlaps; soilCover massing contributes 0 BF.
- `test/timber2-tent.test.ts` — strongback ridge continuous, rafter pairs meet it,
  deck on skids, end-wall door framed.

### 9.4 `test/timber2-sweep.test.ts` — cross-family property sweep
For EVERY catalog preset and a fuzz grid per family (dims × heights × pitch × options,
≥ 200 specs total): determinism (`deepEqual` across two calls); every member finite,
`cutLength > 0`, `actual.w/d > 0`; unique ids; `stage` ∈ [1..plan.length]; no member
below `gradeY - embed - footing` allowance; BOM partition exact (totals == stage sums ==
member count); perf smoke: largest preset regen < 50 ms, thumb < 25 ms.

### 9.5 Overlap helper (shared by 9.3 suites)
`test/helpers/overlap.ts` — pairwise same-plane panel AABB intersection area < 1e-3 sf,
grouped by (role, plane key). Not a new invariant — the generalization of the existing
subfloor/roof-course tiling tests to every covered surface.

### 9.6 `test/timber2-stages.test.ts`
Vocabulary closed (every plan key ∈ STAGE_VOCAB); per-family canonical sequences match
§5.3 tables; 1-story building plan == legacy STAGES; partition invariant across all
presets; `bomSummary` default-plan back-compat.

### 9.7 `test/timber2-thumbs.test.ts` — §7.3.

### 9.8 `test/timber2-camera.test.ts` — rig formulas: all-member AABB inside ortho
frustum & perspective cone for every preset/view, margins ≥ 5%; tower presets get the
Elev view; determinism.

### 9.9 `test/timber2-doctrine.test.ts`
Every `Doc` has non-empty cite; `ph:true` ⇒ cite contains `(PH)`; `ph:false` ⇒ cite
matches a page-bearing pattern (`/p\.|para|fig|dwg|table/i`); `lifeSafetyRegister()`
covers exactly the tagged set; every member whose emit declared lifeSafety carries the
suffix; LABOR values equal the legacy bom constants (0.055/0.5/0.15) until verified.

### 9.10 What is NOT tested (stated)
DOM/three rendering stays untested per repo culture; everything that CAN be pure is
pure and node-tested (camera math, cutaway predicate `passesCut` as pure function,
thumbnails, all generators).

---

## 10. DIRECTORY TREE + WHO CALLS WHAT

Tree: §4.1 (engine) + §6.1 (ui) are the complete layout. Call graph:

```
woodframe.html → woodframe-scene.ts (boot)
  → picker.ts ──reads── catalog.ts ──uses── thumbnails.ts(model) ← generateStructure
  → config.ts ──reads── configSchema.ts, normalizeSpec
  → studio.ts ──consumes── StructureModel
       ├─ bomSummary(members, stagePlan)         [bom.ts]
       ├─ wallElevation/layoutStrip(…, story)    [elevation.ts]
       ├─ cameraRigFor(model)                    [camera.ts]
       ├─ applyCutaway/passesCut                 [cutaway.ts]
       └─ lumberPiece/plywoodSheet/toonGradient  [three-viewer.ts — untouched]

generateStructure(spec)                           [families/index.ts]
  → normalizeSpec → stagePlanFor(spec)
  → families/<family>.ts
       ├─ foundation.ts → floorSystem.ts → wallSystem.ts (per story)
       ├─ roofFamilies/index.ts → {gable|shed|hip}.ts (+ceiling.ts)
       ├─ coverings.ts (wall/roof/screens; consumes WallSurface + RoofPlane)
       ├─ stairsLadders.ts / railings.ts / towerFrame.ts / cribwork.ts / builtOpenings.ts
       └─ all emit via emit.ts; all constants via doctrine.ts

generateFrame(input)  [frame.ts — frozen API]
  → generateStructure(specFromBuildingInput(input))   (post-P0)
legacy wrappers floor.ts/walls.ts/roof.ts → extracted subsystem functions (legacy params)
```

---

## 11. PHASE PLAN (P0–P6)

Effort: S = days, M = ~1 wk, L = 2–3 wks. Every phase ends with `npm run verify` green
(typecheck + ALL tests + offline gate) and the suite deploy building. A phase's tests
land IN that phase.

### P0 — Extraction & compat lock (M)
**Contents:** `emit.ts`, `openings.ts` (frameRectOpening extracted from the three
duplicated sites), `doctrine.ts` (constants migrated, values unchanged), `spec.ts`
(+`specFromBuildingInput`, `normalizeSpec` for building only), `stagePlan.ts`,
subsystem extraction (foundation/floorSystem/wallSystem/roofFamilies/gable+ceiling/
stairsLadders; coverings holds only the roof-deck course math), `families/building.ts`
(1-story path), `families/index.ts`; legacy wrappers in place; `frame.ts` delegates.
**Tests:** timber2-compat, timber2-spec, timber2-stages (building rows), timber2-doctrine.
**Acceptance:** 219 legacy tests green UNTOUCHED; compat deep-equal green across the
full option matrix; no UI change shipped.
**Kill/fallback:** if member-ORDER equality fights the loop structure > 2 days, drop to
set-equality + field-equality (log D12-fallback in DECISIONS.md); if any legacy test
needs editing, STOP — the design is wrong, revisit extraction seams.

### P1 — Building family breadth (L)
**Contents:** multi-story loop + interior stairs; foundations `slab`/`skids`;
roofFamilies `shed`/`hip`(+`flat`); `coverings.ts` full (wall sheathing, siding,
roofing, cutout conservation); `normalizeSpec` full for building; catalog entries
`house-20x16`, `house-2story-24x20`, `custom`.
**Tests:** timber2-building, timber2-roofs, timber2-coverings, timber2-sweep (building
slice), overlap helper.
**Acceptance:** sweep green; regen < 50 ms for the 2-story 40×24 fuzz corner; stage
plans per §5.3; legacy suites still green.
**Kill:** hip coplanarity fighting > 3 days ⇒ ship hip behind `normalizeSpec` clamp to
gable + logged issue, revisit in P5 window.

### P2 — Picker, thumbnails, cutaway, cameras (M–L)
**Contents:** ui split (§6.1); `thumbnails.ts` + goldens + update script; picker +
config forms (schema-driven); clip-plane cutaway + raycast filter + slider; `camera.ts`
rigs; scrubber reads stagePlan; PLAIN/WHAT additive lines.
**Tests:** timber2-thumbs, timber2-camera; manual device pass (one low-end Android)
recorded in DECISIONS.md.
**Acceptance:** deploy build green with offline scan (zero new asset files, zero new
requests); legacy demo reachable via `house-20x16` with pixel-equivalent studio
behavior; cutaway works on every catalog entry.
**Kill:** if clip-plane + GLB prop materials misbehave on the reference device,
fallback = cutaway via `three-viewer.ts` pattern EXACTLY (it ships today; the pattern
is proven) — member-filtering is NOT the fallback.

### P3 — Hut family (M)
**Contents:** `families/hut.ts`, girts in wallSystem, screen coverings, shutters +
ledger doors + framed screens (`builtOpenings.ts`), `doctrine.HUT`, catalog sea/swa/
b-hut/guard-shack entries.
**Tests:** timber2-hut; sweep grows hut slice.
**Acceptance:** all four variants generate, thumbs stable, hut stage plan per §5.3.

### P4 — Tower family (M–L)
**Contents:** `towerFrame.ts`, `railings.ts`, ladders/shipLadder, platform via
floorSystem, enclosure kneewalls, `doctrine.TOWER/RAIL/LADDER`, LIFE-SAFETY register +
banner + card badge, tower catalog entries, Elev camera view.
**Tests:** timber2-tower; doctrine test grows register rows; sweep grows tower slice.
**Acceptance:** every life-safety member carries the suffix; banner shows; rig test
green for 20-ft tower.

### P5 — Bunker + tent frame + cribwork (M–L)
**Contents:** `families/bunker.ts` (posts/caps/planking/stringers/soil massing/
embrasures), `cribwork.ts`, `families/tentFrame.ts` (skids/deck/strongback/end walls),
doctrine tables, catalog entries.
**Tests:** timber2-bunker, timber2-tent; sweep full matrix.
**Acceptance:** stringer table lookups verified at boundaries; full catalog renders;
full sweep < 10 s wall-clock in CI.

### P6 — Hardware, span checks, polish (S–M)
**Contents:** optional `Member.fasteners` structured metadata + BOM nail roll-up line;
joist/rafter span WARNINGS from `doctrine.SPAN` on member cards (never silent resize);
docs: `docs/TIMBER2_ENGINE.md` (this doc, updated to as-built) + README touch;
doctrine-verification workflow note (how to flip `ph:false`).
**Acceptance:** nail roll-up sums per stage; span warnings fire on a rigged oversize
fixture; verify + deploy green.

---

## 12. DECISIONS LOG

| # | Decision | Rationale / rejected alternative |
|---|---|---|
| D1 | `Member.stage` stays a NUMBER = ordinal into a per-model `stagePlan`; vocabulary is a closed `StageKey` union in plan entries. | String keys on Member break the untouchable legacy tests; ordinals + plans keep the partition invariant and back-compat for free. |
| D2 | Cutaway = renderer clip-plane (SAP-1 pattern) + raycast side-filter. | Member-filtering cannot section long members (plates/ridge/rails) honestly; SAP-1 already debugged outline-inking, double-siding, and section fill. |
| D3 | Thumbnails = runtime inline SVG from a pure engine projection; golden-hash discipline; no build-time renders, no PNGs, no new assets. | Headless GL needs a fetched browser (offline gate) and risks OOM/nondeterminism; runtime SVG is deterministic, dependency-free, and cannot drift from the engine. |
| D4 | `hut` is a family with typed variant options, composed from shared subsystems. | Owner named the family explicitly; presets-only would leave screen bands/shutters untyped. |
| D5 | "Custom" = the `building` family fully exposed; no sixth generator. | One general generator; custom is a UI posture, not an engine branch. |
| D6 | Ship working doctrinal defaults with `(PH)` cites; LIFE-SAFETY entries get a named register + banner + member-card badge; explicitly not SAP-2 ship-empty. | TIMBER teaches public-release construction method; life-safety numbers still never pass silently. |
| D7 | `flat` roof implemented as `shed` with `drainPer12` (default 0.25). | One slope engine; honest drainage slope; avoids a fourth plane math. |
| D8 | Shed/gable side closures (rake/pony studs) are emitted by the ROOF module; wallSystem walls stay rectangular. | Keeps wallSystem untouched for compat; matches how gable studs already work. |
| D9 | Hut screen band = full-height studs + `girt` rows + screen coverings (not banded stud stacks). | Matches SEA-hut practice; zero change to stud math. |
| D10 | `Member` shape unchanged; roles/DRESSED/BF additive; `fasteners?`/`story?` optional additive fields. | The Member contract is the system's spine; additive-only keeps every consumer working. |
| D11 | Subsystems are stage-agnostic; families stamp ordinals (C-3). | Stages are a family concern; enables plan reuse of floorSystem for platforms. |
| D12 | Legacy modules become wrappers; extraction is cut-and-paste; compat = deep-equal INCLUDING array order (fallback: set+field equality, logged). | Order-equality is the cheapest total lock; fallback stated so P0 can't stall silently. |
| D13 | Engine (incl. thumbnails) stays three.js-free; hand-rolled YXZ rotation math. | Preserves the pure-engine discipline; thumbs testable in node. |
| D14 | v1 caps: stories ≤ 2, tower platform ≤ 25 ft, dims 4–60 ft — enforced by `normalizeSpec` with visible clamp issues. | TO doctrine scope; taller/bigger is engineered design, out of teaching scope; caps are doctrine-module numbers. |
| D15 | Cribwork is a subsystem, not a family. | It's a component (bunker retaining, future revetments), never a standalone structure here. |
| D16 | `bomSummary(members, plan?)` optional param defaulting to the legacy building plan. | Zero call-site churn; new callers pass the model's plan. |
| D17 | ID prefixes: legacy prefixes reserved for building story-0; new assemblies get scoped prefixes (`L2-`, `TW`, `RL`, …). | Existing IDs frozen (cards, tests); uniqueness by construction. |
| D18 | `elevation.ts` gains optional story/vBase params; strips render per story. | Additive; keeps 2D/3D parity test untouched. |

---

## 13. RISKS & KILL CRITERIA (project-level)

- **R1 Hip-roof geometry** is the hardest new math. Contained: P1 kill-to-clamp path;
  invariants written before code (jack sequence, coplanarity).
- **R2 Clip-plane vs prop materials** on weak GPUs. Contained: the shipping SAP-1
  pattern is the fallback; P2 device pass required.
- **R3 Golden-hash churn** on thumbnails annoying future sessions. Contained: update
  script + rule "goldens update in the same PR as the visual change, never standalone".
- **R4 Scope creep of the family list.** New structure types enter as CATALOG entries
  over existing families whenever possible; a new family requires a DECISIONS.md entry
  naming which subsystem gap forces it.
- **R5 Life-safety optics.** A tower/bunker visualizer with (PH) numbers must never
  read as certified design. Contained: §8.3 register/banner/badge; footer sentence;
  platform-height cap; no load calculations shipped in v1 (platformLoadNote is
  narrative only).
- **R6 Compat erosion.** Any PR that touches a legacy test file fails review by rule;
  the compat suite is the only sanctioned bridge.
- **Project kill criterion:** if P0's compat lock cannot be reached at all (even with
  the D12 fallback) the extraction plan is wrong — stop, do NOT fork the engine into
  timber2/, and re-plan seams; a forked engine violates the single-source-of-truth
  spine and is the one outcome this design forbids.

---

## 14. APPENDICES

### 14.1 Exact per-file disposition summary
UNTOUCHED (API + behavior): `frame.ts` (API), `types.ts` (Member shape, STAGES),
`bom.ts` (logic), `elevation.ts` (math), all `test/timber-*.test.ts`,
`three-viewer.ts`, vite/build/gate scripts.
WRAPPERED (same exports, body moved): `floor.ts`, `walls.ts`, `roof.ts`.
NEW ENGINE: `doctrine.ts, emit.ts, openings.ts, spec.ts, stagePlan.ts, catalog.ts,
configSchema.ts, thumbnails.ts, foundation.ts, floorSystem.ts, wallSystem.ts,
stairsLadders.ts, railings.ts, coverings.ts, towerFrame.ts, cribwork.ts,
builtOpenings.ts, roofFamilies/{index,ceiling,gable,shed,hip}.ts,
families/{index,building,hut,tower,bunker,tentFrame}.ts`.
NEW UI: `src/ui/woodframe/{picker,config,studio,camera,cutaway,labels}.ts`
(labels = PLAIN/WHAT dictionaries, extracted so role additions are one-file).
REFACTORED UI: `woodframe-scene.ts` (boot only), `woodframe.html` (adds picker/studio
sections + cutaway controls).

### 14.2 Test-file roster (final)
`timber2-spec`, `timber2-compat`, `timber2-stages`, `timber2-building`,
`timber2-roofs`, `timber2-coverings`, `timber2-hut`, `timber2-tower`,
`timber2-bunker`, `timber2-tent`, `timber2-sweep`, `timber2-thumbs`,
`timber2-camera`, `timber2-doctrine` + `test/helpers/overlap.ts` +
`test/goldens/thumb-hashes.json`.

### 14.3 What the implementing session does first (P0 checklist)
1. Read this doc §2–§4, then `src/timber/*.ts` end to end.
2. Create `emit.ts`; port floor.ts's emit closure onto it; prove `generateFloor`
   byte-identical output (temporary local assert), repeat for walls/roof.
3. Extract in the §11 P0 order; run the legacy suites after EVERY extraction.
4. Land `spec.ts` + `families/building.ts` + compat test; flip `frame.ts` to delegate.
5. `npm run verify` green; commit with the compat suite in the same change.

