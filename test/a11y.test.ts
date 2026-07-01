// §17 a11y — generated controls expose accessible names, and drawings carry text
// alternatives (role=img + title/desc + per-callout labels).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlsHtml } from '../src/layout/controls';
import { drawPlan } from '../src/render/drawPlan';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';

test('every generated control has an accessible name and a bound field', () => {
  const html = controlsHtml(defaultInputs());
  assert.ok(html.includes('aria-label="Position inputs"'), 'form is labelled');
  for (const f of ['positionType', 'standard', 'soil', 'revetment', 'overheadCover', 'sump', 'firingStep', 'camouflage', 'machineAssist', 'count', 'teamSize', 'unit', 'threat']) {
    assert.ok(html.includes('data-field="' + f + '"'), 'control bound for ' + f);
  }
  // Controls sit inside <label> elements with visible text (no bare inputs).
  assert.ok(html.includes('<label class="ctrl"'), 'labelled controls');
  assert.ok(html.includes('Threat class') && html.includes('Caliber'), 'two-level threat labelled');
});

test('drawings carry role=img, a title/desc pair, and labelled callouts', () => {
  const svg = drawPlan(compute(defaultInputs({ positionType: 'mg_crew' })));
  assert.ok(svg.includes('role="img"'), 'role=img');
  assert.ok(svg.includes('aria-labelledby='), 'aria-labelledby');
  assert.ok(svg.includes('<title'), 'title');
  assert.ok(svg.includes('<desc'), 'desc');
  assert.ok(svg.includes('class="callout" aria-label='), 'callouts expose their legend name');
});
