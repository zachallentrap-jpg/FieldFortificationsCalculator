// G-5 — two-process determinism (blueprint §4.6): the probe runs in two ISOLATED
// node processes with fresh module graphs; identical bytes required. Same-process
// repeatability is a weaker claim the render tests already make — this catches
// module-load state, iteration-order, and environment leakage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROBE = fileURLToPath(new URL('../../scripts/determinism-probe.ts', import.meta.url));
const CWD = fileURLToPath(new URL('../..', import.meta.url));

const runProbe = (): string => {
  const out = spawnSync(process.execPath, ['--import', 'tsx', PROBE], {
    cwd: CWD, encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, TZ: 'UTC' },
  });
  assert.equal(out.status, 0, `probe failed: ${out.stderr}`);
  return out.stdout.trim();
};

test('G-5: two isolated processes produce byte-identical results and renders', () => {
  const a = runProbe();
  const b = runProbe();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b);
});
