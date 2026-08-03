// TIMBER-2 — the config panel schema (plan §3.7, §5.3).
//
// The panel is GENERATED from the spec path registry, not hand-written per family. That is
// what makes TD22 work: custom-lite ships at T3 exposing whatever the engine can currently
// build, and it grows automatically as the engine grows — nobody has to remember to add a
// control when a knob lands.
//
// Locks (plan §5.3): a standard design's pinned values render read-only WITH their citation
// and a why-popover carrying the escape hatch — "need it different? unlock everything, copies
// to a custom build". A lock the user cannot get past is a tool telling them no; a lock that
// explains itself and offers a door is a tool teaching them why.

import type { FamilyDef, FamilyId } from '../../timber/catalog';
import { familyById } from '../../timber/catalog';
import { SPEC_PATH_DEFS, specPath } from '../../timber/spec';

export type ControlKind = 'number' | 'select' | 'toggle' | 'openings-editor';

export interface PanelRow {
  path: string;
  label: string;
  control: ControlKind;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
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
}

export interface PanelGroup {
  title: string;
  rows: PanelRow[];
}

export interface PanelSchema {
  family: FamilyId;
  groups: PanelGroup[];
}

const ROOF_LABELS: Record<string, string> = {
  gable: 'Gable (peak in the middle)',
  shed: 'Shed (one slope)',
  flat: 'Flat (drains one way)',
  hip: 'Hip',
  pyramid: 'Pyramid',
  none: 'No roof',
};

const FOUNDATION_OPTIONS = ['piers', 'wall', 'basement', 'slab', 'skids'] as const;
const FOUNDATION_LABELS: Record<string, string> = {
  piers: 'Posts on footers',
  wall: 'Continuous wall',
  basement: 'Full basement',
  slab: 'Slab on grade',
  skids: 'Skids (movable)',
};

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

/**
 * Build the panel for a family. Sections are numbered and named in plain language — the word
 * "Level" is deliberately absent from visible copy (it collides with the disclosure-level
 * vocabulary in the design doc and means nothing to a reader).
 */
