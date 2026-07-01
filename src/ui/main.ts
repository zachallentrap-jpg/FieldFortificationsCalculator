// App boot + wiring (§11, §13). Creates the store, resolves the layout from live matchMedia,
// runs the pure compute through the error boundary, and renders (rAF-batched). All interaction
// is delegated: [data-field] edits inputs, [data-action] runs a command, [data-trace] opens a
// derivation. No framework, no network.

import './tokens.css';
import './styles.css';

import { createStore, DEFAULT_INPUTS } from '../state/store';
import { createHistory } from '../state/history';
import { safeCompute, errorCardHtml } from './errorBoundary';
import { renderApp } from '../layout/shell';
import { traceHtml } from '../layout/panels';
import { helpHtml } from '../layout/help';
import { resolveLayout } from '../layout/resolve';
import { munitionsByClass, type ThreatClass } from '../doctrine/protection';
import { initialTheme, applyTheme, persistTheme, type Theme } from '../theme/theme';
import { collectDiagnostics, diagnosticsText } from '../layout/diagnostics';
import { jobSheet } from '../render/jobSheet';
import { toCsv } from '../render/csv';
import { scenariosOverlay, missionOverlay, compareOverlay, planOverlay } from '../layout/tools';
import { ScenarioStore, makeScenario } from '../state/scenarios';
import { createStorageAdapter } from '../state/persistence';
import { aggregateMission } from '../engine/mission';
import { planForTime, type PlanResult } from '../engine/plan';
import type { Inputs, Result } from '../engine/types';

const app = document.getElementById('app')!;
const overlay = document.getElementById('overlay')!;
const overlayBody = document.getElementById('overlay-body')!;

const theme = initialTheme();
applyTheme(theme);

const store = createStore({ theme, layoutMode: currentLayout('auto') });
const history = createHistory(store.getState().inputs);
const scenarioStore = new ScenarioStore(createStorageAdapter());
const onHand: Record<string, number> = {};
let lastResult: Result | null = null;
let sheetOpen = false;
let planHours = 8;
let planTeam = 2;
let lastPlan: PlanResult | null = null;

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return 'scn-' + Date.now().toString(36);
}
function pickFile(cb: (text: string) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) f.text().then(cb).catch(() => undefined);
  });
  input.click();
}
function openScenarios(): void {
  scenarioStore.list().then((list) => showOverlay(scenariosOverlay(list, store.getState().activeScenarioId)));
}
function openMission(): void {
  const set = store.getState().missionSet;
  showOverlay(missionOverlay(aggregateMission(set, { onHand }), set.length));
}
function openCompare(): void {
  const results: Result[] = [];
  for (const i of store.getState().comparisonSet) {
    const c = safeCompute(i);
    if (c.ok) results.push(c.value);
  }
  showOverlay(compareOverlay(results));
}
function openPlan(): void {
  showOverlay(planOverlay(lastPlan, planHours, planTeam));
}

document.documentElement.setAttribute('data-layout', store.getState().layoutMode);

// ── Layout resolution from live environment ──────────────────────────────────
function currentLayout(override: 'auto' | 'mobile' | 'tablet' | 'desktop') {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return resolveLayout({ width: window.innerWidth, pointerCoarse: coarse, landscape: window.innerWidth >= window.innerHeight, override });
}
function recomputeLayout(): void {
  const mode = currentLayout(store.getState().layoutOverride);
  if (mode !== store.getState().layoutMode) {
    document.documentElement.setAttribute('data-layout', mode);
    store.setState({ layoutMode: mode });
  }
}

// ── Render (rAF-batched) ─────────────────────────────────────────────────────
let scheduled = false;
function scheduleRender(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    render();
  });
}
function render(): void {
  const state = store.getState();
  const c = safeCompute(state.inputs);
  if (c.ok) {
    lastResult = c.value;
    app.innerHTML = renderApp(state, c.value);
  } else {
    store.setState({ lastError: c.error });
    app.innerHTML = errorCardHtml(c.error);
  }
  applySheet();
}

store.subscribe(scheduleRender);

