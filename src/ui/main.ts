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
import { drawPlan } from '../render/drawPlan';
import { drawSection } from '../render/drawSection';
import { scenariosOverlay, scenarioSaveOverlay, scenarioDeleteConfirmOverlay, missionOverlay, compareOverlay, planOverlay, doctrineOverlay, scheduleOverlay } from '../layout/tools';
import { computeStages, scheduleStages, type Schedule } from '../engine/stages';
import { ScenarioStore, makeScenario, duplicateScenario } from '../state/scenarios';
import { createStorageAdapter } from '../state/persistence';
import { saveSession, restoreSession } from '../state/session';
import { all as allDoctrine, counts as doctrineCounts } from '../doctrine/registry';
import { exportDoctrine, importDoctrine, getFillState } from '../doctrine/io';
import { DOCTRINE_VERSION } from '../version';
import { saveFill, restoreFill } from '../state/doctrineFill';
import { aggregateMission } from '../engine/mission';
import { planForTime, type PlanResult } from '../engine/plan';
import { isWebGLAvailable, createThreeViewer } from './three-viewer';
import type { Inputs, Result } from '../engine/types';

const app = document.getElementById('app')!;
const overlay = document.getElementById('overlay')!;
const overlayBody = document.getElementById('overlay-body')!;

const theme = initialTheme();
applyTheme(theme);

// Restore the working session (inputs, mission/compare sets, on-hand) so a tab eviction or
// reload never wipes a plan — everything re-validates through schema.ts on the way back in.
const sessionStorage_ = typeof localStorage !== 'undefined' ? localStorage : null;
const restored = sessionStorage_ ? restoreSession(sessionStorage_) : null;

const store = createStore({
  theme,
  layoutMode: currentLayout('auto'),
  ...(restored ? { inputs: restored.inputs, missionSet: restored.missionSet, comparisonSet: restored.comparisonSet } : {}),
});
const history = createHistory(store.getState().inputs);
const persistAdapter = createStorageAdapter();
const scenarioStore = new ScenarioStore(persistAdapter);
const onHand: Record<string, number> = { ...(restored?.onHand ?? {}) };

// Doctrine-fill overlay state.
let doctrineScOnly = false;
let doctrineReport: import('../doctrine/io').DoctrineImportReport | null = null;
let pendingImport: unknown = null; // a dry-run-validated file awaiting the user's Apply

function openDoctrine(): void {
  showOverlay(doctrineOverlay(allDoctrine(), doctrineCounts(), getFillState(), doctrineScOnly, doctrineReport));
}

function persistSession(): void {
  if (!sessionStorage_) return;
  const s = store.getState();
  saveSession(sessionStorage_, { inputs: s.inputs, missionSet: s.missionSet, comparisonSet: s.comparisonSet, onHand });
}

// Topbar undo/redo buttons disable when there is nothing to undo/redo — refreshed after every
// history operation (setState triggers the re-render that repaints the buttons).
function syncHistory(): void {
  store.setState({ canUndo: history.canUndo(), canRedo: history.canRedo() });
}

// Transient confirmation toast — lives OUTSIDE #app so the full-shell re-render never eats it.
// Created ONCE at boot: a role=status region only announces CHANGES, so inserting the element
// and its first message in the same mutation could leave the first toast (possibly a failure
// message) silent for screen-reader users.
const toastEl = document.createElement('div');
toastEl.id = 'toast';
toastEl.className = 'toast';
toastEl.setAttribute('role', 'status');
document.body.appendChild(toastEl);
let toastTimer = 0;
function showToast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}
let lastResult: Result | null = null;
let sheetOpen = false;
let planHours = 8;
let planTeam = 2;
let lastPlan: PlanResult | null = null;
let schedTeam = 4;
let schedHours = 12;
let schedPosture = 0.75;
let lastSchedule: Schedule | null = null;

