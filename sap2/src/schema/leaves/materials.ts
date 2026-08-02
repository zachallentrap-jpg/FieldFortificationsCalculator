// Materials leaves: sandbag geometry, revetment systems, camouflage, grenade sump,
// excavation swell. Revetment KINDS (bag/picket/panel, buildsFace) are structure;
// their quantitative cells are leaves. v1's plywood-sheet card conversion is dead
// (B40) — sheet counts require an owner-entered per-sheet-area leaf before any card
// may print them; none exists yet, so no card can.

import { type RevetmentId } from '../ids';
import { leaf, share } from './build';
import type { SchemaLeaf } from '../leaf';

export interface RevetmentStructure {
  readonly id: RevetmentId;
  readonly label: string;
  readonly kind: 'none' | 'bag' | 'picket' | 'panel';
  readonly buildsFace: boolean;
}

export const REVETMENT_STRUCTURE: readonly RevetmentStructure[] = [
  { id: 'none', label: 'None', kind: 'none', buildsFace: false },
  { id: 'sandbag_facing', label: 'Sandbag facing', kind: 'bag', buildsFace: true },
  { id: 'pickets_wire', label: 'Pickets & wire', kind: 'picket', buildsFace: true },
  { id: 'corrugated_metal', label: 'Corrugated metal', kind: 'panel', buildsFace: true },
  { id: 'timber_plywood', label: 'Timber & plywood', kind: 'panel', buildsFace: true },
];

export const SANDBAG_IDS = {
  L: 'sandbag.L', W: 'sandbag.W', H: 'sandbag.H',
  wasteFactor: 'sandbag.wasteFactor',
  frontWallHeight: 'sandbag.frontWallHeight',
  frontWallDepthCount: 'sandbag.frontWallDepthCount',
  basicLoad: 'sandbag.basicLoad',
} as const;

export const SUMP_IDS = {
  L: 'sump.L', W: 'sump.W', D: 'sump.D',
  gravelFt3: 'sump.gravelFt3', rollInSlope: 'sump.rollInSlope',
} as const;

export const MISC_MATERIAL_IDS = {
  picketSpacing: 'revet.pickets_wire.spacing',
  wirePerPicket: 'revet.pickets_wire.wirePerPicket',
  camoDrapeFactor: 'camo.drapeFactor',
  swellFactor: 'excavation.swellFactor',
} as const;

