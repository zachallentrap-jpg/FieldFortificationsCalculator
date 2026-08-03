// 1371 LEARNING — printing the deck.
//
// The browser half of the paper deck: ask which way the printer flips, render the sheets, and
// print them from an off-screen frame. Everything that decides WHAT goes on the paper — the
// mirror, the sheet layout, the padding of a short last sheet — is pure and tested in
// `src/timber/train/print.ts`. This is the DOM.
//
// Printing from a frame rather than a pop-up for the reason the command packet learned the
// hard way: asking anything first spends the user gesture, so `window.open` comes back null
// and the fallback prints the page the operator was already looking at.

import { DUPLEX_LABEL, paperDeckHtml, type DuplexMode } from '../../timber/train/print';
import type { DeckSpec } from '../../timber/train/core';
import { cardArt } from './art';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ask, then print. Resolves false if the operator backs out. */
export function printPaperDeck(deck: DeckSpec, familyId: string | null): Promise<boolean> {
  const dlg = document.createElement('dialog');
  dlg.className = 'pktdlg';
  const sheets = Math.ceil(deck.cards.length / 4);
  dlg.innerHTML = `
    <form method="dialog">
      <h2>Print the deck</h2>
      <p>${deck.cards.length} cards, four to a sheet — ${sheets} sheets, printed both sides.
         Cut on the dashed lines.</p>
      <label>How does your printer flip the paper?
        <select name="mode">
          ${(Object.keys(DUPLEX_LABEL) as DuplexMode[])
            .map((m) => `<option value="${m}">${esc(DUPLEX_LABEL[m])}</option>`).join('')}
        </select>
        <small>Get this wrong and every card has somebody else's answer on the back. If you are
          not sure, print one sheet first and check.</small>
      </label>
      <div class="pktdlg-row">
        <button value="cancel" class="chip" type="submit">Cancel</button>
        <button value="go" class="chip chip--go" type="submit">Print</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);

  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      const form = dlg.querySelector('form') as HTMLFormElement;
      const mode = (form.elements.namedItem('mode') as HTMLSelectElement).value as DuplexMode;
      const go = dlg.returnValue === 'go';
      dlg.remove();
      if (!go) { resolve(false); return; }

      const html = paperDeckHtml({
        deck,
        mode,
        art: (card) => cardArt(card, { spec: null, deckId: familyId ?? deck.id }, { width: 340, height: 250 }),
      });
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      // Off-screen rather than display:none — a frame with no box never lays out, and a
      // document that never laid out prints as blank sheets.
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:8.5in;height:11in;border:0;opacity:0;pointer-events:none;';
      document.body.appendChild(frame);
      const doc = frame.contentDocument;
      if (!doc || !frame.contentWindow) { frame.remove(); resolve(false); return; }
      doc.open();
      doc.write(html);
      doc.close();
      const win = frame.contentWindow;
      window.setTimeout(() => {
        win.focus();
        win.print();
        window.setTimeout(() => frame.remove(), 60_000);
      }, 400);
      resolve(true);
    }, { once: true });
    dlg.showModal();
  });
}
