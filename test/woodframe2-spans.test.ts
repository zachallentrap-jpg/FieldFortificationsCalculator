// TIMBER-2 T8 — span checks. Mandate #2: WARN, never silently resize.
//
// The assertions that matter here are the two failure modes a span checker has. It can cry
// wolf — condemning the standard design the tool itself ships, which teaches people to ignore
// it — or it can go quiet on a member that is genuinely over. Both are tested.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spanWarnings, summarizeSpanWarnings } from '../src/woodframe/spans';
import { generateStructure } from '../src/woodframe/families/index';
import { familyById, shippedFamilies } from '../src/woodframe/catalog';
import { headerForSpan } from '../src/woodframe/normalize';
import { citeOf, LUMBER, SPAN } from '../src/woodframe/doctrine';
import { DRESSED } from '../src/woodframe/types';
import { LS_CONSUMERS } from '../src/woodframe/packet/lsgate';

const preset = (id: string) => JSON.parse(JSON.stringify(familyById(id as never)!.preset));

test('no shipped standard design condemns itself', () => {
  // A checker that fires on the tool's own presets is a checker people learn to scroll past.
  for (const family of shippedFamilies()) {
    const model = generateStructure(preset(family.id));
    const over = model.issues.filter((i) => i.kind === 'span');
    assert.deepEqual(over, [], `${family.id}: ${over.map((i) => i.message).join(' | ')}`);
  }
});

test('a joist over a centre girder is checked on its CLEAR span, not its length', () => {
  // FM 5-426 puts a girder down the middle for exactly this reason. A 20-ft joist over one
  // girder spans 10 ft twice; checking it as 20 would condemn every building this tool makes.
  const spec = preset('gp-frame');
  spec.dims.widthFt = 20;
  const model = generateStructure(spec);
  assert.equal(model.issues.filter((i) => i.kind === 'span' && i.message.includes('joist')).length, 0);
});

test('a joist genuinely past its table warns, and says nothing was resized', () => {
  // Rigged directly rather than through a family, because the engine's own joist sizing already
  // steps a wide floor up to 2x10 — which is correct, and means a family-level fixture would be
  // testing that sizing rather than this checker. A 2x6 over a 12-ft clear span is the case.
  const joist = {
    id: 'T-1', role: 'joist' as const, nominal: '2x6', actual: { w: 1.5, d: 5.5 },
    cutLength: 144, position: [0, 0, 6] as [number, number, number],
    rotation: [0, -Math.PI / 2, 0] as [number, number, number], stage: 3 as never,
    grade: 'No. 2 common', nailing: 'x', doctrineRef: 'x',
  };
  const warnings = spanWarnings([joist], { joistSpacingIn: 16, rafterSpacingIn: 16 });
  assert.equal(warnings.length, 1);
  // 10 ft: FM 5-426 Table 6-2, Group I without plastered ceiling, 2x6 @ 16 in o.c.
  assert.equal(warnings[0]!.allowedFt, 10);
  assert.ok(warnings[0]!.message.includes('has NOT changed it'), 'the message must say nothing was resized');
});

test('an added bearing line makes the same joist pass — the checker reads the WORST bay', () => {
  const joist = {
    id: 'T-1', role: 'joist' as const, nominal: '2x6', actual: { w: 1.5, d: 5.5 },
    cutLength: 144, position: [0, 0, 6] as [number, number, number],
    rotation: [0, -Math.PI / 2, 0] as [number, number, number], stage: 3 as never,
    grade: 'No. 2 common', nailing: 'x', doctrineRef: 'x',
  };
  const girder = { ...joist, id: 'T-2', role: 'girder' as const, nominal: '2x10', position: [0, 0, 6] as [number, number, number] };
  assert.equal(spanWarnings([joist, girder], { joistSpacingIn: 16, rafterSpacingIn: 16 }).length, 0);
});

