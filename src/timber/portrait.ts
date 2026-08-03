// TIMBER-2 — PORTRAITS: a solid, shaded, zoomed drawing of one piece in its structure.
//
// `thumbnails.ts` draws the whole structure as line art at card size, and for the picker that
// is exactly right — you are identifying a BUILDING and the wireframe reads as one at 220x150.
// It is the wrong picture for a flashcard. A flashcard asks "what is THIS piece", and the
// answer it was being given was the entire building in flat orange strokes, everything the same
// weight, the piece somewhere in the middle. The owner's words for it: "a weird red whatever".
//
// So this module draws a different kind of image from the same `Member[]`:
//
//   SOLID, NOT WIRE.  Every member is a box with three visible faces, filled and shaded from a
//                     fixed light. Lumber looks like lumber, plywood like plywood, concrete
//                     like concrete, and a piece in front HIDES the piece behind it — which is
//                     most of what makes a drawing read as a thing rather than as a diagram.
//   ZOOMED.           The view frames the piece being asked about, with enough of its
//                     neighbours to place it. You are looking at a hip rafter meeting a ridge,
//                     not at a roof with a hip rafter in it somewhere.
//   AT ITS STAGE.     Drawn as the structure stood when that piece went in. A stud is easy to
//                     see against an open frame and impossible against a sided wall, and the
//                     sequence is a thing worth teaching on its own.
//
// Determinism is kept for the same reason `thumbnails.ts` keeps it — goldens are compared as
// bytes: the basis is precomputed, every coordinate rounds to one decimal, and the depth sort
// is stable with the emission index as its tiebreak.

import type { Member } from './types';
import type { StructureSpec } from './spec';
import { generateStructure } from './families/index';

/**
 * Isometric basis, matching `thumbnails.ts` so a card and a picker tile show the same building
 * from the same angle. Yaw 34°, pitch 24°.
 */
const CY = 0.8290375726;
const SY = 0.5591929035;
const CP = 0.9135454576;
const SP = 0.4067366431;

interface Pt2 { x: number; y: number }

/** World → screen. SVG y grows downward, so world "up" is negative y here. */
function project(x: number, y: number, z: number): Pt2 {
  return { x: x * CY - z * SY, y: -(y * CP) + (x * SY + z * CY) * SP };
}

/**
 * Distance toward the camera. Increasing x or z moves a point to the bottom of the frame and
 * increasing y moves it to the top, so the eye sits out at (+x, +y, +z) and this dot product
 * with that direction is exactly how near a point is. Larger = nearer; the painter draws
 * ascending, so far things go down first and near things cover them.
 */
function depth(x: number, y: number, z: number): number {
  return x * SY * CP + y * SP + z * CY * CP;
}

/** Fixed key light, high and over the viewer's left shoulder. Normalised. */
const LX = 0.3123;
const LY = 0.8918;
const LZ = 0.3268;

/** Rotate a local offset by a member's YXZ euler — the one convention the whole toolkit uses. */
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

// ── Material ─────────────────────────────────────────────────────────────────

/**
 * What a member is made of, for colour. Deliberately coarse: a reader is not being asked to
 * tell No. 2 common from No. 1, they are being asked to tell a stick from a sheet from a slab.
 */
type Stuff = 'lumber' | 'panel' | 'concrete' | 'roofing' | 'screen' | 'earth';

function stuffOf(m: Member): Stuff {
  if (m.role === 'soilGhost') return 'earth';
  if (m.role === 'screenPanel') return 'screen';
  if (m.role === 'roofingCourse' || m.role === 'ridgeCap' || m.role === 'felt' || m.role === 'buildingPaper') return 'roofing';
  if (m.nominal.includes('conc') || m.role === 'slab' || m.role === 'footing' || m.role === 'foundationWall') return 'concrete';
  if (m.nominal.includes('panel')) return 'panel';
  return 'lumber';
}

/** Base RGB per material, in the same family as the 3D scene so the two do not read as two apps. */
const BASE: Record<Stuff, [number, number, number]> = {
  lumber: [201, 168, 112],
  panel: [214, 186, 132],
  concrete: [169, 166, 159],
  roofing: [86, 92, 88],
  screen: [70, 76, 73],
  earth: [138, 122, 94],
};

/** The piece the card is about. Red, because that is the one word for "this one". */
const FOCUS: [number, number, number] = [198, 62, 40];

