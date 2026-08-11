// Woodframe doctrine import/export — the offline rule database over doctrine.ts's register.
//
// `exportDoctrine()` serializes every registered leaf so a user who holds the cited pubs can
// correct values OFFLINE and reload them. `importDoctrine()` validates strictly and applies
// ALL-OR-NOTHING: one rejected entry refuses the whole file and nothing mutates — a safety table
// half-applied is a table whose rules no longer agree with each other, which is worse than the
// error the file was correcting. A dry run validates without mutating so a UI can preview.
//
// THE PROVENANCE MODEL IS WOODFRAME'S OWN. These are PUBLIC values: every leaf ships with a
// working default, a `cite`, and `ph` (page-check pending). A file may change `value`, `cite`
// and `ph` — the user who corrects a number against a pub they hold records what they read and
// clears the flag — and may change NOTHING ELSE. `lifeSafety` in particular is structural: the
// LS register drives the packet badge and the CI ack gate, and a file that could untag a rule
// could silence both, so any attempt to move the tag rejects the entry (and with it the file).
//
// Validation is per-entry AND whole-table. Some rules are only right TOGETHER: a span table is
// read by member depth and by spacing column, so one row edited out of order hands a deeper
// member less span than a shallower one; a stair's layout target must sit inside its own
// limits or every stair the generator cuts violates the limit printed beside it. Those checks
// run against the table as it WOULD stand after the file lands — before anything commits.
//
// Deterministic throughout: no clock, no randomness, no I/O. The manifest hash is FNV-1a over
// the canonical entry list; author/date are caller-supplied fields, never read from a clock.

import { getByPath, doctrinePaths, shippedLeaf } from './doctrine';

export const WOODFRAME_DOCTRINE_VERSION = 1;

// Numeric sanity bound. The largest magnitude the register ships is 100 (BUNKER.soilPcf, lb/cf),
// so 1000 is an order of magnitude of headroom while still refusing the transposed-digits class
// of transcription error — a 75-ft riser is not a correction, it is a slip.
const MAX_MAGNITUDE = 1000;

// String-value bound. Nailing schedules and nominals are one-line strings a member card prints;
// the longest shipped is 99 characters (the IRC anchor-bolt schedule), so 200 leaves room for a
// corrected schedule to say more without admitting a pasted paragraph where a card expects a line.
const MAX_STRING = 200;

// Citation bound — the longest shipped cite is 123 characters (the NOTCH practice citation).
const MAX_CITE = 300;

// How deep a structured leaf value may nest. The deepest shipped shape is a span table
// (table → nominal row → spacing cell = 2 levels below the leaf), so 6 is generous headroom
// and still stops a hostile file from staging an unbounded object graph.
const MAX_VALUE_DEPTH = 6;

export interface WoodframeEntryDTO {
  path: string;
  value: unknown;
  cite: string;
  ph: boolean;
  unit?: string; // structural, exported for the reader — never imported
  lifeSafety?: boolean; // structural — a file may echo it, never change it
  note?: string; // informational — never imported
}

export interface WoodframeManifest {
  author?: string;
  date?: string; // caller-supplied — io stays clock-free
  contentHash: string; // deterministic hash of the entry list: change detection + attribution
}

export interface WoodframeDoctrineExport {
  woodframeDoctrineVersion: number;
  note: string;
  manifest?: WoodframeManifest;
  entries: WoodframeEntryDTO[];
}

export interface WoodframeFinding {
  path: string; // a register path — except in rejectedTables, where it names a whole table
  reason: string;
}

export interface WoodframeCounts {
  total: number;
  pageChecked: number; // ph === false — somebody read the page
  pending: number; // ph === true — the "(PH)" set the UI renders
  lifeSafety: number;
  lifeSafetyPending: number; // LS ∧ (PH) — the review-required set
}

export interface WoodframeImportReport {
  ok: boolean;
  applied: number; // entries that were (or in a dry run, would be) applied
  dryRun: boolean;
  rejected: WoodframeFinding[]; // per-ENTRY findings — each path addresses an editable row
  // Whole-TABLE findings: an invariant several leaves hold together, so no single row is the
  // culprit and `path` names the table — kept apart so a reader is never sent hunting for a
  // row identifier that matches nothing they can edit.
  rejectedTables: WoodframeFinding[];
  warnings: WoodframeFinding[]; // applied (or would be), but the editor should look at them
  message?: string;
  manifest?: WoodframeManifest;
  counts: WoodframeCounts;
}

