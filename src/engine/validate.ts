// Validation (§9). Pure — inspects Calc and emits ValidationIssue[] using the stable code
// catalog. Ordering is deterministic (errors, then warnings, then advisories, stable within
// a tier). Every code in codes.ts is reachable from here (asserted by the validate test).

import { CODES, issue } from './codes';
import type { ValidationIssue } from './types';
import type { Calc } from './compute';

const HEAVY_SOILS = new Set(['rock', 'frozen', 'clay']);

export function runValidation(calc: Calc): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const advisories: ValidationIssue[] = [];

  // Invalid inputs (fell back to a default).
  if (calc.invalid.position) errors.push(issue(CODES.INVALID_POSITION));
  if (calc.invalid.soil) errors.push(issue(CODES.INVALID_SOIL));
  if (calc.invalid.standard) errors.push(issue(CODES.INVALID_STANDARD));
  if (calc.invalid.threat) errors.push(issue(CODES.INVALID_THREAT));

  // Soil doctrinally forces revetment but none selected.
  if (calc.soil.revetForced.value === true && calc.revet.kind === 'none') {
    errors.push(issue(CODES.REVET_REQUIRED_SOIL));
  }

  // Engineered roof required.
  if (calc.roofPath === 'engineered_required') {
    warnings.push(issue(CODES.ROOF_ENGINEERED));
    if (calc.inputs.standard === 'hasty') warnings.push(issue(CODES.ROOF_ENGINEERED_HASTY));
  }

  // Hand-digging heavy/hard ground.
  if (!calc.inputs.machineAssist && HEAVY_SOILS.has(calc.inputs.soil)) {
    advisories.push(issue(CODES.EXCAV_HAND_HEAVY));
  }

  // Clamp advisories.
  if (calc.clamped.count) advisories.push(issue(CODES.COUNT_CLAMPED));
  if (calc.clamped.team) advisories.push(issue(CODES.TEAM_CLAMPED));

  return [...errors, ...warnings, ...advisories];
}
