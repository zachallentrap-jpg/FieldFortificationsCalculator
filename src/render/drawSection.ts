// Section A–A (§10). Front-to-back vertical slice: earth mass with the bay cut out, spoil-
// filled parapets, overhead cover on stringers with roof setback (OR the honest engineered-
// roof hazard block — never a fabricated thickness, §2.7), firing step/platform, grenade
// sump, a standing figure + scale bar for real-world scale, and single-accent dimensions.
// FRONT is drawn on the left to stay consistent with the plan's front (enemy) side.
//
// Every element that depicts a PHYSICAL feature carries data-feature="<callout key>" — the same
// key set the callout registry already owns. It is invisible and additive, and it is what lets
// the cross-view sweep read this drawing's own numbers back off the page instead of guessing at
// a feature by fill colour and label proximity.

import { el, group, textEl, callout } from './svg';
import { makeProjector } from './project';
import {
  HEADER_H, LEGEND_H, headerBar, hDim, vDim, scaleBar, standingFigure, legendPanel, emptyPrompt, svgRoot,
} from './chrome';
import { describe, a11yAttrs } from './a11y';
import { fmtLength } from '../doctrine/units';
import type { GeometryModel, DimSpec } from '../engine/geometry';
import type { Result } from '../engine/types';

const W = 760;
const H = 560;

