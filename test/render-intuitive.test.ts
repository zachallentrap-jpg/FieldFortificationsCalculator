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
import { overhead, threats } from '../src/doctrine/protection';
import type { GeometryModel } from '../src/engine/geometry';
import type { Inputs } from '../src/engine/types';
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

test('the firing platform is one footprint — the same one the bill digs around and all three views draw', () => {
  // What this used to pin: geometry clamped the DRAWING to the hole while compute went on
  // billing the raw doctrine value, so fifty_cal's 3.0-ft platform in a 2.0-ft trench made the
  // picture right and the spoil figure wrong. The table is consistent now (fifty_cal's platform
  // spans its trench) and the clamp lives in compute, once, so bill and views cannot diverge.
  //
  // The section is the view that used to invent its own: it drew the platform's front-to-back
  // run as holeW × 0.35 — 0.700 ft where the plan and the 3D model both drew 2.000 — a fixed
  // 2.86× disagreement between two views of one object.
  for (const [id, pos] of Object.entries(positions)) {
    if (!pos.firingPlatform) continue;
    const r = compute(defaultInputs({ positionType: id }));
    const geo = r.geometry as GeometryModel;
    assert.ok(geo.plan.platform, id + ': platform present');
    assert.ok(geo.section.platform, id + ': the section carries the platform too, with its rise');
    assert.ok(geo.plan.platform!.W <= geo.plan.holeW + 1e-9, id + ": platform.W (" + geo.plan.platform!.W + ") must not exceed hole.W (" + geo.plan.holeW + ")");
    assert.ok(geo.plan.platform!.L <= geo.plan.holeL + 1e-9, id + ": platform.L (" + geo.plan.platform!.L + ") must not exceed hole.L (" + geo.plan.holeL + ")");
    // The source table is itself consistent — the clamp is a fail-safe, not the thing making
    // the picture right.
    assert.ok(pos.firingPlatform.W.value <= pos.hole.W.value + 1e-9, id + ': the doctrine table describes a platform that fits its own hole');
    assert.ok(pos.firingPlatform.L.value <= pos.hole.L.value + 1e-9, id + ': same on the frontage axis');
    assert.ok(geo.section.platform!.riseFt > 0 && geo.section.platform!.riseFt <= geo.section.depthOfCut + 1e-9, id + ': the bench stands above the floor and no higher than the cut is deep');

    // All three views read the ONE footprint.
    const scene = buildScene3D(r);
    const platformBox = scene.parts.find((p) => p.kind === 'box' && p.role === 'platform') as { d: number; w: number; h: number } | undefined;
    assert.ok(platformBox, id + ': 3D platform box present');
    assert.ok(Math.abs(platformBox!.d - geo.plan.platform!.W) < 1e-9, id + ': 3D depth == published platform.W');
    assert.ok(Math.abs(platformBox!.w - geo.plan.platform!.L) < 1e-9, id + ': 3D width == published platform.L');
    assert.ok(Math.abs(platformBox!.h - geo.section.platform!.riseFt) < 1e-9, id + ': 3D height == published rise');

    // And the section draws its front-to-back run at that same width, in earth rather than
    // timber: a plank tone taught a built deck that appears in no BOM line, over ground the
    // crew never dug.
    const section = drawSection(r);
    const bayMatch = section.match(/<polygon points="([\d.,\- ]+)" fill="var\(--draw-bay\)"/);
    assert.ok(bayMatch, id + ': bay polygon present');
    const bayXs = bayMatch![1]!.split(' ').map((pt) => Number(pt.split(',')[0]));
    const bayW = Math.max(...bayXs) - Math.min(...bayXs);
    // The bay polygon spans the hole PLUS its wall flare at grade, so the scale is recovered
    // from that full span, not from holeW alone.
    const pxPerFt = bayW / (geo.section.holeW + 2 * geo.section.wallTaper);
    const platRe = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"[^>]*fill="var\(--draw-bay\)"/g;
    const platMatch = platRe.exec(section);
    assert.ok(platMatch, id + ': the section draws the platform in earth (draw-bay), not timber');
    const drawnRunFt = Number(platMatch![2]) / pxPerFt;
    assert.ok(
      Math.abs(drawnRunFt - geo.plan.platform!.W) < 0.02,
      id + ': section draws the platform ' + drawnRunFt.toFixed(3) + ' ft front-to-back, the plan and 3D draw ' + geo.plan.platform!.W,
    );
  }
});

