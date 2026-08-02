# SAP-1 — Decisions & Deferrals

Every assumption, defensible-default choice, and deferral, with the reason. Per the
build's operating instructions (§0): on genuine ambiguity, pick the most defensible
option, implement it, and log it here.

## Foundational

- **D1 — Target directory.** The master prompt says "build in an empty directory" and
  specifies a `sap1/` layout. This repository (`FieldFortificationsCalculator`) was an
  empty repo, so the project is built at the **repo root** (README, package.json, `src/`
  at top level) — i.e. the repo root *is* the `sap1/` project root. No nested `sap1/`
  folder is created.

- **D2 — No reference SVG was supplied.** §10 names `SAP-1_drawing_reference.svg` as the
  "shipped annotated reference" and render acceptance bar, but only the prompt `.md` was
  provided. Decision: **author** `SAP-1_drawing_reference.svg` from the §10 visual-system
  specification (header bar, numbered callouts + shared legend, coded fills, single-accent
  dimensions, standing figure + scale bar, loud orientation) and make `render/` reproduce
  it. The authored reference and the renderer share the same callout/legend registry so
  they cannot drift. Recorded so a reviewer knows the reference is derived from spec, not
  an external artifact.

- **D3 — Node & tooling.** Node v24.16.0 present (spec requires ≥20). TypeScript strict via
  `tsc --noEmit` for typecheck; tests run under Node's built-in `node:test`/`node:assert`
  with `tsx` as the loader (dev dependency only — the zero-runtime-dep rule applies to
  `doctrine/ engine/ state/`, not the test/build toolchain). Vite is dev/build-only.

