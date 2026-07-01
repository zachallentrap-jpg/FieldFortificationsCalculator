// PURE layout resolver (§11). No DOM, no matchMedia, no side effects — the DOM layer
// feeds live environment values in and this decides the mode. Fully unit-tested against
// a width × pointer × orientation × override matrix; manual override always wins.

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

export interface LayoutEnv {
  width: number;
  pointerCoarse: boolean;
  landscape: boolean;
  override: 'auto' | LayoutMode;
}

export const BP = { tabletMin: 640, desktopMin: 1024 } as const;

export function resolveLayout(e: LayoutEnv): LayoutMode {
  if (e.override !== 'auto') return e.override;
  if (e.width >= BP.desktopMin && !e.pointerCoarse) return 'desktop';
  if (e.pointerCoarse && e.width < BP.tabletMin) return 'mobile';
  if (e.pointerCoarse) return 'tablet';
  return e.width >= BP.desktopMin ? 'desktop' : 'tablet';
}
