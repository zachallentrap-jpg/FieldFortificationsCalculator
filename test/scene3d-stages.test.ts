// Phase 5 (docs/EXECUTION_PLAN.md) — the 3D model teaches: it builds itself in doctrinal stage
// order (matching the priorities-of-work schedule), carries the cutaway flag, keeps the §2.7
// engineered-roof fail-safe at EVERY stage, and never draws a firing step the doctrine forbids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { buildScene3D } from '../src/render3d/scene3d';
import { defaultInputs } from './helpers';

test('the stage scrubber builds the model in order: earlier stages are a subset of later ones', () => {
  const r = compute(defaultInputs({ overheadCover: true, sump: true, camouflage: true }));
  const counts = [0, 1, 2, 3, 4, 5, 6].map((stage) => buildScene3D(r, { stage }).parts.length);
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i]! >= counts[i - 1]!, 'stage ' + i + ' has ≥ parts than stage ' + (i - 1));
  }
  // Final (undefined) equals the last stage.
  assert.equal(buildScene3D(r).parts.length, buildScene3D(r, { stage: 6 }).parts.length);
});

test('stage 0 has no overhead/parapet/camo; camo appears only at the final stage', () => {
  const r = compute(defaultInputs({ overheadCover: true, camouflage: true }));
  const s0 = buildScene3D(r, { stage: 0 }).parts;
  const roleAt = (parts: ReturnType<typeof buildScene3D>['parts'], role: string) =>
    parts.some((p) => (p.kind === 'box' || p.kind === 'cyl' || p.kind === 'ring') && p.role === role);
  assert.ok(!roleAt(s0, 'cover'), 'no overhead cover at stage 0');
  assert.ok(!roleAt(s0, 'parapet'), 'no parapet at stage 0');
  assert.ok(!roleAt(s0, 'camoNet'), 'no camo at stage 0');
  assert.ok(!roleAt(buildScene3D(r, { stage: 5 }).parts, 'camoNet'), 'no camo before the camo stage');
  assert.ok(roleAt(buildScene3D(r, { stage: 6 }).parts, 'camoNet'), 'camo at the final stage');
});

test('orientation aids (enemy arrow, figure) survive at EVERY stage — the model never loses its bearing', () => {
  const r = compute(defaultInputs());
  for (const stage of [0, 1, 2, 3, 4, 5, 6]) {
    const parts = buildScene3D(r, { stage }).parts;
    assert.ok(parts.some((p) => p.kind === 'arrow'), 'stage ' + stage + ': enemy arrow present');
    assert.ok(parts.some((p) => p.kind === 'figure'), 'stage ' + stage + ': scale figure present');
  }
});

test('§2.7 fail-safe holds at every stage: an engineered roof never becomes a fabricated cover box', () => {
  const r = compute(defaultInputs({ threat: 'at-rpg', overheadCover: true }));
  for (const stage of [0, 1, 2, 3, 4, 5, 6, undefined]) {
    const scene = buildScene3D(r, { stage });
    assert.equal(scene.engineeredRoof, true);
    assert.ok(!scene.parts.some((p) => p.kind === 'box' && p.role === 'cover'), 'stage ' + stage + ': no fabricated cover');
  }
});

test('the cutaway flag threads through the descriptor', () => {
  const r = compute(defaultInputs());
  assert.equal(buildScene3D(r, { cutaway: true }).cutaway, true);
  assert.equal(buildScene3D(r).cutaway, false);
});

test('a one-man position never draws a firing step (modeling spec §2.f), even with the toggle on', () => {
  const r = compute(defaultInputs({ positionType: 'one_man', firingStep: true }));
  const scene = buildScene3D(r);
  assert.ok(!scene.parts.some((p) => p.kind === 'box' && p.role === 'firingStep'), 'no firing step for one-man');
  // …but a position that DOES take one still renders it.
  const mg = buildScene3D(compute(defaultInputs({ positionType: 'two_man', firingStep: true })));
  assert.ok(mg.parts.some((p) => p.kind === 'box' && p.role === 'firingStep'), 'two-man keeps its firing step');
});
