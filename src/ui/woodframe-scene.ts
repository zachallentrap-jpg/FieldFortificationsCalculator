// TIMBER-2 — the boot file. Wires the router, the picker and the workbench together and owns
// nothing else: every behavior lives in `src/ui/woodframe/*`, and everything that can be pure
// is pure and node-tested (plan §4.1, R9).
//
// The app opens on the PICKER (mandate #3). Choosing a card, or resuming a saved build, routes
// to the workbench, where the config panel edits a spec and the scene is regenerated from it —
// the scene never edits itself, so the model on screen is always exactly what the spec says.

import { generateStructure, type StructureModel } from '../timber/families/index';
import type { StructureSpec, BuildingSpec, RoofSpec, FoundationSpec, OpeningSpec, OpeningKind, OpeningFill } from '../timber/spec';
import { normalizeSpec } from '../timber/normalize';
import { familyById, type FamilyId } from '../timber/catalog';
import { onPropAssetsReady } from './three-viewer';
import { renderPicker } from './woodframe/picker';
import { createStudio, type StudioHandles } from './woodframe/studio';
import { configSchemaFor, type PanelRow } from './woodframe/config';
import { HUT } from '../timber/doctrine';
import { layoutStrip } from '../timber/elevation';
import {
  loadSession, saveSession, commitBuild, buildFromFamily, findBuild, nextCustomId,
  unlockToCustom, recentBuilds, type SessionState, type StoredBuild,
} from './woodframe/store';
import { parseRoute, routeToHash, decodeSpec, encodeSpec } from './woodframe/router';
import { FEATURES, APP_NAME, MODE } from './woodframe/mode';
import { askPacketOptions, downloadMaterialsCsv, openCommandSheet, PACKET_DEFAULTS } from './woodframe/sheet';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The screened band a hut gets when its toggle is switched on. */
const HUT_BAND = { sillFt: HUT.screenBandSillFt.value as number, heightFt: HUT.screenBandHeightFt.value as number };

const app = document.getElementById('app')!;
const noticeBar = document.getElementById('notices')!;

let session: SessionState;
let current: StoredBuild | null = null;
let model: StructureModel | null = null;
let studio: StudioHandles | null = null;
let saveTimer = 0;

// ── Session boot: stored bytes are revalidated, never trusted ────────────────
{
  const loaded = loadSession(window.localStorage);
  session = loaded.state;
  if (loaded.notices.length > 0) showNotices(loaded.notices);
}

function showNotices(messages: string[]): void {
  if (messages.length === 0) {
    noticeBar.hidden = true;
    return;
  }
  noticeBar.hidden = false;
  noticeBar.innerHTML = messages.map((m) => `<p>${esc(m)}</p>`).join('');
}

/** Debounced write, flushed synchronously when the page is going away. */
function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveSession(window.localStorage, session), 300);
}
function flushSave(): void {
  window.clearTimeout(saveTimer);
  saveSession(window.localStorage, session);
}
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

// ── Routing ─────────────────────────────────────────────────────────────────

