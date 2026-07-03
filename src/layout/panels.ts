// Read-only output panels (§10, §12): specs, bill of materials, labor, validation, the sticky
// summary bar, and the tap-to-explain derivation trace. Any value backed by a Derivation is a
// button carrying data-trace=<key>; main.ts opens that derivation. Numbers formatted through
// the unit layer (feet-internal, display-converted).

import { fmtLength, fmtVolume } from '../doctrine/units';
import { positions } from '../doctrine/positions';
import type { GeometryModel } from '../engine/geometry';
import type { Result, Derivation, ValidationIssue } from '../engine/types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function num(n: number): string {
  return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '—';
}

// A value cell: a button (opens the trace) when a derivation key is given, else plain text.
function val(text: string, traceKey?: string): string {
  return traceKey
    ? '<button class="val" type="button" data-trace="' + esc(traceKey) + '">' + esc(text) + '</button>'
    : '<span class="val">' + esc(text) + '</span>';
}

function specRow(label: string, value: string): string {
  return '<div class="row"><span class="k">' + esc(label) + '</span>' + value + '</div>';
}

// Spec rows that have a tap-to-explain derivation, keyed by the geometry dim key.
const DIM_TRACE: Record<string, string> = {
  depth: 'depthOfCut',
  setback: 'setback',
  cover_t: 'coverThickness',
};

export function specsPanel(result: Result): string {
  const u = result.inputs.unit;
  // Single source of truth: the same dims the plan/section drawings annotate. The panel can
  // never disagree with the drawing or the trace again (the old panel showed raw holeD while
  // section + trace showed depthOfCut).
  const geo = result.geometry as GeometryModel;
  const posLabel = positions[result.inputs.positionType]?.label ?? result.inputs.positionType;
  const rows = geo.dims
    .map((dim) => {
      const text =
        dim.key === 'cover_t'
          ? fmtLength(dim.valueFt, u) + ' ' + result.cover.material
          : fmtLength(dim.valueFt, u);
      return specRow(dim.label, val(text, DIM_TRACE[dim.key]));
    })
    .join('');
  const engineered =
    result.cover.roofPath === 'engineered_required'
      ? specRow('Overhead roof', '<span class="val engineered">Engineered — see engineer</span>')
      : '';

  // Fallout attenuation the earth roof provides (Phase 6) — traceable, from the radiation
  // halving-thickness doctrine leaf.
  const radDeriv = result.derivations.find((d) => d.key === 'radiationLayers');
  const radiation = radDeriv
    ? specRow('Fallout shielding', val((Math.round(radDeriv.result * 10) / 10) + '× halved', 'radiationLayers'))
    : '';

  // Model-fidelity statement — formulas get the same honesty as constants: this says which
  // volume model produced the dimensions, so "approximate" is never mistaken for doctrinal.
  const fidelity =
    '<p class="fidelity-note">Volume model: ' + esc(result.fidelity.volume) + '. Labor model: ' + esc(result.fidelity.labor) + '.</p>';

  return '<section class="panel"><h2>' + esc(posLabel) + '</h2>' + rows + engineered + radiation + fidelity + '</section>';
}

// BOM lines whose quantity is explained by a derivation get a trace link. Every BOM line that
// carries a magnitude now has one (Phase 1: no tappable number dead-ends).
const BOM_TRACE: Record<string, string> = {
  excavation_loose: 'excavLoose',
  sandbags_parapet: 'sandbagsParapet',
  berm_fill: 'bermFill',
  sandbags_cover: 'sandbagsCover',
  cover_soil_fill: 'coverSoilFill',
  sandbags_revet: 'sandbagsRevet',
  revet_panels: 'revetPanels',
  pickets: 'pickets',
  revet_wire: 'revetWire',
  stringers: 'stringers',
  gravel_sump: 'gravelSump',
  camo_net: 'camoNet',
};

