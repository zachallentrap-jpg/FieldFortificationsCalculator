# FLASHCARD SYSTEM DESIGN — the see-it-flip-it component trainer (TIMBER + SAP-2)

> **Status:** Commissioned design for the cross-app flashcard/quiz trainer. PLAN ONLY —
> implementing sessions execute phases F0–F4 without the planner present. Quality bar and
> conventions: `docs/TIMBER2_PLAN.md`. Where this document and either governing plan
> (`docs/TIMBER2_PLAN.md`, `docs/SAP2_BLUEPRINT.md`) disagree, THE GOVERNING PLANS WIN and
> the conflict is a defect in this document to be logged in DECISIONS.md.
>
> **Ground truth (verified 2026-08-02):**
> `src/timber/types.ts` (Member: role/nominal/cutLength/stage/nailing/doctrineRef "(PH)"),
> `src/timber/frame.ts` (generateFrame → FrameModel), `src/timber/bom.ts`,
> `src/ui/woodframe-scene.ts` (PLAIN/WHAT dictionaries lines 44–87, member card, stage
> scrubber, tint() highlight, raycast pick), `docs/TIMBER2_PLAN.md` (T0–T8; §3.7 binding
> shapes; §4.3 camera rigs; §4.4 runtime SVG thumbnails; §5 routes `#/`+`#/build/<id>`,
> localStorage `timber2-session`), `docs/SAP2_BLUEPRINT.md` (§2.4 fill classes + FICT,
> §2.7 watermark states, §3 Build Card deck, §7 R0–R8), `sap2/src/schema/watermark.ts`
> (watermarkState + artifactPolicy), `sap2/src/engine/compute.ts` (Result, DimSpec,
> coneLeafIds), `sap2/src/schema/leaves/positions.ts` (POSITION_STRUCTURE + plainName
> leaves), `sap2/src/render/{drawPlan,drawSection,precision}.ts` (display(), token path),
> `sap2/test/gates/*` (G-2 AST number lint, G-11 emptiness), `scripts/build-suite.mjs`
> (hub `/`, TIMBER `/woodframe.html`, SAP-2 `/survivability/`), `src/ui/hub.html`.
> SAP-2 status: R0 complete (11/11 tasks); `sap2/src/scene/` and `render/print/` are
> EMPTY — build cards and scene descriptors are R2a/R2b work, not yet built.
> `sap2/src/schema/callouts.ts` does NOT exist yet (blueprint names it; §3.5 makes it
> the naming authority) — see FD12.

---

## 0. Owner's mandate → testable requirements

| # | Mandate (verbatim intent) | Requirement | Where |
|---|---|---|---|
| M1 | "Individual components can be viewed as training or teaching aids in a flash-card quizlet style — see the thing, then flip to reveal the answer." Works SUPER WELL on mobile and desktop. | Flip deck compiled from each app's engine; card front = the component highlighted IN its structure; back = name/plain/purpose/where + regime-safe facts. One-handed portrait spec §7; keyboard map for desktop. | §3, §5.1, §7 |
| M2 | "Find the best ways we can use this for training" — creative, exhaustive, honest. | Four quiz modes (§5) with a ship order and an explicit considered-and-rejected list (§11) — every rejection has a stated reason, several on regime grounds. | §5, §11 |
| M3 | Train on the real thing (the same mandate that produced the command packet): the tool teaches the structure you configured. | THE KILLER FEATURE (§8.4): decks compile from the user's OWN spec/Result — same spec hash that generates the cut list generates the cards. Stated as a requirement with a test (FT-I5). | §8.4 |
| M4 | Plan is the deliverable; other sessions implement phase-by-phase. | Phases F0–F4 (§9) with exact files, signatures, named suites, acceptance criteria, and explicit dependency rows against TIMBER-2 T0–T8 and SAP-2 R0–R8. | §9 |

**Non-negotiables inherited (every phase, no exceptions):** fully offline, zero external
requests; zero new runtime deps; deterministic outputs; one toolkit deploy
(`npm run build:suite` green); no new dist asset files (check-assets allowlist stays);
no accounts, no telemetry — all progress data local-only; TIMBER's legacy test suites
immutable; SAP-2's ship-empty regime intact (the trainer must be USEFUL in TEMPLATE
mode with zero digits anywhere — that is a feature, not a limitation: component
identity is qualitative and free in both regimes).

---

## 1. Architecture: twin cores, one spec (FD1)

The two apps deliberately do not share source: `sap2/` is self-contained by blueprint
N1 (own package, pinned toolchain, own CI); the root tree builds TIMBER. A shared
runtime package would break that containment and add a build seam to the deploy that
already OOM'd once. Therefore:

- **One spec module, two byte-identical copies.** All shared shapes and the entire
  scheduler live in ONE dependency-free file `trainCore.ts` (zero imports, zero DOM,
  zero `Date`, zero `Math.random`). Copies live at
  `src/ui/woodframe/train/trainCore.ts` and `sap2/src/train/trainCore.ts`.
  A ROOT-level test (`test/train-sync.test.ts`) asserts the two files are
  byte-identical — drift is loud, coupling is zero. Same pattern class as TIMBER-2's
  I-14 "dictionaries in lockstep".
- **Per-app compilers and views.** Deck compilation, art, and DOM are app-specific,
  because each side's regime and render stack is different by design.
- **Pure-first, same as both plans:** compilers, scheduler, quiz logic, and hit-test
  math are pure node-tested modules; DOM lives in thin view files (TIMBER-2 §8 runner
  posture; SAP-2 retained-DOM region posture).

**The one-sentence data rule (FD2):** a card is a PROJECTION of the engine —
`Member[]`+dictionaries on TIMBER, `Result`+registry on SAP-2 — compiled at runtime.
No hand-authored card files exist; content cannot drift from the engines because it has
no independent existence.

---

## 2. Shared shapes — `trainCore.ts` (binding)

