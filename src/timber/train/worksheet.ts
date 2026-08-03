// TRAINING — the paper that is not a flashcard (TRAINING_AND_PACKETS_PLAN §3.4.2, F5).
//
// Two printables, and the reason they exist is the same reason the paper deck does: a working
// party does not have a phone out, and a classroom may not allow one. But they are not the
// deck. A deck drills ONE piece at a time and grades itself; these two do the things a deck
// structurally cannot:
//
//   THE WORKSHEET is a whole building with numbered leaders pointing at a dozen pieces and a
//   blank list to fill in. It tests the thing an instructor actually wants tested — whether a
//   Marine can find a jack stud IN A WALL, not whether they recognise one card. A deck can
//   never ask that, because a card only ever shows you the piece it is about.
//
//   THE STAGE POSTER is the build sequence on one sheet: what stands after each stage, in
//   order, with the reason. It goes on the wall of the shop, or in a hip pocket at the site,
//   and it answers "what goes up next" for a crew that is not looking at a screen.
//
// Both are PURE. They take pre-rendered SVG and return an HTML string, so the whole layout —
// which pieces get labelled, how the answer key is ordered, what the leader lines connect —
// is decided in a module that runs under `node --test`. What is not pure is the projection,
// and that is injected.

import type { CardSpec, DeckSpec } from './core';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One numbered leader on a worksheet: where it points, and what the answer is. */
export interface WorksheetItem {
  readonly n: number;
  readonly memberId: string;
  readonly answer: string;
  /** Where the piece landed on the drawing, in the SVG's own viewBox units. */
  readonly x: number;
  readonly y: number;
}

/**
 * Choose what to label, and in what order.
 *
 * THE ORDER IS THE POINT and it is deliberately not the drawing's. Numbers run in BUILD ORDER —
 * foundation first, roof last — so the worksheet doubles as a sequence question even when the
 * reader is only naming pieces. Numbering them by where they happen to fall on the paper would
 * teach the layout of one drawing.
 *
 * Two pieces of the same kind are never both labelled: a sheet with "stud" as the answer to
 * four different numbers tests patience.
 */
export function pickWorksheetItems(deck: DeckSpec, max = 12): { memberId: string; answer: string; card: CardSpec }[] {
  const seen = new Set<string>();
  const out: { memberId: string; answer: string; card: CardSpec }[] = [];
  const inOrder = [...deck.cards].sort((a, b) =>
    a.minStage - b.minStage || (a.back.name < b.back.name ? -1 : a.back.name > b.back.name ? 1 : 0));
  for (const card of inOrder) {
    if (out.length >= max) break;
    if (card.front.art.kind !== 'scene') continue;
    const id = card.front.art.scene.memberIds[0];
    if (!id || seen.has(card.back.name)) continue;
    seen.add(card.back.name);
    out.push({ memberId: id, answer: card.back.name, card });
  }
  return out;
}

export interface WorksheetInput {
  title: string;
  /** The publication line, so a sheet handed to somebody carries its own provenance. */
  lineage: string;
  /** The drawing, already projected, with `markFocus: false` so it gives nothing away. */
  svg: string;
  items: readonly WorksheetItem[];
  /** A second page with the answers filled in. An instructor needs both halves. */
  withKey?: boolean;
  /** The standing honesty line every printable in this toolkit carries. */
  footnote: string;
}

/** Page geometry. The drawing sits between two gutters that hold nothing but numbers. */
export const SHEET_W = 720;
export const SHEET_H = 480;
export const GUTTER = 46;
const DISC_R = 11;
const MIN_GAP = 27;

/** Where each numbered disc ends up, after the crowding is resolved. */
export interface LeaderPlacement { n: number; x: number; y: number; tx: number; ty: number }

/**
 * PUT THE NUMBERS IN THE MARGINS, one column each side, and run a line in to the piece.
 *
 * The first version pushed each disc a fixed distance radially out from the drawing's centre.
 * On a building that is mostly one long wall, six pieces project to nearly the same point, so
 * six discs landed on top of each other and on the wall they were pointing at — unreadable, and
 * it hid the very thing being asked about. Margin columns cannot collide by construction: each
 * disc gets its own row, and the only thing left to solve is the ORDER, which is by height so
 * the leader lines do not cross.
 */
