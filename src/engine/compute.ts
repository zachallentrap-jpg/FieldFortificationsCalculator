// The deterministic engine core (§2.2, §9). compute(inputs) is PURE — no randomness, no
// clock, no network, no I/O. It normalizes inputs, resolves doctrine, runs the exact §9
// formula chain into a single intermediate `Calc`, then hands `Calc` to the pure
// geometry / BOM / labor / validation / derivation builders. Identical inputs produce a
// byte-identical Result (asserted by the determinism test).

import '../doctrine/index'; // side-effect: registers every Provenance leaf + freezes structure
import { positions, vehicleRamp } from '../doctrine/positions';
import { soils } from '../doctrine/soils';
import { standards } from '../doctrine/standards';
import { sandbag, revetments, camo, sump, excavation, machine } from '../doctrine/materials';
import { parapet, berm, overhead, threats, standoffMinFor, standoffLeafFor, stringerSizeForSpan, radiationHalving } from '../doctrine/protection';
import type { ShieldMaterial } from '../doctrine/protection';
import { counts } from '../doctrine/registry';
import type { PositionRow } from '../doctrine/positions';
import type { SoilRow } from '../doctrine/soils';
import type { StandardRow } from '../doctrine/standards';
import type { RevetRow } from '../doctrine/materials';
import type { Provenance } from '../doctrine/types';

import { ceilInt, round1, clamp, finite } from './round';
import { resolveCover } from './protection';
import { buildGeometry } from './geometry';
import { buildBom } from './materials';
import { buildLabor } from './labor';
import { runValidation } from './validate';
import { buildDerivations } from './explain';
import type { Inputs, Result, RoofPath } from './types';

const FALLBACK_POSITION = 'one_man';
const FALLBACK_SOIL = 'loam';
const FALLBACK_STANDARD: Inputs['standard'] = 'deliberate';

// Full intermediate. Every named quantity from the §9 chain plus the resolved doctrine
// rows (so downstream builders can read each Provenance's value/status/source without
// recomputing). Internal to the engine.
export interface Calc {
  inputs: Inputs; // normalized (count/team clamped)
  position: PositionRow;
  soil: SoilRow;
  standard: StandardRow;
  revet: RevetRow;
  threat: string; // 'none' or a known threat
  count: number;
  teamSize: number;

  invalid: { position: boolean; soil: boolean; threat: boolean; standard: boolean };
  clamped: { count: boolean; team: boolean };

  // shape family (from the position's volumeModel)
  isVehicle: boolean; // prism_ramp — berm frontal protection, ramp cut, machine-scale work
  isCircular: boolean; // cylinder — π/4 volume + circumference perimeter

  // geometry scalars (feet)
  holeL: number;
  holeW: number;
  holeD: number;
  depthOfCut: number;
  setback: number;
  standoffMin: number;
  standoffLeaf: Provenance<number> | undefined;
  parapetW: number; // frontal protection thickness — sandbag parapet, or spoil BERM for vehicles
  parapetH: number;
  outerL: number;
  outerW: number;
  parapetRing: number; // frontal-protection ring volume (parapet or berm)
  rampVol: number; // access-ramp wedge volume (vehicle positions only)

  // cover
  coverOn: boolean;
  roofPath: RoofPath;
  coverReason: 'threat' | 'span' | undefined; // why engineered_required, when it is
  coverT: number;
  coverMaterial: string;
  coverLeaf: Provenance<number> | undefined;
  coverL: number;
  coverW: number;
  coverVol: number;
  stringers: number;
  stringerSpan: number; // clear span the stringers bridge (the SHORT axis)
  stringerSize: string; // doctrine size label for that span ('' when no earth roof)
  radHalvingLeaf: Provenance<number> | undefined; // fallout halving-thickness for the cover material
  radHalvingLayers: number; // how many halving-thicknesses the earth cover provides (fallout)

  // volumes
  holeVol: number;
  hasPlatform: boolean;
  platformVol: number;
  firingStepOn: boolean;
  sumpOn: boolean;
  sumpCount: number;
  sumpVol: number;
  gravelVol: number;
  excavBank: number;
  excavLoose: number;

  // materials
  bagVol: number;
  waste: number;
  bagsParapet: number; // 0 for vehicle positions (berm, not bags)
  bermFill: number; // ft³ of dozed spoil in the berm (vehicle positions only)
  bagsCover: number; // 0 unless the cover material is sandbagged_soil
  coverFill: number; // ft³ of plain fill when the cover material is loose soil, not bags
  bagsRevet: number;
  perimeter: number;
  faceArea: number;
  pickets: number;
  wireFt: number; // tie wire for picket revetment (ft)
  camoArea: number;

