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
import { positions } from '../src/doctrine/positions';
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

test('engineered roof is drawn honestly (hazard block, no fabricated earth cover)', () => {
  const section = drawSection(compute(defaultInputs({ positionType: 'bunker_op_cp', threat: 'at-he-contact' })));
  assert.ok(section.includes('ENGINEERED ROOF — SEE ENGINEER'), 'engineered hazard label');
  assert.ok(section.includes('url(#pat-engineered)'), 'engineered hazard pattern');
  assert.ok(!section.includes('url(#pat-cover)'), 'no earth-cover slab for an engineered roof');
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

test('iso schematic carries its header and a consistent legend', () => {
  const iso = drawIso(compute(defaultInputs({ positionType: 'mg_crew' })));
  assert.ok(iso.includes('ISOMETRIC'), 'header bar title');
  assert.ok(iso.includes('>ENEMY<'), 'orientation preserved');
  assertCalloutLegendConsistent(iso, 'iso');
  assertMinFont(iso, 'iso');
});
