// Real, drag-to-rotate 3D viewer (Three.js). Cartoon/toon-shaded so it reads as a friendly toy
// diorama rather than a CAD model — the flat plan/section stay the precise, measured drawings;
// this view is for INTUITION: turn it, look at it from any angle, understand the shape at a
// glance. Consumes ONLY the pure render3d/scene3d.ts descriptor — no domain logic lives here.
//
// Lifecycle note: the app re-renders its whole shell as an HTML string on every input change
// (see ui/main.ts). A <canvas> can't survive an innerHTML replace, so this module creates the
// canvas ONCE and the caller re-parents it into the fresh DOM after each render via attach() —
// detaching/reattaching a canvas node keeps its WebGL context alive, so the camera angle, zoom,
// and rotation the user set are never lost just because they toggled a checkbox.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildScene3D, partStage } from '../render3d/scene3d';
import type { Part3, BoxRole } from '../render3d/scene3d';
import { bagWallLayout } from '../render3d/propLayout';
import { sharedTextures, sharedGeometries, hashJitter, toonGradient, disposeObject } from './engine/shared';
import { palette, paletteFor } from './engine/palette';
import type { Palette, Theme3D } from './engine/palette';
import { buildTerrain } from './engine/terrain';
import { buildSky, applyFog } from './engine/sky';
import { SandbagBatcher } from './engine/bagInstancing';
import { createPipeline, detectTier } from './engine/post';
import type { Result } from '../engine/types';
import sandbagGlbUrl from '../assets/models/sandbag.glb?url';
import picketGlbUrl from '../assets/models/picket.glb?url';
import lumber2x4GlbUrl from '../assets/models/lumber_2x4.glb?url';
import lumber2x6GlbUrl from '../assets/models/lumber_2x6.glb?url';
import lumber4x4GlbUrl from '../assets/models/lumber_4x4.glb?url';

// The shared-resource registries (sharedTextures / sharedGeometries), the deterministic
// hashJitter, the toon gradient, and disposeObject moved to ./engine/shared so the diorama
// engine modules participate in the SAME disposal contract. Imported above.

// ── Blender-authored props (sandbag, picket, lumber) ──────────────────────────────────────────
// Modeled in Blender (headless bpy scripting, see DECISIONS D28) at correct real-world
// PROPORTIONS, then exported as a unit 1x1x1 bounding-box mesh — this code applies the exact
// doctrine dimensions via `mesh.scale.set(w, h, d)` at instance time, so one asset file serves
// any size input with no re-export needed if doctrine numbers ever change.
//
// GLTFLoader.load() is asynchronous even for an inlined data: URI, so the very first render(s)
// may happen before the template geometry is ready. `buildSandbagWall`/`buildPicketWall` fall
// back to the plain procedural box/cylinder in that case — never blocking, never throwing — and
// once a template resolves, every registered viewer instance re-runs its last update() so the
// nicer prop replaces the placeholder a moment later.
let sandbagGeometry: THREE.BufferGeometry | null = null;
let picketGeometry: THREE.BufferGeometry | null = null;
// Dimensional-lumber props — one template per nominal size, each Blender-modeled at its true
// DRESSED cross-section (a "2x4" is really 1.5" x 3.5") with size-appropriate crown/crook, so a
// stiff 4x4 post and a springy 2x4 wale read differently even under runtime scaling.
export type LumberSize = '2x4' | '2x6' | '4x4';
const lumberGeometry: Record<LumberSize, THREE.BufferGeometry | null> = { '2x4': null, '2x6': null, '4x4': null };
const rerenderCallbacks = new Set<() => void>();

function extractFirstGeometry(root: THREE.Object3D): THREE.BufferGeometry | null {
  let found: THREE.BufferGeometry | null = null;
  root.traverse((child) => {
    if (!found && child instanceof THREE.Mesh) found = child.geometry as THREE.BufferGeometry;
  });
  return found;
}

function loadModelAssets(): void {
  const loader = new GLTFLoader();
  const loadProp = (url: string, name: string, assign: (geo: THREE.BufferGeometry) => void): void => {
    loader.load(
      url,
      (gltf) => {
        const geo = extractFirstGeometry(gltf.scene);
        if (!geo) return;
        sharedGeometries.add(geo);
        assign(geo);
        for (const cb of rerenderCallbacks) cb();
      },
      undefined,
      (err) => console.error(`${name} failed to load — falling back to the procedural shape`, err),
    );
  };
  loadProp(sandbagGlbUrl, 'sandbag.glb', (g) => (sandbagGeometry = g));
  loadProp(picketGlbUrl, 'picket.glb', (g) => (picketGeometry = g));
  loadProp(lumber2x4GlbUrl, 'lumber_2x4.glb', (g) => (lumberGeometry['2x4'] = g));
  loadProp(lumber2x6GlbUrl, 'lumber_2x6.glb', (g) => (lumberGeometry['2x6'] = g));
  loadProp(lumber4x4GlbUrl, 'lumber_4x4.glb', (g) => (lumberGeometry['4x4'] = g));
}
loadModelAssets();

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// ── Material textures — honest, at-a-glance materials (§ "if sandbags are used, show sandbags") ──
// Each is a small canvas-drawn, tiling pattern created once and cached (deterministic — no
// Math.random, so the same doctrine combination always looks identical).
let dirtTexCache: THREE.Texture | null = null;
function dirtTexture(): THREE.Texture {
  if (dirtTexCache) return dirtTexCache;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  // NEUTRAL near-white detail map, not brown: this texture is always MULTIPLIED by a role
  // color (bay floor, walls, berms) — a brown map × a dark-brown role color lands in
  // mud-black (the old linear-treated-as-sRGB pipeline hid this by over-brightening every
  // texture ~2.2 gamma; honest sRGB + ACES exposed it). Centering the map on white keeps the
  // speckle detail while the role color alone decides the surface's actual hue/value.
  ctx.fillStyle = '#f5efe7';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 220; i++) {
    const sx = (i * 37) % 64;
    const sy = (i * 53) % 64;
    ctx.fillStyle = i % 3 === 0 ? '#e0d5c5' : i % 3 === 1 ? '#fdf9f2' : '#e9ddcc';
    ctx.fillRect(sx, sy, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  // Canvas hex fills are sRGB; untagged, three treats them as linear and the dirt washes out
  // pale through the ACES/output chain. Every canvas color map carries this tag (the toon
  // gradientMap deliberately does not — it's a shading ramp, not a color).
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  dirtTexCache = tex;
  sharedTextures.add(tex);
  return tex;
}

let corrugatedTexCache: THREE.Texture | null = null;
function corrugatedTexture(): THREE.Texture {
  if (corrugatedTexCache) return corrugatedTexCache;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9199a1';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#5c636b';
  ctx.lineWidth = 3;
  for (let x = 3; x < 64; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 64);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; // see dirtTexture — all canvas color maps are sRGB
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  corrugatedTexCache = tex;
  sharedTextures.add(tex);
  return tex;
}

// Sawn dimensional lumber — warm SPF tone with fine, faintly wavy grain lines. Distinct from
// the pale plywood face below (lumber is warmer and more densely grained), and dresses every
// dimensional-lumber prop: stringers, the plywood-revetment frame, and platform/step decking.
let lumberTexCache: THREE.Texture | null = null;
function lumberTexture(): THREE.Texture {
  if (lumberTexCache) return lumberTexCache;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#cfa571';
  ctx.fillRect(0, 0, 64, 64);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i % 3 === 0 ? '#a97f4e' : i % 3 === 1 ? '#b98d59' : '#c29a66';
    ctx.beginPath();
    const gy = 3 + i * 7;
    ctx.moveTo(0, gy);
    for (let x = 0; x <= 64; x += 4) {
      ctx.lineTo(x, gy + Math.sin((x / 64) * Math.PI * 2 + i * 1.7) * 1.6);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; // see dirtTexture — all canvas color maps are sRGB
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  lumberTexCache = tex;
  sharedTextures.add(tex);
  return tex;
}

// Pale plywood FACE — light birch tone with wavy grain, a few darker streaks, and a couple of
// knots (concentric dark rings), clearly NOT the warmer sawn-lumber texture above (that one
// dresses the frame posts behind the sheets). Drawn at 4:8 aspect so it maps a 4-ft × 8-ft sheet
// without distorting the knots. Deterministic — no Math.random.
let plywoodFaceTexCache: THREE.Texture | null = null;
function plywoodFaceTexture(): THREE.Texture {
  if (plywoodFaceTexCache) return plywoodFaceTexCache;
  const W = 128;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#dcc08f';
  ctx.fillRect(0, 0, W, H);
  // Long vertical grain lines running the full height, most faint, a few clearly darker.
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const dark = i % 4 === 0;
    ctx.strokeStyle = dark ? '#8f6f3f' : i % 2 === 0 ? '#c5a670' : '#cfae78';
    ctx.lineWidth = dark ? 2 : 1.3;
    ctx.beginPath();
    const gx = 6 + i * 10;
    ctx.moveTo(gx, 0);
    for (let y = 0; y <= H; y += 6) {
      ctx.lineTo(gx + Math.sin((y / H) * Math.PI * 4 + i * 1.3) * 3.2, y);
    }
    ctx.stroke();
  }
  // A few short dark mineral streaks.
  ctx.strokeStyle = '#7a5c31';
  ctx.lineWidth = 1.6;
  for (const [sx, sy, len] of [[30, 60, 26], [92, 150, 34], [58, 205, 20]] as const) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 5, sy + len);
    ctx.stroke();
  }
  // Knots: filled dark-brown core + a couple of concentric rings, grain sweeping around each.
  const knot = (kx: number, ky: number, r: number): void => {
    for (let ring = 3; ring >= 1; ring--) {
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * (ring / 3), r * 1.35 * (ring / 3), 0, 0, Math.PI * 2);
      ctx.fillStyle = ring === 1 ? '#4b3618' : ring === 2 ? '#6d4e26' : '#8a6a3a';
      ctx.fill();
    }
    ctx.strokeStyle = '#9c7b45';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(kx, ky, r * 1.5, r * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  };
  knot(44, 96, 7);
  knot(96, 188, 5.5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; // see dirtTexture — all canvas color maps are sRGB
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  plywoodFaceTexCache = tex;
  sharedTextures.add(tex);
  return tex;
}