  // spoil balance
  spoilShortBy: number; // ft³ the frontal-protection fill exceeds the loose spoil by (0 = enough)
  spoilExcess: number; // ft³ of loose spoil left over after the berm (vehicle positions)

  // labor
  mhPerPos: number;
  mhTotal: number;
  elapsed: number;
  machineHrsPerPos: number; // blade/excavator hours when machine assist is on
  machineHrsTotal: number;
}

function computeCalc(raw: Inputs): Calc {
  // ── Normalize / resolve doctrine ─────────────────────────────────────────────
  const posRow = positions[raw.positionType];
  const invalidPosition = posRow === undefined;
  const position = posRow ?? positions[FALLBACK_POSITION]!;

  const soilRow = soils[raw.soil];
  const invalidSoil = soilRow === undefined;
  const soil = soilRow ?? soils[FALLBACK_SOIL]!;

  const stdRow = standards[raw.standard];
  const invalidStandard = stdRow === undefined;
  const standard = stdRow ?? standards[FALLBACK_STANDARD]!;

  const threatKnown = raw.threat === 'none' || raw.threat in threats;
  const invalidThreat = !threatKnown;
  const threat = threatKnown ? raw.threat : 'none';

  const revet = revetments[raw.revetment] ?? revetments['none']!;

  const roundedCount = Math.round(finite(raw.count, 1));
  const roundedTeam = Math.round(finite(raw.teamSize, 1));
  const count = clamp(roundedCount, 1, 999);
  const teamSize = clamp(roundedTeam, 1, 50);
  // Advisory fires only on genuine out-of-range clamping, never on mere fractional
  // rounding: compare the clamp result against the rounded value, not the raw input.
  const clampedCount = count !== roundedCount;
  const clampedTeam = teamSize !== roundedTeam;

  const inputs: Inputs = { ...raw, count, teamSize };

  // ── §9 chain ─────────────────────────────────────────────────────────────────
  const isVehicle = position.volumeModel === 'prism_ramp';
  const isCircular = position.volumeModel === 'cylinder';
  // A circular pit's plan area is π/4 of its bounding square (L = W = diameter). The old
  // square-for-circle model overestimated a mortar pit's dig by ~27% — falsifiable by any
  // mortar section leader (EXECUTION_PLAN Phase 1).
  const circleFactor = isCircular ? Math.PI / 4 : 1;

  const holeL = position.hole.L.value;
  const holeW = position.hole.W.value;
  const holeD = position.hole.D.value;

  const depthOfCut = holeD * standard.depthMul.value;

  // Setback/standoff scales with the specific munition (bigger round → more standoff);
  // 'none'/unknown falls back to the global minimum.
  const setbackDepthFrac = overhead.setbackDepthFrac.value;
  const standoffMin = standoffMinFor(threat);
  const standoffLeaf = standoffLeafFor(threat);
  const setback = Math.max(standoffMin, setbackDepthFrac * depthOfCut);

  // Stringers span the SHORT axis (smallest clear span → smallest timber); they are laid out
  // along the LONG axis at doctrine spacing. The pre-Phase-1 count keyed on the short axis —
  // which implied stringers spanning the frontage, teaching wrong assembly.
  const clearSpan = Math.min(holeL, holeW);

  const coverOn = inputs.overheadCover && threat !== 'none';
  const cover = resolveCover(threat, coverOn, standard.coverMul.value, clearSpan);
  const roofPath = cover.roofPath;
  const coverT = cover.thickness; // 0 unless earth_on_stringers (§2.7)
  const coverMaterial = cover.material;

  // Frontal protection: sandbag parapet — or, for vehicle defilade, a dozed spoil BERM
  // (nobody fills ~450 sandbags around a hull-down; the berm is the position's own spoil).
  const parapetW = isVehicle ? berm.W.value : parapet.W.value;
  const parapetH = isVehicle ? berm.H.value : parapet.H.value;
  const outerL = holeL + 2 * parapetW;
  const outerW = holeW + 2 * parapetW;
  const parapetRing = (outerL * outerW - holeL * holeW) * parapetH * circleFactor;

  const holeVol = holeL * holeW * depthOfCut * circleFactor;

  // Access ramp (vehicle positions): a wedge as long as slopeRatio × depth, as wide as the
  // vehicle side of the cut — the DOMINANT excavation volume of a defilade.
  const rampVol = isVehicle ? 0.5 * vehicleRamp.slopeRatio.value * depthOfCut * depthOfCut * clearSpan : 0;
  // §9 literal: platformVol keys purely on whether the POSITION has a firing platform
  // (a structural feature of crew-served positions), NOT on the firingStep input toggle.
  const hasPlatform = position.firingPlatform !== undefined;
  const platformVol = position.firingPlatform
    ? position.firingPlatform.L.value * position.firingPlatform.W.value * position.firingPlatform.depthBelowHole.value
    : 0;
  // The firingStep input drives the section-drawing firing-step ledge (§10) — a minor cut
  // §9 folds into holeVol. It adds no fabricated volume or labor of its own. A one-man position
  // is dug armpit-deep for standing fire and takes NO firing step (modeling spec §2.f), so the
  // toggle is a no-op there — the drawing must never teach a step the doctrine forbids.
  const firingStepOn = inputs.firingStep && raw.positionType !== 'one_man';

  const sumpOn = inputs.sump;
  const sumpCount = sumpOn ? position.grenadeSumps : 0;
  const oneSumpVol = sump.L.value * sump.W.value * sump.D.value;
  const sumpVol = sumpCount * oneSumpVol;
  const gravelVol = sumpCount * sump.gravelFt3.value;

  const excavBank = holeVol + platformVol + sumpVol + rampVol;
  const excavLoose = excavBank * excavation.swellFactor.value;

  const bearingEachEnd = overhead.bearingEachEnd.value;
  const coverL = holeL + 2 * bearingEachEnd;
  const coverW = holeW + 2 * bearingEachEnd;
  const buildsEarthRoof = coverOn && roofPath === 'earth_on_stringers';
  const coverVol = buildsEarthRoof ? coverL * coverW * coverT : 0;
  const spacing = overhead.stringerSpacing.value;
  const stringers = buildsEarthRoof ? ceilInt(Math.max(holeL, holeW) / spacing) + 1 : 0;
  const stringerSize = buildsEarthRoof ? stringerSizeForSpan(clearSpan) : '';

  // Fallout attenuation the earth roof happens to provide, expressed in halving-thicknesses
  // (each layer roughly halves the dose). Consumes the radiationHalving doctrine leaf so those
  // safety-critical values earn their place in the banner instead of sitting dead (Phase 6).
  const radHalvingLeaf = buildsEarthRoof && (coverMaterial in radiationHalving)
    ? radiationHalving[coverMaterial as ShieldMaterial]
    : undefined;
  const radHalvingLayers = radHalvingLeaf && radHalvingLeaf.value > 0 ? coverT / radHalvingLeaf.value : 0;

  const bagVol = sandbag.L.value * sandbag.W.value * sandbag.H.value;
  const waste = sandbag.wasteFactor.value;
  const bagsParapet = isVehicle ? 0 : ceilInt((parapetRing / bagVol) * waste);
  const bermFill = isVehicle ? parapetRing : 0;
  // Cover priced as what it IS: bags only when the doctrine material is sandbagged soil;
  // loose-soil cover is a fill volume, not a phantom bag count.
  const coverSandbagged = coverMaterial === 'sandbagged_soil';
  const bagsCover = coverSandbagged ? ceilInt((coverVol / bagVol) * waste) : 0;
  const coverFill = buildsEarthRoof && !coverSandbagged ? coverVol : 0;

  const perimeter = isCircular ? Math.PI * holeL : 2 * (holeL + holeW);
  const faceArea = revet.buildsFace ? perimeter * depthOfCut : 0;
  const bagsRevet = revet.kind === 'bag' ? ceilInt((faceArea * sandbag.W.value / bagVol) * waste) : 0;
  const picketSpacing = revet.spacing?.value ?? spacing;
  const pickets = revet.kind === 'picket' ? ceilInt(perimeter / picketSpacing) : 0;
  const wireFt = revet.kind === 'picket' && revet.wirePerPicket ? pickets * revet.wirePerPicket.value : 0;
  const camoArea = inputs.camouflage ? ceilInt(outerL * outerW * camo.drapeFactor.value) : 0;

  // ── spoil balance ────────────────────────────────────────────────────────────
  // The frontal protection is filled from the position's own spoil (bags are filled on site;
  // the berm IS dozed spoil). If the dig doesn't yield enough loose material, fill must be
  // hauled in — a real planning fact the old model silently ignored.
  const fillDemand = isVehicle ? bermFill : parapetRing;
  const spoilShortBy = Math.max(0, fillDemand - excavLoose);
  const spoilExcess = isVehicle ? Math.max(0, excavLoose - bermFill) : 0;

  // ── labor ────────────────────────────────────────────────────────────────────
  const machineFactor = inputs.machineAssist ? machine.excavationFactor.value : 1;
  const mh =
    baseLabor.baseMH * soil.digFactor.value * standard.laborMul.value +
    excavBank * baseLabor.perVolMH * machineFactor +
    (buildsEarthRoof ? baseLabor.overheadAdd : 0) +
    (revet.buildsFace ? baseLabor.revetAdd : 0) +
    (sumpCount > 0 ? baseLabor.sumpAdd : 0) +
    (inputs.camouflage ? baseLabor.camoAdd : 0);
  const mhPerPos = round1(mh);
  const mhTotal = round1(mhPerPos * count);
  const elapsed = round1(mhTotal / teamSize);
  // Machine time is reported in BLADE-HOURS, its own axis — a dozer hour is not a man-hour.
  const machineHrsPerPos = inputs.machineAssist ? round1(excavBank * baseLabor.machinePerVolMH) : 0;
  const machineHrsTotal = round1(machineHrsPerPos * count);

  return {
    inputs,
    position,
    soil,
    standard,
    revet,
    threat,
    count,
    teamSize,
    invalid: { position: invalidPosition, soil: invalidSoil, threat: invalidThreat, standard: invalidStandard },
    clamped: { count: clampedCount, team: clampedTeam },
    isVehicle,
    isCircular,
    holeL,
    holeW,
    holeD,
    depthOfCut,
    setback,
    standoffMin,
    standoffLeaf,
    parapetW,
    parapetH,
    outerL,
    outerW,
    parapetRing,
    rampVol,
    coverOn,
    roofPath,
    coverReason: cover.engineeredReason,
    coverT,
    coverMaterial,
    coverLeaf: cover.thicknessLeaf,
    coverL,
    coverW,
    coverVol,
    stringers,
    stringerSpan: clearSpan,
    stringerSize,
    radHalvingLeaf,
    radHalvingLayers,
    holeVol,
    hasPlatform,
    platformVol,
    firingStepOn,
    sumpOn,
    sumpCount,
    sumpVol,
    gravelVol,
    excavBank,
    excavLoose,
    bagVol,
    waste,
    bagsParapet,
    bermFill,
    bagsCover,
    coverFill,
    bagsRevet,
    perimeter,
    faceArea,
    pickets,
    wireFt,
    camoArea,
    spoilShortBy,
    spoilExcess,
    mhPerPos,
    mhTotal,
    elapsed,
    machineHrsPerPos,
    machineHrsTotal,
  };
}

