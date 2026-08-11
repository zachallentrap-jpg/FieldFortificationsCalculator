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
import { berm, overhead, parapet, radiationHalving, shielding, shieldMaterials, spanSizes, threats } from './protection';
import { backblast, positions } from './positions';
import { standards } from './standards';
import { excavationSplit } from './stages';
import { fmtLength } from './units';
import type { UnitSystem } from './units';
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
// current (unmutated) state under the same field name. counts() before the commit loop and
// counts() after it are different numbers, and reporting the wrong one silently — same field,
// same shape — would make a dry-run preview lie to whoever reads report.counts.
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
//
// A hair ABOVE zero is no better in the hand. The app prints a protective length through
// fmtLength — feet-and-inches, or centimetres under the metric toggle — so a magnitude the
// panel can only render as zero is one nobody can read off the screen, check against a pub, or
// build to: the operator would be shown no cover at all while the drawing shows a roof and the
// BOM bills the stringers under it. That is a data-entry error, not doctrine. The threshold is
// asked of the SAME formatter the panel uses, so it follows the app's display precision — no
// minimum thickness is invented here, and none exists to invent.
const DISPLAY_UNITS: UnitSystem[] = ['imperial', 'metric'];
function displayedAsZero(ft: number): string | undefined {
  // Zero in the rendered string means no significant digit survived the rounding, whatever
  // shape the formatter gives it — 0'-0" imperial, 0 cm metric. (Metric only reaches the ' m'
  // branch at a metre or more, and nothing that large rounds away, so there is no '0 m'.)
  return DISPLAY_UNITS.map((u) => fmtLength(ft, u)).find((shown) => !/[1-9]/.test(shown));
}

// At most ONE finding per leaf: a value that is absent is not separately reported as invisible.
function unbuildableMagnitude(v: number, absent: () => string, invisible: (shown: string) => string): string | undefined {
  if (!(v > 0)) return absent();
  const shown = displayedAsZero(v);
  return shown === undefined ? undefined : invisible(shown);
}

// The same question without composing a message — the product check below asks it of many
// combinations and reports only one of them.
function isUnbuildable(ft: number): boolean {
  return !(ft > 0) || displayedAsZero(ft) !== undefined;
}

