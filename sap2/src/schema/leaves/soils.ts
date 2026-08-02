// Soil leaves. v2 regranularization (blueprint §4.2): dig rates are per-soil DIVISORS
// (ft³ per man-hour / per machine-hour) instead of v1's one-rate-times-factor — each
// rate is its own pub cell, entered and cited independently. Wall slope stays a
// per-soil ratio (it also drives excavation volume now — §4.3 batter-aware solids,
// killing v1's vertical-walls volume error). revetForced is a doctrinal flag.
// faceLook stays art-direction structure in the scene package, NOT a leaf.

import { SOIL_IDS, type SoilId } from '../ids';
import { flag, leaf } from './build';
import type { SchemaLeaf } from '../leaf';

const SOIL_LABEL: Record<SoilId, string> = {
  sand: 'sand', sandy_loam: 'sandy loam', loam: 'loam', silt: 'silt',
  clay: 'clay', gravel: 'gravel', rock: 'rock', frozen: 'frozen ground',
};

export const digRateHandId = (s: SoilId): string => `soil.${s}.digRateHand`;
export const digRateMachineId = (s: SoilId): string => `soil.${s}.digRateMachine`;
export const wallSlopeId = (s: SoilId): string => `soil.${s}.wallSlope`;
export const revetForcedId = (s: SoilId): string => `soil.${s}.revetForced`;

export const SOIL_LEAVES: readonly SchemaLeaf[] = SOIL_IDS.flatMap((s) => [
  leaf(digRateHandId(s), {
    name: `Hand dig rate — ${SOIL_LABEL[s]}`,
    plain: `how fast one Marine digs ${SOIL_LABEL[s]}`,
    def: `Bank cubic feet excavated per man-hour by hand tools in ${SOIL_LABEL[s]}, sustained-effort planning rate.`,
    pub: 'Excavation production table (hand tools) of the governing engineer pub',
    batch: 'soils.digRates',
  }, { unit: 'ft3_per_man_hour', kind: 'rate', divisor: true }),
  leaf(digRateMachineId(s), {
    name: `Machine dig rate — ${SOIL_LABEL[s]}`,
    plain: `how fast a machine digs ${SOIL_LABEL[s]}`,
    def: `Bank cubic feet excavated per machine-hour (dozer/excavator class assumed by the pub table) in ${SOIL_LABEL[s]}.`,
    pub: 'Excavation production table (equipment) of the governing engineer pub',
    batch: 'soils.digRates',
  }, { unit: 'ft3_per_machine_hour', kind: 'rate', divisor: true }),
  leaf(wallSlopeId(s), {
    name: `Stable wall slope — ${SOIL_LABEL[s]}`,
    plain: `how much the walls of a ${SOIL_LABEL[s]} hole lean back`,
    def: `Horizontal run per 1 ft of vertical rise for a stable unrevetted cut wall in ${SOIL_LABEL[s]}; 0 means the wall stands vertical. Drives both drawn wall batter and excavation volume.`,
    pub: 'Soil stability / maximum-slope table (engineer pub or OSHA-equivalent cited by it)',
    batch: 'soils.stability',
  }, { unit: 'ratio', kind: 'factor', sign: '>=0', maxDecimals: 2 }),
  flag(revetForcedId(s), {
    name: `Revetment forced — ${SOIL_LABEL[s]}`,
    plain: `must ${SOIL_LABEL[s]} walls be braced no matter what`,
    def: `True when doctrine requires revetment in ${SOIL_LABEL[s]} regardless of the operator's revetment selection.`,
    pub: 'Revetment requirement note in the soils/revetment section of the governing pub',
    batch: 'soils.stability',
  }, true),
]);
