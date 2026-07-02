# SAP-1 Execution Plan (v2 — 2026-07-01)

Synthesized from a 20-agent planning pass: 7 subsystem maps, 6 persona gap analyses
(squad leader, engineer NCO, instructor, visual designer, data steward, adoption red-team),
3 competing plans (field-first / completeness-first / visual-first), 3 judges, 1 completeness critic.
All three judges ranked **field-first** #1; this plan is that spine with the best organs of the
other two grafted on and the critic's omissions patched.

**Sequencing logic in one line:** land the in-flight work and stop contradicting yourself (0),
survive expert scrutiny (1), make the banner clearable (2), make the printout the document (3),
answer the actual field question (4), then make the picture teach (5), then widen the catalog (6).

**Every item preserves the 5 invariants.** Two items *extend* them:
roof-span overrun fails toward "ENGINEERED ROOF — SEE ENGINEER" (extends invariant 4), and
formula-fidelity flags extend placeholder honesty from constants to formulas (extends invariant 3).
DTGs/dates are always **inputs**, never clock reads (note: `main.ts:323` currently reads `new Date()` in the UI shell — keep clock use out of the engine).

---

## Phase 0 — Land in-flight work + stop lying to the user (1 sprint, all S)

The tool currently contradicts itself on its flagship number and silently eats user work,
and the GLB work is rotting uncommitted while later phases churn nearby code.

1. **Commit the GLB prop work** (`src/assets/`, `asset-types.d.ts`, `three-viewer.ts`) with a
   DECISIONS.md **D28** entry; add a node test that the procedural fallback fires on simulated
   GLB load failure (factor the fallback branch to a pure-testable seam).
2. **Fix GLB proportion bug** — bags scale uniformly from the authored 10×15×5 proportion and
   the tile count adjusts; never stretch a bag to the cell (`three-viewer.ts` wall builders).
3. **Depth-of-cut contradiction** — `panels.ts:42` shows raw `holeD` while section/trace show
   `calc.depthOfCut`. Display `depthOfCut`; add `(PH)` flags to every placeholder-derived specs row.
4. **Both scenario round-trips** — `parseImport` accepts arrays; toolbar export emits a valid
   Scenario with id/name. Round-trip test.
5. **Print fallback** — popup-blocked `window.open` downloads the job-sheet HTML blob with a
   visible message; confirmation toast on all exports.
6. **Session persistence** — inputs, mission set, compare set, on-hand → localStorage,
   re-validated through existing `schema.ts` on load. Tab eviction no longer wipes the plan.
7. **Trust furniture** — undo/redo disabled states, scenario-delete confirm, wire the existing
   `duplicateScenario`, surface IndexedDB failures via `lastError`.
8. **Real scenario name on the job sheet** — kill the hardcoded "Working position" (`main.ts:323`).
9. **A11y floor** (critic add) — move `aria-live` off the full-re-render region to a summary
   region; preserve focus/scroll across re-renders. Minimal patch, not a framework rework.
10. **Doc-truth pass** — DOCTRINE_SOURCES.md 81→153 shielding leaves; `a11y.ts:46` disclaimer
    data-driven; soften README's banner-unlock-test claim until Phase 2 makes it true.

**Acceptance:** specs-panel value equals trace result across the position×standard matrix;
export→import round-trip (array + single); session-restore via MemoryAdapter; fallback-fires
test; `npm run verify` green. Manual: block popups, tap Print, get a file.

---

## Phase 1 — Numbers an NCO can't falsify (1–2 sprints)

Formula honesty comes **before** the doctrine unlock — all three judges ruled that an
attributable DOCTRINE fill stamped onto structurally wrong math is worse than a placeholder.
Placeholder data excuses wrong constants, never wrong structure.

1. **Stringer axis + span fail-safe** (M) — count `ceil(frontage/spacing)+1` spanning the short
   axis; wire dead `stringerSizeForSpan`/`spanSizes` into the BOM label; new `ROOF_SPAN_EXCEEDED`
   resolves toward "ENGINEERED ROOF — SEE ENGINEER" through the single authority in
   `resolveCover` — an invariant extension, not a mere warning.
2. **Vehicle defilade rebuild** (L) — ramp-cut volume in the excavation chain; **spoil berm**
   replaces the ~450-sandbag parapet in BOM and scene; machine-assist-required validation;
   **blade-hours** (not man-hours) framing via new placeholder-wrapped productivity leaves.
