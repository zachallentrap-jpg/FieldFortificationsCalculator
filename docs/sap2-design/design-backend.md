# SAP-2 Backend & Schema Architecture — "The Real Shape"

> **Role:** Backend/Schema Architect deliverable for the SAP-2 ground-up rebuild.
> **Ground truth read:** `docs/STATE_OF_THE_APP.md` (full v1 audit, 2026-08-01), `DECISIONS.md`
> (D1–D35), `PLACEHOLDER_POLICY.md`, `DOCTRINE_SOURCES.md`, and the v1 source under `src/`.
> **Verified census:** v1 registers exactly **295 doctrine leaves** — protection 194, positions 39,
> soils 24, materials 16, standards 9, labor 7, stages 4, vehicle 1, weapons 1 (re-derived live
> from the v1 registry during this design pass, matching the audit).
>
> **Not legal advice.** This blueprint designs for *maximal liability defensibility by
> architecture*. It is not a legal opinion. Before any fielding decision, the completed design and
> its output language MUST be reviewed by counsel / JAG and the owning unit's safety and
> information-management authorities. That review is a release gate (§5, gate G-15), not a footnote.

---

## 0. Mandate → mechanism map, and the non-negotiable invariants

The owner's mandate, restated as architecture. Every mechanism named here is specified in the
body sections; this table is the contract the rest of the document fulfills.

| # | Owner mandate | Architectural mechanism (section) |
|---|---|---|
| 1 | Total ground-up revamp (SAP-2, not a patch) | New `sap2/` tree, new schema-first core; v1 stays runnable until parity (§6). Bug *classes* die by construction, itemized in §0.2. |
| 2 | No liability exposure when the owner enters the full data himself | **Ship-empty**: the distributed artifact contains **zero doctrinal magnitudes** — not even "illustrative" ones (§1.1). Every number the tool ever outputs traces to an operator-entered dataset entry with citation, entry identity, double-entry verification, and a tamper-evident journal (§1.5–§1.8). The engine **fails closed** on missing data — it renders "REQUIRES DATA", never a default (§2.2). Output language regime + counsel-review gate (§5 G-15). |
| 3 | The backend is the real shape — everything deterministic | `compute(inputs, dataset) → Result` pure in **both** arguments (§2.2). One geometric truth: solids → volumes, sections, plans, 3D — all derived from the same solid definitions (§2.3). Deterministic SVG/print/build-card/3D-descriptor pipelines (§3). |
| 4 | A recruit with no diagram training can follow it | Build cards (§3.4): per-stage, plain-language, picture-first instruction cards generated from the same Result; callout registry shared across every surface (§3.2); stage-true 2D/3D at every step (§3.5). (The UI/UX architect owns the surface polish; the backend guarantees the *data* for it exists and cannot drift.) |
| 5 | Realistic scope, quality over breadth | v2.0 scope = SAP (survivability positions) only, at full depth. TIMBER-1 is archived, not ported, until it can enter the same regime whole (§6.3). Deferred-cut list carried from v1's EXECUTION_PLAN stands. |

### 0.1 The ten non-negotiable invariants (I1–I10)

These are testable statements, each mapped to gates in §5. A build that violates any of them
does not ship.

- **I1 — Ship-empty.** The production artifact contains no doctrinal magnitude, illustrative or
  otherwise. (v1 shipped 295 "illustrative" numbers behind a banner; v2 ships none.)
- **I2 — Fail closed.** A quantity whose inputs are unfilled renders as an explicit typed
  `REQUIRES DATA` marker. No fallbacks, no defaults, no silently substituted values — the v1
  fallback-position/fallback-soil pattern is dead; invalid ids are boundary parse errors.
- **I3 — One geometric truth.** Volume, plan, section, 3D, and dimensions all derive from the
  same solid definitions. Engine and render can never disagree about a shape (kills v1's
  platform inversion §6B-8 and slope-blind volumes §6C-N8 as a class).
- **I4 — Live doctrine, pure compute.** `compute` reads doctrine only from its `dataset`
  argument. There is no module-scope value capture anywhere in the engine (kills v1 §6B-2).
