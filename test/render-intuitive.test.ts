// §10 / §17 render.intuitive — the drawings must be immediately readable: header bar per
// view, numbered callouts tied to ONE shared legend (numbers consistent within & across
// views), loud orientation, single-accent dimensions, an explicit scale, legible minimum type,
// pattern redundancy beyond hue, and no colliding dimension labels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { drawPlan } from '../src/render/drawPlan';
import { drawSection } from '../src/render/drawSection';
import { drawIso } from '../src/render/drawIso';
import { buildScene3D } from '../src/render3d/scene3d';
import { positions } from '../src/doctrine/positions';
import { overhead } from '../src/doctrine/protection';
import type { GeometryModel } from '../src/engine/geometry';
import { defaultInputs } from './helpers';

// (label, number) for every callout disc; plus the same split into body vs legend.
const CALLOUT_RE = /<g class="callout" aria-label="([^"]+)"><circle[^>]*\/><text[^>]*>(\d+)<\/text><\/g>/g;

function callouts(svg: string): { label: string; n: number }[] {
  const out: { label: string; n: number }[] = [];
  for (const m of svg.matchAll(CALLOUT_RE)) out.push({ label: m[1]!, n: Number(m[2]) });
  return out;
}

function splitLegend(svg: string): { body: string; legend: string } {
  const i = svg.indexOf('<g class="legend">');
  return i < 0 ? { body: svg, legend: '' } : { body: svg.slice(0, i), legend: svg.slice(i) };
}

function assertCalloutLegendConsistent(svg: string, ctx: string): void {
  const { body, legend } = splitLegend(svg);
  assert.ok(legend.length > 0, ctx + ': has a legend');

  // A number maps to exactly one label everywhere it appears.
  const numToLabel = new Map<number, string>();
  for (const c of callouts(svg)) {
    const prev = numToLabel.get(c.n);
    if (prev !== undefined) assert.equal(prev, c.label, ctx + ': number ' + c.n + ' drifts label');
    else numToLabel.set(c.n, c.label);
  }

  // Every callout drawn in the body appears in the legend, and vice-versa.
  const bodyLabels = new Set(callouts(body).map((c) => c.label));
  const legendLabels = new Set(callouts(legend).map((c) => c.label));
  for (const l of bodyLabels) assert.ok(legendLabels.has(l), ctx + ': "' + l + '" drawn but not in legend');
  for (const l of legendLabels) assert.ok(bodyLabels.has(l), ctx + ': "' + l + '" in legend but not drawn');
}

function assertMinFont(svg: string, ctx: string): void {
  for (const m of svg.matchAll(/font-size="([\d.]+)"/g)) {
    assert.ok(Number(m[1]) >= 9, ctx + ': font-size ' + m[1] + ' below legibility floor');
  }
}

// Dimension-label background rects must not grossly overlap (§10 bounding-box avoidance).
function dimRects(svg: string): { x: number; y: number; w: number; h: number }[] {
  const re = /<rect x="([\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="var\(--surface\)" opacity="0.9"/g;
  const out = [];
  for (const m of svg.matchAll(re)) out.push({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) });
  return out;
}
function overlapArea(a: { x: number; y: number; w: number; h: number }, b: typeof a): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}
function assertNoDimCollision(svg: string, ctx: string): void {
  const rects = dimRects(svg);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!, b = rects[j]!;
      const minArea = Math.min(a.w * a.h, b.w * b.h);
      assert.ok(overlapArea(a, b) <= 0.6 * minArea, ctx + ': dimension labels collide');
    }
  }
}

test('plan carries header, loud orientation, A–A cross-ref, and consistent callouts/legend', () => {
  const plan = drawPlan(compute(defaultInputs({ positionType: 'mg_crew', firingStep: true })));
  assert.ok(plan.includes('PLAN VIEW'), 'header bar title');
  assert.ok(plan.includes('>ENEMY<'), 'ENEMY label');
  assert.ok(plan.includes('marker-end="url(#mk-arrow)"'), 'enemy arrow');
  assert.ok(plan.includes('>FRONT<') && plan.includes('>REAR<'), 'FRONT/REAR labeled');
  assert.equal((plan.match(/class="cut-marker"/g) ?? []).length, 2, 'two A–A cut markers');
  assert.ok(!plan.includes('(PH)'), 'no placeholder flags shown on dimensions');
  assert.ok(plan.includes('var(--dim)'), 'dimensions in the single accent');
  assertCalloutLegendConsistent(plan, 'plan');
  assertMinFont(plan, 'plan');
  assertNoDimCollision(plan, 'plan');
});

