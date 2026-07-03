// Shared render-engine primitives (diorama engine). These used to live inside three-viewer.ts;
// they moved here so the engine modules (terrain, sky, instanced props, post pipeline) can use
// the SAME shared-resource registries — disposal correctness depends on every module checking
// one set, not per-module copies.

import * as THREE from 'three';

// Textures created ONCE and reused across every update() — tracked here so disposeObject()
// never destroys them. update() disposes the whole parts group every render; without this a
// shared texture would work once, then break on the very next input edit (its GPU resource
// destroyed while the JS object — and the cache variable holding it — still looked valid).
export const sharedTextures = new Set<THREE.Texture>();

// Same story for geometry loaded from the Blender-authored GLB props (sandbag, picket, lumber)
// and for engine-owned instanced template geometry — one template is created once and reused
// across every re-render.
export const sharedGeometries = new Set<THREE.BufferGeometry>();

// A cheap deterministic hash (NOT Math.random — every rebuild of the same doctrine inputs must
// look identical) used to jitter instances so a tiled repeated asset doesn't read as an
// obviously stamped grid.
export function hashJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

// ── Cartoon toon-shading gradient ──────────────────────────────────────────────
let gradientMapCache: THREE.Texture | null = null;
export function toonGradient(): THREE.Texture {
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

// Deep-dispose a subtree, skipping SHARED resources (template geometry, cached textures) —
// those are owned by the registries above and reused across re-renders.
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      // InstancedMesh carries its own per-instance GPU buffers (instanceMatrix/instanceColor)
      // separate from the geometry — without this they'd only free with GC, leaking across
      // every rebuild.
      if ((child as THREE.InstancedMesh).isInstancedMesh) (child as THREE.InstancedMesh).dispose();
      // Geometry disposal is for MESHES only: every THREE.Sprite shares ONE module-global quad
      // geometry (not in our registry) — disposing it per label-sprite would delete a live GPU
      // buffer the engine doesn't own and force three to re-upload it every rebuild.
      if (child instanceof THREE.Mesh && !(child.geometry && sharedGeometries.has(child.geometry as THREE.BufferGeometry))) {
        child.geometry?.dispose?.();
      }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        const map = m && 'map' in m ? (m as THREE.MeshBasicMaterial).map : null;
        if (map && !sharedTextures.has(map)) map.dispose();
        m?.dispose?.();
      }
    }
  });
}
