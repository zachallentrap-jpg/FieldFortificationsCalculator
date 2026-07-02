// Shared drawing chrome (§10) — the visual system every view reuses so plan, section, iso,
// and the authored reference all speak one language: a dark header bar per view, numbered
// callouts tied to ONE shared legend (svg.ts registry), coded high-contrast fills, all
// dimensions in a single accent with (PH) flags, an explicit scale (bar + standing figure),
// and the data-driven NOT FOR FIELD USE banner. Colors/weights are tokens (tokens.css) —
// no hardcoded hex here. Pattern fills give redundancy beyond hue so drawings stay legible
// in Night theme, monochrome print, and under color-vision deficiency.

import { el, group, textEl, esc, buildLegend, callout } from './svg';
import type { Projector } from './project';
import { fmtLength } from '../doctrine/units';
import type { UnitSystem } from '../doctrine/units';
import type { A11y } from './a11y';

export const HEADER_H = 38;
export const LEGEND_H = 92;
export const REF_FIGURE_FT = 5.83; // ~5'-10" reference height for the standing figure (§10)

// ── Pattern / marker defs (redundancy beyond hue) ────────────────────────────────
export function drawingDefs(): string {
  const earth =
    '<pattern id="pat-earth" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    el('rect', { width: 8, height: 8, fill: 'var(--draw-earth)' }) +
    el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'var(--draw-outline)', 'stroke-width': 1.1 }) +
    '</pattern>';
  const cover =
    '<pattern id="pat-cover" width="7" height="7" patternUnits="userSpaceOnUse">' +
    el('rect', { width: 7, height: 7, fill: 'var(--draw-earth)' }) +
    el('circle', { cx: 3.5, cy: 3.5, r: 1, fill: 'var(--draw-outline)' }) +
    '</pattern>';
  const engineered =
    '<pattern id="pat-engineered" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    el('rect', { width: 10, height: 10, fill: 'var(--surface)' }) +
    el('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: 'var(--draw-engineered)', 'stroke-width': 2 }) +
    '</pattern>';
  const arrow =
    '<marker id="mk-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--enemy)' }) +
    '</marker>';
  const tick =
    '<marker id="mk-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">' +
    el('line', { x1: 5, y1: 1, x2: 5, y2: 9, stroke: 'var(--dim)', 'stroke-width': 1.4 }) +
    '</marker>';
  const north =
    '<marker id="mk-north" viewBox="0 0 10 10" refX="5" refY="8" markerWidth="9" markerHeight="9" orient="auto">' +
    el('path', { d: 'M5,0 L9,9 L5,6 L1,9 z', fill: 'var(--ink)' }) +
    '</marker>';
  return '<defs>' + earth + cover + engineered + arrow + tick + north + '</defs>';
}

// ── Header bar ───────────────────────────────────────────────────────────────────
export function headerBar(w: number, title: string): string {
  return group(
    { class: 'header' },
    el('rect', { x: 0, y: 0, width: w, height: HEADER_H, fill: 'var(--ink)' }),
    textEl(12, HEADER_H / 2 + 5, title, {
      fill: 'var(--surface)',
      'font-size': 15,
      'font-weight': '700',
      'letter-spacing': '1.5',
      'font-family': 'ui-monospace, monospace',
    }),
    textEl(w - 12, HEADER_H / 2 + 4, 'not to scale — dimensions govern', {
      fill: 'var(--surface)',
      'font-size': 10.5,
      'text-anchor': 'end',
      'font-family': 'system-ui, sans-serif',
      opacity: '0.85',
    }),
  );
}

// Data-driven NOT FOR FIELD USE banner (§2.5) — a thin strip under the header, shown only
// while placeholder-derived figures remain. Clears at zero placeholders.
export function fieldUseBanner(w: number, remaining: number): string {
  if (remaining <= 0) return '';
  return group(
    { class: 'banner' },
    el('rect', { x: 0, y: HEADER_H, width: w, height: 16, fill: 'var(--banner-bg)' }),
    textEl(w / 2, HEADER_H + 12, 'NOT FOR FIELD USE — illustrative placeholder data', {
      fill: 'var(--banner-text)',
      'font-size': 10,
      'font-weight': '700',
      'text-anchor': 'middle',
      'letter-spacing': '0.5',
      'font-family': 'system-ui, sans-serif',
    }),
  );
}

// ── Dimension lines (single accent, end ticks, (PH) suffix) ──────────────────────
function dimText(label: string, ph: boolean): string {
  return esc(label) + (ph ? ' (PH)' : '');
}

