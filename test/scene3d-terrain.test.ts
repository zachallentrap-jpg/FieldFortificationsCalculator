// Terrain spec contract (render3d/scene3d.ts TerrainSpec). The renderer cuts REAL holes into
// one earth block from this pure data — so the descriptor must guarantee: a spec exists for
// every renderable scene, every sunken volume is represented (including the inverted-T stem
// and L-arm trenches the old ground frame solid-covered), every hole fits inside the outer
// block (the fifty-cal arm used to overhang the frame edge), and every number is finite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { buildScene3D } from '../src/render3d/scene3d';
import type { TerrainHole } from '../src/render3d/scene3d';
import { positions } from '../src/doctrine/positions';
import { defaultInputs } from './helpers';

function holeEnv(h: TerrainHole): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (h.kind === 'rect') return { minX: h.x - h.w / 2, maxX: h.x + h.w / 2, minZ: h.z - h.d / 2, maxZ: h.z + h.d / 2 };
  if (h.kind === 'circle') return { minX: h.x - h.r, maxX: h.x + h.r, minZ: h.z - h.r, maxZ: h.z + h.r };
  return {
    minX: Math.min(...h.pts.map((p) => p[0])),
    maxX: Math.max(...h.pts.map((p) => p[0])),
    minZ: Math.min(...h.pts.map((p) => p[1])),
    maxZ: Math.max(...h.pts.map((p) => p[1])),
  };
}

test('terrain spec present iff the scene has anything, and every number is finite', () => {
  for (const positionType of Object.keys(positions)) {
    const scene = buildScene3D(compute(defaultInputs({ positionType })));
    assert.ok(scene.hasAnything, positionType);
    assert.ok(scene.terrain, positionType + ': terrain spec present');
    const t = scene.terrain!;
    for (const v of [t.outer.x, t.outer.z, t.outer.w, t.outer.d]) assert.ok(Number.isFinite(v), positionType + ' outer finite');
    assert.ok(t.outer.w > 0 && t.outer.d > 0, positionType + ' outer has area');
    for (const h of t.holes) {
      assert.ok(Number.isFinite(h.depth) && h.depth > 0, positionType + ' hole depth > 0');
      if (h.kind === 'poly') for (const [x, z] of h.pts) assert.ok(Number.isFinite(x) && Number.isFinite(z), positionType + ' poly pts finite');
    }
  }
});

test('each shape carves the right holes: 1 rect / 1 circle / 1 union polygon', () => {
  const expect: Record<string, { kinds: string[]; polyPts?: number }> = {
    one_man: { kinds: ['rect'] },
    two_man: { kinds: ['rect'] },
    bunker_op_cp: { kinds: ['rect'] },
    connecting_trench: { kinds: ['rect'] },
    mortar_pit: { kinds: ['circle'] },
    vehicle_hull_defilade: { kinds: ['rect'] },
    vehicle_turret_defilade: { kinds: ['rect'] },
    mg_crew: { kinds: ['poly'], polyPts: 8 }, // T-union: main bay ∪ rear stem
    fifty_cal: { kinds: ['poly'], polyPts: 6 }, // L-union: main bay ∪ side arm
    atgm_javelin: { kinds: ['poly'], polyPts: 6 },
  };
  for (const [positionType, exp] of Object.entries(expect)) {
    const scene = buildScene3D(compute(defaultInputs({ positionType })));
    const t = scene.terrain!;
    assert.deepEqual(t.holes.map((h) => h.kind), exp.kinds, positionType + ' hole kinds');
    if (exp.polyPts) {
      const poly = t.holes[0]!;
      assert.equal(poly.kind, 'poly');
      if (poly.kind === 'poly') assert.equal(poly.pts.length, exp.polyPts, positionType + ' union outline point count');
    }
  }
});

test('every hole envelope sits fully inside the outer block (arm-overhang regression guard)', () => {
  for (const positionType of Object.keys(positions)) {
    const t = buildScene3D(compute(defaultInputs({ positionType }))).terrain!;
    const oMinX = t.outer.x - t.outer.w / 2;
    const oMaxX = t.outer.x + t.outer.w / 2;
    const oMinZ = t.outer.z - t.outer.d / 2;
    const oMaxZ = t.outer.z + t.outer.d / 2;
    for (const h of t.holes) {
      const env = holeEnv(h);
      assert.ok(env.minX > oMinX && env.maxX < oMaxX && env.minZ > oMinZ && env.maxZ < oMaxZ,
        positionType + ': hole ' + h.kind + ' inside outer (hole ' + JSON.stringify(env) + ' vs outer ' +
        JSON.stringify({ oMinX, oMaxX, oMinZ, oMaxZ }) + ')');
    }
  }
});

test('degenerate scene emits no terrain', () => {
  const r = compute(defaultInputs({}));
  const hollow = { ...r, geometry: { ...(r.geometry as Record<string, unknown>), hasAnything: false } } as typeof r;
  const scene = buildScene3D(hollow);
  assert.equal(scene.hasAnything, false);
  assert.equal(scene.terrain, undefined);
});
