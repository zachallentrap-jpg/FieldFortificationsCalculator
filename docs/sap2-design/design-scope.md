# SAP-2 — Scope & Sequencing: The Cut List and the Phase Plan (R0–R8)

> **Role:** Scope & Sequencing Assessor, SAP-2 blueprint. **Inputs:** the 2026-08-01 full audit
> (`docs/STATE_OF_THE_APP.md`), `DECISIONS.md` D1–D35, `PLACEHOLDER_POLICY.md`, the execution
> plan, the 2D realism plan, and `docs/ONE_MAN_POSITION_MODELING_SPEC.md`, all re-read against
> source. **Mandate:** ground-up rebuild; liability-minimizing architecture (owner enters every
> doctrinal value personally, air-gapped, with recorded provenance — the tool is never the source
> of a safety-of-life number); everything deterministic in the backend; output a recruit who
> hasn't finished forming week can follow; pick only what we can perform excellently, even if it
> takes a long time.
>
> **Legal note (non-negotiable in every downstream doc):** we design for liability minimization;
> we are not lawyers. Counsel/JAG review of the regime is a scheduled milestone (R1 exit), and no
> operator-filled data pack is distributed to anyone before that review. The architecture below is
> built to be maximally defensible, and to be adjustable where counsel directs.

**The two non-negotiables that govern every cut below:**

1. **The liability regime** — versioned data-pack schema, the Fill Station (operator data entry
   with provenance), and template mode (the tool demonstrably runs on marked non-doctrinal data
   until an operator pack backs it).
2. **The recruit-proof output path** — build cards plus the job sheet: a printed, picture-first,
   body-referenced sequence a Marine with no diagram training can execute.

Everything else is negotiable, and most of it gets cut or deferred. Fewer things, done
excellently.

---

## 1. Feature Disposition Table

Dispositions: **IN-v2-core** (in the R0–R3 spine), **IN-v2-later** (R4+ phases, real but not
spine), **OUT** (not in SAP-2; some carry explicit re-entry criteria). "Port" means the v1
subsystem is a proven asset we carry forward (see §2); everything ported is still rebuilt into
the v2 architecture — nothing is copied around the new type system or gates.

### 1a. The liability spine (new in v2)

| Capability | Disposition | Rationale |
|---|---|---|
| **Data-pack schema** (versioned, per-leaf provenance, SHA-256 manifest, attestation block) | **IN-v2-core** | Non-negotiable 1; evolves v1's `Provenance<T>`+io into the load-bearing artifact of the whole product. |
| **Fill Station** (operator entry workbench: blind entry, dual-entry for safety-critical, mandatory citation, relational validators, resume, per-position progress) | **IN-v2-core** | Non-negotiable 1; v1's minimal fill table proved the mechanism but was never exercised — v2 makes filling the owner's primary workflow. |
| **Template mode** (marked non-doctrinal template pack; diagonal watermark on every printed artifact; per-position readiness gates the un-watermarked print) | **IN-v2-core** | Non-negotiable 1; v1's plausible "illustrative" values behind one banner are a known build-to-it hazard — v2 makes template output unmistakably template. |
| **Per-position readiness** (an output is clean only when every leaf *that position consumes* is operator-filled) | **IN-v2-core** | Kills v1's all-295-or-nothing banner economics; the owner gets a usable one_man tool after ~½ the fill, and liability tracks the artifact actually printed. |
| **Pack diff** (compare two packs; show what changed between pub editions) | IN-v2-later | Real value for pub updates; not needed to reach the first real fill. |
| **Approval/sign-off workflow** (multi-party review chains) | **OUT** | One owner, one air-gapped machine; the attestation block + manifest hash is the audit story. Re-enter only if a second qualified filler ever exists. |
| **Doctrine leaves without consumers** | **OUT by gate** | v1 re-grew four dead leaves after purging them (§6C-N6); v2's consumer-coverage gate makes "registered but unused" a build failure, permanently. |

### 1b. Engine and data model (v1 §5 capabilities)

