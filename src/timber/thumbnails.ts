// TIMBER-2 — picker card art (plan §4.4, TD11).
//
// The card images are RUNTIME SVG line-art projected from the engine's own `Member[]`. No
// build step, no image files, nothing in the bundler's asset path. That decision kills a
// whole class of problem by construction: the deploy sandbox never has to render anything,
// the offline scan has no new files to find, and a thumbnail cannot drift from the structure
// it depicts because it IS the structure, drawn.
//
// Determinism is a hard requirement (goldens are committed SVG files, string-compared), so:
//   - the projection basis is precomputed as literals — no runtime trig reaches the output;
//   - every coordinate is rounded to one decimal;
//   - members are drawn in engine emission order, never sorted by depth.
//
// `thumbLod` is the DEFAULT, not an escape hatch: coverings and decking are skipped so the
// card reads as a structure rather than a solid box.

import type { Member } from './types';
import type { StructureSpec } from './spec';
import { generateStructure } from './families/index';

/**
 * Isometric basis, precomputed. Yaw 34°, pitch 24° — chosen so a rectangular building shows
 * two walls and the roof, which is how a carpenter recognizes one at a glance.
 *   cos34 = 0.8290375726, sin34 = 0.5591929035
 *   cos24 = 0.9135454576, sin24 = 0.4067366431
 */
const CY = 0.8290375726;
const SY = 0.5591929035;
const CP = 0.9135454576;
const SP = 0.4067366431;

/** Roles a thumbnail skips: sheet goods hide the frame that identifies the structure. */
const LOD_SKIP: ReadonlySet<string> = new Set([
  'subfloor', 'roofPanel', 'sheathingPanel', 'siding', 'sidingBoard', 'batten',
  'roofingCourse', 'ridgeCap', 'felt', 'buildingPaper', 'deckPlank', 'slab', 'soilGhost',
]);

/** Roles drawn heavier — the silhouette a reader recognizes first. */
const HEAVY: ReadonlySet<string> = new Set([
  'post', 'girder', 'sill', 'rafter', 'ridge', 'towerLeg', 'capBeam', 'foundationWall', 'skid',
]);

export interface ThumbOptions {
  width?: number;
  height?: number;
  /** Stamp a 6-ft human so relative scale reads at a glance (plan §4.4). */
  human?: boolean;
  lod?: boolean;
  /**
   * Member ids to pick out of the structure — the flashcard's "which one is this?" art.
   * Everything else drops to a ghost line so the piece reads against its own building rather
   * than floating on white, which is the difference between recognizing a jack stud and
   * memorizing a shape. Highlighted members bypass the LOD skip: if the card is about a
   * subfloor panel, the card has to show the subfloor panel.
   */
  highlight?: ReadonlySet<string>;
  /**
   * Draw only what is up by this stage. A piece is far easier to place when the building around
   * it is the building that was standing when it went in — a rafter shown against a finished,
   * sided box is a rafter you cannot see.
   */
  stageMax?: number;
}

interface Pt2 { x: number; y: number }

function project(x: number, y: number, z: number): Pt2 {
  // Standard isometric-ish: rotate about Y by yaw, then tilt.
  const px = x * CY - z * SY;
  const pz = x * SY + z * CY;
  return { x: px, y: -(y * CP) + pz * SP };
}

/** Rotate a local offset into world space using the member's YXZ euler. */
function rotateLocal(m: Member, v: [number, number, number]): [number, number, number] {
  const [rx, ry, rz] = m.rotation;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  let [a, b, c] = v;
  [a, b] = [a * cz - b * sz, a * sz + b * cz];
  [b, c] = [b * cx - c * sx, b * sx + c * cx];
  [a, c] = [a * cy + c * sy, -a * sy + c * cy];
  return [a, b, c];
}

/**
 * A thin member as a single stroke down its length. Framing lumber reads as LINES at card
 * size — drawing all twelve edges of a 1.5-inch-thick stud spends twelve segments to render
 * something two pixels wide, and a 48-ft building's worth of that blows the size budget while
 * looking worse (the doubled edges just thicken into mud).
 */
