// Derivation trace (§10, §12). Pure — produces one Derivation per key output so the UI can
// open the formula, its operands, and which operands are PLACEHOLDER (with source). Built
// from the same Calc the numbers came from, so a derivation's result always equals the
// displayed value (asserted by the explain test). Never fabricates a thickness for an
// engineered roof (§2.7): that derivation reports result 0 with an explicit note.

import { parapet, overhead } from '../doctrine/protection';
import { sandbag, excavation, machine } from '../doctrine/materials';
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
    formula: 'max(setbackMin, setbackDepthFrac × depthOfCut)',
    operands: [
      op('setbackMin', overhead.setbackMin.value, 'ft', overhead.setbackMin),
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
    formula: 'frontage × frontToBack × depthOfCut',
    operands: [
      op('frontage', calc.holeL, 'ft', calc.position.hole.L),
      op('frontToBack', calc.holeW, 'ft', calc.position.hole.W),
      op('depthOfCut', calc.depthOfCut, 'ft'),
    ],
    result: calc.holeVol,
    unit: 'ft³',
  });

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

  d.push({
    key: 'parapetRing',
    label: 'Parapet volume',
    formula: '(outerL × outerW − holeL × holeW) × parapetHeight',
    operands: [
      op('outerL', calc.outerL, 'ft'),
      op('outerW', calc.outerW, 'ft'),
      op('parapetHeight', calc.parapetH, 'ft', parapet.H),
    ],
    result: calc.parapetRing,
    unit: 'ft³',
  });

  d.push({
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
  });

  if (calc.stringers > 0) {
    d.push({
      key: 'stringers',
      label: 'Overhead stringers',
      formula: 'ceil(frontToBack ÷ stringerSpacing) + 1',
      operands: [
        op('frontToBack', calc.holeW, 'ft', calc.position.hole.W),
        op('stringerSpacing', overhead.stringerSpacing.value, 'ft', overhead.stringerSpacing),
      ],
      result: calc.stringers,
      unit: 'ea',
    });
  }

  d.push({
    key: 'manHoursPerPosition',
    label: 'Man-hours per position',
    formula: 'base×dig×labor + spoil×perVol×machine + adders',
    operands: [
      op('baseMH', labor.baseMH.value, 'mh', labor.baseMH),
      op('digFactor', calc.soil.digFactor.value, '×', calc.soil.digFactor),
      op('laborMul', calc.standard.laborMul.value, '×', calc.standard.laborMul),
      op('excavBank', calc.excavBank, 'ft³'),
      op('perVolMH', labor.perVolMH.value, 'mh/ft³', labor.perVolMH),
      op('machineFactor', calc.inputs.machineAssist ? machine.excavationFactor.value : 1, '×', machine.excavationFactor),
    ],
    result: calc.mhPerPos,
    unit: 'mh',
  });

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
