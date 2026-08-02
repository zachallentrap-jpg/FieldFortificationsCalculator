// Retained-DOM utilities (blueprint §4.5) — the ~200 lines that replace v1's
// innerHTML-the-whole-shell habit. The shell's DOM is STATIC; updates go through
// idempotent setters and a keyed list reconciler, so focus, scroll, canvas, and
// aria state survive every render. `swap` exists for INERT regions only and its
// invariant check runs in production (throw → failure latch), not dev-only.

export class DomGuardError extends Error {
  override readonly name = 'DomGuardError';
}

export const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string): T => {
  const el = root.querySelector(sel);
  if (!el) throw new DomGuardError(`missing shell element: ${sel}`);
  return el as T;
};

/** Idempotent text set — no-op when unchanged (no mutation events, no reflow). */
export const setText = (el: Element, s: string): void => {
  if (el.textContent !== s) el.textContent = s;
};

export const setAttr = (el: Element, name: string, value: string | null): void => {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value);
  }
};

export const setCls = (el: Element, cls: string, on: boolean): void => {
  el.classList.toggle(cls, on);
};

/** Form value set that NEVER stomps the field the user is typing in. */
export const setValue = (el: HTMLInputElement | HTMLSelectElement, v: string): void => {
  if (el.ownerDocument.activeElement === el) return;
  if (el.value !== v) el.value = v;
};

export interface ListSpec<T> {
  readonly key: (item: T) => string;
  readonly create: (item: T) => HTMLElement;
  readonly update: (el: HTMLElement, item: T) => void;
}

/** Keyed reconciler with MINIMAL moves: reuses nodes by key, updates in place, and
 *  moves only nodes outside the longest stable subsequence. Moving a DOM node blurs
 *  it (real browsers and happy-dom alike) — minimal moves means a focused row keeps
 *  focus through any reorder that doesn't inherently have to move it. */
export const list = <T>(container: HTMLElement, items: readonly T[], spec: ListSpec<T>): void => {
  const existing = new Map<string, HTMLElement>();
  const oldIndex = new Map<HTMLElement, number>();
  Array.from(container.children).forEach((child, i) => {
    const k = (child as HTMLElement).dataset['key'];
    if (k !== undefined) {
      existing.set(k, child as HTMLElement);
      oldIndex.set(child as HTMLElement, i);
    }
  });

  // Build the new node sequence (create/update as needed).
  const nodes: HTMLElement[] = items.map((item) => {
    const k = spec.key(item);
    const found = existing.get(k);
    if (found) {
      existing.delete(k);
      spec.update(found, item);
      return found;
    }
    const el = spec.create(item);
    el.dataset['key'] = k;
    return el;
  });
  for (const leftover of existing.values()) leftover.remove();

  // Longest increasing subsequence over reused nodes' OLD positions: those stay put.
  const seq = nodes.map((n) => oldIndex.get(n) ?? -1);
  const stable = new Set<number>();
  {
    const tails: number[] = []; // indices into nodes
    const prev = new Array<number>(nodes.length).fill(-1);
    for (let i = 0; i < nodes.length; i++) {
      if (seq[i] === -1) continue; // new node — always placed
      let lo = 0, hi = tails.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (seq[tails[mid]!]! < seq[i]!) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0) prev[i] = tails[lo - 1]!;
      tails[lo] = i;
    }
    let at = tails.length > 0 ? tails[tails.length - 1]! : -1;
    while (at !== -1) {
      stable.add(at);
      at = prev[at]!;
    }
  }

  // Place non-stable nodes right-to-left before their successor; stable nodes are
  // never touched, so focus inside them survives.
  let anchor: Element | null = null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const el = nodes[i]!;
    if (stable.has(i) && el.nextElementSibling === anchor) {
      anchor = el;
      continue;
    }
    if (stable.has(i)) {
      anchor = el; // stable but siblings shift around it — still untouched
      continue;
    }
    container.insertBefore(el, anchor);
    anchor = el;
  }
};

/** Guarded inert swap: full re-render of a region that must never hold focus, a
 *  canvas, or retained state. The check is a PRODUCTION check — violating it throws
 *  DomGuardError for the failure latch, because silently eating focus is the v1 bug
 *  class this whole module exists to kill. */
export const swap = (container: HTMLElement, html: string): void => {
  const active = container.ownerDocument.activeElement;
  if (active && container.contains(active) && active !== container.ownerDocument.body) {
    throw new DomGuardError('swap() would destroy the focused element');
  }
  if (container.querySelector('canvas')) {
    throw new DomGuardError('swap() region contains a canvas — canvases mount once and never reparent');
  }
  if (container.querySelector('[data-retain]')) {
    throw new DomGuardError('swap() region contains retained state ([data-retain])');
  }
  container.innerHTML = html;
};

/** One-microtask render coalescing — many state changes, one flush; no persistent
 *  rAF loop exists anywhere (v1's error-loop class). */
export const makeScheduler = (flush: () => void): (() => void) => {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      flush();
    });
  };
};

/** Per-region failure latch: a region that throws renders an error card and stops
 *  updating; the rest of the app keeps working; nothing loops. */
export const latched = (region: HTMLElement, name: string, render: () => void): (() => void) => {
  let dead = false;
  return () => {
    if (dead) return;
    try {
      render();
    } catch (e) {
      dead = true;
      region.innerHTML = '';
      const card = region.ownerDocument.createElement('div');
      card.className = 'error-card';
      card.setAttribute('role', 'alert');
      card.textContent = `The ${name} panel hit an error and stopped: ${(e as Error).message}. Everything else keeps working — reload to retry.`;
      region.appendChild(card);
    }
  };
};
