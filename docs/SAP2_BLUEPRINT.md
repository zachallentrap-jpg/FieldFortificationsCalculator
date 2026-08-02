# SAP-2 BLUEPRINT — Ground-Up Revamp

> **Status:** Synthesized blueprint, merging the four SAP-2 design deliverables
> (liability/data-governance, recruit-experience, backend/schema, scope/sequencing)
> with every adversarial-critique blocker fix applied, majors applied or explicitly
> conflict-resolved, and minors applied by judgment, plus a post-synthesis completeness
> pass (15 gaps patched — B47). Every synthesis judgment call is logged in §9 (B1..B47).
>
> **Not legal advice.** This blueprint designs for maximal liability defensibility by
> architecture. Counsel/JAG review is a scheduled, gate-consuming milestone (§7 R1/R4,
> §2.9), not a footnote. Nothing ships to anyone before that review returns.

---

## 1. Mission & non-negotiables

The owner's mandate, restated as testable requirements:

| # | Mandate (verbatim intent) | Requirement | Where enforced |
|---|---|---|---|
| N1 | "Total ground-up revamping" | SAP-2 is a new `sap2/` tree with its own package/lockfile/CI; v1 is frozen (critical-fix-only) and end-of-lifed (§2.11). Bug *classes*, not bugs, die by construction (§6). | §4, §6, §7 R0 |
| N2 | "No liability issues when I put in the full and complete data one by one" | **Ship-empty**: the distributed artifact contains zero doctrinal magnitudes. Every number the tool ever prints traces to an owner-entered, cited, verified fill entry; trust is conferred only by a recorded human commissioning act; every artifact is marked with its data's provenance state. Data never leaves the device. | §2 entire |
| N3 | "The backend is the real shape — everything deterministic: math, 2D, 3D" | `compute(inputs, schema, fill) → Result`, pure in all arguments; one geometry kernel feeds volume, plan, section, and 3D; renderers project, never re-derive; **byte-deterministic data and vector artifacts** (Result, trace graph, SVG, scene descriptor, fill files) — 3D raster output is asserted at descriptor level, GPU pixel variance sits outside the byte claim. | §4 |
| N4 | "A Marine with no training in diagrams — even a recruit who hasn't finished forming week — can follow it" | The Build Card deck: per-stage, picture-first, body-referenced, pass/fail-checked instruction cards, validated by a human comprehension protocol with hard acceptance bars — including degraded-condition (red light + gloves) passes. | §3 |
| N5 | "Pick what we can realistically perform WELL on" | One position (one_man) to full excellence before breadth; permanent cuts listed with rationale; TIMBER-1 archived; no hub. Fewer things, done excellently. | §5, §7 |

**The two product non-negotiables** every cut in §5 defends: (1) the liability regime
(schema/fill split, Fill Station, commissioning, watermark states); (2) the recruit-proof
output path (build cards + job sheet).

---

## 2. The liability architecture

### 2.1 The spine (three sentences)

1. **The schema is code; the data is a file; the two never mix.** SAP-2 source defines
   every leaf's identity (id, name, definition, unit, bounds, relations, consumers, pub
   pointer) and no leaf value — there is no `value` field in the schema type at all.
2. **The fill is a value, not a mutation.** `compute(inputs, schema, fill) → Result`;
   the fill is immutable and hash-identified, and its identity rides inside `Result`
   into every renderer, so an artifact can only ever be stamped with the exact data
   that produced it.
3. **Numbers appear only after a recorded human act.** Entry is witnessed (audit log,
   double entry, citations, attested identity); trust is conferred only by the typed
   commissioning ceremony; the watermark is a pure function of
   `(fill class, commissioning record, schema hash match, integrity check)` — never of
   a count reaching zero.

### 2.2 Ship-empty (D-DG-1, upheld)

- No illustrative seed exists in source, shipped tests, docs, or artifacts. The app runs
  in **TEMPLATE MODE** until a fill loads: true topology at fixed canonical proportions,
  every dimension line rendering its leaf **token** (`⟨OHC thickness⟩`), scale bar
  replaced by `NO SCALE — TEMPLATE`, zero digits in the drawing (gate-asserted).
- Template renders are additionally stamped **`DO NOT SCALE — proportions are arbitrary
  and identical for every case`** — the design makes no "endangers no one" claim; that
  sentence enters the claims ledger and the template-render gate, and template renders
  are presumed-unrestricted **pending counsel review**, not declared safe (critique fix).
- Tap-to-explain in TEMPLATE shows formulas with tokens as operands, each marked
  **`model unreviewed`** until the D29 SME review artifact exists (§2.8).
- Dev/CI numbers come from generated `TEST`-class fills (structurally valid, doctrinally
  absurd pattern series, sentinel citations `TEST-000 (fictitious)`); the release gate
  proves no fill of any class is embedded in any dist target, functionally (§4.6 G-11).

### 2.3 The schema leaf

```ts
export interface SchemaLeaf {
  id: string;                // stable slug, append-only forever (never renamed/retired once shipped)
  name: string;  plainName: string;
  definition: string;        // 2–3 sentences incl. measurement convention
  meaningVersion: number;    // bumped on ANY semantic edit to definition/convention — in schemaHash
  unit: CanonicalUnit;       // one canonical unit; storage/engine always canonical
  kind: LeafKind;
  bounds: StructuralBounds;  // see below
  divisor: boolean;  integer: boolean;
  roundingDirection: 'up'|'down'|'nearest'|'exact';
  safetyCritical: boolean;
  consumers: ConsumerRef[];  // ≥1, from the STATIC consumer table (§4.2) — enforced
  relations: RelationRef[];
  pubPointer: string;        // value-free where-to-look — in schemaHash
  citationKind: 'pub-cited' | 'owner-estimate';   // §2.5 — audited at schema freeze
  batch: string;  tableLayout?: TableRef;
  previewPreset: PresetRef;  // per-LEAF preview preset derived from tableLayout (critique fix)
}
```

**Bounds policy (conflict resolution B14):**
- **Safety-critical leaves:** sign/type constraints only (`>0`, `[0,1]`, integer). No
  finite magnitude bound may exist on a safety-critical leaf — a finite max is a
  value-shaped hint and a reseeding vector.
- **Non-safety leaves:** finite structural bounds allowed only with a DECISIONS entry;
  a looseness gate asserts `max/min ≥ 5` (or a per-leaf reviewed exemption with
  rationale); ratios printed in the generated `FILL_CHECKLIST.md` so tightening is
  visible in diff review.
- **Entry UX:** numeric bounds are never displayed on the entry screen. The field always
  accepts keystrokes; only `Record entry` is refused, with the bound stated in words,
  and the refused text preserved in `rawEntry` (forensics).

**schemaHash** = SHA-256 over the canonical serialization of every leaf's
`(id, unit, kind, bounds, divisor, integer, roundingDirection, safetyCritical,
relations, meaningVersion, pubPointer, citationKind)` sorted by id. Copy edits to
`name`/`plainName`/`batch` don't stale fills; **any semantic change does** (blocker fix:
definition semantics enter via `meaningVersion`; a CI gate diffs definition text and
fails when it changes without a `meaningVersion` bump; pure copy edits to definitions
require a reviewed changelog entry). The alias map is deleted — ids are append-only,
so there is nothing to alias (B15).

**Null semantics (INV-3):** `resolve(leafId): Filled<number> | Unfilled`; arithmetic on
`Unfilled` yields `Unfilled` carrying the union of blocking leaf ids; renderers render
tokens; no `.valueOrDefault()` exists; partial sums never present as totals.

### 2.4 Fill classes and the FICT regime (blocker fix)

| Class | Purpose | Watermark floor | Commissionable | Loadable shipped |
|---|---|---|---|---|
| `DOCTRINE` | the real thing | FILLED-UNCOMMISSIONED | yes (only class) | yes |
| `TRAINING` | workflow instruction with fictitious values | TRAINING, never lower | never (validator rejects) | yes |
| `TEST` | CI synthetic | n/a | never | no (refused) |

**TRAINING marks are baked into values, not layered on top:**
- Every TRAINING numeral rendered or exported carries an inline **`FICT`** suffix
  (`3.5 ft FICT`) — the mark travels with the value through any crop, copy, or export.
- Every JSON record in a TRAINING file embeds a `"FICTITIOUS"` field on the value record
  itself; the class is inside the content hash (relabeling breaks integrity → CORRUPT).
- **Bare SVG and CSV export are disabled in TRAINING** (job-sheet print only, watermarked).
- **Signature blocks, engineer-handoff blocks, and the governing-values table print only
  in COMMISSIONED state.** All other states render `UNVERIFIED — NOT COMMISSIONED` in
  those slots, so no training or uncommissioned paper can function as a field document.
- Watermark wording/placement varies deterministically across prints (seeded from fill
  hash + page ordinal) to resist habituation; a cumulative uncommissioned-print counter
  displays in the status panel and prints in the watermark block. Both the counter and
  the watermark seed enter rendering through `RenderOpts` as data — every print stays a
  pure function of its stated inputs; no hidden state lives in render.

### 2.5 The Fill Station — corrected workflow

**Two delivery stages (conflict resolution B4):**
- **Stage 1 — file round-trip (ships first, R1):** `scripts/gen-fill-template.ts` emits a
  fill-template file (one row per leaf: id, label, unit, definition, citation columns,
  empty value) + the hardened validating importer. The owner can begin the real fill in
  week one. Entries imported this way record `method:'file-import'` (pass A); a second,
  independently keyed file diffed by the tool records pass B (`method:'independent-file'`).
- **Stage 2 — interactive Fill Station (R1b→R2):** the guided UI below; required for the
  commissioning ceremony; shaped by measured friction from stage 1. Grid entry UI,
  journal viewer, and multi-tab lease niceties are v2.1 (Web Locks covers safety, §4.5).

**Operating truths, stated in-app:**
- Identity is **attested, not authenticated** — S1 displays this verbatim; the claims
  ledger says "records the *attested* identity of…"; `identity attested, not
  authenticated` prints beside verification coverage on the commissioning summary and
  annex; the fake-verifier residual is a declared failure-mode row (F23).
- **Honest time budget:** the published estimate is **12–20 hours across N sessions over
  one to several weeks** (≈300 leaves × 2 passes at a realistic 60–120 s/act including
  pub lookup, definition read, and citation). The batch board measures actual s/leaf
  from sealed batches and projects remaining hours per pass. No 6–9 h claim survives.
- **Citation-kind audit before pass A:** at schema freeze, every leaf is audited for
  whether a printable pub cell exists. Leaves that no pub prints (labor adders,
  excavation splits, drape/swell factors) are marked `citationKind:'owner-estimate'` —
  a **sanctioned terminal state** requiring a method note instead of a para/page,
  disclosed in the commissioning manifest, provenance annex, and governing-values
  table. The owner can always reach 100%; NOT_IN_PUB is a routing flag, not a dead end.

**Per-leaf entry screen (S4), field order:** header (batch + progress + **persistent
class banner** — purple TRAINING / neutral DOCTRINE, restated by the first Record of
every session); leaf in words (name, plainName, definition, unit huge, pubPointer,
consumers panel); live preview; citation block; value entry; action row.

Corrections applied to S4:
- **Per-leaf preview presets:** each leaf's preview preset is derived from its
  `tableLayout` (row/col → threat/material) so the highlighted token is always in the
  preset's dependency cone; a schema-time check asserts every leaf's preset actually
  consumes that leaf; panel-row preview is the declared fallback for non-drawable leaves.
- **Batch unit metadata:** each pub table's printed unit is recorded as value-free batch
  metadata. When it differs from canonical, the field defaults to conversion mode with
  the pub unit preselected and a batch-start banner: "this table prints in inches" —
  killing the whole-table-in-wrong-unit class (F4b).
- **Conversion rounding is specified:** round-half-even to the leaf's `maxDecimals` at
  the `Use X ft` confirm step, shown inside the displayed arithmetic, applied
  identically in both passes; `rawEntry` keeps exact keystrokes and factor.
- **Citation carry-forward:** "same citation as previous" prefills (editable, still
  recorded per leaf as an explicit act); any single-table batch may capture its citation
  once, grid-style.