3. **Mortar pit π/4** (S) — circular shapes volume as circles (removes a 27% dig overestimate).
4. **Revetment BOM completeness** (S) — panel revetments emit sheet lines from `faceArea`; wire
   quantified from dead `wirePerPicket`. Labor is never charged without materials.
5. **Cover priced as soil** (S) when `coverMaterial === 'soil'` (bags only for the retaining ring).
6. **Shoring/excavation safety** (S) — cut depth vs dead `retainingWall.maxHeight` fires a
   warning (kills the silent 8.1-ft bunker cut); wet-soil drainage advisory for silt/clay;
   advisory when overhead cover is requested with threat "none" instead of the silent drop.
7. **Spoil balance** (S, critic add) — bank-yield vs parapet/berm fill demand; excess-haul warning.
8. **Trace completeness** (M) — derivations for the 5 untraced BOM kinds (cover bags, revet bags,
   pickets, sump gravel, camo net); itemize labor adders as operands (`explain.ts:143`); every
   tappable number survives the tap.
9. **Formula-fidelity provenance** (S) — each position declares its volume/parapet model
   `doctrinal | approximate | not_modeled`, surfaced in specs panel and job sheet. Add a
   **labor-fidelity flag** too (critic add): `baseMH = 4.0` flat across all 8 positions is
   wrong-in-kind and must say so until labor doctrine arrives.
10. **SME checkpoint** (process, critic add) — before any newly invented model (ramp geometry,
    berm, spoil balance) ships as "honest," log an expert eyeball pass in DECISIONS.md. New
    formulas are the exact failure mode this phase exists to fix; don't self-certify.

**Acceptance:** validation-code reachability for all new codes; engine-formula tests re-derive
ramp and circular volumes independently; protection test asserts span-exceeded →
`engineered_required` with zero thickness; explain-matches-display covers all 9 BOM kinds;
snapshot regenerated once with a D-entry documenting why.

---

## Phase 2 — The doctrine unlock (1–2 sprints)

The core product promise — placeholders until a qualified user imports real values — is dead
code today; the banner is structurally permanent. The battalion cell does this once and
distributes: the UI is spartan, the validation paranoid.

1. **Harden `io.ts`** (M) — finite values within the 0≤v<1000 doctrine-integrity bound; reject
   `status: DOCTRINE` with a TODO source; preserve `unit`/`safetyCritical`/`note`; `dryRun`
   mode; **all-or-nothing apply** with `ok: false` on any rejection.
2. **Wire Export/Import doctrine into the Tools menu** (S) — reuse scenario blob/file-picker
   patterns; render the import report (applied/rejected/reasons/new counts) in the existing
   overlay; dry-run preview before apply.
3. **Persist applied doctrine to IndexedDB** (M) — re-validate and re-apply on boot. An import
   survives reload, per device, forever.
4. **Fill manifest** (S) — content hash, author, date carried by export/import; Status panel and
   job sheet footer print "doctrine fill \<hash\>, imported \<date\>". A DOCTRINE stamp becomes
   attributable evidence.
5. **Fill/scenario coupling** (S, critic add) — scenarios and exported files record the fill hash
   they were computed under; on load under a different/absent fill, show a visible mismatch note.
   No silent different-numbers-on-another-device.
6. **Minimal fill table, not a workbench** (M) — one overlay over `registry.all()`: leaves grouped
   by table, safety-critical filter, inline value/source edit, per-category remaining counts,
   badge shows the live count ("NOT FOR FIELD USE — N practice values remain"). No diff viewer,
   no sign-off workflow — the manifest covers audit.
7. **Banner re-lock semantics** (S, critic add) — later phases add new placeholder leaves (ramp,
   blade-hours, stage fractions). Define it now: badge distinguishes "N **new** values since your
   fill \<hash\>" from a never-filled state; import reconciles renamed/removed/added paths via
   the existing version field.
8. **Retire verification make-work** (S) — deregister dead leaves (radiationHalving,
   sheathing/dustproof) from the banner count until a feature consumes them; keep data in source.
   Never force an officer to verify a value that changes nothing. Integrity test: **zero
   registered leaves without a consumer.**
9. **Regenerate DOCTRINE_SOURCES.md from `registry.all()`** (S) via script so the checklist
   cannot drift.

**Acceptance:** scripted end-to-end banner-clear test — fixture pack drives every placeholder
leaf to DOCTRINE, `counts()` reaches zero, the badge string disappears (this is the test README
already claims). Rejection-path tests (NaN, negative, TODO-source, partial file → zero applied).
Persistence test (import → simulated reload → counts hold). Offline gate still green.

