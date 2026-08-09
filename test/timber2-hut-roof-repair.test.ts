// A hut's roof, when the roof came from outside.
//
// `normalize.ts` states its own contract at the top of the block this is about: *"A thrown
// generator is the worst of the three: the shell renders, the spinner never stops, and the user is
// looking at a page that appears to be working. Everything below repairs and SAYS SO."* That block
// lives inside `normalizeBuilding`. `normalizeHut` is a different branch of the same switch, and it
// ran NONE of it — for six cards that each declare `gable`, `hip` AND `shed` in their own `roofs`
// list and hand the same `RoofSpec` to the same generator.
//
// Nine malformed roofs, sea hut against gp-frame, before:
//
//   shed with no highSide            THREW  TypeError: reading 'runFt'   the workbench spins for ever
//   shed with a bad highSide         THREW  the same
//   kind missing / not in the union
//     / roof not an object           a hut with NO ROOF — 0 rafters — and zero issues
//   pyramid (the tower cab's roof)   the same: 0 rafters, nothing said
//   risePer12 99, overhangFt −5      kept verbatim, unclamped, nothing said
//
// The gp-frame repaired and warned on all nine. Rendered from a hand-made share link, the sea hut
// with `roof.kind: 'shed'` gave the shell, the header, the doctrine note and a spinner reading
// "Laying out the frame…" with no canvas behind it.
//
// The repair is now one function, called from both branches. What stays different is the one thing
// that should: a building with NO roof at all gets a gable and a warning, because a building has to
// have one; a hut with no roof gets its variant's own, because `generateHut` supplies it and is
// right to.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById, shippedFamilies } from '../src/timber/catalog';
import type { SpecIssue } from '../src/timber/normalize';

/** Every hut card, and a building card as the control. */
const HUTS = ['sea-hut', 'swa-hut', 'b-hut', 'squad-hut', 'guard-shack', 'latrine'] as const;
const CONTROL = 'gp-frame' as const;
type CardId = (typeof HUTS)[number] | typeof CONTROL;

/** Roofs a share link, a saved plan or the fuzzer can hand in. `decodeSpec` takes any JSON. */
const MALFORMED: { label: string; roof: unknown }[] = [
  { label: 'not an object', roof: 'gable' },
  { label: 'kind missing', roof: { risePer12: 4, overhangFt: 1 } },
  { label: 'kind not in the union', roof: { kind: 'mansard', risePer12: 4, overhangFt: 1 } },
  { label: 'pyramid, which is the cab’s', roof: { kind: 'pyramid', risePer12: 4, overhangFt: 1 } },
  { label: 'shed with no high side', roof: { kind: 'shed', risePer12: 4, overhangFt: 1 } },
  { label: 'shed with a bad high side', roof: { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'up' } },
  { label: 'a 99 in 12 pitch', roof: { kind: 'gable', risePer12: 99, overhangFt: 1 } },
  { label: 'a negative overhang', roof: { kind: 'gable', risePer12: 4, overhangFt: -5 } },
];

const ROOF_KINDS = new Set(['gable', 'shed', 'flat', 'hip', 'none']);

function build(id: CardId, roof: unknown) {
  const spec = JSON.parse(JSON.stringify(familyById(id)!.preset)) as Record<string, unknown>;
  spec.roof = roof;
  return generateStructure(spec as never);
}

const roofOf = (m: ReturnType<typeof generateStructure>): Record<string, unknown> =>
  (m.spec as unknown as { roof: Record<string, unknown> }).roof;

test('NO ROOF A SHARE LINK CAN CARRY THROWS THE GENERATOR — on a hut either', () => {
  for (const id of [...HUTS, CONTROL]) {
    for (const { label, roof } of MALFORMED) {
      const m = build(id, roof);
      const got = roofOf(m);
      assert.ok(got && typeof got === 'object' && ROOF_KINDS.has(String(got.kind)),
        `${id} + ${label}: came back with roof ${JSON.stringify(got)}`);
      // And a roof means RAFTERS. Four of these used to frame a building open to the sky.
      assert.ok(m.members.some((x) => x.role === 'rafter'),
        `${id} + ${label}: ${m.members.length} members and not one rafter — no roof was framed`);
    }
  }
});

