// One honest earth block with REAL holes cut through it (diorama engine). The old terrain was a
// picture-frame of flat green slabs around a single rectangle — compound T/L footprints ended up
// under solid ground bands. This module extrudes the actual footprint from the pure TerrainSpec:
// a rounded outer slab, every excavation cut out of it, grass painted on top and dark strata
// soil on every cut face. No outline shell on purpose — the dark soil side IS the base edge
// (museum-diorama look), where the old inflated shell read as a heavy black picture frame.
//
// Cutaway contract: materials are PLAIN MeshToonMaterial instances — no onBeforeCompile tricks —
// because the viewer assigns material.clippingPlanes after every rebuild and that must just work.

import * as THREE from 'three';
import type { TerrainSpec, TerrainHole } from '../../render3d/scene3d';
import type { Palette } from './palette';
import { sharedGeometries, hashJitter, toonGradient } from './shared';
import { groundTopTexture, strataTexture, bladeTexture } from './textures';

export interface TerrainBuild {
  group: THREE.Group;
  dispose(): void;
}

// ── contours (shape space = plan feet: shape.x = world x, shape.y = plan z) ────────────────────
// Arcs are PRE-SAMPLED to straight segments instead of leaning on ExtrudeGeometry's
// curveSegments: winding normalization needs the raw point loops (ShapeUtils.isClockWise works
// on points, not curves), and extrude's own winding fix-up only runs when the OUTER contour is
// wound "wrong" — holes wound the SAME way as an already-CW outer slip through and silently
// break the triangulation.

function dropClosingDup(pts: THREE.Vector2[]): THREE.Vector2[] {
  if (pts.length > 1 && pts[0]!.distanceTo(pts[pts.length - 1]!) < 1e-6) pts.pop();
  return pts;
}

function oriented(pts: THREE.Vector2[], clockwise: boolean): THREE.Vector2[] {
  if (THREE.ShapeUtils.isClockWise(pts) !== clockwise) pts.reverse();
  return pts;
}

