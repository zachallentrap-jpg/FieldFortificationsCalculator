// Validation (§9). Pure — inspects Calc and emits ValidationIssue[] using the stable code
// catalog. Ordering is deterministic (errors, then warnings, then advisories, stable within
// a tier). Every code in codes.ts is reachable from here (asserted by the validate test).

import { retainingWall } from '../doctrine/protection';
import { backblast } from '../doctrine/positions';
import { CODES, issue } from './codes';
import { round1 } from './round';
import type { ValidationIssue } from './types';
import type { Calc } from './compute';

const HEAVY_SOILS = new Set(['rock', 'frozen', 'clay']);
const WET_SOILS = new Set(['silt', 'clay']);

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

  // Engineered roof required — by the threat, or by a span beyond the stringer table
  // (both resolve through the single authority in engine/protection.ts).
  if (calc.roofPath === 'engineered_required') {
    warnings.push(issue(CODES.ROOF_ENGINEERED));
    if (calc.coverReason === 'span') {
      warnings.push(issue(CODES.ROOF_SPAN_EXCEEDED, '(clear span ' + round1(calc.stringerSpan) + ' ft)'));
    }
    if (calc.inputs.standard === 'hasty') warnings.push(issue(CODES.ROOF_ENGINEERED_HASTY));
  }

  // Cut depth beyond the unengineered retaining-wall limit (the doctrine leaf was registered
  // but dead pre-Phase-1 — an 8-ft bunker cut passed silently).
  if (calc.depthOfCut > retainingWall.maxHeight.value) {
    warnings.push(issue(CODES.CUT_DEPTH_SHORING, '(cut ' + round1(calc.depthOfCut) + ' ft, limit ' + round1(retainingWall.maxHeight.value) + ' ft)'));
  }

  // Vehicle positions are machine work.
  if (calc.isVehicle && !calc.inputs.machineAssist) {
    warnings.push(issue(CODES.MACHINE_REQUIRED_VEHICLE));
  }

  // Spoil balance: front protection fill vs what the dig yields.
  if (calc.spoilShortBy > 0) {
    warnings.push(issue(CODES.SPOIL_SHORT, '(about ' + round1(calc.spoilShortBy) + ' ft³ short)'));
  }
  if (calc.spoilExcess > 0) {
    advisories.push(issue(CODES.SPOIL_EXCESS_VEHICLE, '(about ' + round1(calc.spoilExcess) + ' ft³ left over)'));
  }

  // Wet-holding soils need a drainage plan.
  if (WET_SOILS.has(calc.inputs.soil)) {
    advisories.push(issue(CODES.DRAINAGE_WET_SOIL));
  }

  // Overhead cover requested with no threat: the request is silently a no-op in the engine —
  // say so instead of letting the operator believe cover was added.
  if (calc.inputs.overheadCover && calc.threat === 'none') {
    advisories.push(issue(CODES.COVER_NO_THREAT));
  }

  // ATGM/Javelin: the rear backblast danger area must be clear (a safety issue, not a dig).
  if (calc.inputs.positionType === 'atgm_javelin') {
    warnings.push(issue(CODES.ATGM_BACKBLAST, '(' + round1(backblast.clearanceFt.value) + ' ft to the rear)'));
  }

  // Hand-digging heavy/hard ground (vehicle positions get the stronger warning above).
  if (!calc.inputs.machineAssist && HEAVY_SOILS.has(calc.inputs.soil) && !calc.isVehicle) {
    advisories.push(issue(CODES.EXCAV_HAND_HEAVY));
  }

  // Clamp advisories.
  if (calc.clamped.count) advisories.push(issue(CODES.COUNT_CLAMPED));
  if (calc.clamped.team) advisories.push(issue(CODES.TEAM_CLAMPED));

  return [...errors, ...warnings, ...advisories];
}
