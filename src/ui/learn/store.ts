// 1371 LEARNING — where progress lives (TRAINING_AND_PACKETS_PLAN §2.3, F2).
//
// Storage is INJECTED, so every rule below is node-testable without a browser — the same
// posture as the studio's session store, and for the same reason: the rules that matter here
// are the ones that fire on bad bytes, and those are exactly the ones a browser test never
// reaches.
//
// PROGRESS IS PER DECK, deliberately. Card ids are shared — `role:stud` is the same card in
// the fundamentals deck and in the guard-tower deck, because it is the same piece — but
// mastering it in one does not mark it known in the other. Two reasons: drilling a stud inside
// a tower is a different recall problem from drilling it on its own, and a progress bar that
// fills itself in from a deck you never opened is a progress bar nobody believes.
//
// NOTHING HERE READS THE CLOCK. The scheduler counts sessions (FD9), so the only time-like
// number stored is a session ordinal that this module increments. That is what makes the whole
// trainer replayable from a saved blob.

import type { DeckProgress } from '../../timber/train/core';
import { emptyProgress } from '../../timber/train/core';

export const STORAGE_KEY = 'timber2-train';
export const TRAIN_VERSION = 1;

export interface TrainState {
  version: number;
  /** deckId → progress. Decks that no longer exist are dropped on load. */
  decks: Record<string, DeckProgress>;
  lastDeck?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TrainLoad {
  state: TrainState;
  notices: string[];
}

export function emptyTrain(): TrainState {
  return { version: TRAIN_VERSION, decks: {} };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One card's progress, or null if the stored shape cannot be trusted. */
function readCard(v: unknown): DeckProgress['cards'][string] | null {
  if (!isObj(v)) return null;
  const box = v['box'];
  const lastSession = v['lastSession'];
  const lapses = v['lapses'];
  const seen = v['seen'];
  if (box !== 0 && box !== 1 && box !== 2) return null;
  if (typeof lastSession !== 'number' || !Number.isFinite(lastSession)) return null;
  if (typeof lapses !== 'number' || typeof seen !== 'number' || lapses < 0 || seen < 0) return null;
  const gotBy = Array.isArray(v['gotBy']) ? v['gotBy'].filter((m): m is string => typeof m === 'string') : [];
  return {
    box,
    lastSession,
    lapses: Math.floor(lapses),
    seen: Math.floor(seen),
    // The recall guard reads this list to decide whether a card may be called "known", so a
    // hand-edited `gotBy: ["identify"]` would hand out mastery for free. Only modes the drill
    // can actually produce survive the read.
    gotBy: gotBy.filter((m) => ['flip', 'flip-reverse', 'identify', 'name-to-part', 'stage-order'].includes(m)) as DeckProgress['cards'][string]['gotBy'],
  };
}

/**
 * Read and REVALIDATE. A blob from an older build, hand-edited, or truncated by a crash must
 * degrade to "start over on that deck" with a notice — never to a blank screen and never to a
 * scheduler doing arithmetic on a string.
 */
export function loadTrain(storage: StorageLike): TrainLoad {
  const notices: string[] = [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing, a full quota, a locked-down profile — none of them are worth a crash.
    return { state: emptyTrain(), notices: ['Progress could not be read; this session will not be saved.'] };
  }
  if (!raw) return { state: emptyTrain(), notices };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: emptyTrain(), notices: ['Saved progress was unreadable and has been reset.'] };
  }
  if (!isObj(parsed) || !isObj(parsed['decks'])) {
    return { state: emptyTrain(), notices: ['Saved progress was in an unexpected shape and has been reset.'] };
  }

  const decks: Record<string, DeckProgress> = {};
  let dropped = 0;
  for (const [deckId, value] of Object.entries(parsed['decks'])) {
    if (!isObj(value) || !isObj(value['cards'])) { dropped += 1; continue; }
    const session = value['session'];
    if (typeof session !== 'number' || !Number.isFinite(session) || session < 0) { dropped += 1; continue; }
    const cards: DeckProgress['cards'] = {};
    for (const [cardId, cv] of Object.entries(value['cards'])) {
      const card = readCard(cv);
      if (card) cards[cardId] = card;
    }
    decks[deckId] = { session: Math.floor(session), cards };
  }
  if (dropped > 0) notices.push(`${dropped} saved deck${dropped > 1 ? 's' : ''} could not be read and ${dropped > 1 ? 'were' : 'was'} reset.`);

  const lastDeck = typeof parsed['lastDeck'] === 'string' ? parsed['lastDeck'] : undefined;
  return { state: { version: TRAIN_VERSION, decks, ...(lastDeck ? { lastDeck } : {}) }, notices };
}

/** Best-effort save. A trainer that throws on a full disk is worse than one that forgets. */
export function saveTrain(storage: StorageLike, state: TrainState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function progressFor(state: TrainState, deckId: string): DeckProgress {
  return state.decks[deckId] ?? emptyProgress();
}

export function withProgress(state: TrainState, deckId: string, p: DeckProgress): TrainState {
  return { ...state, decks: { ...state.decks, [deckId]: p }, lastDeck: deckId };
}

/** "Start this deck over" — the only destructive action the trainer offers. */
export function resetDeck(state: TrainState, deckId: string): TrainState {
  const decks = { ...state.decks };
  delete decks[deckId];
  return { ...state, decks };
}
