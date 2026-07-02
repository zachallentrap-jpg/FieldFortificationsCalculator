// Pure tiling layout for sandbag-wall props (3D honesty, DECISIONS D28). Given a wall's
// envelope and the doctrine bag size, produce a 3-axis grid (bags per course × courses ×
// layers deep) whose cells stay close to the bag's real laid proportions — the renderer
// scales ONE authored prop to the cell, so a 3-ft-thick parapet reads as several bags deep,
// never one bag stretched 3 ft deep.
//
// Node-tested invariants: cells never collapse or go non-finite, cell proportions track the
// bag's proportions as the wall grows, and the layout depends ONLY on wall + bag dimensions —
// NOT on whether the Blender GLB has finished loading. The procedural fallback box tiles the
// exact same cells, so an async asset load can never change the model's overall envelope.

import { sandbag } from '../doctrine/materials';

export interface BagDims {
  L: number; // laid length (along the wall)
  H: number; // laid thickness (course height)
  W: number; // laid width (into the wall)
}

export interface BagWallLayout {
  cols: number;
  rows: number;
  layers: number;
  cellW: number;
  cellH: number;
  cellD: number;
}

// The doctrine bag (Provenance-wrapped placeholder until a real fill) — read live so a
// doctrine import changes the 3D bags with everything else.
export function doctrineBagDims(): BagDims {
  return { L: sandbag.L.value, H: sandbag.H.value, W: sandbag.W.value };
}

const MIN_SPAN = 0.05; // floor for degenerate walls — matches the renderer's minimum box

function span(v: number): number {
  return Number.isFinite(v) && v > MIN_SPAN ? v : MIN_SPAN;
}

function count(wallSpan: number, bagSpan: number): number {
  const b = Number.isFinite(bagSpan) && bagSpan > MIN_SPAN ? bagSpan : MIN_SPAN;
  return Math.max(1, Math.round(wallSpan / b));
}

export function bagWallLayout(w: number, h: number, d: number, bag: BagDims = doctrineBagDims()): BagWallLayout {
  const W = span(w);
  const H = span(h);
  const D = span(d);
  const cols = count(W, bag.L);
  const rows = count(H, bag.H);
  const layers = count(D, bag.W);
  return { cols, rows, layers, cellW: W / cols, cellH: H / rows, cellD: D / layers };
}
