// Canvas-painted terrain textures for the diorama engine. Every mark here is deterministic —
// hashJitter(integer seed), never Math.random — so identical doctrine inputs repaint the
// identical ground on every rebuild (the same contract as every other engine module).
//
// Ownership split, because disposal correctness depends on it:
//   groundTopTexture — PER-SCENE (painted for one exact footprint), deliberately NOT registered
//     in sharedTextures: the terrain build that requested it owns it and must dispose it.
//   strataTexture / bladeTexture — palette-keyed, cached in module maps, registered in
//     sharedTextures so disposeObject skips them across rebuilds.

import * as THREE from 'three';
import type { TerrainSpec, TerrainHole } from '../../render3d/scene3d';
import type { Palette } from './palette';
import { sharedTextures, hashJitter } from './shared';

// ── color helpers ──────────────────────────────────────────────────────────────────────────────

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Palette number → css string, optionally lifted toward white (see bladeTexture for why).
function css(n: number, lift = 0): string {
  const c = new THREE.Color(n);
  if (lift > 0) c.lerp(new THREE.Color(0xffffff), lift);
  return `#${c.getHexString()}`;
}

// ── hole-boundary walker (for the dither band + spoil flecks) ─────────────────────────────────
// One ordered point loop (plan feet) approximates any hole kind, so a single perimeter walker
// serves rect, circle, and poly alike.

interface Pt { x: number; z: number }

function holeLoop(h: TerrainHole): Pt[] {
  if (h.kind === 'rect') {
    const hw = h.w / 2;
    const hd = h.d / 2;
    return [
      { x: h.x - hw, z: h.z - hd }, { x: h.x + hw, z: h.z - hd },
      { x: h.x + hw, z: h.z + hd }, { x: h.x - hw, z: h.z + hd },
    ];
  }
  if (h.kind === 'circle') {
    const pts: Pt[] = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push({ x: h.x + Math.cos(a) * h.r, z: h.z + Math.sin(a) * h.r });
    }
    return pts;
  }
  return h.pts.map(([x, z]) => ({ x, z }));
}

interface LoopWalk {
  perim: number;
  /** Point at fraction t (0..1) of the perimeter, plus the OUTWARD unit normal there. */
  at(t: number): { x: number; z: number; nx: number; nz: number };
}

function loopWalker(loop: Pt[]): LoopWalk {
  // Shoelace sign decides which perpendicular points AWAY from the hole. A centroid-radial
  // guess was rejected: on the re-entrant edges of T- and L-shaped holes it points the wrong
  // way, spraying the dither INTO the (invisible) hole and leaving the real band bare.
  let area2 = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    area2 += a.x * b.z - b.x * a.z;
  }
  const ccw = area2 > 0;
  interface Seg { ax: number; az: number; dx: number; dz: number; len: number; nx: number; nz: number }
  const segs: Seg[] = [];
  let perim = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) continue;
    // Interior lies LEFT of travel on a positively-wound loop (in the x/z plan basis), so
    // outward is the right-hand perpendicular — flipped when the spec wound it the other way.
    segs.push({ ax: a.x, az: a.z, dx: dx / len, dz: dz / len, len, nx: (ccw ? dz : -dz) / len, nz: (ccw ? -dx : dx) / len });
    perim += len;
  }
  if (segs.length === 0) return { perim: 0, at: () => ({ x: 0, z: 0, nx: 0, nz: 1 }) };
  return {
    perim,
    at(t) {
      let dist = Math.min(Math.max(t, 0), 0.999999) * perim;
      for (const s of segs) {
        if (dist <= s.len) return { x: s.ax + s.dx * dist, z: s.az + s.dz * dist, nx: s.nx, nz: s.nz };
        dist -= s.len;
      }
      const s = segs[segs.length - 1]!;
      return { x: s.ax + s.dx * s.len, z: s.az + s.dz * s.len, nx: s.nx, nz: s.nz };
    },
  };
}