function roundedRectPts(cx: number, cy: number, w: number, d: number, r: number): THREE.Vector2[] {
  const rr = Math.min(r, w / 2 - 0.01, d / 2 - 0.01);
  const hw = w / 2;
  const hd = d / 2;
  if (rr <= 0) {
    // Degenerate-thin rect — plain corners rather than arcs that would self-intersect.
    return [
      new THREE.Vector2(cx - hw, cy - hd), new THREE.Vector2(cx + hw, cy - hd),
      new THREE.Vector2(cx + hw, cy + hd), new THREE.Vector2(cx - hw, cy + hd),
    ];
  }
  const path = new THREE.Path();
  path.moveTo(cx - hw + rr, cy - hd);
  path.lineTo(cx + hw - rr, cy - hd);
  path.absarc(cx + hw - rr, cy - hd + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(cx + hw, cy + hd - rr);
  path.absarc(cx + hw - rr, cy + hd - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(cx - hw + rr, cy + hd);
  path.absarc(cx - hw + rr, cy + hd - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(cx - hw, cy - hd + rr);
  path.absarc(cx - hw + rr, cy - hd + rr, rr, Math.PI, Math.PI * 1.5, false);
  return dropClosingDup(path.getPoints(6));
}

function circlePts(cx: number, cy: number, r: number): THREE.Vector2[] {
  return dropClosingDup(new THREE.Path().absarc(cx, cy, r, 0, Math.PI * 2, false).getPoints(24));
}

function holeContour(h: TerrainHole): THREE.Vector2[] {
  if (h.kind === 'rect') return roundedRectPts(h.x, h.z, h.w, h.d, 0.2);
  if (h.kind === 'circle') return circlePts(h.x, h.z, h.r);
  return h.pts.map(([x, z]) => new THREE.Vector2(x, z));
}

// ── scatter helpers ────────────────────────────────────────────────────────────────────────────

interface Env { minX: number; maxX: number; minZ: number; maxZ: number }

// Bbox test only (per spec) — a tuft grazing a poly hole's bbox corner is a non-problem, while a
// true point-in-polygon distance test buys nothing visible.
function holeEnv(h: TerrainHole, pad: number): Env {
  if (h.kind === 'rect') {
    return { minX: h.x - h.w / 2 - pad, maxX: h.x + h.w / 2 + pad, minZ: h.z - h.d / 2 - pad, maxZ: h.z + h.d / 2 + pad };
  }
  if (h.kind === 'circle') {
    return { minX: h.x - h.r - pad, maxX: h.x + h.r + pad, minZ: h.z - h.r - pad, maxZ: h.z + h.r + pad };
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of h.pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

// Template geometries live in sharedGeometries: one template each, reused by every rebuild, and
// disposeObject/dispose() skip them by registry membership.

let tuftGeoCache: THREE.BufferGeometry | null = null;
function tuftGeometry(): THREE.BufferGeometry {
  if (tuftGeoCache) return tuftGeoCache;
  // Two crossed cards merged into ONE geometry by concatenating attributes — an InstancedMesh
  // draws exactly one geometry per instance, so the cross has to be baked in, not grouped.
  const a = new THREE.PlaneGeometry(0.5, 0.35);
  a.translate(0, 0.175, 0); // base at y=0 so instances sit ON the cap, not half-buried
  const b = a.clone().rotateY(Math.PI / 2);
  const merged = new THREE.BufferGeometry();
  const aPos = a.getAttribute('position') as THREE.BufferAttribute;
  for (const name of ['position', 'normal', 'uv'] as const) {
    const A = a.getAttribute(name) as THREE.BufferAttribute;
    const B = b.getAttribute(name) as THREE.BufferAttribute;
    const arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array, 0);
    arr.set(B.array, A.array.length);
    merged.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
  }
  // PlaneGeometry is always indexed; offset the second card's indices past the first's vertices.
  const ai = a.index!;
  const bi = b.index!;
  const idx = new Uint16Array(ai.count + bi.count);
  for (let i = 0; i < ai.count; i++) idx[i] = ai.getX(i);
  for (let i = 0; i < bi.count; i++) idx[ai.count + i] = bi.getX(i) + aPos.count;
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  a.dispose();
  b.dispose();
  sharedGeometries.add(merged);
  tuftGeoCache = merged;
  return merged;
}

let rockGeoCache: THREE.BufferGeometry | null = null;
function rockGeometry(): THREE.BufferGeometry {
  if (!rockGeoCache) {
    rockGeoCache = new THREE.IcosahedronGeometry(0.22, 0);
    sharedGeometries.add(rockGeoCache);
  }
  return rockGeoCache;
}

// ── the terrain build ──────────────────────────────────────────────────────────────────────────

export function buildTerrain(spec: TerrainSpec, p: Palette, opts: { scatter: boolean }): TerrainBuild {
  const group = new THREE.Group();
  const o = spec.outer;

  const maxHoleDepth = spec.holes.reduce((m, h) => Math.max(m, h.depth), 0);
  const blockDepth = Math.max(2.5, maxHoleDepth + 1.0);

  // Winding contract: outer CCW, every hole CW (opposite), enforced via isClockWise — see the
  // contour-helper header for why extrude can't be trusted to fix this itself.
  const shape = new THREE.Shape(oriented(roundedRectPts(o.x, o.z, o.w, o.d, 0.6), false));
  for (const h of spec.holes) {
    shape.holes.push(new THREE.Path(oriented(holeContour(h), true)));
  }

  // curveSegments is inert for these pre-sampled straight-segment contours; kept at the spec'd
  // value in case a future contour ever carries real curves.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: blockDepth, bevelEnabled: false, curveSegments: 24 });

  // rotateX(π/2) sends local (x, y, z) → world (x, −z, y): the z=0 cap (normal −z) becomes the
  // TOP cap at y=0 facing +y, the extrusion runs DOWN to y=−blockDepth, and shape.y — authored
  // as plan z above — lands on world z unchanged. So +z(plan) = +z(world) and the enemy stays
  // at −z, matching the canvas orientation documented in textures.ts.
  geo.rotateX(Math.PI / 2);

  // ExtrudeGeometry emits non-indexed triangles in two groups (0 = both caps, 1 = every side
  // wall: the outer skirt AND the hole interiors). Rewrite UVs per GROUP, not by y alone — the
  // side walls' TOP vertices also sit at y=0, and handing those the grass mapping would smear a
  // grass/strata blend down the whole first course of every cut face.
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const minX = o.x - o.w / 2;
  const maxZ = o.z + o.d / 2;
  for (const g of geo.groups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (g.materialIndex === 0 && y > -0.01) {
        // Top cap: the per-scene ground texture maps 1:1 onto spec.outer. v follows the
        // orientation contract in textures.ts (canvas top row = minZ = enemy side, flipY on).
        uv.setXY(i, (x - minX) / o.w, (maxZ - z) / o.d);
      } else {
        // Sides — and the bottom cap, which group 0 renders with the grass map (never seen from
        // any normal angle; accepted). u drifts with x+z so parallel faces don't tile in
        // lockstep; v spans the block height once so the strata bands run horizontally.
        uv.setXY(i, (x + z) * 0.12, -y / blockDepth);
      }
    }
  }
  uv.needsUpdate = true;

  const groundTex = groundTopTexture(spec, p);
  // DoubleSide on BOTH terrain materials: the cutaway clips this block open, and a single-sided
  // shell reads as a paper-thin sheet over a void — with interior faces rendered, the section
  // reads as solid (shadowed) earth. Cost is one extra fragment pass on a single big mesh.
  const capsMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: groundTex, gradientMap: toonGradient(), side: THREE.DoubleSide });
  const sidesMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: strataTexture(p), gradientMap: toonGradient(), side: THREE.DoubleSide });
  const earth = new THREE.Mesh(geo, [capsMat, sidesMat]);
  earth.receiveShadow = true;
  earth.castShadow = false;
  group.add(earth);

  const perSceneMats: THREE.Material[] = [capsMat, sidesMat];
  const instanced: THREE.InstancedMesh[] = [];

  if (opts.scatter) {
    const area = o.w * o.d;
    const envs = spec.holes.map((h) => holeEnv(h, 2.7));
    const clear = (x: number, z: number): boolean =>
      envs.every((e) => x < e.minX || x > e.maxX || z < e.minZ || z > e.maxZ);
    // Footprint-derived integer salt so two different positions don't share one recognizable
    // scatter pattern — still deterministic for identical inputs.
    const salt = Math.round(o.w * 17 + o.d * 31);

    // Rejection sampling with a hard attempt cap — a footprint that is nearly ALL hole envelope
    // must terminate with fewer instances, never spin forever.
    const scatterPoints = (want: number, saltOffset: number): Array<{ x: number; z: number; seed: number }> => {
      const out: Array<{ x: number; z: number; seed: number }> = [];
      const spanW = Math.max(0, o.w - 1.6); // inset 0.8 ft so nothing overhangs the slab edge
      const spanD = Math.max(0, o.d - 1.6);
      for (let a = 0; out.length < want && a < want * 10; a++) {
        const s = salt + saltOffset + a * 11;
        const x = o.x - o.w / 2 + 0.8 + hashJitter(s + 1) * spanW;
        const z = o.z - o.d / 2 + 0.8 + hashJitter(s + 2) * spanD;
        if (clear(x, z)) out.push({ x, z, seed: s });
      }
      return out;
    };

    const mtx = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const posV = new THREE.Vector3();
    const sclV = new THREE.Vector3();

    // (1) grass tufts — crossed alpha-cutout cards.
    const tuftWant = Math.min(140, Math.max(8, Math.round((area / 100) * 7)));
    const tufts = scatterPoints(tuftWant, 0);
    if (tufts.length > 0) {
      const mat = new THREE.MeshToonMaterial({
        map: bladeTexture(p),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        gradientMap: toonGradient(),
      });
      const mesh = new THREE.InstancedMesh(tuftGeometry(), mat, tufts.length);
      const cA = new THREE.Color(p.tuft[0]);
      const cB = new THREE.Color(p.tuft[1]);
      const c = new THREE.Color();
      tufts.forEach((t, i) => {
        eul.set(0, hashJitter(t.seed + 3) * Math.PI * 2, 0);
        const s = 0.7 + hashJitter(t.seed + 4) * 0.6;
        // Slightly sunk so card bottoms never float above the cap at shallow view angles.
        mtx.compose(posV.set(t.x, -0.02, t.z), quat.setFromEuler(eul), sclV.set(s, s, s));
        mesh.setMatrixAt(i, mtx);
        mesh.setColorAt(i, c.copy(cA).lerp(cB, hashJitter(t.seed + 5)));
      });
      mesh.castShadow = false; // alpha-cutout shadow maps sparkle; grass dapple isn't worth it
      mesh.receiveShadow = true;
      group.add(mesh);
      perSceneMats.push(mat);
      instanced.push(mesh);
    }

    // (2) rocks.
    const rockWant = Math.min(24, Math.max(2, Math.round((area / 100) * 1.5)));
    const rocks = scatterPoints(rockWant, 700001);
    if (rocks.length > 0) {
      const mat = new THREE.MeshToonMaterial({ color: p.rock, gradientMap: toonGradient() });
      const mesh = new THREE.InstancedMesh(rockGeometry(), mat, rocks.length);
      rocks.forEach((t, i) => {
        eul.set(
          (hashJitter(t.seed + 3) - 0.5) * 0.9,
          hashJitter(t.seed + 4) * Math.PI * 2,
          (hashJitter(t.seed + 5) - 0.5) * 0.9,
        );
        const s = 0.6 + hashJitter(t.seed + 6) * 1.0;
        // Sunk deeper than the tufts: a floating rock edge reads as a bug instantly.
        mtx.compose(posV.set(t.x, -0.05, t.z), quat.setFromEuler(eul), sclV.set(s, s, s));
        mesh.setMatrixAt(i, mtx);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      perSceneMats.push(mat);
      instanced.push(mesh);
    }
  }

  return {
    group,
    dispose(): void {
      // Owns: the per-scene ground canvas (NOT in sharedTextures — nothing else will free it),
      // the extrude geometry, and every material created above. Does NOT own: the strata/blade
      // textures, the toon gradient, or the instanced template geometries — those live in the
      // shared registries and survive rebuilds (material.dispose() never touches maps, so the
      // shared maps are safe here too). InstancedMesh.dispose() frees only the per-instance
      // matrix/color buffers.
      groundTex.dispose();
      geo.dispose();
      for (const m of perSceneMats) m.dispose();
      for (const m of instanced) m.dispose();
    },
  };
}