function runSchedule(): void {
  if (!lastResult) return;
  lastSchedule = scheduleStages(computeStages(lastResult), {
    teamSize: schedTeam,
    availableHours: schedHours,
    securityPostureFrac: schedPosture,
    machineAssist: lastResult.inputs.machineAssist,
  });
}
function openSchedule(): void {
  showOverlay(scheduleOverlay(lastSchedule, schedTeam, schedHours, schedPosture));
}

// The 3D canvas is created ONCE and re-parented into the fresh markup after every render (a
// <canvas> can't survive an innerHTML replace, but detach/reattach keeps its WebGL context,
// camera angle, and zoom — so rotating the model never gets reset by an unrelated input edit).
const webglOk = isWebGLAvailable();
const threeViewer = webglOk ? createThreeViewer() : null;
threeViewer?.setTheme(store.getState().theme);
// 3D scrubber state: stage 6 = final (all stages built); cutaway off. Threaded through every
// viewer update so an unrelated input edit never resets the stage the user is inspecting.
let threeStage = 6;
let threeCutaway = false;

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
  // Reopening must reflect CURRENT inputs, not the position lastPlan was computed for —
  // otherwise the table shows elapsed-hours for a threat/soil the user has since changed.
  if (lastPlan) lastPlan = planForTime({ availableHours: planHours, teamSize: planTeam, base: store.getState().inputs });
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
// The whole shell re-renders as an HTML string, which destroys focus. Remember which control
// held focus (by its data-field / data-action binding) and restore it after the swap — a
// keyboard or screen-reader user changing a dropdown must not be dumped back to <body>.
function focusKey(): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !app.contains(active)) return null;
  if (active.dataset['field']) return '[data-field="' + active.dataset['field'] + '"]';
  if (active.dataset['action']) return '[data-action="' + active.dataset['action'] + '"]';
  if (active.id) return '#' + active.id;
  return null;
}

// The whole shell is swapped via innerHTML on every input change, which resets the page scroll
// AND every internal scroll container (the mobile edit-sheet, the desktop/tablet sticky rails).
// On a phone that means: scroll down the form, change a dropdown, get yanked to the top — the
// #1 reported mobile annoyance. Capture each scrollable region by a STABLE selector before the
// swap and restore it on the freshly-built node after. Window scroll is captured separately.
const SCROLL_SELECTORS = ['.sheet-scroll', '.controls-region', '.rail'] as const;
function captureScroll(): { win: number; regions: Array<[string, number]> } {
  const regions: Array<[string, number]> = [];
  for (const sel of SCROLL_SELECTORS) {
    const el = app.querySelector<HTMLElement>(sel);
    if (el && el.scrollTop > 0) regions.push([sel, el.scrollTop]);
  }
  return { win: window.scrollY, regions };
}
function restoreScroll(snap: { win: number; regions: Array<[string, number]> }): void {
  for (const [sel, top] of snap.regions) {
    const el = app.querySelector<HTMLElement>(sel);
    if (el) el.scrollTop = top;
  }
  if (window.scrollY !== snap.win) window.scrollTo(0, snap.win);
}

function render(): void {
  const state = store.getState();
  const c = safeCompute(state.inputs);
  const refocus = focusKey();
  const scroll = captureScroll();
  if (c.ok) {
    lastResult = c.value;
    app.innerHTML = renderApp(state, c.value, webglOk, sheetOpen);
    if (threeViewer) {
      const socket = document.getElementById('three-socket');
      if (socket) {
        threeViewer.attach(socket);
        threeViewer.update(c.value, { stage: threeStage >= 6 ? undefined : threeStage, cutaway: threeCutaway });
      }
      // Re-render replaces the scrubber markup (default value 6) — restore the live stage so the
      // slider thumb and the Cutaway button match the model the user is actually looking at.
      const scrub = document.getElementById('three-stage') as HTMLInputElement | null;
      if (scrub) scrub.value = String(threeStage);
      const cut = document.querySelector('[data-action="three-cutaway"]');
      if (cut) cut.setAttribute('aria-pressed', String(threeCutaway));
    }
    announce(c.value);
  } else {
    store.setState({ lastError: c.error });
    app.innerHTML = errorCardHtml(c.error);
  }
  if (refocus) {
    const el = app.querySelector<HTMLElement>(refocus);
    // preventScroll: refocusing the rebuilt control must not scroll it into view — on mobile
    // that fights the scroll restore below and produces a visible jump after every edit.
    if (el && !(el as HTMLButtonElement).disabled) {
      el.focus({ preventScroll: true });
    } else if (el) {
      // The control the user was on just became disabled (e.g. Undo after the last undo) —
      // keep keyboard focus in its group instead of silently dropping it to <body>.
      el.closest<HTMLElement>('.actions, form, .menu-panel')
        ?.querySelector<HTMLElement>('button:not([disabled]), select, input')
        ?.focus({ preventScroll: true });
    }
  }
  applySheet();
  restoreScroll(scroll);
}

