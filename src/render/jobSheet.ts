// Printable job sheet (§10). A self-contained HTML document: repeating masthead (SAP-1,
// scenario, date, APP_VERSION), the honest NOT FOR FIELD USE stamp, inputs summary, the
// annotated plan + section (same numbered-callout system), specs, BOM, labor, and a
// Prepared by / Verified by / Date block. Page-break-safe via @media print rules. Pure —
// the date is passed in (the engine reads no clock).

import { esc } from './svg';
import { drawPlan } from './drawPlan';
import { drawSection } from './drawSection';
import { DAY_TOKENS_CSS } from './print-tokens';
import { APP_VERSION } from '../version';
import { positions } from '../doctrine/positions';
import { fmtLength } from '../doctrine/units';
import type { Result } from '../engine/types';

export interface JobSheetMeta {
  scenario: string;
  date: string;
}

const PRINT_CSS =
  DAY_TOKENS_CSS +
  'body{margin:0;background:#fff;color:var(--ink);font-family:system-ui,sans-serif;font-size:12px}' +
  '.sheet{max-width:8.2in;margin:0 auto;padding:0.5in}' +
  '.mast{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid var(--ink);padding-bottom:6px}' +
  '.mast h1{font-size:18px;margin:0;letter-spacing:1px}' +
  '.mast .meta{font-size:11px;color:var(--ink-soft);text-align:right}' +
  '.stamp{margin:10px 0;padding:6px 10px;background:var(--banner-bg);color:var(--banner-text);font-weight:700;letter-spacing:0.5px;border-radius:4px;text-align:center}' +
  '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
  '.drawings{display:grid;grid-template-columns:1fr;gap:10px}' +
  '.drawings svg{width:100%;height:auto;border:1px solid var(--border);border-radius:8px}' +
  'h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid var(--border);padding-bottom:3px}' +
  'table{width:100%;border-collapse:collapse;font-size:11px}' +
  'th,td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)}' +
  'th{color:var(--ink-soft);font-weight:600}' +
  'td.n{text-align:right;font-family:ui-monospace,monospace}' +
  '.ph{color:var(--dim-text);font-weight:600}' +
  '.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px}' +
  '.sign .line{border-top:1px solid var(--ink);padding-top:4px;font-size:10px;color:var(--ink-soft)}' +
  '@media print{.sheet{padding:0}section,table,.drawings svg{break-inside:avoid}@page{margin:0.5in}}';

function specRow(label: string, value: string, ph = false): string {
  return '<tr><td>' + esc(label) + '</td><td class="n' + (ph ? ' ph' : '') + '">' + esc(value) + (ph ? ' (PH)' : '') + '</td></tr>';
}

export function jobSheet(result: Result, meta: JobSheetMeta): string {
  const unit = result.inputs.unit;
  const posLabel = positions[result.inputs.positionType]?.label ?? result.inputs.positionType;
  const notForField = result.placeholderReport.remaining > 0;
  const r = result.resolved;

  const stamp = notForField ? '<div class="stamp">NOT FOR FIELD USE — illustrative placeholder data. Confirm every value against current pubs.</div>' : '';

  const inputRows =
    specRow('Position', posLabel) +
    specRow('Standard', result.inputs.standard) +
    specRow('Soil', result.inputs.soil) +
    specRow('Threat', result.inputs.threat) +
    specRow('Count', String(result.inputs.count)) +
    specRow('Team size', String(result.inputs.teamSize));

  const specRows =
    specRow('Depth of cut', fmtLength(r.depthOfCut, unit)) +
    specRow('Frontage', fmtLength(r.holeL, unit)) +
    specRow('Front-to-back', fmtLength(r.holeW, unit)) +
    specRow('Overall (L×W)', fmtLength(r.outerL, unit) + ' × ' + fmtLength(r.outerW, unit)) +
    specRow('Parapet', fmtLength(r.parapetW, unit) + ' thick, ' + fmtLength(r.parapetH, unit) + ' high') +
    specRow('Roof setback', fmtLength(r.setback, unit)) +
    (result.cover.roofPath === 'earth_on_stringers'
      ? specRow('Overhead cover', fmtLength(result.cover.thickness, unit) + ' ' + result.cover.material, true)
      : result.cover.roofPath === 'engineered_required'
        ? '<tr><td>Overhead roof</td><td class="n ph">ENGINEERED — see engineer</td></tr>'
        : specRow('Overhead cover', 'none')) +
    '<tr><td>Volume model</td><td class="n">' + esc(result.fidelity.volume) + '</td></tr>';

  const bomRows = result.bom
    .map(
      (l) =>
        '<tr><td>' + esc(l.label) + (l.fromPlaceholder ? ' <span class="ph">(PH)</span>' : '') + '</td>' +
        '<td class="n">' + num(l.qtyPerPosition) + '</td>' +
        '<td class="n">' + num(l.qtyTotal) + '</td><td>' + esc(l.unit) + '</td></tr>',
    )
    .join('');

  const lab = result.labor;
  const laborRows =
    '<tr><td>Man-hours / position</td><td class="n">' + num(lab.manHoursPerPosition) + '</td></tr>' +
    '<tr><td>Man-hours total (' + result.inputs.count + ' positions)</td><td class="n">' + num(lab.manHoursTotal) + '</td></tr>' +
    '<tr><td>Elapsed (team of ' + result.inputs.teamSize + ')</td><td class="n">' + num(lab.elapsedHours) + ' hr</td></tr>';

  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>SAP-1 Job Sheet — ' + esc(meta.scenario) + '</title>' +
    '<style>' + PRINT_CSS + '</style></head><body><div class="sheet">' +
    '<div class="mast"><h1>SAP-1 — Survivability Position Planner</h1>' +
    '<div class="meta">' + esc(meta.scenario) + '<br>' + esc(meta.date) + ' · ' + esc(APP_VERSION) + '</div></div>' +
    stamp +
    '<section><div class="grid"><div><h2>Inputs</h2><table>' + inputRows + '</table></div>' +
    '<div><h2>Specifications</h2><table>' + specRows + '</table></div></div></section>' +
    '<section><h2>Drawings</h2><div class="drawings">' + drawPlan(result) + drawSection(result) + '</div></section>' +
    '<section><h2>Bill of materials</h2><table><thead><tr><th>Item</th><th>Per position</th><th>Total</th><th>Unit</th></tr></thead><tbody>' +
    bomRows + '</tbody></table></section>' +
    '<section><h2>Labor</h2><table>' + laborRows + '</table></section>' +
    '<section class="sign"><div class="line">Prepared by / date</div><div class="line">Verified by / date</div><div class="line">Position / grid</div></section>' +
    '</div></body></html>'
  );
}

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 100) / 100).toString();
}
