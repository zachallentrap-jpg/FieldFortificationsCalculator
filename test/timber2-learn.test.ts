// 1371 LEARNING — the drill and the deck list (TRAINING_AND_PACKETS_PLAN §2.4/§2.5, F2).
//
// The trainer's UI is a shell: routing and innerHTML. Everything worth arguing about — which
// mode a card is asked in, what the choices are, which decks exist, what happens to a corrupt
// saved blob — lives in a module that runs here, without a browser. This suite is the reason
// that split is worth the indirection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSession,
  deckMastery,
  emptyProgress,
  mark,
  sealSession,
  sessionSeed,
  type DeckProgress,
  type QuizMode,
} from '../src/timber/train/core';
import { CHOICE_COUNT, buildQuestion, isSelfGraded, pickMode, promptFor } from '../src/timber/train/drill';
import { TIMBER_REGIME_LINE } from '../src/timber/train/compile';
import { FUNDAMENTALS_ID, allDecks, fundamentalsDeck } from '../src/timber/train/decks';
import { loadTrain, progressFor, resetDeck, saveTrain, withProgress, STORAGE_KEY, type StorageLike } from '../src/ui/learn/store';
import { plainName, whatItDoes } from '../src/ui/woodframe/labels';
import { fakeDeck } from './fixtures/trainVectors';
import { shippedFamilies } from '../src/timber/catalog';
import { fmtFtIn } from '../src/timber/units';
import { thumbnailFor } from '../src/timber/thumbnails';
import { generateStructure } from '../src/timber/families/index';
import { cardArt, deckArt, stageArt } from '../src/ui/learn/art';
import {
  COLS, DUPLEX_LABEL, PER_SHEET, ROWS, mirrorCell, paperDeckHtml, sheetsFor, type DuplexMode,
} from '../src/timber/train/print';

const LABELS = { plainName, whatItDoes };

/** A localStorage stand-in, so the store's rules are tested without a browser. */
function memStorage(seed?: Record<string, string>): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

// ── The mode ladder ──────────────────────────────────────────────────────────

test('a card nobody has seen is always asked by flip — you cannot test what was never taught', () => {
  const deck = fakeDeck(12);
  const card = deck.cards[0]!;
  for (let seed = 0; seed < 8; seed++) assert.equal(pickMode(card, undefined, seed), 'flip');
  const fresh = { box: 0 as const, lastSession: -1, lapses: 0, seen: 0, gotBy: [] };
  assert.equal(pickMode(card, fresh, 3), 'flip');
});

test('box 1 is always a PROVING mode — this is what makes the recall guard reachable', () => {
  // If box 1 could hand out another flip, a card could ride flips forever and never be
  // promotable. The guard would then be a permanent ceiling instead of a gate.
  const deck = fakeDeck(12);
  const card = deck.cards[0]!;
  for (let seed = 0; seed < 12; seed++) {
    const m = pickMode(card, { box: 1, lastSession: 0, lapses: 0, seen: 2, gotBy: ['flip'] }, seed);
    assert.ok(!isSelfGraded(m), `seed ${seed} gave ${m}, which grades itself`);
  }
});

test('a card with no proving mode available falls back to flip rather than inventing a question', () => {
  const deck = fakeDeck(1);
  const only = { ...deck.cards[0]!, modes: ['flip'] as readonly QuizMode[] };
  assert.equal(pickMode(only, { box: 1, lastSession: 0, lapses: 0, seen: 1, gotBy: ['flip'] }, 1), 'flip');
});

test('drilling a card the normal way reaches "known" — the guard gates, it does not block', () => {
  // The end-to-end claim: a learner who just keeps answering correctly gets to box 2 without
  // ever having to find a "test me properly" setting.
  const deck = fakeDeck(12);
  let p: DeckProgress = emptyProgress();
  const id = 'c0';
  for (let round = 0; round < 4 && (p.cards[id]?.box ?? 0) < 2; round++) {
    const q = buildQuestion(deck, id, p.cards[id], 7 + round)!;
    p = sealSession(mark(p, id, true, q.mode));
  }
  assert.equal(p.cards[id]!.box, 2, 'four correct rounds should be enough to be called known');
  assert.ok(p.cards[id]!.gotBy.some((m) => !isSelfGraded(m)), 'and it got there through a real mode');
});

// ── Question construction ────────────────────────────────────────────────────

