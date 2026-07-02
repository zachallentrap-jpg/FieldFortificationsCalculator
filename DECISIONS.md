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
