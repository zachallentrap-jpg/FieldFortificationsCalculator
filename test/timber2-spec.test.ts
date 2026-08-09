// TIMBER-2 — spec, normalization and canonicalization (plan §8.5).
//
// The properties here are the ones the rest of the system leans on without checking:
// normalizing twice changes nothing, clamping is always REPORTED, the generate path never
// reorders openings (TD5), and the model does not depend on the order a spec's record keys
// happen to be in (I-15).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFrame, specFromBuildingInput, type BuildingInput } from '../src/timber/frame';
import { generateStructure } from '../src/timber/families/index';
import { normalizeSpec, canonicalizeSpec, specToJson, CLAMPED_PATHS } from '../src/timber/normalize';
import { SPEC_PATH_DEFS, SPEC_PATHS, WALL_ORDER, type BuildingSpec } from '../src/timber/spec';

const demo: BuildingInput = {
  lengthFt: 20, widthFt: 16, wallHeightFt: 8,
  studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
  risePer12: 4, overhangFt: 1, crawlFt: 1.5,
  openings: [
    { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    { wall: 'S', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
    { wall: 'N', offsetFt: 8.5, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
  ],
};

const spec = (): BuildingSpec => specFromBuildingInput(demo);

test('the migration table round-trips: BuildingInput → BuildingSpec keeps every field', () => {
  const s = spec();
  assert.equal(s.dims.lengthFt, demo.lengthFt);
  assert.equal(s.dims.widthFt, demo.widthFt);
  assert.equal(s.stories[0]!.wallHeightFt, demo.wallHeightFt);
  assert.deepEqual(s.spacing, { studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16 });
  assert.deepEqual(s.roof, { kind: 'gable', risePer12: 4, overhangFt: 1 });
  assert.deepEqual(s.foundation, { kind: 'piers', crawlFt: 1.5 });
  const totalOpenings = WALL_ORDER.reduce((a, w) => a + (s.stories[0]!.openings[w]?.length ?? 0), 0);
  assert.equal(totalOpenings, demo.openings.length, 'no opening lost in translation');
  // A sill above the plate is a window; flush with it, a door.
  assert.equal(s.stories[0]!.openings.S![0]!.kind, 'window');
  assert.equal(s.stories[0]!.openings.S![1]!.kind, 'door');
});

test('basement stairs default to TRUE, matching floor.ts (a default reproduced wrong is a silent behavior change)', () => {
  const s = specFromBuildingInput({ ...demo, foundation: 'basement' });
  assert.deepEqual(s.foundation, { kind: 'basement', depthFt: 7.5, stairs: true });
  const explicit = specFromBuildingInput({ ...demo, foundation: 'basement', stairs: false });
  assert.deepEqual(explicit.foundation, { kind: 'basement', depthFt: 7.5, stairs: false });
});

test('normalizeSpec is idempotent and reports nothing on an in-bounds spec', () => {
  const first = normalizeSpec(spec());
  assert.deepEqual(first.issues, [], 'the demo building is legal as-is');
  const second = normalizeSpec(first.spec);
  assert.deepEqual(second.spec, first.spec, 'normalizing twice must change nothing');
  assert.deepEqual(second.issues, []);
});

test('a story this engine cannot frame is dropped LOUDLY, not silently', () => {
  // The engine frames stories[0] and nothing else — the story loop and the second-floor
  // bearing are parked (TIMBER2_PLAN T6b, on its own descope ladder). Parking that is fine.
  // What was not fine: a two-story spec normalized with ZERO issues and then generated a
  // model byte-identical to the one-story it was not, so the picture, the cut list and the
  // packet all described a different building than the one asked for and nothing said so.
  const two = { ...spec(), stories: [(spec() as BuildingSpec).stories[0]!, { wallHeightFt: 8, openings: {} }] };
  const { spec: out, issues } = normalizeSpec(two as BuildingSpec);
  assert.equal((out as BuildingSpec).stories.length, 1, 'kept the story it can build');
  const told = issues.filter((i) => i.path === 'stories');
  assert.equal(told.length, 1, 'and said so exactly once');
  assert.equal(told[0]!.severity, 'warn');
  assert.match(told[0]!.message, /one story/i);
});

test('clamping is always VISIBLE — an out-of-range value comes back with an issue naming it', () => {
  const wild = { ...spec(), dims: { lengthFt: 400, widthFt: 1 } };
  const { spec: out, issues } = normalizeSpec(wild);
  assert.equal((out as BuildingSpec).dims.lengthFt, 60, 'clamped to the envelope max');
  assert.equal((out as BuildingSpec).dims.widthFt, 4, 'clamped to the envelope min');
  assert.equal(issues.length, 2);
  for (const i of issues) {
    assert.equal(i.kind, 'clamped');
    assert.ok(/Length|Width/.test(i.message), `issue should name the knob: ${i.message}`);
    assert.ok(i.path.startsWith('dims.'), i.path);
  }
});

test('an opening too wide for its wall is DROPPED as an error, never turned into NaN', () => {
  const s = spec();
  s.stories[0]!.openings.E = [{ kind: 'door', offsetFt: 0, widthFt: 30, heightFt: 6.7, sillHeightFt: 0 }];
  const { spec: out, issues } = normalizeSpec(s);
  assert.equal((out as BuildingSpec).stories[0]!.openings.E, undefined, 'impossible opening removed');
  const err = issues.find((i) => i.kind === 'dropped');
  assert.ok(err && err.severity === 'error', 'dropping an opening is an error-severity issue');
  // And the model still generates, finite everywhere.
  const model = generateStructure(s);
  for (const m of model.members) {
    for (const v of [...m.position, ...m.rotation, m.cutLength]) assert.ok(Number.isFinite(v), m.id);
  }
});

test('an opening that would run past the wall end is slid back, and says so', () => {
  const s = spec();
  s.stories[0]!.openings.S = [{ kind: 'window', offsetFt: 19, widthFt: 3, heightFt: 3, sillHeightFt: 3 }];
  const { spec: out, issues } = normalizeSpec(s);
  assert.equal((out as BuildingSpec).stories[0]!.openings.S![0]!.offsetFt, 17, '20 ft wall, 3 ft opening → 17');
  assert.ok(issues.some((i) => /past the end of wall S/.test(i.message)));
});

test('TD5: normalizeSpec never reorders same-wall openings, even at equal offsets', () => {
  const s = spec();
  s.stories[0]!.openings.S = [
    { kind: 'window', offsetFt: 14, widthFt: 3, heightFt: 3, sillHeightFt: 3 },
    { kind: 'door', offsetFt: 4, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
    { kind: 'window', offsetFt: 4, widthFt: 2, heightFt: 3, sillHeightFt: 3.5 },
  ];
  const out = normalizeSpec(s).spec as BuildingSpec;
  assert.deepEqual(
    out.stories[0]!.openings.S!.map((o) => [o.offsetFt, o.widthFt]),
    [[14, 3], [4, 3], [4, 2]],
    'input order preserved exactly — a sort here silently renumbers members',
  );
});

test('canonicalizeSpec DOES sort (total order with tie-breaks) and is used only off the generate path', () => {
  const s = spec();
  s.stories[0]!.openings.S = [
    { kind: 'window', offsetFt: 14, widthFt: 3, heightFt: 3, sillHeightFt: 3 },
    { kind: 'window', offsetFt: 4, widthFt: 3, heightFt: 3, sillHeightFt: 3 },
    { kind: 'window', offsetFt: 4, widthFt: 2, heightFt: 3, sillHeightFt: 3 },
  ];
  const canon = canonicalizeSpec(s) as BuildingSpec;
  assert.deepEqual(
    canon.stories[0]!.openings.S!.map((o) => [o.offsetFt, o.widthFt]),
    [[4, 2], [4, 3], [14, 3]],
    'sorted by offset then width — equal offsets still deterministic',
  );
  // The generate path is untouched by canonicalization.
  assert.deepEqual(
    (normalizeSpec(s).spec as BuildingSpec).stories[0]!.openings.S!.map((o) => o.offsetFt),
    [14, 4, 4],
  );
  // Two specs describing the same structure serialize identically, whatever order the
  // openings arrived in — that is what makes a share link and a golden hash stable.
  const shuffled: BuildingSpec = {
    ...s,
    stories: [{
      ...s.stories[0]!,
      openings: { ...s.stories[0]!.openings, S: [...s.stories[0]!.openings.S!].reverse() },
    }],
  };
  assert.equal(specToJson(shuffled), specToJson(s));
});

test('I-15: record key order never reaches the model — permuted openings generate identically', () => {
  const a = spec();
  // Rebuild the openings record with the keys inserted in the opposite order.
  const keys = Object.keys(a.stories[0]!.openings).reverse();
  const permuted: BuildingSpec['stories'][0]['openings'] = {};
  for (const k of keys) permuted[k as 'S' | 'N'] = a.stories[0]!.openings[k as 'S' | 'N'];
  const b: BuildingSpec = { ...a, stories: [{ ...a.stories[0]!, openings: permuted }] };
  assert.notDeepEqual(Object.keys(a.stories[0]!.openings), Object.keys(permuted), 'keys really are permuted');
  assert.deepEqual(generateStructure(b).members, generateStructure(a).members);
});

test('the path registry covers every clamp and carries bounds + labels', () => {
  assert.equal(new Set(SPEC_PATHS).size, SPEC_PATHS.length, 'no duplicate paths');
  for (const d of SPEC_PATH_DEFS) {
    assert.ok(d.label.length > 0, `${d.path}: needs a human label for the config panel`);
    if (d.min !== undefined && d.max !== undefined) {
      assert.ok(d.max > d.min, `${d.path}: max must exceed min`);
    }
  }
  // Every clamped path is in the registry by construction; assert the derived list agrees.
  for (const p of CLAMPED_PATHS) assert.ok(SPEC_PATHS.includes(p), `${p} missing from SPEC_PATHS`);
  assert.ok(CLAMPED_PATHS.length >= 15, 'the clamp surface should not silently shrink');
});

test('generateStructure returns the normalized spec — what was built, not what was asked for', () => {
  const model = generateStructure({ ...spec(), dims: { lengthFt: 999, widthFt: 16 } });
  assert.equal((model.spec as BuildingSpec).dims.lengthFt, 60);
  assert.ok(model.issues.length > 0, 'and the adjustment is reported');
  assert.ok(model.stagePlan.length > 0);
});

test('generateFrame and generateStructure are the same engine, not two paths', () => {
  assert.deepEqual(generateStructure(specFromBuildingInput(demo)).members, generateFrame(demo).members);
});
