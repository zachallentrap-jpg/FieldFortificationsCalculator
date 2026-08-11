// Positions (§8). The catalog of doctrinal survivability positions. Geometry magnitudes
// (feet) are P()-wrapped ILLUSTRATIVE PLACEHOLDERS; structural counts (crew, sumps,
// elbow holes) and the shape id are qualitative definition, kept plain (see DECISIONS
// D7). No dimension here is authoritative — confirm against the current survivability
// ATP before any real use.

import { P } from './types';
import type { Provenance } from './types';

export type ShapeId =
  | 'rect'
  | 'inverted_t'
  | 'l_shape'
  | 'circular'
  | 'vehicle_ramp'
  | 'rect_roofed';

// The firing platform is UNDISTURBED ORIGINAL EARTH LEFT STANDING inside the position's
// footprint — the gun/launcher stand the crew bays are dug down AROUND. It is a cut that is
// NOT made, never a built structure: "leave the firing-platform / elbow-shelf of undisturbed
// original earth between the front lip and where the frontal cover will go — this is a CUT,
// not a build" (docs/ONE_MAN_POSITION_MODELING_SPEC.md §2.f). Raised, built-up firing steps
// belong to trenches and vehicle positions, not to the individual crew-served hole.
//
// So the leaf below names its DATUM as well as its direction: the platform surface stands
// `riseAboveFloor` feet ABOVE the fighting-bay floor, equivalently the bays are dug that much
// deeper than the stand. It is therefore volume LEFT UNDUG and SUBTRACTS from the excavation.
// The old name (`depthBelowHole`) named neither datum nor sign, and three consumers read it
// three different ways — the bill added it, both drawings subtracted it.
export interface FiringPlatform {
  L: Provenance<number>;
  W: Provenance<number>;
  riseAboveFloor: Provenance<number>; // platform surface stands this far ABOVE the bay floor
}

// The secondary trench a compound position digs off its main bay — the inverted-T's rear stem,
// the L-shape's side arm. L is its frontage-axis extent, W its front-to-back extent, depthFrac
// how deep it is cut relative to the main bay. These were duplicated literals in drawPlan.ts and
// scene3d.ts (two renderers deriving the same dug volume from the hole's dimensions, each with
// its own factors); a dug trench is a physical dimension, so it belongs to the position.
export interface SubBay {
  L: Provenance<number>;
  W: Provenance<number>;
  depthFrac: Provenance<number>;
}

export interface PositionRow {
  label: string;
  shape: ShapeId;
  // Which volume model the engine runs for this position (qualitative structure, not a
  // magnitude): 'prism' = rectangular prism, 'cylinder' = circular pit (π/4 factor),
  // 'prism_ramp' = box cut plus the access-ramp wedge. Surfaced to the user as the
  // model-fidelity statement — formulas get the same honesty treatment as constants.
  volumeModel: 'prism' | 'cylinder' | 'prism_ramp';
  hole: { L: Provenance<number>; W: Provenance<number>; D: Provenance<number> }; // feet
  firingPlatform?: FiringPlatform;
  subBay?: SubBay;
  grenadeSumps: number; // count
  elbowHoles: number; // count
  storageCompartment: boolean;
  sectorsOfFire: boolean;
  crewSize: number;
}

const ft = (v: number, note: string): Provenance<number> => P(v, { unit: 'ft', note });

// What the frontal parapet is BUILT FROM (research-verified — ATP 3-21.8 §5-240 "Use spoil
// from hole to fill parapets in order of front, flanks, and rear"; FM 5-103 "Parapets are
// constructed using spoil from the excavation"):
//   'earth'   — mounded excavated SPOIL. Rifle / crew-served / mortar / ATGM / trench: the
//               protective mass is dirt; sandbags appear only at the firing rest (aperture),
//               in overhead cover, and as revetment when the soil is loose — never as the
//               parapet mass. A hasty rifle position uses zero sandbags.
//   'sandbag' — built-up sandbag walls ARE the structure. Only the bunker/OP (rect_roofed):
//               "Walls of fighting and protective positions are built of sandbags" (FM 5-103,
//               shelters/bunkers section) — the one class that stays mostly sandbag.
//   'berm'    — dozed spoil berm (vehicle defilade). Already modeled; nobody fills ~450 bags
//               around a hull-down (FM 5-103: spoil "flattened out or hauled away").
// Derived from existing signals so a new position never silently defaults wrong.
export type ParapetMode = 'earth' | 'sandbag' | 'berm';
export function parapetModeFor(pos: PositionRow): ParapetMode {
  if (pos.volumeModel === 'prism_ramp') return 'berm';
  if (pos.shape === 'rect_roofed') return 'sandbag';
  return 'earth';
}