export function hDim(px1: number, px2: number, y: number, label: string, ph: boolean): string {
  const ext = 5;
  const mid = (px1 + px2) / 2;
  return group(
    { class: 'dim' },
    el('line', { x1: px1, y1: y - ext, x2: px1, y2: y + ext, stroke: 'var(--dim)', 'stroke-width': 'var(--w-thin)' }),
    el('line', { x1: px2, y1: y - ext, x2: px2, y2: y + ext, stroke: 'var(--dim)', 'stroke-width': 'var(--w-thin)' }),
    el('line', {
      x1: px1, y1: y, x2: px2, y2: y,
      stroke: 'var(--dim)', 'stroke-width': 'var(--w-dim)',
      'marker-start': 'url(#mk-tick)', 'marker-end': 'url(#mk-tick)',
    }),
    el('rect', { x: mid - 3.4 * (dimText(label, ph).length), y: y - 15, width: 6.8 * dimText(label, ph).length, height: 12, fill: 'var(--surface)', opacity: '0.9', rx: 2 }),
    textEl(mid, y - 5, dimText(label, ph), {
      fill: 'var(--dim-text)', 'font-size': 11, 'font-weight': '600', 'text-anchor': 'middle', 'font-family': 'ui-monospace, monospace',
    }),
  );
}

export function vDim(py1: number, py2: number, x: number, label: string, ph: boolean): string {
  const ext = 5;
  const mid = (py1 + py2) / 2;
  const t = dimText(label, ph);
  return group(
    { class: 'dim' },
    el('line', { x1: x - ext, y1: py1, x2: x + ext, y2: py1, stroke: 'var(--dim)', 'stroke-width': 'var(--w-thin)' }),
    el('line', { x1: x - ext, y1: py2, x2: x + ext, y2: py2, stroke: 'var(--dim)', 'stroke-width': 'var(--w-thin)' }),
    el('line', {
      x1: x, y1: py1, x2: x, y2: py2,
      stroke: 'var(--dim)', 'stroke-width': 'var(--w-dim)',
      'marker-start': 'url(#mk-tick)', 'marker-end': 'url(#mk-tick)',
    }),
    el('rect', { x: x + 6, y: mid - 6, width: 6.8 * t.length + 4, height: 12, fill: 'var(--surface)', opacity: '0.9', rx: 2 }),
    textEl(x + 8, mid + 4, t, {
      fill: 'var(--dim-text)', 'font-size': 11, 'font-weight': '600', 'text-anchor': 'start', 'font-family': 'ui-monospace, monospace',
    }),
  );
}

// ── Scale bar (explicit ruler) ───────────────────────────────────────────────────
export function scaleBar(xPx: number, yPx: number, proj: Projector, unit: UnitSystem): string {
  const spanFt = unit === 'metric' ? 3.281 : 5; // 1 m or 5 ft
  const lenPx = Math.max(8, proj.lenPx(spanFt));
  const label = unit === 'metric' ? '0            1 m' : "0            5'";
  return group(
    { class: 'scale' },
    el('line', { x1: xPx, y1: yPx, x2: xPx + lenPx, y2: yPx, stroke: 'var(--ink)', 'stroke-width': 'var(--w-dim)' }),
    el('line', { x1: xPx, y1: yPx - 4, x2: xPx, y2: yPx + 4, stroke: 'var(--ink)', 'stroke-width': 'var(--w-dim)' }),
    el('line', { x1: xPx + lenPx, y1: yPx - 4, x2: xPx + lenPx, y2: yPx + 4, stroke: 'var(--ink)', 'stroke-width': 'var(--w-dim)' }),
    textEl(xPx, yPx + 15, label, { fill: 'var(--ink-soft)', 'font-size': 10, 'font-family': 'ui-monospace, monospace' }),
  );
}

// ── Standing figure (a simple cartoon person + labeled reference height) ──────────
// Built from plain rounded primitives (circle head, pill-shaped torso, two pill legs) so it
// unmistakably reads as "a person" at a glance — a hand-rolled outline path here previously
// tapered to points at both the top AND bottom, which read as a blob rather than a figure.
export function standingFigure(xPx: number, groundYpx: number, proj: Projector): string {
  const hPx = Math.max(18, proj.lenPx(REF_FIGURE_FT));
  const headR = Math.max(2.2, hPx * 0.08);
  const topY = groundYpx - hPx;
  const torsoTop = topY + headR * 2.1;
  const torsoW = Math.max(3, hPx * 0.2);
  const torsoH = hPx * 0.4;
  const legTop = torsoTop + torsoH - 1;
  const legH = groundYpx - legTop;
  const legW = torsoW * 0.42;
  const legGap = torsoW * 0.14;
  return group(
    { class: 'figure', opacity: '0.72', fill: 'var(--ink-soft)' },
    el('circle', { cx: xPx, cy: topY + headR, r: headR }),
    el('rect', { x: xPx - torsoW / 2, y: torsoTop, width: torsoW, height: torsoH, rx: torsoW / 2 }),
    el('rect', { x: xPx - legGap / 2 - legW, y: legTop, width: legW, height: legH, rx: legW / 2 }),
    el('rect', { x: xPx + legGap / 2, y: legTop, width: legW, height: legH, rx: legW / 2 }),
    textEl(xPx + torsoW / 2 + 6, topY + hPx * 0.5, 'ref ~5\'-10"', {
      fill: 'var(--ink-soft)', 'font-size': 9.5, 'font-family': 'ui-monospace, monospace',
    }),
  );
}

