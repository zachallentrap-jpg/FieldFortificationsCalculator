// TIMBER-2 — the stage model (plan §3.3, TD10).
//
// `Member.stage` stays a NUMBER: a 1-based ordinal into the model's own `stagePlan`. That one
// decision is why the legacy suites never had to change — a legacy building's plan IS the
// legacy `STAGES` array, ordinal for ordinal, so `stage: 5` still means "wall framing" there
// while a tower is free to have its own five-stage sequence.
//
// What the plan buys over hardcoded numbers: subsystems are stage-agnostic (C-3). A subsystem
// is TOLD which ordinal to stamp by the family generator; it never knows that decking happens
// to be stage 4 in a building and stage 3 on a platform.

import { STAGES } from './types';

/** The closed vocabulary. A family composes an ordered subset; nothing invents a key. */
export type StageKey =
  | 'layout'
  | 'foundation'
  | 'floor'
  | 'walls'
  | 'walls-l2'
  | 'plates'
  | 'roof-frame'
  | 'roof-deck'
  | 'roofing'
  | 'sheathing'
  | 'siding'
  | 'openings-built'
  | 'stairs-access'
  | 'railings'
  | 'platform'
  | 'tent-frame'
  | 'cribwork'
  | 'soil-ghost'
  | 'finish';

export interface StagePlanEntry {
  ordinal: number; // 1-based; this is what Member.stage holds
  key: StageKey;
  label: string; // shown on the scrubber and the stage panel
  detail: string; // the doctrinal sequence note
}

export const STAGE_KEYS: readonly StageKey[] = [
  'layout', 'foundation', 'floor', 'walls', 'walls-l2', 'plates', 'roof-frame', 'roof-deck',
  'roofing', 'sheathing', 'siding', 'openings-built', 'stairs-access', 'railings', 'platform',
  'tent-frame', 'cribwork', 'soil-ghost', 'finish',
] as const;

export function stagePlan(rows: { key: StageKey; label: string; detail: string }[]): StagePlanEntry[] {
  return rows.map((r, i) => ({ ordinal: i + 1, ...r }));
}

/**
 * The legacy building plan. Its labels are `STAGES` verbatim and in the same order, so a
 * one-story gable building's ordinals mean exactly what they meant in TIMBER-1 — the property
 * `test/timber2-stages.test.ts` asserts, and the reason the compat lock holds for free.
 */
export function stagePlanForLegacyBuilding(): StagePlanEntry[] {
  const keys: StageKey[] = [
    'layout', 'foundation', 'floor', 'floor', 'walls', 'plates',
    'roof-frame', 'roof-frame', 'roof-deck', 'roofing', 'siding',
  ];
  const details: string[] = [
    'Batter boards, posts and footers set to the building lines.',
    'Sills bedded and the built-up girder set — everything above bears on this.',
    'Joists over the girder, bridging rows to share the load between them.',
    'Deck panels tie the joists into one stiff floor to build the walls on.',
    'Walls framed flat and raised: plates, studs, and the framing around every opening.',
    'Cap plates lap the corners and the let-in braces square the walls.',
    'Ceiling joists tie the wall tops together against the rafter thrust.',
    'Rafters bear on the plates against the ridge, cut by the framing-square method.',
    'Sheathing decks the rafters and braces the whole roof plane.',
    'Roofing covers the deck, laid from the eave up so every lap sheds water.',
    'Siding and exterior finish close the building in.',
  ];
  return STAGES.map((s, i) => ({
    ordinal: s.id,
    key: keys[i]!,
    label: s.name,
    detail: details[i]!,
  }));
}

/** Ordinal of the first entry with this key, or undefined. Families use it to stamp emits. */
export function ordinalOf(plan: StagePlanEntry[], key: StageKey): number | undefined {
  return plan.find((e) => e.key === key)?.ordinal;
}