- **D4 — Extra-strict TS flags.** Beyond `strict: true` (spec requirement) we enable
  `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `noImplicitReturns`, `isolatedModules`, `verbatimModuleSyntax`. Rationale: a
  safety-critical planner benefits from the compiler forcing every doctrine-table lookup
  to handle "missing key", which reinforces §2.6 (no non-finite graphics) and §8
  referential integrity. `verbatimModuleSyntax` enforces `import type` discipline.

- **D5 — Commit target.** The repo is a fresh, empty repo on `main` with zero commits; the
  pasted spec treats this repo as *the* project and instructs one Conventional Commit per
  stage. Initial project scaffolding therefore commits to `main` directly (branching an
  empty repo's first commit would be noise). Pushing to the `zachallentrap-jpg` remote
  requires that account's credentials and is left to the user.

## Engine / doctrine

- **D6 — Exact physical constants are not placeholders.** Unit-conversion factors in
  `doctrine/units.ts` (`M_PER_FT = 0.3048`, etc.) are exact physical facts, not doctrinal
  magnitudes to confirm against a pub. They are plain consts — **not** wrapped in `P()` and
  **not** registered — so they never inflate the placeholder count or keep the banner lit
  after all doctrine is filled. The number-free-engine gate (§2.4) targets `engine/render/
  state/ui`, so plain math constants living in `doctrine/` are fine.

- **D7 — Provenance wraps quantitative magnitudes + safety-critical values; qualitative
  structure stays plain.** Every geometry dimension (feet), multiplier, labor rate, shielding
  thickness, standoff, and span limit is `P()`-wrapped. Definitional structure — a position's
  `shape`, `crewSize`, `grenadeSumps`/`elbowHoles` counts, a revetment's `kind`/`buildsFace`,
  labels/notes — is plain. Rationale: those aren't "confirm-against-a-pub" numbers you fill
  in; they define what the position *is*. This keeps the "fill the values, clear the banner"
  workflow about real doctrinal quantities. The doctrine-integrity test encodes this policy.

- **D8 — Frozen structure, mutable leaves.** `doctrine/index.ts` deep-freezes every table's
  structure (can't add/remove keys) but stops at `Provenance` leaves, leaving them mutable so
  a validated doctrine import (`io.ts`) can update `value`/`status`/`source` in place. The
  registry holds references to the same leaf objects, so `counts()` — and thus the banner —
  recomputes immediately after an import. Import is the *only* sanctioned doctrine mutation.

- **D9 — `RoofPath` duplicated as a local union in `doctrine/protection.ts`.** So doctrine
  depends on nothing upstream (engine binds to doctrine, never the reverse). The union is
  structurally identical to `engine/types` `RoofPath`; a test asserts both stay in lockstep.

- **D10 — Sump volume/gravel scale with the position's sump count.** §9 writes
  `sumpVol = sump ? sump.L×W×D : 0` and `gravelVol = sump ? gravelFt3 : 0` (a single sump).
  The implementation multiplies both by `position.grenadeSumps` when the sump toggle is on.
  For a one-sump position it is identical to the literal formula; for multi-sump positions
  (two-man = 2, etc.) it is the faithful generalization — undercounting gravel for a 2-sump
  position would be a real field error. Determinism/purity unaffected.

- **D11 — The overhead-cover labor adder is gated on an actually-built earth roof.** §9 writes
  `+ (coverOn ? overheadAdd : 0)`. The implementation uses `roofPath === 'earth_on_stringers'`
  instead. Rationale: when the roof is `engineered_required` (contact-burst / shaped-charge),
  §2.7 forbids fabricating cover numbers — and fabricating *build labor* for a roof we are
  explicitly NOT designing is the same fabrication. So an engineered roof contributes no
  cover thickness, no cover BOM, no stringers, and no overhead labor. For every non-engineered
  covered case the two readings are identical.

- **D13 — Three adversarial-audit findings fixed (audit vs §9).** A background adversarial
  audit of the engine against the §9 contract confirmed three items, all now fixed in
  `compute.ts` and locked by `test/engine-audit-fixes.test.ts`:
  1. **Clamp advisory misfire (nit).** `COUNT_CLAMPED`/`TEAM_CLAMPED` compared the
     rounded+clamped value against the *raw* input, so a fractional-but-in-range value
     (e.g. count 3.4) tripped a "clamped to range" advisory though nothing was clamped.
     Fix: compare the clamp result against the *rounded* value — rounding is now silent,
     only true out-of-range raises the advisory.
  2. **Fabricated sump labor (deviation).** The sump labor adder was gated on the raw
     `sump` boolean while volume/BOM/geometry were `sumpCount`-driven, so a zero-sump
     position (mortar_pit, vehicle defilades — `grenadeSumps:0`) added 0.5 mh for a sump
     never dug. Fix: gate on `sumpCount > 0`, mirroring the earth-roof labor gate (D11).
     This is the same "don't fabricate labor for work not built" principle as §2.7.
  3. **`platformVol` coupled to `firingStep` (undisclosed §9 deviation).** §9 pins
     `platformVol = firingPlatform ? … : 0` — purely the position's structural platform.
     The code also required the `firingStep` input, so a crew-served position with the
     toggle off silently dropped platform excavation + its labor. Fix: `platformVol` keys
     only on `position.firingPlatform` (§9-literal). The `firingStep` input now drives only
     the section-drawing firing-step ledge (§10) — a minor cut §9 folds into `holeVol` —
     adding no fabricated volume or labor. `firingStepOn` is threaded through `Calc` for
     the renderer.

## Render / layout / state

- **D12 — The reference drawing is authored, and renderer + reference share one registry.**
  Per D2, `public/SAP-1_drawing_reference.svg` is authored from §10. To guarantee the shipped
  renderer matches it, both are generated from the same numbered-callout + legend registry
  (`render/svg.ts` `callout()` + the legend builder), so a callout number and its legend name
  can never drift between the reference and the live drawings.

- **D14 — Print tokens are a bounded, deliberate duplication.** `render/print-tokens.ts`
  inlines the Day-theme palette as a string so the standalone job sheet and the generated
  reference SVG render self-contained on `file://` (print is always on white — Night never
  applies on paper). It mirrors the Day block in `ui/tokens.css`; the duplication is accepted
  because a printed artifact must carry its own colors.

- **D15 — Render outputs complete (Stage 6/7).** `drawIso` is a deliberately schematic 2.5D
  cuboid (orientation only — the plan/section govern measurement, so it carries no
  dimensions). `csv.ts` is RFC-4180 (CRLF, quoted-only-when-needed, '.' decimals, no
  grouping) with a `Placeholder` column. `jobSheet.ts` is a page-break-safe print document
  embedding the same plan+section. Render tests: `render-nan` (position×threat×toggle matrix),
  `render-intuitive` (header bar, callout↔legend consistency, orientation, PH flags, min font,
  pattern redundancy, dim-label non-collision), `fuzz` (3000 seeded inputs — never throws/NaN,
  never fabricates an engineered thickness).

## Threat model / state / UI / packaging

- **D16 — Threat = class → specific caliber (operator-requested).** The threat's SIZE is the
  dominant protection variable, so a threat is a specific munition (5.56 → 155mm → RPG), not a
  coarse bucket. Each caliber carries its own placeholder shielding thickness, standoff, roof
  call, and cover material, so size moves the cover thickness, setback, and BOM. `Inputs.threat`
  stays a single munition id (no schema change); the UI class select derives from the catalog and
  filters the caliber select. Setback became `max(munitionStandoff, setbackDepthFrac × depth)`.
  SAFETY held: every direct-fire AT + large VBIED → `engineered_required`, thickness 0, no
  fabricated number; all magnitudes remain PLACEHOLDER. Lock: bigger caliber ⇒ ≥ cover + standoff.

