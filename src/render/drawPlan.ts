// Plan view (§10). Parapet ring + fighting bay, a LOUD enemy arrow with sectors of fire,
// unambiguous FRONT/REAR, sump marks, the A–A section cut (matching drawSection's A markers),
// dimensions in the single accent color, and numbered callouts that feed the shared legend.
// One projector for the whole drawing (no drift). Empty config shows a prompt, not a blank box.

import { el, group, textEl, callout } from './svg';
import { makeProjector } from './project';
import {
  HEADER_H, LEGEND_H, headerBar, hDim, vDim, legendPanel, emptyPrompt, svgRoot,
  northArrow, azimuthLabel, scaleBar,
} from './chrome';
import { describe, a11yAttrs } from './a11y';
import { positions } from '../doctrine/positions';
import { fmtLength } from '../doctrine/units';
import type { GeometryModel, DimSpec } from '../engine/geometry';
import type { Result } from '../engine/types';

const W = 760;
const H = 560;

export function drawPlan(result: Result): string {
  const geo = result.geometry as GeometryModel;
  const a11y = describe(result, 'plan');
  const a11yDefs = a11yAttrs(a11y).defs;
  const unit = result.inputs.unit;

  if (!geo.hasAnything) {
    return svgRoot(W, H, a11y, a11yDefs, headerBar(W, 'PLAN VIEW') + emptyPrompt(W, H, 'Configure a position to see the plan view.'));
  }

  const p = geo.plan;
  const halfL = p.outerL / 2;
  const halfW = p.outerW / 2;
  const enemyMargin = Math.max(3, halfW * 0.7);
  const sidePad = Math.max(1.5, p.parapetW);
  // The inverted-T's rear stem and the L-shape's side arm (see the shape-specific draw below)
  // extend past the plain rectangle's own footprint — pad the projector bounds so they never
  // clip off-canvas instead of sizing bounds only for the main bay.
  const stemLen = geo.shape === 'inverted_t' ? p.holeW * 1.1 : 0;
  const armLen = geo.shape === 'l_shape' ? Math.max(2.5, p.holeL * 0.6) : 0;

  const proj = makeProjector(
    { minX: -halfL - sidePad, maxX: halfL + sidePad + armLen, minY: -halfW - enemyMargin, maxY: halfW + sidePad + 1 + stemLen },
    { x: 0, y: HEADER_H + 20, w: W, h: H - LEGEND_H - (HEADER_H + 20), pad: 30 },
  );
  const px = (xf: number, yf: number): [number, number] => proj.toPx(xf, yf);

  const dm = new Map<string, DimSpec>(geo.dims.map((d) => [d.key, d]));
  const dimLabel = (k: string): string => fmtLength(dm.get(k)?.valueFt ?? 0, unit);

  const used = new Set<string>();
  const parts: string[] = [];

  // ── Sectors of fire + enemy arrow (drawn first, behind structure) ──────────────
  const apex = px(0, -halfW);
  if (p.sectors.present) {
    const Rft = enemyMargin * 0.92;
    const toRad = (deg: number): number => (deg * Math.PI) / 180;
    const edge = (deg: number): [number, number] => px(Rft * Math.sin(toRad(deg)), -halfW - Rft * Math.cos(toRad(deg)));
    const l = edge(p.sectors.leftDeg);
    const r = edge(p.sectors.rightDeg);
    parts.push(
      el('polygon', {
        points: apex[0] + ',' + apex[1] + ' ' + l[0] + ',' + l[1] + ' ' + r[0] + ',' + r[1],
        fill: 'var(--enemy)', opacity: '0.14',
      }),
      el('line', { x1: apex[0], y1: apex[1], x2: l[0], y2: l[1], stroke: 'var(--enemy)', 'stroke-width': 'var(--w-thin)', 'stroke-dasharray': '4 3' }),
      el('line', { x1: apex[0], y1: apex[1], x2: r[0], y2: r[1], stroke: 'var(--enemy)', 'stroke-width': 'var(--w-thin)', 'stroke-dasharray': '4 3' }),
    );
    used.add('sectors');
    parts.push(callout('sectors', ...midpoint(apex, r), used));
    // Sector limits labeled in degrees AND mils — this is what makes the plan a usable range
    // card. Placed outboard of each sector edge so they never crowd the ENEMY arrow.
    parts.push(
      textEl(l[0] - 4, l[1] - 4, azimuthLabel(p.sectors.leftDeg), { fill: 'var(--ink-soft)', 'font-size': 9.5, 'text-anchor': 'end', 'font-family': 'ui-monospace, monospace' }),
      textEl(r[0] + 4, r[1] - 4, azimuthLabel(p.sectors.rightDeg), { fill: 'var(--ink-soft)', 'font-size': 9.5, 'text-anchor': 'start', 'font-family': 'ui-monospace, monospace' }),
    );
    // Machine-gun positions get a final protective line (FPL) along the left sector limit —
    // the grazing-fire line a gun lays on. Plain language first, doctrinal term alongside.
    if (positions[result.inputs.positionType]?.crewSize && result.inputs.positionType.startsWith('mg')) {
      parts.push(
        el('line', { x1: apex[0], y1: apex[1], x2: l[0], y2: l[1], stroke: 'var(--enemy)', 'stroke-width': 2, 'stroke-dasharray': '2 2' }),
        textEl(midpoint(apex, l)[0] - 6, midpoint(apex, l)[1], 'grazing-fire line (FPL)', { fill: 'var(--enemy)', 'font-size': 9.5, 'text-anchor': 'end', 'font-family': 'system-ui, sans-serif' }),
      );
    }
  }
  const arrowTop = px(0, -halfW - enemyMargin * 0.95);
  const arrowBase = px(0, -halfW - 0.3);
  parts.push(
    el('line', { x1: arrowBase[0], y1: arrowBase[1], x2: arrowTop[0], y2: arrowTop[1], stroke: 'var(--enemy)', 'stroke-width': 3.4, 'marker-end': 'url(#mk-arrow)' }),
    textEl(arrowTop[0], arrowTop[1] - 6, 'ENEMY', { fill: 'var(--enemy)', 'font-size': 12, 'font-weight': '700', 'text-anchor': 'middle', 'letter-spacing': '1' }),
  );
  used.add('enemy');
  parts.push(callout('enemy', arrowBase[0] + 16, arrowBase[1] - 6, used));

  // ── Parapet ring + fighting bay ────────────────────────────────────────────────
  // A round position (mortar pit) reads as a circle here, not a square — the plan view has to
  // match the same silhouette the 3D model and doctrine both use (§ scene3d.ts's circular
  // branch). The rectangular ring below stays the shared case for every other shape.
  if (geo.shape === 'circular') {
    const rOuter = Math.max(p.outerL, p.outerW) / 2;
    const rHole = Math.max(p.holeL, p.holeW) / 2;
    const c = px(0, 0);
    parts.push(el('circle', { cx: c[0], cy: c[1], r: proj.lenPx(rOuter), fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
    parts.push(el('circle', { cx: c[0], cy: c[1], r: proj.lenPx(rHole), fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
  } else {
    const oTL = px(-halfL, -halfW);
    parts.push(
      el('rect', { x: oTL[0], y: oTL[1], width: proj.lenPx(p.outerL), height: proj.lenPx(p.outerW), fill: 'var(--draw-parapet)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)', rx: 3 }),
    );
    const hTL = px(-p.holeL / 2, -p.holeW / 2);
    parts.push(
      el('rect', { x: hTL[0], y: hTL[1], width: proj.lenPx(p.holeL), height: proj.lenPx(p.holeW), fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }),
    );
    // The inverted-T's rear connecting trench / the L-shape's side alcove — same footprint
    // math as scene3d.ts's 3D branches for these two shapes, so the plan matches the model
    // instead of flattening every non-rectangular design down to a plain rectangle.
    if (geo.shape === 'inverted_t') {
      const stemW = Math.max(2, p.holeL * 0.3);
      const sTL = px(-stemW / 2, p.holeW / 2);
      parts.push(el('rect', { x: sTL[0], y: sTL[1], width: proj.lenPx(stemW), height: proj.lenPx(stemLen), fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
    } else if (geo.shape === 'l_shape') {
      const armW = p.holeW * 0.9;
      const aTL = px(p.holeL / 2, p.holeW / 2 - armW);
      parts.push(el('rect', { x: aTL[0], y: aTL[1], width: proj.lenPx(armLen), height: proj.lenPx(armW), fill: 'var(--draw-bay)', stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)' }));
    }
  }
  used.add('parapet');
  parts.push(callout('parapet', ...px(0, -(halfW + p.holeW / 2) / 2), used));
  used.add('bay');
  parts.push(callout('bay', ...px(-p.holeL * 0.22, 0), used));

  // Firing platform (crew-served) at the front of the bay.
  if (p.platform) {
    const plTL = px(-p.platform.L / 2, -p.holeW / 2);
    parts.push(el('rect', { x: plTL[0], y: plTL[1], width: proj.lenPx(p.platform.L), height: proj.lenPx(p.platform.W), fill: 'var(--draw-timber)', opacity: '0.85' }));
    used.add('firing_step');
    parts.push(callout('firing_step', ...px(0, -p.holeW / 2 + p.platform.W / 2), used));
  }

  // Sumps.
  let sumpCalloutPlaced = false;
  for (const s of p.sumps) {
    const c = px(s.xFt, s.yFt);
    parts.push(el('circle', { cx: c[0], cy: c[1], r: 3.5, fill: 'var(--draw-timber)', stroke: 'var(--draw-outline)', 'stroke-width': 1 }));
    if (!sumpCalloutPlaced) {
      used.add('sump');
      parts.push(callout('sump', c[0] + 12, c[1], used));
      sumpCalloutPlaced = true;
    }
  }

  // ── A–A cut line (matches drawSection) ─────────────────────────────────────────
  const cutTop = px(0, -halfW - 0.2);
  const cutBot = px(0, halfW + 0.2);
  parts.push(el('line', { x1: cutTop[0], y1: cutTop[1], x2: cutBot[0], y2: cutBot[1], stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-dim)', 'stroke-dasharray': '10 4 3 4' }));
  parts.push(cutMarker(cutTop[0], cutTop[1] - 2), cutMarker(cutBot[0], cutBot[1] + 12));

  // ── FRONT / REAR ───────────────────────────────────────────────────────────────
  const frontLabel = px(halfL * 0.72, -halfW * 0.8);
  const rearLabel = px(halfL * 0.72, halfW * 0.82);
  parts.push(
    // Full-strength ink: these sit ON the parapet fill, and the night theme's soft ink
    // (#c76a45) is nearly the same hue as the night parapet (#b5622f) — invisible.
    textEl(frontLabel[0], frontLabel[1], 'FRONT', { fill: 'var(--ink)', 'font-size': 10.5, 'font-weight': '700', 'text-anchor': 'middle', 'letter-spacing': '1' }),
    textEl(rearLabel[0], rearLabel[1], 'REAR', { fill: 'var(--ink)', 'font-size': 10.5, 'font-weight': '700', 'text-anchor': 'middle', 'letter-spacing': '1' }),
  );

  // ── Dimensions ─────────────────────────────────────────────────────────────────
  const bTL = px(-p.holeL / 2, p.holeW / 2);
  const bTR = px(p.holeL / 2, p.holeW / 2);
  parts.push(hDim(bTL[0], bTR[0], bTL[1] + 26, dimLabel('frontage')));
  const lT = px(-p.holeL / 2, -p.holeW / 2);
  const lB = px(-p.holeL / 2, p.holeW / 2);
  parts.push(vDim(lT[1], lB[1], lT[0] - 30, dimLabel('front_back')));

  // ── North arrow + scale bar (range-card chrome) ────────────────────────────────
  parts.push(northArrow(W - 34, HEADER_H + 42));
  // Scale bar sits in the free padding band ABOVE the legend panel — at -8 its unit label
  // landed exactly on the LEGEND heading baseline (legendPanel draws it at -LEGEND_H + 8).
  parts.push(scaleBar(20, H - LEGEND_H - 24, proj, unit));

  // ── Legend ───────────────────────────────────────────────────────────────────
  const legend = legendPanel(12, H - LEGEND_H + 14, W - 24, used);

  return svgRoot(W, H, a11y, a11yDefs, headerBar(W, 'PLAN VIEW') + group({}, ...parts) + legend);
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function cutMarker(x: number, y: number): string {
  return group(
    { class: 'cut-marker' },
    el('circle', { cx: x, cy: y, r: 7, fill: 'var(--surface)', stroke: 'var(--draw-outline)', 'stroke-width': 1.4 }),
    textEl(x, y + 4, 'A', { fill: 'var(--draw-outline)', 'font-size': 10, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': 'ui-monospace, monospace' }),
  );
}