// ── Range-card helpers (Phase 3) — the plan doubles as a sector sketch ────────────
// Doctrine directions are given in BOTH degrees and mils (6400 mils / 360°). Plain-language
// first per §2.5: the technical term (mils) rides alongside the everyday one (degrees).
export function degToMils(deg: number): number {
  const norm = ((deg % 360) + 360) % 360;
  return Math.round((norm * 6400) / 360);
}
export function azimuthLabel(deg: number): string {
  const norm = Math.round(((deg % 360) + 360) % 360);
  return norm + '° (' + degToMils(deg) + ' mils)';
}

// A small north arrow in a corner — a range card is useless without knowing which way is up.
export function northArrow(xPx: number, yPx: number): string {
  return group(
    { class: 'north' },
    el('line', { x1: xPx, y1: yPx + 16, x2: xPx, y2: yPx - 10, stroke: 'var(--ink)', 'stroke-width': 'var(--w-dim)', 'marker-end': 'url(#mk-north)' }),
    textEl(xPx, yPx + 28, 'N', { fill: 'var(--ink)', 'font-size': 11, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': 'ui-monospace, monospace' }),
  );
}

// ── Legend panel (generated from the callouts a view actually drew) ──────────────
export function legendPanel(x: number, y: number, w: number, used: Set<string>): string {
  const entries = buildLegend(used);
  const cols = 3;
  const colW = w / cols;
  const rowH = 18;
  let items = '';
  entries.forEach((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * colW + 12;
    const cy = y + 20 + row * rowH;
    items +=
      callout(legendKeyForN(e.n), cx, cy, undefined) +
      textEl(cx + 16, cy + 4, e.label, { fill: 'var(--ink)', 'font-size': 11, 'font-family': 'system-ui, sans-serif' });
  });
  return group(
    { class: 'legend' },
    el('line', { x1: x, y1: y, x2: x + w, y2: y, stroke: 'var(--border)', 'stroke-width': 1 }),
    textEl(x, y - 6, 'LEGEND', { fill: 'var(--ink-soft)', 'font-size': 10, 'font-weight': '700', 'letter-spacing': '1.5', 'font-family': 'ui-monospace, monospace' }),
    items,
  );
}

// Reverse-map a legend number back to its registry key so legendPanel can re-render the disc.
import { CALLOUTS } from './svg';
function legendKeyForN(n: number): string {
  for (const [k, def] of Object.entries(CALLOUTS)) if (def.n === n) return k;
  return '';
}

// ── Empty-state prompt (never a blank box, §10) ──────────────────────────────────
export function emptyPrompt(w: number, h: number, msg: string): string {
  return group(
    { class: 'empty' },
    el('rect', { x: 12, y: HEADER_H + 24, width: w - 24, height: h - HEADER_H - 48, fill: 'none', stroke: 'var(--border)', 'stroke-width': 1.5, 'stroke-dasharray': '6 5', rx: 8 }),
    textEl(w / 2, h / 2, msg, { fill: 'var(--ink-soft)', 'font-size': 13, 'text-anchor': 'middle', 'font-family': 'system-ui, sans-serif' }),
  );
}

// ── Full <svg> assembly ──────────────────────────────────────────────────────────
export function svgRoot(
  w: number,
  h: number,
  a11y: A11y,
  a11yDefs: string,
  body: string,
): string {
  const attrs =
    ' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '"' +
    ' role="img" aria-labelledby="' + a11y.titleId + ' ' + a11y.descId + '"' +
    ' font-family="system-ui, sans-serif"';
  return (
    '<svg' + attrs + '>' +
    drawingDefs() +
    a11yDefs +
    el('rect', { x: 0, y: 0, width: w, height: h, fill: 'var(--surface)' }) +
    body +
    '</svg>'
  );
}
