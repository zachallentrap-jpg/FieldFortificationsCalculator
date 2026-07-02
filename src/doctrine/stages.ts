// Construction stages (§8, Phase 4) — the doctrinal order a position is built in, and how the
// dig labor apportions across the pre-dig stages. The field question is never "how many bags"
// but "who does what now, are we ready by stand-to." These fractions are ILLUSTRATIVE
// PLACEHOLDERS like every other doctrinal magnitude, wrapped in P().
//
// The decomposition PARTITIONS the engine's existing man-hour total (it never adds to it): the
// excavation labor is split across the four earthmoving stages by these fractions (which sum to
// 1), and each labor adder (revet / sump / overhead / camo) lands on the stage that incurs it —
// so the per-stage man-hours sum EXACTLY to the position total (asserted by test).

import { P } from './types';
import type { Provenance } from './types';

export type StageId = 'security' | 'hasty' | 'deliberate' | 'revet_sump' | 'parapet' | 'overhead' | 'camo';

export interface StageDef {
  id: StageId;
  label: string; // plain language first
  detail: string;
}

// Fixed doctrinal order (priorities of work): security out first, then dig deeper and deeper,
// then improve. Every position walks this list; stages with no work are dropped at compute time.
export const STAGE_ORDER: StageDef[] = [
  { id: 'security', label: 'Post security & stake sectors', detail: 'Local security out, sectors of fire staked before any digging.' },
  { id: 'hasty', label: 'Hasty scrape (prone cover)', detail: 'Dig prone/shell-scrape depth first — immediate cover.' },
  { id: 'deliberate', label: 'Dig to full depth', detail: 'Excavate to the standard’s fighting depth.' },
  { id: 'revet_sump', label: 'Revet walls & dig sumps', detail: 'Hold the walls back; dig grenade sumps and drainage.' },
  { id: 'parapet', label: 'Build front protection', detail: 'Throw/place the parapet or berm, front first.' },
  { id: 'overhead', label: 'Overhead cover', detail: 'Stringers and cover material overhead.' },
  { id: 'camo', label: 'Camouflage (continuous)', detail: 'Break up the outline; maintained throughout.' },
];

// How the EXCAVATION labor (base dig + per-volume) splits across the four earthmoving stages.
// Placeholders; sum to 1 so the partition is exact.
export const excavationSplit: Record<'security' | 'hasty' | 'deliberate' | 'parapet', Provenance<number>> = {
  security: P(0.05, { note: 'share of dig labor spent posting security & staking (illustrative)' }),
  hasty: P(0.3, { note: 'share of dig labor to reach hasty prone depth (illustrative)' }),
  deliberate: P(0.45, { note: 'share of dig labor from hasty depth to full depth (illustrative)' }),
  parapet: P(0.2, { note: 'share of dig labor forming the parapet/berm from spoil (illustrative)' }),
};

// Which BOM line ids belong to which stage (each id lands on exactly ONE stage → per-stage
// BOM sums to the position total exactly).
export const STAGE_BOM: Record<StageId, string[]> = {
  security: [],
  hasty: [],
  deliberate: ['excavation_loose'],
  revet_sump: ['grenade_sumps', 'gravel_sump', 'sandbags_revet', 'revet_panels', 'pickets', 'revet_wire'],
  parapet: ['sandbags_parapet', 'berm_fill'],
  overhead: ['sandbags_cover', 'cover_soil_fill', 'stringers'],
  camo: ['camo_net'],
};
