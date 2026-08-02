# TIMBER-2 PLAN — TO Construction Studio

> **Status:** The synthesized, binding implementation plan for TIMBER-2. It merges four
> commissioned designs (`design-catalog.md`, `design-engine.md`, `design-ux.md`,
> `design-scope.md`) with every blocker-level critique applied, majors applied unless
> they conflicted (conflicts recorded in §11), and minors applied at judgment. Where
> this plan and a source design disagree, THIS PLAN GOVERNS; the resolution is logged
> as a TD decision in §11. Implementing sessions execute phases T0–T8 in order without
> the planner present. Quality bar: `docs/SAP2_BLUEPRINT.md`.
>
> **Ground truth (verified 2026-08-02):** `src/timber/{types,frame,floor,walls,roof,
> elevation,bom}.ts` (one gable rectangular building, piers/wall/basement foundations,
> openings, stairs); `src/ui/woodframe-scene.ts` + `woodframe.html` (three.js viewer,
> 7 view chips, stage scrubber, member cards, strips, GLB props); three legacy suites
> `test/timber-frame|walls|features.test.ts` (33 tests; repo-wide count floats and is
> never used as an acceptance number — TD31); `npm run verify` + `npm run build:suite`
> green at baseline.
>
> **Normative companions (completeness fix, gap 1):** the four source designs are
> COMMITTED at `docs/timber2-design/design-{catalog,engine,ux,scope}.md` (T0 does the
> copy). Every "design-X §N" citation in this plan resolves to those repo paths — a
> fresh session builds from the repo alone, no scratchpad required.
>
> **Precedence inside this plan:** §8 invariants > this document > the four source
> designs > taste. Code fences are normative signatures — keep names and shapes exactly
> unless a logged `DECISIONS.md` entry supersedes them.

---

## 1. Mission & non-negotiables

### 1.1 Owner's mandate → testable requirements

| # | Mandate (verbatim intent) | Requirement | Where |
|---|---|---|---|
| M1 | "Different types of structures, different types of roofs, different numbers of stories, all the variables — ALL in the rough construction the USMC would ever use." | A structure catalog (§2) of 14 IN-core families over ONE engine: a `StructureSpec` discriminated union (§3.1), roof families gable/shed/flat/pyramid (+hip later), stories 1–2, every knob schema-declared. | §2, §3 |
| M2 | "Go beyond the framing seriously in every way." | Subsystems for foundations/concrete, sheathing, roofing coverings, siding, TO-BUILT doors/screens/shutters, stairs/ladders/railings, hardware + nail schedule — all first-class `Member`s in the same BOM/stage partition. | §2.6, §3.2 |
| M3 | Opens on a STRUCTURE PICKER — cards with images; "None/Custom" = fully customizable option set. | Picker with self-generated deterministic SVG thumbnails (§4.4); Custom card = the full building-family surface, shipped EARLY (custom-lite at T3, growing every phase — TD22, fixing the ship-last blocker). | §4, §5, §7 |
| M4 | Named types: guard towers, the hut family exhaustively (SEA hut, SWA hut, B-hut, squad hut, guard shacks…), hasty structures (strongbacks), bunkers, "etc". | Every named type is an IN-core catalog family with doctrine lineage; towers ship at T4 (first-named = early); the exhaustive IN-later/OUT disposition closes the "etc". | §2.2–2.4, §7 |
| M5 | EVERY structure has a cutaway view option. | Clip-plane cutaway in the scene layer, family-agnostic, with raycast side-filtering and per-family default cut specs; ghost layers (soil, canvas). | §4.2 |
| M6 | Minute control: dimensions, door/window/opening counts, roof type, "type of everything." | Per-wall `OpeningSpec[]`; schema-driven config panel; `normalizeSpec` clamps with visible issues; standard designs lock only what their drawing pins, with a one-step unlock-to-custom escape. | §3.1, §5.3–5.4 |
| M7 | The plan is the deliverable; other sessions implement phase-by-phase. | This document: exact modules, signatures, per-phase contents + acceptance + tests + demo + descope ladder + START HERE blocks. | whole doc |

**"Mal houses" interpretation (carried from design-catalog):** the modular/small-house =
hut family, enumerated exhaustively: SEA hut, SWA hut, B-hut, squad hut, guard shack,
plus the general-purpose framed building they derive from.

### 1.2 Non-negotiables (every phase, no exceptions)

1. **Fully offline.** Zero external requests ever; `scripts/check-offline.ts` scans dist
   and stays green. No fetch/XHR/WebSocket anywhere in the timber surface.
2. **Zero runtime deps beyond three.js.**
3. **Deterministic outputs.** Same spec → byte-identical `Member[]`, BOM, thumbnails.
4. **One toolkit deploy** (hub + `/woodframe.html` + `/survivability/`); `npm run
   build:suite` green at every merge to main.
5. **Assets ship as files, never base64 megabundles.** `assetsInlineLimit` in
   `vite.suite.config.ts` is never raised. Rationale restated on verifiable grounds
   (TD19): the offline mandate, the ≤500 KB thumb/art budget, byte-deterministic golden
   tests, and DECISIONS.md D28's deliberate, bounded GLB inlining as the ONLY sanctioned
   inline exception. Picker images are SELF-GENERATED (runtime SVG from the engine —
   §4.4); no downloaded images, no build-time render step in the deploy sandbox.
6. **The legacy timber suites are immutable.** `test/timber-frame|walls|features.test.ts`
   are never edited; acceptance is stated as "git diff empty on test/timber-*.test.ts AND
   npm run verify green" — never as a repo-wide test count (TD31).
7. **TIMBER ships working doctrinal defaults with (PH) cites** — the deliberate opposite
   of SAP-2's ship-empty regime, with the boundary and life-safety posture of §6. This
   supersedes SAP2_BLUEPRINT's TIMBER re-entry row by owner-acked reciprocal edit (TD1,
   a blocker fix — see §6.5).

---

## 2. The structures catalog

### 2.1 Publication spine (doctrine base)

**USMC applicability (gap-9 fix):** the owner's ask is USMC rough construction. The
governing corpus below is the joint Army/USACE/Navy TO-construction canon, which USMC
engineer doctrine adopts — map MCRP/MCTP equivalents where they exist (e.g. the
FM 5-34 ≙ MCRP 3-17A class), cites (PH) — and Seabee/NAVFAC standard drawings support
the MAGTF and are in-scope sources.

Every generator constant carries one of these in `doctrineRef`, with the existing
"(PH) pending page verification" discipline. Changes vs design-catalog §1.1 are marked ►.

| Key | Publication | Grounds here |
|---|---|---|
| FM 5-426 | *Carpentry* (1995) | The spine: layout, foundations, floor/wall/roof framing, framing-square math, sheathing, roofing, siding, TO doors/windows, stairs, nail schedules, dressed sizes (Table 2-1), span tables (6-1/6-2). |
| ► EM 385-1-1 | *USACE Safety and Health Requirements Manual* (current ed.) | **The named LIFE-SAFETY authority** (blocker fix): guardrail 42 in + mid 21 in + toe board, ladder rung spacing and the cage/ladder-safety threshold, stair riser/tread/landing limits, ramp slopes. All LS-tagged constants cite EM 385-1-1 (PH) as safety authority; TM 5-302 remains the geometry lineage. |
| TM 5-302-series | AFCS standard designs (TM 5-302-1/-2/-3/-5) | Standard-drawing lineage: hut plans, guard/observation towers, tent frames & floors, latrines, loading platforms. (PH sheets.) |
| ► TM 5-303 | AFCS *Logistic Data* — bills of materials + man-hours for TM 5-302 designs | The doctrinal cross-check for whole-structure BOM totals and the anchor for labor factors (major fix). Acceptance in T8: one family's generated BOM reconciles against the published bill within a stated tolerance once sheets are verified. |
| TM 5-301 / FM 5-35 / FM 5-34 | AFCS planning + engineer field data | Planning factors, crew sizes, **timber member/span tables for stated dead loads** (candidate source for the crib-bunker table — §2.7). (PH) |
| UFC 1-201-01 | Non-Permanent DoD Facilities | Modern authority for the hut classes. (PH) |
| CENTCOM Sand Book | Contingency construction standards | B-hut, guard tower, burn-out latrine drawings. (PH) |
| NAVFAC P-405 | Seabee Planner's & Estimator's Handbook | Man-hour/labor factors (with TM 5-303). (PH) |
| ► TM 10-8340-series | Tent technical manuals (GP Small / GP Medium / TEMPER) | **Tent-dimension authority** (major fix): strongback/tent-floor footprints, knee-wall + ridge heights, bent spacing all derive from a per-tent geometry table cited here (PH). |
| ATP 3-37.34 / FM 5-103 | Survivability Operations | ► Amended row (blocker fix): configuration reference for bunker shapes/vocabulary, **plus its DEAD-LOAD timber member/stringer-vs-cover tables are admissible as an LS source for the crib-bunker** — threat/standoff/protection rows are excluded and the wordlist gate (§6.4) is unchanged. If FM 5-34/5-35 carry equivalent timber tables, they are preferred; the crib lock names the specific table (PH). |
| ATP 4-25.12 / FM 21-10 | Field sanitation | Latrine box dimensions, burn-out drum arrangement, fly-proofing, **hand-wash requirement** (noted on the latrine card). (PH) |
| GTA 5-series | Construction graphic training aids | Pocket-card corroboration. (PH) |

Cite rule (unchanged, extended): every doctrinal magnitude carries a `doctrineRef`;
unverified cites carry "(PH)". **This applies to this plan's own normative tables too**
(major fix): every locked magnitude in §2.4 names its pub + (PH), and the doc-derived
`FamilyDef.locks` are linted by the doctrine-integrity test (AC-CAT-4 extended).

### 2.2 Families — IN-core (14), one source table

**TD2 (architecture merge):** breadth lives in `FamilyDef` preset data; correctness lives
in ONE engine — the `StructureSpec` discriminated union of §3.1 with family generators
composing shared subsystems. The catalog's "four chassis" and scope's "registry of 16
StructureIds" both map onto this: chassis ≙ spec-union branch; card ≙ `FamilyDef`.

**TD3 (single source of truth for locks/roofs/coverings — major fix):** the per-family
FIXED/EXPOSED table (§2.4), the roof matrix (§2.5) and the coverings matrix (§2.6) are
all GENERATED from one `FAMILY_TABLE` in `src/timber/catalog.ts`; a test asserts the
rendered doc tables in `docs/TIMBER2_PLAN.md` agree with it (drift impossible). Legend:
**●** = default, replaceable by that row's ✔ options; **LOCKED** = in `FamilyDef.locks`.
`FamilyDef.locks` is the single normative source for AC-CAT-3.