// The magnitude the operator is SHOWN is not the shielding leaf on its own: an earth roof is
// built to leaf × the chosen standard's `coverMul`, and coverMul is a fillable doctrine leaf
// too. So a legible thickness and a legible multiplier can still multiply down to a roof the
// panel can only print as zero — the same unreadable, unbuildable state, reached through a
// product no leaf-by-leaf check can see. The build standard is the operator's choice at run
// time, so every standard's multiplier is in play; only the munitions that actually get an
// earth roof are, because an engineered roof never multiplies anything.
//
// Reported against the MULTIPLIER, and only for shielding values that are legible on their
// own. When the thickness is the unusable one it is already reported against its own row, and
// repeating it here would send the filler to the standards table to correct a shielding
// number — the wrong-table blame ROOF_NO_COVER_MULTIPLIER exists to avoid. One finding per
// multiplier, quoting the thickest requirement that multiplier scales out of sight.
function coverMultiplierWarnings(p: Prospective, flagged: ReadonlySet<string>): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];
  const roofed = Object.entries(threats).filter(([, t]) => t.roof === 'earth_on_stringers');
  for (const std of Object.values(standards)) {
    const mul = p.valueOf(std.coverMul);
    // A multiplier of zero or less is ABSENT in its own right and needs no victim to prove it:
    // it scales away every thickness the table could ever carry, and the engine already reads it
    // as the missing 'cover_multiplier'. Asked BEFORE the product walk so it is still named in
    // the one import that also leaves every shielding leaf unusable — the walk skips leaves that
    // are flagged on their own row, so with the whole table flagged there would be no legible
    // thickness left to quote and this multiplier would be the only absent value in the file
    // nobody was told about.
    if (!(mul > 0)) {
      out.push({
        path: p.pathOf(std.coverMul),
        reason:
          'a ' + std.label + ' roof is built to ' + mul + ' × the doctrinal cover — a multiplier of' +
          ' zero or less scales every thickness in the table away and reads as a MISSING value, so' +
          ' the roof falls to an engineered design whatever the shielding table says; applied,' +
          ' confirm against the build standard',
      });
      continue;
    }
    let worst: { label: string; mat: string; ft: number } | undefined;
    let affected = 0;
    for (const [id, t] of roofed) {
      const leaf = shielding[id]?.[t.coverMaterial];
      if (!leaf || flagged.has(p.pathOf(leaf))) continue;
      const ft = p.valueOf(leaf);
      if (!isUnbuildable(ft * mul)) continue;
      affected++;
      if (worst === undefined || ft > worst.ft) worst = { label: t.label, mat: t.coverMaterial, ft };
    }
    // No victim to quote. Either this multiplier leaves every legible thickness buildable —
    // nothing to say — or every thickness it touches is itself unusable and already reported on
    // its own row. In that second case the multiplier is not being excused: a POSITIVE multiplier
    // can only be convicted by a thickness that reads fine on its own, and none is left to convict
    // it with, so naming it here would send the filler to the standards table to correct the
    // shielding table. Nothing goes unsaid — every one of those rows carries its own finding in
    // this same report, the engine refuses to size a roof from any of them, and the moment one
    // legible thickness lands the product is re-derived against this same live multiplier and it
    // is named then.
    if (worst === undefined) continue;
    const w = worst;
    const scope = affected + ' of the ' + roofed.length + ' munitions that get an earth roof';
    const reason = unbuildableMagnitude(
      w.ft * mul,
      () =>
        'a ' + std.label + ' roof is built to ' + mul + ' × the doctrinal cover, which scales a real' +
        ' requirement (' + w.label + ', ' + w.ft + ' ft of ' + w.mat + ') to zero or less — a multiplier' +
        ' of zero or less reads as a MISSING value, and the roof falls to an engineered design;' +
        ' affects ' + scope + '; applied, confirm against the build standard',
      (shown) =>
        'a ' + std.label + ' roof over ' + w.label + ' is built to ' + w.ft + ' ft of ' + w.mat +
        ' × ' + mul + ', which the panel can only show as ' + shown + ' — the thickness reads fine' +
        ' on its own, so it is this multiplier that scales the cover out of sight; affects ' + scope +
        '; applied, confirm against the build standard',
    );
    if (reason !== undefined) out.push({ path: p.pathOf(std.coverMul), reason });
  }
  return out;
}