function go(hash: string): void {
  if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

window.addEventListener('hashchange', render);

function render(): void {
  const route = parseRoute(window.location.hash);
  if (route.name === 'picker') {
    renderPickerScreen();
    return;
  }
  let build = findBuild(session, route.id);
  if (route.shared) {
    const spec = decodeSpec(route.shared.raw);
    if (spec) {
      const { state, id } = nextCustomId(session);
      session = state;
      build = { id, familyId: (spec as { family: string }).family === 'building' ? 'custom' : 'custom', label: 'Shared build', spec };
      session = commitBuild(session, build).state;
      scheduleSave();
      // The shared entry leaves history: the user is now editing their own copy.
      window.history.replaceState(null, '', `#/build/${id}`);
    }
  }
  if (!build) {
    const fromFamily = buildFromFamily(route.id as FamilyId);
    if (fromFamily) {
      build = fromFamily;
      session = commitBuild(session, build).state;
      scheduleSave();
    }
  }
  if (!build) {
    showNotices([`That build (${route.id}) is not on this device — showing the structure list.`]);
    go('#/');
    return;
  }
  renderWorkbench(build);
}

// ── Picker screen ───────────────────────────────────────────────────────────

function renderPickerScreen(): void {
  if (studio) {
    studio.dispose();
    studio = null;
  }
  current = null;
  document.body.dataset.screen = 'picker';
  app.innerHTML = '<div id="pickerRoot"></div>';
  renderPicker(document.getElementById('pickerRoot')!, recentBuilds(session), {
    onOpenFamily: (id) => go(routeToHash({ name: 'build', id })),
    onOpenBuild: (id) => go(routeToHash({ name: 'build', id })),
  });
}

// ── Workbench ───────────────────────────────────────────────────────────────

function regenerate(): void {
  if (!current) return;
  const { spec, issues } = normalizeSpec(current.spec);
  current.spec = spec;
  model = generateStructure(spec);
  studio?.setModel(model);
  renderIssues(issues.map((i) => i.message));
  renderStrips();
  session = commitBuild(session, { ...current, updatedAt: Date.now() }).state;
  scheduleSave();
}

function renderIssues(messages: string[]): void {
  const el = document.getElementById('issues');
  if (!el) return;
  el.hidden = messages.length === 0;
  el.innerHTML = messages.map((m) => `<p>${esc(m)}</p>`).join('');
}

function renderWorkbench(build: StoredBuild): void {
  current = build;
  document.body.dataset.screen = 'build';
  const family = familyById(build.familyId);
  model = generateStructure(build.spec);

  app.innerHTML = `
    <div class="workbench">
      <header class="wb-head">
        <button class="back" id="backBtn" type="button">◀ Structures</button>
        <h1>${esc(build.label ?? family?.name ?? build.id)}</h1>
        <span class="lineage">${esc(family?.lineage ?? '')}</span>
        <div class="wb-actions">
          <button class="chip" id="shareBtn" type="button">Copy link</button>
          <button class="chip" id="unlockBtn" type="button">Unlock everything</button>
          ${FEATURES.commandOutputs
            ? '<button class="chip chip--go" id="sheetBtn" type="button">Command packet</button>'
            : '<a class="chip chip--go" href="learn.html">Flashcards</a>'}
        </div>
      </header>
      <div id="issues" class="issues" hidden></div>
      <div class="wb-toolbar">
        <div class="grp"><b>View</b><span id="views"></span></div>
        <div class="grp"><b>Stage</b><span id="stages"></span></div>
        <div class="grp"><b>Cut</b><span id="cutAxes"></span></div>
      </div>
      <div id="cutDepthRow" class="cut-row" hidden></div>
      <div id="stageName" class="stage-name"></div>
      <main class="wb-main">
        <section class="pane pane--config" aria-label="Configure">
          <div id="configPanel"></div>
        </section>
        <div id="viewport" class="viewport"></div>
        <aside class="pane pane--inspect" aria-label="Inspect">
          <div id="memberCard" class="member-card" hidden></div>
          <div id="stagePanel"></div>
          <!-- The strips belong beside the model, not below the fold: the window itself no
               longer scrolls, so anything parked under it would simply never be seen. -->
          <section class="strips">
            <h2>Plate layout — the marks to pencil (X stud · K king · J jack · C cripple)</h2>
            <div id="stripsBody"></div>
          </section>
          <p class="doctrine">TO construction per FM 5-426 (public release); life-safety values cite
            EM 385-1-1. Citations marked (PH) are pending a manual page check.</p>
        </aside>
      </main>
    </div>`;

  studio = createStudio(
    {
      viewport: document.getElementById('viewport')!,
      views: document.getElementById('views')!,
      stages: document.getElementById('stages')!,
      stageName: document.getElementById('stageName')!,
      cutAxes: document.getElementById('cutAxes')!,
      cutDepthRow: document.getElementById('cutDepthRow')!,
      memberCard: document.getElementById('memberCard')!,
      stagePanel: document.getElementById('stagePanel')!,
    },
    model,
  );

  document.getElementById('backBtn')!.addEventListener('click', () => go('#/'));
  document.getElementById('sheetBtn')?.addEventListener('click', () => {
    // Ask for the three numbers the tool has no basis for before generating anything. A labor
    // table built on defaults nobody chose is a labor table the unit gets held to anyway.
    void askPacketOptions(PACKET_DEFAULTS).then((opts) => {
      if (!opts) return;
      // The packet carries a still of the view the operator set up, so the drawing on the page
      // is the one they were looking at when they decided it was right. `preserveDrawingBuffer`
      // is on for exactly this; a blocked pop-up falls back to printing the workbench itself.
      const canvas = document.querySelector<HTMLCanvasElement>('#viewport canvas');
      const input = {
        model: model!,
        title: current!.label ?? family?.name ?? current!.id,
        lineage: family?.lineage ?? '',
        viewImage: canvas ? canvas.toDataURL('image/png') : null,
        ...opts,
      };
      if (opts.action === 'csv') {
        // Fitted to the SAME stock lengths as the packet, from the same compile.
        downloadMaterialsCsv(input);
        showNotices(['Materials CSV saved. It carries the estimate\'s limits at the top — keep them with it.']);
        return;
      }
      const opened = openCommandSheet(input);
      if (!opened) showNotices(['This browser would not open a print frame — try Save as PDF from the browser menu.']);
    });
  });
  document.getElementById('shareBtn')!.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#/build/${current!.id}?c=${encodeSpec(current!.spec)}`;
    void navigator.clipboard?.writeText(url).then(
      () => showNotices(['Link copied. It carries the design, not your saved builds.']),
      () => showNotices([url]),
    );
  });
  document.getElementById('unlockBtn')!.addEventListener('click', () => {
    const { state, build: unlocked } = unlockToCustom(session, current!);
    session = state;
    scheduleSave();
    go(routeToHash({ name: 'build', id: unlocked.id }));
  });

  renderConfigPanel();
  renderStrips();
  onPropAssetsReady(() => studio?.setModel(model!));
}

