// Working-session persistence (Phase 0 trust sprint, docs/EXECUTION_PLAN.md). The CURRENT
// inputs, mission set, compare set, and on-hand quantities survive a tab eviction or reload —
// a plan built on a phone must not vanish because the browser reclaimed the tab. Everything
// restored goes back through schema.ts validation (never trust stored bytes, §14), and any
// invalid piece degrades to its default instead of poisoning the boot. Pure: storage is
// injected (localStorage in the browser, a Map-backed fake in tests).

import { SCHEMA_VERSION } from '../version';
import { validateInputs, safeJsonParse } from './schema';
import type { Inputs, MissionItem } from '../engine/types';

export const SESSION_KEY = 'sap1-session';

// The subset of the Storage interface we use — lets tests inject a plain object.
export interface KVSync {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SessionSnapshot {
  inputs: Inputs;
  missionSet: MissionItem[];
  comparisonSet: Inputs[];
  onHand: Record<string, number>;
}

export function saveSession(storage: KVSync, snap: SessionSnapshot): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...snap }));
  } catch {
    /* quota/private-mode failures are non-fatal — the app keeps working, just without restore */
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function restoreSession(storage: KVSync): SessionSnapshot | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const parsed = safeJsonParse(raw);
  if (!parsed.ok || !isObj(parsed.value)) return null;
  const o = parsed.value;

  const inputs = validateInputs(o['inputs']);
  if (!inputs.ok) return null; // without valid inputs there is no session worth restoring

  const comparisonSet: Inputs[] = [];
  if (Array.isArray(o['comparisonSet'])) {
    for (const c of o['comparisonSet']) {
      const v = validateInputs(c);
      if (v.ok) comparisonSet.push(v.value); // skip invalid entries, keep the rest
    }
  }

  const missionSet: MissionItem[] = [];
  if (Array.isArray(o['missionSet'])) {
    for (const m of o['missionSet']) {
      if (!isObj(m)) continue;
      const v = validateInputs(m['inputs']);
      if (v.ok) missionSet.push({ inputs: v.value, ...(typeof m['label'] === 'string' ? { label: m['label'] } : {}) });
    }
  }

  const onHand: Record<string, number> = {};
  if (isObj(o['onHand'])) {
    for (const [k, v] of Object.entries(o['onHand'])) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) onHand[k] = v;
    }
  }

  return { inputs: inputs.value, missionSet, comparisonSet, onHand };
}
