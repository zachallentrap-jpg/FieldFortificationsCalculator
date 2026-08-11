// The deterministic engine core (§2.2, §9). compute(inputs) is PURE — no randomness, no
// clock, no network, no I/O. It normalizes inputs, resolves doctrine, runs the exact §9
// formula chain into a single intermediate `Calc`, then hands `Calc` to the pure
// geometry / BOM / labor / validation / derivation builders. Identical inputs produce a
// byte-identical Result (asserted by the determinism test).

import '../doctrine/index'; // side-effect: registers every Provenance leaf + freezes structure
import { positions, vehicleRamp, parapetModeFor, access } from '../doctrine/positions';
import { soils } from '../doctrine/soils';
import { standards } from '../doctrine/standards';
import { sandbag, revetments, camo, sump, excavation, machine } from '../doctrine/materials';
import { parapet, berm, overhead, threats, standoffMinFor, standoffLeafFor, stringerSizeForSpan, stringerSectionForSpan, radiationHalving } from '../doctrine/protection';
import type { ShieldMaterial } from '../doctrine/protection';
import { counts } from '../doctrine/registry';
import { labor as laborDoctrine } from '../doctrine/labor';
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

  invalid: { position: boolean; soil: boolean; threat: boolean; standard: boolean; revetment: boolean };
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
  bearingEachEnd: number; // stringer overhang PAST its support, each end
  roofEdgeFt: number; // OUTWARD extent of the deck past the front AND rear hole walls (setback + bearing)
  roofEndFt: number; // OUTWARD extent of the deck past each flank wall (endLap)
  roofNotchFt: number; // width of the rear entrance notch cut out of the deck (0 = none)
  coverL: number; // deck extent along the FRONTAGE (holeL + 2 × endLap)
  coverW: number; // deck extent FRONT-TO-BACK (holeW + 2 × roofEdgeFt)
  coverArea: number; // deck plan area, notch removed
  coverVol: number;
  stringers: number;
  stringerSpan: number; // clear span the stringers bridge (front-to-back, the axis they cross)
  stringerSize: string; // doctrine size label for that span ('' when no earth roof)
  stringerSectionFt: number; // dressed square section that goes with that size
  radHalvingLeaf: Provenance<number> | undefined; // fallout halving-thickness for the cover material
  radHalvingLayers: number; // how many halving-thicknesses the earth cover provides (fallout)

  // volumes
  holeVol: number;
  hasPlatform: boolean;
  platformL: number; // clamped to the hole it stands in — one footprint for bill and both views
  platformW: number;
  platformRise: number; // how far the platform surface stands ABOVE the bay floor
  undugPlatformVol: number; // earth LEFT STANDING — subtracts from the excavation, never adds
  platformClamped: boolean;
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
  parapetMode: import('../doctrine/positions').ParapetMode; // earth | sandbag | berm
  bagsParapet: number; // earth: firing-rest bags only; sandbag: full ring; berm: 0
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

  const revetKnown = raw.revetment in revetments;
  const invalidRevetment = !revetKnown;
  const revet = revetKnown ? revetments[raw.revetment]! : revetments['none']!;

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

  // Stringers cross FRONT-TO-BACK, because that is where the supports are: the doctrinal roof
  // support layout is "3 total — 2 front and 1 rear" (modeling spec §2.b), i.e. supports lying
  // along the frontage at the front and rear lips, so the beams laid on them run front-to-back
  // and are laid out ALONG the frontage at doctrine spacing. min(holeL, holeW) coincided with
  // that on every catalog position except the one-man hole (2.5 ft frontage / 4.0 ft
  // front-to-back), where it rotated the roof 90° against the support layout.
  const clearSpan = holeW;
  // The access ramp is cut across the NARROW side of a vehicle position — its own axis, kept
  // separate from the roof's span so a change to one never silently moves the other.
  const rampWidth = Math.min(holeL, holeW);

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
  const rampVol = isVehicle ? 0.5 * vehicleRamp.slopeRatio.value * depthOfCut * depthOfCut * rampWidth : 0;
  // §9 literal: the platform term keys purely on whether the POSITION has a firing platform
  // (a structural feature of crew-served positions), NOT on the firingStep input toggle.
  //
  // The platform is UNDISTURBED EARTH LEFT STANDING — the gun/launcher stand the crew bays are
  // dug down around ("this is a CUT, not a build", modeling spec §2.f). So its volume is dug
  // OUT of the excavation total, not added to it: this is the dirt nobody moves. Both drawings
  // have always shown it that way; only the bill was inverted.
  //
  // The footprint is clamped to the hole it stands in HERE, in the one place the bill and both
  // views all read, so a table that describes an impossible platform can never again leave the
  // picture right and the spoil figure wrong. The rise is clamped to the cut for the same
  // reason — a bench cannot stand taller than the floor is deep.
  const hasPlatform = position.firingPlatform !== undefined;
  const rawPlatform = position.firingPlatform;
  const platformL = rawPlatform ? Math.min(rawPlatform.L.value, holeL) : 0;
  const platformW = rawPlatform ? Math.min(rawPlatform.W.value, holeW) : 0;
  const platformRise = rawPlatform ? Math.min(rawPlatform.riseAboveFloor.value, depthOfCut) : 0;
  const platformClamped = rawPlatform !== undefined && (
    platformL !== rawPlatform.L.value || platformW !== rawPlatform.W.value || platformRise !== rawPlatform.riseAboveFloor.value
  );
  const undugPlatformVol = platformL * platformW * platformRise;
  // The firingStep input drives the section-drawing firing-step ledge (§10) — a minor cut
  // §9 folds into holeVol. It adds no fabricated volume or labor of its own. A one-man position
  // is dug armpit-deep for standing fire and takes NO firing step (modeling spec §2.f), so the
  // toggle is a no-op there — the drawing must never teach a step the doctrine forbids.
  //
  // Also a no-op for any position with sectorsOfFire=false (mortar_pit, both vehicle defilades,
  // bunker_op_cp, connecting_trench): "step up TO SHOOT" only makes sense for a position that
  // has a modeled aiming direction over its own front wall to begin with. A mortar fires
  // high-angle indirect, laid by aiming stakes/FDC data, not sighted over a parapet; a vehicle
  // crew fires from the vehicle's own sights, not a dismounted soldier on a dug ledge; the
  // other three have no facing direction at all (the plan view already draws them as open
  // corridors with no FRONT/REAR for the same reason). The drawing must not teach a "step up
  // and shoot over the wall" pose to a crew with no wall to shoot over in that sense.
  const firingStepOn = inputs.firingStep && raw.positionType !== 'one_man' && position.sectorsOfFire;

  const sumpOn = inputs.sump;
  const sumpCount = sumpOn ? position.grenadeSumps : 0;
  const oneSumpVol = sump.L.value * sump.W.value * sump.D.value;
  const sumpVol = sumpCount * oneSumpVol;
  const gravelVol = sumpCount * sump.gravelFt3.value;

  // The platform SUBTRACTS: it is the one part of the footprint the crew does not dig.
  const excavBank = holeVol - undugPlatformVol + sumpVol + rampVol;
  const excavLoose = excavBank * excavation.swellFactor.value;

  // ── Roof footprint ───────────────────────────────────────────────────────────
  // One signed convention, three views. Every extent below is measured OUTWARD from the
  // corresponding hole wall and is ≥ 0 by construction; a consumer that subtracts one is
  // drawing the roof on the wrong side of the wall it has to clear.
  //
  // FRONT and REAR are the SAME number, because the rule is orientation-blind: a rear support
  // is a support. Supports stand back from the lip by `setback`; stringers are then laid across
  // them overhanging `bearingEachEnd` past each one, and the deck follows the stringers. The
  // ENDS take neither — no stringer end lands there — so they take the flank lap.
  const bearingEachEnd = overhead.bearingEachEnd.value;
  const roofEdgeFt = setback + bearingEachEnd;
  const roofEndFt = overhead.endLap.value;
  // A roofed bunker/OP is the one position whose parapet ring is tall enough to seal it shut:
  // extended the full rear bearing, the deck roofs over the rear entrance corridor. The DECK is
  // notched across the passage width so the corridor stays open to the sky; the stringers keep
  // their full rear bearing (you duck under a beam, you do not climb over a roof).
  const roofNotchFt = position.shape === 'rect_roofed' ? Math.min(access.passWidthFt.value, holeL) : 0;
  const coverL = holeL + 2 * roofEndFt;
  const coverW = holeW + 2 * roofEdgeFt;
  const coverArea = coverL * coverW - roofNotchFt * roofEdgeFt;
  const buildsEarthRoof = coverOn && roofPath === 'earth_on_stringers';
  const coverVol = buildsEarthRoof ? coverArea * coverT : 0;
  const spacing = overhead.stringerSpacing.value;
  // Counted over the DECK the same block bills, not over the bare hole — the old count left
  // 2 ft of billed slab with no stringer under it on every position.
  const stringers = buildsEarthRoof ? ceilInt(coverL / spacing) + 1 : 0;
  const stringerSize = buildsEarthRoof ? stringerSizeForSpan(clearSpan) : '';
  const stringerSectionFt = stringerSectionForSpan(clearSpan);

  // Fallout attenuation the earth roof happens to provide, expressed in halving-thicknesses
  // (each layer roughly halves the dose). Consumes the radiationHalving doctrine leaf so those
  // safety-critical values earn their place in the banner instead of sitting dead (Phase 6).
  const radHalvingLeaf = buildsEarthRoof && (coverMaterial in radiationHalving)
    ? radiationHalving[coverMaterial as ShieldMaterial]
    : undefined;
  const radHalvingLayers = radHalvingLeaf && radHalvingLeaf.value > 0 ? coverT / radHalvingLeaf.value : 0;

  const bagVol = sandbag.L.value * sandbag.W.value * sandbag.H.value;
  const waste = sandbag.wasteFactor.value;
  // Frontal parapet is filled from SPOIL, not stacked bags (ATP 3-21.8 §5-240) — so an EARTH
  // parapet (rifle/crew/mortar/ATGM/trench) bills sandbags ONLY for the firing rest at the
  // aperture, not the whole ring. A 'sandbag' parapet (bunker/OP) keeps the ring-volume bag
  // count; a 'berm' (vehicle) bills none. The parapet's protective mass is charged to spoil
  // for every mode via fillDemand below — the earlier model double-counted it as ~190 bags.
  const parapetMode = parapetModeFor(position);
  // ONE continuous front sandbag course spanning the full frontage, 2 bags deep, at doctrine
  // height (ATP 3-21.8 §5-238) — not a handful of discrete "rests." Only a real firing position
  // gets one (sectorsOfFire); mortar pits (different shape branch) and connecting trenches have
  // no directional aperture to rest a weapon on.
  const frontRestVol = position.sectorsOfFire ? holeL * (2 * sandbag.W.value) * sandbag.frontWallHeight.value : 0;
  const bagsAperture = ceilInt((frontRestVol / bagVol) * waste);
  const bagsParapet =
    parapetMode === 'berm' ? 0 :
    parapetMode === 'sandbag' ? ceilInt((parapetRing / bagVol) * waste) :
    bagsAperture; // earth parapet — bags only at the firing rest
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
  // The labor leaves are read HERE, per call — never copied out to module scope. A sanctioned
  // doctrine import mutates these leaves in place, and stages.ts / explain.ts read them live:
  // a module-scope copy kept billing the pre-import rates while the stage clock subtracted the
  // post-import adders from that stale total, driving per-stage man-hours negative and printing
  // a trace whose live operands no longer multiplied out to its own result.
  const machineFactor = inputs.machineAssist ? machine.excavationFactor.value : 1;
  const mh =
    laborDoctrine.baseMH.value * soil.digFactor.value * standard.laborMul.value +
    excavBank * laborDoctrine.perVolMH.value * machineFactor +
    (buildsEarthRoof ? laborDoctrine.overheadAdd.value : 0) +
    (revet.buildsFace ? laborDoctrine.revetAdd.value : 0) +
    (sumpCount > 0 ? laborDoctrine.sumpAdd.value : 0) +
    (inputs.camouflage ? laborDoctrine.camoAdd.value : 0);
  const mhPerPos = round1(mh);
  const mhTotal = round1(mhPerPos * count);
  const elapsed = round1(mhTotal / teamSize);
  // Machine time is reported in BLADE-HOURS, its own axis — a dozer hour is not a man-hour.
  const machineHrsPerPos = inputs.machineAssist ? round1(excavBank * laborDoctrine.machinePerVolMH.value) : 0;
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
    invalid: { position: invalidPosition, soil: invalidSoil, threat: invalidThreat, standard: invalidStandard, revetment: invalidRevetment },
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
    bearingEachEnd,
    roofEdgeFt,
    roofEndFt,
    roofNotchFt,
    coverL,
    coverW,
    coverArea,
    coverVol,
    stringers,
    stringerSpan: clearSpan,
    stringerSize,
    stringerSectionFt,
    radHalvingLeaf,
    radHalvingLayers,
    holeVol,
    hasPlatform,
    platformL,
    platformW,
    platformRise,
    undugPlatformVol,
    platformClamped,
    firingStepOn,
    sumpOn,
    sumpCount,
    sumpVol,
    gravelVol,
    excavBank,
    excavLoose,
    bagVol,
    waste,
    parapetMode,
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

