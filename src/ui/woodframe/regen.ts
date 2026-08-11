// WOODFRAME-2 — one workbench regenerate step (plan §4.1, mandate #2).
//
// THE ORDER IS THE WHOLE POINT, WHICH IS WHY IT IS A FUNCTION AND NOT THREE LINES IN THE BOOT
// FILE. `normalizeSpec` reports what it had to REPAIR — an opening slid back inside a wall the
// operator just shortened, a roof this engine cannot frame, a second storey dropped — and it is
// idempotent, so it reports those things exactly once: on the pass that repairs them.
//
// Repair the spec first and hand the repaired copy on, and the pass that builds the model finds
// nothing left to say. The panel edit that moved four doors and four windows then draws a model
// with the openings in their new places and an issues strip with nothing in it, which is the
// silent-correction failure the mandate exists to forbid — the tool changed the building and did
// not tell the person who is about to build it.
//
// So the model is generated from the spec AS THE OPERATOR LEFT IT, and the repaired spec is taken
// back OUT of the model (`StructureModel.spec` is the normalized one — what was actually built).
// One normalize pass, one report, and the panel reads one list: the repairs, then what the member
// checks found on the frame that came out of them.

import { generateStructure, type StructureModel } from '../../woodframe/families/index';
import type { StructureSpec } from '../../woodframe/spec';

export interface RegenResult {
  /** The spec that was actually built — repaired, and safe to write back to the stored build. */
  spec: StructureSpec;
  model: StructureModel;
  /** Everything to show above the model, in order: what was repaired, then what was measured. */
  messages: string[];
}

export function regenerateFrom(spec: StructureSpec): RegenResult {
  const model = generateStructure(spec);
  return { spec: model.spec, model, messages: model.issues.map((i) => i.message) };
}
