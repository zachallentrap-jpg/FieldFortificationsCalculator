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
import { buildScene3D } from '../render3d/scene3d';
import type { Part3, BoxRole } from '../render3d/scene3d';
import { bagWallLayout } from '../render3d/propLayout';
import type { Result } from '../engine/types';
import sandbagGlbUrl from '../assets/models/sandbag.glb?url';
import picketGlbUrl from '../assets/models/picket.glb?url';
import lumber2x4GlbUrl from '../assets/models/lumber_2x4.glb?url';
import lumber2x6GlbUrl from '../assets/models/lumber_2x6.glb?url';
import lumber4x4GlbUrl from '../assets/models/lumber_4x4.glb?url';

// Textures created ONCE and reused across every update() (the toon gradient + the 3 material
// textures below) — tracked here so disposeObject() never destroys them. update() disposes the
// whole parts group every render; without this a shared texture would work once, then break on
// the very next input edit (its GPU resource destroyed while the JS object — and the cache
// variable holding it — still looked valid).
const sharedTextures = new Set<THREE.Texture>();

// Same story for geometry loaded from the Blender-authored GLB props (sandbag, picket, lumber) — one
// template geometry is loaded once and CLONED (never disposed) for every tiled instance across
// every re-render. See "Blender-authored props" below for the load/fallback lifecycle.
const sharedGeometries = new Set<THREE.BufferGeometry>();

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

// A cheap deterministic hash (NOT Math.random — every rebuild of the same doctrine inputs must
// look identical) used to jitter cloned prop instances so a tiled wall of one repeated asset
// doesn't read as an obviously stamped grid.
function hashJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// ── Cartoon toon-shading helpers ──────────────────────────────────────────────
let gradientMapCache: THREE.Texture | null = null;
function toonGradient(): THREE.Texture {
  if (gradientMapCache) return gradientMapCache;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  // 4 flat bands (dark → light) for a chunky cel-shaded look.
  ctx.fillStyle = '#6b6b6b'; ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = '#9c9c9c'; ctx.fillRect(1, 0, 1, 1);
  ctx.fillStyle = '#cfcfcf'; ctx.fillRect(2, 0, 1, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  gradientMapCache = tex;
  sharedTextures.add(tex);
  return tex;
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
  ctx.fillStyle = '#8a6a3c';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 220; i++) {
    const sx = (i * 37) % 64;
    const sy = (i * 53) % 64;
    ctx.fillStyle = i % 3 === 0 ? '#6e5330' : i % 3 === 1 ? '#a8875a' : '#7a5e34';
    ctx.fillRect(sx, sy, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
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

const ROLE_COLOR: Record<BoxRole, number> = {
  ground: 0x8ec06a,
  parapet: 0xd9b877,
  bayWall: 0x8a6a3c,
  bayFloor: 0x6e5330,
  cover: 0xb98a4b,
  engineeredCover: 0xff5a4d,
  stringer: 0x3a2c1a,
  platform: 0x4a3a22,
  firingStep: 0x4a3a22,
  sump: 0x241b12,
  camoNet: 0x4c7a3f,
  rampBerm: 0xcaa869,
};

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      // Never dispose a SHARED template geometry (the loaded sandbag/picket GLB props) — same
      // reasoning as shared textures just below: it's cloned into many instances across many
      // re-renders, and disposing the one underlying GPU buffer would break every future use.
      if (!(child.geometry && sharedGeometries.has(child.geometry as THREE.BufferGeometry))) {
        child.geometry?.dispose?.();
      }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        const map = m && 'map' in m ? (m as THREE.MeshBasicMaterial).map : null;
        // Never dispose a SHARED texture (the toon gradient, dirt/corrugated/timber) — those are
        // cached module-level and reused across every re-render; disposing one here would work
        // once, then leave every later use of that material broken.
        if (map && !sharedTextures.has(map)) map.dispose();
        m?.dispose?.();
      }
    }
  });
}

// A toon mesh + a slightly-larger black backface shell = a cheap, robust cartoon outline.
// Both live inside one returned Group so a caller positions/rotates ONE object and the outline
// can never drift from its mesh — positioning the mesh alone (leaving a sibling outline at its
// default transform) was the exact bug behind the vehicle-ramp render (see DECISIONS D20).
function addToonMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, colorHex: number, opts?: { opacity?: number; map?: THREE.Texture }): THREE.Group {
  const mat = new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradient() });
  if (opts?.opacity !== undefined) {
    mat.transparent = true;
    mat.opacity = opts.opacity;
  }
  if (opts?.map) mat.map = opts.map;
  const mesh = new THREE.Mesh(geometry, mat);
  const wrapper = new THREE.Group();
  if (!opts?.opacity) {
    const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x16130d, side: THREE.BackSide }));
    outline.scale.multiplyScalar(1.035);
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
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
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

