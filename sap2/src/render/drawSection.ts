// Section view (front-to-back cut) — projection of the engine's SectionTrapezoid,
// nothing re-derived (blueprint §4.4). TEMPLATE mode draws the same topology at
// fixed canonical proportions with ⟨tokens⟩ on every dimension line, a NO SCALE —
// TEMPLATE scale bar slot, and the DO-NOT-SCALE stamp (§2.2). Zero digit glyphs in
// TEMPLATE text — gate-asserted.

import type { Result } from '../engine/compute';
import type { WatermarkState } from '../schema/watermark';
import type { ResolvedTheme } from './theme';
import { display, scaleOrCanonical } from './precision';
import { el, fmt as f, svgDoc, text } from './svg';

// Fixed canonical proportions for unfilled dimensions (render layout structure, not
// doctrine): identical for every case, stamped DO NOT SCALE.
const CANON = { span: 4, depth: 3, run: 1 } as const;
const PX_PER_FT = 40;
const M = 56; // margin

export interface RenderCtx {
  readonly theme: ResolvedTheme;
  readonly watermark: WatermarkState;
}

const stateBanner = (w: WatermarkState): readonly string[] => {
  switch (w.state) {
    case 'TEMPLATE':
      return ['NO SCALE — TEMPLATE', 'DO NOT SCALE — proportions are arbitrary and identical for every case'];
    case 'TRAINING':
      return ['TRAINING — VALUES FICTITIOUS'];
    case 'FILLED_UNCOMMISSIONED':
      return [`UNVERIFIED — NOT COMMISSIONED (${w.reason.replace(/-/g, ' ')})`];
    case 'STALE':
      return ['STALE DATA — schema changed since this fill'];
    case 'COMMISSIONED':
      return [];
  }
};

export const drawSection = (r: Result, ctx: RenderCtx): string => {
  const t = ctx.theme;
  const span = scaleOrCanonical(r.section.floorSpan, CANON.span) * PX_PER_FT;
  const depth = scaleOrCanonical(r.section.depth, CANON.depth) * PX_PER_FT;
  const run = scaleOrCanonical(r.section.wallRun, CANON.run) * PX_PER_FT;

  const w = span + 2 * run + 2 * M;
  const h = depth + 2 * M + 60;
  const gradeY = M;
  const floorY = gradeY + depth;
  const leftTop = M;
  const leftFloor = M + run;
  const rightFloor = leftFloor + span;
  const rightTop = rightFloor + run;

  const earth = el('path', {
    d: `M 0 ${f(gradeY)} L ${f(leftTop)} ${f(gradeY)} L ${f(leftFloor)} ${f(floorY)} ` +
       `L ${f(rightFloor)} ${f(floorY)} L ${f(rightTop)} ${f(gradeY)} L ${f(w)} ${f(gradeY)} ` +
       `L ${f(w)} ${f(h)} L 0 ${f(h)} Z`,
    fill: t.earth, stroke: t.ink, 'stroke-width': 1.5,
  });
  const gradeLine = el('line', { x1: 0, y1: gradeY, x2: w, y2: gradeY, stroke: t.grade, 'stroke-width': 2 });
  const gradeLabel = text({ x: 6, y: gradeY - 6, fill: t.inkMuted, 'font-size': 12, 'font-family': 'sans-serif' }, 'GROUND');

  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, tokenBox: boolean): string => {
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    const vertical = x1 === x2;
    return (
      el('line', { x1, y1, x2, y2, stroke: t.dimension, 'stroke-width': 1 }) +
      (tokenBox
        ? el('rect', {
            x: vertical ? midX + 4 : midX - 70, y: vertical ? midY - 9 : (y1 - 22),
            width: 140, height: 18, fill: t.tokenBox, stroke: t.dimension, 'stroke-width': 0.75, rx: 4,
          })
        : '') +
      text({
        x: vertical ? midX + 74 : midX, y: (vertical ? midY : y1 - 22 + 9) + 4,
        fill: t.dimension, 'font-size': 12, 'font-family': 'sans-serif', 'text-anchor': 'middle',
      }, label)
    );
  };

  const dW = display(r.section.floorSpan, tokenOf(r, 'hole.W'));
  const dD = display(r.section.depth, tokenOf(r, 'hole.D'));
  const dims =
    dim(leftFloor, floorY + 18, rightFloor, floorY + 18, dW.text, dW.kind === 'token') +
    dim(rightTop + 22, gradeY, rightTop + 22, floorY, dD.text, dD.kind === 'token');

  const bannerLines = stateBanner(ctx.watermark);
  const banner = bannerLines
    .map((line, i) =>
      text({
        x: w / 2, y: h - 34 + i * 16, fill: t.warn, 'font-size': 12,
        'font-family': 'sans-serif', 'text-anchor': 'middle', 'font-weight': 'bold',
      }, line))
    .join('');

  const caption = text(
    { x: w / 2, y: h - 6, fill: t.inkMuted, 'font-size': 11, 'font-family': 'sans-serif', 'text-anchor': 'middle' },
    'SLICED VIEW — shows the inside',
  );

  return svgDoc(
    { w, h, title: `${r.positionLabel} — section`, desc: 'Cut-through view of the excavation from the side, showing depth and wall lean.' },
    [el('rect', { x: 0, y: 0, width: w, height: h, fill: t.paper }), earth, gradeLine, gradeLabel, dims, banner, caption],
  );
};

const tokenOf = (r: Result, key: string): string =>
  r.dims.find((d) => d.key === key)?.token ?? key;
