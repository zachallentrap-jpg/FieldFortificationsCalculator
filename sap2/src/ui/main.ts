// Composition root (blueprint §4.5): boots the static shell, wires inputs, loads
// fills through the hardened importer, computes, and updates regions through the
// retained-DOM utilities. Rendering is event-driven — one microtask flush, no
// persistent rAF anywhere. A boot failure renders a static failure page; a region
// failure latches that region and the rest keeps working.

import { compute, type ComputeInputs, type Result } from '../engine/compute';
import { drawPlan } from '../render/drawPlan';
import { drawSection } from '../render/drawSection';
import { LIGHT } from '../render/theme';
import { display } from '../render/precision';
import { watermarkState, type WatermarkState } from '../schema/watermark';
import { loadFill, type LoadResult } from '../schema/io';
import type { FillValue } from '../schema/fill';
import { computeSchemaHash } from '../schema/schemaHash';
import { LEAVES, POSITION_STRUCTURE, THREAT_STRUCTURE } from '../schema/leaves/index';
import { REVETMENT_STRUCTURE } from '../schema/leaves/materials';
import { SOIL_IDS, STANDARD_IDS, type PositionId, type RevetmentId, type SoilId, type StandardId, type ThreatId } from '../schema/ids';
import { CONDITIONS_TEXT_VERSION, needsAcceptance, recordAcceptance, type ConditionsAcceptance } from '../state/conditions';
import { browserEnv } from '../state/env';
import { $, latched, list, makeScheduler, setText, setValue, swap } from './dom';

const APP_SCHEMA_HASH = computeSchemaHash(LEAVES);
const CONDITIONS_KEY = 'sap2.conditions.v1';

interface AppState {
  inputs: ComputeInputs;
  fill: FillValue | null;
  loadInfo: (LoadResult & { ok: true }) | null;
  fillError: string;
}

