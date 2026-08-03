// TIMBER-2 — `generateStructure`: the one entry point every consumer calls (plan §3.1).
//
// The scene, the BOM, the 2D strips, the thumbnails and the print surfaces are all
// projections of the `Member[]` this returns. Nothing downstream invents geometry — that
// invariant (I-3) is why the drawing and the cut list can never disagree.

import type { Member } from '../types';
import type { StructureSpec } from '../spec';
import type { StagePlanEntry } from '../stagePlan';
import { normalizeSpec, type SpecIssue } from '../normalize';
import { generateBuilding } from './building';
import { generateHut } from './hut';
import type { FloorLevels } from '../floor';

/** Vertical datum info the render layer needs (grade line, deck heights). */
export type LevelInfo = FloorLevels & { slabTop?: number };

export interface StructureModel {
  spec: StructureSpec; // the NORMALIZED spec — what was actually built
  members: Member[];
  levels: LevelInfo;
  stagePlan: StagePlanEntry[];
  issues: SpecIssue[];
}

/**
 * Normalize, then dispatch to the family generator. Always returns a model: a spec that
 * cannot be built as asked is clamped into one that can, and every adjustment comes back as
 * a visible issue rather than a silent correction.
 */
export function generateStructure(spec: StructureSpec): StructureModel {
  const { spec: normalized, issues } = normalizeSpec(spec);

  switch (normalized.family) {
    case 'building': {
      const r = generateBuilding(normalized);
      return { spec: normalized, members: r.members, levels: r.levels, stagePlan: r.stagePlan, issues };
    }
    case 'hut': {
      // T5. A hut IS a building (TD2) — the generator translates the spec and adds girts, the
      // screen band and the riser box, so there is one framing engine, not six.
      const r = generateHut(normalized);
      return { spec: normalized, members: r.members, levels: r.levels, stagePlan: r.stagePlan, issues };
    }
    default:
      // Families land in their phases (tower T4, platform/tent T6, bunker T7). Until then
      // this is unreachable through the catalog — the picker only offers built families.
      throw new Error(
        `generateStructure: the "${normalized.family}" family is not implemented yet — see docs/TIMBER2_PLAN.md §7 for its phase.`,
      );
  }
}