test('a choice question always has the answer in it, exactly once, in a stable place', () => {
  const deck = fakeDeck(20);
  for (let seed = 0; seed < 20; seed++) {
    const q = buildQuestion(deck, 'c1', { box: 1, lastSession: 0, lapses: 0, seen: 1, gotBy: ['flip'] }, seed)!;
    if (!('choices' in q)) continue;
    assert.equal(q.choices.length, CHOICE_COUNT, `seed ${seed}: ${q.choices.length} choices`);
    assert.ok(q.answer >= 0 && q.answer < q.choices.length, `seed ${seed}: answer out of range`);
    const names = q.mode === 'name-to-part' ? q.choices.map((c) => c.back.name) : q.choices;
    assert.equal(new Set(names).size, names.length, `seed ${seed}: a repeated choice`);
    if (q.mode === 'identify') assert.equal(q.choices[q.answer], q.card.back.name);
    if (q.mode === 'name-to-part') assert.equal(q.choices[q.answer], q.card);
    // Same seed, same question — a re-render must not move the answer under a thumb.
    assert.deepEqual(buildQuestion(deck, 'c1', { box: 1, lastSession: 0, lapses: 0, seen: 1, gotBy: ['flip'] }, seed), q);
  }
});

test('the answer does not always sit in the same slot', () => {
  const deck = fakeDeck(20);
  const slots = new Set<number>();
  for (let seed = 0; seed < 30; seed++) {
    const q = buildQuestion(deck, 'c1', { box: 1, lastSession: 0, lapses: 0, seen: 1, gotBy: ['flip'] }, seed)!;
    if ('answer' in q) slots.add(q.answer);
  }
  assert.ok(slots.size >= 3, `answer only ever landed in ${[...slots].join('/')}`);
});

test('a deck with no stage plan never asks a stage question', () => {
  // The cross-family deck is the case: the same piece goes in at different points in different
  // buildings, so "at which stage?" has no single answer to grade against.
  const deck = fundamentalsDeck(LABELS);
  assert.equal(deck.stageDrill.length, 0);
  for (const card of deck.cards.slice(0, 12)) {
    for (let seed = 0; seed < 6; seed++) {
      const q = buildQuestion(deck, card.id, { box: 1, lastSession: 0, lapses: 0, seen: 1, gotBy: ['flip'] }, seed)!;
      assert.notEqual(q.mode, 'stage-order', `${card.id} was asked a stage question with no stage plan`);
    }
  }
});

test('a structure deck DOES ask stage questions, and grades them against its own plan', () => {
  const deck = allDecks(LABELS).find((d) => d.familyId === 'gp-frame')!.deck;
  const labels = new Set(deck.stageDrill.map((s) => s.label));
  let asked = 0;
  for (const card of deck.cards) {
    for (let seed = 0; seed < 6; seed++) {
      const q = buildQuestion(deck, card.id, { box: 1, lastSession: 0, lapses: 0, seen: 1, gotBy: ['flip'] }, seed)!;
      if (q.mode !== 'stage-order') continue;
      asked += 1;
      for (const c of q.choices) assert.ok(labels.has(c), `"${c}" is not a stage of this build`);
      assert.equal(q.choices[q.answer], deck.stageDrill.find((s) => s.ordinal === card.minStage)!.label);
    }
  }
  assert.ok(asked > 0, 'no stage question was ever produced');
});

test('an unknown card id yields null, not a throw', () => {
  assert.equal(buildQuestion(fakeDeck(5), 'role:gone', undefined, 1), null);
});

test('grading a card CHANGES its next question — which is why the UI holds the one it asked', () => {
  // Not a defect: `pickMode` reads the box, and the box is what an answer moves. But it means a
  // caller that rebuilds the question after marking shows a different card than the one the
  // learner just answered, with the tapped index pointing into a stale choice list. main.ts
  // pins the question when it is asked; this test is the reason that pin exists.
  const deck = fakeDeck(20);
  const before = buildQuestion(deck, 'c1', undefined, 5)!;
  assert.equal(before.mode, 'flip');
  const after = buildQuestion(deck, 'c1', mark(emptyProgress(), 'c1', true, 'flip').cards['c1'], 5)!;
  assert.notEqual(after.mode, before.mode, 'if these ever agree, re-read main.ts before deleting the pin');
});

