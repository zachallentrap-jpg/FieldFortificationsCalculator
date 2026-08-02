// Plan view (top-down) — projection of the engine's PlanRect: top opening with the
// floor inset showing batter, enemy band pinned to the top edge (§3.3: identical
// position on every drawing, pure K black, hatched arrowhead so it survives a
// red-lens filter).

import type { Result } from '../engine/compute';
import { display, scaleOrCanonical } from './precision';
import { el, svgDoc, text } from './svg';
import type { RenderCtx } from './drawSection';

const CANON = { L: 3, W: 4, run: 1 } as const;
const PX_PER_FT = 40;
const M = 56;
const BAND_H = 26;

export const drawPlan = (r: Result, ctx: RenderCtx): string => {
  const t = ctx.theme;
  const floorL = scaleOrCanonical(r.plan.floorL, CANON.L) * PX_PER_FT;
  const floorW = scaleOrCanonical(r.plan.floorW, CANON.W) * PX_PER_FT;
  const run = (scaleOrCanonical(r.plan.L, CANON.L + 2 * CANON.run) * PX_PER_FT - floorL) / 2;

  const topL = floorL + 2 * run;
  const topW = floorW + 2 * run;
  const w = topL + 2 * M;
  const h = topW + 2 * M + BAND_H + 40;

  const bandY = 8;
  const x0 = M, y0 = BAND_H + 24 + M / 2;

  // Enemy band: screen-space, pinned to the top edge, K black, hatched arrowhead.
  const bandText = text({
    x: w / 2 - 30, y: bandY + 17, fill: '#ffffff', 'font-size': 13,
    'font-family': 'sans-serif', 'text-anchor': 'middle', 'font-weight': 'bold',
  }, 'ENEMY THIS WAY');
  const hatch = [0, 1, 2].map((i) =>
    el('line', {
      x1: w / 2 + 44 + i * 10, y1: bandY + 5, x2: w / 2 + 54 + i * 10, y2: bandY + 21,
      stroke: '#ffffff', 'stroke-width': 2.5,
    })).join('');
  const band =
    el('rect', { x: 0, y: bandY, width: w, height: BAND_H, fill: t.enemy }) + bandText + hatch;

  const opening = el('rect', {
    x: x0, y: y0, width: topL, height: topW,
    fill: t.earthDark, stroke: t.ink, 'stroke-width': 1.5,
  });
  const floor = el('rect', {
    x: x0 + run, y: y0 + run, width: floorL, height: floorW,
    fill: t.earth, stroke: t.ink, 'stroke-width': 1, 'stroke-dasharray': '5 3',
  });
  const batterNote = text(
    { x: x0 + run + 6, y: y0 + run + 16, fill: t.inkMuted, 'font-size': 11, 'font-family': 'sans-serif' },
    'floor (walls lean back to the outer line)',
  );

  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, tokenBox: boolean): string => {
    const midX = (x1 + x2) / 2;
    return (
      el('line', { x1, y1, x2, y2, stroke: t.dimension, 'stroke-width': 1 }) +
      (tokenBox
        ? el('rect', { x: midX - 70, y: y1 - 22, width: 140, height: 18, fill: t.tokenBox, stroke: t.dimension, 'stroke-width': 0.75, rx: 4 })
        : '') +
      text({ x: midX, y: y1 - 9, fill: t.dimension, 'font-size': 12, 'font-family': 'sans-serif', 'text-anchor': 'middle' }, label)
    );
  };

  const dL = display(r.solid.floorL, tokenOf(r, 'hole.L'));
  const dims = dim(x0 + run, y0 + topW + 26, x0 + run + floorL, y0 + topW + 26, dL.text, dL.kind === 'token');

  const banner = ctx.watermark.state === 'TEMPLATE'
    ? text({ x: w / 2, y: h - 8, fill: t.warn, 'font-size': 12, 'font-family': 'sans-serif', 'text-anchor': 'middle', 'font-weight': 'bold' },
        'NO SCALE — TEMPLATE')
    : '';

  return svgDoc(
    { w, h, title: `${r.positionLabel} — plan`, desc: 'Top-down view: the black band points at the enemy; the outer line is the top of the hole, the dashed line is the floor.' },
    [el('rect', { x: 0, y: 0, width: w, height: h, fill: t.paper }), band, opening, floor, batterNote, dims, banner],
  );
};

const tokenOf = (r: Result, key: string): string =>
  r.dims.find((d) => d.key === key)?.token ?? key;

