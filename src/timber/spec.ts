// TIMBER-2 — the StructureSpec union (plan §3.1). All plain data: JSON-serializable, no
// functions, no classes — so a spec is catalog data, hashable, diffable, shareable.
//
// The union is deliberately shaped so ILLEGAL COMBINATIONS CANNOT BE WRITTEN DOWN (TD4).
// Bent framing exists only on `TentFrameSpec`; a screen band only on `HutSpec`; a wall that
// takes no openings is a `BuildingSpec.openFront` naming one wall. The alternative — one
// god-surface of mode flags with a validator saying "not that combination" — was rejected:
// the config panel would have to render options it then refuses.
//
// Roof/foundation are their own unions for the same reason: `{kind:'flat'}` has no
// `risePer12` to be inconsistent about.

import type { WallId } from './types';
import type { BridgingType } from './floor';

export interface Dims {
  lengthFt: number; // X
  widthFt: number; // Z
}

export type SpacingIn = 12 | 16 | 24;
export interface SpacingSpec {
  studSpacingIn: SpacingIn;
  joistSpacingIn: SpacingIn;
  rafterSpacingIn: SpacingIn;
}

/**
 * Narrow a spec spacing to what the frozen legacy generators accept. The spec surface is
 * wider (12 in OC is legal framing) but the legacy branch is pinned to 16|24 by the compat
 * goldens, so a 12-in spec routes through the new roof/floor paths instead of quietly being
 * built at some other spacing. This is a type adapter, which is why it lives with the type
 * rather than inside a generator.
 */
export function toLegacySpacing(oc: SpacingIn): 16 | 24 {
  return oc === 24 ? 24 : 16;
}

export type OpeningKind = 'door' | 'window' | 'vent' | 'screen' | 'hatch' | 'embrasure';
export type OpeningFill =
  | 'rough'
  | 'door-ledged'
  | 'door-screen'
  | 'window-shutter'
  | 'window-screen'
  | 'window-screen-shutter'
  | 'vent-screen'
  | 'ac-sleeve';

export interface OpeningSpec {
  kind: OpeningKind;
  offsetFt: number; // from the wall's left end viewed from OUTSIDE, to the RO's left edge
  widthFt: number;
  heightFt: number;
  sillHeightFt: number; // 0 = door (no rough sill, no cripples below)
  headerNominal?: string; // default: header table by span; custom-only override
  fill?: OpeningFill; // default 'rough' — the legacy behavior
  story?: 1 | 2;
  placement?: 'exact' | 'auto'; // 'auto': engine spaces N openings evenly in the clear run
  id?: string; // stable handle for per-opening locks (catalog signature bays)
  locked?: boolean;
}

export type WallOpenings = Partial<Record<WallId, OpeningSpec[]>>;

// TD5, and it is load-bearing: `fill` lives HERE, on the spec-level opening, so walls.ts —
// the frozen legacy branch — is never edited. Generators NEVER iterate Object.keys() over a
// WallOpenings record; they walk the const WALL_ORDER below, so a spec that happens to have
// been built with its keys in a different order produces an identical model (I-15).
export const WALL_ORDER: readonly WallId[] = ['S', 'N', 'E', 'W'] as const;

export type RoofSpec =
  | { kind: 'gable'; risePer12: number; overhangFt: number }
  | { kind: 'shed'; risePer12: number; overhangFt: number; highSide: WallId }
  | { kind: 'flat'; overhangFt: number; drainPer12?: number } // clamped to [1,2] — plan §2.5/TD7
  | { kind: 'hip'; risePer12: number; overhangFt: number } // T8
  | { kind: 'pyramid'; risePer12: number; overhangFt: number } // tower cab (T4)
  | { kind: 'none' };

export type FoundationSpec =
  | { kind: 'piers'; crawlFt: number }
  | { kind: 'wall'; crawlFt: number }
  | { kind: 'basement'; depthFt: number; stairs: boolean }
  | { kind: 'slab' }
  | { kind: 'skids'; skidNominal?: string }
  | { kind: 'embedded'; embedFt: number }; // tower / bunker posts

export interface StorySpec {
  wallHeightFt: number;
  openings: WallOpenings;
  letInBracing?: boolean;
}

