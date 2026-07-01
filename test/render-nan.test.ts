// §2.6 / §17 render.nan — no SVG attribute is ever NaN/undefined/Infinity, across a matrix
// of positions × threats × toggles. The svg.ts guard throws on non-finite, so "renders
// without throwing" AND "output carries no bad tokens" together prove the invariant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { drawPlan } from '../src/render/drawPlan';
import { drawSection } from '../src/render/drawSection';
import { drawIso } from '../src/render/drawIso';
import { positions } from '../src/doctrine/positions';
import { threats } from '../src/doctrine/protection';
import { defaultInputs } from './helpers';

const BAD = /NaN|Infinity|undefined/;

function assertClean(svg: string, ctx: string): void {
  assert.ok(!BAD.test(svg), 'bad numeric token in ' + ctx);
  assert.ok(svg.startsWith('<svg'), 'not an svg: ' + ctx);
}

test('every position × threat renders all three views with no non-finite values', () => {
  const posKeys = Object.keys(positions);
  const threatKeys = ['none', ...Object.keys(threats)];
  for (const positionType of posKeys) {
    for (const threat of threatKeys) {
      for (const overheadCover of [true, false]) {
        const r = compute(defaultInputs({ positionType, threat, overheadCover }));
        assertClean(drawPlan(r), positionType + '/' + threat + '/plan');
        assertClean(drawSection(r), positionType + '/' + threat + '/section');
        assertClean(drawIso(r), positionType + '/' + threat + '/iso');
      }
    }
  }
});

test('toggle-heavy and metric configs also render clean', () => {
  const combos = [
    defaultInputs({ sump: true, camouflage: true, firingStep: true, revetment: 'pickets_wire', unit: 'metric' }),
    defaultInputs({ positionType: 'mg_crew', machineAssist: true, revetment: 'timber_plywood' }),
    defaultInputs({ positionType: 'mortar_pit', sump: true, threat: 'at-rpg' }),
    defaultInputs({ count: 999, teamSize: 50, soil: 'rock' }),
  ];
  for (const inp of combos) {
    const r = compute(inp);
    assertClean(drawPlan(r), 'combo/plan');
    assertClean(drawSection(r), 'combo/section');
    assertClean(drawIso(r), 'combo/iso');
  }
});
