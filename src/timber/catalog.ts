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
import { HUT, LATRINE, TOWER, RAIL, LADDER, citeOf } from './doctrine';
import { hutDims } from './families/hut';

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

// ── The hut family (T5) ──────────────────────────────────────────────────────
// TD2 in its purest form: six cards, one engine, zero new geometry. Each is a `hut` spec whose
// variant picks the plan size out of `doctrine.HUT` and whose generator adds girts, the screen
// band and (for the latrine) the riser box. What differs between the cards is DATA.
//
// Every one carries a `rationale`, because their lineage is thinner than the GP building's:
// these are the sizes the type is commonly built to, with the sheet still pending. A card that
// exists because a preset can express it should say so on its face.

const HUT_COVERINGS: CoveringSpec = { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'roll' };

function hutCard(
  id: FamilyId,
  variant: 'seaHut' | 'swaHut' | 'bHut' | 'squadHut' | 'guardShack' | 'latrine',
  name: string,
  oneLiner: string,
  lineage: string,
  capacity: string,
  extra: Partial<FamilyDef> = {},
  presetExtra: Record<string, unknown> = {},
): FamilyDef {
  const d = hutDims(variant);
  return {
    id,
    group: 'buildings',
    name,
    oneLiner,
    specBranch: 'hut',
    lineage,
    capacity,
    shipped: true,
    rationale:
      'Plan size and wall height come from the figures this type is commonly built to, carried as (PH) '
      + 'until the sheet is page-checked. Every dimension on this card is adjustable — nothing here is '
      + 'locked as if it had been verified.',
    preset: {
      family: 'hut',
      variant,
      dims: { lengthFt: d.lengthFt, widthFt: d.widthFt },
      spacing: STD_SPACING,
      coverings: HUT_COVERINGS,
      roof: { kind: 'gable', risePer12: 4, overhangFt: 1 },
      foundation: { kind: 'piers', crawlFt: 1.5 },
      ...presetExtra,
    } as StructureSpec,
    locks: [
      { path: 'girt', label: 'Wall girts', value: `${HUT.girtNominal.value} at ${HUT.girtSpacingFt.value} ft`, cite: citeOf(HUT.girtSpacingFt) },
      { path: 'header.sizing', label: 'Header sizing', value: 'per span', cite: 'FM 5-426 header table (PH)', lifeSafety: true },
    ],
    roofs: ['gable', 'shed'],
    coverings: {
      siding: ['none', 'plywood', 'boards', 'boardAndBatten'],
      roofing: ['none', 'roll', 'rollDouble', 'corrugated'],
      roofDeck: ['none', 'plywood', 'purlins'],
      wallSheathing: ['none', 'plywood'],
    },
    cutaway: { axis: 'z', frac: 0.5, keep: -1, reason: 'Cut through the length — see the girts, the studs they stiffen, and the roof over them.' },
    ...extra,
  };
}

const SEA_HUT = hutCard(
  'sea-hut', 'seaHut', 'SEA hut',
  'Tropical billeting: closed walls with a screened band under the eaves so it breathes.',
  'TM 5-302 SEA hut (PH — sheet pending); FM 5-426 ch. 6 framing',
  'billeting, ~8–10 personnel',
  {
    cutaway: { axis: 'z', frac: 0.5, keep: -1, reason: 'Cut through the band — see where the wall stops and the screen starts.' },
    locks: [
      { path: 'screenBand', label: 'Screened band', value: `${HUT.screenBandHeightFt.value} ft at ${HUT.screenBandSillFt.value} ft`, cite: citeOf(HUT.screenBandSillFt) },
      { path: 'girt', label: 'Wall girts', value: `${HUT.girtNominal.value} at ${HUT.girtSpacingFt.value} ft`, cite: citeOf(HUT.girtSpacingFt) },
    ],
  },
);

const SWA_HUT = hutCard(
  'swa-hut', 'swaHut', 'SWA hut',
  'The desert cousin: same frame, closed up, no screened band.',
  'TM 5-302 SWA hut (PH — sheet pending); FM 5-426 ch. 6 framing',
  'billeting, ~8–10 personnel',
  {}, { screenBand: null },
);

const B_HUT = hutCard(
  'b-hut', 'bHut', 'B-hut',
  `Billeting split into ${HUT.bHutBays.value} bays — one hut, four rooms, a door at each end.`,
  'TM 5-302 B-hut (PH — sheet pending); FM 5-426 ch. 6 framing',
  `billeting, ${HUT.bHutBays.value} rooms`,
  {
    cutaway: { axis: 'x', frac: 0.5, keep: -1, reason: 'Cut across the bays — see how the partitions land between the studs.' },
  }, { screenBand: null },
);

