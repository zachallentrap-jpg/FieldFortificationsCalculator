// The COMMAND PACKET — the planning app's actual deliverable.
//
// "have a clean sheet for their command to send off or print out and show their CO." Everything
// else in the planning app exists so this document is right: one packet that says what is being
// built, out of what, in what order, what has to be drawn from supply, and what is still
// pending a page check — with the pending parts printed in the open rather than buried.
//
// This file is now a THIN ADAPTER. The packet is compiled in `src/timber/packet/model.ts` and
// rendered in `packet/html.ts`, both pure and both node-tested, because the decisions that
// matter — what counts as a life-safety value in this build, what a crew ceiling is, whether a
// citation is pending — are decisions that have to be checkable without a browser. What is
// left here is the two things only a browser can do: draw the cover art and open the window.
//
// Two deliberate refusals, unchanged:
//   · Nothing is filled in for the operator. Unit, date, prepared-by and approver are blank
//     lines, because a document that pre-signs itself is a document nobody checked.
//   · Every (PH) citation stays visible. The point of a command packet is that the person
//     signing it can see which numbers have been page-checked and which have not.

import type { StructureModel } from '../../timber/families/index';
import { packetHtml } from '../../timber/packet/html';
import { packetModel } from '../../timber/packet/model';
import { thumbnailFor } from '../../timber/thumbnails';
import { plainName } from './labels';
import { DEFAULT_STOCK_FT } from '../../timber/purchase';
import { DEFAULT_PRODUCTIVE_HOURS } from '../../timber/packet/labor';

export interface SheetInput {
  model: StructureModel;
  title: string;
  lineage: string;
  /** A still of the 3D view, as a data URI, when the canvas could give one. */
  viewImage?: string | null;
  /** Operator inputs — arithmetic divisors with clamps, never doctrinal claims. */
  crewSizes?: readonly number[];
  productiveHoursPerDay?: number;
  stockLengthsFt?: readonly number[];
}

/**
 * The whole document as one HTML string. Returned rather than written to the DOM so a caller
 * can put it in a print window, a new tab, or a test.
 */
export function commandSheetHtml(input: SheetInput): string {
  return packetHtml(packetModel(input.model, {
    title: input.title,
    lineage: input.lineage,
    viewImage: input.viewImage ?? null,
    // Line art rather than a screenshot on the cover: it prints and photocopies, and it is
    // drawn from the same members as everything else on the page.
    coverArt: thumbnailFor(input.model.spec, { width: 440, height: 250 }),
    plainName: (role) => plainName(role as never),
    crewSizes: input.crewSizes,
    productiveHoursPerDay: input.productiveHoursPerDay,
    stockLengthsFt: input.stockLengthsFt,
  }));
}

/**
 * Print the packet.
 *
 * VIA A HIDDEN IFRAME, NOT A POP-UP, and the reason is worth writing down because the pop-up
 * version looked fine until it was driven end to end. Asking for the crew and stock numbers
 * first puts a promise between the button click and the print call, which spends the user
 * gesture — so `window.open` came back null, the code fell back to `window.print()`, and the
 * operator got a printout of the WORKBENCH instead of their packet. A blocked pop-up is not an
 * edge case here; it is the normal path once anything is asked first.
 *
 * An iframe needs no gesture, no pop-up permission and no second window to lose, and Chrome
 * prints only the frame's own document when told to.
 */
export function openCommandSheet(input: SheetInput): boolean {
  const html = commandSheetHtml(input);
  const frame = document.createElement('iframe');
  // Off-screen rather than display:none — a frame with no box does not lay out, and a document
  // that never laid out prints as one blank page.
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:8.5in;height:11in;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) { frame.remove(); return false; }
  doc.open();
  doc.write(html);
  doc.close();

  const win = frame.contentWindow;
  // Let the cover art and any captured still decode before the dialog measures the page.
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      // Keep the frame alive past the modal print dialog; removing it immediately cancels the
      // job in some builds. A minute is far longer than any dialog and costs one detached node.
      window.setTimeout(() => frame.remove(), 60_000);
    }
  }, 400);
  return true;
}

// ── The three numbers only the operator knows ───────────────────────────────
//
// Crew size, productive hours and stock lengths are ARITHMETIC DIVISORS, not doctrine (R-T6):
// the tool has no basis for any of them and clamps rather than validates. Asking is the
// difference between a packet whose labor table is about this unit and one whose labor table
// is about a default nobody chose.

export interface PacketOptionsInput {
  crewSizes: number[];
  productiveHoursPerDay: number;
  stockLengthsFt: number[];
}

/** Starting points, not recommendations — every one is overwritten before anything prints. */
export const PACKET_DEFAULTS: PacketOptionsInput = {
  crewSizes: [2, 4, 6, 8, 12],
  productiveHoursPerDay: DEFAULT_PRODUCTIVE_HOURS,
  stockLengthsFt: [...DEFAULT_STOCK_FT],
};

const parseList = (raw: string, lo: number, hi: number): number[] => {
  const out = raw.split(/[,\s]+/).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.min(hi, Math.max(lo, Math.round(n))));
  return [...new Set(out)].sort((a, b) => a - b);
};

/**
 * Ask, then generate. Resolves null if the operator backs out — a cancelled dialog must not
 * silently produce a packet with defaults they did not choose.
 */
export function askPacketOptions(defaults: PacketOptionsInput): Promise<PacketOptionsInput | null> {
  const dlg = document.createElement('dialog');
  dlg.className = 'pktdlg';
  dlg.innerHTML = `
    <form method="dialog">
      <h2>Command packet</h2>
      <p>Three numbers the tool has no basis for. They divide the estimate; they are not doctrine.</p>
      <label>Crew sizes to show
        <input name="crew" value="${defaults.crewSizes.join(', ')}" inputmode="numeric" />
        <small>Rows above what the work can absorb are suppressed, not shrunk.</small>
      </label>
      <label>Productive hours per shift
        <input name="hours" value="${defaults.productiveHoursPerDay}" inputmode="numeric" />
        <small>Not eight. Security, details, travel and tool contention are the rest of the day.</small>
      </label>
      <label>Stock lengths carried (ft)
        <input name="stock" value="${defaults.stockLengthsFt.join(', ')}" inputmode="numeric" />
        <small>What your supply point actually has. The purchase table is fitted to these.</small>
      </label>
      <div class="pktdlg-row">
        <button value="cancel" class="chip" type="submit">Cancel</button>
        <button value="go" class="chip chip--go" type="submit">Generate packet</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      const form = dlg.querySelector('form') as HTMLFormElement;
      const read = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
      const out = dlg.returnValue === 'go'
        ? {
          crewSizes: parseList(read('crew'), 1, 30).slice(0, 6),
          productiveHoursPerDay: Math.min(24, Math.max(1, Math.round(Number(read('hours')) || defaults.productiveHoursPerDay))),
          stockLengthsFt: parseList(read('stock'), 6, 24),
        }
        : null;
      dlg.remove();
      // An operator who cleared a field gets the default back rather than an empty table.
      resolve(out && {
        crewSizes: out.crewSizes.length > 0 ? out.crewSizes : defaults.crewSizes,
        productiveHoursPerDay: out.productiveHoursPerDay,
        stockLengthsFt: out.stockLengthsFt.length > 0 ? out.stockLengthsFt : defaults.stockLengthsFt,
      });
    }, { once: true });
    dlg.showModal();
  });
}
