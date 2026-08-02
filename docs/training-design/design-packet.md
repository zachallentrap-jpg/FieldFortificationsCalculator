# COMMAND PACKET DESIGN (PKT-1) — the deliverable that turns a configured structure into something command approves

> **Commissioned design — packet workstream.** Scope: owner mandate #3 — *"build out a
> blueprint custom structure and give it to command showing them how many man-hours,
> what exact materials, anything like that … the same concept as the SAP job sheet,
> just better in every way."* Sibling designs `design-flashcards.md` (F0–F4),
> `design-training.md` (TRAIN-1), and `design-platform.md` (F-plan) defer the packet to
> this document (design-training §1 M3: "OWNED BY THE PACKET WORKSTREAM";
> design-platform §1.5/F3 sketches the v1 contract this document elaborates — deltas
> vs that sketch are logged in §10 so the synthesizer reconciles once). This document
> COMPOSES with the binding `docs/TIMBER2_PLAN.md` (T0–T8) and `docs/SAP2_BLUEPRINT.md`
> (R0–R8): it reuses their models and never forks them; every phase states its T/R/F
> dependencies explicitly (§9).
>
> **Ground truth verified against the repo 2026-08-02:**
> `src/timber/{types,frame,bom,elevation}.ts` (`Member[]`, `BomSummary`/`CutLine`,
> `wallElevation`/`layoutStrip`); `src/ui/woodframe-scene.ts` (PLAIN/WHAT dicts,
> per-stage cut lists, the "(PH rates)" suffix); `src/render/jobSheet.ts` +
> `src/render/csv.ts` (SAP-1's job sheet — the baseline to beat, weaknesses receipted
> in `docs/FULL_AUDIT_REMEDIATION_PLAN.md` findings #10, #33, #41, and the
> labor-snapshot/negative-stage findings); `sap2/src/schema/watermark.ts`
> (`watermarkState`, `artifactPolicy`); `sap2/src/engine/compute.ts` (`Result` with
> `fillIdentity`/`coneLeafIds`/`unfilledLeafIds`); `sap2/src/render/` (drawPlan,
> drawSection, precision, svg, theme; `render/print/` scaffolded empty — the blueprint
> reserves `print/{pages, jobSheet, buildCards, annex, recallNotice}`);
> `scripts/build-suite.mjs` (one toolkit deploy; SAP-2 keeps its scoped SW; TIMBER has
> none per TD16).

---

## 0. Thesis and the decisions up front

**The packet is a projection, never a second computation.** TIMBER's packet is a pure
function of `StructureModel` (spec + `Member[]` + stagePlan + issues) + `BomSummary` +
a `PacketSpec` of operator choices; SAP-2's packet is a pure function of `Result` +
`WatermarkState` + `RenderOpts`. Every number on packet paper is the same number the
viewer, cut lists, and BOM already show, because it is aggregated from the same
`Member[]` / `Result` — the house discipline ("the scene and the paperwork can never
disagree", `src/timber/bom.ts` header) extended to the command deliverable. The packet
adds **zero new number sources**: TIMBER's only new constants (weight density, stock
lengths as defaults, future waste percentage) enter through `doctrine.ts` with (PH)
cites like every other TIMBER magnitude; SAP-2's packet consumes only owner-filled
leaves through `compute`.

**Decisions spine (PKD-1..PKD-12; log with rationale in §10):**