// A simple, abstract "toy figure" — not a specific person, just a scale reference.
function buildFigure(group: THREE.Group, x: number, z: number, heightFt: number): void {
  const legH = heightFt * 0.46;
  const torsoH = heightFt * 0.34;
  const headR = heightFt * 0.09;
  const torsoR = heightFt * 0.12;
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(torsoR, torsoH, 4, 10),
    new THREE.MeshToonMaterial({ color: 0x3b6ea5, gradientMap: toonGradient() }),
  );
  torso.position.set(x, legH + torsoH / 2 + torsoR, z);
  const legs = new THREE.Mesh(
    new THREE.CapsuleGeometry(torsoR * 0.7, legH * 0.7, 4, 8),
    new THREE.MeshToonMaterial({ color: 0x2b2b2b, gradientMap: toonGradient() }),
  );
  legs.position.set(x, legH * 0.5 + torsoR * 0.7, z);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(headR, 12, 10),
    new THREE.MeshToonMaterial({ color: 0xe8b98a, gradientMap: toonGradient() }),
  );
  head.position.set(x, legH + torsoH + torsoR + headR * 0.9, z);
  group.add(legs, torso, head);
  const label = labelSprite('For scale (~5\'-10")');
  label.position.set(x, legH + torsoH + torsoR * 2 + headR * 2 + 0.6, z);
  group.add(label);
}

function buildArrow(group: THREE.Group, fromX: number, fromZ: number, toX: number, toZ: number, y: number): void {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const len = Math.max(0.5, Math.hypot(dx, dz));
  const dir = new THREE.Vector3(dx, 0, dz).normalize();
  const mid = new THREE.Vector3((fromX + toX) / 2, y, (fromZ + toZ) / 2);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len * 0.7, 10), new THREE.MeshToonMaterial({ color: 0xd23a1e, gradientMap: toonGradient() }));
  shaft.quaternion.copy(quat);
  shaft.rotateX(Math.PI / 2);
  shaft.position.copy(mid).addScaledVector(dir, -len * 0.15);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, len * 0.35, 12), new THREE.MeshToonMaterial({ color: 0xd23a1e, gradientMap: toonGradient() }));
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
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xd23a1e, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  group.add(mesh);
}

// A smooth annulus (circular parapet) — one extruded ring mesh, no segment seams.
function buildRing(group: THREE.Group, x: number, z: number, outerR: number, innerR: number, height: number, colorHex: number): void {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 32 });
  geo.rotateX(-Math.PI / 2); // extrude was along +Z; lay it flat so it extrudes along +Y (up)
  geo.translate(x, 0, z);
  addToonMesh(group, geo, colorHex);
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