// Plywood CUT EDGE — the stacked veneer plies, drawn as alternating light/dark bands separated by
// thin dark glue lines, so a sawn edge reads unmistakably as plywood. `orient` picks which way the
// bands run: the box's left/right edges map thickness to U (vertical bands), the top/bottom edges
// map thickness to V (horizontal bands). Cached per orientation.
const plywoodEdgeTexCache: Record<'h' | 'v', THREE.Texture | null> = { h: null, v: null };
function plywoodEdgeTexture(orient: 'h' | 'v'): THREE.Texture {
  const cached = plywoodEdgeTexCache[orient];
  if (cached) return cached;
  const N = 64; // long axis (along the edge)
  const T = 32; // across the thickness — where the plies stack
  const horizontal = orient === 'h'; // bands stack along image height
  const c = document.createElement('canvas');
  c.width = horizontal ? N : T;
  c.height = horizontal ? T : N;
  const ctx = c.getContext('2d')!;
  const plies = 5; // ½" ply ≈ 5 veneers
  const band = T / plies;
  for (let p = 0; p < plies; p++) {
    // Alternate light face-veneer and darker core plies for clear colour separation.
    ctx.fillStyle = p % 2 === 0 ? '#e4cd9c' : '#b48c52';
    const a = p * band;
    if (horizontal) ctx.fillRect(0, a, N, band);
    else ctx.fillRect(a, 0, band, N);
    // Thin dark glue line between plies.
    ctx.fillStyle = '#5c421f';
    if (horizontal) ctx.fillRect(0, a - 0.75, N, 1.5);
    else ctx.fillRect(a - 0.75, 0, 1.5, N);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; // see dirtTexture — all canvas color maps are sRGB
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  plywoodEdgeTexCache[orient] = tex;
  sharedTextures.add(tex);
  return tex;
}

// One plywood sheet as a unit box carrying THREE materials — the grained face on both broad
// faces, and the layered-ply edge on all four sawn edges (vertical bands on the left/right edges,
// horizontal on the top/bottom) — so the plies are visible whichever edge is exposed. Returns the
// wrapper; callers scale it to the sheet's real dimensions. Fresh materials/geometry each call
// (they're disposed per re-render); the canvas textures are shared.
//
// No per-sheet cartoon outline: the standard black silhouette shell, sized to a sheet that's 4×8 ft
// but only ½ in thick, reads as a heavy black FRAME around the whole panel rather than a thin edge.
// Same reasoning as the sandbag tiles (which also skip their own outline) — the earth-wall backing
// behind the sheets already carries the wall silhouette.
function plywoodSheet(parent: THREE.Group): THREE.Group {
  const grad = toonGradient();
  const face = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad, map: plywoodFaceTexture() });
  const edgeV = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad, map: plywoodEdgeTexture('v') });
  const edgeH = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad, map: plywoodEdgeTexture('h') });
  // BoxGeometry material-index order: +x, -x, +y, -y, +z, -z. Local Z is the thin dimension, so
  // ±Z are the broad faces; ±X (left/right edges) and ±Y (top/bottom edges) are the sawn edges.
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const wrapper = new THREE.Group();
  wrapper.add(new THREE.Mesh(geo, [edgeV, edgeV, edgeH, edgeH, face, face]));
  parent.add(wrapper);
  return wrapper;
}

// Role colors now come from the diorama palette and switch WITH the theme — night is a
// hue-shifted second palette (moonlit blue-slate with the sandbags kept lightest so the taught
// geometry stays legible), never just the day colors under dimmer lights. setTheme() swaps
// activePalette and rebuilds the scene, so every builder below picks up the themed colors.
let activePalette: Palette = palette('day');
let ROLE_COLOR: Record<BoxRole, number> = activePalette.role;

// A toon mesh + a slightly-larger black backface shell = a cheap, robust cartoon outline.
// Both live inside one returned Group so a caller positions/rotates ONE object and the outline
// can never drift from its mesh — positioning the mesh alone (leaving a sibling outline at its
// default transform) was the exact bug behind the vehicle-ramp render (see DECISIONS D20).
function addToonMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, colorHex: number, opts?: { opacity?: number; map?: THREE.Texture; noOutline?: boolean }): THREE.Group {
  const mat = new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradient() });
  if (opts?.opacity !== undefined) {
    mat.transparent = true;
    mat.opacity = opts.opacity;
  }
  if (opts?.map) mat.map = opts.map;
  const mesh = new THREE.Mesh(geometry, mat);
  // Every structural mesh participates in the shadow pass — grounded contact is what makes the
  // diorama read as physical instead of floating plastic. The outline shell must NOT cast: a
  // 3.5%-oversized black backface would double every silhouette's shadow edge.
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const wrapper = new THREE.Group();
  if (!opts?.opacity && !opts?.noOutline) {
    const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x16130d, side: THREE.BackSide }));
    outline.scale.multiplyScalar(1.035);
    outline.userData.isOutline = true; // hidden under cutaway — its black backfaces would ink the section
    wrapper.add(outline);
  }
  wrapper.add(mesh);
  parent.add(wrapper);
  return wrapper;
}

function labelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, 2, 2, 252, 60, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(22,19,13,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, 2, 2, 252, 60, 14);
  ctx.stroke();
  ctx.fillStyle = '#16130d';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  // toneMapped:false — labels are UI ink, not scene surfaces; ACES graying a white pill with
  // dark text reads as a rendering mistake.
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 0.8, 1);
  sprite.renderOrder = 999;
  return sprite;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A simple, abstract "toy figure" — not a specific person, just a scale reference. Olive like
