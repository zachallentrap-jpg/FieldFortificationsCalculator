// 1371 LEARNING — printing the two handouts that are not flashcards.
//
// The browser half of `train/worksheet.ts`: project the drawings, hand the pure module its
// strings, and print from an off-screen frame. Everything that decides WHAT is on the paper —
// which pieces get labelled, in what order, where the leaders point — is pure and tested.
//
// Printing from a FRAME rather than a pop-up, for the reason the command packet learned the
// hard way: any dialog first spends the user gesture, so `window.open` comes back null and the
// fallback prints whatever page the operator was already looking at.

import { drawPortrait, portraitCached } from '../../timber/portrait';
import { familyById, type FamilyId } from '../../timber/catalog';
import { generateStructure } from '../../timber/families/index';
import {
  GUTTER, SHEET_H, SHEET_W, pickWorksheetItems, posterHtml, worksheetHtml,
  type PosterStage, type WorksheetItem,
} from '../../timber/train/worksheet';
import type { DeckSpec } from '../../timber/train/core';

/**
 * What comes OFF a worksheet drawing: everything that closes a building in.
 *
 * They are real members and they get their own cards — but a sheet asking you to find framing
 * cannot be a picture of siding, and every one of these hides the pieces underneath it.
 */
const SKINS: ReadonlySet<string> = new Set([
  'siding', 'sidingBoard', 'batten', 'sheathingPanel', 'roofingCourse', 'ridgeCap',
  'felt', 'buildingPaper', 'roofPanel', 'soilGhost',
]);

/** The standing honesty line. Same words as the trainer's footer, because it is the same claim. */
const FOOTNOTE =
  'Teaching aid, not a work order. Framing follows FM 5-426 (public release); a citation marked (PH) '
  + 'is pending a manual page check. Sizes and lengths come from this structure — they are what this '
  + 'tool drew, not what a manual specifies. Plan a real structure in the Planning app.';

/** Print an HTML document from an off-screen frame. Shared by both handouts. */
function printDocument(html: string): boolean {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  // Off-screen rather than display:none — a frame with no box never lays out, and a document
  // that never laid out prints as blank sheets.
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:8.5in;height:11in;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) { frame.remove(); return false; }
  doc.open();
  doc.write(html);
  doc.close();
  const win = frame.contentWindow;
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(() => frame.remove(), 60_000);
  }, 400);
  return true;
}

/**
 * A label-the-diagram sheet for one structure.
 *
 * `markFocus: false` is the whole trick: the labelled pieces are used to place the leaders and
 * nothing else. Colouring them would print the answer in the picture, which is a worksheet that
 * grades itself and teaches nobody.
 */
export function printWorksheet(familyId: string, deck: DeckSpec): boolean {
  const family = familyById(familyId as FamilyId);
  if (!family) return false;
  const picks = pickWorksheetItems(deck);
  if (picks.length === 0) return false;

  const { svg, anchors } = drawPortrait(family.preset, {
    // Inset by the gutters the numbered discs live in, so a leader never has to cross the
    // drawing to reach its number.
    width: SHEET_W - 2 * GUTTER,
    height: SHEET_H,
    focus: new Set(picks.map((p) => p.memberId)),
    markFocus: false,
    // THE FRAME, NOT THE FINISHED BUILDING. A worksheet asks a reader to find a jack stud, and
    // a finished building has siding over every jack stud in it — the first sheet pointed six
    // numbers at a blank wall. Sheet goods come off; what is left is what can be named.
    omit: SKINS,
    background: '#ffffff',
  });
  // The drawing sits inside the gutters, so its own x is a gutter short of the page's.
  const at = new Map(anchors.map((a) => [a.id, { x: a.x + GUTTER, y: a.y }]));
  // A piece can be entirely hidden behind another at this angle, in which case it has no anchor
  // and there is nothing honest to point at — drop it and renumber, rather than run a leader to
  // a spot the reader cannot see.
  const items: WorksheetItem[] = [];
  for (const p of picks) {
    const a = at.get(p.memberId);
    if (!a) continue;
    items.push({ n: items.length + 1, memberId: p.memberId, answer: p.answer, x: a.x, y: a.y });
  }
  if (items.length === 0) return false;

  return printDocument(worksheetHtml({
    title: family.name,
    lineage: family.lineage,
    svg,
    items,
    footnote: FOOTNOTE,
  }));
}

/** The build sequence on one sheet, one frame per stage. */
export function printStagePoster(familyId: string): boolean {
  const family = familyById(familyId as FamilyId);
  if (!family) return false;
  const model = generateStructure(family.preset);
  const stages: PosterStage[] = model.stagePlan.map((s) => {
    // `fitAll` draws every frame at the FINISHED structure's scale, so the sequence reads as
    // one building growing rather than nine drawings that keep resizing.
    const svg = portraitCached(`poster:${familyId}:${s.ordinal}`, family.preset, {
      width: 240, height: 160, stageMax: s.ordinal, fitAll: true,
    });
    return {
      ordinal: s.ordinal,
      label: s.label,
      detail: s.detail,
      // A stage can legitimately put nothing on the ground — a guard shack's layout step is
      // string lines and a level. An empty box reads as a rendering failure; the words do not.
      svg: svg.includes('<polygon') ? svg : null,
    };
  });
  return printDocument(posterHtml({
    title: family.name,
    lineage: family.lineage,
    stages,
    footnote: FOOTNOTE,
  }));
}
