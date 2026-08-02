// Validation catalog, R0 tranche (blueprint §4.3). Every code carries a leader
// message here; the recruit translation is an owner-fillable string leaf slot that
// arrives with the card build (§3.1) — untranslated codes render leader-only and the
// affected card prints ASK YOUR LEADER. Unknown data never silences a check: an
// Unfilled input makes the check report DATA_INCOMPLETE instead of passing (the
// comparison itself returns 'unknown' — no value extraction happens in engine code).

import type { RevetmentId, SoilId } from '../schema/ids';
import { revetForcedId } from '../schema/leaves/soils';
import { SANDBAG_IDS, crewSizeId, leafById } from '../schema/leaves/index';
import type { NumericLeaf } from '../schema/leaf';
import type { PositionId } from '../schema/ids';
import type { FillView } from './read';
import { resolve } from './read';
import type { CoverResolution } from './cover';
import { mul, qCompare, type Q } from './trace';

export type Severity = 'error' | 'warning' | 'advisory';

export interface ValidationItem {
  readonly code: 'ENGINEERED_ROOF_REQUIRED' | 'REVET_FORCED_BY_SOIL' | 'DATA_INCOMPLETE' | 'BASIC_LOAD_EXCEEDED';
  readonly severity: Severity;
  readonly leaderMessage: string;
  /** Leaf ids whose absence caused an incomplete check (empty otherwise). */
  readonly blockedBy: readonly string[];
}

export interface ValidateInputs {
  readonly position: PositionId;
  readonly soil: SoilId;
  readonly revetment: RevetmentId;
  readonly cover: CoverResolution;
  readonly totalSandbags: Q<'ea'>;
  readonly unfilledConeLeafIds: readonly string[];
}

const num = <U extends NumericLeaf['unit']>(id: string): NumericLeaf & { unit: U } =>
  leafById(id) as NumericLeaf & { unit: U };

export const validate = (fill: FillView, v: ValidateInputs): readonly ValidationItem[] => {
  const items: ValidationItem[] = [];

  if (v.cover.kind === 'engineeredRoof') {
    items.push({
      code: 'ENGINEERED_ROOF_REQUIRED', severity: 'error',
      leaderMessage: 'This threat requires an ENGINEER-DESIGNED roof. The tool will not size overhead cover for it; route the requirement to engineer support.',
      blockedBy: [],
    });
  }

  const forced = fill.flag(revetForcedId(v.soil));
  if (forced === undefined) {
    items.push({
      code: 'DATA_INCOMPLETE', severity: 'warning',
      leaderMessage: 'Whether this soil forces revetment is not yet filled — treat walls as unsupported until entered.',
      blockedBy: [revetForcedId(v.soil)],
    });
  } else if (forced && v.revetment === 'none') {
    items.push({
      code: 'REVET_FORCED_BY_SOIL', severity: 'error',
      leaderMessage: 'This soil requires revetment regardless of the selection. Choose a revetment system.',
      blockedBy: [],
    });
  }

  // Basic-load advisory through the traced comparison — unknown reports incomplete,
  // never a silent pass.
  const carried = mul(
    'validate.carriedBags',
    resolve(fill, num<'ea'>(SANDBAG_IDS.basicLoad)),
    resolve(fill, num<'ea'>(crewSizeId(v.position))),
    'ea',
  );
  const cmp = qCompare(v.totalSandbags, carried);
  if (typeof cmp === 'object') {
    items.push({
      code: 'DATA_INCOMPLETE', severity: 'advisory',
      leaderMessage: 'Sandbag basic-load comparison unavailable until the blocking values are filled.',
      blockedBy: cmp.unknown,
    });
  } else if (cmp === 'gt') {
    items.push({
      code: 'BASIC_LOAD_EXCEEDED', severity: 'advisory',
      leaderMessage: 'Sandbag count exceeds the crew’s carried basic load — plan on-site filling or resupply.',
      blockedBy: [],
    });
  }

  if (v.unfilledConeLeafIds.length > 0) {
    items.push({
      code: 'DATA_INCOMPLETE', severity: 'warning',
      leaderMessage: `${v.unfilledConeLeafIds.length} required value(s) not yet filled — affected outputs render as tokens, partial sums never present as totals.`,
      blockedBy: v.unfilledConeLeafIds,
    });
  }

  return items;
};

export const worstSeverity = (items: readonly ValidationItem[]): Severity | null => {
  if (items.some((i) => i.severity === 'error')) return 'error';
  if (items.some((i) => i.severity === 'warning')) return 'warning';
  if (items.length > 0) return 'advisory';
  return null;
};
