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
  | 'subfloor'
  | 'walls'
  | 'walls-l2'
  | 'plates'
  | 'ceiling'
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
  'layout', 'foundation', 'floor', 'subfloor', 'walls', 'walls-l2', 'plates', 'ceiling',
  'roof-frame', 'roof-deck', 'roofing', 'sheathing', 'siding', 'openings-built',
  'stairs-access', 'railings', 'platform', 'tent-frame', 'cribwork', 'soil-ghost', 'finish',
] as const;

export function stagePlan(rows: { key: StageKey; label: string; detail: string }[]): StagePlanEntry[] {
  return rows.map((r, i) => ({ ordinal: i + 1, ...r }));
}

/**
 * The building plan, shaped by the roof. Rows 1–6 never move — the frozen floor and wall
 * generators stamp those ordinals as literals — but the roof rows are the roof's own:
 *
 *   gable | hip | pyramid   ceiling joists (7), then rafters (8) — the full legacy sequence.
 *   shed | flat             no ceiling frame; the rafters span low plate to high plate and
 *                           tie the walls themselves, so the rafter row IS row 7.
 *   none                    walls, then closing in. No roof rows at all — a plan that lists
 *                           stages nothing will ever land in is a scrubber full of dead stops.
 *
 * EVERY KEY IN A PLAN IS UNIQUE. The first cut of this spelled the deck row 'floor' and the
 * ceiling row 'roof-frame', and `requireOrdinal` — first match by design — quietly stamped
 * every hip and shed member into "Ceiling joists". The member card even printed it. Unique
 * keys make "which ordinal is X" a question with one answer.
 */
export function stagePlanForBuilding(
  roofKind: 'gable' | 'hip' | 'pyramid' | 'shed' | 'flat' | 'none',
): StagePlanEntry[] {
  const base: { key: StageKey; label: string; detail: string }[] = [
    { key: 'layout', label: STAGES[0]!.name, detail: 'Batter boards, posts and footers set to the building lines.' },
    { key: 'foundation', label: STAGES[1]!.name, detail: 'Sills bedded and the built-up girder set — everything above bears on this.' },
    { key: 'floor', label: STAGES[2]!.name, detail: 'Joists over the girder, bridging rows to share the load between them.' },
    { key: 'subfloor', label: STAGES[3]!.name, detail: 'Deck panels tie the joists into one stiff floor to build the walls on.' },
    { key: 'walls', label: STAGES[4]!.name, detail: 'Walls framed flat and raised: plates, studs, and the framing around every opening.' },
    { key: 'plates', label: STAGES[5]!.name, detail: 'Cap plates lap the corners and the let-in braces square the walls.' },
  ];
  const siding = {
    key: 'siding' as StageKey,
    label: STAGES[10]!.name,
    detail: 'Siding and exterior finish close the building in.',
  };
  if (roofKind === 'shed' || roofKind === 'flat') {
    return stagePlan([
      ...base,
      { key: 'roof-frame', label: 'Rafters set', detail: 'Rafters bear low plate to high plate; the pony wall and rake studs frame the height difference.' },
      { key: 'roof-deck', label: STAGES[8]!.name, detail: 'Sheathing decks the rafters and braces the whole roof plane.' },
      { key: 'roofing', label: STAGES[9]!.name, detail: 'Roofing covers the deck, laid from the eave up so every lap sheds water.' },
      siding,
    ]);
  }
  if (roofKind === 'none') {
    return stagePlan([...base, siding]);
  }
  return stagePlan([
    ...base,
    { key: 'ceiling', label: STAGES[6]!.name, detail: 'Ceiling joists tie the wall tops together against the rafter thrust.' },
    { key: 'roof-frame', label: STAGES[7]!.name, detail: 'Rafters bear on the plates against the ridge, cut by the framing-square method.' },
    { key: 'roof-deck', label: STAGES[8]!.name, detail: 'Sheathing decks the rafters and braces the whole roof plane.' },
    { key: 'roofing', label: STAGES[9]!.name, detail: 'Roofing covers the deck, laid from the eave up so every lap sheds water.' },
    siding,
  ]);
}

/**
 * The legacy building plan. Its labels are `STAGES` verbatim and in the same order, so a
 * one-story gable building's ordinals mean exactly what they meant in TIMBER-1 — the property
 * `test/timber2-stages.test.ts` asserts, and the reason the compat lock holds for free.
 */
export function stagePlanForLegacyBuilding(): StagePlanEntry[] {
  return stagePlanForBuilding('gable');
}

/** Ordinal of the first entry with this key, or undefined. Families use it to stamp emits. */
export function ordinalOf(plan: StagePlanEntry[], key: StageKey): number | undefined {
  return plan.find((e) => e.key === key)?.ordinal;
}

/**
 * Ordinal for a stage the caller KNOWS its plan contains. Throws rather than falling back to a
 * hardcoded number: a family emitting into a stage its own plan does not declare is a bug that
 * should surface as a stack trace, not as members quietly landing in the wrong stage — where
 * they would appear under the wrong heading in the cut list and nobody would notice.
 */
export function requireOrdinal(plan: StagePlanEntry[], key: StageKey): number {
  const found = plan.find((e) => e.key === key);
  if (!found) {
    throw new Error(`stage "${key}" is not in this family's stage plan (${plan.map((e) => e.key).join(', ')})`);
  }
  return found.ordinal;
}
