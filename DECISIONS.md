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
  exist BEFORE the engine is touched: (1) `test/goldens/frame-compat/` — `generateFrame` snapshotted
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

- **D40 — TIMBER-2 T3: the app opens on a picker, and the browser caught four bugs the unit
  tests could not.** The UI is now a package (`src/ui/woodframe/*`) with everything testable
  kept pure and node-tested — cutaway plane math, camera rigs, session store (injected
  storage), router/share codec, config schema, label dictionaries — and a thin DOM layer over
  it (picker, studio, boot). happy-dom is not installed at the root and adding it needs a
  lockfile change, so the DOM layer is verified in a REAL browser via Playwright instead,
  which is stronger than a shim and caught things a shim would not have. Four real bugs, all
  found by looking at pixels: **(1)** `memberAabb` applied each member's half-LENGTH on all
  three axes, so a 48-ft girder inflated the bounding box to 69×64×73 ft and every camera
  framed a phantom — the model rendered as a toy in an empty viewport. Replaced with a proper
  oriented-box projection (`Σ|R[i][j]|·h[j]`); the box is now the real 48.9×14.8×22.2 and the
  fit distance dropped from 204 ft to 99. **(2)** Shed rafters were rotated with the wrong
  sign for Z-running slopes: correct length, correct cut angles, running downhill toward the
  high wall and sitting above their own deck. Length-and-angle assertions passed it; a
  direction-vector test now catches it, plus a rafters-under-the-deck test. **(3)** The
  clip-plane pass forced `side = FrontSide` on EVERY material including the cartoon outline
  shells, whose entire trick is being back-side — every outline became a solid black box
  wrapping its member, painting a board-and-batten wall pure black. **(4)** Mobile inputs
  overflowed the viewport; rows now stack and the model sits above the config panel, because a
  config panel above the thing it configures makes every edit blind. Also: the cut plane
  equation exists ONCE and feeds both the renderer and the raycast filter, so clicking through
  a cut selects what you see; stage scrubbing toggles visibility rather than rebuilding; and
  `unlockToCustom` preserves the family (a tower stays a tower) with a per-family test.

- **D41 — A protection magnitude of zero or less MEANS the value is absent, and every unknown
  in `resolveCover` leaves by the same door.** Taking a filled zero literally is the reading
  that produces the worst state this tool can reach: a shielding thickness of 0 ft says "this
  round needs no cover", which is never true of a real munition, and the engine drew the earth
  roof, billed its stringers and delivered nothing — silently, because `ROOF_ENGINEERED` cannot
  fire on an earth roof and `COVER_UNDER_THREAT` needs a delivered thickness above zero to
  compare against. The import bound (`0 ≤ v < 1000`) accepts a zero, so a perfectly valid fill
  can put one there. It now reads as ABSENT and fails safe like a missing leaf: engineered
  roof, zero thickness, §2.7 intact. The same reading covers the resolved product (leaf ×
  `coverMul`), a non-finite value at either end, and standoff in the import checks. The
  judgment is the point — the code cannot avoid choosing a meaning for an unusable number, and
  "absent" is the only choice that fails toward the designer instead of toward a roof nobody
  can shelter under. **`ROOF_NO_COVER_MULTIPLIER` is its own code**, separate from
  `ROOF_NO_SHIELDING_DATA`, because `protection.shielding.<threat>.<material>` and
  `standards.<x>.coverMul` are different tables, confirmed against different pubs by different
  people; saying "no shielding data" when the shielding row is fine and the standard's
  multiplier is the zero sends the operator to the wrong table to fix it, which is worse than a
  generic message. **Both data-gap codes fire only when `calc.coverReason === undefined`** — a
  deliberate narrowing. The data gap is the only `engineered_required` return that records no
  `engineeredReason`, so a threat- or span-driven engineered roof is already explained by the
  rule that fired, and naming a data gap there would blame a doctrine value for a decision
  doctrine made correctly. The cost is real and accepted: on a roof engineered by threat or
  span that ALSO has an empty shielding row, the empty row goes unmentioned. What is
  guaranteed is the part that matters — every engineered roof carries `ROOF_ENGINEERED`, and
  the one case no rule explains names the value that is missing, so no roof is unexplained.
  **`DoctrineImportReport` gains a REQUIRED `rejectedTables`.** A `path` in `rejected`
  addresses a row of the fill table the operator is looking at; `stages.excavationSplit`
  addresses nothing they can edit. Required rather than optional so every construction site had
  to be visited and no caller can quietly drop a class of finding on the floor, and rendered as
  its own block so a reader is never sent hunting for a row that does not exist. **The
  excavation split keeps its ALL-OR-NOTHING rejection, and that blocks a legitimate single-row
  correction.** Known cost, accepted. The stage clock partitions ONE excavation total, so the
  four shares are only meaningful together — accepting three and leaving the fourth stale
  invents or loses labor in the per-stage breakdown with no other symptom, which is exactly the
  failure a partial fill is supposed to be safe from. The finding names all four shares and
  tells the filler to send them in the same file, adjusted to sum to 1: a worse workflow than a
  one-row edit, and a better one than a partition that silently does not partition. **The
  importer also warns on a magnitude the app cannot display as anything but zero, and that
  threshold comes from the DISPLAY, not from doctrine.** A leaf filled to 1e-9 ft is strictly
  positive, so the fail-safe above passes it and the roof gets built at a billionth of a foot.
  There is no doctrinal minimum thickness in this repo to test against, and inventing one is
  precisely the fabrication the placeholder regime exists to prevent — so the check asks the
  app's own `fmtLength()`, the formatter the specs panel and the printed job sheet render cover
  with, whether the value keeps any significant digit in EITHER unit system, and reports it if
  not. No thickness constant is written into the check. It is asked of the PRODUCT as well as
  of the leaves: an earth roof is built to leaf × `coverMul` and both are fillable, so a
  legible thickness and a legible multiplier can still multiply down to a roof that prints as
  nothing — a state neither leaf-by-leaf check can see. That combination is blamed on the
  multiplier rather than on the shielding row, on the same reasoning as
  `ROOF_NO_COVER_MULTIPLIER`, and only while the thickness is legible by itself, so an unusable
  thickness is still corrected in one place. **The residual, stated plainly:** this is a
  warning and not a refusal, so the value lands and the engine still sizes a roof from it; and
  display precision is the only floor available, so a thickness that renders as an inch of soil
  is legible and therefore unreported. What is closed is the silence — every route to a roof
  the panel can only show as zero, through a leaf or through a product, is reported at the
  moment the fill is made, in a message that quotes what the panel would show.

- **D42 — A life-safety row that names a check must be watched doing the checking, and a
  declaration may never stand in for the branch.** Four separate rows have now told a packet's
  signer that a member was held to a limit nothing measured: the hip's bird's-mouth seat, the hip
  and jack rafters' spans, a tail joist at CEILING level (skipped by the floor table for sitting
  above the deck and by the ceiling table for not being called `joist`), and the bunker's 6x8
  entrance header under `SPAN.header`. The first three were found by hand and two of them grew back
  after the round that fixed the one before, which is the tell that the register was being
  maintained by care rather than by a gate; the fourth nobody had spotted at all, and the gate
  described here is what found it. `LsConsumer` therefore gains two fields. **`checkedBy`** names
  the module that MEASURES the members against the value — a size the emitter cut from is consumed by
  the member simply existing, but a LIMIT is only consumed if something compared a member to it,
  and a row that cannot name what did the comparing is a row claiming an examination.
  **`unmeasured`** is a role the value governs in the abstract that the named check cannot reach,
  carrying the reason, and it exists because the previous fix for the hip's seat was to delete
  `hipRafter` from the list: true of `roles`, and silent in a way the next reader takes for
  coverage. **The gate is five tests over the card-and-panel corpus** (`timber2-doctrine.test.ts`,
  the same walk the nailing register is proved against — 70 member roles, 208 distinct member
  classes, 7 unaided check results, 2 seated roles, each floored just under its measured value):
  every declared role is one some shipped build emits; every role a LIMIT
  declares is one its named check is SEEN to measure — by the check's own warnings where a shipped
  design breaks its row, and otherwise by handing the checker that build's own member at eight
  times its length, because a member inside its row and a member no branch reaches are the same
  silence from outside; no member CLASS a row claims falls through every branch, per class rather
  than per role, because a tail joist at ceiling level is the same declared role as one on the
  deck and only one of the two was ever measured; every member a span table can be READ on is
  claimed or disclaimed by SOME row, which is D43 below and is the one that starts from the
  generators instead of from this table; and no `unmeasured` declaration that does not hold up.
  **WHAT THE CORPUS FLOORS CAN AND CANNOT SEE — CORRECTED, BECAUSE THIS ENTRY FIRST GOT IT WRONG.**
  It justified them by saying that what narrows a corpus is a walk that stopped walking or a
  recorder that stopped recording, and that either takes most of a set rather than a member of it.
  Measured false: make `recordLs` skip one role's members — `tailJoist` — and the classes go 208 to
  205 while the roles, the unaided results and the seated roles do not move at all, so all four
  floors sit green through it and a declaration bypass rides in behind. What the floors DO catch is
  a wholesale narrowing: cutting the corpus back to the catalog cards takes 208 classes to 152 and
  7 unaided results to 2, firing two of the four (the role count only falls 70 to 62 and the seated
  count not at all, which is the same point again — an aggregate cannot see a role). So the
  evidence the tests actually read is pinned BY NAME as well as by count: the kinds of unaided
  result, and the member classes the refusals cite — the four roles a framed opening is built from,
  on both decks, and the hips of a build with nothing else on its roof. **That fourth test is the
  one that had to be rewritten, because as first built the
  escape hatch validated itself.** It asked "does the check fail to measure this role?" — which is
  trivially true exactly when somebody has broken or omitted the branch, i.e. in precisely the case
  it exists to refuse. Demonstrated, not theorised: revert the tail-joist branch in `spans.ts` and,
  instead of fixing it, move `tailJoist` from `roles` into `unmeasured` on both joist rows with a
  plausible sentence, and the whole file went green — the same file that had caught that identical
  defect twice. Two things made it work and both are gone. The exemplar set was built from what the
  register CLAIMED, so a declaration deleted its own evidence; it is now built from what the
  generators emit, which nothing written in `LS_CONSUMERS` can touch. And "unmeasurable" is no
  longer asked of the check at all. **The criterion is derivability, and for a span it is the
  member and the table, not the code.** A span limit needs two things: a number of feet, which
  every member yields because it carries a position, a pitch and a cut length — the clear span the
  check derives is bounded by that plan run and nothing about a member makes it unobtainable — and
  a row of THIS limit's own table for the member's nominal, which is the real edge of a span row's
  reach and a doctrinal fact rather than a fact about anyone's branch. A role in scope that has
  both is a role the limit CAN rate, so it must, and the refusal names the class: replanting the
  bypass now fails with `SPAN.joist` AND `SPAN.ceilingJoist` each told that `tailJoist` "carries
  everything this limit is read on — building · tailJoist · 2x8 · on the deck runs 11.9 ft and 2x8
  is a row of this very table". **The seat side is held by `birdsMouth.ts`'s own subject list, and
  that is not the same trap.** `seatCutsFor` runs over every member of every build and has never
  heard of the register, so a declaration cannot suppress its own refutation — which is exactly
  what the span side could do. The geometric analogue would be WORSE there: squash a hip roof to a
  4 ft plan and its hips swing to within 14.0° and 17.0° of a wall line on two builds the corpus
  already ships, `runAxisOf` snaps all four of them onto that axis, and `seatCutFor` duly returns a
  notch that is not the hip's joint at all. What decides that
  check's reach is whether the cut IS the member's joint, a modelling judgment the module states
  in the open and the viewer draws — so the subject list is the criterion, and the gate now refuses
  the reverse, a role the module seats that the row says nothing about. **The packet gained a NOT
  EXAMINED channel rather than staying silent.** A build with hips on it prints the seat-depth row
  — earned by its commons and jacks — with `NOT EXAMINED: …no hip rafter in this build was
  measured` inside the row itself, not in a footnote, because a row saying "held to this" and a
  note elsewhere saying which members it skipped are read minutes apart if at all; the CSV carries
  the same text in its own column, since the CSV is the half of the packet that gets separated from
  the other half. Caveats print only for the unmeasured members the build actually contains — a
  shed is not owed a sentence about hips. **`LUMBER.headerNominal` and `SPAN.header` are scoped off
  the bunker family**, which is a scope fix and not a check fix on purpose. A crib or post-and-
  lagging bunker continues its 6x8 CAP BEAM across the doorway (the emitter cuts it at
  `BUNKER.capNominal` and cites it), and both of those rows are dimension-lumber values: the size
  is what a stud wall puts over a window, and the span table's rows run 2x4 to 2x12. Listed
  unscoped they printed on a bunker packet as the values its doorway rested on, with a limit no row
  of the table could be read against — the honest answer is that they do not govern that member,
  not that the check should be taught to guess. **The residual, stated plainly:** `checkedBy` is
  still a declaration, so a row that names no check is only held to "some build emits this role";
  the span criterion refuses a declaration but cannot invent the branch, so the fix is always
  someone's; and the hip's seat remains the one open item, unchanged — when the double-cheek
  geometry is derived, `hipRafter` goes back on that register line and the caveat comes off. **One
  more residual was missing from that list and cost a whole defect: none of the four tests required
  a role to be CLAIMED by anything.** They all start from what this table says, so a role in no
  `roles` list and no `unmeasured` list is invisible to every one of them. See D43.