- **I5 — Every leaf has a consumer, by construction.** The set of leaves and the union of
  consumer manifests are asserted equal (kills v1 §6C-N6 orphans and the "TIMBER escaped the
  regime" class §6C-N13 — nothing can register outside the schema).
- **I6 — Exactly-one application points.** Factors that historically double-applied (machine
  assist, standard multipliers) are readable by exactly one declared consumer; the schema
  enforces exclusivity (kills v1 §6B-3).
- **I7 — Traces cannot lie.** Explain formulas are *generated from* the actual operands used in
  computation, never hand-written strings (kills v1 §6C-N1).
- **I8 — Self-contained render outputs.** Every emitted SVG/HTML artifact carries its own
  resolved styles; a gate greps outputs for `var(` and class-only styling (kills v1 §6B-1).
- **I9 — Exact partitions.** Stage man-hours, stage BOM, and mission rollups partition their
  totals exactly (v1's proven invariant, kept — but achieved structurally, stages-first, §2.5).
- **I10 — Whole-tree gates.** Number-free, offline, determinism, fuzz, and NaN gates scan the
  entire `sap2/src` tree and every `dist` target by default; exemptions are an explicit,
  reviewed allowlist inside the gate itself (kills the v1 scoping escape §6C-N13).

### 0.2 v1 bug classes → v2 constructions (the audit's §6 lists, answered)

| v1 bug class (audit ref) | v2 construction that kills the class |
|---|---|
| Labor snapshot at module load (§6B-2) | Dataset is a compute argument; no module-scope doctrine reads exist to snapshot (I4, §2.2) |
| Machine assist double-count (§6B-3) | Work→labor conversion is the single consumer of machine leaves; scheduler divides by diggers only (I6, §2.5) |
| Platform semantics inverted engine↔render (§6B-8) | Renderers project engine-built solids; they never re-derive shape (I3, §2.3) |
| Slope-ignorant volumes (§6C-N8) | Volumes integrate the same battered-wall solids the drawings show (I3, §2.3) |
| Exported SVGs render black (§6B-1) | Renderers take a `ResolvedTheme` of hex values; `var(` is gate-banned in output (I8, §3.1) |
| Explain-trace formula drift (§6C-N1) | Trace DAG generates formula text from operands (I7, §2.4) |
| Job sheet omits validation (§6B-4) | `JobSheetModel` constructor *requires* the validation block; golden test prints a flagged scenario (§3.3) |
| Importer accepts 0-divisors / no unit check (§6B-5) | Schema bounds (`min>0` on `role:'divisor'` leaves), dimension-checked units, relational validators run at entry AND import (§1.7) |
| Orphan leaves / TIMBER outside the regime (§6C-N6/N13) | Leaf↔consumer set-equality test; nothing computes outside the schema (I5, §1.6) |
| Whole-shell innerHTML re-render (focus/scroll/canvas/aria class) | Retained static shell + targeted-update util; canvas never reparents (§4) |
| Time-planner stale snapshot "Use" (§6B-6) | Planner emits an input *delta*, applied as a patch over current inputs (§2.7) |
| Mission merges different items (§6B-7); drops validation (§6C-N11) | Merge key = `id`+`specKey`; mission carries a validation rollup (§2.7) |
| Bare-string ids everywhere (§6F) | Typed id unions from schema; strings die at the parse boundary (§1.2) |
| Hashless assets + fixed SW cache (§6B-9) | Hashed filenames; SW precache manifest and cache name generated from the build hash; node-tested (§5 G-12) |
| rAF error loops, two-tab clobber (§6D cluster) | Event-driven render scheduling with failed-region latch; session/dataset optimistic concurrency + tab lease (§4.4–4.5) |

---

## 1. Schema-first data layer — `sap2/src/schema/`

One package is the single source of truth for **what data exists**: every doctrine leaf, its
type, unit, bounds, relations, consumers, and pub pointer. Everything else — the engine's typed
reads, the Fill Station UI, the fill-checklist document, the import validator, the banner — is
**generated or derived** from it. There is no second list to drift.

### 1.1 The ship-empty principle (the liability core)

**v1's regime:** every doctrinal constant ships with an *illustrative* value flagged
`PLACEHOLDER`, behind a NOT-FOR-FIELD-USE banner. That is honest, but it still ships 295
plausible-looking numbers, 189 of them safety-critical. A screenshot, a stripped banner, a
misread flag — the tool can still be the *source* of a number someone builds to.

**v2's regime:** the schema defines leaf *identities and shapes only*. **Values do not exist in
the codebase.** The shipped artifact computes nothing until an operator supplies a dataset. This
is the strongest possible defensive posture: the software is a calculator and a stationery
printer; **the operator is the sole source of every doctrinal magnitude**, with recorded
provenance for each one. Concretely:

- `schema/leaves/*` declares leaves with **no `value` field at all**. There is nothing to leak.
- The engine's every doctrinal read returns `Filled<number> | Missing` (§2.2). Pre-fill, the
  app runs, renders its shell, and shows exactly which leaves each output is waiting on — the
  Fill Station *is* the primary first-run experience, matching the owner's stated workflow
  (personally entering the full data, piece by piece, on an air-gapped machine).
- Demo/test needs are met by **synthetic datasets** generated from schema bounds by seeded code
  in `test/fixtures/` — never bundled into `dist` (gate G-11 greps all dist targets for the
  synthetic marker and for any dataset payload). A synthetic dataset, when loaded in a dev
  build, hard-locks the banner to `NOT FOR FIELD USE — SYNTHETIC DATA` regardless of
  fill-completeness (§1.10).
- What remains in code, and why it is defensible: **structural sanity bounds** (§1.7 — e.g.
  "a shielding thickness entry must be 0.05–20 ft"; rails that catch a mistyped `14.9` for
  `1.49`, far too wide to build from), **exact physical constants** (unit conversions, π —
  v1's D6 stands), and **tool policy constants** (§1.9's `policy.ts` — presentation and ranking
  behavior, provably non-doctrinal, gate-listed). The generated fill checklist prints the
  bounds so nothing about them is hidden.

### 1.2 Typed id unions — strings die at the boundary

All catalogs live in `schema/ids.ts` as `const` arrays; every id type is derived. v1's
bare-`string` `Inputs` fields, `Record<string, …>` tables, and runtime fallbacks are gone.

```ts
// schema/ids.ts
export const POSITION_IDS = ['one_man','two_man','mg_crew','fifty_cal','mortar_pit',
  'vehicle_hull_defilade','vehicle_turret_defilade','bunker_op_cp',
  'connecting_trench','atgm_javelin'] as const;
export type PositionId = typeof POSITION_IDS[number];

export const SOIL_IDS = ['sand','sandy_loam','loam','silt','clay','gravel','rock','frozen'] as const;
export type SoilId = typeof SOIL_IDS[number];

export const THREAT_IDS = ['sa_556','sa_762','sa_127','sa_145','ind_mtr_60','ind_mtr_81',
  'ind_mtr_120','ind_art_105','ind_art_122','ind_art_152','ind_art_155',
  'at_rpg','at_recoilless','at_tank','at_he_contact','blast_demo','blast_vbied'] as const;
export type ThreatId = typeof THREAT_IDS[number];
export type ThreatSel = ThreatId | 'none';

export const SHIELD_MATERIAL_IDS = ['soil','sand','sandbagged_soil','clay','gravel',
  'concrete','steel','timber','snow_ice'] as const;
export type ShieldMaterialId = typeof SHIELD_MATERIAL_IDS[number];

export type StandardId  = 'hasty' | 'deliberate' | 'reinforced';
export type RevetmentId = 'none' | 'sandbag_facing' | 'pickets_wire' | 'corrugated_metal' | 'timber_plywood';
export type StageId     = 'security' | 'hasty' | 'deliberate' | 'revet_sump' | 'parapet' | 'overhead' | 'camo';
export type DigMethodId = 'hand' | 'machine';
```

Untrusted strings (URL/session/scenario/dataset files, DOM `data-*` values) are narrowed in
exactly one place, `schema/parse.ts`, whose codecs return typed results or typed errors:

```ts
// schema/parse.ts — the only string→union door
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: ParseIssue };
export function parsePositionId(raw: unknown): Parsed<PositionId>;
export function parseInputs(raw: unknown): Parsed<Inputs>;       // whole-record codec
export function parseDatasetFile(raw: unknown): Parsed<DatasetFile>;
```

Inside `sap2/src`, an invalid id cannot be *represented*, so the v1 fallback class
(`positions[raw] ?? positions[FALLBACK]`) has nothing to fall back from. UI state restoration
that fails to parse surfaces a recoverable error card + reset-to-defaults (I2), never a silent
substitution.

### 1.3 Leaf definitions — `LeafDef`, the catalog, and granularity

```ts
// schema/leaf.ts
export type Dim = 'length' | 'ratio' | 'count' | 'rate_vol_per_mh' | 'mh' | 'mh_per_ft3'
                | 'machineh_per_ft3' | 'area_factor' | 'ft3' | 'bool' | 'fraction';

export interface LeafDef {
  /** Canonical unit values are stored in (feet for length; see schema/units.ts). */
  dim: Dim;
  unit: CanonicalUnit;               // e.g. 'ft', 'ft3', 'mh', 'ratio', '1'
  safety: 'critical' | 'standard';
  /** Structural sanity rails — typo-catchers, not doctrine (printed on the checklist). */
  bounds: { min: number; max: number; exclusiveMin?: boolean };
  /** Declared arithmetic role; role 'divisor' forces exclusiveMin bounds > 0 (gate-checked). */
  role?: 'divisor' | 'multiplier' | 'dimension' | 'threshold' | 'count' | 'flag';
  /** Where the current pub lineage says to look — guidance text, never a value. */
  pub: { lineage: string; what: string };
  /** Human label + plain-language note for the Fill Station and checklist. */
  label: string; note?: string;
  /** True → import/apply requires the double-entry verification record (§1.8). */
  requireDoubleEntry?: boolean;      // defaulted true when safety === 'critical'
  /** Exactly-one-consumer enforcement for historically double-applied factors (I6). */
  exclusiveConsumer?: ConsumerId;
}
```

The catalog is authored per domain under `schema/leaves/` and merged by `defineLeaves`, which
also produces the `LeafId` union. Matrix families use **template-literal types** so even the
153-leaf shielding grid is compile-time-typed:

```ts
// schema/leaves/protection.ts
export type ShieldLeafId = `protection.shielding.${ThreatId}.${ShieldMaterialId}`;
export const shieldingLeaves: Record<ShieldLeafId, LeafDef> = crossProduct(
  THREAT_IDS, SHIELD_MATERIAL_IDS,
  (t, m): LeafDef => ({
    dim: 'length', unit: 'ft', safety: 'critical',
    bounds: { min: 0.02, max: 20 }, role: 'threshold',
    pub: { lineage: 'ATP 3-37.34 lineage — operator confirms current pub',
           what: `required thickness of ${m} to defeat ${t}` },
    label: `Shielding — ${threatLabel(t)} vs ${materialLabel(m)}`,
  }));

// schema/leaves/index.ts
export const LEAVES = defineLeaves({ ...shieldingLeaves, ...positionLeaves, /* … */ });
export type LeafId = keyof typeof LEAVES;               // the whole catalog, typed
```

**Granularity decision.** Keep v1's per-threat × per-material matrix (it matched how the owner
thinks about threats — D16 — and how pubs tabulate), but change three things:

1. **No derived seeding.** v1 generated the 153 shielding values as `base × materialFactor` —
   both invented. In v2 each cell is an independent operator entry (the Fill Station renders the
   matrix as an entry grid, §1.9, so 153 entries are a table-filling session, not 153 forms).
2. **Labor gets its real shape.** v1's flat `baseMH` for all ten positions is a known fidelity
   gap (audit §6F). v2's labor domain is: **dig rate per soil per method** (8 soils × 2 methods
   = 16 leaves, `role:'divisor'`, ft³/mh and ft³/machine-h), **per-position base task hours**
   (10), **feature adders** (overhead / revetment-per-face-area / sump / camo = 4), and
   **stage split fractions** (4, relation: sum = 1). 34 leaves replace v1's 7 — the honest
   granularity for data the owner intends to enter completely.
