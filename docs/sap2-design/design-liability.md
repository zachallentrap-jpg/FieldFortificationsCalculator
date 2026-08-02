# SAP-2 DATA REGIME — Liability & Data-Governance Architecture

> **Role:** Liability & Data-Governance Architect, SAP-2 (ground-up rebuild of the
> Survivability Position Planner).
> **Status:** Design blueprint. Nothing here is legal advice; §6 flags every point that
> requires counsel/JAG review before fielding.
> **Ground truth consulted:** `docs/STATE_OF_THE_APP.md` (2026-08-01 audit),
> `DECISIONS.md` (D1–D35), `PLACEHOLDER_POLICY.md`, `DOCTRINE_SOURCES.md`,
> `src/doctrine/*` (types, registry, io, materials, labor, stages), `docs/EXECUTION_PLAN.md`.

---

## 0. Frame: what v1 proved, what v1 cannot defend, and the architectural spine of v2

### 0.1 What v1 got right (carry forward)

v1's placeholder regime is genuinely unusual and genuinely good. These properties are
**inherited as requirements**, not re-litigated:

| v1 property | Carried into v2 as |
|---|---|
| Data-driven NOT-FOR-FIELD-USE banner, no manual clear | Watermark state machine (§4), still data-driven, now *harder* to clear (commissioning act required) |
| `resolveCover` single authority; direct-fire AT / large VBIED → `engineered_required`, **zero fabricated thickness ever** | INV-1/INV-2 (§5) — structural, not data; no leaf exists whose fill could create an AT roof number |
| All-or-nothing import; prototype-pollution rejection; version gate; dry run | Fill-file validator (§3), strengthened (per-leaf bounds, relational checks, unit equality, hash verification) |
| Fill manifest hash on Status panel + job-sheet footer | Full provenance stamping on **every** artifact (§4), SHA-256, plus commissioner identity |
| Deterministic engine, clock-free, offline, zero-dep calc core | Unchanged; determinism now extends to fill identity: same `(inputs, schema, fill)` → byte-identical artifacts |
| Every value can explain itself (tap-to-explain with per-operand provenance) | Mandatory; extended to citations (§4.4) |

### 0.2 What v1 cannot defend (the four structural weaknesses v2 exists to remove)

1. **The numbers exist.** v1 ships 295 *plausible-looking* magnitudes — `P(3.0 ft)` cover,
   `P(0.83 ft)` firing-rest course, `P(7)` basic load — flagged illustrative, but present in
   source, in the export file, in `DOCTRINE_SOURCES.md`'s "Current placeholder" column, in
   every screenshot, and in every snapshot test. Several are *adjacent to real doctrine*
   (the sandbag comments literally cite ATP 3-21.8 paragraph numbers next to the
   "illustrative" value). A flag on a number is a disclaimer; an adversary's expert holds up
   the number. The strongest possible posture is that **the distributed software contains no
   protective-construction value at all** — nothing to disclaim, nothing to crop a banner
   off of, nothing to anchor the owner during entry.
2. **Fill-by-mutation.** v1's import mutates live registry leaves; `compute()` reads ambient
   global state. This already produced a real defect class (STATE_OF_THE_APP §6B-2: labor
   values snapshotted at module load silently ignore an applied fill). Worse for liability:
   a rendered artifact's provenance stamp is read from ambient state *at render time*, so a
   stamp can in principle disagree with the data that produced the numbers.
3. **The importer is too polite.** `0 ≤ v < 1000` is the only numeric check
   (`doctrine/io.ts:175`). It accepts `sandbag.L = 0` (a divisor), `excavationSplit` that
   sums to 1.7, a shielding table where 155 mm needs *less* cover than 5.56, and a value
   typed in inches into a feet leaf. It captures no citation fields, no identity, no
   verification, and its hash is FNV-1a (fine for change detection, weak as evidence).
