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

test('the 3D engineered-roof hazard marker\'s footprint matches the 2D section\'s exactly (holeW/holeL + parapetW)', () => {
  // Neither view fabricates a real structure here (§2.7) so there's no doctrine leaf sizing this
  // marker, but the two views of the same "needs an engineer" flag must still agree on how big a
  // banner they draw — the 3D box previously used a flat +1.5 ft/side constant that didn't match
  // the 2D section's +parapetW (3.0 ft for one_man), leaving the views 1.5 ft apart per side.
  for (const threat of ['at-rpg', 'at-tank', 'at-he-contact', 'blast-vbied']) {
    const r = compute(defaultInputs({ positionType: 'one_man', overheadCover: true, threat, sump: false }));
    const geo = r.geometry as { section: { roofPath: string }; plan: { holeL: number; holeW: number; parapetW: number } };
    assert.equal(geo.section.roofPath, 'engineered_required', threat + ': fixture must exercise the engineered path');
    const scene = buildScene3D(r);
    const hazard = scene.parts.find((p) => p.kind === 'box' && p.role === 'engineeredCover') as { w: number; d: number } | undefined;
    assert.ok(hazard, threat + ': hazard marker present');
    const expectedW = geo.plan.holeL + geo.plan.parapetW;
    const expectedD = geo.plan.holeW + geo.plan.parapetW;
    assert.ok(Math.abs(hazard!.w - expectedW) < 1e-9, threat + ': 3D hazard width ' + hazard!.w + ' != holeL+parapetW ' + expectedW);
    assert.ok(Math.abs(hazard!.d - expectedD) < 1e-9, threat + ': 3D hazard depth ' + hazard!.d + ' != holeW+parapetW ' + expectedD + ' (2D section\'s own hazard-block formula)');
  }
});

test('the 3D roof recovers exactly the published footprint — both edges, both ends, uncapped stringers', () => {
  // geo.section.roof is the ONE footprint the bill and both drawings read, published as OUTWARD
  // extents and as absolute edge coordinates in the section's own frame. The 3D cover box must
  // recover them from its own geometry, front and rear independently (no symmetry assumed), or
  // the views disagree about where a safety-critical edge is.
  for (const threat of ['sa-556', 'ind-mtr-81', 'ind-art-105', 'ind-art-155', 'blast-demo']) {
    const r = compute(defaultInputs({ positionType: 'one_man', overheadCover: true, threat, sump: false }));
    const geo = r.geometry as { section: { roof: { frontEdgeFt: number; rearEdgeFt: number; endEdgeFt: number; frontFt: number; rearFt: number; endFt: number; entranceNotchFt: number; stringer: { count: number; sectionFt: number } } | null; roofPath: string }; plan: { holeW: number } };
    assert.equal(geo.section.roofPath, 'earth_on_stringers', threat + ': fixture must exercise the earth roof path');
    const roof = geo.section.roof!;
    const scene = buildScene3D(r);
    const cover = scene.parts.find((p) => p.kind === 'box' && p.role === 'cover') as { x: number; z: number; w: number; d: number } | undefined;
    assert.ok(cover, threat + ': cover box present');
    const frontEdgeZ = cover!.z - cover!.d / 2;
    const rearEdgeZ = cover!.z + cover!.d / 2;
    assert.ok(Math.abs(frontEdgeZ - roof.frontEdgeFt) < 1e-9, threat + ': 3D front edge ' + frontEdgeZ.toFixed(3) + ' != published ' + roof.frontEdgeFt.toFixed(3));
    assert.ok(Math.abs(rearEdgeZ - roof.rearEdgeFt) < 1e-9, threat + ': 3D rear edge ' + rearEdgeZ.toFixed(3) + ' != published ' + roof.rearEdgeFt.toFixed(3));
    // The ENDS take the flank lap, not the rear figure — the 3D used to reuse the rear bearing
    // on the x axis, applying a bearing requirement where no stringer bears.
    assert.ok(Math.abs(cover!.w / 2 - roof.endEdgeFt) < 1e-9, threat + ': 3D end edge != published endEdgeFt');
    assert.ok(roof.frontFt > roof.endFt || roof.frontFt === roof.endFt, threat + ': ends and edges are separate quantities');
    // Every stringer the BOM bills is drawn, at the section the engine resolved for the span —
    // the old cap of 8 and the fixed 0.35 × 0.30 ft beam are both gone.
    const beams = scene.parts.filter((p) => p.kind === 'box' && p.role === 'stringer') as Array<{ w: number; h: number; d: number }>;
    assert.equal(beams.length, roof.stringer.count, threat + ': drawn stringer count == billed count');
    for (const b of beams) {
      assert.ok(Math.abs(b.w - roof.stringer.sectionFt) < 1e-9 && Math.abs(b.h - roof.stringer.sectionFt) < 1e-9, threat + ': beam drawn at its resolved section');
      assert.ok(Math.abs(b.d - (roof.rearEdgeFt - roof.frontEdgeFt)) < 1e-9, threat + ': beams run FRONT-TO-BACK across the whole deck, onto their bearing at both ends');
    }
  }
});

