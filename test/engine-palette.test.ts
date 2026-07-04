// Soil-aware palette contract (ui/engine/palette.ts). Pure data — no Three.js, no DOM — so it
// runs under node:test like the descriptor. Pins the honest-materials rule: every doctrine soil
// gets a distinct terrain look, loam IS the base palette, unknown soils safely fall back, and
// the non-terrain fields (sandbags, lights, hazard red) never vary with soil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palette, paletteFor } from '../src/ui/engine/palette';
import { soils } from '../src/doctrine/soils';

const HEX = /^#[0-9a-fA-F]{6}$/;

test('every doctrine soil resolves to a valid palette in both themes', () => {
  for (const soil of Object.keys(soils)) {
    for (const theme of ['day', 'night'] as const) {
      const p = paletteFor(theme, soil);
      for (const v of Object.values(p.role)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffff, soil + '/' + theme + ' role color');
      for (const v of [p.grass.base, p.grass.dark, p.grass.light, p.grass.dry, p.wornRing, p.spoilFleck, p.strata.base, ...p.strata.lines]) {
        assert.match(v, HEX, soil + '/' + theme + ' css color: ' + v);
      }
      assert.ok(p.scatterMul.tuft > 0 && p.scatterMul.rock > 0, soil + '/' + theme + ' scatter multipliers positive');
    }
  }
});

test('loam is the baseline — identical to the base palette', () => {
  for (const theme of ['day', 'night'] as const) {
    assert.deepEqual(paletteFor(theme, 'loam'), palette(theme), theme);
  }
});

test('unknown soil ids fall back to the base palette, never throw', () => {
  assert.deepEqual(paletteFor('day', 'moon_dust'), palette('day'));
});

test('soils are visually distinct where it matters, identical where it must not vary', () => {
  for (const theme of ['day', 'night'] as const) {
    const base = palette(theme);
    for (const soil of ['sand', 'clay', 'rock', 'frozen']) {
      const p = paletteFor(theme, soil);
      assert.notEqual(p.grass.base, base.grass.base, soil + '/' + theme + ' grass differs from loam');
      assert.notEqual(p.role.bayFloor, base.role.bayFloor, soil + '/' + theme + ' excavated floor differs from loam');
      // Sandbags, hazard red, and the light rig are soil-INdependent (doctrine + legibility).
      assert.equal(p.role.parapet, base.role.parapet, soil + '/' + theme + ' parapet unchanged');
      assert.equal(p.role.engineeredCover, base.role.engineeredCover, soil + '/' + theme + ' hazard red unchanged');
      assert.deepEqual(p.light, base.light, soil + '/' + theme + ' light rig unchanged');
    }
  }
});

test('rocky soils grow rocks, sandy soils lose grass', () => {
  const loam = paletteFor('day', 'loam');
  assert.ok(paletteFor('day', 'rock').scatterMul.rock > loam.scatterMul.rock);
  assert.ok(paletteFor('day', 'gravel').scatterMul.rock > loam.scatterMul.rock);
  assert.ok(paletteFor('day', 'sand').scatterMul.tuft < loam.scatterMul.tuft);
});