- **Queue order mirrors the pub's print order** via `tableLayout`; after any skip, a
  one-line interstitial ("skipped ⟨X⟩ — now entering ⟨Y⟩") breaks the rhythm before the
  next value.
- **Pacing:** the 45-minute break card stays; declining it logs **neutral pacing
  telemetry** (session length, entries/hour, breaks taken), summarized once in the
  manifest — no named refusal events (honesty is not punished).

**Pass B (blind verification) — corrected:**
- **Truly blind (blocker fix):** the pass-B screen renders the target leaf and its
  entire dependency cone as tokens (or previews only the candidate value being typed);
  digits are redacted from the citation quote display during pass B; a gate test
  asserts the pass-B DOM contains no digit string derived from the stored value.
- **Batch-at-a-time, shuffled within the batch** — one pub table open per sitting;
  grid↔per-leaf mode alternation kept for decorrelation. Never a fill-wide shuffle.
- **A→B gap is measured and disclosed:** per-leaf wall-clock gap (attested clock)
  recorded; median/min printed in the commissioning manifest and provenance annex;
  soft-enforced minimum gap of 1 h, overridable only via a recorded override event that
  prints with the artifact.
- **Mismatch = resolution-as-verification:** on mismatch, both values shown *now*, pub
  open, a third re-derivation typed, a required note naming which pass was wrong —
  recorded as `method:'mismatch-resolution'` and counting as the verification. No extra
  different-session pass B for resolved leaves (the anchored-theater version is deleted).
- **Verify-first session order:** the batch board opens each session with "verify last
  session's sealed batches first, then enter new"; **verified**, not filled, is the
  headline burn-down metric.
- Tier-2a sum-to-one tolerance is **half-ULP of the entered precision** (±0.005 for
  2-decimal shares) — truthfully transcribing a rounded pub is always enterable;
  no relational check may ever require an app release to accept a true source value.

**Resume & custody (majors applied):**
- **The progress file is the primary resume object:** auto-export at every batch seal
  AND session end; startup shows a load-picker; IndexedDB is demoted to same-path crash
  recovery; startup copy states drafts are bound to this exact file location.
- **Fork detection:** every export records `{eventCount, contentHash, parentExportHash}`.
  On resume the station compares lineage: strict prefix → offer the longer file; true
  fork → hard stop showing both heads, counts, timestamps, and require an explicit
  recorded choice. Silent divergence cannot occur.
- Two-copy custody prompts at every seal and at commissioning.

### 2.6 The fill file format

`.sap2fill.json`, fixed key order, human-readable. Loading pipeline: safe parse
(null-prototype copy, dangerous-key rejection, 2 MB cap) → format gate → class gate →
schema binding (mismatch ⇒ STALE path, never refusal) → integrity → all-or-nothing
validation → commit as immutable value.

**Canonical serialization (fully specified, B21):** records sorted by leafId (binary
order); object keys sorted; UTF-8 NFC; ECMA-262 number-to-string; LF; no insignificant
whitespace. A test shuffles insertion order of identical content and asserts identical
`contentHash` and identical exported bytes. Spec ships as `docs/HASHING.md` with
vectors reproduced by a cross-check test.

**Audit log without chain theater (conflict resolution B5):** the per-event
hash-chain is **deleted**. What remains:
- An **append-only audit event list** inside the file (entry, verification,
  mismatch-resolution, correction, batch-sealed, pub-registered, waiver, commissioning,
  decommission, export — full event vocabulary kept), with monotonic `seq`.
- A single **`contentHash`** (SHA-256 over the canonical records + audit list + class +
  schemaHash) recomputed and verified at every load; any failure ⇒ CORRUPT refusal
  naming the divergence. Nothing partial ever loads.
- **The external anchor is mandatory:** the commissioning ceremony ends by printing the
  commissioning summary bearing the full hash, and requires the typed acknowledgment
  `I recorded this hash outside this machine`. Docs state plainly: the file is
  *"evident against accidental or naive modification only — a rewritten file is
  indistinguishable; custody plus the externally recorded hash are the controls."*
- Export lineage (`parentExportHash`) provides fork detection (§2.5) without per-event
  chaining.

**Versioning (conflict resolution B15):** the format is **born at v2** — no v1
importer, no speculative migration chain. Leaf ids are append-only; unknown leaf ⇒
reject; missing new leaf ⇒ FILLED-UNCOMMISSIONED with delta report (already the
semantics). The first real breaking change ships the first migration, tested then.
`fillFormatVersion` exists from day one so that day is cheap.

### 2.7 Watermark states and artifact stamping

State machine (pure function of fill class, integrity, schema match, commissioning,
coverage, clock advisories):

| State | Condition | Treatment |
|---|---|---|
| TEMPLATE | no fill | slate badge, tokens, `NO SCALE — TEMPLATE`, `DO NOT SCALE — proportions arbitrary` |
| TRAINING | class TRAINING | purple; diagonal `TRAINING — VALUES FICTITIOUS`; inline `FICT` on every numeral; no bare exports; no signature/handoff blocks |
| FILLED-UNCOMMISSIONED | DOCTRINE, integrity OK, schema match, not (or no longer) commissioned | red badge + diagonal; sub-reason shown: `n unfilled` / `n unverified` / `awaiting commissioning`; no signature/handoff/governing-values blocks; uncommissioned-print counter |
| COMMISSIONED | valid commissioning record covering this artifact's position; artifact's full dependency cone filled + verified | **provenance strip** (below); signature/handoff/governing-values print |
| STALE | fill schemaHash ≠ app's | diagonal + delta summary; carried leaves compute; commissioning not honored |
| *(CORRUPT)* | integrity failure | refusal, not a state; full-screen report |

**Commissioning coverage is per-position (conflict resolution B6):** the ceremony
manifest declares which positions' consumed leaf sets are complete
(`covers: ['one_man']`). Artifacts for covered positions render COMMISSIONED; artifacts
for uncovered positions render FILLED-UNCOMMISSIONED. This merges the liability
ceremony with per-position readiness economics: the owner gets a clean one_man tool at
~half the fill, and the attestation never claims more than was verified.

**Provenance strip (COMMISSIONED)** — relabeled to claim the data, not the tool
(blocker fix):

```
DATA COMMISSIONED: sha256:ab12ef34… (one_man: 143/143) · BY J. Q. Sapper, SSgt · 2026-09-14
SCHEMA v2.0.0 · APP v2.0.3 · [SINGLE-OPERATOR FILL — identity attested, not authenticated]
MODELS APPROXIMATE — STRUCTURAL REVIEW PENDING          ← until a recorded SME artifact exists
Per-model fidelity: volumes exact-prismatoid · labor estimating-model · schedule estimating-model
Planning aid — verify against current publications. Not a substitute for engineer judgment.
```

- Per-model fidelity lines print on the commissioned job sheet in **every** state,
  including COMMISSIONED; the `STRUCTURAL REVIEW PENDING` stamp is gate-enforced in all
  states until the SME-review artifact is recorded in the build (blocker fix).
- The waiver/citation **annex page is mandatory** in the print pipeline whenever waivers
  exist or `singleOperator` is true; a render test asserts any strip annex reference
  implies an annex page in the same document.
- CSV in partial states emits an explicit total row valued `INCOMPLETE (n unfilled)`
  plus a leading warning record; docs state column sums are invalid unless the
  completeness record reads full; an export test asserts the incomplete-total row.
- CSV cells formula-injection-escaped; downloaded SVGs self-contained (no `var(`).

**Clock integrity (major fix):** the shell persists a **monotonic high-water
timestamp**. When the device clock reads earlier than the high-water mark, a
clock-integrity warning is shown and recorded, and hard-expiry is evaluated against the
high-water time — a rolled-back clock cannot re-unlock expired data. Residual (a
high-water store wiped together with the clock rollback) is declared in the
failure-mode table (F24). Review-by stays advisory (can never clear anything);
hard-expiry (opt-in) re-locks and fails closed on fast clocks by the commissioner's
own election.

### 2.8 Commissioning — the ceremony, anti-rote

Reachable only when: class DOCTRINE ∧ every leaf in the declared coverage has value +
citation (or owner-estimate method note) + verification ∧ zero open MISMATCH/REVISIT ∧
validation passes ∧ integrity verifies.

The ceremony (majors applied):
1. **Scroll-through manifest** — schema hash, coverage, leaf counts, verification
   coverage by method, A→B gap statistics (median/min), pub registry with currency
   attestations, **per-waiver acknowledgment** (each waiver individually acknowledged
   before the typed acts), identity roster, pacing telemetry summary.
2. **Typed per-event facts that cannot be memorized:** the fill short-hash, the waiver
   count, and the changed-leaf count since the last commissioning — read off the screen
   and typed back. Then typed full name, the typed phrase
   `I ACCEPT RESPONSIBILITY FOR THESE VALUES`, and typed date.
3. Single-operator disclosure (typed) when applicable.
4. **External anchor:** print the commissioning summary (full hash), then type
   `I recorded this hash outside this machine`.
5. Practice mode uses **visibly different ceremony text** ("PRACTICE — nothing was
   produced") so rehearsal never trains the real phrase.

**What the ceremony buys (habituation defense):** governing-values table,
engineer-handoff and signature blocks exist *only* in COMMISSIONED prints — commission
or the paper stays visibly non-functional as a field document.

**Corrections & revocation (blocker fix):**
- Any correction voids the affected coverage (state drops); corrections mint a
  **superseding file** plus a **printed recall notice** naming the revoked fill hash and
  affected leaf ids.
- `DATA_GOVERNANCE.md` documents the destroy-old-copies and re-print procedure.
- The planner keeps a **local revoked-hash list**: loading a fill whose hash is revoked
  refuses (or loudly flags with a typed override, recorded).
- Decommission writes immediately in the planner (local event + revoked-list entry),
  not deferred to the next Fill Station visit.

### 2.9 Legal shell & counsel-review flags

Document set: `CONDITIONS_OF_USE.md`, `DATA_GOVERNANCE.md`, `SOFTWARE_CLAIMS.md`
(claims ledger, wordlist-gated), `PROVENANCE_SPEC.md` + `HASHING.md`, `HANDLING.md`,
`COUNSEL_REVIEW.md`, **`DEFECT_ADVISORIES.md`** (new — §2.10).

Claims ledger corrections: "Records the **attested identity** of who entered and
verified each value"; template renders claim `DO NOT SCALE — proportions arbitrary`;
banned-phrase list unchanged; mandatory boundary line on every artifact in every state.
One affirmative claim added: **no accounts, no analytics, no runtime network I/O** —
backed by the G-3 network-primitive lint (§4.6), so data-never-leaves-device is
enforced by CI, not merely asserted.

CUI/handling posture **reworded**: the empty shell is *"presumed unrestricted pending
counsel review"* — never asserted as fact. Counsel flags list (grown per critique):
1. Conditions gate + typed attestation enforceability and wording.
2. MIT license vs. conditions-of-use reconciliation.
3. CUI marking of fill files, outputs, pub-registry metadata.
4. Export control posture of shell vs. commissioned fill vs. **schema relations**
   (caliber-monotonic shielding expectations are doctrine-shaped analytic content —
   flagged explicitly).
5. **Aggregation sensitivity** of a complete filled dataset + named personnel on
   unencrypted removable media; interim handling guidance for progress files.
6. Records/privacy posture of identity capture.
7. Single-operator disclosure adequacy.
8. Product-liability review of claims ledger, plain-language definitions, STOP-card and
   pending-check wording.
9. **Post-release duty-to-warn** process adequacy (§2.10).
10. Commissioner-qualification posture (record-who-acted, not adjudicate-who-may).

### 2.10 Duty-to-warn (defect advisories)

v1's record (12 of 17 critical findings open at audit; fills silently ignored by labor
compute) proves engine defects surface post-release. The process, defined now:
- Every release records SHA-256 + changelog in `RELEASES.md` (+`.sha256` sidecars).
- A discovered safety-relevant defect mints a numbered advisory in
  `DEFECT_ADVISORIES.md`: affected versions (by hash), affected outputs, severity,
  remedy. The strip already prints app version, so advisories name affected artifacts.
