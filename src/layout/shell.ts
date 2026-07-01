// App shell (§11). Builds every region once, then hands them to the active layout's arrange()
// (mobile / tablet / desktop). The topbar carries the title, the data-driven NOT FOR FIELD USE
// badge (§2.5), and the action buttons (undo/redo/reset, theme, exports, help, diagnostics).
// Drawings render through the error boundary so a bad view degrades to a card, never a crash.

import { controlsHtml } from './controls';
import { specsPanel, bomPanel, laborPanel, validationPanel, summaryBar } from './panels';
import { arrangeMobile } from './mobile';
import { arrangeTablet } from './tablet';
import { arrangeDesktop } from './desktop';
import { drawPlan } from '../render/drawPlan';
import { drawSection } from '../render/drawSection';
import { drawIso } from '../render/drawIso';
import { safeRender, errorCardHtml } from '../ui/errorBoundary';
import type { AppState } from '../state/store';
import type { Result } from '../engine/types';

export interface Parts {
  controls: string;
  plan: string;
  section: string;
  iso: string;
  specs: string;
  bom: string;
  labor: string;
  validation: string;
  summary: string;
}

function drawSafe(fn: (r: Result) => string, result: Result, label: string): string {
  const s = safeRender(fn, result, label);
  return s.ok ? s.value : errorCardHtml(s.error);
}

function btn(action: string, label: string, title: string): string {
  return '<button type="button" class="btn" data-action="' + action + '" title="' + title + '">' + label + '</button>';
}

function topbar(state: AppState, result: Result): string {
  const remaining = result.placeholderReport.remaining;
  const badge = remaining > 0 ? '<span class="fielduse-badge" role="status">NOT FOR FIELD USE</span>' : '';
  const themeLabel = state.theme === 'day' ? 'Night' : 'Day';
  const overrideOpts = (['auto', 'mobile', 'tablet', 'desktop'] as const)
    .map((m) => '<option value="' + m + '"' + (state.layoutOverride === m ? ' selected' : '') + '>' + m[0]!.toUpperCase() + m.slice(1) + '</option>')
    .join('');
  return (
    '<header class="topbar">' +
    '<div class="brand"><strong>SAP-1</strong><span class="tagline">Survivability Position Planner</span>' + badge + '</div>' +
    '<div class="actions">' +
    btn('undo', 'Undo', 'Undo (Ctrl+Z)') + btn('redo', 'Redo', 'Redo (Ctrl+Y)') + btn('reset', 'Reset', 'Reset inputs') +
    btn('theme', themeLabel, 'Toggle theme') +
    btn('print', 'Print', 'Print job sheet') + btn('csv', 'CSV', 'Export CSV') + btn('export', 'JSON', 'Export scenario JSON') +
    btn('help', 'Help', 'Help') + btn('diagnostics', 'Diag', 'Diagnostics') +
    '<label class="layout-override"><span class="sr-only">Layout</span>' +
    '<select data-action="layout-override" aria-label="Layout mode">' + overrideOpts + '</select></label>' +
    '</div></header>'
  );
}

export function renderApp(state: AppState, result: Result): string {
  const parts: Parts = {
    controls: controlsHtml(result.inputs),
    plan: drawSafe(drawPlan, result, 'Plan'),
    section: drawSafe(drawSection, result, 'Section'),
    iso: drawSafe(drawIso, result, 'Isometric'),
    specs: specsPanel(result),
    bom: bomPanel(result),
    labor: laborPanel(result),
    validation: validationPanel(result),
    summary: summaryBar(result),
  };
  const body =
    state.layoutMode === 'mobile' ? arrangeMobile(parts)
    : state.layoutMode === 'tablet' ? arrangeTablet(parts)
    : arrangeDesktop(parts);
  return topbar(state, result) + body;
}
