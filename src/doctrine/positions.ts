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

export interface FiringPlatform {
  L: Provenance<number>;
  W: Provenance<number>;
  depthBelowHole: Provenance<number>; // platform floor is this far below the fighting bay floor
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
      depthBelowHole: ft(1.5, 'platform below bay'),
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
    firingPlatform: {
      L: ft(4.0, 'platform length'),
      W: ft(3.0, 'platform width'),
      depthBelowHole: ft(1.0, 'platform below bay'),
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
      depthBelowHole: ft(0.5, 'platform below bay'),
    },
    grenadeSumps: 1,
    elbowHoles: 0,
    storageCompartment: true,
    sectorsOfFire: true,
    crewSize: 2,
  },
};

// ATGM backblast clearance — the danger area to the REAR that must be clear of the crew, walls,
// and hard vertical surfaces. Safety-critical illustrative placeholder (backblast injures).
export const backblast = {
  clearanceFt: P(25.0, { unit: 'ft', safetyCritical: true, note: 'rear backblast danger-area clearance (illustrative)' }),
};