// ── Input edits ──────────────────────────────────────────────────────────────
function coerce(field: keyof Inputs, el: HTMLInputElement | HTMLSelectElement): Partial<Inputs> {
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return { [field]: el.checked } as Partial<Inputs>;
  if (el instanceof HTMLInputElement && el.type === 'number') {
    const n = parseInt(el.value, 10);
    return { [field]: Number.isFinite(n) ? n : 0 } as Partial<Inputs>;
  }
  return { [field]: el.value } as Partial<Inputs>;
}

function commit(patch: Partial<Inputs>): void {
  store.setInputs(patch);
  history.push(store.getState().inputs);
}

document.addEventListener('change', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
  if (el instanceof HTMLInputElement && el.dataset['onhand']) {
    onHand[el.dataset['onhand']] = Math.max(0, parseInt(el.value, 10) || 0);
    openMission();
    return;
  }
  const field = el.dataset['field'] as keyof Inputs | undefined;
  if (field) {
    commit(coerce(field, el));
    return;
  }
  if (el instanceof HTMLSelectElement && el.dataset['action'] === 'layout-override') {
    store.setState({ layoutOverride: el.value as 'auto' | 'mobile' | 'tablet' | 'desktop' });
    recomputeLayout();
  }
  // Threat class picked → jump to the first caliber in that class (or clear the threat).
  if (el instanceof HTMLSelectElement && el.dataset['action'] === 'threat-class') {
    if (el.value === 'none') commit({ threat: 'none' });
    else {
      const first = munitionsByClass(el.value as ThreatClass)[0];
      if (first) commit({ threat: first.id });
    }
  }
});

// ── Commands + trace ─────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const traceEl = target.closest<HTMLElement>('[data-trace]');
  if (traceEl) {
    openTrace(traceEl.dataset['trace']!);
    return;
  }
  const actionEl = target.closest<HTMLElement>('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset['action'];
  switch (action) {
    case 'undo': applyInputs(history.undo()); break;
    case 'redo': applyInputs(history.redo()); break;
    case 'reset': store.replaceInputs(DEFAULT_INPUTS); history.reset(DEFAULT_INPUTS); break;
    case 'theme': toggleTheme(); break;
    case 'print': doPrint(); break;
    case 'csv': doCsv(); break;
    case 'export': doExportJson(); break;
    case 'help': showOverlay(helpHtml()); break;
    case 'diagnostics': showDiagnostics(); break;
    case 'sheet-toggle': sheetOpen = !sheetOpen; applySheet(); break;
    case 'overlay-close': hideOverlay(); break;
    // ── Scenarios ──
    case 'scenarios': openScenarios(); break;
    case 'scenario-save': {
      const name = window.prompt('Scenario name:');
      if (name !== null) {
        scenarioStore
          .save(makeScenario(newId(), name.trim() || 'Untitled', store.getState().inputs, new Date().toISOString()))
          .then(openScenarios);
      }
      break;
    }
    case 'scenario-load': {
      const id = actionEl.dataset['id'];
      if (id) scenarioStore.load(id).then((s) => { if (s) { store.replaceInputs(s.inputs); history.reset(s.inputs); store.setState({ activeScenarioId: id }); hideOverlay(); } });
      break;
    }
    case 'scenario-delete': { const id = actionEl.dataset['id']; if (id) scenarioStore.remove(id).then(openScenarios); break; }
    case 'scenario-export': scenarioStore.list().then((list) => download('sap1-scenarios.json', JSON.stringify(list, null, 2), 'application/json')); break;
    case 'scenario-import': pickFile((text) => { const r = scenarioStore.parseImport(text); if (r.ok) scenarioStore.save(r.value).then(openScenarios); else window.alert('Import failed: ' + r.error); }); break;
    // ── Mission BOM ──
    case 'mission': openMission(); break;
    case 'mission-add': store.setState({ missionSet: [...store.getState().missionSet, { inputs: { ...store.getState().inputs } }] }); openMission(); break;
    case 'mission-clear': store.setState({ missionSet: [] }); openMission(); break;
    // ── Compare ──
    case 'compare': openCompare(); break;
    case 'compare-add': { const set = store.getState().comparisonSet; if (set.length < 3) store.setState({ comparisonSet: [...set, { ...store.getState().inputs }] }); openCompare(); break; }
    case 'compare-remove': { const idx = Number(actionEl.dataset['idx']); const set = store.getState().comparisonSet.slice(); if (idx >= 0 && idx < set.length) { set.splice(idx, 1); store.setState({ comparisonSet: set }); } openCompare(); break; }
    case 'compare-clear': store.setState({ comparisonSet: [] }); openCompare(); break;
    // ── Time-available planning ──
    case 'plan': openPlan(); break;
    case 'plan-run': {
      const h = document.getElementById('plan-hours') as HTMLInputElement | null;
      const t = document.getElementById('plan-team') as HTMLInputElement | null;
      planHours = h ? Math.max(1, parseInt(h.value, 10) || planHours) : planHours;
      planTeam = t ? Math.max(1, parseInt(t.value, 10) || planTeam) : planTeam;
      lastPlan = planForTime({ availableHours: planHours, teamSize: planTeam, base: store.getState().inputs });
      openPlan();
      break;
    }
    case 'plan-apply': { const opt = lastPlan?.feasible[Number(actionEl.dataset['idx'])]; if (opt) { store.replaceInputs(opt.inputs); history.push(opt.inputs); hideOverlay(); } break; }
    default: break;
  }
});