- **D43 — Completeness is asked of the generators, not of the register: a member a span table can
  be read on must be claimed by some row, or disclaimed by one.** D42's gate refuses a FALSE claim
  in three directions and never once requires a claim to exist, and the same defect it was built
  for walks back in through the gap. Demonstrated: take `tailJoist` out of `roles` on both joist
  rows with no `unmeasured` entry and delete its branches in `spans.ts` — the register says nothing
  at all about it — and every one of those four tests passes, because a member class with no
  claimant is skipped, the "declares X" tests walk `roles`, and the escape-hatch test walks
  `unmeasured`. **And there was a standing instance in the tree the day this was written, needing
  no edit at all.** `LUMBER.joistNominal` sizes four joist roles — `joist`, `tailJoist`,
  `headerJoist`, `trimmerJoist` — and the two span rows named the first two. A framed opening (a
  stair well, an attic scuttle) turns the joists that would have crossed it into TAILS on a doubled
  HEADER standing on a doubled TRIMMER each side, so the two members the opening's whole load runs
  through were sized by doctrine, rated by nothing, and named by no span row: `building ·
  trimmerJoist · 2x8 · on the deck` runs 23.8 ft and `building · headerJoist · 2x8 · on the deck`
  runs 10.0 ft, both wearing a size that IS a row of the joist table, on the packet that printed
  the joist span limit as a value the build had been held to. **The fix is the branches, not a
  sentence** — `spans.ts` now reads all four joist roles on the floor and ceiling tables, a
  trimmer on the worst bay it crosses like any joist, a header on its own length between the
  trimmers because it runs the other way — and the warning for a doubled member says what the row
  means for it, in the shape the hip's message already uses: the row is what ONE joist carrying its
  own strip may span, a trimmer carries the header on top of that and a header carries the ends of
  every tail, so the figure is a limit it is already past and not a rating for it.
  **THE CRITERION IS THE EMITTERS' OWN VOCABULARY AND THE TABLE'S OWN SHAPE.** For every member
  class the walk emitted: the doctrine key and the member role name the same kind of member (the
  last word of `ceilingJoist` and of `trimmerJoist` is the same word), the table has a row for the
  member's nominal, and — for the repetitive tables, which are indexed by nominal AND by o.c.
  spacing — it has a COLUMN for the spacing that class actually stands at, measured off the
  emitted geometry as the distance to the nearest parallel member of its own role. Then, and only
  then, the register is asked whether any row in that member's scope speaks for it. Nothing in
  `LS_CONSUMERS` can move any of those three facts. **The column is not a technicality.**
  `columnFor` picks the nearest column at or above the member's spacing and falls back to the
  WIDEST when the spacing is past all of them, which is right for a 12-in layout read at the 16-in
  row and is not a reading at all for a member standing four feet from its neighbour: the allowance
  shrinks as the spacing grows, so the fallback hands over a figure that belongs to a member
  carrying a fraction of that strip — an overstatement, and overstatement is the direction that
  goes quiet on a real overload. Measured on
  the corpus, exactly two roles fall out of the obligation that way and nothing else does: a
  `rimJoist`, whose only parallel neighbour of its own role is the band on the far side of the
  building — the closest any build in the walk puts them is 46.5 in — and a tent frame's
  `bentRafter`, whose bents stand 46.25 in apart. Neither is one of a repetitive set these columns
  cover, and neither is quietly skipped: they are outside what the table can say, the same way a
  6x8 cap beam is. **`spanTableOf` was fail-OPEN and is not any more.**
  It returned any `SPAN.*` object as a table, and a table keyed on something other than
  a nominal — clear-span feet, a load class — then matched no member, produced an empty evidence
  list, and read as "nothing contradicts this declaration". Planted end to end — a `SPAN.trenchCap`
  keyed `{4:2, 6:3, 8:4}`, life-safety, hosting a false `unmeasured` — and measured both ways: with
  the precondition taken back out the whole file passes it, and with it in the plant is refused by
  name. The shape of the table is now a precondition, and the refusal says so in its own sentence
  rather than being interpolated into a per-class one where it read as a non-sequitur. **The probe
  is at eight times
  the member's length, not four**, because four was not enough for the shortest member the register
  now claims: the factors the claimed classes actually need run 1 to 6, the binding one being the
  attic scuttle's 2.5 ft doubled ceiling header against a 13.5 ft row. Raising it can only let the
  probe see more, and every test reads "measured" as a reason to demand a branch or refuse a
  declaration, never as a reason to excuse one. **Residual:** the obligation reaches a role only
  where the corpus emits it, so a role that exists in no shipped build is still held by nothing;
  and a class whose spacing cannot be measured at all is kept in the evidence deliberately, which
  is the fail-closed direction but means the column test is a floor on the evidence, not a ceiling.

## 2026-08-02 — The catalog is complete, and the last three gaps closed the way they should have

T7 finished the roster at 14 cards and T8's leftovers closed behind it. Four things worth
keeping, three of which are about how a gap gets closed rather than what got built.

**The bunker boundary is now enforced, not just written down.** Plan §2.7 says the
survivability tool owns how much earth defeats what, and this one owns the wood. That line is
worth drawing only if crossing it fails a build, so `test/timber2-boundary.test.ts` implements
§6.4: a word-boundary lexicon over shipped string literals, a publication denylist that makes
"configuration reference only" testable, and positive assertions that the boundary sentence
renders on the card, the input's help, the ghost label and the BOM header. It found something on
its first run — a tower doctrine key named for a word with a survivability meaning. Renamed to
`ladderClearanceFt`, which is clearer anyway. The gate is scoped to the engine and the
wood-frame UI: SAP-1's retired app legitimately carries that vocabulary, and gating it would be
gating the wrong side of the line.

**Header sizing turned out not to be a compat-lock event, and the reason is instructive.** The
first cut returned the smallest table row that fit — which quietly shaved every 3-ft window from
a 2x6 to a 2x4 and moved eleven goldens. That is a *weakening* of the standard design, produced
by a check written to catch openings that are too WIDE. Floored at the doctrine default, the
function only ever deepens, no golden moves at all, and the only shipped opening past the 2x6
row already carried an explicit 2x10. **A change that moves a golden is worth re-reading before
it is worth regenerating.**

It also landed in the right place on the second try. Sizing in `normalizeSpec` broke
idempotency — the first pass emitted an issue and wrote `headerNominal` into the spec, the
second saw the value and stayed quiet — and it polluted the user's spec with a value that then
read as a decision they had made. It belongs in `legacyOpenings`, at the translation into the
generator's input: the spec the operator holds is untouched, normalization stays pure, and an
explicit `headerNominal` still wins.

**Ceiling joists are checked now.** The T8 entry above recorded them as a known gap, unchecked
because the floor table did not apply and no ceiling table existed. There is one now.

**And one gap is left open on purpose.** A hip roof's FRAMING is complete — commons, four hips
on the diagonal run, and jacks whose constant shortening is asserted against the framing-square
formula rather than a snapshot (a golden would have frozen the bug as happily as the fix). Its
COVERING is not: `roofPlanes` treats a hip as a gable and returns two rectangular planes, so a
hip shows roofing on its long slopes and bare framing on its two triangular ends. Closing it
needs a tiler that can lay sheet goods on a triangle. The limitation is written at the branch
that causes it, so the next person finds it before the render does.

## 2026-08-02 — The span checker found a bad header in our own standard design on day one

T8's span check (plan mandate #2) is a lookup against `doctrine.SPAN`, and its governing rule is
a design decision rather than an implementation detail: **it warns and never resizes.** A tool
that quietly upsizes a joist to make its own check pass has taught the operator nothing and has
handed the crew a different building from the one on the drawing they are holding. Every message
ends with "the tool has NOT changed it", and a test asserts that sentence is there.

Writing it was mostly about not crying wolf, because a checker that fires on the tool's own
presets is one people learn to scroll past. Three passes to get there:

1. **A joist's clear span is not its length.** FM 5-426 puts a girder down the middle of a
   building precisely so a 20-ft joist spans 10 ft twice. Checked at full length, every building
   this tool makes condemns itself.
2. **Nor is it length over a bay count.** A shed on three skids bears in thirds. The checker now
   gathers every line a floor can bear on — girders, skids and sills — and takes the LARGEST gap
   between consecutive ones. Largest, not average: the governing span is the worst one, and this
   makes no assumption that the lines are evenly spaced.
3. **A rafter is checked on its horizontal run, not its sloped length**, or the same building at
   12-in-12 warns where at 2-in-12 it did not, over the same span carrying the same load.

**And then it found something.** The storage shed's 8-ft door had a 2x6 header; the table allows
5 ft. The engine does not size headers by span — it uses `LUMBER.headerNominal` for every
opening — and the shed card's "Wide-door header: per span table" lock was describing an
intention rather than the code. The preset now carries an explicit `headerNominal: '2x10'`, with
the reason written at the line.

**The gap is recorded, not closed:** header auto-sizing belongs in the engine, and doing it
properly changes what `generateFrame` emits for any wide opening — which is a compat-lock event
and needs its own change with the goldens regenerated and a reason. Two other holes are open in
the same spirit: ceiling joists are NOT checked, because the floor table does not apply to them
and no ceiling table is in `doctrine` yet (checking them against the wrong table condemned the
GP building by four tenths of a foot), and the tables themselves are (PH) — which prints with
every warning, because a warning that overstates its own authority is worse than none.

