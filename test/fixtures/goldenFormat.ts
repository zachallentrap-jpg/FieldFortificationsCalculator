// TIMBER-2 T0 — the golden serialization, defined ONCE so the generator and the compat suite
// can never disagree about what was snapshotted (plan TD12/TD13).
//
// Canonical form: object keys sorted, arrays in emission order (order IS semantic — per-role id
// counters bake the input order in, TD5), numbers at full IEEE round-trip precision so an exact
// deep-equal is meaningful and the 1e-12 epsilon fallback only ever forgives real FP wobble.

import type { Member } from '../../src/timber/types';

export const GOLDEN_FORMAT = 1;

export interface FrameSnapshot {
  format: number;
  levels: LevelsLike;
  members: Member[];
}

// Structural, not nominal: the snapshot only needs "an object of named heights", so the
// legacy `FloorLevels` and whatever the T1 engine's LevelInfo becomes both satisfy it
// without either side importing the other's type.
export type LevelsLike = Readonly<Record<string, number | undefined>>;

/** Deterministic JSON: keys sorted at every level, arrays left in order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonicalJson(v)).join(',') + '}';
}

export function frameSnapshot(model: { members: readonly Member[]; levels: object }): FrameSnapshot {
  return { format: GOLDEN_FORMAT, levels: model.levels as LevelsLike, members: [...model.members] };
}
