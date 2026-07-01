// SAP-1 service worker (§16). Cache-first with runtime caching so the app is fully offline
// after the first load — and it makes ZERO external requests (same-origin only). Not used by
// the single-file file:// artifact (SWs don't run from file://); that's the standalone's job.
// Plain JS on purpose: shipped verbatim from public/ so it registers at the app scope root.
const CACHE = 'sap1-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (there are none)
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
            return res;
          })
          .catch(() => caches.match('./index.html')),
    ),
  );
});