```ts
// trainCore.ts — SHARED SPEC MODULE. Byte-identical copies at
//   src/ui/woodframe/train/trainCore.ts   and   sap2/src/train/trainCore.ts
// (test/train-sync.test.ts asserts equality). Zero imports. Zero DOM. Zero Date /
// Math.random / network — the FT-I2 lint enforces this. Pure shapes + pure scheduler.

export type TrainApp = 'timber' | 'sap2';

/** The regime a compiled deck renders under. Derivation is per-app (§4). */
export type DeckRegime =
  | 'timber-ph'      // TIMBER: numbers allowed; every doctrine fact cited verbatim incl. "(PH)"
  | 'sap-template'   // SAP-2, no fill: qualitative + ⟨tokens⟩ ONLY — zero digits (gate G-17)
  | 'sap-training'   // SAP-2, TRAINING/TEST fill: every numeral carries FICT
  | 'sap-doctrine';  // SAP-2, DOCTRINE fill: real numbers; deck carries the watermark banner

export interface CitedFact {
  label: string;                 // 'Size' | 'Nailing' | 'Spacing' | 'Count' | 'How many' | 'How deep' ...
  text: string;                  // '2x4' | '2-16d toenail ea end' | '⟨how deep you dig⟩' | '3.5 ft FICT'
  source: 'doctrine' | 'this-build' | 'fill';
  cite?: string;                 // REQUIRED when source === 'doctrine' (TIMBER doctrineRef VERBATIM)
  lifeSafety?: boolean;          // renders the LS badge (TIMBER LS-GATE roles only)
}

export interface SceneHighlight {
  memberIds: readonly string[];  // TIMBER: EVERY member of the subject role; SAP-2: callout region ids
  stageOrdinal: number;          // render the model through this stage (FD4 — never occluded)
  view: string;                  // camera preset name (F0: one of the 7 VIEWS; F2+: FamilyDef CardViewSpec ref)
  cutaway: { axis: 'x' | 'y' | 'z'; frac: number } | null;  // reuse cutPlaneEq semantics (TIMBER-2 §4.2)
}

export type CardArt =
  | { kind: 'svg'; svg: string }               // deterministic bytes — golden-testable, printable, offline
  | { kind: 'scene'; scene: SceneHighlight };  // live-viewer descriptor; determinism asserted at the
                                               // DESCRIPTOR level (same stance as SAP-2 N3 for 3D raster)

export interface CardFront {
  art: CardArt;
  prompt?: string;               // ≤ 60 chars, plain register; e.g. 'What is the glowing piece?'
}

export interface CardBack {
  name: string;                  // canonical name: PLAIN[role] / ComponentEntry.name
  plain: string;                 // one-line what-it-does: WHAT[role] / ComponentEntry.purpose
  whereItGoes: string;           // derived location sentence: stage + wall/feature (§3.2/§3.3)
  facts: readonly CitedFact[];   // regime-filtered UPSTREAM by the compiler — views never filter
}

export type QuizMode = 'flip' | 'identify' | 'name-to-part' | 'stage-order';

export type CardSubject =
  | { kind: 'member-role'; role: string; exemplarMemberId: string }   // TIMBER
  | { kind: 'component'; componentId: string };                        // SAP-2

export interface CardSpec {
  id: string;                    // STABLE progress key: 'role:<role>' | 'component:<componentId>'
  deckId: string;
  subject: CardSubject;
  front: CardFront;
  back: CardBack;
  modes: readonly QuizMode[];    // which quiz modes may draw this card
}

export interface StageDrillEntry { ordinal: number; label: string; detail?: string }

export interface DeckSpec {
  id: string;                    // STABLE progress key (FD9): 'timber:<entryId|familyId>' | 'sap2:<positionId>'
  app: TrainApp;
  title: string;                 // 'Your build — <label>' | FamilyDef name | positionLabel
  regime: DeckRegime;
  cards: readonly CardSpec[];    // teaching order: (min stage of subject) asc, then back.name asc
  stageDrill: readonly StageDrillEntry[];  // source for stage-order mode; [] when unavailable
  compiledFrom: {                // provenance ONLY — never part of any progress key
    specHash?: string;                                        // TIMBER canonicalizeSpec hash (F2+)
    fillIdentity?: { cls: string; contentHash: string } | null;  // SAP-2 Result.fillIdentity
  };
}

// ── Scheduler: Leitner-by-session (FD7) ─────────────────────────────────────────
export type Box = 0 | 1 | 2;   // 0 = learning, 1 = known (recent), 2 = known (settled)
export interface CardProgress { box: Box; lastSession: number; lapses: number; seen: number }
export interface DeckProgress { session: number; cards: Record<string, CardProgress> }

/** Review cadence in SESSIONS, not wall-clock days: box 0 every session, box 1 every
 *  2nd, box 2 every 4th. Clock-free by design — field sessions are irregular, the
 *  scheduler must be deterministic, and neither app is allowed hidden time state. */
export const DUE_EVERY: Readonly<Record<Box, number>> = { 0: 1, 1: 2, 2: 4 };

export const emptyProgress = (): DeckProgress => ({ session: 0, cards: {} });

/** got=true: box min(box+1, 2). got=false: box 0, lapses+1. Pure — returns a new object. */
export function mark(p: DeckProgress, cardId: string, got: boolean): DeckProgress;

/** Cards due this session: unseen cards first IN DECK (teaching) ORDER, then seen cards
 *  where p.session - lastSession >= DUE_EVERY[box], shuffled by mulberry32(seed).
 *  cap defaults to 20. Pure and deterministic for a given (deck, p, seed). */
export function buildSession(deck: DeckSpec, p: DeckProgress, seed: number, cap?: number): readonly string[];

/** Ends a session: increments p.session. Called once when the queue empties or the
 *  user exits with >= 1 mark recorded (abandoned zero-mark sessions do not advance). */
export function sealSession(p: DeckProgress): DeckProgress;

export function deckMastery(deck: DeckSpec, p: DeckProgress): { known: number; learning: number; unseen: number; total: number };
// known = box 2, learning = box 0|1 seen.

/** Deterministic distractor roles/components for identify mode: N picks from the deck's
 *  other cards, seeded by fnv1a(cardId) ^ sessionSeed, de-duplicated by back.name,
 *  same-stage subjects preferred (they are the confusable ones — that is the pedagogy). */
export function pickDistractors(deck: DeckSpec, cardId: string, n: number, seed: number): readonly string[];

export function mulberry32(seed: number): () => number;   // repo-precedent PRNG (test/fuzz.test.ts)
export function fnv1a(s: string): number;                 // stable string hash for seeds
```

Notes:
- `mark`/`buildSession`/`sealSession` are pure; views hold state in a versioned
  envelope (§6.2) and persist through an injected storage handle (TIMBER-2 store
  pattern / SAP-2 `state/env.ts` pattern) so everything node-tests without a DOM.
- `CardSpec.id` deliberately does NOT include the deck's spec hash — progress keys on
  the SUBJECT (`role:stud`, `component:grenade-sump`) so editing a spec never wipes
  mastery (FD9, test FT-I5).

---

## 3. Deck compilation — cards derive from the engines

### 3.1 TIMBER compiler (`src/ui/woodframe/train/compile.ts` — pure, node-tested)

```ts
import type { Member } from '../../../timber/types';
import type { DeckSpec, StageDrillEntry } from './trainCore';

export interface TimberDeckInput {
  deckId: string;                       // stable key (FD9): 'timber:demo' | 'timber:<familyId>' | 'timber:<entryId>'
  title: string;
  members: readonly Member[];           // FrameModel.members (F0) or StructureModel.members (F2+)
  stagePlan: readonly StageDrillEntry[];// F0: STAGES mapped {ordinal:id,label:name}; F2+: model.stagePlan
  labels: { PLAIN: Readonly<Record<string, string>>; WHAT: Readonly<Record<string, string>> };
  spacing?: { studSpacingIn?: number; joistSpacingIn?: number; rafterSpacingIn?: number };  // this-build facts
  lsRoles?: ReadonlySet<string>;        // roles whose sizing doctrine is LS-tagged (T4+; empty before)
  cardView?: string;                    // FamilyDef.CardViewSpec name (F2+); default 'Iso SE'
  specHash?: string;                    // provenance only
}

export function compileTimberDeck(input: TimberDeckInput): DeckSpec;
```

**Compile rules (normative — each is a test case in `train-cards.test.ts`):**

1. **One card per DISTINCT role present in `members`** (never per member). Card id =
   `role:<role>`. Teaching order: min stage of the role asc, then `PLAIN[role]` asc.
2. **Exemplar rule (FD5, deterministic):** among the role's members, take those of the
   MODAL nominal (tie → lexicographically smallest nominal), then the smallest `id`
   by string compare. The exemplar supplies nominal/nailing/doctrineRef and anchors
   the camera framing.
3. **Front:** `art = { kind:'scene', scene: { memberIds: ALL member ids of the role,
   stageOrdinal: min stage of the role, view: input.cardView ?? 'Iso SE', cutaway:
   null } }` (F2 adds per-family cutaway for interior roles — §3.4). `prompt =
   'What is the glowing piece?'` on flip cards (identify mode supplies its own).
   Highlighting EVERY member of the role (not just the exemplar) teaches the pattern —
   you see all 26 studs light up, which IS the lesson about what a stud is.
4. **Back:**
   - `name = PLAIN[role] ?? role`; `plain = WHAT[role] ?? ''` (compile emits a
     `MissingLabel` issue if either dictionary misses a present role — sync-tested,
     extends TIMBER-2 I-14).
   - `whereItGoes`: `` `Stage ${minStage} — ${stageLabel}` `` plus a wall clause
     derived from `Member.wall` (`'south wall'` when all one wall, `'all four walls'`,
     `'roof'` for no-wall roof stages, `'floor system'`, …) — a pure lookup table
     `whereClause(role, members)` with its own table test.
   - `facts` (order fixed):
     - `Size` — `{ text: exemplar.nominal, source:'doctrine', cite: exemplar.doctrineRef,
       lifeSafety: lsRoles.has(role) }`.
     - `Nailing` — `{ text: exemplar.nailing, source:'doctrine', cite: exemplar.doctrineRef }`.
     - `Spacing` — only for role ∈ {stud, joist, rafter} and the matching spacing given:
       `{ text: `every ${n} in`, source:'this-build' }` (a user configuration, so NO
       cite — the source tag is the honesty mechanism, rule TR-5).
     - `Count` — `{ text: `${count} in this build`, source:'this-build' }`.
