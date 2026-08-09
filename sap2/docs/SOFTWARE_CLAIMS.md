# SOFTWARE_CLAIMS.md — the claims ledger

The complete inventory of what SAP-2's own text claims, and what it must never claim.
Every user-facing sentence that asserts a property of the software traces to a line
here; the copy gates fail on banned phrases. **Wording is pending counsel review
(COUNSEL_REVIEW.md q.8).**

## Claims the software makes (each backed by a mechanism)

| # | Claim | Backing mechanism |
|---|---|---|
| C1 | "Ships with no doctrinal values." | Ship-empty architecture; G-11 functional/byte emptiness proof on every artifact |
| C2 | "Every number traces to an operator-entered, cited, verified value." | Fill regime (§2 blueprint); per-leaf citations; blind verification records |
| C3 | "Outputs are marked with their data's provenance state." | Watermark state machine; artifact policy (signature blocks only when COMMISSIONED) |
| C4 | "Records the **attested** identity of who entered and verified each value." | Identity fields in fill records — attested, NOT authenticated (F23) |
| C5 | "No accounts, no analytics, no runtime network I/O." | G-3 network-primitive lint; offline gate on source and artifacts |
| C6 | "Same inputs, same data → byte-identical data and vector outputs." | G-5 two-process determinism (scope: Result/trace/SVG/fill bytes — NOT 3D raster pixels) |
| C7 | "Fictitious training values are marked on the value itself." | Inline FICT suffix; FICTITIOUS field in records; class inside the content hash |
| C8 | "The fill file is tamper-evident against accidental or naive modification only — a rewritten file is indistinguishable; custody plus the externally recorded hash are the controls." | Content hash + ceremony external-anchor acknowledgment (B5) |
| C9 | "Template drawings are shape-true with arbitrary proportions." | Canonical-proportion projection; DO-NOT-SCALE stamp; zero-digit gate |

## The boundary line (prints on every artifact, every state)

> Planning aid — verify against current publications. Not a substitute for engineer
> judgment.

## Phrases the software must NEVER emit (copy-gate banned list)

- "approved", "certified", "validated by", "doctrinally correct", "safe",
  "guaranteed", "authoritative" — applied to any value or output.
- "verified" — except in the exact construction "verified by ⟨attested name⟩ on
  ⟨date⟩" describing a recorded verification act.
- Any sentence claiming the TOOL validates doctrine. The tool records that a human
  did. (Risk 10: drift toward "the tool validates" language is reverted on sight.)
- "engineer-approved roof" or any thickness for an engineered-roof threat (INV-1 —
  the STOP card is the only output for those).

## Fidelity lines (print with commissioned outputs)

Per-model honesty, one line each, e.g.: `volumes exact-prismatoid · labor
estimating-model · schedule estimating-model (sequential, no overlap)`. The
`MODELS APPROXIMATE — STRUCTURAL REVIEW PENDING` stamp prints in every state until a
recorded SME-review artifact exists (targets R5 exit; indefinite-pending is the
declared fallback).
