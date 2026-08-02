// The traced-quantity algebra (blueprint §4.3). Every doctrinal number the engine
// touches lives inside an opaque Traced node; arithmetic goes through the ops here and
// nowhere else, so the explain trace cannot drift from the math (v1's hand-written
// explain strings, never again — §6.2). Unfilled propagates as a typed marker carrying
// the union of blocking leaf ids (INV-3): no default, no NaN, no partial sum
// presenting as a total.
//
// Opacity is contractual, enforced by lint (G-9), not by the runtime: the numeric
// value is absent from the public TraceNode type, and `unsafeValue` may be imported
// only by render/precision.ts and test files. Engine code that "just needs the
// number" is the bug class this kills.

import type { NumericUnit, Mul, Div } from '../schema/units';

export type TraceOp =
  | 'leaf'        // resolved doctrine leaf (deps: none; ref: leaf id)
  | 'input'       // user input (crew size, threat pick side-effects…)
  | 'structural'  // structure constant from the allowlist (ref: allowlist entry)
  | 'add' | 'sub' | 'mul' | 'div' | 'max' | 'min'
  | 'round';      // directional rounding (meta: direction + decimals)

// Public node: NO value field. Labels come from one table keyed by label id at render
// time — nodes carry the key, not prose, so traces cannot lie about labels (§4.3).
export interface TraceNode {
  readonly op: TraceOp;
  readonly labelKey: string;
  readonly unit: NumericUnit;
  readonly ref?: string; // leaf id / input name / allowlist ref / round spec
  readonly deps: readonly TraceNode[];
}

interface InternalNode extends TraceNode {
  readonly value: number;
}

export interface Traced<U extends NumericUnit = NumericUnit> {
  readonly kind: 'filled';
  readonly unit: U;
  readonly node: TraceNode;
}

export interface Unfilled {
  readonly kind: 'unfilled';
  /** Sorted, de-duplicated leaf ids blocking this quantity. */
  readonly blockedBy: readonly string[];
}

export type Q<U extends NumericUnit = NumericUnit> = Traced<U> | Unfilled;

export const isFilled = <U extends NumericUnit>(q: Q<U>): q is Traced<U> => q.kind === 'filled';
export const isUnfilled = (q: Q<NumericUnit>): q is Unfilled => q.kind === 'unfilled';

export class EngineInvariantError extends Error {
  override readonly name = 'EngineInvariantError';
}

const mergeBlockers = (...qs: readonly Q<NumericUnit>[]): readonly string[] => {
  const ids = new Set<string>();
  for (const q of qs) if (q.kind === 'unfilled') for (const id of q.blockedBy) ids.add(id);
  return Object.freeze([...ids].sort());
};

export const unfilled = (leafIds: readonly string[]): Unfilled =>
  Object.freeze({ kind: 'unfilled' as const, blockedBy: Object.freeze([...new Set(leafIds)].sort()) });

const mk = <U extends NumericUnit>(
  op: TraceOp, labelKey: string, unit: U, value: number,
  deps: readonly TraceNode[], ref?: string,
): Traced<U> => {
  if (!Number.isFinite(value)) {
    // The NaN gate (G-7) proves this unreachable from any input; reaching it is a
    // program defect, never a data state.
    throw new EngineInvariantError(`non-finite value at ${op}:${labelKey}`);
  }
  const node: InternalNode = Object.freeze({
    op, labelKey, unit, value, deps: Object.freeze([...deps]), ...(ref !== undefined ? { ref } : {}),
  });
  return Object.freeze({ kind: 'filled' as const, unit, node });
};

/** A resolved doctrine leaf becomes a source node. Callers pass the value they got
 *  from the fill via read.ts — nothing else may construct 'leaf' nodes. */
export const leafQ = <U extends NumericUnit>(leafId: string, labelKey: string, unit: U, value: number): Traced<U> =>
  mk('leaf', labelKey, unit, value, [], leafId);

/** User inputs (never doctrine): crew count, azimuths, toggles with numeric effect. */
export const inputQ = <U extends NumericUnit>(name: string, labelKey: string, unit: U, value: number): Traced<U> =>
  mk('input', labelKey, unit, value, [], name);

/** Structure constants (counts implied by shape, exact conversion factors). Every call
 *  site must name an allowlist entry (schema/allowlist.ts) — G-9 cross-checks. */
export const structuralQ = <U extends NumericUnit>(allowlistRef: string, labelKey: string, unit: U, value: number): Traced<U> =>
  mk('structural', labelKey, unit, value, [], allowlistRef);

type Bin = <U extends NumericUnit>(labelKey: string, a: Q<U>, b: Q<U>) => Q<U>;

