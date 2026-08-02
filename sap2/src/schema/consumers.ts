// Static consumer manifests (blueprint §4.2, major fix): pure data declaring which
// engine/render module consumes which leaves. doctrineReader(consumerId) is
// CONSTRUCTED from this table, so an undeclared reader cannot exist; the G-9 orphan
// test is set-equality between the catalog and the union of these lists — a leaf
// nobody consumes fails the build (v1 grew four orphans; v2 cannot).
//
// The lists are built from the same id generators the catalog uses (loops over id
// vocabularies are still static data — no doctrine value is involved anywhere here).

import { POSITION_IDS, SOIL_IDS, STAGE_ORDER, STANDARD_IDS, THREAT_IDS, SHIELD_MATERIAL_IDS } from './ids';
import {
  BACKBLAST_CLEARANCE_ID, VEHICLE_BERM_HEIGHT_ID, BODY_UNIT_IDS, EXCAVATION_SPLIT_IDS,
  LABOR_ADDER_IDS, MISC_MATERIAL_IDS, POSITION_STRUCTURE, SANDBAG_IDS, SUMP_IDS,
  bodyApproxId, bodyPhraseId, crewSizeId, digRateHandId, digRateMachineId, elbowHolesId,
  holeId, laborBaseId, oneManCheckId, platformId, revetForcedId, shieldLeafId,
  standardMulId, sumpCountId, wallSlopeId,
} from './leaves/index';

export const CONSUMER_IDS = [
  'engine/cover',    // protection resolution (INV-1 fail-safe lives here)
  'engine/solids',   // geometry kernel: hole/platform/sump/berm shapes, wall batter
  'engine/work',     // BOM + labor + stage partition
  'engine/schedule', // crew, stage durations, dig-rate method selection
  'engine/validate', // clearances, forced revetment, basic-load advisory
  'render/cards',    // check + body phrases (build cards, zone E)
] as const;
export type ConsumerId = (typeof CONSUMER_IDS)[number];

const positionDims = POSITION_STRUCTURE.flatMap((p) => [
  holeId(p.id, 'L'), holeId(p.id, 'W'), holeId(p.id, 'D'),
  ...(p.hasFiringPlatform
    ? [platformId(p.id, 'L'), platformId(p.id, 'W'), platformId(p.id, 'depthBelowHole')]
    : []),
]);

export const CONSUMERS: Readonly<Record<ConsumerId, readonly string[]>> = {
  'engine/cover': [
    ...THREAT_IDS.flatMap((t) => SHIELD_MATERIAL_IDS.map((m) => shieldLeafId(t, m))),
    ...THREAT_IDS.map((t) => `standoff.${t}`),
    ...STANDARD_IDS.map((s) => standardMulId(s, 'cover')),
  ],
  'engine/solids': [
    ...positionDims,
    ...SOIL_IDS.map(wallSlopeId),
    ...STANDARD_IDS.map((s) => standardMulId(s, 'depth')),
    SUMP_IDS.L, SUMP_IDS.W, SUMP_IDS.D, SUMP_IDS.rollInSlope,
    ...POSITION_IDS.map(sumpCountId),
    VEHICLE_BERM_HEIGHT_ID,
  ],
  'engine/work': [
    ...POSITION_IDS.map(laborBaseId),
    ...Object.values(LABOR_ADDER_IDS),
    ...Object.values(EXCAVATION_SPLIT_IDS),
    ...STANDARD_IDS.map((s) => standardMulId(s, 'labor')),
    ...POSITION_IDS.map(sumpCountId),
    ...POSITION_IDS.map(elbowHolesId),
    // Dig rates are LABOR's, exclusively (§4.3): labor is the sole consumer of
    // dig-rate/machine leaves; the scheduler consumes labor-by-stage only and cannot
    // see them — the v1 double-count is a set-equality impossibility.
    ...SOIL_IDS.map(digRateHandId),
    ...SOIL_IDS.map(digRateMachineId),
    SANDBAG_IDS.L, SANDBAG_IDS.W, SANDBAG_IDS.H, SANDBAG_IDS.wasteFactor,
    SANDBAG_IDS.frontWallHeight, SANDBAG_IDS.frontWallDepthCount,
    MISC_MATERIAL_IDS.picketSpacing, MISC_MATERIAL_IDS.wirePerPicket,
    MISC_MATERIAL_IDS.camoDrapeFactor, MISC_MATERIAL_IDS.swellFactor,
    SUMP_IDS.gravelFt3,
  ],
  'engine/schedule': [
    ...POSITION_IDS.map(crewSizeId),
  ],
  'engine/validate': [
    BACKBLAST_CLEARANCE_ID,
    ...SOIL_IDS.map(revetForcedId),
    SANDBAG_IDS.basicLoad,
  ],
  'render/cards': [
    ...STAGE_ORDER.map(oneManCheckId),
    ...BODY_UNIT_IDS.map(bodyApproxId),
    ...BODY_UNIT_IDS.map(bodyPhraseId),
  ],
};

/** Leaves only one consumer may read (the machine/labor double-count killer class —
 *  §4.3): dig rates belong to labor alone. */
export const EXCLUSIVE_CONSUMERS: Readonly<Record<string, ConsumerId>> = Object.fromEntries([
  ...SOIL_IDS.map((s) => [digRateHandId(s), 'engine/work'] as const),
  ...SOIL_IDS.map((s) => [digRateMachineId(s), 'engine/work'] as const),
]);