const cloneValue = <T>(v: T): T => (typeof v === 'object' && v !== null ? (JSON.parse(JSON.stringify(v)) as T) : v);

// Canonical stringify — object keys sorted, so the hash and the changed-value comparison cannot
// depend on the key order a file happens to use.
function canon(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

// FNV-1a over the canonical (path|value|cite|ph) list — deterministic, dependency-free. Used
// for attribution and change detection, never for security, so a fast non-crypto hash is fine.
function contentHash(entries: { path: string; value: unknown; cite: string; ph: boolean }[]): string {
  const canonical = entries
    .map((e) => e.path + '|' + canon(e.value) + '|' + e.cite + '|' + e.ph)
    .sort()
    .join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function counts(): WoodframeCounts {
  let pageChecked = 0;
  let pending = 0;
  let lifeSafety = 0;
  let lifeSafetyPending = 0;
  for (const path of doctrinePaths()) {
    const d = getByPath(path)!;
    if (d.ph) pending++;
    else pageChecked++;
    if (d.lifeSafety === true) {
      lifeSafety++;
      if (d.ph) lifeSafetyPending++;
    }
  }
  return { total: pending + pageChecked, pageChecked, pending, lifeSafety, lifeSafetyPending };
}

// The manifest of the fill currently applied to the live register (null until an import lands),
// so a corrected packet can say WHOSE correction it was generated under.
let appliedManifest: WoodframeManifest | null = null;
export function getAppliedManifest(): WoodframeManifest | null {
  return appliedManifest;
}

/** Restore every leaf to its shipped value/cite/ph — the test-isolation reset. */
export function resetDoctrine(): void {
  for (const path of doctrinePaths()) {
    const t = getByPath(path)!;
    const s = shippedLeaf(path)!;
    t.value = s.value;
    t.cite = s.cite;
    t.ph = s.ph;
  }
  appliedManifest = null;
}

export function exportDoctrine(manifest?: { author?: string; date?: string }): WoodframeDoctrineExport {
  const entries: WoodframeEntryDTO[] = [];
  for (const path of doctrinePaths()) {
    const d = getByPath(path)!;
    // Values are CLONED out: a structured leaf handed out live would let edits to the exported
    // file's object graph write straight through into the register, skipping every check here.
    const dto: WoodframeEntryDTO = { path, value: cloneValue(d.value), cite: d.cite, ph: d.ph };
    if (d.unit !== undefined) dto.unit = d.unit;
    if (d.lifeSafety === true) dto.lifeSafety = true;
    if (d.note !== undefined) dto.note = d.note;
    entries.push(dto);
  }
  const m: WoodframeManifest = { contentHash: contentHash(entries) };
  if (manifest?.author) m.author = manifest.author;
  if (manifest?.date) m.date = manifest.date;
  return {
    woodframeDoctrineVersion: WOODFRAME_DOCTRINE_VERSION,
    note: 'Woodframe doctrine export — every registered rule; ph stays true until the cited page is read.',
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

const typeName = (v: unknown): string => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/**
 * Why an incoming value cannot replace the live one, or null when it can. The live value is the
 * SHAPE CONTRACT: the structure is frozen, so a structured leaf may change only the primitive
 * values inside the shipped shape — same array length, same key set, same primitive type at
 * every position. That is what lets a span-table consumer index by nominal and by spacing
 * without re-validating on every read.
 */
function valueObjection(live: unknown, incoming: unknown, depth = 0): string | null {
  if (depth > MAX_VALUE_DEPTH) return 'value nests deeper than any doctrine shape';
  if (typeof live === 'number') {
    if (typeof incoming !== 'number') return `expected a number, got ${typeName(incoming)}`;
    if (!Number.isFinite(incoming)) return 'number is not finite';
    if (incoming < 0) return 'negative — every woodframe magnitude is a physical quantity';
    if (incoming >= MAX_MAGNITUDE) return `number out of range (0 ≤ v < ${MAX_MAGNITUDE})`;
    return null;
  }
  if (typeof live === 'string') {
    if (typeof incoming !== 'string') return `expected a string, got ${typeName(incoming)}`;
    if (incoming.trim().length === 0) return 'empty string';
    if (incoming.length > MAX_STRING) return `string longer than ${MAX_STRING} characters — a member card prints one line`;
    return null;
  }
  if (Array.isArray(live)) {
    if (!Array.isArray(incoming)) return `expected an array, got ${typeName(incoming)}`;
    if (incoming.length !== live.length) {
      return `expected ${live.length} elements, got ${incoming.length} — the structure is frozen; only the values in it may change`;
    }
    for (let i = 0; i < live.length; i++) {
      const o = valueObjection(live[i], incoming[i], depth + 1);
      if (o) return `[${i}]: ${o}`;
    }
    return null;
  }
  if (typeof live === 'object' && live !== null) {
    if (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming)) {
      return `expected an object, got ${typeName(incoming)}`;
    }
    const liveKeys = Object.keys(live).sort();
    const inKeys = Object.keys(incoming).sort();
    if (liveKeys.join(' ') !== inKeys.join(' ')) {
      return `keys must match the shipped structure exactly (${liveKeys.join(', ')}) — the structure is frozen; only the values in it may change`;
    }
    for (const k of liveKeys) {
      const o = valueObjection((live as Record<string, unknown>)[k], (incoming as Record<string, unknown>)[k], depth + 1);
      if (o) return `${k}: ${o}`;
    }
    return null;
  }
  return `unsupported leaf shape (${typeName(live)})`;
}

const fail = (message: string): WoodframeImportReport => ({
  ok: false,
  applied: 0,
  dryRun: false,
  rejected: [],
  rejectedTables: [],
  warnings: [],
  message,
  counts: counts(),
});

// One staged mutation, validated but not yet applied. All-or-nothing: the whole list is built
// first and live leaves are touched only once every entry has passed.
interface Staged {
  path: string;
  value: unknown; // already cloned — the file's object graph never enters the register
  cite: string;
  ph: boolean;
}

// A dry run must preview the counts an apply WOULD produce, not echo the live state under the
// same field name — the preview is the point of a dry run.
function previewCounts(staged: Map<string, Staged>): WoodframeCounts {
  let pageChecked = 0;
  let pending = 0;
  let lifeSafety = 0;
  let lifeSafetyPending = 0;
  for (const path of doctrinePaths()) {
    const d = getByPath(path)!;
    const ph = staged.get(path)?.ph ?? d.ph;
    if (ph) pending++;
    else pageChecked++;
    if (d.lifeSafety === true) {
      lifeSafety++;
      if (ph) lifeSafetyPending++;
    }
  }
  return { total: pending + pageChecked, pageChecked, pending, lifeSafety, lifeSafetyPending };
}

// The register as it WOULD stand after the file lands: staged where the file speaks, live
// elsewhere. Whole-table checks run against this view, before anything mutates, so a violation
// still refuses the whole file — and a file that scrambles one leaf of a pair is caught against
// the leaf it did not touch.
type Prospective = (path: string) => unknown;
const prospective = (staged: Map<string, Staged>): Prospective => (path) =>
  staged.has(path) ? staged.get(path)!.value : getByPath(path)!.value;

/** The depth a nominal names: '2x10' → 10. Span-table rows are ordered by it. */
const depthOf = (nominal: string): number => Number(nominal.split('x')[1]);

/**
 * SPAN monotonicity — an engine-correctness invariant, not a doctrinal judgment. The span
 * checker looks a member's nominal up and compares its run to the cell; nothing re-derives the
 * table's internal order. Two orderings are physical facts any real table obeys:
 *   · a DEEPER member is never allowed LESS span than a shallower one at the same spacing —
 *     a table that says otherwise waves a shallow member past the limit its own deeper row
 *     would flunk, on the path whose failure mode is the floor;
 *   · a member at WIDER spacing carries a wider strip of load, so its allowance never exceeds
 *     the narrower column's.
 * A whole SPAN table is ONE leaf, so a violation is an entry finding against that leaf's path.
 */
function spanTableFindings(path: string, table: Record<string, unknown>): WoodframeFinding[] {
  const out: WoodframeFinding[] = [];
  const rows = Object.keys(table);
  if (rows.length === 0 || rows.some((r) => !Number.isFinite(depthOf(r)))) return out;
  const byDepth = [...rows].sort((a, b) => depthOf(a) - depthOf(b));

  if (typeof table[byDepth[0]!] === 'number') {
    // Flat table (one allowable span per size — SPAN.header).
    for (let i = 1; i < byDepth.length; i++) {
      const prev = table[byDepth[i - 1]!] as number;
      const cur = table[byDepth[i]!] as number;
      if (cur < prev) {
        out.push({
          path,
          reason: `${byDepth[i]} is allowed ${cur} ft while the shallower ${byDepth[i - 1]} is allowed ${prev} ft — a deeper member cannot be allowed less span`,
        });
      }
    }
    return out;
  }

  // Spaced table (row per nominal, column per o.c. spacing — joist/rafter/ceilingJoist).
  for (const nominal of byDepth) {
    const row = table[nominal] as Record<string, number>;
    const cols = Object.keys(row).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < cols.length; i++) {
      const narrow = row[String(cols[i - 1])]!;
      const wide = row[String(cols[i])]!;
      if (wide > narrow) {
        out.push({
          path,
          reason: `${nominal}: the ${cols[i]}-in column allows ${wide} ft, more than the ${cols[i - 1]}-in column's ${narrow} ft — a member at wider spacing carries more load and cannot span farther`,
        });
      }
    }
  }
  for (let i = 1; i < byDepth.length; i++) {
    const prevRow = table[byDepth[i - 1]!] as Record<string, number>;
    const curRow = table[byDepth[i]!] as Record<string, number>;
    for (const col of Object.keys(curRow)) {
      const prev = prevRow[col];
      if (prev !== undefined && curRow[col]! < prev) {
        out.push({
          path,
          reason: `${byDepth[i]} at ${col} in o.c. is allowed ${curRow[col]} ft while the shallower ${byDepth[i - 1]} is allowed ${prev} ft — a deeper member cannot be allowed less span`,
        });
      }
    }
  }
  return out;
}

// Per-leaf invariants a bounds check cannot express, run against the prospective view.
function entryInvariantFindings(p: Prospective): WoodframeFinding[] {
  const out: WoodframeFinding[] = [];
  for (const path of doctrinePaths()) {
    if (!path.startsWith('SPAN.')) continue;
    const v = p(path);
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out.push(...spanTableFindings(path, v as Record<string, unknown>));
    }
  }
  // The bird's-mouth seat limit is a FRACTION of the member depth: at 0 no seat may be cut at
  // all (the rule would forbid the joint it exists to bound), and above 1 it would permit
  // notching past the whole member — what is left of the board at the bearing is what carries
  // the roof, so the fraction must lie in (0, 1].
  const frac = p('NOTCH.rafterSeatMaxDepthFrac');
  if (typeof frac === 'number' && !(frac > 0 && frac <= 1)) {
    out.push({
      path: 'NOTCH.rafterSeatMaxDepthFrac',
      reason: `a bearing-notch limit is a fraction of the member depth and must lie in (0, 1] — got ${frac}`,
    });
  }
  return out;
}

// Invariants several leaves hold TOGETHER — no single row is the culprit, so the finding names
// the table (see the report shape). A stair whose layout target sits outside its own limits
// makes every stair the generator cuts violate the limit printed beside it on the same packet.
function tableInvariantFindings(p: Prospective): WoodframeFinding[] {
  const out: WoodframeFinding[] = [];
  const riser = p('STAIR.targetRiserIn');
  const maxRiser = p('STAIR.maxRiserIn');
  if (typeof riser === 'number' && typeof maxRiser === 'number' && riser > maxRiser) {
    out.push({
      path: 'STAIR',
      reason: `targetRiserIn (${riser} in) exceeds maxRiserIn (${maxRiser} in) — every riser laid out to the target would break the limit; send both leaves in one file, coherent`,
    });
  }
  const run = p('STAIR.unitRunIn');
  const minTread = p('STAIR.minTreadIn');
  if (typeof run === 'number' && typeof minTread === 'number' && run < minTread) {
    out.push({
      path: 'STAIR',
      reason: `unitRunIn (${run} in) is below minTreadIn (${minTread} in) — every tread cut to the layout run would be shallower than the minimum; send both leaves in one file, coherent`,
    });
  }
  return out;
}

/** Congruent numeric positions where the incoming value differs from the live one. */
function collectNumericDeltas(
  at: string,
  live: unknown,
  next: unknown,
  out: { at: string; from: number; to: number }[],
): void {
  if (typeof live === 'number' && typeof next === 'number') {
    if (live !== next) out.push({ at, from: live, to: next });
    return;
  }
  if (Array.isArray(live) && Array.isArray(next)) {
    live.forEach((v, i) => collectNumericDeltas(`${at}[${i}]`, v, next[i], out));
    return;
  }
  if (typeof live === 'object' && live !== null && typeof next === 'object' && next !== null) {
    for (const k of Object.keys(live)) {
      collectNumericDeltas(`${at}.${k}`, (live as Record<string, unknown>)[k], (next as Record<string, unknown>)[k], out);
    }
  }
}

// PLAUSIBILITY, not correctness — reported, never enforced. A legal value can still be the
// shape of a slip: a magnitude that more than doubled (or halved) is the shape of a transposed
// digit, a zero where the register shipped a real magnitude reads as an ABSENT rule to whoever
// meets it downstream, and a schedule calling for dozens of nails at one joint is not one a
// crew drives. The editor may be right — the pub wins — so the file applies and the report says
// where to look.
function plausibilityWarnings(staged: Staged[]): WoodframeFinding[] {
  const out: WoodframeFinding[] = [];
  for (const s of staged) {
    const live = getByPath(s.path)!;
    if (canon(live.value) === canon(s.value)) continue;
    const deltas: { at: string; from: number; to: number }[] = [];
    collectNumericDeltas('', live.value, s.value, deltas);
    for (const d of deltas) {
      const at = d.at ? `${s.path}${d.at}` : s.path;
      if (d.from > 0 && d.to === 0) {
        out.push({
          path: s.path,
          reason: `${at}: ${d.from} → 0 — a zero here reads as an absent magnitude, not a rule; applied, confirm against the pub`,
        });
      } else if (d.from > 0 && d.to > 0 && (d.to > 2 * d.from || d.from > 2 * d.to)) {
        out.push({
          path: s.path,
          reason: `${at}: ${d.from} → ${d.to} — ${d.to > d.from ? 'grew' : 'shrank'} more than 2×, the shape of a transposed digit; applied, confirm against the pub`,
        });
      }
    }
    if (typeof s.value === 'string') {
      for (const m of s.value.matchAll(/(\d+)\s*-\s*\d+d\b/g)) {
        const n = Number(m[1]);
        if (n >= 30) {
          out.push({
            path: s.path,
            reason: `calls for ${n} nails at one joint ("${m[0]}") — no schedule a crew drives says that; applied, confirm against the pub`,
          });
        }
      }
    }
  }
  return out;
}

export function importDoctrine(raw: unknown, opts?: { maxEntries?: number; dryRun?: boolean }): WoodframeImportReport {
  const dryRun = opts?.dryRun === true;
  if (typeof raw !== 'object' || raw === null) return fail('Not a woodframe doctrine object.');
  if (hasDangerousKeys(raw)) return fail('Rejected: file contains prototype-pollution keys.');

  const obj = raw as Record<string, unknown>;
  const dv = obj['woodframeDoctrineVersion'];
  if (typeof dv !== 'number') return fail('Missing or invalid woodframeDoctrineVersion.');
  if (dv > WOODFRAME_DOCTRINE_VERSION) {
    return fail(`Doctrine file is version ${dv}, newer than this app supports (${WOODFRAME_DOCTRINE_VERSION}).`);
  }
  // dv <= current: identity migration (v1). Future versions add migration steps here.

  const entries = obj['entries'];
  if (!Array.isArray(entries)) return fail('Missing entries[].');
  const max = opts?.maxEntries ?? 2000;
  if (entries.length > max) return fail(`Too many entries (${entries.length} > ${max}).`);

  const rejected: WoodframeFinding[] = [];
  const staged = new Map<string, Staged>();

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
    if (staged.has(path)) {
      rejected.push({ path, reason: 'duplicate path — a file may state each rule once' });
      continue;
    }
    // The LS tag is structural, both directions: untagging would silence the packet badge and
    // the CI ack gate for a fall/collapse/overload number, and tagging from a file would grow
    // the register the gate acks without the review that tagging in source goes through.
    if ('lifeSafety' in e) {
      const liveTag = target.lifeSafety === true;
      if (e['lifeSafety'] !== liveTag) {
        rejected.push({
          path,
          reason: liveTag
            ? 'attempts to untag a life-safety rule — the tag is structural; no file may remove it'
            : 'attempts to tag a rule life-safety from a file — the tag is structural; tag it in source, through review',
        });
        continue;
      }
    }
    // Value, cite and ph travel together: a corrected number under the old cite with the old
    // (PH) state is a false attribution — the citation would cover a number its page never held.
    const ph = e['ph'];
    if (typeof ph !== 'boolean') {
      rejected.push({ path, reason: 'ph must be stated as a boolean — true unless the cited page was read' });
      continue;
    }
    const cite = e['cite'];
    if (typeof cite !== 'string' || cite.trim().length === 0) {
      rejected.push({ path, reason: 'missing cite — a value must say what it was checked against (the shipped cite may be restated verbatim)' });
      continue;
    }
    if (cite.length > MAX_CITE) {
      rejected.push({ path, reason: `cite longer than ${MAX_CITE} characters` });
      continue;
    }
    // A page-check claim with a TODO cite is a contradiction: ph=false says somebody read the
    // page, and TODO says nobody has decided which page that is.
    if (ph === false && /todo/i.test(cite)) {
      rejected.push({ path, reason: 'ph=false with a TODO cite — a page check cannot rest on a citation still to be found' });
      continue;
    }
    if (!('value' in e)) {
      rejected.push({ path, reason: 'missing value' });
      continue;
    }
    const objection = valueObjection(target.value, e['value']);
    if (objection) {
      rejected.push({ path, reason: objection });
      continue;
    }
    staged.set(path, { path, value: cloneValue(e['value']), cite, ph });
  }

  // Whole-table checks: everything above validates one entry at a time and cannot see an
  // ordering or a pair. Run against the prospective view, still before any mutation.
  const view = prospective(staged);
  rejected.push(...entryInvariantFindings(view));
  const rejectedTables = tableInvariantFindings(view);

  // All-or-nothing: any rejection refuses the ENTIRE file. Nothing has been mutated yet.
  if (rejected.length > 0 || rejectedTables.length > 0) {
    const parts: string[] = [];
    if (rejected.length > 0) parts.push(`${rejected.length} entr(y/ies) failed validation`);
    if (rejectedTables.length > 0) parts.push(`${rejectedTables.length} table invariant(s) broke`);
    return {
      ok: false,
      applied: 0,
      dryRun,
      rejected,
      rejectedTables,
      warnings: [],
      message: `Rejected — ${parts.join(' and ')}; nothing was applied.`,
      counts: counts(),
    };
  }

  const stagedList = [...staged.values()];
  const warnings = plausibilityWarnings(stagedList);

  const manifest: WoodframeManifest = { contentHash: contentHash(stagedList) };
  const rawManifest = obj['manifest'];
  if (typeof rawManifest === 'object' && rawManifest !== null) {
    const rm = rawManifest as Record<string, unknown>;
    if (typeof rm['author'] === 'string') manifest.author = rm['author'];
    if (typeof rm['date'] === 'string') manifest.date = rm['date'];
  }

  if (dryRun) {
    return {
      ok: true,
      applied: staged.size,
      dryRun: true,
      rejected: [],
      rejectedTables: [],
      warnings,
      manifest,
      counts: previewCounts(staged),
    };
  }

  // Commit: mutate live leaves in place — value, cite, ph and nothing else (unit, lifeSafety
  // and note are structural or informational and never come from a file).
  for (const s of stagedList) {
    const target = getByPath(s.path)!;
    target.value = s.value;
    target.cite = s.cite;
    target.ph = s.ph;
  }
  appliedManifest = manifest;

  return {
    ok: true,
    applied: stagedList.length,
    dryRun: false,
    rejected: [],
    rejectedTables: [],
    warnings,
    manifest,
    counts: counts(),
  };
}