test('a rafter is checked on its horizontal run, not its sloped length', () => {
  // Otherwise a steep roof condemns itself for being steep: the same building at 12-in-12 would
  // warn where at 2-in-12 it did not, on a rafter carrying the same load over the same span.
  const shallow = preset('gp-frame');
  shallow.roof.risePer12 = 2;
  const steep = preset('gp-frame');
  steep.roof.risePer12 = 12;
  const count = (s: unknown) => generateStructure(s as never).issues.filter((i) => i.kind === 'span' && i.message.includes('rafter')).length;
  assert.equal(count(shallow), count(steep), 'pitch alone must not change the rafter verdict');
});

test('identical members collapse into one line with a count', () => {
  const warnings = spanWarnings(
    [1, 2, 3].map((n) => ({
      id: `T-${n}`, role: 'joist' as const, nominal: '2x6', actual: { w: 1.5, d: 5.5 },
      cutLength: 240, position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number], stage: 3 as never,
      grade: 'No. 2 common', nailing: 'x', doctrineRef: 'x',
    })),
    { joistSpacingIn: 24, rafterSpacingIn: 16 },
  );
  assert.equal(warnings.length, 3);
  const lines = summarizeSpanWarnings(warnings);
  assert.equal(lines.length, 1, 'three identical warnings are one sentence, not three');
  assert.ok(lines[0]!.startsWith('3× '));
});

test('headers are sized by span, and never smaller than the doctrine default', () => {
  // The floor matters as much as the ceiling here. The first cut of headerForSpan returned the
  // smallest row that fit, which quietly shaved every 3-ft window from a 2x6 to a 2x4 —
  // weakening the standard design in the name of a check meant to catch openings that are too
  // WIDE. Both directions are pinned.
  assert.equal(headerForSpan(3), LUMBER.headerNominal.value, 'a standard window keeps the standard header');
  assert.equal(headerForSpan(0.5), LUMBER.headerNominal.value, 'and so does a vent');
  assert.equal(headerForSpan(8), '2x10', 'an 8-ft opening gets what the table says it needs');
  assert.equal(headerForSpan(10), '2x12');
  assert.equal(headerForSpan(40), '2x12', 'past the table it hands back the deepest row rather than extrapolating');
});

test('an opening that names its own header keeps it', () => {
  // A spec that names a member is a decision somebody made, and sizing must not overrule it.
  const spec = preset('gp-frame');
  spec.stories[0].openings.S[0].headerNominal = '2x12';
  const model = generateStructure(spec);
  assert.ok(model.members.some((m) => m.role === 'header' && m.nominal === '2x12'));
});

// ── Header span: the sizer and the checker have to mean the same word ────────
//
// A header is CHOSEN by `headerForSpan(openingWidth)` — a clear span between bearings — and then
// CUT to that width plus a jack stud at each end. The checker read the cut length against the
// same table, so an opening landing exactly on a table row was condemned by three inches of its
// own bearing: the tool picked a 2x6 for a 5-ft opening and then reported "2x6 header spans
// 5.3 ft; the table allows 5 ft ... LIFE-SAFETY, review required" against its own choice. That
// is the cry-wolf failure the module header says it exists to prevent, aimed at the module.

/** The header warnings a gp-frame with one door of this width produces. */
function headerWarningsFor(widthFt: number): { warnings: string[]; nominal: string | undefined } {
  const spec = preset('gp-frame');
  spec.stories[0].openings.S = [
    { kind: 'door', offsetFt: 4, widthFt, heightFt: 6, sillHeightFt: 0, fill: 'rough' },
  ];
  const model = generateStructure(spec);
  return {
    warnings: model.issues.filter((i) => i.kind === 'span' && i.message.includes('header')).map((i) => i.message),
    nominal: model.members.find((m) => m.role === 'header')?.nominal,
  };
}

test('an opening sized exactly to a table row does not condemn the header the tool just chose', () => {
  // Every row boundary in SPAN.header, which is where the off-by-two-bearings error lands.
  for (const widthFt of Object.values(SPAN.header.value as Record<string, number>)) {
    const { warnings, nominal } = headerWarningsFor(widthFt);
    assert.deepEqual(warnings, [], `a ${widthFt} ft opening got a ${nominal} and was then warned about it`);
  }
});