| FamilyId | Group | Spec branch | One line | Lineage (cite class) |
|---|---|---|---|---|
| `gp-frame` | buildings | building | The workhorse TO framed building, 1–2 stories, with a REAL standard-design identity distinct from custom (TD20): curated AFCS GP-building defaults. | FM 5-426 ch.4–6; TM 5-302 GP building (PH); UFC 1-201-01 (PH) |
| `sea-hut` | buildings | hut:seaHut | Tropical screened hut, 16 ft wide: plywood to 4 ft, screen band to eaves, purlins + corrugated. | TM 5-302 SEA hut std design (PH) |
| `swa-hut` | buildings | hut:swaHut | Desert enclosed plywood hut: sealed walls, small shuttered vents, A/C sleeves. | USACE SWA std design (PH); UFC 1-201-01 (PH) |
| `b-hut` | buildings | hut:bHut | 16×32 plywood barracks hut, door each end, window per bay, optional 8-bay partitions. | CENTCOM Sand Book (PH) |
| `squad-hut` | buildings | hut:squadHut | Small-crew hooch, 12×16 up. **Lineage marked honestly: "B-hut family scaled — no dedicated sheet identified"** (minor fix); wall height LOCKED 8 ft matching hut practice until a sheet says otherwise; `FamilyDef.rationale` records the thin lineage. | B-hut family scaled (PH) |
| `guard-shack` | buildings | hut:guardShack | 1–2 person ECP booth, 4×4–10×10, shed/gable, shuttered window band, skids. | TM 5-302 sentry booth (PH); Sand Book (PH) |
| `storage-shed` | buildings | building (openFront wall option) | Covered storage: wide door bay or open post-and-header front. Exposed roofs: gable/shed/**flat** (matrix fix). | TM 5-302 storage (PH) |
| `tower` | towers | tower | Battered-leg X-braced timber tower, 10/16/24/32 ft; **ladder access only at 10/16 ft; 24/32 ft force switchback stair** (blocker fix — EM 385-1-1 cage threshold, cage itself IN-later). | TM 5-302 tower std design (PH); EM 385-1-1 (PH, LS) |
| `strongback` | tents-frames | tentFrame | Frame + floor a GP/TEMPER tent skins over; bents per the tent geometry table (TM 10-8340, PH). No floor-only redirect (TD21) — tent-floor is its own card. | TM 5-302 tent frame (PH); TM 10-8340 (PH) |
| `tent-floor` | tents-frames | platform (pure preset — TD21) | Deck-only platform sized to tent footprints. Zero new params, roles, or generator branches (asserted by the family-identity AC). | TM 5-302 tent floor (PH); TM 10-8340 (PH) |
| `crib-bunker` | bunkers | bunker | The WOOD STRUCTURE of a protective shelter sized to a USER-STATED cover depth. Boundary per §2.7 printed on the card. | ATP 3-37.34 config + dead-load tables per §2.1 (PH, LS); FM 5-426 (PH) |
| `latrine` | site | hut:latrine | 2/4-seat burn-out latrine on skids. **Depth EXPOSED 4–8 ft bounded (PH) until the TM 5-302/Sand Book sheet is verified** (major fix), then locked at the drawing value. | ATP 4-25.12 (PH); TM 5-302 latrine (PH) |
| `platform` | site | platform | Loading dock / work platform 0.5–5 ft, ramp, steps, rails. | TM 5-302 loading platform (PH); EM 385-1-1 rails/ramps (PH, LS) |
| `custom` | custom | building (full surface) | Clean sheet: the complete building-family surface, nothing locked, defaults = the TIMBER-1 demo as a SEED, with a 'minimal shell' preset row for true
start-from-nothing (gap-15). Card copy: "Custom — start from a clean sheet". Card states scope: "custom BUILDING — towers, bunkers, and platforms customize from their own cards" (TD22). | FM 5-426 |

**Family-identity AC (minor fix):** no two FamilyDefs share `(specBranch, locks, bounds)`
modulo preset; owner-named thin variants (squad-hut) pass only via a recorded
`FamilyDef.rationale`. gp-frame's preset is distinct from custom's (see §2.4).

**Picker groups & scale rule (minor fix):** groups are `buildings · towers ·
tents-frames · bunkers · site · custom` (the group formerly "Hasty & Tents" is renamed
**"Tents & Frames"**). Hasty, precisely (gap-10 fix): the EXCLUDED category is
expedient lashing/pole shelters — OUT with a re-entry bar; the owner's hasty/temporary
ask is SATISFIED by strongback + tent-floor (and IN-later lean-to), which live in
Tents & Frames. Every IN-later row in
§2.3 carries its destination group. Scale rule: any group exceeding 8 cards splits (e.g.
"Huts & Billeting" vs "Utility buildings") and the picker gains a type-ahead filter
(already designed, §5.2).

### 2.3 IN-later (designed-for, no cards shipped) and OUT

IN-later (group in parentheses; no greyed-out cards ever): `lean-to` (buildings),
`pole-building` (buildings), `tank-stand` (towers), `headcover-frame` (bunkers — gated on
SAP-2 one_man, §2.7), `shower` (site), `gate-barrier` (site), `bleachers` (site),
`kennel` (buildings), `arctic-hut` + insulation (buildings), 8-seat latrine + urinal
soakage stand (site), ► `duckboard walkway` (site), ► `hand-wash stand` (site — ATP
4-25.12 mandates one per latrine; noted on the latrine card), ► `vehicle loading ramp`
(site, distinct from the personnel ramp), multi-girder wide buildings > 24 ft,
free partition editor, glazed sash windows, continuous tower heights, ladder safety cage
(with the tower family once page-verified), hip roof for buildings (pyramid ships first),
drop/horizontal siding, runtime thumbnails for saved customs.

OUT with re-entry bars (unchanged from design-catalog §3.3): bridging/trestles,
revetments/soil retention, ammo barricades, trussed clear-span buildings, lashing/pole
expedient shelters, salt-box/gambrel/mansard, 3+ stories, towers above 32 ft,
horizontal construction.

### 2.4 Per-family parameter surfaces (FIXED vs EXPOSED)

"FIXED" = in `FamilyDef.locks`: read-only in the config panel with the lock's cite.
"EXPOSED" = live knob clamped to `FamilyDef.bounds` (each bound cited). All rows below
are generated from `FAMILY_TABLE` (TD3). Every named magnitude carries its pub class +
(PH) — the previously-uncited tower bracing module, girts, deck plank, ramp slopes, and
flat band are now cited (major fix).

| Family | EXPOSED (bounds, cited) | FIXED (cite class) | Preset |
|---|---|---|---|
| **gp-frame** | length 8–48, width 8–24, stories 1–2, wall ht 7–10, roof gable/shed/flat + pitch + overhang 0–3, openings (any), foundation piers/wall/basement/skids, spacing, bridging, bracing, coverings, entry steps, attic access | girder/joist/header sizing per tables (FM 5-426 T.6-1/6-2 + header table, PH, LS) | **20×48, gable 4:12, piers, plywood siding + roll roofing ON, door each end, window per second bay** (TM 5-302 GP building pattern, PH) — deliberately NOT the custom/demo preset (TD20) |
| **sea-hut** | length 16–48 (4-ft module), door count 1–3 (values ≠ the drawing's 2 end doors render the **"deviation from standard drawing"** affordance — minor fix), shutter mode, foundation piers/skids, crawl 1.5–3 | width 16; wall ht 8; screen-band sill 4 ft; gable 4:12, overhang 3 ft; purlins + corrugated; plywood below band; screens on; entry steps on (TM 5-302 SEA hut, PH) | 16×32, 2 end doors, propped shutters |
| **swa-hut** | length 16–36, width 16 (20 only if a variant sheet is cited (PH); until then 16 locked — minor fix), doors 1–2, vents 2–6, A/C sleeves 0–2, roofing roll●/corrugated✔, foundation piers/skids | wall ht 8; gable 4:12, overhang 1 ft; panel deck; plywood full-height; felt on (USACE SWA, PH) | 16×32, 2 doors, 4 vents |
| **b-hut** | length 16–36, doors 1–2, windows 0–8 (**preset 8 = window per bay; other values marked deviation** — minor fix), partitions on/off, roofing roll●/corrugated✔, foundation piers/skids | width 16; wall ht 8; gable 4:12; plywood siding; partition layout: 8 bays + aisle (Sand Book, PH) | 16×32, 2 doors, 8 windows, bays on |
| **squad-hut** | length 12–24, width 12/16, door 1, windows 0–4, roof gable/shed, roofing roll●/corrugated✔, foundation piers/skids | wall ht **8** (hut practice; no dedicated sheet — rationale recorded); plywood siding | 12×16, gable, 1 door, 2 windows |
| **guard-shack** | plan 4×4–10×10 (**small-plan rule applies below 8 ft width — §3.2.2**), roof shed/gable, band walls, door wall, foundation skids/piers, roofing roll●/corrugated✔ | wall ht 7; band sill 3.5 ft head 6.5 ft, shuttered + screened; steps auto (TM 5-302 sentry booth, PH) | 6×6, shed 2:12, band 3 sides, skids |
| **storage-shed** | length 8–32, width 8–24, roof gable●/shed/**flat** (matrix fix), big-door width 4–10 (header table, PH, LS) or openFront wall, foundation piers/skids/wall | wall ht 8; board-and-batten default (TM 5-302 storage, PH) | 12×20, gable, 8-ft double door |
| **tower** | height 10/16/24/32, cab 6/8, **access: ladder (10/16 only) / stair (any; forced at 24/32 — EM 385-1-1 cage threshold, PH, LS; AC-CAT-8 pins it)**, cab walls 3 modes, cab roof pyramid●/shed, cab roofing corrugated●/roll, **footing: buried timber mudsill / concrete pad + post base (each PH to the std drawing; concrete default at 24/32)** (minor fix) | legs 6x6, batter 1.5 in/ft (TM 5-302 tower, PH); X-brace 2x6, panel module ≤ 8 ft (TM 5-302 tower, PH, LS); girts 2x6 at panel lines (TM 5-302, PH); platform joists per span table (PH, LS); deck 2x6 plank (TM 5-302, PH); rails 42/21 + 4-in toe (EM 385-1-1, PH, LS); **ladder: 2x4 rails, 2x2 rungs let in at 12 in spacing, 36 in top extension (TM 5-302 detail + EM 385-1-1, PH, LS)** — ambiguity resolved, 1x4 cleats recorded as the rejected alternative (TD24) | 16 ft, 8×8 cab, ladder, half-wall-screen, pyramid |
| **strongback** | tent preset GP-Small / GP-Medium / TEMPER·N (N 2–8), end door on/off, foundation piers/skids | footprint, knee-wall + ridge heights, AND bent spacing **all from the per-tent geometry table (TM 10-8340-series, PH)** — `bentSpacingFt: number`, not a typed literal 4; **GP-Small = 17 ft 6 in square per the tent TM (PH)**, not 16×16 (major fix); purlins on; no sheathing/roofing/siding (canvas by others) | GP-Medium |
| **tent-floor** | tent preset or free 8–32 × 8–20, deck ht 0.5–1, base skids/piers, deck plank/panel | rails locked off ≤ 1 ft (EM 385-1-1 threshold, PH) | 16×32 panel deck, skids |
| **crib-bunker** | interior 6×8–12×16, clear ht 4.5–7, **designCoverDepthFt 0–4 — bound cited to the load table's row range, not doctrine** (major fix), wall type post-plank/crib, entrance open/baffle | post/cap/stringer/lagging size + spacing from the load table vs stated depth (table named per §2.1, PH, LS, SME-reviewed per §6.3) — shown with row cite, never editable | 8×10, 6 ft clear, 2 ft stated cover, post-plank, baffle |
| **latrine** | seats 2/4, **depth 4–8 ft (PH until sheet verified)**, door wall | wall ht 7; shed 2:12; riser box seat ~18 in (PH), hole spacing ~30 in (PH); rear drum flaps on; vent band on; fly screen on; skids (ATP 4-25.12 + TM 5-302, PH). **AC: riser box + aisle + door-swing geometry closes for both seat presets** (major fix) | 4-seat burn-out |
| **platform** | length 6–24, width 4–16, deck ht 0.5–5, base, deck plank/panel, ramp (+width 4–12, **slope 1:4/1:6/1:8 — EM 385-1-1/TM 5-302 (PH, LS)**), steps, rail edges | rails 42/21/toe auto ≥ 2.5 ft (EM 385-1-1, PH, LS), removable per edge with LS warning; ramp stringer table (PH, LS) | 8×12 dock at 3.5 ft, ramp, rails 3 edges |
| **custom** | the full BuildingSpec surface, no locks; bounds = engine envelope (length 4–60, width 4–24 with the small-plan rule below 8 ft; stories ≤ 2; pitch 0–12) | nothing | the TIMBER-1 demo building (20×16×8 gable 4:12, piers, door + 2 windows) |

**Migration table (blocker-class fix — replaces the false "strict superset" claim):**
`BuildingInput` → `BuildingSpec` via `specFromBuildingInput` (§3.1):

| BuildingInput field | BuildingSpec home |
|---|---|
| `lengthFt`/`widthFt` | `dims.lengthFt/widthFt` |
| `wallHeightFt` | `stories[0].wallHeightFt` |
| `studSpacingIn`/`joistSpacingIn`/`rafterSpacingIn` | `spacing.{studSpacingIn,joistSpacingIn,rafterSpacingIn}` |
| `risePer12`/`overhangFt` | `roof: { kind:'gable', risePer12, overhangFt }` |
| `openings[]` (per-wall) | `stories[0].openings` (WallOpenings), same offset convention, **same array order** (TD5) |
| `foundation`/`crawlFt`/`basementDepthFt` | `foundation` union |
| `stairs` (basement stair toggle) | `foundation: { kind:'basement', stairs }` — **default true when basement, matching floor.ts** (fix: today's tested behavior stays reachable) |
| `bridging`/`letInBracing`/`atticAccess` | same names (bracing per story) |

A compat test maps the TIMBER-1 demo `BuildingInput` through this table and asserts the
identical `Member[]` (§8.2).

### 2.5 Roof families (cross-cutting)

| Roof | Status | Notes |
|---|---|---|
| `gable` | IN-core (exists) | Today's math verbatim; gains `roofDeck: purlins` option. |
| `shed` | IN-core (T2) | Single slope high→low plate; the ROOF module emits the high-side pony wall and rake infill studs — `wallSystem` walls stay rectangular (TD6, resolving the scope-design shed blocker: `generateWalls` is never asked to produce unequal walls). |
| `flat` | IN-core (preset of shed) | ► **Floored at 1:12** (major fix) — `drainPer12` clamps to [1, 2]; roofing LOCKED to double-coverage roll with the (PH) min-slope cite on the member card (FM 5-426 roll-roofing minimums: exposed-nail ~2:12, double-coverage ~1:12). Built-up roofing is not modeled; the 1/4:12 band is rejected (TD7 records why). |
| `pyramid` | IN-core (tower cab only, plans ≤ 10 ft) | 4 hips + ≤2 jacks/face; apex-closure AC. Also the T8 stepping-stone to hip. |
| `hip` (buildings) | IN-later → T8 timeboxed | Equal-pitch pyramid/square hip ships FIRST at T8; if full hip parks, a T9 row is auto-appended to the progress table with the standard DoD (minor fix — no unowned backlog line). |
| salt-box / gambrel / mansard | OUT | No TO standard design. |

Family × roof legality is generated from FAMILY_TABLE (TD3); the config panel renders
only legal options per family — illegal combos are unrepresentable, not validated away.

### 2.6 Coverings & completion ("beyond framing")

All items emit `Member`s into the family's covering stages, preserving the exact BOM
partition. Legend per TD3 (● default, ✔ option, LOCKED per FamilyDef.locks).

- **Roofing:** felt underlayment (courses, BOM in squares); roll roofing (36-in courses,
  2-in side/6-in end laps (PH); double-coverage mode for flat); corrugated metal (26-in
  × 8-ft sheets, 1.5-corrugation side lap (PH); requires panel deck OR purlins — the
  SEA-hut purlins-only pattern is first-class); purlin deck (2x4 flat ≤ 24 in slope
  spacing (PH)); wood shingles OUT.
- **Siding:** plywood (4×8 vertical, joints on studs, cut around openings — reuses the
  existing `siding` MemberRole, TD8); board-and-batten (`sidingBoard` 1x10 + `batten`
  1x2); building paper; screen band (`screenFrame` 1x2 + `screenPanel` per bay).
- **TO-built sub-assemblies** (shared `assemblyId`, grouped cut-list sections):
  ledged-and-braced door (1x6 boards, 3 ledges, 2 braces — compression direction
  test-asserted), framed screen door, board/plywood shutters (side-hinged or propped),
  screen inserts, latrine riser box. Glazed sash IN-later.
- **Hardware & nails:** structured `Member.nails?: { size; count?; spacingIn? }` beside
  the display string; BOM hardware section: nail poundage via the nails-per-pound table
  (FM 5-426, PH), counted items (T-hinges, hasps, post bases, washers, staples).
- **Concrete:** existing pads/footings/walls/slab + cubic-yard BOM line; tower pad
  footings per §2.4. **Skids:** PT 4x6/6x6 runners, chamfered, drift-pinned (PH).
- **Entry steps:** stair math reused at every door when floor raised ≥ 1.5 ft.
- **Insulation:** IN-later with arctic-hut.

**Late dispositions (gap-16 fix, same class as TD34's duckboards):** cornice/fascia/
rake trim → IN-later on buildings (FM 5-426 covers cornice work; BOM-affecting);
stove-jack/heater-pipe penetration → IN-later note on the hut and strongback cards
(framed penetration + flashing line item); paint/preservative treatment → OUT (no
cut-list impact beyond the PT skids already modeled).

### 2.7 The SAP-2 bunker boundary (normative)

- **SAP regime (never here):** how much earth/material/standoff defeats what threat;
  any output readable as "you are protected."
- **TIMBER regime (here):** the wood structure — posts, caps, stringers, lagging,
  entrance — sized to carry a **user-stated** `designCoverDepthFt` of soil dead load via
  the published timber table named in §2.1 (PH, LS, SME-reviewed per §6.3).
- **Reciprocal ownership (major fix, stated NOW on the IN-core family, not only the
  IN-later headcover-frame):** TIMBER owns the wood cut list only; excavation, spoil,
  cover, and position design remain SAP artifacts. Hand-off: a SAP output states
  `designCoverDepthFt`; TIMBER consumes it. `docs/SAP2_BLUEPRINT.md` gains an R5b entry
  condition "reconcile bunker_op_cp with TIMBER-2 crib-bunker" (T0 edit, owner-acked) so
  the boundary is owned on both sides and SAP's commissioning watermark cannot be
  end-run by reading numbers off TIMBER.
- **Consistency with SAP-1:** TIMBER's stringer table and SAP's
  `protection.spanSizes`/overhead model must be the same table or test-cross-checked
  when SAP-2 commissions; recorded in the crib family's lineage row and in §2.3's
  headcover-frame gate (minor fix).
- **Rendering:** soil renders as a ghost massing labeled `COVER DEPTH: user-stated —
  protective sizing is a survivability (SAP) decision, not computed here`; the same
  sentence prints on the bunker BOM header and the card blurb. Enforcement gates in
  §6.4 (word-boundary wordlist + pub-denylist + positive render assertions).
- **Deep links:** `designCoverDepthFt` is **stripped on serialize** and re-prompted on
  load (minor fix vs SAP-2's URL-state ban; TD9 records the divergence rationale for
  carpentry specs generally). Surface enumeration (gap-7 fix): SHARE LINKS and
  `.timber.json` exports strip the value and re-prompt on load; the on-device
  `timber2-session` localStorage KEEPS it, so crash/boot resume regenerates without a
  re-prompt and §5.5's always-generatable rule holds. Tests cover both directions:
  a serialized crib spec contains no cover-depth value; a restored session does.
- If SAP-2 is not commissioned, the bunker still builds — the depth is a stated design
  load, like a snow-load assumption.

---

## 3. Parametric engine architecture

### 3.1 Type system (binding; `src/timber/spec.ts` unless noted)

All plain data — JSON-serializable, no functions/classes — so specs are catalog data,
hashable, diffable. The design-engine union is the spine, EXTENDED with a `platform`
family and with the mode-flag legality fix (TD4): **framing/wall modes live in separate
union branches or per-wall enums, so illegal combos (bent+2-story, openFront+screenBand)
are unrepresentable by construction** — the design-catalog "god-surface" FramedParams is
rejected.

```ts
import type { WallId } from './types';           // 'N'|'S'|'E'|'W' (unchanged)
import type { BridgingType } from './floor';

export interface Dims { lengthFt: number; widthFt: number }   // X = length, Z = width

export interface SpacingSpec { studSpacingIn: 12|16|24; joistSpacingIn: 12|16|24; rafterSpacingIn: 12|16|24 }
// widened from 16|24 (additive; BuildingInput keeps 16|24, adapter upcasts)

export type OpeningKind = 'door' | 'window' | 'vent' | 'screen' | 'hatch' | 'embrasure';
export type OpeningFill =
  | 'rough' | 'door-ledged' | 'door-screen' | 'window-shutter' | 'window-screen'
  | 'window-screen-shutter' | 'vent-screen' | 'ac-sleeve';

export interface OpeningSpec {
  kind: OpeningKind;
  offsetFt: number; widthFt: number; heightFt: number; sillHeightFt: number;
  headerNominal?: string;          // default: header table by span (PH, LS); custom-only override
  fill?: OpeningFill;              // default 'rough' (legacy behavior)
  story?: 1 | 2;                   // default 1
  placement?: 'exact' | 'auto';    // 'auto': engine spaces N openings evenly in clear run (pure, tested)
}
export type WallOpenings = Partial<Record<WallId, OpeningSpec[]>>;
// TD5 (blocker fix): `fill` lives HERE, not on walls.ts's Opening — walls.ts stays
// untouched. Generators NEVER iterate Object.keys(openings); they iterate the const
// wall array ['S','N','E','W'] in the legacy walls.ts order (invariant I-15, tested by
// key/array-order permutation).

export type RoofSpec =
  | { kind: 'gable'; risePer12: number; overhangFt: number }
  | { kind: 'shed';  risePer12: number; overhangFt: number; highSide: WallId }
  | { kind: 'flat';  overhangFt: number; drainPer12?: number }   // clamps to [1,2] — §2.5
  | { kind: 'hip';   risePer12: number; overhangFt: number }     // T8
  | { kind: 'none' };

export type FoundationSpec =
  | { kind: 'piers'; crawlFt: number }
  | { kind: 'wall';  crawlFt: number }
  | { kind: 'basement'; depthFt: number; stairs: boolean }       // stairs default true (§2.4 migration)
  | { kind: 'slab' }
  | { kind: 'skids'; skidNominal?: string }                      // PT 4x6 default
  | { kind: 'embedded'; embedFt: number };                       // tower/bunker posts

export interface StorySpec { wallHeightFt: number; openings: WallOpenings; letInBracing?: boolean }

export interface CoveringSpec {
  wallSheathing: 'none' | 'plywood' | 'boards';
  siding:        'none' | 'plywood' | 'boards' | 'boardAndBatten';
  roofDeck:      'none' | 'plywood' | 'boards' | 'skip' | 'purlins';
  roofing:       'none' | 'roll' | 'rollDouble' | 'corrugated';
  buildingPaper?: boolean;
}

// The shared base every family branch extends (gap-2 fix — previously cited but
// undefined). normalizeSpec records which fields a family IGNORES (tent-frame ignores
// siding; tower ignores wallSheathing...) as dropped-with-issue — never silently kept.
export interface SpecCommon {
  dims: Dims;
  spacing: SpacingSpec;
  coverings: CoveringSpec;
  label?: string;                       // user's name for a saved config (workbench)
}

export interface BuildingSpec extends SpecCommon {
  family: 'building';
  stories: StorySpec[];                 // 1..2 (normalizeSpec clamps)
  roof: RoofSpec;
  foundation: FoundationSpec;
  bridging?: BridgingType;
  atticAccess?: boolean;
  interiorStairs?: boolean;             // default true at 2 stories; false is LEGAL — see §2.4 access note (gap-11)
  openFront?: WallId;                   // storage-shed: posts + header; that wall takes no openings (normalizeSpec drops+reports)
  partitions?: PartitionSpec[];         // preset-driven straight non-bearing only
  entrySteps?: boolean;
}
export interface PartitionSpec { axis: 'X'|'Z'; stationFt: number; door?: { offsetFt: number; widthFt: number } }

export interface HutSpec extends SpecCommon {
  family: 'hut';
  variant: 'seaHut' | 'swaHut' | 'bHut' | 'squadHut' | 'guardShack' | 'latrine';
  wallHeightFt?: number;                // default per variant (doctrine.HUT)
  screenBand?: { sillFt: number; heightFt: number } | null;
  shutters?: 'none' | 'side' | 'propped';
  openings?: WallOpenings;
  roof?: RoofSpec; foundation?: FoundationSpec;
  latrine?: { seats: 2 | 4; depthFt: number };   // variant 'latrine' only (normalizeSpec enforces)
  partitions?: PartitionSpec[];                  // b-hut bays preset
}

export interface TowerSpec extends SpecCommon {
  family: 'tower';
  platformHeightFt: 10 | 16 | 24 | 32;           // discrete in core
  cabPlanFt: 6 | 8;
  access: 'ladder' | 'stair';                    // normalizeSpec FORCES 'stair' at 24|32 (EM 385-1-1, PH, LS) + issue
  cab: { walls: 'open-rail'|'half-wall'|'half-wall-screen'; roof: 'pyramid'|'shed'; roofing: 'corrugated'|'roll' };
  footing: 'timber-mudsill' | 'concrete-pad';    // §2.4; default concrete at 24|32
}

export interface BunkerSpec extends SpecCommon {
  family: 'bunker';
  interiorLengthFt: number; interiorWidthFt: number;   // 6x8..12x16
  clearHeightFt: number;                                // 4.5..7
  designCoverDepthFt: number;                           // USER-STATED (§2.7); clamped to the table's row domain
  wallType: 'post-plank' | 'crib';
  entrance: 'open' | 'baffle';
  showSoilCover?: boolean;                              // ghost massing (default true)
}

export interface TentFrameSpec extends SpecCommon {
  family: 'tentFrame';                                  // bent framing lives ONLY here (TD4)
  tent: 'gpSmall' | 'gpMedium' | 'temper';
  temperBays?: number;                                  // 2..8, TEMPER only
  endDoor?: boolean;
  foundation?: Extract<FoundationSpec, { kind: 'piers' | 'skids' }>;
  // footprint/kneewall/ridge/bent spacing ALL derive from doctrine.TENT[tent] (TM 10-8340, PH)
}

export interface PlatformSpec extends SpecCommon {
  family: 'platform';
  deckHeightFt: number;                                 // 0.5..5
  base: 'piers' | 'skids';
  deck: 'plank' | 'panel';
  ramp?: { widthFt: number; slope: 4 | 6 | 8 };         // 1:slope — EM 385-1-1 (PH, LS)
  steps?: boolean;
  railEdges: WallId[];                                  // auto-filled ≥ 2.5 ft; removable per edge w/ LS warning
}

export type StructureSpec = BuildingSpec | HutSpec | TowerSpec | BunkerSpec | TentFrameSpec | PlatformSpec;
export type StructureFamily = StructureSpec['family'];
```

**FamilyDef (catalog layer, `src/timber/catalog.ts` — data only):** as design-catalog
§2.2 with these amendments: `preset: StructureSpec` (complete, normalizes clean);
`rationale?: string` (thin-lineage honesty, §2.2); `deviationMarks?: string[]` (param
paths whose non-drawing values render the deviation affordance); `group` uses the §2.2
group ids. `CutawaySpec`/`CardViewSpec` as designed. `FAMILY_TABLE` (TD3) is the
generation source for locks/bounds/roof/covering matrices.

**Model & normalization** (design-engine §3.3/§3.5, amended):

```ts
export interface StructureModel {
  spec: StructureSpec; members: Member[]; levels: LevelInfo;
  stagePlan: StagePlanEntry[]; issues: SpecIssue[];
}
export function generateStructure(spec: StructureSpec): StructureModel;   // families/index.ts
export function specFromBuildingInput(i: BuildingInput): BuildingSpec;    // §2.4 migration table
export function normalizeSpec(spec: StructureSpec): { spec: StructureSpec; issues: SpecIssue[] };
export function canonicalizeSpec(spec: StructureSpec): StructureSpec;     // TD5 — see below
```

- **TD5 (blocker fix):** `normalizeSpec` does NOT sort same-wall openings by offset on
  the `generateFrame` path — legacy walls.ts emits in input-array order and per-role ID
  counters bake that order in. Canonical ordering (fixed record key order; total sort
  with tie-break offsetFt→widthFt→kind) lives in the separate `canonicalizeSpec`, used
  by catalog presets, goldens, serialization, and hashing only. Compat fixtures include
  same-wall openings out of offset order plus two at equal offset (§8.2).
- Clamps (visible `SpecIssue`s, never silent): dims 4–60×4–24; stories ≤ 2; pitch 0–12;
  `drainPer12` [1,2]; tower access forced per §2.4; `designCoverDepthFt` to the table's
  row domain; `clearHeightFt` and every other table-driven input clamped to its table
  domain (minor fix). **Completeness is asserted:** every numeric path in the spec union
  appears in one exported path registry that drives BOTH the clamp table and
  `configSchemaFor` (min/max equality AND coverage — §8.5).
- **2-story access (gap-11 fix):** `interiorStairs:false` at 2 stories is legal minute
  control — `normalizeSpec` emits an `ls-note` SpecIssue and the access subsystem emits
  an exterior-wall ladder instead (test: 2-story + no-stairs generates the ladder;
  a stranded second floor is impossible by construction).
- `severity:'error'` reserved for impossible topology (opening wider than wall) — the
  generator drops the opening and says so; never NaN.

### 3.2 Subsystems & composition contracts

Module set = design-engine §4.1 tree, plus `families/platform.ts`. Contracts C-1..C-8
carry over verbatim with these amendments (each fixes a named critique). The three
contracts this plan leans on but previously never restated (gap-3 fix):

- **C-1 Purity/determinism (restated):** every subsystem and family generator is plain
  inputs + `doctrine.ts` constants in, `Member[]` (plus typed context) out — no Date,
  no random, no module state, iteration only over insertion-ordered content.
- **C-3 Stage-agnostic subsystems (restated):** subsystems never hardcode stage
  numbers; the FAMILY generator passes the ordinals to stamp from its computed stage
  plan; legacy wrappers pass the legacy numbers.
- **C-8 Doctrine metadata (restated):** every emit carries `nailing` + `doctrineRef`
  (or the module default) under the (PH) discipline; life-safety-derived members carry
  the LS register suffix (§6.2). Full subsystem signatures:
  `docs/timber2-design/design-engine.md` §4.3 (committed at T0).

- **C-2 IDs:** emitter/prefix scheme unchanged (`FL/S/N/E/W/RF` reserved for building
  story-0; `L2-*`, `TW`, `PL`, `RL`, `AC`, `CV`, `CB`, `BK`, `TF`, `BO` for new scopes).
  **Huts REUSE the building prefix set** (gap-14 fix): they are rectangular
  single-story shells generated through the same subsystems, so `FL/S/N/E/W/RF` apply;
  the T5 unique-id sweep covers every hut card explicitly (I-5).
- **C-4 widened (major fix):** `WallsResult = { members, plateTopY, bearings:
  BearingLine[], surfaces: WallSurface[] }` — the wall system OWNS its placement
  convention and exports it; family and coverings only consume. A test asserts
  `surfaces[].cutouts` equal the wall's OpeningSpec rects. No third hand-copy of the
  inset/run convention ever exists.
- **C-5 conservation tightened (major fix):** covered + cutout = surface area to
  **1e-6 sf wherever cutout rects derive from the same coordinates as the panels**
  (wall sheathing, siding, decks); a looser per-case tolerance is allowed only where
  arithmetic is genuinely independent (roofing course laps), with the justification
  written in the test.
- **C-6 emission order:** unchanged (legacy order reproduced for the 1-story gable).
- **C-7 made testable (minor fix):** the sweep asserts every member AABB fits the plan
  footprint inflated by SPEC-DERIVED allowances (overhang, cap-plate lap, embed depth,
  crib depth), failures naming member ids.
- **C-9 coverings legacy path (major fix):** `coverings.ts` exposes a legacy-exact roof
  deck entry point — the extracted stage-9 course loop verbatim, called by
  `families/building.ts` with prefix `RF` — so P-phase compat deep-equals hold
  (IDs `RF-roofPanel-NN`, identical FP). The generalized plane/UV sweep (panels split
  ≤ 4 sub-panels around cutouts) serves only NEW roof kinds and surfaces with cutouts;
  a test pins the legacy path's IDs.
- **C-10 floorSystem split (major fix):** the legacy layout (rims at building edge, one
  girder at W/2) is FROZEN as its own branch, byte-pinned by compat goldens; the
  bearing-driven layout (capBeams, cap plates, skids, arbitrary BearingLine[]) is a
  SIBLING branch selected only when bearings differ from the legacy pattern. Editing
  the frozen branch is a stop-the-line event.

**3.2.2 Small-plan rule (major fix — closes the 4-ft envelope contradiction):**
`widthFt < 8` ⇒ NO girder line: joists clear-span sill to sill (2x6 per span table
(PH)); on skids, the skids act as bearers. Defined in `floorSystem.ts` as spec, cited;
the true envelope minimum (4 ft) is restated so custom, guard-shack, and latrine agree.
AC: the 4×4 guard-shack skid preset generates green (§8.5).

**3.2.3 Subsystem signatures:** as design-engine §4.3 (foundation, floorSystem,
wallSystem, roofFamilies dispatch + RoofPlane, coverings, stairsLadders, railings,
towerFrame, cribwork, builtOpenings) with the C-4/C-9/C-10 amendments above. The
`generateBuilding` sketch is amended (minor fix): **story-0 basement branch added** —
`foundation 'basement' → stairPlan → RectCut into floorSystem cuts →
generateStraightStair prefix 'FL' at the deck stage`; helper signatures specified:

```ts
function stairwellCutFor(spec: BuildingSpec, story: number, deckTopY: number): RectCut;
function floorDepthFt(spec: BuildingSpec): number;        // joist depth + deck thickness from doctrine
function plateBearings(walls: WallsResult): BearingLine[]; // re-exports walls.bearings (C-4)
```

`bomSummary` **throws** when `max(member.stage) > plan.length` instead of silently
filtering (major fix; it is pure — tests see it instantly). The defaulted legacy-plan
path is compat-tested unchanged for legacy models; a test asserts
`bomSummary(towerMembers)` without a plan fails loudly.

### 3.3 Stage model

Design-engine §5 adopted whole (TD10 — supersedes catalog's STAGES_BY_CHASSIS and
scope's per-def StageDef lists): `Member.stage` stays a NUMBER = 1-based ordinal into
the model's `stagePlan`; `StageKey` closed vocabulary; `stagePlanForBuilding(oneStory
GableSpec)` deep-equals legacy `STAGES` (asserted); `STAGES` stays exported verbatim;
partition invariant per model. Canonical family plans as design-engine §5.3, plus:

| platform | layoutFoundation('Layout & footings/skids'), floorFrame, deck, access('Ramp / steps'), railings |
|---|---|

### 3.4 Directory tree & call graph

As design-engine §10 with additions: `families/platform.ts`; `src/timber/lsLedger`
generation script `scripts/gen-ls-ledger.ts`; `scripts/check-assets.ts`;
`.github/workflows/toolkit.yml` (T0). UI tree per §5.6. `cardart.ts`/`gen-cards.ts`
from design-catalog are DELETED from the plan — thumbnails are runtime SVG (TD11, §4.4).

### 3.5 Ports untouched & the compat lock

Dispositions as design-engine §2.1/§2.2 (types.ts additive; frame.ts API frozen then
delegating; floor/walls/roof wrappered; bom/elevation additive; three-viewer props and
vite/build scripts untouched; legacy tests never edited), with the compat mechanism
REPLACED by the blocker fix:

- **TD12 — committed goldens, not self-referential comparison:** BEFORE any extraction
  (T0), a script serializes `generateFrame` output (members + levels) at the pre-refactor
  commit for the golden input PLUS the full timber-features option matrix PLUS the TD5
  unsorted-openings fixtures into `test/goldens/frame/*.json` (hashed, committed).
  `test/timber2-compat.test.ts` diffs `generateStructure(specFromBuildingInput(i))`
  against those snapshots FOREVER — never against live `generateFrame`.
- **TD13 — comparator:** exact deep-equal including array order first; on failure, a
  1e-12 epsilon pass with a printed per-field diff. The kill criterion applies only past
  epsilon. Extraction rule: verbatim-expression extraction on the legacy path (adding
  `baseY = 0` is IEEE-exact; keep legacy arithmetic order); no "improvements" ride along.

### 3.6 DRESSED / BF_PER_LF additions (binding — kills the silent-fallback class)

`types.ts DRESSED` += `1x2 {0.75,1.5}`, `1x6 {0.75,5.5}`, `1x8 {0.75,7.25}`,
`1x10 {0.75,9.25}`, `2x2 {1.5,1.5}`, `4x6 {3.5,5.5}`, `6x6 {5.5,5.5}`,
`6x8 {5.5,7.25}`, `8x8 {7.25,7.25}` — FM 5-426 Table 2-1 (PH). `bom.ts BF_PER_LF` +=
matching nominal-section values (`1x2`:0.167, `1x6`:0.5, `1x8`:0.667, `1x10`:0.833,
`2x2`:0.333, `4x6`:2, `6x6`:3, `6x8`:4, `8x8`:5.333); `BF_PER_LF` is EXPORTED (T1) so
the sync test can see it. Non-lumber nominals (`conc *`, `earth fill`, `screen`,
`roofing *`, hardware) intentionally miss the map → 0 BF. **AC: every nominal any
generator emits resolves in DRESSED — the `{1.5,3.5}` fallback is unreachable in
generated output** (§8.5).

**MemberRole additions** (additive; per design-engine §4.5's 24 roles) with the
disposition fix (TD8): the existing dead `siding` role is REUSED as the plywood-siding
role (zero emitters today, verified by grep — no near-synonym `sidingPanel` is minted);
`sidingBoard`/`batten` added for board-and-batten. Every new role gets PLAIN + WHAT
lines in `src/ui/woodframe/labels.ts` (sync-tested).

---

### 3.7 Appendix — shapes every test suite depends on (binding; gap-4 fix)

```ts
// src/timber/stagePlan.ts — the CLOSED stage vocabulary; families compose ordered
// subsets of these keys; the scrubber and cut lists key off StagePlanEntry.
export type StageKey =
  | 'layout' | 'foundation' | 'floor' | 'walls' | 'walls-l2' | 'plates'
  | 'roof-frame' | 'roof-deck' | 'roofing' | 'sheathing' | 'siding'
  | 'openings-built' | 'stairs-access' | 'railings' | 'platform'
  | 'tent-frame' | 'cribwork' | 'soil-ghost' | 'finish';
export interface StagePlanEntry { ordinal: number; key: StageKey; label: string; detail: string }

// src/timber/normalize.ts
export interface SpecIssue {
  path: string;                                   // dotted spec path
  kind: 'clamped' | 'dropped' | 'forced' | 'ls-note';
  message: string;                                // plain-language, shown in the workbench
}

// src/timber/spec.ts — the ONE path registry (drives clamp table, configSchemaFor,
// and the sweep; generators never Object.keys a spec).
export const SPEC_PATHS: readonly string[];       // e.g. 'stories.0.openings.S.0.widthFt'

// src/ui/config.ts
export interface PanelSchema {
  groups: { title: string; rows: {
    path: string;
    control: 'number' | 'select' | 'toggle' | 'openings-editor';
    min?: number; max?: number; step?: number; options?: readonly string[];
    lockedBy?: string;                            // FamilyDef lock id when standard-design-pinned
  }[] }[];
}
export function configSchemaFor(family: FamilyId): PanelSchema;

// src/timber/bom.ts
export function classifyNominal(nominal: string): 'lumber' | 'sheet' | 'hardware' | 'other';
// 'NxM' patterns -> lumber; panel/roll goods -> sheet; nails/bolts/hinges -> hardware;
// concrete + anything else -> other. Pure lookup + pattern, table-tested.
```

---

## 4. Viewer, cutaway & thumbnails

### 4.1 Scene layer

`woodframe-scene.ts` becomes the boot file wiring `src/ui/woodframe/{picker,config,
studio,camera,cutaway,labels,store,router,print,controls,copy}.ts` (merged engine §6.1
+ UX §8 file sets; single tree, names above are binding). Studio behavior for the
legacy building is pixel-equivalent (member card, PLAIN/WHAT, strips, stage panel
ported verbatim then extended additively).

**Perf budgets (major fix — previously absent):**
- Materials are SHARED per role-color class (also makes clip-plane assignment cheap);
  outline shells merged/instanced; repeated members instanced where count ≥ 20.
- Stage scrub toggles VISIBILITY — never a full dispose/rebuild. Budget: stage change
  ≤ 16 ms after initial build.
- Draw-call budget asserted in the happy-dom smoke suite where countable (mesh count ≤
  2500 for the largest catalog preset); full-rebuild budget ≤ 300 ms on the reference
  low-end Android (manual device pass recorded in DECISIONS.md at T3).

### 4.2 Cutaway (mandate #5)

Renderer clip-plane cutaway (SAP-1 pattern at `three-viewer.ts` ~1060–1260) — not
member filtering (long members need true sections). The three ported gotchas: material
clipping planes reassigned per rebuild; DoubleSide under cut; outline back-shells hidden
+ warm section fill light. Per-family default `CutawaySpec` (plane, station, ghost) as
design-catalog §7.5 (buildings: through the door bay; sea-hut: band section; tower: X
mid; strongback: canvas ghost only; bunker: through entrance + soil ghost; latrine:
through riser box), completed for the remaining families (gap-8 fix): gp-frame and
storage-shed take the building rule (through the door bay); swa-hut/b-hut/squad-hut
take the hut band section; guard-shack cuts through the window wall; platform
cross-cuts at the ramp; tent-floor takes a long-axis section. **AC (restates
D-CAT-19): `timber2-catalog` asserts EVERY FamilyDef carries a `CutawaySpec` — a
family without one fails the build.**

**Single plane equation (major fix):** one pure `cutPlaneEq(spec, dims) → { normal,
constant }` consumed by BOTH `applyCutaway` (THREE.Plane) and `passesCut` (raycast
side-filter) — the equation exists once. `test/timber2-cutaway.test.ts` covers boundary
points, keep +/−, frac 0/1, the y-axis tower cut, and null-spec pass-through. Raycast
picking filters hits with `passesCut` so clicking through a cut selects what you SEE.

### 4.3 Camera rigs

`cameraRigFor(model)` — pure, node-tested. **Fit is computed against the TRUE member
AABB including minY below grade, against the ACTUAL shipping camera (fov 40, live
aspect), with the 5% margin inside the formula** (major fix — the H/P heuristics remain
only as style bias for center height). Views: the current seven + `Elev` when
H > 1.5·P. Test (§8.7): all-member-AABB-in-frustum over every catalog preset AND the
fuzz corpus AND pinned extremes (60×4 two-story 12/12; 4×4 minimum; tower on 4-ft plan;
specs straddling both piecewise switches).

### 4.4 Thumbnails (TD11 — the picker "images")

**Decision: runtime deterministic inline SVG line-art from the engine's own members**
(design-engine D3), REJECTING design-catalog's build-time `gen-cards.ts` files and
design-ux's build-time `gen-thumbs.ts` + publicDir pipeline. Why: no build step in the
deploy sandbox (the regime the OOM class lives in), nothing enters the bundler asset
path, cannot drift from the engine, and the UX critiques about `publicDir: false`
shipping zero thumbnails and thumb-drift gates become moot by construction.

Spec = design-engine §7.2 with the critique fixes applied:
- `thumbLod` (skip covering/deck roles) is the **DEFAULT for every card**, not an
  escape hatch; thumb strings are memoized per catalog id; a budget test caps polygon
  count per thumb, not just KB (< 140 KB, < 25 ms in node).
- The default yaw/pitch projection basis (cos/sin of 34°/24°) is precomputed as numeric
  literals in `thumbnails.ts` — no runtime trig reaches golden-compared output.
- **Goldens are committed FULL SVG FILES under `test/goldens/thumbs/` and
  string-compared** (major fix — reviewable visual diffs); hashes at most an index.
  Structural asserts (polygon count, no external refs, no `<script`/`http`) are
  independent of the golden compare so a rubber-stamped golden update still fails them.
  `npm run update:thumb-goldens` rewrites files in the same PR as the visual change.
- Escape hatch REWRITTEN (minor fix): if raster/file art is ever needed, generate at
  DEV time with artifacts committed to `public/` and a staleness test
  (regenerate-and-compare in CI) — NEVER a step in `build-suite.mjs`.
- **Legibility is owner-judged** (minor fix): T3 acceptance includes the owner reading
  the card grid; pre-agreed fallback = filled translucent roof/wall quads + heavier
  silhouette strokes. Every thumb stamps a fixed 6-ft human silhouette and renders at
  true relative scale so size differences read at a glance (UX minor adopted).
- The Custom card's art is a static hand-authored SVG in the same style, checked into
  `src/ui/assets/` (inline string module, tiny).

---

## 5. Picker & workbench UX

Design-ux is adopted as the UX spine (regions, card anatomy, config-panel levels,
openings editor, lock system, language system, validation states) with every blocker
and major fix below applied. Route names: `#/` picker, `#/build/<id>` workbench,
`#/build/<id>?c=` share (TD14 — supersedes engine's `#/s/<id>`).

### 5.1 Navigation & routing

- Hash router (~60 lines, no deps); unknown id → picker + inline notice.
- Back chain per design-ux §1.2 (hub ⇄ picker ⇄ workbench; `◀ Structures` button;
  browser Back always works; no confirm-on-back).
- **Jump chips are BUTTONS calling `scrollIntoView`** — never `location.hash` anchors
  (major fix: `#family-*` would trip the unknown-route handler and pollute history).
  The "works with no JS" claim is dropped — the picker is JS-rendered.
- **History states for sheets/popovers** (major fix): opening any bottom sheet or
  popover pushes a history state; popstate closes it first — Android back-gesture
  dismisses the sheet, not the workbench.

### 5.2 Picker

Per design-ux §2 (grouped cards, filter, resume strip, import drop target, roving
focus) with:
- Groups from §2.2 of this plan (owner-mandate order: Towers first? No — TD15: group
  order is Buildings, Towers, Tents & Frames, Bunkers, Site, Custom — the catalog's
  stable taxonomy; the owner's named types are all above the fold via the jump chips).
- **(PH) dropped from card tag rows** (major fix): cites with (PH) render only in the
  workbench where the doctrine popover explains them; the picker carries one footnote
  line above the footer: "(PH) = manual page check still pending."
- Card meta gains a catalog-driven capacity/use chip where doctrine states it ("sleeps
  16", "2 sentries"); omitted when unknown (minor fix).
- Custom card borrows ONLY the dashed border from the hub ghost style; name/one-liner
  use standard ink tokens `#2b2419`/`#6b6250` (AA fix). Same for Your-Builds cards.
- Deviation affordance: standards whose stored config differs → `SAVED CHANGES` pill;
  params in `deviationMarks` at non-drawing values → "deviation from standard drawing"
  line in the workbench header tag (minor fix, §2.4).

### 5.3 Workbench

Config panel (4 disclosure levels) / viewport / inspect panel per design-ux §3, plus:

- **Openings lock semantics (blocker fix):** on standard designs the openings array is
  **`preset`** — editable, `STD` badge, per-wall `↺ std` reset — with per-opening
  `locked: true` allowed via catalog for signature bays (SEA-hut screen bays). Stated in
  the PanelSchema contract: `openings` fields carry
  `{ lock: 'preset', lockedOpenings?: openingId[] }`.
- **Locked-row escape (major fix):** every locked-row why-popover carries the action
  "Need it different? Unlock everything — copies to a custom build", invoking the
  unlock-to-custom hatch directly (not only the panel-bottom button).
  **Unlock semantics, all families (gap-6 fix):** unlocking NEVER changes family. It
  produces an unlocked SAME-FAMILY copy saved as `custom-n` — locks lifted, bounds
  widened to the engine envelope, the spec branch (tower/bunker/hut/…) kept. Only the
  picker's Custom CARD is building-scoped (TD22). `timber2-spec` gains one unlock test
  per family asserting branch preservation.
- Plain-first copy everywhere via `copy.ts`: accordion summaries in plain form ("studs
  every 24 in · roof rises 4 in per ft"); cut presets "Cut at middle (Section A–A)";
  cutaway axis chips **[Front–Rear] [Left–Right] [Flat (top-down)]** with compass in
  parens (major fix); axis→anchor table: Front–Rear = "from front", Left–Right = "from
  left end", Flat = "above sill" (wireframe contradiction resolved). Config sections
  are labeled "1 · SHAPE" etc. — the word "Level" is not used in visible copy (naming
  collision fix).
- **Cutaway defaults (major fix):** first activation per axis initializes depth = 50%
  (remembered per axis in viewState); acceptance-tested.
- Stage scrubber: **the active stage name renders as a persistent text line adjacent to
  the scrubber at EVERY width** ("Stage 8 — Rafters & ridge") — never tooltip-only
  (major fix). `All` is a DISTINCT state (every stage, stage-tint off) vs selecting the
  last numbered stage (tint on) (minor fix).
- Opening offset stepper: tap step 3 in with press-and-hold acceleration (1 ft/s after
  600 ms); ft-in parser accepts `13'6`, `13 6`, `13.5`, `162"` (space form + bare
  decimal added — mobile keyboard fix); inputmode keeps digits primary.
- Undo toast: 10 s, timer pauses on touch/hover/focus, docks ABOVE any open sheet,
  `role="status" aria-live="polite"`, reachable by keyboard (a11y fixes).
- Color-only signals paired with text: "Openings — 2 warnings" visually-hidden text +
  aria on disclosure buttons; warn count shown numerically ≥ 1280 px (a11y fix).
- **Keyboard guard (major fix):** all single-key accelerators (`1..9,0`, `C`) no-op when
  `event.target` is input/select/textarea/contenteditable or a popover is open; digits
  and `C` scoped to canvas/toolbar focus like `[`/`]`.

### 5.4 Mobile (< 700 px)

- **Cutaway depth slider gets its own full-width non-scrolling row** under the toolbar
  with `touch-action: none` when an axis is active; only axis + preset chips live in
  the scrollable row (BLOCKER fix — slider vs row-scroll gesture conflict).
- Toolbar progressive disclosure (major fix): STAGE collapses to `[Stage: All ▾]`
  opening a picker; CUTAWAY shows axis chips only until active.
- Configure sheet gets a **half-height detent (~45vh) that the openings editor defaults
  to**, keeping the model visible; full-height a drag away (major fix). Sheets dismiss
  only from the drag handle; the elevation strip sets `touch-action: none` and
  pointer-captures during opening drags (major fix).
- All chips/tabs/segments ≥ 44 px hit area below 700 px (min-height + padding, font
  unchanged) — stated in `timber.css` and in acceptance (major fix).
- Sticky `[Configure]/[Inspect]` launcher row is the guaranteed scroll grab zone; a
  "Cut lists & strips ↓" jump link beside it; two-finger scroll never intercepted by
  the canvas (minor fix).

### 5.5 State, persistence, sharing

- localStorage key **`timber2-session`** (named; never collides with `sap1-*`);
  versioned envelope per design-ux §5.1 plus **`customSeq: number`** (monotonic,
  never decreases — id non-reuse after delete, tested).
- **Boot revalidation (major fix):** every restored structure entry is validated
  (config via the schema/normalizeSpec, viewState ids against the catalog); invalid
  entries degrade to catalog defaults with the non-blocking notice — the
  `restoreSession` "never trust stored bytes" pattern.
- **Commit-on-valid (major fix):** blocking values stay in the control (red row) and
  NEVER enter config/store — storage always holds a generatable config. Belt: if a
  stored config still blocks at boot (schema drift), render the catalog default under
  the block banner. Tested.
- Debounced writes (300 ms) **flush synchronously on pagehide /
  visibilitychange:hidden and on every route change/hub link** (minor fix).
- Shared links: on first edit of a `?c=` view, `router.replace` to the new
  `#/build/custom-n` so the shared entry leaves history (minor fix). Codec:
  `CompressionStream('deflate-raw')` when available, uncompressed base64url fallback
  flagged by prefix (`c=` vs `cz=`); importer accepts both; both covered in tests
  (minor fix — no hand-rolled deflate, no Safari <16.4 throw). `designCoverDepthFt`
  stripped per §2.7.
- Build file `.timber.json` per design-ux §5.4 (deterministic serialization via
  `canonicalizeSpec`).

### 5.6 Offline/update posture & print

- **TD16 (major fix — posture stated):** the toolkit ships **no service worker**;
  `build-suite.mjs`'s cache-killer sw.js overwrite is the deliberate policy; the stale
  `public/sw.js` (whose CORE list references files that don't exist in suite builds) is
  DELETED at T0. Import-error copy says "made with a newer TIMBER — redeploy the
  toolkit" without promising an in-app update flow. Runtime thumbnails mean no
  lazy-loaded thumb files exist to precache (TD11 interlock).
- The standalone `vite.woodframe.config.ts` build remains valid with zero changes
  because thumbnails are runtime SVG (the publicDir critique is moot — recorded).
- **Print strips render unscrolled** (major fix): `print.ts` scales each strip SVG to
  page width (`width:100%; height:auto` with viewBox) or splits walls into stacked
  ≤ 16-ft segments with continuation labels; print assertion in the UX suite. Strip
  headings route through `copy.ts` and change to plain-first "Front (S)" in the same
  pass (deliberate, noted — resolves the wall-label order contradiction).
- Stage-sheet capture: fixed 960×640 at DPR 1 via offscreen render target,
  `canvas.toBlob` + object URLs (revoked after print), size budget asserted — never a
  DOM full of multi-MB data URLs (minor fix).

---

## 6. Safety & doctrine posture

### 6.1 The boundary (stated in-app)

TIMBER-2 **ships working doctrinal defaults with (PH) cites** — deliberately NOT
SAP-2's ship-empty regime. A TIMBER number says how to cut and nail wood; being wrong
is visible and makes no protection claim. Exceptions: (a) any number whose failure mode
is a fall/collapse/overload is LIFE-SAFETY and routes through LS-GATE (§6.2); (b) the
one protection-adjacent quantity (bunker cover depth) is an input, never an output
(§2.7). This paragraph's substance appears on the bunker card, the footer, and every
LS member card.

### 6.2 LS-GATE (the named review posture)

Tagged `lifeSafety: true` on doctrine constants: rail geometry; ladder construction +
the stair-forcing height threshold; stair limits; ALL span/size tables (joist, girder,
header, platform/deck, tower leg + bracing schedule, bunker stringer table); tower
height/batter/bracing as a set; wide-opening headers; ramp slopes. Mechanism:

- `doctrine.ts` `Doc<T> { value, unit?, cite, ph, lifeSafety?, note? }`;
  `lifeSafetyRegister()` enumerates the tagged set — the single source for UI + tests.
- `scripts/gen-ls-ledger.ts` → `docs/TIMBER2_LS_LEDGER.md`: one row per constant — id,
  value, doctrineRef **including the safety-pub cite class (EM 385-1-1 where
  applicable — blocker fix)**, (PH) status, last-change commit, ack line, reviewer,
  **reviewer-qualification field** (see §6.3).
- CI gate **G-LS**: fails when an LS constant's value changes without a matching ledger
  ack in the same change, or lacks a doctrineRef.
- Emit-time suffix `"(PH — LIFE-SAFETY, review required)"` while `ph:true`; member-card
  badge; standing studio banner on any model carrying the suffix; the printable
  register is a footer-linked print surface.
- Review roles: owner acks routine (PH)→verified flips; any VALUE change needs a named
  second reviewer line.

### 6.3 The crib-bunker SME bar (major fix)

Structural sizing vs soil depth is the class SAP-2 ruled SME-routed. Therefore: crib
LS constants (the stringer/post/cap/lagging table) carry a **stricter reviewer bar**
— the ledger's reviewer-qualification field must record a qualified engineer/SME (not
just a second reviewer) for any value change or (PH)→verified flip on `BUNKER.*`
entries. The table's source is named per §2.1 (dead-load rows of the survivability
canon admitted, or FM 5-34/5-35 if they carry the data). **Ship gate:** if no row is
page-verified at a release, `designCoverDepthFt` is capped at the smallest verified
row; if none, the bunker card holds one release.

### 6.4 Boundary enforcement gates (major fix — the wordlist made real)

Replaces the naive 4-substring scan (which would trip on `Math.round` and miss `blast`):

1. **Word-boundary lexicon gate** over STRING LITERALS, `doctrineRef` values, and UI
   copy (not identifiers) in `src/timber/**` + `src/ui/**` + the dist text scan:
   `/\b(frag(mentation)?|caliber|blast|artillery|mortar|shrapnel|threat|standoff|protection level|shielding|\d+\s*mm)\b/i`,
   extensible in the test file. **Explicit allowlist of the exact boundary sentences**
   (card blurb, ghost-massing label, BOM header line) so the gate can be strengthened
   without touching the boundary copy (minor fix).
2. **Pub-denylist test:** no magnitude-carrying `Doc` may cite ATP 3-37.34/FM 5-103
   EXCEPT entries under `doctrine.BUNKER.*` naming the admitted dead-load table
   (makes "configuration reference only" testable).
3. **Positive render AC:** the §2.7 boundary sentence renders on the bunker card note,
   the ghost label, and the bunker BOM header (asserted in the happy-dom suite + print
   test).
4. Scoped protection-quantity scan on bunker OUTPUT (from design-scope, regex narrowed
   to protection semantics with units so "2-in. thick decking" passes — minor fix), with
   a positive test that plain lumber-thickness phrasing passes.

### 6.5 Doc reciprocity (blocker fix)

`docs/SAP2_BLUEPRINT.md` currently binds TIMBER to a "rebuilt inside the regime
(timber.* leaves)" re-entry bar and logs TIMBER as an escaped failure class. **TD1:**
this plan's §6.1 boundary supersedes that row. At T0, `SAP2_BLUEPRINT.md` is edited
(owner-acked, cross-referenced in BOTH docs): (a) the §5 TIMBER row points here and
states which SAP-2 gate classes apply to `src/timber` (offline gate, determinism,
doc-integrity: YES; ship-empty/watermark/commissioning: NO — replaced by LS-GATE);
(b) R5b gains the entry condition "reconcile bunker_op_cp with TIMBER-2 crib-bunker"
(§2.7). Without both edits T1 does not start.

### 6.6 Doctrine data module

`src/timber/doctrine.ts` per design-engine §8.1 with: `RAIL/LADDER/STAIR/RAMP` citing
EM 385-1-1 (PH); `TOWER` citing TM 5-302 + EM 385-1-1 (PH); `BUNKER.stringerBySoilFt`
citing the §2.1-named table (PH, LS, SME); `HUT` per-variant dims; `TENT` keyed per
tent from TM 10-8340 (PH); `LABOR` values equal to the legacy bom constants until
verified against P-405/TM 5-303. ALL inline magic numbers migrate here with values
unchanged (compat-locked). **The no-inline-doctrine-numbers gate is AUTOMATED** (major
fix — the repo already proves it in `test/number-free.test.ts`):
`timber2-number-free.test.ts` scans `families/*` and subsystem modules for decimal
literals outside an allowlist (0.5, unit conversions behind named consts) and asserts
every generator file imports `./doctrine`. Exceptions live in the test file, not a
checklist.

---

## 7. Phase plan T0–T8

Effort: S ≤ half session · M ≈ 1 session · L = 2–3 sessions · XL avoided by design
(the two former XLs are split with named checkpoints). A "session" = one focused
implementation session holding this document.

**Branch discipline (major fix):** one branch per phase; merge to main only at phase
DoD. Main is ALWAYS `npm run verify` + `npm run build:suite` green — red-first tests
live only on the phase branch. A fresh session finding main red stops and reports.

**Descope ladder (major fix):** within any overrunning phase, cut in this order —
un-named breadth first (presets, site variants), owner-named asks LAST and only with
an explicit owner sign-off recorded in DECISIONS.md (named asks: tower, custom,
strongback, bunker, stories=2, hip-in-some-form). Each phase lists its ladder.

**Progress table** (implementing sessions update the repo copy):

| Phase | Status | Shipped | Cards live after |
|---|---|---|---|
| T0 | DONE | CI toolkit.yml · frame goldens (12 full + 72 hashed) · check-assets · SAP2 reciprocity · sw.js deleted | 1 (TIMBER-1 as-is) |
| T1 | DONE | spec.ts/normalize/stagePlan/doctrine · families/ + subsystems/wallSystem (C-4) · frame.ts delegates · BOM throw+classify+BF export | 1 |
| T2 | DONE | shed+flat roofs (TD6 pony wall) · coverings (C-5 conserved) · skids/slab · small-plan rule · catalog · runtime SVG thumbs | 1 |
| T3 | DONE | picker + workbench + cutaway + custom-lite · router/store/config/camera/labels · runtime thumbs | 3 |
| T4 | not started | — | 4 |
| T5 | not started | — | 10 |
| T6 | not started | — | 13 |
| T7 | not started | — | 14 |
| T8 | not started | — | 14 |

### T0 — Guardrails & reciprocity (S)

**Contents:** (1) `.github/workflows/toolkit.yml`: `npm ci`, `npm run verify`,
`npm run build:suite` on push/PR touching `src/**`, `test/**`, `scripts/**` (major fix
— the 219-stay-green claim gets a machine). (2) Golden snapshot script + committed
`test/goldens/frame/*.json` per TD12 (blocker fix) including the TD5 unsorted-openings
fixtures. (3) `scripts/check-assets.ts` with an explicit allowlist of today's dist
asset basenames, wired into verify (minor fix — "no new images" becomes verifiable).
(4) `docs/SAP2_BLUEPRINT.md` reciprocal edits per §6.5, owner ack recorded. (5) Delete
stale `public/sw.js` (§5.6). (6) Copy this plan to `docs/TIMBER2_PLAN.md` (the living
copy; progress table lives there). (7) Copy the four source designs to
`docs/timber2-design/` so every "design-X §N" citation resolves in-repo (gap-1 fix).
**Acceptance:** CI runs and is green on a no-op PR; goldens committed and hashed;
check-assets green; both doc edits merged with the owner's ack line; the four design
docs committed beside the plan; deployed toolkit byte-identical except sw.js removal.
**Demo:** none (infrastructure).
**Descope ladder:** nothing cuttable — T0 is the floor.

### T1 — Extraction & compat lock (L)

**Contents:** engine P0 as design-engine §11 with this plan's amendments: `emit.ts`,
`openings.ts`, `doctrine.ts` (values unchanged), `spec.ts` (+`specFromBuildingInput`
per the §2.4 migration table, `normalizeSpec` building-only, `canonicalizeSpec`),
`stagePlan.ts`, subsystem extraction (foundation/floorSystem-frozen-branch/wallSystem
with C-4 bearings+surfaces/roofFamilies gable+ceiling/stairsLadders/coverings
legacy-exact roof-deck path), `families/building.ts` (1-story), `families/index.ts`,
legacy wrappers, `frame.ts` delegation. Export `BF_PER_LF`; add `classifyNominal`;
DRESSED/BF additions (§3.6). `bomSummary` throw-on-overflow + optional plan param.
**Tests:** `timber2-compat` (vs T0 goldens, TD13 comparator), `timber2-spec`
(round-trip, idempotence, clamp coverage via the path registry, permutation
invariance I-15), `timber2-stages` (building rows), `timber2-doctrine`,
`timber2-number-free`, DRESSED↔BF sync.
**Acceptance:** git diff empty on `test/timber-*.test.ts`; the 33 legacy tests green;
compat green across the full matrix incl. unsorted-openings fixtures; the TIMBER-1 demo
BuildingInput maps to identical Member[]; no UI change shipped; deploy green.
**Kill:** if compat cannot be reached even at 1e-12 epsilon, STOP — re-plan seams; a
forked engine is forbidden.
**Descope ladder:** none — T1 is atomic.

### T2 — Building breadth (engine-only) (L)

**Contents:** roofFamilies `shed` (+pony wall/rake infill per TD6) + `flat` (1:12
floor, double-coverage roll lock); `coverings.ts` full (wall sheathing, siding incl.
board-and-batten, roofing roll/double/corrugated, purlins, felt, cutout conservation
per C-5); foundations `slab`/`skids`; **small-plan rule** (§3.2.2); `openFront`;
partitions (preset); auto-placement of openings (pure fn); normalizeSpec full;
`catalog.ts` FAMILY_TABLE + FamilyDef model + gp-frame/storage-shed/custom defs;
`thumbnails.ts` (§4.4) + goldens **and the `update:thumb-goldens` npm script
(writes `test/goldens/thumbs/`, same-PR rule) — §10.1's command is CREATED here
(gap-17 fix)**.
**Tests:** `timber2-roofs` (shed/flat invariants × pitches incl. 0/12, course tiling),
`timber2-coverings` (1e-6 conservation, no-overlap helper, legacy RF id pin),
`timber2-building` (slab/skids/openFront/small-plan: the 4-ft-wide fixture generates
girderless), `timber2-sweep` building slice (mulberry32 seed, §8.4 boundary corpus),
`timber2-thumbs`, `timber2-catalog` (FAMILY_TABLE↔doc tables, family-identity AC).
**Acceptance:** sweep green; perf fixture named exactly (gap-12 fix): 40×24 1-story
gable, full coverings — regen < 50 ms warmed mean per §8.8; legacy +
T1 suites untouched-green; deploy green (still no UI change).
**Descope ladder:** flat roof → next phase; board-and-batten → next phase; small-plan
rule and shed are NOT cuttable (guard-shack/latrine depend on them).

### T3 — Picker, workbench, cutaway, custom-lite (L)

**Contents:** the UI package (§4.1/§5 file set); router/store (`timber2-session`,
customSeq, flush, revalidation, commit-on-valid); picker (3 cards: gp-frame,
storage-shed, custom) with runtime thumbs; config panel + openings editor (full:
add/remove, wall, kind, size, offset, sill, fill column); lock system + unlock-to-
custom; cutaway (clip plane + `cutPlaneEq` + raycast filter + mobile slider row +
50% default); camera rigs; stage scrubber over stagePlan + persistent stage-name line;
print surfaces (cut list, BOM, strips-scaled, stage sheets); export/import + share
links; a11y + keyboard guard; hub card copy update. **Custom-lite ships here**
(TD22, blocker fix): the full BuildingSpec surface as built so far (dims, stories 1,
gable/shed/flat, coverings, openings, foundations) — it grows automatically as the
engine grows because the config schema is generated from the path registry.
**Tests:** `timber2-camera` (fuzz corpus + extremes), `timber2-cutaway`, UX suites
T-UX-1/2/5/6/7/9/10/11 as specced in `docs/timber2-design/design-ux.md` §9 (committed
at T0; this plan's amendments govern). Dispositions so no suite id dangles (gap-5
fix): T-UX-3 and T-UX-4 are moot under TD11's runtime thumbnails; T-UX-8 defers to
T6's two-story work. Plus
a **happy-dom smoke suite** (minor fix): picker renders N cards, route swap,
configurator emits clamped params, block-gating, boundary-sentence render (§6.4.3),
mesh-count budget.
**Acceptance:** deploy green with offline scan (zero new asset files, zero requests);
legacy demo reachable via gp-frame? No — via a "TIMBER-1 demo" preset row on custom
(the demo building IS custom's default); pixel-equivalent studio behavior on it;
cutaway works on all 3 cards; **owner judges thumbnail legibility** (named acceptance);
manual low-end-Android pass recorded.
**Kill:** clip-plane misbehaving on the reference device → fall back to the proven
three-viewer.ts pattern EXACTLY; member filtering is NOT the fallback.
**Descope ladder:** share links → T8; print stage sheets → T8; picker filter → T8.
Custom-lite and cutaway are NOT cuttable (owner-named).

### T4 — LS-GATE + guard tower (L; checkpoint T4a)

**Contents (T4a — a legal phase end):** `doctrine` LS tagging + EM 385-1-1 cites;
`gen-ls-ledger.ts` + `docs/TIMBER2_LS_LEDGER.md` + G-LS CI gate; review surfaces
(badge, banner, printable register); `railings.ts`; `stairsLadders.ts` ladder/stair/
shipLadder (+ basement-stair extraction already done in T1); `towerFrame.ts`; pyramid
cab; `families/tower.ts`; tower card; Elev camera view; footing choice.
**Contents (T4b):** tower polish — cab wall modes, cab roofing options, girt/brace
schedule table verification pass.
**Tests:** `timber2-tower` (per design-engine §9.3 + AC-CAT-8 incl. **the
ladder-height constraint: access='ladder' rejected/forced-stair at 24/32**),
`timber2-access`, `timber2-doctrine` grows register rows; G-LS fixture test (value
change without ack fails).
**Acceptance:** every LS member carries the suffix; banner + register render; ledger
covers 100% of tagged constants; rig test green for all four heights; deploy green.
**Kill:** pyramid cab not closing → tower ships with shed cab, pyramid slips one
phase; the TOWER does not slip (owner's first-named type).
**Descope ladder:** T4b polish first; tower itself last-and-owner-signed only.

### T5 — Huts, built items, latrine (L)

**Contents:** `builtOpenings.ts` (ledged door w/ brace-direction test, screen door,
shutters, screen inserts, riser box); wallSystem girts + screen bands; hut variants
sea/swa/b/squad/guard-shack + latrine (depth 4–8, geometry-closure AC); partitions
preset (b-hut bays); deviation affordance; 6 new cards (→ 10).
**Tests:** `timber2-hut` (variant presets ≡ doctrine.HUT; screen panels only in band;
shutter/door assemblies fit ROs; guard-shack 4×4 skid preset generates — small-plan
AC), `timber2-latrine` (riser box + aisle + door swing closes at 2 and 4 seats),
built-assembly BOM grouping AC.
**Acceptance:** all six generate + thumbs stable; hut stage plan per §3.3; deploy
green.
**Descope ladder:** squad-hut, swa-hut (thin variants) first; sea-hut/b-hut/latrine
(owner-named) last.

### T6 — Platform, tents, two-story (L; checkpoints T6a/T6b)

**Contents (T6a):** `families/platform.ts` (floorSystem bearing branch + railings +
ramp + steps); platform + tent-floor cards (tent-floor = pure preset, identity AC);
`families/tentFrame.ts` (bent frames from `doctrine.TENT` per TM 10-8340 (PH), GP-Small
17'6" sq); strongback card; canvas ghost cutaway. (→ 13 cards)
**Contents (T6b, parkable with a logged row):** `stories: 2` for gp-frame/custom —
story loop, story-2 floor bearing on cap plates via C-4 bearings, interior stair +
stairwell cut, `OpeningSpec.story`, per-story strips; instancing/visibility perf work
if budgets require.
**Tests:** `timber2-platform` (rails cover open edges minus gaps; ramp run =
slope×height; tent presets match doctrine.TENT), `timber2-tent`, `timber2-stories`
(AC-CAT-13: bearing math, framed stairwell, riser/tread limits).
**Acceptance:** T6a and T6b each independently deploy-green; parking after T6a is a
legal phase end recorded in the progress table.
**Descope ladder:** T6b (stories) parks first with owner notice; strongback
(owner-named) last.

### T7 — Crib bunker (M)

**Contents:** `cribwork.ts`, `families/bunker.ts` (posts/caps/wall systems/ohc
stringers per the §2.1-named table/lagging/baffle/soil ghost); §6.3 SME bar wired into
the ledger; §6.4 gates 1–4 live over the full surface; deep-link stripping; crib card
(→ 14 — catalog complete).
**Tests:** `timber2-bunker` (stringer table row boundaries ± eps and past-last-row
clamp; crib course alternation/interlock; 0-BF ghost; serialized spec contains no
cover depth), wordlist/pub-denylist/positive-render gates.
**Acceptance:** boundary sentence renders on all three surfaces; ship gate honored
(cap-at-verified-row or card held); deploy green.
**Descope ladder:** crib wallType (post-plank ships first) → the bunker itself only
with owner sign-off.

### T8 — Hardware, span checks, hip-in-some-form, polish (M)

**Contents:** `Member.nails` structured field + BOM nail-poundage + hardware counts;
span WARNINGS from doctrine.SPAN on member cards (never silent resize); **TM 5-303 BOM
reconciliation** for one family (b-hut or sea-hut) within a stated tolerance once
sheets verify (else the AC records the pending state); hip: equal-pitch pyramid/square
hip FIRST, full hip timeboxed — **if parked, append a T9 row to the progress table
carrying the standard DoD** (minor fix); deferred T3 items (share links, stage sheets,
filter) if any; `docs/TIMBER2_ENGINE.md` as-built update; (PH) census in the ledger.
**Tests:** nail roll-up sums per stage; span warning fires on rigged fixture; hip jack
arithmetic sequence + coplanarity ≤ 1/8 in (if shipped).
**Acceptance:** full suite green; every roster card live; deploy green; hub copy final.
**Descope ladder:** full hip → auto-T9; TM 5-303 reconciliation → recorded-pending;
nails/span (mandate #2) last.

---

## 8. Test strategy & invariants that never break

Runner: `node --test` + tsx, pure-node for everything that can be pure (all generators,
camera math, `passesCut`/`cutPlaneEq`, thumbnails, store logic via injected storage);
happy-dom for the UI smoke suite (repo precedent: sap2 CI). Legacy suites immutable.

### 8.1 Invariants (gates, all phases)

- **I-1** Engine purity: `src/timber/**` imports no DOM/three.js/Date/random.
- **I-2** Determinism: every generator deep-equals itself across calls.
- **I-3** Single source of truth: scene/BOM/2D/thumbs only PROJECT `Member[]`.
- **I-4** Exact BOM partition per model; `bomSummary` THROWS past the plan length.
- **I-5** Unique stable ids (prefix scheme, C-2).
- **I-6** Member completeness: finite; `cutLength > 0`; stage ∈ plan; doctrineRef +
  nailing non-empty.
- **I-7** Compat: `generateStructure(specFromBuildingInput(i))` ≡ committed T0 goldens
  (TD12/TD13) forever.
- **I-8** Legacy tests immutable; acceptance phrased per TD31.
- **I-9** Offline: zero external URLs (check-offline); zero new runtime deps.
- **I-10** Deploy: build:suite green at every merge to main; check-assets allowlist
  green; assetsInlineLimit never raised.
- **I-11** LS numbers only in `doctrine.ts`, tagged, ledgered, G-LS gated; crib
  entries carry the SME bar (§6.3).
- **I-12** Bunker boundary gates (§6.4) green; cover depth never an output; deep links
  never carry it.
- **I-13** Placement honesty: approximations documented per generator header; no fake
  joinery.
- **I-14** Dictionaries in lockstep: every emitted role has PLAIN/WHAT; every emitted
  nominal resolves in DRESSED + BF_PER_LF (no fallback).
- **I-15** Iteration order: subsystems iterate the const wall array, never
  Object.keys on spec records; permuted-input test asserts identical models.
- **I-16** No inline doctrine numbers in generators (`timber2-number-free`).

### 8.2 Compat suite (`timber2-compat`)

Golden inputs: the demo building + full timber-features matrix (foundations × bridging
× bracing × attic × sizes) + unsorted/equal-offset opening fixtures. Assert vs T0
goldens: members deep-equal (order included; 1e-12 epsilon fallback with printed
diff); levels agree; `stagePlanForBuilding` ≡ legacy STAGES; defaulted `bomSummary`
≡ plan-passed for legacy models; migration-table round trip.

### 8.3 Per-family suites

`timber2-building` (multi-story bearings, slab/skids, small-plan girderless, openFront,
stairwell framing), `timber2-roofs` (course tiling × pitches {0,2,4,6,9,12}, shed pony
wall closure, flat clamp, pyramid apex ≤ 1e-9, hip when shipped), `timber2-coverings`
(1e-6 conservation on shared-coordinate surfaces; documented looser tolerance only
where independent arithmetic; overlap helper < 1e-3 sf; legacy RF id pin),
`timber2-hut`, `timber2-latrine`, `timber2-tower` (incl. ladder-height forcing, brace
endpoints on post centerlines ≤ 1e-6, rail continuity, footing variants),
`timber2-platform`, `timber2-tent` (presets ≡ doctrine.TENT), `timber2-bunker`
(table-row boundaries ± eps, past-last-row clamp, crib interlock, 0-BF ghost, no
cover-depth in serialized spec).

### 8.4 Sweep (`timber2-sweep`) — seeded, with the killer corpus

**mulberry32(fixed seed)** printing the failing spec (repo precedent `test/fuzz.
test.ts`), ≥ 200 specs across families, PLUS the required boundary corpus (major fix):
fractional dims (13.7, 10.33), clamp edges 4/60 ft, pitch 0 and 12, overhang 0,
sillHeightFt {0, 0.01}, openings at offset 0 / flush-right / adjacent, near-zero
widths, platform heights at min/max, designCoverDepthFt at each stringer row edge ± eps and
past the last row. Asserts: determinism, member completeness, unique ids, partition
(`summary.totalMembers === members.length` with the model's own plan), AABB within
footprint + spec-derived allowances (C-7), thumbnail determinism.

### 8.5 Spec/schema suites

`timber2-spec`: normalize idempotence; clamp table ↔ configSchema min/max EQUALITY and
COVERAGE via the exported path registry; every `configSchemaFor(family)` path resolves
against a normalized sample spec of that family; canonicalizeSpec total order;
serialization round-trip over presets + 200 fuzzed specs. `timber2-catalog`:
FAMILY_TABLE generates the doc tables; family-identity AC; every preset generates,
locks resolve, bounds cited; the 4×4 skid preset generates.

### 8.6 Doctrine & safety suites

`timber2-doctrine` (cite patterns, ph flags, register coverage, LABOR = legacy values),
G-LS fixture (value change without ack fails; crib change without SME line fails),
`timber2-number-free`, wordlist/pub-denylist/positive-render gates (§6.4).

### 8.7 Viewer suites

`timber2-camera` (true-AABB fit at fov 40 over presets + fuzz corpus + pinned
extremes), `timber2-cutaway` (cutPlaneEq boundary/sign/frac/y-axis/null),
`timber2-thumbs` (committed SVG file goldens string-compared; structural asserts
independent; polygon + KB + ms budgets), happy-dom smoke (cards render, routes, clamp
emission, block gating, boundary sentence, mesh budget), UX suites T-UX-1..11 as
amended in §5.

### 8.8 Perf discipline (minor fix)

Adopt the `test/perf.test.ts` house pattern: warm-up loop, assert the MEAN of N runs
with generous headroom (regen < 50 ms mean per preset; thumb < 25 ms mean). The 10 s
bound is wall-clock for the whole sweep suite only — never per-spec one-shots.

---

## 9. Risks & kill criteria

| # | Risk | Detection | Mitigation / kill |
|---|---|---|---|
| R1 | Compat lock unreachable | timber2-compat red past 1e-12 | STOP at T1; re-plan extraction seams; forking the engine is forbidden. |
| R2 | Hip/pyramid geometry drags | apex/coplanarity invariants failing past timebox | Tower ships shed cab (T4 kill); hip parks to auto-T9 (T8). |
| R3 | Clip-plane vs GLB materials on weak GPUs | T3 device pass | Fall back to the shipping three-viewer.ts pattern exactly; never member filtering. |
| R4 | Golden churn (thumbs) masking regressions | golden updates in PRs without visual diff | SVG file goldens = reviewable diffs; structural asserts fail independently; "goldens update in the same PR as the change, never standalone." |
| R5 | Draw calls / rebuild cost on low-end devices | mesh budget test + T3/T6 device passes | Shared materials, instancing, visibility-scrub (§4.1); K: cap the offending param at the largest smooth value, log it. |
| R6 | Crib table cannot be page-verified / SME unavailable | ledger status at T7 release | Cap depth at smallest verified row; if none, the bunker card holds one release (§6.3). |
| R7 | Scope creep into SAP territory | §6.4 gates; PR review vs §2.7 | Boundary is structural (gates + reciprocal SAP2 edits); revetments/OHC OUT. |
| R8 | Single-maintainer fatigue across 9 phases | progress-table stall > 4 weeks; phase > 2× effort | Every phase (and T4a/T6a checkpoints) is independently shippable; descope ladders make cuts owner-visible; custom ships at T3 so any park point keeps the centerpiece. |
| R9 | UI regression in the refactored shell | happy-dom smoke + per-phase demo checklist | Pure logic lives engine-side and is node-tested; scene changes confined to injection points. |
| R10 | (PH) cite debt multiplies | (PH) census in the ledger at T8 | Debt explicit + bounded; LS subset ledgered with named reviewers; verification is an owner checklist, never silently "done". |
| R11 | New family requests balloon the roster | — | New types enter as FamilyDefs over existing spec branches; a new union branch requires a DECISIONS.md entry naming the subsystem gap. |
| **K1** | Owner wants TIMBER outputs treated as build-to field documents | — | STOP — regime change requiring the SAP-2-style commissioning conversation, not a TIMBER phase. |
| **K2** | Any legacy test "needs" editing | — | Stop-the-line: DECISIONS.md proposal + halt; the compat suite is the only sanctioned bridge. |

---

## 10. Implementation handoff kit

### 10.1 Commands (verbatim)

```bash
npm run typecheck                                   # tsc --noEmit
npm test                                            # node --test, test/*.test.ts
node --import tsx --test test/timber2-*.test.ts     # focused TIMBER-2 suites
node --import tsx --test test/timber-*.test.ts      # legacy suites (git-diff-empty rule)
npm run verify                                      # typecheck + tests + check:offline (+ check-assets after T0)
npm run build:suite                                 # THE deploy build — green at every merge to main
npm run dev                                         # vite dev; open /woodframe.html
npm run update:thumb-goldens                        # rewrites test/goldens/thumbs/ (same-PR rule)
```

### 10.2 The phase ritual (every phase)

1. `git switch -c timber2-tN`; `npm run verify && npm run build:suite` — confirm green
   baseline ON MAIN first. Red main ⇒ stop and report; never build on red.
2. Read your phase in §7 + the START HERE below. Write the phase's FIRST test red (on
   the branch).
3. Implement engine-first (pure modules + tests), UI last.
4. Focused suites → `npm run verify` → `npm run build:suite`.
5. Walk the phase demo in `npm run dev`; run the standing checklist: card renders with
   thumb → configure two params → all stages scrub (name line updates) → cutaway
   sweeps → member card shows cite (+ LS badge if flagged) → cut list shows the
   stage's lines → back to picker → hub link works.
6. Update the progress table in `docs/TIMBER2_PLAN.md`; append `DECISIONS.md` entries
   (`TIMBER-2 Tn:`); update the LS ledger if doctrine changed; merge to main only at
   DoD.

### 10.3 Per-phase START HERE

- **T0:** nothing engine-side. Snapshot goldens BEFORE any other branch touches
  `src/timber`. The SAP2_BLUEPRINT edit needs the owner's ack line in the PR body.
- **T1:** read `src/timber/*.ts` end-to-end, then design-engine §14.3's extraction
  order. FIRST TEST: `timber2-compat` against the T0 goldens (red until delegation).
  Trap: do not sort openings on the compat path (TD5); do not "improve" extracted
  bodies (TD13).
- **T2:** read `roof.ts` stage-9 course tiling + `floor.ts` stagger sweep first —
  coverings reuse both. FIRST TEST: roll-roofing course-sum over the gable at 3
  pitches. Keep covering defaults 'none' so compat never notices. Then shed (pony wall
  in the ROOF module, not walls), then small-plan rule, then catalog + thumbs.
- **T3:** FIRST TEST: happy-dom picker smoke (red). Build store/router pure-first.
  Trap: keyboard guard (§5.3) and the mobile cutaway slider row (§5.4) are acceptance
  items, not polish.
- **T4:** FIRST TEST: G-LS fixture (value change without ack fails). Then ledger
  generator, then access.ts, then towerFrame. Trap: ladder at 24/32 must be FORCED to
  stair by normalizeSpec with a visible issue — a bounds-only clamp is not enough.
- **T5:** FIRST TEST: sea-hut preset ≡ doctrine.HUT dims. Ledged-door brace direction
  (foot at hinge side) is test-asserted. Latrine geometry-closure AC before the card.
- **T6:** FIRST TEST: tent presets ≡ doctrine.TENT (GP-Small 17'6"). T6a merges before
  T6b starts. Trap: story-2 ids carry `L2-` prefixes or uniqueness breaks.
- **T7:** FIRST TEST: the §6.4 gates (red until bunker exists — the fence precedes the
  structure). Crib interlock is a placement convention with an honesty note, not fake
  notch geometry.
- **T8:** FIRST TEST: nail roll-up partition. Hip: pyramid/equal-pitch first; timebox;
  park per §7 T8 rule.

### 10.4 Definition of Done (every phase)

(1) verify + build:suite green on the branch AND after merge to main; (2) git diff
empty on `test/timber-*.test.ts`; (3) check-assets green (no new dist assets);
(4) the phase's §7 acceptance items individually checked; (5) demo walked; (6)
progress table + DECISIONS.md + LS ledger updated; (7) no TODO in code without a
progress-table backlog note.

---

## 11. Decisions log (TD1–TD41 — every synthesis judgment call)

| # | Decision | Rationale (and what it overrules) |
|---|---|---|
| TD1 | TIMBER's defaults-with-cites regime supersedes SAP2_BLUEPRINT's "timber.* leaves / ship-empty" re-entry row; reciprocal owner-acked edits in BOTH docs at T0; R5b gains the crib reconciliation entry condition. | Blocker fix — two binding docs conflicted; implementers must not inherit a doc-level contradiction. |
| TD2 | One engine: `StructureSpec` discriminated union + shared subsystems (design-engine), with design-catalog's FamilyDef/preset layer on top and design-scope's registry idea absorbed into `FAMILY_TABLE`. | Resolves the 4-chassis vs 5-family vs 16-def architecture conflict; engine doc was the most rigorous on types/compat; catalog doc the most rigorous on doctrine surfaces. |
| TD3 | §2.4/§2.5/§2.6 tables are GENERATED from one `FAMILY_TABLE`; ● redefined as "default, replaceable by that row's ✔ options"; `FamilyDef.locks` is the single normative lock source. | Major fix — the catalog contradicted itself across three tables (b-hut roofing, storage-shed flat). |
| TD4 | Mode flags become union branches / per-wall enums (bent lives only in tentFrame; openFront excludes openings on that wall; screen band is hut-only); Custom exposes the legal envelope. | Major fix — kills the FramedParams god-surface; illegal combos unrepresentable, matching the roof-matrix rule. |
| TD5 | `normalizeSpec` never reorders openings on the compat path; `canonicalizeSpec` is a separate function for presets/goldens/serialization; `fill` lives on spec-level `OpeningSpec`, walls.ts untouched. | Blocker fix (silent reorder through the frozen API) + resolves the scope-design walls.ts freeze contradiction. |
| TD6 | The shed ROOF module emits the high-side pony wall and rake infill; `generateWalls`/`wallSystem` walls stay rectangular. | Blocker fix from design-scope (walls.ts frozen yet asked for unequal walls); matches how gable studs already work. |
| TD7 | Flat roof floored at 1:12, roofing locked to double-coverage roll, cite on the member card; 1/4:12 rejected. | Major fix — FM 5-426 roll minimums; real TO flat uses built-up roofing, which is not modeled. |
| TD8 | Retire-by-reuse: the dead `siding` role becomes the plywood-siding role; no `sidingPanel` near-synonym. | Minor fix — zero emitters today (grep-verified); avoids a forever special-case. |
| TD9 | Deep links stay for carpentry specs (divergence from SAP-2's URL-state ban recorded: carpentry specs are not exfiltration-sensitive), EXCEPT `designCoverDepthFt`, which is stripped on serialize and re-prompted on load. | Minor fix — the one SAP-derived number never leaves the device by design. |
| TD10 | Stage model = ordinal-into-stagePlan with closed StageKey vocabulary (design-engine D1); supersedes STAGES_BY_CHASSIS and per-def StageDef lists. | Only variant that keeps the legacy suites untouched for free. |
| TD11 | Thumbnails are RUNTIME deterministic inline SVG (design-engine D3); build-time gen-cards/gen-thumbs pipelines rejected; thumbLod default, memoized, human-silhouette-scaled; committed SVG-file goldens. | Kills the OOM/build-step class by construction; moots the publicDir-ships-no-thumbs and thumb-drift criticisms (recorded as moot, no action). |
| TD12 | Compat = committed pre-refactor JSON goldens, never live-vs-live comparison. | Blocker fix — the previous lock was self-referential after delegation. |
| TD13 | Comparator: exact deep-equal, then 1e-12 epsilon with per-field diff; extraction is verbatim-expression only. | Major fix — benign FP wobble must not trigger the project kill criterion. |
| TD14 | Routes `#/`, `#/build/<id>`, `?c=`; jump chips are buttons. | UX doc's richer route design wins over engine's `#/s/`; anchor-vs-router collision fixed. |
| TD15 | Picker group order: Buildings, Towers, Tents & Frames, Bunkers, Site, Custom; group renamed from "Hasty & Tents"; group column on IN-later rows; >8-cards split rule. | Minor fixes — the group name promised the category the catalog excludes; growth now has an assigned home. |
| TD16 | No service worker; stale `public/sw.js` deleted at T0; posture stated in-app copy. | Major fix — the previous silence left an install-failing SW and an undefined update flow. |
| TD17 | Phase order: engine (T1–T2) → UI+custom-lite (T3) → tower (T4) → huts/latrine (T5) → platform/tents/stories (T6) → bunker (T7) → polish (T8). | Applies the sequencing majors: custom not last, tower (first-named) decoupled from stories=2, LS machinery ships WITH the first LS structure, cheap breadth not queued behind XLs; both former XL phases split with named checkpoints. |
| TD18 | `bomSummary` throws on stage overflow instead of silently truncating. | Major fix — silent BOM under-reporting on non-building models. |
| TD19 | Files-not-inline rationale restated on verifiable grounds (offline mandate, budgets, golden tests, D28's bounded GLB exception); the unverifiable "OOM war story" is dropped as evidence while the policy stands. | Minor fix — D-CAT-9 rested on an incident the repo does not document. |
| TD20 | gp-frame gets a real standard-design identity (20×48 GP-building preset, siding/roofing on) distinct from custom's demo default; family-identity AC. | Minor fix — two cards were the same card twice. |
| TD21 | tent-floor is a pure platform preset (zero new params/roles/branches, identity-AC-asserted); strongback's floor-only redirect deleted. | Minor fix — a family whose UI redirects into another family is a card, not a family. |
| TD22 | Custom ships as custom-lite at T3 and grows automatically via the schema/path registry; card states the custom-BUILDING scope; tower/bunker/platform customize from their own cards. | Blocker fix (headline ask shipped dead-last) + engine D5 scope statement adopted. |
| TD23 | Perf: shared per-role materials, instancing ≥ 20, visibility-scrub, mesh/stage-change/rebuild budgets, warmed-mean perf tests. | Major fix — no draw-call budget existed; house perf-test pattern adopted. |
| TD24 | Ladder rung spec resolved: 2x4 rails + 2x2 rungs let in at 12 in, 36 in extension (TM 5-302 detail + EM 385-1-1, PH, LS); 1x4 cleats recorded as rejected. | Minor fix — a '?' lived inside a binding block; binding docs carry no open questions (synthesis swept for others). |
| TD25 | Boundary enforcement = word-boundary lexicon over strings/doctrineRef/UI copy across src/timber + src/ui + dist, exact-sentence allowlist, pub-denylist, positive render ACs, scoped output scan. | Major fixes — the 4-substring gate was unimplementable ('round') and trivially bypassed. |
| TD26 | Crib table source named via the amended ATP 3-37.34 row (dead-load tables only) or FM 5-34/5-35 if they carry the data; crib LS entries take the SME/engineer reviewer bar; depth bound cited to the table's rows; cap-at-verified-row ship gate. | Blocker + major fixes — the family was unbuildable under the doc's own source rules, and structural sizing is SAP-2's SME-routed class. |
| TD27 | EM 385-1-1 added to the spine as the named LS authority; all LS constants cite it (PH); TM 5-302 stays geometry lineage. | Blocker fix — LS numbers previously had no permissible doctrinal home. |
| TD28 | TM 5-303 added; T8 BOM-reconciliation AC for one family. | Major fix — the only doctrinal cross-check for whole-structure BOMs was missing from a BOM tool. |
| TD29 | TM 10-8340-series added; tent footprints/heights/bent spacing table-driven; GP-Small corrected to 17'6" square. | Major fix — a strongback that misses the canvas skirt is scrap lumber. |
| TD30 | Latrine depth EXPOSED 4–8 ft (PH) until the sheet is verified; geometry-closure AC at 2 and 4 seats. | Major fix — the 4-ft hard lock produced an unusable aisle with no sheet in hand. |
| TD31 | Acceptance never cites a repo-wide test count; the phrase is "git diff empty on test/timber-*.test.ts (33 tests) + verify green." | Minor fix — "219" matched nothing and drifts. |
| TD32 | Tower ladder restricted to 10/16 ft; 24/32 force switchback stair (normalizeSpec-forced, AC-pinned); the safety cage stays IN-later with a page-verified threshold. | Blocker fix — the flagship chassis shipped a noncompliant fall-protection default. |
| TD33 | Tower footing is a bounded choice (timber mudsill vs concrete pad), each cited (PH); concrete default at 24/32. | Minor fix — forcing concrete added a batch-plant dependency to every hasty 10-ft tower. |
| TD34 | Duckboard, hand-wash stand (noted on the latrine card), and vehicle loading ramp get IN-later rows with groups. | Minor fix — real TO items previously had no disposition, undermining exhaustiveness. |
| TD35 | Exposed knobs whose values leave the standard drawing (sea-hut 3rd/side door, b-hut windows ≠ 8) render a "deviation from standard drawing" affordance via `FamilyDef.deviationMarks`. | Minor fix — EXPOSED had meant "the design varies it," which was false for these. |
| TD36 | squad-hut wall height LOCKED 8 ft; lineage labeled "B-hut family scaled (no dedicated sheet identified)"; `rationale` field required for thin variants. | Minor fix — locks must not impersonate a standard design that doesn't exist. |
| TD37 | Small-plan rule: width < 8 ft ⇒ girderless clear-span floor (skids as bearers), cited; envelope minimum 4 ft stated once, agreed by custom/guard-shack/latrine; 4×4 preset AC. | Major fix — the floor generator was degenerate on the catalog's own small plans. |
| TD38 | Openings on standards are `preset` (editable, STD badge, per-wall std reset) with per-opening `locked` for catalog-named signature bays. | Blocker fix — lock semantics for the array surface were unspecified on the most-used editor. |
| TD39 | Conflicting/moot criticisms recorded rather than applied: (a) UX-major "dist-woodframe ships zero thumbs / publicDir" and "thumb drift gate" — moot under TD11 runtime thumbnails; (b) catalog-minor "cite the actual OOM incident" — absorbed by TD19's restated rationale; (c) scope-majors on GenOpts/stageMap retagging — superseded by TD10's stage-agnostic subsystems (C-3), which solve the same problem more generally; (d) scope-major "walls.ts type-only edit for fill" — superseded by TD5 (fill on OpeningSpec); (e) UX "strips already print-clean" claim — replaced by §5.6's scaled/segmented print spec. | Every skipped major traced to the decision that superseded it — nothing dropped silently. |

| TD40 | Owner's "None/Custom" = the single Custom card: clean sheet, nothing locked; the TIMBER-1 demo default is a seed and a 'minimal shell' preset row gives true start-from-nothing. | Completeness fix (gap 15) — the 'None' semantics had been folded in silently; now recorded and card copy fixed. |
| TD41 | Post-synthesis completeness pass applied in full — 17 gaps patched in place: design docs committed as normative companions (T0), SpecCommon defined, C-1/C-3/C-8 restated, §3.7 binding-shapes appendix added (StageKey/StagePlanEntry/SpecIssue/SPEC_PATHS/configSchemaFor/classifyNominal), T-UX/AC citations resolved with dispositions, unlock-to-custom made same-family for every family, designCoverDepthFt persistence surfaces enumerated, cutaway defaults completed for all 14 families + catalog AC, USMC doctrine-mapping note, hasty-category contradiction reworded, interiorStairs made a live knob with ladder fallback, T2 perf fixture named, soilCoverFt naming drift fixed, hut ID prefixes assigned, None/Custom recorded (TD40), trim/stove-jack/paint dispositioned, update:thumb-goldens creation assigned to T2. | Every completeness-critic finding applied; none deferred. |

*End of plan. Implementing sessions: start at §10.2, phase T0.*
