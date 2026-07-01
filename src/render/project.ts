// One transform per drawing (§10). makeProjector maps FEET coordinates to pixel coordinates
// with a single uniform scale (preserves aspect), centered in the viewport. Every element in
// a view uses the SAME projector, which is what kills drift and label pile-ups. All outputs
// are finite by construction; a degenerate (zero-size) bounds is clamped, never divided by 0.

export interface BoundsFt {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
  pad: number;
}

export interface Projector {
  toPx: (xFt: number, yFt: number) => [number, number];
  lenPx: (ft: number) => number;
  scale: number; // px per foot
}

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

export function makeProjector(bounds: BoundsFt, vp: Viewport): Projector {
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
  const availW = Math.max(1, vp.w - 2 * vp.pad);
  const availH = Math.max(1, vp.h - 2 * vp.pad);
  const scale = Math.min(availW / bw, availH / bh);
  const drawW = bw * scale;
  const drawH = bh * scale;
  const offX = vp.x + vp.pad + (availW - drawW) / 2;
  const offY = vp.y + vp.pad + (availH - drawH) / 2;

  return {
    toPx(xFt: number, yFt: number): [number, number] {
      return [safe(offX + (xFt - bounds.minX) * scale), safe(offY + (yFt - bounds.minY) * scale)];
    },
    lenPx(ft: number): number {
      return safe(ft * scale);
    },
    scale: safe(scale),
  };
}

// Convenience: expand a bounds to include padding in feet (e.g. room for dimension lines).
export function padBounds(b: BoundsFt, ft: number): BoundsFt {
  return { minX: b.minX - ft, minY: b.minY - ft, maxX: b.maxX + ft, maxY: b.maxY + ft };
}
