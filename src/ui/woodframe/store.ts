// TIMBER-2 — session state (plan §5.5).
//
// Storage is INJECTED, so every rule below is node-testable without a browser. Three of them
// are the ones that actually bite in the field:
//
//   Boot revalidation — stored bytes are never trusted. A config saved by an older build, or
//   hand-edited, or truncated by a crash, is validated through the same normalizer the live
//   editor uses; anything that fails degrades to the catalog default with a visible notice
//   rather than throwing on boot and leaving a blank screen.
//
//   Commit-on-valid — a value that blocks generation stays in the CONTROL, never in the store.
//   Storage always holds a config that can be generated, so "reload the page" is always a way
//   out rather than a way to persist a broken state.
//
//   customSeq never decreases — a deleted custom-3 does not free the id for reuse, so a share
//   link or a printout naming custom-3 can never resolve to a different building later.

import type { StructureSpec } from '../../timber/spec';
import type { FamilyId } from '../../timber/catalog';
import { familyById, shippedFamilies } from '../../timber/catalog';
import { normalizeSpec } from '../../timber/normalize';

export const STORAGE_KEY = 'timber2-session';
export const SESSION_VERSION = 1;

export interface StoredBuild {
  id: string; // 'gp-frame' | 'custom-3' | …
  familyId: FamilyId;
  label?: string;
  spec: StructureSpec;
  updatedAt?: number; // stamped by the caller — the store itself stays clock-free
}

export interface SessionState {
  version: number;
  customSeq: number;
  builds: StoredBuild[];
  lastOpened?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  state: SessionState;
  notices: string[]; // shown non-blocking; never thrown
}

export function emptySession(): SessionState {
  return { version: SESSION_VERSION, customSeq: 0, builds: [] };
}

/**
 * Read and REVALIDATE. Every entry goes through the live normalizer; entries that no longer
 * describe a buildable structure are dropped with a notice naming them.
 */
export function loadSession(storage: StorageLike): LoadResult {
  const notices: string[] = [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptySession(), notices: ['Saved builds could not be read on this device.'] };
  }
  if (!raw) return { state: emptySession(), notices };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: emptySession(), notices: ['Saved builds were unreadable and have been reset.'] };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { state: emptySession(), notices: ['Saved builds were unreadable and have been reset.'] };
  }

  const obj = parsed as Partial<SessionState>;
  if (obj.version !== SESSION_VERSION) {
    return {
      state: emptySession(),
      notices: ['Saved builds were made by a different version of TIMBER and have been reset.'],
    };
  }

  const builds: StoredBuild[] = [];
  for (const entry of Array.isArray(obj.builds) ? obj.builds : []) {
    const b = entry as Partial<StoredBuild>;
    if (!b || typeof b.id !== 'string' || !b.spec || typeof b.familyId !== 'string') {
      notices.push('A saved build was incomplete and was dropped.');
      continue;
    }
    if (!familyById(b.familyId as FamilyId)) {
      notices.push(`A saved build referenced an unknown structure type (${b.familyId}) and was dropped.`);
      continue;
    }
    try {
      const { spec } = normalizeSpec(b.spec as StructureSpec);
      builds.push({ id: b.id, familyId: b.familyId as FamilyId, label: b.label, spec, updatedAt: b.updatedAt });
    } catch {
      notices.push(`Saved build "${b.label ?? b.id}" could not be rebuilt and was dropped.`);
    }
  }

  const seqFromIds = builds.reduce((max, b) => {
    const m = /^custom-(\d+)$/.exec(b.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

  return {
    state: {
      version: SESSION_VERSION,
      // Monotonic: take the larger of the stored counter and anything the ids imply, so a
      // truncated write can never hand out an id that is already in use.
      customSeq: Math.max(typeof obj.customSeq === 'number' ? obj.customSeq : 0, seqFromIds),
      builds,
      lastOpened: typeof obj.lastOpened === 'string' ? obj.lastOpened : undefined,
    },
    notices,
  };
}

export function saveSession(storage: StorageLike, state: SessionState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // quota or private mode — the app keeps working, it just will not remember
  }
}

/** Commit a build, but only when it generates. A blocking value never reaches storage. */
export function commitBuild(state: SessionState, build: StoredBuild): { state: SessionState; committed: boolean } {
  try {
    const { spec } = normalizeSpec(build.spec);
    const next = { ...build, spec };
    const builds = state.builds.some((b) => b.id === build.id)
      ? state.builds.map((b) => (b.id === build.id ? next : b))
      : [...state.builds, next];
    return { state: { ...state, builds, lastOpened: build.id }, committed: true };
  } catch {
    return { state, committed: false };
  }
}

/** Mint the next custom id. The counter only ever goes up (ids are never reused). */
export function nextCustomId(state: SessionState): { state: SessionState; id: string } {
  const seq = state.customSeq + 1;
  return { state: { ...state, customSeq: seq }, id: `custom-${seq}` };
}

export function deleteBuild(state: SessionState, id: string): SessionState {
  // customSeq deliberately untouched: deleting custom-3 must not free the id.
  return { ...state, builds: state.builds.filter((b) => b.id !== id) };
}

export function findBuild(state: SessionState, id: string): StoredBuild | undefined {
  return state.builds.find((b) => b.id === id);
}

/**
 * Unlock-to-custom (plan §5.3, gap-6). Unlocking NEVER changes family: it produces an unlocked
 * copy of the SAME structure — a tower stays a tower, a bunker stays a bunker. Only the
 * picker's Custom CARD is building-scoped.
 */
export function unlockToCustom(
  state: SessionState,
  source: StoredBuild,
): { state: SessionState; build: StoredBuild } {
  const { state: withSeq, id } = nextCustomId(state);
  const build: StoredBuild = {
    id,
    familyId: source.familyId, // family preserved — this is the whole point
    label: `${source.label ?? familyById(source.familyId)?.name ?? source.familyId} (unlocked)`,
    spec: JSON.parse(JSON.stringify(source.spec)) as StructureSpec,
  };
  const committed = commitBuild(withSeq, build);
  return { state: committed.state, build };
}

/** The resume strip: most recently touched first, capped. */
export function recentBuilds(state: SessionState, limit = 6): StoredBuild[] {
  return [...state.builds]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, limit);
}

/** A fresh build from a catalog card. */
export function buildFromFamily(familyId: FamilyId): StoredBuild | undefined {
  const family = shippedFamilies().find((f) => f.id === familyId);
  if (!family) return undefined;
  return {
    id: family.id,
    familyId: family.id,
    label: family.name,
    spec: JSON.parse(JSON.stringify(family.preset)) as StructureSpec,
  };
}