// Labor doctrine values pulled once (kept out of the chain body for readability). Not a
// bare literal — all values come from doctrine/labor.
import { labor as laborDoctrine } from '../doctrine/labor';
const baseLabor = {
  baseMH: laborDoctrine.baseMH.value,
  perVolMH: laborDoctrine.perVolMH.value,
  machinePerVolMH: laborDoctrine.machinePerVolMH.value,
  overheadAdd: laborDoctrine.overheadAdd.value,
  revetAdd: laborDoctrine.revetAdd.value,
  sumpAdd: laborDoctrine.sumpAdd.value,
  camoAdd: laborDoctrine.camoAdd.value,
};

// Model-fidelity statements (EXECUTION_PLAN Phase 1): formulas get the same honesty
// treatment as constants. Every position's volume model is an approximation and says so —
// the structural analogue of the (PH) flag, pending an expert pass (DECISIONS D29).
const VOLUME_FIDELITY: Record<PositionRow['volumeModel'], string> = {
  prism: 'approximate — rectangular-prism volume model',
  cylinder: 'approximate — circular-pit volume model (π/4 of the bounding square)',
  prism_ramp: 'approximate — box cut plus access-ramp wedge',
};
const LABOR_FIDELITY = 'approximate — flat base rate plus per-volume dig rate; same base for every position type';

export function compute(inputs: Inputs): Result {
  const calc = computeCalc(inputs);
  const c = counts();
  return {
    inputs: calc.inputs,
    fidelity: { volume: VOLUME_FIDELITY[calc.position.volumeModel], labor: LABOR_FIDELITY },
    resolved: {
      holeL: calc.holeL,
      holeW: calc.holeW,
      holeD: calc.holeD,
      depthOfCut: calc.depthOfCut,
      parapetW: calc.parapetW,
      parapetH: calc.parapetH,
      outerL: calc.outerL,
      outerW: calc.outerW,
      setback: calc.setback,
    },
    cover: { thickness: calc.coverT, material: calc.coverMaterial, roofPath: calc.roofPath },
    geometry: buildGeometry(calc),
    bom: buildBom(calc),
    labor: buildLabor(calc),
    validation: runValidation(calc),
    derivations: buildDerivations(calc),
    placeholderReport: {
      total: c.total,
      remaining: c.placeholder,
      safetyCriticalRemaining: c.safetyCriticalRemaining,
    },
  };
}
