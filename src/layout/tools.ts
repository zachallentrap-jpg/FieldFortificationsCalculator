// Feature overlays (§15): scenarios, Mission BOM (+shortfall), comparison, and time-available
// (inverse) planning. Pure render functions — main.ts owns the state (scenario store, the
// comparison/mission sets, the on-hand map) and wires the data-action buttons.

import { fmtLength } from '../doctrine/units';
import { revetments } from '../doctrine/materials';
import { standards } from '../doctrine/standards';
import { positions } from '../doctrine/positions';
import { threats } from '../doctrine/protection';
import type { Result, MissionBomLine } from '../engine/types';
import type { MissionResult } from '../engine/mission';
import type { PlanResult } from '../engine/plan';
import type { Schedule } from '../engine/stages';
import type { Scenario } from '../state/schema';
import type { RegEntry, Counts } from '../doctrine/registry';
import type { DoctrineImportReport, DoctrineManifest } from '../doctrine/io';

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
    '<tr><td>' + esc(l.label) + '</td>' +
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
    return '<div class="tools"><h2>Compare setups</h2><p class="empty">Add 2–3 configurations to compare them side by side.</p><div class="tool-actions"><button type="button" class="btn" data-action="compare-add">Add current</button><button type="button" class="btn" data-action="compare-standards">Hasty vs deliberate vs reinforced</button></div></div>';
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
    '<div class="tool-actions"><button type="button" class="btn" data-action="compare-add"' + (results.length >= 3 ? ' disabled' : '') + '>Add current</button><button type="button" class="btn" data-action="compare-standards">Hasty vs deliberate vs reinforced</button><button type="button" class="btn" data-action="compare-clear">Clear</button></div>' +
    '<table class="compare"><thead>' + head + '</thead><tbody>' +
    line('Position', (r) => positions[r.inputs.positionType]?.label ?? r.inputs.positionType) +
    line('Standard', (r) => standards[r.inputs.standard]?.label ?? r.inputs.standard) +
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

// ── Priorities of work / "ready by stand-to" (Phase 4) ───────────────────────
export function scheduleOverlay(sched: Schedule | null, team: number, hours: number, posture: number): string {
  const form =
    '<div class="tool-actions plan-form">' +
    '<label class="ctrl mini">Team size<input type="number" id="sch-team" min="1" step="1" value="' + team + '"></label>' +
    '<label class="ctrl mini">Hours to stand-to<input type="number" id="sch-hours" min="1" step="1" value="' + hours + '"></label>' +
    '<label class="ctrl mini">% on the tools<input type="number" id="sch-posture" min="10" max="100" step="10" value="' + Math.round(posture * 100) + '"></label>' +
    '<button type="button" class="btn" data-action="schedule-run">Build the timeline</button></div>';
  if (!sched) {
    return '<div class="tools"><h2>Priorities of work (ready by stand-to)</h2><p class="empty">Who does what now, and are we ready by stand-to? Enter your team, the hours until stand-to, and how much of the team stays on the tools (the rest pull security).</p>' + form + '</div>';
  }
  const status = sched.feasible
    ? '<div class="import-report ok"><strong>Ready with ' + num(sched.availableHours - sched.totalElapsedHours) + ' hr to spare.</strong> ' + num(sched.totalElapsedHours) + ' hr with ' + num(sched.effectiveDiggers) + ' effective diggers.</div>'
    : '<div class="import-report bad"><strong>NOT ready by stand-to — short ' + num(sched.shortfallHours) + ' hr.</strong> Cut the standard, add hands, or accept a hasty position.</div>';
  const rows = sched.steps
    .map((s) => '<tr><td>' + esc(s.label) + '</td><td class="n">' + num(s.manHours) + '</td><td class="n">H+' + num(s.cumulativeHours) + '</td></tr>')
    .join('');
  return (
    '<div class="tools"><h2>Priorities of work (ready by stand-to)</h2>' + form + status +
    '<table class="plan"><thead><tr><th>Stage (in order)</th><th class="n">Man-hrs</th><th class="n">Done by</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="tool-note">Stages run in doctrinal order; man-hours partition the position total exactly. Times assume the whole team works each stage together.</p></div>'
  );
}

