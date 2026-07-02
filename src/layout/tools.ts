// Feature overlays (§15): scenarios, Mission BOM (+shortfall), comparison, and time-available
// (inverse) planning. Pure render functions — main.ts owns the state (scenario store, the
// comparison/mission sets, the on-hand map) and wires the data-action buttons.

import { fmtLength } from '../doctrine/units';
import { positions } from '../doctrine/positions';
import { threats } from '../doctrine/protection';
import type { Result, MissionBomLine } from '../engine/types';
import type { MissionResult } from '../engine/mission';
import type { PlanResult } from '../engine/plan';
import type { Scenario } from '../state/schema';

// Attribute-safe escaping: scenario names/ids are UNTRUSTED (they arrive via file import,
// §14) and are interpolated into double-quoted attributes — quotes MUST be escaped or an
// imported name like `x" onmouseover="..."` becomes a live event handler (XSS).
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function num(n: number): string {
  return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '—';
}
function threatLabel(id: string): string {
  return id === 'none' ? 'None' : threats[id]?.label ?? id;
}

// ── Scenarios ────────────────────────────────────────────────────────────────
export function scenariosOverlay(scenarios: Scenario[], activeId: string | null): string {
  const rows = scenarios.length
    ? scenarios
        .map(
          (s) =>
            '<li class="scn' + (s.id === activeId ? ' active' : '') + '">' +
            '<span class="scn-name">' + esc(s.name) + '</span>' +
            '<span class="scn-actions">' +
            '<button type="button" class="btn" data-action="scenario-load" data-id="' + esc(s.id) + '">Load</button>' +
            '<button type="button" class="btn" data-action="scenario-duplicate" data-id="' + esc(s.id) + '">Duplicate</button>' +
            '<button type="button" class="btn" data-action="scenario-delete" data-id="' + esc(s.id) + '" data-name="' + esc(s.name) + '">Delete</button>' +
            '</span></li>',
        )
        .join('')
    : '<li class="empty">No saved scenarios yet.</li>';
  return (
    '<div class="tools"><h2>Saved setups (Scenarios)</h2>' +
    '<div class="tool-actions">' +
    '<button type="button" class="btn" data-action="scenario-save">Save current…</button>' +
    '<button type="button" class="btn" data-action="scenario-import">Import JSON</button>' +
    '<button type="button" class="btn" data-action="scenario-export">Export all</button></div>' +
    '<ul class="scn-list">' + rows + '</ul>' +
    '<p class="tool-note">Scenarios are stored on this device only.</p></div>'
  );
}

// ── Mission BOM (+ on-hand → shortfall) ──────────────────────────────────────
export function missionOverlay(result: MissionResult, count: number): string {
  const addClear =
    '<div class="tool-actions"><button type="button" class="btn" data-action="mission-add">Add current position</button>' +
    (count > 0 ? '<button type="button" class="btn" data-action="mission-clear">Clear</button>' : '') + '</div>';
  if (count === 0) {
    return '<div class="tools"><h2>Group job list (Mission BOM)</h2><p class="empty">Add positions to roll up one bill of materials, then enter on-hand quantities to see shortfalls.</p>' + addClear + '</div>';
  }
  const row = (l: MissionBomLine): string =>
    '<tr><td>' + esc(l.label) + (l.fromPlaceholder ? ' <span class="ph">(PH)</span>' : '') + '</td>' +
    '<td class="n">' + num(l.qtyTotal) + ' ' + esc(l.unit) + '</td>' +
    '<td><input type="number" min="0" step="1" class="onhand" data-onhand="' + esc(l.id) + '" value="' + (l.onHand ?? 0) + '" aria-label="On hand ' + esc(l.label) + '"></td>' +
    '<td class="n' + ((l.shortfall ?? 0) > 0 ? ' short' : '') + '">' + num(l.shortfall ?? 0) + '</td></tr>';
  return (
    '<div class="tools"><h2>Group job list — ' + result.totalPositions + ' position(s)</h2>' + addClear +
    '<table class="mission"><thead><tr><th>Item</th><th>Need</th><th>On hand</th><th>Short</th></tr></thead><tbody>' +
    result.lines.map(row).join('') + '</tbody></table>' +
    '<div class="mission-tot">Total man-hours <strong>' + num(result.totalManHours) + '</strong> · Elapsed (team ' + result.teamSize + ') <strong>' + num(result.elapsedHours) + ' hr</strong></div></div>'
  );
}

