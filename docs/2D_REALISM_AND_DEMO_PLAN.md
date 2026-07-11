# 2D Drawings Realism + Demo-Readiness — Plan (audited 2026-07-11, Fable)

> Full audit of the 2D drawing pipeline (plan / section / iso / job sheet) against doctrine data
> already in `src/doctrine/`, real engineer-drawing conventions, and the 3D scene's fidelity —
> plus a UI/UX pass for demo readiness. Every drawing finding was confirmed against live renders
> (Playwright element-screenshots of the SVGs across 7 position types, plus a captured job sheet).
> **Plan only — no code changed yet.** Screenshots: `.playwright-mcp/2d-audit/` (untracked).

## How the audit was produced / how to re-verify

- Dev server: launch entry **`plan2d`** (port 5361), already added to `.claude/launch.json`.
- Drive with Playwright MCP at `http://localhost:5361/index.html?cb=<ts>` (fresh navigate after
  edits — see project memory re stale HMR). Set inputs via
  `document.querySelector('select[data-field="positionType"]').value = 'mg_crew'; el.dispatchEvent(new Event('change',{bubbles:true}))`;
  checkboxes via `.click()`.
- Screenshot the SVGs directly: `page.locator('.drawings-region svg').nth(0|1).screenshot(...)`
  (nth 0 = plan, nth 1 = section). Note: the **fixed bottom toolbar overlays the lower ~90px** of
  the viewport — element shots may show it covering the section legend (that itself is finding X3).
- Job sheet without a print dialog: stub `window.open` to a fake `{document:{write}}`, JS-click
  `[data-action="print"]`, then `document.write` the captured HTML into the tab and screenshot.
- Architecture (from code audit): 2D renderers consume only `result.geometry` (GeometryModel from
  `src/engine/geometry.ts`) + units/cover. The 3D scene consumes the **same** GeometryModel but
  additionally reads `soils.wallSlopeRatio`, `revetments`, `positions`, `sandbag` — that delta is
  exactly why 3D looks real and 2D doesn't.
- After the pass: `npm run verify` (typecheck + tests + offline gate) must stay green.

Audited: `one_man` (hasty), `mg_crew` (deliberate + OHC + sump + step + sandbag revetment),
`mortar_pit`, `vehicle_hull_defilade`, `atgm_javelin`, `connecting_trench` (metric), + job sheet.

---

## Phase 0 — Demo-killers (small diffs, do first)

### X1. NOT-FOR-FIELD-USE / illustrative-data indicator is absent from the main screen
Docs promise a red banner "under every drawing's header" (`USER_GUIDE.md:15,110,130`,
`README.md:11-19`); the code computes `topbarHasFieldUseBadge` but deliberately no longer surfaces
it (`shell.ts:79-81`); `.fielduse-badge` renders only inside the Doctrine overlay
(`tools.ts:202-204`). A demo audience sees a confident, unlabeled planner — and anyone following
the guide sees docs that don't match. **Fix:** put a compact one-line badge in the drawing header
strip (chrome.ts already owns it) shown while placeholder doctrine remains, and update
USER_GUIDE/README to match whatever we ship. Pairs with U5 below.

### X2. Native `window.prompt/confirm/alert` for scenario save/delete/import (`main.ts:397,432,443`)
Browser-chrome popups mid-demo; `prompt()` silently no-ops in some embedded contexts (kills
"Save current…"). **Fix:** reuse the existing `#overlay` dialog for a name field / confirm /
error message. No new abstraction — it's already a modal system.

### X3. Fixed bottom toolbar covers the bottom of the content (section legend sits under it)
Confirmed live: section SVG bottom at y=1045, toolbar top at y=562 of a 617px viewport; at full
scroll the last content row still hides under the toolbar. **Fix:** `padding-bottom` on the main
scroll container equal to toolbar height (styles.css), one line.

### X4. Metric mode leaks imperial (job sheet + BOM + figure ref)
Confirmed live with `unit=metric`: BOM row "Spoil to move (loose) **257.81 ft³**" while every
spec is metric; section figure label stays **`ref ~5'-10"`** (chrome.ts:16,134-155). Also false
precision: 257.81 ft³ of dirt. **Fix:** route BOM volume + figure ref through `fmtVolume`/
`fmtLength`; round spoil to whole ft³ / 0.1 m³. Add a unit-consistency test.

### X5. Emoji glyph icons in the always-visible bottom toolbar (`shell.ts:140-152`)
`↶ ↷ ↺ 🌙 ☀️ ✎ ☰` render tofu/monochrome on some platforms and read as unfinished. **Fix:**
inline SVG icons (7 tiny paths), keep labels.

