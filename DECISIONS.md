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
