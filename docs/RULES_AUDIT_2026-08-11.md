# Rules Audit — Coherence, Accuracy & Sourcing (2026-08-11)

Full two-pass check of the rule base, as requested: **Pass 1** — do the rules make
complete sense for this application; **Pass 2** — accuracy and sourcing. Scope: the
SAP-1 doctrine tables (`src/doctrine/`), the engine rule logic (`src/engine/`), the
timber rule base (`src/timber/`), the sourcing docs (`DOCTRINE_SOURCES.md`,
`PLACEHOLDER_POLICY.md`, `DECISIONS.md`, `README.md`, `USER_GUIDE.md`), and the
renderer linkage findings from the visual-accuracy sweep. Four independent audit
passes, top findings re-verified against source by hand. Test suite at audit time:
**941 tests, 0 failures** — every finding below coexists with a green suite, and
§5 explains why the gates don't see them.

Severity key: **S1** breaks a safety promise or corrupts a drawing · **S2** wrong
numbers on the job sheet / BOM · **S3** traceability or documentation defect.

---

## 1. Pass 1 — Coherence: rules that do not make sense for the application

### 1.1 Rules whose incoherence corrupts the drawings (the diagrams-depend-on-this set)

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| C1 | S1 | **`firingPlatform.depthBelowHole` is consumed with two opposite meanings.** The doctrine definition says the platform floor is *below* the bay floor and `compute` bills `L×W×depthBelowHole` as **extra excavation**; both renderers draw the platform as a **raised tread above the bay floor** (earth left in place — i.e. *less* excavation). The spoil figure and the drawing cannot both be right. | `src/doctrine/positions.ts:21`, `src/engine/compute.ts:205-207`, `src/render/drawSection.ts:121-123`, `src/render3d/scene3d.ts:475` |
| C2 | S1 | **Three different roof footprints for one roof.** BOM: `hole + 2×bearingEachEnd` all four sides. 2D section: front edge **inset** by `setback`. 3D: front edge **extended** by `setback`. `GeometryModel.section` never states a sign convention for `setback`, which is how the two views ended up opposed on a safety-critical standoff, and the cover/fill quantities correspond to neither drawn roof. | `src/engine/compute.ts:233-236`, `src/render/drawSection.ts:161`, `src/render3d/scene3d.ts:451-455` |
| C3 | S1 | **`fifty_cal.firingPlatform.W` (3.0 ft) is wider than `fifty_cal.hole.W` (2.0 ft)** — the table describes a geometrically impossible position. Geometry clamps it *for drawing only* while `compute` still bills the unclamped 12 ft³ of spoil that cannot exist. | `src/doctrine/positions.ts:117-122`, `src/engine/geometry.ts:181-192`, `src/engine/compute.ts:205-207` |
| C4 | S1 | **`parapet.H` (0.5 ft) contradicts `sandbag.frontWallHeight` (0.83 ft)** — two doctrine tables disagree about the same physical object. The 3D already patches around it (`max(parapetH, frontWallHeight)`), the 2D section draws the shorter one, and `bunker_op_cp`'s entire sandbag-wall ring count is derived from the 6-inch parapet height. | `src/doctrine/protection.ts:168-169`, `src/doctrine/materials.ts:26`, `src/render3d/scene3d.ts:365`, `src/engine/compute.ts:195,265` |
| C5 | S2 | **`wallSlopeRatio` is saturated by hard-coded caps in its consumers** — `min(parapetW×0.9, min(holeL,holeW)×0.35)` binds for every soil except rock/frozen on a 2-ft-wide position, so the table's stated purpose ("what makes the excavation shape differ by soil") reduces to a rock/not-rock binary. The surrounding vocabulary also calls sand (the *flattest* face, 1.48 H:V) "steeper". | `src/engine/geometry.ts:104-113`, `src/render3d/scene3d.ts:17`, `src/doctrine/soils.ts:10-11` |
| C6 | S2 | **`one_man` uses the opposite L/W aspect from every other dismount position** (L 2.5 frontage / W 4.0 front-to-back, vs 7.0/2.0, 8.0/2.0, 9.0/2.0, 15.0/2.5). As written a soldier alone needs 4.0 ft of front-to-back room but only 2.0 ft with a buddy; the one-man dig costs 40 ft³ vs 28 ft³/soldier for the two-man. | `src/doctrine/positions.ts:76-79,90,101,117,178` |
| C7 | S1 | **Renderers hardcode physical dimensions the rules never see** (from the visual-accuracy sweep, unresolved): 2D and 3D disagree on firing-step size (`min(0.8, d×0.25)` vs `min(0.67, max(0.5, d×0.15))`); three different sump sizes across doctrine/2D/3D while `materials.sump` (1×1×1 ft) is only used for volume; the computed stringer size (4×4/6×6/8×8) never reaches `GeometryModel` — both views draw a fixed cross-section (3D even labels it "per doctrine"); `MORTAR_PIT_BATTER = 0.25` is a doctrinal ratio living in the renderer; T-stem/L-arm proportions are duplicated literals in `drawPlan.ts` and `scene3d.ts`; stringers drawn capped at 8 while the BOM bills the true count. | `src/render/drawSection.ts:127-128,143,148`, `src/render3d/scene3d.ts:263,461,479,489-490`, `src/ui/three-viewer.ts:1206`, `src/render/drawPlan.ts:51-52,158,160`, `src/render/drawSection.ts:168`, `src/render3d/scene3d.ts:457` |
| C8 | S2 | **`geometry.ts` keys wall taper on the raw revetment string, not the resolved row** — an unknown revetment string resolves to `none` everywhere else (no material, no labor, `REVET_REQUIRED_SOIL` fires) but the drawing shows plumb walls as though revetted, contradicting the engine's own conclusion. | `src/engine/geometry.ts:105` vs `src/engine/compute.ts:144` |
| C9 | S2 | **`firingStepOn` gates on the raw position string while using the fallback row** — an invalid `positionType` falls back to the `one_man` row, but `raw.positionType !== 'one_man'` passes, so the section draws a firing step on a one-man position, which the adjacent comment says doctrine forbids. | `src/engine/compute.ts:221,128` |

