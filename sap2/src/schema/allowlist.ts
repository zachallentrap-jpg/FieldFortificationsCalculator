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
  // Exact mathematics of the prismatoid volume formula V = h/6·(A₀ + 4·A_m + A₁) and
  // the both-sides batter term (2·s·D). Mathematics, not doctrine.
  { ref: 'AL-GEOM-2', value: 2, module: 'engine/solids', decisionRef: 'B43/§4.3-I3', rationale: 'both-sides batter doubling and midpoint halving in exact prismatoid integration' },
  { ref: 'AL-GEOM-4', value: 4, module: 'engine/solids', decisionRef: 'B43/§4.3-I3', rationale: 'prismatoid midsection weight (Simpson exact for linear-edge solids)' },
  { ref: 'AL-GEOM-6', value: 6, module: 'engine/solids', decisionRef: 'B43/§4.3-I3', rationale: 'prismatoid divisor (Simpson exact for linear-edge solids)' },
  { ref: 'AL-COUNT-1', value: 1, module: 'engine/work', decisionRef: 'B43/§4.3', rationale: 'dimensionless→count identity when a geometric ratio becomes an item count (traced explicitly)' },
  { ref: 'AL-PERIM-2', value: 2, module: 'engine/work', decisionRef: 'B43/§4.3-I3', rationale: 'rectangle perimeter doubling (mathematics)' },
  { ref: 'AL-ZERO', value: 0, module: 'engine/work', decisionRef: 'B43/§4.3', rationale: 'additive identity for absent features (no revetment ⇒ zero bags), traced explicitly' },
];