// a miniature figurine (a saturated primary would steal focus from the fortification being
// taught — red stays reserved for hazards/ENEMY), with one small blaze band so it stays
// findable at a glance.
// A blocky low-poly SOLDIER for scale — boots, split legs, a shouldered torso with a chest
// harness, arms, a head, and a helmet. The old figure was four stacked capsules that read as a
// bowling pin; a real human silhouette (limbs that separate, shoulders, a helmet) is what makes
// "~5'10" tall" legible at a glance. Proportions are ~7.5 heads tall, faces the enemy (−z).
// Every part goes through addToonMesh so its outline defines the limb against the body — the
// same cel look the rest of the diorama uses.
function buildFigure(group: THREE.Group, x: number, z: number, heightFt: number): void {
  const f = activePalette.figure;
  const H = heightFt;
  const rig = new THREE.Group();
  const helmetCol = new THREE.Color(f.torso).multiplyScalar(0.72).getHex();
  const bootCol = 0x2a2118;

  const part = (w: number, h: number, d: number, col: number, px: number, py: number, pz: number): void => {
    const wrap = addToonMesh(rig, new THREE.BoxGeometry(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d)), col);
    wrap.position.set(x + px, py, z + pz);
  };

  const legSep = 0.055 * H;
  const legW = 0.085 * H, legD = 0.10 * H;
  const bootH = 0.05 * H;
  const legH = 0.42 * H;
  const hipY = bootH + legH;
  // boots (toes forward, toward the enemy at −z)
  part(legW * 1.1, bootH, legD * 1.5, bootCol, -legSep, bootH / 2, -0.03 * H);
  part(legW * 1.1, bootH, legD * 1.5, bootCol, legSep, bootH / 2, -0.03 * H);
  // legs
  part(legW, legH, legD, f.legs, -legSep, bootH + legH / 2, 0);
  part(legW, legH, legD, f.legs, legSep, bootH + legH / 2, 0);
  // pelvis
  part(0.20 * H, 0.08 * H, 0.15 * H, f.legs, 0, hipY + 0.03 * H, 0);
  // torso (shoulders wider than hips) — biacromial breadth ≈ 0.24 × stature (ANSUR II male),
  // so the shoulders don't read cartoonishly wide.
  const torsoW = 0.24 * H, torsoH = 0.28 * H, torsoD = 0.15 * H;
  const torsoY = hipY + 0.04 * H + torsoH / 2;
  part(torsoW, torsoH, torsoD, f.torso, 0, torsoY, 0);
  // chest harness / blaze band — the pop of color that separates the figure from the earthworks
  part(torsoW * 1.03, 0.07 * H, torsoD * 1.05, f.blaze, 0, torsoY + 0.03 * H, 0);
  const shoulderY = torsoY + torsoH / 2;
  // arms at the sides — a shade darker than the jacket so the limb reads as separate from the
  // chest (touching same-color blocks merged into one wide torso).
  const armCol = new THREE.Color(f.torso).multiplyScalar(0.85).getHex();
  const armW = 0.07 * H, armH = 0.30 * H, armD = 0.08 * H;
  const armX = torsoW / 2 + armW / 2;
  part(armW, armH, armD, armCol, -armX, shoulderY - armH / 2, 0);
  part(armW, armH, armD, armCol, armX, shoulderY - armH / 2, 0);
  part(armW, 0.05 * H, armD, f.skin, -armX, shoulderY - armH, 0);
  part(armW, 0.05 * H, armD, f.skin, armX, shoulderY - armH, 0);
  // neck + head
  part(0.07 * H, 0.04 * H, 0.07 * H, f.skin, 0, shoulderY + 0.02 * H, 0);
  const headH = 0.13 * H;
  const headY = shoulderY + 0.04 * H + headH / 2;
  part(0.13 * H, headH, 0.13 * H, f.skin, 0, headY, 0);
  // helmet — a low flat cap sitting on the crown, forehead showing below (a taller dome
  // toon-shaded into two dark lobes and read like goggles). Brim over the brow to finish it.
  const helmet = addToonMesh(rig, new THREE.SphereGeometry(0.078 * H, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetCol);
  helmet.position.set(x, headY + headH * 0.34, z);
  helmet.scale.set(1.12, 0.62, 1.18);
  part(0.15 * H, 0.025 * H, 0.05 * H, helmetCol, 0, headY + headH * 0.36, -0.07 * H); // brim
  group.add(rig);

  const label = labelSprite('For scale (~5\'-10")');
  label.position.set(x, headY + headH + 0.5, z);
  group.add(label);
}

function buildArrow(group: THREE.Group, fromX: number, fromZ: number, toX: number, toZ: number, y: number): void {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const len = Math.max(0.5, Math.hypot(dx, dz));
  const dir = new THREE.Vector3(dx, 0, dz).normalize();
  const mid = new THREE.Vector3((fromX + toX) / 2, y, (fromZ + toZ) / 2);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);

  // Basic (unlit, un-tone-mapped) red: the arrow must stay the most saturated thing in frame in
  // both themes — as a lit toon surface it dimmed with the scene and vanished at night.
  const arrowMat = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color: 0xd23a1e, toneMapped: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len * 0.7, 10), arrowMat());
  shaft.quaternion.copy(quat);
  shaft.rotateX(Math.PI / 2);
  shaft.position.copy(mid).addScaledVector(dir, -len * 0.15);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, len * 0.35, 12), arrowMat());
  head.quaternion.copy(quat);
  head.rotateX(Math.PI / 2);
  head.position.copy(mid).addScaledVector(dir, len * 0.35);

  group.add(shaft, head);
  const label = labelSprite('Enemy direction');
  label.position.set(fromX, y + 1.2, fromZ - len * 0.5);
  group.add(label);
}

function buildWedge(group: THREE.Group, x: number, z: number, radius: number, leftDeg: number, rightDeg: number): void {
  const steps = 20;
  const pts: THREE.Vector3[] = [new THREE.Vector3(x, 0.03, z)];
  for (let i = 0; i <= steps; i++) {
    const deg = leftDeg + ((rightDeg - leftDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    pts.push(new THREE.Vector3(x + radius * Math.sin(rad), 0.03, z - radius * Math.cos(rad)));
  }
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    verts.push(pts[0]!.x, pts[0]!.y, pts[0]!.z, pts[i]!.x, pts[i]!.y, pts[i]!.z, pts[i + 1]!.x, pts[i + 1]!.y, pts[i + 1]!.z);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  // toneMapped:false + a stronger alpha: the fan is an ORIENTATION CUE, not scenery — under
  // ACES + the grade pass, 0.18 red over green grass washed out to an unreadable beige.
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xd23a1e, transparent: true, opacity: 0.3, side: THREE.DoubleSide, toneMapped: false }));
  group.add(mesh);
}

// A smooth annulus (circular parapet) — one extruded ring mesh, no segment seams. Bevelled top
// (and bottom) edge so it reads as a piled MOUND, not a flat-topped block — a real earth
// parapet has a sloped cross-section, and a hard flat top/edge looks like poured concrete.
function ringGeo(x: number, z: number, outerR: number, innerR: number, height: number, rough?: boolean): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const bevelSize = Math.min(0.12, Math.max(0.02, (outerR - innerR) * 0.35));
  const bevelThickness = Math.min(height * 0.45, bevelSize);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: true, bevelThickness, bevelSize, bevelSegments: 3, curveSegments: 32,
  });
  geo.rotateX(-Math.PI / 2); // extrude was along +Z; lay it flat so it extrudes along +Y (up)
  geo.translate(x, 0, z);
  // Only the parapet mound gets roughened, never the thin flat ground annulus (rough is
  // omitted there) — a few hundredths of a foot of noise would swallow a 0.05 ft-tall disc.
  if (rough) roughenMound(geo, 0.05);
  return geo;
}
function buildRing(group: THREE.Group, x: number, z: number, outerR: number, innerR: number, height: number, colorHex: number, map?: THREE.Texture, rough?: boolean): void {
  const mat = new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradient(), ...(map ? { map } : {}) });
  const mesh = new THREE.Mesh(ringGeo(x, z, outerR, innerR, height, rough), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Outline is a HAIRLINE-EXPANDED second ring, not a 1.035-scaled shell: uniform scaling a
  // wide flat annulus inflates it radially AND downward into a fat black skirt at the base
  // (audit: "thick solid-black band rings the torus — reads as a broken outline slab").
  const outline = new THREE.Mesh(
    ringGeo(x, z, outerR + 0.05, Math.max(0.05, innerR - 0.05), height + 0.04, rough),
    new THREE.MeshBasicMaterial({ color: 0x16130d, side: THREE.BackSide }),
  );
  outline.position.y = -0.02;
  outline.userData.isOutline = true;
  const wrapper = new THREE.Group();
  wrapper.add(outline, mesh);
  group.add(wrapper);
}

// Real dirt is never a perfectly smooth CAD extrude — nudge a mound's crown into gentle, coarse
// lumps instead of leaving the beveled top dead-flat (a user complaint: "vaguely rounded but not
// in the shape of real dirt at all"). The noise is keyed off a COARSE (~0.4 ft) quantization of
// WORLD (x,z) — not vertex index or a continuous function — so vertices that coincide in space
// (cap vs. adjacent side-wall vertices, or the same spot on the main mesh vs. its outline shell)
// always draw the identical offset, which is what keeps the lumps seamless instead of cracked.
// The offset fades to ZERO at the base (grade) so the mound still sits flush with the ground —
// only the crown undulates, matching how real piled dirt actually settles.
function roughenMound(geo: THREE.BufferGeometry, amp: number): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-6, maxY - minY);
  const cell = 0.4;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const w = Math.max(0, (y - minY) / span - 0.3) / 0.7; // 0 below 30% height, ramps to 1 at the crown
    if (w <= 0) continue;
    const gx = Math.round(pos.getX(i) / cell);
    const gz = Math.round(pos.getZ(i) / cell);
    const n = hashJitter(gx * 92821 + gz * 68917 + 5) - 0.5; // deterministic, position-keyed
    pos.setY(i, y + n * amp * w);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

