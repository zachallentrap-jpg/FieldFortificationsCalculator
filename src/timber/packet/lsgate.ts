// COMMAND PACKET — which life-safety values THIS build actually consumes (§4.1.5, R-T3).
//
// The LS table on the assumptions page has one job: tell the person signing the packet which
// numbers, if wrong, hurt somebody. That job fails in both directions.
//
//   PRINT TOO MANY and the table stops being read. A storage-shed packet listing ladder rung
//   spacing and stair headroom teaches its reader that the LS table is boilerplate, and the
//   one build where it matters gets skimmed like all the others.
//
//   PRINT TOO FEW and a real constant goes unreviewed.
//
// An earlier pass matched doctrine citations against member `doctrineRef`s and quietly missed
// the rafter, header and every span table: a member cites the METHOD it was cut by
// ("framing-square method, less half the ridge") while the doctrine entry cites the TABLE
// ("FM 5-426 Table 6-3 rafter spans"). Both are correct citations of different things, so
// string matching was never going to work. Consumers are declared instead.
//
// THE GATE: `test/timber2-packet.test.ts` asserts every id in `lifeSafetyRegister()` appears
// below. A new life-safety constant cannot ship without someone saying, in one line, which
// members it governs — which is the same question the reviewer will have to answer anyway.

import type { MemberRole } from '../types';
import type { StructureSpec } from '../spec';

type Family = StructureSpec['family'];

/**
 * Which members mean a build consumed a value.
 *
 * `roles` alone is not always enough, and the failure is asymmetric. A GP frame has `post`
 * members, so a role-only rule printed `BUNKER.postNominal` and `BUNKER.postSpacingFt` on a
 * storage building's packet — bunker overhead-cover values on a shed, in the table whose whole
 * job is that it gets read. `families` scopes a doctrine group to the structures it governs.
 *
 * An empty `roles` array is a deliberate declaration, not an omission: the value governed a
 * decision the packet cannot see in the member list (a threshold that chose between two
 * designs, a maximum that was checked and not exceeded). Those never print — a value nothing
 * in this build rests on is not this build's life-safety exposure.
 */
export interface LsConsumer {
  readonly roles: readonly MemberRole[];
  /**
   * What to call it in front of a commander. `LUMBER.girderNominal` is a code identifier;
   * printing it on an executive summary asks the reader to decode the source tree.
   */
  readonly label: string;
  readonly families?: readonly Family[];
}

const bunker = (roles: readonly MemberRole[], label: string): LsConsumer => ({ roles, label, families: ['bunker'] });
const tower = (roles: readonly MemberRole[], label: string): LsConsumer => ({ roles, label, families: ['tower'] });
const ramp = (roles: readonly MemberRole[], label: string): LsConsumer => ({ roles, label, families: ['platform'] });

