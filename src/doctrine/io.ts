// Doctrine import/export (§8, §14) — the keystone of the placeholder regime. exportDoctrine()
// serializes every Provenance leaf so a qualified user can fill real values OFFLINE and reload.
// importDoctrine() validates strictly and applies ALL-OR-NOTHING: if any entry is rejected the
// whole file is refused and NOTHING is mutated — safety-critical data must never land half-
// applied. A dry run validates without mutating so the UI can preview. Every applied fill
// carries a manifest (content hash + optional author/date) so a DOCTRINE stamp is attributable
// evidence, printed on the job sheet. Never trusts a file blindly.

import { DOCTRINE_VERSION } from '../version';
import { all, getByPath, counts } from './registry';
import type { Counts } from './registry';

export interface DoctrineEntryDTO {
  path: string;
  value: unknown;
  unit?: string;
  status: 'PLACEHOLDER' | 'DOCTRINE';
  source: string;
  safetyCritical?: boolean;
  note?: string;
}

export interface DoctrineManifest {
  author?: string;
  date?: string; // caller-supplied (io stays clock-free)
  contentHash: string; // deterministic hash of the applied entries — change detection + attribution
}

export interface DoctrineExport {
  doctrineVersion: number;
  note: string;
  manifest?: DoctrineManifest;
  entries: DoctrineEntryDTO[];
}

export interface DoctrineImportReport {
  ok: boolean;
  applied: number; // entries that were (or in a dry run, would be) applied
  dryRun: boolean;
  rejected: { path: string; reason: string }[];
  message?: string;
  manifest?: DoctrineManifest; // echoed from the file (with a freshly computed contentHash)
  counts: Counts;
}

// Numeric sanity bound — the same 0 ≤ v < 1000 the doctrine-integrity test enforces on a
// fresh build. A filled value outside it is a transcription error, not real doctrine.
const MAX_MAGNITUDE = 1000;

