// Undo/redo of input edits (§13). A bounded snapshot stack of Inputs. Pure data structure —
// the UI pushes a snapshot after an edit settles and calls undo/redo to swap inputs. Layout,
// theme, and scenario changes are deliberately NOT history events (they aren't input edits).

import type { Inputs } from '../engine/types';

const MAX = 100; // bounded stack — the 1 here is not a doctrinal magnitude

export function createHistory(initial: Inputs) {
  let past: Inputs[] = [];
  let present: Inputs = { ...initial };
  let future: Inputs[] = [];

  return {
    // Record a new state; clears the redo branch.
    push(next: Inputs): void {
      past.push(present);
      if (past.length > MAX) past = past.slice(past.length - MAX);
      present = { ...next };
      future = [];
    },
    undo(): Inputs | null {
      const prev = past.pop();
      if (prev === undefined) return null;
      future.unshift(present);
      present = prev;
      return { ...present };
    },
    redo(): Inputs | null {
      const next = future.shift();
      if (next === undefined) return null;
      past.push(present);
      present = next;
      return { ...present };
    },
    current(): Inputs {
      return { ...present };
    },
    canUndo(): boolean {
      return past.length > 0;
    },
    canRedo(): boolean {
      return future.length > 0;
    },
    reset(to: Inputs): void {
      past = [];
      present = { ...to };
      future = [];
    },
  };
}

export type History = ReturnType<typeof createHistory>;