test('the section\'s grenade sump is the sump the BOM bills, at the plan\'s own rear-wall mark', () => {
  // Two defects in one place. WHERE: drawSection used to anchor the notch at -halfBay*0.85 (the
  // FRONT), directly under the front-sited firing step, while geometry.ts's sumpMarks put every
  // sump "near the rear wall" and the 3D model read that mark straight through. WHAT SIZE: the
  // section notched a wedge of its own (min(0.9, holeW×0.22) wide × 0.7 deep), the 3D drew an
  // elongated trough of its own, and the BOM billed a third box — one hole, three sizes, and
  // the one the crew is paid to dig was in neither picture.
  for (const positionType of ['one_man', 'two_man', 'mg_crew']) {
    const r = compute(defaultInputs({ positionType, sump: true, firingStep: true, overheadCover: false }));
    const geo = r.geometry as GeometryModel;
    for (const s of geo.plan.sumps) assert.ok(s.yFt > 0, positionType + ": plan's own sump marks sit at the rear (yFt > 0)");

    const section = drawSection(r);
    // Positions with a structural firing PLATFORM (mg_crew) also draw a rect for it, before the
    // sump — so match by proximity to the sump's own callout label, not just "the first rect".
    const sumpLabelIdx = section.indexOf('aria-label="Grenade catch-pit (sump)"');
    assert.ok(sumpLabelIdx > 0, positionType + ': sump callout label present');
    const rectRe = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"[^>]*fill="var\(--draw-timber\)"/g;
    let sumpMatch: RegExpExecArray | null = null;
    for (let m = rectRe.exec(section); m; m = rectRe.exec(section)) {
      if (m.index < sumpLabelIdx) sumpMatch = m;
    }
    assert.ok(sumpMatch, positionType + ': sump notch drawn');
    const bayMatch = section.match(/<polygon points="([\d.,\- ]+)" fill="var\(--draw-bay\)"/);
    assert.ok(bayMatch, positionType + ': bay polygon present');
    const bayXs = bayMatch![1]!.split(' ').map((pt) => Number(pt.split(',')[0]));
    const bayCenterX = (Math.min(...bayXs) + Math.max(...bayXs)) / 2;
    const pxPerFt = (Math.max(...bayXs) - Math.min(...bayXs)) / (geo.section.holeW + 2 * geo.section.wallTaper);
    const notchX = Number(sumpMatch![1]);
    const notchW = Number(sumpMatch![2]);
    const notchH = Number(sumpMatch![3]);
    assert.ok(notchX + notchW / 2 > bayCenterX, positionType + ": sump notch sits behind the bay's own center (rear, since FRONT is drawn on the left)");

    // Drawn at the billed box, and centred on the plan's own mark.
    const box = geo.plan.sumpBox;
    assert.ok(Math.abs(notchW / pxPerFt - Math.min(box.W, geo.section.holeW)) < 0.02, positionType + ': notch width ' + (notchW / pxPerFt).toFixed(3) + ' ft != billed sump width ' + box.W);
    assert.ok(Math.abs(notchH / pxPerFt - box.D) < 0.02, positionType + ': notch depth ' + (notchH / pxPerFt).toFixed(3) + ' ft != billed sump depth ' + box.D);
    const markFt = geo.plan.sumps[geo.plan.sumps.length - 1]!.yFt;
    const drawnCentreFt = (notchX + notchW / 2 - bayCenterX) / pxPerFt;
    assert.ok(Math.abs(drawnCentreFt - markFt) < 0.02, positionType + ': notch centre ' + drawnCentreFt.toFixed(3) + ' ft != plan mark ' + markFt);

    // And the 3D model digs the same box at the same mark.
    const scene = buildScene3D(r);
    const sump3d = scene.parts.find((p) => p.kind === 'box' && p.role === 'sump') as { w: number; h: number; d: number; z: number } | undefined;
    assert.ok(sump3d, positionType + ': 3D sump box present');
    assert.ok(Math.abs(sump3d!.w - box.L) < 1e-9 && Math.abs(sump3d!.d - box.W) < 1e-9 && Math.abs(sump3d!.h - box.D) < 1e-9, positionType + ': the 3D sump is the billed box');
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

test('the roof reaches OUTWARD past both lips, by the same setback + bearing on each', () => {
  // Three defects the one published footprint replaces.
  //
  // SIGN. The 2D section inset its front edge INTO the hole by the setback and clamped it at
  // halfBay − 0.25 ft, so on a narrow position the drawn roof covered only the rear of the bay
  // while the 3D model extended the same edge outward — two views facing opposite directions on
  // a safety-critical standoff. The setback is measured FROM THE HOLE EDGE OUTWARD to where the
  // supports begin, so a roof edge offset is never negative and never crosses the hole edge.
  //
  // STAGES. The rear took max(bearingEachEnd, setbackDepthFrac × depth): the arithmetic of
  // ALTERNATIVES applied to two SEQUENTIAL stages (the supports stand back by the setback, THEN
  // the stringers overhang them by the bearing), and it replaced the setback's own threat-scaled
  // floor with a bearing leaf. Measured at HEAD: one_man / 155 mm / deliberate gave the front
  // 2.0 ft and the rear 1.0 ft — same roof, same munition, two supports, the rear one held to
  // half the standoff the front had to clear.
  //
  // SYMMETRY. The rule is orientation-blind: a rear support is a support.
  for (const [standard, threat] of [['hasty', 'sa-556'], ['deliberate', 'sa-556'], ['reinforced', 'sa-556'], ['deliberate', 'ind-art-155']] as const) {
    const r = compute(defaultInputs({ positionType: 'one_man', overheadCover: true, standard, threat, sump: false }));
    const geo = r.geometry as GeometryModel;
    const roof = geo.section.roof;
    assert.ok(roof, standard + '/' + threat + ': the fixture must exercise the earth roof');
    const setback = Math.max(threats[threat]!.standoffMin.value, overhead.setbackDepthFrac.value * geo.section.depthOfCut);
    const expected = setback + overhead.bearingEachEnd.value;
    assert.ok(Math.abs(roof!.frontFt - expected) < 1e-9, standard + '/' + threat + ': front ' + roof!.frontFt + ' != setback + bearing ' + expected);
    assert.equal(roof!.rearFt, roof!.frontFt, standard + '/' + threat + ': a rear support is a support — same rule, same number');
    assert.ok(roof!.frontFt > 0 && roof!.endFt > 0, 'every roof edge offset is an OUTWARD extension, never zero or negative');
    // Absolute edges, in the section's own frame: front strictly outboard of the front wall,
    // rear strictly outboard of the rear wall. A coordinate cannot be sign-flipped by accident
    // the way an offset can.
    assert.ok(roof!.frontEdgeFt <= -geo.section.holeW / 2, 'front edge is outboard of the front wall');
    assert.ok(roof!.rearEdgeFt >= geo.section.holeW / 2, 'rear edge is outboard of the rear wall');
    // (The older guard here was "rearOverhang != parapetW", written when the rear edge had once
    // been the parapet's own wall thickness. The exact equality above subsumes it — the edge is
    // pinned to the two roof leaves — and on one_man / 155 mm the two happen to coincide at
    // 3.0 ft, so the inequality would now fail on a correct roof.)
  }

  // The FLANK ends take neither stage: no stringer end lands there, so the setback (a support
  // rule) and the bearing (an overhang past a support) are both inapplicable, and the deck takes
  // the flank lap instead. The 3D used to reuse the rear figure on the end walls.
  const wide = compute(defaultInputs({ positionType: 'bunker_op_cp', overheadCover: true, threat: 'ind-mtr-81' }));
  const wroof = (wide.geometry as GeometryModel).section.roof!;
  assert.ok(Math.abs(wroof.endFt - overhead.endLap.value) < 1e-9, 'the ends take endLap, not the front/rear figure');
  assert.notEqual(wroof.endFt, wroof.rearFt, 'and on a deep cut that is a different number from the bearing edge');
});

test('a roofed position is never roofed shut — the deck is notched across its own entrance', () => {
  // R10 (docs/REALISM_PASS_3D_PLAN.md): extended its full rear bearing, the bunker's roof runs
  // straight over the position's only way in. Its stated fix — stop the rear edge at the
  // excavation wall and shorten the stringers to match — contradicts its own acceptance
  // criterion once the stringers run front-to-back: every one of them becomes a cantilever off
  // the front support. So the DECK is notched across the passage width and the STRINGERS keep
  // their full rear bearing on undisturbed ground.
  const r = compute(defaultInputs({ positionType: 'bunker_op_cp', overheadCover: true, threat: 'ind-mtr-81' }));
  const geo = r.geometry as GeometryModel;
  const roof = geo.section.roof!;
  assert.ok(roof.entranceNotchFt > 0, 'the one roofed position in the catalog notches its deck');
  assert.ok(Math.abs(roof.entranceNotchFt - geo.section.access.entranceGapFt) < 1e-9, 'the notch is exactly the entrance it exists to keep open');
  // Every other position has no ring tall enough to seal it and takes no notch.
  for (const positionType of ['one_man', 'two_man', 'mg_crew', 'connecting_trench']) {
    const other = compute(defaultInputs({ positionType, overheadCover: true, threat: 'ind-mtr-81' }));
    const oroof = (other.geometry as GeometryModel).section.roof;
    if (oroof) assert.equal(oroof.entranceNotchFt, 0, positionType + ': no notch');
  }
  // A–A cuts on the centreline, which is where the notch is — so the section draws the deck
  // stopping at the rear wall line rather than silently drawing the full slab across it.
  const section = drawSection(r);
  const slab = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"[^>]*fill="url\(#pat-cover\)"/.exec(section);
  assert.ok(slab, 'the section draws the cover slab');
  const bayMatch = section.match(/<polygon points="([\d.,\- ]+)" fill="var\(--draw-bay\)"/)!;
  const bayXs = bayMatch[1]!.split(' ').map((pt) => Number(pt.split(',')[0]));
  const pxPerFt = (Math.max(...bayXs) - Math.min(...bayXs)) / (geo.section.holeW + 2 * geo.section.wallTaper);
  const centreX = (Math.min(...bayXs) + Math.max(...bayXs)) / 2;
  const drawnRearFt = (Number(slab![1]) + Number(slab![2]) - centreX) / pxPerFt;
  assert.ok(Math.abs(drawnRearFt - geo.section.holeW / 2) < 0.03, 'on the notch centreline the drawn deck stops at the rear wall line, got ' + drawnRearFt.toFixed(3));
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

test('layout quality (dim collision, callout/legend consistency, min font) holds across every position under stress configs, not just the two single default fixtures', () => {
  // render-nan.test.ts already fuzzes position × threat × overheadCover broadly, but only for
  // "never NaN" — the LAYOUT QUALITY checks (assertNoDimCollision, assertCalloutLegendConsistent,
  // assertMinFont) had only ever run against two single, mostly-default configs (one for plan,
  // one for section) across this whole loop's 12 iterations of structural changes (wall taper,
  // backblast zone, sump reposition, platform clamp, roof setback/overhang, elbow rests). None of
  // those per-feature tests would catch a DIFFERENT config accidentally colliding two dimension
  // labels or orphaning a callout from the legend. This sweeps every position type through a
  // handful of "extreme" configs designed to stress the geometry that changed this session:
  // reinforced (deepest cut, thickest cover, biggest wall taper), silt (steep unrevetted taper),
  // every extra feature on at once (sump/step/camo), and a heavy engineered-roof threat (biggest
  // hazard-block footprint) — the kinds of configs most likely to push labels into each other.
  const STRESS_CONFIGS: Partial<Inputs>[] = [
    { standard: 'reinforced', soil: 'silt', revetment: 'none', overheadCover: true, threat: 'ind-art-155', sump: true, firingStep: true, camouflage: true },
    { standard: 'hasty', soil: 'sand', revetment: 'sandbag_facing', overheadCover: false, threat: 'none' },
    { standard: 'reinforced', soil: 'clay', revetment: 'none', overheadCover: true, threat: 'at-tank', sump: true, firingStep: true, camouflage: true },
    { standard: 'deliberate', soil: 'rock', revetment: 'timber_plywood', overheadCover: true, threat: 'sa-556', sump: true },
    { unit: 'metric', standard: 'reinforced', soil: 'silt', revetment: 'none', overheadCover: true, threat: 'ind-mtr-120', sump: true, firingStep: true },
  ];
  for (const positionType of Object.keys(positions)) {
    for (const cfg of STRESS_CONFIGS) {
      const ctx = positionType + '/' + JSON.stringify(cfg);
      const r = compute(defaultInputs({ ...cfg, positionType }));
      const plan = drawPlan(r);
      assertCalloutLegendConsistent(plan, ctx + ' plan');
      assertMinFont(plan, ctx + ' plan');
      assertNoDimCollision(plan, ctx + ' plan');
      const section = drawSection(r);
      assertCalloutLegendConsistent(section, ctx + ' section');
      assertMinFont(section, ctx + ' section');
      assertNoDimCollision(section, ctx + ' section');
    }
  }
});
