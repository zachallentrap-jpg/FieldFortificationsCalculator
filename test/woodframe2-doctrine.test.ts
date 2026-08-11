// TIMBER-2 — doctrine data integrity and the dictionary lockstep (plan §8.6, I-11, I-14).
//
// Four things are checked that reviews miss:
//   1. every magnitude carries a citation, and unverified ones are visibly (PH);
//   2. the LS register is real — the fall/collapse/overload numbers are actually tagged, so
//      the UI badge and the CI ack gate see the same set;
//   3. `doctrine.ts` and the FROZEN legacy modules agree. The legacy generators keep their own
//      literals (editing them is a stop-the-line event, C-10), so the values are mirrored —
//      and mirrors drift unless something watches them;
//   4. and the register's claims are KEPT: a row naming a member it says was measured is held
//      against the check that was supposed to measure it, over every build the app ships.
//      Three rows have now promised a check nobody performed; the last section here is why a
//      fourth cannot merge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LUMBER, PANEL, LAYOUT, FOUNDATION, STAIR, LADDER, RAIL, RAMP, ROOFING, SIDING, LABOR, NAILING,
  SPAN, IN_PER_FT, allDoctrineEntries, lifeSafetyRegister, citeOf,
} from '../src/woodframe/doctrine';
import { FULL_FIXTURES, MATRIX_FIXTURES } from './fixtures/frameFixtures';
import { DRESSED, type Member } from '../src/woodframe/types';
import { BF_PER_LF, classifyNominal, bomSummary } from '../src/woodframe/bom';
import { generateFrame, specFromBuildingInput, type BuildingInput } from '../src/woodframe/frame';
import { stairPlan } from '../src/woodframe/floor';
import { generateStructure, type StructureModel } from '../src/woodframe/families/index';
import { familyTable } from '../src/woodframe/catalog';

// The catalog is minted fresh per call now (live doctrine reads); these cases read the
// shipped table once — none of them mutates the register.
const FAMILY_TABLE = familyTable();
import { configSchemaFor, type PanelRow } from '../src/ui/woodframe/config';
import { HUT } from '../src/woodframe/doctrine';
import { spanWarnings, type SpanWarning } from '../src/woodframe/spans';
import { seatCutsFor, seatDepthWarnings } from '../src/woodframe/birdsMouth';
import { LS_CONSUMERS, type LsConsumer } from '../src/woodframe/packet/lsgate';
import type { RoofSpec, StructureSpec } from '../src/woodframe/spec';

// ── Citation tiers ───────────────────────────────────────────────────────────
//
// The gate here used to be `cite.length > 8`, which is a bar every string in the table clears
// and which cannot tell the two things a citation can be:
//
//   LOCATABLE — a publication AND a place in it: "IRC R403.1.6", "FM 5-426 Table 6-2". Someone
//   can open the book at that page and say yes or no.
//
//   TOPIC — a publication and a SUBJECT, with no place in it: "EM 385-1-1 stair riser maximum".
//   It says where to go looking. It does not say what was read, and nobody can confirm it
//   without doing the search themselves.
//
//   PRACTICE — no publication at all: "standard heavy-timber practice: caps drift-pinned to what
//   they bear on". Honest, and deliberately not dressed up as a citation; the tier exists so
//   those stay visible as what they are rather than passing for sourced.
//
// Most life-safety numbers in this tree sit in the topic tier. That is the true state of the
// sourcing and the gate now says so out loud instead of averaging it away — the fix for a topic
// citation is somebody reading the page, never a section number invented to clear a bar.
type CiteTier = 'locatable' | 'topic' | 'practice';

/** A publication designator: the pub series plus its number ("FM 5-426", "IRC", "EM 385-1-1"). */
const PUB = /\b(?:EM|FM|TM|ATP|TC|UFC|IRC|IBC|AFM|NFPA|OSHA)\s+[0-9A-Z][0-9A-Za-z.\-]*/g;

/**
 * A place INSIDE a publication. Each one demands a number, because that is the whole
 * distinction: "Table 6-2" is a place, "header table by span" is a subject with the word table
 * in it, and a pattern that accepted the bare word would sort the second with the first.
 */
const LOCATORS: RegExp[] = [
  /\bTable\s+[A-Z]?\d/i,
  /\bch(?:apter|\.)\s*\d/i,
  /§\s*\S/,
  /\b[A-Z]\d+(?:\.\d+)+/, // IRC-style section: R403.1.6
  /\bfig(?:ure|\.)\s*[A-Z]?\d/i,
  /\bappendix\s+[A-Z0-9]/i,
  /\bpara(?:graph|\.)\s*[A-Z0-9]/i,
];

/** The cite as a claim about a source — the (PH) bookkeeping is not part of what it cites. */
const spokenCite = (cite: string): string => cite.replace(/\(PH[^)]*\)/g, ' ');

function citeTier(cite: string): CiteTier {
  const s = spokenCite(cite);
  PUB.lastIndex = 0;
  if (!PUB.test(s)) return 'practice';
  return LOCATORS.some((r) => r.test(s)) ? 'locatable' : 'topic';
}

/** What a cite says once its publication designators are struck out — its subject. */
function citeSubject(cite: string): string {
  PUB.lastIndex = 0;
  return spokenCite(cite).replace(PUB, ' ').replace(/[^A-Za-z]+/g, ' ').trim();
}

/** Why this citation is not usable as one, or `null` when it is. */
function citeObjection(cite: string): string | null {
  const tier = citeTier(cite);
  if (tier === 'locatable') return null; // a pub and a place in it needs no subject line
  if (tier === 'topic') {
    return citeSubject(cite).replace(/\s/g, '').length >= 3
      ? null
      : 'names a publication and nothing in it — no place, no subject';
  }
  return spokenCite(cite).trim().length >= 20
    ? null
    : 'cites no publication and does not say what it rests on instead';
}

/** id → tier, over any slice of the register. The census the tests report themselves with. */
function citeTiers(entries: { id: string; cite: string }[]): Map<string, CiteTier> {
  return new Map(entries.map((e) => [e.id, citeTier(e.cite)]));
}
const census = (tiers: Map<string, CiteTier>): string =>
  (['locatable', 'topic', 'practice'] as const)
    .map((t) => `${t} ${[...tiers.values()].filter((x) => x === t).length}`)
    .join(', ');

test('every doctrine constant carries a usable citation, and unverified ones are visibly (PH)', () => {
  const entries = allDoctrineEntries();
  assert.ok(entries.length > 40, `expected a real doctrine table, got ${entries.length} entries`);
  for (const e of entries) {
    const objection = citeObjection(e.cite);
    assert.equal(objection, null, `${e.id}: citation ${objection} ("${e.cite}")`);
    assert.notEqual(e.value, undefined, `${e.id}: no value`);
  }
  // The (PH) discipline: a pending cite must SAY so wherever it renders.
  const pending = entries.filter((e) => e.ph);
  assert.ok(pending.length > 0, 'the placeholder regime is still in force');
  for (const e of pending) {
    assert.ok(citeOf({ value: e.value, cite: e.cite, ph: true }).includes('(PH)'), `${e.id}: (PH) must render`);
  }
});

test('the register knows which tier every citation is in, and both tiers are really populated', () => {
  const entries = allDoctrineEntries();
  const tiers = citeTiers(entries);
  assert.equal(tiers.size, entries.length, 'every entry is classified');
  const count = (t: CiteTier): number => [...tiers.values()].filter((x) => x === t).length;
  // Not a floor to be raised by writing section numbers — a check that the classifier is still
  // telling the two apart at all. A build where everything lands in one tier means the patterns
  // stopped discriminating, and the gate would be back to what it replaced.
  assert.ok(count('locatable') > 0, `nothing is locatable any more — ${census(tiers)}`);
  assert.ok(count('topic') > 0, `nothing is in the topic tier — ${census(tiers)}`);
});

test('a citation that names no place in a pub cannot be marked page-checked', () => {
  // `ph: false` is a claim that somebody read the page. A topic citation names no page, so there
  // is no page anyone could have read: clearing the flag against one records a check that cannot
  // have happened. Practice-tier entries are exempt because they claim no publication at all —
  // they say in the open what they rest on, and there is nothing to turn to.
  const wrong = allDoctrineEntries()
    .filter((e) => !e.ph && citeTier(e.cite) === 'topic')
    .map((e) => `${e.id}: page-checked against "${e.cite}", which names no section, table or figure`);
  assert.deepEqual(wrong, [], `page checks recorded against citations with no page:\n  ${wrong.join('\n  ')}`);
});

