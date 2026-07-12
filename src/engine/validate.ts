// Validation (§9). Pure — inspects Calc and emits ValidationIssue[] using the stable code
// catalog. Ordering is deterministic (errors, then warnings, then advisories, stable within
// a tier). Every code in codes.ts is reachable from here (asserted by the validate test).

import { retainingWall, threats } from '../doctrine/protection';
import { backblast } from '../doctrine/positions';
import { sandbag } from '../doctrine/materials';
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

  // A mortar pit's whole purpose is high-angle fire out the top — a roof over it is a
  // contradiction the app will still draw if asked (never silently refuse a request), but the
  // operator should be told it doesn't make doctrinal sense.
  if (calc.inputs.overheadCover && calc.inputs.positionType === 'mortar_pit') {
    advisories.push(issue(CODES.COVER_MORTAR_INDIRECT));
  }

  // Protection adequacy — "the cover as drawn is thinner than the threat needs." The overhead
  // cover is threat-sized (coverLeaf = the threat's full shielding requirement) then scaled by
  // the standard's coverMul, so a HASTY roof (0.75×) renders THINNER than that requirement.
  // Surface the tradeoff with both numbers. Deliberate (1.0×) meets it and reinforced (1.4×)
  // exceeds it, so this stays silent there; it never fires without a real earth cover
  // (engineered/none leave coverT at 0 and coverLeaf undefined). Compared on the ROUNDED
  // values the panel actually shows, so the warning agrees with the numbers on screen and
  // never fires a sub-tenth-of-a-foot phantom shortfall.
  if (calc.coverLeaf && calc.coverT > 0 && round1(calc.coverT) < round1(calc.coverLeaf.value)) {
    const label = threats[calc.threat]?.label ?? 'this threat';
    advisories.push(
      issue(
        CODES.COVER_UNDER_THREAT,
        '(roof ~' + round1(calc.coverT) + ' ft as drawn; ~' + round1(calc.coverLeaf.value) + ' ft fully stops ' + label + ')',
      ),
    );
  }

  // ATGM/Javelin: the rear backblast danger area must be clear (a safety issue, not a dig).
  if (calc.inputs.positionType === 'atgm_javelin') {
    warnings.push(issue(CODES.ATGM_BACKBLAST, '(' + round1(backblast.clearanceFt.value) + ' ft to the rear)'));
  }

  // Hand-digging heavy/hard ground (vehicle positions get the stronger warning above).
  if (!calc.inputs.machineAssist && HEAVY_SOILS.has(calc.inputs.soil) && !calc.isVehicle) {
    advisories.push(issue(CODES.EXCAV_HAND_HEAVY));
  }

  // Materials availability: a squad carries only a few sandbags per soldier (basicLoad), so a
  // design needing many more implies on-site filling / resupply — a real planning fact. This
  // now essentially never fires for a corrected earth-parapet rifle position (~12 aperture
  // bags < what a crew carries) and correctly fires for a bunker or a sandbagged deliberate
  // position with overhead cover. Advisory, not error: exceeding it is legitimate, you resupply.
  const bagsTotal = calc.bagsParapet + calc.bagsCover + calc.bagsRevet;
  const carriedBags = calc.inputs.count * calc.inputs.teamSize * sandbag.basicLoad.value;
  if (bagsTotal > carriedBags) {
    advisories.push(
      issue(CODES.SANDBAG_BASIC_LOAD_EXCEEDED, '(needs ~' + bagsTotal + ' bags; a crew carries ~' + carriedBags + ')'),
    );
  }

  // Clamp advisories.
  if (calc.clamped.count) advisories.push(issue(CODES.COUNT_CLAMPED));
  if (calc.clamped.team) advisories.push(issue(CODES.TEAM_CLAMPED));

  return [...errors, ...warnings, ...advisories];
}
