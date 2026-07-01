// §2.3 / §17 offline — the deterministic core makes NO network calls and carries no external
// URL. (The built bundle is separately checked by scripts/check-offline.ts as a build gate.)
// W3C XML/SVG namespace URIs are allowed — they are identifiers, never dereferenced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const PURE_DIRS = ['engine', 'render', 'state', 'doctrine', 'layout', 'theme'];

const NETWORK = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|sendBeacon|EventSource/;
const EXTERNAL_URL = /https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+/i;

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('pure layers issue no network calls and reference no external host', () => {
  for (const d of PURE_DIRS) {
    for (const file of tsFiles(join(SRC, d))) {
      const src = readFileSync(file, 'utf8');
      const rel = file.replace(SRC, 'src');
      assert.ok(!NETWORK.test(src), rel + ' contains a network primitive');
      assert.ok(!EXTERNAL_URL.test(src), rel + ' references an external URL');
    }
  }
});
