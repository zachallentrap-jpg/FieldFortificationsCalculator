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

_(logged as stages land)_

## Render / layout / state

_(logged as stages land)_