// Screen-reader announcement: a terse summary into a dedicated polite live region, replacing
// the old aria-live on #app (which re-announced the ENTIRE page on every input change).
function announce(result: Result): void {
  const el = document.getElementById('sr-status');
  if (!el) return;
  const text =
    'Updated. ' + result.labor.manHoursPerPosition + ' man-hours per position, ' +
    result.labor.elapsedHours + ' hours elapsed with this team.';
  if (el.textContent !== text) el.textContent = text;
}

store.subscribe(scheduleRender);
store.subscribe(persistSession);

// ── Input edits ──────────────────────────────────────────────────────────────
function coerce(field: keyof Inputs, el: HTMLInputElement | HTMLSelectElement): Partial<Inputs> {
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return { [field]: el.checked } as Partial<Inputs>;
  if (el instanceof HTMLInputElement && el.type === 'number') {
    // Clamp to the input's own declared range — otherwise the field can display 0 (or -5)
    // while the engine quietly computes with the clamped value, and the two never agree.
    const min = el.min === '' ? -Infinity : Number(el.min);
    const max = el.max === '' ? Infinity : Number(el.max);
    const n = parseInt(el.value, 10);
    const fallback = Number.isFinite(min) ? min : 0;
    const v = Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
    return { [field]: v } as Partial<Inputs>;
  }
  return { [field]: el.value } as Partial<Inputs>;
}

function commit(patch: Partial<Inputs>): void {
  store.setInputs(patch);
  history.push(store.getState().inputs);
  syncHistory();
}