test('the life-safety register holds every fall / collapse / overload number', () => {
  const ls = lifeSafetyRegister();
  const ids = new Set(ls.map((e) => e.id));
  // Named by the plan (§6.2): rails, ladders, stairs, ramps, and the span/size tables.
  for (const required of [
    'RAIL.topHeightIn', 'RAIL.midHeightIn', 'RAIL.toeBoardHeightIn', 'RAIL.requiredAboveFt',
    'LADDER.rungSpacingIn', 'LADDER.cageThresholdFt', 'LADDER.topExtensionIn',
    'STAIR.maxRiserIn', 'STAIR.minTreadIn', 'STAIR.headroomIn',
    'RAMP.slopes',
    'LUMBER.joistNominal', 'LUMBER.girderNominal', 'LUMBER.headerNominal', 'LUMBER.rafterNominal',
  ]) {
    assert.ok(ids.has(required), `${required} must be life-safety tagged`);
  }
  for (const e of ls) {
    const objection = citeObjection(e.cite);
    assert.equal(objection, null, `${e.id}: an LS constant whose citation ${objection} is the worst case ("${e.cite}")`);
  }
  // While (PH), an LS cite must announce that a review is owed.
  const suffix = citeOf({ value: 42, cite: RAIL.topHeightIn.cite, ph: true, lifeSafety: true });
  assert.ok(suffix.includes('LIFE-SAFETY, review required'), suffix);
});

test('a life-safety number nobody can look up says so on the packet', () => {
  // The tier split matters most here and is worst here: the fall, collapse and overload numbers
  // are mostly cited to a publication and a subject — "EM 385-1-1 stair riser maximum" — which
  // is a pointer, not a page. That is not something a test can fix, and inventing a section
  // number to promote a row would be the one genuinely dangerous response. What CAN be held is
  // that such a row never reads as settled: an LS value whose citation names no place in a pub
  // must still print "LIFE-SAFETY, review required" to whoever signs the packet.
  const ls = lifeSafetyRegister();
  const tiers = citeTiers(ls);
  const unreviewable = ls.filter((e) => tiers.get(e.id) !== 'locatable');
  assert.ok(
    unreviewable.length > 0,
    `every LS citation now names a place in a pub (${census(tiers)}) — if that is real, delete this test; `
    + 'if a pattern merely started matching prose, fix the pattern',
  );
  const silent = unreviewable
    .filter((e) => !citeOf({ value: e.value, cite: e.cite, ph: e.ph, lifeSafety: true }).includes('LIFE-SAFETY, review required'))
    .map((e) => `${e.id} (${tiers.get(e.id)}): "${e.cite}" reads as reviewed`);
  assert.deepEqual(
    silent,
    [],
    `life-safety values cited to no page that print as settled anyway — ${census(tiers)}:\n  ${silent.join('\n  ')}`,
  );
});

test('the safety block cites EM 385-1-1 — LS numbers have a doctrinal home (TD27)', () => {
  const safety = [
    RAIL.topHeightIn, RAIL.midHeightIn, RAIL.toeBoardHeightIn, RAIL.requiredAboveFt,
    LADDER.rungSpacingIn, LADDER.topExtensionIn, LADDER.cageThresholdFt,
    STAIR.maxRiserIn, STAIR.minTreadIn, STAIR.headroomIn, RAMP.slopes,
  ];
  for (const d of safety) {
    assert.ok(/EM 385-1-1/.test(d.cite), `safety constant must cite EM 385-1-1: "${d.cite}"`);
  }
});

test('doctrine mirrors the FROZEN legacy modules exactly — the two cannot drift apart', () => {
  // Sizes the legacy generators cut from, asserted against what they actually emitted.
  const model = generateStructure(specFromBuildingInput({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
    letInBracing: true,
  }));
  const nominalOf = (role: string): string | undefined => model.members.find((m) => m.role === role)?.nominal;
  assert.equal(nominalOf('joist'), LUMBER.joistNominal.value);
  assert.equal(nominalOf('girder'), LUMBER.girderNominal.value);
  assert.equal(nominalOf('sill'), LUMBER.sillNominal.value);
  assert.equal(nominalOf('post'), LUMBER.postNominal.value);
  assert.equal(nominalOf('stud'), LUMBER.studNominal.value);
  assert.equal(nominalOf('solePlate'), LUMBER.plateNominal.value);
  assert.equal(nominalOf('rafter'), LUMBER.rafterNominal.value);
  assert.equal(nominalOf('ridge'), LUMBER.ridgeNominal.value);
  assert.equal(nominalOf('collarTie'), LUMBER.collarTieNominal.value);
  assert.equal(nominalOf('brace'), LUMBER.braceNominal.value);
  assert.equal(nominalOf('bridging'), LUMBER.crossBridgingNominal.value);
  // The built-up girder really is 3 plies.
  assert.equal(model.members.filter((m) => m.role === 'girder').length, LUMBER.girderPly.value);
  // Panel thicknesses, read off the emitted members.
  assert.equal(model.members.find((m) => m.role === 'subfloor')!.actual.w, PANEL.subfloorThickIn.value);
  assert.equal(model.members.find((m) => m.role === 'roofPanel')!.actual.w, PANEL.roofDeckThickIn.value);
});

test('doctrine mirrors the frozen foundation and stairwell literals — pads, reveal, wall, headroom', () => {
  // floor.ts (FROZEN, C-10) keeps its own literals for the pier pads, the basement reveal, the
  // concrete wall and the stairwell's headroom figure. The register mirrors them; these pins are
  // what makes a doctrine-side edit that diverges a mirror fail SOMETHING instead of shipping a
  // register that quietly disagrees with the frozen branch's output.
  const input = (foundation?: 'wall' | 'basement'): Parameters<typeof specFromBuildingInput>[0] => ({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
    ...(foundation ? { foundation } : {}),
  });
  // Piers: every pad is cut to the mirrored side and depth.
  const piers = generateStructure(specFromBuildingInput(input()));
  const pads = piers.members.filter((m) => m.role === 'footing');
  assert.ok(pads.length > 0, 'the pier demo pours pads');
  for (const p of pads) {
    assert.equal(p.nominal, `conc pad ${FOUNDATION.padSideIn.value}x${FOUNDATION.padSideIn.value}x${FOUNDATION.padDepthIn.value}`);
    assert.equal(p.actual.w, FOUNDATION.padSideIn.value);
    assert.equal(p.actual.d, FOUNDATION.padDepthIn.value);
  }
  // Basement: the grade line sits one mirrored reveal below the sill's underside, and the wall
  // is poured at the mirrored thickness.
  const basement = generateStructure(specFromBuildingInput(input('basement')));
  const sillBottom = basement.levels.sillTop - DRESSED['2x6']!.w / IN_PER_FT;
  assert.ok(
    Math.abs(basement.levels.gradeY - (sillBottom - (FOUNDATION.basementRevealFt.value as number))) < 1e-9,
    `the basement reveal is ${((sillBottom - basement.levels.gradeY) * IN_PER_FT).toFixed(2)} in of concrete above grade — the register says ${FOUNDATION.basementRevealFt.value} ft`,
  );
  const walls = basement.members.filter((m) => m.role === 'foundationWall');
  assert.ok(walls.length > 0, 'the basement pours walls');
  for (const w of walls) {
    assert.equal(w.nominal, `conc wall ${FOUNDATION.concreteWallThickIn.value}"`);
    assert.equal(w.actual.w, FOUNDATION.concreteWallThickIn.value);
  }
  // Stairwell: the frozen basement stair sizes its floor opening to clear the headroom figure
  // the register carries — re-derived here from the register, against the emitted plan.
  const plan = stairPlan({ lengthFt: 20, widthFt: 16, joistSpacingIn: 16, foundation: 'basement', basementDepthFt: 7.5, stairs: true });
  assert.ok(plan, 'the 20x16 basement fits a straight run');
  const floorDepthIn = 0.75 + DRESSED['2x8']!.d;
  const expectedOpenFt = (((STAIR.headroomIn.value as number) + floorDepthIn) / plan!.unitRiseIn) * plan!.unitRunIn / IN_PER_FT;
  assert.ok(
    Math.abs((plan!.x1 - plan!.x0) - expectedOpenFt) < 1e-9,
    `the stairwell opening is ${(plan!.x1 - plan!.x0).toFixed(3)} ft; clearing the register's ${STAIR.headroomIn.value}-in headroom needs ${expectedOpenFt.toFixed(3)} ft`,
  );
});