// The U-shaped earth parapet: a single simple (non-self-intersecting) 8-point polygon tracing
// dirt piled on the front and both flanks, with the REAR left completely open — no hole, no
// second contour, just one "staple"/parenthesis outline. Points go: down the inner-left face,
// across the inner-front face, up the inner-right face, jump OUT at the open rear end of the
// right arm, down the outer-right face (continuing past the hole's front line to the bulged
// front-outer depth), across the outer-front face, up the outer-left face, jump back IN at the
// open rear end of the left arm. Corners stay rectilinear — the bevel (below) softens every
// edge, and roughenMound breaks up the rest, so no arc math is needed here.
function uFrameLoop(holeL: number, holeW: number, parapetW: number, frontZ: number): THREE.Vector2[] {
  const hl = holeL / 2;
  const hzRear = holeW / 2; // open rear end — flush with the hole's own rear edge
  const hzFrontOuter = -frontZ + parapetW; // bulged front-outer depth
  // uFrameGeo's geo.rotateX(-Math.PI / 2) (below) negates this shape's own Y axis when it maps
  // it to world Z (the extrude's Z becomes world Y/height; this shape's Y becomes world -Z) — so
  // every Z-like coordinate here is entered NEGATED, or the bulge would land at the rear (open,
  // friendly side) instead of the front (aperture, enemy side). Caught by comparing the built
  // mesh's world bounding box against hand-derived front/rear Z values — they came out mirrored.
  return [
    new THREE.Vector2(-hl, -hzRear), // rear-left-inner
    new THREE.Vector2(-hl, -frontZ), // front-left-inner
    new THREE.Vector2(hl, -frontZ), // front-right-inner
    new THREE.Vector2(hl, -hzRear), // rear-right-inner
    new THREE.Vector2(hl + parapetW, -hzRear), // rear-right-outer (jump)
    new THREE.Vector2(hl + parapetW, hzFrontOuter), // front-right-outer
    new THREE.Vector2(-hl - parapetW, hzFrontOuter), // front-left-outer
    new THREE.Vector2(-hl - parapetW, -hzRear), // rear-left-outer (jump back to close)
  ];
}
function uFrameGeo(x: number, z: number, holeL: number, holeW: number, parapetW: number, frontZ: number, height: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(uFrameLoop(holeL, holeW, parapetW, frontZ));
  // A real piled-dirt mound has no hard edge at all — its whole cross-section is a slope. The
  // old 0.12 ft cap was imperceptible against a 3 ft-wide, ~1 ft-tall mound (read as a poured
  // slab); bevelSize now scales with the mound's own thickness/height so the "flat top" all but
  // disappears and the silhouette reads as sloped earth.
  const bevelSize = Math.min(0.9, Math.max(0.08, parapetW * 0.45));
  const bevelThickness = Math.min(height * 0.75, bevelSize);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: true, bevelThickness, bevelSize, bevelSegments: 5, curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2); // extrude was along +Z; lay it flat so it extrudes along +Y (up)
  geo.translate(x, 0, z);
  roughenMound(geo, 0.12);
  return geo;
}
function buildUFrame(group: THREE.Group, x: number, z: number, holeL: number, holeW: number, parapetW: number, frontZ: number, height: number, colorHex: number, map?: THREE.Texture): void {
  const mat = new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradient(), ...(map ? { map } : {}) });
  const mesh = new THREE.Mesh(uFrameGeo(x, z, holeL, holeW, parapetW, frontZ, height), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Hairline-expanded outline, not a uniform scale — same rationale as buildRing's (a uniformly
  // scaled wide flat mound inflates radially AND downward into a fat black skirt at the base).
  // Every OUTER-facing edge (both flanks, the front, the two rear open ends) pushes out;
  // hole-facing inner edges (left/right hole faces, the inner-front face against the sandbags)
  // pull IN toward center — frontZ is negative, so "pull in" means LESS negative (+0.05).
  const outline = new THREE.Mesh(
    uFrameGeo(x, z, Math.max(0.1, holeL - 0.1), holeW + 0.1, parapetW + 0.1, frontZ + 0.05, height + 0.04),
    new THREE.MeshBasicMaterial({ color: 0x16130d, side: THREE.BackSide }),
  );
  outline.position.y = -0.02;
  outline.userData.isOutline = true;
  group.add(outline, mesh);
}

// A sloped earthen excavation face: the vertices on the OUTER side (away from the hole, along
// `axis`/`sign`) flare from unchanged at the bottom to `amount` feet further out at the top —
// a real excavation is wider at the mouth than at the floor. Direct vertex manipulation (not a
// shear matrix or a rotated extrude) so it's easy to reason about exactly: only the outer-face
// vertices move, the inner face (matching the floor) never does, and the geometry stays a
// simple, watertight box the whole time.
function taperOuterFace(geometry: THREE.BufferGeometry, axis: 0 | 2, sign: 1 | -1, amount: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-6, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getComponent(i, axis);
    if (Math.sign(v) === sign) {
      const heightFrac = (pos.getY(i) - minY) / span; // 0 at bottom (unchanged), 1 at top
      pos.setComponent(i, axis, v + sign * amount * heightFrac);
    }
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

// A sheared top face for the vehicle access ramp: the top-face vertices tilt so the −z (deep)
// edge drops `drop` feet below the +z (entry) edge — one continuous grade instead of a
// staircase. Only the top face moves; the bottom and sides stay put, so the box remains a
// simple watertight wedge. Same direct-vertex approach as taperOuterFace.
function shearTopZ(geometry: THREE.BufferGeometry, drop: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); const z = pos.getZ(i);
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const zSpan = Math.max(1e-6, maxZ - minZ);
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > maxY - 1e-4) {
      const frac = (maxZ - pos.getZ(i)) / zSpan; // 0 at +z entry edge, 1 at −z deep edge
      pos.setY(i, pos.getY(i) - drop * frac);
    }
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

// Parapet and overhead cover are ALWAYS sandbag construction per doctrine (§ engine/materials.ts
// bagsParapet/bagsCover) — this tiles small boxes across the footprint instead of one flat slab,
// so "if sandbags are used, it shows sandbags." Individual bags skip their own outline (outlining
// every tiny bag would look busy).
//
// The bags are scaled slightly OVERSIZED vs their layout cell so neighbors press into each
// other — a real stack has no daylight between bags, so the wall needs no filler box behind the
// courses at all. (Earlier versions hid the gaps behind an oversized black outline shell, which
// read as a black backdrop panel at close range, then behind an inset core box, which swallowed
// the bags into a mud slab.)
//
// Each tile is the Blender-authored sandbag prop (DECISIONS D28) once `sandbagGeometry` has
// loaded — a real sagging-pillow shape with its origin at the BASE of the bag (unit bbox y 0..1,
// the CommandHub-Led pipeline convention) — cloned and scaled to the tile cell with a small
// deterministic per-instance rotation/scale jitter so a repeated asset doesn't read as an
// obviously stamped grid. Falls back to a plain box (the pre-Blender look) until the GLB resolves.
function buildSandbagWall(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, colorHex: number): void {
  // Tile in ALL THREE axes from the pure layout (render3d/propLayout.ts): cells stay close to
  // the doctrine bag's laid proportions, so a 3-ft-thick parapet reads as several bags deep —
  // never one authored bag stretched 3 ft deep. The fallback box tiles the SAME cells (and is
  // translated to the same base-at-origin convention as the prop), so the wall's envelope is
  // identical before and after the async GLB resolves.
  const { cols, rows, layers, cellW, cellH, cellD } = bagWallLayout(w, h, d);
  const mat = new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradient() });
  const bagGeo = sandbagGeometry ?? null;
  let fallbackGeo: THREE.BoxGeometry | null = null;
  if (!bagGeo) {
    const fh = Math.max(0.05, cellH - 0.04);
    fallbackGeo = new THREE.BoxGeometry(Math.max(0.05, cellW - 0.04), fh, Math.max(0.05, cellD - 0.02));
    fallbackGeo.translate(0, fh / 2, 0);
  }
  for (let l = 0; l < layers; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = r * 97 + c * 13 + l * 29 + x + z;
        const bx = x - w / 2 + (c + 0.5) * cellW + (hashJitter(seed) - 0.5) * cellW * 0.06;
        const baseY = y - h / 2 + r * cellH; // the prop's origin is the bag's BASE
        const bz = z - d / 2 + (l + 0.5) * cellD;
        const mesh = new THREE.Mesh(bagGeo ?? fallbackGeo!, mat);
        let settle = 0;
        if (bagGeo) {
          const jitter = 0.97 + hashJitter(seed + 0.5) * 0.1;
          mesh.scale.set(Math.max(0.05, cellW * 1.08) * jitter, Math.max(0.05, cellH * 1.05) * jitter, Math.max(0.05, cellD * 1.1) * jitter);
          mesh.rotation.y = (hashJitter(seed + 0.25) - 0.5) * 0.35;
          mesh.rotation.z = (hashJitter(seed + 0.75) - 0.5) * 0.12;
          settle = cellH * 0.03; // settle slightly, like a real stacked course
        }
        mesh.position.set(bx, baseY - settle, bz);
        group.add(mesh);
      }
    }
  }
}

