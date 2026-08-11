// WOODFRAME-2 — the StructureSpec union (plan §3.1). All plain data: JSON-serializable, no
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
import { FOUNDATION, LAYOUT, ROOF, limitRow } from './doctrine';

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
  roofDeck: 'none' | 'plywood' | 'boards' | 'purlins';
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
   * Whether the windows get shutters, and how. Lives here as well as on `HutSpec` because the
   * hut translates itself into a `BuildingSpec` and the covering pass runs inside the building
   * generator — a field the translation drops is a field the generator cannot see.
   */
  shutters?: 'none' | 'side' | 'propped';
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
    // NO `roofing` HERE. The cab is the tower's only roof, so what covers it is
    // `coverings.roofing` — which is what the panel writes and what `tower.ts` reads. A second
    // field saying the same thing was declared, written by the preset and read by nothing: set
    // it to 'roll' through a link and the cab still came out corrugated, byte for byte.
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
export const SPEC_SECTION_FALLBACK: {
  readonly dims: Dims;
  readonly spacing: SpacingSpec;
  readonly coverings: CoveringSpec;
  readonly stories: StorySpec[];
  readonly roof: RoofSpec;
  readonly foundation: FoundationSpec;
} = {
  dims: { lengthFt: 24, widthFt: 16 },
  coverings: { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'roll' },
  // GETTERS, so the doctrine leaves are read when a repair happens, not when this module loads.
  // A module-load snapshot here would hand a share-link repair the SHIPPED spacing after an
  // import corrected it — the exact staleness the live rule register exists to end.
  get spacing(): SpacingSpec {
    return {
      studSpacingIn: LAYOUT.studSpacingIn.value as SpacingIn,
      joistSpacingIn: LAYOUT.joistSpacingIn.value as SpacingIn,
      rafterSpacingIn: LAYOUT.rafterSpacingIn.value as SpacingIn,
    };
  },
  get stories(): StorySpec[] {
    return [{ wallHeightFt: 8, openings: {} }];
  },
  get roof(): RoofSpec {
    return { kind: 'gable', risePer12: ROOF.risePer12.value as number, overhangFt: ROOF.overhangFt.value as number };
  },
  get foundation(): FoundationSpec {
    return { kind: 'piers', crawlFt: FOUNDATION.crawlFt.value as number };
  },
};

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

/**
 * A registry row whose min/max/step are LIVE READS of `doctrine.LIMITS` — the clamp table is
 * doctrine data now, editable through the validated offline import, and a module-load copy here
 * would clamp against the shipped bounds after an import corrected them. The label and the
 * clamp-message cite stay HERE: they are UI copy about the row, not the rule itself (the LIMITS
 * leaf carries its own register-grade citation). A row with no LIMITS leaf is refused at load —
 * a knob nothing clamps must be impossible, not discovered.
 */
function row(path: string, label: string, cite?: string): SpecPathDef {
  if (!limitRow(path)) throw new Error(`spec.ts: no doctrine.LIMITS row for '${path}' — every numeric knob must have one`);
  return {
    path,
    label,
    ...(cite !== undefined ? { cite } : {}),
    get min(): number { return limitRow(path)!.min; },
    get max(): number { return limitRow(path)!.max; },
    get step(): number { return limitRow(path)!.step; },
  };
}

export const SPEC_PATH_DEFS: readonly SpecPathDef[] = [
  row('dims.lengthFt', 'Length', '4–60 ft — what this generator will lay out'),
  row('dims.widthFt', 'Width', '4–24 ft — a wider span needs a second girder line, which is not built yet'),
  row('stories.0.wallHeightFt', 'Wall height', 'editor band — FM 5-426 ch. 6 states no height range (PH)'),
  row('roof.risePer12', 'Roof pitch', 'editor band — laid out per the FM 5-426 framing-square method, which states no range (PH)'),
  row('roof.overhangFt', 'Eave overhang', 'editor band — FM 5-426 has no cornice construction section (PH)'),
  row('roof.drainPer12', 'Flat-roof drainage slope', 'editor band — floored at the tool’s roll-roofing minimum-slope reading of FM 5-426 (an inference) (PH)'),
  // Floored at 1 ft, not 0.5: the built-up girder hangs a full 9 1/4 in BELOW the sill, so a
  // shallower crawl puts the girder posts underground — the sweep caught it as a negative post
  // length. The bound is geometry, not preference, and it is stated once, in LIMITS.
  row('foundation.crawlFt', 'Crawl height', 'editor band — FM 5-426’s crawl-space text covers ventilation only (PH); floored by the girder depth below the sill'),
  row('foundation.depthFt', 'Basement depth', 'editor band — FM 5-426 states no basement wall height (PH)'),
  row('platformHeightFt', 'Platform height', 'TM 5-302 tower (PH, LS)'),
  row('cabPlanFt', 'Cab plan', 'TM 5-302 tower (PH)'),
  row('interiorLengthFt', 'Interior length', 'bunker envelope (PH)'),
  row('interiorWidthFt', 'Interior width', 'bunker envelope (PH)'),
  row('clearHeightFt', 'Clear height', 'bunker envelope (PH)'),
  row('designCoverDepthFt', 'Stated cover depth', 'load-table row range (PH, LS, SME)'),
  // Floored at 1.75 ft, not 0.5, for the same reason `foundation.crawlFt` is floored at 1: the
  // frame hangs UNDER the walking surface and there has to be room for it. `deckHeightFt` is the
  // surface you stand on, and below it the platform stacks a runner (5½ in, lying on grade), a
  // post, a sill (5½), a joist (7¼) and the decking (1½) — 1.746 ft before the post is anything
  // at all, and the next step up from that is 1.75. Every setting the picker used to offer below
  // it was broken, each in its own way:
  //
  //   on skids   0.5, 1.0    no posts, and the sill 8¼ / 2¼ in UNDERGROUND
  //              1.25, 1.5   no posts, and the sill 4¾ / 1¾ in INSIDE the runner
  //   on piers   0.5, 1.0    no posts, and the sill 8¼ / 2¼ in UNDERGROUND
  //              1.25        no posts, and the sill floating ¾ in over grade on nothing
  //
  // Rendered, a 0.5-ft platform is a slab of decking sunk into the ground with no legs at all.
  // `timber2-platform-low-deck` re-derives this figure from the lumber and fails if the stock
  // changes under it. The bound is geometry, not preference, and it is stated once, in LIMITS.
  row('deckHeightFt', 'Deck height', 'TM 5-302 loading platform (PH); floored by the frame depth under the deck'),
  row('ramp.widthFt', 'Ramp width', 'TM 5-302 (PH)'),
  row('temperBays', 'TEMPER bays', 'TM 10-8340 (PH)'),
  row('latrine.depthFt', 'Pit depth', 'TM 5-302 latrine (PH — sheet pending)'),
  row('openings[].offsetFt', 'Opening offset'),
  row('openings[].widthFt', 'Opening width'),
  row('openings[].heightFt', 'Opening height'),
  row('openings[].sillHeightFt', 'Sill height'),
];

export const SPEC_PATHS: readonly string[] = SPEC_PATH_DEFS.map((d) => d.path);

const BY_PATH = new Map(SPEC_PATH_DEFS.map((d) => [d.path, d]));
export function specPath(path: string): SpecPathDef | undefined {
  return BY_PATH.get(path);
}
