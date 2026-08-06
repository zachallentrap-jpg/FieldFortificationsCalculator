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
import { familyById } from '../src/timber/catalog';
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