export function configSchemaFor(familyId: FamilyId): PanelSchema {
  const family = familyById(familyId);
  if (!family) return { family: familyId, groups: [] };

  const groups: PanelGroup[] = [];

  // A tower is not a building with different numbers — it has no walls, no openings and no
  // foundation choice in the building sense, so it gets its own panel rather than a building
  // panel with four fifths of its rows suppressed. The knobs below are exactly the ones its
  // drawing leaves open, and the two that matter most (height, access) are the two EM 385-1-1
  // has an opinion about: choose a ladder at 24 ft and normalizeSpec switches it and says so.
  if (family.specBranch === 'tower') {
    groups.push({
      title: '1 · THE TOWER',
      rows: [
        {
          path: 'platformHeightFt', label: 'Platform height', control: 'select', numeric: true,
          options: ['10', '16', '24', '32'],
          cite: 'TM 5-302 guard tower heights (PH)',
          help: 'Above 20 ft a fixed ladder is not an acceptable sole means of access (EM 385-1-1) — the tool switches to a stair and tells you.',
        },
        { path: 'cabPlanFt', label: 'Cab plan', control: 'select', numeric: true, options: ['6', '8'], help: 'Square, in feet.' },
      ],
    });
    groups.push({
      title: '2 · GETTING UP',
      rows: [
        {
          path: 'access', label: 'Way up', control: 'select', options: ['ladder', 'stair'],
          cite: 'EM 385-1-1 fixed-ladder cage threshold',
          help: 'A ladder\u2019s rails run 36 in past the landing so there is something to hold when your feet leave the top rung. A stair switchbacks to stay inside the footprint.',
        },
      ],
    });
    groups.push({
      title: '3 · THE CAB',
      rows: [
        {
          path: 'cab.walls', label: 'Cab walls', control: 'select',
          options: ['open-rail', 'half-wall', 'half-wall-screen'],
          help: 'Open rail · half-wall you can fire over · half-wall with screen above.',
        },
        { path: 'cab.roof', label: 'Cab roof', control: 'select', options: ['pyramid', 'shed'] },
        { path: 'coverings.roofing', label: 'Roofing', control: 'select', options: family.coverings.roofing ?? ['corrugated'] },
      ],
    });
    groups.push({
      title: '4 · WHAT IT STANDS ON',
      rows: [
        {
          path: 'footing', label: 'Footing', control: 'select', options: ['timber-mudsill', 'concrete-pad'],
          help: 'A timber mudsill spreads the leg load over tamped fill and can be built with what is on the truck. A poured pad is the deliberate version.',
        },
      ],
    });
    return { family: familyId, groups };
  }

  // 1 · SHAPE
  const shape: PanelRow[] = [];
  for (const p of ['dims.lengthFt', 'dims.widthFt', 'stories.0.wallHeightFt']) {
    const row = numberRow(p, family);
    if (row) shape.push(row);
  }
  if (family.specBranch === 'building') {
    shape.push({
      path: 'roof.kind',
      label: 'Roof type',
      control: 'select',
      options: family.roofs,
      help: family.roofs.map((r) => ROOF_LABELS[r] ?? r).join(' · '),
    });
    const pitch = numberRow('roof.risePer12', family, 'Inches of rise per foot of run. 4 means 4 in 12.');
    if (pitch) shape.push(pitch);
    const oh = numberRow('roof.overhangFt', family, 'How far the roof sticks out past the wall.');
    if (oh) shape.push(oh);
  }
  groups.push({ title: '1 · SHAPE', rows: shape });

  // 2 · OPENINGS — the array surface. On standards it is `preset`: editable, badged, resettable.
  groups.push({
    title: '2 · OPENINGS',
    rows: [{
      path: 'stories.0.openings',
      label: 'Doors, windows and vents',
      control: 'openings-editor',
      ...(family.id === 'custom' ? {} : { lock: 'preset' as const }),
      help: 'Rough-opening size and position on each wall. The framing follows automatically.',
    }],
  });

  // 3 · FOUNDATION
  const foundation: PanelRow[] = [{
    path: 'foundation.kind',
    label: 'Foundation',
    control: 'select',
    options: FOUNDATION_OPTIONS,
    help: FOUNDATION_OPTIONS.map((f) => FOUNDATION_LABELS[f]).join(' · '),
  }];
  const crawl = numberRow('foundation.crawlFt', family, 'Grade to the underside of the sill.');
  if (crawl) foundation.push(crawl);
  const depth = numberRow('foundation.depthFt', family, 'Sill bottom to the top of the basement slab.');
  if (depth) foundation.push(depth);
  groups.push({ title: '3 · FOUNDATION', rows: foundation });

  // 4 · CLOSING IN
  const skin: PanelRow[] = [];
  for (const [key, label] of [
    ['coverings.wallSheathing', 'Wall sheathing'],
    ['coverings.siding', 'Siding'],
    ['coverings.roofDeck', 'Roof deck'],
    ['coverings.roofing', 'Roofing'],
  ] as const) {
    const field = key.split('.')[1] as keyof FamilyDef['coverings'];
    const options = family.coverings[field];
    if (!options || options.length === 0) continue;
    skin.push({ path: key, label, control: 'select', options });
  }
  skin.push(
    { path: 'bridging', label: 'Bridging', control: 'select', options: ['cross', 'solid'] },
    { path: 'stories.0.letInBracing', label: 'Let-in corner bracing', control: 'toggle' },
    { path: 'atticAccess', label: 'Attic hatch', control: 'toggle' },
  );
  if (family.specBranch === 'hut') {
    skin.push({
      path: 'screenBand',
      label: 'Screened band',
      control: 'toggle',
      help: 'The band under the eaves that lets a closed hut breathe. The siding is cut around it.',
      cite: 'TM 5-302 SEA hut screened band (PH)',
    });
  }
  groups.push({ title: '4 · CLOSING IN', rows: skin });

  return { family: familyId, groups };
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
