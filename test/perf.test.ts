// §13 / §17 perf — a single compute must stay well under the 16 ms frame budget on mid
// hardware. Averaged over many iterations across representative fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { compute } from '../src/engine/compute';
import { FIXTURES } from './helpers';

test('mean compute time is under the 16 ms budget', () => {
  // Warm up (JIT).
  for (let i = 0; i < 100; i++) compute(FIXTURES[i % FIXTURES.length]!);
  const N = 1000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) compute(FIXTURES[i % FIXTURES.length]!);
  const mean = (performance.now() - t0) / N;
  assert.ok(mean < 16, 'mean compute ' + mean.toFixed(3) + ' ms exceeds the 16 ms budget');
});
