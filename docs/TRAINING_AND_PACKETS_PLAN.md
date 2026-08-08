# TRAINING & COMMAND-PACKETS PLAN — Toolkit Expansion

> **Status:** binding synthesis of four commissioned designs (`design-flashcards.md`,
> `design-training.md`, `design-packet.md`, `design-platform.md`). PLAN ONLY.
> Implementing sessions execute phases F0–F10 without the planner present.
> Quality bar, effort scale, branch discipline, descope-ladder and DoD conventions:
> `docs/TIMBER2_PLAN.md` §7/§10, verbatim.
>
> **Governing plans win.** Where this document and `docs/TIMBER2_PLAN.md` (T0–T8) or
> `docs/SAP2_BLUEPRINT.md` (R0–R8) disagree, THEY win and the conflict is a defect here
> to be logged in `DECISIONS.md`. This plan composes with their models; it never forks
> them. Every phase states its T-phase and R-phase dependency explicitly (§6).
>
> **Ground truth re-verified against the repo 2026-08-02** (facts load-bearing enough to
> have killed prior drafts):
> - `src/timber/types.ts` — `Member{id,role,nominal,actual,cutLength,angles?,position,rotation,stage,wall?,grade,nailing,doctrineRef,count?}`; `STAGES` = 11 rows; `DRESSED` has **no panel and no concrete entries**; `MemberRole` is a closed 29-value union.
> - `src/timber/bom.ts` — `CutLine{nominal,cutLengthIn,count,roles,memberIds,boardFeet}`. `cutList` keys on `nominal|length`. `Member.grade` is **dropped** by `cutList`. `concLf` is computed inside `bomSummary` and **never exposed**. `MH_PER_BF=0.055`, `MH_PER_PANEL=0.5`, `MH_PER_CONC_LF=0.15`, all `(PH)`, all **module-private**. **`classifyNominal` does not exist.**
> - `src/timber/` has **no `doctrine.ts`**. `src/ui/woodframe/` **does not exist**. `thumbnails.ts` **does not exist**.
> - `src/ui/woodframe-scene.ts` — top-level `import * as THREE from 'three'` (line 10) and `document.getElementById('viewport')!` + `new THREE.WebGLRenderer()` at module scope (lines ~101–102): **the module cannot be imported under `node --test`**. `PLAIN`/`WHAT` at lines 44–87 (`WHAT['brace']` contains the literal `1x4`; `WHAT['stringer']` says "Card shows the riser/tread layout math"). `BUILDING` hard-coded 20×16 at lines 20–22. `rebuild()` tints selection `0xff8844`. Click raycast at ~line 259. `renderStrips` emits `data-member` groups with `width="${wPx}"`, no `viewBox`, `font-size="10"/"9"`, ink `#b7ad97`/`#e8dcc0`. `fitViewport` floors height at `Math.max(320, …)`. `setCamera` **reconstructs OrbitControls** on every view chip.
> - `src/timber/elevation.ts` — `wallElevation()`/`layoutStrip()` return **data, not SVG**. The only SVG emitter for strips is inline in `woodframe-scene.ts`.
> - `test/number-free.test.ts` — scoped to `src/engine/**` (SAP-1) only; `ALLOWED = new Set(['0.5'])`. It does **not** scan `src/timber/**`.
> - `scripts/` = `blender/ build-standalone.ts build-suite.mjs check-offline.ts gen-reference.ts make_lumber.py make_plywood.py render-sample.ts render_assets.py serve-suite.mjs serve.js`. **`check-assets` DOES NOT EXIST** — no script, no npm entry. `check-offline.ts` walks built `dist/` and passes when `dist/` is absent.
> - `.github/workflows/` = `sap2.yml` **only**. There is **no root CI**. There is **no `.gitattributes`**.
> - `scripts/build-suite.mjs` writes `dist/sw.js` as a **cache-killer** that deletes every non-`sap2-` cache. Only `/survivability/` is service-worker-backed. TIMBER and the hub have **no SW** (TD16).
> - `sap2/src/schema/leaves/positions.ts:25` — `label: '.50 cal position (L-shape)'` (**digits in a position label**). `POSITION_STRUCTURE` has 10 rows; `volumeModel` ∈ `prism | cylinder | prism_ramp`.
> - `sap2/src/schema/watermark.ts` — `artifactPolicy` returns exactly four booleans: `signatureBlocks`, `governingValuesTable`, `bareExports`, `fictSuffixOnNumerals`. `FILLED_UNCOMMISSIONED` carries `revoked: boolean` and a three-way `reason`.
> - `sap2/src/render/svg.ts:37–42` — `svgDoc` hardcodes `id="t"` / `id="d"` and `aria-labelledby="t d"`.
> - `sap2/src/render/drawSection.ts:19–20` — `RenderCtx { readonly theme: ResolvedTheme; readonly watermark: WatermarkState }`. **There is no `Theme` type.** `stateBanner` emits TWO lines (`NO SCALE — TEMPLATE`, `DO NOT SCALE — proportions are arbitrary…`). `drawPlan.ts:71–72` emits **only** `NO SCALE — TEMPLATE` at `font-size 12`, `y = h-8`.
> - `sap2/test/gates/g2-number-free.test.ts` — `inScope = rel.startsWith('engine/') || rel.startsWith('schema/')`; R3 flags any literal fractional or `|v| >= 3` unless in `STRUCTURAL_BUDGET`.
> - `sap2/test/gates/g9-source-lints.test.ts` — clock/random `BANNED` regex; `BANNED_IMPORT = /from\s+'[^']*(schema\/leaves|schema\/io|schema\/consumers|engine\/read)'/`.
> - `sap2/src/scene/` and `sap2/src/render/print/` **do not exist**. `sap2/src/schema/callouts.ts` **does not exist**. SAP-2 status: R0 complete (11/11), R1+ not started. TIMBER-2: T0–T8 not started.

---

## 0.0 SHIPPED — what this plan has actually built (added after the fact)

The status line above is from the day the plan was written. Since then TIMBER-2 T0–T8 shipped,
and four of the F phases with them. Where the plan and the code disagree, **the code is the
record** — the differences below were all forced by driving the thing rather than reading it.

| Phase | State | Where it lives |
|---|---|---|
| **F1** — pure core, scheduler, deck compiler | shipped | `src/timber/train/{core,compile,decks,drill}.ts`, pinned vectors at `test/fixtures/train-vectors.json` |
| **F2** — TIMBER flip deck UI | shipped, and larger than specced: a **toolkit-level** trainer at `learn.html`, not only a panel inside the studio | `src/ui/learn/**` + the 1371 hub card |
| **F3** — command packet | shipped | `src/timber/packet/**`, `src/ui/woodframe/sheet.ts`, `.materials.csv` export |
| **F4** — quiz modes | shipped with F2 (identify, name-to-part, stage-order) | `src/timber/train/drill.ts` |
| F5–F9 | not started | — |

**Four plan decisions were wrong in a way only the browser showed, and the code carries the
corrected version plus the reason:**

- **§4.1.1's repeating footer** was specced as a CSS margin box. Chrome does not implement
  margin boxes; it renders nowhere. `position: fixed` was the second attempt and prints once
  in Firefox. The shipped mechanism is a `<tfoot>` on a document-wrapping table — which is
  what FD69 already said, and is why FD69 is right.
- **FD60's panel-thickness split** was budgeted as an additive generator change. Those
  generators (`floor.ts`, `roof.ts`) are frozen under C-10, and the split belongs in the BOM
  anyway: it is a projection, and correcting a bill needs no change to the model it bills.
- **§4.1.5's LS table** was to be matched by citation. Members cite the METHOD they were cut
  by; doctrine entries cite the TABLE. Consumers are declared in `packet/lsgate.ts` instead,
  gated by a test that every LS constant names its own.
- **R-T4's "no cover-depth field"** is narrower than it reads: the boundary sentence IS the
  soil ghost's citation, so the citation register quotes it verbatim, which is exactly the
  adjacency the rule wants. What is forbidden is a machine-readable cover-depth VALUE.

---

## 0. How to read this document

§1 states the mandate as requirements and restates the two liability regimes as binding
constraints. §2–§5 are the four subsystems (flashcards, training programs, command
packet, platform). §6 is the phase plan a fresh session executes. §7 is the ranked
backlog. §8 is the test strategy. §9 risks and kills. §10 the handoff kit. §11 the
decisions log (FD1–FD48), which is where every judgment call — including every
conflict between the four source designs — is recorded with its rationale.

**§2.0 (sibling reconciliation) is mandatory reading before any phase starts.** Three of
the four source designs each fully specified a TIMBER flashcard trainer, in three
incompatible file trees, with three incompatible card types and two colliding
localStorage keys. This document resolves that once. The source designs are archived
inputs; **this document is the only binding one**.

---

# 1. Mission & non-negotiables

## 1.1 The owner's mandate as testable requirements

| # | Mandate (verbatim intent) | Requirement | Where |
|---|---|---|---|
| **M1** | "Individual components can be viewed as training or teaching aids in a flash-card quizlet style — see the thing, then flip to reveal the answer." Must work **SUPER WELL on mobile as well as desktop**. | A flip deck compiled at runtime from each app's engine. Front = the component highlighted **in its structure**; back = name / what-it-does / where-it-goes / regime-safe cited facts. Portrait one-hand spec with measured interaction budgets (§2.7); full desktop keyboard map shipping **in the same phase as the deck**, not later. | §2, §6 F1–F2 |
| **M2** | "Find the best ways we can use this for training" — creative and exhaustive, then honest about what earns its place. | Five quiz modes (§2.5), a four-rung curriculum ladder (§3.1), hip-pocket and projector instructor modes (§3.2–§3.3), printables (§3.4), two honest drills and one rejected drill class (§3.5), records with a stated privacy posture (§3.6). Everything considered and cut is in §7 with a stated reason. | §3, §7 |
| **M3** | "Build out a blueprint custom structure and give it to command showing them how many man-hours, what exact materials, anything like that … the same concept as the SAP job sheet, just better in every way." | A **command packet**: cover → exec summary (7 blocks including **REQUEST** and **RISK**) → orderable materials with unit-of-issue → labor with crew scenarios → assumptions/citations → drawings annex. ≤6 sheets without the annex. Better-than-SAP delta table with a receipt per row (§4.6). | §4, §6 F3 |
| **M4** | "Make other improvements you can think of." | §7 ranks every candidate IN-plan / LATER / OUT with value and cost. Every IN row traces to M1–M3 or to a non-negotiable. | §7 |
| **M5** | Plan only; other sessions implement phase-by-phase without the planner. | §6 phases with exact files, binding signatures, named suites, acceptance a fresh session can verify, descope ladders, START HERE blocks, and explicit T0–T8 / R0–R8 dependency rows. | §6, §10 |

**The one requirement that unifies M1 and M3 (FD1):** the deck and the packet are
**projections of the same model**. The spec that generates your cut list generates your
cards. Change the building, and the deck and the packet both change. No hand-authored
card files and no second BOM exist anywhere in this plan.

## 1.2 Non-negotiables (inherited; every phase, no exceptions)

| Id | Invariant | Enforcement |
|---|---|---|
| **N-1** | Fully offline. Zero external requests. | `npm run check:offline` (walks `dist/` for external URLs) **plus** a new source lint (N-1b) banning `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource` in `src/timber/train/**`, `src/timber/packet/**`, `src/ui/woodframe/**`, `sap2/src/train/**`. **check-offline alone does not cover source** — see FD44. |
| **N-2** | Zero new runtime dependencies. `three` stays the only one. | `package.json` diff review; a test asserts `dependencies` is unchanged from the F0 baseline. `happy-dom` may be added as a **devDependency** only if TIMBER-2 T3 has not already added it. |
| **N-3** | Deterministic outputs. Same inputs ⇒ byte-identical bytes. | Deck compile, card art, packet HTML, CSV: deep-equal / string-equal across two isolated `node:child_process` runs (SAP-2 G-5 pattern). Seeded PRNG only; **no `Date.now()` anywhere in training or packet code** (§2.6). |
| **N-4** | One toolkit deploy. `npm run build:suite` green at every merge. | Phase DoD. `scripts/build-suite.mjs` and both vite configs are **not edited by any F phase**. |
| **N-5** | Deploy build stays lean (an OOM already bit us). | `scripts/check-size.mjs` (F1) — **per-entry** budgets over `dist/hub.html`, `dist/woodframe.html`, `dist/assets/woodframe-*.js`, `dist/assets/*.glb`, with `dist/survivability/**` **explicitly excluded** and a comment naming `SAP2_BLUEPRINT.md` as its owner (SAP-2 pulls three.js in at R2b; that growth is not F's to budget). Baseline recorded in the script. |
| **N-6** | No new dist asset files. | **`check-assets` does not exist.** F1 creates `scripts/check-assets.mjs` (enumerates `dist/`, `dist-woodframe/`, `sap2/dist/` against a committed allowlist, fails on additions) and adds `check:assets` to `verify`. Until F1 merges, every acceptance row that said "check-assets green" reads **"`check:offline` green + zero new files under `public/`, review-enforced"** (FD43). |
| **N-7** | No accounts, no telemetry, no sync, no server. All progress and records local-only and private. | Kill-word rule: *account, roster, certify, transcript, sync, leaderboard* in a feature request = a **regime conversation**, not a phase (§9 K-F2). |
| **N-8** | Legacy TIMBER suites immutable. | `git diff` empty on `test/timber-*.test.ts` at every merge. SAP-2 gate suites only ever GAIN cases. |
| **N-9** | No service worker anywhere new. | TD16 binds: no SW for hub/TIMBER; `build-suite.mjs`'s cache-killer `sw.js` is policy; SAP-2 keeps its scoped SW + update button. This has a **user-visible consequence for field use** — see §1.4. |
| **N-10** | Composition, never forking. | F code consumes TIMBER-2/SAP-2 shapes as published. Any needed change to those shapes goes through **their** plan's change process. Additive-only touches to their files are listed per phase (§6.2 collision map). |

## 1.3 The two liability regimes — restated as binding constraints

The apps have **different** regimes and **both** are binding. The rule that makes a
trainer legal under both:

> **Component IDENTITY is qualitative and free in both apps.** Names, plain-language
> purposes, where-it-goes, what-nails-to-what expressed as prose, and build SEQUENCE are
> identity. **NUMBERS follow each app's regime, with no exceptions and no third path.**

### TIMBER — ships working defaults WITH `(PH)` cites

| Rule | Statement | Test |
|---|---|---|
| **TR-1** | Every `CitedFact` with `source: 'doctrine'` or `'doctrine-constrained-choice'` carries a non-empty `cite`. A doctrine fact without a cite, or a `this-build`/`count` fact WITH a cite, makes `compileTimberDeck` **throw** — malformed decks are unrepresentable. | `train-cards.test.ts` |
| **TR-2** | Doctrine cites are carried **byte-for-byte** from the source field, never summarized, so `(PH)` and the LS suffix survive by construction. | `train-cards.test.ts` |
| **TR-2b** | **A fact's cite is the reference for that fact's own claim.** A Size fact cites the member's sizing ref; a Nailing fact cites `Member.nailingRef` and is **omitted entirely when `nailingRef` is absent**. Synthesizing a nailing cite from `doctrineRef` is forbidden — `floor.ts:284` is `'FM 5-426 Table 6-2 joist span (PH: 2x8 fixed, span check pending)'`, and citing a span table as the authority for `2-16d toenail ea end` is a manufactured mis-citation. | `train-cards.test.ts` TR-2b vector |
| **TR-2c** | **Cites may not become a magnitude channel.** Only the page-locator half of a `doctrineRef` renders on a card, plus the literal `(PH)`. `Member.doctrineRef` splits into `{ refId, locator, phNote }` at F3 (§4.4); a card renders `locator` + `(PH)` and never `phNote`. A lint asserts no `doctrineRef` is produced by template interpolation of a computed value (`floor.ts:443` interpolates computed risers today — that string can never reach a card). | `train-cards.test.ts`, `doctrine-refintegrity` extension |
| **TR-3** | LS-flagged roles carry `lifeSafety: true` on the Size fact; the view renders the LS badge and the verbatim `(PH — LIFE-SAFETY, review required)` suffix. Wired to `lifeSafetyRegister()` at T4+; empty set before. | `train-cards`, `train-ui` |
| **TR-4** | **Provenance is total.** Every number rendered on a card is exactly one of: (a) verbatim from a `Member` field, (b) from the spec / user configuration, (c) a **count of the user's own members**. Nothing else. A test enumerates every fact-producing branch in `compileTimberDeck` and asserts each maps to one of the three. (The old "every number arrived inside a Member" phrasing was false: `Count` is compiler-derived.) | `train-cards.test.ts` |
| **TR-5** | Source honesty renders. `'this-build'` → a `this build` chip, no cite. `'count'` → `n in this build`, no cite. `'doctrine-constrained-choice'` → `this build (from the allowed spacings)` **plus a cite naming the on-center table** — because `studSpacingIn`/`joistSpacingIn`/`rafterSpacingIn` are typed `16 | 24` in `frame.ts`/`floor.ts`/`roof.ts`/`walls.ts`: a **closed doctrinal enum**, not a free user value. Rendering `every 16 in` under a bare "this build" chip launders doctrine as configuration. | `train-cards.test.ts` TR-5 |
| **TR-6** | **Qualitative copy is digit-free.** `PLAIN[role]` and `WHAT[role]` contain zero digits and zero number-words. `WHAT['brace']`'s `1x4` moves out into a Size `CitedFact` carrying the brace member's own ref. The digit scan covers `src/timber/labels.ts` (the dictionaries' new home) as well as `src/timber/train/**`. | `train-labels.test.ts` |
| **TR-7** | No graded drill may ask for a doctrinal magnitude while it is `(PH)`. `gradableDoctrine(ref) === (ref.ph === false)`. Cut lengths, spans, nailing schedules and man-hours are **reference on card backs only**. Unlocks mechanically at T8 when a ref flips to page-verified; zero training-code change. | `train-quiz.test.ts` |
| **TR-8** | Training and packet modules contain **no numeric doctrine literals**. Scope of the digit-literal scan: `src/timber/train/**`, `src/timber/packet/**`, `src/timber/labels.ts`. Allowlist `{0,1,2}`; page-geometry constants live outside this scope by construction (§4.5, FD34). **Structural (non-doctrinal) constants — PRNG/hash words, session pacing, option counts, envelope clamps, sheet area — are declared in named per-file budgets (§2.3.1), mirroring the sap2 `schema/sha256.ts` wide-integer exemption. A value not in its file's budget still fails.** | `train-numberfree.test.ts` |

### SAP-2 — ships EMPTY; numbers only from operator fills; TRAINING numerals carry FICT

| Rule | Statement | Test |
|---|---|---|
| **SR-1** | **TEMPLATE zero-digit gate.** For a deck compiled with `fill === null`: `cardTextCorpus(deck)` — every `title`, `prompt`, `name`, `plainName`, `purpose`, `where`, fact `label` + `text`, **and `stageDrill.label` AND `stageDrill.detail`** — contains no `[0-9]`. Every `art.svg`'s **concatenated `<text>` + `<title>` + `<desc>` text content** contains no digit (coordinate attributes exempt — the posture of the existing template gates). | `sap2/test/gates/g17-train-regime.test.ts` |
| **SR-1b** | **`PositionStructure` gains a digit-free `trainingLabel`.** `'.50 cal position (L-shape)'` makes SR-1 **unsatisfiable today** because `DeckSpec.title` derives from `positionLabel`. `trainingLabel` (e.g. `'Fifty-cal position'`) is what `DeckSpec.title` and every card `<title>` read; `label` is never a card-content source. A **schema-integrity assert** fails at the registry — not at deck compile — if any `trainingLabel` contains a digit or a number-word. | `sap2/test/schema-integrity.test.ts` |
| **SR-2** | **TRAINING FICT.** Deck compiled from a TEST-class fixture fill (watermark floor → TRAINING): every `fact.text` matching `/\d/` also matches `/\bFICT\b/`; `stageDrill.detail` joins the same scan; the card art's banner reads TRAINING. Fixture coverage: **every `POSITION_STRUCTURE` row × every presence-flag combination**, asserting the compiled component set equals the registry expectation. | `g17-train-regime.test.ts` |
| **SR-3** | **Projection fidelity.** With a DOCTRINE fixture fill (test-only; G-11 keeps `dist` fill-free), each numeric fact equals `displayForArtifact(q, token, watermark).text` for the same quantity — the **same helper `drawPlan`/`drawSection` call** (FD11). Cards cannot disagree with the drawings because there is one implementation. | `g17-train-regime.test.ts` |
| **SR-4** | **The regime mark is card CONTENT, not chrome.** The banner lives inside the card's art SVG and is exempt from every hide rule: asserted present **and visible** with `data-big` set, under the print stylesheet, and in fullscreen. A card surface renders **exactly one** banner and it matches `watermarkState(inputs)`, in all five states plus `revoked`. | `g17-train-regime.test.ts`, `sap2/test/ui/train.test.ts` |
| **SR-5** | **Qualitative copy gates.** Every `ComponentEntry.name / plainName / purpose / where` and every `trainingLabel`: zero digits, zero number-words (reuse the §3.8 gate-2 list). Word-allowlist joins when G-16 stands up. | `sap2/test/schema-integrity.test.ts` |
| **SR-6** | **Progress and art are value-free.** `DeckProgress`/`TrainState` hold only ids and counters by construction. The test **enumerates every storage key the trainer writes** during a DOCTRINE-fixture session and asserts the fixture's known-answer values appear in none of them. The **card-art memo is an in-memory `Map`**, cleared on unmount and on watermark-state change; `TrainState` is the only persisted trainer structure. | `g17-train-regime.test.ts` |
| **SR-7** | **No magnitude answers, and no uncited sequence answers.** No quiz mode may ask for a magnitude as an answer in any SAP-2 state. Sequence answers are permitted **only** because `STAGE_ORDER` is app structure (`ids.ts`), not fill-derived doctrine — and the stage-order reveal must carry a `source` tag plus the same "verify against current publications" line the drawings carry, **in every watermark state**. | `sap2/test/train-quiz.test.ts` |
| **SR-8** | **Number-free lint reaches the trainer.** G-2's `inScope()` extends to `rel.startsWith('train/')` with a **`STRUCTURAL_BUDGET` entry for `train/core.ts` only** (§2.3.1's PRNG/scheduler set — an empty budget is unsatisfiable for the byte-identical twin and would fail on day one); G-9's clock/random regex widens to `^(engine|schema|render|scene|train)/`; G-9's `BANNED_IMPORT` widens to `^(render|scene|viewer|train)/` so `train/` can never import `schema/leaves`, `schema/io`, `schema/consumers`, or `engine/read`. Zero numeric literals outside `{0,1,2}` in `sap2/src/train/**`. | `g2-number-free`, `g9-source-lints` |
| **SR-9** | **Export/print/save affordances route through policy.** Every trainer download, print button, and image-save affordance is gated on `artifactPolicy(watermark).bareExports` and **disabled when false** (TEMPLATE and TRAINING). A gate asserts the trainer region exposes no download or print control in those two states, and that card SVGs are rendered such that a saved copy still carries the banner. `bareExports` being false in TEMPLATE and TRAINING is why the flashcard progress-export UI (§2.6) is **TIMBER-only**. | `g17-train-regime.test.ts` |

### Cross-app

- **XR-1** Trainer state lives in per-app localStorage under **one key per app** (§2.6) — never inside fill files, never inside `timber2-session` specs, never in either app's exports.
- **XR-2** **No mixed-app decks and no hub trainer app.** Two regimes never share a screen. A hub-level trainer would need a third bundle importing both engines (N-5) and would put a `(PH)` magnitude and a FICT magnitude on one surface.
- **XR-3** `src/timber/**` and `src/ui/woodframe/**` render **zero SAP-2 numerals, leaves, or `Result` data, ever**, and import nothing from `sap2/`. The only permitted SAP-2 reference is the literal href `/survivability/` plus content-free label copy (§3.7). Enforced by an import-graph test **and** a noun lint: no SAP-2 mode name, fill-class name, or position id appears in TIMBER training source.

## 1.4 The offline-in-the-field constraint (stated honestly — FD2)

`design-training.md` claimed hip-pocket mode "works identically offline". **It does
not, on a cold tab.** `build-suite.mjs` writes a cache-killer `sw.js` that deletes every
non-`sap2-` cache; TD16 forbids a TIMBER service worker; every `#/train` route lives on
`woodframe.html`. With no signal and no warm tab, the bookmark returns the browser's
offline page. `check-offline.ts` proves *no outbound calls*, not *availability*.

**Decision (FD2):** TD16 is binding and is **not re-litigated**. No SW ships. Instead:

1. The hip-pocket entry and the deck list carry fixed copy: **"Open this once on Wi-Fi before you go out — it then runs with no signal until you close the tab."**
2. Acceptance for every training phase is stated precisely: **warm tab, airplane mode, full flow works; cold tab offline is a known limitation, recorded in `DECISIONS.md`.**
3. The genuine fix — a single-file `woodframe` standalone (the repo already has `vite.standalone.config.ts` + `scripts/build-standalone.ts`) — is **backlog row #9 (LATER)**, not a phase. It is a build-shape change and belongs to whoever owns `build-suite.mjs`.

---

# 2. The flashcard system

## 2.0 Sibling reconciliation — what this plan kept, and from whom (FD3)

| Concern | Owner in this plan | Withdrawn |
|---|---|---|
| Card / deck / fact shapes, scheduler, regime rules | `design-flashcards.md` (§2 shapes, §4 rules, FD5/FD9) — most regime-complete, covers both apps | `design-platform.md`'s `TrainingCard`; `design-training.md`'s `FlashCard`/`CardFace`/`CardLine` |
| Card **art** pipeline | `design-platform.md` PD-7 + `design-training.md` §3.4 — **deterministic SVG is PRIMARY** | `design-flashcards.md`'s "live 3D scene is the card front" (§2.2 below states why) |
| Curriculum ladder, stage-walk, printables, records, hip-pocket, projector, drills | `design-training.md` §4–§7 | — |
| Command packet | `design-packet.md` (all of it) | `design-platform.md` §1.5's `PacketOptions`/`PacketModel` sketch (subsumed) |
| Mobile engineering work items, phase sequencing, backlog, risk register | `design-platform.md` §2/§3/§4/§5 | `design-training.md` TR0–TR5 numbering; `design-flashcards.md` F0–F4 numbering |
| File tree, localStorage keys, card type | **This document, §2.1 and §5.1 — all three siblings' variants are void** | all three |

Three contested questions, decided here (they were decided *both ways* across the
siblings and would otherwise have shipped twice):

| Contested | Decision | Rationale |
|---|---|---|
| Spaced repetition | **SHIPS**, as 3-box **session-indexed** Leitner (FD9) | `design-training.md` cut it on the grounds that unit training is instructor-led session-based. True — and irrelevant to a Marine drilling on a personal phone, which is the M1 use case. Session-indexing (not days) answers the clock-freedom objection that motivated the cut. `design-platform.md`'s 5-box **day-based** Leitner is rejected: it reads the wall clock, which both apps forbid. |
| A third hub card | **NO.** The hub's two existing cards each gain one copy line and a deep-link anchor. | `design-flashcards.md` FD10 is right about the mechanism (a third bundle risks N-5, and mixing regimes on one screen breaks XR-2). `design-training.md`'s "front door" need is satisfied by a deep link — no new tool, no new bundle, no new card. |
| Cards per role | **One card per distinct role present**, with **flip and flip-reverse as two directions of the same card**. | `design-platform.md`'s "identify + function + number cards per role" triples the deck and splits progress across three ids for one unit of knowledge. The teaching unit is the ROLE. Deck size for the demo building lands at ~22–26 cards, not 40+; the F2 acceptance number changes accordingly. |

## 2.1 Where the code lives (binding — supersedes all three siblings)

```
src/timber/labels.ts                 # PLAIN + WHAT dictionaries — ENGINE level, beside types.ts.
                                     #   Training imports labels; labels NEVER live inside training/.
                                     #   src/ui/woodframe/labels.ts re-exports (T3's designated home
                                     #   keeps working; I-14 lockstep repoints here).
src/timber/train/                    # PURE. No DOM, no three.js, no Date, no Math.random.
  core.ts                            #   shared spec module — SHAPES + SCHEDULER + PRNG (§2.3)
  compile.ts                         #   compileTimberDeck(TimberDeckInput) -> DeckSpec      (§2.4)
  art.ts                             #   cardArt(members, ThumbOpts) -> string                (§2.2)
  quiz.ts                            #   quizPlan / judgeTap / grading state machines         (§2.5)
  curriculum.ts                      #   compileCurriculum / stageWalkContent / hipPocketPlan (§3.1)
  confusion.ts                       #   CONFUSION_GROUPS over MemberRole (closed vocab)
  stageNotes.ts                      #   STAGE_NOTES over StageKey (+ optional family override)
  copy.ts                            #   EVERY authored training string, one table (§3.8)
src/ui/woodframe/                    # UI — created early; matches TIMBER-2's final tree exactly
  viewport.ts                        #   PURE: isNarrow(width), renderScheduler(state,event),
                                     #   canvasHeight(innerW,innerH) — F0's testable subject (§5.4)
  labels.ts                          #   re-export of src/timber/labels.ts
  train/view.ts                      #   flip-deck surface (overlay pre-T3, route post-T3)
  train/quizView.ts                  #   identify / name-to-part / stage-order surfaces
  train/hip.ts                       #   hip-pocket guided flow
  train/printTrain.ts                #   card sheets / worksheets / posters / session sheet
  train/records.ts                   #   training store + session records
  train/identify.ts                  #   identify-IN-SCENE (the only module that touches the 3D scene)
  packetPrint.ts                     #   packet print surface — NOT print/packet.ts (§4.5, FD33)
  packetCss.ts                       #   PKT_PAGE + PKT_CSS (page geometry lives OUTSIDE doctrine scan)
src/timber/packet/                   # PURE packet compiler — spec.ts model.ts build.ts stockfit.ts
                                     #   csv.ts elevationSvg.ts stripSvg.ts                   (§4.5)
sap2/src/schema/callouts.ts          # the blueprint's own component/callout registry (FD12)
sap2/src/train/core.ts               # BYTE-IDENTICAL copy of src/timber/train/core.ts
sap2/src/train/compile.ts            # compileSapDeck(SapDeckInput) -> DeckSpec               (§2.4)
sap2/src/ui/regions/train.ts         # retained-DOM trainer region
```

**Why twin `core.ts` copies and not a shared module (FD4).** `sap2/` is self-contained by
blueprint N1: its own package, pinned toolchain, own tsconfig, own `node --test` run, and
its own source gates (`g2`, `g9`, `g3`) that scan `sap2/src/**`. A shared module either
enters SAP-2's liability perimeter carrying TIMBER doctrine strings — the exact leak class
both regimes exist to prevent — or forces cross-tree path aliases into two vite configs,
two tsconfigs and two test runners. The genuinely shared surface is one file of shapes
plus ~90 lines of scheduler. **Drift is made loud instead of impossible:**
`test/train-sync.test.ts` (root, where both trees are visible) asserts the two files are
**byte-identical**, and both trees' contract tests read the **same committed vector
fixture** (§2.3). Same pattern class as TIMBER-2's I-14 dictionary lockstep.

**One localStorage key per app (FD5).** `timber2-train` (root) and `sap2-train-v1` (sap2).
The variants `timber2-training` and `sap2.train.v1` proposed by siblings are **void**.
`test/storage-keys.test.ts` enumerates every localStorage key **string literal** in
`src/**` and `sap2/src/**` and asserts uniqueness across the repo, so no future design can
mint a third training envelope.

## 2.2 The picture pipeline (FD6, FD7)

**Deterministic SVG is the card art. Live 3D is a mode, not a card face.**

`design-flashcards.md` made the live viewer the primary card front. That is rejected:

1. `src/ui/woodframe-scene.ts:10` is a top-level `import * as THREE from 'three'`, and `dist/assets/woodframe-*.js` is **670 KB before GLB props**. A card front that *is* the scene makes every training route pay the full studio bundle, and the "<1 s route interactive on the reference low-end Android" requirement is unreachable cold.
2. `OrbitControls` owns drags on the same canvas the deck wants for swipes, and the existing click raycast tints any tapped member `0xff8844` — **the exact subject-highlight colour** — so tap-to-flip could silently corrupt the stimulus.
3. SVG art is golden-testable, printable, and works on a phone that cannot run the studio at all.

**Binding rules:**

| Rule | Statement |
|---|---|
| **A-1** | Card art is `{ kind: 'svg'; svg: string; artId: string }` in **both** apps. `{ kind: 'scene' }` exists in the type but is emitted **only** by identify-in-scene (§2.5 M-2b), which runs inside the studio, never in the deck. |
| **A-2** | **Stage-slice rule.** Card art renders the structure **through the subject's install stage** (`stageOrdinal` = the role's minimum stage), so the highlighted piece is never occluded by sheathing/siding/cover. Interior-but-same-stage cases (a basement girder under joists) additionally apply the family's `CutawaySpec` axis at `frac 0.5` (TIMBER-2 §4.2) via a per-role `needsCutaway` column in the compile table. |
| **A-3** | **Highlight is non-chromatic.** 2× stroke weight **+ a hatch pattern fill + a leader arrow to the member**. Explicit `stroke`/`fill` **attributes** on SVG elements — never CSS backgrounds, never `background-image`, never colour alone. Company printers are mono laser and browsers default "Background graphics" OFF; a grayscale fill makes "what is the highlighted piece?" unanswerable and wastes the whole sheet. |
| **A-4** | **`thumbLod` must not void a card.** TIMBER-2 §4.4 makes `thumbLod` (skip covering/deck roles) the *default* for every thumbnail. A `sidingBoard`/`roofing`/`sheathingPanel`/`felt` card would therefore get a front in which the highlighted members were dropped. `ThumbOpts` **force-includes any role named in `highlightIds`**, regardless of `thumbLod`. Deck-suite assert: **every card's front SVG contains ≥1 element carrying the highlight class**, iterated over every catalog preset. |
| **A-5** | **No answer on the front.** `RenderCtx`/`ThumbOpts` grow `labelChip: 'none' | 'name'`; train compilers pass `'none'`, drawings keep chips. The gate scans front `art.svg`'s `<text>` contents for `back.name`/`plainName` exactly as SR-1 scans for digits. A golden pins a highlighted, chip-free train render. |
| **A-6** | **Unique ids per inlined SVG.** `svgDoc` (sap2) and `cardArt` (timber) take an `idPrefix`; `drawPlan`/`drawSection` thread a per-card value. Today `svgDoc` hardcodes `id="t"`/`id="d"` and `aria-labelledby="t d"` — inlining N card SVGs into a deck-list preview or a 2-up print sheet cross-wires accessible names so a card's art is announced with another card's title. Assert: a page inlining N card SVGs has N distinct title ids and each art node's accessible name resolves to its own title. |
| **A-7** | **SAP-2 card art carries the full TEMPLATE stamp.** `drawPlan` today emits only `NO SCALE — TEMPLATE`; `drawSection` alone emits `DO NOT SCALE — proportions are arbitrary…`. Card art renders the **two-line** stamp on plan views too, the banner band is **never cropped**, and a minimum rendered stamp height in CSS px is enforced. Geometry is drawn at fixed CANON proportions, so a scaled or cropped plan card would imply dimensions under the weakest stamp. Gate: every TEMPLATE card SVG contains `DO NOT SCALE`, and the art container never clips the banner region. |
| **A-8** | **Memo is memory-only.** The art memo is an in-memory `Map` keyed `(deckId, cardId)`, cleared on unmount and on watermark-state change. Persisting a rendered TRAINING or DOCTRINE card SVG would put real numerals in `localStorage` outside the fill file (SR-6). |

