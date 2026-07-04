// Thin-crust earth slab + per-hole excavation shells (diorama engine). The ground is a CRUST —
// under a foot of solid soil with grass on top and the soil type showing on every cut edge —
// NOT a solid block extruded past the deepest hole (the first engine build did that, and every
// excavation read as a shaft into an opaque cube instead of a hole with a shape). Each hole
// continues BELOW the crust as its own earthen shell: a strata-textured tube one shovel-width
// thick hugging the hole's contour, closed by a floor slab, so the dug volume is visible from
// outside the diorama — the classic cross-section-illustration read.
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

// The hole's contour pushed OUTWARD by t — the under-shell's outer skin. Rect/circle offset
// exactly; poly holes (the T/L unions from scene3d) are rectilinear with alternating
// axis-parallel edges, so the offset is the classic shifted-edge intersection: every edge
// slides t along its outward normal and consecutive (perpendicular) edges re-intersect at
// one coordinate each. Returns null only for a non-rectilinear poly — no such producer
// exists today, and the caller just skips that shell rather than guessing.
function offsetContour(h: TerrainHole, t: number): THREE.Vector2[] | null {
  if (h.kind === 'rect') return roundedRectPts(h.x, h.z, h.w + 2 * t, h.d + 2 * t, 0.2 + t);
  if (h.kind === 'circle') return circlePts(h.x, h.z, h.r + t);
  const pts = h.pts.map(([x, z]) => new THREE.Vector2(x, z));
  if (pts.length < 4) return null;
  // Signed area sign → winding; outward normal of a directed edge is its right side for CCW
  // (positive-area) loops in this x/z plan basis, left side for CW.
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area2 += a.x * b.y - b.x * a.y;
  }
  const outSign = area2 > 0 ? 1 : -1;
  // Shift each edge's fixed coordinate outward; each vertex then takes its x from whichever
  // adjacent edge is vertical and its z from the horizontal one.
  const shifted: Array<{ vertical: boolean; c: number }> = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const vertical = Math.abs(dx) < 1e-6;
    if (!vertical && Math.abs(dz) > 1e-6) return null; // diagonal edge — not rectilinear
    // Right-of-direction normal: (dz, -dx) normalized ⇒ for a vertical edge (0,dz) it's
    // (dz,0); for a horizontal edge (dx,0) it's (0,-dx).
    shifted.push(
      vertical
        ? { vertical, c: a.x + outSign * Math.sign(dz) * t }
        : { vertical, c: a.y - outSign * Math.sign(dx) * t },
    );
  }
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = shifted[(i + pts.length - 1) % pts.length]!;
    const cur = shifted[i]!;
    if (prev.vertical === cur.vertical) return null; // rectilinear loops must alternate V/H
    out.push(prev.vertical ? new THREE.Vector2(prev.c, cur.c) : new THREE.Vector2(cur.c, prev.c));
  }
  return out;
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

// Crust thickness: the solid surface layer the user actually sees soil in. Real topsoil-over-
// subsoil reads at 6-12 inches; 0.8 ft sits in that band and gives the strata texture room for
// one band line on the cut edge.
const CRUST_FT = 0.8;
// Under-shell wall thickness — one shovel-width of earth around the dug volume.
const SHELL_FT = 0.6;
// Vertical feet per strata-texture repeat, shared by the crust edge and every shell face so
// the bands run continuously across the crust→shell seam.
const STRATA_BAND_FT = 3;

// Strata-face UV convention (crust sides + shells): u drifts with x+z so parallel faces don't
// tile in lockstep; v maps world y in FEET (texture repeats every STRATA_BAND_FT).
function strataUv(uv: THREE.BufferAttribute, i: number, x: number, y: number, z: number): void {
  uv.setXY(i, (x + z) * 0.12, -y / STRATA_BAND_FT);
}

