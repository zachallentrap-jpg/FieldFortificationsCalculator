// TRAINING — the scheduler and the deck compiler (TRAINING_AND_PACKETS_PLAN §2.3/§2.4.1, F1).
//
// Two things this suite exists to protect, and neither is obvious from reading the code:
//
//   THE PINNED VECTORS. `test/fixtures/train-vectors.json` is a byte-exact record of what the
//   PRNG, the shuffle and the session builder produce for fixed inputs. A learner's deck order
//   is reproducible only as long as those functions are; regenerate the file (`npm run
//   gen:train-vectors`) ONLY when a scheduling change is intended, and read the diff, because
//   a moved vector means every user's session order moved with it.
//
//   THE CITE DISCIPLINE. `this-build` facts must never carry a citation and `doctrine` facts
//   must always carry one. This is the rule that stops the tool laundering the operator's own
//   choice of a 2x6 into "the manual says 2x6", which is the single worst thing a training aid
//   can do to a Marine who then repeats it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DUE_EVERY,
  SESSION_CAP,
  UNSEEN_PER_SESSION,
  buildSession,
  deckMastery,
  emptyProgress,
  fnv1a,
  mark,
  mulberry32,
  pickDistractors,
  sealSession,
  sessionSeed,
  shuffle,
  type DeckProgress,
  type DeckSpec,
  type QuizMode,
} from '../src/timber/train/core';
import { TIMBER_REGIME_LINE, compileDeck } from '../src/timber/train/compile';
import { fakeDeck, trainVectors } from './fixtures/trainVectors';
import { familyById, shippedFamilies } from '../src/timber/catalog';
import { generateStructure } from '../src/timber/families/index';
import { plainName, whatItDoes } from '../src/ui/woodframe/labels';
import type { BuildingSpec, BunkerSpec, StructureSpec } from '../src/timber/spec';

const VECTORS = fileURLToPath(new URL('./fixtures/train-vectors.json', import.meta.url));

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Drill one card through a session and seal it, the way the UI does. */
function drill(p: DeckProgress, cardId: string, got: boolean, via: QuizMode): DeckProgress {
  return sealSession(mark(p, cardId, got, via));
}

// ── Scheduler: the Leitner transitions ───────────────────────────────────────

test('a right answer steps up one box, a wrong answer drops straight to 0', () => {
  let p = emptyProgress();
  p = mark(p, 'c0', true, 'identify');
  assert.equal(p.cards['c0']!.box, 1);
  p = mark(p, 'c0', true, 'identify');
  assert.equal(p.cards['c0']!.box, 2, 'a non-flip mode may reach box 2');
  // One miss undoes the ladder. Half-remembering is not remembering, and the whole point of
  // the box is that it is a claim about recall, not a running average.
  p = mark(p, 'c0', false, 'identify');
  assert.equal(p.cards['c0']!.box, 0);
  assert.equal(p.cards['c0']!.lapses, 1);
  assert.equal(p.cards['c0']!.seen, 3);
});

test('box 2 is the ceiling — right answers past it do not overflow', () => {
  let p = emptyProgress();
  for (let i = 0; i < 6; i++) p = mark(p, 'c0', true, 'identify');
  assert.equal(p.cards['c0']!.box, 2);
});

test('FD10 recall guard: flipping cannot promote a card to "known"', () => {
  // A self-graded flip is the learner marking their own homework. Ten of them in a row still
  // cannot say "known" — that word has to mean the card was produced under a mode that could
  // have caught a wrong answer.
  let p = emptyProgress();
  for (let i = 0; i < 10; i++) p = mark(p, 'c0', true, 'flip');
  assert.equal(p.cards['c0']!.box, 1, 'flip alone stalls at box 1');
  for (let i = 0; i < 10; i++) p = mark(p, 'c0', true, 'flip-reverse');
  assert.equal(p.cards['c0']!.box, 1, 'flip-reverse is still a self-grade');

  // One pass in a real mode opens the gate — and the card is at box 1 already, so the very
  // next right answer lands on 2 rather than starting the ladder over.
  p = mark(p, 'c0', true, 'identify');
  assert.equal(p.cards['c0']!.box, 2);
});

