// G-13 — perf budgets (blueprint §4.6): compute ≤ 16 ms median. Median of 21 runs
// keeps CI noise out; a budget gate that flakes gets loosened, and loosened gates
// rot (risk 11) — median is the anti-flake choice, the budget itself stays honest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../../src/engine/compute';
import { drawPlan } from '../../src/render/drawPlan';
import { drawSection } from '../../src/render/drawSection';
import { LIGHT } from '../../src/render/theme';
import { watermarkState } from '../../src/schema/watermark';
import { loadFill } from '../../src/schema/io';
import { exportFill } from '../../src/schema/fill';
import { generateFill, SCHEMA_HASH } from '../fixtures/testFill';
import { SENTINEL_INPUTS } from '../fixtures/sentinel';

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

test('G-13: compute ≤ 16 ms median; compute+2D render ≤ 40 ms median', () => {
  const res = loadFill(exportFill(generateFill()), { expectedSchemaHash: SCHEMA_HASH, allowTestClass: true });
  assert.ok(res.ok);
  const fill = res.fill;
  const ctx = {
    theme: LIGHT,
    watermark: watermarkState({
      fill, appSchemaHash: SCHEMA_HASH, missingLeafIds: [], artifactConeLeafIds: [],
      positionId: 'one_man', commissioning: null, revokedFillHashes: new Set(),
    }),
  } as const;

  const computeTimes: number[] = [];
  const fullTimes: number[] = [];
  for (let i = 0; i < 21; i++) {
    const t0 = performance.now();
    const r = compute(SENTINEL_INPUTS, fill);
    const t1 = performance.now();
    drawSection(r, ctx); drawPlan(r, ctx);
    const t2 = performance.now();
    computeTimes.push(t1 - t0);
    fullTimes.push(t2 - t0);
  }
  const mCompute = median(computeTimes);
  const mFull = median(fullTimes);
  console.log(`# G-13: compute median ${mCompute.toFixed(2)} ms, compute+render ${mFull.toFixed(2)} ms`);
  assert.ok(mCompute <= 16, `compute median ${mCompute.toFixed(2)} ms exceeds 16 ms budget`);
  assert.ok(mFull <= 40, `compute+render median ${mFull.toFixed(2)} ms exceeds 40 ms budget`);
});
