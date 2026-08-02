// THE one magnitude allowlist (blueprint §4.2). Every numeric literal in sap2 source
// outside this file must survive the G-2 AST gate's small structural budget (array
// indices, 0/1 arithmetic identities); anything magnitude-shaped lives HERE with a
// DECISIONS entry, or the build fails. Allowlist entries may NOT point into doctrine
// or engine paths for doctrinal quantities — a doctrinal magnitude belongs in a fill,
// full stop. CI prints diffs of this file on every run.

export interface AllowlistEntry {
  /** Stable ref used by structuralQ() call sites, e.g. 'AL-1'. */
  readonly ref: string;
  readonly value: number;
  /** Module path the value may appear in. */
  readonly module: string;
  /** DECISIONS.md entry authorizing it. */
  readonly decisionRef: string;
  readonly rationale: string;
}

export const MAGNITUDE_ALLOWLIST: readonly AllowlistEntry[] = [
  // (empty at R0 start — geometry structure constants land with the engine, each with
  //  a decision entry; the first candidates are exact math constants like π/4 for the
  //  circular-pit volume model, which are mathematics, not doctrine.)
];