- The owner's air-gap workflow includes checking advisories at every artifact transfer
  (documented in `DATA_GOVERNANCE.md`); counsel flag #9 covers sufficiency.

### 2.11 v1 end-of-life (blocker-adjacent major, applied)

Scheduled in R0 (§7): replace or take down the live Replit deployment; tombstone the
v1 README with a deprecation notice **naming the illustrative-seed hazard** (295
plausible values adjacent to real ATP 3-21.8 citations) and pointing at SAP-2; tag a
final archival release with published hash. Copies cannot be recalled; the documented
retraction is the reasonable-care record. v1 thereafter receives only critical fixes
from a published, closed list; everything else is won't-fix.

### 2.12 Failure-mode table (delta rows; the full inherited table carries forward)

The liability design's F1–F22 table carries into `DATA_GOVERNANCE.md` with these
amendments and additions:

| # | Failure mode | Change / new mitigation | Residual |
|---|---|---|---|
| F2 | consistent misread | pass-B true blindness (tokens, digit-redacted quotes); batch-scoped shuffle; measured A→B gap | real, declared; second person is the answer, absence recorded |
| F4b | **whole table in wrong unit, typed consistently** | batch unit metadata + conversion-mode default + batch banner | low |
| F16 | forgery | reworded: file is evidence-grade against accident only; custody + external anchor are the controls | declared |
| F23 | **fictional verifier identity** | `identity attested, not authenticated` printed beside coverage; disclosed in DATA_GOVERNANCE | declared |
| F24 | **clock rollback re-unlocks expiry** | monotonic high-water timestamp; warning recorded; expiry vs high-water | wiped-store residual declared |
| F25 | **fork/lost session on resume** | export lineage compare; hard-stop on true fork | negligible |
| F26 | **partial CSV summed downstream** | INCOMPLETE total row + warning record + export test | low |
| F27 | **engine defect found post-release** | defect-advisory process (§2.10); per-release hashes | process-dependent; counsel-flagged |

---

## 3. The recruit-proof output system

### 3.1 Thesis

v1 answers "what are the numbers?" The recruit surface answers **"what do I do right
now, and how do I know I did it right — and what do I do if it isn't right?"** The
flagship artifact is the **Build Card deck**: one card per construction stage, generated
from the same `StagePlan` the scheduler uses, illustrated by the same scene descriptor
the 3D viewer uses, checked by body-referenced pass/fail sentences that are owner-filled
doctrine data. Cards are a projection of `Result`; they cannot disagree with the BOM or
schedule because nothing is computed twice.

**Deck composition is generative, never tabular:** the deck is derived from
`computeStages(result)` — any composition table in docs is marked ILLUSTRATIVE, and a
CI fixture generates deck composition from `computeStages` for the default Results;
the deck builder may never suppress or insert stages relative to the StagePlan
(blocker-adjacent major fix — if mortar must default open-sky, that is an
engine/doctrine change, not a deck rule).

Two inserted card kinds:
- **STOP card** (engineered roof): *"DO NOT dig a roof. A roof you build will not stop
  {threat plainName}. **Tell your team leader.**"* — action the recruit can actually
  execute (major fix); threat name via engine slot; no fill ever converts a STOP card
  into a build card for AT/large-VBIED threats.
- **WARNING card(s)**: consume `result.validation`. Every validation code gets an
  **owner-authored recruit translation** (string leaf, same fill regime, passes the
  copy gates); untranslated codes render leader-only and force the affected stage card
  to print `ASK YOUR LEADER before this step.` The affected stage card repeats the
  one-line warning **text**, not just an icon (major fix).

### 3.2 The card template (rebalanced — blocker fix)

Canvas 5.5 × 8.5 in portrait, 300 dpi print. Zone arithmetic now sums ≤ 8.5 in with the
enemy strip accounted inside the hero budget:

```
┌──────────────────────────────────────────────┐
│ A HEADER 0.85in   [STEP 3] OF 7              │  SQUARE step badge ("STEP n")
│   DIG DOWN TO FULL DEPTH                     │  ≤28 chars, CI-enforced
│   ENEMY THIS WAY ➤➤➤  (screen-space band)    │  pinned, K-black, hatched arrowhead
├──────────────────────────────────────────────┤
│ B HERO 3.0in  (parapet/camo cards: 2.2in     │  fixed camera preset,
│   hero + 0.8in WHAT-THE-ENEMY-SEES strip     │  NOW highlighted, LATER dashed,
│   inside the same 3.0in budget)              │  posed scale figure
├───────────────────────────┬──────────────────┤
│ C DO THIS 1.9in           │ D 2D INSET       │  C/D share a 1.9in row
│   ≤2 sentences when D     │  1.9×1.9in       │  (acknowledged in the stack)
│   present, else ≤3        │  one dim chain   │
├───────────────────────────┴──────────────────┤
│ E CHECK 1.25in  ▢ press-hold check row       │  ≤2 checks + 1 echo when both
│   IF NOT → one-line recovery action          │  carry IF-NOT lines
├──────────────────────────────────────────────┤
│ F YOU NEED 0.75in  icons+counts, plain names │
├──────────────────────────────────────────────┤
│ G FOOTER 0.35in  state banner · ids · page   │
└──────────────────────────────────────────────┘   Σ = 8.10in + margins
```

- **CI overflow gate:** worst-case allowed text is typeset into every zone across the
  full matrix and the build fails on clip — the glyph-floor gate alone cannot catch
  overflow (blocker fix).
- **Card 0 — HOW TO READ THESE CARDS** is a fixed first card in every deck (and a cover
  corner miniature): annotated mini-card — "faint dashed lines = LATER · bright parts =
  NOW · hold the box when the check passes · the black band points at the enemy."
  Tested by protocol task T0; ghost misreading is a coded failure (major fix).
- **Step badge vs. callout discs (figure-ground fix):** the step indicator is a **square
  badge containing the word STEP**; callout discs stay round and numbered; CI asserts a
  card's callout numbers skip that card's own step number.

**Zone C (DO THIS):** 14 pt/19 pt; ≤12 words/sentence; verb-first from the allowlist;
**bare `front/back/left/right` banned** — direction binds to the band: "Throw dirt
toward the ENEMY arrow, and to the sides." (major fix). ≤2 sentences when zone D is
present. Jargon demoted to the footer glossary.

