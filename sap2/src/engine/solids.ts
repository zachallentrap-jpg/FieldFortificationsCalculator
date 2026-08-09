// The geometry kernel (blueprint §4.3, I3): typed solids are the single shape truth.
// Volumes come from exact prismatoid integration of the SAME battered walls the
// section view and the diorama show — v1 drew batter but computed vertical-wall
// volumes (§6B-8); here one solid feeds all three, and renderers project without
// re-deriving anything.
//
// R0 ships the battered rectangular prism (one_man's model); cylinder (mortar) and
// ramp (vehicles) land with their positions as new builders on the same contract.

import { add, div, mul, structuralQ, sum, type Q, type Traced } from './trace';

/** A battered rectangular excavation: floor L×W at depth D, every wall leaning back
 *  by slope s (horizontal run per 1 ft of rise), giving a top opening of
 *  (L + 2sD) × (W + 2sD). */
export interface BatteredPrism {
  readonly kind: 'batteredPrism';
  readonly floorL: Q<'ft'>;
  readonly floorW: Q<'ft'>;
  readonly depth: Q<'ft'>;
  readonly slope: Q<'ratio'>;
  readonly topL: Q<'ft'>;
  readonly topW: Q<'ft'>;
  /** Bank volume by exact prismatoid integration. */
  readonly volume: Q<'ft3'>;
}

const TWO = (): Traced<'ratio'> => structuralQ('AL-GEOM-2', 'const.two', 'ratio', 2);
const FOUR = (): Traced<'ratio'> => structuralQ('AL-GEOM-4', 'const.four', 'ratio', 4);
const SIX = (): Traced<'ratio'> => structuralQ('AL-GEOM-6', 'const.six', 'ratio', 6);

/** Rectangle area at a horizontal cut where each wall has stepped back by `run`. */
const cutArea = (labelKey: string, floorL: Q<'ft'>, floorW: Q<'ft'>, run: Q<'ft'>): Q<'ft2'> => {
  const both = mul(`${labelKey}.bothSides`, TWO(), run, 'ft');
  const l = add(`${labelKey}.L`, floorL, both);
  const w = add(`${labelKey}.W`, floorW, both);
  return mul(`${labelKey}.area`, l, w, 'ft2');
};

export const batteredPrism = (
  floorL: Q<'ft'>, floorW: Q<'ft'>, depth: Q<'ft'>, slope: Q<'ratio'>,
): BatteredPrism => {
  const runTop = mul('solid.runTop', slope, depth, 'ft');
  const runMid = div('solid.runMid', runTop, TWO(), 'ft');

  const bothTop = mul('solid.top.bothSides', TWO(), runTop, 'ft');
  const topL = add('solid.topL', floorL, bothTop);
  const topW = add('solid.topW', floorW, bothTop);

  // Exact prismatoid (Simpson): V = D/6 · (A_floor + 4·A_mid + A_top). Exact for any
  // solid whose cross-section dimensions vary linearly with height — battered
  // rectangular cuts qualify; this is mathematics, not approximation.
  const aFloor = mul('solid.floorArea', floorL, floorW, 'ft2');
  const aMid = cutArea('solid.mid', floorL, floorW, runMid);
  const aTop = cutArea('solid.top', floorL, floorW, runTop);
  const weighted = sum('solid.prismatoidSum', [
    aFloor,
    mul('solid.midWeighted', FOUR(), aMid, 'ft2'),
    aTop,
  ], 'ft2');
  const hOver6 = div('solid.depthOverSix', depth, SIX(), 'ft');
  const volume = mul('solid.bankVolume', hOver6, weighted, 'ft3');

  return { kind: 'batteredPrism', floorL, floorW, depth, slope, topL, topW, volume };
};

/** Vertical-walled small prism (grenade sumps, platform reliefs). */
export const rectPrismVolume = (labelKey: string, L: Q<'ft'>, W: Q<'ft'>, D: Q<'ft'>): Q<'ft3'> =>
  mul(`${labelKey}.volume`, mul(`${labelKey}.floorArea`, L, W, 'ft2'), D, 'ft3');

/** Section profile of a battered prism across the front-to-back axis, as offsets from
 *  the floor-left corner at grade. Pure projection data — renderers draw these points
 *  and add nothing (numbers stay inside Q until display formatting). */
export interface SectionTrapezoid {
  readonly kind: 'sectionTrapezoid';
  readonly floorSpan: Q<'ft'>;
  readonly topSpan: Q<'ft'>;
  readonly depth: Q<'ft'>;
  readonly wallRun: Q<'ft'>;
}

export const sectionProfile = (p: BatteredPrism): SectionTrapezoid => ({
  kind: 'sectionTrapezoid',
  floorSpan: p.floorW,
  topSpan: p.topW,
  depth: p.depth,
  wallRun: mul('section.wallRun', p.slope, p.depth, 'ft'),
});

/** Plan outline (top opening) of a battered prism. */
export interface PlanRect {
  readonly kind: 'planRect';
  readonly L: Q<'ft'>;
  readonly W: Q<'ft'>;
  readonly floorL: Q<'ft'>;
  readonly floorW: Q<'ft'>;
}

export const planOutline = (p: BatteredPrism): PlanRect => ({
  kind: 'planRect', L: p.topL, W: p.topW, floorL: p.floorL, floorW: p.floorW,
});