export function buildTerrain(spec: TerrainSpec, p: Palette, opts: { scatter: boolean }): TerrainBuild {
  const group = new THREE.Group();
  const o = spec.outer;
  const perSceneGeos: THREE.BufferGeometry[] = [];

  // Winding contract: outer CCW, every hole CW (opposite), enforced via isClockWise — see the
  // contour-helper header for why extrude can't be trusted to fix this itself.
  const shape = new THREE.Shape(oriented(roundedRectPts(o.x, o.z, o.w, o.d, 0.6), false));
  for (const h of spec.holes) {
    shape.holes.push(new THREE.Path(oriented(holeContour(h), true)));
  }

  // curveSegments is inert for these pre-sampled straight-segment contours; kept at the spec'd
  // value in case a future contour ever carries real curves.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: CRUST_FT, bevelEnabled: false, curveSegments: 24 });
  perSceneGeos.push(geo);

  // rotateX(π/2) sends local (x, y, z) → world (x, −z, y): the z=0 cap (normal −z) becomes the
  // TOP cap at y=0 facing +y, the extrusion runs DOWN to y=−CRUST_FT, and shape.y — authored
  // as plan z above — lands on world z unchanged. So +z(plan) = +z(world) and the enemy stays
  // at −z, matching the canvas orientation documented in textures.ts.
  geo.rotateX(Math.PI / 2);

  // ExtrudeGeometry emits non-indexed triangles in two groups (0 = both caps, 1 = every side
  // wall: the outer skirt AND the hole interiors). Rewrite UVs per GROUP, not by y alone — the
  // side walls' TOP vertices also sit at y=0, and handing those the grass mapping would smear a
  // grass/strata blend down the whole first course of every cut face. The BOTTOM cap is split
  // out of group 0 into a third material slot: with a thin crust its underside is visible from
  // plenty of angles between the crust and the shells, and grass down there reads as a bug —
  // it renders strata instead (soil under the turf, exactly the story the crust is telling).
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const minX = o.x - o.w / 2;
  const maxZ = o.z + o.d / 2;
  const capsGroup = geo.groups.find((g) => g.materialIndex === 0);
  if (capsGroup) {
    // Both caps live in one contiguous group, top cap's triangles first (all at y=0), bottom
    // cap's after (all at y=-CRUST_FT). Find the boundary by scanning y; if the caps ever
    // interleave (a future three.js change), the scan degrades to "no split" — grass underside,
    // the old accepted behavior — rather than mis-texturing the top.
    let split = capsGroup.start + capsGroup.count;
    for (let i = capsGroup.start; i < capsGroup.start + capsGroup.count; i++) {
      if (pos.getY(i) < -CRUST_FT / 2) { split = i; break; }
    }
    let clean = true;
    for (let i = split; i < capsGroup.start + capsGroup.count; i++) {
      if (pos.getY(i) > -CRUST_FT / 2) { clean = false; break; }
    }
    if (clean && split < capsGroup.start + capsGroup.count && split % 3 === 0) {
      const end = capsGroup.start + capsGroup.count;
      geo.clearGroups();
      geo.addGroup(capsGroup.start, split - capsGroup.start, 0); // top cap — grass
      geo.addGroup(split, end - split, 2); // bottom cap — strata
      geo.addGroup(end, pos.count - end, 1); // sides (group 1 always follows the caps)
    }
  }
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
        strataUv(uv, i, x, y, z);
      }
    }
  }
  uv.needsUpdate = true;

  const groundTex = groundTopTexture(spec, p);
  // DoubleSide on ALL terrain materials: the cutaway clips these open, and a single-sided
  // shell reads as a paper-thin sheet over a void — with interior faces rendered, the section
  // reads as solid (shadowed) earth.
  const capsMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: groundTex, gradientMap: toonGradient(), side: THREE.DoubleSide });
  const sidesMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: strataTexture(p), gradientMap: toonGradient(), side: THREE.DoubleSide });
  const earth = new THREE.Mesh(geo, [capsMat, sidesMat, sidesMat]);
  earth.receiveShadow = true;
  earth.castShadow = false;
  group.add(earth);

  // ── Excavation under-shells: the hole's shape, visible below the crust ──────────────────────
  // Each hole deeper than the crust continues down as a strata-skinned tube (outer contour =
  // hole offset one shovel-width out) closed by a floor slab — from outside, the dug volume
  // reads as a real shape descending under the turf instead of vanishing into a solid block.
  for (const h of spec.holes) {
    if (h.depth <= CRUST_FT + 0.05) continue;
    const outerPts = offsetContour(h, SHELL_FT);
    if (!outerPts) continue; // non-rectilinear poly (no producer today) — skip, never guess
    const tubeShape = new THREE.Shape(oriented(outerPts.map((v) => v.clone()), false));
    tubeShape.holes.push(new THREE.Path(oriented(holeContour(h), true)));
    const tubeGeo = new THREE.ExtrudeGeometry(tubeShape, { depth: h.depth - CRUST_FT, bevelEnabled: false, curveSegments: 24 });
    tubeGeo.rotateX(Math.PI / 2);
    tubeGeo.translate(0, -CRUST_FT, 0);
    // 0.7 ft thick: deep enough to swallow the grenade-sump cylinders that hang 0.6 ft below
    // the bay floor, so nothing pokes out of the plug's underside at low view angles.
    const floorShape = new THREE.Shape(oriented(outerPts.map((v) => v.clone()), false));
    const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.7, bevelEnabled: false, curveSegments: 24 });
    floorGeo.rotateX(Math.PI / 2);
    floorGeo.translate(0, -h.depth, 0);
    for (const sg of [tubeGeo, floorGeo]) {
      perSceneGeos.push(sg);
      const sPos = sg.getAttribute('position') as THREE.BufferAttribute;
      const sUv = sg.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < sPos.count; i++) {
        strataUv(sUv, i, sPos.getX(i), sPos.getY(i), sPos.getZ(i));
      }
      sUv.needsUpdate = true;
      const mesh = new THREE.Mesh(sg, sidesMat);
      mesh.receiveShadow = true;
      // castShadow stays OFF, same as the crust: a shadow-casting shell plunges its own
      // interior (and the treads/floor inside it) into pitch black — the toon look wants the
      // keylight reaching into excavations, exactly like the pre-crust solid block behaved.
      mesh.castShadow = false;
      group.add(mesh);
    }
  }

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

    // (1) grass tufts — crossed alpha-cutout cards. Density scales with the soil's look
    // (p.scatterMul): sand and rock grow far less grass than loam.
    const tuftWant = Math.min(140, Math.max(2, Math.round((area / 100) * 7 * p.scatterMul.tuft)));
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

    // (2) rocks — gravel/rock soils read stony (p.scatterMul.rock up to 3x).
    const rockWant = Math.min(60, Math.max(2, Math.round((area / 100) * 1.5 * p.scatterMul.rock)));
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
      // the crust + under-shell extrude geometries, and every material created above. Does NOT
      // own: the strata/blade textures, the toon gradient, or the instanced template geometries
      // — those live in the shared registries and survive rebuilds (material.dispose() never
      // touches maps, so the shared maps are safe here too). InstancedMesh.dispose() frees only
      // the per-instance matrix/color buffers.
      groundTex.dispose();
      for (const g of perSceneGeos) g.dispose();
      for (const m of perSceneMats) m.dispose();
      for (const m of instanced) m.dispose();
    },
  };
}
