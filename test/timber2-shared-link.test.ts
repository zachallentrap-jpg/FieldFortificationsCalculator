// The roof a SHARE LINK hands in.
//
// `decodeSpec` is the app's untrusted boundary and it is deliberately permissive: any JSON with a
// `family` key is accepted and goes straight to `generateStructure`. That is a reasonable design —
// links have to survive version drift — but it means `normalizeSpec` is the only thing standing
// between a pasted URL and the generator, and until this file existed it checked the roof's KIND
// and never its per-kind fields.
//
// Three holes, all measured by loading the link in a browser:
//
//   · no `roof` at all         — threw on `.kind`
//   · a kind outside the union — framed a building with NO ROOF and raised zero issues
//   · `shed` with no `highSide`— threw on `walls.surfaces.find(…)!` inside `generateShed`
//
// The thrown ones are the bad kind of broken: the workbench chrome renders, the viewport sits on
// "Laying out the frame…" forever, no canvas is ever created and nothing is said. It looks like a
// slow load rather than a dead page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { normalizeSpec } from '../src/timber/normalize';
import { decodeSpec } from '../src/ui/woodframe/router';
import { familyById, FAMILY_TABLE } from '../src/timber/catalog';
import { WALL_ORDER } from '../src/timber/spec';
import type { StructureSpec } from '../src/timber/spec';

/** The roof framing a building is supposed to end up with. If this is zero, there is no roof. */
const ROOF_FRAMING = new Set(['rafter', 'ridge', 'hipRafter', 'jackRafter', 'ponyStud', 'collarTie']);

function shared(roof: unknown): StructureSpec {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
  if (roof === undefined) delete spec.roof; else spec.roof = roof;
  // The cast is the point of the file: this is what comes off a share link, and the types do not
  // apply to it. `decodeSpec` returns `StructureSpec` on exactly the same faith.
  return spec as unknown as StructureSpec;
}

/** The roof of a spec that is known to be a building, without asking the union to prove it. */
const roofOf = (s: StructureSpec): { kind: string; highSide?: unknown } =>
  (s as unknown as { roof: { kind: string; highSide?: unknown } }).roof;

const framed = (spec: StructureSpec) => {
  const m = generateStructure(spec);
  return {
    model: m,
    roofPieces: m.members.filter((x) => ROOF_FRAMING.has(x.role)).length,
    paths: m.issues.map((i) => i.path),
  };
};

test('A SHED WITH NO HIGH SIDE BUILDS, and says which wall it took', () => {
  // Before: TypeError: Cannot read properties of undefined (reading 'runFt'). The panel always
  // writes `highSide: 'N'`, so only a hand-made link reached this — which is exactly the traffic
  // `decodeSpec` exists to accept.
  const { model, roofPieces, paths } = framed(shared({ kind: 'shed', risePer12: 4, overhangFt: 1 }));
  assert.ok(roofPieces > 0, 'a shed roof gets framed');
  assert.equal(roofOf(model.spec).kind, 'shed', 'it is still the roof the link asked for');
  assert.ok(paths.includes('roof.highSide'), `the repair is said out loud; issues were ${paths.join(',')}`);
  assert.ok(WALL_ORDER.includes(roofOf(model.spec).highSide as never));
});

test('and so does a shed whose high side is not a wall', () => {
  const { model, roofPieces, paths } = framed(shared({ kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'up' }));
  assert.ok(roofPieces > 0);
  assert.ok(paths.includes('roof.highSide'));
  assert.ok(WALL_ORDER.includes(roofOf(model.spec).highSide as never));
  const { issues } = normalizeSpec(shared({ kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'up' }));
  const said = issues.find((i) => i.path === 'roof.highSide')!;
  assert.match(said.message, /"up"/, 'the message names what was asked for');
});

test('a roof kind this tool cannot frame gets a gable AND a warning — it used to get silence', () => {
  // Measured before: 656 members, zero roof framing, zero issues. A building open to the sky with
  // nothing said, which is the same defect the pyramid note in normalize.ts was written about.
  const { model, roofPieces, paths } = framed(shared({ kind: 'dome', risePer12: 4, overhangFt: 1 }));
  assert.ok(roofPieces > 0, 'something got framed over the walls');
  assert.equal(roofOf(model.spec).kind, 'gable');
  assert.ok(paths.includes('roof.kind'), `no issue raised; got ${paths.join(',')}`);
});