test('the guard is per-card, not per-deck', () => {
  let p = emptyProgress();
  p = mark(p, 'c0', true, 'identify');
  p = mark(p, 'c0', true, 'identify');
  p = mark(p, 'c1', true, 'flip');
  p = mark(p, 'c1', true, 'flip');
  assert.equal(p.cards['c0']!.box, 2);
  assert.equal(p.cards['c1']!.box, 1, 'c0 earning its stripes must not promote c1');
});

test('gotBy records each mode once, and only on a right answer', () => {
  let p = emptyProgress();
  p = mark(p, 'c0', false, 'identify');
  assert.deepEqual(p.cards['c0']!.gotBy, [], 'a miss proves nothing about the mode');
  p = mark(p, 'c0', true, 'flip');
  p = mark(p, 'c0', true, 'flip');
  p = mark(p, 'c0', true, 'identify');
  assert.deepEqual(p.cards['c0']!.gotBy, ['flip', 'identify']);
});

test('lapses accumulate across the card\'s whole life, and a relearn does not erase them', () => {
  let p = emptyProgress();
  p = mark(p, 'c0', false, 'identify');
  p = mark(p, 'c0', true, 'identify');
  p = mark(p, 'c0', false, 'identify');
  p = mark(p, 'c0', true, 'identify');
  assert.equal(p.cards['c0']!.lapses, 2, 'a card that has been dropped twice stays flagged');
});

test('mark is pure — the progress passed in is never mutated', () => {
  const p0 = emptyProgress();
  const p1 = mark(p0, 'c0', true, 'identify');
  assert.deepEqual(p0.cards, {}, 'the caller keeps its own copy');
  assert.notEqual(p0, p1);
  const before = JSON.stringify(p1);
  mark(p1, 'c0', false, 'identify');
  assert.equal(JSON.stringify(p1), before);
});

// ── Scheduler: what a session contains ───────────────────────────────────────

test('the first session of a big deck is a ration of unseen cards, not the whole deck', () => {
  const deck = fakeDeck(40);
  const q = buildSession(deck, emptyProgress(), 1);
  assert.equal(q.length, UNSEEN_PER_SESSION, 'forty new cards is a session nobody finishes');
  assert.equal(new Set(q).size, q.length, 'no card appears twice in one queue');
});

test('a card is due again exactly DUE_EVERY[box] sessions later, never sooner', () => {
  const deck = fakeDeck(3);
  // Put c0 in box 1 (due every 2 sessions) and seal, so session advances past it.
  let p = drill(emptyProgress(), 'c0', true, 'identify');
  assert.equal(p.cards['c0']!.box, 1);
  assert.equal(DUE_EVERY[1], 2);

  // Session 1: one session since it was marked — not yet due.
  assert.ok(!buildSession(deck, p, 1).includes('c0'), 'box 1 must not come back the next session');
  p = sealSession(p);
  // Session 2: two sessions on — due.
  assert.ok(buildSession(deck, p, 1).includes('c0'));
});

test('box 0 comes back every single session — the cards being missed are the work', () => {
  const deck = fakeDeck(3);
  const p = drill(emptyProgress(), 'c0', false, 'identify');
  assert.equal(DUE_EVERY[0], 1);
  assert.ok(buildSession(deck, p, 1).includes('c0'));
});

test('reviews are never starved by new cards', () => {
  // Twelve cards owed a review plus a deck full of unseen ones: every single review has to be
  // in the queue, because a scheduler that buries reviews under new material is just a shuffler.
  const deck = fakeDeck(60);
  let p = emptyProgress();
  for (let i = 0; i < 12; i++) p = mark(p, `c${i}`, false, 'identify');
  p = sealSession(p);
  const q = buildSession(deck, p, 7);
  for (let i = 0; i < 12; i++) assert.ok(q.includes(`c${i}`), `review c${i} was dropped`);
  assert.equal(q.length, SESSION_CAP, '12 due + 8 unseen fills the cap exactly');
});

test('when reviews alone exceed the cap, no unseen card gets in', () => {
  const deck = fakeDeck(60);
  let p = emptyProgress();
  for (let i = 0; i < 30; i++) p = mark(p, `c${i}`, false, 'identify');
  p = sealSession(p);
  const q = buildSession(deck, p, 3);
  assert.equal(q.length, SESSION_CAP);
  for (const id of q) {
    assert.ok(Number(id.slice(1)) < 30, `${id} is unseen and jumped a queue of 30 reviews`);
  }
});