- **D17 — Framework-free UI; unit is display-only.** The store is a ~50-line observer; all
  interaction is delegated (`data-field` edits, `data-action` commands, `data-trace` opens a
  derivation); renders batch via `requestAnimationFrame`. Layout/theme live in store, never in
  `inputs`, and switching unit imperial↔metric never changes the computed feet-space result (a
  test guards this, §2.8). Exports (print job sheet / CSV / JSON) are user-initiated in-app
  downloads. Scenario ids are supplied by the caller (`crypto.randomUUID`, Date fallback) so
  `state/scenarios.ts` stays pure/testable; every load re-validates through the import schema.

- **D18 — Single-file inlining + PWA shape.** `dist/sap1.html` inlines the bundled JS as an
  INLINE `<script type="module">` (inline module scripts run from `file://` — CORS only bites
  fetched module resources, of which there are none) plus inline `<style>`. The service worker is
  shipped as plain `public/sw.js` (copied verbatim to `dist/sw.js`) rather than `src/sw.ts`, so it
  registers reliably at the app scope root without a second build entry — a deliberate deviation
  from the §6 file map (a working offline SW is the requirement). Deploy is Replit **static**
  (`.replit`: build `npm ci && npm run build`, publicDir `dist`).

- **D19 — Test-gate scoping.** The number-free gate (§2.4) scans the engine's *math* modules for
  bare DECIMAL literals (the shape a doctrinal magnitude takes), allowing only `0.5` and
  scientific epsilons — presentation/infra integers in render/state/ui are out of scope by design.
  The `offline` test scans the pure layers (engine/render/state/doctrine/layout/theme) for network
  primitives + external URLs (W3C namespace URIs excepted). `compute.snapshot` pins the default +
  engineered + count-scaling baselines; regenerate deliberately when a constant legitimately moves.

## Interactive 3D viewer, language pass, menu (post-launch refinement)

- **D20 — `three` is an explicit, authorized, narrowly-scoped dependency.** The operator asked
  for genuine drag-to-rotate 3D models, not another flat schematic, and explicitly authorized
  adding whatever tooling that needs. `three` (+ its bundled `OrbitControls` addon) is added to
  `dependencies` and used ONLY from `src/ui/three-viewer.ts` — it is a UI-layer rendering
  consumer, exactly like `render/*.ts` is for SVG, and does not touch `doctrine/ engine/ state/`
  (those stay zero-runtime-dep per §5). Architecture mirrors the existing 2D split precisely:
  `src/render3d/scene3d.ts` is a **pure, framework-agnostic** geometry descriptor built from the
  same `Result`/`GeometryModel` the SVG renderers consume (no Three.js import there — it stays
  unit-testable under `node:test`, see `test/scene3d.test.ts`, which mirrors `render-nan.test.ts`:
  every position × threat produces finite numbers, and engineered munitions never get a
  fabricated cover box, exactly the §2.7 honesty invariant carried into 3D). `three-viewer.ts` is
  the ONLY place that turns that descriptor into meshes. The flat isometric SVG (`drawIso`) is
  kept as-is for the no-WebGL fallback and stays covered by its existing render tests — nothing
  about it changed.

- **D21 — Persistent canvas + a hard-won `preserveDrawingBuffer` lesson.** The app re-renders its
  whole shell as an HTML string on every input change, which would destroy a `<canvas>` and its
  WebGL context every keystroke. The viewer is created ONCE; `attach(container)` re-parents the
  same canvas node into the freshly rendered `#three-socket` div after every render (detach/
  reattach preserves the context, camera angle, and zoom — rotating the model never resets just
  because the operator toggled a checkbox). Framing (the initial camera position) only happens
  once, guarded by a `framed` flag, for the same reason. **Real bug found and fixed during
  verification**: the renderer defaulted to `preserveDrawingBuffer:false`, so the WebGL drawing
  buffer could read back blank/black whenever anything queried it outside the exact
  `requestAnimationFrame` tick — confirmed by forcing a synchronous render-then-read (171 valid
  colors) versus reading the buffer from a separate call after the fact (pure black). This isn't
  just a test-tooling artifact: a throttled or backgrounded tab is subject to the exact same gap,
  so a real user could see a blank 3D card. Fixed by setting `preserveDrawingBuffer:true`.

