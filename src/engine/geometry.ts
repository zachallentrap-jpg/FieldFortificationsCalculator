// Geometry model (§9, §10). Pure data blocks the renderers project to pixels — the engine
// never touches SVG. Every number is finite by construction (all inputs come from the
// finite Calc). Coordinates are in FEET; the plan uses front = enemy side. Renderers apply
// a single projector (render/project.ts) so nothing drifts.

import { parapet, berm, overhead } from '../doctrine/protection';
import { soils } from '../doctrine/soils';
import { camo, sump as sumpMat } from '../doctrine/materials';
import { firingStep, mortarPit, access } from '../doctrine/positions';
import type { ShapeId } from '../doctrine/positions';
import type { RoofPath } from './types';
import type { Calc } from './compute';

export interface DimSpec {
  key: string;
  label: string;
  valueFt: number;
  placeholder: boolean; // dimension derived from a PLACEHOLDER doctrine value → suffix (PH)
}

export interface SumpMark {
  xFt: number;
  yFt: number;
}

/**
 * The roof footprint, published once for the bill and both views.
 *
 * SIGN CONVENTION — READ THIS BEFORE USING ANY FIELD HERE. `frontFt`, `rearFt` and `endFt` are
 * OUTWARD extensions past the corresponding hole wall, in feet, measured at grade. They are
 * >= 0 by construction: a consumer that SUBTRACTS one is drawing the roof on the wrong side of
 * the wall it exists to clear. The overhead-cover setback is measured FROM THE HOLE EDGE
 * OUTWARD to where the supports begin (modeling spec §2.b), and the stringers then run PAST
 * those supports and bear on undisturbed ground — a roof inset over its own hole cannot bear
 * on anything.
 *
 * `frontEdgeFt` / `rearEdgeFt` / `endEdgeFt` publish the same footprint as ABSOLUTE
 * coordinates in the section's own frame (hole centre = 0, front negative, rear positive), so
 * a view never has to do the arithmetic — and so an accidental sign flip is not expressible.
 */
export interface RoofModel {
  frontFt: number;
  rearFt: number; // identical to frontFt: the rule is orientation-blind, a rear support is a support
  endFt: number; // the flank lap — no stringer end lands here, so neither setback nor bearing applies
  entranceNotchFt: number; // deck omitted across this much of the REAR, so the entrance is not roofed shut
  setbackFt: number; // stage 1: how far the supports stand back from the lip (what the dimension line labels)
  bearingFt: number; // stage 2: how far the stringers overhang each support
  frontEdgeFt: number; // = −(holeW/2 + frontFt)
  rearEdgeFt: number; // = +(holeW/2 + rearFt)
  endEdgeFt: number; // = +(holeL/2 + endFt)
  areaFt2: number; // deck plan area, entrance notch removed — the area the BOM prices
  coverT: number;
  stringer: {
    count: number;
    spacingFt: number;
    axis: 'frontBack'; // the axis a stringer RUNS along; they are laid out across the frontage
    lengthFt: number; // the full deck run they cover, front edge to rear edge
    sectionFt: number; // dressed square section of the size the engine resolved
    sizeLabel: string;
  };
}

export interface SubBay {
  xFt: number; // centre, frontage axis
  zFt: number; // centre, front-to-back axis (positive = rear)
  L: number;
  W: number;
  depthFt: number;
  // The trench's own unrevetted wall flare at grade — the same rule as section.wallTaper,
  // run on the trench's own dims and depth, so the one view that draws these walls in relief
  // (the 3D model) never re-derives the formula.
  taperFt: number;
}

