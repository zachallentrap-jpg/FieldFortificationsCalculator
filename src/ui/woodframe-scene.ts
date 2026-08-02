// TIMBER-2 — the boot file. Wires the router, the picker and the workbench together and owns
// nothing else: every behavior lives in `src/ui/woodframe/*`, and everything that can be pure
// is pure and node-tested (plan §4.1, R9).
//
// The app opens on the PICKER (mandate #3). Choosing a card, or resuming a saved build, routes
// to the workbench, where the config panel edits a spec and the scene is regenerated from it —
// the scene never edits itself, so the model on screen is always exactly what the spec says.

import { generateStructure, type StructureModel } from '../timber/families/index';
import type { StructureSpec, BuildingSpec, RoofSpec, FoundationSpec } from '../timber/spec';
import { normalizeSpec } from '../timber/normalize';
import { familyById, type FamilyId } from '../timber/catalog';
import { onPropAssetsReady } from './three-viewer';
import { renderPicker } from './woodframe/picker';
import { createStudio, type StudioHandles } from './woodframe/studio';
import { configSchemaFor, type PanelRow } from './woodframe/config';
import { layoutStrip } from '../timber/elevation';
import {
  loadSession, saveSession, commitBuild, buildFromFamily, findBuild, nextCustomId,
  unlockToCustom, recentBuilds, type SessionState, type StoredBuild,
} from './woodframe/store';
import { parseRoute, routeToHash, decodeSpec, encodeSpec } from './woodframe/router';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
          <button class="chip" id="printBtn" type="button">Print</button>
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
        </aside>
      </main>
      <section class="strips">
        <h2>Plate layout strips — the marks to pencil on the plate (X stud · K king · J jack · C cripple)</h2>
        <div id="stripsBody"></div>
      </section>
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
  document.getElementById('printBtn')!.addEventListener('click', () => window.print());
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

  panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-path]').forEach((el) => {
    el.addEventListener('change', () => {
      const path = el.dataset.path!;
      const spec = current!.spec as BuildingSpec;
      if (path === 'roof.kind') setRoofKind(spec, (el as HTMLSelectElement).value as RoofSpec['kind']);
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
      } else setPath(spec, path, (el as HTMLSelectElement).value);
      regenerate();
      renderConfigPanel();
    });
  });
  renderOpeningsEditor();
}

function renderOpeningsEditor(): void {
  const host = document.getElementById('openingsEditor');
  if (!host || !current) return;
  const spec = current.spec as BuildingSpec;
  const story = spec.stories?.[0];
  if (!story) return;
  const walls: [string, string][] = [['S', 'Front (S)'], ['N', 'Rear (N)'], ['E', 'Right (E)'], ['W', 'Left (W)']];
  host.innerHTML = walls
    .map(([w, label]) => {
      const list = story.openings[w as 'S'] ?? [];
      const rows = list
        .map(
          (o, i) => `<div class="op" data-wall="${w}" data-i="${i}">
            <select data-op="kind">${['door', 'window', 'vent', 'screen', 'hatch'].map((k) => `<option${o.kind === k ? ' selected' : ''}>${k}</option>`).join('')}</select>
            <input type="number" data-op="offsetFt" value="${o.offsetFt}" step="0.25" inputmode="decimal" aria-label="offset" />
            <input type="number" data-op="widthFt" value="${o.widthFt}" step="0.25" inputmode="decimal" aria-label="width" />
            <input type="number" data-op="heightFt" value="${o.heightFt}" step="0.25" inputmode="decimal" aria-label="height" />
            <input type="number" data-op="sillHeightFt" value="${o.sillHeightFt}" step="0.25" inputmode="decimal" aria-label="sill" />
            <button data-op="remove" type="button" aria-label="Remove opening">×</button>
          </div>`,
        )
        .join('');
      return `<div class="op-wall"><h4>${esc(label)}</h4>
        <div class="op-head"><span>type</span><span>from left</span><span>width</span><span>height</span><span>sill</span><span></span></div>
        ${rows}
        <button class="chip add" data-add="${w}" type="button">+ add opening</button></div>`;
    })
    .join('');

  host.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((el) => {
    el.addEventListener('click', () => {
      const w = el.dataset.add as 'S';
      const list = story.openings[w] ?? [];
      story.openings[w] = [...list, { kind: 'window', offsetFt: 2, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }];
      regenerate();
      renderConfigPanel();
    });
  });
  host.querySelectorAll<HTMLElement>('.op').forEach((opEl) => {
    const w = opEl.dataset.wall as 'S';
    const i = Number(opEl.dataset.i);
    opEl.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-op]').forEach((field) => {
      if (field.dataset.op === 'remove') return;
      field.addEventListener('change', () => {
        const list = story.openings[w]!;
        const key = field.dataset.op as 'offsetFt';
        const value = field instanceof HTMLSelectElement ? field.value : Number(field.value);
        (list[i] as unknown as Record<string, unknown>)[key] = value;
        regenerate();
      });
    });
    opEl.querySelector<HTMLButtonElement>('[data-op="remove"]')!.addEventListener('click', () => {
      story.openings[w] = (story.openings[w] ?? []).filter((_, k) => k !== i);
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
