// Central engine contracts. Every engine, render, state, and layout module binds to
// these types. `compute(inputs) => Result` is pure and deterministic (§2.2).

export interface Inputs {
  schemaVersion: number;
  positionType: string;
  standard: 'hasty' | 'deliberate' | 'reinforced';
  soil: string;
  threat: string;
  overheadCover: boolean;
  revetment: string;
  sump: boolean;
  firingStep: boolean;
  camouflage: boolean;
  machineAssist: boolean;
  count: number;
  teamSize: number;
  unit: 'imperial' | 'metric';
  sectorAzimuths?: { leftDeg: number; rightDeg: number };
}

export interface BomLine {
  id: string;
  label: string;
  unit: string;
  qtyPerPosition: number;
  qtyTotal: number;
  fromPlaceholder: boolean;
  sortKey: number;
}

export type Severity = 'error' | 'warning' | 'advisory';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
}

export interface LaborResult {
  manHoursPerPosition: number;
  manHoursTotal: number;
  elapsedHours: number;
  assumptions: string[];
}

export type RoofPath = 'none' | 'earth_on_stringers' | 'engineered_required';

// One Derivation per computed output — powers the tap-to-explain trace UI.
export interface Derivation {
  key: string;
  label: string;
  formula: string;
  operands: {
    name: string;
    value: number;
    unit?: string;
    placeholder?: boolean;
    source?: string;
  }[];
  result: number;
  unit: string;
}

export interface Result {
  inputs: Inputs;
  resolved: {
    holeL: number;
    holeW: number;
    holeD: number;
    parapetW: number;
    parapetH: number;
    outerL: number;
    outerW: number;
    setback: number;
  };
  cover: { thickness: number; material: string; roofPath: RoofPath };
  geometry: unknown; // plain data blocks for renderers
  bom: BomLine[]; // stable order: sortKey then id
  labor: LaborResult;
  validation: ValidationIssue[];
  derivations: Derivation[]; // powers the tap-to-explain trace
  placeholderReport: { total: number; remaining: number; safetyCriticalRemaining: number };
}

// ── Mission BOM ──────────────────────────────────────────────────────────────
export interface MissionItem {
  inputs: Inputs;
  label?: string;
}

export interface MissionBomLine extends BomLine {
  onHand?: number;
  shortfall?: number; // shortfall = max(0, qtyTotal - onHand)
}
