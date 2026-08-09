// TIMBER-2 — session store, routing, share codec, and the config schema (plan §8.5, §8.7).
//
// All of it pure: storage is injected, routes are strings in and objects out. The rules under
// test are the ones that only show themselves in bad conditions — a truncated write, a config
// from an older build, a shared link opened in a browser without CompressionStream.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSession, saveSession, commitBuild, nextCustomId, deleteBuild, unlockToCustom,
  buildFromFamily, emptySession, findBuild, recentBuilds, STORAGE_KEY, SESSION_VERSION,
  type StorageLike, type SessionState,
} from '../src/ui/woodframe/store';
import { parseRoute, routeToHash, encodeSpec, decodeSpec, stripUnshareable, isShareSafe } from '../src/ui/woodframe/router';
import { configSchemaFor, numericRows, schemaPaths, REGISTRY_NUMERIC_PATHS } from '../src/ui/woodframe/config';
import { specPath, type BuildingSpec, type BunkerSpec } from '../src/timber/spec';
import { shippedFamilies, familyById } from '../src/timber/catalog';
import { PLAIN, WHAT } from '../src/ui/woodframe/labels';
import { generateStructure } from '../src/timber/families/index';
import { specToJson } from '../src/timber/normalize';

function memStorage(seed?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (seed !== undefined) data.set(STORAGE_KEY, seed);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

// ── Routing ──────────────────────────────────────────────────────────────────

test('routes parse, and anything unknown falls back to the picker rather than a dead end', () => {
  assert.deepEqual(parseRoute(''), { name: 'picker' });
  assert.deepEqual(parseRoute('#/'), { name: 'picker' });
  assert.deepEqual(parseRoute('#/build/gp-frame'), { name: 'build', id: 'gp-frame' });
  assert.deepEqual(parseRoute('#/build/custom-3'), { name: 'build', id: 'custom-3' });
  assert.deepEqual(parseRoute('#/nonsense/deep/path'), { name: 'picker' });
  assert.deepEqual(parseRoute('#/build/'), { name: 'picker' }, 'a build route with no id is not a build route');
  assert.equal(routeToHash({ name: 'picker' }), '#/');
  assert.equal(routeToHash({ name: 'build', id: 'custom-2' }), '#/build/custom-2');
});

test('share payloads are recognized in both the plain and compressed forms', () => {
  const plain = parseRoute('#/build/custom-1?c=abc123');
  assert.deepEqual(plain, { name: 'build', id: 'custom-1', shared: { raw: 'abc123', compressed: false } });
  const zipped = parseRoute('#/build/custom-1?cz=xyz789');
  assert.deepEqual(zipped, { name: 'build', id: 'custom-1', shared: { raw: 'xyz789', compressed: true } });
});

test('a spec round-trips through the share codec', () => {
  const spec = familyById('gp-frame')!.preset;
  const decoded = decodeSpec(encodeSpec(spec));
  assert.ok(decoded, 'decode failed');
  assert.equal(specToJson(decoded!), specToJson(spec));
  // And it still builds after the trip.
  assert.ok(generateStructure(decoded!).members.length > 50);
});

test('garbage payloads decode to null instead of throwing at the user', () => {
  for (const bad of ['', 'not-base64!!', 'YWJj', toB64('{"nope":1}'), toB64('{')]) {
    assert.doesNotThrow(() => decodeSpec(bad));
  }
  assert.equal(decodeSpec('YWJj'), null, 'valid base64 that is not a spec is still null');
});
function toB64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

test('TD9: the stated cover depth is stripped from anything shareable, and only that', () => {
  const bunker: BunkerSpec = {
    family: 'bunker',
    dims: { lengthFt: 12, widthFt: 10 },
    spacing: { studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16 },
    coverings: { wallSheathing: 'none', siding: 'none', roofDeck: 'none', roofing: 'none' },
    interiorLengthFt: 10, interiorWidthFt: 8, clearHeightFt: 6,
    designCoverDepthFt: 3,
    wallType: 'post-plank', entrance: 'baffle',
  };
  const stripped = stripUnshareable(bunker) as Partial<BunkerSpec>;
  assert.equal(stripped.designCoverDepthFt, undefined, 'the one protection-adjacent number never leaves');
  assert.equal(stripped.clearHeightFt, 6, 'everything else survives');
  assert.equal(bunker.designCoverDepthFt, 3, 'and the caller\'s spec is untouched');
  assert.ok(isShareSafe(encodeSpecJson(bunker)), 'the encoded payload carries no cover depth');
  // A non-bunker spec is passed through unchanged.
  const b = familyById('custom')!.preset;
  assert.equal(stripUnshareable(b), b);
});
function encodeSpecJson(spec: BunkerSpec): string {
  return Buffer.from(decodeURIComponent(''), 'utf8').toString() + specToJson(stripUnshareable(spec));
}

// ── Session store ────────────────────────────────────────────────────────────

test('an empty or absent session loads clean', () => {
  assert.deepEqual(loadSession(memStorage()).state, emptySession());
  assert.deepEqual(loadSession(memStorage('')).state, emptySession());
});

test('boot revalidation: stored bytes are never trusted', () => {
  const cases: [string, string][] = [
    ['{ not json', 'unreadable'],
    ['null', 'unreadable'],
    ['{"version":999,"builds":[]}', 'different version'],
  ];
  for (const [seed, why] of cases) {
    const r = loadSession(memStorage(seed));
    assert.deepEqual(r.state.builds, [], `${why}: should degrade to empty`);
    assert.ok(r.notices.length > 0, `${why}: the user is told, non-blockingly`);
  }
});

test('an entry naming an unknown structure type is dropped with a notice, not a crash', () => {
  const seed = JSON.stringify({
    version: SESSION_VERSION,
    customSeq: 2,
    builds: [
      { id: 'ghost', familyId: 'not-a-family', spec: { family: 'building' } },
      { id: 'gp-frame', familyId: 'gp-frame', spec: familyById('gp-frame')!.preset },
    ],
  });
  const r = loadSession(memStorage(seed));
  assert.equal(r.state.builds.length, 1, 'the good entry survives');
  assert.equal(r.state.builds[0]!.id, 'gp-frame');
  assert.ok(r.notices.some((n) => /unknown structure type/.test(n)));
});

test('a stored spec is re-normalized on load, so an out-of-date config comes back buildable', () => {
  const wild = { ...(familyById('custom')!.preset as BuildingSpec), dims: { lengthFt: 9999, widthFt: 16 } };
  const seed = JSON.stringify({
    version: SESSION_VERSION, customSeq: 0,
    builds: [{ id: 'custom-1', familyId: 'custom', spec: wild }],
  });
  const r = loadSession(memStorage(seed));
  assert.equal((r.state.builds[0]!.spec as BuildingSpec).dims.lengthFt, 60, 'clamped on the way in');
  assert.ok(generateStructure(r.state.builds[0]!.spec).members.length > 0);
});

test('customSeq never decreases — a deleted id is never handed out again', () => {
  let state = emptySession();
  const a = nextCustomId(state);
  state = a.state;
  assert.equal(a.id, 'custom-1');
  const b = nextCustomId(state);
  state = b.state;
  assert.equal(b.id, 'custom-2');

  state = commitBuild(state, { id: 'custom-2', familyId: 'custom', spec: familyById('custom')!.preset }).state;
  state = deleteBuild(state, 'custom-2');
  assert.equal(findBuild(state, 'custom-2'), undefined, 'deleted');
  assert.equal(state.customSeq, 2, 'but the counter did not roll back');
  assert.equal(nextCustomId(state).id, 'custom-3', 'so the id is never reused');
});

test('customSeq survives a truncated write by reading the ids back', () => {
  // A crash between minting an id and writing the counter must not hand out a duplicate.
  const seed = JSON.stringify({
    version: SESSION_VERSION,
    customSeq: 0, // stale/lost
    builds: [{ id: 'custom-7', familyId: 'custom', spec: familyById('custom')!.preset }],
  });
  const r = loadSession(memStorage(seed));
  assert.equal(r.state.customSeq, 7, 'recovered from the ids present');
  assert.equal(nextCustomId(r.state).id, 'custom-8');
});

test('commit-on-valid: storage only ever holds a config that generates', () => {
  const state = emptySession();
  const good = commitBuild(state, buildFromFamily('gp-frame')!);
  assert.ok(good.committed);
  assert.ok(generateStructure(good.state.builds[0]!.spec).members.length > 0);
  // Round-trip through storage and back.
  const storage = memStorage();
  assert.ok(saveSession(storage, good.state));
  const reloaded = loadSession(storage);
  assert.equal(reloaded.state.builds.length, 1);
  assert.deepEqual(reloaded.notices, []);
});

test('a storage that throws (private mode, quota) degrades instead of breaking the app', () => {
  const hostile: StorageLike = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => { throw new Error('denied'); },
  };
  const r = loadSession(hostile);
  assert.deepEqual(r.state.builds, []);
  assert.ok(r.notices.length > 0);
  assert.equal(saveSession(hostile, emptySession()), false, 'save reports failure rather than throwing');
});

