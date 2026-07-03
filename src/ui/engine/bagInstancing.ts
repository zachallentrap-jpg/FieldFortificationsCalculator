// Instanced sandbag walls (§ engine). buildSandbagWall in three-viewer.ts spawns one Mesh per
// bag — a bunker scene is ~900 draw-call-bearing objects for what is ONE geometry in two or
// three colors. This batcher queues every wall's bags and emits a single InstancedMesh per
// distinct color: same tiling math, same deterministic jitter, two orders of magnitude fewer
// scene-graph nodes.
//
// Instancing also buys the painterly pass for free: instanceColor lets every bag carry its own
// value variation (a miniature painter never paints two bags the same), which per-mesh materials
// could only match by cloning a material per bag. The bottom course is darkened a step further —
// a baked contact-shadow line that reads as 80% of an AO pass at zero runtime cost.
//
// The tiling contract below REPLICATES buildSandbagWall exactly (same seed constants, same
// oversize/jitter/settle numbers) so swapping the builder for the batcher changes nothing about
// how a wall looks — only what it costs.

import * as THREE from 'three';
import { bagWallLayout } from '../../render3d/propLayout';
import { hashJitter, sharedGeometries, toonGradient } from './shared';

// Fallback while the sandbag GLB is still resolving: a plain box, tiled on the SAME cells so the
// wall envelope is identical before and after the async load. One unit box (base at y=0, matching
// the prop's base-origin convention) scaled per instance — cached at module scope and registered
// shared so disposeObject() never destroys it between re-renders.
let fallbackUnitBox: THREE.BoxGeometry | null = null;
function unitBox(): THREE.BoxGeometry {
  if (!fallbackUnitBox) {
    fallbackUnitBox = new THREE.BoxGeometry(1, 1, 1);
    fallbackUnitBox.translate(0, 0.5, 0);
    sharedGeometries.add(fallbackUnitBox);
  }
  return fallbackUnitBox;
}

interface BagInstance {
  matrix: THREE.Matrix4;
  tint: THREE.Color;
}

// Scratch objects for matrix composition — wall() runs per bag (hundreds per rebuild) and only
// the composed Matrix4 needs to outlive the call.
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export class SandbagBatcher {
  private readonly template: THREE.BufferGeometry | null;
  private readonly bagJitter: number;
  private readonly batches = new Map<number, BagInstance[]>();

  /**
   * @param template  The loaded sandbag GLB geometry (base-origin, unit bbox y 0..1) or null
   *                  before the async load resolves — null tiles the fallback box instead.
   * @param bagJitter Palette.bagJitter: per-bag value-variation half-range.
   */
  constructor(template: THREE.BufferGeometry | null, bagJitter: number) {
    this.template = template;
    this.bagJitter = bagJitter;
  }

  /** Queue one wall's bags; nothing hits the scene graph until flush(). */
  wall(x: number, y: number, z: number, w: number, h: number, d: number, colorHex: number): void {
    const { cols, rows, layers, cellW, cellH, cellD } = bagWallLayout(w, h, d);
    let batch = this.batches.get(colorHex);
    if (!batch) {
      batch = [];
      this.batches.set(colorHex, batch);
    }
    for (let l = 0; l < layers; l++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Seed constants match buildSandbagWall so a batched rebuild of the same inputs lands
          // every bag in the exact pose the per-mesh builder gave it.
          const seed = r * 97 + c * 13 + l * 29 + x + z;
          const bx = x - w / 2 + (c + 0.5) * cellW + (hashJitter(seed) - 0.5) * cellW * 0.06;
          const baseY = y - h / 2 + r * cellH; // the prop's origin is the bag's BASE
          const bz = z - d / 2 + (l + 0.5) * cellD;
          if (this.template) {
            // Oversized vs the cell so neighbors press together (no daylight between bags),
            // with a small deterministic scale/rotation jitter and a settle drop per course.
            const jitter = 0.97 + hashJitter(seed + 0.5) * 0.1;
            _scale.set(
              Math.max(0.05, cellW * 1.08) * jitter,
              Math.max(0.05, cellH * 1.05) * jitter,
              Math.max(0.05, cellD * 1.1) * jitter,
            );
            _euler.set(0, (hashJitter(seed + 0.25) - 0.5) * 0.35, (hashJitter(seed + 0.75) - 0.5) * 0.12, 'XYZ');
            _quat.setFromEuler(_euler);
            _pos.set(bx, baseY - cellH * 0.03, bz);
          } else {
            // Fallback box: no rotation, no settle — the plain-box wall must keep the exact
            // pre-GLB envelope so the async load never shifts the model's silhouette.
            _scale.set(Math.max(0.05, cellW - 0.04), Math.max(0.05, cellH - 0.04), Math.max(0.05, cellD - 0.02));
            _quat.identity();
            _pos.set(bx, baseY, bz);
          }
          // Per-bag value variation around the role color, bottom course darkened into a baked
          // contact-shadow line. Shade can exceed 1 by design (bags brighter than the flat role
          // color) — instanceColor is a float buffer, nothing clips.
          let shade = 1 - this.bagJitter + hashJitter(seed + 0.33) * 2 * this.bagJitter;
          if (r === 0) shade *= 0.9;
          const tint = new THREE.Color(colorHex).multiplyScalar(shade);
          // compose() is the same T*R*S Object3D.updateMatrix uses, so poses match per-mesh bags.
          batch.push({ matrix: new THREE.Matrix4().compose(_pos, _quat, _scale), tint });
        }
      }
    }
  }

  /** Build one InstancedMesh per distinct color, add to parent, and reset the queues. */
  flush(parent: THREE.Group): void {
    if (this.batches.size === 0) return;
    const geo = this.template ?? unitBox();
    // White base color: the toon shading comes from the material, the actual bag color rides
    // entirely on instanceColor (white × tint = tint). One material serves every batch; the
    // viewer disposes it via disposeObject — safe, since the gradientMap is registry-shared.
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() });
    for (const [colorHex, batch] of this.batches) {
      const mesh = new THREE.InstancedMesh(geo, mat, batch.length);
      // The queued wall color identifies WHICH role this batch renders (parapet vs cover vs
      // bay wall — palettes keep them distinct) — the viewer maps it back to a construction
      // stage for the stage-scrubber rise animation.
      mesh.userData.colorHex = colorHex;
      // Poses never change after flush — tell the GPU so it can keep the buffer static.
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      let i = 0;
      for (const inst of batch) {
        mesh.setMatrixAt(i, inst.matrix);
        mesh.setColorAt(i, _color.copy(inst.tint));
        i++;
      }
      mesh.count = batch.length;
      if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Bags skip outline shells on purpose (see buildSandbagWall's rationale — outlining every
      // tiny bag reads as noise), so no shell pass here either.
      // Instance-aware bound up front, so frustum/shadow culling never tests the unit-bag sphere
      // against a wall that actually spans the whole parapet.
      mesh.computeBoundingSphere();
      parent.add(mesh);
    }
    this.batches.clear();
  }
}
