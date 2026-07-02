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

function btn(action: string, label: string, title: string, disabled = false): string {
  return (
    '<button type="button" class="btn" data-action="' + action + '" title="' + title + '"' +
    (disabled ? ' disabled aria-disabled="true"' : '') + '>' + label + '</button>'
  );
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

// Whether the topbar shows the NOT-FOR-FIELD-USE badge — data-driven off the placeholder
// count, so it clears exactly when a doctrine fill drives remaining to zero (§2.5). Exported
// for the banner-unlock test.
export function topbarHasFieldUseBadge(result: Result): boolean {
  return result.placeholderReport.remaining > 0;
}

function topbar(state: AppState, result: Result): string {
  const badge = topbarHasFieldUseBadge(result) ? '<span class="fielduse-badge" role="status">NOT FOR FIELD USE — practice data only</span>' : '';
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
      menuItem('plan', 'Time planner', 'Given hours and a crew size, find a setup that fits') +
      menuItem('schedule', 'Priorities of work', 'Stage-by-stage timeline: who does what, ready by stand-to?') +
      menuItem('doctrine', 'Doctrine values', 'Fill the placeholder numbers with real doctrine (offline) to clear the banner'),
  );
  const exportMenu = menu(
    'export',
    'Save & print',
    menuItem('print', 'Print report', 'A printable page with the drawings, materials, and labor') +
      menuItem('svg', 'Download drawings', 'Plan + section as SVG image files for a range-card packet') +
      menuItem('csv', 'Export spreadsheet', 'Materials list as a .csv file') +
      menuItem('export', 'Export settings file', 'Save this setup as a file you can load again later'),
  );

  return (
    '<header class="topbar">' +
    '<div class="brand"><strong>SAP-1</strong><span class="tagline">Survivability Position Planner</span>' + badge + '</div>' +
    '<div class="actions">' +
    btn('undo', 'Undo', 'Undo the last change', !state.canUndo) + btn('redo', 'Redo', 'Redo', !state.canRedo) + btn('reset', 'Start over', 'Clear everything and start fresh') +
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
  // Honesty parity with the 2D views (§2.5): the 3D card carries the same data-driven NOT FOR
  // FIELD USE badge and an "illustrative" note, so the friendly diorama can never be mistaken
  // for a measured model while placeholders remain.
  const badge3d = topbarHasFieldUseBadge(result)
    ? '<span class="three-badge">NOT FOR FIELD USE — illustrative</span>'
    : '';
  // Stage scrubber: 0 = post security … 6 = camouflage (final). Drives buildScene3D(result,
  // {stage}) so the model builds itself in doctrinal order. Keyboard-accessible (a range input).
  const stageScrubber = webglOk
    ? '<div class="three-scrubber"><label for="three-stage">Build stage</label>' +
      '<input type="range" id="three-stage" min="0" max="6" step="1" value="6" aria-label="Construction stage" list="stage-ticks">' +
      '<button type="button" class="btn tiny" data-action="three-cutaway" aria-pressed="false">Cutaway</button></div>'
    : '';
  const threeCard =
    '<figure class="panel-card three-card" aria-label="Interactive 3D model">' +
    '<div class="three-header"><span>3D MODEL</span>' + badge3d + '<span class="three-hint-text">drag to turn it around</span></div>' +
    (webglOk
      ? '<div id="three-socket" class="three-socket"></div>' + stageScrubber +
        '<div class="three-controls"><span class="three-hint">Illustrative diorama • drag to turn • scroll/pinch to zoom</span>' +
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