- **D22 — Two real 3D geometry bugs found and fixed against the live render, not just the type
  checker.** (1) The circular position's parapet ring was first approximated as 8 separate boxes
  arranged around the circle; adjacent boxes each got their own outline shell, and the seams
  between them read as dark clutter — replaced with a single smooth extruded annulus (`Ring3` /
  `buildRing`, a `THREE.Shape` with a hole, extruded once). (2) The vehicle-defilade ramp was
  first modeled as a thin (0.15 ft) tilted box; viewed at a shallow angle it read as a stray
  black diagonal line because its black outline shell (uniformly scaled 1.035×) visually
  dominated the nearly edge-on, paper-thin colored face. Root-caused via a synchronous forced
  render + `gl.readPixels` comparison (which also incidentally surfaced the real, structural bug
  below) and fixed by replacing the single tilted card with a stepped "staircase" of ordinary
  boxes — the same box primitive every other part already uses successfully, ground plane
  re-centered on the ramp's own footprint so it's never partially unsupported. (3) **The
  structural root cause underneath both**: `addToonMesh` created the colored mesh and its black
  outline shell as two independent siblings, and callers repositioned only the returned mesh —
  the outline silently stayed at its default (0,0,0) transform. This was invisible for symmetric,
  origin-centered shapes but a real, general bug for anything positioned away from origin.
  Fixed by having `addToonMesh` return a `THREE.Group` wrapping both mesh and outline, so a
  caller positions ONE object and the pair can never drift apart — a whole bug class closed by
  construction rather than by remembering to keep two objects in sync.