export interface CoveringSpec {
  wallSheathing: 'none' | 'plywood' | 'boards';
  siding: 'none' | 'plywood' | 'boards' | 'boardAndBatten';
  roofDeck: 'none' | 'plywood' | 'boards' | 'skip' | 'purlins';
  roofing: 'none' | 'roll' | 'rollDouble' | 'corrugated';
  buildingPaper?: boolean;
}

/** What every family branch shares (plan §3.1 SpecCommon). */
export interface SpecCommon {
  dims: Dims;
  spacing: SpacingSpec;
  coverings: CoveringSpec;
  label?: string; // the user's name for a saved config
}

export interface PartitionSpec {
  axis: 'X' | 'Z';
  stationFt: number;
  door?: { offsetFt: number; widthFt: number };
}

export interface BuildingSpec extends SpecCommon {
  family: 'building';
  stories: StorySpec[]; // 1..2
  roof: RoofSpec;
  foundation: FoundationSpec;
  bridging?: BridgingType;
  atticAccess?: boolean;
  interiorStairs?: boolean; // default true at 2 stories; false is LEGAL (ladder instead)
  openFront?: WallId; // storage shed: posts + header; that wall takes no openings
  partitions?: PartitionSpec[];
  entrySteps?: boolean;
}

export interface HutSpec extends SpecCommon {
  family: 'hut';
  variant: 'seaHut' | 'swaHut' | 'bHut' | 'squadHut' | 'guardShack' | 'latrine';
  wallHeightFt?: number;
  screenBand?: { sillFt: number; heightFt: number } | null;
  shutters?: 'none' | 'side' | 'propped';
  openings?: WallOpenings;
  roof?: RoofSpec;
  foundation?: FoundationSpec;
  latrine?: { seats: 2 | 4; depthFt: number };
  partitions?: PartitionSpec[];
}

export interface TowerSpec extends SpecCommon {
  family: 'tower';
  platformHeightFt: 10 | 16 | 24 | 32;
  cabPlanFt: 6 | 8;
  access: 'ladder' | 'stair'; // normalizeSpec FORCES 'stair' at 24|32 (EM 385-1-1)
  cab: {
    walls: 'open-rail' | 'half-wall' | 'half-wall-screen';
    roof: 'pyramid' | 'shed';
    roofing: 'corrugated' | 'roll';
  };
  footing: 'timber-mudsill' | 'concrete-pad';
}

export interface BunkerSpec extends SpecCommon {
  family: 'bunker';
  interiorLengthFt: number;
  interiorWidthFt: number;
  clearHeightFt: number;
  designCoverDepthFt: number; // USER-STATED (plan §2.7) — an input, never an output
  wallType: 'post-plank' | 'crib';
  entrance: 'open' | 'baffle';
  showSoilCover?: boolean;
}

export interface TentFrameSpec extends SpecCommon {
  family: 'tentFrame';
  tent: 'gpSmall' | 'gpMedium' | 'temper';
  temperBays?: number;
  endDoor?: boolean;
  foundation?: Extract<FoundationSpec, { kind: 'piers' | 'skids' }>;
}

export interface PlatformSpec extends SpecCommon {
  family: 'platform';
  deckHeightFt: number;
  base: 'piers' | 'skids';
  deck: 'plank' | 'panel';
  ramp?: { widthFt: number; slope: 4 | 6 | 8 };
  steps?: boolean;
  railEdges: WallId[];
}

export type StructureSpec =
  | BuildingSpec
  | HutSpec
  | TowerSpec
  | BunkerSpec
  | TentFrameSpec
  | PlatformSpec;
export type StructureFamily = StructureSpec['family'];

// ── The path registry (plan §3.7) ────────────────────────────────────────────
// ONE list drives the clamp table, `configSchemaFor`, and the coverage assertions. A numeric
// knob that isn't here is a knob nothing clamps and no panel renders — the sync test makes
// that impossible rather than leaving it to review.

export interface SpecPathDef {
  path: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  cite?: string;
}

