// Conditions-of-use acceptance gate (blueprint §2.9 flag 1, completeness patch 13):
// first-run typed acceptance, re-shown whenever the conditions text version or the
// loaded fill CLASS changes (accepting under TEMPLATE does not carry to operating on
// DOCTRINE data). Pure state logic here; the screen mounts in the shell (R0 UI) and
// the wording ships in docs/CONDITIONS_OF_USE.md routed to counsel review — nothing
// in this module claims legal effect.

import type { FillClass } from '../schema/fill';

/** Bumped whenever docs/CONDITIONS_OF_USE.md changes materially. */
export const CONDITIONS_TEXT_VERSION = 1;

export interface ConditionsAcceptance {
  readonly typedName: string;
  readonly dateISO: string; // supplied by the shell's injected clock
  readonly textVersion: number;
  readonly fillClassAtAcceptance: FillClass | 'TEMPLATE';
}

export const needsAcceptance = (
  prior: ConditionsAcceptance | null,
  currentClass: FillClass | 'TEMPLATE',
): boolean => {
  if (prior === null) return true;
  if (prior.textVersion !== CONDITIONS_TEXT_VERSION) return true;
  // Class escalation re-gates: moving from TEMPLATE/TRAINING browsing to DOCTRINE
  // operation is a different act. De-escalation does not re-gate.
  const rank: Record<FillClass | 'TEMPLATE', number> = { TEMPLATE: 0, TEST: 0, TRAINING: 1, DOCTRINE: 2 };
  return rank[currentClass] > rank[prior.fillClassAtAcceptance];
};

export const recordAcceptance = (
  typedName: string,
  dateISO: string,
  currentClass: FillClass | 'TEMPLATE',
): ConditionsAcceptance => {
  const name = typedName.trim();
  if (name.length < 2) throw new Error('acceptance requires a typed name');
  return Object.freeze({
    typedName: name,
    dateISO,
    textVersion: CONDITIONS_TEXT_VERSION,
    fillClassAtAcceptance: currentClass,
  });
};