| Capability | Disposition | Rationale |
|---|---|---|
| Deterministic pure compute chain (inputs → geometry/BOM/labor/validation/derivations) | **IN-v2-core** | The product's spine; port the architecture, rebuild on typed ids and compute-time doctrine reads. |
| `resolveCover` single roof authority + engineered-roof fail-safe (AT/VBIED/unknown → zero fabricated thickness) | **IN-v2-core** | The single best liability feature v1 has; ported as a stated invariant, asserted at every stage in 2D, 3D, cards, and job sheet. |
| Threat model: class → specific munition (17 rounds) | **IN-v2-core** | Catalog structure is sound and proven; every magnitude is pack data. |
| Position catalog (10 types) | **IN-v2-later** | one_man only in the core spine (R2); breadth returns in tranches R4–R7, vehicles last (SME-gated). Fewer positions done excellently beats ten at v1 depth. |
| Validation catalog (21 codes, ordered, reachability-tested) | **IN-v2-core** | Ported; grown per position; rendered on *every* output by construction (fixes v1 §6B-4/N11 class). |
| Tap-to-explain derivations | **IN-v2-core** | The "the operator's number, our arithmetic" evidence trail; v2 generates traces from the same formula objects compute runs, so a trace can never lie again (fixes N1 class). |
| Stage decomposition with exact man-hour partition | **IN-v2-core** | Proven invariant (per-stage sums equal totals); becomes the backbone of the build cards. |
| Excavation model with wall batter in the volume math | **IN-v2-core** | v1's soil-invariant prism volume (§6C-N8) is a structural error in the tool's namesake number; v2 models batter from R2. Structure fix, not a constant. |
| Spoil balance, BOM (13 line kinds), labor + blade-hours axis | **IN-v2-core** | Core outputs; blade-hours ride with vehicle positions in R7. |
| Stand-to schedule clock (team/posture/machine → per-stage times) | IN-v2-later (R6) | Real field question, but a planning-layer feature; rebuilt with a single-owner machine-assist model (fixes the 2.5x double-count §6B-3 by construction). |
| Mission BOM rollup | IN-v2-later (R6) | Useful to a squad leader; rebuilt to merge on full item identity and to carry validation (fixes §6B-7, N11). |
| Inverse time-available planner (18-combo search) | **OUT** | Its scoring weights are invented magnitudes outside provenance (§6C-N7) — exactly what v2 forbids; low usage value per complexity; search space explodes with breadth. |
| Side-by-side compare + compare-across-standards preset | **OUT** | Instructor nicety, not the builder's path; every removed surface is retained-DOM and test surface we don't spend. |
| Radiation-halving / CBRN readout | **OUT** | v1 wired it mainly to give 9 leaves a consumer; in v2 the leaves leave with the feature. Re-entry: only with a real CBRN scope decision and pack data. |
| `firingStep` input | **OUT** | Near-no-op in v1 (§6C-N9) and the one-man spec §2.f says a raised step is *wrong* for the flagship position. Inputs that don't change the build are not inputs. |

### 1c. Outputs — the recruit path (2D, 3D, print)