// The two protection ladders are not the whole of what the operator is SHOWN as protection.
// Every leaf below is a protective magnitude in its own right that the app puts in front of the
// operator as a length in feet — on the plan, on the job sheet, or as an operand of a tapped
// derivation trace — so the reading above applies to it leaf by leaf and unchanged:
//   · parapet.W / parapet.H — the frontal cover of an earth parapet and how much of it stands
//     above grade. The plan dimensions both and the job sheet prints them on one line.
//   · berm.W / berm.H — the same two for a vehicle hull-down, where the dozed spoil berm is the
//     ONLY protection the position has.
//   · backblast.clearanceFt — the rear danger area an ATGM crew must keep clear of people and
//     hard surfaces. The plan draws the zone to scale and dimensions it.
//   · overhead.setbackMin — the standoff of a position with NO named threat. An earlier round
//     excluded it because it "never reaches the formatter alone": the setback DIMENSION is
//     max(setbackMin, setbackDepthFrac × depthOfCut), so the other term usually binds. Measured,
//     that is true of the dimension and false of the leaf — with threat 'none' the roof-setback
//     trace prints THIS leaf as its own operand in feet (engine/explain.ts, 'munitionStandoff'),
//     and filled to zero the trace reads it out as no standoff at all. It is the one standoff of
//     the eighteen (every munition's, plus this fallback) that nothing checked, and the fallback
//     is exactly the case where nobody chose a threat to be checked instead.
//   · radiationHalving.* — the thickness of each material that halves a fallout dose. Also
//     excluded before, as "consumed as a divisor and never printed as a length". Measured, it is
//     printed: the specs panel carries a fallout-attenuation row, and its trace prints this leaf
//     as an operand in feet through the panel's own number formatter, which shows a tiny fill as
//     nothing. Worse, it is a DIVISOR — the attenuation is the roof thickness over it — so the
//     unreadable band inflates the protective claim instead of deleting it, the dangerous
//     direction, and a crew reads an earth roof as halving the dose a preposterous number of
//     times. The old exclusion's second ground ("a non-positive one already reads as no
//     attenuation") is true and covers only the non-positive case, which was never the problem.
// Zero or less means ABSENT (no thickness of earth stops a round, and no crew is safe standing
// at no backblast clearance); a hair above zero is a magnitude nobody can read off the screen or
// check against a pub. Unlike the roof, none of these has an engineered fail-safe behind it, and
// no validation code downstream asks about any of them: the app dimensions a parapet of no
// thickness while the BOM still bills the sandbag rest along its face, a hull-down still bills a
// berm fill of effectively nothing, and a roof whose halving thickness reads as absent simply
// drops the attenuation row without saying why. This report is the only place such a fill is
// questioned.
//
// What is still NOT here, and why: overhead.setbackDepthFrac is a unitless RATIO with no length
// display of its own, and it cannot empty the setback dimension by itself — that max() falls
// back to the standoff term, and every standoff is now checked, the fallback above included.
// spanSizes[].maxSpan is a span LIMIT rather than a length anyone builds to: its table's ORDER
// answers to a whole-table check that REFUSES the file, and a limit driven to nothing fails SAFE —
// the first-fit walk falls off the end of the table and the roof becomes engineered, so the app
// asks for a designer instead of printing a size (measured: an earth roof turns engineered and the
// span-exceeded warning fires). retainingWall.maxHeight is the threshold that trips the shoring
// warning rather than a thickness anyone builds to, and driving it down makes that warning fire on
// every cut — the loud direction (measured). retainingWall.thickness feeds no formula in src/ at all.
interface RenderedProtection {
  leaf: Provenance<number>;
  subject: string;
  kind: string;
  // What the app does with the fill anyway. Split, because the two states do not always have the
  // same consequence: a halving thickness of zero deletes the attenuation row, while one a hair
  // above zero prints an attenuation nothing could deliver.
  absent: string;
  invisible: string;
}

const PARAPET_DRAWN = 'the plan still dimensions a parapet and the BOM still bills the sandbag rest along its face';
const BERM_DRAWN = 'that berm is the only protection a hull-down position has, and the BOM still bills a fill for it';
const BACKBLAST_DRAWN = 'the plan still draws the danger zone and the crew is still told to keep it clear before firing';

const RENDERED_PROTECTION: RenderedProtection[] = [
  {
    leaf: parapet.W,
    subject: 'the frontal cover of an earth parapet',
    kind: 'thickness',
    absent: PARAPET_DRAWN,
    invisible: PARAPET_DRAWN,
  },
  {
    leaf: parapet.H,
    subject: 'the height an earth parapet stands above grade',
    kind: 'height',
    absent: 'the plan still dimensions a parapet height beside its thickness, on the same job-sheet line',
    invisible: 'the plan still dimensions a parapet height beside its thickness, on the same job-sheet line',
  },
  {
    leaf: berm.W,
    subject: 'the frontal cover of a vehicle spoil berm',
    kind: 'thickness',
    absent: BERM_DRAWN,
    invisible: BERM_DRAWN,
  },
  {
    leaf: berm.H,
    subject: 'the height a vehicle spoil berm stands above grade',
    kind: 'height',
    absent: 'the section still draws a berm and the BOM still bills the fill computed from that height',
    invisible: 'the section still draws a berm and the BOM still bills the fill computed from that height',
  },
  {
    leaf: backblast.clearanceFt,
    subject: 'the rear backblast danger area of an ATGM position',
    kind: 'clearance',
    absent: BACKBLAST_DRAWN,
    invisible: BACKBLAST_DRAWN,
  },
  {
    leaf: overhead.setbackMin,
    subject: 'the standoff of a position with no named threat',
    kind: 'standoff',
    absent: 'the roof-setback trace still prints it, in feet, as the standoff the setback was taken from',
    invisible: 'the roof-setback trace still prints it, in feet, as the standoff the setback was taken from',
  },
  ...shieldMaterials.map((mat) => ({
    leaf: radiationHalving[mat],
    subject: 'the thickness of ' + mat + ' that halves a fallout dose',
    kind: 'halving thickness',
    absent: 'the panel then prints no fallout attenuation at all for an earth roof of it',
    invisible:
      'the panel divides the roof thickness by it and prints the quotient as that roof\'s fallout' +
      ' attenuation, so a halving thickness too small to read prints protection no roof delivers',
  })),
];