---

## Phase 3 — The printout replaces the paper (1–2 sprints)

The competition is a DA 5517 and a notebook. The printed sheet must be the document the
platoon already owes the company.

1. **Job sheet field header** (M) — editable grid, unit, azimuth of fire, DTG (user-entered;
   engine stays clock-free); inspection checklist derived from position features; build-sequence
   block per position family from the modeling spec §3, placeholder-flagged.
2. **Range-card layer on the plan** (M) — north arrow; sector wedge labeled in degrees **and**
   mils (data already in `inputs.sectorAzimuths`); max-engagement arc; FPL/PDF line for MG
   positions; blank TRP table for pencil fill; scale bar. No terrain modeling — the tool frames
   the card, the NCO fills the ground truth. **Plain-language-first labels for the new jargon**
   ("final protective line (FPL)") per invariant 5, and confirm the number-free gate tolerates
   azimuth-labeled drawings before merging.
3. **Fit-to-content projector** (M) — plan/section auto-zoom so a one-man hole fills the canvas;
   testable "content occupies ≥60% of drawing viewport" assertion; callout de-collision pass;
   render the already-computed parapet/outer dims; draw revetment + camo in 2D so paper agrees
   with the 3D scene.
4. **Drawing export** (S) — SVG download per view (the renderer is already string-SVG).
5. **Scenario save UX** (S, critic add) — replace `window.prompt`/`alert` flows with the existing
   overlay pattern.
6. **Compare-across-standards preset** (S, critic add) — one-click hasty/deliberate/reinforced
   compare set; near-free and it is the canonical lesson.
7. **CUI: one documented decision** (S) — de-designate the empty-shell tool with rationale, or
   add compliant marking blocks to the job sheet. Halfway is the worst state.
8. **Mobile/narrow hardening** (S) — force single column below 640px regardless of pointer;
   condense topbar (never 3 rows); fix summary-bar sticky offset. Gloved-hands reality.

**Acceptance:** render-intuitive tests extended (azimuth labels present + non-colliding across
the position matrix, north arrow, scale bar, ≥60% occupancy); job-sheet snapshot includes header
+ checklist; number-free gate green; manual print check at 375px, day + night themes.

---

## Phase 4 — "Ready by stand-to" (2 sprints) — the big bet

The field question is never "how many bags" — it is "who does what now, and are we ready by
stand-to." No competing product answers it. Pure-engine module.

1. **Stage decomposition engine** (L) — decompose each position into doctrinal stages
   (security/stake sectors → hasty scrape → dig to standard → sump/revet → parapet front-first →
   OHC → camo continuous) with per-stage BOM and man-hour splits. Stage fractions are Provenance
   placeholders like everything else. Pure `(calc, stages) → StagePlan`.
2. **Schedule arithmetic** (M) — inputs: team size, start DTG, stand-to DTG, security posture
   (% digging vs watch), machine assist. Output: per-stage clock times, "at H+2 / H+8 you have X",
   shortfall warning when stand-to is unreachable. Deterministic — DTGs are inputs.
3. **Job sheet page 2** (M) — the priorities-of-work schedule as a task table a fire team leader
   can execute; mission-mode aggregation across the squad's positions.
4. **Stage selector drives the 2D section/plan** (M) — dashed not-yet-built elements: "this is
   hasty, this is end state."

**Acceptance:** byte-identical StagePlan determinism test; **per-stage BOM/labor sums exactly
equal existing totals** (invariant test); property test (halving diggers ≥ doubles elapsed);
page-2 snapshot; fuzz over posture/team/DTG yields finite, ordered stage times.

---

## Phase 5 — 3D that teaches instead of decorates (ongoing, capped)

One position gets the hero treatment — it is the teaching flagship. The other seven keep the
schematic level plus their Phase-1 fidelity label.

1. **Honesty parity** (S) — data-driven NOT-FOR-FIELD-USE badge + "props illustrative" note on
   the 3D card; theme-aware canvas colors from CSS custom properties (night mode is currently
   defeated by a daylight scene), asserted in scene3d tests; remove the one-man firing step the
   spec forbids (§2.f).
2. **`buildScene3D(result, stage)`** (M) — reuse Phase 4's StagePlan so 3D shows construction
   stages; keyboard-accessible scrubber. **First-run onboarding = the scrubber animating once**
   through the stages (localStorage-flagged, skippable) — the product demos itself with zero new
   UI surface.
