// Pure 3D scene descriptor (companion to render/geometry.ts). Turns a Result into a plain,
// framework-agnostic list of simple shapes in FEET — no Three.js import here, so this stays
// unit-testable with node:test and keeps the same "engine never touches the renderer" split
// as the 2D drawings. src/ui/three-viewer.ts is the only place that turns this into meshes.
//
// Axes (feet): x = left/right (frontage), z = front/back (negative z = front = enemy side,
// matching the plan view's "front is up" convention), y = vertical (positive = up, ground = 0).
//
// Every position SHAPE gets a distinct footprint (not one generic box) so "each design" reads
// differently in 3D: rect, inverted_t, l_shape, circular, vehicle_ramp, rect_roofed.

import type { GeometryModel } from '../engine/geometry';
import type { Result } from '../engine/types';

export interface Box3 {
  kind: 'box';
  x: number; y: number; z: number; // center, feet
  w: number; h: number; d: number; // size, feet
  role: BoxRole;
  label?: string;
}
export interface Cyl3 {
  kind: 'cyl';
  x: number; y: number; z: number; // center, feet
  radius: number; height: number;
  role: BoxRole;
  label?: string;
}
export interface Ring3 {
  kind: 'ring'; // a smooth annulus (circular parapet), extruded — used for round positions
  x: number; z: number;
  outerR: number; innerR: number; height: number;
  role: BoxRole;
}
export interface Wedge3 {
  kind: 'wedge'; // flat translucent sector-of-fire fan on the ground
  x: number; z: number;
  radius: number;
  leftDeg: number;
  rightDeg: number;
}
export interface Arrow3 {
  kind: 'arrow';
  fromX: number; fromZ: number; toX: number; toZ: number; y: number;
}
export interface Figure3 {
  kind: 'figure';
  x: number; z: number;
  heightFt: number;
}

export type BoxRole =
  | 'ground' | 'parapet' | 'bayWall' | 'bayFloor' | 'cover' | 'engineeredCover'
  | 'stringer' | 'platform' | 'firingStep' | 'sump' | 'camoNet' | 'rampBerm';

export type Part3 = Box3 | Cyl3 | Ring3 | Wedge3 | Arrow3 | Figure3;

