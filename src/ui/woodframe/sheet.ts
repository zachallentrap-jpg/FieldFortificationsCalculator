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

/** Open the packet in its own window and hand it to the print dialog. */
export function openCommandSheet(input: SheetInput): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(commandSheetHtml(input));
  w.document.close();
  // Let the image decode before the print dialog measures the page.
  w.setTimeout(() => w.print(), 350);
  return true;
}