test('gap-6: unlocking NEVER changes family — a tower stays a tower', () => {
  let state = emptySession();
  for (const family of shippedFamilies()) {
    const source = buildFromFamily(family.id)!;
    state = commitBuild(state, source).state;
    const { state: after, build } = unlockToCustom(state, source);
    state = after;
    assert.equal(build.familyId, family.id, `${family.id}: unlock must preserve the family`);
    assert.ok(/^custom-\d+$/.test(build.id), `${family.id}: saved under a custom id`);
    assert.ok(/unlocked/i.test(build.label ?? ''), 'and labeled so the user can tell them apart');
    // It is a COPY — editing the unlocked one must not touch the original.
    assert.notEqual(build.spec, source.spec);
    assert.equal(specToJson(build.spec), specToJson(source.spec), 'same structure, different object');
  }
});

test('recentBuilds surfaces the most recently touched first', () => {
  let state = emptySession();
  state = commitBuild(state, { ...buildFromFamily('gp-frame')!, updatedAt: 100 }).state;
  state = commitBuild(state, { ...buildFromFamily('storage-shed')!, updatedAt: 300 }).state;
  state = commitBuild(state, { ...buildFromFamily('custom')!, updatedAt: 200 }).state;
  assert.deepEqual(recentBuilds(state).map((b) => b.id), ['storage-shed', 'custom', 'gp-frame']);
  assert.equal(recentBuilds(state, 2).length, 2);
});

