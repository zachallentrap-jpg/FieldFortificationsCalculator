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
/**
 * Ground observed at the site. RECORDED, not consumed: FM 5-426 sizes post footers per soil
 * class, and until those tables are page-checked nothing in the engine is allowed to read this
 * — so it travels with the spec and prints on the command packet, where the reviewing engineer
 * can act on it, and the panel says exactly that. An input that silently did nothing would be a
 * lie; an input that states what it feeds is a site record.
 */
export type SoilKind = 'sand' | 'gravel' | 'loam' | 'clay' | 'rock';

export interface SpecCommon {
  dims: Dims;
  spacing: SpacingSpec;
  coverings: CoveringSpec;
  label?: string; // the user's name for a saved config
  site?: { soil?: SoilKind };
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
  /**
   * Full-run horizontal bands the wall covering is cut around — the hut family's screened band.
   * Heights are above the sole-plate top, like an opening's sill.
   */
  wallBands?: { v0: number; v1: number }[];
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

/**
 * A well-formed value for every SECTION a building-shaped spec must have.
 *
 * Used for one thing only: repairing a spec that arrived without one. A share link is any JSON
 * with a `family` key (see `decodeSpec`), so a spec can reach the generator missing a whole
 * structural section, and a generator handed `undefined` where `dims` should be does not warn —
 * it throws, and a thrown generator is a workbench that renders its chrome and then sits on
 * "Laying out the frame…" forever with no canvas and nothing said.
 *
 * These are not a second catalog. They are the smallest description of a building this tool can
 * draw: one 8-ft story with no openings, a gable, piers. The numbers sit inside the bounds
 * declared below, and `timber2-shared-link` proves it the only way that cannot drift — by
 * normalizing a spec built from them and asserting it raises no issues at all.
 *
 * It lives here rather than in `normalize.ts` because `normalize.ts` cannot reach the catalog:
 * catalog → families/hut → families/building → normalize is already a chain, and importing back
 * would close it into a cycle.
 */
export const SPEC_SECTION_FALLBACK = {
  dims: { lengthFt: 24, widthFt: 16 } as Dims,
  spacing: { studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16 } as SpacingSpec,
  coverings: { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'roll' } as CoveringSpec,
  stories: [{ wallHeightFt: 8, openings: {} }] as StorySpec[],
  roof: { kind: 'gable', risePer12: 4, overhangFt: 1 } as RoofSpec,
  foundation: { kind: 'piers', crawlFt: 1.5 } as FoundationSpec,
} as const;

/**
 * Which sections a spec must actually have, by family — and they are NOT the same set.
 *
 * `SpecCommon` is the three every family extends. A `BuildingSpec` adds three more. A `HutSpec`
 * adds none of them: it carries `wallHeightFt` and optional `roof`/`foundation`, and the hut
 * generator derives the rest from its variant — which is why the shipped sea-hut preset has no
 * `stories` key at all and is perfectly correct. Requiring the building's list of every family
 * would "repair" a shipped card, which is a bug with a warning attached.
 */
export const SPEC_SECTIONS_COMMON = ['dims', 'spacing', 'coverings'] as const;
export const SPEC_SECTIONS_BUILDING = [...SPEC_SECTIONS_COMMON, 'stories', 'roof', 'foundation'] as const;
export const SPEC_SECTIONS = SPEC_SECTIONS_BUILDING;
export type SpecSection = typeof SPEC_SECTIONS_BUILDING[number];

export const SPEC_PATH_DEFS: readonly SpecPathDef[] = [
  { path: 'dims.lengthFt', label: 'Length', min: 4, max: 60, step: 0.5, cite: '4–60 ft — what this generator will lay out' },
  { path: 'dims.widthFt', label: 'Width', min: 4, max: 24, step: 0.5, cite: '4–24 ft — a wider span needs a second girder line, which is not built yet' },
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
