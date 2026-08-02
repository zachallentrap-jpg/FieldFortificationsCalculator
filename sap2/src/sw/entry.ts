// The service-worker shim: event wiring only — every decision comes from
// src/sw/logic.ts (node-tested). Built to dist/sw.js by scripts/build-sw.ts, which
// injects the precache list and the version stamp computed from the built assets.
//
// Update model (the owner's chosen workflow): a new deployment produces a different
// version stamp, so this file's bytes differ, so the browser installs the new worker
// and parks it in `waiting`. The app then shows an UPDATE button; clicking it posts
// SKIP_WAITING and reloads. Nothing updates behind the user's back.

import { cacheNameFor, cachesToDelete, isAlwaysRevalidated, isCacheable, isNavigation, parseMessage } from './logic';

declare const __SW_VERSION__: string;
declare const __SW_PRECACHE__: readonly string[];

// Minimal local typings for the worker globals we use. The "WebWorker" lib cannot be
// enabled alongside "DOM" in one tsconfig, and a second tsconfig for four interfaces
// is more machinery than the problem deserves.
interface ExtendableEvt { waitUntil(p: Promise<unknown>): void }
interface FetchEvt extends ExtendableEvt {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): void;
}
interface MessageEvt extends ExtendableEvt {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
}
interface SwScope {
  readonly location: { readonly origin: string };
  readonly clients: { claim(): Promise<void>; matchAll(o?: unknown): Promise<unknown[]> };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', fn: (e: ExtendableEvt) => void): void;
  addEventListener(type: 'fetch', fn: (e: FetchEvt) => void): void;
  addEventListener(type: 'message', fn: (e: MessageEvt) => void): void;
}

const sw = self as unknown as SwScope;
const VERSION = __SW_VERSION__;
const PRECACHE = __SW_PRECACHE__;
const CACHE = cacheNameFor(VERSION);

sw.addEventListener('install', (event) => {
  // No automatic skipWaiting: the user presses UPDATE.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([...PRECACHE]);
    })(),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(cachesToDelete(names, CACHE).map((n) => caches.delete(n)));
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isCacheable(req.method, req.url, sw.location.origin)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // The shell and sw.js always revalidate so a new deploy is noticed promptly;
      // if the network is gone, the cached copy still serves (offline-first).
      if (isAlwaysRevalidated(req.url) || isNavigation(req.mode, req.destination)) {
        try {
          const fresh = await fetch(req);
          if (fresh.ok) await cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          const shell = await cache.match('./index.html');
          if (shell) return shell;
          throw new Error('offline and no cached shell');
        }
      }

      // Hashed assets are immutable by name: cache-first.
      const cached = await cache.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      if (fresh.ok) await cache.put(req, fresh.clone());
      return fresh;
    })(),
  );
});

sw.addEventListener('message', (event) => {
  const msg = parseMessage(event.data);
  if (!msg) return;
  if (msg.type === 'SKIP_WAITING') void sw.skipWaiting();
  if (msg.type === 'GET_VERSION') {
    const port = event.ports[0];
    if (port) port.postMessage({ version: VERSION });
  }
});