// ── Config schema ────────────────────────────────────────────────────────────

test('every family gets a panel with real sections and no duplicate paths', () => {
  for (const family of shippedFamilies()) {
    const schema = configSchemaFor(family.id);
    assert.ok(schema.groups.length >= 3, `${family.id}: too few sections`);
    for (const g of schema.groups) {
      assert.ok(g.title.length > 0, `${family.id}: unnamed section`);
      // The word "Level" must not appear in visible copy (it collides with the design doc's
      // disclosure-level vocabulary and means nothing to a reader).
      assert.ok(!/\blevel\b/i.test(g.title), `${family.id}: "${g.title}" uses the word Level`);
    }
    // Duplicate paths are legal ONLY as conditional alternates — twin rows whose
    // applies-predicates can never both hold (the roof-deck row is one row under a gable,
    // another under the shapes that can take purlins). What must NEVER happen is two visible
    // controls editing the same path, so visibility is checked the way the renderer decides
    // it, against the preset spec and against every roof shape the family offers.
    const rows = schema.groups.flatMap((g) => g.rows);
    const count = new Map<string, number>();
    for (const r of rows) count.set(r.path, (count.get(r.path) ?? 0) + 1);
    for (const r of rows) {
      if ((count.get(r.path) ?? 0) > 1) {
        assert.ok(r.applies, `${family.id}/${r.path}: duplicate rows must be conditional alternates`);
      }
    }
    const preset = buildFromFamily(family.id)!.spec as { roof?: unknown };
    const variants: unknown[] = [preset];
    if (preset.roof || family.specBranch === 'hut') {
      variants.push(
        { ...preset, roof: { kind: 'gable', risePer12: 4, overhangFt: 1 } },
        { ...preset, roof: { kind: 'hip', risePer12: 4, overhangFt: 1 } },
        { ...preset, roof: { kind: 'shed', risePer12: 2, overhangFt: 1, highSide: 'N' } },
      );
    }
    for (const v of variants) {
      const visible = rows.filter((r) => !r.applies || r.applies(v)).map((r) => r.path);
      assert.equal(new Set(visible).size, visible.length, `${family.id}: duplicate VISIBLE control paths`);
    }
  }
});

