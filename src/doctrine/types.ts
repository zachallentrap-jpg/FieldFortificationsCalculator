// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER REGIME — READ FIRST
// Every doctrinal constant in this project is wrapped in Provenance<T> and defaults
// to status 'PLACEHOLDER'. No authoritative shielding thickness, roof/stringer load,
// or standoff value is ever sourced, fetched, transcribed, guessed, or hard-coded.
// They remain flagged TODO until a qualified user fills them against current pubs.
// The data-driven "NOT FOR FIELD USE" banner clears only when zero placeholders remain.
// ─────────────────────────────────────────────────────────────────────────────

export type ProvStatus = 'PLACEHOLDER' | 'DOCTRINE';

export interface Provenance<T> {
  value: T;
  unit?: string;
  status: ProvStatus;
  source: string;
  safetyCritical?: boolean;
  note?: string;
}

// P wraps a value as a PLACEHOLDER by default. Callers override only `value`,
// `unit`, `safetyCritical`, `note` — never flip `status` to 'DOCTRINE' in source.
// The status flips to 'DOCTRINE' exclusively via validated doctrine import (io.ts),
// which is how a qualified user supplies real, verified numbers offline.
export const P = <T>(value: T, o: Partial<Provenance<T>> = {}): Provenance<T> => ({
  value,
  status: 'PLACEHOLDER',
  source: 'TODO: confirm against current pub',
  ...o,
});
