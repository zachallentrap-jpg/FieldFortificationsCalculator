// The 3D scene descriptor (render3d/scene3d.ts) is pure and framework-agnostic — no Three.js
// import, so it's unit-testable like any other engine-adjacent module. Mirrors render-nan.test.ts:
// every position × shape must produce finite numbers only, never NaN/Infinity, and the honesty
// invariant (§2.7) must hold in 3D exactly as it does in the flat drawings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { buildScene3D } from '../src/render3d/scene3d';
import { positions } from '../src/doctrine/positions';
import { threats, roofPathFor } from '../src/doctrine/protection';
import { defaultInputs } from './helpers';

function assertFinite(part: Record<string, unknown>, ctx: string): void {
  for (const [k, v] of Object.entries(part)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), ctx + '.' + k + ' is not finite: ' + v);
  }
}

test('every position shape produces a finite, non-empty 3D scene', () => {
  for (const positionType of Object.keys(positions)) {
    const r = compute(defaultInputs({ positionType, overheadCover: true, sump: true, camouflage: true, firingStep: true }));
    const scene = buildScene3D(r);
    assert.ok(scene.hasAnything, positionType + ' should have a scene');
    assert.ok(scene.parts.length > 0, positionType + ' should have parts');
    assert.ok(Number.isFinite(scene.bounds.size) && scene.bounds.size > 0, positionType + ' bounds.size finite');
    for (const part of scene.parts) assertFinite(part as unknown as Record<string, unknown>, positionType + '/' + part.kind);
  }
});

test('every threat munition keeps the scene finite across cover on/off', () => {
  for (const threat of ['none', ...Object.keys(threats)]) {
    for (const overheadCover of [true, false]) {
      const r = compute(defaultInputs({ threat, overheadCover }));
      const scene = buildScene3D(r);
      for (const part of scene.parts) assertFinite(part as unknown as Record<string, unknown>, threat + '/' + part.kind);
    }
  }
});

test('engineered munitions NEVER get a fabricated cover box in 3D (§2.7)', () => {
  for (const threat of Object.keys(threats)) {
    if (roofPathFor(threat) !== 'engineered_required') continue;
    const r = compute(defaultInputs({ threat, overheadCover: true }));
    const scene = buildScene3D(r);
    assert.equal(scene.engineeredRoof, true, threat);
    assert.ok(!scene.parts.some((p) => p.kind === 'box' && p.role === 'cover'), threat + ': no fabricated cover box');
    assert.ok(scene.parts.some((p) => p.kind === 'box' && p.role === 'engineeredCover'), threat + ': hazard marker present');
  }
});

test('empty config (degenerate hole) reports hasAnything:false with no parts', () => {
  // Force a degenerate geometry the same way render/geometry.ts would flag as nothing-to-draw.
  const r = compute(defaultInputs());
  const forced = { ...r, geometry: { ...(r.geometry as object), hasAnything: false } };
  const scene = buildScene3D(forced as typeof r);
  assert.equal(scene.hasAnything, false);
  assert.equal(scene.parts.length, 0);
});