**Zone D (2D inset):** every inset must carry the in-slice mini figure, a labeled
`GROUND` grade line, the enemy-side marker, and a **noun-phrase chip `SLICED VIEW —
shows the inside`** (never verb-first; lint: chips/captions must not start with a
DO-THIS-allowlist verb). A protocol T-task points at the inset ("point to how deep you
dig"); if it fails 2+ participants, insets are replaced by a zoomed 3D cutaway crop
from the same hero — one picture language (major fix). Security/hasty cards **do**
carry body-referenced layout checks (rifle lengths, bayonet widths from `bodyUnits`
leaves) and may carry a frontage plan-crop inset — doctrine's stake-out language is
stage-0 measurement, and T2 must be passable (major fix). Camo is the only
measure-free stage.

**Zone E (CHECK) — the load-bearing zone, corrected:**
- Exemplar phrasing fixed and lint-enforced: **"Stand on the floor. Lift your arm. The
  TOP EDGE of the hole hits your armpit."** A check-authoring lint requires a named
  landmark from a closed list (top edge, floor, your armpit/chest/knee…) and rejects
  bare "the ground"/"it" (major fix).
- **Every check pairs with a mandatory `IF NOT →` one-line recovery action** ("IF NOT →
  keep digging", "IF NOT → pull the bags, tell your leader"), owner-filled under the
  same gates, 12 pt under the check; completeness gate requires it; protocol T3 adds
  "what do you do if it doesn't reach?" (blocker fix).
- **Pending checks have no checkbox.** An unfilled safety-critical check renders in
  recruit register as a decidable action: **`STOP. ASK YOUR LEADER: how deep?`** — and
  any card consuming an unfilled safety-critical leaf prints a diagonal
  **DRAFT — DO NOT BUILD** band across the whole card, not a footer line. Gate asserts
  no checkbox renders against a pending leaf (blocker fix).
- **Check-to-value coherence (blocker fix):** the check-leaf schema carries
  `{governingDimKey, bodyUnitId}`; import + gate assert
  `|bodyUnits.approxFt − governingDim| ≤ declared tolerance`, else the check renders
  PENDING with status MISMATCH. All card numerics (echo and inset chain) render from
  the governing DimSpec leaf **only**; the check contributes the phrase alone.
- **Number-word ban (blocker fix):** check/bodyUnit string-leaf validation and the copy
  gate reject literal digits AND number-words (one..hundred, half, quarter) — magnitudes
  reach cards only via engine-filled template slots or the numeric echo from the
  governing leaf.
- **One unit in the echo:** recruit mode prints exactly one unit, chosen by the leader's
  D17 unit toggle at handoff; the second unit lives on leader surfaces only.
- Check rows toggle by **~600 ms press-and-hold with a visible fill animation** (rain
  cannot tick them); **zone E swallows all taps** (never advances the card).

**Zone F (YOU NEED) — unit-honest (blocker fix):** per-unit rendering rules: `ea` lines
render as pictogram counts (drawn, labeled pictograms embedded as SVG paths — no
emoji); `ft3/ft2/ft` lines render as engine quantity + plain unit ("dirt to move:
95 cubic feet") or appear on a named exclusion list (e.g. spoil) mirrored exactly in
the deck-sum gate. Zero-count lines suppressed (`e-tools only`). Names come from the
registry's plain field ("roof beams", "sandbags") — jargon like "stringers" cannot
ship (CI: zone F joins the callout-coherence gate). The plywood-sheet example is
deleted; sheet counts require an owner-entered per-sheet-area leaf, never a card-side
conversion. Times are spelled out: "about 1 hr 30 min"; tilde and ≈ banned in build
mode; H+ times render as real clock time when the leader set stand-to, else drop. The
crew pictogram count must equal the labor divisor actually used (default ScheduleOpts
for card generation: teamSize = crewSize, posture 1, machine off), gate-asserted. The
cumulative clock always renders from `ScheduledStep.cumulativeHours` (single display
rounding), never by summing rounded per-stage durations — CI projection-fidelity gate.

**Zone G (FOOTER):** banner keyed on the **real registry fields**
(`fillState.safetyCriticalRemaining` etc. — the spec names the exact schema field it
reads); stage index is 1-based position in STAGE_ORDER everywhere; the leader
scrubber's ticks are labeled 1–7 to match.

**Stage verb lines (major fix):** every recruit stage name must contain ≥1 noun the NCO
register also uses, CI-checked against the registry; ≤28 chars enforced. The seven:
`STAKE OUT YOUR HOLE` / `DIG QUICK COVER` / `DIG DOWN TO FULL DEPTH` / `BRACE THE
WALLS. DIG THE GRENADE PIT.` / `BUILD THE DIRT WALL UP FRONT` / `BUILD THE ROOF` /
`HIDE IT`. Camo card carries a standing ribbon **`START NOW — NEVER STOP`** and a small
camo tick rides zone F of steps 2–6 ("keep hiding your dirt").

### 3.3 Enemy orientation (major fix)

The primary enemy cue is a **screen-space band pinned to the hero's top edge** — `ENEMY
THIS WAY` with a fat black arrow, identical position on every card, printed pure K
black with a hatched arrowhead (legible under red-lens light; a contrast-gate case
simulates the R-channel-only filter). An in-scene ground arrow is secondary. The
WHAT-THE-ENEMY-SEES strip gets heavy furniture: thick divider, caption `FROM THE
ENEMY'S EYES — walk out front and look`, the friendly scale figure kept visible in it,
a behavioral check tied to it, and a protocol T-task ("who is looking at the hole in
this little picture?").

### 3.4 Progressive modes

BUILD (recruit; default on phone-class handoff) / PLAN (leader) / MISSION (planner —
R6). Mode is presentation only; same `Result` hash across modes, CI-tested. BUILD
hides all inputs; the **LEADER VIEW guard is specified**: 3-second press-and-hold with
visible fill ring + 64 px CONFIRM, auto-revert to BUILD after inactivity on phone
viewports — deliberate, glove-compatible, credential-free (minor fix). Card advance in
build mode: 64 px corner buttons only; half-tap advance is an off-by-default setting;
hit-test precedence (zone E swallows) stated in the spec.

### 3.5 2D principles

Carried from v1: single callout/legend registry (now the naming authority for every
surface: 2D, cards, 3D labels, BOM, a11y); pattern redundancy beyond hue; `guard()`;
plain-language-first. Changed: legibility floors (min text 12 px screen / 8 pt paper;
dims 13 px semibold; disc r 11 px; stroke ≥ 1.25 px/0.75 pt); governing-vs-reference
dimension classes on `DimSpec`; detail mode (`{crop, dims:[oneKey], stage}`) — one
projector, one registry; callout de-collision as a hard gate; **all exports pass token
resolution** (no `var(` survives, artifact gate renders headlessly).

**Ghost/print grammar (major fix):** print ghost is a structural treatment — short-dash
outline pattern with a `LATER` tag on the largest ghost group — never a 12 % opacity
that dithers away. The grayscale rasterization gate asserts ghost-vs-NOW and
ghost-vs-DONE structural difference at 300 dpi, same as pattern pairs.

### 3.6 3D-as-instruction

Stage-delta grammar: DONE (desaturated) / NOW (rim + leader-line disc; pulse on screen
only) / GHOST (dashed, `LATER`-tagged in print). Fixed camera presets per
(shapeFamily, stage) as data; preset framing test (≥80 % of NOW bounding box in frame,
figure unclipped) across the matrix.

Corrections:
- **ATGM stages 0/4 use a rear-quadrant preset** (az within ±90°, higher elevation,
  frame `all` including the backblast fan) that stars the wedge — the enemy-side
  exception is deleted rather than documented; the wedge overlays `NEVER STAND HERE`
  text plus hatching, not translucent fill alone; the preset framing test carries an
  explicit exceptions table so enemy-side presets cannot appear silently (major+minor
  merged fix). The labeled enemy strip remains the sole enemy-side view.
- **The armpit line is drawn at the posed figure's actual armpit from scene geometry**,
  never snapped to grade; the honest gap shows when the owner's depth leaf differs; the
  motif emits only when the check references `bodyUnits.armpit` AND that leaf passed
  the coherence tolerance gate; line-vs-grade delta joins the preset test (major fix).
- **Countable NOW parts are schema-true:** the 8-stringer render clamp is removed for
  card renders; rest-bags-in-depth becomes a fill leaf consumed by scene and check
  templates; a CI gate asserts countable NOW parts (stringers, sumps, rest courses)
  equal the corresponding BOM/position quantities per stage (major fix).
- **Vehicle berm single-source (blocker fix):** scene3d renders berm height from the
  `berm.H` leaf (never `parapetW*0.15`); the berm joins the hero-vs-schema gate; the
  FLATTEN-THE-SPOIL title and the berm BOM line must derive from the same registry
  entry backed by the berm leaves — the flatten/haul-vs-berm doctrine question goes to
  the SME review (open risk), and until resolved the card renders whichever model the
  leaves encode, with title text generated from the same registry entry (one source,
  four surfaces cannot tell four stories).
- Vehicle relief exaggeration banned on cards (true scale + depth flag); explore view
  keeps it only with an explicit `depth ×2 for visibility` chip.

### 3.7 Field constraints

Carried intact: gloves (≥64 px build-mode targets, no drag), rain/ziploc packet spec
(2-up landscape Letter, gallon-bag fold, blank card backs, no full-bleed ink), night
red-lens rule (no meaning in red except the hatched STOP band; optional amber night
packet), no-tape-measure body units, one-handed portrait phone, sunlight contrast,
interruption self-sufficiency (every card restates orientation and is decidable alone).

### 3.8 Comprehension gates

**Human protocol (the honest part):**
- **Paper-prototype pilot in R1/early R2** (major fix): 3–4 hand-mocked stage cards on
  2–3 diagram-naive people with the full rubric — de-risks the layout language before
  the deck is engineered.
- Full protocol (R3): 5–8 diagram-naive participants; tasks T0 (what do the faint lines
  mean?), T1 orientation, T2 layout tape-out (now passable — stage-0 body-referenced
  checks exist), T3 depth + recovery ("what if it doesn't reach?"), T4 materials,
  T5 bond pattern, T6 safety (pass = "stop and tell my leader"; anything else is
  program-stopping), T-inset, T-enemy-strip, "which way is front?" pointing at DO-THIS
  text alone.
- **Degraded pass (major fix):** repeat T3 and T6 under red light with work gloves on
  the printed packets, 60-second time box; condition logged per run in
  `COMPREHENSION_LOG.md`.
- **Watermark interaction (major fix):** the watermark band placement rule spares card
  figures, step text, and check lines (asserted in the output-matrix gate); a misread
  attributable to the watermark is a watermark-design defect to fix and rerun — never a
  K2 comprehension failure.
- Fresh cohorts per run (repeat testers are not naive); recruitment starts during R2.
- **Trials print from TRAINING fills only** — naive testers never handle DOCTRINE
  values (aggregation/handling risk stays inside the owner's custody). The inline FICT
  suffix follows the same rule as the watermark band: a misread attributable to the
  FICT mark is a card-design defect to fix and rerun — never scored as a K2
  comprehension failure.

**Automated CI proxies:**
1. **Word-allowlist gate (primary readability gate — major fix):** every content word in
   recruit copy must be on the allowlist = top-3000 frequency list + registry plain
   names + owner-approved additions; unknown word = build failure naming the word.
   FK ≤ 5.0 is demoted to advisory.
2. No-invented-numbers gate over authored copy AND owner-filled check strings (digits +
   number-words).
3. Card completeness gate: verb line ≤28 chars with shared noun; preset exists; ≥1
   instruction; ≥1 check with IF-NOT; YOU-NEED per-unit rules and deck-sum equality
   (with the named exclusion list); STOP/WARNING presence; per-card banner correctness;
   no checkbox on pending leaves; DRAFT band when a consumed safety leaf is unfilled.
4. Zone overflow gate (worst-case typeset, §3.2).
5. Glyph/target floors; callout coherence incl. zone F; disc/step-badge collision rule.
6. Preset framing + figure rules + ATGM exceptions table + armpit-line delta.
7. Contrast/mono/red-lens gate (incl. simulated R-channel filter on orientation cues;
   ghost structural difference in grayscale).
8. Determinism (deck data + SVG layers byte-stable; hero rasters asserted via
   descriptor).
9. Doctrine-integrity extension: every check/bodyUnit leaf unfilled ships as pending;
   coherence `{governingDimKey, bodyUnitId, tolerance}` enforced; safety-critical
   checks counted in the banner arithmetic.
10. Projection-fidelity: cumulative clock from `cumulativeHours`; crew pictogram =
    divisor; deck composition from `computeStages` fixture.

---

## 4. The deterministic backend

### 4.1 Directory tree

```
FieldFortificationsCalculator/
├── (v1 frozen at root; EOL steps per §2.11; moves to legacy/sap1/ at swap)
└── sap2/                        # fully self-contained: own package.json, EXACT-pinned deps
    ├── package.json             # deps: three (exact pin, same version as v1). dev: typescript,
    │                            #   vite, tsx, playwright, happy-dom — all exact versions, no ^
    ├── .nvmrc + engines (exact) # golden CI runs one pinned Node version
    ├── docs/  ARCHITECTURE.md · FILL_CHECKLIST.md (generated) · DECISIONS.md (B-series)
    │          PARITY.md · HASHING.md · DATA_GOVERNANCE.md · DEFECT_ADVISORIES.md
    │          COMPREHENSION_LOG.md · COUNSEL_REVIEW.md · RELEASES.md
    │          CONDITIONS_OF_USE.md · SOFTWARE_CLAIMS.md · PROVENANCE_SPEC.md · HANDLING.md
    │          (the full §2.9 legal shell ships in-tree; G-15's freshness check covers the set)
    ├── src/
    │   ├── schema/    ids, units, leaf, leaves/, relations, consumers.ts (STATIC data),
    │   │              fill (file format), io, parse, callouts, validationCodes,
    │   │              allowlist.ts (THE one magnitude allowlist), policy.ts (engine-behavior only)
    │   ├── engine/    read, trace, missing, round, solids, cover, geometry, work, bom,
    │   │              labor, schedule, validate, mission, compute
    │   ├── render/    svg (incl. fmt()), theme, project, chrome, drawPlan, drawSection,
    │   │              a11y, csv, precision.ts (display precision lives HERE, not schema),
    │   │              print/{pages, jobSheet, buildCards, annex, recallNotice}
    │   ├── scene/     descriptor, build, isoFromScene, propLayout
    │   ├── viewer/    three.js only — viewer + diorama/{palette,textures,terrain,sky,post,bags}
    │   ├── state/     store, session, env (injectable clock/locks), db, scenarios, fillStore
    │   ├── fill/      station: model, template-gen, verify, ceremony, ui
    │   ├── sw/        service-worker LOGIC as pure functions (thin shim in public/, hash-checked)
    │   └── ui/        index.html static shell, main, dom, overlay, errors, regions/, styles/
    │                  (layoutBudgets live in ui/, not schema)
    ├── scripts/       build-standalone, gen-fill-checklist, gen-fill-template, gen-goldens, release
    ├── goldens/       sentinel byte-goldens + normalized-structure JSON
    ├── public/        sw shim, manifest, icons
    └── test/          suites + fixtures/ (synthetic TEST fills, seeded)
```

`schema/` scope is disciplined (minor fix): display precision → `render/precision.ts`;
layout budgets → `ui/`; `schema/policy.ts` holds engine-behavior constants only.

### 4.2 Schema-first data layer

- **Typed id unions** from `const` catalogs; untrusted strings narrowed only in
  `schema/parse.ts`; invalid ids are unrepresentable inside `sap2/src` — the v1
  fallback class has nothing to fall back from.
- **Static consumer manifests (major fix):** `schema/consumers.ts` is pure data —
  `ConsumerId → LeafId[]`, declared once. `doctrineReader(consumerId)` is *constructed
  from* that declaration (typed), so an undeclared reader cannot exist; gate G-9 checks
  set equality as pure data with zero module loading; `exclusiveConsumer` checks are
  table lookups. Additional lint: `doctrineReader()` may be called only at module scope
  of the single file registered to that ConsumerId, and exporting `DoctrineReader`
  values from any module is banned (handle-sharing loophole closed).
- **Functional-orphan defense (major fix):** G-6 gains sensitivity fuzz — for every
  leaf, perturb its value in a complete synthetic fill and assert some field of
  `Result`/`SvgDoc`/`SceneDescriptor` changes; a leaf with zero observable effect fails
  unless it carries an explicit reviewed exemption with rationale in gate config.
- **Leaf inventory:** v1's 295 re-keyed to typed unions; labor regranularized 7→~30
  (per-soil/method dig rates as divisors, per-position bases, adders, stage splits);
  the four v1 orphans gain real consumers or are deleted before freeze; shielding
  17×9 kept, independently entered, no factor derivation. Catalog ≈ 320; the count is
  an output of the schema-integrity test, not a maintained claim. Ids append-only
  forever (B15).
- **The magnitude allowlist is centralized** in `schema/allowlist.ts` (minor fix): the
  no-magnitude gate fails on any addition lacking a matching DECISIONS entry; allowlist
  entries inside doctrine/engine paths are forbidden; CI prints allowlist diffs.

### 4.3 Engine v2

```ts
export function compute(inputs: Inputs, schema: Schema, fill: Fill): Result;
export type Q<U extends UnitId = UnitId> = Filled<Traced<number, U>> | Unfilled;
```

- **Typed dimensions in the trace algebra (major fix):** `Q<'ft3'>` etc.; `product`/
  `div` derive result dimensions at compile time; unit text renders from the type, not
  the call site; node labels come from one table keyed by `NodeId` — traces cannot lie
  about labels or units, not just operand lists.
- **Traced is opaque (major fix):** no public `.v`; extraction only in render display
  and tests via lint allowlist; `volume()`/`sectionProfile()` return `Q` built through
  `T` ops with leaf-traced operands (batter, dims); G-9 lints arithmetic operators on
  unwrapped doctrinal values in `engine/`; a test re-evaluates each `TraceNode` from
  its deps and asserts it reproduces `node.value`.
- **Geometry kernel (I3):** typed solids (batteredPrism/frustum/rampWedge/slab) are the
  single shape truth; volumes by exact prismatoid integration of the same battered
  walls the section and diorama show; platform `rise` semantics defined once in the
  solid builder; renderers project `sectionProfile()`/`planOutline()` and contain zero
  shape math. `resolveCover` single authority ports with its fail-safe semantics
  (INV-1): engineered threats emit no thickness at any fill state.
- **Stage-first work model (I9):** WorkPlan items carry stage; labor is the sole
  consumer of dig-rate/machine leaves (`exclusiveConsumer`); the scheduler consumes
  labor-by-stage only and cannot see machine leaves — the v1 double-count is a
  compile/test impossibility. Totals are defined as stage sums; BOM partition is
  definitional. **Machine-assist leaves relate only to excavation-method stages** (a
  schema relation): a property test asserts camo and roof-building stage durations are
  machine-invariant — v1's everything-sped-up defect dies with the double count.
- **No clocks, no randomness (major fix):** the TitleBlock date is data — a
  `FieldHeaderBlanks` hand-fill or store-supplied input threaded through `RenderOpts`;
  renderers never read a clock. A lint bans `Date`, `Date.now`, `performance.now`,
  `Math.random`, `crypto.getRandomValues`, `Intl`/`toLocaleString` across `schema/`,
  `engine/`, `render/`, `scene/`; the allowlist lives only in `state/` and `fill/`
  (provenance recording).
- **Structural NodeId/PartId (major fix):** ids are content/path-addressed (role +
  solid + op-chain labels) or counter-scoped per `compute()`/`buildScene()` call with a
  specified traversal order; G-5 serializes outputs from two isolated node processes
  (fresh module graphs) and byte-compares; determinism also runs on ≥2 OS runners.
- **Validation catalog:** v1's 21 codes port + `DATA_INCOMPLETE`, `SECTOR_GEOMETRY`,
  `REVET_HEIGHT_LIMIT`; every code carries a leader message and an owner-fillable
  recruit translation slot (§3.1). Mission rollup merges on `id+specKey` and carries
  per-position validation (R6). The inverse planner is OUT (§5); its lexicographic
  design is recorded as the re-entry design if ever revived.

### 4.4 Render & scene contracts

- **`ResolvedTheme` everywhere (I8):** renderers take concrete hex; exports are the
  same string written to disk; artifact gate asserts no `var(`, no external refs,
  embedded styles, title block.
- **`fmt()` quantization (major fix):** every emitted coordinate/attribute number
  passes through one `fmt()` in `svg.ts` with fixed decimal quantization; lint bans raw
  number interpolation in `render/`; trig constants (COS30 etc.) are precomputed exact
  literals, not runtime `Math.sin/cos` — ULP and libm drift vanish below the quantum.
- **Goldens right-sized (major fix):** byte-goldens only for a sentinel set (one
  scenario × three views + one flagged job sheet); everything else goldens as
  **normalized structure** — extracted geometry/text JSON with a semantic differ, so a
  stroke-width tweak diffs as one line, and catalog growth stays out of the golden
  churn path.
- **`isoFromScene` constrained (major fix):** fixed iso camera; consumes the geometry
  kernel's solids (bag runs merged into wall silhouettes, never per-bag instances);
  centroid depth-sort with a schema'd role-based draw-order tiebreak; hard part-count
  cap; scope = build-card figures and no-WebGL fallback at that reduced form, stated in
  the contract. It is not a general hidden-surface renderer.
- **Scene descriptor v2:** stable PartIds, `stageAdded` on every part, typed cutaway,
  `highlight:'stage_delta'`, honesty block (engineeredRoof/banner/missing); descriptor
  derives footprints from engine solids; berm height from `berm.H` (§3.6); card-render
  count-honesty gate (§3.6).
- **Viewer port:** behavior-identical port first behind the descriptor-v2 adapter,
  G-14 smoke + screenshot baseline green, then each audit fix (N5 camera re-frame, 48
  MSAA capability, 73–74 idle loop) lands as its own commit against that baseline
  (minor fix). `three` pinned to the identical exact version in both trees so the port
  stays mechanical.

### 4.5 UI architecture

- **Static shell, CSS-only layout (major fix):** one fixed DOM order; layout modes are
  a root class + `grid-template-areas` re-placement; the mobile sheet is the same node
  restyled; the canvas mounts once into a permanent socket and never reparents. Parity
  language is "responsive relayout, zero DOM moves"; sheet/swipe behavior joins G-14.
- **`dom.ts` (~200 lines):** `text/attr/cls/value` idempotent setters; keyed `list`
  reconciler; guarded inert `swap` whose invariant check (no activeElement, no canvas,
  no `[data-retain]`) runs as a **cheap production check** (throw → failure latch), not
  dev-only. **Unit-tested under happy-dom in node** (major fix) — focus/scroll
  preservation, focused-skip, guard behavior; G-14 keeps only what genuinely needs a
  browser (focus trap, inert, IME, print).
- **Overlay primitive:** focus trap, background inert, destructive guard, opener-return,
  editability-aware shortcuts.
- **Two-tab safety via Web Locks (major fix):** the first tab holds an exclusive
  `navigator.locks` lock; later tabs boot read-only with "take over here" acquiring on
  release; CAS versioning retained only as an IndexedDB write backstop. The
  BroadcastChannel lease/heartbeat/seq machinery is deleted (and its flaky two-context
  timer tests with it; `state/env.ts` still injects clock/locks for the remaining
  tests). Storage-disabled environments degrade to in-memory with a visible notice.
- **Error recovery:** event-driven render scheduling (one microtask flush; no
  persistent rAF); per-region failure latch with error card; boot guard renders a
  static failure page.

### 4.6 Gates & tests (revised G-list)

| # | Gate | Mechanism (revisions bold) | Browser |
|---|---|---|---|
| G-1 | Typecheck | strict incl. all configs/scripts | no |
| G-2 | Number-free | **AST lint, not grep**: every numeric literal outside `schema/allowlist.ts` flagged, small per-file structural budget; flags `Number()`/`parseFloat`/`JSON.parse` on literals and numeric-looking strings in schema/engine. **Strict scope = `engine/` + `schema/`**; exempt dirs (viewer/, scene/, ui/styles) pair with a compensating lint: may not import Fill, doctrineReader, or schema/leaves. Grep kept as a second belt over dist text. | no |
| G-3 | Offline | source + every `dist*/` glob; **scope = all of `sap2/` minus explicit allowlist**; sw logic lives in `src/sw/` with a hash-checked shim; **network-primitive lint**: `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`EventSource` banned outside `src/sw/` — data-never-leaves-device is lint-enforced, not just claimed; **root inventory gate**: every top-level source dir and dist glob repo-wide must be claimed by a registered gate suite or CI fails | no |
| G-4 | Self-contained artifacts | no `var(`, no external refs, embedded styles, title block; TRAINING exports carry FICT; annex-presence rule | no |
| G-5 | Determinism | **two isolated processes**, fresh module graphs, byte-compare Result/TraceGraph/SVG/SceneDescriptor; ≥2 OS runners; metric==imperial; **reproducible build scoped to same-machine double-build in CI** (cross-machine advisory in release script); build hash defined over sorted content-hashed asset names, sw shim excluded from its own input, two-pass emission | no |
| G-6 | Fuzz | input matrix × {complete, randomly-partial, boundary} fills; never throws/NaN/fabricated thickness; `Unfilled` never reaches an SVG attribute; **+ per-leaf sensitivity perturbation (functional-orphan check)** | no |
| G-7 | NaN matrix | ported | no |
| G-8 | Goldens | **sentinel byte-goldens + normalized-structure snapshots** (§4.4); flagged-validation scenario included | no |
| G-9 | Schema integrity | static consumer set-equality; exclusive-consumer table + reader-scope lint; divisor bounds; **bounds-looseness assertions** (§2.3); relations self-test; checklist drift; import-boundary lints; clock/random ban; Traced-opacity lint; fmt() lint; **definition-diff vs meaningVersion gate**; allowlist-diff print | no |
| G-10 | Fill workflow E2E | **operator-kind test fixture** (documented) walks the banner to COMMISSIONED-equivalent; synthetic generator stamps sentinel citations on every entry; importer rejects operator-kind files carrying sentinels; residual (relabeled file sits at UNVERIFIED without forged per-leaf records) documented; rejection matrix per §2.6; pass-B blindness DOM assertion; canonical-order shuffle hash test | no |
| G-11 | Ship-empty proof | **functional-emptiness test**: load each built artifact (built engine bundle in node + one headless page), run compute over the full matrix with an empty fill, assert every doctrinal quantity is Unfilled/token with no numeric doctrinal output anywhere; marker/payload grep as secondary belt; **dist may bundle zero fills of any class** | partly |
| G-12 | SW/assets | hashed filenames; generated precache set-equality; pure-function SW logic node-tested | no |
| G-13 | Perf budgets | compute ≤16 ms, region flush ≤8 ms, descriptor ≤50 ms, hero instancing budget | no |
| G-14 | Browser suite | **pinned Playwright browser image, forced software GL (SwiftShader), capability flags hard-overridden to one golden profile, SSIM/pixelmatch perceptual diff with stated threshold — never byte-equal**; prefer SceneDescriptor + draw-call/instance-count assertions, pixels for a small smoke set; PWA asserted via SW registration + offline navigation (not install UI); print via print-media emulation; DOM semantics pushed down to happy-dom; two-tab test = Web Locks acquisition order, no timers | yes |
| G-15 | Release | reproducibility check; SHA-256 + `.sha256` sidecars into RELEASES.md; version stamp; **counsel/JAG + SME sign-off flag files present with status** (`pending` / `returned+dispositioned`) — `pending` forces the §2.7 PENDING stamp and **blocks distribution, never builds**; owner-only releases may carry pending flags, distributed releases require counsel `returned` (B33) and record SME status; advisory-file + §2.9 doc-set freshness check; **pin assertions (node/vite/ts/three exact)** | no |
| G-16 | Card gates | §3.8 items 1–10 (overflow, allowlist copy, completeness, coherence, red-lens, framing, projection fidelity) | no |

**CI is the first sap2 commit** (major fix): a workflow running G-1..G-13 + G-16 with a
pinned-browser container job for G-14. Exact versions everywhere; v1's caret-range
pattern does not carry.

---

## 5. Scope: feature disposition table

Dispositions: **IN-core** (R0–R3 spine) · **IN-later** (assigned phase — every LATER
row carries an R number; unmapped work items trip the creep detector) · **OUT** (with
re-entry bar where one exists).

| Capability | Disposition | Rationale |
|---|---|---|
| Fill schema + validating importer + generated fill template | IN-core (R1a) | The liability spine; ships FIRST so the real fill starts in week one (§2.5) |
| Fill Station interactive UI + ceremony | IN-core (R1b–R2) | Required for commissioning; shaped by measured stage-1 friction |
| TEMPLATE mode + watermark state machine + FICT regime | IN-core (R0–R1) | Non-negotiable 1 |
| Per-position commissioning coverage | IN-core (R1) | Fill economics; liability tracks the printed artifact (B6) |
| Fill/pack diff between editions | IN-later (R6a) | Pull-forward trigger: a cited pub revises while the owner's fill is in progress |
| Approval/sign-off workflow (multi-party) | OUT | One owner; attestation + manifest hash is the audit story |
| Deterministic compute chain, typed end-to-end | IN-core (R0) | The spine |
| `resolveCover` single authority + engineered fail-safe | IN-core (R0) | v1's best liability feature, structural in v2 |
| one_man full vertical slice | IN-core (R2a) | Non-negotiable proof |
| Hero 3D per ONE_MAN spec + scrubber sync | IN-core (R2b) | Flagship — but off the fill/comprehension critical path (B31) |
| Position breadth (two_man…bunker) | IN-later (R4–R5b) | Mini-slice bar per position |
| Vehicle positions | IN-later (R7) | SME-gated; no SME ⇒ they stay out |
| Validation catalog on every output | IN-core | Fixes v1 §6B-4/N11 by construction |
| Tap-to-explain (trace DAG) | IN-core (R0) | The evidence trail; typed units |
| Stage decomposition + exact partition | IN-core (R0) | Card spine |
| Batter-aware excavation volumes | IN-core (R0) | Structure fix in the namesake number |
| Build cards + packet + card 0 | IN-core (R2a) | Non-negotiable 2 |
| Job sheet (validation + provenance required by type) | IN-core (R2a) | The platoon's document |
| 2D plan/section + range card with real azimuth input | IN-core (R2a) | A fake range card is worse than none |
| Per-drawing self-contained SVG export | IN-core (R2a) | Gate-enforced |
| CSV export (hardened, incomplete-total row) | IN-later (R6a) | Supply-shop value |
| 2.5D iso as general fallback | OUT (replaced) | `isoFromScene` in constrained form serves cards + no-WebGL; the shape-blind v1 iso is dead |
| 3D diorama engine + stage scrubber + cutaway | IN-core (R2b) | Proven asset, ported |
| Stage-aware 2D section overlay | IN-later (R5b) | Detail-mode by-product |
| Stand-to schedule | IN-later (R6a) | Planning layer; single machine-assist application point |
| Mission BOM rollup + validation rollup | IN-later (R6a) | Leader value |
| Saved scenario library | IN-later (R6a) | Session restore covers the spine |
| Night theme (all surfaces) + night packet | IN-later (R6b) | Field kit, tested at once |
| PWA + service worker | IN-later (R6b) | v1's most defect-dense subsystem; file-first until then; own update/rollback drill |
| Single-file `file://` artifact + published SHA-256 | IN-core (**R0**) | The air-gap vehicle exists from day one (B32) |
| Guided start presets | IN-core (R2a) | Untrained on-ramp |
| Metric/imperial display toggle | IN-core | Solved in v1, cheap, drives the one-unit echo |
| Session persistence + Web Locks tab safety | IN-core (R0) | Data loss kills fills |
| Undo/redo | OUT | Marginal over ~16 inputs + session restore; v1's Ctrl+Z hijack shows the cost (overrides backend parity list — B36) |
| Diagnostics/status panel | IN-core | Trust furniture; hash + readiness on screen |
| Error boundary + failure latch | IN-core (R0) | Never white-screen |
| A11y floor | IN-core | Retained DOM makes it real |
| Responsive relayout (CSS-only, one DOM) | IN-core | Replaces "three layouts" |
| Help drawer | IN-later (R6b) | Written after cards exist |
| URL-shareable state | OUT permanently | Exfiltration channel; contradicts data-never-leaves-device |
| Inverse time-available planner | OUT | Invented weights were the disease; lexicographic redesign recorded for possible re-entry post-R7 (B37) |
| Side-by-side compare | OUT | Instructor nicety; every surface is test surface |
| Radiation/CBRN readout | OUT | Existed to give 9 leaves a consumer; leaves leave with it |
| `firingStep` input | OUT | Near-no-op; wrong for the flagship position |
| Squad battle-position sketch | IN-later (R8, optional) | Needs azimuths + real fills + rollup; entry gate defined (§7 R8) |
| Protective wire | OUT | Re-entry: post-R7, with fill data, if wanted |
| Hub/suite page | OUT | One product, one name; a hub returns only when a second regime-passing tool exists |
| TIMBER (wood-frame construction) | **SUPERSEDED — see `docs/TIMBER2_PLAN.md`** (edited at TIMBER-2 T0 per its §6.5; reciprocity blocker) | This row previously said "OUT (archived with v1)" with a re-entry bar of "rebuilt inside the regime (`timber.*` leaves, same gates)". **That is no longer the boundary.** TIMBER ships in the same toolkit under its OWN governing plan and its OWN safety posture (working defaults WITH `(PH)` cites + LS-GATE review stamps), because carpentry cut lists are not safety-of-life shielding numbers and the ship-empty regime would make the tool useless without buying a matching amount of protection. **Which SAP-2 gate classes apply to `src/timber`: offline gate — YES; determinism — YES; doc-integrity/cite discipline — YES. Ship-empty, watermark states, commissioning ceremony — NO, replaced by LS-GATE (TIMBER-2 §6.2).** The regime wall is enforced in code: no import from `sap2/**` under `src/timber/**` (TIMBER-2 invariant I-13). |
| Quiz/PDF/DXF/i18n/terrain/productivity curves | OUT | v1's cuts, still correct |
| Conditions-of-use acceptance gate (first-run typed acknowledgment, re-shown on fill-class change) | IN-core (R0) | The qualified-user flow's enforcement point; wording counsel-routed (§2.9 flag 1) |
| Structural-stability checks (soil bearing, sandbag-wall stability, revetment structural sizing) | OUT (SME-routed) | Beyond estimating-model fidelity — `REVET_HEIGHT_LIMIT` is the only structural validation; the fidelity line + PENDING stamp carry the difference; re-entry only with SME-provided models. `retainingWall.*` leaves gain that consumer or are deleted at the R1 freeze — no valueless leaf survives |
| Blender prop pipeline + GLB inventory | IN-later (R2b) | Scripts port with repo-relative output; prop-inventory gate: every shipped GLB referenced by a scene (`plywood.glb` consumed or deleted); the sandbag hero prop re-exported through the fixed pipeline |
| v1 audit §6E 3D-realism backlog (graded entrances/steps, mouth rounding, parapet batter) | Subsumed / OUT | one_man: subsumed by the ONE_MAN hero spec (R2b); breadth positions: the R4/R5 mini-slice generic-diorama bar governs; §6E items beyond that bar are OUT — fidelity lines carry the difference |
| Overlapped/parallel-stage scheduling | OUT (declared simplification) | The schedule model is strictly sequential, no overlap, camo as a continuous background line (§7 R6a); the simplification prints in the schedule's fidelity line; re-entry only with SME-reviewed overlap doctrine |

---

## 6. What v1 taught us

### 6.1 Port list (proven assets, with receipts)

| Asset | Why it earned the port | v2 home |
|---|---|---|
| Diorama engine (palette, textures, terrain-with-holes, sky, tiered post + watchdog, bag instancing) | verified across 10×8 matrix; working perf governor | `viewer/diorama` (R2b) |
| propLayout bond/grid math | pure, node-tested, deterministic | `scene/propLayout` |
| Pure scene-descriptor seam (no three.js in descriptor) | honesty invariants run in node | `scene/` |
| 2D render system (one projector/view, `guard()`, callout registry, chrome) | fuzz/NaN/conventions suites green; legend can't drift | `render/` |
| Stage partition invariant | the one v1 feature that thinks like a build card | `engine/work` (mechanism rewritten stages-first) |
| IO hardening list (all-or-nothing, dry-run, pollution keys, version gate) | test-backed | `schema/io` |
| `resolveCover` single authority + fail-safe | honored by every surface at every stage | `engine/cover` |
| Provenance idea (evolved) | the core insight was right | the fill regime (§2) |
| Adversarial test culture (source gates, re-derivation, reachability) | it caught real bugs continuously | the G-list |
| Print-token self-containment (D14) | the one export path that never rendered black | `ResolvedTheme` everywhere |
| `preserveDrawingBuffer` + persistent-canvas lessons (D21/D22) | hard-won WebGL knowledge | permanent 3D socket |
| Plain-language-first labels (D23); body-referenced doctrine framing | doctrine measures in body units | callout registry + bodyUnits leaves |
| Zero-dep calc core; `round.ts` | 192 tests in 5 s | ported as-is |
| Error containment (safeCompute) | fuzz-clean | failure latch |

### 6.2 Never-again list (each with its structural kill)

| v1 mistake | v2 construction |
|---|---|
| Shipped 295 plausible seeds behind one banner | ship-empty; no `value` field exists in the schema type; functional-emptiness gate on dist |
| Fill-by-mutation; module-load doctrine snapshots (§6B-2) | fill is a compute argument; no import path to ambient doctrine |
| Importer accepts 0-divisors, no unit check (§6B-5) | per-leaf bounds, divisor flags, unit equality, relational tiers |
| Banner clears itself at count-zero | commissioning ceremony; INV-4 trust asymmetry |
| innerHTML full-shell re-render (M1) | static shell + dom.ts; swap guard is a production check |
| Bare-string ids; `unknown` geometry (§6F) | typed unions; typed `Result` end-to-end |
| Machine-assist double count (§6B-3) | exclusiveConsumer + stage-first labor |
| Engine/render shape disagreement (§6B-8, N8) | geometry kernel; renderers project only |
| Hand-written explain strings drifting (N1) | opaque Traced + generated formulas + node re-evaluation test |
| Job sheet omitting validation (§6B-4) | validation required by constructor type |
| Gates scoped to subtrees; TIMBER escaped (N13) | whole-of-sap2 scope + root inventory gate |
| Hashless assets, fixed SW cache (§6B-9) | generated precache, hashed names, node-tested SW logic |
| Orphan leaves re-growing (N6) | static consumer table + sensitivity fuzz |
| Invented planner weights (N7) | planner OUT; no invented magnitude survives the AST gate |
| Two-tab clobber (68–69) | Web Locks |
| Suite-before-product (M13) | no hub, no second tool, until SAP-2 is filled and fielded |
| Docs/brand drift (M12) | one name; generated docs; freshness check at release |
| The untested band (viewer/main, M11) | thin views over tested view-models + happy-dom layer + slim G-14 |

---

## 7. Phase plan R0–R8

Effort: S = days · M = 1–2 wks · L = 3–6 wks · XL = 6–12 wks. Every phase ends as
working software behind green gates; the project can pause at any boundary. Gate
stand-up is declared per phase; "all gates green" means *all gates stood up so far*.

### R0 — Foundations, CI, and the liability schema (**L**; shell spike timeboxed)

**Contents:** CI workflow as the **first commit** (G-1..G-13 skeleton + pinned-browser
container); exact-pinned toolchain; typed catalogs + `Result` typed end-to-end; schema
compiler + leaf catalog (v1 inventory value-stripped, + bounds/relations/static
consumers/batches/citationKind audit + **check/bodyUnit string leaves enumerated**);
`Unfilled` algebra; fill file format + validator + canonical hashing; watermark state
machine; engine skeleton for one_man (solids with batter, cover, work/labor/validate,
trace DAG); TEMPLATE renders; **single-file `file://` build + SHA-256 publication**
(the air-gap vehicle exists from day one); retained-DOM shell walking skeleton as a
**timeboxed parallel spike** (150 % tripwire applies to the spike alone; R1 entry does
not wait on it — coarse-region rendering is the sanctioned fallback); **v1 EOL steps**
(§2.11); **conditions-of-use gate** (first-run typed acceptance screen, re-shown on
fill-class change; wording drafted into the counsel memo); **counsel memo drafted as an
R0 exit deliverable**.
**Gates stood up:** G-1..G-9, G-11 (functional emptiness), G-13; G-16 partial (copy
gates).
**Acceptance:** all stood-up gates green; fill file round-trips with stable canonical
hash under insertion-order shuffle; corrupt/forged fixtures refuse with reasons;
one_man compute matches independent re-derivation; empty-fill property suite (zero
digits in TEMPLATE renders); shell runs with zero full re-renders; standalone artifact
boots from `file://` on a clean machine.

### R1 — The fill path, then the Fill Station (**L**)

**R1a (first):** generated fill template + checklist; hardened importer; double-entry
via second independently keyed file; progress-file lineage; batch unit metadata.
**R1b:** interactive Fill Station per §2.5 (S1 identity/clock, S2 pub registry, S4
entry, pass B, batches/seals, ceremony, corrections/recall, practice mode with
distinct text).
**Freeze:** the **one_man-consumed leaf set (numeric + check/bodyUnit strings) freezes
at R1 exit** — leaf discovery was R0/R1 work driven by the consumer map, the modeling
spec, and the 2D plan. Additive-only thereafter.
**Human calibration:** the owner (or proxy) fills **one real table (~20 leaves) with
real citations through the real flow**; leaves/hour and friction recorded; session
sizing and ceremony scope tuned from the data. The honest 12–20 h two-pass estimate
publishes on the batch board.
**Counsel:** review runs concurrent with R1 construction (memo sent at R0 exit);
return-by target is R1 exit.
**Gates stood up:** G-10, G-15 (exercised once).
**Acceptance:** scripted E2E — every one_man leaf via the real flow (automated driver)
→ coverage reaches complete → per-position unlock verified on the stub outputs
(wording: "readiness reaches zero-remaining and the stub output drops its watermark";
artifact-level unlock verification is R2a's output-matrix gate); every rejection path
surfaces reasons and applies nothing; pass-B blindness DOM assertion green; resume +
fork-detection drills pass. **The real one_man fill starts here, on a frozen set, on
the air-gapped single-file artifact. K3's clock starts now.**

### R2a — one_man vertical slice, no hero (**L–XL**) — the proof milestone

**Contents:** deterministic one_man compute across 17 threats × 8 soils × 3 standards
× 5 revetments; 2D plan/section with OHC build-up, batter, revetment; range card with
real azimuth input; **build cards illustrated by 2D cuts** (deck complete per §3,
incl. card 0, STOP/WARNING kinds, pending-check rendering); job sheet; guided start;
per-position unlock proven at artifact level (G-7-style output matrix incl. the
watermark band-placement rule).
**Paper-prototype pilot** (if not already run in late R1): 3–4 mock cards, 2–3
diagram-naive people, full rubric.
**Gates stood up:** G-16 full; G-14 (2D/browser subset).
**Acceptance:** slice demo ends with a **physical print of deck + job sheet on an
ordinary duplex laser printer** — page breaks, grayscale legibility, watermark
visibility checked on paper; synthetic operator-kind fixture drives the clean-print
path in test only (dist bundles zero fills, G-11); all gates green. Tester
recruitment for R3 begins now; both cohorts pre-booked.

### R2b — Hero 3D + scrubber sync (**L**, parallel/after R2a; the hero never gates R3 — the generic diorama port does, see R3 entry)

Hero model per ONE_MAN spec on the ported diorama engine; stage scrubber = card
stepper over one store field; camera presets + framing tests; cutaway; card hero
pictures switch from 2D cuts to 3D renders **only when ready** (decision recorded
before R2b whether R3 runs on 2D-cut or hero art — R3 never waits for hero art).
Prop pipeline ports with repo-relative output + a prop-inventory gate (every shipped
GLB referenced by a scene; `plywood.glb` consumed or deleted; the sandbag hero prop
re-exported through the fixed pipeline). The **generic diorama port** (behavior-
identical, its G-14 subset green) is the one R2b deliverable R3 requires, so the first
release ships math + 2D + 3D per N3; the bespoke hero model and 3D card art remain
deferrable.
**Acceptance:** G-14 viewer suite green on the golden software-GL profile;
**3-reference-device pass including one old Android**; count-honesty and armpit-line
gates green.

### R3 — Comprehension trial and release (**L**)

**Entry:** the ported generic diorama is green (R2b's G-14 subset) — the first release
ships math + 2D + 3D per N3; only hero art is deferrable. **Counsel escalation fires
at R3 entry, not exit:** review still outstanding ⇒ chase or engage alternate counsel
now.
Full protocol per §3.8, **printed from TRAINING fills** (fresh cohorts, two
consecutive clean runs, degraded red-light + gloves pass on T3/T6); card iteration;
a11y floor; print polish; release of the single-file artifact + hashes + release note
— **owner-only until the counsel review is returned and dispositioned; distribution
beyond the owner is hard-gated on that return (§1, B33, and this line state one
rule)**; USER-GUIDE written against the shipped UI.
**Acceptance:** ≥4/5 unassisted on the core tasks, zero wrong-result cards, T6 = 100 %
("stop and tell my leader"), two consecutive clean runs on fresh cohorts; degraded
pass logged; watermark-attributable misreads fixed and rerun (not scored as K2).

### R4 — Breadth I: two_man, mg_crew (**L**)

**Entry conditions:** counsel review **returned and dispositioned**; mg_crew platform
semantics carry an SME confirmation or an owner-signed pub citation in the decision
log. Each position is a mini-slice (frozen leaf set, engine + 2D + generic diorama +
cards + job sheet, auto-enrolled in every matrix gate).
**Acceptance:** matrix green; per-position coverage math correct (commissioned one_man
stays clean while mg_crew is watermarked); **defined mini-protocol: 2 naive testers on
the novel cards only, zero wrong-result, logged in COMPREHENSION_LOG.md**;
reference-device pass re-run (scene population changed).

### R5a — Breadth II: fifty_cal, mortar_pit, connecting_trench (**L**)
### R5b — Breadth III: atgm_javelin, bunker_op_cp (**L**)

**Entry condition (added at TIMBER-2 T0 per its §6.5(b) — reciprocity):** before
`bunker_op_cp` is built, **reconcile it with TIMBER-2's `crib-bunker` family**
(TIMBER-2 §2.7, the normative boundary). The two tools must not model the same
structure twice with different numbers. The stated line: **TIMBER-2 builds the WOOD
structure** (posts, caps, stringers, lagging, entrance framing) sized against a
**user-stated** `designCoverDepthFt` treated as a design dead load; **SAP-2 owns the
protective-earth sizing** (cover thickness against a threat) under its fill regime.
`designCoverDepthFt` never serializes off-device. If the reconciliation finds real
overlap, resolve it in a `DECISIONS.md` entry BEFORE either side ships the geometry.

Tranched so the first three reveal the real per-position mini-slice cost before the
two hardest geometries. Position truths carried: π/4 mortar volume, open-corridor
trench, ATGM backblast wedge + rear-clearance validation, bunker spoil accounting,
mortar+OHC advisory.
**Acceptance:** matrix green; per-position doctrine review by a **named reviewer (the
owner, against the cited pub section, signed in the decision log)**; **naive-tester
read-back spot-checks on every novel safety card pattern** — ATGM backblast/rear
clearance, mortar+OHC advisory, trench corridor ("what would you do?") — before the
position ships.
**Core-model SME review target (D29):** the one_man labor/volume/cover model review
targets **R5 exit** (mirroring risk-6's detection window). If no SME has been found by
then, indefinite-pending becomes the recorded, accepted terminal state — the
`STRUCTURAL REVIEW PENDING` stamp prints on commissioned artifacts indefinitely and
the per-model fidelity lines carry the weight; that choice is logged in the decision
log rather than left implicit.

### R6a — Planning layer (**M–L**): stand-to schedule, mission rollup, scenario
library, CSV export, fill diff.
**Acceptance:** schedule property tests (halving diggers ≥ doubles elapsed; machine
factor applied exactly once **and only to excavation-method stages** — camo/roof
durations machine-invariant by property test, per §4.3); the schedule's declared model
— **strictly sequential, no stage overlap, camo as a continuous background line
reconciled with the card's `START NOW — NEVER STOP` ribbon so card and schedule tell
one story** — prints in the schedule's fidelity line; rollup preserves worst-severity
validation per position; CSV incomplete-total row test.

### R6b — Field kit (**M–L**): night theme across all surfaces + night packet; PWA on
hashed assets with generated precache.
**Acceptance:** SW gets its own **update/rollback drill across two simulated deploys**;
offline gate covers PWA output; night contrast + red-lens gates green on every surface.

### R7 — Vehicle positions (**L**, SME-gated)

Enter only after a qualified SME reviews ramp/berm/spoil/blade-hour models (logged
name/date). No SME ⇒ vehicles stay out; 8 honest positions beat 10 with unconfirmed
structure. Reference-device pass re-run.

### R8 — Squad battle-position sketch (**L**, optional)

**Entry gate, defined:** at least one real range card produced from a commissioned
fill with owner-set azimuths, used in an actual exercise or site walk, logged with a
date in the decision log; R6a rollup shipped. The plan is complete without R8.

---

## 8. Risks & kill criteria

| # | Risk | Detection | Mitigation | Kill/adjust criterion |
|---|---|---|---|---|
| 1 | Fill fatigue / abandonment | measured s/leaf and projection on the batch board; coverage stalled 4+ wks | honest 12–20 h budget framed as N sessions; per-position coverage pays out at ~half fill; verify-first ordering; resolution-as-verification (no straggler tail); file-based fill from week one | 4-wk stall ⇒ owner-obstacle review (fires even mid-R2); <50 % one_man at 8 active wks ⇒ K3 |
| 2 | Card comprehension failure | R3 protocol; paper pilot | body-referenced checks, IF-NOT lines, card 0, picture-first; iterate against coded misreads (O/S revisions change the picture) | after 2 redesign rounds: **present evidence + options to the owner** — audience re-scope is the owner's signed call, never a pre-authorized fallback (K2) |
| 3 | Retained-DOM underestimate | spike exceeds its own 150 % timebox | spike is parallel and decoupled from R1 entry; coarse-region fallback sanctioned | overrun ⇒ coarse regions everywhere except inputs/cards/3D socket; boundary recorded |
| 4 | Scope creep to v1 breadth | work item mapping to no phase/disposition row (incl. LATER rows — all carry R numbers) | this doc is a gate artifact; PRs cite phases | two unmapped features merged in one phase ⇒ stop, re-baseline |
| 5 | Counsel review adverse or absent | R1-exit target missed; R3-exit escalation | memo at R0 exit; adjustable knobs are config, not architecture; R4 entry hard-gated on returned+dispositioned | K1: architecture ruled indefensible ⇒ template-only training tool; no operator path ships |
| 6 | SME unavailability | no reviewer by R5 exit | best-sourced positions first; vehicles last and hard-gated; PENDING stamp prints until the review artifact exists | no SME by R7 ⇒ vehicles stay out |
| 7 | 3D cost on real devices | G-13 budgets; device-pass tier-down logs (R2b/R4/R7) | tiered pipeline + instancing; cards/2D never depend on 3D (R2a/R2b split) | hero can't hold lowest tier ⇒ generic diorama on mobile; 3D never blocks the card path |
| 8 | Print fidelity regressions | G-4/G-16 + physical print in R2a and R3 | self-contained-by-construction; paper checks scheduled | any escape reaching a user ⇒ stop-the-line + new gate case |
| 9 | Schema churn strands the fill | STALE deltas at release without additive path | freeze at R1 exit; append-only ids; delta-fill + re-commission covers additions | a release orphaning >5 % of a real fill's leaves doesn't ship |
| 10 | Operator error survives the regime | relational checks, mismatch stats, spot audits | double entry (truly blind), relations, batch review, second person recorded when absent | none — the tool never claims verification; drift toward "the tool validates doctrine" language is reverted on sight |
| 11 | Gate-rot culture (flaky goldens trained into reruns) | G-14 retry rates | software-GL golden profile, perceptual diffs, descriptor-level assertions, happy-dom layer, no-timer tests | a gate loosened twice in a quarter triggers an architecture review of that gate |
| 12 | v1 exposure impeaches v2's claims | v1 deploy still live; README unchanged | §2.11 EOL executed in R0; retraction documented | R0 does not exit until the EOL steps are done |

**Kill criteria:** **K1** (liability) and **K2** (comprehension) as in rows 5/2.
**K3** (the v1 failure mode): clock starts at R1 exit, when the frozen leaf set and
the air-gap fill artifact both exist. If no real fill has started within 8 weeks:
work pauses at the next internal milestone in whatever phase is running, and the only
allowed work is removing the owner's actual obstacle to filling. An unfilled SAP-2 is
v1 with better architecture — not the mandate.

---

## 9. Decisions log (B1–B47)

Every synthesis judgment call, with rationale. "Conflict" rows name what was overridden.

- **B1 Ship-empty upheld.** All four designs agree; it is the strongest architecture
  answer to mandate #2. TEMPLATE mode is a product surface, not a degraded state.
- **B2 One vocabulary.** The liability design's terms govern: **fill** (not
  dataset/pack), classes `DOCTRINE`/`TRAINING`/`TEST` (subsuming backend's
  operator/synthetic and scope's TEMPLATE/OPERATOR statuses). One model, one loader.
- **B3 One watermark machine.** Backend's PARTIAL/UNVERIFIED states fold into
  FILLED-UNCOMMISSIONED as displayed sub-reasons; the state set is TEMPLATE / TRAINING
  / FILLED-UNCOMMISSIONED / COMMISSIONED / STALE + CORRUPT refusal. Fewer states, same
  information.
- **B4 Fill Station staged** (conflict: liability's full station vs backend/scope
  descope-and-invert majors). File round-trip (template + importer + second-file
  double entry) ships first so the real fill starts in week one; the interactive
  station follows, shaped by measured friction; grid UI, journal viewer, and
  multi-writer niceties are v2.1. The liability doc's ceremony/blindness requirements
  apply to the station when it lands.
- **B5 Audit chain deleted; anchor mandatory** (conflict: backend "delete chain
  theater" vs liability "mandatory external anchor" — both applied). Append-only event
  list + single whole-file SHA-256 + ceremony-typed external-anchor acknowledgment +
  export lineage for fork detection. Docs say plainly the file is evident against
  accident only; custody + the externally recorded hash are the controls.
- **B6 Per-position commissioning coverage** (conflict: liability's whole-fill
  ceremony vs scope's per-position readiness). The ceremony declares covered
  positions; artifacts outside coverage stay watermarked. Fill economics and honest
  attestation both survive; the ~95 %-stall blocker dies with §2.5's owner-estimate
  kind.
- **B7 FICT-in-values TRAINING regime** (blocker): inline FICT suffix on every
  numeral, FICTITIOUS in every record, no bare SVG/CSV export, signature/handoff/
  governing-values blocks exist only in COMMISSIONED prints.
- **B8 Meaning is hashed** (blocker): `meaningVersion` + `pubPointer` +
  `citationKind` enter schemaHash; CI diffs definition text against meaningVersion
  bumps; copy edits need a reviewed changelog entry.
- **B9 The strip claims the data, not the tool** (blocker): `DATA COMMISSIONED`
  relabel; per-model fidelity lines; gate-enforced `MODELS APPROXIMATE — STRUCTURAL
  REVIEW PENDING` stamp in every state until a recorded SME artifact exists.
- **B10 Revocation path** (blocker): corrections mint superseding files + printed
  recall notices naming revoked hash and leaf ids; planner-side revoked-hash list;
  decommission writes immediately; destroy-and-reprint procedure documented.
- **B11 Clock high-water mark** (major): rollback re-unlock closed; residual declared.
- **B12 Anti-rote ceremony** (majors): typed per-event facts (short-hash, waiver
  count, changed-leaf count), scroll-through, per-waiver acks, distinct practice text,
  uncommissioned-print counter, deterministically varied watermark wording.
- **B13 A→B decorrelation is measured** (majors): per-leaf gap recorded and printed;
  1 h soft minimum with recorded, printing override.
- **B14 Bounds policy merged** (conflict: liability "sign/type-only" minor vs
  backend "looseness-gated finite bounds" major): safety-critical leaves get
  sign/type-only bounds; non-safety finite bounds need a DECISIONS entry + looseness
  gate; bounds never display pre-entry; refused text preserved in rawEntry.
- **B15 Format born at v2; ids append-only** (conflict: liability §3.6 migration
  chain + alias map vs backend's no-machinery major — backend wins). No v1 importer,
  no alias map, no speculative migrations; `fillFormatVersion` reserved; first real
  breaking change ships the first tested migration.
- **B16 `citationKind:'owner-estimate'`** (blocker): a sanctioned terminal state with
  method note, disclosed everywhere; pub-cell audit precedes pass A.
- **B17 Pass-B true blindness** (blocker): dependency cone tokenized, quotes
  digit-redacted, DOM gate test.
- **B18 Tier-2a tolerance = half-ULP of entered precision** (major): truth is always
  enterable; alternatively-waivable path not needed once tolerance is right.
- **B19 Conversion rounding specified** (major): round-half-even to maxDecimals at
  confirm, shown in the arithmetic, identical in both passes.
- **B20 Pass-B shuffle is batch-scoped** (major): one pub table per sitting.
- **B21 Mismatch resolution IS the verification** (major): pub-open third derivation +
  required note, method `mismatch-resolution`; the discard-both + extra-session rule is
  deleted as anchored theater with a straggler tail.
- **B22 Pub-table unit as batch metadata** (major): conversion-mode default + banner
  kills the consistent-inches class (new failure row F4b).
- **B23 Progress file is the resume object** (majors): auto-export on seal/session
  end; load picker; IndexedDB = crash cache; lineage-compare fork detection with
  hard-stop on true forks.
- **B24 Per-leaf preview presets from tableLayout** (major) + schema-time
  consumes-check; panel-row fallback declared.
- **B25 Honest time budget** (major): 12–20 h published; measured s/leaf projections;
  fill framed as sessions over weeks.
- **B26 Verify-first sessions; verified is the burn-down metric** (minor).
- **B27 Neutral pacing telemetry** replaces `break-declined` audit events (minor):
  honesty is not punished into fake breaks.
- **B28 Card zones rebalanced + CI overflow gate** (blocker): hero 3.0 in (enemy strip
  inside the budget), C/D row 1.9 in acknowledged, ≤2 sentences with inset, ≤2 checks
  with IF-NOT lines; worst-case typeset gate.
- **B29 Pending checks are decidable actions** (blocker): no checkbox, `STOP. ASK YOUR
  LEADER:` register, whole-card DRAFT — DO NOT BUILD band.
- **B30 Mandatory IF-NOT recovery line per check** (blocker), same fill regime and
  gates; T3 extended.
- **B31 R2 split; hero never gates the spine** (blocker): R2a proves both
  non-negotiables on 2D-cut card art; R2b is parallel polish; the card-picture source
  decision is recorded before R2b.
- **B32 Single-file artifact ships at R0** (major): the air-gap fill vehicle exists
  before the fill does; offline/emptiness gates run against the real artifact from day
  one.
- **B33 Counsel sequencing** (majors merged): memo at R0 exit; review concurrent with
  R1; return-by R1 exit; escalation at R3 exit; **hard gate at R4 entry** (returned and
  dispositioned). Distribution remains blocked until return regardless.
- **B34 one_man leaf set (numeric + check/bodyUnit strings) freezes at R1 exit**
  (blockers): leaf discovery is R0/R1 work; the real fill starts on a frozen set;
  **K3's clock starts at R1 exit** and its consequence is phase-appropriate (pause at
  next internal milestone; only fill-obstacle work).
- **B35 Check coherence is schema'd** (blockers): `{governingDimKey, bodyUnitId,
  tolerance}`; all card numerics render from the governing DimSpec leaf; digits AND
  number-words banned in check/bodyUnit strings; landmark lint with closed list;
  exemplar re-worded ("TOP EDGE of the hole").
- **B36 Undo/redo OUT** (conflict: backend parity list vs scope cut — scope wins;
  quality-over-breadth and the v1 Ctrl+Z lesson).
- **B37 Inverse planner OUT** (conflict: backend's rebuilt lexicographic `plan.ts` vs
  scope's cut — scope wins; the lexicographic + input-delta design is archived in this
  blueprint as the re-entry design, post-R7 at earliest). Compare and radiation also
  OUT per scope; the 9 radiation leaves leave with the feature.
- **B38 Word-allowlist is the primary copy gate; FK demoted to advisory** (major).
- **B39 Enemy cue is a screen-space K-black band; ATGM presets move to the rear
  quadrant** (majors; the enemy-side preset exception is deleted rather than
  documented — resolves the recruit doc's self-contradiction in the strict direction);
  wedge carries `NEVER STAND HERE` + hatch; exceptions table in the framing test.
- **B40 YOU-NEED is unit-honest** (blocker): `ea` = pictogram counts; volumes/areas =
  quantity + plain unit or named exclusion mirrored in the deck-sum gate; plywood-sheet
  example deleted; drawn pictograms, no emoji; spelled-out times; real clock times.
- **B41 Vehicle berm single source** (blocker): scene renders `berm.H`; title/BOM/hero
  derive from one registry entry; flatten-vs-berm doctrine question routed to SME
  review.
- **B42 Web Locks replaces the lease protocol** (major): kills heartbeat/seq/takeover
  machinery and its timer-flaky tests (the injectable-clock minor becomes moot; env
  injection retained for what remains).
- **B43 Backend hardening bundle** (blockers/majors, all adopted): staged shippable
  milestones inside the R-plan; CI first commit with exact pins; static consumer
  manifests + reader-scope lint; sensitivity fuzz for functional orphans; AST
  number-free gate scoped strict to engine/schema with import-ban compensating lints;
  happy-dom unit layer; slim G-14 on software GL with perceptual diffs; sentinel
  byte-goldens + structure snapshots; constrained `isoFromScene`; typed-dimension `Q` +
  opaque `Traced` + label table + node re-evaluation test; clock/random lint with
  injected date; structural NodeIds + two-process determinism; canonical serialization
  spec + shuffle test; G-10 operator-kind fixture + sentinel-citation defense;
  whole-of-sap2 gate scope + sw-in-src + root inventory gate; functional-emptiness
  dist test; `fmt()` quantization + precomputed trig + pinned Node; schema-package
  scope trimmed (precision → render, budgets → ui); viewer ported behavior-identical
  before audit fixes; build hash two-pass emission.
- **B44 v1 end-of-life + duty-to-warn** (majors): deploy takedown/replacement, README
  tombstone naming the seed hazard, archival tagged release — an R0 exit condition;
  `DEFECT_ADVISORIES.md` process defined and counsel-flagged.
- **B45 The deck is generative** (major): composition derives from `computeStages`;
  all composition tables are marked ILLUSTRATIVE and checked by a CI fixture; the deck
  builder may never suppress or insert stages relative to the StagePlan.
- **B46 Comprehension testing hardened** (majors + minor): paper-prototype pilot in
  R1/early R2; degraded red-light + gloves pass on the safety tasks; fresh cohorts
  pre-booked; watermark band spares figures/steps/checks and watermark-attributable
  misreads are design defects, not K2 events; **K2 re-scope is an owner decision
  presented with evidence — the plan recommends, the owner decides.**
- **B47 Completeness pass (15 gaps, all patched).** An independent completeness
  critique ran against the synthesized blueprint; every finding was applied: (1) R3
  release redefined **owner-only until counsel returns** with escalation moved to R3
  entry — §1, B33, and §7 R3 now state one rule; (2) G-15 sign-off flag files carry
  status — `pending` blocks distribution, never builds, with per-release-class
  requirements stated; (3) network-primitive lint added to G-3 and the
  no-accounts/no-analytics/no-network-I/O claim added to the ledger — N2 is now
  CI-enforced; (4) machine assist schema-scoped to excavation-method stages with a
  camo/roof machine-invariance property test (finishes the audit §6F fix); (5) the
  sequential-no-overlap schedule + continuous-camo handling declared as a printed
  fidelity simplification with a §5 row; (6) structural-stability checks dispositioned
  OUT/SME-routed with the `retainingWall.*` leaf fate fixed at the R1 freeze; (7) the
  core-model SME review targeted at R5 exit with indefinite-pending as the recorded
  fallback; (8) comprehension trials print TRAINING fills and FICT-attributable
  misreads are design defects, mirroring the watermark rule; (9) the byte-determinism
  claim scoped to data/vector artifacts, with print counter + watermark seed threaded
  through `RenderOpts` as data; (10) the Blender prop pipeline ported with
  repo-relative output + a prop-inventory gate (`plywood.glb` resolved); (11) R3 entry
  requires the ported generic diorama so the first release ships 3D — only hero art is
  deferrable; (12) the audit §6E realism backlog dispositioned (subsumed by hero spec /
  mini-slice bar / OUT); (13) the conditions-of-use gate got a §5 IN-core row and an R0
  deliverable; (14) the §2.9 legal doc set + RELEASES.md added to the §4.1 tree and
  G-15 freshness; (15) R7's position count corrected (8 beat 10).

*End of blueprint.*