function protectiveMagnitudeWarnings(p: Prospective): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];
  for (const m of RENDERED_PROTECTION) {
    const v = p.valueOf(m.leaf);
    const reason = unbuildableMagnitude(
      v,
      () =>
        m.subject + ' would be ' + v + ' ft — a protective ' + m.kind + ' of zero or less reads as a' +
        ' MISSING value, yet ' + m.absent + '; applied, confirm against the pub',
      (shown) =>
        m.subject + ' would be ' + v + ' ft — that rounds to zero as displayed (the panel can only' +
        ' show it as ' + shown + '), so nobody can read it off the screen or check it against a pub,' +
        ' yet ' + m.invisible + '; applied, confirm against the pub',
    );
    if (reason !== undefined) out.push({ path: p.pathOf(m.leaf), reason });
  }
  return out;
}

// Depth of cut is the protection a position gets from being IN the ground, and the plan
// dimensions it — but it is a PRODUCT of two fillable leaves, exactly like the roof:
// depthOfCut = the position's catalog hole depth × the build standard's depthMul. coverMul is
// checked here because it scales a rendered protective magnitude to display-zero; depthMul is
// its sibling in the same standards row and does the same to the depth of cut, which the drawing
// dimensions and the excavation bills. Neither leaf is marked safetyCritical — neither is
// coverMul — and nothing downstream objects: measured, a depth multiplier a hair above zero
// leaves the plan dimensioning a position of no depth while the roof over it is still sized,
// stringered and billed in full, and the only code the fill adds is a spoil shortfall — a
// finding about the spoil, which says nothing about the hole not being there.
//
// So the same two-part shape as the roof: the depths leaf by leaf, the multiplier through the
// product, and blame on whichever table is at fault — a depth that is unusable on its own is
// reported against the position catalog and excluded from the product walk, so the filler is
// never sent to the standards table to correct a position's depth.
function depthOfCutWarnings(p: Prospective): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];
  const flagged = new Set<string>();
  const catalog = Object.values(positions);
  for (const pos of catalog) {
    const v = p.valueOf(pos.hole.D);
    const reason = unbuildableMagnitude(
      v,
      () =>
        'the ' + pos.label + ' would be dug ' + v + ' ft deep — a depth of cut of zero or less reads' +
        ' as a MISSING value, yet the plan still dimensions the position and any roof over it is' +
        ' still sized, stringered and billed unchanged; applied, confirm against the pub',
      (shown) =>
        'the ' + pos.label + ' would be dug ' + v + ' ft deep — that rounds to zero as displayed (the' +
        ' plan can only dimension it as ' + shown + '), so the position offers no defilade anybody' +
        ' can read, yet any roof over it is still sized, stringered and billed unchanged; applied,' +
        ' confirm against the pub',
    );
    if (reason !== undefined) {
      const path = p.pathOf(pos.hole.D);
      flagged.add(path);
      out.push({ path, reason });
    }
  }
  for (const std of Object.values(standards)) {
    const mul = p.valueOf(std.depthMul);
    // Absent in its own right, like the cover multiplier: it takes every depth in the catalog
    // away at once, so it needs no victim to prove it and is named even when every depth is
    // already flagged on its own row.
    if (!(mul > 0)) {
      out.push({
        path: p.pathOf(std.depthMul),
        reason:
          'a ' + std.label + ' position is dug to ' + mul + ' × the catalog depth — a multiplier of' +
          ' zero or less reads as a MISSING value and leaves every position in the catalog with no' +
          ' depth of cut at all, while any roof over it is still sized, stringered and billed' +
          ' unchanged; applied, confirm against the build standard',
      });
      continue;
    }
    let worst: { label: string; ft: number } | undefined;
    let affected = 0;
    for (const pos of catalog) {
      if (flagged.has(p.pathOf(pos.hole.D))) continue;
      const d = p.valueOf(pos.hole.D);
      if (!isUnbuildable(d * mul)) continue;
      affected++;
      if (worst === undefined || d > worst.ft) worst = { label: pos.label, ft: d };
    }
    // Same reading as the cover multiplier: with no legible depth left to convict it, a POSITIVE
    // multiplier is left to the catalog rows that already carry their own finding.
    if (worst === undefined) continue;
    const w = worst;
    const reason = unbuildableMagnitude(
      w.ft * mul,
      () =>
        'a ' + std.label + ' position is dug to ' + mul + ' × the catalog depth, which scales a real' +
        ' depth (' + w.label + ', ' + w.ft + ' ft) to zero or less — a depth of cut of zero or less' +
        ' reads as a MISSING value; affects ' + affected + ' of the ' + catalog.length + ' positions' +
        ' in the catalog; applied, confirm against the build standard',
      (shown) =>
        'the ' + w.label + ' under the ' + std.label + ' standard is dug to ' + w.ft + ' ft × ' + mul +
        ', which the plan can only dimension as ' + shown + ' — the catalog depth reads fine on its' +
        ' own, so it is this multiplier that takes the defilade away; affects ' + affected + ' of the ' +
        catalog.length + ' positions in the catalog; applied, confirm against the build standard',
    );
    if (reason !== undefined) out.push({ path: p.pathOf(std.depthMul), reason });
  }
  return out;
}

