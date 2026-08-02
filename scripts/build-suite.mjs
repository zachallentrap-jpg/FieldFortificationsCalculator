// Assembles the deployed 1371 Combat Engineer Toolkit.
//
//   dist/index.html          the hub (root URL lands on the toolkit, never inside a tool)
//   dist/hub.html            same page at its own name (sub-app back links target it)
//   dist/woodframe.html      TIMBER-1
//   dist/survivability/      SAP-2 (its own assets + service worker, scoped to itself)
//   dist/sw.js               cache-killer: unregisters v1's service worker and drops
//                            every cache, so installed v1 copies stop serving the
//                            retired app with its placeholder values
//
// SAP-1 is not built and not shipped (see vite.suite.config.ts).
//
// Deploy-environment notes: every step logs a banner and resolves its binary through
// node_modules/.bin rather than `npx` (npx can try to FETCH a missing package, which
// fails closed in a sandboxed build). Failures re-throw with the step named, so the
// deployment log says which step died instead of just "build command error".
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SAP2 = join(ROOT, 'sap2');

const step = (name, fn) => {
  console.log(`\n=== build-suite: ${name} ===`);
  try {
    fn();
  } catch (err) {
    console.error(`build-suite FAILED at step: ${name}`);
    throw err;
  }
};

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });

/** Resolve a locally installed CLI without npx (no network, no prompt). */
const localBin = (pkgDir, name) => {
  const bin = join(pkgDir, 'node_modules', '.bin', name);
  if (!existsSync(bin)) throw new Error(`${name} not found at ${bin} — did npm ci run in ${pkgDir}?`);
  return bin;
};

step('hub + TIMBER-1 (SAP-1 excluded by config)', () => {
  run(localBin(ROOT, 'vite'), ['build', '-c', 'vite.suite.config.ts'], ROOT);
});

step('install SAP-2 dependencies', () => {
  if (existsSync(join(SAP2, 'node_modules', 'vite'))) {
    console.log('sap2/node_modules present — skipping install');
    return;
  }
  try {
    run('npm', ['ci', '--no-audit', '--no-fund'], SAP2);
  } catch {
    // A lockfile/engine hiccup in a deploy sandbox should not sink the build when a
    // plain install would succeed.
    console.warn('npm ci failed in sap2 — retrying with npm install');
    run('npm', ['install', '--no-audit', '--no-fund'], SAP2);
  }
});

step('build SAP-2 (hosted app only)', () => {
  // build:app skips the single-file artifact — it is a separate download, and this
  // script deletes it below anyway, so building it here is cost and failure surface.
  run('npm', ['run', 'build:app'], SAP2);
});

step('assemble dist/', () => {
  const target = join(DIST, 'survivability');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(join(SAP2, 'dist'), target, { recursive: true });
  rmSync(join(target, 'sap2-standalone.html'), { force: true });
  rmSync(join(target, 'sap2-standalone.html.sha256'), { force: true });

  const hub = join(DIST, 'hub.html');
  if (!existsSync(hub)) throw new Error('hub.html missing from the suite build');
  writeFileSync(join(DIST, 'index.html'), readFileSync(hub));

  // Retire v1's service worker at its old scope: clear every cache, unregister, and
  // reload clients so an installed v1 copy converges on the current toolkit.
  writeFileSync(
    join(DIST, 'sw.js'),
    `// v1 service worker retired — see docs/SAP2_BLUEPRINT.md §2.11.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith('sap2-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
`,
  );
});

console.log('\nsuite built: hub at /, TIMBER-1 at /woodframe.html, SAP-2 at /survivability/');