test('a header genuinely past its table still warns, on the CLEAR span', () => {
  // The other half of the fix: the checker must not have gone quiet. `headerForSpan` stops at the
  // deepest row rather than extrapolating, so an opening past it gets a 2x12 that really is over.
  const { warnings, nominal } = headerWarningsFor(12);
  assert.equal(nominal, '2x12', 'past the table the sizer hands back the deepest row');
  assert.equal(warnings.length, 1);
  // 12.0, not the 12.25 ft the header is cut to: the number reported is the span being checked.
  assert.match(warnings[0]!, /spans 12\.0 ft/, warnings[0]);
  assert.match(warnings[0]!, /has NOT changed it/);
});

// ── One role, several joints: the bearing is the emitter's to declare ────────
//
// "Header" is worn by four different members. A doorway header is cut to the rough opening plus a
// JACK STUD each side. A beam over an open front runs post CENTRELINE to post centreline, so each
// end has half a post under it and none of the wood is spare. A bunker's entrance header lands on
// jamb timbers. Subtracting one fixed bearing from all of them reports the wrong clear span for
// three of the four — under-reporting a beam's span is the direction that goes quiet on a real
// overload — so the member says what it was cut to bear on and the checker reads it.

test('a beam over an open bay is checked on the span between its POSTS, not a doorway’s bearing', () => {
  // The expectation comes from the emitted POSTS — centre spacing less one post face, which is
  // what the beam actually clears — so nothing here restates the checker's own arithmetic. The
  // beam is re-labelled to a nominal the table condemns, because the open front's own bay rule
  // keeps every shipped beam inside its row (that is the design working, not the check).
  const spec = preset('storage-shed');
  spec.openFront = 'S';
  const model = generateStructure(spec);
  const beams = model.members.filter((m) => m.role === 'header' && m.wall === 'S');
  const posts = model.members.filter((m) => m.role === 'post' && m.wall === 'S').sort((a, b) => a.position[0] - b.position[0]);
  assert.ok(beams.length > 0 && posts.length >= 2, 'the open front framed no beam on posts');

  const beam = beams.find((b) => Math.abs(b.position[0] - (posts[0]!.position[0] + posts[1]!.position[0]) / 2) < 0.5)!;
  assert.ok(beam, 'no beam spanning the first bay');
  const clearFt = posts[1]!.position[0] - posts[0]!.position[0] - posts[0]!.actual.d / 12;

  const undersized = { ...beam, nominal: '2x6', actual: DRESSED['2x6']! };
  const warnings = spanWarnings([undersized], { joistSpacingIn: 16, rafterSpacingIn: 16 });
  assert.equal(warnings.length, 1, 'a 2x6 across a whole bay must be reported');
  assert.ok(
    Math.abs(warnings[0]!.spanFt - clearFt) < 0.02,
    `posts leave ${clearFt.toFixed(3)} ft clear; the checker reported ${warnings[0]!.spanFt.toFixed(3)} ft`,
  );
  // And that is genuinely NOT the doorway shape: a jack stud each side would report a longer span
  // than the beam has, which is the number that would have been printed on a life-safety line.
  const doorwayShape = (beam.cutLength - 2 * DRESSED[LUMBER.studNominal.value as string]!.w) / 12;
  assert.ok(Math.abs(doorwayShape - clearFt) > 0.02, 'the two shapes have become the same number — this proves nothing');
});