// Pickets & wire: an open lattice (vertical posts + two horizontal wire lines), visibly NOT a
// solid wall — the clearest possible contrast against sandbags/dirt/panel facings. Each post is
// the Blender-authored driven-stake prop (DECISIONS D28) once `picketGeometry` has loaded, falling
// back to a plain cylinder until the GLB resolves.
function buildPicketWall(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, spacing: number): void {
  const alongX = w >= d; // front/rear walls run along X; left/right walls run along Z
  const length = alongX ? w : d;
  const count = Math.max(2, Math.round(length / Math.max(0.5, spacing)) + 1);
  const postR = Math.max(0.04, Math.min(0.1, h / 20));
  const postMat = new THREE.MeshToonMaterial({ color: 0x4a3a22, gradientMap: toonGradient() });
  const postGeo = picketGeometry ?? null;
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 0.5 : i / (count - 1);
    const offset = (frac - 0.5) * length;
    const post = new THREE.Mesh(postGeo ?? new THREE.CylinderGeometry(postR, postR, h, 8), postMat);
    // The GLB prop's origin is the stake's BASE (unit bbox y 0..1); the fallback cylinder is
    // center-origin — place each accordingly so the posts stand ON the wall's bottom either way.
    let postY = y;
    if (postGeo) {
      post.scale.set(postR * 2, h, postR * 2);
      post.rotation.y = hashJitter(i + x + z) * Math.PI * 2; // hewn posts have no "front", vary freely
      postY = y - h / 2;
    }
    post.position.set(alongX ? x + offset : x, postY, alongX ? z : z + offset);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x55524a });
  for (const frac of [0.28, 0.72]) {
    const wy = y - h / 2 + h * frac;
    const wireGeo = alongX ? new THREE.BoxGeometry(length, 0.035, 0.035) : new THREE.BoxGeometry(0.035, 0.035, length);
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(x, wy, z);
    group.add(wire);
  }
}

// Dressed (actual) cross-sections in feet for nominal lumber sizes — a "2x4" is really 1.5" x 3.5".
const LUMBER_DRESSED: Record<LumberSize, { width: number; thick: number }> = {
  '2x4': { width: 3.5 / 12, thick: 1.5 / 12 },
  '2x6': { width: 5.5 / 12, thick: 1.5 / 12 },
  '4x4': { width: 3.5 / 12, thick: 3.5 / 12 },
};

// One piece of dimensional lumber — the Blender-authored prop for `size` (each modeled at its
// true dressed cross-section with a size-appropriate crown, DECISIONS D28), toon-shaded with the
// sawn-lumber grain and the standard cartoon outline. The prop's length runs along local X, face
// width along local Y, thickness along local Z; callers rotate the returned wrapper into place.
// Width/thickness default to the size's dressed dimensions; falls back to a plain box until the
// GLB resolves (same lifecycle as every other prop).
function lumberPiece(group: THREE.Group, size: LumberSize, length: number, width?: number, thick?: number): THREE.Group {
  const dressed = LUMBER_DRESSED[size];
  const wrapper = addToonMesh(group, lumberGeometry[size] ?? new THREE.BoxGeometry(1, 1, 1), 0xffffff, { map: lumberTexture() });
  const l = Math.max(0.05, length);
  const w = width ?? dressed.width;
  const t = thick ?? dressed.thick;
  wrapper.scale.set(l, w, t);
  // addToonMesh's uniform 3.5% outline shell is calibrated for compact props (a sandbag) — on
  // an 8-ft board, 3.5% of the LENGTH is ~3 inches of solid black past each end cap. Rescale
  // the outline per-axis so the rim is a constant hairline in real feet on every face instead.
  const outlineFt = 0.015;
  const outline = wrapper.children.length > 1 ? (wrapper.children[0] as THREE.Mesh) : null;
  outline?.scale.set(1 + (2 * outlineFt) / l, 1 + (2 * outlineFt) / w, 1 + (2 * outlineFt) / t);
  return wrapper;
}

// A deck of 2x6 planks over a solid fill body — the standing platform and the firing step are
// built lumber, not bare earth mounds. Planks run along the longer horizontal dimension, laid
// side by side across the shorter one, each one a real 2x6 prop (1.5" deck over the fill below).
function buildPlankDeck(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, colorHex: number): void {
  const t = LUMBER_DRESSED['2x6'].thick;
  const body = addToonMesh(group, new THREE.BoxGeometry(Math.max(0.05, w), Math.max(0.05, h - t), Math.max(0.05, d)), colorHex, { map: dirtTexture() });
  body.position.set(x, y - t / 2, z);
  const alongX = w >= d;
  const across = alongX ? d : w;
  const length = (alongX ? w : d) - 0.04;
  const count = Math.max(1, Math.round(across / LUMBER_DRESSED['2x6'].width));
  const cell = across / count;
  const topY = y + h / 2 - t / 2;
  for (let i = 0; i < count; i++) {
    const jitter = 0.99 + hashJitter(i * 17 + x + z) * 0.01;
    const plank = lumberPiece(group, '2x6', length * jitter, Math.max(0.05, cell - 0.025), t);
    plank.rotateY(alongX ? 0 : Math.PI / 2);
    plank.rotateX(-Math.PI / 2); // about its own length axis: face width flat, thickness up
    const off = -across / 2 + (i + 0.5) * cell;
    plank.position.set(alongX ? x : x + off, topY, alongX ? z + off : z);
  }
}

// Timber & plywood revetment: the earth wall itself (dirt box) with full 4-ft-wide plywood
// sheets pressed flat against its hole-side face (cut down to wall height, ½" thick — floored at
// 0.05 ft so the edge still reads at diorama scale). Plywood ONLY — no rendered frame; the BOM
// carries the timber, the visual carries the facing. `outerAxis`/`outerSign` point AWAY from the
// hole (scene3d's taper orientation), so facing goes on the opposite side. Each sheet is a
// multi-material box (grained face + layered-ply cut edges, see plywoodSheet), with tiny
// deterministic lean/scale jitter so tiled sheets read hand-placed.
function buildPlywoodWall(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, outerAxis: 0 | 2, outerSign: 1 | -1): void {
  const alongX = w >= d; // front/rear walls run along X; left/right walls run along Z
  const length = alongX ? w : d;
  const wallT = alongX ? d : w;

  const backing = addToonMesh(group, new THREE.BoxGeometry(Math.max(0.05, w), Math.max(0.05, h), Math.max(0.05, d)), ROLE_COLOR.bayWall, { map: dirtTexture() });
  backing.position.set(x, y, z);

  const sheetT = 0.05; // ½" plywood, floored for visibility
  // The four wall boxes all span the full hole footprint and OVERLAP in the corners — facing cut
  // to the box length would poke through the adjacent walls as crossed fins. Span only the open
  // face between the neighboring walls' own facings instead.
  const run = Math.max(0.5, length - 2 * (wallT + sheetT));
  const cols = Math.max(1, Math.round(run / 4)); // full sheets are 4 ft wide
  const cellL = run / cols;
  // Coordinate (along outerAxis) of the sheet plane: just inside the hole, flush against the
  // earth face.
  const wallC = outerAxis === 0 ? x : z;
  const sheetC = wallC - outerSign * (wallT / 2 + sheetT / 2);

  for (let i = 0; i < cols; i++) {
    const seed = i * 31 + x + z;
    const along = (alongX ? x : z) - run / 2 + (i + 0.5) * cellL;
    const jitter = 0.985 + hashJitter(seed) * 0.015;
    const wrapper = plywoodSheet(group);
    wrapper.scale.set(Math.max(0.1, cellL - 0.08) * jitter, Math.max(0.1, h - 0.06) * jitter, sheetT);
    if (!alongX) wrapper.rotation.y = Math.PI / 2;
    wrapper.rotation.z += (hashJitter(seed + 0.5) - 0.5) * 0.02; // slight hand-placed lean
    wrapper.position.set(alongX ? along : sheetC, y, alongX ? sheetC : along);
  }
}

function buildPart(group: THREE.Group, part: Part3, bags: SandbagBatcher): void {
  // Tag everything this part adds with its construction stage so the stage scrubber's rise-in
  // animation can find what JUST appeared (children appended during this call get the tag).
  const firstNew = group.children.length;
  buildPartInner(group, part, bags);
  const stage = partStage(part);
  for (let i = firstNew; i < group.children.length; i++) group.children[i]!.userData.stage = stage;
}