- **D23 — Plain-language pass, technical term kept alongside, not replaced.** The master spec
  pins a fixed vocabulary (parapet, revetment, sump, standard, Mission BOM...) that must still
  appear in the UI and docs. Per the operator's ask ("military terms only when you have to"),
  every control and legend label now leads with plain language and keeps the technical term
  parenthetically (e.g. "Dirt wall up front (parapet)", "Grenade catch-pit (sump)", "Roof support
  beams (stringers)") rather than replacing it outright — satisfying both constraints at once.
  `Sectors of fire` is the one label left untouched: it's asserted verbatim by
  `test/render-intuitive.test.ts` (an exact `aria-label` match) and is already reasonably plain.
  Every generated control (`layout/controls.ts`) now carries a one-line hint explaining *why* the
  field matters, not just what it's called.

- **D24 — Topbar restructured into two grouped `<details>` menus.** Fourteen flat, often
  abbreviated buttons ("Diag", "CSV", "JSON", "Mission") became: primary single-purpose actions
  stay as plain buttons with full words ("Start over", "Status"); the four scenario/analysis
  tools collapse into a **Tools** menu; the three export paths collapse into a **Save & print**
  menu. `<details>/<summary>` was chosen over a hand-rolled dropdown because it's keyboard- and
  screen-reader-operable with zero extra JS; `main.ts` adds only the polish native `<details>`
  lacks — closing on outside-click, on Escape, and automatically after an item is chosen.

- **D25 — 3D materials are honest, not decorative: what the BOM says is what you see.** Parapet
  and overhead cover are ALWAYS sandbag construction per doctrine (`bagsParapet`/`bagsCover` are
  computed unconditionally in `engine/materials.ts`) — tagged sandbag unconditionally in 3D too,
  tiled as small boxes (one shared outline, no per-bag outline — outlining every tiny bag looked
  cluttered) rather than one flat slab. The excavation face reflects the operator's ACTUAL
  revetment choice, read from the same doctrine tables the BOM already consults
  (`doctrine/soils.ts` wallSlopeRatio, `doctrine/materials.ts` revetments): sandbag facing tiles
  the same way as the parapet; pickets & wire renders as visibly open posts + wire (the clearest
  possible contrast against a solid face); corrugated metal and timber/plywood each get their own
  canvas-drawn texture (vertical ridges vs horizontal planks) even though the engine's BOM treats
  both as the same 'panel' kind — the operator picked a specific one, so the 3D view still tells
  them apart. Unrevetted walls are bare, sloped earth, with the batter driven by the soil's real
  `wallSlopeRatio` (steeper for sand/gravel, nearly vertical for clay/rock/frozen) — locked by a
  monotonic test (`rock < loam < sand` taper).

- **D26 — Sloped walls: direct vertex manipulation, not a shear matrix or a rotated extrude.**
  Only the excavation's OUTER-face vertices (away from the hole) move, flaring from unchanged at
  the floor to `min(slopeRatio × depth, parapetW × 0.9)` further out at grade — the inner face
  (matching the floor) never moves, and the clamp keeps the flare from poking past the parapet's
  own footprint into open ground. Chosen over a shear matrix specifically because a shear moves
  EVERY vertex at a given height by the same amount (both faces together, preserving thickness —
  not what a wider-at-the-top excavation needs); direct position-buffer iteration lets exactly one
  side move, and is easy to verify vertex-by-vertex rather than reasoning through composed
  rotate+translate matrices (the exact class of math that produced the ring/ramp bugs — see D22).

- **D27 — A wall's grade-level top now sits 0.25 ft ABOVE y=0, not exactly at it.** Found while
  verifying the sandbag revetment: the ground plane is a solid slab with no true cutout (the
  "hole" is an illusion of layering, not a boolean subtraction), so a wall ending precisely at
  grade let a shallow-enough viewing angle skim over its top and see a sliver of the ground's own
  surface right in the middle of what should read as a recessed bay. This margin isn't a new
  concept introduced by the materials work — it's a small, targeted patch on a limitation that
  predates it; extending every wall a quarter-foot above grade closes the gap for any ordinary
  viewing angle without changing the excavation's real depth.

- **D28 — Blender-authored GLB props, normalized to a unit box, dimensioned at runtime.** Six
  props (sandbag, picket, plywood sheet, 2x4 / 2x6 / 4x4 dimensional lumber) are modeled once in
  headless Blender (`scripts/make_lumber.py` shows the pipeline; the sandbag/picket/plywood
  scripts were authored the same way — adapt `make_lumber.py` to regenerate) at honest real-world
  proportions with the organic detail that makes them read as real objects (bag sag, hewn-stake
  facets, plywood bow, lumber crown/crook, dressed cross-sections), then normalized to a 1×1×1
  bounding box before export. Runtime code applies exact doctrine dimensions via
  `mesh.scale.set(w, h, d)`, so one asset serves any size input and a doctrine import changes the
  3D model with everything else — no re-export. The GLBs are inlined as base64 `data:` URIs at
  build time (`assetsInlineLimit`), so the offline invariant holds exactly as for every other
  bundled asset. Load is async even for a data URI: every wall builder falls back to the plain
  procedural shape until the template resolves, then registered viewers re-run their last
  update(). Two rules keep this honest and deterministic: (1) instance jitter uses a hash of the
  tile coordinates, never `Math.random()` — identical inputs render identically; (2) sandbag
  walls tile in ALL THREE axes from the pure `render3d/propLayout.ts` grid (node-tested), so
  cells track the doctrine bag's laid proportions and the fallback box tiles the same cells —
  a wall's envelope can never differ between the fallback and the loaded prop, and a thick
  parapet reads as multiple bags deep instead of one bag stretched to the wall's depth.

- **D29 — Phase 1 formula honesty: the model must survive expert falsification.** An NCO who
  knows the manuals could falsify SAP-1's vehicle and mortar math in minutes — placeholder data
  excuses wrong *constants*, never wrong *structure*. Fixed in the engine, each behind a test
  that re-derives the number independently:
  - **Stringer axis.** Stringers now count along the LONG axis and span the SHORT one
    (`ceil(max(L,W)/spacing)+1`); the pre-fix count keyed on the short axis, implying stringers
    that span the frontage — wrong assembly. The BOM/trace label the doctrine stringer size.
    This flips the default two-man snapshot stringers 3→8 (regenerated here, deliberately).
  - **Span fail-safe.** A roof clear-span beyond the stringer table resolves to
    `engineered_required` through the *single authority* (`resolveCover`), not a bolted-on
    warning around a still-fabricated thickness — an extension of the §2.7 fail-safe invariant.
  - **Vehicle defilade.** Adds the access-ramp wedge (the dominant excavation volume), replaces
    the ~450-sandbag phantom parapet with a dozed spoil **berm**, requires/warns machine assist,
    and reports **blade-hours** on their own axis (a dozer hour is not a man-hour).
  - **Circular mortar pit.** π/4 volume + circumference perimeter (was a 27% square-for-circle
    overestimate).
  - **Revetment materials.** Panel revetments emit a facing-area line; picket revetments quantify
    tie wire — labor is never charged without a material line again. Loose-soil cover is billed
    as fill volume, not phantom sandbags.
  - **Advisories.** Cut-depth-vs-shoring, wet-soil drainage, spoil balance (short/excess), and
    "overhead cover requested with no threat" (previously a silent no-op).
  - **Model-fidelity statement.** Every position declares its volume + labor model as
    `approximate` in the specs panel and job sheet — the structural analogue of the (PH) flag,
    extending the honesty regime from constants to formulas.
  - **SME checkpoint (open item).** The ramp geometry, berm sizing, spoil-balance model, and
    blade-hour rate are newly *invented in-repo* — exactly the wrong-in-kind failure mode this
    phase exists to fix. They ship as placeholder-wrapped and fidelity-flagged `approximate`,
    but a qualified reviewer must still confirm the STRUCTURE (not just the constants) before any
    of it is trusted. Tracked as the Phase 1 acceptance debt in `docs/EXECUTION_PLAN.md`.
  Four new doctrine leaves (berm W/H, blade-hour rate, ramp slope) move the placeholder count
  275→279 (188 safety-critical); all remain PLACEHOLDER, banner unaffected.

- **D30 — Phase 2 doctrine unlock: the banner can now reach zero.** The placeholder regime's
  central promise (fill real values offline → banner clears) was dead code — `exportDoctrine`/
  `importDoctrine` had no UI. Now a Doctrine-values overlay (Tools menu) drives the burn-down,
  through a hardened `io.ts`: **all-or-nothing** apply (one rejected entry refuses the whole
  file — safety-critical data must never land half-applied), finite `0 ≤ v < 1000` bound,
  rejection of a DOCTRINE status carrying a TODO source (would defeat the doctrine-integrity
  invariant), a dry-run preview, and a **fill manifest** (deterministic FNV-1a content hash +
  optional author/date) printed on the Status panel and the job-sheet footer so a DOCTRINE
  stamp is attributable evidence. An applied fill persists to IndexedDB and is re-applied on
  boot **through the same validated importer**, so a stored fill that no longer matches the
  registry is refused, not trusted. The end-to-end banner-clear is test-backed (all 279 leaves
  → DOCTRINE → remaining 0 → topbar badge gone → restore proves it is not a one-way latch).

- **D31 — CUI: SAP-1 ships on ILLUSTRATIVE PLACEHOLDER data, so the empty shell is not itself
  CUI — but its FILLED output is.** Resolving the CUI ambiguity the plan flagged (halfway is the
  worst state): the distributed application, running on placeholder data with the NOT-FOR-FIELD-
  USE banner up, carries no controlled information and needs no CUI marking to distribute. The
  moment a qualified user imports real doctrine and the banner clears, the tool's output (job
  sheet, drawings, exported doctrine file) may be CUI — the job-sheet footer names the doctrine
  fill it was computed against precisely so that provenance is auditable, and the job sheet keeps
  its handling note. The README CUI paragraph stands as the handling guidance for filled use;
  distribution of the unfilled shell is unrestricted. Clear specifics with your S-6.

