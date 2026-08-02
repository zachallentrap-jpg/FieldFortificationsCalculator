// TIMBER-2 — the structure catalog (plan §2.2–2.6, TD2/TD3).
//
// TD2: breadth lives HERE, in preset data; correctness lives in ONE engine. A card is a
// `FamilyDef` — a preset spec, the knobs it exposes, the values its standard drawing pins,
// and its lineage. It is not a code path. Adding a structure that an existing spec branch can
// express is a data edit; only a genuinely new geometry needs a new branch.
//
// TD3: this table is the SINGLE source for what each family locks, what it exposes, which
// roofs it allows and which coverings it offers. The plan document's tables are generated
// FROM it, and `test/timber2-catalog.test.ts` asserts they agree — so a doc that describes a
// different tool than the code is impossible rather than merely discouraged.

import type { StructureSpec, RoofSpec, CoveringSpec, StructureFamily } from './spec';

export type FamilyId =
  | 'gp-frame' | 'sea-hut' | 'swa-hut' | 'b-hut' | 'squad-hut' | 'guard-shack' | 'storage-shed'
  | 'tower' | 'strongback' | 'tent-floor' | 'crib-bunker' | 'latrine' | 'platform' | 'custom';

export type FamilyGroup = 'buildings' | 'towers' | 'tents-frames' | 'bunkers' | 'site' | 'custom';

/** A value the family's standard drawing pins: read-only, shown with its citation. */
export interface FamilyLock {
  path: string; // dotted spec path, or a prose key for non-spec locks
  label: string;
  value: string; // rendered value
  cite: string; // pub + (PH)
  lifeSafety?: boolean;
}

/** Where the default cut plane goes for this family's cutaway (mandate #5, plan §4.2). */
export interface CutawaySpec {
  axis: 'x' | 'z' | 'y';
  /** 0..1 along that axis. */
  frac: number;
  keep: 1 | -1;
  /** Why this cut teaches something — shown as the cutaway's caption. */
  reason: string;
  ghost?: 'soil' | 'canvas';
}

export interface FamilyDef {
  id: FamilyId;
  group: FamilyGroup;
  name: string;
  oneLiner: string;
  /** The complete preset — normalizes clean, generates green. */
  preset: StructureSpec;
  specBranch: StructureFamily;
  lineage: string; // publication lineage, with (PH) where pending
  /** Thin-lineage honesty (plan §2.2): why this family exists without its own sheet. */
  rationale?: string;
  locks: FamilyLock[];
  roofs: RoofSpec['kind'][]; // legal roof kinds; the panel renders only these
  coverings: Partial<Record<keyof CoveringSpec, string[]>>;
  cutaway: CutawaySpec;
  /** Param paths whose non-drawing values render the "deviation from standard drawing" mark. */
  deviationMarks?: string[];
  /** Capacity/use chip, when doctrine states one (plan §5.2). */
  capacity?: string;
  /** Phase that ships this card — the picker hides families whose engine is not built yet. */
  shipped: boolean;
}

const STD_SPACING = { studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16 } as const;
const NO_COVERINGS: CoveringSpec = { wallSheathing: 'none', siding: 'none', roofDeck: 'plywood', roofing: 'none' };

// ── The families ─────────────────────────────────────────────────────────────

