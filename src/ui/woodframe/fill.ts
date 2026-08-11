// WOODFRAME-2 — the persisted rule fill (SAP-1's doctrineFill.ts, on the injected StorageLike).
//
// An applied import must survive a reload — nobody re-imports the corrected file every session —
// and stored bytes are NEVER trusted: what is saved is the full doctrine export the apply left
// behind, and on boot it is re-run through `importDoctrine`, all-or-nothing, exactly as a fresh
// file would be. A register that changed shape under the stored fill (a renamed path, a
// tightened check) refuses it WHOLE, and the refusal is loud: the fill is removed and a notice
// says so, the same way a saved build from another version is dropped. The alternative — apply
// what still fits — is a half-world where the rules no longer agree with each other, which is
// exactly what the importer exists to prevent.
//
// `bootSession` exists because the ORDER is load-bearing: `loadSession` re-validates every
// stored build through `normalizeSpec`, whose clamps are live reads of the LIMITS leaves — so
// the fill must be in the register BEFORE the session is read, or a build that is legal under a
// corrected bound is clamped back to the shipped one on every boot.

import { exportDoctrine, importDoctrine, getAppliedManifest } from '../../woodframe/io';
import { loadSession, type LoadResult, type StorageLike } from './store';

/** Alongside 'timber2-session' — the same store, its own key, so neither write clobbers the other. */
export const FILL_KEY = 'timber2-doctrine-fill';

/**
 * Save the live register as the fill to re-apply on boot. Called after a successful apply, and
 * the return value matters: a storage failure is non-fatal to the LIVE session (the fill holds
 * either way), but the caller must say the fill will not survive a reload rather than claim
 * "saved on this device" regardless.
 */
export function saveFill(storage: StorageLike): boolean {
  try {
    storage.setItem(FILL_KEY, JSON.stringify(exportDoctrine(getAppliedManifest() ?? undefined)));
    return true;
  } catch {
    return false; // quota or private mode — the app keeps working, it just will not remember
  }
}

export function clearFill(storage: StorageLike): void {
  try {
    storage.removeItem(FILL_KEY);
  } catch {
    /* non-fatal */
  }
}

export interface FillRestore {
  applied: number;
  notices: string[]; // shown non-blocking; never thrown
}

/** Re-apply a persisted fill through the validated importer, or drop it loudly. */
export function restoreFill(storage: StorageLike): FillRestore {
  let raw: string | null = null;
  try {
    raw = storage.getItem(FILL_KEY);
  } catch {
    return { applied: 0, notices: [] }; // storage unreadable — shipped values, the safe state
  }
  if (raw === null) return { applied: 0, notices: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearFill(storage);
    return {
      applied: 0,
      notices: ['The saved rule-value fill was unreadable and has been removed — shipped values are in effect.'],
    };
  }

  const report = importDoctrine(parsed);
  if (!report.ok) {
    // All-or-nothing held: nothing applied, the register is as shipped. Drop the fill rather
    // than refuse it again on every boot forever, and say so where notices are read.
    clearFill(storage);
    return {
      applied: 0,
      notices: ["The saved rule-value fill no longer passes this version's checks and has been removed — shipped values are in effect."],
    };
  }
  return { applied: report.applied, notices: [] };
}

/** The boot sequence, in the only order that works: the fill, THEN the session it clamps. */
export function bootSession(storage: StorageLike): LoadResult {
  const fill = restoreFill(storage);
  const loaded = loadSession(storage);
  return { state: loaded.state, notices: [...fill.notices, ...loaded.notices] };
}
