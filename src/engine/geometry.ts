// Geometry model (§9, §10). Pure data blocks the renderers project to pixels — the engine
// never touches SVG. Every number is finite by construction (all inputs come from the
// finite Calc). Coordinates are in FEET; the plan uses front = enemy side. Renderers apply
// a single projector (render/project.ts) so nothing drifts.

import { parapet, overhead } from '../doctrine/protection';
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
    platform: { L: number; W: number } | null;
    enemy: 'front';
  };
  section: {
    depthOfCut: number;
    holeW: number;
    parapetW: number;
    parapetH: number;
    setback: number;
    coverOn: boolean;
    roofPath: RoofPath;
    coverT: number;
    stringers: number;
    hasPlatform: boolean;
    platformDepth: number;
  };
  dims: DimSpec[];
}

const ph = (status: 'PLACEHOLDER' | 'DOCTRINE'): boolean => status === 'PLACEHOLDER';

function sumpMarks(count: number, holeL: number, holeW: number): SumpMark[] {
  if (count <= 0) return [];
  const yFt = holeW / 2 - 0.5; // near the rear wall
  const marks: SumpMark[] = [];
  for (let i = 0; i < count; i++) {
    // Spread evenly across the frontage.
    const frac = count === 1 ? 0.5 : i / (count - 1);
    const xFt = (frac - 0.5) * (holeL - 1);
    marks.push({ xFt, yFt });
  }
  return marks;
}

export function buildGeometry(calc: Calc): GeometryModel {
  const posD = calc.position.hole.D.status;
  const posL = calc.position.hole.L.status;
  const posW = calc.position.hole.W.status;
  const depthPh = ph(posD) || ph(calc.standard.depthMul.status);
  const coverPh = calc.coverLeaf ? ph(calc.coverLeaf.status) || ph(calc.standard.coverMul.status) : false;

  const dims: DimSpec[] = [
    { key: 'frontage', label: 'Frontage', valueFt: calc.holeL, placeholder: ph(posL) },
    { key: 'front_back', label: 'Front-to-back', valueFt: calc.holeW, placeholder: ph(posW) },
    { key: 'depth', label: 'Depth of cut', valueFt: calc.depthOfCut, placeholder: depthPh },
    { key: 'parapet_w', label: 'Parapet thickness', valueFt: calc.parapetW, placeholder: ph(parapet.W.status) },
    { key: 'parapet_h', label: 'Parapet height', valueFt: calc.parapetH, placeholder: ph(parapet.H.status) },
    {
      key: 'setback',
      label: 'Roof setback',
      valueFt: calc.setback,
      placeholder: ph(overhead.setbackMin.status) || ph(overhead.setbackDepthFrac.status),
    },
    { key: 'outer_l', label: 'Overall length', valueFt: calc.outerL, placeholder: ph(posL) || ph(parapet.W.status) },
    { key: 'outer_w', label: 'Overall width', valueFt: calc.outerW, placeholder: ph(posW) || ph(parapet.W.status) },
  ];
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
      platform:
        calc.hasPlatform && calc.position.firingPlatform
          ? { L: calc.position.firingPlatform.L.value, W: calc.position.firingPlatform.W.value }
          : null,
      enemy: 'front',
    },
    section: {
      depthOfCut: calc.depthOfCut,
      holeW: calc.holeW,
      parapetW: calc.parapetW,
      parapetH: calc.parapetH,
      setback: calc.setback,
      coverOn: calc.coverOn,
      roofPath: calc.roofPath,
      coverT: calc.coverT,
      stringers: calc.stringers,
      hasPlatform: calc.hasPlatform,
      platformDepth: calc.hasPlatform && calc.position.firingPlatform ? calc.position.firingPlatform.depthBelowHole.value : 0,
    },
    dims,
  };
}