5. **modes:** every role card gets `['flip','identify','name-to-part']`.
6. **stageDrill:** `input.stagePlan` verbatim, filtered to stages that have members
   (same rule the scrubber uses today, woodframe-scene.ts line 458).
7. **regime:** `'timber-ph'` always.
8. Deck compilation is PURE and deterministic: same input → deep-equal `DeckSpec`
   (FT-I3); compile of the demo building < 50 ms warmed mean (house perf pattern,
   TIMBER-2 §8.8).

**Why role-level cards and not member-level:** the teaching unit is the ROLE (what is
a cripple), not the instance (S-cripple-014). Counts, the highlight-all rule, and
name-to-part's accept-any-member rule (§5.3) all follow from this.

### 3.2 SAP-2 component registry (`sap2/src/schema/callouts.ts` — FD12)

The blueprint already names this file as "the single callout/legend registry (the
naming authority for every surface: 2D, cards, 3D labels, BOM, a11y)" (§3.5). It does
not exist yet; **F1 creates it at its blueprint-designated home with its
blueprint-designated role**, and R2a's Build Card deck then consumes it — the trainer
builds a piece the blueprint already owes, it does not fork one.

```ts
// sap2/src/schema/callouts.ts — data only. Names and QUALITATIVE copy. No magnitudes
// (G-2 scope extends here with an empty structural budget). Copy passes the recruit
// copy gates: word-allowlist, zero digits, zero number-words (§3.8 G-16 class).
import type { PositionStructure } from './leaves/positions';

export type ComponentPresence =
  | 'always' | 'hasFiringPlatform' | 'storageCompartment' | 'sectorsOfFire'
  | 'earthCover'         // Result.cover.kind === 'earthCover'
  | 'revetted'           // inputs.revetment !== 'none'
  | 'vehicle' | 'atgm';  // position-family flags

export interface ComponentEntry {
  id: string;            // 'fighting-bay' | 'parapet' | 'grenade-sump' | 'elbow-rest' |
                         // 'sector-stakes' | 'firing-platform' | 'storage-compartment' |
                         // 'overhead-cover' | 'revetment' | 'camouflage' | 'frontal-berm' |
                         // 'backblast-area'
  name: string;          // NCO register: 'Parapet'
  plainName: string;     // recruit register: 'the dirt wall up front'
  purpose: string;       // 1–2 sentences, QUALITATIVE ONLY (identity is free in every regime)
  where: string;         // qualitative location: 'Dug into the floor at the low corner of the hole.'
  presence: ComponentPresence;
  countLeafOf?: (p: PositionStructure['id']) => string;  // e.g. sumpCountId — the regime-safe number hook
  dimLeafOf?: (p: PositionStructure['id']) => readonly { label: string; leafId: string }[];
}

export const COMPONENTS: readonly ComponentEntry[];
```

Initial registry (one_man ships 8 of these; presence flags gate the rest):
`fighting-bay` (always), `parapet` (always), `grenade-sump` (always; count leaf
`sumpCountId`), `elbow-rest` (always; count leaf `elbowHolesId`), `sector-stakes`
(sectorsOfFire), `camouflage` (always), `overhead-cover` (earthCover), `revetment`
(revetted), `firing-platform` (hasFiringPlatform; dims `platformId L/W/depthBelowHole`),
`storage-compartment` (storageCompartment), `frontal-berm` (vehicle; dim
`VEHICLE_BERM_HEIGHT_ID`), `backblast-area` (atgm; dim `BACKBLAST_CLEARANCE_ID`).

The `purpose`/`where` strings are the only AUTHORED training copy in the system. They
are qualitative by rule (SR-5 gates them), they go through the same counsel-review
scope as other recruit copy (§2.9 flag 8), and R2a reuses them.

### 3.3 SAP-2 compiler (`sap2/src/train/compile.ts` — pure)

```ts
import type { Result } from '../engine/compute';
import type { WatermarkState } from '../schema/watermark';
import type { ComponentEntry } from '../schema/callouts';
import type { DeckSpec, StageDrillEntry } from './trainCore';

export interface SapDeckInput {
  result: Result;                            // current inputs' compute — TEMPLATE ok (fill null)
  watermark: WatermarkState;
  components: readonly ComponentEntry[];     // COMPONENTS registry
  stageLines?: readonly StageDrillEntry[];   // R2a STAGE_ORDER verb lines; omit before R2a
}

export function compileSapDeck(input: SapDeckInput): DeckSpec;
```

**Compile rules (normative — tests in `sap2/test/train.test.ts`):**

1. `deckId = 'sap2:' + result.inputs.position` (FD9 — soil/threat/standard changes do
   NOT reset progress; they change fact values, not component identity).
2. **One card per ComponentEntry whose `presence` predicate holds** for
   (`POSITION_STRUCTURE` row, `Result`). Card id = `component:<id>`. Order: fixed
   registry order (it is authored in build order).
3. **Front:** F1 art = `{ kind:'svg', svg }` — `drawPlan`/`drawSection` re-rendered
   with a new `RenderCtx.highlightComponentId` (§3.5); plan for plan-visible
   components (parapet, sump, sectors, berm), section for depth-visible ones
   (fighting-bay, overhead-cover, revetment, firing platform). The mapping is a
   column in the registry test table.
4. **Back:**
   - `name`, `plain = purpose`, `whereItGoes = where` — registry verbatim.
   - `facts`: for `countLeafOf`/`dimLeafOf` entries, resolve the leaf THROUGH THE
     ENGINE'S OWN PATH: values come from `Result` quantities where the engine already
     computed them, else `resolve(view, leaf)` on the same fill — and format with
     `render/precision.display(q, plainName)` — the exact formatter the drawings use.
     `display` returns the ⟨token⟩ when unfilled and the numeral when filled;
     the compiler then applies `artifactPolicy(watermark).fictSuffixOnNumerals` to
     append ` FICT`. **Numbers on cards are inherited from the render path, never
     re-implemented** (FD6) — that single fact makes rules SR-1..SR-3 cheap to test.
   - fact `source: 'fill'` always on SAP-2 (there is no other number source by regime).
5. **modes:** `['flip','identify']` (name-to-part joins in F3 with tappable callout
   regions); stage cards none — `stageDrill` = `input.stageLines ?? []`.
6. **regime** (FD6):
   ```ts
   const regime: DeckRegime =
     watermark.state === 'TEMPLATE' ? 'sap-template'
     : watermark.state === 'TRAINING' ? 'sap-training'
     : 'sap-doctrine';   // FILLED_UNCOMMISSIONED | COMMISSIONED | STALE — banner says which
   ```
   The deck header ALWAYS renders the same watermark banner component the drawings
   render (state text + sub-reason). TEST-class fills land in `'sap-training'` via the
   watermark floor (watermark.ts line 63) — CI compiles decks from TEST fills exactly
   as the other gates do.
7. Deck compiles in TEMPLATE mode with zero fill — the trainer works on DAY ZERO of a
   ship-empty install. That is the pitch line for the SAP-2 card: identity first,
   numbers when your unit's fill earns them.

### 3.4 The picture pipeline (deterministic, offline — FD3, FD4)

**FD4 — the stage-slice rule (both apps):** card art renders the structure THROUGH THE
SUBJECT'S INSTALL STAGE (`SceneHighlight.stageOrdinal` = the role's min stage). Members
of later stages do not exist yet, so the highlighted piece is never occluded by
sheathing/siding/cover — the same trick the stage scrubber already plays
(woodframe-scene.ts `rebuild()` line 250). Interior-but-same-stage cases (basement
girder under joists) additionally get the family's `CutawaySpec` axis at frac 0.5
(TIMBER-2 §4.2) — a per-role `needsCutaway` column in the compile table, owner-judged
at F2 acceptance like thumb legibility (TIMBER-2 §4.4).

