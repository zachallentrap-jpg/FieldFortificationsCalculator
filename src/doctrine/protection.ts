// ─────────────────────────────────────────────────────────────────────────────
// PROTECTION — SAFETY-CRITICAL DOCTRINE (§8, §3)
// Every shielding thickness, radiation halving-thickness, standoff, and parapet/roof
// structural value here is ILLUSTRATIVE PLACEHOLDER data, wrapped in P() with
// safetyCritical:true and source 'TODO'. NO authoritative value is sourced, fetched,
// transcribed, or guessed — the illustrative numbers exist only so the app runs and are
// covered by the NOT FOR FIELD USE banner. A qualified user supplies real, verified
// values offline via doctrine import (io.ts).
//
// HARD SAFETY INVARIANT (§2.7): every direct-fire AT munition (shaped charge / contact HE)
// and large-IED overpressure resolves to 'engineered_required'. The engine emits NO fabricated
// cover thickness for them, ever — enforced by each munition's roof:'engineered_required',
// roofPathFor() below, plus engine.protection + fuzz tests.
// ─────────────────────────────────────────────────────────────────────────────

import { P } from './types';
import type { Provenance } from './types';

// Local copy of the roof-path union (doctrine depends on nothing upstream). Structurally
// identical to engine/types RoofPath.
export type RoofPath = 'none' | 'earth_on_stringers' | 'engineered_required';

// ── Threat model: class → specific munition/caliber ──────────────────────────────
// The threat's SIZE is the dominant protection variable, so a threat is a SPECIFIC round,
// not a coarse bucket. Each munition carries its own shielding thickness (per material),
// standoff, roof call, and cover material — so switching 82mm → 155mm actually moves the
// cover thickness, standoff, and BOM. Every magnitude is an ILLUSTRATIVE PLACEHOLDER; the
// caliber (mm) is a definitional identifier, not a doctrinal number to confirm.
// Direct-fire AT (shaped charge / contact HE) and large-IED overpressure route to
// 'engineered_required' — the engine never fabricates a thickness for them (§2.7).
export type ThreatClass = 'small_arms' | 'indirect' | 'direct_fire' | 'blast';

export const threatClasses: { id: ThreatClass; label: string }[] = [
  { id: 'small_arms', label: 'Small arms / HMG' },
  { id: 'indirect', label: 'Indirect (mortar / artillery)' },
  { id: 'direct_fire', label: 'Direct-fire AT' },
  { id: 'blast', label: 'Blast / overpressure' },
];

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

export interface ThreatDef {
  label: string;
  class: ThreatClass;
  caliberMm?: number; // definitional identifier — NOT a magnitude to confirm
  base: number; // illustrative base shielding-thickness seed (ft) — placeholder, monotone by severity
  coverMaterial: ShieldMaterial;
  roof: RoofPath;
  standoffMin: Provenance<number>; // SAFETY-CRITICAL placeholder standoff (ft)
  note?: string;
}

