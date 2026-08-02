// SVG emission layer (blueprint §4.4): every numeric attribute passes through ONE
// fmt() with fixed decimal quantization — ULP/libm drift vanishes below the quantum
// and byte-determinism of vector artifacts follows (N3 scope). Raw number
// interpolation in render/ is lint-banned (G-9); this module is the only place a
// number becomes attribute text.

const QUANTUM_DECIMALS = 2;

export const fmt = (n: number): string => {
  if (!Number.isFinite(n)) throw new Error('non-finite coordinate reached fmt()');
  const s = n.toFixed(QUANTUM_DECIMALS);
  // Normalize negative zero and strip trailing zeros for stable, minimal bytes.
  const trimmed = s.replace(/\.?0+$/, '');
  return trimmed === '-0' ? '0' : trimmed;
};

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type Attrs = Readonly<Record<string, string | number>>;

const attrText = (a: Attrs): string =>
  Object.entries(a)
    .map(([k, v]) => ` ${k}="${typeof v === 'number' ? fmt(v) : esc(v)}"`)
    .join('');

export const el = (tag: string, attrs: Attrs, children: readonly string[] = []): string =>
  children.length === 0
    ? `<${tag}${attrText(attrs)}/>`
    : `<${tag}${attrText(attrs)}>${children.join('')}</${tag}>`;

export const text = (attrs: Attrs, content: string): string =>
  `<text${attrText(attrs)}>${esc(content)}</text>`;

/** Root wrapper: self-contained by construction — viewBox, embedded nothing,
 *  referenced nothing. Title/desc give the drawing an accessible name (role=img). */
export const svgDoc = (
  o: { w: number; h: number; title: string; desc: string },
  children: readonly string[],
): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(o.w)} ${fmt(o.h)}" role="img" aria-labelledby="t d">` +
  `<title id="t">${esc(o.title)}</title><desc id="d">${esc(o.desc)}</desc>` +
  children.join('') +
  '</svg>';