const GP_FRAME: FamilyDef = {
  id: 'gp-frame',
  group: 'buildings',
  name: 'GP framed building',
  oneLiner: 'The workhorse theater-of-operations building — frame it long, close it in, roof it.',
  specBranch: 'building',
  lineage: 'FM 5-426 ch. 4–6; TM 5-302 GP building (PH); UFC 1-201-01 (PH)',
  capacity: 'general purpose',
  shipped: true,
  // TD20: a REAL standard-design identity, deliberately not the custom/demo default — two
  // cards that generate the same building are one card shown twice.
  preset: {
    family: 'building',
    dims: { lengthFt: 48, widthFt: 20 },
    spacing: STD_SPACING,
    coverings: { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'roll' },
    stories: [{
      wallHeightFt: 8,
      letInBracing: true,
      openings: {
        E: [{ kind: 'door', offsetFt: 8, widthFt: 3, heightFt: 6.7, sillHeightFt: 0, fill: 'door-ledged' }],
        W: [{ kind: 'door', offsetFt: 8, widthFt: 3, heightFt: 6.7, sillHeightFt: 0, fill: 'door-ledged' }],
        S: [
          { kind: 'window', offsetFt: 6, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
          { kind: 'window', offsetFt: 18, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
          { kind: 'window', offsetFt: 30, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
          { kind: 'window', offsetFt: 42, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
        ],
        N: [
          { kind: 'window', offsetFt: 6, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
          { kind: 'window', offsetFt: 18, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
          { kind: 'window', offsetFt: 30, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
          { kind: 'window', offsetFt: 42, widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
        ],
      },
    }],
    roof: { kind: 'gable', risePer12: 4, overhangFt: 1 },
    foundation: { kind: 'piers', crawlFt: 1.5 },
    bridging: 'cross',
  },
  locks: [
    { path: 'floor.joistSizing', label: 'Joist & girder sizing', value: 'per span tables', cite: 'FM 5-426 Tables 6-1/6-2 (PH)', lifeSafety: true },
    { path: 'header.sizing', label: 'Header sizing', value: 'per span', cite: 'FM 5-426 header table (PH)', lifeSafety: true },
  ],
  roofs: ['gable', 'shed', 'flat'],
  coverings: {
    siding: ['none', 'plywood', 'boards', 'boardAndBatten'],
    roofing: ['none', 'roll', 'rollDouble', 'corrugated'],
    roofDeck: ['none', 'plywood', 'purlins'],
    wallSheathing: ['none', 'plywood'],
  },
  cutaway: { axis: 'z', frac: 0.5, keep: -1, reason: 'Cut through the door bay — see the header, the jacks, and how the floor meets the wall.' },
};

const STORAGE_SHED: FamilyDef = {
  id: 'storage-shed',
  group: 'buildings',
  name: 'Storage shed',
  oneLiner: 'Covered storage with a wide door bay — or leave the whole front open.',
  specBranch: 'building',
  lineage: 'TM 5-302 storage (PH); FM 5-426 ch. 6',
  capacity: 'unit storage',
  shipped: true,
  preset: {
    family: 'building',
    dims: { lengthFt: 20, widthFt: 12 },
    spacing: STD_SPACING,
    coverings: { wallSheathing: 'none', siding: 'boardAndBatten', roofDeck: 'plywood', roofing: 'roll' },
    stories: [{
      wallHeightFt: 8,
      letInBracing: true,
      openings: { S: [{ kind: 'door', offsetFt: 6, widthFt: 8, heightFt: 7, sillHeightFt: 0, fill: 'rough' }] },
    }],
    roof: { kind: 'gable', risePer12: 4, overhangFt: 1 },
    foundation: { kind: 'skids' },
  },
  locks: [
    { path: 'stories.0.wallHeightFt', label: 'Wall height', value: '8 ft', cite: 'TM 5-302 storage (PH)' },
    { path: 'header.wideOpening', label: 'Wide-door header', value: 'per span table', cite: 'FM 5-426 header table (PH)', lifeSafety: true },
  ],
  roofs: ['gable', 'shed', 'flat'],
  coverings: {
    siding: ['none', 'boards', 'boardAndBatten', 'plywood'],
    roofing: ['none', 'roll', 'corrugated'],
    roofDeck: ['none', 'plywood', 'purlins'],
  },
  cutaway: { axis: 'z', frac: 0.5, keep: -1, reason: 'Cut through the big door — see how the header carries the studs that were cut out.' },
};

const CUSTOM: FamilyDef = {
  id: 'custom',
  group: 'custom',
  name: 'Custom — start from a clean sheet',
  // TD22/TD40: says what it customizes, so nobody hunts for a tower knob here.
  oneLiner: 'Custom BUILDING: every knob unlocked. Towers, bunkers and platforms customize from their own cards.',
  specBranch: 'building',
  lineage: 'FM 5-426',
  shipped: true,
  preset: {
    family: 'building',
    dims: { lengthFt: 20, widthFt: 16 },
    spacing: STD_SPACING,
    coverings: NO_COVERINGS,
    stories: [{
      wallHeightFt: 8,
      openings: {
        S: [
          { kind: 'window', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
          { kind: 'door', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
        ],
        N: [{ kind: 'window', offsetFt: 8.5, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }],
      },
    }],
    roof: { kind: 'gable', risePer12: 4, overhangFt: 1 },
    foundation: { kind: 'piers', crawlFt: 1.5 },
  },
  locks: [], // nothing locked — that is the point of the card
  roofs: ['gable', 'shed', 'flat', 'none'],
  coverings: {
    wallSheathing: ['none', 'plywood', 'boards'],
    siding: ['none', 'plywood', 'boards', 'boardAndBatten'],
    roofDeck: ['none', 'plywood', 'purlins'],
    roofing: ['none', 'roll', 'rollDouble', 'corrugated'],
  },
  cutaway: { axis: 'z', frac: 0.5, keep: -1, reason: 'Cut through the middle — see the whole section at once.' },
};

/** The one table (TD3). Families land as their phases ship; `shipped` gates the picker. */
export const FAMILY_TABLE: readonly FamilyDef[] = [GP_FRAME, STORAGE_SHED, CUSTOM];

export function familyById(id: FamilyId): FamilyDef | undefined {
  return FAMILY_TABLE.find((f) => f.id === id);
}

export function shippedFamilies(): FamilyDef[] {
  return FAMILY_TABLE.filter((f) => f.shipped);
}

export const GROUP_ORDER: readonly FamilyGroup[] = [
  'buildings', 'towers', 'tents-frames', 'bunkers', 'site', 'custom',
] as const;

export const GROUP_LABELS: Record<FamilyGroup, string> = {
  buildings: 'Buildings',
  towers: 'Towers',
  'tents-frames': 'Tents & Frames',
  bunkers: 'Bunkers',
  site: 'Site',
  custom: 'Custom',
};

/** Families grouped for the picker, in the TD15 order, empty groups omitted. */
export function pickerGroups(): { group: FamilyGroup; label: string; families: FamilyDef[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    families: shippedFamilies().filter((f) => f.group === group),
  })).filter((g) => g.families.length > 0);
}
