// Generates the TABLE sections of DOCTRINE_SOURCES.md from the live doctrine registry.
//
// The checklist's tables are not hand-maintained: this script walks `all()` (every registered
// Provenance leaf) and emits exactly one row per leaf — path, current illustrative value, unit,
// `[SC]` mark, and a per-family "Likely source (TODO)" pointer — so the checklist can never cover
// fewer leaves than the registry holds. The hand-written prose around the tables (header,
// how-to-read, safety-critical list, source-lineage note, filling procedure) is left exactly as
// committed; only the region between the BEGIN/END markers is rewritten. The `Filled?` and
// `Verified by` cells are the two human columns: the generator carries any non-blank cell forward
// by path, so a qualified user's marks survive a regeneration.
//
// Run:   node --import tsx scripts/gen-doctrine-sources.ts
// Gate:  test/doctrine-sources-drift.test.ts re-runs this generation against the committed file
//        on every test run and fails on any difference.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import '../src/doctrine/index';
import { all } from '../src/doctrine/registry';
import type { RegEntry } from '../src/doctrine/registry';

export const DOC_PATH = fileURLToPath(new URL('../DOCTRINE_SOURCES.md', import.meta.url));

export const BEGIN_MARKER =
  '<!-- BEGIN GENERATED DOCTRINE TABLES — written by scripts/gen-doctrine-sources.ts; checked by'
  + ' test/doctrine-sources-drift.test.ts. Edit only the Filled? / Verified by cells by hand. -->';
export const END_MARKER = '<!-- END GENERATED DOCTRINE TABLES -->';