export const LS_CONSUMERS: Readonly<Record<string, LsConsumer>> = {
  // Framing sizes, fixed by the standard drawing and not span-checked for the load case.
  'LUMBER.joistNominal': { roles: ['joist', 'tailJoist', 'headerJoist', 'trimmerJoist'] , label: 'Floor joist size' },
  'LUMBER.girderNominal': { roles: ['girder'] , label: 'Girder stock' },
  'LUMBER.girderPly': { roles: ['girder'] , label: 'Girder plies' },
  'LUMBER.rafterNominal': { roles: ['rafter', 'jackRafter', 'hipRafter'] , label: 'Rafter size' },
  'LUMBER.headerNominal': { roles: ['header'] , label: 'Header size' },
  'SPAN.joist': { roles: ['joist', 'tailJoist'] , label: 'Floor-joist span limit' },
  'SPAN.ceilingJoist': { roles: ['joist'] , label: 'Ceiling-joist span limit' },
  'SPAN.rafter': { roles: ['rafter', 'jackRafter', 'hipRafter'] , label: 'Rafter span limit' },
  'SPAN.header': { roles: ['header'] , label: 'Header span limit' },

  // Fall protection. Every one of these is a height or a spacing somebody trusts with a fall.
  'RAIL.topHeightIn': { roles: ['railTop'] , label: 'Top rail height' },
  'RAIL.midHeightIn': { roles: ['railMid'] , label: 'Midrail height' },
  'RAIL.toeBoardHeightIn': { roles: ['toeBoard'] , label: 'Toe board height' },
  'RAIL.postNominal': { roles: ['railPost'] , label: 'Rail post stock' },
  'RAIL.postSpacingMaxFt': { roles: ['railPost'] , label: 'Rail post spacing' },
  'RAIL.memberNominal': { roles: ['railTop', 'railMid'] , label: 'Rail member stock' },
  // A threshold that decides WHETHER a rail is required. If a rail exists the packet already
  // lists the rail's own values; if none exists the threshold governed nothing to print.
  'RAIL.requiredAboveFt': { roles: [] , label: 'Height a guardrail becomes required' },

  // Ladders.
  'LADDER.railNominal': { roles: ['ladderRail'] , label: 'Ladder rail stock' },
  'LADDER.rungNominal': { roles: ['ladderRung'] , label: 'Ladder rung stock' },
  'LADDER.rungSpacingIn': { roles: ['ladderRung'] , label: 'Ladder rung spacing' },
  'LADDER.topExtensionIn': { roles: ['ladderRail'] , label: 'Rail extension above the landing' },
  'LADDER.cageThresholdFt': { roles: ['ladderRail'] , label: 'Height a ladder cage becomes required' },

  // Stairs. Riser and tread geometry is the classic field-expedient failure.
  'STAIR.targetRiserIn': { roles: ['stringer', 'tread'] , label: 'Target riser' },
  'STAIR.maxRiserIn': { roles: ['stringer', 'tread'] , label: 'Maximum riser' },
  'STAIR.minTreadIn': { roles: ['tread'] , label: 'Minimum tread' },
  'STAIR.unitRunIn': { roles: ['tread'] , label: 'Unit run' },
  'STAIR.headroomIn': { roles: ['stringer'] , label: 'Stair headroom' },
  'STAIR.stringerNominal': { roles: ['stringer'] , label: 'Stringer stock' },
  'STAIR.stringerCount': { roles: ['stringer'] , label: 'Stringers per flight' },
  'STAIR.treadNominal': { roles: ['tread'] , label: 'Tread stock' },

  // Ramps.
  'RAMP.slopes': ramp(['deckPlank'], 'Ramp slope limits'),
  'RAMP.stringerNominal': ramp(['stringer'], 'Ramp stringer stock'),

  // Towers — every member is life-safety by construction: it is a fall from height.
  'TOWER.legNominal': tower(['towerLeg'], 'Tower leg stock'),
  'TOWER.braceNominal': tower(['towerBrace'], 'X-brace stock'),
  'TOWER.girtNominal': tower(['girt'], 'Girt stock'),
  'TOWER.mudsillNominal': tower(['sill'], 'Mudsill stock'),
  'TOWER.platformJoistNominal': tower(['joist'], 'Platform joist stock'),
  'TOWER.batterPerSideFt': tower(['towerLeg'], 'Leg batter per side'),
  'TOWER.bayHeightFt': tower(['towerBrace'], 'Brace bay height'),
  'TOWER.padSideIn': tower(['footing'], 'Footing pad side'),
  'TOWER.padDepthIn': tower(['footing'], 'Footing pad depth'),
  'TOWER.accessWidthFt': tower(['tread', 'ladderRung'], 'Access width'),
  'TOWER.ladderClearanceFt': tower(['ladderRail'], 'Ladder clearance'),
  'TOWER.ladderMaxHeightFt': tower(['ladderRail'], 'Height a ladder stops being allowed'),

  // Bunkers — the overhead carries a stated dead load over people's heads.
  'BUNKER.stringerBySpan': bunker(['ohcStringer'], 'Overhead stringer by clear span'),
  'BUNKER.stringerSpacingFt': bunker(['ohcStringer'], 'Overhead stringer spacing'),
  'BUNKER.maxReviewedSpanFt': bunker(['ohcStringer'], 'Last reviewed clear span'),
  'BUNKER.capNominal': bunker(['capBeam'], 'Cap beam stock'),
  'BUNKER.postNominal': bunker(['post'], 'Wall post stock'),
  'BUNKER.postSpacingFt': bunker(['post'], 'Wall post spacing'),
  'BUNKER.laggingNominal': bunker(['lagging'], 'Lagging stock'),
  'BUNKER.cribLogNominal': bunker(['cribLog'], 'Crib log stock'),
  'BUNKER.soilPcf': bunker(['ohcStringer', 'soilGhost'], 'Soil density used as dead load'),

  // Latrine pit depth: an excavation people stand beside. No member represents the pit itself,
  // so it prints whenever the riser box does — that is the structure over the hole.
  'LATRINE.pitDepthFt': { roles: ['riserBox'] , label: 'Pit depth' },

  // How far a threshold may stand above grade before its door needs steps. The failure mode is
  // a step out of a doorway into a two-foot drop, so it is LS; the treads are what it produces,
  // and if they are there this figure is what put them there.
  'OPENING.entryStepMinRiseFt': { roles: ['tread', 'stringer'] , label: 'Entry-step threshold' },
};

/** Which of the register's values this build actually rests on. */
export function consumedLsIds(
  roles: ReadonlySet<string>,
  family: Family,
  registerIds: readonly string[],
): string[] {
  const out: string[] = [];
  for (const id of registerIds) {
    const c = LS_CONSUMERS[id];
    if (!c || c.roles.length === 0) continue;
    if (c.families && !c.families.includes(family)) continue;
    if (c.roles.some((r) => roles.has(r))) out.push(id);
  }
  return out.sort();
}
