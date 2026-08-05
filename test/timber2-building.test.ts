// TIMBER-2 — building breadth: new foundations and the small-plan rule (plan §8.3, §3.2.2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { specFromBuildingInput } from '../src/timber/frame';
import { joistNominalFor, SMALL_PLAN_WIDTH_FT } from '../src/timber/subsystems/floorSystem';
import type { BuildingSpec, FoundationSpec } from '../src/timber/spec';

function bldg(over: Partial<BuildingSpec> = {}): BuildingSpec {
  const base = specFromBuildingInput({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
  });
  return { ...base, ...over };
}

test('slab on grade: the slab IS the floor — concrete, an edge under the walls, no wood floor', () => {
  // What this replaces: "Slab on grade" emitted NO slab. It fell through to the framed-floor
  // branch and produced joists, bridging and a subfloor resting on nothing at all — a wood
  // floor with clear air under it, and no concrete anywhere in the model or on the bill.
  const model = generateStructure(bldg({ foundation: { kind: 'slab' } }));

  const slabs = model.members.filter((m) => m.role === 'slab');
  assert.equal(slabs.length, 1, 'one pour');
  const slab = slabs[0]!;
  const slabTop = slab.position[1] + slab.actual.d / 12 / 2;
  assert.ok(Math.abs(slabTop) < 1e-9, `the slab top IS the floor; it is at ${slabTop.toFixed(3)}`);
  assert.ok(Math.abs(slab.cutLength / 12 - 20) < 1e-9, 'the pour covers the plan length');
  assert.ok(Math.abs(slab.actual.w / 12 - 16) < 1e-9, 'and its width');

  // NOTHING IS FRAMED UNDER A SLAB. Stated as "what is below the floor" rather than a list of
  // banned roles, because 'joist' is not by itself a floor member — a gable roof's ceiling
  // joists carry the same role, up at the plates, and a ban on the word would have failed for
  // the wrong reason.
  for (const m of model.members.filter((x) => x.position[1] < -1e-6)) {
    assert.ok(
      m.role === 'slab' || m.role === 'footing',
      `${m.id} (${m.role}) is under a slab — only the pour and its edge belong there`,
    );
  }

  // The thickened edge runs under every wall line, carrying the slab.
  const edge = model.members.filter((m) => m.role === 'footing');
  assert.equal(edge.length, 4, 'one run per wall line');
  const slabBottom = slab.position[1] - slab.actual.d / 12 / 2;
  for (const f of edge) {
    const top = f.position[1] + f.actual.d / 12 / 2;
    assert.ok(Math.abs(top - slabBottom) < 1e-9, `${f.id}: its top must be the slab's underside`);
  }

  // And the walls stand ON it: a sole plate's underside is the slab's top face.
  const sole = model.members.filter((m) => m.role === 'solePlate');
  assert.ok(sole.length > 0);
  for (const p of sole) {
    // A plate is laid FLAT (rx = -90°), so its thickness — `actual.w` — is the vertical
    // dimension, not its face width. Getting that backwards reads a plate as 2 in low.
    // Only the FLATNESS matters here; the yaw differs per wall (the N plate faces about-face).
    assert.ok(Math.abs(Math.abs(p.rotation[0]) - Math.PI / 2) < 1e-6, `${p.id}: a plate lies flat`);
    const bottom = p.position[1] - p.actual.w / 12 / 2;
    assert.ok(Math.abs(bottom - slabTop) < 1e-6, `${p.id}: sits at ${bottom.toFixed(3)}, slab top ${slabTop.toFixed(3)}`);
  }

  // The stages a crew actually works through, in the plan's own words.
  assert.deepEqual(
    model.stagePlan.slice(1, 4).map((e) => e.label),
    ['Thickened edge poured', 'Slab poured', 'Slab cures'],
  );
  // Those rows keep their POSITIONS: the frozen wall generator stamps 5 and 6 as literals, so
  // dropping a row above them lands every wall member a stage late or past the plan entirely.
  assert.equal(model.stagePlan[4]!.key, 'walls');
  assert.equal(model.stagePlan[5]!.key, 'plates');
});

test('skids: runners under the floor, no posts, no pads', () => {
  const model = generateStructure(bldg({ foundation: { kind: 'skids' } }));
  const skids = model.members.filter((m) => m.role === 'skid');
  assert.ok(skids.length >= 2, `expected skid runners, got ${skids.length}`);
  assert.equal(model.members.filter((m) => m.role === 'post').length, 0, 'skids replace posts');
  assert.equal(model.members.filter((m) => m.role === 'footing').length, 0, 'and their footers');
  for (const s of skids) {
    assert.equal(s.nominal, '4x6');
    assert.ok(/chamfer|drift/i.test(s.nailing), `${s.id}: a skid is dragged — say how it is built`);
    assert.ok(Math.abs(s.cutLength / 12 - 20) < 1e-9, 'runners run the full length');
  }
  // The building still has a floor and walls on top of them.
  assert.ok(model.members.some((m) => m.role === 'joist'));
  assert.ok(model.members.some((m) => m.role === 'stud'));
});