3. **One-man hero model per the modeling spec** (L) — header/stretcher bond with stepped batter
   at true bag proportion (tile, never stretch); full OHC stack (supports/stringers/dustproof/
   burst cap/waterproof); elbow shelf, sector/aiming stakes, e-tool sumps, floor slope; §4
   quarantined values render with placeholder notes. **InstancedMesh** for bag courses with a
   perf-budget test. **Cutaway toggle** as a pure descriptor flag + viewer clipping planes.
   **In-scene dimension leaders** carrying `(PH)` flags — Part3 gains a placeholder flag so 3D
   has the same honesty markings as 2D. **Posed human figure** at armpit depth — the fastest
   comprehension cue there is. Fix the D27 ground-hole illusion with real ring-with-hole geometry.
4. **"What to bring the engineer" block** (S) — engineered-roof case prints spans and standoff
   achieved on the job sheet, so the fail-safe hands off usefully instead of dead-ending.

**Acceptance:** scene3d tests for stage states, one-man part inventory (no firing step, correct
stringer/support counts), bond stagger, placeholder flags on 3D dims; perf budget on the
instanced build; engineered-roof fuzz unchanged (cutaway/dimensions never fabricate cover
geometry); manual night-theme screenshot.

---

## Phase 6 — Catalog completeness (doctrine-gated, last)

Only after the burn-down path is real and the core models are honest does breadth pay.
Gate: Phase 2 shipped and at least one real doctrine fill exists.

- Connecting/crawl trench position type (M) — the existing prism chain fits.
- Protective wire module (M) — standoff ring on plan; concertina/picket/staple BOM.
- ATGM/Javelin position + backblast clearance validation (M) — new placeholder leaves.
- `radiationHalving` wired into a CBRN cover readout (S) — those 9 safety-critical leaves earn
  their verification, or stay deregistered.
- Squad battle-position sketch (L) — 2–9 positions with interlocking sector wedges over the
  existing mission aggregation; printable sector sketch.

**Acceptance:** doctrine-integrity extended — zero registered leaves without a consumer; new
positions pass the full fuzz/NaN/fail-safe matrix automatically (tests iterate the registry).

---

## Cross-cutting (small, continuous)

- **Sustainment:** publish the standalone build's SHA-256 in README per release; keep a
  changelog. Air-gapped devices need a way to verify what they got. (Process, not product.)
- **Snapshot discipline:** every snapshot regeneration ships with a DECISIONS.md entry saying why.
- **New-jargon rule:** every feature introducing doctrine terms (FPL, TRP, mils, DTG) ships
  plain-language-first labels and passes the number-free gate.

## What is CUT, and why

- **Quiz/practice engine, instructor courseware** — right audience, wrong product for now; the
  stage scrubber + explain traces deliver most of the teaching value. The deterministic engine
  keeps it cheap later; nothing here forecloses it.
- **Full Doctrine Workbench (diff viewer, sign-off workflow)** — the minimal fill table +
  manifest + dry-run gets a battalion cell to zero; polish only if real fills stall.
- **PDF/DXF export, URL/QR sharing, i18n** — print + SVG + JSON files cover offline field needs;
  each of these is a dependency or distribution problem, not a digging problem.
- **Full equipment-productivity tables (SEE/HMEE/dozer curves)** — Phase 1 ships machine-required
  validation + blade-hour framing; full modeling waits for doctrine data that doesn't exist yet.
- **Terrain/dead-space modeling, map integration** — explodes scope; the range card honestly
  leaves terrain-dependent fields for pencil completion.
- **High-fidelity 3D for all 8 positions** — one-man only; a bonded-bag mortar pit doesn't beat
  a stand-to schedule.
- **UI framework / partial-DOM rework** — full re-render stays; Phase 0.9 and 3.8 fix the
  field-visible symptoms only.
- **Night/MOPP labor degradation factors** — real, but they multiply an already-placeholder base;
  the labor-fidelity flag (Phase 1.9) is the honest interim.

## Judge record

field-first ranked #1 by all three judges (9 / 8.5 / 8.5) over complete-doctrine (7.5 / 8 / 8)
and visual-clarity (6 / 6.5 / 7). Unanimous grafts applied here: complete-doctrine's Phase-0
land-the-worktree discipline and hardened-importer keystone; visual-clarity's fit-to-content,
cutaway/human-figure/InstancedMesh/in-scene-(PH) kit and scrubber-as-onboarding. Unanimous
sequencing ruling: formula honesty **before** doctrine unlock.