test('LABOR values equal the legacy rates — a "pure refactor" must not reprice the job', () => {
  const model = generateStructure(specFromBuildingInput({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
  }));
  const bom = bomSummary(model.members, model.stagePlan);
  const expected = bom.stages.reduce((a, s) => {
    const panels = s.panels;
    return a + s.boardFeet * (LABOR.mhPerBoardFoot.value as number) + panels * (LABOR.mhPerPanel.value as number);
  }, 0);
  // Piers-founded demo has concrete pads, so add their run at the concrete rate.
  const concLf = model.members
    .filter((m) => m.nominal.includes('conc'))
    .reduce((a, m) => a + m.cutLength / 12, 0);
  assert.ok(
    Math.abs(bom.totalManHours - (expected + concLf * (LABOR.mhPerConcreteLf.value as number))) < 1e-9,
    `labor drifted: ${bom.totalManHours}`,
  );
});

test('I-14: every nominal any generator emits resolves in BOTH DRESSED and BF_PER_LF', () => {
  // The `{1.5, 3.5}` fallback inside the emitters must be unreachable in real output: a
  // member whose nominal is missing from DRESSED silently renders at 2x4 size, and one
  // missing from BF_PER_LF silently contributes zero board-feet.
  const seen = new Set<string>();
  const inputs: BuildingInput[] = [];
  for (const foundation of [undefined, 'wall', 'basement'] as const) {
    for (const bridging of ['cross', 'solid'] as const) {
      inputs.push({
        lengthFt: 20, widthFt: 16, wallHeightFt: 8,
        studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
        risePer12: 4, overhangFt: 1, crawlFt: 1.5,
        openings: [{ wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }],
        foundation, bridging, letInBracing: true, atticAccess: true,
      });
    }
  }
  for (const i of inputs) for (const m of generateFrame(i).members) seen.add(m.nominal);

  for (const nominal of seen) {
    const kind = classifyNominal(nominal);
    if (kind === 'lumber') {
      assert.ok(DRESSED[nominal], `${nominal}: missing from DRESSED — would render as a 2x4`);
      assert.ok(BF_PER_LF[nominal] !== undefined, `${nominal}: missing from BF_PER_LF — would bill 0 BF`);
    } else {
      // Panels, concrete and hardware are measured their own way and are meant to miss
      // BF_PER_LF; assert that is a deliberate classification, not an oversight.
      assert.ok(['sheet', 'hardware', 'other'].includes(kind), `${nominal}: unclassified`);
    }
  }
  assert.ok(seen.size >= 8, `expected a broad nominal sample, saw ${seen.size}`);
});

test('DRESSED and BF_PER_LF stay in lockstep for every dimension-lumber size', () => {
  for (const nominal of Object.keys(DRESSED)) {
    assert.ok(BF_PER_LF[nominal] !== undefined, `${nominal} is dressed but has no board-foot rate`);
  }
  for (const nominal of Object.keys(BF_PER_LF)) {
    assert.ok(DRESSED[nominal], `${nominal} has a board-foot rate but no dressed size`);
    // The rate is the nominal section over 12 — check it against the name itself.
    const [w, d] = nominal.split('x').map(Number) as [number, number];
    assert.ok(Math.abs(BF_PER_LF[nominal]! - (w * d) / 12) < 1e-12, `${nominal}: BF/LF should be ${(w * d) / 12}`);
  }
});

test('classifyNominal sorts the bill into orderable sections', () => {
  assert.equal(classifyNominal('2x4'), 'lumber');
  assert.equal(classifyNominal('6x8'), 'lumber');
  assert.equal(classifyNominal('4x8 panel'), 'sheet');
  assert.equal(classifyNominal('roll roofing'), 'sheet');
  assert.equal(classifyNominal('corrugated 26x8'), 'sheet');
  assert.equal(classifyNominal('16d nails'), 'hardware');
  assert.equal(classifyNominal('T-hinge'), 'hardware');
  assert.equal(classifyNominal('conc wall 8"'), 'other');
  assert.equal(classifyNominal('earth fill'), 'other');
});

test('SIDING/ROOFING/FOUNDATION tables are populated (the coverings phase reads them)', () => {
  assert.equal(ROOFING.rollWidthIn.value, 36);
  assert.equal(ROOFING.squareSf.value, 100);
  assert.equal(ROOFING.squareSf.ph, false, 'a unit definition is not a doctrinal placeholder');
  assert.equal(SIDING.boardNominal.value, '1x10');
  assert.equal(FOUNDATION.concreteWallThickIn.value, 8);
  assert.equal(LAYOUT.studSpacingIn.value, 16);
});

// ── Fastening schedules ──────────────────────────────────────────────────────
// The mirror the NAILING table exists to be. Both directions matter: an unmirrored schedule is
// a value with no cited home (the thing the requirement is about), and a dead mirror is a
// citation for something no crew is ever told to do, which is worse than none.
//
// IT HAS TO WALK WHAT SHIPS, AND WHAT SHIPS IS THE CARD PLUS ITS PANEL. The corpus is every
// build reachable by opening a catalog card and moving ONE OR TWO controls on the panel that
// comes with it: every option of every select, both states of every toggle, each number row at
// its clamp ends and its middle.
//
// TWO, BECAUSE ONE MISSED A MEMBER A USER CAN REACH IN TWO CLICKS. A one-control walk finds a
// schedule only where a single choice reaches it, and some members exist only where two choices
// AGREE. The purlin is the case: every family whose deck offers purlins presets to a gable, and
// the frozen gable branch lays a solid deck (C-9), so roof-kind variation and covering variation
// are each individually inert — it takes `roof.kind=hip` AND `coverings.roofDeck=purlins`
// together, both of them options the card itself advertises, to put 26 purlins on a roof. Pairs
// are walked in BOTH orders, and each row's `applies` predicate is honoured against the spec as
// it stands when that row is reached, because that predicate is what the panel would have shown.
//
// A corpus built from `FAMILY_TABLE` presets, roof kinds and coverings alone leaves out eight
// schedules that are one click away: a slab foundation, a front left open, felt under the
// roofing, a tower cab roofed as a shed or reached by stair, a platform on skids, a bunker walled
// as a crib. The legacy fixtures stay in the walk — the frozen branch is shipped code too.
//
// The panel's write semantics are reproduced here (they live in the boot file, which cannot be
// imported outside a browser): the union rows rebuild their branch, and three rows mean "clear
// this" rather than "store this string".

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function setPath(spec: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = spec;
  for (const k of keys.slice(0, -1)) {
    if (node[k] === undefined || node[k] === null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
}

/** What the panel writes when a row is set to `value` — the same branch rebuilds the UI does. */
function applyPanelRow(spec: Record<string, unknown>, path: string, value: unknown): void {
  if (path === 'openFront') { spec.openFront = value === 'none' ? undefined : value; return; }
  if (path === 'site.soil') { spec.site = value === 'unknown' ? undefined : { soil: value }; return; }
  if (path === 'screenBand') { spec.screenBand = value ? { sillFt: HUT.screenBandSillFt.value, heightFt: HUT.screenBandHeightFt.value } : null; return; }
  if (path === 'roof.kind') {
    const prev = (spec.roof ?? {}) as { kind?: string; risePer12?: number; overhangFt?: number };
    const rise = prev.risePer12 ?? 4;
    const oh = prev.kind === 'none' ? 1 : prev.overhangFt ?? 1;
    const kind = value as RoofSpec['kind'];
    spec.roof =
      kind === 'shed' ? { kind, risePer12: rise || 3, overhangFt: oh, highSide: 'N' }
      : kind === 'flat' ? { kind, overhangFt: oh, drainPer12: 1 }
      : kind === 'none' ? { kind }
      : { kind, risePer12: rise, overhangFt: oh };
    return;
  }
  if (path === 'foundation.kind') {
    const prev = (spec.foundation ?? {}) as { crawlFt?: number };
    const kind = value as string;
    spec.foundation =
      kind === 'piers' || kind === 'wall' ? { kind, crawlFt: prev.crawlFt ?? 1.5 }
      : kind === 'basement' ? { kind, depthFt: 7.5, stairs: true }
      : kind === 'embedded' ? { kind, embedFt: 3 }
      : { kind };
    return;
  }
  setPath(spec, path, value);
}

/** The catalog cards themselves, and the roof/covering variants their card data offers. */
function cardSpecs(): { id: string; spec: StructureSpec }[] {
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const fam of FAMILY_TABLE) {
    out.push({ id: fam.id, spec: clone(fam.preset) });
    for (const kind of fam.roofs) {
      const s = clone(fam.preset) as StructureSpec & { roof?: RoofSpec };
      if (!s.roof || s.roof.kind === kind) continue;
      s.roof =
        kind === 'shed' ? { kind, risePer12: 3, overhangFt: 1, highSide: 'N' }
        : kind === 'flat' ? { kind, overhangFt: 1 }
        : kind === 'none' ? { kind }
        : { kind, risePer12: 4, overhangFt: 1 };
      out.push({ id: `${fam.id} roof=${kind}`, spec: s });
    }
    for (const [key, options] of Object.entries(fam.coverings)) {
      for (const option of options as string[]) {
        const s = clone(fam.preset) as StructureSpec & { coverings?: Record<string, string> };
        if (!s.coverings) continue;
        s.coverings[key] = option;
        out.push({ id: `${fam.id} ${key}=${option}`, spec: s });
      }
    }
  }
  return out;
}

/** The rows of a card's panel that are a value to move at all. */
function panelRows(famId: string): PanelRow[] {
  // The family row opens another card (already in the corpus) and the openings editor is a list,
  // not a value — neither is a control set to one of a known set of values.
  return configSchemaFor(famId as never).groups
    .flatMap((g) => g.rows)
    .filter((r) => r.control !== 'family' && r.control !== 'openings-editor');
}

/** Every value a row offers. Number rows at both clamp ends and the middle. */
function rowValues(row: PanelRow): unknown[] {
  if (row.control === 'toggle') return [true, false];
  if (row.control === 'number') {
    const { min, max } = row;
    if (min === undefined || max === undefined) return [min, max].filter((v) => v !== undefined);
    return [...new Set([min, (min + max) / 2, max])];
  }
  return (row.options ?? []).map((o) => (row.numeric ? Number(o) : o));
}

/** Each card with ONE panel control moved, over every value that control offers. */
function panelSpecs(): { id: string; spec: StructureSpec }[] {
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const fam of FAMILY_TABLE) {
    for (const row of panelRows(fam.id)) {
      for (const v of rowValues(row)) {
        const spec = clone(fam.preset) as unknown as Record<string, unknown>;
        if (row.applies && !row.applies(spec)) continue; // the panel would not have shown this row
        applyPanelRow(spec, row.path, v);
        out.push({ id: `${fam.id} ${row.path}=${String(v)}`, spec: spec as unknown as StructureSpec });
      }
    }
  }
  return out;
}

