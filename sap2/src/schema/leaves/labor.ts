// Labor leaves, regranularized from v1's 7 (blueprint §4.2): per-position base labor,
// per-feature adders, and the excavation-stage split shares. Dig RATES live in
// soils.ts (per-soil, per-method divisors). There is NO machine-factor leaf — v1's
// double-count vector is structurally gone; machine assist means the scheduler divides
// excavation-stage volume by the machine rate instead of the hand rate, in exactly one
// place (§4.3).
//
// Most of these are 'owner-estimate' citation kind (B16): no pub prints a per-position
// base man-hour cell or a stage split — the owner records a method note instead of a
// para/page, and the commissioning manifest discloses it.

import { POSITION_IDS, type PositionId } from '../ids';
import { leaf, share } from './build';
import type { SchemaLeaf } from '../leaf';

export const laborBaseId = (p: PositionId): string => `labor.base.${p}`;
export const LABOR_ADDER_IDS = {
  overhead: 'labor.adder.overhead',
  revet: 'labor.adder.revet',
  sump: 'labor.adder.sump',
  camo: 'labor.adder.camo',
} as const;
export const EXCAVATION_SPLIT_IDS = {
  security: 'labor.split.security',
  hasty: 'labor.split.hasty',
  deliberate: 'labor.split.deliberate',
  parapet: 'labor.split.parapet',
} as const;

export const LABOR_LEAVES: readonly SchemaLeaf[] = [
  ...POSITION_IDS.map((p) =>
    leaf(laborBaseId(p), {
      name: `Base labor — ${p}`,
      plain: 'setup work beyond the digging itself',
      def: `Fixed man-hours for the ${p} position that do not scale with excavated volume: layout, staking, tool handling, breaks structure.`,
      pub: 'No pub prints this cell — owner method note required',
      batch: 'labor.base', estimate: true,
    }, { unit: 'man_hours', kind: 'labor', sign: '>=0' }),
  ),
  leaf(LABOR_ADDER_IDS.overhead, {
    name: 'Overhead-cover build adder', plain: 'extra work to build the roof',
    def: 'Man-hours added when a position builds earth-on-stringers overhead cover, beyond excavation labor.',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.adders', estimate: true,
  }, { unit: 'man_hours', kind: 'labor', sign: '>=0' }),
  leaf(LABOR_ADDER_IDS.revet, {
    name: 'Revetment build adder', plain: 'extra work to brace the walls',
    def: 'Man-hours added when the walls are revetted, beyond excavation labor.',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.adders', estimate: true,
  }, { unit: 'man_hours', kind: 'labor', sign: '>=0' }),
  leaf(LABOR_ADDER_IDS.sump, {
    name: 'Grenade-sump adder', plain: 'extra work per grenade sump',
    def: 'Man-hours added per grenade sump dug.',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.adders', estimate: true,
  }, { unit: 'man_hours', kind: 'labor', sign: '>=0' }),
  leaf(LABOR_ADDER_IDS.camo, {
    name: 'Camouflage adder', plain: 'work to hide the position',
    def: 'Man-hours for initial camouflage emplacement (the continuous-maintenance nature of camo is schedule structure, not this number).',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.adders', estimate: true,
  }, { unit: 'man_hours', kind: 'labor', sign: '>=0' }),
  share(EXCAVATION_SPLIT_IDS.security, {
    name: 'Dig-labor share — security stage', plain: 'slice of digging effort spent staking and posting security',
    def: 'Share (0..1) of total excavation labor apportioned to the security/stake-out stage. The four shares must sum to 1 (relational check, half-ULP tolerance — B18).',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.splits', estimate: true,
  }),
  share(EXCAVATION_SPLIT_IDS.hasty, {
    name: 'Dig-labor share — hasty stage', plain: 'slice of digging effort to reach prone cover',
    def: 'Share (0..1) of total excavation labor to reach hasty/prone depth. The four shares must sum to 1.',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.splits', estimate: true,
  }),
  share(EXCAVATION_SPLIT_IDS.deliberate, {
    name: 'Dig-labor share — full-depth stage', plain: 'slice of digging effort from prone depth to full depth',
    def: 'Share (0..1) of total excavation labor from hasty depth to full fighting depth. The four shares must sum to 1.',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.splits', estimate: true,
  }),
  share(EXCAVATION_SPLIT_IDS.parapet, {
    name: 'Dig-labor share — parapet stage', plain: 'slice of digging effort spent forming the front dirt wall',
    def: 'Share (0..1) of total excavation labor spent placing/forming parapet or berm from spoil. The four shares must sum to 1.',
    pub: 'No pub prints this cell — owner method note required', batch: 'labor.splits', estimate: true,
  }),
];
