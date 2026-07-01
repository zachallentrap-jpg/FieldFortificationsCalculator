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
  hole: { L: Provenance<number>; W: Provenance<number>; D: Provenance<number> }; // feet
  firingPlatform?: FiringPlatform;
  grenadeSumps: number; // count
  elbowHoles: number; // count
  storageCompartment: boolean;
  sectorsOfFire: boolean;
  crewSize: number;
}

const ft = (v: number, note: string): Provenance<number> => P(v, { unit: 'ft', note });

export const positions: Record<string, PositionRow> = {
  one_man: {
    label: 'One-man fighting position',
    shape: 'rect',
    hole: { L: ft(4.0, 'frontage (illustrative)'), W: ft(2.0, 'front-to-back'), D: ft(4.0, 'armpit-deep') },
    grenadeSumps: 1,
    elbowHoles: 2,
    storageCompartment: false,
    sectorsOfFire: true,
    crewSize: 1,
  },
  two_man: {
    label: 'Two-man fighting position',
    shape: 'rect',
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
    hole: { L: ft(10.0, 'interior length'), W: ft(8.0, 'interior width'), D: ft(6.5, 'standing depth') },
    grenadeSumps: 1,
    elbowHoles: 0,
    storageCompartment: true,
    sectorsOfFire: false,
    crewSize: 4,
  },
};
