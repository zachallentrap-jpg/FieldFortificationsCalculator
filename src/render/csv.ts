// CSV export (§10) — RFC-4180: fields quoted only when needed, embedded quotes doubled,
// CRLF line endings, '.' decimal, NO thousands separators regardless of display locale.
// A metadata header carries scenario/date/NOT-FOR-FIELD-USE; a `Placeholder` column flags
// every quantity derived from a placeholder doctrine value. Per-position AND total columns.
// Pure — the date is passed in (the engine never reads a clock).

import type { Result } from '../engine/types';

function field(v: string | number): string {
  const s = typeof v === 'number' ? num(v) : v;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function num(n: number): string {
  if (!Number.isFinite(n)) return '';
  // Up to 3 dp, trailing zeros trimmed, always '.' decimal, no grouping.
  return (Math.round(n * 1000) / 1000).toString();
}

function row(...cells: (string | number)[]): string {
  return cells.map(field).join(',');
}

export interface CsvMeta {
  scenario: string;
  date: string; // caller-supplied (pure engine reads no clock)
}

export function toCsv(result: Result, meta: CsvMeta): string {
  const lines: string[] = [];
  const notForField = result.placeholderReport.remaining > 0;

  lines.push(row('SAP-1 Survivability Position Planner'));
  lines.push(row('Scenario', meta.scenario));
  lines.push(row('Date', meta.date));
  lines.push(row('Position', result.inputs.positionType));
  lines.push(row('Standard', result.inputs.standard));
  lines.push(row('Soil', result.inputs.soil));
  lines.push(row('Threat', result.inputs.threat));
  lines.push(row('Count', result.inputs.count));
  if (notForField) lines.push(row('NOTICE', 'NOT FOR FIELD USE — illustrative placeholder data'));
  lines.push('');

  lines.push(row('Section', 'Item', 'Unit', 'Per position', 'Total', 'Placeholder'));
  for (const l of result.bom) {
    lines.push(row('BOM', l.label, l.unit, l.qtyPerPosition, l.qtyTotal, l.fromPlaceholder ? 'yes' : 'no'));
  }
  lines.push('');

  const lab = result.labor;
  lines.push(row('Labor', 'Man-hours per position', 'mh', lab.manHoursPerPosition, lab.manHoursTotal, ''));
  lines.push(row('Labor', 'Elapsed (team of ' + result.inputs.teamSize + ')', 'hr', '', lab.elapsedHours, ''));
  for (const a of lab.assumptions) lines.push(row('Assumption', a));

  return lines.join('\r\n') + '\r\n';
}
