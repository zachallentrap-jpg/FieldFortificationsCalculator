// Scenario management (§15) — create / name / duplicate / delete / save / load over a
// StorageAdapter. Every load path re-validates through schema.ts (never trust stored bytes).
// IDs are supplied by the caller (crypto.randomUUID in the browser) so this module stays pure
// and testable — no clock, no RNG here.

import { SCHEMA_VERSION } from '../version';
import { validateScenario, safeJsonParse, type Scenario } from './schema';
import type { StorageAdapter } from './persistence';
import type { Inputs } from '../engine/types';

const PREFIX = 'scenario:';

export function makeScenario(id: string, name: string, inputs: Inputs, savedAt?: string): Scenario {
  return { schemaVersion: SCHEMA_VERSION, id, name, inputs: { ...inputs }, ...(savedAt ? { savedAt } : {}) };
}

export function duplicateScenario(s: Scenario, newId: string, newName: string, savedAt?: string): Scenario {
  return makeScenario(newId, newName, s.inputs, savedAt);
}

export class ScenarioStore {
  constructor(private adapter: StorageAdapter) {}

  async save(s: Scenario): Promise<void> {
    await this.adapter.set(PREFIX + s.id, JSON.stringify(s));
  }

  async load(id: string): Promise<Scenario | null> {
    const raw = await this.adapter.get(PREFIX + id);
    if (raw === null) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed.ok) return null;
    const v = validateScenario(parsed.value);
    return v.ok ? v.value : null;
  }

  async remove(id: string): Promise<void> {
    await this.adapter.remove(PREFIX + id);
  }

  // Lists valid scenarios; silently skips any corrupt row rather than throwing.
  async list(): Promise<Scenario[]> {
    const keys = (await this.adapter.keys()).filter((k) => k.startsWith(PREFIX));
    const out: Scenario[] = [];
    for (const k of keys) {
      const raw = await this.adapter.get(k);
      if (raw === null) continue;
      const parsed = safeJsonParse(raw);
      if (!parsed.ok) continue;
      const v = validateScenario(parsed.value);
      if (v.ok) out.push(v.value);
    }
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
  }

  // Import from a JSON string (file upload). Accepts a single scenario object OR an array of
  // them — the app's own "Export all" writes an array, so the round-trip must accept its own
  // output (it didn't, pre-Phase-0). All-or-nothing: one bad entry rejects the file with a
  // message naming the entry, so a partial import can't silently drop scenarios.
  parseImportMany(text: string): { ok: true; value: Scenario[] } | { ok: false; error: string } {
    const parsed = safeJsonParse(text);
    if (!parsed.ok) return parsed;
    const raw = Array.isArray(parsed.value) ? parsed.value : [parsed.value];
    if (raw.length === 0) return { ok: false, error: 'File contains no scenarios.' };
    const out: Scenario[] = [];
    for (const item of raw) {
      const v = validateScenario(item);
      if (!v.ok) return { ok: false, error: 'Entry ' + (out.length + 1) + ' of ' + raw.length + ': ' + v.error };
      out.push(v.value);
    }
    return { ok: true, value: out };
  }

  exportJson(s: Scenario): string {
    return JSON.stringify(s, null, 2);
  }
}
