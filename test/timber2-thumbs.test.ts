// TIMBER-2 — picker card art (plan §8.7, TD11, R4).
//
// The committed goldens are FULL SVG FILES so a card-art change is a diff a human can look
// at. But a golden compare alone is weak — someone regenerates and rubber-stamps it. So the
// STRUCTURAL assertions below (no external references, no script, size and polygon budgets,
// determinism) are independent of the golden compare and fail on their own.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FAMILY_TABLE, shippedFamilies } from '../src/timber/catalog';
import { thumbnailFor, thumbnailCached } from '../src/timber/thumbnails';

const DIR = fileURLToPath(new URL('./goldens/thumbs/', import.meta.url));

test('every shipped family has a committed SVG golden, and it still matches', () => {
  for (const f of shippedFamilies()) {
    const path = `${DIR}${f.id}.svg`;
    assert.ok(existsSync(path), `${f.id}: no golden — run npm run update:thumb-goldens`);
    const golden = readFileSync(path, 'utf8');
    assert.equal(
      thumbnailFor(f.preset) + '\n',
      golden,
      `${f.id}: card art changed. If deliberate, run npm run update:thumb-goldens IN THE SAME PR as the change.`,
    );
  }
});

test('thumbnails are deterministic — the same spec draws the same bytes, every time', () => {
  for (const f of shippedFamilies()) {
    const a = thumbnailFor(f.preset);
    const b = thumbnailFor(f.preset);
    assert.equal(a, b, `${f.id}: not deterministic`);
    // And the memoized path agrees with the direct one.
    assert.equal(thumbnailCached(`t:${f.id}`, f.preset), a, `${f.id}: cache disagrees with a fresh draw`);
  }
});

test('structural: no external references, no script, nothing that could phone home', () => {
  for (const f of shippedFamilies()) {
    const svg = thumbnailFor(f.preset);
    assert.ok(!/<script/i.test(svg), `${f.id}: script tag in card art`);
    assert.ok(!/https?:/i.test(svg.replace('http://www.w3.org/2000/svg', '')), `${f.id}: external URL`);
    assert.ok(!/<image|xlink:href|url\(/i.test(svg), `${f.id}: external reference`);
    assert.ok(!/<foreignObject/i.test(svg), `${f.id}: foreignObject`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${f.id}: malformed`);
    assert.ok(/viewBox="0 0 \d+ \d+"/.test(svg), `${f.id}: needs a viewBox to scale`);
  }
});

test('budgets: under 140 KB and under 25 ms per card', () => {
  for (const f of shippedFamilies()) {
    const t0 = performance.now();
    const svg = thumbnailFor(f.preset);
    const ms = performance.now() - t0;
    assert.ok(svg.length < 140_000, `${f.id}: ${(svg.length / 1024).toFixed(1)} KB exceeds the 140 KB budget`);
    assert.ok(ms < 250, `${f.id}: ${ms.toFixed(1)} ms — far past the cold-draw allowance`);
  }
  // Warmed mean, the house perf pattern (plan §8.8).
  const f = shippedFamilies()[0]!;
  thumbnailFor(f.preset);
  const t0 = performance.now();
  const N = 10;
  for (let i = 0; i < N; i++) thumbnailFor(f.preset);
  const mean = (performance.now() - t0) / N;
  assert.ok(mean < 25, `warmed mean ${mean.toFixed(1)} ms exceeds the 25 ms budget`);
});

test('polygon budget: the LOD really skips sheet goods', () => {
  for (const f of shippedFamilies()) {
    const lod = thumbnailFor(f.preset);
    const full = thumbnailFor(f.preset, { lod: false });
    const segs = (s: string): number => (s.match(/M/g) ?? []).length;
    assert.ok(segs(lod) < 4000, `${f.id}: ${segs(lod)} segments — too dense to read at card size`);
    if (f.preset.coverings.siding !== 'none' || f.preset.coverings.roofing !== 'none') {
      assert.ok(segs(lod) < segs(full), `${f.id}: LOD should drop the coverings`);
    }
  }
});

test('the human silhouette is drawn, so size differences read at a glance', () => {
  const withHuman = thumbnailFor(FAMILY_TABLE[0]!.preset, { human: true });
  const without = thumbnailFor(FAMILY_TABLE[0]!.preset, { human: false });
  assert.ok(withHuman.length > without.length, 'the scale figure should add strokes');
  assert.ok(withHuman.includes('#9a5b3d'), 'and be drawn in its own ink so it reads as a person, not framing');
});

test('cards are visibly DIFFERENT structures, not the same drawing three times', () => {
  const arts = shippedFamilies().map((f) => thumbnailFor(f.preset));
  assert.equal(new Set(arts).size, arts.length, 'two cards drew identical art');
});