const clamp255 = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));
const hex = (rgb: [number, number, number], k: number): string => {
  const r = clamp255(rgb[0] * k), g = clamp255(rgb[1] * k), b = clamp255(rgb[2] * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

// ── Faces ────────────────────────────────────────────────────────────────────

/** One drawable quad: screen polygon, fill, and how near it is. */
interface Face {
  pts: Pt2[];
  fill: string;
  z: number;
  order: number;
  focus: boolean;
}

/**
 * The three visible faces of a member's box.
 *
 * Back faces are dropped rather than drawn and covered: it halves the polygon count, and at
 * these sizes half of a 500-member structure is the difference between an SVG a browser paints
 * instantly and one it thinks about.
 */
function facesOf(m: Member, order: number, isFocus: boolean, dim: number): Face[] {
  const hx = m.cutLength / 24;
  const hy = m.actual.d / 24;
  const hz = m.actual.w / 24;
  const base = isFocus ? FOCUS : BASE[stuffOf(m)];

  // Local axes in world space, and the eight corners.
  const ax = rotateLocal(m, [1, 0, 0]);
  const ay = rotateLocal(m, [0, 1, 0]);
  const az = rotateLocal(m, [0, 0, 1]);
  const corner = (sx: number, sy: number, sz: number): [number, number, number] => [
    m.position[0] + ax[0] * sx * hx + ay[0] * sy * hy + az[0] * sz * hz,
    m.position[1] + ax[1] * sx * hx + ay[1] * sy * hy + az[1] * sz * hz,
    m.position[2] + ax[2] * sx * hx + ay[2] * sy * hy + az[2] * sz * hz,
  ];

  // Each face: its outward normal, and its four corners in local sign space.
  const spec: { n: [number, number, number]; c: [number, number, number][] }[] = [
    { n: ax, c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
    { n: [-ax[0], -ax[1], -ax[2]], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { n: ay, c: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
    { n: [-ay[0], -ay[1], -ay[2]], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
    { n: az, c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [-az[0], -az[1], -az[2]], c: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]] },
  ];

  const out: Face[] = [];
  for (const f of spec) {
    // Cull: a face whose normal points away from the eye is behind its own member.
    if (depth(f.n[0], f.n[1], f.n[2]) <= 0) continue;
    const world = f.c.map(([sx, sy, sz]) => corner(sx, sy, sz));
    const lambert = Math.max(0, f.n[0] * LX + f.n[1] * LY + f.n[2] * LZ);
    // Never fully black: an unlit face still has to show its edges against its neighbours.
    const shade = (0.62 + 0.38 * lambert) * dim;
    out.push({
      pts: world.map(([x, y, z]) => project(x, y, z)),
      fill: hex(base, shade),
      z: world.reduce((s, [x, y, z]) => s + depth(x, y, z), 0) / world.length,
      order,
      focus: isFocus,
    });
  }
  return out;
}

// ── Drawing ──────────────────────────────────────────────────────────────────

export interface PortraitOptions {
  width?: number;
  height?: number;
  /** The piece(s) the picture is ABOUT: drawn red. */
  focus?: ReadonlySet<string>;
  /**
   * What the frame closes in on, when that is not the whole of `focus`.
   *
   * A card about "rafter" highlights EVERY rafter, and it should — seeing that a rafter is one
   * of a repeated rank is half of knowing what a rafter is. But framing on all of them means
   * framing on the whole roof, and then the picture is a red building rather than a piece you
   * could recognise on a job. So the card marks them all and frames on one: you see the piece
   * up close, and the other red sticks around it tell you there are more like it.
   */
  frameOn?: ReadonlySet<string>;
  /** Draw only what is up by this stage; the focus is always drawn. */
  stageMax?: number;
  /**
   * How much of the surroundings to keep, as a multiple of the focus's own size on screen.
   * Low numbers give a detail crop; high numbers give the whole building. 3 shows a piece with
   * its joint, which is the level at which framing pieces are actually told apart.
   */
  context?: number;
  /** Page colour behind the drawing. */
  background?: string;
}

const r1 = (n: number): string => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? '0' : String(v);
};

/**
 * Draw a spec as a solid SVG picture. Deterministic: same spec and options → identical bytes.
 */
export function portraitFor(spec: StructureSpec, opts: PortraitOptions = {}): string {
  const width = opts.width ?? 420;
  const height = opts.height ?? 300;
  const focusIds = opts.focus;
  const model = generateStructure(spec);

  // The focus is drawn whatever stage it belongs to; everything else obeys stageMax. Drawing a
  // piece with nothing around it teaches a silhouette, so the point of the stage clip is to
  // show what WAS there, not to hide the subject.
  const visible = model.members.filter((m) =>
    focusIds?.has(m.id) || opts.stageMax === undefined || m.stage <= opts.stageMax);
  if (visible.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"></svg>`;
  }

  const faces: Face[] = [];
  let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
  let aMinX = Infinity, aMaxX = -Infinity, aMinY = Infinity, aMaxY = -Infinity;
  const frameIds = opts.frameOn ?? focusIds;
  visible.forEach((m, i) => {
    const isFocus = focusIds?.has(m.id) ?? false;
    const isFramed = frameIds?.has(m.id) ?? false;
    // Everything that is not the subject steps back a little so the subject is the thing your
    // eye lands on. Not a ghost — you still have to be able to read the joint it sits in.
    for (const f of facesOf(m, i, isFocus, focusIds && !isFocus ? 0.88 : 1)) {
      faces.push(f);
      for (const p of f.pts) {
        aMinX = Math.min(aMinX, p.x); aMaxX = Math.max(aMaxX, p.x);
        aMinY = Math.min(aMinY, p.y); aMaxY = Math.max(aMaxY, p.y);
        if (isFramed) {
          fMinX = Math.min(fMinX, p.x); fMaxX = Math.max(fMaxX, p.x);
          fMinY = Math.min(fMinY, p.y); fMaxY = Math.max(fMaxY, p.y);
        }
      }
    }
  });

  // ── Frame it. With no focus this is the whole structure; with one, a window CENTRED on the
  // piece, sized to the requested amount of context.
  //
  // The window is not clamped to the drawn content, and that is deliberate. An earlier pass
  // clipped it to the structure's own extent to stop the crop wandering into empty space, and
  // the result was that any piece near an edge — a hip rafter at the peak, a footing at the
  // bottom — got shoved against the frame and cut in half, since the piece WAS the extent.
  // Background around the subject is normal framing; a subject running off the top is not.
  let boxMinX = aMinX, boxMaxX = aMaxX, boxMinY = aMinY, boxMaxY = aMaxY;
  if (focusIds && fMinX < Infinity) {
    const ctx = opts.context ?? 1;
    const cx = (fMinX + fMaxX) / 2;
    const cy = (fMinY + fMaxY) / 2;
    // Square the window to the frame's aspect before growing it, so a long thin piece — a
    // 20-ft sill is exactly that — does not produce a letterbox with nothing above or below.
    const aspect = width / height;
    const focusHalf = Math.max((fMaxX - fMinX) / 2, ((fMaxY - fMinY) / 2) * aspect);
    const structHalf = Math.max((aMaxX - aMinX) / 2, ((aMaxY - aMinY) / 2) * aspect);
    // Context is ADDED, not multiplied. A multiplier reads fine on a 3-ft stud and falls apart
    // on a 24-ft ramp stringer, where three times the piece is several times the building and
    // every long member ends up framed as a whole-structure shot. A fixed margin — a share of
    // the building, so it scales with what is being taught — frames both the same way: the
    // piece, plus a recognisable amount of what it lands on.
    let halfW = focusHalf * 1.3 + ctx * 0.1 * structHalf;
    // Never zoom out past the whole structure: at that point it is a picker tile, not a card.
    halfW = Math.min(halfW, structHalf);
    const halfH = halfW / aspect;
    boxMinX = cx - halfW; boxMaxX = cx + halfW;
    boxMinY = cy - halfH; boxMaxY = cy + halfH;
  }

  const pad = 6;
  const spanX = Math.max(1e-6, boxMaxX - boxMinX);
  const spanY = Math.max(1e-6, boxMaxY - boxMinY);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2 - boxMinX * scale;
  const offY = (height - spanY * scale) / 2 - boxMinY * scale;

  // Far to near, emission index breaking ties so the sort is total and the bytes never move.
  faces.sort((a, b) => (a.z === b.z ? a.order - b.order : a.z - b.z));

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`,
  );
  if (opts.background) parts.push(`<rect width="${width}" height="${height}" fill="${opts.background}"/>`);
  const body: string[] = [];
  const xray: string[] = [];
  for (const f of faces) {
    // Off-frame faces cost bytes and paint nothing. A generous margin keeps a piece that only
    // clips the edge, since its shading still tells you what is over there.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const pts = f.pts.map((p) => {
      const x = p.x * scale + offX;
      const y = p.y * scale + offY;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      return `${r1(x)},${r1(y)}`;
    });
    if (maxX < -20 || minX > width + 20 || maxY < -20 || minY > height + 20) continue;
    // A hairline in the fill's own colour closes the seam between adjacent quads, which would
    // otherwise show as a pale grid over every large surface at fractional scales.
    body.push(`<polygon points="${pts.join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width="0.5"/>`);
    if (f.focus) xray.push(`<polygon points="${pts.join(' ')}"/>`);
  }
  parts.push(body.join(''));
  // ── X-RAY. Occlusion is what makes the picture read as solid, and it is also what buries the
  // subject: a header sits BEHIND its top plate, so a correctly-drawn header card showed a
  // sliver of red under a piece of wood. Re-painting the subject over the top at low opacity,
  // with its edges drawn, keeps the depth cue honest — it is still clearly behind — while making
  // the piece the card is asking about impossible to miss. Where the subject was already
  // visible, red over red changes almost nothing.
  if (xray.length > 0) {
    // Kept LOW. At a third opacity it washed the subject pale wherever it was already visible —
    // which is most of the time — and a pale translucent piece reads as a ghost rather than as
    // the thing being pointed at. A fifth is enough to see through a plate, and the outline is
    // what actually does the work.
    parts.push(
      `<g fill="${hex(FOCUS, 1.05)}" fill-opacity="0.19" stroke="${hex(FOCUS, 1.2)}" stroke-opacity="0.85" stroke-width="1.1">`
      + xray.join('') + '</g>',
    );
  }
  parts.push('</svg>');
  return parts.join('');
}

// Memoized: a deck screen draws every card's art on every render otherwise, and a portrait is
// an order of magnitude more work than a wireframe.
const cache = new Map<string, string>();

export function portraitCached(key: string, spec: StructureSpec, opts?: PortraitOptions): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = portraitFor(spec, opts);
  // A deck is a few dozen cards; a runaway cache here would be a memory leak on a long session.
  if (cache.size > 400) cache.clear();
  cache.set(key, svg);
  return svg;
}