function memberCenterline(m: Member): [Pt2, Pt2][] {
  const half = m.cutLength / 12 / 2;
  const [ax, ay, az] = rotateLocal(m, [-half, 0, 0]);
  const [bx, by, bz] = rotateLocal(m, [half, 0, 0]);
  return [[
    project(m.position[0] + ax, m.position[1] + ay, m.position[2] + az),
    project(m.position[0] + bx, m.position[1] + by, m.position[2] + bz),
  ]];
}

/** The eight corners of a member's box, in world space. */
function memberSegments(m: Member): [Pt2, Pt2][] {
  const lenFt = m.cutLength / 12;
  const wFt = m.actual.w / 12;
  const dFt = m.actual.d / 12;
  const [rx, ry, rz] = m.rotation;
  // Rotation order 'YXZ', matching the member frame.
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const rot = (v: [number, number, number]): [number, number, number] => {
    // Z then X then Y (intrinsic YXZ applied to a local vector).
    let [a, b, c] = v;
    [a, b] = [a * cz - b * sz, a * sz + b * cz];
    [b, c] = [b * cx - c * sx, b * sx + c * cx];
    [a, c] = [a * cy + c * sy, -a * sy + c * cy];
    return [a, b, c];
  };
  const hx = lenFt / 2, hy = dFt / 2, hz = wFt / 2;
  const corners: Pt2[] = [];
  for (const sxn of [-1, 1] as const) {
    for (const syn of [-1, 1] as const) {
      for (const szn of [-1, 1] as const) {
        const [a, b, c] = rot([sxn * hx, syn * hy, szn * hz]);
        corners.push(project(m.position[0] + a, m.position[1] + b, m.position[2] + c));
      }
    }
  }
  // The 12 edges of the box, by corner index (bit order: x,y,z).
  const E: [number, number][] = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return E.map(([a, b]) => [corners[a]!, corners[b]!] as [Pt2, Pt2]);
}

const r1 = (n: number): string => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? '0' : String(v);
};

/**
 * Where a highlighted member ended up ON THE DRAWING, in the same viewBox coordinates the SVG
 * uses. The worksheet needs it to run a leader line from a numbered box to the actual piece,
 * and computing it anywhere else would mean a second copy of the projection and the fit — two
 * copies that agree until one of them is edited, and then point at the wrong stud.
 */
export interface Anchor { id: string; x: number; y: number }

/**
 * Draw a spec as an SVG string. Deterministic: same spec → byte-identical output, which is
 * what makes the committed goldens meaningful.
 */
export function thumbnailFor(spec: StructureSpec, opts: ThumbOptions = {}): string {
  return drawStructure(spec, opts).svg;
}