**Binding art signature (`src/timber/train/art.ts`):**

```ts
import type { Member } from '../types';

export interface ThumbOpts {
  readonly highlightIds?: readonly string[];   // force-included regardless of thumbLod (A-4)
  readonly stageOrdinal?: number;              // render members with stage <= ordinal (A-2)
  readonly cutaway?: { axis: 'x'|'y'|'z'; frac: number } | null;
  readonly size?: 'card' | 'poster';           // poster doubles the viewBox scale budget
  readonly omitIds?: readonly string[];        // omission drill — REMOVES members, never invents
  readonly memberIds?: boolean;                // default false: emit data-member hit groups +
                                               //   >=44px transparent pad rects (quiz-place, §2.5)
  readonly labelChip?: 'none' | 'name';        // default 'none' (A-5)
  readonly idPrefix?: string;                  // default '' (A-6)
}
export function cardArt(members: readonly Member[], opts?: ThumbOpts): string;
```

*Golden byte-identity:* output with `opts` omitted is byte-identical to the T2
`thumbnails.ts` baseline — asserted, so TIMBER-2's thumb goldens never churn.

**T2 coordination (collision row, §6.2):** F1 creates `src/timber/train/art.ts` as the
first orthographic projector in the repo. If **T2 lands first**, F1 does not create it —
F1 extends T2's `src/ui/woodframe/thumbnails.ts` with the same `ThumbOpts` and `art.ts`
becomes a two-line re-export. If **F1 lands first**, T2's `thumbnails.ts` is specced to
consume `art.ts` rather than fork a second projector. Either way there is exactly one
projector and **one** golden-regeneration script (`npm run update:thumb-goldens`, written
to both `test/goldens/thumbs/` and `test/goldens/cards/` — FD8; the sibling's separate
`update:train-goldens` script is deleted from the plan).

## 2.3 Shared shapes and the scheduler — `core.ts` (binding, byte-identical twins)

```ts
// src/timber/train/core.ts  ===  sap2/src/train/core.ts
// SHARED SPEC MODULE. Byte-identical copies; test/train-sync.test.ts asserts equality.
// Zero imports. Zero DOM. Zero Date / Math.random / network — enforced by the FT-I2 lint.

export type TrainApp = 'timber' | 'sap2';

export type DeckRegime =
  | 'timber-ph'       // TIMBER: numbers allowed; every doctrine fact cited verbatim incl. "(PH)"
  | 'sap-template'    // SAP-2, no fill: qualitative + <tokens> ONLY — zero digits (SR-1)
  | 'sap-training'    // SAP-2, TRAINING/TEST fill: every numeral carries FICT (SR-2)
  | 'sap-doctrine';   // SAP-2, DOCTRINE fill: real numbers; art carries the watermark banner

export type FactSource =
  | 'doctrine'                     // cite REQUIRED — the ref for THIS fact's claim (TR-2b)
  | 'doctrine-constrained-choice'  // cite REQUIRED — user picked from a closed doctrinal enum (TR-5)
  | 'this-build'                   // free user configuration — cite FORBIDDEN
  | 'count'                        // compiler count of the user's own members — cite FORBIDDEN
  | 'fill';                        // SAP-2 only: operator fill via displayForArtifact (SR-3)

export interface CitedFact {
  readonly label: string;          // 'Size' | 'Nailing' | 'Spacing' | 'How many' | 'How deep' ...
  readonly text: string;           // '2x4' | '2-16d toenail ea end' | '<how deep you dig>' | '3.5 ft FICT'
  readonly source: FactSource;
  readonly cite?: string;          // page LOCATOR + '(PH)' only — never the pending-note (TR-2c)
  readonly lifeSafety?: boolean;   // renders the LS badge (TIMBER LS-GATE roles only)
}

export interface SceneHighlight {
  readonly memberIds: readonly string[];   // TIMBER: EVERY member of the subject role
  readonly stageOrdinal: number;           // A-2 stage slice
  readonly view: string;                   // camera preset name / CardViewSpec ref
  readonly cutaway: { axis: 'x'|'y'|'z'; frac: number } | null;
}

export type CardArt =
  | { readonly kind: 'svg'; readonly svg: string; readonly artId: string }
  | { readonly kind: 'scene'; readonly scene: SceneHighlight };   // identify-in-scene ONLY (A-1)

export interface CardFront {
  readonly art: CardArt;
  readonly prompt?: string;        // <= 60 chars, plain register
}

export interface CardBack {
  readonly name: string;           // PLAIN[role] / ComponentEntry.name        — digit-free (TR-6/SR-5)
  readonly plain: string;          // WHAT[role]  / ComponentEntry.purpose     — digit-free
  readonly whereItGoes: string;    // derived location sentence                — digit-free
  readonly facts: readonly CitedFact[];   // regime-filtered UPSTREAM by the compiler; views never filter
  readonly regimeLine: string;     // CARD CONTENT, never chrome: TIMBER '(PH) = manual page check
                                   //   still pending'; SAP-2 '' (the art's banner is the authority)
}

export type QuizMode = 'flip' | 'flip-reverse' | 'identify' | 'name-to-part' | 'stage-order';

export type CardSubject =
  | { readonly kind: 'member-role'; readonly role: string; readonly exemplarMemberId: string }
  | { readonly kind: 'component'; readonly componentId: string };

export interface CardSpec {
  readonly id: string;             // STABLE progress key: 'role:<role>' | 'component:<id>'
  readonly deckId: string;
  readonly subject: CardSubject;
  readonly front: CardFront;
  readonly back: CardBack;
  readonly modes: readonly QuizMode[];
  readonly fallbackArt: boolean;   // SAP-2: true when geometry is not yet drawable (FD13)
}

export interface StageDrillEntry {
  readonly ordinal: number;
  readonly label: string;
  readonly detail?: string;
  readonly source: 'app-structure' | 'doctrine';   // SR-7
  readonly cite?: string;                          // REQUIRED when source === 'doctrine'
}

export interface DeckSpec {
  readonly id: string;             // 'timber:<entryId|familyId|demo>' | 'sap2:<positionId>'
  readonly app: TrainApp;
  readonly title: string;          // SAP-2: from trainingLabel, NEVER label (SR-1b)
  readonly regime: DeckRegime;
  readonly cards: readonly CardSpec[];       // teaching order: min stage asc, then back.name asc
  readonly stageDrill: readonly StageDrillEntry[];
  readonly notModelled?: { readonly reason: string };   // FD14
  readonly compiledFrom: {
    readonly specHash?: string;
    readonly fillIdentity?: { cls: string; contentHash: string; schemaHash: string } | null;
  };                              // MIRRORS Result.fillIdentity exactly — all three fields (FD15)
}

// ── Scheduler: Leitner-by-SESSION (FD9) ───────────────────────────────────────
export type Box = 0 | 1 | 2;      // 0 = learning, 1 = known (recent), 2 = known (settled)

export interface CardProgress {
  readonly box: Box;
  readonly lastSession: number;
  readonly lapses: number;
  readonly seen: number;
  readonly gotBy: readonly QuizMode[];   // FD10 — which modes produced a 'got'
}
export interface DeckProgress { readonly session: number; readonly cards: Record<string, CardProgress> }

/** Review cadence in SESSIONS, not wall-clock days. Clock-free by design: field cadence
 *  is irregular (three sessions one evening, nothing for two weeks), the scheduler must
 *  be deterministic, and neither app is allowed hidden time state. */
export const DUE_EVERY: Readonly<Record<Box, number>> = { 0: 1, 1: 2, 2: 4 };

/** Unseen cards admitted per session (FD16 — prevents a 20-new-card first session and
 *  stops unseen cards starving lapsed reviews). */
export const UNSEEN_PER_SESSION = 8;
export const SESSION_CAP = 20;

export const emptyProgress = (): DeckProgress => ({ session: 0, cards: {} });

/** got=true: box min(box+1, 2) SUBJECT TO the recall guard; got=false: box 0, lapses+1.
 *  RECALL GUARD (FD10): promotion INTO box 2 requires gotBy to contain at least one mode
 *  other than 'flip' — a self-graded flip and a 25%-guessable 4-choice tap must not
 *  promote a card to "known" the way real production does. Until a non-flip mode has
 *  shipped, box 2 is unreachable and the UI labels the bar "self-checked" (FD10). */
export function mark(p: DeckProgress, cardId: string, got: boolean, via: QuizMode): DeckProgress;

/** Queue for this session. Order:
 *    1. DUE cards (p.session - lastSession >= DUE_EVERY[box]), lapsed box-0 first,
 *       then box asc, then lastSession asc, then id asc;
 *    2. then UNSEEN cards in deck (teaching) order, capped at UNSEEN_PER_SESSION;
 *    3. truncate at cap (default SESSION_CAP) — due cards therefore NEVER starve;
 *    4. shuffle the resulting array with the pinned Fisher-Yates below.
 *  Pure and deterministic for a given (deck, p, seed). */
export function buildSession(deck: DeckSpec, p: DeckProgress, seed: number, cap?: number): readonly string[];

/** Ends a session: p.session + 1. The VIEW calls this at most once per trainer mount
 *  (FD17 anti-cram guard): re-entering from the deck list starts session N+1; three
 *  back-to-back runs inside one mount cannot walk a card box0 -> 1 -> 2. */
export function sealSession(p: DeckProgress): DeckProgress;

export function deckMastery(deck: DeckSpec, p: DeckProgress):
  { known: number; learning: number; unseen: number; total: number };   // known = box 2

/** N distractors for identify: picks from the deck's other cards, seeded
 *  fnv1a(cardId) ^ sessionSeed, de-duplicated by back.name, same-stage subjects
 *  preferred (they are the confusable ones — that IS the pedagogy). */
export function pickDistractors(deck: DeckSpec, cardId: string, n: number, seed: number): readonly string[];

/** PINNED (FD18). Fisher-Yates DESCENDING:
 *    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); swap(a[i], a[j]); }
 *  rand = mulberry32(seed). */
export function shuffle<T>(a: readonly T[], rand: () => number): T[];

/** PINNED (FD18). sessionSeed is CLOCK-FREE: sessionSeed(deckId, session) =
 *    (fnv1a(deckId) ^ (session >>> 0)) >>> 0.   No Date.now anywhere. */
export function sessionSeed(deckId: string, session: number): number;

export function mulberry32(seed: number): () => number;   // repo precedent: test/fuzz.test.ts
export function fnv1a(s: string): number;
```

**Vector pinning (FD18).** `design-platform.md`'s vector table said only "deterministic
permutation of `[a,b,c]`" — two trees could both pass and still disagree. The algorithm
above is pinned literally. In addition, F1 runs `npm run gen:train-vectors` **once**,
which writes `test/fixtures/train-vectors.json` (concrete expected arrays for: seed 42
over `['a','b','c']`; a 12-card deck; a 26-card deck at cap; `mark` transition table;
`buildSession` with 3 lapsed + 15 unseen at cap 20; `mulberry32`/`fnv1a` outputs). The
file is committed, copied byte-identically to `sap2/test/fixtures/`, read by **both**
trees' contract tests, and sync-asserted. Regenerating it requires a `DECISIONS.md`
entry — it is a pinned contract, not a snapshot.

**Known limitations, recorded rather than papered over:** multi-tab last-write-wins is
accepted for progress (it is only counters); the anti-cram guard is per-mount, not
per-clock, so a determined user can still re-enter the deck list repeatedly — that is
the honest cost of clock-freedom and it is stated beside the multi-tab note.

### 2.3.1 Structural-constant budgets (binding — completeness fix, gaps 1–2)

The digit scans (TR-8 / SR-8) exist to keep **doctrine** out of training and packet
code. They must not fail on arithmetic that is not doctrine. Every literal below is
**structural**: it encodes an algorithm, a pacing choice, or an input envelope, and
changing it changes no doctrinal claim. Each file's budget is a named, reviewed set —
a literal outside its file's set still fails the scan.

| File (both trees where twinned) | Permitted values | What they are |
|---|---|---|
| `train/core.ts` | `0x6D2B79F5`, `0x811c9dc5`, `16777619`, `61`, `15`, `14`, `4`, `8`, `20` | mulberry32 + FNV-1a words and shifts; `DUE_EVERY`; `UNSEEN_PER_SESSION`; `SESSION_CAP` |
| `train/curriculum.ts` | `12`, `20`, `60`, `5`, `3` | `estimateMinutes` bands; `HIP_BUDGET` card/stage counts |
| `train/quiz.ts` | `3`, `4` | miss-ladder threshold; choice count |
| `packet/spec.ts` | `4`, `8`, `12`, `10`, `14`, `16`, `1`, `30`, `24`, `6` | default `crewSizes`; `stockLengthsFt`; envelope clamps (crew 1–30, productive hours 1–24, stock 6–24 ft) |
| `packet/build.ts` | `32` | ft² per 4×8 sheet — geometry of a sheet, not a doctrinal quantity |
| `packetCss.ts` | (out of scope entirely) | page geometry, per FD34 |

**Mechanism:** each scan reads `STRUCTURAL_BUDGET` keyed by repo-relative path, as
`sap2/test/gates/g2-number-free.test.ts` already does. The budget table above is
duplicated as data in `train-numberfree.test.ts` (root) and in G-2's budget map
(sap2), and `test/train-budget-sync.test.ts` asserts the two tables are equal — the
same twin-sync discipline as `core.ts` itself. **R-T6's "these are operator inputs,
not doctrine" declaration now has this as its mechanism.**

## 2.4 Deck compilation

### 2.4.1 TIMBER — `src/timber/train/compile.ts` (pure, node-tested)

```ts
import type { Member } from '../types';
import type { DeckSpec, StageDrillEntry } from './core';

export interface TimberDeckInput {
  readonly deckId: string;              // 'timber:demo' | 'timber:custom:<hash8>' | 'timber:<familyId>' | 'timber:<entryId>'
  // Pre-T3 (F2's dims row) a user-edited building is NOT 'timber:demo' — it is
  // 'timber:custom:' + fnv1a8 of the canonical dims/spec JSON (gap-18 fix). Editing
  // dims mints a NEW deck (its own mastery record); role-keyed CARD ids stay stable
  // inside it, so I-5/FD21 hold. Asserted in train-ui: edit a dim, deckId changes,
  // card ids do not.
  readonly title: string;
  readonly members: readonly Member[];  // FrameModel.members (pre-T1) or StructureModel.members
  readonly stagePlan: readonly StageDrillEntry[];
  readonly labels: { PLAIN: Readonly<Record<string,string>>; WHAT: Readonly<Record<string,string>> };
  readonly spacing?: { studSpacingIn?: number; joistSpacingIn?: number; rafterSpacingIn?: number };
  readonly lsRoles?: ReadonlySet<string>;   // lifeSafetyRegister() at T4+; empty before
  readonly cardView?: string;               // FamilyDef CardViewSpec name; default 'Iso SE'
  readonly specHash?: string;               // provenance only
}
export function compileTimberDeck(input: TimberDeckInput): DeckSpec;
export function whereClause(role: string, members: readonly Member[]): string;   // table-tested
export interface MissingLabel { role: string; missing: 'PLAIN' | 'WHAT' }
```

**Compile rules (normative — one test case each in `train-cards.test.ts`):**

1. **One card per DISTINCT role present** in `members` — never per member. `id = 'role:<role>'`. Teaching order: min stage asc, then `PLAIN[role]` asc.
2. **Exemplar (FD19, deterministic):** among the role's members take those of the **modal nominal** (tie → lexicographically smallest nominal), then the **smallest `id` by string compare**. The exemplar supplies nominal / nailing / refs and anchors the camera framing.
3. **Front:** `art = cardArt(members, { highlightIds: <ALL member ids of the role>, stageOrdinal: <role min stage>, cutaway: needsCutaway[role] ?? null, labelChip: 'none', idPrefix: cardId })`. `prompt = COPY.promptWhatIsHighlighted`. Highlighting **every** member of the role teaches the pattern — seeing all 26 studs light up IS the lesson about what a stud is.
4. **Back:**
   - `name = PLAIN[role] ?? role`; `plain = WHAT[role] ?? ''`. A present role missing either dictionary emits a `MissingLabel` issue (sync-tested; extends TIMBER-2 I-14).
   - `whereItGoes = whereClause(role, members)` — a pure lookup producing `Stage <n> — <stageLabel>` plus a wall clause (`south wall` when all one wall, `all four walls`, `roof`, `floor system`, …). **Digit-free except the stage ordinal**, which is `count`-class provenance.
   - `facts`, fixed order:

| Fact | Emitted when | `source` | `cite` |
|---|---|---|---|
| `Size` | always | `doctrine` | `locator(exemplar.doctrineRef)` + `(PH)`; `lifeSafety: lsRoles.has(role)` |
| `Nailing` | **only if `exemplar.nailingRef` exists** (TR-2b) | `doctrine` | `locator(exemplar.nailingRef)` |
| `Spacing` | role ∈ {stud, joist, rafter} **and** the matching spacing is given | `doctrine-constrained-choice` | the on-center table ref (TR-5) |
| `How many` | always | `count` | forbidden |

   - `regimeLine = COPY.phFootnote` — **card content**, rendered on the back of every card, exempt from Big-mode / print / fullscreen hide rules (FD20).
5. **modes:** `['flip','flip-reverse','identify','name-to-part']` for every role card.
6. **stageDrill:** `input.stagePlan` verbatim, filtered to stages that have members (the rule the scrubber uses today, `woodframe-scene.ts:458`), each entry `source: 'app-structure'`.
7. **regime:** `'timber-ph'` always.
8. Compilation is **pure and deterministic**: same input ⇒ deep-equal `DeckSpec`. Perf: demo building compiles **< 50 ms warmed mean** (house perf pattern, TIMBER-2 §8.8).

### 2.4.2 SAP-2 — `sap2/src/schema/callouts.ts` + `sap2/src/train/compile.ts`

The blueprint already names `callouts.ts` as "the single callout/legend registry (the
naming authority for every surface: 2D, cards, 3D labels, BOM, a11y)" (§3.5). It does not
exist. **F7 creates it at its blueprint-designated home with its blueprint-designated
role**, and R2a's Build Card deck consumes it. The trainer builds a piece the blueprint
already owes; it does not fork one. (FD12)

```ts
// sap2/src/schema/callouts.ts — DATA ONLY. Names and QUALITATIVE copy. No magnitudes.
// G-2 scope extends here with an EMPTY structural budget. Copy passes SR-5.
import type { PositionStructure } from './leaves/positions';

export type ComponentPresence =
  | 'always' | 'hasFiringPlatform' | 'storageCompartment' | 'sectorsOfFire'
  | 'earthCover' | 'revetted' | 'vehicle' | 'atgm';

export interface ComponentEntry {
  readonly id: string;          // 'fighting-bay' | 'parapet' | 'grenade-sump' | 'elbow-rest' |
                                // 'sector-stakes' | 'firing-platform' | 'storage-compartment' |
                                // 'overhead-cover' | 'revetment' | 'camouflage' | 'frontal-berm' |
                                // 'backblast-area'
  readonly name: string;        // NCO register: 'Parapet'
  readonly plainName: string;   // recruit register: 'the dirt wall up front'
  readonly purpose: string;     // 1-2 sentences, QUALITATIVE ONLY (identity is free in every regime)
  readonly where: string;       // qualitative location sentence
  readonly presence: ComponentPresence;
  readonly view: 'plan' | 'section';        // which drawing highlights it (registry test column)
  readonly drawable: boolean;               // false => fallback art (FD13)
  readonly countLeafOf?: (p: PositionStructure['id']) => string;
  readonly dimLeafOf?: (p: PositionStructure['id']) => readonly { label: string; leafId: string }[];
}
export const COMPONENTS: readonly ComponentEntry[];
```

```ts
// sap2/src/train/compile.ts
import type { Result } from '../engine/compute';
import type { WatermarkState } from '../schema/watermark';
import type { ComponentEntry } from '../schema/callouts';
import type { DeckSpec, StageDrillEntry } from './core';

export interface SapDeckInput {
  readonly result: Result;                            // TEMPLATE ok (fill null)
  readonly watermark: WatermarkState;
  readonly components: readonly ComponentEntry[];
  readonly stageLines?: readonly StageDrillEntry[];   // R2a STAGE_ORDER; omit before R2a
}
export function compileSapDeck(input: SapDeckInput): DeckSpec;
```

**Compile rules (tests in `sap2/test/train.test.ts`):**

1. `deckId = 'sap2:' + result.inputs.position`. Soil/threat/standard changes do **not** reset progress — they change fact values, not component identity (FD21).
2. One card per `ComponentEntry` whose `presence` predicate holds for (`POSITION_STRUCTURE` row, `Result`). `id = 'component:<id>'`. Order: registry order (authored in build order).
3. **Front:** `drawPlan`/`drawSection` re-rendered with `RenderCtx.highlightComponentId`, `labelChip: 'none'`, `idPrefix: cardId`, full two-line TEMPLATE stamp (A-7), banner uncropped.
4. **Back:** `name`, `plain = purpose`, `whereItGoes = where` — registry verbatim. Facts for `countLeafOf`/`dimLeafOf` entries come **only from `Result`** (dims, `work.bom`, `cover`) and are formatted by **`displayForArtifact(q, tokenLabel, watermark)`** (§2.4.3). **There is no `resolve(view, leaf)` fallback** — `SapDeckInput` carries no `FillValue` and `Result` carries no `FillView`, so the sibling's fallback was unimplementable and would have forced `train/` to import `engine/read` + `schema/leaves`, which SR-8 now bans outright. A quantity the deck needs and `Result` lacks is exposed by **extending `Result`**, never by reaching into the fill. `source: 'fill'` always.
5. **Fallback-art cards (FD13).** Components with `drawable: false` (e.g. grenade sump before its geometry exists) would otherwise get the identical base drawing plus a chip as their FRONT — nothing glows for "what is the glowing piece?", and two fallback cards become the same stimulus with different answers, so identify forces guessing that writes real marks into the scheduler. Therefore the compiler **strips `'identify'`** from any fallback-art card **and reverses its flip direction**: front = name + "where does it go?"; back = purpose/facts. Assert: no fallback-art card carries `'identify'`. The fallback set is a registry column tracked as **shrinking-only** as R2a adds geometry.
6. **modes:** `['flip','flip-reverse','identify']` for drawable cards; `['flip-reverse']` for fallback cards; `stage-order` joins at F8 with R2a's verb lines.
7. **regime:** `TEMPLATE → 'sap-template'`; `TRAINING → 'sap-training'`; else `'sap-doctrine'`. TEST-class fills land in `'sap-training'` via the watermark floor (`watermark.ts` line 63).
8. **Unsupported volume models (FD14).** `compute()` throws for `volumeModel 'cylinder'` and `'prism_ramp'`, so `mortar_pit` and both vehicle positions **cannot compile today**. `compileSapDeck` catches the throw and returns `{ notModelled: { reason } }`; the UI shows an honest "not yet modelled" card, never a crash. `frontal-berm` (presence `vehicle`) and `backblast-area` (presence `atgm`) are **gated behind R4/R7** so no card ships that SR-2's sweep cannot reach.
9. Deck compiles in TEMPLATE with zero fill — the trainer works on **day zero of a ship-empty install**. That is the pitch: identity first, numbers when your unit's fill earns them.

### 2.4.3 One formatter, shared with the drawings (FD11)

`artifactPolicy(...).fictSuffixOnNumerals` has **zero production consumers today** — it
appears only in `watermark.ts` and `watermark.test.ts`; drawings signal TRAINING via
`stateBanner`, not a suffix. So the sibling's claim of "regime inheritance, never
re-implemented" was false: the trainer would have been the **first** implementer, and SR-2
would have rested entirely on new, unshared code.

**Fix:** F7 adds one helper beside `display()` and makes `drawPlan`/`drawSection` use it too.

```ts
// sap2/src/render/precision.ts
import type { WatermarkState } from '../schema/watermark';
export const displayForArtifact = (
  q: Q<NumericUnit>, tokenLabel: string, w: WatermarkState,
): Displayed;   // = display(q, tokenLabel), then applies artifactPolicy(w).fictSuffixOnNumerals
```

SR-2 and SR-3 then test **one implementation shared with the drawings**, which is what
"inheritance" was supposed to mean.

### 2.4.4 `RenderCtx` extension (SAP-2, additive)

```ts
// sap2/src/render/drawSection.ts — RenderCtx home. NOTE: the real field is
// `theme: ResolvedTheme` (theme.ts exports ResolvedTheme and LIGHT). There is no `Theme` type.
export interface RenderCtx {
  readonly theme: ResolvedTheme;
  readonly watermark: WatermarkState;
  readonly highlightComponentId?: string;   // NEW — named component renders with the highlight
                                            //   treatment (2x stroke + hatch + leader arrow, A-3);
                                            //   everything else at 55% ink. Unknown id = no-op.
  readonly labelChip?: 'none' | 'name';     // NEW — default 'name' (drawings); cards pass 'none' (A-5)
  readonly idPrefix?: string;               // NEW — default '' (A-6)
}
```

Base output is **byte-identical when the three new fields are unset** — golden-asserted.

## 2.5 Quiz modes — interaction specs and ship order

