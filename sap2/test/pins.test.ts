// G-15 pin assertion, stood up from the first commit: every dependency version in
// sap2/package.json is an exact semver — no ranges, ever (blueprint §4.1, B43).
// v1's caret-range pattern does not carry into sap2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXACT = /^\d+\.\d+\.\d+$/;

test('every sap2 dependency is exact-pinned', () => {
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; engines?: Record<string, string> };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(Object.keys(all).length > 0, 'expected at least one dependency');
  for (const [name, version] of Object.entries(all)) {
    assert.match(version, EXACT, `${name} must be exact-pinned, got "${version}"`);
  }
  assert.match(pkg.engines?.node ?? '', EXACT, 'engines.node must be exact-pinned');
});

test('sap2 pins three to the same version as v1', () => {
  const sap2 = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { dependencies: Record<string, string> };
  const v1 = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
  ) as { dependencies?: Record<string, string> };
  const v1Three = (v1.dependencies?.['three'] ?? '').replace(/^[\^~]/, '');
  assert.equal(sap2.dependencies['three'], v1Three, 'viewer port stays mechanical only if three matches v1 exactly');
});