document.addEventListener('change', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
  if (el instanceof HTMLInputElement && el.dataset['onhand']) {
    onHand[el.dataset['onhand']] = Math.max(0, parseInt(el.value, 10) || 0);
    persistSession(); // onHand lives outside the store, so the subscriber won't catch this
    openMission();
    return;
  }
  const field = el.dataset['field'] as keyof Inputs | undefined;
  if (field) {
    const patch = coerce(field, el);
    commit(patch);
    // If the clamp lands on the SAME value the state already had (e.g. typing 0 when count
    // is 1), nothing changes → no re-render → the field would keep showing the rejected
    // text. Snap the visible value to what was actually committed.
    const v = patch[field];
    if (el instanceof HTMLInputElement && el.type === 'number' && typeof v === 'number' && el.value !== String(v)) {
      el.value = String(v);
    }
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

// Stage scrubber (range input) — drives the 3D build stage live. Handled on 'input' (not the
// delegated 'change' path) so dragging updates the model continuously, and WITHOUT a full shell
// re-render (the viewer just rebuilds its scene) so the drag stays smooth.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el instanceof HTMLInputElement && el.id === 'three-stage') {
    // NB: parseInt('0') is falsy — `|| 6` would silently swallow stage 0 (post security), so
    // use an explicit finite check.
    const v = parseInt(el.value, 10);
    threeStage = Number.isFinite(v) ? Math.max(0, Math.min(6, v)) : 6;
    if (lastResult) threeViewer?.update(lastResult, { stage: threeStage >= 6 ? undefined : threeStage, cutaway: threeCutaway });
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
    case 'undo': applyInputs(history.undo()); syncHistory(); break;
    case 'redo': applyInputs(history.redo()); syncHistory(); break;
    // Also resets a pinned layout override back to 'auto' — the View picker that undoes a pin is
    // itself hidden while mobile is forced (see shell.ts topbar()), so without this, a
    // desktop/tablet user who force-previews "Phone" would have no UI path back to their own
    // device's real layout (resolveLayout ignores window size entirely once override !== 'auto').
    case 'reset':
      store.replaceInputs(DEFAULT_INPUTS);
      history.reset(DEFAULT_INPUTS);
      store.setState({ activeScenarioId: null, activeScenarioName: null, layoutOverride: 'auto' });
      recomputeLayout();
      syncHistory();
      break;
    case 'theme': toggleTheme(); break;
    case 'print': doPrint(); break;
    case 'csv': doCsv(); break;
    case 'export': doExportJson(); break;
    case 'svg': doSvg(); break;
    case 'compare-standards': compareStandards(); break;
    case 'help': showOverlay(helpHtml()); break;
    case 'diagnostics': showDiagnostics(); break;
    case 'sheet-toggle': sheetOpen = !sheetOpen; applySheet(); break;
    case 'overlay-close': hideOverlay(); break;
    // ── Scenarios ──
    case 'scenarios': openScenarios(); break;
    case 'scenario-save': showOverlay(scenarioSaveOverlay()); break;
    case 'scenario-save-confirm': {
      const nameEl = document.getElementById('scenario-save-name') as HTMLInputElement | null;
      const id = newId();
      const finalName = (nameEl?.value ?? '').trim() || 'Untitled';
      scenarioStore
        .save(makeScenario(id, finalName, store.getState().inputs, new Date().toISOString()))
        .then(() => {
          store.setState({ activeScenarioId: id, activeScenarioName: finalName });
          showToast('Saved "' + finalName + '" on this device.');
          openScenarios();
        })
        .catch((e: unknown) => {
          store.setState({ lastError: 'Scenario save failed: ' + String(e) });
          showToast('Save FAILED — device storage unavailable. Export a settings file instead.');
        });
      break;
    }
    case 'scenario-load': {
      const id = actionEl.dataset['id'];
      if (id) scenarioStore.load(id).then((s) => { if (s) { store.replaceInputs(s.inputs); history.reset(s.inputs); syncHistory(); store.setState({ activeScenarioId: id, activeScenarioName: s.name }); hideOverlay(); } });
      break;
    }
    case 'scenario-duplicate': {
      const id = actionEl.dataset['id'];
      if (id) scenarioStore.load(id).then((s) => {
        if (s) scenarioStore.save(duplicateScenario(s, newId(), s.name + ' (copy)', new Date().toISOString()))
          .then(openScenarios)
          .catch(() => showToast('Duplicate FAILED — device storage unavailable.'));
      });
      break;
    }
    case 'scenario-delete-ask': {
      const id = actionEl.dataset['id'];
      const name = actionEl.dataset['name'] ?? 'this scenario';
      if (id) showOverlay(scenarioDeleteConfirmOverlay(id, name));
      break;
    }
    case 'scenario-delete-confirm': {
      const id = actionEl.dataset['id'];
      if (id) {
        scenarioStore.remove(id).then(() => {
          if (store.getState().activeScenarioId === id) store.setState({ activeScenarioId: null, activeScenarioName: null });
          openScenarios();
        });
      }
      break;
    }
    case 'scenario-export': scenarioStore.list().then((list) => { download('sap1-scenarios.json', JSON.stringify(list, null, 2), 'application/json'); showToast(list.length + ' scenario(s) exported as a file.'); }); break;
    case 'scenario-import': pickFile((text) => {
      const r = scenarioStore.parseImportMany(text);
      if (!r.ok) { showToast('Import failed: ' + r.error); return; }
      Promise.all(r.value.map((s) => scenarioStore.save(s))).then(() => {
        showToast(r.value.length + ' scenario(s) imported.');
        openScenarios();
      }).catch(() => showToast('Import FAILED — device storage unavailable. Nothing may have been saved.'));
    }); break;
    // ── Mission BOM ──
    // ── Doctrine fill (placeholder burn-down) ──
    case 'doctrine': doctrineReport = null; pendingImport = null; openDoctrine(); break;
    case 'doctrine-export':
      download('sap1-doctrine.json', JSON.stringify(exportDoctrine(), null, 2), 'application/json');
      showToast('Doctrine file exported — edit it offline against current pubs, then import it back.');
      break;
    case 'doctrine-import':
      pickFile((text) => {
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { showToast('Import failed: not valid JSON.'); return; }
        pendingImport = parsed;
        doctrineReport = importDoctrine(parsed, { dryRun: true }); // preview only — nothing mutated yet
        openDoctrine();
      });
      break;
    case 'doctrine-import-apply':
      if (pendingImport !== null) {
        doctrineReport = importDoctrine(pendingImport);
        pendingImport = null;
        if (doctrineReport.ok) { saveFill(persistAdapter); showToast(doctrineReport.applied + ' doctrine value(s) applied and saved on this device.'); scheduleRender(); }
        openDoctrine();
      }
      break;
    case 'doctrine-apply-edits': {
      doctrineReport = applyInlineDoctrineEdits();
      if (doctrineReport.ok) { saveFill(persistAdapter); showToast(doctrineReport.applied + ' doctrine value(s) applied.'); scheduleRender(); }
      openDoctrine();
      break;
    }
    case 'doctrine-sc-toggle': doctrineScOnly = !doctrineScOnly; openDoctrine(); break;
    // ── Priorities of work / stand-to scheduler ──
    case 'schedule': openSchedule(); break;
    case 'schedule-run': {
      const t = document.getElementById('sch-team') as HTMLInputElement | null;
      const h = document.getElementById('sch-hours') as HTMLInputElement | null;
      const p = document.getElementById('sch-posture') as HTMLInputElement | null;
      schedTeam = t ? Math.max(1, parseInt(t.value, 10) || schedTeam) : schedTeam;
      schedHours = h ? Math.max(1, parseInt(h.value, 10) || schedHours) : schedHours;
      schedPosture = p ? Math.min(1, Math.max(0.1, (parseInt(p.value, 10) || 75) / 100)) : schedPosture;
      runSchedule();
      openSchedule();
      break;
    }
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
    case 'plan-apply': { const opt = lastPlan?.feasible[Number(actionEl.dataset['idx'])]; if (opt) { store.replaceInputs(opt.inputs); history.push(opt.inputs); syncHistory(); hideOverlay(); } break; }
    // ── 3D viewer ──
    case 'three-reset': threeViewer?.resetView(); if (lastResult) threeViewer?.update(lastResult, { stage: threeStage >= 6 ? undefined : threeStage, cutaway: threeCutaway }); break;
    case 'three-cutaway': {
      threeCutaway = !threeCutaway;
      actionEl.setAttribute('aria-pressed', String(threeCutaway));
      if (lastResult) threeViewer?.update(lastResult, { stage: threeStage >= 6 ? undefined : threeStage, cutaway: threeCutaway });
      break;
    }
    default: break;
  }
  // Auto-close a dropdown menu after picking an item from it (native <details> stays open
  // otherwise), but never for the "reset view" button which lives outside a menu.
  const openMenu = actionEl.closest<HTMLDetailsElement>('details.menu');
  if (openMenu && action !== undefined) openMenu.open = false;
});