test('every mode has a prompt, and none of them leak the answer', () => {
  const deck = allDecks(LABELS).find((d) => d.familyId === 'gp-frame')!.deck;
  const seenModes = new Set<QuizMode>();
  for (const card of deck.cards) {
    for (const box of [0, 1, 2] as const) {
      for (let seed = 0; seed < 4; seed++) {
        const q = buildQuestion(deck, card.id, { box, lastSession: 0, lapses: 0, seen: box === 0 ? 0 : 2, gotBy: [] }, seed)!;
        seenModes.add(q.mode);
        const prompt = promptFor(q);
        assert.ok(prompt.length > 10, `${q.mode}: no prompt`);
        // "Which drawing shows the X?" names the piece ON PURPOSE — that IS the question.
        if (q.mode !== 'name-to-part' && q.mode !== 'flip-reverse') {
          assert.ok(
            !prompt.toLowerCase().includes(q.card.back.name.toLowerCase()),
            `${q.mode} prompt gives the answer away: ${prompt}`,
          );
        }
      }
    }
  }
  assert.ok(seenModes.size >= 4, `only ${[...seenModes].join('/')} were ever produced`);
});

// ── A whole session, start to finish ─────────────────────────────────────────

/**
 * Exactly what the UI does, minus the DOM: build the queue, answer every card, seal once at
 * the end. If this drifts from main.ts the drill silently stops scheduling.
 */
function playSession(deckId: string, deck: ReturnType<typeof fundamentalsDeck>, p: DeckProgress, allRight: boolean) {
  const queue = buildSession(deck, p, sessionSeed(deckId, p.session));
  const modes: QuizMode[] = [];
  for (const cardId of queue) {
    const q = buildQuestion(deck, cardId, p.cards[cardId], sessionSeed(deckId, p.session))!;
    modes.push(q.mode);
    p = mark(p, cardId, allRight, q.mode);
  }
  return { p: sealSession(p), queue, modes };
}

test('a learner who keeps answering correctly converges on a fully known deck', () => {
  const deck = fundamentalsDeck(LABELS);
  let p = emptyProgress();
  for (let i = 0; i < 40; i++) p = playSession(FUNDAMENTALS_ID, deck, p, true).p;
  const m = deckMastery(deck, p);
  assert.equal(m.unseen, 0, 'forty sessions should have introduced every card');
  assert.equal(m.learning, 0, `${m.learning} cards never got out of learning`);
  assert.equal(m.known, m.total);
});

test('a learner who gets everything wrong never accumulates a false "known"', () => {
  const deck = fundamentalsDeck(LABELS);
  let p = emptyProgress();
  for (let i = 0; i < 10; i++) p = playSession(FUNDAMENTALS_ID, deck, p, false).p;
  assert.equal(deckMastery(deck, p).known, 0);
});

test('the last card of a queue completes the session — the queue is never left one short', () => {
  // The bug this pins: sealing per-card instead of once at the end makes every card in the
  // current queue instantly due again, and the drill never reaches its summary.
  const deck = fundamentalsDeck(LABELS);
  const { p, queue } = playSession(FUNDAMENTALS_ID, deck, emptyProgress(), true);
  assert.ok(queue.length > 0);
  assert.equal(p.session, 1, 'exactly one session elapsed');
  for (const id of queue) assert.equal(p.cards[id]!.seen, 1, `${id} was marked more than once`);
  // And the next queue is a DIFFERENT set — box-1 cards are not due one session later.
  const next = buildSession(deck, p, sessionSeed(FUNDAMENTALS_ID, p.session));
  assert.equal(next.filter((id) => queue.includes(id)).length, 0, 'last session came straight back');
});

// ── The deck list ────────────────────────────────────────────────────────────

test('the deck list is compiled from the catalog — one per shipped structure, plus fundamentals', () => {
  const decks = allDecks(LABELS);
  const expected = shippedFamilies().filter((f) => f.id !== 'custom').length + 1;
  assert.equal(decks.length, expected, 'a family shipped without a deck, or a deck without a family');
  assert.equal(decks[0]!.deck.id, FUNDAMENTALS_ID, 'a newcomer must land on the vocabulary deck first');
  assert.equal(new Set(decks.map((d) => d.deck.id)).size, decks.length, 'duplicate deck id');
  for (const d of decks) {
    assert.ok(d.blurb.length > 20, `${d.deck.id}: no blurb`);
    assert.ok(d.groupLabel.length > 0, `${d.deck.id}: no group`);
    assert.ok(d.deck.cards.length >= 5, `${d.deck.id}: ${d.deck.cards.length} cards`);
  }
});

