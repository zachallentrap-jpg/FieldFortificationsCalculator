// Work model (blueprint §4.3, I9): BOM + labor, stage-first. Labor is the SOLE
// consumer of dig-rate leaves; machine assist means the excavation-method stages'
// effort divides by the machine rate instead of the hand rate — applied in exactly
// this one place, and camo/roof work never touches a rate leaf, so machine-invariance
// of those stages is structural (completeness patch 4). The stage partition is exact
// by remainder assignment (v1's one good invariant, kept): per-stage efforts sum to
// the total to the last bit.
//
// Modeling decisions carried in code (fidelity lines print them): the standard's
// laborMul scales BASE labor only; adders are flat; excavation effort scales with
// volume, which already scales through depthMul.

import { STAGE_ORDER, type RevetmentId, type SoilId, type StageId, type StandardId } from '../schema/ids';
import {
  EXCAVATION_SPLIT_IDS, LABOR_ADDER_IDS, MISC_MATERIAL_IDS, SANDBAG_IDS, SUMP_IDS,
  digRateHandId, digRateMachineId, laborBaseId, standardMulId, sumpCountId,
} from '../schema/leaves/index';
import { REVETMENT_STRUCTURE } from '../schema/leaves/materials';
import { leafById } from '../schema/leaves/index';
import type { NumericLeaf } from '../schema/leaf';
import type { PositionId } from '../schema/ids';
import type { FillView } from './read';
import { resolve } from './read';
import {
  add, div, mul, roundQ, scale, structuralQ, sub, sum,
  type Q, type Traced,
} from './trace';
import { rectPrismVolume, type BatteredPrism } from './solids';

const num = <U extends NumericLeaf['unit']>(id: string): NumericLeaf & { unit: U } => {
  const l = leafById(id);
  if (l.unit === 'text' || l.unit === 'flag') throw new Error(`${id} is not numeric`);
  return l as NumericLeaf & { unit: U };
};

export type BomUnit = 'ft3' | 'ft2' | 'ft' | 'ea';
export interface BomLine {
  readonly id: string;          // stable line id (stage assignment key)
  readonly label: string;       // registry plain label (cards reuse this — one source)
  readonly stage: StageId;      // each line lands on exactly ONE stage
  readonly unit: BomUnit;
  readonly quantity: Q<BomUnit>;
}

export interface StageEffort {
  readonly stage: StageId;
  readonly manHours: Q<'man_hours'>;
  readonly machineHours: Q<'machine_hours'> | null;
}

export interface WorkPlan {
  readonly bom: readonly BomLine[];
  readonly byStage: readonly StageEffort[];
  readonly totalManHours: Q<'man_hours'>;
  readonly totalMachineHours: Q<'machine_hours'> | null;
  readonly bankVolume: Q<'ft3'>;
  readonly looseVolume: Q<'ft3'>;
  readonly totalSandbags: Q<'ea'>;
}

export interface WorkInputs {
  readonly position: PositionId;
  readonly soil: SoilId;
  readonly standard: StandardId;
  readonly revetment: RevetmentId;
  readonly machineAssist: boolean;
}

const ONE_EA = (): Traced<'ea'> => structuralQ('AL-COUNT-1', 'const.oneEach', 'ea', 1);
const TWO_R = (): Traced<'ratio'> => structuralQ('AL-PERIM-2', 'const.two', 'ratio', 2);

/** The four excavation-method stages the machine can touch and their split leaves. */
const SPLIT_BY_STAGE: Partial<Record<StageId, string>> = {
  security: EXCAVATION_SPLIT_IDS.security,
  hasty: EXCAVATION_SPLIT_IDS.hasty,
  deliberate: EXCAVATION_SPLIT_IDS.deliberate,
  parapet: EXCAVATION_SPLIT_IDS.parapet,
};

/** Exact-partition a total effort across the split stages: every stage but the last
 *  takes share×total; the last takes total − Σ(previous), so the stage sum equals the
 *  total EXACTLY (float included), and the trace shows the remainder honestly. */
const partition = <U extends 'man_hours' | 'machine_hours'>(
  fill: FillView, total: Q<U>, unit: U,
): Partial<Record<StageId, Q<U>>> => {
  const stages = Object.keys(SPLIT_BY_STAGE) as StageId[];
  const out: Partial<Record<StageId, Q<U>>> = {};
  const priors: Q<U>[] = [];
  stages.forEach((s, i) => {
    if (i < stages.length - 1) {
      const share = resolve(fill, num<'ratio'>(SPLIT_BY_STAGE[s]!));
      const part = scale(`work.stage.${s}`, share, total);
      out[s] = part;
      priors.push(part);
    } else {
      out[s] = sub(`work.stage.${s}`, total, sum('work.stage.priorSum', priors, unit));
    }
  });
  return out;
};

