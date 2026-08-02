// Position leaves + position structure. Structure (shape, volume model, which features
// exist) is qualitative and lives in POSITION_STRUCTURE; every dimension, count, and
// crew size is a leaf. Hole depth is safety-critical (depth IS protection); frontage
// and width are dimensional but non-safety (sign bounds only either way — B14 range
// bounds need a decision entry and none is taken here).

import { type PositionId, type ShapeId } from '../ids';
import { leaf, safetyFt } from './build';
import type { SchemaLeaf } from '../leaf';

export interface PositionStructure {
  readonly id: PositionId;
  readonly label: string;
  readonly shape: ShapeId;
  readonly volumeModel: 'prism' | 'cylinder' | 'prism_ramp';
  readonly hasFiringPlatform: boolean;
  readonly storageCompartment: boolean;
  readonly sectorsOfFire: boolean;
}

export const POSITION_STRUCTURE: readonly PositionStructure[] = [
  { id: 'one_man', label: 'One-man fighting position', shape: 'rect', volumeModel: 'prism', hasFiringPlatform: false, storageCompartment: false, sectorsOfFire: true },
  { id: 'two_man', label: 'Two-man fighting position', shape: 'rect', volumeModel: 'prism', hasFiringPlatform: false, storageCompartment: false, sectorsOfFire: true },
  { id: 'mg_crew', label: 'Machine-gun position (inverted-T)', shape: 'inverted_t', volumeModel: 'prism', hasFiringPlatform: true, storageCompartment: true, sectorsOfFire: true },
  { id: 'fifty_cal', label: '.50 cal position (L-shape)', shape: 'l_shape', volumeModel: 'prism', hasFiringPlatform: true, storageCompartment: true, sectorsOfFire: true },
  { id: 'mortar_pit', label: 'Mortar pit', shape: 'circular', volumeModel: 'cylinder', hasFiringPlatform: false, storageCompartment: true, sectorsOfFire: false },
  { id: 'atgm_javelin', label: 'ATGM / Javelin position', shape: 'l_shape', volumeModel: 'prism', hasFiringPlatform: true, storageCompartment: true, sectorsOfFire: true },
  { id: 'connecting_trench', label: 'Connecting / crawl trench', shape: 'rect', volumeModel: 'prism', hasFiringPlatform: false, storageCompartment: false, sectorsOfFire: false },
  { id: 'bunker_op_cp', label: 'Bunker / OP-CP', shape: 'rect_roofed', volumeModel: 'prism', hasFiringPlatform: false, storageCompartment: true, sectorsOfFire: false },
  { id: 'vehicle_hull_defilade', label: 'Vehicle hull-defilade', shape: 'vehicle_ramp', volumeModel: 'prism_ramp', hasFiringPlatform: false, storageCompartment: false, sectorsOfFire: false },
  { id: 'vehicle_turret_defilade', label: 'Vehicle turret-defilade', shape: 'vehicle_ramp', volumeModel: 'prism_ramp', hasFiringPlatform: false, storageCompartment: false, sectorsOfFire: false },
];

export const holeId = (p: PositionId, d: 'L' | 'W' | 'D'): string => `pos.${p}.hole.${d}`;
export const platformId = (p: PositionId, d: 'L' | 'W' | 'depthBelowHole'): string => `pos.${p}.platform.${d}`;
export const crewSizeId = (p: PositionId): string => `pos.${p}.crewSize`;
export const sumpCountId = (p: PositionId): string => `pos.${p}.grenadeSumps`;
export const elbowHolesId = (p: PositionId): string => `pos.${p}.elbowHoles`;

const label = (p: PositionId): string => {
  const row = POSITION_STRUCTURE.find((r) => r.id === p);
  if (!row) throw new Error(`position structure missing ${p}`);
  return row.label;
};

// Dimension-sense conventions ride in the definition text (the one_man frontage-vs-
// front-to-back lesson from v1 is meaning, so it lives in `definition` and is hashed
// via meaningVersion).
const DIM_SENSE: Record<'L' | 'W' | 'D', (p: PositionId) => string> = {
  L: (p) => `Frontage of the ${label(p)} — the edge that faces the enemy, measured along the front wall at grade.`,
  W: (p) => `Front-to-back extent of the ${label(p)}, measured perpendicular to the frontage at grade (for circular pits this equals the diameter).`,
  D: (p) => `Vertical depth from grade to the fighting/working floor of the ${label(p)}, measured on the enemy-side wall before any parapet is added.`,
};