## 2026-08-02 — Three phases of the catalog, and the same rotation mistake three times

T4, T5 and T6a shipped together: the picker went from 3 cards to 13. What is worth recording
is not the breadth — TD2 predicted that a hut would be a data change — but the two things the
work kept teaching.

**One engine, six huts.** SEA hut, SWA hut, B-hut, squad hut, guard shack and the field latrine
are one `families/hut.ts` that translates a `HutSpec` into the `BuildingSpec` the existing
engine already builds, then adds girts, the screened band and the riser box. No new framing
code. The band is the interesting part: it enters as a wall-covering CUTOUT, because siding laid
over a screened band is a band that does not exist, and `wallContract` grew a `bands` parameter
so the covering pass can see it. The pit under the latrine is deliberately NOT a member —
nothing is built out of it — so its depth travels on the spec and prints on the sheet, where a
digging task belongs.

**The tower is where the safety machinery had to become real.** `subsystems/railings.ts` and
`subsystems/access.ts` exist as their own modules because the platform family needed them a
phase later, and because the one decision a caller can get wrong — "does this edge need a rail"
— should not be theirs. `railRequired()` answers it from the deck height. A ladder's rails are
generated running 36 in past the landing, which is the most commonly omitted part of a
field-built ladder and the part you hold when your feet leave the top rung. Ask for a ladder at
24 or 32 ft and `normalizeSpec` switches it to a switchback stair and says so in the banner —
checked in a browser, not only in a test.

**And the lesson, which arrived three times in one session.** A member's rotation is not a thing
to eyeball:

  1. Roof tiles carried a spurious `-Math.sign(upSlope.z)`, so the near slope's courses ran
     downhill under the deck.
  2. `screenPanel` and `roofingCourse` were both drawn through `plywoodSheet`, so a screened
     band and a roll roof came out as tan boards — a wall where the drawing says an opening.
  3. Ramp planks were emitted at rotation zero, so they stayed horizontal and a 24-ft ramp read
     as a fan of sticks in mid-air.

Every one of them is the same shape: composing `Ry(yaw)·Rx(rx)` sends a member's face-width axis
to `(sin rx·sin yaw, cos rx, sin rx·cos yaw)`, and there is exactly one `rx` that puts it on the
surface you meant. Guessing produces something that looks nearly right from the default camera
and is wrong from every other angle. The derivation is now written down at each placement
helper. **None of these were caught by a test, because no test renders** — they were caught by
looking, and by a numeric probe that walks a coordinate and prints which surface is on top.
That probe is the cheap version of looking and is worth reaching for before theorising.

The number-free gate earned its keep across all three phases: every inline magnitude in five new
generators was caught and moved into `doctrine.ts` with a citation, including the ones that are
genuinely tolerances rather than doctrine (those now say so in a comment where they live).

## 2026-08-02 — The wood-frame tool is two apps now, and they are not the same tool twice

The owner's instruction was explicit: *"we should actually branch here. one sub app should be
woodframe construction learning, and one should be woodframe construction planning."* Learning
gets the flashcards and the tools, but is a teaching aid — *"its not meant to show manhours or
things for the command, you get the principle and expand on it."* Planning is *"explicitly made
for 1371s to be able to choose everything they want... all the way down to the hardware, the
quantity, everything about it"*, ending in *"a clean sheet for their command to send off or
print out."*

**ONE code base, two pages.** `src/ui/woodframe/mode.ts` reads `<body data-app>` and exports a
short list of feature predicates; `woodframe-plan.html` and `woodframe-learn.html` are the same
shell with a different flag, a different title, and the same script. Forking the studio was the
obvious alternative and it is the wrong one: two copies of a 500-line workbench drift, and the
half that gets less attention rots. The difference between the two products is now a list you
can read in one file instead of a diff nobody re-reads.

`woodframe.html` stays, as a shim that forwards to the planning app carrying `location.hash`
across. It is deployed and linked and someone has a shared build URL pointing at it; deleting it
to make the naming tidy would 404 every one of those.

**What planning gained, because it had to.** A cut list tells a crew what to saw; it does not
tell them how many pounds of 16d to draw. `src/timber/fasteners.ts` reads the nailing schedule
each member already carries — "2-16d ea end", `8d @ 6" edges / 12" field` — and turns it into
counts and weights. This is an AGGREGATION over the same members the scene draws (I-3), not a
second model of how the building is fastened, and those strings are byte-pinned by the compat
goldens, so they cannot drift under it silently. The parser's rules encode real distinctions
that a naive scan gets wrong: an "or" is an alternative and is billed once, not twice; the ridge
board's "rafters 3-16d ea" is the same joint each rafter already bought and is skipped rather
than double-counted. **Anything it cannot read is printed, not dropped** — a supply list that
silently omits what it did not understand is worse than a short one, because it looks complete —
and a test walks every member of a shipped family and fails if any schedule goes unread.

`src/ui/woodframe/sheet.ts` is the deliverable: one document with the structure, the effort, a
still of the view the operator actually set up, the build sequence, the cut list, what to draw
from supply, and a signature block. Two refusals are deliberate. Nothing is pre-filled — unit,
date, prepared-by and approver are blank lines, because a document that signs itself is one
nobody checked. And every (PH) stays visible, including on the labor rates, because the whole
point of a command sheet is that the person signing it can see which numbers have been
page-checked and which have not.

**What learning gained, and what it deliberately does not have.** Flashcards, generated from the
model on screen rather than typed into a list — change the roof to a shed and the rafter cards
go away, add a basement and stair cards appear, so a student drills the building in front of
them. Card fronts are always the DESCRIPTION or the JOB and the back is the name and the size,
because the earlier direction ("what carries this? — 2x4") is unanswerable when six roles share
a nominal. Man-hours are gone from the stage panel; there is no hardware take-off and no command
sheet. Board-feet stay, because that is a property of the building rather than an estimate. A
classroom model that prints labor projections invites someone to hand a lesson to their CO.

## 2026-08-02 — Adding a window should be one click, and editing one should not delete them all

The openings editor put six controls on a line — a type popup and five bare number inputs —
under a header strip that only lined up with the first row. Four windows on a wall was twenty
anonymous numbers. The owner's note was "why are the adding things so confusing, should be
incredibly simple", which is the correct standard, so it was rebuilt around four rules:

