// TIMBER-2 — the hash router and share codec (plan §5.1, §5.5, TD14, TD9).
//
// Routes: `#/` picker · `#/build/<id>` workbench · `#/build/<id>?c=<payload>` a shared build.
// Pure parsing, so the route table is node-testable and the DOM layer only has to listen.
//
// TD9 — share links exist for carpentry specs (a stud layout is not exfiltration-sensitive),
// with ONE exception: `designCoverDepthFt` is STRIPPED on serialize and re-prompted on load.
// That number is the single protection-adjacent quantity in the tool (plan §2.7), and it is a
// user's stated design load, not ours to pass around. The on-device session keeps it so a
// crash-resume does not interrogate the user again; only the shareable forms drop it.

import type { StructureSpec } from '../../timber/spec';
import { specToJson } from '../../timber/normalize';

export type Route =
  | { name: 'picker' }
  | { name: 'build'; id: string; shared?: SharedPayload };

export interface SharedPayload {
  raw: string;
  compressed: boolean;
}

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === '' || h === '/' ) return { name: 'picker' };
  const [path, query] = h.split('?');
  const parts = (path ?? '').split('/').filter(Boolean);
  if (parts[0] === 'build' && parts[1]) {
    const params = new URLSearchParams(query ?? '');
    const cz = params.get('cz');
    const c = params.get('c');
    const shared = cz ? { raw: cz, compressed: true } : c ? { raw: c, compressed: false } : undefined;
    return { name: 'build', id: decodeURIComponent(parts[1]), ...(shared ? { shared } : {}) };
  }
  return { name: 'picker' }; // unknown route → picker, with an inline notice from the caller
}

export function routeToHash(route: Route): string {
  if (route.name === 'picker') return '#/';
  return `#/build/${encodeURIComponent(route.id)}`;
}

// ── Share codec ──────────────────────────────────────────────────────────────

/** base64url, no padding — safe in a URL without escaping. */
export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Strip the one number that never leaves the device (plan §2.7). Returns a copy — the caller's
 * spec is untouched, because the live model still needs the value it was built with.
 */
export function stripUnshareable(spec: StructureSpec): StructureSpec {
  if (spec.family !== 'bunker') return spec;
  const copy = { ...spec } as Record<string, unknown>;
  delete copy.designCoverDepthFt;
  return copy as unknown as StructureSpec;
}

/** True when a serialized payload carries no cover depth — asserted by the boundary tests. */
export function isShareSafe(json: string): boolean {
  return !/designCoverDepthFt/.test(json);
}

/**
 * Encode a spec for a share link. Uncompressed base64url (`c=`) is the always-available form;
 * the compressed variant (`cz=`) is produced by the DOM layer when `CompressionStream` exists.
 * Both are accepted on import, so a link made in one browser opens in another.
 */
export function encodeSpec(spec: StructureSpec): string {
  const json = specToJson(stripUnshareable(spec));
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

export function decodeSpec(payload: string): StructureSpec | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(payload));
    const parsed = JSON.parse(json) as StructureSpec;
    if (!parsed || typeof parsed !== 'object' || !('family' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Does this spec need a value re-prompted after import? (Only the stripped one does.) */
export function needsReprompt(spec: StructureSpec): boolean {
  return spec.family === 'bunker' && (spec as { designCoverDepthFt?: number }).designCoverDepthFt === undefined;
}