// Parapet and overhead cover are ALWAYS sandbag construction per doctrine (§ engine/materials.ts
// bagsParapet/bagsCover) — this tiles small boxes across the footprint instead of one flat slab,
// so "if sandbags are used, it shows sandbags." One shared outline keeps the cartoon silhouette
// clean; the individual bags skip their own outline (outlining every tiny bag would look busy).
//
// Each tile is the Blender-authored sandbag prop (DECISIONS D28) once `sandbagGeometry` has
// loaded — a real sagging-pillow shape, not a cube — cloned and scaled to the tile cell with a
// small deterministic per-instance rotation/scale jitter so a repeated asset doesn't read as an
// obviously stamped grid. Falls back to a plain box (the pre-Blender look) until the GLB resolves.
function buildSandbagWall(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, colorHex: number): void {
  const outline = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.05, w), Math.max(0.05, h), Math.max(0.05, d)),
    new THREE.MeshBasicMaterial({ color: 0x16130d, side: THREE.BackSide }),
  );
  outline.scale.multiplyScalar(1.035);
  outline.position.set(x, y, z);
  group.add(outline);

  // Tile in ALL THREE axes from the pure layout (render3d/propLayout.ts): cells stay close to
  // the doctrine bag's laid proportions, so a 3-ft-thick parapet reads as several bags deep —
  // never one authored bag stretched 3 ft deep. The fallback box tiles the SAME cells, so the
  // wall's envelope is identical before and after the async GLB resolves.
  const { cols, rows, layers, cellW, cellH, cellD } = bagWallLayout(w, h, d);
  const mat = new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradient() });
  const bagGeo = sandbagGeometry ?? null;
  const fallbackGeo = bagGeo ? null : new THREE.BoxGeometry(Math.max(0.05, cellW - 0.04), Math.max(0.05, cellH - 0.04), Math.max(0.05, cellD - 0.02));
  for (let l = 0; l < layers; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = r * 97 + c * 13 + l * 29 + x + z;
        const bx = x - w / 2 + (c + 0.5) * cellW + (hashJitter(seed) - 0.5) * cellW * 0.06;
        const by = y - h / 2 + (r + 0.5) * cellH;
        const bz = z - d / 2 + (l + 0.5) * cellD;
        const mesh = new THREE.Mesh(bagGeo ?? fallbackGeo!, mat);
        let settle = 0;
        if (bagGeo) {
          const jitter = 0.92 + hashJitter(seed + 0.5) * 0.14;
          mesh.scale.set(Math.max(0.05, cellW * 0.94) * jitter, Math.max(0.05, cellH * 0.9) * jitter, Math.max(0.05, cellD * 0.92) * jitter);
          mesh.rotation.y = (hashJitter(seed + 0.25) - 0.5) * 0.35;
          mesh.rotation.z = (hashJitter(seed + 0.75) - 0.5) * 0.12;
          settle = cellH * 0.02; // settle slightly, like a real stacked course
        }
        mesh.position.set(bx, by - settle, bz);
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
    if (postGeo) {
      post.scale.set(postR * 2, h, postR * 2);
      post.rotation.y = hashJitter(i + x + z) * Math.PI * 2; // hewn posts have no "front", vary freely
    }
    post.position.set(alongX ? x + offset : x, y, alongX ? z : z + offset);
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

function buildPart(group: THREE.Group, part: Part3): void {
  switch (part.kind) {
    case 'box': {
      // Parapet + overhead cover are ALWAYS sandbag construction per doctrine — tiled regardless
      // of `finish`. A revetted excavation face gets its own distinct material; an unrevetted one
      // is bare (sloped, if part.taperAmount is set) or plain earth.
      if (part.role === 'parapet' || part.role === 'cover') {
        buildSandbagWall(group, part.x, part.y, part.z, part.w, part.h, part.d, ROLE_COLOR[part.role]);
      } else if (part.role === 'bayWall' && part.finish === 'sandbag') {
        buildSandbagWall(group, part.x, part.y, part.z, part.w, part.h, part.d, ROLE_COLOR.bayWall);
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
        if (part.role === 'bayWall' && part.taperAmount) {
          taperOuterFace(geometry, part.taperAxis ?? 2, part.taperSign ?? 1, part.taperAmount);
        }
        let map: THREE.Texture | undefined;
        if (part.role === 'bayWall' && part.finish === 'corrugated') map = corrugatedTexture();
        else if (part.role === 'ground' || part.role === 'bayFloor' || part.role === 'rampBerm' || (part.role === 'bayWall' && part.finish === 'earth')) map = dirtTexture();
        const opts = part.role === 'camoNet' ? { opacity: 0.4 } : map ? { map } : undefined;
        const wrapper = addToonMesh(group, geometry, ROLE_COLOR[part.role], opts);
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
      const wrapper = addToonMesh(group, geometry, ROLE_COLOR[part.role], map ? { map } : undefined);
      wrapper.position.set(part.x, part.y, part.z);
      if (part.label) {
        const label = labelSprite(part.label);
        label.position.set(part.x, part.y + part.height / 2 + 0.5, part.z);
        group.add(label);
      }
      break;
    }
    case 'ring':
      buildRing(group, part.x, part.z, part.outerR, part.innerR, part.height, ROLE_COLOR[part.role]);
      break;
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
  canvas.style.touchAction = 'none'; // let OrbitControls own touch gestures (drag/pinch)

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

  const hemi = new THREE.HemisphereLight(0xffffff, 0x4a3a22, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(12, 20, 8);
  // A flat ambient floor so faces turned away from the sun read as a shaded cartoon tone,
  // never a near-black "broken looking" patch (a toon material with only 4 gradient bands
  // can otherwise go very dark on unlit faces).
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(hemi, sun, ambient);

  const partsGroup = new THREE.Group();
  scene.add(partsGroup);
  // Dev-only inspection handle (stripped from prod builds): lets tooling/tests query and frame
  // the live scene without threading debug APIs through the app.
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__sap3d = { scene, partsGroup, camera: () => camera, controls: () => controls };

  let framed = false;
  let currentContainer: HTMLElement | null = null;
  let ro: ResizeObserver | null = null;
  let raf = 0;
  let lastResult: Result | null = null;
  let lastOpts: ViewOpts = {};

  // Apply the cutaway clip to every material in the parts group (called after each rebuild).
  function applyCutaway(on: boolean): void {
    const planes = on ? [cutPlane] : [];
    partsGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) if (m) m.clippingPlanes = planes;
      }
    });
  }

  function setSky(theme: 'day' | 'night'): void {
    const top = theme === 'night' ? 0x1a1410 : 0xbfe3ff;
    const bottom = theme === 'night' ? 0x0a0605 : 0xf4f2ec;
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
    grad.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 64);
    const tex = new THREE.CanvasTexture(c);
    scene.background = tex;
    hemi.intensity = theme === 'night' ? 0.6 : 1.1;
    sun.intensity = theme === 'night' ? 0.5 : 1.0;
  }
  setSky('day');

  function loop(): void {
    raf = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  function doResize(): void {
    const el = currentContainer;
    if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight || w * 0.72);
    renderer.setSize(w, h, false);
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
      lastResult = result;
      lastOpts = opts;
      disposeObject(partsGroup);
      partsGroup.clear();
      const model = buildScene3D(result, { stage: opts.stage, cutaway: opts.cutaway });
      for (const part of model.parts) buildPart(partsGroup, part);
      applyCutaway(model.cutaway);

      if (!framed) {
        framed = true;
        const size = model.bounds.size;
        camera.position.set(size * 0.55, size * 0.5, size * 0.7);
        controls.target.set(0, -size * 0.08, 0);
        controls.update();
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
      disposeObject(partsGroup);
      disposeObject(scene);
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

  function setTheme(theme: 'day' | 'night'): void {
    setSky(theme);
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

export { disposeObject, toonGradient };
