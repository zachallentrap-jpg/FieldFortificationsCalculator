// A number that is not a number, on any knob in the registry.
//
// `clampPath` is the one place every numeric knob is checked against `SPEC_PATH_DEFS`. An
// out-of-range NUMBER is clamped into the range and warned about, which is right. A NON-number —
// missing, `null`, a string, `NaN`, all of which a share link or a saved plan can carry, because
// `decodeSpec` takes any JSON — returned **0**, and 0 is below the minimum of most of those paths.
//
// The bound is not decoration. The registry says so itself on the entry next door:
//
//     Floored at 1 ft, not 0.5: the built-up girder hangs a full 9 1/4 in BELOW the sill, so a
//     shallower crawl puts the girder posts underground — the sweep caught it as a negative post
//     length. The bound is geometry, not preference, and it is stated once here.
//
// Handing back 0 walked straight past every one of those bounds. Injecting `null` into each knob
// of each shipped card, 25 of the 66 combinations framed members with a NON-POSITIVE cut length:
//
//   gp-frame     stories.0.wallHeightFt   112     squad-hut   dims.widthFt              94
//   custom       stories.0.wallHeightFt    64     sea-hut     dims.widthFt              63
//   storage-shed stories.0.wallHeightFt    56     platform    ramp.widthFt              51
//   ... and nineteen more rows, on twelve of the fourteen cards
//
// The basement is the case that found it and the sharpest one. `{ kind: 'basement' }` off a link
// carries no depth; it came back at 0 against a stated range of 6–9 and framed five posts at
// −7.8 in and three stringers at −1.5 in, with the stair down from sixteen treads to five and the
// basement itself collapsed flat onto the slab — rendered, a building sitting on the ground with a
// stub of stair poking out of it. The same value written as the NUMBER 0 clamps to 6, says so, and
// renders a basement.
//
// So a non-number is now repaired into the path's own range, which is exactly what that number
// already gets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { shippedFamilies, familyById } from '../src/timber/catalog';
import { SPEC_PATH_DEFS } from '../src/timber/spec';
import type { SpecIssue } from '../src/timber/normalize';

/** Set `path` only if every parent object and the leaf are already there — no invented knobs. */
function setPath(o: Record<string, unknown>, path: string, v: unknown): boolean {
  const parts = path.split('.');
  let cur: Record<string, unknown> = o;
  for (const p of parts.slice(0, -1)) {
    const next = cur[p];
    if (next === undefined || next === null || typeof next !== 'object') return false;
    cur = next as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  if (!(last in cur)) return false;
  cur[last] = v;
  return true;
}

function getPath(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const p of path.split('.')) cur = (cur as Record<string, unknown> | undefined)?.[p];
  return cur;
}

/** The things a share link, a saved plan or a cleared input can put where a number belongs. */
const NOT_NUMBERS: [string, unknown][] = [
  ['null', null],
  ['a string', 'deep'],
  ['NaN', NaN],
  ['an object', {}],
];

const KNOBS = SPEC_PATH_DEFS.filter((d) => !d.path.includes('[]'));

test('NO KNOB HANDED A NON-NUMBER FRAMES A MEMBER WITH A NON-POSITIVE LENGTH', () => {
  let checked = 0;
  for (const f of shippedFamilies()) {
    for (const def of KNOBS) {
      for (const [label, v] of NOT_NUMBERS) {
        const spec = JSON.parse(JSON.stringify(f.preset)) as Record<string, unknown>;
        if (!setPath(spec, def.path, v)) continue;
        checked++;
        const members = generateStructure(spec as never).members;
        const bad = members.filter((m) => !(m.cutLength > 0));
        assert.equal(bad.length, 0,
          `${f.id} with ${def.path} = ${label}: ${bad.length} members of ${members.length} have a `
          + `non-positive cut length — ${[...new Set(bad.map((m) => `${m.role} ${m.cutLength.toFixed(1)} in`))]
            .slice(0, 4).join(', ')}`);
      }
    }
  }
  assert.ok(checked > 150, `${checked} card × knob × value combinations`);
});

test('and it is repaired INTO the range that path states, not to zero', () => {
  for (const f of shippedFamilies()) {
    for (const def of KNOBS) {
      const spec = JSON.parse(JSON.stringify(f.preset)) as Record<string, unknown>;
      if (!setPath(spec, def.path, null)) continue;
      const got = getPath(generateStructure(spec as never).spec, def.path);
      if (typeof got !== 'number' || !Number.isFinite(got)) continue; // this card never reads it
      assert.ok(def.min === undefined || got >= def.min,
        `${f.id} with ${def.path} = null resolved to ${got}, below the stated minimum ${def.min}`);
      assert.ok(def.max === undefined || got <= def.max,
        `${f.id} with ${def.path} = null resolved to ${got}, above the stated maximum ${def.max}`);
    }
  }
});

