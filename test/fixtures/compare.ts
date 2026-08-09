// TIMBER-2 — the compat comparator (plan TD13).
//
// Exact deep-equal INCLUDING array order first. Only if that fails does a 1e-12 epsilon pass
// run, and it prints a per-field diff either way. The project kill criterion (§9 R1) applies
// only past epsilon: benign IEEE wobble from an extraction that reassociated arithmetic must
// not read the same as a real geometry regression.

import { canonicalJson } from './goldenFormat';

export interface CompareResult {
  exact: boolean;
  withinEpsilon: boolean;
  diffs: string[];
}

const EPS = 1e-12;

function near(a: number, b: number): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= EPS * scale;
}

function walk(path: string, a: unknown, b: unknown, diffs: string[], epsilonOk: { value: boolean }): void {
  if (diffs.length >= 40) return; // enough to diagnose; the assert prints them all
  if (typeof a === 'number' && typeof b === 'number') {
    if (a !== b) {
      diffs.push(`${path}: ${a} !== ${b}${near(a, b) ? ' (within 1e-12)' : ' (PAST EPSILON)'}`);
      if (!near(a, b)) epsilonOk.value = false;
    }
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      diffs.push(`${path}: array/non-array mismatch`);
      epsilonOk.value = false;
      return;
    }
    if (a.length !== b.length) {
      diffs.push(`${path}: length ${a.length} !== ${b.length}`);
      epsilonOk.value = false;
      return;
    }
    for (let i = 0; i < a.length; i++) walk(`${path}[${i}]`, a[i], b[i], diffs, epsilonOk);
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined).sort();
    const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined).sort();
    for (const k of new Set([...ka, ...kb])) {
      if (!ka.includes(k) || !kb.includes(k)) {
        diffs.push(`${path}.${k}: present on ${ka.includes(k) ? 'expected' : 'actual'} only`);
        epsilonOk.value = false;
        continue;
      }
      walk(`${path}.${k}`, (a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], diffs, epsilonOk);
    }
    return;
  }
  if (a !== b) {
    diffs.push(`${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    epsilonOk.value = false;
  }
}

/** `expected` is the committed golden; `actual` is what the engine produced now. */
export function compareSnapshots(expected: unknown, actual: unknown): CompareResult {
  if (canonicalJson(expected) === canonicalJson(actual)) {
    return { exact: true, withinEpsilon: true, diffs: [] };
  }
  const diffs: string[] = [];
  const epsilonOk = { value: true };
  walk('$', expected, actual, diffs, epsilonOk);
  return { exact: false, withinEpsilon: epsilonOk.value, diffs };
}

/** Assertion message that names the kill criterion when a diff is past epsilon. */
export function compatMessage(name: string, r: CompareResult): string {
  const head = r.withinEpsilon
    ? `${name}: differs from the golden but every numeric diff is within 1e-12 (benign FP wobble)`
    : `${name}: DIFFERS PAST EPSILON — compat lock broken (plan §9 R1: stop, re-plan the extraction seam)`;
  return `${head}\n  ` + r.diffs.slice(0, 40).join('\n  ');
}