// Path of the hole's own outline (plan feet), for the worn-apron fill/stroke below.
function traceHole(ctx: CanvasRenderingContext2D, h: TerrainHole): void {
  ctx.beginPath();
  if (h.kind === 'rect') {
    ctx.rect(h.x - h.w / 2, h.z - h.d / 2, h.w, h.d);
  } else if (h.kind === 'circle') {
    ctx.arc(h.x, h.z, h.r, 0, Math.PI * 2);
  } else {
    const [first, ...rest] = h.pts;
    if (!first) return;
    ctx.moveTo(first[0], first[1]);
    for (const [x, z] of rest) ctx.lineTo(x, z);
    ctx.closePath();
  }
}

// ── ground top (per-scene) ─────────────────────────────────────────────────────────────────────

export function groundTopTexture(spec: TerrainSpec, p: Palette): THREE.CanvasTexture {
  const o = spec.outer;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // The whole painter works in PLAN FEET through one transform — dots, strokes, and gradients
  // are authored in feet and the (anisotropic, when the outer isn't square) transform stretches
  // them onto the square canvas, so a circular worn ring stays circular ON THE GROUND.
  //
  // ORIENTATION CONTRACT (terrain.ts depends on this): canvas row 0 (the TOP edge) is the
  // outer's minZ edge — negative z, the ENEMY/front side, "front is up" exactly like the 2D
  // plan. The texture keeps CanvasTexture's default flipY = true, so the top-cap UV that maps
  // this 1:1 onto spec.outer is:
  //   u = (x - minX) / outer.w      v = (maxZ - z) / outer.d
  const minX = o.x - o.w / 2;
  const minZ = o.z - o.d / 2;
  const sx = 1024 / Math.max(o.w, 1e-6);
  const sz = 1024 / Math.max(o.d, 1e-6);
  ctx.setTransform(sx, 0, 0, sz, -minX * sx, -minZ * sz);

  // (a) grass base
  ctx.fillStyle = p.grass.base;
  ctx.fillRect(minX, minZ, o.w, o.d);

  // (b) 3-tone speckle on a jittered ~0.9 ft lattice — the position jitter plus per-blob
  // radii/rotation is what keeps this from reading as a printed grid. ~60% of cells stay bare
  // (base shows through), ~25% dark, ~15% light.
  const step = 0.9;
  let cell = 0;
  for (let gz = minZ + step / 2; gz < minZ + o.d; gz += step) {
    for (let gx = minX + step / 2; gx < minX + o.w; gx += step) {
      cell++;
      const roll = hashJitter(cell * 7 + 1);
      if (roll < 0.6) continue;
      ctx.fillStyle = roll < 0.85 ? p.grass.dark : p.grass.light;
      const bx = gx + (hashJitter(cell * 7 + 2) - 0.5) * step * 0.8;
      const bz = gz + (hashJitter(cell * 7 + 3) - 0.5) * step * 0.8;
      const rx = 0.3 + hashJitter(cell * 7 + 4) * 0.2; // semi-axes → 0.6..1.0 ft blobs
      const rz = 0.3 + hashJitter(cell * 7 + 5) * 0.2;
      ctx.beginPath();
      ctx.ellipse(bx, bz, rx, rz, hashJitter(cell * 7 + 6) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // (c) 2-3 large soft dry patches. Footprint-derived integer salt so different positions don't
  // all share one recognizable patch layout — still identical for identical inputs.
  const fp = Math.round(o.w * 13 + o.d * 29);
  const dryN = 2 + (hashJitter(fp + 7) > 0.5 ? 1 : 0);
  for (let i = 0; i < dryN; i++) {
    const s = fp + i * 11;
    const cx = minX + o.w * (0.2 + hashJitter(s + 1) * 0.6);
    const cz = minZ + o.d * (0.2 + hashJitter(s + 2) * 0.6);
    const r = Math.min(o.w, o.d) * (0.16 + hashJitter(s + 3) * 0.12);
    const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, r);
    g.addColorStop(0, rgba(p.grass.dry, 0.2));
    g.addColorStop(0.7, rgba(p.grass.dry, 0.14));
    g.addColorStop(1, rgba(p.grass.dry, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cz, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // (d) worn dirt ring + (e) spoil flecks, per hole.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  spec.holes.forEach((h, hi) => {
    const base = (hi + 1) * 100003;
    // Solid worn apron: fill the hole footprint AND stroke its outline 3.6 ft wide. The stroke
    // is centered, so its outer half is exactly the requested +1.8 ft band; the inner half and
    // the fill land inside the hole, which is cut out of the mesh — overpaint is free. Round
    // joins give the rect its rounded-apron corners, and this is more faithful than a true
    // polygon offset for the T/L re-entrant corners (see loopWalker).
    // Band widths tightened from the original 1.8/2.7/4.5 ft spec: on a narrow trench (the
    // inverted-T's ~2.4 ft stem) a worn apron nearly twice the trench's own width smeared so
    // far past it that the dug trench read as a surface paint stain (audit finding).
    ctx.fillStyle = p.wornRing;
    ctx.strokeStyle = p.wornRing;
    ctx.lineWidth = 2.0;
    traceHole(ctx, h);
    ctx.fill();
    ctx.stroke();

    const walk = loopWalker(holeLoop(h));
    if (walk.perim <= 0) return;

    // Two-step toon dither: solid ring, then ONE band of scattered dots (+1.0 → +1.7 ft) at
    // roughly half coverage — a hard-edged half-tone step, not a smooth gradient (an airbrushed
    // falloff would fight the cel look everywhere else).
    const wornN = Math.max(24, Math.round(walk.perim * 5));
    for (let k = 0; k < wornN; k++) {
      const s = base + k * 7;
      const e = walk.at(hashJitter(s + 1));
      const dist = 1.0 + hashJitter(s + 2) * 0.7;
      ctx.beginPath();
      ctx.arc(e.x + e.nx * dist, e.z + e.nz * dist, 0.11 + hashJitter(s + 3) * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spoil flecks: sparse thrown-dirt residue further out (+1.7 → +3.1 ft), lighter density
    // than the dither band so the transition reads ring → dots → flecks → clean grass.
    ctx.fillStyle = p.spoilFleck;
    const fleckN = Math.max(16, Math.round(walk.perim * 2.6));
    for (let k = 0; k < fleckN; k++) {
      const s = base + 49999 + k * 7;
      const e = walk.at(hashJitter(s + 1));
      const dist = 1.7 + hashJitter(s + 2) * 1.4;
      ctx.beginPath();
      ctx.arc(e.x + e.nx * dist, e.z + e.nz * dist, 0.07 + hashJitter(s + 3) * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Per-scene: sized/painted for THIS footprint, so deliberately NOT in sharedTextures — the
  // terrain build that asked for it disposes it.
  const tex = new THREE.CanvasTexture(canvas);
  // Canvas hex fills ARE sRGB values; untagged, three treats them as linear and the whole
  // ground washes out pale-mint through the ACES/output chain. Every canvas color map in the
  // engine carries this tag (the toon gradientMap deliberately does not — it's a shading ramp,
  // not a color).
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── soil strata side-wall (cached per palette) ─────────────────────────────────────────────────

const strataCache = new Map<string, THREE.CanvasTexture>();

export function strataTexture(p: Palette): THREE.CanvasTexture {
  const key = p.strata.base;
  const hit = strataCache.get(key);
  if (hit) return hit;

  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Deterministic per-palette seed derived from the cache key itself — day and night soils get
  // different (but stable) wiggles without any extra plumbing.
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  seed %= 100000;

  ctx.fillStyle = p.strata.base;
  ctx.fillRect(0, 0, S, S);

  const lineN = 2 + (hashJitter(seed + 2) > 0.4 ? 1 : 0);
  for (let i = 0; i < lineN; i++) {
    const s = seed + 20 + i * 13;
    const yBase = S * ((i + 0.7 + hashJitter(s + 1) * 0.25) / (lineN + 0.9));
    const amp = 1.5 + hashJitter(s + 2) * 2.5;
    // WHOLE wave counts so the left/right edges meet exactly — this texture repeats on S, and a
    // fractional wave would print a visible seam every tile.
    const waves = 2 + Math.round(hashJitter(s + 3));
    const phase = hashJitter(s + 4) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? p.strata.lines[0] : p.strata.lines[1];
    ctx.lineWidth = 3 + hashJitter(s + 5) * 2;
    ctx.beginPath();
    // Overdraw 4px past both edges: the periodic y() keeps the curve continuous across the
    // seam, and the rounded stroke ends fall outside the tile.
    for (let x = -4; x <= S + 4; x += 4) {
      const y = yBase + Math.sin(((x / S) * waves + 0) * Math.PI * 2 + phase) * amp;
      if (x === -4) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Sparse pebble specks, kept off the right/bottom edge so the S-repeat seam never clips one.
  for (let i = 0; i < 14; i++) {
    const s = seed + 300 + i * 17;
    ctx.fillStyle = i % 2 === 0 ? p.strata.lines[1] : p.strata.lines[0];
    const x = Math.floor(hashJitter(s + 1) * (S - 4));
    const y = Math.floor(hashJitter(s + 2) * (S - 4));
    const sz = 1 + Math.round(hashJitter(s + 3) * 2);
    ctx.fillRect(x, y, sz, sz);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; // see groundTopTexture — all engine color maps are sRGB
  tex.wrapS = THREE.RepeatWrapping; // S only — v spans the block height exactly once (terrain.ts UVs)
  sharedTextures.add(tex);
  strataCache.set(key, tex);
  return tex;
}

// ── grass-blade cluster (alpha cutout card, cached per palette) ────────────────────────────────

const bladeCache = new Map<string, THREE.CanvasTexture>();

export function bladeTexture(p: Palette): THREE.CanvasTexture {
  const key = `${p.tuft[0]}:${p.tuft[1]}`;
  const hit = bladeCache.get(key);
  if (hit) return hit;

  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!; // canvas starts fully transparent — alphaTest cuts the rest

  const seed = (p.tuft[0] % 65521) + (p.tuft[1] % 32749);
  // The tuft instances tint this map via instanceColor (a lerp between the SAME two tuft
  // tones), and map × instanceColor MULTIPLIES — two mid-greens multiplied land in mud. The
  // painted tones are therefore lifted well toward white; the per-instance tint supplies the
  // actual green.
  const toneA = css(p.tuft[0], 0.55);
  const toneB = css(p.tuft[1], 0.55);

  const blades = 4 + Math.round(hashJitter(seed + 1) * 2); // 4..6
  for (let i = 0; i < blades; i++) {
    const s = seed + 10 + i * 9;
    const bx = S / 2 + (i - (blades - 1) / 2) * 7 + (hashJitter(s + 1) - 0.5) * 4;
    const lean = (hashJitter(s + 2) - 0.5) * 26;
    const tipX = bx + lean;
    const tipY = 3 + hashJitter(s + 3) * 12;
    const hw = 2.5 + hashJitter(s + 4) * 2; // half-width at the root; blades taper to a point
    ctx.fillStyle = i % 2 === 0 ? toneA : toneB;
    ctx.beginPath();
    ctx.moveTo(bx - hw, S);
    ctx.quadraticCurveTo(bx - hw + lean * 0.25, S * 0.55, tipX, tipY);
    ctx.quadraticCurveTo(bx + hw + lean * 0.25, S * 0.55, bx + hw, S);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; // see groundTopTexture — all engine color maps are sRGB
  sharedTextures.add(tex);
  bladeCache.set(key, tex);
  return tex;
}