3. **Consumed-by-construction.** v1's four orphans (`overhead.sheathingThickness`,
   `dustproofThickness`, `sump.rollInSlope`, `retainingWall.thickness`) keep their leaves and
   *gain their consumers*: the OHC section build-up (sheathing + dustproof + earth bands, the
   2D plan's unexecuted R4), the floor roll-in slope in the section profile, and the
   revetment-height structural check (`validate.ts`). A leaf cannot enter the catalog without a
   consumer or the schema-integrity gate fails (I5).

### 1.4 The v1 → v2 leaf map (all 295 accounted for)

Census re-derived live from the v1 registry; dispositions:

| v1 table (leaves) | v2 domain | Disposition |
|---|---|---|
| `protection.shielding.*` (153) | `protection.shielding.<threat>.<material>` (153) | **Port 1:1**, ids re-keyed to typed unions (`sa-556` → `sa_556`); independently entered, no factor derivation |
| `protection.threats.*.standoffMin` (17) | `protection.standoff.<threat>` (17) | Port 1:1 |
| `protection.radiationHalving.*` (9) | `protection.radiation_halving.<material>` (9) | Port 1:1 (consumer: fallout readout, as v1 Phase 6) |
| `protection.parapet` W/H (2), `berm` W/H (2) | `protection.parapet.{w,h}`, `protection.berm.{w,h}` (4) | Port 1:1 |
| `protection.overhead.*` (6) | `protection.overhead.*` (6) | Port; `sheathingThickness`/`dustproofThickness` gain consumers (OHC build-up in section + BOM) |
| `protection.spanSizes[0..2].maxSpan` (3) | `protection.stringer_span.<size>` (3) | Port; relation: strictly increasing by declared size order |
| `protection.retainingWall` (2) | `protection.retaining.{max_height,thickness}` (2) | Port; both consumed by the revetment structural check |
| `positions.*` hole dims (30) + platforms (9) | `positions.<id>.hole.{l,w,d}` (30) + `positions.<id>.platform.{l,w,rise}` (9) | Port; **platform semantics renamed and fixed**: `rise` is the platform's height relative to the bay floor with an explicit sign convention defined once in the solid builder (§2.3) — the v1 `depthBelowHole` ambiguity cannot recur because renderers no longer interpret it |
| `vehicle.rampSlope` (1) | `positions.vehicle.ramp_slope` (1) | Port (still flagged structure-invented pending SME — §1.8 journal note field carries the D29 caveat) |
| `weapons.backblast.clearanceFt` (1) | `protection.backblast_clearance` (1) | Port |
| `soils.*` digFactor/wallSlopeRatio/revetForced (24) | `soils.<id>.{wall_slope_ratio,revet_forced}` (16) | wallSlopeRatio + revetForced port 1:1; **digFactor (8) retired** — superseded by per-soil dig *rates* (below), which is what pubs actually tabulate |
| `standards.*` depthMul/coverMul/laborMul (9) | `standards.<id>.{depth_mul,cover_mul,labor_mul}` (9) | Port; each multiplier carries `exclusiveConsumer` (I6) |
| `materials.*` (16) | `materials.*` (16) | Port; sandbag dims + spacing get `role:'divisor'` |
| `labor.*` (7) | `labor.dig_rate.<soil>.<method>` (16) + `labor.base.<position>` (10) + adders (4) | **Regranularized** 7 → 30; machine leaves `exclusiveConsumer:'engine.labor'` |
| `stages.excavationSplit.*` (4) | `labor.stage_split.*` (4) | Port; relation: Σ = 1 |

**v2 catalog ≈ 320 leaves** (295 − 8 retired + ~33 added: labor regranularization + a small
`overhead` build-up completion set). The exact number is pinned by the schema-integrity test
and printed by the generated checklist — the count is an output, not a maintained claim.

### 1.5 The dataset model — values live outside code, as data

```ts
// schema/dataset.ts
export interface Citation {
  pub: string;            // e.g. publication designator as the operator records it
  edition?: string;       // edition / date line
  locator: string;        // paragraph / table / page
}
export interface DatasetEntry {
  leaf: LeafId;
  value: number | boolean;
  enteredAs: { value: number | boolean; unit: EnteredUnit };  // exactly what was typed, pre-conversion
  citation: Citation;
  enteredBy: string;      // operator identity string (owner-supplied)
  enteredAt: string;      // ISO date recorded by the Fill Station (UI layer may read the clock; the engine never does)
  verification?: { method: 'double_entry' | 'second_person'; by: string; at: string };
  note?: string;
}
export type DatasetKind = 'operator' | 'synthetic';
export interface Dataset {
  schemaVersion: number;          // must match schema/version.ts
  kind: DatasetKind;
  entries: ReadonlyMap<LeafId, DatasetEntry>;
  manifest: { hash: string;       // SHA-256 over canonical serialization (v1's FNV-1a upgraded)
              journalHead: string; label?: string };
}
export function getLeaf(ds: Dataset, id: LeafId): Filled<number|boolean> | Missing;
export function fillState(ds: Dataset): { total: number; filled: number; verified: number;
                                          safetyCritical: number; safetyCriticalFilled: number };
```

Key properties:

- **Immutable value object.** v1 mutated live `Provenance` leaves in place (D8). v2's dataset
  is an immutable snapshot; "applying a fill" produces a *new* dataset value with a new hash.
  The store holds the current dataset; `compute` receives it as an argument (I4). Tests inject
  synthetic datasets without touching any global.
- **Both units recorded.** The operator enters the value in the pub's unit (inches, cm, m…);
  the entry stores what was typed *and* the canonical conversion (exact constants, D6). The
  import validator rejects a unit outside the leaf's dimension (kills v1 finding 27).
- **`enteredAt`/`enteredBy` are data, not compute.** Engine determinism is untouched: the clock
  is only ever read by the Fill Station UI when *recording provenance*, which is input data.

### 1.6 Consumers — zero orphans by construction

The engine reads doctrine **only** through typed reader handles that self-register their
manifests. There is no other read path (`Dataset.entries` is not exported to engine modules;
the lint gate G-9 enforces the import boundary).

```ts
// engine/read.ts
export type ConsumerId = 'engine.cover' | 'engine.solids' | 'engine.bom' | 'engine.labor'
  | 'engine.schedule' | 'engine.validate' | 'engine.radiation' | 'render.section' | /* … */;

export function doctrineReader<K extends LeafId>(
  consumer: ConsumerId, leaves: readonly K[],
): DoctrineReader<K>;

interface DoctrineReader<K extends LeafId> {
  num(ds: Dataset, id: K): Filled<number> | Missing;   // typed: only declared leaves compile
  bool(ds: Dataset, id: K): Filled<boolean> | Missing;
}
```

- **Compile-time:** `num(ds, id)` only accepts ids from the reader's declared list, and the
  list only accepts real `LeafId`s. A typo'd or undeclared read is a type error.
- **Test-time (gate G-9):** the union of all registered manifests must equal the leaf catalog —
  set equality both ways. A leaf nobody reads fails the build (**zero orphans, I5**); a read of
  a leaf that doesn't exist can't compile. The generated fill checklist's "consumed by" column
  comes from these manifests, so documentation cannot lie.
- **Exclusivity (I6):** a leaf with `exclusiveConsumer` set must appear in exactly that one
  manifest. `labor.machine_dig_rate` is `exclusiveConsumer:'engine.labor'` — the scheduler
  *cannot* re-apply machine assist because it cannot read the leaf (the v1 double-count is a
  compile/test failure now, not a code-review catch).

### 1.7 Bounds, relations, and the divisor class

Two validation layers, both defined in the schema and run in **three places** (Fill Station
entry, dataset import, and dataset load-from-storage — same functions all three times):

**Per-leaf bounds** (in `LeafDef`): finite, inside `[min,max]`, `role:'divisor'` ⇒
`exclusiveMin` and `min > 0` (schema self-test asserts this so a divisor leaf *cannot be
declared* zero-permissive — kills v1 §6B-5). Type must match `dim`.

**Relational validators** (`schema/relations.ts`) — typed, enumerable, each with an id, a
severity, and plain-language failure text:

```ts
export interface Relation {
  id: RelationId;
  leaves: readonly LeafId[];                      // exactly which entries it constrains
  severity: 'reject' | 'advise';                  // reject blocks apply; advise warns + requires operator ack
  check(get: (id: LeafId) => number | undefined): RelationResult;
  explain: string;                                // "stage split fractions must sum to 1"
}
```

Shipping set: `stage_split_sums_to_1` (reject), `span_sizes_increasing` (reject),
`sandbag_dims_positive` (reject, via bounds), `waste_factor_ge_1` (reject),
`swell_factor_ge_1` (reject), `wall_slope_nonnegative` (reject),
`shielding_monotone_by_material_class` and `standoff_monotone_by_caliber` (**advise** —
doctrine-shaped expectations the operator must consciously acknowledge rather than rails we
assert; the ack is recorded in the journal). Partial datasets skip relations whose leaves are
not yet all filled and report them as `pending`.

### 1.8 Import/export, the journal, and tamper evidence

`schema/io.ts` (a rewrite of v1's `doctrine/io.ts`, keeping its proven hardening list and
adding the new classes):

- **Kept from v1:** all-or-nothing apply; dry-run preview; prototype-pollution key rejection;
  version gate (file newer than app ⇒ reject); size cap; unknown-leaf rejection;
  wrong-type rejection.
- **New:** unit-dimension check per entry; bounds + relations enforced (reject class blocks the
  whole file; advise class requires an explicit acknowledgment flag in the file or interactive
  ack); citation completeness for any `verified` entry; `kind:'synthetic'` files import only in
  dev builds; SHA-256 content hash; **schema-version migration chain** — `migrations.ts` maps
  dataset schemaVersion N→N+1 with tests (v1 shipped a single identity hook, never exercised).
- **The fill journal** (`state/datasetStore.ts`): every apply/edit/verify/ack event is appended
  to a hash-chained journal in IndexedDB (`entry_n.prevHash = H(entry_{n-1})`), exportable with
  the dataset. This gives the owner a tamper-evident record: *which value, entered by whom,
  citing what, verified how, when, in what order* — the audit trail that makes "the human is
  the source, with recorded provenance" a demonstrable fact rather than a claim. The journal
  head hash is embedded in the dataset manifest and printed on every job sheet footer next to
  the app build hash (§3.3).
- **Double-entry verification:** safety-critical leaves default `requireDoubleEntry`. The Fill
  Station's verify pass re-prompts for the value blind (no display of the stored value); a
  mismatch flags the entry for re-check. For 300+ hand-keyed numbers this is the single
  highest-value typo defense we can build, and it produces a `verification` record per leaf.

### 1.9 Generated artifacts — checklist and Fill Station

- **`scripts/gen-fill-checklist.ts`** emits `sap2/docs/FILL_CHECKLIST.md` from the catalog:
  one row per leaf — id, label, dim/unit, bounds, safety flag, pub pointer, consumers (from
  manifests), verification requirement. CI gate G-9 regenerates and diffs: the committed doc
  can never drift from the schema. This replaces v1's hand-maintained `DOCTRINE_SOURCES.md`.
- **The Fill Station** (`fill/`) is *generated from the same catalog*: domains → sections;
  matrix families (shielding 17×9, dig rates 8×2) → entry **grids** with row/column headers
  from the id unions; scalar leaves → forms. Per entry: value + unit picker (leaf's dimension
  only), citation fields, note; live bounds/relations feedback; progress by domain and by
  safety class; blind double-entry verify mode; journal viewer; export/import. The Fill
  Station has **no numeric suggestions anywhere** — placeholder text shows units and bounds,
  never example values (I1 extends to hint text; gate G-2 scans the fill/ source too).
- **`schema/policy.ts`** is the one sanctioned home for non-doctrinal tool-behavior constants
  (planner ordering, display precision, layout budgets), each with a written rationale
  comment. The number-free gate (G-2) allowlists exactly this file and the render px-constant
  modules — the allowlist lives *in the gate's config*, reviewed like code (I10).

### 1.10 The banner — a five-state machine, not a counter

v1's banner is `placeholder count > 0`. v2's is an explicit state machine derived from
(dataset kind, fill state, verification state):

| State | Condition | Banner |
|---|---|---|
| `EMPTY` | no dataset loaded | `NO DATA LOADED — enter doctrine via Fill Station` |
| `SYNTHETIC` | dataset.kind = synthetic | `NOT FOR FIELD USE — SYNTHETIC DATA` (cannot clear; dev builds only) |
| `PARTIAL` | operator dataset, any consumed leaf Missing | `NOT FOR FIELD USE — DATA INCOMPLETE (n remaining)` |
| `UNVERIFIED` | complete, but any safety-critical entry lacks its verification record | `NOT FOR FIELD USE — VERIFICATION INCOMPLETE (n remaining)` |
| `COMPLETE` | complete + verified | banner clears; every output still carries the provenance footer (dataset hash + journal head + app build hash) and the "planning aid — verify against current pubs" line |

The `engineered_required` hard fail-safe is **unchanged from v1 and non-negotiable**: direct-fire
AT and large-VBIED threats, unknown threats, and beyond-table spans resolve to an engineered-roof
call with zero fabricated thickness at every fill state, including `COMPLETE` (§2.3's
`cover.ts` single authority, fuzz-asserted).

---

## 2. Engine v2 — `sap2/src/engine/`

### 2.1 Module map

```
engine/
├── types.ts        Inputs (typed ids), Result, BomLine, ValidationIssue — public contracts
├── read.ts         doctrineReader handles (§1.6) — the only doctrine access path
├── trace.ts        Traced values + op combinators + TraceGraph (I7)
├── missing.ts      Filled<T> | Missing algebra — fail-closed propagation (I2)
├── round.ts        ceilInt / round1 / round2 / clamp / finite    ← PORT v1 AS-IS (proven)
├── solids.ts       the geometry kernel: typed solids → volume / section / plan (I3)
├── cover.ts        resolveCover — the single roof/cover authority  ← port v1 semantics, rewrite for dataset arg
├── geometry.ts     GeometryModel builder (typed; solids + dims + annotations)
├── work.ts         WorkPlan: stage-first work items (the primary decomposition, I9)
├── bom.ts          BOM lines from work items (id + specKey)
├── labor.ts        work → man-hours & machine-hours; SOLE consumer of machine/dig-rate leaves (I6)
├── schedule.ts     stage clock from labor-by-stage + team/posture; never touches machine leaves
├── validate.ts     typed validation catalog (schema/validationCodes.ts) — ports v1's 21 codes + new
├── mission.ts      rollup: merge by id+specKey, validation rollup, on-hand → shortfall
├── plan.ts         inverse time-available planner — lexicographic ranking, emits input DELTAS
├── radiation.ts    fallout halving readout (consumer of radiation_halving leaves)
└── compute.ts      the orchestrator: compute(inputs, dataset) → Result
```

### 2.2 The compute signature — live doctrine by construction

```ts
// engine/compute.ts
export function compute(inputs: Inputs, dataset: Dataset): Result;

// engine/types.ts
export interface Inputs {
  schemaVersion: number;
  positionType: PositionId;          // typed unions — no bare strings (I2/§1.2)
  standard: StandardId;
  soil: SoilId;
  threat: ThreatSel;
  revetment: RevetmentId;
  overheadCover: boolean; sump: boolean; firingStep: boolean;
  camouflage: boolean;    machineAssist: boolean;
  count: number; teamSize: number;
  unit: 'imperial' | 'metric';       // display-only; engine works in feet (v1 D17 kept)
  sectors?: { azimuthDeg: number; leftDeg: number; rightDeg: number };  // real azimuth input (fixes v1 N4/40)
}

export type Q = Filled<Traced<number>> | Missing;   // every doctrinal-derived quantity

export interface Result {
  inputs: Inputs;
  dataset: { hash: string; kind: DatasetKind; state: BannerState };   // provenance rides the Result
  availability: { complete: boolean; missing: LeafId[] };             // what's blocking, exactly
  geometry: GeometryModel;           // TYPED — `unknown` at the render seam is dead (v1 §6F)
  cover: CoverResolution;            // roofPath / thickness Q / material / reason
  bom: BomLine[];
  work: WorkPlan;                    // stage-first (§2.5)
  labor: LaborResult;
  validation: ValidationIssue[];     // typed codes, deterministic order
  trace: TraceGraph;                 // §2.4 — replaces v1's hand-built derivations
  fidelity: FidelityStatement[];     // model-fidelity regime carried from v1 D29
}
```

- **The v1 snapshot class is unrepresentable:** engine modules have no import path to a global
  doctrine object — there is none. The store composes `(inputs, dataset)` at call time; a fill
  apply produces a new dataset value and the next compute sees it. Gate G-2's companion lint
  (G-9) fails any engine module importing anything from `state/` or holding module-scope
  reads.
- **Fail-closed propagation:** `missing.ts` gives `Q` a small monadic algebra — an operation
  over any `Missing` operand is `Missing` with the union of blocking `LeafId`s. Renderers
  receive typed `Missing` and draw the `REQUIRES DATA` treatment with the exact leaf names
  (linkable to the Fill Station); nothing NaNs, nothing defaults (I2). The fuzz gate runs the
  full input matrix against *randomly partial* datasets to prove totality (§5 G-6 — v1 never
  fuzzed the data axis).

### 2.3 The geometry kernel — one geometric truth (I3)

The root cause of v1's platform inversion (§6B-8) and slope-blind volumes (§6C-N8) was that
*engine, 2D, and 3D each re-derived shape from shared scalars*. v2 centralizes shape:

```ts
// engine/solids.ts — pure, dataset-fed, feet everywhere
export type Solid =
  | { kind: 'batteredPrism'; id: SolidId; role: SolidRole;
      footprint: Poly2;                 // plan outline at the FLOOR
      depth: number;                    // vertical extent
      batter: { ratio: number };        // H per 1 V from soils.<id>.wall_slope_ratio — walls flare outward toward grade
      topOffset?: number }              // grade-relative placement
  | { kind: 'frustum';  id: SolidId; role: SolidRole; rBottom: number; rTop: number; depth: number; center: Vec2 }
  | { kind: 'rampWedge';id: SolidId; role: SolidRole; width: number; depth: number; runPerFt: number; from: Vec2; heading: Heading }
  | { kind: 'slab';     id: SolidId; role: SolidRole; footprint: Poly2; thickness: number; topAt: number };

export type SolidRole = 'bay' | 'platform' | 'sump' | 'ramp' | 'parapet' | 'berm'
                      | 'cover_earth' | 'cover_sheathing' | 'cover_dustproof' | 'firing_step';

export function buildSolids(inputs: Inputs, ds: Dataset): Filled<Solid[]> | Missing;
export function volume(s: Solid): number;                  // exact prismatoid: V = d/6 · (A_top + 4·A_mid + A_bot)
export function planOutline(s: Solid, at: 'grade' | 'floor'): Poly2;
export function sectionProfile(solids: Solid[], cut: CutLine): SectionProfile;  // roles preserved
```

- **Excavation volume is slope-aware by construction:** `volume(batteredPrism)` integrates the
  same battered walls the section shows and the 3D taper draws — the prismatoid formula is
  exact for linear batter. A sand cut (1.48 H:V) and a rock shaft now yield different spoil,
  and the number, the picture, and the diorama *cannot* disagree because they are the same
  polygon (I3). Explain traces show the batter operand.
- **Platform semantics defined exactly once:** `positions.<id>.platform.rise` (schema-renamed,
  §1.4) is consumed only by `buildSolids`, which places the platform solid with a documented
  sign convention (positive rise = raised deck standing proud of the bay floor; negative =
  dug below). Renderers project `sectionProfile()` — they contain no platform math at all, so
  the v1 inversion class has no second author to disagree with. The convention question itself
  (raised vs dug for each position) becomes an operator-confirmable fact recorded in the
  dataset entry note, resolved with the D29 SME review.
- **The circular pit, ramp wedge, and sump volumes** keep v1's proven math (π/4 plan factor via
  `frustum`, the ramp wedge with run-per-foot from `positions.vehicle.ramp_slope`) — ported
  into solid builders with their tests re-derived independently, as v1's engine-formula suite
  already does.