| Capability | Disposition | Rationale |
|---|---|---|
| **Build cards** (per-stage, picture-first, body-referenced step cards; on-screen step-through synced to the 3D scrubber; printable deck) | **IN-v2-core** | Non-negotiable 2; this is the product the recruit holds. New in v2; fed by the ported stage partition. |
| Job sheet (drawings + specs + BOM + labor + validation + stage table + field header + signature + pack provenance footer + card deck) | **IN-v2-core** | The document the platoon owes the company; v2 assembles it from the complete `Result`, so omissions like v1's missing validation block become impossible by construction. |
| 2D plan + section, per-shape truth | **IN-v2-core** | Port the projector/callout architecture; single shape model lives in engine geometry, renderers only project (ends v1's plan/section/iso disagreement class). |
| Range-card layer **with real azimuth inputs** (absolute azimuths, degrees + mils, FPL for MG) | **IN-v2-core** | The layer shipped in v1 but no input ever set it (§6C-N4) — a fake range card is worse than none. Input and layer land together in R2. |
| Per-drawing SVG export, self-contained | **IN-v2-core** | Ported with the print-token lesson generalized: every exported artifact embeds its own styles, enforced by gate (fixes the black-SVG class §6B-1 permanently). |
| CSV export (BOM) | IN-v2-later (R6) | Supply-shop value; rebuilt with formula-injection hardening (v1 finding 39). |
| 2.5D iso schematic (no-WebGL fallback) | **OUT** | Shape-blind in v1 and never fixed; the fallback is plan+section side by side. A wrong drawing is worse than no drawing — v1's own 2D plan said so. |
| 3D diorama engine (terrain with true holes, per-soil surfaces, sky, shadows, instanced bonded bags, tiered post pipeline + watchdog) | **IN-v2-core** | v1's comprehension crown jewel and a proven asset; ported nearly wholesale (§2 A1). |
| Construction-stage scrubber + cutaway | **IN-v2-core** | The teaching mechanism the cards sync to; stage-filtered scene descriptor is node-tested and proven. |
| one_man hero model per `ONE_MAN_POSITION_MODELING_SPEC.md` (bond-true bags, full OHC stack, elbow shelf, stakes, posed figure) | **IN-v2-core** | v1 deferred it (D34/D35); in v2 it *is* the R2 flagship — the best-sourced position gets the excellent treatment first. §4-quarantined values render with visible placeholder notes. |
| High-fidelity 3D for all positions | **OUT** | Hero treatment for one_man (later mg_crew at most); others inherit the good generic diorama. v1's cut, still right. |
| GLB prop pipeline (Blender-authored, unit-normalized, data-URI inlined) | **IN-v2-core** | Ported; pipeline paths fixed so it runs on this machine (v1 §6C-N15); plywood.glb gets wired by the hero OHC stack or deleted. |
| Stage-aware 2D section (dashed not-yet-built overlay) | IN-v2-later | Nice teaching echo of the scrubber; cards + 3D carry the load first. |
| ATGM backblast cone on plan (U4) | IN-v2-later (R5) | Lands with the atgm_javelin position, not before. |

### 1d. App shell, state, distribution

| Capability | Disposition | Rationale |
|---|---|---|
| Retained-DOM UI shell (create-once/update components; no innerHTML full re-render) | **IN-v2-core** | The architectural fix for v1's biggest self-inflicted wound (§2 M1); budgeted honestly as its own workstream. |
| Guided start (3–5 canonical presets: "rifleman, hasty", "MG, deliberate + OHC"...) | **IN-v2-core** | The untrained user's on-ramp; replaces landing cold on 16 controls. Small, high leverage. |
| Plain-language-first labels + hints (doctrinal term in parentheses) | **IN-v2-core** | Proven invariant (D23); carried as a stated v2 invariant with the same test style. |
| Metric/imperial display-only conversion | **IN-v2-core** | Solved and test-locked in v1; cheap to carry, real field value. |
| Session persistence (inputs survive tab eviction), single-tab guard | **IN-v2-core** | Don't lose work; v2 adds the two-tab clobber fix v1 deferred (findings 68–69). |
| Undo/redo | **OUT** | Marginal over ~16 dropdown inputs + session restore + reset; v1's global Ctrl+Z hijack (finding 54) shows the cost. Fill Station has its own draft persistence instead. |
| Saved scenario library (IndexedDB CRUD) | IN-v2-later (R6) | A leader tool, not the recruit path; session restore covers the spine until then. |
| Day/night theme | IN-v2-later (R6) | Light discipline is real, but core ships day-only + print; night lands with the field kit, tested on every surface at once. |
| Diagnostics/status panel (versions, pack hash, readiness counts, last error) | **IN-v2-core** | Cheap trust furniture; the pack hash on screen is part of the provenance story. |
| Error boundary (degrade to error card, never white-screen) | **IN-v2-core** | Ported; plus the rAF-loop recovery fix v1 deferred (findings 51–53). |
| A11y floor (skip link, focus management, sr-status, keyboard paths) | **IN-v2-core** | Retained DOM makes real focus management possible for the first time; overlay focus traps in core, not backlog. |
| Single-file `file://` artifact + published SHA-256 | **IN-v2-core** | The air-gap distribution unit — the owner's fill machine and the field machine both live here. Hash publication is part of the liability story. |
| Installable PWA + service worker | IN-v2-later (R6) | 5 of v1's 17 critical findings were SW bugs; v2 ships file-first, adds the SW later on hashed assets with a generated precache. |
| Responsive layouts | **IN-v2-core, simplified** | One adaptive layout with two breakpoints, one DOM — not three hand-maintained arrangements. |
| Help drawer | IN-v2-later | Written after the cards exist; guided start absorbs most first-run need. |
| URL-shareable state | **OUT, permanently** | State-in-URL is an exfiltration channel for operator data and contradicts "data never leaves the device." v1 cut it as a distribution problem; v2 cuts it as a liability decision. |
| Quiz/courseware, PDF/DXF export, i18n, terrain/map integration, equipment productivity curves, night/MOPP labor factors | **OUT** | v1's cuts, all still correct; print-to-PDF via the browser covers the PDF ask. |
| Squad battle-position sketch (2–9 positions, interlocking sectors) | IN-v2-later (R8) | The best breadth idea in the backlog, but it needs real azimuth inputs, real packs, and mission rollup first. Last phase, optional. |
| Protective wire module | **OUT** | Re-entry criteria: after R7, with pack data, if the owner still wants it. |
| Hub / multi-tool suite page | **OUT** | SAP-2 is one product with one name. See §5. |
| TIMBER-1 | **OUT of SAP-2** | Frozen in the v1 repo; explicit re-entry bar in §5. |
| Props gallery (dev page) | **OUT of product** | Lives on as an unbuilt dev page in the v2 repo if useful; never in a build. |

---

## 2. What v1 Taught Us

v1 is a successful prototype with a genuinely excellent test culture and five or six subsystems
worth porting almost intact — wrapped in an app-shell architecture we should not carry forward.

### 2a. Proven assets to port (with receipts)

| # | Asset | Evidence it earned the port | How it serves v2 |
|---|---|---|---|
| A1 | **Diorama engine** (`src/ui/engine/`: palette, deterministic canvas textures, terrain crust with true holes, painted sky, tiered post pipeline with frame-time watchdog, `SandbagBatcher` instancing) | Verified live across 10 positions × 8 soils; the watchdog/tier system is a working perf governor | The comprehension centerpiece; R2 hero model builds on it rather than restarting 3D |
| A2 | **Prop layout math** (`src/render3d/propLayout.ts` — bag grid, running-bond and header/stretcher courses) | Pure, node-tested, deterministic (hash jitter, never `Math.random`) | Feeds the bond-true hero walls (spec §2.b: header bottom/top courses, staggered joints, 1:4 batter) |
| A3 | **Pure scene-descriptor seam** (`scene3d.ts` builds a part list with zero three.js imports; `three-viewer.ts` is the only three consumer, D20) | Lets 3D honesty invariants run under `node:test` (engineered roof never fabricates cover at any stage) | v2 keeps the exact seam; the stage/cutaway options ride the descriptor |
| A4 | **2D render system** (one projector per view, `guard()` throws on non-finite, callout/legend shared registry, chrome primitives) | NaN-matrix + 3,000-seed fuzz + intuitive-conventions suites all green; legend cannot drift from drawing by construction | Ported as the drawing substrate for plan/section/range card and card illustrations |
| A5 | **Stage partition** (`engine/stages.ts`: per-stage man-hours exactly partition the total, invariant-tested; stage↔BOM map) | The one v1 feature that already thinks like a build card | Becomes the card deck's spine and the schedule's input in R6 |
| A6 | **IO hardening patterns** (`doctrine/io.ts`: all-or-nothing apply, dry-run, prototype-pollution rejection, version gate, DOCTRINE-with-TODO-source rejection, deterministic manifest hash; boot re-validation through the same importer) | Test-backed end-to-end banner-clear and re-lock | Direct ancestor of the pack loader; v2 adds unit checks, zero/divisor and relational validation (fixes §6B-5), SHA-256, attestation |
| A7 | **`resolveCover` single authority + fail-safe** (`engine/protection.ts`) | Honored consistently by BOM, labor, explain, 2D, 3D at every stage; fuzz-locked | Ported as v2 Invariant 1; extended to cards ("this roof is engineer-designed — stop and get one") |
| A8 | **Provenance regime** (`Provenance<T>`, `P()`, registry, counts-driven banner; PLACEHOLDER_POLICY) | The core idea is right and test-enforced | Evolves into the pack schema; status set grows (`TEMPLATE` / `OPERATOR`), banner logic becomes per-position readiness + watermark |
| A9 | **Adversarial test culture** (source-scanning gates `number-free`/`offline`, independent re-derivation, reachability tests, snapshot discipline, 192 subtests in ~5 s with zero test-framework deps) | It caught real bugs continuously; it is why v1's engine is trustworthy at all | v2 keeps the culture and adds gates: consumer-coverage, print-self-containment, template-watermark, browser smoke |
| A10 | **Print-token self-containment** (`render/print-tokens.ts`, D14) | The one export path that embedded its own styles is the one that never rendered black | Generalized: *every* exported artifact carries its own styles; enforced by gate, not memory |
| A11 | **Persistent-canvas attach pattern + `preserveDrawingBuffer` lesson** (D21) | Hard-won knowledge about WebGL context survival and buffer readback | Seed of the retained-DOM component contract (create once, re-attach, update) |
| A12 | **Plain-language-first labeling** (D23) and **body-referenced doctrine framing** (modeling spec: armpit-deep, helmet-length setback, e-tool-sized sump) | Doctrine itself measures in body units — that is the recruit-proof measurement language | Cards speak body-first ("dig until the ground hits your armpit"), numbers second |
| A13 | **Zero-dep calc core discipline** (doctrine/engine/state run under `node:test`, `three` confined to one file) | The reason 192 tests run in 5 s and the engine is auditable | Unchanged in v2 |
| A14 | **Error containment** (`errorBoundary.ts` safeCompute/safeRender, `round.ts` NaN containment) | Fuzz: never throws, never NaN across the whole input space | Ported, plus recovery-loop fix |

### 2b. Mistakes not to repeat (each becomes a v2 rule with an enforcement mechanism)

| # | v1 mistake | Receipt | v2 rule (and how it's enforced) |
|---|---|---|---|
| M1 | **innerHTML full-shell re-render** — `app.innerHTML = renderApp(...)` on every input (`ui/main.ts:236`); forced canvas re-parenting, focus/scroll restoration hacks, camera-state workarounds (D21), and made real focus management "backlog" | `main.ts:207,236`; findings 62/64 | Retained DOM: components with `create/update/destroy`, data flows through typed view-models; no HTML-string layouts. Enforced by architecture review + a lint ban on `.innerHTML` outside sanctioned leaf helpers |
| M2 | **Bare-string ids** for position/soil/threat/revetment; `Result.geometry` typed `unknown`, renderers cast | audit §6F | Ids are string-literal unions generated from the catalog source; `Result` fully typed end-to-end. Enforced by typecheck — invalid id is a compile error, not a runtime fallback |
| M3 | **Module-load snapshots of doctrine** — `const baseLabor = { baseMH: laborDoctrine.baseMH.value, ... }` at module scope silently ignores an applied fill (`engine/compute.ts:371`) | §6B-2 | All leaf reads happen at compute time through one accessor. Enforced by a source-scan gate: `.value` reads on pack leaves are illegal outside the accessor module |
| M4 | **Out-of-gate subtrees** — number-free scans 9 engine modules, offline scans 6 directories; `src/timber` sat in neither, so a full SAP-1 fill would clear a banner TIMBER-1 never earned | §6C-N13; `test/number-free.test.ts:11` | Gates cover `src/**` by default with explicit, justified exclusions — new code is born inside the regime. Enforced by the gates themselves |
| M5 | **Hashless assets + fixed cache name** pin returning users to stale deploys | §6B-9; `vite.config.ts:46-48` | Content-hashed filenames from R0; when the SW arrives (R6) its precache manifest is generated, never hand-listed |
| M6 | **Registered leaves without consumers** — verification make-work re-grew after being purged | §6C-N6 | Consumer-coverage gate: every leaf maps to ≥1 consuming code path and every doctrinal magnitude in code maps to a leaf; zero-orphan is a build failure |
| M7 | **Invented magnitudes outside provenance** — planner weights (`engine/plan.ts:36-43`), drawing-layer magic numbers (sump notch, arm fractions) | §6C-N7; 2D plan R6 | Every magnitude is (a) an exact physical constant, (b) a pack leaf, or (c) absent. The number-free gate covers all of `src/**` (see M4) |
| M8 | **Shape knowledge duplicated across renderers** — plan branched partially, section not at all, iso never; engine and drawings disagreed on the firing platform (§6B-8) | 2D plan Phase 1 preamble | One shape model in engine geometry (including platform semantics: the MG platform is an undug bench, matching doctrine and the drawings — SME-flagged); renderers project, never invent |
| M9 | **Hand-written explain strings drifting from compute** — the vehicle trace omitted the dominant ramp term | §6C-N1 | Derivations are generated from the same formula objects compute executes; a formula string that isn't executed cannot exist |
| M10 | **Outputs that omit what the app knows** — job sheet printed clean while validation flagged errors; mission rollup dropped warnings | §6B-4, §6C-N11 | Output completeness rule: every artifact renders from the full `Result`, and a gate asserts validation presence on job sheet, cards, and any rollup |
| M11 | **The untested band where the bugs lived** — `three-viewer.ts` (1,525 lines) and `main.ts` (764) had zero coverage; the stage-0 `parseInt('0') || 6` bug and blank-canvas bug both lived there | audit §7 | v2 keeps view logic thin over pure view-models (testable), and adds a small Playwright smoke gate (boot, input change, print, 3D attach, fill flow) — the band is small and covered |
| M12 | **Doc and brand drift** — four names across four surfaces; USER_GUIDE describing a dead UI | §6G | One name everywhere (working name "SAP-2"; the owner may rename once, globally); user-facing docs regenerate from the same catalogs where possible; a freshness check rides release |
| M13 | **Suite before product** — hub + TIMBER-1 landed while SAP-1 carried 12 open critical findings and zero real doctrine | §6D, timeline wave 5 | No second product, no hub, until SAP-2 is done and filled (§5) |
| M14 | **Plausible placeholder values behind one banner** — "illustrative" numbers that look real enough to build to | PLACEHOLDER_POLICY; D31 | Template mode: template-backed prints carry an unmissable diagonal watermark; safety-critical spec rows carry `(T)` flags; the un-watermarked artifact exists only under a complete operator pack for that position |

---

## 3. Phase Plan R0–R8

**Rules of the plan.** Every phase ends as working, verifiable software behind green gates — the
project can pause at any R-boundary and still leave a coherent tool (this is also the long-timeline
mitigation). Effort is relative: S = days, M = 1–2 weeks, L = 3–6 weeks, XL = 6–12 weeks of
focused work; calendar time may stretch — quality is the constraint, not the calendar. The
liability spine ships first (R0–R1), the recruit output second on exactly one position (R2–R3),
breadth only after both are proven.

**The gate set (referenced as "all gates green" throughout):**

- **G1 typecheck** — strict + v1's extra flags, covering every config and script.
- **G2 tests** — `node:test` unit/property/fuzz suites, including independent re-derivation.
- **G3 number-free** — no bare doctrinal magnitudes anywhere in `src/**` (exclusions listed and justified).
- **G4 offline** — no network primitives or external URLs in `src/**` and in **every** build output directory.
- **G5 consumer-coverage** — zero pack leaves without a consumer; zero doctrinal magnitudes without a leaf.
- **G6 print-self-containment** — every exportable artifact renders standalone (embedded styles, no `var()` without a style block, no external refs); golden-render check.
- **G7 template-watermark** — any artifact computed with ≥1 template leaf for its position renders the watermark; asserted across the output matrix.
- **G8 determinism** — byte-identical `Result`, drawings, cards, and job sheet for identical inputs + pack.
- **G9 perf budgets** — compute ≤16 ms, scene descriptor ≤50 ms, instanced hero build within its budget, no-idle render loop fixed (v1 findings 73–74).
- **G10 browser smoke** — small Playwright pass over the untestable rim: boot, input change, print path, 3D attach/detach, fill-station happy path + rejection path.

### R0 — Foundations and the liability schema (M)

Fresh repo, the architecture, and the data regime — before any feature.

- Typed catalogs (positions/soils/standards/threats/revetments as literal unions generated from
  one source of truth); `Result` typed end-to-end.
- **Pack schema v1**: per-leaf `{path, value, unit, status: TEMPLATE|OPERATOR, source citation
  (pub, edition/date, para/page), safetyCritical, enteredBy, enteredAt (operator-typed DTG),
  note}` + pack header `{schemaVersion, packId, created, attestation text}` + **SHA-256
  manifest**. Loader ports every A6 hardening and adds unit checks, zero/divisor rejection,
  relational validators (sums-to-1, monotonic-with-caliber).
- Template pack (plausible-scale geometry so drawings demonstrate; every leaf `TEMPLATE`).
- Registry with **consumer map**; gates G1–G8 stood up (G6/G7 against stub outputs).
- Engine skeleton: one_man compute chain (geometry incl. wall batter, BOM, labor, validation,
  derivations-from-formula-objects, stage partition) under the full test culture.
- Retained-DOM shell walking skeleton: guided start stub, inputs region, specs panel, status
  panel with pack hash + readiness counts. This is also the retained-DOM de-risking spike.

**Acceptance:** all gates green; template pack round-trips (load → export → load, hash stable);
a deliberately corrupt pack is rejected all-or-nothing with reasons; one_man compute matches
independently re-derived values; watermark logic proven by test; the shell runs with no
`innerHTML` full re-render.

### R1 — The Fill Station (L)

The owner's tool. Ships before any drawing so the real fill can start at the earliest possible
moment — fill is the schedule's long pole and the product's entire value.

- Per-leaf entry: **blind entry** (the UI never displays a template magnitude as a default or
  suggestion in the fill flow — the operator types every number), **dual entry for
  safety-critical leaves** (typed twice, must match), mandatory citation fields, unit shown and
  locked, relational/monotonic validators run live.
- Organized by table and by **position readiness** ("one_man needs 143 leaves; 96 remain" —
  exact count fixed when the leaf set freezes); resumable drafts (local, device-only); progress
  view; dry-run diff before apply; apply is all-or-nothing.
- Pack build: manifest SHA-256, attestation block the operator signs by typing their name and
  DTG; export to file; import re-validated through the same loader on every boot (A6 pattern).
- Re-lock semantics defined now: a schema adding leaves after a fill shows "N new values since
  pack `<hash>`" distinctly from never-filled.
- **Counsel package**: a short architecture memo (blind entry, dual entry, provenance, watermark,
  fail-safe, no-network gates, hash-attributable outputs) prepared for JAG/counsel review.

**Acceptance:** scripted end-to-end — fill every one_man-consumed leaf via the real UI flow
(automated driver) → one_man readiness reaches zero-remaining → un-watermarked output unlocks
for one_man only; rejection paths (mismatched dual entry, missing citation, zero divisor, unit
mismatch, relational violation) each surface a reason and apply nothing; drafts survive reload;
G10 covers the fill happy path and one rejection. **Counsel review is scheduled at R1 exit; no
operator pack is distributed to anyone before it returns.**

### R2 — The one_man vertical slice (XL) — **the proof milestone**

One position, end to end, at full quality. **Definition of the slice, precisely:**

- **Schema:** the complete one_man leaf set frozen (all leaves it consumes across protection ×
  17 threats, soils, standards, materials, labor, stages), every leaf consumer-mapped (G5).
- **Engine:** deterministic one_man compute across 17 threats × 8 soils × 3 standards × 5
  revetments; `resolveCover` fail-safe; fuzz/NaN clean; exact stage partition; derivations for
  every displayed number.
- **2D:** plan + section with per-shape truth, fit-to-content, callout/legend registry, real OHC
  build-up in section (stringers at true count/spacing, sheathing/dustproof/earth bands —
  v1's R4), soil batter + revetment visible (v1's R5), **range card with real azimuth input**
  (absolute azimuths, degrees + mils, north arrow, scale bar); self-contained SVG export.
- **3D:** the hero model per `ONE_MAN_POSITION_MODELING_SPEC.md` on the ported diorama engine —
  header/stretcher bond at true bag proportion, full OHC stack (supports/stringers/dustproof/
  burst cap/waterproof), elbow shelf + sector/aiming stakes, posed figure at armpit depth,
  stage scrubber + cutaway; spec §4 quarantined values render with visible placeholder notes;
  honesty invariants asserted at every stage.
- **Build cards:** the full one_man deck (~12–18 cards over the doctrinal stages, one task per
  card): a picture generated from the same geometry (2D cut or 3D stage snapshot), a plain-words
  instruction, only the numbers that step needs, the body-referenced check ("stop when the
  ground is at your armpit"), tools/materials for the step, and a "you are done when" check.
  On-screen step-through synced to the 3D scrubber; printable as a deck.
- **Job sheet:** drawings + inputs + specs + BOM + labor + **validation results** + stage table +
  field header + signature block + pack provenance footer (hash + attestation) + the card deck
  as pages.
- **All gates green (G1–G10)**, in template mode and against a synthetic complete one_man pack.

**Acceptance:** the slice demo — open app, guided start, set azimuths, walk the cards on screen
with the 3D model building stage by stage, print the watermarked template job sheet + deck;
switch to the synthetic operator pack and print the clean version; every gate green. Exit
criterion: **the owner can now begin (or continue) the real one_man fill against working
software** — the first genuine publication pass (the thing v1 never had) is unblocked.

### R3 — Comprehension trial and output hardening (M)

The recruit bar is tested, not assumed.

- **Comprehension protocol:** 5 diagram-naive testers (non-military acceptable for layout-following;
  a Marine cohort when available), each given only the printed deck + job sheet (template
  watermark on), asked to stake out and mock-build the position (tape/sandtable scale build);
  scored per card: completed without help / needed help / wrong result.
- Card iteration from findings; a11y floor pass (focus traps in overlays, keyboard-complete,
  sr-status); print polish (page breaks, ink-safe patterns); single-file `file://` artifact +
  SHA-256 publication + a signed-hash release note; USER-GUIDE v2 written against the shipped UI.

**Acceptance:** ≥4 of 5 testers complete the walk-through with no wrong-result cards (needing
help is a finding; wrong result is a failure); two consecutive protocol runs without a
category-1 misread; artifact runs from `file://` on a clean machine; docs match the UI.

### R4 — Breadth I: two_man, mg_crew (L)

Widen only after the slice is proven. Each new position is a **mini-slice**: leaf set frozen and
consumer-mapped, engine + 2D + generic-diorama 3D + cards + job sheet, auto-enrolled in the full
fuzz/NaN/fail-safe/watermark matrix (registry-driven tests, v1's D35 pattern). two_man first
(doctrinally best-sourced sibling — FM 21-75 gives its dimensions), then mg_crew (platform
semantics per M8, FPL on the range card, crew-served card patterns).

**Acceptance:** the position matrix tests extend automatically; per-position readiness math
correct (a filled one_man stays clean while mg_crew is template); comprehension spot-check on
mg_crew's novel cards (platform, T-shape, gun-laying steps).

### R5 — Breadth II: fifty_cal, mortar_pit, connecting_trench, atgm_javelin, bunker_op_cp (L)

Same mini-slice bar. Position-specific truths carried from v1's lessons: π/4 mortar volume,
open-corridor trench (no ENEMY ring), ATGM backblast cone + rear-clearance validation and card
warning, bunker spoil accounting documented. mortar+OHC contradiction and similar
feature-combination advisories included per position.

**Acceptance:** matrix green across 7 positions; every position's cards reviewed against its
doctrine section; no position ships without its validation advisories rendering on cards and
job sheet.

### R6 — The planning layer and the field kit (M)

Leader features and distribution polish, all rebuilt on v2 rules:

- Stand-to schedule (machine assist owned by exactly one term — fixes the 2.5x optimism class),
  job-sheet schedule page; mission BOM rollup merging on full item identity and carrying
  validation; saved scenario library; CSV export (injection-hardened); night theme across all
  surfaces; PWA with generated precache on hashed assets.

**Acceptance:** schedule property tests (halving diggers ≥ doubles elapsed; machine factor
applied exactly once, asserted); rollup preserves worst-severity validation per position;
offline gate covers the PWA output; night-theme contrast checked.

### R7 — Vehicle positions, SME-gated (L)

`vehicle_hull_defilade` and `vehicle_turret_defilade` enter **only after** a qualified SME
reviews the structural models (ramp geometry, berm sizing, spoil balance, blade-hours) — the D29
debt v1 never paid. Blade-hours on their own axis; machine-required validation; hull-silhouette
drawings from v1's R1 carried forward; vehicle card decks are ground-guide-centric.

**Acceptance:** SME review logged with name/date in the decision log before merge; the invented
models either confirmed or corrected; matrix green across 9 positions.

### R8 — Squad battle-position sketch (L, optional)

2–9 saved positions with interlocking sector wedges over mission rollup; printable squad sector
sketch. Gated on: real packs in use, azimuth inputs proven in the field, R6 rollup shipped.
This phase is option value — the plan is complete without it.

**Acceptance:** sketch is a pure function of saved scenarios + azimuths; interlock/gap advisories
test-locked; print output passes G6/G7.

---

## 4. Risks and Kill Criteria

Top 10, each with a detection signal and a mitigation. Kill criteria are explicit — adjust or
stop rules, not vibes.

| # | Risk | Detection signal | Mitigation | Kill / adjust criterion |
|---|---|---|---|---|
| 1 | **Fill fatigue** — the owner burns out entering hundreds of leaves with citations and dual entry | Fill Station's local progress stats: leaves/session trending toward zero; one_man readiness stalled for 4+ weeks after R1 ships | Per-position readiness makes ~half the total fill deliver a usable product; fill order sorted by consumer impact; resumable drafts; sessions sized to ~20 leaves | If one_man fill is <50% after 8 active weeks: drop dual entry to safety-critical-only spot-check (10% re-entry), and re-review the leaf set for consolidation. The regime bends on ceremony, never on citation |
| 2 | **Card comprehension failure** — diagram-naive users can't follow the deck | R3 protocol: <4/5 completion, or any wrong-result card surviving a redesign round | Body-referenced measures, picture-first layout, one task per card, iterate against observed misreads | After 2 full redesign rounds still failing: re-scope the audience floor to "any Marine with a fire-team leader present," keep the cards, log the re-scope. The product survives; the claim shrinks honestly |
| 3 | **Retained-DOM underestimate** — the component layer costs far more than budgeted | R0 shell >150% of budget; recurring update-drift bugs (view not matching view-model) in R2 | R0 walking skeleton is the de-risk spike; component contract kept tiny (create/update/destroy); view-models pure and tested; coarse region re-render as sanctioned fallback for cold surfaces | If R2 UI work overruns 2x: adopt coarse-region rendering everywhere except the three hot surfaces (inputs, cards, 3D socket) and record the boundary in the decision log |
| 4 | **Scope creep back to v1 breadth** — ten positions and five tools reappear at prototype depth | Any work item that maps to no phase and no disposition row; disposition table amended more than once per phase | This document is a gate artifact: PRs cite their phase; OUT-list reread at every phase start; "new feature" requires a written amendment here first | Two unmapped features merged in one phase = stop, re-baseline the phase against §1, revert what doesn't map |
| 5 | **Liability architecture fails counsel review** | R1-exit counsel milestone returns material objections | Review scheduled early (before breadth spend); the adjustable knobs — watermark text, attestation wording, blind/dual entry, CUI markings — are all data/config, not architecture | If counsel says the operator-pack concept itself is indefensible: freeze the Fill Station, ship template-only as a training tool, and stop breadth work pending re-design. That is a real stop condition |
| 6 | **SME unavailability** — structural models never get expert confirmation | R7 gate slips ≥2 quarters; no reviewer identified by R5 exit | Sequence puts best-sourced positions first (one_man has a sourced spec; two_man has FM numbers); vehicles — the invented-structure positions — are last and hard-gated; fidelity flags on everything approximate | No SME by R7: vehicles stay out of the product. Shipping 7 honest positions beats 9 with unconfirmed structure |
| 7 | **3D cost on real devices** — the hero diorama is too heavy for old phones | G9 budget test; watchdog tier-down logs on 3 reference devices (one old Android) | Tiered post pipeline and instancing are ported, proven governors; cards and 2D never depend on 3D; 3D is progressive enhancement | If the hero model can't hold the budget at lowest tier: ship the generic diorama on mobile and the hero on desktop — never let 3D block the card path |
| 8 | **Print-artifact fidelity regressions** — the black-SVG class returns in a new costume | G6 golden-render + self-containment scan failing, or any field report of a wrong/blank printout | Self-contained-by-construction outputs (A10 generalized); G6 in place from R0; print checked in the R3 protocol on paper, not just screen | Any G6 escape reaching a user = stop-the-line fix + a new gate case before further feature work |
| 9 | **Pack/schema churn after real fills** — leaf set changes strand the owner's completed work | Migration test failures; "N new values since pack `<hash>`" > 0 at a release without a migration note | Leaf set per position freezes at its mini-slice; additive-only after R2; versioned migration chain tested with real packs from R2 onward; re-lock semantics defined in R1 | A release that would orphan >5% of a real pack's leaves doesn't ship until a migration carries the fill forward |
| 10 | **Operator data-entry error survives the regime** — a wrong number typed twice with a citation | Relational/monotonic validators firing in review (bigger caliber ⇒ ≥ thickness/standoff, v1's D16 lock, now a fill-time check); spot-audit discrepancies | Dual entry, live relational checks, per-table review pass in the Fill Station, spot re-verification workflow against the pub | None — this risk is *why* the tool never claims verification. The operator owns truth; the tool records provenance and enforces consistency. Any drift toward "the tool validates doctrine" language is itself reverted on sight |

**Global kill criteria (product-level):**

- **K1 (liability):** counsel review concludes the operator-pack architecture cannot be made
  defensible → template-only training tool; no operator path ships.
- **K2 (comprehension):** the R3 bar is unreachable after two redesign rounds → audience
  re-scope per risk 2; if even leader-mediated use fails the protocol, the card product is
  wrong and R4+ pauses for a redesign.
- **K3 (the v1 failure mode):** the Fill Station ships and no real fill has *started* within 8
  weeks → freeze all breadth work; the only allowed work is whatever removes the owner's actual
  obstacle to filling. An unfilled SAP-2 is v1 with better architecture — not the mandate.

---

## 5. TIMBER-1 Disposition and the Hub/Suite Story

**TIMBER-1: OUT of SAP-2. Frozen with v1.** The wood-frame engine is real, credible work (777
pure, node-tested lines; framing-square rafter math; 11-stage model) — and it is also a demo
with no inputs (`ui/woodframe-scene.ts:16-31`), two silent empty stages, invented labor
constants, and it sits entirely outside the honesty regime that defines this product (§6C-N13:
filling all 295 SAP-1 leaves would clear a banner TIMBER-1 never earned). Decision:

- TIMBER-1 stays in the v1 repository, frozen and clearly marked as a demo. It is not ported,
  not linked from SAP-2, and receives no feature work during R0–R7.
- Its **re-entry bar** (if the owner wants it back, post-R5 at the earliest): user inputs exist;
  every magnitude is a pack leaf under the same schema, gates, and per-readiness rules; its own
  card/job-sheet output path meets the same G-gates. Same regime or no ride.
- The lumber/plywood GLB assets and the Blender pipeline are shared property and port to SAP-2
  in R2 (with the machine-locked `OUT_DIR` fixed).

**The hub: OUT. SAP-2 ships as one product with one name.** v1's suite (hub + ghost card +
one-way navigation + four competing brand strings) was breadth before depth — M13. For v2:

- One entry point, one name used everywhere (working name **SAP-2 — Survivability Position
  Planner**; if the owner renames it, the rename is global and once).
- The suite concept is not dead, it is **earned**: a hub page returns only when a second tool
  exists that passes the full SAP-2 regime — which per this plan is no earlier than post-R7.
  Until then a hub is navigation to nowhere.
- v1 remains available as reference during the build and is marked superseded when R3 ships the
  first distributable SAP-2 artifact.

---

## 6. Closing Statement of Bias

Where this plan had a choice, it chose: fewer positions before more (one, then two, then seven,
then nine); outputs before tools (cards and job sheet before schedules, rollups, and compares);
the owner's fill workflow before any drawing (R1 before R2); structure fixes promoted into the
rebuild (wall batter, platform semantics, single shape authority) over carrying flagged
approximations; and three permanent deletions that will sting someone someday (URL sharing, the
iso view, the inverse planner) because each one either leaks data, lies, or smuggles invented
numbers. The two things this plan will not trade under any pressure are the ones the mandate
names: the operator-owned data regime, and an output a recruit can follow.

