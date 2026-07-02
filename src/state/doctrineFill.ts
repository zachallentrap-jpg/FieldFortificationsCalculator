// Persist the applied doctrine fill so an import survives a reload — the S-3 must not re-import
// the CUI file every session (a non-starter). We store the exact DoctrineExport JSON the fill
// produced, then on boot re-run it through the SAME validated importer (never trust stored
// bytes: a corrupted row is rejected all-or-nothing exactly as a fresh file would be).

import { exportDoctrine, importDoctrine } from '../doctrine/io';
import type { StorageAdapter } from './persistence';

const KEY = 'doctrine-fill';

// Save the current live doctrine state as a fill snapshot. Called after any successful apply.
export async function saveFill(adapter: StorageAdapter, manifest?: { author?: string; date?: string }): Promise<void> {
  try {
    await adapter.set(KEY, JSON.stringify(exportDoctrine(manifest)));
  } catch {
    /* storage failure is non-fatal — the fill still applies for this session */
  }
}

export async function clearFill(adapter: StorageAdapter): Promise<void> {
  try {
    await adapter.remove(KEY);
  } catch {
    /* non-fatal */
  }
}

// Re-apply a persisted fill on boot. Returns the number of values applied (0 if none/invalid).
// Re-validates through importDoctrine, so a stored file that no longer matches the registry
// (renamed/removed paths, out-of-range values) is rejected rather than corrupting doctrine.
export async function restoreFill(adapter: StorageAdapter): Promise<number> {
  let raw: string | null = null;
  try {
    raw = await adapter.get(KEY);
  } catch {
    return 0;
  }
  if (raw === null) return 0;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 0;
  }
  const report = importDoctrine(parsed);
  return report.ok ? report.applied : 0;
}
