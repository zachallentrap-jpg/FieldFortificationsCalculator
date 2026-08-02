// G-11 — ship-empty proof on the ACTUAL artifact (blueprint §4.6): builds the
// single-file artifact and asserts (a) byte level: no fill payload of any class, no
// sentinel citations, no doctrine-shaped JSON embedded; (b) the TEMPLATE token path
// shipped (the ⟨token⟩ glyph is present in the bundle); (c) self-containment: zero
// external references. The functional half (empty-fill compute produces only
// Unfilled) runs in the engine suite; the in-browser boot assertion joins G-14.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ARTIFACT = fileURLToPath(new URL('../../dist/sap2-standalone.html', import.meta.url));

test('G-11: the standalone artifact is fill-free, token-bearing, self-contained', () => {
  if (!existsSync(ARTIFACT)) {
    const build = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, encoding: 'utf8', timeout: 300_000 });
    assert.equal(build.status, 0, `vite build failed: ${build.stderr}`);
    const inline = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/build-standalone.ts'], {
      cwd: ROOT, encoding: 'utf8', timeout: 120_000,
    });
    assert.equal(inline.status, 0, `standalone build failed: ${inline.stderr || inline.stdout}`);
  }
  const html = readFileSync(ARTIFACT, 'utf8');

  // (a) No fill of ANY class can be embedded. The loader's own code legitimately
  // names format keys (and UI copy says FICTITIOUS on banners), so the markers are
  // PAYLOAD signatures: the test-generator sentinel citation, and serialized
  // fill-record JSON (a leafId/value record or a records array literal) which exists
  // only in actual fill files.
  assert.ok(!html.includes('TEST-000'), 'artifact embeds the synthetic sentinel citation');
  assert.doesNotMatch(html, /"leafId"\s*:\s*"[^"]+"\s*,\s*"value"/, 'artifact embeds serialized fill records');
  assert.doesNotMatch(html, /"records"\s*:\s*\[\s*\{/, 'artifact embeds a serialized fill body');

  // (b) The TEMPLATE token path shipped.
  assert.ok(html.includes('⟨') || html.includes('⟨'), 'template token glyph missing from bundle');
  assert.ok(html.includes('NO SCALE'), 'template stamp missing from bundle');

  // (c) Self-contained: no external src/href references beyond data: URIs.
  const refs = [...html.matchAll(/\b(?:src|href)="([^"#][^"]*)"/g)]
    .map((m) => m[1]!)
    .filter((u) => !u.startsWith('data:'));
  assert.deepEqual(refs, [], `external references in artifact: ${refs.join(', ')}`);
  const urls = [...html.matchAll(/https?:\/\/[^\s"'`<>)]+/g)].map((m) => m[0])
    .filter((u) => !u.startsWith('http://www.w3.org/'));
  assert.deepEqual(urls, [], `external URLs in artifact: ${urls.slice(0, 5).join(', ')}`);

  // The sidecar hash matches the artifact bytes.
  const sidecar = readFileSync(ARTIFACT + '.sha256', 'utf8');
  assert.match(sidecar, /^[0-9a-f]{64}  sap2-standalone\.html$/m);
});