// ── "Likely source (TODO)" pointers, per family ──────────────────────────────
// Guidance-only strings (see the checklist's source-lineage note): they say where the current
// survivability lineage would be consulted and assert no value. First matching rule wins; the
// fallback keeps the mapping total so a brand-new leaf still gets a row (with generic guidance)
// the moment it is registered.
const LIKELY_SOURCE: [RegExp, string][] = [
  [/^protection\.shielding\.(at-|blast-vbied)/, 'Protective-construction / engineer design — engineered, confirm'],
  [/^protection\.shielding\.blast-/, 'Protective-construction / blast lineage — confirm'],
  [/^protection\.shielding\./, 'ATP 3-37.34 survivability lineage — confirm'],
  [/^protection\.threats\.at-/, 'Protective-construction / engineer design — confirm'],
  [/^protection\.threats\.blast-/, 'Protective-construction / blast standoff lineage — confirm'],
  [/^protection\.threats\./, 'Antiterrorism / protective-construction standoff lineage — confirm'],
  [/^protection\.radiationHalving\./, 'CBRN / protective-construction shielding lineage — confirm'],
  [/^protection\.parapet\./, 'ATP 3-37.34 survivability lineage (frontal cover) — confirm'],
  [/^protection\.berm\./, 'ATP 3-37.34 survivability lineage (frontal cover, vehicle berm) — confirm'],
  [/^protection\.overhead\.setbackMin$/, 'ATP 3-37.34 overhead-cover / standoff lineage — confirm'],
  [/^protection\.overhead\.endLap$/, 'No published figure found (see leaf note) — confirm whether one exists'],
  [/^protection\.overhead\./, 'ATP 3-37.34 overhead-cover lineage — confirm'],
  [/^protection\.spanSizes\[/, 'ATP 3-37.34 overhead-cover span/stringer lineage — confirm'],
  [/^protection\.retainingWall\./, 'ATP 3-37.34 revetment / retaining lineage — confirm'],
  [/^positions\.(one_man|two_man)\./, 'ATP 3-37.34 fighting-position geometry — confirm'],
  [/^positions\.connecting_trench\./, 'ATP 3-37.34 trench / fighting-position geometry — confirm'],
  [/^positions\.(mg_crew|fifty_cal|atgm_javelin)\./, 'ATP 3-37.34 crew-served position geometry — confirm'],
  [/^positions\.mortar_pit\./, 'ATP 3-37.34 mortar-position geometry — confirm'],
  [/^positions\.vehicle_/, 'ATP 3-37.34 vehicle-defilade geometry — confirm'],
  [/^positions\.bunker_op_cp\./, 'ATP 3-37.34 bunker / protective-construction geometry — confirm'],
  [/^vehicle\.ramp\./, 'ATP 3-37.34 vehicle-defilade geometry — confirm'],
  [/^weapons\.backblast\./, 'Weapon-system TM backblast danger-area lineage — confirm'],
  [/^features\.firingStep\./, 'No published figure — model-derived (see leaf note); confirm the modeling, not a number'],
  [/^features\.mortarPit\./, 'ATP 3-37.34 mortar-position geometry — confirm'],
  [/^features\.access\./, 'ATP 3-37.34 survivability / access lineage — confirm'],
  [/^soils\.[\w-]+\.digFactor$/, 'ATP 3-37.34 soil / excavation lineage — confirm'],
  [/^soils\.[\w-]+\.wallSlopeRatio$/, 'ATP 3-37.34 excavation slope-stability lineage — confirm'],
  [/^soils\.[\w-]+\.revetForced$/, 'ATP 3-37.34 revetment lineage — confirm'],
  [/^standards\./, 'ATP 3-37.34 build-standard lineage — confirm'],
  [/^materials\.sandbag\.wasteFactor$/, 'Construction estimating practice — confirm'],
  [/^materials\.sandbag\./, 'ATP 3-37.34 revetment / sandbag lineage — confirm'],
  [/^materials\.revetments\./, 'ATP 3-37.34 revetment (picket) lineage — confirm'],
  [/^materials\.camo\./, 'Camouflage / concealment lineage — confirm'],
  [/^materials\.sump\./, 'ATP 3-37.34 grenade-sump lineage — confirm'],
  [/^materials\.excavation\./, 'Earthwork / excavation estimating practice — confirm'],
  [/^materials\.machine\./, 'Engineer equipment productivity lineage — confirm'],
  [/^labor\./, 'ATP 3-37.34 / engineer estimating lineage — confirm'],
  [/^stages\./, 'ATP 3-37.34 priorities-of-work / build-sequence lineage — confirm'],
];
const FALLBACK_SOURCE = 'Current survivability lineage (see source-lineage note) — confirm';

export function likelySourceFor(path: string): string {
  for (const [re, text] of LIKELY_SOURCE) if (re.test(path)) return text;
  return FALLBACK_SOURCE;
}

// ── Sections ─────────────────────────────────────────────────────────────────
// Purely presentational grouping of the one-row-per-leaf tables. A leaf no section claims falls
// into an automatic per-family section at the end, so grouping can never cost the checklist a row.
interface Section {
  match: RegExp;
  heading: string;
  intro: string[]; // prose lines emitted above the table
  after?: string[]; // prose lines emitted below the table (blockquote notes)
}

const SECTIONS: Section[] = [
  {
    match: /^protection\.shielding\./,
    heading: '### Per-threat shielding thickness — `protection.shielding.<threatId>.<material>`',
    intro: [
      'One row per threat × shield material. Every leaf is a safety-critical placeholder',
      'thickness in feet; the shipped seeds are derived from an illustrative per-threat base',
      'times an illustrative material factor and confirm nothing.',
    ],
    after: [
      '> **HARD SAFETY INVARIANT (do not defeat when filling):** direct-fire AT',
      '> (`at-rpg`, `at-recoilless`, `at-tank`, `at-he-contact`) and large VBIED',
      '> (`blast-vbied`) resolve to `roofPath: \'engineered_required\'`. The engine emits',
      '> **zero** fabricated cover thickness for these and the section draws an',
      '> **"ENGINEERED ROOF — SEE ENGINEER"** hazard block. Filling a shielding leaf for',
      '> these threats does **not** authorize a fabricated roof number — the engineered',
      '> path is by design. Never substitute a made-up thickness for the engineer\'s',
      '> determination.',
    ],
  },
  {
    match: /^protection\.threats\./,
    heading: '### Per-threat standoff — `protection.threats.<threatId>.standoffMin`',
    intro: [
      'Each threat\'s minimum standoff/setback (ft) — safety-critical placeholders.',
    ],
    after: [
      '> Note: each threat also carries an illustrative `base` seed and a qualitative',
      '> `coverMaterial` / `roof` classification. `base` is not a standalone registered',
      '> leaf (it drives the shielding table above); `coverMaterial` and `roof` are',
      '> qualitative structure, not P()-wrapped values. The mm caliber is a definitional',
      '> identifier, **not** a value to confirm.',
    ],
  },
  {
    match: /^protection\.radiationHalving\./,
    heading: '### Radiation halving thickness — `protection.radiationHalving.<material>`',
    intro: ['Halving thickness per shield material (ft) — safety-critical placeholders.'],
  },
  {
    match: /^protection\.parapet\./,
    heading: '### Parapet — `protection.parapet.<dim>`',
    intro: ['Frontal cover of an earth parapet: thickness and height above grade.'],
  },
  {
    match: /^protection\.berm\./,
    heading: '### Vehicle spoil berm — `protection.berm.<dim>`',
    intro: ['Frontal cover of a vehicle defilade\'s dozed spoil berm: thickness and height.'],
  },
  {
    match: /^protection\.overhead\./,
    heading: '### Overhead-cover chain — `protection.overhead.<name>`',
    intro: [
      'Roof standoff, stringer bearing, deck laps, spacing, and layer thicknesses.',
    ],
  },
  {
    match: /^protection\.spanSizes\[/,
    heading: '### Stringer spans and sections — `protection.spanSizes[<i>].<name>`',
    intro: [
      'Each table entry pairs a max load span with a member size: `maxSpan` is the span limit',
      'the member is sized from, `sectionFt` the dressed cross-section it is drawn and built',
      'at. Both are safety-critical; the `sizeLabel` is qualitative.',
    ],
    after: [
      '> Spans beyond the tabulated maximum return `\'engineered\'` (designer decides) —',
      '> filling these does not extend the engine into fabricating a member for an',
      '> untabulated span. The import path refuses a span table out of ascending order.',
    ],
  },
  {
    match: /^protection\.retainingWall\./,
    heading: '### Retaining / revetment wall limits — `protection.retainingWall.<name>`',
    intro: ['Structural limits — safety-critical placeholders.'],
  },
  {
    match: /^positions\./,
    heading: '## positions — position geometry (`src/doctrine/positions.ts`)',
    intro: [
      'Geometry magnitudes (feet) only. Crew size, sump/elbow-hole counts, `shape`, and',
      'boolean flags are qualitative definition, not P()-wrapped values, so they are not',
      'fill leaves. None of these dimensions are authoritative — confirm against the',
      'current survivability ATP before any use.',
    ],
  },
  {
    match: /^vehicle\./,
    heading: '## vehicle — defilade ramp doctrine (`src/doctrine/positions.ts`)',
    intro: [
      'The access-ramp grade a vehicle descends into its cut (safety-critical) and the',
      'ramp/pan split of the position\'s run.',
    ],
  },
  {
    match: /^weapons\./,
    heading: '## weapons — backblast clearance (`src/doctrine/positions.ts`)',
    intro: ['The rear danger area an ATGM crew keeps clear — safety-critical placeholder.'],
  },
  {
    match: /^features\./,
    heading: '## features — drawn position features (`src/doctrine/positions.ts`)',
    intro: [
      'The firing-step ledge, the mortar-pit wall batter, and the way in and out (entrance',
      'passage, backblast lane, earth steps). The firing-step leaves have **no published',
      'doctrinal figure** — they are model-derived and say so in their notes.',
    ],
  },
  {
    match: /^soils\./,
    heading: '## soils — soil behavior (`src/doctrine/soils.ts`)',
    intro: [
      'Per soil: a dig-labor multiplier, a required cut-wall slope (H per 1 V), and a',
      'boolean "revetment forced by soil" flag. All P()-wrapped placeholders.',
    ],
  },
  {
    match: /^standards\./,
    heading: '## standards — build-standard multipliers (`src/doctrine/standards.ts`)',
    intro: [
      'How hasty / deliberate / reinforced scale depth, cover, and labor relative to the',
      'position\'s base geometry. All P()-wrapped placeholders.',
    ],
  },
  {
    match: /^materials\./,
    heading: '## materials — materials & construction factors (`src/doctrine/materials.ts`)',
    intro: [
      'Sandbag geometry and load, revetment picket spacing/wire, camo drape, grenade sump,',
      'excavation swell, and machine assist. Labels, `kind`, and `buildsFace` are',
      'qualitative structure, not fill leaves.',
    ],
  },
  {
    match: /^labor\./,
    heading: '## labor — man-hour rates & feature adders (`src/doctrine/labor.ts`)',
    intro: [
      'Base per-position labor plus per-volume and per-feature adders. All P()-wrapped',
      'placeholders. Dig productivity varies enormously with soil, tools, fatigue, and',
      'weather — these are illustrative only.',
    ],
  },
  {
    match: /^stages\./,
    heading: '## stages — excavation-stage shares (`src/doctrine/stages.ts`)',
    intro: [
      'How the excavation labor splits across the earthmoving stages. The shares partition',
      'one man-hour total, so the import path refuses a fill whose shares do not sum to 1.',
    ],
  },
];

// ── Row formatting / parsing ─────────────────────────────────────────────────

const cell = (s: string): string => s.replace(/\|/g, '\\|');

const fmtValue = (e: RegEntry): string =>
  String(e.value) + (e.unit !== undefined ? ' ' + e.unit : '') + ' (illustrative)';

const TABLE_HEADER = '| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |';
const TABLE_DIVIDER = '|---|---|---|---|---|';

function rowFor(e: RegEntry, human: Map<string, { filled: string; verified: string }>): string {
  const constant =
    '`' + e.path + '`' + (e.safetyCritical ? ' [SC]' : '') + (e.note !== undefined ? ' — ' + cell(e.note) : '');
  const h = human.get(e.path);
  return (
    '| ' + constant + ' | ' + cell(fmtValue(e)) + ' | ' + cell(likelySourceFor(e.path)) + ' | '
    + (h ? h.filled : '') + ' | ' + (h ? h.verified : '') + ' |'
  );
}

export interface ChecklistRow {
  path: string;
  sc: boolean;
  current: string;
  source: string;
  filled: string;
  verified: string;
}

/** Parse the leaf rows out of a committed DOCTRINE_SOURCES.md (its generated region only). */
export function extractRows(doc: string): ChecklistRow[] {
  const region = generatedRegionOf(doc);
  const out: ChecklistRow[] = [];
  for (const line of region.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').map((c) => c.trim());
    // ['', constant, current, source, filled, verified, '']
    if (cells.length !== 7) continue;
    const m = /^`([^`]+)`( \[SC\])?/.exec(cells[1]!);
    if (m === null) continue;
    out.push({
      path: m[1]!,
      sc: m[2] !== undefined,
      current: cells[2]!,
      source: cells[3]!,
      filled: cells[4]!,
      verified: cells[5]!,
    });
  }
  return out;
}

function generatedRegionOf(doc: string): string {
  const i = doc.indexOf(BEGIN_MARKER);
  const j = doc.indexOf(END_MARKER);
  if (i < 0 || j < 0 || j < i) {
    throw new Error('DOCTRINE_SOURCES.md is missing its BEGIN/END generated-table markers');
  }
  return doc.slice(i + BEGIN_MARKER.length, j);
}

// ── Generation ───────────────────────────────────────────────────────────────

/** Build the full new document from the committed one: prose kept, tables regenerated. */
export function buildFile(committed: string): string {
  const entries = all();
  if (entries.length === 0) throw new Error('doctrine registry is empty — import order bug');

  // Carry the two human columns forward by path.
  const human = new Map<string, { filled: string; verified: string }>();
  for (const r of extractRows(committed)) {
    if (r.filled !== '' || r.verified !== '') human.set(r.path, { filled: r.filled, verified: r.verified });
  }

  const used = new Set<string>();
  const lines: string[] = [];
  const emitTable = (rows: RegEntry[]): void => {
    lines.push(TABLE_HEADER, TABLE_DIVIDER);
    for (const e of rows) lines.push(rowFor(e, human));
  };

  lines.push('');
  lines.push(
    'One row per registered leaf — ' + entries.length + ' rows. `[SC]` marks a leaf tagged',
    '`safetyCritical: true` in source. Every value is an illustrative placeholder;',
    'every "Likely source (TODO)" cell is guidance only and asserts no value.',
    '',
  );

  for (const sec of SECTIONS) {
    const rows = entries.filter((e) => !used.has(e.path) && sec.match.test(e.path));
    if (rows.length === 0) continue;
    for (const r of rows) used.add(r.path);
    lines.push(sec.heading, '');
    lines.push(...sec.intro, '');
    emitTable(rows);
    lines.push('');
    if (sec.after !== undefined) lines.push(...sec.after, '');
  }

  // Any leaf no section claimed still gets a row, grouped by family — grouping is cosmetic and
  // must never cost the checklist a leaf.
  const leftover = entries.filter((e) => !used.has(e.path));
  const families = [...new Set(leftover.map((e) => e.path.split(/[.[]/)[0]!))].sort();
  for (const fam of families) {
    const rows = leftover.filter((e) => e.path.split(/[.[]/)[0] === fam);
    lines.push('## ' + fam + ' — leaves not yet grouped above', '');
    lines.push('Registered leaves with no dedicated section yet; fill them like any other row.', '');
    emitTable(rows);
    lines.push('');
  }

  // Every leaf exactly once, no row without a leaf — checked here as well as in the drift test.
  const emitted = extractRows(
    BEGIN_MARKER + '\n' + lines.join('\n') + '\n' + END_MARKER,
  );
  const emittedPaths = new Set(emitted.map((r) => r.path));
  if (emitted.length !== entries.length || emittedPaths.size !== entries.length) {
    throw new Error(
      'row/leaf mismatch: ' + entries.length + ' leaves, ' + emitted.length + ' rows ('
      + emittedPaths.size + ' distinct)',
    );
  }
  for (const e of entries) {
    if (!emittedPaths.has(e.path)) throw new Error('no row emitted for leaf ' + e.path);
  }

  const i = committed.indexOf(BEGIN_MARKER);
  const j = committed.indexOf(END_MARKER);
  if (i < 0 || j < 0 || j < i) {
    throw new Error('DOCTRINE_SOURCES.md is missing its BEGIN/END generated-table markers');
  }
  return committed.slice(0, i + BEGIN_MARKER.length) + '\n' + lines.join('\n') + '\n' + committed.slice(j);
}

function main(): void {
  const committed = readFileSync(DOC_PATH, 'utf8');
  const next = buildFile(committed);
  if (next === committed) {
    console.log('DOCTRINE_SOURCES.md already matches the live registry (' + all().length + ' leaves)');
    return;
  }
  writeFileSync(DOC_PATH, next);
  const rows = extractRows(next);
  const sc = rows.filter((r) => r.sc).length;
  console.log(
    'DOCTRINE_SOURCES.md regenerated: ' + rows.length + ' rows (' + sc + ' [SC]) for '
    + all().length + ' registered leaves',
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
