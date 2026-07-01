// Labor result assembly (§9). The man-hour arithmetic itself lives in compute.ts (part of
// the single Calc pass); this module packages it into LaborResult and states the
// assumptions the operator should see (soil factor, standard, machine assist, team math).

import type { LaborResult } from './types';
import type { Calc } from './compute';

export function buildLabor(calc: Calc): LaborResult {
  const assumptions: string[] = [];
  assumptions.push('Standard: ' + calc.standard.label + ' (labor ×' + calc.standard.laborMul.value + ').');
  assumptions.push('Soil: ' + calc.soil.label + ' (dig ×' + calc.soil.digFactor.value + ').');
  assumptions.push(
    calc.inputs.machineAssist
      ? 'Machine-assisted excavation applied.'
      : 'Hand excavation assumed (no machine assist).',
  );
  if (calc.coverOn && calc.roofPath === 'earth_on_stringers') assumptions.push('Includes overhead-cover build labor.');
  if (calc.roofPath === 'engineered_required') {
    assumptions.push('Overhead roof is engineered by others — its labor is NOT included.');
  }
  if (calc.revet.buildsFace) assumptions.push('Includes revetment build labor.');
  assumptions.push('Elapsed time = total man-hours ÷ team of ' + calc.teamSize + '.');
  assumptions.push('Man-hour rates are ILLUSTRATIVE placeholders — not authoritative.');

  return {
    manHoursPerPosition: calc.mhPerPos,
    manHoursTotal: calc.mhTotal,
    elapsedHours: calc.elapsed,
    assumptions,
  };
}