test('section carries header, standing figure + scale, single-accent dims, cover redundancy', () => {
  const section = drawSection(compute(defaultInputs()));
  assert.ok(section.includes('SECTION A–A'), 'header bar title');
  assert.ok(/ref ~5/.test(section), 'standing figure reference height');
  assert.ok(section.includes('class="scale"'), 'scale bar');
  assert.ok(section.includes('>FRONT<') && section.includes('>REAR<'), 'FRONT/REAR labeled');
  assert.ok(!section.includes('(PH)') && section.includes('var(--dim)'), 'single-accent dimensions, no placeholder flags');
  assert.ok(section.includes('url(#pat-cover)') || section.includes('url(#pat-earth)'), 'pattern redundancy beyond hue');
  assertCalloutLegendConsistent(section, 'section');
  assertMinFont(section, 'section');
  assertNoDimCollision(section, 'section');
});

test('a firing platform never draws wider/longer than the hole it\'s built in', () => {
  // fifty_cal's doctrine firingPlatform.W (3.0 ft) exceeds its own hole.W (2.0 ft) — drawn at
  // full size the platform overhangs the excavation by 1 ft in both the plan and the 3D model,
  // a standing surface floating past the wall of the hole it's supposedly built in. geo.plan.
  // platform is clamped to the hole's own L/W so the DRAWING never claims a platform bigger
  // than the hole that contains it; the BOM/labor volume is untouched (still the true doctrine
  // value, via compute.ts's platformVol) since this is a rendering-only clamp.
  for (const [id, pos] of Object.entries(positions)) {
    if (!pos.firingPlatform) continue;
    const r = compute(defaultInputs({ positionType: id }));
    const geo = r.geometry as GeometryModel;
    assert.ok(geo.plan.platform, id + ': platform present');
    assert.ok(geo.plan.platform!.W <= geo.plan.holeW + 1e-9, id + ": drawn platform.W (" + geo.plan.platform!.W + ") must not exceed hole.W (" + geo.plan.holeW + ")");
    assert.ok(geo.plan.platform!.L <= geo.plan.holeL + 1e-9, id + ": drawn platform.L (" + geo.plan.platform!.L + ") must not exceed hole.L (" + geo.plan.holeL + ")");

    // Cross-check the 3D model's platform box uses the SAME clamped footprint, not the raw
    // doctrine value directly (it reads geo.plan.platform, so this mostly guards against a
    // future refactor that reintroduces a second, unclamped read of the doctrine leaf).
    const scene = buildScene3D(r);
    const platformBox = scene.parts.find((p) => p.kind === 'box' && p.role === 'platform') as { d: number; w: number } | undefined;
    assert.ok(platformBox, id + ': 3D platform box present');
    assert.ok(platformBox!.d <= geo.plan.holeW + 1e-9, id + ': 3D platform depth must not exceed the hole either');
  }
});