function applyInputs(inputs: Inputs | null): void {
  if (inputs) store.replaceInputs(inputs);
}

// Keyboard: undo/redo (desktop), Esc closes overlay/sheet.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); applyInputs(history.undo()); }
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); applyInputs(history.redo()); }
  else if (e.key === 'Escape') { if (!overlay.hidden) hideOverlay(); else if (sheetOpen) { sheetOpen = false; applySheet(); } }
});

// ── Theme ────────────────────────────────────────────────────────────────────
function toggleTheme(): void {
  const next: Theme = store.getState().theme === 'day' ? 'night' : 'day';
  applyTheme(next);
  persistTheme(next);
  store.setState({ theme: next });
}

// ── Overlay (trace / help / diagnostics) ─────────────────────────────────────
function showOverlay(html: string): void {
  overlayBody.innerHTML = html;
  overlay.hidden = false;
}
function hideOverlay(): void {
  overlay.hidden = true;
  overlayBody.innerHTML = '';
}
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) hideOverlay();
});
function openTrace(key: string): void {
  const d = lastResult?.derivations.find((x) => x.key === key);
  if (d) showOverlay(traceHtml(d));
}
function showDiagnostics(): void {
  const d = collectDiagnostics(store.getState().lastError);
  showOverlay('<div class="diagnostics"><h2>Diagnostics</h2><pre>' + escapeHtml(diagnosticsText(d)) + '</pre></div>');
}

// ── Mobile bottom-sheet ──────────────────────────────────────────────────────
function applySheet(): void {
  const sheet = app.querySelector<HTMLElement>('.bottom-sheet');
  const fab = app.querySelector<HTMLElement>('.fab');
  if (sheet) {
    sheet.setAttribute('data-open', String(sheetOpen));
    sheet.setAttribute('aria-hidden', String(!sheetOpen));
  }
  if (fab) fab.setAttribute('aria-expanded', String(sheetOpen));
  document.documentElement.classList.toggle('sheet-open', sheetOpen);
}

// ── Exports (local; the user clicks to download) ─────────────────────────────
function meta() {
  return { scenario: 'Working position', date: new Date().toISOString().slice(0, 10) };
}
function download(name: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function doCsv(): void {
  if (lastResult) download('sap1-bom.csv', toCsv(lastResult, meta()), 'text/csv;charset=utf-8');
}
function doExportJson(): void {
  if (lastResult) download('sap1-scenario.json', JSON.stringify(lastResult.inputs, null, 2), 'application/json');
}
function doPrint(): void {
  if (!lastResult) return;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(jobSheet(lastResult, meta()));
  w.document.close();
  w.focus();
  w.print();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Live layout listeners ────────────────────────────────────────────────────
window.addEventListener('resize', recomputeLayout);
window.addEventListener('orientationchange', recomputeLayout);
if (typeof matchMedia !== 'undefined') {
  matchMedia('(pointer: coarse)').addEventListener?.('change', recomputeLayout);
}

// ── PWA: register the service worker when served over http(s) (never from file://) ──
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline still works from cache / standalone; registration failure is non-fatal */
    });
  });
}

// ── First paint ──────────────────────────────────────────────────────────────
render();
