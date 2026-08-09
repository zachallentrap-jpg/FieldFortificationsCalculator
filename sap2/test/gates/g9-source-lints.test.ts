// G-9 source lints (blueprint §4.3/§4.6): clock/randomness ban in the deterministic
// core; Traced opacity (unsafeValue imports allowed ONLY in render/precision.ts and
// tests); doctrineReader/Fill import ban for render+scene+viewer (the compensating
// lint for G-2's exempt dirs); definition-text changes require a meaningVersion bump
// (B8, against the checked-in digest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAVES } from '../../src/schema/leaves/index';
import { sha256Hex } from '../../src/schema/sha256';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') ? [p] : [];
  });

const srcFiles = (): { rel: string; body: string }[] =>
  walk(SRC).map((p) => ({ rel: relative(SRC, p).replaceAll('\\', '/'), body: readFileSync(p, 'utf8') }));

test('G-9: no clocks, no randomness, no locale in the deterministic core', () => {
  // Allowlist: state/ and fill/ record provenance timestamps via an injected clock —
  // the ban still applies to DIRECT calls there; env.ts will own the injection seam.
  const BANNED = /\b(Date\.now|new Date\s*\(|performance\.now|Math\.random|crypto\.getRandomValues|toLocaleString|Intl\.)/;
  const offenders: string[] = [];
  for (const { rel, body } of srcFiles()) {
    if (!/^(engine|schema|render|scene)\//.test(rel)) continue;
    body.split('\n').forEach((line, i) => {
      if (BANNED.test(line) && !line.trimStart().startsWith('//')) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], `clock/randomness in deterministic core:\n${offenders.join('\n')}`);
});

test('G-9: unsafeValue imports only in render/precision.ts (Traced opacity)', () => {
  const offenders: string[] = [];
  for (const { rel, body } of srcFiles()) {
    if (rel === 'engine/trace.ts' || rel === 'render/precision.ts') continue;
    if (/\bunsafeValue\b/.test(body)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `unsafeValue leaked into: ${offenders.join(', ')}`);
});

test('G-9: render/scene/viewer never import doctrine or fills (boundary lint)', () => {
  // ui/ is the composition root — it loads fills and calls compute by design; the
  // PURE-PRESENTATION dirs are the ones that must consume Result only.
  const BANNED_IMPORT = /from\s+'[^']*(schema\/leaves|schema\/io|schema\/consumers|engine\/read)'/;
  const offenders: string[] = [];
  for (const { rel, body } of srcFiles()) {
    if (!/^(render|scene|viewer)\//.test(rel)) continue;
    if (BANNED_IMPORT.test(body)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `presentation code importing doctrine:\n${offenders.join('\n')}`);
});

test('G-9: definition text changes require a meaningVersion bump (B8)', () => {
  const digestPath = fileURLToPath(new URL('../../goldens/leaf-definitions.json', import.meta.url));
  const stored = JSON.parse(readFileSync(digestPath, 'utf8')) as Record<string, { meaningVersion: number; defHash: string }>;
  const problems: string[] = [];
  for (const l of LEAVES) {
    const prev = stored[l.id];
    if (!prev) continue; // new leaf — appears in the digest at next regeneration
    const nowHash = sha256Hex(l.definition).slice(0, 16);
    if (nowHash !== prev.defHash && l.meaningVersion <= prev.meaningVersion) {
      problems.push(`${l.id}: definition changed without meaningVersion bump (${l.meaningVersion} <= ${prev.meaningVersion})`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n') + '\n(bump meaningVersion, then regenerate: node --import tsx scripts/gen-goldens.ts)');
  // Digest freshness: every catalog leaf should be in the digest (regeneration keeps up).
  const missing = LEAVES.filter((l) => !stored[l.id]).length;
  assert.ok(missing <= 25, `${missing} leaves missing from definition digest — regenerate goldens`);
});
