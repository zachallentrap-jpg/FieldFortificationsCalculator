// TIMBER-2 — the no-inline-doctrine-numbers gate (plan §6.6, I-16).
//
// A checklist item saying "put magnitudes in doctrine.ts" decays the first time someone is in
// a hurry. This scans the NEW generator surface for bare decimal literals and requires each
// file to import `./doctrine`. The repo already proves the pattern works — see
// `test/number-free.test.ts`, which does the same job for the SAP engine.
//
// Scope note: the FROZEN legacy modules (floor/walls/roof.ts) are deliberately NOT scanned.
// They are the C-10 frozen branch pinned byte-for-byte by the compat goldens; editing them to
// satisfy a lint rule is exactly the stop-the-line event the plan forbids. `doctrine.ts`
// mirrors their values instead, and `timber2-doctrine.test.ts` asserts the mirror is true.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/timber/', import.meta.url));

// Directories whose files are generators: they turn doctrine into members.
const SCANNED_DIRS = ['families', 'subsystems'];

// Numbers that are arithmetic, not doctrine — they mean the same thing in any manual.
const ALLOWED = new Set([
  '0', '1', '2', '0.5', '1.5', '3', '4', '12', '100', '360', '180',
  '1e-6', '1e-9', '1e-12',
]);

// Per-file exceptions live HERE, in the test, with a reason — never in a checklist.
const EXCEPTIONS: Record<string, string> = {
  // The wall contract restates the dressed 2x4 geometry it reads from DRESSED; the divisor
  // and the halving are arithmetic, and every size comes from types.ts.
  'subsystems/wallSystem.ts': 'geometry helper: sizes come from DRESSED, remaining literals are /2 and /12',
};

function scan(dir: string): string[] {
  const abs = join(SRC, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const f of readdirSync(abs)) {
    if (f.endsWith('.ts')) out.push(`${dir}/${f}`);
  }
  return out;
}

const FILES = SCANNED_DIRS.flatMap(scan);

test('the generator surface exists and is being scanned', () => {
  assert.ok(FILES.length >= 2, `expected generator modules to scan, found ${FILES.join(', ') || 'none'}`);
});

test('every generator module imports doctrine.ts (its magnitudes have one home)', () => {
  for (const rel of FILES) {
    if (EXCEPTIONS[rel]) continue;
    const src = readFileSync(join(SRC, rel), 'utf8');
    // An index/dispatch file that emits nothing needs no doctrine.
    const emits = /\bemit\w*\(|members\.push\(/.test(src);
    if (!emits) continue;
    assert.ok(
      /from '\.\.?\/doctrine'/.test(src),
      `${rel}: emits members but does not import ./doctrine — magnitudes must have one home`,
    );
  }
});

test('no bare doctrinal magnitudes inline in generators', () => {
  const offenders: string[] = [];
  for (const rel of FILES) {
    if (EXCEPTIONS[rel]) continue;
    // Strip block comments first (JSDoc headers explain the doctrine and cite section
    // numbers — scanning prose for magnitudes finds "§2.4" and calls it a magic number),
    // then line comments and string literals.
    const src = readFileSync(join(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
      for (const m of code.matchAll(/(?<![\w.])(\d+\.\d+|\d+)(?![\w.])/g)) {
        const lit = m[1]!;
        if (ALLOWED.has(lit)) continue;
        // Array indices and small ordinals read as arithmetic in context.
        if (/\[\s*$/.test(code.slice(0, m.index)) ) continue;
        offenders.push(`${rel}:${i + 1}  ${lit}  — ${line.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    'inline magnitudes found — move them to src/timber/doctrine.ts with a cite:\n  ' + offenders.join('\n  '),
  );
});

test('the frozen legacy branch is deliberately out of scope, and says so', () => {
  const scanned = new Set(FILES);
  for (const frozen of ['floor.ts', 'walls.ts', 'roof.ts']) {
    assert.ok(!scanned.has(frozen), `${frozen} is the frozen branch — scanning it would invite an edit`);
  }
  // And the reason is written where the next reader will look.
  const src = readFileSync(join(SRC, 'doctrine.ts'), 'utf8');
  assert.ok(/frozen/i.test(src) && /mirror/i.test(src), 'doctrine.ts must explain the mirror-vs-move decision');
});
