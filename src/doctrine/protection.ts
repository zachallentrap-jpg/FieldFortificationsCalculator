// ─────────────────────────────────────────────────────────────────────────────
// PROTECTION — SAFETY-CRITICAL DOCTRINE (§8, §3)
// Every shielding thickness, radiation halving-thickness, standoff, and parapet/roof
// structural value here is ILLUSTRATIVE PLACEHOLDER data, wrapped in P() with
// safetyCritical:true and source 'TODO'. NO authoritative value is sourced, fetched,
// transcribed, or guessed — the illustrative numbers exist only so the app runs and are
// covered by the NOT FOR FIELD USE banner. A qualified user supplies real, verified
// values offline via doctrine import (io.ts).
//
// HARD SAFETY INVARIANT (§2.7): contact-burst (direct_fire_he) and shaped_charge roofs
// resolve to 'engineered_required'. The engine emits NO fabricated cover thickness for
// them, ever — enforced by roofPathFor() below plus engine.protection + fuzz tests.
// ─────────────────────────────────────────────────────────────────────────────

import { P } from './types';
import type { Provenance } from './types';

// Local copy of the roof-path union (doctrine depends on nothing upstream). Structurally
// identical to engine/types RoofPath.
export type RoofPath = 'none' | 'earth_on_stringers' | 'engineered_required';

export const threats: Record<string, { label: string }> = {
  small_arms: { label: 'Small arms' },
  fragmentation: { label: 'Fragmentation' },
  indirect_light: { label: 'Indirect fire (light)' },
  indirect_heavy: { label: 'Indirect fire (heavy)' },
  direct_fire_he: { label: 'Direct-fire HE (contact burst)' },
  shaped_charge: { label: 'Shaped charge' },
  blast_overpressure: { label: 'Blast overpressure' },
  nuclear_thermal: { label: 'Nuclear / thermal' },
};

export const shieldMaterials = [
  'soil',
  'sand',
  'sandbagged_soil',
  'clay',
  'gravel',
  'concrete',
  'steel',
  'timber',
  'snow_ice',
] as const;
export type ShieldMaterial = (typeof shieldMaterials)[number];

const sc = (v: number, note: string): Provenance<number> =>
  P(v, { unit: 'ft', safetyCritical: true, source: 'TODO: confirm against current pub', note });

// Illustrative reference thicknesses (feet). threatBase × materialFactor, rounded.
// Purely so the planner produces a drawing; NOT protective guidance.
const threatBase: Record<string, number> = {
  small_arms: 0.5,
  fragmentation: 1.0,
  indirect_light: 1.5,
  indirect_heavy: 2.5,
  direct_fire_he: 3.0,
  shaped_charge: 3.5,
  blast_overpressure: 2.0,
  nuclear_thermal: 1.0,
};
const materialFactor: Record<ShieldMaterial, number> = {
  soil: 1.0,
  sand: 1.1,
  sandbagged_soil: 0.9,
  clay: 0.95,
  gravel: 1.0,
  concrete: 0.4,
  steel: 0.15,
  timber: 1.8,
  snow_ice: 3.0,
};

function buildShielding(): Record<string, Record<ShieldMaterial, Provenance<number>>> {
  const out: Record<string, Record<ShieldMaterial, Provenance<number>>> = {};
  for (const threat of Object.keys(threatBase)) {
    const row = {} as Record<ShieldMaterial, Provenance<number>>;
    for (const mat of shieldMaterials) {
      const base = threatBase[threat] ?? 1;
      const val = Math.round(base * materialFactor[mat] * 100) / 100;
      row[mat] = sc(val, 'illustrative shielding thickness — confirm against current pub');
    }
    out[threat] = row;
  }
  return out;
}
export const shielding = buildShielding();

// Radiation halving thickness per material (feet) — SAFETY-CRITICAL illustrative.
export const radiationHalving: Record<ShieldMaterial, Provenance<number>> = {
  soil: sc(0.5, 'illustrative halving thickness'),
  sand: sc(0.55, 'illustrative halving thickness'),
  sandbagged_soil: sc(0.45, 'illustrative halving thickness'),
  clay: sc(0.48, 'illustrative halving thickness'),
  gravel: sc(0.5, 'illustrative halving thickness'),
  concrete: sc(0.22, 'illustrative halving thickness'),
  steel: sc(0.06, 'illustrative halving thickness'),
  timber: sc(1.0, 'illustrative halving thickness'),
  snow_ice: sc(1.5, 'illustrative halving thickness'),
};

