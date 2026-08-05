// TIMBER-2 — the config panel schema (plan §3.7, §5.3).
//
// THE PANEL IS THE PLANNER'S DECISION ORDER, top to bottom. You decide what you are building,
// then how big, then what ground it stands on, then what it stands on, and only then the frame,
// the holes in it, the roof over it, the skin around it, and the way up onto it. Every family
// walks the SAME cascade —
//
//   STRUCTURE → DIMENSIONS → SITE → FOUNDATION → FRAME → OPENINGS → ROOF → CLOSING IN →
//   ACCESS & SAFETY
//
// — and a section a family has nothing to say in simply does not appear, with the numbering
// closing up behind it. That is what lets one mental model serve a two-knob tent floor and a
// nine-section building: the sections you meet are always in the same order, and the panel is
// exactly as long as the structure is complicated.
//
// Locks (plan §5.3): a standard design's pinned values render read-only WITH their citation
// and a why-popover carrying the escape hatch — "need it different? unlock everything, copies
// to a custom build". A lock the user cannot get past is a tool telling them no; a lock that
// explains itself and offers a door is a tool teaching them why.

import type { FamilyDef, FamilyId } from '../../timber/catalog';
import { familyById, shippedFamilies } from '../../timber/catalog';
import { COVER_DEPTH_NOTE } from '../../timber/doctrine';
import { SPEC_PATH_DEFS, specPath } from '../../timber/spec';

export type ControlKind = 'number' | 'select' | 'toggle' | 'openings-editor' | 'family';

export interface PanelRow {
  path: string;
  label: string;
  control: ControlKind;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  /**
   * What each option is CALLED, parallel to `options`. The value stays the spec's own token
   * ('piers'), the reader sees the sentence ('Posts on footers'). Raw enum tokens in a select
   * were the panel quietly assuming everyone already knew the vocabulary — in the tool whose
   * other half exists to teach it.
   */
  optionLabels?: readonly string[];
  /** The family lock that pins this row, if any — renders the read-only state + cite. */
  lockedBy?: string;
  cite?: string;
  /** Openings arrays are `preset` on standards: editable, badged STD, per-wall reset (TD38). */
  lock?: 'preset';
  /**
   * A select whose options are numbers. `<select>.value` is always a string, and writing "16"
   * where the spec wants 16 makes a spec that typechecks, serializes, and then compares wrong
   * everywhere downstream. The renderer coerces when this is set.
   */
  numeric?: true;
  help?: string;
  /**
   * Whether this row applies to the spec AS CURRENTLY CONFIGURED. "Basement depth: 0" under a
   * piers foundation is not a disabled control, it is a question that does not exist — showing
   * it anyway makes the reader do the filtering the panel should have done. The renderer
   * re-evaluates on every change, so rows appear the moment the choice above them makes them
   * real. Coverage tests deliberately ignore this: a conditional row is still part of the
   * schema surface.
   */
  applies?: (spec: unknown) => boolean;
}

export interface PanelGroup {
  title: string;
  rows: PanelRow[];
}

export interface PanelSchema {
  family: FamilyId;
  groups: PanelGroup[];
}

// ── Option vocabulary ────────────────────────────────────────────────────────

const ROOF_LABELS: Record<string, string> = {
  gable: 'Gable — peak in the middle',
  shed: 'Shed — one slope',
  flat: 'Flat — drains one way',
  hip: 'Hip — slopes on all four sides',
  pyramid: 'Pyramid — hips to a peak',
  none: 'No roof',
};

const FOUNDATION_OPTIONS = ['piers', 'wall', 'basement', 'slab', 'skids'] as const;
const FOUNDATION_LABELS: Record<string, string> = {
  piers: 'Posts on footers',
  wall: 'Continuous wall',
  basement: 'Full basement',
  slab: 'Slab on grade',
  skids: 'Skids — movable',
};

const ROOFING_LABELS: Record<string, string> = {
  none: 'None',
  corrugated: 'Corrugated metal',
  roll: 'Roll roofing',
  rollDouble: 'Roll roofing, double coverage',
};

const COVERING_LABELS: Record<string, string> = {
  none: 'None',
  plywood: 'Plywood',
  boards: 'Boards',
  boardAndBatten: 'Board and batten',
  purlins: 'Purlins (for metal)',
};