// Close any open dropdown menu on outside click or Escape (native <details> doesn't do this).
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  for (const d of document.querySelectorAll<HTMLDetailsElement>('details.menu[open]')) {
    if (!d.contains(t)) d.open = false;
  }
});

function applyInputs(inputs: Inputs | null): void {
  if (inputs) store.replaceInputs(inputs);
}

// Keyboard: undo/redo (desktop), Esc closes overlay/sheet.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); applyInputs(history.undo()); syncHistory(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); applyInputs(history.redo()); syncHistory(); }
  else if (e.key === 'Escape') {
    const openMenu = document.querySelector<HTMLDetailsElement>('details.menu[open]');
    if (!overlay.hidden) hideOverlay();
    else if (openMenu) openMenu.open = false;
    else if (sheetOpen) { sheetOpen = false; applySheet(); }
  }
});

// ── Theme ────────────────────────────────────────────────────────────────────
function toggleTheme(): void {
  const next: Theme = store.getState().theme === 'day' ? 'night' : 'day';
  applyTheme(next);
  persistTheme(next);
  threeViewer?.setTheme(next);
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
// Read the inline fill-table inputs from the open overlay, overlay them onto a fresh full
// export, and run the SAME validated importer (all-or-nothing) — so an inline edit is exactly
// as safe as an imported file. Unedited leaves keep their current values.
function applyInlineDoctrineEdits(): import('../doctrine/io').DoctrineImportReport {
  const base = exportDoctrine();
  const byPath = new Map(base.entries.map((e) => [e.path, e]));
  for (const el of overlayBody.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-fillpath]')) {
    const path = el.dataset['fillpath']!;
    const entry = byPath.get(path);
    if (!entry) continue;
    const type = el.dataset['filltype'];
    if (type === 'number') { const n = parseFloat(el.value); if (Number.isFinite(n)) entry.value = n; }
    else if (type === 'boolean') entry.value = el.value === 'true';
    else entry.value = el.value;
    const src = overlayBody.querySelector<HTMLInputElement>('[data-fillsrc="' + CSS.escape(path) + '"]');
    if (src && src.value.trim()) entry.source = src.value.trim();
    const verify = overlayBody.querySelector<HTMLInputElement>('[data-fillverify="' + CSS.escape(path) + '"]');
    entry.status = verify?.checked ? 'DOCTRINE' : 'PLACEHOLDER';
  }
  return importDoctrine({ ...base, doctrineVersion: DOCTRINE_VERSION });
}