// ── Config panel ────────────────────────────────────────────────────────────

function getPath(spec: StructureSpec, path: string): unknown {
  let node: unknown = spec;
  for (const key of path.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function setPath(spec: StructureSpec, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = spec as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    if (node[k] === undefined || node[k] === null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
}

/** Roof and foundation are unions — switching kind rebuilds the branch with sane defaults. */
function setRoofKind(spec: BuildingSpec, kind: RoofSpec['kind']): void {
  const prev = spec.roof;
  const rise = prev.kind === 'gable' || prev.kind === 'shed' || prev.kind === 'hip' || prev.kind === 'pyramid' ? prev.risePer12 : 4;
  const oh = prev.kind === 'none' ? 1 : prev.overhangFt;
  spec.roof =
    kind === 'gable' ? { kind, risePer12: rise, overhangFt: oh }
    : kind === 'shed' ? { kind, risePer12: rise || 3, overhangFt: oh, highSide: 'N' }
    : kind === 'flat' ? { kind, overhangFt: oh, drainPer12: 1 }
    : kind === 'hip' ? { kind, risePer12: rise, overhangFt: oh }
    : kind === 'pyramid' ? { kind, risePer12: rise, overhangFt: oh }
    : { kind: 'none' };
}

function setFoundationKind(spec: BuildingSpec, kind: FoundationSpec['kind']): void {
  const prev = spec.foundation;
  const crawl = prev.kind === 'piers' || prev.kind === 'wall' ? prev.crawlFt : 1.5;
  spec.foundation =
    kind === 'piers' ? { kind, crawlFt: crawl }
    : kind === 'wall' ? { kind, crawlFt: crawl }
    : kind === 'basement' ? { kind, depthFt: 7.5, stairs: true }
    : kind === 'slab' ? { kind }
    : kind === 'skids' ? { kind }
    : { kind: 'embedded', embedFt: 3 };
}

function rowHtml(row: PanelRow, value: unknown): string {
  const locked = row.lockedBy
    ? `<span class="lock" title="${esc(row.cite ?? '')}">standard design · ${esc(row.lockedBy)}</span>`
    : '';
  const std = row.lock === 'preset' ? '<span class="std">STD</span>' : '';
  const help = row.help ? `<span class="help">${esc(row.help)}</span>` : '';
  const cite = row.cite && !row.lockedBy ? `<span class="cite">${esc(row.cite)}</span>` : '';
  if (row.control === 'openings-editor') {
    return `<div class="row row--openings" data-path="${esc(row.path)}">
      <span class="row-label">${esc(row.label)} ${std}</span>${help}
      <div class="openings" id="openingsEditor"></div>
    </div>`;
  }
  if (row.control === 'toggle') {
    return `<label class="row"><span class="row-label">${esc(row.label)}</span>
      <input type="checkbox" data-path="${esc(row.path)}" ${value ? 'checked' : ''} ${row.lockedBy ? 'disabled' : ''}/>
      ${locked}${help}</label>`;
  }
  if (row.control === 'select') {
    const opts = (row.options ?? [])
      .map((o) => `<option value="${esc(o)}"${String(value) === o ? ' selected' : ''}>${esc(o)}</option>`)
      .join('');
    return `<label class="row"><span class="row-label">${esc(row.label)}</span>
      <select data-path="${esc(row.path)}" ${row.lockedBy ? 'disabled' : ''}>${opts}</select>
      ${locked}${help}</label>`;
  }
  return `<label class="row"><span class="row-label">${esc(row.label)}</span>
    <input type="number" data-path="${esc(row.path)}" value="${Number(value ?? 0)}"
      min="${row.min ?? ''}" max="${row.max ?? ''}" step="${row.step ?? 'any'}" inputmode="decimal"
      ${row.lockedBy ? 'disabled' : ''}/>
    ${locked}${cite}${help}</label>`;
}

function renderConfigPanel(): void {
  if (!current) return;
  const schema = configSchemaFor(current.familyId);
  const panel = document.getElementById('configPanel')!;
  panel.innerHTML = schema.groups
    .map((g, i) => `<details class="cfg-group"${i < 2 ? ' open' : ''}>
      <summary>${esc(g.title)}</summary>
      ${g.rows.map((r) => rowHtml(r, getPath(current!.spec, r.path))).join('')}
    </details>`)
    .join('');

  // `input[data-path], select[data-path]` — NOT `[data-path]`. The openings row is a <div> that
  // carries data-path to say which spec branch it edits, and the bare selector matched it too.
  // `change` bubbles, so every keystroke committed inside the openings editor re-entered this
  // handler with `el` = that div, fell through to the final `setPath(spec, path, el.value)`, and
  // wrote `undefined` over `stories.0.openings` — silently deleting every door and window in the
  // building the moment you adjusted one of them. It was there before this editor was rewritten;
  // the old one just never re-rendered afterwards, so nothing on screen contradicted itself.
  panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[data-path], select[data-path]').forEach((el) => {
    el.addEventListener('change', () => {
      const path = el.dataset.path!;
      const spec = current!.spec as BuildingSpec;
      if (path === 'screenBand') {
        // The toggle is "does this hut breathe"; the spec value is the band itself, or null.
        // Mapping it here keeps the doctrine numbers out of the control and out of the panel.
        (spec as unknown as Record<string, unknown>).screenBand = (el as HTMLInputElement).checked
          ? { sillFt: HUT_BAND.sillFt, heightFt: HUT_BAND.heightFt }
          : null;
      } else if (path === 'roof.kind') setRoofKind(spec, (el as HTMLSelectElement).value as RoofSpec['kind']);
      else if (path === 'foundation.kind') setFoundationKind(spec, (el as HTMLSelectElement).value as FoundationSpec['kind']);
      else if (el instanceof HTMLInputElement && el.type === 'checkbox') setPath(spec, path, el.checked);
      else if (el instanceof HTMLInputElement && el.type === 'number') {
        const n = Number(el.value);
        // Commit-on-valid: a value that cannot be a number stays in the control.
        if (!Number.isFinite(n)) {
          el.classList.add('blocked');
          return;
        }
        el.classList.remove('blocked');
        setPath(spec, path, n);
      } else {
        const raw = (el as HTMLSelectElement).value;
        const row = schema.groups.flatMap((g) => g.rows).find((r) => r.path === path);
        setPath(spec, path, row?.numeric ? Number(raw) : raw);
      }
      regenerate();
      renderConfigPanel();
    });
  });
  renderOpeningsEditor();
}

// ── Openings ────────────────────────────────────────────────────────────────
//
// The first version of this editor put six controls on one line per opening: a type popup and
// five bare number boxes under a header strip. With four windows on a wall it was a grid of
// twenty unlabelled numbers, the header only lined up with the first row, and the owner asked
// why adding a door was so hard when it should be trivial. It should be, so:
//
//   · ADDING IS ONE CLICK. "+ Door" makes a real 3'0" x 6'8" door in the first gap wide enough
//     to hold it. Nothing has to be typed for the result to be correct and buildable.
//   · A PLACED OPENING READS AS A SENTENCE. Collapsed, a row says what it is, how big, and
//     where — in feet and inches, not decimal feet. No column headers to look up.
//   · EDITING IS NAMED FIELDS, not a row of boxes, and only the ones that apply: a door has no
//     sill, so a door never shows one.
//   · WHAT IS WRONG SAYS SO, on the row: off the end of the wall, or overlapping its neighbour.

const OPENING_KINDS: { kind: OpeningKind; label: string; widthFt: number; heightFt: number; sillHeightFt: number; fill: OpeningFill }[] = [
  // Sizes are the standard-design rough openings this tool already ships in its presets, so
  // "+ Door" produces the same door the GP building's own drawing calls for.
  { kind: 'door', label: 'Door', widthFt: 3, heightFt: 6.7, sillHeightFt: 0, fill: 'door-ledged' },
  { kind: 'window', label: 'Window', widthFt: 3, heightFt: 3.5, sillHeightFt: 3.5, fill: 'window-shutter' },
  { kind: 'vent', label: 'Vent', widthFt: 1.5, heightFt: 1, sillHeightFt: 6.5, fill: 'vent-screen' },
];

/** Decimal feet as a carpenter reads them: 6.7 ft is 6'-8", not "6.7". */
function ftIn(ft: number): string {
  const total = Math.round(ft * 12);
  const f = Math.trunc(total / 12);
  const i = Math.abs(total % 12);
  return i === 0 ? `${f}'` : `${f}'-${i}"`;
}

/** How long this wall runs, which is what an offset is measured along. */
function wallRunFt(spec: BuildingSpec, wall: string): number {
  return wall === 'S' || wall === 'N' ? spec.dims.lengthFt : spec.dims.widthFt;
}

/**
 * Where to put a new opening: the middle of the widest clear stretch, keeping a corner post's
 * worth of wall at each end. Dropping every new opening at a fixed offset would stack them on
 * top of each other, and then the FIRST thing the user has to do is fix the tool's mess.
 */
function placeInGap(list: OpeningSpec[], runFt: number, widthFt: number): number {
  const margin = 0.5;
  const taken = [...list].map((o) => [o.offsetFt, o.offsetFt + o.widthFt] as const).sort((a, b) => a[0] - b[0]);
  let best = margin;
  let bestSpan = -1;
  let cursor = margin;
  for (const [a, b] of [...taken, [runFt - margin, runFt - margin] as const]) {
    const span = a - cursor;
    if (span > bestSpan) {
      bestSpan = span;
      best = cursor + Math.max(0, (span - widthFt) / 2);
    }
    cursor = Math.max(cursor, b + margin);
  }
  // Every gap is too small: park it at the left margin and let the row's own warning say so.
  return Math.round(Math.max(margin, Math.min(best, runFt - widthFt - margin)) * 4) / 4;
}

/**
 * Plain-language complaint about one opening, or null when it is fine.
 *
 * Deliberately short. `normalizeSpec` already slides an opening back inside its wall, clamps
 * width/height/sill to their spec ranges, and drops one too wide to fit — with a message each
 * time — so those states never reach a row here and a warning about them would be dead code
 * pretending to be a safety net. OVERLAP is the one thing normalization does not touch (order
 * is preserved verbatim under TD5, and silently reordering someone's wall would be worse), so
 * it is the one thing the row has to say out loud.
 */
function openingProblem(o: OpeningSpec, i: number, list: OpeningSpec[]): string | null {
  for (let k = 0; k < list.length; k++) {
    const b = list[k]!;
    if (k === i) continue;
    if (o.offsetFt < b.offsetFt + b.widthFt - 1e-6 && b.offsetFt < o.offsetFt + o.widthFt - 1e-6) {
      return `overlaps the ${esc(b.kind)} at ${ftIn(b.offsetFt)} — the framing will collide`;
    }
  }
  return null;
}

/** Which opening is expanded for editing. One at a time — the panel is 328 px wide. */
let openOpening: string | null = null;

function renderOpeningsEditor(): void {
  const host = document.getElementById('openingsEditor');
  if (!host || !current) return;
  const spec = current.spec as BuildingSpec;
  const story = spec.stories?.[0];
  if (!story) return;
  const walls: [string, string][] = [['S', 'Front (S)'], ['N', 'Rear (N)'], ['E', 'Right (E)'], ['W', 'Left (W)']];

  const fieldsFor = (o: OpeningSpec): { key: keyof OpeningSpec; label: string; step: number; min: number }[] => [
    { key: 'widthFt', label: 'Width', step: 0.25, min: 0.5 },
    { key: 'heightFt', label: 'Height', step: 0.25, min: 0.5 },
    { key: 'offsetFt', label: 'From left corner', step: 0.25, min: 0 },
    // A door's sill is zero by definition — the opening starts at the sole plate — so showing
    // the field would only offer a way to make the model wrong.
    ...(o.kind === 'door' ? [] : [{ key: 'sillHeightFt' as const, label: 'Sill height', step: 0.25, min: 0 }]),
  ];

  host.innerHTML = walls
    .map(([w, label]) => {
      const list = story.openings[w as 'S'] ?? [];
      const runFt = wallRunFt(spec, w);
      const rows = list
        .map((o, i) => {
          const id = `${w}-${i}`;
          const open = openOpening === id;
          const kindLabel = OPENING_KINDS.find((k) => k.kind === o.kind)?.label ?? o.kind;
          const problem = openingProblem(o, i, list);
          const editor = open
            ? `<div class="op-edit">${fieldsFor(o)
                .map(
                  (f) => `<label class="op-field"><span>${f.label}</span>
                    <input type="number" data-op="${f.key}" value="${Number(o[f.key] ?? 0)}"
                      step="${f.step}" min="${f.min}" inputmode="decimal" />
                    <em>ft</em></label>`,
                )
                .join('')}
                <button class="op-del" data-op="remove" type="button">Remove this ${esc(kindLabel.toLowerCase())}</button>
              </div>`
            : '';
          return `<div class="op${open ? ' op--open' : ''}${problem ? ' op--bad' : ''}" data-wall="${w}" data-i="${i}" data-id="${id}">
            <button class="op-sum" data-toggle="${id}" type="button" aria-expanded="${open}">
              <span class="op-kind">${esc(kindLabel)}</span>
              <span class="op-size">${ftIn(o.widthFt)} × ${ftIn(o.heightFt)}</span>
              <span class="op-at">${ftIn(o.offsetFt)} from left</span>
              <span class="op-chev" aria-hidden="true">${open ? '▾' : '›'}</span>
            </button>
            ${problem ? `<p class="op-warn">${esc(problem)}</p>` : ''}
            ${editor}
          </div>`;
        })
        .join('');
      return `<section class="op-wall">
        <h4>${esc(label)}<span class="op-run">${ftIn(runFt)} wall</span></h4>
        ${rows || '<p class="op-none">No openings — a solid wall.</p>'}
        <div class="op-add">${OPENING_KINDS.map((k) => `<button class="chip" data-add="${w}" data-kind="${k.kind}" type="button">+ ${esc(k.label)}</button>`).join('')}</div>
      </section>`;
    })
    .join('');

  host.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((el) => {
    el.addEventListener('click', () => {
      const w = el.dataset.add as 'S';
      const preset = OPENING_KINDS.find((k) => k.kind === el.dataset.kind)!;
      // Re-read through `current` rather than the captured story: `regenerate()` swaps
      // `current.spec` for the normalized copy, so anything closed over here is one edit stale.
      const live = (current!.spec as BuildingSpec).stories[0]!;
      const list = live.openings[w] ?? [];
      live.openings[w] = [
        ...list,
        {
          kind: preset.kind,
          offsetFt: placeInGap(list, wallRunFt(spec, w), preset.widthFt),
          widthFt: preset.widthFt,
          heightFt: preset.heightFt,
          sillHeightFt: preset.sillHeightFt,
          fill: preset.fill,
        },
      ];
      // Open the one just added: the common next move is to slide it, and a row that appears
      // already unfolded is the difference between "added" and "added, now find it".
      openOpening = `${w}-${(live.openings[w] ?? []).length - 1}`;
      regenerate();
      renderConfigPanel();
    });
  });

  host.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      openOpening = openOpening === el.dataset.toggle ? null : el.dataset.toggle!;
      renderOpeningsEditor();
    });
  });

  host.querySelectorAll<HTMLElement>('.op--open').forEach((opEl) => {
    const w = opEl.dataset.wall as 'S';
    const i = Number(opEl.dataset.i);
    opEl.querySelectorAll<HTMLInputElement>('input[data-op]').forEach((field) => {
      field.addEventListener('change', () => {
        const n = Number(field.value);
        if (!Number.isFinite(n)) {
          field.classList.add('blocked');
          return;
        }
        field.classList.remove('blocked');
        const live = (current!.spec as BuildingSpec).stories[0]!;
        if (!live.openings[w]?.[i]) return;
        (live.openings[w]![i] as unknown as Record<string, unknown>)[field.dataset.op!] = n;
        regenerate();
        renderOpeningsEditor(); // refresh the summary line and any warning
      });
    });
    opEl.querySelector<HTMLButtonElement>('[data-op="remove"]')?.addEventListener('click', () => {
      const live = (current!.spec as BuildingSpec).stories[0]!;
      live.openings[w] = (live.openings[w] ?? []).filter((_, k) => k !== i);
      openOpening = null;
      regenerate();
      renderConfigPanel();
    });
  });
}

