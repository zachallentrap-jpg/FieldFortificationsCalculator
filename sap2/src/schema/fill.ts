// The fill: SAP-2's only container for doctrinal values (blueprint §2.6). A fill is a
// FILE the owner produces and a VALUE the engine receives — never a mutation of
// anything. Class is inside the content hash (relabeling TRAINING→DOCTRINE breaks
// integrity); TRAINING marks are baked into every record; the audit list is part of
// the hashed content.

import { canonicalJson, sortedByKey, type CanonValue } from './canon';
import { sha256Hex } from './sha256';
import type { FillView } from '../engine/read';

export const FILL_FORMAT_VERSION = 2 as const; // born at v2 (B15); no v1 importer exists

export type FillClass = 'DOCTRINE' | 'TRAINING' | 'TEST';

export interface Citation {
  readonly pub: string;      // publication identifier as printed (e.g. "ATP 3-21.8")
  readonly locator: string;  // para/page/table/figure
  readonly edition?: string; // edition/change/date string
}

export type EntryMethod = 'file-import' | 'station';
export type VerifyMethod = 'independent-file' | 'blind-pass-b' | 'mismatch-resolution';

export interface FillRecord {
  readonly leafId: string;
  readonly value: number | boolean | string;
  /** Required for pub-cited leaves. */
  readonly citation?: Citation;
  /** Required for owner-estimate leaves (B16): how the owner derived it. */
  readonly methodNote?: string;
  readonly enteredBy: string;   // attested, not authenticated (F23)
  readonly entryMethod: EntryMethod;
  readonly verifiedBy?: string;
  readonly verifyMethod?: VerifyMethod;
  /** TRAINING class only: baked-in fictitious mark (§2.4). Presence is validated
   *  per class — required on every TRAINING record, forbidden otherwise. */
  readonly fictitious?: true;
}

export const AUDIT_EVENT_TYPES = [
  'entry', 'verification', 'mismatch-resolution', 'correction', 'batch-sealed',
  'pub-registered', 'waiver', 'commissioning', 'decommission', 'export',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export interface AuditEvent {
  readonly seq: number;         // strictly monotonic from 1
  readonly at: string;          // ISO timestamp string, supplied by the recording tool
  readonly type: AuditEventType;
  readonly leafId?: string;
  readonly actor?: string;
  readonly note?: string;
}

export interface FillFile {
  readonly fillFormatVersion: typeof FILL_FORMAT_VERSION;
  readonly class: FillClass;
  readonly schemaHash: string;
  readonly records: readonly FillRecord[];
  readonly audit: readonly AuditEvent[];
  readonly contentHash: string; // sha256 over the canonical body (everything above)
}

const recordCanon = (r: FillRecord): CanonValue => ({
  leafId: r.leafId,
  value: r.value,
  ...(r.citation ? { citation: { pub: r.citation.pub, locator: r.citation.locator, ...(r.citation.edition ? { edition: r.citation.edition } : {}) } } : {}),
  ...(r.methodNote !== undefined ? { methodNote: r.methodNote } : {}),
  enteredBy: r.enteredBy,
  entryMethod: r.entryMethod,
  ...(r.verifiedBy !== undefined ? { verifiedBy: r.verifiedBy } : {}),
  ...(r.verifyMethod !== undefined ? { verifyMethod: r.verifyMethod } : {}),
  ...(r.fictitious ? { fictitious: true } : {}),
});

const auditCanon = (e: AuditEvent): CanonValue => ({
  seq: e.seq, at: e.at, type: e.type,
  ...(e.leafId !== undefined ? { leafId: e.leafId } : {}),
  ...(e.actor !== undefined ? { actor: e.actor } : {}),
  ...(e.note !== undefined ? { note: e.note } : {}),
});

/** Canonical body bytes — the exact string the content hash is computed over, and the
 *  exact string exportFill emits (one serialization, two uses; B21). */
export const canonicalBody = (f: Omit<FillFile, 'contentHash'>): string =>
  canonicalJson({
    fillFormatVersion: f.fillFormatVersion,
    class: f.class,
    schemaHash: f.schemaHash,
    records: sortedByKey(f.records, (r) => r.leafId).map(recordCanon),
    audit: [...f.audit].map(auditCanon), // audit keeps event order (seq-checked)
  });

export const computeContentHash = (f: Omit<FillFile, 'contentHash'>): string =>
  sha256Hex(canonicalBody(f));

/** Export = canonical body with the contentHash spliced in as the last field. Two
 *  fills with identical content export byte-identical files regardless of the
 *  insertion order they were built in (shuffle-tested). */
export const exportFill = (f: FillFile): string => {
  const body = canonicalBody(f);
  return body.slice(0, -1) + ',"contentHash":' + JSON.stringify(f.contentHash) + '}';
};

/** The committed immutable fill value the engine computes against. Identity rides
 *  with it (§2.1): renderers stamp artifacts from THIS object, so an artifact can
 *  only carry the provenance of the data that actually produced it. */
export interface FillValue extends FillView {
  readonly cls: FillClass;
  readonly contentHash: string;
  readonly schemaHash: string;
  readonly recordCount: number;
  flag(leafId: string): boolean | undefined;
  record(leafId: string): FillRecord | undefined;
  has(leafId: string): boolean;
}

export const toFillValue = (f: FillFile): FillValue => {
  const byId = new Map<string, FillRecord>();
  for (const r of f.records) byId.set(r.leafId, r);
  return Object.freeze({
    cls: f.class,
    contentHash: f.contentHash,
    schemaHash: f.schemaHash,
    recordCount: f.records.length,
    numeric: (id: string) => {
      const v = byId.get(id)?.value;
      return typeof v === 'number' ? v : undefined;
    },
    text: (id: string) => {
      const v = byId.get(id)?.value;
      return typeof v === 'string' ? v : undefined;
    },
    flag: (id: string) => {
      const v = byId.get(id)?.value;
      return typeof v === 'boolean' ? v : undefined;
    },
    record: (id: string) => byId.get(id),
    has: (id: string) => byId.has(id),
  });
};
