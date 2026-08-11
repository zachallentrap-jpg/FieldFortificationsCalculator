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
//
// AND A SECOND GATE, BECAUSE DECLARING IS NOT MEASURING. Three separate rows have now named a
// role that the check they point at never looked at: the hip's bird's-mouth seat, the hip and
// jack rafters' spans, and a tail joist at CEILING level, which the floor table skipped for being
// above the deck and the ceiling table skipped for not being called `joist`. Each time the packet
// printed the row and told the signer the build had been held to it. `timber2-doctrine.test.ts`
// walks every card and panel option the app ships and proves, per role, that the named check
// actually measures a member of it — and that no member the register claims falls through every
// check. The corpus lives there because that is where the card-and-panel walk lives.

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
  /**
   * The check that MEASURES these members against this value, where one exists. A size the
   * emitter cut from is consumed by the member simply existing; a LIMIT is only consumed if
   * something compared the member to it, and this names what did the comparing so the gate can
   * go and watch it do so.
   */
  readonly checkedBy?: LsCheck;
  /**
   * Roles this value governs in the abstract that the check above CANNOT reach, each with the
   * reason. This is the honest half of `roles`: a role left silently off the list reads as an
   * oversight to the next reader, and a role quietly added to it prints a row claiming a member
   * was examined when nothing examined it. Declared here, the gate can hold the claim to account
   * — a role named unmeasurable that the check turns out to measure fails, the same as a role
   * named measured that it does not — and the packet can print the caveat beside the row instead
   * of leaving the signer to assume the check covered everything of that name in the build.
   *
   * CANNOT REACH, NOT DOES NOT REACH — AND THIS IS NOT A PLACE TO PUT A ROLE THAT NEEDS A FIX.
   * The two are not the same claim, and only the first belongs here. "The check does not measure
   * it" is a fact about a branch somebody wrote, and it becomes true the moment they delete the
   * branch; writing a sentence here would then close the gate over the exact defect it exists to
   * catch, and print a caveat about a member the check had been measuring perfectly well. What
   * belongs here is a limit that cannot be READ against the member: a hip's seat, whose double
   * cheek over the corner is geometry `birdsMouth.ts` does not derive, or a size with no row in
   * the table — a 6x8 cap beam against a table that runs 2x4 to 2x12. `timber2-doctrine.test.ts`
   * enforces exactly that line: for a span limit it asks the MEMBER and the TABLE, not the check,
   * and refuses any role whose members carry a length and a nominal the limit's own table lists.
   */
  readonly unmeasured?: Readonly<Partial<Record<MemberRole, string>>>;
}

/** The member checks a life-safety limit can be enforced by. `spans.ts` and `birdsMouth.ts`. */
export type LsCheck = 'span' | 'seat';

const bunker = (roles: readonly MemberRole[], label: string): LsConsumer => ({ roles, label, families: ['bunker'] });
const tower = (roles: readonly MemberRole[], label: string): LsConsumer => ({ roles, label, families: ['tower'] });
const ramp = (roles: readonly MemberRole[], label: string): LsConsumer => ({ roles, label, families: ['platform'] });

