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
  /**
   * This stage puts NO MEMBER in the model, and that is the plan, not an omission.
   *
   * A crew plans around steps that produce no material — a slab has to cure before anything
   * bears on it; a skid building's bearing line is cleared, levelled and strung before a skid is
   * dropped on it. Those are real stops on the scrubber. What is NOT allowed is a stage that
   * merely happens to be empty because nothing generates for it, which is how a "pyramid"
   * building came to advertise Ceiling joists and Rafters and build neither. Saying which is
   * which is what lets a test tell them apart.
   */
  noMembers?: true;
}

export const STAGE_KEYS: readonly StageKey[] = [
  'layout', 'foundation', 'floor', 'subfloor', 'walls', 'walls-l2', 'plates', 'ceiling',
  'roof-frame', 'roof-deck', 'roofing', 'sheathing', 'siding', 'openings-built',
  'stairs-access', 'railings', 'platform', 'tent-frame', 'cribwork', 'soil-ghost', 'finish',
] as const;

export function stagePlan(rows: { key: StageKey; label: string; detail: string; noMembers?: true }[]): StagePlanEntry[] {
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
  foundationKind: 'piers' | 'wall' | 'basement' | 'slab' | 'skids' | 'embedded' = 'piers',
  skins: { roofing?: boolean; walls?: boolean } = {},
): StagePlanEntry[] {
  // A SLAB IS THE FLOOR, so its first four stages are a different job — but they are still FOUR
  // stages, and that is not a style choice. `walls.ts` and `floor.ts` are the frozen branch and
  // they stamp their ordinals as LITERALS: a sole plate is stage 5 and a cap plate is stage 6,
  // written into code the compat goldens pin byte for byte. Drop a row above them and every wall
  // member lands one stage late, or past the end of the plan entirely — which is exactly what
  // happened the first time this was written, and the seeded sweep caught it.
  //
  // So the rows keep their positions and change their MEANING. A slab pour really is a sequence:
  // dig and pour the thickened edge, pour the slab over it, and then wait — nothing bears on a
  // slab until it has cured, which is a real step a crew plans around even though it puts no
  // member in the model.
  const slabFloor = foundationKind === 'slab';
  const base: { key: StageKey; label: string; detail: string; noMembers?: true }[] = [
    // SKIDS HAVE NO FOOTERS. The row said "posts and footers set to the building lines" for a
    // building that has neither and shows nothing at all when you scrub to it. The work is real
    // — the bearing line is cleared, levelled and strung before a skid is dropped on it — and it
    // puts no member in the model, which is what `noMembers` is for.
    foundationKind === 'skids'
      ? { key: 'layout', label: 'Bearing line prepared', detail: 'The line is cleared, levelled and strung to the building lines — a skid bears on the ground the whole way, so it is the ground that gets the work.', noMembers: true }
      : { key: 'layout', label: STAGES[0]!.name, detail: 'Batter boards, posts and footers set to the building lines.' },
    slabFloor
      ? { key: 'foundation', label: 'Thickened edge poured', detail: 'The edge is dug and poured under every wall line — the slab bears the walls there, so that is where it is deepest.' }
      : { key: 'foundation', label: STAGES[1]!.name, detail: 'Sills bedded and the built-up girder set — everything above bears on this.' },
    slabFloor
      ? { key: 'floor', label: 'Slab poured', detail: 'One pour over the edge, screeded flat: its top IS the finished floor, and the walls stand on it.' }
      : { key: 'floor', label: STAGES[2]!.name, detail: 'Joists over the girder, bridging rows to share the load between them.' },
    slabFloor
      ? { key: 'subfloor', label: 'Slab cures', detail: 'Nothing is built on a green slab. The wall lines are snapped and the plates anchored once it has cured.', noMembers: true }
      : { key: 'subfloor', label: STAGES[3]!.name, detail: 'Deck panels tie the joists into one stiff floor to build the walls on.' },
    { key: 'walls', label: STAGES[4]!.name, detail: 'Walls framed flat and raised: plates, studs, and the framing around every opening.' },
    { key: 'plates', label: STAGES[5]!.name, detail: 'Cap plates lap the corners and the let-in braces square the walls.' },
  ];
  // A STAGE FOR A SKIN THAT IS TURNED OFF IS A DEAD STOP. `custom` ships with no roofing and no
  // siding, and its plan still listed both — two rows on the scrubber that can never contain
  // anything, for work the spec says is not being done. These are the LAST rows, so dropping
  // them moves no ordinal above them and the frozen rows 1–6 are untouched.
  const wantRoofing = skins.roofing ?? true;
  const wantWalls = skins.walls ?? true;
  const siding = {
    key: 'siding' as StageKey,
    label: STAGES[10]!.name,
    detail: 'Siding and exterior finish close the building in.',
  };
  const closeIn = wantWalls ? [siding] : [];
  const roofSkin = wantRoofing
    ? [{ key: 'roofing' as StageKey, label: STAGES[9]!.name, detail: 'Roofing covers the deck, laid from the eave up so every lap sheds water.' }]
    : [];
  if (roofKind === 'shed' || roofKind === 'flat') {
    return stagePlan([
      ...base,
      { key: 'roof-frame', label: 'Rafters set', detail: 'Rafters bear low plate to high plate; the pony wall and rake studs frame the height difference.' },
      { key: 'roof-deck', label: STAGES[8]!.name, detail: 'Sheathing decks the rafters and braces the whole roof plane.' },
      ...roofSkin,
      ...closeIn,
    ]);
  }
  if (roofKind === 'none') {
    return stagePlan([...base, ...closeIn]);
  }
  return stagePlan([
    ...base,
    { key: 'ceiling', label: STAGES[6]!.name, detail: 'Ceiling joists tie the wall tops together against the rafter thrust.' },
    { key: 'roof-frame', label: STAGES[7]!.name, detail: 'Rafters bear on the plates against the ridge, cut by the framing-square method.' },
    { key: 'roof-deck', label: STAGES[8]!.name, detail: 'Sheathing decks the rafters and braces the whole roof plane.' },
    ...roofSkin,
    ...closeIn,
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