test('a session is a function of (deck, progress, seed) and nothing else', () => {
  const deck = fakeDeck(40);
  const p = emptyProgress();
  assert.deepEqual(buildSession(deck, p, 99), buildSession(deck, p, 99), 'same seed, same order');
  const a = buildSession(deck, p, 1);
  const b = buildSession(deck, p, 2);
  assert.notDeepEqual(a, b, 'a different seed must actually reshuffle');
  assert.deepEqual([...a].sort(), [...b].sort(), 'but it must be the same cards');
});

test('the seed is derived from the deck and session — never from the clock', () => {
  assert.equal(sessionSeed('deck-x', 3), sessionSeed('deck-x', 3));
  assert.notEqual(sessionSeed('deck-x', 3), sessionSeed('deck-x', 4));
  assert.notEqual(sessionSeed('deck-x', 3), sessionSeed('deck-y', 3));
  assert.ok(Number.isInteger(sessionSeed('deck-x', 0)) && sessionSeed('deck-x', 0) >= 0);
});

test('an empty deck produces an empty session rather than throwing', () => {
  assert.deepEqual(buildSession(fakeDeck(0), emptyProgress(), 1), []);
  assert.deepEqual(deckMastery(fakeDeck(0), emptyProgress()), { known: 0, learning: 0, unseen: 0, total: 0 });
});

test('mastery counts every card exactly once', () => {
  const deck = fakeDeck(10);
  let p = emptyProgress();
  p = mark(p, 'c0', true, 'identify');
  p = mark(p, 'c0', true, 'identify'); // box 2 → known
  p = mark(p, 'c1', true, 'flip');     // box 1 → learning
  p = mark(p, 'c2', false, 'identify'); // box 0 → learning
  const m = deckMastery(deck, p);
  assert.deepEqual(m, { known: 1, learning: 2, unseen: 7, total: 10 });
  assert.equal(m.known + m.learning + m.unseen, m.total);
});

test('progress for a card the deck no longer has is ignored, not crashed on', () => {
  // The deck recompiles from the model, so changing the building deletes cards. Stale progress
  // in localStorage must simply not be scheduled.
  const deck = fakeDeck(3);
  let p = emptyProgress();
  p = mark(p, 'role:something-that-left', false, 'identify');
  p = sealSession(p);
  const q = buildSession(deck, p, 1);
  assert.ok(!q.includes('role:something-that-left'));
  assert.equal(deckMastery(deck, p).total, 3);
});

// ── Distractors ──────────────────────────────────────────────────────────────

test('identify offers same-stage distractors first — those are the confusable ones', () => {
  const deck = fakeDeck(30);
  // c3 is minStage 0; every c(3k) shares it.
  const names = pickDistractors(deck, 'c3', 3, 11);
  assert.equal(names.length, 3);
  for (const n of names) {
    const card = deck.cards.find((c) => c.back.name === n)!;
    assert.equal(card.minStage, 0, `${n} is from another stage while same-stage ones were free`);
  }
});

test('distractors never include the answer, never repeat, and are deterministic', () => {
  const deck = fakeDeck(30);
  const a = pickDistractors(deck, 'c3', 3, 11);
  assert.ok(!a.includes('name 3'));
  assert.equal(new Set(a).size, a.length);
  assert.deepEqual(a, pickDistractors(deck, 'c3', 3, 11));
  assert.notDeepEqual(a, pickDistractors(deck, 'c4', 3, 11), 'a different card gets a different set');
});

test('a deck too small to fill the distractors returns what it has, not blanks', () => {
  const deck = fakeDeck(2);
  const a = pickDistractors(deck, 'c0', 3, 1);
  assert.equal(a.length, 1);
  assert.deepEqual(pickDistractors(deck, 'nope', 3, 1), [], 'an unknown card id is empty, not a throw');
});

// ── Pinned vectors ───────────────────────────────────────────────────────────

test('PINNED: the PRNG, the shuffle and the session builder still produce the committed vectors', () => {
  // If this fails and the change was intended, run `npm run gen:train-vectors` and READ the
  // diff — every moved line is a learner whose card order changed under them.
  const want = JSON.parse(readFileSync(VECTORS, 'utf8')) as ReturnType<typeof trainVectors>;
  assert.deepEqual(trainVectors(), want);
});

