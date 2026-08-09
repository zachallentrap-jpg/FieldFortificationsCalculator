// Engine skeleton (blueprint §4.3): volumes re-derived independently, exact stage
// partition, machine assist touching ONLY excavation-method stages (camo/roof
// machine-invariant — completeness patch 4), INV-1 engineered fail-safe at every fill
// state, cone derivation by observation, full-trace re-evaluation, and TEMPLATE-mode
// unfilled propagation with zero fabricated numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, resultComplete, type ComputeInputs } from '../src/engine/compute';
import { isFilled, isUnfilled, reevaluate, unsafeValue, type TraceNode, type Q } from '../src/engine/trace';
import { loadFill } from '../src/schema/io';
import { exportFill, type FillValue } from '../src/schema/fill';
import { generateFill, SCHEMA_HASH } from './fixtures/testFill';
import { holeId, standardMulId, wallSlopeId, digRateHandId, laborBaseId } from '../src/schema/leaves/index';
import type { NumericUnit } from '../src/schema/units';

const INPUTS: ComputeInputs = {
  position: 'one_man', threat: 'ind-mtr-81', soil: 'loam', standard: 'deliberate',
  revetment: 'sandbag_facing', coverMaterial: 'soil', machineAssist: false,
};

const loadTest = (over: Parameters<typeof generateFill>[0] = {}): FillValue => {
  const res = loadFill(exportFill(generateFill(over)), { expectedSchemaHash: SCHEMA_HASH, allowTestClass: true });
  assert.ok(res.ok, JSON.stringify(!res.ok && res.reasons));
  return res.fill;
};

const v = (q: Q<NumericUnit>): number => {
  assert.ok(isFilled(q), `expected filled, got unfilled: ${JSON.stringify(q)}`);
  return unsafeValue(q);
};

test('bank volume matches an independent prismatoid re-derivation', () => {
  const fill = loadTest();
  const r = compute(INPUTS, fill);
  const L = fill.numeric(holeId('one_man', 'L'))!;
  const W = fill.numeric(holeId('one_man', 'W'))!;
  const D = fill.numeric(holeId('one_man', 'D'))! * fill.numeric(standardMulId('deliberate', 'depth'))!;
  const s = fill.numeric(wallSlopeId('loam'))!;
  const area = (run: number): number => (L + 2 * run) * (W + 2 * run);
  const expected = (D / 6) * (area(0) + 4 * area((s * D) / 2) + area(s * D));
  assert.ok(Math.abs(v(r.solid.volume) - expected) < 1e-9, `${v(r.solid.volume)} vs ${expected}`);
  // Batter grows the opening: top dims exceed floor dims whenever slope > 0.
  if (s > 0) assert.ok(v(r.solid.topW) > W && v(r.solid.topL) > L);
});

test('stage man-hours partition the total EXACTLY (float-exact remainder assignment)', () => {
  const r = compute(INPUTS, loadTest());
  const sum = r.work.byStage.reduce((acc, s) => acc + v(s.manHours), 0);
  assert.equal(sum, v(r.work.totalManHours));
});

test('machine assist: camo/roof/revet stage labor is machine-invariant; dig moves to machine-hours', () => {
  const hand = compute(INPUTS, loadTest());
  const machine = compute({ ...INPUTS, machineAssist: true }, loadTest());
  const stage = (r: typeof hand, s: string) => r.work.byStage.find((x) => x.stage === s)!;

  for (const s of ['revet_sump', 'overhead', 'camo'] as const) {
    assert.equal(v(stage(machine, s).manHours), v(stage(hand, s).manHours), `${s} labor changed under machine assist`);
    assert.equal(stage(hand, s).machineHours, null);
    assert.equal(stage(machine, s).machineHours, null, `${s} gained machine hours — machine must touch excavation stages only`);
  }
  assert.equal(hand.work.totalMachineHours, null);
  assert.ok(machine.work.totalMachineHours !== null && v(machine.work.totalMachineHours) > 0);
  // Hand-dig man-hours leave the split stages under machine assist.
  assert.ok(v(machine.work.totalManHours) < v(hand.work.totalManHours));
});

