// TRAINING — turning a scheduled card into a question (§2.5, F2). Pure, node-tested.
//
// THE MODE LADDER is the one real decision in this file, and it is what makes the recall guard
// (FD10) reachable instead of decorative:
//
//   box 0 / never seen → FLIP. You cannot test recall of something a person has not met yet;
//     asking first just teaches them they are bad at this.
//   box 1 → IDENTIFY or NAME-TO-PART or STAGE-ORDER — a mode that can catch a wrong answer.
//     This is the rung the guard requires, so a card that is being drilled at all will reach it
//     on its own without the learner having to go looking for a "test me properly" setting.
//   box 2 → maintenance, and FLIP-REVERSE is allowed back in: the card is already known, so the
//     job is keeping the name attached to the picture, not proving it again.
//
// EVERY QUESTION IS A FUNCTION OF (deck, card, progress, seed). Same inputs, same question,
// same order of choices — which is what lets a session be replayed in a test, and what stops
// the answer moving under a learner's thumb on a re-render.

import {
  mulberry32,
  pickDistractors,
  shuffle,
  type CardSpec,
  type CardProgress,
  type DeckSpec,
  type QuizMode,
} from './core';

export const CHOICE_COUNT = 4;

export type Question =
  /** Art up, name hidden: say it, then check yourself. */
  | { readonly mode: 'flip'; readonly card: CardSpec }
  /** Name up, art hidden: point at it, then check yourself. */
  | { readonly mode: 'flip-reverse'; readonly card: CardSpec }
  /** Art up, four names. */
  | { readonly mode: 'identify'; readonly card: CardSpec; readonly choices: readonly string[]; readonly answer: number }
  /** Name up, four drawings. */
  | { readonly mode: 'name-to-part'; readonly card: CardSpec; readonly choices: readonly CardSpec[]; readonly answer: number }
  /** Art up (whole structure — clipping it would give the answer away), four stage labels. */
  | { readonly mode: 'stage-order'; readonly card: CardSpec; readonly choices: readonly string[]; readonly answer: number };

/** Modes that can promote a card to "known" — the non-self-graded ones. */
const PROVING: readonly QuizMode[] = ['identify', 'name-to-part', 'stage-order'];

export function pickMode(card: CardSpec, cp: CardProgress | undefined, seed: number): QuizMode {
  const box = cp?.box ?? 0;
  if (!cp || cp.seen === 0 || box === 0) return 'flip';
  const available = PROVING.filter((m) => card.modes.includes(m));
  if (box === 1) {
    // No proving mode available (a one-card deck has nothing to be confused with) — fall back
    // to flip rather than fabricate a question with no distractors. The card then stays at
    // box 1 forever, which is the honest outcome: nothing here has tested it.
    if (available.length === 0) return 'flip';
    return available[seed % available.length]!;
  }
  // Box 2: alternate maintenance and proving, so a known card is neither coasted on nor
  // re-interrogated every single time it comes up.
  if (seed % 2 === 0 && card.modes.includes('flip-reverse')) return 'flip-reverse';
  return available.length > 0 ? available[seed % available.length]! : 'flip';
}

/** A card's stage label, for the stage-order choices. */
function stageLabel(deck: DeckSpec, ordinal: number): string | undefined {
  return deck.stageDrill.find((s) => s.ordinal === ordinal)?.label;
}

/**
 * Build the question for one scheduled card. Returns null only when the card id is not in the
 * deck — a stale id from storage, which the caller skips rather than crashes on.
 */
export function buildQuestion(deck: DeckSpec, cardId: string, cp: CardProgress | undefined, seed: number): Question | null {
  const card = deck.cards.find((c) => c.id === cardId);
  if (!card) return null;
  let mode = pickMode(card, cp, seed);

  // A deck with no stage drill (the cross-family "framing pieces" deck) has no stage question
  // to ask — the same piece goes in at different points in different buildings.
  if (mode === 'stage-order' && deck.stageDrill.length < CHOICE_COUNT) mode = 'identify';

  if (mode === 'flip' || mode === 'flip-reverse') return { mode, card };

  const rand = mulberry32(seed >>> 0);

  if (mode === 'identify') {
    const wrong = pickDistractors(deck, cardId, CHOICE_COUNT - 1, seed);
    if (wrong.length === 0) return { mode: 'flip', card };
    const choices = shuffle([card.back.name, ...wrong], rand);
    return { mode, card, choices, answer: choices.indexOf(card.back.name) };
  }

  if (mode === 'name-to-part') {
    // Distractors come back as NAMES; map them to their cards so each one can be drawn.
    const names = new Set(pickDistractors(deck, cardId, CHOICE_COUNT - 1, seed));
    const others = deck.cards.filter((c) => c.id !== cardId && names.has(c.back.name));
    if (others.length === 0) return { mode: 'flip', card };
    const choices = shuffle([card, ...others], rand);
    return { mode, card, choices, answer: choices.indexOf(card) };
  }

  const right = stageLabel(deck, card.minStage);
  if (!right) return { mode: 'flip', card };
  const wrong = shuffle(deck.stageDrill.filter((s) => s.label !== right).map((s) => s.label), rand)
    .slice(0, CHOICE_COUNT - 1);
  const choices = shuffle([right, ...wrong], rand);
  return { mode: 'stage-order', card, choices, answer: choices.indexOf(right) };
}

/** The prompt line a question shows above the card. Content, not chrome — it prints too. */
export function promptFor(q: Question): string {
  // A card may state its own question. The naming deck does, because "what is this piece, and
  // what does it carry?" asks for two things and its answer side gives one — a prompt that
  // over-asks makes an easy card feel like a failed one.
  if (q.mode === 'flip' && q.card.front.prompt) return q.card.front.prompt;
  switch (q.mode) {
    case 'flip': return 'What is this piece, and what does it carry?';
    case 'flip-reverse': return 'Where does this go, and what is it cut from?';
    case 'identify': return 'Which piece is highlighted?';
    case 'name-to-part': return `Which drawing shows the ${q.card.back.name.toLowerCase()}?`;
    case 'stage-order': return 'At which stage does this piece go in?';
  }
}

/** Whether this mode grades itself (the learner presses "got it") or is graded by a choice. */
export function isSelfGraded(mode: QuizMode): boolean {
  return mode === 'flip' || mode === 'flip-reverse';
}