const labelsFor = (options: readonly string[], dict: Record<string, string>): string[] =>
  options.map((o) => dict[o] ?? o);

/**
 * The soil row every family carries. Recorded, not consumed — and the help text says so,
 * because an input that silently drives nothing is a lie, while an input that states where it
 * goes is a site record. FM 5-426 sizes post footers per soil class; until those tables are
 * page-checked, nothing in the engine is allowed to read this.
 */
const SITE_ROWS: PanelRow[] = [{
  path: 'site.soil',
  label: 'Soil, as observed',
  control: 'select',
  options: ['unknown', 'sand', 'gravel', 'loam', 'clay', 'rock'],
  optionLabels: ['Not recorded', 'Sand', 'Gravel', 'Loam', 'Clay', 'Rock'],
  help: 'Travels with the plan and prints on the command packet, so the estimate carries its '
    + 'ground. Sizing does NOT read it yet: FM 5-426 sizes post footers per soil, and those '
    + 'tables are pending a page check (PH).',
}];

/** The first decision on every panel: what is being built. Changing it opens that structure. */
function structureRow(family: FamilyDef): PanelRow {
  const shipped = shippedFamilies();
  return {
    path: '__family',
    label: 'Type of structure',
    control: 'family',
    options: shipped.map((f) => f.id),
    optionLabels: shipped.map((f) => f.name),
    help: family.oneLiner,
  };
}

function withApplies(row: PanelRow | null, applies: (spec: unknown) => boolean): PanelRow | null {
  return row ? { ...row, applies } : null;
}

function numberRow(path: string, family: FamilyDef, help?: string): PanelRow | null {
  const def = specPath(path);
  if (!def) return null;
  const lock = family.locks.find((l) => l.path === path);
  return {
    path,
    label: def.label,
    control: 'number',
    min: def.min,
    max: def.max,
    step: def.step,
    cite: def.cite,
    ...(lock ? { lockedBy: lock.label, cite: lock.cite } : {}),
    ...(help ? { help } : {}),
  };
}

/** One named stop on the cascade. Assembled in canonical order; empty sections vanish. */
interface Section {
  title: string;
  rows: (PanelRow | null)[];
}

function assemble(familyId: FamilyId, sections: Section[]): PanelSchema {
  const groups: PanelGroup[] = [];
  for (const s of sections) {
    const rows = s.rows.filter((r): r is PanelRow => r !== null);
    if (rows.length === 0) continue;
    groups.push({ title: `${groups.length + 1} · ${s.title}`, rows });
  }
  return { family: familyId, groups };
}

/**
 * Build the panel for a family, as the canonical cascade. Sections are numbered and named in
 * plain language — the word "Level" is deliberately absent from visible copy (it collides with
 * the disclosure-level vocabulary in the design doc and means nothing to a reader).
 */