- **`cover.ts` — port of v1's `resolveCover` single-authority pattern (proven, keep the
  concept exactly):** threat-driven, span-driven, and unknown-threat paths all resolve through
  one function; `engineered_required` emits no thickness at any fill state; the span table read
  is a `doctrineReader('engine.cover', […])`. This module and its fail-safe tests port with
  review, re-based on `Q` returns.

### 2.4 The trace DAG — explanations that cannot lie (I7)

v1's `explain.ts` hand-writes formula strings next to (not from) the computation — which is how
the ramp term went missing from the excavation formula (§6C-N1). v2 computes *through* the
trace:

```ts
// engine/trace.ts
export interface Traced<T> { v: T; node: NodeId }
export interface TraceNode {
  id: NodeId; label: string; unit: UnitId;
  op: 'sum' | 'product' | 'scale' | 'max' | 'min' | 'ceil' | 'sub' | 'div' | 'leaf' | 'input' | 'const';
  deps: NodeId[];                       // operands actually used
  leaf?: LeafId;                        // when op === 'leaf': the dataset entry (citation joinable)
  value: number;
}
export interface TraceGraph { nodes: ReadonlyMap<NodeId, TraceNode>; roots: NodeId[] }

// combinators — the ONLY arithmetic engine modules use on doctrinal quantities
export const T: {
  leaf(r: DoctrineReader<any>, ds: Dataset, id: LeafId): Q;
  sum(label: string, unit: UnitId, ...xs: Q[]): Q;
  product(label: string, unit: UnitId, ...xs: Q[]): Q;
  div(label: string, unit: UnitId, num: Q, den: Q): Q;   // Missing on zero denominator (belt over §1.7's braces)
  max(label: string, unit: UnitId, ...xs: Q[]): Q;
  ceil(label: string, x: Q): Q;
};
```

