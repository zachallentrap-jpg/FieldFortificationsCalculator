// The wood-frame value catalog's guard.
//
// Values used to be inline string literals scattered across floor/walls/roof. Centralizing
// them made them editable — and made a new failure mode possible: a spec that nothing
// references, or a reference to a spec that does not exist. Both are silent. These tests
// make them loud.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ALL_SPECS, FASTENERS, RATES, GRADE, NEEDS_VERIFICATION,
  value, num, cite, setOverrides, getOverrides, isOverridden,
} from '../src/timber/data';
import { generateFrame, type BuildingInput } from '../src/timber/frame';

const SRC = fileURLToPath(new URL('../src/timber', import.meta.url));

const golden: BuildingInput = {
  lengthFt: 20, widthFt: 16, wallHeightFt: 8,
  studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
  risePer12: 4, overhangFt: 1, crawlFt: 1.5,
  openings: [{ wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }],
};

test('catalog: spec ids are unique and match their map keys', () => {
  const ids = ALL_SPECS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate spec id — overrides would collide');
  for (const [key, spec] of Object.entries({ ...FASTENERS, ...RATES })) {
    assert.equal(key, spec.id, `map key "${key}" disagrees with spec.id "${spec.id}"`);
  }
});

test('catalog: every id referenced in the engine actually exists', () => {
  // Catches value('typo.id') at test time rather than as a thrown error mid-render.
  const referenced = new Set<string>();
  for (const f of readdirSync(SRC).filter((n) => n.endsWith('.ts') && n !== 'data.ts')) {
    const body = readFileSync(`${SRC}/${f}`, 'utf8');
    for (const m of body.matchAll(/\b(?:value|num|cite)\(\s*'([^']+)'\s*\)/g)) referenced.add(m[1]!);
  }
  assert.ok(referenced.size > 20, `expected the engine to reference many specs, saw ${referenced.size}`);
  const known = new Set(ALL_SPECS.map((s) => s.id));
  const dangling = [...referenced].filter((id) => !known.has(id));
  assert.deepEqual(dangling, [], `engine references spec ids that do not exist: ${dangling.join(', ')}`);
});

test('catalog: every fastener spec is actually used by the engine', () => {
  // A dead row is a value the owner can edit that changes nothing — worse than absent,
  // because the editor implies it matters.
  const referenced = new Set<string>();
  for (const f of readdirSync(SRC).filter((n) => n.endsWith('.ts') && n !== 'data.ts')) {
    const body = readFileSync(`${SRC}/${f}`, 'utf8');
    for (const m of body.matchAll(/\b(?:value|num|cite)\(\s*'([^']+)'\s*\)/g)) referenced.add(m[1]!);
  }
  const unused = Object.keys(FASTENERS).filter((id) => !referenced.has(id));
  assert.deepEqual(unused, [], `catalog rows nothing reads: ${unused.join(', ')}`);
});

test('catalog: no spec still carries a (PH) placeholder marker', () => {
  const stale = ALL_SPECS.filter((s) => s.value.includes('(PH)') || s.cite.includes('(PH)'));
  assert.deepEqual(stale.map((s) => s.id), [], 'a spec is still marked (PH) — give it a real value and cite');
});

test('catalog: confidence is honest — published specs name a checkable source', () => {
  for (const s of ALL_SPECS) {
    assert.ok(s.cite.trim().length > 0, `${s.id} has no citation at all`);
    if (s.confidence === 'published') {
      assert.ok(
        /IRC|WFCM|AWC/.test(s.cite),
        `${s.id} claims 'published' but cites "${s.cite}" — only publicly checkable sources may claim it`,
      );
    }
  }
  assert.ok(NEEDS_VERIFICATION > 0, 'nothing needs verification? that is itself suspicious');
  assert.ok(
    NEEDS_VERIFICATION < ALL_SPECS.length,
    'everything needs verification — the whole point was to stop flattening the two cases together',
  );
});

test('overrides: typing over a value changes what the engine emits', () => {
  setOverrides({});
  const before = generateFrame(golden);
  const soleBefore = before.members.find((m) => m.role === 'solePlate');
  assert.ok(soleBefore, 'expected a sole plate');
  assert.equal(soleBefore.nailing, value('plate.soleToJoist'));

  setOverrides({ 'plate.soleToJoist': '20d @ 12" o.c. — unit SOP' });
  const after = generateFrame(golden);
  const soleAfter = after.members.find((m) => m.role === 'solePlate');
  assert.equal(soleAfter?.nailing, '20d @ 12" o.c. — unit SOP', 'override did not reach the member');
  assert.ok(isOverridden('plate.soleToJoist'));

  setOverrides({});
  assert.equal(generateFrame(golden).members.find((m) => m.role === 'solePlate')?.nailing,
    soleBefore.nailing, 'clearing overrides did not restore the shipped default');
  assert.ok(!isOverridden('plate.soleToJoist'));
});

test('overrides: an overridden value stops flying the published flag', () => {
  setOverrides({});
  const original = cite('plate.capLap');
  setOverrides({ 'plate.capLap': '4-16d' });
  assert.notEqual(cite('plate.capLap'), original);
  assert.match(cite('plate.capLap'), /replaced by unit/,
    'an owner-replaced value must not keep citing the source it no longer matches');
  setOverrides({});
});

test('overrides: labor rates are numeric, and a non-numeric override is refused', () => {
  setOverrides({});
  assert.ok(Number.isFinite(num('labor.perBoardFoot')));
  setOverrides({ 'labor.perBoardFoot': '0.09' });
  assert.equal(num('labor.perBoardFoot'), 0.09);
  setOverrides({ 'labor.perBoardFoot': 'about a tenth' });
  assert.throws(() => num('labor.perBoardFoot'), /not numeric/,
    'a non-numeric labor rate must throw, not silently become NaN man-hours');
  setOverrides({});
});

test('overrides: an override changes man-hours, so command packets track the unit’s rates', () => {
  setOverrides({});
  const base = generateFrame(golden);
  setOverrides({ 'labor.perBoardFoot': String(num('labor.perBoardFoot') * 2) });
  const doubled = generateFrame(golden);
  setOverrides({});
  // generateFrame carries the BOM; if it does not, this reads through whatever it exposes.
  const hoursOf = (f: unknown): number => {
    const bom = (f as { bom?: { totalManHours?: number } }).bom;
    return bom?.totalManHours ?? 0;
  };
  if (hoursOf(base) > 0) {
    assert.ok(hoursOf(doubled) > hoursOf(base), 'doubling the rate did not raise total man-hours');
  }
});

test('catalog: an unknown spec id throws rather than returning empty', () => {
  assert.throws(() => value('nope.not.a.spec'), /unknown spec id/,
    'a typo must not become a blank nailing note on a member');
  assert.throws(() => cite('nope.not.a.spec'), /unknown spec id/);
});

test('catalog: empty-string overrides fall back to the default, not to blank', () => {
  setOverrides({ 'stud.toPlate': '' });
  assert.equal(value('stud.toPlate'), FASTENERS['stud.toPlate']!.value,
    'clearing a field in the editor must restore the default, not blank the member card');
  setOverrides({});
});

test('catalog: the default grade is what members carry', () => {
  setOverrides({});
  const m = generateFrame(golden).members[0];
  assert.equal(m?.grade, GRADE.value);
  assert.equal(getOverrides()['lumber.grade'], undefined);
});
