// COMMAND PACKET — the model (TRAINING_AND_PACKETS_PLAN §4.1). Pure, node-tested, no DOM.
//
// Everything the packet prints is compiled HERE and rendered somewhere else, for the same
// reason the deck compiler is separate from the trainer: the decisions worth arguing about
// have to be testable without a browser. A renderer that computes is a renderer nobody can
// check.
//
// The packet is a projection of the SAME `Member[]` the drawing uses (I-3). It cannot describe
// a different building from the one on screen, because there is only one building.
//
// PRINT ORDER IS DELIBERATE (FD53): cover → exec → materials → labor → assumptions, drawings
// to an opt-in annex. The sibling put eighteen drawing sheets ahead of the bill. A twenty-five
// page packet with the materials on page twenty does not get read, and the whole reason this
// document exists is that somebody has to order the wood.

import type { StructureModel } from '../families/index';
import type { SpecIssue } from '../normalize';
import { specToJson } from '../normalize';
import { bomSummary, classifyNominal, cutList, LABOR_RATES, type BomSummary, type CutLine } from '../bom';
import { purchaseFor, type Purchase } from '../purchase';
import { fastenerTakeoff, type FastenerTakeoff } from '../fasteners';
import { lifeSafetyRegister, COVER_DEPTH_NOTE } from '../doctrine';
import { fnv1a } from '../train/core';
import { laborModel, type LaborModel } from './labor';
import { consumedLsIds, LS_CONSUMERS } from './lsgate';
import { SECTIONS } from './copy';

export interface CiteRow {
  cite: string;
  /** How many members in THIS build rest on it. */
  members: number;
  /** Pending a manual page check. */
  ph: boolean;
}

export interface LsRow {
  /** The doctrine id, for anyone tracing it back to the register. */
  key: string;
  /** What to call it in front of a commander. */
  label: string;
  value: string;
  cite: string;
  ph: boolean;
}

export interface ClassRollup {
  klass: ReturnType<typeof classifyNominal>;
  pieces: number;
  boardFeet: number;
  /** What this class is ordered in, for the rollup's own units column. */
  unit: string;
  quantity: number;
}

export interface PacketOptions {
  title: string;
  lineage: string;
  /** Operator input, not doctrine — clamped, never a doctrinal claim. */
  stockLengthsFt?: readonly number[];
  crewSizes?: readonly number[];
  productiveHoursPerDay?: number;
  /** A still of the 3D view as a data URI, when the canvas could give one. */
  viewImage?: string | null;
  /** Line-art of the structure, for the cover. Injected so this module stays render-free. */
  coverArt?: string | null;
  /**
   * Role → what a carpenter calls it. Injected because the dictionary lives in the UI tree;
   * without it the packet's "Use" column prints raw enum values — `solePlate, kingStud,
   * collarTie` — at a commander, which is the tool showing its source code to its reader.
   */
  plainName?: (role: string) => string;
}

export interface PacketModel {
  title: string;
  lineage: string;
  /** Content-addressed: a doctrine or spec change forces a different id (R-T2b). */
  specHash: string;
  summaryLine: string;
  bom: BomSummary;
  cuts: CutLine[];
  purchase: Purchase;
  fasteners: FastenerTakeoff;
  labor: LaborModel;
  rollup: ClassRollup[];
  cites: CiteRow[];
  /** Only the life-safety values THIS build actually consumes. Empty ⇒ no table, no banner. */
  ls: LsRow[];
  issues: SpecIssue[];
  /** Tools inferred from the model's own nailing schedules. */
  tools: string[];
  /** Role names as a carpenter says them, resolved once. */
  plain: (role: string) => string;
  isBunker: boolean;
  /**
   * Ground as the operator recorded it, or null. Printed rather than consumed: FM 5-426 sizes
   * post footers per soil class and those tables are pending a page check, so the honest place
   * for this observation is in front of the reviewing engineer, stated as unread.
   */
  siteSoil: string | null;
  coverDepthNote: string;
  sections: readonly string[];
  rates: typeof LABOR_RATES;
  viewImage?: string | null;
  coverArt?: string | null;
  /** Every count the honesty strip quotes, computed once so the strip and the page agree. */
  counts: { cites: number; phCites: number; ls: number; lsPending: number; members: number };
}

