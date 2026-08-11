// Doctrine import/export (§8, §14) — the keystone of the placeholder regime. exportDoctrine()
// serializes every Provenance leaf so a qualified user can fill real values OFFLINE and reload.
// importDoctrine() validates strictly and applies ALL-OR-NOTHING: if any entry is rejected the
// whole file is refused and NOTHING is mutated — safety-critical data must never land half-
// applied. A dry run validates without mutating so the UI can preview. Every applied fill
// carries a manifest (content hash + optional author/date) so a DOCTRINE stamp is attributable
// evidence, printed on the job sheet. Never trusts a file blindly.
//
// Validation is per-entry AND whole-table: a couple of tables are read by their ORDER or their
// SUM rather than value by value, so those invariants are checked against the table as it would
// stand after the file lands — before anything commits, so a violation still refuses the whole
// file. Fills that are merely doctrinally odd (a bigger round wanting less cover) are reported
// as warnings and applied; the importer refuses what would break the engine, not what disagrees
// with expectation.

import { DOCTRINE_VERSION } from '../version';
import { all, getByPath, counts } from './registry';
import { shielding, shieldMaterials, spanSizes, threats } from './protection';
import { excavationSplit } from './stages';
import type { Counts } from './registry';
import type { Provenance } from './types';

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

export interface DoctrineFinding {
  path: string; // a registry path — except in rejectedTables, where it names a whole table
  reason: string;
}

export interface DoctrineImportReport {
  ok: boolean;
  applied: number; // entries that were (or in a dry run, would be) applied
  dryRun: boolean;
  rejected: DoctrineFinding[]; // per-ENTRY findings — each `path` addresses a row of the fill table
  // Whole-TABLE findings: an invariant that several leaves hold together, so no single row is
  // the culprit and `path` names the table. Kept apart from `rejected` so a reader is never
  // pointed at a row identifier that matches nothing they can edit.
  rejectedTables: DoctrineFinding[];
  warnings: DoctrineFinding[]; // applied, but the filler should look at them (see plausibility below)
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
    note: 'SAP-1 doctrine export — status is PLACEHOLDER unless confirmed and re-imported as DOCTRINE.',
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
  rejectedTables: [],
  warnings: [],
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

// A dry run must PREVIEW the counts an apply would actually produce, not just echo the
// current (unmutated) state under the same field name — the two used to be silently
// different (counts() called before vs. after the commit loop), which would have made a
// dry-run preview lie the moment anything ever read report.counts.
function previewCounts(staged: Staged[]): Counts {
  const overrides = new Map(staged.map((s) => [s.path, s.status]));
  let doctrine = 0, placeholder = 0, safetyCritical = 0, safetyCriticalRemaining = 0;
  for (const e of all()) {
    const status = overrides.get(e.path) ?? e.status;
    if (status === 'DOCTRINE') doctrine++;
    else placeholder++;
    if (e.safetyCritical) {
      safetyCritical++;
      if (status !== 'DOCTRINE') safetyCriticalRemaining++;
    }
  }
  return { total: all().length, doctrine, placeholder, safetyCritical, safetyCriticalRemaining };
}

// Sum tolerance for the stage partition — float noise on four decimals is ~1e-16, so this is
// several orders of magnitude of headroom and still far tighter than any share a filler could
// mistype.
const SUM_TOLERANCE = 1e-9;

// A view of the doctrine as it WOULD stand after this file lands: the staged value where the
// file supplies one, the live value everywhere else. The whole-table checks below have to run
// against that view — a file that scrambles one row is only detectable against the rows it
// does not touch — and they run BEFORE anything is mutated, so a violation can still refuse
// the whole file.
interface Prospective {
  valueOf: (leaf: Provenance<number>) => number;
  pathOf: (leaf: Provenance<number>) => string;
}

function prospective(staged: Staged[]): Prospective {
  const byLeaf = new Map<Provenance<unknown>, unknown>();
  for (const s of staged) {
    const leaf = getByPath(s.path);
    if (leaf) byLeaf.set(leaf, s.value);
  }
  const paths = new Map<Provenance<unknown>, string>();
  for (const e of all()) {
    const leaf = getByPath(e.path);
    if (leaf) paths.set(leaf, e.path);
  }
  return {
    valueOf: (leaf) => {
      const v = byLeaf.get(leaf as Provenance<unknown>);
      return typeof v === 'number' ? v : leaf.value;
    },
    pathOf: (leaf) => paths.get(leaf as Provenance<unknown>) ?? '(unregistered leaf)',
  };
}

// ENGINE-CORRECTNESS invariants — not doctrinal judgments. Two tables are read by their ORDER
// or their SUM, not just by their values, and a fill that breaks either passes every per-entry
// check while silently corrupting the answer:
//   · stringerSizeForSpan is a FIRST-FIT walk over spanSizes. With the limits out of order, a
//     row that covers a short span sits behind a longer one and is never reached — an 8-ft
//     opening gets billed a 4×4. That is an undersized member on the safety-critical span path.
//   · the stage clock PARTITIONS one man-hour total by excavationSplit. Anything but 1.0
//     invents or loses labor in the per-stage breakdown with no other symptom.
// Both refuse the whole file, like every other rejection here. They differ in what a reader can
// be pointed at: a span limit out of order is one row's value, while the partition is a property
// of four shares TOGETHER — no single share is wrong, so that one is reported against the table.
function entryInvariantViolations(p: Prospective): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];

  for (let i = 1; i < spanSizes.length; i++) {
    const prev = spanSizes[i - 1]!.maxSpan;
    const cur = spanSizes[i]!.maxSpan;
    if (p.valueOf(cur) <= p.valueOf(prev)) {
      out.push({
        path: p.pathOf(cur),
        reason: 'stringer span limits must ascend (' + p.valueOf(prev) + ' ft then ' + p.valueOf(cur) + ' ft) — the size lookup is first-fit',
      });
    }
  }

  return out;
}