test('a spec with no roof key at all builds instead of throwing', () => {
  for (const roof of [undefined, null, 'gable', 42, {}]) {
    const { roofPieces, paths } = framed(shared(roof));
    assert.ok(roofPieces > 0, `roof=${JSON.stringify(roof)} framed nothing`);
    assert.ok(paths.some((p) => p === 'roof' || p === 'roof.kind'),
      `roof=${JSON.stringify(roof)} was repaired in silence`);
  }
});

test('every kind the union really has still builds, untouched', () => {
  // The repairs must not fire on good input — that is the difference between a guard and a bug.
  const good: [string, unknown][] = [
    ['gable', { kind: 'gable', risePer12: 4, overhangFt: 1 }],
    ['shed', { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'E' }],
    ['hip', { kind: 'hip', risePer12: 4, overhangFt: 1 }],
    ['flat', { kind: 'flat', overhangFt: 1, drainPer12: 1 }],
    ['none', { kind: 'none' }],
  ];
  for (const [label, roof] of good) {
    const { model, paths } = framed(shared(roof));
    assert.equal(roofOf(model.spec).kind, label === 'none' ? 'none' : label);
    assert.ok(!paths.includes('roof') && !paths.includes('roof.kind') && !paths.includes('roof.highSide'),
      `${label} was "repaired" when it was already correct: ${paths.join(',')}`);
  }
  // A pyramid is the one kind that IS in the union and still gets downgraded, and that is older,
  // deliberate behaviour — a pyramid belongs to the tower cab. Pinned so the new guard above
  // cannot quietly take it over.
  const { model, paths } = framed(shared({ kind: 'pyramid', risePer12: 4, overhangFt: 1 }));
  assert.equal(roofOf(model.spec).kind, 'hip');
  assert.ok(paths.includes('roof.kind'));
});

test('repairing is idempotent: the repaired spec normalizes clean', () => {
  // `normalizeSpec` promises this for good specs; a repair that re-fires forever would warn on
  // every render of a build the user has since saved.
  for (const roof of [undefined, { kind: 'dome' }, { kind: 'shed', risePer12: 4, overhangFt: 1 }]) {
    const once = normalizeSpec(shared(roof));
    assert.ok(once.issues.length > 0, 'the first pass repairs something');
    const twice = normalizeSpec(once.spec);
    assert.deepEqual(twice.spec, once.spec, 'normalizing twice changes nothing');
    for (const p of ['roof', 'roof.kind', 'roof.highSide']) {
      assert.ok(!twice.issues.some((i) => i.path === p), `${p} re-fired on an already-repaired spec`);
    }
  }
});

test('the door really is this wide — decodeSpec passes a broken roof straight through', () => {
  // If this ever stops being true the tests above are guarding a door nobody can reach, and the
  // guard should be reconsidered rather than left in place on faith.
  const payload = Buffer.from(JSON.stringify({ family: 'building', roof: { kind: 'dome' } }), 'utf8')
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const back = decodeSpec(payload);
  assert.ok(back, 'a hand-made payload is accepted');
  assert.equal((back as { roof: { kind: string } }).roof.kind, 'dome', 'and is not validated on the way in');
});

// ── Whole sections, not just fields ──────────────────────────────────────────
//
// The roof cases above were found one field at a time, and the lesson written down at the time
// was that a fix written for one value leaves the set. So: delete each top-level key of the
// shipped preset in turn and see what the generator does. SIX of the eight threw.

import { SPEC_SECTION_FALLBACK, SPEC_SECTIONS, SPEC_SECTIONS_BUILDING, SPEC_SECTIONS_COMMON } from '../src/timber/spec';

const PRESET_KEYS = ['family', 'dims', 'spacing', 'coverings', 'stories', 'roof', 'foundation'] as const;

/** The preset with one key removed or nulled — what a link from an older version looks like. */
function without(key: string, mode: 'delete' | 'null'): StructureSpec {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
  if (mode === 'delete') delete spec[key]; else spec[key] = null;
  return spec as unknown as StructureSpec;
}