### 1.2 Safety/fail-safe rule defects

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| C10 | S1 | **`resolveCover` fails OPEN on a missing shielding leaf**: `const base = leaf ? leaf.value : 0` returns `roofPath: 'earth_on_stringers'` with `thickness: 0` and no `thicknessLeaf` — a roof is drawn, stringers are billed, protection is zero, and `COVER_UNDER_THREAT` cannot fire (it requires `calc.coverLeaf`). Every other unknown in the module routes to `engineered_required`; this branch does the opposite. | `src/engine/protection.ts:45-50`, `src/engine/validate.ts:88` |
| C11 | S1 | **The span fail-safe is opt-in** — `clearSpanFt?` is an optional parameter; omit it and an over-span roof gets a fabricated thickness with no warning. The one production caller passes it today, but the module's own tests call `resolveCover` without it, demonstrating the bypass. Make it required. | `src/engine/protection.ts:30,41`, `test/protection.test.ts:8-45` |
| C12 | S1 | **The "cover too thin" check rounds in the unsafe direction and is under-ranked**: `round1(delivered) < round1(required)` can round delivered UP and required DOWN, silencing a genuine shortfall of up to ~0.1 ft — and when it does fire, `COVER_UNDER_THREAT` is a mere `advisory`, a tier below planning-realism `warning`s. | `src/engine/validate.ts:88`, `src/engine/codes.ts:76-80` |
| C13 | S1 | **`stringerSizeForSpan` is first-fit over an array whose ascending order nothing enforces after a doctrine import** — a filler entering the three `maxSpan` values out of order gets a silently undersized stringer on the safety-critical span path (import validates only type and `0 ≤ v < 1000`). The same gap applies to threat-severity monotonicity of `shielding`/`standoffMin`, and to `stages.excavationSplit` needing to sum to 1. | `src/doctrine/protection.ts:196-206`, `src/doctrine/io.ts:190-196` |
| C14 | S1 | **Labor doctrine is snapshotted at module load while `stages.ts` reads it live** — after a doctrine import, `compute` uses the old adders and `excavationLabor` subtracts the new ones, which can drive per-stage man-hours **negative** and the stage clock non-monotonic. The one frozen read in an otherwise-live engine. | `src/engine/compute.ts:381-390` vs `src/engine/stages.ts:52-58` |
| C15 | S2 | **NaN inputs produce falsely optimistic schedules**: `securityPostureFrac: NaN` → `round1(NaN) = 0` → `totalElapsedHours: 0, feasible: true`; `teamSize` in `stages.ts` has no upper clamp (diverging from `compute`'s `[1,50]`); `mission.ts` propagates NaN into the rollup. `finite()` exists and is used only in `compute`/`plan`. | `src/engine/stages.ts:119-120`, `src/engine/mission.ts:58-59`, `src/engine/round.ts:16,32` |

### 1.3 Rules that mis-bill the BOM / labor sheet

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| C16 | S2 | Circular positions skip `circleFactor` on `coverVol` and `camoArea` — the exact ~27% square-for-circle overestimate the π/4 correction was written to fix, on the one position class it was written for (a mortar pit can take an earth roof). | `src/engine/compute.ts:236,280` vs `:195,197` |
| C17 | S2 | `digFactor` is documented as an *excavation* multiplier but multiplies only the flat 4.0 base — on a bunker-sized dig, frozen ground (×3.5) moves total labor ~22%, while the labor line prints "dig ×3.5". | `src/engine/compute.ts:292-294`, `src/doctrine/soils.ts:25`, `src/engine/labor.ts:11` |
| C18 | S2 | Spoil balance compares **loose** spoil against **in-place** fill with no compaction factor — `SPOIL_SHORT` under-fires, the unsafe direction for a "plan to haul fill" warning. | `src/engine/compute.ts:286-288` |
| C19 | S2 | `sump.gravelFt3` (1.0 ft³) exactly equals the sump's own volume — the BOM digs a grenade sump and bills enough gravel to fill it back in solid. The one feature whose purpose is empty space is specified as solid. | `src/doctrine/materials.ts:79-82`, `src/engine/compute.ts:225-227` |
| C20 | S2 | `inverted_t` / `l_shape` positions use rectangle perimeter for revetment area — under-bills every T/L position's facing, and the fidelity statement never mentions it. | `src/engine/compute.ts:274-275,395-399` |
| C21 | S2 | `plan.ts` ranks an `engineered_required` "cover: yes" option **above** its identical honest "cover: no" twin (same score, same labor, tie-break prefers cover-true) — the top-ranked plan claims overhead cover for a roof the engine refuses to size. Sweep also omits two of the five UI revetments. | `src/engine/plan.ts:39,50,75` |
| C22 | S2 | Picket spacing falls back to the **roof stringer spacing** leaf — an unrelated physical quantity — in both the math and the derivation trace. Latent today; live the moment a picket revetment row lacks `spacing`. | `src/engine/compute.ts:277`, `src/engine/explain.ts:243` |
| C23 | S2 | `rearOverhang` (a structural bearing dimension) is derived from `setbackDepthFrac` (a safety-critical *standoff* leaf) — the code's own comment says the rear has "no aperture-clearance concern, just a bearing one," then uses the aperture leaf. Filling it correctly for one purpose breaks the other. `docs/ONE_MAN_POSITION_MODELING_SPEC.md:312` explicitly warns against this exact reuse. | `src/engine/geometry.ts:203-207` |
| C24 | S2 | `excavationSplit.security` (stake sectors / post security) is charged as a fraction of **dig** labor, so it shrinks 60% with machine assist and grows 3.5× in frozen ground — the one stage that should be soil- and equipment-invariant. | `src/doctrine/stages.ts:37`, `src/engine/stages.ts:76` |
| C25 | S2 | `retainingWall.maxHeight` (5.0) is below three catalog positions' *default* depth (bunker 6.5, trench 5.5, turret defilade 6.0) and the check is soil-blind — three of ten positions warn on their own defaults, including a dozed vehicle cut with no retaining wall. | `src/doctrine/protection.ts:210`, `src/engine/validate.ts:45-47` |
| C26 | S3 | Dead or contradictory doctrine: 4 leaves registered with **no consumer** (one SC: `retainingWall.thickness` — `safetyCriticalRemaining` can't honestly reach zero); `storageCompartment: true` on five positions with zero effect; `connecting_trench` labeled "crawl" at a 5.5-ft standing depth; `coverMaterial` non-monotone (81mm bills ~157 sandbags, 120mm bills loose fill) with no note; `DRAINAGE_WET_SOIL` ignores the sump toggle so its own remedy can't clear it; `HEAVY_SOILS`/`WET_SOILS` are doctrine-domain judgments hard-coded as string sets in the engine. | `src/doctrine/protection.ts:187-188,211`, `src/doctrine/materials.ts:83`, `src/doctrine/positions.ts:36,174-183`, `src/doctrine/protection.ts:71-83`, `src/engine/validate.ts:13-14,63-65` |

---

## 2. Pass 2 — Accuracy & sourcing

### 2.1 SAP-1 side (placeholder regime)

The regime's mechanics are sound and test-enforced (registry walk, freeze-structure/
mutable-leaf, all-or-nothing validated import, fill manifest, zero `DOCTRINE` in
source — all verified live). The defects are at its edges:

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| A1 | S1 | **Source comments claim primary-source verification and quote pub paragraphs on leaves that ship as `PLACEHOLDER`** — "all primary-source verified" (soils), ATP 3-21.8 §5-238 quoted for `frontWallHeight`/`basicLoad`, §5-240 for parapet mode. PLACEHOLDER_POLICY.md:15 promises the codebase "transcribes no real doctrinal number." A filler cannot tell verified-in-comment from illustrative, and the regime's central promise is contradicted in-tree. Either these values are transcribed doctrine (then the policy text and their status are wrong) or they are not (then the comments overclaim). Pick one, consistently. | `src/doctrine/soils.ts:6-11`, `src/doctrine/materials.ts:22-29`, `src/doctrine/positions.ts:42-54` |
| A2 | S1 | **The fill checklist covers 275 of 295 registered leaves.** 20 leaves have no fill row — including two safety-critical ones (`protection.berm.W`, `weapons.backblast.clearanceFt`). A qualified user who works every row to completion lands at 275/295 believing they're done, and the banner logic never clears. Three whole families (`stages`, `vehicle`, `weapons`) have no section at all. Live counts: **295 total / 189 SC** (DECISIONS D29/D30 claim 279/188 — stale). | `DOCTRINE_SOURCES.md`, `src/doctrine/protection.ts:176-177`, `src/doctrine/positions.ts:67,174-208`, `src/doctrine/materials.ts:26-29`, `src/doctrine/labor.ts:9`, `DECISIONS.md:316,328` |
| A3 | S2 | **10 checklist rows are stale** — `one_man` L/W still pre-swap, all 8 `wallSlopeRatio` rows carry pre-correction values (e.g. sand 1.0 vs live 1.48, rock 0.1 vs live 0) — pointing a filler at the wrong leaf-in-source. | `DOCTRINE_SOURCES.md:211-212,252-274` |
| A4 | S2 | **153 SC shielding leaves are derived from two unregistered bare-number tables** (`ThreatDef.base` ×17, `materialFactor` ×9). Fill `shielding.<threat>.soil` and the other eight materials stay governed by a hard-coded factor the sanctioned import can't touch. Also `buildShielding` rounds a safety thickness to nearest 0.01 ft (can round **down**). | `src/doctrine/protection.ts:71-117` |
| A5 | S2 | SC tagging inconsistent: `parapet.H`, `berm.H`, `overhead.bearingEachEnd` (the roof's bearing-shelf requirement — a collapse mode), `vehicleRamp.slopeRatio` untagged while their siblings are tagged — `safetyCriticalRemaining` under-reports the life-safety set. | `src/doctrine/protection.ts:169,177,185`, `src/doctrine/positions.ts:67` |
| A6 | S3 | **PLACEHOLDER_POLICY.md describes a banner that does not exist** (`fieldUseBanner()` appears nowhere; no topbar badge; "NOT FOR FIELD USE" exists only in code comments; the live disclosure is the Status panel + job-sheet footer, and `test/trust.test.ts` actively asserts the drawing carries *no* disclaimer). It also describes **partial** import application when `io.ts` is all-or-nothing, omits three live validation rules (magnitude bound, DOCTRINE-with-TODO rejection, all-or-nothing), and credits `test/schema-import.test.ts` with doctrine-io coverage that actually lives in `test/doctrine-io.test.ts`. | `PLACEHOLDER_POLICY.md:72,129-134,153`, `src/doctrine/io.ts:194-235`, `test/trust.test.ts:116-122` |
| A7 | S3 | Further doc drift: README Phase-2 status in future tense though it shipped; USER_GUIDE navigation predates the menu redesign throughout and contradicts the parapet-mode model ("always sandbags" vs earth/sandbag/berm); D9's claimed RoofPath lockstep test doesn't exist; nothing anywhere guards the checklist or policy docs against code drift — which is the root cause of A2/A3/A6. | `README.md:56`, `USER_GUIDE.md:40-227,134`, `DECISIONS.md:65-67` |

### 2.2 Timber side (real citations in scope)

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| T1 | S1 | **The "all 28 emitted schedules have a cited home" guarantee covers only the frozen legacy path.** The shipped app generates via `generateStructure`; against the live family table, **59 distinct schedules on 1,797 member instances have no cited home**, and the bidirectional test only walks `generateFrame`. Part of the gap is cosmetic drift (register `ea` vs emitted `each` for the same joint). | `src/timber/doctrine.ts:456,490-518`, `test/timber2-doctrine.test.ts:193-217` |
| T2 | S1 | **Header sizer and span checker disagree on "span"** — sized from clear width, checked against cut length (width + 2 bearings), so openings of exactly 5 / 7 / 8.5 / 10 ft emit a false *"LIFE-SAFETY, review required"* warning against the header the tool itself just chose. The cry-wolf failure `spans.ts` says it exists to prevent. | `src/timber/families/building.ts:79`, `src/timber/walls.ts:167`, `src/timber/spans.ts:119-121` |
| T3 | S1 | **Collar ties violate their own citation at 24-in rafter spacing**: "every 3rd rafter" hard-coded → 6.0-ft tie spacing where the member's own text says ≤5 ft and its cited IRC R802.3.1 says 4 ft. The doctrine entry stating the rule (`collarTieEveryNthRafter`) is read by no code. | `src/timber/roof.ts:201-205`, `src/timber/doctrine.ts:81` |
| T4 | S1 | **Bird's mouth has no seat-depth limit** though the module cites the 1/3 rule as its own justification — at legal 12/12 pitch the notch eats 45% of a 2x6 rafter with no warning. Only a notch through the whole board is rejected. | `src/timber/birdsMouth.ts:53,153` |
| T5 | S2 | **6x8 and 8x8 dressed sizes use the dimension-lumber deduction instead of the timber deduction** (should be 7.5 in faces, not 7.25) — contradicts the cited FM 5-426 Table 2-1 on exactly the sizes the LS-tagged bunker cribbing and stringer tables use. All other rows correct. | `src/timber/types.ts:73,93-94` |
| T6 | S2 | Sourcing overclaims: `RAIL.requiredAboveFt: 2.5 ft` attributed to EM 385-1-1, which has no such threshold (recognized figures are 4/6 ft; errs conservative); corrugated side-lap 3.25 in presented as FM 5-426 but is an in-repo derivation (26/12-in pitch; standard is 2.5-in pitch → 3.75-in lap); the SPAN tables' 24-in column is a uniform `(16/24)^(1/3)` scaling of the 16-in column — a model's output labeled a lookup (honestly PH-flagged, but the page-check should know it's verifying two half-tables). | `src/timber/doctrine.ts:174,327,406-445` |
| T7 | S2 | Coverage holes: hip/jack/bent rafters never span-checked (a hip roof's longest members); roll roofing courses on the 6-in end lap instead of the 2-in top lap (~13% over-order, and in-course butt joints modeled lap-free); no corrugated minimum-slope rule while flat+corrugated is a legal catalog combination; sheathing field nails hardcode 16-in supports (disclosed, but ~50% over-count at 24 o.c.). | `src/timber/spans.ts:105`, `src/timber/subsystems/coverings.ts:819-830`, `src/timber/catalog.ts:115-119`, `src/timber/fasteners.ts:76` |
| T8 | S3 | Citation gate is `cite.length > 8` — it cannot distinguish the four genuinely locatable citations (IRC section/table numbers) from the topic-phrase tier every LS number sits in. Several doctrine entries are defined+cited but read by no code (incl. `LAYOUT.studSpacingIn` — the 16-in default lives as literals in `spec.ts`/`catalog.ts`; and `OPENING.heightFt` corrected to 6.667 while `catalog.ts` still ships 6.7 three times, the exact drift the correction note warned about). A handful of tests assert doctrine literals against test literals (circular). | `test/timber2-doctrine.test.ts:27,52,175-182`, `src/timber/doctrine.ts:74-81,199-208`, `src/timber/catalog.ts:66,91-92,189`, `src/timber/spec.ts:251` |

---

## 3. What was checked and found sound

- **Threat/material monotonicity**: shielding base strictly increasing across all 11 ballistic/indirect threats; `standoffMin` monotone; material factors ordered steel < concrete < sandbagged < clay < soil/gravel < sand < timber < snow_ice; `radiationHalving` reproduces the same material ratios (the two SC tables tell one story).
- **Standards** monotone hasty < deliberate < reinforced on all three axes, deliberate ≡ 1.0.
- **The §2.7 engineered-roof fail-safe is airtight on the threat axis** end-to-end: zero thickness → no stringers → no cover BOM → no overhead labor → explicit zero in the trace, locked by tests at every layer.
- **Multipliers applied exactly once** (`depthMul`, `coverMul`, `machineFactor`, `swellFactor`); blade-hours on their own axis; volume formulas (rect, π/4 circular, ramp wedge) dimensionally correct.
- **Rounding directions safe for materials** (`ceilInt` up on every count; no safety magnitude rounded in the engine — the one exception is C12).
- **Determinism**: no clock/RNG/I-O in the engine; stable sorts and total orders everywhere ranked output exists.
- **Registry/import mechanics**: freeze-structure/mutable-leaf works as designed; all-or-nothing import with magnitude bound, DOCTRINE-with-TODO rejection, prototype-pollution and version guards; dry-run predicts post-apply counts; persisted fills re-validated on boot. Zero orphan checklist rows (every documented path resolves to a live leaf).
- **Validation**: all 20 codes reachable and fire from doctrine-leaf thresholds, not literals; errors→warnings→advisories ordering stable; clamp advisories fire only on genuine clamps.
- **Timber**: all dimension-lumber dressed sizes correct (except the two timber rows, T5); BF rates re-derived non-circularly; double plates/headers/jack-bearing arithmetic closes; span tables monotone with conservative column selection; rafter span measured on the true horizontal run (pitch-invariant, verified algebraically); bridging-rise quadratic verified numerically; anchor-bolt/cap-plate/sheathing schedules match their cited IRC sections exactly; nails-per-pound match published counts; stair/ladder/guardrail life-safety figures are the recognized ones; span extrapolation refuses past reviewed bounds.

---

## 4. Priority fix list

1. **Fail-safe hardening (C10, C11, C12, C13)** — make the missing-shielding-leaf branch resolve to `engineered_required`, make `clearSpanFt` required, compare cover thickness unrounded (or floor/ceil conservatively) and promote `COVER_UNDER_THREAT` to `warning`, validate `spanSizes` ordering / shielding monotonicity / `excavationSplit` sum on import.
2. **Rule↔rendering contract (C1, C2, C3, C7)** — decide `depthBelowHole`'s one meaning, define a signed `setback` convention in `GeometryModel` and make BOM + both views consume it, fix or clamp `fifty_cal` in the table (not the renderer), move every physical constant out of the renderers into doctrine/geometry (firing step, sump, stringer size, mortar batter, T/L proportions), and add a cross-view geometric sweep (positions × threats) so 2D, 3D, and BOM can't diverge silently again.
3. **Doctrine-import lifecycle (C14, C15)** — read labor doctrine live in `compute`; guard `stages`/`mission` inputs with `finite()` + the `[1,50]` clamp.
4. **Placeholder-regime consistency (A1, A2, A3, A5)** — reconcile the verified-comment vs placeholder-status contradiction, regenerate `DOCTRINE_SOURCES.md` from the live registry (mechanically — the registry is machine-readable; add a test that diffs them), fix SC tags.
5. **Timber citation reach (T1, T2, T3, T4, T5)** — point the bidirectional schedule test at `generateStructure`, reconcile `ea`/`each`, fix header span-vs-cut-length, key collar ties on spacing, add the 1/3 seat-depth guard, correct the two timber dressed sizes.
6. **Docs (A6, A7, T8)** — bring PLACEHOLDER_POLICY/README/USER_GUIDE in line with shipped behavior; upgrade the citation gate beyond string length.

## 5. Why the 941-test suite is green anyway

The gates are real but scoped: the number-free scan covers 9 engine modules but not
`engine/protection.ts` (the cover authority), matches decimals only (integers like
`±45°` pass), and allowlists `0.5` globally; the timber schedule test walks only the
legacy generator; the strong cross-view geometry tests run on hand-picked fixtures
while the broad sweeps assert only finiteness/token-validity; and no test reads
`DOCTRINE_SOURCES.md` or `PLACEHOLDER_POLICY.md` at all — the registry is
machine-readable and simply never diffed against its own checklist.