// ── Doctrine fill (the placeholder burn-down) ────────────────────────────────
// The battalion cell fills real values here — offline — until the NOT-FOR-FIELD-USE banner
// clears. Spartan and paranoid by design: export → edit with pubs open → import (validated
// all-or-nothing), OR edit inline and Apply (same validated path). Read-only burn-down counts
// per doctrine table so progress is visible.
function fillGroup(path: string): string {
  return path.split(/[.[]/)[0] ?? path;
}

export function doctrineOverlay(
  entries: RegEntry[],
  c: Counts,
  fill: DoctrineManifest | null,
  scOnly: boolean,
  report: DoctrineImportReport | null,
): string {
  const shown = scOnly ? entries.filter((e) => e.safetyCritical) : entries;

  // Per-table remaining counts (from the FULL set, not the filtered view).
  const groups = new Map<string, { total: number; remaining: number }>();
  for (const e of entries) {
    const g = groups.get(fillGroup(e.path)) ?? { total: 0, remaining: 0 };
    g.total++;
    if (e.status !== 'DOCTRINE') g.remaining++;
    groups.set(fillGroup(e.path), g);
  }
  const groupRows = [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([g, v]) => '<tr><td>' + esc(g) + '</td><td class="n">' + v.remaining + '</td><td class="n">' + v.total + '</td></tr>')
    .join('');

  const fillLine = fill
    ? '<p class="tool-note">Applied doctrine fill <code>' + esc(fill.contentHash) + '</code>' +
      (fill.author ? ' by ' + esc(fill.author) : '') + (fill.date ? ' on ' + esc(fill.date) : '') + '.</p>'
    : '<p class="tool-note">No doctrine fill applied — every value is an illustrative placeholder.</p>';

  const reportBlock = report
    ? '<div class="import-report ' + (report.ok ? 'ok' : 'bad') + '">' +
      '<strong>' + (report.ok ? (report.dryRun ? 'Preview: ' : 'Applied: ') + report.applied + ' value(s)' : 'Import rejected') + '</strong>' +
      (report.message ? '<div>' + esc(report.message) + '</div>' : '') +
      (report.rejected.length
        ? '<ul>' + report.rejected.slice(0, 12).map((r) => '<li>' + esc(r.path) + ' — ' + esc(r.reason) + '</li>').join('') +
          (report.rejected.length > 12 ? '<li>…and ' + (report.rejected.length - 12) + ' more</li>' : '') + '</ul>'
        : '') +
      (report.dryRun && report.ok ? '<button type="button" class="btn" data-action="doctrine-import-apply">Apply this import</button>' : '') +
      '</div>'
    : '';

  const rowFor = (e: RegEntry): string => {
    const isNum = typeof e.value === 'number';
    const isBool = typeof e.value === 'boolean';
    const valInput = isBool
      ? '<select data-fillpath="' + esc(e.path) + '" data-filltype="boolean"><option value="true"' + (e.value ? ' selected' : '') + '>true</option><option value="false"' + (!e.value ? ' selected' : '') + '>false</option></select>'
      : '<input type="' + (isNum ? 'number' : 'text') + '" step="any" data-fillpath="' + esc(e.path) + '" data-filltype="' + (isNum ? 'number' : 'string') + '" value="' + esc(String(e.value)) + '">';
    return (
      '<tr class="' + (e.status === 'DOCTRINE' ? 'filled' : '') + '">' +
      '<td class="fill-path">' + esc(e.path) + (e.safetyCritical ? ' <span class="sc">SC</span>' : '') + (e.unit ? ' <span class="u">' + esc(e.unit) + '</span>' : '') + '</td>' +
      '<td>' + valInput + '</td>' +
      '<td><input type="text" class="fill-src" data-fillsrc="' + esc(e.path) + '" value="' + esc(e.source) + '" placeholder="source / pub reference"></td>' +
      '<td class="n"><label class="fill-verified"><input type="checkbox" data-fillverify="' + esc(e.path) + '"' + (e.status === 'DOCTRINE' ? ' checked' : '') + '> verified</label></td>' +
      '</tr>'
    );
  };

  const badge =
    c.placeholder > 0
      ? '<span class="fielduse-badge" role="status">' + c.placeholder + ' practice value(s) remain (' + c.safetyCriticalRemaining + ' safety-critical)</span>'
      : '<span class="cleared-badge" role="status">All values filled — banner cleared.</span>';

  return (
    '<div class="tools doctrine"><h2>Doctrine values (fill the placeholders)</h2>' +
    badge + fillLine +
    '<p class="tool-note">Fill values <strong>offline</strong> against current pubs. Export the file, edit it off-device, and import it back — or edit inline below and Apply. Imports are validated all-or-nothing: one bad value rejects the whole file, nothing half-applies.</p>' +
    '<div class="tool-actions">' +
    '<button type="button" class="btn" data-action="doctrine-export">Export doctrine file</button>' +
    '<button type="button" class="btn" data-action="doctrine-import">Import doctrine file…</button>' +
    '<button type="button" class="btn" data-action="doctrine-apply-edits">Apply inline edits</button>' +
    '<button type="button" class="btn" data-action="doctrine-sc-toggle">' + (scOnly ? 'Show all' : 'Safety-critical only') + '</button>' +
    '</div>' +
    reportBlock +
    '<table class="doctrine-groups"><thead><tr><th>Table</th><th class="n">Remaining</th><th class="n">Total</th></tr></thead><tbody>' + groupRows + '</tbody></table>' +
    '<div class="fill-scroll"><table class="fill-table"><thead><tr><th>Value</th><th>New value</th><th>Source</th><th>Verified</th></tr></thead><tbody>' +
    shown.map(rowFor).join('') +
    '</tbody></table></div></div>'
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
            // Plain-language names, never raw enum ids (§ the app's own selects say "Pickets & wire").
            '<tr><td>' + esc(standards[o.standard]?.label ?? o.standard) + '</td><td>' + (o.overheadCover ? (o.roofPath === 'engineered_required' ? 'engineered' : 'cover') : '—') + '</td>' +
            '<td>' + esc(revetments[o.revetment]?.label ?? o.revetment) + '</td><td class="n">' + num(o.elapsedHours) + ' hr</td>' +
            '<td><button type="button" class="btn" data-action="plan-apply" data-idx="' + i + '">Use</button></td></tr>',
        )
        .join('')
    : '<tr><td colspan="5">Nothing fits ' + num(plan.budgetHours) + ' hr with a team of ' + plan.teamSize + '. Closest over-budget: ' +
      (plan.infeasibleBest ? esc(standards[plan.infeasibleBest.standard]?.label ?? plan.infeasibleBest.standard) + ' at ' + num(plan.infeasibleBest.elapsedHours) + ' hr' : '—') + '.</td></tr>';
  return (
    '<div class="tools"><h2>Time planner</h2>' + form +
    '<table class="plan"><thead><tr><th>Standard</th><th>Roof</th><th>Revet</th><th>Elapsed</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="tool-note">Ranked by protection, then buildability — highest protection that fits the budget first.</p></div>'
  );
}
