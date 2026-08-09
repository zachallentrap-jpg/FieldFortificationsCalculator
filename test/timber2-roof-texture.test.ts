// The corrugation pitch on a roof, measured on the pieces the engine actually cuts.
//
// The rib scale is not decoration. A corrugated roof is legible because every sheet on it has the
// same corrugation, and the moment two adjacent pieces disagree the roof reads as a patchwork of
// different materials rather than one covering. That is what a hip and a pyramid looked like: the
// viewer asked for `Math.round(span / tile)` tiles clamped to at least one, so every piece
// narrower than 39 in got a whole tile — twelve corrugations — squeezed into whatever width the
// hip had left it.
//
// These tests are the reason `roofingTiling` is its own module. `studio.ts` cannot be imported
// outside a browser build, so while the arithmetic lived there nothing could check it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { roofingTiling, ROOFING_TILE_IN } from '../src/ui/woodframe/tiling';
import { ROOFING, IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

/** One corrugated tile is drawn 26 in wide and holds exactly this many corrugations. */
const CORRUGATIONS_PER_TILE = ROOFING_TILE_IN.corrugated
  / ((ROOFING.corrugatedSideLapIn.value as number) / (ROOFING.corrugatedSideLapCorrugations.value as number));

function roofOf(familyId: string, patch: (s: Record<string, unknown>) => void = () => {}): Member[] {
  const spec = JSON.parse(JSON.stringify(familyById(familyId as never)!.preset)) as Record<string, unknown>;
  patch(spec);
  return generateStructure(spec as never).members
    .filter((m) => m.role === 'roofingCourse' || m.role === 'ridgeCap');
}

const corrugated = (ms: Member[]): Member[] => ms.filter((m) => m.nominal.startsWith('corrugated'));

/** The corrugation pitch this piece will actually RENDER at, in inches. */
const renderedPitchIn = (m: Member): number =>
  m.cutLength / roofingTiling(m).along / CORRUGATIONS_PER_TILE;

const CASES: [string, string, (s: Record<string, unknown>) => void][] = [
  ['guard tower cab pyramid', 'tower', () => {}],
  ['building, hip + corrugated', 'gp-frame', (s) => {
    s.roof = { kind: 'hip', risePer12: 4, overhangFt: 1 };
    s.coverings = { ...(s.coverings as object), roofDeck: 'plywood', roofing: 'corrugated' };
  }],
  ['building, gable + corrugated', 'gp-frame', (s) => {
    s.roof = { kind: 'gable', risePer12: 4, overhangFt: 1 };
    s.coverings = { ...(s.coverings as object), roofDeck: 'plywood', roofing: 'corrugated' };
  }],
  // `highSide` is not optional on a shed and nothing fills it in — see the sweep note.
  ['building, shed + corrugated', 'gp-frame', (s) => {
    s.roof = { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' };
    s.coverings = { ...(s.coverings as object), roofDeck: 'plywood', roofing: 'corrugated' };
  }],
];

test('EVERY PIECE OF CORRUGATED ON A ROOF RENDERS AT ONE PITCH, whatever the hip cut it to', () => {
  // Measured before the fix: the tower's pyramid had 48 of 108 pieces at the wrong pitch and the
  // worst rendered its ribs 0.274 in apart against a true 2.167 — eight times too fine. The hip
  // had 98 of 304. A gable had 4, which is exactly why this went unseen: the shape everyone looks
  // at is very nearly clean.
  const want = (ROOFING.corrugatedSideLapIn.value as number) / (ROOFING.corrugatedSideLapCorrugations.value as number);
  for (const [label, family, patch] of CASES) {
    const sheets = corrugated(roofOf(family, patch));
    assert.ok(sheets.length > 10, `${label}: expected a corrugated roof, got ${sheets.length} pieces`);
    for (const s of sheets) {
      const pitch = renderedPitchIn(s);
      assert.ok(Math.abs(pitch - want) < 1e-9,
        `${label}: ${s.id} is ${s.cutLength.toFixed(3)} in wide and renders its ribs `
        + `${pitch.toFixed(3)} in apart; the corrugation is ${want.toFixed(3)} in`);
    }
  }
});

test('and the pieces a hip cuts really are narrower than one tile — the clamp had something to bite', () => {
  // Without this the test above would pass on a roof made only of full sheets and prove nothing.
  const sheets = corrugated(roofOf('tower'));
  const narrow = sheets.filter((s) => s.cutLength < ROOFING_TILE_IN.corrugated);
  assert.ok(narrow.length > 0, 'a pyramid cuts pieces narrower than a sheet');
  const thinnest = narrow.reduce((a, b) => (b.cutLength < a.cutLength ? b : a));
  assert.ok(roofingTiling(thinnest).along < 1,
    `the narrowest piece is ${thinnest.cutLength.toFixed(3)} in and must ask for less than a whole tile`);
  assert.ok(thinnest.cutLength < ROOFING_TILE_IN.corrugated / 4,
    `expected a real sliver; the narrowest is ${thinnest.cutLength.toFixed(2)} in`);
});

test('roll goods keep their granule scale too, in both directions', () => {
  // Same arithmetic, same bug: a double-coverage course is 18 in of exposure against a 36-in
  // tile, so rounding gave it a whole tile and stretched the granules to twice their size.
  for (const roofing of ['roll', 'rollDouble']) {
    const sheets = roofOf('gp-frame', (s) => {
      s.roof = { kind: 'gable', risePer12: 4, overhangFt: 1 };
      s.coverings = { ...(s.coverings as object), roofDeck: 'plywood', roofing };
    }).filter((m) => !m.nominal.startsWith('corrugated'));
    assert.ok(sheets.length > 4, `${roofing}: expected roll courses`);
    for (const s of sheets) {
      const t = roofingTiling(s);
      assert.equal(t.kind, 'roll');
      assert.ok(Math.abs(s.cutLength / t.along - ROOFING_TILE_IN.roll) < 1e-9,
        `${roofing}: ${s.id} stretches its granules along the course`);
      assert.ok(Math.abs(s.actual.d / t.across - ROOFING_TILE_IN.roll) < 1e-9,
        `${roofing}: ${s.id} is ${s.actual.d.toFixed(2)} in of exposure and stretches its granules across it`);
    }
  }
});

test('the tiling is a ratio, not a count', () => {
  const piece = (widthIn: number, dIn = 96, nominal = 'corrugated 26x8'): Member =>
    ({ nominal, cutLength: widthIn, actual: { w: 0.02, d: dIn } } as Member);
  assert.equal(roofingTiling(piece(26)).along, 1);
  assert.equal(roofingTiling(piece(13)).along, 0.5);
  assert.equal(roofingTiling(piece(52)).along, 2);
  // The sliver that gave the game away, from the tower's pyramid.
  assert.ok(Math.abs(roofingTiling(piece(3.286)).along - 3.286 / 26) < 1e-12);
  // A corrugated rib is a LINE up the slope, so one tile covers any run and nothing is gained by
  // repeating it; roll granules are a pattern in both directions and are not exempt.
  assert.equal(roofingTiling(piece(26, 96)).across, 1);
  assert.equal(roofingTiling(piece(120, 18, '36 in roll')).across, 0.5);
});

test('every roofing member in the catalog gets a finite, positive tiling', () => {
  // A zero or NaN repeat is a blank sheet, and the guard in `roofingSheet` is deliberately tiny
  // now — so nothing upstream may hand it one.
  for (const fam of ['tower', 'gp-frame', 'storage-shed', 'crib-bunker']) {
    for (const m of roofOf(fam)) {
      const t = roofingTiling(m);
      assert.ok(Number.isFinite(t.along) && t.along > 0, `${fam}/${m.id}: along=${t.along}`);
      assert.ok(Number.isFinite(t.across) && t.across > 0, `${fam}/${m.id}: across=${t.across}`);
    }
  }
});

test('the corrugated tile is a real dimension, not a magic number', () => {
  // 26 in is the sheet's coverage width and the doctrine figure the engine lays sheets on; if one
  // moves and the other does not, the ribs stop lining up with the side laps.
  assert.equal(ROOFING_TILE_IN.corrugated, ROOFING.corrugatedWidthIn.value as number);
  assert.ok(CORRUGATIONS_PER_TILE > 1, 'a tile holds whole corrugations');
  assert.equal(ROOFING_TILE_IN.roll, (ROOFING.rollWidthIn.value as number));
  void IN_PER_FT;
});
