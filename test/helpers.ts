// Shared test fixtures (typed). Not a *.test.ts file, so the runner does not execute it.
import type { Inputs } from '../src/engine/types';

export function defaultInputs(over: Partial<Inputs> = {}): Inputs {
  return {
    schemaVersion: 1,
    positionType: 'two_man',
    standard: 'deliberate',
    soil: 'loam',
    threat: 'fragmentation',
    overheadCover: true,
    revetment: 'none',
    sump: true,
    firingStep: false,
    camouflage: false,
    machineAssist: false,
    count: 1,
    teamSize: 2,
    unit: 'imperial',
    ...over,
  };
}

// A spread of representative fixtures for determinism / fuzz-adjacent coverage.
export const FIXTURES: Inputs[] = [
  defaultInputs(),
  defaultInputs({ positionType: 'one_man', threat: 'small_arms', overheadCover: false, sump: false }),
  defaultInputs({ positionType: 'mg_crew', firingStep: true, camouflage: true, standard: 'reinforced' }),
  defaultInputs({ positionType: 'bunker_op_cp', threat: 'direct_fire_he', standard: 'hasty' }),
  defaultInputs({ positionType: 'fifty_cal', soil: 'sand', revetment: 'sandbag_facing', machineAssist: true }),
  defaultInputs({ positionType: 'mortar_pit', threat: 'shaped_charge', unit: 'metric', count: 6, teamSize: 4 }),
  defaultInputs({ positionType: 'vehicle_hull_defilade', threat: 'none', overheadCover: false, soil: 'rock' }),
];