export interface GeometryModel {
  shape: ShapeId;
  hasAnything: boolean; // false ⇒ nothing to draw; renderer shows a prompt, not a blank box
  plan: {
    outerL: number;
    outerW: number;
    holeL: number;
    holeW: number;
    parapetW: number;
    sectors: { present: boolean; leftDeg: number; rightDeg: number };
    sumps: SumpMark[];
    // The grenade sump AS BILLED — one box, the same one compute prices (materials.sump). Both
    // views drew their own sump size before this, neither of them the one the BOM paid for.
    sumpBox: { L: number; W: number; D: number };
    elbows: SumpMark[];
    platform: { L: number; W: number } | null;
    // The rear stem / side arm of a compound position, from the position's own subBay leaves —
    // the plan and the 3D model each used to derive it from the hole with their own factors.
    subBays: SubBay[];
    // Camouflage net plan extent. √drapeFactor per axis, so the drawn plane's area IS the area
    // the BOM orders; heightFt is how high above grade it flies.
    camoNet: { L: number; W: number; heightFt: number } | null;
    enemy: 'front';
  };
  section: {
    depthOfCut: number;
    holeW: number;
    holeL: number;
    parapetW: number;
    parapetH: number;
    /** The whole roof footprint and its sign convention — null when nothing is roofed. */
    roof: RoofModel | null;
    // How far the excavation wall flares outward at grade vs. the floor (feet), for an
    // unrevetted earth wall in loose soil — 0 when revetted (revetment holds the wall vertical
    // regardless of soil) or the soil needs no batter. Same formula the 3D model already used
    // (scene3d.ts's pushBayBox taperAmount) — feet, same axis as holeW.
    wallTaper: number;
    coverOn: boolean;
    roofPath: RoofPath;
    coverT: number;
    stringers: number;
    hasPlatform: boolean;
    /**
     * The firing platform: UNDISTURBED EARTH LEFT STANDING inside the bay. `riseFt` > 0 means
     * its surface stands that far ABOVE the bay floor — it is the dirt the crew does NOT dig,
     * which is why the excavation subtracts it. L/W are already clamped to the hole, once, in
     * compute, so the bill and all three views share one footprint.
     */
    platform: { L: number; W: number; riseFt: number } | null;
    firingStepOn: boolean;
    /** The rifle-position firing-step ledge (not the crew-served platform above). */
    firingStep: { heightFt: number; runFt: number };
    /** Getting in and out: the rear entrance passage and the graded way down. */
    access: { entranceGapFt: number; stairMaxRiserFt: number; stairTreadFt: number };
    sump: boolean;
  };
  dims: DimSpec[];
}

const ph = (status: 'PLACEHOLDER' | 'DOCTRINE'): boolean => status === 'PLACEHOLDER';

// Ramp doctrine accessors kept here (not inline) so the dims block above stays readable.
import { vehicleRamp } from '../doctrine/positions';
const rampSlope = (): number => vehicleRamp.slopeRatio.value;
const rampSlopeStatus = (): 'PLACEHOLDER' | 'DOCTRINE' => vehicleRamp.slopeRatio.status;

function sumpMarks(count: number, holeL: number, holeW: number): SumpMark[] {
  if (count <= 0) return [];
  // The mark IS the sump's centre, so it sits half a sump in from the rear wall — the section
  // draws the billed box centred here and the 3D model reads the same point.
  const yFt = holeW / 2 - sumpMat.W.value / 2;
  const marks: SumpMark[] = [];
  for (let i = 0; i < count; i++) {
    // Spread evenly across the frontage.
    const frac = count === 1 ? 0.5 : i / (count - 1);
    const xFt = (frac - 0.5) * (holeL - 1);
    marks.push({ xFt, yFt });
  }
  return marks;
}

// Elbow rests (one_man: 2, two_man: 4 — one per firer per sector of fire) are a firing-edge
// feature, not a floor feature: they sit at the FRONT lip of the bay where a prone/kneeling
// firer's elbows brace against the parapet, opposite the sump's rear-wall placement. Same
// even-spread-across-frontage math as sumpMarks, mirrored to the front wall.
function elbowMarks(count: number, holeL: number, holeW: number): SumpMark[] {
  if (count <= 0) return [];
  const yFt = -(holeW / 2 - 0.5); // near the front wall
  const marks: SumpMark[] = [];
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 0.5 : i / (count - 1);
    const xFt = (frac - 0.5) * (holeL - 1);
    marks.push({ xFt, yFt });
  }
  return marks;
}

// How far an UNREVETTED earth excavation wall flares outward at grade vs. the floor — steeper
// soils (sand, silt) batter more, revetted walls stay vertical regardless of soil (the facing
// holds it), and round/vehicle excavations use their own shape (never this rect-family taper).
// This is the ONE home of the rect-family taper rule: the section reads it as wallTaper, the 3D
// model reads the same field (and taperFt per sub-bay) instead of holding a copy of the formula
// — while it held one, editing either copy's slope or clamps left the whole suite green with
// the two views drawing different walls. The two clamps are self-intersection guards, not
// doctrine: don't let the drawn flare eat the parapet footprint or collide with the opposite
// wall of a narrow bay (the truthful message for "this soil can't hold this cut" is the
// REVET_REQUIRED_SOIL error, never a steeper drawing).
// A MORTAR PIT is the exception in both directions: its walls are always battered, in every
// soil and under every revetment, because the batter is sized for repeated firing concussion
// rather than soil stability. That ratio used to live in the 3D renderer, so the 3D drew a
// flared pit while the plan drew a plain circle and the section drew plumb walls — three views
// of one pit, one of them alone knowing its shape.
function rectTaperFt(calc: Calc, bayL: number, bayW: number, depthFt: number): number {
  if (calc.isVehicle || calc.inputs.revetment !== 'none') return 0;
  const soilRow = soils[calc.inputs.soil];
  if (!soilRow) return 0;
  return Math.min(
    soilRow.wallSlopeRatio.value * depthFt,
    calc.parapetW * 0.9,
    Math.min(bayL, bayW) * 0.35,
  );
}