const SQUAD_HUT = hutCard(
  'squad-hut', 'squadHut', 'Squad hut',
  'One long open bay for a squad — no partitions, windows down both sides.',
  'TM 5-302 squad hut (PH — sheet pending); FM 5-426 ch. 6 framing',
  'billeting, one squad',
  {}, { screenBand: null },
);

const GUARD_SHACK = hutCard(
  'guard-shack', 'guardShack', 'Guard shack',
  'A post you can see out of on three sides, small enough to skid into place.',
  'TM 5-302 guard shack (PH — sheet pending); FM 5-426 ch. 6 framing',
  '1–2 personnel',
  {
    cutaway: { axis: 'z', frac: 0.5, keep: -1, reason: 'Cut through the door — at this size the whole frame is one section.' },
  },
  { screenBand: null, foundation: { kind: 'skids' } },
);

const LATRINE_CARD = hutCard(
  'latrine', 'latrine', 'Field latrine',
  'Riser box over the pit, screened band above, door on the long side.',
  'TM 5-302 field latrine (PH — sheet pending); FM 5-426 ch. 6 framing',
  '4 seats',
  {
    group: 'site',
    cutaway: { axis: 'x', frac: 0.5, keep: -1, reason: 'Cut across the bench — see the riser box, the aisle in front of it, and the door swing.' },
    locks: [
      { path: 'latrine.seats', label: 'Seats', value: '4', cite: citeOf(LATRINE.seatSpacingFt) },
      { path: 'latrine.depthFt', label: 'Pit depth', value: `${LATRINE.pitDepthFt.value} ft`, cite: citeOf(LATRINE.pitDepthFt), lifeSafety: true },
    ],
    rationale:
      'The pit is a DIGGING task, not a framing one: its depth travels on the spec and prints on the '
      + 'sheet, and no member is generated for it. Shoring an open pit is a life-safety decision that '
      + 'belongs to the person on the ground, not to this tool.',
  },
  { latrine: { seats: 4, depthFt: LATRINE.pitDepthFt.value as number } },
);

// ── The guard tower (T4) ─────────────────────────────────────────────────────
// The owner's first-named type, and the first structure here where being wrong drops someone.
// Its locks are the life-safety rows: they render with the LS mark and they are the same values
// the printable register enumerates.

const TOWER_CARD: FamilyDef = {
  id: 'tower',
  group: 'towers',
  name: 'Guard tower',
  oneLiner: 'A railed platform on four battered legs, with a cab on top and a way up that suits the height.',
  specBranch: 'tower',
  lineage: 'TM 5-302 guard tower (PH — sheet pending); EM 385-1-1 for access, rails and fall protection',
  capacity: '2 observers',
  shipped: true,
  rationale:
    'Framing dimensions are the figures this type is commonly built to, carried as (PH). The ACCESS and '
    + 'FALL-PROTECTION numbers are different in kind: they come from EM 385-1-1 and they are the reason a '
    + '24-ft tower will not accept a ladder here — the tool switches it to a stair and tells you it did.',
  preset: {
    family: 'tower',
    dims: { lengthFt: 12, widthFt: 12 },
    spacing: STD_SPACING,
    coverings: { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'corrugated' },
    platformHeightFt: 16,
    cabPlanFt: 8,
    access: 'ladder',
    cab: { walls: 'half-wall-screen', roof: 'pyramid', roofing: 'corrugated' },
    footing: 'timber-mudsill',
  } as StructureSpec,
  locks: [
    { path: 'access', label: 'Ladder height limit', value: `stair required above ${TOWER.ladderMaxHeightFt.value} ft`, cite: citeOf(TOWER.ladderMaxHeightFt), lifeSafety: true },
    { path: 'rail.topHeightIn', label: 'Guardrail height', value: `${RAIL.topHeightIn.value} in`, cite: citeOf(RAIL.topHeightIn), lifeSafety: true },
    { path: 'ladder.topExtensionIn', label: 'Ladder rail extension', value: `${LADDER.topExtensionIn.value} in above the landing`, cite: citeOf(LADDER.topExtensionIn), lifeSafety: true },
    { path: 'tower.batter', label: 'Leg batter', value: `${TOWER.batterPerSideFt.value} ft per side`, cite: citeOf(TOWER.batterPerSideFt), lifeSafety: true },
  ],
  roofs: ['pyramid', 'shed'],
  coverings: { roofing: ['corrugated', 'roll'] },
  cutaway: { axis: 'z', frac: 0.5, keep: -1, reason: 'Cut through the middle — see the batter, every brace bay, and how the platform lands on the legs.' },
};

/** The one table (TD3). Families land as their phases ship; `shipped` gates the picker. */
export const FAMILY_TABLE: readonly FamilyDef[] = [
  GP_FRAME, SEA_HUT, SWA_HUT, B_HUT, SQUAD_HUT, GUARD_SHACK, STORAGE_SHED,
  TOWER_CARD, LATRINE_CARD, CUSTOM,
];

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
