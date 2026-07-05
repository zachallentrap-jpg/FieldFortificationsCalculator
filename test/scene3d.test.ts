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
    const r = compute(defaultInputs({ soil, standard: 'hasty', revetment: 'none' }));
    const scene = buildScene3D(r);
    const wall = scene.parts.find((p) => p.kind === 'box' && p.role === 'bayWall') as { taperAmount?: number } | undefined;
    return wall?.taperAmount ?? 0;
  };
  // Researched face angles: rock/frozen are VERTICAL (ratio 0 ⇒ no taper); loam moderate (0.65);
  // clay steeper-but-still-sloped (0.75); sand/gravel slump wide (1.48). The rendered taper is
  // additionally clamped to the bay's own size (see below), so on a narrow rifle bay steep soils
  // saturate to the same drawable maximum — ordering is monotonic (≤), not strict.
  assert.equal(taperFor('rock'), 0, 'intact rock cuts vertical — no taper');
  assert.equal(taperFor('frozen'), 0, 'frozen ground cuts vertical while frozen');
  assert.ok(taperFor('loam') <= taperFor('clay'), 'loam ≤ clay');
  assert.ok(taperFor('clay') <= taperFor('sand'), 'clay ≤ sand');
  assert.ok(taperFor('loam') > 0, 'a sloping soil still shows a taper');
});

test('bay-wall taper never exceeds the bay\'s own size — walls cannot flare into each other', () => {
  // The regression this pins: an ATGM (3 ft front-to-back) in sand at deliberate depth rendered
  // a raw ~5+ ft flare per wall — opposite/adjacent walls interpenetrated into a pile of flaps.
  // (mg_crew omitted: its T-stem clamps to the stem's OWN dims, slightly above the main bay's.)
  for (const positionType of ['atgm_javelin', 'two_man']) {
    const r = compute(defaultInputs({ positionType, soil: 'sand', standard: 'deliberate', revetment: 'none' }));
    const scene = buildScene3D(r);
    const walls = scene.parts.filter((p) => p.kind === 'box' && p.role === 'bayWall') as Array<{ taperAmount?: number }>;
    assert.ok(walls.length > 0, positionType + ' has bay walls');
    const geo = r.geometry as { plan: { holeL: number; holeW: number } };
    const cap = Math.min(geo.plan.holeL, geo.plan.holeW) * 0.35 + 1e-9;
    for (const w of walls) {
      assert.ok((w.taperAmount ?? 0) <= cap, positionType + ' taper ' + w.taperAmount + ' ≤ bay cap ' + cap);
    }
  }
});

test('earth-mode rect-family positions get ONE continuous frame part, not 4 separate boxes', () => {
  // The regression this pins: a real parapet is one piled, rounded, sloped mound — not 4 flat
  // boxes meeting at hard square corners (user-reported: "different shaped square blocks of
  // dirt"). Every earth-mode position now emits exactly one 'frame' part for its parapet.
  for (const positionType of ['one_man', 'two_man', 'mg_crew', 'fifty_cal', 'atgm_javelin', 'connecting_trench']) {
    const r = compute(defaultInputs({ positionType, revetment: 'none' }));
    const scene = buildScene3D(r);
    const frames = scene.parts.filter((p) => p.kind === 'frame' && p.role === 'earthParapet');
    const parapetBoxes = scene.parts.filter((p) => p.kind === 'box' && p.role === 'earthParapet');
    assert.equal(frames.length, 1, positionType + ' has exactly one continuous parapet frame');
    assert.equal(parapetBoxes.length, 0, positionType + ' has no leftover box-ring parapet segments');
  }
  // The bunker is the one class that stays a real built sandbag ring (4 boxes, unchanged).
  const bunker = buildScene3D(compute(defaultInputs({ positionType: 'bunker_op_cp' })));
  assert.equal(bunker.parts.filter((p) => p.kind === 'frame').length, 0, 'bunker has no earth frame');
  assert.ok(bunker.parts.filter((p) => p.kind === 'box' && p.role === 'parapet').length >= 4, 'bunker keeps its sandbag box ring');
});

test('a revetted wall never tapers, regardless of how steep the soil would otherwise require', () => {
  const r = compute(defaultInputs({ soil: 'sand', revetment: 'sandbag_facing' }));
  const scene = buildScene3D(r);
  const walls = scene.parts.filter((p) => p.kind === 'box' && p.role === 'bayWall');
  for (const w of walls) assert.equal((w as { taperAmount?: number }).taperAmount, undefined);
});

test('a deep walk-in position gets a graded entry stair; a tight fighting hole does not', () => {
  // Regression guard for R6. The bunker is deep AND roomy front-to-back (8 ft) → walk-in stair.
  const deep = buildScene3D(compute(defaultInputs({ positionType: 'bunker_op_cp' })));
  const steps = deep.parts.filter((p) => p.kind === 'box' && p.role === 'entryStep') as Array<{ y: number; h: number; z: number }>;
  assert.ok(steps.length >= 2, 'a deep walk-in cut has ≥2 entry steps');
  for (const s of steps) {
    assert.ok(s.y + s.h / 2 < 0, 'every step top is below grade');
    assert.ok(s.z > 0, 'entry steps sit at the rear (+z), the entrance side');
  }
  // A 2-ft-deep (front-to-back) fighting hole is a drop-in — a staircase would eat the whole
  // floor, so it gets none.
  const tight = buildScene3D(compute(defaultInputs({ positionType: 'two_man', revetment: 'none' })));
  assert.equal(tight.parts.filter((p) => p.kind === 'box' && p.role === 'entryStep').length, 0, 'a tight fighting hole has no entry steps');
  // Entry steps are a deliberate-stage feature (stage 2): absent during the hasty scrape.
  const hasty = buildScene3D(compute(defaultInputs({ positionType: 'bunker_op_cp' })), { stage: 1 });
  assert.equal(hasty.parts.filter((p) => p.kind === 'box' && p.role === 'entryStep').length, 0, 'no entry steps at the hasty stage');
});

test('the vehicle position is a graded ramp into a level pan, not a staircase', () => {
  // Regression guard for R7: the floor is exactly two boxes — one sheared ramp + one flat pan.
  const scene = buildScene3D(compute(defaultInputs({ positionType: 'vehicle_hull_defilade' })));
  const floors = scene.parts.filter((p) => p.kind === 'box' && p.role === 'bayFloor') as Array<{ shearDrop?: number }>;
  assert.equal(floors.length, 2, 'exactly two floor parts: one graded ramp + one level pan');
  const ramps = floors.filter((f) => (f.shearDrop ?? 0) > 0);
  assert.equal(ramps.length, 1, 'exactly one sheared ramp with a real grade');
});

test('the L-shape scale figure stands clear of the +x crew arm (on the −x side)', () => {
  // Regression guard for R9: fifty_cal / atgm_javelin dig a +x arm, so the figure moves to −x.
  for (const positionType of ['fifty_cal', 'atgm_javelin']) {
    const scene = buildScene3D(compute(defaultInputs({ positionType })));
    const fig = scene.parts.find((p) => p.kind === 'figure') as { x: number } | undefined;
    assert.ok(fig && fig.x < 0, positionType + ' figure is on the clear −x side');
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
