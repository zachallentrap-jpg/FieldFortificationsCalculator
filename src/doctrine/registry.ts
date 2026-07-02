// Provenance registry (§8). Deep-walks the doctrine tables once at index load, holding
// a reference to every Provenance leaf by dotted path. Feeds the data-driven
// "NOT FOR FIELD USE" banner and the placeholderReport (§2.5). Because it stores the
// live leaf objects (not copies), a validated doctrine import (io.ts) that mutates a
// leaf's value/status/source is reflected here immediately — counts() recomputes.

import type { Provenance } from './types';

export interface RegEntry {
  path: string;
  value: unknown; // current live value (for the fill-table UI)
  status: Provenance<unknown>['status'];
  source: string;
  safetyCritical: boolean;
  unit?: string;
  note?: string;
}

export interface Counts {
  total: number;
  doctrine: number;
  placeholder: number;
  safetyCritical: number;
  safetyCriticalRemaining: number;
}

const entries = new Map<string, Provenance<unknown>>();

export function isProvenance(v: unknown): v is Provenance<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    'value' in v &&
    'status' in v &&
    'source' in v &&
    ((v as { status: unknown }).status === 'PLACEHOLDER' ||
      (v as { status: unknown }).status === 'DOCTRINE')
  );
}

export function register(path: string, prov: Provenance<unknown>): void {
  entries.set(path, prov);
}

// Recursively register every Provenance leaf under `obj`, keyed by dotted path.
// Stops descending at Provenance leaves so a Provenance whose value is structured
// is still registered as a single unit.
export function registerTree(prefix: string, obj: unknown): void {
  if (isProvenance(obj)) {
    register(prefix, obj);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => registerTree(prefix + '[' + i + ']', v));
    return;
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const [k, v] of Object.entries(obj)) {
      registerTree(prefix === '' ? k : prefix + '.' + k, v);
    }
  }
}

export function reset(): void {
  entries.clear();
}

export function getByPath(path: string): Provenance<unknown> | undefined {
  return entries.get(path);
}

export function all(): RegEntry[] {
  const out: RegEntry[] = [];
  for (const [path, prov] of entries) {
    const entry: RegEntry = {
      path,
      value: prov.value,
      status: prov.status,
      source: prov.source,
      safetyCritical: prov.safetyCritical === true,
    };
    if (prov.unit !== undefined) entry.unit = prov.unit;
    if (prov.note !== undefined) entry.note = prov.note;
    out.push(entry);
  }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

export function counts(): Counts {
  let doctrine = 0;
  let placeholder = 0;
  let safetyCritical = 0;
  let safetyCriticalRemaining = 0;
  for (const prov of entries.values()) {
    if (prov.status === 'DOCTRINE') doctrine++;
    else placeholder++;
    if (prov.safetyCritical === true) {
      safetyCritical++;
      if (prov.status !== 'DOCTRINE') safetyCriticalRemaining++;
    }
  }
  return { total: entries.size, doctrine, placeholder, safetyCritical, safetyCriticalRemaining };
}