function wallTaperFt(calc: Calc): number {
  if (calc.isCircular) {
    return Math.min(mortarPit.batterRatio.value * calc.depthOfCut, calc.parapetW * 0.9);
  }
  return rectTaperFt(calc, calc.holeL, calc.holeW, calc.depthOfCut);
}

// The rear entrance passage. An ATGM launcher needs a genuinely open rear lane clear of hard
// vertical surfaces for its backblast, not a person-sized slot; every other position takes the
// passage width, or the whole frontage when the position is narrower than one person-passage.
function entranceGapFt(calc: Calc): number {
  if (calc.inputs.positionType === 'atgm_javelin') return calc.holeL * access.backblastLaneFrac.value;
  return Math.min(access.passWidthFt.value, calc.holeL);
}

// The rear stem (inverted-T) or side arm (L-shape), placed off the main bay from the position's
// own subBay leaves.
function subBaysOf(calc: Calc): SubBay[] {
  const sb = calc.position.subBay;
  if (!sb) return [];
  const L = sb.L.value;
  const W = sb.W.value;
  const depthFt = calc.depthOfCut * sb.depthFrac.value;
  const taperFt = rectTaperFt(calc, L, W, depthFt);
  if (calc.position.shape === 'inverted_t') {
    return [{ xFt: 0, zFt: calc.holeW / 2 + W / 2, L, W, depthFt, taperFt }];
  }
  if (calc.position.shape === 'l_shape') {
    return [{ xFt: calc.holeL / 2 + L / 2, zFt: calc.holeW / 2 - W / 2, L, W, depthFt, taperFt }];
  }
  return [];
}

// The roof, published as ONE footprint with its sign convention on the type. Front and rear
// are the same number because the doctrinal rule is orientation-blind — the earlier model gave
// the rear a max(bearing, ¼-cut) of its own, which is the arithmetic of ALTERNATIVES applied to
// two SEQUENTIAL stages, and it dropped the threat-scaled floor the front had to clear. Same
// roof, same munition, two supports, and the rear one was held to half the front's standoff.
function roofModel(calc: Calc): RoofModel | null {
  if (!(calc.coverOn && calc.roofPath === 'earth_on_stringers')) return null;
  return {
    frontFt: calc.roofEdgeFt,
    rearFt: calc.roofEdgeFt,
    endFt: calc.roofEndFt,
    entranceNotchFt: calc.roofNotchFt,
    setbackFt: calc.setback,
    bearingFt: calc.bearingEachEnd,
    frontEdgeFt: -(calc.holeW / 2 + calc.roofEdgeFt),
    rearEdgeFt: calc.holeW / 2 + calc.roofEdgeFt,
    endEdgeFt: calc.holeL / 2 + calc.roofEndFt,
    areaFt2: calc.coverArea,
    coverT: calc.coverT,
    stringer: {
      count: calc.stringers,
      spacingFt: overhead.stringerSpacing.value,
      axis: 'frontBack',
      lengthFt: calc.coverW,
      sectionFt: calc.stringerSectionFt,
      sizeLabel: calc.stringerSize,
    },
  };
}