export const SPEC_PATH_DEFS: readonly SpecPathDef[] = [
  { path: 'dims.lengthFt', label: 'Length', min: 4, max: 60, step: 0.5, cite: 'engine envelope' },
  { path: 'dims.widthFt', label: 'Width', min: 4, max: 24, step: 0.5, cite: 'engine envelope (multi-girder > 24 ft is IN-later)' },
  { path: 'stories.0.wallHeightFt', label: 'Wall height', min: 6, max: 12, step: 0.5, cite: 'FM 5-426 ch. 6 (PH)' },
  { path: 'stories.1.wallHeightFt', label: 'Second-story wall height', min: 6, max: 12, step: 0.5, cite: 'FM 5-426 ch. 6 (PH)' },
  { path: 'roof.risePer12', label: 'Roof pitch', min: 0, max: 12, step: 1, cite: 'FM 5-426 framing-square method (PH)' },
  { path: 'roof.overhangFt', label: 'Eave overhang', min: 0, max: 3, step: 0.5, cite: 'FM 5-426 cornice (PH)' },
  { path: 'roof.drainPer12', label: 'Flat-roof drainage slope', min: 1, max: 2, step: 0.25, cite: 'FM 5-426 roll-roofing minimum slope (PH)' },
  // Floored at 1 ft, not 0.5: the built-up girder hangs a full 9 1/4 in BELOW the sill, so a
  // shallower crawl puts the girder posts underground — the sweep caught it as a negative post
  // length. The bound is geometry, not preference, and it is stated once here.
  { path: 'foundation.crawlFt', label: 'Crawl height', min: 1, max: 4, step: 0.25, cite: 'FM 5-426 foundations (PH); floored by the girder depth below the sill' },
  { path: 'foundation.depthFt', label: 'Basement depth', min: 6, max: 9, step: 0.5, cite: 'FM 5-426 basement (PH)' },
  { path: 'foundation.embedFt', label: 'Post embedment', min: 2, max: 6, step: 0.5, cite: 'TM 5-302 (PH)' },
  { path: 'platformHeightFt', label: 'Platform height', min: 10, max: 32, step: 1, cite: 'TM 5-302 tower (PH, LS)' },
  { path: 'cabPlanFt', label: 'Cab plan', min: 6, max: 8, step: 2, cite: 'TM 5-302 tower (PH)' },
  { path: 'interiorLengthFt', label: 'Interior length', min: 6, max: 16, step: 1, cite: 'bunker envelope (PH)' },
  { path: 'interiorWidthFt', label: 'Interior width', min: 6, max: 12, step: 1, cite: 'bunker envelope (PH)' },
  { path: 'clearHeightFt', label: 'Clear height', min: 4.5, max: 7, step: 0.5, cite: 'bunker envelope (PH)' },
  { path: 'designCoverDepthFt', label: 'Stated cover depth', min: 0, max: 4, step: 0.5, cite: 'load-table row range (PH, LS, SME)' },
  { path: 'deckHeightFt', label: 'Deck height', min: 0.5, max: 5, step: 0.25, cite: 'TM 5-302 loading platform (PH)' },
  { path: 'ramp.widthFt', label: 'Ramp width', min: 4, max: 12, step: 0.5, cite: 'TM 5-302 (PH)' },
  { path: 'temperBays', label: 'TEMPER bays', min: 2, max: 8, step: 1, cite: 'TM 10-8340 (PH)' },
  { path: 'latrine.depthFt', label: 'Pit depth', min: 4, max: 8, step: 0.5, cite: 'TM 5-302 latrine (PH — sheet pending)' },
  { path: 'openings[].offsetFt', label: 'Opening offset', min: 0, max: 60, step: 0.25 },
  { path: 'openings[].widthFt', label: 'Opening width', min: 0.5, max: 16, step: 0.25 },
  { path: 'openings[].heightFt', label: 'Opening height', min: 0.5, max: 10, step: 0.25 },
  { path: 'openings[].sillHeightFt', label: 'Sill height', min: 0, max: 9, step: 0.25 },
];

export const SPEC_PATHS: readonly string[] = SPEC_PATH_DEFS.map((d) => d.path);

const BY_PATH = new Map(SPEC_PATH_DEFS.map((d) => [d.path, d]));
export function specPath(path: string): SpecPathDef | undefined {
  return BY_PATH.get(path);
}