export function bomPanel(result: Result): string {
  if (result.bom.length === 0) return '';
  const rows = result.bom
    .map(
      (l) =>
        '<tr><td>' + esc(l.label) + '</td><td class="n">' +
        val(num(l.qtyPerPosition), BOM_TRACE[l.id]) +
        '</td><td class="n">' + num(l.qtyTotal) + '</td><td>' + esc(l.unit) + '</td></tr>',
    )
    .join('');
  return (
    '<section class="panel"><h2>Materials list (Bill of Materials)</h2><table class="bom">' +
    '<thead><tr><th>Item</th><th>Per position</th><th>Total</th><th>Unit</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></section>'
  );
}

export function laborPanel(result: Result): string {
  const lab = result.labor;
  const assumptions = lab.assumptions.length
    ? '<ul class="assumptions">' + lab.assumptions.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul>'
    : '';
  const machine =
    lab.machineHoursPerPosition !== undefined
      ? specRow('Machine (blade) hours / position', val(num(lab.machineHoursPerPosition) + ' hr', 'machineHours')) +
        specRow('Machine hours total', val(num(lab.machineHoursTotal ?? 0) + ' hr'))
      : '';
  return (
    '<section class="panel"><h2>Time & people needed (Labor)</h2>' +
    specRow('Man-hours / position', val(num(lab.manHoursPerPosition), 'manHoursPerPosition')) +
    specRow('Man-hours total', val(num(lab.manHoursTotal), 'manHoursTotal')) +
    specRow('Elapsed (team of ' + result.inputs.teamSize + ')', val(num(lab.elapsedHours) + ' hr', 'elapsed')) +
    machine +
    assumptions +
    '</section>'
  );
}

const SEV_LABEL: Record<ValidationIssue['severity'], string> = { error: 'Error', warning: 'Warning', advisory: 'Note' };

export function validationPanel(result: Result): string {
  if (result.validation.length === 0) return '';
  const items = result.validation
    .map((v) => '<li class="issue ' + v.severity + '"><span class="sev">' + SEV_LABEL[v.severity] + '</span>' + esc(v.message) + '</li>')
    .join('');
  return '<section class="panel validation"><h2>Things to double-check</h2><ul>' + items + '</ul></section>';
}

// Sticky summary (mobile) — the four numbers worth a glance.
export function summaryBar(result: Result): string {
  const bags = result.bom.filter((l) => l.id.startsWith('sandbags')).reduce((s, l) => s + l.qtyTotal, 0);
  const spoil = result.bom.find((l) => l.id === 'excavation_loose')?.qtyTotal ?? 0;
  const u = result.inputs.unit;
  const cell = (k: string, v: string): string => '<div class="s-cell"><span class="s-k">' + esc(k) + '</span><span class="s-v">' + esc(v) + '</span></div>';
  return (
    '<div class="summary-bar">' +
    cell('Sandbags', bags > 0 ? num(bags) : '—') +
    cell('Spoil', fmtVolume(spoil, u)) +
    cell('Man-hrs', num(result.labor.manHoursTotal)) +
    cell('Elapsed', num(result.labor.elapsedHours) + ' hr') +
    '</div>'
  );
}

// The tap-to-explain body for one derivation.
export function traceHtml(d: Derivation): string {
  const operands = d.operands
    .map(
      (o) =>
        '<li><span class="op-name">' + esc(o.name) + '</span>' +
        '<span class="op-val">' + num(o.value) + (o.unit ? ' ' + esc(o.unit) : '') + '</span>' +
        '</li>',
    )
    .join('');
  return (
    '<div class="trace"><h3>' + esc(d.label) + '</h3>' +
    '<code class="formula">' + esc(d.formula) + '</code>' +
    '<div class="trace-result">= ' + num(d.result) + ' ' + esc(d.unit) + '</div>' +
    '<ul class="operands">' + operands + '</ul></div>'
  );
}
