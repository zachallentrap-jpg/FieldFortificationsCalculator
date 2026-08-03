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
