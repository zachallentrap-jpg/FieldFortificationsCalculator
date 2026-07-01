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

## Render / layout / state

- **D12 — The reference drawing is authored, and renderer + reference share one registry.**
  Per D2, `public/SAP-1_drawing_reference.svg` is authored from §10. To guarantee the shipped
  renderer matches it, both are generated from the same numbered-callout + legend registry
  (`render/svg.ts` `callout()` + the legend builder), so a callout number and its legend name
  can never drift between the reference and the live drawings.

## Render / layout / state

_(logged as stages land)_
