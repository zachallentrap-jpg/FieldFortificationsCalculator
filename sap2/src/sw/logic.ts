// Service-worker LOGIC as pure functions (blueprint §4.1/G-12). The decisions live
// here so node can test them without a browser; src/sw/entry.ts is a thin shim that
// wires these to real events. This is the ONE directory allowed to touch network
// primitives (G-3) — and it only ever asks the origin the app was loaded from for
// the app's own files. No data is sent anywhere.

export const CACHE_PREFIX = 'sap2-';

export const cacheNameFor = (version: string): string => `${CACHE_PREFIX}${version}`;

/** Every cache that is not the current one is deleted on activate. Deliberately
 *  broader than a sap2- prefix filter: v1's `sap1-v2` cache must die too, or an
 *  installed v1 copy keeps serving the retired app with its placeholder values. */
export const cachesToDelete = (all: readonly string[], current: string): readonly string[] =>
  all.filter((name) => name !== current);

/** Only same-origin GETs are cacheable; anything else falls through to the network
 *  untouched (there is nothing else in this app, but the rule is explicit). */
export const isCacheable = (method: string, url: string, origin: string): boolean => {
  if (method !== 'GET') return false;
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
};

/** sw.js and the app entry must never be served from cache without revalidation, or
 *  a new deployment can never be noticed. Hashed assets are immutable by name. */
export const isAlwaysRevalidated = (url: string): boolean => {
  const path = pathOf(url);
  return path === '/sw.js' || path === '/' || path.endsWith('/index.html');
};

export const pathOf = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/** Navigation requests resolve to the app shell when offline — a single-page app
 *  served from any path still boots. */
export const isNavigation = (mode: string, destination: string): boolean =>
  mode === 'navigate' || destination === 'document';

export type SwMessage = { readonly type: 'SKIP_WAITING' } | { readonly type: 'GET_VERSION' };

export const parseMessage = (data: unknown): SwMessage | null => {
  if (typeof data !== 'object' || data === null) return null;
  const type = (data as { type?: unknown }).type;
  return type === 'SKIP_WAITING' || type === 'GET_VERSION' ? ({ type } as SwMessage) : null;
};
