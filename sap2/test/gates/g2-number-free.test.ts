// G-2 — the number-free gate as an AST LINT, not a grep (blueprint §4.6). Scope:
// src/engine/** and src/schema/** excluding the two places numbers are LEGAL:
// schema/allowlist.ts (the one magnitude allowlist) and schema/leaves/** (catalog
// structure — bounds/precision/tolerances — owned and audited by G-9's looseness and
// decision-ref checks). Rules:
//   R1: a literal in the VALUE argument of leafQ/inputQ is always a violation —
//       constants entering the trace must go through structuralQ.
//   R2: a structuralQ literal must match its named allowlist entry exactly.
//   R3: any other literal that is fractional or |v| >= 3 must appear in the explicit
//       per-file STRUCTURAL_BUDGET below (reviewed, diff-visible — no inline waivers,
//       nothing evadable from inside the linted file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { MAGNITUDE_ALLOWLIST } from '../../src/schema/allowlist';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

// Reviewed structural numerics OUTSIDE the allowlist/catalog (file → allowed values).
// Every entry is a deliberate, non-doctrinal constant; additions show up in diff review.
const STRUCTURAL_BUDGET: Readonly<Record<string, readonly number[]>> = {
  'schema/io.ts': [2, 1024, 0.5, 10, 1e-12, 140, 64, 12],  // size cap math, half-ULP rule, phrase length, hash length, hash-prefix display
  'schema/sha256.ts': [], // covered by the wide integer exemption below (bit constants)
  'schema/canon.ts': [],
  'schema/fill.ts': [],
};

// sha256.ts is FIPS constant tables and bit arithmetic — integers there are exempt
// wholesale (the file implements a published standard, asserted against NIST vectors).
const INTEGER_TABLE_FILES = new Set(['schema/sha256.ts']);

const walkFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walkFiles(p);
    return p.endsWith('.ts') ? [p] : [];
  });

const inScope = (rel: string): boolean =>
  (rel.startsWith('engine/') || rel.startsWith('schema/')) &&
  rel !== 'schema/allowlist.ts' &&
  !rel.startsWith('schema/leaves/');

interface Violation { file: string; line: number; value: number; rule: string }

const lintFile = (path: string, rel: string): Violation[] => {
  const out: Violation[] = [];
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.ES2022, true);
  const allowByRef = new Map(MAGNITUDE_ALLOWLIST.map((e) => [e.ref, e.value]));
  const budget = new Set(STRUCTURAL_BUDGET[rel] ?? []);
  const integerTable = INTEGER_TABLE_FILES.has(rel);

  const numericValue = (n: ts.Node): number | null => {
    if (ts.isNumericLiteral(n)) return Number(n.text);
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) {
      return -Number(n.operand.text);
    }
    return null;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = node.expression.text;
      if (fn === 'leafQ' || fn === 'inputQ') {
        const valueArg = node.arguments[3];
        if (valueArg && numericValue(valueArg) !== null) {
          out.push({ file: rel, line: line(sf, valueArg), value: numericValue(valueArg)!, rule: 'R1: literal into trace source — use structuralQ' });
        }
      }
      if (fn === 'structuralQ') {
        const [refArg, , , valueArg] = node.arguments;
        const v = valueArg ? numericValue(valueArg) : null;
        const ref = refArg && ts.isStringLiteral(refArg) ? refArg.text : null;
        if (v !== null) {
          const allowed = ref !== null ? allowByRef.get(ref) : undefined;
          if (allowed === undefined || allowed !== v) {
            out.push({ file: rel, line: line(sf, node), value: v, rule: `R2: structuralQ('${ref ?? '?'}') value not in allowlist` });
          }
          // The matched literal is legal; skip generic R3 on it.
          node.forEachChild((c) => { if (c !== valueArg) visit(c); });
          return;
        }
      }
    }
    const v = numericValue(node);
    if (v !== null && !(ts.isPrefixUnaryExpression(node.parent) && numericValue(node.parent) !== null)) {
      const structural = Number.isInteger(v) && Math.abs(v) <= 2;
      const exempt = integerTable && Number.isInteger(v);
      if (!structural && !exempt && !budget.has(v)) {
        out.push({ file: rel, line: line(sf, node), value: v, rule: 'R3: magnitude-shaped literal outside budget/allowlist' });
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return out;
};

const line = (sf: ts.SourceFile, n: ts.Node): number =>
  sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

test('G-2: no magnitude-shaped literal in engine/ or schema/ outside the allowlist', () => {
  const files = walkFiles(SRC)
    .map((p) => ({ p, rel: relative(SRC, p).replaceAll('\\', '/') }))
    .filter(({ rel }) => inScope(rel));
  assert.ok(files.length >= 10, 'gate scope suspiciously small');
  const violations = files.flatMap(({ p, rel }) => lintFile(p, rel));
  assert.deepEqual(
    violations, [],
    'G-2 violations:\n' + violations.map((v) => `  ${v.file}:${v.line} value ${v.value} — ${v.rule}`).join('\n'),
  );
});

test('G-2 second belt: allowlist diffs are visible (entry count printed)', () => {
  console.log(`# magnitude allowlist: ${MAGNITUDE_ALLOWLIST.length} entries: ${MAGNITUDE_ALLOWLIST.map((e) => `${e.ref}=${e.value}`).join(', ')}`);
  for (const e of MAGNITUDE_ALLOWLIST) {
    assert.ok(e.decisionRef.length > 0 && e.rationale.length > 0, `${e.ref}: allowlist entry without decision/rationale`);
    assert.ok(!e.module.includes('doctrine'), `${e.ref}: allowlist entries may not point into doctrine paths`);
  }
});