test('the section\'s grenade sump sits at the REAR, matching the plan\'s own sump marks and the 3D model', () => {
  // geometry.ts's sumpMarks() places every sump "near the rear wall" (yFt > 0), and scene3d.ts
  // reads that same yFt straight through for the 3D sump box — but drawSection.ts's sump notch
  // used to be anchored at -halfBay*0.85 (the FRONT), directly under the front-sited firing
  // step/platform. On a narrow position that put the sump notch visually on top of the firing
  // step in the very same picture (two_man's 2 ft front-to-back caught it); on every position it
  // silently drew the sump on the opposite wall from its own plan view and 3D model.
  for (const positionType of ['one_man', 'two_man', 'mg_crew']) {
    const r = compute(defaultInputs({ positionType, sump: true, firingStep: true, overheadCover: false }));
    const geo = r.geometry as GeometryModel;
    for (const s of geo.plan.sumps) assert.ok(s.yFt > 0, positionType + ": plan's own sump marks sit at the rear (yFt > 0)");

    const section = drawSection(r);
    // Positions with a structural firing PLATFORM (mg_crew) also draw a draw-timber rect for
    // it, before the sump — so match by proximity to the sump's own callout label, not just
    // "the first draw-timber rect", or a platform-carrying position would grab the wrong one.
    const sumpLabelIdx = section.indexOf('aria-label="Grenade catch-pit (sump)"');
    assert.ok(sumpLabelIdx > 0, positionType + ': sump callout label present');
    const rectRe = /<rect x="([\d.]+)"[^>]*fill="var\(--draw-timber\)"/g;
    let sumpMatch: RegExpExecArray | null = null;
    for (let m = rectRe.exec(section); m; m = rectRe.exec(section)) {
      if (m.index < sumpLabelIdx) sumpMatch = m;
    }
    assert.ok(sumpMatch, positionType + ': sump notch drawn');
    const bayMatch = section.match(/<polygon points="([\d.,\- ]+)" fill="var\(--draw-bay\)"/);
    assert.ok(bayMatch, positionType + ': bay polygon present');
    const bayXs = bayMatch![1]!.split(' ').map((pt) => Number(pt.split(',')[0]));
    const bayCenterX = (Math.min(...bayXs) + Math.max(...bayXs)) / 2;
    const sumpX = Number(sumpMatch![1]);
    assert.ok(sumpX > bayCenterX, positionType + ": sump notch sits right of the bay's own center (rear, since FRONT is drawn on the left)");
  }
});

test('the section draws an unrevetted earth wall sloped per soil, and a revetted wall perfectly plumb', () => {
  // Doctrine (soils.<id>.wallSlopeRatio) says an unrevetted wall in loose soil battens outward —
  // the 3D model has drawn this for a while (scene3d.ts's pushBayBox), but the 2D section always
  // drew a plumb rectangle regardless of soil, silently contradicting the 3D view of the SAME
  // position. geo.section.wallTaper is the shared, doctrine-driven value both views now read.
  const silt = compute(defaultInputs({ positionType: 'one_man', soil: 'silt', revetment: 'none' }));
  const siltGeo = silt.geometry as GeometryModel;
  assert.ok(siltGeo.section.wallTaper > 0, 'silt (wallSlopeRatio 0.75) with no revetment must taper');

  const siltSection = drawSection(silt);
  const bayPoly = siltSection.match(/<polygon points="([^"]+)" fill="var\(--draw-bay\)"/);
  assert.ok(bayPoly, 'bay is drawn as a polygon (trapezoid), not a rect, when tapered');
  const xs = bayPoly![1]!.split(' ').map((p) => Number(p.split(',')[0]));
  // 4 points: floor-left, floor-right, grade-right, grade-left. A taper widens the grade pair
  // relative to the floor pair — grade-right.x > floor-right.x and grade-left.x < floor-left.x.
  assert.equal(xs.length, 4, 'bay polygon has exactly 4 points');
  const [floorLx, floorRx, gradeRx, gradeLx] = xs as [number, number, number, number];
  assert.ok(gradeRx > floorRx, 'grade-level right edge sits outboard of the floor edge (flares out)');
  assert.ok(gradeLx < floorLx, 'grade-level left edge sits outboard of the floor edge (flares out)');

  // Revetment holds the wall vertical regardless of soil (the facing IS the structure) —
  // wallTaper must be exactly 0, and the same silt soil now draws a plumb-walled rect/degenerate
  // trapezoid (grade edges collapse onto the floor edges).
  const revetted = compute(defaultInputs({ positionType: 'one_man', soil: 'silt', revetment: 'sandbag_facing' }));
  const revettedGeo = revetted.geometry as GeometryModel;
  assert.equal(revettedGeo.section.wallTaper, 0, 'a revetted wall never tapers, regardless of soil');
});