test('the fundamentals deck covers every piece the catalog can build, each one exactly once', () => {
  const deck = fundamentalsDeck(LABELS);
  const ids = deck.cards.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'a role was taught twice');
  // Everything any structure deck teaches must be in here — that is what makes it fundamentals.
  for (const entry of allDecks(LABELS)) {
    if (entry.deck.id === FUNDAMENTALS_ID) continue;
    for (const c of entry.deck.cards) {
      assert.ok(ids.includes(c.id), `${c.id} is taught in ${entry.deck.id} but missing from fundamentals`);
    }
  }
});

test('every fundamentals card names the structure its drawing comes from', () => {
  // Without this the art layer would draw a tower leg against a storage shed.
  for (const card of fundamentalsDeck(LABELS).cards) {
    assert.equal(card.front.art.kind, 'scene');
    const scene = (card.front.art as { scene: { source?: string } }).scene;
    assert.ok(scene.source, `${card.id}: no source structure`);
    assert.ok(shippedFamilies().some((f) => f.id === scene.source), `${card.id}: unknown source ${scene.source}`);
  }
});

test('pieces are taught in the simplest structure that has one', () => {
  const cards = new Map(fundamentalsDeck(LABELS).cards.map((c) => [c.id, c]));
  const src = (id: string) => (cards.get(id)!.front.art as { scene: { source?: string } }).scene.source;
  assert.equal(src('role:stud'), 'storage-shed', 'a stud is easiest to find in the simplest box');
  assert.equal(src('role:towerLeg'), 'tower', 'but a tower leg only exists in one place');
});

test('deck compilation costs are paid once — allDecks is not quadratic in the catalog', () => {
  // Thirteen structures generated for the deck list, thirteen more inside fundamentals. If this
  // ever starts taking seconds, the deck list is being recompiled per render.
  const t0 = process.hrtime.bigint();
  allDecks(LABELS);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 4000, `allDecks took ${Math.round(ms)}ms`);
});

// ── Card art ─────────────────────────────────────────────────────────────────

test('a highlight picks pieces out WITHOUT changing the picker drawing', () => {
  // The committed picker goldens are byte-compared, so the no-highlight path has to be
  // untouched. That is the whole reason `highlight` is an option rather than a mode.
  const spec = shippedFamilies().find((f) => f.id === 'gp-frame')!.preset;
  const plain = thumbnailFor(spec);
  assert.equal(thumbnailFor(spec), plain, 'the default path is unchanged and still deterministic');
  assert.ok(!plain.includes('#c2410c'), 'no highlight, no highlight colour');

  const ids = generateStructure(spec).members.filter((m) => m.role === 'post').map((m) => m.id);
  const marked = thumbnailFor(spec, { highlight: new Set(ids) });
  assert.ok(marked.includes('#c2410c'), 'the picked pieces get their own stroke');
  assert.ok(marked.includes('opacity="0.28"'), 'and the rest of the structure drops back');
  assert.equal(thumbnailFor(spec, { highlight: new Set(ids) }), marked, 'still deterministic');
});

test('a highlighted piece is drawn even when the LOD would normally skip it', () => {
  // A card about a subfloor panel that does not show the subfloor panel is not a card.
  const spec = shippedFamilies().find((f) => f.id === 'gp-frame')!.preset;
  const panels = generateStructure(spec).members.filter((m) => m.role === 'subfloor').map((m) => m.id);
  assert.ok(panels.length > 0);
  const marked = thumbnailFor(spec, { highlight: new Set(panels) });
  assert.ok(marked.includes('#c2410c'), 'the sheet good the LOD normally drops is drawn anyway');
});

test('every card in every deck resolves to a real drawing', () => {
  for (const entry of allDecks(LABELS)) {
    for (const card of entry.deck.cards) {
      const svg = cardArt(card, { spec: null, deckId: entry.deck.id });
      assert.ok(svg, `${entry.deck.id}/${card.id}: no art`);
      assert.ok(svg.startsWith('<svg') && svg.includes('#c2410c'), `${entry.deck.id}/${card.id}: nothing highlighted`);
      // The SVG namespace is a URI, not a fetch — it is the one allowed occurrence.
      assert.ok(
        !/https?:/i.test(svg.replace('http://www.w3.org/2000/svg', '')),
        `${entry.deck.id}/${card.id}: an external reference in card art`,
      );
      assert.ok(!/<script/i.test(svg), `${entry.deck.id}/${card.id}: script in card art`);
    }
  }
});

