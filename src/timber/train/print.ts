// TRAINING — the paper deck (TRAINING_AND_PACKETS_PLAN §3.4.1, F5). Pure, node-tested.
//
// The whole trainer assumes a phone. A working party does not have one out, a classroom may
// not allow one, and a card that can be handed to the Marine beside you is a different
// teaching object from a card on a screen. This prints the SAME `DeckSpec` the app drills —
// same fronts, same backs, same citations, same (PH) marks — four to a sheet, duplex.
//
// THE DUPLEX MIRROR IS THE ENTIRE PROBLEM, and it is why three modes ship rather than one.
// A printer set to long-edge binding flips the sheet about its vertical axis, so the back of
// the card in the top-LEFT cell comes out of the printer in the top-RIGHT cell. Short-edge
// flips about the horizontal axis instead. Get it wrong and every card has somebody else's
// answer on the back — which a corporal discovers after running off six sheets, and then
// never uses the feature again. Company printers are routinely configured either way and
// plenty are simplex only, so all three are offered and the chosen one prints in the margin.

import type { CardSpec, DeckSpec } from './core';

export type DuplexMode =
  /** Printer flips about the vertical axis: mirror the COLUMNS. */
  | 'long-edge'
  /** Printer flips about the horizontal axis: mirror the ROWS. */
  | 'short-edge'
  /** No duplexer: all fronts, then all backs, re-fed by hand. No mirror at all. */
  | 'manual';

export const DUPLEX_LABEL: Record<DuplexMode, string> = {
  'long-edge': 'Duplex, long-edge binding (flip on the long side)',
  'short-edge': 'Duplex, short-edge binding (flip on the short side)',
  manual: 'Single-sided — print all fronts, re-feed, then print all backs',
};

export const ROWS = 2;
export const COLS = 2;
export const PER_SHEET = ROWS * COLS;

/**
 * Where cell (r, c) of the FRONT sheet has to sit on the BACK sheet so the two line up after
 * the printer flips the paper.
 *
 * The one-column and one-row cases are identities, and they are exactly the cases a mirror
 * written as `cols - 1 - c` silently gets right for the wrong reason — so both are tested.
 */
export function mirrorCell(mode: DuplexMode, r: number, c: number, rows = ROWS, cols = COLS): { r: number; c: number } {
  if (mode === 'long-edge') return { r, c: cols - 1 - c };
  if (mode === 'short-edge') return { r: rows - 1 - r, c };
  return { r, c };
}

export interface Sheet {
  /** Card per cell, row-major. `null` is a blank cell on a short last sheet. */
  readonly cells: readonly (CardSpec | null)[];
  readonly side: 'front' | 'back';
  readonly sheet: number;
}

/**
 * Lay a deck out into printable sheets. Fronts and backs interleave for a duplexer and
 * separate into two runs for manual re-feed, because those are physically different jobs.
 */
export function sheetsFor(cards: readonly CardSpec[], mode: DuplexMode): Sheet[] {
  const groups: (CardSpec | null)[][] = [];
  for (let i = 0; i < cards.length; i += PER_SHEET) {
    const g: (CardSpec | null)[] = cards.slice(i, i + PER_SHEET);
    while (g.length < PER_SHEET) g.push(null);
    groups.push(g);
  }

  const backOf = (g: (CardSpec | null)[]): (CardSpec | null)[] => {
    const out: (CardSpec | null)[] = new Array(PER_SHEET).fill(null);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const m = mirrorCell(mode, r, c);
        out[m.r * COLS + m.c] = g[r * COLS + c] ?? null;
      }
    }
    return out;
  };

  const sheets: Sheet[] = [];
  if (mode === 'manual') {
    // Every front, then every back, in re-feed order — a single-sided printer stacks its
    // output face-down, so the operator gets the stack back in the order they need it.
    groups.forEach((g, i) => sheets.push({ cells: g, side: 'front', sheet: i + 1 }));
    groups.forEach((g, i) => sheets.push({ cells: backOf(g), side: 'back', sheet: i + 1 }));
    return sheets;
  }
  groups.forEach((g, i) => {
    sheets.push({ cells: g, side: 'front', sheet: i + 1 });
    sheets.push({ cells: backOf(g), side: 'back', sheet: i + 1 });
  });
  return sheets;
}

