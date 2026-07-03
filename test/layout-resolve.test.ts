import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLayout, BP, type LayoutEnv, type LayoutMode } from '../src/layout/resolve';

const env = (o: Partial<LayoutEnv>): LayoutEnv => ({
  width: 1440,
  pointerCoarse: false,
  landscape: true,
  override: 'auto',
  ...o,
});

test('override always wins over auto resolution', () => {
  const modes: LayoutMode[] = ['mobile', 'tablet', 'desktop'];
  for (const m of modes) {
    // Even a contradicting environment yields the override.
    assert.equal(resolveLayout(env({ width: 320, pointerCoarse: true, override: m })), m);
    assert.equal(resolveLayout(env({ width: 2560, pointerCoarse: false, override: m })), m);
  }
});

test('fine pointer + wide = desktop', () => {
  assert.equal(resolveLayout(env({ width: BP.desktopMin, pointerCoarse: false })), 'desktop');
  assert.equal(resolveLayout(env({ width: 1920, pointerCoarse: false })), 'desktop');
});

test('coarse pointer + narrow = mobile', () => {
  assert.equal(resolveLayout(env({ width: BP.tabletMin - 1, pointerCoarse: true })), 'mobile');
  assert.equal(resolveLayout(env({ width: 320, pointerCoarse: true })), 'mobile');
});

test('coarse pointer + not narrow = tablet (field primary)', () => {
  assert.equal(resolveLayout(env({ width: BP.tabletMin, pointerCoarse: true })), 'tablet');
  assert.equal(resolveLayout(env({ width: 820, pointerCoarse: true, landscape: true })), 'tablet');
  // A large touch device is still tablet, not desktop (coarse pointer).
  assert.equal(resolveLayout(env({ width: 1400, pointerCoarse: true })), 'tablet');
});

test('fine pointer + narrow = tablet fallback (never desktop below desktopMin)', () => {
  assert.equal(resolveLayout(env({ width: 800, pointerCoarse: false })), 'tablet');
  assert.equal(resolveLayout(env({ width: BP.desktopMin - 1, pointerCoarse: false })), 'tablet');
});

test('below tabletMin every pointer type gets the stacked mobile layout', () => {
  // A narrow desktop window with a mouse previously resolved to tablet and crushed the
  // two-column grid into ~390 px of viewport.
  assert.equal(resolveLayout(env({ width: BP.tabletMin - 1, pointerCoarse: false })), 'mobile');
  assert.equal(resolveLayout(env({ width: 390, pointerCoarse: false })), 'mobile');
});

test('full width × pointer × override matrix is total and stable', () => {
  const widths = [200, 320, 639, 640, 800, 1023, 1024, 1440, 2560];
  const overrides: LayoutEnv['override'][] = ['auto', 'mobile', 'tablet', 'desktop'];
  for (const width of widths) {
    for (const pointerCoarse of [true, false]) {
      for (const landscape of [true, false]) {
        for (const override of overrides) {
          const m = resolveLayout({ width, pointerCoarse, landscape, override });
          assert.ok(m === 'mobile' || m === 'tablet' || m === 'desktop');
          // Determinism: same env → same answer.
          assert.equal(m, resolveLayout({ width, pointerCoarse, landscape, override }));
        }
      }
    }
  }
});