- **D32 — Phase 3 field documents: the plan doubles as a range card.** Additive SVG only (the
  render-intuitive gate — min font, callout/legend consistency, no dim-collision — is preserved):
  sector limits labeled in degrees AND mils (6400/360, plain-language-first), a north arrow and
  scale bar on the plan, and a grazing-fire line (FPL) for machine-gun positions. The job sheet
  gains a hand-filled field header (grid / unit / DTG / azimuth of fire / prepared-by) — the tool
  frames the card, the NCO supplies terrain ground truth, and the engine stays clock- and
  terrain-free. Plus SVG download per drawing (the renderers already emit standalone SVG — no
  rasterization, fully offline) and a one-click hasty/deliberate/reinforced compare preset.

- **D34 — Phase 5 3D-that-teaches; D35 — Phase 6 catalog expansion.** (D33 skipped to keep the
  Phase↔decision numbering aligned.) Phase 5: `buildScene3D(result, {stage, cutaway})` filters
  parts so the model builds itself in the same doctrinal stage order the priorities-of-work
  schedule uses (a keyboard-accessible scrubber drives it); a global clipping-plane cutaway; 3D
  honesty parity (data-driven NOT-FOR-FIELD-USE badge, §2.7 fail-safe asserted at every stage);
  one-man positions never draw a firing step (spec §2.f); a job-sheet engineer-handoff block.
  A UI-only falsy bug (`parseInt('0') || 6` swallowed stage 0) was caught by browser
  verification, not the node tests — the tests exercised `buildScene3D` directly; the event path
  had the defect. Phase 6: two doctrine-gated positions (connecting/crawl trench; ATGM/Javelin)
  that inherit the full fuzz/NaN/scene matrix automatically because those tests iterate the
  position registry; an ATGM rear-backblast safety warning; and the radiationHalving leaves
  (9 safety-critical, previously dead) wired into a fallout-attenuation readout so every
  registered leaf now has a consumer. Placeholder count 283→293 (+2 SC). DEFERRED (documented,
  not built): the squad battle-position multi-position sketch (mission aggregation already covers
  the squad math) and the fine bonded-bag hero-model aesthetic (needs visual iteration).