export interface Scene3DModel {
  hasAnything: boolean;
  parts: Part3[];
  bounds: { size: number }; // rough footprint size (feet) for camera framing
  engineeredRoof: boolean; // true → show the hazard marker, never a fabricated cover
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function buildScene3D(result: Result): Scene3DModel {
  const geo = result.geometry as GeometryModel;
  if (!geo.hasAnything) {
    return { hasAnything: false, parts: [], bounds: { size: 20 }, engineeredRoof: false };
  }

  const p = geo.plan;
  const s = geo.section;
  const parts: Part3[] = [];
  const halfL = p.holeL / 2;
  const halfW = p.holeW / 2;
  const wallT = Math.max(0.3, p.parapetW * 0.35); // visual wall thickness for the excavation sides

  // ── Footprint by shape (§ each design gets a distinct silhouette) ────────────
  if (geo.shape === 'circular') {
    const rOuter = Math.max(p.outerL, p.outerW) / 2;
    const rHole = Math.max(halfL, halfW);
    parts.push({ kind: 'cyl', x: 0, y: 0, z: 0, radius: rOuter, height: 0.05, role: 'ground' });
    // A single smooth extruded annulus — no segment seams (a prior 8-box approximation left
    // visible outline clutter at every seam and read as a dark, broken-looking ring).
    parts.push({ kind: 'ring', x: 0, z: 0, outerR: rHole + p.parapetW, innerR: rHole, height: 1.2, role: 'parapet' });
    parts.push({ kind: 'cyl', x: 0, y: -s.depthOfCut / 2, z: 0, radius: rHole, height: s.depthOfCut, role: 'bayFloor' });
  } else if (geo.shape === 'vehicle_ramp') {
    const runLen = p.holeW;
    // Ground is centered on the RAMP's own z-center (not world origin) so its footprint always
    // fully contains the ramp regardless of length — a fixed-at-origin ground previously left
    // the deep end of a long ramp hanging past its edge with nothing rendered underneath.
    const rampZCenter = -runLen / 2;
    parts.push({ kind: 'box', x: 0, y: -0.02, z: rampZCenter, w: p.outerL + 4, h: 0.05, d: runLen + 6, role: 'ground' });
    // A ramp descending from grade to full depth, built as a stepped "staircase" of plain
    // boxes — the same proven box primitive every other part uses (a single continuously
    // sloped/rotated extrude turned out fragile: see DECISIONS D20). Cartoon-appropriate too.
    //
    // A vehicle-defilade cut is doctrinally SHALLOW relative to how WIDE it is (a few feet of
    // depth across a footprint tens of feet wide) — rendered at true scale under a camera framed
    // to fit that width, the relief all but disappears. RELIEF_EXAGGERATION is a display-only
    // convention (the same idea as vertical exaggeration on a terrain-relief model): it multiplies
    // the STAIRCASE'S visual depth only, purely inside this 3D descriptor. It never touches
    // depthOfCut itself, so every real number (BOM, labor, the 2D plan/section) is unaffected —
    // this view alone is allowed to be honest about shape at the cost of being literal about scale.
    const RELIEF_EXAGGERATION = 3;
    const depthEx = s.depthOfCut * RELIEF_EXAGGERATION;
    const steps = 6;
    const stepLen = runLen / steps;
    const base = -(depthEx + 1); // shared floor so consecutive treads never gap
    for (let i = 0; i < steps; i++) {
      // i=0's top sits flush with grade (0); the LAST tread reaches the (exaggerated) full
      // depth — no gap at the entry, and the deepest point still reads clearly as a real cut.
      const topY = -(i / (steps - 1)) * depthEx;
      const zNear = -i * stepLen; // nearer the entry (grade)
      const zFar = -(i + 1) * stepLen; // nearer the parked end (full depth)
      parts.push({
        kind: 'box',
        x: 0,
        y: (topY + base) / 2,
        z: (zNear + zFar) / 2,
        w: p.holeL,
        h: topY - base,
        d: stepLen + 0.05, // tiny overlap so treads never show a hairline gap
        role: 'bayFloor',
      });
    }
    const bermH = Math.max(1, p.parapetW * 0.5) * RELIEF_EXAGGERATION;
    parts.push({ kind: 'box', x: -(halfL + p.parapetW / 2), y: bermH / 2, z: -runLen / 4, w: p.parapetW, h: bermH, d: runLen, role: 'rampBerm' });
    parts.push({ kind: 'box', x: halfL + p.parapetW / 2, y: bermH / 2, z: -runLen / 4, w: p.parapetW, h: bermH, d: runLen, role: 'rampBerm' });
  } else {
    // rect, rect_roofed, inverted_t, l_shape all start from a rectangular ring + bay.
    parts.push({ kind: 'box', x: 0, y: -0.02, z: 0, w: p.outerL + 4, h: 0.05, d: p.outerW + 4, role: 'ground' });
    pushRing(parts, 0, 0, p.holeL, p.holeW, p.parapetW, 1.1);
    pushBayBox(parts, 0, 0, p.holeL, p.holeW, s.depthOfCut, wallT);

    if (geo.shape === 'inverted_t') {
      // A narrower trench extends toward the rear from the bay's center (inverted-T).
      const stemW = Math.max(2, p.holeL * 0.3);
      const stemLen = p.holeW * 1.1;
      const stemZ = halfW + stemLen / 2;
      pushRing(parts, 0, stemZ, stemW, stemLen, p.parapetW * 0.7, 1.0);
      pushBayBox(parts, 0, stemZ, stemW, stemLen, s.depthOfCut * 0.85, wallT * 0.8);
    } else if (geo.shape === 'l_shape') {
      // A perpendicular arm attached at one end (crew/ammo alcove) forming an L.
      const armW = p.holeW * 0.9;
      const armLen = Math.max(2.5, p.holeL * 0.6);
      const armX = halfL + armLen / 2;
      const armZ = halfW - armW / 2;
      pushRing(parts, armX, armZ, armLen, armW, p.parapetW * 0.7, 1.0);
      pushBayBox(parts, armX, armZ, armLen, armW, s.depthOfCut * 0.85, wallT * 0.8);
    }
  }

  // ── Overhead cover — earth slab, OR the honest engineered hazard marker (§2.7) ──
  const earthRoof = s.coverOn && s.roofPath === 'earth_on_stringers';
  const engineeredRoof = s.roofPath === 'engineered_required';
  if (earthRoof && geo.shape !== 'vehicle_ramp') {
    const coverY = p.parapetW * 0 + s.coverT / 2 + 0.15;
    parts.push({ kind: 'box', x: 0, y: coverY, z: 0, w: p.holeL + 2, h: s.coverT, d: p.holeW + 2, role: 'cover', label: 'Roof cover' });
    const n = Math.max(1, Math.min(s.stringers, 8));
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0.5 : i / (n - 1);
      const sx = -halfL - 1 + frac * (p.holeL + 2);
      parts.push({ kind: 'box', x: sx, y: coverY - s.coverT / 2 - 0.15, z: 0, w: 0.35, h: 0.3, d: p.holeW + 2, role: 'stringer' });
    }
  } else if (engineeredRoof && geo.shape !== 'vehicle_ramp') {
    parts.push({ kind: 'box', x: 0, y: 1.4, z: 0, w: p.holeL + 1.5, h: 0.2, d: p.holeW + 1.5, role: 'engineeredCover', label: 'Engineered roof — see engineer' });
  }