/** Art for a card front, injected — the projector lives outside this pure module. */
export type CardArtFn = (card: CardSpec) => string | null;

export interface PaperDeckInput {
  deck: DeckSpec;
  mode: DuplexMode;
  art: CardArtFn;
  /** Cap the run; a 49-card deck is 25 sheets and nobody meant to print that by accident. */
  maxCards?: number;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function frontCell(card: CardSpec | null, art: CardArtFn): string {
  if (!card) return '<div class="cell blank"></div>';
  const svg = art(card);
  return `<div class="cell">
    <div class="art">${svg ?? `<p class="noart">${esc(card.back.name)}</p>`}</div>
    <p class="q">${esc(card.front.prompt ?? 'What is this piece?')}</p>
  </div>`;
}

function backCell(card: CardSpec | null): string {
  if (!card) return '<div class="cell blank"></div>';
  const facts = card.back.facts.map((f) => {
    const src = f.source === 'this-build' || f.source === 'count'
      ? '<i>this structure</i>'
      : f.cite && f.cite !== f.text ? `<i>${esc(f.cite)}</i>` : '';
    return `<li><b>${esc(f.label)}</b> ${esc(f.text)} ${src}</li>`;
  }).join('');
  return `<div class="cell back">
    <h3>${esc(card.back.name.charAt(0).toUpperCase() + card.back.name.slice(1))}</h3>
    <p class="what">${esc(card.back.plain)}</p>
    <p class="where">${esc(card.back.whereItGoes)}</p>
    <ul class="facts">${facts}</ul>
    <p class="regime">${esc(card.back.regimeLine)}</p>
  </div>`;
}

export function paperDeckHtml(input: PaperDeckInput): string {
  const cards = input.deck.cards.slice(0, input.maxCards ?? input.deck.cards.length);
  const sheets = sheetsFor(cards, input.mode);
  const foot = `${esc(input.deck.title)} · ${cards.length} cards · ${esc(DUPLEX_LABEL[input.mode])}`;

  const pages = sheets.map((s) => `<section class="sheet">
      <div class="grid">${s.cells.map((c) => (s.side === 'front' ? frontCell(c, input.art) : backCell(c))).join('')}</div>
      <p class="mark">${foot} · sheet ${s.sheet} ${s.side}</p>
    </section>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(input.deck.title)} — paper deck</title>
<style>
  /* Cut marks and the mode label live in the SHEET MARGIN, never in a card cell — a
     calibration mark that burns a cell costs a card on every sheet. */
  @page { size: letter portrait; margin: 0.4in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.4 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* 10.2in is the Letter content box at 0.4in margins; the grid gets 10in and the margin
     line the rest, so the label can never push a row onto the next sheet. */
  .sheet { height: 10.2in; display: flex; flex-direction: column; }
  .sheet + .sheet { break-before: page; page-break-before: always; }
  .grid { flex: 1; max-height: 10in; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0; }
  /* A dashed rule on every cell edge IS the cut line — no separate crop marks to align. */
  .cell { border: 1px dashed #666; padding: 0.18in; display: flex; flex-direction: column; overflow: hidden; }
  .cell.blank { border-style: dashed; }
  .art { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
  .art svg { width: 100%; height: auto; max-height: 3.1in; }
  .noart { font-size: 20px; font-weight: 600; text-align: center; }
  .q { margin: 4px 0 0; font-size: 12px; text-align: center; color: #333; }
  .back h3 { margin: 0; font-size: 15px; }
  .back .what { margin: 3px 0 0; font-size: 12px; line-height: 1.35; }
  .back .where { margin: 3px 0 0; font-size: 11px; color: #444; }
  .facts { margin: 5px 0 0; padding-left: 14px; font-size: 11px; }
  .facts li { margin: 1px 0; }
  .facts i { color: #444; }
  .regime { margin-top: auto; padding-top: 4px; font-size: 9.5px; color: #444; }
  .mark { margin: 0.06in 0 0; font-size: 8.5px; color: #444; text-align: center; }
</style></head>
<body>${pages}</body></html>`;
}
