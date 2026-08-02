// G-12 — service-worker logic + update workflow (blueprint §4.6). The SW's decisions
// are pure functions, so the parts that decide whether v1's cache dies, whether a
// deploy can be noticed, and what counts as cacheable are node-testable without a
// browser. The event wiring itself is browser-only and belongs to G-14.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_PREFIX, cacheNameFor, cachesToDelete, isAlwaysRevalidated, isCacheable,
  isNavigation, parseMessage, pathOf,
} from '../../src/sw/logic';

test('G-12: activate deletes every cache but the current one — including v1 (sap1-v2)', () => {
  const all = ['sap1-v2', 'sap2-oldversion', 'sap2-current', 'random-other'];
  const doomed = cachesToDelete(all, 'sap2-current');
  assert.deepEqual([...doomed].sort(), ['random-other', 'sap1-v2', 'sap2-oldversion']);
  assert.ok(!doomed.includes('sap2-current'));
  // The v1 cache MUST be in the kill list: an installed v1 copy otherwise keeps
  // serving the retired app with its placeholder values.
  assert.ok(doomed.includes('sap1-v2'));
});

test('G-12: cache name is version-scoped so a new deploy cannot reuse stale entries', () => {
  assert.equal(cacheNameFor('abc123'), `${CACHE_PREFIX}abc123`);
  assert.notEqual(cacheNameFor('a'), cacheNameFor('b'));
});

test('G-12: sw.js and the shell always revalidate (otherwise updates are never noticed)', () => {
  assert.ok(isAlwaysRevalidated('https://x.test/sw.js'));
  assert.ok(isAlwaysRevalidated('https://x.test/'));
  assert.ok(isAlwaysRevalidated('https://x.test/survivability/index.html'));
  // Hashed assets are immutable by name — safe to serve cache-first.
  assert.ok(!isAlwaysRevalidated('https://x.test/assets/index-AbC123.js'));
});

test('G-12: only same-origin GETs are cacheable', () => {
  const origin = 'https://x.test';
  assert.ok(isCacheable('GET', 'https://x.test/a.js', origin));
  assert.ok(!isCacheable('POST', 'https://x.test/a.js', origin));
  assert.ok(!isCacheable('GET', 'https://other.test/a.js', origin));
  assert.ok(!isCacheable('GET', 'not a url', origin));
});

test('G-12: navigations resolve to the app shell', () => {
  assert.ok(isNavigation('navigate', ''));
  assert.ok(isNavigation('cors', 'document'));
  assert.ok(!isNavigation('cors', 'script'));
});

test('G-12: only known message types are honoured (SKIP_WAITING drives the button)', () => {
  assert.deepEqual(parseMessage({ type: 'SKIP_WAITING' }), { type: 'SKIP_WAITING' });
  assert.deepEqual(parseMessage({ type: 'GET_VERSION' }), { type: 'GET_VERSION' });
  assert.equal(parseMessage({ type: 'evict-everything' }), null);
  assert.equal(parseMessage('SKIP_WAITING'), null);
  assert.equal(parseMessage(null), null);
});

test('G-12: pathOf tolerates malformed input without throwing', () => {
  assert.equal(pathOf('https://x.test/a/b?q=1'), '/a/b');
  assert.equal(pathOf('garbage'), 'garbage');
});