4. **The banner clears itself.** At `placeholder === 0` the banner vanishes — automatically,
   with no recorded human acceptance, no identity, no act. The moment of maximum consequence
   (the tool starts asserting safety numbers) has no witness. And the TIMBER-1 lesson
   (§6C-N13: a whole second tool's invented constants sit outside the counted regime) shows
   a count-driven banner can be *true and misleading at once*.

### 0.3 The architectural spine of v2 (three sentences)

1. **The schema is code; the data is a file; the two never mix.** SAP-2 source defines every
   leaf's *identity* (id, name, definition, unit, bounds, relations, consumers, pub pointer)
   and **no leaf value**: shipped `value: null`, everywhere, forever.
2. **The fill is a value, not a mutation.** The engine is
   `compute(inputs, schema, fill) → Result`; the fill object is immutable, hash-identified,
   and its identity rides inside `Result` into every renderer, so an artifact can only ever
   be stamped with the exact data that produced it. There is no global doctrine state to
   drift, snapshot, or half-apply. (This deletes v1 defect class §6B-2 by construction.)
3. **Numbers appear only after a recorded human act.** Entry is witnessed (Fill Station audit
   chain, double entry, citations, identity); trust is conferred only by an explicit
   **commissioning ceremony**; the watermark is a pure function of
   `(fill class, commissioning record, schema hash match, integrity check)` — never of a
   count reaching zero.

### 0.4 Vocabulary (used precisely throughout)

| Term | Meaning |
|---|---|
| **Leaf** | One doctrinal quantity the schema defines. ~300 expected in v2 (v1: 295). |
| **Schema** | The value-free catalog of all leaves + relations. Compiled into the app. |
| **`schemaHash`** | SHA-256 over the canonical schema serialization (§3.4). Changes when any leaf id/unit/bound/relation changes. |
| **Fill** | A data file supplying values for leaves, with citations, identity, audit chain. |
| **Fill class** | `DOCTRINE` \| `TRAINING` \| `TEST` (§1.6). |
| **Fill Station** | The guided entry application (§2), run on the owner's air-gapped machine. |
| **Commissioning** | The recorded human acceptance act (§2.10) that alone permits the COMMISSIONED watermark state. |
| **Watermark state** | `TEMPLATE` \| `TRAINING` \| `FILLED-UNCOMMISSIONED` \| `COMMISSIONED` \| `STALE` (§4.2), plus the `CORRUPT` refusal behavior. |
| **Token** | The rendered stand-in for an unfilled value: the leaf's short name in ⟨angle brackets⟩, e.g. `⟨OHC thickness⟩`, never a digit. |
| **Unfilled marker** | The typed in-engine representation of "no value" (§1.5). Never `NaN`, never a default. |

---

## 1. Part I — SHIP-EMPTY vs illustrative-seed: the argument, the decision, the regime

### 1.1 The question

v1 ships every leaf with an illustrative magnitude (`P(3.0)`), wrapped and flagged, and the
app renders fully dimensioned drawings from day one. Should v2 instead ship **zero numeric
values** — schema only, `value: null` — and run in a watermarked TEMPLATE MODE with
shape-true but dimension-free renders until a fill exists?

### 1.2 The honest case for illustrative-seed (v1's model)

State it at full strength before deciding against it:

1. **The app demos itself.** A dimensioned drawing, a BOM with quantities, a labor total —
   from first launch. Ship-empty risks a first-run experience of a blank tool.
2. **Development and test need numbers.** Fuzz tests, snapshot tests, render NaN-matrices,
   the 3D honesty assertions — all currently ride on seed values. Remove seeds and every
   test needs a data source.
3. **Renders need magnitudes to be shape-true.** Proportions, wall batter, bag tiling — all
   derive from values. Without values, what does the 2D/3D pane even draw?
4. **Seeds exercise the full pipeline.** The v1 promise "fill → banner clears" was proven by
   tests *because* a complete fixture existed. A value-free app risks shipping a fill path
   that has never actually run end-to-end.
5. **The flags already work.** Every seed is marked, the banner is up, the export file says
   NOT FOR FIELD USE. Arguably the marginal liability of a flagged seed is small.

### 1.3 The case for ship-empty

1. **Remove the number, remove the argument.** Every flagged seed is still a number the
   software *shipped*. The failure scenarios are concrete: a screenshot with the banner
   cropped; a job sheet photocopied without its footer; a curious user reading
   `protection.ts` and transcribing `3.0 ft` because it "looks right"; a fork that deletes
   the banner but keeps the seeds. Under ship-empty, **every one of those scenarios yields
   no number at all**. The defensible statement becomes absolute: *"As distributed, this
   software contains no shielding thickness, span, standoff, or labor rate. Every value in
   this artifact was entered by [name] on [date], citing [publication, paragraph]."* That
   sentence is checkable by grep, provable by test gate, and it is the single strongest
   thing the architecture can hand counsel.
2. **Plausible fakes are the most dangerous fakes.** v1's seeds were deliberately chosen to
   make the drawings look sensible — which is exactly the property that makes a leaked seed
   lethal. (v1's own materials file puts real ATP 3-21.8 paragraph citations in comments
   *touching* illustrative values — the distinction is one line of context away from
   vanishing.) There is no such thing as a safely plausible fake safety number.
3. **Anchoring during the fill.** The owner will personally type ~300 values. v1's fill
   workbench and `DOCTRINE_SOURCES.md` display the current seed beside each entry
   ("Current placeholder: 3.0"). Anchoring is a well-documented transcription hazard: under
   fatigue, the seed *is* the most likely wrong value to be entered. Ship-empty makes the
   entry field's prior state blank — the only number in the loop is the one in the open
   publication.
4. **The count stops lying.** v1's banner counts placeholders; TIMBER-1 proved a count can
   reach zero while invented numbers remain (uncounted) elsewhere. Ship-empty converts the
   invariant from "all counted seeds replaced" to "**no numeric doctrinal literal exists in
   the shipped artifact at all**" — enforceable by a source-scanning gate over the *entire*
   suite (INV-9), with no possibility of an uncounted seed because there are no seeds.
5. **It matches the owner's mandate literally.** "No liability issues when I put in the full
   and complete data one by one" — the cleanest realization is that the data's first
   appearance anywhere in the system is the owner's own keystroke, witnessed.

### 1.4 DECISION — D-DG-1: SAP-2 ships empty

**SAP-2 ships with zero numeric doctrinal values.** Every leaf is schema-only:
`value: null`. No illustrative seed exists in source, tests-as-shipped, docs, or artifacts.
The app runs in **TEMPLATE MODE** (watermarked) until a fill is loaded. The four costs from
§1.2 are paid deliberately, as follows:

- Demo/first-run → TEMPLATE MODE is designed as a *product surface*, not a degraded state
  (§1.7), plus the TRAINING fill class (§1.6) for realistic-looking instruction.
- Dev/test numbers → generated synthetic fills (`TEST` class), non-plausible by
  construction, excluded from shipped artifacts (§1.8).
- Shape-true renders → presentation-geometry + token dimensioning (§1.7).
- Pipeline exercised → the CI fill-path test uses a generated complete `TEST` fill; the
  commissioning path is exercised in CI against the synthetic fill with a fake identity
  clearly marked `TEST` (and the artifact-level gate asserts the shipped bundle contains
  no fill of any class).

### 1.5 The schema leaf (field-by-field) and null semantics

Replaces v1's `Provenance<T>`/`P()`. Authors can no longer even *express* a shipped value.

```ts
// SAP-2 doctrine/schema — NO VALUES LIVE HERE, BY TYPE.
export interface SchemaLeaf {
  id: string;              // stable slug, e.g. 'shield.mortar_82.sandbagged_soil'
                           // — decoupled from code layout (v1 used registry dotted paths
                           //   tied to table shape; refactors would orphan fills).
                           //   Renames require an explicit alias entry (§3.6).
  name: string;            // doctrinal short name: 'Shielding — 82 mm mortar, sandbagged soil'
  plainName: string;       // 'Dirt-and-sandbag wall thickness that stops an 82 mm mortar burst'
  definition: string;      // 2–3 sentences: what this quantity IS, measured how, from where
                           //   to where (e.g. 'horizontal thickness, interior face to
                           //   exterior face, of the material between occupant and burst').
  unit: CanonicalUnit;     // 'ft' | 'ft3' | 'mh' | 'mh_per_ft3' | 'ratio' | 'count' | 'deg' …
                           //   ONE canonical unit per leaf; engine works in it; entry may
                           //   convert from pub units (§2.7) but storage is canonical.
  kind: LeafKind;          // 'length'|'thickness'|'volume'|'rate'|'factor'|'count'|'angle'|'share'
  bounds: StructuralBounds;// §3.5 — physics/arithmetic bounds ONLY, never doctrinal ranges
  divisor: boolean;        // true ⇒ bounds.exclusiveMin ≥ 0 enforced by schema compiler
  integer: boolean;
  roundingDirection: 'up' | 'down' | 'nearest' | 'exact';
                           // how DERIVED displays round: protective thickness 'up',
                           //   span/capacity 'down', counts 'up', cosmetic 'nearest'.
  safetyCritical: boolean;
  consumers: ConsumerRef[];// ≥1, enforced (INV-10): [{module:'engine/protection',
                           //   what:'roof thickness for this threat', surfaces:['section',
                           //   'job-sheet','bom']}]
  relations: RelationRef[];// membership in sum-groups / monotonic chains / cross-checks (§3.5)
  pubPointer: string;      // WHERE-TO-LOOK guidance only, value-free, per the
                           //   DOCTRINE_SOURCES lineage rule ('current survivability pub
                           //   lineage: ATP 3-37.34 family — confirm currency yourself').
  batch: string;           // fill-station batch/table grouping, e.g. 'shielding.mortars'
  tableLayout?: TableRef;  // if this leaf is a cell of a pub-shaped matrix (row/col labels)
                           //   the grid entry view uses (§2.8)
}
// There is no `value` field in the schema type AT ALL. Values exist only inside Fill
// objects (§3). The type system, not discipline, prevents a shipped number.
```

**Null semantics — "unfilled poisons, never defaults" (INV-3).** At compute time each leaf
resolves through the fill: `resolve(leafId): Filled<number> | Unfilled`. `Unfilled` is a
typed marker carrying the leaf id. Arithmetic on `Unfilled` yields `Unfilled` (with the
union of contributing leaf ids — so a poisoned result knows *which* leaves it is waiting
on). Renderers receive `Filled | Unfilled` and render tokens for `Unfilled`. It is a type
error to extract a raw number without handling `Unfilled`; there is no `.valueOrDefault()`.
`NaN` remains banned separately (v1's finite-guard discipline carries over).

Consequences, all deliberate:
- Partial fill ⇒ partial numbers: anything computable from filled leaves computes; anything
  touching an unfilled leaf shows its token. This is what makes the Fill Station's live
  preview work (§2.6) — the operator literally watches tokens become numbers.
- A BOM line with a poisoned quantity renders `⟨…⟩` and the BOM total renders
  `⟨incomplete⟩` — never a partial sum presented as a total.
- Validation still runs structurally (e.g., "revetment required in this soil") because
  those rules are qualitative; quantitative checks that need unfilled leaves report
  "not evaluable — awaiting ⟨leaf⟩" rather than passing silently (fail-safe direction).

### 1.6 Fill classes

Every fill file declares exactly one class (§3.2); the class drives the watermark floor.

| Class | Purpose | Watermark floor | Commissionable? | Loadable in shipped app? |
|---|---|---|---|---|
| `DOCTRINE` | The real thing: owner-entered, cited, verified | FILLED-UNCOMMISSIONED until commissioned | **Yes** (only this class) | Yes |
| `TRAINING` | Instruction/demo on the *workflow* with fictitious values | TRAINING (never lower) | **Never** — validator rejects a commissioning record in a TRAINING file | Yes |
| `TEST` | CI/dev synthetic fills | n/a | Never | **No** — the shipped bundle refuses class TEST (and the release gate proves no fill of any class is embedded) |

`TRAINING` rules (this is how demos/training happen without reintroducing fake-number risk):
- Every render carries a repeating diagonal `TRAINING — VALUES ARE FICTITIOUS` watermark on
  the 2D canvas, the 3D canvas, the job sheet, and every export; the top bar is a distinct
  color (not the red warning — a purple "classroom" scheme) so a photo of the screen is
  self-identifying.
- Printed artifacts append a full-width line under every drawing:
  `TRAINING DATA — every value on this page is fictitious.`
- The Fill Station can *author* TRAINING fills through the same workflow (that is the
  training: the instructor fills a table live, students see the audit chain grow), but the
  commissioning screen is replaced by a dead-end explainer: "TRAINING fills cannot be
  commissioned. To produce field data, start a DOCTRINE fill."
- A TRAINING fill's values are arbitrary (instructor's choice) — the watermark, not value
  implausibility, is the control, because plausible-looking numbers are exactly what makes
  training realistic. The class is stored in the file header, is part of the content hash,
  and cannot be edited without breaking the hash chain (§3.4); a class-edited file fails
  integrity and refuses to load (CORRUPT behavior), so "launder a TRAINING fill into
  DOCTRINE by editing one field" fails closed.

### 1.7 TEMPLATE MODE — the designed empty state

TEMPLATE MODE is what the shipped app does with no fill loaded. It must be good enough to
demo the tool's *workflow* and teach its *shape* while making it impossible to extract a
dimension. Screen-level design:

- **Top bar:** slate-gray `TEMPLATE — NO DATA LOADED` badge (distinct from red
  NOT-FOR-FIELD-USE lineage; this state is not dangerous, it is empty). Tapping it opens
  the data status panel: schema version, leaf count, "0 of N leaves filled", and the two
  actions: `Load fill…` / `Open Fill Station`.
- **2D pane:** renders **presentation geometry** — each position's true topology (rectangle
  / L / inverted-T / circle / trench run; parapet ring; sump notches; ramp wedge) drawn at
  *fixed canonical proportions* defined in the render layer and marked
  `presentation-only: true` in code. Every dimension line renders its leaf **token**
  (`⟨fighting depth⟩`, `⟨OHC thickness⟩`) where v1 rendered a number. The scale bar is
  replaced by the literal text `NO SCALE — TEMPLATE`. No digits appear anywhere in the
  drawing. (Gate: the template-render test asserts the SVG string contains zero numeric
  dimension labels.)
- **Why fixed canonical proportions are safe:** they are the same for every position and
  soil (deliberately wrong as measurement, unmistakably schematic), they carry no units,
  and the no-digits gate means nothing measurable survives into an export. The alternative
  — refusing to render at all — was rejected: a blank pane teaches nothing and makes the
  Fill Station preview (§2.6) impossible.
- **3D pane:** same descriptor pipeline, same canonical proportions, flat "blueprint"
  material (monochrome, grid-textured) instead of the soil palettes — the diorama look is
  *reserved* for filled data so no screenshot of TEMPLATE can be mistaken for a plan.
  Stage scrubber and cutaway work (they are workflow, not data).
- **Panels:** specs/BOM/labor render their full structure with tokens for every quantity;
  tap-to-explain works and shows the formula with tokens as operands — the teaching value
  of the derivation survives with zero numbers.
- **Job sheet/print/export:** allowed (people must be able to train the print workflow),
  with the TEMPLATE watermark diagonal + token dimensions. CSV exports emit the token text
  in value cells.
- **First-run overlay:** one screen: "This tool ships with **no data**. It computes only on
  values you supply from current publications. [Tour] [Open Fill Station] [Load fill]".

### 1.8 TEST fills and CI (how development works ship-empty)

- `test/fixtures/gen-fill.ts` deterministically generates a complete fill:
  `value = f(leafIndex)` chosen to be **structurally valid but doctrinally absurd on
  sight** (e.g., lengths of 0.111, 0.222 … pattern series that satisfy bounds, sum-groups
  and monotonic chains by construction), class `TEST`, identity
  `enteredBy: 'CI SYNTHETIC — NOT A PERSON'`, source citations
  `pub: 'TEST-000 (fictitious)'`. Nothing about it can be mistaken for doctrine, and it
  never ships: the release gate (INV-9) scans the artifact for fill payloads and fails on
  any.
- Fuzz/NaN/render matrices run against generated fills (several seeds); snapshot tests pin
  against one canonical TEST fill *file* (so snapshots are obviously fixture-derived, not
  "the app's numbers").
- The end-to-end trust test drives: generate TEST fill → validate → load → compute →
  assert FILLED-UNCOMMISSIONED → synthetic commissioning (TEST path, marked) → assert the
  *mechanism* — then asserts the shipped bundle contains none of it.
- Property tests additionally run the engine on the **empty fill** (all `Unfilled`) and
  assert: no throw, no NaN, all outputs tokens, no digit-bearing dimension in any render —
  the TEMPLATE gate.

### 1.9 What this means for v1's `P()` regime (migration note)

