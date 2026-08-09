// TRAINING — the two printed handouts (F5).
//
// What is worth testing here is not the HTML. It is the two decisions that make a worksheet
// usable rather than decorative: WHICH pieces get numbered, and WHERE the numbers go. Both were
// got wrong on the first pass in ways that only showed up on paper — twelve numbers stacked on
// top of each other in the middle of a wall, pointing at pieces that were behind siding.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allDecks, type DeckEntry } from '../src/timber/train/decks';
import { plainName, whatItDoes } from '../src/ui/woodframe/labels';
import {
  GUTTER, SHEET_H, SHEET_W, layoutLeaders, pickWorksheetItems, posterHtml, worksheetHtml,
  type WorksheetItem,
} from '../src/timber/train/worksheet';

const LABELS = { plainName, whatItDoes };
const DECKS: DeckEntry[] = allDecks(LABELS);
const structureDecks = DECKS.filter((d) => d.kind === 'structure');

test('a worksheet labels each KIND of piece once, in build order', () => {
  for (const entry of structureDecks) {
    const picks = pickWorksheetItems(entry.deck);
    assert.ok(picks.length >= 4, `${entry.deck.id}: only ${picks.length} pieces to label`);
    assert.ok(picks.length <= 12, `${entry.deck.id}: ${picks.length} numbers is more than a sheet holds`);
    // A sheet with "stud" as the answer to four different numbers tests patience, not knowledge.
    const names = picks.map((p) => p.answer);
    assert.equal(new Set(names).size, names.length, `${entry.deck.id}: a kind of piece was labelled twice`);
    // BUILD ORDER, not drawing order — so the sheet doubles as a sequence question.
    const stages = picks.map((p) => p.card.minStage);
    assert.deepEqual(stages, [...stages].sort((a, b) => a - b), `${entry.deck.id}: not in build order`);
    for (const p of picks) assert.ok(p.memberId.length > 0 && p.answer.length > 0);
  }
});

/** A dozen pieces all projecting to nearly the same spot — the case that broke the first pass. */
const crowded: WorksheetItem[] = Array.from({ length: 12 }, (_, i) => ({
  n: i + 1,
  memberId: `m${i}`,
  answer: `piece ${i}`,
  x: 300 + (i % 3),
  y: 240 + (i % 4),
}));

test('numbered discs never collide, however crowded the pieces are', () => {
  const placed = layoutLeaders(crowded);
  assert.equal(placed.length, crowded.length, 'every piece got a number');
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      const gap = Math.hypot(a.tx - b.tx, a.ty - b.ty);
      assert.ok(gap >= 22, `discs ${a.n} and ${b.n} are ${gap.toFixed(1)} apart — they overlap`);
    }
  }
});

test('discs sit in the margins and stay on the page', () => {
  for (const items of [crowded, crowded.map((c, i) => ({ ...c, x: i * 60, y: i * 35 }))]) {
    for (const p of layoutLeaders(items)) {
      // In a gutter, on one side or the other — never over the drawing it points at.
      assert.ok(p.tx <= GUTTER || p.tx >= SHEET_W - GUTTER, `disc ${p.n} landed on the drawing at x=${p.tx}`);
      assert.ok(p.ty >= 8 && p.ty <= SHEET_H - 8, `disc ${p.n} printed off the page at y=${p.ty}`);
    }
  }
});

test('leaders do not cross: within a column, the order down the page follows the pieces', () => {
  const items: WorksheetItem[] = [
    { n: 1, memberId: 'a', answer: 'a', x: 100, y: 400 },
    { n: 2, memberId: 'b', answer: 'b', x: 120, y: 100 },
    { n: 3, memberId: 'c', answer: 'c', x: 90, y: 250 },
  ];
  const placed = layoutLeaders(items);
  const left = placed.filter((p) => p.tx < SHEET_W / 2).sort((a, b) => a.ty - b.ty);
  // Sorted by disc height, the pieces they point at must also ascend — otherwise two leader
  // lines cross, and a reader following one arrives at somebody else's piece.
  const ys = left.map((p) => p.y);
  assert.deepEqual(ys, [...ys].sort((a, b) => a - b), 'leader lines cross');
});

test('the sheet prints its question, its blanks, its key, and its provenance', () => {
  const entry = structureDecks[0]!;
  const picks = pickWorksheetItems(entry.deck);
  const items: WorksheetItem[] = picks.map((p, i) => ({
    n: i + 1, memberId: p.memberId, answer: p.answer, x: 100 + i * 40, y: 120 + i * 20,
  }));
  const html = worksheetHtml({
    title: 'Test structure',
    lineage: 'FM 5-426 (public release)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    items,
    footnote: 'Teaching aid, not a work order.',
  });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('Name each numbered piece.'), 'the task is stated');
  assert.ok(html.includes('answer key'), 'the key page exists — an instructor needs both halves');
  assert.ok(html.includes('FM 5-426 (public release)'), 'a sheet carries where it came from');
  assert.ok(html.includes('Teaching aid, not a work order.'), 'and what it is not');
  // The answers appear ONCE, on the key — a blank whose answer is printed beside it is not a
  // blank. The first page has ruled lines instead.
  for (const it of items) {
    assert.equal(html.split(`>${it.answer}<`).length - 1, 1, `${it.answer} appears more than once`);
  }
  assert.equal(html.split('class="rule"').length - 1, items.length, 'one ruled blank per number');
  assert.ok(!/<script|https?:/i.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'self-contained');
});

test('the poster prints one frame per stage, and says so when nothing stands yet', () => {
  const html = posterHtml({
    title: 'Test structure',
    lineage: 'FM 5-426 (public release)',
    stages: [
      { ordinal: 1, label: 'Layout', detail: 'String lines and a level.', svg: null },
      { ordinal: 2, label: 'Sills', detail: 'Bedded on the piers.', svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' },
    ],
    footnote: 'Teaching aid, not a work order.',
  });
  assert.ok(html.includes('the order it goes up'));
  assert.ok(html.includes('Layout') && html.includes('Sills'));
  assert.ok(html.includes('String lines and a level.'), 'the WHY is the point of the poster');
  // A stage can legitimately put nothing on the ground. An empty box reads as a broken render;
  // the words do not.
  assert.ok(html.includes('nothing standing yet'));
  assert.ok(!/<script|https?:/i.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'self-contained');
});
