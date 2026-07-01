// Reactive store (§13). Framework-free: getState / setState / subscribe. Holds inputs,
// layout mode + override, theme, active scenario, comparison + mission sets, and last error.
// Input edits flow through setInputs (which the app pairs with a synchronous pure compute and
// rAF-batched render). Layout/theme/scenario mutations NEVER change input semantics (§2.8).

import { SCHEMA_VERSION } from '../version';
import type { Inputs, MissionItem } from '../engine/types';
import type { LayoutMode } from '../layout/resolve';

export const DEFAULT_INPUTS: Inputs = {
  schemaVersion: SCHEMA_VERSION,
  positionType: 'one_man',
  standard: 'hasty',
  soil: 'loam',
  threat: 'sa-556',
  overheadCover: false,
  revetment: 'none',
  sump: false,
  firingStep: false,
  camouflage: false,
  machineAssist: false,
  count: 1,
  teamSize: 1,
  unit: 'imperial',
};

export interface AppState {
  inputs: Inputs;
  layoutOverride: 'auto' | LayoutMode;
  layoutMode: LayoutMode;
  theme: 'day' | 'night';
  activeScenarioId: string | null;
  comparisonSet: Inputs[];
  missionSet: MissionItem[];
  lastError: string | null;
}

export type Listener = (state: AppState) => void;

export function createStore(initial?: Partial<AppState>) {
  let state: AppState = {
    inputs: { ...DEFAULT_INPUTS },
    layoutOverride: 'auto',
    layoutMode: 'desktop',
    theme: 'day',
    activeScenarioId: null,
    comparisonSet: [],
    missionSet: [],
    lastError: null,
    ...initial,
  };
  const listeners = new Set<Listener>();

  const notify = (): void => {
    for (const l of listeners) l(state);
  };

  return {
    getState(): AppState {
      return state;
    },
    setState(patch: Partial<AppState>): void {
      state = { ...state, ...patch };
      notify();
    },
    // Merge an inputs patch without disturbing the rest of app state.
    setInputs(patch: Partial<Inputs>): void {
      state = { ...state, inputs: { ...state.inputs, ...patch } };
      notify();
    },
    replaceInputs(inputs: Inputs): void {
      state = { ...state, inputs: { ...inputs } };
      notify();
    },
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