test('one_man never draws a firing step in 2D, even with the toggle on (modeling spec §2.f)', () => {
  // compute.ts forces firingStepOn false for one_man regardless of the input toggle (an
  // armpit-deep hole is dug for standing fire and takes no step — the section/plan drawings
  // must never teach a feature the doctrine forbids). The 3D view already has a dedicated test
  // for this (scene3d-stages.test.ts); this locks down the SAME invariant for the 2D views,
  // which had no direct coverage.
  const on = compute(defaultInputs({ positionType: 'one_man', firingStep: true }));
  const off = compute(defaultInputs({ positionType: 'one_man', firingStep: false }));
  assert.equal((on.geometry as GeometryModel).section.firingStepOn, false, 'firingStepOn forced false even with the toggle on');
  assert.equal((on.geometry as GeometryModel).plan.platform, null, 'one_man has no structural firing platform');

  const sectionOn = drawSection(on);
  const sectionOff = drawSection(off);
  assert.equal(sectionOn, sectionOff, 'the firingStep toggle produces byte-identical section output for one_man');
  assert.ok(!sectionOn.includes('Step up to shoot'), 'no firing-step callout in the section, toggle on or off');

  const planOn = drawPlan(on);
  assert.ok(!planOn.includes('Step up to shoot'), 'no firing-step callout in the plan either');

  // Positive control: a position that DOES take a firing-step ledge still shows one, so this
  // isn't testing a feature that's broken/missing everywhere.
  const twoMan = compute(defaultInputs({ positionType: 'two_man', firingStep: true }));
  assert.ok(drawSection(twoMan).includes('Step up to shoot'), 'two_man keeps its firing-step ledge');
});

test('positions with no modeled aiming direction (sectorsOfFire: false) never draw a firing step either', () => {
  // "Step up TO SHOOT" only makes sense for a position that aims over its own front wall in the
  // first place. mortar_pit fires high-angle indirect (laid by aiming stakes/FDC data, not
  // sighted over a parapet); the vehicle defilades fire from the vehicle's own sights, not a
  // dismounted soldier on a dug ledge; bunker_op_cp and connecting_trench have no facing
  // direction at all (same reason their plan view already omits FRONT/REAR). None of the five
  // has sectorsOfFire, and none had this checked before — compute.ts's firingStepOn only ever
  // excluded one_man specifically, for an unrelated (armpit-deep) reason.
  for (const positionType of ['mortar_pit', 'vehicle_hull_defilade', 'vehicle_turret_defilade', 'bunker_op_cp', 'connecting_trench']) {
    assert.equal(positions[positionType]?.sectorsOfFire, false, positionType + ': fixture assumption — must have no modeled aiming direction');
    const r = compute(defaultInputs({ positionType, firingStep: true }));
    const geo = r.geometry as GeometryModel;
    assert.equal(geo.section.firingStepOn, false, positionType + ": firingStepOn forced false even with the toggle on");
    assert.ok(!drawSection(r).includes('Step up to shoot'), positionType + ': no firing-step callout in the section');
    assert.ok(!drawPlan(r).includes('Step up to shoot'), positionType + ': no firing-step callout in the plan');
  }
});

test('engineered roof is drawn honestly (hazard block, no fabricated earth cover)', () => {
  const section = drawSection(compute(defaultInputs({ positionType: 'bunker_op_cp', threat: 'at-he-contact' })));
  assert.ok(section.includes('ENGINEERED ROOF — SEE ENGINEER'), 'engineered hazard label');
  assert.ok(section.includes('url(#pat-engineered)'), 'engineered hazard pattern');
  assert.ok(!section.includes('url(#pat-cover)'), 'no earth-cover slab for an engineered roof');
});

