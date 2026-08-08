// The pinned-vector payload, shared by the test that asserts it and the script that writes it.
//
// It lives in its own module for one reason: if the generator imported the test file, running
// the generator would run the suite — including the assertion against the very file it is about
// to overwrite. Same module, one definition, no chicken-and-egg.

import {
  buildSession,
  emptyProgress,
  fnv1a,
  mark,
  mulberry32,
  pickDistractors,
  sealSession,
  sessionSeed,
  shuffle,
  type CardSpec,
  type DeckSpec,
} from '../../src/timber/train/core';
import { TIMBER_REGIME_LINE } from '../../src/timber/train/compile';

/** A synthetic deck: the scheduler must be testable without generating a building. */
export function fakeDeck(n: number, id = 'deck-x'): DeckSpec {
  const cards: CardSpec[] = [];
  for (let i = 0; i < n; i++) {
    cards.push({
      id: `c${i}`,
      deckId: id,
      subject: { kind: 'member-role', role: `role${i}`, exemplarMemberId: `m${i}` },
      front: { art: { kind: 'svg', svg: '', artId: `a${i}` } },
      back: {
        name: `name ${i}`,
        plain: `does thing ${i}`,
        whereItGoes: 'somewhere',
        facts: [],
        regimeLine: TIMBER_REGIME_LINE,
      },
      modes: ['flip', 'identify'],
      fallbackArt: false,
      // Three stages, round-robin, so same-stage neighbours exist to be confused with.
      minStage: i % 3,
    });
  }
  return { id, app: 'timber', title: 'test', regime: 'timber-ph', cards, stageDrill: [], compiledFrom: {} };
}

export function trainVectors() {
  const rand = mulberry32(12345);
  const deck = fakeDeck(12, 'vec');
  let lapsed = emptyProgress();
  for (const id of ['c1', 'c4', 'c9']) lapsed = mark(lapsed, id, false, 'identify');
  lapsed = sealSession(lapsed);
  return {
    fnv1a: ['', 'a', 'stud', 'deck-x', 'role:rafter'].map((s) => fnv1a(s)),
    mulberry32: Array.from({ length: 8 }, () => Number(rand().toFixed(12))),
    sessionSeed: [0, 1, 2, 7].map((n) => sessionSeed('vec', n)),
    shuffle: [1, 2, 3].map((seed) => shuffle('abcdefgh'.split(''), mulberry32(seed)).join('')),
    firstSession: buildSession(deck, emptyProgress(), sessionSeed('vec', 0)),
    lapsedSession: buildSession(deck, lapsed, sessionSeed('vec', 1)),
    distractors: pickDistractors(deck, 'c5', 3, sessionSeed('vec', 0)),
  };
}