/** The same drawing, plus where each highlighted member landed on it. */
export function drawStructure(spec: StructureSpec, opts: ThumbOptions = {}): { svg: string; anchors: Anchor[] } {
  const width = opts.width ?? 220;
  const height = opts.height ?? 150;
  const lod = opts.lod ?? true;
  const mark = opts.highlight;
  const model = generateStructure(spec);

  const drawable = model.members.filter((m) => mark?.has(m.id) || !lod || !LOD_SKIP.has(m.role));

  const light: string[] = [];
  const heavy: string[] = [];
  const picked: string[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const collected: { segs: [Pt2, Pt2][]; layer: 'light' | 'heavy' | 'picked'; id: string }[] = [];

  for (const m of drawable) {
    // Heavy members get their real box (they carry the silhouette); everything else is a
    // centerline, which is what reads at 220x150 anyway. A highlighted member always gets its
    // box — the card is asking the reader to look at that piece, so it has to have a shape.
    const isPicked = mark?.has(m.id) ?? false;
    const isHeavy = HEAVY.has(m.role);
    const segs = isPicked || isHeavy ? memberSegments(m) : memberCenterline(m);
    // THE BOX IS THE FINISHED BUILDING'S, always — even for members this frame does not draw.
    // Fitting each stage to its own extent makes the sequence zoom and re-centre between
    // frames, so the footings fill the card and then the whole thing shrinks; the building
    // stops reading as one building growing and starts reading as five unrelated drawings.
    for (const [a, b] of segs) {
      minX = Math.min(minX, a.x, b.x); maxX = Math.max(maxX, a.x, b.x);
      minY = Math.min(minY, a.y, b.y); maxY = Math.max(maxY, a.y, b.y);
    }
    if (opts.stageMax !== undefined && !isPicked && m.stage > opts.stageMax) continue;
    collected.push({ segs, layer: isPicked ? 'picked' : isHeavy ? 'heavy' : 'light', id: m.id });
  }
  if (drawable.length === 0) {
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`, anchors: [] };
  }

  // A 6-ft human at the building's front-left corner, for scale.
  const humanSegs: [Pt2, Pt2][] = [];
  if (opts.human !== false) {
    const hx = -1.5, hz = -1.5;
    const feet = project(hx, 0, hz);
    const head = project(hx, 6, hz);
    const shoulder = project(hx, 4.6, hz);
    humanSegs.push([feet, head], [{ x: shoulder.x - 6, y: shoulder.y }, { x: shoulder.x + 6, y: shoulder.y }]);
    for (const [a, b] of humanSegs) {
      minX = Math.min(minX, a.x, b.x); maxX = Math.max(maxX, a.x, b.x);
      minY = Math.min(minY, a.y, b.y); maxY = Math.max(maxY, a.y, b.y);
    }
  }

  const pad = 8;
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2 - minX * scale;
  const offY = (height - spanY * scale) / 2 - minY * scale;
  const tx = (p: Pt2): string => `${r1(p.x * scale + offX)} ${r1(p.y * scale + offY)}`;

  const anchors: Anchor[] = [];
  for (const c of collected) {
    const path = c.segs.map(([a, b]) => `M${tx(a)}L${tx(b)}`).join('');
    (c.layer === 'picked' ? picked : c.layer === 'heavy' ? heavy : light).push(path);
    // The centre of what was actually drawn, in viewBox units — not the member's world
    // centroid, because a leader line has to land where the reader sees the piece.
    if (c.layer === 'picked') {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const [a, b] of c.segs) {
        sx += a.x + b.x; sy += a.y + b.y; n += 2;
      }
      anchors.push({
        id: c.id,
        x: Math.round(((sx / n) * scale + offX) * 10) / 10,
        y: Math.round(((sy / n) * scale + offY) * 10) / 10,
      });
    }
  }

  // With a highlight the whole structure drops back so one piece can come forward. Without one
  // nothing changes — which is what keeps the committed picker goldens byte-identical.
  const ghost = mark ? ' opacity="0.28"' : '';
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`,
  );
  parts.push(`<g fill="none" stroke="#6b6250" stroke-width="0.6" stroke-linecap="round"${ghost}><path d="${light.join('')}"/></g>`);
  parts.push(`<g fill="none" stroke="#2b2419" stroke-width="1.1" stroke-linecap="round"${ghost}><path d="${heavy.join('')}"/></g>`);
  if (picked.length > 0) {
    parts.push(`<g fill="none" stroke="#c2410c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${picked.join('')}"/></g>`);
  }
  if (humanSegs.length > 0) {
    const hp = humanSegs.map(([a, b]) => `M${tx(a)}L${tx(b)}`).join('');
    parts.push(`<g fill="none" stroke="#9a5b3d" stroke-width="1.2" stroke-linecap="round" opacity="0.9"><path d="${hp}"/></g>`);
  }
  parts.push('</svg>');
  return { svg: parts.join(''), anchors };
}

// Memoized per catalog id — the picker draws every card on every render otherwise.
const cache = new Map<string, string>();

export function thumbnailCached(key: string, spec: StructureSpec, opts?: ThumbOptions): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = thumbnailFor(spec, opts);
  cache.set(key, svg);
  return svg;
}
