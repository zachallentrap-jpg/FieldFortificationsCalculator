# STATE OF THE APP — Combat Engineer Toolkit (SAP-1 + TIMBER-1)

> **Full-repository audit, 2026-08-01.** What this app is, how it's structured, what verifiably
> works today, and exactly where it's lacking — with file-level receipts. Produced by reading
> every source directory, re-running the full verification suite and both production builds,
> and re-checking the open findings of the prior audits against the current code.
>
> Ground truth at audit time: **typecheck clean · 192/192 tests pass · offline gate PASS ·
> `npm run build` green (PWA + 1.13 MB single-file artifact) · `npm run build:woodframe` green ·
> 295 doctrine leaves registered, 295 still PLACEHOLDER (189 safety-critical) — the
> NOT-FOR-FIELD-USE banner is lit, correctly.**

---

## Table of contents

1. [What this app is](#1-what-this-app-is)
2. [How it got here — the build timeline](#2-how-it-got-here--the-build-timeline)
3. [Architecture and data flow](#3-architecture-and-data-flow)
4. [Repository structure — the full annotated tree](#4-repository-structure--the-full-annotated-tree)
5. [What works today (verified)](#5-what-works-today-verified)
6. [Where it's lacking](#6-where-its-lacking)
   - [6A. The data story — placeholder saturation (by design)](#6a-the-data-story--placeholder-saturation-by-design)
   - [6B. Defects confirmed open right now](#6b-defects-confirmed-open-right-now)
   - [6C. New defects found by this audit](#6c-new-defects-found-by-this-audit)
   - [6D. The known-defect backlog (155 findings) and its real status](#6d-the-known-defect-backlog-155-findings-and-its-real-status)
   - [6E. Planned but not built](#6e-planned-but-not-built)
   - [6F. Model-fidelity and structural gaps](#6f-model-fidelity-and-structural-gaps)
   - [6G. Documentation drift and process debt](#6g-documentation-drift-and-process-debt)
7. [Test and quality infrastructure](#7-test-and-quality-infrastructure)
8. [Recommended priorities](#8-recommended-priorities)
- [Appendix A — documentation index](#appendix-a--documentation-index)

---

## 1. What this app is

**SAP-1 — Survivability Position Planner** is the core product: a deterministic, fully offline,
private, parametric planner for doctrinal USMC/Army combat-engineer survivability positions.
The operator picks from dropdowns and toggles — position type, build standard, soil, a *specific*
threat round, revetment, feature toggles — and the app recomputes, live:

- **Dimensioned 2D drawings** (plan + section A–A) that double as a **range card**: sectors of
  fire labeled in degrees *and* mils, a north arrow, scale bar, and a grazing-fire line (FPL)
  for MG positions.
- A **drag-to-rotate 3D diorama** of the same numbers — terrain block with a real cut hole,
  soil-specific ground surfaces, bonded sandbag walls (instanced), U-shaped earth parapets per
  ATP 3-21.8, a scale figure — with a **construction-stage scrubber** (0–6) and a **cutaway**.
- A **bill of materials** (13 line kinds), a **labor estimate** (man-hours, elapsed, and
  blade-hours on their own axis for vehicle work), and a **spoil balance**.
- A **priorities-of-work stage plan** and a **schedule** ("are we ready by stand-to") from team
  size, security posture, and machine assist.
- A printable **job sheet** (drawings + specs + BOM + labor + stage table + hand-fill range-card
  header + signature block), CSV and JSON exports, per-drawing SVG downloads.
- **Tools**: saved scenarios, Mission BOM rollup with on-hand/shortfall, side-by-side compare,
  compare-across-standards preset, inverse time-available planning, and the **Doctrine values**
  fill workbench that drives the placeholder burn-down.

It has since grown into a small **multi-page suite** ("Combat Engineer Toolkit"):

| Page | What it is |
|---|---|
| `hub.html` — **Combat Engineer Toolkit** | Suite landing page. Two live cards (SAP-1, TIMBER-1) + a ghost card for a future tool. No JS. |
| `index.html` — **SAP-1** (titles itself "Fighting Position Planner") | The planner described above. The main app. |
| `woodframe.html` — **TIMBER-1** | Wood-frame construction assistant (FM 5-426): generates a complete frame model (floor/walls/roof members), 3D scene with click-to-inspect member cards, 11-stage build scrubber, cut list/BOM by stage, SVG plate-layout strips. Currently renders **one hardcoded 20×16 demo building** — no inputs yet. |
| `props.html` — prop gallery | Dev-only viewer for the Blender-authored GLB props. Not in any production build. |

### The philosophy (and why the code looks the way it does)

- **Deterministic.** The engine is pure: same inputs → byte-identical drawings, BOM, labor, job
  sheet. No randomness, no clock reads, no network. Every displayed number can show its own
  derivation (formula + operands) via tap-to-explain.
- **Offline.** Zero runtime network requests. The doctrine/engine/state layers have **zero
  runtime dependencies** (`three` is the single runtime dep, confined to the UI layer). A build
  gate fails the build if any external URL survives into `dist/`.
- **Private.** No accounts, no analytics, no telemetry. Scenarios live in IndexedDB; session
  state in localStorage; exports are explicit user-initiated downloads.
- **Honest.** The defining regime: **every doctrinal constant ships as a flagged placeholder**
  (`Provenance<T>`, `status: 'PLACEHOLDER'`, `source: 'TODO: confirm against current pub'`).
  The app fabricates no shielding thickness, span, standoff, or retaining figure. A data-driven
  **NOT FOR FIELD USE** banner stays up until a qualified user replaces every value offline via
  validated doctrine import. For direct-fire AT and large-VBIED threats the app emits **zero**
  cover thickness ever — the section draws an "ENGINEERED ROOF — SEE ENGINEER" hazard block
  instead. Formula honesty extends this to structure: every position declares its volume and
  labor model fidelity (`approximate`) in the specs panel and job sheet.
- **Plain-language-first.** Every control and legend leads with plain words and keeps the
  doctrinal term in parentheses ("Dirt wall up front (parapet)").

**Positions supported (10):** `one_man`, `two_man`, `mg_crew` (inverted-T + firing platform),
`fifty_cal` (L-shape), `mortar_pit` (circular, π/4 volume), `vehicle_hull_defilade`,
`vehicle_turret_defilade` (ramp-cut + spoil berm + blade-hours), `bunker_op_cp`,
`connecting_trench` (open corridor), `atgm_javelin` (L-shape + backblast warning).

**Threat model (17 munitions in 4 classes):** small arms/HMG (5.56 / 7.62 / 12.7 / 14.5mm),
indirect (60/81/120mm mortar; 105/122/152/155mm artillery), direct-fire AT (RPG, recoilless,
tank, contact-HE), blast (demo/small IED, large VBIED). The specific round drives cover
thickness, standoff, roof path, and cover material. The five hard fail-safe rounds (4 AT +
large VBIED) resolve to `engineered_required`; unknown munitions fail safe.

---

## 2. How it got here — the build timeline

46 commits, 2026-06-30 → 2026-07-12, in six visible waves:

| Wave | Commits (dates) | What landed |
|---|---|---|
| **1. Core build from spec** | `f37e8ca`…`45180a1` (06-30) | Scaffolding, doctrine tables + Provenance registry + io, deterministic engine + adversarial-audit fixes, 2D render system, state layer, live UI with 3 layouts, threat-caliber model, PWA + single-file build, tools (scenarios/mission/compare/plan), test suites, docs. |
| **2. 3D + language pass** | `afc225b`…`0ce451e` (06-30 → 07-01) | Drag-to-rotate three.js viewer (pure `scene3d` descriptor + viewer split), honest materials (revetments visible in 3D), plain-language pass, grouped menus, Blender GLB props (D28). |
| **3. Execution plan v2, Phases 0–6** | `025295e`…`d148591` (07-01 → 07-02) | The synthesized 7-phase roadmap (`docs/EXECUTION_PLAN.md`), then all of it: Phase 0 trust sprint; Phase 1 formula honesty (stringer axis, vehicle ramp+berm+blade-hours, π/4 mortar, revetment BOM completeness, spoil balance, fidelity flags); Phase 2 doctrine unlock (hardened io, fill UI, IndexedDB persistence, manifest hash — the banner can now actually reach zero); Phase 3 field documents (range-card layer, job-sheet field header, SVG download, compare preset); Phase 4 stand-to scheduler (stage decomposition + schedule arithmetic + job-sheet page 2); Phase 5 3D-that-teaches (stage scrubber, cutaway, honesty parity); Phase 6 catalog expansion (trench, ATGM, radiation-halving readout). Plus two adversarial-review fix rounds. |
| **4. 3D realism/diorama pass** | `d337bc1`…`03e9c3b` (07-03 → 07-05) | Diorama engine (terrain crust with true holes, painted sky, shadows, instanced bags, post pipeline), per-soil ground surfaces and materials, humanoid scale figure, masonry-bond parapets, U-shaped earth parapets closed at the rear per ATP 3-21.8, cover-under-threat validation. |
| **5. The suite** | `107032e`, `d04a955` (07-11) | Multi-page build (hub + TIMBER-1 wood-frame tool with FrameModel engine, member inspector, stage scrubber, layout strips), service-worker overhaul, asset pipeline scripts, prop gallery — and the two big audit plans committed to `docs/`. |
| **6. Demo-readiness + 2D truth** | `c7e5f15`, `9deff5b` (07-11 → 07-12) | Demo pass: NOT-FOR-FIELD-USE topbar badge restored, overlay dialogs replace native prompts, metric-mode leaks fixed, SVG icons. 2D realism Phase 1 R1–R3: vehicle plan/section draw the real ramp + front-only berm + hull silhouette, berm/ramp legend callouts, connecting trench reads as an open corridor, L-arm ring overflow fixed, mortar+OHC contradiction flagged, human figure re-proportioned. |

Design decisions are logged as **D1–D35** in `DECISIONS.md` (D33 intentionally skipped).

---

## 3. Architecture and data flow

Strict layering — lower layers never import upward, and the calc core is DOM-free and
dependency-free so it runs under `node:test`:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  doctrine/   tables of Provenance<T> leaves (295), registry, frozen index, │
│              validated import/export (io.ts). Zero deps. No DOM. No clock. │
└──────────────┬─────────────────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  engine/     compute(inputs) → Result: §9 formula chain → geometry, BOM,   │
│              labor, validation (21 codes), derivations, placeholder report │
│              + mission rollup, time-available planner, stage scheduler     │
└──────┬──────────────────┬──────────────────────┬───────────────────────────┘
       ▼                  ▼                      ▼
┌──────────────┐  ┌───────────────────┐  ┌──────────────────────────────────┐
│  render/     │  │  render3d/        │  │  state/                          │
│  pure SVG    │  │  scene3d.ts: pure │  │  store (observer), history,      │
│  strings:    │  │  part-list        │  │  schema-validated import,        │
│  plan,       │  │  descriptor (no   │  │  IndexedDB scenarios,            │
│  section,    │  │  three.js import) │  │  localStorage session, doctrine  │
│  iso, job    │  │  + propLayout     │  │  fill persistence                │
│  sheet, CSV  │  └─────────┬─────────┘  └──────────────┬───────────────────┘
└──────┬───────┘            ▼                           ▼
       │          ┌───────────────────────────────────────────────────────────┐
       └─────────▶│  ui/ + layout/ + theme/    main.ts wiring; layout/shell + │
                  │  desktop/tablet/mobile; generated controls; panels/tools; │
                  │  three-viewer.ts (the ONLY three.js consumer) + ui/engine │
                  │  diorama modules (palette, textures, terrain, sky, post,  │
                  │  bag instancing); hub/props/woodframe pages               │
                  └───────────────────────────────────────────────────────────┘
```

**The input contract** is `Inputs` (16 fields — `engine/types.ts`): positionType, standard,
soil, threat, revetment (strings resolved against doctrine tables with safe fallbacks),
5 feature booleans, count, teamSize, unit, optional `sectorAzimuths`. `Scenario` (id + name +
inputs) lives in the state layer, not the engine.

**The compute chain** (`engine/compute.ts`): normalize + clamp → resolve doctrine rows → the
§9 formula chain in feet (depth of cut → setback → clear span → `resolveCover` roof authority →
parapet/berm ring → hole/ramp/platform/sump volumes → swell → cover + stringers → sandbags /
revetment / camo quantities → spoil balance → labor + blade-hours) → one `Calc` record →
five pure builders produce `Result.{geometry, bom, labor, validation, derivations}` +
`placeholderReport`.

**The render seam.** Both 2D and 3D consume the same `Result`. 2D renderers project
`GeometryModel` (feet) through one projector per view and register numbered callouts into a
shared legend registry so drawing and legend can't drift. `scene3d.ts` builds a
framework-agnostic 3D part list (node-testable, honesty invariants asserted per stage);
`three-viewer.ts` is the only file that touches three.js, turning the descriptor into toon
meshes, instanced sandbag walls, terrain, sky, and the post pipeline.

**State and persistence.** A ~90-line observer store; undo/redo history; scenario storage in
IndexedDB behind an adapter (memory adapter for tests); session snapshot (inputs, mission set,
compare set, on-hand) in localStorage re-validated through the import schema on restore; an
applied doctrine fill persists to IndexedDB and is re-applied through the same validated
importer on boot.

**Build outputs.** One `npm run build` produces: `dist/` (installable PWA — hub + SAP-1 +
TIMBER-1 pages, service worker, manifest) **and** `dist/sap1.html` (everything inlined,
runs from `file://` — the air-gap artifact), then runs the offline gate over `dist/`.
`npm run build:woodframe` separately emits `dist-woodframe/` for standalone TIMBER-1 publishing.

---

## 4. Repository structure — the full annotated tree

*(Line counts from `wc -l` at audit time. ~12,050 lines of app TypeScript in `src/`;
35 test files (192 subtests, 582 assertions) in `test/`; plus scripts, docs, and assets.)*

```
FieldFortificationsCalculator/
├── README.md                  # product overview + NOT-FOR-FIELD-USE/CUI warning + run/build
├── USER_GUIDE.md              # operator guide (partially stale — see §6G)
├── DECISIONS.md               # D1–D35 decision log; the "why" behind every deviation
├── PLACEHOLDER_POLICY.md      # the Provenance regime + exact fill/swap procedure
├── DOCTRINE_SOURCES.md        # per-leaf fill checklist (what to confirm, against which pubs)
├── LICENSE                    # MIT
├── package.json               # zero runtime deps except three; scripts: dev/test/verify/build
├── tsconfig.json              # strict + extra-strict flags (noUncheckedIndexedAccess, …)
├── vite.config.ts             # multi-page build: index + hub + woodframe (hashless names!)
├── vite.standalone.config.ts  # single-entry build feeding the sap1.html inliner
├── vite.woodframe.config.ts   # standalone TIMBER-1 build → dist-woodframe/
├── .replit                    # Replit static deploy: build → publish dist/
├── .claude/launch.json        # 16 dev-server launch entries (per-session strict ports)
│
├── docs/
│   ├── EXECUTION_PLAN.md              # the 7-phase roadmap (v2) — Phases 0–6 executed
│   ├── FULL_AUDIT_REMEDIATION_PLAN.md # 155-finding audit backlog (see §6D)
│   ├── 2D_REALISM_AND_DEMO_PLAN.md    # 2D drawing realism plan — X's done, R1–R3 done, rest open
│   ├── REALISM_PASS_3D_PLAN.md        # 3D visual-realism plan — partially executed
│   ├── ONE_MAN_POSITION_MODELING_SPEC.md # sourced 3D modeling spec (hero model, not yet built)
│   ├── TIMBER1_3D_SYSTEM_DESIGN.md    # TIMBER-1 full design (implemented subset — see §6E)
│   └── STATE_OF_THE_APP.md            # ← this document
│
├── public/
│   ├── sw.js                  # service worker: precache CORE, cache-first, nav-only fallback
│   ├── manifest.webmanifest   # PWA manifest
│   ├── icons/icon.svg
│   └── SAP-1_drawing_reference.svg  # authored §10 visual-system reference (shares callout registry)
│
├── src/
│   ├── version.ts             # APP_VERSION 1.0.0 · SCHEMA_VERSION 1 · DOCTRINE_VERSION 1
│   │
│   ├── doctrine/              # ← the data layer. 12 files, 1,262 lines, zero deps
│   │   ├── types.ts           #   Provenance<T> + P() helper (defaults PLACEHOLDER/TODO-source)
│   │   ├── registry.ts        #   live-leaf registry by dotted path; counts() drives the banner
│   │   ├── index.ts           #   registers all tables, deep-freezes structure (leaves mutable)
│   │   ├── positions.ts       #   10 positions: shape, dims, platform, sumps, crew, parapet mode
│   │   ├── protection.ts      #   17 threats × 9 materials shielding (153 leaves), standoff,
│   │   │                      #   spanSizes, radiationHalving, parapet/berm/overhead, retaining
│   │   ├── soils.ts           #   8 soils: digFactor, wallSlopeRatio, revetForced, faceLook
│   │   ├── standards.ts       #   hasty/deliberate/reinforced multipliers
│   │   ├── materials.ts       #   sandbag, 5 revetments, camo, sump, swell, machine factor
│   │   ├── labor.ts           #   7 labor leaves (flat base + adders) — illustrative
│   │   ├── stages.ts          #   7-stage priorities-of-work order + excavation split + stage↔BOM map
│   │   ├── units.ts           #   exact ft↔m conversion + display formatters (not placeholders)
│   │   └── io.ts              #   exportDoctrine/importDoctrine: hardened, all-or-nothing,
│   │                          #   dry-run, FNV-1a fill manifest hash
│   │
│   ├── engine/                # ← the calculator. 13 files, 1,749 lines, zero deps
│   │   ├── types.ts           #   Inputs / Result / BomLine / ValidationIssue / Derivation
│   │   ├── compute.ts         #   the §9 chain; Calc; fidelity statements; 420 lines
│   │   ├── protection.ts      #   resolveCover() — the single roof/cover authority (fail-safe)
│   │   ├── geometry.ts        #   GeometryModel builder (plan/section blocks + DimSpecs w/ PH flags)
│   │   ├── materials.ts       #   buildBom() — 13 line kinds, zero-lines omitted, placeholder flags
│   │   ├── labor.ts           #   buildLabor() — packaging + human-readable assumptions
│   │   ├── validate.ts        #   runValidation() — 21 codes, errors→warnings→advisories
│   │   ├── codes.ts           #   the validation-code catalog (5 err / 7 warn / 9 advisory)
│   │   ├── explain.ts         #   buildDerivations() — up to 23 tap-to-explain traces
│   │   ├── stages.ts          #   computeStages() exact-partition stage plan + scheduleStages() clock
│   │   ├── mission.ts         #   aggregateMission() — merge by id, on-hand → shortfall
│   │   ├── plan.ts            #   planForTime() — 18-combo inverse search, ranked
│   │   └── round.ts           #   ceilInt/round1/round2/clamp/finite — NaN containment
│   │
│   ├── render/                # ← 2D SVG. 10 files, ~1,250 lines, pure string builders
│   │   ├── svg.ts             #   primitives + guard() (throws on non-finite) + CALLOUTS registry
│   │   ├── project.ts         #   one feet→px projector per drawing
│   │   ├── chrome.ts          #   patterns, header bars, dims, scale bar, figure, legend,
│   │   │                      #   north arrow, degrees+mils azimuth labels
│   │   ├── drawPlan.ts        #   plan view + range-card layer (sectors, FPL, A–A cut)
│   │   ├── drawSection.ts     #   section A–A + engineered-roof hazard block + vehicle ramp/berm
│   │   ├── drawIso.ts         #   2.5D schematic (no-WebGL fallback only)
│   │   ├── a11y.ts            #   per-view <title>/<desc> text
│   │   ├── jobSheet.ts        #   printable job sheet (self-contained HTML + print tokens)
│   │   ├── csv.ts             #   RFC-4180 BOM export
│   │   └── print-tokens.ts    #   inlined Day palette for self-contained print/reference output
│   │
│   ├── render3d/              # ← pure 3D descriptor (no three.js import; node-tested)
│   │   ├── scene3d.ts         #   buildScene3D(result,{stage,cutaway}) → parts + terrain spec
│   │   └── propLayout.ts      #   sandbag grid + running-bond/header-stretcher layout math
│   │
│   ├── state/                 # ← 7 files, ~530 lines
│   │   ├── store.ts           #   minimal observer store (inputs + ui prefs)
│   │   ├── history.ts         #   undo/redo stacks
│   │   ├── schema.ts          #   strict import validation (scenarios + inputs)
│   │   ├── persistence.ts     #   IndexedDB adapter (+ memory adapter for tests)
│   │   ├── scenarios.ts       #   scenario CRUD (pure, adapter-injected)
│   │   ├── session.ts         #   localStorage session snapshot save/restore
│   │   └── doctrineFill.ts    #   persist/restore applied doctrine fill (re-validated on boot)
│   │
│   ├── layout/                # ← 10 files, ~1,300 lines — HTML-string layouts + panels
│   │   ├── resolve.ts         #   width/pointer/orientation → mobile|tablet|desktop (+override)
│   │   ├── shell.ts           #   topbar (badge, hamburger menu), bottom toolbar, 3D card chrome
│   │   ├── desktop.ts / tablet.ts / mobile.ts   # the three arrangements
│   │   ├── controls.ts        #   inputs generated from doctrine tables (labels + hints)
│   │   ├── panels.ts          #   specs / BOM / labor / checks / trace panels
│   │   ├── tools.ts           #   overlays: scenarios, mission, compare, plan, schedule, doctrine
│   │   ├── help.ts            #   in-app help drawer content
│   │   └── diagnostics.ts     #   status overlay (versions, placeholder counts, last error)
│   │
│   ├── theme/theme.ts         # day/night apply + persist + system-preference initial
│   │
│   ├── timber/                # ← TIMBER-1 engine. 7 files, 777 lines, pure & node-tested
│   │   ├── types.ts           #   Member (22 roles, dressed sizes), 11 FM 5-426 stages
│   │   ├── frame.ts           #   generateFrame(building) → FrameModel (compose of the below)
│   │   ├── floor.ts           #   posts-to-grade, sills, 3-2x10 girder, joists, rim, bridging,
│   │   │                      #   staggered subfloor (y=0 datum = top of subfloor)
│   │   ├── walls.ts           #   sole/top/cap plates, OC studs, framed openings (kings/jacks/
│   │   │                      #   doubled header/sill/cripples)
│   │   ├── roof.ts            #   framing-square rafter math (plumb/seat cuts), ridge, collar
│   │   │                      #   ties, gable studs, slope-plane sheathing
│   │   ├── elevation.ts       #   wall elevation rects + plate layout strips (X/K/J/C marks)
│   │   └── bom.ts             #   cut list (1/8" grouping), board-feet, per-stage rollup,
│   │                          #   labor from 2 bare placeholder constants (see §6C-N13)
│   │
│   ├── ui/                    # ← the app layer
│   │   ├── index.html         #   SAP-1 entry (overlay root, sr-status region, skip link)
│   │   ├── hub.html           #   suite landing page (no JS)
│   │   ├── woodframe.html     #   TIMBER-1 entry (toolbar chips, viewport, member card, strips)
│   │   ├── props.html         #   dev-only prop gallery entry
│   │   ├── main.ts            #   boot, store↔render loop, all delegated events (764 lines)
│   │   ├── three-viewer.ts    #   THE three.js consumer: toon meshes, walls, figure, lights,
│   │   │                      #   shadows, stage rise animation, cutaway, watchdog (1,525 lines)
│   │   ├── woodframe-scene.ts #   TIMBER-1 3D + member inspector + stage chips + strips (304)
│   │   ├── props-gallery.ts   #   dev gallery logic
│   │   ├── errorBoundary.ts   #   safeCompute/safeRender + error card
│   │   ├── styles.css / tokens.css  # app styles + day/night token palettes
│   │   ├── asset-types.d.ts   #   *.glb?url module declaration
│   │   └── engine/            #   the diorama engine (UI-side 3D helpers)
│   │       ├── palette.ts     #     day/night art direction + per-soil looks + light rigs
│   │       ├── textures.ts    #     deterministic canvas painters (6 soil surface styles)
│   │       ├── terrain.ts     #     crust with true holes, under-shells, scatter, cutaway block
│   │       ├── sky.ts         #     painted equirect sky dome + fog
│   │       ├── post.ts        #     tiered post pipeline (MSAA, tilt-shift, grade) + tier detect
│   │       ├── bagInstancing.ts #   SandbagBatcher → InstancedMesh per color
│   │       └── shared.ts      #     texture/geometry registries, hashJitter, disposeObject
│   │
│   └── assets/models/         # Blender-authored GLB props, unit-box normalized
│       ├── sandbag.glb (61K) · picket.glb (15K) · lumber_2x4/2x6/4x4.glb (~45K each)
│       └── plywood.glb (69K)  # ⚠ currently orphaned — never imported (see §6C)
│
├── scripts/
│   ├── build-standalone.ts    # inlines the standalone bundle into dist/sap1.html (guards
│   │                          # against </script> breakage; strips preload hints)
│   ├── check-offline.ts       # build gate: zero external URLs in dist/ (not dist-woodframe/)
│   ├── serve.js               # zero-dep static server w/ traversal guard (Replit publish)
│   ├── gen-reference.ts       # regenerates the reference SVG FROM the renderer (no drift)
│   ├── render-sample.ts       # renders sample SVGs for eyeballing
│   │                          # ⚠ neither of the above two has an npm script entry
│   ├── make_lumber.py / make_plywood.py / render_assets.py  # Blender asset pipeline
│   └── blender/assets.py, blenderlib.py  # shared authoring lib — ⚠ OUT_DIR hardcoded to a
│                              # dead macOS path from another machine (see §6C-N15)
│
└── test/                      # 35 test files + helpers.ts, 192 subtests — see §7
```

---

## 5. What works today (verified)

Everything in this section was re-verified during this audit, not taken from docs.

### 5.0 1371 LEARNING — the toolkit-level trainer (added after the audit above)

A fourth page on the hub, `learn.html`, beside SAP-2 and the two wood-frame apps. It is
toolkit-level rather than a tab inside a tool because the vocabulary is what transfers between
jobs: a Marine who knows what a jack stud is knows it in a hut, a tower and a bunker.

| Surface | What it is |
|---|---|
| **Decks** | Fourteen decks — one per shipped structure, plus a cross-family "Framing pieces" deck that teaches each of the ~49 roles in the simplest structure that has one. Scheduled by session (Leitner, clock-free), modes escalate from flip to identify / point-at-it / stage-order as a card is learned. |
| **Pieces** | The whole framing dictionary, searchable, with which structures each piece appears in. |
| **Sequence** | Every structure's build order, with a drawing of the structure as it stood at the end of each step — all frames at the finished building's scale, so it reads as one building growing. |

Three properties are worth stating because they are what the tests protect:

- **Nothing is hand-authored.** Decks, card art and sequences all compile from the same
  `Member[]` the planners use (FD1). Change the building — swap a gable for a shed, switch a
  bunker to crib walls — and the deck changes with it.
- **The art is the model, drawn.** Card fronts are runtime SVG from `thumbnails.ts`, so there
  are no image files, no build step, and no three.js on this page — 21 kB of app code.
- **"Known" means something.** A self-graded flip cannot promote a card past "learning"; a card
  has to be produced under a mode that could have caught a wrong answer (FD10).

Pinned: `test/fixtures/train-vectors.json` fixes the PRNG, the shuffle and the session builder,
so a learner's card order is reproducible across builds. Regenerate only via
`npm run gen:train-vectors`, in the same PR as the change that moved it.

### Verification runs (2026-08-01)

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`, strict + extra flags) | clean |
| `npm test` (node:test, 35 files) | **192/192 pass**, 0 skip, ~5.2 s |
| `npm run check:offline` | PASS — 12 dist files scanned, zero external URLs |
| `npm run build` | green: PWA `dist/` + `dist/sap1.html` (1.13 MB single file) |
| `npm run build:woodframe` | green: `dist-woodframe/` (941 KB bundle) |
| Live doctrine registry | 295 leaves, 295 PLACEHOLDER, 0 DOCTRINE, 189 safety-critical |

### Feature inventory — working now

**Engine (all node-tested):**
- Full deterministic compute for all 10 positions × 17 threats × 8 soils × 3 standards ×
  5 revetments — fuzz-tested over 3,000 seeded inputs: never throws, never NaN, never a
  fabricated engineered thickness.
- The engineered-roof fail-safe through the single `resolveCover` authority (threat-driven,
  span-driven, and unknown-threat paths), honored consistently by BOM, labor, explain,
  2D section, 3D scene at every construction stage.
- 21-code validation catalog (5 errors / 7 warnings / 9 advisories), deterministic ordering,
  reachability-tested. Includes revet-forced soils, shoring depth, spoil balance both ways,
  wet-soil drainage, ATGM backblast, mortar-roof contradiction, hasty-roof-under-threat,
  sandbag basic-load, machine-required-vehicle.
- Tap-to-explain derivations (up to 23 per result) with per-operand placeholder + source flags.
- Stage decomposition whose per-stage man-hours **exactly partition** the position total
  (invariant-tested), and clock arithmetic with posture/machine/team — DTGs are inputs, the
  engine stays clock-free.
- Mission BOM rollup (merge by id, on-hand → shortfall with missing-entry = short), inverse
  time-available planner (18-combo search with ranked feasible list + closest-miss).
- Doctrine import/export: all-or-nothing apply, dry-run, prototype-pollution rejection,
  version gate, magnitude bound, DOCTRINE-with-TODO-source rejection, fill manifest hash —
  end-to-end banner-clear is test-backed (fixture drives all 295 leaves → banner string gone
  → restore proves it re-locks).
- Live placeholder accounting: `counts()` drives the topbar badge, Status panel, Doctrine
  overlay remaining-counts, and job-sheet provenance footer.

**2D (render-tested incl. NaN matrix + fuzz + intuitive-conventions suite):**
- Plan + section for every position with per-shape truth as of R1–R3: vehicle ramp + front
  berm + hull silhouette, open-corridor trench, contained L-arms, circle-true mortar plan.
- Range-card layer: sector fan with degrees + mils labels, FPL for MG positions, north arrow,
  scale bar, A–A cut cross-references, FRONT/REAR/ENEMY orientation, numbered callouts with a
  generated legend that cannot drift from the drawing.
- Engineered-roof hazard block in section; standing figure (or vehicle silhouette) for scale;
  metric/imperial display conversion across specs, BOM, job sheet, CSV, figure label.
- Job sheet: drawings + inputs + specs (with fidelity rows) + BOM + labor + priorities-of-work
  stage table + engineer-handoff block (threat, clear span, standoff achieved, depth) +
  hand-fill field header (GRID/UNIT/DTG/AZIMUTH/PREPARED BY) + signature block + provenance
  footer naming the doctrine fill hash. Pop-up-blocked print falls back to an HTML download.
- CSV (RFC-4180 with placeholder column), scenario JSON export/import (validated), per-drawing
  SVG download (but see §6B — downloaded SVGs have a color bug).

**3D (scene3d node-tested; viewer verified live in prior passes):**
- Real drag-to-rotate diorama for all 10 positions: terrain crust with true cut holes and
  under-shells, six per-soil painted ground surfaces, painted sky + fog, shadows, tiered
  post pipeline with a frame-time watchdog, instanced bonded sandbag walls, per-soil wall
  batter, U-shaped mounded earth parapets (closed rear per ATP 3-21.8), sandbag firing rest,
  rear entrance gaps (85% frontage for ATGM backblast), entry steps when deep enough, honest
  revetment finishes (bags / pickets+wire / corrugated / timber), scale figure, enemy arrow +
  sector wedge, camo net, GLB props with procedural fallback + deterministic jitter.
- Construction-stage scrubber 0–6 (parts filter by doctrinal stage; stage-0 terrain renders
  unbroken; new parts ease in), cutaway via a global clipping plane with solid-earth treatment
  and section lighting, camera state that survives every UI re-render.
- WebGL-absent fallback to the 2.5D schematic; compute/render errors degrade to an in-app
  error card, never a white screen.

**App shell / state:**
- Three responsive layouts (desktop 3-region / tablet split / mobile bottom-sheet with
  swipe-to-dismiss), auto-resolved + manual override; day/night themes (night is a real
  light-discipline palette) persisted per device; focus + scroll restoration across the
  full-shell re-render; toasts; skip link; sr-status live region.
- Undo/redo (with keyboard shortcuts), reset, session persistence across tab eviction
  (inputs + mission set + compare set + on-hand), scenario CRUD in IndexedDB with strict
  re-validation, applied-doctrine-fill persistence re-validated through the importer on boot.
- Two-level threat picker generated from the doctrine tables; every control carries a
  plain-language hint.

**Suite:**
- Hub page; TIMBER-1 renders its demo building end-to-end (FrameModel → 3D with per-member
  identity → member inspector card → 11-stage scrubber with per-stage cut list/board-feet/
  man-hours → SVG layout strips with cross-selection); timber engine (floor/walls/roof
  generators, BOM) is node-tested.
- PWA install + offline after first load when entering via SAP-1 (service worker with
  reconciled precache, `res.ok` guard, navigation-only fallback — but see §6C-N14: hub and
  TIMBER-1 entries don't register it); the single-file `sap1.html` runs from `file://`;
  Replit deploy config; zero-dep fallback server with a path-traversal guard.

---

## 6. Where it's lacking

Seven distinct categories, from "by design" to "genuinely broken."

### 6A. The data story — placeholder saturation (by design)

**Every one of the 295 doctrine leaves is still a placeholder. 189 are safety-critical.
No doctrine fill has ever been applied.** This is the designed state — the tool ships
value-empty on purpose — but it means, concretely:

- The app is **NOT FOR FIELD USE** and says so. Every dimension, thickness, standoff, span,
  labor rate, and factor on screen is illustrative.
- The core product promise (fill values offline → banner clears) is *mechanically proven*
  (test-backed end-to-end) but has **never been exercised with real data**. Nobody has done a
  real fill; there is no fixture representing a genuine publication pass.
- `DOCTRINE_SOURCES.md` is the 295-row checklist for that fill. The work is unstarted.
- Structural models invented in-repo (vehicle ramp geometry, berm sizing, spoil balance,
  blade-hour rate, stage fractions) are flagged `approximate` but **the SME structural review
  logged as an open item in D29 has not happened** — placeholder data excuses wrong constants,
  not wrong structure, and no qualified reviewer has confirmed the structure.

### 6B. Defects confirmed open right now

Re-verified against the current code during this audit (file:line evidence):

| # | Defect | Evidence |
|---|---|---|
| 1 | **Downloaded SVG drawings render black/invisible.** The exported plan/section reference `var(--callout-fill)` etc. and app CSS classes that don't exist outside the app DOM. On-screen fine; the downloaded file is unusable. (Audit findings 13–15.) | `render/svg.ts:86-88` emits `var(--…)`; `main.ts` downloads the raw string; no `<style>` block is embedded |
| 2 | **Applied doctrine fills for labor values are silently ignored by compute().** `baseLabor` snapshots the seven labor `.value`s at module load, so an import that updates them changes nothing until a full reload (and even then depends on module-init order). (Finding 7.) | `engine/compute.ts` module-scope `const baseLabor = { baseMH: laborDoctrine.baseMH.value, … }` |
| 3 | **The stand-to schedule double-counts machine assist.** `compute()` already multiplies excavation man-hours by the machine factor; `scheduleStages` *also* multiplies effective diggers by `1/machine.excavationFactor` — the clock can be ~2.5× too optimistic. (Finding 9.) | `engine/compute.ts:283` and `engine/stages.ts:122-123` |
| 4 | **The printed job sheet omits every validation error/warning.** A position the app itself flags (`REVET_REQUIRED_SOIL`, spoil short, shoring) prints as a clean sheet. (Finding 10.) | zero validation references in `render/jobSheet.ts` |
| 5 | **Doctrine importer accepts 0 for divisor leaves.** Only bound is `0 ≤ v < 1000`; a fill with `sandbag.L = 0` or `excavationSplit` summing ≠ 1 applies cleanly and breaks BOM/stages downstream. (Findings 6, 26; no unit check either — finding 27.) | `doctrine/io.ts:46-48` |
| 6 | **Time-planner "Use" reverts unrelated edits.** It applies the full input snapshot captured when the plan ran, silently discarding every edit made after. (Finding 16.) | `ui/main.ts` `plan-apply` → `store.replaceInputs(opt.inputs)` |
| 7 | **Mission BOM merges materially different items.** Lines merge by `id`, so e.g. different stringer sizes/panel types across positions collapse into one line under the first-seen label. (Finding 8.) | `engine/mission.ts:24-45` |
| 8 | **Firing-platform semantics are inverted between engine and drawings.** The engine digs the platform *below* the bay floor (`depthBelowHole`); both renderers draw a raised deck *on* the floor. Volume and picture disagree. (Finding 11.) | `engine/geometry.ts:152`; `positions.ts` `depthBelowHole` |
| 9 | **Hashless build assets + fixed cache name.** `assets/[name].js` + cache `sap1-v2` means each deploy requires a manual cache-name bump or returning users stay pinned to stale code. (Finding 3 residue; the rest of the SW cluster is fixed.) | `vite.config.ts:46-48`, `public/sw.js:5` |
| 10 | **TIMBER-1 canvas height balloons with scroll.** Viewport height derives from `getBoundingClientRect().top` at resize time, which shrinks/negates when scrolled. (Finding 17.) | `ui/woodframe-scene.ts:69` |
| 11 | **The offline gate never scans `dist-woodframe/`.** The standalone TIMBER-1 artifact bypasses the zero-external-URL guarantee. (Finding 23.) | `scripts/check-offline.ts` (no reference) |
| 12 | **`dist-woodframe/` publishes with no `index.html`** (site root 404s) and its back-link targets a `hub.html` that isn't in that build. (Findings 138–140, 143.) | `vite.woodframe.config.ts` inputs; build output listing |
| 13 | **Typecheck skips two of the three Vite configs.** `tsconfig.include` lists only `vite.config.ts`. (Finding 142.) | `tsconfig.json:24` |
| 14 | **TIMBER-1 renders a hardcoded 20×16 demo building — there are no inputs.** The whole control panel is future work (the code says so). | `ui/woodframe-scene.ts:16-31` |

### 6C. New defects found by this audit

Not in any prior plan — found while reading the current code:

| # | Finding | Evidence |
|---|---|---|
| N1 | **The explain trace lies for vehicle positions.** The `excavLoose` derivation prints the formula as `(bay + platform + sumps) × swellFactor`, but the operand actually includes `rampVol` — the *dominant* excavation term for defilades. A formula-honesty defect inside the honesty feature. | `engine/explain.ts:107` vs `engine/compute.ts:218` |
| N2 | **`plywood.glb` (69 KB) is orphaned.** Authored, shipped in `src/assets/models/`, never imported — the plywood sheet is procedural. Either wire it or delete it. | `three-viewer.ts:26-30` imports (no plywood) |
| N3 | **The stage scrubber's tick marks never render.** `list="stage-ticks"` points at a `<datalist>` that doesn't exist anywhere. | `layout/shell.ts:183` |
| N4 | **No UI exists for `sectorAzimuths`.** The type, schema, drawing, and mils labels all work — but no control sets it, so every plan shows the hardcoded ±45° default. The "range card" claim is only as real as a hand-edited scenario JSON. (Related: audit finding 40 — the fan is labeled as absolute azimuths while the data is relative.) | `engine/types.ts:19`, `engine/geometry.ts:126-129`, `layout/controls.ts` (absent) |
| N5 | **The 3D camera never re-frames on position change.** Framing happens once; switching one-man → vehicle defilade keeps the old framing until the user hits Reset view. | `three-viewer.ts:1181,1418-1432` |
| N6 | **Unconsumed doctrine leaves are back.** `overhead.sheathingThickness`, `overhead.dustproofThickness`, `sump.rollInSlope`, and safety-critical `retainingWall.thickness` are registered (counted against the banner) but consumed by nothing — the exact "verification make-work" Phase 2.8 was supposed to eliminate (its integrity rule was "zero registered leaves without a consumer"). | `doctrine/protection.ts:187-188,211`, `doctrine/materials.ts:83` |
| N7 | **`plan.ts` protection weights are invented, unwrapped magnitudes.** `STANDARD_RANK` and the 4/3/1 scoring live outside the provenance regime — the only significant magic numbers in the calc core. The planner also never proposes 2 of the 5 revetments (`corrugated_metal`, `timber_plywood`) and never varies machine assist. | `engine/plan.ts:36-43` |
| N8 | **Wall slope never affects excavation volume.** `soils.wallSlopeRatio` drives the 3D picture (and 2D is planned) but the volume model is a straight prism — a sand cut (1.48 H:V) and a vertical rock shaft yield identical spoil. Fidelity flag says `approximate`, but this one is a *soil-invariant* error in the number the tool is named for. | `engine/compute.ts:195` vs `render3d/scene3d.ts:224` |
| N9 | **`firingStep` is a near-no-op input.** It draws a ledge in the section; adds no volume, no labor, no validation note. Toggling it changes almost nothing and nothing says so. | `engine/compute.ts:206-210` |
| N10 | **3D card has no empty state** (2D has "Configure a position…", 3D renders sky over nothing), and the vehicle defilade's 2× vertical relief exaggeration is disclosed only as "Illustrative diorama," not as *this shape is not to scale*. | `scene3d.ts:187`, `layout/shell.ts:191` |
| N11 | **Mission rollup drops all validation.** Per-position warnings (engineered roof, revet-forced soil) vanish from the mission view; only quantities aggregate. | `engine/mission.ts` (no validation field) |
| N12 | **Minor dead code.** `drawIso.ts:32` unused `spanFt`; CSS classes `.panel-card`/`.iso-row` referenced but undefined; `.sr-only` defined but unused; `lumber` label table and `roofSelector` exported but consumed only by tests; `elbowHoles`/`storageCompartment` defined on all 10 positions and read by nothing; `layout/resolve.ts:22-23` both branches return `'tablet'`; `timber/floor.ts:93-99` computes then `void`s `girderBottom`; an empty `for … pass` loop in `scripts/blender/assets.py:150-151`. | various (see file refs) |
| N13 | **TIMBER-1 sits entirely outside the honesty regime.** The number-free gate scans only 9 engine modules and the offline gate scans `engine/render/state/doctrine/layout/theme` — **neither includes `src/timber`**. TIMBER-1's invented magnitudes (`MH_PER_BF = 0.055`, `MH_PER_PANEL = 0.5`, 8-ft post spacing, fixed 3-2x10 girder, fixed 2x8 joists) are bare constants, not registry leaves. **Filling all 295 SAP-1 placeholders would clear the NOT-FOR-FIELD-USE banner while every TIMBER-1 labor/sizing number remains invented and uncounted.** | `test/number-free.test.ts:11`, `test/offline.test.ts:11`, `timber/bom.ts:47-48`, `timber/floor.ts:8-10` |
| N14 | **Only SAP-1 registers the service worker or links the manifest.** A user whose first landing is `hub.html` or `woodframe.html` gets no PWA install prompt and no offline cache until they visit `index.html`. | `ui/main.ts:748` (sole registration); manifest link only in `index.html` |
| N15 | **The Blender asset pipeline can't run for anyone else.** `blenderlib.py` hardcodes `OUT_DIR` to a dead macOS scratchpad path from a *different project's* session (`/private/tmp/claude-501/-Users-zacharytraphagen-CommandHub-Led/…`), and `render_assets.py` notes the sandbag hero render lives in the sibling `CommandHub-Led` repo and "was never exported to GLB." Prop regeneration is currently machine- and repo-locked. | `scripts/blender/blenderlib.py:20`; `scripts/render_assets.py` (tail note) |
| N16 | **Replit workspace and deployment run different stacks.** `.replit`'s interactive `run` uses the Vite dev server while `[deployment]` (autoscale) runs `scripts/serve.js` over a production build — README still describes the older static-deploy shape. Also: Vite warns on every build about the 1.02 MB `three-viewer` chunk (acknowledged in `vite.config.ts:34`, unaddressed). | `.replit`; `vite.config.ts:34` |

### 6D. The known-defect backlog (155 findings) and its real status

`docs/FULL_AUDIT_REMEDIATION_PLAN.md` (committed 07-11) logs **143 confirmed + 12
judgment-call findings** from a 226-subagent adversarial audit: 17 critical/high (Phase 1),
62 medium (Phase 2), 64 low (Phase 3), 12 plausible. **It is a plan only — no dedicated
remediation pass has run.** The two commits since (`c7e5f15`, `9deff5b`) executed the *2D
demo plan*, which overlaps only a handful of findings.

Status of **Phase 1 (the 17 critical/high)**, re-verified this audit:

| Finding | Status |
|---|---|
| 1 SW pins users to first deploy | **Partially fixed** — cache bumped `sap1-v2`, CORE reconciled; hashless names + fixed cache name remain (§6B-9) |
| 2 SW caches non-OK responses | **Fixed** (`res.ok` guard) |
| 3 Hashless chunk names | **Open** (§6B-9) |
| 4 Precache omits JS/CSS | **Fixed** (CORE lists all bundles) |
| 5 hub/woodframe not precached; fallback over-serves | **Fixed** (both precached; navigation-only fallback) |
| 6 Importer accepts 0 divisors | **Open** (§6B-5) |
| 7 Labor doctrine snapshot at module load | **Open** (§6B-2) |
| 8 Mission BOM merges different items | **Open** (§6B-7) |
| 9 Schedule double-counts machine assist | **Open** (§6B-3) |
| 10 Job sheet omits validation | **Open** (§6B-4) |
| 11 Firing-platform semantics inverted | **Open** (§6B-8) |
| 12 TIMBER-1 OC grid shifted +3/4" | **Open** (no fix commit since audit; not re-derived here) |
| 13–15 Downloaded SVGs render black | **Open** (§6B-1) |
| 16 Time-planner "Use" stale snapshot | **Open** (§6B-6) |
| 17 TIMBER-1 canvas height balloons | **Open** (§6B-10) |

**Net: of the 17 critical/high findings, 4 are fixed, 1 partially, 12 remain open.**
Phases 2 and 3 (126 medium/low findings — UX, a11y, robustness, build hygiene, polish) are
essentially untouched apart from incidental overlap from the demo pass (native dialogs
replaced, metric leaks fixed, topbar badge restored, emoji icons replaced, dev picker gated).
High-signal still-open clusters there: **focus management on overlays** (62, 64), **compute-error
infinite rAF loop** (51–53), **global Ctrl+Z hijack inside text fields** (54), **two-tab session
clobber** (68–69), **destructive one-tap actions with no confirm/undo** (58–61, 65), **doctrine
inline-edit silent-discard paths** (55, 57), **CSV formula injection** (39), **3D render loop
never idles** (73–74), **`typeof localStorage` boot crash when storage is disabled** (70),
**night-theme contrast** (72), **plan-view azimuth mislabeling** (40), **job sheet prints raw
enum ids** (41), **OC slab at grade in 3D** (42), **TIMBER-1 floor/wall geometry defects**
(43–47), **HalfFloat MSAA without capability check → black view on some mobile GPUs** (48).

### 6E. Planned but not built

The repo's own plans, with their unexecuted remainders:

**`docs/2D_REALISM_AND_DEMO_PLAN.md`** — Phase 0 (X1–X6) done; Phase 1 R1–R3 done.
Still open:
- **R4** — draw the real overhead-cover build-up (true stringer count/spacing/bearing,
  sheathing/dustproof/earth bands; kneeling figure when headroom < figure height — today the
  figure's head pokes through the roof slab).
- **R5** — soil + revetment visible in section (battered walls per `wallSlopeRatio`, per-soil
  hatch, spoil vs in-situ fill distinction, revetment facing + picket ticks).
- **R6** — stop inventing drawn geometry doctrine already defines (sump notch, platform widths,
  firing-step dims → doctrine placeholders instead of drawing-layer magic numbers; the platform
  callout still reuses the firing-step label).
- **R7** — dimension what matters (parapet thickness / outer envelope / `ramp_run` DimSpecs are
  computed but `parapet_w`/`outer_*` still never render; witness lines; callout de-collision).
- **R8** — iso view: extrude per shape or retire it (still a shape-blind cuboid).
- **R9** — per-shape render assertions locking all of the above.
- **Phase 2** — U1 azimuth-of-fire input → true range card (pairs with §6C-N4); U2 title block
  on exported SVGs; U3 stage-aware 2D section tied to the scrubber; U4 backblast cone on the
  ATGM plan + advisories as job-sheet notes; U5 per-dimension (PH) markers decision.
- **Phase 3** — shareable URL state, demo preset chips, GLB pop-in shimmer, mobile sheet ✕,
  token hygiene (`--ok` undefined; hub/woodframe hardcoded light palette), USER_GUIDE rewrite.

**`docs/REALISM_PASS_3D_PLAN.md`** — the parapet/geometry items visibly landed (commits
07-04/05: U-shaped closed-rear parapets, continuous mounds, flare clamps, per-soil surfaces).
Cutaway lighting/solidity work landed in the viewer (section light, DoubleSide flip, solid
crust). Not evidenced as done: **R6** graded entrances/steps for every deep position (steps
exist only when depth ≥ 2.5 ft and bay is roomy), **R7** full doctrinal vehicle ramp treatment
(relief is still 2× exaggerated instead), **R9** figure placement on L-arms (mirror logic
exists; not re-verified), **R11** stage story (mark → scrape → deepen → spoil), **R12** mouth
rounding, **R13** parapet batter.

**`docs/ONE_MAN_POSITION_MODELING_SPEC.md`** — the sourced hero-model spec (bond-true bag
walls, full OHC stack with sheathing/dustproof/burst layers, elbow shelf, sector stakes,
posed figure at armpit depth, §4 quarantined values). The EXECUTION_PLAN Phase 5.3 hero model
was explicitly **deferred** (D34/D35 note) — the current one-man 3D is the good generic
diorama, not this spec.

**`docs/TIMBER1_3D_SYSTEM_DESIGN.md`** — implemented: FrameModel with 22 typed member roles,
floor/wall/roof generators with credible carpentry math (framing-square rafters, dressed-size
datum stack, real opening framing), 11-stage scrubber, click-to-inspect member cards, plate
layout strips with cross-selection, grouped cut list/board-feet/BOM — all node-tested
(determinism, 64-config no-NaN fuzz, stage-BOM partition, 2D/3D parity, <50 ms regen budget).
Not implemented, measured against the design doc:
- **User inputs** — the entire premise of a calculator; currently one hardcoded 20×16 building
  (`woodframe-scene.ts:16-31` says "becomes user input when TIMBER-1 grows its control panel").
- **Stages 10 (Roofing) and 11 (Siding/exterior) emit zero members** — the tool silently stops
  at sheathing; declared roles `brace`, `siding`, `sheathingPanel` are never emitted; no let-in
  bracing; corner post is end-stud + one extra, not the FM 5-426 3-stud assembly (self-flagged
  `walls.ts:6-7`); bird's-mouth is metadata, not notched geometry (`roof.ts:6-7`).
- **No member sizing logic** — girder fixed at 3-2x10, joists at 2x8; the design doc's
  Table 6-1 load-area method and Table 6-2 span checks are "pending" (`floor.ts:8-10`).
- **BOM gaps** — no nails-by-pounds, waste factors, stock-length optimizer, or roofing squares
  (all in design §5); labor is two bare constants pending Table C-1 (`bom.ts:45-48`).
- **No exports** — no job sheet, print, scenario save, or 2D plan/elevation/section pages;
  no semantic zoom, build-along mode, or layer system beyond the stage filter.

**`docs/EXECUTION_PLAN.md` deliberate cuts** (still standing, by decision): quiz/courseware,
full doctrine workbench (diff/sign-off), PDF/DXF export, URL/QR sharing, i18n, equipment
productivity curves, terrain/map integration, high-fidelity 3D for all positions, UI framework
rework, night/MOPP labor factors. Phase 6's squad battle-position sketch (2–9 positions with
interlocking sectors) was deferred. Cross-cutting sustainment items — publishing the standalone
build's SHA-256 per release, a changelog — have not started.

### 6F. Model-fidelity and structural gaps

Honest-but-thin places in the math (all currently flagged `approximate` in-app, which is the
designed mitigation — listed here because they bound what the tool can claim):

- **Labor is one flat base rate for all 10 positions** (4.0 MH + adders). A bunker and a
  one-man hole share a base. The fidelity flag says so; doctrine data would fix it.
- **Excavation ignores wall slope** (§6C-N8) — prism/cylinder/ramp models only.
- **Machine assist multiplies every stage's pace**, including camo and roof-building, in the
  scheduler; and the same factor also scaled the man-hours (§6B-3).
- **Scheduler is strictly sequential** — no overlap model; "continuous" camo is scheduled as a
  final block.
- **Mission rollup** sums `qtyPerPosition` across heterogeneous positions (admittedly
  informational) and drops validation (§6C-N11).
- **No structural checks** beyond the 3-row stringer span table: no soil bearing, no
  sandbag-wall stability, no revetment structural sizing; `retainingWall.thickness` is
  registered but unused (§6C-N6).
- **Sector azimuths** unvalidated (no left<right or wrap handling) and unset-able (§6C-N4).
- **No compile-time catalog safety**: position/soil/threat/revetment ids are bare `string`
  everywhere; invalid ids are runtime fallbacks. `Result.geometry` is typed `unknown` at the
  boundary and renderers cast.
- **`bunker_op_cp` spoil accounting** bills the full sandbag ring *and* charges the ring volume
  as fill demand — defensible (bags are filled from spoil) but undocumented, and it can trip
  `SPOIL_SHORT` surprisingly.

### 6G. Documentation drift and process debt

- **USER_GUIDE.md still describes the old topbar** ("Scenarios / Mission / Compare / Plan /
  Diag / Help buttons in the top bar") — the shipped UI is a hamburger menu + bottom toolbar.
  It also doesn't cover: the stage scrubber, cutaway, schedule tool, doctrine-values overlay,
  compare-across-standards preset, SVG download, the hub, or TIMBER-1. (2D plan P6, planned,
  unexecuted.)
- **Branding is inconsistent across four surfaces** (finding 117): the hub card says "SAP-1 ·
  Survivability Position Planner"; the page it opens (and the PWA manifest) titles itself
  "Fighting Position Planner"; the job sheet and diagnostics say "SAP-1 — Survivability
  Position Planner"; `package.json` says `sap1`; the hub says "Combat Engineer Toolkit."
  One name should win.
- **README describes the older static Replit deploy**, but `.replit` now uses
  `deploymentTarget = "autoscale"` with `serve.js` (§6C-N16).
- **Suite navigation is one-way** (finding 119): SAP-1 has no link back to the hub.
- **hub/woodframe pages hardcode a light palette** — no night mode outside SAP-1 proper
  (finding 141), which matters for a suite pitched partly on light discipline.
- **`.claude/launch.json`** has accreted 17 entries — most look like abandoned one-off QA
  sessions — including two that point at another machine's absolute paths
  (`/Users/zacharytraphagen/CommandHub-Led`). Harmless but stale.
- **Process debt:** the D29 SME structural checkpoint (ramp/berm/spoil/blade-hour models) is
  explicitly open; snapshot-regeneration discipline and per-release SHA-256 publishing are
  defined but not yet exercised; `props.html` exists only on the dev server (fine, but
  undocumented outside code comments).

---

## 7. Test and quality infrastructure

**35 test files, 192 subtests, 582 assertions, all green, ~5 s runtime** under `node:test` +
`tsx` (no test-framework dependency, no assertion library). The suite is unusually
adversarial: three checks are *source-scanning gates* (`number-free`, `offline`, and the
build-time `check-offline`), and several suites re-derive expected values independently
instead of trusting the engine's own helpers. The high-value properties pinned:

| Area | Files | What is locked |
|---|---|---|
| Engine math | `engine-formula`, `engine-audit-fixes`, `round`, `protection`, `snapshot` | §9 chain re-derived independently (incl. ramp + π/4 volumes), audit-fix regressions, rounding/NaN guards, resolveCover fail-safe paths, pinned default/engineered/count-scaling baselines |
| Honesty regime | `doctrine-integrity`, `formula-honesty`, `trust`, `number-free` | every leaf ships PLACEHOLDER; DOCTRINE+TODO-source rejected; fidelity statements present; no bare doctrinal decimals in engine math modules |
| Doctrine io | `doctrine-io`, `doctrine-refintegrity`, `schema-import` | round-trip, all-or-nothing, pollution/version/magnitude rejection, banner-clear end-to-end + re-lock, referential integrity between tables |
| Validation | `validate`, `catalog` | all 21 codes reachable, ordering, clear-state |
| Stages/schedule | `stages`, `plan-mission` | per-stage sums exactly equal totals; stage↔BOM partition; scheduler properties; mission merge + shortfall; planner ranking |
| 2D render | `render-nan`, `render-intuitive`, `fuzz` (3,000 seeds), `snapshot`, `a11y`, `units-format`, `range-card` | never throws/NaN across the input matrix; header/callout/legend consistency; no dimension collisions; min font; azimuth labels; degrees+mils; scale bar; SR descriptions; metric consistency |
| 3D descriptor | `scene3d`, `scene3d-stages`, `scene3d-terrain`, `prop-layout` | finite parts for every position×threat; engineered-roof never fabricates cover at any stage; stage filtering; terrain hole containment; bond math invariants |
| State/trust | `state`, `trust`, `offline`, `perf`, `determinism`, `layout-resolve`, `explain` | store/history behavior, panel-equals-trace consistency, export→import round-trips, session survives corrupt/hostile data, no network primitives in pure layers, 16 ms compute budget, byte-identical recompute, metric==imperial results, layout matrix, trace completeness |
| Timber | `timber-frame` (9/31), `timber-walls` (6/21) | frame determinism + 64-config no-NaN fuzz, posts reach grade, framing-square rafter re-derivation, stage-BOM board-feet partition, 2D/3D member parity, opening framing completeness, OC-spacing bound, <50 ms regen |

Plus three build gates: `tsc --noEmit` (extra-strict), `check-offline` (zero external URLs in
`dist/`), and the standalone inliner's own multi-page-fallback check.

**Coverage gaps worth knowing:**
- The three.js viewer (1,525 lines) and `main.ts` event wiring (764 lines) have **zero direct
  test coverage** — they're verified by live browser passes (per DECISIONS D21/D34, real bugs
  have been found exactly there: the `parseInt('0') || 6` stage-0 bug, the
  preserveDrawingBuffer blank-canvas bug). No E2E/browser automation exists. The audit plan's
  Phase 2/3 UX findings live precisely in this untested band.
- **The honesty gates don't cover `src/timber`** (§6C-N13) — number-free scans 9 engine
  modules, offline scans six directories, timber is in neither.
- The IndexedDB adapter is never exercised (tests use `MemoryAdapter` only); the service
  worker, hub page, and `woodframe-scene.ts` are untested; `layout/desktop|tablet|mobile`,
  `help.ts`, `diagnostics.ts` have no test imports.
- Schema migration is a single-version identity hook — no migration chain has ever been
  written or tested.
- The TIMBER-1 2D/3D parity assertion is weaker than it reads: `wallElevation`'s catch-all
  `else` classifies any unknown role, so a misclassified member still produces a rect and
  passes.

---

## 8. Recommended priorities

If the next effort is a fix pass, this order maximizes trust-per-hour (consolidations from the
audit plan, updated by what's already fixed):

1. **Ship-truth cluster (small, high visibility):** embed styles/colors into downloaded SVGs
   (§6B-1); print validation results on the job sheet (§6B-4); fix the explain-trace ramp
   omission (§6C-N1).
2. **Doctrine-fill correctness (the product's core promise):** stop snapshotting labor at
   module load (§6B-2); reject zero/relational-invalid divisor fills and check units
   (§6B-5); then the fill actually changes what compute says.
3. **Scheduler honesty:** remove the machine double-count (§6B-3) — the stand-to verdict is
   the flagship Phase-4 feature and it's currently up to 2.5× optimistic.
4. **Range card for real:** add the azimuth-of-fire / sector inputs (2D plan U1 + §6C-N4),
   fixing the absolute-vs-relative labeling (finding 40) in the same change.
5. **Extend the honesty regime to TIMBER-1** (§6C-N13): put its labor/sizing constants in the
   doctrine registry (or a TIMBER-1 registry counted by the same banner) and add `src/timber`
   to the number-free and offline gates — otherwise a completed SAP-1 fill clears a banner
   TIMBER-1 hasn't earned.
6. **Deploy hygiene:** hashed asset names (or automated cache-name bump) (§6B-9); scan
   `dist-woodframe/` in the offline gate + give it an index.html (§6B-11/12); typecheck all
   three Vite configs (§6B-13); register the SW / link the manifest from hub and TIMBER-1
   (§6C-N14); align README with the autoscale `.replit` (§6C-N16).
7. **The high-signal Phase-2 UX cluster:** overlay focus management, compute-error recovery
   loop, Ctrl+Z hijack, destructive-action confirms, two-tab session safety.
8. **TIMBER-1 inputs** — it's a demo until the building is parameterized (§6B-14).
9. **Then** the 2D realism remainder (R4–R9), the 3D stage-story polish, and — gated on a real
   doctrine fill — the deferred squad sketch.

Independent of code: **start a real doctrine fill** (even one table) to exercise the burn-down
path with a genuine publication pass, and **book the D29 SME structural review** for the
invented models.

---

## Appendix A — documentation index

| Doc | Role | Freshness |
|---|---|---|
| `README.md` | Product overview, warnings, run/build | Current |
| `USER_GUIDE.md` | Operator guide | **Stale in places** (§6G) |
| `DECISIONS.md` | D1–D35 decision log | Current through the suite build |
| `PLACEHOLDER_POLICY.md` | The provenance regime + fill procedure | Current |
| `DOCTRINE_SOURCES.md` | 295-leaf fill checklist | Current (regenerate after leaf changes) |
| `docs/EXECUTION_PLAN.md` | The executed 7-phase roadmap | Historical + cut list still governing |
| `docs/FULL_AUDIT_REMEDIATION_PLAN.md` | 155-finding defect backlog | **Active backlog** — see §6D for real status |
| `docs/2D_REALISM_AND_DEMO_PLAN.md` | 2D drawing truth plan | Phase 0 + R1–R3 done; rest open |
| `docs/REALISM_PASS_3D_PLAN.md` | 3D visual realism plan | Partially executed |
| `docs/ONE_MAN_POSITION_MODELING_SPEC.md` | Sourced hero-model spec | Unbuilt (deferred) |
| `docs/TIMBER1_3D_SYSTEM_DESIGN.md` | TIMBER-1 full design | Subset implemented |
| `docs/STATE_OF_THE_APP.md` | This audit | 2026-08-01 |