// Vehicle-defilade excavation doctrine (shared by the vehicle_ramp shape family). The access
// ramp is the dominant excavation volume of a defilade — omitting it was falsifiable by any
// equipment operator in minutes (EXECUTION_PLAN Phase 1).
export const vehicleRamp = {
  slopeRatio: P(5.0, { unit: 'ratio', note: 'access-ramp run per foot of cut depth (illustrative)' }),
  // How much of the position's run is the graded way IN versus the level pan the vehicle parks
  // on. A shape proportion of a real cut, so it belongs here rather than in the view that draws it.
  rampRunFrac: P(0.65, { note: 'share of the position run taken by the graded ramp, the rest being the level pan (illustrative)' }),
};

export const positions: Record<string, PositionRow> = {
  one_man: {
    label: 'One-man fighting position',
    shape: 'rect',
    volumeModel: 'prism',
    // Front-to-back (W) is doctrinally LONGER than frontage (L), not the reverse: a narrow
    // frontage keeps the silhouette small toward the enemy, while the extra front-to-back room
    // lets the soldier move/duck back and fit prone — the position is a slot facing the enemy,
    // not a wide box. (The previous L=4/W=2 had this backwards.)
    hole: { L: ft(2.5, 'frontage (illustrative)'), W: ft(4.0, 'front-to-back'), D: ft(4.0, 'armpit-deep') },
    grenadeSumps: 1,
    elbowHoles: 2,
    storageCompartment: false,
    sectorsOfFire: true,
    crewSize: 1,
  },
  two_man: {
    label: 'Two-man fighting position',
    shape: 'rect',
    volumeModel: 'prism',
    hole: { L: ft(7.0, 'frontage'), W: ft(2.0, 'front-to-back'), D: ft(4.0, 'armpit-deep') },
    grenadeSumps: 2,
    elbowHoles: 4,
    storageCompartment: false,
    sectorsOfFire: true,
    crewSize: 2,
  },
  mg_crew: {
    label: 'Machine-gun position (inverted-T)',
    shape: 'inverted_t',
    volumeModel: 'prism',
    hole: { L: ft(8.0, 'trench frontage'), W: ft(2.0, 'trench width'), D: ft(4.0, 'depth') },
    firingPlatform: {
      L: ft(3.0, 'platform length'),
      W: ft(2.0, 'platform width'),
      riseAboveFloor: ft(1.5, 'bay floor below platform'),
    },
    subBay: {
      L: ft(2.4, 'rear crew/ammo trench width across the frontage'),
      W: ft(2.2, 'rear crew/ammo trench run behind the bay'),
      depthFrac: P(0.85, { note: 'stem depth as a fraction of the main bay cut (illustrative)' }),
    },
    grenadeSumps: 2,
    elbowHoles: 0,
    storageCompartment: true,
    sectorsOfFire: true,
    crewSize: 3,
  },
  fifty_cal: {
    label: '.50 cal position (L-shape)',
    shape: 'l_shape',
    volumeModel: 'prism',
    hole: { L: ft(9.0, 'frontage'), W: ft(2.0, 'width'), D: ft(4.0, 'depth') },
    // Platform width matches the trench it stands in. The engine bills this position as a
    // single 9×2×D prism (volumeModel 'prism'), so a 3.0-ft platform inside a 2.0-ft trench
    // described a geometrically impossible position: the drawings clamped it and the bill did
    // not, which is exactly backwards — the picture was right and the spoil figure was wrong.
    firingPlatform: {
      L: ft(4.0, 'platform length'),
      W: ft(2.0, 'platform spans the full trench width (illustrative)'),
      riseAboveFloor: ft(1.0, 'bay floor below platform'),
    },
    subBay: {
      L: ft(5.4, 'side crew/ammo alcove reach past the bay end'),
      W: ft(1.8, 'side crew/ammo alcove width'),
      depthFrac: P(0.85, { note: 'arm depth as a fraction of the main bay cut (illustrative)' }),
    },
    grenadeSumps: 2,
    elbowHoles: 0,
    storageCompartment: true,
    sectorsOfFire: true,
    crewSize: 3,
  },
  mortar_pit: {
    label: 'Mortar pit',
    shape: 'circular',
    volumeModel: 'cylinder',
    hole: { L: ft(8.0, 'pit diameter'), W: ft(8.0, 'pit diameter'), D: ft(4.5, 'pit depth') },
    grenadeSumps: 0,
    elbowHoles: 0,
    storageCompartment: true,
    sectorsOfFire: false,
    crewSize: 3,
  },
  vehicle_hull_defilade: {
    label: 'Vehicle hull-defilade',
    shape: 'vehicle_ramp',
    volumeModel: 'prism_ramp',
    hole: { L: ft(22.0, 'position length'), W: ft(12.0, 'position width'), D: ft(3.5, 'hull-down depth') },
    grenadeSumps: 0,
    elbowHoles: 0,
    storageCompartment: false,
    sectorsOfFire: false,
    crewSize: 4,
  },
  vehicle_turret_defilade: {
    label: 'Vehicle turret-defilade',
    shape: 'vehicle_ramp',
    volumeModel: 'prism_ramp',
    hole: { L: ft(22.0, 'position length'), W: ft(12.0, 'position width'), D: ft(6.0, 'turret-down depth') },
    grenadeSumps: 0,
    elbowHoles: 0,
    storageCompartment: false,
    sectorsOfFire: false,
    crewSize: 4,
  },
  bunker_op_cp: {
    label: 'Bunker / OP-CP',
    shape: 'rect_roofed',
    volumeModel: 'prism',
    hole: { L: ft(10.0, 'interior length'), W: ft(8.0, 'interior width'), D: ft(6.5, 'standing depth') },
    grenadeSumps: 1,
    elbowHoles: 0,
    storageCompartment: true,
    sectorsOfFire: false,
    crewSize: 4,
  },
  // ── Catalog expansion (Phase 6) — defense, not just holes ──────────────────
  connecting_trench: {
    label: 'Connecting / crawl trench',
    shape: 'rect',
    volumeModel: 'prism',
    hole: { L: ft(15.0, 'trench run length'), W: ft(2.5, 'trench width'), D: ft(5.5, 'crawl/fighting depth') },
    grenadeSumps: 1,
    elbowHoles: 0,
    storageCompartment: false,
    sectorsOfFire: false,
    crewSize: 2,
  },
  atgm_javelin: {
    label: 'ATGM / Javelin position',
    shape: 'l_shape',
    volumeModel: 'prism',
    hole: { L: ft(8.0, 'gunner frontage'), W: ft(3.0, 'position depth'), D: ft(4.0, 'defilade depth') },
    // ATGM launchers need a rear backblast area clear of the crew and hard surfaces — modeled
    // as a dedicated clearance validation (engine/validate.ts), not a dug feature.
    firingPlatform: {
      L: ft(4.0, 'launcher platform length'),
      W: ft(3.0, 'launcher platform width'),
      riseAboveFloor: ft(0.5, 'bay floor below platform'),
    },
    subBay: {
      L: ft(4.8, 'side crew/ammo alcove reach past the bay end'),
      W: ft(2.7, 'side crew/ammo alcove width'),
      depthFrac: P(0.85, { note: 'arm depth as a fraction of the main bay cut (illustrative)' }),
    },
    grenadeSumps: 1,
    elbowHoles: 0,
    storageCompartment: true,
    sectorsOfFire: true,
    crewSize: 2,
  },
};