test('and it lands where the NUMBER zero already landed — one rule, not two', () => {
  // The thesis of the fix, stated as an equality: a value that is not a number is treated as out
  // of range like any other, so it resolves to the same thing and builds the same model. `NaN` is
  // the probe rather than `null`, because `NaN` survives the `??` defaults on the way in and so
  // reaches `clampPath` wherever the number would.
  for (const f of shippedFamilies()) {
    for (const def of KNOBS) {
      if (def.min === undefined) continue;
      const nan = JSON.parse(JSON.stringify(f.preset)) as Record<string, unknown>;
      const zero = JSON.parse(JSON.stringify(f.preset)) as Record<string, unknown>;
      if (!setPath(nan, def.path, NaN)) continue;
      setPath(zero, def.path, 0);
      const a = generateStructure(nan as never);
      const b = generateStructure(zero as never);
      const va = getPath(a.spec, def.path);
      if (typeof va !== 'number' || !Number.isFinite(va)) continue; // never read on this card
      assert.equal(va, getPath(b.spec, def.path),
        `${f.id}: ${def.path} = NaN resolved to ${String(va)} and = 0 resolved to `
        + `${String(getPath(b.spec, def.path))}`);
      assert.equal(a.members.length, b.members.length,
        `${f.id}: ${def.path} = NaN framed ${a.members.length} members and = 0 framed ${b.members.length}`);
    }
  }
});

test('THE BASEMENT, which is the case that found it', () => {
  const bare = (extra: Record<string, unknown> = {}) => {
    const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
    spec.foundation = { kind: 'basement', ...extra };
    return generateStructure(spec as never);
  };
  const depth = (r: ReturnType<typeof generateStructure>): unknown =>
    getPath(r.spec, 'foundation.depthFt');

  for (const [label, extra] of [
    ['no depth at all', {}],
    ['depth null', { depthFt: null }],
    ['depth "deep"', { depthFt: 'deep' }],
    ['depth NaN', { depthFt: NaN }],
  ] as [string, Record<string, unknown>][]) {
    const r = bare(extra);
    assert.equal(r.members.filter((m) => !(m.cutLength > 0)).length, 0,
      `basement with ${label}: members framed at a non-positive length`);
    const d = depth(r);
    assert.ok(typeof d === 'number' && d >= 6 && d <= 9,
      `basement with ${label}: depth came back ${JSON.stringify(d)}, outside the stated 6–9`);
    assert.ok(r.issues.some((i: SpecIssue) => i.path === 'foundation.depthFt'),
      `basement with ${label}: repaired silently`);
    // A basement is a basement: the stair down it is the whole stair, not a stub.
    const treads = r.members.filter((m) => m.role === 'tread').length;
    assert.ok(treads >= 14,
      `basement with ${label}: ${treads} treads — the stair collapsed with the basement`);
    // And it is the same building the number 0 gives.
    const asZero = bare({ depthFt: 0 });
    assert.equal(r.members.length, asZero.members.length,
      `basement with ${label}: ${r.members.length} members against ${asZero.members.length} for depth 0`);
  }
});

test('and what must NOT change: a good number, an out-of-range number, and every card', () => {
  // An in-range value is untouched and silent; an out-of-range NUMBER still clamps and still warns,
  // at the same severity, with the range in the message. None of that moved.
  for (const d of [6, 7.5, 9]) {
    const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
    spec.foundation = { kind: 'basement', depthFt: d, stairs: true };
    const r = generateStructure(spec as never);
    assert.equal(getPath(r.spec, 'foundation.depthFt'), d, `depth ${d} was moved`);
    assert.equal(r.issues.filter((i: SpecIssue) => i.path === 'foundation.depthFt').length, 0,
      `depth ${d} is in range and was complained about`);
  }
  for (const [d, want] of [[0, 6], [-5, 6], [5.9, 6], [9.1, 9], [20, 9]] as [number, number][]) {
    const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
    spec.foundation = { kind: 'basement', depthFt: d, stairs: true };
    const r = generateStructure(spec as never);
    assert.equal(getPath(r.spec, 'foundation.depthFt'), want, `depth ${d} clamped to something else`);
    const said = r.issues.filter((i: SpecIssue) => i.path === 'foundation.depthFt');
    assert.equal(said.length, 1, `depth ${d}: ${said.length} issues`);
    assert.equal(said[0]!.severity, 'warn', `depth ${d}: an out-of-range number is a warning`);
    assert.match(said[0]!.message, /outside 6–9/, `depth ${d}: ${said[0]!.message}`);
  }
  // And every shipped preset still comes out of normalization with nothing said about any knob.
  for (const f of shippedFamilies()) {
    const r = generateStructure(JSON.parse(JSON.stringify(f.preset)));
    const clamped = r.issues.filter((i: SpecIssue) => i.kind === 'clamped');
    assert.equal(clamped.length, 0,
      `${f.id} as shipped now raises ${JSON.stringify(clamped.map((i) => i.message))}`);
  }
});