### X6. Dev-only surfaces in the user menu
"Screen size" layout picker (`shell.ts:88-103`) and the expert "Doctrine values" grid
(`tools.ts:146-222`) sit in the hamburger next to user features. **Fix:** gate both behind
`import.meta.env.DEV` or a `?dev` flag (keep Doctrine reachable from Status for provenance).

---

## Phase 1 — Ground the 2D drawings in reality (the meat)

The core defect is structural: **plan branches on shape only partially, section and iso not at
all** — section is always "symmetric rect pit + two identical parapets" (`drawSection.ts:66-71`),
iso is always a rectangular cuboid (`drawIso.ts`). Meanwhile the engine already computes the real
geometry (and 3D draws it). Work items, in execution order:

### R1. Vehicle positions: draw the ramp and the berm, drop the fake rear parapet
Evidence: `vehicle_hull_defilade` plan renders the same generic rect-in-ring as a one-man hole —
no access ramp, no vehicle outline; section shows a person (~5'-10" ref) standing in a
vehicle pit with symmetric front/rear "parapets". The engine computes `ramp_run`
(`geometry.ts:106-111`, `depth·slopeRatio`) and it is **never drawn in any 2D view**; the ramp is
the dominant excavation (`positions.ts:65-68`), and the 3D scene already draws ramp+pan.
**Fix (drawSection.ts / drawPlan.ts):** branch on `shape==='vehicle_ramp'` — section: grade →
sloped ramp line down to pan floor, front berm only (no rear parapet), dim `ramp_run` and pan
depth; replace the human figure with a simple hull-defilade vehicle silhouette (side profile,
turret above grade — it's the entire point of the position); plan: pan rectangle + flared ramp
trapezoid at the rear, berm at the front only, dim ramp run.

### R2. Parapet plan honesty: U-shaped/open-rear ranges per type, berm vs parapet naming
Evidence: every position draws a **full parapet ring** (`p.outerL/W` rect) with legend "Dirt wall
up front (parapet)". The 3D just got doctrinally-correct U-shaped parapets with closed/open rear
(commits 03e9c3b, d4bd62f); 2D contradicts both the 3D and its own legend text. Vehicle positions
carry `frontalName='Berm'` (`geometry.ts:86`) but the callout key is hardcoded `'parapet'`
(`svg.ts:60`). **Fix:** geometry already knows front; draw parapet as U (front + flanks) for
rifle/MG/ATGM positions, ring for mortar (correct today), berm-front-only for vehicles; add a
`berm` callout label variant. Keep legend generated from `used` set (that machinery is good).

### R3. Section per-shape profiles: mortar, trench, L/T positions
- Mortar: circular pit reads as generic rect section; no baseplate marker, and OHC can be toggled
  on over the whole pit (a sealed mortar pit is absurd — see R6).
- Trench: correct narrow/deep proportions (good) but arms of the figure clip through a 76cm
  trench; plan draws a **closed rectangle with ENEMY/FRONT ring** — connecting trenches are
  linear routes with zig-zag traverses (FM 5-103); at minimum drop the ring/ENEMY treatment and
  draw open ends; traverse zigzag only if we add a doctrine entry for traverse spacing
  (placeholder per PLACEHOLDER_POLICY — do not invent silently).
- L/T: ATGM plan draws the side arm **poking outside the parapet ring** (unwrapped white rect
  floating past the berm — visually broken); T/L arm sizes are invented fractions
  (`stemW=max(2, holeL*0.3)` etc., `drawPlan.ts:39-40,119,124`).
**Fix:** clamp/wrap arms inside the parapet envelope (or extend the parapet around them — match
what 3D does); move arm dimensions into doctrine tables as placeholders so they stop being
drawing-layer magic numbers.

### R4. Overhead cover: draw the real roof build-up; fix figure-through-roof
Evidence: with OHC on, the standing figure's head pokes **through the roof slab** in every
position (mg, mortar); slab is a single rect; stringer glyphs are 4×7px decorations "evenly
spaced, capped at 8" (`drawSection.ts:113-116`) while `calc.stringers` and doctrine
`stringerSpacing`/`bearingEachEnd`/`sheathingThickness`/`dustproofThickness` exist and are
ignored; the computed `stringerSize` label ("6×6") is never annotated. **Fix (drawSection.ts):**
draw stringers at real count/spacing bearing on the parapets per `setback`/`bearingEachEnd`,
sheathing + dustproof + earth-cover layers as distinct bands with a build-up callout; pose the
figure kneeling/crouched when standing headroom < figure height under the slab (one conditional,
big honesty win). Keep the ENGINEERED ROOF hazard block behavior (that honesty is policy).

### R5. Soil + revetment become visible in section
Evidence: walls are always vertical and hatch is one fixed 45° pattern (`chrome.ts:20-24`);
`soils.wallSlopeRatio` (3D uses it at `scene3d.ts:224`), `soils.faceLook`, and all of
`revetments.*` are unused in 2D; selected revetment draws nothing. Parapets are solid-filled
while the identical material (earth) is hatched below grade — inconsistent material convention,
and no existing-grade vs finished-grade distinction. **Fix:** batter the cut walls by
`wallSlopeRatio`; parapets get a spoil/fill hatch distinct from in-situ earth; per-soil hatch
variant (sand stipple / rock blocky / frozen — reuse `faceLook` buckets); when revetment ≠ none,
draw the facing line + picket ticks per `revetments.<id>.spacing` with a callout.

### R6. Stop inventing geometry the doctrine tables already define
- Sump notch: drawn `min(0.9, holeW*0.22) × 0.7ft` (`drawSection.ts:94-95`) — doctrine
  `sump.L/W/D = 1.0` (`materials.ts:79-81`) ignored; plan sump = fixed 3.5px circle.
- Firing platform (section): `holeW*0.35` (`drawSection.ts:80`) — doctrine `firingPlatform.L/W`
  ignored (plan uses the real values; the two views disagree).
- Platform callout: plan reuses the `firing_step` callout for the platform (`drawPlan.ts:137`) —
  MG's tripod platform gets badged "Step up to shoot (firing step)". Add a dedicated `platform`
  callout (registry `svg.ts:57-70`).
- Firing step has **no doctrine entry at all** (pure drawing artifact, DECISIONS D9): add
  placeholder dims to `materials.ts` per PLACEHOLDER_POLICY rather than keeping magic numbers.
- Feature-combination sanity: OHC over a mortar pit, firing step in a vehicle pit — if
  `validate.ts` doesn't already flag these, add advisories (drawings may still draw what's asked,
  but the app should say it's wrong).

### R7. Dimension what matters; drop what doesn't
Evidence: computed DimSpecs `parapet_w`, `outer_l`, `outer_w`, `ramp_run` are **never rendered**
(`geometry.ts:89-115`; grep render/ = zero). Parapet thickness is the single most
protection-relevant number on the sheet and appears only as table text. Mortar plan shows the
same 8'-0" diameter twice. Callout cluster 11/12/A piles up at the cut marker on every sectored
plan; "grazing-fire line (FPL)" label collides with the sector wedge (mg). **Fix:** add
parapet_w + overall envelope dims to plan, ramp_run to vehicle views (R1); dedupe redundant dims;
give dims real witness lines (project from feature edges with a gap — today they're 5px stubs,
`chrome.ts:82-83,102-103`); spread the top callout cluster; add direction-of-view arrows to the
A–A cut markers (`drawPlan.ts:193-199`).

### R8. Iso view: make it match the plan's shape, or retire it
Evidence: iso ignores `geo.shape` entirely — a mortar pit's iso is a square cuboid while its plan
is a circle; wall thickness hardcoded `z=-0.6` (`drawIso.ts:48`). It renders only as the
no-WebGL fallback (`shell.ts:158`). **Fix (cheapest honest):** extrude the plan footprint per
shape (circle → cylinder, T/L → prism union, vehicle → ramp wedge) reusing plan's branching; if
that exceeds ~a day, replace the fallback with plan+section side-by-side and delete drawIso —
a wrong drawing is worse than no drawing.

### R9. Tests to lock Phase 1 in (repo rule: features need tests)
Add to `test/render-intuitive.test.ts` (or a new `render-shape.test.ts`):
per-type shape assertions (vehicle section contains a ramp slope segment; mortar plan has no
rect bay; trench plan has no ENEMY wedge/ring; ATGM arm stays inside parapet bounds); drawn dim
values equal doctrine values (`positions/protection` round-trip); `parapet_w` present in plan
dims; unit-consistency (no `ft³`/`'`-`"` strings when `unit=metric`); figure pose flag under OHC.
Keep `fuzz`/`render-nan` green — the `guard()`-throws-on-NaN + one-projector architecture
(`svg.ts:11-14`, `project.ts`) is solid, don't disturb it.

---

## Phase 2 — Make the drawings more useful

### U1. Azimuth of fire → a real range-card plan view
Today: north arrow is fixed screen-up and decorative (`drawPlan.ts:178`) — "north" always equals
"enemy", which is never generally true; sector default ±45° hardcoded (`geometry.ts:131-132`);
job sheet leaves AZIMUTH OF FIRE as a blank line (good for hand-fill). **Add:** an optional
"azimuth of fire" input (mils or degrees); when set, rotate the north arrow accordingly, label
sector edges with true azimuths, print it on the job sheet header. Keeps blank-line hand-fill
when unset. This turns the plan view into an actual range-card companion.

### U2. Title block on exported SVGs
The standalone SVG downloads (`main.ts:699-706`) have no provenance at all — no position name,
standard, date, version, or caveat. **Add:** a compact bottom title-block strip (position ·
standard · soil · threat · date · APP_VERSION · illustrative-data caveat) rendered only in
export/job-sheet contexts (a `chrome.ts` option), not in the live panels.

### U3. Stage-aware section (ties 2D to the 3D scrubber)
The stage scrubber (0–6) drives only 3D; 2D always draws the finished state; the job sheet's
priorities-of-work is a text table. **Add (small version):** when the scrubber is not at final
stage, overlay the section with the current stage's dig profile (trace line at stage-1, partial
depth at stage-2, etc. — `computeStages` already models this for 3D) and grey the not-yet-built
parts. Plan/section stay printable as final; this is a live-view overlay only.

### U4. Safety annotations that already exist in the data
ATGM/Javelin `backblast.clearanceFt` (`positions.ts:207`) → draw the rear backblast danger cone
on the plan view with a hazard callout (this is *the* safety fact for that position). Surface
`calc.radHalvingLayers` and validation advisories (spoil short/excess, wet-soil) as job-sheet
notes under the drawings.

### U5. Per-dimension provenance: decide (PH) once, align code + docs
`DimSpec.placeholder` is computed (`geometry.ts:90-115`) and deliberately never shown
(`render-intuitive.test.ts:83,96` asserts absence), while USER_GUIDE.md:104,130,159,190 promises
(PH) tags. Either render a subtle per-dim marker (dagger/underline, tooltip "illustrative value")
or fix the docs. Recommendation: marker in live view + banner (X1) on print; the honesty story is
this app's differentiator.

---

## Phase 3 — Demo flow & polish (nice-to-have, post the above)

- **P1. Shareable URL state**: encode inputs in the query string (schema.ts already validates
  round-trips); "Copy link" in the menu. The #1 demo ask ("send me this position") is impossible
  today — sharing is file-export only.
- **P2. Demo presets row**: 3–4 one-click chips (Rifleman hasty / MG bunker + OHC / Mortar pit /
  Vehicle defilade) above the controls — a guided demo path that shows off type branching.
- **P3. 3D asset pop-in**: procedural placeholder → GLB swap is visible on cold load
  (`three-viewer.ts:44-86,746-782`); add a brief loading shimmer on the 3D card.
- **P4. Mobile edit-sheet close button** (`mobile.ts:22-29`): gesture-only close today; add an ✕.
- **P5. Token hygiene**: `--ok` referenced but undefined (`styles.css:289`); hub.html/woodframe
  use hardcoded hex, no day/night — unify on tokens.css for a seamless hub → app transition.
- **P6. Docs pass**: USER_GUIDE.md describes a topbar/button layout that no longer exists
  (`USER_GUIDE.md:37,167,182,196,209,221,239`) — rewrite against the shipped hamburger + bottom
  toolbar after Phase 0 lands.

---

## Execution notes

- Order: Phase 0 is a day of small independent diffs (X1–X6 parallelizable). Phase 1 should go
  R1→R2→R3 (shape branching shares scaffolding: introduce a per-shape section/plan profile switch
  once, then fill in types), then R4–R7 in any order, R8 last (may become a delete), R9 alongside
  each item, not at the end.
- Constraints that must survive: placeholder honesty (no fabricated doctrine numbers — new drawn
  geometry gets doctrine/placeholder entries, PLACEHOLDER_POLICY.md), engineered-roof hazard
  behavior, callout↔legend generation from the `used` set, `guard()` finite-number safety, one
  projector per drawing, print tokens self-containment (DECISIONS D12/D14/D15).
- The GeometryModel is the right seam: prefer moving shape knowledge into `engine/geometry.ts`
  (where 3D can share it) over branching inside the SVG renderers.
- Verify loop per item: edit → fresh Playwright navigate → element-screenshot plan+section for
  the affected types → `npm run verify`.
