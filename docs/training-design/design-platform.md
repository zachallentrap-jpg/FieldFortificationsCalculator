# PLATFORM & SCOPE — Training Layer + Command Packet (F-plan)

> Role: PLATFORM & SCOPE ASSESSOR deliverable for the training/packet initiative.
> Composes with the BINDING `docs/TIMBER2_PLAN.md` (T0–T8) and `docs/SAP2_BLUEPRINT.md`
> (R0–R8). This document never forks either plan's models; where it touches their
> territory it consumes their published shapes and states the dependency. Ground truth
> verified 2026-08-02 against: `src/timber/{types,frame,bom}.ts`,
> `src/ui/{woodframe-scene.ts,woodframe.html,hub.html}`, `sap2/src/engine/compute.ts`,
> `sap2/src/schema/watermark.ts`, `scripts/build-suite.mjs`, `vite.suite.config.ts`,
> root + sap2 `package.json`, root `test/` (33 legacy timber tests present), SAP-2
> progress (R0 complete; R1+ not started), TIMBER-2 progress (T0–T8 not started).

---

## 0. Decisions up front (the spine — everything below hangs off these)

| # | Decision | One-line why |
|---|---|---|
| PD-1 | **No shared `src/shared/` module. Each app hosts its own thin implementation of a small SPEC'D core** (the "Trainer Core spec", §1.3) — TIMBER in `src/training/` + `src/ui/woodframe/train/`, SAP-2 in `sap2/src/train/` (built only at F4). | SAP-2 is a separate tree with its own pinned toolchain, tsconfig, and liability gates (G-2 number-free, G-11 emptiness). A shared module either enters SAP-2's gate perimeter carrying TIMBER doctrine strings (regime leak by construction) or forces cross-tree path aliases into 2 vite configs + 2 tsconfigs + 2 test runners. The genuinely shared surface is ~250 lines; duplication is cheaper than permanent build entanglement. Drift control = doc-pinned behavior vectors reproduced by a test in EACH tree (the `sap2/docs/HASHING.md` house pattern). |
| PD-2 | **Trainer and packet consume ONLY the already-planned descriptors.** TIMBER: `Member[]` + `STAGES` today, `StructureModel`/`StagePlanEntry[]` after T-phases (§3.7 of TIMBER2_PLAN), plus the PLAIN/WHAT label dictionaries. SAP-2: `Result` + the R2a deck (`computeStages(result)`) + registry plain names. Enforced by import-boundary lints in both trees. | Zero new coupling; the trainer is "just another projection", same discipline as BOM/2D/3D. |
| PD-3 | **No new top-level page, no new build entry.** TIMBER training mounts inside `/woodframe.html` behind a hash (`#train` pre-T3; `#/train` route after T3). SAP-2 training mounts inside `/survivability/` behind its shell nav. The hub gets one static **Training card** (anchor links) at F5. | `build-suite.mjs` and both vite configs stay untouched; deploy stays one suite; nothing new to keep offline-clean. |
| PD-4 | **Number regime on cards is a per-card `regime` field with per-app rules** (§1.4): identity/purpose/sequence content is qualitative and free in both apps; TIMBER numeric cards carry `doctrineRef` with the (PH) discipline (LS suffix once T4 lands); SAP-2 magnitude cards exist ONLY when the loaded fill is class `TRAINING` (inline FICT inherited from the shared formatting path) — DOCTRINE fills get identity/sequence/check-phrase cards only, TEMPLATE gets tokens. | Respects both binding regimes exactly; a quiz can never become an uncommissioned doctrine crib sheet, and TIMBER cards can never show an uncited number. |
| PD-5 | **The Command Packet is TIMBER-side work** (`src/timber/packet.ts` pure projection + a print surface). SAP-2's equivalent (job sheet + Build Card deck) is already governed by its blueprint; we do not duplicate or "improve" it from outside. | Owner ask #3 verbatim: "same concept as the SAP job sheet just better in every way" — for the STRUCTURE tool. SAP-2's artifact system is watermark-governed; touching it from this plan would fork R2a. |
| PD-6 | **F-phases serialize against T3.** F0–F3 are written against today's `woodframe-scene.ts` + `Member[]` and are safe parallel to T0–T2 (engine-only, no UI). **Never run an F phase and T3 concurrently.** If T3 has landed first, each F phase's "post-T3 variant" note applies (file targets shift into the `src/ui/woodframe/` module tree; behavior identical). F6 is the explicit post-T3 integration phase. | T3 rewrites the woodframe shell; concurrent edits to the same boot file would collide. The rule is one sentence and removes the whole merge-risk class. |
| PD-7 | **Card art is runtime deterministic SVG, never image assets, never a second renderer.** Per-member/per-stage line art from a tiny orthographic projector (`src/training/cardart.ts`), same policy class as TIMBER-2's TD11 thumbnails. Live 3D appears in training only via the EXISTING studio scene (identify-in-scene mode). | Zero deploy-weight growth, deterministic goldens, no OOM-class build steps, works on low-end phones. |
| PD-8 | **Progress data is local-only and disposable.** localStorage keys `timber2-train` and `sap2-train-v1` (versioned envelopes, boot revalidation, the "never trust stored bytes" pattern). These exact key strings are BINDING across the companion training design docs — where a companion draft names a variant (`timber2-training`, `sap2.train.v1`), these govern. Never inside SAP-2 fill files (those are custody artifacts). No accounts, no telemetry, no sync — restated as an invariant with a kill-word rule (§5). | Owner's constraint; also the anti-LMS fence. |
| PD-9 | **Mobile work starts at F0 on TODAY'S viewer** (stacked layout, on-demand render, touch targets) and becomes part of the "pixel-equivalent baseline" T3 must preserve. TIMBER-2 §5.4 already specs workbench mobile; F0 covers the surfaces T3 doesn't reach until it lands. | The mandate says mobile SUPER-GOOD; waiting for T3 leaves the shipped app phone-hostile for the whole T0–T2 window. |
| PD-10 | **No service worker anywhere new.** TIMBER-2 TD16 binds: no SW for TIMBER/hub; `build-suite.mjs`'s cache-killer sw.js is policy; SAP-2 keeps its own scoped SW + update button. PWA "coherence" is therefore OUT by decision, documented, not pending. | TD16 is binding; re-litigating it here would fork the plan. |

---

## 1. ARCHITECTURE

### 1.1 Where the code lives (final layout)