function openTrace(key: string): void {
  const d = lastResult?.derivations.find((x) => x.key === key);
  if (d) showOverlay(traceHtml(d));
}
function showDiagnostics(): void {
  const d = collectDiagnostics(store.getState().lastError);
  showOverlay(
    '<div class="diagnostics"><h2>Status</h2><p class="tool-note">Version, offline status, and how many practice values still need a real number.</p><pre>' +
      escapeHtml(diagnosticsText(d)) + '</pre></div>',
  );
}

// ── Mobile bottom-sheet ──────────────────────────────────────────────────────
function applySheet(): void {
  const sheet = app.querySelector<HTMLElement>('.bottom-sheet');
  const backdrop = app.querySelector<HTMLElement>('.sheet-backdrop');
  // NOT the generic '[data-action="sheet-toggle"]' — the sheet-backdrop div carries that same
  // action (tap-to-dismiss) and would win a plain querySelector by DOM order; button:: scopes
  // this to the actual toolbar trigger, the only element aria-expanded is meaningful on.
  const trigger = app.querySelector<HTMLElement>('button[data-action="sheet-toggle"]');
  if (sheet) {
    sheet.setAttribute('data-open', String(sheetOpen));
    sheet.setAttribute('aria-hidden', String(!sheetOpen));
  }
  // The backdrop is what actually stops the background page from scrolling/receiving taps
  // while the sheet is open — CSS alone (html.sheet-open{overflow:hidden}) blocks wheel/keyboard
  // scroll but not iOS Safari's touch-scroll-through-a-fixed-element quirk; a full-viewport
  // element with its own touch-action:none closes that gap.
  if (backdrop) backdrop.setAttribute('data-open', String(sheetOpen));
  if (trigger) trigger.setAttribute('aria-expanded', String(sheetOpen));
  document.documentElement.classList.toggle('sheet-open', sheetOpen);
}