export function buildGeometry(calc: Calc): GeometryModel {
  const posD = calc.position.hole.D.status;
  const posL = calc.position.hole.L.status;
  const posW = calc.position.hole.W.status;
  const depthPh = ph(posD) || ph(calc.standard.depthMul.status);
  const coverPh = calc.coverLeaf ? ph(calc.coverLeaf.status) || ph(calc.standard.coverMul.status) : false;

  // Vehicle positions carry a spoil BERM, not a sandbag parapet — the labels and the
  // placeholder flags both follow the doctrine leaves that actually fed the numbers.
  const frontalW = calc.isVehicle ? berm.W : parapet.W;
  const frontalH = calc.isVehicle ? berm.H : parapet.H;
  const frontalName = calc.isVehicle ? 'Berm' : 'Parapet';
  const dia = calc.isCircular ? ' (diameter)' : '';

  const dims: DimSpec[] = [
    { key: 'frontage', label: 'Frontage' + dia, valueFt: calc.holeL, placeholder: ph(posL) },
    { key: 'front_back', label: 'Front-to-back' + dia, valueFt: calc.holeW, placeholder: ph(posW) },
    { key: 'depth', label: 'Depth of cut', valueFt: calc.depthOfCut, placeholder: depthPh },
    { key: 'parapet_w', label: frontalName + ' thickness', valueFt: calc.parapetW, placeholder: ph(frontalW.status) },
    { key: 'parapet_h', label: frontalName + ' height', valueFt: calc.parapetH, placeholder: ph(frontalH.status) },
    {
      key: 'setback',
      label: 'Roof setback',
      valueFt: calc.setback,
      // calc.setback = max(standoffMin, setbackDepthFrac × depthOfCut). standoffMin comes from
      // calc.standoffLeaf (the THREAT's own standoff, explain.ts:46) whenever a real threat is
      // selected — overhead.setbackMin is only the fallback for threat==='none'/unknown, so
      // checking it unconditionally missed the leaf that's actually live in the common case.
      // depthOfCut also feeds this (depthPh, computed above) and was never OR'd in at all.
      placeholder: ph((calc.standoffLeaf ?? overhead.setbackMin).status) || ph(overhead.setbackDepthFrac.status) || depthPh,
    },
    { key: 'outer_l', label: 'Overall length', valueFt: calc.outerL, placeholder: ph(posL) || ph(frontalW.status) },
    { key: 'outer_w', label: 'Overall width', valueFt: calc.outerW, placeholder: ph(posW) || ph(frontalW.status) },
  ];
  if (calc.rampVol > 0) {
    // The ramp run — how much level ground the access ramp consumes behind the cut.
    dims.push({
      key: 'ramp_run',
      label: 'Ramp run (behind position)',
      valueFt: calc.depthOfCut * (calc.rampVol > 0 ? rampSlope() : 0),
      placeholder: ph(rampSlopeStatus()) || depthPh,
    });
  }
  if (calc.coverOn && calc.roofPath === 'earth_on_stringers') {
    dims.push({ key: 'cover_t', label: 'Cover thickness', valueFt: calc.coverT, placeholder: coverPh });
  }

  const sectorsPresent = calc.position.sectorsOfFire;
  const az = calc.inputs.sectorAzimuths;

  return {
    shape: calc.position.shape,
    hasAnything: calc.holeL > 0 && calc.holeW > 0 && calc.depthOfCut > 0,
    plan: {
      outerL: calc.outerL,
      outerW: calc.outerW,
      holeL: calc.holeL,
      holeW: calc.holeW,
      parapetW: calc.parapetW,
      sectors: {
        present: sectorsPresent,
        leftDeg: az ? az.leftDeg : -45,
        rightDeg: az ? az.rightDeg : 45,
      },
      sumps: sumpMarks(calc.sumpCount, calc.holeL, calc.holeW),
      sumpBox: { L: sumpMat.L.value, W: sumpMat.W.value, D: sumpMat.D.value },
      elbows: elbowMarks(calc.position.elbowHoles, calc.holeL, calc.holeW),
      // One footprint, clamped once in compute — the bill, the plan, the section and the 3D
      // model all read this. It used to be clamped HERE, for drawing only, while the bill kept
      // billing an impossible platform: the picture was right and the spoil figure was wrong.
      platform: calc.hasPlatform ? { L: calc.platformL, W: calc.platformW } : null,
      subBays: subBaysOf(calc),
      camoNet: calc.inputs.camouflage
        ? {
            // drapeFactor is an AREA factor, so the plane's LINEAR extension per axis is its
            // square root — that way the drawn plane's area is exactly the area billed.
            L: calc.outerL * Math.sqrt(camo.drapeFactor.value),
            W: calc.outerW * Math.sqrt(camo.drapeFactor.value),
            heightFt: camo.drapeHeightFt.value,
          }
        : null,
      enemy: 'front',
    },
    section: {
      depthOfCut: calc.depthOfCut,
      holeW: calc.holeW,
      holeL: calc.holeL,
      parapetW: calc.parapetW,
      parapetH: calc.parapetH,
      roof: roofModel(calc),
      wallTaper: wallTaperFt(calc),
      coverOn: calc.coverOn,
      roofPath: calc.roofPath,
      coverT: calc.coverT,
      stringers: calc.stringers,
      hasPlatform: calc.hasPlatform,
      platform: calc.hasPlatform ? { L: calc.platformL, W: calc.platformW, riseFt: calc.platformRise } : null,
      firingStepOn: calc.firingStepOn,
      firingStep: { heightFt: firingStep.heightFt.value, runFt: firingStep.runFt.value },
      access: {
        entranceGapFt: entranceGapFt(calc),
        stairMaxRiserFt: access.stairMaxRiserFt.value,
        stairTreadFt: access.stairTreadFt.value,
      },
      sump: calc.sumpCount > 0,
    },
    dims,
  };
}