test('and it SAYS SO — a repair the operator is not told about is a different building', () => {
  for (const id of [...HUTS, CONTROL]) {
    for (const { label, roof } of MALFORMED) {
      const said = build(id, roof).issues.filter((i: SpecIssue) => i.path.startsWith('roof'));
      assert.ok(said.length > 0,
        `${id} + ${label}: repaired silently — nothing on any roof path`);
      assert.ok(said.every((i) => i.severity === 'warn' || i.severity === 'info'),
        `${id} + ${label}: ${JSON.stringify(said.map((i) => i.severity))}`);
    }
  }
});

test('and a hut repairs it into exactly the roof a building would', () => {
  // The claim that makes this ONE contract rather than two that happen to agree today. Same input,
  // same resolved roof — kind, pitch, overhang and high side alike.
  for (const id of HUTS) {
    for (const { label, roof } of MALFORMED) {
      const hut = roofOf(build(id, roof));
      const bldg = roofOf(build(CONTROL, roof));
      assert.deepEqual(hut, bldg,
        `${id} + ${label}: the hut resolved ${JSON.stringify(hut)} and the building ${JSON.stringify(bldg)}`);
    }
  }
});

test('and the roofing-slope note is shared too, which is the same block', () => {
  // `checkRoofingSlope` sat in the same function and was skipped the same way: a 1-in-12 hut under
  // exposed-nail roll roofing came back clean while the identical building was told.
  for (const id of [...HUTS, CONTROL]) {
    const low = build(id, { kind: 'gable', risePer12: 1, overhangFt: 1 });
    const spec = JSON.parse(JSON.stringify(familyById(id as CardId)!.preset)) as { coverings: { roofing: string } };
    if (spec.coverings.roofing !== 'roll' && spec.coverings.roofing !== 'rollDouble') continue;
    assert.ok(low.issues.some((i: SpecIssue) => i.path === 'coverings.roofing' && i.kind === 'ls-note'),
      `${id}: 1 in 12 under ${spec.coverings.roofing} and nothing said about the minimum slope`);
  }
});

test('and what must NOT change: an absent roof, and every card as shipped', () => {
  // A building has to have a roof and gets a gable with a warning. A hut variant supplies its own,
  // so an absent roof there is not a defect and must not start being warned about — the repair is
  // guarded on presence for exactly that reason.
  for (const id of HUTS) {
    const spec = JSON.parse(JSON.stringify(familyById(id)!.preset)) as Record<string, unknown>;
    delete spec.roof;
    const m = generateStructure(spec as never);
    assert.ok(m.members.some((x) => x.role === 'rafter'), `${id}: no roof asked for and none framed`);
    assert.equal(m.issues.filter((i: SpecIssue) => i.path.startsWith('roof')).length, 0,
      `${id}: warned about a roof the variant supplies itself`);
  }
  const noRoof = JSON.parse(JSON.stringify(familyById(CONTROL)!.preset)) as Record<string, unknown>;
  delete noRoof.roof;
  assert.ok(generateStructure(noRoof as never).issues.some((i: SpecIssue) => i.path === 'roof'),
    'a building with no roof is still told about it');

  // And every shipped preset comes out of normalization with nothing new said about its roof.
  for (const f of shippedFamilies()) {
    const m = generateStructure(JSON.parse(JSON.stringify(f.preset)));
    assert.equal(m.issues.filter((i: SpecIssue) => i.path.startsWith('roof')).length, 0,
      `${f.id}: the card as shipped now raises ${JSON.stringify(
        m.issues.filter((i: SpecIssue) => i.path.startsWith('roof')).map((i) => i.message))}`);
  }
});