test('§8.5: panel min/max EQUAL the clamp registry — the panel cannot offer an illegal value', () => {
  for (const family of shippedFamilies()) {
    for (const row of numericRows(configSchemaFor(family.id))) {
      const def = specPath(row.path);
      assert.ok(def, `${family.id}: ${row.path} is not in the path registry`);
      assert.equal(row.min, def!.min, `${family.id}/${row.path}: min disagrees with the clamp table`);
      assert.equal(row.max, def!.max, `${family.id}/${row.path}: max disagrees`);
    }
  }
});

test('every numeric control carries a citation, so a bound can be questioned', () => {
  for (const family of shippedFamilies()) {
    for (const row of numericRows(configSchemaFor(family.id))) {
      assert.ok((row.cite ?? '').length > 0, `${family.id}/${row.path}: no cite on a bounded value`);
    }
  }
});

test('select controls only offer options the family actually allows', () => {
  const gp = configSchemaFor('gp-frame');
  const roofRow = gp.groups.flatMap((g) => g.rows).find((r) => r.path === 'roof.kind')!;
  assert.deepEqual([...(roofRow.options ?? [])], [...familyById('gp-frame')!.roofs]);
});

test('TD38: openings are `preset` on standards and fully open on custom', () => {
  const std = configSchemaFor('gp-frame').groups.flatMap((g) => g.rows).find((r) => r.control === 'openings-editor')!;
  assert.equal(std.lock, 'preset', 'a standard design ships its openings editable but badged');
  const custom = configSchemaFor('custom').groups.flatMap((g) => g.rows).find((r) => r.control === 'openings-editor')!;
  assert.equal(custom.lock, undefined, 'custom locks nothing');
});

test('REGISTRY_NUMERIC_PATHS is the clamp surface, and the building panel covers the building part', () => {
  assert.ok(REGISTRY_NUMERIC_PATHS.length >= 15);
  const covered = new Set(numericRows(configSchemaFor('custom')).map((r) => r.path));
  for (const p of ['dims.lengthFt', 'dims.widthFt', 'stories.0.wallHeightFt', 'roof.risePer12', 'roof.overhangFt']) {
    assert.ok(covered.has(p), `custom must expose ${p} — it is the clean-sheet card`);
  }
});

// ── Labels ───────────────────────────────────────────────────────────────────

test('I-14: every role the engine emits has both a plain name and a what-it-does line', () => {
  const seen = new Set<string>();
  for (const family of shippedFamilies()) {
    for (const m of generateStructure(family.preset).members) seen.add(m.role);
  }
  // Plus the roof/foundation variants the presets do not cover.
  const custom = familyById('custom')!.preset as BuildingSpec;
  for (const roof of [
    { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'N' } as const,
    { kind: 'flat', overhangFt: 1, drainPer12: 1 } as const,
  ]) {
    for (const m of generateStructure({ ...custom, roof, foundation: { kind: 'skids' },
      coverings: { wallSheathing: 'plywood', siding: 'boardAndBatten', roofDeck: 'purlins', roofing: 'corrugated' } }).members) {
      seen.add(m.role);
    }
  }
  assert.ok(seen.size >= 20, `expected a broad role sample, saw ${seen.size}`);
  for (const role of seen) {
    assert.ok(PLAIN[role as keyof typeof PLAIN], `${role}: no plain-language name — the card would show a raw enum`);
    const what = WHAT[role as keyof typeof WHAT];
    assert.ok(what && what.length > 25, `${role}: the what-it-does line must actually explain it`);
  }
});