/** `2x4 hammer` etc. — what the nailing schedules in THIS model imply somebody has to carry. */
function toolsFor(model: StructureModel): string[] {
  const tools = new Set<string>(['framing hammers', 'chalk line, square, tape', 'hand saws or one circular saw per two-man team']);
  const all = model.members.map((m) => m.nailing).join(' ').toLowerCase();
  if (/drift|pin|bolt|lag/.test(all)) tools.add('wrenches and a drill for bolts, lags and drift pins');
  if (/strap|anchor/.test(all)) tools.add('strap and anchor hardware, set per manufacturer');
  if (model.members.some((m) => m.nominal.startsWith('conc'))) tools.add('form lumber, mixing plant or bagged mix, screed and float');
  if (model.members.some((m) => /panel|plywood/i.test(m.nominal))) tools.add('circular saw and a straightedge for ripping sheets');
  if (model.members.some((m) => m.role === 'roofingCourse')) tools.add('roofing knife, chalk, and a way to get material up');
  return [...tools];
}

/** One sentence describing what was configured, compiled rather than typed. */
function summarize(model: StructureModel): string {
  const s = model.spec as unknown as Record<string, unknown>;
  const dims = s['dims'] as { lengthFt: number; widthFt: number } | undefined;
  const parts: string[] = [];
  if (dims) parts.push(`${dims.lengthFt} × ${dims.widthFt} ft`);
  const stories = s['stories'] as { wallHeightFt: number }[] | undefined;
  if (stories && stories.length > 0) {
    parts.push(`${stories[0]!.wallHeightFt} ft walls`);
    if (stories.length > 1) parts.push(`${stories.length} stories`);
  }
  const roof = s['roof'] as { kind: string; risePer12?: number } | undefined;
  if (roof && roof.kind !== 'none') {
    parts.push(roof.risePer12 ? `${roof.kind} roof ${roof.risePer12}:12` : `${roof.kind} roof`);
  }
  const foundation = s['foundation'] as { kind: string } | undefined;
  if (foundation) parts.push(foundation.kind);
  parts.push(`${model.members.length} members`);
  return parts.join(' · ');
}

/**
 * Tidy a citation for print. Some doctrine entries spell "(PH)" inside their own cite text AND
 * are flagged `ph`, so `citeOf` appends a second one — "TM 5-302 tower X-bracing (PH) (PH)".
 *
 * Fixed here rather than in `citeOf` on purpose: `citeOf` feeds every member's `doctrineRef`,
 * and those strings are under the T0 compat lock. A cosmetic tidy is not worth breaking a
 * stop-the-line contract, and a projection is the right place to fix how something reads.
 */
function tidyCite(cite: string): string {
  return cite.replace(/\(PH\)(\s*\(PH\))+/g, '(PH)').replace(/\s{2,}/g, ' ').trim();
}

/** Distinct citations across the model's members, with how much of the build rests on each. */
function citeRegister(model: StructureModel): CiteRow[] {
  const by = new Map<string, number>();
  for (const m of model.members) {
    const cite = tidyCite(m.doctrineRef);
    by.set(cite, (by.get(cite) ?? 0) + 1);
  }
  return [...by.entries()]
    .map(([cite, members]) => ({ cite, members, ph: cite.includes('(PH') }))
    .sort((a, b) => b.members - a.members || a.cite.localeCompare(b.cite));
}

/**
 * A doctrine value as the packet prints it. Most are scalars; the span entries are TABLES
 * keyed by nominal and spacing, and `${value}` on one of those renders `[object Object]` on a
 * document going to a commander. A table says it is a table and points at its citation.
 */
function lsValue(value: unknown, unit?: string): string {
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return `table by ${keys.slice(0, 4).join(' / ')}${keys.length > 4 ? ' …' : ''} — see citation`;
  }
  return `${value}${unit ? ` ${unit}` : ''}`;
}

/**
 * The life-safety values THIS build consumes — never the whole register. A packet for a storage
 * shed that prints ladder rung spacing has taught its reader to skip the LS table, which is the
 * one table that must be read. Consumers are declared in `lsgate.ts` and gated by a test; see
 * the header there for why matching on citation strings could never have worked.
 */