export const MATERIAL_LEAVES: readonly SchemaLeaf[] = [
  leaf(SANDBAG_IDS.L, {
    name: 'Filled sandbag length', plain: 'how long a filled bag lies',
    def: 'Length of a properly filled sandbag as laid, per the pub filling standard.',
    pub: 'Sandbag dimensions/filling standard of the governing pub', batch: 'materials.sandbag',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(SANDBAG_IDS.W, {
    name: 'Filled sandbag width', plain: 'how wide a filled bag lies',
    def: 'Width of a properly filled sandbag as laid.',
    pub: 'Sandbag dimensions/filling standard of the governing pub', batch: 'materials.sandbag',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(SANDBAG_IDS.H, {
    name: 'Filled sandbag course height', plain: 'how tall one course of bags stands',
    def: 'Height (thickness) of one course of properly filled sandbags.',
    pub: 'Sandbag dimensions/filling standard of the governing pub', batch: 'materials.sandbag',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(SANDBAG_IDS.wasteFactor, {
    name: 'Sandbag waste factor', plain: 'extra bags for the ones that burst or misfill',
    def: 'Multiplier (>1) applied to computed sandbag counts to cover burst, misfilled, and handling-lost bags.',
    pub: 'No pub prints this cell — owner method note required', batch: 'materials.sandbag', estimate: true,
  }, { unit: 'ratio', kind: 'factor', sign: '>0' }),
  leaf(SANDBAG_IDS.frontWallHeight, {
    name: 'Front retaining-wall course height', plain: 'how tall the firing-rest bag course is',
    def: 'Height of the front firing-rest sandbag course at the parapet (the only concentrated sandbag element on an earth parapet).',
    pub: 'Front retaining wall spec in the fighting-position section (e.g. ATP 3-21.8 §5-238 class)', batch: 'materials.sandbag',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(SANDBAG_IDS.frontWallDepthCount, {
    name: 'Front retaining-wall bags in depth', plain: 'how many bags thick the firing-rest course is',
    def: 'Number of filled sandbags laid front-to-back (in depth) in the front retaining-wall course at the parapet.',
    pub: 'Front retaining wall spec in the fighting-position section', batch: 'materials.sandbag',
  }, { unit: 'ea', kind: 'count', integer: true }),
  leaf(SANDBAG_IDS.basicLoad, {
    name: 'Sandbag basic load', plain: 'bags each Marine carries in',
    def: 'Sandbags a soldier carries as a starting set; designs needing far more imply on-site fill/resupply (validation input, not a limit).',
    pub: 'Basic-load note in the fighting-position section', batch: 'materials.sandbag',
  }, { unit: 'ea', kind: 'count', integer: true }),
  leaf(MISC_MATERIAL_IDS.picketSpacing, {
    name: 'Picket spacing — pickets & wire revetment', plain: 'how far apart the stakes go',
    def: 'Horizontal spacing between U-pickets along a revetted face.',
    pub: 'Revetment construction figure of the governing pub', batch: 'materials.revetment',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(MISC_MATERIAL_IDS.wirePerPicket, {
    name: 'Tie wire per picket', plain: 'wire needed at each stake',
    def: 'Feet of tie wire consumed per picket in a pickets-and-wire revetment.',
    pub: 'Revetment construction figure of the governing pub', batch: 'materials.revetment',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(MISC_MATERIAL_IDS.camoDrapeFactor, {
    name: 'Camouflage net drape factor', plain: 'how much bigger the net is than the hole it hides',
    def: 'Multiplier (>1) of net area over plan footprint to allow natural drape and stand-off.',
    pub: 'No pub prints this cell — owner method note required', batch: 'materials.camo', estimate: true,
  }, { unit: 'ratio', kind: 'factor', sign: '>0' }),
  leaf(MISC_MATERIAL_IDS.swellFactor, {
    name: 'Excavation swell factor', plain: 'how much dirt grows when you dig it up',
    def: 'Bank-to-loose volume multiplier (>1) applied when excavated soil becomes spoil.',
    pub: 'Soil swell table of the governing engineer pub (or owner method note)', batch: 'materials.excavation', estimate: true,
  }, { unit: 'ratio', kind: 'factor', sign: '>0' }),
  leaf(SUMP_IDS.L, {
    name: 'Grenade sump length', plain: 'how long the sump slot is',
    def: 'Length of a grenade sump at the floor.',
    pub: 'Grenade sump figure of the governing pub', batch: 'materials.sump',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(SUMP_IDS.W, {
    name: 'Grenade sump width', plain: 'how wide the sump slot is',
    def: 'Width of a grenade sump at the floor.',
    pub: 'Grenade sump figure of the governing pub', batch: 'materials.sump',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(SUMP_IDS.D, {
    name: 'Grenade sump depth', plain: 'how deep the sump goes',
    def: 'Depth of a grenade sump below the position floor.',
    pub: 'Grenade sump figure of the governing pub', batch: 'materials.sump',
  }, { unit: 'ft', kind: 'dimension' }),
  leaf(SUMP_IDS.gravelFt3, {
    name: 'Gravel per sump', plain: 'gravel to drop in each sump',
    def: 'Cubic feet of gravel per grenade sump for drainage.',
    pub: 'Sump/drainage note of the governing pub', batch: 'materials.sump',
  }, { unit: 'ft3', kind: 'volume', sign: '>=0' }),
  share(SUMP_IDS.rollInSlope, {
    name: 'Floor roll-in slope toward sump', plain: 'how much the floor tilts toward the sump',
    def: 'Slope (rise per run, 0..1) of the position floor toward the grenade sump so a grenade rolls in.',
    pub: 'Sump figure/section of the governing pub', batch: 'materials.sump',
  }),
];