test('plain names read as carpentry, not as code', () => {
  for (const [role, name] of Object.entries(PLAIN)) {
    assert.ok(!/[A-Z]/.test(name.replace(/\(.*\)|X-|T-|SEA|SWA/g, '')), `${role}: "${name}" looks like an identifier`);
  }
});

test('NO ROOF, NO ROOF COVERINGS — the panel stops offering what cannot be built', () => {
  // The custom card offers `roof.kind: 'none'` — four walls and no roof at all. The engine builds
  // that correctly: zero roof members, and a stage plan that stops at the siding rather than
  // advertising roof stages nothing would fill. The PANEL went on offering "Roof deck", "Roofing"
  // and the felt toggle anyway, so you could pick corrugated for a building with nothing to nail
  // it to, watch nothing appear, and never be told why — while the spec kept the choice.
  //
  // Wall sheathing and siding must survive: a roofless building still has walls.
  const family = familyById('custom')!;
  const schema = configSchemaFor('custom');
  const pathsFor = (roofKind: string): string[] => {
    const spec = JSON.parse(JSON.stringify(family.preset));
    spec.roof = roofKind === 'none' ? { kind: 'none' } : { kind: roofKind, risePer12: 4, overhangFt: 1 };
    return schema.groups
      .flatMap((g) => g.rows)
      .filter((r) => !r.applies || r.applies(spec))
      .map((r) => r.path);
  };

  const withGable = pathsFor('gable');
  for (const p of ['coverings.wallSheathing', 'coverings.siding', 'coverings.roofDeck', 'coverings.roofing']) {
    assert.ok(withGable.includes(p), `a gable should still be offered ${p}`);
  }

  const withNone = pathsFor('none');
  for (const p of ['coverings.roofDeck', 'coverings.roofing', 'coverings.buildingPaper']) {
    assert.ok(!withNone.includes(p), `${p} must not be offered on a building with no roof`);
  }
  for (const p of ['coverings.wallSheathing', 'coverings.siding']) {
    assert.ok(withNone.includes(p), `${p} is a WALL covering — a roofless building still has walls`);
  }
  // And the roof picker itself stays, so the choice is reversible.
  assert.ok(withNone.includes('roof.kind'), 'the roof picker must remain');
});

test('a building with no roof builds no roof, and advertises no roof stages', () => {
  // The other half of the same case, on the engine side — recorded because it is what made the
  // panel's silence worth fixing rather than merely untidy.
  const spec = JSON.parse(JSON.stringify(familyById('custom')!.preset));
  spec.roof = { kind: 'none' };
  spec.coverings = { ...spec.coverings, roofDeck: 'plywood', roofing: 'corrugated' };
  const model = generateStructure(spec as never);
  // Named, not matched: a pattern loose enough to catch `ridgeCap` also catches `capPlate`,
  // which is the plate on top of a WALL and belongs on a roofless building.
  const ROOF_ROLES = new Set(['rafter', 'jackRafter', 'hipRafter', 'ridge', 'collarTie', 'purlin',
    'roofPanel', 'roofingCourse', 'ridgeCap', 'felt', 'fascia']);
  const roofish = model.members.filter((m) => ROOF_ROLES.has(m.role));
  assert.equal(roofish.length, 0, `no roof means no roof members, got ${roofish.map((m) => m.role).join(',')}`);
  const filled = new Set<number>(model.members.map((m) => m.stage as number));
  for (const e of model.stagePlan) {
    assert.ok(e.noMembers || filled.has(e.ordinal),
      `stage ${e.ordinal} (${e.key}) is advertised and empty — a dead stop on the scrubber`);
  }
});