// Model-fidelity statements (EXECUTION_PLAN Phase 1): formulas get the same honesty
// treatment as constants. Every position's volume model is an approximation and says so —
// the structural analogue of the (PH) flag, pending an expert pass (DECISIONS D29).
const VOLUME_FIDELITY: Record<PositionRow['volumeModel'], string> = {
  prism: 'approximate — rectangular-prism volume model',
  cylinder: 'approximate — circular-pit volume model (π/4 of the bounding square)',
  prism_ramp: 'approximate — box cut plus access-ramp wedge',
};
// A compound position's rear stem / side arm is DRAWN (all three views now draw it from the
// same doctrine leaves) but it is not in the volume model — holeVol is the main bay's bounding
// prism only. Keying the fidelity statement on volumeModel alone meant the sheet never said so,
// and a reader had no way to know the trench in the picture is outside the number.
function volumeFidelity(pos: PositionRow): string {
  const base = VOLUME_FIDELITY[pos.volumeModel];
  if (pos.shape === 'inverted_t') return base + '; the rear stem trench is drawn but not billed';
  if (pos.shape === 'l_shape') return base + '; the side arm trench is drawn but not billed';
  return base;
}
const LABOR_FIDELITY = 'approximate — flat base rate plus per-volume dig rate; same base for every position type';

export function compute(inputs: Inputs): Result {
  const calc = computeCalc(inputs);
  const c = counts();
  return {
    inputs: calc.inputs,
    fidelity: { volume: volumeFidelity(calc.position), labor: LABOR_FIDELITY },
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
