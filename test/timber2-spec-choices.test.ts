// The last of the unguarded enums.
//
// `decodeSpec` takes any JSON with a `family` key, so every one of these is reachable from a
// pasted link — and a link is exactly where a typo, or a value from a later version of this tool,
// comes from. Ten fields took any string and said nothing. Nine fell through to whatever their
// generator's `else` happened to be; the tenth — the tent size — indexed a doctrine table with it
// and THREW, which is the failure `normalize.ts` calls the worst of the three: the shell renders,
// the spinner never stops, and the page looks like it is working.
//
// Two dead fields turned up in the same sweep:
//   `TowerSpec.cab.roofing` was declared, written by the preset and read by nothing — set it to
//   'roll' through a link and the cab still came out corrugated, byte for byte. The cab is the
//   tower's only roof, so what covers it is `coverings.roofing`, which is what the panel writes
//   and what `tower.ts` reads. The second field is gone.
//   `foundation.kind: 'embedded'` on a BUILDING fell through to a pier foundation, 926 members
//   byte-identical to `{kind:'piers'}`, and said nothing — the pyramid-roof case again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById, FAMILY_TABLE } from '../src/timber/catalog';
import type { StructureSpec } from '../src/timber/spec';

const CASES: { fam: string; path: string; ok: string[] }[] = [
  { fam: 'crib-bunker', path: 'entrance', ok: ['open', 'baffle'] },
  { fam: 'crib-bunker', path: 'wallType', ok: ['post-plank', 'crib'] },
  { fam: 'tower', path: 'access', ok: ['ladder', 'stair'] },
  { fam: 'tower', path: 'footing', ok: ['timber-mudsill', 'concrete-pad'] },
  { fam: 'tower', path: 'cab.walls', ok: ['open-rail', 'half-wall', 'half-wall-screen'] },
  { fam: 'tower', path: 'cab.roof', ok: ['pyramid', 'shed'] },
  { fam: 'platform', path: 'base', ok: ['piers', 'skids'] },
  { fam: 'platform', path: 'deck', ok: ['plank', 'panel'] },
  { fam: 'tent-floor', path: 'tent', ok: ['gpSmall', 'gpMedium', 'temper'] },
  { fam: 'gp-frame', path: 'bridging', ok: ['cross', 'solid'] },
];

const withPath = (fam: string, path: string, v: unknown): StructureSpec => {
  const spec = JSON.parse(JSON.stringify(familyById(fam as never)!.preset)) as Record<string, unknown>;
  const parts = path.split('.');
  let cur = spec;
  for (const k of parts.slice(0, -1)) { cur[k] = cur[k] ?? {}; cur = cur[k] as Record<string, unknown>; }
  cur[parts[parts.length - 1]!] = v;
  return spec as unknown as StructureSpec;
};

test('A CHOICE NOBODY WROTE IS REPAIRED AND SAID — on every family enum a link can reach', () => {
  for (const { fam, path, ok } of CASES) {
    const m = generateStructure(withPath(fam, path, 'nonsense'));
    const said = m.issues.find((i) => i.path === path);
    assert.ok(said, `${fam} ${path}: an unknown value is accepted in silence`);
    for (const v of ok) {
      assert.ok(said!.message.includes(v), `${fam} ${path}: the message does not name "${v}"`);
    }
    // And every legal value is left alone — a guard that repairs a real answer is worse than none.
    for (const v of ok) {
      assert.equal(generateStructure(withPath(fam, path, v)).issues.filter((i) => i.path === path).length, 0,
        `${fam} ${path}: "${v}" was repaired and should not have been`);
    }
  }
});

test('and NOTHING THROWS — a dead spinner is the worst of the three outcomes', () => {
  // The tent size indexed a doctrine table with whatever it was handed. `generateStructure` is
  // what the workbench calls; a throw here is a page that never stops loading.
  for (const { fam, path } of CASES) {
    for (const bad of ['nonsense', '', '__proto__', 'gpsmall']) {
      assert.doesNotThrow(() => generateStructure(withPath(fam, path, bad)), `${fam} ${path} = ${JSON.stringify(bad)}`);
    }
  }
});

test('THE CAB HAS ONE ROOFING FIELD, and it is the one the panel writes', () => {
  // Before: `cab.roofing` was declared on the spec, written by the preset, and read by nothing.
  const preset = familyById('tower')!.preset as unknown as { cab: Record<string, unknown>; coverings: Record<string, unknown> };
  assert.equal(preset.cab.roofing, undefined, 'the preset still writes a cab.roofing nobody reads');
  const sig = (roofing: string): string => {
    const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset)) as Record<string, unknown>;
    (spec.coverings as Record<string, unknown>).roofing = roofing;
    return generateStructure(spec as unknown as StructureSpec).members
      .filter((x) => x.role === 'roofingCourse')
      .map((x) => `${x.nominal}|${x.cutLength.toFixed(3)}`).join(';');
  };
  assert.notEqual(sig('roll'), sig('corrugated'), 'the tower cab ignores the roofing it is given');
  assert.ok(sig('roll').length > 0 && sig('corrugated').length > 0);
});

test('and a building asked for embedded posts is stood on piers, out loud', () => {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
  spec.foundation = { kind: 'embedded', embedFt: 3 };
  const m = generateStructure(spec as unknown as StructureSpec);
  const said = m.issues.find((i) => i.path === 'foundation.kind');
  assert.ok(said, "a building's embedded foundation is accepted in silence");
  assert.match(said!.message, /guard tower and the bunker/);
  assert.equal((m.spec as unknown as { foundation: { kind: string } }).foundation.kind, 'piers');
});

test('and every shipped card still normalizes with nothing to repair', () => {
  // The guard that matters most: a table-driven repair pass is one typo away from "fixing" a
  // preset. Every card must come through with no choice-repair issue at all.
  const paths = new Set([...CASES.map((c) => c.path), 'foundation.kind', 'coverings.roofDeck', 'shutters']);
  for (const fam of FAMILY_TABLE) {
    const m = generateStructure(JSON.parse(JSON.stringify(fam.preset)) as StructureSpec);
    const repaired = m.issues.filter((i) => paths.has(i.path));
    assert.equal(repaired.length, 0,
      `${fam.id}: ${repaired.map((i) => `${i.path} — ${i.message}`).join(' | ')}`);
  }
});