// ── Layout strips ───────────────────────────────────────────────────────────

function renderStrips(): void {
  const body = document.getElementById('stripsBody');
  if (!body || !current || !model) return;
  const spec = current.spec as BuildingSpec;
  if (spec.family !== 'building') {
    body.innerHTML = '';
    return;
  }
  const walls: ['S' | 'N' | 'E' | 'W', string][] = [
    ['S', 'Front (S)'], ['N', 'Rear (N)'], ['E', 'Right (E)'], ['W', 'Left (W)'],
  ];
  body.innerHTML = walls
    .map(([wall, label]) => {
      const marks = layoutStrip(model!.members, wall, spec.dims.lengthFt, spec.dims.widthFt);
      const runIn = (wall === 'S' || wall === 'N' ? spec.dims.lengthFt : spec.dims.widthFt) * 12;
      const px = 3.2;
      const wPx = runIn * px + 40;
      const ticks: string[] = [];
      for (let i = 0; i <= runIn; i += 12) {
        ticks.push(
          `<line x1="${20 + i * px}" y1="34" x2="${20 + i * px}" y2="46" stroke="#b7ad97"/>` +
            `<text x="${20 + i * px}" y="58" font-size="9" text-anchor="middle" fill="#6b6250">${i / 12}'</text>`,
        );
      }
      const markSvg = marks
        .map((mk) => {
          const x = 20 + mk.atIn * px;
          return `<g data-member="${esc(mk.memberId)}" style="cursor:pointer">
            <line x1="${x}" y1="10" x2="${x}" y2="34" stroke="#2b2419" stroke-width="1.4"/>
            <text x="${x}" y="8" font-size="10" font-weight="700" text-anchor="middle" fill="#2b2419">${mk.kind}</text>
          </g>`;
        })
        .join('');
      // Strips print unscrolled: the viewBox lets the SVG scale to the page width.
      return `<details open><summary><strong>${esc(label)}</strong> — ${marks.length} marks</summary>
        <div class="strip-scroll"><svg viewBox="0 0 ${wPx} 64" width="${wPx}" height="64" role="img" aria-label="Layout strip, ${esc(label)} wall">
          <rect x="20" y="34" width="${runIn * px}" height="12" fill="#e8dcc0" stroke="#b7ad97"/>
          ${ticks.join('')}${markSvg}
        </svg></div></details>`;
    })
    .join('');
}

// ── Keyboard (guarded: accelerators never fire while typing) ────────────────

window.addEventListener('keydown', (ev) => {
  const t = ev.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.key === 'Escape') {
    if (document.body.dataset.screen === 'build') go('#/');
    return;
  }
  const stageBtn = document.querySelector<HTMLButtonElement>(`#stages [data-stage="${ev.key === '0' ? 'all' : ev.key}"]`);
  if (/^[0-9]$/.test(ev.key) && stageBtn) {
    stageBtn.click();
    ev.preventDefault();
  }
});

render();

(window as unknown as Record<string, unknown>).__timber = {
  session: () => session,
  model: () => model,
  studio: () => studio?.debug(),
  spec: () => current?.spec,
};