test('a vehicle defilade never draws a roof or engineered-hazard block, matching the 3D model', () => {
  // scene3d.ts has always excluded vehicle_ramp from both the earth-roof and engineered-hazard
  // branches (nobody ever designed a "roof over a vehicle pit" geometry — there's no parapet for
  // it to span between). drawSection.ts had no such exclusion: for a threat resolving to
  // engineered_required, it drew the same "ENGINEERED ROOF — SEE ENGINEER" hazard block for a
  // vehicle position that the 3D model correctly omitted for the identical position/threat. The
  // underlying calc.roofPath/coverOn are deliberately left untouched (they still feed the specs
  // panel and ROOF_SPAN_EXCEEDED correctly) — only the schematic's attempt to draw an undesigned
  // shape is suppressed, so this is a rendering-only fix, not an engine/validation change.
  for (const positionType of ['vehicle_hull_defilade', 'vehicle_turret_defilade']) {
    // Every vehicle's clear span (12 ft) exceeds the stringer table on its own, so roofPath is
    // 'engineered_required' for ANY threat once overhead cover is requested (span-forced, not
    // just threat-forced) — 'earth_on_stringers' is unreachable for this shape family, which is
    // exactly why ROOF_SPAN_EXCEEDED's own test fixture is a vehicle position.
    const r = compute(defaultInputs({ positionType, overheadCover: true, threat: 'sa-556' }));
    const geo = r.geometry as GeometryModel;
    assert.equal(geo.section.roofPath, 'engineered_required', positionType + ': fixture must exercise the (span-forced) engineered path');
    const section = drawSection(r);
    assert.ok(!section.includes('ENGINEERED ROOF — SEE ENGINEER'), positionType + ': no engineered hazard block drawn');
    assert.ok(!section.includes('url(#pat-engineered)'), positionType + ': no engineered hazard pattern');
    assert.ok(!section.includes('url(#pat-cover)'), positionType + ': no earth-cover slab drawn either');
  }
});

test('the roof\'s rear overhang is the structural bearing shelf, not the parapet\'s own thickness', () => {
  // geo.section.rearOverhang = max(bearingEachEnd, setbackDepthFrac * depthOfCut) — a doctrine
  // leaf about how far stringers must land on undisturbed earth, NOT parapetW (an unrelated
  // doctrine value: how thick the earthen parapet WALL is). Reusing parapetW here previously
  // overstated the roof's rear extent by ~2-3x versus the same bearing-shelf math the front
  // edge and the 3D model both use — this pins rearOverhang to its own formula so a future edit
  // can't silently swap back to parapetW (drawSection.ts's slabX2) without a test noticing.
  for (const [standard, threat] of [['hasty', 'sa-556'], ['deliberate', 'sa-556'], ['reinforced', 'sa-556'], ['deliberate', 'ind-art-155']] as const) {
    const r = compute(defaultInputs({ positionType: 'one_man', overheadCover: true, standard, threat, sump: false }));
    const geo = r.geometry as GeometryModel;
    const expected = Math.max(overhead.bearingEachEnd.value, overhead.setbackDepthFrac.value * geo.section.depthOfCut);
    assert.ok(
      Math.abs(geo.section.rearOverhang - expected) < 1e-9,
      standard + '/' + threat + ': rearOverhang ' + geo.section.rearOverhang + ' != bearing-shelf formula ' + expected,
    );
    assert.notEqual(geo.section.rearOverhang, geo.section.parapetW, standard + '/' + threat + ': rearOverhang must not equal parapetW');
  }
});

test('sectors of fire render for positions that have them, with the enemy arrow', () => {
  let sawSectors = false;
  for (const positionType of Object.keys(positions)) {
    const plan = drawPlan(compute(defaultInputs({ positionType })));
    if (plan.includes('aria-label="Sectors of fire"')) {
      sawSectors = true;
      assert.ok(plan.includes('fill="var(--enemy)"'), positionType + ': sector wedge uses enemy accent');
      assert.ok(plan.includes('>ENEMY<'), positionType + ': enemy arrow present with sectors');
    }
  }
  assert.ok(sawSectors, 'at least one position renders sectors of fire');
});

test('bunker_op_cp gets a real parapet ring, ENEMY arrow, and FRONT/REAR labels — it is not a through-corridor', () => {
  // isOpenCorridor's own comment claims connecting_trench is the ONLY rect-family position with
  // sectorsOfFire: false (mortar_pit/vehicles are excluded by shape already) — but bunker_op_cp
  // is ALSO sectorsOfFire: false (the app doesn't model a numeric sector angle for an OP/bunker),
  // and its shape id wasn't excluded, so it silently got the same "no facing direction" treatment
  // as connecting_trench: no parapet ring drawn in plan, no ENEMY arrow, no FRONT/REAR labels —
  // even though a bunker/OP-CP plainly has a front and its own real sandbag walls, unlike a
  // through-route trench with nothing to face.
  const bunker = compute(defaultInputs({ positionType: 'bunker_op_cp' }));
  const plan = drawPlan(bunker);
  assert.ok(plan.includes('>ENEMY<'), 'bunker_op_cp gets the enemy-direction arrow');
  assert.ok(plan.includes('>FRONT<') && plan.includes('>REAR<'), 'bunker_op_cp gets FRONT/REAR labels');
  assert.ok(plan.includes('aria-label="Dirt wall up front (parapet)"'), 'bunker_op_cp draws its own parapet ring');

  // Positive control: connecting_trench is the genuine through-corridor and must still get NONE
  // of these — this fix must not have accidentally widened the exclusion the other direction.
  const trench = drawPlan(compute(defaultInputs({ positionType: 'connecting_trench' })));
  assert.ok(!trench.includes('>ENEMY<'), 'connecting_trench still has no facing direction');
  assert.ok(!trench.includes('>FRONT<'), 'connecting_trench still has no FRONT/REAR labels');
});

