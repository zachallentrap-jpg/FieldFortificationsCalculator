// Import safety (§14) — never trust a file. Validates structure and types strictly, caps
// file size, rejects prototype-pollution keys, and rejects unknown/newer schemaVersion with
// a clear message. Provides an identity migration for v1 and a hook for future versions.
// Pure; no I/O. Used for scenario JSON import and (shape-wise) doctrine import.

import { SCHEMA_VERSION } from '../version';
import type { Inputs } from '../engine/types';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_BYTES = 512 * 1024; // 512 KB cap on any imported file
const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);
const STANDARDS = new Set(['hasty', 'deliberate', 'reinforced']);
const UNITS = new Set(['imperial', 'metric']);

// Recursively reject prototype-pollution keys anywhere in the parsed structure.
function hasDangerousKey(v: unknown, depth = 0): boolean {
  if (depth > 20 || v === null || typeof v !== 'object') return false;
  for (const k of Object.keys(v as Record<string, unknown>)) {
    if (DANGEROUS.has(k)) return true;
    if (hasDangerousKey((v as Record<string, unknown>)[k], depth + 1)) return true;
  }
  return false;
}

export function safeJsonParse(text: string): Parsed<unknown> {
  if (typeof text !== 'string') return { ok: false, error: 'Not text.' };
  if (text.length > MAX_BYTES) return { ok: false, error: 'File too large (max ' + MAX_BYTES / 1024 + ' KB).' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  if (hasDangerousKey(parsed)) return { ok: false, error: 'File contains disallowed keys (prototype pollution).' };
  return { ok: true, value: parsed };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Version gate + migration hook. v1 is identity; a newer version is refused, an older version
// would be migrated forward here.
function migrateInputsVersion(o: Record<string, unknown>): Parsed<Record<string, unknown>> {
  const v = o['schemaVersion'];
  if (!isNum(v)) return { ok: false, error: 'Missing or invalid schemaVersion.' };
  if (v > SCHEMA_VERSION) return { ok: false, error: 'File is from a newer version (schema ' + v + '); update the app first.' };
  // Only v1 exists → identity. Future: chain migrations up to SCHEMA_VERSION here.
  return { ok: true, value: o };
}

export function validateInputs(raw: unknown): Parsed<Inputs> {
  if (!isObj(raw)) return { ok: false, error: 'Expected an inputs object.' };
  const mig = migrateInputsVersion(raw);
  if (!mig.ok) return mig;
  const o = mig.value;

  const strFields = ['positionType', 'soil', 'threat', 'revetment'] as const;
  for (const f of strFields) if (!isStr(o[f])) return { ok: false, error: 'Field "' + f + '" must be a string.' };
  if (!isStr(o['standard']) || !STANDARDS.has(o['standard'])) return { ok: false, error: 'Invalid "standard".' };
  if (!isStr(o['unit']) || !UNITS.has(o['unit'])) return { ok: false, error: 'Invalid "unit".' };

  const boolFields = ['overheadCover', 'sump', 'firingStep', 'camouflage', 'machineAssist'] as const;
  for (const f of boolFields) if (!isBool(o[f])) return { ok: false, error: 'Field "' + f + '" must be a boolean.' };
  if (!isNum(o['count']) || !isNum(o['teamSize'])) return { ok: false, error: 'count and teamSize must be numbers.' };

  let sectorAzimuths: Inputs['sectorAzimuths'];
  if (o['sectorAzimuths'] !== undefined) {
    const s = o['sectorAzimuths'];
    if (!isObj(s) || !isNum(s['leftDeg']) || !isNum(s['rightDeg'])) return { ok: false, error: 'Invalid sectorAzimuths.' };
    sectorAzimuths = { leftDeg: s['leftDeg'], rightDeg: s['rightDeg'] };
  }

  const value: Inputs = {
    schemaVersion: SCHEMA_VERSION,
    positionType: o['positionType'] as string,
    standard: o['standard'] as Inputs['standard'],
    soil: o['soil'] as string,
    threat: o['threat'] as string,
    overheadCover: o['overheadCover'] as boolean,
    revetment: o['revetment'] as string,
    sump: o['sump'] as boolean,
    firingStep: o['firingStep'] as boolean,
    camouflage: o['camouflage'] as boolean,
    machineAssist: o['machineAssist'] as boolean,
    count: o['count'] as number,
    teamSize: o['teamSize'] as number,
    unit: o['unit'] as Inputs['unit'],
    ...(sectorAzimuths ? { sectorAzimuths } : {}),
  };
  return { ok: true, value };
}

export interface Scenario {
  schemaVersion: number;
  id: string;
  name: string;
  inputs: Inputs;
  savedAt?: string;
}

export function validateScenario(raw: unknown): Parsed<Scenario> {
  if (!isObj(raw)) return { ok: false, error: 'Expected a scenario object.' };
  if (!isStr(raw['id']) || !isStr(raw['name'])) return { ok: false, error: 'Scenario needs id and name.' };
  const inner = validateInputs(raw['inputs']);
  if (!inner.ok) return inner;
  return {
    ok: true,
    value: {
      schemaVersion: SCHEMA_VERSION,
      id: raw['id'],
      name: raw['name'],
      inputs: inner.value,
      ...(isStr(raw['savedAt']) ? { savedAt: raw['savedAt'] } : {}),
    },
  };
}
