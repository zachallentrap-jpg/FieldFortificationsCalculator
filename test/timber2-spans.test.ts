// TIMBER-2 T8 — span checks. Mandate #2: WARN, never silently resize.
//
// The assertions that matter here are the two failure modes a span checker has. It can cry
// wolf — condemning the standard design the tool itself ships, which teaches people to ignore
// it — or it can go quiet on a member that is genuinely over. Both are tested.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spanWarnings, summarizeSpanWarnings } from '../src/timber/spans';
import { generateStructure } from '../src/timber/families/index';
import { familyById, shippedFamilies } from '../src/timber/catalog';
import { headerForSpan } from '../src/timber/normalize';
import { LUMBER, SPAN } from '../src/timber/doctrine';
import { DRESSED } from '../src/timber/types';

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
  assert.equal(warnings[0]!.allowedFt, 9.5);
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

test('the checker measures clear span — the same bearing the generator cuts', () => {
  // Non-circular: the cut length comes off the emitted member, the reported span off the warning,
  // and the difference has to be the two jack studs the header bears on. Nothing here restates a
  // table value against itself.
  const spec = preset('gp-frame');
  spec.stories[0].openings.S = [
    { kind: 'door', offsetFt: 4, widthFt: 12, heightFt: 6, sillHeightFt: 0, fill: 'rough' },
  ];
  const model = generateStructure(spec);
  const header = model.members.find((m) => m.role === 'header')!;
  const reported = Number(/spans ([\d.]+) ft/.exec(
    model.issues.find((i) => i.kind === 'span' && i.message.includes('header'))!.message,
  )![1]);
  const bearingIn = DRESSED[LUMBER.studNominal.value as string]!.w;
  assert.ok(
    Math.abs((header.cutLength - 2 * bearingIn) / 12 - reported) < 0.05,
    `cut ${header.cutLength} in, reported ${reported} ft — the two bearings are unaccounted for`,
  );
});
