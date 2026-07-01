// Read-only output panels (§10, §12): specs, bill of materials, labor, validation, the sticky
// summary bar, and the tap-to-explain derivation trace. Any value backed by a Derivation is a
// button carrying data-trace=<key>; main.ts opens that derivation. Placeholder-derived figures
// are flagged (PH). Numbers formatted through the unit layer (feet-internal, display-converted).

import { fmtLength, fmtVolume } from '../doctrine/units';
import { positions } from '../doctrine/positions';
import type { Result, Derivation, ValidationIssue } from '../engine/types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function num(n: number): string {
  return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '—';
}

// A value cell: a button (opens the trace) when a derivation key is given, else plain text.
function val(text: string, traceKey?: string, ph = false): string {
  const cls = 'val' + (ph ? ' ph' : '');
  return traceKey
    ? '<button class="' + cls + '" type="button" data-trace="' + esc(traceKey) + '">' + esc(text) + (ph ? ' (PH)' : '') + '</button>'
    : '<span class="' + cls + '">' + esc(text) + (ph ? ' (PH)' : '') + '</span>';
}

function specRow(label: string, value: string): string {
  return '<div class="row"><span class="k">' + esc(label) + '</span>' + value + '</div>';
}

export function specsPanel(result: Result): string {
  const u = result.inputs.unit;
  const r = result.resolved;
  const posLabel = positions[result.inputs.positionType]?.label ?? result.inputs.positionType;
  const cover =
    result.cover.roofPath === 'earth_on_stringers'
      ? specRow('Overhead cover', val(fmtLength(result.cover.thickness, u) + ' ' + result.cover.material, 'coverThickness', true))
      : result.cover.roofPath === 'engineered_required'
        ? specRow('Overhead roof', '<span class="val engineered">Engineered — see engineer</span>')
        : '';

  return (
    '<section class="panel"><h2>' + esc(posLabel) + '</h2>' +
    specRow('Depth of cut', val(fmtLength(r.holeD, u), 'depthOfCut')) +
    specRow('Frontage', val(fmtLength(r.holeL, u))) +
    specRow('Front-to-back', val(fmtLength(r.holeW, u))) +
    specRow('Overall (L×W)', val(fmtLength(r.outerL, u) + ' × ' + fmtLength(r.outerW, u))) +
    specRow('Parapet', val(fmtLength(r.parapetW, u) + ' thick, ' + fmtLength(r.parapetH, u) + ' high')) +
    specRow('Roof setback', val(fmtLength(r.setback, u), 'setback')) +
    cover +
    '</section>'
  );
}

// BOM lines whose quantity is explained by a derivation get a trace link.
const BOM_TRACE: Record<string, string> = {
  excavation_loose: 'excavLoose',
  sandbags_parapet: 'sandbagsParapet',
  stringers: 'stringers',
};

export function bomPanel(result: Result): string {
  if (result.bom.length === 0) return '';
  const rows = result.bom
    .map(
      (l) =>
        '<tr><td>' + esc(l.label) + '</td><td class="n">' +
        val(num(l.qtyPerPosition), BOM_TRACE[l.id], l.fromPlaceholder) +
        '</td><td class="n">' + num(l.qtyTotal) + '</td><td>' + esc(l.unit) + '</td></tr>',
    )
    .join('');
  return (
    '<section class="panel"><h2>Bill of materials</h2><table class="bom">' +
    '<thead><tr><th>Item</th><th>Per position</th><th>Total</th><th>Unit</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></section>'
  );
}

export function laborPanel(result: Result): string {
  const lab = result.labor;
  const assumptions = lab.assumptions.length
    ? '<ul class="assumptions">' + lab.assumptions.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul>'
    : '';
  return (
    '<section class="panel"><h2>Labor</h2>' +
    specRow('Man-hours / position', val(num(lab.manHoursPerPosition), 'manHoursPerPosition')) +
    specRow('Man-hours total', val(num(lab.manHoursTotal), 'manHoursTotal')) +
    specRow('Elapsed (team of ' + result.inputs.teamSize + ')', val(num(lab.elapsedHours) + ' hr', 'elapsed')) +
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
  return '<section class="panel validation"><h2>Checks</h2><ul>' + items + '</ul></section>';
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
        (o.placeholder ? '<span class="op-ph" title="' + esc(o.source ?? 'placeholder') + '">placeholder</span>' : '') +
        '</li>',
    )
    .join('');
  return (
    '<div class="trace"><h3>' + esc(d.label) + '</h3>' +
    '<code class="formula">' + esc(d.formula) + '</code>' +
    '<div class="trace-result">= ' + num(d.result) + ' ' + esc(d.unit) + '</div>' +
    '<ul class="operands">' + operands + '</ul>' +
    '<p class="trace-note">Every placeholder figure is illustrative — confirm against current pubs.</p></div>'
  );
}