/**
 * Each card with TWO panel controls moved, in both orders. Order matters because a row's
 * `applies` predicate reads the spec as it stands when that row is reached — which is exactly how
 * the panel behaves, and how `roof.kind=hip` is what makes the purlins option appear at all.
 */
function pairSpecs(): { id: string; spec: StructureSpec }[] {
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const fam of FAMILY_TABLE) {
    const rows = panelRows(fam.id);
    for (const a of rows) {
      for (const b of rows) {
        if (a === b) continue;
        for (const va of rowValues(a)) {
          for (const vb of rowValues(b)) {
            const spec = clone(fam.preset) as unknown as Record<string, unknown>;
            if (a.applies && !a.applies(spec)) continue;
            applyPanelRow(spec, a.path, va);
            if (b.applies && !b.applies(spec)) continue;
            applyPanelRow(spec, b.path, vb);
            out.push({
              id: `${fam.id} ${a.path}=${String(va)} + ${b.path}=${String(vb)}`,
              spec: spec as unknown as StructureSpec,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Every spec the shipped app can generate from a catalog card by moving one or two of that card's
 * own panel controls. Deduplicated: most pairs land on a spec some other pair already produced
 * (a row set to the value it already had), and building each one twice buys nothing.
 */
function shippedSpecs(): { id: string; spec: StructureSpec }[] {
  const seen = new Set<string>();
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const entry of [...cardSpecs(), ...panelSpecs(), ...pairSpecs()]) {
    const key = JSON.stringify(entry.spec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Every distinct `nailing` string a set of builds emits, mapped to the roles and one build.
 *
 * `onModel` is how a second walker rides along: the corpus costs seconds to build and every extra
 * pass over it buys the same models again.
 */
function emittedNailingFrom(
  specs: { id: string; spec: StructureSpec }[],
  onModel?: (model: StructureModel, where: string) => void,
): Map<string, { roles: Set<string>; where: string }> {
  const out = new Map<string, { roles: Set<string>; where: string }>();
  const record = (members: readonly Member[], where: string): void => {
    for (const m of members) {
      const n = (m as { nailing?: string }).nailing;
      if (!n) continue;
      if (!out.has(n)) out.set(n, { roles: new Set(), where });
      out.get(n)!.roles.add(m.role);
    }
  };
  for (const fx of [...FULL_FIXTURES, ...MATRIX_FIXTURES]) record(generateFrame(fx.input).members, `legacy ${fx.name}`);
  for (const { id, spec } of specs) {
    const model = generateStructure(spec);
    record(model.members, id);
    onModel?.(model, id);
  }
  return out;
}

// The walk is thousands of builds; several tests read it, and building it once per test would
// multiply the suite's runtime for an identical answer.
let cachedEmitted: Map<string, { roles: Set<string>; where: string }> | null = null;
let cachedLs: LsWalk | null = null;
function buildWalk(): void {
  if (cachedEmitted) return;
  const ls = newLsWalk();
  cachedEmitted = emittedNailingFrom(shippedSpecs(), (model, where) => recordLs(ls, model, where));
  cachedLs = ls;
}
const emittedNailing = (): Map<string, { roles: Set<string>; where: string }> => { buildWalk(); return cachedEmitted!; };
const lsWalk = (): LsWalk => { buildWalk(); return cachedLs!; };

test('doctrine mirrors every nailing schedule a card and its panel can emit with one or two controls moved', () => {
  const emitted = emittedNailing();
  // The corpus is the guarantee's reach, so it is asserted rather than assumed: a refactor that
  // quietly narrowed the walk back to one generator would otherwise leave this test green.
  assert.ok(emitted.size > 90, `expected the real schedule set across both paths, got ${emitted.size}`);

  const mirrored = new Map(Object.entries(NAILING).map(([k, d]) => [d.value as string, k]));
  const homeless = [...emitted.entries()]
    .filter(([spec]) => !mirrored.has(spec))
    .map(([spec, { roles, where }]) => `${JSON.stringify(spec)} (roles: ${[...roles].sort().join(', ')}; e.g. ${where})`);
  assert.deepEqual(homeless, [], `emitted nailing schedules with no cited home in NAILING:\n  ${homeless.join('\n  ')}`);

  for (const [key, d] of Object.entries(NAILING)) {
    assert.ok(emitted.has(d.value as string), `NAILING.${key} mirrors nothing any generator emits`);
  }
});

test('the guarantee reaches the PANEL, not just the cards it ships', () => {
  // What the test above is worth is exactly what its corpus reaches, and the difference between
  // "the fourteen cards" and "the fourteen cards you can actually operate" is not rhetorical:
  // these schedules exist only once a control is moved. Narrow the corpus back to the cards and
  // this names, one by one, the joints that would go unwatched.
  const cardOnly = new Set(emittedNailingFrom(cardSpecs()).keys());
  const reachedByPanel = [...emittedNailingFrom(panelSpecs()).keys()].filter((s) => !cardOnly.has(s));
  assert.ok(
    reachedByPanel.length >= 7,
    `only ${reachedByPanel.length} schedules need a panel control moved — has the sweep stopped sweeping?`,
  );
  // And each of them is genuinely mirrored, and genuinely inside the corpus the guarantee above
  // walks — a sweep that exists but is not wired into that walk proves nothing.
  const mirrored = new Set(Object.values(NAILING).map((d) => d.value as string));
  assert.deepEqual(reachedByPanel.filter((s) => !mirrored.has(s)), []);
  const corpus = new Set(emittedNailing().keys());
  assert.deepEqual(reachedByPanel.filter((s) => !corpus.has(s)), [], 'the panel sweep is not in the walked corpus');
});

test('the guarantee reaches a member only a PAIR of card-advertised choices produces', () => {
  // What the second control buys, named. Narrow the corpus back to one control at a time and the
  // purlin's schedule leaves the walk entirely — not because it is unreachable, but because the
  // two clicks that reach it are inert one at a time. That is the shape of gap this register is
  // for, so the walk has to keep proving it still covers it.
  const singles = new Set(emittedNailingFrom([...cardSpecs(), ...panelSpecs()]).keys());
  const reachedOnlyByPairs = [...emittedNailing().keys()].filter((s) => !singles.has(s));
  assert.ok(
    reachedOnlyByPairs.includes(NAILING.purlinAtRafters.value as string),
    `the purlin schedule is no longer pair-only — the walk found it at ${reachedOnlyByPairs.length} pair-only schedules`,
  );
  const mirrored = new Set(Object.values(NAILING).map((d) => d.value as string));
  assert.deepEqual(reachedOnlyByPairs.filter((s) => !mirrored.has(s)), []);
});

test('no two EMITTED schedules are the same joint written two ways', () => {
  // One joint, one string. The frozen branch says "3-16d toenail ea bearing"; a sibling generator
  // that types "each bearing" has made a second joint out of one, and the register cannot see it
  // because both halves get a cited home. So this compares what the GENERATORS emit rather than
  // the table against itself: collapse the wording, and any two distinct emitted strings that
  // land on the same joint are the drift.
  const flatten = (s: string): string => s.toLowerCase().replace(/\beach\b/g, 'ea').replace(/\s+/g, ' ').trim();
  const byJoint = new Map<string, Map<string, string>>();
  for (const [spec, { where }] of emittedNailing()) {
    const k = flatten(spec);
    if (!byJoint.has(k)) byJoint.set(k, new Map());
    byJoint.get(k)!.set(spec, where);
  }
  const twins = [...byJoint.values()]
    .filter((variants) => variants.size > 1)
    .map((variants) => [...variants.entries()].map(([s, where]) => `${JSON.stringify(s)} (${where})`).join('  vs  '));
  assert.deepEqual(twins, [], `one joint, two strings on the member cards:\n  ${twins.join('\n  ')}`);
});

test('the (PH) a crew reads and the ph the register reports cannot disagree', () => {
  for (const [key, d] of Object.entries(NAILING)) {
    const printsPending = (d.value as string).includes('(PH)');
    assert.equal(
      d.ph,
      printsPending,
      `NAILING.${key}: ph=${d.ph} but the emitted string ${printsPending ? 'does' : 'does not'} print (PH)`,
    );
  }
  // The four corrected on 2026-08-07 are cited, not pending — the whole point of correcting them.
  for (const key of ['capPlateLap', 'collarTie', 'sillAnchor', 'foundationWallAnchor'] as const) {
    assert.equal(NAILING[key].ph, false, `NAILING.${key} should carry a real citation`);
    assert.match(NAILING[key].cite, /^IRC /, `NAILING.${key} should cite the IRC section it was corrected against`);
  }
});

// ── The life-safety register: declaring a role is not measuring it ────────────
//
// A row on the packet's LS table says the build rests on that value, and for a LIMIT that reads
// as "and it was held to it". Three separate rows have now named a member the check they point
// at never looked at: the hip's bird's-mouth seat, the hip and jack rafters' spans, and a tail
// joist at CEILING level, which the floor table skipped for sitting above the deck and the
// ceiling table skipped for not being called `joist`. Every one was found by hand, and two of
// them grew back after the round that fixed the one before. So the register is held to the
// corpus instead — the same card-and-panel walk the nailing register above is proved against.
//
// TWO THINGS HAVE TO HOLD, AND IT IS THE SECOND THAT KEEPS REGROWING.
//
//   Every role a limit declares is one its named check is SEEN to measure. A role no check
//   reaches is a row printed for an examination that never happened.
//
//   And no member the register claims falls through EVERY branch. That is the shape all three
//   failures had: the role was declared, most members of it were measured, and a whole class of
//   them was measured by nothing while the row printed on the packet of the build holding them.
//
// A role a check genuinely cannot reach is declared `unmeasured` WITH ITS REASON rather than
// dropped, and that declaration is held to account in both directions: a role called unmeasurable
// that the check turns out to measure fails here as loudly as a role called measured that it does
// not. Silence is what let the first three through.
//
// AND THE DECLARATION IS NOT A WAY OUT OF THE FIRST TWO. It was, briefly, and it let the tail
// joist straight back in: take the branch out of `spans.ts`, move `tailJoist` from `roles` to
// `unmeasured` with a sentence, and the whole section went green. Two things made that work, and
// both are gone. The exemplars were collected from what the register CLAIMED, so a declaration
// deleted its own evidence; they are now collected from what the generators emit, which no line of
// the register can touch. And "unmeasurable" was judged by asking whether the check measures the
// role — a question that answers itself the moment somebody removes the branch. It is now judged
// against the member and the doctrine table instead: a role whose members carry a length and wear
// a nominal the limit's own table lists is a role that limit CAN rate, so it must, and no sentence
// is accepted in place of the branch.

/** One exemplar of a distinct thing `spanWarnings` could be asked about, for EVERY role emitted. */
interface SpanClass {
  member: Member;
  family: string;
  spacing: { joistSpacingIn: number; rafterSpacingIn: number };
  floorTopY: number;
  where: string;
  /**
   * How far the members of this class stand from the nearest PARALLEL member of their own role at
   * their own level, in inches — the spacing a repetitive-member table's COLUMNS are indexed by,
   * measured off the emitted geometry.
   *
   * `null` when no build in the corpus put a second parallel member of the role beside this one,
   * and null is read below as "nothing measured says this is not a repetitive member", which keeps
   * the class in the evidence. The SMALLEST distance any build produced is the one kept, for the
   * same reason: this figure may only ever be a reason to drop a class from the evidence, so the
   * measurement that keeps it there wins.
   */
  neighbourSpacingIn: number | null;
}

interface LsWalk {
  /** Role → the families that emit it, so a family-scoped row is judged inside its own scope. */
  rolesByFamily: Map<string, Set<string>>;
  /** `check|role|cite` some build produced on its own, with nothing rigged. */
  observed: Set<string>;
  /**
   * Roles `birdsMouth.ts` derives a seat for — its subject list, warning or not.
   *
   * WHY THIS ONE IS NOT SELF-VALIDATING, WHICH THE SPAN SIDE WAS. It is read off `seatCutsFor`
   * over every member of every build, and `seatCutsFor` has never heard of `LS_CONSUMERS`: nothing
   * anybody writes in the register can add to it or take from it. That is exactly what the span
   * side lacked — there, declaring a role unmeasurable used to delete its exemplars and so delete
   * the evidence, and the declaration came out true by construction. A seat declaration cannot
   * touch its own refutation; it can only be true when the module really does not seat the role.
   *
   * AND THE GEOMETRY IS NOT A BETTER CRITERION HERE, WHICH IS WHY THE SUBJECT LIST IS THE ONE USED.
   * The obvious analogue of the span criterion — "would `seatCutFor` return a cut for this member
   * if the list allowed?" — gives the wrong answer for the hip. Squash a hip roof to a 4 ft plan
   * and its hips swing to within 17° of a wall line, `runAxisOf` snaps them onto that axis, and the
   * primitive duly returns a notch. It is not the hip's joint: a hip meets its plates canted, and
   * a seat solved as though it ran square to one is a number, not a measurement. What decides the
   * seat check's reach is whether the cut it derives IS the member's joint, which is a modelling
   * judgment `birdsMouth.ts` states in the open and the viewer draws.
   */
  seated: Set<string>;
  spanClasses: Map<string, SpanClass>;
}

/**
 * Everything `spanWarnings` reads when deciding whether a member is measured AT ALL: the role
 * picks the branch, which side of the deck it sits on picks which joist table, and the nominal
 * picks the row. The family rides along so a family-scoped row is never judged on another
 * family's members. Everything else about a member only moves the number, so one exemplar
 * answers for its whole class — and the one kept is the LONGEST, because length is the lever the
 * probe below pulls and the shortest jack at a hip corner is a 1.4 ft stub that is still well
 * inside its row at four times that. Keeping the first member seen made the probe report the two
 * jack classes as measured by nothing, which is a false alarm in the gate written to stop them.
 */
function spanClassKey(family: string, m: Member, floorTopY: number): string {
  const where = m.position[1] > floorTopY + 1e-6 ? 'above the deck' : 'on the deck';
  return `${family} · ${m.role} · ${m.nominal} · ${where}`;
}

function newLsWalk(): LsWalk {
  return { rolesByFamily: new Map(), observed: new Set(), seated: new Set(), spanClasses: new Map() };
}

/**
 * What the app emits, recorded WITHOUT consulting the register.
 *
 * NOTHING WRITTEN IN `LS_CONSUMERS` MAY NARROW THIS. The walk used to keep a class only for roles
 * some span row claimed, which handed the register a way to delete the evidence against itself:
 * moving a role out of `roles` and into `unmeasured` removed its exemplars, removed them from every
 * probe, and left the declaration with nothing that could contradict it — so declaring a role
 * unmeasurable made it unmeasurable. The corpus is what the generators produced; the register is
 * the claim being tested against it, and a claim does not get to choose its own evidence.
 */
function recordLs(w: LsWalk, model: StructureModel, where: string): void {
  const family = model.spec.family;
  const floorTopY = model.levels.subfloorTop;
  const byClass = new Map<string, Member[]>();
  for (const m of model.members) {
    const key = spanClassKey(family, m, floorTopY);
    byClass.set(key, [...(byClass.get(key) ?? []), m]);
  }
  /** Nearest parallel member of the same role at the same level, in plan — see `neighbourSpacingIn`. */
  const gapIn = (key: string, m: Member): number | null => {
    let best: number | null = null;
    for (const o of byClass.get(key)!) {
      if (o === m) continue;
      if (![0, 1, 2].every((i) => Math.abs((o.rotation[i] ?? 0) - (m.rotation[i] ?? 0)) < 1e-6)) continue;
      const d = Math.hypot(o.position[0] - m.position[0], o.position[2] - m.position[2]) * IN_PER_FT;
      if (d > 1e-6 && (best === null || d < best)) best = d;
    }
    return best;
  };
  for (const m of model.members) {
    if (!w.rolesByFamily.has(m.role)) w.rolesByFamily.set(m.role, new Set());
    w.rolesByFamily.get(m.role)!.add(family);
    const key = spanClassKey(family, m, floorTopY);
    const prev = w.spanClasses.get(key);
    const gap = gapIn(key, m);
    const seen = [prev?.neighbourSpacingIn, gap].filter((v): v is number => typeof v === 'number');
    const neighbourSpacingIn = seen.length > 0 ? Math.min(...seen) : null;
    const base = !prev || m.cutLength > prev.member.cutLength
      ? { member: m, family, spacing: model.spec.spacing, floorTopY, where }
      : prev;
    w.spanClasses.set(key, { ...base, neighbourSpacingIn });
  }
  for (const s of spanWarnings(model.members, model.spec.spacing, floorTopY)) w.observed.add(`span|${s.role}|${s.cite}`);
  for (const s of seatDepthWarnings(model.members)) w.observed.add(`seat|${s.role}|${s.cite}`);
  const byId = new Map(model.members.map((m) => [m.id, m]));
  for (const id of seatCutsFor(model.members).keys()) w.seated.add(byId.get(id)!.role);
}

/** The citation a warning carries when it was raised against this register value. */
const lsCites = new Map<string, string>();
function citeFor(id: string): string {
  if (lsCites.size === 0) {
    for (const e of lifeSafetyRegister()) {
      lsCites.set(e.id, citeOf({ value: e.value, cite: e.cite, ph: e.ph, lifeSafety: true }));
    }
  }
  return lsCites.get(id)!;
}

/**
 * Whether the span check MEASURES a class — which is not whether it warns about one. A member
 * inside its row is silent and so is a member no branch ever reaches, and from outside the two
 * are the same silence. Pulling the one lever the check reads — the member's own length — tells
 * them apart: a class still silent at EIGHT times its length is a class nothing is looking at.
 *
 * EIGHT BECAUSE FOUR WAS NOT ENOUGH FOR THE SHORTEST CLAIMED MEMBER, MEASURED. The factor has to
 * clear the longest exemplar of every class the register claims over its own row, and the binding
 * case is the attic scuttle's doubled ceiling header: 2.5 ft of 2x6 against a 13.5 ft row, which
 * needs 6× before it says a word. Measured over the whole corpus, the factors the claimed classes
 * actually need run 1 to 6 (the floor's 2x8 header joist needs 2, a 3.8 ft floor joist over its
 * 9.5 ft row needs 3, most need 1), so eight clears the worst by a third and nothing here is
 * tuned to a single build. Raising it can only make the probe see MORE: every test below reads
 * "measured" as a reason to demand a branch or refuse a declaration, never as a reason to excuse
 * one.
 */
const spanProbe = (c: SpanClass): SpanWarning[] =>
  spanWarnings([{ ...c.member, cutLength: c.member.cutLength * 8 }], c.spacing, c.floorTopY);

/**
 * The plan run a span row is read against, derived here from the member alone.
 *
 * A span table row is a PLAN dimension — feet measured on the ground, not along a sloping stick —
 * and every member carries the pitch to reduce its length to one. Restated here rather than
 * borrowed from `spans.ts` on purpose: what follows has to be able to disagree with the check.
 */
const planRunOf = (m: Member): number => (m.cutLength / IN_PER_FT) * Math.abs(Math.cos(m.rotation[2] ?? 0));

/**
 * The doctrine table a span row IS. `SPAN.ceilingJoist` is read on `SPAN.ceilingJoist`.
 *
 * AND IT HAS TO BE A TABLE OF NOMINALS, WHICH IS WHY THAT IS CHECKED HERE AND NOT ASSUMED. Every
 * span row that ships is keyed on the member's size, and everything below reads it that way —
 * `hasOwnProperty(table, nominal)`. A table keyed on anything else (clear-span feet, a load class)
 * would still be FOUND by this function, match no member's nominal, and hand back an empty
 * evidence list — which reads as "nothing contradicts the declaration" and lets it stand. That is
 * fail-OPEN, in the one function whose whole job is to refuse a false declaration, so the shape of
 * the table is a precondition rather than a hope: a table this section cannot read nominal by
 * nominal is one it cannot hold a claim up with, and it says so instead of going quiet.
 */
function spanTableOf(id: string): Record<string, unknown> | undefined {
  const [group, key] = id.split('.');
  if (group !== 'SPAN' || !key) return undefined;
  const d = (SPAN as unknown as Record<string, { value: unknown } | undefined>)[key];
  return d && typeof d.value === 'object' && d.value !== null ? (d.value as Record<string, unknown>) : undefined;
}

/** Whether every row of a span table is a dimension-lumber nominal — see `spanTableOf`. */
const isKeyedOnNominals = (table: Record<string, unknown>): boolean => {
  const rows = Object.keys(table);
  return rows.length > 0 && rows.every((r) => DRESSED[r] !== undefined);
};

/**
 * Whether the table's rows are indexed by SPACING — the repetitive-member tables (a row per
 * nominal, a column per o.c. spacing) as against a flat one like `SPAN.header`, which is a single
 * allowable span per size and has no column to pick.
 */
const isSpacedTable = (table: Record<string, unknown>): boolean =>
  Object.values(table).every((row) => typeof row === 'object' && row !== null);

/**
 * Whether this class stands at a spacing the table has a COLUMN for — the second half of "can
 * this limit be read against this member", and the one the shipped code fudges.
 *
 * `columnFor` in `spans.ts` picks the nearest column at or above the member's spacing and falls
 * back to the WIDEST column when the spacing is past all of them. That fallback is fine for a
 * 12-in layout read at the 16-in row; it is not a reading for a member standing four feet from
 * its neighbour, because the allowance shrinks as the spacing grows and the widest column's
 * figure belongs to a member carrying a fraction of that strip. Handing it over would OVERSTATE what
 * the member may span, which is the direction that goes quiet on a real overload. So a class
 * whose measured neighbour spacing is past the table's widest column is one this table cannot
 * rate, and it is left out of the evidence below rather than being read at a column that is not
 * its own. A class with no measured spacing at all (`null`) stays in: silence is not evidence.
 */
function hasColumnFor(table: Record<string, unknown>, c: SpanClass): boolean {
  if (!isSpacedTable(table) || c.neighbourSpacingIn === null) return true;
  const columns = Object.values(table)
    .flatMap((row) => Object.keys(row as Record<string, unknown>).map(Number))
    .filter((n) => Number.isFinite(n));
  return columns.length === 0 || c.neighbourSpacingIn <= Math.max(...columns) + 1e-6;
}

/**
 * Why this row cannot be held to account at all, or `null` when it can — a fact about the doctrine
 * table rather than about any member, so it is said once and in its own words.
 */
function spanTableObjection(id: string): string | null {
  const table = spanTableOf(id);
  if (!table) return `${id} names no span table of its own, so nothing here can hold that claim up`;
  if (!isKeyedOnNominals(table)) {
    return `${id} is keyed on ${Object.keys(table).slice(0, 3).join('/')}… rather than on nominals, so this `
      + 'section cannot read it member by member and cannot hold that claim up';
  }
  return null;
}

/**
 * The member classes this span limit COULD be read against — asked of the members and of the
 * limit's own table, and of nothing in `spans.ts`.
 *
 * THIS IS WHY A DECLARATION CANNOT SUBSTITUTE FOR A FIX. Asking "does the check measure this
 * role?" is the wrong question for an escape hatch, because that question answers itself: it is
 * true exactly when someone has broken or omitted the branch, which is the case the hatch must
 * refuse. The right question is whether the limit CAN be read against the member at all, and a
 * span limit needs two things and only two:
 *
 *   A NUMBER OF FEET. Every member has a position, a pitch and a cut length, so a plan run always
 *   exists, and the clear span the check derives from it — a bay between bearing lines, a run less
 *   its bearings — is bounded by it. Nothing about a member makes those feet unobtainable.
 *
 *   A ROW TO READ THEM ON, AND A COLUMN TO READ IT AT. The table is a list of nominals; a size
 *   that is not in it has no maximum here. THIS is the real limit of a span row's reach, and it is
 *   a doctrinal fact rather than a fact about the code: a bunker's 6x8 cap beam carried across a
 *   doorway cannot be rated by a table whose rows run 2x4 to 2x12, no matter what branch anyone
 *   writes. The repetitive tables carry a second index, the o.c. spacing, and it is the same kind
 *   of fact — see `hasColumnFor`.
 *
 * So: a role whose members are in this row's scope, carry a length, and wear a nominal the row's
 * own table lists at a spacing it has a column for is a role this limit must MEASURE. Declaring it
 * unmeasurable is refused, and the refusal names the class, because the fix is a branch or a
 * narrower scope — never a sentence.
 */
function ratableSpanClasses(w: LsWalk, id: string, c: LsConsumer, role: string): string[] {
  const table = spanTableOf(id);
  if (!table || spanTableObjection(id)) return [];
  const out: string[] = [];
  for (const [key, cls] of w.spanClasses) {
    if (cls.member.role !== role) continue;
    if (c.families && !(c.families as readonly string[]).includes(cls.family)) continue;
    if (!Object.prototype.hasOwnProperty.call(table, cls.member.nominal)) continue;
    if (!hasColumnFor(table, cls)) continue;
    const run = planRunOf(cls.member);
    if (!(run > 0) || !Number.isFinite(run)) continue;
    out.push(`${key} runs ${run.toFixed(1)} ft and ${cls.member.nominal} is a row of this very table`);
  }
  return out;
}

/**
 * Every test below passes trivially against an empty walk, so the walk is asserted before it is
 * read. A refactor that quietly narrowed the corpus — or a `recordLs` that stopped recording —
 * would otherwise leave the whole section green while proving nothing at all.
 */
function assertCorpusIsReal(w: LsWalk): void {
  // WHAT THE AGGREGATE FLOORS CAN SEE, AND WHAT THEY DEMONSTRABLY CANNOT. The walk produces 70
  // member roles, 208 member classes, 7 unaided check results and 2 seated roles, and the four
  // floors below sit just under those. They catch a walk that stopped walking — a corpus narrowed
  // to the catalog presets drops the class count from 208 to 152 and fires three of them — and
  // nothing finer than that. A NARROWING AIMED AT ONE ROLE GOES STRAIGHT THROUGH: making
  // `recordLs` skip `tailJoist` members alone takes the classes from 208 to 205 and leaves the
  // roles, the unaided results and the seated roles untouched, which is measured, not supposed. So
  // the evidence these tests actually read is pinned BY NAME as well, in two registers: the kinds
  // of unaided result, because that set is the only place a check is seen measuring a role on a
  // build the app really ships; and the member classes the sections below cite as the reason a
  // limit must be measured, because those are the exemplars a targeted narrowing would delete —
  // the four roles a framed opening is built from, on both decks, and the hips of a build that has
  // nothing else on its roof.
  assert.ok(w.rolesByFamily.size > 60, `the walk saw ${w.rolesByFamily.size} member roles across every card and panel`);
  assert.ok(w.spanClasses.size > 180, `the walk found ${w.spanClasses.size} distinct member classes`);
  assert.ok(w.observed.size > 5, `the corpus raised ${w.observed.size} kinds of check result unaided`);
  assert.ok(w.seated.size > 1, `the seat check derived seats for ${w.seated.size} roles in the corpus`);
  const kinds = new Set([...w.observed].map((o) => o.split('|').slice(0, 2).join('|')));
  for (const kind of ['span|joist', 'span|rafter', 'span|jackRafter', 'span|hipRafter', 'seat|rafter', 'seat|jackRafter']) {
    assert.ok(kinds.has(kind), `no build the app ships raises ${kind} unaided any more — the corpus has lost its reach`);
  }
  for (const cls of [
    'building · joist · 2x8 · on the deck',
    'building · tailJoist · 2x8 · on the deck',
    'building · trimmerJoist · 2x8 · on the deck',
    'building · headerJoist · 2x8 · on the deck',
    'building · joist · 2x6 · above the deck',
    'building · tailJoist · 2x6 · above the deck',
    'building · trimmerJoist · 2x6 · above the deck',
    'building · headerJoist · 2x6 · above the deck',
    'tower · hipRafter · 2x6 · above the deck',
  ]) {
    assert.ok(w.spanClasses.has(cls), `the corpus no longer contains "${cls}" — the evidence below has been narrowed away`);
  }
}

test('every role the life-safety register declares is a role some shipped build emits', () => {
  // A declaration for a member the app cannot produce is a row that can never print, and it
  // reads to the next person as coverage that is already in place.
  const w = lsWalk();
  assertCorpusIsReal(w);
  const orphans: string[] = [];
  for (const [id, c] of Object.entries(LS_CONSUMERS)) {
    for (const role of c.roles) {
      const inScope = [...(w.rolesByFamily.get(role) ?? [])]
        .filter((f) => !c.families || (c.families as readonly string[]).includes(f));
      if (inScope.length === 0) {
        orphans.push(`${id} declares ${role}, emitted by ${[...(w.rolesByFamily.get(role) ?? ['nothing'])].join('/')}`);
      }
    }
  }
  assert.deepEqual(orphans, [], `consumer roles no build in scope emits:\n  ${orphans.join('\n  ')}`);
});

test('every role a life-safety LIMIT declares is a role its named check is seen to measure', () => {
  // The register's own invariant, enforced instead of asserted in a comment. Seat roles are
  // proved by builds that warn about them unaided; span roles by the length probe, because a
  // shipped design staying inside its table is the design working, not the check looking.
  const w = lsWalk();
  assertCorpusIsReal(w);
  const measured = new Set(w.observed);
  for (const c of w.spanClasses.values()) for (const s of spanProbe(c)) measured.add(`span|${s.role}|${s.cite}`);

  const unmeasured: string[] = [];
  for (const [id, c] of Object.entries(LS_CONSUMERS)) {
    if (!c.checkedBy) continue;
    for (const role of c.roles) {
      if (measured.has(`${c.checkedBy}|${role}|${citeFor(id)}`)) continue;
      unmeasured.push(`${id} declares ${role} and no build's ${c.checkedBy} check ever measured one`);
    }
  }
  assert.deepEqual(
    unmeasured,
    [],
    `life-safety rows promising a check nobody performs:\n  ${unmeasured.join('\n  ')}`,
  );
});

test('no member a SPAN limit claims falls through every branch of the span check', () => {
  // The fail-open the other two rounds left behind, and the reason this one is written per
  // MEMBER CLASS rather than per role: a tail joist at ceiling level is the same declared role as
  // one on the deck, and only one of the two was ever measured.
  //
  // Span only, and deliberately: what decides whether the seat check reaches a member is the
  // geometry of the roof it is on, not anything the class key holds, so the seat limit's reach is
  // proved by the two tests either side of this one instead of by a class walk that would look
  // exhaustive and not be.
  //
  // At least one claimant, not all of them: the floor row and the ceiling row both name `joist`,
  // and any given joist belongs to exactly one of the two tables by where it sits.
  const w = lsWalk();
  assertCorpusIsReal(w);
  const rows = Object.entries(LS_CONSUMERS).filter(([, c]) => c.checkedBy === 'span');
  const fallen: string[] = [];
  for (const [key, c] of w.spanClasses) {
    const claimants = rows.filter(([, r]) =>
      (r.roles as readonly string[]).includes(c.member.role)
      && (!r.families || (r.families as readonly string[]).includes(c.family)));
    if (claimants.length === 0) continue;
    const cites = new Set(spanProbe(c).map((s) => s.cite));
    if (claimants.some(([id]) => cites.has(citeFor(id)))) continue;
    fallen.push(
      `${key}: claimed by ${claimants.map(([id]) => id).join(' and ')}, measured by `
      + `${[...cites].join(' | ') || 'NOTHING'} (e.g. ${c.where})`,
    );
  }
  assert.deepEqual(
    fallen,
    [],
    'member classes a life-safety row claims and no branch measures — give them a branch, scope '
    + `the row off them, or declare them unmeasured with a reason:\n  ${fallen.join('\n  ')}`,
  );
});

/**
 * The member kind a name is about: the last word of a camelCase role or doctrine key. A
 * `trimmerJoist` is a joist, a `jackRafter` is a rafter, and `SPAN.ceilingJoist` is a table of
 * joists — the emitters and the doctrine table name the same member the same way, and that is the
 * only thing the test below reads to decide which limit governs which member.
 */
const kindOf = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ').pop()!.toLowerCase();

/**
 * Which span limits could be read against this member class — asked of the GENERATORS and the
 * doctrine tables, and of nothing anybody wrote in the register.
 */
function spanLimitsOver(cls: SpanClass): string[] {
  const out: string[] = [];
  for (const key of Object.keys(SPAN)) {
    const id = `SPAN.${key}`;
    const table = spanTableOf(id);
    if (!table || !isKeyedOnNominals(table)) continue;
    if (kindOf(key) !== kindOf(cls.member.role)) continue;
    if (!Object.prototype.hasOwnProperty.call(table, cls.member.nominal)) continue;
    if (!hasColumnFor(table, cls)) continue;
    const run = planRunOf(cls.member);
    if (!(run > 0) || !Number.isFinite(run)) continue;
    out.push(id);
  }
  return out;
}

test('every member a SPAN table can be read on is claimed by some life-safety row, or disclaimed by one', () => {
  // THE THIRD FORM OF THE SAME DEFECT, AND THE ONE THE OTHER THREE TESTS CANNOT SEE. They all
  // start from what the register SAYS: a declared role that nothing measures, a claimed class that
  // falls through, a disclaimed role the check reaches. None of them asks whether anything was
  // said at all. So the same tail joist that took two rounds to catch goes straight back in by
  // SILENCE — drop `tailJoist` from `roles` on both joist rows with no `unmeasured` entry, delete
  // both branches in `spans.ts`, and every one of those three passes, because a class with no
  // claimant is skipped and a role in no list is never looked up. It was not academic: with the
  // register saying `joist, tailJoist` and `LUMBER.joistNominal` saying `joist, tailJoist,
  // headerJoist, trimmerJoist`, the trimmer and the header of every framed opening in the tree —
  // the doubled members the opening's whole load runs through — were sized by doctrine, rated by
  // nothing, and named by no span row at all.
  //
  // SO THIS ONE STARTS FROM THE GENERATORS. Every class the walk emitted, every table that can be
  // read on it — the doctrine key and the member role name the same kind, the table has a row for
  // the nominal and a column for the spacing it stands at — and then, and only then, the register
  // is asked whether ANY row in that member's scope speaks for it. A row may claim it (`roles`,
  // and the three tests around this one then hold the claim to the check) or disclaim it
  // (`unmeasured`, and the test below refuses the disclaimer if the limit can in fact be read).
  // What it may not do is say nothing, which is the only state a reviewer cannot tell from an
  // oversight — because that is what it is.
  const w = lsWalk();
  assertCorpusIsReal(w);
  const rows = Object.entries(LS_CONSUMERS).filter(([, c]) => c.checkedBy === 'span');
  const unspoken: string[] = [];
  for (const [key, cls] of w.spanClasses) {
    const limits = spanLimitsOver(cls);
    if (limits.length === 0) continue;
    const speaksFor = rows.filter(([, r]) =>
      (!r.families || (r.families as readonly string[]).includes(cls.family))
      && [...r.roles, ...Object.keys(r.unmeasured ?? {})].includes(cls.member.role));
    if (speaksFor.length > 0) continue;
    unspoken.push(
      `${key} runs ${planRunOf(cls.member).toFixed(1)} ft and ${limits.join(' / ')} has a row for `
      + `${cls.member.nominal} at the spacing it stands at, and no life-safety row claims it or disclaims it `
      + `(e.g. ${cls.where})`,
    );
  }
  assert.deepEqual(
    unspoken,
    [],
    'members a life-safety span limit can be read against that no row names at all — claim them and '
    + `measure them, or say in the row why the limit cannot reach them:\n  ${unspoken.join('\n  ')}`,
  );
});

test('a role the register calls unmeasurable is one its check really CANNOT reach', () => {
  // The escape hatch, held shut against the thing it is easiest to use it for. Without this,
  // "declared unmeasurable" is a way to make the two tests above green by writing a sentence, and
  // the sentence goes onto the packet in front of the person signing it — worse than silence,
  // because it prints as a caveat where the check was in fact working perfectly well.
  //
  // CANNOT, NOT DOES NOT. That distinction is the whole load this test carries. "The check does
  // not measure this role" is not a fact about the role, it is a fact about the branch someone
  // wrote, and it becomes TRUE the moment they delete the branch — so a gate that asks it accepts
  // exactly the defect it exists to refuse. Every claim below is therefore held against something
  // the declaration itself cannot move: for a span, the member's own length and the row of the
  // limit's own table it wears (`ratableSpanClasses`); for a seat, the subject list `birdsMouth.ts`
  // derives its notches from, which no register edit can reach (see `LsWalk.seated` for why that
  // list, and not the geometry, is the right criterion on that side).
  const w = lsWalk();
  assertCorpusIsReal(w);
  // "Measured" is what the check is SEEN to do — its unaided warnings plus the length probe over
  // every class the app emits, which is now every class, claimed or not. A role the register has
  // written off that the probe still measures is a declaration contradicted by the check itself.
  const measured = new Set(w.observed);
  for (const c of w.spanClasses.values()) for (const s of spanProbe(c)) measured.add(`span|${s.role}|${s.cite}`);

  const wrong: string[] = [];
  for (const [id, c] of Object.entries(LS_CONSUMERS)) {
    for (const [role, why] of Object.entries(c.unmeasured ?? {})) {
      if (!c.checkedBy) wrong.push(`${id}: ${role} is called unmeasured with no check named to be unmeasurable by`);
      if ((c.roles as readonly string[]).includes(role)) wrong.push(`${id}: ${role} is listed as measured and unmeasured at once`);
      if (!why || why.length < 30) wrong.push(`${id}: ${role} is called unmeasured with no reason a reader could act on`);
      if (!w.rolesByFamily.has(role)) wrong.push(`${id}: ${role} is a caveat about a member no build has`);
      if (c.checkedBy && measured.has(`${c.checkedBy}|${role}|${citeFor(id)}`)) {
        wrong.push(`${id}: the ${c.checkedBy} check DOES measure ${role} — it belongs in roles, not here`);
      }
      if (c.checkedBy === 'span') {
        // The table-level objection is its OWN sentence. Folded into the per-class one it read as a
        // non-sequitur — "role carries everything this limit is read on — this row has no table —
        // so the limit CAN rate it" — and a refusal nobody can parse is a refusal that gets
        // argued with rather than acted on.
        const objection = spanTableObjection(id);
        if (objection) {
          wrong.push(`${id}: ${role} is called unmeasurable by a span check, but ${objection}`);
        }
        for (const evidence of ratableSpanClasses(w, id, c, role)) {
          wrong.push(
            `${id}: ${role} carries everything this limit is read on — ${evidence} — so the limit CAN rate it and `
            + 'must; give it a branch or scope the row off it, not a sentence',
          );
        }
      }
      if (c.checkedBy === 'seat' && w.seated.has(role)) {
        wrong.push(`${id}: birdsMouth.ts now derives a seat for ${role}, so the limit reaches it`);
      }
    }
  }
  // And the other direction on the seat side: every role the module DOES seat has to be accounted
  // for by the row that names it, one way or the other. A role added to `birdsMouth.ts`'s subject
  // list and not to the register is a member being measured against a life-safety limit that the
  // packet never tells its signer was measured — the same silence as the reverse, read the other
  // way round.
  for (const [id, c] of Object.entries(LS_CONSUMERS)) {
    if (c.checkedBy !== 'seat') continue;
    const accounted = new Set<string>([...c.roles, ...Object.keys(c.unmeasured ?? {})]);
    for (const role of w.seated) {
      if (!accounted.has(role)) wrong.push(`${id}: birdsMouth.ts seats ${role} and this row says nothing about it`);
    }
  }
  assert.deepEqual(wrong, [], `unmeasurable declarations that do not hold up:\n  ${wrong.join('\n  ')}`);
  // And the subject list itself, so "the check cannot reach it" is read off the module rather
  // than inferred from a silence that a broken check would also produce.
  assert.ok(w.seated.has('rafter') && w.seated.has('jackRafter'), 'the seat check seats nothing at all');
});
