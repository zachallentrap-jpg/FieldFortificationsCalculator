# DESIGN — TRAINING PROGRAMS (TRAIN-1): The Toolkit as a Unit's Teaching Instrument

> **Status:** Commissioned design for the training workstream. Proposed repo home when
> adopted: `docs/training-design/design-training.md`, with the synthesized binding plan
> (if commissioned) at `docs/TRAINING1_PLAN.md`. Quality bar and format:
> `docs/TIMBER2_PLAN.md`. Implementing sessions execute phases TR0–TR5 without the
> planner present.
>
> **Ground truth (verified 2026-08-02):** `src/timber/types.ts` (Member: role, nominal,
> cutLength, stage, nailing, doctrineRef "(PH)"), `src/timber/frame.ts` (generateFrame),
> `src/timber/bom.ts` (CutLine.memberIds — the BOM↔3D linkage; MH rates "(PH)"),
> `src/timber/elevation.ts` (wallElevation/layoutStrip pure 2D projections),
> `src/ui/woodframe-scene.ts` (PLAIN/WHAT role dictionaries at lines 44–87, member card,
> stage scrubber, per-stage cut lists, fmtFtIn), `docs/TIMBER2_PLAN.md` (binding: §3.1
> StructureSpec, §3.7 StageKey/StagePlanEntry/SpecIssue/configSchemaFor, §4.4 runtime
> SVG thumbnails, §5 router/store/print, T0–T8), `docs/SAP2_BLUEPRINT.md` (§2.4 fill
> classes/FICT, §2.7 watermark, §3 Build Card deck + §3.8 comprehension gates),
> `sap2/src/schema/watermark.ts` (artifactPolicy), `sap2/src/engine/compute.ts` (Result).
> SAP-2's `computeStages`/card deck are blueprint-specified but NOT yet in code (they
> land with SAP-2 R2a+); nothing here may depend on them existing.
>
> **Composition posture (non-negotiable):** this design adds a training LAYER that
> PROJECTS existing engine data. It forks nothing: no second copy of PLAIN/WHAT, no
> hand-authored per-structure lesson content, no re-implementation of SAP-2's
> comprehension machinery, no second BOM. Where TIMBER-2 and this design touch the same
> file, the touch point is named in §10.6 and is additive.

---

## 1. Mandate → testable requirements

| # | Owner's mandate (verbatim intent) | Requirement | Where |
|---|---|---|---|
| M1 | "Individual components can be viewed as training or teaching aids in a flash-card quizlet style — see the thing, then flip to reveal the answer." Must work SUPER WELL on mobile and desktop. | Flashcard decks compiled from `Member[]` (one card per role present, SVG front / dictionary back), pure DOM+SVG (no WebGL requirement), one-hand portrait phone spec with flip/swipe, ≥44 px targets, plus desktop keyboard nav. | §3.1, §4.1, §5.2 |
| M2 | "Find the best ways we can use this for training" — beyond flashcards, creative then honest. | The four modes that actually teach (flashcards → stage walkthrough → quizzes → full build exercise), plus drills (§6), instructor modes (§5), printables (§5.3) — every other idea ranked and most of them cut with reasons (§8). | §4–§6, §8 |
| M3 | Command-ready packet ("man-hours, exact materials"). | OWNED BY THE PACKET WORKSTREAM, not here. Training composes with it: the build-exercise lesson references the printed stage cut lists / build packet; the session sheet is a RECORD, never a second BOM. | §4.4, §7 |
| M4 | "Make other improvements you can think of" — ranked backlog, honest value/cost. | §8 ranks every candidate; the CUT table is longer than the KEEP table on purpose. | §8 |
| M5 | PLAN ONLY; other sessions implement phase-by-phase. | Exact files, binding signatures, per-phase contents + acceptance + tests + descope ladders + START HERE, phase dependencies stated against TIMBER-2 T0–T8 and SAP-2 R-phases. | §9, §10 |

**Non-negotiables inherited whole (restated so this doc stands alone):** fully offline,
zero external requests; zero new runtime deps (three.js stays the only one, and the
training surfaces do not even need it); deterministic outputs; one toolkit deploy;
`assetsInlineLimit` never raised; no accounts, no telemetry — all training data is
local-only (§7); legacy `test/timber-*.test.ts` immutable; deploy build stays lean.

---

## 2. Architecture: where training lives and what it composes with

### 2.1 Placement

Training is a **TIMBER-side UI package** plus a **pure engine-side compiler package**:

```
src/timber/training/            # PURE, node-tested, no DOM/three.js (engine discipline)
  deck.ts                       # compileDeck: StructureModel -> DeckSpec
  curriculum.ts                 # compileCurriculum: -> CurriculumSpec; hipPocketPlan
  quiz.ts                       # quizPlan: (DeckSpec, seed) -> QuizPlan
  confusion.ts                  # CONFUSION_GROUPS over MemberRole (closed vocab)
  stageNotes.ts                 # STAGE_NOTES over StageKey (closed vocab)
src/ui/woodframe/train/         # UI (T3 file-set sibling; DOM+SVG only, no WebGL)
  train.ts                      # routes #/train, #/train/deck/<id>, #/train/quiz/...
  cards.ts                      # flashcard surface (flip/swipe/requeue)
  quiz-ui.ts                    # quiz surfaces incl. drills
  hip.ts                        # hip-pocket guided flow
  print-train.ts                # card sheets / worksheets / posters / session sheet
  records.ts                    # training store (timber2-training) + session records
```

Why TIMBER-side: every byte of flashcard/lesson content is a projection of the timber
engine (`Member[]`, `StagePlanEntry[]`, `CutLine[]`, PLAIN/WHAT). The TIMBER-2 plan
already establishes the hash router, store discipline, print layer, mobile rules, and
the labels dictionaries — training mounts on those instead of inventing parallel ones.

Entry points:
- Hub (`src/ui/hub.html`): one new card "Training — flashcards, drills, and printable
  training aids for every structure" linking to `/woodframe.html#/train` (the hub's own
  comment says adding a tool = one more card; this is not a new tool, just a deep link).
- Picker: a small "Train" chip in the TIMBER-2 top bar (T3 shell).
- Workbench: a **"Practice this build"** action in the inspect panel — compiles a deck
  for the CURRENT spec, custom builds included. This is the sleeper feature: flashcards
  for the exact structure the crew is about to build, free, because decks compile from
  any `StructureModel`.
- SAP-2: **link-only** (§4.5). No training code ships inside `sap2/`.

### 2.2 The compile-not-author principle (binding)

Every lesson artifact is `f(StructureModel, closed-vocab dictionaries)`:

| Artifact | Compiled from | Hand-authored content allowed |
|---|---|---|
| Flashcard deck | `model.members` clustered by role; PLAIN/WHAT; thumbnails | none |
| Stage walkthrough | `model.stagePlan` (TIMBER-2 `StagePlanEntry[]`; legacy `STAGES` via the T1 adapter) + roles-first-appearing-per-stage + per-stage `cutList` | `STAGE_NOTES`: ONE instructor line per `StageKey` (≤19 entries, closed vocabulary, lockstep-tested) — authored once ever, never per family |
| Quizzes | deck + `CONFUSION_GROUPS` + seeded PRNG | `CONFUSION_GROUPS`: role→group map over the closed `MemberRole` vocab (lockstep-tested) |
| Drills | `bomSummary`/`cutList` lines; member counts | none |
| Printables | the same DeckSpec/StagePlan/thumbnail SVGs | layout constants only |
| Session sheet | `TrainingSessionRecord` | posture copy (fixed strings) |

The two authored tables are the same class as the existing PLAIN/WHAT dictionaries:
bounded by a closed vocabulary, covered by a lockstep test (extends TIMBER-2 I-14), and
they carry teaching VOICE, never structure data. A new catalog family (T4 tower, T5
huts, T7 bunker) gets its full training ladder with **zero training-code change** —
asserted by iterating every `FamilyDef` preset in the deck test suite.

### 2.3 Liability regimes on training content (the numerics provenance rule)

The two apps' regimes are different and both binding. Training content obeys BOTH by
construction via one rule, gate-tested (G-TR-1, §9.2):

