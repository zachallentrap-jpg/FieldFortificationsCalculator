// Protection leaves. THE big v2 structural change (blueprint §4.2): shielding is a
// 17-threat × 9-material table of INDEPENDENT leaves — v1 derived it as
// base × materialFactor, which manufactured 153 safety-critical numbers from 26; here
// every cell is its own owner-entered, cited value and no factor derivation exists.
// Threat→roof-path and threat→class remain structure (they name which model applies,
// not how much of anything) and live in the threat structure table, not as leaves.

import { SHIELD_MATERIAL_IDS, THREAT_IDS, type RoofPath, type ThreatClass, type ThreatId } from '../ids';
import { safetyFt } from './build';
import type { SafetyCriticalLeaf } from '../leaf';

// Structure: which protection model applies per threat. Qualitative — the engineered
// class NEVER yields a thickness leaf (INV-1: no shield.* leaf exists for a threat
// whose roof path is engineered_required... except wall thickness still applies for
// direct fire against the FACE; only the ROOF is engineered. Shielding here is the
// protective thickness of a wall/mass between the threat and the occupant; the
// engineered-roof rule lives in the cover resolver, which refuses roof thickness for
// those threats regardless of what the fill contains).
export interface ThreatStructure {
  readonly id: ThreatId;
  readonly label: string;
  readonly cls: ThreatClass;
  readonly roof: RoofPath;
  /** Definitional identifier (5.56, 81, 155…) — names the threat, never a magnitude to confirm. */
  readonly caliberMm?: number;
}

export const THREAT_STRUCTURE: readonly ThreatStructure[] = [
  { id: 'sa-556', label: '5.56mm', cls: 'small_arms', roof: 'earth_on_stringers', caliberMm: 5.56 },
  { id: 'sa-762', label: '7.62mm', cls: 'small_arms', roof: 'earth_on_stringers', caliberMm: 7.62 },
  { id: 'sa-127', label: '12.7mm (.50 cal)', cls: 'small_arms', roof: 'earth_on_stringers', caliberMm: 12.7 },
  { id: 'sa-145', label: '14.5mm HMG', cls: 'small_arms', roof: 'earth_on_stringers', caliberMm: 14.5 },
  { id: 'ind-mtr-60', label: '60mm mortar', cls: 'indirect', roof: 'earth_on_stringers', caliberMm: 60 },
  { id: 'ind-mtr-81', label: '81/82mm mortar', cls: 'indirect', roof: 'earth_on_stringers', caliberMm: 81 },
  { id: 'ind-mtr-120', label: '120mm mortar', cls: 'indirect', roof: 'earth_on_stringers', caliberMm: 120 },
  { id: 'ind-art-105', label: '105mm artillery', cls: 'indirect', roof: 'earth_on_stringers', caliberMm: 105 },
  { id: 'ind-art-122', label: '122mm artillery', cls: 'indirect', roof: 'earth_on_stringers', caliberMm: 122 },
  { id: 'ind-art-152', label: '152mm artillery', cls: 'indirect', roof: 'earth_on_stringers', caliberMm: 152 },
  { id: 'ind-art-155', label: '155mm artillery', cls: 'indirect', roof: 'earth_on_stringers', caliberMm: 155 },
  { id: 'at-rpg', label: 'RPG (shaped charge)', cls: 'direct_fire', roof: 'engineered_required' },
  { id: 'at-recoilless', label: 'Recoilless rifle', cls: 'direct_fire', roof: 'engineered_required' },
  { id: 'at-tank', label: 'Tank main gun', cls: 'direct_fire', roof: 'engineered_required' },
  { id: 'at-he-contact', label: 'Direct-fire HE (contact burst)', cls: 'direct_fire', roof: 'engineered_required' },
  { id: 'blast-demo', label: 'Demolition / small IED', cls: 'blast', roof: 'earth_on_stringers' },
  { id: 'blast-vbied', label: 'Vehicle-borne IED (large)', cls: 'blast', roof: 'engineered_required' },
];

const threatLabel = (t: ThreatId): string => {
  const row = THREAT_STRUCTURE.find((r) => r.id === t);
  if (!row) throw new Error(`threat structure missing ${t}`);
  return row.label;
};

export const shieldLeafId = (t: ThreatId, m: (typeof SHIELD_MATERIAL_IDS)[number]): string =>
  `shield.${t}.${m}`;

const MATERIAL_LABEL: Record<(typeof SHIELD_MATERIAL_IDS)[number], string> = {
  soil: 'packed soil', sand: 'loose sand', sandbagged_soil: 'sandbagged soil', clay: 'clay',
  gravel: 'gravel', concrete: 'concrete', steel: 'steel', timber: 'timber', snow_ice: 'snow/ice',
};

/** 17×9 independent shielding-thickness leaves. */
export const SHIELDING_LEAVES: readonly SafetyCriticalLeaf[] = THREAT_IDS.flatMap((t) =>
  SHIELD_MATERIAL_IDS.map((m) =>
    safetyFt(shieldLeafId(t, m), {
      name: `Shielding thickness — ${threatLabel(t)} vs ${MATERIAL_LABEL[m]}`,
      plain: `how thick the ${MATERIAL_LABEL[m]} must be to stop ${threatLabel(t)}`,
      def: `Minimum thickness of ${MATERIAL_LABEL[m]}, measured through the protective mass along the threat line, required to defeat ${threatLabel(t)}. Entered independently per pub cell — never derived from another material's value.`,
      pub: 'Protection/shielding thickness table of the governing survivability pub (e.g. FM 5-103 series)',
      batch: `protection.shielding.${t}`,
    }),
  ),
);

/** Per-threat minimum standoff (air gap / burster distance) leaves. */
export const STANDOFF_LEAVES: readonly SafetyCriticalLeaf[] = THREAT_IDS.map((t) =>
  safetyFt(`standoff.${t}`, {
    name: `Minimum standoff — ${threatLabel(t)}`,
    plain: `air gap needed against ${threatLabel(t)}`,
    def: `Minimum standoff distance between the outer protective face and the occupied space for ${threatLabel(t)}, per the governing pub's standoff table.`,
    pub: 'Standoff/burster table of the governing survivability pub',
    batch: 'protection.standoff',
  }),
);

export const PROTECTION_LEAVES = [...SHIELDING_LEAVES, ...STANDOFF_LEAVES];
