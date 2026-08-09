// Input vocabularies as const catalogs with derived union types (blueprint §4.2).
// v1 used bare strings and runtime fallbacks; here an invalid id is unrepresentable
// inside sap2 — untrusted strings narrow only in schema/parse.ts.
//
// The id lists mirror v1's doctrine tables exactly (they are structure, not magnitudes):
// renaming or removing an entry after first ship is forbidden — ids are append-only
// forever (B15). Radiation leaves do NOT carry over: the CBRN readout is OUT (B37).

export const THREAT_IDS = [
  // Small arms / HMG (kinetic)
  'sa-556', 'sa-762', 'sa-127', 'sa-145',
  // Indirect — mortar
  'ind-mtr-60', 'ind-mtr-81', 'ind-mtr-120',
  // Indirect — artillery
  'ind-art-105', 'ind-art-122', 'ind-art-152', 'ind-art-155',
  // Direct-fire AT — engineered roof required, never a fabricated thickness (INV-1)
  'at-rpg', 'at-recoilless', 'at-tank', 'at-he-contact',
  // Blast / overpressure
  'blast-demo', 'blast-vbied',
] as const;
export type ThreatId = (typeof THREAT_IDS)[number];

export const THREAT_CLASS_IDS = ['small_arms', 'indirect', 'direct_fire', 'blast'] as const;
export type ThreatClass = (typeof THREAT_CLASS_IDS)[number];

export type RoofPath = 'none' | 'earth_on_stringers' | 'engineered_required';

export const SHIELD_MATERIAL_IDS = [
  'soil', 'sand', 'sandbagged_soil', 'clay', 'gravel', 'concrete', 'steel', 'timber', 'snow_ice',
] as const;
export type ShieldMaterial = (typeof SHIELD_MATERIAL_IDS)[number];

export const SOIL_IDS = [
  'sand', 'sandy_loam', 'loam', 'silt', 'clay', 'gravel', 'rock', 'frozen',
] as const;
export type SoilId = (typeof SOIL_IDS)[number];

export const POSITION_IDS = [
  'one_man', 'two_man', 'mg_crew', 'fifty_cal', 'mortar_pit', 'atgm_javelin',
  'connecting_trench', 'bunker_op_cp', 'vehicle_hull_defilade', 'vehicle_turret_defilade',
] as const;
export type PositionId = (typeof POSITION_IDS)[number];

// Build order IS meaning: cards, scrubber, and schedule all index into this order,
// and stage numbering is 1-based position here on every surface (§3.2 zone G).
export const STAGE_ORDER = [
  'security', 'hasty', 'deliberate', 'revet_sump', 'parapet', 'overhead', 'camo',
] as const;
export type StageId = (typeof STAGE_ORDER)[number];

export const STANDARD_IDS = ['hasty', 'deliberate', 'reinforced'] as const;
export type StandardId = (typeof STANDARD_IDS)[number];

export const REVETMENT_IDS = [
  'none', 'sandbag_facing', 'pickets_wire', 'corrugated_metal', 'timber_plywood',
] as const;
export type RevetmentId = (typeof REVETMENT_IDS)[number];

export type ShapeId =
  | 'rect' | 'inverted_t' | 'l_shape' | 'circular' | 'vehicle_ramp' | 'rect_roofed';
