// App shell (§11). Builds every region once, then hands them to the active layout's arrange()
// (mobile / tablet / desktop). The topbar carries the title, the data-driven NOT FOR FIELD USE
// badge (§2.5), and the action menu (undo/redo/reset, theme, tools, exports, help, status).
// Drawings render through the error boundary so a bad view degrades to a card, never a crash.
//
// The isometric slot is now the interactive, drag-to-rotate 3D model (src/ui/three-viewer.ts) —
// a real 3D view is far more intuitive than a flat schematic for understanding a shape. The flat
// isometric SVG is kept as an automatic fallback for the rare device with no WebGL (main.ts
// decides which one is live; both markups always exist so no extra render pass is needed).

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
  three: string; // interactive 3D card (with the flat iso as its no-WebGL fallback content)
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

// A simple <details>/<summary> disclosure menu — keyboard- and screen-reader-operable with
// zero extra JS, closes on outside-click/Escape via a small handler in main.ts.
function menu(id: string, label: string, items: string): string {
  return (
    '<details class="menu" data-menu="' + id + '">' +
    '<summary class="btn menu-summary">' + label + '</summary>' +
    '<div class="menu-panel" role="menu">' + items + '</div>' +
    '</details>'
  );
}
function menuItem(action: string, label: string, hint: string): string {
  return (
    '<button type="button" class="menu-item" role="menuitem" data-action="' + action + '">' +
    '<span class="mi-label">' + label + '</span><span class="mi-hint">' + hint + '</span></button>'
  );
}

function topbar(state: AppState, result: Result): string {
  const remaining = result.placeholderReport.remaining;
  const badge = remaining > 0 ? '<span class="fielduse-badge" role="status">NOT FOR FIELD USE — practice data only</span>' : '';
  const themeLabel = state.theme === 'day' ? 'Switch to night mode' : 'Switch to day mode';
  const overrideOpts = ([
    ['auto', 'Auto (fits your screen)'],
    ['mobile', 'Phone'],
    ['tablet', 'Tablet'],
    ['desktop', 'Computer'],
  ] as const)
    .map(([v, l]) => '<option value="' + v + '"' + (state.layoutOverride === v ? ' selected' : '') + '>' + l + '</option>')
    .join('');

  const toolsMenu = menu(
    'tools',
    'Tools',
    menuItem('scenarios', 'Saved setups', 'Save this setup, or load one you saved before') +
      menuItem('mission', 'Group job list', 'Combine several positions into one materials list (Mission BOM)') +
      menuItem('compare', 'Compare setups', 'Put 2–3 setups side by side') +
      menuItem('plan', 'Time planner', 'Given hours and a crew size, find a setup that fits'),
  );
  const exportMenu = menu(
    'export',
    'Save & print',
    menuItem('print', 'Print report', 'A printable page with the drawings, materials, and labor') +
      menuItem('csv', 'Export spreadsheet', 'Materials list as a .csv file') +
      menuItem('export', 'Export settings file', 'Save this setup as a file you can load again later'),
  );

  return (
    '<header class="topbar">' +
    '<div class="brand"><strong>SAP-1</strong><span class="tagline">Survivability Position Planner</span>' + badge + '</div>' +
    '<div class="actions">' +
    btn('undo', 'Undo', 'Undo the last change') + btn('redo', 'Redo', 'Redo') + btn('reset', 'Start over', 'Clear everything and start fresh') +
    btn('theme', themeLabel, themeLabel) +
    toolsMenu + exportMenu +
    btn('help', 'Help', 'Plain-language explanation of every input') +
    btn('diagnostics', 'Status', 'App version, offline status, and how many practice values remain') +
    '<label class="layout-override"><span class="ov-label">View</span>' +
    '<select data-action="layout-override" aria-label="Screen layout">' + overrideOpts + '</select></label>' +
    '</div></header>'
  );
}

export function renderApp(state: AppState, result: Result, webglOk: boolean): string {
  const isoFallback = drawSafe(drawIso, result, '3D model');
  const threeCard =
    '<figure class="panel-card three-card" aria-label="Interactive 3D model">' +
    '<div class="three-header"><span>3D MODEL</span><span class="three-hint-text">drag to turn it around</span></div>' +
    (webglOk
      ? '<div id="three-socket" class="three-socket"></div>' +
        '<div class="three-controls"><span class="three-hint">Drag to turn • Scroll or pinch to zoom</span>' +
        '<button type="button" class="btn tiny" data-action="three-reset">Reset view</button></div>'
      : '<div class="three-socket three-socket-fallback">' + isoFallback + '</div>');

  const parts: Parts = {
    controls: controlsHtml(result.inputs),
    plan: drawSafe(drawPlan, result, 'Plan'),
    section: drawSafe(drawSection, result, 'Section'),
    three: threeCard,
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