export const computeWork = (fill: FillView, w: WorkInputs, solid: BatteredPrism): WorkPlan => {
  const bank = solid.volume;
  const swell = resolve(fill, num<'ratio'>(MISC_MATERIAL_IDS.swellFactor));
  const loose = mul('work.looseVolume', bank, swell, 'ft3');

  // ---- Excavation effort: hand OR machine for the split stages (exactly one). ----
  const handRate = resolve(fill, num<'ft3_per_man_hour'>(digRateHandId(w.soil)));
  const machineRate = resolve(fill, num<'ft3_per_machine_hour'>(digRateMachineId(w.soil)));
  const handExcavationMH = div('work.excavation.handMH', bank, handRate, 'man_hours');
  const machineExcavationH = div('work.excavation.machineH', bank, machineRate, 'machine_hours');

  const base = resolve(fill, num<'man_hours'>(laborBaseId(w.position)));
  const laborMul = resolve(fill, num<'ratio'>(standardMulId(w.standard, 'labor')));
  const scaledBase = mul('work.baseScaled', laborMul, base, 'man_hours');

  // Split-stage man-hour pool: base + hand excavation (hand mode), or base only
  // (machine mode — the digging itself is machine-hours, partitioned in parallel).
  const splitPoolMH = w.machineAssist ? scaledBase : add('work.splitPool', scaledBase, handExcavationMH);
  const mhByStage = partition(fill, splitPoolMH, 'man_hours');
  const machineByStage = w.machineAssist ? partition(fill, machineExcavationH, 'machine_hours') : null;

  // ---- Adders land on the stage that incurs them. ----
  const sumpCount = resolve(fill, num<'ea'>(sumpCountId(w.position)));
  const sumpAdderEach = resolve(fill, num<'man_hours'>(LABOR_ADDER_IDS.sump));
  const sumpAdder = mul('work.adder.sumps', sumpAdderEach, sumpCount, 'man_hours');

  const revetStructure = REVETMENT_STRUCTURE.find((r) => r.id === w.revetment);
  const revetted = revetStructure?.buildsFace === true;
  const revetAdder = revetted ? resolve(fill, num<'man_hours'>(LABOR_ADDER_IDS.revet)) : ZERO_MH();
  const overheadAdder = resolve(fill, num<'man_hours'>(LABOR_ADDER_IDS.overhead));
  const camoAdder = resolve(fill, num<'man_hours'>(LABOR_ADDER_IDS.camo));

  const stageMH = (s: StageId): Q<'man_hours'> => {
    const fromSplit = mhByStage[s] ?? ZERO_MH();
    switch (s) {
      case 'revet_sump': return sum('work.stage.revet_sump', [fromSplit, revetAdder, sumpAdder], 'man_hours');
      case 'overhead': return add('work.stage.overhead', fromSplit, overheadAdder);
      case 'camo': return add('work.stage.camo', fromSplit, camoAdder);
      default: return fromSplit;
    }
  };

  const byStage: StageEffort[] = STAGE_ORDER.map((s) => ({
    stage: s,
    manHours: stageMH(s),
    machineHours: machineByStage?.[s] ?? null,
  }));
  const totalManHours = sum('work.totalMH', byStage.map((s) => s.manHours), 'man_hours');
  const totalMachineHours = machineByStage
    ? sum('work.totalMachineH', byStage.map((s) => s.machineHours).filter((q): q is Q<'machine_hours'> => q !== null), 'machine_hours')
    : null;

  // ---- BOM ----
  const bagL = resolve(fill, num<'ft'>(SANDBAG_IDS.L));
  const bagH = resolve(fill, num<'ft'>(SANDBAG_IDS.H));
  const waste = resolve(fill, num<'ratio'>(SANDBAG_IDS.wasteFactor));
  const frontH = resolve(fill, num<'ft'>(SANDBAG_IDS.frontWallHeight));
  const inDepth = resolve(fill, num<'ea'>(SANDBAG_IDS.frontWallDepthCount));

  // Front retaining course: ceil(frontage/bagL) per course × in-depth count ×
  // ceil(courseHeight/bagH) courses, then waste, then round UP (fail-safe direction).
  const perCourse = roundQ('bom.frontWall.perCourse', div('bom.frontWall.alongFront', solid.topL, bagL, 'ratio'), 'up');
  const courses = roundQ('bom.frontWall.courses', div('bom.frontWall.courseCount', frontH, bagH, 'ratio'), 'up');
  const frontBagsExact = mul('bom.frontWall.beforeWaste',
    mul('bom.frontWall.rows', mul('bom.frontWall.perCourseDepth', perCourse, inDepth, 'ea'), courses, 'ea'),
    waste, 'ea');
  const frontBags = roundQ('bom.sandbags_front_wall', frontBagsExact, 'up');

  // Revetment sandbag facing: wall face area (floor perimeter × depth) in bags.
  const floorPerimeter = mul('bom.revet.perimeter', TWO_R(), add('bom.revet.LplusW', solid.floorL, solid.floorW), 'ft');
  const faceArea = mul('bom.revet.faceArea', floorPerimeter, solid.depth, 'ft2');
  const bagFace = mul('bom.revet.bagFace', bagL, bagH, 'ft2');
  const revetBags = w.revetment === 'sandbag_facing'
    ? roundQ('bom.sandbags_revet', mul('bom.revet.withWaste', mul('bom.revet.count', div('bom.revet.bagsExact', faceArea, bagFace, 'ratio'), ONE_EA(), 'ea'), waste, 'ea'), 'up')
    : ZERO_EA();

  // Pickets & wire.
  const picketSpacing = resolve(fill, num<'ft'>(MISC_MATERIAL_IDS.picketSpacing));
  const pickets = w.revetment === 'pickets_wire'
    ? roundQ('bom.pickets', mul('bom.pickets.count', div('bom.pickets.exact', floorPerimeter, picketSpacing, 'ratio'), ONE_EA(), 'ea'), 'up')
    : ZERO_EA();
  const wirePer = resolve(fill, num<'ft'>(MISC_MATERIAL_IDS.wirePerPicket));
  const wire = w.revetment === 'pickets_wire'
    ? mul('bom.revet_wire', wirePer, pickets, 'ft')
    : ZERO_FT();

  // Sumps.
  const sumpVol = rectPrismVolume('bom.sump', resolve(fill, num<'ft'>(SUMP_IDS.L)), resolve(fill, num<'ft'>(SUMP_IDS.W)), resolve(fill, num<'ft'>(SUMP_IDS.D)));
  void sumpVol; // (sump excavation volume joins the solids total at R2 detail pass)
  const gravelEach = resolve(fill, num<'ft3'>(SUMP_IDS.gravelFt3));
  const gravel = mul('bom.gravel_sump', gravelEach, sumpCount, 'ft3');

  // Camouflage net area over the top opening.
  const drape = resolve(fill, num<'ratio'>(MISC_MATERIAL_IDS.camoDrapeFactor));
  const netArea = mul('bom.camo_net', mul('bom.camo.footprint', solid.topL, solid.topW, 'ft2'), drape, 'ft2');

  const bom: BomLine[] = [
    { id: 'excavation_loose', label: 'dirt to move (loose)', stage: 'deliberate', unit: 'ft3', quantity: loose },
    { id: 'sandbags_front_wall', label: 'sandbags — firing rest', stage: 'parapet', unit: 'ea', quantity: frontBags },
    ...(w.revetment === 'sandbag_facing' ? [{ id: 'sandbags_revet', label: 'sandbags — wall facing', stage: 'revet_sump' as StageId, unit: 'ea' as BomUnit, quantity: revetBags }] : []),
    ...(w.revetment === 'pickets_wire' ? [
      { id: 'pickets', label: 'stakes (U-pickets)', stage: 'revet_sump' as StageId, unit: 'ea' as BomUnit, quantity: pickets },
      { id: 'revet_wire', label: 'tie wire', stage: 'revet_sump' as StageId, unit: 'ft' as BomUnit, quantity: wire },
    ] : []),
    { id: 'gravel_sump', label: 'gravel for sumps', stage: 'revet_sump', unit: 'ft3', quantity: gravel },
    { id: 'camo_net', label: 'camouflage net', stage: 'camo', unit: 'ft2', quantity: netArea },
  ];

  const totalSandbags = add('bom.totalSandbags', frontBags, revetBags);

  return {
    bom, byStage, totalManHours, totalMachineHours,
    bankVolume: bank, looseVolume: loose, totalSandbags,
  };
};

// Zero-quantity constants: engine-computed zeros (absent feature ⇒ zero of the unit),
// traced as structural identities.
const ZERO_MH = (): Q<'man_hours'> => structuralQ('AL-ZERO', 'const.zero', 'man_hours', 0);
const ZERO_EA = (): Q<'ea'> => structuralQ('AL-ZERO', 'const.zero', 'ea', 0);
const ZERO_FT = (): Q<'ft'> => structuralQ('AL-ZERO', 'const.zero', 'ft', 0);
