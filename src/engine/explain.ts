// Derivation trace (§10, §12). Pure — produces one Derivation per key output so the UI can
// open the formula, its operands, and which operands are PLACEHOLDER (with source). Built
// from the same Calc the numbers came from, so a derivation's result always equals the
// displayed value (asserted by the explain test). Never fabricates a thickness for an
// engineered roof (§2.7): that derivation reports result 0 with an explicit note.

import { parapet, berm, overhead } from '../doctrine/protection';
import { sandbag, excavation, machine, camo, sump as sumpMat } from '../doctrine/materials';
import { vehicleRamp } from '../doctrine/positions';
import { labor } from '../doctrine/labor';
import type { Provenance } from '../doctrine/types';
import type { Derivation } from './types';
import type { Calc } from './compute';

type Operand = Derivation['operands'][number];

function op(name: string, value: number, unit: string, leaf?: Provenance<unknown>): Operand {
  const o: Operand = { name, value, unit };
  if (leaf) {
    o.placeholder = leaf.status === 'PLACEHOLDER';
    o.source = leaf.source;
  }
  return o;
}

export function buildDerivations(calc: Calc): Derivation[] {
  const d: Derivation[] = [];

  d.push({
    key: 'depthOfCut',
    label: 'Depth of cut',
    formula: 'holeDepth × depthMultiplier',
    operands: [
      op('holeDepth', calc.holeD, 'ft', calc.position.hole.D),
      op('depthMultiplier', calc.standard.depthMul.value, '×', calc.standard.depthMul),
    ],
    result: calc.depthOfCut,
    unit: 'ft',
  });

  d.push({
    key: 'setback',
    label: 'Roof setback',
    formula: 'max(munitionStandoff, setbackDepthFrac × depthOfCut)',
    operands: [
      op('munitionStandoff', calc.standoffMin, 'ft', calc.standoffLeaf ?? overhead.setbackMin),
      op('setbackDepthFrac', overhead.setbackDepthFrac.value, '×', overhead.setbackDepthFrac),
      op('depthOfCut', calc.depthOfCut, 'ft'),
    ],
    result: calc.setback,
    unit: 'ft',
  });

  if (calc.roofPath === 'earth_on_stringers') {
    const operands: Operand[] = [op('coverMultiplier', calc.standard.coverMul.value, '×', calc.standard.coverMul)];
    if (calc.coverLeaf) operands.unshift(op('shieldingThickness', calc.coverLeaf.value, 'ft', calc.coverLeaf));
    d.push({
      key: 'coverThickness',
      label: 'Overhead-cover thickness',
      formula: 'shieldingThickness × coverMultiplier',
      operands,
      result: calc.coverT,
      unit: 'ft',
    });
  } else if (calc.coverOn) {
    d.push({
      key: 'coverThickness',
      label: 'Overhead-cover thickness',
      formula: 'engineered_required — no thickness estimated (§2.7)',
      operands: [],
      result: 0,
      unit: 'ft',
    });
  }

  d.push({
    key: 'holeVolume',
    label: 'Fighting-bay volume',
    formula: calc.isCircular ? 'π/4 × diameter × diameter × depthOfCut' : 'frontage × frontToBack × depthOfCut',
    operands: [
      op('frontage', calc.holeL, 'ft', calc.position.hole.L),
      op('frontToBack', calc.holeW, 'ft', calc.position.hole.W),
      op('depthOfCut', calc.depthOfCut, 'ft'),
    ],
    result: calc.holeVol,
    unit: 'ft³',
  });

  if (calc.rampVol > 0) {
    d.push({
      key: 'rampVolume',
      label: 'Access-ramp volume',
      formula: '0.5 × slopeRatio × depthOfCut² × rampWidth (ramp width = the narrow side of the cut)',
      operands: [
        op('slopeRatio', vehicleRamp.slopeRatio.value, '×', vehicleRamp.slopeRatio),
        op('depthOfCut', calc.depthOfCut, 'ft'),
        op('rampWidth', Math.min(calc.holeL, calc.holeW), 'ft', calc.holeL <= calc.holeW ? calc.position.hole.L : calc.position.hole.W),
      ],
      result: calc.rampVol,
      unit: 'ft³',
    });
  }

  d.push({
    key: 'excavLoose',
    label: 'Spoil to move (loose)',
    formula: '(bay + platform + sumps) × swellFactor',
    operands: [
      op('excavBank', calc.excavBank, 'ft³'),
      op('swellFactor', excavation.swellFactor.value, '×', excavation.swellFactor),
    ],
    result: calc.excavLoose,
    unit: 'ft³',
  });

  const ringFormula = (calc.isCircular ? 'π/4 × ' : '') + '(outerL × outerW − holeL × holeW) × ' + (calc.isVehicle ? 'bermHeight' : 'parapetHeight');
  d.push({
    key: 'parapetRing',
    label: calc.isVehicle ? 'Spoil-berm volume' : 'Parapet volume',
    formula: ringFormula,
    operands: [
      op('outerL', calc.outerL, 'ft'),
      op('outerW', calc.outerW, 'ft'),
      calc.isVehicle ? op('bermHeight', calc.parapetH, 'ft', berm.H) : op('parapetHeight', calc.parapetH, 'ft', parapet.H),
    ],
    result: calc.parapetRing,
    unit: 'ft³',
  });

  if (calc.bagsParapet > 0) {
    // An EARTH parapet's mass is spoil (see the Parapet-volume row); its only bags are the
    // firing-rest course at the aperture. A SANDBAG parapet (bunker) still bills the full ring.
    d.push(
      calc.parapetMode === 'sandbag'
        ? {
            key: 'sandbagsParapet',
            label: 'Sandbags — parapet',
            formula: 'ceil(parapetVolume ÷ bagVolume × wasteFactor)',
            operands: [
              op('parapetVolume', calc.parapetRing, 'ft³'),
              op('bagVolume', calc.bagVol, 'ft³', sandbag.L),
              op('wasteFactor', calc.waste, '×', sandbag.wasteFactor),
            ],
            result: calc.bagsParapet,
            unit: 'ea',
          }
        : {
            key: 'sandbagsParapet',
            label: 'Sandbags — firing rest',
            formula: 'ceil(restsPerPosition × bagsPerRest × wasteFactor)',
            operands: [
              op('bagsPerRest', sandbag.bagsPerRest.value, 'ea', sandbag.bagsPerRest),
              op('wasteFactor', calc.waste, '×', sandbag.wasteFactor),
            ],
            result: calc.bagsParapet,
            unit: 'ea',
          },
    );
  }

  if (calc.bermFill > 0) {
    d.push({
      key: 'bermFill',
      label: 'Spoil berm — dozed fill',
      formula: 'bermRingVolume (dozed from the position’s own spoil)',
      operands: [
        op('bermRingVolume', calc.parapetRing, 'ft³'),
        op('bermThickness', calc.parapetW, 'ft', berm.W),
        op('bermHeight', calc.parapetH, 'ft', berm.H),
      ],
      result: calc.bermFill,
      unit: 'ft³',
    });
  }

  if (calc.bagsCover > 0) {
    d.push({
      key: 'sandbagsCover',
      label: 'Sandbags — overhead cover',
      formula: 'ceil(coverVolume ÷ bagVolume × wasteFactor)',
      operands: [
        op('coverVolume', calc.coverVol, 'ft³'),
        op('bagVolume', calc.bagVol, 'ft³', sandbag.L),
        op('wasteFactor', calc.waste, '×', sandbag.wasteFactor),
      ],
      result: calc.bagsCover,
      unit: 'ea',
    });
  }

  if (calc.coverFill > 0) {
    d.push({
      key: 'coverSoilFill',
      label: 'Overhead cover — fill volume',
      formula: 'coverL × coverW × coverThickness',
      operands: [
        op('coverL', calc.coverL, 'ft', overhead.bearingEachEnd),
        op('coverW', calc.coverW, 'ft', overhead.bearingEachEnd),
        op('coverThickness', calc.coverT, 'ft', calc.coverLeaf),
      ],
      result: calc.coverFill,
      unit: 'ft³',
    });
  }

  if (calc.bagsRevet > 0) {
    d.push({
      key: 'sandbagsRevet',
      label: 'Sandbags — revetment face',
      formula: 'ceil(faceArea × bagWidth ÷ bagVolume × wasteFactor)',
      operands: [
        op('faceArea', calc.faceArea, 'ft²'),
        op('bagWidth', sandbag.W.value, 'ft', sandbag.W),
        op('bagVolume', calc.bagVol, 'ft³', sandbag.L),
        op('wasteFactor', calc.waste, '×', sandbag.wasteFactor),
      ],
      result: calc.bagsRevet,
      unit: 'ea',
    });
  }

  if (calc.revet.kind === 'panel' && calc.faceArea > 0) {
    d.push({
      key: 'revetPanels',
      label: calc.revet.label + ' — facing area',
      formula: 'perimeter × depthOfCut',
      operands: [op('perimeter', calc.perimeter, 'ft'), op('depthOfCut', calc.depthOfCut, 'ft')],
      result: calc.faceArea,
      unit: 'ft²',
    });
  }

  if (calc.pickets > 0) {
    d.push({
      key: 'pickets',
      label: 'U-pickets',
      formula: 'ceil(perimeter ÷ picketSpacing)',
      operands: [
        op('perimeter', calc.perimeter, 'ft'),
        op('picketSpacing', calc.revet.spacing?.value ?? overhead.stringerSpacing.value, 'ft', calc.revet.spacing ?? overhead.stringerSpacing),
      ],
      result: calc.pickets,
      unit: 'ea',
    });
  }

  if (calc.wireFt > 0 && calc.revet.wirePerPicket) {
    d.push({
      key: 'revetWire',
      label: 'Tie wire',
      formula: 'pickets × wirePerPicket',
      operands: [
        op('pickets', calc.pickets, 'ea'),
        op('wirePerPicket', calc.revet.wirePerPicket.value, 'ft', calc.revet.wirePerPicket),
      ],
      result: calc.wireFt,
      unit: 'ft',
    });
  }

  if (calc.gravelVol > 0) {
    d.push({
      key: 'gravelSump',
      label: 'Sump gravel',
      formula: 'sumpCount × gravelPerSump',
      operands: [
        op('sumpCount', calc.sumpCount, 'ea'),
        op('gravelPerSump', sumpMat.gravelFt3.value, 'ft³', sumpMat.gravelFt3),
      ],
      result: calc.gravelVol,
      unit: 'ft³',
    });
  }

  if (calc.camoArea > 0) {
    d.push({
      key: 'camoNet',
      label: 'Camouflage net',
      formula: 'ceil(outerL × outerW × drapeFactor)',
      operands: [
        op('outerL', calc.outerL, 'ft'),
        op('outerW', calc.outerW, 'ft'),
        op('drapeFactor', camo.drapeFactor.value, '×', camo.drapeFactor),
      ],
      result: calc.camoArea,
      unit: 'ft²',
    });
  }

  if (calc.radHalvingLayers > 0 && calc.radHalvingLeaf) {
    d.push({
      key: 'radiationLayers',
      label: 'Fallout attenuation (halving-layers)',
      formula: 'coverThickness ÷ halvingThickness',
      operands: [
        op('coverThickness', calc.coverT, 'ft', calc.coverLeaf),
        op('halvingThickness', calc.radHalvingLeaf.value, 'ft', calc.radHalvingLeaf),
      ],
      result: calc.radHalvingLayers,
      unit: '× halved',
    });
  }

  if (calc.stringers > 0) {
    d.push({
      key: 'stringers',
      label: 'Overhead stringers' + (calc.stringerSize && calc.stringerSize !== 'engineered' ? ' (' + calc.stringerSize + ')' : ''),
      formula: 'ceil(longAxis ÷ stringerSpacing) + 1 — stringers span the SHORT axis, laid out along the long one',
      operands: [
        op('longAxis', Math.max(calc.holeL, calc.holeW), 'ft', calc.holeL >= calc.holeW ? calc.position.hole.L : calc.position.hole.W),
        op('stringerSpacing', overhead.stringerSpacing.value, 'ft', overhead.stringerSpacing),
        op('clearSpan', calc.stringerSpan, 'ft'),
      ],
      result: calc.stringers,
      unit: 'ea',
    });
  }

  // Labor adders are OPERANDS, not a vague '+ adders' — every term the formula mentions is
  // itemized so the trace never dead-ends (only active adders are listed).
  const adderOps: Operand[] = [];
  if (calc.coverOn && calc.roofPath === 'earth_on_stringers') adderOps.push(op('overheadAdd', labor.overheadAdd.value, 'mh', labor.overheadAdd));
  if (calc.revet.buildsFace) adderOps.push(op('revetAdd', labor.revetAdd.value, 'mh', labor.revetAdd));
  if (calc.sumpCount > 0) adderOps.push(op('sumpAdd', labor.sumpAdd.value, 'mh', labor.sumpAdd));
  if (calc.inputs.camouflage) adderOps.push(op('camoAdd', labor.camoAdd.value, 'mh', labor.camoAdd));
  d.push({
    key: 'manHoursPerPosition',
    label: 'Man-hours per position',
    formula: 'base×dig×labor + spoil×perVol×machine' + (adderOps.length ? ' + ' + adderOps.map((o) => o.name).join(' + ') : ''),
    operands: [
      op('baseMH', labor.baseMH.value, 'mh', labor.baseMH),
      op('digFactor', calc.soil.digFactor.value, '×', calc.soil.digFactor),
      op('laborMul', calc.standard.laborMul.value, '×', calc.standard.laborMul),
      op('excavBank', calc.excavBank, 'ft³'),
      op('perVolMH', labor.perVolMH.value, 'mh/ft³', labor.perVolMH),
      op('machineFactor', calc.inputs.machineAssist ? machine.excavationFactor.value : 1, '×', machine.excavationFactor),
      ...adderOps,
    ],
    result: calc.mhPerPos,
    unit: 'mh',
  });

  if (calc.machineHrsPerPos > 0) {
    d.push({
      key: 'machineHours',
      label: 'Machine (blade) hours per position',
      formula: 'excavBank × machinePerVolMH',
      operands: [
        op('excavBank', calc.excavBank, 'ft³'),
        op('machinePerVolMH', labor.machinePerVolMH.value, 'machine-hours/ft³', labor.machinePerVolMH),
      ],
      result: calc.machineHrsPerPos,
      unit: 'hr',
    });
  }

  d.push({
    key: 'manHoursTotal',
    label: 'Man-hours total',
    formula: 'manHoursPerPosition × count',
    operands: [op('manHoursPerPosition', calc.mhPerPos, 'mh'), op('count', calc.count, 'ea')],
    result: calc.mhTotal,
    unit: 'mh',
  });

  d.push({
    key: 'elapsed',
    label: 'Elapsed hours',
    formula: 'manHoursTotal ÷ teamSize',
    operands: [op('manHoursTotal', calc.mhTotal, 'mh'), op('teamSize', calc.teamSize, 'ea')],
    result: calc.elapsed,
    unit: 'hr',
  });

  return d;
}