const sameUnitOp = (op: 'add' | 'sub' | 'max' | 'min', f: (a: number, b: number) => number): Bin =>
  <U extends NumericUnit>(labelKey: string, a: Q<U>, b: Q<U>): Q<U> => {
    if (a.kind === 'unfilled' || b.kind === 'unfilled') return unfilled(mergeBlockers(a, b));
    return mk(op, labelKey, a.unit, f(val(a), val(b)), [a.node, b.node]);
  };

export const add = sameUnitOp('add', (x, y) => x + y);
export const sub = sameUnitOp('sub', (x, y) => x - y);
export const qmax = sameUnitOp('max', Math.max);
export const qmin = sameUnitOp('min', Math.min);

export const mul = <A extends NumericUnit, B extends NumericUnit>(
  labelKey: string, a: Q<A>, b: Q<B>, unit: Mul<A, B>,
): Q<Mul<A, B>> => {
  if (a.kind === 'unfilled' || b.kind === 'unfilled') return unfilled(mergeBlockers(a, b));
  return mk('mul', labelKey, unit, val(a) * val(b), [a.node, b.node]);
};

export const div = <A extends NumericUnit, B extends NumericUnit>(
  labelKey: string, a: Q<A>, b: Q<B>, unit: Div<A, B>,
): Q<Div<A, B>> => {
  if (a.kind === 'unfilled' || b.kind === 'unfilled') return unfilled(mergeBlockers(a, b));
  const d = val(b);
  if (d === 0) {
    // Divisor leaves refuse 0 at import (§2.6); computed divisors reaching 0 is a
    // program defect the fuzz gate (G-6) must prove unreachable.
    throw new EngineInvariantError(`division by zero at ${labelKey}`);
  }
  return mk('div', labelKey, unit, val(a) / d, [a.node, b.node]);
};

export type RoundDirection = 'up' | 'down' | 'nearest';

/** Directional rounding as a traced node — material counts round UP (doctrine's
 *  fail-safe direction), and the trace shows that it happened. */
export const roundQ = <U extends NumericUnit>(labelKey: string, q: Q<U>, direction: RoundDirection): Q<U> => {
  if (q.kind === 'unfilled') return q;
  const v = val(q);
  const rounded = direction === 'up' ? Math.ceil(v) : direction === 'down' ? Math.floor(v) : Math.round(v);
  return mk('round', labelKey, q.unit, rounded, [q.node], `round:${direction}`);
};

/** Fold a list with an op, unioning blockers when any element is unfilled. */
export const sum = <U extends NumericUnit>(labelKey: string, qs: readonly Q<U>[], unit: U): Q<U> => {
  if (qs.length === 0) return mk('add', labelKey, unit, 0, []);
  if (qs.some((q) => q.kind === 'unfilled')) return unfilled(mergeBlockers(...qs));
  const nodes = qs.map((q) => (q as Traced<U>).node);
  const total = nodes.reduce((acc, n) => acc + (n as InternalNode).value, 0);
  return mk('add', labelKey, unit, total, nodes);
};

const val = (t: Traced<NumericUnit>): number => (t.node as InternalNode).value;

// ---------------------------------------------------------------------------------
// Restricted extraction & verification. Lint (G-9) allows `unsafeValue` imports only
// from render/precision.ts and test/**; everything else must stay inside the algebra.
// ---------------------------------------------------------------------------------

/** Extract the numeric value. RESTRICTED — see module comment. */
export const unsafeValue = (t: Traced<NumericUnit>): number => (t.node as InternalNode).value;

/** Re-evaluate a node from its deps and compare with the stored value — the gate test
 *  walks every node of every Result trace with this (§4.3): a trace that cannot
 *  reproduce itself is a defect. Returns the recomputed value. */
export const reevaluate = (node: TraceNode): number => {
  const n = node as InternalNode;
  const dep = (i: number): number => {
    const d = node.deps[i];
    if (d === undefined) throw new EngineInvariantError(`missing dep ${i} at ${node.labelKey}`);
    return reevaluate(d);
  };
  switch (node.op) {
    case 'leaf': case 'input': case 'structural':
      return n.value;
    case 'add':
      return node.deps.reduce((acc, d) => acc + reevaluate(d), 0);
    case 'sub': return dep(0) - dep(1);
    case 'mul': return dep(0) * dep(1);
    case 'div': return dep(0) / dep(1);
    case 'max': return Math.max(dep(0), dep(1));
    case 'min': return Math.min(dep(0), dep(1));
    case 'round': {
      const dir = (node.ref ?? '').replace('round:', '') as RoundDirection;
      const v = dep(0);
      return dir === 'up' ? Math.ceil(v) : dir === 'down' ? Math.floor(v) : Math.round(v);
    }
  }
};
