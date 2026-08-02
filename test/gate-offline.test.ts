// The offline gate's own guard.
//
// `scripts/check-offline.ts` is one of the load-bearing safety claims of this toolkit
// ("ships offline, zero external requests") and it had NO tests. It duly went quiet: in
// CI, `npm run verify` ran it on a fresh checkout before `build:suite` existed, so it
// scanned zero files and printed "(pass)". Four green check runs, guarantee unverified.
//
// These tests assert the two properties that keep that from recurring:
//   1. --require-dist FAILS when there is nothing to scan (both shapes: no directory,
//      and a directory with no scannable files).
//   2. The scanner still actually bites on a real external URL, and still tolerates the
//      W3C namespace identifiers that are names rather than fetches.
// If someone softens the strict path back into a pass, (1) goes red here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/check-offline.ts', import.meta.url));

function run(args: string[]): { code: number; out: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, ...args], {
    encoding: 'utf8',
  });
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

/** A scratch dir seeded with one file, returned as a --dir= target. */
function distWith(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'offline-gate-'));
  writeFileSync(join(dir, name), body);
  return dir;
}

test('gate: --require-dist fails when the directory does not exist', () => {
  const missing = join(tmpdir(), 'offline-gate-absent-nothing-here');
  const { code, out } = run([`--dir=${missing}`, '--require-dist']);
  assert.equal(code, 1, `expected failure, got exit ${code}:\n${out}`);
  assert.match(out, /FAIL/, 'a vacuous run must not report success');
});

test('gate: --require-dist fails when the directory holds no scannable files', () => {
  // The same vacuum wearing a different hat — dist/ exists, but the scan reads nothing.
  const dir = mkdtempSync(join(tmpdir(), 'offline-gate-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'model.glb'), 'binary-ish payload, not scanned');
  const { code, out } = run([`--dir=${dir}`, '--require-dist']);
  assert.equal(code, 1, `expected failure, got exit ${code}:\n${out}`);
  assert.match(out, /no scannable text files/);
});

test('gate: without --require-dist an empty scan is reported as SKIPPED, not a pass', () => {
  // Kept lenient for local ergonomics (`npm run verify` on a clean tree), but the wording
  // must never again let a no-op read as a verified guarantee.
  const missing = join(tmpdir(), 'offline-gate-absent-nothing-here');
  const { code, out } = run([`--dir=${missing}`]);
  assert.equal(code, 0, `lenient mode should not fail:\n${out}`);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /PASS/, 'a skip must not be labelled PASS');
});

test('gate: a real external URL in the built output still fails', () => {
  const dir = distWith('index.html', '<script src="https://cdn.example.com/three.js"></script>');
  const { code, out } = run([`--dir=${dir}`, '--require-dist']);
  assert.equal(code, 1, `the scanner stopped biting:\n${out}`);
  assert.match(out, /cdn\.example\.com/, 'the offending URL must be named');
});

test('gate: protocol-relative hosts still fail', () => {
  const dir = distWith('index.html', '<link href="//fonts.example.net/css" rel="stylesheet">');
  const { code, out } = run([`--dir=${dir}`, '--require-dist']);
  assert.equal(code, 1, `protocol-relative host slipped through:\n${out}`);
  assert.match(out, /fonts\.example\.net/);
});

test('gate: W3C namespace identifiers are names, not fetches — clean output passes', () => {
  const dir = distWith('icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  const { code, out } = run([`--dir=${dir}`, '--require-dist']);
  assert.equal(code, 0, `the xmlns allowlist regressed:\n${out}`);
  assert.match(out, /PASS — scanned 1 file\(s\)/);
});
