// TRAINING CORE — shared shapes and the scheduler (TRAINING_AND_PACKETS_PLAN §2.3, F1).
//
// SHARED SPEC MODULE. Zero imports. Zero DOM. No Date, no Math.random, no network.
//
// Two decisions here are load-bearing enough that changing either silently changes what the
// trainer teaches, so both are written down rather than left in the code:
//
//   THE SCHEDULER COUNTS SESSIONS, NOT DAYS (FD9). Field cadence is irregular — three sessions
//   in one evening, then nothing for two weeks — so a clock-based interval either buries a
//   Marine in reviews or hides the deck for a fortnight. Sessions are also the only unit that
//   can be deterministic, which is what lets the whole thing be tested.
//
//   PROMOTION TO "KNOWN" REQUIRES A NON-FLIP MODE (FD10, the recall guard). A self-graded flip
//   is the learner marking their own homework and a four-choice tap is 25% guessable. Neither
//   is production. Until a card has been got through identify, name-to-part or stage-order, it
//   cannot reach box 2, and the UI says "self-checked" rather than "known".

export type TrainApp = 'timber' | 'sap2';

export type DeckRegime =
  /** TIMBER: numbers are allowed, and every doctrine fact carries its cite verbatim, "(PH)" included. */
  | 'timber-ph'
  /** SAP-2 with no fill: qualitative and token-only, zero digits. Reserved for F7. */
  | 'sap-template'
  | 'sap-training'
  | 'sap-doctrine';

export type FactSource =
  | 'doctrine'                    // cite REQUIRED — the reference for this fact's claim
  | 'doctrine-constrained-choice' // cite REQUIRED — chosen from a closed doctrinal set
  | 'this-build'                  // free user configuration — cite FORBIDDEN
  | 'count'                       // a count of the user's own members — cite FORBIDDEN
  | 'fill';                       // SAP-2 operator fill

export interface CitedFact {
  readonly label: string;
  readonly text: string;
  readonly source: FactSource;
  readonly cite?: string;
  readonly lifeSafety?: boolean;
}

export interface SceneHighlight {
  readonly memberIds: readonly string[];
  readonly stageOrdinal: number;
  readonly view: string;
  readonly cutaway: { axis: 'x' | 'y' | 'z'; frac: number } | null;
  /**
   * Which structure these member ids belong to (a catalog family id). Normally the deck's own,
   * and omitted; the cross-family "framing pieces" deck is the case that needs it, because a
   * card drawn from the guard tower and a card drawn from a hut sit side by side in one deck
   * and each has to be drawn against the building it actually came from.
   */
  readonly source?: string;
}

export type CardArt =
  | { readonly kind: 'svg'; readonly svg: string; readonly artId: string }
  | { readonly kind: 'scene'; readonly scene: SceneHighlight };

export interface CardFront {
  readonly art: CardArt;
  readonly prompt?: string;
}

export interface CardBack {
  readonly name: string;
  readonly plain: string;
  readonly whereItGoes: string;
  readonly facts: readonly CitedFact[];
  /** Card CONTENT, never chrome — it travels with a printed card too. */
  readonly regimeLine: string;
}

export type QuizMode = 'flip' | 'flip-reverse' | 'identify' | 'name-to-part' | 'stage-order';

export type CardSubject =
  | { readonly kind: 'member-role'; readonly role: string; readonly exemplarMemberId: string }
  | { readonly kind: 'component'; readonly componentId: string };

export interface CardSpec {
  readonly id: string;
  readonly deckId: string;
  readonly subject: CardSubject;
  readonly front: CardFront;
  readonly back: CardBack;
  readonly modes: readonly QuizMode[];
  readonly fallbackArt: boolean;
  /** Lowest stage this subject appears in — the teaching order's primary key. */
  readonly minStage: number;
}

export interface StageDrillEntry {
  readonly ordinal: number;
  readonly label: string;
  readonly detail?: string;
  readonly source: 'app-structure' | 'doctrine';
  readonly cite?: string;
}

export interface DeckSpec {
  readonly id: string;
  readonly app: TrainApp;
  readonly title: string;
  readonly regime: DeckRegime;
  readonly cards: readonly CardSpec[];
  readonly stageDrill: readonly StageDrillEntry[];
  readonly notModelled?: { readonly reason: string };
  readonly compiledFrom: { readonly specHash?: string };
}

// ── Scheduler: Leitner by SESSION ────────────────────────────────────────────

export type Box = 0 | 1 | 2;

export interface CardProgress {
  readonly box: Box;
  readonly lastSession: number;
  readonly lapses: number;
  readonly seen: number;
  readonly gotBy: readonly QuizMode[];
}

export interface DeckProgress {
  readonly session: number;
  readonly cards: Record<string, CardProgress>;
}