test('the PRNG is uniform enough to shuffle with, and never leaves [0,1)', () => {
  const rand = mulberry32(sessionSeed('deck-x', 0));
  const buckets = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) {
    const v = rand();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    buckets[Math.floor(v * 4)]! += 1;
  }
  for (const b of buckets) assert.ok(b > 700 && b < 1300, `lumpy: ${buckets.join('/')}`);
});

test('shuffle is a permutation and leaves its input alone', () => {
  const src = Object.freeze('abcdefgh'.split(''));
  const out = shuffle(src, mulberry32(4));
  assert.deepEqual([...out].sort(), [...src].sort());
  assert.deepEqual(src, 'abcdefgh'.split(''));
  assert.deepEqual(shuffle([], mulberry32(1)), []);
  assert.deepEqual(shuffle(['x'], mulberry32(1)), ['x']);
});

// ── Deck compilation (FD1) ───────────────────────────────────────────────────

const LABELS = { plainName, whatItDoes };
/** Feet formatter — the compiler takes inches, like every other TIMBER surface. */
const FMT = (n: number) => `${Math.floor(n / 12)}'-${(n % 12).toFixed(1)}"`;

function deckFor(spec: StructureSpec, deckId = 'gp-frame'): DeckSpec {
  return compileDeck({ model: generateStructure(spec), deckId, title: 'test', labels: LABELS, fmtFtIn: FMT });
}

test('the deck compiles from the model — EVERY shipped family produces real cards', () => {
  // The whole catalog, not a sample: a family that ships without a teachable deck is a family
  // the Learning app silently has nothing to say about.
  for (const family of shippedFamilies()) {
    const deck = deckFor(family.preset, family.id);
    assert.ok(deck.cards.length >= 5, `${family.id}: only ${deck.cards.length} cards`);
    assert.ok(deck.stageDrill.length > 3, `${family.id}: the stage drill needs a real sequence`);
    assert.equal(new Set(deck.cards.map((c) => c.id)).size, deck.cards.length, `${family.id}: duplicate card id`);
    assert.equal(deck.id, family.id);
    assert.equal(deck.regime, 'timber-ph');
  }
});

test('FD1: change the building and the deck changes with it', () => {
  // This is the whole reason the compiler exists. A shed roof has no ridge board; a hand-written
  // deck would go on drilling one, and the student would go looking for a piece that isn't there.
  const gable = familyById('gp-frame')!.preset as BuildingSpec;
  const shed: BuildingSpec = { ...gable, roof: { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'N' } };
  const gableRoles = new Set(deckFor(gable).cards.map((c) => c.id));
  const shedRoles = new Set(deckFor(shed).cards.map((c) => c.id));
  assert.ok(gableRoles.has('role:ridge'), 'a gable has a ridge board to teach');
  assert.ok(!shedRoles.has('role:ridge'), 'a shed roof has no ridge — the card must be gone');
  assert.ok(shedRoles.has('role:rafter'), 'but it still has rafters');
});

test('FD1 again, on the wall type: a crib bunker teaches crib logs, a post-and-plank one does not', () => {
  const postPlank = familyById('crib-bunker')!.preset as BunkerSpec;
  const crib: BunkerSpec = { ...postPlank, wallType: 'crib' };
  assert.ok(!deckFor(postPlank, 'crib-bunker').cards.some((c) => c.id === 'role:cribLog'));
  assert.ok(deckFor(crib, 'crib-bunker').cards.some((c) => c.id === 'role:cribLog'));
});

test('TR-2b: "this build" facts carry NO citation and doctrine facts always do', () => {
  for (const id of ['gp-frame', 'tower', 'crib-bunker'] as const) {
    for (const card of deckFor(familyById(id)!.preset, id).cards) {
      for (const f of card.back.facts) {
        if (f.source === 'this-build' || f.source === 'count') {
          assert.equal(f.cite, undefined, `${id}/${card.id}/${f.label}: a user's own number cited as doctrine`);
        } else {
          assert.ok(f.cite && f.cite.length > 0, `${id}/${card.id}/${f.label}: doctrine with no reference`);
        }
      }
    }
  }
});

