// The watermark state machine (blueprint §2.7): a PURE function of
// (fill class, schema match, commissioning record, coverage, revocation) — never of
// a count reaching zero. INV-4 trust asymmetry is structural here: the only path to
// COMMISSIONED goes through a commissioning record that names this exact fill hash,
// covers this position, and whose dependency cone is complete AND verified; every
// other combination lands in a watermarked state. CORRUPT is not a state — integrity
// failures refuse at load (schema/io.ts) and never reach this function.

import type { PositionId } from './ids';
import type { FillValue } from './fill';

export interface CommissioningRecord {
  /** Which positions' consumed leaf sets the ceremony attested complete (B6). */
  readonly covers: readonly PositionId[];
  readonly fillContentHash: string;
  readonly schemaHash: string;
  readonly commissionerName: string;
  readonly dateISO: string;
  readonly singleOperator: boolean;
  readonly waiverCount: number;
  /** The typed external-anchor acknowledgment is part of the ceremony (B5); a record
   *  without it is not a commissioning record. */
  readonly externalAnchorAcknowledged: true;
}

export type WatermarkState =
  | { readonly state: 'TEMPLATE' }
  | { readonly state: 'TRAINING' }
  | {
      readonly state: 'FILLED_UNCOMMISSIONED';
      readonly reason: 'unfilled' | 'unverified' | 'awaiting-commissioning';
      readonly unfilledCount: number;
      readonly unverifiedCount: number;
      /** A commissioning record exists but names a REVOKED fill — surface loudly. */
      readonly revoked: boolean;
    }
  | { readonly state: 'COMMISSIONED'; readonly record: CommissioningRecord }
  | {
      readonly state: 'STALE';
      readonly fillSchemaHash: string;
      readonly appSchemaHash: string;
      readonly missingLeafIds: readonly string[];
    };

export interface WatermarkInputs {
  /** null = no fill loaded (TEMPLATE MODE). */
  readonly fill: FillValue | null;
  readonly appSchemaHash: string;
  /** Schema leaves absent from the fill (io.ts delta report). */
  readonly missingLeafIds: readonly string[];
  /** The artifact's full dependency cone — every leaf id this artifact's numbers,
   *  phrases, and flags derive from (per-position coverage, B6). */
  readonly artifactConeLeafIds: readonly string[];
  readonly positionId: PositionId;
  readonly commissioning: CommissioningRecord | null;
  /** Planner-side revoked-hash list (B10). */
  readonly revokedFillHashes: ReadonlySet<string>;
}

export const watermarkState = (w: WatermarkInputs): WatermarkState => {
  if (w.fill === null) return { state: 'TEMPLATE' };

  // TRAINING is a floor — nothing lowers it; TEST (CI-only, unloadable shipped)
  // renders the same fail-safe floor if it ever reaches a render in a harness.
  if (w.fill.cls !== 'DOCTRINE') return { state: 'TRAINING' };

  if (w.fill.schemaHash !== w.appSchemaHash) {
    return {
      state: 'STALE',
      fillSchemaHash: w.fill.schemaHash,
      appSchemaHash: w.appSchemaHash,
      missingLeafIds: w.missingLeafIds,
    };
  }

  const unfilled = w.artifactConeLeafIds.filter((id) => !w.fill!.has(id));
  const unverified = w.artifactConeLeafIds.filter((id) => {
    const r = w.fill!.record(id);
    return r !== undefined && (r.verifiedBy === undefined || r.verifyMethod === undefined);
  });

  const c = w.commissioning;
  const revoked = c !== null && w.revokedFillHashes.has(c.fillContentHash);
  const honored =
    c !== null &&
    !revoked &&
    c.fillContentHash === w.fill.contentHash &&
    c.schemaHash === w.fill.schemaHash &&
    c.covers.includes(w.positionId) &&
    unfilled.length === 0 &&
    unverified.length === 0;

  if (honored) return { state: 'COMMISSIONED', record: c };

  return {
    state: 'FILLED_UNCOMMISSIONED',
    reason: unfilled.length > 0 ? 'unfilled' : unverified.length > 0 ? 'unverified' : 'awaiting-commissioning',
    unfilledCount: unfilled.length,
    unverifiedCount: unverified.length,
    revoked,
  };
};

/** What each state permits on artifacts (§2.4/§2.7): signature blocks,
 *  engineer-handoff blocks, and the governing-values table exist ONLY in
 *  COMMISSIONED prints; TRAINING additionally loses bare SVG/CSV export. */
export const artifactPolicy = (s: WatermarkState): {
  readonly signatureBlocks: boolean;
  readonly governingValuesTable: boolean;
  readonly bareExports: boolean;
  readonly fictSuffixOnNumerals: boolean;
} => ({
  signatureBlocks: s.state === 'COMMISSIONED',
  governingValuesTable: s.state === 'COMMISSIONED',
  bareExports: s.state !== 'TRAINING' && s.state !== 'TEMPLATE',
  fictSuffixOnNumerals: s.state === 'TRAINING',
});