/** Review cadence in SESSIONS. Clock-free by design — see the header. */
export const DUE_EVERY: Readonly<Record<Box, number>> = { 0: 1, 1: 2, 2: 4 };

/**
 * Unseen cards admitted per session. Without this cap the first session of a 40-card deck is
 * forty new cards, which nobody finishes, and thereafter new cards starve the lapsed reviews
 * that are the whole reason to have a scheduler.
 */
export const UNSEEN_PER_SESSION = 8;
export const SESSION_CAP = 20;

export const emptyProgress = (): DeckProgress => ({ session: 0, cards: {} });

const blank = (): CardProgress => ({ box: 0, lastSession: -1, lapses: 0, seen: 0, gotBy: [] });

/** The recall guard: a card is only promotable INTO box 2 once a non-flip mode has got it. */
function canReachKnown(gotBy: readonly QuizMode[]): boolean {
  return gotBy.some((m) => m !== 'flip' && m !== 'flip-reverse');
}

export function mark(p: DeckProgress, cardId: string, got: boolean, via: QuizMode): DeckProgress {
  const prev = p.cards[cardId] ?? blank();
  const gotBy = got && !prev.gotBy.includes(via) ? [...prev.gotBy, via] : prev.gotBy;
  let box: Box = prev.box;
  if (got) {
    const next = Math.min(prev.box + 1, 2) as Box;
    box = next === 2 && !canReachKnown(gotBy) ? 1 : next;
  } else {
    box = 0;
  }
  return {
    ...p,
    cards: {
      ...p.cards,
      [cardId]: {
        box,
        lastSession: p.session,
        lapses: prev.lapses + (got ? 0 : 1),
        seen: prev.seen + 1,
        gotBy,
      },
    },
  };
}

export function sealSession(p: DeckProgress): DeckProgress {
  return { ...p, session: p.session + 1 };
}

/**
 * The queue for this session: everything due first (so reviews can never starve), then a
 * capped ration of unseen cards, truncated at the cap, then shuffled.
 */
export function buildSession(
  deck: DeckSpec,
  p: DeckProgress,
  seed: number,
  cap: number = SESSION_CAP,
): readonly string[] {
  const due: { id: string; cp: CardProgress }[] = [];
  const unseen: string[] = [];
  for (const card of deck.cards) {
    const cp = p.cards[card.id];
    if (!cp || cp.seen === 0) {
      unseen.push(card.id);
      continue;
    }
    if (p.session - cp.lastSession >= DUE_EVERY[cp.box]) due.push({ id: card.id, cp });
  }
  // Lapsed box-0 cards first: they are the ones actively being got wrong.
  due.sort((a, b) =>
    (b.cp.lapses > 0 && a.cp.box === 0 ? 1 : 0) - (a.cp.lapses > 0 && b.cp.box === 0 ? 1 : 0)
    || a.cp.box - b.cp.box
    || a.cp.lastSession - b.cp.lastSession
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const queue = [...due.map((d) => d.id), ...unseen.slice(0, UNSEEN_PER_SESSION)].slice(0, cap);
  return shuffle(queue, mulberry32(seed));
}

export function deckMastery(deck: DeckSpec, p: DeckProgress): { known: number; learning: number; unseen: number; total: number } {
  let known = 0;
  let learning = 0;
  let unseen = 0;
  for (const card of deck.cards) {
    const cp = p.cards[card.id];
    if (!cp || cp.seen === 0) unseen += 1;
    else if (cp.box === 2) known += 1;
    else learning += 1;
  }
  return { known, learning, unseen, total: deck.cards.length };
}

/**
 * Distractors for identify. Same-stage subjects are preferred because they are the confusable
 * ones — telling a jack stud from a cripple is the lesson; telling it from a concrete footing
 * is not.
 */
export function pickDistractors(deck: DeckSpec, cardId: string, n: number, seed: number): readonly string[] {
  const subject = deck.cards.find((c) => c.id === cardId);
  if (!subject) return [];
  const rand = mulberry32((fnv1a(cardId) ^ seed) >>> 0);
  const seen = new Set<string>([subject.back.name]);
  const pool = deck.cards.filter((c) => {
    if (c.id === cardId || seen.has(c.back.name)) return false;
    seen.add(c.back.name);
    return true;
  });
  const sameStage = shuffle(pool.filter((c) => c.minStage === subject.minStage), rand);
  const rest = shuffle(pool.filter((c) => c.minStage !== subject.minStage), rand);
  return [...sameStage, ...rest].slice(0, n).map((c) => c.back.name);
}

/** PINNED: Fisher-Yates descending. Changing the direction changes every committed vector. */
export function shuffle<T>(a: readonly T[], rand: () => number): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

/** PINNED and CLOCK-FREE. No Date.now anywhere in this file or its callers. */
export function sessionSeed(deckId: string, session: number): number {
  return (fnv1a(deckId) ^ (session >>> 0)) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
