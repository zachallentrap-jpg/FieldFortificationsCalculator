// The leaf catalog: every doctrine leaf SAP-2 knows, assembled from the table files.
// The count is an OUTPUT of the schema-integrity test, never a maintained claim
// (blueprint §4.2). Ids are append-only forever; duplicate ids are a build failure.

import type { SchemaLeaf } from '../leaf';
import { PROTECTION_LEAVES } from './protection';
import { SOIL_LEAVES } from './soils';
import { POSITION_LEAVES, POSITION_SAFETY_LEAVES } from './positions';
import { LABOR_LEAVES } from './labor';
import { STANDARD_LEAVES } from './standards';
import { MATERIAL_LEAVES } from './materials';
import { BODY_LEAVES, ONE_MAN_CHECK_LEAVES } from './body';

export const LEAVES: readonly SchemaLeaf[] = [
  ...PROTECTION_LEAVES,
  ...SOIL_LEAVES,
  ...POSITION_LEAVES,
  ...POSITION_SAFETY_LEAVES,
  ...LABOR_LEAVES,
  ...STANDARD_LEAVES,
  ...MATERIAL_LEAVES,
  ...BODY_LEAVES,
  ...ONE_MAN_CHECK_LEAVES,
];

const index = new Map<string, SchemaLeaf>();
for (const l of LEAVES) {
  if (index.has(l.id)) throw new Error(`duplicate leaf id: ${l.id}`);
  index.set(l.id, l);
}

export const LEAF_INDEX: ReadonlyMap<string, SchemaLeaf> = index;

export const leafById = (id: string): SchemaLeaf => {
  const l = index.get(id);
  if (!l) throw new Error(`unknown leaf id: ${id}`);
  return l;
};

export { THREAT_STRUCTURE, shieldLeafId } from './protection';
export { POSITION_STRUCTURE, holeId, platformId, crewSizeId, sumpCountId, elbowHolesId, BACKBLAST_CLEARANCE_ID, VEHICLE_BERM_HEIGHT_ID } from './positions';
export { REVETMENT_STRUCTURE, SANDBAG_IDS, SUMP_IDS, MISC_MATERIAL_IDS } from './materials';
export { digRateHandId, digRateMachineId, wallSlopeId, revetForcedId } from './soils';
export { laborBaseId, LABOR_ADDER_IDS, EXCAVATION_SPLIT_IDS } from './labor';
export { standardMulId } from './standards';
export { BODY_UNIT_IDS, bodyApproxId, bodyPhraseId, oneManCheckId } from './body';