function tableInvariantViolations(p: Prospective): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];

  const shares = Object.entries(excavationSplit);
  const sum = shares.reduce((acc, [, share]) => acc + p.valueOf(share), 0);
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    out.push({
      path: 'stages.excavationSplit',
      reason:
        'the stage clock partitions ONE excavation total, so these ' + shares.length + ' shares (' +
        shares.map(([k]) => k).join(', ') + ') must sum to 1 — this file leaves them at ' + sum +
        '. Send all ' + shares.length + ' in the same file, adjusted to sum to 1.',
    });
  }

  return out;
}

// PLAUSIBILITY, not correctness — reported, never enforced. The engine stays correct either way
// and a real table may legitimately step sideways between threat classes, so none of this blocks
// the import; it exists so a transposed or half-finished fill of the two protection ladders
// (shielding thickness and munition standoff) is visible to the person who made it.
//
// Threats are laddered WITHIN a class by the catalog's `base` severity seed — structure a file
// cannot move — so only the values being compared come from the file.
function severityLadders(): string[][] {
  const byClass = new Map<string, string[]>();
  for (const [id, t] of Object.entries(threats)) {
    const ids = byClass.get(t.class) ?? [];
    ids.push(id);
    byClass.set(t.class, ids);
  }
  for (const ids of byClass.values()) ids.sort((a, b) => threats[a]!.base - threats[b]!.base);
  return [...byClass.values()];
}

// A protection magnitude of zero or less is not "none needed" — nothing stops a round and no
// munition is safe at no standoff, so such a value reads as ABSENT (engine/protection.ts fails
// the roof safe on exactly that reading). This has to be checked leaf by leaf: a ladder walk
// cannot see it, because zeroing the smallest threat of a class decreases against nothing and
// zeroing a whole class leaves every step equal rather than descending.
function nonPositiveWarnings(p: Prospective): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];
  for (const [id, row] of Object.entries(shielding)) {
    for (const mat of shieldMaterials) {
      const leaf = row[mat];
      const v = p.valueOf(leaf);
      if (v > 0) continue;
      out.push({
        path: p.pathOf(leaf),
        reason:
          threats[id]!.label + ' would be fully stopped by ' + v + ' ft of ' + mat +
          ' — a protective thickness of zero or less reads as a MISSING value, and a roof sized' +
          ' from it falls to an engineered design; applied, confirm against the pub',
      });
    }
  }
  for (const [id, t] of Object.entries(threats)) {
    const v = p.valueOf(t.standoffMin);
    if (v > 0) continue;
    out.push({
      path: p.pathOf(t.standoffMin),
      reason:
        t.label + ' would be safe at ' + v + ' ft of standoff — a standoff of zero or less reads' +
        ' as a MISSING value, and standoff drives the roof setback; applied, confirm against the pub',
    });
  }
  return out;
}