export function drawSection(result: Result): string {
  const geo = result.geometry as GeometryModel;
  const a11y = describe(result, 'section');
  const a11yDefs = a11yAttrs(a11y).defs;
  const unit = result.inputs.unit;

  if (!geo.hasAnything) {
    return svgRoot(W, H, a11y, a11yDefs, headerBar(W, 'SECTION A–A') + emptyPrompt(W, H, 'Configure a position to see the section.'));
  }

  const s = geo.section;
  const isVehicle = geo.shape === 'vehicle_ramp';
  // A vehicle defilade is never roofed — there's no parapet for a built structure to span
  // between, and the vehicle's own armor plus the terrain defilade already are the protection.
  // scene3d.ts already excludes vehicle_ramp from both the earth-roof and engineered-hazard
  // branches entirely (nobody ever designed a "roof over a vehicle pit" geometry); this section
  // used to draw the engineered hazard block for it anyway (calc.roofPath/coverOn themselves are
  // left untouched — they still feed the specs panel and ROOF_SPAN_EXCEEDED correctly — only the
  // schematic's attempt to depict an undesigned shape is suppressed here, matching the 3D view).
  const earthRoof = !isVehicle && s.coverOn && s.roofPath === 'earth_on_stringers';
  const engineered = !isVehicle && s.roofPath === 'engineered_required';
  const halfBay = s.holeW / 2;
  const aboveTop = s.parapetH + (earthRoof ? s.coverT + 0.4 : 0) + (engineered ? 1.6 : 0);
  // The roof extends OUTWARD past the front lip, so the drawing's own left bound has to reach
  // past it — the frame follows the structure, never the other way round.
  const margin = Math.max(1, s.parapetW, earthRoof && s.roof ? s.roof.frontFt : 0);
  const dm = new Map<string, DimSpec>(geo.dims.map((d) => [d.key, d]));
  const dl = (k: string): string => fmtLength(dm.get(k)?.valueFt ?? 0, unit);
  // A vehicle drives DOWN a graded ramp to reach the pit — the ramp run (§ ramp_run DimSpec,
  // engine/geometry.ts) is the dominant rear-side excavation, not a mirror of the front berm.
  const rampRunFt = isVehicle ? dm.get('ramp_run')?.valueFt ?? 0 : 0;
  const rightExtentFt = isVehicle ? halfBay + rampRunFt + margin : halfBay + s.parapetW + margin;

  const proj = makeProjector(
    { minX: -(halfBay + s.parapetW + margin), maxX: rightExtentFt, minY: -(aboveTop + 0.9), maxY: s.depthOfCut + 1.0 },
    { x: 0, y: HEADER_H + 20, w: W, h: H - LEGEND_H - (HEADER_H + 20), pad: 36 },
  );
  const px = (xf: number, yf: number): [number, number] => proj.toPx(xf, yf);

  const used = new Set<string>();
  const parts: string[] = [];
  const gradeY = px(0, 0)[1];

  // ── Earth mass below grade, then the bay excavation cut out of it ───────────────
  const gL = px(-(halfBay + s.parapetW + margin), 0);
  const gR = px(rightExtentFt, 0);
  const earthBottom = px(0, s.depthOfCut + 1.0)[1];
  parts.push(el('rect', { x: gL[0], y: gradeY, width: gR[0] - gL[0], height: earthBottom - gradeY, fill: 'url(#pat-earth)' }));

  // An unrevetted wall in loose soil battens outward toward grade (s.wallTaper, doctrine's
  // wallSlopeRatio × depth, capped the same way the 3D model caps it) — a plumb rectangle only
  // when revetted or wallTaper is 0. Degenerates to the exact same rectangle when wallTaper is 0
  // (the two top corners collapse onto the bottom corners' x), so this single polygon replaces
  // the old unconditional rect rather than branching on taper presence.
  const bayFloorL = px(-halfBay, s.depthOfCut);
  const bayFloorR = px(halfBay, s.depthOfCut);
  const bayGradeR = px(halfBay + s.wallTaper, 0);
  const bayGradeL = px(-halfBay - s.wallTaper, 0);
  parts.push(el('polygon', {
    points: bayFloorL.join(',') + ' ' + bayFloorR.join(',') + ' ' + bayGradeR.join(',') + ' ' + bayGradeL.join(','),
    fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-cut)', 'data-feature': 'bay',
  }));
  used.add('bay');
  parts.push(callout('bay', ...px(halfBay * 0.15, s.depthOfCut * 0.62), used));

  // Grade line (heaviest, the ground reference).
  parts.push(el('line', { x1: gL[0], y1: gradeY, x2: gR[0], y2: gradeY, stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
  used.add('grade');
  parts.push(callout('grade', gL[0] + 18, gradeY - 10, used));

  // ── Front protection: earth parapet, or a dozed berm for vehicle positions ─────
  const paraFront = px(-(halfBay + s.parapetW), -s.parapetH);
  const paraW = proj.lenPx(s.parapetW);
  const paraH = proj.lenPx(s.parapetH);
  parts.push(el('rect', { x: paraFront[0], y: paraFront[1], width: paraW, height: paraH, fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)', 'data-feature': 'parapet' }));
  const frontKey = isVehicle ? 'berm' : 'parapet';
  used.add(frontKey);
  parts.push(callout(frontKey, ...px(-(halfBay + s.parapetW / 2), -s.parapetH * 0.5), used));

  if (!isVehicle) {
    // ── Rear parapet (spoil-filled, mirrors the front) ───────────────────────────
    const paraRear = px(halfBay, -s.parapetH);
    parts.push(el('rect', { x: paraRear[0], y: paraRear[1], width: paraW, height: paraH, fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
    used.add('spoil');
    parts.push(callout('spoil', ...px(halfBay + s.parapetW / 2, -s.parapetH * 0.5), used));
  } else {
    // ── Vehicle access ramp: a graded cut from grade down to the pit floor, not a mirrored
    // parapet — the vehicle drives down it to reach the hull-down/turret-down position.
    const rampPit = px(halfBay, 0);
    const rampFloor = px(halfBay, s.depthOfCut);
    const rampTop = px(halfBay + rampRunFt, 0);
    parts.push(el('polygon', {
      points: rampFloor[0] + ',' + rampFloor[1] + ' ' + rampTop[0] + ',' + rampTop[1] + ' ' + rampPit[0] + ',' + rampPit[1],
      fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-cut)',
    }));
    used.add('ramp');
    // Above grade, near the ramp's outer/top edge — clear of both the slope line and the
    // ramp-run dimension (which sits below grade), so the two never collide.
    parts.push(callout('ramp', rampTop[0] - 22, gradeY - 16, used));
    parts.push(hDim(rampPit[0], rampTop[0], gradeY + 24, dl('ramp_run')));
  }

  // ── Firing platform (crew-served) or firing-step ledge (rifle) ─────────────────
  if (s.platform) {
    // Earth left standing, not a built deck: the gun/launcher stand is undisturbed original
    // ground and the crew bays are dug down around it, so it is drawn in the same earth as the
    // bay it stands in — a timber tone taught a plank platform that nothing in the BOM builds.
    // Its front-to-back run is the platform's OWN width, the same figure the plan, the 3D model
    // and the bill read; the section used to invent holeW × 0.35 and drew it 2.9× too narrow.
    const stepTL = px(-halfBay, s.depthOfCut - s.platform.riseFt);
    parts.push(el('rect', { x: stepTL[0], y: stepTL[1], width: proj.lenPx(s.platform.W), height: proj.lenPx(s.platform.riseFt), fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 1, 'data-feature': 'platform' }));
    // A–A is cut THROUGH the bench, so the deeper crew-bay floor either side of it is behind
    // the cut plane — hidden line, the drafting convention for exactly that.
    parts.push(el('line', {
      x1: stepTL[0], y1: px(0, s.depthOfCut)[1], x2: px(-halfBay + s.platform.W, s.depthOfCut)[0], y2: px(0, s.depthOfCut)[1],
      stroke: 'var(--draw-outline)', 'stroke-width': 1, 'stroke-dasharray': '5 3', opacity: '0.7',
    }));
    used.add('platform');
    parts.push(callout('platform', ...px(-halfBay + s.platform.W / 2, s.depthOfCut - s.platform.riseFt / 2), used));
  } else if (s.firingStepOn) {
    const ledgeH = Math.min(s.firingStep.heightFt, s.depthOfCut);
    const ledgeW = Math.min(s.firingStep.runFt, s.holeW);
    const stepTL = px(-halfBay, s.depthOfCut - ledgeH);
    parts.push(el('rect', { x: stepTL[0], y: stepTL[1], width: proj.lenPx(ledgeW), height: proj.lenPx(ledgeH), fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 1, 'data-feature': 'firing_step' }));
    used.add('firing_step');
    parts.push(callout('firing_step', stepTL[0] + 12, stepTL[1] + 8, used));
  }

  // ── Grenade sump notch at the bay floor ────────────────────────────────────────
  // REAR of the bay (positive x here), matching the plan's own sump marks (sumpMarks in
  // geometry.ts places them at "near the rear wall", yFt > 0) and the 3D model (scene3d.ts
  // reads sump.yFt straight through). This used to sit at the FRONT (-halfBay * 0.85) —
  // directly under the firing step/platform, which are correctly front-sited — so on a narrow
  // position (two_man's 2 ft front-to-back) the sump notch visually collided with the firing
  // step in the very same picture, and every position's section silently drew the sump on the
  // opposite wall from where its own plan view and 3D model put it.
  // Drawn at the size the BOM bills (geo.plan.sumpBox = materials.sump): the section used to
  // notch a wedge of its own invention, the 3D drew a third size, and the bill paid for none of
  // them. A dug feature is drawn at the volume it is dug to.
  const sumpWFt = Math.min(geo.plan.sumpBox.W, s.holeW);
  if (s.sump) {
    const sW = proj.lenPx(sumpWFt);
    const sH = proj.lenPx(geo.plan.sumpBox.D);
    // Sited at the plan's own rear-wall sump mark rather than a fraction of the bay of its own —
    // one location, read off the same block the plan draws from and the 3D model reads.
    const sumpCentreFt = geo.plan.sumps[geo.plan.sumps.length - 1]?.yFt ?? halfBay - sumpWFt / 2;
    const sTL = px(sumpCentreFt - sumpWFt / 2, s.depthOfCut);
    parts.push(el('rect', { x: sTL[0], y: sTL[1], width: sW, height: sH, fill: 'var(--draw-timber)', stroke: 'var(--draw-outline)', 'stroke-width': 1, 'data-feature': 'sump' }));
    used.add('sump');
    parts.push(callout('sump', sTL[0] + sW + 9, sTL[1] + 7, used));
  }

  // ── Overhead cover (earth on stringers) OR engineered-roof hazard block ─────────
  if (earthRoof && s.roof) {
    const roof = s.roof;
    // The roof reaches OUTWARD past both lips onto undisturbed ground — the supports stand back
    // from the hole edge by the setback, and the stringers overhang those supports by the
    // bearing, so the deck edge sits setback + bearing beyond the wall. This used to be drawn
    // INSET into the hole by the setback, which put the safety-critical front edge on the wrong
    // side of the lip (on a narrow position the drawn roof covered only the rear of the bay)
    // and left the 2D and 3D views facing opposite directions on the same dimension.
    const slabX1 = px(roof.frontEdgeFt, 0)[0];
    // A–A cuts on the centreline, which on a roofed bunker/OP is exactly where the entrance
    // notch is — so the section shows the deck stopping at the rear wall line, not the full
    // slab it would otherwise draw straight across the position's only way in.
    const rearDrawFt = roof.entranceNotchFt > 0 ? halfBay : roof.rearEdgeFt;
    const slabX2 = px(rearDrawFt, 0)[0];
    const slabW = Math.max(6, slabX2 - slabX1);
    const slabBottomY = px(0, -s.parapetH)[1]; // rests on parapet tops
    const slabTopY = px(0, -(s.parapetH + s.coverT))[1];
    const slabH = Math.max(3, slabBottomY - slabTopY);

    // A–A is a front-to-back slice and the stringers RUN front-to-back, so the cut plane runs
    // along ONE of them: it is drawn in profile at its resolved cross-section, spanning the full
    // deck run onto its bearing at both ends. (The count is a plan-view fact — the frontage
    // layout — and is dimensioned in the plan, not fabricated as a row of ends here.)
    const stringerX1 = px(roof.frontEdgeFt, 0)[0];
    const stringerX2 = px(roof.rearEdgeFt, 0)[0];
    const stringerH = Math.max(3, proj.lenPx(roof.stringer.sectionFt));
    parts.push(el('rect', { x: stringerX1, y: slabBottomY, width: Math.max(6, stringerX2 - stringerX1), height: stringerH, fill: 'var(--draw-timber)', stroke: 'var(--draw-outline)', 'stroke-width': 1, 'data-feature': 'stringers' }));
    used.add('stringers');
    parts.push(callout('stringers', stringerX1 + 12, slabBottomY + stringerH + 8, used));

    parts.push(el('rect', { x: slabX1, y: slabTopY, width: slabW, height: slabH, fill: 'url(#pat-cover)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)', 'data-feature': 'overhead' }));
    used.add('overhead');
    parts.push(callout('overhead', slabX1 + slabW / 2, slabTopY + slabH / 2, used));

    // The two stages, drawn as two dimensions, because they are two different requirements and
    // one number under one label taught them as one: the lip to the support line (the setback),
    // then the support line to the deck edge (the stringer's bearing overhang).
    const lipX = px(-halfBay, 0)[0];
    const supportX = px(-(halfBay + roof.setbackFt), 0)[0];
    parts.push(hDim(supportX, lipX, slabTopY - 14, dl('setback')));
    used.add('setback');
    parts.push(callout('setback', (lipX + supportX) / 2, gradeY - 6, used));
    parts.push(hDim(slabX1, supportX, slabTopY - 32, fmtLength(roof.bearingFt, unit)));
    parts.push(vDim(slabTopY, slabBottomY, slabX2 + 16, dl('cover_t')));
  } else if (engineered) {
    const hzTL = px(-(halfBay + s.parapetW * 0.5), -(s.parapetH + 1.4));
    const hzW = proj.lenPx(s.holeW + s.parapetW);
    const hzH = proj.lenPx(1.2);
    parts.push(el('rect', { x: hzTL[0], y: hzTL[1], width: hzW, height: hzH, fill: 'url(#pat-engineered)', stroke: 'var(--draw-engineered)', 'stroke-width': 'var(--w-outline)' }));
    parts.push(textEl(px(0, -(s.parapetH + 0.8))[0], hzTL[1] + hzH / 2 + 4, 'ENGINEERED ROOF — SEE ENGINEER', { fill: 'var(--draw-engineered)', 'font-size': 11, 'font-weight': '700', 'text-anchor': 'middle' }));
    used.add('engineered');
    parts.push(callout('engineered', hzTL[0] + 14, hzTL[1] + hzH / 2, used));
  }

  // ── Scale reference: a standing figure everywhere except vehicle positions, where a
  // person makes no sense parked in the pit — a schematic hull+turret silhouette instead.
  // Purely illustrative proportions (no doctrine vehicle-dimension exists to cite), so unlike
  // standingFigure this carries no numeric "ref" claim.
  if (!isVehicle) {
    parts.push(standingFigure(px(-halfBay * 0.35, 0)[0], px(0, s.depthOfCut)[1], proj, unit));
  } else {
    const hullTopFt = -Math.min(s.parapetH * 0.6, s.depthOfCut * 0.25);
    const hullBotFt = s.depthOfCut * 0.92;
    const turretTopFt = hullTopFt - s.depthOfCut * 0.35;
    const hullHalfWFt = halfBay * 0.85;
    const turretHalfWFt = hullHalfWFt * 0.4;
    const hullTL = px(-hullHalfWFt, hullTopFt);
    const hullBR = px(hullHalfWFt, hullBotFt);
    const turretTL = px(-turretHalfWFt, turretTopFt);
    const turretBR = px(turretHalfWFt, hullTopFt);
    parts.push(group(
      { class: 'vehicle', opacity: '0.72', fill: 'var(--ink-soft)' },
      el('rect', { x: hullTL[0], y: hullTL[1], width: hullBR[0] - hullTL[0], height: hullBR[1] - hullTL[1], rx: 4 }),
      el('rect', { x: turretTL[0], y: turretTL[1], width: turretBR[0] - turretTL[0], height: turretBR[1] - turretTL[1], rx: 2 }),
    ));
  }
  parts.push(scaleBar(gL[0] + 20, H - LEGEND_H - 24, proj, unit)); // clear of the LEGEND heading (see drawPlan)

  // ── Dimensions ─────────────────────────────────────────────────────────────────
  const depthTop = px(halfBay, 0)[1];
  const depthBot = px(halfBay, s.depthOfCut)[1];
  parts.push(vDim(depthTop, depthBot, px(halfBay, 0)[0] + 34, dl('depth')));
  parts.push(hDim(px(-halfBay, s.depthOfCut)[0], px(halfBay, s.depthOfCut)[0], depthBot + 30, dl('front_back')));
  parts.push(vDim(paraFront[1], gradeY, paraFront[0] - 16, dl('parapet_h')));

  // ── FRONT / REAR ───────────────────────────────────────────────────────────────
  parts.push(textEl(gL[0] + 32, gradeY - 6, 'FRONT', { fill: 'var(--ink-soft)', 'font-size': 10.5, 'font-weight': '700', 'letter-spacing': '1' }));
  parts.push(textEl(gR[0] - 32, gradeY - 6, 'REAR', { fill: 'var(--ink-soft)', 'font-size': 10.5, 'font-weight': '700', 'text-anchor': 'end', 'letter-spacing': '1' }));

  const legend = legendPanel(12, H - LEGEND_H + 14, W - 24, used);
  return svgRoot(W, H, a11y, a11yDefs, headerBar(W, 'SECTION A–A') + group({}, ...parts) + legend);
}