The display formula (`excavBank = holeVol + platformVol + sumpVol + rampVol`) is **generated**
from `op` + dep labels at render time. If the computation includes an operand, the formula
names it; if it doesn't, it can't. Leaf nodes join to dataset entries, so every tap-to-explain
bottoms out at *value → citation → who entered it → verification* — the full liability chain,
on every number, in the UI and on paper. Snapshot gate G-8 pins the DAG per baseline scenario;
determinism gate G-5 asserts byte-identical graphs.

Overhead cost is bounded: ~50–80 nodes per compute, plain objects, no allocation cleverness
needed to hold v1's 16 ms compute budget (perf test ports forward).

### 2.5 Work → labor → schedule — stage-first, machine applied once (I6, I9)

v1 computed a labor *total*, then recovered the stage partition by subtracting adders — exact,
but fragile (the audit's `chargedRevetLabor` footwork), and the machine factor leaked into two
places. v2 inverts the flow — **stages are primary**:

```ts
// engine/work.ts
export interface WorkItem {
  id: WorkId; stage: StageId;                    // schema maps each WorkKind → exactly one stage
  kind: 'excavate' | 'fill_bags' | 'place_revet' | 'build_cover' | 'dig_sump' | 'camo' | 'doze';
  quantity: Q; unit: 'ft3' | 'each' | 'ft2';
  method: 'hand' | 'machine';                    // resolved ONCE here from inputs.machineAssist + kind
}
export interface WorkPlan { items: WorkItem[]; byStage: ReadonlyMap<StageId, WorkItem[]> }

// engine/labor.ts — the ONLY consumer of labor.dig_rate.* / machine leaves (exclusiveConsumer)
export function buildLabor(plan: WorkPlan, inputs: Inputs, ds: Dataset): LaborResult;
// per stage: manHours + machineHours; totals = Σ stages BY CONSTRUCTION (I9)

// engine/schedule.ts — consumes labor-by-stage ONLY; cannot see machine leaves (compile+gate)
export function scheduleStages(labor: LaborByStage, opts: {
  teamSize: number; availableHours: number; securityPostureFrac: number;
}): Schedule;   // effectiveDiggers = team × posture. No machine term exists here.
```

- Machine assist changes a WorkItem's `method`; `labor.ts` prices method against the matching
  dig-rate leaf. One application point, enforced by `exclusiveConsumer` (§1.6) — the schedule
  double-count (§6B-3) is now a *type/test impossibility*, and machine-inapplicable stages
  (camo, cover carpentry) are hand-method by schema, fixing the v1 "dozer speeds up
  camouflage" fidelity gap for free.
- **Exact partition is structural:** position totals are *defined as* the stage sums; BOM lines
  are emitted per work item and carry `stage`, so stage-BOM partition is definitional too.
  v1's partition invariant tests port forward as regression insurance.
- Blade-hours stay their own axis (v1 D29 kept).

### 2.6 The validation catalog

`schema/validationCodes.ts` declares the catalog as data — code id union, severity, message
template (plain-language-first), doc note, and a `printOnJobSheet: true` default:

```ts
export type ValidationCode = 'REVET_REQUIRED_SOIL' | 'SHORING_DEPTH' | 'SPOIL_SHORT'
  | 'SPOIL_EXCESS' | 'WET_SOIL_DRAINAGE' | 'ATGM_BACKBLAST' | 'MORTAR_ROOF_CONFLICT'
  | 'HASTY_ROOF_UNDER_THREAT' | 'SANDBAG_BASIC_LOAD' | 'MACHINE_REQUIRED_VEHICLE'
  | 'ENGINEERED_ROOF_REQUIRED' | 'DATA_INCOMPLETE' | 'SECTOR_GEOMETRY' | 'REVET_HEIGHT_LIMIT'
  | /* … full port of v1's 21 + new */;
```

All of v1's 21 codes port (they were reachability-tested and good). New: `DATA_INCOMPLETE`
(surfaces `availability.missing` as a first-class issue), `SECTOR_GEOMETRY` (left<right,
wrap-around, width sanity — v1 never validated sectors), `REVET_HEIGHT_LIMIT` (consumes
`protection.retaining.max_height`, closing that orphan). Deterministic ordering ports.
Renderer-side, the job sheet and mission views *cannot omit* the block (§3.3).

### 2.7 Mission, planner

- **Mission (`mission.ts`):** merge key becomes `id + specKey` where `specKey` encodes the
  spec-differentiating fields (stringer size label, panel type, bag type) — materially
  different items never collapse (§6B-7 dead). The rollup carries
  `validationByPosition: Map<label, ValidationIssue[]>` + a deduped union, so engineered-roof
  and revet-forced flags survive aggregation (§6C-N11 dead).
- **Planner (`plan.ts`):** v1's invented 4/3/1 weights are deleted, not relocated. Ranking is
  **lexicographic**: (1) meets-threat protection (cover resolution satisfied), (2) standard
  order (schema-declared `hasty < deliberate < reinforced`), (3) fits available time,
  (4) total man-hours ascending. All five revetments and the machine toggle enter the search
  space (fixes §6C-N7 fully). The result is a ranked list of **input deltas**
  (`Partial<Inputs>` patches); "Use" applies the delta over *current* inputs via the store —
  the stale-snapshot revert (§6B-6) is structurally gone.

### 2.8 Port vs rewrite — explicit dispositions

| v1 module | Disposition | Why |
|---|---|---|
| `engine/round.ts` | **Port as-is** (review only) | Proven NaN-containment helpers; tests port with it |
| `render3d/propLayout.ts` | **Port as-is** | Node-tested bond/grid math; D28's determinism rules (hash jitter, 3-axis tiling) are exactly right |
| `render/project.ts` (one projector per view) | **Port the pattern**, re-type to `GeometryModel` | Proven seam; only the input type changes |
| `engine/stages.ts` partition *invariant* + tests | **Port the invariant, rewrite the mechanism** | Exact-partition stays (I9) but becomes stages-first (§2.5), retiring the subtraction-recovery |
| `engine/protection.ts` `resolveCover` | **Port semantics, rewrite plumbing** | The single-authority + fail-safe design is the crown jewel; re-based on dataset arg + `Q` |
| `render3d/scene3d.ts` descriptor split; `ui/engine/*` diorama (palette, textures, terrain, sky, post, bagInstancing) | **Port with review** | Audit calls the pure-descriptor + viewer split and diorama engine good; carried into §3.5's v2 contract |
| `render/svg.ts` primitives + `guard()` + callout registry | **Port with one change** | Proven; colors become `ResolvedTheme` parameters (I8), registry moves to `schema/callouts.ts` |
| `engine/compute.ts`, `explain.ts`, `labor.ts`, `materials.ts`, `geometry.ts` | **Rewrite** | Re-founded on solids + trace DAG + work plan (§2.3–2.5) |
| `doctrine/io.ts` | **Rewrite, keep the hardening list** | New dataset model (§1.8); every v1 rejection case ports as a test |
| `state/store.ts`, `history.ts`, `persistence.ts` (adapter pattern), `scenarios.ts` | **Port with review** | Small and sound; add selector subscriptions (§4.1) and optimistic versioning (§4.4) |
| `ui/three-viewer.ts` | **Substantial port** | Keep: toon pipeline, instancing, watchdog, `preserveDrawingBuffer:true` (D21), Group-wrapped outline meshes (D22). Fix in port: camera re-frame on position change (N5), idle render loop (finding 73–74), capability-checked MSAA (finding 48) |
| `ui/main.ts`, `layout/*` (HTML-string shell) | **Rewrite** | The innerHTML-shell architecture is the §4 bug class being killed |
| `engine/mission.ts`, `plan.ts` | **Rewrite** (small) | §2.7 changes are semantic, not just plumbing |
| v1 test suites | **Port aggressively** | Formula re-derivation, fuzz harness seeds, NaN matrix, render-intuitive conventions, scene3d honesty invariants all carry; they are the parity instrument (§6.2) |

---

## 3. Render contracts — `sap2/src/render/` (2D + print) and `sap2/src/scene/` (3D)

### 3.1 Self-contained SVG, always (I8)

Every renderer takes resolved colors; no emitted artifact ever references app CSS:

```ts
// render/theme.ts
export interface ResolvedTheme {          // concrete hex values, no vars
  surface: string; ink: string; accent: string; hazard: string;
  earthFill: string; spoilHatch: string; calloutFill: string; calloutText: string;
  /* … the full token set, typed and closed */
}
export const DAY: ResolvedTheme;  export const NIGHT: ResolvedTheme;
export const PRINT: ResolvedTheme;        // always-white print palette (v1 D14's insight, systematized)

// render/drawPlan.ts (same shape for every view)
export function drawPlan(model: RenderModel, opts: RenderOpts): SvgDoc;
export interface RenderOpts {
  theme: ResolvedTheme;
  stage?: StageId | 'complete';           // stage-true 2D (v1 plan U3, now core)
  highlight?: 'stage_delta' | 'none';
  titleBlock: TitleBlock;                 // REQUIRED: name, position, dataset hash, banner state, scale, date line
}
export interface SvgDoc { svg: string; callouts: CalloutId[]; warnings: string[] }
```

- On screen, the app passes the active theme's resolved values; the download path writes the
  *same string* to disk — there is no separate export code path to rot. The v1 black-SVG class
  (§6B-1) cannot recur: gate G-4 asserts every emitted SVG/HTML artifact contains no `var(`,
  no external URL, no class attribute without a matching embedded `<style>` rule, and a
  title block.
- v1's `svg.ts` primitives, non-finite `guard()`, and escaping port as-is (§2.8).
- Missing-data treatment is a first-class drawing element: a hatched `REQUIRES DATA` chip with
  the leaf label(s), rendered wherever a `Q` is `Missing` — the drawing never silently omits.

### 3.2 One projector per view; one callout registry for every surface

- `render/project.ts` ports: each view (plan, section, iso-scene) constructs exactly one
  feet→px projector; nothing else does coordinate math.
- The callout registry moves to **`schema/callouts.ts`** (typed `CalloutId`, number, plain-
  language-first label — v1's D12/D23 conventions kept verbatim, including the pinned
  "Sectors of fire" label). Consumers: 2D drawings, legends, **build cards**, 3D part labels,
  job sheet, and the reference sheet — one numbering across every surface a Marine sees, so a
  "③ parapet" on the build card is the same ③ in the plan, the section, and the 3D label. The
  legend generates from the callouts a view actually drew (v1's can't-drift mechanism, kept).

### 3.3 Print pipeline

```
render/print/
├── pages.ts        Page/Block composition, page-break-safe, PRINT theme forced
├── jobSheet.ts     the job sheet document
└── buildCards.ts   §3.4
```

`JobSheetModel`'s constructor signature **requires** the validation block and provenance
footer — a job sheet without them is unrepresentable (kills §6B-4):

```ts
export function buildJobSheet(m: {
  result: Result; plan: SvgDoc; section: SvgDoc; stagePlan: StagePlanView;
  validation: ValidationIssue[];            // required, rendered even when empty ("No flags")
  provenance: { appVersion: string; buildHash: string; datasetHash: string;
                journalHead: string; bannerState: BannerState };
  fieldHeader: FieldHeaderBlanks;           // grid/unit/DTG/azimuth/prepared-by (hand-filled; kept from v1 D32)
}): PrintDoc;
```

Every printed page footer carries `appVersion + buildHash + datasetHash + journalHead +
bannerState` — the attributable-evidence chain (§1.8). Human-readable labels everywhere (v1
finding 41's raw-enum leak is precluded by rendering labels from schema, which has them for
every id). Pop-up-blocked print falls back to an HTML download (v1 behavior kept).

### 3.4 Build cards — the "recruit can follow it" deliverable

A generated, per-stage instruction packet — the backend contract for mandate #4:

```ts
// render/print/buildCards.ts
export function buildCards(result: Result, labor: LaborResult): BuildCard[];
export interface BuildCard {
  stage: StageId; index: number; total: number;
  title: string; plainSteps: string[];       // from schema stage text — plain-language-first
  crew: { diggers: number; tasks: string[] };
  tools: ToolLine[];                          // schema-declared per work kind
  materials: BomLine[];                       // EXACTLY the stage's BOM partition (I9)
  time: { manHours: Q; machineHours?: Q };
  checks: CheckLine[];                        // per-stage QA: e.g. depth vs armpit-check, slope, sump drainage
  drawings: { plan: SvgDoc; section: SvgDoc; iso: SvgDoc };  // stage-state, delta-highlighted
  callouts: CalloutId[];                      // shared registry (§3.2)
}
```

The three drawings render at `stage: k, highlight: 'stage_delta'` — *what exists now*, with
*what you add this stage* highlighted. The iso comes from `scene/isoFromScene.ts` (§3.5), so
build cards are fully renderable and **golden-testable in node, no browser** (§5 G-8). Checks
are schema-declared per stage (with `Q` thresholds from leaves where doctrinal — e.g. the
armpit-depth check reads the position's depth leaf), so QA lines carry the same provenance as
every other number.

### 3.5 3D — descriptor v2, viewer port, and the print-safe iso

Keep v1's split exactly (audit: it's good): **`scene/` is pure descriptor (no three.js,
node-tested); `viewer/` is the only three.js consumer.** The diorama engine (terrain crust
with true holes, painted sky, per-soil surfaces, instanced bonded bags, post pipeline) ports
with review (§2.8).

**The v2 descriptor contract** — additions over v1: stable part ids, stage tagging on every
part (not a filter side-effect), highlight-delta, and typed cutaway:

```ts
// scene/descriptor.ts
export interface SceneView {
  stage: StageId | 'complete';
  cutaway?: { plane: 'section_aa' | 'longitudinal'; offsetFt?: number };
  highlight?: 'stage_delta' | { parts: PartId[] } | 'none';
}
export interface ScenePart {
  id: PartId;                     // stable across stages/views — the delta and cross-surface joins key on it
  kind: 'box' | 'cyl' | 'ring' | 'frame' | 'wedge' | 'arrow' | 'figure';   // v1 part kinds carried
  role: PartRole;                 // v1 BoxRole union carried + typed
  stageAdded: StageId;            // when this part comes into existence
  callout?: CalloutId;            // joins 3D labels to the shared registry (§3.2)
  highlight: boolean;             // resolved per SceneView
  finish?: WallFinish;            // honest materials (v1 D25 kept)
  /* geometry fields as v1 (taper, shear, …) — solids-derived, not re-derived */
}
export interface SceneDescriptor {
  parts: ScenePart[]; terrain: TerrainSpec;    // v1 TerrainSpec carried
  bounds: { size: number; depth: number };
  honesty: { engineeredRoof: boolean; bannerState: BannerState; missing: LeafId[] };
  empty?: { reason: string };                   // explicit empty state (fixes N10)
}
export function buildScene(result: Result, view: SceneView): SceneDescriptor;

// scene/isoFromScene.ts — NEW: deterministic SVG isometric projection of the descriptor.
// Replaces v1's shape-blind drawIso (R8 resolved by replacement); serves as the no-WebGL
// fallback AND the browser-free build-card/job-sheet 3D figure. Golden-tested per stage.
export function isoFromScene(d: SceneDescriptor, opts: RenderOpts): SvgDoc;
```

- `buildScene` derives footprints from the engine's solids (§2.3) — the descriptor never
  re-derives geometry, closing the last engine↔render seam.
- Honesty invariants port: engineered threats produce no cover part at any stage; the
  fail-safe is asserted per-stage in node tests (v1's scene3d suite pattern).
- **Viewer port fixes (from the audit, done during the port):** re-frame camera on position
  change (N5); render-on-demand loop that idles (73–74); MSAA/HalfFloat behind capability
  checks (48); vertical-relief exaggeration either removed or drawn with an explicit on-canvas
  "not to scale" scale-break marker (N10) — the descriptor carries true feet; exaggeration, if
  kept, is a viewer display transform labeled as such.

---

## 4. UI architecture — `sap2/src/ui/` (zero runtime deps beyond `three`)

v1 re-renders the entire shell as one innerHTML string per keystroke — the root of the
focus/scroll/canvas-reparenting/aria bug family and the D21 canvas workaround. v2 kills the
class with a **retained static shell + targeted updates**. No framework; one small utility.

### 4.1 Static shell + keyed regions

`ui/index.html` ships the full app skeleton **statically**: topbar, banner slot, controls
region, drawings region, a **permanent 3D socket** (the canvas mounts once and never moves —
re-parenting is not mitigated, it is abolished), panels, overlay root, toast root, sr-status
live region, skip link. Each region has a stable id and a renderer module:

```
ui/
├── index.html          static shell (all regions, aria landmarks, overlay/toast roots)
├── main.ts             boot: parse state, wire store→regions, delegated events (thin)
├── dom.ts              the targeted-update utility (§4.2)
├── overlay.ts          §4.3
├── errors.ts           §4.5
├── regions/
│   ├── controls.ts     inputs generated from schema (labels+hints from LeafDef/id tables)
│   ├── banner.ts       the §1.10 state machine surface
│   ├── drawings.ts     plan/section SVG region (innerHTML allowed: inert content)
│   ├── viewerDock.ts   stage scrubber, cutaway, view chips around the static socket
│   ├── specs.ts / bom.ts / labor.ts / checks.ts / stagePlan.ts / trace.ts
│   └── fillStation.ts  hosts fill/ UI inside the overlay system
└── styles/  tokens.css + app.css (day/night themes; PRINT theme lives in render/theme.ts)
```

The store (ported, §2.8) gains **selector subscriptions**: a region subscribes with a selector
+ equality fn and re-renders only when its slice changes — the drawings region doesn't touch
DOM when only a panel number moved.

### 4.2 `dom.ts` — the ~200-line targeted-update utility (the whole "framework")

Three primitives plus a guardrail; nothing else is permitted to mutate the DOM:

```ts
// 1. Fine-grained setters — idempotent, no-op when unchanged
export function text(el: Element, s: string): void;
export function attr(el: Element, name: string, v: string | null): void;
export function cls(el: Element, name: string, on: boolean): void;
export function value(el: HTMLInputElement | HTMLSelectElement, v: string): void; // skips when focused & equal

// 2. Keyed list reconciler (~70 lines) — BOM rows, validation list, stage table, scenario list
export function list<T>(container: Element, items: T[], key: (t: T) => string,
                        create: (t: T) => Element, update: (el: Element, t: T) => void): void;
   // reorders by key, creates/removes at edges, never rebuilds surviving rows → row focus/scroll live

// 3. Inert-region swap — innerHTML allowed ONLY here
export function swap(region: Element, html: string): void;
   // dev-mode assertion THROWS if region contains document.activeElement, a <canvas>,
   // an open <details>, or [data-retain] — structurally prevents the v1 class from creeping back
```

Rules of engagement (enforced by G-9's lint pass): `swap` callers must be regions declared
inert (drawings SVG, legend, help text); `controls.ts` builds its fields once from schema and
thereafter uses only setters (`value`, `attr` for aria/validity, `cls`); focus and scroll are
therefore *never restored* because they are *never destroyed* — v1's focus/scroll restoration
machinery is deleted, not ported. Total budget: ≤ 200 lines + comments; it is application
code, not a framework — no components, no lifecycle, no virtual DOM.

### 4.3 Overlay & focus primitives

One `overlay.ts` used by every tool (scenarios, mission, compare, plan, schedule, Fill
Station, confirm dialogs):

```ts
export function openOverlay(opts: {
  title: string; content: Element; labelledBy?: string;
  onClose?: () => void; initialFocus?: HTMLElement;
  destructiveGuard?: { dirty: () => boolean; confirmText: string };  // silent-discard class (v1 55/57) dead
}): OverlayHandle;  // { close(), el }
```

Behavior (the v1 Phase-2 findings, solved once): focus trap (Tab cycles inside), background
`inert` (with `aria-hidden` fallback), Escape + outside-click close (blocked when
`destructiveGuard.dirty()`), focus returns to the opener on close, stacking with a single
z-order manager, scroll lock. Native `<details>` menus keep v1's D24 pattern. Keyboard
shortcuts (undo/redo) check `event.target` editability — the Ctrl+Z hijack (finding 54) dies
in the one delegated handler.

### 4.4 Two-tab session safety

- **Session snapshot (localStorage):** writes carry `{tabId, seq}`; a `storage` event bearing a
  foreign `tabId` flips the tab into "another tab is active" mode — a non-blocking bar offering
  *take over* (re-reads state) or *continue here* (bumps seq). Last-writer-wins is replaced by
  detect-and-choose; nothing silently clobbers (findings 68–69 dead).
- **IndexedDB (scenarios + dataset + journal):** every record carries a `version` counter;
  writes are compare-and-swap in a transaction — a stale write fails cleanly and the UI
  re-reads and re-offers. The **Fill Station takes a lease** (BroadcastChannel + heartbeat
  key): a second tab opens the Fill Station read-only with an explicit "take over editing"
  action. The hash-chained journal (§1.8) makes any interleaving auditable after the fact.
- Storage-disabled environments (v1 finding 70): all storage access goes through one
  `state/env.ts` capability probe; absence degrades to in-memory with a visible notice —
  never a boot crash.

### 4.5 Error recovery — no rAF loops, no white screens

- **Render scheduling:** store notifications mark dirty regions; one microtask flush per burst
  renders them. There is **no persistent requestAnimationFrame loop** in the 2D app at all;
  the 3D viewer's loop runs only while animating/dragging and parks itself idle (§3.5).
- **Failure latch:** `safeCompute`/`safeRegion` wrap every compute and region render. A failure
  puts *that region* into a failed state with an error card (message, "copy diagnostics",
  "reset this panel", "reset app to defaults") and **latches** — it will not re-attempt until
  a genuine state change or explicit user action, so the v1 error→rAF→error spiral (findings
  51–53) is structurally impossible. Other regions keep working; compute failures keep the
  last good Result on screen, clearly marked stale.
- **Boot guard:** a try/catch shell around boot renders a minimal static failure page with
  recovery actions (clear session / reload) — never a blank document.

---

## 5. Gates & tests

Everything v1 gates, re-scoped to the **whole tree** (I10), plus the new classes. Runner stays
`node:test` + `tsx` (zero-dep philosophy holds; dev tooling exempt per v1 D3). One browser
suite exists, isolated and explicit.

| # | Gate | Scope & mechanism | Browser? |
|---|---|---|---|
| G-1 | Typecheck | `tsc --noEmit`, extra-strict flags (v1 D4 set), **includes every vite config and every script** (fixes §6B-13) | no |
| G-2 | **Number-free** | Scans **all of `sap2/src`** for bare decimal/magnitude literals. Default = scanned; the only exemptions are an explicit allowlist *inside the gate config* (`schema/policy.ts`, `schema/leaves/*` bounds, render px-constant modules, theme hex files) — a new directory is in-scope the moment it exists, so the TIMBER escape (§6C-N13) cannot recur | no |
| G-3 | **Offline** | Source scan: no network primitives (`fetch`, `XMLHttpRequest`, `WebSocket`, `import()` of URLs) anywhere in `src` outside the SW's own cache logic; dist scan: zero external URLs in **every build target** (PWA dist, standalone HTML, any future target — the gate enumerates `dist*/` by glob, fixing §6B-11) | no |
| G-4 | **Self-contained artifacts** | Every emitted SVG/HTML export in goldens + a live render pass: no `var(`, no external refs, styles embedded, title block present (I8) | no |
| G-5 | **Determinism** | Byte-identical `Result`, `TraceGraph`, SVG strings, and `SceneDescriptor` for repeated `(inputs, dataset)` runs; metric==imperial result equality; **two-build reproducibility**: build twice, compare `dist` hashes (requires the deterministic-build config below) | no |
| G-6 | **Fuzz** | Seeded: full input matrix × {complete synthetic datasets, **randomly partial datasets**, boundary-value datasets (min/max bounds)} — never throws, never NaN, never a fabricated engineered thickness, `Missing` never reaches an SVG attribute. The dataset axis is new: v1 only ever fuzzed inputs; the owner's hand-entered data will exercise value ranges v1 never saw | no |
| G-7 | **NaN matrix** | v1's position×threat×toggle render matrix, ported, plus `guard()` throw tests | no |
| G-8 | **Snapshots & goldens** | Trace-DAG snapshots per baseline scenario; **byte-golden SVG renders** for plan/section/iso, the job sheet, and **every build card of a reference scenario set** (a flagged-validation scenario is one of them — proving the job sheet prints its flags); regeneration is an explicit script with a review-diff | no |
| G-9 | **Schema integrity** | Leaf↔consumer set equality (zero orphans, I5); exclusive-consumer uniqueness (I6); divisor leaves have positive exclusive bounds; relations self-test; id unions ↔ leaf families consistent; generated `FILL_CHECKLIST.md` matches the schema (drift = fail); import-boundary lint (engine can't import state; only `dom.ts` touches DOM mutation; only `viewer/` imports three) | no |
| G-10 | **Fill workflow E2E (node)** | schema → blank dataset → programmatic fill (synthetic, seeded) → bounds/relations/unit rejections each exercised → double-entry mismatch path → apply → banner walks EMPTY→PARTIAL→UNVERIFIED→COMPLETE → compute matches injected values → export→import round-trips byte-identically → journal hash chain verifies → migration chain test (vN-1 file upgrades) | no |
| G-11 | **Dataset hygiene** | Every dist target greps clean of: any dataset payload, the synthetic marker, any `LeafId → number` mapping (I1 — the shipped artifact provably contains no doctrine) | no |
| G-12 | **SW / asset correctness** | Build emits hashed filenames; precache manifest is generated from the actual emitted file list and the test asserts set-equality; cache name derives from the build hash; `sw.js` cache/activate/fetch logic is written as pure functions unit-tested in node with mocked `caches`/`fetch` (kills §6B-9 as a class) | no |
| G-13 | Perf budgets | compute ≤ 16 ms, full region flush ≤ 8 ms on the reference scenario set (node-timed; generous CI multiplier) | no |
| G-14 | **Browser suite** (Playwright, devDependency) | The only browser-required gate, and explicitly so: WebGL viewer smoke + screenshot goldens (stage scrubber, cutaway, camera re-frame), Fill Station full keyboard pass (grid entry, double-entry verify), overlay focus-trap semantics, print preview snapshot, PWA install + offline reload from **every** entry page, real-IndexedDB adapter + two-tab CAS conflict (two contexts), storage-disabled boot | **yes — required** |
| G-15 | **Release gate** | `scripts/release.ts`: reproducible build check (G-5), SHA-256 of every artifact written to `RELEASES.md` + `.sha256` sidecars (the air-gap operator verifies the hash on the receiving machine — chain of custody for the binary itself), version stamp embedded so job-sheet footers print it; **checklist item: counsel/JAG + SME (D29) review recorded for the release** — a human gate the script refuses to skip silently (requires an explicit signed-off flag file) | no |

Deterministic-build requirements for G-5/G-15: pinned toolchain versions, no build timestamps
(vite/rollup configured with stable chunk/asset hashing off content), sorted emissions,
`three` pinned exact. Where a browser is required it is *only* G-14; everything else runs in
plain CI.

---

## 6. Repo layout & migration

### 6.1 The `sap2/` tree (v1 untouched at root until parity)

`sap2/` is **fully self-contained** — its own `package.json`, lockfile, tsconfig, vite configs
— so v1 keeps running at the repo root with zero root-file changes during the entire rebuild
(no workspace rewiring of the root; the audit's "v1 stays runnable" requirement is met by
isolation, not coordination).

```
FieldFortificationsCalculator/
├── (v1 exactly as-is at root — untouched until the swap)
└── sap2/
    ├── package.json            # deps: three (only). dev: typescript, vite, tsx, playwright
    ├── tsconfig.json           # v1 D4 strict set; includes scripts + all vite configs
    ├── vite.config.ts          # hashed assets, PWA multi-entry
    ├── vite.standalone.config.ts
    ├── docs/
    │   ├── ARCHITECTURE.md     # this document, maintained
    │   ├── FILL_CHECKLIST.md   # GENERATED (G-9) — do not hand-edit
    │   ├── DECISIONS.md        # B-series log (§7 seeds it)
    │   └── PARITY.md           # §6.2 checklist, checked off as met
    ├── public/                 # sw.js (testable-pure style), manifest, icons
    ├── src/
    │   ├── version.ts
    │   ├── schema/             # §1 — ids, units, leaf, leaves/, relations, consumers(types),
    │   │                       #      dataset, io, migrations, parse, callouts, validationCodes, policy
    │   ├── engine/             # §2 — read, trace, missing, round, solids, cover, geometry,
    │   │                       #      work, bom, labor, schedule, validate, mission, plan, radiation, compute
    │   ├── render/             # §3.1–3.4 — svg, theme, project, chrome, drawPlan, drawSection,
    │   │                       #      a11y, csv, print/{pages, jobSheet, buildCards}
    │   ├── scene/              # §3.5 — descriptor, build, isoFromScene, propLayout
    │   ├── viewer/             # three.js only — viewer.ts + diorama/{palette,textures,terrain,sky,post,bagInstancing,shared}
    │   ├── state/              # store, history, session, env, db (IndexedDB+memory adapters),
    │   │                       #      scenarios, datasetStore (journal)
    │   ├── fill/               # Fill Station: model, gridGen, verify, journal, ui
    │   └── ui/                 # §4 — index.html shell, main, dom, overlay, errors, regions/, styles/
    ├── scripts/                # build-standalone, check-offline, check-numbers, gen-fill-checklist,
    │                           #      gen-goldens, release
    ├── goldens/                # byte-golden SVGs/JSON (G-8)
    └── test/                   # suites + fixtures/syntheticDataset.ts (seeded, test-only)
```

### 6.2 Parity checklist → the swap (`sap2/docs/PARITY.md`)

The swap is triggered by **all** of the following, checked and dated:

1. **Feature parity:** all 10 positions × 17 threats × 8 soils × 3 standards × 5 revetments;
   overhead/sump/step/camo/machine toggles; range-card layer **with the sector/azimuth input**
   (v2 exceeds v1 here by design); job sheet (with validation block), CSV, JSON, per-drawing
   SVG; scenarios, mission, compare, planner, schedule; stage scrubber + cutaway 3D; day/night;
   three layouts; undo/redo; session persistence; PWA + standalone single-file artifact.
2. **v1's ported test intent green in v2:** formula re-derivations, partition invariants,
   fail-safe matrix, render conventions, scene honesty — the ported suites are the parity
   instrument, not eyeballs.
3. **All gates G-1…G-14 green in CI**; G-15 exercised at least once end-to-end.
4. **Fill exercised for real:** at least one full domain (recommend `soils` or `standards` —
   small) entered by the owner on the target air-gapped workflow, journal verified, banner
   transitions observed — proving the core promise with a genuine publication pass before the
   swap (v1 shipped with this never exercised; v2 must not).
5. **A recruit-proxy walkthrough** of the build cards for one position (mandate #4 acceptance —
   someone with no diagram training completes the sequence without coaching).
6. **Sign-offs recorded:** D29-class SME structural review of invented models (ramp, berm,
   spoil balance, platform convention) and the counsel/JAG language review (G-15).

**Swap mechanics:** tag `v1-final`; `git mv` v1 app source + docs to `legacy/sap1/` (kept
runnable: its package.json moves with it); `sap2/` build becomes the deployed root target
(root README + deploy config updated in the same commit). Rollback is a checkout of the tag.
v1's `docs/STATE_OF_THE_APP.md` and audit plans move to `legacy/` as historical record.

### 6.3 TIMBER-1 disposition — **recommendation: archive with v1; do not port at parity**

TIMBER-1 today is a hardcoded 20×16 demo (no inputs), stops at sheathing, and sits entirely
outside the honesty gates with invented bare constants (§6B-14, §6C-N13, §6E). Porting it
into `sap2/` "as is" would re-import the exact class SAP-2 exists to kill, and finishing it
properly (inputs, member sizing from real tables, its own leaf domains, gates) is a project of
its own. Per mandate #5 (quality over breadth):

- **At the swap:** TIMBER-1 moves to `legacy/sap1/` with v1, still runnable there; the SAP-2
  hub ships SAP-2 alone (no ghost card pointing at an un-regime'd tool).
- **Future:** a TIMBER-2 may be built *inside* the sap2 regime — its constants as schema leaves
  in their own domain (`timber.*`), its own dataset section, covered by G-2/G-3/G-9 from day
  one (which is automatic: whole-tree scoping means it *cannot* be built outside them). Its
  proven pure engine (frame/floor/walls/roof generators, node-tested) is the port candidate
  when that day comes; nothing else is.
- The alternative (porting TIMBER-1 as-is behind its own banner) was considered and rejected:
  it dilutes the ship-empty claim (I1) — the artifact would again contain invented magnitudes —
  and the owner's liability mandate outranks suite breadth.

---

## 7. Decision log seed (B-series)

The choices above, numbered for `sap2/docs/DECISIONS.md` (continuing v1's D-series practice):

- **B1** Ship-empty: no doctrinal magnitudes in the shipped artifact; operator dataset is the sole value source (§1.1, I1).
- **B2** Fail-closed `Filled|Missing` algebra end-to-end; no fallback ids or values (§2.2, I2).
- **B3** `compute(inputs, dataset)` — doctrine is an argument; immutable dataset snapshots replace in-place leaf mutation (§1.5, §2.2, I4).
- **B4** Typed id unions from schema; strings narrowed only in `schema/parse.ts` (§1.2).
- **B5** Leaf↔consumer set-equality + `doctrineReader` manifests = zero orphans by construction (§1.6, I5).
- **B6** `exclusiveConsumer` on double-apply-prone leaves; machine assist priced only in `engine/labor.ts` (§1.6, §2.5, I6).
- **B7** Geometry kernel: solids are the single shape truth for volume/section/plan/3D; slope-aware volumes via prismatoid integration (§2.3, I3).
- **B8** Trace DAG with generated formulas; explanations join to dataset citations (§2.4, I7).
- **B9** Stage-first work model; totals defined as stage sums (partition by construction) (§2.5, I9).
- **B10** Labor regranularized 7→~30 leaves (per-soil/method dig rates, per-position bases) (§1.3–1.4).
- **B11** Shielding matrix kept at 17×9 but independently entered — no factor derivation (§1.3).
- **B12** Double-entry verification + hash-chained fill journal + dataset SHA-256 on every output (§1.8, §3.3).
- **B13** Five-state banner machine; synthetic datasets can never clear it (§1.10).
- **B14** Renderers take `ResolvedTheme`; exported artifacts self-contained, gate-enforced (§3.1, I8).
- **B15** Job sheet type-requires validation + provenance blocks (§3.3).
- **B16** Build cards generated per stage with delta-highlighted plan/section/iso from the shared callout registry (§3.4).
- **B17** Scene descriptor v2: stable PartIds, stageAdded, highlight-delta, typed cutaway; `isoFromScene` for browser-free 3D figures (§3.5).
- **B18** Retained static shell + ~200-line `dom.ts` (setters, keyed list, guarded inert swap); canvas never reparents (§4.1–4.2).
- **B19** Single overlay/focus primitive with destructive-guard; editability-aware shortcuts (§4.3).
- **B20** Two-tab safety: tabId'd session writes, CAS-versioned IndexedDB, Fill Station lease (§4.4).
- **B21** Event-driven rendering with failure latch; no persistent rAF; 3D loop idles (§4.5).
- **B22** Whole-tree gates with in-gate allowlists; dataset-axis fuzz; SW logic node-tested; reproducible builds + per-release SHA-256 (§5, I10).
- **B23** `sap2/` fully self-contained; parity checklist §6.2 triggers the swap; v1 → `legacy/sap1/` (§6.1–6.2).
- **B24** TIMBER-1 archived with v1, not ported; TIMBER-2 only ever inside the regime (§6.3).
- **B25** Planner weights deleted in favor of lexicographic ranking; planner emits input deltas (§2.7).
- **B26** Mission merge key id+specKey; validation rolls up (§2.7).

## 8. Closing note — what must still be human

The architecture makes the tool incapable of being the source of a doctrinal number, and makes
every number it prints traceable to a cited, verified, operator-entered value. What it cannot
do: confirm the *structure* of invented models (ramp geometry, berm sizing, spoil balance,
platform convention — the open D29 review), validate the plain-language build-card text against
how Marines actually train, or bless the output language. Those are the SME review, the
recruit-proxy walkthrough, and the counsel/JAG review — all release-gated (§5 G-15, §6.2), all
human, on purpose. The software's job is to make their sign-off easy to give and impossible to
fake; that is what this design optimizes for.

