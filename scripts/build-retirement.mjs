// v1 END-OF-LIFE deployment build (SAP2_BLUEPRINT §2.11, B44). Emits a dist/ that
// serves ONLY the retirement notice — the interactive v1 app (295 illustrative
// placeholder values behind a banner) is no longer served. Zero dependencies, zero
// external references. Includes a self-destructing sw.js at v1's registration path
// so previously-installed PWA copies drop their caches, unregister, and pick up
// this notice instead of the cached app.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
mkdirSync(DIST, { recursive: true });

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SAP-1 is retired</title>
<style>
  body { margin:0; font-family: system-ui, sans-serif; background:#1d1f21; color:#e8e6e1;
         display:grid; place-items:center; min-height:100vh; padding:24px; box-sizing:border-box; }
  main { max-width:640px; background:#26282b; border:1px solid #3a3d40; border-radius:12px; padding:32px; }
  h1 { margin:0 0 4px; font-size:26px; }
  .tag { display:inline-block; background:#b3261e; color:#fff; font-weight:700; font-size:12px;
         letter-spacing:.06em; padding:3px 10px; border-radius:6px; margin-bottom:18px; }
  p { line-height:1.55; font-size:15px; }
  strong { color:#fff; }
  .why { border-left:3px solid #b3261e; padding:2px 0 2px 14px; color:#c9c6bf; }
  code { background:#1a1c1e; padding:1px 6px; border-radius:4px; font-size:13px; }
  a { color:#e8b04b; }
  footer { margin-top:22px; font-size:13px; color:#8b8f94; }
</style>
</head>
<body>
<main>
  <span class="tag">RETIRED — DO NOT USE FOR PLANNING</span>
  <h1>SAP-1 has been taken down</h1>
  <p>The survivability position planner that lived at this address shipped with
  <strong>illustrative placeholder values</strong> — numbers that looked real but were
  not doctrine. Behind its warning banner, that is a hazard a screenshot or a crop
  could outlive, so the app has been retired rather than left running.</p>
  <p class="why">Its replacement, <strong>SAP-2</strong>, is being built the opposite way
  around: it <strong>ships empty</strong> — no doctrinal value exists anywhere in the
  software; every number must be entered, cited, verified, and formally commissioned
  by its operator on their own device, and every output is stamped with its data's
  provenance state.</p>
  <p>Source, documentation, and the SAP-2 blueprint:
  <a href="https://github.com/zachallentrap-jpg/FieldFortificationsCalculator">github.com/zachallentrap-jpg/FieldFortificationsCalculator</a></p>
  <footer>If this page replaced an installed copy on your device, its offline caches
  have been cleared automatically. Nothing on this page runs, computes, or collects
  anything.</footer>
</main>
</body>
</html>
`;

// Self-destructing service worker at v1's registration URL: clears every cache,
// unregisters, and reloads clients so installed copies converge on the notice.
const killerSw = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
`;

writeFileSync(`${DIST}/index.html`, page);
writeFileSync(`${DIST}/sw.js`, killerSw);
writeFileSync(`${DIST}/404.html`, page);
console.log('retirement page built: dist/index.html + cache-clearing sw.js');