export function configSchemaFor(familyId: FamilyId): PanelSchema {
  const family = familyById(familyId);
  if (!family) return { family: familyId, groups: [] };

  if (family.specBranch === 'tower') {
    return assemble(familyId, [
      { title: 'STRUCTURE', rows: [structureRow(family)] },
      {
        title: 'DIMENSIONS',
        rows: [
          {
            path: 'platformHeightFt', label: 'Platform height', control: 'select', numeric: true,
            options: ['10', '16', '24', '32'],
            cite: 'TM 5-302 guard tower heights (PH)',
            help: 'Above 20 ft a fixed ladder is not an acceptable sole means of access (EM 385-1-1) — the tool switches to a stair and tells you.',
          },
          { path: 'cabPlanFt', label: 'Cab plan', control: 'select', numeric: true, options: ['6', '8'], help: 'Square, in feet.' },
        ],
      },
      { title: 'SITE', rows: SITE_ROWS },
      {
        title: 'FOUNDATION',
        rows: [{
          path: 'footing', label: 'Footing', control: 'select',
          options: ['timber-mudsill', 'concrete-pad'],
          optionLabels: ['Timber mudsill', 'Poured concrete pad'],
          help: 'A timber mudsill spreads the leg load over tamped fill and can be built with what is on the truck. A poured pad is the deliberate version.',
        }],
      },
      {
        title: 'FRAME',
        rows: [{
          path: 'cab.walls', label: 'Cab walls', control: 'select',
          options: ['open-rail', 'half-wall', 'half-wall-screen'],
          optionLabels: ['Open rail', 'Half-wall', 'Half-wall, screen above'],
          help: 'Open rail · half-wall you can fire over · half-wall with screen above.',
        }],
      },
      {
        title: 'ROOF',
        rows: [
          { path: 'cab.roof', label: 'Cab roof', control: 'select', options: ['pyramid', 'shed'], optionLabels: ['Pyramid — hips to a peak', 'Shed — one slope'] },
          {
            path: 'coverings.roofing', label: 'Roofing', control: 'select',
            options: family.coverings.roofing ?? ['corrugated'],
            optionLabels: labelsFor(family.coverings.roofing ?? ['corrugated'], ROOFING_LABELS),
          },
        ],
      },
      {
        title: 'ACCESS & SAFETY',
        rows: [{
          path: 'access', label: 'Way up', control: 'select',
          options: ['ladder', 'stair'], optionLabels: ['Fixed ladder', 'Switchback stair'],
          cite: 'EM 385-1-1 fixed-ladder cage threshold',
          help: 'A ladder’s rails run 36 in past the landing so there is something to hold when your feet leave the top rung. A stair switchbacks to stay inside the footprint.',
        }],
      },
    ]);
  }

  if (family.specBranch === 'bunker') {
    return assemble(familyId, [
      { title: 'STRUCTURE', rows: [structureRow(family)] },
      {
        title: 'DIMENSIONS',
        rows: ['interiorLengthFt', 'interiorWidthFt', 'clearHeightFt'].map((p) => numberRow(p, family)),
      },
      { title: 'SITE', rows: SITE_ROWS },
      {
        title: 'FRAME',
        rows: [
          { path: 'wallType', label: 'Walls', control: 'select', options: ['post-plank', 'crib'], optionLabels: ['Posts with lagging', 'Crib — stacked logs'], help: 'Posts with lagging behind them, or courses of logs laid at right angles to each other.' },
          { path: 'entrance', label: 'Entrance', control: 'select', options: ['open', 'baffle'], optionLabels: ['Straight in', 'Baffled — the way in turns'], help: 'Straight through, or offset so the way in turns.' },
        ],
      },
      {
        title: 'DEAD LOAD',
        rows: [
          {
            ...(numberRow('designCoverDepthFt', family) ?? { path: 'designCoverDepthFt', label: 'Cover depth', control: 'number' as const }),
            // The one input on this panel that is NOT a carpentry decision. Its help text is the
            // boundary sentence, verbatim, so the person typing the number reads what it means.
            help: COVER_DEPTH_NOTE,
            cite: 'stated design load — like a snow-load assumption',
          },
          { path: 'showSoilCover', label: 'Show cover as massing', control: 'toggle', help: 'Draws the stated depth as a ghost so you can see what the timber is under. It is never billed.' },
        ],
      },
    ]);
  }

  if (family.specBranch === 'platform') {
    return assemble(familyId, [
      { title: 'STRUCTURE', rows: [structureRow(family)] },
      {
        title: 'DIMENSIONS',
        rows: [
          numberRow('dims.lengthFt', family),
          numberRow('dims.widthFt', family),
          numberRow('deckHeightFt', family, 'Grade to the walking surface. Above 2 ft 6 in this has to be railed (EM 385-1-1).'),
        ],
      },
      { title: 'SITE', rows: SITE_ROWS },
      {
        title: 'FOUNDATION',
        rows: [{ path: 'base', label: 'Base', control: 'select', options: ['piers', 'skids'], optionLabels: ['Piers and footings', 'Skids — drag it whole'], help: 'Piers and footings, or skids you can drag it on.' }],
      },
      {
        title: 'FRAME',
        rows: [{ path: 'deck', label: 'Decking', control: 'select', options: ['plank', 'panel'], optionLabels: ['Planks', 'Sheet panels'] }],
      },
      {
        title: 'ACCESS & SAFETY',
        rows: [
          numberRow('ramp.widthFt', family, 'Wide enough for what has to go up it.'),
          { path: 'ramp.slope', label: 'Ramp slope', control: 'select', numeric: true, options: ['4', '6', '8'], optionLabels: ['1 in 4 — steepest allowed', '1 in 6', '1 in 8 — gentlest'], cite: 'EM 385-1-1 / TM 5-302 ramp slopes (1:N)', help: 'Run per foot of rise.' },
          { path: 'steps', label: 'Steps at the end', control: 'toggle' },
        ],
      },
    ]);
  }

  if (family.specBranch === 'tentFrame') {
    return assemble(familyId, [
      {
        title: 'STRUCTURE',
        rows: [
          structureRow(family),
          { path: 'tent', label: 'Tent', control: 'select', options: ['gpSmall', 'gpMedium', 'temper'], optionLabels: ['GP small', 'GP medium', 'TEMPER'], cite: 'TM 10-8340 (PH)' },
          withApplies(numberRow('temperBays', family, 'The frame grows a bay at a time.'),
            (spec) => (spec as { tent?: string }).tent === 'temper'),
        ],
      },
      {
        title: 'DIMENSIONS',
        rows: [numberRow('dims.lengthFt', family), numberRow('dims.widthFt', family)],
      },
      { title: 'SITE', rows: SITE_ROWS },
      { title: 'OPENINGS', rows: [{ path: 'endDoor', label: 'Framed end door', control: 'toggle' }] },
    ]);
  }

  // ── Buildings and huts: the full cascade ─────────────────────────────────
  const skin: (PanelRow | null)[] = [];
  for (const [key, label] of [
    ['coverings.wallSheathing', 'Wall sheathing'],
    ['coverings.siding', 'Siding'],
    ['coverings.roofDeck', 'Roof deck'],
    ['coverings.roofing', 'Roofing'],
  ] as const) {
    const field = key.split('.')[1] as keyof FamilyDef['coverings'];
    const options = family.coverings[field];
    if (!options || options.length === 0) continue;
    // Purlins only exist where the roof can take them. The frozen gable branch lays its own
    // solid deck (C-9), so offering "Purlins (for metal)" under a gable would promise a deck
    // the engine will not build. Two rows, same path: the applies-predicate picks the one
    // that tells the truth for the roof as currently configured. A hut's spec may omit the
    // roof entirely — normalize gives it a gable — so the missing case reads as gable here.
    if (field === 'roofDeck' && options.includes('purlins')) {
      const solid = options.filter((o) => o !== 'purlins');
      const isGable = (spec: unknown): boolean =>
        ((spec as { roof?: { kind?: string } }).roof?.kind ?? 'gable') === 'gable';
      skin.push({
        path: key, label, control: 'select', options: solid,
        optionLabels: labelsFor(solid, COVERING_LABELS),
        applies: (spec) => isGable(spec),
        help: 'A gable here is built the drawing-set way — sheathed solid. Purlins come with the other roof shapes.',
      }, {
        path: key, label, control: 'select', options,
        optionLabels: labelsFor(options, COVERING_LABELS),
        applies: (spec) => !isGable(spec),
      });
      continue;
    }
    skin.push({
      path: key, label, control: 'select', options,
      optionLabels: labelsFor(options, key === 'coverings.roofing' ? ROOFING_LABELS : COVERING_LABELS),
    });
  }
  // Felt under the roofing. A real choice with a real line on the bill, and until now no way to
  // make it: the spec carried the field, the engine ignored it, and the panel never offered it.
  // Only worth asking about once there is a deck to lay it on.
  if (family.coverings.roofDeck && family.coverings.roofDeck.length > 0) {
    skin.push({
      path: 'coverings.buildingPaper',
      label: 'Felt under the roofing',
      control: 'toggle',
      help: 'Underlayment between the deck and the roofing, lapped from the eave up.',
      cite: 'FM 5-426 felt underlayment (PH)',
      applies: (spec) => ((spec as { coverings?: { roofDeck?: string } }).coverings?.roofDeck ?? 'none') !== 'none',
    });
  }
  // The open front. The storage-shed card has always offered it — "a wide door bay, or leave the
  // whole front open" — while nothing in the engine read the field and no control set it.
  if (family.specBranch === 'building') {
    skin.push({
      path: 'openFront',
      label: 'Open front (whole wall)',
      control: 'select',
      options: ['none', 'S', 'N', 'E', 'W'],
      optionLabels: ['Closed in', 'Front (S)', 'Back (N)', 'Right (E)', 'Left (W)'],
      help: 'That wall becomes posts and a beam instead of studs, and can carry no doors or windows.',
      cite: 'TM 5-302 storage (PH)',
    });
  }
  if (family.specBranch === 'hut') {
    skin.push({
      path: 'screenBand',
      label: 'Screened band',
      control: 'toggle',
      help: 'The band under the eaves that lets a closed hut breathe. The siding is cut around it.',
      cite: 'TM 5-302 SEA hut screened band (PH)',
    });
  }

  return assemble(familyId, [
    { title: 'STRUCTURE', rows: [structureRow(family)] },
    {
      title: 'DIMENSIONS',
      rows: [
        numberRow('dims.lengthFt', family),
        numberRow('dims.widthFt', family),
        numberRow('stories.0.wallHeightFt', family),
      ],
    },
    { title: 'SITE', rows: SITE_ROWS },
    {
      title: 'FOUNDATION',
      rows: [
        {
          path: 'foundation.kind',
          label: 'Foundation',
          control: 'select',
          options: FOUNDATION_OPTIONS,
          optionLabels: labelsFor(FOUNDATION_OPTIONS, FOUNDATION_LABELS),
        },
        withApplies(numberRow('foundation.crawlFt', family, 'Grade to the underside of the sill.'),
          (spec) => ['piers', 'wall'].includes((spec as { foundation?: { kind?: string } }).foundation?.kind ?? '')),
        withApplies(numberRow('foundation.depthFt', family, 'Sill bottom to the top of the basement slab.'),
          (spec) => (spec as { foundation?: { kind?: string } }).foundation?.kind === 'basement'),
      ],
    },
    {
      title: 'FRAME',
      rows: [
        { path: 'bridging', label: 'Bridging', control: 'select', options: ['cross', 'solid'], optionLabels: ['Cross — herring-bone pairs', 'Solid blocking'] },
        { path: 'stories.0.letInBracing', label: 'Let-in corner bracing', control: 'toggle' },
        { path: 'atticAccess', label: 'Attic hatch', control: 'toggle' },
      ],
    },
    {
      title: 'OPENINGS',
      rows: [{
        path: 'stories.0.openings',
        label: 'Doors, windows and vents',
        control: 'openings-editor',
        ...(family.id === 'custom' ? {} : { lock: 'preset' as const }),
        help: 'Rough-opening size and position on each wall. The framing follows automatically.',
      }],
    },
    {
      title: 'ROOF',
      rows: family.specBranch === 'building'
        ? [
          {
            path: 'roof.kind',
            label: 'Roof type',
            control: 'select',
            options: family.roofs,
            optionLabels: labelsFor(family.roofs, ROOF_LABELS),
          },
          withApplies(numberRow('roof.risePer12', family, 'Inches of rise per foot of run. 4 means 4 in 12.'),
            (spec) => !['flat', 'none'].includes((spec as { roof?: { kind?: string } }).roof?.kind ?? '')),
          withApplies(numberRow('roof.overhangFt', family, 'How far the roof sticks out past the wall.'),
            (spec) => (spec as { roof?: { kind?: string } }).roof?.kind !== 'none'),
        ]
        : [],
    },
    { title: 'CLOSING IN', rows: skin },
  ]);
}

/** Every path the panel renders — used by the coverage test against the clamp registry. */
export function schemaPaths(schema: PanelSchema): string[] {
  return schema.groups.flatMap((g) => g.rows.map((r) => r.path));
}

/** Numeric rows must agree with the clamp table exactly (plan §8.5 min/max EQUALITY). */
export function numericRows(schema: PanelSchema): PanelRow[] {
  return schema.groups.flatMap((g) => g.rows).filter((r) => r.control === 'number');
}

export const REGISTRY_NUMERIC_PATHS: readonly string[] = SPEC_PATH_DEFS
  .filter((d) => d.min !== undefined || d.max !== undefined)
  .map((d) => d.path);