test('every card has a size, a length, a count and a reference — no half-filled backs', () => {
  for (const card of deckFor(familyById('gp-frame')!.preset).cards) {
    const labels = card.back.facts.map((f) => f.label);
    for (const need of ['Stock', 'Cut to', 'How many']) {
      assert.ok(labels.includes(need), `${card.id}: missing "${need}"`);
    }
    assert.ok(card.back.facts.some((f) => f.source === 'doctrine'), `${card.id}: nothing doctrinal to teach`);
    assert.ok(card.back.name.length > 0 && card.back.plain.length > 10, `${card.id}: thin back`);
    assert.equal(card.back.regimeLine, TIMBER_REGIME_LINE, `${card.id}: the (PH) line travels with the card`);
  }
});

test('the count fact is the real count of that role in this build', () => {
  const model = generateStructure(familyById('gp-frame')!.preset);
  const deck = compileDeck({ model, deckId: 'gp-frame', title: 't', labels: LABELS, fmtFtIn: FMT });
  const studs = deck.cards.find((c) => c.id === 'role:stud')!;
  const want = model.members.filter((m) => m.role === 'stud').length;
  assert.equal(studs.back.facts.find((f) => f.label === 'How many')!.text, `${want}`);
});

test('cards are ordered the way the building goes up', () => {
  const deck = deckFor(familyById('gp-frame')!.preset);
  const stages = deck.cards.map((c) => c.minStage);
  assert.deepEqual(stages, [...stages].sort((a, b) => a - b), 'a deck that opens on rafters teaches backwards');
  // Ties inside a stage are alphabetical, so the order is total rather than insertion-dependent.
  for (let i = 1; i < deck.cards.length; i++) {
    const a = deck.cards[i - 1]!;
    const b = deck.cards[i]!;
    if (a.minStage === b.minStage) assert.ok(a.back.name <= b.back.name, `${a.back.name} before ${b.back.name}`);
  }
});

test('the scene highlight names members that exist, at a stage that exists', () => {
  const model = generateStructure(familyById('gp-frame')!.preset);
  const deck = compileDeck({ model, deckId: 'gp-frame', title: 't', labels: LABELS, fmtFtIn: FMT });
  const ids = new Set(model.members.map((m) => m.id));
  const ordinals = new Set(model.stagePlan.map((s) => s.ordinal));
  for (const card of deck.cards) {
    assert.equal(card.front.art.kind, 'scene');
    const scene = (card.front.art as { scene: { memberIds: readonly string[]; stageOrdinal: number } }).scene;
    assert.ok(scene.memberIds.length > 0, `${card.id}: highlights nothing`);
    for (const mid of scene.memberIds) assert.ok(ids.has(mid), `${card.id}: highlights ghost member ${mid}`);
    assert.ok(ordinals.has(scene.stageOrdinal), `${card.id}: stage ${scene.stageOrdinal} is not in the plan`);
  }
});

test('the soil ghost gets no card — a stated depth is not a piece of lumber', () => {
  // §2.7: the cover depth is the operator's input, drawn for reference. Drilling it as if it
  // were framing would teach exactly the boundary error the whole gate exists to prevent.
  const deck = deckFor(familyById('crib-bunker')!.preset, 'crib-bunker');
  assert.ok(!deck.cards.some((c) => c.id === 'role:soilGhost'));
  // The wood that carries that stated depth, on the other hand, is exactly what to teach.
  assert.ok(deck.cards.some((c) => c.id === 'role:ohcStringer'), 'the overhead stringer is the lesson');
});

test('every card can be drilled in at least the modes the UI offers', () => {
  for (const card of deckFor(familyById('gp-frame')!.preset).cards) {
    assert.ok(card.modes.includes('flip'), `${card.id}: everything flips`);
    assert.ok(card.modes.length >= 3, `${card.id}: only ${card.modes.length} modes`);
    assert.equal(new Set(card.modes).size, card.modes.length, `${card.id}: duplicate mode`);
  }
});

test('the compiler is deterministic — same spec in, byte-identical deck out', () => {
  const spec = familyById('gp-frame')!.preset;
  assert.deepEqual(deckFor(spec), deckFor(spec));
});

test('a compiled deck schedules like any other deck', () => {
  // The seam between the two halves of F1: nothing about a real deck breaks the scheduler.
  const deck = deckFor(familyById('gp-frame')!.preset);
  const q = buildSession(deck, emptyProgress(), sessionSeed(deck.id, 0));
  assert.equal(q.length, Math.min(UNSEEN_PER_SESSION, deck.cards.length));
  const ids = new Set(deck.cards.map((c) => c.id));
  for (const id of q) assert.ok(ids.has(id), `session offered ${id}, which is not in the deck`);
});
