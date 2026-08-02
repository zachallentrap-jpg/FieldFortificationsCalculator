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
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SAP2 = join(ROOT, 'sap2');

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });

// 1. Hub + TIMBER-1 (SAP-1 excluded by config). Wipes dist/.
run('npx', ['vite', 'build', '-c', 'vite.suite.config.ts'], ROOT);

// 2. SAP-2 — installed and built in its own tree with its own pinned toolchain.
if (!existsSync(join(SAP2, 'node_modules'))) run('npm', ['ci'], SAP2);
run('npm', ['run', 'build'], SAP2);

// 3. Place SAP-2 under /survivability/ (its base is './', so it runs from any path).
const target = join(DIST, 'survivability');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(SAP2, 'dist'), target, { recursive: true });

// The single-file artifact is a download, not part of the hosted app — keep it out of
// the deployment (it is reachable from the repo/release instead).
rmSync(join(target, 'sap2-standalone.html'), { force: true });
rmSync(join(target, 'sap2-standalone.html.sha256'), { force: true });

// 4. Root lands on the hub.
const hub = join(DIST, 'hub.html');
if (!existsSync(hub)) throw new Error('hub.html missing from the suite build');
writeFileSync(join(DIST, 'index.html'), readFileSync(hub));

// 5. Retire v1's service worker at its old scope: clear every cache, unregister, and
//    reload clients so an installed v1 copy converges on the current toolkit.
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

console.log('suite built: hub at /, TIMBER-1 at /woodframe.html, SAP-2 at /survivability/');
