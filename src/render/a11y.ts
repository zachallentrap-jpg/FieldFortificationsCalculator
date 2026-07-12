// Accessibility for drawings (§10, §12). Produces role="img" + <title>/<desc> text that
// summarizes the position, its depth, the front (enemy) direction, and its features, plus a
// stable id pair for aria-labelledby. Numbered callouts already expose their legend name via
// aria-label (svg.ts). Text alternatives make the drawings usable by screen readers and in
// any theme.

import { positions } from '../doctrine/positions';
import { fmtLength } from '../doctrine/units';
import type { Result } from '../engine/types';
import type { GeometryModel } from '../engine/geometry';

export type DrawView = 'plan' | 'section' | 'iso';

export interface A11y {
  role: 'img';
  titleId: string;
  descId: string;
  title: string;
  desc: string;
}

const VIEW_LABEL: Record<DrawView, string> = {
  plan: 'Plan view',
  section: 'Section A–A',
  iso: 'Isometric view',
};

export function describe(result: Result, view: DrawView): A11y {
  const posLabel = positions[result.inputs.positionType]?.label ?? result.inputs.positionType;
  const cutDepth = fmtLength(result.resolved.depthOfCut, result.inputs.unit);
  const geo = result.geometry as GeometryModel;
  // A through-route with no firing aperture (connecting_trench) has no enemy-facing side —
  // the plan draws no ENEMY arrow or FRONT/REAR labels for it either (drawPlan.ts isOpenCorridor).
  const isOpenCorridor = !geo.plan.sectors.present && geo.shape !== 'circular' && geo.shape !== 'vehicle_ramp';

  const features: string[] = [];
  if (result.cover.roofPath === 'earth_on_stringers') features.push('earth-on-stringers overhead cover');
  if (result.cover.roofPath === 'engineered_required') features.push('an engineered roof (designed by others)');
  if (result.inputs.revetment !== 'none') features.push('revetted walls');
  if (result.inputs.sump) features.push('grenade sumps');
  if (result.inputs.camouflage) features.push('camouflage');

  const featureText = features.length ? ' Features: ' + features.join(', ') + '.' : '';
  const title = VIEW_LABEL[view] + ' — ' + posLabel;
  const facingText = isOpenCorridor
    ? ' A through-route with no facing direction; no FRONT/REAR labels.'
    : ' The enemy is toward the front (top of the plan); FRONT and REAR are labeled.';
  const desc =
    posLabel +
    ', excavated ' +
    cutDepth +
    ' deep.' +
    facingText +
    featureText;

  return {
    role: 'img',
    titleId: 'sap1-' + view + '-title',
    descId: 'sap1-' + view + '-desc',
    title,
    desc,
  };
}

// Root <svg> attributes wiring role + labelledby, plus the <title>/<desc> element pair.
export function a11yAttrs(a: A11y): { attrs: Record<string, string>; defs: string } {
  return {
    attrs: { role: a.role, 'aria-labelledby': a.titleId + ' ' + a.descId },
    defs:
      '<title id="' + a.titleId + '">' + escapeText(a.title) + '</title>' +
      '<desc id="' + a.descId + '">' + escapeText(a.desc) + '</desc>',
  };
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