export function layoutLeaders(
  items: readonly WorksheetItem[],
  w = SHEET_W,
  h = SHEET_H,
  gutter = GUTTER,
): LeaderPlacement[] {
  const mid = w / 2;
  const columns: { side: -1 | 1; list: WorksheetItem[] }[] = [
    { side: -1, list: items.filter((i) => i.x < mid) },
    { side: 1, list: items.filter((i) => i.x >= mid) },
  ];
  // Even out a lopsided sheet: a wall of pieces all on one side would need more rows than the
  // page has, so the overflow moves across rather than being squeezed.
  const cap = Math.floor((h - 2 * DISC_R) / MIN_GAP) + 1;
  for (const c of columns) {
    if (c.list.length <= cap) continue;
    const other = columns.find((o) => o !== c)!;
    other.list.push(...c.list.splice(cap));
  }

  const out: LeaderPlacement[] = [];
  for (const c of columns) {
    const list = [...c.list].sort((a, b) => a.y - b.y);
    const span = Math.max(0, (list.length - 1) * MIN_GAP);
    // Centred on the pieces' own average height, so the column sits where the work is, then
    // clamped inside the page.
    const mean = list.reduce((sum, i) => sum + i.y, 0) / Math.max(1, list.length);
    let top = Math.min(Math.max(mean - span / 2, DISC_R + 2), h - DISC_R - 2 - span);
    if (span > h - 2 * (DISC_R + 2)) top = DISC_R + 2;
    list.forEach((it, i) => {
      out.push({
        n: it.n,
        x: it.x,
        y: it.y,
        tx: c.side === -1 ? gutter / 2 : w - gutter / 2,
        ty: top + i * MIN_GAP,
      });
    });
  }
  return out.sort((a, b) => a.n - b.n);
}

function leader(p: LeaderPlacement): string {
  return `<line x1="${p.x}" y1="${p.y}" x2="${p.tx}" y2="${p.ty}" stroke="#111" stroke-width="1" stroke-opacity="0.85"/>`
    + `<circle cx="${p.x}" cy="${p.y}" r="2.6" fill="#111"/>`
    + `<circle cx="${p.tx}" cy="${p.ty}" r="${DISC_R}" fill="#fff" stroke="#111" stroke-width="1.4"/>`
    + `<text x="${p.tx}" y="${p.ty + 4.4}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#111">${p.n}</text>`;
}

