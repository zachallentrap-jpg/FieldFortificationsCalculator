// SVG string primitives (§10). Pure string-returning helpers — no DOM. Every numeric
// attribute is guarded: a non-finite value THROWS immediately (§2.6) so a bad number can
// never reach an SVG attribute as NaN/Infinity; the error boundary catches it and the fuzz
// test proves it never happens in practice. Text content is escaped.
//
// The numbered-callout registry lives here so the reference SVG and the live renderers share
// ONE source of truth: a callout number and its legend name can never drift (§10, D12).

export type Attr = Record<string, string | number>;

function guard(n: number, ctx: string): number {
  if (!Number.isFinite(n)) throw new Error('non-finite SVG value (' + ctx + '): ' + String(n));
  return n;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;');
}

function attrsToStr(a: Attr): string {
  let out = '';
  for (const [k, v] of Object.entries(a)) {
    const val = typeof v === 'number' ? String(guard(v, k)) : escAttr(v);
    out += ' ' + k + '="' + val + '"';
  }
  return out;
}

const VOID = new Set(['rect', 'circle', 'line', 'polyline', 'polygon', 'path', 'use', 'image']);

export function el(tag: string, a: Attr = {}, inner = ''): string {
  const open = '<' + tag + attrsToStr(a);
  if (inner === '' && VOID.has(tag)) return open + ' />';
  return open + '>' + inner + '</' + tag + '>';
}

export function group(a: Attr, ...children: string[]): string {
  return el('g', a, children.join(''));
}

export function textEl(x: number, y: number, s: string, a: Attr = {}): string {
  return el('text', { x, y, ...a }, esc(s));
}

// ── Callout registry (§10) — stable numbers shared across ALL views ──────────────
export interface CalloutDef {
  n: number;
  label: string;
}
// Labels are PLAIN LANGUAGE FIRST, with the military/engineering term kept in parentheses
// (the master vocabulary still appears, satisfying the fixed-vocabulary + docs requirement,
// but nobody has to already know the jargon to read the legend). 'Sectors of fire' is pinned
// by test/render-intuitive.test.ts (exact aria-label match) — do not reword it.
export const CALLOUTS: Record<string, CalloutDef> = {
  grade: { n: 1, label: 'Ground level (existing grade)' },
  spoil: { n: 2, label: 'Dug-out dirt (spoil)' },
  parapet: { n: 3, label: 'Dirt wall up front (parapet)' },
  bay: { n: 4, label: 'Where you stand and fight (the bay)' },
  overhead: { n: 5, label: 'Roof overhead (overhead cover)' },
  sump: { n: 6, label: 'Grenade catch-pit (sump)' },
  stringers: { n: 7, label: 'Roof support beams (stringers)' },
  firing_step: { n: 8, label: 'Step up to shoot (firing step)' },
  setback: { n: 9, label: 'Safety gap under the roof (setback)' },
  engineered: { n: 10, label: 'Needs an engineer’s design (no roof shown)' },
  sectors: { n: 11, label: 'Sectors of fire' },
  enemy: { n: 12, label: 'Enemy direction' },
  berm: { n: 13, label: 'Dozed dirt mound up front (berm)' },
  ramp: { n: 14, label: 'Vehicle access ramp' },
};

// Disc sizes meet the legibility floor (--disc-min-px 16, --label-min-px 11).
const DISC_R = 9;
const DISC_FONT = 11;

// A callout disc. Registers the name in `used` so the legend can be generated from exactly
// the callouts a view drew (numbers & legend can never fall out of sync).
export function callout(name: keyof typeof CALLOUTS | string, x: number, y: number, used?: Set<string>): string {
  const def = CALLOUTS[name];
  if (!def) return '';
  if (used) used.add(name);
  return group(
    { class: 'callout', 'aria-label': def.label },
    el('circle', { cx: x, cy: y, r: DISC_R, fill: 'var(--callout-fill)', stroke: 'var(--surface)', 'stroke-width': 1.5 }),
    textEl(x, y + 0.35 * DISC_FONT, String(def.n), {
      fill: 'var(--callout-text)',
      'font-size': DISC_FONT,
      'font-weight': '700',
      'text-anchor': 'middle',
      'font-family': 'ui-monospace, monospace',
    }),
  );
}

export interface LegendEntry {
  n: number;
  label: string;
}
export function buildLegend(used: Set<string>): LegendEntry[] {
  const entries: LegendEntry[] = [];
  for (const name of used) {
    const def = CALLOUTS[name];
    if (def) entries.push({ n: def.n, label: def.label });
  }
  entries.sort((a, b) => a.n - b.n);
  return entries;
}