Every numeral or doctrine string rendered on a training surface must be one of:
- **(N1) engine-computed fact of the displayed structure:** counts, cut lengths, board
  feet, dims, stage membership — rendered with the studio's own formatters (`fmtFtIn`).
  These are outputs of the generated model, not doctrine constants. Free to show, free
  to quiz.
- **(N2) doctrine-cited string carried verbatim from Member/doctrine fields** —
  `nailing`, `doctrineRef`, grade, LS suffixes — ALWAYS carrying their "(PH)" marker
  and LS suffix through every surface including print. Allowed on card BACKS and
  reference surfaces. **Never a graded quiz answer while `ph:true`** — the toolkit must
  not train Marines to memorize numbers still pending page verification. (When TIMBER-2
  flips a constant to page-verified, the quiz generator may include it; this unlock is
  keyed on the doctrine entry's `ph` flag, mechanically — §6.5.)
- **(N3) session-record fact:** scores, dates, typed names.

Man-hours: display-only with the existing "(PH rates)" footnote, exactly as the stage
panel prints today (`woodframe-scene.ts` renderStagePanel); never a quiz answer.

SAP-2 side: the timber training package renders **zero SAP-2 numerals, leaves, or
Result data, ever** — SAP-2 ships empty, and its TRAINING numerals carry FICT inside
SAP-2's own surfaces. Composition with SAP-2 is links and qualitative log rows only
(§4.5), enforced by an import/reference gate (G-TR-2). Component IDENTITY (names,
purposes, what-nails-to-what) is qualitative and free in both regimes — that is why a
flashcard app is buildable at all.

The §6.4 TIMBER-2 wordlist/boundary gates already scan `src/timber/**` + `src/ui/**`
strings; training files live inside that glob, so the bunker-boundary lexicon gate
covers training copy automatically (a meta-test asserts the glob includes the training
directories — §9.2).

### 2.4 Phase dependencies (explicit, against T0–T8 and SAP R-phases)

| Training phase | Hard dependency | Why |
|---|---|---|
| TR0 (compilers) | TIMBER-2 **T2 merged** | needs `stagePlan.ts` (T1), `thumbnails.ts` + catalog `FamilyDef` (T2). The thumbnail-opts extension (§3.4) is an additive change to a T2 file. |
| TR1 (flashcard UI, store, hub card) | TIMBER-2 **T3 merged** | needs the router, store envelope pattern, `labels.ts` (PLAIN/WHAT extraction), mobile shell rules, print.ts foundation. |
| TR2–TR5 | TR1 | linear within the training workstream. |
| Deck breadth | none | decks appear automatically as T4/T5/T6/T7 land families; TR code does not change. |
| SAP-2 tie-in beyond links | SAP-2 **R2a/R3** (`computeStages`, card deck, comprehension protocol) | until then the tie-in is the link lesson + log row only. Any deeper integration is SAP-2's own backlog (§4.5). |

If TIMBER-2 parks after T3, training still fully works for the three live cards
(gp-frame, storage-shed, custom) — the ladder is complete on whatever catalog exists.
Do NOT build a TR-0-against-TIMBER-1 fork to ship earlier: it would duplicate PLAIN/
WHAT and invent a second thumbnail path, the exact forks this plan forbids. The honest
early option is sequencing: TR0/TR1 are small enough to follow T3 immediately.

---

## 3. Data model (binding shapes)

All plain data, JSON-serializable, deterministic. Engine-side modules obey TIMBER-2
C-1 purity (no DOM, no Date, no unseeded random, no module state).

### 3.1 Decks and cards — `src/timber/training/deck.ts`

```ts
import type { Member, MemberRole } from '../types';
import type { StructureModel } from '../spec';          // T1; legacy adapter path below

/** One face of a card. `svg` is the runtime-deterministic thumbnail string (§3.4)
 *  with the card's members highlighted; `lines` are text rows rendered under/over it.
 *  Faces carry NO free-form numerals — every line is tagged with its provenance class
 *  so G-TR-1 can verify §2.3 mechanically. */
export interface CardLine {
  text: string;
  provenance: 'identity' | 'engine' | 'doctrine-ph' | 'doctrine-verified';
  doctrineRef?: string;         // required when provenance starts with 'doctrine'
}
export interface CardFace { svg?: string; title: string; lines: CardLine[] }

export interface FlashCard {
  id: string;                   // `card:<role>` — stable per deck
  role: MemberRole;
  front: CardFace;              // the thing: highlighted members, no name
  back: CardFace;               // the answer: PLAIN name, WHAT line, facts
  sourceMemberIds: string[];    // ⊆ model member ids — projection linkage (like CutLine.memberIds)
  count: number;                // members of this role in the model
  firstStage: number;           // ordinal of first appearance (teaching order key)
  lifeSafety: boolean;          // any source member carries the LS suffix → badge travels
}

export interface DeckSpec {
  id: string;                   // `deck:<familyId>` | `deck:custom-<n>` | `deck:demo`
  title: string;                // catalog card title or user label
  familyId?: string;
  specFingerprint: string;      // short hash of canonicalizeSpec(spec) — ties records to the exact structure
  cards: FlashCard[];           // ordered by (firstStage asc, count desc, role asc)
  stageCount: number;
}

export function compileDeck(model: StructureModel, meta: { id: string; title: string; familyId?: string }): DeckSpec;
```

Compilation rules (binding):
- **One card per role present** in `model.members` (the same clustering the member
  card's "identical members" count uses). Representative member = lexicographically
  smallest id of the role (deterministic).
- Front: thumbnail SVG with `highlightIds` = all members of the role, title "What is
  the highlighted piece?" (fixed copy), zero identifying text.
- Back: PLAIN name (title), WHAT line (`identity`), then fact lines: "N pcs" +
  nominal breakdown ("28 pcs 2x4, 4 pcs 2x6") (`engine`), representative cut length
  via `fmtFtIn` (`engine`), grade + nailing (`doctrine-ph`, doctrineRef carried),
  stage name (`identity`), LS badge line when `lifeSafety`.
- PLAIN/WHAT come from `src/ui/woodframe/labels.ts`… which is a UI file. **Binding
  relocation (TR-D2):** at TR0 the dictionaries move to `src/timber/training/labels.ts`
  (pure data) and `src/ui/woodframe/labels.ts` re-exports them; T3's I-14 lockstep test
  points at the new home. One-file additive move, coordinated via a DECISIONS.md entry
  so the T3 session and TR0 session cannot collide. If T3 has already shipped when TR0
  starts, TR0 performs the move; the re-export keeps every existing import working.
- Legacy path: until T1's `StructureModel` exists, `compileDeck` accepts
  `{ members, stagePlan }` where the caller adapts `FrameModel` + `STAGES` — but per
  §2.4 TR0 starts after T2, so in practice only the compat tests exercise this.

### 3.2 Curricula and lessons — `src/timber/training/curriculum.ts`

```ts
export type LessonKind =
  | 'flashcards'      // crawl: the deck (optionally a stage slice)
  | 'stage-walk'      // walk: one stage as a lesson (scrubber-as-lesson)
  | 'quiz-id'         // run: see part -> name it (4 options)
  | 'quiz-place'      // run: name -> tap the part (SVG hit areas)
  | 'drill-bom'       // §6.1 estimation drill
  | 'drill-cutlist'   // §6.2 cut-list reading
  | 'drill-omission'  // §6.3 inspection drill (TR5)
  | 'build-exercise'  // the capstone wrapper (§4.4)
  | 'external';       // link out (SAP-2) — no data crossing

export interface LessonSpec {
  id: string;                    // `lesson:<kind>:<n>` stable within curriculum
  kind: LessonKind;
  title: string;
  deckId: string;
  stageOrdinal?: number;         // stage-walk / stage-sliced lessons
  questionCount?: number;        // quiz/drill lessons (data constant, not clock)
  passBar?: { correct: number; of: number };   // display + record only, never a lock
  external?: { href: '/survivability/'; label: string; note: string };
}

export interface StageWalkContent {                 // compiled per stage-walk lesson
  entry: { ordinal: number; label: string; detail: string };   // TIMBER-2 StagePlanEntry (legacy: STAGES row adapted)
  say: string;                                      // STAGE_NOTES[key] instructor line
  newRoles: MemberRole[];                           // roles first appearing this stage
  cutLines: CutLine[];                              // cutList(membersOfStage) — the real one
  manHoursLine?: CardLine;                          // 'engine' + "(PH rates)" footnote, display only
}

export interface CurriculumSpec {
  id: string;                    // `curr:<deckId>`
  deckId: string;
  title: string;
  lessons: LessonSpec[];         // crawl -> walk -> run -> capstone, compiled order
}

export function compileCurriculum(deck: DeckSpec, model: StructureModel): CurriculumSpec;
export function stageWalkContent(model: StructureModel, ordinal: number): StageWalkContent;
export function hipPocketPlan(curr: CurriculumSpec): LessonSpec[];   // §5.1, HIP_BUDGET table
```

Compiled curriculum order (binding): `flashcards` (whole deck) → one `stage-walk` per
`stagePlan` entry, in build order, 1:1 — a hand-maintained stage list is forbidden and
tested against `model.stagePlan` — → `quiz-id` → `quiz-place` → `drill-bom` →
`drill-cutlist` → `build-exercise` → one `external` lesson (SAP-2 link, §4.5) appended
only on the hub-level "position + structure" track, not per timber deck.

`STAGE_NOTES` (`stageNotes.ts`): `Record<StageKey, { say: string }>` over TIMBER-2's
closed StageKey vocabulary (§3.7 of the plan) plus the legacy 11 stage ids via their
StageKey mapping. Lockstep test: every StageKey has an entry; every entry ≤ 160 chars;
plain register. Example (`'plates'`): "Point at the cap plate laps at the corners —
this is what locks the walls into one frame."

### 3.3 Quizzes — `src/timber/training/quiz.ts`

```ts
export interface QuizQuestion {
  cardId: string;
  kind: 'quiz-id' | 'quiz-place' | 'drill-bom' | 'drill-cutlist' | 'drill-omission';
  prompt: string;
  options?: { label: string; role?: MemberRole }[];  // 4, unique, contains answer (id/cutlist)
  answerIndex?: number;
  numericAnswer?: number;                            // drill-bom: the engine count
  svg?: string;                                      // question art (highlight / omission render)
}
export interface QuizPlan { deckId: string; seed: number; questions: QuizQuestion[] }

export function quizPlan(deck: DeckSpec, model: StructureModel, kind: QuizQuestion['kind'],
                         seed: number, count: number): QuizPlan;
```

- **Determinism with variety:** `mulberry32(seed)` (repo precedent `test/fuzz.test.ts`);
  the seed is explicit data — the UI derives it as `attemptNumber` within the session,
  so a retake gets a different-but-reproducible plan and tests golden seed 1.
- **Distractors** for `quiz-id`/`quiz-place`: 3 roles drawn from the same
  `CONFUSION_GROUPS` group as the answer first (stud/cripple/jackStud/kingStud;
  joist/rimJoist/tailJoist/…), topped up from other roles present in the model. Only
  roles present in the model are ever offered — the quiz never names a part the
  structure does not have. `confusion.ts` is a closed-vocab table with a lockstep test
  (every `MemberRole` in exactly one group; new T2+ roles must be added or the build
  fails — same mechanism as PLAIN/WHAT).
- **`quiz-place`:** the SVG front renders with per-member `data-member` hit groups (the
  layout-strip pattern in `woodframe-scene.ts` renderStrips already does exactly this
  for SVG marks); tapping any member of the target role scores correct.
- **Answer provenance gate:** graded answers may only be role identity, nominal, stock,
  count, stage membership, or CutLine fields — never a `doctrine-ph` line (§2.3).
- **Requeue:** cards answered wrong re-enter at the end of the run once (fixed rule,
  no scheduling system — see §8's Leitner cut).

### 3.4 Thumbnail extension (additive to TIMBER-2 §4.4)

`thumbnails.ts` (T2 file) gains optional opts — additive, default-off, so existing
golden SVGs are byte-identical when opts are omitted (asserted):

```ts
export interface ThumbOpts {
  highlightIds?: string[];   // stroke-emphasized + filled; everything else line-art
  stageOrdinal?: number;     // render members with stage <= ordinal (scrubber semantics)
  size?: 'card' | 'poster';  // poster doubles the viewBox scale budget
  omitIds?: string[];        // §6.3 omission drill — REMOVES members (never invents)
}
```

Same determinism, same no-external-refs/no-script structural asserts, own committed
SVG-file goldens under `test/goldens/train/`. Polygon/KB/ms budgets: card ≤ the §4.4
thumb budget; poster ≤ 2×. The flashcard/quiz surfaces are therefore WebGL-free end to
end — a phone that struggles with the 3D studio still runs the whole training ladder.

### 3.5 Training store — `src/ui/woodframe/train/records.ts`

localStorage key **`timber2-training`** (never collides with `timber2-session` or
`sap1-*`), versioned envelope, boot revalidation ("never trust stored bytes"),
debounced 300 ms writes flushed on pagehide/visibilitychange/route change — all four
rules copied verbatim from TIMBER-2 §5.5 discipline.

```ts
export interface AttestedName { name: string }        // typed; attested, not authenticated
export interface LessonResult {
  lessonId: string; kind: LessonKind;
  correct: number; of: number;
  timedMs?: number;                                   // present only when the timer was ON
  estimates?: { guess: number; actual: number }[];    // drill-bom calibration pairs
}
export interface TrainingSessionRecord {
  id: string;                   // `ts-<seq>`; seq monotonic, never reused (customSeq pattern)
  dateISO: string;              // device clock — attested, stated on the sheet
  deckId: string; deckTitle: string; specFingerprint: string;
  curriculumId?: string;
  mode: 'self' | 'hip-pocket' | 'classroom';
  instructor?: AttestedName;
  participants: AttestedName[];        // may be empty (solo practice)
  results: LessonResult[];
  externalRuns?: { app: 'sap2'; note: string }[];     // qualitative only, e.g. "Build Card deck walked, TRAINING fill"
  appVersion: string;
}
export interface TrainingEnvelope {
  v: 1; seq: number;
  settings: { timedEnabled: boolean };  // default false (§6.4)
  records: TrainingSessionRecord[];     // cap 500; at cap, new-session start blocks
}                                       // with a visible "export or clear first" notice
```

Records never silently drop. Actions: export all as `.timber-training.json`
(deterministic serialization), print session sheet (§5.3.4), "clear all training
data" (single confirm). No import in v1 (§8 cut — paper is the filing artifact).

---

## 4. The ladder — crawl, walk, run, build (per structure)

The same four-rung ladder compiles for every catalog family and every custom build.
Nothing below is authored per structure.

### 4.1 Crawl — flashcards (mandate M1; the mobile flagship)

Route `#/train/deck/<id>`. One card fills the viewport:

- **Front:** the structure's thumbnail SVG with the target role highlighted, big;
  caption fixed: "What is the highlighted piece?". Tap anywhere (or Space) flips.
- **Back:** PLAIN name huge, WHAT line, fact lines per §3.1, doctrineRef small with its
  "(PH)" visible, LS badge when applicable.
- **Controls (thumb zone, bottom):** `Again` / `Got it` (≥44 px, full-width halves).
  `Got it` advances; `Again` requeues the card at the end. Swipe left/right = same
  pair (30 px threshold, pointer events). Progress line "7 of 22 · 3 to retry".
- **Flip:** CSS 3D rotate 250 ms; `prefers-reduced-motion` → instant swap. Flip element
  is a real `<button>` with `aria-pressed`; faces have `aria-hidden` toggled.
- **Order:** deck order (firstStage, count desc) = build order = teaching order.
  A stage filter chip row ("Floor · Walls · Roof…", from the stagePlan) slices the deck.
- **Desktop:** same surface centered at card aspect; ←/→/Space; the T3 keyboard guard
  rules apply (no-op in inputs).
- **Performance bar (acceptance):** route interactive < 1 s on the reference low-end
  Android (deck compile is memoized per spec fingerprint; SVG per card memoized);
  no WebGL context created on any `#/train` route (asserted in the smoke suite).

### 4.2 Walk — stage walkthrough (the scrubber as a lesson)

Route `#/train/walk/<deckId>/<ordinal>`. This is the studio's stage scrubber
re-presented as a lesson page, one stage per screen:

- Header: "Stage 3 of 9 — Floor joists & bridging" (from StagePlanEntry label; the
  persistent-stage-name rule of TIMBER-2 §5.3 carries over).
- Art: stage-progression pair — thumbnail at `stageOrdinal-1` (small, "before") and at
  `stageOrdinal` (large, "after"), new-stage members highlighted. Inside the full
  studio (desktop), an "open in 3D at this stage" link deep-links `#/build/<id>` with
  the stage set — the walkthrough never re-implements the 3D scene.
- Narration block (compiled, §3.2): the STAGE_NOTES say-line; then "New pieces this
  stage:" — each new role's PLAIN + WHAT line (tappable → flips to that flashcard).
- The stage's REAL cut list table (same renderer as the stage panel) and the man-hours
  line with the existing "(PH rates)" footnote.
- Prev/next stage; "quiz me on this stage" → `quiz-id` sliced to roles present so far.

### 4.3 Run — quizzes

Routes `#/train/quiz/<deckId>/<kind>`. Shared quiz shell: question art (SVG), prompt,
four option buttons (≥44 px, letters A–D for oral classroom use), instant feedback
(correct → green + the WHAT line as reinforcement; wrong → the right answer shown,
card requeued), running score, end screen with per-card misses and "log this session".

- `quiz-id`: front SVG highlight → "What is this piece called?" Options per §3.3.
- `quiz-place`: "Tap the cap plate." → full-structure SVG with member hit areas;
  correct = any member of the role. One retry, then reveal (highlight flashes).
- Stage-sliced variants come free (filter before planning).

### 4.4 Build — the full build exercise (capstone)

`build-exercise` is a WRAPPER, deliberately humble — the toolkit's existing surfaces
are already the exercise materials:

- A checklist page compiled from the stagePlan: for each stage — stage name, member
  count, cut list reference, a "crew read-back" line ("crew states what the stage
  builds and which pieces are new"), and a check row per stage (press-and-hold ~600 ms
  to tick, borrowing SAP-2's rain-proof gesture; ticks live only in the session record).
- Buttons: print the per-stage cut lists and stage sheets (T3 print surfaces; plus the
  command packet's sheets when that workstream ships — referenced, not duplicated).
- Completion → session record with mode 'classroom', participants, per-stage ticks.
- It does NOT schedule labor, assign tasks, or time crews. That is the packet
  workstream's and the NCO's job. (Timer integration ranked and cut, §8.)

### 4.5 SAP-2 tie-in — compose, never duplicate (binding boundary)

SAP-2's training story ALREADY EXISTS in its blueprint and is better than anything a
timber-side clone could be: the Build Card deck (§3 — generative from `computeStages`),
BUILD mode, TRAINING fill class with inline FICT, watermark states, and the §3.8
comprehension protocol with human trials. Therefore:

1. The hub-level "Survivability + structures" curriculum track includes one
   `external` lesson: "Run the one_man Build Card deck at /survivability/ — BUILD
   mode, TRAINING fill. The deck itself is the lesson." Link only.
2. The session sheet can log `externalRuns` rows — qualitative ("deck walked",
   attested) — never values, states, or counts read out of SAP-2.
3. **Nothing in `src/timber/training/**` or `src/ui/woodframe/train/**` imports from
   `sap2/` or reproduces SAP-2 content** (gate G-TR-2). SAP-2's ship-empty regime
   cannot be end-run through a training surface, the same way TIMBER-2 §2.7 blocks
   the bunker end-run.
4. Deeper integration (e.g., a SAP-2-side deck rehearsal/self-quiz mode over its own
   TRAINING fills) is a SUGGESTION FOR SAP-2's backlog (post-R3, inside its FICT
   regime, built by a SAP-2 session against SAP2_BLUEPRINT) — recorded here as
   TR-D8, explicitly NOT built by this workstream.
5. SAP-2's comprehension-gate machinery (word allowlist, protocol tasks) is NOT
   imported for timber cards — different audience and stakes: timber flashcards teach
   trade vocabulary to Marines with an instructor present; the terms of art ("cripple",
   "jack stud") ARE the content and would fail a top-3000 allowlist by design. What we
   DO keep: plain-language-first (WHAT lines already exist), the rain-proof
   press-and-hold check gesture, and the attested-identity language. Recorded as
   TR-D9 so nobody "helpfully" bolts the allowlist on later.

---

## 5. Instructor reality

### 5.1 Hip-pocket class mode (one phone, 5 Marines, 15 minutes, no network)

Route `#/train/hip/<deckId>`. The corporal holds the phone; the fire team answers out
loud. A guided, swipe-through flow the instructor cannot get lost in:

- **Screen sequence = `hipPocketPlan(curriculum)`** — pure function, one `HIP_BUDGET`
  data table (binding defaults): 1 intro screen → 5 flashcards → 3 stage-walk screens
  → 5 oral quiz questions → 1 log screen. Time-boxed by COUNTS, not clocks (offline,
  glare, gloves — a countdown would be theater). An elapsed-time line displays
  passively; nothing ever auto-advances.
- **Card selection is deterministic:** the first 5 deck cards (build order); the 3
  stages with the most new roles (tie-break: earlier ordinal); quiz seed = the
  session's attempt number.
- **Every screen carries a one-line instructor script** (gray, small, top): authored
  per SCREEN KIND, not per content — 8 fixed strings total (e.g. flashcard screen:
  "Ask: what is this piece called? What does it do? Tap to reveal."). The say-lines
  for stage screens come from STAGE_NOTES (§3.2) — nothing new authored per structure.
- **Oral quiz presentation:** options render as big A/B/C/D rows; the instructor taps
  the letter the team called; feedback shows the WHAT line to read aloud.
- Log screen: prefilled mode 'hip-pocket', typed instructor name (attested),
  participant count or typed names, one tap to save; "skip logging" is equally
  prominent (logging must never feel mandatory or surveilled — §7).
- Fully usable one-handed portrait; every target ≥44 px; works identically offline
  because everything does.

### 5.2 Projector / large-screen classroom mode

Not a separate app — a presentation state, cheap by design:

- Toggle chip "Projector" on any training route (persists in the session envelope);
  sets a `projector` class on the root: type scale ×1.6, card art max-height 70vh,
  thumb-zone controls replaced by a bottom-center hint bar ("← previous · space flip ·
  → next"), cursor auto-hidden after 3 s idle.
- Keyboard: ←/→ navigate, Space flips/reveals, 1–4 answer the current quiz question.
  Scoped under the T3 keyboard-guard rules (no-op in inputs/popovers).
- The instructor runs the same decks/quizzes; a phone-mode class and a schoolhouse
  class use one artifact. No second rendering path, no slide export (§8 cut).

### 5.3 Printable training aids (all compiled from the same data, all deterministic SVG
through the T3 `print.ts` page-assembly helpers; every sheet footer carries deck id,
spec fingerprint, app version, date line, and the "(PH)" footnote when any
doctrine-ph line appears on the sheet)

**5.3.1 Flashcard sheets (2-up and 4-up, duplex).**
- 4-up: Letter portrait, 2×2 grid, cell 3.75×4.6 in, crop marks. Fronts page then
  backs page; **backs mirror columns — cell (r,c) → (r, 1−c) — for LONG-EDGE duplex**
  (stated on the sheet margin: "print double-sided, flip on long edge").
- 2-up: two full-width cards stacked; single column, so long-edge flip needs no
  mirror (the mirror function is identity at 1 column — unit-tested, not assumed).
- **Duplex check card:** the first card of every print run is a fixed calibration
  card — front prints ◤ in the top-left with "If the mark on the back of this card
  sits top-RIGHT, your duplex setting is correct."
- Card faces are the same CardFace data: front = highlight SVG only; back = name,
  WHAT, facts with their "(PH)" markers intact (marks travel through print — same
  principle as SAP-2's inline FICT).

**5.3.2 Stage posters.** One page per StagePlanEntry, landscape: stage name huge,
poster-size thumbnail at that stage with new members highlighted, "new pieces" legend
(PLAIN + WHAT), the stage cut list table, STAGE_NOTES line as the caption. A taped-up
poster sequence along a wall IS the build sequence — the scrubber flattened onto paper.

**5.3.3 Label-the-diagram worksheets + answer keys.**
- Worksheet: the structure SVG (full or per-stage) with up to 8 leader lines running
  to empty boxes in the left/right gutters; "Name each part" instruction; a word bank
  row (the 8 PLAIN names, shuffled by the sheet's seed) — word-bank on/off is a print
  option (on = easier).
- Target selection (deterministic): roles ranked (firstStage asc, count desc, role
  asc), take K ≤ 8. Anchor = the representative member's projected centroid; box side
  = anchor's side of the centerline; boxes sorted by anchor Y within each gutter.
- Answer key: the identical sheet with boxes filled — generated by the same function
  with `answers: true` (the ONLY difference; asserted by diffing the two SVGs and
  finding only text-node insertions).
- Layout test (§9): no box–box overlap, no box over drawing beyond tolerance, all
  leader lines inside the viewBox, deterministic goldens.

**5.3.4 Training session sheet** — the squad-leader filing artifact (§7 shapes):
Letter portrait: unit/place blanks (hand-write), date (device clock, labeled
"device date — verify"), deck/structure identity + spec fingerprint + app version,
participant table (typed names as recorded, blank rows appended for hand additions),
results table (lesson × correct/of; estimation pairs summarized as "n within 10%"),
external-run rows verbatim ("SAP-2 Build Card deck walked — TRAINING fill; run under
SAP-2's own regime; no values reproduced here"), then the fixed posture block (§7.3
verbatim), and signature blanks: instructor / squad leader. No seals, no crest, no
"certificate" framing — it is a record, not an award (§8).

---

## 6. Drills

### 6.1 BOM estimation drill (`drill-bom`) — guess the count, then reveal

- Prompt: structure SVG with the role highlighted → "How many {PLAIN role} in this
  structure?" Numeric keypad input (inputmode=numeric).
- Reveal: the engine count, the guess, the delta, and "within 10%" tag; then the SVG
  re-renders with every member of the role emphasized and the cut-list line shown —
  the reveal is the teaching moment (count + stock + where they live).
- Scoring: estimation is CALIBRATION training — recorded as guess/actual pairs
  (§3.5), summarized as "n of m within 10%"; never a pass/fail gate.
- Provenance: counts are engine facts of the displayed structure (N1). Man-hour
  guessing is EXCLUDED — rates are (PH) placeholders and training Marines to estimate
  from placeholder rates would teach wrong numbers (TR-D5). If/when labor verifies
  against TM 5-303/P-405 (TIMBER-2 T8), a man-hour estimation drill becomes
  unlockable the same way as §6.5.

### 6.2 Cut-list reading drill (`drill-cutlist`)

Shows a REAL rendered cut-list table (the stage panel's own renderer) for a stage,
then asks reading-comprehension questions compiled from its `CutLine[]`:
"How many pieces of 2x4 at 7'-8 5/8"?" (count), "What are the 2x10 at 12'-0" used
for?" (roles — options from the table's own rows), "Which stock do the cripples come
from?" (nominal). Answer provenance = CutLine fields only. This trains the exact
skill the printed cut sheets demand on site — reading the paper, not memorizing it.

### 6.3 Error-spotting — THE DECISION (deliverable 3 asked for honesty; here it is)

**Wrong-member/wrong-placement error spotting is REJECTED (TR-D6).** Generating a
"plausibly wrong" assembly requires fabricating non-doctrinal geometry — a stud off
layout, a header undersized — and rendering it with the toolkit's authority behind it.
The engine has no wrong-generator, building one invents wrong doctrine by definition,
and the wrong picture is what lingers (both apps' regimes exist to prevent exactly
"authoritative-looking wrong content"). No amount of "find the mistake" framing makes
the fabricated frame stop being a fabricated frame on a doctrine-cited surface.

**What IS honestly generable: the omission drill (`drill-omission`, TR5).** Render
stage k with one role-cluster OF STAGE K removed via `ThumbOpts.omitIds` — pure
member FILTERING, never invented geometry — and ask "Stage k is called complete.
What is missing before you go on?" Options: the omitted role + 3 distractors. The
depicted state is a real mid-stage moment (a partially complete stage k), the same
class of state the scrubber already shows between stages; restricting the omission to
the ACTIVE stage's roles guarantees no build-order-impossible state is ever drawn.
Framing on screen: "Inspection drill" — this trains the QA behavior (inspect before
proceeding) that SAP-2's check culture and real construction supervision both demand.
Answer = set difference of roles, computed, provenance N1.

### 6.4 Timed identification — optional, OFF by default

A per-question timer overlay on `quiz-id` only: settings toggle in the training
envelope (`timedEnabled: false` default), enabled per session, never persisted ON
across a full clear. Timing changes NOTHING about content, order, or scoring — it
records `timedMs` per result and shows a pace line. No leaderboard, no best-time
celebration (§8: competition features cut). Rationale for existing at all: instructors
asked-for pace pressure is real in ID training (vehicle/aircraft recognition
precedent), but it must never punish the slow reader by default.

### 6.5 The (PH)-unlock rule (forward-looking, mechanical)

`quiz.ts` exposes `gradableDoctrine(entry): boolean` = `entry.ph === false`. While
every nailing/spacing constant is (PH), no quiz asks for it (§2.3). When TIMBER-2's
verification passes flip entries to page-verified, nailing-schedule questions
("what nails the joist to the sill?") become compilable with the doctrineRef printed
on the reveal — zero training-code change, driven by the doctrine data the same way
everything else is. Until then those facts appear on card backs only, marked (PH).

---

## 7. Assessment, records, and the privacy posture

### 7.1 What is assessed (and what is not)

- Per-lesson results (`correct/of`), estimation calibration pairs, per-stage exercise
  ticks. A deck shows "last run" and "best run" per mode. That is ALL.
- No mastery model, no spaced-repetition scheduler, no streaks, no per-Marine
  longitudinal profile. A unit trains in sessions with an instructor; the session
  record is the unit's artifact. Individual drill on a personal phone works fine
  without the app pretending to be a gradebook (§8 cuts).
- `passBar` (default 4/5 displayed as a fraction) is DISPLAY + record only — nothing
  in the app ever locks content behind a score (a corporal re-teaching a weak team
  must never fight the tool for access).

### 7.2 Records lifecycle

Create (end of any run or logged hip-pocket/classroom session) → review list at
`#/train/records` (filter by deck/date/mode) → print session sheet (§5.3.4) → export
all as `.timber-training.json` → clear (single confirmed action). Cap and no-silent-
drop rules per §3.5. The printed sheet is the SYSTEM OF RECORD a squad leader files;
the app's store is a convenience buffer, and the UI says so on the records page.

### 7.3 The privacy posture (verbatim block — renders on the records page and prints
on every session sheet; binding copy)

> Names on this sheet are typed and attested, not authenticated. Training results are
> stored only in this browser, on this device. This toolkit has no accounts, no
> analytics, and makes no network requests; results leave the device only when you
> print or export them. Anyone with access to this device and browser can view or
> erase these records — treat the printed sheet as the record of note.

The attested-not-authenticated language is SAP-2's (§2.5), reused verbatim by intent.
The no-network claim is already enforced toolkit-wide by `scripts/check-offline.ts`
and the zero-runtime-deps rule; the training store adds no exception. Device-clock
dates are labeled as such (no monotonic high-water machinery here — that is SAP-2
commissioning-grade apparatus; a training log does not warrant it, stated honestly
instead: "device date — verify").

### 7.4 What deliberately does NOT exist

No accounts, no roster sync, no server, no telemetry of any kind (not even local
usage counters beyond the records the user explicitly saves), no cross-device merge
(cut: §8), no photos/signatures capture (paper takes real signatures), no export of
anything the user did not explicitly type or score.

---

## 8. What NOT to build — every idea ranked

Yardstick: the four modes that actually teach (flashcards, stage walkthrough, quiz,
build exercise) plus the instructor/print reality around them. Everything else must
beat "would the same hour spent verifying (PH) cites teach Marines more?" — usually no.

### 8.1 KEEP (build order = phase order, §10)

| Rank | Feature | Value / cost | Phase |
|---|---|---|---|
| 1 | Deck/curriculum/quiz compilers (pure) | Everything else is a view of this; near-zero marginal cost per family forever | TR0 |
| 2 | Flashcards mobile surface | The owner's named ask; the daily-use surface | TR1 |
| 3 | Stage walkthrough | Turns the already-built scrubber + cut lists into lessons for free | TR1 |
| 4 | quiz-id / quiz-place + requeue | The check on rungs 1–2; distractor quality via CONFUSION_GROUPS is where the teaching lives | TR2 |
| 5 | Printables: card sheets, worksheets+keys, posters | The barracks/classroom reality: paper survives no-phone policies, MWR printers exist; highest value-per-line-of-code in the plan | TR3 |
| 6 | Session records + session sheet + posture | Makes training COUNT for the unit (filed paper); tiny cost | TR3 |
| 7 | Hip-pocket mode | The actual employment context of this toolkit (corporal, 15 min, field); mostly composition of 1–4 | TR4 |
| 8 | drill-bom + drill-cutlist | Direct pull-through to the job-site papers; compiled from existing BOM code | TR2 |
| 9 | "Practice this build" from the workbench | One button; custom structures get full training free | TR1 |
| 10 | Projector mode | A CSS class + keyboard map; schoolhouse reach for pennies | TR4 |
| 11 | drill-omission (inspection drill) | Honest subset of error-spotting (§6.3); teaches QA behavior | TR5 |
| 12 | Timed overlay (off by default) | Small, contained, instructor-requested class of feature | TR5 |
| 13 | SAP-2 link lesson + external log rows | Compose-only tie-in; near-zero cost | TR1 |

### 8.2 CUT — with the honest reason (recorded so they stay cut)

| Idea | Verdict | Reason |
|---|---|---|
| Wrong-placement / wrong-member error spotting | CUT (TR-D6) | Requires fabricating non-doctrinal assemblies on a doctrine-cited surface; the wrong picture is what sticks. Omission drill keeps the honest 20%. |
| Leitner / spaced-repetition scheduler | CUT | Unit training is session-based with an instructor, not daily solo review; end-of-run requeue captures most of the learning effect at ~1% of the complexity. A scheduler also wants per-person profiles — see next row. |
| Per-Marine profiles / gradebook / longitudinal analytics | CUT | Privacy posture (§7), and a squad leader's filed paper already serves the real accountability need. The app must not become a surveillance artifact. |
| Streaks, XP, badges, leaderboards, best-time celebrations | CUT | Gamification aimed at nobody: the users train because the platoon sergeant said so. Adds state, adds noise, cheapens the session sheet. |
| Audio narration / TTS | CUT | Offline TTS is platform-inconsistent; instructors narrate better; screen readers already read the DOM (a11y is handled properly instead). |
| Video / animation authoring | CUT | The stage scrubber IS the animation, generated and always in sync; authored media would rot and bloat the deploy (OOM history). |
| Adaptive difficulty | CUT | With 20–40 cards per deck there is nothing to adapt; requeue covers it. |
| Multiplayer / buzzer quiz between phones | CUT | Requires networking — non-negotiable violation; the hip-pocket oral mode delivers the same social pressure with zero bytes. |
| QR codes on printables | CUT | A QR encoder is ~200 lines of new code to encode a URL that is also printable as text; text URL wins. |
| Record import/merge across devices | CUT (v1) | Merge semantics + trust questions for a convenience buffer whose record of note is paper. Re-rank only if real filing practice demands it. |
| Certificates with seals/crests | CUT | Impersonation-adjacent (official-looking instruments the toolkit has no authority to issue); the plain session sheet with signature blanks is the correct artifact. |
| SAP-2 flashcards rendered timber-side | CUT (TR-D8) | Regime violation vector (ship-empty end-run); SAP-2's own deck is the training surface, inside its FICT machinery. |
| Quiz over (PH) nailing/spacing doctrine | CUT until verified | §2.3/§6.5 — do not train unverified numbers; unlocks mechanically on `ph:false`. |
| Slide-deck (PPTX/PDF) export | CUT | Projector mode + browser print covers the classroom; document generation is a new subsystem with fonts/layout debt. |
| Man-hour estimation drill | CUT until labor verifies | (PH) placeholder rates (TR-D5); unlocks with TIMBER-2 T8's TM 5-303 reconciliation. |
| Sandbox "build it yourself" drag-and-drop assembly game | CUT | A month of UI for a skill the build exercise teaches with real lumber; the engine is parametric, not free-assembly, so this would be a second engine. |

---

## 9. Tests & acceptance per feature

Runner and style: `node --test` + tsx like everything else; pure logic node-tested,
UI via the happy-dom smoke pattern (T3 precedent). New suites are `test/timber2-train-
*.test.ts` — inside the TIMBER-2 acceptance phrasing rules (never a repo-wide count;
legacy `test/timber-*.test.ts` untouched, git-diff-empty).

### 9.1 Invariants (TI-1..TI-10; gates, all TR phases)

- **TI-1 Projection-only:** every card/lesson/drill datum traces to `Member[]`,
  `stagePlan`, `CutLine[]`, spec fields, or the two closed-vocab dictionaries;
  `sourceMemberIds` ⊆ model ids; no training module stores structure facts.
- **TI-2 Determinism:** compileDeck/compileCurriculum/quizPlan/print SVGs deep-equal
  across calls; quiz variety only via explicit seed.
- **TI-3 Numerics provenance (G-TR-1):** every `CardLine` with a digit carries
  provenance; `doctrine-*` lines carry doctrineRef; a scan over rendered card faces
  and print SVGs finds no unclassified numeral. Graded answers never `doctrine-ph`.
- **TI-4 Regime wall (G-TR-2):** no import from `sap2/**` anywhere under
  `src/timber/training/**` or `src/ui/woodframe/train/**` (import-graph test); the
  only allowed SAP-2 reference is the literal href `/survivability/` in the external
  lesson and log-row copy.
- **TI-5 Dictionary lockstep (extends I-14):** every emitted `MemberRole` has PLAIN,
  WHAT, and a CONFUSION_GROUPS group; every `StageKey` has a STAGE_NOTES entry.
- **TI-6 Marks travel:** "(PH)" and LS suffixes present in source fields appear on
  every surface that renders the line — screen, card sheet, poster, session sheet.
- **TI-7 Offline/deps:** no fetch/XHR/WebSocket, no new runtime deps, no new dist
  asset files (check-assets allowlist unchanged), no WebGL on `#/train` routes.
- **TI-8 Store honesty:** boot revalidation degrades bad records to a visible notice,
  never a crash or silent drop; seq monotonic; cap blocks loudly.
- **TI-9 Auto-breadth:** the deck suite iterates EVERY catalog `FamilyDef` preset —
  a family added by T4–T7 that fails to compile a deck fails the training suite, with
  zero training-code change expected to fix it (the fix is dictionary lockstep).
- **TI-10 Legacy untouched:** git diff empty on `test/timber-*.test.ts`; TIMBER-2
  goldens (`frame`, `thumbs`) byte-identical when ThumbOpts are omitted.

### 9.2 Suites

**`timber2-train-deck.test.ts`** (TR0): for every catalog preset + the TIMBER-1 demo
spec: deck compiles; one card per present role; card order (firstStage, count desc,
role asc); sourceMemberIds valid; counts equal role member counts; TI-3 scan; TI-5
lockstep; LS flag set iff a source member carries the LS suffix; determinism;
perf: compileDeck < 10 ms warmed mean per preset (§8.8 house pattern).

**`timber2-train-curriculum.test.ts`** (TR0): stage-walk lessons ≡ `model.stagePlan`
1:1 in order (no hand list — constructed proof: mutate a copied plan, recompile,
assert lessons follow); `stageWalkContent.newRoles` = first-appearance set (fixture:
demo building — `bridging` first at stage 3, `capPlate` at 6); cut lines equal
`cutList(membersOfStage)`; STAGE_NOTES coverage; hipPocketPlan counts equal
HIP_BUDGET and are deterministic; external lessons only carry `/survivability/`.

**`timber2-train-quiz.test.ts`** (TR0+TR2): golden QuizPlan JSON for (demo deck,
seed 1) committed and compared; 4 unique options containing the answer, all from
roles present; same-confusion-group preference asserted on a rigged fixture (wall
roles present → stud question draws ≥2 wall-group distractors); count answers equal
engine counts; no `doctrine-ph` graded answer (rigged doctrine fixture with
ph:false asserts the unlock path too); requeue order; drill-cutlist questions match
the rendered CutLine table; omission drill: omitted role ∈ active stage roles,
`omitIds` never invents ids, reveal = set difference.

**`timber2-train-print.test.ts`** (TR3): duplex mirror math (r,c)→(r,1−c) unit-
tested incl. 1-column identity; committed SVG-file goldens (TIMBER-2 golden style:
full files, string-compared, `npm run update:train-goldens` same-PR rule) for one
card sheet, one worksheet+key, one poster, one session sheet; structural asserts
independent of goldens (no external refs, no `<script`, no `http`); worksheet layout:
≤8 boxes, no box-box overlap, leader lines in-viewBox, key differs from worksheet by
text-node insertions only; posture block present verbatim on the session sheet;
"(PH)" footnote present when any doctrine-ph line prints; page count bounded
(deck ≤ N pages formula asserted).

**`timber2-train-store.test.ts`** (TR1+TR3): envelope versioning; revalidation
(corrupt JSON, wrong version, truncated records → catalog-default + notice flag);
seq monotonicity across delete; cap-500 block behavior; debounce/flush event logic
(injected storage + injected clock — pure, node-tested per the T3 store pattern);
export serialization deterministic.

**Happy-dom smoke additions** (TR1/TR2/TR4, extending the T3 smoke suite):
`#/train` lists decks from the catalog; flip toggles faces with `aria-pressed`;
quiz renders 4 options ≥44 px; `Again` requeues; hip-pocket flow reaches the log
screen in HIP_BUDGET screen count; projector class applies and keyboard advances;
records page renders posture block; no WebGL context created (canvas.getContext
('webgl') never called — spy assert); route unknown → picker notice (router rule).

**Gate/meta tests** (TR0): G-TR-1 provenance scan; G-TR-2 import wall; wordlist-glob
meta-test (training dirs inside the §6.4 scan globs); check-offline and check-assets
stay green with training routes in the bundle.

### 9.3 Acceptance per feature (summary table — each row also appears in its phase)

| Feature | Acceptance (beyond suites) |
|---|---|
| Flashcards | Owner phone-pass on the reference low-end Android: deck opens < 1 s, flip < 100 ms, one-hand run of a full 20-card deck; desktop keyboard run; DECISIONS.md records the device pass (T3 precedent). |
| Stage walkthrough | Every stagePlan entry reachable; "open in 3D at this stage" lands on the studio at that stage; man-hours line carries "(PH rates)". |
| Quizzes | A wrong answer shows the correct PLAIN+WHAT and requeues; a full run writes exactly one session record on "log". |
| Drills | drill-bom reveal highlights every member of the role; drill-cutlist numbers match the printed table on screen simultaneously. |
| Printables | Physical print test recorded (real duplex printer): calibration card aligns; worksheet legible at Letter; owner judges card-sheet legibility (named acceptance, like T3's thumbnails). |
| Records/sheet | Sheet prints with posture block + signature blanks; export/import-less lifecycle: export file re-opens as valid JSON; "clear all" empties and the UI states it. |
| Hip-pocket | Stopwatch walk-through by a non-owner ≤ 15 min including logging; every screen operable with one thumb. |
| Projector | 1080p screen at 3 m: card text readable (type-scale spot check); keyboard-only full run. |
| Omission drill | Only active-stage roles ever omitted (suite) + visual spot-check that omission renders read as "incomplete", not "broken". |
| SAP tie-in | Link opens `/survivability/`; grep proves no sap2 import; log row copy matches §5.3.4 verbatim. |

---

## 10. Phase plan TR0–TR5

Effort scale, branch discipline, descope-ladder rules, phase ritual, and DoD are
TIMBER-2 §7/§10's verbatim regime (one branch per phase; main always verify +
build:suite green; red-first tests on the branch; progress table updated in the
adopted plan doc; DECISIONS.md entries prefixed `TRAIN-1 TRn:`). A "session" = one
focused implementation session holding this document plus TIMBER2_PLAN.md.

**Progress table (implementing sessions update the repo copy):**

| Phase | Status | Gate | Ships |
|---|---|---|---|
| TR0 | not started | after T2 merged | compilers + suites, no UI |
| TR1 | not started | after T3 merged | flashcards, walkthrough, records skeleton, hub card |
| TR2 | not started | after TR1 | quizzes + drills (bom, cutlist) |
| TR3 | not started | after TR2 | printables + session sheet + export |
| TR4 | not started | after TR3 | hip-pocket + projector |
| TR5 | not started | after TR4 | omission drill + timed overlay + polish |

### TR0 — Compilers & gates (M; engine-only, zero UI change)

**Contents:** `src/timber/training/{labels,deck,curriculum,quiz,confusion,stageNotes}.ts`
(labels relocation per TR-D2 with UI re-export); `ThumbOpts` additive extension to
`thumbnails.ts` + `test/goldens/train/` + `npm run update:train-goldens`; suites
`timber2-train-deck|curriculum|quiz` + gate tests G-TR-1/G-TR-2 + wordlist-glob
meta-test.
**Acceptance:** all TI invariants green; every catalog preset compiles a deck;
TIMBER-2 thumb goldens byte-identical with opts omitted; verify + build:suite green;
deployed toolkit byte-identical (no UI shipped).
**Descope ladder:** quiz.ts → TR2 start; deck/curriculum are the floor.
**START HERE:** read `src/timber/training/` does not exist — begin with the labels
relocation PR (smallest possible diff, DECISIONS.md entry, T3-coordination note),
then FIRST TEST red: `timber2-train-deck` "demo building compiles one card per role".
Trap: do not touch `walls.ts`/`floor.ts`/`roof.ts`; the compiler consumes models,
never generators.

### TR1 — Flashcards, walkthrough, records skeleton (L)

**Contents:** routes `#/train`, `#/train/deck/<id>`, `#/train/walk/<deckId>/<ordinal>`,
`#/train/records`; `cards.ts` (flip/swipe/requeue/stage filter); walkthrough surface;
`records.ts` store + envelope + posture copy; hub Training card; picker "Train" chip;
workbench "Practice this build"; SAP-2 external lesson row + log-row copy; happy-dom
smoke additions; `timber2-train-store` suite.
**Acceptance:** §9.3 flashcards + walkthrough rows; phone device pass recorded;
no-WebGL assert; a11y pass (flip button semantics, focus order, reduced-motion);
deploy green with check-offline/check-assets untouched.
**Descope ladder:** records page → TR3 (store logic itself is NOT cuttable — TR2
writes results); workbench chip → TR2; walkthrough "open in 3D" link → TR2.
Flashcards are the floor (owner-named).
**START HERE:** FIRST TEST red: happy-dom "#/train renders a deck list from the
catalog". Register routes through the T3 router's named injection point; store file
copies the T3 store's injected-storage pattern wholesale.

### TR2 — Quizzes & reading drills (M)

**Contents:** `quiz-ui.ts` (shared shell, quiz-id, quiz-place, drill-bom,
drill-cutlist); results → records; stage-sliced quiz entry from walkthrough;
remaining TR1 descopes.
**Acceptance:** §9.3 quiz + drill rows; golden quiz plan committed; requeue observed
in smoke; session record written once per logged run.
**Descope ladder:** drill-bom estimation pairs UI → TR3; quiz-place → TR3 if SVG
hit-testing drags (quiz-id is the floor).
**START HERE:** FIRST TEST red: `timber2-train-quiz` golden for (demo, seed 1).
Trap: hit areas reuse the `data-member` SVG group pattern from renderStrips — do not
invent a picking scheme.

### TR3 — Printables, session sheet, export (M)

**Contents:** `print-train.ts` (card sheets 2-up/4-up + duplex calibration card,
worksheets + answer keys, stage posters, session sheet); export
`.timber-training.json`; records page complete; `timber2-train-print` suite +
committed goldens.
**Acceptance:** §9.3 printables + records rows incl. the physical duplex print test
and the owner legibility judgment (named).
**Descope ladder:** posters → TR4; 2-up (keep 4-up) → TR4; worksheets and the
session sheet are the floor (squad-leader ask).
**START HERE:** FIRST TEST red: duplex mirror unit test. Build sheets as pure
SVG-string functions in `src/timber/training/` where possible (poster/worksheet
layout is pure geometry) so goldens run in node; `print-train.ts` only assembles
pages via the T3 print helpers.

### TR4 — Hip-pocket & projector (S–M)

**Contents:** `hip.ts` flow + HIP_BUDGET + 8 screen-kind script lines; projector
toggle + CSS class + keyboard map (inside T3 keyboard-guard rules); log screen.
**Acceptance:** §9.3 hip-pocket + projector rows (non-owner stopwatch walkthrough).
**Descope ladder:** projector → TR5; hip-pocket is the floor (the employment
context the owner described).
**START HERE:** FIRST TEST red: hipPocketPlan counts ≡ HIP_BUDGET. The flow is a
LessonSpec[] player over existing surfaces — if hip.ts exceeds ~200 lines,
something is being rebuilt that already exists; stop and compose.

### TR5 — Omission drill, timed overlay, polish (S)

**Contents:** drill-omission (ThumbOpts.omitIds path + active-stage restriction);
timed overlay + settings toggle (default off); (PH)-unlock plumbing visible
(`gradableDoctrine`); leftover descopes; docs as-built note in the adopted plan.
**Acceptance:** §9.3 omission + timed rows; full-suite green; every KEEP row of §8.1
either shipped or descoped with an owner-visible progress-table note.
**Descope ladder:** timed overlay first, omission second — TR5 entire is the first
thing to cut if TIMBER-2 phases need the sessions.
**START HERE:** FIRST TEST red: omission drill "omitted role ∈ active stage roles".

### 10.6 Files TR touches that TIMBER-2 phases also touch (collision map)

| File | TR change | Coordination |
|---|---|---|
| `src/ui/woodframe/router` (T3) | +`#/train/*` routes | named injection point; additive; unknown-route rule preserved |
| `src/ui/woodframe/labels.ts` (T3) | becomes re-export of `src/timber/training/labels.ts` | TR-D2 DECISIONS.md entry; I-14 test repointed |
| `src/timber/thumbnails.ts` (T2) | +ThumbOpts (default-off) | goldens byte-identical when omitted (TI-10) |
| `src/ui/woodframe/print.ts` (T3) | training pages registered | additive registry entries only |
| `src/ui/hub.html` | +Training card | copy-only |
| `package.json` | +`update:train-goldens` script | additive |

Everything else is new files. No TR phase edits `src/timber/{types,frame,floor,walls,
roof,elevation,bom}.ts`, no TR phase edits legacy tests, and no TR phase touches
`sap2/**` at all.

---

## 11. Decisions log (TR-D1..TR-D10)

| # | Decision | Rationale |
|---|---|---|
| TR-D1 | Training lives TIMBER-side (`src/timber/training` pure + `src/ui/woodframe/train` UI), mounted on the TIMBER-2 router; hub gets a deep-link card; nothing ships inside sap2/. | All training data is a timber-engine projection; TIMBER-2 already owns router/store/print/mobile rules; SAP-2 owns its own training story (Build Card deck). |
| TR-D2 | PLAIN/WHAT relocate to `src/timber/training/labels.ts` (pure data); `src/ui/woodframe/labels.ts` re-exports; I-14 lockstep test repointed. | The compiler is pure/node-tested and must not import a UI module; a re-export keeps every T3 import working — additive, no fork. |
| TR-D3 | Compile-not-author: the only authored training content is STAGE_NOTES (per StageKey) and CONFUSION_GROUPS (per MemberRole) + 8 screen-kind script lines — all closed-vocab, lockstep-tested. | Per-structure authored lessons would duplicate engine truth and rot; closed-vocab tables are bounded and mechanically complete. |
| TR-D4 | Numerics provenance rule (§2.3): N1 engine facts free, N2 doctrine strings display-only with "(PH)" while unverified and never graded, N3 record facts; zero SAP-2 numerals timber-side. | The single rule that makes training content legal under BOTH liability regimes; gate-testable (G-TR-1/G-TR-2). |
| TR-D5 | Man-hour estimation excluded from drills while labor rates are (PH); counts/stock are drillable engine facts. | Do not train Marines on placeholder magnitudes; unlocks mechanically with T8 labor verification. |
| TR-D6 | Error-spotting decided: omission drill only (member filtering, active-stage-restricted); wrong-placement fabrication REJECTED. | The engine can honestly render absence, never wrong doctrine; fabricated frames on doctrine-cited surfaces are the exact failure class both regimes exist to prevent. |
| TR-D7 | Quiz variety via explicit seeds (mulberry32, attempt number); all training outputs deterministic per (spec, seed). | Preserves the determinism non-negotiable and golden-testability while keeping retakes fresh. |
| TR-D8 | SAP-2 tie-in is link + qualitative log rows now; a SAP-side deck-rehearsal mode is recorded as a SAP-2 backlog suggestion (post-R3, inside FICT), not built here. | SAP-2's computeStages/deck are not yet in code; composing means waiting for the owner surface, not cloning it. |
| TR-D9 | SAP-2's recruit-copy allowlist/comprehension gates are NOT applied to timber cards; plain-first + WHAT lines + press-and-hold + attested-identity language ARE reused. | Timber training teaches trade vocabulary with an instructor present; the terms of art are the content. Borrow the proven interaction/honesty patterns, not the machinery built for a different audience and stake. |
| TR-D10 | Records: local-only, cap-500 with loud block, paper session sheet is the record of note, no import/merge, no profiles, passBar never locks content. | Privacy posture and unit reality; the app is a convenience buffer for a filed paper artifact. |

---

## 12. Open risks

| # | Risk | Detection | Mitigation |
|---|---|---|---|
| TR-R1 | TIMBER-2 T2/T3 slip and training has no substrate | progress table | TR phases are strictly gated (§2.4); no TIMBER-1 fork is permitted; the training plan waits rather than forks. |
| TR-R2 | Thumbnail highlight legibility poor on small SVGs (dense frames) | TR0 goldens + TR1 device pass | Pre-agreed fallback (mirrors T3's): highlighted members also render a halo rect + the rest drops to 40% stroke; if still poor, card fronts fall back to a per-stage crop (stageOrdinal render) which is always sparser. |
| TR-R3 | Deck compile cost on big T6 two-story models | perf asserts (TR0) | thumbLod default already drops coverings; memoization by spec fingerprint; budget test fails before users feel it. |
| TR-R4 | Session-sheet names create an unexpected records/privacy question (unit policy) | owner/counsel review of §7.3 copy | Posture printed on the sheet; names optional everywhere; single-button clear; flag to the SAP-2 counsel-review list (its item 6 covers identity capture — training sheet joins that review). |
| TR-R5 | Instructors want scores to gate content ("lock run until crawl passed") | feature requests | Refused by TR-D10; the curriculum ORDER already encodes progression; gating is the instructor's call, not the tool's. |
| TR-R6 | Print variance across printers breaks duplex alignment | physical test at TR3 | Calibration card ships on every run; margins conservative (0.5 in); no full-bleed anywhere (SAP-2 field-constraint precedent). |
| TR-R7 | Training surfaces drift from studio truth after later TIMBER-2 phases | TI-9 auto-breadth + goldens | Suites iterate the live catalog; any family/stage change that breaks a lesson breaks CI the same day. |

*End of design. Implementing sessions: confirm T2 (for TR0) or T3 (for TR1) is merged
and green on main, then start at §10's TR0 START HERE.*
