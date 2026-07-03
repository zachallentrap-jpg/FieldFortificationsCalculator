// Isometric schematic (§10) — orientation only, deliberately simple. Shows the position as a
// 2.5D cuboid (parapet ring + recessed fighting bay) with the enemy direction, so a viewer
// grasps the 3D shape and which way is out. Not a measured drawing (the plan/section govern);
// no dimensions here. Shares the header + legend chrome and the callout registry.

import { el, group, textEl, callout } from './svg';
import { HEADER_H, LEGEND_H, headerBar, legendPanel, emptyPrompt, svgRoot } from './chrome';
import { describe, a11yAttrs } from './a11y';
import type { GeometryModel } from '../engine/geometry';
import type { Result } from '../engine/types';

const W = 760;
const H = 560;
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

export function drawIso(result: Result): string {
  const geo = result.geometry as GeometryModel;
  const a11y = describe(result, 'iso');
  const a11yDefs = a11yAttrs(a11y).defs;

  if (!geo.hasAnything) {
    return svgRoot(W, H, a11y, a11yDefs, headerBar(W, 'ISOMETRIC') + emptyPrompt(W, H, 'Configure a position to see the isometric.'));
  }

  const p = geo.plan;
  const depth = geo.section.depthOfCut;
  const cx = W / 2;
  const cy = (HEADER_H + 20 + (H - LEGEND_H)) / 2;

  // Scale so the footprint fits comfortably.
  const spanFt = Math.max(p.outerL, p.outerW) + depth;
  const k = Math.min(210 / (p.outerL * COS30 + p.outerW * COS30), 150 / (depth + (p.outerL + p.outerW) * SIN30));

  // Iso projection: feet (x right, y back, z up) → screen, centered.
  const iso = (x: number, y: number, z: number): [number, number] => [cx + (x - y) * COS30 * k, cy + ((x + y) * SIN30 - z) * k];

  const hl = p.outerL / 2;
  const hw = p.outerW / 2;
  const used = new Set<string>();
  const parts: string[] = [];

  const poly = (pts: [number, number][], fill: string, extra: Record<string, string | number> = {}): string =>
    el('polygon', { points: pts.map((pt) => pt[0] + ',' + pt[1]).join(' '), fill, stroke: 'var(--draw-outline)', 'stroke-width': 'var(--w-outline)', ...extra });

  // Outer top face (grade) + two visible side walls of the parapet block.
  const tA = iso(-hl, -hw, 0), tB = iso(hl, -hw, 0), tC = iso(hl, hw, 0), tD = iso(-hl, hw, 0);
  const bB = iso(hl, -hw, -0.6), bC = iso(hl, hw, -0.6), bD = iso(-hl, hw, -0.6);
  parts.push(poly([tD, tC, bC, bD], 'var(--draw-parapet)')); // front-facing wall
  parts.push(poly([tB, tC, bC, bB], 'var(--draw-parapet)')); // side wall
  parts.push(poly([tA, tB, tC, tD], 'var(--draw-parapet)')); // top

  // Recessed fighting bay (hole) sunk into the top.
  const bhl = p.holeL / 2, bhw = p.holeW / 2;
  const hA = iso(-bhl, -bhw, 0), hB = iso(bhl, -bhw, 0), hC = iso(bhl, bhw, 0), hD = iso(-bhl, bhw, 0);
  const fA = iso(-bhl, -bhw, -depth), fB = iso(bhl, -bhw, -depth), fC = iso(bhl, bhw, -depth), fD = iso(-bhl, bhw, -depth);
  parts.push(poly([hA, hB, fB, fA], 'var(--draw-bay)')); // front inner wall
  parts.push(poly([hA, hD, fD, fA], 'var(--draw-bay)')); // left inner wall
  parts.push(poly([fA, fB, fC, fD], 'var(--draw-bay)', { opacity: '0.9' })); // floor
  used.add('bay');
  parts.push(callout('bay', ...midpt(fA, fC), used));
  used.add('parapet');
  parts.push(callout('parapet', ...midpt(tA, tB), used));

  // Enemy arrow off the front edge.
  const eBase = iso(0, -hw, 0.2);
  const eTip = iso(0, -hw - Math.max(2, hw * 0.8), 0.2);
  parts.push(
    el('line', { x1: eBase[0], y1: eBase[1], x2: eTip[0], y2: eTip[1], stroke: 'var(--enemy)', 'stroke-width': 3.2, 'marker-end': 'url(#mk-arrow)' }),
    textEl(eTip[0], eTip[1] - 6, 'ENEMY', { fill: 'var(--enemy)', 'font-size': 12, 'font-weight': '700', 'text-anchor': 'middle', 'letter-spacing': '1' }),
  );
  used.add('enemy');
  parts.push(callout('enemy', eBase[0] + 14, eBase[1], used));
  parts.push(textEl(iso(0, hw, 0)[0], iso(0, hw, 0)[1] + 22, 'REAR', { fill: 'var(--ink-soft)', 'font-size': 10.5, 'font-weight': '700', 'text-anchor': 'middle', 'letter-spacing': '1' }));

  const legend = legendPanel(12, H - LEGEND_H + 14, W - 24, used);
  return svgRoot(W, H, a11y, a11yDefs, headerBar(W, 'ISOMETRIC — SCHEMATIC') + group({}, ...parts) + legend);
}

function midpt(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