// FNV-1a over the canonical (path|value|status) list — deterministic, dependency-free. Used
// only for attribution / change detection, never for security, so a fast non-crypto hash is fine.
function contentHash(entries: DoctrineEntryDTO[]): string {
  const canonical = entries
    .map((e) => e.path + '|' + JSON.stringify(e.value) + '|' + e.status)
    .sort()
    .join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// The manifest of the fill currently applied to the live doctrine (null until an import lands).
// Read by the Status panel and the job sheet so every DOCTRINE stamp is attributable.
let appliedFill: DoctrineManifest | null = null;
export function getFillState(): DoctrineManifest | null {
  return appliedFill;
}
export function resetFillState(): void {
  appliedFill = null;
}

export function exportDoctrine(manifest?: { author?: string; date?: string }): DoctrineExport {
  const entries: DoctrineEntryDTO[] = [];
  for (const e of all()) {
    const p = getByPath(e.path);
    if (!p) continue;
    const dto: DoctrineEntryDTO = { path: e.path, value: p.value, status: p.status, source: p.source };
    if (p.unit !== undefined) dto.unit = p.unit;
    if (p.safetyCritical === true) dto.safetyCritical = true;
    if (p.note !== undefined) dto.note = p.note;
    entries.push(dto);
  }
  const m: DoctrineManifest = { contentHash: contentHash(entries) };
  if (manifest?.author) m.author = manifest.author;
  if (manifest?.date) m.date = manifest.date;
  return {
    doctrineVersion: DOCTRINE_VERSION,
    note: 'SAP-1 doctrine export — values are ILLUSTRATIVE PLACEHOLDERS unless status is DOCTRINE. NOT FOR FIELD USE.',
    manifest: m,
    entries,
  };
}

const DANGEROUS = new Set(['__proto__', 'prototype', 'constructor']);

function hasDangerousKeys(v: unknown, depth = 0): boolean {
  if (depth > 8 || v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some((x) => hasDangerousKeys(x, depth + 1));
  for (const [k, val] of Object.entries(v)) {
    if (DANGEROUS.has(k)) return true;
    if (hasDangerousKeys(val, depth + 1)) return true;
  }
  return false;
}

const fail = (message: string): DoctrineImportReport => ({
  ok: false,
  applied: 0,
  dryRun: false,
  rejected: [],
  message,
  counts: counts(),
});

// One staged mutation, validated but not yet applied. All-or-nothing: we build the whole list
// first and only touch live leaves once every entry has passed.
interface Staged {
  path: string;
  value: unknown;
  status: 'PLACEHOLDER' | 'DOCTRINE';
  source: string;
  note: string | undefined;
}

export function importDoctrine(raw: unknown, opts?: { maxEntries?: number; dryRun?: boolean }): DoctrineImportReport {
  const dryRun = opts?.dryRun === true;
  if (typeof raw !== 'object' || raw === null) return fail('Not a doctrine object.');
  if (hasDangerousKeys(raw)) return fail('Rejected: file contains prototype-pollution keys.');

  const obj = raw as Record<string, unknown>;
  const dv = obj['doctrineVersion'];
  if (typeof dv !== 'number') return fail('Missing or invalid doctrineVersion.');
  if (dv > DOCTRINE_VERSION) {
    return fail('Doctrine file is version ' + dv + ', newer than this app supports (' + DOCTRINE_VERSION + ').');
  }
  // dv <= current: identity migration (v1). Future versions add migration steps here.

  const entries = obj['entries'];
  if (!Array.isArray(entries)) return fail('Missing entries[].');
  const max = opts?.maxEntries ?? 5000;
  if (entries.length > max) return fail('Too many entries (' + entries.length + ' > ' + max + ').');

  const rejected: { path: string; reason: string }[] = [];
  const staged: Staged[] = [];

  for (const item of entries) {
    if (typeof item !== 'object' || item === null) {
      rejected.push({ path: '?', reason: 'entry is not an object' });
      continue;
    }
    const e = item as Record<string, unknown>;
    const path = e['path'];
    if (typeof path !== 'string') {
      rejected.push({ path: '?', reason: 'missing path' });
      continue;
    }
    const target = getByPath(path);
    if (!target) {
      rejected.push({ path, reason: 'unknown path' });
      continue;
    }
    const status = e['status'];
    if (status !== 'PLACEHOLDER' && status !== 'DOCTRINE') {
      rejected.push({ path, reason: 'invalid status' });
      continue;
    }
    const value = e['value'];
    if (typeof value !== typeof target.value) {
      rejected.push({ path, reason: 'value type mismatch' });
      continue;
    }
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value >= MAX_MAGNITUDE)) {
      rejected.push({ path, reason: 'number out of range (0 ≤ v < ' + MAX_MAGNITUDE + ')' });
      continue;
    }
    const source = typeof e['source'] === 'string' ? e['source'] : target.source;
    // A DOCTRINE stamp with a TODO source is a contradiction — it would defeat the very
    // check the regime exists to enforce (doctrine-integrity: no DOCTRINE carries a TODO).
    if (status === 'DOCTRINE' && /todo/i.test(source)) {
      rejected.push({ path, reason: 'DOCTRINE status with a TODO source' });
      continue;
    }
    const note = typeof e['note'] === 'string' ? e['note'] : target.note;
    staged.push({ path, value, status, source, note });
  }

  // All-or-nothing: any rejection refuses the ENTIRE file (safety-critical data must never
  // land half-applied). Nothing has been mutated yet.
  if (rejected.length > 0) {
    return { ok: false, applied: 0, dryRun, rejected, message: 'Rejected — ' + rejected.length + ' entr(y/ies) failed validation; nothing was applied.', counts: counts() };
  }

  const manifest: DoctrineManifest = { contentHash: contentHash(entries as DoctrineEntryDTO[]) };
  const rawManifest = obj['manifest'];
  if (typeof rawManifest === 'object' && rawManifest !== null) {
    const rm = rawManifest as Record<string, unknown>;
    if (typeof rm['author'] === 'string') manifest.author = rm['author'];
    if (typeof rm['date'] === 'string') manifest.date = rm['date'];
  }

  if (dryRun) {
    return { ok: true, applied: staged.length, dryRun: true, rejected: [], manifest, counts: counts() };
  }

  // Commit: mutate live leaves in place (value/status/source/note only — unit and
  // safetyCritical are structural and never come from a file).
  for (const s of staged) {
    const target = getByPath(s.path)!;
    target.value = s.value;
    target.status = s.status;
    target.source = s.source;
    if (s.note !== undefined) target.note = s.note;
  }
  appliedFill = manifest;

  return { ok: true, applied: staged.length, dryRun: false, rejected: [], manifest, counts: counts() };
}
