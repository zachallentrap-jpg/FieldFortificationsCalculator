// The only door between a fill and the engine (blueprint §4.2/§4.3). compute() passes
// the fill down; readers resolve leaves through here, so a leaf read always produces
// either a traced source node or a typed Unfilled — never a default, never undefined
// arithmetic. There is no ambient doctrine state to import (v1's module-load snapshot
// class has nothing to snapshot).

import type { NumericLeaf } from '../schema/leaf';
import { leafQ, unfilled, type Q } from './trace';

/** Minimal read surface of a fill: schema/fill.ts implements it; tests fake it. */
export interface FillView {
  /** Canonical-unit numeric value for a leaf id, or undefined when unfilled. */
  numeric(leafId: string): number | undefined;
  /** Owner-authored phrase for a check/body-unit leaf id, or undefined. */
  text(leafId: string): string | undefined;
  /** Doctrinal boolean for a flag leaf id, or undefined when unfilled. */
  flag(leafId: string): boolean | undefined;
}

/** The empty fill — TEMPLATE mode reads through the same door as a real fill. */
export const EMPTY_FILL: FillView = {
  numeric: () => undefined,
  text: () => undefined,
  flag: () => undefined,
};

export const resolve = <U extends NumericLeaf['unit']>(
  fill: FillView,
  leaf: NumericLeaf & { unit: U },
): Q<U> => {
  const v = fill.numeric(leaf.id);
  if (v === undefined) return unfilled([leaf.id]);
  return leafQ(leaf.id, `leaf.${leaf.id}`, leaf.unit, v);
};