- **D36 — TIMBER-1 accuracy pass + the FM 5-426 lesson set (foundations, framed openings,
  stairs, bracing).** The wood-frame model was geometrically plausible but not layout-true;
  this pass makes the geometry teach what the manual teaches. Accuracy: walls now stand
  INSIDE the floor edge (sole-plate outside face flush with the rim plane — they previously
  straddled the building line, overhanging half a plate), studs/joists/rafters sit on the
  true OC layout grid (end members edge-flush, interior members on exact 16"/24" multiples,
  so panel edges land on centers and the plate strips show the doctrinal 15 1/4" first
  mark), joists fit between rim joists, rafters are shortened half the ridge thickness (the
  FM layout sequence, test-asserted), the ridge board's top is flush with the rafter planes
  (it used to poke through the roof), roof sheathing lies ON the rafter planes with the top
  course ripped instead of overlapped (it used to be buried inside the rafters — the visible
  bug), ceiling joists and collar ties nail BESIDE their rafters, gable studs stop at the
  rafter underside, cap plates lap at corners. Lessons, all live-switchable from a Model
  toolbar and regenerated through the same single Member[]: foundation triad (piers on pad
  footers / continuous wall on strip footings with anchor-bolt sills all around / full
  basement — deep walls, slab, girder columns, ~1 ft exposed concrete); the framed stair
  opening (double trimmers, double headers — the south pair bearing on the girder — and tail
  joists) with a straight stair whose riser/tread math follows the FM range (risers ≈ 7.5",
  treads = risers − 1, opening length derived from the 80" headroom line, straight run
  skipped gracefully when the plan is too small); the same framing-at-openings pattern
  repeated at the attic scuttle so the vocabulary transfers; 1x4 let-in corner bracing at
  45° where openings allow (steeper where crowded, skipped where there is no room, faces a
  hair proud so the let-in reads); and cross bridging (1x3 diagonal pairs, bottom-nailing
  note deferred until after subfloor per the manual) vs solid full-depth blocking. Concrete
  members carry provenance like lumber (nominal "conc …", PH-flagged cites, a PH per-LF
  labor rate so foundation stages report man-hours) and render as plain gray boxes — the
  BOM/labor deltas between foundations are visible in the stage panel, which is the
  leaders' half of the lesson. Every role gained a one-line plain-language "what it does"
  on the Member Card (§11.1 posture: a 1371 meeting the term for the first time). All of it
  stays inside the placeholder regime — no new fabricated doctrine values, every cite still
  (PH) pending page verification.

- **D37 — TIMBER-2 T0: the compat lock is committed bytes, and every "we promise" became a
  machine.** Executing `docs/TIMBER2_PLAN.md` phase T0. Four guardrails, all of which had to
  exist BEFORE the engine is touched: (1) `test/goldens/frame/` — `generateFrame` snapshotted
  at the pre-refactor commit into 12 curated full-JSON goldens (one per distinct code path,
  one member per line so a regression reads as a reviewable diff) plus a hashed index over the
  entire 72-row timber-features option matrix. Full-matrix coverage for 1.3 MB instead of
  10 MB, and `test/timber2-compat.test.ts` diffs against those bytes FOREVER — never against a
  live `generateFrame`, which goes self-referential the moment frame.ts delegates (plan TD12).
  The comparator (TD13) is exact-deep-equal first, then a 1e-12 epsilon pass with per-field
  diffs, so benign FP wobble from an extraction can never be mistaken for the project's kill
  criterion. (2) `.github/workflows/toolkit.yml` — `npm run verify` + `npm run build:suite` on
  every push/PR, plus a merge-base diff that fails the build if a legacy timber suite was
  edited (I-8/K2: the compat suite is the only sanctioned bridge). (3) `scripts/check-assets.ts`
  wired into `verify` — the "no new dist assets" promise behind TD11's runtime-SVG thumbnails
  is now an allowlist gate; it immediately caught the pre-existing `icons/icon.svg`, which was
  added to the baseline explicitly rather than pattern-waived. (4) `public/sw.js` deleted
  (TD16): it was SAP-1's cache-first worker listing files that no longer exist in suite builds,
  while `build-suite.mjs` already writes the cache-killer `dist/sw.js` — the toolkit ships no
  service worker, and now nothing claims otherwise. Reciprocal doc edits per plan §6.5: the
  SAP-2 blueprint's TIMBER row no longer binds carpentry to SAP's ship-empty regime (TD1) and
  names exactly which gate classes apply to `src/timber` (offline/determinism/doctrine YES;
  watermark/commissioning NO — LS-GATE replaces them); R5b gains the crib-bunker reconciliation
  entry condition so the bunker boundary is owned on both sides.