// Every `base` and `standoffMin` here is ILLUSTRATIVE PLACEHOLDER data. The relative ordering
// (bigger caliber → more cover/standoff) is deliberate structure; the actual values are TODO.
export const threats: Record<string, ThreatDef> = {
  // Small arms / HMG (kinetic) — earth-on-stringers when covered.
  'sa-556': { label: '5.56mm', class: 'small_arms', caliberMm: 5.56, base: 0.4, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(1.0, 'illustrative standoff') },
  'sa-762': { label: '7.62mm', class: 'small_arms', caliberMm: 7.62, base: 0.5, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(1.0, 'illustrative standoff') },
  'sa-127': { label: '12.7mm (.50 cal)', class: 'small_arms', caliberMm: 12.7, base: 0.7, coverMaterial: 'sandbagged_soil', roof: 'earth_on_stringers', standoffMin: sc(1.0, 'illustrative standoff') },
  'sa-145': { label: '14.5mm HMG', class: 'small_arms', caliberMm: 14.5, base: 0.9, coverMaterial: 'sandbagged_soil', roof: 'earth_on_stringers', standoffMin: sc(1.0, 'illustrative standoff') },
  // Indirect — mortar.
  'ind-mtr-60': { label: '60mm mortar', class: 'indirect', caliberMm: 60, base: 1.0, coverMaterial: 'sandbagged_soil', roof: 'earth_on_stringers', standoffMin: sc(1.0, 'illustrative standoff') },
  'ind-mtr-81': { label: '81/82mm mortar', class: 'indirect', caliberMm: 81, base: 1.3, coverMaterial: 'sandbagged_soil', roof: 'earth_on_stringers', standoffMin: sc(1.25, 'illustrative standoff') },
  'ind-mtr-120': { label: '120mm mortar', class: 'indirect', caliberMm: 120, base: 1.8, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(1.5, 'illustrative standoff') },
  // Indirect — artillery.
  'ind-art-105': { label: '105mm artillery', class: 'indirect', caliberMm: 105, base: 2.0, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(1.5, 'illustrative standoff') },
  'ind-art-122': { label: '122mm artillery', class: 'indirect', caliberMm: 122, base: 2.3, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(1.75, 'illustrative standoff') },
  'ind-art-152': { label: '152mm artillery', class: 'indirect', caliberMm: 152, base: 2.7, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(2.0, 'illustrative standoff') },
  'ind-art-155': { label: '155mm artillery', class: 'indirect', caliberMm: 155, base: 2.8, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(2.0, 'illustrative standoff') },
  // Direct-fire AT — shaped charge / contact HE → ENGINEERED (never a fabricated thickness, §2.7).
  'at-rpg': { label: 'RPG (shaped charge)', class: 'direct_fire', base: 3.5, coverMaterial: 'soil', roof: 'engineered_required', standoffMin: sc(2.0, 'illustrative standoff — engineered roof') },
  'at-recoilless': { label: 'Recoilless rifle', class: 'direct_fire', base: 3.5, coverMaterial: 'soil', roof: 'engineered_required', standoffMin: sc(2.0, 'illustrative standoff — engineered roof') },
  'at-tank': { label: 'Tank main gun', class: 'direct_fire', base: 4.0, coverMaterial: 'soil', roof: 'engineered_required', standoffMin: sc(2.5, 'illustrative standoff — engineered roof') },
  'at-he-contact': { label: 'Direct-fire HE (contact burst)', class: 'direct_fire', base: 3.0, coverMaterial: 'soil', roof: 'engineered_required', standoffMin: sc(2.0, 'illustrative standoff — engineered roof') },
  // Blast / overpressure — scaled by charge, not caliber.
  'blast-demo': { label: 'Demolition / small IED', class: 'blast', base: 1.5, coverMaterial: 'soil', roof: 'earth_on_stringers', standoffMin: sc(2.0, 'illustrative standoff') },
  'blast-vbied': { label: 'Vehicle-borne IED (large)', class: 'blast', base: 3.0, coverMaterial: 'soil', roof: 'engineered_required', standoffMin: sc(4.0, 'illustrative standoff — engineered roof') },
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
  for (const [threat, def] of Object.entries(threats)) {
    const row = {} as Record<ShieldMaterial, Provenance<number>>;
    for (const mat of shieldMaterials) {
      const val = Math.round(def.base * materialFactor[mat] * 100) / 100;
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

// Default overhead-cover material and roof path per munition — DERIVED from the catalog so
// they can never drift from the threat definitions.
export const coverMaterialDefault: Record<string, ShieldMaterial> = Object.fromEntries(
  Object.entries(threats).map(([id, t]) => [id, t.coverMaterial]),
) as Record<string, ShieldMaterial>;

export const roofSelector: Record<string, RoofPath> = Object.fromEntries(
  Object.entries(threats).map(([id, t]) => [id, t.roof]),
) as Record<string, RoofPath>;

// The single, test-backed authority for roof path. Unknown munitions fail safe to
// 'engineered_required' rather than fabricating a covered roof (§2.7).
export function roofPathFor(threat: string): RoofPath {
  return threats[threat]?.roof ?? 'engineered_required';
}

// Munition standoff (§9 setback). Falls back to the global minimum for 'none'/unknown.
export function standoffMinFor(threat: string): number {
  return threats[threat]?.standoffMin.value ?? overhead.setbackMin.value;
}
export function standoffLeafFor(threat: string): Provenance<number> | undefined {
  return threats[threat]?.standoffMin;
}

// UI helpers for the class → caliber picker.
export function munitionsByClass(cls: ThreatClass): { id: string; label: string }[] {
  return Object.entries(threats)
    .filter(([, t]) => t.class === cls)
    .map(([id, t]) => ({ id, label: t.label }));
}
export function threatClassOf(threat: string): ThreatClass | 'none' {
  return threats[threat]?.class ?? 'none';
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