```
src/training/                       # TIMBER trainer engine — PURE (no DOM, no three.js)
  cards.ts                          #   cardsFromModel(members, stagePlan, labels) → TrainingCard[]
  cardart.ts                        #   memberArtSvg(members, targetId, opts) → string (deterministic)
  scheduler.ts                      #   Leitner-lite: dueCards(state, now, seed) / grade(state, id, ok)
  store.ts                          #   versioned envelope codec for localStorage 'timber2-train'
                                    #   (storage injected — node-testable, same as sap2 store discipline)
src/timber/packet.ts                # PacketModel = pure projection of (model, bomSummary, PacketOptions)
src/ui/woodframe/                   # created EARLY by F-phases; matches TIMBER-2's final tree exactly
  labels.ts                         #   PLAIN/WHAT moved out of woodframe-scene.ts (F1) — the exact
                                    #   file TIMBER-2 §3.6 expects; scene imports it from then on
  train/deck.ts                     #   flip-deck UI (overlay), touch-first
  train/identify.ts                 #   identify-in-scene mode (F2) — drives the EXISTING scene
  print/packet.ts                   #   packet print surface (F3); T3's print.ts family absorbs it (F6)

sap2/src/train/                     # F4 only, AFTER R2a ships the Build Card deck
  cards.ts                          #   cardsFromDeck(result, deck) → TrainingCard[]  (Result-only imports)
  scheduler.ts / store.ts           #   thin re-implementations of the Trainer Core spec
sap2/src/ui/train.ts                #   deck UI inside the SAP-2 shell
```

**Build-suite implications: none.** Everything above is imported from existing entry
HTML (`woodframe.html`, `sap2/index.html`); `vite.suite.config.ts`, `vite.sap2.config.ts`,
and `scripts/build-suite.mjs` are not edited by any F phase. `check-offline` and (post-T0)
`check-assets` stay green by construction — no new asset files exist.

**Why not a shared module — the full argument (PD-1).** The root suite build compiles
`sap2/src` with the ROOT toolchain (`vite.sap2.config.ts`), so a cross-tree import would
*build*. It would still be wrong: (a) sap2's own dev/test toolchain (`sap2/package.json`,
own tsconfig, own `node --test` run) does not see root files — its CI would need rootDir
surgery; (b) sap2's source gates (g2-number-free, g9-source-lints, g3-offline) scan
`sap2/src/**` — shared trainer code carrying TIMBER doctrine strings ("2-16d toenail",
"FM 5-426 p.6-17") would need allowlisting inside SAP-2's liability perimeter, which is
exactly the leak class both regimes exist to prevent; (c) the shared surface is one
interface + ~80 lines of scheduler + a storage envelope. Two thin copies, one spec, one
vector table, two contract tests. Recorded as the governing trade.

### 1.2 Routing & entries

| Surface | Pre-T3 | Post-T3 (F6) |
|---|---|---|
| TIMBER entry | Toolbar chip **TRAIN** in `woodframe.html`; boot checks `location.hash === '#train'` and opens the deck overlay (deep-linkable). `#train` (no slash) deliberately cannot collide with T3's `#/`-grammar router. | Router route `#/train` (deck picker: Full deck / This stage / Identify-in-scene) and `#/train/<deckId>`; `#train` 301-redirects to `#/train`. Picker gets a "Training" row card; workbench toolbar keeps the TRAIN chip scoped to the CURRENT structure's deck. |
| SAP-2 entry | none (F4 is gated on R2a) | Shell nav link "Train" → `sap2/src/ui/train.ts` surface. NOT a fourth presentation mode of the planner (modes are Result-presentation; training is a separate surface with its own regime gate). No LEADER-guard interaction. |
| Hub | unchanged until F5 | F5 adds one static **Training** card: links `./woodframe.html#train` (later `#/train`) and, once F4 ships, `./survivability/#train`. The ghost card stays. |
| Packet entry | `woodframe.html` toolbar button **COMMAND PACKET** → print view (F3) | Workbench header button on every family; rendering merged into the T3 `print.ts` family (F6). |

### 1.3 The Trainer Core spec (the thing both apps implement)

Binding shapes — identical field names in both trees; behavior pinned by the vector
table (§6.4) that each tree's contract test reproduces:

```ts
export interface CardFace {
  text: string;                       // plain-register; SAP-2 copy passes its word-allowlist gate
  art?: { kind: 'svg'; svg: string }  // runtime-generated, deterministic; never a file asset
     | { kind: 'scene'; sceneRef: string };  // identify-in-scene only: a descriptor key, not a mesh
}
export type CardKind = 'identify' | 'function' | 'sequence' | 'number' | 'check';
export type CardRegime = 'qualitative' | 'doctrine-num' | 'training-fict';
export interface TrainingCard {
  id: string;                         // stable + app-prefixed: 'tb:role:cripple', 'tb:nail:stud', 'sp:stage:3'
  kind: CardKind;
  front: CardFace; back: CardFace;
  sourceRef: string;                  // memberId | role | stageKey | leafId — provenance to the descriptor
  regime: CardRegime;
  doctrineRef?: string;               // REQUIRED when regime !== 'qualitative' in TIMBER (test-asserted)
}
// Scheduler: 5 Leitner boxes. New card → box 1. Correct → +1 (max 5); wrong → box 1.
// Due = box-interval days {1:0, 2:1, 3:3, 4:7, 5:21} since lastSeen (clock injected).
// Session order = seeded shuffle (mulberry32(sessionSeed)) of due cards sorted (box asc, lastSeen asc, id asc)
// BEFORE shuffling within box groups; sessionSeed persisted so resume shows the same order.
export interface TrainState {
  v: 1;
  cards: Record<string, { box: 1|2|3|4|5; lastSeen: number; seen: number; lapses: number }>;
  sessionSeed: number;
  counters: { flips: number; sessions: number };   // the whole "stats" feature — nothing more
}
```

Rules with teeth:
- **Deck derivation is generative, never authored** (mirrors SAP-2's "deck composition
  is generative" rule): decks are pure functions of the descriptor. New TIMBER roles/
  families get cards automatically because TIMBER-2's I-14 lockstep invariant already
  forces PLAIN/WHAT lines for every emitted role. Nobody ever hand-writes a card bank.
- **Unknown card ids in stored state are dropped silently at load** (models change;
  progress is disposable by design). Envelope version mismatch ⇒ fresh state + notice.
- **Determinism:** same model + same seed + same event sequence ⇒ identical deck order
  and state (contract-tested in both trees against the §6.4 vectors).

### 1.4 Data flow & the regime wall (per app)

**TIMBER** — `cardsFromModel(members, stagePlan, labels)` emits, today:
- `identify` per role present: front = card art (target member highlighted in context,
  neighbors ghosted) + "What is the highlighted piece?"; back = PLAIN name + WHAT line. Qualitative.
- `function` per role: front = PLAIN name; back = WHAT + nailing + doctrineRef. The
  nailing string and any dimension are `doctrine-num` — the cite renders as a small chip,
  and the deck's first card explains "(PH) = manual page check pending" (same footnote
  language as the T3 picker).
