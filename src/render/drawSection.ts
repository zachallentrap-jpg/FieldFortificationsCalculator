// Section A–A (§10). Front-to-back vertical slice: earth mass with the bay cut out, spoil-
// filled parapets, overhead cover on stringers with roof setback (OR the honest engineered-
// roof hazard block — never a fabricated thickness, §2.7), firing step/platform, grenade
// sump, a standing figure + scale bar for real-world scale, and single-accent dimensions.
// FRONT is drawn on the left to stay consistent with the plan's front (enemy) side.

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
  const earthRoof = s.coverOn && s.roofPath === 'earth_on_stringers';
  const engineered = s.roofPath === 'engineered_required';
  const halfBay = s.holeW / 2;
  const aboveTop = s.parapetH + (earthRoof ? s.coverT + 0.4 : 0) + (engineered ? 1.6 : 0);
  const margin = Math.max(1, s.parapetW);

  const proj = makeProjector(
    { minX: -(halfBay + s.parapetW + margin), maxX: halfBay + s.parapetW + margin, minY: -(aboveTop + 0.9), maxY: s.depthOfCut + 1.0 },
    { x: 0, y: HEADER_H + 20, w: W, h: H - LEGEND_H - (HEADER_H + 20), pad: 36 },
  );
  const px = (xf: number, yf: number): [number, number] => proj.toPx(xf, yf);
  const dm = new Map<string, DimSpec>(geo.dims.map((d) => [d.key, d]));
  const dl = (k: string): string => fmtLength(dm.get(k)?.valueFt ?? 0, unit);

  const used = new Set<string>();
  const parts: string[] = [];
  const gradeY = px(0, 0)[1];

  // ── Earth mass below grade, then the bay excavation cut out of it ───────────────
  const gL = px(-(halfBay + s.parapetW + margin), 0);
  const gR = px(halfBay + s.parapetW + margin, 0);
  const earthBottom = px(0, s.depthOfCut + 1.0)[1];
  parts.push(el('rect', { x: gL[0], y: gradeY, width: gR[0] - gL[0], height: earthBottom - gradeY, fill: 'url(#pat-earth)' }));

  const bayTL = px(-halfBay, 0);
  parts.push(el('rect', { x: bayTL[0], y: bayTL[1], width: proj.lenPx(s.holeW), height: proj.lenPx(s.depthOfCut), fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-cut)' }));
  used.add('bay');
  parts.push(callout('bay', ...px(halfBay * 0.15, s.depthOfCut * 0.62), used));

  // Grade line (heaviest, the ground reference).
  parts.push(el('line', { x1: gL[0], y1: gradeY, x2: gR[0], y2: gradeY, stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
  used.add('grade');
  parts.push(callout('grade', gL[0] + 18, gradeY - 10, used));

  // ── Parapets (spoil-filled, front-left & rear-right) ───────────────────────────
  const paraFront = px(-(halfBay + s.parapetW), -s.parapetH);
  const paraRear = px(halfBay, -s.parapetH);
  const paraW = proj.lenPx(s.parapetW);
  const paraH = proj.lenPx(s.parapetH);
  parts.push(el('rect', { x: paraFront[0], y: paraFront[1], width: paraW, height: paraH, fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
  parts.push(el('rect', { x: paraRear[0], y: paraRear[1], width: paraW, height: paraH, fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
  used.add('parapet');
  parts.push(callout('parapet', ...px(-(halfBay + s.parapetW / 2), -s.parapetH * 0.5), used));
  used.add('spoil');
  parts.push(callout('spoil', ...px(halfBay + s.parapetW / 2, -s.parapetH * 0.5), used));

  // ── Firing platform (crew-served) or firing-step ledge (rifle) ─────────────────
  if (s.hasPlatform) {
    const stepTL = px(-halfBay, s.depthOfCut - s.platformDepth);
    parts.push(el('rect', { x: stepTL[0], y: stepTL[1], width: proj.lenPx(s.holeW * 0.35), height: proj.lenPx(s.platformDepth), fill: 'var(--draw-timber)', opacity: '0.85', stroke: 'var(--draw-outline)', 'stroke-width': 1 }));
    used.add('firing_step');
    parts.push(callout('firing_step', ...px(-halfBay + s.holeW * 0.175, s.depthOfCut - s.platformDepth / 2), used));
  } else if (s.firingStepOn) {
    const ledgeH = Math.min(0.8, s.depthOfCut * 0.25);
    const ledgeW = Math.min(0.9, s.holeW * 0.3);
    const stepTL = px(-halfBay, s.depthOfCut - ledgeH);
    parts.push(el('rect', { x: stepTL[0], y: stepTL[1], width: proj.lenPx(ledgeW), height: proj.lenPx(ledgeH), fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 1 }));
    used.add('firing_step');
    parts.push(callout('firing_step', stepTL[0] + 12, stepTL[1] + 8, used));
  }

  // ── Grenade sump notch at the bay floor ────────────────────────────────────────
  if (s.sump) {
    const sW = proj.lenPx(Math.min(0.9, s.holeW * 0.22));
    const sH = proj.lenPx(0.7);
    const sTL = px(-halfBay * 0.85, s.depthOfCut);
    parts.push(el('rect', { x: sTL[0], y: sTL[1], width: sW, height: sH, fill: 'var(--draw-timber)', stroke: 'var(--draw-outline)', 'stroke-width': 1 }));
    used.add('sump');
    parts.push(callout('sump', sTL[0] + sW + 9, sTL[1] + 7, used));
  }

  // ── Overhead cover (earth on stringers) OR engineered-roof hazard block ─────────
  if (earthRoof) {
    // Cover bears on the parapets and spans the hole, set back from the FRONT edge by the
    // roof setback to leave a firing gap. slabW is always > 0 (no self-cancelling inset).
    const slabX1 = px(Math.min(halfBay - 0.25, -halfBay + s.setback), 0)[0];
    const slabX2 = px(halfBay + s.parapetW, 0)[0];
    const slabW = Math.max(6, slabX2 - slabX1);
    const slabBottomY = px(0, -s.parapetH)[1]; // rests on parapet tops
    const slabTopY = px(0, -(s.parapetH + s.coverT))[1];
    const slabH = Math.max(3, slabBottomY - slabTopY);

    const n = Math.max(1, Math.min(s.stringers, 8));
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0.5 : i / (n - 1);
      parts.push(el('rect', { x: slabX1 + frac * (slabW - 4), y: slabBottomY - 1, width: 4, height: 7, fill: 'var(--draw-timber)' }));
    }
    used.add('stringers');
    parts.push(callout('stringers', slabX1 + 12, slabBottomY + 4, used));

    parts.push(el('rect', { x: slabX1, y: slabTopY, width: slabW, height: slabH, fill: 'url(#pat-cover)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
    used.add('overhead');
    parts.push(callout('overhead', slabX1 + slabW / 2, slabTopY + slabH / 2, used));

    parts.push(hDim(px(-halfBay, 0)[0], slabX1, slabTopY - 14, dl('setback')));
    used.add('setback');
    parts.push(callout('setback', (px(-halfBay, 0)[0] + slabX1) / 2, gradeY - 6, used));
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

  // ── Standing figure (scale) + scale bar ────────────────────────────────────────
  parts.push(standingFigure(px(-halfBay * 0.35, 0)[0], px(0, s.depthOfCut)[1], proj));
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
