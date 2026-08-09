# SAP-2 — Recruit-Experience Design: The Output System

**Role:** Recruit-Experience Designer, SAP-2 blueprint.
**Audience contract (owner's mandate #4):** a Marine with NO diagram training — a recruit who has not finished forming week — must look at the output and complete the position. Trained NCOs and planners are served by the same system, not a fork of it.
**Ground truth read:** `docs/STATE_OF_THE_APP.md`, `DECISIONS.md` (D1–D35), `PLACEHOLDER_POLICY.md`, `src/render/*` (svg.ts callout registry, chrome.ts, drawPlan/drawSection), `src/engine/stages.ts` + `src/doctrine/stages.ts` (the 7-stage exact-partition system), `src/render3d/scene3d.ts` (ROLE_STAGE, partStage, terrain spec), `src/ui/three-viewer.ts` (framing, fly(), stage rise-in, cutaway plane), `src/doctrine/positions.ts` (the 10 positions), `docs/ONE_MAN_POSITION_MODELING_SPEC.md` (the doctrinal body-unit language), `src/ui/tokens.css` (day/night palettes).

**Liability regime carried forward (owner's mandate #2):** every doctrinal magnitude AND every body-referenced check phrase in this design is **user-supplied data** under the `Provenance<T>` regime. SAP-2's software authors write verbs, layouts, and geometry plumbing; the owner enters every value and every check sentence offline, with recorded provenance. Nothing below fabricates a doctrinal number; where this document shows example check text, it is **ILLUSTRATIVE** and ships as `PLACEHOLDER`. Counsel/JAG review of the final artifact set is required and is outside this document's competence.

---

## 0. The one design thesis

v1 answers "**what are the numbers for this position?**" SAP-2's recruit surface must answer a different question: "**what do I do right now, and how do I know I did it right?**"

The engine already contains the answer's skeleton and it is the best thing v1 built:

- `doctrine/stages.ts` defines the **7-stage priorities-of-work order** (`security → hasty → deliberate → revet_sump → parapet → overhead → camo`) with an **exact partition** of man-hours and BOM lines per stage (`STAGE_BOM`, `excavationSplit`, invariant-tested).
- `render3d/scene3d.ts` already tags **every 3D part with the stage it first appears in** (`ROLE_STAGE`, `partStage()`), and the viewer already animates the delta (`startStageRise`).
- Doctrine itself already speaks in body units — `positions.ts` literally annotates depth as `'armpit-deep'`; the ONE_MAN spec's sourced language is "armpit deep," "two M16A2 rifle lengths," "width of two bayonets," "length of an extended entrenching tool," "≥ 1 ft (≈ 1 helmet length) OR ¼ the depth of cut."

So the flagship recruit artifact is not a drawing. It is a **deck of Build Cards — one card per construction stage** — generated from the same `StagePlan` the scheduler uses, illustrated by the same `scene3d` descriptor the 3D viewer uses, checked by body-referenced pass/fail sentences that are doctrine data. The 2D dimensioned drawings remain the **measured truth** (leader surface); the cards are the **task surface**. Nothing is computed twice; a card can never disagree with the schedule or the BOM because it is a projection of them.

---

## 1. THE BUILD CARD SYSTEM (flagship)

### 1.1 What a card is

One card = one construction stage of one configured position (position type × standard × soil × threat × revetment × toggles — i.e., one engine `Result`). The deck is derived from `computeStages(result)`: **a stage that drops from the StagePlan (no labor, no BOM) produces no card**, so deck length is 4–7 cards depending on position and toggles. Cards are numbered **STEP 1 of N** in deck order (recruits never see the doctrinal stage index; it appears in 6-pt footer type as `stage: parapet (4/7)` for NCO cross-reference, because "Step 3" on a mortar pit and "Step 3" on a bunker are different doctrinal stages).

Deck composition against the actual 10 positions (default toggles: sump on where `grenadeSumps > 0`, camo on, overhead on where roof path is `earth_on_stringers`):

| Position | security | hasty | deliberate | revet_sump | parapet | overhead | camo | Deck size |
|---|---|---|---|---|---|---|---|---|
| one_man | ✓ | ✓ | ✓ | ✓ (1 sump) | ✓ earth mound + bag rest | ✓ (or STOP card) | ✓ | 7 |
| two_man | ✓ | ✓ | ✓ | ✓ (2 sumps) | ✓ | ✓ | ✓ | 7 |
| mg_crew (inverted-T) | ✓ | ✓ | ✓ + platform + stem trench | ✓ | ✓ | ✓ | ✓ | 7 |
| fifty_cal (L) | ✓ | ✓ | ✓ + platform + arm | ✓ | ✓ | ✓ | ✓ | 7 |
| mortar_pit (circular) | ✓ | ✓ | ✓ | only if revet forced | ✓ ring parapet | ✗ (open sky; OHC toggle contradiction already flagged by v1) | ✓ | 5–6 |
| vehicle_hull_defilade | ✓ (mark the cut) | ✓ (blade first pass) | ✓ ramp + pan | ✗ | ✓ berm = *flatten spoil* | ✗ (no OHC path) | ✓ | 5 |
| vehicle_turret_defilade | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | 5 |
| bunker_op_cp | ✓ | ✓ | ✓ | ✓ | ✓ **sandbag wall build** (bond diagram card) | ✓ | ✓ | 7 |
| connecting_trench | ✓ (trace the route) | ✓ (crawl depth) | ✓ | ✓ | ✓ low mound, both sides, open ends | ✗ typical | ✓ | 6 |
| atgm_javelin | ✓ + **backblast lane** | ✓ | ✓ + platform | ✓ | ✓ + **keep the rear OPEN** | ✓/STOP | ✓ | 7 |

Two special card kinds, inserted by the deck builder, not optional:

- **STOP card (engineered roof).** When `resolveCover` returns `engineered_required`, the overhead stage emits a red-band STOP card instead of a build card: hero shows the v1 hazard slab render; text: "DO NOT build a roof for this threat. A roof you build yourself will not stop it. Get the engineer." This carries the §2.7 fail-safe into the recruit surface — filling doctrine never converts a STOP card into a build card for the 4 direct-fire AT threats + large VBIED.
- **WARNING card(s).** The deck builder consumes `result.validation`; any error/warning (`REVET_REQUIRED_SOIL`, `SHORING`, `SPOIL_SHORT`, ATGM backblast, mortar+OHC contradiction…) prints as a "BEFORE YOU DIG" card at deck front, and its icon repeats on the affected stage card. This fixes v1 defect §6B-4 (job sheet omits validation) **by construction**: the CI completeness gate (§6.3) fails any deck whose result has validation issues but whose deck lacks the card.

### 1.2 The exact card template

Design canvas: **5.5 × 8.5 in portrait** (half of US Letter; two cards tile one landscape Letter sheet with zero waste). Print raster targets 300 dpi (1650 × 2550 px); on screen the same component renders at CSS 1× with the px floors below. Seven fixed zones, top to bottom — every card, every position, same zones, same order (spatial consistency is itself instruction; a recruit learns the template once):

```
┌──────────────────────────────────────────────┐ 5.5in
│ A HEADER  (0.9in)   [3] STEP 3 OF 7          │  step disc + stage verb line
│           DIG DOWN TO FULL DEPTH             │  + position chip
├──────────────────────────────────────────────┤
│                                              │
│ B HERO 3D RENDER  (3.6in tall, full width)   │  fixed camera preset,
│   NOW-parts highlighted, done-parts normal,  │  stage delta glowing,
│   ghost of end state (early stages)          │  scale figure posed
│   [callout discs on the NOW parts]           │
├───────────────────────────┬──────────────────┤
│ C DO THIS (1.4in)         │ D 2D INSET       │
│   1. Dig the whole floor  │  (1.9 × 1.9in)   │
│      down together.       │  ONE governing   │
│   2. Throw dirt to the    │  dimension only, │
│      front and sides.     │  cropped section │
├───────────────────────────┴──────────────────┤
│ E CHECK (1.0in)  ☐ Stand in the hole:        │  body-referenced,
│   the ground hits YOUR armpit. (≈4 ft) (PH)  │  pass/fail, checkbox
├──────────────────────────────────────────────┤
│ F YOU NEED (0.8in)  👤👤 2 Marines · 🕐 ~1½ h │  this stage only:
│   ⛏ e-tools ·  ▭ 0 bags ·  ─ 0 stringers    │  crew, time, materials
├──────────────────────────────────────────────┤
│ G FOOTER (0.35in)  ⚠ NOT FOR FIELD USE ·     │  banner state, fill hash,
│   one_man · stage deliberate (3/7) · p.4/9   │  page ordinal
└──────────────────────────────────────────────┘ 8.5in
```

Zone-by-zone specification:

**A — Header (0.9 in).**
- Step disc: 0.6 in diameter, filled `--ink`, numeral in `--surface`, **34 pt bold mono** — same disc grammar as the 2D callout registry so discs mean "numbered thing" everywhere.
- Stage verb line: **24 pt, weight 800, ALL CAPS, max 28 characters.** These are the seven fixed recruit-register stage names (authored UI copy, no magnitudes): `SET SECURITY & MARK IT` / `DIG QUICK COVER` / `DIG DOWN TO FULL DEPTH` / `HOLD THE WALLS & DIG THE CATCH-PIT` (splits to two lines) / `BUILD THE DIRT WALL UP FRONT` / `BUILD THE ROOF` / `HIDE IT`. The bunker's parapet card retitles to `BUILD THE SANDBAG WALLS`; vehicle parapet card to `FLATTEN THE SPOIL` (doctrine: spoil flattened/hauled, not piled — the card must not teach a rampart).
- Position chip, right-aligned, 10 pt: plain position name ("Two-man fighting position · Deliberate").

**B — Hero picture (3.6 in tall).** A deterministic 3D render from the fixed per-(family × stage) camera preset (§4.2). Visual grammar (§4.1): parts already built = normal material; **this stage's parts = highlighted** (saturated + white 2-px rim + short leader-line label with the callout disc); future parts = 12 % ghost outline on stages 1–2 only. Scale figure always present, posed per stage (§4.4). Enemy direction arrow always visible, labeled `ENEMY` in 12 pt caps — never assume the recruit remembers the orientation from a previous card. Post-processing OFF for card renders (no tilt-shift/bloom/vignette; flat light sky) — §4.5.
- Parapet and camo cards append a **1.0 in "WHAT THE ENEMY SEES" strip** under the hero: same scene from enemy side, ground level (elevation 2°). It is the only enemy-side view in the system and it exists because the pass criterion for those stages *is* the silhouette.

**C — DO THIS (1.4 in).** 1–3 numbered imperative sentences. Hard rules, CI-enforced (§6.3):
- **14 pt / 19 pt line height** print; ≥ 18 px screen.
- ≤ 12 words per sentence; starts with a verb from the allowed list (`dig, throw, stop, stack, lay, place, cut, drive, check, clear, spread, cover, stake, mark, call`); no passive voice; Flesch-Kincaid grade ≤ 5.0 across the card's text.
- **No literal numerals in authored instruction text.** Any number a sentence needs arrives by template slot filled from the engine (`Lay {bagsCover} bags on the roof.`) — computed values carry provenance; authored prose carries none. The only permitted literal digits are step/callout references ("wall ③").
- Jargon policy: plain word only, in recruit mode. The doctrinal term does NOT ride in parentheses on cards (unlike v1's D23 UI convention) — it moves to the footer glossary line of the card (`parapet = the front dirt wall`, 8 pt). Rationale: parentheticals measurably lengthen sentences past the reading floor; NCO cross-reference is preserved, just demoted.

**D — 2D inset (1.9 × 1.9 in), only where measurement matters.** A cropped, stage-aware section or plan detail carrying **exactly one dimension chain** — the one this card's CHECK verifies — rendered by the same 2D renderer in "detail mode" (§3.4). Cards that need it: deliberate (depth), revet_sump (sump size/position), parapet (height + the 2-bag rest), overhead (cover thickness + the setback shelf), vehicle deliberate (depth of cut at the pan). Cards that must NOT have it: security, hasty, camo (their checks are not measurements; an inset there is noise). The inset's dimension uses the body-check's numeric fallback value, same (PH) flag.

**E — CHECK (1.0 in).** The pass/fail self-test. This is the card's load-bearing element and it is **doctrine data**:
- Text: **16 pt bold**, dark on light, preceded by a **0.28 in checkbox** the Marine physically ticks with a pencil (print) or taps (screen). 1–3 checks max; each independently pass/fail; no judgment words ("about right," "roughly level" are banned — a check must be decidable by a tired 18-year-old).
- Body-referenced primary, measured secondary: `☐ Stand on the floor: the ground hits YOUR armpit.` then, in 10 pt regular, `(that's about 4 ft / 1.2 m)`. The numeric echo comes from the governing doctrine dim and inherits its `(PH)` flag. "YOUR" is deliberate and doctrinally faithful — the position fits its occupant; the check self-scales to the Marine building it.
- **Check text is a `Provenance<string>` leaf**: `fieldChecks.<position>.<stage>[i]` — value = the sentence, `status: PLACEHOLDER`, `source: 'TODO: confirm against current pub'`, `safetyCritical: true` for depth/cover/standoff/backblast checks. On a fresh build every check renders as: `☐ [CHECK PENDING DOCTRINE FILL — leader supplies the standard] (PH)` — the card is structurally complete but visibly value-empty, exactly like a v1 drawing dimension. The owner fills the sentences one by one, offline, with citations, through the same `io.ts` import (extended to string leaves, same all-or-nothing/validation regime; magnitude bound obviously waived for strings, replaced by a length ≤ 140 chars + no-control-chars bound).
- The body-unit vocabulary itself is doctrine data too: a `bodyUnits` table of `{ phrase: Provenance<string>, approxFt: Provenance<number> }` pairs (armpit height, chest, waist, knee, helmet length, extended e-tool, rifle length *per named weapon*, bayonet, boot). Check leaves reference these by id where possible so one fill corrects every card. Rifle-length checks must name the weapon in the phrase (an M4 and an M16A2 differ by half a foot); that naming is the owner's fill decision, not ours.

**F — YOU NEED (0.8 in).** This stage's resources only, straight from the exact partition:
- Crew: person pictograms × `crewSize` (from `positions.ts`), overridden by the leader's team assignment when a schedule exists.
- Time: `stageStep.manHours / effectiveDiggers` from `scheduleStages`, **display-rounded UP** to friendly units (¼ h below 1 h, ½ h below 4 h, 1 h above) — schedule math untouched, and the card shows the cumulative clock when the leader set one: `done by H+3½`. (Prerequisite: the v1 machine double-count fix, STATE §6B-3 — the card system must not inherit a 2.5×-optimistic clock.)
- Materials: `STAGE_BOM[stage]` lines with pictogram + count + plain name (`▭ 76 sandbags · ─ 9 beams · ▤ 1 plywood sheet`). Zero-material stages print `⛏ e-tools only`. Because STAGE_BOM is an exact partition, the deck's YOU-NEED strips sum to the position BOM to the unit — CI-asserted (§6.3), same invariant style as v1's stage tests.

**G — Footer (0.35 in).** Left: the **NOT FOR FIELD USE banner** in 9 pt red-on-white bordered caps whenever `placeholderReport.remaining > 0` OR any leaf *this card consumed* is PH (per-card provenance, stricter than v1's global-only banner). Center: glossary line (≤ 2 terms). Right: `one_man · deliberate (3/7) · page 4/9` and the doctrine fill-manifest hash when one is applied (v1's D30 attribution carried onto every physical page a Marine might tear out of the packet — a loose card must still convict or clear itself).

### 1.3 Worked example — one_man, STEP 3 (deliberate dig)

All check text ILLUSTRATIVE-PLACEHOLDER; shown to prove the template, not to supply values.

- A: `[3] STEP 3 OF 7 — DIG DOWN TO FULL DEPTH` · chip `One-man fighting position · Deliberate`.
- B: rear-left three-quarter preset (az −35°, el 45°), hole walls+floor highlighted, ghost of parapet+roof at 12 %, figure standing IN the hole with a dashed line at its armpit meeting grade, `ENEMY →` arrow.
- C: `1. Dig the whole floor down evenly — no deep end.` `2. Throw the dirt out front and to the sides. You will build the wall from it next.`
- D: cropped section, single vertical chain `depth 4'-0" (PH)`, figure in-slice.
- E: `☐ Stand on the floor: the ground hits YOUR armpit. (≈ 4 ft) (PH)` `☐ The floor is flat — your boot doesn't rock anywhere on it.`
- F: `👤 1 Marine · 🕐 ~2½ h · ⛏ e-tool only`.
- G: banner + `one_man · deliberate (3/7) · fill —— · p.4/9`.

### 1.4 Print packet layout

The packet is the deck plus its leader wrapper, one print job:

1. **Cover sheet (Letter portrait):** position plain name + final-state hero render + the range-card plan (leader's) + a **deck index with per-step checkboxes** — the fire-team leader's tracking sheet — + totals strip (crew, total time, full BOM rollup) + the hand-fill field header v1 already has (GRID/UNIT/DTG/AZIMUTH/PREPARED BY) + signature block.
2. **Warning card page** when validation issues exist.
3. **Stage cards, 2-up on landscape Letter** (two 5.5 × 8.5 portrait cells, 0.25 in inner padding per cell, hairline cut/fold mark). Card sequence flows left-cell-then-right-cell so cutting the stack and stacking the halves yields deck order. Single-sided by default — a card's back is blank on purpose (mud, and pencil notes).
4. **Back sheet:** the full leader drawing pair (plan + section, complete dims) + BOM table + validation list — the packet serves the NCO without a second print job.

Physical constraints designed in: folded once, the Letter sheets become 8.5 × 5.5 — fits a **gallon ziploc (10.5 × 11 in) flat with margin**; cut cards fit a quart bag. All meaning survives 1-bit monochrome (pattern/weight redundancy, §3.2). Minimum stroke on paper 0.75 pt. No solid-ink field larger than the 0.9 in header band (glare through a wet bag). Page ordinal bottom-right in 14 pt so the right page is findable while flipping a bagged stack with gloves.

### 1.5 On-screen stepper, synced to the 3D scrubber

The stepper and the v1 stage scrubber become **one control over one store field** (`ui.buildStage`), so screen and print can never tell different stories:

- Card rail at the bottom (mobile: the bottom sheet is the card; desktop: right panel). `◀ BACK` / `NEXT ▶` buttons **64 × 64 px minimum** (§5.1), plus tap-right-half / tap-left-half advance on the card body, plus ArrowLeft/Right, plus the scrubber itself (which keeps its 0–6 doctrinal ticks for leader mode — and gets the `<datalist>` v1 forgot, STATE §6C-N3).
- Selecting card *k*: sets `buildStage` to the card's stage id → `buildScene3D(result,{stage})` refilters parts → viewer `fly()`s to the card's camera preset (§4.2) → `startStageRise` plays the delta. The camera-never-reframes defect (STATE §6C-N5) is closed by construction: every card change is a framing event.
- The on-screen card is the same component as print zone-for-zone; checks are tappable and persist per scenario (a leader can see 4/7 steps checked on the shared device).
- `sr-status` announces "Step 3 of 7 — dig down to full depth" on change; the card body is the accessible name source, reusing v1's a11y plumbing.

---

## 2. PROGRESSIVE MODES

One engine, one `Result`, three projections. **Mode is presentation only and never changes computation** — the direct extension of v1's D17 unit-toggle invariant, and CI-tested the same way (same `Result` hash across modes).

### 2.1 Recruit mode — "BUILD" (default on handoff / small screens)

Shows: the card stepper + hero 3D + the check list + YOU-NEED strips + the banner. That's all.
Hides — and why:
- **All input controls.** A recruit changing soil or threat silently changes safety outputs; build mode is read-only over a scenario the leader configured and handed off (saved scenario or the printed packet). The only recruit inputs are check ticks.
- **Measured drawings** (except the single-dim insets). A dimensioned plan is the thing the mandate says the recruit can't read; the card is its translation. The full drawings are one tap away behind a `LEADER VIEW` guard, not deleted — hiding is a default, never a lock (this is a planning tool, not an access-control system).
- **BOM/labor/spoil tables, derivations, doctrine workbench, mission/compare/plan tools.** Numbers invite improvisation; the trace panel is meaningless without training; the doctrine workbench in a recruit's hands is a liability path (it is leader-gated in all modes anyway per the fill regime).
- Numbers policy: recruit mode shows **counts** (bags, beams, Marines), **clock time**, and **body checks with small numeric echoes**. It never shows a bare dimension table.

### 2.2 Leader mode — "PLAN" (v1's UI, redesigned per §3)

Shows: full input controls, plan + section with complete dimensions, specs with fidelity statements, BOM (13 line kinds), labor + blade-hours, spoil balance, validation panel, stage table + stand-to schedule, job sheet/CSV/SVG exports, the doctrine-values workbench, tap-to-explain. The deck is visible here too (leaders rehearse with it), plus the deck-index tracking sheet.
Hides: mission rollup, compare, time-available planner — not because leaders may not use them, but because they answer a different question ("which position / how many," not "this position, built right") and v1's audit showed tool sprawl in one topbar. They live in planner mode one switch away.

### 2.3 Planner mode — "MISSION"

Shows: mission BOM rollup with on-hand/shortfall, side-by-side compare, compare-across-standards, inverse time-available planning, per-position schedule bars against stand-to, and **per-position validation rollup** (fixing STATE §6C-N11 — a mission view that drops engineered-roof warnings is a planner trap). Drawings appear as thumbnails that open leader mode.
Hides: card decks and per-stage detail (aggregate answers don't need them), input minutiae beyond the compare set.

### 2.4 Mode plumbing

- Mode switch: three-segment control in the topbar (`BUILD · PLAN · MISSION`), persisted per device; deep links/scenario handoff carry the intended mode.
- Print artifacts per mode: BUILD → the packet (§1.4); PLAN → job sheet + range card; MISSION → mission BOM + schedule matrix.
- Default resolution: first launch on a phone-class viewport with a handed-off scenario → BUILD; otherwise PLAN. Never auto-enter MISSION.

---

## 3. 2D REDESIGN PRINCIPLES

The 2D drawings remain the **measured truth** — "not to scale — dimensions govern" stays in the header verbatim. What changes is that v1's drawings were built to be *complete*; SAP-2's must also be built to be *scanned* in bad light by wet hands.

### 3.1 Keep from v1 (proven, do not relitigate)

| v1 convention | Why it stays |
|---|---|
| **Single callout/legend registry** (`svg.ts` CALLOUTS + `buildLegend` from `used`) — legend generated from what a view actually drew | The no-drift guarantee is the best idea in the render layer; SAP-2 extends it to cards and 3D labels (§3.3) |
| Numbered discs, plain-language-first legend labels | Recruits read numbers before words; discs survive mono/print |
| Pattern redundancy beyond hue (`pat-earth` 45° hatch, `pat-cover` dots, `pat-engineered` hazard hatch) | CVD / night / 1-bit print all covered by one mechanism |
| Single-accent dimensions with end ticks; label plates over a surface-colored chip | Dimensions read as one visual class |
| `guard()` throws on non-finite; fuzz + NaN matrix tests | Non-negotiable safety floor |
| Header bar per view, FRONT/ENEMY orientation, north arrow, scale bar, standing figure, degrees + mils | The orientation layer is exactly what an untrained reader needs most |
| Engineered-roof hazard block instead of a fabricated thickness | §2.7 fail-safe, carried everywhere |
| Print tokens inlined for self-contained artifacts (D14) | Generalized in §3.5 to fix the black-SVG defect class |

### 3.2 Change: legibility floors (exact numbers)

v1's floors (11 px dim/legend text, 9.5 px figure label, 10 px scale bar, DISC_R 9) were sized for a desk screen. New floors, enforced by the render-intuitive gate at the new values:

- **Minimum text anywhere in a drawing: 12 px** design units on screen (kill the 9.5/10/10.5 px strays); **dimensions 13 px semibold**; callout disc radius **11 px** (22 px glyph) with **13 px numeral**.
- On paper: minimum rendered text **8 pt** after layout scaling; card-zone text floors as in §1.2 (instruction 14 pt, check 16 pt bold). The gate computes effective printed size from the layout scale factor, not just the SVG attribute.
- Minimum stroke: 1.25 px screen / 0.75 pt print; hairlines banned in artifacts that leave the app.
- Dimension label plates gain 2 px padding and a 1 px border so they survive pattern backgrounds (v1's opacity-0.9 chip washes out on the earth hatch in night amber).

### 3.3 Change: one registry to rule every surface

The callout registry becomes the **naming authority for the whole product**: each entry gains `{ n, plain, term, glyph }` and is consumed by (a) 2D callouts + legend, (b) card text references ("wall ③"), (c) 3D leader-line labels in hero renders, (d) the BOM's plain names, (e) the a11y descriptions. One number, one plain name, everywhere — a recruit who learns "③ = the front dirt wall" on the card finds the same ③ on the plan the NCO is holding. Recruit surfaces render `plain` only; leader surfaces render `plain (term)` (v1 D23 unchanged there). CI: any number cited in card prose must exist in that card's rendered legend set (§6.3).

### 3.4 Change: primary-dimension discipline and detail mode

- **Leader drawings:** every dim is classified `governing | reference`. Governing dims (the 2–4 a builder must hit: depth, frontage, parapet height/thickness, cover thickness, setback, ramp run) render at 1.5× weight in the accent color with a boxed label; reference dims render lighter and thinner. v1 draws all dims at one weight — completeness reads as noise. The classification lives on `DimSpec` (engine-side, testable), not in the renderer.
- **Detail mode (card insets):** the renderer accepts `{ crop, dims: [oneKey], stage }` and emits a cropped, stage-aware fragment — the same code path as the full section (one projector, one registry), which delivers 2D-plan item U3 (stage-aware section) as a by-product. An inset may contain exactly one dim chain; the gate counts.
- Callout de-collision (v1 R7 leftover) becomes a hard gate: no disc may overlap a dim label or another disc; the renderer nudges along a defined search path and the test asserts zero overlaps across the full position × threat matrix.

### 3.5 Change: artifacts are self-contained by construction

v1's worst showstopper for this audience is §6B-1: downloaded SVGs render black because `var(--…)` never resolves outside the app. SAP-2 rule: **every artifact that leaves the app (SVG download, job sheet, card packet) passes through a token-resolution step** that substitutes literal values from the active palette (Day for print, Night amber for a requested night export) — the generalization of D14's print-tokens. The offline gate grows a sibling: an **artifact gate** that renders each export headlessly and asserts no unresolved `var(` remains and that all text meets the print floors.

### 3.6 Night / CVD / mono in 2D

- The Night palette (existing amber-on-black tokens, `tokens.css` `[data-theme='night']`) applies to on-screen drawings and to an explicit "night print" variant (§5.3). Patterns already make hue optional; the new rule: **stage-highlight in any 2D surface = weight + arrow + pattern, never hue alone** (matches the 3D grammar §4.1).
- Mono print check moves from convention to CI: rasterize exports to grayscale and assert the NOW-highlight/DONE separation ≥ 30 L* and all pattern pairs remain distinguishable at 300 dpi (structural difference, not just gray value).

---

## 4. 3D-AS-INSTRUCTION

v1's 3D is a faithful diorama with a stage scrubber. SAP-2 keeps the diorama for exploration but adds an **instruction grammar**: the render must answer "what do I do next, where, and how big" before it is allowed to be pretty.

### 4.1 Stage-delta grammar (three states, fixed meanings)

Derived directly from `partStage()` — no new tagging needed:

- **DONE** (`partStage < current`): normal materials, slightly desaturated (−15 % S) so the delta pops.
- **NOW** (`partStage === current`): full saturation + **white 2-px rim outline** + a slow 0.8 Hz emissive pulse on screen (±12 % luminance; disabled under `prefers-reduced-motion`, and *absent in print* where the rim + leader-line label does the work). Every NOW part group gets a leader line to a callout disc reusing the registry number.
- **GHOST** (`partStage > current`): 12 % opacity wireframe of the end state. Default ON for stages 0–2 (the recruit sees where the hole is going while it's still a stake line), OFF from stage 3 on (clutter over the parapet/roof work). Toggleable; the card records which state it printed with.

The v1 `startStageRise` ease-in animation stays as the screen transition; print obviously freezes the settled state.

### 4.2 Fixed camera presets per card (data, not vibes)

A pure `render3d/cameraPresets.ts` table keyed by `(shapeFamily, stage)` → `{ azimuthDeg, elevationDeg, frame: 'all' | 'now' | 'hole', cutaway: boolean, ghost: boolean }`. Azimuth 0° = viewed from friendly rear (+z) looking toward the enemy (−z, matching scene3d's axis convention); positive = clockwise. Invariant: **the default hero never views from the enemy side** — the recruit's mental model must be "I am standing behind my own hole"; the sole exception is the labeled WHAT-THE-ENEMY-SEES strip (az 180°, el 2°).

| Stage | rect family (one_man, two_man, connecting_trench, bunker) | inverted_t / l_shape (mg, .50, ATGM — mirror az for l_shape arm side) | circular (mortar) | vehicle_ramp |
|---|---|---|---|---|
| 0 security | az −35°, el 50°, frame all, ghost ON | az −45°, el 50°, ghost ON | az −30°, el 60°, ghost ON | az −60° (from ramp entry), el 35°, ghost ON |
| 1 hasty | az −35°, el 45°, frame hole | az −45°, el 45° | az −30°, el 55° | az −60°, el 30° |
| 2 deliberate | az −35°, el 45°, frame hole (floor + figure visible) | az −45°, el 45° (both arms in frame — asserted, see below) | az −30°, el 55° | az −60°, el 25°, frame all (ramp + pan run) |
| 3 revet_sump | az −25°, el 30°, **cutaway ON**, frame now | az −35°, el 30°, cutaway ON | (only when present) az −30°, el 40°, cutaway ON | — |
| 4 parapet | az −20°, el 18°, frame now + enemy strip | az −30°, el 18° + enemy strip | az −30°, el 45° (ring reads from height) | az −60°, el 12° (flattened spoil must read LOW) + enemy strip |
| 5 overhead | az −35°, el 30°, **cutaway ON** (underside + setback shelf visible) | same | — | — |
| 6 camo | az −35°, el 35°, frame all + enemy strip | same | same | same |

- Presets are node-testable: for every position × stage, project the NOW parts' bounding box through the preset camera and assert ≥ 80 % lands inside the frame and the scale figure is unclipped. This test replaces "looks right" with arithmetic, and closes the never-reframes defect class (STATE §6C-N5) permanently: framing is a pure function of (result, card).
- ATGM special: stages 0 and 4 add the **backblast lane wedge** (translucent hazard fill to the rear, radius = the `backblast.clearanceFt` leaf, label inherits its (PH) flag) and the preset rotates to az +160°, el 35° for those two cards so the open rear is the star of the frame.

### 4.3 Cutaway rules

Cutaway = the existing clipping plane, but **auto-driven by the card**: ON for subsurface/interior work (revet_sump; overhead; deliberate for platform positions mg_crew/fifty_cal/atgm where the platform step must read), OFF for silhouette stages (security, hasty, parapet, camo). The card prints a small `view: cut in half` chip whenever its hero used cutaway, so paper and screen state match. Leader mode keeps the free toggle.

### 4.4 Scale-figure rules (the figure is the check)

- A figure is present in **every** hero render, no exceptions, height = REF 5.83 ft, labeled on leader surfaces only.
- Posed per stage: standing beside the stake line (0); kneeling/digging (1); **standing in the hole with a dashed line at the figure's armpit projected to grade** (2) — the 3D embodiment of the depth check; kneeling placing bags at the wall (3–4); kneeling under the roof (5 — which also retires v1's head-through-roof artifact, 2D plan R4); standing off to the side (6).
- The figure never stands on parapet/berm parts (v1 already learned this) and never occludes NOW parts (preset test asserts no overlap between figure screen-box and > 30 % of any NOW part's screen-box).
- Card caption under hero when depth is the check: `the line is HIS armpit — check against YOURS` (authored copy, no numbers).

### 4.5 Realism that instructs vs decorates

Keep (instructional): bond-true sandbag courses (header/stretcher per FM 5-103 — the bunker/rest cards teach the laying pattern from the picture; bag counts where the count is the doctrine, e.g. the 2-bag-deep front rest); true stringer count/spacing (a recruit counts beams off the hero — v1's cover slab must give way to the R4-style real build-up in SAP-2's overhead card); per-soil ground surface (confirms "this card is about MY dirt"); honest revetment finishes (picket wire looks like picket wire); the entry steps; terrain with true holes.
Drop from card renders (decorative there, fine in explore view): painted sky, fog, tilt-shift, bloom/grade, shadow drama (fixed sun at az 315°/el 55°, soft shadows only — consistent shadow direction is itself a reading aid), scatter props near the work area, GLB pop-in states (cards render only after props resolve or with procedural fallback, never mid-pop).
**Banned on cards:** the vehicle 2× relief exaggeration (scene3d `RELIEF_EXAGGERATION`). Cards teach size; an exaggerated cut on the card contradicts the check ("the hull sticks up no higher than YOUR chest" against a picture drawn 2× deep is a walking contradiction). Card renders use true scale plus a **depth flag**: a vertical pole at the pan marked at hull height with the figure beside it. Explore view may keep the exaggeration only with the existing disclosure upgraded to an explicit `depth ×2 for visibility` chip (STATE §6C-N10).

---

## 5. FIELD REALITY (constraints → design decisions)

| Reality | Concrete design consequence |
|---|---|
| **Gloves** | Build-mode touch targets ≥ **64 × 64 px** with ≥ 8 px gaps (leader desktop keeps v1's 44 px `--tap-min`). No drag-required interaction in build mode: stepper buttons and preset-view buttons instead of slider thumbs and pinch (the scrubber slider remains a leader control). Checks toggle by tapping the whole check row, not the 0.28 in box. |
| **Rain / mud / ziploc** | Packet spec §1.4: gallon-bag fit, single-sided cards, no full-bleed ink fields (glare), 14 pt+ page ordinals, blank card backs for pencil. Paper is the primary field medium — the screen is the leader's and the rehearsal tool; never design a step that *requires* the phone in the hole. |
| **Night, red-light discipline** | Screen: existing amber Night tokens extend to build mode; hero night variant = same geometry, dim fills + amber rim lines; NOW-highlight = brighter amber + pulse (hue unavailable at night, so the grammar is luminance + motion + outline). Print: a **red-lens rule** — under a red-filtered light, red ink and light grays vanish; therefore print artifacts never carry meaning in red except the STOP/hazard band (which is *also* hatched, so it survives), and no text below 40 % K. An optional "night packet" prints the amber-on-dark palette for headlamp-under-poncho use; default packet stays black-on-white (red light on white paper reads fine when contrast is pure black). |
| **No tape measure** | Body units are the primary measurement system of recruit mode (§1.2-E): doctrine-fed `{phrase, approxFt}` pairs; every measured check carries its body phrasing first and its numeric echo second. Where doctrine gives only a number and no body phrase, the check leaf stays PENDING until the owner supplies phrasing from the pub or the leader's SOP — the software never coins an equivalence. E-tool/rifle/helmet references name the exact item. |
| **One-handed phone** | Build mode is portrait-locked, all controls in the bottom third (thumb zone), card advance = tap right half / back = tap left half, 64 px buttons duplicated at bottom corners, no top-corner actions, no modal that requires two hands. Fully offline (PWA + single-file artifact already ship). |
| **Sunlight** | Day theme's high-contrast tokens stay the daytime screen default; hero renders on near-white ground with outline reinforcement so a washed-out screen still shows edges. |
| **Cold / stress / interruption** | Every card is self-sufficient: re-states enemy direction, shows done-state context, and its check is decidable without memory of previous cards. A Marine handed card 5 alone can verify stage 5. This is why zone order never varies and why the ENEMY arrow is on every hero. |

---

## 6. COMPREHENSION TESTING

### 6.1 The honest part: humans on paper

Cheap, repeatable protocol, run before first field exposure and after any template change:

- **Participants:** 5–8 people with no diagram training (new joins, admin Marines, civilian proxies — the mandate's bar is "hasn't finished forming week," so *anyone untrained* is a valid proxy for the geometry tasks; only vocabulary tasks need military participants).
- **Materials:** printed packet for one position (rotate through at least one_man, mg_crew, vehicle_hull_defilade, bunker_op_cp — the four hardest shape families), masking tape, a lawn or sand table, a stopwatch.
- **Tasks (scored unassisted / assisted / fail, plus time):**
  - T1 Orientation: "Point to where the enemy would be." (cover sheet or any card)
  - T2 Layout: "Tape the outline of the hole on the ground." (cards 1–2; pass = right shape, size within 25 %)
  - T3 Depth: "Tell me exactly how you'll know when to stop digging." (must recite the body check, not a number)
  - T4 Materials: "From these three piles, pick what step 5 needs." (YOU-NEED strip)
  - T5 Pattern: "Show me on the picture how the second row of bags sits on the first." (bunker/rest card, bond grammar)
  - T6 Safety: engineered-threat deck: "What do you do about the roof?" (pass = 'stop / get the engineer'; **any other answer is a program-stopping failure**)
- **Acceptance bars:** ≥ 4/5 unassisted on T1–T3; ≥ 4/5 on T4; T6 = 100 % or the STOP card is redesigned before anything ships. Log every run in `docs/COMPREHENSION_LOG.md` with card version hashes — the testing record is part of the liability posture (documented diligence), and its absence should fail a release checklist, not CI.

### 6.2 Error taxonomy (code every observed failure)

- **O — orientation** (enemy side wrong, layout mirrored)
- **S — scale** (size off > 25 %, wrong body landmark)
- **Q — sequence** (stage out of order, skipped check)
- **M — measurement** (check misread, numeric echo used instead of body check and misconverted)
- **V — vocabulary** (word not understood — feeds the glossary line and the plain-name registry)
- **A — abandonment** (asked for help / gave up; record where in the card the eyes were)

Rule: any code triggered by ≥ 2 participants on the same card ⇒ that card revises before release; O and S revisions must change the *picture* (preset, ghost, figure), not just the words — words were already at the reading floor.

### 6.3 Automated CI proxies (node-testable, in the v1 gate tradition)

These are proxies, not proof — they hold the floor between human tests:

1. **Readability gate:** FK grade ≤ 5.0 per card text block; sentence ≤ 12 words; imperative-verb start from the allowed list; no passive-voice heuristic hits; banned-word list (`approximately, sufficient, ensure, utilize, prior to…`).
2. **No-invented-numbers gate:** authored instruction/caption strings contain **no literal digits** (step/callout references excepted by pattern); every displayed number resolves to an engine value or a Provenance leaf. This is v1's number-free gate extended from the engine to the *copy*.
3. **Card completeness gate:** for every position × non-empty stage in the full matrix: header verb line present; camera preset exists; ≥ 1 instruction; ≥ 1 check leaf (even if PLACEHOLDER — but never blank); YOU-NEED lines exactly equal `STAGE_BOM` partition and deck-sum equals position BOM; crew + time present; STOP card present iff `engineeredRoof`; WARNING card present iff validation issues; per-card banner state correct against the leaves that card consumed.
4. **Glyph/target floors:** walk every generated SVG/card DOM: text ≥ floors (§1.2/§3.2, computed at effective print scale), strokes ≥ floors, build-mode tap targets ≥ 64 px, checkbox ≥ 0.28 in.
5. **Callout coherence:** every disc number cited in prose exists in that card's rendered legend; every legend number appears in the art; no disc/label overlaps.
6. **Preset framing test:** §4.2's ≥ 80 %-in-frame and figure-unclipped assertions across the position × stage matrix.
7. **Contrast/mono gate:** NOW vs DONE ≥ 3:1 luminance in Day and Night palettes; grayscale rasterization keeps ≥ 30 L* separation; no meaning-bearing red-only element in print output.
8. **Determinism:** same inputs ⇒ byte-identical deck data + SVG layers (hero WebGL rasters are excluded and documented as presentation — GPU rasterization is not byte-stable across machines; the *scene descriptor and preset* that produced them are asserted identical instead).
9. **Doctrine-integrity extension:** every `fieldChecks.*` and `bodyUnits.*` leaf ships PLACEHOLDER; a DOCTRINE check-string with a TODO source is rejected; safety-critical checks (depth, cover, setback, backblast, shoring) are tagged and counted in `safetyCriticalRemaining` so the banner arithmetic covers the card system exactly as it covers thicknesses.

### 6.4 What this buys the liability posture

The tool's recruit surface ends up structurally incapable of being the source of a safety number: instructions carry no digits by gate #2; checks are owner-entered leaves by gate #9; the banner and fill-hash ride on every printed page; STOP cards are un-fillable by design; and the comprehension log documents that the presentation itself was diligently tested. The remaining exposure is the *structure* of the advice (stage order, camera truthfulness, body-check framing) — which is why the D29-style SME review and JAG/counsel review are listed as blocking open risks below, not footnotes.

---

## 7. Open risks and dependencies

1. **Scheduler double-count (STATE §6B-3) is a hard prerequisite** — cards print per-stage clock times; shipping cards on a 2.5×-optimistic clock is worse than no times.
2. **String leaves are new to the provenance regime** — `io.ts` validation must grow a string path (length/charset bounds, no magnitude bound); design says how, but it is engine work that must land before any check text can be filled.
3. **Hero print pipeline** depends on WebGL readback (v1's `preserveDrawingBuffer:true` lesson, D21); the no-WebGL fallback plan (stage-aware 2D pair replaces the shape-blind iso, retiring R8) must be built or no-GPU users get cards without heroes.
4. **Body-unit doctrine coverage is unknown** until the owner's fill: some stages may have no doctrinal body phrasing (vehicle pan depth), leaving PENDING checks in an otherwise-filled deck; the banner logic handles it honestly, but the field experience needs a leader-supplied-SOP escape hatch worded by counsel.
5. **Comprehension tests need real humans** — CI proxies will pass a deck that confuses everyone; the release checklist must make §6.1 non-optional, and nobody on the current team can self-certify "a recruit can follow it."
6. **Card count at full matrix** (10 positions × up to 7 stages × 3 standards × toggles) is a combinatorial print surface; decks are generated per configured Result, never pre-rendered, so the surface is bounded by what leaders actually configure — but golden-deck snapshot tests should pin at least the 10 default decks.
7. **SME structural review (D29) still open** — stage order, vehicle spoil-flattening guidance, and backblast lane presentation are structure, not constants; a qualified reviewer must confirm them before field trials.
8. **JAG/counsel review required** for: the STOP card wording, the banner wording on per-card footers, the "leader supplies the standard" pending-check wording, and the packet's handling/CUI marks once filled (D31 applies to decks exactly as to job sheets).