**TIMBER art has two renderers, one descriptor:**
- **Primary (F0): the live viewer.** The card front IS the 3D scene: the view code
  applies `SceneHighlight` by setting the stage (existing `setStage`), tinting the
  subject's members with the existing selection tint (`tint(p, 0xff8844)`), and
  framing via the named view (F0: the 7 `VIEWS`; F2+: `cameraRigFor(model)` +
  `CardViewSpec`). Zero new art pipeline before T2 exists; the user can ORBIT the
  card front — see-it beats thumbnail-it. Determinism claim: at the DESCRIPTOR level
  (the `SceneHighlight` JSON is golden-tested; GPU pixels are outside the byte claim —
  the exact stance SAP-2 N3 takes for 3D).
- **Secondary (F2): compiled SVG** for deck-list previews, print, and goldens —
  `src/ui/woodframe/train/art.ts` exporting
  `cardArt(model: StructureModel, h: SceneHighlight): string`, implemented as an
  EXTENSION of T2's `thumbnails.ts` (same precomputed yaw/pitch basis, same thumbLod
  pruning for context members, plus: context members stroke-only at 40% ink,
  highlighted members heavy stroke + translucent fill + halo). Budgets and golden
  policy identical to thumbs (< 140 KB, < 25 ms node, committed FULL SVG files under
  `test/goldens/cards/`, structural asserts independent of the golden compare,
  same-PR update rule via `npm run update:card-goldens`).

**SAP-2 art is 2D SVG from day one** — mirroring the blueprint's own R2a decision
("build cards illustrated by 2D cuts"; 3D hero art "only when ready", R2b). F1 adds
one field to `RenderCtx`:

```ts
// sap2/src/render/drawSection.ts (RenderCtx home)
export interface RenderCtx {
  theme: Theme;
  watermark: WatermarkState;
  highlightComponentId?: string;   // NEW — when set, the named component's geometry
                                   // renders with the highlight treatment (3px stroke,
                                   // halo, label chip) and everything else at 55% ink.
                                   // Unknown id = no-op (renders base drawing).
}
```

`drawPlan`/`drawSection` learn a small internal map componentId → the shapes they
already draw (floor rect, batter ring, band, …); components they cannot yet draw
(grenade sump before its geometry exists in the drawings) fall back to base drawing +
a text chip `shown after the next drawing update` — an HONEST fallback listed in the
registry table and burned down as R2a adds geometry. Highlighted renders stay pure
functions of `(Result, RenderCtx)` → deterministic bytes → goldens via the existing
`sap2/scripts/gen-goldens.ts` path.

### 3.5 Front/back content contract (binding)

- FRONT shows: art + optional one-line prompt. NEVER the name, never a fact (the gate
  test scans front content for back.name — FT-I4.6).
- BACK shows, in order: `name` (big), `plain` (the what-it-does line), `whereItGoes`,
  then `facts` as label:value rows with cite lines in small type under doctrine facts
  and a `this build` chip on configuration facts. TIMBER LS facts render the LS badge
  and the "(PH — LIFE-SAFETY, review required)" suffix VERBATIM when present in the
  cite (same emit-time suffix as member cards, TIMBER-2 §6.2).
- SAP-2 deck header: watermark banner always; TIMBER deck header: the standing "(PH)"
  footnote line ("(PH) = manual page check still pending" — same copy as the picker
  footnote, TIMBER-2 §5.2).
- Card ordinal ("4 / 17") is SHELL chrome, not card content — this keeps rule SR-1's
  "zero digits in TEMPLATE card content" clean while the shell stays navigable.

---

## 4. Regime safety — the testable rules

Component IDENTITY (names, plain lines, purposes, where-it-goes, what-nails-to-what
as prose) is qualitative and free in BOTH apps. NUMBERS follow each app's regime:

**TIMBER (`timber-ph` decks):**
- **TR-1 (cite completeness):** every `CitedFact` with `source:'doctrine'` has a
  non-empty `cite`. Test: compile decks for the demo building + the timber-features
  option matrix (F2: + every catalog preset); assert over every card.
- **TR-2 ((PH) fidelity):** doctrine fact cites are the exemplar's `doctrineRef`
  BYTE-FOR-BYTE — never summarized — so "(PH)" and the LS suffix survive by
  construction. Test: for each card, `facts.Size.cite === exemplar.doctrineRef`.
- **TR-3 (LS badge):** `lsRoles` members carry `lifeSafety:true` on the Size fact and
  the view renders the badge (happy-dom assert). Wired to `lifeSafetyRegister()` at
  T4+ (single source, TIMBER-2 §6.2); empty set before T4.
- **TR-4 (no invented numbers):** train modules contain no numeric doctrine literals —
  `timber2-number-free` scope extends over `src/ui/woodframe/train/**` (pre-T1: a
  local digit-literal scan with an allowlist {0, 1, 2, layout constants} inside
  `train-cards.test.ts`). Every number on a card arrived inside a `Member` or the spec.
- **TR-5 (source honesty):** facts from the user's configuration carry
  `source:'this-build'` and render the `this build` chip, never a cite. Test: spacing
  and count facts assert the tag; a doctrine fact without cite OR a this-build fact
  WITH cite fails compile (compiler throws — malformed decks are unrepresentable).

**SAP-2 (`sap-*` decks):**
- **SR-1 (TEMPLATE zero-digit gate — G-17):** for a deck compiled with `fill === null`:
  `cardTextCorpus(deck)` (= every title, prompt, name, plain, whereItGoes, fact label
  + text, stageDrill label) contains NO character in [0-9]; every `art.svg`'s `<text>`
  node contents contain no digit (attribute coordinates exempt — the exact posture of
  the existing template gates). Named `sap2/test/gates/g17-train-regime.test.ts`.
- **SR-2 (TRAINING FICT):** deck compiled from a TEST-class fixture fill (watermark
  floor → TRAINING): every `fact.text` matching `/\d/` also matches `/\bFICT\b/`; the
  deck banner reads TRAINING. Same gate file.
- **SR-3 (doctrine passthrough, projection fidelity):** with a DOCTRINE fixture fill
  (test-only; G-11 keeps dist fill-free), each numeric fact equals
  `display(q, token).text` for the same leaf/quantity — cards can never disagree with
  the drawings because they render the same formatter output (FD6).
- **SR-4 (banner):** deck header watermark banner state === `watermarkState(inputs)`
  for the deck's position, all five states exercised (happy-dom).
- **SR-5 (qualitative copy gates):** every `ComponentEntry.name/plainName/purpose/where`
  passes: zero digits, zero number-words (one..hundred, half, quarter — reuse the
  §3.8 gate-2 list), word-allowlist when G-16 stands up fully (until then: the digit +
  number-word half runs in `sap2/test/schema-integrity.test.ts`).
- **SR-6 (progress export is value-free):** `DeckProgress`/`TrainState` contain only
  ids and counters BY CONSTRUCTION (no field can hold a leaf value); the export test
  serializes a progress file built from a DOCTRINE fixture session and asserts the
  known-answer fixture values appear nowhere in it.
- **SR-7 (no numeric drills):** no quiz mode may ASK for a magnitude as an answer in
  any SAP-2 regime (see §11's rejection — memorizing operator-fill values is contrary
  to the verify-against-pub posture). Structural: no such mode exists; the rule is
  recorded so a future mode proposal hits it.

**Cross-app:**
- **XR-1:** trainer state lives in per-app localStorage keys (`timber2-train`,
  `sap2.train.v1`) — never inside fill files, never inside `timber2-session` specs,
  never in exports of either app's artifacts.
- **XR-2:** no mixed-app decks (FD10) — regimes never share a screen.

---

## 5. Quiz modes — interaction specs and ship order

