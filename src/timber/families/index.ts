// TIMBER-2 — `generateStructure`: the one entry point every consumer calls (plan §3.1).
//
// The scene, the BOM, the 2D strips, the thumbnails and the print surfaces are all
// projections of the `Member[]` this returns. Nothing downstream invents geometry — that
// invariant (I-3) is why the drawing and the cut list can never disagree.

import type { Member } from '../types';
import type { StructureSpec } from '../spec';
import type { StagePlanEntry } from '../stagePlan';
import { normalizeSpec, type SpecIssue } from '../normalize';
import { spanWarnings, summarizeSpanWarnings } from '../spans';
import { generateBuilding } from './building';
import { generateHut } from './hut';
import { generateTower } from './tower';
import { generatePlatform, generateTentFrame } from './platform';
import { generateBunker } from './bunker';
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
/**
 * Span warnings, appended to whatever the normalizer already said. Done HERE rather than in each
 * family so a new family cannot ship without the check — the one place every model passes
 * through is the only place that guarantee holds.
 *
 * Mandate #2: these are warnings. Nothing above resizes anything.
 */
function withSpanChecks(model: StructureModel): StructureModel {
  const lines = summarizeSpanWarnings(spanWarnings(model.members, model.spec.spacing, model.levels.subfloorTop));
  if (lines.length === 0) return model;
  return {
    ...model,
    issues: [
      ...model.issues,
      ...lines.map((message) => ({ path: 'spans', kind: 'span' as const, message, severity: 'warn' as const })),
    ],
  };
}

export function generateStructure(spec: StructureSpec): StructureModel {
  const { spec: normalized, issues } = normalizeSpec(spec);

  switch (normalized.family) {
    case 'building': {
      const r = generateBuilding(normalized);
      return withSpanChecks({ spec: normalized, members: r.members, levels: r.levels, stagePlan: r.stagePlan, issues });
    }
    case 'hut': {
      // T5. A hut IS a building (TD2) — the generator translates the spec and adds girts, the
      // screen band and the riser box, so there is one framing engine, not six.
      const r = generateHut(normalized);
      return withSpanChecks({ spec: normalized, members: r.members, levels: r.levels, stagePlan: r.stagePlan, issues });
    }
    case 'tower': {
      // T4. Everything about a tower is life-safety, which is why `normalizeSpec` has already
      // forced a stair above the cage threshold by the time this runs — the generator builds
      // what it is handed and never quietly substitutes a safer thing without saying so.
      const r = generateTower(normalized);
      return withSpanChecks({ spec: normalized, members: r.members, levels: r.levels, stagePlan: r.stagePlan, issues });
    }
    case 'platform': {
      const r = generatePlatform(normalized);
      return withSpanChecks({ spec: normalized, members: r.members, levels: r.levels, stagePlan: r.stagePlan, issues });
    }
    case 'tentFrame': {
      const r = generateTentFrame(normalized);
      return withSpanChecks({ spec: normalized, members: r.members, levels: r.levels, stagePlan: r.stagePlan, issues });
    }
    case 'bunker': {
      // T7. See families/bunker.ts for the §2.7 boundary this family sits on: the depth of soil
      // is an INPUT it consumes as dead load, never an output it computes.
      const r = generateBunker(normalized);
      const extra = r.pastReviewedTable
        ? [{ path: 'interiorWidthFt', kind: 'ls-note' as const, message: r.pastReviewedTable, severity: 'error' as const }]
        : [];
      return withSpanChecks({
        spec: normalized,
        members: r.members,
        levels: r.levels,
        stagePlan: r.stagePlan,
        issues: [...issues, ...extra],
      });
    }
    default: {
      // Every family in the union now has a generator, so TypeScript narrows this to `never` —
      // which is the point: adding a family without a generator is a compile error, not a
      // runtime surprise. The throw stays for a spec that reached here from untyped JSON.
      const unbuilt: never = normalized;
      throw new Error(
        `generateStructure: no generator for family "${(unbuilt as { family?: string }).family ?? 'unknown'}" — see docs/TIMBER2_PLAN.md §7.`,
      );
    }
  }
}