// ── Position features the DRAWINGS build and the rules must own ───────────────
// Every magnitude below was, until this pass, a literal inside a renderer — and in each case
// two renderers held different literals for the same physical feature, so the 2D section and
// the 3D model drew the same object at two sizes. A length a viewer can measure against the
// drawing's own scale bar is a rule, not an art parameter, so it lives here and both views
// read it. All are ILLUSTRATIVE PLACEHOLDERS with no fabricated source.

// The firing-step ledge (the rifle-position ledge, not the crew-served platform above).
// docs/ONE_MAN_POSITION_MODELING_SPEC.md §2.f and §18 are explicit that NO doctrinal
// firing-step height exists — the doctrinal firing platform is at grade, and any numeric
// height is model-derived and must be flagged as such. So these are seeded at what the 3D
// view already drew and carry that fact in their notes; neither gets a citation.
export const firingStep = {
  heightFt: P(0.67, { unit: 'ft', note: 'firing-step ledge height above the bay floor — no published doctrinal figure exists (illustrative, model-derived)' }),
  runFt: P(0.8, { unit: 'ft', note: 'firing-step ledge front-to-back run — no published doctrinal figure exists (illustrative, model-derived)' }),
};

// A mortar pit's wall batter is sized for repeated firing concussion, not soil stability, so it
// applies in every soil and with every revetment — unlike the rectangular family's soil-driven
// taper. The ratio lived in scene3d.ts, which meant the 3D drew a flared pit while both 2D
// views drew it plumb.
export const mortarPit = {
  batterRatio: P(0.25, { note: 'mortar-pit wall batter, run per foot of depth (illustrative)' }),
};

// Getting in and out. The rear entrance passage width also sets the roof's entrance notch on a
// roofed position (the roof must not seal the corridor shut) and the width of the graded way
// down. The stair riser is what makes a deep cut climbable rather than a fall.
export const access = {
  passWidthFt: P(3.0, { unit: 'ft', note: 'rear entrance passage width (illustrative)' }),
  backblastLaneFrac: P(0.85, { note: 'share of the frontage an ATGM position keeps open to the rear for backblast (illustrative)' }),
  stairMaxRiserFt: P(0.83, { unit: 'ft', note: 'maximum rise per earth step on the way down (illustrative)' }),
  stairTreadFt: P(0.5, { unit: 'ft', note: 'earth-step tread run (illustrative)' }),
};

// ATGM backblast clearance — the danger area to the REAR that must be clear of the crew, walls,
// and hard vertical surfaces. Safety-critical illustrative placeholder (backblast injures).
export const backblast = {
  clearanceFt: P(25.0, { unit: 'ft', safetyCritical: true, note: 'rear backblast danger-area clearance (illustrative)' }),
};