function buildPartInner(group: THREE.Group, part: Part3, bags: SandbagBatcher): void {
  switch (part.kind) {
    case 'box': {
      // Parapet + overhead cover are ALWAYS sandbag construction per doctrine — tiled regardless
      // of `finish`. A revetted excavation face gets its own distinct material; an unrevetted one
      // is bare (sloped, if part.taperAmount is set) or plain earth.
      //
      // Sandbag walls queue into the InstancedMesh batcher instead of spawning one Mesh per bag
      // (a bunker scene was ~900 meshes; batched it's a handful of draw calls) — the tiling math
      // is bit-identical (engine/bagInstancing.ts replicates buildSandbagWall's cells/seeds).
      // buildSandbagWall itself stays for the props-showcase gallery.
      if (part.role === 'parapet' || part.role === 'cover') {
        bags.wall(part.x, part.y, part.z, part.w, part.h, part.d, ROLE_COLOR[part.role]);
      } else if (part.role === 'bayWall' && part.finish === 'sandbag') {
        bags.wall(part.x, part.y, part.z, part.w, part.h, part.d, ROLE_COLOR.bayWall);
      } else if (part.role === 'bayWall' && part.finish === 'picket') {
        buildPicketWall(group, part.x, part.y, part.z, part.w, part.h, part.d, part.picketSpacing ?? 2);
      } else if (part.role === 'bayWall' && part.finish === 'timber') {
        buildPlywoodWall(group, part.x, part.y, part.z, part.w, part.h, part.d, part.taperAxis ?? (part.w >= part.d ? 2 : 0), part.taperSign ?? 1);
      } else if (part.role === 'stringer') {
        // Roof stringers are dimensional timber per doctrine (stringerSizeForSpan) — the 4x4
        // prop scaled to the descriptor's own cross-section, laid across the bay.
        const alongX = part.w >= part.d;
        const beam = lumberPiece(group, '4x4', alongX ? part.w : part.d, part.h, alongX ? part.d : part.w);
        if (!alongX) beam.rotation.y = Math.PI / 2;
        beam.position.set(part.x, part.y, part.z);
      } else if (part.role === 'platform' || part.role === 'firingStep') {
        buildPlankDeck(group, part.x, part.y, part.z, part.w, part.h, part.d, ROLE_COLOR[part.role]);
      } else {
        const geometry = new THREE.BoxGeometry(Math.max(0.05, part.w), Math.max(0.05, part.h), Math.max(0.05, part.d));
        // Both the sloped bay wall AND the mounded earth parapet flare their outer face.
        if ((part.role === 'bayWall' || part.role === 'earthParapet') && part.taperAmount) {
          taperOuterFace(geometry, part.taperAxis ?? 2, part.taperSign ?? 1, part.taperAmount);
        }
        // The vehicle access ramp's floor is a sheared wedge (continuous grade, not steps).
        if (part.shearDrop) shearTopZ(geometry, part.shearDrop);
        let map: THREE.Texture | undefined;
        let tint = ROLE_COLOR[part.role];
        if (part.role === 'bayWall' && part.finish === 'corrugated') {
          // The corrugated map carries the steel look itself — tinting it with the earth-brown
          // wall color would land it in mud (see dirtTexture's neutral-map rationale).
          map = corrugatedTexture();
          tint = 0xffffff;
        } else if (
          part.role === 'ground' || part.role === 'bayFloor' || part.role === 'rampBerm' ||
          part.role === 'earthParapet' || part.role === 'entryStep' || (part.role === 'bayWall' && part.finish === 'earth')
        ) {
          // Earth parapet = mounded dirt (spoil), same material as the ground/berm. Entry steps
          // are cut earth too.
          map = dirtTexture();
        }
        // Interior surfaces (bay walls/floors, ramp treads, entry steps) skip the outline shell:
        // they sit INSIDE an excavation against earth, so a silhouette shell only ever shows as
        // stray black hairlines where their tops break grade at the hole mouth. Outlines are for
        // free-standing silhouettes (parapets are bags, no shells; berms/covers keep theirs).
        const interior = part.role === 'bayWall' || part.role === 'bayFloor' || part.role === 'sump' || part.role === 'entryStep';
        const opts = part.role === 'camoNet' ? { opacity: 0.4 } : { ...(map ? { map } : {}), ...(interior ? { noOutline: true } : {}) };
        const wrapper = addToonMesh(group, geometry, tint, opts);
        wrapper.position.set(part.x, part.y, part.z);
      }
      if (part.label) {
        const label = labelSprite(part.label);
        label.position.set(part.x, part.y + part.h / 2 + 0.6, part.z);
        group.add(label);
      }
      break;
    }
    case 'cyl': {
      const radiusBottom = Math.max(0.05, part.radius);
      const radiusTop = Math.max(0.05, part.radiusTop ?? part.radius);
      const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, Math.max(0.05, part.height), 24);
      const map = part.role === 'bayFloor' ? dirtTexture() : undefined;
      // Same interior rule as the box path: pit floors/sumps sit inside the excavation — an
      // outline shell only leaks hairlines where they break grade.
      const cylInterior = part.role === 'bayFloor' || part.role === 'sump';
      const wrapper = addToonMesh(group, geometry, ROLE_COLOR[part.role], { ...(map ? { map } : {}), ...(cylInterior ? { noOutline: true } : {}) });
      wrapper.position.set(part.x, part.y, part.z);
      if (part.label) {
        const label = labelSprite(part.label);
        label.position.set(part.x, part.y + part.height / 2 + 0.5, part.z);
        group.add(label);
      }
      break;
    }
    case 'ring': {
      const isEarth = part.role === 'earthParapet';
      const map = isEarth ? dirtTexture() : undefined;
      buildRing(group, part.x, part.z, part.outerR, part.innerR, part.height, ROLE_COLOR[part.role], map, isEarth);
      break;
    }
    case 'frame': {
      const map = part.role === 'earthParapet' ? dirtTexture() : undefined;
      buildUFrame(group, part.x, part.z, part.holeL, part.holeW, part.parapetW, part.frontZ, part.height, ROLE_COLOR[part.role], map);
      break;
    }
    case 'wedge':
      buildWedge(group, part.x, part.z, part.radius, part.leftDeg, part.rightDeg);
      break;
    case 'arrow':
      buildArrow(group, part.fromX, part.fromZ, part.toX, part.toZ, part.y);
      break;
    case 'figure':
      buildFigure(group, part.x, part.z, part.heightFt);
      break;
  }
}

export interface ViewOpts {
  stage?: number; // construction stage 0..6 (undefined ⇒ final)
  cutaway?: boolean; // clip the near half so the interior/OHC reads
}

export interface ThreeViewer {
  canvas: HTMLCanvasElement;
  attach(container: HTMLElement): void;
  update(result: Result, opts?: ViewOpts): void;
  resize(): void;
  resetView(): void;
  setTheme(theme: 'day' | 'night'): void;
  dispose(): void;
}