  // ── Firing platform / firing step ─────────────────────────────────────────
  if (p.platform) {
    parts.push({ kind: 'box', x: 0, y: -s.depthOfCut + s.platformDepth / 2, z: -halfW + p.platform.W / 2, w: p.platform.L, h: s.platformDepth, d: p.platform.W, role: 'platform', label: 'Standing platform' });
  } else if (s.firingStepOn) {
    const ledgeH = Math.min(0.8, s.depthOfCut * 0.25);
    parts.push({ kind: 'box', x: 0, y: -ledgeH / 2, z: -halfW + 0.4, w: Math.min(p.holeL * 0.6, p.holeL - 0.5), h: ledgeH, d: 0.8, role: 'firingStep', label: 'Step up' });
  }

  // ── Sumps (grenade catch pits) ────────────────────────────────────────────
  for (const sump of p.sumps) {
    parts.push({ kind: 'cyl', x: sump.xFt, y: -s.depthOfCut - 0.3, z: sump.yFt, radius: 0.4, height: 0.6, role: 'sump', label: 'Grenade sump' });
  }

  // ── Camouflage net (translucent plane above the position) ────────────────
  if (result.inputs.camouflage) {
    parts.push({ kind: 'box', x: 0, y: 1.8, z: 0, w: p.outerL * 1.1, h: 0.05, d: p.outerW * 1.1, role: 'camoNet', label: 'Camouflage' });
  }

  // ── Orientation: enemy arrow + sectors of fire ────────────────────────────
  const frontZ = -(halfW + p.parapetW + (geo.shape === 'vehicle_ramp' ? p.holeW / 2 : 0));
  parts.push({ kind: 'arrow', fromX: 0, fromZ: frontZ + 1.5, toX: 0, toZ: frontZ - 2.5, y: 0.4 });
  if (p.sectors.present) {
    parts.push({ kind: 'wedge', x: 0, z: frontZ, radius: Math.max(6, p.outerW), leftDeg: p.sectors.leftDeg, rightDeg: p.sectors.rightDeg });
  }

  // ── Standing figure for scale ──────────────────────────────────────────────
  parts.push({ kind: 'figure', x: halfL + 2, z: 1.5, heightFt: 5.83 });

  const boundsSize = finite(Math.max(p.outerL, p.outerW, s.depthOfCut * 2) + 8);
  return { hasAnything: true, parts, bounds: { size: boundsSize }, engineeredRoof };
}

// A rectangular ring of 4 walls (front/rear/left/right) around a hole — used for the parapet.
function pushRing(parts: Part3[], cx: number, cz: number, l: number, w: number, thick: number, height: number): void {
  const hl = l / 2;
  const hw = w / 2;
  parts.push({ kind: 'box', x: cx, y: height / 2, z: cz - hw - thick / 2, w: l + 2 * thick, h: height, d: thick, role: 'parapet' }); // front
  parts.push({ kind: 'box', x: cx, y: height / 2, z: cz + hw + thick / 2, w: l + 2 * thick, h: height, d: thick, role: 'parapet' }); // rear
  parts.push({ kind: 'box', x: cx - hl - thick / 2, y: height / 2, z: cz, w: thick, h: height, d: w, role: 'parapet' }); // left
  parts.push({ kind: 'box', x: cx + hl + thick / 2, y: height / 2, z: cz, w: thick, h: height, d: w, role: 'parapet' }); // right
}

// The excavated bay: a floor + 4 thin walls so the depth reads clearly from any angle.
function pushBayBox(parts: Part3[], cx: number, cz: number, l: number, w: number, depth: number, wallT: number): void {
  parts.push({ kind: 'box', x: cx, y: -depth - 0.05, z: cz, w: l, h: 0.1, d: w, role: 'bayFloor' });
  const hl = l / 2;
  const hw = w / 2;
  const h = depth;
  parts.push({ kind: 'box', x: cx, y: -depth / 2, z: cz - hw + wallT / 2, w: l, h, d: wallT, role: 'bayWall' });
  parts.push({ kind: 'box', x: cx, y: -depth / 2, z: cz + hw - wallT / 2, w: l, h, d: wallT, role: 'bayWall' });
  parts.push({ kind: 'box', x: cx - hl + wallT / 2, y: -depth / 2, z: cz, w: wallT, h, d: w, role: 'bayWall' });
  parts.push({ kind: 'box', x: cx + hl - wallT / 2, y: -depth / 2, z: cz, w: wallT, h, d: w, role: 'bayWall' });
}