v1's `P()` helper, seeds, `DOCTRINE_SOURCES.md` "Current placeholder" column, and the
count-driven banner are **not carried**. The v2 schema is authored fresh from v1's leaf
*inventory* (ids, units, meanings, consumers — which v1 got right) minus its values, plus
the new per-leaf metadata (bounds, relations, rounding, divisor flags, batches). The v1
unconsumed leaves (§6C-N6: `sheathingThickness`, `dustproofThickness`, `rollInSlope`,
`retainingWall.thickness`) are either wired to real consumers in v2's engine or **deleted
from the schema** before v2.0 freezes — INV-10 makes an unconsumed leaf a build failure.

---

## 2. Part II — THE FILL STATION

### 2.1 Product shape and operating assumptions

- **What it is:** a distinct entry point (`fill.html`) inside the same single-file,
  offline artifact family as the planner — same zero-network guarantees, same
  runs-from-`file://` build, same schema compiled in. It is not a separate codebase: the
  live preview *is* the real renderer, and the validator *is* the real import validator,
  so what the Fill Station accepts is by construction what the planner accepts.
- **Where it runs:** the owner's air-gapped machine. All state lives in (a) IndexedDB
  drafts for crash-resume and (b) explicit **progress files** the operator exports — the
  file is the canonical custody object; the browser store is a convenience cache. Data
  never leaves the device except as files the owner moves by hand.
- **Who runs it:** the owner, alone or with a second person as verifier. There are no
  accounts and no authentication: identity is **attested, not authenticated** (typed
  identity records, §2.3), and the design says so out loud — the security model is
  physical custody of an air-gapped machine, and the file format is tamper-*evident*
  (hash chain), not tamper-*proof* (§3.4, §7 row F16).
- **Scale:** ~300 leaves × 2 passes (entry + blind verification) ≈ 600 acts. At a measured
  pace (30–45 s/leaf including pub lookup) this is 6–9 hours of careful work — the design
  budgets it across **batches** (§2.9) over multiple sessions, because fatigue is a named
  failure mode (§7 rows F1–F3), not an inconvenience.

### 2.2 Data model (Fill Station working set)

```ts
interface FillDraft {
  fillFormatVersion: number;      // file syntax version (§3)
  schemaVersion: string;          // e.g. '2.0.0'
  schemaHash: string;             // SHA-256 of the compiled schema — binds draft to schema
  fillClass: 'DOCTRINE' | 'TRAINING';   // chosen at creation, immutable thereafter
  fillId: string;                 // uuid minted at creation
  identities: Identity[];         // §2.3
  publications: Publication[];    // §2.4 — registered before any leaf can cite them
  records: Map<leafId, LeafRecord>;   // §2.5
  audit: AuditEvent[];            // §2.11 — append-only, hash-chained
  commissioning?: CommissioningRecord; // §2.10 — absent until the ceremony
}

interface LeafRecord {
  leafId: string;
  value: number | null;           // canonical unit (schema.unit)
  entry?: EntryAct;               // pass A
  verification?: VerificationAct; // pass B (blind re-entry) — required before commissioning
  citation?: Citation;            // §2.5 — required for DOCTRINE class
  flags: LeafFlag[];              // 'MISMATCH' | 'WAIVER:<checkId>' | 'REVISIT' | 'NOT_IN_PUB'
  note?: string;
}

interface EntryAct     { by: identityId; at: AttestedTime; rawEntry: RawEntry; }
interface VerificationAct { by: identityId; at: AttestedTime; rawEntry: RawEntry;
                            method: 'self' | 'second-person'; }
interface RawEntry     { text: string;        // exactly what was typed, verbatim
                         unit: string;        // the unit the operator typed in (pub's unit)
                         converted: number;   // canonical value after conversion
                         conversionFactor: number | 1; }  // recorded, exact
```

`RawEntry` is the transcription-forensics record: what was typed, in what unit, and what
conversion produced the stored value. If a number is ever questioned, the file shows the
keystrokes, the pub's unit, and the arithmetic — not just the end value.

### 2.3 Identity capture (Screen S1 — first run / session start)

**S1 fields (per person, created once, reusable):**

| Field | Type | Rules |
|---|---|---|
| Full name | text, required | ≥ 2 words prompted (not enforced) |
| Rank / title | text, optional | free text |
| Unit / organization | text, optional | free text |
| Initials | text, required | used in compact audit displays |
| Role this session | `operator` \| `verifier` | a person may hold different roles in different sessions |

**S1 behavior:** on every session start the operator (and verifier, if present) selects
their identity card and the screen displays: *"You are attesting entries as **Jane Q.
Sapper, SSgt, 1st CEB**. Every entry you make is recorded under this identity in the fill's
permanent audit log."* Continue requires tapping `I am this person`. A visible line states
the honesty position: *"Identity here is your attestation, not a login. This file records
who claims to have entered each value; it cannot prove it. Control the machine and the
files accordingly."*

**Clock attestation (same screen):** the Fill Station reads the device clock, displays it
(`Device clock: 2026-08-01 14:02 local`), and requires `Confirm` or `Correct…` (manual
entry). Every timestamp in the audit log stores `{deviceClock, operatorConfirmed:
true|corrected}` — timestamps are attested data, not proof, and the engine itself remains
clock-free (timestamps exist only in fill files and audit events, never in compute).

### 2.4 Publication registry (Screen S2 — before any entry)

No leaf can be cited against a publication that hasn't been registered. **S2 fields per
publication:**

| Field | Type | Rules |
|---|---|---|
| Pub ID (auto) | slug | e.g. `pub-1` |
| Designation | text, required | e.g. the pub number as printed on the cover |
| Title | text, required | verbatim from cover |
| Edition / change | text, required | edition, change number |
| Date of publication | date, required | from the pub itself |
| "I verified currency" | checkbox + free-text, required | *how* the operator confirmed this is the in-effect edition (e.g. "checked against unit pubs library index, 2026-07-30") |
| Supersedes / superseded-by note | text, optional | lineage note |
| Handling marking | select: `UNMARKED` / `CUI` / `OTHER:` text | drives export handling notes (§6.4) |

Registering a pub is an audit event. The commissioning screen (§2.10) re-lists every pub
with its currency attestation — stale-pub defense is a *human attestation captured twice*,
plus the review-by date (§4.6).

### 2.5 The per-leaf entry screen (Screen S4) — field-by-field

One leaf at a time, full screen, zero clutter. Layout top-to-bottom:

1. **Header strip:** batch name + progress (`Shielding — mortars · leaf 7 of 27`), session
   identity chip, pause button.
2. **The leaf, in words (read before typing):**
   - `name` (doctrinal) and `plainName` (plain language) — both, per the D23 convention.
   - `definition` — the 2–3 sentence statement of what is being measured, *including
     measurement convention* ("horizontal thickness, interior face to exterior face…").
   - **Unit, huge:** `Enter in: FEET (ft)` — with the alternate-unit affordance (§2.7).
   - `pubPointer` — where-to-look guidance (value-free).
   - **Consumers panel:** "This number becomes: → roof thickness in the section drawing ·
     → sandbag count in the BOM · → the ENGINEERED ROOF trigger if exceeded by span" —
     generated from `schema.consumers`, so the operator always knows the blast radius of
     the keystroke.
3. **Live preview (right half / lower half on small screens):** the *real* section or plan
   render for a representative input preset that consumes this leaf, with this leaf's
   token highlighted in accent color. The moment a valid value is typed, the token becomes
   the number *in place*, dimension line and all, and dependent quantities that just
   became computable un-token. (This is §1.5's partial-compute doing its job: the preview
   is the production renderer on the production engine with the draft fill.)
4. **Citation block (before the value, deliberately — read the pub, cite it, then type):**

   | Field | Type | Rules |
   |---|---|---|
   | Publication | select from S2 registry, required | + `Register new…` inline |
   | Paragraph / page | text, required | e.g. `¶ 5-238 / p. 5-41` |
   | Table / figure | text, optional-but-prompted | e.g. `Table 5-2, row "82 mm", col "sandbagged soil"` |
   | Quote (optional) | short text | verbatim phrase around the value — powerful forensics, kept optional to respect handling rules |

5. **Value entry:**
   - Single input, digits only + decimal point; unit label rendered *inside* the field
     edge (`[ 3.5 ] ft`).
   - **Structural bound check, live:** out-of-bound input turns the field red with the
     bound stated in words ("a thickness must be greater than zero"). Hard bounds cannot
     be typed past (§3.5).
   - **Read-back line, always visible under the field:** the value re-rendered three ways
     — words, canonical unit, and both display conversions:
     `three point five feet · 3.5 ft = 1.07 m = 42 in`. The conversion echo is the
     cheap-and-constant wrong-unit tripwire: an operator who typed the pub's *42* (inches)
     into a feet field reads back "42 ft = 12.8 m" and stops (§7 row F4).
6. **Action row:** `Record entry` (primary) · `Flag: not in this pub` (records
   `NOT_IN_PUB`, leaf returns to queue tagged for a different pub) · `Skip for now` ·
   `Note…`.
7. On `Record entry`: an `entry` audit event is appended (leaf id, RawEntry, citation ref,
   identity, attested time, prevHash chain), the preview animates the landing, and the
   next leaf in the batch loads. **No modal confirmation** — the read-back line is the
   confirmation, and pass B is the real defense; a second modal would train click-through.

### 2.6 What the preview must show (so "right value, wrong leaf" dies on screen)

For each batch the Fill Station picks a **preview preset** (position/threat/soil chosen so
the leaf is live in the render — chosen by the schema author per batch, stored in the
schema). The highlighted landing site makes leaf-swaps visible: if the operator is holding
the 82 mm row of the pub but the screen is highlighting the *120 mm* dimension line and
the header says 120 mm, three cues disagree with the pub in their hand. For non-drawable
leaves (labor rates, factors), the preview is the relevant panel row (labor table, BOM
line) with the same token-to-number animation.

### 2.7 Unit conversion at entry (wrong-unit defense, designed not warned)

If the pub states the value in a unit other than the leaf's canonical unit, the operator
does **not** convert in their head. Tapping the unit label opens the conversion entry:

- `Pub states this value in: [in] [cm] [m] [yd] …` (unit set filtered by leaf kind).
- Operator types the pub's number in the pub's unit: `[ 42 ] in`.
- The station shows the conversion *as arithmetic*: `42 in × (1 ft / 12 in) = 3.5 ft`,
  requires `Use 3.5 ft`, and records `rawEntry = {text:'42', unit:'in',
  converted:3.5, conversionFactor:1/12}`.
