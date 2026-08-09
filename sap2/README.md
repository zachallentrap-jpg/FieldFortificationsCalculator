# SAP-2 — Survivability Position Planner v2

Ground-up revamp of the planner at the repo root (v1, frozen). The governing document
is [`../docs/SAP2_BLUEPRINT.md`](../docs/SAP2_BLUEPRINT.md) — mission, liability
architecture, recruit-proof output system, deterministic backend, phase plan, and the
B-series decisions log. Nothing in this tree contradicts the blueprint without a new
logged decision.

Three commitments define the tree:

1. **Ship-empty.** No doctrinal magnitude exists anywhere in this source or its
   artifacts. The schema defines every leaf's identity; values arrive only via an
   owner-entered, cited, verified fill on an air-gapped device, and trust is conferred
   only by a recorded commissioning act.
2. **Recruit-proof outputs.** The flagship artifact is the per-stage Build Card deck —
   picture-first, body-referenced, pass/fail-checked — generated from the same
   `StagePlan` the scheduler uses.
3. **Deterministic backend.** `compute(inputs, schema, fill) → Result`, pure in all
   arguments; one geometry kernel; renderers project, never re-derive; gates G-1..G-16
   enforce the invariants in CI from the first commit.

## Layout

See blueprint §4.1. `src/schema` (leaf catalog, fill format, ids), `src/engine`
(compute), `src/render` (2D/print), `src/scene` + `src/viewer` (3D), `src/fill`
(Fill Station), `src/state`, `src/ui`, `src/sw`.

## Commands

```
npm ci          # exact-pinned install (Node version per .nvmrc)
npm run verify  # typecheck + tests + gates (grows as gates land)
npm run dev     # vite dev server
```