- **Adding is one click.** `+ Door` `+ Window` `+ Vent` each place a real rough opening at the
  standard-design size the presets already use (a door is 3'-0" x 6'-8"), positioned in the
  middle of the widest clear stretch of that wall. Nothing has to be typed for the result to be
  correct, and a new opening never lands on top of an existing one — having the tool's first
  act be making a mess the user has to clean up is worse than not helping at all.
- **A placed opening reads as a sentence**, in feet and inches: "Door · 3' x 6'-8" · 12'-3" from
  left". No column headers to look up, no decimal feet to convert.
- **Editing is named fields**, one row unfolded at a time, and only the fields that apply — a
  door has no sill, so a door never shows a sill box.
- **Only the warning that can actually happen.** `normalizeSpec` already slides an opening back
  inside its wall and drops one too wide to fit, with a message each time, so a row warning
  about those would be decoration. Overlap is the one condition normalization deliberately does
  NOT fix (TD5 keeps opening order verbatim, and silently reordering someone's wall is worse),
  so overlap is what the row says out loud, naming the neighbour it collides with.

**And the bug the rewrite exposed.** `renderConfigPanel` wired its controls with
`panel.querySelectorAll('[data-path]')`. The openings editor's container is a `<div>` that also
carries `data-path`, to say which spec branch it edits. `change` bubbles — so committing a value
anywhere inside the openings editor re-entered the config handler with `el` bound to that div,
fell through to the final `setPath(spec, path, el.value)`, and wrote **undefined over
`stories.0.openings`**. Every door and window in the building disappeared the moment you
adjusted one of them: 741 members to 625, no error, no message. It had been shipping since the
panel was written; the old editor simply never re-rendered itself afterwards, so nothing on
screen contradicted the model and the deletion was only visible if you were counting members.
The selector is now `input[data-path], select[data-path]`.

Two smaller repairs came with it: the per-opening handlers re-read `current.spec` instead of
closing over `stories[0]` (which `regenerate()` replaces with the normalized copy on every
edit, so anything captured is one edit stale), and `dims.lengthFt` / `dims.widthFt` lost their
"engine envelope (multi-girder > 24 ft is IN-later)" hint, which was a note to ourselves printed
where a Marine reads what the limit means.

**The lesson:** an attribute that means "this element identifies a spec path" and a selector
that means "this element edits a spec path" are different claims, and using one attribute for
both let a container impersonate a control. Wire handlers to the tags that can actually hold a
value.

## 2026-08-02 — "What the heck are these boards on the roof?"

Driving the deployed build, the owner pointed at the roof of the GP building. It was covered
in wide tan boards. Four separate faults were stacked under that one question, and each was
invisible until the one above it was cleared — worth recording because the sequence is the
lesson, not any single fix.

1. **The plywood face texture was drawn at the wrong scale.** Twelve wavy grain lines across a
   canvas that maps to an 8-ft sheet is a dark stripe every eight inches with five inches of
   wobble. Rewritten with every dimension stated in inches of real sheet: half-inch grain, an
   eighth of an inch of wander, and the only high-contrast mark is a soft joint inset at the
   perimeter so a rank of 4x8s reads as panels. Knots and mineral streaks came OUT — one
   texture instance is shared by every sheet, so a recognisable shape repeats identically on
   all thirty-six roof panels and stops looking like wood.
2. **Roll roofing was being drawn as plywood.** `buildMemberMesh` routed `roofingCourse`
   through `plywoodSheet`, so five overlapping courses of mineral-surfaced asphalt came out as
   five overlapping tan boards. They now have their own material — granulated near-black for
   roll goods, ribbed galvanised for corrugated, tiled at the material's real width.
3. **Every roof tile was rotated with a spurious sign.** `-Math.sign(upSlope.z) * (PI/2 -
   pitch)` corrected the far slope a second time (its yaw is already PI, which does the
   mirroring) and tilted the near slope BACKWARDS: its courses ran downhill, sinking under the
   deck at their upper edge and lifting off it at their lower one. The deck striped through
   between them, which is what the tan bands actually were. Composing Ry(yaw)·Rx(rx) admits
   exactly one answer, `rx = +(PI/2 - pitch)`, and the derivation is now written at the
   placement helper so the next person does not re-guess it.
4. **The roofing did not know the deck was there.** C-9 keeps the gable's stage-9 deck in the
   frozen `roof.ts`, so `building.ts` passed `deck: 'none'` to the covering pass to avoid
   billing it twice — and `deckThick`, the term that lifts roofing over the deck, went to zero
   with it. The first course sat half an inch INSIDE the deck. `deckLaidElsewhere` now says
   "someone else placed this" without also claiming it is absent.

Two smaller things fell out of the same pass. Lapped courses were all placed at one lift, so
the shared six inches of every lap was two slabs in the same plane, z-fighting; each course now
rides on the ones beneath it. And the top course kept its full 36-in width past the ridge —
`Math.max(slopeLength, v0 + exposure)` — leaving nine inches of roofing standing in mid-air
above the peak, which is the stepped lip the aerial shots caught. It is cut at the ridge now.

Scene lighting was rebalanced in the same commit for a related reason: hemi 1.1 + ambient 0.55
+ sun 1.0 pinned every surface to the top band of the toon ramp, so a roof plane, a wall, and a
gable end came out the same value. The sun now carries the light and the fills only keep the
shaded sides off black.

**The lesson:** the owner reported ONE symptom and there were four causes, three of them in
code that had passed review and 366 green tests. Geometry that is never looked at is geometry
that is not checked — the sign error had been shipping since T2, and no test could see it
because no test renders. The numeric probe that found it (walk z across the slope, print which
surface is on top) is the cheap version of looking, and is worth reaching for before theorising.

## 2026-08-02 — Two sessions built T0 twice, and the second copy caught a real bug

This branch and `main` each executed TIMBER-2 T0 independently, so the repo briefly held two
snapshots of `generateFrame`: a 12-case set with a hashed option matrix (this branch, the
anchor `test/timber2-compat.test.ts` diffs the new engine against forever) and a 17-case set
with a sha256 manifest (`main`, which also byte-locks the goldens themselves against silent
edits). Merging them, the obvious move was to delete one. Both were kept instead, the first
renamed to `test/goldens/frame-compat/`, because on the very first joint run the second set
failed on two cases the first never covered — which is the entire argument for redundant
locks, made concretely.

**What it caught.** `negative-crawl` (crawlFt −0.5) and `slab-on-grade-crawl0` (crawlFt 0)
each gained **12 `4x4` posts**. Neither fixture names a foundation, so both are PIER
foundations. Pre-T1, `floor.ts` computed `postLen = sillBottom − gradeY`, and with a crawl
shallower than the built-up girder's 9 1/4 in of hang the length came out ≤ 0.1 ft, so the
`if (postLen > 0.1)` guard **skipped every post** — emitting twelve concrete pads and a
building resting on nothing. The guard existed to avoid a negative-length member and did its
job; what it did not do was tell anyone the foundation had vanished.

T1 routed `generateFrame` through `normalizeSpec`, which floors `foundation.crawlFt` at 1 ft
for exactly this reason (the bound is geometry — the girder's depth below the sill — and is
stated once, in `SPEC_PATH_DEFS`). The clamp raises a `clamped` issue the caller can surface,
so the number is corrected out loud rather than silently. Both goldens were regenerated in
this commit, which is the sanctioned path (deliberate change + a recorded reason); the kill
criterion K-F1 forbids regenerating to make red go green, not regenerating a change you can
explain. `slab-on-grade-crawl0` is misnamed and stays that way for now: it never set a
foundation, so it was always piers-with-zero-crawl, and renaming a fixture rewrites its sha
for no gain.

**The lesson, which is the same shape as the offline-gate entry above:** a guard that skips
work when its input is degenerate is not a check. `postLen > 0.1` and `dist/ not present —
pass` are the same failure wearing different clothes.

## 2026-08-02 — The offline gate was passing without checking anything

The first run of `.github/workflows/toolkit.yml` (TIMBER-2 T0) came back green on all
four check runs. Reading the logs rather than the badge showed one line worth the whole
exercise:

    > sap1@1.0.0 check:offline
    check-offline: dist/ not present yet — nothing to scan (pass).

`npm run verify` runs `check:offline` third, before `build:suite` has produced anything.
On a developer's machine that usually finds a stale `dist/` and prints "scanned 11
file(s)". On CI's fresh checkout there is no `dist/` at all, so the gate scanned **zero
files and reported a pass**. The offline guarantee — "ships offline, zero external
requests", one of this toolkit's load-bearing claims — was not being enforced anywhere in
CI, and the green badge said otherwise.

Fixed in three parts:

1. **`scripts/check-offline.ts` gained `--require-dist`**, under which "nothing to scan"
   is a hard failure. The lenient default survives for local ergonomics (`npm run verify`
   on a clean tree shouldn't demand a build first), but it now prints `SKIPPED — … this is
   not a pass` instead of the word "pass". Wording was the whole bug.
2. **The vacuum's second shape is closed too**: a `dist/` that exists but holds no
   scannable text files (empty, or all binary) used to report "scanned 0 file(s), zero
   external URLs" — the same no-op in a different hat. Also fatal under `--require-dist`.
3. **CI and `verify:full` run the strict form AFTER `build:suite`**, against the real
   artifact, as a separately named step so a failure points at itself.

`scripts/check-offline.ts` also gained `--dir=<path>` purely so the gate could be tested,
which it never had been. `test/gate-offline.test.ts` now pins six properties: strict mode
fails on both vacuum shapes; lenient mode says SKIPPED and never says PASS; a real
external URL and a protocol-relative host still fail with the offender named; and the W3C
`xmlns` allowlist still passes clean SVG. Without these, softening the strict path back
into a pass would be silent again.

The general lesson, recorded because it will recur: **a gate that cannot distinguish
"checked and clean" from "checked nothing" is not a gate.** Every gate this repo adds
should be asked what it prints when its subject is absent. T0's own acceptance criterion
was "CI runs and is green" — green was true and meant less than it appeared to.

## 2026-08-05 — A stringer that ran through the basement floor (a compat-lock event)

The visual-fidelity sweep rendered the basement foundation, which nobody had ever actually
looked at: until the ground stopped being an opaque slab you could not orbit under, the whole
basement was on the far side of it. Measured against the model's own `slabTop`, the stair
stringers reached **6.6 inches below the basement floor** — through a four-inch slab and into
the earth beneath it.

**Two mistakes compounded, and each hid the other.**

The length came from `hypot(runFt, totalRiseFt)`. A flight always has one more riser than
treads — the top nosing IS the floor above — so `runFt` counts TREADS unit runs while
`totalRiseFt` counts RISERS unit rises. Those two numbers describe a line at a different pitch
than `beta`, the pitch the board is actually rotated to. Length and angle disagreed by about
two degrees and nothing downstream could notice.

The board was then dropped half its depth square to the run. That is right at the TOP, where
the first nosing is the floor itself, and wrong at the bottom, where a stringer is cut level
and sits ON the slab.

**The fix places the board off its two real ends instead of off a formula:** the axis length
that puts the lower corner on the slab while the upper corner stays at the floor above. Both
errors go away together because neither end is now derived from a length that was never the
board's length.

**This is a compat-lock event, taken deliberately.** `floor.ts` is the frozen legacy branch;
both golden sets moved with this commit. The blast radius is exactly what it should be —
`FL-stringer-01/02/03` in `frame/basement-stairs` and `frame-compat/demo-basement`, three
members, nothing added and nothing removed. Every other case in the 72-row matrix is unchanged,
because no other foundation builds a stair.

**The test was pinning the bug.** `timber-features` asserted the stringer length equalled
`hypot(runFt, totalRiseFt)` — it checked that the code computed what the code computed. It now
asserts the physical claim instead: the lowest corner sits on the slab and the highest reaches
the floor above, which is true of any correct stringer at any pitch. A test that restates a
formula cannot fail when the formula is wrong.

## 2026-08-05 — The bird's mouth, and the roof plane that had to move to make room for it (a compat-lock event)

`roof.ts` carried this line at the top, and had since the first commit:

> ponytail: bird's-mouth seat geometry is carried as angles on the member (plumb/seat cuts)
> but not notched in scene geometry, exactly as the design doc §6 prescribes.

Every rafter in the catalog declared `angles: { plumbCut, seatCut }`. Nothing ever cut them. A
rafter was a straight stick laid at pitch ACROSS the cap plate, **2.9 inches of it inside the
plate** at every bearing on every roof — and the plate is only 1.5 inches thick, so the rafter
went through it and out the other side. Scrub to any framing stage and the rafters crossed the
plates as though the plates were not there.

**Cutting the notch turned out to be the second half of the problem, not the first.**

The notch is derived, not stored: `birdsMouth.ts` takes the rafter and the plate it crosses and
solves the member's own frame for the two cuts a framing square gives you. That is a pure
module, adds nothing to the model, and moves no golden. But the first honest notch came out
**56% of the rafter's face** — past the third of the depth a bending member may lose at its
bearing, and a shape no framer would recognise. The geometry was right; what it was measuring
was wrong.

**The engine put the rafter's CENTRE LINE on the plate's outer top corner.** That is not a
framing convention, it is a modelling shortcut — it sinks the rafter half its own depth into the
wall and calls the result seated. A real rafter's elevation is set by the seat: the seat is one
plate wide, the heel is however deep the pitch makes it over that length, and the rafter's height
above the plate follows.

    plumb depth of the rafter     = face / cos θ
    plumb depth the notch eats    = plateWidth · tan θ
    HAP (height above plate)      = the difference

For a 2x6 at 4/12 on a 2x4 plate that is **1¾ inches** of missing elevation. `rafterSeatLiftFt`
states it once; `roof.ts` (frozen), `roofPlanes`, `generateShed`, `generateHip` and
`wallInfillProfiles` all read it, so the framing, the deck, the roofing and the siding that
closes in under the rake cannot drift apart. The notch is now 20% of the face and the seat is
exactly one plate wide, in every shipped family, on both slopes.

**Two things fell out that were wrong on their own terms.**

The collar tie was placed `ridgeY - (ridgeY - H)/3` — one third down from the ridge measured off
the PLATE — while its half-length `halfSpan/3` was derived from the RAFTER line. Those are the
same number only when the rafter line starts at the plate, which it never should have. It reads
off `eaveDatum` now, and the tie's ends land on the rafters they are nailed to.

The heel was being cut **square across the board** rather than plumb. A plumb line is not a line
of constant local x on a pitched member, and cutting it that way leans the face out of the plate
and eats 1/cos²θ more rafter than the joint needs. The apex is solved as the one point on both
world planes at once — the plate's top and its outer face — which is a rotation and inverts in
closed form with no case analysis for the slope's sign.

**Blast radius, both golden sets:** 1024 lines in the compat matrix, **nothing added and nothing
removed**. Every changed member is a rafter, ridge, roof panel, collar tie or gable stud, and
every delta is either the lift or exactly half of it — half for the gable studs, whose base stays
on the plate while their top follows the rake. A pure vertical translation of the roof plane is
what this should look like, and it is what it looks like.

**Two tests were pinning the old datum** by re-deriving the roof plane from `wallHeightFt`. They
assert real relationships — the ridge top is flush with the rafter tops, the sheathing sits on the
rafter plane along its normal — so they now read the datum from the same rule the engine does
instead of restating an elevation. A test that recomputes the thing it is checking cannot fail
when the thing is wrong.

## 2026-08-07 — Work that was finished but never merged, and the bridging it brought back (a compat-lock event)

Five branches were editing this repository and only one of them was reaching the deployed app.
`main` builds the Replit autoscale deployment, so anything not merged into `main` is, from the
user's side, work that does not exist. An audit of every branch against `main` found:

- **`claude/woodframe-model-improvements-stogju` — 100 commits, none of them merged.** PR #10
  was *squash*-merged on 08-03, which left `main` with the squashed content but none of the
  branch's history as an ancestor. The branch was then rebased onto the new `main` and kept
  going for another five days: the TIMBER-2 model-fidelity sweep, the 1371 LEARNING trainer
  (`src/timber/train/`, `src/ui/learn/`), and the command-packet document
  (`src/timber/packet/`). Because the merge-base was `main`'s own head, this fast-forwards —
  there was never a conflict to resolve, only a merge nobody had performed.
- **`claude/basement-stair-bracing-s9cnbl` — one commit, orphaned.** See below.
- **`claude/survivability-app-audit-h0yyt9` — one commit past PR #9.** Recorded separately.
- **`claude/project-description-bbzjvj` — superseded.** Its 1371 rebrand routed the suite through
  an `src/ui/survivability.html` shim; PR #2 reached the same place by a better road
  (`scripts/build-suite.mjs` assembles SAP-2 into `dist/survivability/`). Nothing to port.
- **`renders`** — Blender stills and a flyover for an LED house, a different project's artifacts.
  Not app code and deliberately left where it is.

**The bridging fix, recovered.** `claude/basement-stair-bracing-s9cnbl` fixed a real defect and
was never merged: bridging rows were laid out by walking the *nominal joist layout grid*, but the
stair opening edits that layout after the fact — it suppresses grid positions near each opening
face, adds doubled trimmers just outside them, and cuts the joists it crosses down to tails that
stop at a header. The grid walk could see none of that. In the shipped demo basement it emitted
**eight 31 3/16-inch cross braces centred on x = 6'-8" and x = 16'-0"** — the two stairwell
trimmer lines, whose plies sit at 6.231/6.356 and 16.063/16.188 — so each stick ran from the last
field joist, straight through both plies, and out into the tail-joist field beyond. Geometry that
cannot be built, on a cut list that told a crew to build it.

Bays are now derived from the runs **actually emitted at stage 3** — joists, tail joists and
trimmers all register themselves as they are placed — so a change to the framing moves the bay
boundaries and the bridging follows by construction. Two questions the old code conflated are now
separate: whether a run is physically present at the row line (which makes it a bay boundary
bridging can never jump), and whether the row lands inside one of that run's own span segments
and that segment is long enough to want a row. Measuring the second one per-run also retires the
building-wide `W / 2 >= 7.5` gate, so the short tail joists hung between a header and the near
wall no longer collect a line of blocking a couple of inches off their header.

**This is a compat-lock event, taken deliberately.** Both golden sets moved, and the blast radius
is exactly what a stairwell-only fix should produce: `frame/basement-stairs` and
`frame-compat/demo-basement` and nothing else — every other case in the 72-row matrix is
unchanged, because no other foundation builds a stair. The demo basement goes from 52 bridging
members to 46, the longest stick from 31 3/16 in to 19 3/8 in, and the pieces that die against
the trimmers now carry a doctrine note saying they are cut to the stairwell rather than field
bridging, so the short cut explains itself on the card.

**The recovered test was pinning a building the engine no longer makes.** Its stairwell-void
check asked `stairPlan` for the opening using the *raw* input width. TIMBER-2 has since bounded
`dims.widthFt` to 4–24 ft (`spec.ts` — a wider span needs a second girder line, which is not
built yet), so the matrix's 32-ft row is clamped to 24 and its stair sits four feet from where
the unclamped math puts it: the check was looking for bridging in an empty band. It now reads the
opening back off the doubled trimmers and headers the model actually framed. A test that derives
its expectation from an input the engine discarded cannot fail when the engine is wrong.

## 2026-08-07 — Four nailing schedules that were corrected once and never shipped (a compat-lock event)

The same branch audit turned up one commit sitting past PR #9 on
`claude/survivability-app-audit-h0yyt9`: a wood-frame values pass carrying owner direction that
TIMBER may ship loaded values so long as there is a way to get at them and type them in. It did
two things, and only one of them still applies.

**What no longer applies.** Its `src/timber/data.ts` centralized 31 fastening specs, three labor
rates and the lumber grade into one editable table, because at the time those values were inline
string literals across `floor.ts` / `walls.ts` / `roof.ts` and the only way to change a nailing
schedule was to edit TypeScript. TIMBER-2 has since built its own values layer — `doctrine.ts`
with `doc(value, cite)`, `spans.ts`, `fasteners.ts` — so importing a second, parallel table would
put two sources of truth in a tree whose whole discipline is that there is one. **It is not
ported, and the requirement it was answering is still open**: nailing schedules remain inline
literals with no editor behind them. `doctrine.ts` is where they belong when someone builds it.

**What still applies.** Four of those specs were not merely uncentralized, they were wrong, and
all four survived into the shipped engine. Three have live emission sites and are corrected here:

| Spec | Was | Now | Why |
|---|---|---|---|
| cap plate, at laps | `2-16d at laps` | `8-16d in the lap, joints offset 24" min` | The lap **is** the splice — it carries the plate in tension. Two nails does not. |
| collar tie to rafter | `4-8d ea end` | `3-10d face nail ea end` | Collar ties resist ridge separation and are specified as a 10d connection. |
| sill anchorage | `1/2" anchor bolts @ ~6 ft` | adds `min 2 per plate, within 12" of each end` | The end distance and the two-per-piece minimum are the parts that actually get missed. |

The fourth — a 16d ceiling-joist toenail, which splits the plate where the schedule calls for 8d
— **has no live site**: this engine emits no `ceilingJoist` member at all. Nothing to correct, and
correcting it in a table nobody reads would have looked like progress.

**The `(PH)` marker comes off these three, and that is the point.** `(PH)` means *pending page
verification*, and it had been flattening two different situations into one shrug: specs that
need somebody to open a manual, and specs anyone can check against a published fastening
schedule. Each corrected string now names its own source — IRC Table R602.3(1), R802.3.1,
R403.1.6 — which is checkable by a reader who has never seen this repository. No page numbers
were invented, and no FM 5-426 citation was overwritten: `doctrineRef` still carries the
dimensional doctrine (collar tie every third rafter, ≤ 5 ft) untouched.

**Blast radius, both golden sets: 114 members, `nailing` the only field that moved, nothing added
and nothing removed.** Exactly four roles — capPlate (48), collarTie (50), foundationWall (8),
sill (8). No geometry shifted, which is what a schedule correction should look like.

**The hardware bill follows, and was checked rather than assumed.** `fasteners.ts` reads these
strings to bill nails by the pound, so a reworded schedule can silently fall out of the takeoff
into the `unparsed` list. All four were run through `fastenersForMember` before the goldens were
touched: the cap plate goes from 10 to 14 16d on a 96-inch run (the lap billed once at 8, not
twice at 2), the collar tie from 8 8d to 6 10d, and the sill bolts still bill one drift each. The
phrasing is deliberate on one of them — "in the lap" rather than "in the lapped area", because
the tail rule reads `ea\b` and *area* ends in one, which would have doubled the lap to 16 nails.

## 2026-08-07 — The stop-the-line gate that had never once stopped the line

Consolidating the unmerged branches meant reading CI properly, and the "legacy timber suites are
immutable" step turns out to have been reporting success without checking anything — for its
entire life.

**How it failed.** `actions/checkout@v4` clones at depth 1. The step then fetched the base branch
with `--depth=1` and asked for `git merge-base HEAD FETCH_HEAD`; two shallow histories share no
commit, so there is no merge base, so `BASE` came back empty. The whole comparison sat inside
`if [ -n "$BASE" ]`, and the line after it — `echo "legacy timber suites untouched"` — was
unconditional. The run log for `2005e06` says it plainly:

    * branch            main       -> FETCH_HEAD
    legacy timber suites untouched

That commit's range edits **both** `test/timber-features.test.ts` and `test/timber-frame.test.ts`.
The step went green anyway, and every commit on the branch since has been merged past it. This is
the same failure the offline gate had on 2026-08-02, in the same repository, three days later: a
gate that cannot distinguish *checked and clean* from *checked nothing*. Depth is now `0` and an
unresolvable base is a hard failure, so the check can never again go quiet.

**And the rule it was guarding needed to change, not just start running.** Turning the old check
on as written would have stopped three commits that are all correct: the stringer through the
basement slab, the bird's mouth that moved the roof plane (both 2026-08-05), and the bridging
through the stairwell trimmers (above). Every one of them replaced an assertion that pinned a
**bug** — `hypot(runFt, totalRiseFt)` for a stringer, a roof datum measured off the plate top —
with one that states the physical claim instead. That edit cannot be made from another file: the
old assertion does not become true because a new test exists elsewhere, it just fails.

Plan I-8 / TD31 wrote the acceptance as "git diff empty on `test/timber-*.test.ts`", full stop,
and that holds exactly as long as the legacy engine's output never legitimately changes. Three
compat-lock events say otherwise. **So the rule is no longer "never" — it is "never silently."**
A legacy-suite edit is accepted only when the same range also moves `test/goldens/frame-compat/`
(the actual contract, plan §9 K2) *and* records the reason in `DECISIONS.md`. An edit on its own
— a deleted assertion, a loosened tolerance, anything with no engine change under it — still
stops the line, which is the abuse the gate existed to catch.

Both paths were exercised against real commit ranges before this shipped: the consolidated branch
is accepted (suites edited, 13 golden files moved, entry written), and the bridging cherry-pick on
its own, before its goldens and its entry existed, is refused.

## 2026-08-08 — The nailing schedules get a cited home, and why that is only half the requirement

The 2026-08-07 entry above closed three wrong nailing schedules and left the requirement behind
them open: *TIMBER may ship loaded values so long as there is a way to get at them and type them
in.* The schedules were still inline string literals across `floor.ts` / `walls.ts` / `roof.ts`,
with no single place to read them and nothing watching them. `doctrine.ts` is where that entry
said they belong. They are there now — `NAILING`, 28 entries, each with a citation and a `ph`
flag, wired into `allDoctrineEntries()` like every other table.

**Mirrored, not moved.** The obvious reading of "centralize" is to delete the literals and have
the generators read the table. That is precisely what C-10 forbids: `floor.ts` / `walls.ts` /
`roof.ts` are the frozen branch, editing them is a stop-the-line event, and rerouting 28 emission
sites through a new import would move the compat goldens for no behavioural reason — a
compat-lock event whose entire content is "we moved some strings." So this follows the discipline
`doctrine.ts` already documents for sizes and labor rates: the generators keep their literals, the
values are mirrored, and a test watches the mirror. Nothing in `src/timber/{floor,walls,roof}.ts`
changed, and no golden moved.

**The set was enumerated, not grepped.** Reading `nailing:` out of the three modules finds 35
sites; running every fixture in `FULL_FIXTURES` + `MATRIX_FIXTURES` through `generateFrame` and
collecting what actually comes out finds 28 distinct strings — and two of them do not appear in
that grep at all: a second sill-anchor variant that differs from the `foundationWall` one by the
words `into sill,`, and `anchor/drift per post cap` on a pier-founded sill. A mirror built from
reading the source would have been wrong on arrival, in the direction that matters least visibly.

**Both directions are asserted**, because each failure is real and they are not the same failure.
An emitted schedule with no entry is a value with no cited home — the thing the requirement is
about. An entry nothing emits is a citation for work no crew is ever told to do, which is worse
than no citation, because it reads as coverage. A second test pins `ph` to the literal `(PH)` in
the string, so the register can never report a schedule as verified while the member card still
prints it as pending. Both were mutation-tested before shipping — drift one mirrored value and
test 10 fails naming the orphaned string and its roles; claim `ph: false` on a string that still
prints `(PH)` and test 11 fails. This repo has shipped two gates that could not fail (the offline
gate, 2026-08-02; the legacy-suite gate, 2026-08-07), and a third would be a pattern.

**Deliberately not life-safety tagged.** A fastening schedule's failure mode is an overload, so
LS-GATE arguably reaches it. But `lifeSafetyRegister()` is not a label — `test/timber2-packet.test.ts`
asserts every id it carries appears in `LS_CONSUMERS`, i.e. that something actually surfaces the
value to a user. Deciding how a nailing spec surfaces in the command packet is a design call about
the packet, not a consequence of mirroring, and tagging without building the consumer would only
break that gate. Left untagged, recorded here as the open follow-up.

**What is still open, and why it is not a small job.** The requirement asks for two things and
this is one of them: the values now have a home you can read. There is still no way to *type them
in*. The instinct is to copy SAP-1's `exportDoctrine` / `importDoctrine` (`src/doctrine/io.ts`),
which solves exactly this problem one tree over — but it does not transfer, and the reason is the
mirror above. An imported value would land in `doctrine.ts` and change nothing the crew reads,
because the generators hold their own copies; the test would then fail, correctly, reporting that
the mirror drifted. Making the values genuinely editable means the frozen modules have to stop
being the source of truth, which is a C-10 decision and a compat-lock event on every fixture, not
an afternoon's plumbing. That is the shape of the remaining work, written down so the next person
does not start with the import and discover this halfway.

## 2026-08-11 — Two goldens moved for two different reasons (a compat-lock event)

Both regenerations belong to the same rules pass and have nothing else in common, so they are
recorded separately. Neither is a rubber stamp: in both sets the diff was read line by line, and
what moved is exactly what the rule change says should move.

**1. Collar ties at 24 in o.c. — `test/goldens/frame/spacing-24.json` and
`test/goldens/frame-compat/spacing-24.json` (221 → 222 members, 241 → 242).** The generator
placed a tie on *every third rafter*, which is a 4-ft interval only on the layout it was written
for. At 24 in the same step is 6 ft — past the 4 ft the tie's own nailing schedule cites
(IRC R802.3.1) and past the ≤ 5 ft the member's own `doctrineRef` claimed while standing 6 ft
apart. The step is now derived from the rafter spacing and that limit, so the 24-in fixture gains
one tie (3 → 4 on that ridge, the run closing from 6 ft to 4 ft) and its ties carry a reference
that states the interval they are actually holding. **Nothing else in either file moved**: the
16-in fixtures are byte-identical, because three 16-in bays already were 4 ft. The value is
mirrored as `LAYOUT.collarTieMaxSpacingFt` — `roof.ts` is the frozen branch and keeps its own
literal — and `test/timber2-roofs.test.ts` now holds the two in lockstep in BOTH directions:
lowering the doctrine figure fails on the emitted geometry, and raising it fails on the number the
member card prints.

**2. Four thumbnails, sub-pixel — `crib-bunker{,.solid}.svg`, `tower{,.solid}.svg`.** A TIMBER
dresses 1/2 in on every face; only DIMENSION lumber takes the 3/4-in deduction at an 8-in face.
`DRESSED` had the dimension-lumber figure on its two timber rows, so 6x8 and 8x8 were modelled
1/4 in shallow — the bunker's crib logs, its cap beams, the overhead stringers and the tower's
mudsill, which are the LS-tagged members in that table. Correcting them moves every drawn edge of
those two cards by a fraction of a pixel (76.3 → 76.2 and the like) and moves no other card,
because no other family cuts from those sizes.

**And the bill moved with it, which the first write-up got backwards.** Board feet are rate ×
length. The RATE is nominal — a stick of 8x8 is bought as 8x8 however it surfaces — but the
LENGTHS are not: anything cut to fit *between* two members is cut to their dressed faces. Each
block of the crib bunker's overhead blocking now comes out 1.213 ft between 7 1/2-in stringers
instead of 1.236 ft between 7 1/4-in ones — **14.556 in** on that cut-list line instead of
**14.833 in**, both of them inches, all 18 blocks —
and the bunker's board-foot total goes **2546.167 → 2543.944 BF**. A dressed size is a
geometry number that reaches the BOM through the cut list, and `test/timber2-dressed.test.ts` pins
that blocking cut to the deduction rule rather than to a literal, so the coupling cannot be
quietly broken in either direction.

## 2026-08-11 — A hip's bird's mouth is not measured, and the packet no longer says it is

The seat-depth limit (`NOTCH.rafterSeatMaxDepthFrac`, life-safety) is checked on every member
`birdsMouth.ts` actually seats. That is commons **and jacks**: a jack rafter runs square to the
same cap plate at the same pitch and takes the identical `plateWidth · tan θ` notch, differing
only in length — a hip roof at 12/12 puts 56 of them alongside its 44 commons, and a role filter
was leaving every one unnotched in the viewer and unmeasured by the check.

**A HIP IS A DIFFERENT CUT AND IS STILL NOT MEASURED.** It crosses the corner at 45° on its own
shallower pitch, and its seat is a double cheek over two plates at once — geometry this module
does not derive, which `runAxisOf` reports honestly by returning null rather than inventing a
notch. So `LS_CONSUMERS` no longer lists `hipRafter` for that limit. The consequence is deliberate
and worth stating plainly: **a tower cab's packet no longer prints "Bird's-mouth seat depth limit
— REVIEW REQUIRED"**, because the cab has four hip rafters and nothing else, and that row was an
assurance nobody had produced — a life-safety line naming members the check never examined. Losing
a row that meant nothing is not the same as losing coverage, but it is not coverage either.

**The open item, so the next person does not have to rediscover the geometry.** Measured by hand
on gp-frame at 12/12, the hip's seat takes about 28% of a 2x6 where the commons take 45%, so
nothing shipped is over the limit today — the case is not urgent, it is unwatched. Deriving it
means solving the same two cuts in the hip's own vertical plane with the traverse taken across the
corner (a plate width of W is crossed over W√2 along the diagonal), and it would put a notch on the
hips in the 3D viewer as well. When it is derived, `hipRafter` goes back on that register line.

**Read this entry against D42, which changed how the same conclusion is expressed.** The
resolution above is stated as pure omission — the role dropped off the register line, the row gone
from a tower cab's packet — and that is no longer the whole of it. Dropping a role says nothing to
the next reader, who cannot tell a judgment from an oversight; the hip is now DECLARED unmeasurable
with its reason, so on a roof that also has commons and jacks the row does print, earned by them,
with `NOT EXAMINED: …no hip rafter in this build was measured` beside it on the page and in the
CSV. The geometry, the open item and the promise in the paragraph above are unchanged.

## 2026-08-11 — A hip roof's longest members are now the ones that get measured

`SPAN.rafter` is life-safety and its consumer line has always named three roles —
`rafter`, `jackRafter`, `hipRafter`. `spans.ts` measured one of them. The other two fell through
every branch of the checker and produced nothing, so the packet printed **"Rafter span limit"** as
a governing value for a check that had examined a minority of the roof.

**It is the wrong minority, which is what makes it a fail-open rather than a gap.** On a hip roof
the commons are the SHORTEST sloping members: a jack is a common cut back to the hip, and the hip
itself runs the corner diagonal. Measured on gp-frame at `dims.widthFt` 24 (that panel row's own
maximum) with `roof {kind:'hip', risePer12:12}` and the default 16-in spacing — two clicks on
controls the card advertises — the build emits 38 commons, 64 jacks and 4 hips, every one of them
2x6. The 38 commons warned at 13.0 ft against a 12 ft row. The 4 hips run **18.385 ft** and said
nothing.

**The run comes off the member's rotation, not its `angles` block.** `angles` is a cut-list
annotation: `roofFamilies.ts` states it on commons and omits it on jacks and hips, and the tower
cab's shed rafters omit it too. A missing one read as zero pitch, i.e. the SLOPED length taken for
the run — so widening the role filter alone would have reported a 12/12 hip at 22.517 ft instead
of 18.385 and cried wolf on every hip roof in the catalog. Rotation is the geometry the viewer
draws, every pitched member carries it, and on every emitter that states both they agree.

**The hip is read against the common-rafter table, and its message says so.** There is no hip
table here and inventing one would be a fabricated magnitude. What the common row does support is
one direction of the inference, and it is the safe one: a hip carries its own strip of roof PLUS
the end of every jack landing on it from both slopes, so a run the common row already refuses is a
run the hip cannot make either. The hip's warning therefore says the table figure is *a floor it
is already under, not a rating for it*, and names the diagonal. A jack gets the plain common
wording, because a jack genuinely is a common on the same table at the same spacing.

**Consequences, stated rather than discovered later.** Hip presets that were silent now warn: the
shipped gp-frame at `roof.kind='hip'` (a card-advertised choice) reports its four hips at 15.56 ft
against a 12 ft row. No shipped *preset* moved — `test/timber2-spans.test.ts`'s "no shipped
standard design condemns itself" still passes — and no golden moved, because span findings are
issues, not members. The tower cab's four hips are inside their row and stay quiet; the test proves
they were nevertheless *examined*, by handing the checker that same emitted hip at four times its
length and requiring a warning.

**The NOTCH narrowing was re-checked against this and still holds.** The seat-depth limit is a
different derivation: `runAxisOf` returns null for a hip because a hip is yawed 45° to both axes,
and its seat is a double cheek over two plates at once. Giving the span check a pitch does not give
the notch module a traverse. `LS_CONSUMERS['NOTCH.rafterSeatMaxDepthFrac']` therefore still lists
commons and jacks only, and the open item recorded above is unchanged.

## 2026-08-11 — The workbench issues strip went quiet on the edits that needed it

Disclosing a regression introduced by the previous entry's own fix, and closing it.

`regenerate()` had become `const { spec } = normalizeSpec(current.spec); current.spec = spec;
model = generateStructure(spec)`. The normalizer is **idempotent**: it reports a repair on the pass
that makes it and has nothing to say on the next. Repairing the spec first and handing the repaired
copy on therefore left the build pass with nothing to report, and the strip was fed from that
second, silent pass.

Measured: open the standard gp-frame (clean, no messages), then take `dims.lengthFt` to 8 on the
panel. All eight of that card's openings are now past the end of the wall they are on;
`normalizeSpec` relocates every one and says so in eight messages ("Opening at 6 ft would run past
the end of wall S; moved to 5 ft.", four on S and four on N). The strip showed none of them. The
operator shortened the building, the tool moved four doors and four windows, and said nothing —
the silent-correction failure mandate #2 exists to forbid. It appeared only on load, because the
open path generated from the raw stored spec.

The order is now a named step, `src/ui/woodframe/regen.ts`: build from the spec as the operator
left it, then take the repaired spec back OUT of the model (`StructureModel.spec` is the normalized
one). One normalize pass, one report, no double-reporting, and the boot file no longer runs the
normalizer at all — which the test asserts, alongside the eight messages themselves and the fact
that a second pass over the repaired spec is silent, since that idempotency is the whole reason the
order matters.

## 2026-08-11 — The nailing-schedule walk now moves two controls, because one was not enough

`test/timber2-doctrine.test.ts` swept the catalog cards and their panels one control at a time.
That corpus missed a member a user reaches in two clicks: the **purlin**. Every family whose deck
offers purlins presets to a gable, and the frozen gable branch lays a solid deck (C-9) — so
roof-kind variation and covering variation are each individually inert, and it takes
`roof.kind=hip` AND `coverings.roofDeck=purlins` together, both options the card advertises and the
panel's own help text points at ("Purlins come with the other roof shapes"), to put 26 purlins on a
roof. Their schedule `'2-16d each rafter (PH)'` had no cited home while the test's title claimed
every schedule did.

The walk now includes every PAIR of panel rows, in both orders, with each row's `applies`
predicate honoured against the spec as it stands when that row is reached — which is what makes
the purlins option appear at all, and which is exactly what the panel would have shown. Numeric
rows are taken at both clamp ends and the middle. Deduplicated by spec (most pairs land on a build
some other pair already produced) it is 8,799 builds and about 9 s; the walk is computed once and
read by four tests. It finds 100 distinct schedules, all of them cited.

`NAILING.purlinAtRafters` is the new home — `'2-16d ea rafter (PH)'`, in the house's `ea` spelling
rather than the emitted `each`, which the twins test could not see either because the string had no
entry to be a twin of. A companion test asserts the purlin's schedule is reachable ONLY through a
pair, so narrowing the corpus back to one control at a time is a red test rather than a silent
regrowth of the same gap.

The title now says what the corpus does: *"…a card and its panel can emit with one or two controls
moved"*. Three controls is not claimed and is not walked.

## 2026-08-11 — The collar-tie card, and a third golden regeneration (a compat-lock event)

**What moved and why.** `roof.ts` printed two different `doctrineRef`s on the same member. The
24-in branch stated the interval it was holding; the 16-in branch — the default layout of most of
the catalog — still read `'FM 5-426: collar tie every 3rd rafter / ≤5 ft (PH page)'`. The **≤5 ft**
is a figure nothing in this engine enforces and nothing in the register holds:
`LAYOUT.collarTieMaxSpacingFt` is 4 ft. "Every 3rd rafter" is likewise the 4-ft rule written for
the 16-in layout it was written on, not the rule.

Both branches now print one sentence built from the same two numbers — the interval the ties are
actually on, and the distance that chose it: *"FM 5-426 collar ties, every 3rd rafter so the run
stays within 4 ft at 16 in o.c. (IRC R802.3.1 — PH page)"*. `roof.ts` is the frozen branch and
keeps its literal; the mirror is asserted at BOTH layouts now, not only at 24 in.

**And the card now admits the page is owed.** `LAYOUT.collarTieMaxSpacingFt` is `ph: true`
deliberately — the section is named and the figure is the recognized one, but naming a section is
not reading it. The 24-in card printed `(IRC R802.3.1)` with no marker, which told a crew the
sourcing was settled while the register said it was not. Both cards now carry `— PH page`, and the
test asserts the marker and the flag as an EQUALITY on every layout: a card that drops the marker
and a register that claims the page both fail it, from opposite directions. The previous version of
that test carried an `if (!pendingOnACard) return;` escape and would have gone vacuous the moment
this was fixed.

**The goldens.** `scripts/gen-frame-goldens.ts` and `npm run gen:compat-goldens` were re-run in
this change, per `test/frame-goldens.test.ts`'s stated obligation. **Every changed line in
`test/goldens/frame/**` and `test/goldens/frame-compat/**` is a collar-tie `doctrineRef` string,
plus the manifest/index hashes that cover them** — verified by diffing with those two patterns
excluded, which leaves nothing. No member was added, removed or moved: member counts and every
geometric field are byte-identical, because only the printed reference changed.

## 2026-08-11 — One roof, one platform, one sump: the rules and the drawings stop disagreeing

The doctrine tables are the single source the geometry model and every 2D/3D drawing derive
from — and several physical quantities were reaching the bill, the section and the 3D model
with different meanings, so the drawings and the quantities disagreed about the same position.
Measured at 114c8cf, before anything below: the two-man fixture billed a 9.00 × 4.00 ft roof
slab, the 3D model drew 9.00 × 4.25 with its front edge 2.25 ft in FRONT of the hole, and the
2D section drew the same edge INSET over the hole. Three footprints, one roof.

### The roof: one signed convention, three views

**Direction.** The overhead-cover setback is measured FROM THE HOLE EDGE OUTWARD to where the
supports begin (`docs/ONE_MAN_POSITION_MODELING_SPEC.md` §2.b/§2.f; `docs/REALISM_PASS_3D_PLAN.md`
requires the stringer ends to bear on undisturbed ground, which an inward inset cannot do). So
the 3D model had the direction right and `drawSection.ts` was the defect. Every roof extent is
now an OUTWARD extension, `>= 0` by construction, and the engine additionally publishes
ABSOLUTE edge coordinates in the section's own frame (`frontEdgeFt`, `rearEdgeFt`,
`endEdgeFt`) — a coordinate cannot be sign-flipped by accident the way an offset can. Both
renderers stopped doing arithmetic on the setback. The convention is documented on the TYPE
(`GeometryModel.RoofModel`), which is the only place a renderer author reliably reads.

**Stages, not alternatives.** The supports stand back from the lip by the setback; the
stringers are then laid across them overhanging `bearingEachEnd` PAST each support. Those are
two sequential stages of one assembly, so the deck edge is `setback + bearing`. The old model
took `max()` of them on the rear — the arithmetic of alternatives — and substituted a bearing
leaf for the setback's own threat-scaled floor. Measured at HEAD: one_man / 155 mm /
deliberate gave the front 2.000 ft and the rear 1.000 ft. Same roof, same munition, two
supports, the rear one held to half the standoff the front had to clear. Front and rear are
now the same number, because the rule is orientation-blind: a rear support is a support.

**C23 is corrected, not implemented.** The audit filed `rearOverhang`'s use of
`setbackDepthFrac` as reuse of a standoff leaf for a bearing dimension, citing the spec's
warning at §18. That warning is against reusing the 1-ft/quarter-cut figure for the FRONTAL-BERM
standoff — a quantity this engine never computes. `setbackDepthFrac` IS the quarter-cut half of
the OHC-support setback rule, and a rear OHC support is exactly what that rule governs, so the
fraction belonged there. The real defect was the other prong and the `max()`. The front is not
a conflation either: `standoffMinFor()` falls back to `overhead.setbackMin`, so the munition's
standoff and the global minimum are one quantity at two granularities.

**The ends take neither stage.** No stringer end lands on a flank, so neither the setback nor
the bearing applies there, and nothing in the corpus gives a figure for how far the deck laps
onto the flank parapet. New leaf `overhead.endLap`, PLACEHOLDER, seeded at 1.0 ft **because
that is what the app already drew and billed there** — the ends do not move. The 3D used to
reuse the REAR bearing figure on the end walls, which is why its ends already disagreed with
the BOM wherever a quarter-cut exceeded a foot (bunker 1.625 vs 1.000).

**The roofed position is no longer roofed shut.** `REALISM_PASS_3D_PLAN.md` R10 is real —
measured, the bunker's 3D roof overhung its rear wall by 1.625 ft across a 3.0 ft entrance. But
R10's stated fix (stop the rear edge at the wall, shorten the stringers) contradicts its own
acceptance criterion once the stringers run front-to-back: every one becomes a cantilever off
the front support. Resolved as a NOTCH IN THE DECK ONLY: the earth cover is omitted across the
entrance passage so the corridor opens to the sky, and the stringers keep their full rear
bearing. You duck under a beam to walk in; you do not climb over a roof.

**Span axis.** ATP 5-261 as transcribed at §2.b gives 3 supports, 2 front and 1 rear — supports
lying along the frontage — so the stringers cross FRONT-TO-BACK and are laid out ACROSS the
frontage. `min(holeL, holeW)` coincided with that everywhere except `one_man` (2.5 ft frontage
/ 4.0 ft front-to-back), where it rotated the roof 90° against the support layout. Clear span
is now `holeW`; measured, the only position that moves is one_man, 2.500 → 4.000 ft, and its
size stays 4×4 — but it now sits EXACTLY on `spanSizes[0].maxSpan`, so any fill that lowers
that leaf flips it to 6×6. That is a fail-safe fact, recorded here rather than discovered.
The vehicle access ramp keeps its own axis (`rampWidth = min(L, W)`) so the two cannot drift
into each other; measured, no vehicle number moves.

**Stringers are counted over the deck they hold up**, not the bare hole: at HEAD every position
billed a slab 2.0 ft wider than the stringer field under it.

### The firing platform is a CUT that is not made

`ONE_MAN_POSITION_MODELING_SPEC.md` §2.f is direct: leave the firing-platform / elbow-shelf of
undisturbed original earth — "this is a CUT, not a build". Both renderers had always drawn it
that way; `compute` added `L × W × depthBelowHole` to the excavation, which is the opposite.
The leaf is renamed `riseAboveFloor` because the defect WAS a name that stated neither datum
nor direction ("below" WHAT surface?), and three consumers read it three ways. The excavation
now subtracts it, and the trace says so instead of hiding it inside one `excavBank` operand.

The magnitude is untouched and stays PLACEHOLDER: §18 states flatly that no doctrinal
firing-step height exists and any numeric height is model-derived. We adopt the principle and
adopt no number.

`fifty_cal.firingPlatform.W` 3.0 → 2.0 ft. The engine bills that position as a single 9×2×D
prism, so a 3.0-ft platform inside a 2.0-ft trench described an impossible position. Geometry
clamped it FOR DRAWING and the BOM billed the unclamped 12 ft³ — the picture was right and the
spoil figure was wrong, which is exactly backwards. The clamp now lives once, in `compute`, so
bill and all three views read one footprint, and `test/doctrine-refintegrity.test.ts` asserts
the source table satisfies the invariants (platform fits its hole; the rise clears the
SHALLOWEST standard's cut, not deliberate's; the bench never covers the whole floor) so a
future source edit trips before the clamp ever has to.

### Physical constants out of the renderers

Every magnitude below was a literal inside a view, and in each case two views held different
ones for the same object. Each becomes a PLACEHOLDER leaf with an honest note and no fabricated
source, or a derived value on `GeometryModel`: the firing-step ledge (2D `min(0.8, d×0.25)` vs
3D `min(0.67, max(0.5, d×0.15))`; the 3D's "ATP 5-254, source-verified" comment had to go,
since §18 says no such figure exists), the grenade sump (billed 1×1×1, drawn as two other
boxes), the stringer size the engine already resolved and printed on the BOM line but never
published, the mortar-pit wall batter (only the 3D knew the pit was flared at all), the
inverted-T stem and L-arm (duplicated literals in two renderers, for a real dug trench), the
vehicle berm height (3D 0.600 ft vs the section's doctrinal 2.000), the camouflage net (1.21×
footprint drawn against 1.25× billed — the plane now takes √drapeFactor per axis so the drawn
area IS the ordered area), the rear entrance passage, the entry stair, the ramp/pan split, and
the isometric's flat 0.6 ft parapet block. The 8-stringer draw cap is gone; the iso reads the
frontal height it is drawing.

The entry stair's step COUNT now follows a climbable rise instead of a flat two treads sharing
whatever the cut happened to be — measured at HEAD, the bunker's 6.5 ft cut gave a 2.167 ft
(26 in) riser on a 6-in tread, which is a fall with a ledge, not a way down.

### What moved, measured before and after (both from a build, not derived)

Roof / cover, deliberate, loam. `sandbags_cover` and `cover_soil_fill` scale with the deck:

| position / threat | bags or fill, HEAD | after | stringers |
|---|---|---|---|
| two_man / 81 mm (the pinned fixture) | 157 bags | 255 | 8 → 10 |
| two_man / 155 mm | 100.80 ft³ | 201.60 | 8 → 10 |
| one_man / 81 mm | 118 bags | 167 | 5 → 6 |
| one_man / 155 mm | 75.60 ft³ | 126.00 | 5 → 6 |
| mg_crew / 81 mm | 174 bags | 283 | 9 → 11 |
| fifty_cal / 81 mm | 192 bags | 311 | 10 → 12 |
| mortar_pit / 81 mm | 435 bags | 544 | 9 → 11 |
| connecting_trench / 81 mm | 333 bags | 537 | 16 → 18 |
| connecting_trench / 155 mm | 214.20 ft³ | 404.60 | 16 → 18 |
| bunker_op_cp / 81 mm (notched) | 522 bags | 658 | 11 → 13 |
| atgm_javelin / 81 mm | 218 bags | 327 | 9 → 11 |

Direction is uniformly UP: today's roof was billed short. Labor does not move on this axis —
`overheadAdd` is a flat adder.

Excavation and labor, from the platform's sign (the only three positions with one):

| position | spoil HEAD → after (deliberate) | mh | hasty spoil | hasty mh |
|---|---|---|---|---|
| mg_crew | 93.75 → 71.25 ft³ (−24.0%) | 13.5 → 12.1 | 61.75 → 39.25 | 6.9 → 5.4 |
| fifty_cal | 107.50 → 82.50 ft³ (−23.3%) | 14.4 → 12.8 | 71.50 → 46.50 | 7.5 → 5.9 |
| atgm_javelin | 128.75 → 113.75 ft³ (−11.7%) | 15.7 → 14.8 | 80.75 → 65.75 | 8.1 → 7.1 |

fifty_cal's figure carries both halves: the sign flip alone gives 77.50 ft³, and narrowing the
platform to its own trench brings it back to 82.50 — Part B on its own makes the position
slightly MORE expensive, because the bench left undug is smaller.

**A new user-visible warning.** At HASTY, `SPOIL_SHORT` now fires for mg_crew and fifty_cal:
the smaller dig no longer yields enough spoil for the parapet ring. That is a true planning
fact in the safe direction, but it is new output on two positions and is recorded as such.

BOM SHAPE is unchanged — no line added or removed, and `grenade_sumps`, `sandbags_parapet`,
`gravel_sump`, `berm_fill` and `camo_net` are byte-identical. The vehicle positions, one_man,
two_man, mortar_pit, bunker and connecting_trench show no excavation change at all (no
platform), and no vehicle ever reaches the earth-roof branch (its 12 ft span forces
`engineered_required` for every threat).

### The goldens

**No golden or snapshot file under `test/goldens/` is touched**, and `test/fixtures/
train-vectors.json` is untouched: those are all wood-frame subsystem artifacts and this path
does not reach them (verified by running the full suite — the only failures were the SAP-1 pins
below). `test/frame-goldens.test.ts`'s same-PR obligation is therefore satisfied vacuously, and
this paragraph is the record that it was checked rather than assumed.

The SAP-1 pins that moved, each regenerated deliberately and each exactly what the contract
predicts: `test/snapshot.test.ts` `sandbags_cover` 157 → 255 and `stringers` 8 → 10 (the deck
is 9.00 × 6.50 ft where it was 9.00 × 4.00, and the count is taken over the 9 ft deck rather
than the 7 ft hole); `placeholderReport` 295/295/189 → 317/317/192 (22 new leaves, three of
them safety-critical — the stringer sections, which are the member holding the roof up);
`test/units-format.test.ts`'s large-total case 156843 → 254745, which is the same cover-bag
move × 999. Everything else in the default fixture is byte-identical, labor included.

### Decisions taken on the designs' open questions

- **Front and rear are the same number** rather than the front alone carrying the munition
  standoff. `standoffMinFor()` already falls back to `overhead.setbackMin`, so the two are one
  quantity, and the spec states the rule symmetrically.
- **`bearingEachEnd` feeds the roof FOOTPRINT**, not only the stringer length. §2.f step 7 says
  the stringers overhang the supports, and the deck follows the stringers; a deck that stops at
  the support line has no bearing under its own edge.
- **The stringer sections are tagged safetyCritical**, with their `maxSpan` siblings — a fill
  that shrinks one draws a hairline beam under a foot of earth. `bearingEachEnd` itself is NOT
  retagged here: that is audit A5's call, and the safety-critical roster lives in a document
  this phase does not own.
- **No `PLATFORM_CLAMPED` advisory.** Every validation code must be reachable from inputs
  alone (`test/validate.test.ts` asserts it), and with the table now consistent this one is
  not. The guard is the source-table invariant test plus the single clamp in `compute`.
- **The job sheet prints the setback and the bearing as the two stages they are**, and its
  "Standoff achieved" row is relabelled "Roof support setback" — it was printing an OHC-support
  setback under a name a reader takes for a threat keep-out distance.

### Known residuals, named rather than closed

- **C4** — `parapet.H` (0.5 ft) and `sandbag.frontWallHeight` (0.83 ft) still describe one
  object and disagree; the 3D mound is built to the greater of them and the section dimensions
  the lesser. No rendering contract can settle which table is right, so the cross-view sweep
  names that field as deliberately absent instead of asserting a fact neither table supports.
- **C16** — a circular position's roof still uses its bounding rectangle with no π/4 factor, so
  the mortar pit's corrected deck inherits the same square-for-circle overestimate.
- **C20** — the T-stem and L-arm are now DRAWN from doctrine in all three views but are still
  outside the volume model; the fidelity statement now says so per shape, which it did not.
- The `RENDERED_PROTECTION` register and the import-time invariants in `src/doctrine/io.ts`
  would be the right home for the platform and roof-footprint guards; that file is outside this
  phase's ownership and the guards live in tests instead.

- **D45 — The toolkit formerly named TIMBER is the Woodframe construction toolkit, "woodframe"
  as one word.** Operator decision (2026-08-11). The repo was split-brained about the name —
  the UI directory, entry pages and Vite config said `woodframe` while the engine said
  `src/timber/`, the hub cards said "Wood-Frame Construction" with a hyphen, and the packet
  comments said TIMBER-2. One name now: `src/timber/` → `src/woodframe/`, `test/timber*` →
  `test/woodframe*` (91 files, pure renames), product tokens TIMBER-1/TIMBER-2 →
  WOODFRAME-1/WOODFRAME-2, hub and page titles "Woodframe Construction". Three things
  deliberately did NOT change: **"timber" as a lumber class** (a 6x8 timber, the timber
  dressing deduction, the "Timber & plywood" revetment in SAP-1) is carpentry vocabulary, not
  the product's name, and stays; **`STORAGE_KEY = 'timber2-session'`** is an identifier in
  users' browsers — renaming it would orphan every saved build, so it keeps its historical
  value with a comment; and **historical documents** (TIMBER2_PLAN.md, dated DECISIONS
  entries, the audit register) are records of what things were called when written, and are
  not rewritten. `test/goldens/frame-compat/index.json` carries `generatedFrom:
  src/woodframe/frame.ts` — a metadata path updated to where the generator now lives; the
  generator's output bytes are unchanged, which the compat suite verifies.

- **D46 — A doctrine edit reaches everything: the module-load snapshots are dead, and the
  two preset numbers that disagreed with the register are corrected TO the register.**
  (2026-08-11.) The rule register became a live, editable database (io.ts) one commit ago,
  but the closure inventory showed an applied import going nowhere in the places that matter
  most: the entire preset catalog was built once at module scope (`FAMILY_TABLE`), the three
  framing-spacing leaves were dead while literals in `catalog.ts`/`spec.ts` held the live
  values, and the clamp table, roof defaults, fastener supply arithmetic and labor figures
  existed only as literals. This pass makes the register the single live source for that set:
  `FAMILY_TABLE` is now `familyTable()`, minted fresh per call (`buildFromFamily` therefore
  mints from the register as it stands); `SPEC_PATH_DEFS` min/max/step are live reads of a new
  `LIMITS` group (24 rows, one structured leaf per spec path, the old cites carried onto the
  leaves — reworded only where the register's own citation gate demands a subject:
  `foundation.embedFt`, `ramp.widthFt`, `temperBays`, the three bunker-envelope rows, and the
  four `openings[]` rows that had no cite at all); new `ROOF` (risePer12 4, overhangFt 1) and
  `FASTENER` (pieces-per-pound, spikes/bolts modest readings, 2 1/6-in corrugation pitch)
  groups plus `OPENING.wideDoor`, `TOWER.cabPlanSizesFt`, `LABOR.membersPerWorker` and
  `LABOR.productiveHoursPerDay` — all cited honestly as preset operating points, working
  figures or common published values, none of them life-safety tagged (an LS tag without a
  packet consumer breaks the LS-GATE, per the open NAILING note). Consumers rewired to read
  leaves at call time: catalog presets and lock captions, `normalize` roof repair, the spec
  section fallback, `frame.ts` basement default, `elevation.ts`/`wallSystem.ts` wall and plate
  thickness, `fasteners.ts` whole-file, `bom.ts` rates (`MH_PER_*` consts deleted;
  `LABOR_RATES.value` are getters so the packet prints the rate that priced it),
  `packet/labor.ts` crew/hours figures, and the UI's tiling, tower/ramp selects, opening
  presets, screen band and roof/foundation switch defaults. `test/woodframe-live-rules.test.ts`
  is the propagation lock: six locks, each one proven by reverting its wiring and watching the
  recorded failure (snapshot catalog mints 16-in/36-ft buildings after a 24-in/24-ft import;
  load-time clamp copies clamp 48 to nothing; literal tiling tiles 96/26 after a 32-in import;
  load-time labor copies leave 356.156 MH unmoved; literal repair gables frame rise 4 after a
  rise-6 import).

  **The one deliberate output change.** Wiring the presets to `OPENING` exposed the two places
  a card contradicted the register — the exact 0.4-in disagreement the register's own comment
  says was already corrected once: the gp-frame and custom cards wrote a **6.7-ft door**
  where `OPENING.doorHeightFt` is 6 ft 8 in (6.6667), and the custom card wrote **3-ft window
  sills** where `OPENING.windowSillFt` is 3.5. The cards now read the leaves, and the deltas
  were measured member-by-member over every shipped card (before/after digests of preset +
  id/role/nominal/cutLength/position/rotation):

  - **12 of 14 cards byte-identical** — preset and members. Every other wire in this pass is
    value-identical by construction, and this measurement is the proof.
  - **gp-frame** (936 members, count unchanged): 38 members moved, all of them the E/W door
    chain, all by the door correction and nothing else — 4 jack studs and 14 leaf boards
    −0.4 in, 4 header plies and 4 ledges down 0.4 in, 4 cripples over the headers +0.4 in,
    4 leaf braces −0.17 in at −0.003 rad (the leaf is 0.4 in shorter), and the 4 siding
    pieces over the door heads re-cut to the new header line (centres drop 0.2 in).
  - **custom** (310 members, count unchanged): 24 members moved — the S-door chain exactly as
    above (2 jacks, 2 header plies, 2 cripples), plus the two windows' sill chain at
    +6 in: 2 rough sills and 4 header plies up 0.5 ft, 4 jacks +6 in, 4 cripples below the
    sill +6 in, 4 cripples over the header −6 in.
  - **Goldens regenerated deliberately, this PR:** `test/goldens/thumbs/{gp-frame,custom}.svg`
    and `.solid.svg` — the four tiles of the two corrected cards, nothing else under
    `test/goldens/` moved (frame, frame-compat and train-vectors are untouched; the compat
    fixtures carry their own literal 6.7 inputs by design and keep them).

  Left alone on purpose: crew-size and productive-hours clamps and the stock-length list stay
  arithmetic divisors under R-T6 (`CREW_MIN/MAX`, `HOURS_MIN/MAX`, `DEFAULT_STOCK_FT`);
  `MEMBERS_PER_WORKER_NOTE` still interpolates the shipped figure at module load because
  `packet/html.ts` (another agent's file) imports it as a plain string — the arithmetic beside
  it is live, and the residual is marked at the definition. `subsystems/floorSystem.ts`'s
  `SMALL_PLAN_WIDTH_FT` re-export and `families/tower.ts`'s `TOWER_HEIGHTS` are the sibling
  pass's files and were not touched here.