- Conversion factors are the exact physical constants (v1 D6 class — not doctrine).
- The stored value is always canonical; the *file* remembers the pub-unit keystrokes.

### 2.8 Grid entry mode (matrix batches)

The shielding table (17 threats × 9 materials in v1; similar in v2) is pub-shaped: the
publication prints it as a matrix, and transcribing matrix cells through a one-cell-at-a-
time screen invites row/column slips. For batches whose leaves declare `tableLayout`, the
Fill Station offers **grid mode**: the screen renders the empty matrix with the *pub's*
row/column headers, the operator fills row by row, and every cell commit is still a full
`entry` audit event with the batch citation (pub + table ref captured once for the grid,
row/col labels auto-recorded per cell). Grid mode changes presentation only — records,
audit, bounds, read-back (shown in the focused cell's margin) are identical. Pass B for a
grid batch is always run in **per-leaf mode with shuffled order** (never the same grid
walk, to decorrelate transcription errors — §2.9).

### 2.9 Double entry (pass B), batching, pacing, resume

**Blind re-entry — the transcription-error defense (mandatory for every leaf, both
classes):**
- Every leaf must pass **pass B** before commissioning: the leaf is presented with its
  definition, unit, and citation **but not its value**, in **shuffled order**, in a
  **different session** than pass A (enforced: a leaf entered this session is not offered
  for verification this session), and the operator re-derives the value from the pub and
  types it again.
- Match (exact, after canonical parse) ⇒ `verification` recorded (`method: 'self'` or
  `'second-person'` per the session identity's role).
- Mismatch ⇒ **both values are discarded from `value`** (the leaf reverts to null,
  poisoning downstream again — fail-safe), a `MISMATCH` flag + audit event records both
  RawEntries, and the leaf re-queues for a fresh pass A with the mismatch shown *only
  now*: "Pass A: 3.5 ft · Pass B: 4.5 ft — open the pub and resolve; record which was
  wrong in the note." Resolution requires a note.
- **Second-person verification:** if a verifier identity is present, pass B is theirs.
  The file records per-leaf `method`; the commissioning screen totals coverage
  (`214 of 300 second-person, 86 self`) and the commissioning record preserves it. A
  single-operator fill is *allowed* (the owner's stated reality) and *prominently
  recorded* as such (§2.10).
- Honest limits, stated in-app: self-double-entry catches typos and slips; it is weaker
  against a consistent misread (same wrong pub row twice). The mitigations for that class
  are the shuffled order, the different-session rule, the grid/leaf mode alternation, the
  highlighted preview, and the relational checks (§3.5) — and residual risk is declared
  in the failure-mode table (F2), not hidden.

**Batching and pacing (Screen S3 — batch board):**
- The queue is organized by `schema.batch` — one batch ≈ one pub table (target ≤ ~24
  leaves; the shielding matrix splits by threat class: `shielding.small-arms`,
  `shielding.mortars`, `shielding.artillery`…).
- The batch board shows per-batch state: `unstarted / in-entry (n/m) / awaiting
  verification / conflicts (k) / sealed`, plus totals: leaves filled, verified,
  safety-critical remaining — the burn-down the owner watches.
- **Fatigue pacing:** after each batch, and at 45 minutes of continuous entry, the station
  interposes a full-screen break card ("You have entered 31 values in 52 minutes. Error
  pressure rises with fatigue. Seal the batch and stand up."). It is dismissible —
  the operator is an adult — but the dismissal is an audit event (`break-declined`), which
  is exactly the kind of honest record that makes the overall file credible.
- **Batch seal (Screen S6):** ending a batch shows the review grid — every leaf: value,
  unit, citation, pass-B status — and a `Seal batch` act (audit event). Sealing is not
  locking (corrections remain possible, §2.12); it is a recorded "I reviewed this table as
  a whole" checkpoint, and the natural stopping ritual.
- **Resume:** drafts autosave to IndexedDB on every audit event; reopening offers
  `Resume draft (last event #214, 2026-08-01 14:02, batch 'shielding.mortars')`. On every
  batch seal the station **prompts a progress-file export**
  (`sap2-fill-progress.<date>.<eventCount>.<shortHash>.json`) with the instruction to
  keep two copies on separate media — the file, not the browser, is custody.

### 2.10 COMMISSIONING (Screen S8) — the recorded human acceptance act

Reachable only when: class `DOCTRINE` ∧ every leaf has value + citation + verification ∧
zero `MISMATCH`/`REVISIT` flags open ∧ full validation (all §3.5 checks) passes ∧ audit
chain verifies. **Reaching 300/300 changes the state to FILLED-UNCOMMISSIONED and nothing
else — the watermark never clears from a count (INV-4).**

The ceremony, one screen, scrolled top to bottom:

1. **The manifest, in full:** schema version + hash; leaf count (`300/300, 191
   safety-critical`); verification coverage by method; publication registry with every
   currency attestation; waivers in force (§3.5) each with its justification; the fill
   content hash (SHA-256, full) and audit chain head; identity roster.
2. **The commissioning statement**, fixed text, displayed in full, requiring three typed
   acts (typing, not checkboxes — a checkbox is a click, typing is an act):
   - Typed full name (must match a registered identity).
   - Typed literal phrase, verbatim: `I ACCEPT RESPONSIBILITY FOR THESE VALUES` —
     mistyping re-prompts.
   - Typed date (pre-filled from attested clock; confirm or correct).
3. **Statement text (structure; counsel wording pass required — §6.5):** *"I personally
   entered or verified each value listed in this fill against the cited publications. I
   attest the cited editions were current as of the dates recorded. I understand this
   software computed nothing on its own authority: every doctrinal value it will display
   originates from this fill, under my name. I accept the tool will mark its outputs as
   commissioned by me."*
4. **Single-operator disclosure (when applicable):** an extra typed acknowledgment:
   `SINGLE-OPERATOR FILL — no second-person verification was performed`, which is then
   printed in the provenance strip of every artifact (§4.3). Not a punishment — a fact
   that travels with the data.
5. **Optional review-by date** (§4.6) and optional hard-expiry election.
6. `Commission` appends the `commissioning` audit event (closing the chain through the
   record itself), writes `CommissioningRecord` into the fill, and exports the
   **commissioned fill file** with a mandated two-copy prompt. The Fill Station then
   displays the loading instruction for the planner.

```ts
interface CommissioningRecord {
  by: identityId;  typedName: string;  typedPhrase: 'I ACCEPT RESPONSIBILITY FOR THESE VALUES';
  at: AttestedTime;
  contentHash: string;        // SHA-256 of canonical records (§3.4)
  chainHead: string;          // last audit event hash
  schemaHash: string;         // bound at ceremony
  verificationCoverage: { secondPerson: number; self: number };
  singleOperator: boolean;
  waivers: WaiverRef[];       // carried forward verbatim
  reviewBy?: string;          // ISO date, advisory (§4.6)
  hardExpiry?: string;        // ISO date, re-locks (§4.6) — commissioner's election
}
```

**Decommissioning:** the planner offers `Decommission this fill` (state → FILLED-
UNCOMMISSIONED, audit event appended on next Fill Station load of the file). Locking
tighter is always allowed manually; clearing is never manual (INV-4 asymmetry).

### 2.11 Append-only audit log and hash chain

- Event types: `session-start/end`, `identity-created`, `clock-attested`,
  `pub-registered`, `pub-edited`, `entry`, `verification`, `mismatch`,
  `mismatch-resolved`, `correction` (§2.12), `flag`, `note`, `batch-sealed`,
  `break-declined`, `validation-run` (with result summary), `waiver-recorded`,
  `commissioning`, `decommissioned`, `export`.
- Chain: `event.hash = SHA-256(canonical(event without hash) + '\n' + prevHash)`;
  genesis `prevHash = schemaHash`. SHA-256 via WebCrypto (`crypto.subtle`, available
  offline; the FNV-1a of v1 is retired to an 8-char *display* short-code derived from the
  SHA-256, used only for on-screen/print brevity, always alongside "sha256:" prefix
  truncation, e.g. `sha256:ab12ef34…`).
- Append-only is enforced by construction (the station has no delete/edit code path — a
  correction is a *new* event referencing the old, §2.12) and by verification (any
  load re-walks the chain; a broken link ⇒ CORRUPT refusal naming the first bad seq, §4.5).
- The log lives **inside the fill file** (one custody object) and can be exported alone
  as `audit.<shortHash>.json` for review.

### 2.12 Corrections (because a wrong value will be found later)

A commissioned or draft value can be corrected only through the Fill Station: select leaf
→ `Correct value…` → full entry screen with the *old* value, citation, and history shown
→ new entry + new pass B (fresh, blind for the verifier) → `correction` audit event
recording old and new. **Any correction to a commissioned fill voids the commissioning**
(the record is preserved in history; state drops to FILLED-UNCOMMISSIONED; re-commission
required). No silent edits: a value's entire biography — every entry, mismatch,
correction, verification — is reconstructable from the chain.

### 2.13 Fill Station training mode (practice without touching anything real)

A built-in **practice schema** (5 fictitious leaves, unit `ft`, fake pub `EX-0
"Example Field Manual (fictitious)"`) lets a new operator run the entire loop — identity,
citation, entry, mismatch, batch seal, even a mock commissioning that ends in a
"practice complete, nothing was produced" card. Practice state is memory-only, cannot be
exported, and shares no storage with real drafts. This is how the *owner* rehearses the
workflow before the real 300 — the highest-leverage error-rate reduction available.

---

## 3. Part III — THE FILL FILE FORMAT

### 3.1 Design goals

Versioned and migratable; validated all-or-nothing with per-leaf and relational checks;
prototype-pollution-safe; hash-attributed end-to-end; readable by a human with a text
editor (JSON, ordered, commented-by-structure) because a file the owner cannot inspect is
a file the owner cannot vouch for.

### 3.2 Layout

Extension `.sap2fill.json`. Top-level, in fixed key order:

```jsonc
{
  "format": "sap2-fill",
  "fillFormatVersion": 1,          // FILE SYNTAX version — migration chain applies (§3.6)
  "schemaVersion": "2.0.0",        // human-readable schema tag
  "schemaHash": "sha256:…",        // binds this fill to one exact leaf catalog (§3.4)
  "appVersionAtExport": "2.0.0",   // informational only — never gates loading
  "fillClass": "DOCTRINE",         // DOCTRINE | TRAINING | TEST
  "fillId": "uuid",
  "banner": "SAP-2 fill. Class DOCTRINE. Values herein were entered by the identified
              persons against the cited publications. The software authored none of them.",
  "identities":   [ { "id": "id-1", "fullName": "…", "rank": "…", "org": "…", "initials": "…" } ],
  "publications": [ { "id": "pub-1", "designation": "…", "title": "…", "edition": "…",
                      "date": "…", "currencyAttestation": "…", "handling": "CUI" } ],
  "records": [                     // sorted by leafId — canonical order
    {
      "leafId": "shield.mortar_82.sandbagged_soil",
      "value": 3.5,                // canonical unit, or null (unfilled)
      "unit": "ft",                // MUST equal schema unit verbatim (validator, §3.5)
      "citation": { "pubId": "pub-1", "para": "…", "page": "…", "tableRef": "…", "quote": "…" },
      "entry":        { "by": "id-1", "at": { "clock": "…", "confirmed": true },
                        "raw": { "text": "42", "unit": "in", "converted": 3.5,
                                 "conversionFactor": 0.08333333333333333 } },
      "verification": { "by": "id-2", "at": {…}, "method": "second-person", "raw": {…} },
      "flags": [], "note": ""
    }
  ],
  "audit": [ { "seq": 0, "type": "session-start", "actor": "id-1", "at": {…},
               "payload": {…}, "prevHash": "sha256:<schemaHash>", "hash": "sha256:…" } ],
  "commissioning": { … },          // §2.10 — present only on a commissioned DOCTRINE fill
  "manifest": { "contentHash": "sha256:…", "chainHead": "sha256:…", "recordCount": 300 }
}
```

### 3.3 Loading pipeline (planner side) — order matters

1. **Parse safely.** `JSON.parse` → immediately deep-copy into null-prototype objects
   (`Object.create(null)`), rejecting the dangerous keys (`__proto__`, `prototype`,
   `constructor`) at any depth (v1's check, kept) *and* never merging parsed data into any
   live object — the fill becomes a frozen immutable value, so pollution has nothing to
   pollute. Size cap (2 MB) and entry cap before parse-heavy work.
2. **Format gate.** `format === 'sap2-fill'`; `fillFormatVersion` ≤ current, else refuse
   ("file is from a newer app"); if older, run the migration chain (§3.6) — on the parsed
   copy, never on disk.
3. **Class gate.** Shipped planner refuses `TEST`. `TRAINING` caps the watermark (§1.6).
4. **Schema binding.** `schemaHash` equality against the compiled schema. Mismatch does
   **not** refuse the load — it forces the STALE path (§4.4): records for leaf ids that
   still exist and whose unit+bounds are unchanged load as *values*; everything else
   loads as null; the commissioning record is displayed but **not honored**.
5. **Integrity.** Recompute `contentHash` over canonical records; re-walk the audit chain
   to `chainHead`; verify the commissioning record's hashes match. Any failure ⇒ the
   CORRUPT refusal (§4.5): the fill does not load *at all* (no "best effort" partial trust
   of a file that fails integrity), with a report naming the first divergence.
6. **Validation (all-or-nothing).** Every check in §3.5. One failure ⇒ nothing loads;
   the report lists every failure with leaf id, reason, and the exact text to check.
   Dry-run mode returns the same report without loading (the Fill Station uses the same
   function continuously, so a failing file can never be *produced* by the station —
   this path exists for hand-edited or damaged files).
7. **Commit.** The immutable `Fill` value is handed to the app; watermark state computes
   (§4.2); an app-local (not in-file) load event is noted in the planner's diagnostics.

### 3.4 Canonicalization and hashing (deterministic, specified, tested)

- **Canonical record line:** `leafId + '' + canonicalNumber(value) + '' + unit
  + '' + citationKey` — unit-separator-delimited to make delimiter injection
  impossible; records sorted by `leafId` (binary order); joined by `\n`.
- **`canonicalNumber`:** shortest round-trip decimal (ECMAScript `Number → String`),
  `null` literal for unfilled — no locale, no trailing zeros.
- **`contentHash`** = SHA-256 of the joined lines prefixed by
  `schemaHash + '\n' + fillClass + '\n'` — so class and schema binding are inside the
  hash (a TRAINING file cannot be re-labeled DOCTRINE without changing every downstream
  hash including the chain, §1.6).
- **`schemaHash`** = SHA-256 over the canonical serialization of every `SchemaLeaf`'s
  `(id, unit, kind, bounds, divisor, integer, roundingDirection, safetyCritical,
  relations)` sorted by id — *presentation fields (names, definitions, pubPointer, batch)
  are excluded*, so copy edits don't stale fills but any change to meaning-bearing fields
  does.
- The full spec ships as `docs/HASHING.md` with test vectors; a cross-check test computes
  the vectors from the spec text's examples.

### 3.5 Validation catalog (the v1-importer-accepts-0 class, fixed by design)

**Tier 0 — envelope:** format id, version, class, caps, pollution keys, identity/pub
referential integrity (every `by` resolves, every `pubId` resolves), audit chain, hashes.

**Tier 1 — per-leaf HARD checks (unwaivable; violation is incoherence, not doctrine):**

| Check | Rule | Kills which v1 gap |
|---|---|---|
| Known leaf | `leafId` ∈ schema (or alias map §3.6) | v1 had this |
| Type/finite | number, finite, not NaN | v1 had this |
| **Unit equality** | `record.unit === schema.unit` verbatim | v1 finding 27 (no unit check) |
| **Structural bounds** | per-leaf `{min?, max?, exclusiveMin?, exclusiveMax?}` from schema | v1's single global `0 ≤ v < 1000` |
| **Divisor guard** | `schema.divisor ⇒ value > 0` (compiler forces `exclusiveMin ≥ 0` on divisor leaves; a build gate greps engine division sites against the divisor flags) | v1 §6B-5: `sandbag.L = 0` accepted |
| Integer leaves | `schema.integer ⇒ Number.isInteger` | new |
| Precision cap | ≤ `maxDecimals` (default 4) — a 12-decimal "doctrinal" value is a transcription artifact | new |
| Citation completeness | DOCTRINE class ⇒ citation with registered pub + non-empty para/page; verification present; identities resolve | new |

Structural bounds are **physics/arithmetic only** — `thickness > 0`, `share ∈ [0,1]`,
`factor > 0`, `swell ≥ 1`, `angle ∈ [0,360)` — never doctrinal ranges ("cover is usually
1.5–4 ft" is a value-shaped claim and is banned from the schema by the same no-numbers
gate, with an allowlist for the pure-logic bounds, each code-reviewed).

**Tier 2 — relational checks.** Two sub-tiers:

*Tier 2a HARD (arithmetic coherence, unwaivable):*
- **Sum groups:** declared groups must sum to 1 ± 1e-9 (e.g. the excavation-split shares —
  v1 accepted a 1.7 total).
- **Chain completeness:** a monotonic chain with any member filled and any member null is
  reported (all-or-nothing makes this moot at load; in the Fill Station it drives the
  "finish the table" nudge).
- **Cross-field identities** the schema declares (e.g. a per-bag volume leaf, if present,
  must equal L×W×H within tolerance — only where the schema declares a derivation).

*Tier 2b DECLARED EXPECTATIONS (waivable with recorded justification):*
- **Monotonicity:** within a threat class ordered by caliber, shielding thickness per
  material is non-decreasing; standoff non-decreasing (v1's D16 lock, now validated at
  import instead of assumed); span-limit tables monotone in the declared direction;
  soil dig-difficulty ordering if the schema declares one.
- **Cross-material sanity relations** the schema explicitly declares (only relations a
  pub could *conceivably* contradict go here).
- **Waiver mechanics:** a violated expectation blocks the fill **unless** the fill carries
  a waiver `{checkId, leafIds, justification (required, free text), citation, by, at}`,
  recorded via the Fill Station's conflict screen. Rationale: if the current pub genuinely
  prints a non-monotonic row, the tool must not coerce false data to satisfy a checker —
  but silent acceptance is worse, so the deviation becomes a first-class, attributed,
  commissioned-screen-visible record. Waivers print in the provenance annex (§4.3).

**All-or-nothing:** one Tier-0/1/2a failure or unwaived 2b ⇒ the entire file refuses to
load and nothing mutates (there is nothing *to* mutate — the fill is a value — but the
semantic holds: the app never runs on a partially-accepted file).

### 3.6 Versioning and migration

- **`fillFormatVersion`** (file syntax) migrates through an explicit, tested chain
  (`migrate1to2(parsed) → …`). Migration rules: (1) **never alter value bytes** — a
  migration reshapes envelope/metadata only; a property test extracts `(leafId, value,
  unit)` tuples before/after and asserts equality; (2) a migration that cannot carry a
  field forward drops it to null/absent and lists it in the migration report — it never
  guesses; (3) migrations run on the in-memory copy; the station offers to export the
  migrated file as a new file (originals are never overwritten).
- **Schema evolution** is *not* migration — it is the STALE path (§4.4) + delta-fill:
  renamed leaves carry an `aliases: {oldId: newId}` map in the schema (unit/meaning
  unchanged only); a changed unit or bound **invalidates** stored values for that leaf to
  null (never auto-converts — conversion is an entry act with a human, §2.7).
- **`appVersionAtExport`** is informational; compatibility is governed solely by
  `fillFormatVersion` + `schemaHash` (an app patch that doesn't touch the schema neither
  stales nor blocks anything — INV-13's stamped app version still discloses skew).

---

## 4. Part IV — OUTPUT PROVENANCE, WATERMARK STATES, RE-LOCK SEMANTICS

### 4.1 The rule: no unmarked artifact, ever

Every rendered or exported surface carries exactly one of: a **warning watermark**
(TEMPLATE / TRAINING / UNCOMMISSIONED / STALE) or a **provenance strip** (COMMISSIONED).
There is no state in which a page leaves the tool carrying neither. The strip is small and
constant; the watermark is loud and diagonal. (v1's banner disappeared entirely at
count-zero — a blank space where accountability should be. v2's commissioned artifacts are
*positively attributed*, not merely un-warned.)

### 4.2 Watermark state machine

State is a pure function — `state(fillClass, integrity, schemaMatch, commissioning,
completeness, clockAdvisories)` — computed at load and displayed identically in the top
bar, the 2D/3D canvases, prints, and exports.

| State | Condition | Canvas treatment | Print/export treatment | Compute behavior |
|---|---|---|---|---|
| **TEMPLATE** | no fill loaded | slate badge; token dimensions; blueprint 3D; `NO SCALE — TEMPLATE` | diagonal `TEMPLATE — NO DATA`; tokens | full structure, zero numbers |
| **TRAINING** | fill class TRAINING | purple badge; diagonal `TRAINING — VALUES FICTITIOUS` repeated across canvas | same diagonal + per-drawing fictitious-values line | full compute on training values |
| **FILLED-UNCOMMISSIONED** | DOCTRINE fill, integrity OK, schema match, no (honored) commissioning | red badge `NOT FOR FIELD USE — UNCOMMISSIONED`; diagonal watermark; unfilled leaves (if partial) still tokens | diagonal watermark + remaining-count line | full compute on filled leaves; poisoning for nulls |
| **COMMISSIONED** | DOCTRINE fill, integrity OK, schema match, valid commissioning record | no watermark; **provenance strip** (§4.3) pinned in the corner of every drawing | provenance strip in header + footer of every page; citation annex available | full compute |
| **STALE** | fill's `schemaHash` ≠ app's | red badge `STALE DATA — SCHEMA CHANGED (n new / m changed leaves)`; diagonal watermark | diagonal watermark + delta summary | carried leaves compute; new/changed leaves are null ⇒ poison |
| *(CORRUPT — a refusal, not a state)* | integrity/validation failure | fill does not load; app remains in prior state (or TEMPLATE) with a full-screen report | n/a — nothing to print | none |

Transitions worth pinning:
- FILLED-UNCOMMISSIONED → COMMISSIONED: **only** via a commissioning record minted by the
  Fill Station ceremony (§2.10) and verified at load. Never by count, never by toggle.
- COMMISSIONED → FILLED-UNCOMMISSIONED: decommission act, or any correction (§2.12).
- COMMISSIONED → STALE: app update whose schemaHash differs (re-lock on update, §4.4).
- Any → CORRUPT-refusal: integrity failure at load. Fail closed, name the divergence.
- Hard expiry (if elected, §4.6) reached: COMMISSIONED → FILLED-UNCOMMISSIONED at load
  time with reason `hard-expiry`, honoring the commissioner's own election.

### 4.3 What every artifact stamps (field-by-field)

**Provenance strip (COMMISSIONED)** — on every drawing corner, job-sheet header+footer,
SVG export `<g id="provenance">`, CSV header records, JSON export `provenance` object:

```
DATA: sha256:ab12ef34… (fill 300/300) · COMMISSIONED BY J. Q. Sapper, SSgt · 2026-09-14
SCHEMA v2.0.0 (sha256:c0ffee12…) · APP v2.0.3 · [SINGLE-OPERATOR FILL] · [2 WAIVERS — see annex]
Planning aid — verify against current publications. Not a substitute for engineer judgment.
```

Bracketed items appear only when true. The last line is the always-on claims boundary
(§6.2) and never drops off.

**Warning watermark states** stamp the same identity block (fill short-hash if any, schema,
app version) *plus* the loud diagonal — so even a watermarked page is attributable.

**Job-sheet "Governing values" block (safety-critical citations on the page):** the
engineer-handoff block (v1 Phase 3) grows a table of the safety-critical leaves in the
*active dependency cone of this exact result* (typically 4–8 rows):

| Governing value | Value | From | Entered / verified |
|---|---|---|---|
| Overhead cover thickness — 82 mm mortar | 3.5 ft | [pub designation, ed.], ¶/table ref | JQS / ABC |

Bounded by design (only leaves this result consumed, only safety-critical), machine-
generated from the same provenance the tap-to-explain trace uses — the drawing's numbers
and the citation table cannot disagree because they are one dataset (INV-8).
A **full citation annex** (every consumed leaf) is an optional job-sheet page.

**CSV:** provenance as leading comment-convention records + a `provenance` column per data
row (fill short-hash), and all cells formula-injection-escaped (leading `= + - @ \t` are
prefixed with `'`) — closing v1 audit finding 39.

**Downloaded SVGs:** self-contained by contract — embedded `<style>` with resolved
literal colors, embedded provenance group, title block. (Closes v1 §6B-1: exported
drawings that render black outside the app. The v2 export test opens the SVG string
standalone and asserts no `var(--` remains.)

### 4.4 Re-lock semantics when the schema changes (STALE, delta-fill, re-commission)

1. App update adds/changes leaves ⇒ new `schemaHash`. Loading yesterday's commissioned
   fill: identity preserved, values for unchanged leaves compute, **but the commissioning
   is not honored** — state STALE, watermark up. Rationale: the commissioner attested a
   specific leaf catalog; the app now computes with a different one; silence would extend
   an attestation to data it never covered.
2. The planner shows the **delta report**: `2 new leaves (null): ohc.sheathing_thickness,
   ohc.dustproof_thickness · 1 changed unit (value dropped): sump.gravel_volume · 297
   carried.` New/changed leaves are null and poison exactly their own dependency cones —
   the rest of the tool remains fully useful under the watermark.
3. **Delta-fill:** the Fill Station opens the fill against the new schema, queues *only*
   the delta (plus any leaves whose stored values Tier-2 checks now implicate), runs the
   normal entry+verification loop, then requires a **full re-commissioning ceremony** —
   the attestation always covers the whole fill, never an increment. The old commissioning
   record remains in the audit history; the new one supersedes it.
4. Pure copy edits (names, definitions, pubPointer) do not change `schemaHash` (§3.4) and
   neither stale nor re-lock anything.

### 4.5 Corruption handling (storage rot, partial writes, hand edits)

Any integrity failure (content hash, chain link, commissioning hash, JSON damage) ⇒ the
file refuses to load with a report: `Integrity failure at audit seq 214: stored hash
sha256:… ≠ recomputed sha256:… . This file has been altered or damaged since it was
written. Load a known-good progress or commissioned file.` The planner never "repairs" a
fill and never loads the intact prefix — a file that fails integrity is evidence, not
data. Recovery is the owner's two-copy custody discipline (prompted at every batch seal
and every commissioning, §2.9/§2.10).

### 4.6 Time-based staleness (pubs age; the engine stays clock-free)

- At commissioning the owner may set **review-by** (advisory) and **hard-expiry**
  (re-locking) dates (§2.10). The *engine* never reads a clock; the *UI shell* compares
  the device clock (displayed, so a wrong clock is visible) to these dates at load:
  - review-by passed ⇒ persistent amber chip `PUB REVIEW DUE (set by commissioner for
    2027-09-14)` + a job-sheet line. No re-lock (a wrong device clock must not be able to
    *falsely* imply currency — and a chip that can be wrong is safe; a lock that can be
    wrong in the *open* direction is not, which is why review-by never *clears* anything).
  - hard-expiry passed ⇒ state drops to FILLED-UNCOMMISSIONED with reason. Fails closed
    on a fast clock — accepted: the commissioner opted into that tradeoff explicitly.
- Independently, every provenance strip carries the commissioning **date**, so every
  printed page discloses its own age with no clock at all.

---

## 5. Part V — FAIL-SAFE INVARIANTS (v2 requirements, enforced by gates)

Each is a *requirement with an enforcement mechanism*, not a convention. "Gate" means a
test or build check that fails CI when violated.

| # | Invariant | Carried/extended from | Enforcement gate |
|---|---|---|---|
| **INV-1** | **Engineered-roof zero-fabrication.** Direct-fire AT and large-VBIED (and any span beyond the filled span table) resolve to `engineered_required` through the single cover authority. No leaf exists whose value could produce an AT roof thickness — the routing is schema structure, so **no fill can unlock it**. Renders show the ENGINEERED ROOF hazard block at every stage in 2D and 3D. | v1 §2.7 / D29, strengthened (structural, not data) | protection tests: every AT/VBIED threat × any complete fill ⇒ thickness absent; schema gate: no leaf id under `shield.*` exists for engineered-class threats |
| **INV-2** | **Unknown ⇒ fail-safe.** Unknown threat/soil/position/revetment ids, out-of-table spans, unresolvable lookups: never a default number — either the engineered path or a validation error that blocks the artifact. | v1, kept | fuzz over invalid ids |
| **INV-3** | **Unfilled ⇒ visible absence.** A null leaf poisons its dependency cone into typed `Unfilled`; renders show tokens; no partial sum presents as a total; no default, no NaN. | new (§1.5) | type-level (no raw extraction API) + empty-fill property test |
| **INV-4** | **Trust requires a human act; distrust doesn't.** Watermark clears only via a verified commissioning record; count-zero changes nothing. Manual actions can only move trust *down* (decommission), never up. | replaces v1 count-driven banner | state-machine tests incl. "300/300, no ceremony ⇒ still watermarked" |
| **INV-5** | **No doctrinal magnitude in the artifact.** Shipped source, bundles, and docs contain zero numeric doctrinal values and zero embedded fills. The number-free gate scans the **entire suite** (every `src/` module of every tool — the TIMBER-1 exemption class is dead), with an explicit allowlist for exact physical constants (D6 class) and presentation geometry, each annotated in code. | v1 §2.4, scope-fixed (§6C-N13) | source-scan gate + artifact-scan gate on `dist/` |
| **INV-6** | **The fill is an immutable input.** `compute(inputs, schema, fill)`; no module-load doctrine reads; no global mutation; fill identity rides inside `Result`. | fixes v1 §6B-2 class | grep-gate: no doctrine import outside the resolver; determinism test: two fills alternated in one session never cross-contaminate results or stamps |
| **INV-7** | **All-or-nothing data admission.** A fill loads whole or not at all; validation failures name every reason. | v1 io, extended | io tests (incl. every §3.5 rule rejecting) |
| **INV-8** | **One provenance dataset per artifact.** Stamp, governing-values table, tap-to-explain, and drawing numbers derive from the same `Result`+`Fill` pair; a renderer cannot receive numbers and stamp from different fills. | new | render API takes `(Result)` only; stamp-vs-trace consistency test |
| **INV-9** | **No fill ships.** Release artifacts contain no fill payload of any class; shipped planner refuses class TEST. | new | artifact scan for `"format":"sap2-fill"` + class gate test |
| **INV-10** | **Every leaf has ≥1 consumer.** No verification make-work; the fill burden is exactly the set of numbers the tool uses. | v1 Phase 2.8 intent, regressed (§6C-N6); now hard | build gate: consumer refs resolve to real modules; engine-coverage test drives every leaf into ≥1 result |
| **INV-11** | **Every displayed number explains itself.** Any rendered quantity traces to (leaf values + formula) via tap-to-explain, with citation surfacing for leaf operands; derivation formulas are generated from the same code path that computes (no hand-written formula strings drifting from the arithmetic — v1 §6C-N1's ramp-omission lie becomes impossible, not just fixed). | v1, hardened | explain tests: operand sets equal compute dependency sets |
| **INV-12** | **Determinism incl. identity.** Same `(inputs, schema, fill)` ⇒ byte-identical SVG/CSV/JSON/job-sheet incl. provenance block. No clock/randomness in engine or renderers (timestamps enter only from fill data and print-time UI fields the user sees). | v1, extended | byte-equality tests |
| **INV-13** | **Every artifact is marked.** Warning watermark or provenance strip — never neither; watermark states also stamp identity. | new (§4.1) | render tests per state |
| **INV-14** | **Fail closed on integrity.** Hash/chain/commissioning verification failure ⇒ refusal (prior state kept), never partial trust. | new | corrupted-fixture tests (bit-flip matrix over sections) |
| **INV-15** | **Units are exact and singular.** One canonical unit per leaf; display conversion by exact constants; import requires unit equality; entry-time conversion is explicit, shown, and recorded. Metric/imperial toggle can never change stored or computed values. | v1 D6/§2.8 + finding 27 fix | units tests; import unit-mismatch rejections |
| **INV-16** | **Rounding direction is per-leaf policy.** Derived safety displays round protective quantities up and capacities down per `schema.roundingDirection`; entered values display verbatim. | new | rounding-direction tests over SC leaves |
| **INV-17** | **Divisor totality.** Every division site in the engine divides by a leaf flagged `divisor` (bounds exclude 0) or by a code-guarded non-zero expression. | fixes v1 §6B-5 downstream class | static scan of engine division sites vs schema flags |
| **INV-18** | **Suite-wide single regime.** Any additional tool in the artifact (TIMBER-2 etc.) registers its leaves in the same schema, same fill, same watermark, same gates — a second uncounted tool cannot exist because the gates scan by directory glob `src/**`, not by allowlist. | lesson of §6C-N13 | gate scope = whole source tree |
| **INV-19** | **Claims discipline in copy.** UI/doc copy never contains the banned claim phrases (§6.3); mandatory boundary phrases present on required surfaces. | new | wordlist source gate |

---

## 6. Part VI — THE LEGAL SHELL (structure only — counsel/JAG review required)

> This section designs documents, flows, and software claims. It is **not legal advice**;
> every item in §6.5 must be reviewed by qualified counsel (and, for military fielding,
> the appropriate JAG / S-6 channels) before distribution or field use.

### 6.1 Document set (shipped in-app and as files)

| Doc | Contents (structure) | Surfaced where |
|---|---|---|
| `CONDITIONS_OF_USE.md` | what the tool is (deterministic geometry/arithmetic on user-supplied values); what it is not (no doctrinal data as shipped; not a substitute for publications, orders, or engineer judgment); qualified-user expectation; no-warranty/AS-IS language (aligned with LICENSE — counsel to reconcile MIT wording with these terms) | first-run gate; linked from every state badge; abbreviated on every job sheet |
| `DATA_GOVERNANCE.md` | this regime, user-facing: fill classes, commissioning, watermark states, corrections, custody guidance (two-copy rule, air-gap posture) | Fill Station help; README |
| `SOFTWARE_CLAIMS.md` | the claims ledger (§6.3) verbatim — what the software asserts and never asserts | repo + in-app about |
| `PROVENANCE_SPEC.md` + `docs/HASHING.md` | file format, canonicalization, hash vectors — so a third party can independently verify a fill | repo |
| `HANDLING.md` | CUI posture (v1 D31 logic carried: empty shell unrestricted; filled output may be CUI — mark per the fill's registered pub handling flags; "clear with your S-6" retained) | export dialogs when any registered pub is marked CUI |
| `COUNSEL_REVIEW.md` | the open flags list (§6.5) — shipped in repo so the review debt is never invisible | repo |

### 6.2 Acknowledgment flow (who affirms what, when)

1. **First run (any state):** one-screen conditions gate; scroll-to-end + `I understand`;
   choice persisted locally with app version (re-shown on version change of the
   conditions text). Light by design — TEMPLATE mode endangers no one.
2. **Loading any DOCTRINE fill:** interstitial naming the fill (`hash, entered by,
   commissioned or not`) + one line: "You are loading values entered by a person, not by
   this software. Verify provenance before relying on outputs." `Load` proceeds.
3. **Commissioning:** the full typed ceremony (§2.10) — the load-bearing acknowledgment.
4. **Print/export in COMMISSIONED state:** no extra modal (friction there trains
   click-through); the artifact itself carries the strip + boundary line (INV-13).
   In watermarked states the print dialog states the watermark reason once.
5. **Decommission / delete fill:** type the fill short-hash to confirm (destructive-act
   confirm pattern; also answers v1 audit findings 58–61 for this surface).

### 6.3 The claims ledger (what the software says about itself — enforced by INV-19)

**The software asserts, and may assert:**
- "Computes geometry, quantities, and schedules deterministically **from values you
  supplied**."
- "As distributed, contains **no** doctrinal protection values."
- "Records who entered and verified each value, and against which cited publication."
- "Marks every output with its data's provenance state."
- "Refuses to present AT / large-blast roof designs — see an engineer." (INV-1)

**The software never asserts (banned phrases gate — wordlist maintained in
`SOFTWARE_CLAIMS.md`):** "doctrinally correct/approved", "certified", "compliant with
[pub]", "engineer-approved", "safe", "rated to stop", "no further verification needed",
or any unqualified imperative of safety ("this position will protect against…"). The
renderer phrase for filled values is always attributive: *"per your commissioned data"* —
the tool reports the consequences of the user's values; it does not endorse them.

**Mandatory boundary line (every artifact, all states, verbatim):**
`Planning aid — verify against current publications. Not a substitute for engineer judgment.`

### 6.4 CUI / handling posture (structure; confirm with S-6 — carried from v1 D31)

- Empty shell (TEMPLATE): no controlled content; distribution unrestricted.
- Fill files and commissioned outputs: handling driven by the **pub registry's handling
  flags** (§2.4) — if any cited pub is marked CUI, exports and job sheets auto-carry the
  CUI handling line and the export dialog shows `HANDLING.md`. The tool *propagates* the
  owner's marking decisions; it never decides classification itself (a claim it must not
  make, per §6.3).

### 6.5 Counsel-review flags (the explicit open-questions list for a lawyer, not for us)

1. Enforceability and proper wording of the first-run conditions gate and the typed
   commissioning attestation (browsewrap/clickwrap adequacy; whether typed-name
   attestations should reference penalty-of-perjury language or explicitly avoid it).
2. Reconciling the MIT license's warranty disclaimer with the conditions-of-use text;
   whether a different license or an additional terms layer is needed.
3. CUI marking correctness: whether fill files, job sheets, and the pub-registry metadata
   themselves require marking; interaction with distribution statements on cited pubs.
4. Export control (ITAR/EAR) posture of the empty shell vs. a commissioned fill; whether
   the *schema* (leaf names describing protective-construction quantities, value-free)
   raises any issue.
5. Records implications of identity capture (names/ranks in fill files): retention,
   privacy-act posture if used officially.
6. Whether the "single-operator fill" disclosure and waiver annex language are adequate
   risk disclosures or need strengthening.
7. Product-liability review of the claims ledger and boundary line wording; negligent-
   misrepresentation exposure of the *plain-language definitions* in the schema (they
   describe what a value means — the closest the software comes to doctrinal content).
8. Whether commissioning by a person without stated qualifications requires a
   qualifications field (currently free-text rank/title only, by design — the tool does
   not adjudicate who is "qualified", it records who acted; counsel to confirm this is
   the right posture).

---

## 7. Part VII — FAILURE-MODE TABLE (every way a wrong number could still reach a page)

Layered notation: **P** = prevention, **D** = detection, **A** = attribution/containment.
"Residual" states honestly what survives all layers.

| # | Failure mode | Path to a printed page | Mitigations | Residual risk |
|---|---|---|---|---|
| F1 | **Typo at entry** (finger slip: 3.5 → 5.3) | entry → print | P: bounds; read-back words+conversions (§2.5); D: blind pass B different session, shuffled (§2.9) — independent slips collide with p≈0 | negligible unless F2 |
| F2 | **Same wrong value twice** (anchored misread; pass B recalls pass A) | both passes agree → commissioned | P: different-session rule; shuffle; value masked in pass B; grid↔per-leaf mode alternation; D: Tier-2 relational checks (a wrong cell usually breaks monotonicity/sum); second-person verification when available; batch-seal review grid; A: citation on the job sheet invites reader cross-check | **real residual** — declared: an isolated, relations-silent consistent misread survives; disclosed in DATA_GOVERNANCE.md; strongest answer is second-person verification, recorded when absent |
| F3 | **Fatigue burst errors** (late-session error cluster) | multiple bad entries | P: batch caps, 45-min break cards, seal ritual; D: mismatch-rate visible per session; pass B in a *later* session catches the burst wholesale | low |
| F4 | **Wrong-unit transcription** (pub prints inches, typed as feet) | entry → print | P: unit huge on screen; in-field unit label; conversion entry is the designed path (§2.7) — head-math is never required; D: read-back echo ("42 ft = 12.8 m" is visibly absurd); bounds catch gross cases; pass B re-derives incl. unit | low; conversion path recorded for forensics |
| F5 | **Right value, wrong leaf** (82 mm value into 120 mm cell) | entry → print | P: one-leaf-at-a-time screen with definition + consumers; grid mode mirrors the pub's table shape; live preview highlights the landing site (§2.6); D: monotonic-chain checks (a swapped pair usually breaks ordering); pass B shows definition + citation, so the verifier re-finds the *cited* cell | low-moderate; adjacent-cell swaps that preserve monotonicity survive relations — caught only by pass B / batch review |
| F6 | **Right leaf, wrong pub row cited** (value fine, citation off-by-one) | wrong citation printed beside right value | D: pass B navigates *by the citation* — a bad citation sends the verifier to the wrong cell and mismatches; A: quote field | low; damages auditability more than safety |
| F7 | **Stale/superseded publication** | correct transcription of outdated data | P: pub registry requires edition/date + typed currency attestation (§2.4); commissioning re-lists pubs (§2.10); D: review-by chip + hard-expiry (§4.6); commissioning date on every page (§4.3); A: pub edition printed in governing-values table — the reader can see the vintage | moderate — the tool cannot know pub currency; it forces the *human* attestation and prints the evidence |
| F8 | **Fabricated-by-software value** (regression: a default, clamp, or fallback invents a number) | engine → print | P: ship-empty + INV-3 typed `Unfilled` (no default API exists); INV-5 no-magnitude gates; INV-1 structural engineered-roof; D: empty-fill property test (all outputs tokens); fuzz asserts no number appears whose leaf set is empty | very low — this is the class the whole architecture exists to kill |
| F9 | **Right value, wrong *formula*** (structure bug, e.g. v1's stringer-axis or ramp-omission class) | correct data, wrong derived number | P: out of this regime's scope but bounded by it: fidelity statements, INV-11 derivations generated from compute (no drifting formula strings); D: independent re-derivation tests; **the D29-class SME structural review is a v2 gate before any commissioned use** (open risk, restated) | real until SME review happens — data governance cannot fix structure |
| F10 | **Schema/fill mismatch** (old fill, new app) | outdated leaf set feeding new engine | P: schemaHash binding ⇒ STALE state, commissioning not honored, new leaves poison (§4.4); D: delta report; A: strip shows schema hash | negligible |
| F11 | **Storage corruption / bit rot / truncated write** | damaged values load | P: content hash + audit chain verified at every load (§3.3); D: CORRUPT refusal naming divergence; A: two-copy custody prompts | negligible for silent use; availability risk remains (mitigated by copies) |
| F12 | **Hand-edited fill file** (well-meaning "quick fix" in a text editor) | edited value with intact-looking provenance | D: content hash + chain break ⇒ refusal; the *only* sanctioned edit path is the Fill Station correction flow which voids commissioning (§2.12) | edited-*and-rehashed* files: see F16 |
| F13 | **Prototype pollution / hostile file** | crafted JSON alters app behavior | P: parse-to-null-prototype copy, dangerous-key rejection, size caps, no merge into live objects (§3.3) | negligible |
| F14 | **Migration bug corrupts values** | old file → migrated wrong | P: migrations never touch value bytes (property-tested); can't-carry ⇒ null + report (§3.6) | negligible |
| F15 | **Display/unit conversion defect** | correct stored value renders wrong | P: exact constants (INV-15); metric==imperial result tests; rounding-direction policy (INV-16) prevents an unsafe *direction* of error | negligible |
| F16 | **Deliberate forgery** (attacker re-computes hashes, fakes identity) | fully "valid" forged fill | Honest position: the format is tamper-**evident**, not tamper-proof — no secrets exist on an air-gapped device to sign with, and a signature key stored beside the file adds ceremony, not security. Mitigation is **custody** (owner's physical control of machine + files), the attested-not-authenticated identity disclosure (§2.3), and out-of-band hash comparison (owner keeps the commissioned short-hash independently — e.g. written on the printed commissioning summary the station offers) | declared residual; if a stronger story is later required, an optional detached-signature scheme (owner-held key, offline) can layer on without format change (hashes already canonical) |
| F17 | **Watermark cropped from a photo/copy** | screenshot of watermarked screen circulates | P: repeating *diagonal* watermark across the drawing body (not a croppable banner edge) in every non-commissioned state; TEMPLATE has no numbers to steal; TRAINING colors self-identify; A: even cropped fragments carry tokens/diagonals | low; a determined forger defeats any visual mark — the ship-empty decision caps the damage (there is no plausible-but-fake state with real-looking numbers except TRAINING, which is loud) |
| F18 | **Stale cached app shell** (old service-worker code + new fill or vice versa) | version-skewed compute | P: schemaHash check is runtime (skew ⇒ STALE, fails safe); hashed asset names + versioned cache in v2 build (closes v1 §6B-9); strip prints app version (INV-12 stamp) | low |
| F19 | **CSV formula injection** (citation text starting with `=`) | spreadsheet executes on open | P: escape policy (§4.3) | negligible |
| F20 | **Two browser tabs, two fills** (session clobber class, v1 findings 68–69) | tab A prints with tab B's ambient data | P: INV-6 — fill rides inside `Result`; no ambient doctrine state exists to clobber; per-tab load is explicit | negligible by construction |
| F21 | **Renderer truncation/precision** (3.5 shown as 3, or float dust 3.4999…) | rounded-down protective value printed | P: entered values display verbatim (stored decimal string preserved via canonicalNumber); derived values round per INV-16 direction; guard() bans non-finite | negligible |
| F22 | **Wrong structural bound in schema** (a bound that blocks a *true* pub value, or admits absurdity) | owner forced to mis-enter, or nonsense admitted | P: bounds are logic-only (no doctrinal ranges, §3.5) so "blocks a true value" ≈ impossible by policy; D: bound-review is part of schema freeze checklist; the waiver path exists for *expectation*-tier conflicts, never for hard bounds — if a hard bound ever fights a real pub, that is a schema bug fixed by release, not a waiver | low |

---

## 8. Part VIII — Enforcement summary, build order, and open risks

### 8.1 The gate list (what CI must prove on every commit)

1. No-magnitude source gate over `src/**` (INV-5) + artifact scan of `dist/` (INV-9).
2. Empty-fill property suite: no throw, no NaN, zero digits in template renders (INV-3).
3. Validator rejection matrix: every §3.5 rule has a rejecting fixture, incl. `0` on every
   divisor leaf, unit mismatch, sum≠1, monotonicity break without waiver, bad chain,
   edited class, oversized, polluted, newer-version.
4. Hash vectors from `docs/HASHING.md` reproduced.
5. State-machine matrix (§4.2) incl. "complete-but-uncommissioned stays watermarked" and
   STALE re-lock on schemaHash change.
6. Byte-determinism of artifacts incl. provenance blocks (INV-12); standalone-SVG
   self-containment; CSV escaping.
7. Consumer totality (INV-10), divisor totality (INV-17), claims wordlist (INV-19),
   suite-wide gate scope (INV-18).
8. Fill Station flow tests: mismatch discard-and-requeue, different-session pass-B rule,
   correction-voids-commissioning, TRAINING-cannot-commission, practice-mode isolation.

### 8.2 Build order (data-regime workstream only)

1. Schema compiler + leaf catalog (from v1 inventory, value-stripped, + bounds/relations/
   consumers/batches) → schemaHash + gates INV-5/10/17.
2. Fill value type + resolver + `Unfilled` poisoning through engine and renderers →
   TEMPLATE mode renders.
3. Fill file format + validator + hashing + migration skeleton + loading pipeline.
4. Watermark state machine + provenance stamping on every artifact.
5. Fill Station: identity/clock, pub registry, per-leaf screen, preview wiring, grid
   mode, pass B, batches/seals/resume, audit chain.
6. Commissioning ceremony + decommission + corrections + delta-fill/STALE flow.
7. Legal shell docs + acknowledgment gates + claims wordlist gate.
8. TRAINING class + practice mode (demo/training story).

### 8.3 Decisions log (for the SAP-2 decision register)

- **D-DG-1** Ship-empty: zero doctrinal magnitudes anywhere in the shipped artifact;
  `value: null` schema; TEMPLATE mode with token dimensioning.
- **D-DG-2** Fill-as-value: `compute(inputs, schema, fill)`; no global doctrine state;
  provenance rides in `Result`.
- **D-DG-3** Null-poisoning (`Unfilled` type) instead of defaults or refusal-to-run.
- **D-DG-4** Three fill classes; TRAINING never commissionable; TEST never loadable
  shipped; class inside the content hash.
- **D-DG-5** Blind double-entry mandatory for all leaves; different-session + shuffle;
  mismatch discards both values; second person optional but recorded; single-operator
  commissioning disclosed on every artifact.
- **D-DG-6** Commissioning is a typed human ceremony; count-zero changes nothing; manual
  transitions may only reduce trust.
- **D-DG-7** SHA-256 everywhere (content, chain, schema); FNV retired to display
  short-codes; tamper-evident-not-tamper-proof stated openly; custody is the control.
- **D-DG-8** Two-tier validation: hard logic bounds unwaivable; declared doctrinal
  expectations waivable only with recorded justification that prints in the annex.
- **D-DG-9** Unit conversion is an explicit recorded entry act; storage is canonical-unit
  only; import demands unit equality.
- **D-DG-10** SchemaHash binding: mismatch ⇒ STALE, commissioning not honored, delta-fill
  + full re-commissioning; aliases for renames; unit changes drop values to null.
- **D-DG-11** No unmarked artifact: warning watermark or provenance strip, always;
  governing-values citation table on the job sheet.
- **D-DG-12** Suite-wide single regime; gates scan the whole tree (TIMBER lesson).
- **D-DG-13** Stable leaf ids decoupled from code layout; per-leaf bounds incl. divisor
  exclusive-zero; per-leaf rounding direction; consumer refs required.
- **D-DG-14** Time: engine clock-free; attested timestamps in fills; review-by advisory
  never unlocks; hard-expiry (opt-in) re-locks.

### 8.4 Open risks (carried forward honestly)

1. **F2 residual:** a consistent misread that violates no declared relation survives
   double entry. Second-person verification is the real answer; the regime records its
   absence rather than pretending.
2. **Structure ≠ data:** the D29-class SME structural review (ramp/berm/spoil/blade-hour
   models, stringer assembly) is outside data governance and remains a hard gate before
   any commissioned use — a perfect fill through a wrong formula is still wrong (F9).
3. **Attestation is not authentication; hashes are evidence, not locks (F16).** Custody
   is the control and the docs say so.
4. **Counsel/JAG review is unperformed** — §6.5 is a to-do list, not a clearance.
5. **Device-clock trust** for timestamps and expiry is attested, not proven; wrong clocks
   fail in the safe direction by design but can annoy (false hard-expiry lock).
6. **First-run blankness** is a product bet: TEMPLATE mode and TRAINING fills must be
   executed well or ship-empty reads as "broken app" to a casual evaluator.
7. **Schema freeze discipline:** every post-commissioning schema change stales the
   owner's fill and demands a re-commissioning ceremony — correct, but it prices schema
   churn; v2 must freeze the leaf catalog deliberately before the owner's big fill.

*End of blueprint.*