test('EVERY TOP-LEVEL SECTION CAN BE MISSING and the build still draws', () => {
  // Measured before: family, dims, spacing, coverings, stories and foundation all threw. Only
  // `roof` survived, and only because the previous pass had just fixed it.
  for (const key of PRESET_KEYS) {
    for (const mode of ['delete', 'null'] as const) {
      const spec = without(key, mode);
      const m = generateStructure(spec); // the assertion IS that this does not throw
      assert.ok(m.members.length > 100, `${key} ${mode}: only ${m.members.length} members`);
      assert.ok(m.issues.length > 0, `${key} ${mode} was repaired in silence`);
    }
  }
});

test('a spec carrying nothing but a family still builds, and says so once', () => {
  // The extreme of the same case. It must not stack one identical line per missing section.
  const spec = { family: 'building' } as unknown as StructureSpec;
  const m = generateStructure(spec);
  assert.ok(m.members.length > 100, `only ${m.members.length} members`);
  const sectionIssues = m.issues.filter((i) => i.path === 'spec' || (SPEC_SECTIONS as readonly string[]).includes(i.path));
  assert.equal(sectionIssues.length, 1, `expected one summary line, got ${sectionIssues.map((i) => i.path).join(',')}`);
  assert.match(sectionIssues[0]!.message, /how big|stands on|its roof/, 'it names what was missing');
});

test('a family this tool does not build is read as a framed building, out loud', () => {
  // `normalizeSpec` had no default case, so an unknown family fell off the end of the switch and
  // returned undefined — which the caller destructures. The error was not even about the spec.
  for (const family of [undefined, null, 'shack', 42]) {
    const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
    if (family === undefined) delete spec.family; else spec.family = family;
    const m = generateStructure(spec as unknown as StructureSpec);
    assert.ok(m.members.length > 100, `family=${JSON.stringify(family)} framed nothing`);
    assert.ok(m.issues.some((i) => i.path === 'family'), `family=${JSON.stringify(family)} was repaired in silence`);
  }
});

test('a foundation this tool does not pour becomes piers AND says so', () => {
  // `generateBuilding` falls through its foundation switch to piers, so an unrecognised kind came
  // out byte-identical to `{kind:'piers'}` with nothing said — the user asked for one thing and
  // got another with no way to tell.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
  spec.foundation = { kind: 'raft', crawlFt: 1.5 };
  const m = generateStructure(spec as unknown as StructureSpec);
  assert.equal((m.spec as unknown as { foundation: { kind: string } }).foundation.kind, 'piers');
  assert.ok(m.issues.some((i) => i.path === 'foundation.kind'), 'the substitution is stated');
  assert.match(m.issues.find((i) => i.path === 'foundation.kind')!.message, /"raft"/, 'and names what was asked for');
});

test('every foundation a BUILDING really has survives untouched', () => {
  // `'embedded'` is in the union and is NOT in this list, and the difference is the point. It
  // belongs to the guard tower and the bunker, whose posts are set in the ground; `generateBuilding`
  // has no branch for it and fell through to a pier foundation — 926 members byte-identical to
  // `{kind:'piers'}` — while normalization left the kind saying "embedded". This test used to
  // pin that: it asserted the union member survived, which was true, and said nothing about the
  // building being something else. It is now told, the same way a pyramid roof on a building is.
  const good: unknown[] = [
    { kind: 'piers', crawlFt: 1.5 }, { kind: 'wall', crawlFt: 1.5 },
    { kind: 'basement', depthFt: 7, stairs: true }, { kind: 'slab' },
    { kind: 'skids' },
  ];
  for (const foundation of good) {
    const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
    spec.foundation = foundation;
    const m = generateStructure(spec as unknown as StructureSpec);
    const kind = (foundation as { kind: string }).kind;
    assert.equal((m.spec as unknown as { foundation: { kind: string } }).foundation.kind, kind);
    assert.ok(!m.issues.some((i) => i.path === 'foundation.kind'), `${kind} was "repaired" when it was already correct`);
  }
});

test('THE FALLBACK IS NOT A SECOND CATALOG — it normalizes with no issues at all', () => {
  // This is what stops the repair values drifting away from the bounds the rest of the tool
  // declares. `normalize.ts` cannot import the catalog (catalog → hut → building → normalize is
  // already a chain), so the fallback is stated in `spec.ts`; this is the proof it is honest.
  const spec = { family: 'building', ...structuredClone(SPEC_SECTION_FALLBACK) } as unknown as StructureSpec;
  const { issues } = normalizeSpec(spec);
  assert.deepEqual(issues, [], `the fallback itself needs repairing: ${issues.map((i) => i.path).join(',')}`);
  const m = generateStructure(spec);
  assert.ok(m.members.length > 100, 'and it builds a real structure');
});