test('slab: the floor frames on grade with no crawl space below it', () => {
  const model = generateStructure(bldg({ foundation: { kind: 'slab' } }));
  assert.equal(model.members.filter((m) => m.role === 'post').length, 0);
  assert.equal(model.members.filter((m) => m.role === 'skid').length, 0);
  assert.ok(model.levels.gradeY < 0, 'grade sits just under the deck');
  assert.ok(model.levels.gradeY > -2, 'and not a crawl space away');
  assert.ok(model.members.some((m) => m.role === 'joist'));
});

test('§3.2.2 small-plan rule: below 8 ft of width there is NO girder', () => {
  const narrow = generateStructure(bldg({ dims: { lengthFt: 12, widthFt: 6 }, foundation: { kind: 'skids' } }));
  assert.equal(narrow.members.filter((m) => m.role === 'girder').length, 0, 'a 6-ft-wide floor clear-spans');
  // FLOOR joists only — the roof's ceiling joists share the role but carry the RF prefix.
  const joists = narrow.members.filter((m) => m.role === 'joist' && m.id.startsWith('FL-'));
  assert.ok(joists.length > 0);
  assert.equal(joists[0]!.nominal, '2x6', 'a short clear span calls for a 2x6, not the house 2x8');
  // And the joists really do run wall to wall.
  for (const j of joists) {
    assert.ok(Math.abs(j.cutLength / 12 - (6 - 2 * (1.5 / 12))) < 1e-9, `${j.id}: full clear span`);
  }
});

test('the joist-size rule is stated once and agrees with the constant', () => {
  assert.equal(SMALL_PLAN_WIDTH_FT, 8);
  assert.equal(joistNominalFor(SMALL_PLAN_WIDTH_FT - 0.01), '2x6');
  assert.equal(joistNominalFor(SMALL_PLAN_WIDTH_FT), '2x8');
  assert.equal(joistNominalFor(24), '2x8');
});

test('the 4x4 skid preset generates green — the catalog envelope minimum really works', () => {
  const tiny = generateStructure(bldg({
    dims: { lengthFt: 4, widthFt: 4 },
    foundation: { kind: 'skids' },
    roof: { kind: 'shed', risePer12: 2, overhangFt: 0.5, highSide: 'N' },
    stories: [{ wallHeightFt: 7, openings: {} }],
  }));
  assert.ok(tiny.members.length > 20, `a 4x4 shack still frames: ${tiny.members.length} members`);
  assert.equal(tiny.members.filter((m) => m.role === 'girder').length, 0, 'no girder in a 4-ft plan');
  for (const m of tiny.members) {
    for (const v of [...m.position, ...m.rotation, m.cutLength]) assert.ok(Number.isFinite(v), m.id);
    assert.ok(m.cutLength > 0, `${m.id}: ${m.cutLength}`);
  }
});

test('openFront drops that wall\'s openings and says why (a wall that IS an opening)', () => {
  const spec = bldg({
    openFront: 'S',
    stories: [{ wallHeightFt: 8, openings: { S: [{ kind: 'door', offsetFt: 4, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 }] } }],
  });
  const model = generateStructure(spec);
  assert.equal((model.spec as BuildingSpec).stories[0]!.openings.S, undefined);
  const issue = model.issues.find((i) => i.path.includes('openings.S'));
  assert.ok(issue && /open front/i.test(issue.message), 'the user is told, not silently corrected');
});

test('every foundation kind produces a finite, staged, uniquely-identified model', () => {
  const founds: FoundationSpec[] = [
    { kind: 'piers', crawlFt: 1.5 },
    { kind: 'wall', crawlFt: 2 },
    { kind: 'basement', depthFt: 7.5, stairs: true },
    { kind: 'slab' },
    { kind: 'skids' },
  ];
  for (const foundation of founds) {
    const model = generateStructure(bldg({ foundation }));
    const ids = new Set<string>();
    for (const m of model.members) {
      assert.ok(!ids.has(m.id), `${foundation.kind}: duplicate id ${m.id}`);
      ids.add(m.id);
      assert.ok(m.stage >= 1 && m.stage <= model.stagePlan.length, `${foundation.kind}/${m.id}: stage ${m.stage}`);
      for (const v of [...m.position, ...m.rotation, m.cutLength]) {
        assert.ok(Number.isFinite(v), `${foundation.kind}/${m.id}: non-finite`);
      }
    }
  }
});

test('coverings compose with every foundation and roof without id collisions', () => {
  for (const foundation of [{ kind: 'skids' } as const, { kind: 'piers', crawlFt: 1.5 } as const]) {
    for (const roof of [
      { kind: 'gable', risePer12: 4, overhangFt: 1 } as const,
      { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'N' } as const,
      { kind: 'flat', overhangFt: 0.5, drainPer12: 1 } as const,
    ]) {
      const model = generateStructure(bldg({
        foundation,
        roof,
        coverings: { wallSheathing: 'plywood', siding: 'boardAndBatten', roofDeck: 'plywood', roofing: 'roll' },
      }));
      const ids = new Set<string>();
      for (const m of model.members) {
        assert.ok(!ids.has(m.id), `${foundation.kind}/${roof.kind}: duplicate id ${m.id}`);
        ids.add(m.id);
      }
      assert.ok(model.members.some((m) => m.role === 'siding' || m.role === 'sidingBoard'), 'siding present');
      assert.ok(model.members.some((m) => m.role === 'roofingCourse'), 'roofing present');
    }
  }
});