export function createThreeViewer(): ThreeViewer {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D model of the position — drag to rotate, scroll to zoom');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // pan-y (not 'none'): the model sits in a scrolling page/column, so a one-finger VERTICAL
  // drag must scroll the page THROUGH the model — with 'none' the model trapped every touch and
  // the user couldn't scroll past it on a phone. pan-y still routes one-finger HORIZONTAL drags
  // (the "turn it around" gesture) and all multi-touch (pinch-zoom, two-finger orbit) to
  // OrbitControls. Re-applied after `new OrbitControls` below, which forces 'none' on connect().
  canvas.style.touchAction = 'pan-y';

  // preserveDrawingBuffer:true — without it, a throttled/backgrounded tab (or any read of the
  // canvas outside the exact rAF tick, e.g. a browser mid-frame) can show a blank/cleared canvas
  // since the UA is otherwise free to clear the buffer right after compositing each frame.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // Cutaway support: one global clipping plane the viewer toggles. Clipping is off until the
  // user presses Cutaway (localClippingEnabled gates ALL material.clippingPlanes at once).
  // A plane KEEPS the half its normal points toward. The default camera sits on +z (the rear,
  // beside the scale figure), so to open a cross-section of the fighting bay we clip the NEAR
  // (+z, rear) half: normal (0,0,-1) keeps z<0 (front + interior) and clips z>0. Pointing the
  // normal at +z instead clips the FAR half the viewer already can't see (the original bug —
  // the cutaway appeared to do almost nothing).
  renderer.localClippingEnabled = true;
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0); // clips the near (rear, +z) half toward the camera

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.49; // never dip below ground
  controls.minDistance = 3;
  controls.maxDistance = 200;
  // OrbitControls.connect() (called from its constructor) hard-sets touchAction='none' to grab
  // every touch. Override it back to pan-y so vertical page-scroll passes through the model on
  // mobile; horizontal drag + pinch still reach the controls. (See the canvas init above.)
  renderer.domElement.style.touchAction = 'pan-y';

  // ── Diorama light rig (engine/palette.ts) ────────────────────────────────────
  // Keylight + fill, not a wash: the old triple-stacked rig (ambient 0.55 + hemi 1.1 + sun 1.0
  // ≈ 2.6x white) collapsed the 4-band toon gradient to its top bands — the "flat plastic"
  // look. Budget now ≈ 1.9x across hemi/sun/ambient/rim so the bands actually span 4 values,
  // and the sun casts real PCF-soft shadows (grounded contact is the single biggest tell that
  // separates a physical diorama from floating game pieces).
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in three r185 (falls back to PCF with a console warning) —
  // plain PCF + a blur radius gives the same soft penumbra without the noise.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x4a3a22, 0.45);
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.castShadow = true;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02; // feet — kills acne on the bumpy sandbag prop without peter-panning
  sun.shadow.radius = 4; // soft painted-shadow edge, not a hard CAD shadow
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  // Cool counter-light with NO shadows: on toon materials a rim like this pushes a band-step
  // highlight along silhouettes so the black outline shells read as deliberate ink.
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  // Section fill: OFF except in cutaway. The clip plane opens the model toward +z (the camera's
  // default side), so nothing in the base rig lights the freshly-exposed interior faces — a
  // cut position read as a black hollow. This warm, shadowless key shines from above-behind the
  // camera INTO the opened half so the floor, walls, stringers and OHC underside are legible.
  const sectionLight = new THREE.DirectionalLight(0xffe9cf, 0);
  scene.add(hemi, sun, ambient, rim, sectionLight);

  // Sky dome + fog (engine/sky.ts) — a painted 3-stop backdrop, not a photo sky: real dioramas
  // sit in front of a lit painted backdrop, and a photo sky would make the toon geometry look
  // like a mistake. The dome replaces scene.background entirely.
  const skyRig = buildSky(280);
  scene.add(skyRig.dome);

  // Post pipeline (engine/post.ts): ACES + MSAA composer + tilt-shift miniature band + grade,
  // tiered by device. 'low' falls back to the plain renderer path (current behavior).
  const pipeline = createPipeline(renderer, scene, camera, detectTier());

  // Cutaway state: read by applyLightRig (ambient bump + section fill) and set by applyCutaway.
  // applyCutaway runs first in update(), then applyLightRig, so the flag is current when the rig
  // reads it. Toggling Cutaway re-runs update() → both, so the section fill tracks the button.
  let cutawayOn = false;

  function applyLightRig(size: number): void {
    const L = activePalette.light;
    hemi.color.set(L.hemiSky);
    hemi.groundColor.set(L.hemiGround);
    hemi.intensity = L.hemiIntensity;
    sun.color.set(L.sunColor);
    sun.intensity = L.sunIntensity;
    sun.position.set(L.sunFrom[0] * size * 1.6, L.sunFrom[1] * size * 1.6, L.sunFrom[2] * size * 1.6);
    // Cutaway lifts the ambient floor a step so the exposed interior never crushes to black.
    ambient.intensity = L.ambientIntensity + (cutawayOn ? 0.14 : 0);
    rim.color.set(L.rimColor);
    rim.intensity = L.rimIntensity;
    rim.position.set(L.rimFrom[0] * size * 1.6, L.rimFrom[1] * size * 1.6, L.rimFrom[2] * size * 1.6);
    // Section fill aims from above and BEHIND the camera's default +z vantage, straight into the
    // opened half. Warm in day, cooler moonlight at night (tied to the key color). Only lit when
    // a section is open.
    sectionLight.color.set(L.sunColor);
    sectionLight.intensity = cutawayOn ? 0.85 : 0;
    sectionLight.position.set(size * 0.35, size * 1.0, size * 1.5);
    // Fit the shadow frustum to the model, not a fixed box — too big wastes map resolution
    // (blocky shadows), too small clips them.
    const ext = size * 0.85;
    sun.shadow.camera.left = -ext;
    sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext;
    sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = size * 5;
    sun.shadow.intensity = L.shadowStrength;
    // Reallocate the shadow render target ONLY when its size actually changes (tier demotion /
    // theme flip) — this runs on every input keystroke, and disposing a 2048² target each time
    // is pure GPU allocation churn (lifecycle review finding).
    const mapSize = pipeline.tier === 'low' ? 1024 : L.shadowMapSize;
    if (sun.shadow.mapSize.x !== mapSize) {
      sun.shadow.mapSize.setScalar(mapSize);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    sun.shadow.camera.updateProjectionMatrix();
  }

  const partsGroup = new THREE.Group();
  scene.add(partsGroup);

  // Terrain lives in its OWN group, cached by a content key: the app rebuilds partsGroup on
  // every input change (every keystroke), but repainting a 1024² ground canvas + re-extruding
  // the earth block each time is the single most expensive part of a rebuild — and the terrain
  // only actually changes when the footprint/theme/stage-0 state does (perf review finding).
  const terrainGroup = new THREE.Group();
  scene.add(terrainGroup);
  let terrainKey = '';
  let terrainDispose: (() => void) | null = null;

  let framed = false;
  let everFramed = false;
  let currentContainer: HTMLElement | null = null;
  let ro: ResizeObserver | null = null;
  let raf = 0;
  let lastResult: Result | null = null;
  let lastOpts: ViewOpts = {};
  let theme: Theme3D = 'day';

  // Dev-only inspection handle (stripped from prod builds): lets tooling/tests query and frame
  // the live scene without threading debug APIs through the app.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__sap3d = {
      scene, partsGroup, renderer, pipeline,
      camera: () => camera, controls: () => controls,
    };
  }

  // ── Camera fly-to (eased) ─────────────────────────────────────────────────────
  // Reset-view/first-frame-of-a-new-position glides instead of teleporting — cancelled the
  // instant the user grabs the controls so it never fights their input.
  let fly: { fromPos: THREE.Vector3; fromTgt: THREE.Vector3; toPos: THREE.Vector3; toTgt: THREE.Vector3; start: number } | null = null;
  controls.addEventListener('start', () => { fly = null; });
  function flyTo(toPos: THREE.Vector3, toTgt: THREE.Vector3): void {
    if (!everFramed) {
      // Very first frame: snap. An animation before the user has even seen the model is noise.
      camera.position.copy(toPos);
      controls.target.copy(toTgt);
      controls.update();
      everFramed = true;
      return;
    }
    fly = { fromPos: camera.position.clone(), fromTgt: controls.target.clone(), toPos, toTgt, start: performance.now() };
  }

  // ── Stage rise-in ─────────────────────────────────────────────────────────────
  // When the build-stage scrubber advances, the parts that JUST appeared rise ~0.4 ft into
  // place — the model visibly "builds itself" instead of blinking. Rebuild-driven (parts are
  // recreated every update), so this just offsets the new stage's objects and eases them home.
  let riseAnims: Array<{ obj: THREE.Object3D; baseY: number; start: number }> = [];
  function startStageRise(stage: number): void {
    riseAnims = [];
    const now = performance.now();
    for (const child of partsGroup.children) {
      if (child.userData.stage === stage) {
        riseAnims.push({ obj: child, baseY: child.position.y, start: now });
        child.position.y -= 0.45;
      }
    }
  }

  // Apply the cutaway clip to every material in the parts + terrain groups (after each rebuild).
  // Three coupled changes make a section read as SOLID rather than a black hollow:
  //   1. clip the near half (the plane) — the actual cut;
  //   2. double-side the lit toon materials so a clipped box shows its interior back-faces as
  //      solid shaded earth instead of see-through nothing (terrain is already DoubleSide);
  //   3. hide the black BackSide outline shells — their interiors face the camera through every
  //      cut and would ink whole regions solid black.
  // Materials + outlines are rebuilt every update() and this runs every update(), so there is no
  // restore bookkeeping: when `on` is false we simply set FrontSide / visible again.
  function applyCutaway(on: boolean): void {
    cutawayOn = on;
    const planes = on ? [cutPlane] : [];
    // Parts: clip + double-side the lit toon materials + hide the black outline shells.
    partsGroup.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.userData.isOutline) { child.visible = !on; return; }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m) continue;
        m.clippingPlanes = planes;
        if (m instanceof THREE.MeshToonMaterial) m.side = on ? THREE.DoubleSide : THREE.FrontSide;
      }
    });
    // Terrain: clip only — its materials are ALREADY DoubleSide by contract (a single-sided
    // shell reads as paper-thin over a void), so leave `side` untouched.
    terrainGroup.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) if (m) m.clippingPlanes = planes;
    });
  }

  // Theme boot: paint the sky, aim the lights, set fog + exposure for the default day look.
  skyRig.setTheme(activePalette);
  applyFog(scene, activePalette, 60);
  pipeline.setTheme(activePalette);
  applyLightRig(30);

  const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

  // Frame-time watchdog: if the composer path can't hold a usable frame rate on this device,
  // demote the pipeline tier ONCE rather than letting the whole app feel sluggish. 60-frame
  // rolling average, threshold generous (25 fps) so a momentary GC never triggers it.
  let frameTimes: number[] = [];
  let lastFrameAt = 0;
  let demoted = false;

  function loop(): void {
    raf = requestAnimationFrame(loop);
    const now = performance.now();

    if (fly) {
      const t = Math.min(1, (now - fly.start) / 700);
      const k = easeInOut(t);
      camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
      controls.target.lerpVectors(fly.fromTgt, fly.toTgt, k);
      if (t >= 1) fly = null;
    }
    if (riseAnims.length) {
      const remaining: typeof riseAnims = [];
      for (const a of riseAnims) {
        const t = Math.min(1, (now - a.start) / 340);
        a.obj.position.y = a.baseY - 0.45 * (1 - easeOut(t));
        if (t < 1) remaining.push(a);
      }
      riseAnims = remaining;
    }

    controls.update();
    pipeline.render();

    if (lastFrameAt > 0) {
      const dt = now - lastFrameAt;
      // rAF pauses in background tabs — a single giant delta after tab-switch would poison the
      // rolling average and permanently demote a fast machine (correctness review finding).
      // Outliers reset the window instead of entering it.
      if (dt < 250) {
        frameTimes.push(dt);
        if (frameTimes.length > 60) frameTimes.shift();
      } else {
        frameTimes = [];
      }
      if (!demoted && frameTimes.length === 60 && pipeline.tier !== 'low') {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / 60;
        if (avg > 40) {
          demoted = true;
          pipeline.setTier(pipeline.tier === 'high' ? 'medium' : 'low');
          frameTimes = [];
        }
      }
    }
    lastFrameAt = now;
  }
  loop();

  function doResize(): void {
    const el = currentContainer;
    if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight || w * 0.72);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h, Math.min(2, window.devicePixelRatio || 1));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const api: ThreeViewer = {
    canvas,
    attach(container: HTMLElement) {
      if (currentContainer === container && container.contains(canvas)) return;
      container.appendChild(canvas);
      currentContainer = container;
      ro?.disconnect();
      ro = new ResizeObserver(() => doResize());
      ro.observe(container);
      doResize();
    },
    update(result: Result, opts: ViewOpts = {}) {
      const prevStage = lastOpts.stage;
      lastResult = result;
      lastOpts = opts;
      riseAnims = [];
      // Resolve the working palette from theme AND the picked soil — the dirt you see must be
      // the dirt you chose (the soil input already drives dig labor and wall slope; rendering
      // green loam over a clay or rock pick would contradict the model's own numbers).
      activePalette = paletteFor(theme, result.inputs.soil);
      ROLE_COLOR = activePalette.role;
      disposeObject(partsGroup);
      partsGroup.clear();
      const model = buildScene3D(result, { stage: opts.stage, cutaway: opts.cutaway });

      // Terrain path: one earth block with TRUE holes (museum-diorama base with strata sides)
      // replaces the flat role-'ground' frame parts — those stay in the descriptor as the
      // low-tier fallback. At stage 0 (post security — nothing dug yet) the ground renders
      // UNBROKEN: holes only exist once the hasty scrape (stage 1) has happened. The build is
      // cached by content key (see terrainGroup above) so keystroke rebuilds skip it entirely.
      const useTerrain = model.terrain !== undefined && pipeline.tier !== 'low';
      if (useTerrain && model.terrain) {
        const spec = opts.stage !== undefined && opts.stage < 1 ? { ...model.terrain, holes: [] } : model.terrain;
        const scatter = pipeline.tier === 'high';
        // While a cutaway is open, extrude the crust as a solid block down past the deepest hole
        // so the clipped section reads as full-height solid earth (see buildTerrain's sectionDepth).
        const maxHole = spec.holes.reduce((m, h) => Math.max(m, h.depth), 0);
        const sectionDepth = model.cutaway && maxHole > 0.8 ? maxHole + 1.5 : undefined;
        const key = JSON.stringify(spec) + '|' + theme + '|' + scatter + '|' + result.inputs.soil + '|sec' + (sectionDepth ?? 0);
        if (key !== terrainKey) {
          terrainKey = key;
          terrainDispose?.();
          disposeObject(terrainGroup);
          terrainGroup.clear();
          const t = buildTerrain(spec, activePalette, { scatter, sectionDepth });
          terrainDispose = t.dispose;
          terrainGroup.add(t.group);
        }
        terrainGroup.visible = true;
      } else {
        terrainGroup.visible = false;
      }

      const bags = new SandbagBatcher(sandbagGeometry, activePalette.bagJitter);
      const bagStageByColor = new Map<number, number>();
      for (const part of model.parts) {
        if (useTerrain && (part.kind === 'box' || part.kind === 'ring') && part.role === 'ground') continue;
        if ((part.kind === 'box') && (part.role === 'parapet' || part.role === 'cover' || (part.role === 'bayWall' && part.finish === 'sandbag'))) {
          bagStageByColor.set(part.role === 'bayWall' ? ROLE_COLOR.bayWall : ROLE_COLOR[part.role], partStage(part));
        }
        buildPart(partsGroup, part, bags);
      }
      const beforeFlush = partsGroup.children.length;
      bags.flush(partsGroup);
      for (let i = beforeFlush; i < partsGroup.children.length; i++) {
        const child = partsGroup.children[i]!;
        const hex = child.userData.colorHex as number | undefined;
        child.userData.stage = hex !== undefined ? (bagStageByColor.get(hex) ?? 0) : 0;
      }

      applyCutaway(model.cutaway);
      applyLightRig(model.bounds.size);
      applyFog(scene, activePalette, model.bounds.size);

      // Stage scrubbed FORWARD: rise-in the parts that just appeared.
      if (opts.stage !== undefined && prevStage !== undefined && opts.stage === prevStage + 1) {
        startStageRise(opts.stage);
      }

      if (!framed) {
        framed = true;
        const size = model.bounds.size;
        // Aim the target at whichever is deeper: the usual shallow 8%-of-size dip (most
        // positions), or the model's own real depth (the vehicle ramp's exaggerated relief runs
        // far deeper than 8% of its wide footprint — aiming shallow there left the camera looking
        // mostly over the top of the cut at open sky instead of down into it).
        const targetDepth = Math.max(size * 0.08, model.bounds.depth * 0.5);
        flyTo(new THREE.Vector3(size * 0.55, size * 0.5, size * 0.7), new THREE.Vector3(0, -targetDepth, 0));
      }
    },
    resize: doResize,
    resetView() {
      framed = false;
    },
    setTheme,
    dispose() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      rerenderCallbacks.delete(onAssetsReady);
      terrainDispose?.();
      disposeObject(terrainGroup);
      disposeObject(partsGroup);
      disposeObject(scene);
      sun.shadow.dispose(); // the live shadow render target isn't reachable by disposeObject
      skyRig.dispose();
      pipeline.dispose();
      controls.dispose();
      renderer.dispose();
    },
  };

  // Registered so that when the Blender-authored sandbag/picket GLBs finish loading (they load
  // async, see "Blender-authored props" above), this viewer instance swaps the placeholder
  // box/cylinder geometry for the real prop without the caller needing to do anything.
  function onAssetsReady(): void {
    if (lastResult) api.update(lastResult, lastOpts);
  }
  rerenderCallbacks.add(onAssetsReady);

  return api;

  // Theme flip = swap the ACTIVE PALETTE and rebuild: night is a hue-shifted second palette
  // (terrain, sandbags, dirt, figure all re-colored), plus the moonlit sky/fog/exposure — not
  // the old approach of dimming the day lights over unchanged day colors.
  function setTheme(next: 'day' | 'night'): void {
    if (theme === next) return;
    theme = next;
    activePalette = palette(next);
    ROLE_COLOR = activePalette.role;
    skyRig.setTheme(activePalette);
    pipeline.setTheme(activePalette);
    if (lastResult) api.update(lastResult, lastOpts);
    else { applyLightRig(30); applyFog(scene, activePalette, 60); }
  }
}