export const LS_CONSUMERS: Readonly<Record<string, LsConsumer>> = {
  // Framing sizes, fixed by the standard drawing and not span-checked for the load case.
  'LUMBER.joistNominal': { roles: ['joist', 'tailJoist', 'headerJoist', 'trimmerJoist'] , label: 'Floor joist size' },
  'LUMBER.girderNominal': { roles: ['girder'] , label: 'Girder stock' },
  'LUMBER.girderPly': { roles: ['girder'] , label: 'Girder plies' },
  'LUMBER.rafterNominal': { roles: ['rafter', 'jackRafter', 'hipRafter'] , label: 'Rafter size' },
  // NOT THE BUNKER'S ENTRANCE HEADER, WHICH THESE TWO DID NOT SIZE OR RATE. A crib or post-and-
  // lagging bunker continues its 6x8 CAP BEAM across the doorway — the piece the overhead cover
  // bears on — and cites `BUNKER.capNominal` for it, because a 2x6 under a foot and a half of
  // soil is a shim, not a header. Both of these are dimension-lumber values: the size is the one
  // a stud wall puts over a window, and the span table's rows run 2x4 to 2x12 and have nothing to
  // say about a solid timber. Listed unscoped, they printed on a bunker packet as the values its
  // doorway rested on, and the span row was a limit no row of the table could be read against.
  'LUMBER.headerNominal': { roles: ['header'] , label: 'Header size', families: ['building', 'hut', 'tower', 'platform', 'tentFrame'] },
  'SPAN.joist': { roles: ['joist', 'tailJoist'] , label: 'Floor-joist span limit', checkedBy: 'span' },
  // Tails as well as whole joists: an attic hatch frames its opening in the CEILING, so the two
  // joists it cuts are ceiling joists hung on a header, and they are read on the ceiling's rows.
  'SPAN.ceilingJoist': { roles: ['joist', 'tailJoist'] , label: 'Ceiling-joist span limit', checkedBy: 'span' },
  // All three, because `spans.ts` reads the run of all three. A hip roof's commons are its
  // SHORTEST sloping members — the jacks are commons cut back to the hip, and the hip runs the
  // diagonal — so a check scoped to `rafter` would leave the longest sticks on the roof silent
  // while this line told the signer they had been held to the table.
  'SPAN.rafter': { roles: ['rafter', 'jackRafter', 'hipRafter'] , label: 'Rafter span limit', checkedBy: 'span' },
  'SPAN.header': { roles: ['header'] , label: 'Header span limit', families: ['building', 'hut', 'tower', 'platform', 'tentFrame'], checkedBy: 'span' },
  // How much of a rafter its bird's mouth may take.
  //
  // THE ROLES ARE THE ONES THAT GET MEASURED, NOT THE ONES THE RULE APPLIES TO IN THE ABSTRACT.
  // `birdsMouth.ts` seats commons and jacks — same notch, same plate, same pitch — and derives no
  // seat for a HIP, whose double-cheek cut over the corner it does not model. Listing `hipRafter`
  // here printed "Bird's-mouth seat depth limit — REVIEW REQUIRED" on the packet of a tower cab
  // that has four hip rafters and nothing else, i.e. a life-safety row for a check that examined
  // none of its members. A row that names a member nothing measured is a false assurance, which
  // is the failure this table's own header calls printing too many. The hip's seat is an open
  // item in DECISIONS.md; when it is derived, it belongs back on this line.
  //
  // Saying so OUT LOUD rather than by omission, because a hip roof has commons and jacks too: on
  // that build the row does print, earned by them, and a signer reading it would otherwise take
  // the four hips at the corners to have been examined with the rest.
  'NOTCH.rafterSeatMaxDepthFrac': {
    roles: ['rafter', 'jackRafter'],
    label: 'Bird’s-mouth seat depth limit',
    checkedBy: 'seat',
    unmeasured: {
      hipRafter: 'a hip crosses the corner at 45° on its own shallower pitch, and the double-cheek '
        + 'seat that makes is geometry the tool does not derive — no hip rafter in this build was measured',
    },
  },

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

/**
 * What this build makes the row's coverage LESS than it reads as — the reasons for exactly those
 * unmeasured members the build actually contains, or nothing when it contains none.
 *
 * A build with no hip on it is not owed a sentence about hips: a caveat printed where it does not
 * apply is more of the noise that stops the table being read.
 */
export function lsCaveatFor(id: string, roles: ReadonlySet<string>): string | undefined {
  const declared = LS_CONSUMERS[id]?.unmeasured;
  if (!declared) return undefined;
  const why = Object.entries(declared)
    .filter(([role]) => roles.has(role))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, reason]) => reason);
  return why.length > 0 ? why.join(' ') : undefined;
}

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