test('a doorway header keeps the doorway bearing when its emitter says nothing', () => {
  // The FROZEN wall generator cannot be given a field to carry, so absence has to keep meaning
  // "cut to the opening plus a jack each side". A 12-ft opening is a 12-ft clear span, stated by
  // the spec rather than recomputed from the member.
  const spec = preset('gp-frame');
  spec.stories[0].openings.S = [
    { kind: 'door', offsetFt: 4, widthFt: 12, heightFt: 6, sillHeightFt: 0, fill: 'rough' },
  ];
  const model = generateStructure(spec);
  const header = model.members.find((m) => m.role === 'header')!;
  assert.equal(header.bearingTotalIn, undefined, 'the frozen wall generator has started declaring a bearing');
  const warning = spanWarnings([header], { joistSpacingIn: 16, rafterSpacingIn: 16 })[0]!;
  assert.ok(Math.abs(warning.spanFt - 12) < 0.02, `a 12 ft opening reported as ${warning.spanFt.toFixed(2)} ft`);
});

// ── A joist above the deck is a ceiling joist, tails included ────────────────

test('a tail joist at CEILING level is measured, and on the ceiling table', () => {
  // An attic hatch frames its opening in the CEILING, so the two joists it cuts are ceiling
  // joists hung on a header. They fell between both branches — above the deck for the floor
  // table, not called `joist` for the ceiling one — so nothing measured them at any length,
  // while the register's floor row named `tailJoist` and the packet printed the joist span limit
  // as a value the build had been held to.
  const spec = preset('gp-frame');
  spec.atticAccess = true;
  const model = generateStructure(spec);
  const tails = model.members.filter((m) => m.role === 'tailJoist');
  assert.ok(tails.length > 0, 'the fixture frames no attic opening');
  for (const t of tails) {
    assert.ok(t.position[1] > model.levels.subfloorTop + 1e-6, 'these tails are meant to sit above the deck');
  }
  const over = tails.map((t) => ({ ...t, cutLength: t.cutLength * 4 }));
  const warned = spanWarnings(over, model.spec.spacing, model.levels.subfloorTop);
  assert.equal(warned.length, tails.length, `${tails.length} ceiling tail joists at four times their length warned ${warned.length} times`);
  assert.equal(warned[0]!.cite, citeOf(SPAN.ceilingJoist), 'measured, but against the floor table');
  // And it says TAIL joist: the crew has two short sticks at the hatch to look at, not every
  // joist in the ceiling.
  assert.match(warned[0]!.message, /ceiling tail joist spans/, warned[0]!.message);
});

// ── A hip roof's longest members ─────────────────────────────────────────────
//
// The commons are the SHORTEST sloping members of a hip roof. The jacks are commons cut back to
// the hip and sit on the same plates at the same spacing on the same slope; the hip runs the
// corner diagonal and is the longest stick on the building. A check scoped to `rafter` measured
// the short ones and the packet still printed the rafter span limit as a life-safety value the
// build had been held to — a warning that reads as an all-clear.

/** gp-frame at its own panel's widest, hipped at 12/12, laid out at 24 in o.c. */
function hipBuild(): ReturnType<typeof generateStructure> {
  const spec = preset('gp-frame');
  spec.dims.widthFt = 24;
  spec.spacing.rafterSpacingIn = 24;
  spec.roof = { kind: 'hip', risePer12: 12, overhangFt: 1 };
  return generateStructure(spec);
}

test('a hip roof is span-checked on its jacks and its hips, not only on its commons', () => {
  const model = hipBuild();
  const warnings = spanWarnings(model.members, model.spec.spacing, model.levels.subfloorTop);
  const warned = new Set(warnings.map((w) => w.role));
  for (const role of ['rafter', 'jackRafter', 'hipRafter'] as const) {
    const present = model.members.filter((m) => m.role === role).length;
    assert.ok(present > 0, `the fixture emits no ${role}`);
    assert.ok(warned.has(role), `${present} ${role} members, none of them measured: warned on ${[...warned].join(', ')}`);
  }
  // Each set is reported against its own members rather than folded into the commons. This roof
  // carries 26 commons, 40 jacks and 4 hips — 70 sloping sticks, 71 with the ridge — and a single
  // "26×" line over all of them sends the crew to the members that are not the problem.
  const lines = summarizeSpanWarnings(warnings);
  assert.ok(lines.some((l) => /\bjack rafter runs\b/.test(l)), lines.join(' | '));
  assert.ok(lines.some((l) => /\bhip rafter runs\b/.test(l)), lines.join(' | '));
});