test('the sequence frames are drawn at the FINISHED building\'s scale', () => {
  // Fit each stage to its own extent and the footings fill the card, then the whole thing
  // shrinks as walls go up — five drawings that keep resizing instead of one building growing.
  // The proof: the LAST stage's drawing is byte-identical to the unclipped one, which can only
  // be true if every earlier frame shared that same box.
  const spec = shippedFamilies().find((f) => f.id === 'gp-frame')!.preset;
  const model = generateStructure(spec);
  const last = model.stagePlan[model.stagePlan.length - 1]!.ordinal;
  assert.equal(
    thumbnailFor(spec, { human: false, stageMax: last }),
    thumbnailFor(spec, { human: false }),
    'the final frame must be the whole building',
  );
  // And an early frame really does draw less, at the same scale.
  const early = thumbnailFor(spec, { human: false, stageMax: 1 });
  assert.ok(early.length < thumbnailFor(spec, { human: false }).length, 'stage 1 should draw fewer members');
  assert.ok(early.includes('viewBox="0 0 220 150"'));
});

test('a stage frame is drawn for every stage that actually puts something up', () => {
  // …and NOT drawn for one that does not. A stage plan may open with layout — string lines and
  // a level — that emits no members; an empty grey box beside that row reads as a broken
  // renderer, so the row goes without one.
  let blanks = 0;
  for (const f of shippedFamilies()) {
    if (f.id === 'custom') continue;
    const model = generateStructure(f.preset);
    for (const s of model.stagePlan) {
      const standing = model.members.some((m) => m.stage <= s.ordinal);
      const svg = stageArt(f.id, s.ordinal);
      if (!standing) { blanks += 1; assert.equal(svg, null, `${f.id} stage ${s.ordinal}: drew an empty frame`); continue; }
      assert.ok(svg && svg.startsWith('<svg'), `${f.id} stage ${s.ordinal}: no drawing`);
      assert.ok(svg.includes('<path d="M'), `${f.id} stage ${s.ordinal}: empty frame for a stage with members`);
    }
  }
  assert.ok(blanks > 0, 'if nothing is ever blank, this rule has stopped being exercised');
});

test('the fundamentals tile shows one of every piece, not a fifteenth building', () => {
  const entry = allDecks(LABELS)[0]!;
  assert.equal(entry.deck.id, FUNDAMENTALS_ID);
  assert.ok(entry.tileHighlight && entry.tileHighlight.length > 10, 'the tile needs pieces to pick out');
  const art = deckArt(entry.tileFamilyId!, entry.tileHighlight)!;
  assert.ok(art.includes('#c2410c'));
  // And a plain structure tile is genuinely different from it.
  assert.notEqual(deckArt('gp-frame'), art);
});

// ── The paper deck ───────────────────────────────────────────────────────────

test('the duplex mirror is right for each binding, and both degenerate cases are identities', () => {
  // Get this wrong and every card has somebody else's answer on its back — which a corporal
  // discovers after running off six sheets, and then never uses the feature again.
  assert.deepEqual(mirrorCell('long-edge', 0, 0), { r: 0, c: 1 }, 'long edge flips columns');
  assert.deepEqual(mirrorCell('long-edge', 1, 1), { r: 1, c: 0 });
  assert.deepEqual(mirrorCell('short-edge', 0, 0), { r: 1, c: 0 }, 'short edge flips rows');
  assert.deepEqual(mirrorCell('short-edge', 1, 1), { r: 0, c: 1 });
  assert.deepEqual(mirrorCell('manual', 1, 0), { r: 1, c: 0 }, 'a re-feed is not mirrored at all');

  // A one-column grid: `cols - 1 - c` is 0 for c=0, so a broken mirror passes here by accident.
  assert.deepEqual(mirrorCell('long-edge', 3, 0, 4, 1), { r: 3, c: 0 });
  assert.deepEqual(mirrorCell('short-edge', 0, 2, 1, 4), { r: 0, c: 2 });
});

