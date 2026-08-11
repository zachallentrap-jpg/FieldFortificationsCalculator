// WOODFRAME-2 — the rule-values view (SAP-1's doctrine overlay, on the woodframe register).
//
// Every rule the toolkit builds from, read live off the register: value, unit, citation, the
// (PH) page-check state and the LS tag. The rows are READ-ONLY on purpose — a correction is a
// deliberate, attributable act made offline, with the cited page open: export the file, correct
// it there, import it back through the validated all-or-nothing importer. An in-app edit box
// would invite exactly the casual tweak that discipline exists to prevent.
//
// The render half is pure HTML-string building and the controller half takes storage and a
// regenerate callback, so the whole loop — dry-run preview, explicit apply, persist, reset —
// runs under node with no browser. The DOM layer (woodframe-scene.ts) only opens the dialog,
// wires the buttons, and hands files in and out.

import {
  allDoctrineEntries, lifeSafetyRegister, type LsEntry,
} from '../../woodframe/doctrine';
import {
  counts, getAppliedManifest, importDoctrine, resetDoctrine,
  type WoodframeFinding, type WoodframeImportReport,
} from '../../woodframe/io';
import { clearFill, saveFill } from './fill';
import type { StorageLike } from './store';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── State the dialog holds between paints ────────────────────────────────────

export interface RulesState {
  report: WoodframeImportReport | null;
  /** A dry-run-validated file awaiting the explicit Apply — nothing has mutated yet. */
  pending: unknown;
  /** After an apply: whether the fill reached device storage (null before any apply). */
  savedToDevice: boolean | null;
}

export const emptyRulesState = (): RulesState => ({ report: null, pending: null, savedToDevice: null });

// ── Controllers (DOM-free — the buttons call these and repaint) ──────────────

/**
 * A picked file is ALWAYS dry-run first: the preview is the point. A rejection here is the
 * real rejection — the same importer, the same checks — with nothing mutated either way.
 */
export function dryRunRuleFile(text: string): RulesState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      report: {
        ok: false, applied: 0, dryRun: true, rejected: [], rejectedTables: [], warnings: [],
        message: 'Not valid JSON — nothing was read.', counts: counts(),
      },
      pending: null,
      savedToDevice: null,
    };
  }
  const report = importDoctrine(parsed, { dryRun: true });
  return { report, pending: report.ok ? parsed : null, savedToDevice: null };
}

/** The explicit Apply: the real import, then persist the fill and rebuild what is open. */
export function applyRuleFile(state: RulesState, storage: StorageLike, regenerate: () => void): RulesState {
  if (state.pending === null) return state;
  const report = importDoctrine(state.pending);
  if (!report.ok) return { report, pending: null, savedToDevice: null };
  const saved = saveFill(storage);
  regenerate();
  return { report, pending: null, savedToDevice: saved };
}

/** Back to shipped: the stored fill is cleared AND the live register is reset, together. */
export function resetRuleValues(storage: StorageLike, regenerate: () => void): RulesState {
  clearFill(storage);
  resetDoctrine();
  regenerate();
  return emptyRulesState();
}

// ── Rendering ────────────────────────────────────────────────────────────────

/** A leaf value as a reader scans it: numbers plain, lists joined, tables as their JSON. */
function fmtValue(v: unknown): string {
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'number' || typeof x === 'string')) return v.join(', ');
  return JSON.stringify(v);
}

const group = (id: string): string => id.split('.')[0] ?? id;

// A finding list, capped so one bad file cannot bury the panel.
const findingList = (findings: WoodframeFinding[]): string =>
  '<ul>' + findings.slice(0, 12).map((f) => `<li>${esc(f.path)} — ${esc(f.reason)}</li>`).join('') +
  (findings.length > 12 ? `<li>…and ${findings.length - 12} more</li>` : '') + '</ul>';

