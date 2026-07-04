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

// The ground-surface painters, one per soil face character. All work in plan feet on a
// transformed context, deterministic via hashJitter + the footprint salt.
function paintSurface(ctx: CanvasRenderingContext2D, p: Palette, minX: number, minZ: number, w: number, d: number, fp: number): void {
  const minDim = Math.min(w, d);

  // Soft irregular tone patches — shared by several painters (dry grass, dust, frost).
  const patches = (color: string, n: number, alpha: number, salt: number): void => {
    for (let i = 0; i < n; i++) {
      const s = fp + salt + i * 11;
      const cx = minX + w * (0.12 + hashJitter(s + 1) * 0.76);
      const cz = minZ + d * (0.12 + hashJitter(s + 2) * 0.76);
      const r = minDim * (0.12 + hashJitter(s + 3) * 0.14);
      const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, r);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(0.7, rgba(color, alpha * 0.7));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cz, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Small scattered dots (pebbles, speckles, moss) on a jittered lattice.
  const dots = (colors: string[], step: number, keepFrac: number, rMin: number, rMax: number, salt: number): void => {
    let cell = 0;
    for (let gz = minZ + step / 2; gz < minZ + d; gz += step) {
      for (let gx = minX + step / 2; gx < minX + w; gx += step) {
        cell++;
        const s = fp + salt + cell * 7;
        if (hashJitter(s + 1) > keepFrac) continue;
        ctx.fillStyle = colors[Math.floor(hashJitter(s + 2) * colors.length) % colors.length]!;
        const bx = gx + (hashJitter(s + 3) - 0.5) * step * 0.8;
        const bz = gz + (hashJitter(s + 4) - 0.5) * step * 0.8;
        const r = rMin + hashJitter(s + 5) * (rMax - rMin);
        ctx.beginPath();
        ctx.arc(bx, bz, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // Long wavy strokes (sand ripples, ice streaks) running roughly along x.
  const streaks = (color: string, n: number, width: number, alpha: number, salt: number): void => {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = fp + salt + i * 13;
      const z0 = minZ + d * ((i + 0.5) / n) + (hashJitter(s + 1) - 0.5) * (d / n) * 0.6;
      const amp = 0.25 + hashJitter(s + 2) * 0.3;
      const phase = hashJitter(s + 3) * Math.PI * 2;
      ctx.beginPath();
      for (let x = minX; x <= minX + w; x += 0.5) {
        const z = z0 + Math.sin((x / w) * Math.PI * (3 + hashJitter(s + 4) * 2) + phase) * amp;
        if (x === minX) ctx.moveTo(x, z);
        else ctx.lineTo(x, z);
      }
      ctx.stroke();
    }
  };

  // Thin jagged crack lines (clay polygons, rock fissures).
  const cracks = (color: string, n: number, alpha: number, salt: number): void => {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = fp + salt + i * 17;
      let x = minX + w * (0.08 + hashJitter(s + 1) * 0.84);
      let z = minZ + d * (0.08 + hashJitter(s + 2) * 0.84);
      let ang = hashJitter(s + 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, z);
      const segs = 3 + Math.round(hashJitter(s + 4) * 3);
      for (let k = 0; k < segs; k++) {
        ang += (hashJitter(s + 5 + k) - 0.5) * 1.4;
        const len = 0.6 + hashJitter(s + 9 + k) * 1.2;
        x += Math.cos(ang) * len;
        z += Math.sin(ang) * len;
        ctx.lineTo(x, z);
      }
      ctx.stroke();
    }
  };

  switch (p.faceLook) {
    // Non-meadow soils get a STRONG opaque-ish base overlay in the soil's own tone — the green
    // underneath survives only as faint variation. "Make the whole surface a new terrain, not
    // just a green color with circles" is the requirement these overlays carry.
    case 'cone': {
      // Sand field: pale dune base, wind ripples, fine speckles.
      ctx.fillStyle = rgba(p.spoilFleck, 0.8);
      ctx.fillRect(minX, minZ, w, d);
      streaks(p.wornRing, Math.max(4, Math.round(d / 1.6)), 0.12, 0.4, 100);
      dots([p.grass.dry, p.grass.dark], 1.1, 0.3, 0.04, 0.09, 200);
      patches(p.wornRing, 2, 0.15, 300);
      break;
    }
    case 'stony': {
      // Gravel bed: densely scattered pebbles over a dirt base, a few larger stones.
      ctx.fillStyle = rgba(p.wornRing, 0.75);
      ctx.fillRect(minX, minZ, w, d);
      dots([p.grass.dark, p.grass.light, p.spoilFleck], 0.55, 0.75, 0.06, 0.16, 100);
      dots([p.grass.dark], 2.2, 0.5, 0.18, 0.3, 400);
      patches(p.grass.dry, 2, 0.12, 300);
      break;
    }
    case 'blocky': {
      // Clay hardpan: dusty red-brown base, polygonal drying cracks, sparse dry vegetation.
      ctx.fillStyle = rgba(p.wornRing, 0.8);
      ctx.fillRect(minX, minZ, w, d);
      cracks(p.grass.dark, Math.max(8, Math.round((w * d) / 18)), 0.55, 100);
      patches(p.grass.dry, 3, 0.18, 300);
      patches(p.grass.base, 2, 0.2, 600); // surviving vegetation patches, not the base
      break;
    }
    case 'stratified': {
      // Broken rock: grey stone base, angular fissures, slab patches, sparse moss dots.
      ctx.fillStyle = rgba(p.wornRing, 0.8);
      ctx.fillRect(minX, minZ, w, d);
      cracks(p.strata.lines[1], Math.max(10, Math.round((w * d) / 14)), 0.6, 100);
      patches(p.spoilFleck, 3, 0.25, 200);
      patches(p.strata.base, 2, 0.2, 500);
      dots([p.grass.dark, p.grass.base], 1.4, 0.25, 0.08, 0.18, 400); // moss/lichen
      break;
    }
    case 'iceblocky': {
      // Frozen ground: frosted pale base, icy patches, thin windblown ice streaks.
      ctx.fillStyle = rgba(p.grass.light, 0.7);
      ctx.fillRect(minX, minZ, w, d);
      patches('#ffffff', 4, 0.3, 100);
      streaks('#ffffff', Math.max(3, Math.round(d / 2.4)), 0.1, 0.35, 300);
      dots([p.grass.dark], 1.8, 0.25, 0.06, 0.14, 400);
      break;
    }
    default: {
      // 'planar' — the loam-family grass meadow: 3-tone blob speckle + soft dry patches
      // (the original look, unchanged).
      const step = 0.9;
      let cell = 0;
      for (let gz = minZ + step / 2; gz < minZ + d; gz += step) {
        for (let gx = minX + step / 2; gx < minX + w; gx += step) {
          cell++;
          const roll = hashJitter(cell * 7 + 1);
          if (roll < 0.6) continue;
          ctx.fillStyle = roll < 0.85 ? p.grass.dark : p.grass.light;
          const bx = gx + (hashJitter(cell * 7 + 2) - 0.5) * step * 0.8;
          const bz = gz + (hashJitter(cell * 7 + 3) - 0.5) * step * 0.8;
          const rx = 0.3 + hashJitter(cell * 7 + 4) * 0.2;
          const rz = 0.3 + hashJitter(cell * 7 + 5) * 0.2;
          ctx.beginPath();
          ctx.ellipse(bx, bz, rx, rz, hashJitter(cell * 7 + 6) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      patches(p.grass.dry, 2 + (hashJitter(fp + 7) > 0.5 ? 1 : 0), 0.2, 0);
      break;
    }
  }
}

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

  // (a) base
  ctx.fillStyle = p.grass.base;
  ctx.fillRect(minX, minZ, o.w, o.d);

  // (b)+(c) SURFACE CHARACTER, per soil (keyed by faceLook): the whole ground reads as the
  // soil picked — a sand field, a pebble bed, cracked clay hardpan, broken rock, frost — not
  // one green speckled meadow recolored per soil. Only the loam family keeps the meadow.
  // Every painter draws in plan feet with deterministic hashJitter, colors sourced from the
  // soil-adjusted palette so night variants derive automatically.
  const fp = Math.round(o.w * 13 + o.d * 29);
  paintSurface(ctx, p, minX, minZ, o.w, o.d, fp);

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

// Excavation-face character per soil (research §1): a smooth loose cone (sand), a stony cone
// (gravel), a blocky cohesive cut (clay), heavy bedding layers (rock), ice-veined blocks
// (frozen), or the neutral planar loam/silt cut. Drives the strata banding + speck density so
// the dug face reads as the material picked, not just a recolor of the same texture.
const FACE_STRATA: Record<string, { bands: number; pebbles: number; hard: boolean; ice?: boolean }> = {
  cone: { bands: 0, pebbles: 4, hard: false },
  stony: { bands: 1, pebbles: 36, hard: false },
  blocky: { bands: 3, pebbles: 10, hard: true },
  stratified: { bands: 5, pebbles: 18, hard: true },
  iceblocky: { bands: 3, pebbles: 8, hard: true, ice: true },
  planar: { bands: 2, pebbles: 14, hard: false },
};

export function strataTexture(p: Palette): THREE.CanvasTexture {
  const key = p.strata.base + ':' + p.faceLook;
  const hit = strataCache.get(key);
  if (hit) return hit;
  const face = FACE_STRATA[p.faceLook] ?? FACE_STRATA.planar!;

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

  // Topsoil boundary band, pinned near the TOP of the tile: the terrain crust is only
  // CRUST_FT (~0.8 ft) tall and samples just the top ~27% of this texture (v maps feet /
  // STRATA_BAND_FT) — with all the wavy lines spread over the full tile, the crust's cut edge
  // rendered as featureless base color (audit: "no strata banding under the grass"). This
  // dark line at ~12% is the topsoil/subsoil boundary every roadside cut actually shows.
  ctx.strokeStyle = p.strata.lines[1];
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let x = -4; x <= S + 4; x += 4) {
    const y = S * 0.12 + Math.sin(((x / S) * 3) * Math.PI * 2 + seed % 7) * 1.6;
    if (x === -4) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Bedding lines: count + straightness per face character. Rock lays many nearly-flat bands
  // (hard); sand lays none (a loose cone has no strata); the rest sit between.
  const lineN = face.bands;
  for (let i = 0; i < lineN; i++) {
    const s = seed + 20 + i * 13;
    const yBase = S * ((i + 0.7 + hashJitter(s + 1) * 0.25) / (lineN + 0.9));
    // 'hard' faces (rock/clay/frozen) run near-flat bedding lines; softer soils undulate.
    const amp = face.hard ? 0.6 + hashJitter(s + 2) * 0.9 : 1.5 + hashJitter(s + 2) * 2.5;
    // WHOLE wave counts so the left/right edges meet exactly — this texture repeats on S, and a
    // fractional wave would print a visible seam every tile.
    const waves = 2 + Math.round(hashJitter(s + 3));
    const phase = hashJitter(s + 4) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? p.strata.lines[0] : p.strata.lines[1];
    ctx.lineWidth = (face.hard ? 3.5 : 3) + hashJitter(s + 5) * 2;
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

  // Clasts/specks: dense stony scatter for gravel, almost none for smooth sand. Kept off the
  // right/bottom edge so the S-repeat seam never clips one.
  for (let i = 0; i < face.pebbles; i++) {
    const s = seed + 300 + i * 17;
    ctx.fillStyle = i % 2 === 0 ? p.strata.lines[1] : p.strata.lines[0];
    const x = Math.floor(hashJitter(s + 1) * (S - 4));
    const y = Math.floor(hashJitter(s + 2) * (S - 4));
    const sz = 1 + Math.round(hashJitter(s + 3) * (p.faceLook === 'stony' ? 3 : 2));
    ctx.fillRect(x, y, sz, sz);
  }

  // Frozen ground: pale ice lenses/veins threading the face — the one cue that reads "frozen"
  // rather than just "grey dirt".
  if (face.ice) {
    ctx.strokeStyle = 'rgba(232,240,248,0.7)';
    for (let i = 0; i < 4; i++) {
      const s = seed + 900 + i * 23;
      const yB = S * (0.25 + hashJitter(s) * 0.7);
      ctx.lineWidth = 1 + hashJitter(s + 1) * 1.2;
      ctx.beginPath();
      for (let x = -4; x <= S + 4; x += 4) {
        const y = yB + Math.sin((x / S) * 2 * Math.PI * 2 + hashJitter(s + 2) * 6) * (0.8 + hashJitter(s + 3));
        if (x === -4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; // see groundTopTexture — all engine color maps are sRGB
  // Both axes repeat: terrain.ts UV-maps strata faces in FEET (v = -y / STRATA_BAND_FT) so the
  // band pattern runs at one physical scale across the thin surface crust AND the excavation
  // under-shells descending below it, with no seam where they meet.
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
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
