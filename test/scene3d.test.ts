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

test('parapet and cover exist and are never tagged with the revetment\'s finish, regardless of choice', () => {
  for (const revetment of ['none', 'sandbag_facing', 'pickets_wire', 'corrugated_metal', 'timber_plywood']) {
    const r = compute(defaultInputs({ revetment, overheadCover: true }));
    const scene = buildScene3D(r);
    const parapetBoxes = scene.parts.filter((p) => p.kind === 'box' && p.role === 'parapet');
    const coverBoxes = scene.parts.filter((p) => p.kind === 'box' && p.role === 'cover');
    assert.ok(parapetBoxes.length > 0, revetment + ': has a parapet');
    assert.ok(coverBoxes.length > 0, revetment + ': has a cover');
    // The renderer treats role==='parapet'/'cover' as always-sandbag BEFORE ever consulting
    // `finish` — so the only thing that actually matters is that neither ever carries a
    // revetment-specific finish (picket/corrugated/timber), which would be silently ignored
    // by the renderer today but would be a landmine for a future refactor.
    const revetFinishes = ['picket', 'corrugated', 'timber'];
    for (const b of [...parapetBoxes, ...coverBoxes]) {
      const finish = (b as { finish?: string }).finish;
      assert.ok(!revetFinishes.includes(finish ?? ''), revetment + ': parapet/cover must never carry a revetment finish');
    }
  }
});

test('each revetment choice tags the excavation wall with its own distinct finish', () => {
  const expect: Record<string, string> = {
    none: 'earth',
    sandbag_facing: 'sandbag',
    pickets_wire: 'picket',
    corrugated_metal: 'corrugated',
    timber_plywood: 'timber',
  };
  for (const [revetment, finish] of Object.entries(expect)) {
    const r = compute(defaultInputs({ revetment, soil: 'loam' }));
    const scene = buildScene3D(r);
    const walls = scene.parts.filter((p) => p.kind === 'box' && p.role === 'bayWall');
    assert.ok(walls.length > 0, revetment + ': has walls');
    for (const w of walls) assert.equal((w as { finish?: string }).finish, finish, revetment);
  }
});

test('unrevetted wall taper scales with the soil\'s real wallSlopeRatio — steeper soil ⇒ more taper', () => {
  const taperFor = (soil: string): number => {
    const r = compute(defaultInputs({ soil, revetment: 'none' }));
    const scene = buildScene3D(r);
    const wall = scene.parts.find((p) => p.kind === 'box' && p.role === 'bayWall') as { taperAmount?: number } | undefined;
    return wall?.taperAmount ?? 0;
  };
  // rock/frozen (0.1 ratio) barely slope; sand/gravel (1.0 ratio, forced revetment) slope hard.
  assert.ok(taperFor('rock') < taperFor('loam'), 'rock < loam');
  assert.ok(taperFor('loam') < taperFor('sand'), 'loam < sand');
  assert.ok(taperFor('rock') > 0, 'even a "stable" soil still shows SOME taper, never a hard 0');
});

test('a revetted wall never tapers, regardless of how steep the soil would otherwise require', () => {
  const r = compute(defaultInputs({ soil: 'sand', revetment: 'sandbag_facing' }));
  const scene = buildScene3D(r);
  const walls = scene.parts.filter((p) => p.kind === 'box' && p.role === 'bayWall');
  for (const w of walls) assert.equal((w as { taperAmount?: number }).taperAmount, undefined);
});

test('empty config (degenerate hole) reports hasAnything:false with no parts', () => {
  // Force a degenerate geometry the same way render/geometry.ts would flag as nothing-to-draw.
  const r = compute(defaultInputs());
  const forced = { ...r, geometry: { ...(r.geometry as object), hasAnything: false } };
  const scene = buildScene3D(forced as typeof r);
  assert.equal(scene.hasAnything, false);
  assert.equal(scene.parts.length, 0);
});
