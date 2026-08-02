// Body-unit and check leaves (B35). Doctrine measures in body references ("armpit
// deep", "two rifle lengths"); the recruit cards speak that language. Each body unit
// is a PAIR: a numeric approx-feet leaf (the coherence gate compares it against the
// governing dimension) and an owner-authored phrase leaf. Check phrases are
// safety-critical string leaves under the full fill regime: digits and number-words
// are rejected at import, and a check bound to a governing dimension renders PENDING
// with status MISMATCH when |approxFt − dim| exceeds its tolerance (§3.2 zone E).
//
// Only the one_man set is enumerated at R0 (the R1-freeze scope); other positions'
// checks append at their mini-slice phases — ids are append-only, so that is safe.

import { STAGE_ORDER, type StageId } from '../ids';
import { bodyPhrase, check, leaf } from './build';
import type { SchemaLeaf } from '../leaf';
import { holeId } from './positions';

export const BODY_UNIT_IDS = ['armpit', 'chest', 'waist', 'knee', 'rifle_length', 'e_tool_length', 'boot_length'] as const;
export type BodyUnitId = (typeof BODY_UNIT_IDS)[number];

export const bodyApproxId = (b: BodyUnitId): string => `body.${b}.approxFt`;
export const bodyPhraseId = (b: BodyUnitId): string => `body.${b}.phrase`;

const BODY_LABEL: Record<BodyUnitId, { name: string; plain: string; def: string }> = {
  armpit: { name: 'Armpit height', plain: 'floor to your armpit', def: 'Standing height from the ground to the armpit of an average equipped Marine — the doctrine reference for full fighting depth.' },
  chest: { name: 'Chest height', plain: 'floor to your chest', def: 'Standing height from the ground to mid-chest of an average equipped Marine.' },
  waist: { name: 'Waist height', plain: 'floor to your belt', def: 'Standing height from the ground to the belt line of an average equipped Marine.' },
  knee: { name: 'Knee height', plain: 'floor to your knee', def: 'Standing height from the ground to the kneecap of an average equipped Marine — the hasty/prone cover reference.' },
  rifle_length: { name: 'Rifle length', plain: 'one rifle, muzzle to butt', def: 'Overall length of the service rifle as carried — the standard field measuring stick.' },
  e_tool_length: { name: 'E-tool length', plain: 'one entrenching tool, extended', def: 'Length of the entrenching tool extended for digging.' },
  boot_length: { name: 'Boot length', plain: 'one boot, heel to toe', def: 'Length of a standard issue boot — the fine-grained field measuring stick.' },
};

export const BODY_LEAVES: readonly SchemaLeaf[] = BODY_UNIT_IDS.flatMap((b) => [
  leaf(bodyApproxId(b), {
    name: `${BODY_LABEL[b].name} (approx ft)`, plain: BODY_LABEL[b].plain,
    def: `${BODY_LABEL[b].def} Numeric planning approximation in feet; the coherence gate compares it against any dimension a check phrase references.`,
    pub: 'Anthropometric reference the owner elects (method note)', batch: 'body.units', estimate: true,
  }, { unit: 'ft', kind: 'dimension' }),
  bodyPhrase(bodyPhraseId(b), {
    name: `${BODY_LABEL[b].name} (phrase)`, plain: BODY_LABEL[b].plain,
    def: `The exact recruit-register wording used on cards when a check references ${BODY_LABEL[b].name.toLowerCase()} (e.g. an armpit-depth phrasing). No digits, no number-words — enforced at import.`,
    pub: 'Owner-authored under the copy gates', batch: 'body.phrases', estimate: true,
  }),
]);

// one_man per-stage pass/fail checks. The DELIBERATE check is the exemplar the whole
// card system hangs on: bound to the governing depth leaf through the armpit body
// unit, tolerance is schema structure with a decision ref (B35).
export const oneManCheckId = (s: StageId): string => `check.one_man.${s}`;

const CHECK_DEF: Record<StageId, { plain: string; def: string; coherent?: { dim: string; body: BodyUnitId; tolFt: number } }> = {
  security: { plain: 'sectors staked before digging', def: 'Pass/fail wording for the security stage of the one-man position: security posted, sectors of fire staked.' },
  hasty: {
    plain: 'prone cover reached', def: 'Pass/fail wording for hasty-scrape depth of the one-man position (body-referenced against the knee).',
    coherent: { dim: holeId('one_man', 'D'), body: 'knee', tolFt: 2.5 },
  },
  deliberate: {
    plain: 'full depth reached', def: 'Pass/fail wording for full fighting depth of the one-man position (body-referenced against the armpit; the canonical exemplar: "Stand on the floor. Lift your arm. The TOP EDGE of the hole hits your armpit.").',
    coherent: { dim: holeId('one_man', 'D'), body: 'armpit', tolFt: 0.5 },
  },
  revet_sump: { plain: 'walls braced, sump dug', def: 'Pass/fail wording for revetment and grenade-sump completion of the one-man position.' },
  parapet: { plain: 'front dirt wall built', def: 'Pass/fail wording for the frontal parapet of the one-man position.' },
  overhead: { plain: 'roof solid', def: 'Pass/fail wording for earth-on-stringers overhead cover of the one-man position. Never rendered for engineered-roof threats — those stages STOP-card instead (INV-1).' },
  camo: { plain: 'position disappears', def: 'Pass/fail wording for camouflage of the one-man position (e.g. walk out front and look).' },
};

export const ONE_MAN_CHECK_LEAVES: readonly SchemaLeaf[] = STAGE_ORDER.map((s) => {
  const c = CHECK_DEF[s];
  return check(
    oneManCheckId(s),
    {
      name: `Stage check — one_man ${s}`, plain: c.plain,
      def: c.def, pub: 'Owner-authored under the copy gates (doctrine phrasing where the pub provides it)',
      batch: 'checks.one_man', estimate: true,
    },
    c.coherent
      ? { governingDimKey: c.coherent.dim, bodyUnitId: c.coherent.body, toleranceFt: c.coherent.tolFt }
      : undefined,
  );
});
