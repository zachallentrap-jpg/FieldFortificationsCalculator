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

// ── Masonry-bond layout (§ real sandbag construction) ────────────────────────
// bagWallLayout above tiles a naive 3-axis lattice: every course identical, all vertical
// joints aligned, every bag pointing the same way — the one stacking pattern doctrine
// explicitly forbids (an unbonded stack shears under blast). bagWallBond lays courses the
// way FM 5-103 does:
//   - RUNNING BOND: odd courses shift half a bag along the run, and square their ends with
//     half-width bags (real crews half-fill the end bags), so no vertical joint continues
//     through two courses.
//   - HEADER/STRETCHER ALTERNATION: where the wall is thick enough to fit a bag lengthwise
//     ACROSS it (parapets), odd courses turn 90° — headers bind the layers together. Thin
//     walls (revetment facing) stay all-stretcher with the running-bond stagger only.
// Output is a flat list of per-bag cells in WALL-LOCAL offsets from the wall's center
// (dx along the run, dy up from the wall base, dz across the thickness) so the consumer
// only places and jitters — the bond logic stays here, pure and node-tested.

export interface BagCell {
  dx: number; // center offset along the wall run, from wall center
  dy: number; // BASE of the bag above the wall's bottom face
  dz: number; // center offset across the wall thickness, from wall center
  w: number; // cell size along the run
  h: number; // course height
  d: number; // cell size across the thickness
  header: boolean; // true ⇒ bag is turned 90° (its authored length runs across the wall)
}

export function bagWallBond(w: number, h: number, d: number, bag: BagDims = doctrineBagDims()): BagCell[] {
  const W = span(w);
  const H = span(h);
  const D = span(d);
  const rows = count(H, bag.H);
  const cellH = H / rows;
  // A header course only fits when the wall is deep enough to take a bag lengthwise across
  // it — otherwise the turned bags would overhang the faces.
  const canHeader = D >= bag.L * 0.95;
  const cells: BagCell[] = [];

  for (let r = 0; r < rows; r++) {
    const header = canHeader && r % 2 === 1;
    // Stretcher courses: bag length along the run, width across. Header courses: swapped.
    const alongBag = header ? bag.W : bag.L;
    const acrossBag = header ? bag.L : bag.W;
    const cols = count(W, alongBag);
    const layers = count(D, acrossBag);
    const cellW = W / cols;
    const cellD = D / layers;
    const stagger = r % 2 === 1;
    const dy = r * cellH;

    for (let l = 0; l < layers; l++) {
      const dz = -D / 2 + (l + 0.5) * cellD;
      if (!stagger || header) {
        // Headers already break the stretcher courses' joints by construction — they lay on
        // their own grid, no extra stagger needed (and staggering a header course would push
        // the turned bags past the wall ends).
        for (let c = 0; c < cols; c++) {
          cells.push({ dx: -W / 2 + (c + 0.5) * cellW, dy, dz, w: cellW, h: cellH, d: cellD, header });
        }
      } else {
        // Running bond: shift the whole course half a cell and square both ends with
        // half-width bags. cols-1 full cells sit between them, so the span is exact.
        cells.push({ dx: -W / 2 + cellW / 4, dy, dz, w: cellW / 2, h: cellH, d: cellD, header });
        for (let c = 0; c < cols - 1; c++) {
          cells.push({ dx: -W / 2 + cellW / 2 + (c + 0.5) * cellW, dy, dz, w: cellW, h: cellH, d: cellD, header });
        }
        cells.push({ dx: W / 2 - cellW / 4, dy, dz, w: cellW / 2, h: cellH, d: cellD, header });
      }
    }
  }
  return cells;
}