test('INV-1: engineered-roof threats never yield a cover thickness, filled or not', () => {
  for (const fill of [loadTest(), null]) {
    const r = compute({ ...INPUTS, threat: 'at-rpg' }, fill);
    assert.equal(r.cover.kind, 'engineeredRoof');
    assert.ok(r.validation.some((i) => i.code === 'ENGINEERED_ROOF_REQUIRED' && i.severity === 'error'));
  }
});

test('every trace node in the Result re-evaluates to its stored value', () => {
  const r = compute(INPUTS, loadTest());
  let nodes = 0;
  const walk = (n: TraceNode): void => {
    nodes += 1;
    const stored = unsafeValue({ kind: 'filled', unit: n.unit, node: n });
    const recomputed = reevaluate(n);
    assert.ok(Math.abs(recomputed - stored) < 1e-12, `${n.labelKey}: ${recomputed} != ${stored}`);
    n.deps.forEach(walk);
  };
  const roots: Q<NumericUnit>[] = [
    r.solid.volume, r.work.totalManHours, r.work.looseVolume, r.work.totalSandbags,
    ...(r.cover.kind === 'earthCover' ? [r.cover.thickness] : []),
  ];
  for (const q of roots) if (isFilled(q)) walk(q.node);
  assert.ok(nodes > 40, `trace suspiciously small (${nodes} nodes)`);
});

test('TEMPLATE mode (null fill): everything unfilled, nothing fabricated, cone still derived', () => {
  const r = compute(INPUTS, null);
  assert.equal(r.fillIdentity, null);
  assert.ok(isUnfilled(r.solid.volume));
  assert.ok(isUnfilled(r.work.totalManHours));
  assert.equal(resultComplete(r), false);
  assert.ok(r.coneLeafIds.length > 20, 'cone derivation must work from reads, not values');
  assert.deepEqual(r.unfilledLeafIds, r.coneLeafIds, 'empty fill: every touched leaf is unfilled');
  assert.ok(r.validation.some((i) => i.code === 'DATA_INCOMPLETE'));
});

test('partial fill: unfilled union names exactly the missing leaves on affected outputs', () => {
  const r = compute(INPUTS, loadTest({ only: (id) => id !== digRateHandId('loam') && id !== laborBaseId('one_man') }));
  assert.ok(isUnfilled(r.work.totalManHours));
  if (isUnfilled(r.work.totalManHours)) {
    assert.deepEqual(r.work.totalManHours.blockedBy, [laborBaseId('one_man'), digRateHandId('loam')].sort());
  }
  // Geometry is independent of labor leaves — still filled.
  assert.ok(isFilled(r.solid.volume));
  assert.equal(resultComplete(r), false);
});

test('cone-derived coverage feeds the watermark machine consistently', () => {
  const fill = loadTest();
  const r = compute(INPUTS, fill);
  // Every cone leaf id is a real catalog id the fill can carry.
  for (const id of r.coneLeafIds) assert.ok(fill.has(id), `cone id not in complete fill: ${id}`);
});

test('soil forcing revetment with none selected is an error; unfilled flag reports incomplete', () => {
  // sand's flag index parity in the generator is deterministic; use override to be explicit.
  const forced = compute({ ...INPUTS, soil: 'sand', revetment: 'none' },
    loadTest({ override: { ['soil.sand.revetForced']: true } }));
  assert.ok(forced.validation.some((i) => i.code === 'REVET_FORCED_BY_SOIL' && i.severity === 'error'));

  const missingFlag = compute({ ...INPUTS, soil: 'sand', revetment: 'none' },
    loadTest({ only: (id) => id !== 'soil.sand.revetForced' }));
  assert.ok(missingFlag.validation.some((i) => i.code === 'DATA_INCOMPLETE' && i.blockedBy.includes('soil.sand.revetForced')));
});