// A rejection and a warning mean opposite things about what is in the register — nothing
// applied vs. it applied (or would) — so they are never rendered as one list, and table
// findings are separated again because their identifier names a whole table, not a row.
function reportBlock(state: RulesState): string {
  const report = state.report;
  if (!report) return '';
  const caption = report.ok
    ? (report.dryRun ? `Preview: ${report.applied} value(s) would apply.` : `Applied: ${report.applied} value(s).`)
    : 'Import rejected — nothing was applied.';
  const savedLine = report.ok && !report.dryRun
    ? `<div>${state.savedToDevice === false
      ? 'Device storage unavailable — the fill holds for this session and will NOT survive a reload.'
      : 'Saved on this device — it re-applies on every load, through the same checks.'}</div>`
    : '';
  const warnLabel = report.dryRun ? 'Would apply, but check' : 'Applied, but check';
  return (
    `<div class="import-report ${report.ok ? 'ok' : 'bad'}">` +
    `<strong>${esc(caption)}</strong>` +
    (report.message && !report.ok ? `<div>${esc(report.message)}</div>` : '') +
    savedLine +
    (report.rejected.length ? '<div>Values refused:</div>' + findingList(report.rejected) : '') +
    (report.rejectedTables.length
      ? '<div>Whole tables refused — these values are filled together, not one at a time:</div>' +
        findingList(report.rejectedTables)
      : '') +
    (report.warnings.length
      ? `<div class="import-warn"><strong>${warnLabel} ${report.warnings.length} value(s) — nothing here was refused:</strong>` +
        findingList(report.warnings) + '</div>'
      : '') +
    (report.dryRun && report.ok
      ? '<button type="button" class="chip chip--go" data-action="rules-apply">Apply this import</button>'
      : '') +
    '</div>'
  );
}

function rowFor(e: LsEntry, ls: ReadonlySet<string>): string {
  return (
    '<tr>' +
    `<td class="rule-path">${esc(e.id)}${ls.has(e.id) ? ' <span class="ls">LS</span>' : ''}</td>` +
    `<td class="rule-val"><code>${esc(fmtValue(e.value))}</code>${e.unit ? ` <span class="u">${esc(e.unit)}</span>` : ''}</td>` +
    `<td class="rule-cite">${esc(e.cite)}${e.ph ? ' <span class="ph">(PH)</span>' : ''}</td>` +
    '</tr>'
  );
}

export function rulesOverlay(state: RulesState): string {
  const entries = allDoctrineEntries();
  const ls = new Set(lifeSafetyRegister().map((e) => e.id));
  const c = counts();
  const fill = getAppliedManifest();

  const fillLine = fill
    ? `<p class="rules-fill">Applied rule fill <code>${esc(fill.contentHash)}</code>` +
      (fill.author ? ` by ${esc(fill.author)}` : '') + (fill.date ? ` on ${esc(fill.date)}` : '') + '.</p>'
    : '<p class="rules-fill">Shipped values — no rule fill applied.</p>';

  // Per-group page-check burn-down, from the full register.
  const groups = new Map<string, { total: number; pending: number }>();
  for (const e of entries) {
    const g = groups.get(group(e.id)) ?? { total: 0, pending: 0 };
    g.total++;
    if (e.ph) g.pending++;
    groups.set(group(e.id), g);
  }
  const groupRows = [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([g, v]) => `<tr><td>${esc(g)}</td><td class="num">${v.pending}</td><td class="num">${v.total}</td></tr>`)
    .join('');

  return (
    '<div class="rules">' +
    '<div class="rules-head"><h2>Rule values</h2>' +
    '<button type="button" class="chip" data-action="rules-close">Done</button></div>' +
    fillLine +
    '<p class="rules-note">Every rule the toolkit builds from, with its citation. Corrections are made ' +
    '<strong>offline</strong>: export the file, correct it with the cited page open, import it back. ' +
    'The import is validated all-or-nothing — one bad entry refuses the whole file — so the rows here are read-only on purpose.</p>' +
    `<p class="rules-counts">${c.total} rules · ${c.pageChecked} page-checked · ${c.pending} pending (PH) · ` +
    `${c.lifeSafety} life-safety, ${c.lifeSafetyPending} pending</p>` +
    '<div class="rules-actions">' +
    '<label class="rules-field">Author <input type="text" id="rules-author" placeholder="who is on the record"></label>' +
    '<label class="rules-field">Date <input type="text" id="rules-date" placeholder="as written on the record"></label>' +
    '<button type="button" class="chip" data-action="rules-export">Export rule file</button>' +
    '<button type="button" class="chip" data-action="rules-import">Import rule file…</button>' +
    '<button type="button" class="chip" data-action="rules-reset">Reset to shipped values</button>' +
    '</div>' +
    reportBlock(state) +
    '<table class="rules-groups"><thead><tr><th>Table</th><th class="num">Pending</th><th class="num">Total</th></tr></thead>' +
    `<tbody>${groupRows}</tbody></table>` +
    '<div class="rules-scroll"><table class="rules-table">' +
    '<thead><tr><th>Rule</th><th>Value</th><th>Citation</th></tr></thead>' +
    `<tbody>${entries.map((e) => rowFor(e, ls)).join('')}</tbody></table></div>` +
    '</div>'
  );
}
