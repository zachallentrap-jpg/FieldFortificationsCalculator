// Doctrine import/export (§8, §14). exportDoctrine() serializes every Provenance leaf so
// a qualified user can fill real values OFFLINE and reload. importDoctrine() validates
// strictly, rejects prototype-pollution keys and newer versions, then updates matching
// live leaves in place (value/status/source). The banner recomputes from the mutated
// statuses via the registry. Never trusts a file blindly.

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

export interface DoctrineExport {
  doctrineVersion: number;
  note: string;
  entries: DoctrineEntryDTO[];
}

export interface DoctrineImportReport {
  ok: boolean;
  applied: number;
  rejected: { path: string; reason: string }[];
  message?: string;
  counts: Counts;
}

export function exportDoctrine(): DoctrineExport {
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
  return {
    doctrineVersion: DOCTRINE_VERSION,
    note: 'SAP-1 doctrine export — values are ILLUSTRATIVE PLACEHOLDERS unless status is DOCTRINE. NOT FOR FIELD USE.',
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
  rejected: [],
  message,
  counts: counts(),
});

export function importDoctrine(raw: unknown, opts?: { maxEntries?: number }): DoctrineImportReport {
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
  let applied = 0;

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
    if (typeof e['value'] !== typeof target.value) {
      rejected.push({ path, reason: 'value type mismatch' });
      continue;
    }
    target.value = e['value'];
    target.status = status;
    if (typeof e['source'] === 'string') target.source = e['source'];
    applied++;
  }

  return { ok: true, applied, rejected, counts: counts() };
}