export const POSITION_LEAVES: readonly SchemaLeaf[] = POSITION_STRUCTURE.flatMap((row) => {
  const p = row.id;
  const dims: SchemaLeaf[] = [
    leaf(holeId(p, 'L'), {
      name: `Hole frontage — ${row.label}`, plain: 'how wide the hole is toward the enemy',
      def: DIM_SENSE.L(p), pub: `Dimensions figure for the ${row.label} in the governing pub`,
      batch: `positions.${p}`,
    }, { unit: 'ft', kind: 'dimension' }),
    leaf(holeId(p, 'W'), {
      name: `Hole front-to-back — ${row.label}`, plain: 'how far back the hole runs',
      def: DIM_SENSE.W(p), pub: `Dimensions figure for the ${row.label} in the governing pub`,
      batch: `positions.${p}`,
    }, { unit: 'ft', kind: 'dimension' }),
    safetyFt(holeId(p, 'D'), {
      name: `Hole depth — ${row.label}`, plain: 'how deep you dig',
      def: DIM_SENSE.D(p), pub: `Dimensions figure for the ${row.label} in the governing pub`,
      batch: `positions.${p}`,
    }),
    leaf(crewSizeId(p), {
      name: `Crew — ${row.label}`, plain: 'how many Marines fight from it',
      def: `Doctrinal occupying crew of the ${row.label}; also the default labor divisor for its build schedule.`,
      pub: `Crew/occupancy statement for the ${row.label}`, batch: `positions.${p}`,
    }, { unit: 'ea', kind: 'count', integer: true, divisor: true }),
    leaf(sumpCountId(p), {
      name: `Grenade sumps — ${row.label}`, plain: 'how many grenade sumps to dig',
      def: `Number of grenade sumps doctrine specifies for the ${row.label}. Zero is a valid doctrinal value.`,
      pub: `Sump callout in the ${row.label} figure`, batch: `positions.${p}`,
    }, { unit: 'ea', kind: 'count', integer: true, sign: '>=0' }),
    leaf(elbowHolesId(p), {
      name: `Elbow holes — ${row.label}`, plain: 'how many elbow rests to cut',
      def: `Number of elbow holes/arm rests cut at the firing line of the ${row.label}. Zero is a valid doctrinal value.`,
      pub: `Elbow-hole callout in the ${row.label} figure`, batch: `positions.${p}`,
    }, { unit: 'ea', kind: 'count', integer: true, sign: '>=0' }),
  ];
  const platform: SchemaLeaf[] = row.hasFiringPlatform
    ? [
        leaf(platformId(p, 'L'), {
          name: `Firing platform length — ${row.label}`, plain: 'how long the gun step is',
          def: `Length of the raised firing platform of the ${row.label}, along the frontage.`,
          pub: `Platform dimensions in the ${row.label} figure`, batch: `positions.${p}`,
        }, { unit: 'ft', kind: 'dimension' }),
        leaf(platformId(p, 'W'), {
          name: `Firing platform width — ${row.label}`, plain: 'how deep the gun step is',
          def: `Front-to-back width of the raised firing platform of the ${row.label}.`,
          pub: `Platform dimensions in the ${row.label} figure`, batch: `positions.${p}`,
        }, { unit: 'ft', kind: 'dimension' }),
        leaf(platformId(p, 'depthBelowHole'), {
          name: `Platform drop below bay — ${row.label}`, plain: 'how far the step sits below the floor you stand on',
          def: `Vertical distance the platform surface sits BELOW the fighting-bay floor of the ${row.label} (the platform is a shallower dig, not a built-up box — v1 inverted this; the sense is fixed here as meaning).`,
          pub: `Platform/section view in the ${row.label} figure`, batch: `positions.${p}`,
        }, { unit: 'ft', kind: 'dimension', sign: '>=0' }),
      ]
    : [];
  return [...dims, ...platform];
});

// Cross-position safety leaves.
export const BACKBLAST_CLEARANCE_ID = 'atgm.backblast.clearance';
export const VEHICLE_BERM_HEIGHT_ID = 'vehicle.berm.H';

export const POSITION_SAFETY_LEAVES: readonly SchemaLeaf[] = [
  safetyFt(BACKBLAST_CLEARANCE_ID, {
    name: 'ATGM backblast rear clearance',
    plain: 'how much clear space the launcher needs behind it',
    def: 'Rear danger-area clearance behind an ATGM/Javelin launcher that must be free of crew, walls, and hard vertical surfaces at firing.',
    pub: 'Backblast danger-zone figure of the weapon TM / governing pub',
    batch: 'positions.atgm_javelin',
  }),
  safetyFt(VEHICLE_BERM_HEIGHT_ID, {
    name: 'Vehicle position berm height',
    plain: 'how tall the dirt wall in front of the vehicle is',
    def: 'Height of the frontal spoil berm at a vehicle defilade position, measured from grade to crest. The scene, BOM, and card title all derive from this one leaf (B41).',
    pub: 'Vehicle fighting position figure of the governing pub',
    batch: 'positions.vehicle',
  }),
];
