// SAP-1 service worker (§16). Cache-first with runtime caching so the app is fully offline
// after the first load — and it makes ZERO external requests (same-origin only). Not used by
// the single-file file:// artifact (SWs don't run from file://); that's the standalone's job.
// Plain JS on purpose: shipped verbatim from public/ so it registers at the app scope root.
const CACHE = 'sap1-v2';
const CORE = [
  './',
  './index.html',
  './hub.html',
  './woodframe.html',
  './assets/index.js',
  './assets/index.css',
  './assets/three-viewer.js',
  './assets/woodframe.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  // No .catch here on purpose: a failed precache (bad network, a missing CORE entry) must fail
  // install so the browser retries rather than activating a SW with an empty/partial cache.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
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
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
            }
            return res;
          })
          .catch(async () => {
            // Only navigations fall back to a full page; a failed asset request must surface as
            // a network error, not HTML served with a JS/CSS content type.
            if (e.request.mode !== 'navigate') return Response.error();
            const own = await caches.match(e.request, { ignoreSearch: true });
            return own || (await caches.match('./index.html')) || Response.error();
          }),
    ),
  );
});