test('the uncapped stringer count reaches the view that used to draw eight of them', () => {
  // Measured at HEAD: connecting_trench billed 16 and drew 8; bunker_op_cp 11 → 8; fifty_cal
  // 10 → 8; mg_crew 9 → 8. The picture and the bill counted different roofs.
  for (const positionType of ['connecting_trench', 'bunker_op_cp', 'fifty_cal', 'mg_crew']) {
    const r = compute(defaultInputs({ positionType, overheadCover: true, threat: 'ind-mtr-81' }));
    const billed = r.bom.find((l) => l.id === 'stringers')!.qtyPerPosition;
    assert.ok(billed > 8, positionType + ': fixture must bill more stringers than the old cap');
    const drawn = buildScene3D(r).parts.filter((p) => p.kind === 'box' && p.role === 'stringer').length;
    assert.equal(drawn, billed, positionType + ': drew ' + drawn + ' of ' + billed + ' billed stringers');
  }
});

test('the bunker\'s roof leaves its own entrance open, and the stringers keep their rear bearing', () => {
  const r = compute(defaultInputs({ positionType: 'bunker_op_cp', overheadCover: true, threat: 'ind-mtr-81' }));
  const geo = r.geometry as { section: { roof: { entranceNotchFt: number; rearEdgeFt: number; frontEdgeFt: number; endEdgeFt: number } | null; holeW: number } };
  const roof = geo.section.roof!;
  assert.ok(roof.entranceNotchFt > 0, 'the fixture is the roofed position');
  const scene = buildScene3D(r);
  const covers = scene.parts.filter((p) => p.kind === 'box' && p.role === 'cover') as Array<{ x: number; z: number; w: number; d: number }>;
  assert.equal(covers.length, 3, 'a main deck plus the two rear wings flanking the notch');
  // Nothing covers the corridor: the notch centreline is clear behind the rear wall line.
  const rearOfWall = covers.filter((c) => c.z + c.d / 2 > geo.section.holeW / 2 + 1e-9);
  for (const c of rearOfWall) {
    assert.ok(Math.abs(c.x) - c.w / 2 >= roof.entranceNotchFt / 2 - 1e-9, 'no deck over the entrance corridor');
  }
  // The stringers are NOT shortened — R10's acceptance criterion is that their ends still bear
  // on undisturbed ground, which a deck trim would have taken away from every one of them.
  const beams = scene.parts.filter((p) => p.kind === 'box' && p.role === 'stringer') as Array<{ d: number }>;
  assert.ok(beams.length > 0);
  for (const b of beams) assert.ok(Math.abs(b.d - (roof.rearEdgeFt - roof.frontEdgeFt)) < 1e-9, 'every stringer keeps its full front and rear bearing');
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

test('flared bay walls get a double-tapered corner post — no void where two walls meet', () => {
  // The regression this pins (docs/REALISM_PASS_3D_PLAN.md R4): each bay wall only tapers its
  // OWN outer face (front/rear flare on z, left/right flare on x), so a flared excavation left a
  // triangular gap at all 4 corners — nothing occupied the diagonal between two adjacent walls'
  // flared edges. A corner post, double-tapered (same amount, both axes), fills it.
  // Scoped to single-bay shapes (one pushBayBox call ⇒ unambiguously 4 corners) — an L-shape/
  // inverted-T's extra arm calls pushBayBox again for its own 4, which this test isn't about.
  for (const positionType of ['one_man', 'two_man', 'connecting_trench', 'bunker_op_cp']) {
    const r = compute(defaultInputs({ positionType, soil: 'loam', standard: 'reinforced', revetment: 'none' }));
    const scene = buildScene3D(r);
    const walls = scene.parts.filter((p) => p.kind === 'box' && p.role === 'bayWall') as Array<{
      x: number; z: number; w: number; d: number;
      taperAxis?: 0 | 2; taperSign?: 1 | -1; taperAmount?: number;
      taperAxis2?: 0 | 2; taperSign2?: 1 | -1;
    }>;
    const edges = walls.filter((w) => w.taperAxis2 === undefined);
    const corners = walls.filter((w) => w.taperAxis2 !== undefined);
    assert.equal(corners.length, 4, positionType + ' needs exactly 4 corner posts');
    for (const c of corners) {
      assert.ok((c.taperAmount ?? 0) > 0, positionType + ' corner post must actually flare');
      const alongZ = edges.find((w) => w.taperAxis === c.taperAxis && w.taperSign === c.taperSign);
      const alongX = edges.find((w) => w.taperAxis === c.taperAxis2 && w.taperSign === c.taperSign2);
      assert.ok(alongZ, positionType + ' corner post has a matching front/rear wall');
      assert.ok(alongX, positionType + ' corner post has a matching left/right wall');
      // Same row/column as each neighbor (post sits exactly at their shared corner) and the same
      // taper magnitude (so the flared tips actually meet, not just the unflared base).
      assert.ok(Math.abs(c.z - alongZ!.z) < 1e-6, positionType + ' post z aligns with its front/rear wall');
      assert.ok(Math.abs(c.x - alongX!.x) < 1e-6, positionType + ' post x aligns with its left/right wall');
      assert.equal(c.taperAmount, alongZ!.taperAmount, positionType + ' post tapers exactly as much as the front/rear wall');
      assert.equal(c.taperAmount, alongX!.taperAmount, positionType + ' post tapers exactly as much as the left/right wall');
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

test('firing positions close the parapet on all four sides; a connecting trench stays open (task #26, ATP 3-21.8)', () => {
  // ATP 3-21.8 specifies front, flank, AND rear retaining walls — no primary source (Army or
  // USMC) was found describing an intentionally open rear. A connecting trench is the exception:
  // it has no directional aperture because it IS the through-corridor doctrine routes movement
  // through, so walling its rear would block its own purpose.
  for (const positionType of ['one_man', 'two_man', 'mg_crew', 'fifty_cal', 'atgm_javelin']) {
    const r = compute(defaultInputs({ positionType, revetment: 'none' }));
    const frame = buildScene3D(r).parts.find((p) => p.kind === 'frame' && p.role === 'earthParapet') as { closedRear: boolean } | undefined;
    assert.ok(frame, positionType + ' has an earth parapet frame');
    assert.equal(frame!.closedRear, true, positionType + ' closes the rear per ATP 3-21.8');
  }
  const trench = buildScene3D(compute(defaultInputs({ positionType: 'connecting_trench', revetment: 'none' })));
  const trenchFrame = trench.parts.find((p) => p.kind === 'frame' && p.role === 'earthParapet') as { closedRear: boolean } | undefined;
  assert.ok(trenchFrame, 'connecting trench has an earth parapet frame');
  assert.equal(trenchFrame!.closedRear, false, 'a connecting trench stays open — it is the through-corridor, not a self-contained position');
});

test('a revetted wall never tapers, regardless of how steep the soil would otherwise require', () => {
  const r = compute(defaultInputs({ soil: 'sand', revetment: 'sandbag_facing' }));
  const scene = buildScene3D(r);
  const walls = scene.parts.filter((p) => p.kind === 'box' && p.role === 'bayWall');
  for (const w of walls) assert.equal((w as { taperAmount?: number }).taperAmount, undefined);
});

test('a deep walk-in position gets a graded entry stair; a tight fighting hole does not', () => {
  // Regression guard for R6. The bunker is deep AND roomy front-to-back (8 ft) → walk-in stair.
  const deepResult = compute(defaultInputs({ positionType: 'bunker_op_cp' }));
  const deep = buildScene3D(deepResult);
  const steps = deep.parts.filter((p) => p.kind === 'box' && p.role === 'entryStep') as Array<{ y: number; h: number; z: number }>;
  assert.ok(steps.length >= 2, 'a deep walk-in cut has ≥2 entry steps');
  for (const s of steps) assert.ok(s.y + s.h / 2 < 0, 'every step top is below grade');
  // The flight starts at the REAR inner wall (+z, the entrance side — never through the frontal
  // parapet facing the threat) and marches forward as it drops. It used to be asserted as "every
  // step has z > 0", which held only because there were exactly two of them; a stair with risers
  // a person can climb needs real run, and on the bunker's 6.5 ft cut that run reaches just past
  // the bay's centreline. Anchored-at-the-rear plus monotonic descent is the invariant that was
  // actually meant, and it says more than the old one did.
  const byDepth = [...steps].sort((a, b) => (b.y + b.h / 2) - (a.y + a.h / 2));
  assert.ok(byDepth[0]!.z > 0, 'the flight starts at the rear (+z), the entrance side');
  for (let i = 1; i < byDepth.length; i++) {
    assert.ok(byDepth[i]!.z < byDepth[i - 1]!.z, 'each step is further forward than the one above it');
  }
  // And every riser is one a person can actually climb. The count used to be a flat two treads
  // sharing whatever the cut happened to be: measured at HEAD, the bunker's 6.5 ft cut gave a
  // 2.167 ft (26 in) rise on a 6-in tread, which is a fall with a ledge, not a way down.
  const access = (deepResult.geometry as { section: { access: { stairMaxRiserFt: number } } }).section.access;
  const depth = (deepResult.geometry as { section: { depthOfCut: number } }).section.depthOfCut;
  const tops = steps.map((s) => -(s.y + s.h / 2)).sort((a, b) => a - b);
  let previous = 0;
  for (const t of tops) {
    assert.ok(t - previous <= access.stairMaxRiserFt + 1e-9, 'riser ' + (t - previous).toFixed(3) + ' ft exceeds the climbable rise ' + access.stairMaxRiserFt);
    previous = t;
  }
  assert.ok(depth - previous <= access.stairMaxRiserFt + 1e-9, 'the last step down to the floor is climbable too');
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