// Swipe-down-to-dismiss on the sheet's drag handle — the handle previously rendered but had no
// gesture wired to it at all, so the one interaction every user tries on a bottom-sheet handle
// (drag it down) silently did nothing. Delegated at the document level (pointerdown keyed off
// data-action) because the handle node is destroyed and rebuilt on every full-shell re-render,
// so a listener attached directly to it would need re-attaching after every input change.
let dragStartY: number | null = null;
let dragLastDy = 0;
let dragSheetEl: HTMLElement | null = null;
const DISMISS_THRESHOLD_PX = 70;
document.addEventListener('pointerdown', (e) => {
  const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-action="sheet-drag-handle"]');
  if (!handle) return;
  dragSheetEl = handle.closest<HTMLElement>('.bottom-sheet');
  if (!dragSheetEl) return;
  dragStartY = e.clientY;
  dragLastDy = 0;
  dragSheetEl.style.transition = 'none'; // track the finger 1:1 while dragging
});
document.addEventListener('pointermove', (e) => {
  if (dragStartY === null || !dragSheetEl) return;
  dragLastDy = Math.max(0, e.clientY - dragStartY); // only downward drag moves the sheet
  dragSheetEl.style.transform = 'translateY(' + dragLastDy + 'px)';
});
function endDrag(): void {
  if (dragStartY === null || !dragSheetEl) return;
  const el = dragSheetEl;
  const dy = dragLastDy;
  dragStartY = null;
  dragSheetEl = null;
  el.style.transition = ''; // restore the CSS transition for both outcomes below
  el.style.transform = '';
  if (dy > DISMISS_THRESHOLD_PX) {
    sheetOpen = false;
    applySheet();
  }
  // Otherwise clearing the inline transform lets data-open="true"'s CSS rule (translateY(0))
  // snap the sheet back open — no separate "cancel" branch needed.
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ── Exports (local; the user clicks to download) ─────────────────────────────
// The job sheet / CSV header carries the REAL scenario name when one is active — an unsaved
// setup is labeled as exactly that, never a stand-in that looks like a saved plan.
function meta() {
  return { scenario: store.getState().activeScenarioName ?? 'Unsaved setup', date: new Date().toISOString().slice(0, 10) };
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
  if (!lastResult) return;
  download('sap1-bom.csv', toCsv(lastResult, meta()), 'text/csv;charset=utf-8');
  showToast('Materials list downloaded (sap1-bom.csv).');
}
function doExportJson(): void {
  if (!lastResult) return;
  // Export a VALID scenario file (id + name + inputs) — the old export wrote bare inputs,
  // which the importer rightly rejected: the app couldn't re-open its own file.
  const s = makeScenario(newId(), meta().scenario, lastResult.inputs, new Date().toISOString());
  download('sap1-scenario.json', scenarioStore.exportJson(s), 'application/json');
  showToast('Settings file downloaded (sap1-scenario.json).');
}
function doSvg(): void {
  if (!lastResult) return;
  // The renderers already produce standalone SVG strings — a plan + section download needs no
  // rasterization, stays fully offline, and drops into any range-card packet or briefing.
  download('sap1-plan.svg', drawPlan(lastResult), 'image/svg+xml');
  download('sap1-section.svg', drawSection(lastResult), 'image/svg+xml');
  showToast('Plan and section downloaded as SVG drawings.');
}

// One-click "hasty vs deliberate vs reinforced" comparison — the canonical survivability
// lesson (same position + threat, three standards side by side).
function compareStandards(): void {
  const base = store.getState().inputs;
  store.setState({ comparisonSet: (['hasty', 'deliberate', 'reinforced'] as const).map((standard) => ({ ...base, standard })) });
  openCompare();
}

function doPrint(): void {
  if (!lastResult) return;
  const w = window.open('', '_blank');
  if (!w) {
    // Pop-up blocked (common on locked-down phones): deliver the job sheet as a file instead
    // of failing silently — the user still walks away with the printable document.
    download('sap1-job-sheet.html', jobSheet(lastResult, meta()), 'text/html;charset=utf-8');
    showToast('Pop-up blocked — job sheet saved as an HTML file. Open it and print from there.');
    return;
  }
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

// Re-apply any persisted doctrine fill (async — IndexedDB), then repaint so the banner and
// every computed value reflect the filled doctrine. Re-validated through the strict importer,
// so a stored fill that no longer matches the registry is refused, not silently trusted.
restoreFill(persistAdapter).then((n) => {
  if (n > 0) scheduleRender();
});