const boot = (): void => {
  const env = browserEnv();
  const doc = document;
  const state: AppState = {
    inputs: {
      position: 'one_man', threat: 'ind-mtr-81', soil: 'loam', standard: 'deliberate',
      revetment: 'none', coverMaterial: 'soil', machineAssist: false,
    },
    fill: null, loadInfo: null, fillError: '',
  };

  // ---- static option lists (labels from structure tables — plain-first) ----
  const fillSelect = (sel: HTMLSelectElement, opts: readonly { value: string; label: string }[]): void => {
    sel.innerHTML = opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  };
  const inPosition = $<HTMLSelectElement>(doc, '#in-position');
  const inThreat = $<HTMLSelectElement>(doc, '#in-threat');
  const inSoil = $<HTMLSelectElement>(doc, '#in-soil');
  const inStandard = $<HTMLSelectElement>(doc, '#in-standard');
  const inRevetment = $<HTMLSelectElement>(doc, '#in-revetment');
  const inMachine = $<HTMLInputElement>(doc, '#in-machine');
  const inFill = $<HTMLInputElement>(doc, '#in-fill');

  // R0 engine scope: prism positions only — others listed disabled with the reason.
  fillSelect(inPosition, POSITION_STRUCTURE.map((p) => ({
    value: p.id, label: p.volumeModel === 'prism' ? p.label : `${p.label} (arrives later)`,
  })));
  for (const opt of Array.from(inPosition.options)) {
    const structure = POSITION_STRUCTURE.find((p) => p.id === opt.value);
    if (structure && structure.volumeModel !== 'prism') opt.disabled = true;
  }
  fillSelect(inThreat, THREAT_STRUCTURE.map((t) => ({ value: t.id, label: t.label })));
  fillSelect(inSoil, SOIL_IDS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })));
  fillSelect(inStandard, STANDARD_IDS.map((s) => ({ value: s, label: s })));
  fillSelect(inRevetment, REVETMENT_STRUCTURE.map((r) => ({ value: r.id, label: r.label })));

  // ---- regions ----
  const figSection = $(doc, '#fig-section');
  const figPlan = $(doc, '#fig-plan');
  const validationUl = $(doc, '#validation');
  const bomTable = $(doc, '#bom');
  const stagesTable = $(doc, '#stages');
  const wmStateEl = $(doc, '#wm-state');
  const wmDetailEl = $(doc, '#wm-detail');
  const hashLine = $(doc, '#hash-line');
  const fillReasons = $(doc, '#fill-reasons');

  const wmOf = (r: Result): WatermarkState => watermarkState({
    fill: state.fill, appSchemaHash: APP_SCHEMA_HASH,
    missingLeafIds: state.loadInfo?.missingLeafIds ?? [],
    artifactConeLeafIds: [...r.coneLeafIds], positionId: state.inputs.position,
    commissioning: null, revokedFillHashes: new Set(),
  });

  const renderDrawings = latched($(doc, '#drawings'), 'drawings', () => {
    const r = compute(state.inputs, state.fill);
    const ctx = { theme: LIGHT, watermark: wmOf(r) };
    swap(figSection as HTMLElement, drawSection(r, ctx));
    swap(figPlan as HTMLElement, drawPlan(r, ctx));
  });

  const renderPanels = latched($(doc, '#panels'), 'panels', () => {
    const r = compute(state.inputs, state.fill);
    list(validationUl as HTMLElement, [...r.validation], {
      key: (v) => v.code + v.blockedBy.join(','),
      create: () => doc.createElement('li'),
      update: (el, v) => {
        setText(el, `${v.severity.toUpperCase()}: ${v.leaderMessage}`);
        el.style.color = v.severity === 'error' ? '#b3261e' : v.severity === 'warning' ? '#8a4b0f' : '#5b6167';
      },
    });
    swap(bomTable as HTMLElement,
      '<tr><th>item</th><th>amount</th></tr>' +
      r.work.bom.map((b) => `<tr><td>${b.label}</td><td>${escapeHtml(display(b.quantity, b.label).text)}</td></tr>`).join(''));
    swap(stagesTable as HTMLElement,
      '<tr><th>stage</th><th>man-hours</th></tr>' +
      r.work.byStage.map((s) => `<tr><td>${s.stage}</td><td>${escapeHtml(display(s.manHours, s.stage).text)}</td></tr>`).join('') +
      `<tr><th>total</th><th>${escapeHtml(display(r.work.totalManHours, 'total').text)}</th></tr>`);
  });

  const renderBanner = latched($(doc, '#banner'), 'status banner', () => {
    const r = compute(state.inputs, state.fill);
    const wm = wmOf(r);
    setText(wmStateEl, wm.state.replace(/_/g, '-'));
    setText(wmDetailEl,
      wm.state === 'FILLED_UNCOMMISSIONED' ? `${wm.reason.replace(/-/g, ' ')} — ${wm.unfilledCount} unfilled, ${wm.unverifiedCount} unverified` :
      wm.state === 'TEMPLATE' ? 'no data loaded — drawings are shape-true, dimension-free' :
      wm.state === 'STALE' ? 'fill was made against a different schema' : '');
    setText(hashLine, `schema ${APP_SCHEMA_HASH.slice(0, 12)}…${state.fill ? ` · fill ${state.fill.contentHash.slice(0, 12)}… (${state.fill.cls})` : ''}`);
    setText(fillReasons, state.fillError);
  });

  const flush = makeScheduler(() => {
    renderDrawings();
    renderPanels();
    renderBanner();
  });

  // ---- input wiring ----
  const onChange = (): void => {
    state.inputs = {
      position: inPosition.value as PositionId,
      threat: inThreat.value as ThreatId,
      soil: inSoil.value as SoilId,
      standard: inStandard.value as StandardId,
      revetment: inRevetment.value as RevetmentId,
      coverMaterial: 'soil',
      machineAssist: inMachine.checked,
    };
    flush();
  };
  for (const el of [inPosition, inThreat, inSoil, inStandard, inRevetment, inMachine]) {
    el.addEventListener('change', onChange);
  }
  setValue(inPosition, state.inputs.position);
  setValue(inThreat, state.inputs.threat);
  setValue(inSoil, state.inputs.soil);
  setValue(inStandard, state.inputs.standard);

  inFill.addEventListener('change', () => {
    const file = inFill.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const res = loadFill(text, { expectedSchemaHash: APP_SCHEMA_HASH, allowTestClass: false });
      if (res.ok) {
        state.fill = res.fill;
        state.loadInfo = res;
        state.fillError = res.stale ? 'Loaded STALE: this fill was made against a different schema version.' : '';
        maybeGateConditions();
      } else {
        state.fill = null;
        state.loadInfo = null;
        state.fillError = `${res.kind === 'corrupt' ? 'REFUSED (integrity)' : 'REJECTED (validation)'} — nothing was applied:\n` +
          res.reasons.slice(0, 8).map((r) => `• ${r}`).join('\n') +
          (res.reasons.length > 8 ? `\n…and ${res.reasons.length - 8} more` : '');
      }
      flush();
    });
  });

  // ---- conditions gate (first run + class escalation) ----
  const overlay = $(doc, '#conditions-overlay');
  const condName = $<HTMLInputElement>(doc, '#cond-name');
  const condAccept = $<HTMLButtonElement>(doc, '#cond-accept');
  const storedAcceptance = (): ConditionsAcceptance | null => {
    const raw = env.read(CONDITIONS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as ConditionsAcceptance; } catch { return null; }
  };
  const currentClass = (): Parameters<typeof needsAcceptance>[1] => state.fill?.cls ?? 'TEMPLATE';
  const maybeGateConditions = (): void => {
    const needed = needsAcceptance(storedAcceptance(), currentClass());
    (overlay as HTMLElement).hidden = !needed;
    if (needed) condName.focus();
  };
  condName.addEventListener('input', () => { condAccept.disabled = condName.value.trim().length < 2; });
  condAccept.addEventListener('click', () => {
    const acceptance = recordAcceptance(condName.value, env.nowISO(), currentClass());
    env.write(CONDITIONS_KEY, JSON.stringify(acceptance));
    (overlay as HTMLElement).hidden = true;
  });

  if (!env.persistent) {
    state.fillError = 'Storage is unavailable — acceptances and sessions will not survive a reload (in-memory only).';
  }

  maybeGateConditions();
  flush();
  void CONDITIONS_TEXT_VERSION;
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

try {
  boot();
} catch (e) {
  document.body.innerHTML =
    `<div style="max-width:560px;margin:60px auto;font-family:system-ui,sans-serif">` +
    `<h1>SAP-2 could not start</h1><p>${escapeHtml((e as Error).message)}</p>` +
    `<p>This page runs entirely from the file you opened — reloading is safe.</p></div>`;
}