// Default overhead-cover material per threat (qualitative selection of a shieldMaterial).
export const coverMaterialDefault: Record<string, ShieldMaterial> = {
  small_arms: 'soil',
  fragmentation: 'sandbagged_soil',
  indirect_light: 'sandbagged_soil',
  indirect_heavy: 'soil',
  blast_overpressure: 'soil',
  nuclear_thermal: 'soil',
  direct_fire_he: 'soil', // unused — roof is engineered_required
  shaped_charge: 'soil', // unused — roof is engineered_required
};

// Roof selector (qualitative doctrine logic). frag/small-arms/indirect/blast/nuclear →
// earth on stringers; contact-burst and shaped-charge → engineered by a qualified
// designer (never an app-fabricated thickness).
export const roofSelector: Record<string, RoofPath> = {
  small_arms: 'earth_on_stringers',
  fragmentation: 'earth_on_stringers',
  indirect_light: 'earth_on_stringers',
  indirect_heavy: 'earth_on_stringers',
  blast_overpressure: 'earth_on_stringers',
  nuclear_thermal: 'earth_on_stringers',
  direct_fire_he: 'engineered_required',
  shaped_charge: 'engineered_required',
};

// The single, test-backed authority for roof path. Unknown threats fail safe to
// 'engineered_required' rather than fabricating a covered roof.
export function roofPathFor(threat: string): RoofPath {
  if (threat === 'direct_fire_he' || threat === 'shaped_charge') return 'engineered_required';
  const sel = roofSelector[threat];
  return sel ?? 'engineered_required';
}

// Parapet default (frontal/flank cover). W (thickness) is protective → safety-critical.
export const parapet = {
  W: P(3.0, { unit: 'ft', safetyCritical: true, note: 'frontal-cover thickness (illustrative)' }),
  H: P(0.5, { unit: 'ft', note: 'parapet height above grade (illustrative)' }),
};

// Overhead-cover chain constants (§8, §9). setbackMin / setbackDepthFrac are standoff
// (safety-critical). bearingEachEnd and stringerSpacing drive cover geometry + counts.
export const overhead = {
  setbackMin: P(1.0, { unit: 'ft', safetyCritical: true, note: 'minimum roof setback/standoff (illustrative)' }),
  setbackDepthFrac: P(0.25, { safetyCritical: true, note: 'setback as fraction of depth (illustrative)' }),
  bearingEachEnd: P(1.0, { unit: 'ft', note: 'stringer bearing each end (illustrative)' }),
  stringerSpacing: P(1.0, { unit: 'ft', note: 'center-to-center stringer spacing (illustrative)' }),
  sheathingThickness: P(0.083, { unit: 'ft', note: 'roof sheathing ~1 in (illustrative)' }),
  dustproofThickness: P(0.02, { unit: 'ft', note: 'dustproof layer (illustrative)' }),
};

// Stringer span → size (structural). maxSpan is a load-span value → safety-critical.
export interface SpanSize {
  maxSpan: Provenance<number>;
  sizeLabel: string;
}
export const spanSizes: SpanSize[] = [
  { maxSpan: P(4.0, { unit: 'ft', safetyCritical: true, note: 'illustrative span limit' }), sizeLabel: '4×4' },
  { maxSpan: P(6.0, { unit: 'ft', safetyCritical: true, note: 'illustrative span limit' }), sizeLabel: '6×6' },
  { maxSpan: P(8.0, { unit: 'ft', safetyCritical: true, note: 'illustrative span limit' }), sizeLabel: '8×8' },
];
export function stringerSizeForSpan(spanFt: number): string {
  for (const s of spanSizes) {
    if (spanFt <= s.maxSpan.value) return s.sizeLabel;
  }
  return 'engineered'; // beyond tabulated span → designer decides
}

// Retaining / revetment wall limits (structural → safety-critical).
export const retainingWall = {
  maxHeight: P(5.0, { unit: 'ft', safetyCritical: true, note: 'illustrative max unengineered height' }),
  thickness: P(1.0, { unit: 'ft', safetyCritical: true, note: 'illustrative wall thickness' }),
};
