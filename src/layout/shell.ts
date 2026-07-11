// App shell (§11). Builds every region once, then hands them to the active layout's arrange()
// (mobile / tablet / desktop). A slim topbar carries the title, the data-driven NOT-FOR-FIELD-USE
// badge (§2.5), and one hamburger menu (setups, exports, help, status, screen size); a persistent
// bottom toolbar carries the four things
// people reach for constantly — undo, redo, reset, theme — plus the input-editing trigger on
// mobile. Drawings render through the error boundary so a bad view degrades to a card, never
// a crash.
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

// Inline line-icons (24x24, currentColor) for the toolbar/menu — emoji render as tofu or
// inconsistent colored glyphs across platforms/fonts; these are plain geometric shapes that
// always render the same. Sized/colored by CSS (.tbtn-icon svg, .menu-summary svg), not here.
const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
const ICONS = {
  undo: '<svg ' + ICON_ATTRS + '><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/></svg>',
  redo: '<svg ' + ICON_ATTRS + '><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 7"/></svg>',
  reset: '<svg ' + ICON_ATTRS + '><path d="M21 3v6h-6"/><path d="M3 12a9 9 0 0 1 15.5-6.7L21 9"/></svg>',
  sun: '<svg ' + ICON_ATTRS + '><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg ' + ICON_ATTRS + '><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  edit: '<svg ' + ICON_ATTRS + '><path d="M3 21l3.6-1L18 8.6a2 2 0 0 0 0-2.8l-.8-.8a2 2 0 0 0-2.8 0L3 16.4z"/><path d="M14 6l4 4"/></svg>',
  menu: '<svg ' + ICON_ATTRS + '><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
};