test('the mirror is its own inverse — applying it twice returns the cell', () => {
  for (const mode of ['long-edge', 'short-edge', 'manual'] as DuplexMode[]) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const once = mirrorCell(mode, r, c);
        assert.deepEqual(mirrorCell(mode, once.r, once.c), { r, c }, `${mode} at (${r},${c})`);
      }
    }
  }
});

test('a card\'s back lands where the printer will put it', () => {
  const deck = fakeDeck(4);
  const sheets = sheetsFor(deck.cards, 'long-edge');
  assert.equal(sheets.length, 2, 'four cards is one sheet, two sides');
  const [front, back] = sheets;
  assert.equal(front!.side, 'front');
  assert.equal(back!.side, 'back');
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = mirrorCell('long-edge', r, c);
      assert.equal(back!.cells[m.r * COLS + m.c], front!.cells[r * COLS + c],
        `the back of (${r},${c}) must be at (${m.r},${m.c})`);
    }
  }
});

test('a manual run is all fronts, then all backs — not interleaved', () => {
  // A single-sided printer cannot alternate. Interleaving would have the operator re-feed the
  // stack between every sheet.
  const sides = sheetsFor(fakeDeck(9).cards, 'manual').map((s) => s.side);
  assert.deepEqual(sides, ['front', 'front', 'front', 'back', 'back', 'back']);
  // …and a duplexer DOES alternate, because it flips in the machine.
  assert.deepEqual(sheetsFor(fakeDeck(9).cards, 'long-edge').map((s) => s.side),
    ['front', 'back', 'front', 'back', 'front', 'back']);
});

test('a short last sheet is padded with blanks, never wrapped', () => {
  // Wrapping would print card 1 twice and leave a Marine holding a duplicate.
  const sheets = sheetsFor(fakeDeck(5).cards, 'long-edge');
  assert.equal(sheets.length, 4, 'five cards is two sheets');
  const last = sheets[2]!;
  assert.equal(last.cells.filter(Boolean).length, 1);
  assert.equal(last.cells.length, PER_SHEET, 'the grid is always full-size');
  const printed = sheets.filter((s) => s.side === 'front').flatMap((s) => s.cells).filter(Boolean);
  assert.equal(printed.length, 5, 'every card printed exactly once');
  assert.equal(new Set(printed).size, 5);
});

test('every card in a real deck reaches the paper, front and back', () => {
  const deck = allDecks(LABELS).find((d) => d.familyId === 'gp-frame')!.deck;
  const html = paperDeckHtml({
    deck,
    mode: 'long-edge',
    art: (card) => cardArt(card, { spec: null, deckId: deck.id }, { width: 320, height: 230 }),
  });
  for (const card of deck.cards) {
    assert.ok(html.includes(card.back.plain.slice(0, 30)), `${card.id}: its back never printed`);
  }
  assert.ok(html.includes(TIMBER_REGIME_LINE), 'the (PH) line travels onto the paper');
  assert.ok(html.includes(DUPLEX_LABEL['long-edge']), 'the chosen mode prints in the margin');
  assert.ok(!/<script|https?:/i.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'self-contained');
});

test('the paper deck is deterministic and capped', () => {
  const deck = allDecks(LABELS).find((d) => d.familyId === 'gp-frame')!.deck;
  const opts = { deck, mode: 'short-edge' as DuplexMode, art: () => null };
  assert.equal(paperDeckHtml(opts), paperDeckHtml(opts));
  // A 23-card deck is 12 sheets; nobody means to print that by accident, so the caller can cap.
  const capped = paperDeckHtml({ ...opts, maxCards: 4 });
  assert.equal((capped.match(/class="sheet"/g) ?? []).length, 2, 'four cards is one sheet, two sides');
});

// ── Storage ──────────────────────────────────────────────────────────────────

test('a fresh browser starts empty and quiet', () => {
  const { state, notices } = loadTrain(memStorage());
  assert.deepEqual(state.decks, {});
  assert.deepEqual(notices, []);
});

test('a round trip through storage preserves progress exactly', () => {
  const s = memStorage();
  let state = loadTrain(s).state;
  let p = mark(emptyProgress(), 'role:stud', true, 'identify');
  p = mark(p, 'role:stud', true, 'identify');
  state = withProgress(state, 'gp-frame', p);
  assert.ok(saveTrain(s, state));
  const back = loadTrain(s).state;
  assert.deepEqual(progressFor(back, 'gp-frame'), p);
  assert.equal(back.lastDeck, 'gp-frame');
});

