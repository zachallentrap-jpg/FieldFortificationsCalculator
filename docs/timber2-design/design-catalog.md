# TIMBER-2 — STRUCTURES CATALOG & PARAMETER SURFACE

> **Doc:** `timber2-design/design-catalog.md` — the structures-catalog deliverable of the
> TIMBER-2 design set. This document defines **what TIMBER-2 can build** (every structure
> family, its doctrinal lineage, its status), **which knobs each family exposes** and which
> the standard design fixes, the **roof-family** and **coverings** cross-cutting catalogs,
> and the **structure-picker taxonomy**. Sibling docs own the backend module layout, the
> phase plan, and the viewer/UX detail; where this doc states engine contracts (types,
> stage lists, member roles) they are **binding inputs** to those docs.
>
> **Ground truth read before writing:** `src/timber/*` (frame/floor/walls/roof/elevation/
> bom/types), `src/ui/woodframe-scene.ts` + `woodframe.html`, `test/timber-*.test.ts`,
> `docs/SAP2_BLUEPRINT.md` (quality bar), deployment constraints (offline, zero external
> requests, assets as files never base64-inline, one toolkit deploy).
>
> **Interpretation note (owner's "mal houses"):** read as the **modular/small-house = hut
> family** per the brief, enumerated exhaustively in §3 (SEA hut, SWA hut, B-hut, squad
> hut, guard shack, and the general-purpose framed building they all derive from).

---

## 0. Decision log

Every judgment call in this catalog, numbered for citation by the phase plan and by
implementing sessions. Format follows SAP-2 blueprint §9 discipline.

| # | Decision | Rationale (one line each) |
|---|---|---|
| D-CAT-1 | **Families are presets over FOUR chassis generators** (`framed`, `tower`, `platform`, `crib`) — cards multiply, generators do not. | 14 cards on 4 engines is buildable and testable; 14 bespoke generators is not. |
| D-CAT-2 | **TIMBER-2 ships working defaults with (PH) cites** — the opposite of SAP-2's ship-empty — and this boundary is stated in-app. | Cut lengths and nailing are public-release carpentry (FM 5-426), not protective-performance claims; §1.3 states the line precisely. |
| D-CAT-3 | **Life-safety numbers ship as defaults but are ledgered and gated** (LS-GATE, §1.4): rail heights, ladder/stair limits, span tables, tower bracing. | "Working defaults" must not become "unreviewed guardrails"; the ledger makes every such number a visible, reviewable object. |
| D-CAT-4 | **Bunker boundary:** `designCoverDepthFt` is an **input the user brings from SAP**; TIMBER-2 sizes wood for a stated depth and never recommends a depth or names a threat. | Protective sizing is SAP-2's regime by charter; wood sizing for a stated dead load is carpentry. §1.5 is the normative text. |
| D-CAT-5 | **Hip roof deferred (IN-later); tower cab pyramid special-cased IN-core** for square plans ≤ 10 ft. | No core family needs general hip; the small square pyramid (4 hips + ≤2 jacks/face) is a fraction of general hip/jack framing and towers need it. |
| D-CAT-6 | **Salt-box, gambrel, mansard roofs OUT.** | Named in FM 5-426's roof-type figure but no TO standard design uses them; asymmetric-ridge complexity buys zero doctrinal payoff. |
| D-CAT-7 | **"Flat w/ slope-to-drain" is the shed generator at 1/4–1:12** with its own catalog name and defaults — stated honestly, not a separate framing engine. | TO flat roofs drain by shedding to one side (one wall taller); the framing IS shed framing. |
| D-CAT-8 | **Multi-story = stacked platform framing, `gp-frame` only, max 2 stories.** | FM 5-426's system is platform (western) framing; huts/towers are single-story by standard design; 3+ stories is an egress/span regime TO construction does not enter. |
| D-CAT-9 | **Picker card images are build-time, engine-projected SVG line art shipped as FILES** (never base64-inline, never downloaded). | Offline mandate + the base64-inline OOM that already bit the deploy; engine projection keeps card art true to what the generator builds. |
| D-CAT-10 | **IN-later families ship NO greyed-out cards.** | A field tool shows what works; vaporware cards erode trust and clutter the picker. |
| D-CAT-11 | **Structured `nails` field added to Member** (size, count-or-spacing) alongside the display string; BOM grows a nail-poundage section. | "Beyond framing" mandate requires a hardware schedule; parsing prose strings is not a foundation. |
| D-CAT-12 | **Doors, screens, and shutters are BUILT sub-assemblies** with their own members and cut-list lines (TO ledged-and-braced door, framed screen panel/door, board/plywood shutters). | Owner mandate #2 verbatim; TO construction builds these from stock — they are not supply-catalog holes. |
| D-CAT-13 | **Partitions: preset-driven straight non-bearing partition only in core** (B-hut bays, latrine screen wall); a free partition editor is IN-later. | Bays are part of the B-hut's identity; a general partition editor is a plan-editor feature that must not gate the catalog. |
| D-CAT-14 | **`skids` added as a fourth foundation** (pressure-treated 4x6/6x6 runners). | Guard shacks and burn-out latrines are doctrinally portable/drag-able; piers are wrong for them. |
| D-CAT-15 | **Strongback uses a `bent` framing mode** (identical frames every 4 ft) inside the framed chassis, not a fifth chassis. | Tent frames are bent-built by standard drawing; the chassis already owns floors/walls/roofs — bents are a layout rule, not a new engine. |
| D-CAT-16 | **Field-expedient lashing/pole shelters OUT.** | No dimensional-lumber cut list ⇒ the engine's entire value (members, BOM, stages) evaporates; ponchos and lashings belong to a survival pub, not a carpentry tool. |
| D-CAT-17 | **Bridges, revetments/soil retention, ammo barricades, trussed clear-span buildings OUT** (each with a named re-entry bar, §3.3). | Each is its own analysis regime (gap crossing, soil mechanics, ESQD, truss/gusset design) that would swallow the product. |
| D-CAT-18 | **Custom/None card = the full framed-chassis surface** (plus platform-chassis toggle), nothing locked, defaults = the TIMBER-1 demo building. | "Compose exactly the building you want" with zero hidden locks; the demo building is the known-good seed. |
| D-CAT-19 | **Every family defines a named cutaway** (`CutawaySpec`: plane, station, optional ghost layer) in its FamilyDef. | Owner mandate #5 — cutaway is per-structure data, not a viewer afterthought. |
| D-CAT-20 | **Tower heights are discrete in core (10/16/24/32 ft)**; continuous heights are IN-later behind LS-GATE review. | Discrete heights mirror the standard-drawing family and keep bracing-panel math table-verified; free height is a leg/bracing design problem. |
| D-CAT-21 | **Corrugated roofing may lie on purlins with NO panel deck** (SEA-hut pattern); `roofDeck` is an explicit covering knob with per-family locks. | The SEA hut's standard section is purlins + corrugated; forcing plywood under it would falsify the doctrine model. |
| D-CAT-22 | **Engine width bound: ≤ 24 ft single-girder in core**; wider (multi-girder) is IN-later. | The floor chassis has one girder line; 2x8/2x10 joist half-spans cap near 12 ft per Table 6-2 (PH); honesty over reach. |

---

## 1. Doctrine base, cite discipline, review posture

### 1.1 Publication spine

TIMBER-2 draws on the theater-of-operations (TO) rough-construction canon. Ordered by
authority for this product; every generator constant carries one of these in
`doctrineRef`:

| Key | Publication | What it grounds here |
|---|---|---|
| FM 5-426 | *Carpentry* (1995) | The spine: layout, foundations, floor/wall/roof framing, framing-square math, sheathing, roofing, siding, TO doors/windows, stairs, nail schedules, dressed sizes. Already the engine's cite base. |
| TM 5-302-series | *Army Facilities Components System* standard designs (TM 5-302-1/-2/-3/-5) | The standard-drawing lineage: hut plans, guard/observation towers, tent frames & floors, latrines, loading platforms, tank stands. (PH) throughout — drawings named by family, sheet cites pending. |
| TM 5-301 / FM 5-35 / FM 5-34 | AFCS planning + engineer field data (older canon) | Planning factors, crew sizes, older standard-design lineage backup. (PH) |
| UFC 1-201-01 | *Non-Permanent DoD Facilities in Support of Military Operations* | The modern authority for the hut classes (initial/temporary construction standards; SEA/SWA/B-hut descendants). (PH) |
| CENTCOM Sand Book | CENTCOM contingency construction standards (informal "Sand Book") | B-hut, guard tower, burn-out latrine field-standard drawings of the OIF/OEF era. (PH) |
| NAVFAC P-405 | *Seabee Planner's and Estimator's Handbook* | Man-hour/labor factors (replaces the current `(PH)` MH constants' anonymous basis), crew composition. (PH) |
| ATP 3-37.34 / FM 5-103 | *Survivability Operations* | **Configuration reference only** for the timber bunker family (shapes, member vocabulary). Protective sizing NEVER crosses from it into TIMBER-2 — see §1.5. (PH) |
| ATP 4-25.12 / FM 21-10 | Field sanitation | Latrine box dimensions, burn-out drum arrangement, fly-proofing. (PH) |
| GTA construction cards | GTA 5-series construction graphic training aids | Pocket-card corroboration for nailing/layout numbers where FM 5-426 is thin. (PH) |

All are public-release publications; naming them and citing them in a shipped tool is
unproblematic (they already appear in TIMBER-1's footer and member cards).

### 1.2 The (PH) cite discipline — unchanged and extended

The existing rule stays verbatim: **every doctrinal magnitude carries a `doctrineRef`,
and any cite not yet page-verified against the physical pub carries "(PH)"** — e.g.
`"FM 5-426 Table 6-2 joist span (PH: 2x8 fixed, span check pending)"`. TIMBER-2 extends
it: **standard-design lineage cites** name the drawing family when the sheet number is
unverified — e.g. `"TM 5-302 timber observation tower std design (PH sheet)"`. A cite
with neither pub nor (PH) fails the existing doctrine-integrity test pattern
(`test/doctrine-*.test.ts` culture), which the phase plan extends over `src/timber/`.

### 1.3 Working defaults vs. SAP-2 ship-empty — the explicit boundary

**TIMBER-2 ships working numbers. SAP-2 ships none. Both are correct, and the reason is
the content of the numbers:**

- A TIMBER number says *how to cut and nail wood* (a rafter's length, a lap, a nail
  size). It is public-release carpentry; being wrong makes a bad building visibly badly
  — it makes **no claim that anyone is protected from anything**.
- A SAP number says *how much material defeats a threat*. Being wrong is invisible
  until it kills someone. Hence SAP-2's ship-empty/fill/commission regime.
- TIMBER-2 therefore ships defaults with (PH) cites and improves them by page
  verification — **except** that any TIMBER number whose failure mode is a fall,
  collapse, or structural overload is **life-safety** and routes through LS-GATE
  (§1.4), and the single protection-adjacent quantity in the whole catalog (bunker
  cover depth) is an **input, never an output** (§1.5).

This paragraph's substance appears in-app: on the bunker card, in the footer, and in the
member card for any LS-tagged member.

### 1.4 LS-GATE — the named review posture for life-safety items

**What is tagged `lifeSafety: true`** (a new boolean on the doctrine-constant records the
generators read, surfaced on Member cards):

1. Guardrail/handrail heights and mid-rail/toe-board presence (towers, platforms, stairs, cab half-walls).
2. Ladder construction: rung spacing, rail stock, top extension, (later) cage threshold.
3. Stair limits: riser/tread bounds, stringer sizing, landing rules.
4. All span/size tables: joist (FM 5-426 Table 6-2), girder (Table 6-1), header spans, platform/deck members, tower leg + bracing schedule, bunker stringer table.
5. Tower height/batter/bracing-panel schedule as a set.
6. Header sizing for wide (vehicle/storage) openings.

**The mechanism:**

- `scripts/gen-ls-ledger.ts` walks the tagged constants and generates
  `docs/TIMBER2_LS_LEDGER.md`: one row per constant — id, value, doctrineRef, (PH)
  status, last-change commit, ack line.
- CI gate **G-LS** (naming consistent with SAP-2's G-1..G-13): fails when a
  `lifeSafety`-tagged constant's value changes without a matching ledger ack entry in
  the same change, and fails when any LS constant lacks a doctrineRef.
- **Review roles:** the owner acks routine (PH)→verified transitions; any *value*
  change to an LS constant additionally requires a named second reviewer line in the
  ledger (owner may self-nominate the reviewer; the ledger records who).
- The UI badges LS members: member card shows "LIFE-SAFETY ITEM — default per
  <doctrineRef>; verify before occupied use", consistent with the existing footer's
  occupied-structure disclaimer.

### 1.5 The SAP-2 / TIMBER-2 bunker boundary (normative)

- **SAP regime (not here):** any question of *how much* earth/material/standoff defeats
  *what threat*; any output that could be read as "you are protected."
- **TIMBER regime (here):** the **wood structure** — posts, caps, stringers, lagging,
  entrance frame — its geometry, cut list, nailing, and stages, sized to carry a
  **user-stated** `designCoverDepthFt` of soil dead load via published TO timber tables
  (PH, LS-tagged).
- **The interface is one number flowing one way:** the user brings the cover depth from
  their survivability plan (SAP) into TIMBER. TIMBER renders the soil as a ghost
  massing labeled `COVER DEPTH: user-stated — protective sizing is a survivability
  (SAP) decision, not computed here`, prints the same sentence on the bunker BOM
  header, and contains **no threat vocabulary anywhere** (test-asserted: a wordlist
  gate over `src/timber/` — no "round", "fragmentation", "caliber", "protection
  level").
- If SAP-2 (per its blueprint) is not commissioned/available, TIMBER's bunker still
  builds — the depth is just a stated design load, exactly like a snow-load assumption.

---

## 2. Chassis architecture — four generators, all the cards

### 2.1 The four chassis

Every catalog family compiles to a `StructureSpec` targeting exactly one chassis
generator. A chassis = one `generate*(params) → Member[]` family of pure functions plus
its stage list. This is D-CAT-1 and it is the load-bearing decision of the whole
product: **breadth lives in `FamilyDef` preset data; correctness lives in four
generators.**

| Chassis | Generator (new/extends) | Emits | Families riding it |
|---|---|---|---|
| `framed` | extends today's `generateFrame` (floor + walls + roof + coverings) | full platform-framed building; 1–2 stories; bent mode; per-wall heights (shed); screen bands; partitions; opening fills; coverings | gp-frame, sea-hut, swa-hut, b-hut, squad-hut, guard-shack, storage-shed, latrine, strongback, custom |
| `tower` | new `generateTower` | battered legs, bracing panels, girts, platform, cab (half-walls/screens/rails), cab roof, ladder or stair access, footings | tower (+ later tank-stand) |
| `platform` | new `generatePlatform` (reuses floor internals) | posts/pads or skids, floor frame, plank or panel deck, railings, ramp, steps | platform (loading dock), tent-floor |
| `crib` | new `generateCrib` | post-and-cap frame, wall system (post-and-plank or crib), OHC stringer deck, lagging, entrance baffle, soil ghost massing | crib-bunker (+ later headcover-frame) |

**What stays shared:** `Member`, DRESSED, the BOM projections, elevation projection,
layout grids (`layoutCenters`), stairs/steps math, the framed-opening pattern
(trimmers/headers/tails) — all already proven in `src/timber/`.

### 2.2 The FamilyDef record (binding type sketch)

```ts
// src/timber/catalog.ts — data, no generation logic.
export type FamilyId =
  | 'gp-frame' | 'sea-hut' | 'swa-hut' | 'b-hut' | 'squad-hut'
  | 'guard-shack' | 'storage-shed'
  | 'tower'
  | 'strongback' | 'tent-floor'
  | 'crib-bunker'
  | 'latrine' | 'platform'
  | 'custom';

export type ChassisId = 'framed' | 'tower' | 'platform' | 'crib';
export type PickerGroup = 'buildings' | 'towers' | 'hasty' | 'bunkers' | 'site' | 'custom';

export interface DoctrineCite { pub: string; where: string; ph: boolean }

export interface CutawaySpec {
  plane: 'X' | 'Z';          // section plane normal to this building axis
  stationFrac: number;       // 0..1 along that axis (family default; user can drag)
  ghost?: 'soil' | 'canvas'; // layer rendered translucent instead of cut
}

export interface CardViewSpec {
  projection: 'axon' | 'elevation-front';
  note?: string;             // one line drawn under the art (e.g. bunker boundary line)
}

export interface FamilyDef<P> {
  id: FamilyId;
  chassis: ChassisId;
  group: PickerGroup;
  name: string;              // card title
  purpose: string;           // one line
  cardBlurb: string;         // 1–2 sentences on the card
  lineage: DoctrineCite[];   // §3 catalog rows, machine-readable
  preset: P;                 // complete valid params — the card's default build
  locks: readonly string[];  // param paths FIXED by the standard design (UI: read-only + cite)
  bounds: Record<string, { min: number; max: number; cite: DoctrineCite }>; // exposed numeric knobs
  cutaway: CutawaySpec;
  cardView: CardViewSpec;
}
```

A test iterates `CATALOG: FamilyDef<any>[]` and asserts: ids match this document 1:1
(AC-CAT-1), every preset generates (no throw, no NaN, BOM partitions exactly), every
lock path exists in the preset, every bound has a cite.

### 2.3 Stage lists become per-chassis

`STAGES` (types.ts) is today one global list; it becomes `STAGES_BY_CHASSIS`. The BOM
partition invariant (stage BOMs sum exactly to total — the tested contract) holds per
chassis. The framed list is today's 11 stages unchanged. New lists:

| `tower` stages | | `platform` stages | | `crib` stages | |
|---|---|---|---|---|---|
| 1 | Layout & footings | 1 | Layout & footings/skids | 1 | Layout & bearing prep |
| 2 | Legs raised & girts | 2 | Frame (sills/joists) | 2 | Posts & caps |
| 3 | X-bracing panels | 3 | Decking | 3 | Wall system (posts/planks or crib) |
| 4 | Platform frame & deck | 4 | Ramp / steps | 4 | OHC stringers |
| 5 | Cab framing | 5 | Railings | 5 | Lagging / decking |
| 6 | Cab roof | | | 6 | Entrance & baffle |
| 7 | Access (ladder/stair) | | | 7 | (ghost) cover massing |
| 8 | Railings & coverings | | | | |

(Stage names are UI copy; ids are per-chassis dense integers. The stage scrubber binds
to the active chassis's list.)

### 2.4 MemberRole additions (binding list)

Additions to `MemberRole` in `types.ts` — additive only, existing roles untouched:

```
// tower:      legPost, girt, xBrace, deckPlank, railPost, railTop, railMid, toeBoard,
//             ladderRail, ladderRung, cap (also used by crib)
// crib:       ohcStringer, lagging, baffle  (posts reuse 'post', caps use 'cap')
// coverings:  purlin, roofingSheet, roofingRoll, feltPaper, sidingPanel, sidingBoard,
//             batten, screenFrame, screenPanel, doorBoard, doorLedge, doorBrace,
//             shutter, trim
// platform:   skid, rampStringer  (deck reuses subfloor/deckPlank; steps reuse stringer/tread)
// partitions: reuse stud/plate roles with wall id 'P1'|'P2'... (WallId widens to string union)
```

The stair `stringer` role stays stair-only; the bunker deck uses `ohcStringer` to keep
elevation/BOM projections unambiguous.

---

## 3. THE CATALOG

Statuses: **IN-core** ships in TIMBER-2's first complete release; **IN-later** is
designed-for but not built (no card shipped, D-CAT-10); **OUT** is excluded with a
re-entry bar. 14 IN-core families including Custom.

### 3.1 IN-core families

#### 3.1.1 `gp-frame` — General-Purpose TO Building *(group: buildings)*

- **Purpose:** the workhorse rectangular platform-framed building — admin, billeting, supply, mess — 1 or 2 stories, any roof family, any openings.
- **Lineage:** FM 5-426 ch. 4–6 (layout, floor, wall, roof — the current engine's spine, partially page-verified); TM 5-302 general-purpose building standard designs (PH); UFC 1-201-01 temporary-standard buildings (PH).
- **Card blurb:** "The standard TO framed building. Pick size, stories, roof, and openings — everything else follows FM 5-426."
- **Status:** IN-core — it exists today; TIMBER-2 generalizes it (stories, roof families, coverings).

#### 3.1.2 `sea-hut` — SEA Hut *(group: buildings)*

- **Purpose:** the tropical troop hut: raised floor, 4-ft plywood lower walls, continuous screen band to the eave, wide overhangs, corrugated roof on purlins.
- **Lineage:** Southeast Asia hut standard design, Vietnam-era MACV/NAVFAC lineage carried into AFCS drawings (TM 5-302) (PH); FM 5-426 for all members (PH pages).
- **Card blurb:** "Vietnam-pattern screened hut, 16 ft wide. Plywood to 4 ft, screen to the eaves, big overhangs, tin roof — built for airflow."
- **Status:** IN-core — owner-named; the canonical tropical hut and the showcase for screens/shutters/purlins.

#### 3.1.3 `swa-hut` — SWA Hut *(group: buildings)*

- **Purpose:** the desert plywood hut: fully enclosed plywood walls (dust/heat), few small high openings, gable roof, raised or skid floor.
- **Lineage:** Southwest Asia hut, Desert Shield/Storm USACE standard design (PH); UFC 1-201-01 lineage (PH).
- **Card blurb:** "Desert-pattern enclosed plywood hut. Sealed walls, small shuttered vents, and A/C sleeve openings instead of screen bands."
- **Status:** IN-core — owner-named; differs from B-hut in envelope details (vents/AC sleeves, full closure), cheap to carry as a preset.

#### 3.1.4 `b-hut` — B-Hut (Barracks Hut) *(group: buildings)*

- **Purpose:** the OEF/OIF-era 8-soldier plywood barracks hut, 16×32, optionally partitioned into personal bays.
- **Lineage:** CENTCOM Sand Book standard design (PH); AFCS/UFC 1-201-01 temporary-standard barracks (PH).
- **Card blurb:** "Bagram-pattern barracks hut, 16×32. Door each end, window per bay, optional 8-bay partition layout."
- **Status:** IN-core — owner-named; drives the partition-preset capability (D-CAT-13).

#### 3.1.5 `squad-hut` — 4-Man / Squad Hut *(group: buildings)*

- **Purpose:** the small-crew sleeping hut (fire team to squad): a hut-chassis building at 12×16 to 16×24.
- **Lineage:** AFCS small-hut drawings; B-hut family scaled down (PH); "4-man hut" appears in Seabee camp layouts (PH).
- **Card blurb:** "Small hooch for a team or squad. Same construction as the big huts, sized 12×16 and up."
- **Status:** IN-core — owner-named ("4-man/squad hut variants"); costs one preset row.

#### 3.1.6 `guard-shack` — Guard Shack / Sentry Booth *(group: buildings)*

- **Purpose:** 1–2 person ECP/gate booth with counter-height observation window band on all approach sides.
- **Lineage:** TM 5-302 sentry booth standard drawing (PH); Sand Book gate/ECP booth (PH); FM 19-30/ATP 3-39.32 physical security siting (requirements only, no framing) (PH).
- **Card blurb:** "Gate sentry booth, 4×6 to 8×8. Shed or gable roof, shuttered window band on the watch sides, skid or pier base."
- **Status:** IN-core — owner-named; smallest framed building, exercises skids + shed roof + window bands.

#### 3.1.7 `storage-shed` — Storage / Warehouse Shed *(group: buildings)*

- **Purpose:** covered storage: wide door(s) or an open post-and-header front, gable or shed roof, no windows by default.
- **Lineage:** TM 5-302 storage/warehouse standard designs (PH); FM 5-426 framing + header practice (PH).
- **Card blurb:** "Covered storage with a wide door bay or a fully open front. Sized for pallets and gear, not people."
- **Status:** IN-core — exercises wide headers (LS-tagged) and the open-front wall variant; width capped 24 ft (D-CAT-22).

#### 3.1.8 `tower` — Timber Guard / Observation Tower *(group: towers)*

- **Purpose:** elevated observation cab on four battered, X-braced timber legs: platform, half-walled cab with screen/shutter band, pyramid or shed cab roof, ladder or stair access.
- **Lineage:** TM 5-302 timber tower standard designs (PH sheets); Sand Book guard towers (PH); FM 5-426 for member practice (PH); rail/ladder/stair limits LS-tagged (§1.4).
- **Card blurb:** "Braced-leg timber tower — 10, 16, 24, or 32 ft to the deck. Cab with rails and screens; ladder or switchback stair."
- **Status:** IN-core — owner-named twice; the flagship new chassis.

#### 3.1.9 `strongback` — Tent Strongback Frame *(group: hasty)*

- **Purpose:** the wood frame + floor a GP or TEMPER tent skins over: floor platform, knee walls, bent frames at 4 ft, ridge and purlins, framed end door — no sheathing (canvas by others).
- **Lineage:** TM 5-302 "frame-type tent, wood, 16×32" and tent-floor standard drawings (PH); Seabee/USMC strongback practice (PH).
- **Card blurb:** "Frame and floor for a GP or TEMPER tent. Bents every 4 ft, knee walls, ridge — the canvas goes on over it."
- **Status:** IN-core — owner-named; exercises bent mode (D-CAT-15) and the canvas ghost cutaway.

#### 3.1.10 `tent-floor` — Tent Floor / Deck *(group: hasty)*

- **Purpose:** floor-only platform (6–12 in deck height) matched to tent footprints; the strongback's floor without the frame.
- **Lineage:** TM 5-302 tent floor drawings (PH); FM 5-426 floor framing (PH).
- **Card blurb:** "Just the deck: a framed, skid- or pier-set tent floor sized to your tent."
- **Status:** IN-core — a platform-chassis preset; near-zero marginal cost, high real-world frequency.

#### 3.1.11 `crib-bunker` — Timber Bunker (post-and-beam / crib class) *(group: bunkers)*

- **Purpose:** the WOOD STRUCTURE of an above-ground protective shelter: posts and caps, wall system carrying lateral soil, stringer deck carrying a user-stated cover depth, lagging, baffled entrance.
- **Lineage:** ATP 3-37.34 / FM 5-103 bunker & shelter configurations (shape + vocabulary ONLY) (PH); TO timber sizing tables for stated loads (PH, LS-tagged); FM 5-426 member practice (PH).
- **Card blurb:** "Post-and-beam bunker structure with overhead stringers and lagging. You state the cover depth from your survivability plan — this card builds the wood, it does not size protection."
- **Status:** IN-core — owner-named; boundary per §1.5 printed on the card itself (the blurb IS the boundary sentence).

#### 3.1.12 `latrine` — Field Latrine (burn-out / box) *(group: site)*

- **Purpose:** enclosed 2- or 4-seat latrine building: vented riser box over half-drums (burn-out) or pit, screened vent band, rear drum-access flaps, skid base.
- **Lineage:** ATP 4-25.12 / FM 21-10 latrine box + burn-out arrangement (PH); TM 5-302 latrine standard drawings (PH); Sand Book burn-out latrine (PH).
- **Card blurb:** "Two- or four-seat burn-out latrine: riser box, screened vents, rear drum doors, on skids. Field sanitation, by the book."
- **Status:** IN-core — owner-named; framed chassis (small) + the latrine-box sub-assembly.

#### 3.1.13 `platform` — Platform / Loading Dock / Ramp *(group: site)*

- **Purpose:** freestanding deck at truck-bed height (or any height 0.5–5 ft) with optional ramp, steps, and railings — loading docks, work platforms, stands.
- **Lineage:** TM 5-302 loading platform standard drawings (PH); FM 5-426 floor framing + stair math (PH); rails LS-tagged.
- **Card blurb:** "Deck at the height you need — loading dock with a ramp, work platform with rails, or a plain stand."
- **Status:** IN-core — second chassis proof; shares nearly all code with the floor system.

#### 3.1.14 `custom` — Custom / None *(group: custom)*

- **Purpose:** the fully customizable option set: the complete framed-chassis parameter surface with nothing locked (plus a link to the platform chassis for deck-only builds).
- **Lineage:** FM 5-426 (whatever you compose is still built by its rules); no standard design pins anything.
- **Card blurb:** "Start from a clean sheet. Every dimension, story, roof, opening, and covering unlocked — compose exactly the building you want."
- **Status:** IN-core — owner mandate #3 verbatim. Semantics detailed in §7.4.

### 3.2 IN-later families (designed-for, not built; no cards shipped)

| Family | One-line spec | Why later (one line) |
|---|---|---|
| `lean-to` (addition) | Shed-roof extension ledgered to a host building's wall | Needs host-attachment semantics (ledger, flashing line, shared wall suppression) the chassis lacks; standalone shed-roof building available day one via gp-frame. |
| `pole-building` | Post-frame building: embedded PT poles, girts, purlins, no floor | A second framing SYSTEM (embedment, girt/purlin walls) — owner-named, earns its own phase after the platform chassis generalizes; lineage FM 5-426 pole construction + TM 5-302 pole-supported buildings (PH). |
| `tank-stand` | Elevated water-tank/utility stand (tower chassis minus cab, heavier deck) | Tower chassis reuse but with a load-rating question (tank weight) that must enter LS-GATE deliberately. |
| `headcover-frame` | Dimensional-lumber OHC frame kit over a dug fighting position | Overlaps SAP's position modeling; build only after SAP-2's one_man ships so the cover-depth interface (§1.5) links rather than diverges. |
| `shower` | Field shower building (framed chassis + duckboard floor) | Structure is a trivial gp variant; the value is plumbing-side items that are out of scope today. |
| `gate-barrier` | Timber swing gate / counterweighted drop barrier at ECPs | Movable assembly (hinge kinematics) + thin drawing lineage; sequence after towers/shacks prove the ECP set. |
| `bleachers` | Field bleachers/reviewing stand | Classic Seabee project with real drawings (PH), but pure nice-to-have; platform chassis extension. |
| `kennel` | Military working dog kennel (Sand Book design) (PH) | Real standard design, low demand; framed-chassis preset when asked for. |
| `arctic-hut` | Insulated cold-climate hut | Requires the insulation covering (§6.4) and TM 5-852 lineage (PH); gate both together. |
| 8-seat latrine, urinal soakage stand | Larger sanitation set | Straight extensions of the latrine preset once the box sub-assembly is proven. |
| Multi-girder wide buildings (> 24 ft) | Second/third girder lines, column rows | Lifts D-CAT-22 deliberately, with Table 6-1/6-2 page verification first (LS). |
| Free partition editor | Arbitrary interior walls | Plan-editor UX; preset partitions (B-hut, latrine) cover core need (D-CAT-13). |
| Glazed sash windows | Real window units in ROs | Sash is a supply item, not TO-built; model as opening fill once a supply-item pattern exists. |
| Continuous tower heights (8–35 ft) | Free `platformHeightFt` | Leg/bracing schedule becomes a computed design — enters only through LS-GATE review (D-CAT-20). |
| Ladder safety cage | Cage above threshold height | LS item; add with page-verified threshold + hoop details rather than guessing. |
| Hip roof (buildings) | Full hip/jack framing for the framed chassis | D-CAT-5; pyramid cab ships first and bounds the math. |

### 3.3 OUT (excluded, with re-entry bars)

| Excluded | Rationale | Re-entry bar |
|---|---|---|
| Timber trestle / any bridging | Gap crossing is its own engineering regime (FM 3-34.343 lineage) with load-rating liability far beyond carpentry | A dedicated sibling app with its own review regime; never a TIMBER card. |
| Revetments / retaining walls / soil-holding structures | Soil mechanics + protective adjacency = SAP-side regime | Enters (if ever) through the SAP family, not TIMBER. |
| Ammunition barricades / magazine structures | ESQD siting regime; catastrophic failure mode | Same as above — regime, not carpentry. |
| Trussed clear-span buildings (40-ft warehouse class) | Truss/gusset design is engineered-structure territory; TO drawings exist (PH) but verifying them is a project of its own | Page-verified TM 5-302 truss sheets + an LS review pass dedicated to trusses. |
| Field-expedient lashing/pole shelters (poncho hooch, A-frame brush) | No dimensional-lumber cut list ⇒ engine value evaporates (D-CAT-16) | None planned; a GTA reference card, not a builder. |
| Salt-box, gambrel, mansard roofs | No TO standard design uses them (D-CAT-6) | A named standard design that needs one. |
| 3+ stories | Outside TO practice; egress/structural regime shift (D-CAT-8) | None planned. |
| Towers above 32 ft | Above the standard-drawing family's range; wind/bracing design regime | Page-verified taller standard design + LS review. |
| Horizontal construction (pads, roads, helo points) | Different discipline entirely | Never in TIMBER. |

---

## 4. Per-family parameter surfaces

### 4.1 Chassis parameter types (binding sketches)

The framed chassis is a strict superset of today's `BuildingInput` — every existing
field survives with its meaning intact (migration is additive).

```ts
// ── framed chassis ────────────────────────────────────────────────────────────
export interface FramedParams {
  lengthFt: number;                     // ridge axis
  widthFt: number;                      // span axis (≤ 24 core, D-CAT-22)
  stories: 1 | 2;                       // 2 ⇒ gp-frame/custom only (locks elsewhere)
  wallHeightFt: number;                 // story 1 plate height
  upperWallHeightFt?: number;           // story 2 (default = story 1)
  roof: RoofSpec;                       // §5
  openings: OpeningSpec[];              // §4.4 — count + placement + fill type
  foundation: 'piers' | 'wall' | 'basement' | 'skids';   // skids new (D-CAT-14)
  crawlFt: number; basementDepthFt?: number;
  spacing: { studIn: 16 | 24; joistIn: 16 | 24; rafterIn: 16 | 24 };
  bridging: 'cross' | 'solid';
  letInBracing: boolean;
  bentMode?: { bentSpacingFt: 4 };      // strongback: identical frames, purlin-tied (D-CAT-15)
  screenBand?: { sillFt: number };      // SEA hut: solid wall below sillFt, screen frames above
  openFront?: WallId;                   // storage shed: that wall becomes posts + header
  partitions?: PartitionSpec[];         // preset-driven only in core (D-CAT-13)
  coverings: CoveringsSpec;             // §6
  entrySteps: boolean;                  // stoop steps at each door on a raised floor
  interiorStairs?: boolean;             // forced true when stories === 2
  atticAccess?: boolean;
}

export interface PartitionSpec {        // straight, non-bearing, full-width or full-length
  axis: 'X' | 'Z'; stationFt: number; door?: { offsetFt: number; widthFt: number };
}

// ── tower chassis ─────────────────────────────────────────────────────────────
export interface TowerParams {
  platformHeightFt: 10 | 16 | 24 | 32;  // discrete core (D-CAT-20)
  cabPlanFt: 6 | 8;                     // square cab side
  access: 'ladder' | 'stair';           // stair ⇒ switchback with landings ≥ every 12 ft (PH, LS)
  cab: {
    walls: 'open-rail' | 'half-wall' | 'half-wall-screen';
    roof: 'pyramid' | 'shed';
    roofing: 'corrugated' | 'roll';
  };
  // Locked by standard design (in FamilyDef.locks, shown with cites):
  //   leg 6x6, batter 1.5 in/ft (PH), X-brace 2x6 panels ≤ 8 ft vertical module,
  //   girts 2x6 at panel lines, platform joists per span table (PH, LS),
  //   deck 2x6 plank, rail 42 in + mid 21 in + toe board 4 in (PH, LS),
  //   ladder: 2x4 rails / 2x4 rungs? no — rungs 1x4 cleat or 2x2 (PH), 12 in spacing (PH, LS),
  //   footings: concrete pads w/ embedded post bases (PH).
}

// ── platform chassis ──────────────────────────────────────────────────────────
export interface PlatformParams {
  lengthFt: number; widthFt: number;
  deckHeightFt: number;                 // 0.5 .. 5.0
  base: 'piers' | 'skids';
  deck: 'plank' | 'panel';              // 2x6 planks vs 3/4" panels
  ramp?: { widthFt: number; slope: 4 | 6 | 8 };  // run = slope × height; stringers per table (PH, LS)
  steps?: boolean;                      // reuse stair math
  railEdges: WallId[];                  // 42/21/toe set on the named edges (LS)
}

// ── crib chassis ──────────────────────────────────────────────────────────────
export interface CribParams {
  interiorLengthFt: number;             // 6 .. 16
  interiorWidthFt: number;              // 6 .. 12
  clearHeightFt: number;                // 4.5 .. 7
  designCoverDepthFt: number;           // USER-STATED, from SAP (§1.5). Drives table lookups.
  wallType: 'post-plank' | 'crib';      // posts + horizontal planks vs stacked interlocked timbers
  entrance: 'open' | 'baffle';          // baffle = offset entry wall stub
  // Derived, table-locked, shown-not-editable (cited, LS): post size/spacing, cap size,
  // ohcStringer size/spacing vs designCoverDepthFt (PH table), lagging thickness.
}
```

### 4.2 FIXED vs EXPOSED, per family (the standard-design contract)

"FIXED" = in `FamilyDef.locks`: rendered read-only in the config panel with the lock's
cite (the standard design IS the value). "EXPOSED" = a live knob, clamped to
`FamilyDef.bounds` (each bound cited). Presets below are the card-click defaults.

| Family | EXPOSED (bounds) | FIXED by standard design (cite class) | Preset |
|---|---|---|---|
| **gp-frame** | length 8–48, width 8–24, stories 1–2, wall ht 7–10, roof family gable/shed/flat + pitch + overhang 0–3, openings (any count/wall/size/fill), foundation all 4, spacing 16/24 each, bridging, bracing, coverings (all), entry steps, attic access | nothing beyond engine rules (girder/joist sizing per tables — LS) | 20×16×8, gable 4:12, piers, 1 story, door + 2 windows (today's demo) |
| **sea-hut** | length 16–48 (4-ft module), door count 1–3 (gable ends + 1 side), shutter mode `propped/closed`, foundation piers/skids, crawl 1.5–3 | width **16**; wall ht **8**; screen band sill **4 ft**; roof **gable 4:12**, overhang **3 ft** exposed tails; roof deck **purlins**, roofing **corrugated**; siding **plywood** below band; screens **on**; entry steps **on** (TM 5-302 SEA hut std design, PH) | 16×32, 2 end doors, propped shutters |
| **swa-hut** | length 16–36, width 16 or 20, door count 1–2, vent count 2–6, A/C sleeve count 0–2, foundation piers/skids | wall ht **8**; roof **gable 4:12**, overhang **1 ft**; roof deck **panel**, roofing **roll or corrugated** (choice exposed) — siding **plywood full-height**; felt **on**; screens **off** (USACE SWA std design, PH) | 16×32, 2 doors, 4 vents |
| **b-hut** | length 16–36, door count 1–2, window count 0–8, partitions on/off, foundation piers/skids | width **16**; wall ht **8**; roof **gable 4:12**; siding **plywood**; roofing **roll**; partition layout when on: **8 bays + center aisle** (Sand Book, PH) | 16×32, 2 doors, 8 windows, bays on |
| **squad-hut** | length 12–24, width 12 or 16, door 1, windows 0–4, roof gable/shed, foundation piers/skids | wall ht **7.5**; siding **plywood**; roofing **roll** (AFCS small hut, PH) | 12×16, gable, 1 door, 2 windows |
| **guard-shack** | plan 4×4–10×10, roof shed/gable, window band sides (pick walls), door wall, foundation skids/piers | wall ht **7**; window band sill **3.5 ft**, head **6.5 ft**, shuttered + screened; entry steps auto when raised (TM 5-302 sentry booth, PH) | 6×6, shed 2:12, band on 3 sides, skids |
| **storage-shed** | length 8–32, width 8–24, roof gable/shed, big-door width 4–10 (header table clamps, LS) or `openFront` wall, foundation piers/skids/wall, shelving none | wall ht **8**; windows **0 default** (exposable); siding **board-batten default** (TM 5-302 storage, PH) | 12×20, gable, 8-ft double door |
| **latrine** | seats 2 or 4 (length derives), foundation **skids** (locked) — exposed: vent band on/off is NOT exposed (fixed on), door wall | width **4 ft** (2-seat) / **4 ft**×longer (4-seat); wall ht **7**; roof **shed 2:12**; riser box: seat ht **~18 in** (PH), hole spacing **~30 in** (PH), rear drum flaps **on**; screened vent band at plate **on**; fly-proofing screen **on** (ATP 4-25.12 + TM 5-302, PH) | 4-seat burn-out on skids |
| **tower** | platform height 10/16/24/32, cab 6 or 8, access ladder/stair, cab walls (3 modes), cab roof pyramid/shed, cab roofing | everything structural (see TowerParams comment block) — legs, batter, bracing module, girts, platform framing, deck, rails 42/21/toe, ladder details, footings (TM 5-302 tower std design + LS, PH) | 16 ft, 8×8 cab, ladder, half-wall-screen, pyramid |
| **strongback** | tent preset GP-Medium(16×32)/GP-Small(16×16)/TEMPER(20×8·N bays: N 2–8), end door frame on/off, floor-only toggle (→ redirects to tent-floor), foundation piers/skids | bent spacing **4 ft**; knee-wall + ridge heights **per tent geometry table** (PH); purlins **on**; **no sheathing/roofing/siding** (canvas by others) (TM 5-302 tent frame, PH) | GP-Medium 16×32 |
| **tent-floor** | plan from tent preset or free 8–32 × 8–20, deck height 0.5–1, base skids/piers, deck plank/panel | no rails (locked off ≤ 1 ft); frame per floor rules (PH) | 16×32 panel deck on skids |
| **platform** | length 6–24, width 4–16, deck height 0.5–5, base, deck plank/panel, ramp on/off (+width 4–12, slope 4/6/8), steps, rail edges | rails **42/21/toe** when height ≥ 2.5 ft on open edges — auto-added, removable only per edge with a visible LS warning (PH, LS); ramp stringer table (PH, LS) | 8×12 dock at 3.5 ft, ramp, rails on 3 edges |
| **crib-bunker** | interior 6×8–12×16, clear height 4.5–7, cover depth 0–4 (input, §1.5), wall type, entrance open/baffle | post/cap/stringer/lagging sizes+spacings **from the load tables** vs stated depth (PH, LS) — displayed with the table row cited, never editable | 8×10, 6 ft clear, 2 ft stated cover, post-plank, baffle |
| **custom** | EVERYTHING in FramedParams, no locks; bounds = engine envelope (length 8–48, width 8–24, etc.) | nothing | the TIMBER-1 demo building (D-CAT-18) |

### 4.3 Multi-story (which families, and exactly how)

- **Who:** `gp-frame` and `custom` only (`stories: 2`). All huts, shacks, sheds,
  latrines lock `stories: 1` (their standard designs are single-story). Towers are
  multi-LEVEL but not multi-story (platform + cab is the tower chassis's own logic).
- **How (stacked platform framing, FM 5-426's system):** story-1 walls → **second-floor
  platform**: rim + joists sized per Table 6-2 for floor load (PH, LS) bearing on the
  story-1 cap plates and a story-2 girder line over posts/partition (core: girder over
  the same center line, posts within story 1) → subfloor → story-2 walls (own opening
  set) → roof on story-2 plates.
- **Stairs required:** `stories: 2` forces `interiorStairs: true` — the existing
  basement-stair machinery (framed floor opening + stringer math) is re-aimed upward:
  the story-2 floor gets the trimmer/header/tail opening, stringers run story-1 floor →
  story-2 floor, riser/tread per the same (PH, LS) limits.
- **Openings per story:** `OpeningSpec` gains `story: 1 | 2` (default 1).
- **Gable-end second-story windows** are ordinary story-2 wall openings; no dormers
  (dormers are OUT of core — a roof-opening regime; not even IN-later until asked).

### 4.4 Opening fills (count, placement, and what fills the hole)

`OpeningSpec` extends today's `Opening` (offset/width/height/sill per wall) with:

```ts
export interface OpeningSpec extends Opening {
  story?: 1 | 2;
  fill:
    | 'rough'            // today's behavior: framed RO only
    | 'door-ledged'      // TO ledged-and-braced board door, built (§6.2)
    | 'door-screen'      // framed screen door, built
    | 'window-shutter'   // side- or top-hinged built shutter over the RO
    | 'window-screen'    // fixed screen insert (frame + screen)
    | 'window-screen-shutter' // SEA-hut pattern: screen + propped shutter
    | 'vent-screen'      // small high screened vent (SWA)
    | 'ac-sleeve';       // framed sleeve opening, boxed, no leaf
  placement?: 'exact' | 'auto';  // 'auto': engine spaces N openings evenly in the wall's clear run
}
```

- **Count/placement UX contract:** the picker config panel exposes per-wall counters
  ("Doors: N, Windows: M per wall") driving `placement:'auto'`; the custom surface and
  a per-opening "adjust" affordance expose exact offsets (today's model). Both compile
  to the same `OpeningSpec[]`; auto-placement is a pure, tested function (even spacing
  in the clear run, min edge distance = one stud bay).
- Header sizing per opening width from the header table (PH, LS) replaces the fixed
  `2x6` default; `headerNominal` stays as an override for `custom` only.

---

## 5. Roof families (cross-cutting catalog)

### 5.1 The catalog

| Roof id | Members implied (beyond wall plates) | Status | Notes |
|---|---|---|---|
| `gable` | ridge board, common rafter pairs (framing-square length − half ridge), collar ties, gable studs, sheathing courses OR purlins, rake/eave trim | **IN-core (exists)** | Today's generator; gains `roofDeck: purlins` option (D-CAT-21). |
| `shed` | single-slope rafters bearing high plate → low plate (bird's-mouth both ends), high/low wall height delta in the WALL generator (`upper/lower plate heights per wall`), rake studs on the two side walls (triangle infill), sheathing/purlins | **IN-core (new)** | Unlocks guard-shack, latrine, lean-to (later), storage variant, and `flat`. |
| `flat` (slope-to-drain) | = shed generator at 1/4–1:12; rafter-joists double as ceiling joists (no separate CJ stage on this roof); fascia all around | **IN-core (preset of shed)** | D-CAT-7 — honest naming: catalog entry + defaults, not a new engine. |
| `pyramid` (tower cab) | 4 hip rafters corner→apex, ≤2 jack rafters per face at 8-ft plan, no ridge, 4 triangular sheathing panels or purlin rings | **IN-core (tower chassis only, plans ≤ 10 ft square)** | D-CAT-5. Apex closure is a named test (AC-CAT-7). |
| `hip` (buildings) | ridge (shortened), common + hip + jack rafter series, 4-plane sheathing with trapezoid/triangle tiling | **IN-later** | FM 5-426 covers hip/jack layout (PH) — doctrinally real, deferred by D-CAT-5. |
| `salt-box` | asymmetric gable (unequal pitches/eaves) | **OUT** | D-CAT-6 — no TO standard design. |
| `gambrel` / `mansard` | — | **OUT** | Named in FM 5-426's roof-figure only; not TO practice. |

All roof families keep the framing-square math discipline and the existing invariants:
courses/purlins tile the slope exactly, last course ripped never overlapped, ridge/apex
flush logic, no zero/negative members — the current test culture extends to each.

### 5.2 Family × roof matrix

| Family | gable | shed | flat | pyramid | hip (later) |
|---|---|---|---|---|---|
| gp-frame | ✔ default | ✔ | ✔ | — | later |
| sea-hut | ✔ LOCKED | — | — | — | — |
| swa-hut | ✔ LOCKED | — | — | — | — |
| b-hut | ✔ LOCKED | — | — | — | — |
| squad-hut | ✔ default | ✔ | — | — | — |
| guard-shack | ✔ | ✔ default | — | — | — |
| storage-shed | ✔ default | ✔ | ✔ | — | later |
| latrine | — | ✔ LOCKED | — | — | — |
| strongback | bent-gable LOCKED (tent profile) | — | — | — | — |
| tower (cab) | — | ✔ | — | ✔ default | — |
| platform / tent-floor / crib-bunker | (no roof family — crib's cover is the stringer deck) | | | | |
| custom | ✔ | ✔ | ✔ | — | later |

The config panel renders only the legal roof options per family (typed: each FamilyDef
narrows `RoofSpec['family']`); illegal combos are unrepresentable, not validated away.

---

## 6. Coverings & completion catalog ("beyond framing")

Everything here emits **Members** (with roles from §2.4) into the existing stage 10/11
slots (framed chassis) or the chassis's covering stage, so the BOM partition invariant
keeps holding. Items marked *BOM-line* additionally aggregate area/length lines.

### 6.1 Roofing

| Item | Model | Doctrine (cite class) | Applies to |
|---|---|---|---|
| Felt underlayment | `feltPaper` members per slope course (thin panels), BOM in squares | FM 5-426 roofing prep, laps (PH) | any panel-decked roof |
| Roll roofing | `roofingRoll` 36-in courses up the slope, 2-in side / 6-in end laps (PH), nails + cement BOM-line | FM 5-426 roll roofing section (PH) | gp, swa (option), b-hut, squad, shack, storage, latrine, tower cab (option) |
| Corrugated metal | `roofingSheet` 26-in × 8-ft sheets, 1.5-corrugation side lap, 6-in end lap (PH), lead/neoprene-washer nails BOM-line; **requires deck = panel or purlins** | FM 5-426 metal roofing (PH); SEA-hut std section (PH) | sea-hut LOCKED, swa option, gp/storage/tower option |
| Purlin deck | `purlin` 2x4 flat across rafters at ≤ 24 in slope-spacing (PH) | SEA hut std design (PH) | sea-hut LOCKED; option wherever corrugated is chosen |
| Wood shingles | — | FM 5-426 covers them (PH) but no TO family uses them | **OUT** (re-entry: a family that needs them) |

### 6.2 Siding & wall closure

| Item | Model | Doctrine | Applies to |
|---|---|---|---|
| Plywood siding | `sidingPanel` 4×8 vertical, joints on studs, cut around openings (same tiling honesty as sheathing) | FM 5-426 plywood siding (PH) | huts LOCKED, gp/shack option |
| Board-and-batten | `sidingBoard` 1x10 verticals + `batten` 1x2 over joints | FM 5-426 board siding (PH) | storage default, gp option |
| Drop/horizontal siding | — | FM 5-426 (PH) | **IN-later** (second board pattern, no core family needs it) |
| Building paper | `feltPaper` on walls, BOM-line | FM 5-426 (PH) | under any siding, toggle |
| Screen band | `screenFrame` (1x2) + `screenPanel` per stud bay between band sill and plate; includes band cap trim | SEA hut std design (PH); FM 5-426 screening (PH) | sea-hut LOCKED, gp/shack/latrine option (latrine vent band LOCKED on) |

### 6.3 TO-built doors, windows, shutters (built sub-assemblies — D-CAT-12)

Each is a **sub-assembly**: its members carry a shared `assemblyId`, appear in the cut
list under their own group, and hang in the parent RO. Hardware goes to the hardware
schedule (§6.4).

| Build | Members | Doctrine |
|---|---|---|
| Ledged-and-braced door | `doorBoard` 1x6 T&G verticals, 3 × `doorLedge` 1x6, 2 × `doorBrace` 1x6 diagonals (compression direction correct — brace foot at hinge side, test-asserted), T-hinges + hasp (hardware) | FM 5-426 TO door construction (PH) |
| Framed screen door | 1x4 stiles/rails, corner braces, `screenPanel`, spring hinges (hardware) | FM 5-426 screen door (PH) |
| Board/plywood shutter | `shutter` leaf (plywood or boards + ledges), side-hinged (swa/b-hut) or top-hinged with prop stick (sea-hut `propped`) | hut std designs (PH) |
| Screen insert | `screenFrame` + `screenPanel` sized to RO | FM 5-426 (PH) |
| Latrine riser box | box sides/top from 1x stock + panel, hole cutouts (count = seats), lids w/ hinge, rear `shutter` drum flaps | ATP 4-25.12 box details (PH) |

Glazed sash: IN-later (supply item, §3.2).

### 6.4 Hardware, nails, concrete, insulation

- **Nail schedule (D-CAT-11):** `Member.nails?: { size: '6d'|'8d'|'10d'|'16d'|'20d'; count?: number; spacingIn?: number }` structured field written by every emit alongside the display string. BOM grows `hardware` section: nails aggregated to pounds via the nails-per-pound table (FM 5-426 nail table, PH), plus counted items (T-hinges, spring hinges, hasps, anchor bolts, post bases, roofing-nail washers, screen staples by the box).
- **Concrete (exists, extended):** pads, strip footings, walls, slab already ship; tower footings reuse pads with embedded post-base note; BOM already carries conc lineal feet — add cubic-yard line (volume from the same members; no re-measuring).
- **Skids:** PT `skid` 4x6/6x6 runners, chamfered noses, drift-pinned (hardware line) (PH).
- **Insulation:** **IN-later**, gated with `arctic-hut` (§3.2): batts in bays as BOM-lines + optional members; lineage TM 5-852 cold-regions (PH).
- **Stoop/entry steps (IN-core):** 2–4 risers, stair math reused, at every `door-*` opening when floor is raised ≥ 1.5 ft and `entrySteps` true.

### 6.5 Family × coverings matrix (✔ option, ● locked-on, — n/a)

| Family | felt | roll | corrug | purlins | ply siding | board-batten | screens | ledged door | screen door | shutters | steps | conc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gp-frame | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| sea-hut | — | — | ● | ● | ● (below band) | — | ● | ✔ | ● | ● propped | ● | pads |
| swa-hut | ● | ✔ | ✔ | — | ● | — | — | ● | — | ● side | ✔ | pads |
| b-hut | ● | ● | ✔ | — | ● | — | — | ● | — | ● | ✔ | pads |
| squad-hut | ✔ | ● | ✔ | — | ● | — | ✔ | ● | ✔ | ✔ | ✔ | pads |
| guard-shack | ✔ | ● | ✔ | — | ● | ✔ | ● (band) | ● | — | ● | auto | pads |
| storage-shed | ✔ | ✔ | ✔ | ✔ | ✔ | ● default | — | ● wide | — | — | ✔ | ✔ |
| latrine | — | ● | ✔ | — | ● | ✔ | ● vents | ● | ✔ | ● flaps | ● | — (skids) |
| tower | — | ✔ | ● default | ✔ (cab) | cab half-wall ● | — | ✔ cab band | — | — | ✔ cab | — | ● footings |
| strongback | — | — | — | ● (tent purlins) | — | — | ✔ side frames | frame only | ✔ | — | ✔ | pads |
| tent-floor / platform | — | — | — | — | — | — | — | — | — | — | ✔ | pads |
| crib-bunker | — | — | — | — | — | — | — | — | — | — | — | ✔ grade beams (option) |
| custom | ✔ everything | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

---

## 7. Picker taxonomy, cards, and cutaways

### 7.1 Groups and ordering (the mandated six)

```
Buildings        gp-frame · sea-hut · swa-hut · b-hut · squad-hut · guard-shack · storage-shed
Towers           tower
Hasty & Tents    strongback · tent-floor
Bunkers & Cover  crib-bunker
Site & Sanitation latrine · platform
Custom           custom
```

Single-card groups render as groups anyway (stable mental map; later families land in
their homes without re-teaching the taxonomy). Order within groups is the order above
(workhorse first, variants after).

### 7.2 Card anatomy and per-family art content

Card = art (SVG file) + name + blurb (§3 text verbatim) + a dims badge ("16×32 typ",
"10–32 ft") + group color tab. No status badges — everything shown works (D-CAT-10).

| Family | Card art content (what the SVG shows) | Projection |
|---|---|---|
| gp-frame | framed gable building, door + window, pier line visible | axon |
| sea-hut | wide-overhang gable, hatched screen band, propped shutters, purlin ends | axon |
| swa-hut | closed plywood box, small high vents, A/C sleeve | axon |
| b-hut | gable hut with dashed interior bay lines visible through the near wall | axon |
| squad-hut | smaller hut, single door | axon |
| guard-shack | shed-roof booth, window band on two visible sides, skids | axon |
| storage-shed | open-front variant: post-and-header bay, pallet-scale void | axon |
| tower | full-height **front elevation** — battered legs, X-panels, cab, ladder (height must READ) | elevation-front |
| strongback | bent frames + knee walls with dashed canvas profile ghost | axon |
| tent-floor | bare deck on skids | axon |
| crib-bunker | cutaway axon: near wall removed, stringer deck + translucent soil massing; **card carries the boundary line as its `CardViewSpec.note`** | axon |
| latrine | small shed-roof building, vent band, rear drum flaps ajar | axon |
| platform | dock with ramp and rails | axon |
| custom | static hand-authored SVG: blueprint grid + pencil + dashed building outline | (static file) |

### 7.3 Card-art pipeline (offline-safe, deterministic)

- `src/timber/cardart.ts` — **pure**: `renderCardSVG(members: Member[], view: CardViewSpec): string`.
  Axonometric projection of each member's oriented box → 6 quads → painter-sorted
  polygons → line-art SVG (2-color: ink + paper, matching the app's palette tokens).
  Reuses the member geometry as-is; no new geometry source (same single-source rule as
  the 3D scene). Screens/soil ghost render as hatch/translucent fills keyed by role.
- `scripts/gen-cards.ts` (build step) — for each FamilyDef: generate preset →
  `renderCardSVG` → write `dist-woodframe/assets/cards/<id>.svg`. **Files, never
  base64-inline** (D-CAT-9; the OOM lesson). The custom card's static SVG is checked
  into `src/ui/assets/`.
- **Tests:** golden byte-snapshots per card (determinism); size budget ≤ 40 KB/card,
  ≤ 500 KB total (asserted); the existing dist scan (zero external requests) covers the
  new assets automatically.

### 7.4 Custom/None card semantics (normative)

Clicking **Custom** opens the full framed-chassis surface: every FramedParams knob
live, zero locks, bounds = engine envelope, defaults = the TIMBER-1 demo building
(D-CAT-18). A secondary toggle switches the surface to the platform chassis ("just a
deck"). Tower and crib chassis are NOT reachable from Custom in core (their free
surfaces are LS-heavy; their families expose what's safe) — noted on the panel:
"Towers and bunkers are configured from their own cards." A `custom` spec that exactly
matches a family preset stays `custom` (no magic reclassification).

### 7.5 Cutaway per family (mandate #5)

Viewer contract: `CutawaySpec` (§2.2) drives a section plane; members whose center lies
camera-side of the plane hide; a section line + small station scrubber render. Ghost
layers (`soil`, `canvas`) render translucent instead of hiding. Defaults:

| Family | Default cutaway |
|---|---|
| buildings (all) | plane `X`, station at the primary door bay — section through door, floor, roof; 2-story shows the stair |
| sea-hut | plane `Z` mid — shows band section: plywood → screen → eave in one cut |
| tower | plane `X` mid — half the cab walls/roof hide; legs/bracing (open) stay |
| strongback | no cut; `canvas` ghost toggle instead (the frame IS the interior) |
| tent-floor / platform | plane `Z` mid — frame under deck reads |
| crib-bunker | plane `X` through entrance + `soil` ghost — THE money view; card art reuses it |
| latrine | plane `Z` through the riser box |
| custom | plane `X` mid, freely draggable |

### 7.6 Spec serialization & deep links

Every configured structure serializes to `StructureSpec` JSON (deterministic key
order); the picker/viewer round-trips it via `location.hash`
(`#s=<base64url(json)>`, small — specs are hundreds of bytes) so a build is
shareable/bookmarkable offline. "Back to structures" returns to the picker without
losing the current spec (hash-preserved). A `spec-roundtrip` test asserts
parse(serialize(x)) ≡ x over the whole catalog's presets.

---

## 8. Risks & kill criteria (catalog-scoped)

| Risk | Trigger | Kill/fallback |
|---|---|---|
| Pyramid cab math drags | cab roof not closing invariants after its phase budget | Tower ships with **shed cab** (already needed for shed family); pyramid slips to next phase. Tower does NOT slip. |
| Corrugated-on-purlins tiling unstable | overlap/gap invariants keep failing on odd lengths | SEA hut ships with panel deck + corrugated as BOM-line over it, with an honesty note on the member card; purlin mode moves to later. |
| Auto-placement of openings fights walls | clear-run spacing unsolvable under min-edge rules for legal counts | Clamp counts per wall length (bounds table) rather than shipping overlapping ROs; exact placement always available. |
| Crib load tables can't be page-verified in time | (PH) stringer table still unverified at release | Bunker ships with the depth input **capped at the table's smallest verified row**, or if none verified, bunker card holds one release (it is one card; the boundary sentence must never sit on unverified structure). |
| Nail-poundage table wrong-grained | counts diverge wildly from P-405 checks | Ship hardware schedule as counts-only (no pounds) until verified; counts are pure member data. |
| Card SVG budget blown | > 500 KB total | Reduce to elevation-only art (smaller) before reducing card count. |
| WallId widening breaks consumers | partition walls ('P1'…) leak into elevation/strip code paths expecting N/S/E/W | Partition members render in 3D + BOM only in core; elevation/strips filter to perimeter walls (test-asserted). |

## 9. Acceptance criteria for this catalog (testable by implementing sessions)

- **AC-CAT-1:** `CATALOG` in code contains exactly the 14 IN-core FamilyIds of §3.1; a test cross-checks ids and groups against a literal copied from this doc.
- **AC-CAT-2:** every FamilyDef preset generates: no throw, all members finite/positive, unique ids, stage ids within the family's chassis stage list, BOM stage partition sums exactly (existing invariant, applied per family).
- **AC-CAT-3:** every `locks` path resolves into the preset object; the config UI renders locked knobs read-only with the lock's cite (DOM test per family).
- **AC-CAT-4:** every numeric bound in every FamilyDef carries a `DoctrineCite`; every cite is either page-verified or contains "(PH)" (doctrine-integrity test extended over `src/timber/`).
- **AC-CAT-5:** LS ledger generation covers 100% of `lifeSafety`-tagged constants; G-LS fails a value change without an ack line (fixture test).
- **AC-CAT-6:** the threat-wordlist gate over `src/timber/` passes (no protective vocabulary; §1.5).
- **AC-CAT-7:** roof invariants per family×roof cell of §5.2: courses/purlins tile exactly, no member overlaps its neighbor course, pyramid apex closes (all hips meet within 1e-9), shed high/low bearing heights differ by exactly run×pitch.
- **AC-CAT-8:** tower invariants: leg base spread = cab + 2·batter·height; every bracing panel's X pair spans its girt frame; rungs count = floor(height/spacing)+deck rung; rails present on every open platform/cab edge (LS test); all four footings at grade.
- **AC-CAT-9:** built sub-assemblies (door/screen/shutter/riser box) appear as grouped cut-list sections whose members sum into their parent stage BOM without double counting.
- **AC-CAT-10:** card art: byte-deterministic per preset; ≤ 40 KB each; dist contains one SVG file per IN-core family + custom; zero external refs (existing dist gate).
- **AC-CAT-11:** spec serialization round-trips for all presets and 200 fuzzed custom specs.
- **AC-CAT-12:** cutaway spec exists for all 14 families and hides only members strictly camera-side of the plane (geometry test on 3 families incl. bunker ghost layer).
- **AC-CAT-13:** two-story gp-frame: story-2 floor bears on story-1 cap plates (level math test), stair opening framed with doubled trimmers/headers, stringer riser/tread within (PH, LS) limits.

*End of catalog. The phase plan (sibling doc) sequences chassis and families; the
backend doc owns module layout; both consume the ids, types, stages, and ACs defined
here verbatim.*