- **D38 — TIMBER-2 T1: the parametric engine exists, and the legacy output did not move by one
  bit.** `generateFrame` no longer composes the generators itself: it maps `BuildingInput` onto
  a `BuildingSpec` (the §2.4 migration table, written as `specFromBuildingInput`) and delegates
  to `generateStructure`, the single entry point every future family also goes through. The
  frozen goldens from D37 passed unchanged through the delegation on the first run — exact
  deep-equal, not epsilon — across all 12 curated fixtures and all 72 matrix rows. New modules:
  `spec.ts` (the StructureSpec discriminated union + the SPEC_PATH registry), `normalize.ts`,
  `stagePlan.ts`, `doctrine.ts`, `families/{building,index}.ts`, `subsystems/wallSystem.ts`.
  Four decisions worth recording. **(1) C-10 taken literally:** `floor.ts`/`walls.ts`/`roof.ts`
  ARE the frozen branch — not rewritten, not edited, wrapped. Breadth arrives as sibling code
  reading a published contract, so the byte-pinned path is never in its way and never in a
  refactor's blast radius. **(2) The wall placement convention is now OWNED** (C-4): where a
  wall sits was knowledge duplicated between `walls.ts` and `elevation.ts` and about to be
  copied a third and fourth time by coverings and second stories. `wallSystem.wallContract()`
  publishes `bearings` (what a floor above can sit on) and `surfaces` (each wall plane with its
  opening cutouts), and the test checks the contract against the framing the frozen generator
  actually emitted — not against itself. **(3) Two normalizers, deliberately:** `normalizeSpec`
  clamps and reports but NEVER reorders (TD5 — the legacy generator bakes opening input order
  into member ids, so a helpful sort would silently renumber members the goldens pin);
  `canonicalizeSpec` does sort, and is used only for presets, serialization and hashing.
  **(4) `bomSummary` throws past its stage plan** (TD18) instead of filtering: hand a tower's
  members to the legacy 11-stage plan and the old code silently dropped everything above stage
  11, producing a bill that was short and looked fine. Also this phase: `doctrine.ts` mirrors
  the frozen modules' magnitudes rather than moving them, with a test asserting the mirror is
  true, so the two cannot drift; DRESSED/BF_PER_LF gained the TIMBER-2 sizes with a lockstep
  test making the emitters' `{1.5,3.5}` fallback unreachable in real output; and
  `timber2-number-free` scans the new generator surface for inline magnitudes the way
  `number-free.test.ts` already does for SAP.

- **D39 — TIMBER-2 T2: breadth arrives as siblings, and the tests found two real bugs.** Shed
  and flat roofs, the full coverings system, skid/slab foundations, the small-plan rule, the
  catalog and runtime card art — all added without the frozen legacy branch moving one byte
  (the compat goldens stayed exact through every step). Decisions worth recording. **TD6 in
  practice:** a shed needs a taller wall on its high side, and `generateWalls` is frozen and
  only makes rectangular walls. Rather than unfreeze it, the ROOF module emits the difference
  itself — a pony wall above the high cap plate plus rake infill up the two side walls — which
  is exactly how the legacy roof generator already handles gable-end studs, so the pattern is
  the repo's own. A test asserts all four cap plates stay at one height, proving the frozen
  generator was never asked for an unequal wall. **C-9 double-decking avoided:** the gable's
  stage-9 deck comes from the frozen roof generator, so the covering pass decks only the NEW
  roof kinds — otherwise the roof would be sheathed twice and the bill would silently double;
  the test pins the `RF-` prefix on legacy panels and `CV-` on the new ones. **Two real bugs,
  both found by tests rather than by eye:** (1) the seeded sweep caught a NEGATIVE post length
  at crawl heights below ~0.65 ft — the built-up girder hangs 9 1/4 in below the sill, so a
  shallower crawl buries its posts; the `crawlFt` bound is now floored at 1 ft with the
  geometry, not a preference, recorded as the reason. (2) The C-5 conservation check caught
  board siding billing a third of a square foot heavy per wall: boards were spaced at a
  computed cell width but billed at their nominal 9 1/4 in face. Boards now run at their true
  dressed width with the last one ripped — what happens on site — and the arithmetic closes to
  1e-6 sf. **Thumbnails (TD11):** runtime SVG projected from the engine's own members, so no
  build step, no asset files, and no possible drift from the structure depicted. First cut blew
  the 140 KB budget at 147 KB by drawing all twelve edges of every 1.5-in stud; thin members
  now draw as centerlines, which is both 4x smaller and more legible at card size. **The
  number-free gate earned its keep** — it rejected a dozen inline constants during this phase,
  which became either cited doctrine entries or a named `TOLERANCE` block for the genuine
  geometry bookkeeping (z-fight lifts, sliver minimums) that no manual has an opinion about.
