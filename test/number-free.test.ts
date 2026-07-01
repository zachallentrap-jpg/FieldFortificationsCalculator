// §2.4 number-free engine — no bare doctrinal magnitude lives in the engine math; every
// dimension / multiplier / thickness / rate flows from doctrine/ via a Provenance `.value`.
// The gate scans the engine's formula modules for DECIMAL literals (the shape a doctrinal
// magnitude takes — feet, factors, thicknesses), allowing only structural constants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENGINE = fileURLToPath(new URL('../src/engine', import.meta.url));
const MODULES = ['compute', 'geometry', 'materials', 'labor', 'validate', 'explain', 'round', 'mission', 'plan'];

// Structural decimals that are NOT doctrinal magnitudes: 0.5 (a half / midpoint) and small
// rounding epsilons written in scientific notation (e.g. 1e-9).
const ALLOWED = new Set(['0.5']);

// Strip comments and string literals so only real numeric literals remain.
function stripNonCode(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

test('engine math modules contain no bare doctrinal magnitude (decimals must flow from doctrine)', () => {
  for (const name of MODULES) {
    const code = stripNonCode(readFileSync(ENGINE + '/' + name + '.ts', 'utf8'));
    // Plain decimals like 3.0, 1.25, 0.25 — but NOT scientific notation (1e-9 epsilons).
    const decimals = code.match(/(?<![eE\d.])\d+\.\d+(?![eE])/g) ?? [];
    for (const d of decimals) {
      assert.ok(ALLOWED.has(d), name + '.ts has a bare decimal literal ' + d + ' — source it from doctrine/');
    }
  }
});