test('garbage in storage resets rather than crashes, and says so', () => {
  for (const bad of ['{', 'null', '[]', '{"decks":3}', '"a string"']) {
    const { state, notices } = loadTrain(memStorage({ [STORAGE_KEY]: bad }));
    assert.deepEqual(state.decks, {}, `${bad} did not reset`);
    assert.ok(notices.length > 0, `${bad} reset silently`);
  }
});

test('a half-corrupt blob keeps the decks it can read', () => {
  const good = { session: 2, cards: { 'role:stud': { box: 1, lastSession: 1, lapses: 0, seen: 3, gotBy: ['identify'] } } };
  const raw = JSON.stringify({ version: 1, decks: { 'gp-frame': good, tower: { session: 'soon' }, hut: null } });
  const { state, notices } = loadTrain(memStorage({ [STORAGE_KEY]: raw }));
  assert.equal(Object.keys(state.decks).length, 1);
  assert.equal(state.decks['gp-frame']!.cards['role:stud']!.box, 1);
  assert.ok(notices.some((n) => n.includes('2')), `notice should name the count: ${notices.join(' / ')}`);
});

test('a hand-edited box or gotBy cannot mint mastery', () => {
  const raw = JSON.stringify({
    version: 1,
    decks: {
      d: {
        session: 1,
        cards: {
          a: { box: 9, lastSession: 0, lapses: 0, seen: 1, gotBy: ['identify'] },
          b: { box: 2, lastSession: 0, lapses: 0, seen: 1, gotBy: ['identify', 'wizard-mode', 42] },
          c: { box: 2, lastSession: 0, lapses: -5, seen: 1, gotBy: [] },
        },
      },
    },
  });
  const { state } = loadTrain(memStorage({ [STORAGE_KEY]: raw }));
  const cards = state.decks['d']!.cards;
  assert.equal(cards['a'], undefined, 'box 9 is not a box');
  assert.deepEqual(cards['b']!.gotBy, ['identify'], 'invented modes are dropped');
  assert.equal(cards['c'], undefined, 'a negative lapse count is not a count');
});

test('a storage that throws degrades to an unsaved session instead of a blank screen', () => {
  const hostile: StorageLike = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('quota'); },
    removeItem() { /* no-op */ },
  };
  const { state, notices } = loadTrain(hostile);
  assert.deepEqual(state.decks, {});
  assert.ok(notices.length > 0);
  assert.equal(saveTrain(hostile, state), false, 'a failed save reports, it does not throw');
});

test('resetting one deck leaves the others alone', () => {
  let state = loadTrain(memStorage()).state;
  state = withProgress(state, 'a', mark(emptyProgress(), 'x', true, 'flip'));
  state = withProgress(state, 'b', mark(emptyProgress(), 'y', true, 'flip'));
  state = resetDeck(state, 'a');
  assert.deepEqual(progressFor(state, 'a').cards, {});
  assert.equal(Object.keys(progressFor(state, 'b').cards).length, 1);
});

test('progress is per deck — mastering a piece in one does not mark it in another', () => {
  let state = loadTrain(memStorage()).state;
  let p = mark(emptyProgress(), 'role:stud', true, 'identify');
  p = mark(p, 'role:stud', true, 'identify');
  state = withProgress(state, FUNDAMENTALS_ID, p);
  const gp = allDecks(LABELS).find((d) => d.familyId === 'gp-frame')!.deck;
  assert.equal(deckMastery(gp, progressFor(state, 'gp-frame')).known, 0);
});

// ── The formatter the cards print with ───────────────────────────────────────

test('lengths print in eighths, and never as 8/8', () => {
  assert.equal(fmtFtIn(92.625), "7'-8 5/8\"");
  assert.equal(fmtFtIn(96), "8'-0\"");
  assert.equal(fmtFtIn(11.999), "1'-0\"", 'rounding must carry into feet, not print 0\'-11 8/8"');
  assert.equal(fmtFtIn(0), "0'-0\"");
  assert.equal(fmtFtIn(18.5), "1'-6 1/2\"");
  assert.equal(fmtFtIn(18.25), "1'-6 1/4\"");
});