// A compact icon-over-label button for the persistent bottom toolbar (§ bottomToolbar) — the
// same visible-icon-plus-short-word pattern as a phone's OS-level toolbar, since it has to fit
// 4-5 buttons across a 375px-wide screen with ≥44px tap targets each.
function toolbarBtn(action: string, icon: string, label: string, title: string, disabled = false): string {
  return (
    '<button type="button" class="tbtn" data-action="' + action + '" title="' + title + '" aria-label="' + title + '"' +
    (disabled ? ' disabled aria-disabled="true"' : '') + '>' +
    '<span class="tbtn-icon" aria-hidden="true">' + icon + '</span><span class="tbtn-label">' + label + '</span></button>'
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
// A non-clickable label that groups related menu items — the hamburger now holds everything
// that isn't a quick action (setups/exports/help/status/view), so it needs scannable sections
// instead of one long flat list.
function menuGroupTitle(label: string): string {
  return '<div class="menu-group-title" role="presentation">' + label + '</div>';
}

// Whether there are still placeholder (illustrative, unverified) values feeding the result —
// drives the topbar's NOT-FOR-FIELD-USE badge and the Doctrine values tool's progress readout.
// Exported for the doctrine-unlock test.
export function topbarHasFieldUseBadge(result: Result): boolean {
  return result.placeholderReport.remaining > 0;
}

// Slim topbar: the plain-language app name on the left, ONE hamburger menu on the right holding
// everything that isn't reached for constantly (setups, exports, help, status, screen size).
// The four things people tap over and over while iterating — undo, redo, reset, theme — live in
// bottomToolbar() instead, always in reach without opening anything (§ redesign: quick actions
// stay one tap away; everything else is a deliberate trip to the menu, not a wall of buttons).
function topbar(state: AppState, result: Result): string {
  const badge = topbarHasFieldUseBadge(result)
    ? '<span class="fielduse-badge" role="status">NOT FOR FIELD USE — placeholder data</span>'
    : '';
  const overrideOpts = ([
    ['auto', 'Auto (fits your screen)'],
    ['mobile', 'Phone'],
    ['tablet', 'Tablet'],
    ['desktop', 'Computer'],
  ] as const)
    .map(([v, l]) => '<option value="' + v + '"' + (state.layoutOverride === v ? ' selected' : '') + '>' + l + '</option>')
    .join('');

  const viewRow =
    // Same reasoning as before: a phone has no room for tablet/desktop's multi-column grids, so
    // the picker offers nothing real there — left out of the phone build of the menu entirely.
    // Also dev-only: it's a QA affordance for previewing other breakpoints, not something a real
    // user (who just has their actual device) ever needs — stripped from production builds.
    state.layoutMode === 'mobile' || !import.meta.env.DEV ? '' :
    '<div class="menu-row"><label class="layout-override"><span class="ov-label">Screen size</span>' +
    '<select data-action="layout-override" aria-label="Screen layout">' + overrideOpts + '</select></label></div>';

  const hamburgerMenu = menu(
    'hamburger',
    ICONS.menu + '<span>Menu</span>',
    menuGroupTitle('Setups & planning') +
      menuItem('scenarios', 'Saved setups', 'Save this setup, or load one you saved before') +
      menuItem('mission', 'Combine positions', 'Roll several positions into one materials list') +
      menuItem('compare', 'Compare setups', 'Put 2–3 setups side by side') +
      menuItem('plan', 'Time planner', 'Given hours and a crew size, find a setup that fits') +
      menuItem('schedule', 'Build schedule', 'Stage-by-stage timeline: who does what, and by when') +
      menuItem('doctrine', 'Doctrine values', 'Fill the placeholder numbers with real, verified doctrine (offline)') +
      menuGroupTitle('Save & print') +
      menuItem('print', 'Print report', 'A printable page with the drawings, materials, and labor') +
      menuItem('svg', 'Download drawings', 'Plan + section as image files you can print or share') +
      menuItem('csv', 'Export spreadsheet', 'Materials list as a .csv file') +
      menuItem('export', 'Export settings file', 'Save this setup as a file you can load again later') +
      menuGroupTitle('App') +
      menuItem('help', 'Help', 'Plain-language explanation of every input') +
      menuItem('diagnostics', 'Status', 'App version, offline status, and how many practice values remain') +
      viewRow,
  );

  return (
    '<header class="topbar">' +
    '<div class="brand"><strong>Fighting Position Planner</strong>' + badge + '</div>' +
    hamburgerMenu +
    '</header>'
  );
}

// Persistent bottom toolbar (§ redesign) — the small set of actions used constantly while
// iterating on a design: undo/redo a change, start clean, or flip the theme for the light.
// Fixed at the bottom on every screen size so it's always one tap away, never buried in a menu.
// On mobile it ALSO carries the input-editing trigger — the old floating "Edit inputs" pill is
// folded in here as one more toolbar slot instead of a second, separately-positioned control.
function bottomToolbar(state: AppState): string {
  const themeIcon = state.theme === 'day' ? ICONS.moon : ICONS.sun;
  const themeTitle = state.theme === 'day' ? 'Switch to night mode' : 'Switch to day mode';
  const editSlot =
    state.layoutMode === 'mobile'
      ? toolbarBtn('sheet-toggle', ICONS.edit, 'Edit', 'Edit position inputs')
      : '';
  return (
    '<nav class="bottom-toolbar" aria-label="Quick actions">' +
    toolbarBtn('undo', ICONS.undo, 'Undo', 'Undo the last change', !state.canUndo) +
    toolbarBtn('redo', ICONS.redo, 'Redo', 'Redo the last undone change', !state.canRedo) +
    toolbarBtn('reset', ICONS.reset, 'Reset', 'Clear everything and start fresh') +
    toolbarBtn('theme', themeIcon, 'Theme', themeTitle) +
    editSlot +
    '</nav>'
  );
}

export function renderApp(state: AppState, result: Result, webglOk: boolean, sheetOpen: boolean): string {
  const isoFallback = drawSafe(drawIso, result, '3D model');
  // Stage scrubber: 0 = post security … 6 = camouflage (final). Drives buildScene3D(result,
  // {stage}) so the model builds itself in doctrinal order. Keyboard-accessible (a range input).
  const stageScrubber = webglOk
    ? '<div class="three-scrubber"><label for="three-stage">Build stage</label>' +
      '<input type="range" id="three-stage" min="0" max="6" step="1" value="6" aria-label="Construction stage" list="stage-ticks">' +
      '<button type="button" class="btn tiny" data-action="three-cutaway" aria-pressed="false">Cutaway</button></div>'
    : '';
  const threeCard =
    '<figure class="panel-card three-card" aria-label="Interactive 3D model">' +
    '<div class="three-header"><span>3D MODEL</span><span class="three-hint-text">drag to turn it around</span></div>' +
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
    state.layoutMode === 'mobile' ? arrangeMobile(parts, sheetOpen)
    : state.layoutMode === 'tablet' ? arrangeTablet(parts)
    : arrangeDesktop(parts);
  return topbar(state, result) + body + bottomToolbar(state);
}
