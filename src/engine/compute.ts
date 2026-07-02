// The deterministic engine core (§2.2, §9). compute(inputs) is PURE — no randomness, no
// clock, no network, no I/O. It normalizes inputs, resolves doctrine, runs the exact §9
// formula chain into a single intermediate `Calc`, then hands `Calc` to the pure
// geometry / BOM / labor / validation / derivation builders. Identical inputs produce a
// byte-identical Result (asserted by the determinism test).

import '../doctrine/index'; // side-effect: registers every Provenance leaf + freezes structure
import { positions } from '../doctrine/positions';
import { soils } from '../doctrine/soils';
import { standards } from '../doctrine/standards';
import { sandbag, revetments, camo, sump, excavation, machine } from '../doctrine/materials';
import { parapet, overhead, threats, standoffMinFor, standoffLeafFor } from '../doctrine/protection';
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

  // geometry scalars (feet)
  holeL: number;
  holeW: number;
  holeD: number;
  depthOfCut: number;
  setback: number;
  standoffMin: number;
  standoffLeaf: Provenance<number> | undefined;
  parapetW: number;
  parapetH: number;
  outerL: number;
  outerW: number;
  parapetRing: number;

  // cover
  coverOn: boolean;
  roofPath: RoofPath;
  coverT: number;
  coverMaterial: string;
  coverLeaf: Provenance<number> | undefined;
  coverL: number;
  coverW: number;
  coverVol: number;
  stringers: number;

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
  bagsParapet: number;
  bagsCover: number;
  bagsRevet: number;
  perimeter: number;
  faceArea: number;
  pickets: number;
  camoArea: number;

  // labor
  mhPerPos: number;
  mhTotal: number;
  elapsed: number;
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

  const coverOn = inputs.overheadCover && threat !== 'none';
  const cover = resolveCover(threat, coverOn, standard.coverMul.value);
  const roofPath = cover.roofPath;
  const coverT = cover.thickness; // 0 unless earth_on_stringers (§2.7)
  const coverMaterial = cover.material;

  const parapetW = parapet.W.value;
  const parapetH = parapet.H.value;
  const outerL = holeL + 2 * parapetW;
  const outerW = holeW + 2 * parapetW;
  const parapetRing = (outerL * outerW - holeL * holeW) * parapetH;

  const holeVol = holeL * holeW * depthOfCut;
  // §9 literal: platformVol keys purely on whether the POSITION has a firing platform
  // (a structural feature of crew-served positions), NOT on the firingStep input toggle.
  const hasPlatform = position.firingPlatform !== undefined;
  const platformVol = position.firingPlatform
    ? position.firingPlatform.L.value * position.firingPlatform.W.value * position.firingPlatform.depthBelowHole.value
    : 0;
  // The firingStep input drives the section-drawing firing-step ledge (§10) — a minor cut
  // §9 folds into holeVol. It adds no fabricated volume or labor of its own.
  const firingStepOn = inputs.firingStep;

  const sumpOn = inputs.sump;
  const sumpCount = sumpOn ? position.grenadeSumps : 0;
  const oneSumpVol = sump.L.value * sump.W.value * sump.D.value;
  const sumpVol = sumpCount * oneSumpVol;
  const gravelVol = sumpCount * sump.gravelFt3.value;

  const excavBank = holeVol + platformVol + sumpVol;
  const excavLoose = excavBank * excavation.swellFactor.value;

  const bearingEachEnd = overhead.bearingEachEnd.value;
  const coverL = holeL + 2 * bearingEachEnd;
  const coverW = holeW + 2 * bearingEachEnd;
  const buildsEarthRoof = coverOn && roofPath === 'earth_on_stringers';
  const coverVol = buildsEarthRoof ? coverL * coverW * coverT : 0;
  const spacing = overhead.stringerSpacing.value;
  const stringers = buildsEarthRoof ? ceilInt(holeW / spacing) + 1 : 0;

  const bagVol = sandbag.L.value * sandbag.W.value * sandbag.H.value;
  const waste = sandbag.wasteFactor.value;
  const bagsParapet = ceilInt((parapetRing / bagVol) * waste);
  const bagsCover = ceilInt((coverVol / bagVol) * waste);

  const perimeter = 2 * (holeL + holeW);
  const faceArea = revet.buildsFace ? perimeter * depthOfCut : 0;
  const bagsRevet = revet.kind === 'bag' ? ceilInt((faceArea * sandbag.W.value / bagVol) * waste) : 0;
  const picketSpacing = revet.spacing?.value ?? spacing;
  const pickets = revet.kind === 'picket' ? ceilInt(perimeter / picketSpacing) : 0;
  const camoArea = inputs.camouflage ? ceilInt(outerL * outerW * camo.drapeFactor.value) : 0;

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
    coverOn,
    roofPath,
    coverT,
    coverMaterial,
    coverLeaf: cover.thicknessLeaf,
    coverL,
    coverW,
    coverVol,
    stringers,
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
    bagsCover,
    bagsRevet,
    perimeter,
    faceArea,
    pickets,
    camoArea,
    mhPerPos,
    mhTotal,
    elapsed,
  };
}

// Labor doctrine values pulled once (kept out of the chain body for readability). Not a
// bare literal — all values come from doctrine/labor.
import { labor as laborDoctrine } from '../doctrine/labor';
const baseLabor = {
  baseMH: laborDoctrine.baseMH.value,
  perVolMH: laborDoctrine.perVolMH.value,
  overheadAdd: laborDoctrine.overheadAdd.value,
  revetAdd: laborDoctrine.revetAdd.value,
  sumpAdd: laborDoctrine.sumpAdd.value,
  camoAdd: laborDoctrine.camoAdd.value,
};

export function compute(inputs: Inputs): Result {
  const calc = computeCalc(inputs);
  const c = counts();
  return {
    inputs: calc.inputs,
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