export function worksheetHtml(input: WorksheetInput): string {
  const w = SHEET_W;
  const h = SHEET_H;
  const overlay = layoutLeaders(input.items, w, h).map(leader).join('');
  // The drawing and the leaders are two stacked layers in one positioned box, so the overlay's
  // coordinates are the drawing's coordinates and nothing has to be transformed twice.
  const plate = `<div class="plate">
      <div class="art">${input.svg}</div>
      <svg class="over" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${overlay}</svg>
    </div>`;

  const blanks = input.items.map((it) =>
    `<li><span class="n">${it.n}</span><span class="rule"></span></li>`).join('');
  const answers = input.items.map((it) =>
    `<li><span class="n">${it.n}</span><span class="ans">${esc(it.answer)}</span></li>`).join('');

  const page = (heading: string, list: string, keyed: boolean): string => `<section class="sheet${keyed ? ' key' : ''}">
      <header>
        <h1>${esc(input.title)}</h1>
        <p class="lineage">${esc(input.lineage)}</p>
        <p class="task">${esc(heading)}</p>
      </header>
      ${plate}
      <ol class="answers">${list}</ol>
      <p class="foot">${esc(input.footnote)}</p>
    </section>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(input.title)} — label the diagram</title>
<style>
  @page { size: letter portrait; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { height: 10in; display: flex; flex-direction: column; }
  .sheet + .sheet { break-before: page; page-break-before: always; }
  header h1 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
  .lineage { margin: 2px 0 0; font-size: 10px; color: #555; }
  .task { margin: 8px 0 6px; font-size: 12.5px; font-weight: 600; }
  /* The drawing sits in a positioned box and the leader overlay sits exactly on top of it, so
     one set of coordinates serves both — no second transform to keep in step. */
  .plate { position: relative; width: 100%; }
  /* The drawing is inset by the gutters the numbers live in, and the overlay spans the WHOLE
     plate — one coordinate system, with the drawing's own x already offset by a gutter when
     the anchors were taken. */
  .plate .art { margin: 0 0; }
  .plate .art svg, .plate .over { display: block; width: 100%; height: auto; }
  .plate .over { position: absolute; inset: 0; }
  .answers { list-style: none; margin: 12px 0 0; padding: 0; display: grid;
             grid-template-columns: 1fr 1fr; gap: 7px 26px; }
  .answers li { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; }
  .answers .n { flex: none; width: 21px; height: 21px; border: 1.4px solid #111; border-radius: 50%;
                text-align: center; line-height: 18px; font-weight: 700; font-size: 12px; }
  /* A ruled line, not an underlined blank: somebody is writing on this with a pencil in the rain. */
  .answers .rule { flex: 1; border-bottom: 1px solid #111; height: 15px; }
  .answers .ans { flex: 1; border-bottom: 1px solid #bbb; font-weight: 600; text-transform: capitalize; }
  .key header h1::after { content: " — answer key"; font-weight: 400; color: #555; }
  .foot { margin-top: auto; padding-top: 8px; font-size: 9.5px; color: #555; line-height: 1.4; }
</style></head>
<body>${page('Name each numbered piece.', blanks, false)}${input.withKey === false ? '' : page('Answer key.', answers, true)}</body></html>`;
}

// ── The stage poster ─────────────────────────────────────────────────────────

export interface PosterStage {
  ordinal: number;
  label: string;
  detail?: string;
  /** The structure as it stood at the end of this stage. Null when nothing stands yet. */
  svg: string | null;
}

export interface PosterInput {
  title: string;
  lineage: string;
  stages: readonly PosterStage[];
  footnote: string;
}

/**
 * The build sequence on one sheet.
 *
 * Every frame is drawn at the FINISHED structure's scale by the caller, which is what makes the
 * sequence read as one building growing rather than as nine drawings that keep resizing — the
 * same rule the on-screen sequence screen follows, and for the same reason.
 */
export function posterHtml(input: PosterInput): string {
  const cells = input.stages.map((s) => `<li>
      <div class="shot">${s.svg ?? '<span class="nothing">nothing standing yet</span>'}</div>
      <div class="cap"><b>${s.ordinal}</b><span>${esc(s.label)}</span></div>
      ${s.detail ? `<p class="why">${esc(s.detail)}</p>` : ''}
    </li>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(input.title)} — the order it goes up</title>
<style>
  @page { size: letter portrait; margin: 0.45in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11px/1.4 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.012em; }
  .lineage { margin: 2px 0 12px; font-size: 10px; color: #555; }
  ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  li { break-inside: avoid; }
  .shot { background: #17181b; border-radius: 5px; overflow: hidden; display: flex;
          align-items: center; justify-content: center; min-height: 1.25in; }
  .shot svg { display: block; width: 100%; height: auto; }
  .nothing { color: #6b6b70; font-size: 9.5px; padding: 18px 8px; text-align: center; }
  .cap { display: flex; align-items: baseline; gap: 6px; margin-top: 5px; }
  .cap b { flex: none; width: 17px; height: 17px; border-radius: 50%; background: #111; color: #fff;
           text-align: center; line-height: 17px; font-size: 10.5px; }
  .cap span { font-weight: 640; font-size: 11.5px; }
  .why { margin: 3px 0 0 23px; font-size: 9.8px; color: #444; line-height: 1.38; }
  .foot { margin-top: 14px; font-size: 9.5px; color: #555; line-height: 1.4; }
</style></head>
<body>
  <h1>${esc(input.title)} — the order it goes up</h1>
  <p class="lineage">${esc(input.lineage)}</p>
  <ol>${cells}</ol>
  <p class="foot">${esc(input.footnote)}</p>
</body></html>`;
}