| Mode | What it drills | Ships | Apps |
|---|---|---|---|
| M-1 FLIP | recognition + recall (the owner's verbatim ask) | F0 (TIMBER), F1 (SAP-2) | both |
| M-2 IDENTIFY-IN-SCENE | recognition under choice pressure | F2 (TIMBER), F3 (SAP-2) | both |
| M-3 NAME-TO-PART | production — the NCO's "go point at it" | F2 (TIMBER), F3+ (SAP-2, callout regions) | both |
| M-4 STAGE-ORDER | build sequence / priorities of work | F2 (TIMBER, stagePlan), F3 (SAP-2, gated on R2a STAGE_ORDER) | both |

Ship-order rationale: M-1 is the mandate and is useful with zero quiz logic; M-3 is
the highest training value (it is the field task) but needs pick plumbing; M-4 on
SAP-2 waits for R2a because the seven stage verb lines are R2a deliverables and the
deck "may never suppress or insert stages relative to the StagePlan" (§3.1) — the
drill must consume `computeStages`, not a hand list.

### 5.1 M-1 FLIP — two sub-modes

- **Browse** (no scheduler): ‹ › navigation through the deck in teaching order; tap
  card (or Space) flips; position chip "4 / 17". For reference/classroom walk-through.
- **Drill** (scheduler on): queue from `buildSession`. States:
  `PROMPT --flip--> REVEALED --mark(got|again)--> next`. After the last card:
  session summary (n got / n again — shown once, DISCARDED, §6.3) and `sealSession`.
- Marks: [Again] (left) and [Got it] (right) buttons, visible whenever REVEALED —
  gestures are shortcuts, buttons are the contract (§7).

### 5.2 M-2 IDENTIFY-IN-SCENE

- Scene per the card's `SceneHighlight` (TIMBER live viewer; SAP-2 highlighted 2D SVG).
  Subject glows: 1.2 s pulse loop; `prefers-reduced-motion` → steady bright tint +
  outline, no pulse.
- Four choice chips (2×2 grid, bottom thumb zone): the correct `back.name` + 3
  `pickDistractors` names (deterministic, §2). Chip order shuffled by the same seed.
- Tap correct → chip turns confirm-style + "✓" and the BACK CONTENT slides up
  (identify always teaches after answering); auto-advance after 900 ms, tap anywhere
  to skip the wait. Marks `got`.
- Tap wrong → that chip dims + shakes (reduced-motion: dims only) and STAYS (one
  retry); a second wrong reveals the correct chip + back content; marks `again`.
- Keyboard: 1–4 select; N/→ next after resolution.

### 5.3 M-3 NAME-TO-PART

- Prompt bar (top): "Tap a **collar tie**" (plain name, bold).
- TIMBER: raycast pick on the live scene (existing click handler pattern,
  woodframe-scene.ts line 259). **Any member of the target role counts** — the unit
  of knowledge is the role (§3.1). Hit logic is a pure function
  `judgeTap(model, role, memberId) → 'hit' | { miss: roleTapped }`, node-tested.
- Miss 1: the tapped member's own name flashes in the prompt bar ("that's a **rafter**")
  — a miss still teaches. Miss 2: the target role glows for 800 ms, then unglows
  ("watch, then find another one" — at least one un-glowed member must remain
  tappable; if the role has a single member the glow IS the reveal). Miss 3: full
  reveal + back content; marks `again`. Hit before that: marks `got` (hit after the
  glow hint still counts `got` — the hint is pedagogy, not failure).
- SAP-2 (F3+): tap targets are the highlighted-component regions of the 2D SVG
  (each component's shape group carries `data-component`; ≥ 44 px effective hit area
  via transparent padding rects, test-asserted).
- Camera is the card's preset but the user may orbit first — orbiting is not a miss
  (drag ≠ tap; the existing controls already disambiguate).

### 5.4 M-4 STAGE-ORDER

- Source: `deck.stageDrill` (TIMBER: the model's stagePlan labels; SAP-2: the seven
  R2a stage verb lines — a priorities-of-work drill).
- Layout: N shuffled chips in a tray (shuffle seeded `mulberry32(fnv1a(deckId) ^
  p.session)`); N numbered empty slots above. TAP-TO-PLACE (no drag required —
  accessibility + gloves): tap a tray chip → it fills the lowest empty slot; tap a
  placed chip → returns to tray. [Check] enables when all placed.
- Grading: per-slot ✓/✗; wrong chips return to tray for ONE retry pass; second check
  reveals the correct order with each stage's detail line. All-correct-first-try marks
  the drill `got` (stage drill has a single progress entry `stage-order` in
  `DeckProgress.cards`), anything else `again`.
- ≤ 11 chips (TIMBER max stage count; SAP-2 has 7) — one screen, no scrolling in
  portrait at 360 px (overflow test in happy-dom).

---

## 6. Spaced-repetition lite — decided

### 6.1 Scheduler: Leitner-by-session (FD7)

Three boxes, cadence measured in SESSIONS (`DUE_EVERY = {0:1, 1:2, 2:4}`), not
wall-clock days. Decision rationale (against SM-2/FSRS and against day-based Leitner):

1. **Clock-free = deterministic + honest.** Both apps forbid hidden time state
   (SAP-2's clock-integrity posture; TIMBER's purity invariants). A day-based
   scheduler reads the clock and silently misbehaves across the irregular sessions
   field use actually produces (three sessions one evening, nothing for two weeks).
   Session-indexed review is exactly as spaced as the user's real cadence.
2. **Deck sizes are 8–40 cards.** SM-2's per-card ease factors and interval curves
   buy nothing at this scale; Leitner's "missed cards come back next session, known
   cards rest" captures the training value with 3 states a Marine can be told in one
   sentence ("miss it and it comes back").
3. **Zero tuning surface** — nothing to calibrate, nothing to drift, trivially
   testable (§10 FT-I2/I3).

### 6.2 Storage (per-app, versioned, private)

```ts
// localStorage 'timber2-train' (root app) / 'sap2.train.v1' (sap2) — versioned envelope
export interface TrainState {
  v: 1;
  decks: Record<string /*deckId*/, DeckProgress>;
  settings: { largeMode: boolean; leftHand: boolean };   // NOTE: no streak field exists
}
```

- Boot revalidation: unparseable/wrong-version state degrades to `emptyProgress()`
  with a non-blocking notice — the "never trust stored bytes" pattern (TIMBER-2 §5.5).
- Writes debounced 300 ms, flushed synchronously on pagehide/visibilitychange:hidden
  and on leaving the trainer (same flush contract as `timber2-session`).
- Multi-tab: last-write-wins is ACCEPTED for progress data (it is only counters);
  recorded as a known limitation, not papered over with locks.

### 6.3 Streaks: none ship at all (FD8 — stronger than "off by default")

Decision: **no streak mechanism exists in v1** — not off-by-default, absent. Rationale:
(a) the owner's mandate is training value; streaks optimize app-opening, not knowing
the parts; (b) streaks require day tracking — reintroducing the wall clock §6.1 just
removed, and brushing against SAP-2's clock-integrity posture; (c) the audience is
units drilled by NCOs, not consumers to be retained; daily-streak anxiety is
gamification creep by definition. What ships instead: per-deck mastery
("11 of 17 known" + a three-segment bar) as the ONLY persistent indicator, and a
one-screen session summary (n got / n again) that is shown once and DISCARDED.
Re-entry bar for any future gamification: an explicit owner ask, logged in
DECISIONS.md.

### 6.4 Reset / export

- **Reset:** per-deck "Reset progress" with a two-step confirm (tap → "Really reset
  17 cards? [Reset] [Keep]"). Deletes that deck's `DeckProgress` only.
- **Export/import:** "Export progress" downloads the `TrainState` envelope as
  `timber-train-progress.json` / `sap2-train-progress.json` (Blob + object URL —
  offline, no accounts); import merges by deckId taking the HIGHER `session` per deck
  (simple, stated in the dialog). Value-free by construction (SR-6). This is the
  device-migration story; nothing syncs, ever.

---

## 7. Mobile-first spec (binding)

**Portrait one-handed flow (< 700 px):**

```
┌──────────────────────────────┐
│ ‹ back   DECK TITLE    4/17  │  header 44px; regime/watermark banner line under it (SAP-2 always)
│┌────────────────────────────┐│
││                            ││
││        CARD FACE           ││  art fills width; tap anywhere = flip
││   (scene canvas or SVG)    ││  swipe surface; touch-action: pan-y
││                            ││
│└────────────────────────────┘│
│  ▢▢▢ mastery bar             │
│ ┌───────────┐ ┌────────────┐ │
│ │ ↺ AGAIN   │ │ ✓ GOT IT   │ │  64px tall, bottom thumb zone; only in REVEALED
│ └───────────┘ └────────────┘ │  (PROMPT state shows one full-width FLIP button)
└──────────────────────────────┘
```

- **Targets:** primary mark/flip/choice buttons ≥ 64 px tall (SAP-2's glove rule,
  §3.7, adopted in BOTH apps for parity); every other control ≥ 44 px (TIMBER-2
  §5.4 rule). Asserted in the happy-dom suite (computed min-height).
- **Gestures with tap fallbacks (the buttons are the contract, swipes are sugar):**
  - Tap card = flip. Drill REVEALED: swipe right ≥ 25% width (or fling velocity)
    = Got it; swipe left = Again. During drag the card shows a text overlay
    "GOT IT" / "AGAIN" (words + icon, never color alone). Browse: swipe left/right
    = next/prev.
  - Drill PROMPT: horizontal swipe gives an 8 px resist + "flip first" hint — no
    accidental marking of unseen cards.
  - Gesture claim rule: horizontal only when `|dx| > 1.5·|dy|` and `dx > 12 px`;
    otherwise the browser scrolls (`touch-action: pan-y` on the card). Never
    intercept two-finger or vertical scroll (TIMBER-2 §5.4 precedent). Pointer
    capture on claim; cancel restores position.
- **Flip animation:** CSS `rotateY` 300 ms with backface-visibility, transform only
  (compositor-friendly). `prefers-reduced-motion: reduce` → 80 ms crossfade, no 3D
  transform; the identify glow pulse becomes a steady highlight (§5.2). Asserted by
  class presence under a mocked media query.
- **Offline instant load:** decks compile from the already-loaded engine at entry
  (< 50 ms budget); art memoized per (deckId, cardId); zero fetches, zero new asset
  files (check-offline + check-assets stay green untouched).
- **Landscape/desktop keyboard map:** Space/Enter = flip; REVEALED: → or G = Got it,
  ← or A = Again; browse: ←/→ navigate; 1–4 = identify choices; U = undo last mark
  (one step); Esc = back to deck list. Keys no-op when focus is in
  input/select/textarea or a dialog is open (the T3 keyboard-guard rule, adopted
  verbatim).
- **Projector/large mode:** a "Big" toggle (persisted in settings; also `?big=1`)
  sets a root `data-big` attribute: type scale ×1.6 (back name ≥ 34 px, facts
  ≥ 22 px), chrome hidden except ‹ › and flip, hit targets unchanged. For the
  NCO-runs-the-classroom case; test asserts the attribute flips the computed size.
- **A11y floor:** flip state announced via `aria-live="polite"` region ("Back:
  collar tie"); all interactions reachable by Tab; card is a `button` in PROMPT
  state; contrast per the host app's existing token palette (AA — reuse each app's
  ink tokens, no new colors beyond the highlight, which is paired with text labels).

---

## 8. Where it lives — entry points, routing, and the killer feature

### 8.1 TIMBER

- **F0 (pre-T3, TIMBER-1 shell):** a "Train" chip in the woodframe.html toolbar
  toggles a full-screen overlay (`location.hash = '#train'` so the Android back
  gesture exits — the T3 history-state pattern, adopted early). One deck: the demo
  building (`deckId 'timber:demo'`), compiled from the CURRENT `MODEL.members` —
  toggling the teaching options (basement, bridging…) recompiles the deck, and the
  cards change with the model. That is the killer feature demonstrated on day one.
- **F2 (post-T3):** routes `#/train` (deck list) and `#/train/<deckId>`; the deck
  list shows (1) **Your builds** — one deck per `timber2-session` structure entry,
  (2) **Standard designs** — one deck per live catalog family (compiled from
  `FamilyDef.preset`), each with mastery bars. The workbench header gains
  **"Learn this structure"** → `#/train/<entryId>` compiling from the LIVE spec.
  The picker footer gains a one-line "Training decks →" link. Route additions follow
  TD14's router; unknown deck id → deck list + inline notice.

### 8.2 SAP-2

- A **TRAIN** mode button in the top bar beside the existing region controls
  (retained-DOM region `sap2/src/ui/regions/train.ts`; no router exists and none is
  added). The deck is compiled from the CURRENT `Result` + watermark — change
  position and the deck follows; the watermark banner rides the deck header in every
  state. Available in TEMPLATE mode from first boot (day-zero training is the
  ship-empty story told positively).
- BUILD-mode interaction rules apply on phone-class viewports (64 px targets); the
  trainer is NOT gated behind the leader-view hold — it shows nothing the drawings
  in the same state would not show (regime rules §4 guarantee it).

### 8.3 Hub

One line of copy added to each existing card ("Includes a flash-card parts trainer —
train on the structure you configured."). **No third hub card / no standalone
training app (FD10):** a hub-level trainer would need a third bundle importing both
engines (new build target in the deploy that already OOM'd once) and would put two
liability regimes on one screen (XR-2). The trainer is a MODE of each tool, entered
where the structure already is.

### 8.4 The killer feature (stated)

> **You drill the thing you are about to build.** The deck is compiled from the same
> spec (TIMBER) or the same Result (SAP-2) that generates your cut list and your job
> sheet — same spec hash, same fill identity, recorded in `DeckSpec.compiledFrom`.
> Your 26 studs, your basement stringers, your grenade-sump count. When the plan
> changes, the deck changes; when the fill is TEMPLATE, the deck teaches identity
> and shape and withholds every number, exactly like the drawings do.

Generic decks (catalog families / other positions) exist for schoolhouse use, but the
configured-structure deck is the front door from both workbenches.

---

## 9. Phase plan F0–F4

Efforts use the TIMBER-2 scale (S ≤ half session, M ≈ 1, L = 2–3). Branch discipline,
DoD, and descope-ladder conventions are TIMBER-2 §7/§10.4 verbatim (verify +
build:suite green at merge; git diff empty on `test/timber-*.test.ts`; check-assets
green; DECISIONS.md entries `TRAIN Fn:`). SAP-2 phases additionally keep `sap2`'s own
CI green and follow its gate stand-up conventions.

**Dependency map (explicit):**

| Phase | Needs from T0–T8 | Needs from R0–R8 | Blocks |
|---|---|---|---|
| F0 | nothing (consumes the frozen `generateFrame` API + STAGES; coexists with T0–T2) | — | F2 |
| F1 | — | R0 complete (is: watermark, display(), drawPlan/drawSection, leaves) | F3 |
| F2 | **T3 merged** (router/store/catalog/camera rigs/cutaway); SVG card art additionally wants **T2** `thumbnails.ts` | — | — |
| F3 | — | **R2a** for stage-order (STAGE_ORDER verb lines) and richer component geometry; F3a identify-on-2D needs only F1 | — |
| F4 | — | — | — |

**Collision rule with TIMBER-2 (recorded now):** F0 touches `woodframe-scene.ts` only
additively (one import change + one toolbar chip + one mount call). If T3's shell
rewrite lands BEFORE F0 merges, F0 is SKIPPED and F2 implements directly on the T3
shell — the pure modules (`trainCore`, `compile`) are identical either way. Whoever
merges second rebases; the pure modules never conflict.

### F0 — TIMBER flip deck on TIMBER-1 (M)

**Contents:**
1. `src/ui/woodframe/labels.ts` — NEW: extract `PLAIN` + `WHAT` verbatim from
   `woodframe-scene.ts` (lines 44–87) and export them; scene imports from here.
   This is the exact file TIMBER-2 §3.6 designates for these dictionaries — the
   extraction is a T-plan down-payment, not a fork.
2. `src/ui/woodframe/train/trainCore.ts` — §2 verbatim (shapes + scheduler + PRNG).
3. `src/ui/woodframe/train/compile.ts` — §3.1 (`compileTimberDeck`), pure.
4. `src/ui/woodframe/train/view.ts` — DOM overlay: deck header, browse/drill flip
   loop, gesture + keyboard handling per §7, storage envelope `timber2-train` via an
   injected storage handle; scene-highlight application (setStage + tint + view) via
   a narrow injected `SceneHooks` interface `{ setStage(n): void; highlight(ids):
   void; clearHighlight(): void; setView(name): void }` implemented in
   woodframe-scene.ts — view.ts itself never imports three.js.
5. `woodframe.html` — overlay container + styles (host tokens); toolbar "Train" chip;
   `#train` hash toggle.
**Tests (named):** `test/train-core.test.ts` (mark transitions table; buildSession
determinism incl. seed stability + cap + unseen-first order; sealSession semantics;
mulberry32/fnv1a pinned vectors; FT-I2 lint: no Date/random/fetch in train files);
`test/train-cards.test.ts` (compile determinism deep-equal ×2 runs; one card per
present role over the demo + full teaching-options matrix; exemplar rule fixtures
incl. modal-nominal tie; whereClause table; TR-1/2/4/5; MissingLabel fires on a
synthetic unlabeled role; perf: compile < 50 ms warmed mean); `test/train-ui.test.ts`
(happy-dom: mount/unmount on hash; flip via click + Space; drill marks persist
through a simulated reload; pointer-sequence swipe → mark; pre-flip swipe does not
mark; keyboard guard; reduced-motion class; 64/44 px assertions; front never contains
back.name — FT-I4.6).
**Acceptance:** `npm run verify` + `npm run build:suite` green; git diff empty on
`test/timber-*.test.ts`; check-assets green (zero new asset files); demo deck ≥ 20
role cards; toggling Foundation=basement adds stringer/tread/slab cards live; drill
session completes and mastery persists across reload; offline scan green; owner walks
the phone flow (portrait, one hand) and accepts.
**Descope ladder:** browse-only (drop drill/scheduler) → drop gestures (buttons only).
The flip deck itself is the owner's verbatim ask — not cuttable.

### F1 — SAP-2 flip deck, regime-complete (M)

**Contents:**
1. `sap2/src/schema/callouts.ts` — §3.2 registry (12 entries; purpose/where copy
   authored here, gated by SR-5).
2. `sap2/src/train/trainCore.ts` — byte copy of F0's; ROOT `test/train-sync.test.ts`
   stands up (asserts byte equality of the two copies; runs in the root suite where
   both trees are visible).
3. `sap2/src/train/compile.ts` — §3.3.
4. `sap2/src/render/{drawPlan,drawSection}.ts` — `highlightComponentId` per §3.4
   (additive; base output byte-identical when unset — golden-asserted).
5. `sap2/src/ui/regions/train.ts` + main.ts mode button + styles.
**Tests:** `sap2/test/train.test.ts` (compile determinism; presence mapping vs
POSITION_STRUCTURE rows; deckId stability across soil/threat changes — FD9; SR-3
projection fidelity vs display(); highlight no-op golden); `sap2/test/gates/
g17-train-regime.test.ts` (SR-1 template zero-digit over corpus + SVG text nodes;
SR-2 FICT with TEST fill; SR-4 banner ×5 states; SR-6 value-free export); SR-5 checks
in `sap2/test/schema-integrity.test.ts`; happy-dom region suite mirroring F0's UI
tests under `sap2/test/ui/`.
**Acceptance:** sap2 CI green incl. G-2 (registry adds zero magnitudes) and G-11 (the
standalone artifact still fill-free with the trainer aboard); trainer boots from
`file://` in TEMPLATE with zero digits on any card; one_man deck = 8 components;
toolkit deploy green; owner phone pass.
**Descope ladder:** identify prep (highlight map breadth) → registry breadth (ship
one_man's 8 only). The TEMPLATE-mode zero-digit gate is not cuttable.

### F2 — TIMBER quiz modes + TIMBER-2 rebase + SVG art (L)

**Entry:** T3 merged (T2 for SVG art; if T2 only, SVG art may land engine-side first).
**Contents:** routes `#/train`, `#/train/<deckId>`; deck list (Your builds + catalog
families); workbench "Learn this structure" button; picker footer link;
`src/ui/woodframe/train/quiz.ts` (pure: identify state machine, `judgeTap`,
stage-order grading, pickDistractors already in core); M-2/M-3/M-4 views; camera =
`cameraRigFor` + per-family `CardViewSpec`; per-role `needsCutaway` column applying
`CutawaySpec`; `src/ui/woodframe/train/art.ts` `cardArt()` extending `thumbnails.ts`;
goldens `test/goldens/cards/*.svg` + `npm run update:card-goldens` (same-PR rule);
`lsRoles` wiring to `lifeSafetyRegister()` when T4 has landed.
**Tests:** `test/train-quiz.test.ts` (distractor determinism + name-dedupe;
judgeTap accept-any-member; miss ladder incl. single-member-role reveal case;
stage-order grading + retry pass); `test/train-art.test.ts` (golden SVG
string-compare; structural asserts: no external refs, no `<script`, polygon + KB +
ms budgets — thumbs policy verbatim); train-ui additions (identify flow, N2P flow,
stage-order tap-to-place, big mode); FT-I5 (edit spec → recompile → mastery
preserved) in `train-cards`.
**Acceptance:** decks for every live catalog card; "Learn this structure" works from
any workbench spec incl. custom; all four modes on phone; art legibility
owner-judged (fallback: heavier halo + auto-cutaway — mirror of T3's thumb
fallback); deploy green.
**Descope ladder:** stage-order → SVG art (scene-only) → identify. Name-to-part is
the training crown jewel — cut last, owner-signed only.

### F3 — SAP-2 identify + stage-order (M)

**F3a (needs only F1):** identify-on-2D — choice chips over the highlighted
plan/section; `data-component` hit regions sized ≥ 44 px; name-to-part on the 2D SVG.
**F3b (needs R2a):** stage-order drill consuming R2a's STAGE_ORDER verb lines
(deck.stageDrill populated; the deck may never suppress/insert stages — reuse the
§3.1 blueprint rule as a fixture test vs `computeStages`); component art upgraded as
R2a's build-card geometry lands (the honest-fallback chips burn down; tracked as a
registry-table column, asserted shrinking-only).
**Tests:** `sap2/test/train-quiz.test.ts` + gates extension (G-17 covers quiz copy);
golden highlighted SVGs via `gen-goldens.ts`.
**Acceptance:** all modes phone-green in TEMPLATE; stage order matches
`computeStages` fixture; sap2 CI + toolkit deploy green.

### F4 — polish + convergence (S–M)

Progress export/import UI both apps (§6.4); big-mode refinements; left-hand mirror
setting; printable 2-up flashcard sheets — TIMBER first (print CSS over the SVG art;
SAP-2 print WAITS for the R2a print pipeline so watermark banding rules apply to
paper cards — recorded, not improvised); deck filter when deck count > 8 (TIMBER-2
picker scale rule). Backlog reviewed against §11's re-entry bars.

---

## 10. Test strategy & invariants

Runner: root `node --test` + tsx; happy-dom for UI suites (both trees' precedent).
Named suites: `train-core`, `train-cards`, `train-ui`, `train-quiz`, `train-art`,
`train-sync` (root); `train`, `train-quiz`, `ui/train`, `gates/g17-train-regime`
(sap2). Legacy timber suites immutable, as ever.

**Invariants (gates, all phases):**
- **FT-I1** Twin-core: the two `trainCore.ts` copies are byte-identical (root test).
- **FT-I2** Train purity: no `Date`, `Math.random`, network primitives, or DOM
  imports in `trainCore`/`compile`/`quiz` modules (source lint test, per-tree).
- **FT-I3** Determinism: same input → deep-equal DeckSpec and byte-equal SVG art;
  buildSession/pickDistractors stable under fixed seeds.
- **FT-I4** Regime rules TR-1..5 and SR-1..7 (§4) are enforced by the named suites;
  SR-1/2 run as a sap2 GATE (g17) so a digit leak fails the build, not a review.
- **FT-I5** Progress-key stability: spec/input edits recompile the deck without
  losing mastery (subject-keyed card ids; deckId rules FD9).
- **FT-I6** Storage honesty: versioned envelope; corrupt state degrades to empty
  with notice, never a crash; flush-on-hide.
- **FT-I7** Deploy: zero new runtime deps, zero new dist asset files, offline scans
  green, `build:suite` green — the trainer rides the existing budgets.
- **FT-I8** Gesture safety: vertical scroll never hijacked; pre-flip swipes never
  mark; every gesture has a visible button equivalent (happy-dom pointer suites).
- **FT-I9** Golden discipline: card-art goldens are committed FULL SVG files,
  string-compared, structural asserts independent, updated only in the same PR as
  the visual change (thumbs policy, TIMBER-2 §4.4/R4).

---

## 11. Considered and rejected / IN-later (honesty ledger)

| Idea | Disposition | Why |
|---|---|---|
| SM-2 / FSRS scheduling | REJECTED | Needs wall-clock + tuned parameters; decks are 8–40 cards; Leitner-by-session captures the value clock-free (§6.1). |
| Streaks, badges, leaderboards, daily goals | REJECTED (no mechanism ships) | Gamification creep vs the training mandate; requires day tracking; no-accounts posture (§6.3). Re-entry: explicit owner ask only. |
| Cut-length / span memorization quiz (TIMBER) | REJECTED | Would train unverified (PH) magnitudes as recall facts. Numbers stay REFERENCE on backs, cited; recall drills are identity/sequence only. |
| Numeric-answer drills on SAP-2 ("how deep?") | REJECTED in ALL states (SR-7) | Even DOCTRINE-commissioned values carry "verify against current publications"; memorization contradicts the regime. Identity + sequence is the training value. |
| Mixed cross-app decks / hub trainer app | REJECTED | Two regimes on one screen invites leakage; third bundle risks the deploy budget (FD10, XR-2). |
| Audio narration / TTS | REJECTED v1 | Asset + offline budget; TTS voices are not deterministic or offline-guaranteed. |
| Photo/real-render card art | REJECTED | Asset budget; the engine-projected art is the anti-drift guarantee. |
| Nail-pattern tap mini-game ("place the 16d's") | IN-later | Real value, but needs T8's structured `Member.nails` field; revisit post-T8. |
| Printable 2-up flashcards | IN-later (F4 TIMBER; SAP-2 gated on R2a print pipeline) | Paper is the field medium; SAP-2 paper must inherit watermark banding first. |
| Timed modes / leaderboard pressure | REJECTED | Speed pressure trains guessing; comprehension protocols (SAP-2 §3.8) are the honest bar. |
| Deck sharing between devices via link | REJECTED | Decks are projections — share the SPEC (TIMBER links already do); progress export covers migration (§6.4). |
| SAP-2 3D card art | DEFERRED to the R2b decision point | Mirrors the blueprint's own "2D cuts first, 3D only when ready" ruling. |

---

## 12. Risks & kill criteria

| # | Risk | Detection | Mitigation / kill |
|---|---|---|---|
| K1 | F0 shell work collides with T3's rewrite | branch state at F0 merge | Collision rule §9: F0 is additive-only; if T3 lands first, F0 is skipped and F2 builds on T3. Pure modules identical either way. |
| K2 | Authored `purpose` copy drifts toward doctrine-shaped claims | SR-5 gates + counsel scope | Copy is registry-only, gate-scanned, inside the §2.9 counsel review scope; any magnitude-shaped phrasing is a build failure. |
| K3 | Scene-highlight illegible for small members (bridging, battens) | F2 owner walk | Fallback ladder: auto-cutaway → zoom preset → heavier halo; owner-judged AC like thumbs. |
| K4 | Golden card-art churn masking regressions | PR review | FT-I9: file goldens, structural asserts independent, same-PR rule (TIMBER-2 R4 verbatim). |
| K5 | Trainer state grows features (notes, custom cards) that re-introduce authored content | PR review vs FD2 | FD2 is the line: cards are projections; user-authored card content is a REGIME question (SAP-2 side) requiring the owner + blueprint conversation, not a feature PR. |
| K6 | sap2 standalone size creep | G-13 perf/size budgets | Trainer adds no deps and no assets; if the single-file budget trips, big-mode styles and quiz views are the first descope. |
| **KILL** | Any need for a new runtime dependency, a new dist asset file, or a network call | check-offline / check-assets / review | STOP — redesign within the engines; these are the toolkit's non-negotiables. |

---

## 13. Decisions log (FD1–FD15)

| # | Decision | Rationale |
|---|---|---|
| FD1 | Twin `trainCore.ts` copies, byte-equality-tested from the root; no shared package, no cross-tree imports. | Preserves sap2 self-containment (N1) and the deploy's build shape; drift is loud (I-14 pattern). |
| FD2 | Cards are runtime projections of the engines; no authored card files anywhere. | Anti-drift by construction; the mandate's "see the thing" is the engine's thing. |
| FD3 | TIMBER art: live-scene highlight primary, compiled SVG secondary (extends T2 thumbnails); SAP-2 art: 2D SVG primary, 3D deferred to the R2b decision. | Reuses each app's existing art posture and determinism claims; zero new pipelines before their host phases exist. |
| FD4 | Stage-slice rule: card art renders through the subject's install stage; interior same-stage members add the family CutawaySpec. | The scrubber's own trick; occlusion becomes impossible instead of handled. |
| FD5 | Exemplar = modal nominal (lexicographic tie-break), then min id. | Deterministic and representative; pinned by fixture. |
| FD6 | Regime inheritance, not re-implementation: SAP-2 card numbers route through `display()` + `artifactPolicy`; TIMBER cites are `doctrineRef` verbatim. | Cards cannot disagree with drawings/member cards; regime tests reduce to projection-fidelity checks. |
| FD7 | Scheduler = 3-box Leitner indexed by SESSION count; SM-2 and day-based Leitner rejected. | Clock-free, deterministic, honest for irregular field cadence; zero tuning surface (§6.1). |
| FD8 | No streak mechanism ships at all; mastery bar + discarded session summary only. | Stronger than "off by default": training value over engagement farming; avoids reintroducing wall-clock state (§6.3). |
| FD9 | Progress keys on stable subjects: deckId = entry/family/position id; cardId = role/component. `compiledFrom` hashes are provenance only. | Editing the spec must never wipe mastery (FT-I5) — training tracks the build as it evolves. |
| FD10 | Entry points are per-app (TIMBER routes + workbench button; SAP-2 region); hub gets one copy line, no third app. | A hub trainer would need a third dual-engine bundle (deploy budget) and mix regimes on one screen (XR-2). |
| FD11 | F0 ships against TIMBER-1 NOW, extracting PLAIN/WHAT to `src/ui/woodframe/labels.ts` — the file TIMBER-2 §3.6 already designates. | Member[] is already flashcard-shaped; the extraction is a T-plan down-payment; collision rule recorded (§9 K1). |
| FD12 | The SAP-2 component registry IS the blueprint's `callouts.ts`, created at its designated home; R2a consumes it. | Build ahead on the blueprint's own file, never fork a second naming authority (§3.5's one-registry rule). |
| FD13 | Ship order M1 → (M2 TIMBER / M4 TIMBER) → M3 → SAP-2 M2/M4 per R2a; distractors deterministic via seeded PRNG from the deck itself. | M1 is the mandate; M3 is highest-value but needs pick plumbing; SAP-2 stage lines are R2a property (deck-composition rule §3.1). |
| FD14 | 64 px primary targets in BOTH apps (SAP-2 glove rule adopted for parity); 44 px minimum elsewhere; reduced-motion crossfade replaces the 3D flip. | One muscle memory across the toolkit; accessibility floors stated, tested. |
| FD15 | Progress export is value-free by construction (ids + counters only) and lives outside fill files and spec sessions. | SR-6/XR-1 — training data can never become an exfiltration or leakage path. |

*End of design. Implementing sessions: start at §9 F0 (or F1 — they are independent),
holding this document plus the governing plan of the app being touched.*