// ── Dev-only asset showcase (consumed by src/ui/props-gallery.ts — never by the app UI) ───────
// Builds each prop and assembly EXACTLY as the app renders it — same builders, textures, tiling,
// jitter, and outline treatment — so the /props.html gallery shows the real material detail
// (stacked bag courses, plywood grain/knots and layered cut edges, wire on pickets, plank decks)
// instead of bare untextured geometry. Returns each item's label + plot center for captions.
export interface ShowcaseItem {
  label: string;
  x: number;
}
export function buildPropShowcase(group: THREE.Group): ShowcaseItem[] {
  const items: ShowcaseItem[] = [];
  const spacing = 7;
  let i = 0;
  const plot = (label: string): number => {
    const x = (i++ - 3.5) * spacing;
    items.push({ label, x });
    return x;
  };

  let x = plot('sandbag');
  buildSandbagWall(group, x, 0.19, 0, 1.3, 0.38, 0.9, ROLE_COLOR.parapet);

  x = plot('sandbag wall');
  buildSandbagWall(group, x, 0.75, 0, 4, 1.5, 1.2, ROLE_COLOR.parapet);

  for (const size of ['2x4', '2x6', '4x4'] as const) {
    x = plot(`${size} x 8 ft`);
    const board = lumberPiece(group, size, 8);
    board.rotation.y = 0.9;
    board.position.set(x, 0.35, 0);
  }

  x = plot('plank deck (2x6)');
  buildPlankDeck(group, x, 0.5, 0, 4, 1.0, 3, ROLE_COLOR.platform);

  x = plot('pickets & wire');
  buildPicketWall(group, x, 1.6, 0, 4, 3.2, 0.3, 2);

  x = plot('plywood revetment');
  buildPlywoodWall(group, x, 1.6, 0, 8, 3.2, 0.5, 2, -1); // sheets face the camera (+z)

  return items;
}

// Lets the gallery rebuild when the async GLB templates resolve (same hook the app viewers use).
export function onPropAssetsReady(cb: () => void): () => void {
  rerenderCallbacks.add(cb);
  return () => rerenderCallbacks.delete(cb);
}

export { disposeObject, toonGradient, lumberPiece, plywoodSheet };