- `sequence` per stage boundary: front = "What follows: Sills & girders?"; back = next
  stage name + its one-line detail. Qualitative.
- `number` per (role × nominal): front = "Stud stock in this build?"; back = "2x4
  (actual 1 1/2 × 3 1/2 in) — FM 5-426 Table 2-1 (PH)". `doctrine-num`, cite mandatory.
Sources are ONLY `Member` fields + `STAGES`/`StagePlanEntry` + labels — a node test
imports `cards.ts` and asserts its module graph reaches no generator, no DOM, no three.js
(same lint shape as I-1).

**SAP-2 (F4)** — `cardsFromDeck(result, deck)`:
- identity/sequence/check-phrase cards from registry plain names, stage verb lines, and
  check sentences (digit-free by SAP-2's own construction — the number-word ban).
- `number` (magnitude-recall) cards are emitted ONLY when
  `result.fillIdentity?.cls === 'TRAINING'`; their values render through the same
  formatting path the deck uses, so the inline `FICT` suffix is inherited, not re-implemented.
  DOCTRINE ⇒ the emitter returns zero `number` cards (visible line in the deck header:
  "magnitude drill: TRAINING fills only"). TEMPLATE ⇒ token faces (`⟨depth⟩`), matching §2.7.
- Trainer surfaces call the existing `artifactPolicy(watermarkState)` before any print
  or export: floor TRAINING, never a bare export, watermark band rules intact. The
  trainer never adds an export path.
- Gate extensions (F4, in sap2's own tree): g2-number-free and g9-source-lints scan
  `sap2/src/train/**`; new lint "train imports Result/deck/registry only"; a fixture test
  asserts a DOCTRINE-class fill yields zero magnitude cards.

**The comprehension-protocol boundary:** SAP-2's human protocol (§3.8) governs Build
Cards. The trainer is a self-study veneer and claims no protocol coverage; its copy
passes the word-allowlist gate and that is the whole claim. Stated in the F4 acceptance
so nobody inflates it.

### 1.5 The Command Packet (owner ask #3) — concrete contract

```ts
// src/timber/packet.ts — pure, deterministic, node-tested. NEVER re-measures geometry:
// every number is an aggregation of the same Member[]/BomSummary the scene draws (bom.ts discipline).
export interface PacketOptions {
  title: string;                    // "Guard shack, ECP North" — operator text
  preparedFor?: string; preparedBy?: string;   // attested text lines, like SAP-2: attested, not authenticated
  crewSize: number;                 // arithmetic divisor only
  shiftHours?: number;              // default 8 — arithmetic only
  stockLengthsFt?: number[];        // default [8,10,12,14,16] — procurement fit set
}
export interface StockLine { nominal: string; stockFt: number; pieces: number; cutsServed: number; wasteLF: number }
export interface PacketModel {
  header: { title: string; specSummary: string[];        // "20×16 ft · 8 ft walls · gable 4:12 · piers"
            phCensus: { cited: number; ph: number };     // honesty line: "(PH) pending on n of m cites"
            disclaimers: string[] };                     // fixed sentences, incl. the hub footer's occupied-structures line
  materials: { byNominal: { nominal: string; pieces: number; totalLF: number; boardFeet: number }[];
               stockFit: StockLine[];                    // first-fit-decreasing over stockLengthsFt —
                                                         // pure arithmetic, labeled "procurement estimate,
                                                         // no waste factor applied" (no new doctrine number)
               panels: number; concreteLF: number; hardwareNote?: string };
  labor: { byStage: { stage: number; label: string; manHours: number; crewHours: number }[];
           totalManHours: number; totalCrewHours: number; crewSize: number;
           assumptions: string[] };                      // names MH_PER_BF etc. as "(PH) rates" verbatim
  schedule: { byStage: { label: string; days: number }[]; totalDays: number };  // serial, crewHours/shiftHours — arithmetic
  cutSchedule: { stage: number; label: string; lines: CutLine[] }[];            // reuses bom.ts CutLine
  strips: WallId[];                                       // which layout strips to render
}
export function buildPacket(members: Member[], bom: BomSummary, plan: StagePlanEntryLike[], opts: PacketOptions): PacketModel;
```

- Written against `StagePlanEntry`-shaped rows from day one, with a 10-line adapter from
  legacy `STAGES` — so when `StructureModel.stagePlan` exists (T1+) the packet consumes
  it unchanged, for every family, forever. This is the "better than the SAP job sheet"
  growth path: at T3 it covers custom structures, at T5 huts, at T8 it inherits nail
  poundage/hardware sections and the TM 5-303 reconciliation credibility — all without
  packet code changes beyond rendering the extra BOM sections.
- Man-hours stay visibly "(PH)" until TIMBER-2 T8's P-405/TM 5-303 verification pass —
  the packet prints the same honesty note the stage panel shows today. No new labor
  doctrine is invented here (that is T8's LABOR row, not ours).
- Print surface `src/ui/woodframe/print/packet.ts`: one print-CSS page flow — cover /
  materials / labor+schedule / per-stage cut schedule / wall strips (strips scaled per
  TIMBER-2 §5.6's `width:100%; height:auto` viewBox rule). Phone-readable in-app view =
  the same DOM without `@media print`.

---

## 2. MOBILE ENGINEERING (named work items)

Ground truth: `woodframe.html` has the viewport meta but a desktop flex layout — the
aside is `width:340px; max-width:45vw` (≈175 px on a 390 px phone: unusable); the canvas
captures one-finger drags (OrbitControls), so the page can trap scroll; the rAF loop
renders continuously (battery); chips are 30 px tall. SAP-2's `.narrow` grid
(`grid-template-areas` swap at one class toggle) is the proven in-repo pattern. TIMBER-2
§5.4 already specs workbench mobile from T3 — the items below cover today's viewer, the
trainer, and the packet, and everything F0 ships becomes part of the baseline T3 ports.

| Id | Work item | Detail | Phase |
|---|---|---|---|
| M-1 | **Stacked narrow layout** for `woodframe.html` | Adopt the SAP-2 `.narrow` pattern: `matchMedia('(max-width: 699px)')` toggles a root class; main becomes single column — toolbar (wrapping), viewport, aside full-width, strips. Breakpoint 700 px to match TIMBER-2 §5.4. | F0 |
| M-2 | **Viewport height clamp + scroll escape** | In narrow mode the canvas height is `min(58vh, innerHeight − chrome)` so page chrome is always reachable past the canvas; the canvas never fills the screen. `touch-action: none` ONLY on the canvas element; everything else scrolls natively. | F0 |
| M-3 | **On-demand rendering** | Replace the unconditional rAF loop: render on OrbitControls `change`, after `regenerate()`/`setStage()`, and while damping settles; idle otherwise; pause fully when `document.hidden` or the trainer overlay covers the canvas. Single biggest battery/thermal win on phones; zero visual change. | F0 |
| M-4 | **Coarse-pointer hit targets** | `@media (pointer: coarse)`: chips/buttons min-height 44 px (padding, not font); stage chips get wider tap zones; layout-strip marks get invisible 24 px hit rects (`<rect fill="transparent">` around each mark group). | F0 |
| M-5 | **Touch pick tolerance** | Raycast pick uses a 12 px NDC-radius fallback (nearest member within tolerance) on coarse pointers — finger-sized studs are currently miss-prone. Pure function, node-testable on projected AABBs. | F2 |
| M-6 | **Trainer touch UX** | Flip = tap anywhere on card; grading = two fixed bottom buttons ("AGAIN" / "GOT IT") ≥ 64 px (SAP-2 glove floor), thumb-reachable; NO swipe gestures and NO press-hold in core (press-hold is SAP-2 build-card semantics — don't overload it; swipe is the flakiness class §5 R2 kills). `aria-live="polite"` flip announcement; `prefers-reduced-motion` drops the flip animation. | F1 |
| M-7 | **3D perf budget for training surfaces** | Identify-in-scene REUSES the existing scene/renderer (never a second WebGL context). Card art is SVG (PD-7), so the deck itself costs no GPU. Budgets inherited from TIMBER-2 §4.1 (stage change ≤ 16 ms; rebuild ≤ 300 ms reference Android; mesh ≤ 2500) — F2 adds no meshes, only highlight material swaps. | F1/F2 |
| M-8 | **Packet on phone** | Packet view is single-column HTML; tables wrap in `overflow-x:auto` containers; print CSS (`@page` margins, `break-inside: avoid` on table blocks, strips scaled). "Print / Save as PDF" uses the browser dialog — no PDF library (zero-dep rule). | F3 |
| M-9 | **Reference-device pass** | Named manual pass on a low-end Android (the same reference device T3 names) at F0, F2, and F3; results recorded in `DECISIONS.md` (`TRAIN Fn:` prefix) — mirrors TIMBER-2's T3 device-pass ritual. | F0/F2/F3 |
| M-10 | **No-SW/PWA posture restated** | Nothing to build: TD16 binds (no SW for hub/TIMBER); SAP-2 keeps its scoped SW. The trainer works offline because the suite does. | — |

What F0 does NOT do: it does not touch the (T3-planned) sheets/detents/cutaway-slider
mobile work — that is TIMBER-2 §5.4's scope and arrives with the workbench. F0's CSS and
boot changes are deliberately confined to `woodframe.html` styles + ~40 lines of
`woodframe-scene.ts` so the T3 port cost is one checklist line ("preserve F0 narrow
mode + on-demand render"), recorded in DECISIONS.md at F0 merge.

---

## 3. PHASE PLAN F0–F7 (composes with T0–T8 and R-phases)

Effort scale = TIMBER-2's (S ≤ half session, M ≈ 1 session, L = 2–3). Every phase ends
deploy-green (`npm run verify` + `npm run build:suite`), is independently shippable, and
has acceptance a fresh session can verify without the planner. Branch discipline,
descope ladders, and the red-main rule are inherited verbatim from TIMBER-2 §7/§10.2.

**Dependency map (exact):**

```
F0 ─ none (safe parallel with T0–T2; touches only woodframe.html/scene + a size script)
F1 ─ none on T-phases (builds on TODAY'S Member[] + STAGES); creates labels.ts EARLY
     (the exact file TIMBER-2 §3.6 expects — T3 inherits it instead of creating it)
F2 ─ needs F1; CORE needs no T-phase (uses today's views + member-AABB camera fit);
     interior/cutaway questions are F6 (need T3 cutaway + camera rigs)
F3 ─ needs F1's labels extraction only; consumes StagePlanEntry-shaped rows via adapter
     (T1's real stagePlan drops in unchanged); packet VALUE grows at T3 (custom
     structures) and T8 (hardware/nails, TM 5-303 credibility) with no packet rework
F4 ─ HARD-GATED on SAP-2 R2a (Build Card deck + computeStages exist). Independent of F5/F6.
F5 ─ needs F1 (something to link to); hub card + paper deck + a11y pass
F6 ─ needs T3 merged (router, cutaway, camera rigs, print.ts); folds F-surfaces into the module tree
F7 ─ (LATER bucket) needs T8 for verified labor rates; packet v2 polish
Serialization rule PD-6: F0–F3, F5 never run concurrently with T3 work.
Recommended order: F0 → F1 → F2 → F3 → F5, interleaving T0–T2 freely; T3–T8 next; F6 after T3;
F4 whenever R2a lands.
```

### F0 — Phones stop hurting (S–M)

**Contents:** M-1 stacked layout, M-2 height clamp, M-3 on-demand render, M-4 hit
targets; record the deploy-size baseline: `scripts/check-size.mjs` (dist total bytes +
per-entry JS bytes, budgets = baseline + 15 % headroom, constants committed in the
script; runnable standalone, wired into `build:suite`'s tail as a step, and into
`.github/workflows/toolkit.yml` when T0 creates it).
**Files:** `src/ui/woodframe.html` (CSS + one class hook), `src/ui/woodframe-scene.ts`
(~40 lines: matchMedia, render-on-demand, resize), `scripts/check-size.mjs`,
`package.json` (one script line).
**Tests:** `test/train-mobile.test.ts` — pure functions only (narrow-mode class decision
from width, render-scheduler state machine: dirty-flag semantics, hidden-tab pause).
No happy-dom needed yet.
**Acceptance (fresh session):** `npm run verify` green; `npm run build:suite` green and
`node scripts/check-size.mjs` passes; open dev server at 390 px width — layout is single
column, page scrolls past the canvas, chips ≥ 44 px in DevTools mobile emulation;
DECISIONS.md records the M-9 device pass + the "T3 preserves F0" note.
**Demo the owner feels:** the deployed toolkit on their actual phone — orbit with a
thumb, scroll the page like a page, tap a stud, read its card. No pinch-fighting.
**Descope ladder:** M-4 hit-rects on strips → F2; M-1/M-2/M-3 are the phase.

### F1 — TIMBER flashcards v0 (M)

**Contents:** `src/ui/woodframe/labels.ts` (PLAIN/WHAT extracted from
`woodframe-scene.ts`, which now imports it — additive, T3-ready); `src/training/`
(cards.ts, cardart.ts, scheduler.ts, store.ts per §1.3–1.4); `src/ui/woodframe/train/deck.ts`
overlay (full-screen, mobile-first per M-6, Esc/back closes; opening pushes a history
state so Android back dismisses the deck, not the page — the TIMBER-2 §5.1 pattern);
toolbar TRAIN chip + `#train` boot hash; deck header note explaining (PH); glossary
sub-view (all PLAIN/WHAT as one printable reference list — a free projection of labels).
**Regime:** per PD-4/§1.4 — every non-qualitative card carries `doctrineRef`, test-asserted.
**Tests:** `test/train-cards.test.ts` (derivation determinism; every role in the demo
model yields identify+function cards; every `doctrine-num` card has a non-empty
doctrineRef; import-boundary: module graph of `src/training/**` contains no DOM/three/
generator imports), `test/train-scheduler.test.ts` (the §6.4 vector table),
`test/train-store.test.ts` (envelope round-trip, unknown-card drop, version-mismatch
reset — storage injected), `test/train-cardart.test.ts` (SVG string goldens, committed
files under `test/goldens/trainart/`, structural asserts: no `http`, no `<script`,
polygon budget — the TD11 golden pattern).
**Acceptance:** verify + build:suite green; legacy `test/timber-*.test.ts` git-diff
empty; open `/woodframe.html#train` → deck renders ≥ 40 cards for the demo building;
flip/grade cycle persists across a reload; toggling the Foundation option to "basement"
then reopening the deck adds the stair/stringer/tread cards (generative proof); offline
scan green; no new dist assets.
**Demo:** on the phone: tap TRAIN, see a highlighted mystery member, guess, flip, grade
— then flip the model to basement mode and watch the deck grow stair cards by itself.
**Descope ladder:** glossary view → F5; `number` cards → F2; identify+function+sequence
cards and persistence are the phase.

### F2 — Identify-in-scene + stage drills (M)

**Contents:** `src/ui/woodframe/train/identify.ts`: "Find the ⟨king stud⟩" — prompt
banner over the LIVE scene; correct tap = green flash + streak counter; wrong tap =
names what you hit, then highlights the answer (teaching, not punishing). Uses the
existing raycaster + M-5 pick tolerance; camera assist = simple fit-to-member-AABB
tween using TODAY'S camera (no T3 rig dependency — rigs upgrade it in F6). Stage-order
drill: "put the stages in build order" as tap-to-place chips (no drag — M-6/flakiness
rule). Question pool = roles present at the current stage scrub, so the stage scrubber
becomes a difficulty dial for free. Adds `number` cards to the F1 deck (nailing/nominal
per role, cites shown).
**Tests:** `test/train-identify.test.ts` (pure: question generation excludes roles with
zero visible members at the scrubbed stage; pick-tolerance math on projected AABBs;
answer validation by memberId→role), scheduler/store untouched.
**Acceptance:** verify + build:suite green; device pass (M-9) recorded: identify round
playable one-handed on the reference Android at acceptable frame rate (if not →
descope: identify falls back to the 2D layout-strip variant, marks are already
tappable; 3D variant flagged desktop-only in DECISIONS.md — this is the R1 kill line).
**Demo:** "find the collar tie" — spin the roof, tap it, streak of 5; then order the
11 stages from memory.
**Descope ladder:** stage-order drill → F5; camera assist tween → cut (static prompt
still works); identify-in-scene is the phase.

### F3 — Command Packet v1 (L) — owner ask #3

**Contents:** `src/timber/packet.ts` per §1.5 (+ `StagePlanEntry` adapter from legacy
`STAGES`); `src/ui/woodframe/print/packet.ts` print surface; toolbar COMMAND PACKET
button opening the packet view with an options row (title, crew size, shift hours —
commit-on-valid inputs); stock-length first-fit-decreasing (pure, deterministic,
labeled "procurement estimate — no waste factor applied").
**Explicitly NOT in v1:** waste factors (a new doctrine number — needs a cite, parked
to F7 with the T8 labor-verification row), 3D stage captures (arrive with T3's
print.ts, folded in at F6), any SAP-2-side packet change (PD-5).
**Tests:** `test/packet.test.ts` — projection fidelity (packet totals ≡ bomSummary
totals to the cent of a board-foot; crewHours = manHours/crewSize; schedule days =
crewHours/shiftHours rounded up per stage; stock fit conserves every cut and wasteLF =
purchased − used exactly), determinism (deep-equal across calls), StagePlan adapter
(legacy STAGES → same rows), header honesty ((PH) census = count of "(PH)" in member
doctrineRefs; disclaimer sentences present verbatim). Print surface: structural DOM
assertions if the happy-dom rig exists by then, else a pure "render to HTML string"
test on the template functions (decide by whether T3 has landed; both named here so
the implementer doesn't invent a third).
**Acceptance:** verify + build:suite + check-size green; open packet for the demo
building: cover states 20×16 gable on piers, materials table matches the BOM screen
numbers exactly, labor shows "(PH) rates" note, browser print preview paginates with
no clipped tables in Chrome AND Firefox (manual checklist row, recorded); phone view
scrolls cleanly (M-8).
**Demo:** the owner prints a 4-page packet for the demo building and hands it across a
desk: "materials, man-hours at crew of 4, build order, cut schedule, wall layouts."
The SAP job-sheet concept, for structures — and every future T-phase family inherits it.
**Descope ladder:** stock-length fit → F7; schedule block → F7; materials + labor +
cut schedule + strips are the phase.

### F4 — SAP-2 trainer (M) — GATED: starts only after R2a merges

**Contents:** `sap2/src/train/{cards,scheduler,store}.ts` + `sap2/src/ui/train.ts` per
§1.4; shell nav entry; gate extensions (g2/g9 scan `train/`, Result-only import lint,
DOCTRINE-⇒-zero-magnitude-cards fixture); deck kinds: stage-sequence (verb lines),
identity (registry plain names), check-phrase recall (digit-free by construction),
magnitude drill (TRAINING class only, FICT inherited).
**Tests (sap2 tree):** `sap2/test/train-cards.test.ts` (class gating matrix: TEMPLATE
→ token faces; TRAINING → FICT present in every magnitude face — string-asserted;
DOCTRINE → magnitude kind absent), scheduler/store contract tests against the same
§6.4 vectors, gate-suite growth green.
**Acceptance:** `sap2 npm run verify` green (its own toolchain), root `build:suite`
green; artifactPolicy floor respected (no new export path exists — grep-asserted);
demo with the TRAINING fixture fill shows FICT on every numeral.
**Demo:** flip "how deep is the fighting position?" and the answer says `4.5 ft FICT`
in purple TRAINING dress — then load a DOCTRINE fill and watch the magnitude deck
honestly disappear.
**Descope ladder:** magnitude drill → later release (identity/sequence/check decks
alone are still the phase); nothing else cuttable.

### F5 — Training front door + paper deck + a11y (S–M)

**Contents:** hub Training card (PD-3; links per what's live); TIMBER paper flashcards:
print view of the deck 2-up landscape, fronts then backs (duplex long-edge = card backs
align), blank-back tolerant, gallon-bag-friendly — the SAP-2 §3.7 packet spec's print
wisdom applied, no SW, no export machinery; glossary view (from F1 ladder); a11y pass
on trainer surfaces (focus order, visible focus, aria-live flip, contrast ≥ 4.5:1 on
card text, reduced-motion, keyboard: space=flip, 1/2=grade — guarded by the TIMBER-2
§5.3 keyboard-guard rule); stage-order drill if descoped from F2.
**Tests:** extend `train-cards`/`print` tests with paper-deck pagination math (cards
per page, front/back index alignment — pure function).
**Acceptance:** hub shows the card; printed paper deck's card N front and back land on
the same physical card in duplex (manual checklist, recorded); keyboard-only session
possible; verify + build:suite green.
**Demo:** print, cut, fold, ziploc — a pocket deck for the truck. Hub has a third door.

### F6 — Post-T3 integration (M) — starts only after T3 merges

**Contents:** `#/train` routes into the T3 router (`#train` redirect); trainer deck
per-structure in the workbench (deck of the CURRENTLY CONFIGURED StructureModel — the
generative derivation makes this free); identify-in-scene upgrades: T3 camera rigs for
question framing + cutaway-powered interior questions ("find the girder" with the
building sectioned — `passesCut` filters the question pool exactly like it filters
picking); packet button on every family's workbench header; packet rendering folded
into the `print.ts` family incl. 3D stage captures (§5.6's 960×640 capture pattern);
per-family deck growth check (T5+ roles appear with PLAIN/WHAT via I-14 — assert on
whatever families exist at integration time).
**Tests:** route tests in the T3 happy-dom smoke suite (train route renders, redirect
works); identify pool respects `passesCut`; packet-in-print.ts golden for one family.
**Acceptance:** every live picker family has a working deck + packet button; cutaway
question demo on gp-frame; verify + build:suite green; TIMBER-2's own suites untouched.
**Demo:** configure a custom shed, hit TRAIN — a deck of YOUR structure; hit COMMAND
PACKET — the paperwork of YOUR structure. The loop the owner asked for, closed.

### F7 — LATER bucket (only if pulled by the owner)

Packet v2: waste factors WITH cites (needs T8's labor/BOM verification posture),
crew-mix table (riggers/sawyers splits — needs a doctrine source), hardware/nail
sections (automatic once T8 lands), TM 5-303 side-by-side credibility page; trainer
import/export of progress file; night-mode trainer skin (after SAP-2 R6b proves the
token set). Each item enters as its own S/M phase with this document's invariants.

---

## 4. IMPROVEMENTS BACKLOG (owner ask #4) — ranked, honest

Verdicts: **IN(Fn)** = in this plan's phases · **LATER** = designed-for, not scheduled ·
**OUT** = rejected with reason. Value = owner-felt value for the stated missions.

| Rank | Idea | Value | Cost | Depends | Verdict + honesty |
|---|---|---|---|---|---|
| 1 | Mobile baseline (stacked layout, on-demand render, targets) | H | S–M | none | **IN(F0)** — the mandate says super-good on phones; this is the floor, not a feature. |
| 2 | Flashcard trainer, TIMBER (flip decks, generative) | H | M | none | **IN(F1)** — owner ask #1 verbatim. |
| 3 | Command packet (materials/man-hours/schedule/cuts/strips) | H | L | F1 | **IN(F3)** — owner ask #3 verbatim; grows with T-phases for free. |
| 4 | Identify-in-scene + stage drills | H | M | F1 | **IN(F2)** — the "best ways to train" winner: uses the 3D asset nothing else has; cheap because pick/scene exist. |
| 5 | Paper flashcard deck (2-up duplex print) | M–H | S | F1 | **IN(F5)** — field training happens away from screens; print CSS only. |
| 6 | SAP-2 trainer over Build Cards (FICT regime) | M–H | M | R2a | **IN(F4, gated)** — high value but hard-gated; building it before R2a would fork the deck. |
| 7 | Glossary / nomenclature sheet (printable PLAIN/WHAT) | M | S | F1 | **IN(F1/F5)** — a free projection; disproportionate value for recruits. |
| 8 | Accessibility pass (trainer scope) | M | S–M | F1 | **IN(F5)** scoped; full toolkit audit **LATER** — do it once the T3 UI exists, not twice. |
| 9 | Stock-length procurement fit in packet | M | S | F3 | **IN(F3)** — pure arithmetic, turns a cut list into a purchase list; labeled estimate. |
| 10 | Deploy size budget gate | M | S | none | **IN(F0)** — the OOM scar + "stay lean" mandate deserve a number, not a vibe. |
| 11 | Progress import/export file | L–M | S | F1 | **LATER** — progress is disposable by design; revisit if owners report loss pain. |
| 12 | Night mode toolkit-wide | M | M | SAP-2 R6b tokens | **LATER** — SAP-2 R6b owns night first; TIMBER copies the proven token set after. Doing it now = two divergent dark themes. |
| 13 | Metric toggle everywhere | L | M | none | **LATER** — FM 5-426 carpentry is inch-native (dressed sizes, 16 in o.c.); display-only conversion adds rounding-drift risk into cut lists for near-zero USMC value. Revisit only on a real user ask. |
| 14 | Hub global search (roles, families, cards) | L–M | M | T3 catalog | **LATER** — worthless until the 14-family catalog + decks exist; cheap after (search over FamilyDef + labels). |
| 15 | Performance diagnostics page (fps/mesh counts) | L | S | none | **LATER** — dev aid, not owner value; budgets in tests already cover the honest need. |
| 16 | Saved-projects library beyond T3's store | L | M | T3 | **OUT** — duplicate: TIMBER-2 §5.5 (timber2-session, Your-Builds, .timber.json) IS the library. Anything more is a second store to keep coherent. |
| 17 | Per-app PWA coherence / install banners | L | M | — | **OUT** — TD16 binds (no SW for hub/TIMBER); SAP-2's SW is scoped policy. "Coherence" here means deleting a deliberate asymmetry. Documented, closed. |
| 18 | Session share / shared decks / leaderboards | L | M–L | — | **OUT** — progress is private-by-design; any share path invites the telemetry/LMS creep the invariants ban. |
| 19 | i18n | L | XL | — | **OUT** — audience is USMC English; translated doctrine strings are a new liability surface (who verifies the Spanish nailing schedule?). |
| 20 | Audio pronunciations / videos / photo library | L | L+weight | — | **OUT** — asset weight against the lean mandate; runtime SVG + 3D already out-teach stock photos. |
| 21 | Spaced-repetition sophistication (SM-2, FSRS) | L | M | F1 | **OUT** — Leitner-lite is deterministic, testable, and sufficient for a ~100-card domain; algorithm tourism is pet-feature territory. |
| 22 | Embedded doctrine page excerpts (scanned pages) | L | L | — | **OUT** — distribution/custody questions + megabytes; the cite discipline exists precisely so the user opens the real pub. |
| 23 | Quiz-content authoring UI | L | L | — | **OUT** — decks are generative (§1.3); an authoring surface reintroduces the hand-written content the design eliminates. |

No pet features: every IN row traces to an owner mandate (#1 flashcards, #2 training
breadth, #3 packet) or to a non-negotiable (mobile, lean deploy).

---

## 5. RISKS — top 10, with detection, mitigation, kill criteria

| # | Risk | Detection | Mitigation | Kill / fallback |
|---|---|---|---|---|
| R1 | **Mobile 3D perf** — identify-in-scene janks on low-end Android | M-9 device passes (F0/F2); TIMBER-2 mesh/stage budgets in tests | Reuse the one scene; SVG card art (no GPU cost in decks); on-demand render (F0) | If < acceptable on the reference device: identify falls back to the 2D layout-strip variant (marks already tappable); 3D identify flagged desktop-only. Recorded, not silent. |
| R2 | **Gesture/test flakiness** — swipe/drag/press-hold misfire in tests and gloves | flaky CI on UI suites; device pass | Core uses taps + fixed buttons ONLY (M-6); drills are tap-to-place, not drag; no gesture is ever an acceptance criterion | Any gesture that flakes twice is deleted in favor of its button equivalent — buttons are the spec, gestures are sugar. |
| R3 | **Regime leak through quiz content** — SAP-2 magnitudes memorizable from DOCTRINE fills; TIMBER numbers without cites; FICT stripped by a card layout | sap2 fixture test (DOCTRINE ⇒ zero magnitude cards); g2 extended over `train/`; TIMBER test: every `doctrine-num` card has doctrineRef; FICT string-assert on TRAINING faces | PD-4 regime field is structural: magnitude emission is class-gated at derivation, formatting reuses the FICT-carrying path; no authored numerals anywhere (both apps' number-free gates cover trainer sources) | Any leak found in review ⇒ magnitude card kinds are pulled toolkit-wide until the gate that would have caught it exists. Non-negotiable. |
| R4 | **Packet print fidelity across browsers** — clipped tables, broken pagination, strip overflow | F3 manual print checklist (Chrome + Firefox, recorded); structural print assertions | Single-column print flow; `break-inside: avoid`; strips scaled per §5.6; no exotic CSS in print styles | If a browser cannot paginate acceptably: ship "open print view" as a plain static page and stop chasing engines. Never a PDF dependency. |
| R5 | **Scope creep into LMS territory** — scores, records-of-training, certification, rosters | backlog review vs the OUT list; kill-words in any request: account, roster, certify, transcript, sync | PD-8 invariant (local-only, disposable); OUT rows 16/18 pre-decided | **K-F2:** the owner asking for training RECORDS is a regime conversation (custody, attestation — SAP-2-commissioning-shaped), not an F phase. Stop and surface it. |
| R6 | **Deploy weight / build memory growth** — the OOM class returns | `scripts/check-size.mjs` (F0) in build:suite + CI; check-assets (T0) allowlist; assetsInlineLimit invariant | Zero image assets (PD-7); zero deps; trainer+packet are ~30–50 KB source total | Budget exceeded ⇒ cut card-art richness before function; raising the budget requires a DECISIONS.md entry with the measured cause. |
| R7 | **F/T merge collisions** — F phases and T3 rewrite the same shell | PD-6 rule; phase start ritual checks main for in-flight T3 branch | F0–F2 touch ≤ 40 scene lines + create only files T3 expects (labels.ts) or doesn't name (train/, print/packet.ts); F6 is the sanctioned integration point | T3 in flight ⇒ F phases pause (T3 is L; the wait is bounded). Never rebase trainer code through a half-ported shell. |
| R8 | **Content quality drift** — new roles with thin WHAT lines make bad cards; ambiguous answers (e.g. 'sill' means two things) | I-14 lockstep test forces PLAIN/WHAT existence; F-phase demo checklist includes "read 10 random cards aloud"; dedupe test asserts identify answers are unambiguous within a deck | Cards carry stage/context line ("in the floor system…") from StagePlanEntry; ambiguous roles get context-qualified fronts, derived not authored | A family whose cards read as garbage ships WITHOUT a deck (deck derivation takes a per-family opt-out list, default empty, each entry needing a DECISIONS.md line) — bad cards are worse than no cards. |
| R9 | **R2a slip strands SAP-2 training** | SAP-2 progress table | F4 is isolated and gated; hub card copy says only what exists; no speculative sap2 trainer code EVER lands before R2a | F4 simply waits. If R2a is re-planned, F4 re-derives from whatever deck contract replaces it — cards.ts is 1 file deep on that dependency by design. |
| R10 | **(PH) cite debt confuses learners** — cards say "pending page verification" and trust erodes | owner demo review at F1; (PH) census visible in packet header | Deck-start note + small cite chips (the T3 picker's footnote pattern); packet prints the census honestly; T8's census reduces it over time | If the owner judges (PH) noise unacceptable at F1 demo: cite chips collapse to a per-deck footer line (one CSS change); the DATA never loses its cite. |

Standing kill criteria (inherited + new): **K-F1** — any F change that would require
editing `test/timber-*.test.ts`, sap2 gates, or engine semantics: stop-the-line,
DECISIONS.md proposal (mirrors TIMBER-2 K2). **K-F2** — training records/certification
ask: regime conversation, not a phase (see R5). **K-F3** — any request to ship authored
doctrine content INSIDE quiz strings (bypassing Member/Result provenance): refuse;
that is the SAP-1 failure class both regimes were built to kill.

---

## 6. HANDOFF KIT

### 6.1 Commands (verbatim)

```bash
npm run verify                        # typecheck + node --test test/*.test.ts + check:offline
npm run build:suite                   # THE deploy build — green at every merge to main
node scripts/check-size.mjs           # (exists after F0) deploy budget gate
node --import tsx --test test/train-*.test.ts test/packet.test.ts   # focused F suites
npm run dev                           # open /woodframe.html  → TRAIN chip / #train hash
                                      # open /woodframe.html#train directly for the deck
cd sap2 && npm run verify             # F4 only — sap2's own pinned toolchain
node --import tsx --test test/timber-*.test.ts   # legacy suites: git-diff-empty rule
```

### 6.2 Invariants that never break (every F phase)

- **N-1 Descriptor-only consumption:** trainer/packet module graphs reach `Member[]`/
  `STAGES`/`StagePlanEntry`/labels (TIMBER) or `Result`/deck/registry (SAP-2) and
  NOTHING deeper — import-boundary tests in both trees.
- **N-2 Zero new runtime deps.** happy-dom as a root devDependency is sanctioned only
  if T3 hasn't already added it (TIMBER-2 names it for the smoke suite); nothing else.
- **N-3 Offline absolute:** no fetch/XHR/WS anywhere in F code; check-offline green.
- **N-4 No service-worker changes** (TD16 + SAP-2's scoped SW both untouched).
- **N-5 Number regime:** TIMBER numerals on cards/packet carry doctrineRef (+ LS suffix
  when T4's register flags them); SAP-2 magnitudes render only via Result's formatting
  path with class-gated emission; no authored numerals (number-free gates extended, never relaxed).
- **N-6 Local-only, disposable progress:** keys `timber2-train` / `sap2-train-v1`;
  versioned envelope; boot revalidation; no telemetry, no accounts, no export-by-default.
- **N-7 Legacy tests immutable** (git diff empty on `test/timber-*.test.ts`); sap2 gate
  suites only ever GAIN cases.
- **N-8 Deploy stays green and lean:** build:suite at every merge; check-size within
  budget; zero new dist asset files (check-assets allowlist unchanged).
- **N-9 Determinism:** decks, card art, packet — same inputs ⇒ byte-identical outputs;
  seeded shuffle only.
- **N-10 Serialization vs T3** (PD-6) and **composition, never forking:** F code
  consumes TIMBER-2/SAP-2 shapes as published; any needed change to those shapes goes
  through THEIR plan's change process, not ours.

### 6.3 Per-phase START HERE

- **F0:** read `src/ui/woodframe-scene.ts` fitViewport/loop + `sap2/index.html`'s
  `.narrow` block first. FIRST TEST: render-scheduler state machine (red). Trap: keep
  `preserveDrawingBuffer` semantics — stage-sheet capture (T3) relies on render-then-read;
  on-demand rendering must still render before any capture path. Record the size baseline
  BEFORE other F phases inflate it.
- **F1:** extract labels FIRST (mechanical, scene imports it — separate commit), then
  pure modules + vectors, UI last. FIRST TEST: scheduler vectors (§6.4). Trap: card ids
  must derive from role/stage/nominal — NEVER from array index (models regenerate;
  indices don't survive option toggles).
- **F2:** read the raycast block (woodframe-scene.ts ~line 258) before writing pick
  tolerance. FIRST TEST: question-pool excludes roles absent at the scrubbed stage.
  Trap: wrong-tap flow must never mutate scheduler state for cards not in the session.
- **F3:** read `bom.ts` end-to-end (CutLine/BomSummary are your only inputs) + TIMBER-2
  §5.6 print rules. FIRST TEST: packet totals ≡ bomSummary totals. Trap: the (PH) note
  is load-bearing honesty — it renders in EVERY labor block, print included; do not
  tidy it away.
- **F4:** read SAP2_BLUEPRINT §2.4/§2.7/§3 + `sap2/src/schema/watermark.ts`
  artifactPolicy + `engine/compute.ts` Result BEFORE any code. FIRST TEST: the class-
  gating matrix (red). Trap: never format a number yourself — route through the deck's
  formatting so FICT/tokens are inherited; your code contains zero numeric literals
  that could trip g2.
- **F5:** duplex alignment math first (pure), print second. Trap: paper deck prints
  from the SAME deck derivation — no separate "print bank".
- **F6:** read the AS-BUILT T3 router/store/print modules — this phase adapts to what
  T3 actually shipped; where T3 diverged from its plan, follow the code and log the
  delta. FIRST TEST: `#train` redirect in the happy-dom smoke suite.

### 6.4 Trainer Core behavior vectors (both trees reproduce these in a contract test)

| # | Given | Expect |
|---|---|---|
| V1 | fresh state, cards [a,b,c], seed 42 | session order = deterministic permutation of [a,b,c]; all box 1 |
| V2 | grade(a, ok) at t0 | a → box 2, lastSeen t0, seen 1, lapses 0 |
| V3 | grade(a, ok) ×4 then wrong | a → box 1, lapses 1 (never below 1, never above 5) |
| V4 | box 3 card, now = lastSeen + 2 days | NOT due (interval 3) — due at +3 days |
| V5 | stored state contains unknown id `zz` | load drops `zz` silently; rest intact |
| V6 | envelope `v: 0` | fresh state + notice flag; no throw |
| V7 | same state + same seed, called twice | identical session order (determinism) |

### 6.5 Definition of Done (every F phase)

(1) `npm run verify` + `npm run build:suite` green on branch AND after merge (plus
`cd sap2 && npm run verify` for F4); (2) git diff empty on `test/timber-*.test.ts`;
(3) check-size within budget, zero new dist assets; (4) the phase's §3 acceptance items
individually checked by a fresh session; (5) demo walked on desktop AND the reference
phone; (6) DECISIONS.md entries (`TRAIN Fn:`) + device-pass record where the phase
names one; (7) hub/USER_GUIDE copy updated when a surface became user-visible; (8) no
TODO without a backlog row in §4.

*End of platform & scope design. Implementing sessions: start at §6.3, phase F0.*