| Mode | Drills | Ships (TIMBER / SAP-2) |
|---|---|---|
| **M-1 FLIP** | recognition + recall — the owner's verbatim ask | F2 / F7 |
| **M-1b FLIP-REVERSE** | **production** — front = name + "where does it go?", back = highlighted art + facts | F2 / F7 |
| **M-2 IDENTIFY** (4-choice over the card's own art) | recognition under choice pressure | F4 / F8 |
| **M-2b IDENTIFY-IN-SCENE** (live studio) | recognition in 3D — the only `{kind:'scene'}` consumer | F4 / — |
| **M-3 NAME-TO-PART** | production, the field task ("go point at it") | F4 / F8 |
| **M-4 STAGE-ORDER** | build sequence / priorities of work | F4 / F8 (gated R2a) |

**Why flip-reverse ships in the same phase as flip (FD22).** Without it, nothing exercises
name-to-structure production until M-3's pick plumbing lands — possibly months. Reverse
flip needs **zero new plumbing** (same scheduler, same art, faces swapped) and front-loads
the direction the field task actually demands. It is also the honest flip direction for
SAP-2 fallback-art cards (FD13).

**M-1 / M-1b.** Two sub-modes: **Browse** (no scheduler; ‹ › through the deck in teaching
order; tap or Space flips; position chip `4 / 17`) and **Drill** (queue from
`buildSession`; `PROMPT --flip--> REVEALED --mark--> next`). `[Again]` (left) and
`[Got it]` (right) are visible whenever REVEALED. After the last card: a one-screen
summary (n got / n again), **shown once and discarded**, then `sealSession`. The PROMPT
copy reads **"Say it out loud, then flip."**

**M-2 IDENTIFY.** Subject glows (1.2 s pulse; `prefers-reduced-motion` → steady bright
highlight + outline, no pulse). Four choice chips in a 2×2 bottom-thumb grid: the correct
`back.name` + 3 `pickDistractors`, chip order shuffled by the same seed. Correct tap → chip
gets a confirm style + `✓` **and the back content slides up** (identify always teaches
after answering). **Advance on user tap only** (FD23): a 900 ms auto-advance cannot cover
reading name + plain + whereItGoes, and post-answer study *is* the learning event; if
auto-advance is ever added it is a setting defaulting **off** and never fires after a
wrong-answer reveal. Wrong tap → that chip dims + shakes (reduced-motion: dims only) and
**stays**, one retry; a second wrong reveals the correct chip + back content and marks
`again`. Keyboard: `1–4` select, `N`/`→` next after resolution.

**M-2b IDENTIFY-IN-SCENE (TIMBER, inside the studio).** Prompt banner over the live scene.
Because the canvas is the studio's:

- The canvas is **orbit/inspect-only**. Flip and navigation live on **non-canvas chrome** — buttons and swipes on the chrome strip, never on the canvas. `OrbitControls` (`woodframe-scene.ts:111`) keeps drags.
- `SceneHooks` gains `suppressSelect(on: boolean)`; training mode disables click-select so a tap cannot silently re-tint a random member with `0xff8844` — **the identical colour** used for the subject highlight — and corrupt the stimulus. (Alternative permitted: a distinct training highlight colour; suppression is the default.)
- Touch pick uses a **12 px NDC-radius nearest-member fallback** on coarse pointers (`M-5`, §5.4) — finger-sized studs are miss-prone.
- happy-dom test: **a canvas drag never navigates, flips, or marks.**

**M-3 NAME-TO-PART.** Prompt bar: "Tap a **collar tie**". TIMBER: raycast pick; **any member
of the target role counts** (the unit of knowledge is the role). Hit logic is pure:
`judgeTap(model, role, memberId) → 'hit' | { miss: roleTapped }`. Miss 1 → the tapped
member's own name flashes ("that's a **rafter**") — a miss still teaches. Miss 2 → the
target role glows 800 ms then unglows (at least one un-glowed member must remain tappable;
a single-member role's glow IS the reveal). Miss 3 → full reveal + back content, marks
`again`. A hit after a hint still marks `got` (the hint is pedagogy, not failure).
**On 2D art** (`quiz-place`), the same drill runs through `cardArt(..., { memberIds: true })`,
which emits per-member `data-member` groups **plus invisible ≥44 px pad rects** and a
nearest-member-within-N-px fallback — a stud is a few pixels wide at phone size, and
missing by 3 px reads to the Marine as "I got it wrong". `timber2-train-quiz` asserts the
minimum tap-target geometry; **if that assert cannot pass for dense presets, `quiz-place`
descopes to projector/desktop and `quiz-id` is the phone floor** (FD24).

**M-4 STAGE-ORDER.** N shuffled chips in a tray (seed `sessionSeed(deckId, session)`), N
numbered empty slots above. **Tap-to-place**, never drag (accessibility + gloves): tap a
tray chip → it fills the lowest empty slot; tap a placed chip → back to tray. `[Check]`
enables when all placed. Grading: per-slot ✓/✗; wrong chips return for **one** retry pass;
the second check reveals the correct order with each stage's detail line **and its source
tag + the verify-against-current-publications line** (SR-7). All-correct-first-try marks
the drill `got` (single progress entry `stage-order`). ≤11 chips (TIMBER max; SAP-2 has 7)
— one screen, no scrolling at 360 px portrait (overflow assert in happy-dom).

## 2.6 Progress, mastery, reset, export

```ts
// localStorage 'timber2-train' (root) / 'sap2-train-v1' (sap2) — versioned envelope
export interface TrainState {
  readonly v: 1;
  readonly decks: Record<string /*deckId*/, DeckProgress>;
  readonly settings: { largeMode: boolean; leftHand: boolean };   // NOTE: no streak field exists
}
```

- **Boot revalidation:** unparseable / wrong-version state degrades to `emptyProgress()` with a non-blocking notice — the "never trust stored bytes" pattern (TIMBER-2 §5.5).
- **Writes** debounced 300 ms, flushed synchronously on `pagehide` / `visibilitychange:hidden` / leaving the trainer — the `timber2-session` flush contract.
- **Mastery** is the **only** persistent indicator: `11 of 17 known` + a three-segment bar. Before any non-flip mode ships, the label reads **`11 of 17 self-checked`** (FD10) — the bar cannot claim recall it has not tested.
- **Streaks: none ship at all (FD25).** Not off-by-default — **absent**. Streaks optimise app-opening rather than knowing the parts, they require day tracking (reintroducing the wall clock §2.3 just removed), and the audience is units drilled by NCOs. `design-platform.md`'s F2 streak counter is deleted. Re-entry bar: an explicit owner ask logged in `DECISIONS.md`.
- **"Last run" only** on the deck page — **no "best run"** (FD26). On a shared squad phone "best" is somebody else's run, which is the score-chasing this plan refuses; every result still lands in the printed record (§3.6).
- **Reset:** per-deck, two-step confirm (`tap → "Really reset 17 cards? [Reset] [Keep]"`), deletes that deck's `DeckProgress` only.
- **Export / import: TIMBER only (FD27).** `Export progress` downloads the `TrainState` envelope as `timber-train-progress.json` (Blob + object URL, offline); import merges by `deckId` taking the higher `session`. **SAP-2 exposes no export or import**, because `artifactPolicy(...).bareExports` is `false` in TEMPLATE and TRAINING and SR-9 gates every affordance on it. Value-free by construction (SR-6). Nothing syncs, ever.

## 2.7 Mobile + desktop interaction spec (binding)

```
┌──────────────────────────────┐
│ ‹ back   DECK TITLE    4/17  │  header 44px
│┌────────────────────────────┐│
││                            ││
││        CARD FACE           ││  art fills width; tap anywhere = flip
││   (deterministic SVG)      ││  swipe surface; touch-action: pan-y
││   banner/regime line is    ││  <- CARD CONTENT, never hidden (SR-4/FD20)
││   INSIDE the face          ││
│└────────────────────────────┘│
│  ▢▢▢  11 of 17 known         │
│ ┌───────────┐ ┌────────────┐ │
│ │ ↺ AGAIN   │ │ ✓ GOT IT   │ │  64px tall, bottom thumb zone; REVEALED only
│ └───────────┘ └────────────┘ │  (PROMPT shows one full-width FLIP button)
└──────────────────────────────┘
```

| Item | Binding rule |
|---|---|
| **Targets** | Primary flip / mark / choice buttons **≥ 64 px** tall (SAP-2's glove rule adopted in both apps for one muscle memory); every other control **≥ 44 px**. Asserted on computed `min-height` in happy-dom. |
| **Gestures** | Buttons are the contract; swipes are sugar. Tap card = flip. REVEALED: swipe right ≥25% width (or fling velocity) = Got it; left = Again; during drag the card shows a **word + icon** overlay (`GOT IT` / `AGAIN`), never colour alone. Browse: swipe = next/prev. PROMPT: a horizontal swipe gives an 8 px resist + "flip first" hint — unseen cards are never marked. Claim rule: horizontal only when `|dx| > 1.5·|dy|` and `dx > 12 px`; otherwise the browser scrolls (`touch-action: pan-y` on the card). Never intercept two-finger or vertical scroll. Pointer capture on claim; cancel restores. |
| **Mis-swipe recovery (FD28)** | Every **gesture-originated** mark shows a ~3 s snackbar **"Marked Got it — Undo"**, wired to the same one-step undo as the `U` key. A phone fling must not silently promote a card the user did not know. Pointer suite asserts undo restores `box`, `lapses`, `seen`, `gotBy` exactly. |
| **Flip animation** | CSS `rotateY` 300 ms, transform-only, `backface-visibility`. `prefers-reduced-motion: reduce` → 80 ms crossfade, no 3D transform; the identify pulse becomes a steady highlight. Asserted by class presence under a mocked media query. |
| **Desktop keyboard — ships in F2, not later (FD29)** | `Space`/`Enter` flip; REVEALED: `→`/`G` Got it, `←`/`A` Again; browse: `←`/`→` navigate; `1–4` identify choices; `U` undo; `Esc` back to deck list. Keys no-op when focus is in `input`/`select`/`textarea` or a dialog is open (T3 keyboard-guard rule, adopted verbatim). **Training keys register through T3's accelerator registry** (which already binds `1..9,0` and `C`); a test asserts no duplicate binding across studio and training routes. |
| **Projector / Big mode** | A `Big` toggle (persisted; also `?big=1`) sets root `data-big`: type scale ×1.6 (back name ≥ 34 px, facts ≥ 22 px), hit targets unchanged. **Chrome hiding never hides the regime line or the watermark banner** — those are card content (FD20). Projector mode keeps **real tap targets**: large bottom-bar prev/flip/next buttons and an on-screen A–D answer row, scaled with the type scale. Keyboard bindings are **additive, never the sole path** (FD30) — the common field "projector" is a phone or tablet on an HDMI dongle with no keyboard, and a locked government laptop in kiosk mode has the same problem. Acceptance: a full projector run completed **by touch only** on a mirrored phone. |
| **Feedback is never colour-only (FD31)** | Every scored state pairs a word and a glyph: `CORRECT ✓` / `NO — it is the cap plate`. Colour reinforces. An a11y assert covers screen **and** print. |
| **Load** | Decks compile from the already-loaded engine at entry (<50 ms budget); art memoized in memory (A-8); **zero fetches**. Training routes must not pull the studio bundle: gate on transferred JS for the training entry (≤150 KB) plus an assert that **no `.glb` is fetched** on a training route and **no WebGL context is created** (`canvas.getContext('webgl')` spy). |
| **A11y floor** | Flip state announced via `aria-live="polite"` ("Back: collar tie"); everything Tab-reachable; card is a `<button>` in PROMPT state with `aria-pressed`; faces toggle `aria-hidden`; contrast ≥ 4.5:1 using each host app's existing ink tokens (no new colours beyond the highlight, which is always paired with a text label and a non-chromatic treatment). |
| **Setup time (FD32)** | `#/train/hip` with **no deckId** resumes the last-used deck; a pinned **3-item recent-decks row** sits at the top of `#/train`; **"Hip-pocket" is the primary button on each deck card**. Acceptance: **lock screen → first card in ≤ 60 s and ≤ 4 taps**, warm-tab airplane mode, run by a **non-owner**. Hip-pocket classes die in the getting-there, not the 15 minutes. |

---

# 3. Training programs

### 2.7.1 Desktop (≥1024 px) — binding (gap-16 fix)

"Super well on desktop" is a named mandate, not a fallback. At `pointer: fine` and
width ≥ 1024 px:

- **Two-pane layout:** a left deck/lesson rail (fixed 280 px, scrollable, current card
  marked) beside a centred card column with `max-width: 720px` so the art never
  balloons on a 27-inch monitor. Below 1024 px the rail collapses to the existing
  header control.
- **Hover + focus:** `:hover` affordances on every actionable element (they are inert
  on touch), and a visible `:focus-visible` ring on all of them — keyboard operation
  is a first-class path, not an accessibility afterthought.
- **Target relaxation:** the 64/44 px floors apply at `pointer: coarse`; at
  `pointer: fine` the floor is 32 px, so a desktop UI is not comically large. Asserted
  by media-query, never by user-agent sniffing.
- **Resize/orientation:** crossing 700 px or 1024 px re-lays out without losing card
  position, flip state, or scroll (a resize is not a navigation).
- **F2 acceptance row:** a **1440 px mouse-and-keyboard run** — flip, mark, next,
  previous, and deck switch using only the keyboard, then only the mouse.

**`settings.leftHand` (gap-17 fix):** mirrors the horizontal order of the two mark
buttons (AGAIN / GOT IT) and the browse chevrons, so a left-thumb user reaches the
positive action. It changes order only — never labels, colours, or key bindings.
Asserted in `train-ui`: toggling it swaps DOM order of exactly those controls and
nothing else. (If an implementer finds no user demand at F2, deleting it is
sanctioned — record the deletion in `DECISIONS.md` and drop it from `TrainState`.)

## 3.1 The ladder — crawl, walk, run, build (compiled, never authored)

The same four rungs compile for every catalog family and every custom build. Nothing
below is authored per structure.

```ts
// src/timber/train/curriculum.ts
export type LessonKind =
  | 'flashcards' | 'stage-walk' | 'quiz-id' | 'quiz-place'
  | 'drill-bom' | 'drill-cutlist' | 'drill-omission' | 'build-exercise' | 'external';

export interface LessonSpec {
  readonly id: string;                 // 'lesson:<kind>:<n>' stable within a curriculum
  readonly kind: LessonKind;
  readonly title: string;
  readonly deckId: string;
  readonly stageOrdinal?: number;
  readonly questionCount?: number;
  readonly estMinutes: number;         // FD35 — compiled estimate, shown on every menu row
  readonly passBar?: { correct: number; of: number };   // DISPLAY + record only, never a lock
  readonly external?: { href: '/survivability/'; label: string };   // content-free (FD36)
}

export interface StageWalkContent {
  readonly entry: { ordinal: number; label: string; detail: string };
  readonly say: string;                            // STAGE_NOTES line
  readonly newRoles: readonly string[];            // roles first appearing this stage
  readonly cutLines: readonly CutLine[];           // cutList(membersOfStage) — the real one
  readonly manHoursLine?: string;                  // with the "(PH rates)" footnote, display only
  readonly beforeSvg: string; readonly afterSvg: string;
}

export interface CurriculumSpec {
  readonly id: string; readonly deckId: string; readonly title: string;
  readonly lessons: readonly LessonSpec[];
}

export function compileCurriculum(deck: DeckSpec, model: StructureModelLike): CurriculumSpec;
export function stageWalkContent(model: StructureModelLike, ordinal: number): StageWalkContent;
export function hipPocketPlan(curr: CurriculumSpec): readonly HipScreen[];   // §3.2
export const estimateMinutes = (l: LessonSpec): number;   // cards x 12s, questions x 20s,
                                                          // stage-walks x 60s — pinned constants
```

**The curriculum is a MENU, not a queue (FD35).** The compiled ladder for a live catalog
family is ~25 lessons (whole deck + one stage-walk per `stagePlan` entry — the `StageKey`
vocabulary is 19 keys — + 2 quizzes + 2 drills + capstone + external). A corporal with a
12-minute gap cannot see what fits in a 25-item queue, so he opens the deck and
improvises and the ladder goes unused. Therefore:

- `#/train/deck/<id>` renders the curriculum as a **menu with a minutes estimate on every row**.
- The **hip-pocket block is the primary action** on the deck page; the full ladder is the schoolhouse path, never the default.
- Order is still compiled and binding: `flashcards` → one `stage-walk` per `stagePlan` entry **1:1, in build order** (a hand-maintained stage list is forbidden and tested against `model.stagePlan` by mutating a copied plan and re-compiling) → `quiz-id` → `quiz-place` → `drill-bom` → `drill-cutlist` → `build-exercise` → one `external` row.

**Rung 1 — Flashcards (§2).** The mandate surface. Route `#/train/deck/<id>`; deck order
= build order = teaching order; a stage-filter chip row slices the deck.

**Rung 2 — Stage walkthrough** (`#/train/walk/<deckId>/<ordinal>`). The scrubber
re-presented as a lesson, one stage per screen: header `Stage 3 of 9 — Floor joists &
bridging`; a **before/after thumbnail pair** (ordinal−1 small, ordinal large, new members
highlighted); the `STAGE_NOTES` say-line; "New pieces this stage" — each new role's PLAIN
+ WHAT, tappable through to that flashcard; then the stage's **real cut-list table** and
the man-hours line with the existing `(PH rates)` footnote; prev/next; "quiz me on this
stage". Inside the desktop studio an "open in 3D at this stage" link deep-links
`#/build/<id>` with the stage set — the walkthrough never re-implements the scene.

**The cut-list table is a shared renderer, not a fork (FD37).** The table lives in the
studio today (`woodframe-scene.ts:297–308`). §6.2's collision map adds a row extracting it
to `src/ui/woodframe/tables.ts` at T3, with the studio and training both consuming it —
the same treatment the labels dictionaries get. Until that extraction exists, the
walkthrough renders through a thin local adapter that is deleted at the extraction.

**Rung 3 — Quizzes** (§2.5 M-2/M-3 + `#/train/quiz/<deckId>/<kind>`). Shared shell:
question art, prompt, four option buttons ≥44 px labelled A–D **for oral classroom use**,
instant feedback (word + glyph, §2.7), running score, end screen with per-card misses and
"log this session".

**Rung 4 — Build exercise (capstone).** Deliberately humble — a **wrapper**, because the
toolkit's existing surfaces already are the exercise materials. A checklist page compiled
from the `stagePlan`: per stage, name + member count + cut-list reference + a "crew
read-back" line + a check row (press-and-hold ~600 ms to tick, borrowing SAP-2's
rain-proof gesture; ticks live only in the session record). Buttons print the per-stage
cut lists and stage sheets. It does **not** schedule labor, assign tasks, or time crews —
that is the packet's job and the NCO's. Its "print the packet's sheets" action names
**§4 of this document** as the owner (FD38 — the sibling deferred to "the packet
workstream" as if singular while two designs both claimed it).

**Authored content is exactly two closed-vocab tables plus one copy table:**

| Table | Domain | Lockstep test |
|---|---|---|
| `STAGE_NOTES` | `Record<StageKey, { say: string }>`, **plus an optional `Record<`\`${familyId}:${StageKey}\``, string>` override** (FD39) | every `StageKey` has an entry; every override key is a **live family × live stage** pair; ≤160 chars; plain register |
| `CONFUSION_GROUPS` | role → group over the closed `MemberRole` vocab | every role is in exactly one group **or falls back to `'ungrouped'`** (FD40) |
| `copy.ts` | **every** authored training string | the training copy table is the **only** source of training strings, and contains **no numerals** (FD41) |

**`CONFUSION_GROUPS` must not gate TIMBER-2 (FD40).** The sibling's TI-5/TI-9 made every
new `MemberRole` from T4–T7 a **build failure** until a distractor-group line was added —
putting a training-owned table on the critical path of a tower/crib/tent phase. Missing
roles instead degrade to `'ungrouped'` (random same-model distractors) with an **advisory**
test, never a build failure. §3's "zero training-code change per family" claim is corrected
to: **zero training-code change; one advisory distractor-group line per new role, at the
training session's convenience.**

**`copy.ts` is the only string source (FD41).** The sibling's authored-content inventory
was undercounted: beyond `STAGE_NOTES`/`CONFUSION_GROUPS`/8 script lines there are fixed
card captions, drill prompt templates, cut-list question grammars, worksheet instructions
and word-bank copy, calibration-card copy, sheet footers, the posture block, and the
external row. All of them route through `copy.ts`. The test asserts no training module
contains a user-visible string literal.

## 3.2 Hip-pocket class mode — one phone, five Marines, fifteen minutes

Route `#/train/hip/<deckId>` **and `#/train/hip` (no id, resumes the last deck — FD32)**.
The corporal holds the phone; the fire team answers out loud.

```ts
export type HipScreenKind = 'intro' | 'card' | 'stage' | 'oral-question' | 'pass-phone' | 'log';
export interface HipScreen { readonly kind: HipScreenKind; readonly ref: string; readonly script: string }
export const HIP_BUDGET: Readonly<Record<HipScreenKind, number>> =
  { intro: 1, card: 5, stage: 3, 'oral-question': 5, 'pass-phone': 1, log: 1 };
```

- **Screen sequence = `hipPocketPlan(curriculum)`**, a pure function over the `HIP_BUDGET` table. Time-boxed by **counts, not clocks** (offline, glare, gloves — a countdown would be theater). An elapsed-time line displays passively; **nothing ever auto-advances**.
- **Deterministic selection:** the first 5 deck cards (build order); the 3 stages with the most new roles (tie-break: earlier ordinal); quiz seed = `sessionSeed(deckId, session)`.
- **Hip stage screens are stripped (FD42).** They render **only** the `STAGE_NOTES` say-line, the new-role PLAIN/WHAT rows, and the before/after thumbnail pair. **No cut-list table and no man-hours line** — a multi-row table on a phone held up in front of a fire team is unreadable at arm's length and irrelevant to an oral ID class; it pads the fifteen minutes with dead screens. Cut list and MH stay on `#/train/walk`, the stage poster, and the printed sheets. The hip screen's content shape is asserted in `hipPocketPlan`'s suite.
- **`pass-phone` is a designed screen kind**, inserted between blocks — hand-offs are a step, not an accident.
- **In-run position persists** (current index, requeue list, score, seed) in the `timber2-train` envelope with the debounced-write pattern, and resumes on re-entry. Without this, any back gesture, lock, or accidental route change during a hand-off restarts the run — and the T3 router explicitly pushes history states for popovers, so a back press is likely.
- **Oral quiz presentation:** options as big A/B/C/D rows; the instructor taps the letter the team called; feedback shows the WHAT line to read aloud.
- **Log screen:** prefilled `mode: 'hip-pocket'`; **participant COUNT by default, one tap to save**; "skip logging" is equally prominent. See §3.6 for why names are not typed and not stored.
- **Never blocks (FD46).** The record cap never blocks starting or running a session — see §3.6.
- Entry copy carries the offline sentence from §1.4.

## 3.3 Projector / large-screen classroom mode

A presentation **state**, not a second app: a `Projector` chip on any training route
(persisted) sets a root class — type scale ×1.6, card art max-height 70vh, cursor
auto-hidden after 3 s idle. Per §2.7 it **keeps real tap targets** (bottom-bar
prev/flip/next + on-screen A–D row); keyboard is additive. The regime line and any
watermark banner remain visible (FD20). No second rendering path, no slide export.
Acceptance: 1080p at 3 m, card text readable; **and a full run completed by touch only on
a phone mirrored to a TV.**

## 3.4 Printable training aids

All compiled from the same `DeckSpec`/`StagePlan`/art, all deterministic SVG, all through
the same print helpers as the packet (§4.5). Every sheet footer carries deck id, spec
fingerprint, app version, a hand-fill date line, and the `(PH)` footnote when any doctrine
line appears on the sheet. **All printables obey §4.5's print rules** — mono-laser safe,
Background-graphics-OFF safe, `<tfoot>`-repeating footers, no CSS-background meaning.

**3.4.1 Flashcard sheets (2-up and 4-up, duplex).**
- 4-up: Letter portrait, 2×2 grid, cell 3.75×4.6 in, crop marks.
- **Three duplex modes ship, not one (FD45).** Company printers are routinely simplex or short-edge default; a corporal who discovers a mismatch after six pages stops using the feature. Modes: **long-edge** (mirror columns `(r,c) → (r, C−1−c)`), **short-edge** (mirror rows `(r,c) → (R−1−r, c)`), **manual/simplex** (all fronts, then all backs in re-feed order, with printed instructions). All three mirrors unit-tested including the **1-column identity** case. The chosen mode prints in the sheet margin.
- **Calibration marks move to the sheet margin** — they no longer burn a card cell.
- Card faces are the same `CardFront`/`CardBack` data; `(PH)` and LS marks travel through print unchanged.

**3.4.2 Stage posters.** One landscape page per `StagePlanEntry`: stage name huge,
poster-size art at that stage with new members highlighted, "new pieces" legend (PLAIN +
WHAT), the stage cut list, `STAGE_NOTES` line as caption. A taped-up sequence along a wall
*is* the build sequence. **Posters are a print OPTION on T3's stage-sheet page, not a
second generator (FD44).** Dependency row: *if T3 descoped stage sheets to T8, posters
wait or the training phase owns the stage-sheet page* — decided at that phase's START HERE,
recorded in `DECISIONS.md`.

**3.4.3 Label-the-diagram worksheets + answer keys.**
- Worksheet: the structure SVG with **K ≤ 8 boxes at fixed gutter slots** (predetermined Y positions), leader lines drawn to whichever anchor is nearest; "Name each part"; a word-bank row (the 8 PLAIN names, shuffled by the sheet seed), word-bank on/off a print option.
- **No label-placement solver (FD47).** The sibling specced projected centroids, gutter assignment, Y-sorting, box-box overlap tolerance and in-viewBox leader lines — a geometry subsystem with its own goldens and suite whose only consumer is one printable. `src/render/svg.ts`'s `callout()` is a registry, not a de-collision solver, so nothing was reused. Fixed slots need no overlap logic and cost a tenth as much.
- **Variants A/B/C (FD48).** Fully deterministic sheets mean five Marines at one table get five identical sheets with the same 8 targets and the same word bank — a copying exercise, not an assessment. A variant selector seeds target selection and word-bank order; the letter prints on the sheet **and its key**. Goldens pin variant A; the layout suite runs all three.
- Answer key = the identical sheet with `answers: true` — the **only** difference, asserted by diffing the two SVGs and finding only text-node insertions.

**3.4.4 Training session sheet — reframed as ATTENDANCE + TOPICS (FD49).** The sibling's
sheet foregrounded `correct/of` fractions and a spec fingerprint, and could not say who
was trained (in a hip-pocket class five Marines answer aloud, so results are a team score
with no linkage to participants). A squad leader files attendance, not a scoreboard.
Letter portrait:

```
UNIT ____________  PLACE ____________  DATE ____________  DURATION ______
EVENT: wood-frame component ID and build sequence — TIMBER-1, FM 5-426
TOPICS COVERED:  <compiled from the lessons run>
ROSTER            (participantCount blank rows for pen entry)
  NAME ______________________________  INITIAL/GO [  ]
  ...
RESULTS: one summary line  ("5 lessons run — 22 of 28 correct across the session")
<the §3.6 posture block, verbatim>
INSTRUCTOR ______________________   SQUAD LEADER ______________________
footer: deck id · spec fingerprint · app version · "(PH)" note when applicable
```

No seals, no crest, no "certificate" framing — it is a record, not an award.

**Compiled order (binding; gap-11 fix):** flip → identify → name-to-part → stage-order →
drill-bom → drill-cutlist → **drill-omission** → build-exercise. `drill-omission` was
missing from this list; it sits after `drill-cutlist` because it presumes the learner can
already read a cut list.

## 3.5 Drills — kept, and one class rejected

**KEPT — `drill-bom` (estimation).** Art with the role highlighted → "How many {PLAIN
role} in this structure?" numeric keypad (`inputmode=numeric`). Reveal shows the engine
count, the guess, the delta, a "within 10%" tag, then re-renders with every member of the
role emphasised and the cut-list line — the reveal is the teaching moment. Scored as
**calibration**, recorded as guess/actual pairs, never a pass/fail gate. Counts are engine
facts of the displayed structure. **Man-hour estimation is excluded** while rates are
`(PH)` (TR-7): training Marines to estimate from placeholder rates teaches wrong numbers.
It unlocks mechanically at T8.

**KEPT — `drill-cutlist` (reading comprehension).** Shows a real rendered cut-list table
for a stage, then asks questions compiled from its `CutLine[]`: "How many pieces of 2x4 at
7'-8 5/8\"?", "What are the 2x10 at 12'-0\" used for?", "Which stock do the cripples come
from?". Answer provenance = `CutLine` fields only. This trains the exact skill the printed
cut sheets demand on site — reading the paper, not memorising it.

**KEPT — `drill-omission` (inspection).** Render stage *k* with one role-cluster **of stage
k** removed via `ThumbOpts.omitIds` — pure member **filtering**, never invented geometry —
and ask "Stage k is called complete. What is missing before you go on?" Options: the
omitted role + 3 distractors. The depicted state is a real mid-stage moment, the same class
the scrubber already shows; restricting omission to the **active** stage's roles guarantees
no build-order-impossible state is ever drawn. Framed on screen as **"Inspection drill"** —
it trains the QA behaviour real supervision demands. Answer = a computed set difference.

**REJECTED — wrong-member / wrong-placement error spotting (FD50).** Generating a
"plausibly wrong" assembly requires **fabricating non-doctrinal geometry** — a stud off
layout, an undersized header — and rendering it with the toolkit's authority behind it.
The engine has no wrong-generator; building one invents wrong doctrine by definition; and
the wrong picture is what lingers. No amount of "find the mistake" framing makes a
fabricated frame stop being a fabricated frame on a doctrine-cited surface. Both regimes
exist to prevent exactly "authoritative-looking wrong content". The omission drill keeps
the honest fraction of the idea.

**Timed identification — optional, OFF by default.** A per-question timer overlay on
`quiz-id` only; a settings toggle, enabled per session. Timing changes nothing about
content, order, or scoring — it records `timedMs` and shows a pace line. **No leaderboard,
no best-time celebration** (§2.6 FD26). Rationale for existing at all: pace pressure is
real in ID training (vehicle/aircraft recognition precedent), but it must never punish the
slow reader by default.

## 3.6 Assessment, records, and the privacy posture

**What is assessed:** per-lesson `correct/of`, estimation calibration pairs, per-stage
exercise ticks, and a deck's **last run**. That is all. No mastery model beyond §2.6's
per-deck bar, no per-Marine longitudinal profile, no gradebook.

**Names are collected but never stored (FD51).** The sibling persisted
`instructor: AttestedName` and `participants: AttestedName[]` plus per-lesson scores — a
named-individual score history on the device, i.e. the gradebook the same document cut,
and an unresolved privacy question deferred to counsel. Instead:

```ts
export interface LessonResult {
  readonly lessonId: string; readonly kind: LessonKind;
  readonly correct: number; readonly of: number;
  readonly timedMs?: number;
  readonly estimates?: readonly { guess: number; actual: number }[];
}
export interface TrainingSessionRecord {
  readonly id: string;                 // 'ts-<seq>'; seq monotonic, never reused
  readonly dateISO: string;            // device clock — labelled "device date — verify"
  readonly deckId: string; readonly deckTitle: string; readonly specFingerprint: string;
  readonly curriculumId?: string;
  readonly mode: 'self' | 'hip-pocket' | 'classroom';
  readonly participantCount?: number;  // FD51 — the DEFAULT capture; one tap to save
  readonly results: readonly LessonResult[];
  readonly externalRuns?: readonly { app: 'sap2'; note: string }[];   // qualitative only
  readonly appVersion: string;
  // NOTE: there is no instructor field and no participants array. Names are collected
  // in the PRINT FORM only and are never written to the envelope.
}
export interface TrainingEnvelope {
  readonly v: 1; readonly seq: number;
  readonly settings: { timedEnabled: boolean };            // default false
  readonly records: readonly TrainingSessionRecord[];      // cap 500 — see FD46
}
```

The printed sheet emits `participantCount` **blank roster rows for pen entry** — which is
how the names actually get captured, and by whom they should be. This kills the deferred
privacy question, shrinks the store suite, and makes the "paper is the record" claim true.

**The cap never blocks training (FD46).** The sibling blocked NEW SESSION START at 500
records — the tool refusing to teach at formation time because a convenience buffer is
full, contradicting its own rule that nothing locks content behind state. Only the **SAVE**
step is blocked, and at cap the user gets two one-tap outs: **"print/export the sheet, then
save"** or **"save and drop oldest"** with a visible banner naming exactly what was
dropped. The no-silent-drop rule is kept by making the drop **loud**, not by blocking
training.

**Lifecycle:** create (end of any run, or logged hip-pocket/classroom session) → review at
`#/train/records` (filter by deck/date/mode) → print the session sheet → export all as
`.timber-training.json` → clear (single confirmed action). No import in v1 — merge
semantics for a convenience buffer whose record of note is paper are not worth the trust
questions.

**The privacy posture (binding copy — renders on the records page and prints on every
session sheet):**

> Names on this sheet are typed and attested, not authenticated. Training results are
> stored only in this browser, on this device. This toolkit has no accounts, no
> analytics, and makes no network requests; results leave the device only when you
> print or export them. Anyone with access to this device and browser can view or
> erase these records — treat the printed sheet as the record of note.

The attested-not-authenticated language is SAP-2's (§2.5), reused verbatim by intent. The
no-network claim is enforced by `check:offline` + N-1b. Device-clock dates are labelled as
such; no monotonic high-water machinery — that is SAP-2 commissioning-grade apparatus and
a training log does not warrant it.

**What deliberately does not exist:** accounts, roster sync, server, telemetry of any
kind, cross-device merge, photo/signature capture, and export of anything the user did not
explicitly type or score.

## 3.7 The SAP-2 boundary — compose, never duplicate

SAP-2's training story already exists in its blueprint and is better than a timber-side
clone could be: the Build Card deck (generative from `computeStages`), BUILD mode, the
TRAINING fill class with inline FICT, watermark states, and the §3.8 comprehension
protocol with human trials. Therefore:

1. The hub-level "position + structure" track carries **one `external` lesson** whose copy is **content-free (FD36)**: label `Survivability positions`, note `the planner ships its own training surface; run it there`, and **the href is the only SAP-2 fact on the row**. The sibling's copy hard-coded SAP-2 internals that do not exist in code ("Run the one_man Build Card deck — BUILD mode, TRAINING fill"); mode names, fill classes and position ids will drift, and an import wall cannot catch a string. A **noun lint** asserts no SAP-2 mode, fill-class, or position noun appears in `src/timber/train/**` or the training UI (XR-3).
2. `externalRuns` rows are **qualitative only** ("deck walked", attested) — never values, states, or counts read out of SAP-2.
3. Nothing under `src/timber/**` or `src/ui/woodframe/**` imports from `sap2/` (import-graph test). SAP-2's ship-empty regime cannot be end-run through a training surface.
4. SAP-2's **comprehension-gate machinery is NOT applied to timber cards** (FD52): different audience and stakes. Timber flashcards teach trade vocabulary to Marines with an instructor present, and the terms of art ("cripple", "jack stud") **are** the content — they would fail a top-3000 word allowlist by design. What IS reused: plain-language-first (the WHAT lines already exist), the rain-proof press-and-hold check gesture, and the attested-identity language. Recorded so nobody "helpfully" bolts the allowlist on later.
5. A SAP-2-side deck-rehearsal mode over its own TRAINING fills is a **suggestion for SAP-2's backlog** (post-R3, inside its FICT regime, built by a SAP-2 session against the blueprint) — not built by this plan.

## 3.8 What the training layer never does

No accounts. No content locked behind a score (`passBar` is display + record only — a
corporal re-teaching a weak team must never fight the tool for access). No adaptive
difficulty (with 20–40 cards there is nothing to adapt). No audio/TTS (platform-inconsistent
offline; instructors narrate better; screen readers already read the DOM). No authored
video or animation (the stage scrubber IS the animation, generated and always in sync). No
multiplayer/buzzer (requires networking — an N-1 violation; the hip-pocket oral mode
delivers the same social pressure at zero bytes). No QR codes (a ~200-line encoder to
encode a URL that prints as text). No certificates with seals or crests
(impersonation-adjacent instruments the toolkit has no authority to issue). No
drag-and-drop "build it yourself" sandbox (a month of UI for a skill the build exercise
teaches with real lumber; the engine is parametric, not free-assembly, so it would be a
second engine). Full ranked table with reasons: §7.3.

---

# 4. The command packet

> Owner mandate #3, verbatim: *"build out a blueprint custom structure and give it to
> command showing them how many man-hours, what exact materials, anything like that …
> the same concept as the SAP job sheet, just better in every way."*

**Thesis: the packet is a projection, never a second computation.** TIMBER's packet is a
pure function of `StructureModelLike` + `BomSummary` + a `PacketSpec` of operator choices;
SAP-2's is a pure function of `Result` + `WatermarkState` + `RenderOpts`. Every number on
packet paper is the same number the viewer, cut lists, and BOM already show, because it is
aggregated from the same `Member[]` / `Result` — `bom.ts`'s own header discipline ("the
scene and the paperwork can never disagree") extended to the command deliverable. The
packet adds **zero new number sources**.

## 4.1 Anatomy — section by section

Print order is **cover → exec summary → materials → labor & schedule → assumptions →
ANNEX A (drawings)**. Drawings move to an **opt-in annex** (FD53): the sibling put ~18
drawing sheets (`break-before: page` each: plan + section + 4 elevations + 2 iso + ~6
two-up stage sheets + 4 strips) **before** materials and labor, with no page cap anywhere.
A ~25-page packet with the BOM on page 20 does not get read. **Default print = the first
five sections with a hard ≤6-sheet target**; drawings print as `ANNEX A — DRAWINGS (n
sheets)` when requested. A page-estimate assertion enforces the target.

### 4.1.1 COVER (1 page, never splits)

| Element | TIMBER source | SAP-2 source |
|---|---|---|
| Structure name | `spec.label` else `FamilyDef.name` | `trainingLabel`-class plain name from `Result` |
| Configured summary line | compiled from spec ("20×16 ft · 8 ft walls · gable 4:12 · piers") | inputs summary via registry plain names — never raw enum ids |
| Thumbnail | runtime SVG art (`cardArt`, memoized) at ~3 in; **pre-T2 fallback: the S-wall elevation SVG** | plan miniature (`drawPlan` scaled) |
| **Routing block (FD54)** | `SUBMITTED TO ____ / THROUGH ____ / SUSPENSE ____ / POC + PHONE ____` — all hand-fill, so the no-clock rule is untouched. Paper with no routing and no point of contact dies in the in-box. | same |
| Requesting unit / date / prepared-by | hand-fill blanks; `preparedBy` text if given, labelled "attested, not authenticated" | **gated on `artifactPolicy(state).fieldHeaderBlanks` (FD55)** |
| Provenance | TIMBER honesty strip (§4.3) | the SAP-2 watermark band + provenance strip, inherited exactly |
| Contents line | **ordinal only** — section names, **no page numbers** (FD56) | same |
| Annex sheet count | `ANNEX A — DRAWINGS (n sheets)` when included | same |

**FD55 — SAP-2 needs a fifth policy boolean.** The sibling printed hand-fill
`REQUESTING UNIT / DATE / PREPARED BY` on the SAP-2 cover **in every watermark state**,
ungated. `artifactPolicy` makes signature-shaped ink COMMISSIONED-only precisely so
uncommissioned paper cannot look official — and a ruled line under a role label **is** a
signature block. Its own R-S1 lint also forbids a fifth state-conditional inside the
renderer. Fix, in `sap2/src/schema/watermark.ts`:

```ts
export const artifactPolicy = (s: WatermarkState): {
  readonly signatureBlocks: boolean;
  readonly governingValuesTable: boolean;
  readonly bareExports: boolean;
  readonly fictSuffixOnNumerals: boolean;
  readonly fieldHeaderBlanks: boolean;      // NEW — s.state === 'COMMISSIONED'
} => ({ ...,  fieldHeaderBlanks: s.state === 'COMMISSIONED' });
```

The whole cover hand-fill block gates on it; R-S1 cites it; the four-state fixture matrix
gains the case. Uncommissioned covers print the **state word** where the blanks would be.

**FD56 — page numbering is a CSS counter, and the contents line is ordinal-only.** The
sibling promised a "generated list of included sections with page-order" while conceding
pagination is browser-only — the pure node renderer cannot number pages. And the packet had
**no page numbers at all**: a duplexed packet nobody can say "see page 4" about. Fix: the
repeating footer carries `Page ' counter(page)` beside the honesty strip; the contents line
lists section names only. The counter rule is a structural lint.

### 4.1.2 EXEC SUMMARY (1 page — the S-3/S-4 thirty-second read) — SEVEN blocks (FD57)

The sibling's six blocks were WHAT / WHY SIZED / LABOR / MATERIALS / HONESTY COUNTS /
DECISION LINE — which answers **none** of the three questions command actually asks. There
was no ASK (crew from whom, Class IV to requisition, equipment) and no RISK (impact if not
approved); HONESTY COUNTS was the tool auditing itself in the prime real estate; and the
DECISION LINE said what signing *means*, never what is *requested*.

| # | Block | Content |
|---|---|---|
| 1 | **WHAT** | family + one-liner + overall dimensions + stories + foundation. One compiled sentence. |
| 2 | **WHY SIZED AS STATED** | ≤6 bullets compiled from `FamilyDef.locks` with cites, `deviationMarks` at non-drawing values, and `SpecIssue`s of kind `clamped|forced|ls-note`. The page that answers command's first question — *why is it this big* — from the same data that sized it. |
| 3 | **LABOR** | total man-hours + the crew-scenario table (§4.4), with **the governing rate printed inline on the block**. |
| 4 | **MATERIALS ROLLUP BY CLASS** | one row per `classifyNominal` class (lumber / sheet / hardware / other-incl-concrete): pieces, board-feet or unit totals, cube, weight. ≤6 rows by construction. |
| 5 | **REQUEST** | **NEW.** `crew of N for M shifts from ____` · `Class IV list attached (see MATERIALS)` · `equipment: ____` · `site prerequisite: ____`. Operator-filled blanks where the tool cannot know. |
| 6 | **RISK / IMPACT IF NOT APPROVED** | **NEW.** Top three, in mission terms. Operator-filled — the tool never invents mission risk. |
| 7 | **DECISION LINE** | one fixed sentence naming what signing means. TIMBER: *"This packet is a planning estimate compiled from cited defaults; unit review lines are on the last page."* SAP-2: state-dependent per `artifactPolicy`. |

**HONESTY COUNTS is demoted to the assumptions page.** The honesty *strip* still repeats
on every page (§4.3) — it is the footer, not a headline block.

### 4.1.3 MATERIALS — the exact BOM, made orderable

The single biggest gap in the sibling design: **the material list was not orderable.**
`CutLine` carries only `nominal / cutLengthIn / count / roles / memberIds / boardFeet`;
`Member.grade` (`'No. 2 common'`) is **dropped** by `cutList()`; there is **no species, no
treatment, and no unit of issue anywhere**. `2x4, 12 ft, 37 pieces` cannot be requisitioned,
and sills/posts/footing-bearing members need ground-contact PT the model never states.

**FD58 — additive engine changes, at their specced homes, in the packet phase:**

```ts
// src/timber/types.ts — additive fields, generator-set
export interface Member {
  // ... existing ...
  readonly species?: string;        // e.g. 'SPF'
  readonly treatment?: 'none' | 'ground-contact' | 'above-ground';   // derived by role, cited
  readonly nailingRef?: string;     // the ref for the NAILING claim (TR-2b)
  readonly ph: boolean;             // FD59 — is this member's doctrineRef pending verification
  readonly refId?: string;          // stable citation identity
}

// src/timber/bom.ts — additive
export type NominalClass = 'lumber' | 'sheet' | 'hardware' | 'other';
export function classifyNominal(nominal: string): NominalClass;   // §3.7 signature, T1 inherits it
export interface CutLine {
  // ... existing ...
  readonly grade: string; readonly species?: string;
  readonly treatment?: Member['treatment'];
  readonly unitOfIssue: 'EA' | 'LF' | 'BF' | 'SHT' | 'CY' | 'LB' | 'MBF';
}
export interface StageBom { /* ... */ readonly concreteLF: number; readonly concreteCuYd: number }
export interface BomSummary { /* ... */ readonly concreteLF: number; readonly concreteCuYd: number }
```

`treatment` is derived from role (`sill | post | footing | foundationWall`) **with a
doctrine cite**; a role without a cited rule gets `undefined` and the column prints blank,
never a guess. **Unit of issue prints on every quantity row** — table and CSV both.

**FD60 — sheet goods must separate by thickness.** `floor.ts:383` emits subfloor as
nominal `'4x8 panel'` at 3/4"; `roof.ts:216` emits sheathing as `'4x8 panel'` at 1/2". Since
`cutList` keys on `nominal|length`, "panel counts by nominal" collapses **two products into
one order line**. Fix (additive generator change, budgeted in the packet phase): emit
`'4x8 panel 3/4"'` and `'4x8 panel 1/2"'`. **Sheets to buy** = panel area ÷ 32 ft² rounded
up **per thickness**, printed beside the piece count (ripped panels count as pieces cut,
not sheets bought). Test: no two thicknesses share a BOM row.

**FD61 — `stockFit`'s domain is lumber only.** The sibling specced `stockFit(lines,
stockLengthsFt)` over **all** `CutLine[]`, which includes `'4x8 panel'` and the concrete
nominals `floor.ts` emits (`'conc slab 4"'`, `'conc footing 16x8'`, `'conc wall 8"'`,
`'conc pad 16x16x8'`). It would print purchase lines telling supply to buy 12-ft lengths of
concrete slab. Worse, the cube formula indexes `DRESSED[nominal]`, which has **no panel and
no concrete entries** — cube goes `NaN`. Fix: `stockFit`'s domain is pinned to
`classifyNominal(n) === 'lumber'`; sheets and concrete route through their own paths. Tests:
no non-lumber nominal reaches `stockFit`; **every cube/weight term is finite** for a fixture
containing panels, concrete and the built-up girder; a `DRESSED` miss **omits the row**,
never prints `0` or `NaN`.

Section contents:

- **Lumber by nominal + length**: `CutLine[]` aggregated per nominal — cut length (eighth-rounded, `fmtFtIn`), count, roles served, board-feet, grade, species, treatment, unit of issue.
- **Stock purchase table** (`stockFit`, lumber only): first-fit-decreasing over `PacketSpec.stockLengthsFt` (default `[8,10,12,14,16]`) — per nominal, stock length × pieces to buy, cuts served, exact `wasteLF`; kerf ignored **and stated**; cuts longer than the longest stock render `ORDER SPECIAL LENGTH — n ft`, never silently split.
- **Sheet goods** per thickness (pieces cut + sheets to buy).
- **Concrete**: `concreteLF` + `concreteCuYd` from `Member.actual` (which `floor.ts` already sets for slab/footing/wall); a member without `actual` **omits the row** rather than printing 0.
- **Hardware & nails**: pre-T8, a per-member nailing-schedule note pointing at the cut schedule; post-T8, nail poundage by size + counted hardware. The section upgrades itself when T8's fields appear — no packet rework.
- **Waste**: the **exact stock-fit remainder only**, labelled `cut-fit waste — no contingency allowance applied`. A percentage contingency is a doctrine number and ships only when cited (parked; a `(PH)` row in `doctrine.LOGISTICS`).
- **EQUIPMENT & PREREQUISITES (FD62 — NEW).** An S-4 cannot approve a build whose generator, saws, ladders, transport and delivery point are unstated. Tools by stage are derivable from the existing per-member nailing strings; transport is sized from the cube/weight already computed; power, site prep and delivery point are hand-fill. Anything unmodelled says so.
- **Class IV table columns (FD62):** `ON HAND` / `REQUISITION` / `LEAD TIME` — operator-filled, printing **blank** rather than being omitted. A Class IV list with no on-hand column and no lead time is not actionable.

### 4.1.4 LABOR & SCHEDULE

- **Per-stage man-hours** from `StageBom.manHours` with the `(PH)` footnote.
- **Crew scenarios** — see §4.4 (max-useful-crew, whole shifts, productive hours, rate printed inline).
- **Priorities-of-work timeline** — one horizontal bar per stage, width ∝ crew-hours, labelled with stage name and shift boundaries. Serial stages, **stated**: "stages run in order; no overlap modeled". Pure SVG from the same rows.

### 4.1.5 ASSUMPTIONS & CITATIONS (the honesty appendix)

- **Citation register** — every distinct cite in the model's members: locator, `(PH)` or verified, and the count of members carrying it. Census totals match the cover strip (test-asserted).
- **LS-GATE table** (TIMBER) — every life-safety constant this model consumes: id, value, cite incl. EM 385-1-1 class, `(PH)` status, "review required" while `ph:true`, with the studio's standing banner sentence repeated above it. A model with zero LS members renders **neither** table nor banner (no cry-wolf).
- **Fidelity lines** — fixed sentences: labor `(PH) rates, linear crew scaling, serial stages`; stock fit `first-fit estimate, kerf ignored`; weight `(PH) density`.
- **The bunker boundary line** — verbatim TIMBER-2 §2.7 on the BOM header **and** here: *"COVER DEPTH: user-stated — protective sizing is a survivability (SAP) decision, not computed here."* Any cover-depth mention is adjacent to that sentence (proximity-regex gate). No cover-depth field in the CSV or any machine-readable block.
- **Spec issues** — every `SpecIssue` in plain language: what the operator asked, what the engine did, why.
- **HONESTY COUNTS** (demoted from the exec page): assumption count, cite census, LS counts.
- **Approval block (FD63)** — hand-fill lines labelled as the *unit's* process, which the tool never pre-fills. **"Reviewed by (unit engineer)" is dropped** until a span check exists: every structural size in the model is pinned and unverified (`'built-up girder (PH: fixed 3-2x10, load-area method pending)'`, `'joist span (PH: 2x8 fixed, span check pending)'`), and inviting an engineer's signature over placeholder sizing is exactly the tool-conferred trust TIMBER forbids. Printed inside the block, verbatim, and in the R-T5 wordlist assert: *"sizing is fixed by the standard drawing and has not been span-checked for this load case; approval covers the resource request, not the engineering."*

### 4.1.6 ANNEX A — DRAWINGS (opt-in)

Ordered sheets, each `break-before: page`, each landscape-safe inside the portrait content
box (wide drawings rotate 90° as an SVG transform, never a page-size change): plan;
section/cutaway; four elevations; 3D key views; per-stage sheets (2-up); layout strips.

**FD64 — "elevations and strips exist today" is FALSE and was the packet's largest
under-scope.** `src/timber/elevation.ts` returns **geometry only** (`WallElevation` rects,
`LayoutMark[]`); it has **no SVG emitter**, and its only consumer is `layoutStrip`. The one
strip emitter in the repo is inline at `woodframe-scene.ts:351` and it has **no `viewBox`**,
an **absolute px width** (`width="${wPx}"`), **9 px (6.75 pt) tick labels**, and
`#b7ad97`/`#e8dcc0`/`#6b6250` ink that photocopies to nothing. It fails this plan's own
viewBox and type-size lints and cannot be scaled by `width:100%;height:auto`.

Fix: **two new pure emitters are budgeted in the packet phase** —
`src/timber/packet/elevationSvg.ts` and `src/timber/packet/stripSvg.ts` — both with
`viewBox` + `width:100%; height:auto`, type ≥9 pt, strokes ≥0.75 pt, **minimum ink ≥60% K**
for any meaning-bearing rule or label, segmentation at 16 ft with continuation labels, and
a worst-case (32 ft wall) fixture in the fit suite. The studio's inline emitter is replaced
by `stripSvg.ts` in the same commit so a second copy never exists. The phase is re-rated
accordingly.

### 4.1.7 BRIEFING VIEW (screen-only)

Large-type render of the same `PacketModel` for a verbal brief from a phone held across a
desk: (1) WHAT + thumbnail + dims; (2) MATERIALS rollup; (3) MAN-HOURS + crew table;
(4) TIMELINE; (5) REQUEST + RISK. Type ≥28 px, one idea per screen, swipe/arrow advance,
honesty strip persistent. It never exports — it is a view, not an artifact.

### 4.1.8 Availability matrix

| Section | TIMBER F3 (pre-T3) | TIMBER F9 (post-T3) | SAP-2 (F10, R6a) |
|---|---|---|---|
| Cover | ✔ (thumbnail = elevation SVG pre-T2) | ✔ | ✔ (watermark band per state) |
| Exec summary (7 blocks) | ✔ | ✔ | ✔ |
| Materials (+units, treatment, sheets-by-thickness, equipment) | ✔ | ✔ (+nails/hardware at T8) | ✔ (job-sheet BOM + rollup) |
| Labor & schedule | ✔ | ✔ | ✔ (real scheduler per crew row) |
| Assumptions & citations | ✔ | ✔ | ✔ (annex rules inherited) |
| Annex: elevations + strips | ✔ (**new emitters**, FD64) | ✔ | — (n/a) |
| Annex: plan / section | — | ✔ (captures + true 2D plan) | ✔ (`drawPlan`/`drawSection`) |
| Annex: 3D key views / stage sheets | — | ✔ | Build Card deck appended, never re-rendered |
| Briefing view | ✔ | ✔ | LATER |

## 4.2 Pre-T1 degradation (so the packet phase is not secretly a T-phase) — FD65

The sibling claimed "NO T-phase required" while its marquee content depended on symbols
**verified absent** from `src/`: `FamilyDef`, `StructureSpec`, `SpecIssue`,
`deviationMarks`, `canonicalizeSpec`, `lifeSafetyRegister`, `StagePlanEntry`,
`classifyNominal`, `thumbnails`. Pre-T1, "WHY SIZED AS STATED" compiles empty, `meta.hash8`
has no source, and `lsCount` has no register. Each degradation is **specced, not
discovered**:

| Symbol absent | Pre-T1 behaviour | Test |
|---|---|---|
| `FamilyDef` / `StructureSpec` / `deviationMarks` | `whySized` compiles from the demo `BUILDING` constants **plus** a printed line: *"design rationale unavailable until the spec model lands"* — never a blank block | render golden |
| `canonicalizeSpec` | `hash8` = FNV-1a-32 over the serialized `Member[]` **plus the canonicalized `PacketSpec` plus `APP_VERSION`/`DOCTRINE_VERSION`** (FD66) | filename vector |
| `lifeSafetyRegister` | LS table and `lsCount` **omitted**, not zero | render golden |
| `SpecIssue` | `issues: []`, section renders "no flags — n checks run" | render golden |
| `StagePlanEntry` | `stagePlanFromLegacy(STAGES)` adapter, 10 lines | adapter test |
| `classifyNominal` | implemented **at its §3.7 home in `bom.ts`** so T1 inherits it — never a packet-local fork | bom test |
| `thumbnails.ts` | cover thumbnail = the S-wall elevation SVG from `elevationSvg.ts` | render golden |

Each fallback is asserted to **render**, not blank.

**FD66 — `hash8` must cover the whole artifact.** Hashing `canonicalizeSpec` alone means
two materially different packets (different `crewSizes`, `stockLengthsFt`, `sections`,
`title`) share one filename and the second download silently overwrites the first — while
the design called the collision "harmless" on an assumption of byte-identity that is false.
Hash `canonicalizeSpec` + a canonicalized `PacketSpec` + `APP_VERSION` + `DOCTRINE_VERSION`.
Lockstep vector: two `PacketSpec`s over one structure spec yield **different** filenames.

## 4.3 Regime compliance — testable rules

### SAP-2 packet (inherit `artifactPolicy`, never reimplement)

| Rule | Statement |
|---|---|
| **R-S1** | The renderer takes `WatermarkState` and calls `artifactPolicy(state)`; a lint asserts it imports the policy and contains **no state-conditional of its own** beyond the policy's **five** booleans + state-word rendering. Signature blocks, engineer-handoff, governing-values table, and now the cover hand-fill block: only when the policy says so. |
| **R-S2** | TRAINING: every numeral carries the inline `FICT` suffix via `displayForArtifact` (FD11); the `TRAINING — VALUES FICTITIOUS` band renders **on every page** as inline SVG (§4.5); **no bare CSV/SVG export controls render** (`bareExports === false`); the watermarked print itself is permitted. |
| **R-S3** | TEMPLATE: every dimension renders its `⟨token⟩`; **zero digits** in the packet; `NO SCALE — TEMPLATE` **and** `DO NOT SCALE` stamps present on every drawing. |
| **R-S4** | FILLED_UNCOMMISSIONED / STALE: diagonal treatments + sub-reason + uncommissioned-print counter threaded through `RenderOpts` as **data**; signature slots render `UNVERIFIED — NOT COMMISSIONED`. **`revoked: true` is surfaced by name**, not folded into "awaiting commissioning". |
| **R-S5** | Provenance rides **inside `Result.fillIdentity`** — the renderer never reads ambient module state (the SAP-1 `getFillState()` defect class, dead by construction). |
| **R-S6** | `validation` is **non-optional** on the SAP-2 `PacketModel`; a clean result renders "no flags — n checks run", never an absent section. |
| **R-S7** | Fidelity lines print in every state; annex page present whenever waivers exist or `singleOperator`. |
| **R-S8** | No clock: rendering is pure in `(Result, WatermarkState, RenderOpts)`; G-9's `Date`/random lint covers the packet file with **zero** new allowances. |

### TIMBER packet (the `(PH)`/LS regime)

| Rule | Statement |
|---|---|
| **R-T1** | Every doctrine-derived numeral traces to a member ref or a `doctrine.ts` entry; the citation-register census equals an independent count. |
| **R-T2** | The honesty strip renders on the cover **and repeats in the footer of every printed page** (mechanism: §4.5 FD69): `PLANNING ESTIMATE — not a build-to field document · spec <hash8> · (PH) pending on n of m cites · LS items: k (review required: j) · TIMBER <buildId>`. Fixed copy in `copy.ts`; asserted verbatim. |
| **R-T2b** | **`buildId` is content-addressed (FD67).** `src/version.ts`'s `APP_VERSION` is hard-coded `'1.0.0'`, so every packet from every commit would print the same version while the filename carried none — packets from before and after a `(PH)` → verified labor-rate flip would be indistinguishable on paper, and command could re-print superseded numbers. Reuse `sap2/scripts/build-sw.ts`'s asset-hash-derived build id for TIMBER, and feed app + doctrine version into the filename hash so a doctrine change **forces a new filename**. |
| **R-T3** | LS members ⇒ LS-GATE table **and** the standing banner; zero LS members ⇒ neither. |
| **R-T4** | Bunker boundary sentence on the BOM header and the assumptions page; `designCoverDepthFt` appears **only** adjacent to "user-stated"; no cover-depth field in CSV or any machine-readable block. |
| **R-T5** | **No signature theater.** The only signature-shaped ink is the hand-fill approval block with role labels. The strings `verified`, `certified`, `approved by TIMBER` never appear in packet copy (wordlist assert), and the FD63 sentence is in the same assert. The tool records nothing about approval. |
| **R-T8** | **The briefing view (§4.1.7) is a regime surface, not a presentation skin.** It renders the honesty strip and the `(PH)` labor-rate line on **every** screen, and both are **exempt from every hide/large-type/fullscreen rule** — the same protection FD20 gives the card regime line. A briefing screen that can display a man-hour total without its rate provenance is a defect. Asserted at F3 in `test/packet-ui.test.ts` (every screen of a 3-screen and a 5-screen briefing carries both lines, including under `data-big`). |
| **R-T6** | New constants only via `doctrine.ts`. Packet code passes the digit-literal scan (TR-8). **Page geometry is NOT in scope** — see FD34/§4.5. Crew sizes, shift hours and stock lengths are **operator inputs** with envelope clamps (crew 1–30, productive hours 1–24, stock 6–24 ft): arithmetic divisors, not doctrine. |
| **R-T7** | The packet never renders SAP-regime quantities (threat, protection, standoff); the lexicon gate enforces it. |

### Both

- **R-B1** Determinism, **scoped honestly (FD68)**: the **HTML and CSV bytes** are byte-identical for identical inputs across two isolated processes. **PDF is not in scope** — Chrome writes `/CreationDate`, `/ModDate` and a version-bearing `/Producer` into every Save-as-PDF, so the delivered PDF is both clock-stamped (visible in any viewer's properties) and not byte-reproducible. Stated in writing, and the same sentence prints beside the DATE blank: *"any date in the page header or file properties is your browser's clock, not this document's date."*
- **R-B2** Self-contained: no external URL, no `<script>` in the printable document, every SVG inline with a `viewBox`; captures inlined as data URIs under a stated budget (≤300 KB total, else captures drop with a **visible note**, never a broken link).
- **R-B3** No printed dates anywhere (see FD70 for the print-dialog caveat); no clock reads (lint).

## 4.4 Labor honesty — crew, shifts, days (FD71)

The sibling divided man-hours by crew size and printed days at **eighth-day resolution**
off three placeholder constants (`MH_PER_BF=0.055`, `MH_PER_PANEL=0.5`,
`MH_PER_CONC_LF=0.15`, all `(PH)` and all module-private) — false precision on the exact
number a unit gets held to, with the governing rate never printed on the labor block, and
`shiftHours` defaulting to 8 as if the crew does nothing but build. TIMBER labor is
`bf × 0.055` across 11 **serial** stages, so dividing by 12 asserts twelve carpenters on
one sill line.

**Binding fixes:**

1. **Max-useful-crew per stage** is derived and printed (`members-in-stage ÷ a cited members-per-worker figure`); crew rows above it are **suppressed** with `crew above N is not modeled`.
2. `shiftHours` is renamed **`productiveHoursPerDay`, default 6**, labelled *"excludes security, details, travel, tool contention."*
3. **Days print as whole shifts rounded up, plus raw crew-hours** — `3 shifts / 118 crew-hours` — **never tenths of a day**. Days are computed from **unrounded** man-hours.
4. **The governing rate prints inline on the LABOR block**: `0.055 mh/BF (PH) — unverified against TM 5-303`. This requires exporting `MH_PER_BF`/`MH_PER_PANEL`/`MH_PER_CONC_LF` from `bom.ts` — an **additive** engine edit listed in the packet phase's Files.
5. Required saw/tool count per crew row is printed, **or the row states it is unmodelled**.
6. **`crewModel` is a printed column label (FD72).** SAP-2's R6a acceptance requires **non-linear** scaling ("halving diggers ≥ doubles elapsed") while TIMBER divides linearly — so one "PKT contract" would print the same-looking crew table under two different physics with nothing on the page saying so. The shared `PacketModel` carries `crewModel: 'linear' | 'scheduler'`, rendered as the table's column label (`days — linear` vs `days — scheduled`), added to the lockstep vectors; **the linear model may not print a days column without the fidelity line inside the same table block.**

## 4.5 Generation, print, export — and the four print blockers

### Pipeline

```
StructureModelLike + BomSummary + PacketSpec ──buildPacket()──▶ PacketModel   (pure, node)
Result + WatermarkState + RenderOpts ─────────assemblePacket()─▶ HTML string  (pure, node)
PacketModel ──renderPacketHtml()──▶ one self-contained HTML string            (pure, node)
            ──renderBriefing()───▶ screen DOM (in-app only)
            ──packetCsv()────────▶ supply-shop CSV string                     (pure, node)
```

3D captures are the only impure step: the studio captures fixed-size renders and hands them
to the view layer; `renderPacketHtml` takes them as optional data, so the node renderer
stays pure and golden-testable with captures absent.

### Page CSS (Letter AND A4, duplex-safe, grayscale-safe)

```ts
// src/ui/woodframe/packetCss.ts — page geometry lives in the UI/CSS tree, OUTSIDE the
// doctrine number-free scan, because these are PAPER DIMENSIONS, not doctrinal magnitudes.
export const PKT_PAGE = {
  contentWIn: 7.0, contentHIn: 9.4, marginIn: 0.5,
  footerHIn: 0.3, headerHIn: 0.0,
  maxTableCols: 7, stripSegmentFt: 16,
  minBodyPt: 9, minFootnotePt: 8, minStrokePt: 0.75, minInkPct: 60,
  caps: { crewRows: 5, rollupRows: 6, whyBullets: 6, assumptionRowsPerPage: 24 },
} as const;
```

| Rule | Statement |
|---|---|
| **FD34 — home** | `PKT_PAGE` lives in `src/ui/woodframe/packetCss.ts`, **outside** the digit-literal scan scope (TR-8). Homing it in `src/timber/packet/**` would fail the very gate the design adopts, on day one, with `contentWIn: 7.2` — inviting an implementer to "fix" CI by moving the file and quietly breaking single-source. Decided here so nobody discovers it in a red build. |
| **FD73 — content box 7.0 in** | A4 is 8.268 in wide; at `@page { margin: 0.5in }` the printable width is **7.268 in**. A 7.2 in box leaves **0.068 in (1.7 mm)** of total slack — one 1 px border or one sub-pixel rounding overflows and Chrome clips the right edge or shrinks the sheet. And the sibling's lint ("no inline width > 7.2in") **permitted exactly the failing value**. Fix: 7.0 in box (0.27 in A4 slack); every block declares `width: min(7.0in, 100%)` with `box-sizing: border-box`; the lint fails at **`>=` `contentWIn`**, states 7.268 in as the explicit A4 bound, and **normalises px→in at 96 dpi** (the artifact's widths are px and %, e.g. the inherited `width="${wPx}"` — a lint that only inspects `in` units never sees the markup that overflows). Unitless SVG `width`/`height` is rejected; every SVG must carry `viewBox` + `width:100%`. |
| **FD69 — BLOCKER: repeating footer** | `position: fixed` repeats per page in Chrome but prints **once (page 1) in Firefox**, which is named in acceptance — a 20-page packet would ship with page 1 stamped and 19 bare, and node lints cannot see it. Fix: repeat the honesty strip and the TRAINING band via a **document-wrapping `<table>` with `<tfoot>`** (`thead`/`tfoot` repeat per page fragment in **both** engines). Physical acceptance counts: **strips observed == pages printed, Chrome and Firefox.** |
| **FD74 — BLOCKER: background graphics** | Chrome and Firefox drop background colours and images in print unless the user ticks "Background graphics" — `print-color-adjust` appears **nowhere** in this repo today. If the diagonal TRAINING band or the ghost/severity hatches are CSS backgrounds, they **silently vanish and unwatermarked training paper leaves the building.** Fix: render band and hatches as **inline SVG geometry** (filled/stroked paths), set `print-color-adjust: exact`, and lint that no regime mark is expressed via `background`, `box-shadow`, or `opacity`. Physical checklist row: **print with Background graphics OFF — the mark must still be there.** |
| **FD75 — BLOCKER: unbreakable blocks clip** | The sibling's lint accepted a table "wrapped in `.pkt-block` OR carrying `<thead>`" — so a long uncapped BOM table wrapped in `.pkt-block { break-inside: avoid }` **passes the lint**, and Chrome renders an unbreakable box taller than the page by overflowing and **clipping**: cut lines disappear off the bottom with no on-screen symptom. Fix: **invert the rule.** `break-inside: avoid` is permitted **only** on blocks with a declared cap constant in `PKT_PAGE.caps`. The lint walks the **ancestor chain**: any table without a cap must carry `<thead>` and must have **no `break-inside: avoid` ancestor**. A **400-cut-line fixture** joins the fit suite. |
| **FD70 — BLOCKER: the print dialog stamps a date** | PKD-3's "no printed dates, ever" is defeated by the dialog itself: Chrome and Firefox both default **Headers-and-footers ON**, stamping the system date, title, URL and page numbers into the `@page` margin of every sheet, and the only print path is `window.print()`. Fix: **"Headers and footers OFF" is a pass/fail line** on the physical checklist and in acceptance for both engines; and a fixed sentence prints beside the hand-fill DATE blank: *"any date in the page header is your browser's clock, not this document's date."* |
| **FD76 — legacy break properties + engine matrix** | WebKit honours `page-break-*` far more reliably than the modern spelling. `PKT_CSS` emits **both** legacy and modern properties and the lint asserts both are present. The supported-engine matrix is stated explicitly: **Chrome and Firefox are supported and are in physical acceptance; Safari/iOS is best-effort and out of scope** (recorded, not implied). |
| **FD77 — widows and orphans, structurally** | Firefox implements neither property, so the CSS route is unavailable. Solve it structurally: wrap heading + first N rows in a capped `break-inside: avoid` unit; `break-after: avoid` on headings; chunk long tables into capped fragments with repeated `<thead>`. Lint: **no table fragment shorter than 2 rows.** |
| **FD78 — fit arithmetic subtracts the footer** | Caps × max row height must be `<= contentHIn - footerHIn - headerHIn`. The sibling asserted against the raw content box while every page also carries the repeating strip (and, in SAP-2, the band) — so every cap was optimistic by a strip, and the last row of a capped block could be pushed off the page on Letter's 0.3 in of slack. |
| **FD79 — type floor 9 pt, enforced** | The 8 pt paper floor is too low for grayscale duplex plus field photocopying, and nothing enforced it: `PKT_CSS` will be authored in px like the existing print CSS (`jobSheet` uses 11px/12px; 10px = 7.5 pt) and the sibling's lint list had **no font-size check at all**. Body text floors at **9 pt (12 px)**, footnotes at 8 pt (10.7 px); the lint parses every `font-size` in `PKT_CSS`, converts px/rem→pt at 96 dpi, and fails below the floor. **Scale = 100%** is a physical-checklist row so fit-to-page cannot shrink below it. |
| **FD80 — grayscale is rasterized, not word-linted** | SAP-2 already runs a 300 dpi grayscale rasterization gate for ghost/NOW/DONE separability; the packet's hatch patterns, 9 pt type and 0.75 pt strokes must enter it (and a TIMBER equivalent stands up), asserting hatch-pair separability, ghost-vs-now structural difference, and a **minimum ink-value floor at 300 dpi**. The word-presence lint ("every severity element contains its word") stays as a **second, independent** check — it was never evidence that mono output is legible. |
| **FD81 — no blank first page; detachable sections start recto** | `break-before: page` on every `.pkt-sec` including the cover can produce a leading blank sheet (engines differ on a forced break before the first box), and an S-4 handed a packet whose page 1 is blank distrusts the rest. Scope it `.pkt-sec + .pkt-sec { break-before: page }`. Separately, **materials and the approval block are detachable** — the real workflow is tearing the materials page off for the supply shop — so both get `break-before: right` + `page-break-before: right`, and the resulting blank versos are recorded as **expected output**, not a defect. "No blank first or last page" is a physical-checklist line for both engines and both papers. |

### Export surfaces

1. **Print / Save-as-PDF via the browser** — the primary artifact. Zero new dependencies. SAP-2 TRAINING: print allowed and watermarked; bare exports suppressed by policy (SR-9).
2. **`.timber.json` project file** — TIMBER-2 §5.5's deterministic serialization, offered beside the packet ("the file that regenerates this packet"); the packet embeds its `hash8` so paper↔file identity is checkable by eye. Cover-depth stripped.
3. **Supply-shop CSV** (`.materials.csv`) — sections META / WARNING / STOCK / CUTS / SHEETS / HARDWARE / CONCRETE / LABOR / ASSUMPTIONS.

### CSV hardening (three fixes over the sibling)

```ts
// src/timber/packet/csv.ts
export function packetCsv(m: PacketModel): string;   // CRLF; '.' decimal; rectangular
export function csvText(v: string): string;          // quotes + formula-injection escape
export function csvNum(v: number): string;           // NEVER prefixed, NEVER quoted (FD82)
```

- **FD82 — split the API.** The sibling's `csvField(v: string | number)` applied injection hardening to **numbers too**: a negative value (compare deltas, any signed field) starting `-` gets an apostrophe prefix and lands in Excel as **TEXT**, so the supply shop's column sums silently omit it — defeating "exact totals" in the exact place it matters. Numeric model fields route through `csvNum()` **by type**. Vectors: a negative number and a numeric-looking string.
- **FD83 — the escape must be inside the quotes, and whitespace-tolerant.** The stated escape (cells starting `= + - @` or tab/CR prefixed with an apostrophe) leaks two known vectors: Excel evaluates a formula **after unquoting**, so the apostrophe must be the first character **inside** the quoted field, not applied to the raw cell; and importers trim leading whitespace, so `' =cmd|...'` bypasses a first-character test. Test the **first non-whitespace** character against `= + - @ TAB CR`; hostile fixture adds whitespace-prefixed, already-quoted, and DDE (`=cmd|' /C calc'!A0`) cases.
- **FD84 — rectangular, or the RFC-4180 claim is false.** A multi-section CSV with ragged record widths and blank separator lines is **not** RFC-4180 (equal field count per record is required), and strict parsers (pandas et al.) error on the supply shop's import. **Pad every record to the max column count with empty fields and drop bare blank lines** (keep a SECTION marker column instead). Claim restated as *"RFC-4180, rectangular"*; equal field counts asserted.
- **Unit of issue is a CSV column** (`EA / LF / BF / SHT / CY / LB / MBF`) on every quantity record — the supply-shop artifact is the one place the unit must be machine-readable. Presence and value asserted per section.
- **FD85 — `.gitattributes` lands with the first golden.** The repo has **none** (verified). Committed HTML goldens (LF) and the CRLF-by-spec CSV golden will be EOL-normalized on any contributor or CI runner with `core.autocrlf=true`, so string-compare goldens fail spuriously and the CRLF assertion can pass locally against a fixture that is wrong in the index. Land `test/goldens/** -text` and `*.csv -text` in the **same PR** as the first golden, plus a CI assert that the committed CSV golden's bytes contain `0x0D 0x0A` and the HTML goldens contain no `0x0D`.

### Filenames (deterministic, clock-free)

```
timber-planning-<slug>-<hash8>.packet.html      ← trust word FIRST (FD86)
timber-planning-<slug>-<hash8>.materials.csv
timber-planning-<slug>-<hash8>.timber.json      ← the triple travels together
sap2-TRAINING-<slug>-<hash8>.packet.html        ← state word FIRST, UPPERCASE (FD87)
sap2-REVOKED-<slug>-<hash8>.packet.html         ← revoked has its OWN word (FD88)
```

- **FD86** — TIMBER filenames carry a trust word too. `timber-sea-hut-a1b2c3d4.packet.html` in a shared folder gives no hint the contents are a planning estimate built on placeholder rates — the same directory-listing argument that justifies the SAP-2 state word applies verbatim.
- **FD87** — the state word goes **first and uppercase**. File managers, `ls` columns and mail clients truncate the middle or tail, so a mid-name state word is the first thing cropped; and a position slug containing "training" makes the word ambiguous to parse. State words are forbidden inside slugs. Truncation and ambiguous-slug vectors join the lockstep set.
- **FD88** — `revoked` gets its own word. `watermark.ts` models `revoked: true` explicitly (a commissioning record naming a REVOKED fill) and the design says surface it loudly, yet on disk it was indistinguishable from ordinary awaiting-commissioning paper. The `WatermarkState → word` map is a **total function over every variant of the union** (including each `FILLED_UNCOMMISSIONED.reason`) with **one lockstep vector per variant**, so a new state cannot silently fall back to a softer word.
- `slug`: lowercase `[a-z0-9-]`, ≤40 chars, from `spec.label`; omitted when unnamed. TIMBER `hash8` = 8 hex of FNV-1a-32 per FD66 — a filename identity, not a security hash (stated in a code comment). SAP-2 uses the first 8 hex of its real SHA-256 `contentHash`.
- No dates in filenames, ever.

## 4.6 "Better in every way" — the delta table

Every SAP-1 job-sheet weakness carries a receipt (file/line or audit finding).

| # | SAP-1 weakness (receipt) | Packet fix |
|---|---|---|
| 1 | No exec summary — command reads the whole sheet to find man-hours/materials (`jobSheet.ts` renders inputs→specs→drawings→BOM→labor in that order) | §4.1.2 EXEC SUMMARY, **seven blocks including REQUEST and RISK**, always the second page, same grid every packet |
| 2 | One crew size (`inputs.teamSize` → single `elapsedHours` row, `jobSheet.ts:90`) | Crew-scenario table (operator-editable), **max-useful-crew suppression**, whole shifts + raw crew-hours, rate printed inline (§4.4) |
| 3 | Validation silently omitted from print — signed paper with zero warnings (audit #10, HIGH) | Validation/issues **required by constructor type** (R-S6); TIMBER prints every `SpecIssue` + LS table; clean results print "no flags — n checks run" |
| 4 | Provenance read from ambient module state (`getFillState()` in `fillFooter`, `jobSheet.ts:163`) | Provenance rides **inside** `Result.fillIdentity` / `PacketModel.honesty`; renderers cannot reach ambient state |
| 5 | Printed `meta.date` presented as document date while DTG is also a blank — two clocks, one fake | No printed dates (PKD-3 upheld) **plus the FD70 dialog caveat printed beside the DATE blank** |
| 6 | Signature block prints in EVERY state (`jobSheet.ts:109`) — uncommissioned paper masquerades as a field document | SAP-2: signature blocks **and cover hand-fill blanks** only in COMMISSIONED (FD55); TIMBER: hand-fill unit-process lines + PLANNING ESTIMATE stamp + the FD63 sentence |
| 7 | BOM ignores the metric toggle; ft³ beside converted m³ on one screen (audit #33) | One display-unit path; **unit of issue on every row** in table and CSV |
| 8 | Raw internal enum ids printed (`sa-127`, `sandy_loam` — audit #41) | All names route through the registries; lint: no id-shaped tokens in packet copy |
| 9 | Display-rounded numbers summed downstream (`num()` at 2 dp per row) | Totals from **unrounded** model sums, formatted once; cumulative columns from the unrounded cumulative; CSV carries exact totals **via `csvNum`** (FD82) |
| 10 | CSV formula-injection-unsafe (`field()` quotes only `[",\r\n]`) | FD82/FD83/FD84 hardening + hostile fixture incl. DDE and whitespace-prefixed vectors |
| 11 | Drawings: plan + section only | Annex A: plan, section/cutaway, four elevations, 3D key views, per-stage sheets, layout strips — **with real emitters** (FD64) |
| 12 | Flat BOM labels; no classes, no procurement fit, no cube/weight | `classifyNominal` rollup, stock purchase table with exact waste, cube/weight where derivable, **sheets-by-thickness**, **equipment & prerequisites** |
| 13 | Single fixed page flow; no way to brief from a phone | Section registry + briefing view (§4.1.7) |
| 14 | Letter-width assumption (`max-width:8.2in`) — A4 margins clip | **7.0 in** content box fits both papers with real slack (FD73) |
| 15 | Exported raw SVGs rendered black-on-black outside the app | R-B2 self-containment gate on the whole artifact — the class dies, not the instance |
| **16** | *(new)* Material list not orderable; no grade/species/treatment/unit of issue | FD58 — additive `Member`/`CutLine` fields, unit-of-issue column everywhere |
| **17** | *(new)* Sheet goods collapse to one unorderable line | FD60 — thickness in the emitted nominal; sheets-to-buy per thickness |
| **18** | *(new)* No ASK, no RISK, no routing, no POC | FD57 blocks 5–6; FD54 routing block |
| **19** | *(new)* Every-page watermark silently lost in Firefox / with Background graphics OFF | FD69 `<tfoot>` repeat; FD74 inline SVG + `print-color-adjust: exact` |

**vs SAP-2's blueprinted job sheet (R2a — already strong):** the packet **adds** a cover +
seven-block exec page in front, crew scenarios as **three real scheduler calls** (never
arithmetic on a printed total), a materials class rollup, and one assembled document with
one filename and one watermark pass (cover → exec → job sheet **unchanged** → Build Card
deck appendix → annex). **What it deliberately does not change:** ship-empty, the FICT
regime, per-position commissioning coverage, R2a's scope, CSV's R6a rules.

## 4.7 Comparison packets — the honest call

**LATER for TIMBER; OUT for SAP-2.**

The v1 need is served free: exec summaries are **comparison-stable by design** (fixed row
order, same metrics, same units) — print two packets, lay two covers side by side, and the
A/B question (man-hours, lumber, shifts at crew 8) is answered. "Give it to command" is a
decision **meeting**, not a diff tool. A real compare surface costs a second
`StructureModel` in memory, a delta renderer, delta semantics for every block (what is
"the diff" of two stage plans with different stage plans?), goldens ×2, and a B-spec
picker — a full phase competing with flashcards for the same sessions. SAP-2 already ruled
side-by-side OUT ("every surface is test surface"); this plan respects sibling regimes
rather than re-litigating them.

Designed now so re-entry is cheap:

```ts
// src/timber/packet/compare.ts (LATER)
export interface CompareSpec { a: PacketInputs; b: PacketInputs; crewSize: number }
export interface CompareModel {
  readonly rows: readonly { metric: string; a: string; b: string; delta: string;
                            better: 'a'|'b'|'tie'|'n/a' }[];
  // fixed metric order === the exec rollup order: man-hours, shifts@crew, board-feet,
  // pieces, sheets, concrete, cube, weight, (PH) count, LS count
  readonly notes: readonly string[];
}
export function buildCompare(a: PacketModel, b: PacketModel): CompareModel;  // from the MODELS
```

Acceptance when built: `buildCompare(m, m)` is all-tie; metric order equals exec order
(lockstep test); one page, table-only, both honesty strips printed, both `hash8`s named.

## 4.8 Binding shapes

```ts
// src/timber/packet/spec.ts
export type PacketSectionId =
  | 'cover' | 'execSummary' | 'materials' | 'laborSchedule' | 'assumptions'
  | 'drawings' | 'briefing';                                  // briefing: screen-only
export const PACKET_SECTION_ORDER: readonly PacketSectionId[] =
  ['cover','execSummary','materials','laborSchedule','assumptions','drawings'];   // FD53

export interface PacketSpec {
  readonly sections?: readonly PacketSectionId[];   // default: the five print sections (annex opt-in)
  readonly title: string;
  readonly requestingUnit?: string;
  readonly preparedBy?: string;                     // attested text, never an identity claim
  readonly crewSizes: readonly number[];            // default [4,8,12]; clamp 1..30; first = planning crew
  readonly productiveHoursPerDay: number;           // default 6; clamp 1..24                 (FD71)
  readonly stockLengthsFt: readonly number[];       // default [8,10,12,14,16]; clamp 6..24; sorted, deduped
  readonly includeAnnex: boolean;                   // default false                          (FD53)
  readonly includeStageSheets: boolean;             // default false pre-T3
  readonly worksheetVariant?: 'A' | 'B' | 'C';      // printables only                        (FD48)
}

// src/timber/packet/model.ts
export interface CrewScenarioRow {
  readonly crew: number; readonly crewHours: number;
  readonly shifts: number;                          // WHOLE shifts, rounded up               (FD71)
  readonly overMaxUseful: boolean;                  // suppressed row flag
  readonly toolsRequired?: string;                  // or the 'unmodelled' sentence
}
export interface RollupRow { readonly cls: NominalClass; readonly pieces: number;
  readonly boardFeet?: number; readonly cubeFt3?: number; readonly weightLb?: number;
  readonly unitOfIssue: string; readonly note?: string }
export interface StockLine { readonly nominal: string; readonly stockFt: number;
  readonly pieces: number; readonly cutsServed: number; readonly wasteLF: number;
  readonly special?: boolean }
export interface SheetLine { readonly nominal: string; readonly thickness: string;
  readonly piecesCut: number; readonly sheetsToBuy: number }        // FD60
export interface CiteRow { readonly locator: string; readonly ph: boolean; readonly memberCount: number }
export interface LsRow { readonly id: string; readonly value: string; readonly cite: string; readonly ph: boolean }

export interface PacketModel {
  readonly meta: { app: 'timber'; title: string; slug: string; hash8: string;
                   buildId: string;                                   // content-addressed  (FD67)
                   familyLabel: string; specSummary: string };
  readonly crewModel: 'linear' | 'scheduler';                          // FD72
  readonly cover: { thumbnailSvg: string; routing: RoutingBlanks; unitLine: string | null;
                    preparedBy: string | null; contents: readonly PacketSectionId[];
                    annexSheetCount: number };
  readonly honesty: { stamp: string; phCensus: { cited: number; ph: number };
                      lsCount: number; lsReviewPending: number;
                      fidelityLines: readonly string[] };
  readonly exec: { what: string; whySized: readonly string[];
                   totalManHours: number; laborRateLine: string;      // FD71 item 4
                   crew: readonly CrewScenarioRow[]; rollup: readonly RollupRow[];
                   request: RequestBlanks; risk: RiskBlanks;          // FD57 blocks 5-6
                   decisionLine: string };
  readonly materials: { cutLines: readonly CutLine[]; stockFit: readonly StockLine[];
                        sheets: readonly SheetLine[]; hardwareNote: string;
                        concrete: { runLF: number; cubicYd: number } | null;
                        equipment: EquipmentBlock; classIV: readonly ClassIvRow[] };
  readonly labor: { byStage: readonly { ordinal: number; label: string; manHours: number;
                                        crewHours: number; cumCrewHours: number;
                                        maxUsefulCrew: number }[];
                    timelineSvg: string };
  readonly assumptions: { cites: readonly CiteRow[]; ls: readonly LsRow[];
                          issues: readonly SpecIssue[]; boundaryLines: readonly string[];
                          approvalRoles: readonly string[]; honestyCounts: HonestyCounts };
  readonly drawings?: { elevations: readonly { wall: WallId; svg: string }[];
                        strips: readonly { wall: WallId; segments: readonly string[] }[];
                        captures?: Partial<Record<'plan'|'isoSE'|'isoNW'|'cutaway', string>>;
                        stageSheets?: readonly { ordinal: number; label: string; capture?: string;
                                                 lines: readonly CutLine[]; manHours: number }[] };
}

// src/timber/packet/build.ts
export function buildPacket(model: StructureModelLike, bom: BomSummary, spec: PacketSpec): PacketModel;
export function stagePlanFromLegacy(stages: typeof STAGES): StagePlanEntryLike[];

// src/timber/packet/stockfit.ts — PINNED algorithm (deterministic):
//   domain: classifyNominal(nominal) === 'lumber' ONLY (FD61)
//   per nominal: cuts sorted length-desc (stable); each cut placed in the FIRST open bin
//   (creation order) with room; else open a bin of the SHORTEST allowed stock >= cut;
//   cut > max stock => special line { pieces: 1, wasteLF: 0, special: true }.
export function stockFit(lines: readonly CutLine[], stockLengthsFt: readonly number[]): StockLine[];
```

```ts
// sap2/src/render/print/packet.ts  (F10 / R6a)
export interface Sap2PacketOpts {
  readonly sections?: readonly PacketSectionId[];
  readonly crewSizes: readonly number[];
  readonly header: FieldHeaderBlanks;   // R2a OUTPUT this phase consumes — not an existing type (FD89)
  readonly renderOpts: RenderOpts;      // R2a OUTPUT — watermark seed, print counter (data in)
}
export function assemblePacket(result: Result, state: WatermarkState,
                               deck: BuildCardDeck | null, opts: Sap2PacketOpts): string;
// Composition, never re-derivation:
//   coverPage(result,state) + execPage(result,state,scenarios) + jobSheet(result,...) UNCHANGED
//   + deckPages(deck) verbatim + annexPage(...) per the blueprint's rules.
// scenarios = opts.crewSizes.map(n => schedule(result, { teamSize: n, ...defaults }))  — REAL calls.
```

**FD89 — the SAP-2 signature does not compile against today's tree, and the plan says so.**
`FieldHeaderBlanks` was annotated "existing type" but appears **nowhere** in `sap2/src`
(one blueprint mention); `RenderOpts`, `computeStages` and `BuildCardDeck` are likewise
blueprint-only (`BuildCardDeck` appears **zero times** in `SAP2_BLUEPRINT.md`). All four are
listed as **R2a outputs this phase consumes**, in the phase's "Depends on" cell, and the
deck type's fields are defined inline at implementation time against whatever R2a actually
shipped — the phase's START HERE reads the as-built code, not the blueprint.

---

# 5. Platform architecture

## 5.1 Code layout across the two toolchains

Full tree in §2.1. The governing constraints:

- **`sap2/` is self-contained.** No cross-tree imports in either direction, ever. The only shared artifacts are the byte-identical `core.ts` twins and the byte-identical `train-vectors.json` / `pkt-vectors.json` fixtures, all sync-asserted from the **root** suite (where both trees are visible).
- **`src/timber/**` is pure** (no DOM, no three.js, no `Date`, no `Math.random`, no module state). `src/ui/woodframe/**` is the DOM layer. Import-boundary tests in both trees assert the module graph of every pure module reaches no DOM, no `three`, and no generator.
- **`src/timber/labels.ts` is engine-level.** Training imports labels; labels never live inside `training/`. Putting them under a training subtree (as a sibling proposed) inverts layering and makes training undeletable — the studio's member card would import its labels from a training directory.
- **`scripts/build-suite.mjs`, `vite.suite.config.ts` and `vite.sap2.config.ts` are not edited by any phase.** Everything mounts from the existing entry HTML. `check-size` runs as a **separate npm step** (`"build:suite": "node scripts/build-suite.mjs && node scripts/check-size.mjs"`), not as an internal `step()` inside the build script — the sibling asserted both ("not edited by any F phase" *and* "wired into build:suite's tail as a step") and a fresh session could not tell which won (FD90).

## 5.2 Engine → descriptor → consumer

```
        src/timber/{frame,floor,walls,roof}.ts          sap2/src/engine/compute.ts
                        │                                          │
                    Member[]                                    Result
                        │                                          │
        ┌───────────────┼───────────────┬──────────────┐           ├── drawPlan/drawSection
        │               │               │              │           │      (RenderCtx +highlight)
   bom.ts          train/compile     packet/build   train/art      │
  CutLine[]          DeckSpec        PacketModel     SVG string    └── train/compile → DeckSpec
        │               │               │              │
        └───────────────┴───────────────┴──────────────┘
                        │
        ┌───────────────┼────────────────┬──────────────┬─────────────┐
   studio 3D      train/view        packetPrint     printTrain    records
   (three.js)     (DOM+SVG)         (DOM+print CSS) (print CSS)   (localStorage)
```

Every consumer is a **projection**. No consumer re-measures geometry, re-derives doctrine,
or holds authored content. A new catalog family appears in the studio, the BOM, the deck,
the curriculum, the printables and the packet **with no consumer code change** — asserted by
suites that iterate every live `FamilyDef` preset.

### 5.2.1 `SceneHooks` — the studio↔trainer seam (binding; gap-6 fix)

Created by **F2** at `src/ui/woodframe/sceneHooks.ts`; extended by F4; **T3 inherits
this shape rather than inventing one.** It is the ONLY way training code touches the
3D studio — training modules never import `three` (F2 trap).

```ts
export interface SceneHooks {
  /** Highlight exactly these member ids; [] clears. Idempotent. */
  highlight(memberIds: readonly string[]): void;
  /** Frame the camera on these members (falls back to whole-model when empty). */
  fitToMembers(memberIds: readonly string[]): void;
  /** Set the visible construction stage (ordinal from the stage plan). */
  setStage(ordinal: number): void;
  /** Render-then-read capture (honours preserveDrawingBuffer semantics, F0 trap 1). */
  capture(): Promise<Blob | null>;
  /** F4: suppress click-to-select so a quiz owns picking. */
  suppressSelect(on: boolean): void;
}
```

Every method is a no-op-safe stub when the studio is absent (print/headless paths), so
happy-dom suites construct a null-hooks object rather than a WebGL context.

## 5.3 Routing and entries

| Surface | Pre-T3 | Post-T3 (F9) |
|---|---|---|
| **TIMBER trainer** | Toolbar chip `TRAIN` in `woodframe.html`; boot checks `location.hash === '#train'` and opens a full-screen overlay (deep-linkable; opening pushes a history state so the Android back gesture dismisses the deck, not the page). `#train` (no slash) deliberately cannot collide with T3's `#/`-grammar router. | Routes `#/train` (deck list), `#/train/deck/<id>`, `#/train/walk/<deckId>/<ordinal>`, `#/train/quiz/<deckId>/<kind>`, `#/train/hip[/<deckId>]`, `#/train/records`. `#train` redirects to `#/train`. Unknown deck id → deck list + inline notice. |
| **Deck list** | overlay list | **Rendered through the T3 picker component in a `train` mode** — one additive prop changing the card href and the header line — **not a second list surface** (FD91). A parallel picker would duplicate T3's runtime thumbs, groups, filter, resume strip and roving focus. |
| **Workbench** | — | `Learn this structure` → `#/train/deck/<entryId>` compiling from the LIVE spec; `COMMAND PACKET` button on every family's header. |
| **Packet** | `woodframe.html` toolbar button `COMMAND PACKET` → packet view with an options row | Workbench header button; rendering merged into the T3 `print.ts` family. |
| **SAP-2 trainer** | — | A `TRAIN` mode button beside the existing region controls (retained-DOM region `sap2/src/ui/regions/train.ts`; no router exists and none is added). Compiled from the CURRENT `Result` + watermark. Available in TEMPLATE from first boot. Not gated behind the leader-view hold — it shows nothing the drawings in the same state would not show. |
| **Hub** | unchanged | **No third card (FD3).** Each existing card gains one copy line and a deep-link anchor: TIMBER — *"Includes a flash-card parts trainer and a command packet — for the structure you configured."*; SAP-2 — *"Includes its own build-card training surface."* |

## 5.4 Mobile engineering work items

Ground truth: `woodframe.html` has the viewport meta but a desktop flex layout (the aside
is `width:340px; max-width:45vw` ≈ 175 px on a 390 px phone: unusable); the canvas captures
one-finger drags so the page can trap scroll; the rAF loop renders continuously (battery);
chips are 30 px tall. SAP-2's `.narrow` grid (`grid-template-areas` swap at one class
toggle) is the proven in-repo pattern.

| Id | Work item | Detail | Phase |
|---|---|---|---|
| **M-1** | Stacked narrow layout | `matchMedia('(max-width: 699px)')` toggles a root class; main becomes single column — toolbar (wrapping), viewport, aside full-width, strips. Breakpoint 700 px to match TIMBER-2 §5.4. | F0 |
| **M-2** | Viewport height clamp + scroll escape | In narrow mode canvas height = `min(58vh, innerHeight − chrome)`; the canvas never fills the screen. **The existing `Math.max(320, …)` floor in `fitViewport` is REPLACED in narrow mode (FD92)** — on a small landscape phone (`innerHeight ≈ 375`) the 320 floor wins and the canvas re-fills the screen, defeating the scroll escape this item exists to provide. `touch-action: none` ONLY on the canvas. | F0 |
| **M-3** | On-demand rendering | Replace the unconditional rAF loop. **Render triggers (complete list — FD93):** controls `'change'`; end of `rebuild()` (covers `regenerate`/`setStage`/selection); **`fitViewport`/resize** (`renderer.setSize()` clears the drawing buffer — a resize or orientation change with no re-render leaves a **blank canvas**); **`onPropAssetsReady`** (the async GLB arrival that repaints with real lumber props); and **any capture path before readback**. Pause fully when `document.hidden` or the trainer overlay covers the canvas. *(`enableDamping` is off in the current scene — the "while damping settles" clause is dropped.)* | F0 |
| **M-3b** | Controls rebinding trap | `setCamera` (`woodframe-scene.ts:178–186`) **disposes and reconstructs `OrbitControls` on every view chip**, so a boot-time `controls.addEventListener('change', …)` subscription is **lost after the first view change** and the canvas freezes. Hoist the binding into `bindControls()` invoked **inside** `setCamera()`. Pure test: a view swap still schedules a frame. | F0 |
| **M-4** | Coarse-pointer hit targets | `@media (pointer: coarse)`: chips/buttons `min-height: 44px` (padding, not font); stage chips wider tap zones; layout-strip marks get invisible 24 px hit rects (`<rect fill="transparent">` per mark group). | F0 |
| **M-5** | Touch pick tolerance | Raycast pick gains a **12 px NDC-radius nearest-member fallback** on coarse pointers. Pure function over projected AABBs, node-testable. | F4 |
| **M-6** | Trainer touch UX | §2.7 in full. Gestures with equal-power visible buttons; undo snackbar; 64 px primaries. | F2 |
| **M-7** | 3D perf budget for training | Identify-in-scene **reuses the existing scene/renderer** — never a second WebGL context. Card art is SVG so the deck costs no GPU. Budgets inherited from TIMBER-2 §4.1: stage change ≤16 ms; rebuild ≤300 ms on the reference Android; mesh ≤2500. **Identify adds zero meshes** — highlight material swaps only. Stated numerically in F4 acceptance: **highlight swap ≤16 ms and zero mesh-count delta** versus the same scene without identify mode, both asserted in the node/happy-dom suite (FD94). |
| **M-8** | Packet on phone | Single-column HTML; tables wrap in `overflow-x: auto`; print CSS per §4.5. "Print / Save as PDF" uses the browser dialog — no PDF library. | F3 |
| **M-9** | Reference device — **named at F0 (FD95)** | Nothing in either governing plan names it (TIMBER-2 says only "the reference low-end Android", SAP-2 R2b "one old Android", `DECISIONS.md` has no row, T3 has not started). **F0 names it itself** — make, model, Android version, browser version — in a `TRAIN F0: reference device` `DECISIONS.md` row, and states that T3 inherits it. Device passes at F0, F2, F3, F4 are **recorded, non-blocking**; the **gating** check is Chrome DevTools device toolbar at 390 px with Touch enabled. |
| **M-10** | Purity for testability | `src/ui/woodframe/viewport.ts` exports `isNarrow(width)`, `renderScheduler(state, event)` (dirty-flag machine incl. hidden-tab pause), and `canvasHeight(innerW, innerH)`. **`woodframe-scene.ts` cannot be imported under `node --test`** (module-scope `getElementById` + `new WebGLRenderer()`), so without this module F0's own named test has no importable subject (FD96). The ~40 scene lines become wiring only. |
| **M-11** | No SW/PWA posture | Nothing to build (N-9). The offline consequence is stated in copy (§1.4), not engineered around. | — |

**What F0 does NOT do:** the T3-planned sheets/detents/cutaway-slider mobile work
(TIMBER-2 §5.4's scope). F0's changes are confined to `woodframe.html` styles + the new
`viewport.ts` + ~40 wiring lines, so the T3 port cost is one checklist line — *"preserve F0
narrow mode + on-demand render"* — recorded in `DECISIONS.md` at F0 merge.

### 5.4.1 `viewport.ts` — the pinned F0 subject (binding; gap-7 fix)

F0's FIRST TEST needs a subject with a fixed shape. This is it — pure, DOM-free,
node-testable.

```ts
export const CHROME_PX = 220;            // header + chips + card rail above the canvas
export const CANVAS_MIN_PX = 240;        // replaces the old 320 floor (landscape phones)
export const NARROW_MAX_PX = 699;        // isNarrow(700) === false — boundary pinned

export const isNarrow = (widthPx: number): boolean => widthPx <= NARROW_MAX_PX;

/** Never returns less than CANVAS_MIN_PX; never exceeds the space actually available. */
export const canvasHeight = (innerHeightPx: number, chromePx = CHROME_PX): number =>
  Math.max(CANVAS_MIN_PX, innerHeightPx - chromePx);

export type RenderEvent =
  | { kind: 'resize' } | { kind: 'orientation' } | { kind: 'camera' }
  | { kind: 'stage' }  | { kind: 'select' }
  | { kind: 'hidden' } | { kind: 'visible' } | { kind: 'frame-done' };

export interface RenderState { dirty: boolean; paused: boolean }

export const initialRenderState = (): RenderState => ({ dirty: true, paused: false });

/** Pure reducer: the on-demand render loop's whole decision surface. */
export function renderScheduler(state: RenderState, event: RenderEvent): RenderState;
// hidden -> paused true; visible -> paused false + dirty true; frame-done -> dirty false;
// every other kind -> dirty true. A paused state never renders even while dirty.
```

## 5.5 Serialization against TIMBER-2

**Never run an F phase and T3 concurrently (FD97).** T3 rewrites the woodframe shell;
concurrent edits to the same boot file collide. F0–F6 are written against today's
`woodframe-scene.ts` + `Member[]` and are safe parallel to T0–T2 — **with one correction to
the sibling's rationale:** T0–T2 ship no UI *behaviour*, but **T2 does add
`src/ui/woodframe/thumbnails.ts`** (the same directory F1 creates), `test/goldens/thumbs/`,
and an `update:thumb-goldens` package.json script, while F0/F1 also edit `package.json`
scripts. A one-line trap in F0/F1 START HERE: **rebase `package.json` script additions;
never resolve by overwrite.**

If T3 lands first, each phase's post-T3 variant applies (file targets shift into the
`src/ui/woodframe/` module tree; behaviour identical). **F9 is the sanctioned integration
point.**

---

# 6. Phase plan F0–F10

Effort scale: **S** ≤ half session, **M** ≈ 1 session, **L** = 2–3. Every phase ends
deploy-green, is independently shippable, and has acceptance a fresh session can verify
without the planner. Branch discipline, descope ladders and the red-main rule are TIMBER-2
§7/§10.2 verbatim. `DECISIONS.md` entries are prefixed `TRAIN Fn:` / `PKT Fn:`.

## 6.1 Dependency map and order

```
T0  (TIMBER-2) root CI, check-assets, goldens  — NOT a blocker for any F phase, but it
    owns .github/workflows/toolkit.yml, scripts/check-assets.ts and test/goldens/frame.
    Until it lands: F-phase CI assertions degrade to manual pre-merge `verify` +
    `build:suite`, and the CRLF check lives in test/pkt-lockstep.test.ts (gap-4, §6.2).
F0  Mobile baseline + viewport purity          — needs nothing.  Safe || T0–T2.
F1  Pure core: labels, train core, compiler,   — needs nothing.  Safe || T0–T2.
    card art, gates, size/asset scripts           (T2 collision: §5.5)
F2  TIMBER flip deck UI + dims row + keyboard  — needs F1
    ══════════ CHECKPOINT C1 (owner uses the deck in a real session) ══════════
F3  COMMAND PACKET v1 (owner ask #3)           — needs F1.  Pre-T1 degradations FD65.
    ══════════ CHECKPOINT C2 (owner hands a packet to someone) ═══════════════
F4  TIMBER quiz modes (identify, N2P, stage-order, identify-in-scene) — needs F2
F5  Printables (paper deck, worksheets, posters) + hip-pocket + projector — needs F2 (+F3 print CSS)
F6  Records + session sheet + privacy posture  — needs F5
F7  SAP-2 flip deck, regime-complete           — needs R0 (complete today). Independent of F2–F6.
F8  SAP-2 identify + stage-order               — needs F7; stage-order needs R2a
F9  Post-T3 integration                        — needs T3 MERGED
R3  (SAP-2) comprehension trial and release    — F7/F8 add a SAP-2 UI region and authored
    copy. DECISION (gap-19): F7/F8 land BEFORE R3's trial so the trainer is inside the
    artifact the protocol evaluates; the trainer's own copy therefore enters R3's
    comprehension protocol. Recorded in DECISIONS.md at F7. If R3 has already run when
    F7 merges, F7 triggers a scoped re-run of the affected protocol tasks, not a full
    re-trial.
F10 SAP-2 packet assembly                      — needs R2a + R6a
```

**Recommended order: F0 → F1 → F2 → F3 → F4 → F5 → F6**, interleaving T0–T2 freely; T3–T8
next; F9 after T3; F7 any time (R0 is complete); F8 at R2a; F10 at R6a.

**F3 before F4 (FD98).** The owner's ask #3 is the Command Packet; identify-in-scene is
discretionary breadth. Both depend only on F1/F2, so scheduling identify first was an
unforced inversion of the value ranking.

**Honest total cost (FD99).** F0–F6 is roughly **9–13 sessions** on top of TIMBER-2's
~17–22 (T) and SAP-2's ~20+ (R). Front-loading seven phases before T3 pushes the owner's
other named centrepiece (the 14-family catalog studio) back a full quarter. **The owner
gets an explicit fork, recorded in `DECISIONS.md` before F2 starts:**
**(a)** F0+F1+F2+F3 only before T3, remainder after F9 — the mandate's two named asks ship,
the catalog is not starved; or **(b)** full front-load with T3 slipping ~8 sessions.
Risk row R8 (single-maintainer fatigue across three concurrent workstreams) is live either
way.

**Checkpoints are hard gates (FD100).** C1: **F4/F5/F6 do not start until the owner reports
the deck used in a real session.** C2: F5's printables do not start until the owner has
handed a packet to someone. Four phases of printables, records, hip-pocket and projector
shipping before any evidence the deck is used — each carrying recurring manual acceptance
rituals — is how plans accumulate unused surface.

## 6.2 Collision map — files this plan touches that T-phases also touch

| File | Change | Coordination |
|---|---|---|
| `src/ui/woodframe-scene.ts` | F0: ~40 wiring lines (matchMedia, render scheduler, resize, `bindControls`). F2: one import + toolbar chip + mount call + **`sceneHooks.ts` (§5.2.1, created here)**. **F3: `COMMAND PACKET` button + options row, AND the inline strip emitter is replaced by `stripSvg.ts` in the same phase that creates it (gap-15 — FD64 requires "same commit so a second copy never exists"; this moved out of F4).** | Additive; **if T3 lands first, these move into the T3 module tree unchanged**. Never rebase trainer code through a half-ported shell. |
| `src/timber/labels.ts` (NEW) + `src/ui/woodframe/labels.ts` (re-export) | F1 creates both. | The exact file TIMBER-2 §3.6 designates; T3 inherits it instead of creating it. I-14 lockstep repoints to the engine home. `DECISIONS.md` entry so T3 and F1 cannot collide. |
| `src/timber/train/art.ts` ↔ `src/ui/woodframe/thumbnails.ts` (T2) | one projector, one golden script | §2.2: whichever lands first owns it; the other re-exports/extends. `update:thumb-goldens` writes **both** golden dirs; the separate `update:train-goldens` script is deleted from the plan (FD8). |
| `src/ui/woodframe/tables.ts` (NEW at T3) | cut-list table renderer extracted from `woodframe-scene.ts:297–308` | FD37. Studio and training both consume it; same treatment as labels. Until it exists, training uses a thin local adapter deleted at extraction. |
| `src/timber/bom.ts` | F1: nothing. F3 (additive only): `classifyNominal`, `CutLine` grade/species/treatment/unitOfIssue, `concreteLF`/`concreteCuYd` on `StageBom`/`BomSummary`, **export `MH_PER_BF`/`MH_PER_PANEL`/`MH_PER_CONC_LF`**. | Sanctioned by TIMBER-2 §3.5's "bom/elevation additive" disposition — the same clause under which T1 exports `BF_PER_LF`. `classifyNominal` at its §3.7 signature so T1 inherits it. |
| `src/timber/types.ts` | F3 (additive only): `species?`, `treatment?`, `nailingRef?`, `ph`, `refId?` on `Member`. | Generator-set; every existing field untouched; legacy suites must stay git-diff-empty. |
| `src/timber/{floor,walls,roof}.ts` | F3: panel nominals gain thickness (FD60); the new `Member` fields are populated. | The **only** generator edits in this plan. Legacy `test/timber-*.test.ts` must remain green **and unmodified** — if they cannot, stop-the-line (K-F1). **gap-5: FD60 is a GOLDEN-VISIBLE engine change** — it mutates emitted `nominal` strings. If **T0** landed, regenerate `test/goldens/frame/*.json` in the SAME PR with a `DECISIONS.md` entry naming FD60. If **T1** landed, its compat comparator locks these strings: coordinate the baseline with the TIMBER-2 owner before merging, or K-F1 stop-the-line. Never regenerate a golden and a behaviour change in separate PRs. |
| T3 router | F9: `#/train/*` + `#/build/<id>/packet` routes | Named injection point; additive; unknown-route rule preserved. |
| T3 picker component | F9: one additive `mode: 'train'` prop | FD91 — not a second list surface. |
| T3 `print.ts` | F9: packet + training pages registered | Additive registry entries. `src/ui/woodframe/packetPrint.ts` merges **into** `print.ts` at F9 (FD33 — a `print/` directory beside `print.ts` is the shell-collision class this plan removes). |
| T3 keyboard/accelerator registry | F2/F4: training keys register through it | Test asserts no duplicate binding across studio and training routes (T3 already binds `1..9,0`, `C`). |
| `src/ui/hub.html` | F2/F3: one copy line + anchor per existing card | Copy-only. No third card. |
| `package.json` | F1: adds `check:size`, `check:assets`, `update:thumb-goldens`, `gen:train-vectors`, `update:packet-goldens`, **and MODIFIES the `build:suite` and `verify` script VALUES** (FD90's chain; `verify` gains `check:assets`). F2 adds **`happy-dom` to root devDependencies** (gap-8: it exists only in `sap2/`; F2's happy-dom suites ship before T3, so this is unconditional). | Additive rows + two value edits. **Rebase, never overwrite** (§5.5). N-4 restated (gap-9): *`scripts/build-suite.mjs` and both vite configs are never edited* — orchestration script VALUES in `package.json` are fair game. The "dependencies unchanged" assert is scoped to the **runtime** dependency block. |
| `scripts/check-assets` | **T0-OWNED** (TIMBER-2 T0 item 3 creates `scripts/check-assets.ts` wired into `verify`). | gap-3: **if T0 landed**, F1 EXTENDS T0's allowlist — it does not create a second file. **If T0 has not landed**, F1 writes it at T0's specced path and extension (`.ts`, not `.mjs`) so T0 inherits it. FD43/N-6's "does not exist" assertion is replaced by "is T0's, or is created at T0's path". One file, one extension, one `verify` wiring, forever. |
| `.github/workflows/toolkit.yml` | **T0-OWNED** — the only root CI. | gap-4: every F-phase CI assertion (FD85's `.gitattributes` CRLF check, DoD-1's "green after merge") **requires T0**. Until T0 lands: `verify` + `build:suite` are run manually before merge, and the CRLF byte check lives inside `test/pkt-lockstep.test.ts` (a node test, not a CI step) so it runs regardless. No F phase blocks on T0; they degrade to manual verification. |
| `.gitattributes` (NEW) | F1 (with the first golden) | FD85. |
| `sap2/src/schema/watermark.ts` | F10: `fieldHeaderBlanks` fifth boolean | FD55. Additive; `watermark.test.ts` gains a case. |
| `sap2/src/schema/leaves/positions.ts` | F7: `trainingLabel` on `PositionStructure` | FD/SR-1b. Additive; schema-integrity assert. |
| `sap2/src/render/{svg,precision,drawPlan,drawSection}.ts` | F7: `idPrefix`, `displayForArtifact`, `highlightComponentId`, `labelChip` | Additive; base output byte-identical when unset (golden-asserted). |
| `sap2/test/gates/{g2,g9}` | F7: `inScope`/regex widened per SR-8 | Gates only ever GAIN cases (N-8). |

**No phase edits** `src/timber/frame.ts`, `scripts/build-suite.mjs`, either vite config,
any service worker, or any legacy test.

## 6.3 The phases

### F0 — Phones stop hurting (S–M)

**Contents:** M-1 stacked layout, M-2 height clamp (with the 320-floor replacement), M-3
on-demand render (full trigger list), M-3b `bindControls`, M-4 coarse hit targets, M-9
reference-device row.
✚ **Docs into the repo (gap-25, mirroring TIMBER-2 T0 items 6–7):** copy this plan to
`docs/TRAINING_AND_PACKETS_PLAN.md` — the LIVING copy that holds §10.4's progress table —
and the four source designs to `docs/training-design/design-{flashcards,training,packet,platform}.md`.
Every `design-flashcards.md §2` / `design-platform.md PD-7` citation in this plan resolves
to a repo path only after this lands; until then a fresh session cannot follow the
citations. **Acceptance row: the five docs are committed and every cited sibling section
resolves.**
**Files:** `src/ui/woodframe/viewport.ts` (**NEW, pure — the testable subject**),
`src/ui/woodframe.html` (CSS + one class hook), `src/ui/woodframe-scene.ts` (~40 wiring
lines), `DECISIONS.md`.
**Tests:** `test/train-mobile.test.ts` — imports `viewport.ts` only: `isNarrow` boundary
cases; `renderScheduler` dirty-flag semantics incl. hidden-tab pause and **each M-3
trigger**; `canvasHeight` with a **landscape-phone case** (`innerHeight 375`) proving the
320 floor no longer wins; a view-swap test proving a frame is still scheduled after
`setCamera`.
**Acceptance:** `npm run verify` green; `npm run build:suite` green; DevTools device
toolbar at 390 px with Touch enabled — single column, page scrolls past the canvas, chips
≥44 px, orientation change repaints; `DECISIONS.md` records the named reference device and
the "T3 preserves F0" note.
**Demo:** the deployed toolkit on the owner's actual phone — orbit with a thumb, scroll the
page like a page, tap a stud, read its card. No pinch-fighting.
**Descope ladder:** M-4 strip hit-rects → F4. M-1/M-2/M-3/M-3b are the phase.
**START HERE:** read `fitViewport` + the rAF loop + `setCamera` in `woodframe-scene.ts`, and
`sap2/index.html`'s `.narrow` block. FIRST TEST red: the `renderScheduler` state machine.
**Traps:** (1) keep `preserveDrawingBuffer` semantics — capture paths rely on
render-then-read, so on-demand rendering must still render before any capture; (2)
`setCamera` reconstructs `OrbitControls` — bind through `bindControls()`; (3) rebase
`package.json` additions.

### F1 — Pure core: labels, deck compiler, card art, gates (M)

Ships **nothing user-visible** — which is why it is safe, fast, and separately reviewable.

**Contents:**
1. `src/timber/labels.ts` — extract `PLAIN` + `WHAT` **verbatim** from `woodframe-scene.ts:44–87`; `src/ui/woodframe/labels.ts` re-exports; the scene imports from there. **Two content fixes in the same commit:** move `1x4` out of `WHAT['brace']` into the Size `CitedFact` path (TR-6), and split the member-card sentence out of `WHAT['stringer']` (`"Card shows the riser/tread layout math."` is a **false statement on a flashcard** — no layout math is shown — and points at unverified `(PH)` stair magnitudes).
2. `src/timber/train/core.ts` — §2.3 verbatim; `sap2/src/train/core.ts` byte copy deferred to F7, `test/train-sync.test.ts` written now and skipped until then.
3. `src/timber/train/compile.ts` — §2.4.1.
4. `src/timber/train/art.ts` — §2.2 (or the T2 extension path).
5. `src/timber/train/copy.ts`, `confusion.ts`, `stageNotes.ts` skeletons.
6. `scripts/check-size.mjs` (per-entry budgets, `dist/survivability/**` excluded, baseline recorded), `scripts/check-assets.mjs` + allowlist, `scripts/gen-train-vectors.mjs`; `package.json` script rows; `.gitattributes`.
7. `test/fixtures/train-vectors.json` generated once and committed.

**Tests:** `test/train-core.test.ts` (mark transition table incl. the **recall guard**;
`buildSession` — unseen ≤8, due-first over cap, lapsed-box-0 priority, seed stability;
`sealSession`; `shuffle`/`sessionSeed`/`mulberry32`/`fnv1a` against the committed vectors;
**FT-I2 lint: no `Date`, `Math.random`, network, or DOM import in `core`/`compile`/`quiz`**).
`test/train-cards.test.ts` (compile determinism deep-equal ×2; one card per present role
over the demo + full teaching-options matrix; exemplar rule incl. the modal-nominal tie;
`whereClause` table; **TR-1, TR-2, TR-2b, TR-2c, TR-4, TR-5**; `MissingLabel` fires on a
synthetic unlabeled role; perf <50 ms warmed mean). `test/train-labels.test.ts` (TR-6
digit + number-word scan over `PLAIN`/`WHAT`; **no WHAT entry references another UI
surface** — scan for `card`, `panel`, `shows`). `test/train-art.test.ts` (golden SVG
string-compare; **A-4: every card front contains ≥1 highlight-class element, over every
preset**; A-5 chip-free golden; A-6 unique-id assert over an N-card inlined page; structural
asserts: no external refs, no `<script`, polygon + KB + ms budgets; **byte-identical output
when `opts` omitted**). `test/train-numberfree.test.ts` (TR-8). `test/storage-keys.test.ts`
(FD5 repo-wide uniqueness).

**Acceptance:** `verify` + `build:suite` green; `git diff` empty on `test/timber-*.test.ts`;
`node scripts/check-size.mjs` and `node scripts/check-assets.mjs` pass with baselines
committed; **the deployed toolkit is byte-identical** (no UI shipped); vectors fixture
committed and sync-clean.
**Descope ladder:** `check-assets.mjs` → F2 (record the allowlist manually and say so).
`art.ts` → cannot be cut (the deck has no front without it).
**START HERE:** begin with the **labels extraction as its own commit** (smallest possible
diff, `DECISIONS.md` entry, T3-coordination note). FIRST TEST red: `train-cards` "demo
building compiles one card per present role".
**Traps:** (1) do not touch `walls.ts`/`floor.ts`/`roof.ts` — the compiler consumes models,
never generators; (2) card ids derive from **role**, never from an array index (models
regenerate; indices do not survive option toggles); (3) `WHAT['brace']`'s `1x4` must not
survive into any card string.

### F2 — TIMBER flip deck: the owner's ask #1 (M–L)

**Contents:** `src/ui/woodframe/train/view.ts` — deck header, browse + drill loops,
flip and **flip-reverse**, gesture handling with the **undo snackbar**, the **full §2.7
keyboard map** (registered through T3's accelerator registry when it exists), storage
envelope `timber2-train` via an **injected** storage handle, mastery bar labelled
`self-checked` (FD10), Big-mode toggle with regime-line exemption; `woodframe.html` overlay
container + styles + `TRAIN` chip + `#train` hash; **a dims row on the toolbar (FD101)** —
length, width, wall height, pitch, stud spacing — committed-on-valid, persisted in the
session envelope; hub copy lines.

**FD101 — the dims row ships here, not at F9.** `BuildingInput` **already** takes
`lengthFt`/`widthFt`/`wallHeightFt`/spacings/`risePer12`; only `woodframe-scene.ts:20`
hardcodes them. Deferring "train on YOUR structure" to the post-T3 integration phase would
leave every user's deck byte-identical forever and make the F2 demo's "generative proof"
rest on four teaching toggles against a fixed 20×16 building. ~30 lines, same additive class
F0 already sanctions. **It also makes F3's packet describe a real custom structure.**

**Tests:** `test/train-ui.test.ts` (happy-dom): mount/unmount on hash; flip via click and
Space; drill marks persist through a simulated reload; pointer-sequence swipe → mark;
**pre-flip swipe does not mark**; **undo restores box/lapses/seen/gotBy exactly**; keyboard
guard (no-op in inputs/dialogs); no duplicate accelerator binding; reduced-motion class;
64/44 px computed-height assertions; **front never contains `back.name`**; **the regime line
is present and visible with `data-big` set and under the print stylesheet**; flip-reverse
faces swap correctly; **no WebGL context created** (`getContext('webgl')` spy) and **no
`.glb` fetched** on a training route.

**Acceptance:** `verify` + `build:suite` + `check:size` + `check:assets` green; legacy diff
empty; open `/woodframe.html#train` → **demo deck ≥ 20 role cards**; toggling
Foundation=basement **adds stringer/tread/slab cards live**; changing the dims row
recompiles the deck; a drill session completes and mastery persists across reload;
**interaction budgets: flip ≤100 ms with zero layout shift** (fixed card box, both faces
pre-laid), **grade→next within one frame**, **cold deck open ≤300 ms** on the reference
device; **a 30-card one-handed portrait run with zero mis-taps**, recorded in
`DECISIONS.md`; desktop keyboard-only run; offline scan green.
**Demo the owner feels:** on the phone — tap TRAIN, see a highlighted mystery member, say
it out loud, flip, grade. Then type new dimensions and watch the deck become the deck of
**their** building.
**Descope ladder:** Big mode → F5; gestures → buttons only (buttons are the contract). The
flip deck and the keyboard map are the owner's verbatim ask — **not cuttable**.
**START HERE:** FIRST TEST red: happy-dom "flip toggles faces and announces via aria-live".
**Traps:** (1) `view.ts` must never import `three` — the scene is reached only through the
injected `SceneHooks`; (2) the regime line is card content — no hide rule may touch it;
(3) the deck compiles at entry from the already-loaded engine — no fetch, no lazy asset.

> **═══ CHECKPOINT C1 — owner uses the deck in a real session before F4/F5/F6 start. ═══**

### F3 — COMMAND PACKET v1: the owner's ask #3 (L)

**Contents:** `src/timber/packet/{spec,model,build,stockfit,csv,elevationSvg,stripSvg}.ts`
per §4.8; `src/ui/woodframe/{packetPrint,packetCss}.ts`; additive `bom.ts` and `types.ts`
fields (§6.2) and the panel-nominal thickness change in `floor.ts`/`roof.ts`; toolbar
`COMMAND PACKET` button + options row (title, crew sizes, productive hours, stock lengths,
include-annex); briefing view; CSV; the FD65 pre-T1 degradations; `.gitattributes` if F1
descoped it.
✚ **`scripts/gen-buildid.mjs`** (gap-10): writes `src/buildId.ts` from the sorted SHA-256
of built `dist/` asset filenames+contents, invoked as its own step in the `build:suite`
chain (FD90's pattern — never by editing `build-suite.mjs`, which N-4 protects). Exports a
stated fallback constant `'dev'` when `dist/` is absent so `verify` runs without a build.
**No import from `sap2/`** — the sap2 service-worker script stays sap2's. This is R-T2b /
FD67's missing mechanism.

**Explicitly NOT in v1:** waste percentage (a doctrine number — needs a cite), 3D captures
and true 2D plan (arrive with T3, folded in at F9), any SAP-2-side change, `compare.ts`.

**Packet accessibility (binding; gap-14 fix — the packet ships at F3, so its a11y ships at
F3, not with the trainer pass at F5/F6):** semantic heading order (one `h1` per document,
no skipped levels); every table has `<thead>` with `<th scope="col">` (and `scope="row"`
on the first cell of BOM rows); every embedded SVG carries `<title>` + `<desc>` with
**A-6-unique ids**; a logical tab order through the briefing view with visible focus;
text contrast ≥ 4.5:1 in both screen and print stylesheets. Asserted in
`packet-render.test.ts` at F3. Backlog row 22's accessibility pass remains **trainer-scoped**.

**Tests:** `test/packet.test.ts` (projection fidelity — packet totals **exactly** equal
`bomSummary` totals; `crewHours = manHours / crew`; `cumCrewHours` monotone, final = total;
whole-shift rounding vectors; **max-useful-crew suppression**; stock fit — every cut served
exactly once, `wasteLF = Σpurchased − Σcuts` exactly, deterministic under input shuffle,
special-length fixture, hand-computed FFD fixture; **FD61: no non-lumber nominal reaches
`stockFit`; every cube/weight term finite for a panels+concrete+built-up-girder fixture; a
`DRESSED` miss omits the row**; FD60: no two thicknesses share a BOM row; census equals an
independent count of the `ph` flag; determinism across two isolated processes; stage-plan
adapter). `test/packet-render.test.ts` (**full-HTML goldens string-compared** for the demo
building, a bunker fixture, and an LS-bearing fixture, `npm run update:packet-goldens`
same-PR rule; **structural lints running independently of goldens**: self-containment; every
`.pkt-sec` present; **FD75 ancestor-chain break rule with a 400-cut-line fixture**; **FD73
px→in normalised width lint failing at `>=` `contentWIn`**; **FD79 font-size→pt lint**;
FD76 both break spellings; FD77 no 2-row-minimum violation; FD56 page counter present;
FD69 footer is a `<tfoot>`; FD74 no regime mark via `background`/`box-shadow`/`opacity`;
R-T2/R-T5 verbatim wordlists incl. the FD63 sentence; no-date regex over the whole artifact;
bunker proximity regex). `test/packet-fit.test.ts` (**caps × max row height ≤ `contentHIn −
footerHIn − headerHIn`** per FD78; worst-case typeset fixture including the strip; 32 ft-wall
elevation and strip fixtures). `test/packet-csv.test.ts` (FD82 negative-number and
numeric-looking-string vectors; **FD83 whitespace-prefixed, already-quoted and DDE hostile
fixtures**; **FD84 equal field counts, no bare blank lines**; CRLF bytes; `.` decimal;
WARNING record position; unit-of-issue column per section; totals equal model sums; **no
cover-depth field** in the bunker fixture; no date row). `test/pkt-lockstep.test.ts`
(section order, `PKT_PAGE` literals, **FD66 two-PacketSpecs-differ vector**, **FD87/FD88
filename vectors incl. truncation, ambiguous slug, and one per `WatermarkState` variant**,
CSV escape vectors, shift-rounding vectors).

**Physical acceptance checklist (recorded in `DECISIONS.md`, `PKT F3:` prefix):** duplex
print, **Chrome and Firefox**, **Letter and A4**; **Headers-and-footers OFF** (FD70);
**Background graphics OFF** (FD74); **Scale = 100%** (FD79); **strips observed == pages
printed** (FD69); **no blank first or last page** (FD81); materials page tears off as a
recto (FD81); mono-laser legibility of hatches and 9 pt type (FD80's rasterization gate is
the machine half).

**Acceptance:** `verify` + `build:suite` + `check:size` + `check:assets` green; legacy diff
empty; open the packet for the **F2 dims-row structure** — materials table numbers equal the
stage panel's on screen; the exec page answers man-hours and materials **without turning a
page**; **≤6 sheets without the annex**; CSV opens in a spreadsheet with **no live
formulas** and sums correctly including any negative column; goldens committed; phone view
scrolls single-column; physical checklist complete.
**Demo:** the owner prints a five-sheet packet for a structure they just configured and
hands it across a desk: *what it is, why it is this size, what we need from you, what
happens if you say no, exact materials with units, crew and shifts, build order.*
**Descope ladder (FD102 — reordered):** **annex/drawings → 3D key views + strips → briefing
view → timeline SVG.** **NOT cuttable:** exec summary, materials, **the stock purchase
table** (it is the procurement answer — the reason a supply chief opens the packet), labor
scenarios, honesty strip, goldens.
**START HERE:** read `bom.ts` end to end (`CutLine`/`BomSummary` are your only inputs) plus
§4.5 in full **before** writing any CSS. FIRST TEST red: `packet.test.ts` projection
fidelity against `bomSummary`.
**Traps:** (1) the `(PH)` note is load-bearing honesty — it renders in **every** labor block,
print included; do not tidy it away; (2) `PKT_PAGE` lives in `packetCss.ts`, outside the
number-free scan (FD34) — do not "fix" a red build by moving files; (3) the four print
blockers (FD69/FD70/FD74/FD75) are not polish — a packet that fails any of them ships
unwatermarked or clipped paper; (4) the additive `Member` fields must leave every legacy
timber suite green **and unmodified**.

> **═══ CHECKPOINT C2 — owner hands a packet to a real recipient before F5 starts. ═══**

### F4 — TIMBER quiz modes (M)

**Contents:** `src/timber/train/quiz.ts` (pure: identify state machine, `judgeTap`,
stage-order grading, distractor plumbing already in core); `src/ui/woodframe/train/quizView.ts`
(M-2 identify, M-3 name-to-part, M-4 stage-order); `src/ui/woodframe/train/identify.ts`
(M-2b identify-in-scene: `SceneHooks.suppressSelect`, camera fit-to-member-AABB using
today's camera, **M-5** pick tolerance); `stripSvg.ts` replaces the inline strip emitter in
`woodframe-scene.ts`; `CONFUSION_GROUPS` populated with the `'ungrouped'` fallback.

**Tests:** `test/train-quiz.test.ts` (distractor determinism + name-dedupe;
same-confusion-group preference on a rigged fixture; `judgeTap` accept-any-member; the miss
ladder incl. the single-member-role reveal; stage-order grading + retry pass; **TR-7: no
`(PH)` doctrine value is ever a graded answer**, with a `ph:false` rigged fixture asserting
the unlock path; **`'ungrouped'` degrades without failing the build**). `train-ui`
additions (identify flow with **tap-to-advance only** (FD23); N2P flow; tap-to-place
stage-order with no scrolling at 360 px; **≥44 px tap-target geometry over dense presets**
(FD24); **a canvas drag never navigates, flips, or marks**). `test/train-mobile.test.ts`
additions (M-5 tolerance math on projected AABBs).

**Acceptance:** all modes on the phone; **highlight swap ≤16 ms and zero mesh-count delta**
versus the same scene without identify mode (FD94); **the recall guard now reachable** — a
flip-only session cannot promote a card to `known`, asserted; art legibility owner-judged
(fallback ladder: heavier halo → auto-cutaway → per-stage crop); device pass recorded,
non-blocking.
**Descope ladder:** identify-in-scene → `quiz-place` (2D) → stage-order. **Name-to-part is
the training crown jewel — cut last, owner-signed only.** If the ≥44 px assert cannot pass
for dense presets, `quiz-place` becomes projector/desktop-only and `quiz-id` is the phone
floor (FD24), recorded in `DECISIONS.md`.
**START HERE:** read the raycast block (`woodframe-scene.ts:~259`) before writing pick
tolerance. FIRST TEST red: `judgeTap` accepts any member of the target role.
**Traps:** (1) a wrong tap must never mutate scheduler state for cards not in the session;
(2) the canvas is orbit-only in training — nav and flip live on chrome; (3) reuse the
`data-member` group pattern for 2D hit-testing — do not invent a picking scheme.

### F5 — Printables, hip-pocket, projector (M)

**Contents (gap-11/12/13 additions marked ✚):** `src/ui/woodframe/train/printTrain.ts` (card sheets 2-up/4-up with **all three
duplex modes** and margin calibration marks; worksheets + keys with **fixed gutter slots**
and **variants A/B/C**; stage posters **as a print option on T3's stage-sheet page**, or
owning that page if T3 descoped it); `src/ui/woodframe/train/hip.ts` (`hipPocketPlan`,
`HIP_BUDGET`, `pass-phone` screens, **in-run position persistence**, `#/train/hip` resume,
recent-decks row, stripped hip stage screens); projector state (touch-first controls,
additive keyboard); `curriculum.ts` menu with minutes estimates; `stageNotes.ts` with the
per-family override.
✚ **`src/timber/train/drills.ts`** (gap-11) — the three KEPT drills as pure question
compilers over `CutLine[]` / `omitIds`: `drill-bom` (estimate a count, then reveal),
`drill-cutlist` (read a cut line, answer which stage/role consumes it), `drill-omission`
(an honest incomplete stage — name what is missing, generated by FILTERING active-stage
roles, never by fabricating a wrong member). Seeded, deterministic, no numeric answers on
`(PH)` quantities (TR-7).
✚ **`src/ui/woodframe/train/buildExercise.ts`** (gap-12) — rung 4: the capstone checklist
compiled 1:1 from `stagePlan` (one row per stage, press-and-hold to tick, per-stage
read-back prompt, and a "print the packet" action that hands off to §4). Ticks live in
`TrainState`, never a new store.
✚ **§3.4.5 glossary / nomenclature sheet** (gap-13, backlog row 19) — a printable
one-pager: every `MemberRole` in the current structure with PLAIN + WHAT and its
`(PH)` cite where one exists. Compiled from `labels.ts`; no authored content.
✚ **Timed overlay** (backlog row 20) — ships here, and its `timedEnabled` setting moves
into `TrainState.settings` at **F2** (gap-13's phase inversion fix) so its storage exists
before the feature does. Off by default; never a score, never a leaderboard.

**Tests:** ✚ `test/train-drills.test.ts` (determinism; no numeric answer while `ph:true`;
omission questions only ever remove members that the active stage legitimately lacks) ✚
`test/train-curriculum.test.ts` gains: the build-exercise checklist rows **equal**
`stagePlan` rows, in order. `test/train-print.test.ts` (**duplex mirror math for all three modes incl. the
1-column identity**; committed SVG goldens for one card sheet, one worksheet + key, one
poster; structural asserts independent of goldens; worksheet key differs from the worksheet
by **text-node insertions only**; variants A/B/C differ in target selection and word-bank
order and print their letter; **mono-safety: no sheet distinguishes anything by fill colour
alone**; `(PH)` footnote present when any doctrine line prints; page-count formula bounded).
`test/train-curriculum.test.ts` (stage-walk lessons ≡ `model.stagePlan` **1:1 in order**,
proved by mutating a copied plan and re-compiling; `newRoles` = first-appearance set;
cut lines equal `cutList(membersOfStage)`; `STAGE_NOTES` coverage + **every override key is
a live family × live stage**; `hipPocketPlan` counts ≡ `HIP_BUDGET` and are deterministic;
**hip stage screens carry no cut-list table and no MH line** (FD42); minutes estimates
present on every row; external lessons carry only `/survivability/` and **no SAP-2 nouns**).
`train-ui` additions (projector class + **a full run completed by touch only**; hip run
resumes after a simulated route change).

**Acceptance:** §3 rows; **lock screen → first card ≤60 s and ≤4 taps, warm-tab airplane
mode, run by a non-owner** (FD32); a non-owner stopwatch walk-through ≤15 min including
logging; **one-time** physical acceptances recorded in `DECISIONS.md` (real duplex print in
all three modes; mono-laser print with Background graphics OFF; 1080p at 3 m readability) —
these are **one-time acceptance, not recurring rituals** (FD103).
**Descope ladder:** posters → later; 2-up (keep 4-up) → later; projector → later. Worksheets
and hip-pocket are the floor.
**START HERE:** FIRST TEST red: the duplex mirror unit test (all three modes). Build sheets
as **pure SVG-string functions** in `src/timber/train/` where the layout is pure geometry,
so goldens run in node; `printTrain.ts` only assembles pages.
**Trap:** if `hip.ts` exceeds ~200 lines, something is being rebuilt that already exists —
stop and compose.

### F6 — Records, session sheet, privacy posture (S–M)

**Contents:** `src/ui/woodframe/train/records.ts` (envelope, boot revalidation, debounced
writes, monotonic `seq`, the **non-blocking cap** with its two one-tap outs); `#/train/records`
page with the posture block; the **attendance-and-topics** session sheet (FD49); export
`.timber-training.json`; `participantCount` capture, names **print-form only**.
**Tests:** `test/train-store.test.ts` (envelope versioning; revalidation of corrupt JSON /
wrong version / truncated records → empty + notice flag; `seq` monotonic across delete;
**cap behaviour: session start and run are never blocked; only save is, and the drop is
loud and names what was dropped**; debounce/flush event logic with injected storage and
injected clock; deterministic export serialization; **no name field is ever written to the
envelope**). `train-print` additions (session-sheet golden; posture block **verbatim**;
`participantCount` blank roster rows).
**Acceptance:** sheet prints with posture block, roster rows and signature blanks; export
file re-opens as valid JSON; "clear all" empties and the UI says so; a full hip-pocket run
writes **exactly one** record on "log".
**Descope ladder:** export → later; the session sheet is the floor (the squad-leader ask).
**START HERE:** FIRST TEST red: "cap reached — session still starts and runs".

### F7 — SAP-2 flip deck, regime-complete (M) — needs R0 only (complete today)

**Contents (✚ = completeness fixes, gaps 19–24):** `sap2/src/schema/callouts.ts` (§2.4.2
registry; `purpose`/`where` copy authored here, gated by SR-5); `trainingLabel` on
`PositionStructure` (SR-1b);
✚ **Conditions-of-use gate (gap-19):** the trainer sits BEHIND SAP-2's R0 first-run typed
acceptance like every other surface — it is reachable "from first boot" only in the sense
that no *additional* gate is added; `needsAcceptance` is checked before the TRAIN region
renders. Asserted in `sap2/test/train.test.ts`.
✚ **Blueprint reciprocity (gap-22, mirrors TIMBER-2 §6.5's precedent that a phase does not
start without reciprocal edits):** edit `docs/SAP2_BLUEPRINT.md` in this phase — §3.5 gains
`callouts.ts`'s naming-authority role, §2.4 documents the fifth `artifactPolicy` boolean
slot, and §4.6's gate table **reserves G-17** (gap-23: `g17-train-regime` must not mint a
colliding id — the table currently runs G-1..G-16) with its one-line scope and "stood up at
F7" status. Owner ack recorded. **This is an acceptance row, not a nicety.**
✚ **Gate registrations (gap-21):** register `sap2/src/train/` in **G-3's root inventory**
(an unclaimed top-level source dir fails CI by design) and refresh **G-12's precache
set-equality**; add TRAIN-region cases to **G-8** and **G-14**.
✚ **Fixtures (gap-24):** `sap2/test/fixtures/doctrineFill.ts` (a DOCTRINE-class fill,
test-only — G-11 proves dist ships none, so a test fixture is unaffected) plus the
**five-state + revoked watermark fixture matrix** SR-4 and F10 both assert against. SR-3 is
unsatisfiable without this.
`sap2/src/train/core.ts` (byte copy; `test/train-sync.test.ts` un-skipped);
`sap2/src/train/compile.ts`; `displayForArtifact` in `render/precision.ts` **with
`drawPlan`/`drawSection` converted to use it** (FD11); `RenderCtx` `highlightComponentId` +
`labelChip` + `idPrefix`; `svgDoc` `idPrefix`; the two-line TEMPLATE stamp on plan card art
(A-7); `sap2/src/ui/regions/train.ts` + mode button + styles; G-2/G-9 scope widening (SR-8);
`sap2/test/fixtures/train-vectors.json` byte copy.
✚ **G-16 (gap-20):** the trainer's authored copy — `callouts.ts` `purpose`/`where` and every
trainer string — joins **G-16's** card-copy gate set, not only SR-5's deferred word
allowlist. Until R2a stands G-16 up in full, F7 runs the subset that exists; at R2a the
trainer copy enters the gate's fixture set (recorded in §6.2).
**Tests:** `sap2/test/train.test.ts` (compile determinism; presence mapping vs
`POSITION_STRUCTURE`; `deckId` stability across soil/threat changes; **FD14: unsupported
volume models return `notModelled`, never throw**; **FD13: no fallback-art card carries
`identify`, and the fallback set is shrinking-only**; **FD15: `compiledFrom.fillIdentity`
copies all three fields verbatim**; highlight no-op golden).
`sap2/test/gates/g17-train-regime.test.ts` (**SR-1 over the corpus incl. `stageDrill.detail`
and over `<text>`+`<title>`+`<desc>`**; **SR-1b**; **SR-2 over every `POSITION_STRUCTURE`
row × every presence-flag combination**; SR-3 vs `displayForArtifact`; **SR-4 banner present
and visible under `data-big` and the print stylesheet, all five states + `revoked`**; SR-6
**enumerating every storage key written**; **SR-9 no download/print control in TEMPLATE or
TRAINING**). SR-5 in `sap2/test/schema-integrity.test.ts`. happy-dom region suite under
`sap2/test/ui/`.
**Acceptance:** `cd sap2 && npm run verify` green incl. G-2 (registry adds zero magnitudes),
G-9 and G-11 (the standalone artifact is still fill-free with the trainer aboard); the
trainer boots from `file://` in TEMPLATE with **zero digits on any card**; the `one_man`
deck = 8 components; root `build:suite` green; owner phone pass.
**Descope ladder:** identify prep (highlight-map breadth) → registry breadth (ship
`one_man`'s 8 only). **The TEMPLATE zero-digit gate is not cuttable.**
**START HERE:** read `SAP2_BLUEPRINT` §2.4/§2.7/§3, `watermark.ts`, `compute.ts` `Result`,
and `precision.ts` **before any code**. FIRST TEST red: SR-1b — `trainingLabel` is digit-free
for every row.
**Traps:** (1) **never format a number yourself** — route through `displayForArtifact` so
FICT and tokens are inherited; (2) your code contains **zero** numeric literals outside
`{0,1,2}` (SR-8 gives `train/` an empty structural budget); (3) `train/` may not import
`schema/leaves`, `schema/io`, `schema/consumers` or `engine/read` — if a quantity is
missing, extend `Result`.

### F8 — SAP-2 identify + stage-order (M)

**F8a (needs only F7):** identify on the 2D art — choice chips over the highlighted
plan/section; `data-component` hit regions sized ≥44 px via transparent pad rects;
name-to-part on the 2D SVG.
**F8b (needs R2a):** stage-order consuming R2a's `STAGE_ORDER` verb lines
(`deck.stageDrill` populated; **the deck may never suppress or insert stages relative to
`computeStages`** — a fixture test); **each entry carries `source` + `cite` where doctrinal,
and the reveal prints the verify-against-current-publications line in every state** (SR-7);
component art upgrades as R2a's geometry lands and the fallback set shrinks.
**Tests:** `sap2/test/train-quiz.test.ts` + g17 extension (SR-1 covers quiz copy); golden
highlighted SVGs via `gen-goldens.ts`.
**Acceptance:** all modes phone-green in TEMPLATE; stage order matches the `computeStages`
fixture; sap2 CI + root `build:suite` green.

### F9 — Post-T3 integration (M–L) — starts only after T3 merges

**Contents:** `#/train/*` and `#/build/<id>/packet` routes through the T3 router (`#train`
redirect); the deck list rendered through the **T3 picker in `train` mode** (FD91);
`Learn this structure` on the workbench; per-structure decks from the live spec; identify
upgrades (T3 camera rigs for framing; **cutaway-filtered question pools via `passesCut`**);
`COMMAND PACKET` on every family header; `packetPrint.ts` merged **into** `print.ts`;
**3D captures** (960×640 pattern) **and per-stage sheets — but see the gate below**;
`cardArt` switched to `cameraRigFor` + per-family `CardViewSpec` and `CutawaySpec`;
`lsRoles` wired to `lifeSafetyRegister()` if T4 has landed; the `tables.ts` cut-list
extraction (FD37).

**FD104 — the capture claim is conditional.** TIMBER-2's T3 descope ladder pushes
`print stage sheets → T8`, so stage captures are the **first thing T3 cuts**. F9's START
HERE **checks whether stage sheets actually shipped** before assuming the capture path
exists. If they did not: routes, picker mode, per-structure decks, packet button and
`print.ts` fold-in land unconditionally; **captures and stage sheets move to a follow-on
phase gated on T8**, recorded in `DECISIONS.md`.

**Split at the natural seam (FD105):** **F9a** = routes + `#train` redirect + per-structure
deck + picker mode + happy-dom route tests. **F9b** = packet button per family + packet into
`print.ts` + cutaway question pool + captures (if available). A T3 divergence strands one
half, not both.
**Tests:** route tests in the T3 happy-dom smoke suite (train route renders; redirect works;
unknown deck id → list + notice); identify pool respects `passesCut`; packet-in-`print.ts`
golden for one family; **per-family deck growth check over whatever families exist at
integration time**.
**Acceptance:** every live picker family has a working deck **and** a packet button;
cutaway question demo; `verify` + `build:suite` green; TIMBER-2's own suites untouched.
**Demo:** configure a custom shed → `TRAIN` gives the deck of **your** structure; `COMMAND
PACKET` gives the paperwork of **your** structure. The loop the owner asked for, closed.
**START HERE:** read the **as-built** T3 router/store/print/picker modules — this phase
adapts to what T3 actually shipped; where T3 diverged from its plan, follow the code and log
the delta. FIRST TEST red: the `#train` redirect in the smoke suite.

### F10 — SAP-2 packet assembly (M) — needs R2a + R6a

**Contents (✚ = completeness fixes):** `sap2/src/render/print/packet.ts` per §4.8
(`assemblePacket`);
✚ **Reciprocity + gates (gaps 21–22):** `docs/SAP2_BLUEPRINT.md` edited again for the
`fieldHeaderBlanks` policy boolean, with owner ack; the packet artifact registered in
**G-8** (goldens) and in **G-15's** release publication list.
`fieldHeaderBlanks` added to `artifactPolicy` (FD55); crew scenarios as **three real
`schedule()` calls**; `crewModel: 'scheduler'` printed as the column label (FD72);
`sap2/test/packet.test.ts` + goldens; `sap2/test/pkt-lockstep.test.ts` (byte-identical
vector fixture); print action wiring.
**Acceptance:** the assembled packet passes the **five-state fixture matrix** (TEMPLATE /
TRAINING / FILLED_UNCOMMISSIONED / COMMISSIONED / STALE, plus `revoked`): signature blocks
**and cover hand-fill blanks** ⇔ COMMISSIONED; FICT on every numeral in TRAINING; tokens
only in TEMPLATE; the strip stamps `fillIdentity`. A TRAINING packet printed at the demo
carries FICT on every numeral and **no signature blocks and no cover blanks**. The packet
artifact joins G-4 (self-contained), G-5 (determinism), G-11 (functional emptiness in
TEMPLATE) and the watermark-band placement fixtures.
**Descope ladder:** exec crew scenarios (the job-sheet + cover assembly remains).
**START HERE:** read the **as-built** R2a `jobSheet`, deck type, `FieldHeaderBlanks` and
`RenderOpts` (FD89) — define the deck type inline against what shipped, not against the
blueprint.

### LATER bucket (only if the owner pulls it)

`compare.ts` (§4.7); waste percentage **with a cite** (needs T8); nail poundage and hardware
sections (automatic once T8 lands); a TM 5-303 reconciliation credibility page; the
single-file `woodframe` standalone as a true offline story (§1.4); trainer night skin;
metric toggle; hub global search.

---

# 7. Improvements backlog — ranked, honest

Verdicts: **IN(Fn)** = scheduled in this plan · **LATER** = designed-for, not scheduled ·
**OUT** = rejected with a reason. Value = owner-felt value for the stated missions. Every
IN row traces to a mandate (M1 flashcards, M2 training breadth, M3 packet) or to a
non-negotiable (mobile, lean deploy).

## 7.1 IN-plan

| Rank | Item | Value | Cost | Depends | Phase | Honesty |
|---|---|---|---|---|---|---|
| 1 | Mobile baseline (stacked layout, height clamp, on-demand render, hit targets) | H | S–M | — | F0 | The mandate says super-good on phones. This is the floor, not a feature. Also the biggest battery/thermal win, at zero visual change. |
| 2 | Pure deck compiler + card art + gates | H | M | — | F1 | Everything else is a view of this. Near-zero marginal cost per family, forever. Ships nothing user-visible, which is why it is safe and fast. |
| 3 | **Flashcard deck (flip + flip-reverse), mobile + desktop** | H | M–L | F1 | F2 | Owner ask #1 verbatim. Keyboard ships here, not in a later a11y phase. |
| 4 | **Dims row (train/packet on YOUR structure)** | H | S | F1 | F2 | ~30 lines against a `BuildingInput` that already accepts them. Without it every user's deck and packet are identical forever. |
| 5 | **Command packet** (exec/materials/labor/assumptions, orderable BOM, print-safe) | H | L | F1 | F3 | Owner ask #3 verbatim. Grows with every T-phase for free. |
| 6 | Stock-length procurement fit | M–H | S | F3 | F3 | Pure arithmetic that turns a cut list into a purchase list. **Not cuttable** — it is why a supply chief opens the packet. |
| 7 | Identify-in-scene + name-to-part + stage-order | H | M | F2 | F4 | The best-way-to-train winner: it uses the 3D asset nothing else in the toolkit has, and it is cheap because pick and scene already exist. Name-to-part is the field task. |
| 8 | Paper flashcard deck (2-up/4-up duplex, three duplex modes) | M–H | S | F2 | F5 | Field training happens away from screens; barracks printers exist; no-phone policies are real. Print CSS + mirror math only. |
| 9 | Label-the-diagram worksheets + keys (A/B/C variants) | M–H | S | F2 | F5 | Highest value per line of code in the training half — once the solver is deleted (FD47). |
| 10 | Hip-pocket mode (+ ≤60 s setup budget) | H | M | F2 | F5 | The actual employment context: corporal, fifteen minutes, motor pool. Mostly composition of what already exists. |
| 11 | Stage walkthrough (scrubber as a lesson) | M–H | S | F2 | F5 | Turns the already-built scrubber and cut lists into lessons for free. |
| 12 | Records + attendance session sheet + posture | M | S–M | F5 | F6 | Makes training COUNT for the unit — a filed paper artifact. Tiny cost once names are print-only. |
| 13 | BOM estimation + cut-list reading drills | M | S | F4 | F5 | Direct pull-through to the job-site papers; compiled from existing BOM code. |
| 14 | Projector mode (touch-first) | M | S | F2 | F5 | A CSS class plus real tap targets; schoolhouse reach for pennies. |
| 15 | SAP-2 flip deck, regime-complete | M–H | M | R0 ✔ | F7 | Day-zero value on a ship-empty install: identity teaching with zero digits **is** the pitch, not a limitation. |
| 16 | SAP-2 identify + stage-order | M | M | F7/R2a | F8 | Same plumbing, gated where the blueprint owns the content. |
| 17 | Omission (inspection) drill | M | S | F4 | F5 | The honest fraction of error-spotting; teaches the QA behaviour real supervision demands. |
| 18 | Deploy size + asset budget gates | M | S | — | F1 | The OOM scar and the "stay lean" mandate deserve a number, not a vibe. `check-assets` **does not exist today** — this creates it. |
| 19 | Glossary / nomenclature sheet (printable PLAIN/WHAT) | M | S | F1 | F5 | A free projection; disproportionate value for recruits. |
| 20 | Timed overlay (off by default) | L–M | S | F4 | F5 | Pace pressure is real in ID training, but it must never punish the slow reader by default. Contained, and it changes nothing about content or scoring. |
| 21 | SAP-2 packet assembly | M | M | R2a+R6a | F10 | An assembly of already-blueprinted pages plus one exec page — which is why it rides R6a at M cost. |
| 22 | Accessibility pass (trainer + packet scope) | M | S | F2 | F5/F6 | Scoped to what exists. A full toolkit audit is LATER — do it once the T3 UI exists, not twice. |

## 7.2 LATER (designed-for, not scheduled)

| Item | Value | Cost | Why later |
|---|---|---|---|
| Comparison packets (`compare.ts`) | M | M | §4.7 — v1's need is served by comparison-stable exec pages; a real diff surface is a full phase competing with the mandate's own asks. Shape designed now so re-entry is cheap. |
| Waste percentage in the packet | M | S | It is a **doctrine number**. It ships when it has a cite, not before. The exact stock-fit remainder ships now. |
| Nail poundage + hardware sections | M | S | Automatic once T8 lands the structured fields; zero packet rework (the packet renders what the BOM carries). |
| TM 5-303 reconciliation credibility page | M | S | Needs T8's labor verification to say anything true. |
| Single-file `woodframe` standalone (true cold-tab offline) | M–H | M | §1.4 — the honest fix for the offline gap, but it is a **build-shape change** owned by whoever owns `build-suite.mjs`, not a training phase. |
| Progress import/merge across devices | L–M | S | Progress is disposable by design and export already covers migration. Revisit if owners report real loss pain. |
| Night mode | M | M | **Re-ranked on value, not token ownership (FD106).** The sibling ranked it LATER purely on a coherence argument owned by SAP-2 R6b. The value question — *do Marines drill and read packets in low light?* — was never asked. Put it to the owner: if yes, ship a **trainer-overlay-scoped** dark skin as a CSS-variable block inside the deck only (no toolkit theme, no R6b dependency). |
| Metric toggle | L | M | FM 5-426 carpentry is inch-native (dressed sizes, 16 in o.c.); display-only conversion adds rounding-drift risk into cut lists for near-zero USMC value. Revisit only on a real user ask. |
| Hub global search (roles, families, cards) | L–M | M | Worthless until the 14-family catalog and decks exist; cheap after (search over `FamilyDef` + labels). |
| Nail-pattern tap mini-game | L–M | M | Real value, but needs T8's structured `Member.nails` field. |
| Performance diagnostics page | L | S | Dev aid, not owner value; the budget tests already cover the honest need. |
| Full toolkit a11y audit | M | M | After T3, once there is one UI to audit rather than two. |

## 7.3 OUT (rejected, with the reason, recorded so they stay out)

| Item | Reason |
|---|---|
| **Wrong-placement / wrong-member error spotting** | FD50 — requires fabricating non-doctrinal assemblies on a doctrine-cited surface. The engine has no wrong-generator; building one invents wrong doctrine by definition; the wrong picture is what sticks. The omission drill keeps the honest fraction. |
| **SM-2 / FSRS scheduling** | Needs a wall clock and tuned parameters; decks are 8–40 cards. Session-indexed Leitner captures the value clock-free with three states a Marine can be told in one sentence. Algorithm tourism. |
| **Day-based Leitner** | Reads the clock, which both apps forbid, and misbehaves silently across the irregular cadence field use actually produces (three sessions one evening, nothing for two weeks). |
| **Streaks, XP, badges, leaderboards, best-time celebrations** | FD25/FD26 — gamification aimed at nobody: these users train because the platoon sergeant said so. Requires day tracking; adds state; cheapens the session sheet. On a shared squad phone "best" is somebody else's run. |
| **Per-Marine profiles / gradebook / longitudinal analytics** | FD51 privacy posture; a squad leader's filed paper already serves the real accountability need. The app must not become a surveillance artifact. |
| **Cut-length / span / nailing memorisation quizzes while `(PH)`** | TR-7 — the toolkit must not train Marines to memorise numbers still pending page verification. Reference on card backs, cited. Unlocks mechanically on `ph:false`. |
| **Numeric-answer drills on SAP-2, in ALL states** | SR-7 — even COMMISSIONED values carry "verify against current publications"; memorising operator-fill values contradicts the regime. Identity and sequence are the training value. |
| **Mixed cross-app decks / a hub trainer app** | XR-2 + FD3 — two regimes on one screen invites leakage; a third dual-engine bundle risks the deploy budget that already OOM'd. |
| **SAP-2 flashcards rendered timber-side** | The ship-empty end-run vector. SAP-2's own deck, inside its own FICT machinery, is the surface. |
| **Cost, price, or funding data anywhere in a packet** (gap-26) | The toolkit has **no cited price source**. A dollar figure printed beside cited material quantities is the fabricated-authority class BOTH regimes exist to prevent — it would read as costed by the tool. Class IV nomenclature and unit-of-issue stay (they help a supply chief order); pricing belongs to the supply shop's own system. Re-entry bar: an owner-entered, cited price fill under the SAP-2 regime — not a hardcoded table. |
| **SAP-2 curriculum, printables, hip-pocket mode, and training records** (gap-27) | Deliberate scope, not omission. SAP-2 gets **flip / flip-reverse / identify / stage-order only**. The rest stays TIMBER-side because `bareExports` is false in TEMPLATE and TRAINING (SR-9) — printable training aids and filed session sheets are exactly the "clean paper that escapes the watermark" vector the blueprint bans — and because SAP-2's blueprint owns its own training surfaces (its Build Card deck and comprehension protocol at R2a/R3). Composing beats forking. |
| **SAP-2's comprehension allowlist applied to timber cards** | FD52 — different audience and stakes; the terms of art ("cripple", "jack stud") **are** the content and would fail a top-3000 allowlist by design. |
| **Audio narration / TTS** | Offline TTS is platform-inconsistent and non-deterministic; instructors narrate better; screen readers already read the DOM. |
| **Video / animation authoring / photo card art** | The stage scrubber IS the animation, generated and always in sync. Authored media rots and bloats the deploy (OOM history). Engine-projected art is the anti-drift guarantee. |
| **Adaptive difficulty** | With 20–40 cards per deck there is nothing to adapt; the requeue and the scheduler cover it. |
| **Multiplayer / buzzer quiz between phones** | Requires networking — an N-1 violation. The hip-pocket oral mode delivers the same social pressure at zero bytes. |
| **QR codes on printables** | ~200 lines of new encoder to encode a URL that prints as text. |
| **Certificates with seals or crests** | Impersonation-adjacent: official-looking instruments the toolkit has no authority to issue. The plain session sheet with signature blanks is the correct artifact. |
| **Slide-deck (PPTX/PDF) export** | Projector mode + browser print covers the classroom; document generation is a new subsystem with font and layout debt. |
| **A PDF library** | The browser's Save-as-PDF is the artifact. Zero-dep rule (N-2). |
| **Deck sharing between devices via link** | Decks are projections — share the SPEC (`.timber.json` already does); progress export covers migration. |
| **Sandbox "build it yourself" drag-and-drop assembly** | A month of UI for a skill the build exercise teaches with real lumber; the engine is parametric, not free-assembly, so it would be a second engine. |
| **Quiz-content authoring UI** | Decks are generative (FD1); an authoring surface reintroduces exactly the hand-written content this plan eliminates. |
| **Saved-projects library beyond T3's store** | Duplicate: TIMBER-2 §5.5 (`timber2-session`, Your Builds, `.timber.json`) **is** the library. Anything more is a second store to keep coherent. |
| **Per-app PWA coherence / install banners** | TD16 binds (no SW for hub/TIMBER); SAP-2's SW is scoped policy. "Coherence" here means deleting a deliberate asymmetry. Documented, closed. |
| **Session share / shared decks** | Progress is private by design; any share path invites the telemetry/LMS creep the invariants ban. |
| **i18n** | Audience is USMC English; translated doctrine strings are a new liability surface (who verifies the Spanish nailing schedule?). |
| **Embedded scanned doctrine pages** | Distribution and custody questions plus megabytes. The cite discipline exists precisely so the user opens the real publication. |
| **SAP-2 side-by-side comparison** | The blueprint already ruled it OUT ("every surface is test surface"); this plan respects sibling regimes rather than re-litigating them. |

---

# 8. Test strategy & invariants

Runner: root `node --test` + `tsx`; happy-dom for UI suites (both trees' precedent).
`sap2/` runs its own pinned toolchain. Legacy `test/timber-*.test.ts` immutable.
**New suite names are `train-*` / `packet-*` / `timber2-train-*`** — never a repo-wide
count, never a rename of an existing suite.

## 8.1 Named suites

| Suite | Tree | Phase | Covers |
|---|---|---|---|
| `test/train-mobile.test.ts` | root | F0 | `isNarrow`, `renderScheduler` (all M-3 triggers, hidden-tab pause), `canvasHeight` incl. landscape, view-swap re-schedule, M-5 tolerance |
| `test/train-core.test.ts` | root | F1 | `mark` table + recall guard, `buildSession` (unseen cap, due-first, lapsed priority), `sealSession`, `shuffle`/`sessionSeed`/PRNG vs the committed vectors, FT-I2 purity lint |
| `test/train-cards.test.ts` | root | F1 | compile determinism, one-card-per-role over the option matrix, exemplar rule, `whereClause`, TR-1/2/2b/2c/4/5, `MissingLabel`, perf |
| `test/train-labels.test.ts` | root | F1 | TR-6 digit + number-word scan; no WHAT entry references another UI surface |
| `test/train-art.test.ts` | root | F1 | goldens; A-4 highlight presence over every preset; A-5 chip-free; A-6 unique ids; structural + budget asserts; byte-identity when `opts` omitted |
| `test/train-numberfree.test.ts` | root | F1 | TR-8 over `src/timber/train/**`, `src/timber/packet/**`, `src/timber/labels.ts` |
| `test/storage-keys.test.ts` | root | F1 | FD5 repo-wide localStorage key uniqueness |
| `test/train-ui.test.ts` | root | F2 | gestures, undo, keyboard map + guard + no duplicate accelerators, reduced motion, 64/44 px, front-never-contains-name, regime line visible in Big + print, no WebGL/no `.glb` on training routes |
| `test/train-quiz.test.ts` | root | F4 | distractors, `judgeTap`, miss ladder, stage-order grading, TR-7 + unlock path, `'ungrouped'` degradation, tap-target geometry |
| `test/train-curriculum.test.ts` | root | F5 | stage-walk ≡ `stagePlan` 1:1 (constructed proof), `newRoles`, cut lines, `STAGE_NOTES` + override keys, `hipPocketPlan` ≡ `HIP_BUDGET`, hip screen content shape, minutes estimates, external-lesson noun lint |
| `test/train-print.test.ts` | root | F5 | three duplex mirrors incl. 1-column identity, goldens, key-vs-worksheet text-only diff, variants A/B/C, mono-safety, `(PH)` footnote, page-count bound |
| `test/train-store.test.ts` | root | F6 | envelope versioning, revalidation, `seq`, non-blocking cap + loud drop, debounce/flush with injected storage+clock, deterministic export, **no name field ever written** |
| `test/packet.test.ts` | root | F3 | projection fidelity, crew/shift math, max-useful-crew, stock fit (incl. FD61 domain and finiteness), FD60 thickness split, census vs the `ph` flag, cross-process determinism, stage-plan adapter |
| `test/train-budget-sync.test.ts` | root | F1 | §2.3.1 structural-constant budget tables (root vs sap2 G-2) are equal — twin-sync discipline extended from `core.ts` to the budgets |
| `test/train-drills.test.ts` | root | F5 | drill-bom / drill-cutlist / drill-omission: determinism, no numeric answer while `ph:true` (TR-7), omission questions only remove members the active stage legitimately lacks |
| `test/packet-ui.test.ts` | root | F3 | **R-T8**: every briefing screen (3-screen and 5-screen fixtures) renders the honesty strip and the `(PH)` rate line, including under `data-big`; no hide/fullscreen rule can suppress them |
| `test/packet-render.test.ts` | root | F3 | HTML goldens + **independent** structural lints: FD73 width, FD75 ancestor break rule + 400-line fixture, FD79 font-size, FD76 both spellings, FD77 fragment minimum, FD56 counter, FD69 `<tfoot>`, FD74 no background-borne marks, R-T2/R-T5 wordlists, no-date regex, bunker proximity; **packet a11y (gap-14): heading order, `th`/`scope` on every table, `<title>`+`<desc>` per SVG with unique ids, focus order, ≥4.5:1 contrast in screen AND print stylesheets** |
| `test/packet-fit.test.ts` | root | F3 | FD78 caps × row height ≤ box − footer − header; worst-case typeset; 32 ft wall fixtures |
| `test/packet-csv.test.ts` | root | F3 | FD82 numeric passthrough, FD83 hostile fixtures (whitespace, pre-quoted, DDE), FD84 rectangularity, CRLF bytes, units column, totals, no cover depth, no date |
| `test/pkt-lockstep.test.ts` | root | F3 | section order, `PKT_PAGE`, FD66 hash vector, FD87/FD88 filename vectors (truncation, ambiguous slug, one per state variant), CSV escape vectors, shift rounding, `crewModel` label |
| `test/train-sync.test.ts` | root | F7 | `core.ts` twins byte-identical; `train-vectors.json` copies byte-identical |
| `sap2/test/train.test.ts` | sap2 | F7 | compile determinism, presence mapping, `deckId` stability, FD13 fallback rules, FD14 `notModelled`, FD15 `fillIdentity` triple, highlight no-op golden |
| `sap2/test/gates/g17-train-regime.test.ts` | sap2 | F7 | SR-1 (+`detail`, +`<title>`/`<desc>`), SR-1b, SR-2 full sweep, SR-3, SR-4 (Big + print + 6 states), SR-6 key enumeration, SR-9 affordance gating |
| `sap2/test/train-quiz.test.ts` | sap2 | F8 | identify/N2P on 2D, stage order vs `computeStages`, SR-7 sequence-source rule |
| `sap2/test/packet.test.ts` | sap2 | F10 | five-state + `revoked` matrix, FD55 `fieldHeaderBlanks`, real scheduler calls, `crewModel: 'scheduler'` label |

## 8.2 Invariants (gates — every phase)

| Id | Invariant |
|---|---|
| **I-1** | **Twin core:** the two `core.ts` copies and the two vector fixtures are byte-identical (root test). |
| **I-2** | **Purity:** no `Date`, `Math.random`, network primitive, or DOM import in `src/timber/train/**`, `src/timber/packet/**`, `sap2/src/train/**` (source lint, per tree). |
| **I-3** | **Determinism:** same input ⇒ deep-equal `DeckSpec`/`PacketModel` and byte-equal SVG/HTML/CSV, across two isolated processes. Seeded shuffle only. |
| **I-4** | **Regime rules TR-1..8 and SR-1..9 are enforced by the named suites.** SR-1/2/4/9 run as a **sap2 gate** so a leak fails the build, not a review. |
| **I-5** | **Progress-key stability:** editing a spec recompiles the deck **without losing mastery** (subject-keyed card ids; `deckId` per FD21). |
| **I-6** | **Storage honesty:** versioned envelope; corrupt state degrades to empty with a notice, never a crash; flush on hide; the cap never blocks training. |
| **I-7** | **Deploy:** zero new runtime deps, zero new dist asset files (`check:assets`), offline scan green, `check:size` within per-entry budget, `build:suite` green. |
| **I-8** | **Gesture safety:** vertical scroll never hijacked; pre-flip swipes never mark; every gesture has an equal-power visible control **and a 3 s undo**; a canvas drag never navigates, flips, or marks. |
| **I-9** | **Golden discipline:** goldens are committed **full files**, string-compared; structural asserts fail **independently** of golden updates; goldens update only in the same PR as the visual change. One regeneration script per artifact family. |
| **I-10** | **Projection-only:** every card, lesson, drill and packet datum traces to `Member[]`, `stagePlan`, `CutLine[]`, spec fields, `Result`, or a closed-vocab dictionary. No training or packet module stores structure facts. |
| **I-11** | **Dictionary lockstep (extends I-14):** every emitted `MemberRole` has PLAIN and WHAT (build-failing) and a `CONFUSION_GROUPS` group **or `'ungrouped'`** (advisory only); every `StageKey` has a `STAGE_NOTES` entry; every override key is a live family × stage pair. |
| **I-12** | **Marks travel:** `(PH)` and LS suffixes present in source fields appear on **every** surface that renders the line — screen, card sheet, poster, packet, session sheet. |
| **I-13** | **Regime wall:** no import from `sap2/**` under `src/timber/**` or `src/ui/woodframe/**` (import-graph test); the only SAP-2 reference is the literal `/survivability/` href; the noun lint finds no SAP-2 mode/fill/position noun. |
| **I-14** | **Auto-breadth:** the deck and packet suites iterate **every** catalog `FamilyDef` preset. A family added by T4–T7 that fails to compile a deck or a packet fails these suites, and the fix is a dictionary line, not code. |
| **I-15** | **Legacy untouched:** `git diff` empty on `test/timber-*.test.ts`; TIMBER-2 thumb goldens byte-identical when `ThumbOpts` are omitted; sap2 gate suites only GAIN cases. |
| **I-16** | **Copy single-source:** every user-visible training string comes from `copy.ts`; the copy table contains no numerals. |

## 8.3 What node can and cannot prove — the honest split

**Node proves:** structural lints (breaks, widths in normalised units, font sizes in pt,
`<tfoot>` presence, `viewBox` presence, cap arithmetic against the content box minus
footer), golden bytes, determinism, provenance, digit-freedom, tap-target geometry from
computed styles in happy-dom, and index alignment for duplex.

**Node cannot prove:** true pagination, whether the printer actually flipped on the right
edge, whether Background-graphics-OFF output is legible, or whether a mirrored phone's
projector run is readable at three metres. Those are **named physical acceptances**,
performed **once** and recorded in `DECISIONS.md` (FD103) — not recurring rituals on every
change. If a clip ever escapes to paper: **stop-the-line, and a new structural lint lands
before the fix** (SAP-2's risk-8 posture).

**Grayscale is rasterized, not asserted by word presence** (FD80): packet and printable
fixtures route through the existing SAP-2 300 dpi grayscale gate (and its TIMBER
equivalent), asserting hatch-pair separability and a minimum ink floor. The word lint stays
as an independent second check.

---

# 9. Risks & kill criteria

| # | Risk | Detection | Mitigation | Kill / fallback |
|---|---|---|---|---|
| **R1** | Mobile 3D perf — identify-in-scene janks on low-end Android | M-9 device pass at F4; TIMBER-2 mesh/stage budgets in tests; the FD94 numeric acceptance | One scene, SVG card art (deck costs no GPU), on-demand render (F0), zero mesh delta | Falls back to the 2D `quiz-place` variant (strip marks are already tappable); 3D identify flagged desktop-only in `DECISIONS.md`. Recorded, never silent. |
| **R2** | Gesture / test flakiness | flaky CI on UI suites; device pass | Buttons are the spec; drills are tap-to-place, never drag; no gesture is ever an acceptance criterion | Any gesture that flakes twice is deleted in favour of its button equivalent. |
| **R3** | **Regime leak through card or packet content** | the g17 gate, TR-1..8 suites, the FICT string assert, the SR-9 affordance gate, the noun lint | Regime is structural: emission is class-gated at derivation and formatting routes through `displayForArtifact`; no authored numerals anywhere; card art carries its own unccroppable banner | **Any leak found in review ⇒ the offending card kind is pulled toolkit-wide until the gate that would have caught it exists.** Non-negotiable. |
| **R4** | **Print fidelity** — a clipped table, a vanished watermark, a browser-stamped date | F3's physical checklist (both engines, both papers); FD75 ancestor lint + 400-line fixture; FD69/FD74/FD70 checklist rows | Structural lints for what node can see; explicit checklist rows for what it cannot | If a browser cannot paginate acceptably: ship "open print view" as a plain static page and stop chasing engines. **Never a PDF dependency.** |
| **R5** | Scope creep into LMS territory | backlog review against §7.3; kill-words in any request | N-7 invariant; names never persisted (FD51); no gradebook, no streaks, no best-run | **K-F2:** an ask for training RECORDS with individual attribution is a **regime conversation** (custody, attestation — SAP-2-commissioning-shaped), not a phase. Stop and surface it. |
| **R6** | Deploy weight / build memory — the OOM class returns | `check:size` per-entry budgets (F1); `check:assets` allowlist; the training-entry JS budget | Zero image assets, zero deps; trainer + packet are ~40–60 KB of source | Budget exceeded ⇒ cut card-art richness before function. Raising a budget requires a `DECISIONS.md` entry naming the **measured** cause. |
| **R7** | F/T merge collisions | PD-6 serialization rule; phase-start ritual checks main for an in-flight T3 branch | F0–F6 touch ≤40 scene lines and create only files T3 expects (`labels.ts`, `viewport.ts`) or does not name (`train/`, `packetPrint.ts`); F9 is the sanctioned integration point | T3 in flight ⇒ F phases pause (T3 is L; the wait is bounded). **Never rebase trainer code through a half-ported shell.** |
| **R8** | **Single-maintainer fatigue across three concurrent workstreams** | phase velocity vs the F0–F6 estimate; the C1/C2 checkpoints | FD99's explicit owner fork before F2; C1/C2 hard gates stop unused surface accumulating; F5/F6 are foldable into one phase | If C1 shows the deck unused, F4–F6 leave the plan rather than sitting as phantom IN rows. |
| **R9** | Content quality drift — new roles with thin WHAT lines make bad cards; ambiguous answers ("sill" means two things) | I-11 lockstep; a phase demo checklist item "read 10 random cards aloud"; a dedupe test asserting identify answers are unambiguous within a deck | Cards carry a stage/context line derived from `StagePlanEntry`; ambiguous roles get context-qualified fronts, derived not authored | A family whose cards read as garbage ships **without** a deck (a per-family opt-out list, default empty, each entry needing a `DECISIONS.md` line). **Bad cards are worse than no cards.** |
| **R10** | `(PH)` cite debt confuses learners | owner demo review at F2; the census visible on the packet cover | Deck-start note + small cite chips (the picker footnote pattern); the packet prints the census honestly; T8 shrinks it | If the owner judges `(PH)` noise unacceptable: cite chips collapse to a per-deck footer line (one CSS change). **The DATA never loses its cite.** |
| **R11** | R2a slips and strands F8/F10 | SAP-2 progress table | F7 is gated on **R0 only** (complete today) and ships real value alone; F8b/F10 are isolated | They simply wait. `compile.ts` is one file deep on the R2a dependency by design. |
| **R12** | T3 diverges from its plan and strands F9 | F9's START HERE reads the as-built modules | FD105 splits F9 at the natural seam; FD104 makes the capture claim conditional | A divergence strands F9b, not F9a. Log the delta; follow the code, not the plan. |
| **R13** | Card art illegible for small members (bridging, battens, let-in braces) | F2/F4 owner walk; the A-4 presence assert catches absence but not legibility | Pre-agreed fallback ladder: heavier halo + hatch → auto-cutaway → per-stage crop (always sparser) | Owner-judged acceptance, exactly like T3's thumbnails. |
| **R14** | Trainer state grows features (notes, user-authored cards) that re-introduce authored content | PR review against FD1 | FD1 is the line: cards are projections | User-authored card content is a **regime question** (which regime governs a numeral a user typed?) requiring the owner and the blueprint, not a feature PR. |

**Standing kill criteria:**

- **KILL-1** — any need for a **new runtime dependency**, a **new dist asset file**, or a **network call**: STOP. Redesign within the engines. These are the toolkit's non-negotiables.
- **K-F1** — any change that would require **editing `test/timber-*.test.ts`**, a sap2 gate, or engine semantics: stop-the-line, `DECISIONS.md` proposal (mirrors TIMBER-2 K2).
- **K-F2** — a training-records / certification / roster ask: regime conversation, not a phase (R5).
- **K-F3** — any request to ship **authored doctrine content inside quiz or packet strings**, bypassing `Member`/`Result` provenance: refuse. That is the SAP-1 failure class both regimes were built to kill.

---

# 10. Implementation handoff kit

## 10.1 Commands (verbatim)

```bash
npm run verify                        # typecheck + node --test test/*.test.ts + check:offline
                                      #   (+ check:assets once F1 has landed it)
npm run build:suite                   # THE deploy build — green at every merge to main
node scripts/check-size.mjs           # (exists after F1) per-entry deploy budget gate
node scripts/check-assets.mjs         # (exists after F1) dist allowlist gate
node --import tsx --test test/train-*.test.ts test/packet*.test.ts   # focused suites
node --import tsx --test test/timber-*.test.ts                        # legacy: git-diff-empty rule
npm run gen:train-vectors             # ONCE at F1; regenerating needs a DECISIONS.md entry
npm run update:thumb-goldens          # writes BOTH test/goldens/thumbs/ and .../cards/
npm run update:packet-goldens         # same-PR-only rule
npm run dev                           # /woodframe.html → TRAIN chip, or /woodframe.html#train
cd sap2 && npm run verify             # F7/F8/F10 only — sap2's own pinned toolchain
```

## 10.2 Per-phase START HERE (condensed — full versions in §6.3)

| Phase | Read first | FIRST TEST (red) | Trap |
|---|---|---|---|
| F0 | `fitViewport`, the rAF loop, `setCamera` in `woodframe-scene.ts`; `sap2/index.html`'s `.narrow` block | `renderScheduler` state machine | `setCamera` reconstructs `OrbitControls` — bind via `bindControls()`; preserve `preserveDrawingBuffer` render-then-read |
| F1 | `src/timber/types.ts`, `bom.ts`, `woodframe-scene.ts:44–87` | `train-cards` "demo compiles one card per present role" | Labels extraction is its own commit; card ids from **role**, never index; `WHAT['brace']`'s `1x4` must not reach a card |
| F2 | §2.7 in full; TIMBER-2 §5.4 mobile rules | happy-dom "flip toggles faces and announces" | `view.ts` never imports `three`; the regime line is card content |
| F3 | `bom.ts` end to end; **§4.5 before any CSS** | `packet.test.ts` projection fidelity vs `bomSummary` | The four print blockers are not polish; `PKT_PAGE` stays in `packetCss.ts`; `(PH)` note in every labor block |
| F4 | the raycast block (`woodframe-scene.ts:~259`) | `judgeTap` accepts any member of the role | A wrong tap must never mutate state for out-of-session cards; canvas is orbit-only |
| F5 | T3's print helpers and stage-sheet status | duplex mirror math, all three modes | If `hip.ts` exceeds ~200 lines, stop and compose |
| F6 | TIMBER-2 §5.5 store discipline | "cap reached — session still starts and runs" | No name field may ever be written to the envelope |
| F7 | `SAP2_BLUEPRINT` §2.4/§2.7/§3, `watermark.ts`, `compute.ts`, `precision.ts` | SR-1b: `trainingLabel` digit-free for every row | Never format a number yourself; zero literals outside `{0,1,2}`; no `schema/leaves` import |
| F8 | as-built R2a `STAGE_ORDER` / `computeStages` | deck stages ≡ `computeStages` fixture | The deck may never suppress or insert a stage |
| F9 | the **as-built** T3 router/store/print/picker | `#train` redirect in the smoke suite | Check whether stage sheets shipped **before** assuming captures exist (FD104) |
| F10 | as-built R2a `jobSheet`, deck type, `FieldHeaderBlanks`, `RenderOpts` | the five-state + `revoked` matrix | Define the deck type against what shipped, not the blueprint (FD89) |

## 10.3 Definition of Done (every phase)

1. `npm run verify` **and** `npm run build:suite` green on the branch **and after merge** (plus `cd sap2 && npm run verify` for F7/F8/F10).
2. `git diff` empty on `test/timber-*.test.ts`; sap2 gate suites only gained cases.
3. `check:size` within per-entry budget; `check:assets` clean; zero new dist asset files.
4. The phase's §6.3 acceptance items **individually checked by a fresh session**.
5. The demo walked on desktop **and** the reference phone (device pass **recorded, non-blocking**; the gating check is DevTools at 390 px with Touch).
6. `DECISIONS.md` entries (`TRAIN Fn:` / `PKT Fn:`) including any descope taken, with its reason.
7. Hub / `USER_GUIDE.md` copy updated when a surface became user-visible.
8. No `TODO` without a backlog row in §7.
9. Goldens updated **only** in the same PR as the visual change; the regeneration script run, never a hand edit.
10. Any physical-acceptance checklist the phase names is completed and recorded **once**.

## 10.4 Progress table (implementing sessions update the repo copy)

| Phase | Status | Gate | Ships |
|---|---|---|---|
| F0 | not started | none | mobile baseline + `viewport.ts` |
| F1 | not started | none (T2 collision rule) | labels, train core, compiler, card art, size/asset gates |
| F2 | not started | F1 | flip deck + flip-reverse + dims row + keyboard |
| **C1** | — | **owner uses the deck in a real session** | — |
| F3 | not started | F1 | command packet v1 + CSV + goldens |
| **C2** | — | **owner hands a packet to a recipient** | — |
| F4 | not started | F2, C1 | identify, name-to-part, stage-order, identify-in-scene |
| F5 | not started | F2, C2 | printables, hip-pocket, projector, curriculum menu |
| F6 | not started | F5 | records + session sheet + posture |
| F7 | not started | R0 ✔ | SAP-2 flip deck, callouts registry, g17 gate |
| F8 | not started | F7 (+R2a for 8b) | SAP-2 identify + stage-order |
| F9 | not started | **T3 merged** | routes, picker mode, per-structure decks, packet fold-in |
| F10 | not started | R2a + R6a | SAP-2 packet assembly |

---

# 11. Decisions log

Every judgment call, including every conflict between the four source designs and every
blocker fix applied from the critiques.

| # | Decision | Rationale |
|---|---|---|
| **FD1** | Cards and packets are **runtime projections** of the engines. No hand-authored card files, no second BOM, anywhere. | Anti-drift by construction: content cannot diverge from the engines because it has no independent existence. The mandate's "see the thing" is the engine's thing. |
| **FD2** | TD16 (no TIMBER service worker) is **binding and not re-litigated**. The offline gap is stated in copy and acceptance, not engineered around; the single-file standalone is a LATER row. | The sibling claimed hip-pocket "works identically offline" while `build-suite.mjs` writes a cache-killer `sw.js` and only `/survivability/` caches. Honest copy beats a build-shape change smuggled into a training phase. |
| **FD3** | **Sibling reconciliation:** flashcards owns the card/deck/scheduler model; training owns curriculum/printables/records; packet owns the packet; platform owns mobile/sequencing/backlog. One file tree, one card type, one storage key, no third hub card. | Three designs each fully specified a TIMBER trainer in incompatible trees; whoever merged second would have rewritten the first. Deciding once is the whole value of a synthesis. |
| **FD4** | Twin byte-identical `core.ts` copies, root-asserted; **no shared runtime module**. | Preserves `sap2/`'s self-containment (own toolchain, own gates) and the deploy's build shape. A shared module would carry TIMBER doctrine strings into SAP-2's liability perimeter. Drift is loud instead of impossible. |
| **FD5** | One localStorage key per app: `timber2-train`, `sap2-train-v1`. Repo-wide key-uniqueness test. | Two siblings both claimed `timber2-train`, a third claimed `timber2-training`; two envelopes with different schemas on one device would make revalidation impossible. The test stops a fourth. |
| **FD6** | **Deterministic SVG is the card art in both apps.** Live 3D is a *mode* (identify-in-scene), never a card face. | The scene module top-level-imports `three` (670 KB entry) and `OrbitControls` owns canvas drags; a scene-as-card-front makes the sub-second training route unreachable and lets a stray tap re-tint a member with the identical highlight colour. |
| **FD7** | Highlight is **non-chromatic**: 2× stroke + hatch + leader arrow, via explicit SVG attributes, never CSS backgrounds. | Company printers are mono laser and browsers default Background-graphics OFF. A grayscale fill makes the card's own question unanswerable. |
| **FD8** | **One projector, one golden script.** `update:thumb-goldens` writes both golden directories; the separate `update:train-goldens` is deleted. | Two scripts for output from the same module is the duplication TIMBER-2 already flagged as a defect (gap-17). |
| **FD9** | Scheduler = **3-box Leitner indexed by SESSION count**. SM-2/FSRS and day-based Leitner rejected. | Clock-free (both apps forbid hidden time state), deterministic, honest for irregular field cadence, zero tuning surface, three states explainable in one sentence. Decks are 8–40 cards; ease factors buy nothing. |
| **FD10** | `mark()` takes `via: QuizMode`; `CardProgress` records `gotBy`. **Promotion to box 2 requires ≥1 non-flip `got`.** Until a non-flip mode ships, the bar reads **"self-checked"**. | Otherwise self-graded flips and 25%-guessable 4-choice taps promote a card to "known" exactly like real production — the classic recognition-passing-as-recall trap, on the plan's only persistent indicator. |
| **FD11** | `displayForArtifact(q, token, watermark)` is a **single shared helper** in `render/precision.ts`, used by `drawPlan`/`drawSection` **and** the train compiler. | `artifactPolicy(...).fictSuffixOnNumerals` has **zero production consumers today**; calling the trainer's use "inheritance" was fiction and SR-2 would have rested entirely on new unshared code. |
| **FD12** | The SAP-2 component registry **is** the blueprint's `sap2/src/schema/callouts.ts`, created at its designated home with its designated role; R2a consumes it. | Build ahead on the blueprint's own file; never fork a second naming authority against its one-registry rule. |
| **FD13** | Fallback-art cards **lose `identify`** and **reverse their flip direction**. The fallback set is a registry column asserted **shrinking-only**. | Two fallback cards are the same stimulus with different answers; forcing a guess writes real marks into the scheduler. Reversing the direction keeps the card drilling recall honestly. |
| **FD14** | `compileSapDeck` **catches** the unsupported-`volumeModel` throw and returns `notModelled`. `frontal-berm`/`backblast-area` are gated behind R4/R7. | `compute()` throws for `cylinder` and `prism_ramp`, so the trainer would crash on three of ten positions and SR-2's sweep could never reach two components. |
| **FD15** | `compiledFrom.fillIdentity` mirrors `Result.fillIdentity` **exactly**, all three fields including `schemaHash`. | Dropping `schemaHash` records provenance that cannot detect the staleness it exists to prove. |
| **FD16** | `buildSession`: unseen throttled to ≤8; over cap, **due cards fill first** (lapsed box-0 first), then unseen. | The sibling put unseen before due and capped at 20, so a 25-card deck's first session was 20 brand-new items and lapsed reviews starved behind new exposure — backwards for spaced practice. |
| **FD17** | `sealSession` advances **at most once per trainer mount**; re-entry from the deck list starts session N+1. Cramming remains possible and is **recorded as a limitation**. | Without it, three back-to-back runs in twenty minutes walk a card box0→1→2 and inflate the only persistent indicator — the exact failure session-Leitner was chosen to avoid. |
| **FD18** | Shuffle, `sessionSeed`, and PRNG are **pinned literally**, plus a committed vector fixture read byte-identically by both trees. | "Deterministic permutation of `[a,b,c]`" pins nothing: two trees could both pass and still disagree. `sessionSeed` is derived from `(deckId, session)`, never `Date.now()`. |
| **FD19** | Exemplar = modal nominal (lexicographic tie-break), then minimum id. | Deterministic and representative; pinned by fixture. |
| **FD20** | **Regime markers are CARD CONTENT, not chrome**, and are exempt from every hide rule (Big mode, print, fullscreen). SAP-2's lives inside the art SVG; TIMBER's is a fixed line on the card back. | Making them header chrome meant a classroom projector would show TRAINING or DOCTRINE numerals with **no banner at all**. Asserting "the state string matches" is not asserting the mark is visible. |
| **FD21** | Progress keys are **stable subjects**: `deckId` = entry/family/position id; `cardId` = role/component. `compiledFrom` hashes are provenance only. | Editing a spec must never wipe mastery — training tracks the build as it evolves. |
| **FD22** | **Flip-reverse ships with flip**, not after the pick plumbing. | Zero new plumbing, and without it nothing exercises name-to-structure production — the direction the field task demands — for possibly months. |
| **FD23** | Identify **advances on user tap only**; the 900 ms auto-advance is removed (or becomes a default-off setting that never fires after a wrong answer). | Post-answer study of name/plain/whereItGoes **is** the learning event, and 900 ms cannot cover reading it. |
| **FD24** | `quiz-place` gets padded invisible ≥44 px hit rects with a nearest-member fallback, **or it descopes to projector/desktop** with `quiz-id` as the phone floor. | A stud is a few pixels wide at phone size; the plan's own ≥44 px rule was silently violated by the one surface where accuracy is scored, and missing by 3 px reads as "I got it wrong". |
| **FD25** | **No streak mechanism ships at all** — absent, not off-by-default. | Streaks optimise app-opening, require day tracking (reintroducing the wall clock), and aim at an audience that trains because the platoon sergeant said so. Re-entry bar: an explicit owner ask. |
| **FD26** | **"Last run" only** — no "best run" aggregation. | On a shared squad phone "best" is somebody else's run; it is the score-chasing this plan refuses, and a squad leader has no use for it. |
| **FD27** | Progress export/import is **TIMBER-only**; SAP-2 exposes none. | `bareExports` is `false` in TEMPLATE and TRAINING, and SR-9 gates every affordance on the policy. |
| **FD28** | Every gesture-originated mark shows a ~3 s **"Marked Got it — Undo"** snackbar. | Undo on the `U` key only leaves a phone fling — the primary platform's most likely mis-input — silently corrupting the schedule the gesture-safety invariant exists to protect. |
| **FD29** | The **full desktop keyboard map ships in F2**, with the deck, registered through T3's accelerator registry. | The mandate is "mobile **as well as** desktop". Demoting the desktop half to a later a11y pass ships half the ask for two phases. The accelerator registry already binds `1..9,0` and `C` — collisions are a real risk, so the registration is part of the same phase. |
| **FD30** | Projector mode keeps **real tap targets**; keyboard is additive, never the sole path. | The common field "projector" is a phone or tablet on an HDMI dongle with no keyboard; replacing controls with a key-hint bar deletes the only control surface. |
| **FD31** | No scored state is conveyed by colour alone, on screen or in print. | Washed-out projectors, bright-bay glare, colour-blind Marines, and mono answer keys all lose a colour-only signal. |
| **FD32** | `#/train/hip` (no id) resumes the last deck; a pinned recent-decks row; hip-pocket is the primary button. **Acceptance: lock screen → first card ≤60 s and ≤4 taps, by a non-owner.** | Hip-pocket classes die in the getting-there, not in the fifteen minutes. Stopwatching only the class measures the wrong half. |
| **FD33** | The packet print surface is `src/ui/woodframe/packetPrint.ts`, **not** `print/packet.ts`, and it merges **into** `print.ts` at F9. | TIMBER-2 binds the T3 tree as a flat single tree with `print.ts` in it; a `print/` directory beside `print.ts` is exactly the shell-collision class this plan removes. |
| **FD34** | `PKT_PAGE` lives in `src/ui/woodframe/packetCss.ts`, **outside** the digit-literal scan. Decided here, not discovered in CI. | `contentWIn`/`contentHIn` are bare decimals that would fail the number-free gate the packet adopts, on day one — inviting an implementer to "fix" red CI by moving files and quietly breaking single-source. Page geometry is layout, not doctrine. |
| **FD35** | The curriculum is a **menu with compiled minutes estimates**, and the hip-pocket block is the default primary action. | A ~25-lesson ordered queue is unusable to a corporal with a twelve-minute gap; he improvises and the ladder goes unused. |
| **FD36** | The SAP-2 external lesson is **content-free**: a label, a note, and the href. A noun lint bans SAP-2 mode/fill/position nouns in TIMBER training source. | The sibling's copy hard-coded SAP-2 internals that do not exist in code; mode names, fill classes and position ids will drift, and an import wall cannot catch a string. |
| **FD37** | The cut-list table renderer is **extracted to `src/ui/woodframe/tables.ts` at T3** and consumed by both the studio and training. | "The same renderer as the stage panel" was promised while the renderer lived in the studio UI and no shared module was in the file set — so training would have forked the table or required an unlisted extraction. |
| **FD38** | The build exercise names **§4 of this document** as the packet owner. | The sibling deferred to "the packet workstream" as if singular while two designs both claimed it. |
| **FD39** | `STAGE_NOTES` gains an optional per-`(familyId, StageKey)` override, defaulting to the generic line. | One line per `StageKey` shared across every family means the 'floor' line narrates a shed floor, a tower platform and a hut floor identically — generic instructor voice exactly where a new family most needs it. Still zero per-structure authoring. |
| **FD40** | `CONFUSION_GROUPS` gets an `'ungrouped'` total fallback; a missing role is an **advisory** test failure, **never a build failure**. | Otherwise every new `MemberRole` from T4–T7 puts a training-owned distractor table on TIMBER-2's critical path — a tower phase blocked by a quiz map. |
| **FD41** | **Every** authored training string routes through `copy.ts`; the copy table contains no numerals. | The sibling's authored-content inventory was undercounted by at least eight categories, none with a registry or a lockstep test. |
| **FD42** | Hip stage screens carry **only** the say-line, new-role PLAIN/WHAT, and the before/after pair. No cut-list table, no MH line. | A multi-row table on a phone held up in front of a fire team is unreadable at arm's length and irrelevant to an oral ID class; it pads the fifteen minutes with dead screens. |
| **FD43** | **`scripts/check-assets.mjs` is written by F1** (it does not exist today); until then, acceptance rows read `check:offline` green + review-enforced asset additions. | The sibling cited "check-assets green" as a §0 non-negotiable, in three phase acceptances, an invariant, and a KILL criterion — for a gate that appears in neither `package.json` nor `scripts/`. |
| **FD44** | **N-1b source lint** bans network primitives in training and packet source, separately from `check:offline`. | `check-offline.ts` walks built `dist/` for external URL strings and **passes when `dist/` is absent** — it would never see a `fetch('/api')` in `src/timber/train/`. The invariant was stated as machine-enforced when it was not. |
| **FD45** | **Three duplex modes ship** (long-edge, short-edge, manual/simplex), all mirror functions unit-tested including the 1-column identity; calibration marks move to the margin. | Supporting only a long-edge duplexer means a corporal who discovers the mismatch after six pages stops using the feature — and the calibration card burned a card cell. |
| **FD46** | The record cap **never blocks starting or running a session** — only saving, with two one-tap outs and a loud named drop. | Blocking session start is the tool refusing to teach at formation time because a convenience buffer is full, contradicting the same document's rule that nothing locks content behind state. |
| **FD47** | Worksheets use **fixed gutter slots** (K ≤ 8, predetermined Y), not a label-placement solver. | The solver was a geometry subsystem — projected centroids, gutter assignment, Y-sorting, overlap tolerance, in-viewBox leaders — with its own goldens and suite, whose only consumer is one printable, and nothing in the repo was reused. |
| **FD48** | Worksheets ship **variants A/B/C**, seeded, with the letter printed on sheet and key. | Fully deterministic sheets mean five Marines at one table get identical sheets — a copying exercise, not an assessment. |
| **FD49** | The session sheet is **attendance + topics covered**, with an event line, a hand-written duration blank, per-Marine initial/GO boxes, and scores collapsed to one summary line. | In a hip-pocket class results are a team score with no linkage to individuals; the sheet could not say who was trained, and foregrounded fractions and a spec fingerprint a squad leader does not file. |
| **FD50** | Wrong-placement / wrong-member error spotting is **rejected**; the omission drill is the honest subset. | Generating "plausibly wrong" assemblies requires fabricating non-doctrinal geometry on a doctrine-cited surface. The engine can honestly render **absence**, never wrong doctrine. |
| **FD51** | **Names are never persisted.** `participantCount` is the default capture; instructor and participant names are collected in the **print form only**; the printed sheet emits blank roster rows for pen entry. | Persisting `AttestedName[]` plus per-lesson scores is a named-individual score history on the device — the gradebook the same document cut, with an unresolved privacy question deferred to counsel. This kills the question, shrinks the store suite, and makes "paper is the record" true. |
| **FD52** | SAP-2's comprehension allowlist and protocol machinery are **not** applied to timber cards; the interaction and honesty patterns are reused. | Different audience and stakes: the terms of art ("cripple", "jack stud") **are** the content and would fail a top-3000 allowlist by design. Recorded so nobody bolts it on later. |
| **FD53** | Drawings move to an **opt-in ANNEX A**; default print is five sections with a **≤6-sheet target**, enforced by a page-estimate assertion. | ~18 drawing sheets ordered before materials and labor, with no page cap, produces a ~25-page packet with the BOM on page 20. It does not get read. |
| **FD54** | The cover carries an operator-filled **routing block**: SUBMITTED TO / THROUGH / SUSPENSE / POC + phone. Hand-fill, so the no-clock rule is untouched. | Paper with no routing and no point of contact dies in the in-box. |
| **FD55** | `artifactPolicy` gains a **fifth boolean, `fieldHeaderBlanks`** (COMMISSIONED only); the SAP-2 cover hand-fill block gates on it. | A ruled line under a role label **is** a signature block, and printing it in every state is exactly what the policy exists to prevent. It also avoids a fifth state-conditional inside the renderer, which R-S1's own lint forbids. |
| **FD56** | Page numbering via a **CSS counter** in the repeating footer; the contents line is **ordinal-only**. | The promised page-ordered contents list is unbuildable by the design's own admission (node cannot paginate), and a duplexed packet with no page numbers cannot be referred to in a brief. |
| **FD57** | The exec page is **seven blocks**, adding **REQUEST** and **RISK**; HONESTY COUNTS is demoted to the assumptions page. | The six-block version answered none of the three questions command asks: it had no ask, no risk, and gave prime real estate to the tool auditing itself. |
| **FD58** | Additive `Member` fields (`species`, `treatment`, `nailingRef`, `ph`, `refId`) and `CutLine` fields (grade, species, treatment, **unit of issue**); treatment derived by role **with a cite**. | `2x4, 12 ft, 37 pieces` cannot be requisitioned; `Member.grade` is dropped by `cutList`; there is no species, no treatment and no unit of issue anywhere; and sills/posts/footings need ground-contact PT the model never states. |
| **FD59** | `Member.ph: boolean` (generator-set) is the **census source**, not a substring scan of prose. | `doctrineRef` is free prose with `(PH …)` embedded mid-sentence, so a substring scan cannot tell whether the cite or a sub-claim is pending — making the number on the cover arbitrary. A lint fails any `doctrineRef` containing 'PH' with `ph:false`. |
| **FD60** | Panel nominals carry **thickness**; sheets-to-buy computed per thickness from panel area ÷ 32 ft². | `cutList` keys on `nominal|length`, so subfloor at 3/4" and sheathing at 1/2" collapse into **one order line for two products**; and ripped panels count as pieces cut, not sheets bought. |
| **FD61** | `stockFit`'s domain is pinned to `classifyNominal(n) === 'lumber'`; sheets and concrete route separately; a `DRESSED` miss **omits** the row. | Otherwise it prints purchase lines telling supply to buy 12-ft lengths of concrete slab, and the cube formula (which indexes a `DRESSED` table with no panel or concrete entries) goes `NaN`. |
| **FD62** | The packet adds an **EQUIPMENT & PREREQUISITES** block and **ON HAND / REQUISITION / LEAD TIME** columns on the Class IV table (printing blank, never omitted). | An S-4 cannot approve a build whose generator, saws, ladders, transport and delivery point are unstated, and cannot action a Class IV list with no on-hand column and no lead time. |
| **FD63** | **"Reviewed by (unit engineer)" is dropped** until a span check exists; the approval block prints a verbatim sentence scoping approval to the resource request, not the engineering. | Every structural size in the model is pinned and unverified (`'girder … load-area method pending'`, `'joist span … span check pending'`). Inviting an engineer's signature over placeholder sizing is the tool-conferred trust TIMBER forbids. |
| **FD64** | **Two new pure SVG emitters** (`elevationSvg.ts`, `stripSvg.ts`) are budgeted in the packet phase; the studio's inline strip emitter is replaced in the same commit. | "Elevations and strips exist today" is false — `elevation.ts` returns geometry only, and the one strip emitter is inline, `viewBox`-less, absolute-px-wide, 6.75 pt-labelled and toner-invisible. It fails this plan's own lints and cannot be scaled. |
| **FD65** | Every pre-T1 degradation is **specced and asserted to render**, not blank. | The packet claimed "NO T-phase required" while its marquee content depended on nine symbols verified absent from `src/`. |
| **FD66** | `hash8` covers `canonicalizeSpec` **+ canonicalized `PacketSpec` + APP_VERSION + DOCTRINE_VERSION`**. | Otherwise two materially different packets share one filename and the second download silently overwrites the first — while the design called the collision "harmless" on a false byte-identity assumption. |
| **FD67** | The honesty strip stamps a **content-addressed build id**, and app + doctrine version feed the filename hash. | `APP_VERSION` is hard-coded `'1.0.0'`, so every packet from every commit prints the same version and the filename carries none — packets from before and after a `(PH)`→verified labor-rate flip would be indistinguishable on paper. |
| **FD68** | Determinism (R-B1) is scoped **in writing** to HTML and CSV bytes; PDF metadata carries the printer's clock and is out of the app's control, and the same sentence prints beside the DATE blank. | Chrome writes `/CreationDate`, `/ModDate` and a version-bearing `/Producer` into every Save-as-PDF, so the "no dates, byte-reproducible" claim was false for the named primary artifact. |
| **FD69** | Repeating footers and bands use a **document-wrapping `<table><tfoot>`**, not `position: fixed`. Physical acceptance counts strips against pages. | Firefox prints a `position: fixed` footer **once**; a 20-page packet would ship with page 1 stamped and 19 bare, and no node lint can see it. |
| **FD70** | **"Headers and footers OFF"** is a pass/fail acceptance line, and a fixed sentence prints beside the DATE blank. | Chrome and Firefox both default headers-and-footers ON, stamping the system date into every sheet's margin — defeating "no printed dates, ever" through the only print path the design has. |
| **FD71** | Labor prints **whole shifts + raw crew-hours** (never tenths of a day), the governing rate **inline on the block**, a derived **max-useful-crew** with rows above it suppressed, and `productiveHoursPerDay` **default 6**. | Eighth-day resolution off three `(PH)` constants is false precision on the exact number a unit is held to; dividing serial-stage man-hours by 12 asserts twelve carpenters on one sill line; and an 8-hour default pretends the crew does nothing but build. |
| **FD72** | `crewModel: 'linear' | 'scheduler'` is a **printed column label**, in the lockstep vectors, and the linear model may not print a days column without the fidelity line in the same block. | One "PKT contract" otherwise prints the same-looking crew table under two different physics — SAP-2's non-linear scheduler and TIMBER's division — with nothing on the page saying so. |
| **FD73** | Content box **7.0 in**; every block `width: min(7.0in, 100%)` with `box-sizing: border-box`; the lint normalises px→in at 96 dpi and fails at **`>=`** `contentWIn`. | A4's printable width at 0.5 in margins is 7.268 in — a 7.2 in box leaves 1.7 mm of total slack, one border away from Chrome clipping the right edge, and the old lint permitted exactly the failing value while never inspecting the px-and-% markup that actually overflows. |
| **FD74** | Regime marks are **inline SVG geometry** with `print-color-adjust: exact`; a lint bans marks expressed via `background`/`box-shadow`/`opacity`; a physical row prints with Background graphics OFF. | Browsers drop backgrounds in print by default, so a CSS-background TRAINING band **silently vanishes and unwatermarked training paper leaves the building**. `print-color-adjust` appears nowhere in this repo today. |
| **FD75** | `break-inside: avoid` is permitted **only** on blocks with a declared cap; the lint walks the **ancestor chain**; a 400-cut-line fixture joins the fit suite. | The old "wrapped in `.pkt-block` OR carries `<thead>`" rule let a long uncapped BOM table pass while Chrome renders the unbreakable box by **clipping** — cut lines vanish off the bottom with no on-screen symptom. |
| **FD76** | `PKT_CSS` emits **both** legacy `page-break-*` and modern `break-*`; the engine matrix is stated (Chrome + Firefox supported and in acceptance; Safari/iOS out of scope). | WebKit honours the legacy spelling far more reliably, and an unstated matrix means an iPad print by an S-4 gets no forced section breaks at all. |
| **FD77** | Widows/orphans solved **structurally** (heading + first N rows in a capped avoid-unit; `break-after: avoid` on headings; capped table fragments with repeated `<thead>`; no fragment under 2 rows). | Firefox implements neither CSS property, so the CSS route does not exist; a lone orphan row on the next page reads as an unlabeled mystery figure. |
| **FD78** | Fit arithmetic asserts caps against `contentHIn − footerHIn − headerHIn`. | Every page carries the repeating strip (and in SAP-2 the band), so asserting against the raw box made every cap optimistic by a strip — enough to push the last row off the page on Letter. |
| **FD79** | Body text floors at **9 pt (12 px)**, footnotes 8 pt; the lint parses every `font-size`, converts px/rem→pt at 96 dpi, and fails below the floor; **Scale = 100%** is a checklist row. | 8 pt is too low for grayscale duplex plus field photocopying, the CSS will be authored in px like the existing print CSS (10 px = 7.5 pt), and the old lint list had **no font-size check at all**. |
| **FD80** | Packet and printable fixtures route through the **300 dpi grayscale rasterization gate**; the word-presence lint stays as an independent second check. | A word lint is not evidence that hatch patterns, 9 pt type and 0.75 pt strokes are legible in mono — and SAP-2 already runs the real gate. |
| **FD81** | `break-before: page` is scoped `.pkt-sec + .pkt-sec`; materials and the approval block start **recto**; blank versos are recorded as expected output; "no blank first or last page" is a checklist line. | Engines differ on a forced break before the first box, and an S-4 handed a packet whose page 1 is blank distrusts the rest. The real workflow tears the materials page off for the supply shop, which undifferentiated duplex makes impossible. |
| **FD82** | CSV API splits: `csvText()` hardens, `csvNum()` **never** prefixes or quotes. | Applying injection hardening to numbers turns any negative value into Excel TEXT, so the supply shop's column sums silently omit it — defeating "exact totals" precisely where it matters. |
| **FD83** | The apostrophe goes **inside** the quotes; the test targets the **first non-whitespace** character; hostile fixtures add whitespace-prefixed, pre-quoted and DDE cases. | Excel evaluates a formula after unquoting, and importers trim leading whitespace — two known bypasses of the stated escape. |
| **FD84** | The CSV is **rectangular**: every record padded to the max column count, no bare blank lines, a SECTION marker column instead. Claim restated as "RFC-4180, rectangular". | Ragged records with blank separators are not RFC-4180, and strict parsers error on the supply shop's import — so the compliance claim was false where it was load-bearing. |
| **FD85** | `.gitattributes` (`test/goldens/** -text`, `*.csv -text`) lands **with the first golden**, plus a CI byte assert. | The repo has none; CRLF goldens and LF HTML goldens will be EOL-normalized on any runner with `core.autocrlf=true`, so goldens fail spuriously and the CRLF assertion can pass against a fixture that is wrong in the index. |
| **FD86** | TIMBER filenames carry a **trust word** (`timber-planning-…`). | A neutral filename in a shared folder gives no hint the contents are a planning estimate on placeholder rates — the same directory-listing argument that justifies SAP-2's state word. |
| **FD87** | The SAP-2 state word goes **first and uppercase**; state words are forbidden inside slugs; truncation and ambiguity vectors are tested. | File managers, `ls` columns and mail clients truncate the middle or tail, so a mid-name state word is the first thing cropped — and a slug containing "training" makes the word ambiguous to parse. |
| **FD88** | `revoked` gets its **own** filename word; the state→word map is a **total function over every union variant**, one lockstep vector each. | `watermark.ts` models `revoked: true` explicitly and the design says surface it loudly, yet on disk it was indistinguishable from ordinary awaiting-commissioning paper — and a new state could silently fall back to a softer word. |
| **FD89** | `FieldHeaderBlanks`, `RenderOpts`, `computeStages` and the deck type are declared **R2a outputs this phase consumes**, defined inline against the as-built code. | All four are blueprint-only and absent from `sap2/src` (the deck type appears **zero times** even in the blueprint), so the stated signature does not compile against today's tree. |
| **FD90** | `check-size` runs as a **separate npm step** in `build:suite`'s command chain; `build-suite.mjs` internals stay untouched. | The sibling asserted both "not edited by any F phase" and "wired into build:suite's tail as a step", and a fresh session could not tell which won. |
| **FD91** | `#/train`'s deck list renders through the **T3 picker component in a `train` mode**, not a second list surface. | A parallel picker would duplicate T3's runtime thumbnails, groups, filter, resume strip and roving focus — and drift from them. |
| **FD92** | Narrow mode **replaces** `fitViewport`'s 320 px floor. | On a small landscape phone (`innerHeight ≈ 375`) the floor wins and the canvas re-fills the screen, defeating the scroll escape the height clamp exists to provide. |
| **FD93** | The on-demand render trigger list is stated completely: controls change, end of `rebuild()`, **`fitViewport`/resize**, **`onPropAssetsReady`**, and any capture path before readback. Damping is not enabled, so that clause is dropped. | Omitting resize leaves a **blank canvas** after an orientation change (`setSize` clears the buffer); omitting the GLB-ready callback leaves the scene without its real lumber props. |
| **FD94** | F4 acceptance states numbers: **highlight swap ≤16 ms and zero mesh-count delta**, both asserted; the device pass records pass/fail over a 10-tap round. | "Acceptable frame rate" is undefined, and the R1 kill line hung off that undefined word while TIMBER-2 already publishes real budgets. |
| **FD95** | **F0 names the reference device itself** (make, model, Android version, browser version) in `DECISIONS.md`; device passes are recorded, non-blocking; the gating check is DevTools at 390 px with Touch. | Nothing in either governing plan names a device, `DECISIONS.md` has no row, and T3 has not started — so five acceptance rows and a DoD item were unexecutable as written. |
| **FD96** | `src/ui/woodframe/viewport.ts` is created at F0 as F0's **importable test subject**. | `woodframe-scene.ts` runs `getElementById` and `new WebGLRenderer()` at module scope, so `node --test` throws on import — F0's own named test had no subject and the phase was unimplementable as filed. |
| **FD97** | Never run an F phase concurrently with T3. T0–T2 are safe in parallel **with the corrected rationale** (T2 does add `thumbnails.ts` and a package.json script). | The sentence removes the whole merge-risk class; the corrected rationale prevents a false sense of safety around `package.json` and the `src/ui/woodframe/` directory. |
| **FD98** | **F3 (packet) is sequenced before F4 (identify).** | Owner ask #3 was scheduled behind a discretionary breadth item that shares its only dependency — an unforced inversion of the plan's own value ranking. |
| **FD99** | The combined cost is stated (**F0–F6 ≈ 9–13 sessions** on top of T ≈ 17–22 and R ≈ 20+) and the owner gets an explicit **fork** before F2. | Front-loading seven phases pushes TIMBER-2's owner-named centrepiece back a full quarter; the owner should choose that, not discover it. |
| **FD100** | **Hard checkpoints C1 and C2**: F4/F5/F6 do not start until the deck is used in a real session; F5's printables wait until a packet has been handed to someone. | Four phases of printables, records, hip-pocket and projector shipping before any evidence of use — each carrying manual acceptance rituals — is how plans accumulate unused surface. |
| **FD101** | The **dims row ships at F2**, not F9. | `BuildingInput` already accepts the dimensions; only the demo constant hardcodes them. ~30 lines turns "the deck of YOUR structure" from a post-T3 promise into an F2 fact — and gives F3's packet a real custom structure to describe. |
| **FD102** | The packet descope ladder is reordered: **annex → 3D/strips → briefing → timeline**, with the **stock purchase table not cuttable**. | The old ladder cut the S-4's procurement answer first while ~18 sheets of drawings were never on the ladder at all. |
| **FD103** | Physical acceptances are **one-time**, recorded in `DECISIONS.md`, not recurring rituals on every change. | Three manual rituals recurring on every change across four phases is a maintenance tax a single maintainer will not pay, and an unpaid ritual is worse than an honest one-time record. |
| **FD104** | F9's capture/stage-sheet claim is **conditional** on whether T3's stage sheets survived its own descope ladder; START HERE checks before assuming. | T3's ladder pushes stage sheets to T8, so captures are the first thing T3 cuts — and F9 was sized and accepted against a deliverable T3 itself flags as most likely absent. |
| **FD105** | F9 splits into **F9a** (routes, picker mode, per-structure decks) and **F9b** (packet button, `print.ts` fold-in, cutaway pool, captures). | F9 is the riskiest phase and its own START HERE admits T3 may have diverged; splitting at the natural seam means a divergence strands one half, not both. |
| **FD106** | Night mode is **re-ranked on the value question**, put to the owner; if yes, it ships as a trainer-overlay-scoped CSS-variable block with no toolkit theme and no R6b dependency. | The sibling ranked it LATER purely on a token-ownership argument owned by another plan; the actual question — do Marines drill and read packets in low light — was never asked. |

---

| **FD100** | **Post-synthesis completeness pass applied in full — all 28 findings patched in place, none deferred.** (1–2) structural-constant budgets given a real mechanism (§2.3.1) so the digit scans are satisfiable for `core.ts`, `curriculum.ts`, `quiz.ts`, `packet/spec.ts`, `build.ts`, with a root↔sap2 budget-sync test; (3–5, 8–9) collision map corrected — `check-assets` and `toolkit.yml` are T0-owned, `package.json` may edit `build:suite`/`verify` VALUES (N-4 restated to protect `build-suite.mjs` itself), root `happy-dom` added at F2, and FD60 named as a golden-visible engine change requiring same-PR golden regeneration; (6–7) `SceneHooks` and `viewport.ts` given binding signatures and owning phases — the two "treated as existing but never defined" types; (10) `buildId` assigned a file, phase and mechanism with no cross-tree import; (11–13) the three kept drills, the build exercise, the glossary sheet and the timed overlay given phases, files, tests and a fixed curriculum position, with `timedEnabled` moved to F2 so storage precedes feature; (14) packet a11y moved to F3 where the packet actually ships; (15) the strip-emitter replacement moved into F3 so two emitters never coexist; (16–17) a binding desktop layout block added and `leftHand` specified; (18) pre-T3 custom `deckId` defined so two structures cannot share one mastery record; (19–24) SAP-2 side completed — conditions-of-use gate, R3 sequencing decision, G-16 copy coverage, G-3/G-12/G-8/G-14/G-15 registrations, blueprint reciprocity with G-17 reserved, and the DOCTRINE + five-state fixtures SR-3/SR-4 require; (25) the plan and its four source designs committed to the repo at F0 so every citation resolves; (26–27) cost/pricing and SAP-2 training breadth dispositioned OUT with reasons; (28) R-T8 protects the briefing view's honesty strip. | The completeness critic found the same defect class twice over: shapes and mechanisms cited as if they existed. Every one now has a signature, an owning phase, a file and a test. |

*End of plan. Implementing sessions: read §1.2, §1.3 and §2.0 in full, then start at §6.3
F0 (or F7 — it is independent and its gate, R0, is already complete), holding this document
plus the governing plan of the app being touched.*
