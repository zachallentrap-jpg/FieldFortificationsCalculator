// compute(inputs, schema, fill) → Result — pure in ALL arguments (blueprint §2.1/N3):
// no ambient doctrine, no clocks, no module state. The fill's identity rides inside
// Result so renderers can only ever stamp artifacts with the data that actually
// produced them (D-DG-2), and the leaf ids TOUCHED during compute come back as the
// artifact's dependency cone — the watermark machine's per-position coverage (B6)
// derives from actual reads, not a hand-maintained list.

import type { RevetmentId, ShieldMaterial, SoilId, StandardId, ThreatId } from '../schema/ids';
import type { PositionId } from '../schema/ids';
import { POSITION_STRUCTURE, holeId, standardMulId, wallSlopeId, leafById } from '../schema/leaves/index';
import type { NumericLeaf } from '../schema/leaf';
import type { FillValue } from '../schema/fill';
import { EMPTY_FILL, resolve, type FillView } from './read';
import { batteredPrism, planOutline, sectionProfile, type BatteredPrism, type PlanRect, type SectionTrapezoid } from './solids';
import { resolveCover, type CoverResolution } from './cover';
import { computeWork, type WorkPlan } from './work';
import { validate, worstSeverity, type Severity, type ValidationItem } from './validate';
import { isUnfilled, mul, type Q } from './trace';

export interface ComputeInputs {
  readonly position: PositionId;
  readonly threat: ThreatId;
  readonly soil: SoilId;
  readonly standard: StandardId;
  readonly revetment: RevetmentId;
  readonly coverMaterial: ShieldMaterial;
  readonly machineAssist: boolean;
}

/** A drawable dimension: the quantity plus its display identity. Renderers consume
 *  THESE — they never look up leaves themselves (render imports Result only, which
 *  keeps the render-can't-reach-doctrine lint a one-line rule). `token` is the
 *  recruit-register name rendered inside ⟨angle tokens⟩ when the value is unfilled;
 *  `governing` distinguishes dimension-class on the drawing (§3.5). */
export interface DimSpec {
  readonly key: string;
  readonly token: string;
  readonly q: Q<'ft'>;
  readonly governing: boolean;
}

export interface Result {
  readonly inputs: ComputeInputs;
  /** Provenance identity of the data that produced every number below; null in
   *  TEMPLATE mode. Renderers stamp from HERE, never from ambient state. */
  readonly fillIdentity: { readonly cls: FillValue['cls']; readonly contentHash: string; readonly schemaHash: string } | null;
  readonly solid: BatteredPrism;
  readonly section: SectionTrapezoid;
  readonly plan: PlanRect;
  readonly dims: readonly DimSpec[];
  readonly positionLabel: string;
  readonly cover: CoverResolution;
  readonly work: WorkPlan;
  readonly validation: readonly ValidationItem[];
  readonly worst: Severity | null;
  /** Every leaf id compute actually read — the artifact dependency cone (B6). */
  readonly coneLeafIds: readonly string[];
  /** Cone leaves that resolved Unfilled (TEMPLATE/partial states). */
  readonly unfilledLeafIds: readonly string[];
}

/** Records every leaf id read through the door — cone derivation by observation. */
const recordingView = (inner: FillView): { view: FillView; touched: Set<string>; missing: Set<string> } => {
  const touched = new Set<string>();
  const missing = new Set<string>();
  const see = <T>(id: string, v: T | undefined): T | undefined => {
    touched.add(id);
    if (v === undefined) missing.add(id);
    return v;
  };
  return {
    view: {
      numeric: (id) => see(id, inner.numeric(id)),
      text: (id) => see(id, inner.text(id)),
      flag: (id) => see(id, inner.flag(id)),
    },
    touched, missing,
  };
};

const num = <U extends NumericLeaf['unit']>(id: string): NumericLeaf & { unit: U } =>
  leafById(id) as NumericLeaf & { unit: U };

export const compute = (inputs: ComputeInputs, fillValue: FillValue | null): Result => {
  const structure = POSITION_STRUCTURE.find((p) => p.id === inputs.position);
  if (!structure) throw new Error(`unknown position ${inputs.position}`);
  if (structure.volumeModel !== 'prism') {
    // R0 engine models the battered prism; cylinder/ramp builders land with their
    // positions (R4+/R7) on the same solid contract.
    throw new Error(`position ${inputs.position} needs the ${structure.volumeModel} model — not yet built (R0 scope: prism)`);
  }

  const { view, touched, missing } = recordingView(fillValue ?? EMPTY_FILL);

  // Geometry: floor dims with the standard's depth scaling and the soil's batter.
  const L = resolve(view, num<'ft'>(holeId(inputs.position, 'L')));
  const W = resolve(view, num<'ft'>(holeId(inputs.position, 'W')));
  const baseD = resolve(view, num<'ft'>(holeId(inputs.position, 'D')));
  const depthMul = resolve(view, num<'ratio'>(standardMulId(inputs.standard, 'depth')));
  const D = mul('geometry.depth', depthMul, baseD, 'ft');
  const slope = resolve(view, num<'ratio'>(wallSlopeId(inputs.soil)));

  const solid = batteredPrism(L, W, D, slope);
  const section = sectionProfile(solid);
  const plan = planOutline(solid);

  const cover = resolveCover(view, inputs.threat, inputs.coverMaterial, inputs.standard);

  const work = computeWork(view, {
    position: inputs.position, soil: inputs.soil, standard: inputs.standard,
    revetment: inputs.revetment, machineAssist: inputs.machineAssist,
  }, solid);

  const unfilledSoFar = [...missing].sort();
  const validation = validate(view, {
    position: inputs.position, soil: inputs.soil, revetment: inputs.revetment,
    cover, totalSandbags: work.totalSandbags, unfilledConeLeafIds: unfilledSoFar,
  });

  const plain = (id: string): string => leafById(id).plainName;
  const dims: readonly DimSpec[] = Object.freeze([
    { key: 'hole.L', token: plain(holeId(inputs.position, 'L')), q: L, governing: true },
    { key: 'hole.W', token: plain(holeId(inputs.position, 'W')), q: W, governing: true },
    { key: 'hole.D', token: plain(holeId(inputs.position, 'D')), q: D, governing: true },
    { key: 'top.L', token: 'top opening, front', q: solid.topL, governing: false },
    { key: 'top.W', token: 'top opening, back to front', q: solid.topW, governing: false },
  ]);

  return Object.freeze({
    inputs,
    fillIdentity: fillValue
      ? { cls: fillValue.cls, contentHash: fillValue.contentHash, schemaHash: fillValue.schemaHash }
      : null,
    solid, section, plan, dims,
    positionLabel: structure.label,
    cover, work,
    validation,
    worst: worstSeverity(validation),
    coneLeafIds: Object.freeze([...touched].sort()),
    unfilledLeafIds: Object.freeze([...missing].sort()),
  });
};

/** True when every load-bearing quantity resolved (no Unfilled anywhere a number
 *  should be) — the artifact-level "cone complete" check. */
export const resultComplete = (r: Result): boolean =>
  r.unfilledLeafIds.length === 0 &&
  !isUnfilled(r.solid.volume) &&
  !isUnfilled(r.work.totalManHours) &&
  (r.cover.kind !== 'earthCover' || !isUnfilled(r.cover.thickness));

export type { Q };