function unbuildableWarnings(p: Prospective): DoctrineFinding[] {
  const out: DoctrineFinding[] = [];
  // Which shielding leaves are unusable in their own right — the product check below excludes
  // them so a bad thickness is blamed on the shielding table once, not on every multiplier.
  const flagged = new Set<string>();
  for (const [id, row] of Object.entries(shielding)) {
    for (const mat of shieldMaterials) {
      const leaf = row[mat];
      const v = p.valueOf(leaf);
      const reason = unbuildableMagnitude(
        v,
        () =>
          threats[id]!.label + ' would be fully stopped by ' + v + ' ft of ' + mat +
          ' — a protective thickness of zero or less reads as a MISSING value, and a roof sized' +
          ' from it falls to an engineered design; applied, confirm against the pub',
        (shown) =>
          threats[id]!.label + ' would be fully stopped by ' + v + ' ft of ' + mat +
          ' — that rounds to zero as displayed (the panel can only show it as ' + shown + '), so' +
          ' nobody can read or build the cover it asks for; applied, confirm against the pub',
      );
      if (reason !== undefined) {
        const path = p.pathOf(leaf);
        flagged.add(path);
        out.push({ path, reason });
      }
    }
  }
  out.push(...coverMultiplierWarnings(p, flagged));
  for (const t of Object.values(threats)) {
    const v = p.valueOf(t.standoffMin);
    const reason = unbuildableMagnitude(
      v,
      () =>
        t.label + ' would be safe at ' + v + ' ft of standoff — a standoff of zero or less reads' +
        ' as a MISSING value, and standoff drives the roof setback; applied, confirm against the pub',
      (shown) =>
        t.label + ' would be safe at ' + v + ' ft of standoff — that rounds to zero as displayed' +
        ' (the panel can only show it as ' + shown + '), and standoff drives the roof setback;' +
        ' applied, confirm against the pub',
    );
    if (reason !== undefined) out.push({ path: p.pathOf(t.standoffMin), reason });
  }
  out.push(...protectiveMagnitudeWarnings(p));
  out.push(...depthOfCutWarnings(p));
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
  const out: DoctrineFinding[] = [...unbuildableWarnings(p)];

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
