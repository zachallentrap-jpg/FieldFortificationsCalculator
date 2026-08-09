// G-3 — offline + data-never-leaves-device, lint-enforced (blueprint §4.6 +
// completeness patch 3): no external URL in any source file (xmlns namespace
// identifiers excepted — they are names, not fetches); network primitives banned
// outside src/sw/; root inventory — every top-level src dir must be claimed by a
// registered gate scope so no subtree can escape the gates the way v1's timber did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|css|html|json|svg)$/.test(name) ? [p] : [];
  });

test('G-3: zero external URLs in source (xmlns identifiers excepted)', () => {
  const offenders: string[] = [];
  for (const p of walk(SRC)) {
    const body = readFileSync(p, 'utf8');
    for (const m of body.matchAll(/https?:\/\/[^\s"'`)>]+/g)) {
      const url = m[0];
      if (url.startsWith('http://www.w3.org/')) continue; // XML namespace names
      offenders.push(`${relative(SRC, p)}: ${url}`);
    }
  }
  assert.deepEqual(offenders, [], `external URLs found:\n${offenders.join('\n')}`);
});

test('G-3: network primitives are banned outside src/sw/ (N2 is CI-enforced)', () => {
  const BANNED = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|navigator\.onLine)\s*[( .]/;
  const offenders: string[] = [];
  for (const p of walk(SRC)) {
    const rel = relative(SRC, p).replaceAll('\\', '/');
    if (rel.startsWith('sw/')) continue;
    const body = readFileSync(p, 'utf8');
    body.split('\n').forEach((lineText, i) => {
      if (BANNED.test(lineText) && !lineText.trimStart().startsWith('//')) {
        offenders.push(`${rel}:${i + 1}: ${lineText.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `network primitives outside src/sw/:\n${offenders.join('\n')}`);
});

test('G-3 root inventory: every top-level src dir is claimed by a gate scope', () => {
  // Claimed = named here with the gate that owns it. A new directory fails the build
  // until a gate claims it — subtrees cannot escape by existing quietly.
  const CLAIMED: Record<string, string> = {
    'engine': 'G-2/G-5/G-6/G-9',
    'schema': 'G-2/G-9/G-10',
    'render': 'G-4/G-8/G-9 (fmt lint)',
    'scene': 'G-5/G-14 (descriptor determinism)',
    'viewer': 'G-14 (browser suite; import-ban lint)',
    'state': 'G-9 (clock injection)',
    'fill': 'G-10 (fill workflow E2E)',
    'sw': 'G-12 (pure-function SW logic)',
    'ui': 'G-13/G-14 (happy-dom layer)',
  };
  const dirs = readdirSync(SRC).filter((n) => statSync(join(SRC, n)).isDirectory());
  for (const d of dirs) {
    assert.ok(CLAIMED[d], `unclaimed top-level src directory: src/${d} — register it with a gate before merging`);
  }
});