test('a hip is measured on its diagonal RUN — not on its stick, and not on the common’s run', () => {
  // Equal pitches put the hip at 45° in plan, so its run is √2 × the common run and its own
  // pitch is shallower than the roof's. Reading the stick cries wolf; reading the common's run
  // misses the member entirely.
  const model = hipBuild();
  const warnings = spanWarnings(model.members, model.spec.spacing, model.levels.subfloorTop);
  const hip = warnings.find((w) => w.role === 'hipRafter')!;
  const commonRun = warnings.find((w) => w.role === 'rafter')!.spanFt;
  const stickFt = model.members.find((m) => m.id === hip.memberId)!.cutLength / 12;
  assert.ok(
    Math.abs(hip.spanFt - commonRun * Math.SQRT2) < 0.01,
    `hip run ${hip.spanFt.toFixed(3)} ft against a common run of ${commonRun.toFixed(3)} ft`,
  );
  assert.ok(hip.spanFt < stickFt - 3, `the ${stickFt.toFixed(2)} ft stick was read as the run`);
});

test('a jack inside its row stays quiet while the commons over theirs warn', () => {
  // The other failure mode. At 16 in o.c. the same roof's jacks are a bay shorter than its
  // commons and inside the table; a check that measured them by their SLOPED length — which is
  // what a missing pitch reads as — would condemn every one of them.
  const spec = preset('gp-frame');
  spec.dims.widthFt = 24;
  spec.roof = { kind: 'hip', risePer12: 12, overhangFt: 1 };
  const model = generateStructure(spec);
  const warnings = spanWarnings(model.members, model.spec.spacing, model.levels.subfloorTop);
  assert.ok(model.members.some((m) => m.role === 'jackRafter'), 'the fixture emits no jack rafters');
  assert.ok(warnings.some((w) => w.role === 'rafter'), 'the commons are supposed to be over here');
  assert.deepEqual(
    warnings.filter((w) => w.role === 'jackRafter').map((w) => w.spanFt),
    [],
    'jacks a bay shorter than the commons were condemned',
  );
});

test('every member role SPAN.rafter declares as its consumer is a role the check measures', () => {
  // The register's row says this value governed the build. A declared role the checker skips
  // makes that a false assurance — the row prints, and nothing was examined. Proved per role by
  // handing the check that role's own emitted member at four times its length: silence there
  // means the branch never sees it, whatever the table says.
  const model = hipBuild();
  for (const role of LS_CONSUMERS['SPAN.rafter']!.roles) {
    const member = model.members.find((m) => m.role === role);
    assert.ok(member, `the register declares ${role} and the fixture emits none`);
    const overlong = { ...member, cutLength: member.cutLength * 4 };
    const warned = spanWarnings([overlong], model.spec.spacing);
    assert.equal(
      warned.length, 1,
      `a ${role} at four times its length produced no warning, so the register's rafter-span row `
      + 'is an assurance nothing measured',
    );
  }
});

test('a tower cab’s hips are examined even though they pass — the row is earned, not assumed', () => {
  // The hips-only case. Nothing warns, and that has to be because the check LOOKED: a packet may
  // print the rafter span limit for a build of four hip rafters only if those four were measured.
  const tower = generateStructure(preset('tower'));
  const hip = tower.members.find((m) => m.role === 'hipRafter')!;
  assert.equal(tower.members.filter((m) => m.role === 'rafter').length, 0, 'the tower cab is no longer the hips-only case');
  assert.deepEqual(spanWarnings([hip], tower.spec.spacing), [], 'a cab hip is inside its row');
  const warned = spanWarnings([{ ...hip, cutLength: hip.cutLength * 4 }], tower.spec.spacing);
  assert.equal(warned.length, 1, 'a cab hip four times as long went unmeasured');
  assert.equal(warned[0]!.role, 'hipRafter');
});