| # | Decision |
|---|---|
| PKD-1 | One PKT contract, two implementations. TIMBER (`src/timber/packet/` + `src/ui/woodframe/print/packet.ts`) and SAP-2 (`sap2/src/render/print/packet.ts`) share the section vocabulary, page-CSS constants, naming rules, and behavior vectors of §6 — held identical by a lockstep vector test (§8.6), never by a shared runtime module (the two trees have different toolchains and regimes by design). |
| PKD-2 | v1 ships TIMBER-side (PK-1 = the platform plan's F3 slot). The SAP-2 packet is a job-sheet **superset assembly** landing at R6a; R2a is not touched (SAP-2's proof milestone takes no new scope; platform PD-5 upheld). |
| PKD-3 | No printed dates, ever. The cover date is a labeled hand-fill blank (SAP-2's no-clock rule, blueprint §4.3); TIMBER's `PacketSpec` has **no date field at all**; SAP-2 may thread operator-typed header text only via its existing `FieldHeaderBlanks`/`RenderOpts` data path. Filenames carry no dates either (§3.5). |
| PKD-4 | TIMBER's trust posture: the packet carries a standing **`PLANNING ESTIMATE — not a build-to field document`** stamp plus the (PH)/LS honesty strip; the approval block is hand-fill blanks explicitly labeled as the *unit's* process ("Reviewed by (unit engineer)" / "Approved by (commander)"), which the tool never pre-fills. Tool-conferred trust does not exist in TIMBER (that would be TIMBER-2 risk K1 — a regime change, not a packet feature). |
| PKD-5 | Crew scenarios are arithmetic in TIMBER (man-hours ÷ crew, serial stages), with the fidelity line printed on the same table: "linear crew scaling — no crowding, weather, or night factors." SAP-2's packet uses its real scheduler (R6a) per crew size — three real `compute`/schedule calls, never a division of a rounded total. |
| PKD-6 | Waste is reported as the **exact** stock-fit remainder (`wasteLF` = purchased − used, pure arithmetic); a percentage contingency allowance is a doctrine number and ships only when cited — (PH) row in `doctrine.LOGISTICS`, parked to PK-4. This upholds the platform F3 label "procurement estimate — no waste factor applied." |
| PKD-7 | Cube ships v1 (purchased-stock volume, pure arithmetic over DRESSED sections × stock lengths). Weight ships v1 **only because TIMBER's regime allows cited defaults**: `doctrine.LOGISTICS.lumberLbPerBF` (PH) etc.; every weight line carries the (PH) footnote. SAP-2 prints cube/weight only if the corresponding leaves exist and are filled — otherwise the row renders its token/omits per regime. |
| PKD-8 | Comparison packets (option A vs B): TIMBER **later** (PK-4) with the `CompareSpec` shape designed now (§5); v1's exec summary is deliberately comparison-stable (fixed row order, same metrics) so two covers side-by-side already answer the A/B question. SAP-2 side-by-side stays **OUT** — the blueprint's §5 disposition ("every surface is test surface") is respected; its R6a mission rollup covers aggregation. |
| PKD-9 | Letter AND A4 by construction: one content box 7.2 in × 9.7 in, `@page { margin: 0.5in }` with **no `size` declaration**; duplex-safe section breaks; grayscale-safe (severity as words, hatches not hues). §3.2. |
| PKD-10 | Golden packet renders are committed **full HTML files, string-compared** (the TD11 thumbnail pattern: reviewable diffs; structural asserts fail independently of golden updates; `update:packet-goldens` same-PR rule). True pagination is browser-only — the honest split is structural lints + fit-by-construction caps in node, plus a named physical duplex-print acceptance (Chrome + Firefox, Letter + A4) mirroring SAP-2 R2a's paper check. |
| PKD-11 | File naming `<app>-<slug>-<hash8>.<artifact>.<ext>`, deterministic and clock-free; SAP-2 filenames always carry the watermark-state word so a directory listing cannot hide training paper. §3.5. |
| PKD-12 | The supply-shop CSV is hardened to SAP-2's bar from day one: formula-injection escaping, RFC-4180, CRLF, '.' decimal, exact totals from the model (never summed display strings), leading PLANNING-ESTIMATE warning record; `designCoverDepthFt` never appears in any machine-readable export (TIMBER-2 §2.7 extended to packet surfaces). |

---

## 1. Packet anatomy (both apps, one system)

Section order is fixed; every section is a block the registry (§6) can include/omit.
Availability per app in §1.8. Nothing below invents a number: each block names the
engine field it projects.

### 1.1 COVER (1 page, never splits)

| Element | TIMBER source | SAP-2 source |
|---|---|---|
| Structure name | `spec.label` else `FamilyDef.name` ("SEA hut — 16×32") | `positionLabel` from `Result` |
| Configured summary line | compiled from spec: "16×32 ft · 8 ft walls · gable 4:12 · piers · plywood + screen band" | inputs summary (threat/soil/standard/revetment names via registry plain names — never raw enum ids) |
| Thumbnail | the **runtime SVG thumbnail** (TIMBER-2 §4.4 `thumbnails.ts`, memoized, deterministic) inlined at ~3 in; pre-T2 fallback: the elevation SVG of the S wall | plan miniature (`drawPlan` scaled) |
| Requesting-unit line | hand-fill blank `REQUESTING UNIT ____` (SAP-1 `fieldHeader` concept, kept) | same blank row |
| Date | hand-fill blank `DATE ____` — **no printed date** (PKD-3) | same; `FieldHeaderBlanks` may pre-print operator-typed text (data, not clock) |
| Prepared-by | `PacketSpec.preparedBy` text if given, else blank line — labeled "attested, not authenticated" in small print (SAP-2's honesty wording reused) | commissioner/operator identity only per watermark state |
| Provenance / watermark | TIMBER honesty strip (§2.2): PLANNING ESTIMATE stamp · spec hash8 · (PH) census · LS state · app version | the SAP-2 watermark band + provenance strip **exactly as §2.7 of the blueprint** — TEMPLATE/TRAINING/FILLED-UNCOMMISSIONED/COMMISSIONED/STALE treatments inherited, not reimplemented |
| Packet contents line | generated list of included sections with page-order | same |

### 1.2 EXEC SUMMARY (1 page — the S-3/S-4 thirty-second read)

Fixed grid, six blocks, each capped so the page fits by construction (§3.2):

1. **WHAT** — family + one-liner (from `FamilyDef`/position structure) + overall
   dimensions + stories + foundation. One sentence, compiled not authored.
2. **WHY SIZED AS STATED** — ≤ 6 bullets compiled from: `FamilyDef.locks` with cites
   ("width 16 ft — locked by the SEA-hut standard drawing, TM 5-302 (PH)"),
   `deviationMarks` at non-drawing values ("3 doors — deviation from standard
   drawing"), and `SpecIssue`s of kind `clamped|forced|ls-note` ("access forced to
   stair at 24 ft — EM 385-1-1 (PH, LS)"). SAP-2: standard/threat/soil drivers plus
   any `validation` items' leader messages. This is the page that answers command's
   first question — *why is it this big* — from the same data that sized it.
3. **LABOR** — total man-hours (TIMBER: `BomSummary.totalManHours` with the "(PH)
   rates" footnote verbatim; SAP-2: `work.totalManHours` or token) and the **crew
   scenarios table**: rows = `PacketSpec.crewSizes` (default 4/8/12) → crew-hours and
   working days at `shiftHours` (default 8). TIMBER arithmetic + fidelity line
   (PKD-5); SAP-2 real scheduler per row (R6a). Bold row = the planning crew (first
   entry).
4. **MATERIALS ROLLUP BY CLASS** — one row per `classifyNominal` class (lumber /
   sheet / hardware / other-incl-concrete): pieces, board-feet or unit totals, and —
   where derivable (PKD-7) — procurement cube (ft³) and weight (lb, "(PH) density").
   ≤ 6 rows by construction. SAP-2: BOM class rollup from `Result` lines (sandbags /
   timber / tools), tokens where unfilled.
5. **HONESTY COUNTS** — assumptions count (TIMBER: `SpecIssue` count + labor/logistics
   assumption lines; SAP-2: fidelity lines + waiver count), cite count ("(PH) pending
   on n of m cites" — the census), LS items count (TIMBER) / validation worst-severity
   (SAP-2, printed as a word).
6. **DECISION LINE** — one fixed sentence naming what signing means: TIMBER: "This
   packet is a planning estimate compiled from cited defaults; unit review lines are
   on the last page." SAP-2: state-dependent per `artifactPolicy` (§2.1).

### 1.3 DRAWINGS

Ordered sheets, each `break-before: page`, each landscape-safe inside the portrait
content box (wide drawings rotate 90° as an SVG transform, never a page-size change):

- **Plan** — TIMBER v1 (PK-1): the ortho **Plan** capture from the studio's existing
  view rig (§3.3 capture pipeline); PK-2 upgrade: true dimensioned 2D plan SVG
  (`planProjection(members)` — pure, modeled on SAP-2's `drawPlan` conventions:
  callouts, dim chains, no color-only meaning). SAP-2: `drawPlan(result)` as-is.
- **Section** — TIMBER: cutaway capture at the family's `CutawaySpec` default (T3+);
  SAP-2: `drawSection(result)`.
- **Elevations** — TIMBER: `wallElevation()` SVG per wall (exists today; pure), with
  overall run × height dims; scaled `width:100%; height:auto` per TIMBER-2 §5.6.
- **3D key views** — TIMBER: Iso SE + Iso NW captures (fixed 960×640 DPR 1 offscreen
  targets, `canvas.toBlob` object URLs — TIMBER-2 §5.6's stage-sheet mechanism
  reused); SAP-2: hero descriptor render when R2b art exists, else 2D only.
- **Per-stage sheets** (optional, `includeStageSheets`) — one half-page per
  `StagePlanEntry`: stage capture + that stage's cut list (`StageBom.lines`) + stage
  man-hours. 2-up portrait. TIMBER: T3's stage-sheet print machinery; SAP-2: the
  Build Card deck IS this section (§1.8) — the packet appends the deck, it never
  re-renders stages a second way.
- **Layout strips** — TIMBER only: `layoutStrip()` per wall, segmented ≤ 16 ft with
  continuation labels (TIMBER-2 §5.6 print rule reused verbatim).

### 1.4 MATERIALS (the exact BOM)

- **Lumber by nominal + length**: `CutLine[]` aggregated per nominal — cut length
  (eighth-rounded, carpenter format via `fmtFtIn`), count, roles served, board-feet.
- **Stock purchase table** (`stockFit`): first-fit-decreasing over
  `PacketSpec.stockLengthsFt` (default [8,10,12,14,16]) — per nominal: stock length ×
  pieces to buy, cuts served, exact `wasteLF`; kerf ignored (stated); cuts longer than
  the longest stock render "ORDER SPECIAL LENGTH — n ft", never silently split.
  Algorithm pinned in §6 so it is deterministic and testable.
- **Sheet goods**: panel counts by nominal (subfloor/roof/siding), from the same
  members.
- **Hardware & nails**: pre-T8 — "per-member nailing schedule" note pointing at the
  cut schedule (nailing strings exist on every member today); post-T8 — nail poundage
  by size via the nails-per-pound table (PH) + counted hardware (hinges, hasps, post
  bases) from `Member.nails` and hardware members. The packet section upgrades itself
  when T8's fields appear; no packet rework (it renders what the BOM carries).
- **Concrete**: lineal-foot runs and cubic yards where emitted (footings/pads/slab).
- **Waste**: the exact stock-fit remainder only (PKD-6), labeled "cut-fit waste —
  no contingency allowance applied"; the (PH) contingency row arrives PK-4 with its
  cite.
- SAP-2: the job sheet's BOM table inherited unchanged (per-position and total
  columns), plus the class rollup; `Unfilled` renders tokens; partial states carry the
  blueprint's `INCOMPLETE (n unfilled)` total-row rule.

### 1.5 LABOR & SCHEDULE

- **Per-stage man-hours** — TIMBER: `StageBom.manHours` per stage with the (PH)
  footnote; SAP-2: `computeStages(result)` rows (the same rows the build cards use).
- **Crew scenarios** — the §1.2 table repeated with per-stage detail for the planning
  crew: stage → man-hours → crew-hours → cumulative crew-hours (cumulative computed
  from unrounded totals, displayed once — SAP-2's projection-fidelity rule adopted).
- **Priorities-of-work timeline** — a horizontal bar strip: one bar per stage,
  width ∝ crew-hours, labeled with stage name + day boundaries at `shiftHours`
  increments. Serial stages, stated ("stages run in order; no overlap modeled" — the
  same declared simplification SAP-2's schedule prints). Pure SVG from the same rows.

### 1.6 ASSUMPTIONS & CITATIONS (the honesty appendix)

- **Citation register** — every distinct `doctrineRef` in the model's members +
  consumed `doctrine.ts` entries: cite text, (PH) or verified, count of members
  carrying it. The census totals match the cover strip (test-asserted).
- **LS-GATE table** (TIMBER) — every life-safety constant consumed by this model
  (from `lifeSafetyRegister()` intersected with the model's doctrineRefs): id, value,
  cite incl. EM 385-1-1 class, (PH) status, "review required" flag while `ph:true` —
  the emit-time suffix "(PH — LIFE-SAFETY, review required)" rendered as a table, and
  the studio's standing banner sentence repeated above it.
- **Fidelity lines** — fixed sentences per model: labor "(PH) rates, linear crew
  scaling, serial stages"; stock fit "first-fit estimate, kerf ignored"; weight "(PH)
  density". SAP-2: its per-model fidelity lines print in every state (blueprint §2.7)
  — inherited, not restated.
- **The boundary line** — bunker packets print TIMBER-2 §2.7's sentence verbatim on
  the BOM header AND in this section: "COVER DEPTH: user-stated — protective sizing
  is a survivability (SAP) decision, not computed here." Any cover-depth mention is
  adjacent to that sentence (gate §8.5). SAP-2: the mandatory boundary line + annex
  page rules inherited.
- **Spec issues** — every `SpecIssue` (clamped/dropped/forced/ls-note) in plain
  language: what the operator asked, what the engine did, why.
- **Approval block** (TIMBER) — hand-fill lines per PKD-4. SAP-2: signature blocks
  only in COMMISSIONED (artifactPolicy), `UNVERIFIED — NOT COMMISSIONED` text in the
  slots otherwise — inherited exactly.

### 1.7 BRIEFING VIEW (screen-only, 3–5 screens)

Large-type render of the same `PacketModel` for a verbal brief from a phone held
across a desk: (1) WHAT + thumbnail + dims; (2) MATERIALS rollup; (3) MAN-HOURS +
crew table; (4) TIMELINE bars; (5) ASSUMPTIONS counts + honesty strip. Type ≥ 28 px,
one idea per screen, swipe/arrow advance, no print CSS, watermark/honesty strip
persistent at top. Ships in PK-1 (it is one template over existing blocks) but is the
first descope-ladder cut. Never exports — it is a view, not an artifact.

### 1.8 Availability matrix

| Section | TIMBER PK-1 | TIMBER PK-2+ | SAP-2 (R6a assembly) |
|---|---|---|---|
| Cover | ✔ (thumbnail = elevation SVG pre-T2, runtime thumb post-T2) | ✔ | ✔ (watermark band per state) |
| Exec summary | ✔ | ✔ | ✔ |
| Drawings: plan/section | captures (plan) / — (section pre-T3) | ✔ + true 2D plan | ✔ (drawPlan/drawSection) |
| Drawings: elevations + strips | ✔ (exists today) | ✔ | — (n/a) |
| Drawings: 3D key views | — pre-T3 | ✔ | R2b-gated hero, else 2D |
| Per-stage sheets | — pre-T3 | ✔ | Build Card deck appended (never re-rendered) |
| Materials | ✔ | ✔ (+nails/hardware at T8) | ✔ (job-sheet BOM + rollup) |
| Labor & schedule | ✔ | ✔ | ✔ (real scheduler) |
| Assumptions & citations | ✔ | ✔ | ✔ (annex rules inherited) |
| Briefing view | ✔ | ✔ | LATER (post-R6a, if pulled) |

---

## 2. Regime compliance — stated as testable rules

The two apps have DIFFERENT binding regimes; the packet inherits each exactly.
Every rule below names its test in §8.

### 2.1 SAP-2 packet rules (inherit `artifactPolicy` — never reimplement)

- **R-S1** The packet renderer takes `WatermarkState` and calls
  `artifactPolicy(state)`; a lint asserts `render/print/packet.ts` imports the policy
  and contains no state-conditional of its own beyond the policy's four booleans +
  state-word rendering. Signature blocks, engineer-handoff, governing-values table:
  **only** when `signatureBlocks`/`governingValuesTable` are true (COMMISSIONED).
- **R-S2** TRAINING: every numeral in packet HTML carries the inline `FICT` suffix
  (the mark travels through crop/copy); the diagonal `TRAINING — VALUES FICTITIOUS`
  band renders on every page; **no bare CSV/SVG export buttons render**
  (`bareExports === false`); the packet print itself is permitted (watermarked), per
  blueprint §2.4.
- **R-S3** TEMPLATE: every dimension renders its `⟨token⟩`; zero digits in the packet
  (the ship-empty gate G-11's functional-emptiness assertion extended to the packet
  artifact); `NO SCALE — TEMPLATE` + `DO NOT SCALE` stamps present.
- **R-S4** FILLED-UNCOMMISSIONED / STALE: red/diagonal treatments + sub-reason +
  uncommissioned-print counter (threaded through `RenderOpts` as data, per §2.4);
  signature slots render `UNVERIFIED — NOT COMMISSIONED`.
- **R-S5** Provenance strip on the cover stamps `Result.fillIdentity` — the renderer
  reads provenance from `Result`, **never** from ambient state (the SAP-1
  `getFillState()` defect class, dead by construction).
- **R-S6** Validation is required by constructor type: `PacketModel` (SAP-2 side)
  has a non-optional `validation` block; a clean result renders "no flags — n checks
  run", never an absent section (kills audit finding #10's silent omission).
- **R-S7** Fidelity lines print in every state; `STRUCTURAL REVIEW PENDING` until the
  SME artifact exists; annex page present whenever waivers exist or singleOperator —
  all inherited blueprint §2.7 rules, asserted on the packet artifact too.
- **R-S8** No clock: packet rendering is pure in `(Result, WatermarkState,
  RenderOpts)`; the `Date`/random lint already covering `render/` covers the packet
  file with zero new allowances.

### 2.2 TIMBER packet rules (the (PH)/LS regime)

- **R-T1** Every doctrine-derived numeral traces to a member `doctrineRef` or a
  `doctrine.ts` entry; the packet's citation register census equals the count of
  distinct refs in the model (test computes both independently).
- **R-T2** The honesty strip renders on the cover and repeats in the footer of every
  printed page: `PLANNING ESTIMATE — not a build-to field document · spec <hash8> ·
  (PH) pending on n of m cites · LS items: k (review required: j) · TIMBER v<build>`.
  The stamp sentence is fixed copy in `copy.ts`; the gate asserts it verbatim.
- **R-T3** LS members: any model containing a member whose doctrineRef carries the
  LS suffix renders the LS-GATE table (§1.6) AND the standing banner sentence; a
  packet for a model with zero LS members renders neither (no cry-wolf).
- **R-T4** Bunker boundary: a `family:'bunker'` packet renders the §2.7 boundary
  sentence on the BOM header and the assumptions page; `designCoverDepthFt` appears
  ONLY adjacent to the words "user-stated"; the CSV and any embedded machine-readable
  block contain no cover-depth field (extends TIMBER-2's serialize-strip to packet
  exports). The §6.4 word-boundary lexicon gate runs over packet copy as part of the
  same sweep (packet strings live in `src/timber/**`/`src/ui/**`, already in scope).
- **R-T5** No signature theater: the only signature-shaped ink is the hand-fill
  approval block with role labels; the strings "verified", "certified", "approved by
  TIMBER" never appear in packet copy (wordlist assert). The tool records nothing
  about approval.
- **R-T6** New constants only via `doctrine.ts`: `packet.ts` passes the
  `timber2-number-free` scan (no decimal literals outside the allowlist; imports
  doctrine for density/labor). Crew sizes, shift hours, stock lengths are OPERATOR
  inputs with engine-envelope clamps (crew 1–30, shift 1–24 h, stock 6–24 ft) —
  arithmetic divisors like SAP-1's teamSize, not doctrine.
- **R-T7** Training/quiz reciprocity (shared with siblings): packet copy may name
  components freely (identity is qualitative); packet NUMBERS follow this regime.
  The packet never renders SAP-regime quantities (threat, protection, standoff) —
  the §6.4 lexicon gate is the enforcement.

### 2.3 Both apps

- **R-B1** Determinism: `buildPacket` and the HTML renderer are pure; byte-identical
  output for identical inputs across two isolated processes (SAP-2 G-5 pattern;
  TIMBER node test).
- **R-B2** Self-contained artifact: the packet HTML contains no external URL, no
  `var(` past token inlining, no `<script>` in the printable document; every SVG
  inline; captures as object-URL-printed `<img>` in-app and omitted from any saved
  HTML unless inlined as data URIs under a stated size budget (≤ 300 KB total, else
  captures drop with a visible note — never a broken link).
- **R-B3** No dates printed (PKD-3); no clock reads (lint).

---

## 3. Generation & print

### 3.1 Pipeline (pure descriptor → print-CSS pages)

```
StructureModel + BomSummary + PacketSpec ──buildPacket()──▶ PacketModel   (pure, node)
Result + WatermarkState + RenderOpts ──assemblePacket()──▶ PacketModel'   (pure, node)
PacketModel ──renderPacketHtml()──▶ one self-contained HTML string        (pure, node)
            ──renderBriefing()───▶ screen DOM (in-app only)
            ──packetCsv()────────▶ supply-shop CSV string                 (pure, node)
```

- The HTML string is shown in an in-app packet view (same DOM, screen CSS) and
  printed via the browser dialog (`window.print()`); **PDF = the browser's Save as
  PDF** — zero new dependencies, the platform M-8 rule.
- 3D captures are the ONLY impure step: the studio captures fixed-size renders
  (TIMBER-2 §5.6 mechanism) and hands them to the view layer; `renderPacketHtml`
  itself takes them as optional data (`captures?: Record<CaptureKey,string>`), so the
  node-side renderer stays pure and golden-testable with captures absent.

### 3.2 Page CSS (Letter AND A4, duplex-safe, grayscale-safe)

Binding constants (`PKT_PAGE` in §6; same values both trees, lockstep-tested):

- **Content box 7.2 in × 9.7 in**, centered; `@page { margin: 0.5in }`; **no `size`
  declaration** — Letter (7.5×10 printable) and A4 (≈7.27×10.69) both contain the
  box; nothing depends on which paper the S-4's printer holds (PKD-9).
- **Duplex-safe breaks**: every §1 section root is `.pkt-sec { break-before: page }`
  (cover starts the document); blocks inside are `.pkt-block { break-inside: avoid }`;
  long tables are splittable with `<thead>` (browsers repeat headers across pages) —
  every splittable table's thead presence is lint-asserted. No layout ever assumes
  recto/verso position; page footers repeat the honesty strip so a single duplexed
  leaf is self-identifying (SAP-2's every-page watermark logic, same reason).
- **Fit by construction**: non-splittable blocks carry builder-enforced caps — exec
  crew table ≤ 5 rows, rollup ≤ 6 rows, "why sized" ≤ 6 bullets, strip segments
  ≤ 16 ft, stage sheets 2-up — so a block never exceeds the content box. Caps are
  constants beside `PKT_PAGE`, tested (§8.4).
- **Grayscale/duplex-laser safe**: severity and state as WORDS (bold), hatched SVG
  patterns for ghost/later content (SAP-2 §3.5 ghost grammar), min 8 pt paper text,
  ≥ 0.75 pt strokes, no meaning carried by hue alone (the audit-#10 lesson encoded).
- **Wide content**: drawings wider than the box rotate 90° inside their SVG viewBox
  or split into labeled segments (strips rule); tables never exceed 7 columns (cap).

### 3.3 Reuse map (what is inherited, file-exact)

| Concept | From | Into |
|---|---|---|
| Inline print tokens (self-contained CSS, Day palette) | `src/render/print-tokens.ts` (SAP-1, proven) / `sap2/src/render/theme.ts` ResolvedTheme | `PKT_CSS` module per tree |
| Field-header hand-fill blanks | `src/render/jobSheet.ts fieldHeader()` | cover unit/date/grid lines |
| No-clock date rule, RenderOpts threading | SAP-2 blueprint §4.3 | both packet renderers (PKD-3) |
| Watermark band + policy | `sap2/src/schema/watermark.ts` | SAP-2 packet (R-S1) |
| fmt() quantization, esc() | `sap2/src/render/svg.ts` / `src/render/svg.ts` | all packet SVG/HTML emission |
| Strips scaled/segmented print rule | TIMBER-2 §5.6 | drawings section |
| Stage-capture mechanism (960×640, toBlob, revoked URLs) | TIMBER-2 §5.6 | 3D key views + stage sheets |
| Runtime SVG thumbnails | TIMBER-2 §4.4 `thumbnails.ts` | cover thumbnail |
| Priorities-of-work table | `jobSheet.ts powRows()` concept | labor timeline (upgraded to bars) |
| CSV hardening rules | SAP-2 blueprint §2.7 + `src/render/csv.ts` RFC-4180 base | `packetCsv()` (PKD-12) |
| Golden-file discipline | TIMBER-2 TD11 (SVG file goldens) | packet HTML goldens |

### 3.4 Export surfaces

1. **Print / PDF-via-browser** — the primary artifact (both apps). SAP-2 TRAINING:
   print allowed, watermarked; bare exports suppressed per policy.
2. **`.timber.json` project file** — TIMBER-2 §5.5's existing deterministic
   serialization, offered beside the packet ("the file that regenerates this
   packet"); the packet embeds its `hash8` so paper ↔ file match is checkable by eye.
   Cover-depth stripped per §2.7 (already the rule). SAP-2: fill/scenario files are
   the existing surfaces; the packet adds none.
3. **Supply-shop CSV** (`.materials.csv`) — sections: META (app, structure, spec
   hash8, NO date), WARNING record ("PLANNING ESTIMATE — (PH) rates; verify against
   current publications"), STOCK (nominal, stock ft, pieces), CUTS (nominal, cut,
   count, roles), SHEETS, HARDWARE (post-T8), CONCRETE, LABOR (per-stage man-hours +
   totals), ASSUMPTIONS (one row per fidelity/assumption line). Hardened per PKD-12;
   totals emitted from the model's unrounded sums then formatted once. SAP-2's CSV
   remains its own R6a deliverable with the blueprint's incomplete-total rules; the
   packet does not fork it.

### 3.5 File naming convention (deterministic, clock-free)

```
<app>-<family|position>[-<label-slug>]-<hash8>.<artifact>.<ext>

timber-sea-hut-team-hooch-a1b2c3d4.packet.html
timber-sea-hut-team-hooch-a1b2c3d4.materials.csv
timber-sea-hut-team-hooch-a1b2c3d4.timber.json        ← the triple travels together
sap2-one-man-training-9f80cc21.packet.html            ← state word ALWAYS present
```

- `label-slug`: lowercase `[a-z0-9-]`, ≤ 40 chars, from `spec.label`; omitted when
  unnamed. TIMBER `hash8` = 8 hex of FNV-1a-32 over the `canonicalizeSpec` JSON — a
  filename identity, NOT a security hash (code comment states it; collisions are
  cosmetic). SAP-2 uses the first 8 hex of its real SHA-256 `contentHash` and ALWAYS
  interposes the watermark-state word (`template|training|uncommissioned|
  commissioned|stale`) so a directory listing cannot hide training paper — the FICT
  principle applied to filenames.
- No dates in filenames ever; two exports of the same spec collide byte-identically
  — determinism makes the collision harmless and the collision proves the identity.

---

## 4. "Better in every way" — the delta table

Every SAP-1 job-sheet weakness is receipted (file/line or audit finding); SAP-2's
job sheet is a blueprint (R2a) — its rows state what the packet ADDS over that
already-strong baseline, inheriting all its regime features unchanged.

### 4.1 vs SAP-1's job sheet (`src/render/jobSheet.ts`, `src/render/csv.ts`)

| # | SAP-1 weakness (receipt) | Packet fix |
|---|---|---|
| 1 | No exec summary — command reads the whole sheet to find man-hours/materials (jobSheet.ts renders inputs→specs→drawings→BOM→labor in that order) | §1.2 EXEC SUMMARY page: the 30-second read is page 2, always, same grid every packet |
| 2 | One crew size only (`inputs.teamSize` → single `elapsedHours` row, jobSheet.ts:90) | Crew scenarios table 4/8/12 (operator-editable) with days at shift length; per-stage detail for the planning crew |
| 3 | Validation silently omitted from print — signed paper with zero on-screen warnings (audit finding #10, HIGH) | Validation/issues required by constructor type (R-S6); TIMBER prints every `SpecIssue` + LS table; clean results print "no flags — n checks run" |
| 4 | Provenance read from AMBIENT module state (`getFillState()` in fillFooter, jobSheet.ts:163) — paper can stamp a fill the numbers never used (audit: compute snapshots labor at module load; stages read live → negative per-stage hours) | Provenance rides INSIDE `Result.fillIdentity` / inside `PacketModel.honesty` — renderers cannot reach ambient state (SAP-2 architecture, inherited; TIMBER hash8 from the very spec that generated the members) |
| 5 | Printed `meta.date` presented as document date while DTG is also a blank — two clocks, one fake | No printed dates anywhere (PKD-3); the only date is the unit's hand-filled one |
| 6 | Signature block prints in EVERY state ("Prepared by / Verified by", jobSheet.ts:109) — uncommissioned paper masquerades as a field document | SAP-2: signature blocks only in COMMISSIONED (`artifactPolicy`, R-S1); TIMBER: hand-fill unit-process lines + PLANNING ESTIMATE stamp (PKD-4) |
| 7 | BOM ignores the metric display toggle; ft³ beside converted m³ on one screen (audit finding #33) | One display-unit path: TIMBER formats via `fmtFtIn`/one formatter set; SAP-2 inherits the D17 one-unit rule; CSV states units per row explicitly |
| 8 | Raw internal enum ids printed (`sa-127`, `sandy_loam` — audit finding #41) | All names route through the registries (PLAIN/labels.ts; SAP-2 callout registry) — lint: no id-shaped tokens in packet copy |
| 9 | Display-rounded numbers summed downstream (`num()` at 2 dp per row; CSV consumers add rows) | Totals computed from unrounded model sums, formatted once; cumulative columns from the unrounded cumulative (SAP-2 projection-fidelity rule); CSV carries exact totals + warning record |
| 10 | CSV formula-injection-unsafe (`field()` quotes only `[",\r\n]` — a label starting `=` reaches Excel live) | PKD-12 hardening: cells starting `= + - @` or tab/CR prefixed with `'`; test with hostile label fixture |
| 11 | Drawings: plan + section only; no elevations, no 3D, no per-stage sheets | §1.3: plan, section/cutaway, four elevations, 3D key views, per-stage sheets, layout strips |
| 12 | Flat BOM labels; no material classes, no procurement fit, no cube/weight | §1.4: class rollup (`classifyNominal`), stock purchase table with exact waste, cube/weight where derivable (PKD-7) |
| 13 | Single fixed page flow; no way to brief from a phone | Section registry (include/omit per `PacketSpec`) + §1.7 briefing view |
| 14 | Letter-width assumption (`max-width:8.2in`) — A4 margins clip | 7.2 in content box fits both papers by construction (PKD-9) |
| 15 | Exported raw SVGs rendered black-on-black outside the app (audit findings: var() tokens without style block) | R-B2 self-containment gate on the whole packet artifact — the class, not the instance, dies |

### 4.2 vs SAP-2's blueprinted job sheet (R2a)

| # | SAP-2 job sheet (as blueprinted — already strong) | Packet addition (inheriting, never weakening) |
|---|---|---|
| 1 | Per-position document; provenance, watermark, validation, fidelity all solved | Cover + exec summary assembly in front; the job sheet becomes the packet's core section unchanged |
| 2 | Single teamSize per artifact | Crew-scenarios exec table = three real scheduler calls (R6a), each a pure compute — never arithmetic on a printed total |
| 3 | Deck and job sheet print as separate artifacts (R2a acceptance prints both) | One assembled document: cover → exec → job sheet → Build Card deck appendix → annex, one filename, one watermark pass (deck composition still generative — the packet appends, never re-derives) |
| 4 | No materials class rollup / procurement view | Exec rollup rows from the same BOM lines (tokens where unfilled) |
| 5 | No briefing surface | LATER (post-R6a) — recorded, not promised |

**What the packet deliberately does NOT change in SAP-2:** ship-empty, the FICT
regime, per-position commissioning coverage, the R2a scope, CSV's R6a rules,
side-by-side compare's OUT disposition. The packet is an assembly of blueprinted
parts plus one new exec page — that is why it can ride R6a at M-small cost.

---

## 5. Comparison packets (option A vs B) — the honest call

**Decision (PKD-8): LATER for TIMBER (PK-4), OUT for SAP-2.** Reasoning on the
record:

- The v1 need is served free: exec summaries are comparison-stable by design (fixed
  row order, same metrics, same units) — print two packets, lay two covers side by
  side, and the A/B question (man-hours, lumber, days at crew 8) is answered. The
  owner's scenario ("give it to command") is a decision MEETING, not a diff tool.
- A real compare surface costs: a second `StructureModel` in memory, a delta
  renderer, delta semantics for every block (what is "the diff" of two stage plans
  with different stagePlans?), goldens ×2, and a UI to pick the B spec. That is a
  full phase, and it competes with flashcards/training for the same sessions.
- SAP-2 already ruled side-by-side OUT ("every surface is test surface"); the packet
  respects sibling regimes rather than re-litigating them. Mission rollup (R6a) is
  SAP-2's aggregation story.

**Designed now so re-entry is cheap (PK-4):**

```ts
// src/timber/packet/compare.ts (PK-4)
export interface CompareSpec { a: PacketInputs; b: PacketInputs; crewSize: number }
export interface CompareModel {
  rows: { metric: string; a: string; b: string; delta: string; better: 'a'|'b'|'tie'|'n/a' }[];
  // fixed metric order: man-hours, days@crew, board-feet, pieces, sheets, concrete,
  // cube, weight, (PH) count, LS count — the SAME order as the exec rollup.
  notes: string[];   // compiled: "B has 2 stories — LS stair items differ", etc.
}
export function buildCompare(a: PacketModel, b: PacketModel): CompareModel; // pure, from the MODELS — never recomputed
```

One page, table-only, both honesty strips printed, both hash8s named. Acceptance
when built: `buildCompare(m, m)` yields all-tie; metric order equals exec order
(lockstep test).

---

## 6. Exact TS shapes (binding) and the section registry

### 6.1 Shared PKT contract (vocabulary + constants; implemented per tree)

```ts
// The section vocabulary — CLOSED; both trees implement a subset (§1.8 matrix).
export type PacketSectionId =
  | 'cover' | 'execSummary' | 'drawings' | 'materials'
  | 'laborSchedule' | 'assumptions' | 'briefing';           // briefing: screen-only
export const PACKET_SECTION_ORDER: readonly PacketSectionId[];  // fixed print order

// Page constants — IDENTICAL literals in both trees (lockstep vector test §8.6).
export const PKT_PAGE = {
  contentWIn: 7.2, contentHIn: 9.7, marginIn: 0.5,
  maxTableCols: 7, stripSegmentFt: 16,
  caps: { crewRows: 5, rollupRows: 6, whyBullets: 6, assumptionRowsPerPage: 24 },
} as const;
```

### 6.2 TIMBER — `src/timber/packet/` (pure, node-tested; no DOM, no three.js)

```ts
// spec.ts
export interface PacketSpec {
  sections?: PacketSectionId[];        // default: all print sections; order forced to PACKET_SECTION_ORDER
  title: string;                       // operator text; slugged for filenames
  requestingUnit?: string;             // printed as text on the unit line (else blank line)
  preparedBy?: string;                 // attested text, never an identity claim
  crewSizes: number[];                 // default [4,8,12]; clamp 1..30; first = planning crew
  shiftHours: number;                  // default 8; clamp 1..24
  stockLengthsFt: number[];            // default [8,10,12,14,16]; clamp 6..24; sorted asc, deduped
  includeStageSheets: boolean;         // default false pre-T3 (§1.8)
  // NOTE — extends design-platform §1.5 PacketOptions: crewSize:number → crewSizes:number[]
  // (exec scenarios table needs the set); logged for the synthesizer (PKD-13, §10).
}

// model.ts — every block is plain data; renderers only format.
export interface CrewScenarioRow { crew: number; crewHours: number; days: number }
export interface RollupRow { cls: 'lumber'|'sheet'|'hardware'|'other';
  pieces: number; boardFeet?: number; cubeFt3?: number; weightLb?: number; note?: string }
export interface StockLine { nominal: string; stockFt: number; pieces: number;
  cutsServed: number; wasteLF: number; special?: boolean /* cut > max stock */ }
export interface CiteRow { ref: string; ph: boolean; memberCount: number }
export interface LsRow { id: string; value: string; cite: string; ph: boolean }

export interface PacketModel {
  meta: { app: 'timber'; title: string; slug: string; hash8: string; version: string;
          familyLabel: string; specSummary: string };
  cover: { thumbnailSvg: string; unitLine: string | null; preparedBy: string | null;
           contents: PacketSectionId[] };
  honesty: { stamp: string;                      // the fixed PLANNING ESTIMATE sentence
             phCensus: { cited: number; ph: number };
             lsCount: number; lsReviewPending: number;
             fidelityLines: string[] };          // labor / stock-fit / weight sentences
  exec: { what: string; whySized: string[];      // ≤ caps.whyBullets, compiled (§1.2)
          totalManHours: number; crew: CrewScenarioRow[];
          rollup: RollupRow[]; assumptionsCount: number };
  drawings: { elevations: { wall: WallId; svg: string }[];
              strips: { wall: WallId; segments: string[] }[];
              captures?: Partial<Record<'plan'|'isoSE'|'isoNW'|'cutaway', string>>;
              stageSheets?: { ordinal: number; label: string; capture?: string;
                              lines: CutLine[]; manHours: number }[] };
  materials: { cutLines: CutLine[]; stockFit: StockLine[]; panels: { nominal: string; count: number }[];
               hardwareNote: string; concrete: { runLF: number; cubicYd?: number } | null };
  labor: { byStage: { ordinal: number; label: string; manHours: number;
                      crewHours: number; cumCrewHours: number }[];
           timelineSvg: string };
  assumptions: { cites: CiteRow[]; ls: LsRow[]; issues: SpecIssue[];
                 boundaryLines: string[];        // §2.7 sentence for bunkers; else []
                 approvalRoles: string[] };      // ["Reviewed by (unit engineer)", ...]
}

// build.ts
export function buildPacket(model: StructureModelLike, bom: BomSummary,
                            spec: PacketSpec): PacketModel;
// StructureModelLike = { members: Member[]; stagePlan: StagePlanEntryLike[];
//   issues: SpecIssue[]; spec?: StructureSpec } — pre-T1 the adapter supplies
//   stagePlan from legacy STAGES and issues: [] (platform F3's adapter, kept).
export function stagePlanFromLegacy(stages: typeof STAGES): StagePlanEntryLike[];

// stockfit.ts — pinned algorithm (deterministic):
//   per nominal: cuts sorted length-desc (stable); for each cut, place in the first
//   open bin (creation order) with room; else open a bin of the SHORTEST allowed
//   stock ≥ cut (cut > max stock ⇒ special line, pieces 1, wasteLF 0, special:true).
export function stockFit(lines: CutLine[], stockLengthsFt: number[]): StockLine[];

// csv.ts
export function packetCsv(m: PacketModel): string;    // §3.4 rules; CRLF; hardened
export function csvField(v: string | number): string; // RFC-4180 + formula-injection escape
```

TIMBER doctrine additions (values via the normal (PH) discipline, **not** invented in
packet code — R-T6): `doctrine.LOGISTICS = { lumberLbPerBF: Doc<number> (PH),
panelLbPerSheet: Doc<number> (PH) }`; PK-4 adds `wastePct: Doc<number> (PH)`.
None are LS. `classifyNominal` is implemented in `src/timber/bom.ts` at exactly the
TIMBER-2 §3.7 signature if PK-1 runs before T1 (additive to bom.ts — the specced
home, so T1 inherits it; never a packet-local fork).

Render surface (DOM tree, per TIMBER-2 §4.1 file names):

```ts
// src/ui/woodframe/print/packet.ts
export function renderPacketHtml(m: PacketModel): string;    // pure string; goldens run on this
export function renderBriefing(m: PacketModel, host: HTMLElement): void; // screen-only
// src/ui/woodframe/print/packetCss.ts — PKT_CSS built from PKT_PAGE (inline, self-contained)
```

### 6.3 SAP-2 — `sap2/src/render/print/packet.ts` (R6a)

```ts
export interface Sap2PacketOpts {
  sections?: PacketSectionId[];             // drawings/stage sheets map per §1.8
  crewSizes: readonly number[];             // default [4,8,12]
  header: FieldHeaderBlanks;                // existing type; operator text only, no clock
  renderOpts: RenderOpts;                   // watermark seed, print counter — data in
}
export function assemblePacket(result: Result, state: WatermarkState,
  deck: BuildCardDeck | null, opts: Sap2PacketOpts): string;
// Composition (never re-derivation): coverPage(result,state) + execPage(result,state,scenarios)
//   + jobSheet(result,...) UNCHANGED + deckPages(deck) verbatim + annexPage(...) per §2.7 rules.
// scenarios = opts.crewSizes.map(n => schedule(result, { teamSize: n, ...defaults })) — real calls.
```

Policy conformance is structural: `assemblePacket` receives `WatermarkState` and
passes it down; the existing artifact gates (G-4, watermark band placement, annex
presence, FICT) run on the assembled artifact because it is made of already-gated
pages plus two new ones that join the same gate fixtures.

### 6.4 Files touched/created

| Tree | File | New/Touched | Phase |
|---|---|---|---|
| root | `src/timber/packet/spec.ts` · `model.ts` · `build.ts` · `stockfit.ts` · `csv.ts` | NEW (pure) | PK-1 |
| root | `src/timber/bom.ts` | TOUCH additive: `classifyNominal` per §3.7 (if pre-T1) | PK-1 |
| root | `src/timber/doctrine.ts` (or interim `packet/doctrine.ts` re-homed at T1) | TOUCH additive: `LOGISTICS` rows (PH) | PK-1 |
| root | `src/ui/woodframe/print/packet.ts` · `packetCss.ts` | NEW | PK-1 |
| root | `src/ui/woodframe-scene.ts` (pre-T3) / `src/ui/woodframe/print.ts` (post-T3) | TOUCH: COMMAND PACKET button + options row + capture hook | PK-1 / PK-2 |
| root | `test/packet.test.ts` · `test/packet-render.test.ts` · `test/packet-csv.test.ts` · `test/goldens/packet/*.html` | NEW | PK-1 |
| root | `package.json` | TOUCH: `update:packet-goldens` script | PK-1 |
| root | `src/timber/packet/compare.ts` + tests | NEW | PK-4 |
| sap2 | `sap2/src/render/print/packet.ts` | NEW (composes pages/jobSheet/buildCards/annex) | R6a |
| sap2 | `sap2/test/packet.test.ts` + golden fixtures | NEW | R6a |
| sap2 | `sap2/src/ui/` print action wiring | TOUCH | R6a |
| both | `test/pkt-lockstep.test.ts` (root) + `sap2/test/pkt-lockstep.test.ts` — §8.6 vectors | NEW | PK-1 / R6a |

No changes to: `frame.ts`/legacy generators, `bomSummary` semantics, SAP-2 schema or
watermark machine, `build-suite.mjs` (packet code rides the existing bundles),
service workers (SAP-2's SW picks the packet code up as app code; TIMBER has none).

---

## 7. Generation details worth pinning (so implementers don't invent)

- **Exec "why sized" compiler order**: locks (cited) → deviations → forced issues →
  ls-notes → clamps; truncate at the cap with "+ n more — see assumptions page".
- **Rollup classes**: exactly `classifyNominal`'s four; concrete lives in `other`
  with its own note ("concrete: n LF forms / m yd³").
- **Cube**: Σ over stockFit lines of `pieces × (DRESSED[nominal].w × DRESSED[nominal].d / 144) × stockFt`
  + panels at nominal sheet volume; label "purchased-stock volume".
- **Weight**: `totalBoardFeet × LOGISTICS.lumberLbPerBF (PH)` + panels ×
  `panelLbPerSheet (PH)`; omit the row entirely if a needed Doc is absent — never a
  silent 0.
- **Days**: `ceil((manHours / crew) / shiftHours × 8) / 8` — days at eighth-day
  resolution, from unrounded man-hours; display "2.4 days (crew of 8, 8-hr days)".
- **Timeline SVG**: bars in stagePlan order; width ∝ crewHours (planning crew);
  day gridlines; text labels ≥ 8 pt; pure function of `labor.byStage`.
- **Captures budget**: each capture PNG ≤ 120 KB at 960×640; if the packet view's
  total exceeds 300 KB the renderer drops captures lowest-priority-first (stage
  sheets → isoNW → isoSE → cutaway → plan) and prints "3D views omitted — over print
  budget" (R-B2).

---

## 8. Tests (named suites; runner = `node --test` + tsx, house pattern)

### 8.1 `test/packet.test.ts` — model correctness (pure)

- Projection fidelity: packet totals ≡ `bomSummary` totals exactly (board-feet,
  members, man-hours); `crewHours = manHours / crew` per row; `cumCrewHours`
  monotone, final = total; days formula per §7 at all crew sizes.
- Stock fit: every cut served exactly once; `wasteLF = Σ purchased − Σ cuts` exactly;
  deterministic under input shuffle (canonical sort inside); special-length fixture
  (cut 22 ft vs max 16) renders `special:true`; hand-computed FFD fixture pinned.
- Cube/weight: hand-computed fixture; weight row absent when the Doc is absent.
- Census: `phCensus` equals an independent count of distinct refs/(PH) in members.
- Determinism: `buildPacket` deep-equals itself across calls; two isolated
  `node:child_process` runs byte-compare `JSON.stringify(model)` (G-5 pattern).
- StagePlan adapter: legacy `STAGES` → same rows as a hand-built
  `StagePlanEntryLike[]`; post-T1 compat: `stagePlanForBuilding` output accepted
  unchanged.

### 8.2 `test/packet-render.test.ts` — HTML + goldens + structural lints

- **Golden packet renders**: committed full HTML under `test/goldens/packet/` for
  (a) the TIMBER-1 demo building, (b) a bunker fixture (boundary sentences), (c) an
  LS-bearing fixture (tower, post-T4; pre-T4 a rigged LS doctrineRef fixture);
  string-compared; `npm run update:packet-goldens` rewrites in the same PR as the
  visual change (TD11 discipline). Structural asserts run INDEPENDENTLY of goldens:
- Self-containment: no `http(s)://`, no `<script`, no `var(` outside the inlined
  token block, every `<svg>` has `viewBox`.
- Pagination invariants (structural, node-side): every section root has `.pkt-sec`;
  every table wrapped in `.pkt-block` or carries `<thead>`; table column count ≤
  `PKT_PAGE.maxTableCols`; no inline width > 7.2 in; strip segments ≤ 16 ft; caps
  honored (crew rows ≤ 5 etc.); CSS contains `@page{margin:0.5in}` and does NOT
  contain `@page { size`.
- Grayscale/a11y: every severity/state element contains its word (no color-only);
  honesty strip present on cover AND in the repeating footer; approval block words
  exactly the §1.6 role labels; the strings "verified by TIMBER|certified" absent.
- Regime gates: bunker golden contains the §2.7 sentence adjacent to any
  cover-depth text (regex proximity assert); LS fixture renders the LS table + banner
  sentence; zero-LS fixture renders neither; no-date assert (no `\d{4}-\d{2}-\d{2}`,
  no month names) over the whole artifact.

### 8.3 `test/packet-csv.test.ts`

Formula-injection fixture (`=HYPERLINK…`, `+1`, `@cmd`, tab-prefixed) escapes; CRLF
endings; '.' decimal, no grouping; WARNING record is line 2; totals equal model
sums; NO cover-depth field in the bunker fixture's CSV; NO date row.

### 8.4 Page-fit arithmetic (`test/packet-fit.test.ts`)

For each capped block, typeset-free worst-case row-count × line-height arithmetic
against `PKT_PAGE` (the SAP-2 zone-overflow idea at the granularity node can prove):
caps × max row height ≤ content box. Plus the named MANUAL acceptance: physical
duplex print, Chrome + Firefox, Letter + A4, checklist recorded in DECISIONS.md
(`PKT PK-1:` prefix) — the honest browser-truth step (PKD-10).

### 8.5 Regime sweeps (extending existing gates, not new machinery)

- TIMBER `timber2-number-free` scope += `src/timber/packet/**` (R-T6).
- §6.4 lexicon/pub-denylist gates already scan `src/timber/**`+`src/ui/**` — packet
  copy is in scope by construction; add the packet's boundary-sentence allowlist
  entries.
- SAP-2: the packet artifact joins G-4 (self-contained), G-5 (determinism), G-11
  (functional emptiness in TEMPLATE), G-16 fixtures (watermark band placement on
  packet pages); `sap2/test/packet.test.ts` asserts R-S1..R-S8 over the four-state
  fixture matrix (TEMPLATE/TRAINING/UNCOMMISSIONED/COMMISSIONED + STALE): signature
  block presence ⇔ COMMISSIONED; FICT on every numeral in TRAINING (regex over
  digits); tokens-only in TEMPLATE; strip stamps `fillIdentity` hash.

### 8.6 `pkt-lockstep` (both trees)

Shared behavior vectors as data (JSON committed IDENTICALLY in both repos' test
fixtures; a root test hashes both copies and compares): `PACKET_SECTION_ORDER`,
`PKT_PAGE` literals, filename builder vectors (`("timber","sea-hut","Team Hooch",hash)
→ "timber-sea-hut-team-hooch-<hash8>.packet.html"`; SAP-2 state-word vectors), CSV
escape vectors, day-rounding vectors. The platform design's §6.4 contract-vector
pattern reused for the packet.

---

## 9. Phases, dependencies, ladders

### 9.1 Phase map (composes with T0–T8, R0–R8, and the platform F-plan)

| Phase | = Platform slot | Contents | Depends on | Effort |
|---|---|---|---|---|
| **PK-1** | **F3 (Command Packet v1)** | `src/timber/packet/*` per §6.2; print surface + packet view + briefing view; CSV; goldens + suites §8.1–8.4; button in today's `woodframe.html` toolbar | F1's `labels.ts` extraction only (plain names); NO T-phase required (legacy STAGES adapter; `classifyNominal` implemented at its §3.7 home; elevations/strips exist) | L |
| **PK-2** | **F6 (post-T3 fold-in)** | captures (plan/iso/cutaway) via T3's print machinery; per-stage sheets; true 2D `planProjection`; packet route `#/build/<id>/packet`; workbench options row replaces the interim toolbar row | T3 merged (router, print.ts, camera rigs, cutaway) | M |
| **PK-3** | (rides T-phases) | zero-code growth checkpoints: T5 huts get packets free; T7 bunker boundary gates verified on packet goldens; T8 nails/hardware section + TM 5-303 reconciliation note printed when recorded | T5/T7/T8 as they land | S each |
| **PK-4** | **F7 (later bucket)** | waste-% doctrine row (PH cite required); weight verification; `compare.ts` (§5); briefing polish | owner pull; T8 labor verification strengthens credibility | M |
| **PK-S** | SAP-2 side | `assemblePacket` at **R6a** (§6.3) + `sap2/test/packet.test.ts`; nothing at R2a (PKD-2) | SAP-2 R2a (jobSheet, deck) + R6a scheduler | M |

Serialization rule inherited: PK-1 never runs concurrently with T3 work (platform
PD-6); PK-2 starts only after T3 merges. Branch discipline, red-main rule, DoD:
TIMBER-2 §10.2/§10.4 verbatim (progress rows appended to the platform F-plan table).

### 9.2 Descope ladders

- **PK-1** (cut in order): briefing view → stock-fit table (BOM alone remains) →
  timeline SVG (table remains). NOT cuttable: exec summary, materials, labor
  scenarios, honesty strip, goldens — they are the owner's ask.
- **PK-2**: stage sheets → true 2D plan (captures remain).
- **PK-S**: exec crew scenarios (job-sheet + cover assembly remains).

### 9.3 Acceptance (phase-end, verifiable without the planner)

- **PK-1**: `npm run verify` + `npm run build:suite` green; demo-building packet
  printed to paper duplex (checklist §8.4); materials table numbers equal the stage
  panel's on screen; exec page states 20×16 gable/piers with "(PH) rates" note; CSV
  opens in a spreadsheet with no live formulas; goldens committed; phone view scrolls
  single-column (platform M-8); DECISIONS.md rows appended.
- **PK-2**: packet for a T3 custom structure includes plan capture + cutaway + stage
  sheets; route back-chain works; goldens updated same-PR.
- **PK-S**: assembled SAP-2 packet passes the four-state matrix (§8.5); a TRAINING
  packet printed at R6a demo carries FICT on every numeral and no signature blocks;
  COMMISSIONED fixture prints strip + governing-values + signature blocks.

### 9.4 Risks

| # | Risk | Detection | Mitigation / kill |
|---|---|---|---|
| P1 | Pagination truth is browser-only; node lints can miss a clipped table | physical print checklist per phase | fit-by-construction caps; two-browser duplex acceptance; if a clip escapes to paper: stop-the-line + new structural lint (SAP-2 risk-8 posture) |
| P2 | (PH) labor rates undermine command credibility | owner feedback; T8 TM 5-303 reconciliation pending | the honesty strip IS the mitigation — the packet never hides it; T8 upgrade path printed as "rates pending verification against TM 5-303/P-405" |
| P3 | Crew linearity misleads at large crews | — | fidelity line on the same table (PKD-5); crew clamp ≤ 30; PK-4 may add a cited crowding rule ONLY with a pub |
| P4 | Capture inlining bloats saved HTML or breaks offline budgets | R-B2 size budget test | 300 KB cap + visible drop note; captures optional by construction |
| P5 | Sibling-synthesis drift (PacketOptions shape, F-numbering) | synthesizer diff | deltas logged (PKD-13); shapes are supersets of platform §1.5, so reconciliation is subtractive |
| P6 | SAP-2 R6a slips; packet assembly with it | R-phase progress | job sheet alone remains the SAP-2 deliverable — the packet assembly is additive polish, never on the R2a critical path (PKD-2) |
| P7 | hash8 collision confuses two specs' paper | — | stated non-goal (filename identity only); the .timber.json travels with the packet and IS the identity |
| P8 | Bunker packet leaks a cover-depth into CSV/exports via a future field | §8.3 no-cover-depth assert + §6.4 sweeps | test-enforced; any new export surface must add the same assert (stated in code comment at the strip site) |

---

## 10. Decisions log (PKD-1..PKD-13)

| # | Decision | Rationale (what it overrules / composes with) |
|---|---|---|
| PKD-1 | One PKT contract, two implementations, lockstep vectors | Two toolchains + two regimes forbid a shared runtime module; the FAMILY_TABLE↔doc-tables and DRESSED↔BF_PER_LF sync-test pattern already proves the mechanism in-repo |
| PKD-2 | v1 TIMBER-side at F3; SAP-2 assembly at R6a; R2a untouched | R2a is SAP-2's proof milestone (L–XL) — adding scope there violates its plan; platform PD-5 upheld; the SAP-2 packet is an assembly of already-blueprinted pages |
| PKD-3 | No printed dates; hand-fill blanks; no date fields in TIMBER PacketSpec | SAP-2 §4.3 no-clock rule taken at full strength; kills SAP-1's fake-date ambiguity (§4.1 row 5) |
| PKD-4 | PLANNING ESTIMATE stamp + hand-fill unit approval block; no tool-conferred trust in TIMBER | TIMBER-2 K1 says field-document treatment = regime change; SAP-2's lesson (signature blocks are earned by ceremony) applied in the only honest form TIMBER has |
| PKD-5 | Crew scenarios: arithmetic + fidelity line (TIMBER); real scheduler calls (SAP-2) | No invented crowding doctrine; SAP-2's projection-fidelity rule (never sum rounded parts, never fake a model you don't have) |
| PKD-6 | Waste = exact stock-fit remainder; % contingency parked until cited | timber2-number-free would (rightly) reject an uncited 10%; platform F3's label kept verbatim |
| PKD-7 | Cube v1 (arithmetic); weight v1 via doctrine.LOGISTICS (PH) | TIMBER's regime ships cited defaults — that is the delta vs SAP-2 that makes weight shippable at all; omission-over-zero rule for missing Docs |
| PKD-8 | Compare: TIMBER PK-4 with CompareSpec designed now; SAP-2 OUT | Honest cost accounting (§5); respects SAP-2 blueprint §5's OUT row; v1 need served by comparison-stable exec pages |
| PKD-9 | 7.2×9.7 in content box; no @page size; duplex-safe; grayscale words/hatches | One artifact for both papers beats two page masters; SAP-2 §3.5/§3.7 print grammar reused |
| PKD-10 | HTML file goldens string-compared + independent structural lints + physical print acceptance | TD11's reviewable-diff discipline; honesty about what node can and cannot prove about pagination |
| PKD-11 | Clock-free filenames; SAP-2 state word mandatory in filename | Determinism; the FICT principle extended to the file system so training paper is labeled before it is opened |
| PKD-12 | CSV hardened day one (injection escape, exact totals, warning record, no cover depth) | SAP-1's csv.ts is injection-unsafe today (§4.1 row 10); SAP-2 §2.7's CSV rules adopted as the single bar |
| PKD-13 | Deltas vs design-platform §1.5 for the synthesizer: `crewSize:number` → `crewSizes:number[]` (first = planning crew, so the old semantics embed); `PacketModel` restructured into the §6.2 block form (§1 anatomy needs cover/exec/assumptions blocks the sketch lacked); `preparedFor` renamed `requestingUnit` (matches the printed label); stockFit tie-break + special-length rule pinned (the sketch left the algorithm unnamed) | Same file homes, same purity, same phase slot — the sketch grows into this design without moving |

---

*End of packet design. Implementing sessions: PK-1 starts at §9.1 with §6.2's shapes;
the first test written red is §8.1's projection-fidelity assert against `bomSummary`.*