test('none of this fires on the shipped cards', () => {
  // A guard that "repairs" good input is just a bug with a warning attached.
  const REPAIR_PATHS = new Set([...SPEC_SECTIONS, 'spec', 'family', 'foundation.kind', 'roof.kind', 'roof.highSide']);
  for (const id of ['gp-frame', 'storage-shed', 'custom', 'tower', 'platform', 'tent-floor', 'strongback', 'crib-bunker']) {
    const fam = familyById(id as never);
    if (!fam) continue;
    const { issues } = normalizeSpec(JSON.parse(JSON.stringify(fam.preset)) as StructureSpec);
    const fired = issues.filter((i) => REPAIR_PATHS.has(i.path as never));
    assert.deepEqual(fired.map((i) => i.path), [], `${id} tripped a repair: ${fired.map((i) => i.message).join(' | ')}`);
  }
});

test('and the section repairs are idempotent too', () => {
  for (const key of PRESET_KEYS) {
    const once = normalizeSpec(without(key, 'delete'));
    assert.ok(once.issues.length > 0);
    const twice = normalizeSpec(once.spec);
    assert.deepEqual(twice.spec, once.spec, `${key}: normalizing twice changed the spec`);
    const REPAIR_PATHS = new Set([...SPEC_SECTIONS, 'spec', 'family', 'foundation.kind']);
    assert.deepEqual(twice.issues.filter((i) => REPAIR_PATHS.has(i.path as never)).map((i) => i.path), [],
      `${key}: a repair re-fired on an already-repaired spec`);
  }
});

test('a HUT is not a building — it needs three of the six sections, not all of them', () => {
  // Caught by an existing test rather than by this one, which is the point of writing it down.
  // The first cut applied the building's section list to every family, and the shipped sea-hut
  // preset has no `stories` key at all: a HutSpec carries `wallHeightFt` and derives the rest
  // from its variant. A guard that fires on a shipped card is a bug with a warning attached.
  const hut = FAMILY_TABLE.find((f) => f.preset.family === 'hut')!;
  assert.ok(!('stories' in (hut.preset as object)), 'the premise: a hut card carries no stories');
  const clean = normalizeSpec(JSON.parse(JSON.stringify(hut.preset)) as StructureSpec);
  assert.deepEqual(clean.issues.map((i) => i.path).filter((p) => (SPEC_SECTIONS as readonly string[]).includes(p)), []);
  // The three it DOES need are still repaired.
  for (const key of SPEC_SECTIONS_COMMON) {
    const spec = JSON.parse(JSON.stringify(hut.preset)) as Record<string, unknown>;
    delete spec[key];
    const m = generateStructure(spec as unknown as StructureSpec);
    assert.ok(m.members.length > 100, `hut without ${key} framed nothing`);
    assert.ok(m.issues.some((i) => i.path === key), `hut without ${key} was repaired in silence`);
  }
  // And the three it does not are left alone.
  for (const key of ['stories', 'roof', 'foundation']) {
    const spec = JSON.parse(JSON.stringify(hut.preset)) as Record<string, unknown>;
    delete spec[key];
    const m = generateStructure(spec as unknown as StructureSpec);
    assert.ok(!m.issues.some((i) => i.path === key), `hut "repaired" its optional ${key}`);
  }
  assert.equal(SPEC_SECTIONS_BUILDING.length, SPEC_SECTIONS_COMMON.length + 3);
});

test('no shipped card in the whole catalog trips any of these repairs', () => {
  const REPAIR_PATHS = new Set([...SPEC_SECTIONS_BUILDING, 'spec', 'family', 'foundation.kind', 'roof.kind', 'roof.highSide']);
  for (const f of FAMILY_TABLE) {
    const { issues } = normalizeSpec(JSON.parse(JSON.stringify(f.preset)) as StructureSpec);
    const fired = issues.filter((i) => REPAIR_PATHS.has(i.path as never));
    assert.deepEqual(fired.map((i) => i.path), [], `${f.id}: ${fired.map((i) => i.message).join(' | ')}`);
  }
});