function lsRows(model: StructureModel): LsRow[] {
  const roles = new Set<string>(model.members.map((m) => m.role));
  const register = lifeSafetyRegister();
  const consumed = new Set(consumedLsIds(roles, model.spec.family, register.map((e) => e.id)));
  return register
    .filter((e) => consumed.has(e.id))
    .map((e) => ({
      key: e.id,
      label: LS_CONSUMERS[e.id]?.label ?? e.id,
      value: lsValue(e.value, e.unit),
      cite: tidyCite(e.cite),
      ph: e.ph,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function rollup(cuts: CutLine[], purchase: Purchase): ClassRollup[] {
  const by = new Map<ReturnType<typeof classifyNominal>, ClassRollup>();
  for (const l of cuts) {
    let r = by.get(l.klass);
    if (!r) { r = { klass: l.klass, pieces: 0, boardFeet: 0, unit: l.unitOfIssue, quantity: 0 }; by.set(l.klass, r); }
    r.pieces += l.count;
    r.boardFeet += l.boardFeet;
  }
  const lumber = by.get('lumber');
  if (lumber) { lumber.quantity = Math.round(lumber.boardFeet); lumber.unit = 'BF'; }
  const sheet = by.get('sheet');
  if (sheet) { sheet.quantity = purchase.sheets.reduce((a, s) => a + (s.unit === 'SHT' ? s.quantity : 0), 0); sheet.unit = 'SHT'; }
  const hardware = by.get('hardware');
  if (hardware) { hardware.quantity = hardware.pieces; hardware.unit = 'EA'; }
  const other = by.get('other');
  if (other) { other.quantity = Math.round(purchase.concrete.reduce((a, c) => a + c.cubicYards, 0) * 100) / 100; other.unit = 'CY'; }
  const ORDER: ReturnType<typeof classifyNominal>[] = ['lumber', 'sheet', 'hardware', 'other'];
  return ORDER.map((k) => by.get(k)).filter((r): r is ClassRollup => r !== undefined);
}

export function packetModel(model: StructureModel, opts: PacketOptions): PacketModel {
  const bom = bomSummary(model.members, model.stagePlan);
  const cuts = cutList(model.members);
  const purchase = purchaseFor(cuts, opts.stockLengthsFt);
  const cites = citeRegister(model);
  const ls = lsRows(model);
  // Content-addressed off the NORMALIZED spec — what was actually built, not what was asked
  // for. Two packets that print different numbers can never carry the same id.
  const specHash = fnv1a(specToJson(model.spec)).toString(16).padStart(8, '0');

  return {
    title: opts.title,
    lineage: opts.lineage,
    specHash,
    summaryLine: summarize(model),
    bom,
    cuts,
    purchase,
    fasteners: fastenerTakeoff(model.members),
    labor: laborModel(bom, { crewSizes: opts.crewSizes, productiveHoursPerDay: opts.productiveHoursPerDay }),
    rollup: rollup(cuts, purchase),
    cites,
    ls,
    issues: model.issues,
    tools: toolsFor(model),
    plain: opts.plainName ?? ((r) => r),
    isBunker: model.spec.family === 'bunker',
    siteSoil: (model.spec as { site?: { soil?: string } }).site?.soil ?? null,
    coverDepthNote: COVER_DEPTH_NOTE,
    sections: SECTIONS,
    rates: LABOR_RATES,
    viewImage: opts.viewImage ?? null,
    coverArt: opts.coverArt ?? null,
    counts: {
      cites: cites.length,
      phCites: cites.filter((c) => c.ph).length,
      ls: ls.length,
      lsPending: ls.filter((r) => r.ph).length,
      members: model.members.length,
    },
  };
}

/**
 * The honesty strip, built from the counts so the strip and the pages behind it can never
 * disagree. Renders on the cover AND in every printed page's footer (R-T2).
 */
export function honestyStrip(p: PacketModel): string {
  const { cites, phCites, ls, lsPending } = p.counts;
  const lsPart = ls === 0 ? 'no life-safety values in this build' : `${ls} life-safety values (${lsPending} pending review)`;
  return `PLANNING ESTIMATE — not a build-to field document · spec ${p.specHash} · ${phCites} of ${cites} citations pending a page check · ${lsPart}`;
}