// ── Comparison (2–3 configs) ─────────────────────────────────────────────────
export function compareOverlay(results: Result[]): string {
  if (results.length === 0) {
    return '<div class="tools"><h2>Compare setups</h2><p class="empty">Add 2–3 configurations to compare them side by side.</p><div class="tool-actions"><button type="button" class="btn" data-action="compare-add">Add current</button></div></div>';
  }
  const u = results[0]!.inputs.unit;
  const bags = (r: Result): number => r.bom.filter((l) => l.id.startsWith('sandbags')).reduce((s, l) => s + l.qtyTotal, 0);
  const cover = (r: Result): string =>
    r.cover.roofPath === 'earth_on_stringers' ? fmtLength(r.cover.thickness, u) : r.cover.roofPath === 'engineered_required' ? 'engineered' : 'none';
  const head = '<tr><th>Metric</th>' + results.map((_, i) => '<th>#' + (i + 1) + ' <button type="button" class="btn tiny" data-action="compare-remove" data-idx="' + i + '">✕</button></th>').join('') + '</tr>';
  const line = (label: string, cell: (r: Result) => string): string =>
    '<tr><td>' + esc(label) + '</td>' + results.map((r) => '<td class="n">' + esc(cell(r)) + '</td>').join('') + '</tr>';
  return (
    '<div class="tools"><h2>Compare setups</h2>' +
    '<div class="tool-actions"><button type="button" class="btn" data-action="compare-add"' + (results.length >= 3 ? ' disabled' : '') + '>Add current</button><button type="button" class="btn" data-action="compare-clear">Clear</button></div>' +
    '<table class="compare"><thead>' + head + '</thead><tbody>' +
    line('Position', (r) => positions[r.inputs.positionType]?.label ?? r.inputs.positionType) +
    line('Standard', (r) => r.inputs.standard) +
    line('Threat', (r) => threatLabel(r.inputs.threat)) +
    line('Depth', (r) => fmtLength(r.resolved.depthOfCut, u)) +
    line('Overhead cover', cover) +
    line('Setback', (r) => fmtLength(r.resolved.setback, u)) +
    line('Sandbags (total)', (r) => num(bags(r))) +
    line('Man-hours total', (r) => num(r.labor.manHoursTotal)) +
    line('Elapsed', (r) => num(r.labor.elapsedHours) + ' hr') +
    '</tbody></table></div>'
  );
}

// ── Time-available (inverse) planning ────────────────────────────────────────
export function planOverlay(plan: PlanResult | null, hours: number, team: number): string {
  const form =
    '<div class="tool-actions plan-form">' +
    '<label class="ctrl mini">Hours available<input type="number" id="plan-hours" min="1" step="1" value="' + hours + '"></label>' +
    '<label class="ctrl mini">Team size<input type="number" id="plan-team" min="1" step="1" value="' + team + '"></label>' +
    '<button type="button" class="btn" data-action="plan-run">Find achievable standard</button></div>';
  if (!plan) {
    return '<div class="tools"><h2>Time planner</h2><p class="empty">Given hours and team size, what standard can you actually build for the current position + threat?</p>' + form + '</div>';
  }
  const rows = plan.feasible.length
    ? plan.feasible
        .map(
          (o, i) =>
            '<tr><td>' + esc(o.standard) + '</td><td>' + (o.overheadCover ? (o.roofPath === 'engineered_required' ? 'engineered' : 'cover') : '—') + '</td>' +
            '<td>' + esc(o.revetment) + '</td><td class="n">' + num(o.elapsedHours) + ' hr</td>' +
            '<td><button type="button" class="btn" data-action="plan-apply" data-idx="' + i + '">Use</button></td></tr>',
        )
        .join('')
    : '<tr><td colspan="5">Nothing fits ' + num(plan.budgetHours) + ' hr with a team of ' + plan.teamSize + '. Closest over-budget: ' +
      (plan.infeasibleBest ? esc(plan.infeasibleBest.standard) + ' at ' + num(plan.infeasibleBest.elapsedHours) + ' hr' : '—') + '.</td></tr>';
  return (
    '<div class="tools"><h2>Time planner</h2>' + form +
    '<table class="plan"><thead><tr><th>Standard</th><th>Roof</th><th>Revet</th><th>Elapsed</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="tool-note">Ranked by protection, then buildability — highest protection that fits the budget first.</p></div>'
  );
}
