// COMMAND PACKET — the fixed copy (TRAINING_AND_PACKETS_PLAN §4.3, R-T2/R-T5/FD63).
//
// Every string here is asserted VERBATIM by `test/timber2-packet.test.ts`, and that is the
// point of the file. This is the language the tool uses to say what it does and does not
// know, on a document that goes to somebody's commander. Copy that can drift silently is copy
// that eventually claims more than the tool can support.
//
// THE RULE THAT SHAPES ALL OF IT (R-T5): no signature theater. This tool is not an authority.
// It never says a design was verified, certified, checked or approved; the only
// signature-shaped ink on the page is a blank line with a role label beside it, and what that
// signature covers is stated in the same block so nobody signs a wider claim than they meant.

/**
 * The honesty strip. Renders on the cover and repeats in the footer of every printed page —
 * a packet whose middle sheets can be photocopied out of context and read as a build-to
 * document is a packet that has lost the only warning that mattered.
 */
export const STRIP_PREFIX = 'PLANNING ESTIMATE — not a build-to field document';

export const DECISION_LINE =
  'This packet is a planning estimate compiled from cited defaults. It is a resource request, '
  + 'not an engineering submission; the review lines on the last page are the unit\'s process, '
  + 'not this tool\'s.';

/**
 * FD63 — printed inside the approval block, verbatim. Every structural size in the model is
 * pinned to a standard drawing and has not been checked for this load case, so inviting an
 * engineer's signature over it is exactly the tool-conferred trust the whole regime forbids.
 */
export const APPROVAL_SCOPE =
  'Sizing is fixed by the standard drawing and has not been span-checked for this load case; '
  + 'approval covers the resource request, not the engineering.';

/** R-B1 — printed beside the DATE blank, because a browser will stamp one whatever we do. */
export const DATE_NOTE =
  'Any date in the page header or file properties is your browser\'s clock, not this '
  + 'document\'s date. Fill the date blank by hand.';

/** The standing banner over the life-safety table. Renders only when LS items exist. */
export const LS_BANNER =
  'LIFE-SAFETY VALUES BELOW ARE PLACEHOLDERS PENDING A MANUAL PAGE CHECK. Guardrail heights, '
  + 'rung spacings, tread depths and stair geometry must be verified against EM 385-1-1 and the '
  + 'governing manual before anyone works from this packet.';

/** Fidelity lines — one per thing the packet estimates rather than knows. */
export const FIDELITY = {
  labor: 'LABOR: (PH) rates, crew scaled linearly, stages run in order with no overlap modeled. A crew twice the size does not halve a sill line.',
  stockFit: 'MATERIALS: first-fit stock estimate, saw kerf ignored, no contingency allowance applied.',
  spans: 'SIZING: member sizes come from the standard drawing for the family, not from a span calculation for this load case.',
  weight: 'WEIGHT AND CUBE: (PH) densities; use for transport planning, not for lift planning.',
} as const;

/** The exec summary's REQUEST and RISK blocks are operator-filled. These are the prompts. */
export const REQUEST_PROMPTS: readonly string[] = [
  'Crew of ____ for ____ shifts, from ____',
  'Class IV: list attached — see MATERIALS',
  'Equipment required: ____',
  'Site prerequisite (access, grade, spoil, power): ____',
];

export const RISK_PROMPT =
  'Impact if not approved — top three, in mission terms. Filled by the requesting unit; '
  + 'this tool does not invent mission risk.';

/** Column headers a Class IV list is useless without. Operator-filled, printed blank. */
export const CLASS_IV_COLUMNS: readonly string[] = ['ON HAND', 'REQUISITION', 'LEAD TIME'];

export const EQUIPMENT_NOTE =
  'Tools are inferred from the nailing schedules in the model. Power, transport, delivery '
  + 'point and site preparation are not modeled and are left blank for the requesting unit.';

/** The packet's own contents line — ordinal only. Page numbers are a browser artifact. */
export const SECTIONS: readonly string[] = [
  'Cover',
  'Executive summary',
  'Materials',
  'Labor and schedule',
  'Assumptions and citations',
];