test('atgm_javelin draws its safety-critical backblast danger area to the rear; nothing else does', () => {
  // doctrine/positions.ts's backblast.clearanceFt is flagged safetyCritical: true, but until now
  // it only ever surfaced as a text warning (validate.ts's ATGM_BACKBLAST) — never drawn, unlike
  // every other safety-relevant dimension this app draws to scale (roof setback, standoff, wall
  // taper). A hazard the operator must physically keep clear of but can't see on the plan is a
  // real gap, not just a documentation nicety.
  const atgm = compute(defaultInputs({ positionType: 'atgm_javelin' }));
  const plan = drawPlan(atgm);
  assert.ok(plan.includes('aria-label="Backblast danger area — keep clear"'), 'backblast hazard zone drawn with its own callout');
  assert.ok(plan.includes('url(#pat-engineered)'), 'reuses the established hazard pattern, not a new one');
  assert.ok(plan.includes(">25'-0\"<") || plan.includes('>25.0'), 'the 25 ft clearance is dimensioned, not just implied');

  // Positive control: a position with no backblast concern draws none of this.
  const oneMan = drawPlan(compute(defaultInputs({ positionType: 'one_man' })));
  assert.ok(!oneMan.includes('Backblast'), 'one_man has no backblast hazard to draw');
});

test('elbow rests render for positions that define them, at the front lip not the rear', () => {
  const oneMan = compute(defaultInputs({ positionType: 'one_man' }));
  const oneManGeo = oneMan.geometry as GeometryModel;
  assert.equal(oneManGeo.plan.elbows.length, 2, 'one_man defines 2 elbow rests (positions.ts elbowHoles)');
  const twoMan = compute(defaultInputs({ positionType: 'two_man' }));
  assert.equal((twoMan.geometry as GeometryModel).plan.elbows.length, 4, 'two_man defines 4 elbow rests');
  for (const e of oneManGeo.plan.elbows) assert.ok(e.yFt < 0, 'elbow rests sit at the front (enemy-facing) lip, y < 0');
  for (const s of oneManGeo.plan.sumps) assert.ok(s.yFt > 0, 'sumps sit near the rear wall, y > 0 — elbow rests must not collide with them');

  const plan = drawPlan(oneMan);
  assert.ok(plan.includes('aria-label="Elbow rest (aiming support)"'), 'elbow rest callout drawn');
  assertCalloutLegendConsistent(plan, 'plan (one_man, elbow rests)');

  // mg_crew has no elbow rests (crew-served positions use a firing platform instead) — must
  // not draw a stray elbow callout with nothing behind it.
  const mgCrew = compute(defaultInputs({ positionType: 'mg_crew' }));
  assert.equal((mgCrew.geometry as GeometryModel).plan.elbows.length, 0, 'mg_crew has a firing platform, not elbow rests');
  assert.ok(!drawPlan(mgCrew).includes('Elbow rest'), 'no elbow callout drawn when the position has none');
});

test('iso schematic carries its header and a consistent legend', () => {
  const iso = drawIso(compute(defaultInputs({ positionType: 'mg_crew' })));
  assert.ok(iso.includes('ISOMETRIC'), 'header bar title');
  assert.ok(iso.includes('>ENEMY<'), 'orientation preserved');
  assertCalloutLegendConsistent(iso, 'iso');
  assertMinFont(iso, 'iso');
});