// Each rung is compared against the LARGEST value below it in the class, not merely the rung
// immediately below: a gap anywhere in the ladder (a leaf the table does not carry) must not
// break the chain and let a reversal through unseen.
function ladderWarnings(
  p: Prospective,
  ids: string[],
  leafOf: (id: string) => Provenance<number> | undefined,
  reason: (bigger: string, biggerFt: number, smaller: string, smallerFt: number) => string,
): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];
  let peakId: string | undefined;
  let peak = 0;
  for (const id of ids) {
    const leaf = leafOf(id);
    if (!leaf) continue;
    const v = p.valueOf(leaf);
    if (peakId !== undefined && v < peak) {
      out.push({ path: p.pathOf(leaf), reason: reason(id, v, peakId, peak) });
      continue;
    }
    peakId = id;
    peak = v;
  }
  return out;
}

function plausibilityWarnings(p: Prospective): DoctrineFinding[] {
  const out: DoctrineFinding[] = [...nonPositiveWarnings(p)];

  for (const ladder of severityLadders()) {
    // Shielding: only across threats that actually yield a thickness — an engineered munition
    // never gets one, so its row is not part of any cover ladder.
    const covered = ladder.filter((id) => threats[id]!.roof === 'earth_on_stringers');
    for (const mat of shieldMaterials) {
      out.push(
        ...ladderWarnings(p, covered, (id) => shielding[id]?.[mat], (bigger, bft, smaller, sft) =>
          threats[bigger]!.label + ' needs less ' + mat + ' cover (' + bft + ' ft) than the smaller ' +
          threats[smaller]!.label + ' (' + sft + ' ft) — applied; confirm this is what the pub says'),
      );
    }
    // Standoff: every munition in the class, engineered roof or not — the setback is built
    // either way.
    out.push(
      ...ladderWarnings(p, ladder, (id) => threats[id]!.standoffMin, (bigger, bft, smaller, sft) =>
        threats[bigger]!.label + ' wants less standoff (' + bft + ' ft) than the smaller ' +
        threats[smaller]!.label + ' (' + sft + ' ft) — applied; standoff sets the roof setback,' +
        ' so confirm this is what the pub says'),
    );
  }
  return out;
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

  const rejected: DoctrineFinding[] = [];
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

  // Whole-table checks: everything above validates one entry at a time and cannot see an order
  // or a sum. Run against the prospective table, still before any mutation.
  const view = prospective(staged);
  rejected.push(...entryInvariantViolations(view));
  const rejectedTables = tableInvariantViolations(view);

  // All-or-nothing: any rejection refuses the ENTIRE file (safety-critical data must never
  // land half-applied). Nothing has been mutated yet. The two kinds are counted separately so
  // the summary never calls a broken table an "entry".
  if (rejected.length > 0 || rejectedTables.length > 0) {
    const parts: string[] = [];
    if (rejected.length > 0) parts.push(rejected.length + ' entr(y/ies) failed validation');
    if (rejectedTables.length > 0) parts.push(rejectedTables.length + ' table invariant(s) broke');
    return {
      ok: false,
      applied: 0,
      dryRun,
      rejected,
      rejectedTables,
      warnings: [],
      message: 'Rejected — ' + parts.join(' and ') + '; nothing was applied.',
      counts: counts(),
    };
  }

  const warnings = plausibilityWarnings(view);

  const manifest: DoctrineManifest = { contentHash: contentHash(entries as DoctrineEntryDTO[]) };
  const rawManifest = obj['manifest'];
  if (typeof rawManifest === 'object' && rawManifest !== null) {
    const rm = rawManifest as Record<string, unknown>;
    if (typeof rm['author'] === 'string') manifest.author = rm['author'];
    if (typeof rm['date'] === 'string') manifest.date = rm['date'];
  }

  if (dryRun) {
    return { ok: true, applied: staged.length, dryRun: true, rejected: [], rejectedTables: [], warnings, manifest, counts: previewCounts(staged) };
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

  return { ok: true, applied: staged.length, dryRun: false, rejected: [], rejectedTables: [], warnings, manifest, counts: counts() };
}
